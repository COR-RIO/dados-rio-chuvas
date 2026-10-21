import { useCallback, useEffect, useState } from 'react';
import {
  fetchForecastModels,
  FORECAST_POINTS,
  type ForecastModelId,
  type ForecastModelsResult,
} from '../services/forecastModelsApi';

// Os modelos rodam a cada 6 h (GFS/ECMWF) ou 3 h (ICON) — 30 min basta para pegar a rodada nova.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function useForecastModels(models: ForecastModelId[], forecastDays: number) {
  const [data, setData] = useState<ForecastModelsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modelsKey = models.join(',');

  const refresh = useCallback(async () => {
    if (!modelsKey) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchForecastModels(FORECAST_POINTS, modelsKey.split(',') as ForecastModelId[], forecastDays);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar previsões');
    } finally {
      setLoading(false);
    }
  }, [modelsKey, forecastDays]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, loading, error, refresh };
}
