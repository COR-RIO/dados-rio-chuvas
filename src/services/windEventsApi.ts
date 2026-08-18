export interface WindEventRecord {
  icao: string;
  estacao_nome: string | null;
  corredor: string | null;
  observed_at: { value: string } | string;
  wind_speed_ms: number | null;
  wind_gust_ms: number | null;
  wind_direction_deg: number | null;
  message_type: 'METAR' | 'SPECI' | null;
  categoria: 'forte' | 'muito-forte' | null;
  raw: string | null;
  fonte: 'REDEMET' | 'INMET' | null;
}

interface WindEventsHistoryResponse {
  success: boolean;
  count?: number;
  data?: WindEventRecord[];
  error?: string;
}

/** Extrai a data ISO de um campo TIMESTAMP do BigQuery (vem como {value: "..."} via JSON.stringify). */
export function windEventTimestamp(record: WindEventRecord): string {
  const raw = record.observed_at;
  return typeof raw === 'string' ? raw : raw?.value ?? '';
}

/**
 * Histórico de vento forte/muito-forte (tabela vento_eventos_fortes no BigQuery), pro cruzamento
 * de debriefing — ver netlify/functions/wind-events-history.js.
 */
export async function fetchWindEventsHistory(dateFrom: string, dateTo: string): Promise<WindEventRecord[]> {
  const url = `/api/wind-events-history?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const json: WindEventsHistoryResponse = await response.json();
    if (!json.success || !json.data) {
      if (json.error) console.warn('Histórico de vento indisponível:', json.error);
      return [];
    }
    return json.data;
  } catch (err) {
    console.warn('Erro ao buscar histórico de vento:', err);
    return [];
  }
}
