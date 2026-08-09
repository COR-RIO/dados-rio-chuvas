/**
 * Netlify Scheduled Function: mantém a tabela BigQuery de eventos de vento forte/muito-forte
 * (vento_eventos_fortes) atualizada com dados novos — o backfill (scripts/backfill-wind-events.js)
 * só cobre o passado até o momento em que rodou; isso aqui cobre "agora em diante".
 *
 * Agenda declarada em netlify.toml ([functions."wind-events-sync"] schedule = "...").
 *
 * Busca uma janela recente (não só o METAR mais atual) pra não perder SPECI emitido entre uma
 * execução e outra — a janela é bem maior que o intervalo do agendamento de propósito, e o
 * insertId (icao+observedAt) evita duplicar linha se um evento aparecer em duas execuções.
 *
 * Variáveis de ambiente: as mesmas de redemet-wind.js (REDEMET_API_KEY) e historical-rain.js
 * (GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS).
 */

const { BigQuery } = require('@google-cloud/bigquery');

const REDEMET_API_KEY = process.env.REDEMET_API_KEY;
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'alertadb-cor';
const DATASET = process.env.BIGQUERY_DATASET || 'alertadb_cor_raw';
const TABLE = process.env.WIND_EVENTS_TABLE || 'vento_eventos_fortes';
const LOCATION = process.env.BIGQUERY_LOCATION || 'us-west1';

const PAGE_SIZE = 200;
const MAX_PAGES = 5; // janela curta (poucas horas) — nunca deveria precisar de mais que isso
const LOOKBACK_HOURS = 3; // bem maior que o intervalo do cron — margem contra execução perdida
const FORTE_THRESHOLD_KMH = 52; // WIND_CATEGORY_RANGES.forte (src/types/wind.ts)
const KT_TO_MS = 0.514444;

// Mesma lista de src/config/windBelt.ts — ver nota em scripts/backfill-wind-events.js sobre por
// que fica duplicada aqui em vez de importada.
const WIND_BELT_AIRPORTS = [
  { icao: 'SBJF', label: 'Juiz de Fora', corridor: 'norte-noroeste' },
  { icao: 'SBGR', label: 'Guarulhos', corridor: 'oeste-sudoeste' },
  { icao: 'SBSP', label: 'Congonhas', corridor: 'oeste-sudoeste' },
  { icao: 'SBSJ', label: 'São José dos Campos', corridor: 'oeste-sudoeste' },
  { icao: 'SBMT', label: 'Campo de Marte', corridor: 'oeste-sudoeste' },
  { icao: 'SBST', label: 'Santos/Guarujá', corridor: 'costeiro' },
  { icao: 'SDAG', label: 'Angra dos Reis', corridor: 'costeiro' },
  { icao: 'SBCB', label: 'Cabo Frio', corridor: 'costeiro' },
  { icao: 'SBME', label: 'Macaé', corridor: 'costeiro' },
  { icao: 'SBCP', label: 'Campos dos Goytacazes', corridor: 'costeiro' },
  { icao: 'SBGL', label: 'Galeão', corridor: 'interno' },
  { icao: 'SBRJ', label: 'Santos Dumont', corridor: 'interno' },
  { icao: 'SBSC', label: 'Santa Cruz', corridor: 'interno' },
  { icao: 'SBAF', label: 'Campo dos Afonsos', corridor: 'interno' },
  { icao: 'SBJR', label: 'Jacarepaguá', corridor: 'interno' },
];
const ICAO_LIST = WIND_BELT_AIRPORTS.map((a) => a.icao).join(',');
const AIRPORT_BY_ICAO = new Map(WIND_BELT_AIRPORTS.map((a) => [a.icao, a]));

function toRedemetDateParam(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}`;
}

function extractMetarRecords(json) {
  const candidates = [json?.data?.data, json?.data, json?.mensagens, json];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function extractRawText(record) {
  if (typeof record === 'string') return record;
  return record?.mens || record?.message || record?.metar || record?.raw || '';
}

function extractIcao(record, rawText) {
  if (record?.id_localidade) return String(record.id_localidade).toUpperCase();
  if (record?.icao) return String(record.icao).toUpperCase();
  const match = /\b([A-Z]{4})\b/.exec(rawText || '');
  return match ? match[1] : null;
}

function extractMessageType(rawText) {
  return /^SPECI\b/.test((rawText || '').trim()) ? 'SPECI' : 'METAR';
}

function parseWindGroup(rawText) {
  const match = /\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)\b/.exec(rawText || '');
  if (!match) return null;
  const [, dir, speedRaw, , gustRaw, unit] = match;
  const factor = unit === 'KT' ? KT_TO_MS : 1;
  return {
    windDirectionDeg: dir === 'VRB' ? null : Number(dir),
    windSpeedMs: Math.round(Number(speedRaw) * factor * 10) / 10,
    windGustMs: gustRaw ? Math.round(Number(gustRaw) * factor * 10) / 10 : null,
  };
}

function parseObservedAt(record, rawText, fallback) {
  const dateField = record?.validade_inicial || record?.recebimento || record?.hora;
  if (dateField) {
    const iso = String(dateField).replace(' ', 'T');
    const withZone = /Z$/.test(iso) ? iso : `${iso}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const match = /\b(\d{2})(\d{2})(\d{2})Z\b/.exec(rawText || '');
  if (!match) return fallback.toISOString();
  const [, dayStr, hourStr, minStr] = match;
  return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), Number(dayStr), Number(hourStr), Number(minStr))).toISOString();
}

