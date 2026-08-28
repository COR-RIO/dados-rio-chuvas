import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
} from 'recharts';
import {
  Droplets,
  Wind,
  AlertTriangle,
  CloudRain,
  MapPin,
  Timer,
  BarChart3,
  RefreshCw,
  CalendarRange,
  Loader2,
  Info,
  FileSpreadsheet,
  CheckCircle2,
  X,
} from 'lucide-react';
import { buildAnalysisReport, RAIN_LEVEL_LABELS, RAIN_LEVEL_COLORS, type AnalysisReport, type RainLevelKey } from '../services/analysisReport';
import { ChartCard } from '../components/analysis/ChartCard';
import { KpiCard } from '../components/analysis/KpiCard';
import { parseOccurrencesFromArrayBuffer } from '../utils/importOccurrencesXlsx';
import type { Occurrence } from '../types/occurrence';

const RAIN_LEVEL_ORDER: RainLevelKey[] = ['sem', 'fraca', 'moderada', 'forte', 'muito-forte'];

const OCC_PALETTE = ['#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#F43F5E', '#84CC16', '#64748B'];

/** Estágios: paleta fixa (amarelo/laranja como referência) + código curto para a faixa inferior. */
const ESTAGIO_PALETTE = ['#F59E0B', '#FBBF24', '#10B981', '#0EA5E9', '#EC4899', '#8B5CF6', '#64748B'];

/** Séries selecionáveis no gráfico "Ocorrências por período". */
const SERIES_OPTS = [
  { key: 'total', label: 'TOTAL', color: '#7DD3FC' },
  { key: 'abertas', label: 'Abertas', color: '#E11D48' },
  { key: 'fechadas', label: 'Fechadas', color: '#84CC16' },
  { key: 'chuva', label: 'Chuva (mm)', color: '#3B82F6' },
  { key: 'vento', label: 'Rajada (km/h)', color: '#F59E0B' },
  { key: 'ventoMedio', label: 'Vento médio (km/h)', color: '#38BDF8' },
] as const;

type SeriesKey = (typeof SERIES_OPTS)[number]['key'];

