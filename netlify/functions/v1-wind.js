/**
 * API pública v1 — vento no cinturão do Rio (estações INMET + METAR REDEMET), normalizado
 * e agrupado por corredor. Endpoint estável destinado a consumo por outros projetos.
 *
 * GET /api/v1/wind
 *
 * Variáveis de ambiente (mesmas já usadas pelo app cliente):
 * - REDEMET_API_KEY (obrigatória para dados dos aeroportos — cadastro em api-redemet.decea.mil.br)
 * - VITE_INMET_TOKEN ou INMET_TOKEN (obrigatória para observações das estações INMET)
 * Sem essas variáveis, a fonte correspondente é omitida silenciosamente (resposta ainda é 200).
 */

const redemetWind = require('./redemet-wind');
const { WIND_BELT_CITIES, WIND_BELT_AIRPORTS, CORRIDORS } = require('./lib/windBelt');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const CACHE_CONTROL_SUCCESS = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

const INMET_BASE = 'https://apitempo.inmet.gov.br';
const INMET_TOKEN = process.env.INMET_TOKEN || process.env.VITE_INMET_TOKEN;

const ACCENT_MAP = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c',
};

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('')
    .trim();
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function matchBeltStations(stations) {
  const matched = [];
  for (const city of WIND_BELT_CITIES) {
    const found = stations.find((s) => {
      const name = normalize(s.DC_NOME);
      const uf = normalize(s.SG_ESTADO ?? s.UF);
      const nameMatches = city.nameMatch.some((term) => name.includes(normalize(term)));
      const ufMatches = !city.uf || uf === normalize(city.uf);
      const lat = toFiniteNumber(s.VL_LATITUDE);
      const lng = toFiniteNumber(s.VL_LONGITUDE);
      return nameMatches && ufMatches && lat != null && lng != null;
    });
    if (found?.CD_ESTACAO) {
      matched.push({
        code: found.CD_ESTACAO,
        name: found.DC_NOME || city.label,
        location: [toFiniteNumber(found.VL_LATITUDE), toFiniteNumber(found.VL_LONGITUDE)],
        city,
      });
    }
  }
  return matched;
}

async function fetchLatestInmetObservation(code) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const url = `${INMET_BASE}/token/estacao/${dateOnly(yesterday)}/${dateOnly(today)}/${code}/${INMET_TOKEN}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INMET estacao ${code} retornou ${response.status}`);

  const text = await response.text();
  if (text === 'CHAVE INVÁLIDA!') throw new Error('INMET_TOKEN inválido');

  const records = JSON.parse(text);
  if (!Array.isArray(records) || records.length === 0) return null;

  const withWind = records.filter((r) => toFiniteNumber(r.VEN_VEL) != null);
  if (!withWind.length) return null;

  withWind.sort((a, b) => {
    const keyA = `${a.DT_MEDICAO ?? ''}${a.HR_MEDICAO ?? ''}`;
    const keyB = `${b.DT_MEDICAO ?? ''}${b.HR_MEDICAO ?? ''}`;
    return keyB.localeCompare(keyA);
  });
  return withWind[0];
}

function toObservedAtIso(obs) {
  const day = obs.DT_MEDICAO ?? dateOnly(new Date());
  const hr = String(obs.HR_MEDICAO ?? '0000').padStart(4, '0');
  return `${day}T${hr.slice(0, 2)}:${hr.slice(2, 4)}:00Z`;
}

