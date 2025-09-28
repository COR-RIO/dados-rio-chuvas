import React, { useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';
import { useBairrosData } from '../hooks/useCitiesData';
import { LoadingSpinner } from './LoadingSpinner';

interface GoogleMapProps {
  stations: RainStation[];
}

// Função para obter configuração do mapa
const getMapOptions = (): google.maps.MapOptions => ({
  center: { lat: -22.9000, lng: -43.1833 }, // Centro do Rio de Janeiro
  zoom: 11,
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  styles: [
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#a0c8f0' }]
    },
    {
      featureType: 'landscape',
      elementType: 'geometry',
      stylers: [{ color: '#f5f5f5' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#ffffff' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
});

// Componente do mapa
const MapComponent: React.FC<{ stations: RainStation[]; bairrosData: any }> = ({ stations, bairrosData }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = React.useState(false);

  // Verificar se o Google Maps está carregado
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !bairrosData || !isGoogleMapsLoaded) return;

    // Debug: Log das estações disponíveis
    console.log('🗺️ Inicializando mapa com dados:');
    console.log('  - Estações disponíveis:', stations.length);
    stations.forEach(station => {
      console.log(`  - ${station.name}: h01=${station.data.h01}mm, h24=${station.data.h24}mm`);
    });

    // Verificar se o elemento existe e é válido
    const mapElement = mapRef.current;
    if (!mapElement || !(mapElement instanceof Element)) return;

    // Inicializar o mapa
    const map = new google.maps.Map(mapElement, getMapOptions());
    mapInstanceRef.current = map;

    // Limpar polígonos e marcadores anteriores
    polygonsRef.current.forEach(polygon => polygon.setMap(null));
    markersRef.current.forEach(marker => marker.setMap(null));
    polygonsRef.current = [];
    markersRef.current = [];

    // Função para obter cor do bairro baseada nas estações
    const getBairroColor = (bairroName: string) => {
      const stationToBairroMap: { [key: string]: string[] } = {
        'copacabana': ['copacabana'],
        'ipanema': ['ipanema'],
        'leblon': ['leblon'],
        'botafogo': ['botafogo'],
        'flamengo': ['flamengo'],
        'laranjeiras': ['laranjeiras'],
        'centro': ['centro', 'lapa', 'santa teresa'],
        'tijuca': ['tijuca', 'maracanã', 'vila isabel', 'tijuca/muda'],
        'grajaú': ['grajaú'],
        'alto da boa vista': ['alto da boa vista'],
        'barra': ['barra', 'recreio', 'recreio dos bandeirantes'],
        'jacarepaguá': ['jacarepaguá'],
        'campo grande': ['campo grande'],
        'bangu': ['bangu'],
        'santa cruz': ['santa cruz'],
        'sepetiba': ['sepetiba'],
        'ilha do governador': ['ilha do governador', 'galeão'],
        'penha': ['penha'],
        'madureira': ['madureira'],
        'irajá': ['irajá'],
        'são cristóvão': ['são cristóvão'],
        'grande méier': ['grande méier'],
        'anchieta': ['anchieta'],
        'grota funda': ['grota funda'],
        'av. brasil/mendanha': ['av. brasil/mendanha'],
        'piedade': ['piedade'],
        'vidigal': ['vidigal'],
        'rocinha': ['rocinha'],
        'urca': ['urca']
      };

      const bairroKey = bairroName.toLowerCase();
      const possibleStations = stationToBairroMap[bairroKey] || [];
      
      // Debug para Copacabana
      if (bairroKey === 'copacabana') {
        console.log('🔍 Debug Copacabana:');
        console.log('  - Bairro:', bairroName);
        console.log('  - Possíveis estações:', possibleStations);
        console.log('  - Todas as estações disponíveis:', stations.map(s => s.name));
        console.log('  - Estação Copacabana encontrada:', stations.find(s => s.name.toLowerCase().includes('copacabana')));
      }
      
      const station = stations.find(station => 
        possibleStations.some(stationName => 
          station.name.toLowerCase().includes(stationName.toLowerCase())
        )
      );
      
      if (!station) {
        if (bairroKey === 'copacabana') {
          console.log('  - ❌ Nenhuma estação encontrada para Copacabana');
        }
        return '#F8FAFC'; // Cinza claro para bairros sem dados
      }
      
      const rainLevel = getRainLevel(station.data.h24);
      
      if (bairroKey === 'copacabana') {
        console.log('  - ✅ Estação encontrada:', station.name);
        console.log('  - Dados h24 (24h):', station.data.h24);
        console.log('  - Nível de chuva:', rainLevel.name);
        console.log('  - Cor aplicada:', rainLevel.color);
      }
      
      return rainLevel.color;
    };

    // Criar polígonos dos bairros
    bairrosData.features.forEach((feature: any) => {
      const bairroName = feature.properties.nome;
      const color = getBairroColor(bairroName);
      
      // Converter coordenadas para o formato do Google Maps
      const paths: google.maps.LatLng[] = [];
      
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates[0][0].forEach((coord: number[]) => {
          paths.push(new google.maps.LatLng(coord[1], coord[0])); // Inverter lat/lng
        });
      } else if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates[0].forEach((coord: number[]) => {
          paths.push(new google.maps.LatLng(coord[1], coord[0])); // Inverter lat/lng
        });
      }

      if (paths.length > 0) {
        const polygon = new google.maps.Polygon({
          paths: paths,
          strokeColor: '#ffffff',
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.7,
          clickable: true
        });

        polygon.setMap(map);
        polygonsRef.current.push(polygon);

        // Adicionar tooltip
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: Arial, sans-serif;">
              <h3 style="margin: 0 0 4px 0; font-size: 14px; color: #333;">${bairroName}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">${feature.properties.regiao_adm || 'RJ'}</p>
            </div>
          `
        });

        polygon.addListener('click', () => {
          infoWindow.setPosition(polygon.getPath().getAt(0));
          infoWindow.open(map);
        });
      }
    });

    // Criar marcadores das estações
    stations.forEach((station) => {
      const rainLevel = getRainLevel(station.data.h24);
      
      const marker = new google.maps.Marker({
        position: { lat: station.location[0], lng: station.location[1] },
        map: map,
        title: `${station.name} - ${station.data.h24.toFixed(1)}mm (24h)`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: rainLevel.color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      markersRef.current.push(marker);

      // Adicionar tooltip
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">${station.name}</h3>
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 12px; height: 12px; background-color: ${rainLevel.color}; border-radius: 50%; margin-right: 8px;"></div>
              <span style="font-size: 14px; color: #666;">${rainLevel.name}</span>
            </div>
            <p style="margin: 4px 0; font-size: 14px; color: #333;">
              <strong>Última hora:</strong> ${station.data.h01.toFixed(1)}mm
            </p>
            <p style="margin: 4px 0; font-size: 14px; color: #333;">
              <strong>Últimas 24h:</strong> ${station.data.h24.toFixed(1)}mm
            </p>
            <p style="margin: 4px 0; font-size: 14px; color: #333;">
              <strong>Este mês:</strong> ${station.data.mes.toFixed(1)}mm
            </p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">
              Atualizado: ${new Date(station.read_at).toLocaleString('pt-BR')}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });

  }, [stations, bairrosData, isGoogleMapsLoaded]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Limpar polígonos e marcadores quando o componente for desmontado
      polygonsRef.current.forEach(polygon => polygon.setMap(null));
      markersRef.current.forEach(marker => marker.setMap(null));
    };
  }, []);

  if (!isGoogleMapsLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

// Componente de loading
const LoadingComponent: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <LoadingSpinner />
  </div>
);

// Componente de erro
const ErrorComponent: React.FC<{ status: Status }> = ({ status }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-red-600 font-medium mb-2">Erro ao carregar mapa</p>
      <p className="text-gray-500 text-sm">Status: {status}</p>
    </div>
  </div>
);

// Componente principal
export const GoogleMap: React.FC<GoogleMapProps> = ({ stations }) => {
  const { bairrosData, loading, error } = useBairrosData();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  // Se não há chave da API, mostra mensagem informativa
  if (!apiKey || apiKey === 'DEMO_KEY') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
        
        <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🗺️</div>
            <h4 className="text-xl font-semibold text-gray-700 mb-2">Mapa Indisponível</h4>
            <p className="text-gray-600 mb-4">
              Para visualizar o mapa interativo, configure sua chave da API do Google Maps.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Como configurar:</strong>
              </p>
              <ol className="text-sm text-yellow-700 space-y-1">
                <li>1. Obtenha uma chave da API no Google Cloud Console</li>
                <li>2. Crie um arquivo <code className="bg-yellow-100 px-1 rounded">.env.local</code></li>
                <li>3. Adicione: <code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY=sua_chave</code></li>
                <li>4. Reinicie o servidor de desenvolvimento</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300"></div>
              <span>Bairros sem dados</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white"></div>
              <span>Sem chuva (0mm)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-emerald-600 border border-white"></div>
              <span>Chuva fraca (&lt;1,25mm)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-white"></div>
              <span>Chuva moderada (1,25-6,25mm)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500 border border-white"></div>
              <span>Chuva forte (6,25-12,25mm)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600 border border-white"></div>
              <span>Chuva muito forte ({'>'}12,25mm)</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Configure a chave da API do Google Maps para ver o mapa interativo</p>
            <p>• Consulte o arquivo GOOGLE_MAPS_SETUP.md para instruções detalhadas</p>
          </div>
        </div>
      </div>
    );
  }

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent status={status} />;
      case Status.SUCCESS:
        if (loading) {
          return <LoadingComponent />;
        }
        if (error || !bairrosData) {
          return <ErrorComponent status={Status.FAILURE} />;
        }
        return <MapComponent stations={stations} bairrosData={bairrosData} />;
      default:
        return <LoadingComponent />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
      
      <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl overflow-hidden shadow-inner">
        <Wrapper
          apiKey={apiKey}
          render={render}
          libraries={['geometry']}
        />
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300"></div>
            <span>Bairros sem dados</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white"></div>
            <span>Sem chuva (0mm)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-600 border border-white"></div>
            <span>Chuva fraca (&lt;1,25mm)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500 border border-white"></div>
            <span>Chuva moderada (1,25-6,25mm)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-white"></div>
            <span>Chuva forte (6,25-12,25mm)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-600 border border-white"></div>
            <span>Chuva muito forte (&gt;12,25mm)</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Clique nos bairros para ver detalhes</p>
          <p>• Círculos representam estações meteorológicas com dados em tempo real</p>
          <p>• Cores baseadas na intensidade de chuva das últimas 24 horas</p>
          <p>• Dados geográficos da Prefeitura do Rio de Janeiro</p>
          <p>• Mapa: Google Maps</p>
        </div>
      </div>
    </div>
  );
};