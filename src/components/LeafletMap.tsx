import React from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { RainStation } from '../types/rain';
import { useBairrosData } from '../hooks/useCitiesData';
import { LoadingSpinner } from './LoadingSpinner';
// Removido: getBairroColor - não usado mais
import { getRainLevel } from '../utils/rainLevel';
import 'leaflet/dist/leaflet.css';

// Fix para ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  stations: RainStation[];
}

// Componente para criar polígonos dos bairros
const BairroPolygons: React.FC<{ bairrosData: any }> = ({ bairrosData }) => {
  return (
    <>
      {bairrosData.features.map((feature: any, index: number) => {
        const bairroName = feature.properties.nome;
        // Removido: cores dos bairros - apenas bolinhas coloridas
        
        // Converter coordenadas para o formato do Leaflet
        let coordinates: number[][][] = [];
        
        if (feature.geometry.type === 'MultiPolygon') {
          coordinates = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'Polygon') {
          coordinates = [feature.geometry.coordinates[0]];
        }
        
        // Converter para formato [lat, lng] do Leaflet
        const leafletCoordinates = coordinates.map(polygon => 
          polygon.map(coord => [coord[1], coord[0]] as [number, number]) // Inverter lat/lng
        );
        
        return (
          <Polygon
            key={`bairro-${index}`}
            positions={leafletCoordinates}
            pathOptions={{
              color: '#9CA3AF', // Cinza médio para bordas
              weight: 1,
              opacity: 0.6,
              fillColor: '#F3F4F6', // Cinza claro neutro
              fillOpacity: 0.2,
            }}
          >
            <Popup>
              <div style={{ padding: '8px', fontFamily: 'Arial, sans-serif' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#333' }}>
                  {bairroName}
                </h3>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                  {feature.properties.regiao_adm || 'RJ'}
                </p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
};

// Componente para criar marcadores das estações
const StationMarkers: React.FC<{ stations: RainStation[] }> = ({ stations }) => {
  return (
    <>
      {stations.map((station) => {
        const rainLevel = getRainLevel(station.data.h01);
        
        // Criar ícone personalizado para a estação
        const stationIcon = L.divIcon({
          className: 'custom-station-icon',
          html: `
            <div style="
              width: 16px;
              height: 16px;
              background-color: ${rainLevel.color};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        
        return (
          <Marker
            key={station.id}
            position={[station.location[0], station.location[1]]}
            icon={stationIcon}
          >
            <Popup>
              <div style={{ padding: '12px', fontFamily: 'Arial, sans-serif', minWidth: '200px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#333' }}>
                  {station.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: rainLevel.color, 
                    borderRadius: '50%', 
                    marginRight: '8px' 
                  }}></div>
                  <span style={{ fontSize: '14px', color: '#666' }}>{rainLevel.name}</span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Última hora:</strong> {station.data.h01.toFixed(1)}mm
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Últimas 24h:</strong> {station.data.h24.toFixed(1)}mm
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Última atualização:</strong> {new Date(station.read_at).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// Componente principal
export const LeafletMap: React.FC<LeafletMapProps> = ({ stations }) => {
  const { bairrosData, loading, error } = useBairrosData();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
        <div className="h-96 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa dos Bairros do Rio de Janeiro</h3>
      
      <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl overflow-hidden shadow-inner">
        <MapContainer
          center={[-22.9000, -43.1833]} // Centro do Rio de Janeiro
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
                <BairroPolygons bairrosData={bairrosData} />
          <StationMarkers stations={stations} />
        </MapContainer>
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
          <p>• <strong>Bolinhas coloridas:</strong> Estações meteorológicas (dados da última hora)</p>
          <p>• Dados geográficos da Prefeitura do Rio de Janeiro</p>
          <p>• Mapa: Leaflet + OpenStreetMap</p>
        </div>
      </div>
    </div>
  );
};
