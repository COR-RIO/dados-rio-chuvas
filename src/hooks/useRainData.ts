import { useState, useEffect, useCallback, useRef } from 'react';
import { RainStation } from '../types/rain';
import { fetchRainData } from '../services/rainApi';
import { fetchHistoricalRainStationsTimeline } from '../services/gcpHistoricalRainApi';
import { MOCK_RAIN_STATIONS } from '../data/mockRainStations';

export interface UseRainDataOptions {
  /** Usar dados de exemplo (mock) para validar mapa de influência antes do GCP */
  useMock?: boolean;
  mode?: RainDataMode;
  historicalDate?: string;
  /** Filtro horário início (HH:mm) – combinado com historicalDate na query ao GCP */
  historicalTimeFrom?: string;
  /** Filtro horário fim (HH:mm) – combinado com historicalDate na query ao GCP */
  historicalTimeTo?: string;
  historicalTimestamp?: string | null;
  refreshInterval?: number;
}

export type RainDataSource = 'api' | 'gcp' | 'mock';
export type RainDataMode = 'auto' | 'historical';

export const useRainData = (
  refreshIntervalOrOptions: number | UseRainDataOptions = 300000
) => {
  const options =
    typeof refreshIntervalOrOptions === 'object'
      ? refreshIntervalOrOptions
      : { refreshInterval: refreshIntervalOrOptions };
  const {
    useMock = false,
    mode = 'auto',
    historicalDate,
    historicalTimeFrom,
    historicalTimeTo,
    historicalTimestamp = null,
    refreshInterval = 300000,
  } = options;

  const [stations, setStations] = useState<RainStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);
  const [historicalAvailable, setHistoricalAvailable] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<RainDataSource>('api');
  const [historicalTimeline, setHistoricalTimeline] = useState<string[]>([]);
  const [activeHistoricalTimestamp, setActiveHistoricalTimestamp] = useState<string | null>(null);
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
        setHistoricalAvailable(false);
        setDataSource('mock');
        setHistoricalTimeline([]);
        setActiveHistoricalTimestamp(null);
        hasLoadedRef.current = true;
        return;
      }

      if (mode === 'historical') {
        const targetDate = historicalDate || new Date().toISOString().slice(0, 10);
        const timelineData = await fetchHistoricalRainStationsTimeline(
          {
            dateFrom: targetDate,
            dateTo: targetDate,
            timeFrom: historicalTimeFrom,
            timeTo: historicalTimeTo,
            limit: 10000,
          },
          historicalTimestamp
        );

        if (!timelineData.stations.length) {
          throw new Error(`Sem dados históricos para ${targetDate}`);
        }

        setStations(timelineData.stations);
        setTotalStations(timelineData.stations.length);
        setLastUpdate(getLatestReadAt(timelineData.stations) ?? new Date());
        setApiAvailable(false);
        setHistoricalAvailable(true);
        setDataSource('gcp');
        setHistoricalTimeline(timelineData.timeline);
        setActiveHistoricalTimestamp(timelineData.selectedTimestamp);
        hasLoadedRef.current = true;
        return;
      }

      const data = await fetchRainData();

      if (data.length === 0) {
        setHistoricalAvailable(false);
        throw new Error('Nenhuma estação encontrada. Ative "Histórico" para usar dados do GCP.');
      }

      setStations(data);
      setTotalStations(data.length);
      setLastUpdate(getLatestReadAt(data) ?? new Date());
      setApiAvailable(true);
      setDataSource('api');
      setHistoricalTimeline([]);
      setActiveHistoricalTimestamp(null);
      hasLoadedRef.current = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      setApiAvailable(false);
      if (!hasLoadedRef.current) setStations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [useMock, mode, historicalDate, historicalTimeFrom, historicalTimeTo, historicalTimestamp]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
    if (useMock || mode === 'historical') return;
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval, useMock, mode]);

  return {
    stations,
    loading,
    refreshing,
    error,
    lastUpdate,
    apiAvailable,
    historicalAvailable,
    dataSource,
    historicalTimeline,
    activeHistoricalTimestamp,
    totalStations,
    refresh
  };
};