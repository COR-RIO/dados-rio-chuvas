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
  success?: boolean;
  status?: boolean;
  data?: RedemetWindRecord[] | { data?: RedemetWindRecord[]; [key: string]: unknown };
  error?: string;
  message?: string | number;
}

function extractRawText(record: Record<string, unknown>): string {
  if (typeof record?.mens === 'string') return record.mens;
  if (typeof record?.message === 'string') return record.message;
  if (typeof record?.metar === 'string') return record.metar;
  if (typeof record?.raw === 'string') return record.raw;
  return '';
}

function parseWindGroup(rawText: string): { windDirectionDeg: number | null; windSpeedMs: number; windGustMs: number | null } | null {
  const match = /\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)\b/.exec(rawText || '');
  if (!match) return null;

  const [, dir, speedRaw, , gustRaw, unit] = match;
  const factor = unit === 'KT' ? 0.514444 : 1;
  return {
    windDirectionDeg: dir === 'VRB' ? null : Number(dir),
    windSpeedMs: Number((Number(speedRaw) * factor).toFixed(1)),
    windGustMs: gustRaw ? Number((Number(gustRaw) * factor).toFixed(1)) : null,
  };
}

function parseObservedAt(record: Record<string, unknown>, rawText: string): string {
  const dateField = typeof record?.validade_inicial === 'string' ? record.validade_inicial :
    typeof record?.recebimento === 'string' ? record.recebimento :
    typeof record?.hora === 'string' ? record.hora : null;

  if (dateField) {
    const iso = String(dateField).replace(' ', 'T');
    const withZone = /Z$/.test(iso) ? iso : `${iso}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const match = /\b(\d{2})(\d{2})(\d{2})Z\b/.exec(rawText || '');
  if (!match) return new Date().toISOString();

  const [, dayStr, hourStr, minStr] = match;
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  const day = Number(dayStr);
  if (day > now.getUTCDate() + 2) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return new Date(Date.UTC(year, month, day, Number(hourStr), Number(minStr))).toISOString();
}

function extractMessageType(rawText: string): 'METAR' | 'SPECI' {
  return /^SPECI\b/i.test((rawText || '').trim()) ? 'SPECI' : 'METAR';
}

function extractIcao(record: Record<string, unknown>, rawText: string): string | null {
  if (typeof record?.id_localidade === 'string') return record.id_localidade.toUpperCase();
  if (typeof record?.icao === 'string') return record.icao.toUpperCase();
  if (typeof record?.localidade === 'string') return record.localidade.toUpperCase();
  const match = /\b([A-Z]{4})\b/.exec(rawText || '');
  return match ? match[1] : null;
}

function normalizeRedemetRecords(json: RedemetWindResponse | unknown): RedemetWindRecord[] {
  if (!json || typeof json !== 'object') return [];

  const candidate = json as Record<string, unknown>;
  const dataValue = candidate.data;

  if (Array.isArray(dataValue)) return dataValue as RedemetWindRecord[];

  if (dataValue && typeof dataValue === 'object') {
    const nested = dataValue as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as RedemetWindRecord[];
    if (Array.isArray(nested.mensagens)) return nested.mensagens as RedemetWindRecord[];
  }

  if (Array.isArray(candidate)) return candidate as RedemetWindRecord[];
  return [];
}

function mapRecordsToStations(records: RedemetWindRecord[]): WindStation[] {
  const byIcao = new Map(WIND_BELT_AIRPORTS.map((a) => [a.icao, a]));

  return records
    .map((record): WindStation | null => {
      const normalized = (
        typeof record.icao === 'string' && typeof record.observedAt === 'string' && typeof record.windSpeedMs === 'number'
          ? record
          : {
              icao: extractIcao(record as Record<string, unknown>, extractRawText(record as Record<string, unknown>)),
              observedAt: parseObservedAt(record as Record<string, unknown>, extractRawText(record as Record<string, unknown>)),
              windSpeedMs: parseWindGroup(extractRawText(record as Record<string, unknown>))?.windSpeedMs ?? 0,
              windGustMs: parseWindGroup(extractRawText(record as Record<string, unknown>))?.windGustMs ?? null,
              windDirectionDeg: parseWindGroup(extractRawText(record as Record<string, unknown>))?.windDirectionDeg ?? null,
              messageType: extractMessageType(extractRawText(record as Record<string, unknown>)),
              raw: extractRawText(record as Record<string, unknown>),
            }
      ) as RedemetWindRecord;

      if (!normalized.icao) return null;

      const airport = byIcao.get(normalized.icao);
      if (!airport) return null;

      return {
        id: `redemet-${normalized.icao}-${normalized.observedAt}`,
        name: airport.label,
        source: 'redemet',
        code: normalized.icao,
        corridor: airport.corridor,
        location: airport.location,
        observedAt: normalized.observedAt,
        windSpeedMs: normalized.windSpeedMs,
        windGustMs: normalized.windGustMs,
        windDirectionDeg: normalized.windDirectionDeg,
        messageType: normalized.messageType,
        raw: normalized.raw,
      };
    })
    .filter((s): s is WindStation => s != null);
}

async function fetchRedemetWindRecords(extraQuery: string): Promise<WindStation[]> {
  const icaoList = WIND_BELT_AIRPORTS.map((a) => a.icao).join(',');
  const url = `${REDEMET_WIND_URL}?icao=${encodeURIComponent(icaoList)}${extraQuery}`;

  let json: RedemetWindResponse | unknown;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    json = await response.json();
  } catch (err) {
    console.warn('Erro ao buscar vento REDEMET:', err);
    return [];
  }

  const normalizedRecords = normalizeRedemetRecords(json);
  if (!normalizedRecords.length) {
    const response = json as RedemetWindResponse | undefined;
    if (response?.error || response?.message) {
      console.warn('REDEMET indisponível:', response.error ?? response.message);
    }
    return [];
  }

  return mapRecordsToStations(normalizedRecords);
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
