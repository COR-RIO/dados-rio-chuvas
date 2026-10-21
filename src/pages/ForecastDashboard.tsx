import { useMemo, useState } from 'react';
import { CloudRain, Loader2, RefreshCw, AlertTriangle, MapPin, Info } from 'lucide-react';
import { ModelStrip } from '../components/ForecastModelStrip';
import { dayLabel, fmtMm, gustClass, isPast, ktToKmh, nowInRio, rainClass } from '../utils/forecastFormat';
import { useForecastModels } from '../hooks/useForecastModels';
import {
  FORECAST_MODELS,
  FORECAST_POINTS,
  type ForecastModelId,
} from '../services/forecastModelsApi';

/** Horizonte buscado — o mesmo "5 dias" do Windy. O resumo mostra só os primeiros N dias. */
const FORECAST_DAYS = 5;
const SUMMARY_DAY_OPTIONS = [1, 2, 3, 5];
const RAIN_THRESHOLD_OPTIONS = [0.5, 1, 2, 5];


export default function ForecastDashboard() {
  const [enabledModels, setEnabledModels] = useState<ForecastModelId[]>(['ecmwf_ifs', 'meteoblue', 'gfs_seamless', 'icon_seamless']);
  const [summaryDays, setSummaryDays] = useState(2);
  const [rainThreshold, setRainThreshold] = useState(1);
  const [selectedPointId, setSelectedPointId] = useState('praca-bandeira');

  const { data, loading, error, refresh } = useForecastModels(enabledModels, FORECAST_DAYS);
  // Modelo que falhou (ex.: meteoblue sem chave) sai das tabelas e vira aviso — senão apareceria
  // como "sem chuva".
  const failedModels = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id) && data?.modelErrors[m.id]);
  const models = FORECAST_MODELS.filter((m) => enabledModels.includes(m.id) && !data?.modelErrors[m.id]);
  const now = nowInRio();

  const allDays = useMemo(() => {
    const set = new Set<string>();
    for (const byModel of Object.values(data?.forecasts ?? {})) {
      for (const slots of Object.values(byModel)) slots?.forEach((s) => set.add(s.date));
    }
    return [...set].sort().filter((d) => d >= now.date);
  }, [data, now.date]);
  const summaryDates = allDays.slice(0, summaryDays);

  const toggleModel = (id: ForecastModelId) =>
    setEnabledModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : FORECAST_MODELS.map((m) => m.id).filter((m) => m === id || prev.includes(m))
    );

  const selectedPoint = FORECAST_POINTS.find((p) => p.id === selectedPointId) ?? FORECAST_POINTS[0];

  return (
    <div className="h-full overflow-y-auto bg-slate-100">
      {/* Barra de controles */}
      <div className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                <CloudRain className="h-5 w-5 text-sky-400" />
                Comparar previsões
              </h2>
              <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
                Chuva e rajada por modelo numérico em blocos de 3 h — mesma leitura do Windy, para os pontos de
                acompanhamento.
              </p>
            </div>
            {data && (
              <span className="text-xs text-slate-400">
                Atualizado às {data.fetchedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Modelos
              <div className="flex flex-wrap gap-1.5">
                {FORECAST_MODELS.map((m) => {
                  const on = enabledModels.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModel(m.id)}
                      title={m.description}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold normal-case tracking-normal transition-colors ${
                        on ? 'border-white/30 bg-white/15 text-white' : 'border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: on ? m.color : '#475569' }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <SegmentedControl
              label="Dias no resumo"
              options={SUMMARY_DAY_OPTIONS}
              value={summaryDays}
              onChange={setSummaryDays}
              format={(n) => String(n)}
            />
            <SegmentedControl
              label="Chuva mínima (3 h)"
              options={RAIN_THRESHOLD_OPTIONS}
              value={rainThreshold}
              onChange={setRainThreshold}
              format={(n) => `${fmtMm(n)} mm`}
            />

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] space-y-5 px-4 py-6 sm:px-6">
        {failedModels.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {m.label} indisponível: {data?.modelErrors[m.id]}
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Não foi possível buscar as previsões: {error}
          </div>
        )}

        {!models.length && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Selecione ao menos um modelo.
          </div>
        )}

        {/* Resumo: pontos × modelo × dia (substitui a planilha manual) */}
        {models.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">
                Blocos de 3 h com chuva ≥ {fmtMm(rainThreshold)} mm
              </h3>
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold">15h · 1,2 mm · 34 kt</span> = chuva entre 12h e 15h (3 h anteriores, como no Windy) e maior rajada no
                bloco. Clique no ponto para ver o detalhe.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th rowSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">
                      Ponto
                    </th>
                    {models.map((m) => (
                      <th
                        key={m.id}
                        colSpan={summaryDates.length}
                        className="border-b border-r border-slate-200 px-3 py-2 text-center font-extrabold"
                        style={{ color: m.color }}
                        title={m.description}
                      >
                        {m.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 text-slate-500">
                    {models.map((m) =>
                      summaryDates.map((d, i) => (
                        <th
                          key={`${m.id}-${d}`}
                          className={`border-b border-slate-200 px-2 py-1.5 text-center font-semibold ${
                            i === summaryDates.length - 1 ? 'border-r' : ''
                          }`}
                        >
                          {dayLabel(d)}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {FORECAST_POINTS.map((point) => (
                    <tr
                      key={point.id}
                      className={`align-top ${point.id === selectedPointId ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => setSelectedPointId(point.id)}
                          className="whitespace-nowrap font-bold text-slate-800 hover:text-sky-600"
                        >
                          {point.name}
                        </button>
                      </th>
                      {models.map((m) =>
                        summaryDates.map((d, i) => {
                          const slots = (data?.forecasts[point.id]?.[m.id] ?? []).filter(
                            (s) => s.date === d && !isPast(s, now)
                          );
                          const rainy = slots.filter((s) => (s.rainMm ?? 0) >= rainThreshold);
                          const total = slots.reduce((sum, s) => sum + (s.rainMm ?? 0), 0);
                          return (
                            <td
                              key={`${m.id}-${d}`}
                              className={`min-w-[140px] border-b border-slate-200 px-2 py-1.5 ${
                                i === summaryDates.length - 1 ? 'border-r' : ''
                              }`}
                            >
                              {!data ? (
                                <span className="text-slate-300">…</span>
                              ) : rainy.length === 0 ? (
                                // Nenhum bloco passa do filtro, mas pode haver chuva fraca espalhada
                                // (comum no AIFS) — mostra o total pra não parecer "modelo sem chuva".
                                <span className="block text-center text-slate-300">
                                  {total > 0 ? (
                                    <span className="text-[10px] text-slate-400" title={`Nenhum bloco de 3 h ≥ ${fmtMm(rainThreshold)} mm`}>
                                      — · Total: {fmtMm(total)} mm
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {rainy.map((s) => (
                                    <div key={s.hour} className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                                      <span className="w-7 text-right font-semibold text-slate-600">
                                        {String(s.hour).padStart(2, '0')}h
                                      </span>
                                      <span className={`rounded px-1 font-bold ${rainClass(s.rainMm ?? 0)}`}>
                                        {fmtMm(s.rainMm ?? 0)} mm
                                      </span>
                                      {s.gustKt != null && (
                                        <span className={gustClass(s.gustKt)} title={`${ktToKmh(s.gustKt)} km/h`}>
                                          {s.gustKt} kt
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  <div className="pt-0.5 text-[10px] text-slate-400">Total: {fmtMm(total)} mm</div>
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detalhe do ponto: faixa por modelo, como no "Comparar previsões" do Windy */}
        {models.length > 0 && data && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MapPin className="h-4 w-4 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-800">{selectedPoint.name}</h3>
              <select
                value={selectedPointId}
                onChange={(e) => setSelectedPointId(e.target.value)}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                {FORECAST_POINTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-4 p-4">
              {models.map((m) => (
                <ModelStrip key={m.id} label={m.label} color={m.color} slots={data.forecasts[selectedPoint.id]?.[m.id] ?? []} now={now} />
              ))}
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Dados dos modelos ECMWF (open data), NOAA GFS e DWD ICON via Open-Meteo, atualizados a cada rodada (3–6 h).
          Rajada e vento em nós (kt); passe o mouse para ver em km/h. O meteoblue do Windy é proprietário e não tem dado
          aberto. Valores do modelo para a célula da grade mais próxima do ponto — podem diferir levemente do Windy, que
          interpola de outra forma.
        </p>
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
      {label}
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-2 text-xs font-bold normal-case tracking-normal transition-colors ${
              value === opt ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {format(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
