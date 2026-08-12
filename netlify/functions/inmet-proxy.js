/**
 * Proxy para a API pública do INMET (apitempo.inmet.gov.br), usado pelo mapa (src/services/
 * inmetWindApi.ts, via /api/inmet/*).
 *
 * Existia antes como redirect direto do Netlify pro host externo (`to = "https://apitempo.inmet
 * .gov.br/:splat"`), mas isso passou a devolver 500 no edge (confirmado: a API do INMET responde
 * normalmente quando chamada direto, e uma Netlify Function conseguia alcançá-la sem problema
 * dentro de v1-wind.js — só o proxy de edge estava falhando, provavelmente bloqueio da origem por
 * IP/assinatura do proxy de borda). Rota via Function em vez de redirect evita esse caminho.
 */

const INMET_BASE = 'https://apitempo.inmet.gov.br';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE_CONTROL = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  // event.path é o path original da requisição (/api/inmet/estacoes/T, preservado pelo redirect
  // com status 200 = rewrite), não o path interno da function.
  const marker = '/api/inmet/';
  const idx = event.path.indexOf(marker);
  const rest = idx >= 0 ? event.path.slice(idx + marker.length) : '';
  if (!rest) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Caminho INMET ausente' }) };
  }

  const qs = event.rawQuery ? `?${event.rawQuery}` : '';
  const url = `${INMET_BASE}/${rest}${qs}`;

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': upstream.ok ? CACHE_CONTROL : 'no-store',
      },
      body: text,
    };
  } catch (err) {
    console.error('inmet-proxy error:', err.message);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Erro ao consultar INMET' }),
    };
  }
};
