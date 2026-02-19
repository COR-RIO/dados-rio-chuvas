import type { InfluenceLevelValue } from '../types/alertaRio';

export type MapVisualType = 'rua' | 'satelite' | 'escuro' | 'terreno';

const LEVEL_TEXT: Record<InfluenceLevelValue, string> = {
  0: 'Sem chuva (0,0 mm/h)',
  1: 'Fraca (0,2-5,0 mm/h)',
  2: 'Moderada (5,1-25,0 mm/h)',
  3: 'Forte (25,1-50,0 mm/h)',
  4: 'Muito forte (>50,0 mm/h)',
};

const PALETTES: Record<MapVisualType, Record<InfluenceLevelValue, string>> = {
  rua: {
    0: '#E0F2F7',
    1: '#7DD3FC',
    2: '#0EA5E9',
    3: '#0369A1',
    4: '#0C4A6E',
  },
  satelite: {
    0: '#EAF8FF',
    1: '#63D1FF',
    2: '#1EA7FF',
    3: '#0078C8',
    4: '#005B9A',
  },
  escuro: {
    0: '#BFDBFE',
    1: '#93C5FD',
    2: '#60A5FA',
    3: '#3B82F6',
    4: '#2563EB',
  },
  terreno: {
    0: '#E6F4FB',
    1: '#8FD9FF',
    2: '#22AEEB',
    3: '#0A75B8',
    4: '#0C4A6E',
  },
};

/** Paleta fixa da legenda do mapa. Hexágonos sempre usam esta paleta para não haver falha de cor. */
const LEGEND_PALETTE: Record<InfluenceLevelValue, string> = PALETTES.rua;

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
      ? { weight: 1.15, fillOpacity: 0.8 }
      : resolution === 8
        ? { weight: 0.9, fillOpacity: 0.75 }
        : { weight: 0.65, fillOpacity: 0.68 };

  if (mapType === 'escuro') {
    return {
      strokeColor: '#E2E8F0',
      strokeOpacity: 0.8,
      weight: base.weight,
      fillOpacity: Math.min(0.9, base.fillOpacity + 0.12),
    };
  }

  if (mapType === 'satelite') {
    return {
      strokeColor: '#1F2937',
      strokeOpacity: 0.5,
      weight: base.weight,
      fillOpacity: Math.min(0.9, base.fillOpacity + 0.08),
    };
  }

  if (mapType === 'terreno') {
    return {
      strokeColor: '#F8FAFC',
      strokeOpacity: 0.9,
      weight: base.weight,
      fillOpacity: Math.min(0.9, base.fillOpacity + 0.04),
    };
  }

  return {
    strokeColor: '#FFFFFF',
    strokeOpacity: 0.9,
    weight: base.weight,
    fillOpacity: base.fillOpacity,
  };
}

