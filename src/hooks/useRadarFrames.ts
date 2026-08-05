import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCorRadarFrames, stripSumareLegend, type CorRadarId } from '../services/radarCorApi';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // novo frame a cada ~5 min
const PLAYBACK_INTERVAL_MS = 700;

/** Fontes de radar disponíveis: radares da Prefeitura do Rio (Mendanha/Sumaré). */
export type RadarSourceId = CorRadarId;

/** Frame unificado para a linha do tempo/reprodução. */
export interface RadarFrameView {
  /** Timestamp Unix (segundos) do frame. */
  time: number;
  /** URL completa da imagem PNG do frame. */
  url: string;
}

/**
 * Busca e controla os frames do radar de uma fonte escolhida.
 * - 'mendanha' | 'sumare': radares da Prefeitura do Rio (imagens PNG com bounds).
 * - null: desligado (não busca nada).
 */
export function useRadarFrames(source: RadarSourceId | null) {
  const [frames, setFrames] = useState<RadarFrameView[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = último frame (mais recente)
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Blob URLs criadas para recortar a legenda embutida no PNG do Sumaré (precisam ser
  // revogadas manualmente ao trocar de frames/fonte, senão vazam memória).
  const blobUrlsRef = useRef<string[]>([]);

  const loadFrames = useCallback(async () => {
    if (!source) {
      setFrames([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const result = await fetchCorRadarFrames(source);
    if (!result || result.frames.length === 0) {
      setError('Radar indisponível no momento');
      setFrames([]);
      setLoading(false);
      return;
    }

    const urls =
      source === 'sumare'
        ? await Promise.all(result.frames.map((f) => stripSumareLegend(f.imageUrl)))
        : result.frames.map((f) => f.imageUrl);

    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = source === 'sumare' ? urls : [];

    setFrames(
      result.frames.map((f, i) => ({
        time: Math.floor(new Date(f.timestamp).getTime() / 1000),
        url: urls[i],
      })),
    );
    setError(null);
    setLoading(false);
  }, [source]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Ao trocar de fonte, reinicia a linha do tempo no frame mais recente e já inicia a reprodução
  // automaticamente (usuário não precisa clicar em play).
  useEffect(() => {
    setSelectedIndex(-1);
    setIsPlaying(source !== null);
  }, [source]);

  useEffect(() => {
    loadFrames();
    const interval = setInterval(loadFrames, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadFrames]);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const interval = setInterval(() => {
      setSelectedIndex((prev) => {
        const current = prev < 0 ? frames.length - 1 : prev;
        return (current + 1) % frames.length;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  const effectiveIndex = selectedIndex < 0 ? frames.length - 1 : selectedIndex;
  const currentFrame = frames[effectiveIndex] ?? null;
  const currentImageUrl = currentFrame?.url ?? null;

  return {
    source,
    frames,
    selectedIndex: effectiveIndex,
    setSelectedIndex,
    isPlaying,
    setIsPlaying,
    loading,
    error,
    currentFrame,
    currentImageUrl,
  };
}
