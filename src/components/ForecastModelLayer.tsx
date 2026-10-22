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

/** 'consenso' = mediana entre os modelos ligados + máximo (com o modelo) + quantos passam do limiar. */
export type ForecastMapModel = ForecastModelId | 'consenso';

type ModelSummary = WindowSummary & { modelId: ForecastModelId };

/** Limiar da concordância ("2/4 ≥ 5 mm") e do destaque de sinal escondido pela mediana. */
export const CONSENSUS_THRESHOLD_MM = 5;

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

interface Consensus {
  /** Mediana dos modelos com dado (null = nenhum modelo trouxe dado). Mediana e não média: chuva
   * não é simétrica — a média de 30/0/0/0 dá 7,5 mm, cenário que nenhum modelo prevê. */
  medianMm: number | null;
  medianGustKmh: number | null;
  max: ModelSummary | null;
  /** Modelos com acumulado >= CONSENSUS_THRESHOLD_MM, entre os `withData` que trouxeram dado. */
  agree: number;
  withData: number;
  partial: boolean;
}

function consensusOf(summaries: ModelSummary[]): Consensus {
  const withData = summaries.filter((s) => s.totalMm != null);
  const gusts = summaries.map((s) => s.maxGustKmh).filter((g): g is number => g != null);
  return {
    medianMm: withData.length ? Math.round(median(withData.map((s) => s.totalMm!)) * 10) / 10 : null,
    medianGustKmh: gusts.length ? Math.round(median(gusts)) : null,
    max: withData.reduce<ModelSummary | null>((a, b) => (!a || b.totalMm! > a.totalMm! ? b : a), null),
    agree: withData.filter((s) => s.totalMm! >= CONSENSUS_THRESHOLD_MM).length,
    withData: withData.length,
    partial: withData.some((s) => s.missingBlocks > 0),
  };
}

const slotLabel = (s: ForecastSlot) => `${s.date.slice(8, 10)}/${s.date.slice(5, 7)} ${String(s.hour).padStart(2, '0')}h`;

/** Etiqueta retangular tracejada — diferente das bolinhas das estações, pra não confundir
 * previsão com chuva observada. */
function buildForecastIcon(
  summary: Pick<WindowSummary, 'totalMm' | 'missingBlocks'>,
  gustKmh: number | null,
  windowHours: number,
  /** Modo consenso: 2ª linha ("máx 5,7 ECMWF · 1/4 ≥5") e borda de alerta. */
  consensus?: { line: string; alert: boolean }
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
  const border = consensus?.alert ? '2px dashed #dc2626' : `1.5px dashed ${totalMm == null ? '#b45309' : '#1e3a8a'}`;
  const second = consensus
    ? `<div style="font-weight:600;font-size:9px;opacity:.85;margin-top:1px">${consensus.line}</div>`
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
        const cons = model === 'consenso' ? consensusOf(summaries) : null;
        const shown = summaries.find((s) => s.modelId === model) ?? summaries[0];
        const label = cons
          ? { totalMm: cons.medianMm, missingBlocks: cons.partial ? 1 : 0 }
          : { totalMm: shown.totalMm, missingBlocks: shown.missingBlocks };
        const gustKmh = cons ? cons.medianGustKmh : shown.maxGustKmh;
        const maxLabel = cons?.max && cons.max.totalMm! > 0
          ? `máx ${fmtMm(cons.max.totalMm!)} ${FORECAST_MODELS.find((m) => m.id === cons.max!.modelId)?.label} · `
          : '';
        const consensusLine = cons && cons.withData
          ? {
              line: `${maxLabel}${cons.agree}/${cons.withData} ≥${CONSENSUS_THRESHOLD_MM} mm`,
              // Algum modelo vê chuva relevante que a mediana esconde — não deixa o sinal sumir.
              alert: cons.agree > 0 && (cons.medianMm ?? 0) < CONSENSUS_THRESHOLD_MM,
            }
          : undefined;
        const shownNote = cons
          ? cons.withData < summaries.length
            ? `${summaries.length - cons.withData} modelo(s) sem dados para o período — fora da mediana.`
            : null
          : coverageNote(shown);

        return (
          <Marker
            key={`${point.id}-${model}-${windowHours}-${label.totalMm}-${gustKmh}-${consensusLine?.line}`}
            position={[point.lat, point.lng]}
            icon={buildForecastIcon(label, gustKmh, windowHours, consensusLine)}
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
                {cons && cons.withData > 0 && (
                  <p
                    style={{
                      margin: '0 0 6px 0',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: consensusLine?.alert ? '#fef2f2' : '#eef2ff',
                      color: consensusLine?.alert ? '#991b1b' : '#312e81',
                    }}
                  >
                    <b>Consenso:</b> mediana {fmtMm(cons.medianMm ?? 0)} mm · {cons.agree} de {cons.withData} modelos preveem ≥{' '}
                    {CONSENSUS_THRESHOLD_MM} mm
                    {consensusLine?.alert && ' — atenção: há modelo prevendo chuva relevante acima da mediana.'}
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
