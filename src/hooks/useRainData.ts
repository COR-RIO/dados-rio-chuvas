import { useState, useEffect } from 'react';
import { RainStation } from '../types/rain';
import { fetchRainData } from '../services/rainApi';

export const useRainData = (refreshInterval: number = 300000) => { // 5 minutos
  const [stations, setStations] = useState<RainStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRainData();
      setStations(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar dados. Mostrando dados de exemplo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    const interval = setInterval(loadData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return {
    stations,
    loading,
    error,
    lastUpdate,
    refresh: loadData
  };
};