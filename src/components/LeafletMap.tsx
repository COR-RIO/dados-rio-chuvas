import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RainStation } from '../types/rain';
import { useBairrosData, useZonasPluvData } from '../hooks/useCitiesData';
import { LoadingSpinner } from './LoadingSpinner';
import { getRainLevel } from '../utils/rainLevel';
import { HexRainLayer } from './HexRainLayer';
import { RainDataTable } from './RainDataTable';
import {
  MapLayers,
  HexagonLayerToggle,
  MapDataWindowToggle,
  HistoricalViewModeToggle,
  HistoricalTimelineControl,
  FocusCityButton,
  FitCityOnLoad,
  MAP_TYPES,
  type MapTypeId,
  type MapDataWindow,
  type HistoricalViewMode,
} from './MapControls';
import { getAccumulatedRainLevel } from '../utils/rainLevel';
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
  mapType: MapTypeId;
  onMapTypeChange: (mapType: MapTypeId) => void;
  historicalMode: boolean;
  historicalDate: string;
  onHistoricalDateChange: (date: string) => void;
  /** Data fim do intervalo (ex.: 10/02/2026). Quando igual a historicalDate, é um único dia */
  historicalDateTo?: string;
  onHistoricalDateToChange?: (date: string) => void;
  /** Filtro horário (dia_original): início e fim no formato HH:mm */
  historicalTimeFrom?: string;
  historicalTimeTo?: string;
  onHistoricalTimeFromChange?: (time: string) => void;
  onHistoricalTimeToChange?: (time: string) => void;
  historicalTimeline: string[];
  selectedHistoricalTimestamp: string | null;
  onHistoricalTimestampChange: (timestamp: string) => void;
  /** Quais dados exibir no mapa: 15min, 1h ou ambos */
  mapDataWindow?: MapDataWindow;
  onMapDataWindowChange?: (v: MapDataWindow) => void;
  /** No histórico: instantâneo (snapshot) ou acumulado no período */
  historicalViewMode?: HistoricalViewMode;
  onHistoricalViewModeChange?: (v: HistoricalViewMode) => void;
  /** Chama ao clicar em "Aplicar" no painel histórico (busca com o intervalo atual) */
  onApplyHistoricalFilter?: () => void;
  /** Exibe indicador de carregamento no painel histórico */
  historicalRefreshing?: boolean;
}