async function fetchInmetStations() {
  if (!INMET_TOKEN) return [];

  const listResponse = await fetch(`${INMET_BASE}/estacoes/T`, { headers: { Accept: 'application/json' } });
  if (!listResponse.ok) throw new Error(`INMET estacoes/T retornou ${listResponse.status}`);
  const stationList = await listResponse.json();
  const matched = matchBeltStations(Array.isArray(stationList) ? stationList : []);

  const results = await Promise.allSettled(
    matched.map(async (m) => {
      const obs = await fetchLatestInmetObservation(m.code);
      const windSpeedMs = obs ? toFiniteNumber(obs.VEN_VEL) : null;
      if (!obs || windSpeedMs == null) return null;
      return {
        id: `inmet-${m.code}`,
        name: m.city.label,
        source: 'inmet',
        code: m.code,
        corridor: m.city.corridor,
        location: m.location,
        observedAt: toObservedAtIso(obs),
        windSpeedMs,
        windGustMs: toFiniteNumber(obs.VEN_RAJ),
        windDirectionDeg: toFiniteNumber(obs.VEN_DIR),
      };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v) => v != null);
}

async function fetchRedemetStations() {
  if (!process.env.REDEMET_API_KEY) return [];

  const icaoByCode = new Map(WIND_BELT_AIRPORTS.map((a) => [a.icao, a]));
  const icaoList = WIND_BELT_AIRPORTS.map((a) => a.icao).join(',');
  const response = await redemetWind.handler({
    httpMethod: 'GET',
    queryStringParameters: { icao: icaoList },
  });
  const parsed = JSON.parse(response.body);
  if (!parsed.success || !Array.isArray(parsed.data)) return [];

  return parsed.data
    .map((station) => {
      const airport = icaoByCode.get(station.icao);
      if (!airport) return null;
      return {
        id: `redemet-${station.icao}`,
        name: airport.label,
        source: 'redemet',
        code: station.icao,
        corridor: airport.corridor,
        location: airport.location,
        observedAt: station.observedAt,
        windSpeedMs: station.windSpeedMs,
        windGustMs: station.windGustMs,
        windDirectionDeg: station.windDirectionDeg,
      };
    })
    .filter((v) => v != null);
}

function msToKmh(ms) {
  return Number((ms * 3.6).toFixed(1));
}

function toApiWindStation(station) {
  const windSpeedKmh = station.windSpeedMs != null ? msToKmh(station.windSpeedMs) : null;
  const windGustKmh = station.windGustMs != null ? msToKmh(station.windGustMs) : null;

  return {
    ...station,
    windSpeedKmh,
    windGustKmh,
  };
}

function windLevelFromGustKmh(gustKmh) {
  const n = Number(gustKmh);
  const level = n !== n || n < 20 ? 0 : n < 40 ? 1 : n < 60 ? 2 : n < 80 ? 3 : 4;
  const labels = ['Calmo', 'Atenção', 'Forte', 'Muito forte', 'Severo'];
  return { level, label: labels[level] };
}

function buildCorridorSummary(stations) {
  const summary = {};
  for (const corridor of CORRIDORS) {
    const corridorStations = stations.filter((s) => s.corridor === corridor);
    if (!corridorStations.length) {
      summary[corridor] = {
        corridor,
        maxGustKmh: 0,
        dominantDirectionDeg: null,
        level: windLevelFromGustKmh(0),
        stationCount: 0,
      };
      continue;
    }

    const strongest = corridorStations.reduce((max, s) => {
      const gustMs = s.windGustMs ?? s.windSpeedMs;
      const maxGustMs = max.windGustMs ?? max.windSpeedMs;
      return gustMs > maxGustMs ? s : max;
    });

    const maxGustKmh = msToKmh(strongest.windGustMs ?? strongest.windSpeedMs);
    summary[corridor] = {
      corridor,
      maxGustKmh,
      dominantDirectionDeg: strongest.windDirectionDeg,
      level: windLevelFromGustKmh(maxGustKmh),
      stationCount: corridorStations.length,
    };
  }
  return summary;
}

exports.toApiWindStation = toApiWindStation;
exports.msToKmh = msToKmh;

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
    const [inmetStations, redemetStations] = await Promise.all([
      fetchInmetStations().catch((err) => {
        console.warn('v1-wind INMET error:', err.message);
        return [];
      }),
      fetchRedemetStations().catch((err) => {
        console.warn('v1-wind REDEMET error:', err.message);
        return [];
      }),
    ]);

    const stations = [...inmetStations, ...redemetStations];

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_SUCCESS },
      body: JSON.stringify({
        success: true,
        fetchedAt: new Date().toISOString(),
        sources: { inmet: Boolean(INMET_TOKEN), redemet: Boolean(process.env.REDEMET_API_KEY) },
        count: stations.length,
        data: stations.map(toApiWindStation),
        corridorSummary: buildCorridorSummary(stations),
      }),
    };
  } catch (err) {
    console.error('v1-wind error:', err.message);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar dados de vento' }),
    };
  }
};
