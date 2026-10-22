import type { ForecastSlot } from '../services/forecastModelsApi';

/* Formatação compartilhada entre a aba Previsão e o painel de previsão do mapa. */

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS[wd]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" e hora atuais em Brasília, independente do fuso da máquina. */
export function nowInRio(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** Bloco já encerrado (fim do bloco = `hour` <= agora) — some da tela, como no Windy. */
export function isPast(slot: ForecastSlot, now: { date: string; hour: number }): boolean {
  return slot.date < now.date || (slot.date === now.date && slot.hour <= now.hour);
}

/** "Qua 21/10 12h" para `date` + `hour` (aceita hora negativa/>=24: volta/avança o dia). */
export function fmtDateHour(date: string, hour: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hour);
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return `${dayLabel(iso)} ${String(dt.getHours()).padStart(2, '0')}h`;
}

/** Cor por chuva acumulada em 3 h. */
export function rainClass(mm: number): string {
  if (mm >= 25) return 'bg-red-600 text-white';
  if (mm >= 10) return 'bg-orange-500 text-white';
  if (mm >= 5) return 'bg-amber-300 text-amber-950';
  if (mm >= 1) return 'bg-sky-200 text-sky-950';
  if (mm > 0) return 'bg-sky-50 text-sky-800';
  // 0 mm é previsão de "sem chuva" — legível, para não parecer célula vazia/sem dados.
  return 'text-slate-500';
}

/** Rajada em km/h: amarelo a partir de 40 km/h, vermelho a partir de 55 km/h. */
export const GUST_ALERT_KMH = 40;
export function gustClass(kmh: number): string {
  if (kmh >= 55) return 'text-red-600 font-bold';
  if (kmh >= GUST_ALERT_KMH) return 'text-amber-600 font-bold';
  return 'text-slate-500';
}

export const fmtMm = (mm: number) => mm.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Chave estável de um bloco (para destacar a janela mostrada no mapa). */
export const slotKey = (s: Pick<ForecastSlot, 'date' | 'hour'>) => `${s.date}-${s.hour}`;

/** Opções de janela ("próximas N h") do mapa. */
export const FORECAST_WINDOW_OPTIONS = [3, 6, 12, 24];

/** Chaves dos blocos de 3 h da janela, a partir do bloco em andamento. Calculado pelo relógio (e
 * não pela posição no array) para que um bloco faltando no modelo não puxe blocos de fora da janela. */
function windowKeys(windowHours: number): string[] {
  const now = nowInRio();
  const [y, m, d] = now.date.split('-').map(Number);
  const firstEnd = Math.floor(now.hour / 3) * 3 + 3;
  return Array.from({ length: Math.ceil(windowHours / 3) }, (_, k) => {
    const dt = new Date(y, m - 1, d, firstEnd + 3 * k);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return slotKey({ date: iso, hour: dt.getHours() });
  });
}

/** Blocos de 3 h a partir do bloco em andamento, cobrindo as próximas `windowHours`. */
export function upcomingSlots(slots: ForecastSlot[], windowHours: number): ForecastSlot[] {
  const keys = new Set(windowKeys(windowHours));
  return slots.filter((s) => keys.has(slotKey(s)));
}

export interface WindowSummary {
  /** Chuva acumulada na janela — null quando o modelo não trouxe nenhum bloco com chuva. */
  totalMm: number | null;
  maxGustKmh: number | null;
  /** Bloco com mais chuva (pico), para dizer "quando". */
  peak: ForecastSlot | null;
  /** Blocos da janela sem dado de chuva (o total é parcial quando > 0). */
  missingBlocks: number;
  expectedBlocks: number;
  /** Primeiro bloco com chuva DEPOIS da janela — para dizer "sem chuva, próxima às 03h". */
  nextRain: ForecastSlot | null;
}

/** Início de um bloco em formato curto: "Qui 03h" (o bloco das 06h começa às 03h). */
export function fmtBlockStart(s: Pick<ForecastSlot, 'date' | 'hour'>): string {
  const [day, , hour] = fmtDateHour(s.date, s.hour - 3).split(' ');
  return `${day} ${hour}`;
}

/** Chuva total, maior rajada e cobertura de dados de um modelo nas próximas `windowHours`. */
export function summarizeWindow(slots: ForecastSlot[], windowHours: number): WindowSummary {
  const expectedBlocks = Math.ceil(windowHours / 3);
  let totalMm: number | null = null;
  let maxGustKmh: number | null = null;
  let peak: ForecastSlot | null = null;
  let covered = 0;
  const keys = windowKeys(windowHours);
  const lastKey = keys[keys.length - 1];
  const lastIdx = slots.findIndex((s) => slotKey(s) === lastKey);
  const nextRain = lastIdx < 0 ? null : slots.slice(lastIdx + 1).find((s) => (s.rainMm ?? 0) > 0) ?? null;
  for (const s of upcomingSlots(slots, windowHours)) {
    if (s.rainMm != null) {
      covered++;
      totalMm = (totalMm ?? 0) + s.rainMm;
      if (s.rainMm > 0 && (!peak || s.rainMm > (peak.rainMm ?? 0))) peak = s;
    }
    if (s.gustKmh != null) maxGustKmh = Math.max(maxGustKmh ?? 0, s.gustKmh);
  }
  return {
    totalMm: totalMm == null ? null : Math.round(totalMm * 10) / 10,
    maxGustKmh,
    peak,
    missingBlocks: expectedBlocks - covered,
    expectedBlocks,
    nextRain,
  };
}

/** "próx. chuva Qui 03h" / "sem chuva prevista nos próximos dias" — complemento do "sem chuva". */
export function nextRainLabel(s: WindowSummary): string {
  return s.nextRain ? `próx. chuva ${fmtBlockStart(s.nextRain)}` : 'sem chuva nos próximos dias';
}

/** Texto de aviso para total parcial / sem dados (tooltip e rodapé). */
export function coverageNote(s: WindowSummary): string | null {
  if (s.totalMm == null) return 'O modelo não trouxe dados para este período (rodada ainda não publicada ou fora do alcance do modelo).';
  if (s.missingBlocks > 0) return `Total parcial: faltam dados em ${s.missingBlocks} de ${s.expectedBlocks} blocos de 3 h.`;
  return null;
}
