export interface RawOccurrenceRow {
  'Ocorrência'?: string | number;
  /** Alias usado em exportações (ex.: Relação de Ocorrências) */
  'Agência(s)'?: string;
  'Agências Acionadas'?: string;
  'Agência Principal'?: string;
  'Criticidade'?: string;
  'Estágio'?: string;
  'Data Abertura'?: string | Date;
  'Hora Abertura'?: string;
  'Data Encerramento'?: string | Date;
  'Hora Encerramento'?: string;
  'Duração'?: string | number;
  POP?: string;
  'Título'?: string;
  'Localização'?: string;
  Bairro?: string;
  Sentido?: string;
  AP?: string;
  'Hierarquia Viária'?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  'Pluviômetro ID'?: string | number;
  'Pluviômetro Estação'?: string;
  'Ponto Rio Águas'?: string;
  [key: string]: unknown;
}

export interface Occurrence {
  id_ocorrencia: string;
  data_abertura: string | null; // YYYY-MM-DD
  hora_abertura: string | null; // HH:mm[:ss]
  data_hora_abertura: string | null; // ISO
  data_encerramento: string | null;
  hora_encerramento: string | null;
  data_hora_encerramento: string | null;
  duracao: number | null; // minutos (quando possível)
  pop: string | null;
  titulo: string | null;
  localizacao: string | null;
  bairro: string | null;
  sentido: string | null;
  ap: string | null;
  hierarquia_viaria: string | null;
  latitude: number | null;
  longitude: number | null;
  pluviometro_id: string | null;
  pluviometro_estacao: string | null;
  ponto_rio_aguas: string | null;
  agencias_acionadas: string | null;
  agencia_principal: string | null;
  /** Nível de criticidade: 1 = Muito alta, 2 = Alta, 3 = Média, 4 = Baixa (ver utils/criticidade.ts). Pode vir como label ou número da API. */
  criticidade: string | null;
  estagio: string | null;
  /** Campos brutos: API Hexagon/Simaa ou linha completa da planilha Excel (todas as colunas da aba). */
  rawApi?: Record<string, unknown>;
}

