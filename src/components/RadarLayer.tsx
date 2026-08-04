import React from 'react';
import { TileLayer } from 'react-leaflet';

interface RadarLayerProps {
  tileUrl: string | null;
  opacity?: number;
}

/** Camada de radar meteorológico (RainViewer) — max zoom nativo 7, Leaflet amplia acima disso. */
export const RadarLayer: React.FC<RadarLayerProps> = ({ tileUrl, opacity = 0.6 }) => {
  if (!tileUrl) return null;
  return (
    <TileLayer
      key={tileUrl}
      url={tileUrl}
      opacity={opacity}
      maxNativeZoom={7}
      zIndex={350}
    />
  );
};
