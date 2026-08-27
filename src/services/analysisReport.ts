import type { Occurrence } from '../types/occurrence';
import type { RainStation } from '../types/rain';
import type { WindStation, WindCorridor } from '../types/wind';
import { msToKmh, WIND_CORRIDOR_LABELS } from '../types/wind';
import { CORRIDORS } from '../hooks/useWindData';
import { fetchOccurrencesForAnalysis } from './ocorrenciasApi';
import { loadStaticOccurrences } from '../data/loadOccurrences';
import { fetchHistoricalRainStationsTimeline } from './gcpHistoricalRainApi';
import { fetchInmetWindHistory } from './inmetWindApi';
import { fetchRedemetWindHistory } from './redemetWindApi';

/** Categorias oficiais de intensidade de chuva (critério 15 min). */
export type RainLevelKey = 'sem' | 'fraca' | 'moderada' | 'forte' | 'muito-forte';

export const RAIN_LEVEL_LABELS: Record<RainLevelKey, string> = {
  sem: 'Sem chuva',
  fraca: 'Fraca',
  moderada: 'Moderada',
  forte: 'Forte',
  'muito-forte': 'Muito forte',
};

export const RAIN_LEVEL_COLORS: Record<RainLevelKey, string> = {
  sem: '#9CA3AF',
  fraca: '#93C5FD',
  moderada: '#60A5FA',
  forte: '#3B82F6',
  'muito-forte': '#1D4ED8',
};

/** Classifica uma leitura de 15 min (mm) nas categorias oficiais do Alerta Rio. */
export function rainLevelFromM15(m15: number): RainLevelKey {
  if (m15 > 12.5) return 'muito-forte';
  if (m15 > 6.25) return 'forte';
  if (m15 > 1.25) return 'moderada';
  if (m15 > 0) return 'fraca';
  return 'sem';
}

export interface RainStationAgg {
  stationId: string;
  name: string;
  /** Acumulado no período (mm), mesma convenção da timeline do mapa. */
  accumulatedMm: number;
  /** Pico de 15 min no período (mm/15min). */
  maxM15: number;
  /** Pico de 1h no período (mm/h). */
  maxH01: number;
}

export interface WindStationAgg {
  stationId: string;
  name: string;
  corridor: WindCorridor;
  /** Rajada máxima no período (km/h). */
  maxGustKmh: number;
  /** Velocidade média máxima no período (km/h) — vento médio. */
  maxVelocidadeMediaKmh: number;
  readings: number;
}

export interface CorridorPoint {
  corredor: WindCorridor;
  label: string;
  maxKmh: number;
  estacao: string | null;
}

export interface DailyPoint {
  dia: string;
  label: string;
  chuvaMm: number;
  ocorrencias: number;
  ventoMaxKmh: number;
  /** Velocidade média máxima (km/h) no bucket — vento médio. */
  ventoMedioKmh: number;
  /** Abertas: abriram no período e ainda não fecharam até o fim do bucket (fecham depois ou nunca). */
  abertas: number;
  /** Encerradas: fecharam dentro do bucket (pela hora do encerramento). */
  fechadas: number;
  /** Ainda em aberto: abriram no período e nunca foram encerradas. */
  ativas: number;
  /** Estágio predominante das ocorrências no período (Andamento_Ocorrencia). */
  estagio: string | null;
}

