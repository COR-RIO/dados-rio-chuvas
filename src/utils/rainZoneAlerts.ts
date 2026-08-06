import type { RainStation } from '../types/rain';
import { rainfallToInfluenceLevel1h } from '../types/alertaRio';
import { RAIN_MACRO_ZONE_LABELS, getRainStationZone, type RainMacroZone } from '../config/rainZones';

/** Nº mínimo de estações da mesma zona em nível "muito forte" ao mesmo tempo para considerar
 * concentração (em vez de uma estação isolada, que já tem destaque próprio no mapa). */
const MIN_STATIONS_FOR_CONCENTRATION = 2;

export interface ZoneRainAlert {
  zone: RainMacroZone;
  label: string;
  stationCount: number;
  points: [number, number][];
}

/**
 * Zonas com >= MIN_STATIONS_FOR_CONCENTRATION estações em nível "muito forte" (InfluenceLevelValue
 * 4) de chuva na última hora ao mesmo tempo — concentração real, não um outlier isolado.
 *
 * Só retorna zonas que ENTRARAM em alerta agora (não estavam em `previousAlertedZones`), o que dá
 * o "uma vez por mudança de sinal" pedido — mesmo princípio do alerta de vento (useWindData.ts),
 * mas aqui a condição pode cair e subir de novo (chuva vai e volta), então `previousAlertedZones`
 * é substituído pelas zonas atualmente em alerta a cada chamada, não só acrescido: uma zona que
 * saiu do alerta pode alertar de novo se a concentração voltar a acontecer depois.
 */
export function detectZoneConcentration(
  stations: RainStation[],
  previousAlertedZones: Set<RainMacroZone>
): ZoneRainAlert[] {
  const byZone = new Map<RainMacroZone, RainStation[]>();
  for (const station of stations) {
    const zone = getRainStationZone(station.name);
    if (!zone || rainfallToInfluenceLevel1h(station.data.h01) !== 4) continue;
    const list = byZone.get(zone) ?? [];
    list.push(station);
    byZone.set(zone, list);
  }

  const currentlyAlerting = new Set<RainMacroZone>();
  const newAlerts: ZoneRainAlert[] = [];

  byZone.forEach((zoneStations, zone) => {
    if (zoneStations.length < MIN_STATIONS_FOR_CONCENTRATION) return;
    currentlyAlerting.add(zone);
    if (!previousAlertedZones.has(zone)) {
      newAlerts.push({
        zone,
        label: RAIN_MACRO_ZONE_LABELS[zone],
        stationCount: zoneStations.length,
        points: zoneStations.map((s) => s.location),
      });
    }
  });

  previousAlertedZones.clear();
  currentlyAlerting.forEach((z) => previousAlertedZones.add(z));

  return newAlerts;
}
