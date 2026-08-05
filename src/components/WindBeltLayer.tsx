import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { WindStation } from '../types/wind';
import { msToKmh, windDirectionToCardinal, windLevelFromGustKmh } from '../types/wind';

function buildWindIcon(windDirectionDeg: number | null, color: string): L.DivIcon {
  // Seta aponta para onde o vento sopra (direção meteorológica + 180°); sem direção = círculo simples.
  const rotation = windDirectionDeg == null ? 0 : (windDirectionDeg + 180) % 360;
  const shape =
    windDirectionDeg == null
      ? `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`
      : `<div style="transform: rotate(${rotation}deg); width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
           <svg width="20" height="20" viewBox="0 0 20 20">
             <path d="M10 1 L17 15 L10 11.5 L3 15 Z" fill="${color}" stroke="black" stroke-width="1.5" stroke-linejoin="round" />
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
}

export const WindBeltLayer: React.FC<WindBeltLayerProps> = ({ stations }) => {
  return (
    <>
      {stations.map((station) => {
        const gustKmh = msToKmh(station.windGustMs ?? station.windSpeedMs);
        const speedKmh = msToKmh(station.windSpeedMs);
        const level = windLevelFromGustKmh(gustKmh);
        const icon = buildWindIcon(station.windDirectionDeg, level.color);

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
                  <strong>Direção:</strong> {windDirectionToCardinal(station.windDirectionDeg)}
                  {station.windDirectionDeg != null ? ` (${station.windDirectionDeg}°)` : ''}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Fonte:</strong> {station.source === 'inmet' ? 'INMET' : 'REDEMET'} ({station.code})
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#333' }}>
                  <strong>Última atualização:</strong> {new Date(station.observedAt).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};
