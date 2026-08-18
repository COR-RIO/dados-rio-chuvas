import { useEffect, useRef } from 'react';
import type L from 'leaflet';

/**
 * Detecta se o operador está mexendo no mapa (arrastando/dando zoom) agora. Extraído de
 * MapAutoFocus pra ser reaproveitado por qualquer comportamento automático de câmera (também
 * usado por WindSpotlight) — nenhum deles deve mover o mapa enquanto isInteractingRef.current
 * for true, pra não interromper quem já está olhando outra área.
 */
export function useMapIdle(map: L.Map): React.RefObject<boolean> {
  const isInteractingRef = useRef(false);

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

  return isInteractingRef;
}
