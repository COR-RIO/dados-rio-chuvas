/**
 * API dos radares da Prefeitura do Rio (Mendanha/Sumaré) — servidos pelo
 * servidor dashboard-radares (dashboardradar.cor.rio).
 *
 * Endpoints:
 *   GET /api/frames/{mendanha|sumare}  → { frames: string[], count, latest_timestamp?, delay_minutes? }
 *   GET /api/frame/{radar}/{filename}  → imagem PNG do frame
 *
 * CORS aberto em /api/*, então o fetch pode ser feito direto do navegador.
 */
export const COR_RADAR_BASE_URL = 'https://dashboardradar.cor.rio';

export type CorRadarId = 'mendanha' | 'sumare';

export interface CorRadarFrame {
  /** Timestamp ISO do frame (Mendanha: extraído do nome do arquivo; Sumaré: estimado em 5 min). */
  timestamp: string;
  /** URL completa da imagem PNG do frame. */
  imageUrl: string;
  /** Nome do arquivo no servidor (ex.: MDN-20251203-1200.png). */
  filename: string;
}

export interface CorRadarData {
  radar: CorRadarId;
  frames: CorRadarFrame[];
  /** Timestamp do frame mais recente, quando o servidor informa. */
  latestTimestamp: string | null;
  /** Atraso em minutos do radar, quando o servidor informa. */
  delayMinutes: number | null;
}

/**
 * Extrai timestamp ISO do nome do arquivo do radar Mendanha.
 * Suporta dois formatos observados:
 *   - Atual:    iris-focusYYMMDDHHMMSS.MAXxxxx_transparente.png → 2026-08-04T16:25:03.000Z
 *   - Legado:   MDN-YYYYMMDD-HHMM[_...].png → 2025-12-03T12:00:00.000Z
 */
export function parseMendanhaTimestamp(filename: string): string | null {
  const focus = filename.match(/focus(\d{12})/);
  if (focus) {
    const [, yymmddhhmmss] = focus;
    const year = `20${yymmddhhmmss.slice(0, 2)}`;
    const month = yymmddhhmmss.slice(2, 4);
    const day = yymmddhhmmss.slice(4, 6);
    const hour = yymmddhhmmss.slice(6, 8);
    const minute = yymmddhhmmss.slice(8, 10);
    const second = yymmddhhmmss.slice(10, 12);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  }
  const match = filename.match(/MDN-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

/**
 * O radar Sumaré não tem timestamp no nome do arquivo (radarNNN.png);
 * estimamos o horário assumindo cadência de 5 min entre frames, com o
 * frame mais recente como "agora" (arredondado para múltiplo de 5 min).
 */
export function parseSumareTimestamp(_filename: string, index: number, total: number): string {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
  const offsetMs = (total - 1 - index) * 5 * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString();
}

/** Busca a lista de frames de um radar COR e devolve no formato [{ timestamp, imageUrl }]. */
export async function fetchCorRadarFrames(radar: CorRadarId): Promise<CorRadarData | null> {
  try {
    const response = await fetch(`${COR_RADAR_BASE_URL}/api/frames/${radar}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Radar COR retornou ${response.status}`);
    const json = await response.json();
    const filenames: string[] = Array.isArray(json.frames) ? json.frames : [];
    const total = filenames.length;

    const frames: CorRadarFrame[] = filenames.map((filename, index) => {
      let timestamp: string | null = null;
      if (radar === 'mendanha') timestamp = parseMendanhaTimestamp(filename);
      else if (radar === 'sumare') timestamp = parseSumareTimestamp(filename, index, total);
      return {
        timestamp: timestamp ?? new Date().toISOString(),
        imageUrl: `${COR_RADAR_BASE_URL}/api/frame/${radar}/${filename}`,
        filename,
      };
    });

    return {
      radar,
      frames,
      latestTimestamp: json.latest_timestamp ?? null,
      delayMinutes: json.delay_minutes ?? null,
    };
  } catch (err) {
    console.warn(`Erro ao buscar frames do radar ${radar}:`, err);
    return null;
  }
}

/**
 * Retângulo (em pixels, imagem 1024x768) onde o radar Sumaré desenha a legenda
 * "REFLECTIVITY (dBZ)" dentro do próprio PNG — posição fixa confirmada em vários frames.
 * A legenda em HTML (RadarMapLegend) já cobre essa informação, então recortamos o trecho
 * do raster para não sobrepor o mapa.
 */
const SUMARE_LEGEND_RECT = { x: 5, y: 233, width: 150, height: 261 };

/**
 * Baixa a imagem do radar Sumaré e apaga (torna transparente) a região onde o servidor
 * desenha a legenda "REFLECTIVITY (dBZ)" embutida no PNG. Retorna uma blob URL própria
 * para uso no ImageOverlay; em caso de falha, devolve a URL original sem recorte.
 */
export async function stripSumareLegend(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageUrl;
    ctx.drawImage(bitmap, 0, 0);
    ctx.clearRect(SUMARE_LEGEND_RECT.x, SUMARE_LEGEND_RECT.y, SUMARE_LEGEND_RECT.width, SUMARE_LEGEND_RECT.height);
    const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return outBlob ? URL.createObjectURL(outBlob) : imageUrl;
  } catch (err) {
    console.warn('Erro ao recortar legenda do radar Sumaré:', err);
    return imageUrl;
  }
}

/**
 * Bounds geográficos da cobertura do radar COR (sudoeste/nordeste em [lat, lng]),
 * usados pelo ImageOverlay do Leaflet para posicionar a imagem PNG sobre o mapa.
 */
export const COR_RADAR_BOUNDS: [[number, number], [number, number]] = [
  [-24.07974181385155, -44.88549887560727], // sudoeste [lat, lng]
  [-21.568618096884588, -42.16109533159336], // nordeste [lat, lng]
];
