export interface BairroFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
  properties: {
    objectid: number;
    nome: string;
    regiao_adm: string;
    area_plane: string;
    codbairro: string;
    codra: number;
    codbnum: number;
    link: string;
    rp: string;
    cod_rp: string;
    codbairro_long: number;
    st_area: number;
    st_perimeter: number;
  };
}

export interface BairroCollection {
  type: 'FeatureCollection';
  features: BairroFeature[];
}

// URL do GeoJSON da Prefeitura do Rio de Janeiro
const RIO_GEOJSON_URL = 'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/Limites_administrativos/MapServer/4/query?outFields=*&where=1%3D1&f=geojson';

// Dados estáticos como fallback (caso a API não esteja disponível)
const RIO_BAIRROS_FALLBACK: BairroCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[
          [-43.4, -22.8], [-43.2, -22.8], [-43.2, -23.0], [-43.4, -23.0], [-43.4, -22.8]
        ]]]
      },
      properties: {
        objectid: 1,
        nome: 'Centro',
        regiao_adm: 'CENTRO',
        area_plane: '1',
        codbairro: '001',
        codra: 1,
        codbnum: 1,
        link: 'Centro &area=1',
        rp: 'Centro',
        cod_rp: '1.1',
        codbairro_long: 1,
        st_area: 1000000,
        st_perimeter: 4000
      }
    }
  ]
};

// Função para buscar dados dos bairros do Rio de Janeiro
export const fetchRioBairrosData = async (): Promise<BairroCollection> => {
  try {
    console.log('Buscando dados do GeoJSON da Prefeitura do Rio...');
    const response = await fetch(RIO_GEOJSON_URL);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados dos bairros: ${response.status}`);
    }
    
    const data: BairroCollection = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('Nenhum bairro encontrado nos dados');
    }
    
    console.log(`Dados carregados: ${data.features.length} bairros`);
    return data;
  } catch (error) {
    console.warn('Erro ao buscar dados da API, usando fallback:', error);
    return RIO_BAIRROS_FALLBACK;
  }
};

// Função para encontrar bairro por nome (busca parcial)
export const findBairroByName = (bairroData: BairroCollection, searchName: string): BairroFeature | null => {
  const normalizedSearch = searchName.toLowerCase().trim();
  
  return bairroData.features.find(feature => {
    const nome = feature.properties.nome.toLowerCase();
    const regiao = feature.properties.regiao_adm.toLowerCase();
    
    return nome.includes(normalizedSearch) || 
           regiao.includes(normalizedSearch) ||
           normalizedSearch.includes(nome) ||
           normalizedSearch.includes(regiao);
  }) || null;
};

// Função para obter coordenadas centrais de um bairro
export const getBairroCenter = (feature: BairroFeature): [number, number] => {
  // Para MultiPolygon, pega o primeiro polígono
  const coordinates = feature.geometry.coordinates[0][0];
  
  let sumLng = 0;
  let sumLat = 0;
  
  coordinates.forEach(coord => {
    sumLng += coord[0];
    sumLat += coord[1];
  });
  
  return [sumLng / coordinates.length, sumLat / coordinates.length];
};

// Função para obter apenas o bairro do Centro (como referência)
export const getCentroBairro = (bairroData: BairroCollection): BairroFeature | null => {
  return bairroData.features.find(feature => 
    feature.properties.nome.toLowerCase().includes('centro') ||
    feature.properties.regiao_adm.toLowerCase().includes('centro')
  ) || null;
};

// Função para validar coordenadas
export const isValidCoordinate = (coord: [number, number]): boolean => {
  return !isNaN(coord[0]) && !isNaN(coord[1]) && 
         isFinite(coord[0]) && isFinite(coord[1]) &&
         coord[0] !== 0 && coord[1] !== 0;
};

// Função para obter todos os bairros de uma região administrativa
export const getBairrosByRegiao = (bairroData: BairroCollection, regiao: string): BairroFeature[] => {
  return bairroData.features.filter(feature => 
    feature.properties.regiao_adm.toLowerCase().includes(regiao.toLowerCase())
  );
};

// Função para obter estatísticas dos bairros
export const getBairrosStats = (bairroData: BairroCollection) => {
  const totalBairros = bairroData.features.length;
  const regioes = [...new Set(bairroData.features.map(f => f.properties.regiao_adm))];
  
  return {
    totalBairros,
    totalRegioes: regioes.length,
    regioes: regioes.sort()
  };
};

// --- Zonas Pluviométricas (GeoJSON do KML) ---

export interface ZonaPluvFeature {
  type: 'Feature';
  properties: {
    objectid: number;
    name: string;
    endereço?: string;
    est?: string;
    cod: number;
    Shape__Area?: number;
    Shape__Length?: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface ZonasPluvCollection {
  type: 'FeatureCollection';
  features: ZonaPluvFeature[];
}

// Carregado de data/ via Vite (?url copia para dist e devolve a URL)
import zonasPluvGeojsonUrl from '../../data/zonas-pluviometricas.geojson?url';

export const fetchZonasPluvData = async (): Promise<ZonasPluvCollection> => {
  const response = await fetch(zonasPluvGeojsonUrl);
  if (!response.ok) {
    throw new Error(`Erro ao carregar zonas pluviométricas: ${response.status}`);
  }
  const data: ZonasPluvCollection = await response.json();
  if (!data.features?.length) {
    throw new Error('Nenhuma zona pluviométrica encontrada');
  }
  return data;
};