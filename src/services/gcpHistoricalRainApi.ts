import type {
  HistoricalRainParams,
  HistoricalRainResponse,
  HistoricalRainRecord,
} from '../types/rain';

const HISTORICAL_RAIN_API = '/api/historical-rain';

/**
 * Monta query string a partir dos parâmetros.
 */
function toQueryString(params: HistoricalRainParams): string {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  if (params.limit != null) search.set('limit', String(params.limit));
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
