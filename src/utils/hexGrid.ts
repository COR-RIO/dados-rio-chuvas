import { polygonToCells, cellToBoundary, cellToLatLng, gridDisk } from 'h3-js';
import type { RainStation } from '../types/rain';
import { rainfallToInfluenceLevel15min, rainfallToInfluenceLevel1h, type InfluenceLevelValue } from '../types/alertaRio';
import { accumulatedMmToInfluenceLevel } from './rainLevel';
import type { BairroCollection, ZonasPluvCollection } from '../services/citiesApi';
import { findStationForZone } from './zoneStationMatch';

/** Janela de dados para os hexágonos: 15 min (m15) ou 1 hora (h01) */
export type HexTimeWindow = '15min' | '1h';

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

/** Índice da estação mais próxima de (lat, lng). Usado para garantir que cada hexágono pertença a uma única área de abrangência. */
function nearestStationIndex(lat: number, lng: number, stations: RainStation[]): number {
  if (!stations.length) return -1;
  let idx = 0;
  let minD2 = squaredDistance(lat, lng, stations[0].location[0], stations[0].location[1]);
  for (let i = 1; i < stations.length; i++) {
    const d2 = squaredDistance(lat, lng, stations[i].location[0], stations[i].location[1]);
    if (d2 < minD2) {
      minD2 = d2;
      idx = i;
    }
  }
  return idx;
}

/**
 * Retorna o nível de influência (0-4) da estação mais próxima.
 * timeWindow '15min': m15. '1h': h01. Se accumulated, usa mm_accumulated.
 */
function getLevelForPoint(lat: number, lng: number, stations: RainStation[], timeWindow: HexTimeWindow): InfluenceLevelValue {
  const idx = nearestStationIndex(lat, lng, stations);
  if (idx < 0) return 0;
  const nearest = stations[idx];
  if (nearest.accumulated) {
    return accumulatedMmToInfluenceLevel(nearest.accumulated.mm_accumulated);
  }
  if (timeWindow === '1h') {
    return rainfallToInfluenceLevel1h(nearest.data.h01 ?? 0);
  }
  return rainfallToInfluenceLevel15min(nearest.data.m15 ?? 0);
}

/** Índice da zona (feature) que contém o ponto (lng, lat), ou -1 se nenhuma. */
function getZoneIndexForPoint(lng: number, lat: number, zonasData: ZonasPluvCollection): number {
  for (let i = 0; i < zonasData.features.length; i++) {
    const rings = getExteriorRings(zonasData.features[i] as GeoFeature);
    for (const ring of rings) {
      if (ring.length && pointInRing(lng, lat, ring)) return i;
    }
  }
  return -1;
}

/** Nível de influência (0-4) a partir dos dados da estação. */
function getLevelFromStation(
  station: RainStation,
  timeWindow: HexTimeWindow,
  showAccumulated: boolean
): InfluenceLevelValue {
  if (showAccumulated && station.accumulated != null) {
    return accumulatedMmToInfluenceLevel(station.accumulated.mm_accumulated);
  }
  if (timeWindow === '1h') {
    return rainfallToInfluenceLevel1h(station.data.h01 ?? 0);
  }
  return rainfallToInfluenceLevel15min(station.data.m15 ?? 0);
}

export interface HexCell {
  positions: [number, number][]; // [lat, lng] para Leaflet
  level: InfluenceLevelValue;
}

/**
 * Gera hexágonos H3 apenas dentro da região do RJ. Cada hexágono é incluído somente se
 * pertencer inteiramente à área de abrangência de uma única estação (centro e todos os
 * vértices têm a mesma estação mais próxima), para não sobrepor áreas de estações com valores diferentes.
 * timeWindow: '15min' usa m15, '1h' usa h01.
 */
export function buildHexRainGrid(
  stations: RainStation[],
  res: number = DEFAULT_RES,
  bairrosData?: BairroCollection | null,
  timeWindow: HexTimeWindow = '15min'
): HexCell[] {
  const indices =
    bairrosData?.features?.length ?
      getH3IndicesInsideBairros(bairrosData, res)
    : new Set(polygonToCells(RIO_BBOX_LNG_LAT, res, true));

  const cells: HexCell[] = [];
  for (const h3Index of indices) {
    const boundary = cellToBoundary(h3Index, true) as [number, number][];
    const [latCenter, lngCenter] = cellToLatLng(h3Index);
    const centerIdx = nearestStationIndex(latCenter, lngCenter, stations);
    if (centerIdx < 0) continue;
    // Só inclui o hex se todos os vértices pertencerem à mesma estação (área de influência correta, sem sobrepor).
    let sameStation = true;
    for (const [lng, lat] of boundary) {
      if (nearestStationIndex(lat, lng, stations) !== centerIdx) {
        sameStation = false;
        break;
      }
    }
    if (!sameStation) continue;
    const positions = boundary.map(([lng, lat]) => [lat, lng] as [number, number]);
    const level = getLevelForPoint(latCenter, lngCenter, stations, timeWindow);
    cells.push({ positions, level });
  }
  return cells;
}

/**
 * Gera hexágonos H3 exatamente dentro das áreas de abrangência oficiais (zonas-pluviometricas.geojson).
 * Cada hexágono só é incluído se estiver inteiramente dentro de uma única zona; o nível vem da estação
 * dessa zona (properties.est). Assim o hexágono fica exatamente na área que cada estação ocupa no mapa.
 */
export function buildHexRainGridFromZonas(
  zonasData: ZonasPluvCollection,
  stations: RainStation[],
  res: number = DEFAULT_RES,
  timeWindow: HexTimeWindow = '15min',
  showAccumulated: boolean = false
): HexCell[] {
  const indices = new Set<string>();
  for (const feature of zonasData.features) {
    const rings = getExteriorRings(feature as GeoFeature);
    for (const ring of rings) {
      if (ring.length < 3) continue;
      try {
        const ids = polygonToCells(ring, res, true);
        ids.forEach((id) => indices.add(id));
      } catch {
        // polígono inválido: ignora
      }
    }
  }

  const cells: HexCell[] = [];
  for (const h3Index of indices) {
    const [latCenter, lngCenter] = cellToLatLng(h3Index);
    const zoneIdx = getZoneIndexForPoint(lngCenter, latCenter, zonasData);
    if (zoneIdx < 0) continue;

    const boundary = cellToBoundary(h3Index, true) as [number, number][];
    let sameZone = true;
    for (const [lng, lat] of boundary) {
      if (getZoneIndexForPoint(lng, lat, zonasData) !== zoneIdx) {
        sameZone = false;
        break;
      }
    }
    if (!sameZone) continue;

    const feature = zonasData.features[zoneIdx];
    const est = feature.properties?.est ?? '';
    const station = findStationForZone(est, stations);
    const level = station ? getLevelFromStation(station, timeWindow, showAccumulated) : 0;
    const positions = boundary.map(([lng, lat]) => [lat, lng] as [number, number]);
    cells.push({ positions, level });
  }
  return cells;
}
