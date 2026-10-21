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
  return 'text-slate-300';
}

/** Rajada em nós: 22 kt ≈ 40 km/h, 30 kt ≈ 55 km/h. */
export function gustClass(kt: number): string {
  if (kt >= 30) return 'text-red-600 font-bold';
  if (kt >= 22) return 'text-amber-600 font-bold';
  return 'text-slate-500';
}

export const fmtMm = (mm: number) => mm.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const ktToKmh = (kt: number) => Math.round(kt * 1.852);

/** Chave estável de um bloco (para destacar a janela mostrada no mapa). */
export const slotKey = (s: Pick<ForecastSlot, 'date' | 'hour'>) => `${s.date}-${s.hour}`;

/** Blocos de 3 h a partir do bloco em andamento, cobrindo as próximas `windowHours`. */
export function upcomingSlots(slots: ForecastSlot[], windowHours: number): ForecastSlot[] {
  const now = nowInRio();
  const start = slots.findIndex((s) => !isPast(s, now));
  return start < 0 ? [] : slots.slice(start, start + Math.ceil(windowHours / 3));
}
