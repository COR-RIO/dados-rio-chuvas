import type { InfluenceLevelValue } from '../types/alertaRio';

export type MapVisualType = 'rua' | 'satelite' | 'escuro' | 'terreno';

/** Legenda dos hexágonos: critério oficial em 15 min (mm/15min) – Termos Meteorológicos */
const LEVEL_TEXT: Record<InfluenceLevelValue, string> = {
  0: 'Sem chuva (0,0 mm/15min)',
  1: 'Fraca (<1,25 mm/15min)',
  2: 'Moderada (1,25–6,25 mm/15min)',
  3: 'Forte (6,25–12,5 mm/15min)',
  4: 'Muito forte (>12,5 mm/15min)',
};

/** Degradê oficial 5 níveis para área de abrangência (15 min) */
const HEX_LEVEL_COLORS: Record<InfluenceLevelValue, string> = {
  0: '#eceded',
  1: '#42b9eb',
  2: '#2f90be',
  3: '#2a688f',
  4: '#13335a',
};

const PALETTES: Record<MapVisualType, Record<InfluenceLevelValue, string>> = {
  rua: HEX_LEVEL_COLORS,
  satelite: HEX_LEVEL_COLORS,
  escuro: HEX_LEVEL_COLORS,
  terreno: HEX_LEVEL_COLORS,
};

/** Paleta fixa da legenda do mapa. Hexágonos usam o degradê oficial (15 min). */
const LEGEND_PALETTE: Record<InfluenceLevelValue, string> = HEX_LEVEL_COLORS;

export function getInfluenceLegendItems(_mapType?: MapVisualType): Array<{
  value: InfluenceLevelValue;
  label: string;
  color: string;
}> {
  return (Object.keys(LEVEL_TEXT) as unknown as InfluenceLevelValue[]).map((v) => ({
    value: v,
    label: LEVEL_TEXT[v],
    color: LEGEND_PALETTE[v],
  }));
}

export function getInfluenceColor(level: InfluenceLevelValue, _mapType?: MapVisualType): string {
  const l = Math.min(4, Math.max(0, Math.floor(Number(level)))) as InfluenceLevelValue;
  return LEGEND_PALETTE[l] ?? LEGEND_PALETTE[0];
}

/** Contorno dos hexágonos mais visível para não confundir áreas de estações diferentes (linha azul bem visível). */
const HEX_STROKE_WEIGHT = 1.7;
const HEX_STROKE_OPACITY = 1;

export function getHexOverlayTuning(
  mapType: MapVisualType,
  resolution: number
): {
  strokeColor: string;
  strokeOpacity: number;
  weight: number;
  fillOpacity: number;
} {
  const base =
    resolution <= 7
      ? { weight: 1.15, fillOpacity: 0.95 }
      : resolution === 8
        ? { weight: 0.9, fillOpacity: 0.92 }
        : { weight: 0.65, fillOpacity: 0.9 };

  if (mapType === 'escuro') {
    return {
      strokeColor: '#93C5FD',
      strokeOpacity: HEX_STROKE_OPACITY,
      weight: HEX_STROKE_WEIGHT,
      fillOpacity: 0.98,
    };
  }

  if (mapType === 'satelite') {
    return {
      strokeColor: '#60A5FA',
      strokeOpacity: HEX_STROKE_OPACITY,
      weight: HEX_STROKE_WEIGHT,
      fillOpacity: 0.96,
    };
  }

  if (mapType === 'terreno') {
    return {
      strokeColor: '#3B82F6',
      strokeOpacity: HEX_STROKE_OPACITY,
      weight: HEX_STROKE_WEIGHT,
      fillOpacity: 0.96,
    };
  }

  return {
    strokeColor: '#1d4ed8',
    strokeOpacity: HEX_STROKE_OPACITY,
    weight: HEX_STROKE_WEIGHT,
    fillOpacity: 0.95,
  };
}

