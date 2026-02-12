import React from 'react';
import type { MapTypeId } from './MapControls';
import { getInfluenceLegendItems } from '../utils/influenceTheme';

interface InfluenceLegendProps {
  showHexagons: boolean;
  mapType: MapTypeId;
}

/** Legenda do mapa (hexágonos + estações) com contexto dinâmico. */
export const InfluenceLegend: React.FC<InfluenceLegendProps> = ({
  showHexagons,
  mapType,
}) => {
  const legendItems = getInfluenceLegendItems(mapType);
  return (
    <div
      className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2.5 w-[220px]"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="text-xs font-semibold text-gray-700 mb-1.5">Legenda do mapa</div>
      {showHexagons ? (
        <div className="flex flex-col gap-1">
          {legendItems.map(({ value, label, color }) => (
            <div key={value} className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded border border-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] font-medium text-gray-700">{label}</span>
            </div>
          ))}
          <div className="text-[10px] text-gray-500 mt-0.5">Hexágonos por mm/h (última hora)</div>
        </div>
      ) : (
        <div className="text-[11px] text-gray-500">Camada de hexágonos oculta.</div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm bg-emerald-500" />
          <span className="text-[11px] text-gray-700">Bolinhas: estações pluviométricas</span>
        </div>
      </div>
    </div>
  );
};
