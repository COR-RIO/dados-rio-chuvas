import React, { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { RainStation } from '../types/rain';
import { buildHexRainGrid, type HexTimeWindow } from '../utils/hexGrid';
import type { BairroCollection } from '../services/citiesApi';
import type { MapTypeId } from './MapControls';
import { getHexOverlayTuning, getInfluenceColor } from '../utils/influenceTheme';

interface HexRainLayerProps {
  stations: RainStation[];
  resolution?: number;
  mapType?: MapTypeId;
  /** Janela de dados: 15min (m15) ou 1h (h01). Critérios oficiais (Termos Meteorológicos). */
  timeWindow?: HexTimeWindow;
  /** Polígonos dos bairros do RJ: hexágonos só dentro dessa região */
  bairrosData?: BairroCollection | null;
  /** Estilo opcional quando em modo "ambos" (ex.: opacidade reduzida ou só contorno) */
  variant?: 'primary' | 'secondary';
}

/** Camada de hexágonos de área de influência da chuva (níveis 0-4+) só na região do RJ */
export const HexRainLayer: React.FC<HexRainLayerProps> = ({
  stations,
  resolution = 9,
  mapType = 'rua',
  timeWindow = '15min',
  bairrosData = null,
  variant = 'primary',
}) => {
  const hexCells = useMemo(() => {
    if (!stations.length) return [];
    return buildHexRainGrid(stations, resolution, bairrosData, timeWindow);
  }, [stations, resolution, bairrosData, timeWindow]);

  if (!hexCells.length) return null;

  const hexStyle = getHexOverlayTuning(mapType, resolution);
  const isSecondary = variant === 'secondary';
  const fillOpacity = isSecondary ? Math.max(0.25, hexStyle.fillOpacity - 0.35) : hexStyle.fillOpacity;
  const weight = isSecondary ? hexStyle.weight + 0.5 : hexStyle.weight;

  return (
    <>
      {hexCells.map((cell, i) => {
        return (
          <Polygon
            key={`hex-${timeWindow}-${i}`}
            positions={cell.positions}
            pathOptions={{
              color: hexStyle.strokeColor,
              weight,
              opacity: hexStyle.strokeOpacity,
              fillColor: getInfluenceColor(cell.level, mapType),
              fillOpacity,
            }}
          />
        );
      })}
    </>
  );
};
