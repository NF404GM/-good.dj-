import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { StemType, DeckState, DeckAction, StemModelStatus } from '../types';
import { StemControl } from './StemControl';
import { Waveform } from './Waveform';
import { TrackOverview } from './TrackOverview';
import { AudioEngine } from '../services/audio';

const CUE_COLORS = [
    'var(--color-cue-1)',
    'var(--color-cue-2)',
    'var(--color-cue-3)',
    'var(--color-cue-4)',
    'var(--color-cue-5)',
    'var(--color-cue-6)',
    'var(--color-cue-7)',
    'var(--color-cue-8)',
];

const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 } as const;
const SPRING_BOUNCY = { type: 'spring', stiffness: 380, damping: 24, mass: 0.9 } as const;
const LOOP_SIZES = [1, 2, 4, 8];

export const TechnicalKnob: React.FC<{
    value: number;
    onChange: (v: number) => void;
    label: string;
    color?: string;
    bipolar?: boolean;
    size?: number;
    displayValue?: string;
}> = ({ value, onChange, label, color = 'var(--color-text-primary)', bipolar = false, size = 36, displayValue }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startValue = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startValue.current = value;
        document.body.style.cursor = 'ns-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const range = e.shiftKey ? 1200 : 400;
            const deltaY = startY.current - e.clientY;
            const deltaValue = deltaY / range;
            let nextValue = Math.max(0, Math.min(1, startValue.current + deltaValue));

            if (bipolar && nextValue > 0.45 && nextValue < 0.55) {
                nextValue = 0.5;
            }

            onChange(nextValue);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = '';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [bipolar, isDragging, onChange]);

    const radius = size * 0.4;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75;
    const fillAmount = value * arcLength;
    const strokeDashoffset = circumference - fillAmount;

    const getReadout = () => {
        if (displayValue) return displayValue;
        if (bipolar) {
            if (Math.abs(value - 0.5) < 0.01) return 'OFF';
            if (value < 0.5) return `LP ${(100 - value * 200).toFixed(0)}`;
            return `HP ${((value - 0.5) * 200).toFixed(0)}`;
        }
        return (value * 100).toFixed(0);
    };

    return (
        <div
            className="group relative flex cursor-ns-resize select-none flex-col items-center justify-center gap-[2px] py-1 transition-all duration-150 hover:brightness-125"
            data-dragging={isDragging}
            onMouseDown={handleMouseDown}
            onDoubleClick={() => onChange(bipolar ? 0.5 : 0.75)}
            title="Drag vertically to adjust. Shift for precise. Double-click to reset."
        >
            <div
                className="tactile-knob relative cursor-ew-resize rounded-full transition-transform hover:scale-105 active:scale-100 group-data-[dragging=true]:cursor-grabbing"
                style={{ width: size, height: size }}
            >
                <svg width={size} height={size} viewBox="0 0 40 40" className="rotate-90 drop-shadow-md">
                    <defs>
                        <radialGradient id="knobGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
                        </radialGradient>
                    </defs>
                    <circle
                        cx="20"
                        cy="20"
                        r={16}
                        fill="url(#knobGradient)"
                        stroke="var(--surface-idle)"
                        strokeWidth="4"
                        strokeDasharray={`${arcLength} ${circumference}`}
                        strokeLinecap="round"
                    />
                    <motion.circle
                        cx="20"
                        cy="20"
                        r={16}
                        fill="none"
                        stroke={isDragging ? 'var(--color-white)' : color}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        strokeLinecap="round"
                        style={{
                            opacity: bipolar && Math.abs(value - 0.5) < 0.02 ? 0.2 : 1,
                            filter: isDragging ? 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' : 'none',
                        }}
                    />
                </svg>
                {bipolar && (
                    <div className="pointer-events-none absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-white/20" />
                )}
            </div>
            <div className="font-mono text-[9px] leading-none text-text-mono opacity-80">{getReadout()}</div>
            <span className="mt-[2px] text-center font-sans text-[8px] font-bold uppercase leading-none tracking-widest text-text-primary">
                {label}
            </span>
        </div>
    );
};

const DeckStat: React.FC<{
    label: string;
    value: React.ReactNode;
    accent?: boolean;
    align?: 'left' | 'right';
}> = ({ label, value, accent = false, align = 'left' }) => (
    <div className={`flex min-w-[72px] flex-col justify-center gap-1 rounded-btn-sm border border-white/6 bg-black/45 px-3 py-2 ${align === 'right' ? 'items-end' : 'items-start'}`}>
        <span className="font-mono text-[7px] font-bold uppercase tracking-[0.22em] text-text-data/70">{label}</span>
        <div className={`font-mono text-[15px] font-bold leading-none tracking-tight ${accent ? 'text-signal-nominal' : 'text-text-primary'}`}>
            {value}
        </div>
    </div>
);

