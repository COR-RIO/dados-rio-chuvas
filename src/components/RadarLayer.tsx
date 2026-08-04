import React from 'react';
import { ImageOverlay } from 'react-leaflet';
import { COR_RADAR_BOUNDS } from '../services/radarCorApi';

interface RadarLayerProps {
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
export const RadarLayer: React.FC<RadarLayerProps> = ({ imageUrl, opacity = 0.6 }) => {
  if (!imageUrl) return null;
  return (
    <ImageOverlay
      key={imageUrl}
      url={imageUrl}
      bounds={COR_RADAR_BOUNDS}
      opacity={opacity}
      pane="radar-clouds"
    />
  );
};
