import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type L from 'leaflet';
import type { WindStation } from '../types/wind';
import { useMapIdle } from '../hooks/useMapIdle';

interface WindSpotlightProps {
  /** Estações em vento forte/muito-forte agora (já filtradas — ver isSignificantWindStation). */
  stations: WindStation[];
  /** Chamado a cada troca de foco, com o id da estação atual (ou null se não há nenhuma
   * significativa) — usado pra manter a linha correspondente sempre em primeiro na tabela. */
  onFocusChange: (stationId: string | null) => void;
  intervalMs?: number;
}

const POINT_ZOOM = 12;
const FLY_TO_OPTIONS: L.ZoomPanOptions = { duration: 1.2 };

/**
 * Aponta a câmera do mapa automaticamente pra estação em vento forte/muito-forte, alternando
 * entre elas quando há mais de uma. Funciona tanto ao vivo quanto no playback histórico — nesse
 * caso `stations` é o frame do instante selecionado na linha do tempo (LeafletMap recalcula a
 * cada passo), então o foco acompanha o que está forte/muito-forte NAQUELE momento do histórico.
 * Enquanto o operador estiver mexendo no mapa (arrastando/zoom), não faz nada — nem troca de foco
 * nem move a câmera (useMapIdle) — retoma o rodízio sozinho assim que o mapa fica ocioso de novo.
 */
export const WindSpotlight: React.FC<WindSpotlightProps> = ({ stations, onFocusChange, intervalMs = 8000 }) => {
  const map = useMap();
  const isInteractingRef = useMapIdle(map);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!stations.length) {
      onFocusChange(null);
      return;
    }
    if (indexRef.current >= stations.length) indexRef.current = 0;

    const tick = () => {
      if (isInteractingRef.current) return; // operador mexendo no mapa: não faz nada
      const station = stations[indexRef.current];
      if (!station) return;
      onFocusChange(station.id);
      map.flyTo(station.location, Math.max(map.getZoom(), POINT_ZOOM), FLY_TO_OPTIONS);
      indexRef.current = (indexRef.current + 1) % stations.length;
    };

    tick();
    if (stations.length < 2) return;

    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [stations, map, onFocusChange, intervalMs]);

  return null;
};
