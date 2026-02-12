/**
 * Netlify Function: consulta dados históricos de chuvas no BigQuery (GCP).
 * As credenciais vêm de GOOGLE_APPLICATION_CREDENTIALS_JSON (conteúdo do credentials.json em string).
 *
 * Variáveis de ambiente (Netlify ou .env):
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON stringificado do arquivo credentials.json (recomendado em produção)
 * - ou GOOGLE_APPLICATION_CREDENTIALS: caminho para o arquivo (uso local)
 * - GCP_PROJECT_ID: opcional, usa project_id do JSON se não informado
 * - BIGQUERY_DATASET: dataset no BigQuery (ex: alertadb_cor_raw)
 * - BIGQUERY_TABLE: tabela (ex: pluviometricos)
 * - BIGQUERY_LOCATION: região do dataset (ex: southamerica-east1). Recomendado quando não for US.
 *
 * Query params:
 * - dateFrom: data início (YYYY-MM-DD)
 * - dateTo: data fim (YYYY-MM-DD)
 * - limit: máximo de linhas (default 1000)
 * - stationId / station: filtro por estação (opcional)
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

let stationCoordsCache = null;

function normalizeStationKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Fallback: coordenadas por nome normalizado (quando data/pluviometros.json não existe no deploy). */
const FALLBACK_STATION_COORDS = new Map([
  ['vidigal', [-22.9925, -43.233056]],
  ['urca', [-22.955833, -43.166667]],
  ['rocinha', [-22.985833, -43.245]],
  ['tijuca', [-22.931944, -43.221667]],
  ['santa teresa', [-22.931667, -43.196389]],
  ['copacabana', [-22.986389, -43.189444]],
  ['grajau', [-22.922222, -43.2675]],
  ['ilha do governador', [-22.818056, -43.210278]],
  ['penha', [-22.844444, -43.275278]],
  ['madureira', [-22.873333, -43.338889]],
  ['iraja', [-22.826944, -43.336944]],
  ['bangu', [-22.880278, -43.465833]],
  ['piedade', [-22.893056, -43.307222]],
  ['jacarepagua tanque', [-22.9125, -43.364722]],
  ['saude', [-22.898056, -43.194444]],
  ['jardim botanico', [-22.972778, -43.223889]],
  ['barra barrinha', [-23.008486, -43.299653]],
  ['jacarepagua cidade de deus', [-22.945556, -43.362778]],
  ['barra riocentro', [-22.977205, -43.391548]],
  ['guaratiba', [-23.050278, -43.594722]],
  ['est grajau jacarepagua', [-22.925556, -43.315833]],
  ['santa cruz', [-22.909444, -43.684444]],
  ['grande meier', [-22.890556, -43.278056]],
  ['anchieta', [-22.826944, -43.403333]],
  ['grota funda', [-23.014444, -43.519444]],
  ['campo grande', [-22.903611, -43.561944]],
  ['sepetiba', [-22.968889, -43.711667]],
  ['alto da boa vista', [-22.965833, -43.278333]],
  ['av brasil mendanha', [-22.856944, -43.541111]],
  ['recreio dos bandeirantes', [-23.01, -43.440556]],
  ['laranjeiras', [-22.940556, -43.1875]],
  ['sao cristovao', [-22.896667, -43.221667]],
  ['tijuca muda', [-22.932778, -43.243333]],
]);

function getStationCoordsMap() {
  if (stationCoordsCache) return stationCoordsCache;
  const map = new Map(FALLBACK_STATION_COORDS);
  const dataPath = [
    path.resolve(process.cwd(), 'data', 'pluviometros.json'),
    path.join(__dirname, '..', '..', 'data', 'pluviometros.json'),
  ].find((p) => fs.existsSync(p));

  if (dataPath) {
    try {
      const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const list = Array.isArray(raw?.pluviometros) ? raw.pluviometros : [];
      list.forEach((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        map.set(normalizeStationKey(item.nome), [lat, lng]);
      });
    } catch (err) {
      console.warn('Falha ao carregar data/pluviometros.json:', err.message);
    }
  }

  stationCoordsCache = map;
  return map;
}

function enrichRowsWithLocation(rows) {
  const coordsByName = getStationCoordsMap();
  if (!coordsByName.size) return rows;

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (Array.isArray(row.location) || (row.latitude != null && row.longitude != null)) return row;

    const stationName = row.station_name || row.name || row.estacao;
    if (!stationName) return row;

    const coords = coordsByName.get(normalizeStationKey(stationName));
    if (!coords) return row;

    const [lat, lng] = coords;
    return {
      ...row,
      location: [lat, lng],
      latitude: lat,
      longitude: lng,
    };
  });
}

