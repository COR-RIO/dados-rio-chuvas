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

function getStationCoordsMap() {
  if (stationCoordsCache) return stationCoordsCache;
  const map = new Map();
  const dataPath = path.resolve(process.cwd(), 'data', 'pluviometros.json');

  if (fs.existsSync(dataPath)) {
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

function getBigQueryClient() {
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const projectId = process.env.GCP_PROJECT_ID;

  if (jsonCreds) {
    const credentials = JSON.parse(jsonCreds);
    return new BigQuery({
      projectId: projectId || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
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

  // Fallback local: usa credentials/credentials.json automaticamente
  const defaultKeyPath = path.resolve(process.cwd(), 'credentials', 'credentials.json');
  if (fs.existsSync(defaultKeyPath)) {
    return new BigQuery({
      projectId: projectId,
      keyFilename: defaultKeyPath,
    });
  }

  throw new Error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS no ambiente (ou crie credentials/credentials.json localmente)'
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
  const selectColumns =
    process.env.BIGQUERY_SELECT_COLUMNS ||
    `
      \`${dateCol}\` AS dia,
      dia_original,
      utc_offset,
      m05,
      m10,
      m15,
      h01,
      h04,
      h24,
      h96,
      estacao,
      estacao_id
    `;

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
