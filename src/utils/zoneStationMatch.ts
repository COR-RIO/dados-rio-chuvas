import type { RainStation } from '../types/rain';

/** Mapeamento est (GeoJSON) → nome da estação (pluviometros/API) quando os nomes divergem. */
const ZONE_EST_TO_STATION_NAME: Record<string, string> = {
  'Barra/Rio Centro': 'Barra/Riocentro',
  'Barra/Itanhangá': 'Barra/Barrinha',
  'Estrada Grajaú/Jacarepaguá': 'Est. Grajaú/Jacarepaguá',
};

/** Normaliza nome para comparação: minúsculas, trim, sem acentos, sem espaços. */
function normalizeName(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Encontra a estação que corresponde à zona pluviométrica pelo nome (properties.est do GeoJSON).
 * Usa mapeamento explícito para divergências (Barra/Rio Centro↔Barra/Riocentro, Barra/Itanhangá↔Barra/Barrinha);
 * depois comparação normalizada (sem acentos, sem espaços) e por inclusão.
 */
export function findStationForZone(estacaoName: string, stations: RainStation[]): RainStation | null {
  if (!estacaoName || !stations.length) return null;
  const nameToFind = ZONE_EST_TO_STATION_NAME[estacaoName.trim()] ?? estacaoName;
  const normEst = normalizeName(nameToFind);
  // Match exato normalizado
  let found = stations.find((s) => normalizeName(s.name) === normEst);
  if (found) return found;
  // Match por inclusão (ex.: "Jacarepaguá/Tanque" vs "Tanque" ou "Jacarepaguá")
  found = stations.find(
    (s) =>
      normEst.includes(normalizeName(s.name)) || normalizeName(s.name).includes(normEst)
  );
  return found ?? null;
}
