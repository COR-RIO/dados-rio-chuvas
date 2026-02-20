import type {
  HistoricalRainParams,
  HistoricalRainResponse,
  HistoricalRainRecord,
  RainStation,
  HistoricalRainInterval,
} from '../types/rain';
import { createFetchCache } from '../utils/cache';

/** No Netlify usamos o caminho direto da function para evitar redirect que devolve index.html. */
function getHistoricalRainApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('netlify.app')) {
    return '/.netlify/functions/historical-rain';
  }
  return '/api/historical-rain';
}

const DEFAULT_HISTORICAL_LIMIT = 10000;

/** Normaliza nome da estação para bater com o mapa (igual ao backend). */
function normalizeStationKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mapa nome normalizado -> [lat, lng] (fallback quando a API não envia location). */
const STATION_COORDS_BY_NAME: Record<string, [number, number]> = {
  vidigal: [-22.9925, -43.233056],
  urca: [-22.955833, -43.166667],
  rocinha: [-22.985833, -43.245],
  tijuca: [-22.931944, -43.221667],
  'santa teresa': [-22.931667, -43.196389],
  copacabana: [-22.986389, -43.189444],
  grajau: [-22.922222, -43.2675],
  'ilha do governador': [-22.818056, -43.210278],
  penha: [-22.844444, -43.275278],
  madureira: [-22.873333, -43.338889],
  iraja: [-22.826944, -43.336944],
  bangu: [-22.880278, -43.465833],
  piedade: [-22.893056, -43.307222],
  'jacarepagua tanque': [-22.9125, -43.364722],
  saude: [-22.898056, -43.194444],
  'jardim botanico': [-22.972778, -43.223889],
  'barra barrinha': [-23.008486, -43.299653],
  'jacarepagua cidade de deus': [-22.945556, -43.362778],
  'barra riocentro': [-22.977205, -43.391548],
  guaratiba: [-23.050278, -43.594722],
  'est grajau jacarepagua': [-22.925556, -43.315833],
  'santa cruz': [-22.909444, -43.684444],
  'grande meier': [-22.890556, -43.278056],
  anchieta: [-22.826944, -43.403333],
  'grota funda': [-23.014444, -43.519444],
  'campo grande': [-22.903611, -43.561944],
  sepetiba: [-22.968889, -43.711667],
  'alto da boa vista': [-22.965833, -43.278333],
  'av brasil mendanha': [-22.856944, -43.541111],
  'recreio dos bandeirantes': [-23.01, -43.440556],
  laranjeiras: [-22.940556, -43.1875],
  'sao cristovao': [-22.896667, -43.221667],
  'tijuca muda': [-22.932778, -43.243333],
};

/** Preenche location/latitude/longitude no cliente quando a API não envia (por nome da estação). */
function enrichRecordsWithLocation(rows: HistoricalRainRecord[]): HistoricalRainRecord[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const hasLocation =
      (Array.isArray(row.location) && row.location.length >= 2) ||
      (row.latitude != null && row.longitude != null);
    if (hasLocation) return row;

    const name = (row.station_name ?? row.name ?? row.estacao) as string | undefined;
    if (!name || typeof name !== 'string') return row;

    const coords = STATION_COORDS_BY_NAME[normalizeStationKey(name)];
    if (!coords) return row;

    const [lat, lng] = coords;
    return {
      ...row,
      location: coords,
      latitude: lat,
      longitude: lng,
    };
  });
}

/**
 * Monta query string a partir dos parâmetros.
 */
/**
 * Garante que um valor de horário tenha segundos (HH:mm -> HH:mm:00, HH:mm:ss mantém).
 */
function timeWithSeconds(t: string): string {
  if (!t || typeof t !== 'string') return '00:00:00';
  const trimmed = t.trim();
  const parts = trimmed.split(':');
  if (parts.length === 1) return `${parts[0].padStart(2, '0')}:00:00`;
  if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  return trimmed;
}

