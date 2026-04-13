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

function getField<T = unknown>(row: RawOccurrenceRow, keys: string[]): T | null {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== '') {
      return value as T;
    }
  }
  return null;
}

function normalizeHeaderKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getFieldByAliases<T = unknown>(row: RawOccurrenceRow, aliases: string[]): T | null {
  const direct = getField<T>(row, aliases);
  if (direct != null) return direct;
  const normalizedMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    normalizedMap.set(normalizeHeaderKey(k), v);
  }
  for (const alias of aliases) {
    const value = normalizedMap.get(normalizeHeaderKey(alias));
    if (value != null && String(value).trim() !== '') return value as T;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  // Aceita apenas formatos seguros: DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD
  const isoLike = /^\d{4}-\d{2}-\d{2}$/;
  const brLike = /^\d{2}\/\d{2}\/\d{4}$/;
  const brDashLike = /^\d{2}-\d{2}-\d{4}$/;
  if (isoLike.test(s)) return s;
  if (brLike.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (brDashLike.test(s)) {
    const [dd, mm, yyyy] = s.split('-');
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
  if (Number.isFinite(n)) return n;
  // Formato comum em "Relação de Ocorrências": "0 D 00:08:00"
  const dayTimeLike = /^(\d+)\s*D\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/i;
  const dayTime = s.match(dayTimeLike);
  if (dayTime) {
    const days = Number(dayTime[1] ?? 0);
    const hours = Number(dayTime[2] ?? 0);
    const mins = Number(dayTime[3] ?? 0);
    const secs = Number(dayTime[4] ?? 0);
    if ([days, hours, mins, secs].every((x) => Number.isFinite(x))) {
      return days * 24 * 60 + hours * 60 + mins + secs / 60;
    }
  }
  return null;
}

function parseDateTimeParts(value: unknown): { date: string | null; time: string | null } {
  if (value == null) return { date: null, time: null };
  const s = String(value).trim();
  if (!s) return { date: null, time: null };
  const m = s.match(/^(\d{2}[/-]\d{2}[/-]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (!m) return { date: normalizeDate(s), time: normalizeTime(s) };
  return {
    date: normalizeDate(m[1]),
    time: normalizeTime(m[2]),
  };
}

function parseLatLong(value: unknown): { latitude: number | null; longitude: number | null } {
  const raw = toStringOrNull(value);
  if (!raw) return { latitude: null, longitude: null };
  const parts = raw.split(',').map((part) => part.trim());
  if (parts.length < 2) return { latitude: null, longitude: null };
  return {
    latitude: toNumberOrNull(parts[0]),
    longitude: toNumberOrNull(parts[1]),
  };
}

function mapRowToOccurrence(row: RawOccurrenceRow): Occurrence {
  const criacao = parseDateTimeParts(getFieldByAliases(row, ['Criação', 'Criacao']));
  const finalizacao = parseDateTimeParts(getFieldByAliases(row, ['Finalização', 'Finalizacao']));
  const dataAbertura = normalizeDate(getFieldByAliases(row, ['Data Abertura'])) ?? criacao.date;
  const horaAbertura = normalizeTime(getFieldByAliases(row, ['Hora Abertura'])) ?? criacao.time;
  const dataEnc = normalizeDate(getFieldByAliases(row, ['Data Encerramento'])) ?? finalizacao.date;
  const horaEnc = normalizeTime(getFieldByAliases(row, ['Hora Encerramento'])) ?? finalizacao.time;

  const dataHoraAbertura = buildIsoDateTime(dataAbertura, horaAbertura);
  const dataHoraEncerramento = buildIsoDateTime(dataEnc, horaEnc);
  const latLong = parseLatLong(getFieldByAliases(row, ['Lat/Long', 'Lat Long', 'Latitude/Longitude', 'Latitude Longitude']));

  return {
    id_ocorrencia: toStringOrNull(getFieldByAliases(row, ['Ocorrência', 'Ocorrencia', 'ID'])) ?? '',
    data_abertura: dataAbertura,
    hora_abertura: horaAbertura,
    data_hora_abertura: dataHoraAbertura,
    data_encerramento: dataEnc,
    hora_encerramento: horaEnc,
    data_hora_encerramento: dataHoraEncerramento,
    duracao: normalizeDurationMinutes(row['Duração']),
    pop: toStringOrNull(getFieldByAliases(row, ['POP', 'Pop'])),
    titulo: toStringOrNull(getFieldByAliases(row, ['Título', 'Titulo', ' Título '])),
    localizacao: toStringOrNull(getFieldByAliases(row, ['Localização', 'Localizacao', 'Endereço', 'Endereco'])),
    bairro: toStringOrNull(row.Bairro),
    sentido: toStringOrNull(row.Sentido),
    ap: toStringOrNull(getFieldByAliases(row, ['AP', 'Ap'])),
    hierarquia_viaria: toStringOrNull(getFieldByAliases(row, ['Hierarquia Viária', 'Hierarquia Viaria'])),
    latitude: toNumberOrNull(row.Latitude) ?? latLong.latitude,
    longitude: toNumberOrNull(row.Longitude) ?? latLong.longitude,
    pluviometro_id: toStringOrNull(getFieldByAliases(row, ['Pluviômetro ID', 'Pluviometro ID'])),
    pluviometro_estacao: toStringOrNull(getFieldByAliases(row, ['Pluviômetro Estação', 'Pluviometro Estacao'])),
    ponto_rio_aguas: toStringOrNull(getFieldByAliases(row, ['Ponto Rio Águas', 'Ponto Rio Aguas'])),
    agencias_acionadas: toStringOrNull(getFieldByAliases(row, ['Agências Acionadas', 'Agencias Acionadas', 'Agência(s)', 'Agencia(s)'])),
    agencia_principal: toStringOrNull(getFieldByAliases(row, ['Agência Principal', 'Agencia Principal'])),
    criticidade: toStringOrNull(getFieldByAliases(row, ['Criticidade', 'Criticidade  '])),
    estagio: toStringOrNull(getFieldByAliases(row, ['Estágio', 'Estagio'])),
    /** Preserva todas as colunas da planilha (incl. nomes não mapeados acima). */
    rawApi: { ...(row as Record<string, unknown>) },
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

/**
 * Parseia um buffer XLSX (ex.: fetch de /planilhas/arquivo.xlsx)
 * e retorna uma lista de ocorrências padronizadas.
 * Uso: navegador/runtime com arquivos em public/.
 */
export function parseOccurrencesFromArrayBuffer(buffer: ArrayBuffer): Occurrence[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = getFirstWorksheet(workbook);
  const rawRows = XLSX.utils.sheet_to_json<RawOccurrenceRow>(sheet, { defval: null });
  return rawRows
    .map(mapRowToOccurrence)
    .filter((occ) => occ.id_ocorrencia !== '');
}

