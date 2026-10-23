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

/** 'max' = pior cenário entre os modelos ligados (maior acumulado, com o modelo que o previu). */
export type ForecastMapModel = ForecastModelId | 'max';

type ModelSummary = WindowSummary & { modelId: ForecastModelId };

interface MaxSummary {
  /** Modelo com o maior acumulado (null = nenhum modelo trouxe dado). */
  max: ModelSummary | null;
  /** Modelo com o bloco de 3 h mais chuvoso — pode não ser o de maior acumulado (chuva concentrada
   * num bloco × espalhada pela janela). */
  peak: ModelSummary | null;
  maxGustKmh: number | null;
  withData: number;
}

function maxOf(summaries: ModelSummary[]): MaxSummary {
  const withData = summaries.filter((s) => s.totalMm != null);
  const gusts = summaries.map((s) => s.maxGustKmh).filter((g): g is number => g != null);
  return {
    max: withData.reduce<ModelSummary | null>((a, b) => (!a || b.totalMm! > a.totalMm! ? b : a), null),
    peak: summaries
      .filter((s) => s.peak)
      .reduce<ModelSummary | null>((a, b) => (!a || b.peak!.rainMm! > a.peak!.rainMm! ? b : a), null),
    maxGustKmh: gusts.length ? Math.max(...gusts) : null,
    withData: withData.length,
  };
}

const slotLabel = (s: ForecastSlot) => `${s.date.slice(8, 10)}/${s.date.slice(5, 7)} ${String(s.hour).padStart(2, '0')}h`;

/** Bloco de 3 h mais chuvoso: o horário do slot é o FIM do bloco ("0,8 mm entre 12h e 15h de 23/10"). */
const peakLabel = (s: ForecastSlot) => {
  const pad = (h: number) => `${String(h).padStart(2, '0')}h`;
  return `${fmtMm(s.rainMm ?? 0)} mm entre ${pad((s.hour + 21) % 24)} e ${pad(s.hour)} de ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`;
};

/** Etiqueta retangular tracejada — diferente das bolinhas das estações, pra não confundir
 * previsão com chuva observada. */
function buildForecastIcon(
  summary: Pick<WindowSummary, 'totalMm' | 'missingBlocks'>,
  gustKmh: number | null,
  windowHours: number,
  /** Modo máximo: 2ª linha com o modelo que previu o máximo ("ECMWF"). */
  secondLine?: string
): L.DivIcon {
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
      : `${fmtMm(totalMm)} mm${summary.missingBlocks > 0 ? '*' : ''}`;
  const border = `1.5px dashed ${totalMm == null ? '#b45309' : '#1e3a8a'}`;
  const second = secondLine
    ? `<div style="font-weight:600;font-size:9px;opacity:.85;margin-top:1px">${secondLine}</div>`
    : '';
  return L.divIcon({
    className: '',
    iconSize: undefined,
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:inline-flex;flex-direction:column;align-items:center;white-space:nowrap;
      padding:2px 6px;border-radius:6px;border:${border};
      background:${totalMm == null ? '#fef3c7' : level.color};
      color:${dark ? '#fff' : '#0f172a'};font:700 11px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)">
      <div style="display:inline-flex;align-items:center">${value}<span style="margin-left:3px;font-weight:400;font-size:9px;opacity:.8">/${windowHours}h</span>${gust}</div>${second}</div>`,
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
        // "Máximo" ignora modelo sem dados; só fica "sem dados" se todos estiverem sem.
        const mx = model === 'max' ? maxOf(summaries) : null;
        const shown = mx ? mx.max ?? summaries[0] : summaries.find((s) => s.modelId === model) ?? summaries[0];
        const label = { totalMm: shown.totalMm, missingBlocks: shown.missingBlocks };
        const gustKmh = mx ? mx.maxGustKmh : shown.maxGustKmh;
        // No modo máximo o pico é o maior bloco entre TODOS os modelos, não só o do maior acumulado.
        const peakOwner = mx ? mx.peak : shown;
        // Sem chuva em nenhum modelo não há "quem previu o máximo" — fica só o número.
        const secondLine = mx?.max && mx.max.totalMm! > 0
          ? FORECAST_MODELS.find((m) => m.id === mx.max!.modelId)?.label
          : undefined;
        const shownNote = mx
          ? mx.withData < summaries.length
            ? `${summaries.length - mx.withData} modelo(s) sem dados para o período — fora do máximo.`
            : coverageNote(shown)
          : coverageNote(shown);

        return (
          <Marker
            key={`${point.id}-${model}-${windowHours}-${label.totalMm}-${gustKmh}-${secondLine}`}
            position={[point.lat, point.lng]}
            icon={buildForecastIcon(label, gustKmh, windowHours, secondLine)}
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
                {shown.totalMm != null && (
                  <p
                    style={{
                      margin: '0 0 6px 0',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: '#eef2ff',
                      color: '#312e81',
                    }}
                  >
                    <b>{mx ? 'Máximo' : 'Previsão'}:</b> {fmtMm(shown.totalMm)} mm (
                    {FORECAST_MODELS.find((m) => m.id === shown.modelId)?.label})
                    {peakOwner?.peak && (
                      <>
                        <br />
                        <b>Pico:</b> {peakLabel(peakOwner.peak)} ({FORECAST_MODELS.find((m) => m.id === peakOwner.modelId)?.label})
                      </>
                    )}
                  </p>
                )}
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
