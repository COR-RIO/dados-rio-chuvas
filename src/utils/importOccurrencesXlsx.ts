import * as XLSX from 'xlsx';
import { RawOccurrenceRow, Occurrence } from '../types/occurrence';

type Workbook = XLSX.WorkBook;
type Worksheet = XLSX.WorkSheet;

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  // Aceita apenas formatos seguros: DD/MM/YYYY ou YYYY-MM-DD
  const isoLike = /^\d{4}-\d{2}-\d{2}$/;
  const brLike = /^\d{2}\/\d{2}\/\d{4}$/;
  if (isoLike.test(s)) return s;
  if (brLike.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function normalizeTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  // Garante formato HH:mm[:ss]
  const full = s.length === 4 && /^\d{4}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2)}` : s;
  const timeLike = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const m = full.match(timeLike);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const ss = m[3] ? m[3].padStart(2, '0') : null;
  return ss ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

function buildIsoDateTime(dateYyyyMmDd: string | null, timeHhMm: string | null): string | null {
  if (!dateYyyyMmDd) return null;
  if (!timeHhMm) return `${dateYyyyMmDd}T00:00:00`;
  const time = timeHhMm.length === 5 ? `${timeHhMm}:00` : timeHhMm;
  return `${dateYyyyMmDd}T${time}`;
}

function normalizeDurationMinutes(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const s = String(value).trim();
  if (!s) return null;
  // Tenta "HH:MM:SS" ou "HH:MM"
  const hms = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const m = s.match(hms);
  if (m) {
    const h = Number(m[1] ?? 0);
    const min = Number(m[2] ?? 0);
    const sec = Number(m[3] ?? 0);
    if ([h, min, sec].every((x) => Number.isFinite(x))) {
      return h * 60 + min + sec / 60;
    }
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function mapRowToOccurrence(row: RawOccurrenceRow): Occurrence {
  const dataAbertura = normalizeDate(row['Data Abertura']);
  const horaAbertura = normalizeTime(row['Hora Abertura']);
  const dataEnc = normalizeDate(row['Data Encerramento']);
  const horaEnc = normalizeTime(row['Hora Encerramento']);

  const dataHoraAbertura = buildIsoDateTime(dataAbertura, horaAbertura);
  const dataHoraEncerramento = buildIsoDateTime(dataEnc, horaEnc);

  return {
    id_ocorrencia: toStringOrNull(row['Ocorrência']) ?? '',
    data_abertura: dataAbertura,
    hora_abertura: horaAbertura,
    data_hora_abertura: dataHoraAbertura,
    data_encerramento: dataEnc,
    hora_encerramento: horaEnc,
    data_hora_encerramento: dataHoraEncerramento,
    duracao: normalizeDurationMinutes(row['Duração']),
    pop: toStringOrNull(row.POP),
    titulo: toStringOrNull(row['Título']),
    localizacao: toStringOrNull(row['Localização']),
    bairro: toStringOrNull(row.Bairro),
    sentido: toStringOrNull(row.Sentido),
    ap: toStringOrNull(row.AP),
    hierarquia_viaria: toStringOrNull(row['Hierarquia Viária']),
    latitude: toNumberOrNull(row.Latitude),
    longitude: toNumberOrNull(row.Longitude),
    pluviometro_id: toStringOrNull(row['Pluviômetro ID']),
    pluviometro_estacao: toStringOrNull(row['Pluviômetro Estação']),
    ponto_rio_aguas: toStringOrNull(row['Ponto Rio Águas']),
    agencias_acionadas: toStringOrNull(row['Agências Acionadas']),
    agencia_principal: toStringOrNull(row['Agência Principal']),
    criticidade: toStringOrNull(row['Criticidade']),
    estagio: toStringOrNull(row['Estágio']),
  };
}

function getFirstWorksheet(workbook: Workbook): Worksheet {
  const sheetName = workbook.SheetNames[0];
  return workbook.Sheets[sheetName];
}

/**
 * Lê um arquivo XLSX de ocorrências (no formato da Prefeitura)
 * e retorna uma lista de ocorrências padronizadas para uso no sistema.
 */
export function importOccurrencesFromXlsx(filePath: string): Occurrence[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = getFirstWorksheet(workbook);
  const rawRows = XLSX.utils.sheet_to_json<RawOccurrenceRow>(sheet, { defval: null });
  return rawRows
    .map(mapRowToOccurrence)
    .filter((occ) => occ.id_ocorrencia !== '');
}

