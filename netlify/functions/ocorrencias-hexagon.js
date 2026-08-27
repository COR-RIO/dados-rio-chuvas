/**
 * Netlify Function: proxy da API Hexagon de ocorrências (histórico). Login e busca acontecem
 * aqui, no servidor — IP/usuário/senha nunca chegam ao bundle do cliente. Antes disso, essas
 * credenciais viviam em variáveis VITE_OCORRENCIAS_API_* (client-side por definição do Vite:
 * tudo prefixado VITE_ é embutido no JS público), então ficavam visíveis a qualquer visitante via
 * DevTools. Esta function corrige isso, no mesmo padrão já usado por redemet-wind.js.
 *
 * Variáveis de ambiente (SEM prefixo VITE_ — só existem no servidor/Netlify, nunca no bundle):
 * - OCORRENCIAS_API_BASE_URL (ex.: http://IP:PORTA — raiz do servidor; a função monta o resto)
 * - OCORRENCIAS_API_USERNAME
 * - OCORRENCIAS_API_PASSWORD
 * - OCORRENCIAS_API_ENDPOINT_SUFFIX (opcional): força o caminho do endpoint após o baseUrl.
 *   Padrão: v2 (ET - OcorrênciasAPI_V2) "Hxgn.OcorrenciaAPI/api/Ocorrencia/StatusDaOcorrência";
 *   fallback automático para o legado "Ocorrencias/StatusDasOcorrencias" se der 404/405.
 * - OCORRENCIAS_API_LOGIN_PATH (opcional, padrão "/login"): caminho do login/token.
 *
 * Query params:
 * - inicio, fim: datas no formato DD-MM-YYYY (mesmo formato exigido pela API Hexagon)
 * - page, pageSize: paginação (opcionais; padrão 1 / 50)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;

// Caminhos do endpoint de status (sem as barras finais):
// 1) v2 (ET - OcorrênciasAPI_V2 / CoRIO): Hxgn.OcorrenciaAPI/api/Ocorrencia/StatusDaOcorrência
// 2) Legado (documentação antiga do repositório): Ocorrencias/StatusDasOcorrencias
const ENDPOINT_SUFFIX_V2 = 'Hxgn.OcorrenciaAPI/api/Ocorrencia/StatusDaOcorrência';
const ENDPOINT_SUFFIX_LEGACY = 'Ocorrencias/StatusDasOcorrencias';

// Token em memória: melhor esforço só (containers "quentes" reaproveitam entre invocações;
// cold start refaz login normalmente — não é um cache garantido, só evita logins redundantes).
let cachedToken = null; // { token, expiresAt }

async function login(baseUrl, username, password, loginPath = '/login') {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const loginUrl = `${baseUrl.replace(/\/+$/, '')}/${loginPath.replace(/^\/+/, '')}`;
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: username, password }),
  });

  if (!response.ok) {
    throw new Error(`Login na API Hexagon retornou ${response.status}`);
  }

  const data = await response.json();
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('Token não retornado pela API Hexagon');

  const expiresAt = data.expirationTime
    ? new Date(data.expirationTime).getTime() - 60 * 1000 // 1 min de folga
    : Date.now() + 50 * 60 * 1000;
  cachedToken = { token, expiresAt };
  return token;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const baseUrl = process.env.OCORRENCIAS_API_BASE_URL;
  const username = process.env.OCORRENCIAS_API_USERNAME;
  const password = process.env.OCORRENCIAS_API_PASSWORD;

  if (!baseUrl || !username || !password) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        error: 'API de ocorrências (Hexagon) não configurada no servidor — defina OCORRENCIAS_API_BASE_URL, OCORRENCIAS_API_USERNAME e OCORRENCIAS_API_PASSWORD (sem prefixo VITE_) nas variáveis de ambiente do Netlify.',
      }),
    };
  }

  const params = event.queryStringParameters || {};
  const { inicio, fim } = params;
  const page = params.page || '1';
  const pageSize = params.pageSize || '50';

  if (!inicio || !fim || !DATE_RE.test(inicio) || !DATE_RE.test(fim)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Parâmetros inicio e fim são obrigatórios, formato DD-MM-YYYY' }),
    };
  }

  const loginPath = process.env.OCORRENCIAS_API_LOGIN_PATH || '/login';

  // Ordem de tentativa: override por env (se houver) → v2 → legado.
  const endpointSuffixes = [
    process.env.OCORRENCIAS_API_ENDPOINT_SUFFIX?.trim(),
    ENDPOINT_SUFFIX_V2,
    ENDPOINT_SUFFIX_LEGACY,
  ].filter(Boolean);

  const buildUrl = (suffix) => {
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${suffix}/${inicio}/${fim}`);
    url.searchParams.set('page', page);
    url.searchParams.set('pageSize', pageSize);
    return url.toString();
  };

  const fetchStatus = (token, suffix) =>
    fetch(buildUrl(suffix), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

  /** Tenta os caminhos em ordem até achar um que responda (404/405 = caminho errado). */
  const tryFetch = async (token) => {
    let res = null;
    for (const suffix of endpointSuffixes) {
      res = await fetchStatus(token, suffix);
      if (res.status !== 404 && res.status !== 405) break;
    }
    return res;
  };

  try {
    let token = await login(baseUrl, username, password, loginPath);
    let response = await tryFetch(token);

    if (response && response.status === 401) {
      // Token pode ter expirado sem o cache saber (relógio dessincronizado, etc.) — força um
      // novo login e tenta mais uma vez antes de desistir.
      cachedToken = null;
      token = await login(baseUrl, username, password, loginPath);
      response = await tryFetch(token);
    }

    const data = await response.json().catch(() => null);
    return {
      statusCode: response.status,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify(data ?? { error: `API Hexagon retornou ${response.status}` }),
    };
  } catch (err) {
    console.error('ocorrencias-hexagon error:', err.message);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: err.message || 'Erro ao consultar API de ocorrências' }),
    };
  }
};
