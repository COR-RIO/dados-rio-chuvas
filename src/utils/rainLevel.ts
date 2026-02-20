import { RainLevel } from '../types/rain';

/**
 * Cores das BOLINHAS (e tabela): sempre chuva de 1 HORA (h01).
 * Paleta fixa: verde → azul claro → amarelo → laranja → vermelho.
 * NÃO trocar por cores azuis; o degradê azul é só para hexágonos (15 min) em influenceTheme.
 */
export const rainLevels: RainLevel[] = [
  { name: 'sem chuva', description: '0,0 mm/h', min: 0, max: 0, color: '#1FCC70', bgColor: 'bg-emerald-100' },
  { name: 'chuva fraca', description: '< 5,0 mm/h', min: 0.01, max: 4.99, color: '#61BBFF', bgColor: 'bg-blue-200' },
  { name: 'chuva moderada', description: '5,0 – 25,0 mm/h', min: 5.0, max: 25.0, color: '#EAF000', bgColor: 'bg-yellow-200' },
  { name: 'chuva forte', description: '25,1 – 50,0 mm/h', min: 25.1, max: 50.0, color: '#FEA600', bgColor: 'bg-orange-200' },
  { name: 'chuva muito forte', description: '> 50,0 mm/h', min: 50.1, max: null, color: '#EE0000', bgColor: 'bg-red-200' },
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

/** Níveis para chuva acumulada no período (mm). Critério Debriefing Estágio 3. */
export const accumulatedRainLevels: RainLevel[] = [
  { name: 'sem chuva', description: '0 mm', min: 0, max: 0, color: '#eceded', bgColor: 'bg-gray-100' },
  { name: 'nível 1', description: '< 25,4 mm', min: 0.1, max: 25.39, color: '#42b9eb', bgColor: 'bg-blue-100' },
  { name: 'nível 2', description: '25,4 – 47,0 mm', min: 25.4, max: 46.99, color: '#2f90be', bgColor: 'bg-blue-200' },
  { name: 'nível 3', description: '47,0 – 69,2 mm', min: 47.0, max: 69.19, color: '#2a688f', bgColor: 'bg-blue-300' },
  { name: 'nível 4', description: '> 69,2 mm', min: 69.2, max: null, color: '#13335a', bgColor: 'bg-blue-400' },
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