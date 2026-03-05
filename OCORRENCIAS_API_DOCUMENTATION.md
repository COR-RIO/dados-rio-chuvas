# Integração API de Ocorrências - Hexagon

## Visão Geral

Integração com a API de Ocorrências da Hexagon para coletar dados de ocorrências de incidentes no Rio de Janeiro.

- **URL Base**: http://35.199.126.236:8085/api
- **Documentação**: http://35.199.126.236:8085/api/swagger/index.html
- **Credenciais**: 
  - Username: `RestAPI`
  - Password: `@Hexagon2024`

## Arquivos Criados

### 1. Serviço de API (`src/services/ocorrenciasApi.ts`)

Serviço principal que implementa a comunicação com a API.

**Funções Disponíveis:**

#### `loginOcorrenciasAPI(): Promise<string | null>`
Faz login na API e obtém um token de autenticação.
- Retorna o token ou `null` em caso de erro
- Implementa cache automático de token (válido por 50 minutos)

```typescript
const token = await loginOcorrenciasAPI();
if (!token) {
  console.error('Falha na autenticação');
}
```

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

#### `clearTokenCache(): void`
Limpa o token em cache, forçando um novo login na próxima requisição.

```typescript
clearTokenCache();
// Próxima chamada fará login novamente
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

### `OcorrenciaStatus`

```typescript
interface OcorrenciaStatus {
  id: string;
  numero?: string;
  titulo?: string;
  descricao?: string;
  dataAbertura?: string;
  dataEncerramento?: string;
  localizacao?: string;
  bairro?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  criticidade?: string;
  [key: string]: any; // Outros campos retornados pela API
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

A autenticação é feita automaticamente:

1. **Primeiro acesso**: Faz login e obtém token
2. **Cache**: Token é armazenado por 50 minutos
3. **Requisições subsequentes**: Usa token em cache, sem fazer novo login
4. **Expiração**: Após 50 minutos, faz novo login automaticamente

### Forçar novo login

```typescript
import { clearTokenCache, fetchOcorrenciasByDate } from './src/services/ocorrenciasApi';

// Limpar cache forçar novo login
clearTokenCache();
await fetchOcorrenciasByDate('2026-01-01', '2026-01-01');
```

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

Para mais detalhes sobre os endpoints disponíveis e estrutura de resposta:
- Acesse: http://35.199.126.236:8085/api/swagger/index.html

## Troubleshooting

### "Token não retornado pela API"
- Verificar credenciais (username: RestAPI, password: @Hexagon2024)
- Conferir se a API está acessível
- Verificar console do navegador para mensagens de erro

### "Erro ao buscar ocorrências"
- Verificar se as datas estão no formato correto
- Conferir se o período tem dados disponíveis
- Tentar limpar o cache: `clearTokenCache()`

### CORS Error
- Para uso local em desenvolvimento, pode ser necessário ativar CORS no servidor
- A API em produção deve ter CORS configurado

## Integração Futura

Estes arquivos podem ser integrados a:
- [Componentes existentes](src/components/)
- [Tabelas de dados](src/components/OccurrenceTable.tsx)
- [Mapas/visualizações](src/components/RioMap.tsx)
