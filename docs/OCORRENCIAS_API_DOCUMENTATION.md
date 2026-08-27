# Integração APIs de Ocorrências

## Fontes por modo

| Modo       | Fonte  | URL / Uso |
|-----------|--------|------------|
| **Tempo real** | Simaa  | https://apisimaa.computei.srv.br/ocorrencias — ocorrências abertas, sem login, pública (usada automaticamente). |
| **Histórico** | Hexagon | API interna/confidencial (IP direto), exige login; ver abaixo. |

---

# API Hexagon (somente histórico)

## Visão Geral

A API Hexagon é usada **apenas no modo histórico** para buscar ocorrências por intervalo de datas. Em tempo real o app usa a API Simaa.

**Importante — arquitetura de segurança**: essa API é interna/confidencial (IP direto, exige login).
O app **não fala com ela diretamente do navegador**. O cliente (`src/services/ocorrenciasApi.ts`)
chama uma Netlify Function própria (`netlify/functions/ocorrencias-hexagon.js`), que faz login e
busca **no servidor** — IP, usuário e senha nunca chegam ao bundle JS público. (Antes essas
credenciais viviam em variáveis `VITE_*`, que o Vite embute no bundle do navegador por definição —
qualquer visitante podia extraí-las pelo DevTools. Corrigido.)

- **Credenciais**: configurar no Netlify (nunca em `VITE_*` — copiar de `.env.example`):
  - `OCORRENCIAS_API_BASE_URL` (raiz do servidor, ex.: `http://IP:PORTA`)
  - `OCORRENCIAS_API_USERNAME`
  - `OCORRENCIAS_API_PASSWORD`
  - `OCORRENCIAS_API_ENDPOINT_SUFFIX` (opcional): força o caminho do endpoint após o baseUrl.
    Padrão: v2 `Hxgn.OcorrenciaAPI/api/Ocorrencia/StatusDaOcorrência`; fallback automático para o
    legado `Ocorrencias/StatusDasOcorrencias` se der 404/405.
  - `OCORRENCIAS_API_LOGIN_PATH` (opcional, padrão `/login`): caminho do login/token.
- **Endpoint que o cliente chama**: `/api/ocorrencias-hexagon?inicio=DD-MM-YYYY&fim=DD-MM-YYYY&page=N&pageSize=N` (mesma origem — sem CORS, sem credenciais expostas).

## Fluxo de Uso (passo a passo, dentro da Netlify Function)

As duas chamadas abaixo (`login` e `StatusDasOcorrencias`) acontecem **dentro de
`netlify/functions/ocorrencias-hexagon.js`**, no servidor — não no navegador. Documentado aqui pra
quem for mexer na function ou testar a API Hexagon diretamente (ex.: via Swagger/Postman, com as
credenciais reais que só existem no servidor de deploy).

### 1. Obter o token (POST {OCORRENCIAS_API_BASE_URL}{OCORRENCIAS_API_LOGIN_PATH})

**Request**
- **Método**: `POST`
- **URL**: `{OCORRENCIAS_API_BASE_URL}/login` (caminho configurável via `OCORRENCIAS_API_LOGIN_PATH`)
- **Headers**: `Content-Type: application/json`
- **Request body**:
```json
{
  "userName": "<seu_usuario>",
  "password": "<sua_senha>"
}
```

