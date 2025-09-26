import { RainLevel } from '../types/rain';

export const rainLevels: RainLevel[] = [
  {
    name: 'sem chuva',
    description: '0 mm',
    min: 0,
    max: 0,
    color: '#10B981',
    bgColor: 'bg-emerald-100'
  },
  {
    name: 'chuva fraca',
    description: '< 1,25mm',
    min: 0.01,
    max: 1.25,
    color: '#059669',
    bgColor: 'bg-emerald-200'
  },
  {
    name: 'chuva moderada',
    description: '1,25 a 6,25mm',
    min: 1.25,
    max: 6.25,
    color: '#F59E0B',
    bgColor: 'bg-amber-200'
  },
  {
    name: 'chuva forte',
    description: '6,25 a 12,25mm',
    min: 6.25,
    max: 12.25,
    color: '#F97316',
    bgColor: 'bg-orange-200'
  },
  {
    name: 'chuva muito forte',
    description: '> 12,25mm',
    min: 12.25,
    max: null,
    color: '#DC2626',
    bgColor: 'bg-red-200'
  }
];

export const getRainLevel = (rainfall: number): RainLevel => {
  for (const level of rainLevels) {
    if (level.max === null && rainfall >= level.min) {
      return level;
    }
    if (level.max !== null && rainfall >= level.min && rainfall < level.max) {
      return level;
    }
  }
  return rainLevels[0]; // sem chuva
};