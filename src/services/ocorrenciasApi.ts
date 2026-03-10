// API Hexagon – Ocorrências (somente modo HISTÓRICO)
// Documentação: http://35.199.126.236:8085/api/swagger/index.html
// Em tempo real o app usa a API Simaa (ocorrenciasAbertasApi.ts): https://apisimaa.computei.srv.br/ocorrencias
// Credenciais em .env: VITE_OCORRENCIAS_API_USERNAME, VITE_OCORRENCIAS_API_PASSWORD

import type { Occurrence } from '../types/occurrence';

// Em desenvolvimento usa o proxy do Vite para evitar CORS; em produção usa a URL do .env ou fallback
const API_BASE_URL =
  import.meta.env.DEV
    ? '/api/ocorrencias'
    : (import.meta.env.VITE_OCORRENCIAS_API_BASE_URL ?? 'http://35.199.126.236:8085/api');
const API_USERNAME = import.meta.env.VITE_OCORRENCIAS_API_USERNAME ?? '';
const API_PASSWORD = import.meta.env.VITE_OCORRENCIAS_API_PASSWORD ?? '';

// Tipos para a API
interface LoginRequest {
  userName: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  expirationTime?: string; // ISO 8601, ex: "2026-03-09T12:55:50Z"
  [key: string]: any;
}

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

// Armazenar token em memória com expiração
let cachedToken: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Faz login na API e obtém um token de autenticação
 */
export async function loginOcorrenciasAPI(): Promise<string | null> {
  try {
    if (!API_USERNAME.trim() || !API_PASSWORD) {
      throw new Error(
        'Credenciais da API de ocorrências não configuradas. Defina VITE_OCORRENCIAS_API_USERNAME e VITE_OCORRENCIAS_API_PASSWORD no arquivo .env (copie de .env.example).'
      );
    }

    // Verificar se token em cache ainda é válido
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token;
    }

    const loginData: LoginRequest = {
      userName: API_USERNAME.trim(),
      password: API_PASSWORD,
    };

    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    if (response.status === 401) {
      throw new Error(
        'Login recusado (401). Verifique usuário e senha no .env (VITE_OCORRENCIAS_API_USERNAME e VITE_OCORRENCIAS_API_PASSWORD) e reinicie o servidor (npm run dev).'
      );
    }
    if (!response.ok) {
      console.error('Erro ao fazer login na API de Ocorrências:', response.status);
      return null;
    }

    const data: LoginResponse = await response.json();
    
    const token = data.accessToken ?? data.token;
    if (!token) {
      console.error('Token não retornado pela API de Ocorrências');
      return null;
    }

    // Usar expirationTime da API se existir, senão cache de 50 minutos
    let expiresAt: number;
    if (data.expirationTime) {
      expiresAt = new Date(data.expirationTime).getTime() - 60 * 1000; // 1 min antes
    } else {
      expiresAt = Date.now() + 50 * 60 * 1000;
    }
    cachedToken = { token, expiresAt };

    return token;
  } catch (err) {
    console.error('Erro ao autenticar na API de Ocorrências:', err);
    return null;
  }
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

/** Monta a URL do endpoint de ocorrências (funciona com base relativa em dev ou absoluta em prod). */
function buildStatusUrl(inicio: string, fim: string, page: number, pageSize: number): string {
  const path = `${API_BASE_URL}/Ocorrencias/StatusDasOcorrencias/${inicio}/${fim}`;
  if (path.startsWith('http')) {
    const url = new URL(path);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    return url.toString();
  }
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(path, base);
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
    // Fazer login para obter token
    const token = await loginOcorrenciasAPI();
    if (!token) {
      console.error('Não foi possível obter token de autenticação');
      return [];
    }

    const inicio = formatDateForAPI(dataInicio);
    const fim = formatDateForAPI(dataFim);
    if (!inicio || !fim) {
      console.error('Datas inválidas para a API de ocorrências:', dataInicio, dataFim);
      return [];
    }

    const urlStr = buildStatusUrl(inicio, fim, page, pageSize);
    const response = await fetch(urlStr, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

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
 * @throws Quando login falha ou a API retorna erro (ex.: 401, 500) para a primeira página
 */
export async function fetchAllOcorrenciasByDate(
  dataInicio: string | Date,
  dataFim: string | Date,
  pageSize: number = 50
): Promise<OcorrenciaStatus[]> {
  const token = await loginOcorrenciasAPI();
  if (!token) {
    throw new Error(
      'Não foi possível obter token da API Hexagon. Verifique VITE_OCORRENCIAS_API_USERNAME e VITE_OCORRENCIAS_API_PASSWORD no .env e reinicie o servidor (npm run dev).'
    );
  }

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
    const response = await fetch(urlStr, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const msg =
        page === 1
          ? `API Hexagon (histórico) retornou ${response.status}. Verifique credenciais no .env e se o servidor está acessível (http://35.199.126.236:8085).`
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

/**
 * Limpar o token em cache (útil para forçar novo login)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/** Converte item da API (StatusDasOcorrencias) para o tipo Occurrence do app. Preserva todos os campos em rawApi. */
function mapApiItemToOccurrence(item: OcorrenciaStatus): Occurrence {
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

  const { geocodeAddress, isGeocodeInCooldown } = await import('../utils/geocode');
  if (isGeocodeInCooldown()) return list;

  const delayMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const needGeocode = list.filter(
    (occ) => (occ.latitude == null || occ.longitude == null) && occ.localizacao?.trim()
  );
  const uniqueAddresses = [...new Set(needGeocode.map((occ) => occ.localizacao!.trim()))];
  const toFetch = uniqueAddresses.slice(0, MAX_GEOCODE_PER_LOAD);
  const coordsByAddress = new Map<string, { lat: number; lng: number } | null>();

  for (let i = 0; i < toFetch.length; i++) {
    if (i > 0) await delayMs(GEOCODE_DELAY_MS);
    if (isGeocodeInCooldown()) break;
    const addr = toFetch[i];
    const coords = await geocodeAddress(addr);
    coordsByAddress.set(addr, coords);
  }

  for (const occ of list) {
    if (occ.latitude != null && occ.longitude != null) continue;
    const addr = occ.localizacao?.trim();
    if (!addr) continue;
    const coords = coordsByAddress.get(addr) ?? null;
    if (coords) {
      occ.latitude = coords.lat;
      occ.longitude = coords.lng;
    }
  }
  return list;
}
