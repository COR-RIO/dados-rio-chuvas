/** Tipos para dados do AlertaRio (Estações / Áreas de influência) - GeoJSON */

export type AlertaRioGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface AlertaRioFeature {
  type: 'Feature';
  id?: number | string;
  geometry: AlertaRioGeometry;
  properties: Record<string, unknown> & {
    /** Nome da estação ou identificador da área */
    nome?: string;
    name?: string;
    /** Nível de chuva ou risco (0-4+) quando disponível no serviço */
    nivel?: number;
    level?: number;
    /** Código ou ID da estação */
    codigo?: string;
    OBJECTID?: number;
  };
}

export interface AlertaRioCollection {
  type: 'FeatureCollection';
  features: AlertaRioFeature[];
}

/** Níveis para mapa de área de influência (0 a 4+) - escala azul como na referência */
export const INFLUENCE_LEVELS = [
  { value: 0, label: '0', color: '#E0F2F7', min: 0, max: 0 },
  { value: 1, label: '1', color: '#7DD3FC', min: 0.2, max: 5 },
  { value: 2, label: '2', color: '#0EA5E9', min: 5.1, max: 25 },
  { value: 3, label: '3', color: '#0369A1', min: 25.1, max: 50 },
  { value: 4, label: '4+', color: '#0C4A6E', min: 50.1, max: null },
] as const;

export type InfluenceLevelValue = 0 | 1 | 2 | 3 | 4;

/**
 * Converte intensidade em mm/h para nível de influência 0-4.
 * Para janela de 15 min usa m15×4 (mm/15min → mm/h). Limites alinhados à legenda:
 *   0: [0, 0,2) mm/h  |  1: [0,2, 5]  |  2: (5, 25]  |  3: (25, 50]  |  4: >50
 */
export function rainfallToInfluenceLevel(mmh: number): InfluenceLevelValue {
  if (mmh < 0.2) return 0;
  if (mmh <= 5) return 1;
  if (mmh <= 25) return 2;
  if (mmh <= 50) return 3;
  return 4;
}
