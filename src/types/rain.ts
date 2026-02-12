export interface RainStation {
  id: string;
  name: string;
  location: [number, number];
  read_at: string;
  is_new: boolean;
  data: {
    m05: number;
    m15: number;
    h01: number;
    h02: number;
    h03: number;
    h04: number;
    h24: number;
    h96: number;
    mes: number;
  };
}

export interface RainLevel {
  name: string;
  description: string;
  min: number;
  max: number | null;
  color: string;
  bgColor: string;
}

/** Registro genérico de dado histórico vindo do BigQuery (ajuste conforme o schema da sua tabela) */
export interface HistoricalRainRecord {
  timestamp?: string;
  read_at?: string;
  dia?: string | { value?: string };
  station_id?: string;
  station_name?: string;
  estacao_id?: string | number;
  estacao?: string;
  name?: string;
  location?: string | unknown;
  /** Precipitação em mm (última hora, 24h, etc. – nomes podem variar no BD) */
  h01?: number;
  h24?: number;
  precipitation_mm?: number;
  [key: string]: unknown;
}

export interface HistoricalRainParams {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  sort?: 'asc' | 'desc';
  stationId?: string;
  station?: string;
}

export interface HistoricalRainResponse {
  success: boolean;
  data?: HistoricalRainRecord[];
  error?: string;
}