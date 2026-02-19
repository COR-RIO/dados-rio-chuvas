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
  /** Precipitação em mm (última hora, 24h, 96h – nomes podem variar no BD) */
  h01?: number;
  h24?: number;
  h96?: number;
  precipitation_mm?: number;
  [key: string]: unknown;
}

export interface HistoricalRainParams {
  dateFrom?: string;
  dateTo?: string;
  /** Filtro de horário (formato "HH:mm" ou "HH:mm:ss") – combinado com a data em dateFrom/dateTo */
  timeFrom?: string;
  timeTo?: string;
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

/** Um intervalo de datas (ex.: um dia) com acumulado de chuva (mm) e estações no fim do intervalo */
export interface HistoricalRainInterval {
  /** Data no formato YYYY-MM-DD */
  date: string;
  /** Label para exibição (ex.: "09/02/2026") */
  dateLabel: string;
  /** Acumulado no intervalo (soma de m15, mm) – aproximação do total no período */
  accumulatedMm: number;
  /** Quantidade de registros no intervalo */
  recordCount: number;
  /** Estações no último horário do intervalo (snapshot do fim do dia) */
  stations: RainStation[];
}