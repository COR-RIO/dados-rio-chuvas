/**
 * API pública v1 — frames de radar meteorológico (Mendanha/Sumaré, servidos pelo COR).
 * Endpoint estável destinado a consumo por outros projetos.
 *
 * GET /api/v1/radar                → { mendanha: {...}, sumare: {...} }
 * GET /api/v1/radar?radar=mendanha → apenas um radar
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const CACHE_CONTROL_SUCCESS = 'public, max-age=60, s-maxage=60, stale-while-revalidate=30';

const COR_RADAR_BASE_URL = 'https://dashboardradar.cor.rio';
const RADAR_IDS = ['mendanha', 'sumare'];

const COR_RADAR_BOUNDS = [
  [-24.07974181385155, -44.88549887560727],
  [-21.568618096884588, -42.16109533159336],
];

function parseMendanhaTimestamp(filename) {
  const focus = filename.match(/focus(\d{12})/);
  if (focus) {
    const [, s] = focus;
    return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}T${s.slice(6, 8)}:${s.slice(8, 10)}:${s.slice(10, 12)}.000Z`;
  }
  const match = filename.match(/MDN-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

function parseSumareTimestamp(index, total) {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
  const offsetMs = (total - 1 - index) * 5 * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString();
}

async function fetchRadar(radar) {
  const response = await fetch(`${COR_RADAR_BASE_URL}/api/frames/${radar}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Radar COR (${radar}) retornou ${response.status}`);
  const json = await response.json();
  const filenames = Array.isArray(json.frames) ? json.frames : [];
  const total = filenames.length;

  const frames = filenames.map((filename, index) => {
    const timestamp =
      radar === 'mendanha' ? parseMendanhaTimestamp(filename) : parseSumareTimestamp(index, total);
    return {
      timestamp: timestamp ?? new Date().toISOString(),
      imageUrl: `${COR_RADAR_BASE_URL}/api/frame/${radar}/${filename}`,
      filename,
    };
  });

  return {
    radar,
    frames,
    latestTimestamp: json.latest_timestamp ?? null,
    delayMinutes: json.delay_minutes ?? null,
  };
}

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

  const requested = (event.queryStringParameters || {}).radar;
  if (requested && !RADAR_IDS.includes(requested)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: `radar deve ser um de: ${RADAR_IDS.join(', ')}` }),
    };
  }

  const radarsToFetch = requested ? [requested] : RADAR_IDS;

  try {
    const results = await Promise.allSettled(radarsToFetch.map(fetchRadar));
    const data = {};
    results.forEach((r, i) => {
      data[radarsToFetch[i]] = r.status === 'fulfilled' ? r.value : null;
    });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_SUCCESS },
      body: JSON.stringify({
        success: true,
        fetchedAt: new Date().toISOString(),
        bounds: COR_RADAR_BOUNDS,
        data,
      }),
    };
  } catch (err) {
    console.error('v1-radar error:', err.message);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar radar' }),
    };
  }
};
