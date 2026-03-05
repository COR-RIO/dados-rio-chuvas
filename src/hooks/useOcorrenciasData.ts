import { useState, useCallback } from 'react';
import {
  fetchOcorrenciasByDate,
  fetchAllOcorrenciasByDate,
  type OcorrenciaStatus,
} from '../services/ocorrenciasApi';

interface UseOcorrenciasDataOptions {
  dataInicio?: string | Date;
  dataFim?: string | Date;
  page?: number;
  pageSize?: number;
  autoFetch?: boolean;
}

export function useOcorrenciasData(options: UseOcorrenciasDataOptions = {}) {
  const {
    dataInicio,
    dataFim,
    page = 1,
    pageSize = 50,
    autoFetch = false,
  } = options;

  const [ocorrencias, setOcorrencias] = useState<OcorrenciaStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOcorrencias = useCallback(async (
    inicio: string | Date,
    fim: string | Date,
    currentPage: number = page,
    size: number = pageSize
  ) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchOcorrenciasByDate(
        inicio,
        fim,
        currentPage,
        size
      );
      setOcorrencias(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro ao buscar ocorrências:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const fetchAllOcorrencias = useCallback(async (
    inicio: string | Date,
    fim: string | Date,
    size: number = pageSize
  ) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchAllOcorrenciasByDate(inicio, fim, size);
      setOcorrencias(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro ao buscar todas as ocorrências:', err);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Auto-fetch se datas forem fornecidas
  if (autoFetch && dataInicio && dataFim && ocorrencias.length === 0 && !loading) {
    fetchOcorrencias(dataInicio, dataFim);
  }

  return {
    ocorrencias,
    loading,
    error,
    fetchOcorrencias,
    fetchAllOcorrencias,
  };
}
