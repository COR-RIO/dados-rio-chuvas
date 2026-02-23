/**
 * Encontra o timestamp da timeline mais próximo de (dateYyyyMmDd + timeHhMm).
 */
export function findClosestTimestamp(
  timeline: string[],
  dateYyyyMmDd: string,
  timeHhMm: string
): string | null {
  if (!timeline.length) return null;
  const [h, m] = timeHhMm.split(':').map(Number);
  const targetMinutes = (h ?? 0) * 60 + (m ?? 0);
  const sameDay = timeline.filter((ts) => ts.slice(0, 10) === dateYyyyMmDd);
  const list = sameDay.length > 0 ? sameDay : timeline;
  let best = list[0];
  let bestDiff = Math.abs(
    new Date(best).getHours() * 60 + new Date(best).getMinutes() - targetMinutes
  );
  for (const ts of list) {
    const diff = Math.abs(
      new Date(ts).getHours() * 60 + new Date(ts).getMinutes() - targetMinutes
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ts;
    }
  }
  return best;
}
