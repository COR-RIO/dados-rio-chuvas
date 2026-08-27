import type { WindStation } from '../types/wind';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Dados meteorológicos em tempo real do SEMPRE Rio (Prefeitura do Rio).
 * Em produção roteia para a Netlify Function websempre-weather (adiciona CORS); em dev o Vite
 * proxya direto para o host (ver vite.config.ts).
 */
const WEBSEMPRE_URL = '/api/websempre-weather';

interface WebsempreFeature {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: {
    data?: { wind?: string };
    station?: { id?: number; name?: string };
    read_at?: string;
  };
}

interface WebsempreResponse {
  type?: string;
  features?: WebsempreFeature[];
  success?: boolean;
  error?: string;
}

/** Estações do SEMPRE Rio que reportam vento (id da API -> config). A localização vem da
 * geometria do próprio GeoJSON (convertida de [lng, lat] para [lat, lng] — ordem do Leaflet). */
const WEBSEMPRE_STATIONS: Record<number, { name: string; corridor: 'interno' }> = {
  1: { name: 'Vidigal', corridor: 'interno' },
  20: { name: 'Guaratiba', corridor: 'interno' },
  32: { name: 'São Cristóvão', corridor: 'interno' },
};

const CARDINAL_DEG: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/** Converte ponto cardeal (ex.: "SW" ou "N/NW") para graus (0-360). */
function windCardinalToDeg(cardinal: string): number | null {
  const c = (cardinal || '').trim().toUpperCase();
  if (!c) return null;
  if (CARDINAL_DEG[c] != null) return CARDINAL_DEG[c];
  const parts = c
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = CARDINAL_DEG[parts[0]];
    const b = CARDINAL_DEG[parts[1]];
    if (a != null && b != null) {
      // Média circular simples entre dois pontos cardeais (ex.: N/NW -> 337,5°).
      let diff = (((b - a + 360) % 360) + 360) % 360;
      if (diff > 180) diff -= 360;
      return (((a + diff / 2) % 360) + 360) % 360;
    }
  }
  return null;
}

/**
 * Parseia o campo de vento "14,4 (N/NW)" -> velocidade (m/s) + direção (graus).
 * O websempre entrega a velocidade em KM/H (o site oficial rotula a coluna
 * "Vel. do Vento (Km/h)") — então converte-se km/h -> m/s (/3.6) para o WindStation.
 */
function parseWind(raw: string): { speedMs: number; dirDeg: number | null } | null {
  const s = String(raw ?? '').trim();
  if (!s || s === '-' || s === '—') return null;
  const m = /([\d.,]+)\s*\(([^)]+)\)/.exec(s);
  if (!m) return null;
  const speedKmh = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(speedKmh)) return null;
  const speedMs = speedKmh / 3.6;
  return { speedMs, dirDeg: windCardinalToDeg(m[2]) };
}

/** Vento em tempo real nas estações do SEMPRE Rio (Vidigal, Guaratiba, São Cristóvão). */
export async function fetchWebsempreWind(): Promise<WindStation[]> {
  try {
    const response = await fetchWithTimeout(WEBSEMPRE_URL, { headers: { Accept: 'application/json' } });
    const json: WebsempreResponse | null = await response.json().catch(() => null);
    if (!json || json.success === false || !Array.isArray(json.features)) {
      if (json?.error) console.warn('SEMPRE Rio indisponível:', json.error);
      return [];
    }

    const out: WindStation[] = [];
    for (const feature of json.features) {
      const station = feature.properties?.station;
      if (!station || station.id == null) continue;
      const cfg = WEBSEMPRE_STATIONS[station.id];
      if (!cfg) continue;

      const wind = parseWind(feature.properties?.data?.wind ?? '');
      if (!wind) continue;

      // GeoJSON entrega [lng, lat] — inverte para [lat, lng] (ordem do Leaflet).
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const location: [number, number] = [coords[1], coords[0]];

      const observedAt = feature.properties?.read_at ?? new Date().toISOString();
      out.push({
        id: `sempre-${station.id}`,
        name: cfg.name,
        source: 'sempre',
        code: String(station.id),
        corridor: cfg.corridor,
        location,
        observedAt,
        windSpeedMs: wind.speedMs,
        windGustMs: null,
        windDirectionDeg: wind.dirDeg,
        raw: feature.properties?.data?.wind ?? undefined,
      });
    }
    return out;
  } catch (err) {
    console.warn('Erro ao buscar vento SEMPRE Rio:', err);
    return [];
  }
}