export interface AnalysisReport {
  periodo: {
    de: string;
    ate: string;
    dias: number;
  };
  chuva: {
    totalEstacoes: number;
    totalAcumuladoMm: number;
    mediaPorEstacaoMm: number;
    maxAcumulado: RainStationAgg | null;
    maxM15: RainStationAgg | null;
    maxH01: RainStationAgg | null;
    ranking: RainStationAgg[];
    intensidade: Record<RainLevelKey, number>;
    porDia: { dia: string; label: string; mm: number }[];
    porHora: { hora: string; mm: number }[];
  };
  vento: {
    totalEstacoes: number;
    totalLeituras: number;
    maxRajadaKmh: WindStationAgg | null;
    maxVelocidadeMediaKmh: WindStationAgg | null;
    rajadasFortes: number;
    porCorredor: CorridorPoint[];
    ranking: WindStationAgg[];
    rankingVelocidade: WindStationAgg[];
    porDia: { dia: string; label: string; maxKmh: number; maxVelocidadeMediaKmh: number }[];
    porHora: { hora: string; maxKmh: number; maxVelocidadeMediaKmh: number }[];
  };
  ocorrencias: {
    total: number;
    porPop: { nome: string; total: number }[];
    /** Por POP com abertura/encerramento (histórico de aberto e fechado por tipo). */
    porPopStatus: { nome: string; abertas: number; fechadas: number; total: number }[];
    porBairro: { bairro: string; total: number }[];
    porCriticidade: { nivel: string; total: number }[];
    porDia: { dia: string; label: string; total: number }[];
    porHora: { hora: string; total: number }[];
    /** Agregação por período (dia ou hora, mesma granularidade do cruzamento). */
    porPeriodo: {
      bucket: string;
      label: string;
      atividades: number;
      abertas: number;
      fechadas: number;
      ativas: number;
      estagio: string | null;
    }[];
    /** Estágios distintos encontrados (Andamento_Ocorrencia) com total. */
    estagios: { nome: string; total: number }[];
    /** True quando as ocorrências vieram da planilha (fallback ou carregada), não da API Hexagon. */
    usouFallback: boolean;
    /** Origem dos dados de ocorrência usados na análise. */
    fonte: 'api' | 'planilha-local' | 'planilha-carregada' | 'nenhuma';
  };
  cruzamento: {
    granularidade: 'dia' | 'hora';
    serie: DailyPoint[];
    correlacao: { chuvaMm: number; ocorrencias: number; ventoMaxKmh: number; label: string }[];
  };
  fontes: {
    chuva: 'ok' | 'falhou';
    vento: 'ok' | 'falhou';
    ocorrencias: 'ok' | 'falhou';
  };
}