function toQueryString(params: HistoricalRainParams): string {
  const search = new URLSearchParams();
  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;
  if (params.timeFrom && dateFrom) dateFrom = `${dateFrom} ${timeWithSeconds(params.timeFrom)}`;
  if (params.timeTo && dateTo) dateTo = `${dateTo} ${timeWithSeconds(params.timeTo)}`;
  if (dateFrom) search.set('dateFrom', dateFrom);
  if (dateTo) search.set('dateTo', dateTo);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', params.sort);
  if (params.stationId) search.set('stationId', params.stationId);
  if (params.station) search.set('station', params.station);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const historicalRainCache = createFetchCache<HistoricalRainRecord[]>(15 * 60 * 1000, 30);

/**
 * Busca dados históricos de chuvas no GCP (BigQuery) via Netlify Function.
 * Resultados cacheados por 5 min por conjunto de parâmetros (menos carga no servidor e mais rápido ao repetir consulta).
 */
export async function fetchHistoricalRain(
  params: HistoricalRainParams = {}
): Promise<HistoricalRainRecord[]> {
  const cacheKey = toQueryString(params) || 'default';
  const cached = historicalRainCache.get(cacheKey);
  if (cached) return cached;
  const base = getHistoricalRainApiBase();
  const url = `${base}${toQueryString(params)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    const text = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(
      `GCP retornou resposta não-JSON (${res.status}). Configure a função no Netlify e variáveis GOOGLE_APPLICATION_CREDENTIALS_JSON. ${text ? `Resposta: ${text}` : ''}`
    );
  }

  const body: HistoricalRainResponse = await res.json().catch(() => ({
    success: false,
    error: 'Resposta inválida (JSON quebrado)',
  }));

  if (!res.ok) {
    throw new Error(body.error || `Erro ${res.status}: ${res.statusText}`);
  }

  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error || 'Dados históricos indisponíveis');
  }

  historicalRainCache.set(cacheKey, body.data);
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

/**
 * Parse do dia_original no formato Nimbus (string do BD): "YYYY-MM-DD HH:mm:ss.SSS ±HHMM"
 * O offset indica o fuso do horário (ex: -0300 = UTC-3).
 */
function parseDiaOriginalNimbus(str: string): string | null {
  if (typeof str !== 'string' || !str.trim()) return null;
  const trimmed = str.trim();
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\s*([+-])(\d{2})(\d{2})?)?$/
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, sign, oh, om] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10) - 1;
  const day = parseInt(d!, 10);
  const hour = parseInt(hh!, 10);
  const minute = parseInt(mm!, 10);
  const second = parseInt(ss!, 10);
  const offsetHours =
    sign != null && oh != null
      ? sign === '-'
        ? -(parseInt(oh, 10) + (parseInt(om || '0', 10) || 0) / 60)
        : parseInt(oh, 10) + (parseInt(om || '0', 10) || 0) / 60
      : 0;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  )
    return null;
  const localAsUtc = Date.UTC(year, month, day, hour, minute, second, 0);
  const utcMs = localAsUtc - offsetHours * 60 * 60 * 1000;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toIsoTimestamp(record: HistoricalRainRecord): string {
  const diaOriginal = record.dia_original;
  if (typeof diaOriginal === 'string') {
    const parsed = parseDiaOriginalNimbus(diaOriginal);
    if (parsed) return parsed;
  }

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

function getStationIdFromRecord(record: HistoricalRainRecord, index: number): string {
  return toStationId(record, index, toStationName(record, index));
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
  /** Estações por timestamp (para trocar horário de análise sem novo fetch) */
  stationsByTimestamp?: Record<string, RainStation[]>;
  /** Acumulado por estação no intervalo [dateFrom+timeFrom, dateTo+timeTo], quando aplicável */
  accumulatedByStation?: Map<string, { mm_15min: number; mm_1h: number; mm_accumulated: number }>;
}

/** Constrói Date de início e fim do intervalo a partir dos parâmetros da query. */
function parseIntervalBounds(params: HistoricalRainParams): { start: Date; end: Date } | null {
  const dateFrom = params.dateFrom?.trim();
  const dateTo = params.dateTo?.trim();
  if (!dateFrom || !dateTo) return null;
  const timeFrom = params.timeFrom?.trim() || '00:00';
  const timeTo = params.timeTo?.trim() || '23:59';
  const pad = (n: number) => String(n).padStart(2, '0');
  const parseDate = (dateStr: string, timeStr: string): Date => {
    const [h = '0', m = '0'] = timeStr.split(':');
    const d = new Date(dateStr + 'T' + pad(Number(h)) + ':' + pad(Number(m)) + ':00');
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  };
  const start = parseDate(dateFrom, timeFrom);
  const end = parseDate(dateTo, timeTo);
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

/**
 * Calcula acumulado por estação no intervalo, sem duplicar:
 * - mm_15min: uma leitura m15 por janela de 15 min no intervalo inteiro.
 * - mm_1h: uma leitura h01 por hora no intervalo inteiro.
 * - mm_accumulated: "inteligente" — horas inteiras com h01 (uma por hora) + restante com m15 (janelas de 15 min).
 *   Ex.: 4h → 4×h01. 8h37min → 8×h01 + 2×m15 (30 min do restante; os 7 min não entram para não sobrepor).
 */
function computeAccumulatedPerStation(
  rows: HistoricalRainRecord[],
  intervalStart: Date,
  intervalEnd: Date,
  toStationIdFromRecord: (record: HistoricalRainRecord, index: number) => string
): Map<string, { mm_15min: number; mm_1h: number; mm_accumulated: number }> {
  const result = new Map<string, { mm_15min: number; mm_1h: number; mm_accumulated: number }>();
  const byStation = new Map<string, Array<{ read_at: Date; m15: number; h01: number }>>();

  rows.forEach((record, index) => {
    const id = toStationIdFromRecord(record, index);
    const readAt = new Date(toIsoTimestamp(record));
    if (Number.isNaN(readAt.getTime())) return;
    const m15 = Math.max(0, pickNumber(record, ['m15', 'rain_15m'], 0));
    const h01 = Math.max(0, pickNumber(record, ['h01', 'rain_1h', 'precipitation_mm'], 0));

    let list = byStation.get(id);
    if (!list) {
      list = [];
      byStation.set(id, list);
    }
    list.push({ read_at: readAt, m15, h01 });
  });

  const ms15 = 15 * 60 * 1000;
  const ms1h = 60 * 60 * 1000;
  const startMs = intervalStart.getTime();
  const endMs = intervalEnd.getTime();

  byStation.forEach((list, stationId) => {
    list.sort((a, b) => a.read_at.getTime() - b.read_at.getTime());

    let sum15 = 0;
    let sum1h = 0;

    // Janelas de 15 min (para mm_15min)
    const firstBucketEnd15 = Math.ceil(startMs / ms15) * ms15;
    for (let T = firstBucketEnd15; T <= endMs; T += ms15) {
      const bucketEnd = new Date(T);
      const bucketStart = new Date(T - ms15);
      const inBucket = list.filter((r) => r.read_at.getTime() > bucketStart.getTime() && r.read_at.getTime() <= bucketEnd.getTime());
      if (inBucket.length === 0) continue;
      const best = inBucket[inBucket.length - 1];
      sum15 += best.m15;
    }

    // Janelas de 1 h (para mm_1h)
    const firstBucketEnd1h = Math.ceil(startMs / ms1h) * ms1h;
    for (let T = firstBucketEnd1h; T <= endMs; T += ms1h) {
      const bucketEnd = new Date(T);
      const bucketStart = new Date(T - ms1h);
      const inBucket = list.filter((r) => r.read_at.getTime() > bucketStart.getTime() && r.read_at.getTime() <= bucketEnd.getTime());
      if (inBucket.length === 0) continue;
      const best = inBucket[inBucket.length - 1];
      sum1h += best.h01;
    }

    // Acumulado inteligente: horas inteiras com h01 + restante com m15 (sem sobrepor)
    let sumAccumulated = 0;
    const firstHourEnd = Math.ceil(startMs / ms1h) * ms1h;
    if (firstHourEnd <= endMs) {
      let lastHourBoundary = firstHourEnd - ms1h; // último limite de hora considerado
      for (let T = firstHourEnd; T <= endMs; T += ms1h) {
        const bucketEnd = new Date(T);
        const bucketStart = new Date(T - ms1h);
        const inBucket = list.filter((r) => r.read_at.getTime() > bucketStart.getTime() && r.read_at.getTime() <= bucketEnd.getTime());
        if (inBucket.length > 0) {
          const best = inBucket[inBucket.length - 1];
          sumAccumulated += best.h01;
        }
        lastHourBoundary = T;
      }
      // Restante após a última hora cheia: só janelas de 15 min completas (sem sobrepor)
      for (let T = lastHourBoundary + ms15; T <= endMs; T += ms15) {
        const bucketEnd = new Date(T);
        const bucketStart = new Date(T - ms15);
        const inBucket = list.filter((r) => r.read_at.getTime() > bucketStart.getTime() && r.read_at.getTime() <= bucketEnd.getTime());
        if (inBucket.length > 0) {
          const best = inBucket[inBucket.length - 1];
          sumAccumulated += best.m15;
        }
      }
    } else {
      // Intervalo menor que 1 h: só janelas de 15 min
      const first15 = Math.ceil(startMs / ms15) * ms15;
      for (let T = first15; T <= endMs; T += ms15) {
        const bucketEnd = new Date(T);
        const bucketStart = new Date(T - ms15);
        const inBucket = list.filter((r) => r.read_at.getTime() > bucketStart.getTime() && r.read_at.getTime() <= bucketEnd.getTime());
        if (inBucket.length > 0) {
          const best = inBucket[inBucket.length - 1];
          sumAccumulated += best.m15;
        }
      }
    }

    result.set(stationId, {
      mm_15min: Math.round(sum15 * 100) / 100,
      mm_1h: Math.round(sum1h * 100) / 100,
      mm_accumulated: Math.round(sumAccumulated * 100) / 100,
    });
  });

  return result;
}

/**
 * Busca dados de um período e agrupa por timestamp de leitura.
 * Retorna a lista de horários disponíveis e as estações do horário selecionado.
 */
export async function fetchHistoricalRainStationsTimeline(
  params: HistoricalRainParams = {},
  selectedTimestamp?: string | null
): Promise<HistoricalStationsTimelineResult> {
  const rawRows = await fetchHistoricalRain({ limit: DEFAULT_HISTORICAL_LIMIT, sort: 'asc', ...params });
  const rows = enrichRecordsWithLocation(rawRows);
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
    if (rows.length > 0) {
      console.warn(
        '[GCP histórico] API retornou',
        rows.length,
        'linhas mas nenhuma com localização válida (latitude/longitude ou nome de estação que bata com pluviometros.json). Primeira linha (chaves):',
        Object.keys(rows[0] || {})
      );
    } else {
      console.log('[GCP histórico] API retornou 0 linhas para o período.', params);
    }
    return { timeline: [], selectedTimestamp: null, stations: [] };
  }

  const effectiveTimestamp =
    selectedTimestamp && byTimestamp.has(selectedTimestamp)
      ? selectedTimestamp
      : timeline[timeline.length - 1];

  const bounds = parseIntervalBounds(params);
  let accumulatedByStation: Map<string, { mm_15min: number; mm_1h: number; mm_accumulated: number }> | undefined;
  if (bounds) {
    accumulatedByStation = computeAccumulatedPerStation(rows, bounds.start, bounds.end, getStationIdFromRecord);
  }

  const enrichWithAccumulated = (list: RainStation[]): RainStation[] => {
    if (!accumulatedByStation) return list;
    return list.map((s) => {
      const acc = accumulatedByStation!.get(s.id);
      if (!acc) return s;
      return { ...s, accumulated: { mm_15min: acc.mm_15min, mm_1h: acc.mm_1h, mm_accumulated: acc.mm_accumulated } };
    });
  };

  const stationsByTimestamp: Record<string, RainStation[]> = {};
  for (const ts of timeline) {
    const list = Array.from(byTimestamp.get(ts)?.values() ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
    stationsByTimestamp[ts] = enrichWithAccumulated(list);
  }

  let stations = stationsByTimestamp[effectiveTimestamp] ?? [];

  return { timeline, selectedTimestamp: effectiveTimestamp, stations, stationsByTimestamp, accumulatedByStation };
}

/**
 * Extrai a data (YYYY-MM-DD) de um registro para agrupar por dia.
 */
function toDateKey(record: HistoricalRainRecord): string {
  const iso = toIsoTimestamp(record);
  return iso.slice(0, 10);
}

/**
 * Busca dados históricos em um intervalo de datas e agrupa por dia com acumulado (soma de m15 no dia).
 * Útil para ver "09/02/2026 até 10/02/2026" com acumulado por dia.
 */
export async function fetchHistoricalRainByIntervals(
  params: HistoricalRainParams & { dateFrom: string; dateTo: string }
): Promise<{ intervals: HistoricalRainInterval[] }> {
  const rawRows = await fetchHistoricalRain({
    limit: DEFAULT_HISTORICAL_LIMIT,
    sort: 'asc',
    ...params,
  });
  const rows = enrichRecordsWithLocation(rawRows);

  // Agrupar por dia: para cada dia guardar registros, soma de m15 e última leitura por estação
  const byDay = new Map<
    string,
    {
      records: HistoricalRainRecord[];
      sumM15: number;
      lastByStation: Map<string, { record: HistoricalRainRecord; index: number }>;
    }
  >();

  rows.forEach((record, index) => {
    const dateKey = toDateKey(record);
    let day = byDay.get(dateKey);
    if (!day) {
      day = {
        records: [],
        sumM15: 0,
        lastByStation: new Map(),
      };
      byDay.set(dateKey, day);
    }
    day.records.push(record);
    const m15 = pickNumber(record, ['m15', 'rain_15m'], 0);
    day.sumM15 += m15;

    const station = toRainStation(record, index);
    if (station) {
      day.lastByStation.set(station.id, { record, index });
    }
  });

  const intervals: HistoricalRainInterval[] = [];
  const sortedDays = Array.from(byDay.keys()).sort();

  for (const dateKey of sortedDays) {
    const day = byDay.get(dateKey)!;
    const stations: RainStation[] = Array.from(day.lastByStation.values())
      .map(({ record, index }) => toRainStation(record, index))
      .filter((s): s is RainStation => s != null)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const [y, m, d] = dateKey.split('-');
    const dateLabel =
      d && m && y
        ? new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : dateKey;

    intervals.push({
      date: dateKey,
      dateLabel,
      accumulatedMm: Math.round(day.sumM15 * 100) / 100,
      recordCount: day.records.length,
      stations,
    });
  }

  return { intervals };
}

/**
 * Converte dados históricos em estações (última leitura por estação).
 * Útil como fallback quando a API em tempo real estiver indisponível.
 */
export async function fetchLatestRainStationsFromGcp(
  params: HistoricalRainParams = {}
): Promise<RainStation[]> {
  const rawRows = await fetchHistoricalRain({ limit: DEFAULT_HISTORICAL_LIMIT, sort: 'desc', ...params });
  const rows = enrichRecordsWithLocation(rawRows);
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
    const res = await fetch(`${getHistoricalRainApiBase()}?limit=1`, {
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
