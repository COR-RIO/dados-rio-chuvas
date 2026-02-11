import React from 'react';
import { INFLUENCE_LEVELS } from '../types/alertaRio';

/** Legenda vertical para o mapa de área de influência (0 a 4+) - estilo azul */
export const InfluenceLegend: React.FC = () => {
  return (
    <div
      className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="text-xs font-semibold text-gray-700 mb-1.5">Área de influência</div>
      <div className="flex flex-col gap-0.5">
        {INFLUENCE_LEVELS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-white flex-shrink-0 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-gray-500 mt-1">mm/h (última hora)</div>
    </div>
  );
};
