// API Hexagon – Ocorrências (somente modo HISTÓRICO)
//
// Login e busca acontecem numa Netlify Function server-side (ver
// netlify/functions/ocorrencias-hexagon.js) — IP/usuário/senha nunca chegam ao bundle do
// cliente. Antes, essas credenciais viviam em VITE_OCORRENCIAS_API_* (client-side por definição
// do Vite: tudo prefixado VITE_ é embutido no JS público), então ficavam visíveis a qualquer
// visitante via DevTools. Configuração agora fica em OCORRENCIAS_API_BASE_URL/_USERNAME/_PASSWORD
// (sem VITE_) nas variáveis de ambiente do Netlify — ver .env.example.

import type { Occurrence } from '../types/occurrence';

const PROXY_URL = '/api/ocorrencias-hexagon';

export interface OcorrenciaStatus {
  id: string;
  numero?: string;
  titulo?: string;
  descricao?: string;
  dataAbertura?: string;
  dataEncerramento?: string;
  localizacao?: string;
  bairro?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  criticidade?: string;
  [key: string]: any;
}

interface OcorrenciasResponse {
  items?: OcorrenciaStatus[];
  totalItems?: number;
  pageNumber?: number;
  pageSize?: number;
  data?: OcorrenciaStatus[];
  total?: number;
  page?: number;
  [key: string]: any;
}

/**
 * Formata data para o padrão esperado pela API (DD-MM-YYYY)
 */
function formatDateForAPI(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Monta a URL da Netlify Function proxy (login/senha ficam só no servidor, ver arquivo acima). */
function buildStatusUrl(inicio: string, fim: string, page: number, pageSize: number): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(PROXY_URL, base);
  url.searchParams.set('inicio', inicio);
  url.searchParams.set('fim', fim);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  return url.toString();
}

/**
 * Busca ocorrências por data
 * @param dataInicio - Data inicial (formato: YYYY-MM-DD ou Date)
 * @param dataFim - Data final (formato: YYYY-MM-DD ou Date)
 * @param page - Número da página (padrão: 1)
 * @param pageSize - Quantidade de itens por página (padrão: 50)
 */
export async function fetchOcorrenciasByDate(
  dataInicio: string | Date,
  dataFim: string | Date,
  page: number = 1,
  pageSize: number = 50
): Promise<OcorrenciaStatus[]> {
  try {
    const inicio = formatDateForAPI(dataInicio);
    const fim = formatDateForAPI(dataFim);
    if (!inicio || !fim) {
      console.error('Datas inválidas para a API de ocorrências:', dataInicio, dataFim);
      return [];
    }

    const urlStr = buildStatusUrl(inicio, fim, page, pageSize);
    const response = await fetch(urlStr, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      console.error('Erro ao buscar ocorrências:', response.status);
      return [];
    }

    const data: OcorrenciasResponse = await response.json();

    // A API pode retornar os dados em diferentes estruturas
    const ocorrencias = data.items || data.data || [];
    return Array.isArray(ocorrencias) ? ocorrencias : [];
  } catch (err) {
    console.error('Erro ao buscar ocorrências da API:', err);
    return [];
  }
}

/**
 * Busca todas as ocorrências de um período, paginando automaticamente.
 * Usada apenas no modo histórico (API Hexagon). Em tempo real use a API Simaa (ocorrenciasAbertasApi).
 * @throws Quando a function/API retorna erro (ex.: 401, 500) para a primeira página
 */
