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
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
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

     // Debug: Listar todos os bairros relacionados à Ilha do Governador e São Cristóvão
     console.log('🏝️ Bairros relacionados à Ilha do Governador:');
     console.log('⛪ Bairros relacionados à São Cristóvão:');
     bairrosData.features.forEach((feature: any) => {
       const nome = feature.properties.nome;
       const nomeLower = nome.toLowerCase();
       if (nomeLower.includes('ilha') || nomeLower.includes('governador') || 
           nomeLower.includes('galeão') || nomeLower.includes('galeao') ||
           nomeLower.includes('tauá') || nomeLower.includes('taua') ||
           nomeLower.includes('valente') || nomeLower.includes('cocotá') ||
           nomeLower.includes('cocota') || nomeLower.includes('moneró') ||
           nomeLower.includes('monero') || nomeLower.includes('pitangueiras') ||
           nomeLower.includes('zumbi') || nomeLower.includes('cacuia') ||
           nomeLower.includes('freguesia') || nomeLower.includes('banco') ||
           nomeLower.includes('guanabara') || nomeLower.includes('portuguesa') ||
           nomeLower.includes('carioca') || nomeLower.includes('ribeira') ||
           nomeLower.includes('bandeira') || nomeLower.includes('praia') ||
           nomeLower.includes('bancários') || nomeLower.includes('bancarios')) {
         console.log(`  - "${nome}"`);
       }
       if (nomeLower.includes('são cristóvão') || nomeLower.includes('sao cristovao') ||
           nomeLower.includes('cristóvão') || nomeLower.includes('cristovao') ||
           nomeLower.includes('cristovão') || nomeLower.includes('cristóvao')) {
         console.log(`  - "${nome}"`);
       }
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
        'santa teresa': ['santa teresa'],
        'teresa': ['santa teresa'],
        'tijuca': ['tijuca', 'maracanã', 'vila isabel', 'tijuca/muda'],
        'grajaú': ['grajaú'],
        'alto da boa vista': ['alto da boa vista'],
        'barra': ['barra', 'recreio', 'recreio dos bandeirantes', 'barra/barrinha', 'barra/riocentro'],
        'jacarepaguá': ['jacarepaguá', 'jacarepaguá/tanque', 'jacarepaguá/cidade de deus'],
        'campo grande': ['campo grande'],
        'bangu': ['bangu'],
        'santa cruz': ['santa cruz'],
        'sepetiba': ['sepetiba'],
         'Ilha do governador': ['Ilha do governador', 'galeão'],
         'ilha do governador': ['Ilha do governador', 'galeão'],
         'ilha governador': ['Ilha do governador', 'galeão'],
         'governador': ['Ilha do governador', 'galeão'],
         'galeão': ['Ilha do governador', 'galeão'],
         'galeao': ['Ilha do governador', 'galeão'],
         'tauá': ['Ilha do governador', 'galeão'],
         'taua': ['Ilha do governador', 'galeão'],
         'ponte valente': ['Ilha do governador', 'galeão'],
         'valente': ['Ilha do governador', 'galeão'],
         'banco de areia': ['Ilha do governador', 'galeão'],
         'cocotá': ['Ilha do governador', 'galeão'],
         'cocota': ['Ilha do governador', 'galeão'],
         'moneró': ['Ilha do governador', 'galeão'],
         'monero': ['Ilha do governador', 'galeão'],
         'pitangueiras': ['Ilha do governador', 'galeão'],
         'zumbi': ['Ilha do governador', 'galeão'],
         'cacuia': ['Ilha do governador', 'galeão'],
         'freguesia': ['Ilha do governador', 'galeão'],
         'freguesia da ilha': ['Ilha do governador', 'galeão'],
         'jardim guanabara': ['Ilha do governador', 'galeão'],
         'guanabara': ['Ilha do governador', 'galeão'],
         'portuguesa': ['Ilha do governador', 'galeão'],
         'jardim carioca': ['Ilha do governador', 'galeão'],
         'carioca': ['Ilha do governador', 'galeão'],
         'ribeira': ['Ilha do governador', 'galeão'],
         'ribeira da ilha': ['Ilha do governador', 'galeão'],
         'ribeira do governador': ['Ilha do governador', 'galeão'],
         'praia da bandeira': ['Ilha do governador', 'galeão'],
         'bandeira': ['Ilha do governador', 'galeão'],
         'praia do cocotá': ['Ilha do governador', 'galeão'],
         'praia do zumbi': ['Ilha do governador', 'galeão'],
         'praia da freguesia': ['Ilha do governador', 'galeão'],
         'praia do moneró': ['Ilha do governador', 'galeão'],
         'praia do monero': ['Ilha do governador', 'galeão'],
         'praia do tauá': ['Ilha do governador', 'galeão'],
         'praia do taua': ['Ilha do governador', 'galeão'],
         'praia do cacuia': ['Ilha do governador', 'galeão'],
         'praia do pitangueiras': ['Ilha do governador', 'galeão'],
         'praia do banco de areia': ['Ilha do governador', 'galeão'],
         'praia da ponte valente': ['Ilha do governador', 'galeão'],
         'praia do galeão': ['Ilha do governador', 'galeão'],
         'praia do galeao': ['Ilha do governador', 'galeão'],
         'praia da ilha do governador': ['Ilha do governador', 'galeão'],
         'praia da ilha governador': ['Ilha do governador', 'galeão'],
         'praia do governador': ['Ilha do governador', 'galeão'],
         'praia da portuguesa': ['Ilha do governador', 'galeão'],
         'praia do jardim guanabara': ['Ilha do governador', 'galeão'],
         'praia do jardim carioca': ['Ilha do governador', 'galeão'],
         'praia da ribeira': ['Ilha do governador', 'galeão'],
         'bancários': ['Ilha do governador', 'galeão'],
         'bancarios': ['Ilha do governador', 'galeão'],
         'praia dos bancários': ['Ilha do governador', 'galeão'],
         'praia dos bancarios': ['Ilha do governador', 'galeão'],
        'penha': ['penha'],
        'madureira': ['madureira'],
        'irajá': ['irajá'],
        'são cristóvão': ['são cristóvão'],
        'sao cristovao': ['são cristóvão'],
        'cristóvão': ['são cristóvão'],
        'cristovao': ['são cristóvão'],
        'são cristovão': ['são cristóvão'],
        'sao cristóvão': ['são cristóvão'],
        'são cristovao': ['são cristóvão'],
        'cristovão': ['são cristóvão'],
        'cristóvao': ['são cristóvão'],
        'grande méier': ['grande méier'],
        'anchieta': ['anchieta'],
        'grota funda': ['grota funda'],
        'grota': ['grota funda'],
        'av. brasil/mendanha': ['av. brasil/mendanha'],
        'piedade': ['piedade'],
        'vidigal': ['vidigal'],
        'rocinha': ['rocinha'],
        'urca': ['urca'],
        'saúde': ['saúde'],
        'jardim botânico': ['jardim botânico'],
        'guaratiba': ['guaratiba'],
        'est. grajaú/jacarepaguá': ['est. grajaú/jacarepaguá'],
        // Adicionar variações comuns de nomes de bairros
        'méier': ['grande méier'],
        'méier grande': ['grande méier'],
        'barra da tijuca': ['barra', 'barra/barrinha', 'barra/riocentro'],
        'recreio': ['recreio dos bandeirantes'],
        'bandeirantes': ['recreio dos bandeirantes'],
        'cidade de deus': ['jacarepaguá/cidade de deus'],
        'tanque': ['jacarepaguá/tanque'],
        'riocentro': ['barra/riocentro'],
        'barrinha': ['barra/barrinha'],
        'estação grajaú': ['est. grajaú/jacarepaguá'],
        'estação jacarepaguá': ['est. grajaú/jacarepaguá'],
        'brasil mendanha': ['av. brasil/mendanha'],
        'avenida brasil': ['av. brasil/mendanha'],
        'botânico': ['jardim botânico'],
        'jardim': ['jardim botânico']
      };

      const bairroKey = bairroName.toLowerCase();
      const possibleStations = stationToBairroMap[bairroKey] || [];
      
       // Busca principal com múltiplas estratégias
       let station = stations.find(station => 
         possibleStations.some(searchStationName => {
           const stationNameLower = station.name.toLowerCase();
           const searchNameLower = searchStationName.toLowerCase();
          
          // Normalizar acentos e caracteres especiais
          const normalize = (str: string) => str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[ç]/g, 'c')
            .replace(/[ã]/g, 'a')
            .replace(/[õ]/g, 'o')
            .replace(/[áàâãä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòôõö]/g, 'o')
            .replace(/[úùûü]/g, 'u');
          
          const stationNormalized = normalize(stationNameLower);
          const searchNormalized = normalize(searchNameLower);
          
          // Busca exata
          if (stationNormalized === searchNormalized) return true;
          
          // Busca por inclusão
          if (stationNormalized.includes(searchNormalized)) return true;
          if (searchNormalized.includes(stationNormalized)) return true;
          
          // Busca por palavras-chave (para casos como "Jacarepaguá/Tanque" -> "jacarepaguá")
          const stationWords = stationNormalized.split(/[\s\/\-_]+/);
          const searchWords = searchNormalized.split(/[\s\/\-_]+/);
          
          return stationWords.some(word => 
            searchWords.some(searchWord => 
              word.includes(searchWord) || searchWord.includes(word)
            )
          );
        })
      );
      
      // Se não encontrou, tentar busca mais agressiva para Ilha do Governador e São Cristóvão
      if (!station && (bairroKey.includes('ilha') || bairroKey.includes('governador') || 
          bairroKey.includes('galeão') || bairroKey.includes('galeao') ||
          bairroKey.includes('tauá') || bairroKey.includes('taua') ||
          bairroKey.includes('valente') || bairroKey.includes('cocotá') ||
          bairroKey.includes('cocota') || bairroKey.includes('moneró') ||
          bairroKey.includes('monero') || bairroKey.includes('pitangueiras') ||
          bairroKey.includes('zumbi') || bairroKey.includes('cacuia') ||
          bairroKey.includes('freguesia') || bairroKey.includes('banco') ||
          bairroKey.includes('guanabara') || bairroKey.includes('portuguesa') ||
          bairroKey.includes('carioca') || bairroKey.includes('ribeira') ||
          bairroKey.includes('bandeira') || bairroKey.includes('praia') ||
          bairroKey.includes('bancários') || bairroKey.includes('bancarios'))) {
        station = stations.find(s => {
          const stationName = s.name.toLowerCase();
          return stationName.includes('ilha') && stationName.includes('governador');
        });
      }
      
      // Busca agressiva para São Cristóvão
      if (!station && (bairroKey.includes('são cristóvão') || bairroKey.includes('sao cristovao') ||
          bairroKey.includes('cristóvão') || bairroKey.includes('cristovao') ||
          bairroKey.includes('cristovão') || bairroKey.includes('cristóvao'))) {
        station = stations.find(s => {
          const stationName = s.name.toLowerCase();
          return stationName.includes('são') && stationName.includes('cristóvão');
        });
      }
      
       // Debug específico para Ilha do Governador e São Cristóvão
       if (bairroKey.includes('ilha') || bairroKey.includes('governador') || 
           bairroKey.includes('galeão') || bairroKey.includes('galeao') ||
           bairroKey.includes('tauá') || bairroKey.includes('taua') ||
           bairroKey.includes('valente') || bairroKey.includes('cocotá') ||
           bairroKey.includes('cocota') || bairroKey.includes('moneró') ||
           bairroKey.includes('monero') || bairroKey.includes('pitangueiras') ||
           bairroKey.includes('zumbi') || bairroKey.includes('cacuia') ||
           bairroKey.includes('freguesia') || bairroKey.includes('banco') ||
           bairroKey.includes('guanabara') || bairroKey.includes('portuguesa') ||
           bairroKey.includes('carioca') || bairroKey.includes('ribeira') ||
           bairroKey.includes('bandeira') || bairroKey.includes('praia') ||
           bairroKey.includes('bancários') || bairroKey.includes('bancarios') ||
           bairroKey.includes('são cristóvão') || bairroKey.includes('sao cristovao') ||
           bairroKey.includes('cristóvão') || bairroKey.includes('cristovao') ||
           bairroKey.includes('cristovão') || bairroKey.includes('cristóvao')) {
         console.log(`🏝️⛪ Debug Ilha do Governador / São Cristóvão:`);
         console.log(`   Bairro original: "${bairroName}"`);
         console.log(`   Bairro key: "${bairroKey}"`);
         console.log(`   Possíveis estações: [${possibleStations.join(', ')}]`);
         console.log(`   Estação encontrada: ${station ? `"${station.name}"` : 'NENHUMA'}`);
         
         if (station) {
           console.log(`   ✅ Estação encontrada: "${station.name}"`);
           console.log(`   📊 Dados h24: ${station.data.h24}mm`);
           console.log(`   🎨 Cor aplicada: ${getRainLevel(station.data.h24).color}`);
         } else {
           console.log(`   ❌ Nenhuma estação encontrada`);
         }
       }
      
      if (!station) {
        console.log(`❌ Nenhuma estação encontrada para bairro: ${bairroName}`);
        console.log(`   Possíveis estações: [${possibleStations.join(', ')}]`);
        console.log(`   Estações disponíveis: [${stations.map(s => s.name).join(', ')}]`);
        
        // Debug específico para bairros problemáticos
        if (bairroKey.includes('ilha') || bairroKey.includes('governador') || 
            bairroKey.includes('são cristóvão') || bairroKey.includes('sao cristovao') ||
            bairroKey.includes('grota funda') || bairroKey.includes('santa teresa')) {
          console.log(`🔍 Debug específico para ${bairroName}:`);
          console.log(`   Bairro key: "${bairroKey}"`);
          console.log(`   Possíveis estações: [${possibleStations.join(', ')}]`);
          stations.forEach(s => {
            const stationLower = s.name.toLowerCase();
            if (stationLower.includes('ilha') || stationLower.includes('governador') ||
                stationLower.includes('são cristóvão') || stationLower.includes('sao cristovao') ||
                stationLower.includes('grota funda') || stationLower.includes('santa teresa')) {
              console.log(`   Estação encontrada: "${s.name}"`);
            }
          });
        }
        
        return '#F8FAFC'; // Cinza claro para bairros sem dados
      }
      
      const rainLevel = getRainLevel(station.data.h24);
      
      return rainLevel.color;
    };

    // Criar polígonos dos bairros
    bairrosData.features.forEach((feature: any) => {
      const bairroName = feature.properties.nome;
       
       // Debug específico para Ilha do Governador e São Cristóvão
       const bairroLower = bairroName.toLowerCase();
       if (bairroLower.includes('ilha') || bairroLower.includes('governador') || 
           bairroLower.includes('galeão') || bairroLower.includes('galeao') ||
           bairroLower.includes('tauá') || bairroLower.includes('taua') ||
           bairroLower.includes('valente') || bairroLower.includes('cocotá') ||
           bairroLower.includes('cocota') || bairroLower.includes('moneró') ||
           bairroLower.includes('monero') || bairroLower.includes('pitangueiras') ||
           bairroLower.includes('zumbi') || bairroLower.includes('cacuia') ||
           bairroLower.includes('freguesia') || bairroLower.includes('banco') ||
           bairroLower.includes('guanabara') || bairroLower.includes('portuguesa') ||
           bairroLower.includes('carioca') || bairroLower.includes('ribeira') ||
           bairroLower.includes('bandeira') || bairroLower.includes('praia') ||
           bairroLower.includes('bancários') || bairroLower.includes('bancarios') ||
           bairroLower.includes('são cristóvão') || bairroLower.includes('sao cristovao') ||
           bairroLower.includes('cristóvão') || bairroLower.includes('cristovao') ||
           bairroLower.includes('cristovão') || bairroLower.includes('cristóvao')) {
         console.log(`🏝️⛪ Bairro encontrado: "${bairroName}"`);
       }
       
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
          // Fechar tooltip ativo anterior
          if (activeInfoWindowRef.current) {
            activeInfoWindowRef.current.close();
          }
          
           // Definir posição baseada no polígono
          infoWindow.setPosition(polygon.getPath().getAt(0));
          infoWindow.open(map);
          
          // Armazenar referência do tooltip ativo
          activeInfoWindowRef.current = infoWindow;
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
        // Fechar tooltip ativo anterior
        if (activeInfoWindowRef.current) {
          activeInfoWindowRef.current.close();
        }
        
        infoWindow.open(map, marker);
        
        // Armazenar referência do tooltip ativo
        activeInfoWindowRef.current = infoWindow;
      });
    });

  }, [stations, bairrosData, isGoogleMapsLoaded]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Limpar polígonos e marcadores quando o componente for desmontado
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close();
        activeInfoWindowRef.current = null;
      }
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
             <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#1FCC70'}}></div>
              <span>Sem chuva (0mm)</span>
            </div>
            <div className="flex items-center gap-1">
             <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#61BBFF'}}></div>
             <span>Chuva fraca (0,2-5,0mm/h)</span>
            </div>
            <div className="flex items-center gap-1">
             <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#EAF000'}}></div>
             <span>Chuva moderada (5,1-25,0mm/h)</span>
            </div>
            <div className="flex items-center gap-1">
             <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#FEA600'}}></div>
             <span>Chuva forte (25,1-50,0mm/h)</span>
            </div>
            <div className="flex items-center gap-1">
             <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#EE0000'}}></div>
             <span>Chuva muito forte ({'>'}50,0mm/h)</span>
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
            <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#1FCC70'}}></div>
            <span>Sem chuva (0mm)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#61BBFF'}}></div>
            <span>Chuva fraca (0,2-5,0mm/h)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#EAF000'}}></div>
            <span>Chuva moderada (5,1-25,0mm/h)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#FEA600'}}></div>
            <span>Chuva forte (25,1-50,0mm/h)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-white" style={{backgroundColor: '#EE0000'}}></div>
            <span>Chuva muito forte ({'>'}50,0mm/h)</span>
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