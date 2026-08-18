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
  /** Tipo do METAR (REDEMET only) — SPECI é relatório especial, emitido só quando há mudança
   * significativa nas condições; é o sinal usado para disparar alerta automático de vento. */
  messageType?: 'METAR' | 'SPECI';
  /** Mensagem/registro bruto de origem (METAR, linha do INMET), para depuração no popup. */
  raw?: string;
}

/**
 * Categorias oficiais de intensidade do vento (fraco/moderado/forte/muito forte), com os
 * limites exatos em km/h, m/s e nós usados na referência operacional do COR. Fonte única tanto
 * para o filtro de marcadores no mapa quanto para a cor/rótulo de nível dos ícones e do resumo
 * por corredor (WindLevel abaixo é só uma view numerada dessas mesmas categorias).
 */
export type WindCategory = 'fraco' | 'moderado' | 'forte' | 'muito-forte';

export const WIND_CATEGORY_ORDER: WindCategory[] = ['fraco', 'moderado', 'forte', 'muito-forte'];

export const WIND_CATEGORY_LABELS: Record<WindCategory, string> = {
  fraco: 'Fraco',
  moderado: 'Moderado',
  forte: 'Forte',
  'muito-forte': 'Muito forte',
};

export const WIND_CATEGORY_COLORS: Record<WindCategory, string> = {
  fraco: '#7EC9E8',
  moderado: '#F2C744',
  forte: '#E8792C',
  'muito-forte': '#C6273A',
};

/** Limites de cada categoria, em km/h, m/s e nós — igual à tabela oficial de referência. */
export const WIND_CATEGORY_RANGES: Record<
  WindCategory,
  { kmh: string; ms: string; kt: string }
> = {
  fraco: { kmh: 'até 18,4 km/h', ms: 'até 5,1 m/s', kt: 'até 10 kt' },
  moderado: { kmh: '18,5 a 51,9 km/h', ms: '5,2 a 14,4 m/s', kt: '10,1 a 28 kt' },
  forte: { kmh: '52 a 75,9 km/h', ms: '14,5 a 21 m/s', kt: '28,1 a 40,9 kt' },
  'muito-forte': { kmh: 'igual/acima de 76 km/h', ms: 'igual/acima de 21,1 m/s', kt: 'igual/acima de 41 kt' },
};

/** Classifica uma velocidade/rajada (km/h) nas categorias oficiais fraco/moderado/forte/muito forte. */
export function windCategoryFromSpeedKmh(kmh: number): WindCategory {
  const n = Number(kmh);
  if (!(n > 18.4)) return 'fraco';
  if (n <= 51.9) return 'moderado';
  if (n <= 75.9) return 'forte';
  return 'muito-forte';
}

export interface WindLevel {
  level: 0 | 1 | 2 | 3;
  category: WindCategory;
  label: string;
  color: string;
}

/** Nível (cor/rótulo) de uma rajada em km/h, derivado das mesmas categorias oficiais acima. */
export function windLevelFromGustKmh(gustKmh: number): WindLevel {
  const category = windCategoryFromSpeedKmh(gustKmh);
  const level = WIND_CATEGORY_ORDER.indexOf(category) as 0 | 1 | 2 | 3;
  return { level, category, label: WIND_CATEGORY_LABELS[category], color: WIND_CATEGORY_COLORS[category] };
}

export const msToKmh = (ms: number): number => ms * 3.6;

/** Estação em vento forte ou muito-forte agora — mesmo limiar que dispara alerta (>=52 km/h de
 * rajada/velocidade). Usado tanto pra filtrar a tabela quanto pra decidir o que entra no rodízio
 * automático de foco do mapa (WindSpotlight). */
export function isSignificantWindStation(station: Pick<WindStation, 'windGustMs' | 'windSpeedMs'>): boolean {
  const category = windCategoryFromSpeedKmh(msToKmh(station.windGustMs ?? station.windSpeedMs));
  return category === 'forte' || category === 'muito-forte';
}

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
  /** Estação real que reportou o maxGustKmh acima — dá contexto de corredor no popup dessa
   * estação (WindBeltLayer), em vez de um marcador de resumo à parte. */
  station: Pick<WindStation, 'id' | 'name' | 'code' | 'source' | 'location'> | null;
}
