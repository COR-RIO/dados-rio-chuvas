import type { WindStation } from '../types/wind';

/**
 * Escolhe, para cada estação (fonte+código), a leitura mais recente com observedAt <= targetIso.
 *
 * Usado pra "congelar" uma série histórica de vento (fetchRedemetWindHistory/fetchInmetWindHistory
 * — várias leituras por estação, ~1 por hora) no instante exato selecionado na linha do tempo do
 * playback histórico. Estações sem nenhuma leitura até targetIso ficam de fora do frame (mesmo
 * comportamento de "sem dados" já usado no resto do cinturão de vento).
 */
export function pickWindStationsAtTimestamp(series: WindStation[], targetIso: string | null): WindStation[] {
  if (!targetIso) return [];
  const targetMs = new Date(targetIso).getTime();
  if (!Number.isFinite(targetMs)) return [];

  const latestByStation = new Map<string, WindStation>();
  for (const reading of series) {
    const readingMs = new Date(reading.observedAt).getTime();
    if (!Number.isFinite(readingMs) || readingMs > targetMs) continue;
    const key = `${reading.source}-${reading.code}`;
    const current = latestByStation.get(key);
    if (!current || readingMs > new Date(current.observedAt).getTime()) {
      latestByStation.set(key, reading);
    }
  }
  return Array.from(latestByStation.values());
}
