import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { WindStation, WindCorridor, CorridorSummary } from '../types/wind';
import { msToKmh, windDirectionToCardinal, windLevelFromGustKmh, WIND_CORRIDOR_LABELS } from '../types/wind';

const TREND_LABEL: Record<CorridorSummary['trend'], string> = {
  subindo: '↑ subindo',
  caindo: '↓ caindo',
  estavel: '→ estável',
};

// Triângulo simples (sem direção/VRB) — deliberadamente diferente do círculo dos pluviômetros
// (LeafletMap.tsx) e da seta/pipa (direção conhecida), pra não confundir os dois símbolos no mapa.
const NO_DIRECTION_PATH = 'M10 2 L18 17 L2 17 Z';
const DIRECTION_ARROW_PATH = 'M10 1 L17 15 L10 11.5 L3 15 Z';

function buildWindIcon(windDirectionDeg: number | null, color: string): L.DivIcon {
  // Seta aponta para onde o vento sopra (direção meteorológica + 180°); sem direção = triângulo parado.
  const rotation = windDirectionDeg == null ? 0 : (windDirectionDeg + 180) % 360;
  const path = windDirectionDeg == null ? NO_DIRECTION_PATH : DIRECTION_ARROW_PATH;
  const shape = `<div style="transform: rotate(${rotation}deg); width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
       <svg width="20" height="20" viewBox="0 0 20 20">
         <path d="${path}" fill="${color}" stroke="black" stroke-width="1.5" stroke-linejoin="round" />
       </svg>
     </div>`;

  return L.divIcon({
    className: 'custom-wind-icon',
    html: shape,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

interface WindBeltLayerProps {
  stations: WindStation[];
  /** Resumo por corredor (useWindData) — mostra contexto (corredor + tendência) no popup real,
   * em vez de um marcador de resumo separado (confundia com as setas reais da REDEMET/INMET). */
  corridorSummary?: Record<WindCorridor, CorridorSummary> | null;
}

export const WindBeltLayer: React.FC<WindBeltLayerProps> = ({ stations, corridorSummary }) => {
  return (
    <>
      {stations.map((station) => {
        const gustKmh = msToKmh(station.windGustMs ?? station.windSpeedMs);
        const speedKmh = msToKmh(station.windSpeedMs);
        const level = windLevelFromGustKmh(gustKmh);
        const icon = buildWindIcon(station.windDirectionDeg, level.color);
        const corridor = corridorSummary?.[station.corridor];
        const isCorridorWorstCase = corridor?.station?.id === station.id;

        return (
          <Marker key={station.id} position={station.location} icon={icon}>
            <Popup>
              <div style={{ padding: '12px', fontFamily: 'Arial, sans-serif', minWidth: '200px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#333' }}>{station.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: level.color,
                      borderRadius: '50%',
                      marginRight: '8px',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: '#666' }}>{level.label}</span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Vento médio:</strong> {speedKmh.toFixed(0)} km/h
                </p>
                {station.windGustMs != null && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                    <strong>Rajada:</strong> {gustKmh.toFixed(0)} km/h
                  </p>
                )}
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Direção:</strong>{' '}
                  {station.windDirectionDeg != null
                    ? `${windDirectionToCardinal(station.windDirectionDeg)} (${station.windDirectionDeg}°)`
                    : 'Variável (VRB)'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Corredor:</strong> {WIND_CORRIDOR_LABELS[station.corridor]}
                  {corridor && corridor.stationCount > 0 && (
                    <>
                      {' — '}
                      {TREND_LABEL[corridor.trend]}
                      {isCorridorWorstCase ? ' (pior caso do corredor)' : ''}
                    </>
                  )}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Fonte:</strong> {station.source === 'inmet' ? 'INMET' : 'REDEMET'} ({station.code})
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Última atualização:</strong> {new Date(station.observedAt).toLocaleTimeString('pt-BR')}
                </p>
                {station.raw && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      color: '#555',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      borderTop: '1px solid #eee',
                      paddingTop: '6px',
                    }}
                  >
                    <strong>METAR:</strong> {station.raw}
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
