const RAINVIEWER_MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';

export interface RadarFrame {
  /** Timestamp Unix (segundos) da captura do frame. */
  time: number;
  /** Caminho relativo ao host (ex.: /v2/radar/902737a23a2f). */
  path: string;
}

export interface RadarFrames {
  host: string;
  /** Frames já capturados (últimas ~2h, a cada 10 min) — "vento/tempo passado". */
  past: RadarFrame[];
  /** Previsão de curtíssimo prazo (nem sempre disponível). */
  nowcast: RadarFrame[];
}

interface RainviewerResponse {
  host: string;
  radar?: { past?: RadarFrame[]; nowcast?: RadarFrame[] };
}

/**
 * Frames de radar meteorológico público (RainViewer) — sem API key, sem cadastro.
 * Não é dado de vento em si, mas é a melhor aproximação visual gratuita de "tempo passado"
 * sobre os pontos do cinturão (o radar mostra os sistemas de chuva/instabilidade associados
 * às rajadas, como recomendado na pesquisa original).
 */
export async function fetchRadarFrames(): Promise<RadarFrames | null> {
  try {
    const response = await fetch(RAINVIEWER_MAPS_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`RainViewer retornou ${response.status}`);
    const json: RainviewerResponse = await response.json();
    if (!json.host || !json.radar?.past?.length) return null;
    return {
      host: json.host,
      past: json.radar.past,
      nowcast: json.radar.nowcast ?? [],
    };
  } catch (err) {
    console.warn('Erro ao buscar frames do RainViewer:', err);
    return null;
  }
}

/** Monta a URL de tiles do Leaflet para um frame (placeholders {z}/{x}/{y} ficam para o react-leaflet). */
export function buildRadarTileUrl(host: string, frame: RadarFrame): string {
  // size=256, color=2 (esquema "Universal Blue", legível sobre o mapa de ruas), options=1_1 (suavizado + cores de neve)
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}
