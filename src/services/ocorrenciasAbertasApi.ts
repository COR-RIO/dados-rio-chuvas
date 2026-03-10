/**
 * API de ocorrências abertas (tempo real) – Simaa
 * https://apisimaa.computei.srv.br/ocorrencias
 * Retorna apenas ocorrências abertas, com Latitude/Longitude (sem login).
 * Criticidade: Priority 1 = Muito alta, 2 = Alta, 3 = Média, 4 = Baixa (ver utils/criticidade.ts).
 */

import type { Occurrence } from '../types/occurrence';
import { getCriticidadeLabel } from '../utils/criticidade';

const SIMAA_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/ocorrencias-abertas/ocorrencias'
    : 'https://apisimaa.computei.srv.br/ocorrencias';

interface SimaaItem {
  EventId: string;
  AgencyEventTypeCode?: string;
  CreatedDate?: string;
  Latitude?: string | number;
  Longitude?: string | number;
  Location?: string;
  Priority?: number;
}

interface SimaaResponse {
  metadata?: { status?: string; message?: string; source?: string };
  data?: SimaaItem[];
}

function parseNum(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Extrai bairro do endereço "Logradouro, Bairro, Rio de Janeiro - RJ, CEP, Brasil" */
function bairroFromLocation(location: string | undefined): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(',').map((p) => p.trim());
  return parts.length >= 2 ? parts[1] : null;
}

function mapSimaaToOccurrence(item: SimaaItem): Occurrence {
  const lat = parseNum(item.Latitude);
  const lng = parseNum(item.Longitude);
  const created = item.CreatedDate ?? '';
  const [datePart, timePart] = created.includes('T')
    ? [created.slice(0, 10), created.slice(11, 19).replace(/(:\d{2})$/, '')]
    : ['', ''];
  return {
    id_ocorrencia: String(item.EventId ?? ''),
    data_abertura: datePart || null,
    hora_abertura: timePart || null,
    data_hora_abertura: created || null,
    data_encerramento: null,
    hora_encerramento: null,
    data_hora_encerramento: null,
    duracao: null,
    pop: item.AgencyEventTypeCode ?? null,
    titulo: null,
    localizacao: item.Location ?? null,
    bairro: bairroFromLocation(item.Location),
    sentido: null,
    ap: null,
    hierarquia_viaria: null,
    latitude: lat,
    longitude: lng,
    pluviometro_id: null,
    pluviometro_estacao: null,
    ponto_rio_aguas: null,
    agencias_acionadas: null,
    agencia_principal: null,
    criticidade: item.Priority != null ? getCriticidadeLabel(item.Priority) : null,
    estagio: 'Em aberto',
    rawApi: item as unknown as Record<string, unknown>,
  };
}

/**
 * Busca ocorrências abertas em tempo real (sem login).
 * Retorna lista no formato do app; já inclui lat/lng para exibir no mapa.
 */
export async function fetchOcorrenciasAbertas(): Promise<Occurrence[]> {
  try {
    const res = await fetch(SIMAA_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json: SimaaResponse = await res.json();
    const data = json.data;
    if (!Array.isArray(data)) return [];
    return data.map(mapSimaaToOccurrence);
  } catch (err) {
    console.error('Erro ao buscar ocorrências abertas (Simaa):', err);
    return [];
  }
}
