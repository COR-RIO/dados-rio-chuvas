import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { MapAlert } from '../types/mapAlert';
import { focusMapOnAlert } from '../utils/mapAlertFocus';
import { useMapIdle } from '../hooks/useMapIdle';

interface MapAutoFocusProps {
  alerts: MapAlert[];
}

/**
 * Move a câmera do mapa automaticamente para o alerta mais recente (concentração de chuva numa
 * zona) — mas só quando o operador não estiver mexendo no mapa (arrastando/dando zoom), para não
 * interromper quem já está olhando outra área. Quando o mapa está em uso, o alerta segue
 * disponível no AlertBanner (foco manual via botão).
 */
export const MapAutoFocus: React.FC<MapAutoFocusProps> = ({ alerts }) => {
  const map = useMap();
  const isInteractingRef = useMapIdle(map);
  const lastHandledIdRef = useRef<string | null>(null);

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
