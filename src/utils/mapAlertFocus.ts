import L from 'leaflet';
import type { MapAlert } from '../types/mapAlert';

const FLY_TO_OPTIONS: L.ZoomPanOptions = { duration: 1.2 };
const FIT_BOUNDS_OPTIONS: L.FitBoundsOptions = { padding: [32, 32], maxZoom: 13 };
const POINT_ZOOM = 12;

/** Move a câmera do mapa para o local de um alerta — ponto único (vento) via flyTo, ou região
 * (chuva, várias estações da mesma zona) via fitBounds. Compartilhado entre o auto-foco
 * (MapAutoFocus) e o botão manual "Ver no mapa" (AlertBanner). */
export function focusMapOnAlert(map: L.Map, alert: MapAlert): void {
  if (alert.points && alert.points.length > 0) {
    map.fitBounds(L.latLngBounds(alert.points), FIT_BOUNDS_OPTIONS);
  } else if (alert.location) {
    map.flyTo(alert.location, Math.max(map.getZoom(), POINT_ZOOM), FLY_TO_OPTIONS);
  }
}
