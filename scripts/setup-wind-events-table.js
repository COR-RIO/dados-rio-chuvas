/**
 * Cria (se não existir) a tabela BigQuery que guarda o histórico de eventos de vento forte/muito
 * forte no cinturão — usada pra calibrar o alerta com base no que já aconteceu no passado (ver
 * scripts/backfill-wind-events.js, que faz o preenchimento de verdade).
 *
 * Reaproveita o MESMO projeto/dataset já usado pra chuva histórica (ver docs/GCP_SETUP.md) — só
 * cria uma tabela nova dentro dele, não uma infraestrutura separada.
 *
 * Uso: node scripts/setup-wind-events-table.js
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

const SCHEMA = [
  { name: 'icao', type: 'STRING', mode: 'REQUIRED' },
  { name: 'estacao_nome', type: 'STRING', mode: 'NULLABLE' },
  { name: 'corredor', type: 'STRING', mode: 'NULLABLE' },
  { name: 'observed_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'wind_speed_ms', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'wind_gust_ms', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'wind_direction_deg', type: 'INT64', mode: 'NULLABLE' },
  { name: 'message_type', type: 'STRING', mode: 'NULLABLE' },
  { name: 'categoria', type: 'STRING', mode: 'NULLABLE' },
  { name: 'raw', type: 'STRING', mode: 'NULLABLE' },
  { name: 'fetched_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
];

async function main() {
  const bigquery = getBigQueryClient();
  const dataset = bigquery.dataset(DATASET, { location: LOCATION });

  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    throw new Error(`Dataset ${PROJECT_ID}.${DATASET} não existe — ele já deveria existir (usado pela chuva histórica). Confira BIGQUERY_DATASET no .env.`);
  }

  const table = dataset.table(TABLE);
  const [tableExists] = await table.exists();
  if (tableExists) {
    console.log(`Tabela ${PROJECT_ID}.${DATASET}.${TABLE} já existe — nada a fazer.`);
    return;
  }

  await dataset.createTable(TABLE, { schema: SCHEMA, location: LOCATION });
  console.log(`Tabela criada: ${PROJECT_ID}.${DATASET}.${TABLE}`);
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
