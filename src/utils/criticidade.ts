/**
 * Escala de criticidade das ocorrências (API Simaa / CoR).
 * Nível numérico de 1 a 4, usado na API (ex.: campo Priority).
 * Use estes valores ao integrar com a API para identificar corretamente o nível.
 */
export const CRITICIDADE_NIVEL = {
  1: 'Muito alta',
  2: 'Alta',
  3: 'Média',
  4: 'Baixa',
} as const;

export type CriticidadeNivel = keyof typeof CRITICIDADE_NIVEL;

/** Labels para exibição (1 = Muito alta, 2 = Alta, 3 = Média, 4 = Baixa) */
export const CRITICIDADE_LABELS: Record<number, string> = {
  1: CRITICIDADE_NIVEL[1],
  2: CRITICIDADE_NIVEL[2],
  3: CRITICIDADE_NIVEL[3],
  4: CRITICIDADE_NIVEL[4],
};

/**
 * Converte o valor de criticidade (número 1-4 da API ou string "1"-"4") para o label de exibição.
 * Valores fora do intervalo retornam o próprio valor como string.
 */
export function getCriticidadeLabel(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (Number.isFinite(num) && num >= 1 && num <= 4) {
    return CRITICIDADE_LABELS[num as 1 | 2 | 3 | 4] ?? String(value);
  }
  return String(value);
}
