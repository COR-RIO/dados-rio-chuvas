import React from 'react';
import { ImageOverlay } from 'react-leaflet';
import { CorRadarId, getRadarBounds } from '../services/radarCorApi';

interface RadarLayerProps {
  /** Radar ativo (Mendanha/Sumaré) — cada um tem bounds geográficos próprios. */
  radar: CorRadarId;
  /** URL da imagem PNG do frame atual (radares COR Mendanha/Sumaré). */
  imageUrl: string | null;
  opacity?: number;
}

/**
 * Camada de radar meteorológico: imagem PNG do frame atual (Mendanha/Sumaré) sobreposta com bounds.
 *
 * Renderizada no pane 'radar-clouds' (zIndex 250, entre tilePane e overlayPane) para ficar
 * acima do mapa base mas abaixo das zonas/bolinhas coloridas — assim as nuvens do radar não
 * encobrem a cor das áreas de abrangência dos pluviômetros.
 */
export const RadarLayer: React.FC<RadarLayerProps> = ({ radar, imageUrl, opacity = 0.85 }) => {
  if (!imageUrl) return null;
  return (
    <ImageOverlay
      key={imageUrl}
      url={imageUrl}
      bounds={getRadarBounds(radar)}
      opacity={opacity}
      pane="radar-clouds"
    />
  );
};
