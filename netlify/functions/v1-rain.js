/**
 * API pública v1 — chuva em tempo real (estações pluviométricas da Prefeitura do Rio).
 * Endpoint estável destinado a consumo por outros projetos (fora deste app).
 *
 * GET /api/v1/rain
 *
 * Para dados históricos, ver /api/v1/rain/historical (mesma function de netlify/functions/historical-rain.js).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const RIO_RAIN_API_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';

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
    const response = await fetch(`${RIO_RAIN_API_URL}?_ts=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, ...NO_STORE_HEADERS },
        body: JSON.stringify({ success: false, error: `API da Prefeitura retornou ${response.status}` }),
      };
    }

    const json = await response.json();
    const objects = Array.isArray(json?.objects) ? json.objects : [];

    const stations = objects
      .filter((station) => station.kind === 'pluviometric')
      .map((station, index) => ({
        id: `rio-${String(station.name).toLowerCase().replace(/\s+/g, '-')}-${index}`,
        name: station.name,
        location: station.location,
        readAt: station.read_at,
        isNew: Boolean(station.is_new),
        data: {
          mm05min: station.data?.m05 || 0,
          mm15min: station.data?.m15 || 0,
          mm1h: station.data?.h01 || 0,
          mm2h: station.data?.h02 || 0,
          mm3h: station.data?.h03 || 0,
          mm4h: station.data?.h04 || 0,
          mm24h: station.data?.h24 || 0,
          mm96h: station.data?.h96 || 0,
          mmMes: station.data?.mes || 0,
        },
      }));

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, ...NO_STORE_HEADERS },
      body: JSON.stringify({
        success: true,
        fetchedAt: new Date().toISOString(),
        source: 'Prefeitura do Rio de Janeiro (websempre)',
        count: stations.length,
        data: stations,
      }),
    };
  } catch (err) {
    console.error('v1-rain error:', err.message);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, ...NO_STORE_HEADERS },
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar chuva em tempo real' }),
    };
  }
};
