import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Table2, X } from 'lucide-react';
import { RainStation } from '../types/rain';
import type { Occurrence } from '../types/occurrence';
import { useBairrosData, useZonasPluvData } from '../hooks/useCitiesData';
import { LoadingSpinner } from './LoadingSpinner';
import { getRainLevel } from '../utils/rainLevel';
import { ZoneRainLayer } from './ZoneRainLayer';
import { RainDataTable } from './RainDataTable';
import {
  MapLayers,
  InfluenceLinesToggle,
  MapDataWindowToggle,
  HistoricalViewModeToggle,
  HistoricalTimelineControl,
  FocusCityButton,
  FitCityOnLoad,
} from './MapControls';
import { MAP_TYPES, type MapDataWindow, type HistoricalViewMode, type MapTypeId } from './mapControlTypes';
import { getAccumulatedRainLevel, RAIN_LEVEL_PALETTE } from '../utils/rainLevel';
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
  /** No modo instantâneo: horário desejado (HH:mm). Aplicado só ao clicar em Aplicar. */
  desiredAnalysisTime?: string;
  onDesiredAnalysisTimeChange?: (time: string) => void;
  /** Ocorrências filtradas para o período atual, a serem exibidas como marcadores vermelhos. */
  occurrences?: Occurrence[];
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

// Cor da bolinha por nível de influência 0-4 (mesma paleta: 15 min, 1h e acumulado)
const INFLUENCE_COLORS = RAIN_LEVEL_PALETTE;

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

