import { useCallback, useEffect, useRef, useState } from 'react';
import type { CorridorSummary, WindCorridor, WindStation } from '../types/wind';
import { msToKmh, windCategoryFromSpeedKmh, windLevelFromGustKmh } from '../types/wind';
import { fetchInmetWindObservations } from '../services/inmetWindApi';
import { fetchRedemetWind } from '../services/redemetWindApi';

export const CORRIDORS: WindCorridor[] = ['oeste-sudoeste', 'norte-noroeste', 'costeiro', 'interno'];
// 5 min — igual à chuva (App.tsx: useRainData refreshInterval=300000). O cache da function
// (redemet-wind.js) também é 5 min, então bate certinho; e com SPECI entrando na leitura de
// anomalia, vale a pena checar mais rápido que o antigo 10 min (METAR de rotina é horário, mas
// SPECI pode aparecer bem antes disso quando há mudança significativa).
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Exportado para reaproveitar no playback histórico (useHistoricalWindData). */
export function buildCorridorSummary(
  stations: WindStation[],
  previousMaxByCorridor: Partial<Record<WindCorridor, number>>
): Record<WindCorridor, CorridorSummary> {
  const summary = {} as Record<WindCorridor, CorridorSummary>;

  for (const corridor of CORRIDORS) {
    const corridorStations = stations.filter((s) => s.corridor === corridor);
    if (!corridorStations.length) {
      summary[corridor] = {
        corridor,
        maxGustKmh: 0,
        dominantDirectionDeg: null,
        level: windLevelFromGustKmh(0),
        trend: 'estavel',
        stationCount: 0,
        station: null,
      };
      continue;
    }

    const strongest = corridorStations.reduce((max, s) => {
      const gustMs = s.windGustMs ?? s.windSpeedMs;
      const maxGustMs = max.windGustMs ?? max.windSpeedMs;
      return gustMs > maxGustMs ? s : max;
    });

    const maxGustKmh = msToKmh(strongest.windGustMs ?? strongest.windSpeedMs);
    const previousMax = previousMaxByCorridor[corridor];
    const trend: CorridorSummary['trend'] =
      previousMax == null || Math.abs(maxGustKmh - previousMax) < 3
        ? 'estavel'
        : maxGustKmh > previousMax
          ? 'subindo'
          : 'caindo';

    summary[corridor] = {
      corridor,
      maxGustKmh,
      dominantDirectionDeg: strongest.windDirectionDeg,
      level: windLevelFromGustKmh(maxGustKmh),
      trend,
      stationCount: corridorStations.length,
      station: {
        id: strongest.id,
        name: strongest.name,
        code: strongest.code,
        source: strongest.source,
        location: strongest.location,
      },
    };
  }

  return summary;
}

/** Estação em vento forte/muito-forte cujo METAR mais recente é um SPECI (relatório especial —
 * só emitido quando há mudança significativa). Dispara o alerta automático de vento. */
export function findWindAlerts(
  stations: WindStation[],
  alertedStationKeys: Set<string>
): WindStation[] {
  const alerts = stations.filter((s) => {
    const category = windCategoryFromSpeedKmh(msToKmh(s.windGustMs ?? s.windSpeedMs));
    const key = `${s.code}-${s.observedAt}`;
    return (
      s.messageType === 'SPECI' &&
      (category === 'forte' || category === 'muito-forte') &&
      !alertedStationKeys.has(key)
    );
  });
  alerts.forEach((s) => alertedStationKeys.add(`${s.code}-${s.observedAt}`));
  return alerts;
}

export function useWindData(refreshInterval: number = DEFAULT_REFRESH_INTERVAL_MS) {
  const [stations, setStations] = useState<WindStation[]>([]);
  const [corridorSummary, setCorridorSummary] = useState<Record<WindCorridor, CorridorSummary> | null>(null);
  const [windAlerts, setWindAlerts] = useState<WindStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const inFlightRef = useRef(false);
  const previousMaxByCorridorRef = useRef<Partial<Record<WindCorridor, number>>>({});
  const alertedStationKeysRef = useRef<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setError(null);
      const [inmetStations, redemetStations] = await Promise.all([
        fetchInmetWindObservations(),
        fetchRedemetWind(),
      ]);
      const combined = [...inmetStations, ...redemetStations];

      if (!combined.length) {
        setError('Nenhuma estação de vento disponível no momento');
      }

      const summary = buildCorridorSummary(combined, previousMaxByCorridorRef.current);
      setStations(combined);
      setCorridorSummary(summary);
      previousMaxByCorridorRef.current = Object.fromEntries(
        CORRIDORS.map((c) => [c, summary[c].maxGustKmh])
      );
      setWindAlerts(findWindAlerts(combined, alertedStationKeysRef.current));
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados de vento');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

  return { stations, corridorSummary, windAlerts, loading, error, lastUpdate, refresh: loadData };
}
