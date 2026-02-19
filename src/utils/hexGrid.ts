import { polygonToCells, cellToBoundary, cellToLatLng, gridDisk } from 'h3-js';
import type { RainStation } from '../types/rain';
import { rainfallToInfluenceLevel15min, type InfluenceLevelValue } from '../types/alertaRio';
import type { BairroCollection } from '../services/citiesApi';

/** Bbox aproximada do município do Rio de Janeiro [lng, lat] - usado só se não houver bairros */
const RIO_BBOX_LNG_LAT: number[][] = [
  [-43.8, -23.05],
  [-43.1, -23.05],
  [-43.1, -22.75],
  [-43.8, -22.75],
  [-43.8, -23.05],
];

/** Resolução H3: 8 = hexágonos um pouco maiores (menos custo de renderização) */
const DEFAULT_RES = 8;

/** Feature genérica: pode vir como Polygon ou MultiPolygon da API */
type GeoFeature = {
  geometry: {
    type?: string;
    coordinates: number[][] | number[][][] | number[][][][];
  };
};

/** Garante anel como [lng, lat][] (remove 3ª coordenada se existir) */
function normalizeRing(ring: number[][]): number[][] {
  return ring.map((pt) => (pt.length >= 2 ? [Number(pt[0]), Number(pt[1])] : [0, 0]));
}

/**
 * Extrai todos os anéis exteriores de um feature (Polygon ou MultiPolygon).
 * Polygon: coordinates[0] = anel exterior.
 * MultiPolygon: coordinates[i][0] = anel exterior do i-ésimo polígono.
 */
function getExteriorRings(feature: GeoFeature): number[][][] {
  const coords = feature.geometry?.coordinates;
  const type = feature.geometry?.type;
  if (!coords?.length) return [];

  if (type === 'Polygon') {
    const ring = coords[0] as number[][];
    if (Array.isArray(ring) && ring.length >= 3) return [normalizeRing(ring)];
    return [];
  }

  // MultiPolygon ou sem type (API do Rio usa MultiPolygon)
  const rings: number[][][] = [];
  for (const polygon of coords as number[][][][]) {
    const exterior = polygon?.[0];
    if (Array.isArray(exterior) && exterior.length >= 3) rings.push(normalizeRing(exterior));
  }
  return rings;
}

/** Ray-casting: ponto [lng, lat] está dentro do anel (ring) [lng, lat][]? */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const dy = yj - yi;
    if (dy !== 0 && (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / dy + xi) inside = !inside;
  }
  return inside;
}

/** Verifica se (lat, lng) está dentro de algum polígono dos bairros */
function pointInBairros(lat: number, lng: number, bairrosData: BairroCollection): boolean {
  for (const feature of bairrosData.features) {
    for (const ring of getExteriorRings(feature as GeoFeature)) {
      if (ring.length && pointInRing(lng, lat, ring)) return true;
    }
  }
  return false;
}

/** Coleta todos os índices H3 dentro dos bairros e expande 2 anéis na borda para preencher todo o Rio */
function getH3IndicesInsideBairros(bairrosData: BairroCollection, res: number): Set<string> {
  const set = new Set<string>();
  for (const feature of bairrosData.features) {
    for (const exteriorRing of getExteriorRings(feature as GeoFeature)) {
      if (exteriorRing.length < 3) continue;
      try {
        const ids = polygonToCells(exteriorRing, res, true);
        ids.forEach((id) => set.add(id));
      } catch {
        // polígono inválido ou muito complexo: ignora
      }
    }
  }
  // Expande até 2 anéis: adiciona vizinhos que estejam dentro do município (preenche bordas e cantos)
  const expanded = new Set<string>(set);
  for (let ring = 1; ring <= 2; ring++) {
    const toCheck = [...expanded];
    for (const id of toCheck) {
      try {
        const neighbors = gridDisk(id, ring);
        for (const n of neighbors) {
          if (expanded.has(n)) continue;
          const [lat, lng] = cellToLatLng(n);
          if (pointInBairros(lat, lng, bairrosData)) expanded.add(n);
        }
      } catch {
        // ignora célula inválida
      }
    }
  }
  return expanded;
}

function squaredDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat1 - lat2;
  const dlng = lng1 - lng2;
  return dlat * dlat + dlng * dlng;
}

/**
 * Encontra a estação mais próxima e retorna o nível de influência (0-4) para a área de abrangência.
 * Usa m15 (mm/15min) com critério oficial: 0 | <1,25 | 1,25–6,25 | 6,25–12,5 | >12,5 (Termos Meteorológicos).
 */
function getLevelForPoint(lat: number, lng: number, stations: RainStation[]): InfluenceLevelValue {
  if (!stations.length) return 0;
  let nearest = stations[0];
  let minD2 = squaredDistance(lat, lng, nearest.location[0], nearest.location[1]);
  for (let i = 1; i < stations.length; i++) {
    const s = stations[i];
    const d2 = squaredDistance(lat, lng, s.location[0], s.location[1]);
    if (d2 < minD2) {
      minD2 = d2;
      nearest = s;
    }
  }
  const m15 = nearest.data.m15 ?? 0;
  return rainfallToInfluenceLevel15min(m15);
}

export interface HexCell {
  positions: [number, number][]; // [lat, lng] para Leaflet
  level: InfluenceLevelValue;
}

/**
 * Gera hexágonos H3 apenas dentro da região do RJ e atribui o nível de chuva (0-4)
 * baseado na estação mais próxima.
 * Se bairrosData for passado, usa exatamente os polígonos dos bairros (limite real do município).
 * Caso contrário, usa um retângulo aproximado (bbox).
 */
export function buildHexRainGrid(
  stations: RainStation[],
  res: number = DEFAULT_RES,
  bairrosData?: BairroCollection | null
): HexCell[] {
  const indices =
    bairrosData?.features?.length ?
      getH3IndicesInsideBairros(bairrosData, res)
    : new Set(polygonToCells(RIO_BBOX_LNG_LAT, res, true));

  const cells: HexCell[] = [];
  for (const h3Index of indices) {
    const boundary = cellToBoundary(h3Index, true) as [number, number][];
    const positions = boundary.map(([lng, lat]) => [lat, lng] as [number, number]);
    const [lat, lng] = cellToLatLng(h3Index);
    const level = getLevelForPoint(lat, lng, stations);
    cells.push({ positions, level });
  }
  return cells;
}