**Response (exemplo)**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "expirationTime": "2026-03-09T12:55:50Z"
}
```

O `accessToken` deve ser usado no próximo passo. O `expirationTime` indica até quando o token é válido.

### 2. Buscar ocorrências (GET StatusDaOcorrência — v2 / CoRIO)

**Request**
- **Método**: `GET`
- **URL (v2 — ET - OcorrênciasAPI_V2)**:
  `{OCORRENCIAS_API_BASE_URL}/Hxgn.OcorrenciaAPI/api/Ocorrencia/StatusDaOcorrência/{dataInicio}/{dataFim}`
- **URL (legado)**: `{OCORRENCIAS_API_BASE_URL}/Ocorrencias/StatusDasOcorrencias/{dataInicio}/{dataFim}`
- A function tenta **v2 → legado** automaticamente (404/405 = tenta o próximo); é possível forçar
  outro caminho com `OCORRENCIAS_API_ENDPOINT_SUFFIX`.
- **Headers**: `Authorization: Bearer {accessToken}` (token obtido no passo 1)
- **Parâmetros de path** (obrigatórios):
  - `dataInicio`: data inicial no formato **DD-MM-YYYY** (ex: `09-02-2026`)
  - `dataFim`: data final no formato **DD-MM-YYYY** (ex: `10-02-2026`)
- **Query** (opcionais):
  - `page`: número da página (ex: `1`)
  - `pageSize`: itens por página (ex: `50`)

**Response body (estrutura)**
```json
{
  "dataInicio": "09-02-2026",
  "dataFim": "10-02-2026",
  "page": 1,
  "pageSize": 50,
  "data": [
    {
      "ID": "COR2606491",
      "Data_Abertura": "2026-02-10T20:47:19+00:00",
      "Data_Fechamento": "2026-02-10T21:31:58+00:00",
      "POP_Nome": "ACIDENTE COM VITIMA",
      "POP_Numero": "POP02",
      "Titulo": "AC VP X MT",
      "Endereco": "Avenida Ministro Ivan Lins, Barra da Tijuca, Rio de Janeiro - RJ, 22620-110, Brasil",
      "Bairro": "BARRA DA TIJUCA",
      "AgenciasInformadas": "CBMERJ",
      "AgenciasAcionadas": "",
      "AgenciasPresentes": "",
      "AgenciasEmAndamento": "CET",
      "AgenciasFinalizadas": "",
      "Categoria": "Baixa",
      "Duracao_Minutos": 44,
      "Andamento_Ocorrencia": "Encerrada"
    }
  ]
}
```

Campos principais de cada item em `data`: `ID`, `Data_Abertura`, `Data_Fechamento`, `POP_Nome`, `POP_Numero`, `Titulo`, `Endereco`, `Bairro`, `AgenciasInformadas`, `AgenciasAcionadas`, `AgenciasPresentes`, `AgenciasEmAndamento`, `AgenciasFinalizadas`, `Categoria`, `Duracao_Minutos`, `Andamento_Ocorrencia`.

A API Hexagon não retorna Latitude/Longitude; o app converte o campo **Endereco** em coordenadas (geocoding via Nominatim) para exibir os pontos no mapa no modo histórico. Esse geocoding está ativo por padrão; para desativar, use `VITE_GEOCODE_OCORRENCIAS=false` no `.env`.

### Nível de criticidade (API Simaa / CoR)

Na API de ocorrências abertas (Simaa) o campo **Priority** é numérico. Use a escala abaixo para identificar corretamente o nível na integração:

| Valor | Nível   |
|-------|--------|
| **1** | Muito alta |
| **2** | Alta      |
| **3** | Média     |
| **4** | Baixa     |

No código, a constante está em `src/utils/criticidade.ts` (`CRITICIDADE_NIVEL`, `getCriticidadeLabel`).

## Arquivos Criados

### 1. Serviço de API (`src/services/ocorrenciasApi.ts`)

Serviço principal que implementa a comunicação com a API.

**Funções Disponíveis:**

Login e token não existem mais no cliente — ver "Fluxo de Uso" acima. O serviço só monta a URL da
Netlify Function (`/api/ocorrencias-hexagon`) e faz `fetch`, sem `Authorization` header nem lógica
de autenticação (isso tudo migrou pra `netlify/functions/ocorrencias-hexagon.js`).

#### `fetchOcorrenciasByDate(dataInicio, dataFim, page?, pageSize?): Promise<OcorrenciaStatus[]>`
Busca ocorrências de um período específico com paginação.

**Parâmetros:**
- `dataInicio` (string | Date): Data inicial (formato: YYYY-MM-DD ou Date)
- `dataFim` (string | Date): Data final (formato: YYYY-MM-DD ou Date)
- `page` (number, padrão: 1): Número da página
- `pageSize` (number, padrão: 50): Quantidade de itens por página

**Exemplo:**
```typescript
const ocorrencias = await fetchOcorrenciasByDate(
  '2026-01-01',
  '2026-01-31',
  1,
  50
);
console.log(`Encontrados ${ocorrencias.length} ocorrências`);
```

#### `fetchAllOcorrenciasByDate(dataInicio, dataFim, pageSize?): Promise<OcorrenciaStatus[]>`
Busca **todas** as ocorrências de um período, fazendo paginação automática.

**Parâmetros:**
- `dataInicio` (string | Date): Data inicial
- `dataFim` (string | Date): Data final
- `pageSize` (number, padrão: 50): Quantidade de itens por página

**Exemplo:**
```typescript
// Retorna TODOS os resultados, não apenas a primeira página
const todasOcorrencias = await fetchAllOcorrenciasByDate(
  '2026-01-01',
  '2026-01-31'
);
console.log(`Total: ${todasOcorrencias.length} ocorrências`);
```

### 2. Hook React (`src/hooks/useOcorrenciasData.ts`)

Hook para usar a API em componentes React.

**Uso em Componente:**

```typescript
import { useOcorrenciasData } from '../hooks/useOcorrenciasData';

