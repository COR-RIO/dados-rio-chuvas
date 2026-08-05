export type WindSource = 'inmet' | 'redemet';

/**
 * Corredores meteorológicos: os 3 primeiros alimentam o cinturão de ANTECEDÊNCIA (estações
 * fora do Rio); "interno" é a camada de CONFIRMAÇÃO (estações dentro do município).
 */
export type WindCorridor = 'oeste-sudoeste' | 'norte-noroeste' | 'costeiro' | 'interno';

export const WIND_CORRIDOR_LABELS: Record<WindCorridor, string> = {
  'oeste-sudoeste': 'Oeste/Sudoeste (São Paulo → Angra)',
  'norte-noroeste': 'Norte/Noroeste (Juiz de Fora → Petrópolis)',
  costeiro: 'Costeiro (Angra → Costa Verde)',
  interno: 'Interno (confirmação dentro do Rio)',
};

export interface WindStation {
  id: string;
  name: string;
  source: WindSource;
  /** Código INMET (ex.: A628) ou ICAO (ex.: SBGL). */
  code: string;
  corridor: WindCorridor;
  location: [number, number];
  /** Horário da observação, ISO 8601. */
  observedAt: string;
  windSpeedMs: number;
  windGustMs: number | null;
  /** Direção em graus (0-360), null quando variável ou indisponível. */
  windDirectionDeg: number | null;
  /** Mensagem/registro bruto de origem (METAR, linha do INMET), para depuração no popup. */
  raw?: string;
}

export interface WindLevel {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

/** Paleta alinhada à mesma linguagem de nível usada para chuva (RAIN_LEVEL_PALETTE). */
export const WIND_LEVEL_PALETTE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '#CCD2D8', // Calmo
  1: '#7EC9E8', // Atenção
  2: '#F2C744', // Forte
  3: '#E8792C', // Muito forte
  4: '#C6273A', // Severo
};

const WIND_LEVEL_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Calmo',
  1: 'Atenção',
  2: 'Forte',
  3: 'Muito forte',
  4: 'Severo',
};

/**
 * Nível de rajada em km/h → Nível 0-4 (linguagem de alerta operacional):
 * Calmo <20 | Atenção 20-40 | Forte 40-60 | Muito forte 60-80 | Severo 80+
 */
export function windLevelFromGustKmh(gustKmh: number): WindLevel {
  const n = Number(gustKmh);
  const level: 0 | 1 | 2 | 3 | 4 = n !== n || n < 20 ? 0 : n < 40 ? 1 : n < 60 ? 2 : n < 80 ? 3 : 4;
  return { level, label: WIND_LEVEL_LABELS[level], color: WIND_LEVEL_PALETTE[level] };
}

export const msToKmh = (ms: number): number => ms * 3.6;

/** Converte graus (0-360) para ponto cardeal (N, NE, L, SE, S, SO, O, NO). */
export function windDirectionToCardinal(deg: number | null): string {
  if (deg == null || Number.isNaN(deg)) return '—';
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

export interface CorridorSummary {
  corridor: WindCorridor;
  maxGustKmh: number;
  dominantDirectionDeg: number | null;
  level: WindLevel;
  trend: 'subindo' | 'estavel' | 'caindo';
  stationCount: number;
}

/**
 * Ponto de referência visual de cada corredor no mapa (não é uma estação real — as estações que
 * alimentam o corredor variam por fonte/disponibilidade). Aproximado a partir da geografia descrita
 * em WIND_CORRIDOR_LABELS, para posicionar o símbolo do cinturão de vento mesmo sem estações ativas.
 */
export const WIND_CORRIDOR_LOCATIONS: Record<WindCorridor, [number, number]> = {
  'oeste-sudoeste': [-23.0067, -44.3181], // Angra dos Reis — entrada do corredor São Paulo → Angra
  'norte-noroeste': [-22.5049, -43.1789], // Petrópolis — entrada do corredor Juiz de Fora → Petrópolis
  costeiro: [-23.2192, -44.7131], // Paraty — Costa Verde
  interno: [-22.9068, -43.3702], // Centro do cinturão interno (aeroportos/estações do Rio)
};
