/**
 * Preenche o histórico de eventos de vento forte/muito forte (>=52 km/h, rajada ou média — mesmo
 * limiar de WIND_CATEGORY_RANGES.forte) no cinturão, desde 2003 (início dos dados da API-REDEMET)
 * até hoje, salvando no BigQuery (tabela criada por setup-wind-events-table.js).
 *
 * Por quê fora de uma Netlify Function: 23 anos x 15 aeroportos, paginado em blocos de 200
 * (limite da API-REDEMET), são dezenas de milhares de registros — nada disso cabe no tempo de
 * execução de uma function (poucos segundos). Isso roda como processo longo, retomável.
 *
 * Uso: node scripts/backfill-wind-events.js
 * Retomar depois de interromper: só rodar de novo — o checkpoint continua de onde parou.
 * Recomeçar do zero: apague scripts/.wind-backfill-checkpoint.json
 */

import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadDotEnv();

// --- Config ---
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'alertadb-cor';
const DATASET = process.env.BIGQUERY_DATASET || 'alertadb_cor_raw';
const TABLE = process.env.WIND_EVENTS_TABLE || 'vento_eventos_fortes';
const LOCATION = process.env.BIGQUERY_LOCATION || 'us-west1';
const REDEMET_API_KEY = process.env.REDEMET_API_KEY;

const EARLIEST_DATE = '2003-01-01'; // API-REDEMET tem dados desde 01/01/2003 (confirmado na doc oficial)
const CHUNK_DAYS = 7; // janela semanal: fica bem abaixo do limite de registros por solicitação da API
const PAGE_SIZE = 200; // máximo aceito pela API-REDEMET (valores maiores são rejeitados)
const MAX_PAGES_PER_CHUNK = 20;
const DELAY_BETWEEN_REQUESTS_MS = 400; // educado com a API — evita bloqueio/rate limit
const FORTE_THRESHOLD_KMH = 52; // WIND_CATEGORY_RANGES.forte (src/types/wind.ts)
const KT_TO_MS = 0.514444;

// Mesma lista de src/config/windBelt.ts (WIND_BELT_AIRPORTS) — copiada aqui de propósito pra não
// depender de importar um módulo CJS de dentro de um script ESM (interop instável nesse projeto,
// "type":"module" + require() de netlify/functions/*.js já deu problema antes). Se a lista mudar
// lá, atualize aqui também.
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

const CHECKPOINT_PATH = path.join(__dirname, '.wind-backfill-checkpoint.json');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(oldestCompletedChunkStart) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({ oldestCompletedChunkStart }, null, 2), 'utf8');
}

function getBigQueryClient() {
  const credPath = path.join(__dirname, '..', 'credentials', 'credentials.json');
  if (fs.existsSync(credPath)) {
    return new BigQuery({ projectId: PROJECT_ID, keyFilename: credPath });
  }
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
  throw new Error(
    'Nenhuma credencial GCP encontrada. Coloque credentials/credentials.json (não commitado) ' +
      'ou defina GOOGLE_APPLICATION_CREDENTIALS_JSON no .env. Ver docs/GCP_SETUP.md.'
  );
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

function parseObservedAt(record, rawText, chunkStart) {
  const dateField = record?.validade_inicial || record?.recebimento || record?.hora;
  if (dateField) {
    const iso = String(dateField).replace(' ', 'T');
    const withZone = /Z$/.test(iso) ? iso : `${iso}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const match = /\b(\d{2})(\d{2})(\d{2})Z\b/.exec(rawText || '');
  if (!match) return chunkStart.toISOString();
  const [, dayStr, hourStr, minStr] = match;
  const day = Number(dayStr);
  const year = chunkStart.getUTCFullYear();
  const month = chunkStart.getUTCMonth();
  return new Date(Date.UTC(year, month, day, Number(hourStr), Number(minStr))).toISOString();
}

/** Busca todas as páginas da API-REDEMET pra uma janela de datas, com retry simples. */
async function fetchAllPages(dataIni, dataFim) {
  const baseUrl = `https://api-redemet.decea.mil.br/mensagens/metar/${ICAO_LIST}?api_key=${encodeURIComponent(REDEMET_API_KEY)}&data_ini=${dataIni}&data_fim=${dataFim}`;
  const records = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = `${baseUrl}&page_tam=${PAGE_SIZE}&page=${page}`;
    let json = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.ok) {
          json = await response.json();
          break;
        }
        console.warn(`  tentativa ${attempt}: HTTP ${response.status}`);
      } catch (err) {
        console.warn(`  tentativa ${attempt}: ${err.message}`);
      }
      await sleep(1000 * attempt);
    }
    if (!json) {
      console.warn(`  desistindo da página ${page} após 3 tentativas — seguindo com o que já tem`);
      break;
    }
    if (json.status === false) {
      console.warn(`  API retornou erro: ${json.message}`);
      break;
    }
    records.push(...extractMetarRecords(json));
    lastPage = Number(json?.data?.last_page) || 1;
    page++;
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  } while (page <= Math.min(lastPage, MAX_PAGES_PER_CHUNK));

  return records;
}

