import { useState, useEffect, useCallback } from 'react';
import { RainStation } from '../types/rain';
import { fetchRainData, checkApiAvailability, getLastUpdateInfo } from '../services/rainApi';

export const useRainData = (refreshInterval: number = 300000) => { // 5 minutos por padrão
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
      
      // Verifica se a API está disponível
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
      
      // Obtém a data real da última atualização dos dados
      const updateInfo = await getLastUpdateInfo();
      setLastUpdate(updateInfo.lastUpdate || new Date());
      
      console.log(`Dados atualizados: ${data.length} estações meteorológicas`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados';
      setError(errorMessage);
      console.error('Erro ao carregar dados de chuva:', err);
      
      // Em caso de erro, mantém os dados anteriores se existirem
      if (stations.length === 0) {
        setStations([]);
      }
    } finally {
      setLoading(false);
    }
  }, [stations.length]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
    
    const interval = setInterval(loadData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

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