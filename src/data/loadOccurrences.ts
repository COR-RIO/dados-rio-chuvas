import type { Occurrence } from '../types/occurrence';
import { parseOccurrencesFromArrayBuffer } from '../utils/importOccurrencesXlsx';

const configuredUrl =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_OCORRENCIAS_PLANILHA_URL as string | undefined)?.trim()) ||
  '/planilhas/ocorrencias.xlsx';

const CANDIDATE_URLS = [
  configuredUrl,
].filter(Boolean);

/**
 * Carrega ocorrências da planilha (fonte "Planilha").
 * Usa somente arquivos dentro de `public/planilhas/`.
 * - Configure `VITE_OCORRENCIAS_PLANILHA_URL` no `.env` (ex.: `/planilhas/minha_planilha.xlsx`), OU
 * - usa o padrão `/planilhas/ocorrencias.xlsx`.
 * Se falhar, usa o fallback estático (`occurrences.ts`).
 */
export async function loadStaticOccurrences(): Promise<Occurrence[]> {
  for (const candidate of CANDIDATE_URLS) {
    const url = candidate.startsWith('/') ? candidate : `/${candidate}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const list = parseOccurrencesFromArrayBuffer(buffer);
      if (list.length > 0) return list;
    } catch {
      // tenta o próximo caminho
    }
  }
  return import('./occurrences').then((m) => m.OCCURRENCES);
}
