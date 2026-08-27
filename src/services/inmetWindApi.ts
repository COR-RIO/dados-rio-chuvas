import type { WindStation } from '../types/wind';
import { WIND_BELT_CITIES, type WindBeltCity } from '../config/windBelt';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

// Proxy para evitar CORS (dev: vite.config.ts, prod: netlify.toml).
const INMET_BASE = '/api/inmet';

/**
 * A rota de 3 segmentos `/estacao/{ini}/{fim}/{codigo}` (documentada em vários tutoriais antigos)
 * hoje devolve 204 vazio silenciosamente para qualquer estação/data — confirmado testando contra
 * o servidor real. A rota que de fato funciona exige token: `/token/estacao/{ini}/{fim}/{codigo}/{token}`
 * (retorna "CHAVE INVÁLIDA!" sem um token válido). `/estacoes/T` (lista de estações) continua público.
 * Ver docs/WIND_SETUP.md para como obter o token.
 */
const INMET_TOKEN = import.meta.env.VITE_INMET_TOKEN as string | undefined;

interface InmetStationListItem {
  CD_ESTACAO?: string;
  DC_NOME?: string;
  SG_ESTADO?: string;
  UF?: string;
  VL_LATITUDE?: string | number;
  VL_LONGITUDE?: string | number;
  CD_SITUACAO?: string;
  [key: string]: unknown;
}

interface InmetObservation {
  CD_ESTACAO?: string;
  DT_MEDICAO?: string;
  HR_MEDICAO?: string;
  VEN_VEL?: string | number | null;
  VEN_RAJ?: string | number | null;
  VEN_DIR?: string | number | null;
  [key: string]: unknown;
}

interface MatchedStation {
  code: string;
  name: string;
  location: [number, number];
  city: WindBeltCity;
}

let stationListCache: { fetchedAt: number; stations: InmetStationListItem[] } | null = null;
const STATION_LIST_TTL_MS = 24 * 60 * 60 * 1000; // 24h — lista de estações muda raramente

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c',
};

function normalize(value: string | undefined | null): string {
  return String(value ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('')
    .trim();
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function fetchStationList(): Promise<InmetStationListItem[]> {
  if (stationListCache && Date.now() - stationListCache.fetchedAt < STATION_LIST_TTL_MS) {
    return stationListCache.stations;
  }
  const response = await fetchWithTimeout(`${INMET_BASE}/estacoes/T`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INMET estacoes/T retornou ${response.status}`);
  const stations: InmetStationListItem[] = await response.json();
  stationListCache = { fetchedAt: Date.now(), stations };
  return stations;
}

/** Casa as cidades do cinturão (src/config/windBelt.ts) com estações reais retornadas pelo INMET. */
function matchBeltStations(stations: InmetStationListItem[]): MatchedStation[] {
  const matched: MatchedStation[] = [];
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
        location: [toFiniteNumber(found.VL_LATITUDE)!, toFiniteNumber(found.VL_LONGITUDE)!],
        city,
      });
    }
  }
  return matched;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Busca a observação mais recente com vento válido para uma estação, nas últimas ~27h. */
async function fetchLatestWindObservation(code: string): Promise<InmetObservation | null> {
  if (!INMET_TOKEN) return null;

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const url = `${INMET_BASE}/token/estacao/${dateOnly(yesterday)}/${dateOnly(today)}/${code}/${INMET_TOKEN}`;
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INMET estacao ${code} retornou ${response.status}`);

  const text = await response.text();
  if (text === 'CHAVE INVÁLIDA!') throw new Error('VITE_INMET_TOKEN inválido');

  const records: InmetObservation[] = JSON.parse(text);
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

function toObservedAtIso(obs: InmetObservation): string {
  const day = obs.DT_MEDICAO ?? dateOnly(new Date());
  const hr = String(obs.HR_MEDICAO ?? '0000').padStart(4, '0');
  const hh = hr.slice(0, 2);
  const mm = hr.slice(2, 4);
  // INMET registra em UTC.
  return `${day}T${hh}:${mm}:00Z`;
}

/** Estações do cinturão de vento (INMET) com a observação de vento mais recente disponível. */
export async function fetchInmetWindObservations(): Promise<WindStation[]> {
  if (!INMET_TOKEN) {
    console.warn('INMET não configurado (defina VITE_INMET_TOKEN) — ver docs/WIND_SETUP.md');
    return [];
  }

  let stationList: InmetStationListItem[];
  try {
    stationList = await fetchStationList();
  } catch (err) {
    console.warn('Erro ao buscar lista de estações INMET:', err);
    return [];
  }

  const matched = matchBeltStations(stationList);

  const results = await Promise.allSettled(
    matched.map(async (m): Promise<WindStation | null> => {
      const obs = await fetchLatestWindObservation(m.code);
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
    .filter((r): r is PromiseFulfilledResult<WindStation | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is WindStation => v != null);
}

/** Busca TODAS as observações com vento válido de uma estação num intervalo de datas (histórico). */
async function fetchWindObservationsInRange(
  code: string,
  dateFromIso: string,
  dateToIso: string
): Promise<InmetObservation[]> {
  const url = `${INMET_BASE}/token/estacao/${dateOnly(new Date(dateFromIso))}/${dateOnly(new Date(dateToIso))}/${code}/${INMET_TOKEN}`;
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`INMET estacao ${code} retornou ${response.status}`);

  const text = await response.text();
  if (text === 'CHAVE INVÁLIDA!') throw new Error('VITE_INMET_TOKEN inválido');

  const records: InmetObservation[] = JSON.parse(text);
  if (!Array.isArray(records)) return [];
  return records.filter((r) => toFiniteNumber(r.VEN_VEL) != null);
}

/**
 * Série histórica de vento das estações do cinturão (INMET), no intervalo [dateFromIso, dateToIso].
 * Mesmo endpoint de fetchLatestWindObservation, só que devolvendo todas as leituras do período em
 * vez de só a mais recente — use pickWindStationsAtTimestamp (src/utils/windHistory.ts) para
 * escolher a leitura de cada estação num instante específico da linha do tempo.
 */
export async function fetchInmetWindHistory(dateFromIso: string, dateToIso: string): Promise<WindStation[]> {
  if (!INMET_TOKEN) {
    console.warn('INMET não configurado (defina VITE_INMET_TOKEN) — ver docs/WIND_SETUP.md');
    return [];
  }

  let stationList: InmetStationListItem[];
  try {
    stationList = await fetchStationList();
  } catch (err) {
    console.warn('Erro ao buscar lista de estações INMET:', err);
    return [];
  }

  const matched = matchBeltStations(stationList);

  const results = await Promise.allSettled(
    matched.map(async (m): Promise<WindStation[]> => {
      const observations = await fetchWindObservationsInRange(m.code, dateFromIso, dateToIso);
      return observations
        .map((obs): WindStation | null => {
          const windSpeedMs = toFiniteNumber(obs.VEN_VEL);
          if (windSpeedMs == null) return null;
          const observedAt = toObservedAtIso(obs);
          return {
            // Inclui observedAt no id: histórico traz várias leituras por estação, então o
            // código sozinho não identifica um registro único.
            id: `inmet-${m.code}-${observedAt}`,
            name: m.city.label,
            source: 'inmet',
            code: m.code,
            corridor: m.city.corridor,
            location: m.location,
            observedAt,
            windSpeedMs,
            windGustMs: toFiniteNumber(obs.VEN_RAJ),
            windDirectionDeg: toFiniteNumber(obs.VEN_DIR),
          };
        })
        .filter((s): s is WindStation => s != null);
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<WindStation[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}
