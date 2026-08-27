/**
 * Netlify Function: proxy dos dados meteorológicos em tempo real do SEMPRE Rio (Prefeitura).
 *
 * A API pública https://websempre.rio.rj.gov.br/json/dados_meteorologicos não envia headers CORS
 * (confirmado), então o browser não consegue chamá-la direto — esta function adiciona CORS e um
 * cache curto na borda (os dados atualizam em escala horária). Não exige chave/credenciais.
 *
 * Em dev, o Vite proxya direto para o host (ver vite.config.ts, "/api/websempre-weather").
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const CACHE_CONTROL = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

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

  try {
    const response = await fetch('https://websempre.rio.rj.gov.br/json/dados_meteorologicos', {
      headers: { Accept: 'application/json' },
    });
    const body = await response.text();
    return {
      statusCode: response.status,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL },
      body,
    };
  } catch (err) {
    console.error('websempre-weather error:', err.message);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar SEMPRE Rio' }),
    };
  }
};
