import React, { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { RainStation } from '../types/rain';
import { buildHexRainGrid } from '../utils/hexGrid';
import { INFLUENCE_LEVELS } from '../types/alertaRio';
import type { BairroCollection } from '../services/citiesApi';

interface HexRainLayerProps {
  stations: RainStation[];
  resolution?: number;
  /** Polígonos dos bairros do RJ: hexágonos só dentro dessa região */
  bairrosData?: BairroCollection | null;
}

/** Camada de hexágonos de área de influência da chuva (níveis 0-4+) só na região do RJ */
export const HexRainLayer: React.FC<HexRainLayerProps> = ({
  stations,
  resolution = 9,
  bairrosData = null,
}) => {
  const hexCells = useMemo(() => {
    if (!stations.length) return [];
    return buildHexRainGrid(stations, resolution, bairrosData);
  }, [stations, resolution, bairrosData]);

  if (!hexCells.length) return null;

  return (
    <>
      {hexCells.map((cell, i) => {
        const levelConfig = INFLUENCE_LEVELS[cell.level];
        return (
          <Polygon
            key={`hex-${i}`}
            positions={cell.positions}
            pathOptions={{
              color: '#fff',
              weight: 1,
              opacity: 0.9,
              fillColor: levelConfig.color,
              fillOpacity: 0.75,
            }}
          />
        );
      })}
    </>
  );
};