async function fetchRecentRecords(dataIni, dataFim) {
  const baseUrl = `https://api-redemet.decea.mil.br/mensagens/metar/${ICAO_LIST}?api_key=${encodeURIComponent(REDEMET_API_KEY)}&data_ini=${dataIni}&data_fim=${dataFim}`;
  const records = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await fetch(`${baseUrl}&page_tam=${PAGE_SIZE}&page=${page}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) break;
    const json = await response.json();
    if (json.status === false) break;
    records.push(...extractMetarRecords(json));
    lastPage = Number(json?.data?.last_page) || 1;
    page++;
  } while (page <= Math.min(lastPage, MAX_PAGES));

  return records;
}

function buildRows(records, fallbackDate) {
  const rows = [];
  const now = new Date().toISOString();
  for (const record of records) {
    const rawText = extractRawText(record);
    const wind = parseWindGroup(rawText);
    const icao = extractIcao(record, rawText);
    if (!wind || !icao || !AIRPORT_BY_ICAO.has(icao)) continue;

    const gustKmh = (wind.windGustMs ?? wind.windSpeedMs) * 3.6;
    if (gustKmh < FORTE_THRESHOLD_KMH) continue;

    const airport = AIRPORT_BY_ICAO.get(icao);
    const observedAt = parseObservedAt(record, rawText, fallbackDate);
    rows.push({
      insertId: `${icao}_${observedAt}`,
      json: {
        icao,
        estacao_nome: airport.label,
        corredor: airport.corridor,
        observed_at: observedAt,
        wind_speed_ms: wind.windSpeedMs,
        wind_gust_ms: wind.windGustMs,
        wind_direction_deg: wind.windDirectionDeg,
        message_type: extractMessageType(rawText),
        categoria: gustKmh >= 76 ? 'muito-forte' : 'forte',
        raw: rawText,
        fetched_at: now,
      },
    });
  }
  return rows;
}

/**
 * Remove da lista quem já está salvo (mesmo icao+observed_at). Necessário porque o dedup por
 * insertId do BigQuery streaming insert só vale por ~1 minuto — como essa function roda a cada
 * 15min e a "leitura mais recente" de uma estação costuma continuar a mesma por várias execuções
 * seguidas (sem METAR novo), sem essa checagem cada execução duplicava a mesma linha na tabela
 * (confirmado acontecendo em produção: SBGR com 4 linhas idênticas, 15min de diferença no
 * fetched_at). Uma query de leitura antes do insert é bem mais barata que acumular duplicata.
 */
async function filterAlreadyStored(bigquery, since, rows) {
  if (!rows.length) return rows;
  const [existing] = await bigquery.query({
    query: `SELECT DISTINCT icao, observed_at FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE observed_at >= @since`,
    params: { since: since.toISOString() },
    location: LOCATION,
  });
  const existingKeys = new Set(
    existing.map((r) => {
      const ts = r.observed_at && typeof r.observed_at === 'object' ? r.observed_at.value : r.observed_at;
      return `${r.icao}_${new Date(ts).toISOString()}`;
    })
  );
  return rows.filter((r) => !existingKeys.has(r.insertId));
}

function getBigQueryClient() {
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonCreds) {
    const credentials = JSON.parse(jsonCreds);
    return new BigQuery({
      projectId: PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
      },
    });
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    return new BigQuery({ projectId: PROJECT_ID, keyFilename: keyPath });
  }
  throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS (ver GCP_SETUP.md).');
}

exports.handler = async () => {
  if (!REDEMET_API_KEY) {
    console.error('wind-events-sync: REDEMET_API_KEY não configurada');
    return { statusCode: 200, body: JSON.stringify({ success: false, error: 'REDEMET_API_KEY não configurada' }) };
  }

  try {
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const dataIni = toRedemetDateParam(since);
    const dataFim = toRedemetDateParam(now);

    const records = await fetchRecentRecords(dataIni, dataFim);
    const candidateRows = buildRows(records, since);

    const bigquery = getBigQueryClient();
    const newRows = await filterAlreadyStored(bigquery, since, candidateRows);

    if (newRows.length) {
      const table = bigquery.dataset(DATASET, { location: LOCATION }).table(TABLE);
      await table.insert(newRows, { ignoreUnknownValues: false, skipInvalidRows: false, raw: true });
    }

    console.log(`wind-events-sync: ${records.length} registros brutos, ${candidateRows.length} forte/muito-forte na janela, ${newRows.length} realmente novos salvos`);
    return { statusCode: 200, body: JSON.stringify({ success: true, checked: records.length, saved: newRows.length }) };
  } catch (err) {
    console.error('wind-events-sync error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
