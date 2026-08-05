import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { CorridorSummary, WindCorridor } from '../types/wind';
import { WIND_CORRIDOR_LABELS, WIND_CORRIDOR_LOCATIONS } from '../types/wind';
import { RAIN_LEVEL_PALETTE } from '../utils/rainLevel';

const SOURCE_LABEL: Record<'inmet' | 'redemet', string> = { inmet: 'INMET', redemet: 'REDEMET' };

// Mesmo cinza do "sem chuva" da pluviometria (RAIN_LEVEL_PALETTE[0]) — reaproveita a mesma
// convenção visual de "zero"/"sem dado" já usada no resto do mapa, em vez de opacidade reduzida
// (que ficava pouco visível).
const NO_DATA_COLOR = RAIN_LEVEL_PALETTE[0];

// Triângulo simples (sem direção conhecida, ou sem dado nenhum) — mesmo path do WindBeltLayer,
// deliberadamente diferente do círculo dos pluviômetros e da seta/pipa (direção conhecida).
const NO_DIRECTION_PATH = 'M10 2 L18 17 L2 17 Z';
const DIRECTION_ARROW_PATH = 'M10 1 L18 16 L10 12.5 L2 16 Z';

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

// Com dado real, o marcador do corredor cai na coordenada exata da estação "pior caso" — que já
// tem seu próprio marcador via WindBeltLayer no mesmo ponto. Desloca só o DESENHO (iconAnchor),
// não a coordenada, pra não empilhar os dois ícones e esconder o popup detalhado da estação.
const COLOCATED_SHIFT = 22;

function buildCorridorIcon(dominantDirectionDeg: number | null, color: string, hasData: boolean): L.DivIcon {
  // Seta aponta para onde o vento sopra (direção meteorológica + 180°); sem direção = triângulo parado.
  const rotation = dominantDirectionDeg == null ? 0 : (dominantDirectionDeg + 180) % 360;
  const path = dominantDirectionDeg == null ? NO_DIRECTION_PATH : DIRECTION_ARROW_PATH;
  const fillColor = hasData ? color : NO_DATA_COLOR;
  const shape = `<div style="transform: rotate(${rotation}deg); width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
       <svg width="30" height="30" viewBox="0 0 20 20">
         <path d="${path}" fill="${fillColor}" stroke="black" stroke-width="1.8" stroke-linejoin="round" />
       </svg>
     </div>`;

  return L.divIcon({
    className: 'custom-wind-corridor-icon',
    html: shape,
    iconSize: [32, 32],
    iconAnchor: hasData ? [16 + COLOCATED_SHIFT, 16 + COLOCATED_SHIFT] : [16, 16],
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
        const hasData = summary.stationCount > 0 && summary.station != null;
        // Com dado real, o marcador vai exatamente na estação que reportou o maxGustKmh — não num
        // ponto aproximado. Sem dado, cai no ponto de referência fixo do corredor (só p/ o ícone aparecer).
        const location = hasData ? summary.station!.location : WIND_CORRIDOR_LOCATIONS[summary.corridor];
        const icon = buildCorridorIcon(summary.dominantDirectionDeg, summary.level.color, hasData);

        const tooltipOffset: [number, number] = hasData
          ? [-COLOCATED_SHIFT, -14 - COLOCATED_SHIFT]
          : [0, -14];

        return (
          <Marker key={summary.corridor} position={location} icon={icon}>
            {/* Sem `permanent`: Leaflet mostra no hover (mouseover) e some no mouseout, igual ao padrão de popup dos pluviômetros. */}
            <Tooltip direction="top" offset={tooltipOffset} opacity={0.97}>
              <div style={{ padding: '4px 2px', fontFamily: 'Arial, sans-serif', minWidth: '180px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#333' }}>
                  {WIND_CORRIDOR_LABELS[summary.corridor]}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: hasData ? summary.level.color : NO_DATA_COLOR,
                      borderRadius: '50%',
                      marginRight: '6px',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#666' }}>{hasData ? summary.level.label : 'Sem dados'}</span>
                </div>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#333' }}>
                  {hasData
                    ? `${summary.maxGustKmh.toFixed(0)} km/h (${TREND_ARROW[summary.trend]} ${TREND_LABEL[summary.trend]})`
                    : 'Sem dados no momento'}
                </p>
                {hasData && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#888' }}>
                    Estação: {summary.station!.name} · {SOURCE_LABEL[summary.station!.source]} (
                    {summary.station!.code})
                    {summary.stationCount > 1 ? ` — pior caso entre ${summary.stationCount} estações` : ''}
                  </p>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
};