/** Código curto (até 3 caracteres) para exibir no box do estágio. */
function estagioShort(nome: string): string {
  const s = nome.trim();
  if (!s) return '—';
  const words = s.split(/\s+/);
  if (words.length === 1) return s.slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function periodLabel(de: string, ate: string): string {
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
  };
  return de === ate ? fmtDate(de) : `${fmtDate(de)} a ${fmtDate(ate)}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

const PRESETS = [
  { label: 'Hoje', days: 0 },
  { label: '3 dias', days: 2 },
  { label: '7 dias', days: 6 },
  { label: '30 dias', days: 29 },
];

interface ChartTipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: { fill?: string };
}

interface ChartTipProps {
  active?: boolean;
  payload?: ChartTipEntry[];
  label?: string | number;
  prefix?: string;
  dark?: boolean;
}

function ChartTip({ active, payload, label, prefix, dark }: ChartTipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
        dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
      }`}
    >
      <p className={`mb-1 font-bold ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
        {prefix ? `${prefix} ` : ''}{label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className={`flex items-center gap-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color ?? entry.payload?.fill }} />
          <span>{String(entry.name)}: </span>
          <span className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{fmt(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

const axisTick = { fontSize: 11, fill: '#64748B' };
const axisTickClean = { fontSize: 11, fill: '#94a3b8' };
const axisTickCleanDim = { fontSize: 11, fill: '#64748b' };

export function AnalysisDashboard() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultDe = useMemo(() => addDays(today, -2), [today]);

  const [de, setDe] = useState(defaultDe);
  const [ate, setAte] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const autoLoadRef = useRef(false);

  // Planilha de ocorrências carregada pelo usuário (funciona fora da rede do COR).
  const [planilhaOccurrences, setPlanilhaOccurrences] = useState<Occurrence[] | null>(null);
  const [planilhaFileName, setPlanilhaFileName] = useState<string | null>(null);
  const [planilhaUploadError, setPlanilhaUploadError] = useState<string | null>(null);

  // Agrupamento do cruzamento (hora em hora ou por dia). Padrão: hora em hora.
  const [granularidade, setGranularidade] = useState<'auto' | 'hora' | 'dia'>('hora');
  const granularidadeEfetiva: 'hora' | 'dia' =
    granularidade === 'auto' ? (report?.cruzamento.granularidade ?? 'hora') : granularidade;

  const run = useCallback(
    async (d: string, a: string, override?: Occurrence[], gran?: 'hora' | 'dia') => {
      setLoading(true);
      setError(null);
      try {
        const result = await buildAnalysisReport({
          de: d,
          ate: a,
          granularidade: gran ?? (granularidade === 'auto' ? undefined : granularidade),
          ocorrenciasOverride: override ?? planilhaOccurrences ?? undefined,
        });
        setReport(result);
      } catch (err) {
        setReport(null);
        setError(err instanceof Error ? err.message : 'Erro ao gerar a análise.');
      } finally {
        setLoading(false);
      }
    },
    [planilhaOccurrences, granularidade]
  );

  const changeGranularidade = (g: 'auto' | 'hora' | 'dia') => {
    setGranularidade(g);
    run(de, ate, undefined, g === 'auto' ? undefined : g);
  };

  const handlePlanilhaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok =
      /^\.xlsx$/i.test(file.name) ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!ok) {
      setPlanilhaUploadError('Use um arquivo .xlsx (formato Relação de Ocorrências).');
      return;
    }
    setPlanilhaUploadError(null);
    try {
      const buf = await file.arrayBuffer();
      const list = parseOccurrencesFromArrayBuffer(buf);
      if (list.length === 0) {
        setPlanilhaUploadError('Nenhuma ocorrência válida. Confira as colunas (ex.: Ocorrência) e o formato.');
        setPlanilhaOccurrences(null);
        setPlanilhaFileName(null);
        return;
      }
      setPlanilhaOccurrences(list);
      setPlanilhaFileName(file.name);
      // Regenera automaticamente usando a planilha recém-carregada (passa a lista explicitamente
      // porque o estado ainda não re-renderizou).
      if (de && ate) run(de, ate, list);
    } catch (err) {
      setPlanilhaUploadError(err instanceof Error ? err.message : 'Erro ao ler a planilha.');
      setPlanilhaOccurrences(null);
      setPlanilhaFileName(null);
    }
  };

  const clearPlanilha = () => {
    setPlanilhaOccurrences(null);
    setPlanilhaFileName(null);
    setPlanilhaUploadError(null);
  };

  // Gera automaticamente o período padrão na primeira abertura da aba.
  useEffect(() => {
    if (autoLoadRef.current) return;
    autoLoadRef.current = true;
    run(defaultDe, today);
  }, [defaultDe, today, run]);

  const applyPreset = (days: number) => {
    const newDe = addDays(today, -days);
    setDe(newDe);
    setAte(today);
    run(newDe, today);
  };

  const fonteFalhou = report
    ? (Object.entries(report.fontes).filter(([, v]) => v === 'falhou') as [string, 'falhou'][])
    : [];

  const ocorrenciasPorHora = useMemo(() => report?.ocorrencias.porHora ?? [], [report]);

  // Seletor de séries do gráfico "Ocorrências por período"
  const [seriesVis, setSeriesVis] = useState<Record<SeriesKey, boolean>>({
    total: true,
    abertas: true,
    fechadas: true,
    chuva: true,
    vento: true,
    ventoMedio: true,
  });
  const toggleSeries = (key: SeriesKey) =>
    setSeriesVis((v) => ({ ...v, [key]: !v[key] }));
  const showAllSeries = () =>
    setSeriesVis({ total: true, abertas: true, fechadas: true, chuva: true, vento: true, ventoMedio: true });
  const allSeriesOn = SERIES_OPTS.every((s) => seriesVis[s.key]);

  const estagioColors = useMemo(() => {
    const m = new Map<string, string>();
    (report?.ocorrencias.estagios ?? []).forEach((s, i) => {
      m.set(s.nome, ESTAGIO_PALETTE[i % ESTAGIO_PALETTE.length]);
    });
    return m;
  }, [report]);

  return (
    <div className="h-full overflow-y-auto bg-slate-100">
      {/* Barra de controles (período) */}
      <div className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                <BarChart3 className="h-5 w-5 text-sky-400" />
                Análise institucional
              </h2>
              <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
                Cruzamento de chuva, vento e ocorrências por período — preparado para apresentações.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/20"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              De
              <input
                type="date"
                value={de}
                max={ate}
                onChange={(e) => setDe(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Até
              <input
                type="date"
                value={ate}
                min={de}
                max={today}
                onChange={(e) => setAte(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Agrupar por
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
                {(
                  [
                    ['auto', 'Auto'],
                    ['hora', 'Hora'],
                    ['dia', 'Dia'],
                  ] as const
                ).map(([g, label]) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => changeGranularidade(g)}
                    className={`px-3 py-2 text-xs font-bold transition-colors ${
                      granularidade === g
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>
            <button
              type="button"
              onClick={() => run(de, ate)}
              disabled={loading || !de || !ate || de > ate}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Gerando…' : 'Gerar análise'}
            </button>

            {/* Planilha de ocorrências carregada pelo usuário (fora da rede do COR) */}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-sky-300" />
              {planilhaFileName ? 'Trocar planilha' : 'Carregar planilha de ocorrências'}
              <input type="file" accept=".xlsx" className="hidden" onChange={handlePlanilhaUpload} />
            </label>
            {planilhaFileName && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                <span className="max-w-[180px] truncate" title={planilhaFileName}>
                  {planilhaFileName}
                </span>
                <button
                  type="button"
                  onClick={clearPlanilha}
                  className="rounded p-0.5 text-sky-300 hover:bg-white/10"
                  title="Remover planilha"
                  aria-label="Remover planilha"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {planilhaUploadError && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {planilhaUploadError}
              </span>
            )}

            {report && (
              <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-200">
                <CalendarRange className="h-4 w-4 text-sky-300" />
                {periodLabel(report.periodo.de, report.periodo.ate)} · {report.periodo.dias} dia{report.periodo.dias > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] space-y-5 px-4 py-6 sm:px-6">
        {/* Avisos de fontes */}
        {error && !report && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {report && fonteFalhou.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Algumas fontes não responderam para este período — exibindo dados parciais:</span>
            {fonteFalhou.map(([f]) => (
              <span key={f} className="rounded-full bg-amber-200/70 px-2 py-0.5 font-semibold">
                {f === 'chuva' ? 'Chuva' : f === 'vento' ? 'Vento' : 'Ocorrências'}
              </span>
            ))}
            <span className="ml-auto text-amber-600">Períodos longos demoram mais (chuva é buscada dia a dia).</span>
          </div>
        )}
        {report?.ocorrencias.fonte === 'planilha-carregada' && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Ocorrências da <b>planilha carregada</b> ({planilhaFileName ?? 'arquivo'}) — filtradas pelo período
              selecionado para o cruzamento.
            </span>
          </div>
        )}
        {report?.ocorrencias.fonte === 'planilha-local' && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Ocorrências carregadas da <b>planilha local</b> (a API Hexagon não retornou dados para este período).
            </span>
          </div>
        )}

        {loading && !report && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-16 text-sm text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            Buscando e cruzando dados do período…
          </div>
        )}

        {report && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <KpiCard
                label="Ocorrências"
                value={fmt(report.ocorrencias.total, 0)}
                hint={`${report.ocorrencias.porPop[0]?.nome ?? '—'} é o tipo mais comum`}
                icon={<AlertTriangle className="h-4 w-4" />}
                accent="rose"
              />
              <KpiCard
                label="Maior acumulado"
                value={report.chuva.maxAcumulado ? fmt(report.chuva.maxAcumulado.accumulatedMm) : '—'}
                unit="mm"
                hint={report.chuva.maxAcumulado ? `${report.chuva.maxAcumulado.name} no período` : 'sem dados'}
                icon={<MapPin className="h-4 w-4" />}
                accent="blue"
              />
              <KpiCard
                label="Chuva acumulada (todas as estações)"
                value={fmt(report.chuva.totalAcumuladoMm)}
                unit="mm"
                hint={`${report.chuva.totalEstacoes} estações · média de ${fmt(report.chuva.mediaPorEstacaoMm)} mm/estação`}
                icon={<Droplets className="h-4 w-4" />}
                accent="sky"
              />
              <KpiCard
                label="Pico 15 min"
                value={report.chuva.maxM15 ? fmt(report.chuva.maxM15.maxM15) : '—'}
                unit="mm/15min"
                hint={report.chuva.maxM15?.name ?? 'sem dados'}
                icon={<Timer className="h-4 w-4" />}
                accent="violet"
              />
              <KpiCard
                label="Maior rajada"
                value={report.vento.maxRajadaKmh ? fmt(report.vento.maxRajadaKmh.maxGustKmh) : '—'}
                unit="km/h"
                hint={report.vento.maxRajadaKmh?.name ?? 'sem dados'}
                icon={<Wind className="h-4 w-4" />}
                accent="amber"
              />
              <KpiCard
                label="Maior vento médio"
                value={report.vento.maxVelocidadeMediaKmh ? fmt(report.vento.maxVelocidadeMediaKmh.maxVelocidadeMediaKmh) : '—'}
                unit="km/h"
                hint={report.vento.maxVelocidadeMediaKmh?.name ?? 'sem dados'}
                icon={<Wind className="h-4 w-4" />}
                accent="sky"
              />
              <KpiCard
                label="Rajadas ≥ 52 km/h"
                value={fmt(report.vento.rajadasFortes, 0)}
                hint={`${report.vento.totalLeituras} leituras no período`}
                icon={<CloudRain className="h-4 w-4" />}
                accent="emerald"
              />
            </div>

            {/* Ocorrências por período (destaque) */}
            {report.cruzamento.serie.length > 0 && (
              <ChartCard
                dark
                title="Ocorrências por período"
                subtitle={`Total, abertas e fechadas ${granularidadeEfetiva === 'hora' ? 'por hora' : 'por dia'} — Total = Abertas + Fechadas; com chuva e vento; selecione as séries`}
                action={
                  <button
                    type="button"
                    onClick={() => run(de, ate)}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Atualizar'}
                  </button>
                }
              >
                {/* Seletor de séries (todos ou individuais: vento, chuva, etc.) */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Séries:
                  </span>
                  <button
                    type="button"
                    onClick={showAllSeries}
                    aria-pressed={allSeriesOn}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      allSeriesOn
                        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Todos
                  </button>
                  {SERIES_OPTS.map((s) => {
                    const on = seriesVis[s.key];
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleSeries(s.key)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          on
                            ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                            : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <ResponsiveContainer width="100%" height={440}>
                  <ComposedChart data={report.cruzamento.serie} margin={{ top: 30, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={2} maxBarSize={30}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#CBD5E1' }} minTickGap={30} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="occ" tick={axisTickClean} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <YAxis yAxisId="meteo" orientation="right" tick={axisTickCleanDim} axisLine={false} tickLine={false} width={38} />
                    <Tooltip content={<ChartTip dark />} cursor={{ stroke: '#475569', strokeDasharray: '3 3' }} />
                    {seriesVis.total && (
                      <Bar yAxisId="occ" dataKey="ocorrencias" name="TOTAL" fill="#7DD3FC" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="ocorrencias"
                          position="top"
                          formatter={(v) => fmt(Number(v), 0)}
                          style={{ fontSize: 12, fontWeight: 700, fill: '#F8FAFC' }}
                        />
                      </Bar>
                    )}
                    {seriesVis.abertas && (
                      <Line yAxisId="occ" dataKey="abertas" name="Abertas" stroke="#F87171" strokeWidth={2} dot={{ r: 2.5, fill: '#F87171', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    )}
                    {seriesVis.fechadas && (
                      <Line yAxisId="occ" dataKey="fechadas" name="Fechadas" stroke="#4ADE80" strokeWidth={2} dot={{ r: 2.5, fill: '#4ADE80', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    )}
                    {seriesVis.chuva && (
                      <Bar yAxisId="meteo" dataKey="chuvaMm" name="Chuva (mm)" fill="#60A5FA" opacity={0.3} radius={[4, 4, 0, 0]} />
                    )}
                    {seriesVis.vento && (
                      <Line yAxisId="meteo" dataKey="ventoMaxKmh" name="Rajada (km/h)" stroke="#FBBF24" strokeWidth={1.8} dot={false} strokeDasharray="6 4" />
                    )}
                    {seriesVis.ventoMedio && (
                      <Line yAxisId="meteo" dataKey="ventoMedioKmh" name="Vento médio (km/h)" stroke="#38BDF8" strokeWidth={1.8} dot={false} strokeDasharray="3 4" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Faixa de estágios por período */}
                {estagioColors.size > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Estágios por período
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {report.cruzamento.serie.map((p) => (
                        <div key={p.dia} className="flex min-w-[56px] flex-col items-center gap-1">
                          <span
                            className="grid h-7 w-9 place-items-center rounded-md text-[11px] font-bold text-white"
                            style={{ background: p.estagio ? (estagioColors.get(p.estagio) ?? '#475569') : '#334155' }}
                            title={p.estagio ?? 'Sem estágio'}
                          >
                            {p.estagio ? estagioShort(p.estagio) : '—'}
                          </span>
                          <span className="text-[10px] text-slate-500">{p.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {report.ocorrencias.estagios.map((s) => (
                        <span key={s.nome} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span className="h-3 w-3 rounded" style={{ background: estagioColors.get(s.nome) ?? '#64748B' }} />
                          {s.nome} · {s.total}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </ChartCard>
            )}

            {/* Chuva */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard
                title="Ranking de chuva por estação"
                subtitle="Acumulado no período (mm)"
              >
                {report.chuva.ranking.length === 0 ? (
                  <EmptyNote text="Sem dados de chuva para o período." />
                ) : (
                  <ResponsiveContainer width="100%" height={Math.min(420, 40 + report.chuva.ranking.length * 26)}>
                    <BarChart layout="vertical" data={report.chuva.ranking.slice(0, 12)} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisTick} unit=" mm" />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#334155' }} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="accumulatedMm" name="Acumulado (mm)" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="accumulatedMm" position="right" formatter={(v) => fmt(Number(v))} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title="Distribuição de intensidade"
                subtitle="Estações pelo pico de chuva em 15 min no período"
              >
                {report.chuva.totalEstacoes === 0 ? (
                  <EmptyNote text="Sem estações no período." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={RAIN_LEVEL_ORDER.map((k) => ({ level: RAIN_LEVEL_LABELS[k], total: report.chuva.intensidade[k] }))} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="level" tick={{ fontSize: 11, fill: '#334155' }} />
                        <YAxis tick={axisTick} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="total" name="Estações" radius={[6, 6, 0, 0]}>
                          {RAIN_LEVEL_ORDER.map((k) => (
                            <Cell key={k} fill={RAIN_LEVEL_COLORS[k]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {RAIN_LEVEL_ORDER.map((k) => (
                        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RAIN_LEVEL_COLORS[k] }} />
                          {RAIN_LEVEL_LABELS[k]}: <b>{report.chuva.intensidade[k]}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>
            </div>

            {/* Vento */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard
                title="Ranking de vento por estação"
                subtitle="Rajada máxima e vento médio no período (km/h)"
              >
                {report.vento.ranking.length === 0 ? (
                  <EmptyNote text="Sem dados de vento para o período." />
                ) : (
                  <ResponsiveContainer width="100%" height={Math.min(440, 60 + report.vento.ranking.slice(0, 12).length * 28)}>
                    <BarChart layout="vertical" data={report.vento.ranking.slice(0, 12)} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisTick} unit=" km/h" />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#334155' }} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="maxVelocidadeMediaKmh" name="Vento médio (km/h)" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="maxGustKmh" name="Rajada máx. (km/h)" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title="Vento por corredor"
                subtitle="Rajada máxima por corredor meteorológico"
              >
                {report.vento.porCorredor.every((c) => c.maxKmh === 0) ? (
                  <EmptyNote text="Sem dados de vento para o período." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.vento.porCorredor} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisTick} unit=" km/h" />
                      <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11, fill: '#334155' }} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="maxKmh" name="Rajada máx. (km/h)" fill="#0EA5E9" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="maxKmh" position="right" formatter={(v) => fmt(Number(v))} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Ocorrências */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard
                title="Ocorrências por POP (abertas × fechadas)"
                subtitle="Histórico de abertura e encerramento por tipo no período"
              >
                {report.ocorrencias.porPopStatus.length === 0 ? (
                  <EmptyNote text="Nenhuma ocorrência no período." />
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(440, 50 + report.ocorrencias.porPopStatus.length * 30)}
                  >
                    <BarChart
                      layout="vertical"
                      data={report.ocorrencias.porPopStatus}
                      margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisTick} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11, fill: '#334155' }} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="abertas" name="Abertas" stackId="pop" fill="#E11D48" />
                      <Bar dataKey="fechadas" name="Fechadas" stackId="pop" fill="#84CC16" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="total" position="right" formatter={(v) => fmt(Number(v), 0)} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title="Ocorrências por bairro"
                subtitle="Bairros com mais registros no período"
              >
                {report.ocorrencias.porBairro.length === 0 ? (
                  <EmptyNote text="Nenhuma ocorrência no período." />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart layout="vertical" data={report.ocorrencias.porBairro} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisTick} allowDecimals={false} />
                      <YAxis type="category" dataKey="bairro" width={130} tick={{ fontSize: 11, fill: '#334155' }} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="total" name="Ocorrências" fill="#E11D48" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="total" position="right" formatter={(v) => fmt(Number(v), 0)} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard
                title="Ocorrências por criticidade"
                subtitle="Total por nível de criticidade"
              >
                {report.ocorrencias.porCriticidade.length === 0 ? (
                  <EmptyNote text="Nenhuma ocorrência no período." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report.ocorrencias.porCriticidade} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="nivel" tick={{ fontSize: 11, fill: '#334155' }} />
                      <YAxis tick={axisTick} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="total" name="Ocorrências" radius={[6, 6, 0, 0]}>
                        {report.ocorrencias.porCriticidade.map((c, i) => (
                          <Cell key={c.nivel} fill={OCC_PALETTE[i % OCC_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title="Ocorrências por hora"
                subtitle="Horário de abertura das ocorrências"
              >
                {ocorrenciasPorHora.length === 0 ? (
                  <EmptyNote text="Nenhuma ocorrência no período." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={ocorrenciasPorHora} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hora" tick={axisTick} />
                      <YAxis tick={axisTick} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="total" name="Ocorrências" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      <Line dataKey="total" stroke="#6D28D9" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-[1700px] px-4 py-4 text-xs text-slate-500 sm:px-6">
          COR - Centro de Operações e Resiliência · Prefeitura do Rio de Janeiro. Fonte: Alerta Rio
          (chuva), INMET/REDEMET (vento) e API de ocorrências (período selecionado).
        </div>
      </footer>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export default AnalysisDashboard;
