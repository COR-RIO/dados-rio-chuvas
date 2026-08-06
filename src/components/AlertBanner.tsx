import { useMap } from 'react-leaflet';
import { Wind, CloudRain, X } from 'lucide-react';
import type { MapAlert, MapAlertKind } from '../types/mapAlert';
import { focusMapOnAlert } from '../utils/mapAlertFocus';

interface AlertBannerProps {
  alerts: MapAlert[];
  onDismiss: (id: string) => void;
}

const KIND_ICON: Record<MapAlertKind, typeof Wind> = {
  vento: Wind,
  chuva: CloudRain,
};

/**
 * Notificação visível dos alertas ativos (vento forte via SPECI, concentração de chuva numa
 * zona) — sempre aparece, mesmo quando o mapa já se moveu sozinho (MapAutoFocus só move a câmera
 * se o mapa estiver ocioso; aqui o operador pode focar manualmente a qualquer momento, inclusive
 * de novo, e dispensar alertas já vistos).
 */
export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onDismiss }) => {
  const map = useMap();
  if (!alerts.length) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] flex flex-col gap-2 w-[min(92vw,420px)] pointer-events-none">
      {alerts.map((alert) => {
        const Icon = KIND_ICON[alert.kind];
        return (
          <div
            key={alert.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-sm text-amber-900 shadow-lg"
          >
            <Icon className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="flex-1 truncate">{alert.label}</span>
            <button
              type="button"
              onClick={() => focusMapOnAlert(map, alert)}
              className="shrink-0 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              Ver no mapa
            </button>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 text-amber-700 hover:text-amber-900"
              aria-label="Dispensar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
