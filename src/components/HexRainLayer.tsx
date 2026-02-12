import React, { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { RainStation } from '../types/rain';
import { buildHexRainGrid } from '../utils/hexGrid';
import type { BairroCollection } from '../services/citiesApi';
import type { MapTypeId } from './MapControls';
import { getHexOverlayTuning, getInfluenceColor } from '../utils/influenceTheme';

interface HexRainLayerProps {
  stations: RainStation[];
  resolution?: number;
  mapType?: MapTypeId;
  /** Polígonos dos bairros do RJ: hexágonos só dentro dessa região */
  bairrosData?: BairroCollection | null;
}

/** Camada de hexágonos de área de influência da chuva (níveis 0-4+) só na região do RJ */
export const HexRainLayer: React.FC<HexRainLayerProps> = ({
  stations,
  resolution = 9,
  mapType = 'rua',
  bairrosData = null,
}) => {
  const hexCells = useMemo(() => {
    if (!stations.length) return [];
    return buildHexRainGrid(stations, resolution, bairrosData);
  }, [stations, resolution, bairrosData]);

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
