import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map, Layers, Hexagon } from 'lucide-react';

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

const BAIRROS_BOUNDS_PROPS: L.FitBoundsOptions = { padding: [24, 24], maxZoom: 12 };

function boundsFromBairros(bairrosData: { features: Array<{ geometry: { type?: string; coordinates: number[][] | number[][][] | number[][][][] } }> }): L.LatLngBounds | null {
  if (!bairrosData?.features?.length) return null;
  const points: [number, number][] = [];
  bairrosData.features.forEach((f) => {
    const coords = f.geometry?.coordinates;
    if (!coords?.length) return;
    // Polygon: coordinates[0] = anel (array de [lng, lat])
    // MultiPolygon: coordinates[0][0] = anel do primeiro polígono
    const first = coords[0];
    const ring: number[][] = Array.isArray(first?.[0]) && typeof (first[0] as number[])[0] === 'number'
      ? (first as number[][])   // Polygon: first já é o anel
      : (first?.[0] as number[][]); // MultiPolygon: first[0] é o anel
    if (!ring?.length) return;
    ring.forEach((pt) => {
      if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        points.push([pt[1], pt[0]]); // [lat, lng] para Leaflet
      }
    });
  });
  return points.length > 0 ? L.latLngBounds(points) : null;
}

interface FitCityOnLoadProps {
  bairrosData: { features: Array<{ geometry: { coordinates: number[][][][] } }> } | null;
}

/** Ajusta a vista do mapa para a cidade do Rio ao carregar (uma vez). */
export const FitCityOnLoad: React.FC<FitCityOnLoadProps> = ({ bairrosData }) => {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !bairrosData) return;
    const bounds = boundsFromBairros(bairrosData);
    if (bounds) {
      map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
      done.current = true;
    }
  }, [map, bairrosData]);
  return null;
};

interface FocusCityButtonProps {
  bairrosData: { features: Array<{ geometry: { coordinates: number[][][][] } }> } | null;
}

export const FocusCityButton: React.FC<FocusCityButtonProps> = ({ bairrosData }) => {
  const map = useMap();

  const handleFocus = () => {
    if (!bairrosData) return;
    const bounds = boundsFromBairros(bairrosData);
    if (bounds) map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
  };

  return (
    <button
      type="button"
      onClick={handleFocus}
      className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      title="Ajustar vista para a cidade do Rio inteira"
    >
      <Map className="w-4 h-4" />
      Ver cidade inteira
    </button>
  );
};
