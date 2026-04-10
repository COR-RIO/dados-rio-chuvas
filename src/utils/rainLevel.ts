import { RainLevel } from '../types/rain';

/**
 * Paleta única para 15 min, 1 h e acumulado.
 */
/** Paleta do padrão visual (Sem chuva | Baixo | Moderado | Alto | Muito alto). */
export const RAIN_LEVEL_PALETTE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '#CCD2D8',  // Sem chuva
  1: '#7EC9E8',  // Baixo (fraca)
  2: '#42B9EB',  // Moderado
  3: '#2C85B2',  // Alto
  4: '#13335A',  // Muito alto
};

/**
 * Cores das BOLINHAS (e tabela): chuva de 1 HORA (h01). Mesma paleta para 15 min, 1h e acumulado.
 */
export const rainLevels: RainLevel[] = [
  { name: 'sem chuva', description: '0,0 mm/h', min: 0, max: 0, color: RAIN_LEVEL_PALETTE[0], bgColor: 'bg-gray-200' },
  { name: 'chuva fraca', description: '< 5,0 mm/h', min: 0.01, max: 4.99, color: RAIN_LEVEL_PALETTE[1], bgColor: 'bg-blue-600' },
  { name: 'chuva moderada', description: '5,0 – 25,0 mm/h', min: 5.0, max: 25.0, color: RAIN_LEVEL_PALETTE[2], bgColor: 'bg-blue-500' },
  { name: 'chuva forte', description: '25,1 – 50,0 mm/h', min: 25.1, max: 50.0, color: RAIN_LEVEL_PALETTE[3], bgColor: 'bg-blue-700' },
  { name: 'chuva muito forte', description: '> 50,0 mm/h', min: 50.1, max: null, color: RAIN_LEVEL_PALETTE[4], bgColor: 'bg-blue-900' },
];

/** Critério oficial 1h: Sem chuva 0 | Fraca <5 | Moderada 5–25 | Forte 25,1–50 | Muito forte >50 (mm/h) */
export const getRainLevel = (rainfall: number): RainLevel => {
  const n = Number(rainfall);
  if (n !== n || n < 0 || n === -99.99) return rainLevels[0];
  if (n === 0) return rainLevels[0];
  if (n < 5) return rainLevels[1];
  if (n <= 25) return rainLevels[2];
  if (n <= 50) return rainLevels[3];
  return rainLevels[4];
};

/**
 * Chuva acumulada no período (mm) — fraca / moderada / forte / muito forte (mesma paleta).
 * Fraca: até 7 | Moderada: 7,1–16 | Forte: 16,1–26 | Muito forte: acima de 26
 * Limites numéricos contínuos: (0,7], (7,16], (16,26], >26.
 */
export const accumulatedRainLevels: RainLevel[] = [
  { name: 'sem chuva', description: '0 mm', min: 0, max: 0, color: RAIN_LEVEL_PALETTE[0], bgColor: 'bg-gray-200' },
  { name: 'fraca', description: 'até 7 mm', min: 0.01, max: 7, color: RAIN_LEVEL_PALETTE[1], bgColor: 'bg-blue-600' },
  { name: 'moderada', description: '7,1 – 16 mm', min: 7.01, max: 16, color: RAIN_LEVEL_PALETTE[2], bgColor: 'bg-blue-500' },
  { name: 'forte', description: '16,1 – 26 mm', min: 16.01, max: 26, color: RAIN_LEVEL_PALETTE[3], bgColor: 'bg-blue-700' },
  { name: 'muito forte', description: '> 26 mm', min: 26.01, max: null, color: RAIN_LEVEL_PALETTE[4], bgColor: 'bg-blue-900' },
];

/** Retorna nível e cor para chuva acumulada (mm) no período — fraca / moderada / forte / muito forte. */
export const getAccumulatedRainLevel = (accumulatedMm: number): RainLevel => {
  const n = Number(accumulatedMm);
  if (n !== n || n <= 0) return accumulatedRainLevels[0];
  if (n <= 7) return accumulatedRainLevels[1];
  if (n <= 16) return accumulatedRainLevels[2];
  if (n <= 26) return accumulatedRainLevels[3];
  return accumulatedRainLevels[4];
};

/** Converte mm acumulados em nível 0–4 para zonas/hexágonos (fraca…muito forte). */
export function accumulatedMmToInfluenceLevel(mm: number): 0 | 1 | 2 | 3 | 4 {
  const n = Number(mm);
  if (n !== n || n <= 0) return 0;
  if (n <= 7) return 1;
  if (n <= 16) return 2;
  if (n <= 26) return 3;
  return 4;
}