function buildRows(records, chunkStart) {
  const rows = [];
  for (const record of records) {
    const rawText = extractRawText(record);
    const wind = parseWindGroup(rawText);
    const icao = extractIcao(record, rawText);
    if (!wind || !icao || !AIRPORT_BY_ICAO.has(icao)) continue;

    const gustKmh = (wind.windGustMs ?? wind.windSpeedMs) * 3.6;
    if (gustKmh < FORTE_THRESHOLD_KMH) continue; // só guarda forte/muito-forte

    const airport = AIRPORT_BY_ICAO.get(icao);
    const observedAt = parseObservedAt(record, rawText, chunkStart);
    rows.push({
      insertId: `${icao}_${observedAt}`, // dedup best-effort do BigQuery em reinserções
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
        fetched_at: new Date().toISOString(),
      },
    });
  }
  return rows;
}

async function main() {
  if (!REDEMET_API_KEY) {
    throw new Error('REDEMET_API_KEY não definida no .env');
  }

  const bigquery = getBigQueryClient();
  const table = bigquery.dataset(DATASET, { location: LOCATION }).table(TABLE);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    throw new Error(`Tabela ${PROJECT_ID}.${DATASET}.${TABLE} não existe — rode primeiro: node scripts/setup-wind-events-table.js`);
  }

  const checkpoint = loadCheckpoint();
  const earliest = new Date(`${EARLIEST_DATE}T00:00:00Z`);
  let chunkEnd = checkpoint
    ? new Date(checkpoint.oldestCompletedChunkStart) // retoma logo antes do que já foi feito
    : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'); // hoje, meia-noite UTC

  console.log(`Backfill de vento forte/muito-forte — de ${earliest.toISOString().slice(0, 10)} até ${chunkEnd.toISOString().slice(0, 10)}, andando pra trás em janelas de ${CHUNK_DAYS} dias.`);
  if (checkpoint) console.log(`Retomando checkpoint: ${checkpoint.oldestCompletedChunkStart}`);

  let totalInserted = 0;
  let chunkCount = 0;

  while (chunkEnd > earliest) {
    const chunkStart = new Date(chunkEnd.getTime() - CHUNK_DAYS * 24 * 60 * 60 * 1000);
    const effectiveStart = chunkStart < earliest ? earliest : chunkStart;

    const dataIni = toRedemetDateParam(effectiveStart);
    const dataFim = toRedemetDateParam(new Date(chunkEnd.getTime() - 60 * 60 * 1000)); // -1h pra não repetir a hora 00 do próximo chunk

    process.stdout.write(`[${effectiveStart.toISOString().slice(0, 10)} .. ${chunkEnd.toISOString().slice(0, 10)}] buscando... `);

    try {
      const records = await fetchAllPages(dataIni, dataFim);
      const rows = buildRows(records, effectiveStart);

      if (rows.length) {
        // raw:true é obrigatório pro cliente entender o wrapper {insertId, json} — sem isso ele
        // trata o wrapper como se fosse a própria linha e reclama de campo desconhecido.
        await table.insert(rows, { ignoreUnknownValues: false, skipInvalidRows: false, raw: true });
        totalInserted += rows.length;
      }

      console.log(`${records.length} registros brutos, ${rows.length} fortes/muito-fortes salvos (total acumulado: ${totalInserted})`);
      saveCheckpoint(effectiveStart.toISOString());
    } catch (err) {
      // err.message pode vir vazio pra alguns tipos de erro do BigQuery (PartialFailureError
      // guarda o detalhe em err.errors); imprime tudo que existir.
      const details = err?.errors ? JSON.stringify(err.errors).slice(0, 500) : '';
      console.error(`ERRO no chunk, pulando: [${err?.name || 'Error'}] ${err?.message || '(sem mensagem)'} ${details}`);
      if (err?.stack) console.error(err.stack.split('\n').slice(0, 3).join('\n'));
      // Não salva checkpoint pra esse chunk — uma próxima rodada tenta de novo.
    }

    chunkEnd = effectiveStart;
    chunkCount++;
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  console.log(`\nConcluído. ${chunkCount} janelas processadas, ${totalInserted} eventos forte/muito-forte salvos no total.`);
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