const OccurrenceMarkers: React.FC<{ occurrences?: Occurrence[] }> = ({ occurrences }) => {
  if (!occurrences || !occurrences.length) return null;

  const occurrenceIcon = L.divIcon({
    className: 'custom-occurrence-icon',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        background-color: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.35);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  return (
    <>
      {occurrences.map((occ) => {
        if (occ.latitude == null || occ.longitude == null) return null;
        const dt =
          occ.data_hora_abertura ??
          (occ.data_abertura && occ.hora_abertura
            ? `${occ.data_abertura} ${occ.hora_abertura}`
            : occ.data_abertura ?? null);

        return (
          <Marker
            key={occ.id_ocorrencia}
            position={[occ.latitude, occ.longitude]}
            icon={occurrenceIcon}
          >
            <Popup>
              <div style={{ padding: '10px', fontFamily: 'Arial, sans-serif', minWidth: '220px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#b91c1c', fontWeight: 700 }}>
                  Ocorrência {occ.id_ocorrencia}
                </h3>
                {occ.titulo && (
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                    {occ.titulo}
                  </p>
                )}
                {dt && (
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#4b5563' }}>
                    <strong>Data/hora:</strong> {dt}
                  </p>
                )}
                {occ.bairro && (
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#4b5563' }}>
                    <strong>Bairro:</strong> {occ.bairro}
                  </p>
                )}
                {occ.criticidade && (
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#4b5563' }}>
                    <strong>Criticidade:</strong> {occ.criticidade}
                  </p>
                )}
                {occ.estagio && (
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#4b5563' }}>
                    <strong>Estágio:</strong> {occ.estagio}
                  </p>
                )}
                {occ.localizacao && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                    {occ.localizacao}
                  </p>
                )}
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
  desiredAnalysisTime,
  onDesiredAnalysisTimeChange,
  occurrences,
}) => {
  const { bairrosData, loading, error } = useBairrosData();
  const { zonasData, loading: loadingZonas } = useZonasPluvData();
  const [showInfluenceLines, setShowInfluenceLines] = useState(true);
  const showHexagons = false;
  const isMobileInitial = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const [showSidebar, setShowSidebar] = useState(!isMobileInitial);
  const [showFiltersPanel, setShowFiltersPanel] = useState(!isMobileInitial);
  const [isMobileView, setIsMobileView] = useState(isMobileInitial);
  const [mapDataWindowInternal, setMapDataWindowInternal] = useState<MapDataWindow>('1h');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => {
      const mobile = mq.matches;
      setIsMobileView(mobile);
      if (mobile) {
        setShowFiltersPanel(false);
        setShowSidebar(false);
      } else {
        setShowFiltersPanel(true);
        setShowSidebar(true);
      }
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const mapDataWindow = mapDataWindowProp ?? mapDataWindowInternal;
  const setMapDataWindow = onMapDataWindowChange ?? setMapDataWindowInternal;
  const [historicalViewModeInternal, setHistoricalViewModeInternal] = useState<HistoricalViewMode>('instant');
  const historicalViewMode = historicalViewModeProp ?? historicalViewModeInternal;
  const setHistoricalViewMode = onHistoricalViewModeChange ?? setHistoricalViewModeInternal;
  const hasAccumulated = stations.some((s) => s.accumulated != null);

  // No modo Instantâneo, manter "Até" igual a "De" para buscar um único dia
  useEffect(() => {
    if (historicalViewMode === 'instant' && onHistoricalDateToChange && historicalDateTo !== historicalDate) {
      onHistoricalDateToChange(historicalDate);
    }
  }, [historicalViewMode, historicalDate, historicalDateTo, onHistoricalDateToChange]);
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
      {isMobileView && (showFiltersPanel || showSidebar) && (
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={() => { setShowFiltersPanel(false); setShowSidebar(false); }}
          className="fixed inset-0 z-[2050] bg-black/50 md:hidden"
        />
      )}

      {/* Painel de filtros: no mobile fica ACIMA do header (z 2100); no desktop = sidebar */}
      <div
        className={`
          z-[2100] md:z-[1400] flex flex-col overflow-x-hidden
          transition-transform duration-300 ease-out
          fixed left-0 top-0 bottom-0 w-[85vw] max-w-[320px] bg-white/98 shadow-xl border-r border-gray-200
          md:absolute md:top-28 md:left-3 md:bottom-auto md:max-h-[calc(100vh-7rem)] md:min-w-[200px] md:w-[min(320px,calc(100vw-24px))] md:rounded-lg md:shadow-md md:border md:border-gray-200 md:bg-white/95 md:backdrop-blur
          ${isMobileView ? (showFiltersPanel ? 'translate-x-0' : '-translate-x-full') : 'md:translate-x-0'}
        `}
      >
        {showFiltersPanel ? (
          <>
            {isMobileView && (
              <div className="flex items-center justify-between gap-2 shrink-0 border-b border-gray-200 bg-white px-3 py-2.5">
                <span className="font-medium text-gray-800 text-sm">Filtros</span>
                <button type="button" onClick={() => setShowFiltersPanel(false)} className="p-2 -m-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Fechar filtros">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {!isMobileView && (
              <div className="shrink-0 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
                <span className="text-xs font-semibold text-gray-700">Filtros do mapa</span>
                <button type="button" onClick={() => setShowFiltersPanel(false)} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100" title="Ocultar filtros">
                  <ChevronLeft className="w-3.5 h-3.5" /> Ocultar filtros
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 py-2 flex flex-col gap-2 scroll-touch min-w-0">
              <MapLayers value={mapType} onChange={onMapTypeChange} />
              <MapDataWindowToggle value={mapDataWindow} onChange={setMapDataWindow} />
              <InfluenceLinesToggle value={showInfluenceLines} onChange={setShowInfluenceLines} />
              {historicalMode && (
                <HistoricalViewModeToggle value={historicalViewMode} onChange={setHistoricalViewMode} hasAccumulated={hasAccumulated} />
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
                desiredAnalysisTime={desiredAnalysisTime}
                onDesiredAnalysisTimeChange={onDesiredAnalysisTimeChange}
              />
            </div>
          </>
        ) : (
          !isMobileView && (
            <button type="button" onClick={() => setShowFiltersPanel(true)} className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2" title="Mostrar filtros">
              <ChevronRight className="w-4 h-4" /> Mostrar filtros
            </button>
          )
        )}
      </div>

      {isMobileView && !showFiltersPanel && (
        <button type="button" onClick={() => setShowFiltersPanel(true)} className="fixed bottom-20 left-3 z-[2050] bg-white shadow-lg rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 md:hidden" title="Abrir filtros">
          <SlidersHorizontal className="w-5 h-5" /> Filtros
        </button>
      )}

      {!isMobileView && (
        <button type="button" onClick={() => setShowSidebar((v) => !v)} className="absolute top-28 right-3 z-[1300] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2" title={showSidebar ? 'Ocultar tabela' : 'Mostrar tabela'}>
          {showSidebar ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {showSidebar ? 'Ocultar dados' : 'Mostrar dados'}
        </button>
      )}
      {isMobileView && !showSidebar && (
        <button type="button" onClick={() => setShowSidebar(true)} className="fixed bottom-20 right-3 z-[2050] bg-white shadow-lg rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 md:hidden" title="Abrir tabela de dados">
          <Table2 className="w-5 h-5" /> Dados
        </button>
      )}

      {/* Tabela de dados: no mobile fica ACIMA do header (z 2100); no desktop = sidebar */}
      <div
        className={`
          z-[2100] md:z-[1400] flex flex-col min-w-0 transition-transform duration-300 ease-out overflow-x-hidden
          fixed right-0 top-0 bottom-0 w-[92vw] max-w-[420px]
          md:absolute md:top-40 md:right-3 md:bottom-3 md:w-[min(500px,calc(100vw-24px))]
          ${isMobileView ? (showSidebar ? 'translate-x-0' : 'translate-x-full') : showSidebar ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'}
        `}
      >
        <div className="h-full min-h-0 overflow-hidden rounded-l-xl border border-gray-200 bg-white shadow-xl flex flex-col md:rounded-xl">
          {isMobileView && (
            <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-200 bg-gray-50/80 shrink-0">
              <span className="font-medium text-gray-800 text-sm truncate min-w-0">Dados das estações</span>
              <button type="button" onClick={() => setShowSidebar(false)} className="p-2 -m-2 rounded-lg hover:bg-gray-200 text-gray-600 shrink-0" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-touch min-w-0">
            <RainDataTable stations={stations} embedded showAccumulatedColumn={historicalMode && hasAccumulated} />
          </div>
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
        {zonasData && (
          <ZoneRainLayer
            zonasData={zonasData}
            stations={displayStations}
            mapType={mapType}
            timeWindow={mapDataWindow === '1h' ? '1h' : '15min'}
            showAccumulated={historicalMode && historicalViewMode === 'accumulated' && hasAccumulated}
            showInfluenceLines={showInfluenceLines}
          />
        )}
        {bairrosData && <BairroPolygons bairrosData={bairrosData} showHexagons={showHexagons} />}
        <StationMarkers
          stations={stations}
          mapDataWindow={mapDataWindow}
          showAccumulated={historicalMode && historicalViewMode === 'accumulated' && hasAccumulated}
        />
        <OccurrenceMarkers occurrences={occurrences} />
      </MapContainer>
    </div>
  );
};