function parseCredentialsJson(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // Às vezes a variável é salva com aspas extras ao redor (ex.: valor "{\"type\":...}")
    const unquoted = trimmed.replace(/^["']([\s\S]*)["']$/, '$1').replace(/\\"/g, '"');
    try {
      return JSON.parse(unquoted);
    } catch (__) {
      return null;
    }
  }
}

function getBigQueryClient() {
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const projectId = process.env.GCP_PROJECT_ID;

  if (jsonCreds) {
    const credentials = parseCredentialsJson(jsonCreds);
    if (!credentials) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS_JSON está definida mas o JSON é inválido. ' +
          'Gere o valor com: node scripts/prepare-netlify-credentials.js e cole o conteúdo de credentials/netlify-env-value.txt na variável (sem aspas em volta).'
      );
    }
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS_JSON está definida mas o JSON não contém client_email ou private_key. ' +
          'Use o arquivo JSON completo da service account do GCP (credentials.json).'
      );
    }
    const privateKey =
      typeof credentials.private_key === 'string'
        ? credentials.private_key.replace(/\\n/g, '\n')
        : credentials.private_key;
    return new BigQuery({
      projectId: projectId || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: privateKey,
      },
    });
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    return new BigQuery({
      projectId: projectId,
      keyFilename: keyPath,
    });
  }

  // Fallback local: tenta cwd e depois pasta do projeto (relativo a este arquivo)
  const tryPaths = [
    path.resolve(process.cwd(), 'credentials', 'credentials.json'),
    path.join(__dirname, '..', '..', 'credentials', 'credentials.json'),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      return new BigQuery({
        projectId: projectId,
        keyFilename: p,
      });
    }
  }

  throw new Error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS no ambiente (ou crie credentials/credentials.json localmente). ' +
      'Netlify: Site settings → Environment variables → adicione GOOGLE_APPLICATION_CREDENTIALS_JSON com o JSON em uma linha (veja GCP_SETUP.md) e faça um novo deploy.'
  );
}

function buildQuery(params) {
  const projectId = process.env.GCP_PROJECT_ID || 'alertadb-cor';
  const dataset = process.env.BIGQUERY_DATASET || 'alertadb_cor_raw';
  const table = process.env.BIGQUERY_TABLE || 'pluviometricos';
  const fullTable = `\`${projectId}.${dataset}.${table}\``;

  const limit = Math.min(Number(params.limit) || 1000, 10000);
  const dateFrom = params.dateFrom || params.date_from;
  const dateTo = params.dateTo || params.date_to;
  const sort = String(params.sort || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const station = params.stationId || params.station;

  // Ajuste os nomes das colunas conforme seu schema no BigQuery
  const dateCol = process.env.BIGQUERY_DATE_COLUMN || 'dia';
  const stationIdCol = process.env.BIGQUERY_STATION_ID_COLUMN || 'estacao_id';
  const stationNameCol = process.env.BIGQUERY_STATION_NAME_COLUMN || 'estacao';
  // Colunas: dia, dia_original, utc_offset, m05, m15, h01, h24, estacao, estacao_id
  const selectColumns = (process.env.BIGQUERY_SELECT_COLUMNS || [
    '`' + dateCol + '` AS dia',
    'dia_original',
    'utc_offset',
    'm05',
    'm15',
    'h01',
    'h24',
    'estacao',
    'estacao_id',
  ].join(', ')).trim();

  const safe = (s) => String(s).replace(/'/g, "''");
  const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());

  let where = [];
  if (dateFrom) {
    if (isDateOnly(dateFrom)) {
      where.push(`(DATE(\`${dateCol}\`) >= DATE('${safe(dateFrom)}'))`);
    } else {
      where.push(`(TIMESTAMP(\`${dateCol}\`) >= TIMESTAMP('${safe(dateFrom)}'))`);
    }
  }
  if (dateTo) {
    if (isDateOnly(dateTo)) {
      where.push(`(DATE(\`${dateCol}\`) <= DATE('${safe(dateTo)}'))`);
    } else {
      where.push(`(TIMESTAMP(\`${dateCol}\`) <= TIMESTAMP('${safe(dateTo)}'))`);
    }
  }
  if (station) where.push(`(\`${stationIdCol}\` = '${safe(station)}' OR \`${stationNameCol}\` = '${safe(station)}')`);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return `
    SELECT DISTINCT
      ${selectColumns}
    FROM ${fullTable}
    ${whereClause}
    ORDER BY \`${dateCol}\` ${sort}
    LIMIT ${limit}
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Método não permitido' }),
    };
  }

  const params = event.queryStringParameters || {};
  const location = process.env.BIGQUERY_LOCATION || 'us-west1';

  try {
    const bigquery = getBigQueryClient();
    const query = buildQuery(params);
    const [rows] = await bigquery.query(location ? { query, location } : { query });
    const rowsWithLocation = enrichRowsWithLocation(rows);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, data: rowsWithLocation }),
    };
  } catch (err) {
    console.error('BigQuery error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Erro ao consultar BigQuery',
      }),
    };
  }
};
