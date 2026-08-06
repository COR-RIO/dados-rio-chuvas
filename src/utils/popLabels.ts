/**
 * Dicionário código PoP → nome descritivo (AgencyEventTypeCode do Simaa, ex.: "POP23").
 *
 * A API de ocorrências abertas (tempo real) só devolve o código, sem nome (confirmado contra o
 * servidor real do Simaa — ver src/services/ocorrenciasAbertasApi.ts). Preencha conforme a tabela
 * oficial do COR (existe em outro sistema interno, ainda não temos aqui) — só os códigos abaixo,
 * na ordem que já apareceu no mapa até agora, ficam como exemplo de formato:
 *
 * export const POP_LABELS: Record<string, string> = {
 *   POP08: 'Nome real aqui',
 *   POP10: 'Nome real aqui',
 *   POP11: 'Nome real aqui',
 *   POP15: 'Nome real aqui',
 *   POP19: 'Nome real aqui',
 *   POP21: 'Nome real aqui',
 *   POP23: 'Nome real aqui',
 *   POP33: 'Nome real aqui',
 * };
 *
 * Deixado vazio de propósito — nenhum valor abaixo foi inventado.
 */
export const POP_LABELS: Record<string, string> = {};

/** Nome descritivo do código PoP, com fallback pro próprio código quando ainda não mapeado. */
export function getPopLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return POP_LABELS[code] ?? code;
}
