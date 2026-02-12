import React, { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { RainStation } from '../types/rain';
import { buildHexRainGrid } from '../utils/hexGrid';
import type { BairroCollection } from '../services/citiesApi';
import type { MapTypeId } from './MapControls';
import { getHexOverlayTuning, getInfluenceColor } from '../utils/influenceTheme';
import { getStationEquivalentIntensityMmh, normalizeWindowMinutes } from '../utils/rainWindow';

interface HexRainLayerProps {
  stations: RainStation[];
  resolution?: number;
  mapType?: MapTypeId;
  timeWindowMinutes?: number;
  /** Polígonos dos bairros do RJ: hexágonos só dentro dessa região */
  bairrosData?: BairroCollection | null;
}

/** Camada de hexágonos de área de influência da chuva (níveis 0-4+) só na região do RJ */
export const HexRainLayer: React.FC<HexRainLayerProps> = ({
  stations,
  resolution = 9,
  mapType = 'rua',
  timeWindowMinutes = 15,
  bairrosData = null,
}) => {
  const normalizedWindow = normalizeWindowMinutes(timeWindowMinutes);

  const stationsForInfluence = useMemo(
    () =>
      stations.map((s) => ({
        ...s,
        data: {
          ...s.data,
          // h01 passa a representar a intensidade equivalente (mm/h) da janela escolhida
          h01: getStationEquivalentIntensityMmh(s, normalizedWindow),
        },
      })),
    [stations, normalizedWindow]
  );

  const hexCells = useMemo(() => {
    if (!stationsForInfluence.length) return [];
    return buildHexRainGrid(stationsForInfluence, resolution, bairrosData);
  }, [stationsForInfluence, resolution, bairrosData]);

  if (!hexCells.length) return null;

  const hexStyle = getHexOverlayTuning(mapType, resolution);

  return (
    <>
      {hexCells.map((cell, i) => {
        return (
          <Polygon
            key={`hex-${i}`}
            positions={cell.positions}
            pathOptions={{
              color: hexStyle.strokeColor,
              weight: hexStyle.weight,
              opacity: hexStyle.strokeOpacity,
              fillColor: getInfluenceColor(cell.level, mapType),
              fillOpacity: hexStyle.fillOpacity,
            }}
          />
        );
      })}
    </>
  );
};
