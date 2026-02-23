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

/** Níveis para chuva acumulada no período (mm). Mesma paleta: Sem Chuva | Fraca | Moderada | Forte | Muito Forte. */
export const accumulatedRainLevels: RainLevel[] = [
  { name: 'sem chuva', description: '0 mm', min: 0, max: 0, color: RAIN_LEVEL_PALETTE[0], bgColor: 'bg-gray-200' },
  { name: 'fraca', description: '< 25,4 mm', min: 0.1, max: 25.39, color: RAIN_LEVEL_PALETTE[1], bgColor: 'bg-blue-600' },
  { name: 'moderada', description: '25,4 – 47,0 mm', min: 25.4, max: 46.99, color: RAIN_LEVEL_PALETTE[2], bgColor: 'bg-blue-500' },
  { name: 'forte', description: '47,0 – 69,2 mm', min: 47.0, max: 69.19, color: RAIN_LEVEL_PALETTE[3], bgColor: 'bg-blue-700' },
  { name: 'muito forte', description: '> 69,2 mm', min: 69.2, max: null, color: RAIN_LEVEL_PALETTE[4], bgColor: 'bg-blue-900' },
];

/** Retorna nível e cor para chuva acumulada (mm) no período – critério Estágio 3. */
export const getAccumulatedRainLevel = (accumulatedMm: number): RainLevel => {
  const n = Number(accumulatedMm);
  if (n !== n || n <= 0) return accumulatedRainLevels[0];
  if (n < 25.4) return accumulatedRainLevels[1];
  if (n < 47.0) return accumulatedRainLevels[2];
  if (n < 69.2) return accumulatedRainLevels[3];
  return accumulatedRainLevels[4];
};

/** Converte mm acumulados em nível 0–4 para hexágonos – critério Estágio 3 (< 25,4 | 25,4–47 | 47–69,2 | > 69,2). */
export function accumulatedMmToInfluenceLevel(mm: number): 0 | 1 | 2 | 3 | 4 {
  const n = Number(mm);
  if (n !== n || n <= 0) return 0;
  if (n < 25.4) return 1;
  if (n < 47.0) return 2;
  if (n < 69.2) return 3;
  return 4;
}