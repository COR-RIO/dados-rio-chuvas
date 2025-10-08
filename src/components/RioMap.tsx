import React from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';
import { useBairrosData } from '../hooks/useCitiesData';
import { findBairroByName, getBairroCenter, getCentroBairro, isValidCoordinate } from '../services/citiesApi';
import { LoadingSpinner } from './LoadingSpinner';
import { getBairroColor } from '../utils/bairroMapping';

interface RioMapProps {
  stations: RainStation[];
}

export const RioMap: React.FC<RioMapProps> = ({ stations }) => {
  const { bairrosData, loading, error } = useBairrosData();


  // Função para obter posição da estação no mapa
  const getStationPosition = (stationName: string): [number, number] => {
    // Primeiro tenta encontrar o bairro correspondente
    if (bairrosData) {
      const bairro = findBairroByName(bairrosData, stationName);
      if (bairro) {
        const coords = getBairroCenter(bairro);
        if (isValidCoordinate(coords)) {
          return coords;
        }
      }
    }
    
    // Coordenadas aproximadas para estações não encontradas
    const fallbackPositions: { [key: string]: [number, number] } = {
      'copacabana': [-43.1911, -22.9711],
      'ipanema': [-43.2075, -22.9844],
      'leblon': [-43.2250, -22.9889],
      'botafogo': [-43.1833, -22.9500],
      'flamengo': [-43.1750, -22.9333],
      'centro': [-43.1833, -22.9000],
      'lapa': [-43.1750, -22.9167],
      'tijuca': [-43.2333, -22.9167],
      'maracanã': [-43.2333, -22.9000],
      'barra': [-43.3667, -23.0000],
      'recreio': [-43.4500, -23.0167],
      'jacarepaguá': [-43.3167, -22.9500],
      'campo grande': [-43.5500, -22.9000],
      'bangu': [-43.4667, -22.8833],
      'ilha do governador': [-43.1333, -22.8000],
      'niterói': [-43.1000, -22.8833],
      'nova iguaçu': [-43.4500, -22.7500],
      'são gonçalo': [-43.0500, -22.8167],
      'duque de caxias': [-43.3000, -22.7833],
      'campos dos goytacazes': [-41.3000, -21.7500],
      'volta redonda': [-44.1000, -22.5167],
      'petrópolis': [-43.1833, -22.5167],
      'magé': [-43.1333, -22.6500],
      'itaboraí': [-42.8667, -22.7500]
    };

    const coords = fallbackPositions[stationName.toLowerCase()] || [-43.1833, -22.9000];
    
    // Validação final das coordenadas
    if (!isValidCoordinate(coords)) {
      console.warn(`Coordenadas inválidas para estação ${stationName}:`, coords);
      return [-43.1833, -22.9000]; // Coordenadas padrão do Rio de Janeiro
    }
    
    return coords;
  };

  if (loading) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa das Cidades do Rio de Janeiro</h3>
        <div className="h-96 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa das Cidades do Rio de Janeiro</h3>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 font-medium mb-2">Erro ao carregar mapa</p>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bairrosData) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado geográfico disponível</p>
        </div>
      </div>
    );
  }

  // Obter o bairro do Centro para destacar
  const centroBairro = getCentroBairro(bairrosData);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
      
      <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl overflow-hidden shadow-inner">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [-43.1833, -22.9000], // Centro do Rio de Janeiro
            scale: 200000, // Aumentado drasticamente para mostrar detalhes dos bairros
            rotate: [0, 0, 0]
          }}
          width={800}
          height={600}
          className="w-full h-full"
        >
          <Geographies geography={bairrosData}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const bairroName = geo.properties.nome;
                const isCentro = centroBairro && geo.properties.nome === centroBairro.properties.nome;
                const color = getBairroColor(bairroName, stations);
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={isCentro ? 1.5 : 0.5}
                    className="hover:opacity-90 transition-all duration-200 cursor-pointer"
                    style={{
                      default: {
                        fill: color,
                        stroke: '#ffffff',
                        strokeWidth: isCentro ? 1.5 : 0.5,
                        strokeOpacity: 0.8,
                      },
                      hover: {
                        fill: color,
                        stroke: '#ffffff',
                        strokeWidth: isCentro ? 2 : 1,
                        strokeOpacity: 1,
                        opacity: 0.9,
                        filter: 'brightness(1.1)',
                      },
                      pressed: {
                        fill: color,
                        stroke: '#ffffff',
                        strokeWidth: isCentro ? 2 : 1,
                        strokeOpacity: 1,
                        opacity: 0.8,
                        filter: 'brightness(0.95)',
                      },
                    }}
                  >
                    <title>{`${bairroName} - ${geo.properties.regiao_adm || 'RJ'}`}</title>
                  </Geography>
                );
              })
            }
          </Geographies>

          {/* Marcadores das estações */}
          {stations.map((station) => {
            const rainLevel = getRainLevel(station.data.h01);
            const [lng, lat] = getStationPosition(station.name);
            
            // Validação das coordenadas antes de renderizar
            if (!isValidCoordinate([lng, lat])) {
              console.warn(`Coordenadas inválidas para estação ${station.name}:`, [lng, lat]);
              return null;
            }

            return (
              <Marker key={station.id} coordinates={[lng, lat]}>
                <g>
                  {/* Sombra do círculo */}
                  <circle
                    r={4}
                    fill="rgba(0,0,0,0.2)"
                    transform="translate(1,1)"
                  />
                  {/* Círculo principal */}
                  <circle
                    r={4}
                    fill={rainLevel.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="hover:r-6 transition-all duration-200 cursor-pointer drop-shadow-lg"
                    style={{
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                    }}
                  >
                    <title>{`${station.name} - ${station.data.h01.toFixed(1)}mm (última hora)`}</title>
                  </circle>
                  {/* Ponto central */}
                  <circle
                    r={1}
                    fill="#ffffff"
                    opacity={0.9}
                  />
                </g>
              </Marker>
            );
          })}
        </ComposableMap>
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
          <p>• Passe o mouse sobre os bairros para ver detalhes</p>
          <p>• Círculos representam estações meteorológicas com dados em tempo real</p>
        <p>• Cores baseadas na intensidade de chuva da última hora</p>
          <p>• Dados geográficos da Prefeitura do Rio de Janeiro</p>
        </div>
      </div>
    </div>
  );
};