export function MeuComponente() {
  const { 
    ocorrencias,      // Array de ocorrências
    loading,          // Boolean indicando se está carregando
    error,            // String com mensagem de erro ou null
    fetchOcorrencias, // Função para buscar com paginação
    fetchAllOcorrencias // Função para buscar todas as páginas
  } = useOcorrenciasData();

  const handleBuscar = async () => {
    await fetchOcorrencias('2026-01-01', '2026-01-31');
  };

  const handleBuscarTodos = async () => {
    await fetchAllOcorrencias('2026-01-01', '2026-01-31');
  };

  return (
    <div>
      <button onClick={handleBuscar}>Buscar Página 1</button>
      <button onClick={handleBuscarTodos}>Buscar Todos</button>
      
      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: 'red' }}>Erro: {error}</p>}
      
      <ul>
        {ocorrencias.map(oc => (
          <li key={oc.id}>
            {oc.titulo} - {oc.localizacao}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Tipo de Dados

### Resposta do GET StatusDasOcorrencias

A API retorna um objeto com: `dataInicio`, `dataFim`, `page`, `pageSize` e um array `data` de ocorrências.

### Campos de cada item em `data` (como a API retorna)

| Campo | Tipo | Exemplo |
|-------|------|---------|
| `ID` | string | `"COR2606491"` |
| `Data_Abertura` | string (ISO 8601) | `"2026-02-10T20:47:19+00:00"` |
| `Data_Fechamento` | string (ISO 8601) | `"2026-02-10T21:31:58+00:00"` |
| `POP_Nome` | string | `"ACIDENTE COM VITIMA"` |
| `POP_Numero` | string | `"POP02"` |
| `Titulo` | string | `"AC VP X MT"` |
| `Endereco` | string | Endereço completo |
| `Bairro` | string | `"BARRA DA TIJUCA"` |
| `AgenciasInformadas` | string \| null | `"CBMERJ"` ou `""` |
| `AgenciasAcionadas` | string \| null | |
| `AgenciasPresentes` | string \| null | |
| `AgenciasEmAndamento` | string \| null | |
| `AgenciasFinalizadas` | string \| null | |
| `Categoria` | string | `"Baixa"`, `"Média"` |
| `Duracao_Minutos` | number | `44` |
| `Andamento_Ocorrencia` | string | `"Encerrada"` |

### `OcorrenciaStatus` (uso no código)

O serviço retorna os objetos tal qual a API; no TypeScript você pode usar os nomes da API ou o alias:

```typescript
interface OcorrenciaStatus {
  id: string;           // corresponde a ID
  titulo?: string;      // corresponde a Titulo
  dataAbertura?: string; // corresponde a Data_Abertura
  dataEncerramento?: string; // corresponde a Data_Fechamento
  localizacao?: string; // corresponde a Endereco
  bairro?: string;
  status?: string;      // corresponde a Andamento_Ocorrencia
  criticidade?: string; // corresponde a Categoria
  [key: string]: any;   // todos os campos da API (ID, POP_Nome, etc.)
}
```

## Exemplos de Uso

### Exemplo 1: Buscar ocorrências de um dia

```typescript
import { fetchOcorrenciasByDate } from './src/services/ocorrenciasApi';

async function buscarOcorrenciasHoje() {
  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const ocorrencias = await fetchOcorrenciasByDate(hoje, hoje);
  return ocorrencias;
}
```

### Exemplo 2: Buscar com tratamento de erro

```typescript
async function buscarComErro() {
  try {
    const ocorrencias = await fetchOcorrenciasByDate(
      '2026-01-01',
      '2026-01-31'
    );
    console.log(`Total: ${ocorrencias.length}`);
  } catch (error) {
    console.error('Erro ao buscar:', error);
  }
}
```

### Exemplo 3: Usar em componente com carregamento

```typescript
import { useOcorrenciasData } from '../hooks/useOcorrenciasData';
import { useState } from 'react';

export function OcorrenciasWidget() {
  const [dataInicio, setDataInicio] = useState('2026-01-01');
  const [dataFim, setDataFim] = useState('2026-01-31');
  
  const { ocorrencias, loading, error, fetchAllOcorrencias } = 
    useOcorrenciasData();

  return (
    <div>
      <input 
        type="date" 
        value={dataInicio}
        onChange={e => setDataInicio(e.target.value)}
      />
      <input 
        type="date"
        value={dataFim}
        onChange={e => setDataFim(e.target.value)}
      />
      
      <button onClick={() => fetchAllOcorrencias(dataInicio, dataFim)}>
        Buscar
      </button>
      
      {loading && <div>⏳ Carregando...</div>}
      {error && <div style={{color: 'red'}}>❌ {error}</div>}
      
      <div>
        {ocorrencias.map(oc => (
          <div key={oc.id} style={{border: '1px solid #ccc', padding: '10px'}}>
            <strong>{oc.titulo}</strong>
            <p>{oc.descricao}</p>
            <p>📍 {oc.localizacao} - {oc.bairro}</p>
            <p>⚠️ Criticidade: {oc.criticidade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Autenticação e Token

Tudo isso acontece dentro de `netlify/functions/ocorrencias-hexagon.js`, no servidor — o cliente
não vê token, usuário nem senha:

1. **Primeiro acesso**: a function faz login e obtém token
2. **Cache**: token guardado em memória (melhor esforço — containers "quentes" reaproveitam; um
   cold start simplesmente refaz login)
3. **Requisições subsequentes**: usa o token em cache quando disponível
4. **401 inesperado**: a function refaz login uma vez e tenta de novo antes de desistir

## Formato de Datas

- **Entrada**: Suporta dois formatos
  - String YYYY-MM-DD: `'2026-01-01'`
  - Objeto Date: `new Date(2026, 0, 1)`

- **Envio para API**: Automaticamente convertido para DD-MM-YYYY
  - Exemplo: `01-01-2026`

## Tratamento de Paginação

### Com paginação manual

```typescript
// Página 1
const pagina1 = await fetchOcorrenciasByDate('2026-01-01', '2026-01-01', 1, 50);

// Página 2
const pagina2 = await fetchOcorrenciasByDate('2026-01-01', '2026-01-01', 2, 50);
```

### Paginação automática (buscar tudo)

```typescript
// Busca todas as páginas automaticamente
const todasOcorrencias = await fetchAllOcorrenciasByDate(
  '2026-01-01',
  '2026-01-31',
  50 // pageSize
);
```

## Possíveis Campos de Resposta

Dependendo da versão da API, os seguintes campos podem estar disponíveis:

- `id`: ID único da ocorrência
- `numero`: Número da ocorrência
- `titulo`: Título/resumo
- `descricao`: Descrição detalhada
- `dataAbertura`: Data de início
- `dataEncerramento`: Data de fim
- `localizacao`: Localização/endereço
- `bairro`: Bairro
- `latitude`: Coordenada latitude
- `longitude`: Coordenada longitude
- `status`: Status da ocorrência
- `criticidade`: Nível de criticidade
- Outros campos conforme retornado pela API

## Testes

Consulte o arquivo [OCORRENCIAS_API_EXAMPLES.ts](./OCORRENCIAS_API_EXAMPLES.ts) para exemplos de teste.

## Documentação da API

O Swagger/UI da API Hexagon é interno (mesmo IP confidencial do `OCORRENCIAS_API_BASE_URL`) — não
repetido aqui de propósito. Peça o link a quem forneceu as credenciais, se precisar consultar os
endpoints diretamente.

## Troubleshooting

### API Hexagon (histórico) "não está indo"
- A Hexagon é usada **só no modo histórico** quando a fonte "API" está selecionada.
- Em **tempo real** o app usa sempre a **Simaa** (https://apisimaa.computei.srv.br/ocorrencias); não é preciso configurar nada.
- Para o histórico com Hexagon: confira no Netlify (Site settings → Environment variables) se `OCORRENCIAS_API_BASE_URL`, `OCORRENCIAS_API_USERNAME` e `OCORRENCIAS_API_PASSWORD` estão definidas — **sem** prefixo `VITE_`. Redeploy após alterar.
- Em desenvolvimento local, `vite.config.ts` faz proxy de `/api/ocorrencias-hexagon` para a function já publicada (`VITE_HISTORICAL_RAIN_PROXY`, padrão `chovendo-agora.netlify.app`) — não precisa rodar `netlify dev` nem ter as credenciais localmente.

### "Token não retornado pela API" / erro 401
- Verificar as três variáveis no Netlify (não `VITE_*`) e fazer redeploy.
- Ver os logs da function `ocorrencias-hexagon` no painel do Netlify (Functions → ocorrencias-hexagon → Logs) — os erros de login/fetch aparecem lá, não mais no console do navegador.

### "Erro ao buscar ocorrências" (histórico)
- Verificar se as datas estão no formato correto (a function espera `inicio`/`fim` em DD-MM-YYYY)
- Conferir se o período tem dados disponíveis

### CORS Error
- Não deveria mais acontecer: o cliente só chama `/api/ocorrencias-hexagon` (mesma origem); a function é quem fala com a Hexagon, do servidor.

## Integração Futura

Estes arquivos podem ser integrados a:
- [Componentes existentes](src/components/)
- [Tabelas de dados](src/components/OccurrenceTable.tsx)
- [Mapas/visualizações](src/components/RioMap.tsx)
