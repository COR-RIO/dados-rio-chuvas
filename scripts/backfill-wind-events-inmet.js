/**
 * Preenche o histórico de eventos de vento forte/muito forte (>=52 km/h, rajada ou média — mesmo
 * limiar de WIND_CATEGORY_RANGES.forte) das estações INMET do cinturão, complementando o backfill
 * da REDEMET (scripts/backfill-wind-events.js) na mesma tabela BigQuery (vento_eventos_fortes,
 * coluna `fonte` distingue REDEMET de INMET — ver scripts/_tmp-migrate-fonte.mjs / migração feita
 * em 2026-08-18).
 *
 * Diferente da REDEMET (histórico confirmado desde 2003), a cobertura do INMET por estação é
 * incerta — cada uma foi instalada em data diferente. Por padrão busca só os últimos ~3 anos
 * (INMET_BACKFILL_YEARS abaixo); pedir mais que isso arrisca gastar tempo à toa em anos sem
 * estação instalada (a API só devolve array vazio, sem erro, então não quebra — só é lento).
 *
 * Uso: node scripts/backfill-wind-events-inmet.js
 * Retomar depois de interromper: só rodar de novo — o checkpoint continua de onde parou.
 * Recomeçar do zero: apague scripts/.wind-backfill-checkpoint-inmet.json
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

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'alertadb-cor';
const DATASET = process.env.BIGQUERY_DATASET || 'alertadb_cor_raw';
const TABLE = process.env.WIND_EVENTS_TABLE || 'vento_eventos_fortes';
const LOCATION = process.env.BIGQUERY_LOCATION || 'us-west1';
const INMET_TOKEN = process.env.INMET_TOKEN || process.env.VITE_INMET_TOKEN;
const INMET_BASE = 'https://apitempo.inmet.gov.br';

const INMET_BACKFILL_YEARS = 3;
const CHUNK_DAYS = 30; // INMET não pagina como a REDEMET — bloco maior é seguro, menos requisições
const DELAY_BETWEEN_REQUESTS_MS = 400; // educado com a API — evita bloqueio/rate limit
const FORTE_THRESHOLD_KMH = 52; // WIND_CATEGORY_RANGES.forte (src/types/wind.ts)

// Mesma lista de src/config/windBelt.ts (WIND_BELT_CITIES) — copiada aqui de propósito (ver nota
// em backfill-wind-events.js sobre por que não importa o módulo direto). Atualize aqui também se
// a lista mudar lá.
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

const CHECKPOINT_PATH = path.join(__dirname, '.wind-backfill-checkpoint-inmet.json');

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

const ACCENT_MAP = {
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
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('')
    .trim();
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Maior valor entre vento médio e rajada, em km/h — checa os dois independente, pra não perder
 * um evento onde a média sozinha já cruza o limiar de forte/muito-forte. */