// Componente para criar polígonos dos bairros
const BairroPolygons: React.FC<{ bairrosData: any; showHexagons: boolean }> = ({ bairrosData, showHexagons }) => {
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
              color: showHexagons ? '#475569' : '#9CA3AF',
              weight: showHexagons ? 1.2 : 1,
              opacity: showHexagons ? 0.85 : 0.5,
              fillColor: '#F3F4F6',
              fillOpacity: showHexagons ? 0 : 0.12,
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

// Polígonos das zonas pluviométricas (do KML/GeoJSON)
const ZonasPolygons: React.FC<{ zonasData: import('../services/citiesApi').ZonasPluvCollection; showHexagons: boolean }> = ({ zonasData, showHexagons }) => {
  const polygons: { key: string; positions: [number, number][][]; name: string; est?: string }[] = [];
  zonasData.features.forEach((feature, fi) => {
    const name = feature.properties.name;
    const est = feature.properties.est;
    if (feature.geometry.type === 'Polygon') {
      const ring = (feature.geometry.coordinates as number[][][])[0] ?? [];
      const positions = [ring.map((c) => [c[1], c[0]] as [number, number])];
      polygons.push({ key: `zona-${fi}-0`, positions, name, est });
    } else if (feature.geometry.type === 'MultiPolygon') {
      (feature.geometry.coordinates as number[][][][]).forEach((poly, pi) => {
        const ring = poly[0] ?? [];
        const positions = [ring.map((c) => [c[1], c[0]] as [number, number])];
        polygons.push({ key: `zona-${fi}-${pi}`, positions, name, est });
      });
    }
  });
  return (
    <>
      {polygons.map(({ key, positions, name, est }) => (
        <Polygon
          key={key}
          positions={positions}
          pathOptions={{
            color: '#0ea5e9',
            weight: showHexagons ? 2.2 : 2,
            opacity: showHexagons ? 1 : 0.8,
            fillColor: '#0ea5e9',
            fillOpacity: showHexagons ? 0 : 0.08,
          }}
        >
          <Popup>
            <div style={{ padding: '8px', fontFamily: 'Arial, sans-serif' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#333' }}>{name}</h3>
              {est && <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Estação: {est}</p>}
            </div>
          </Popup>
        </Polygon>
      ))}
    </>
  );
};

// Cor da bolinha por nível de influência 0-4 (mesma paleta dos hexágonos)
const INFLUENCE_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '#eceded',
  1: '#42b9eb',
  2: '#2f90be',
  3: '#2a688f',
  4: '#13335a',
};

// Componente para criar marcadores das estações
const StationMarkers: React.FC<{
  stations: RainStation[];
  mapDataWindow?: MapDataWindow;
  showAccumulated?: boolean;
}> = ({ stations, mapDataWindow = '1h', showAccumulated = false }) => {
  return (
    <>
      {stations.map((station) => {
        const oneHourRain = Math.max(0, station.data.h01 ?? 0);
        const m15 = Math.max(0, station.data.m15 ?? 0);
        const acc = station.accumulated;
        const useAccumulated = showAccumulated && acc;
        const accumulatedMm = useAccumulated ? acc.mm_accumulated : 0;

        let rainLevel: { color: string; name: string };
        if (useAccumulated) {
          rainLevel = getAccumulatedRainLevel(accumulatedMm);
        } else if (mapDataWindow === '15min') {
          const level = m15 <= 0 ? 0 : m15 < 1.25 ? 1 : m15 <= 6.25 ? 2 : m15 <= 12.5 ? 3 : 4;
          rainLevel = { color: INFLUENCE_COLORS[level as 0 | 1 | 2 | 3 | 4], name: ['Sem chuva', 'Fraca', 'Moderada', 'Forte', 'Muito forte'][level] };
        } else {
          rainLevel = getRainLevel(oneHourRain);
        }
        
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
                {useAccumulated && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#333', fontWeight: 600 }}>
                    Acumulado no período: {acc!.mm_accumulated.toFixed(1)} mm
                  </p>
                )}
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Chuva 15min:</strong> {m15.toFixed(1)} mm
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Chuva 1h:</strong> {oneHourRain.toFixed(1)} mm/h
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
export const LeafletMap: React.FC<LeafletMapProps> = ({
  stations,
  mapType,
  onMapTypeChange,
  historicalMode,
  historicalDate,
  onHistoricalDateChange,
  historicalDateTo,
  onHistoricalDateToChange,
  historicalTimeFrom = '00:00',
  historicalTimeTo = '23:59',
  onHistoricalTimeFromChange,
  onHistoricalTimeToChange,
  historicalTimeline,
  selectedHistoricalTimestamp,
  onHistoricalTimestampChange,
  mapDataWindow: mapDataWindowProp,
  onMapDataWindowChange,
  historicalViewMode: historicalViewModeProp,
  onHistoricalViewModeChange,
  onApplyHistoricalFilter,
  historicalRefreshing = false,
}) => {
  const { bairrosData, loading, error } = useBairrosData();
  const { zonasData, loading: loadingZonas } = useZonasPluvData();
  const [showHexagons, setShowHexagons] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mapDataWindowInternal, setMapDataWindowInternal] = useState<MapDataWindow>('1h');
  const mapDataWindow = mapDataWindowProp ?? mapDataWindowInternal;
  const setMapDataWindow = onMapDataWindowChange ?? setMapDataWindowInternal;
  const [historicalViewModeInternal, setHistoricalViewModeInternal] = useState<HistoricalViewMode>('instant');
  const historicalViewMode = historicalViewModeProp ?? historicalViewModeInternal;
  const setHistoricalViewMode = onHistoricalViewModeChange ?? setHistoricalViewModeInternal;
  const hasAccumulated = stations.some((s) => s.accumulated != null);
  const displayStations =
    historicalViewMode === 'accumulated' ? stations : stations.map((s) => ({ ...s, accumulated: undefined }));
  const mapTypeConfig = MAP_TYPES.find((t: { id: MapTypeId }) => t.id === mapType) ?? MAP_TYPES[0];
  const loadingAny = loading || loadingZonas;
  const boundsData = zonasData ?? bairrosData;

  if (loadingAny) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center bg-white/90 rounded-xl border border-red-100 px-6 py-4 shadow-sm">
          <p className="text-red-600 font-medium mb-2">Erro ao carregar mapa</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!bairrosData && !zonasData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <p className="text-gray-500">Nenhum dado geográfico disponível</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden">
      <div className="absolute top-28 left-3 z-[1200] flex flex-col gap-2 max-h-[calc(100vh-7rem)] overflow-y-auto min-w-[200px] pr-1">
        <MapLayers value={mapType} onChange={onMapTypeChange} />
        <MapDataWindowToggle value={mapDataWindow} onChange={setMapDataWindow} />
        <HexagonLayerToggle value={showHexagons} onChange={setShowHexagons} />
        {historicalMode && (
          <HistoricalViewModeToggle
            value={historicalViewMode}
            onChange={setHistoricalViewMode}
            hasAccumulated={hasAccumulated}
          />
        )}
        <HistoricalTimelineControl
          enabled={historicalMode}
          dateValue={historicalDate}
          onDateChange={onHistoricalDateChange}
          dateToValue={historicalDateTo ?? historicalDate}
          onDateToChange={onHistoricalDateToChange ?? (() => {})}
          timeFrom={historicalTimeFrom}
          timeTo={historicalTimeTo}
          onTimeFromChange={onHistoricalTimeFromChange ?? (() => {})}
          onTimeToChange={onHistoricalTimeToChange ?? (() => {})}
          timeline={historicalTimeline}
          selectedTimestamp={selectedHistoricalTimestamp}
          onTimestampChange={onHistoricalTimestampChange}
          onApplyFilter={onApplyHistoricalFilter}
          refreshing={historicalRefreshing}
          viewMode={historicalViewMode}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowSidebar((v) => !v)}
        className="absolute top-28 right-3 z-[1300] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        title={showSidebar ? 'Ocultar tabela' : 'Mostrar tabela'}
      >
        {showSidebar ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {showSidebar ? 'Ocultar dados' : 'Mostrar dados'}
      </button>

      <div
        className={`absolute top-40 right-3 bottom-3 z-[1250] w-[min(500px,calc(100vw-24px))] transition-transform duration-300 ${
          showSidebar ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <RainDataTable
            stations={stations}
            embedded
            showAccumulatedColumn={historicalMode && hasAccumulated}
          />
        </div>
      </div>

      <MapContainer
        center={[-22.9068, -43.1729]}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
      >
        <TileLayer
          key={mapType}
          attribution={mapTypeConfig.attribution}
          url={mapTypeConfig.url}
        />
        <FitCityOnLoad boundsData={boundsData} />
        <FocusCityButton boundsData={boundsData} />
        {showHexagons && mapDataWindow === '15min' && (
          <HexRainLayer
            stations={displayStations}
            resolution={8}
            mapType={mapType}
            timeWindow="15min"
            bairrosData={bairrosData ?? undefined}
          />
        )}
        {showHexagons && mapDataWindow === '1h' && (
          <HexRainLayer
            stations={displayStations}
            resolution={8}
            mapType={mapType}
            timeWindow="1h"
            bairrosData={bairrosData ?? undefined}
          />
        )}
        {showHexagons && mapDataWindow === 'both' && (
          <>
            <HexRainLayer
              stations={displayStations}
              resolution={8}
              mapType={mapType}
              timeWindow="15min"
              bairrosData={bairrosData ?? undefined}
              variant="primary"
            />
            <HexRainLayer
              stations={displayStations}
              resolution={8}
              mapType={mapType}
              timeWindow="1h"
              bairrosData={bairrosData ?? undefined}
              variant="secondary"
            />
          </>
        )}
        {zonasData && <ZonasPolygons zonasData={zonasData} showHexagons={showHexagons} />}
        {bairrosData && <BairroPolygons bairrosData={bairrosData} showHexagons={showHexagons} />}
        <StationMarkers
          stations={stations}
          mapDataWindow={mapDataWindow}
          showAccumulated={historicalMode && historicalViewMode === 'accumulated' && hasAccumulated}
        />
      </MapContainer>
    </div>
  );
};
