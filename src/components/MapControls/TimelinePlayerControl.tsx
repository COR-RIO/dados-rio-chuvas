import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, FastForward } from 'lucide-react';

type PlaybackMode = 'rain' | 'occurrences' | 'both';

interface TimelinePlayerControlProps {
    timeline: string[];
    playingIndex: number;
    onIndexChange: (index: number) => void;
    isPlaying: boolean;
    onPlayPause: (playing: boolean) => void;
    playbackMode: PlaybackMode;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    playbackSpeed: number;
    onPlaybackSpeedChange: (speed: number) => void;
}

export const TimelinePlayerControl: React.FC<TimelinePlayerControlProps> = ({
    timeline,
    playingIndex,
    onIndexChange,
    isPlaying,
    onPlayPause,
    playbackMode,
    onPlaybackModeChange,
    playbackSpeed,
    onPlaybackSpeedChange,
}) => {
    if (timeline.length === 0) return null;

    const currentTs = timeline[playingIndex];
    const dateFormatted = currentTs
        ? new Date(currentTs).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
        : '';

    const handleNext = () => onIndexChange(Math.min(timeline.length - 1, playingIndex + 1));
    const handlePrev = () => onIndexChange(Math.max(0, playingIndex - 1));
    const handleStop = () => { onPlayPause(false); onIndexChange(0); };
    const toggleSpeed = () =>
        onPlaybackSpeedChange(playbackSpeed === 1000 ? 500 : playbackSpeed === 500 ? 200 : 1000);
    const speedMultiplier = 1000 / playbackSpeed;

    return (
        <div
            id="timeline-player"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2500] bg-white/97 backdrop-blur-md rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.22)] border border-gray-200 p-3 sm:p-4 w-[340px] sm:w-[420px] max-w-[95vw]"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">
                        LINHA DO TEMPO
                    </p>
                    <p className="text-[13px] font-bold text-blue-700 bg-blue-100/50 border border-blue-200/50 px-2.5 py-1 rounded-lg inline-block truncate max-w-full">
                        {dateFormatted}
                    </p>
                </div>

                {/* Mode Tabs */}
                <div className="flex items-center rounded-xl border border-gray-200/60 bg-gray-50/50 p-1 text-[10px] font-bold text-gray-600 shrink-0">
                    {(['rain', 'occurrences', 'both'] as PlaybackMode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => onPlaybackModeChange(m)}
                            className={`px-3 py-1.5 rounded-lg transition-all ${playbackMode === m ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-200/70'
                                }`}
                        >
                            {m === 'rain' ? 'Chuvas' : m === 'occurrences' ? 'Ocorrências' : 'Ambos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Progress Slider */}
            <div className="mb-5 px-1">
                <input
                    type="range"
                    min="0"
                    max={timeline.length - 1}
                    value={playingIndex}
                    onChange={(e) => onIndexChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[11px] font-bold text-gray-400 mt-2 px-1">
                    <span>Início</span>
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{playingIndex + 1} / {timeline.length}</span>
                    <span>Fim</span>
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                <button
                    onClick={handleStop}
                    title="Parar"
                    className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 transition-all hover:text-gray-900"
                >
                    <Square className="w-4 h-4" fill="currentColor" />
                </button>

                <button
                    onClick={handlePrev}
                    disabled={playingIndex === 0}
                    className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all hover:text-gray-900"
                >
                    <SkipBack className="w-6 h-6" />
                </button>

                <button
                    onClick={() => onPlayPause(!isPlaying)}
                    title={isPlaying ? 'Pausar' : 'Reproduzir'}
                    className="w-16 h-16 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-[0_8px_20px_rgba(37,99,235,0.4)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                >
                    {isPlaying ? (
                        <Pause className="w-7 h-7" fill="currentColor" />
                    ) : (
                        <Play className="w-7 h-7 ml-1" fill="currentColor" />
                    )}
                </button>

                <button
                    onClick={handleNext}
                    disabled={playingIndex === timeline.length - 1}
                    className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all hover:text-gray-900"
                >
                    <SkipForward className="w-6 h-6" />
                </button>

                <button
                    onClick={toggleSpeed}
                    title={`Velocidade: ${speedMultiplier}x`}
                    className="p-2.5 rounded-full text-gray-700 bg-gray-100/50 hover:bg-gray-200/70 transition-all text-xs font-black min-w-[50px] justify-center"
                >
                    {speedMultiplier}x
                </button>
            </div>
        </div>
    );
};
