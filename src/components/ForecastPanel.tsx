import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  FORECAST_MODELS,
  FORECAST_POINTS,
  type ForecastModelId,
  type ForecastModelsResult,
} from '../services/forecastModelsApi';
import { ModelStrip } from './ForecastModelStrip';
import {
  coverageNote,
  fmtDateHour,
  fmtMm,
  gustClass,
  nextRainLabel,
  nowInRio,
  rainClass,
  slotKey,
  summarizeWindow,
  upcomingSlots,
  type WindowSummary,
} from '../utils/forecastFormat';

interface ForecastPanelProps {
  data: ForecastModelsResult | null;
  loading: boolean;
  error: string | null;
  enabledModels: ForecastModelId[];
  windowHours: number;
  selectedPointId: string;
  onSelectPoint: (pointId: string) => void;
  onFocusLocation?: (lat: number, lng: number) => void;
}

/** Aba "Previsão" do painel de dados do mapa: resumo pontos × modelos na janela escolhida
 * (a mesma das etiquetas no mapa) e, embaixo, a comparação estilo Windy do ponto selecionado. */
export const ForecastPanel: React.FC<ForecastPanelProps> = ({
  data,
  loading,
  error,
  enabledModels,
  windowHours,
  selectedPointId,
  onSelectPoint,
  onFocusLocation,
}) => {
  const failedModels = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id) && data?.modelErrors[m.id]);
  const models = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id) && !data?.modelErrors[m.id]);
  const now = nowInRio();
  const point = FORECAST_POINTS.find((p) => p.id === selectedPointId) ?? FORECAST_POINTS[0];

  // Janela exibida no mapa, "de ... até ...", pra deixar explícito o horizonte da previsão.
  const firstModelId = models[0]?.id;
  const windowSlots = useMemo(
    () => (firstModelId ? upcomingSlots(data?.forecasts[point.id]?.[firstModelId] ?? [], windowHours) : []),
    [data, point.id, firstModelId, windowHours]
  );
  const highlight = useMemo(() => new Set(windowSlots.map(slotKey)), [windowSlots]);

  // summaries[pointId][modelId] na janela + modelos com buraco em algum ponto (para o aviso).
  const summaries = useMemo(() => {
    const out: Record<string, Partial<Record<ForecastModelId, WindowSummary>>> = {};
    for (const p of FORECAST_POINTS) {
      out[p.id] = {};
      for (const m of models) out[p.id][m.id] = summarizeWindow(data?.forecasts[p.id]?.[m.id] ?? [], windowHours);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, windowHours, models.map((m) => m.id).join()]);
  const gaps = models
    .filter((m) => FORECAST_POINTS.some((p) => (summaries[p.id][m.id]?.missingBlocks ?? 0) > 0))
    .map((m) => m.label);
  const first = windowSlots[0];
  const last = windowSlots[windowSlots.length - 1];

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-gray-500">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {error ? `Erro ao buscar previsões: ${error}` : 'Carregando previsões dos modelos…'}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">
        <p className="font-bold">Previsão para as próximas {windowHours} h</p>
        {first && last && (
          <p className="text-[11px]">
            De {fmtDateHour(first.date, first.hour - 3)} até {fmtDateHour(last.date, last.hour)} — mesma janela das etiquetas
            tracejadas no mapa (faixa destacada abaixo).
          </p>
        )}
      </div>

      {failedModels.map((m) => (
        <p key={m.id} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {m.label} indisponível: {data.modelErrors[m.id]}
        </p>
      ))}

      {/* Resumo: chuva acumulada e maior rajada na janela, por ponto e modelo */}
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500">
            <th className="py-1 pr-2 text-left">Ponto</th>
            {models.map((m) => (
              <th key={m.id} className="px-1 py-1 text-right font-extrabold" style={{ color: m.color }} title={m.description}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FORECAST_POINTS.map((p) => (
            <tr
              key={p.id}
              onClick={() => {
                onSelectPoint(p.id);
                onFocusLocation?.(p.lat, p.lng);
              }}
              className={`cursor-pointer border-b border-gray-100 ${p.id === point.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <td className="py-1 pr-2 font-semibold text-gray-800">{p.name}</td>
              {models.map((m) => {
                const s = summaries[p.id][m.id]!;
                const note = coverageNote(s);
                return (
                  <td key={m.id} className="px-1 py-1 text-right whitespace-nowrap" title={note ?? undefined}>
                    {s.totalMm == null ? (
                      <span className="text-[10px] italic text-amber-700">sem dados</span>
                    ) : s.totalMm === 0 && s.missingBlocks === 0 ? (
                      <span className="inline-flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-semibold text-slate-500">sem chuva</span>
                        <span className="text-[9px] text-slate-400">{nextRainLabel(s)}</span>
                      </span>
                    ) : (
                      <span className={`rounded px-1 font-bold ${rainClass(s.totalMm)}`}>
                        {fmtMm(s.totalMm)}
                        {s.missingBlocks > 0 && <span className="text-amber-700">*</span>}
                      </span>
                    )}
                    {s.maxGustKmh != null && (
                      <span className={`ml-1 text-[10px] ${gustClass(s.maxGustKmh)}`}>{s.maxGustKmh} km/h</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="-mt-2 text-[10px] text-gray-500">mm acumulados na janela · maior rajada em km/h. Clique num ponto para comparar.</p>
      {gaps.length > 0 && (
        <p className="-mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Não foi possível obter a previsão completa de {gaps.join(', ')} para as próximas {windowHours} h — "sem dados" =
          o modelo não trouxe nada para o período; "*" = total parcial (passe o mouse para ver quantos blocos faltam).
          Tente outra janela ou aguarde a próxima rodada.
        </p>
      )}

      {/* Comparação estilo Windy do ponto selecionado */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-800">Comparar previsões: {point.name}</p>
          <select
            value={point.id}
            onChange={(e) => onSelectPoint(e.target.value)}
            className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700"
          >
            {FORECAST_POINTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {models.map((m) => (
            <ModelStrip
              key={m.id}
              label={m.label}
              color={m.color}
              slots={data.forecasts[point.id]?.[m.id] ?? []}
              now={now}
              highlight={highlight}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
