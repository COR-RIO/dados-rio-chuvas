export interface GeoFeature {
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

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

const GEO_API_URL = 'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/Limites_administrativos/MapServer/4/query?outFields=*&where=1%3D1&f=geojson';

export const fetchRioGeoData = async (): Promise<GeoCollection> => {
  try {
    const response = await fetch(GEO_API_URL);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados geográficos: ${response.status}`);
    }
    
    const data: GeoCollection = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados GeoJSON:', error);
    throw new Error('Falha ao carregar dados geográficos do Rio de Janeiro');
  }
};

// Função para encontrar bairro por nome (busca parcial)
export const findBairroByName = (geoData: GeoCollection, searchName: string): GeoFeature | null => {
  const normalizedSearch = searchName.toLowerCase().trim();
  
  return geoData.features.find(feature => {
    const nome = feature.properties.nome.toLowerCase();
    const regiao = feature.properties.regiao_adm.toLowerCase();
    
    return nome.includes(normalizedSearch) || 
           regiao.includes(normalizedSearch) ||
           normalizedSearch.includes(nome) ||
           normalizedSearch.includes(regiao);
  }) || null;
};

// Função para obter coordenadas centrais de um bairro
export const getBairroCenter = (feature: GeoFeature): [number, number] => {
  const coordinates = feature.geometry.coordinates[0][0];
  
  let sumLng = 0;
  let sumLat = 0;
  
  coordinates.forEach(coord => {
    sumLng += coord[0];
    sumLat += coord[1];
  });
  
  return [sumLng / coordinates.length, sumLat / coordinates.length];
};
