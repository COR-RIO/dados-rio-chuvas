/**
 * Testa o acesso ao BigQuery (GCP) rodando uma query de exemplo.
 * Usa credentials/credentials.json ou GOOGLE_APPLICATION_CREDENTIALS_JSON.
 *
 * Uso:
 *   node scripts/test-gcp-query.js                    # default: 2009-02-15 a 2009-02-18
 *   node scripts/test-gcp-query.js 2025-01-01 2025-01-31
 *   node scripts/test-gcp-query.js 2025-01-01 2025-12-31
 */

import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultFrom = '2009-02-15 22:00:00.000';
const defaultTo = '2009-02-18 02:00:00.000';

function buildQuery(dateFrom, dateTo) {
  const from = dateFrom ? `${dateFrom.replace(/^(\d{4}-\d{2}-\d{2})$/, '$1 00:00:00.000')}` : defaultFrom;
  const to = dateTo ? `${dateTo.replace(/^(\d{4}-\d{2}-\d{2})$/, '$1 23:59:59.999')}` : defaultTo;
  return `
SELECT DISTINCT
  dia,
  dia_original,
  utc_offset,
  m05,
  m15,
  h01,
  h24,
  estacao,
  estacao_id
FROM \`alertadb-cor.alertadb_cor_raw.pluviometricos\`
WHERE dia >= '${from}' AND dia <= '${to}'
ORDER BY dia ASC
LIMIT 1000
`.trim();
}

function getClient() {
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonCreds) {
    try {
      const credentials = JSON.parse(jsonCreds.trim());
      return new BigQuery({
        projectId: process.env.GCP_PROJECT_ID || credentials.project_id,
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key?.replace(/\\n/g, '\n'),
        },
      });
    } catch (e) {
      console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON inválida:', e.message);
      process.exit(1);
    }
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '..', 'credentials', 'credentials.json');
  if (fs.existsSync(keyPath)) {
    return new BigQuery({
      projectId: process.env.GCP_PROJECT_ID || 'alertadb-cor',
      keyFilename: keyPath,
    });
  }

  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS, ou crie credentials/credentials.json'
  );
  process.exit(1);
}

async function main() {
  const dateFrom = process.argv[2];
  const dateTo = process.argv[3];
  const query = buildQuery(dateFrom, dateTo);

  console.log('Conectando ao BigQuery (GCP)...\n');
  if (dateFrom || dateTo) console.log('Período:', dateFrom || defaultFrom, 'a', dateTo || defaultTo, '\n');
  console.log('Query:\n', query, '\n');

  const bigquery = getClient();
  const location = process.env.BIGQUERY_LOCATION || 'us-west1';

  try {
    const [rows] = await bigquery.query({
      query,
      location,
    });

    console.log('--- Resultado ---');
    console.log('Total de linhas:', rows.length);

    if (rows.length > 0) {
      console.log('\nPrimeira linha (amostra):');
      console.log(JSON.stringify(rows[0], null, 2));
      if (rows.length > 1) {
        console.log('\nSegunda linha (amostra):');
        console.log(JSON.stringify(rows[1], null, 2));
      }
      if (rows.length > 2) {
        console.log('\n... e mais', rows.length - 2, 'linhas.');
      }
    }

    console.log('\nAcesso ao GCP (BigQuery) OK.');
  } catch (err) {
    console.error('Erro ao executar a query:', err.message);
    if (err.errors) console.error('Detalhes:', err.errors);
    process.exit(1);
  }
}

main();