function buildDailyLabel(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  if (!y || !m || !d) return dia;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dayKeyOf(iso: string): string {
  return String(iso ?? '').slice(0, 10);
}

function hourKeyOf(iso: string): string {
  const s = String(iso ?? '');
  const day = s.slice(0, 10);
  const hh = s.slice(11, 13);
  return `${day} ${hh}`;
}

/** Momento de abertura da ocorrência em ISO (data_hora_abertura ou data+hora). */
function occurrenceOpenIso(o: Occurrence): string {
  return o.data_hora_abertura ?? (o.data_abertura ? `${o.data_abertura}T${o.hora_abertura ?? '00:00:00'}` : '');
}

/** True se a ocorrência foi encerrada (possui data/hora de encerramento). */
function isOccurrenceClosed(o: Occurrence): boolean {
  return !!(o.data_hora_encerramento || (o.data_encerramento && o.hora_encerramento));
}

/** Momento de encerramento da ocorrência em ISO (data_hora_encerramento ou data+hora). */
function occurrenceCloseIso(o: Occurrence): string {
  return o.data_hora_encerramento ?? (o.data_encerramento ? `${o.data_encerramento}T${o.hora_encerramento ?? '00:00:00'}` : '');
}

/** Timestamp em ms de um ISO (0 quando vazio/inválido). */
function isoMs(iso: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Fim (exclusivo) de um bucket dia/hora em ms, a partir da chave do bucket. */
function bucketEndMs(bucket: string, granularity: 'dia' | 'hora'): number {
  const start =
    granularity === 'dia'
      ? new Date(`${bucket.slice(0, 10)}T00:00:00`).getTime()
      : new Date(`${bucket.slice(0, 13)}:00:00`).getTime();
  return start + (granularity === 'dia' ? 86400000 : 3600000);
}

/** Chave do bucket (dia ou hora) a partir de um ISO, conforme a granularidade. */
function bucketKeyOf(iso: string, granularity: 'dia' | 'hora'): string {
  const day = dayKeyOf(iso);
  if (!day) return '';
  if (granularity === 'dia') return day;
  return `${day} ${String(iso).slice(11, 13)}`;
}

/** Rótulo de exibição de um bucket (dia ou hora). */
function bucketLabel(bucket: string, granularity: 'dia' | 'hora'): string {
  if (granularity === 'dia') return buildDailyLabel(bucket);
  return `${bucket.slice(11, 13)}h`;
}

function sortByKey<T>(arr: T[], key: (t: T) => string): T[] {
  return [...arr].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Incremento usado pela timeline do mapa (m05 se > 0, senão m15). */
function rainIncrement(station: RainStation): number {
  return station.data.m05 > 0 ? station.data.m05 : station.data.m15;
}

/** Lista de datas (YYYY-MM-DD) de `de` até `ate` (inclusive). */
function eachDay(de: string, ate: string): string[] {
  const [deY, deM, deD] = de.split('-').map(Number);
  const [ateY, ateM, ateD] = ate.split('-').map(Number);
  const start = new Date(deY, deM - 1, deD);
  const end = new Date(ateY, ateM - 1, ateD);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    out.push(`${cur.getFullYear()}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Executa uma função assíncrona com concorrência limitada, preservando a ordem dos itens. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export interface BuildAnalysisOptions {
  /** Data inicial YYYY-MM-DD */
  de: string;
  /** Data final YYYY-MM-DD */
  ate: string;
  /** Tempo inicial (HH:mm) — opcional */
  horaDe?: string;
  /** Tempo final (HH:mm) — opcional */
  horaAte?: string;
  /**
   * Granularidade do cruzamento (dia ou hora). Quando ausente, usa hora para períodos de 1 dia
   * e dia para períodos maiores.
   */
  granularidade?: 'hora' | 'dia';
  /**
   * Ocorrências pré-carregadas (ex.: planilha .xlsx carregada pelo usuário). Quando fornecidas,
   * são usadas no lugar da API Hexagon (que só funciona na rede do COR) e filtradas pelo período.
   */
  ocorrenciasOverride?: Occurrence[];
}

/**
 * Gera o relatório consolidado de um período, cruzando chuva (GCP), vento (INMET/REDEMET
 * histórico) e ocorrências (API Hexagon). Cada fonte é buscada de forma independente; se uma
 * falhar, a report fica com o restante e a origem marcada como 'falhou' (para exibir aviso).
 */
export async function buildAnalysisReport(opts: BuildAnalysisOptions): Promise<AnalysisReport> {
  const { de, ate } = opts;
  const horaDe = opts.horaDe ?? '00:00';
  const horaAte = opts.horaAte ?? '23:59';

  const [deY, deM, deD] = de.split('-').map(Number);
  const [ateY, ateM, ateD] = ate.split('-').map(Number);
  const dias = Math.max(
    1,
    Math.round(
      (new Date(ateY, ateM - 1, ateD).getTime() - new Date(deY, deM - 1, deD).getTime()) / 86400000
    ) + 1
  );
  // Granularidade do cruzamento: hora por hora ou por dia (forçável pelo usuário).
  const granularidade: 'hora' | 'dia' = opts.granularidade ?? (dias > 1 ? 'dia' : 'hora');

  const report: AnalysisReport = {
    periodo: { de, ate, dias },
    chuva: {
      totalEstacoes: 0,
      totalAcumuladoMm: 0,
      mediaPorEstacaoMm: 0,
      maxAcumulado: null,
      maxM15: null,
      maxH01: null,
      ranking: [],
      intensidade: { sem: 0, fraca: 0, moderada: 0, forte: 0, 'muito-forte': 0 },
      porDia: [],
      porHora: [],
    },
    vento: {
      totalEstacoes: 0,
      totalLeituras: 0,
      maxRajadaKmh: null,
      maxVelocidadeMediaKmh: null,
      rajadasFortes: 0,
      porCorredor: CORRIDORS.map((c) => ({
        corredor: c,
        label: WIND_CORRIDOR_LABELS[c],
        maxKmh: 0,
        estacao: null,
      })),
      ranking: [],
      rankingVelocidade: [],
      porDia: [],
      porHora: [],
    },
    ocorrencias: {
      total: 0,
      porPop: [],
      porPopStatus: [],
      porBairro: [],
      porCriticidade: [],
      porDia: [],
      porHora: [],
      porPeriodo: [],
      estagios: [],
      usouFallback: false,
      fonte: 'nenhuma',
    },
    cruzamento: {
      granularidade,
      serie: [],
      correlacao: [],
    },
    fontes: { chuva: 'falhou', vento: 'falhou', ocorrencias: 'falhou' },
  };

  // ---------- Chuva (GCP) ----------
  // A function Netlify tem limite de resposta (~6MB) e o backend limita a 3 dias/35k linhas por
  // request. Períodos de 3 dias estouravam o limite (502 ResponseSizeTooLarge). Solução: buscar
  // um dia por vez (1 dia ≈ 9,5k linhas fica bem abaixo do limite) e agregar no cliente. Isso
  // também permite períodos maiores (mais requests, executados com concorrência limitada).
  try {
    const days = eachDay(de, ate);
    const perDayResults = await mapWithConcurrency(days, 4, async (day) => {
      const timeline = await fetchHistoricalRainStationsTimeline({
        dateFrom: day,
        dateTo: day,
        timeFrom: horaDe,
        timeTo: horaAte,
        limit: 12000,
      });
      return timeline;
    });

    const aggByStation = new Map<string, RainStationAgg>();
    const byDay = new Map<string, number>();
    const byHour = new Map<string, number>();

    for (const timeline of perDayResults) {
      // Acumulado do dia por estação (a timeline já soma o incremento daquele dia)
      for (const s of timeline.stations ?? []) {
        const mm = s.accumulated?.mm_accumulated ?? 0;
        const agg = aggByStation.get(s.id) ?? {
          stationId: s.id,
          name: s.name,
          accumulatedMm: 0,
          maxM15: 0,
          maxH01: 0,
        };
        agg.accumulatedMm += mm;
        aggByStation.set(s.id, agg);
      }

      // Picos, chuva por dia e por hora: percorre todos os frames do dia
      const tsKeys = Object.keys(timeline.stationsByTimestamp ?? {}).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );
      for (const ts of tsKeys) {
        const frame = timeline.stationsByTimestamp?.[ts] ?? [];
        if (frame.length === 0) continue;
        const day = dayKeyOf(ts);
        const hour = hourKeyOf(ts);

        let daySum = byDay.get(day) ?? 0;
        let hourSum = byHour.get(hour) ?? 0;
        for (const st of frame) {
          const agg = aggByStation.get(st.id) ?? {
            stationId: st.id,
            name: st.name,
            accumulatedMm: 0,
            maxM15: 0,
            maxH01: 0,
          };
          aggByStation.set(st.id, agg);
          if (st.data.m15 > agg.maxM15) agg.maxM15 = st.data.m15;
          if (st.data.h01 > agg.maxH01) agg.maxH01 = st.data.h01;
          const inc = rainIncrement(st);
          daySum += inc;
          hourSum += inc;
        }
        byDay.set(day, Math.round(daySum * 100) / 100);
        byHour.set(hour, Math.round(hourSum * 100) / 100);
      }
    }

    // Arredonda os agregados finais por estação
    for (const agg of aggByStation.values()) {
      agg.accumulatedMm = Math.round(agg.accumulatedMm * 100) / 100;
      agg.maxM15 = Math.round(agg.maxM15 * 100) / 100;
      agg.maxH01 = Math.round(agg.maxH01 * 100) / 100;
    }

    const allAggs = Array.from(aggByStation.values());
    report.chuva.totalEstacoes = allAggs.length;
    report.chuva.totalAcumuladoMm =
      Math.round(allAggs.reduce((acc, a) => acc + a.accumulatedMm, 0) * 100) / 100;
    report.chuva.mediaPorEstacaoMm =
      allAggs.length > 0 ? Math.round((report.chuva.totalAcumuladoMm / allAggs.length) * 100) / 100 : 0;

    report.chuva.ranking = [...allAggs]
      .filter((a) => a.accumulatedMm > 0)
      .sort((a, b) => b.accumulatedMm - a.accumulatedMm)
      .slice(0, 15);
    report.chuva.maxAcumulado = report.chuva.ranking[0] ?? null;

    const byMaxM15 = [...allAggs].sort((a, b) => b.maxM15 - a.maxM15);
    report.chuva.maxM15 = byMaxM15[0] && byMaxM15[0].maxM15 > 0 ? byMaxM15[0] : null;
    const byMaxH01 = [...allAggs].sort((a, b) => b.maxH01 - a.maxH01);
    report.chuva.maxH01 = byMaxH01[0] && byMaxH01[0].maxH01 > 0 ? byMaxH01[0] : null;

    const intensidade = report.chuva.intensidade;
    for (const a of allAggs) intensidade[rainLevelFromM15(a.maxM15)]++;

    report.chuva.porDia = sortByKey(
      Array.from(byDay.entries()).map(([dia, mm]) => ({ dia, label: buildDailyLabel(dia), mm })),
      (p) => p.dia
    );
    report.chuva.porHora = sortByKey(
      Array.from(byHour.entries()).map(([hora, mm]) => ({ hora, mm })),
      (p) => p.hora
    );

    report.fontes.chuva = 'ok';
  } catch (err) {
    console.warn('[Análise] Falha ao carregar chuva histórica:', err);
  }

  // ---------- Vento (INMET + REDEMET histórico) ----------
  try {
    const [inmetSeries, redemetSeries] = await Promise.all([
      fetchInmetWindHistory(`${de}T${horaDe}:00`, `${ate}T${horaAte}:59`),
      fetchRedemetWindHistory(`${de}T${horaDe}:00`, `${ate}T${horaAte}:59`),
    ]);
    const series: WindStation[] = [...inmetSeries, ...redemetSeries];

    report.vento.totalLeituras = series.length;

    const byStation = new Map<string, WindStationAgg>();
    const byDay = new Map<string, number>();
    const byHour = new Map<string, number>();
    const byDayMedia = new Map<string, number>();
    const byHourMedia = new Map<string, number>();
    for (const w of series) {
      const gustKmh = Math.round(msToKmh(w.windGustMs ?? w.windSpeedMs) * 10) / 10;
      const speedKmh = Math.round(msToKmh(w.windSpeedMs) * 10) / 10;
      const day = dayKeyOf(w.observedAt);
      byDay.set(day, Math.max(byDay.get(day) ?? 0, gustKmh));
      byDayMedia.set(day, Math.max(byDayMedia.get(day) ?? 0, speedKmh));
      const hour = hourKeyOf(w.observedAt);
      if (hour) {
        byHour.set(hour, Math.max(byHour.get(hour) ?? 0, gustKmh));
        byHourMedia.set(hour, Math.max(byHourMedia.get(hour) ?? 0, speedKmh));
      }

      const agg = byStation.get(w.id) ?? {
        stationId: w.id,
        name: w.name,
        corridor: w.corridor,
        maxGustKmh: 0,
        maxVelocidadeMediaKmh: 0,
        readings: 0,
      };
      agg.readings++;
      if (gustKmh > agg.maxGustKmh) agg.maxGustKmh = gustKmh;
      if (speedKmh > agg.maxVelocidadeMediaKmh) agg.maxVelocidadeMediaKmh = speedKmh;
      byStation.set(w.id, agg);

      if (gustKmh >= 52) report.vento.rajadasFortes++;
    }

    report.vento.totalEstacoes = byStation.size;
    report.vento.ranking = Array.from(byStation.values())
      .sort((a, b) => b.maxGustKmh - a.maxGustKmh)
      .slice(0, 15);
    report.vento.maxRajadaKmh = report.vento.ranking[0] ?? null;

    report.vento.rankingVelocidade = Array.from(byStation.values())
      .sort((a, b) => b.maxVelocidadeMediaKmh - a.maxVelocidadeMediaKmh)
      .slice(0, 15);
    report.vento.maxVelocidadeMediaKmh = report.vento.rankingVelocidade[0] ?? null;

    // Máximo por corredor (usando a leitura mais forte de cada corredor)
    const corridorMax = new Map<WindCorridor, WindStationAgg>();
    for (const agg of byStation.values()) {
      const current = corridorMax.get(agg.corridor);
      if (!current || agg.maxGustKmh > current.maxGustKmh) corridorMax.set(agg.corridor, agg);
    }
    report.vento.porCorredor = CORRIDORS.map((c) => {
      const best = corridorMax.get(c);
      return {
        corredor: c,
        label: WIND_CORRIDOR_LABELS[c],
        maxKmh: best ? best.maxGustKmh : 0,
        estacao: best ? best.name : null,
      };
    });

    report.vento.porDia = sortByKey(
      Array.from(byDay.entries()).map(([dia, maxKmh]) => ({ dia, label: buildDailyLabel(dia), maxKmh, maxVelocidadeMediaKmh: byDayMedia.get(dia) ?? 0 })),
      (p) => p.dia
    );
    report.vento.porHora = sortByKey(
      Array.from(byHour.entries()).map(([hora, maxKmh]) => ({ hora, maxKmh, maxVelocidadeMediaKmh: byHourMedia.get(hora) ?? 0 })),
      (p) => p.hora
    );

    report.fontes.vento = 'ok';
  } catch (err) {
    console.warn('[Análise] Falha ao carregar vento histórico:', err);
  }

  // ---------- Ocorrências (API Hexagon, com fallback para a planilha local) ----------
  let staticOccurrencesCache: Occurrence[] | null = null;
  const loadStaticCached = async (): Promise<Occurrence[]> => {
    if (!staticOccurrencesCache) staticOccurrencesCache = await loadStaticOccurrences();
    return staticOccurrencesCache;
  };

  const filterByPeriod = (list: Occurrence[]) =>
    list.filter((o) => {
      const dia = dayKeyOf(occurrenceOpenIso(o));
      return dia >= de && dia <= ate;
    });

  try {
    let ocorrencias: Occurrence[] = [];
    let fonte: AnalysisReport['ocorrencias']['fonte'] = 'nenhuma';

    // 1) Planilha carregada pelo usuário (funciona fora da rede do COR).
    if (opts.ocorrenciasOverride && opts.ocorrenciasOverride.length > 0) {
      ocorrencias = filterByPeriod(opts.ocorrenciasOverride);
      fonte = 'planilha-carregada';
    }
    // 2) API Hexagon (somente dentro da rede do COR).
    if (ocorrencias.length === 0) {
      try {
        ocorrencias = await fetchOccurrencesForAnalysis(de, ate, 100);
        if (ocorrencias.length > 0) fonte = 'api';
      } catch (err) {
        console.warn('[Análise] Falha ao carregar ocorrências da API:', err);
      }
    }
    // 3) Planilha local (fallback).
    if (ocorrencias.length === 0) {
      try {
        const filtered = filterByPeriod(await loadStaticCached());
        if (filtered.length > 0) {
          ocorrencias = filtered;
          fonte = 'planilha-local';
        }
      } catch (err) {
        console.warn('[Análise] Falha ao carregar planilha de ocorrências (fallback):', err);
      }
    }

    const occ = report.ocorrencias;
    occ.total = ocorrencias.length;
    occ.fonte = fonte;
    occ.usouFallback = fonte !== 'api';

    const popMap = new Map<string, number>();
    const bairroMap = new Map<string, number>();
    const critMap = new Map<string, number>();
    const diaMap = new Map<string, number>();
    const horaMap = new Map<string, number>();

    for (const o of ocorrencias) {
      const pop = o.pop?.trim() || 'Não informado';
      popMap.set(pop, (popMap.get(pop) ?? 0) + 1);

      const bairro = o.bairro?.trim() || 'Não informado';
      bairroMap.set(bairro, (bairroMap.get(bairro) ?? 0) + 1);

      const crit = o.criticidade?.trim() || 'Não informada';
      critMap.set(crit, (critMap.get(crit) ?? 0) + 1);

      const dia = dayKeyOf(o.data_hora_abertura ?? o.data_abertura ?? '');
      if (dia) diaMap.set(dia, (diaMap.get(dia) ?? 0) + 1);

      const hora = String(o.hora_abertura ?? '').slice(0, 2);
      if (hora) horaMap.set(hora, (horaMap.get(hora) ?? 0) + 1);
    }

    occ.porPop = Array.from(popMap.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Histórico aberto/fechado por POP (a API retorna abertas e encerradas no período).
    const popStatusMap = new Map<string, { abertas: number; fechadas: number }>();
    for (const o of ocorrencias) {
      const pop = o.pop?.trim() || 'Não informado';
      const st = popStatusMap.get(pop) ?? { abertas: 0, fechadas: 0 };
      if (isOccurrenceClosed(o)) st.fechadas++;
      else st.abertas++;
      popStatusMap.set(pop, st);
    }
    occ.porPopStatus = Array.from(popStatusMap.entries())
      .map(([nome, s]) => ({ nome, abertas: s.abertas, fechadas: s.fechadas, total: s.abertas + s.fechadas }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    occ.porBairro = Array.from(bairroMap.entries())
      .map(([bairro, total]) => ({ bairro, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    occ.porCriticidade = Array.from(critMap.entries())
      .map(([nivel, total]) => ({ nivel, total }))
      .sort((a, b) => b.total - a.total);

    occ.porDia = sortByKey(
      Array.from(diaMap.entries()).map(([dia, total]) => ({ dia, label: buildDailyLabel(dia), total })),
      (p) => p.dia
    );
    occ.porHora = Array.from(horaMap.entries())
      .map(([hora, total]) => ({ hora: `${hora}h`, total }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    // Por período (dia ou hora, conforme a granularidade do cruzamento): total, abertas,
    // fechadas e estágio predominante (Andamento_Ocorrencia).
    //
    // Semântica por bucket:
    //  - atividades = ocorrências que ABRIRAM no bucket (total).
    //  - abertas    = abriram no bucket e ainda NÃO fecharam até o fim dele (fecham depois ou nunca).
    //  - fechadas   = encerraram DENTRO do bucket (bucket do encerramento).
    //  - ativas     = abriram no bucket e nunca foram encerradas (ainda em aberto).
    const granularidadeOcorr = granularidade;
    const periodoMap = new Map<
      string,
      { atividades: number; abertas: number; fechadas: number; ativas: number; estagioCounts: Map<string, number> }
    >();
    const estagioMap = new Map<string, number>();
    const emptyAgg = () => ({
      atividades: 0,
      abertas: 0,
      fechadas: 0,
      ativas: 0,
      estagioCounts: new Map<string, number>(),
    });
    for (const o of ocorrencias) {
      const st = o.estagio?.trim() || 'Não informado';
      estagioMap.set(st, (estagioMap.get(st) ?? 0) + 1);

      const iso = occurrenceOpenIso(o);
      const bucket = bucketKeyOf(iso, granularidadeOcorr);
      if (!bucket) continue;

      const closeIso = occurrenceCloseIso(o);
      const closeMs = isoMs(closeIso);
      const endMs = bucketEndMs(bucket, granularidadeOcorr);

      const agg = periodoMap.get(bucket) ?? emptyAgg();
      agg.atividades++;
      // Aberta = abriu aqui e ainda não fechou até o fim deste bucket (encerra depois ou nunca).
      if (closeMs === 0 || closeMs >= endMs) agg.abertas++;
      // Ativa = nunca encerrada (ainda em aberto).
      if (closeMs === 0) agg.ativas++;
      if (st !== 'Não informado') {
        agg.estagioCounts.set(st, (agg.estagioCounts.get(st) ?? 0) + 1);
      }
      periodoMap.set(bucket, agg);

      // Fechadas contam no bucket do ENCERRAMENTO (não no de abertura).
      if (closeMs > 0) {
        const closeBucket = bucketKeyOf(closeIso, granularidadeOcorr);
        const closeDay = closeBucket.slice(0, 10);
        if (closeBucket && closeDay >= de && closeDay <= ate) {
          const cagg = periodoMap.get(closeBucket) ?? emptyAgg();
          cagg.fechadas++;
          periodoMap.set(closeBucket, cagg);
        }
      }
    }

    occ.estagios = Array.from(estagioMap.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    occ.porPeriodo = sortByKey(
      Array.from(periodoMap.entries()).map(([bucket, agg]) => {
        let estagio: string | null = null;
        let best = -1;
        for (const [nome, total] of agg.estagioCounts) {
          if (total > best) {
            best = total;
            estagio = nome;
          }
        }
        return {
          bucket,
          label: bucketLabel(bucket, granularidadeOcorr),
          atividades: agg.atividades,
          abertas: agg.abertas,
          fechadas: agg.fechadas,
          ativas: agg.ativas,
          estagio,
        };
      }),
      (p) => p.bucket
    );

    report.fontes.ocorrencias = 'ok';
  } catch (err) {
    console.warn('[Análise] Falha ao carregar ocorrências históricas:', err);
  }

  // ---------- Cruzamento (série temporal combinada) ----------
  try {
    const g = report.cruzamento.granularidade;
    const chuvaBuckets = new Map<string, number>();
    const ventoBuckets = new Map<string, number>();
    const ventoMediaBuckets = new Map<string, number>();
    if (g === 'dia') {
      for (const p of report.chuva.porDia) chuvaBuckets.set(p.dia, p.mm);
      for (const p of report.vento.porDia) {
        ventoBuckets.set(p.dia, p.maxKmh);
        ventoMediaBuckets.set(p.dia, p.maxVelocidadeMediaKmh);
      }
    } else {
      for (const p of report.chuva.porHora) chuvaBuckets.set(p.hora, p.mm);
      for (const p of report.vento.porHora) {
        ventoBuckets.set(p.hora, p.maxKmh);
        ventoMediaBuckets.set(p.hora, p.maxVelocidadeMediaKmh);
      }
    }
    const occPeriodoByBucket = new Map(report.ocorrencias.porPeriodo.map((p) => [p.bucket, p]));

    const buckets = new Set<string>([
      ...chuvaBuckets.keys(),
      ...ventoBuckets.keys(),
      ...occPeriodoByBucket.keys(),
    ]);
    // No modo hora, descarta buckets fora do período selecionado (ex.: frame de 00:00 do dia
    // seguinte que a API de chuva pode devolver).
    if (g === 'hora') {
      for (const b of Array.from(buckets)) {
        const d = b.slice(0, 10);
        if (d < de || d > ate) buckets.delete(b);
      }
    }

    report.cruzamento.serie = sortByKey(
      Array.from(buckets).map((bucket) => {
        const op = occPeriodoByBucket.get(bucket);
        return {
          dia: bucket,
          label: g === 'dia' ? buildDailyLabel(bucket) : `${bucket.slice(11, 13)}h`,
          chuvaMm: Math.round((chuvaBuckets.get(bucket) ?? 0) * 100) / 100,
          ocorrencias: op?.atividades ?? 0,
          ventoMaxKmh: Math.round((ventoBuckets.get(bucket) ?? 0) * 10) / 10,
          ventoMedioKmh: Math.round((ventoMediaBuckets.get(bucket) ?? 0) * 10) / 10,
          abertas: op?.abertas ?? 0,
          fechadas: op?.fechadas ?? 0,
          ativas: op?.ativas ?? 0,
          estagio: op?.estagio ?? null,
        };
      }),
      (p) => p.dia
    );

    report.cruzamento.correlacao = report.cruzamento.serie.map((p) => ({
      chuvaMm: p.chuvaMm,
      ocorrencias: p.ocorrencias,
      ventoMaxKmh: p.ventoMaxKmh,
      label: p.label,
    }));
  } catch (err) {
    console.warn('[Análise] Falha ao montar cruzamento:', err);
  }

  return report;
}
