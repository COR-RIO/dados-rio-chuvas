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

/** Níveis para área de abrangência (hexágonos) – 15 min. Mesma paleta. */
export const INFLUENCE_LEVELS = [
  { value: 0, label: '0', color: '#E0F2FE', min: 0, max: 0 },
  { value: 1, label: '1', color: '#60A5FA', min: 0.01, max: 1.24 },
  { value: 2, label: '2', color: '#42b9eb', min: 1.25, max: 6.25 },
  { value: 3, label: '3', color: '#2f90be', min: 6.25, max: 12.5 },
  { value: 4, label: '4+', color: '#13335a', min: 12.51, max: null },
] as const;

export type InfluenceLevelValue = 0 | 1 | 2 | 3 | 4;

/**
 * Converte chuva em 15 min (mm/15min) para nível de influência 0-4.
 * Critério oficial: Sem chuva 0 | Fraca <1,25 | Moderada 1,25–6,25 | Forte 6,25–12,5 | Muito forte >12,5
 */
export function rainfallToInfluenceLevel15min(mm15: number): InfluenceLevelValue {
  const n = Number(mm15);
  if (n !== n || n <= 0) return 0;
  if (n < 1.25) return 1;
  if (n <= 6.25) return 2;
  if (n <= 12.5) return 3;
  return 4;
}

/**
 * Converte chuva em 1 hora (mm/h) para nível de influência 0-4.
 * Critério oficial 1h: Sem chuva 0 | Fraca <5 | Moderada 5–25 | Forte 25,1–50 | Muito forte >50 (Termos Meteorológicos)
 */
export function rainfallToInfluenceLevel1h(mmh: number): InfluenceLevelValue {
  const n = Number(mmh);
  if (n !== n || n <= 0) return 0;
  if (n < 5) return 1;
  if (n <= 25) return 2;
  if (n <= 50) return 3;
  return 4;
}
