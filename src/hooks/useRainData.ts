import { useState, useEffect, useCallback, useRef } from 'react';
import { RainStation } from '../types/rain';
import { fetchRainData } from '../services/rainApi';
import { MOCK_RAIN_STATIONS } from '../data/mockRainStations';

export interface UseRainDataOptions {
  /** Usar dados de exemplo (mock) para validar mapa de influência antes do GCP */
  useMock?: boolean;
  refreshInterval?: number;
}

export const useRainData = (
  refreshIntervalOrOptions: number | UseRainDataOptions = 300000
) => {
  const options =
    typeof refreshIntervalOrOptions === 'object'
      ? refreshIntervalOrOptions
      : { refreshInterval: refreshIntervalOrOptions };
  const { useMock = false, refreshInterval = 300000 } = options;

  const [stations, setStations] = useState<RainStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);
  const [totalStations, setTotalStations] = useState<number>(0);
  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const getLatestReadAt = (data: RainStation[]): Date | null => {
    if (!data.length) return null;
    const maxTs = Math.max(...data.map((s) => new Date(s.read_at).getTime()));
    return Number.isFinite(maxTs) ? new Date(maxTs) : null;
  };

  const loadData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      if (useMock) {
        setStations(MOCK_RAIN_STATIONS);
        setTotalStations(MOCK_RAIN_STATIONS.length);
        setLastUpdate(getLatestReadAt(MOCK_RAIN_STATIONS) ?? new Date());
        setApiAvailable(false);
        hasLoadedRef.current = true;
        return;
      }

      const data = await fetchRainData();

      if (data.length === 0) {
        throw new Error('Nenhuma estação meteorológica encontrada');
      }

      setStations(data);
      setTotalStations(data.length);
      setLastUpdate(getLatestReadAt(data) ?? new Date());
      setApiAvailable(true);
      hasLoadedRef.current = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados';
      setError(errorMessage);
      setApiAvailable(false);

      if (!hasLoadedRef.current) {
        setStations([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [useMock]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
    if (useMock) return;
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval, useMock]);

  return {
    stations,
    loading,
    refreshing,
    error,
    lastUpdate,
    apiAvailable,
    totalStations,
    refresh
  };
};