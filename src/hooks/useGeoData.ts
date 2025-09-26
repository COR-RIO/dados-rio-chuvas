import { useState, useEffect } from 'react';
import { GeoCollection, fetchRioGeoData } from '../services/geoApi';

export const useGeoData = () => {
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGeoData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRioGeoData();
        setGeoData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    loadGeoData();
  }, []);

  return { geoData, loading, error };
};
