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

    const renderCuePanel = () => (
        <div className="grid h-full grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                const cue = cuePoints[index];
                const isSet = cue !== null;
                const color = CUE_COLORS[index];
                const cueTime = cue !== null ? formatClock(duration * cue).main : 'SET';

                return (
                    <motion.button
                        key={index}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={[
                            'relative flex min-h-[88px] flex-col justify-between rounded-btn-lg border p-3 text-left transition-all',
                            isSet
                                ? 'border-white/12 bg-white/[0.03] text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.28)]'
                                : 'border-white/6 bg-black/25 text-text-secondary hover:border-white/12 hover:text-text-primary',
                        ].join(' ')}
                        onMouseDown={() => handlePadDown(index)}
                        onMouseUp={() => handlePadUp(index)}
                        onMouseLeave={() => pressTimer && clearTimeout(pressTimer)}
                        aria-label={`Hot Cue ${index + 1}${isSet ? ` at ${cueTime}` : ' empty'}`}
                    >
                        <div
                            className="absolute inset-x-0 top-0 h-[3px] rounded-t-btn-lg"
                            style={{ backgroundColor: isSet ? color : 'rgba(255,255,255,0.06)' }}
                        />
                        <span className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="space-y-1">
                            <div className={`font-mono text-[12px] font-bold tracking-[0.16em] ${isSet ? 'text-text-primary' : 'text-text-secondary'}`}>
                                {isSet ? cueTime : 'EMPTY'}
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
                                {isSet ? 'Tap to jump' : 'Tap to set'}
                            </div>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );

    const renderStemPanel = () => {
        const statusMessage = stemMode === 'real'
            ? 'Real drums, bass, other, and vocals are loaded.'
            : 'AI stem separation coming soon. Using EQ-based frequency filtering.';

        const showRealStemStatus = stemMode !== 'real';

        return (
            <div className="flex h-full flex-col gap-3">
                <div className="surface-panel rounded-panel flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                        <div className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-text-primary">
                            {stemMode === 'real' ? 'Real Stem Playback' : 'Stem Controls'}
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                            {statusMessage}
                        </div>
                    </div>
                    <button
                        onClick={() => dispatch({ type: 'SEPARATE_STEMS', deckId: id })}
                        disabled={!canSeparateStems || isSeparatingStems || stemMode === 'real'}
                        className={[
                            'rounded-btn-sm border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.18em] transition-all',
                            !canSeparateStems || isSeparatingStems || stemMode === 'real'
                                ? 'cursor-not-allowed border-white/8 bg-white/[0.03] text-white/28'
                                : 'border-signal-nominal/28 bg-signal-nominal/16 text-signal-nominal hover:bg-signal-nominal/22',
                        ].join(' ')}
                    >
                        {stemMode === 'real' ? 'Loaded' : 'Coming Soon'}
                    </button>
                </div>

                {showRealStemStatus ? (
                    <div className="grid gap-3 xl:grid-cols-3">
                        <div className="surface-panel rounded-panel px-4 py-3">
                            <div className="font-mono text-[8px] font-black uppercase tracking-[0.2em] text-text-data">
                                Mode
                            </div>
                            <div className="mt-2 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-text-primary">
                                Frequency contour mix
                            </div>
                            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                The controls below shape broad frequency bands. AI stem separation is coming soon.
                            </div>
                        </div>

                        <div className="surface-panel rounded-panel px-4 py-3">
                            <div className="font-mono text-[8px] font-black uppercase tracking-[0.2em] text-text-data">
                                Model status
                            </div>
                            <div className="mt-2 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-text-primary">
                                Coming Soon
                            </div>
                            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                {statusMessage}
                            </div>
                        </div>

                        <div className="surface-panel rounded-panel px-4 py-3">
                            <div className="font-mono text-[8px] font-black uppercase tracking-[0.2em] text-text-data">
                                Next step
                            </div>
                            <div className="mt-2 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-text-primary">
                                Open settings
                            </div>
                            <button
                                onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                                className="mt-3 rounded-btn-sm border border-white/10 bg-black/35 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-primary transition-all hover:border-white/18 hover:bg-white/[0.03]"
                            >
                                Stem model settings
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="grid flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
                    {stemOrder.map((type) => {
                        const config = stemConfig[type];
                        const stemState = stems[type];
                        return (
                            <StemControl
                                key={type}
                                type={type}
                                label={config.label}
                                color={config.color}
                                volume={stemState.volume}
                                param={stemState.param}
                                isActive={stemState.active}
                                hideValue
                                onToggle={() => dispatch({ type: 'TOGGLE_STEM', deckId: id, stem: type })}
                                onVolumeChange={(value) => dispatch({ type: 'SET_VOLUME', deckId: id, stem: type, value })}
                                onParamChange={(value) => dispatch({ type: 'SET_STEM_PARAM', deckId: id, stem: type, value })}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderLoopPanel = () => (
        <div className="flex h-full flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
                {LOOP_SIZES.map((beats) => {
                    const selected = activeLoop === beats;
                    return (
                        <motion.button
                            key={beats}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className={[
                                'rounded-btn-lg border px-4 py-4 text-left transition-all',
                                selected
                                    ? 'border-signal-nominal/35 bg-signal-nominal/16 text-text-primary'
                                    : 'border-white/6 bg-black/25 text-text-secondary hover:border-white/12 hover:text-text-primary',
                            ].join(' ')}
                            onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats })}
                        >
                            <div className="font-mono text-[22px] font-black italic leading-none text-text-primary">{beats}</div>
                            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-text-secondary">Beats</div>
                        </motion.button>
                    );
                })}
            </div>

            <div className="grid grid-cols-3 gap-3">
                <button
                    className="rounded-btn-sm border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                    onClick={() => dispatch({ type: 'LOOP_HALVE', deckId: id })}
                    disabled={!canTransport}
                >
                    Halve
                </button>
                <button
                    className="rounded-btn-sm border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                    onClick={() => dispatch({ type: 'LOOP_DOUBLE', deckId: id })}
                    disabled={!canTransport}
                >
                    Double
                </button>
                <button
                    className="rounded-btn-sm border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                    onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats: null })}
                    disabled={!canTransport}
                >
                    Exit
                </button>
            </div>

            <div className="surface-panel rounded-panel flex items-center justify-between px-4 py-3">
                <div>
                    <div className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-primary">
                        {activeLoop ? `${activeLoop} Beat Loop Armed` : 'Loop Idle'}
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                        {activeLoop ? 'Loop region follows the current beat grid.' : 'Choose a size to punch in a loop.'}
                    </div>
                </div>
                <div className="h-8 w-8 rounded-full border border-white/8 bg-black/35 p-1">
                    <div className={`h-full w-full rounded-full ${activeLoop ? 'bg-signal-nominal shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/6'}`} />
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="surface-panel relative flex h-full flex-col overflow-hidden rounded-panel"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileLoad}
                className="hidden"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            />

            <div className="border-b border-white/6 bg-black/25 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div
                            className="flex min-w-[56px] flex-col rounded-btn-sm border border-white/8 bg-black/45 px-3 py-2"
                            style={{ boxShadow: `inset 2px 0 0 ${activeColor}` }}
                        >
                            <span className="font-mono text-[7px] font-black uppercase tracking-[0.24em] text-text-secondary">Deck</span>
                            <span className="mt-1 font-mono text-[18px] font-black italic leading-none text-text-primary">{id}</span>
                        </div>

                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-sans text-[18px] font-bold uppercase tracking-tight text-text-primary">
                                    {track?.title || 'Load a track'}
                                </span>
                                {isLoading ? (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary">
                                        Loading
                                    </span>
                                ) : null}
                            </div>
                            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-secondary">
                                {track?.artist || 'Drop audio or use the library to arm this deck.'}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                    onClick={() => dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.max(-12, keyShift - 1) })}
                                    className="rounded-btn-sm border border-white/8 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                                    disabled={!track}
                                >
                                    Key -
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.min(12, keyShift + 1) })}
                                    className="rounded-btn-sm border border-white/8 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                                    disabled={!track}
                                >
                                    Key +
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'TOGGLE_KEY_LOCK', deckId: id })}
                                    className={[
                                        'rounded-btn-sm border px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] transition-all',
                                        keyLock
                                            ? 'border-signal-nominal/28 bg-signal-nominal/16 text-signal-nominal'
                                            : 'border-white/8 text-text-secondary hover:border-white/14 hover:text-text-primary',
                                    ].join(' ')}
                                    disabled={!track}
                                >
                                    {keyLock ? 'Lock On' : 'Lock Off'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <DeckStat label="Remain" value={<span>{remainingTime.main}<span className="text-[10px] text-text-secondary">{remainingTime.sub}</span></span>} />
                        <DeckStat label="Key" value={track ? `${track.key}${keyShift !== 0 ? ` ${keyShift > 0 ? '+' : ''}${keyShift}` : ''}` : '--'} accent={keyLock} />
                        <DeckStat label="Pitch" value={`${pitchPercent >= 0 ? '+' : ''}${pitchPercent.toFixed(1)}%`} accent={Math.abs(pitchPercent) > 0.01} />
                        <DeckStat label="BPM" value={bpmDisplay} accent={isSynced} align="right" />
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => dispatch({ type: 'DOUBLE_DECK', deckId: id })}
                                className="rounded-btn-sm border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-white/14 hover:text-text-primary"
                                disabled={!track}
                            >
                                Clone
                            </button>
                            <button
                                onClick={() => dispatch({ type: 'EJECT_TRACK', deckId: id })}
                                className="rounded-btn-sm border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-signal-clipping/26 hover:text-signal-clipping"
                                disabled={!track}
                            >
                                Eject
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <TrackOverview
                data={waveformData || []}
                progress={progress}
                color={activeColor}
                loopRegion={loopRegion}
                cuePoints={cuePoints}
                duration={duration}
                onSeek={(value) => {
                    if (!track) return;
                    dispatch({ type: 'SEEK_POSITION', deckId: id, value });
                }}
            />

            <div className={`flex min-h-0 flex-1 ${id === 'B' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="relative border-b border-white/6 bg-black/45">
                        <div className="h-[144px] min-h-[144px]">
                            <Waveform
                                key={`${id}-${track?.id || 'none'}`}
                                isPlaying={isPlaying}
                                progress={progress}
                                color={activeColor}
                                data={waveformData}
                                cuePoints={cuePoints}
                                loopRegion={loopRegion}
                            />
                        </div>

                        {!track ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <button
                                    onClick={openFilePicker}
                                    className={[
                                        'rounded-btn-lg border border-dashed px-5 py-3 font-mono text-[9px] font-black uppercase tracking-[0.2em] transition-all',
                                        isDragOver
                                            ? 'border-signal-nominal/40 bg-signal-nominal/14 text-signal-nominal'
                                            : 'border-white/10 bg-black/55 text-text-secondary hover:border-white/18 hover:text-text-primary',
                                    ].join(' ')}
                                >
                                    {isDragOver ? 'Drop to load' : 'Choose file or drop audio'}
                                </button>
                            </div>
                        ) : null}

                        {track && stemMode === 'real' ? (
                            <div className="absolute right-3 top-3 rounded-full border border-signal-nominal/25 bg-signal-nominal/12 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-signal-nominal">
                                Real stems loaded
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-black/25 px-3 py-2">
                        <div className="flex items-center gap-2">
                            <DeckModeTab active={padMode === 'HOT_CUE'} label="Cues" onClick={() => setPadMode('HOT_CUE')} />
                            <DeckModeTab active={padMode === 'STEMS'} label="Stems" onClick={() => setPadMode('STEMS')} />
                            <DeckModeTab active={padMode === 'LOOP'} label="Loop" onClick={() => setPadMode('LOOP')} />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-20 rounded-full border border-white/6 bg-black/35 p-[3px]">
                                <div className="h-full overflow-hidden rounded-full">
                                    <div className="h-full bg-gradient-to-r from-signal-nominal/30 via-signal-nominal to-signal-clipping shadow-[0_0_14px_rgba(16,185,129,0.28)]" style={{ width: `${Math.min(level, 1) * 100}%` }} />
                                </div>
                            </div>
                            <span className="font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary">
                                {padMode === 'HOT_CUE'
                                    ? 'Performance cues'
                                    : padMode === 'STEMS'
                                        ? (stemMode === 'real' ? 'Neural stem mix' : 'Frequency contour mix')
                                        : activeLoop
                                            ? `${activeLoop} beat loop`
                                            : 'Loop controls'}
                            </span>
                        </div>
                    </div>

                    <div className="min-h-[220px] flex-1 overflow-y-auto p-3">
                        {padMode === 'HOT_CUE' ? renderCuePanel() : null}
                        {padMode === 'STEMS' ? renderStemPanel() : null}
                        {padMode === 'LOOP' ? renderLoopPanel() : null}
                    </div>

                    <div className="border-t border-white/6 bg-black/45 px-3 py-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-mono text-[8px] font-black uppercase tracking-[0.22em] text-text-secondary">
                                {track ? (isPlaying ? `Playing ${currentTime.main}${currentTime.sub}` : `Ready at ${currentTime.main}${currentTime.sub}`) : 'Deck idle'}
                            </div>
                            <div className={`rounded-full px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] ${isSynced ? 'border border-signal-sync/30 bg-signal-sync/14 text-signal-sync' : 'border border-white/8 bg-white/[0.03] text-text-secondary'}`}>
                                {isSynced ? 'Synced' : 'Free'}
                            </div>
                        </div>

                        <div className="flex items-stretch gap-3">
                            <TransportButton
                                label="CUE"
                                meta={canTransport ? 'Return' : 'Set deck'}
                                disabled={!canTransport}
                                onClick={() => dispatch({ type: 'CUE_MASTER', deckId: id })}
                                compact
                            />
                            <TransportButton
                                label={isPlaying ? 'PAUSE' : 'PLAY'}
                                meta={isLoading ? 'Loading audio' : canTransport ? (isPlaying ? 'Transport armed' : 'Ready to fire') : 'Load a track'}
                                active={isPlaying}
                                disabled={!canTransport}
                                tone="primary"
                                onClick={() => dispatch({ type: 'TOGGLE_PLAY', deckId: id })}
                            />
                            <TransportButton
                                label="SYNC"
                                meta={isSynced ? 'On grid' : 'Match tempo'}
                                active={isSynced}
                                disabled={!canTransport}
                                tone="sync"
                                onClick={() => dispatch({ type: 'SYNC_DECK', deckId: id })}
                                compact
                            />
                        </div>
                    </div>
                </div>

                <div className={`w-[72px] shrink-0 border-white/6 bg-black/30 ${id === 'B' ? 'border-r' : 'border-l'}`}>
                    <div className="flex h-full flex-col">
                        <div className="border-b border-white/6 px-3 py-3 text-center">
                            <div className="font-mono text-[7px] font-black uppercase tracking-[0.2em] text-text-data">Pitch</div>
                            <div className={`mt-2 font-mono text-[14px] font-bold tracking-tight ${Math.abs(pitchPercent) > 0.01 ? 'text-signal-nominal' : 'text-text-primary'}`}>
                                {pitchPercent >= 0 ? '+' : ''}{pitchPercent.toFixed(1)}%
                            </div>
                        </div>

                        <button
                            onClick={cyclePitchRange}
                            className="border-b border-white/6 px-2 py-2 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:bg-white/[0.03] hover:text-text-primary"
                            title="Toggle pitch range"
                        >
                            Range {Math.round(pitchRange * 100)}%
                        </button>

                        <div className="relative flex-1 px-4 py-4">
                            <div className="absolute inset-y-4 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-white/8" />
                            <div className="absolute inset-y-4 left-1/2 w-10 -translate-x-1/2">
                                <div className="flex h-full flex-col justify-between">
                                    {[...Array(11)].map((_, index) => (
                                        <div key={index} className={`h-[1px] ${index === 5 ? 'w-10 bg-white/16' : 'w-5 bg-white/8'} ${id === 'B' ? '' : 'self-end'}`} />
                                    ))}
                                </div>
                            </div>
                            <div
                                className={`tactile-fader-cap absolute left-2 right-2 z-10 ${!track ? 'opacity-45' : ''}`}
                                style={{
                                    top: `calc(1rem + ${0.5 - pitch * 0.5} * (100% - 2rem))`,
                                    transform: 'translateY(-50%)',
                                }}
                            />
                            <div
                                onMouseDown={handlePitchMouseDown}
                                onDoubleClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: 0 })}
                                className={`absolute inset-0 ${track ? 'cursor-ns-resize' : 'pointer-events-none'}`}
                            />
                        </div>

                        <div className="grid grid-cols-2 border-t border-white/6">
                            <button
                                className="border-r border-white/6 px-2 py-3 font-mono text-[10px] font-black text-text-secondary transition-all hover:bg-white/[0.03] hover:text-text-primary disabled:opacity-30"
                                disabled={!track}
                                onClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: Math.max(-1, pitch - 0.005) })}
                            >
                                -
                            </button>
                            <button
                                className="px-2 py-3 font-mono text-[10px] font-black text-text-secondary transition-all hover:bg-white/[0.03] hover:text-text-primary disabled:opacity-30"
                                disabled={!track}
                                onClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: Math.min(1, pitch + 0.005) })}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deck;
