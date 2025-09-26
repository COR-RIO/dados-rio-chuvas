import { RainStation } from '../types/rain';

const API_URL = '/api/json/chuvas';

export const fetchRainData = async (): Promise<RainStation[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Extract the chuvas array from the response object
    const stations = data.chuvas;
    
    // Ensure stations is an array
    if (!Array.isArray(stations)) {
      throw new Error('API response chuvas property is not an array');
    }
    
    return stations;
  } catch (error) {
    console.error('Erro ao buscar dados de chuva:', error);
    // Dados mockados para demonstração
    return [
      {
        id: '1',
        nome: 'Copacabana',
        bairro: 'Copacabana',
        estacao: 'EST001',
        chuva_15min: 2.5,
        chuva_1h: 8.2,
        chuva_4h: 15.6,
        chuva_24h: 25.4,
        chuva_96h: 45.8,
        ultima_atualizacao: new Date().toISOString()
      },
      {
        id: '2',
        nome: 'Tijuca',
        bairro: 'Tijuca',
        estacao: 'EST002',
        chuva_15min: 0.8,
        chuva_1h: 2.1,
        chuva_4h: 4.5,
        chuva_24h: 8.9,
        chuva_96h: 18.2,
        ultima_atualizacao: new Date().toISOString()
      },
      {
        id: '3',
        nome: 'Barra da Tijuca',
        bairro: 'Barra da Tijuca',
        estacao: 'EST003',
        chuva_15min: 0.0,
        chuva_1h: 0.2,
        chuva_4h: 0.8,
        chuva_24h: 1.5,
        chuva_96h: 3.2,
        ultima_atualizacao: new Date().toISOString()
      },
      {
        id: '4',
        nome: 'Centro',
        bairro: 'Centro',
        estacao: 'EST004',
        chuva_15min: 15.8,
        chuva_1h: 28.4,
        chuva_4h: 42.1,
        chuva_24h: 68.9,
        chuva_96h: 95.6,
        ultima_atualizacao: new Date().toISOString()
      }
    ];
  }
};