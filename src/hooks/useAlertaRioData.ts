import { useState, useEffect } from 'react';
import { fetchAlertaRioGeoJson } from '../services/alertaRioApi';
import type { AlertaRioCollection } from '../types/alertaRio';

export function useAlertaRioData() {
  const [data, setData] = useState<AlertaRioCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAlertaRioGeoJson();
        if (!cancelled) {
          setData(result ?? null);
          if (!result) setError('Dados AlertaRio indisponíveis');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar AlertaRio');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