export async function fetchAllOcorrenciasByDate(
  dataInicio: string | Date,
  dataFim: string | Date,
  pageSize: number = 50
): Promise<OcorrenciaStatus[]> {
  const inicio = formatDateForAPI(dataInicio);
  const fim = formatDateForAPI(dataFim);
  if (!inicio || !fim) {
    throw new Error('Datas inválidas para a API de ocorrências. Use o formato do período selecionado.');
  }

  let allOcorrencias: OcorrenciaStatus[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const urlStr = buildStatusUrl(inicio, fim, page, pageSize);
    const response = await fetch(urlStr, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const msg =
        page === 1
          ? `API de ocorrências (histórico) indisponível: ${body?.error ?? response.status}. Verifique OCORRENCIAS_API_BASE_URL/_USERNAME/_PASSWORD no Netlify.`
          : `Erro ao buscar página ${page}.`;
      throw new Error(msg);
    }

      const data: OcorrenciasResponse = await response.json();
      const ocorrencias = data.items || data.data || [];

      if (!Array.isArray(ocorrencias) || ocorrencias.length === 0) {
        hasMore = false;
      } else {
        allOcorrencias = allOcorrencias.concat(ocorrencias);
        page++;

        // Se a quantidade retornada é menor que pageSize, é a última página
        if (ocorrencias.length < pageSize) {
          hasMore = false;
        }
      }
    }

  return allOcorrencias;
}

/** Converte item da API (StatusDasOcorrencias) para o tipo Occurrence do app. Preserva todos os campos em rawApi. */
export function mapApiItemToOccurrence(item: OcorrenciaStatus): Occurrence {
  const isoAbertura = item.Data_Abertura ?? item.dataAbertura ?? '';
  const isoFechamento = item.Data_Fechamento ?? item.dataEncerramento ?? '';
  const [dateAbertura, timeAbertura] = isoAbertura.includes('T')
    ? [isoAbertura.slice(0, 10), isoAbertura.slice(11, 19).replace(/(:\d{2})$/, '')]
    : ['', ''];
  const [dateEncerramento, timeEncerramento] = isoFechamento.includes('T')
    ? [isoFechamento.slice(0, 10), isoFechamento.slice(11, 19).replace(/(:\d{2})$/, '')]
    : ['', ''];
  const lat = item.Latitude ?? item.latitude;
  const lng = item.Longitude ?? item.longitude;
  const rawApi: Record<string, unknown> = {};
  for (const key of Object.keys(item)) {
    rawApi[key] = item[key] ?? '';
  }
  return {
    id_ocorrencia: String(item.ID ?? item.id ?? ''),
    data_abertura: dateAbertura || null,
    hora_abertura: timeAbertura || null,
    data_hora_abertura: isoAbertura || null,
    data_encerramento: dateEncerramento || null,
    hora_encerramento: timeEncerramento || null,
    data_hora_encerramento: isoFechamento || null,
    duracao: item.Duracao_Minutos ?? item.duracao ?? null,
    pop: (item.POP_Nome ?? item.pop ?? item.titulo) ?? null,
    titulo: (item.Titulo ?? item.titulo) ?? null,
    localizacao: (item.Endereco ?? item.localizacao) ?? null,
    bairro: (item.Bairro ?? item.bairro) ?? null,
    sentido: null,
    ap: null,
    hierarquia_viaria: null,
    latitude: typeof lat === 'number' && !Number.isNaN(lat) ? lat : null,
    longitude: typeof lng === 'number' && !Number.isNaN(lng) ? lng : null,
    pluviometro_id: null,
    pluviometro_estacao: null,
    ponto_rio_aguas: null,
    agencias_acionadas: [item.AgenciasInformadas, item.AgenciasAcionadas, item.AgenciasPresentes, item.AgenciasEmAndamento, item.AgenciasFinalizadas].filter(Boolean).join(' - ') || null,
    agencia_principal: null,
    criticidade: (item.Categoria ?? item.criticidade) ?? null,
    estagio: (item.Andamento_Ocorrencia ?? item.status) ?? null,
    rawApi,
  };
}

