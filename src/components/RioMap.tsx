import React from 'react';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';

interface RioMapProps {
  stations: RainStation[];
}

export const RioMap: React.FC<RioMapProps> = ({ stations }) => {
  // Função para obter a cor da região baseada nas estações próximas
  const getRegionColor = (regionStations: string[]) => {
    const regionData = stations.filter(station => 
      regionStations.some(name => 
        station.name.toLowerCase().includes(name.toLowerCase())
      )
    );
    
    if (regionData.length === 0) return '#E5E7EB'; // Cinza padrão
    
    // Pega a maior intensidade de chuva da região
    const maxRainfall = Math.max(...regionData.map(s => s.data.h01));
    const rainLevel = getRainLevel(maxRainfall);
    return rainLevel.color;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa do Rio de Janeiro</h3>
      
      <div className="relative w-full h-96 bg-blue-50 rounded-xl overflow-hidden">
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Zona Norte */}
          <path
            d="M150 80 L450 80 L480 120 L460 180 L400 200 L350 190 L300 170 L200 150 L150 120 Z"
            fill={getRegionColor(['tijuca', 'maracanã', 'vila isabel', 'grajaú', 'andaraí'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Zona Norte - Tijuca, Maracanã, Vila Isabel</title>
          </path>

          {/* Centro */}
          <path
            d="M300 170 L400 200 L420 250 L380 280 L320 270 L280 250 L270 200 Z"
            fill={getRegionColor(['centro', 'lapa', 'santa teresa', 'cidade nova'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Centro - Lapa, Santa Teresa, Cidade Nova</title>
          </path>

          {/* Zona Sul */}
          <path
            d="M280 250 L380 280 L400 350 L380 420 L320 450 L250 430 L220 380 L240 320 Z"
            fill={getRegionColor(['copacabana', 'ipanema', 'leblon', 'botafogo', 'flamengo', 'urca'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Zona Sul - Copacabana, Ipanema, Leblon, Botafogo</title>
          </path>

          {/* Barra da Tijuca */}
          <path
            d="M50 300 L220 380 L250 430 L200 480 L120 500 L60 450 L40 380 Z"
            fill={getRegionColor(['barra', 'recreio', 'jacarepaguá', 'cidade de deus'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Barra da Tijuca - Recreio, Jacarepaguá</title>
          </path>

          {/* Zona Oeste */}
          <path
            d="M480 120 L650 100 L680 150 L670 220 L620 250 L550 240 L500 200 L460 180 Z"
            fill={getRegionColor(['campo grande', 'santa cruz', 'bangu', 'realengo'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Zona Oeste - Campo Grande, Santa Cruz, Bangu</title>
          </path>

          {/* Baixada Fluminense (parte) */}
          <path
            d="M420 250 L550 240 L580 300 L550 350 L480 360 L450 320 L440 280 Z"
            fill={getRegionColor(['deodoro', 'ricardo de albuquerque', 'irajá'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Subúrbios - Deodoro, Irajá</title>
          </path>

          {/* Ilha do Governador */}
          <circle
            cx="500"
            cy="180"
            r="25"
            fill={getRegionColor(['ilha do governador', 'galeão'])}
            stroke="#fff"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <title>Ilha do Governador</title>
          </circle>

          {/* Pontos das estações */}
          {stations.map((station, index) => {
            const rainLevel = getRainLevel(station.data.h01);
            // Posições aproximadas baseadas nos bairros
            const positions: { [key: string]: { x: number; y: number } } = {
              'copacabana': { x: 320, y: 380 },
              'ipanema': { x: 300, y: 390 },
              'leblon': { x: 280, y: 400 },
              'botafogo': { x: 340, y: 350 },
              'flamengo': { x: 330, y: 330 },
              'centro': { x: 350, y: 230 },
              'lapa': { x: 320, y: 240 },
              'tijuca': { x: 380, y: 140 },
              'maracanã': { x: 400, y: 160 },
              'barra': { x: 150, y: 420 },
              'recreio': { x: 100, y: 450 },
              'jacarepaguá': { x: 180, y: 350 },
              'campo grande': { x: 580, y: 180 },
              'bangu': { x: 520, y: 160 },
              'ilha do governador': { x: 500, y: 180 }
            };

            const position = positions[station.name.toLowerCase()] || 
                           { x: 400, y: 300 };

            return (
              <circle
                key={station.id}
                cx={position.x}
                cy={position.y}
                r="6"
                fill={rainLevel.color}
                stroke="#fff"
                strokeWidth="2"
                className="hover:r-8 transition-all cursor-pointer"
              >
                <title>{`${station.name} - ${station.data.h01.toFixed(1)}mm`}</title>
              </circle>
            );
          })}

          {/* Labels das regiões */}
          <text x="300" y="130" textAnchor="middle" className="fill-gray-700 text-sm font-medium">
            Zona Norte
          </text>
          <text x="340" y="230" textAnchor="middle" className="fill-gray-700 text-sm font-medium">
            Centro
          </text>
          <text x="320" y="380" textAnchor="middle" className="fill-gray-700 text-sm font-medium">
            Zona Sul
          </text>
          <text x="150" y="420" textAnchor="middle" className="fill-gray-700 text-sm font-medium">
            Barra
          </text>
          <text x="580" y="180" textAnchor="middle" className="fill-gray-700 text-sm font-medium">
            Zona Oeste
          </text>
          <text x="500" y="200" textAnchor="middle" className="fill-gray-700 text-xs font-medium">
            Ilha do Gov.
          </text>
        </svg>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>• Passe o mouse sobre as regiões para ver detalhes</p>
        <p>• Círculos representam estações meteorológicas</p>
        <p>• Cores baseadas na intensidade de chuva da última hora</p>
      </div>
    </div>
  );
};