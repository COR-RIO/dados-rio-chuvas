import { useCallback, useEffect, useRef, useState } from 'react';
import { buildRadarTileUrl, fetchRadarFrames, type RadarFrame } from '../services/rainviewerApi';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // novo frame a cada ~10 min
const PLAYBACK_INTERVAL_MS = 700;

export function useRadarFrames() {
  const [host, setHost] = useState('');
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = último frame (mais recente)
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFrames = useCallback(async () => {
    const result = await fetchRadarFrames();
    if (!result) {
      setError('Radar indisponível no momento');
      setLoading(false);
      return;
    }
    setHost(result.host);
    setFrames(result.past);
    setError(null);
    setLoading(false);
  }, []);

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
  const tileUrl = currentFrame && host ? buildRadarTileUrl(host, currentFrame) : null;

  return {
    frames,
    selectedIndex: effectiveIndex,
    setSelectedIndex,
    isPlaying,
    setIsPlaying,
    loading,
    error,
    currentFrame,
    tileUrl,
  };
}
