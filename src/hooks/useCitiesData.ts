import { useState, useEffect } from 'react';
import { BairroCollection, fetchRioBairrosData, ZonasPluvCollection, fetchZonasPluvData } from '../services/citiesApi';

export const useBairrosData = () => {
  const [bairrosData, setBairrosData] = useState<BairroCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBairrosData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRioBairrosData();
        setBairrosData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    loadBairrosData();
  }, []);

  return { bairrosData, loading, error };
};

export const useZonasPluvData = () => {
  const [zonasData, setZonasData] = useState<ZonasPluvCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchZonasPluvData();
        setZonasData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar zonas');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { zonasData, loading, error };
};
