import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Previsão por modelo numérico (ECMWF, GFS, ICON...) para pontos fixos da cidade — o mesmo
 * "Comparar previsões" do Windy, mas sem copiar à mão.
 *
 * Fonte: Open-Meteo (https://open-meteo.com) — agrega os modelos oficiais (ECMWF open data,
 * NOAA GFS, DWD ICON) numa API sem chave e com CORS, então o browser chama direto. Uma única
 * requisição traz todos os pontos × modelos (latitude/longitude separados por vírgula).
 *
 * O meteoblue (que aparece no Windy) é comercial e exige API key — vem por outra rota, a Netlify
 * Function meteoblue-forecast (esconde a chave e cacheia 1 h pra economizar créditos). Se a chave
 * não estiver configurada, só o meteoblue fica indisponível; os outros modelos seguem normais.
 */
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const METEOBLUE_URL = '/api/meteoblue-forecast';

export type ForecastModelId = 'ecmwf_ifs' | 'ecmwf_aifs025_single' | 'gfs_seamless' | 'icon_seamless' | 'meteoblue';

export interface ForecastModel {
  id: ForecastModelId;
  label: string;
  description: string;
  color: string;
}

export const FORECAST_MODELS: ForecastModel[] = [
  { id: 'ecmwf_ifs', label: 'ECMWF', description: 'ECMWF IFS HRES 9 km (Europa)', color: '#2563EB' },
  {
    id: 'meteoblue',
    label: 'meteoblue',
    description: 'meteoblue multimodelo (Suíça) — o mesmo do Windy; requer METEOBLUE_API_KEY',
    color: '#0891B2',
  },
  { id: 'gfs_seamless', label: 'GFS', description: 'NOAA GFS 13–25 km (EUA)', color: '#DC2626' },
  { id: 'icon_seamless', label: 'ICON', description: 'DWD ICON 13 km (Alemanha)', color: '#16A34A' },
  {
    id: 'ecmwf_aifs025_single',
    label: 'ECMWF AIFS',
    description: 'Modelo de IA do ECMWF, 25 km (não traz rajada)',
    color: '#9333EA',
  },
];

export interface ForecastPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Pontos acompanhados pela meteorologia do COR (mesma lista da planilha manual do Windy). */
export const FORECAST_POINTS: ForecastPoint[] = [
  { id: 'grota-funda', name: 'Grota Funda', lat: -23.0139, lng: -43.5236 },
  { id: 'santa-cruz', name: 'Santa Cruz', lat: -22.9192, lng: -43.6847 },
  { id: 'mendanha', name: 'Mendanha', lat: -22.8565, lng: -43.4975 },
  { id: 'anchieta', name: 'Anchieta', lat: -22.8228, lng: -43.4 },
  { id: 'ilha-governador', name: 'Ilha do Governador', lat: -22.803, lng: -43.205 },
  { id: 'praca-bandeira', name: 'Pça da Bandeira', lat: -22.911, lng: -43.213 },
  { id: 'copacabana', name: 'Copacabana', lat: -22.9711, lng: -43.1863 },
  { id: 'barra-barrinha', name: 'Barra / Barrinha', lat: -23.0062, lng: -43.3205 },
];

/** Bloco de 3 h no padrão do Windy (00, 03, ... 21). `hour` é o FIM do bloco: o valor das 15h é
 * a chuva entre 12h e 15h ("accumulation for the preceding 3 hours", doc da API do Windy). */
export interface ForecastSlot {
  /** "YYYY-MM-DD" no fuso de Brasília. */
  date: string;
  hour: number;
  /** Chuva acumulada no bloco (hour-3, hour] — null se o modelo não cobre o horário. */
  rainMm: number | null;
  /** Maior rajada no bloco, em km/h. */
  gustKmh: number | null;
  /** Vento médio no horário `hour`, em km/h. */
  windKmh: number | null;
  windDirDeg: number | null;
  tempC: number | null;
}

export interface PointModelForecast {
  pointId: string;
  modelId: ForecastModelId;
  slots: ForecastSlot[];
}

export interface ForecastModelsResult {
  /** forecasts[pointId][modelId] */
  forecasts: Record<string, Partial<Record<ForecastModelId, ForecastSlot[]>>>;
  /** Modelos que falharam (ex.: meteoblue sem chave) — os demais continuam em `forecasts`. */
  modelErrors: Partial<Record<ForecastModelId, string>>;
  fetchedAt: Date;
}

interface MeteoblueResponse {
  points?: {
    time: string[];
    precipitation: (number | null)[];
    temperature: (number | null)[];
    windspeed: (number | null)[];
    winddirection: (number | null)[];
    gust: (number | null)[];
  }[];
  error?: string;
}

interface OpenMeteoLocation {
  hourly?: Record<string, (number | null)[] | string[]> & { time: string[] };
  error?: boolean;
  reason?: string;
}

const HOURLY_VARS = ['precipitation', 'wind_gusts_10m', 'wind_speed_10m', 'wind_direction_10m', 'temperature_2m'];

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Agrupa a série horária em blocos de 3 h terminando em `hour`, como o Windy. No Open-Meteo, a
 * chuva (e a rajada) da hora H já se refere à hora anterior (H-1 → H), então o bloco das 15h soma
 * as horas 13, 14 e 15 = chuva de 12h a 15h.
 */
