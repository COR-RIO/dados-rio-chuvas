/**
 * Netlify Function: proxy da API de chuva em tempo real da Prefeitura do Rio
 * (websempre.rio.rj.gov.br/json/chuvas), com cache curto na borda (Netlify Edge/CDN).
 *
 * Por que isso existe: o endpoint anterior (/api/json/chuvas → redirect direto, sem cache)
 * mandava TODO carregamento de página — de todo usuário — esperar a resposta do servidor da
 * Prefeitura do zero, que às vezes leva 20-30s+. Um cache curto (poucos segundos) na borda
 * resolve isso: só o primeiro pedido depois do cache expirar paga essa espera; os demais
 * (inclusive o auto-refresh do app a cada poucos minutos) recebem resposta quase instantânea.
 * A janela é curta o bastante pra continuar "tempo real" pros stakeholders (jornalismo,
 * prefeito, operação) sem cada carregamento martelar o servidor da Prefeitura do zero.
 *
 * Devolve o JSON no MESMO formato bruto do upstream ({ objects: [...] }), sem transformar
 * campos — o cliente (src/services/rainApi.ts) já sabe interpretar esse formato.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

// Estações reportam a cada 5-15 min; 20s de cache é imperceptível pra quem olha o mapa, mas
// evita martelar o servidor da Prefeitura a cada carregamento/refresh simultâneo.
const CACHE_CONTROL_SUCCESS = 'public, max-age=20, s-maxage=20, stale-while-revalidate=40';
const CACHE_CONTROL_ERROR = 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0';

const RIO_RAIN_API_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_ERROR },
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  try {
    const response = await fetch(RIO_RAIN_API_URL, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_ERROR },
        body: JSON.stringify({ objects: [], error: `API da Prefeitura retornou ${response.status}` }),
      };
    }

    const json = await response.json();

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_SUCCESS },
      body: JSON.stringify(json),
    };
  } catch (err) {
    console.error('rain-realtime error:', err.message);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_ERROR },
      body: JSON.stringify({ objects: [], error: err.message || 'Erro ao consultar chuva em tempo real' }),
    };
  }
};
