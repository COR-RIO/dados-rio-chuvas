import type { WindStation } from '../types/wind';
import { WIND_BELT_AIRPORTS } from '../config/windBelt';

const REDEMET_WIND_URL = '/api/redemet-wind';

interface RedemetWindRecord {
  icao: string;
  observedAt: string;
  windSpeedMs: number;
  windGustMs: number | null;
  windDirectionDeg: number | null;
  raw?: string;
}

interface RedemetWindResponse {
  success: boolean;
  data?: RedemetWindRecord[];
  error?: string;
}

/** Vento (METAR) nos aeroportos do cinturão, via Netlify Function (esconde a API key). */
export async function fetchRedemetWind(): Promise<WindStation[]> {
  const icaoList = WIND_BELT_AIRPORTS.map((a) => a.icao).join(',');
  const url = `${REDEMET_WIND_URL}?icao=${encodeURIComponent(icaoList)}`;

  let json: RedemetWindResponse;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    json = await response.json();
  } catch (err) {
    console.warn('Erro ao buscar vento REDEMET:', err);
    return [];
  }

  if (!json.success || !json.data) {
    if (json.error) console.warn('REDEMET indisponível:', json.error);
    return [];
  }

  const byIcao = new Map(WIND_BELT_AIRPORTS.map((a) => [a.icao, a]));

  return json.data
    .map((record): WindStation | null => {
      const airport = byIcao.get(record.icao);
      if (!airport) return null;
      return {
        id: `redemet-${record.icao}`,
        name: airport.label,
        source: 'redemet',
        code: record.icao,
        corridor: airport.corridor,
        location: airport.location,
        observedAt: record.observedAt,
        windSpeedMs: record.windSpeedMs,
        windGustMs: record.windGustMs,
        windDirectionDeg: record.windDirectionDeg,
        raw: record.raw,
      };
    })
    .filter((s): s is WindStation => s != null);
}