function toThreeHourSlots(times: string[], series: Record<string, (number | null)[] | undefined>): ForecastSlot[] {
  const precip = series.precipitation ?? [];
  const gusts = series.wind_gusts_10m ?? [];
  const speed = series.wind_speed_10m ?? [];
  const dir = series.wind_direction_10m ?? [];
  const temp = series.temperature_2m ?? [];

  const slots: ForecastSlot[] = [];
  for (let i = 0; i < times.length; i++) {
    const [date, hm] = times[i].split('T');
    const hour = Number(hm.slice(0, 2));
    if (hour % 3 !== 0) continue;

    let rain: number | null = null;
    let gust: number | null = null;
    // Primeiro bloco da série (00h de hoje) não tem as horas anteriores — fica incompleto, pula.
    if (i < 2) continue;
    for (let k = i - 2; k <= i; k++) {
      const p = precip[k];
      if (p != null) rain = (rain ?? 0) + p;
      const g = gusts[k];
      if (g != null) gust = Math.max(gust ?? 0, g);
    }

    slots.push({
      date,
      hour,
      rainMm: rain == null ? null : round1(rain),
      gustKmh: gust == null ? null : Math.round(gust),
      windKmh: speed[i] == null ? null : Math.round(speed[i] as number),
      windDirDeg: dir[i] ?? null,
      tempC: temp[i] == null ? null : Math.round(temp[i] as number),
    });
  }
  // Descarta blocos sem nenhum dado (fim do horizonte de um modelo mais curto).
  return slots.filter((s) => s.rainMm != null || s.tempC != null);
}

async function fetchOpenMeteo(
  points: ForecastPoint[],
  models: ForecastModelId[],
  forecastDays: number
): Promise<ForecastModelsResult['forecasts']> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lng).join(','),
    hourly: HOURLY_VARS.join(','),
    models: models.join(','),
    wind_speed_unit: 'kmh',
    timezone: 'America/Sao_Paulo',
    forecast_days: String(forecastDays),
  });

  const res = await fetchWithTimeout(`${OPEN_METEO_URL}?${params}`, undefined, 20000);
  const body = await res.json();
  if (!res.ok || body?.error) {
    throw new Error(body?.reason || `Open-Meteo respondeu ${res.status}`);
  }
  // Com um único ponto a API devolve um objeto em vez de array.
  const locations: OpenMeteoLocation[] = Array.isArray(body) ? body : [body];

  const forecasts: ForecastModelsResult['forecasts'] = {};
  points.forEach((point, idx) => {
    const hourly = locations[idx]?.hourly;
    if (!hourly) return;
    const byModel: Partial<Record<ForecastModelId, ForecastSlot[]>> = {};
    for (const model of models) {
      // Com mais de um modelo, cada variável vem com sufixo: "precipitation_gfs_seamless".
      const series: Record<string, (number | null)[] | undefined> = {};
      for (const v of HOURLY_VARS) {
        const key = models.length > 1 ? `${v}_${model}` : v;
        series[v] = hourly[key] as (number | null)[] | undefined;
      }
      byModel[model] = toThreeHourSlots(hourly.time, series);
    }
    forecasts[point.id] = byModel;
  });
  return forecasts;
}

/** meteoblue via Netlify Function. A série horária já vem no fuso de Brasília e em km/h; a chuva
 * horária é tratada como acumulado da hora anterior, igual ao Open-Meteo. */
async function fetchMeteoblue(points: ForecastPoint[]): Promise<Record<string, ForecastSlot[]>> {
  const params = new URLSearchParams({
    lat: points.map((p) => p.lat).join(','),
    lon: points.map((p) => p.lng).join(','),
  });
  // cache padrão do browser: a function já devolve Cache-Control de 1 h (economiza créditos).
  const res = await fetchWithTimeout(`${METEOBLUE_URL}?${params}`, { cache: 'default' }, 25000);
  const body: MeteoblueResponse = await res.json();
  if (!res.ok || body.error || !body.points) {
    throw new Error(body.error || `meteoblue respondeu ${res.status}`);
  }
  const result: Record<string, ForecastSlot[]> = {};
  points.forEach((point, idx) => {
    const p = body.points?.[idx];
    if (!p) return;
    result[point.id] = toThreeHourSlots(p.time, {
      precipitation: p.precipitation,
      wind_gusts_10m: p.gust,
      wind_speed_10m: p.windspeed,
      wind_direction_10m: p.winddirection,
      temperature_2m: p.temperature,
    });
  });
  return result;
}

export async function fetchForecastModels(
  points: ForecastPoint[],
  models: ForecastModelId[],
  forecastDays: number
): Promise<ForecastModelsResult> {
  const openMeteoModels = models.filter((m) => m !== 'meteoblue');
  const [openMeteo, meteoblue] = await Promise.allSettled([
    openMeteoModels.length ? fetchOpenMeteo(points, openMeteoModels, forecastDays) : Promise.resolve({}),
    models.includes('meteoblue') ? fetchMeteoblue(points) : Promise.resolve(null),
  ]);

  // Open-Meteo é a fonte principal: se ela falha, o erro sobe (tela mostra o aviso geral).
  if (openMeteo.status === 'rejected') throw openMeteo.reason;
  const forecasts = openMeteo.value as ForecastModelsResult['forecasts'];
  const modelErrors: ForecastModelsResult['modelErrors'] = {};

  if (meteoblue.status === 'rejected') {
    modelErrors.meteoblue = meteoblue.reason instanceof Error ? meteoblue.reason.message : String(meteoblue.reason);
  } else if (meteoblue.value) {
    for (const [pointId, slots] of Object.entries(meteoblue.value)) {
      forecasts[pointId] = { ...forecasts[pointId], meteoblue: slots };
    }
  }

  return { forecasts, modelErrors, fetchedAt: new Date() };
}
