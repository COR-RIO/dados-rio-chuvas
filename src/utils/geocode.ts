/**
 * Geocodificação de endereço para coordenadas (Nominatim / OpenStreetMap).
 * Usado quando a API de ocorrências retorna apenas Endereco, sem lat/lng.
 * Em dev usa proxy do Vite para evitar CORS; Nominatim exige 1 req/s e User-Agent.
 * Cache em memória reduz chamadas repetidas; 429 é tratado com backoff.
 */

const NOMINATIM_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/nominatim'
    : 'https://nominatim.openstreetmap.org';
const SEARCH_URL = `${NOMINATIM_BASE}/search`;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cache em memória: mesmo endereço não gera nova requisição. */
const addressCache = new Map<string, GeocodeResult | null>();

/** Após 429, não chamar Nominatim por este tempo (ms). */
const COOLDOWN_AFTER_429_MS = 90_000; // 90 segundos
let last429At = 0;

/** Retorna true se estamos em cooldown (429 recente); evita novas requisições. */
export function isGeocodeInCooldown(): boolean {
  return last429At > 0 && Date.now() - last429At < COOLDOWN_AFTER_429_MS;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Converte um endereço em coordenadas (lat, lng). Retorna null se não encontrar ou der erro.
 * Usa cache. Em 429 grava cooldown e retorna null (sem nova tentativa).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q) return null;
  if (Date.now() - last429At < COOLDOWN_AFTER_429_MS) return null;
  const cached = addressCache.get(q);
  if (cached !== undefined) return cached;
  try {
    const params = new URLSearchParams({ format: 'json', q, limit: '1' });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'DadosRioChuvas/1.0 (https://github.com)',
      },
    });
    if (res.status === 429) {
      last429At = Date.now();
      console.warn('Nominatim 429: limite de requisições. Geocoding pausado por alguns minutos.');
      return null;
    }
    if (!res.ok) {
      addressCache.set(q, null);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      addressCache.set(q, null);
      return null;
    }
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      addressCache.set(q, null);
      return null;
    }
    const result: GeocodeResult = { lat, lng };
    addressCache.set(q, result);
    return result;
  } catch {
    addressCache.set(q, null);
    return null;
  }
}

/** Limpa o cache (útil após muitas requisições ou para testes). */
export function clearGeocodeCache(): void {
  addressCache.clear();
}

const DELAY_MS = 2500; // 2,5 s entre requisições (Nominatim é restritivo)

/**
 * Geocodifica vários endereços em sequência, com delay (respeita limite do Nominatim).
 */
export async function geocodeAddresses(
  addresses: Array<{ address: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();
  const total = addresses.length;
  for (let i = 0; i < total; i++) {
    if (i > 0) await delay(DELAY_MS);
    const addr = addresses[i].address;
    const key = addr;
    if (!addr) {
      results.set(key, null);
    } else {
      const r = await geocodeAddress(addr);
      results.set(key, r);
    }
    onProgress?.(i + 1, total);
  }
  return results;
}