/** Geocoding para histórico (Hexagon): ativo por padrão para localizar no mapa; desative com VITE_GEOCODE_OCORRENCIAS=false se quiser evitar Nominatim. */
const GEOCODE_ENABLED = import.meta.env.VITE_GEOCODE_OCORRENCIAS !== 'false';
/** Quantos endereços únicos geocodificar por carga (Hexagon não traz lat/lng; Simaa já traz). Respeita delay e cooldown ao 429. */
const MAX_GEOCODE_PER_LOAD = 12;
const GEOCODE_DELAY_MS = 2200;

/**
 * Busca todas as ocorrências do período na API Hexagon (histórico) e retorna no formato do app.
 * Como a Hexagon não retorna lat/lng, faz geocoding (endereço → lat/lng) para exibir os pontos no mapa; use VITE_GEOCODE_OCORRENCIAS=false para desativar.
 */
export async function fetchOccurrencesForMap(
  dataInicio: string,
  dataFim: string,
  pageSize: number = 50
): Promise<Occurrence[]> {
  const raw = await fetchAllOcorrenciasByDate(dataInicio, dataFim, pageSize);
  const list = raw.map(mapApiItemToOccurrence);

  if (!GEOCODE_ENABLED) return list;

  const {
    geocodeAddress,
    isGeocodeInCooldown,
    buildGeocodeQueryFromLocalizacao,
    GEOCODE_OPTIONS_RIO,
  } = await import('../utils/geocode');
  if (isGeocodeInCooldown()) return list;

  const delayMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const needGeocode = list
    .map((occ, index) => ({ occ, index }))
    .filter(({ occ }) => (occ.latitude == null || occ.longitude == null) && occ.localizacao?.trim());

  /** Mesmo critério da planilha: localização + bairro + Rio (texto único por combinação). */
  const queryToIndices = new Map<string, number[]>();
  const queryToBairro = new Map<string, string | null>();

  for (const { occ, index } of needGeocode) {
    const q = buildGeocodeQueryFromLocalizacao(occ.localizacao, occ.bairro);
    if (!q) continue;
    const arr = queryToIndices.get(q) ?? [];
    arr.push(index);
    queryToIndices.set(q, arr);
    if (!queryToBairro.has(q)) queryToBairro.set(q, occ.bairro?.trim() ?? null);
  }

  const toFetch = [...queryToIndices.keys()].slice(0, MAX_GEOCODE_PER_LOAD);
  const coordsByQuery = new Map<string, { lat: number; lng: number } | null>();

  for (let i = 0; i < toFetch.length; i++) {
    if (i > 0) await delayMs(GEOCODE_DELAY_MS);
    if (isGeocodeInCooldown()) break;
    const primary = toFetch[i]!;
    let coords = await geocodeAddress(primary, GEOCODE_OPTIONS_RIO);
    if (!coords) {
      const b = queryToBairro.get(primary);
      if (b) {
        await delayMs(400);
        if (!isGeocodeInCooldown()) {
          coords = await geocodeAddress(`${b}, Rio de Janeiro, RJ, Brasil`, GEOCODE_OPTIONS_RIO);
        }
      }
    }
    coordsByQuery.set(primary, coords);
  }

  for (const [primary, coords] of coordsByQuery) {
    if (!coords) continue;
    const indices = queryToIndices.get(primary) ?? [];
    for (const idx of indices) {
      const occ = list[idx];
      if (occ && (occ.latitude == null || occ.longitude == null)) {
        occ.latitude = coords.lat;
        occ.longitude = coords.lng;
      }
    }
  }
  return list;
}

/**
 * Busca todas as ocorrências do período (API Hexagon, histórico) no formato Occurrence do app,
 * SEM geocoding (mais rápido, suficiente para agregações da aba de Análise). Usa o mapper padrão.
 */
export async function fetchOccurrencesForAnalysis(
  dataInicio: string,
  dataFim: string,
  pageSize: number = 100
): Promise<Occurrence[]> {
  const raw = await fetchAllOcorrenciasByDate(dataInicio, dataFim, pageSize);
  return raw.map(mapApiItemToOccurrence);
}
