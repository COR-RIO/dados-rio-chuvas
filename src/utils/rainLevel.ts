import { RainLevel } from '../types/rain';

/** Cores alinhadas à legenda do mapa (gradiente azul: Sem chuva → Muito forte) */
const LEGEND_COLORS = ['#E0F2F7', '#7DD3FC', '#0EA5E9', '#0369A1', '#0C4A6E'] as const;
const LEGEND_BG = ['bg-sky-50', 'bg-sky-200', 'bg-sky-400', 'bg-sky-600', 'bg-sky-800'] as const;

export const rainLevels: RainLevel[] = [
  {
    name: 'sem chuva',
    description: '0 mm',
    min: 0,
    max: 0,
    color: LEGEND_COLORS[0],
    bgColor: LEGEND_BG[0]
  },
  {
    name: 'chuva fraca',
    description: '0,2 a 5,0mm/h',
    min: 0.2,
    max: 5.0,
    color: LEGEND_COLORS[1],
    bgColor: LEGEND_BG[1]
  },
  {
    name: 'chuva moderada',
    description: '5,1 a 25,0mm/h',
    min: 5.1,
    max: 25.0,
    color: LEGEND_COLORS[2],
    bgColor: LEGEND_BG[2]
  },
  {
    name: 'chuva forte',
    description: '25,1 a 50,0mm/h',
    min: 25.1,
    max: 50.0,
    color: LEGEND_COLORS[3],
    bgColor: LEGEND_BG[3]
  },
  {
    name: 'chuva muito forte',
    description: 'Acima de 50,0mm/h',
    min: 50.1,
    max: null,
    color: LEGEND_COLORS[4],
    bgColor: LEGEND_BG[4]
  }
];

export const getRainLevel = (rainfall: number): RainLevel => {
  // Tratar valores de erro ou inválidos (como -99.99)
  if (rainfall < 0 || rainfall === -99.99) {
    return rainLevels[0]; // sem chuva
  }
  
  // Tratar caso especial de 0mm
  if (rainfall === 0) {
    return rainLevels[0]; // sem chuva
  }
  
  // Buscar o nível apropriado baseado nos novos parâmetros
  for (const level of rainLevels) {
    if (level.max === null && rainfall >= level.min) {
      return level;
    }
    if (level.max !== null && rainfall >= level.min && rainfall <= level.max) {
      return level;
    }
  }
  
  // Se não encontrar nenhum nível, retornar o mais alto (chuva muito forte)
  return rainLevels[rainLevels.length - 1];
};