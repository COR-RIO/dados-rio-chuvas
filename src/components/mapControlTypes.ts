/** Dados exibidos no mapa: só 15min, só 1h, ou ambas as camadas */
export type MapDataWindow = '15min' | '1h' | 'both';

/** No modo histórico: mostrar snapshot no horário ou acumulado no período */
export type HistoricalViewMode = 'instant' | 'accumulated';

export type MapTypeId = 'rua' | 'satelite' | 'escuro' | 'terreno';

export const MAP_TYPES: Array<{
  id: MapTypeId;
  label: string;
  url: string;
  attribution: string;
}> = [
  {
    id: 'rua',
    label: 'Rua',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'satelite',
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    id: 'escuro',
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'terreno',
    label: 'Terreno',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
];

/** Dados GeoJSON compatíveis para cálculo de bounds (bairros ou zonas pluviométricas). */
export type BoundsGeoJson = {
  features: Array<{ geometry: { coordinates: number[][] | number[][][] | number[][][][] } }>;
} | null;
