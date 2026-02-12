# Configuração GCP (BigQuery) – Dados históricos de chuvas

Este projeto usa uma **Netlify Function** para consultar dados históricos de chuvas no **Google BigQuery**, usando o arquivo de credenciais (service account) do GCP.

## 1. Credenciais

- O arquivo `credentials/credentials.json` **não deve ser commitado** (já está no `.gitignore`).
- Em **produção (Netlify)** use variáveis de ambiente; não envie o JSON no repositório.

## 2. Variáveis de ambiente

### Netlify (produção)

No painel da Netlify: **Site settings → Environment variables**:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Sim* | Conteúdo do `credentials.json` em **uma única linha** (JSON minificado). |
| `GCP_PROJECT_ID` | Não | Projeto GCP (ex: `alertadb-cor`). Se omitido, usa o `project_id` do JSON. |
| `BIGQUERY_DATASET` | Não | Nome do dataset no BigQuery (default no projeto: `alertadb_cor_raw`). |
| `BIGQUERY_TABLE` | Não | Nome da tabela (default no projeto: `pluviometricos`). |
| `BIGQUERY_LOCATION` | Não | Localização do dataset (default no projeto: `us-west1`). |
| `BIGQUERY_DATE_COLUMN` | Não | Nome da coluna de data/hora (default no projeto: `dia`). |
| `BIGQUERY_STATION_ID_COLUMN` | Não | Nome da coluna de ID da estação (default no projeto: `estacao_id`). |
| `BIGQUERY_STATION_NAME_COLUMN` | Não | Nome da coluna de nome da estação (default no projeto: `estacao`). |
| `BIGQUERY_SELECT_COLUMNS` | Não | Lista de colunas usadas no `SELECT DISTINCT` da função histórica. |

\* Ou use `GOOGLE_APPLICATION_CREDENTIALS` com o caminho do arquivo (apenas em ambiente onde o arquivo existe, ex.: build local).

### Como gerar `GOOGLE_APPLICATION_CREDENTIALS_JSON`

No terminal (a partir da pasta do projeto):

```bash
# Linux/macOS (minifica o JSON em uma linha)
cat credentials/credentials.json | jq -c . 
```

Ou abra `credentials/credentials.json`, remova quebras de linha e coloque todo o conteúdo em uma única linha; depois cole o valor na variável no Netlify.

### Desenvolvimento local

Crie um arquivo `.env` (não commitado) na raiz do projeto:

```env
# Caminho para o arquivo de credenciais (mais simples localmente)
GOOGLE_APPLICATION_CREDENTIALS=./credentials/credentials.json
GCP_PROJECT_ID=alertadb-cor
BIGQUERY_DATASET=alertadb_cor_raw
BIGQUERY_TABLE=pluviometricos
BIGQUERY_LOCATION=us-west1
BIGQUERY_DATE_COLUMN=dia
BIGQUERY_STATION_ID_COLUMN=estacao_id
BIGQUERY_STATION_NAME_COLUMN=estacao
```

Para testar a function localmente:

```bash
npx netlify dev
```

A API de histórico ficará em: `http://localhost:8888/api/historical-rain`.

## 3. BigQuery

- Crie um **dataset** (ex: `chuvas`) e uma **tabela** com os dados históricos.
- A função espera colunas como: `timestamp` (ou nome configurado), `station_id` / `station_name`, e campos de precipitação (ex.: `h01`, `h24`). Ajuste os nomes pelas variáveis acima ou edite `netlify/functions/historical-rain.js` (função `buildQuery`).

## 4. Uso no frontend

```ts
import { fetchHistoricalRain } from './services/gcpHistoricalRainApi';

const dados = await fetchHistoricalRain({
  dateFrom: '2025-01-01',
  dateTo: '2025-02-01',
  limit: 500,
  stationId: 'alguma-estacao',
});
```

Também é possível consultar intervalo com hora/minuto:

```ts
const dados = await fetchHistoricalRain({
  dateFrom: '2009-02-15 22:00:00.000',
  dateTo: '2009-02-18 02:00:00.000',
  sort: 'asc',
  limit: 1000,
});
```

## 5. Segurança

- **Nunca** commite `credentials.json` ou chaves no repositório.
- Em produção use apenas variáveis de ambiente (ex.: `GOOGLE_APPLICATION_CREDENTIALS_JSON` no Netlify).
- A Netlify Function roda no servidor; as credenciais não são expostas no navegador.
