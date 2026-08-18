/**
 * Netlify Scheduled Function: mantém a tabela BigQuery de eventos de vento forte/muito-forte
 * (vento_eventos_fortes) atualizada com dados novos — os backfills (scripts/backfill-wind-events.js
 * pra REDEMET, scripts/backfill-wind-events-inmet.js pra INMET) só cobrem o passado até o momento
 * em que rodaram; isso aqui cobre "agora em diante", pras duas fontes (coluna `fonte` distingue).
 *
 * Agenda declarada em netlify.toml ([functions."wind-events-sync"] schedule = "...").
 *
 * Busca uma janela recente (não só a leitura mais atual) pra não perder SPECI/observação emitida
 * entre uma execução e outra — a janela é bem maior que o intervalo do agendamento de propósito, e
 * o insertId (icao+observedAt) evita duplicar linha se um evento aparecer em duas execuções.
 *
 * Variáveis de ambiente: as mesmas de redemet-wind.js (REDEMET_API_KEY), v1-wind.js
 * (INMET_TOKEN ou VITE_INMET_TOKEN) e historical-rain.js (GOOGLE_APPLICATION_CREDENTIALS_JSON ou
 * GOOGLE_APPLICATION_CREDENTIALS). Falta de uma das duas chaves de fonte (REDEMET/INMET) não
 * impede a outra de sincronizar — cada uma roda isolada (Promise.allSettled no handler).
 */

const { BigQuery } = require('@google-cloud/bigquery');

const REDEMET_API_KEY = process.env.REDEMET_API_KEY;
const INMET_TOKEN = process.env.INMET_TOKEN || process.env.VITE_INMET_TOKEN;
const INMET_BASE = 'https://apitempo.inmet.gov.br';
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