const TransportButton: React.FC<{
    label: string;
    meta?: string;
    active?: boolean;
    disabled?: boolean;
    tone?: 'neutral' | 'primary' | 'sync';
    onClick: () => void;
    compact?: boolean;
}> = ({ label, meta, active = false, disabled = false, tone = 'neutral', onClick, compact = false }) => {
    const toneClasses = tone === 'primary'
        ? active
            ? 'border-signal-clipping/50 bg-signal-clipping/18 text-signal-clipping'
            : 'border-white/16 bg-white/6 text-text-primary'
        : tone === 'sync'
            ? active
                ? 'border-signal-sync/45 bg-signal-sync/18 text-signal-sync'
                : 'border-white/10 bg-white/[0.03] text-text-secondary'
            : active
                ? 'border-signal-nominal/35 bg-signal-nominal/14 text-signal-nominal'
                : 'border-white/10 bg-white/[0.03] text-text-primary';

    return (
        <motion.button
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.97, y: 1 }}
            transition={compact ? SPRING_SNAPPY : SPRING_BOUNCY}
            className={[
                'relative flex flex-col justify-center overflow-hidden rounded-btn-lg border transition-all duration-200',
                compact ? 'h-[92px] flex-1 px-4 py-4' : 'h-[92px] flex-[1.7] px-6 py-5',
                toneClasses,
                disabled ? 'cursor-not-allowed opacity-35' : 'shadow-[0_12px_28px_rgba(0,0,0,0.45)]',
            ].join(' ')}
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
        >
            <span className={`font-mono font-black uppercase tracking-[0.28em] ${compact ? 'text-[13px]' : 'text-[24px] italic'}`}>
                {label}
            </span>
            {meta ? (
                <span className={`mt-2 font-mono uppercase tracking-[0.2em] text-white/35 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
                    {meta}
                </span>
            ) : null}
            <div className={`mt-3 h-[2px] rounded-full ${active ? 'bg-current shadow-[0_0_12px_currentColor]' : 'bg-white/8'} ${compact ? 'w-8' : 'w-14'}`} />
        </motion.button>
    );
};

const DeckModeTab: React.FC<{
    active: boolean;
    label: string;
    onClick: () => void;
}> = ({ active, label, onClick }) => (
    <button
        onClick={onClick}
        className={[
            'rounded-btn-sm border px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[0.2em] transition-all',
            active
                ? 'border-signal-nominal/40 bg-signal-nominal/14 text-text-primary'
                : 'border-white/6 bg-transparent text-text-secondary hover:border-white/14 hover:text-text-primary',
        ].join(' ')}
    >
        {label}
    </button>
);

interface DeckProps {
    deckState: DeckState;
    dispatch: (action: DeckAction) => void;
    activeColor: string;
}

export const Deck: React.FC<DeckProps> = ({ deckState, dispatch, activeColor }) => {
    const {
        id,
        track,
        hasAudioBuffer,
        isPlaying,
        isLoading,
        progress,
        pitch,
        pitchRange,
        stems,
        cuePoints,
        waveformData,
        level,
        activeLoop,
        keyLock,
        keyShift,
        isSynced,
        stemMode,
        isSeparatingStems,
    } = deckState;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pitchStartY = useRef(0);
    const pitchStartValue = useRef(0);

    const [isDragOver, setIsDragOver] = useState(false);
    const [isDraggingPitch, setIsDraggingPitch] = useState(false);
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [deleteCandidateIndex, setDeleteCandidateIndex] = useState<number | null>(null);
    const [padMode, setPadMode] = useState<'HOT_CUE' | 'STEMS' | 'LOOP'>('HOT_CUE');
    const [stemModelStatus, setStemModelStatus] = useState<StemModelStatus | null>(null);

    const duration = track?.duration ?? 0;
    const loopRegion = activeLoop ? AudioEngine.getLoopBoundaries(id) : null;
    const canTransport = Boolean(track && hasAudioBuffer);
    const canSeparateStems = false; // AI stem separation coming soon — web uses EQ-based filtering
    const pitchPercent = pitch * pitchRange * 100;
    const bpmDisplay = track ? (track.bpm * (1 + (pitch * pitchRange))).toFixed(1) : '--.-';
    const stemOrder = [StemType.LOW, StemType.BASS, StemType.MID, StemType.HIGH];
    const stemConfig = {
        [StemType.LOW]: { label: stemMode === 'real' ? 'DRUMS' : 'LOW', color: 'var(--stem-drums)' },
        [StemType.BASS]: { label: 'BASS', color: 'var(--stem-bass)' },
        [StemType.MID]: { label: stemMode === 'real' ? 'OTHER' : 'MID', color: 'var(--stem-vocals)' },
        [StemType.HIGH]: { label: stemMode === 'real' ? 'VOCALS' : 'HIGH', color: 'var(--stem-harmonic)' },
    } as const;

    const formatClock = (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return { main: '0:00', sub: '.00' };
        }

        const minutes = Math.floor(seconds / 60);
        const wholeSeconds = Math.floor(seconds % 60);
        const hundredths = Math.floor((seconds % 1) * 100);

        return {
            main: `${minutes}:${wholeSeconds.toString().padStart(2, '0')}`,
            sub: `.${hundredths.toString().padStart(2, '0')}`,
        };
    };

    const currentTime = formatClock(duration * progress);
    const remainingTime = formatClock(duration * (1 - progress));

    const cyclePitchRange = () => {
        const ranges = [0.06, 0.1, 0.16, 1];
        const nextIndex = (ranges.indexOf(pitchRange) + 1) % ranges.length;
        dispatch({ type: 'SET_PITCH_RANGE', deckId: id, value: ranges[nextIndex] });
    };

    const openFilePicker = () => fileInputRef.current?.click();

    const handlePitchMouseDown = (e: React.MouseEvent) => {
        if (!track) return;
        setIsDraggingPitch(true);
        pitchStartY.current = e.clientY;
        pitchStartValue.current = pitch;
        document.body.style.cursor = 'ns-resize';
    };

    useEffect(() => {
        const handlePitchMouseMove = (e: MouseEvent) => {
            if (!isDraggingPitch) return;

            const range = e.shiftKey ? 1600 : 400;
            const deltaY = pitchStartY.current - e.clientY;
            const deltaValue = deltaY / range;
            const nextValue = Math.max(-1, Math.min(1, pitchStartValue.current + deltaValue));
            dispatch({ type: 'SET_PITCH', deckId: id, value: nextValue });
        };

        const handlePitchMouseUp = () => {
            setIsDraggingPitch(false);
            document.body.style.cursor = '';
        };

        if (isDraggingPitch) {
            window.addEventListener('mousemove', handlePitchMouseMove);
            window.addEventListener('mouseup', handlePitchMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handlePitchMouseMove);
            window.removeEventListener('mouseup', handlePitchMouseUp);
        };
    }, [dispatch, id, isDraggingPitch]);

    // Stem model status polling removed — AI stems not available in web mode

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
                dispatch({ type: 'LOAD_FILE', deckId: id, file });
            }
            return;
        }

        const data = e.dataTransfer.getData('application/json');
        if (!data) return;

        try {
            const payload = JSON.parse(data);
            if (payload.track && payload.track.title) {
                dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload.track });
                return;
            }

            if (payload.title) {
                dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            AudioEngine.resume();
            dispatch({ type: 'LOAD_FILE', deckId: id, file });
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    const handlePadDown = (index: number) => {
        setDeleteCandidateIndex(null);
        const timer = setTimeout(() => {
            setDeleteCandidateIndex(index);
            dispatch({ type: 'DELETE_CUE', deckId: id, index });
            setDeleteCandidateIndex(null);
        }, 600);
        setPressTimer(timer);
    };

    const handlePadUp = (index: number) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
        }

        if (deleteCandidateIndex === null) {
            const point = cuePoints[index];
            if (point !== null) {
                dispatch({ type: 'TRIGGER_CUE', deckId: id, index });
            } else {
                dispatch({ type: 'SET_CUE', deckId: id, index });
            }
        }

        setPressTimer(null);
        setDeleteCandidateIndex(null);
    };

    return (
        <div
            className={`relative flex h-full flex-col overflow-hidden rounded-panel border transition-all duration-300 ${
                isDragOver
                    ? 'border-signal-nominal/60 bg-signal-nominal/6 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]'
                    : isPlaying
                        ? 'border-white/10 bg-canvas/50 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                        : 'border-white/6 bg-canvas/35'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
                onChange={handleFileLoad}
            />

            {/* Track Info Header */}
            <div className="relative flex shrink-0 items-center gap-3 border-b border-white/6 px-4 py-3">
                <button
                    onClick={openFilePicker}
                    disabled={isLoading}
                    className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-btn-sm border px-3 py-2 text-left transition-all ${
                        isLoading
                            ? 'cursor-wait border-signal-nominal/30 bg-signal-nominal/10'
                            : track
                                ? 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.06]'
                                : 'border-dashed border-white/20 bg-white/[0.02] hover:border-white/35 hover:bg-white/[0.04]'
                    }`}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-signal-nominal border-t-transparent" />
                            <span className="font-mono text-[10px] text-signal-nominal">ANALYZING...</span>
                        </div>
                    ) : track ? (
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-sans text-[11px] font-bold leading-tight text-text-primary">{track.title}</div>
                            <div className="truncate font-mono text-[9px] text-text-data">{track.artist}</div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] text-text-secondary">CLICK OR DROP FILE</span>
                        </div>
                    )}
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                    {track && (
                        <button
                            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'EJECT_TRACK', deckId: id }); }}
                            className="flex h-8 w-8 items-center justify-center rounded-btn-sm border border-white/10 bg-black/40 text-text-data transition-all hover:border-signal-clipping/40 hover:text-signal-clipping"
                            title="Eject track"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="23 7 13 17 1 17" />
                                <line x1="17" y1="1" x2="17" y2="17" />
                            </svg>
                        </button>
                    )}
                    <div
                        className={`flex h-8 w-8 items-center justify-center rounded-btn-sm border font-mono text-[10px] font-black ${
                            id === 'A'
                                ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-400'
                                : 'border-amber-500/30 bg-amber-500/12 text-amber-400'
                        }`}
                    >
                        {id}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex shrink-0 gap-2 border-b border-white/5 px-3 py-2">
                <DeckStat
                    label="BPM"
                    value={<><span>{bpmDisplay.split('.')[0]}</span><span className="text-[10px] text-text-data">.{bpmDisplay.split('.')[1]}</span></>}
                    accent={isPlaying}
                />
                <DeckStat
                    label="KEY"
                    value={track?.key ?? '--'}
                />
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-btn-sm border border-white/6 bg-black/45 px-2 py-2">
                    <div className="font-mono text-[28px] font-bold leading-none tracking-tighter text-text-primary">
                        <span>{currentTime.main}</span>
                        <span className="text-[14px] text-text-data">{currentTime.sub}</span>
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-text-data/60">
                        -{remainingTime.main}{remainingTime.sub}
                    </div>
                </div>
                <DeckStat
                    label="PITCH"
                    value={`${pitchPercent >= 0 ? '+' : ''}${pitchPercent.toFixed(1)}%`}
                    align="right"
                />
                <DeckStat
                    label="RANGE"
                    value={`${(pitchRange * 100).toFixed(0)}%`}
                    align="right"
                />
            </div>

            {/* Waveform */}
            <div className="relative flex-1 overflow-hidden">
                <Waveform
                    deckId={id}
                    waveformData={waveformData}
                    isPlaying={isPlaying}
                    progress={progress}
                    duration={duration}
                    cuePoints={cuePoints}
                    loopRegion={loopRegion}
                    dispatch={dispatch}
                    activeColor={activeColor}
                />
            </div>

            {/* Pad Mode Tabs */}
            <div className="flex shrink-0 gap-1.5 border-t border-white/5 px-3 py-2">
                {(['HOT_CUE', 'STEMS', 'LOOP'] as const).map((mode) => (
                    <DeckModeTab
                        key={mode}
                        label={mode.replace('_', ' ')}
                        active={padMode === mode}
                        onClick={() => setPadMode(mode)}
                    />
                ))}
            </div>

            {/* Pad Grid */}
            {padMode === 'HOT_CUE' && (
                <div className="grid shrink-0 grid-cols-4 gap-1.5 border-t border-white/5 px-3 pb-2 pt-1">
                    {cuePoints.map((point, index) => (
                        <button
                            key={index}
                            disabled={!canTransport}
                            onMouseDown={(e) => { e.preventDefault(); handlePadDown(index); }}
                            onMouseUp={(e) => { e.preventDefault(); handlePadUp(index); }}
                            onMouseLeave={() => { if (pressTimer) { clearTimeout(pressTimer); setPressTimer(null); } }}
                            style={point !== null ? { borderColor: `${CUE_COLORS[index]}40`, backgroundColor: `${CUE_COLORS[index]}14`, color: CUE_COLORS[index] } : {}}
                            className={`relative flex h-10 items-center justify-center overflow-hidden rounded-btn-sm border transition-all ${
                                point !== null
                                    ? 'shadow-[0_0_8px_rgba(255,255,255,0.05)]'
                                    : 'border-white/8 bg-black/30 text-text-data/50 hover:border-white/16 hover:text-text-data'
                            } disabled:cursor-not-allowed disabled:opacity-35`}
                        >
                            <span className="font-mono text-[10px] font-bold">
                                {point !== null
                                    ? `${Math.floor(point / 60)}:${(Math.floor(point % 60)).toString().padStart(2, '0')}`
                                    : `${index + 1}`}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {padMode === 'STEMS' && (
                <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/5 px-3 pb-3 pt-2">
                    {stemOrder.map((stemType) => {
                        const stem = stems[stemType];
                        const config = stemConfig[stemType];
                        return (
                            <StemControl
                                key={stemType}
                                label={config.label}
                                color={config.color}
                                active={stem.active}
                                volume={stem.volume}
                                param={stem.param}
                                onToggle={() => dispatch({ type: 'TOGGLE_STEM', deckId: id, stem: stemType })}
                                onVolumeChange={(value) => dispatch({ type: 'SET_VOLUME', deckId: id, stem: stemType, value })}
                                onParamChange={(value) => dispatch({ type: 'SET_STEM_PARAM', deckId: id, stem: stemType, value })}
                            />
                        );
                    })}
                </div>
            )}

            {padMode === 'LOOP' && (
                <div className="flex shrink-0 flex-col gap-2 border-t border-white/5 px-3 pb-3 pt-2">
                    <div className="grid grid-cols-4 gap-1.5">
                        {LOOP_SIZES.map((beats) => (
                            <motion.button
                                key={beats}
                                whileTap={{ scale: 0.96, y: 1 }}
                                transition={SPRING_SNAPPY}
                                disabled={!canTransport}
                                onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats: activeLoop === beats ? null : beats })}
                                className={`flex h-10 items-center justify-center rounded-btn-sm border font-mono text-[11px] font-bold tracking-wider transition-all ${
                                    activeLoop === beats
                                        ? 'border-signal-nominal/50 bg-signal-nominal/15 text-signal-nominal shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                        : 'border-white/10 bg-black/30 text-text-data hover:border-white/20 hover:text-text-primary'
                                } disabled:cursor-not-allowed disabled:opacity-35`}
                            >
                                {beats}
                            </motion.button>
                        ))}
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            disabled={!activeLoop}
                            onClick={() => dispatch({ type: 'LOOP_HALVE', deckId: id })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-2 font-mono text-[10px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ÷2
                        </button>
                        <button
                            disabled={!activeLoop}
                            onClick={() => dispatch({ type: 'LOOP_DOUBLE', deckId: id })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-2 font-mono text-[10px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ×2
                        </button>
                        <button
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: 'BEAT_JUMP', deckId: id, beats: -4 })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-2 font-mono text-[10px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ◀◀
                        </button>
                        <button
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: 'BEAT_JUMP', deckId: id, beats: 4 })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-2 font-mono text-[10px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ▶▶
                        </button>
                    </div>
                </div>
            )}

            {/* Transport Controls */}
            <div className="flex shrink-0 gap-2 border-t border-white/5 px-3 pb-3 pt-2">
                <TransportButton
                    label="CUE"
                    active={false}
                    disabled={!canTransport}
                    onClick={() => dispatch({ type: 'CUE_MASTER', deckId: id })}
                    compact
                />
                <TransportButton
                    label={isPlaying ? 'PAUSE' : 'PLAY'}
                    meta={isPlaying ? 'STOP TO CUE' : 'PRESS TO START'}
                    active={isPlaying}
                    disabled={!canTransport}
                    tone="primary"
                    onClick={() => dispatch({ type: 'TOGGLE_PLAY', deckId: id })}
                />
                <TransportButton
                    label="SYNC"
                    active={isSynced}
                    disabled={!canTransport}
                    tone="sync"
                    onClick={() => dispatch({ type: 'SYNC_DECK', deckId: id })}
                    compact
                />
            </div>

            {/* Pitch Fader + EQ Knobs + Key Controls */}
            <div className="flex shrink-0 gap-3 border-t border-white/5 px-3 pb-3 pt-2">
                {/* Pitch Fader */}
                <div className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-text-data/60">PITCH</span>
                    <div
                        className="relative flex h-28 w-5 cursor-ns-resize items-center justify-center"
                        onMouseDown={handlePitchMouseDown}
                        title="Drag to adjust pitch. Shift for fine control."
                    >
                        {/* Track */}
                        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-white/10" />
                        <div
                            className="absolute left-1/2 h-[2px] w-[12px] -translate-x-1/2 bg-white/30"
                            style={{ top: '50%', transform: 'translate(-50%, -50%)' }}
                        />
                        {/* Handle */}
                        <div
                            className="absolute left-1/2 h-5 w-4 -translate-x-1/2 rounded-sm border border-white/20 bg-surface-idle shadow-md"
                            style={{ top: `${50 - pitch * 40}%`, transform: 'translate(-50%, -50%)' }}
                        />
                    </div>
                    <button
                        onClick={cyclePitchRange}
                        className="rounded-btn-sm border border-white/10 bg-black/30 px-2 py-1 font-mono text-[7px] text-text-data transition-all hover:border-white/20 hover:text-text-primary"
                    >
                        ±{(pitchRange * 100).toFixed(0)}%
                    </button>
                </div>

                {/* EQ + FX Controls */}
                <div className="flex flex-1 flex-col gap-2">
                    <div className="flex justify-around">
                        <TechnicalKnob
                            value={deckState.eq.high}
                            onChange={(v) => dispatch({ type: 'SET_EQ', deckId: id, band: 'high', value: v })}
                            label="HI"
                            color={activeColor}
                        />
                        <TechnicalKnob
                            value={deckState.eq.mid}
                            onChange={(v) => dispatch({ type: 'SET_EQ', deckId: id, band: 'mid', value: v })}
                            label="MID"
                            color={activeColor}
                        />
                        <TechnicalKnob
                            value={deckState.eq.low}
                            onChange={(v) => dispatch({ type: 'SET_EQ', deckId: id, band: 'low', value: v })}
                            label="LOW"
                            color={activeColor}
                        />
                        <TechnicalKnob
                            value={deckState.eq.trim}
                            onChange={(v) => dispatch({ type: 'SET_EQ', deckId: id, band: 'trim', value: v })}
                            label="TRIM"
                        />
                        <TechnicalKnob
                            value={deckState.color}
                            onChange={(v) => dispatch({ type: 'SET_COLOR_FILTER', deckId: id, value: v })}
                            label="COLOR"
                            bipolar
                        />
                    </div>

                    {/* Key Lock + Shift */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => dispatch({ type: 'TOGGLE_KEY_LOCK', deckId: id })}
                            className={`flex items-center gap-1.5 rounded-btn-sm border px-3 py-1.5 font-mono text-[9px] font-bold transition-all ${
                                keyLock
                                    ? 'border-signal-nominal/40 bg-signal-nominal/12 text-signal-nominal'
                                    : 'border-white/10 bg-black/30 text-text-data hover:border-white/20'
                            }`}
                        >
                            KEY LOCK
                        </button>
                        <div className="flex flex-1 items-center gap-1">
                            <button
                                onClick={() => dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.max(-12, keyShift - 1) })}
                                disabled={!keyLock}
                                className="flex h-7 w-7 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 font-mono text-[10px] text-text-data transition-all hover:border-white/20 disabled:opacity-30"
                            >
                                −
                            </button>
                            <div className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/8 bg-black/40 py-1 font-mono text-[10px] text-text-primary">
                                {keyShift >= 0 ? '+' : ''}{keyShift}
                            </div>
                            <button
                                onClick={() => dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.min(12, keyShift + 1) })}
                                disabled={!keyLock}
                                className="flex h-7 w-7 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 font-mono text-[10px] text-text-data transition-all hover:border-white/20 disabled:opacity-30"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* Track Overview */}
                <div className="flex flex-col gap-1">
                    <TrackOverview
                        deckId={id}
                        waveformData={waveformData}
                        progress={progress}
                        duration={duration}
                        cuePoints={cuePoints}
                        dispatch={dispatch}
                        activeColor={activeColor}
                    />
                    <div className="flex gap-1">
                        <button
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: 'BEAT_JUMP', deckId: id, beats: -8 })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-1 font-mono text-[9px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ◀◀
                        </button>
                        <button
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: 'BEAT_JUMP', deckId: id, beats: 8 })}
                            className="flex flex-1 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 py-1 font-mono text-[9px] text-text-data transition-all hover:border-white/20 hover:text-text-primary disabled:opacity-35"
                        >
                            ▶▶
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
