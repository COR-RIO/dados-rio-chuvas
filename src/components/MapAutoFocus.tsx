import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { MapAlert } from '../types/mapAlert';
import { focusMapOnAlert } from '../utils/mapAlertFocus';

interface MapAutoFocusProps {
  alerts: MapAlert[];
}

/**
 * Move a câmera do mapa automaticamente para o alerta mais recente (vento forte via SPECI, ou
 * concentração de chuva numa zona) — mas só quando o operador não estiver mexendo no mapa
 * (arrastando/dando zoom), para não interromper quem já está olhando outra área. Quando o mapa
 * está em uso, o alerta segue disponível no AlertBanner (foco manual via botão).
 */
export const MapAutoFocus: React.FC<MapAutoFocusProps> = ({ alerts }) => {
  const map = useMap();
  const isInteractingRef = useRef(false);
  const lastHandledIdRef = useRef<string | null>(null);

  useEffect(() => {
    const setInteracting = () => {
      isInteractingRef.current = true;
    };
    const clearInteracting = () => {
      isInteractingRef.current = false;
    };
    map.on('dragstart', setInteracting);
    map.on('zoomstart', setInteracting);
    map.on('dragend', clearInteracting);
    map.on('zoomend', clearInteracting);
    map.on('moveend', clearInteracting);
    return () => {
      map.off('dragstart', setInteracting);
      map.off('zoomstart', setInteracting);
      map.off('dragend', clearInteracting);
      map.off('zoomend', clearInteracting);
      map.off('moveend', clearInteracting);
    };
  }, [map]);

  useEffect(() => {
    if (!alerts.length) return;
    const latest = alerts[alerts.length - 1];
    if (latest.id === lastHandledIdRef.current) return;
    lastHandledIdRef.current = latest.id;
    if (isInteractingRef.current) return;
    focusMapOnAlert(map, latest);
  }, [alerts, map]);

  return null;
};