// Mesma lista de src/config/windBelt.ts (WIND_BELT_CITIES) — mesma nota de duplicação acima.
const WIND_BELT_CITIES = [
  { nameMatch: ['angra dos reis'], uf: 'RJ', corridor: 'costeiro', label: 'Angra dos Reis' },
  { nameMatch: ['paraty'], uf: 'RJ', corridor: 'costeiro', label: 'Paraty' },
  { nameMatch: ['pico do couto'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Petrópolis (Pico do Couto)' },
  { nameMatch: ['juiz de fora'], uf: 'MG', corridor: 'norte-noroeste', label: 'Juiz de Fora' },
  { nameMatch: ['resende'], uf: 'RJ', corridor: 'oeste-sudoeste', label: 'Resende' },
  { nameMatch: ['seropedica'], uf: 'RJ', corridor: 'oeste-sudoeste', label: 'Seropédica (Ecologia Agrícola)' },
  { nameMatch: ['valenca'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Valença' },
  { nameMatch: ['nova friburgo'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Nova Friburgo' },
  { nameMatch: ['duque de caxias'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Duque de Caxias' },
  { nameMatch: ['sao paulo', 'mirante'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São Paulo' },
  { nameMatch: ['sao jose dos campos'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São José dos Campos' },
  { nameMatch: ['taubate'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'Taubaté' },
  { nameMatch: ['jacarepagua'], uf: 'RJ', corridor: 'interno', label: 'Jacarepaguá' },
  { nameMatch: ['marambaia'], uf: 'RJ', corridor: 'interno', label: 'Marambaia' },
  { nameMatch: ['vila militar'], uf: 'RJ', corridor: 'interno', label: 'Vila Militar' },
  { nameMatch: ['forte de copacabana', 'copacabana'], uf: 'RJ', corridor: 'interno', label: 'Forte de Copacabana' },
];

const INMET_ACCENT_MAP = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c',
};

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => INMET_ACCENT_MAP[ch] ?? ch)
    .join('')
    .trim();
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

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
        fonte: 'REDEMET',
      },
    });
  }
  return rows;
}

/** Casa as cidades do cinturão com estações reais do INMET (mesma lógica de v1-wind.js). */
function matchInmetBeltStations(stations) {
  const matched = [];
  for (const city of WIND_BELT_CITIES) {
    const found = stations.find((s) => {
      const name = normalize(s.DC_NOME);
      const uf = normalize(s.SG_ESTADO ?? s.UF);
      const nameMatches = city.nameMatch.some((term) => name.includes(normalize(term)));
      const ufMatches = !city.uf || uf === normalize(city.uf);
      return nameMatches && ufMatches;
    });
    if (found?.CD_ESTACAO) matched.push({ code: found.CD_ESTACAO, name: found.DC_NOME || city.label, city });
  }
  return matched;
}

async function fetchRecentInmetRecords(sinceDate, nowDate) {
  const listResponse = await fetch(`${INMET_BASE}/estacoes/T`, { headers: { Accept: 'application/json' } });
  if (!listResponse.ok) throw new Error(`INMET estacoes/T retornou ${listResponse.status}`);
  const stationList = await listResponse.json();
  const matched = matchInmetBeltStations(Array.isArray(stationList) ? stationList : []);

  const dateOnly = (d) => d.toISOString().slice(0, 10);
  const results = await Promise.allSettled(
    matched.map(async (m) => {
      const url = `${INMET_BASE}/token/estacao/${dateOnly(sinceDate)}/${dateOnly(nowDate)}/${m.code}/${INMET_TOKEN}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`INMET estacao ${m.code} retornou ${response.status}`);
      const text = await response.text();
      if (text === 'CHAVE INVÁLIDA!') throw new Error('INMET_TOKEN/VITE_INMET_TOKEN inválido');
      const records = JSON.parse(text);
      return { m, records: Array.isArray(records) ? records : [] };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

function buildInmetRows(stationResults) {
  const rows = [];
  const now = new Date().toISOString();
  for (const { m, records } of stationResults) {
    for (const obs of records) {
      const windSpeedMs = toFiniteNumber(obs.VEN_VEL);
      if (windSpeedMs == null) continue;
      const windGustMs = toFiniteNumber(obs.VEN_RAJ);
      const gustKmh = (windGustMs ?? windSpeedMs) * 3.6;
      if (gustKmh < FORTE_THRESHOLD_KMH) continue;

      const day = obs.DT_MEDICAO;
      const hr = String(obs.HR_MEDICAO ?? '0000').padStart(4, '0');
      const observedAt = `${day}T${hr.slice(0, 2)}:${hr.slice(2, 4)}:00Z`;
      rows.push({
        insertId: `${m.code}_${observedAt}`,
        json: {
          icao: m.code, // reaproveita o campo (herdado da REDEMET) pro código INMET — `fonte` distingue.
          estacao_nome: m.city.label,
          corredor: m.city.corridor,
          observed_at: observedAt,
          wind_speed_ms: windSpeedMs,
          wind_gust_ms: windGustMs,
          wind_direction_deg: toFiniteNumber(obs.VEN_DIR),
          message_type: null, // INMET não tem conceito de METAR/SPECI
          categoria: gustKmh >= 76 ? 'muito-forte' : 'forte',
          raw: null,
          fetched_at: now,
          fonte: 'INMET',
        },
      });
    }
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

async function syncRedemet(since, now) {
  const dataIni = toRedemetDateParam(since);
  const dataFim = toRedemetDateParam(now);
  const records = await fetchRecentRecords(dataIni, dataFim);
  return { checked: records.length, candidateRows: buildRows(records, since) };
}

async function syncInmet(since, now) {
  const stationResults = await fetchRecentInmetRecords(since, now);
  const checked = stationResults.reduce((sum, r) => sum + r.records.length, 0);
  return { checked, candidateRows: buildInmetRows(stationResults) };
}

exports.handler = async () => {
  if (!REDEMET_API_KEY && !INMET_TOKEN) {
    console.error('wind-events-sync: nem REDEMET_API_KEY nem INMET_TOKEN/VITE_INMET_TOKEN configurados');
    return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Nenhuma fonte configurada (REDEMET_API_KEY ou INMET_TOKEN)' }) };
  }

  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  // Cada fonte roda isolada: se uma falhar (ex.: token inválido, API fora do ar), a outra
  // continua sincronizando normalmente em vez de a function inteira falhar.
  const [redemetResult, inmetResult] = await Promise.allSettled([
    REDEMET_API_KEY ? syncRedemet(since, now) : Promise.resolve({ checked: 0, candidateRows: [] }),
    INMET_TOKEN ? syncInmet(since, now) : Promise.resolve({ checked: 0, candidateRows: [] }),
  ]);

  if (redemetResult.status === 'rejected') console.error('wind-events-sync REDEMET error:', redemetResult.reason?.message);
  if (inmetResult.status === 'rejected') console.error('wind-events-sync INMET error:', inmetResult.reason?.message);

  const redemet = redemetResult.status === 'fulfilled' ? redemetResult.value : { checked: 0, candidateRows: [] };
  const inmet = inmetResult.status === 'fulfilled' ? inmetResult.value : { checked: 0, candidateRows: [] };
  const candidateRows = [...redemet.candidateRows, ...inmet.candidateRows];

  try {
    const bigquery = getBigQueryClient();
    const newRows = await filterAlreadyStored(bigquery, since, candidateRows);

    if (newRows.length) {
      const table = bigquery.dataset(DATASET, { location: LOCATION }).table(TABLE);
      await table.insert(newRows, { ignoreUnknownValues: false, skipInvalidRows: false, raw: true });
    }

    console.log(
      `wind-events-sync: REDEMET ${redemet.checked} registros/${redemet.candidateRows.length} forte, ` +
        `INMET ${inmet.checked} registros/${inmet.candidateRows.length} forte, ${newRows.length} realmente novos salvos`
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        redemet: { checked: redemet.checked, candidates: redemet.candidateRows.length, error: redemetResult.status === 'rejected' ? redemetResult.reason?.message : null },
        inmet: { checked: inmet.checked, candidates: inmet.candidateRows.length, error: inmetResult.status === 'rejected' ? inmetResult.reason?.message : null },
        saved: newRows.length,
      }),
    };
  } catch (err) {
    console.error('wind-events-sync error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
