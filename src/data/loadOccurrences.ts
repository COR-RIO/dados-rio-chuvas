import type { Occurrence } from '../types/occurrence';

/**
 * Carrega os dados estáticos de ocorrências (arquivo grande).
 * Só deve ser chamado quando o usuário escolher fonte "Planilha".
 * Em caso de falha (timeout, módulo muito grande), rejeita a promise.
 */
export function loadStaticOccurrences(): Promise<Occurrence[]> {
  return import('./occurrences').then((m) => m.OCCURRENCES);
}
