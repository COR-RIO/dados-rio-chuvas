import { RainStation } from '../types/rain';

const API_URL = '/api/json/chuvas';

export const fetchRainData = async (): Promise<RainStation[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Extract the objects array from the response
    const stations = data.objects;
    
    // Ensure stations is an array
    if (!Array.isArray(stations)) {
      throw new Error('API response objects property is not an array');
    }
    
    // Filter only pluviometric stations and add id
    return stations
      .filter(station => station.kind === 'pluviometric')
      .map((station, index) => ({
        ...station,
        id: `station-${index}`
      }));
  } catch (error) {
    console.error('Erro ao buscar dados de chuva:', error);
    // Dados mockados para demonstração
    return [
      {
        id: '1',
        name: 'Copacabana',
        location: [-22.986389, -43.189444],
        read_at: new Date().toISOString(),
        is_new: true,
        data: {
          m05: 0,
          m15: 0,
          h01: 8.2,
          h02: 0,
          h03: 0,
          h04: 15.6,
          h24: 25.4,
          h96: 45.8,
          mes: 36.6
        }
      },
      {
        id: '2',
        name: 'Tijuca',
        location: [-22.931944, -43.221667],
        read_at: new Date().toISOString(),
        is_new: true,
        data: {
          m05: 0,
          m15: 0,
          h01: 2.1,
          h02: 0,
          h03: 0,
          h04: 4.5,
          h24: 8.9,
          h96: 18.2,
          mes: 52.8
        }
      },
      {
        id: '3',
        name: 'Barra/Barrinha',
        location: [-23.008486, -43.299653],
        read_at: new Date().toISOString(),
        is_new: true,
        data: {
          m05: 0,
          m15: 0,
          h01: 0.2,
          h02: 0,
          h03: 0,
          h04: 0.8,
          h24: 1.5,
          h96: 3.2,
          mes: 57.4
        }
      },
      {
        id: '4',
        name: 'Santa Teresa',
        location: [-22.931667, -43.196389],
        read_at: new Date().toISOString(),
        is_new: true,
        data: {
          m05: 0,
          m15: 15.8,
          h01: 28.4,
          h02: 0,
          h03: 0,
          h04: 42.1,
          h24: 68.9,
          h96: 95.6,
          mes: 49.0
        }
      }
    ];
  }
};