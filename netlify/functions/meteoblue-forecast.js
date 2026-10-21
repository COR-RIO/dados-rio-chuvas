/**
 * Netlify Function: previsão do meteoblue (o mesmo modelo que aparece no "Comparar previsões" do
 * Windy) para os pontos da aba Previsão.
 *
 * Diferente do ECMWF/GFS/ICON (Open-Meteo, chamado direto pelo browser), o meteoblue exige API key
 * — esta function esconde a chave e põe cache na borda, porque cada ponto consome créditos do
 * plano (1 chamada por ponto; com 8 pontos e cache de 1 h ≈ 200 chamadas/dia, independente de
 * quantas pessoas estão com o site aberto).
 *
 * Variáveis de ambiente:
 *   METEOBLUE_API_KEY  (obrigatória) chave em https://www.meteoblue.com/en/weather-api
 *   METEOBLUE_PACKAGE  (opcional) pacote da Forecast API; padrão "basic-1h_wind-1h"
 *                      (basic-1h = chuva/temperatura/vento; wind-1h = rajada). Se o plano não
 *                      incluir wind-1h, use "basic-1h" — a rajada fica em branco.
 *
 * GET ?lat=-22.9,-22.8&lon=-43.2,-43.4  ->  { points: [{ time, precipitation, temperature,
 *   windspeed, winddirection, gust }] }  (mesma ordem dos pontos pedidos; time em "YYYY-MM-DDTHH:mm",
 *   fuso de Brasília; vento/rajada em nós). Sem chave: { error } com status 200, para o app só
 * marcar o meteoblue como indisponível sem derrubar os outros modelos.
 *
 * Em dev, o Vite proxya para a function publicada (ver vite.config.ts, "/api/meteoblue-forecast").
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

// O meteoblue recalcula o multimodelo de hora em hora — 1 h de cache economiza créditos sem perder rodada.
const CACHE_CONTROL = 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=600';
const MAX_POINTS = 20;
const TIMEOUT_MS = 15000;

const reply = (statusCode, body, cacheControl = 'no-store') => ({
  statusCode,
  headers: { ...CORS_HEADERS, 'Cache-Control': cacheControl },
  body: JSON.stringify(body),
});

const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));

async function fetchPoint(pkg, apiKey, lat, lon) {
  const params = new URLSearchParams({
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    apikey: apiKey,
    format: 'json',
    tz: 'America/Sao_Paulo',
    windspeed: 'kn',
    forecast_days: '5',
  });
  const res = await fetch(`https://my.meteoblue.com/packages/${pkg}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error_message || `meteoblue respondeu ${res.status}`);
  }
  const d = body.data_1h || {};
  return {
    // "2026-10-21 15:00" -> "2026-10-21T15:00" (mesmo formato do Open-Meteo)
    time: (d.time || []).map((t) => String(t).replace(' ', 'T').slice(0, 16)),
    precipitation: d.precipitation || [],
    temperature: d.temperature || [],
    windspeed: d.windspeed || [],
    winddirection: d.winddirection || [],
    gust: d.gust || d.windgusts || [],
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return reply(405, { error: 'Método não permitido' });
  }

  const apiKey = process.env.METEOBLUE_API_KEY;
  if (!apiKey) {
    return reply(200, { error: 'METEOBLUE_API_KEY não configurada no Netlify' });
  }
  const pkg = process.env.METEOBLUE_PACKAGE || 'basic-1h_wind-1h';

  const lats = parseList(event.queryStringParameters?.lat);
  const lons = parseList(event.queryStringParameters?.lon);
  if (!lats.length || lats.length !== lons.length || lats.length > MAX_POINTS) {
    return reply(400, { error: `Informe lat/lon (mesma quantidade, até ${MAX_POINTS} pontos)` });
  }

  try {
    const points = await Promise.all(lats.map((lat, i) => fetchPoint(pkg, apiKey, lat, lons[i])));
    return reply(200, { points }, CACHE_CONTROL);
  } catch (err) {
    console.error('meteoblue-forecast error:', err.message);
    return reply(200, { error: err.message || 'Erro ao consultar meteoblue' });
  }
};
