import { useState, useEffect } from 'react';
import { BairroCollection, fetchRioBairrosData } from '../services/citiesApi';

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
