import type { AlertaRioCollection } from '../types/alertaRio';

const ALERTA_RIO_URL =
  'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/1/query?outFields=*&where=1%3D1&f=geojson';

export async function fetchAlertaRioGeoJson(): Promise<AlertaRioCollection | null> {
  try {
    const response = await fetch(ALERTA_RIO_URL, {
      method: 'GET',
      mode: 'cors',
      headers: { Accept: 'application/geo+json, application/json' },
      cache: 'default',
    });

    if (!response.ok) {
      console.warn('AlertaRio API status:', response.status);
      return null;
    }

    const data: AlertaRioCollection = await response.json();
    if (!data?.features?.length) {
      console.warn('AlertaRio API retornou sem features');
      return null;
    }

    return data;
  } catch (err) {
    console.warn('Erro ao buscar AlertaRio GeoJSON:', err);
    return null;
  }
}
