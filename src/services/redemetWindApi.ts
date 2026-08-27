import type { WindStation } from '../types/wind';
import { WIND_BELT_AIRPORTS } from '../config/windBelt';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const REDEMET_WIND_URL = '/api/redemet-wind';

interface RedemetWindRecord {
  icao: string;
  observedAt: string;
  windSpeedMs: number;
  windGustMs: number | null;
  windDirectionDeg: number | null;
  messageType?: 'METAR' | 'SPECI';
  raw?: string;
}

interface RedemetWindResponse {
  success: boolean;
  data?: RedemetWindRecord[];
  error?: string;
}

function mapRecordsToStations(records: RedemetWindRecord[]): WindStation[] {
  const byIcao = new Map(WIND_BELT_AIRPORTS.map((a) => [a.icao, a]));

  return records
    .map((record): WindStation | null => {
      const airport = byIcao.get(record.icao);
      if (!airport) return null;
      return {
        // Inclui observedAt no id: consultas históricas trazem várias leituras por estação
        // (uma por hora), então o icao sozinho não identifica um registro único.
        id: `redemet-${record.icao}-${record.observedAt}`,
        name: airport.label,
        source: 'redemet',
        code: record.icao,
        corridor: airport.corridor,
        location: airport.location,
        observedAt: record.observedAt,
        windSpeedMs: record.windSpeedMs,
        windGustMs: record.windGustMs,
        windDirectionDeg: record.windDirectionDeg,
        messageType: record.messageType,
        raw: record.raw,
      };
    })
    .filter((s): s is WindStation => s != null);
}

async function fetchRedemetWindRecords(extraQuery: string): Promise<WindStation[]> {
  const icaoList = WIND_BELT_AIRPORTS.map((a) => a.icao).join(',');
  const url = `${REDEMET_WIND_URL}?icao=${encodeURIComponent(icaoList)}${extraQuery}`;

  let json: RedemetWindResponse;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    json = await response.json();
  } catch (err) {
    console.warn('Erro ao buscar vento REDEMET:', err);
    return [];
  }

  if (!json.success || !json.data) {
    if (json.error) console.warn('REDEMET indisponível:', json.error);
    return [];
  }

  return mapRecordsToStations(json.data);
}

/** Mantém só a leitura mais recente por ICAO. A consulta "ao vivo" pode devolver mais de um
 * METAR/SPECI recente para a mesma estação (ex.: SPECI intercalado com o METAR de rotina) — sem
 * isso, cada leitura extra virava uma seta a mais empilhada na mesma coordenada (confirmado em
 * SBSC/Santa Cruz: duas setas idênticas sobrepostas). */
function dedupeLatestPerIcao(stations: WindStation[]): WindStation[] {
  const latestByIcao = new Map<string, WindStation>();
  for (const station of stations) {
    const current = latestByIcao.get(station.code);
    if (!current || new Date(station.observedAt).getTime() > new Date(current.observedAt).getTime()) {
      latestByIcao.set(station.code, station);
    }
  }
  return Array.from(latestByIcao.values());
}

/** Vento (METAR) nos aeroportos do cinturão, via Netlify Function (esconde a API key). */
export async function fetchRedemetWind(): Promise<WindStation[]> {
  const stations = await fetchRedemetWindRecords('');
  return dedupeLatestPerIcao(stations);
}

/** Converte um ISO 8601 para o formato YYYYMMDDHH (hora UTC) exigido pela API-REDEMET. */
function toRedemetDateParam(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}

/**
 * Série histórica de vento (METAR) nos aeroportos do cinturão, no intervalo [fromIso, toIso].
 * A API-REDEMET aceita consulta histórica nativamente (desde 2003, confirmado contra o servidor
 * real) via data_ini/data_fim. Pode devolver várias leituras por estação (~1 por hora) — use
 * pickWindStationsAtTimestamp (src/utils/windHistory.ts) para escolher a leitura de cada estação
 * num instante específico da linha do tempo.
 */
export async function fetchRedemetWindHistory(fromIso: string, toIso: string): Promise<WindStation[]> {
  const extraQuery = `&data_ini=${toRedemetDateParam(fromIso)}&data_fim=${toRedemetDateParam(toIso)}`;
  return fetchRedemetWindRecords(extraQuery);
}
