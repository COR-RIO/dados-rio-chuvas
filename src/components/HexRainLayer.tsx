import React, { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { RainStation } from '../types/rain';
import { buildHexRainGrid, buildHexRainGridFromZonas, type HexTimeWindow } from '../utils/hexGrid';
import type { BairroCollection, ZonasPluvCollection } from '../services/citiesApi';
import type { MapTypeId } from './MapControls';
import { getHexOverlayTuning, getInfluenceColor } from '../utils/influenceTheme';

interface HexRainLayerProps {
  stations: RainStation[];
  resolution?: number;
  mapType?: MapTypeId;
  /** Janela de dados: 15min (m15) ou 1h (h01). Critérios oficiais (Termos Meteorológicos). */
  timeWindow?: HexTimeWindow;
  /** Polígonos dos bairros do RJ: hexágonos só dentro dessa região (usado quando não há zonasData) */
  bairrosData?: BairroCollection | null;
  /** Zonas oficiais (zonas-pluviometricas.geojson): hexágonos ficam exatamente dentro da área de abrangência de cada estação */
  zonasData?: ZonasPluvCollection | null;
  /** Quando true, usa mm_accumulated para o nível (vista acumulado no período) */
  showAccumulated?: boolean;
  /** Estilo opcional quando em modo "ambos" (ex.: opacidade reduzida ou só contorno) */
  variant?: 'primary' | 'secondary';
  /** Quando true, desenha contorno dos hexágonos (cor branca). Quando false, sem linhas. */
  showInfluenceLines?: boolean;
}

/** Camada de hexágonos de área de influência da chuva (níveis 0-4+). Com zonasData, cada hexágono fica exatamente na área de abrangência da estação. */
export const HexRainLayer: React.FC<HexRainLayerProps> = ({
  stations,
  resolution = 9,
  mapType = 'rua',
  timeWindow = '15min',
  bairrosData = null,
  zonasData = null,
  showAccumulated = false,
  variant = 'primary',
  showInfluenceLines = true,
}) => {
  const hexCells = useMemo(() => {
    if (!stations.length) return [];
    if (zonasData?.features?.length) {
      return buildHexRainGridFromZonas(zonasData, stations, resolution, timeWindow, showAccumulated);
    }
    return buildHexRainGrid(stations, resolution, bairrosData, timeWindow);
  }, [stations, resolution, bairrosData, zonasData, timeWindow, showAccumulated]);

  if (!hexCells.length) return null;

  const hexStyle = getHexOverlayTuning(mapType, resolution);
  const isSecondary = variant === 'secondary';
  const fillOpacity = isSecondary ? Math.max(0.25, hexStyle.fillOpacity - 0.35) : hexStyle.fillOpacity;
  const weight = isSecondary ? hexStyle.weight + 0.5 : hexStyle.weight;
  const strokeColor = showInfluenceLines ? '#ffffff' : 'transparent';
  const strokeWeight = showInfluenceLines ? weight : 0;
  const strokeOpacity = showInfluenceLines ? 1 : 0;

  return (
    <>
      {hexCells.map((cell, i) => {
        return (
          <Polygon
            key={`hex-${timeWindow}-${i}`}
            positions={cell.positions}
            pathOptions={{
              color: strokeColor,
              weight: strokeWeight,
              opacity: strokeOpacity,
              fillColor: getInfluenceColor(cell.level, mapType),
              fillOpacity,
            }}
          />
        );
      })}
    </>
  );
};
