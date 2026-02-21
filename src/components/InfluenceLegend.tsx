import React from 'react';
import type { MapTypeId } from './mapControlTypes';
import { getInfluenceLegendItems } from '../utils/influenceTheme';
import { rainLevels, accumulatedRainLevels } from '../utils/rainLevel';

interface InfluenceLegendProps {
  showHexagons: boolean;
  mapType: MapTypeId;
  /** Quando true, usa estilo leve para uso na aba "Legenda e explicações do mapa" */
  embedded?: boolean;
}

/** Legenda do mapa (hexágonos + estações) com contexto dinâmico. */
export const InfluenceLegend: React.FC<InfluenceLegendProps> = ({
  showHexagons,
  mapType,
  embedded = false,
}) => {
  const legendItems = getInfluenceLegendItems(mapType);
  return (
    <div
      className={
        embedded
          ? 'p-0 w-full max-w-sm min-w-0'
          : 'bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2 sm:p-2.5 w-full max-w-[220px] min-w-0'
      }
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="text-[11px] sm:text-xs font-semibold text-gray-700 mb-1 sm:mb-1.5">Legenda do mapa</div>
      {showHexagons ? (
        <div className="flex flex-col gap-1">
          {legendItems.map(({ value, label, color }) => (
            <div key={value} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border border-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] sm:text-[11px] font-medium text-gray-700 break-words">{label}</span>
            </div>
          ))}
          <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
            Área de abrangência = polígonos oficiais do arquivo zonas-pluviometricas.geojson (33 estações). Cor = nível de chuva da estação; contorno azul delimita cada zona.
          </div>
          <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
            Modo instantâneo: critério 15min (m15) ou 1h (h01). Modo acumulado: mm no período (De/Até).
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-gray-500">Camada de hexágonos oculta.</div>
      )}

      <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-gray-200">
        <div className="text-[10px] sm:text-[11px] font-medium text-gray-700 mb-1">Bolinhas: chuva de 1h (h01)</div>
        <div className="flex flex-col gap-1">
          {rainLevels.map((level, i) => (
            <div key={i} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-[10px] sm:text-[11px] font-medium text-gray-700 capitalize">
                {level.name} ({level.description})
              </span>
            </div>
          ))}
        </div>
        <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">Fonte: Alerta Rio</div>
      </div>

      <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-blue-200">
        <div className="text-[10px] sm:text-[11px] font-medium text-blue-800 mb-1">
          Acumulado no período (hexágonos e bolinhas)
        </div>
        <div className="text-[9px] sm:text-[10px] text-gray-600 mb-1">
          Nível por mm acumulados no intervalo escolhido (De/Até + horários). Só a área de influência de cada estação.
        </div>
        <div className="flex flex-col gap-1">
          {accumulatedRainLevels.map((level, i) => (
            <div key={i} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border border-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-[10px] sm:text-[11px] font-medium text-gray-700 capitalize">
                {level.name} ({level.description})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
