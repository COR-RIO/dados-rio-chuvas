/**
 * Cache em memória com TTL e limite de entradas (LRU simples).
 * Reduz chamadas repetidas a APIs e processamento pesado.
 */

export interface CacheOptions {
  /** Tempo de vida em ms. Padrão: 5 min */
  ttlMs?: number;
  /** Máximo de entradas. Excedendo, remove as mais antigas. Padrão: 50 */
  maxEntries?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  key: string;
}

export function createCache<K extends string, V>(options: CacheOptions = {}) {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const maxEntries = options.maxEntries ?? 50;
  const map = new Map<string, CacheEntry<V>>();
  const keyOrder: string[] = [];

  function get(key: K): V | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      map.delete(key);
      const i = keyOrder.indexOf(key);
      if (i >= 0) keyOrder.splice(i, 1);
      return undefined;
    }
    return entry.data;
  }

  function set(key: K, value: V): void {
    if (map.has(key)) {
      const i = keyOrder.indexOf(key);
      if (i >= 0) keyOrder.splice(i, 1);
    } else if (keyOrder.length >= maxEntries) {
      const oldest = keyOrder.shift();
      if (oldest) map.delete(oldest);
    }
    keyOrder.push(key);
    map.set(key, {
      data: value,
      expiresAt: Date.now() + ttlMs,
      key,
    });
  }

  function invalidate(key?: K): void {
    if (key !== undefined) {
      map.delete(key);
      const i = keyOrder.indexOf(key);
      if (i >= 0) keyOrder.splice(i, 1);
    } else {
      map.clear();
      keyOrder.length = 0;
    }
  }

  return { get, set, invalidate };
}

/** Cache genérico para resultados de fetch (ex.: histórico por parâmetros). */
export const createFetchCache = <T>(ttlMs: number = 5 * 60 * 1000, maxEntries: number = 30) =>
  createCache<string, T>({ ttlMs, maxEntries });
