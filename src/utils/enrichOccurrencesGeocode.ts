import type { Occurrence } from '../types/occurrence';
import {
  geocodeAddress,
  isGeocodeInCooldown,
  buildGeocodeQueryFromLocalizacao,
  GEOCODE_OPTIONS_RIO,
} from './geocode';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Geocodifica uma ocorrência: texto completo (via + bairro + Rio) e, se falhar, só o bairro no Rio.
 */
async function geocodeOneOccurrenceGroup(
  primaryQuery: string,
  bairro: string | null | undefined
): Promise<{ lat: number; lng: number } | null> {
  let coords = await geocodeAddress(primaryQuery, GEOCODE_OPTIONS_RIO);
  if (coords) return coords;
  const b = bairro?.trim();
  if (!b) return null;
  await delay(400);
  if (isGeocodeInCooldown()) return null;
  const fallback = `${b}, Rio de Janeiro, RJ, Brasil`;
  coords = await geocodeAddress(fallback, GEOCODE_OPTIONS_RIO);
  return coords;
}

/**
 * Preenche latitude/longitude quando faltam, usando geocodificação do campo Localização.
 * Respeita VITE_GEOCODE_OCORRENCIAS=false, cooldown do Nominatim e um teto de endereços únicos por carga.
 * Usa o mesmo critério de texto que a API Hexagon + viés Brasil/viewbox Grande Rio no Nominatim.
 */
export async function enrichOccurrencesMissingCoords(
  occurrences: Occurrence[],
  options?: {
    maxUniqueAddresses?: number;
    delayMs?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<Occurrence[]> {
  const skip =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEOCODE_OCORRENCIAS === 'false';
  if (skip) return occurrences;
  if (isGeocodeInCooldown()) return occurrences;

  const maxU = options?.maxUniqueAddresses ?? 40;
  const delayMs = options?.delayMs ?? 2200;

  const list = occurrences.map((o) => ({ ...o }));
  /** Agrupa por texto de busca principal (localização + bairro + Rio) */
  const byQuery = new Map<string, { indices: number[]; bairroSample: string | null }>();

  list.forEach((o, i) => {
    if (o.latitude != null && o.longitude != null) return;
    const primary = buildGeocodeQueryFromLocalizacao(o.localizacao, o.bairro);
    if (!primary) return;
    const prev = byQuery.get(primary);
    const bairro = o.bairro?.trim() ?? null;
    if (prev) {
      prev.indices.push(i);
    } else {
      byQuery.set(primary, { indices: [i], bairroSample: bairro });
    }
  });

  const uniqueQueries = [...byQuery.keys()].slice(0, maxU);

  for (let k = 0; k < uniqueQueries.length; k++) {
    if (k > 0) await delay(delayMs);
    if (isGeocodeInCooldown()) break;
    const primary = uniqueQueries[k]!;
    const meta = byQuery.get(primary)!;
    const coords = await geocodeOneOccurrenceGroup(primary, meta.bairroSample);
    if (coords) {
      for (const idx of meta.indices) {
        const row = list[idx];
        if (row) {
          row.latitude = coords.lat;
          row.longitude = coords.lng;
        }
      }
    }
    options?.onProgress?.(k + 1, uniqueQueries.length);
  }

  return list;
}
