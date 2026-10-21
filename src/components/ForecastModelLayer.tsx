import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import {
  FORECAST_MODELS,
  FORECAST_POINTS,
  type ForecastModelId,
  type ForecastModelsResult,
  type ForecastSlot,
} from '../services/forecastModelsApi';
import { getAccumulatedRainLevel } from '../utils/rainLevel';
import { fmtMm, upcomingSlots } from '../utils/forecastFormat';

/** 'max' = pior cenário entre os modelos ligados (útil pro telão: mostra o mais pessimista). */
export type ForecastMapModel = ForecastModelId | 'max';

interface ModelSummary {
  modelId: ForecastModelId;
  totalMm: number;
  maxGustKt: number | null;
  /** Bloco com mais chuva (pico), para dizer "quando". */
  peak: ForecastSlot | null;
}

function summarize(modelId: ForecastModelId, slots: ForecastSlot[]): ModelSummary {
  let totalMm = 0;
  let maxGustKt: number | null = null;
  let peak: ForecastSlot | null = null;
  for (const s of slots) {
    totalMm += s.rainMm ?? 0;
    if (s.gustKt != null) maxGustKt = Math.max(maxGustKt ?? 0, s.gustKt);
    if ((s.rainMm ?? 0) > 0 && (!peak || (s.rainMm ?? 0) > (peak.rainMm ?? 0))) peak = s;
  }
  return { modelId, totalMm: Math.round(totalMm * 10) / 10, maxGustKt, peak };
}

const slotLabel = (s: ForecastSlot) => `${s.date.slice(8, 10)}/${s.date.slice(5, 7)} ${String(s.hour).padStart(2, '0')}h`;

/** Etiqueta retangular tracejada — diferente das bolinhas das estações, pra não confundir
 * previsão com chuva observada. */
function buildForecastIcon(totalMm: number, gustKt: number | null, windowHours: number): L.DivIcon {
  const level = getAccumulatedRainLevel(totalMm);
  const dark = totalMm > 16;
  const gust =
    gustKt != null && gustKt >= 22
      ? `<span style="margin-left:4px;color:${gustKt >= 30 ? '#dc2626' : '#d97706'};font-weight:700">${gustKt}kt</span>`
      : '';
  return L.divIcon({
    className: '',
    iconSize: undefined,
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;white-space:nowrap;
      padding:2px 6px;border-radius:6px;border:1.5px dashed #1e3a8a;background:${level.color};
      color:${dark ? '#fff' : '#0f172a'};font:700 11px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)">
      ${fmtMm(totalMm)} mm<span style="margin-left:3px;font-weight:400;font-size:9px;opacity:.8">/${windowHours}h</span>${gust}</div>`,
  });
}

interface ForecastModelLayerProps {
  data: ForecastModelsResult | null;
  enabledModels: ForecastModelId[];
  model: ForecastMapModel;
  windowHours: number;
  /** Clique na etiqueta: abre a comparação dos modelos desse ponto no painel lateral. */
  onSelectPoint?: (pointId: string) => void;
}

export const ForecastModelLayer: React.FC<ForecastModelLayerProps> = ({ data, enabledModels, model, windowHours, onSelectPoint }) => {
  if (!data) return null;
  const models = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id));

  return (
    <>
      {FORECAST_POINTS.map((point) => {
        const summaries = models.map((m) =>
          summarize(m.id, upcomingSlots(data.forecasts[point.id]?.[m.id] ?? [], windowHours))
        );
        if (!summaries.length) return null;
        const shown =
          model === 'max'
            ? summaries.reduce((a, b) => (b.totalMm > a.totalMm ? b : a))
            : summaries.find((s) => s.modelId === model) ?? summaries[0];
        const maxGust =
          model === 'max'
            ? summaries.reduce<number | null>((g, s) => (s.maxGustKt == null ? g : Math.max(g ?? 0, s.maxGustKt)), null)
            : shown.maxGustKt;

        return (
          <Marker
            key={`${point.id}-${model}-${windowHours}-${shown.totalMm}-${maxGust}`}
            position={[point.lat, point.lng]}
            icon={buildForecastIcon(shown.totalMm, maxGust, windowHours)}
            eventHandlers={onSelectPoint ? { click: () => onSelectPoint(point.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              {point.name} — previsão próx. {windowHours} h
            </Tooltip>
            <Popup>
              <div style={{ padding: '6px', fontFamily: 'Arial, sans-serif', minWidth: '230px' }}>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{point.name}</h3>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748b' }}>
                  Previsão para as próximas {windowHours} h (chuva acumulada · maior rajada)
                </p>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {summaries.map((s) => {
                      const m = models.find((x) => x.id === s.modelId)!;
                      return (
                        <tr key={s.modelId} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '3px 4px 3px 0', fontWeight: 700, color: m.color }}>{m.label}</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>{fmtMm(s.totalMm)} mm</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', color: '#475569' }}>
                            {s.maxGustKt != null ? `${s.maxGustKt} kt` : '–'}
                          </td>
                          <td style={{ padding: '3px 0 3px 4px', textAlign: 'right', color: '#64748b', fontSize: '11px' }}>
                            {s.peak ? `pico ${slotLabel(s.peak)}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                  Comparação hora a hora aberta no painel “Previsão” ao lado.
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};
