import { useCallback, useRef, useState } from 'react';
import type { WindStation } from '../types/wind';
import { buildCorridorSummary } from './useWindData';
import { fetchInmetWindHistory } from '../services/inmetWindApi';
import { fetchRedemetWindHistory } from '../services/redemetWindApi';
import { pickWindStationsAtTimestamp } from '../utils/windHistory';

/**
 * Vento histórico (INMET + REDEMET) para o cinturão, usado durante o playback do modo histórico —
 * ver useWindData.ts para a versão "ao vivo" (não usada aqui). A API-REDEMET aceita consulta por
 * intervalo de datas nativamente (confirmado contra o servidor real); o INMET usa o mesmo endpoint
 * de estação já existente, só que devolvendo todo o período em vez de só a leitura mais recente.
 *
 * Busca o período inteiro UMA VEZ (fetchRange, chamado ao clicar "Aplicar" no histórico) e depois
 * cada frame da linha do tempo só faz um lookup local (getFrame) — não refaz a chamada de API a
 * cada passo do playback.
 */
export function useHistoricalWindData() {
  const [series, setSeries] = useState<WindStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchRange = useCallback(async (fromIso: string, toIso: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [inmetSeries, redemetSeries] = await Promise.all([
        fetchInmetWindHistory(fromIso, toIso),
        fetchRedemetWindHistory(fromIso, toIso),
      ]);
      const combined = [...inmetSeries, ...redemetSeries];
      setSeries(combined);
      if (!combined.length) {
        setError('Nenhum dado histórico de vento disponível para o período');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico de vento');
      setSeries([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  /**
   * Estações + resumo por corredor "congelados" no instante alvo (frame atual do playback).
   * Tendência sempre "estável": sem um conceito claro de "leitura anterior" no histórico (ao
   * contrário do modo ao vivo, que compara contra o último polling), preferimos não inventar
   * tendência em vez de mostrar algo enganoso.
   */
  const getFrame = useCallback(
    (targetIso: string | null) => {
      const stations = pickWindStationsAtTimestamp(series, targetIso);
      const corridorSummary = buildCorridorSummary(stations, {});
      return { stations, corridorSummary };
    },
    [series]
  );

  return { series, loading, error, fetchRange, getFrame };
}
