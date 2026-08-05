import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { CorridorSummary, WindCorridor } from '../types/wind';
import { WIND_CORRIDOR_LABELS, WIND_CORRIDOR_LOCATIONS } from '../types/wind';

const TREND_ARROW: Record<CorridorSummary['trend'], string> = {
  subindo: '↑',
  caindo: '↓',
  estavel: '→',
};

const TREND_LABEL: Record<CorridorSummary['trend'], string> = {
  subindo: 'subindo',
  caindo: 'caindo',
  estavel: 'estável',
};

function buildCorridorIcon(dominantDirectionDeg: number | null, color: string, hasData: boolean): L.DivIcon {
  // Seta aponta para onde o vento sopra (direção meteorológica + 180°); sem direção = círculo.
  const rotation = dominantDirectionDeg == null ? 0 : (dominantDirectionDeg + 180) % 360;
  const opacity = hasData ? 1 : 0.4;
  const shape =
    dominantDirectionDeg == null
      ? `<div style="width:20px;height:20px;border-radius:50%;background:${color};opacity:${opacity};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`
      : `<div style="transform: rotate(${rotation}deg); opacity:${opacity}; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
           <svg width="30" height="30" viewBox="0 0 20 20">
             <path d="M10 1 L18 16 L10 12.5 L2 16 Z" fill="${color}" stroke="white" stroke-width="1.8" stroke-linejoin="round" />
           </svg>
         </div>`;

  return L.divIcon({
    className: 'custom-wind-corridor-icon',
    html: shape,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

interface WindCorridorLayerProps {
  corridorSummary: Record<WindCorridor, CorridorSummary> | null;
}

/** Símbolo do cinturão de vento: um ícone por corredor de análise, fixo no mapa, com o resumo ao lado. */
export const WindCorridorLayer: React.FC<WindCorridorLayerProps> = ({ corridorSummary }) => {
  if (!corridorSummary) return null;

  return (
    <>
      {(Object.values(corridorSummary) as CorridorSummary[]).map((summary) => {
        const location = WIND_CORRIDOR_LOCATIONS[summary.corridor];
        const hasData = summary.stationCount > 0;
        const icon = buildCorridorIcon(summary.dominantDirectionDeg, summary.level.color, hasData);

        return (
          <Marker key={summary.corridor} position={location} icon={icon}>
            {/* Sem `permanent`: Leaflet mostra no hover (mouseover) e some no mouseout, igual ao padrão de popup dos pluviômetros. */}
            <Tooltip direction="top" offset={[0, -14]} opacity={0.97}>
              <div style={{ padding: '4px 2px', fontFamily: 'Arial, sans-serif', minWidth: '180px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#333' }}>
                  {WIND_CORRIDOR_LABELS[summary.corridor]}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: summary.level.color,
                      borderRadius: '50%',
                      marginRight: '6px',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#666' }}>{summary.level.label}</span>
                </div>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#333' }}>
                  {hasData
                    ? `${summary.maxGustKmh.toFixed(0)} km/h (${TREND_ARROW[summary.trend]} ${TREND_LABEL[summary.trend]})`
                    : 'Sem dados no momento'}
                </p>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
};
