import { useState, useEffect, useCallback } from 'react';
import { RainStation } from '../types/rain';
import { fetchRainData, checkApiAvailability, getLastUpdateInfo } from '../services/rainApi';
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
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);
  const [totalStations, setTotalStations] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (useMock) {
        setStations(MOCK_RAIN_STATIONS);
        setTotalStations(MOCK_RAIN_STATIONS.length);
        setLastUpdate(new Date());
        setApiAvailable(false);
        console.log(`Modo demonstração: ${MOCK_RAIN_STATIONS.length} estações mock`);
        setLoading(false);
        return;
      }

      const isAvailable = await checkApiAvailability();
      setApiAvailable(isAvailable);

      if (!isAvailable) {
        throw new Error('API da Prefeitura do Rio de Janeiro não está disponível no momento');
      }

      const data = await fetchRainData();

      if (data.length === 0) {
        throw new Error('Nenhuma estação meteorológica encontrada');
      }

      setStations(data);
      setTotalStations(data.length);

      const updateInfo = await getLastUpdateInfo();
      setLastUpdate(updateInfo.lastUpdate || new Date());

      console.log(`Dados atualizados: ${data.length} estações meteorológicas`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados';
      setError(errorMessage);
      console.error('Erro ao carregar dados de chuva:', err);

      if (stations.length === 0) {
        setStations([]);
      }
    } finally {
      setLoading(false);
    }
  }, [useMock, stations.length]);

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
    error,
    lastUpdate,
    apiAvailable,
    totalStations,
    refresh
  };
};