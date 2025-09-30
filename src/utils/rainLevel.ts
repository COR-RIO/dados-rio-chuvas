import { RainLevel } from '../types/rain';

export const rainLevels: RainLevel[] = [
  {
    name: 'sem chuva',
    description: '0 mm',
    min: 0,
    max: 0,
    color: '#1FCC70',
    bgColor: 'bg-emerald-100'
  },
  {
    name: 'chuva fraca',
    description: '0,2 a 5,0mm/h',
    min: 0.2,
    max: 5.0,
    color: '#61BBFF',
    bgColor: 'bg-blue-200'
  },
  {
    name: 'chuva moderada',
    description: '5,1 a 25,0mm/h',
    min: 5.1,
    max: 25.0,
    color: '#EAF000',
    bgColor: 'bg-yellow-200'
  },
  {
    name: 'chuva forte',
    description: '25,1 a 50,0mm/h',
    min: 25.1,
    max: 50.0,
    color: '#FEA600',
    bgColor: 'bg-orange-200'
  },
  {
    name: 'chuva muito forte',
    description: 'Acima de 50,0mm/h',
    min: 50.1,
    max: null,
    color: '#EE0000',
    bgColor: 'bg-red-200'
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