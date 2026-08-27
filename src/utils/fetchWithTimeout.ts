/**
 * fetch com timeout e sem cache no browser. Evita que uma fonte lenta/parada (ex.: REDEMET)
 * segure o Promise.all do refresh de vento para sempre — o dado fica "preso" sem atualizar.
 * `cache: 'no-store'` garante que cada refresh busque o valor mais novo do proxy (o CDN/edge
 * continua com seu próprio cache curto para não sobrecarregar a fonte).
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: init?.cache ?? 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}
