import type { Occurrence } from '../types/occurrence';

function parseDateTime(dateYyyyMmDd: string | null, timeHhMm: string | null): number | null {
  if (!dateYyyyMmDd) return null;
  const time = timeHhMm && timeHhMm.length === 5 ? `${timeHhMm}:00` : timeHhMm ?? '00:00:00';
  const iso = `${dateYyyyMmDd}T${time}`;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}

function occurrenceStartMs(occ: Occurrence): number | null {
  if (occ.data_hora_abertura) {
    const ts = Date.parse(occ.data_hora_abertura);
    if (Number.isFinite(ts)) return ts;
  }
  return parseDateTime(occ.data_abertura, occ.hora_abertura);
}

function occurrenceEndMs(occ: Occurrence): number | null {
  if (occ.data_hora_encerramento) {
    const ts = Date.parse(occ.data_hora_encerramento);
    if (Number.isFinite(ts)) return ts;
  }
  const ts = parseDateTime(occ.data_encerramento, occ.hora_encerramento);
  return ts;
}

/**
 * Retorna ocorrências cuja janela [abertura, encerramento] INTERSECTA o intervalo do filtro.
 * - Se não houver encerramento, a ocorrência é considerada "em aberto" (vai até +∞).
 * - Assim, o filtro pega ocorrências abertas, fechadas e ainda em andamento naquele período.
 */
export function filterOccurrencesByRange(
  occurrences: Occurrence[],
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string
): Occurrence[] {
  const start = parseDateTime(fromDate, fromTime) ?? 0;
  const end = parseDateTime(toDate, toTime) ?? Number.POSITIVE_INFINITY;
  if (!occurrences.length) return [];

  return occurrences.filter((occ) => {
    const startOcc = occurrenceStartMs(occ);
    if (startOcc == null) return false;
    const endOcc = occurrenceEndMs(occ) ?? Number.POSITIVE_INFINITY;
    // overlap entre [startOcc, endOcc] e [start, end]
    return startOcc <= end && endOcc >= start;
  });
}

