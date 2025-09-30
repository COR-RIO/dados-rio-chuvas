import { RainStation } from '../types/rain';

// URL da API da Prefeitura do Rio de Janeiro
const RIO_RAIN_API_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';

// Interface para a resposta da API
interface RioRainApiResponse {
  objects: Array<{
    kind: string;
    read_at: string;
    name: string;
    is_new: boolean;
    location: [number, number];
    data: {
      m05: number;
      m15: number;
      mes: number;
      h96: number;
      h24: number;
      h03: number;
      h02: number;
      h01: number;
      h04: number;
    };
  }>;
}

export const fetchRainData = async (): Promise<RainStation[]> => {
  try {
    console.log('Buscando dados de chuva em tempo real da Prefeitura do Rio...');
    console.log('URL da API:', RIO_RAIN_API_URL);
    
    const response = await fetch(RIO_RAIN_API_URL, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Adiciona cache busting para garantir dados atualizados
      cache: 'no-cache'
    });

    console.log('Status da resposta:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Erro na API da Prefeitura do Rio: ${response.status} - ${response.statusText}`);
    }

    const data: RioRainApiResponse = await response.json();
    console.log('Dados brutos recebidos:', data);
    
    // Validação da estrutura da resposta
    if (!data.objects || !Array.isArray(data.objects)) {
      console.error('Estrutura de dados inválida:', data);
      throw new Error('Resposta da API não contém dados válidos');
    }

    console.log(`Dados carregados: ${data.objects.length} estações meteorológicas`);

    // Filtra apenas estações pluviométricas e converte para o formato interno
    const stations: RainStation[] = data.objects
      .filter(station => station.kind === 'pluviometric')
      .map((station, index) => ({
        id: `rio-${station.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
        name: station.name,
        location: station.location,
        read_at: station.read_at,
        is_new: station.is_new,
        data: {
          m05: station.data.m05 || 0,
          m15: station.data.m15 || 0,
          h01: station.data.h01 || 0,
          h02: station.data.h02 || 0,
          h03: station.data.h03 || 0,
          h04: station.data.h04 || 0,
          h24: station.data.h24 || 0,
          h96: station.data.h96 || 0,
          mes: station.data.mes || 0
        }
      }));

    if (stations.length === 0) {
      throw new Error('Nenhuma estação pluviométrica encontrada nos dados');
    }

    console.log(`Processadas ${stations.length} estações pluviométricas`);
    return stations;

  } catch (error) {
    console.error('Erro ao buscar dados de chuva da API da Prefeitura:', error);
    
    // Em caso de erro, retorna array vazio para evitar quebrar a aplicação
    return [];
  }
};

// Função para verificar se a API está disponível
export const checkApiAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch(RIO_RAIN_API_URL, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache'
    });
    
    return response.ok;
  } catch (error) {
    console.warn('API da Prefeitura do Rio não disponível:', error);
    return false;
  }
};

// Função para obter informações sobre a última atualização
export const getLastUpdateInfo = async (): Promise<{ lastUpdate: Date | null; totalStations: number }> => {
  try {
    const stations = await fetchRainData();
    if (stations.length === 0) {
      return { lastUpdate: null, totalStations: 0 };
    }

    // Pega a data mais recente entre todas as estações
    const lastUpdate = new Date(Math.max(...stations.map(s => new Date(s.read_at).getTime())));
    return { lastUpdate, totalStations: stations.length };
  } catch (error) {
    console.error('Erro ao obter informações da última atualização:', error);
    return { lastUpdate: null, totalStations: 0 };
  }
};