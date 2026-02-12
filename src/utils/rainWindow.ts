import type { RainStation } from '../types/rain';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Intervalo suportado no filtro temporal do mapa (5 a 60 min, passo 5). */
export function normalizeWindowMinutes(minutes: number): number {
  const snapped = Math.round(minutes / 5) * 5;
  return Math.min(60, Math.max(5, snapped));
}

/** Retorna true quando o período é medido diretamente pela API. */
export function isMeasuredWindow(minutes: number): boolean {
  const m = normalizeWindowMinutes(minutes);
  return m === 5 || m === 15 || m === 60;
}

/**
 * Converte o acumulado da janela escolhida para intensidade equivalente em mm/h.
 * - 5 min usa m05, 15 min usa m15, 60 min usa h01
 * - janelas intermediárias usam interpolação entre as âncoras oficiais
 */
export function getStationEquivalentIntensityMmh(station: RainStation, minutes: number): number {
  const m = normalizeWindowMinutes(minutes);
  const m05 = Math.max(0, station.data.m05 ?? 0);
  const m15 = Math.max(0, station.data.m15 ?? 0);
  const h01 = Math.max(0, station.data.h01 ?? 0);

  const i5 = m05 * 12; // mm/5min -> mm/h
  const i15 = m15 * 4; // mm/15min -> mm/h
  const i60 = h01; // já em mm/h

  if (m <= 5) return i5;
  if (m < 15) return lerp(i5, i15, (m - 5) / 10);
  if (m === 15) return i15;
  if (m < 60) return lerp(i15, i60, (m - 15) / 45);
  return i60;
}

/** Acumulado estimado para a janela selecionada (mm). */
export function getStationAccumulatedMm(station: RainStation, minutes: number): number {
  const m = normalizeWindowMinutes(minutes);
  const mmh = getStationEquivalentIntensityMmh(station, m);
  return (mmh * m) / 60;
}

