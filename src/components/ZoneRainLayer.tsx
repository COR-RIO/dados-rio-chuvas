import React, { useMemo } from 'react';
import { Polygon, Popup } from 'react-leaflet';
import type { RainStation } from '../types/rain';
import type { ZonaPluvFeature, ZonasPluvCollection } from '../services/citiesApi';
import type { MapTypeId } from './mapControlTypes';
import { findStationForZone } from '../utils/zoneStationMatch';
import { rainfallToInfluenceLevel15min, rainfallToInfluenceLevel1h } from '../types/alertaRio';
import type { InfluenceLevelValue } from '../types/alertaRio';
import { accumulatedMmToInfluenceLevel } from '../utils/rainLevel';
import { getInfluenceColor } from '../utils/influenceTheme';
import { getHexOverlayTuning } from '../utils/influenceTheme';

export type ZoneTimeWindow = '15min' | '1h';

interface ZoneRainLayerProps {
  /** Zonas do data/zonas-pluviometricas.geojson (33 estações) */
  zonasData: ZonasPluvCollection;
  stations: RainStation[];
  mapType: MapTypeId;
  timeWindow: ZoneTimeWindow;
  /** Quando true, usa mm_accumulated para o nível (vista acumulado no período) */
  showAccumulated?: boolean;
  /** Linha de influência: contorno que corta/delimita a área de abrangência de cada estação (fronteira entre zonas). */
  showInfluenceLines?: boolean;
}

/** Converte coordenadas GeoJSON [lng, lat] para Leaflet [lat, lng] e remove 3ª coordenada. */
function ringToLeaflet(ring: number[][]): [number, number][] {
  return ring.map((c) => [Number(c[1]), Number(c[0])] as [number, number]);
}

/** Extrai anéis exteriores de um feature (Polygon ou MultiPolygon) em posições Leaflet. */
function getZoneRings(feature: ZonaPluvFeature): [number, number][][] {
  const coords = feature.geometry?.coordinates;
  const type = feature.geometry?.type;
  if (!coords?.length) return [];

  if (type === 'Polygon') {
    const ring = (coords as number[][][])[0] ?? [];
    if (ring.length >= 3) return [ringToLeaflet(ring)];
    return [];
  }

  const rings: [number, number][][] = [];
  for (const poly of coords as number[][][][]) {
    const ring = poly?.[0] ?? [];
    if (ring.length >= 3) rings.push(ringToLeaflet(ring));
  }
  return rings;
}

/**
 * Camada de área de abrangência usando exatamente os polígonos do zonas-pluviometricas.geojson.
 * Cada zona é pintada com o nível de chuva da estação correspondente (match por properties.est).
 * Contorno azul bem visível para delimitar as 33 zonas.
 */
export const ZoneRainLayer: React.FC<ZoneRainLayerProps> = ({
  zonasData,
  stations,
  mapType,
  timeWindow,
  showAccumulated = false,
  showInfluenceLines = true,
}) => {
  const zoneStroke = useMemo(() => {
    if (!showInfluenceLines) return { weight: 0, strokeOpacity: 0 };
    const base = getHexOverlayTuning(mapType, 8);
    return { ...base, strokeColor: '#ffffff', strokeOpacity: 1 };
  }, [mapType, showInfluenceLines]);

  const items = useMemo(() => {
    const result: { key: string; positions: [number, number][][]; level: InfluenceLevelValue; name: string; est?: string }[] = [];
    zonasData.features.forEach((feature, fi) => {
      const est = feature.properties?.est ?? '';
      const name = feature.properties?.name ?? `Zona ${fi + 1}`;
      const station = findStationForZone(est, stations);
      let level: InfluenceLevelValue = 0;
      if (station) {
        if (showAccumulated && station.accumulated != null) {
          level = accumulatedMmToInfluenceLevel(station.accumulated.mm_accumulated);
        } else if (timeWindow === '1h') {
          level = rainfallToInfluenceLevel1h(station.data.h01 ?? 0);
        } else {
          level = rainfallToInfluenceLevel15min(station.data.m15 ?? 0);
        }
      }
      const rings = getZoneRings(feature);
      rings.forEach((positions, pi) => {
        result.push({
          key: `zone-rain-${fi}-${pi}`,
          positions: [positions],
          level,
          name,
          est,
        });
      });
    });
    return result;
  }, [zonasData, stations, timeWindow, showAccumulated]);

  if (!items.length) return null;

  const fillOpacity = 1; // Cor totalmente profunda, sem opacidade

  return (
    <>
      {items.map(({ key, positions, level, name, est }) => {
        const fillColor = getInfluenceColor(level, mapType);
        return (
        <Polygon
          key={key}
          positions={positions}
          pathOptions={{
            color: showInfluenceLines ? '#ffffff' : 'transparent',
            weight: zoneStroke.weight,
            opacity: zoneStroke.strokeOpacity,
            fillColor,
            fillOpacity,
          }}
        >
          <Popup>
            <div style={{ padding: '8px', fontFamily: 'Arial, sans-serif' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#333' }}>{name}</h3>
              {est && <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Estação: {est}</p>}
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#444' }}>
                Nível: {level} (área oficial do pluviômetro)
              </p>
            </div>
          </Popup>
        </Polygon>
        );
      })}
    </>
  );
};
