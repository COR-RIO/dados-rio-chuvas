/**
 * Netlify Function: consulta o histórico de vento forte/muito-forte no BigQuery
 * (vento_eventos_fortes, alimentada por scripts/backfill-wind-events.js + wind-events-sync.js).
 * Mesmo padrão de historical-rain.js — só que lendo a tabela de vento em vez da de chuva.
 *
 * Existe pra responder "quando tivemos vento forte no passado" (cruzamento pra debriefing/
 * calibração do alerta), já que o alarme ao vivo (useWindData.ts findWindAlerts) não é retroativo.
 *
 * Variáveis de ambiente: as mesmas de historical-rain.js (GOOGLE_APPLICATION_CREDENTIALS_JSON ou
 * GOOGLE_APPLICATION_CREDENTIALS) + WIND_EVENTS_TABLE (padrão: vento_eventos_fortes).
 *
 * Query params:
 * - dateFrom, dateTo: YYYY-MM-DD (obrigatórios)
 * - icao: filtro opcional por aeroporto (ex.: SBSC)
 * - categoria: 'forte' | 'muito-forte' (opcional, sem filtro = ambas)
 * - limit: máximo de linhas (padrão 1000, teto 10000)
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const CACHE_CONTROL_SUCCESS = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

function parseCredentialsJson(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
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
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON inválida (falta client_email/private_key).');
    }
    return new BigQuery({
      projectId: projectId || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
      },
    });
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) return new BigQuery({ projectId, keyFilename: keyPath });

  const tryPaths = [
    path.resolve(process.cwd(), 'credentials', 'credentials.json'),
    path.join(__dirname, '..', '..', 'credentials', 'credentials.json'),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) return new BigQuery({ projectId, keyFilename: p });
  }

  throw new Error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS (mesma credencial da chuva histórica — ver GCP_SETUP.md).'
  );
}

function buildQuery(params) {
  const projectId = process.env.GCP_PROJECT_ID || 'alertadb-cor';
  const dataset = process.env.BIGQUERY_DATASET || 'alertadb_cor_raw';
  const table = process.env.WIND_EVENTS_TABLE || 'vento_eventos_fortes';
  const fullTable = `\`${projectId}.${dataset}.${table}\``;

  const limit = Math.min(Number(params.limit) || 1000, 10000);
  const safe = (s) => String(s).replace(/'/g, "''");
  const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());

  const where = [];
  if (params.dateFrom) {
    where.push(
      isDateOnly(params.dateFrom)
        ? `DATE(observed_at) >= DATE('${safe(params.dateFrom)}')`
        : `observed_at >= TIMESTAMP('${safe(params.dateFrom)}')`
    );
  }
  if (params.dateTo) {
    where.push(
      isDateOnly(params.dateTo)
        ? `DATE(observed_at) <= DATE('${safe(params.dateTo)}')`
        : `observed_at <= TIMESTAMP('${safe(params.dateTo)}')`
    );
  }
  if (params.icao) where.push(`icao = '${safe(params.icao.toUpperCase())}'`);
  if (params.categoria === 'forte' || params.categoria === 'muito-forte') {
    where.push(`categoria = '${safe(params.categoria)}'`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return `
    SELECT icao, estacao_nome, corredor, observed_at, wind_speed_ms, wind_gust_ms,
           wind_direction_deg, message_type, categoria, raw, fonte
    FROM ${fullTable}
    ${whereClause}
    ORDER BY observed_at DESC
    LIMIT ${limit}
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ success: false, error: 'Método não permitido' }) };
  }

  const params = event.queryStringParameters || {};
  if (!params.dateFrom || !params.dateTo) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'dateFrom e dateTo são obrigatórios (YYYY-MM-DD)' }),
    };
  }

  const location = process.env.BIGQUERY_LOCATION || 'us-west1';

  try {
    const bigquery = getBigQueryClient();
    const query = buildQuery(params);
    const [rows] = await bigquery.query({ query, location });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_SUCCESS },
      body: JSON.stringify({ success: true, count: rows.length, data: rows }),
    };
  } catch (err) {
    console.error('wind-events-history error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar histórico de vento' }),
    };
  }
};
