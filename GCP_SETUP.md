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

**Importante:** No site [chovendo-agora.netlify.app](https://chovendo-agora.netlify.app), o modo Histórico (GCP) só funciona se `GOOGLE_APPLICATION_CREDENTIALS_JSON` (e opcionalmente as outras) estiverem configuradas em **Site settings → Environment variables**. Se aparecer erro 500 ou "Defina GOOGLE_APPLICATION_CREDENTIALS_JSON", configure essa variável e faça um novo deploy.

**Local:** Se você rodar **`npx netlify dev`**, a função usa automaticamente o arquivo `credentials/credentials.json` da pasta do projeto (não precisa variável de ambiente). Se rodar só **`npm run dev`**, as chamadas vão para o site no Netlify; aí as credenciais precisam estar no painel do Netlify.

**GCP:** Não é necessário “apontar” o site no Google Cloud. O service account do `credentials.json` já tem permissão no projeto; basta o Netlify (ou o ambiente que roda a função) ter acesso a esse JSON.

### Como gerar e colar `GOOGLE_APPLICATION_CREDENTIALS_JSON`

**Recomendado (evita erro de formatação):** use o script que gera o valor exato para colar:

```bash
node scripts/prepare-netlify-credentials.js
```

Isso cria o arquivo `credentials/netlify-env-value.txt` (não é commitado). Depois:

1. Abra `credentials/netlify-env-value.txt`.
2. Selecione **tudo** (Ctrl+A) e copie (Ctrl+C).
3. No Netlify: **Site settings → Environment variables** → crie ou edite `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
4. Cole **apenas** o conteúdo (não adicione aspas nem espaços em volta).
5. Salve e faça um **novo deploy** (Build & deploy → Trigger deploy).

**Alternativa no terminal (Linux/macOS):**

```bash
cat credentials/credentials.json | jq -c .
```

Copie a saída e cole no valor da variável no Netlify.

**Erros comuns:**

- **Não** coloque o valor entre aspas extras no painel do Netlify (ex.: `"{...}"`). O valor deve ser só o JSON.
- **Não** edite manualmente o JSON (remover/quebrar linhas à mão pode invalidar o JSON). Use o script acima.
- Se mudar a variável, é necessário **novo deploy** para a function usar o novo valor.

**Se o erro "Defina GOOGLE_APPLICATION_CREDENTIALS_JSON..." continuar:**

1. **Testando no site Netlify:** confira em **Site settings → Environment variables** se a variável `GOOGLE_APPLICATION_CREDENTIALS_JSON` existe, está no escopo **Production** (ou no que você usa) e se você fez **Trigger deploy** depois de salvar.
2. **Testando localmente com `npm run dev`:** o front chama a API no Netlify; as credenciais precisam estar no painel do Netlify. Para usar o arquivo local, rode **`npx netlify dev`** em vez de `npm run dev` — aí a function roda na sua máquina e usa `credentials/credentials.json`.

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
