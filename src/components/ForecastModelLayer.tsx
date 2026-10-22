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
import { coverageNote, fmtMm, GUST_ALERT_KMH, nextRainLabel, summarizeWindow, type WindowSummary } from '../utils/forecastFormat';

/** 'max' = pior cenário entre os modelos ligados (útil pro telão: mostra o mais pessimista). */
export type ForecastMapModel = ForecastModelId | 'max';

type ModelSummary = WindowSummary & { modelId: ForecastModelId };

const slotLabel = (s: ForecastSlot) => `${s.date.slice(8, 10)}/${s.date.slice(5, 7)} ${String(s.hour).padStart(2, '0')}h`;

/** Etiqueta retangular tracejada — diferente das bolinhas das estações, pra não confundir
 * previsão com chuva observada. */
function buildForecastIcon(summary: WindowSummary, gustKmh: number | null, windowHours: number): L.DivIcon {
  const { totalMm } = summary;
  const level = getAccumulatedRainLevel(totalMm ?? 0);
  const dark = (totalMm ?? 0) > 16;
  const gust =
    gustKmh != null && gustKmh >= GUST_ALERT_KMH
      ? `<span style="margin-left:4px;color:${gustKmh >= 55 ? '#dc2626' : '#d97706'};font-weight:700">${gustKmh} km/h</span>`
      : '';
  const value =
    totalMm == null
      ? '<span style="font-style:italic;font-weight:600">sem dados</span>'
      : totalMm === 0 && summary.missingBlocks === 0
        ? '<span style="font-weight:600">sem chuva</span>'
        : `${fmtMm(totalMm)} mm${summary.missingBlocks > 0 ? '*' : ''}`;
  return L.divIcon({
    className: '',
    iconSize: undefined,
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;white-space:nowrap;
      padding:2px 6px;border-radius:6px;border:1.5px dashed ${totalMm == null ? '#b45309' : '#1e3a8a'};
      background:${totalMm == null ? '#fef3c7' : level.color};
      color:${dark ? '#fff' : '#0f172a'};font:700 11px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)">
      ${value}<span style="margin-left:3px;font-weight:400;font-size:9px;opacity:.8">/${windowHours}h</span>${gust}</div>`,
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
  const models = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id) && !data.modelErrors[m.id]);

  return (
    <>
      {FORECAST_POINTS.map((point) => {
        const summaries: ModelSummary[] = models.map((m) => ({
          modelId: m.id,
          ...summarizeWindow(data.forecasts[point.id]?.[m.id] ?? [], windowHours),
        }));
        if (!summaries.length) return null;
        // "Maior" ignora modelo sem dados (null conta como -1); só fica "sem dados" se todos estiverem sem.
        const shown =
          model === 'max'
            ? summaries.reduce((a, b) => ((b.totalMm ?? -1) > (a.totalMm ?? -1) ? b : a))
            : summaries.find((s) => s.modelId === model) ?? summaries[0];
        const shownNote = coverageNote(shown);
        const maxGust =
          model === 'max'
            ? summaries.reduce<number | null>((g, s) => (s.maxGustKmh == null ? g : Math.max(g ?? 0, s.maxGustKmh)), null)
            : shown.maxGustKmh;

        return (
          <Marker
            key={`${point.id}-${model}-${windowHours}-${shown.totalMm}-${maxGust}`}
            position={[point.lat, point.lng]}
            icon={buildForecastIcon(shown, maxGust, windowHours)}
            eventHandlers={onSelectPoint ? { click: () => onSelectPoint(point.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              {point.name} — previsão próx. {windowHours} h
              {shownNote && (
                <>
                  <br />
                  <span style={{ color: '#b45309' }}>{shownNote}</span>
                </>
              )}
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
                          <td
                            style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}
                            title={coverageNote(s) ?? undefined}
                          >
                            {s.totalMm == null ? (
                              <span style={{ color: '#b45309', fontStyle: 'italic', fontWeight: 600 }}>sem dados</span>
                            ) : s.totalMm === 0 && s.missingBlocks === 0 ? (
                              <span style={{ color: '#64748b', fontWeight: 600 }}>sem chuva</span>
                            ) : (
                              `${fmtMm(s.totalMm)} mm${s.missingBlocks > 0 ? '*' : ''}`
                            )}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', color: '#475569' }}>
                            {s.maxGustKmh != null ? `${s.maxGustKmh} km/h` : '–'}
                          </td>
                          <td style={{ padding: '3px 0 3px 4px', textAlign: 'right', color: '#64748b', fontSize: '11px' }}>
                            {s.peak ? `pico ${slotLabel(s.peak)}` : s.totalMm === 0 && s.missingBlocks === 0 ? nextRainLabel(s) : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                  {summaries.some((s) => s.missingBlocks > 0) &&
                    '“sem dados” = o modelo não trouxe previsão para o período; * = total parcial. '}
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
