/**
 * Netlify Function: consulta dados históricos de chuvas no BigQuery (GCP).
 * As credenciais vêm de GOOGLE_APPLICATION_CREDENTIALS_JSON (conteúdo do credentials.json em string).
 *
 * Variáveis de ambiente (Netlify ou .env):
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON stringificado do arquivo credentials.json (recomendado em produção)
 * - ou GOOGLE_APPLICATION_CREDENTIALS: caminho para o arquivo (uso local)
 * - GCP_PROJECT_ID: opcional, usa project_id do JSON se não informado
 * - BIGQUERY_DATASET: dataset no BigQuery (ex: chuvas)
 * - BIGQUERY_TABLE: tabela (ex: historico_leituras)
 *
 * Query params:
 * - dateFrom: data início (YYYY-MM-DD)
 * - dateTo: data fim (YYYY-MM-DD)
 * - limit: máximo de linhas (default 1000)
 * - stationId / station: filtro por estação (opcional)
 */

const { BigQuery } = require('@google-cloud/bigquery');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

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

  throw new Error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS no ambiente'
  );
}

function buildQuery(params) {
  const projectId = process.env.GCP_PROJECT_ID || 'alertadb-cor';
  const dataset = process.env.BIGQUERY_DATASET || 'chuvas';
  const table = process.env.BIGQUERY_TABLE || 'historico_leituras';
  const fullTable = `\`${projectId}.${dataset}.${table}\``;

  const limit = Math.min(Number(params.limit) || 1000, 10000);
  const dateFrom = params.dateFrom || params.date_from;
  const dateTo = params.dateTo || params.date_to;
  const station = params.stationId || params.station;

  // Ajuste os nomes das colunas (timestamp, station_id, station_name) conforme seu schema no BigQuery
  const dateCol = process.env.BIGQUERY_DATE_COLUMN || 'timestamp';
  const stationIdCol = process.env.BIGQUERY_STATION_ID_COLUMN || 'station_id';
  const stationNameCol = process.env.BIGQUERY_STATION_NAME_COLUMN || 'station_name';

  const safe = (s) => String(s).replace(/'/g, "''");

  let where = [];
  if (dateFrom) where.push(`(DATE(\`${dateCol}\`) >= DATE('${safe(dateFrom)}'))`);
  if (dateTo) where.push(`(DATE(\`${dateCol}\`) <= DATE('${safe(dateTo)}'))`);
  if (station) where.push(`(\`${stationIdCol}\` = '${safe(station)}' OR \`${stationNameCol}\` = '${safe(station)}')`);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return `
    SELECT *
    FROM ${fullTable}
    ${whereClause}
    ORDER BY \`${dateCol}\` DESC
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

  try {
    const bigquery = getBigQueryClient();
    const query = buildQuery(params);
    const [rows] = await bigquery.query({ query });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, data: rows }),
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