function strongestKmh(speedMs, gustMs) {
  const speedKmh = speedMs * 3.6;
  const gustKmh = gustMs != null ? gustMs * 3.6 : null;
  return Math.max(speedKmh, gustKmh ?? 0);
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

/** Casa as cidades do cinturão com estações reais do INMET (mesma lógica de v1-wind.js/inmetWindApi.ts). */
function matchBeltStations(stations) {
  const matched = [];
  for (const city of WIND_BELT_CITIES) {
    const found = stations.find((s) => {
      const name = normalize(s.DC_NOME);
      const uf = normalize(s.SG_ESTADO ?? s.UF);
      const nameMatches = city.nameMatch.some((term) => name.includes(normalize(term)));
      const ufMatches = !city.uf || uf === normalize(city.uf);
      return nameMatches && ufMatches;
    });
    if (found?.CD_ESTACAO) {
      matched.push({ code: found.CD_ESTACAO, name: found.DC_NOME || city.label, city });
    } else {
      console.warn(`Aviso: nenhuma estação INMET encontrada para "${city.label}" (nameMatch: ${city.nameMatch.join(', ')})`);
    }
  }
  return matched;
}

async function fetchStationList() {
  const response = await fetch(`${INMET_BASE}/estacoes/T`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INMET estacoes/T retornou ${response.status}`);
  return response.json();
}

const MAX_RETRIES = 5;
const RATE_LIMIT_BACKOFF_MS = 15000; // INMET não documenta o limite exato — 15s é conservador

/** Busca observações horárias de uma estação num intervalo — sem paginação (ao contrário da REDEMET).
 * Com retry/backoff: a API do INMET rate-limita sem status HTTP de erro (200 OK com corpo tipo
 * "Você atingiu o limite..." em vez de JSON) — confirmado em produção 2026-08-18, um trecho do
 * backfill (fev-jun/2025) falhou por completo pra todas as 15 estações até o limite liberar de
 * novo sozinho. Retry com espera evita perder o bloco inteiro por causa disso. */
async function fetchStationRange(code, fromDate, toDate) {
  const url = `${INMET_BASE}/token/estacao/${dateOnly(fromDate)}/${dateOnly(toDate)}/${code}/${INMET_TOKEN}`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`INMET estacao ${code} retornou ${response.status}`);
    const text = await response.text();
    if (text === 'CHAVE INVÁLIDA!') throw new Error('INMET_TOKEN/VITE_INMET_TOKEN inválido');
    try {
      const records = JSON.parse(text);
      return Array.isArray(records) ? records : [];
    } catch {
      if (attempt === MAX_RETRIES) {
        throw new Error(`resposta não-JSON após ${MAX_RETRIES} tentativas (provável rate limit): ${text.slice(0, 80)}`);
      }
      console.warn(`  ${code}: resposta não-JSON (tentativa ${attempt}/${MAX_RETRIES}, provável rate limit) — aguardando ${RATE_LIMIT_BACKOFF_MS / 1000}s...`);
      await sleep(RATE_LIMIT_BACKOFF_MS);
    }
  }
  return [];
}

function toObservedAtIso(obs) {
  const day = obs.DT_MEDICAO;
  const hr = String(obs.HR_MEDICAO ?? '0000').padStart(4, '0');
  return `${day}T${hr.slice(0, 2)}:${hr.slice(2, 4)}:00Z`;
}

function buildRows(records, matched) {
  const rows = [];
  const now = new Date().toISOString();
  for (const obs of records) {
    const windSpeedMs = toFiniteNumber(obs.VEN_VEL);
    if (windSpeedMs == null) continue;
    const windGustMs = toFiniteNumber(obs.VEN_RAJ);
    const maxKmh = strongestKmh(windSpeedMs, windGustMs);
    if (maxKmh < FORTE_THRESHOLD_KMH) continue;

    const observedAt = toObservedAtIso(obs);
    rows.push({
      insertId: `${matched.code}_${observedAt}`,
      json: {
        icao: matched.code, // reaproveita o campo (nome herdado da REDEMET) pro código INMET — `fonte` distingue.
        estacao_nome: matched.city.label,
        corredor: matched.city.corridor,
        observed_at: observedAt,
        wind_speed_ms: windSpeedMs,
        wind_gust_ms: windGustMs,
        wind_direction_deg: toFiniteNumber(obs.VEN_DIR),
        message_type: null, // INMET não tem conceito de METAR/SPECI
        categoria: maxKmh >= 76 ? 'muito-forte' : 'forte',
        raw: null,
        fetched_at: now,
        fonte: 'INMET',
      },
    });
  }
  return rows;
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
function sqlNumber(value) {
  return value == null ? 'NULL' : String(value);
}
function sqlTimestamp(value) {
  return value == null ? 'NULL' : `TIMESTAMP(${sqlString(value)})`;
}

/**
 * Insere via MERGE (DML), não streaming insert — streaming não fica imediatamente consultável
 * (buffer de alguns minutos), então rodar o backfill duas vezes em sequência sobre um período
 * parecido (ex.: o reprocessamento do trecho com rate limit) podia duplicar linha, já que a
 * checagem "já existe" de uma passada não enxergava o insert da outra ainda (aconteceu de
 * verdade — ver limpeza de 276 duplicatas em 2026-08-18). MERGE é atômico contra o estado real da
 * tabela, sem essa janela.
 */
async function mergeRows(bigquery, rows) {
  if (!rows.length) return 0;
  const values = rows
    .map(({ json: r }) =>
      `(${sqlString(r.icao)}, ${sqlString(r.estacao_nome)}, ${sqlString(r.corredor)}, ${sqlTimestamp(r.observed_at)}, ${sqlNumber(r.wind_speed_ms)}, ${sqlNumber(r.wind_gust_ms)}, ${sqlNumber(r.wind_direction_deg)}, ${sqlString(r.message_type)}, ${sqlString(r.categoria)}, ${sqlString(r.raw)}, ${sqlTimestamp(r.fetched_at)}, ${sqlString(r.fonte)})`
    )
    .join(',\n      ');

  const query = `
    MERGE \`${PROJECT_ID}.${DATASET}.${TABLE}\` T
    USING (
      SELECT * FROM UNNEST(ARRAY<STRUCT<icao STRING, estacao_nome STRING, corredor STRING, observed_at TIMESTAMP, wind_speed_ms FLOAT64, wind_gust_ms FLOAT64, wind_direction_deg INT64, message_type STRING, categoria STRING, raw STRING, fetched_at TIMESTAMP, fonte STRING>>[
      ${values}
      ])
    ) S
    ON T.icao = S.icao AND T.observed_at = S.observed_at AND T.fonte = S.fonte
    WHEN NOT MATCHED THEN
      INSERT (icao, estacao_nome, corredor, observed_at, wind_speed_ms, wind_gust_ms, wind_direction_deg, message_type, categoria, raw, fetched_at, fonte)
      VALUES (S.icao, S.estacao_nome, S.corredor, S.observed_at, S.wind_speed_ms, S.wind_gust_ms, S.wind_direction_deg, S.message_type, S.categoria, S.raw, S.fetched_at, S.fonte)
  `;

  const [job] = await bigquery.createQueryJob({ query, location: LOCATION });
  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  return Number(metadata.statistics?.query?.dmlStats?.insertedRowCount ?? 0);
}

/** --from AAAA-MM-DD --to AAAA-MM-DD reprocessa só esse intervalo (ignora checkpoint) — usado pra
 * cobrir um trecho que falhou (ex.: rate limit do INMET) sem refazer o backfill inteiro. */
function parseCliRange() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  if (fromIdx === -1 && toIdx === -1) return null;
  if (fromIdx === -1 || toIdx === -1) throw new Error('Use --from AAAA-MM-DD --to AAAA-MM-DD juntos.');
  return { from: new Date(`${args[fromIdx + 1]}T00:00:00Z`), to: new Date(`${args[toIdx + 1]}T00:00:00Z`) };
}

async function main() {
  if (!INMET_TOKEN) {
    throw new Error('Defina INMET_TOKEN ou VITE_INMET_TOKEN no .env (ver docs/WIND_SETUP.md).');
  }

  const bigquery = getBigQueryClient();

  console.log('Buscando lista de estações INMET (/estacoes/T)...');
  const stationList = await fetchStationList();
  const matched = matchBeltStations(stationList);
  console.log(`Estações do cinturão resolvidas: ${matched.length}/${WIND_BELT_CITIES.length}`);
  matched.forEach((m) => console.log(`  ${m.code} — ${m.name} (${m.city.corridor})`));

  const cliRange = parseCliRange();
  const now = cliRange ? cliRange.to : new Date();
  const earliest = cliRange ? cliRange.from : new Date(now);
  if (!cliRange) earliest.setFullYear(earliest.getFullYear() - INMET_BACKFILL_YEARS);

  const checkpoint = !cliRange && loadCheckpoint();
  let chunkEnd = checkpoint ? new Date(checkpoint.oldestCompletedChunkStart) : now;
  if (cliRange) console.log(`\nModo intervalo específico: ${dateOnly(earliest)} a ${dateOnly(now)} (checkpoint ignorado, não é salvo).`);

  let totalChecked = 0;
  let totalCandidates = 0;
  let totalSaved = 0;

  while (chunkEnd > earliest) {
    const chunkStart = new Date(Math.max(chunkEnd.getTime() - CHUNK_DAYS * 24 * 60 * 60 * 1000, earliest.getTime()));
    console.log(`\nBloco: ${dateOnly(chunkStart)} a ${dateOnly(chunkEnd)}`);

    for (const m of matched) {
      try {
        const records = await fetchStationRange(m.code, chunkStart, chunkEnd);
        totalChecked += records.length;
        const candidateRows = buildRows(records, m);
        totalCandidates += candidateRows.length;

        if (candidateRows.length) {
          const saved = await mergeRows(bigquery, candidateRows);
          totalSaved += saved;
          console.log(`  ${m.code} (${m.name}): ${records.length} registros, ${candidateRows.length} forte/muito-forte, ${saved} novos salvos`);
        }
      } catch (err) {
        console.error(`  ${m.code} (${m.name}) erro: ${err.message}`);
      }
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }

    if (!cliRange) saveCheckpoint(chunkStart.toISOString());
    chunkEnd = chunkStart;
  }

  console.log(`\nConcluído. Registros verificados: ${totalChecked}, candidatos forte/muito-forte: ${totalCandidates}, novos salvos: ${totalSaved}`);
  console.log(`Backfill completo — pode apagar ${CHECKPOINT_PATH} se quiser rodar do zero de novo.`);
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
