// API para integração com Hexagon - Ocorrências
// Documentação: http://35.199.126.236:8085/api/swagger/index.html

const API_BASE_URL = 'http://35.199.126.236:8085/api';
const API_USERNAME = 'RestAPI';
const API_PASSWORD = '@Hexagon2024';

// Tipos para a API
interface LoginRequest {
  userName: string;
  password: string;
}

interface LoginResponse {
  token: string;
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
    // Verificar se token em cache ainda é válido
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token;
    }

    const loginData: LoginRequest = {
      userName: API_USERNAME,
      password: API_PASSWORD,
    };

    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    if (!response.ok) {
      console.error('Erro ao fazer login na API de Ocorrências:', response.status);
      return null;
    }

    const data: LoginResponse = await response.json();
    
    if (!data.token) {
      console.error('Token não retornado pela API de Ocorrências');
      return null;
    }

    // Armazenar token em cache por 50 minutos (token geralmente expira em 60 minutos)
    cachedToken = {
      token: data.token,
      expiresAt: Date.now() + 50 * 60 * 1000,
    };

    return data.token;
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
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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

    // Formatar datas no padrão esperado pela API
    const inicio = formatDateForAPI(dataInicio);
    const fim = formatDateForAPI(dataFim);

    // Construir URL com query parameters
    const url = new URL(
      `${API_BASE_URL}/Ocorrencias/StatusDasOcorrencias/${inicio}/${fim}`
    );
    url.searchParams.append('page', String(page));
    url.searchParams.append('pageSize', String(pageSize));

    const response = await fetch(url.toString(), {
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
 * Busca todas as ocorrências de um período, paginando automaticamente
 */
export async function fetchAllOcorrenciasByDate(
  dataInicio: string | Date,
  dataFim: string | Date,
  pageSize: number = 50
): Promise<OcorrenciaStatus[]> {
  try {
    const token = await loginOcorrenciasAPI();
    if (!token) {
      console.error('Não foi possível obter token de autenticação');
      return [];
    }

    const inicio = formatDateForAPI(dataInicio);
    const fim = formatDateForAPI(dataFim);

    let allOcorrencias: OcorrenciaStatus[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(
        `${API_BASE_URL}/Ocorrencias/StatusDasOcorrencias/${inicio}/${fim}`
      );
      url.searchParams.append('page', String(page));
      url.searchParams.append('pageSize', String(pageSize));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Erro ao buscar ocorrências na página', page);
        break;
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
  } catch (err) {
    console.error('Erro ao buscar todas as ocorrências:', err);
    return [];
  }
}

/**
 * Limpar o token em cache (útil para forçar novo login)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
