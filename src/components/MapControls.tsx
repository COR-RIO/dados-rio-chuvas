import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map, Layers, Hexagon, Clock3, CalendarDays } from 'lucide-react';

export type MapTypeId = 'rua' | 'satelite' | 'escuro' | 'terreno';

export const MAP_TYPES: Array<{
  id: MapTypeId;
  label: string;
  url: string;
  attribution: string;
}> = [
  {
    id: 'rua',
    label: 'Rua',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'satelite',
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    id: 'escuro',
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'terreno',
    label: 'Terreno',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
];

interface MapLayersProps {
  value: MapTypeId;
  onChange: (id: MapTypeId) => void;
}

const controlBoxClass = 'bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2';

export const MapLayers: React.FC<MapLayersProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Layers className="w-3.5 h-3.5" />
        Tipo de mapa
      </div>
      <div className="flex flex-col gap-1">
        {MAP_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
              value === t.id
                ? 'bg-yellow-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface HexagonLayerToggleProps {
  value: boolean;
  onChange: (show: boolean) => void;
}

/** Controle para mostrar ou ocultar a camada de hexágonos (área de influência) no mapa. */
export const HexagonLayerToggle: React.FC<HexagonLayerToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Hexagon className="w-3.5 h-3.5" />
        Hexágonos
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            !value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
};

interface TimeWindowControlProps {
  value: number;
  onChange: (minutes: number) => void;
}

/** Filtro temporal do mapa (5 a 60 minutos) para bolinhas e hexágonos. */
export const TimeWindowControl: React.FC<TimeWindowControlProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Clock3 className="w-3.5 h-3.5" />
        Janela de tempo
      </div>
      <input
        type="range"
        min={5}
        max={60}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-yellow-500 cursor-pointer"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
        <span>5m</span>
        <span className="font-semibold text-gray-700">{value}m</span>
        <span>60m</span>
      </div>
      <div className="mt-1 text-[10px] text-gray-500">Base oficial: 5min, 15min e 1h (AlertaRio)</div>
    </div>
  );
};

interface HistoricalTimelineControlProps {
  enabled: boolean;
  dateValue: string;
  onDateChange: (date: string) => void;
  timeline: string[];
  selectedTimestamp: string | null;
  onTimestampChange: (timestamp: string) => void;
}

function formatTimelineLabel(isoTs: string): string {
  const parsed = new Date(isoTs);
  if (Number.isNaN(parsed.getTime())) return isoTs;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Controle de histórico: seleciona data e horário (timeline) quando o modo histórico está ativo.
 */
export const HistoricalTimelineControl: React.FC<HistoricalTimelineControlProps> = ({
  enabled,
  dateValue,
  onDateChange,
  timeline,
  selectedTimestamp,
  onTimestampChange,
}) => {
  const selectedIndex = selectedTimestamp ? timeline.indexOf(selectedTimestamp) : -1;
  const safeIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, timeline.length - 1);
  const currentTs = timeline[safeIndex] ?? null;

  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <CalendarDays className="w-3.5 h-3.5" />
        Histórico (GCP)
      </div>

      <input
        type="date"
        value={dateValue}
        onChange={(e) => onDateChange(e.target.value)}
        disabled={!enabled}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
      />

      {!enabled && (
        <div className="mt-2 text-[10px] text-gray-500">
          Ative o modo "Histórico" no topo para usar este filtro.
        </div>
      )}

      {enabled && timeline.length > 0 && (
        <>
          <input
            type="range"
            min={0}
            max={timeline.length - 1}
            step={1}
            value={safeIndex}
            onChange={(e) => onTimestampChange(timeline[Number(e.target.value)])}
            className="mt-2 w-full accent-blue-600 cursor-pointer"
          />
          <div className="mt-1 text-[10px] text-gray-700 font-semibold">
            {currentTs ? formatTimelineLabel(currentTs) : 'Sem horário'}
          </div>
          <div className="text-[10px] text-gray-500">
            {timeline.length} horários disponíveis no dia selecionado
          </div>
        </>
      )}

      {enabled && timeline.length === 0 && (
        <div className="mt-2 text-[10px] text-gray-500">
          Sem horários para esta data.
        </div>
      )}
    </div>
  );
};

const BAIRROS_BOUNDS_PROPS: L.FitBoundsOptions = { padding: [24, 24], maxZoom: 12 };

function boundsFromBairros(bairrosData: { features: Array<{ geometry: { type?: string; coordinates: number[][] | number[][][] | number[][][][] } }> }): L.LatLngBounds | null {
  if (!bairrosData?.features?.length) return null;
  const points: [number, number][] = [];
  const features = Array.isArray(bairrosData.features) ? bairrosData.features : [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) continue;
    // Polygon: coordinates[0] = anel (array de [lng, lat])
    // MultiPolygon: coordinates[0][0] = anel do primeiro polígono
    const first = coords[0];
    if (first == null) continue;
    let ring: number[][] | undefined;
    if (Array.isArray(first) && first.length > 0) {
      const firstEl = first[0];
      if (Array.isArray(firstEl) && typeof firstEl[0] === 'number') {
        ring = first as number[][]; // Polygon: first já é o anel
      } else if (Array.isArray(firstEl) && Array.isArray(firstEl[0])) {
        ring = first[0] as number[][]; // MultiPolygon: first[0] é o anel
      }
    }
    if (!ring || !Array.isArray(ring) || ring.length === 0) continue;
    for (const pt of ring) {
      if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        points.push([pt[1], pt[0]]); // [lat, lng] para Leaflet
      }
    }
  }
  return points.length > 0 ? L.latLngBounds(points) : null;
}

/** Dados GeoJSON compatíveis para cálculo de bounds (bairros ou zonas pluviométricas). */
export type BoundsGeoJson = { features: Array<{ geometry: { coordinates: number[][] | number[][][] | number[][][][] } }> } | null;

interface FitCityOnLoadProps {
  /** Bairros ou zonas pluviométricas para encaixar a vista (preferir zonas quando disponível). */
  boundsData: BoundsGeoJson;
}

/** Ajusta a vista do mapa para a cidade do Rio ao carregar (uma vez). */
export const FitCityOnLoad: React.FC<FitCityOnLoadProps> = ({ boundsData }) => {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !boundsData) return;
    const bounds = boundsFromBairros(boundsData);
    if (bounds) {
      map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
      done.current = true;
    }
  }, [map, boundsData]);
  return null;
};

interface FocusCityButtonProps {
  boundsData: BoundsGeoJson;
}

export const FocusCityButton: React.FC<FocusCityButtonProps> = ({ boundsData }) => {
  const map = useMap();

  const handleFocus = () => {
    if (!boundsData) return;
    const bounds = boundsFromBairros(boundsData);
    if (bounds) map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
  };

  return (
    <button
      type="button"
      onClick={handleFocus}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1400] flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      title="Ajustar vista para a cidade do Rio inteira"
    >
      <Map className="w-4 h-4" />
      Ver cidade inteira
    </button>
  );
};
