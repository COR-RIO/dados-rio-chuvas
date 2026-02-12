import type {
  HistoricalRainParams,
  HistoricalRainResponse,
  HistoricalRainRecord,
  RainStation,
} from '../types/rain';

const HISTORICAL_RAIN_API = '/api/historical-rain';
const DEFAULT_HISTORICAL_LIMIT = 10000;

/**
 * Monta query string a partir dos parâmetros.
 */
function toQueryString(params: HistoricalRainParams): string {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', params.sort);
  if (params.stationId) search.set('stationId', params.stationId);
  if (params.station) search.set('station', params.station);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Busca dados históricos de chuvas no GCP (BigQuery) via Netlify Function.
 * Requer que a função historical-rain esteja deployada e variáveis de ambiente configuradas.
 */
export async function fetchHistoricalRain(
  params: HistoricalRainParams = {}
): Promise<HistoricalRainRecord[]> {
  const url = `${HISTORICAL_RAIN_API}${toQueryString(params)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  });

  const body: HistoricalRainResponse = await res.json().catch(() => ({
    success: false,
    error: 'Resposta inválida',
  }));

  if (!res.ok) {
    throw new Error(body.error || `Erro ${res.status}: ${res.statusText}`);
  }

  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error || 'Dados históricos indisponíveis');
  }

  return body.data;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: HistoricalRainRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const parsed = toFiniteNumber(record[key]);
    if (parsed != null) return parsed;
  }
  return fallback;
}

function toIsoTimestamp(record: HistoricalRainRecord): string {
  const raw = record.read_at || record.timestamp || record.dia || record.datetime || record.date_time;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (raw && typeof raw === 'object' && 'value' in raw && typeof raw.value === 'string') {
    const parsed = new Date(raw.value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function parseLocation(record: HistoricalRainRecord): [number, number] | null {
  const fromFields = (): [number, number] | null => {
    const lat = toFiniteNumber(record.lat) ?? toFiniteNumber(record.latitude);
    const lng =
      toFiniteNumber(record.lng) ??
      toFiniteNumber(record.lon) ??
      toFiniteNumber(record.longitude);
    if (lat == null || lng == null) return null;
    return [lat, lng];
  };

  const fromValue = record.location;
  if (Array.isArray(fromValue) && fromValue.length >= 2) {
    const first = toFiniteNumber(fromValue[0]);
    const second = toFiniteNumber(fromValue[1]);
    if (first != null && second != null) {
      if (Math.abs(first) > 90 && Math.abs(second) <= 90) return [second, first];
      return [first, second];
    }
  }

  if (typeof fromValue === 'string') {
    const value = fromValue.trim();
    const pointMatch = value.match(/POINT\s*\(\s*(-?\d+(\.\d+)?)\s+(-?\d+(\.\d+)?)\s*\)/i);
    if (pointMatch) {
      const lng = Number(pointMatch[1]);
      const lat = Number(pointMatch[3]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }

    const split = value.split(',').map((item) => item.trim());
    if (split.length >= 2) {
      const first = toFiniteNumber(split[0]);
      const second = toFiniteNumber(split[1]);
      if (first != null && second != null) {
        if (Math.abs(first) > 90 && Math.abs(second) <= 90) return [second, first];
        return [first, second];
      }
    }
  }

  return fromFields();
}

function toStationName(record: HistoricalRainRecord, index: number): string {
  const raw = record.station_name || record.name || record.estacao || record.station_id || record.estacao_id || record.id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return `Estação ${raw}`;
  return `Estação ${index + 1}`;
}

function toStationId(record: HistoricalRainRecord, index: number, name: string): string {
  const raw = record.station_id || record.estacao_id || record.id || name || `estacao-${index + 1}`;
  const normalized = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `gcp-${normalized || index + 1}`;
}

function toRainStation(record: HistoricalRainRecord, index: number): RainStation | null {
  const location = parseLocation(record);
  if (!location) return null;

  const name = toStationName(record, index);
  const id = toStationId(record, index, name);
  const h01 = pickNumber(record, ['h01', 'rain_1h', 'precipitation_mm'], 0);
  const h24 = pickNumber(record, ['h24', 'rain_24h'], 0);
  const m15 = pickNumber(record, ['m15', 'rain_15m'], 0);
  const m05 = pickNumber(record, ['m05', 'rain_5m'], 0);

  return {
    id,
    name,
    location,
    read_at: toIsoTimestamp(record),
    is_new: false,
    data: {
      m05,
      m15,
      h01,
      h02: pickNumber(record, ['h02', 'rain_2h'], 0),
      h03: pickNumber(record, ['h03', 'rain_3h'], 0),
      h04: pickNumber(record, ['h04', 'rain_4h'], 0),
      h24,
      h96: pickNumber(record, ['h96', 'rain_96h'], 0),
      mes: pickNumber(record, ['mes', 'month_total'], 0),
    },
  };
}

export interface HistoricalStationsTimelineResult {
  timeline: string[];
  selectedTimestamp: string | null;
  stations: RainStation[];
}

/**
 * Busca dados de um período e agrupa por timestamp de leitura.
 * Retorna a lista de horários disponíveis e as estações do horário selecionado.
 */
export async function fetchHistoricalRainStationsTimeline(
  params: HistoricalRainParams = {},
  selectedTimestamp?: string | null
): Promise<HistoricalStationsTimelineResult> {
  const rows = await fetchHistoricalRain({ limit: DEFAULT_HISTORICAL_LIMIT, sort: 'asc', ...params });
  const byTimestamp = new Map<string, Map<string, RainStation>>();

  rows.forEach((record, index) => {
    const station = toRainStation(record, index);
    if (!station) return;

    const ts = station.read_at;
    const stationsAtTs = byTimestamp.get(ts) ?? new Map<string, RainStation>();
    if (!byTimestamp.has(ts)) byTimestamp.set(ts, stationsAtTs);

    if (!stationsAtTs.has(station.id)) {
      stationsAtTs.set(station.id, station);
    }
  });

  const timeline = Array.from(byTimestamp.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  if (timeline.length === 0) {
    return { timeline: [], selectedTimestamp: null, stations: [] };
  }

  const effectiveTimestamp =
    selectedTimestamp && byTimestamp.has(selectedTimestamp)
      ? selectedTimestamp
      : timeline[timeline.length - 1];

  const stations = Array.from(byTimestamp.get(effectiveTimestamp)?.values() ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );

  return { timeline, selectedTimestamp: effectiveTimestamp, stations };
}

/**
 * Converte dados históricos em estações (última leitura por estação).
 * Útil como fallback quando a API em tempo real estiver indisponível.
 */
export async function fetchLatestRainStationsFromGcp(
  params: HistoricalRainParams = {}
): Promise<RainStation[]> {
  const rows = await fetchHistoricalRain({ limit: DEFAULT_HISTORICAL_LIMIT, sort: 'desc', ...params });
  const latestByStation = new Map<string, RainStation>();

  rows.forEach((record, index) => {
    const station = toRainStation(record, index);
    if (!station) return;

    if (latestByStation.has(station.id)) return;
    latestByStation.set(station.id, station);
  });

  return Array.from(latestByStation.values());
}

/**
 * Verifica se a API de dados históricos (GCP) está disponível.
 */
export async function checkHistoricalRainApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${HISTORICAL_RAIN_API}?limit=1`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}
