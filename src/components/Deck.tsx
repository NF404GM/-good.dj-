import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DeckState, DeckAction, EffectType } from '../types';
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

const LOOP_SIZES = [1, 2, 4, 8, 16, 32];

/* ═══════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════ */

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
            if (bipolar && nextValue > 0.45 && nextValue < 0.55) nextValue = 0.5;
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
                className="tactile-knob relative rounded-full transition-transform hover:scale-105 active:scale-100"
                style={{ width: size, height: size }}
            >
                <svg width={size} height={size} viewBox="0 0 40 40" className="rotate-90 drop-shadow-md">
                    <defs>
                        <radialGradient id="knobGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
                        </radialGradient>
                    </defs>
                    <circle cx="20" cy="20" r={16} fill="url(#knobGradient)" stroke="var(--surface-idle)" strokeWidth="4" strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" />
                    <motion.circle
                        cx="20" cy="20" r={16} fill="none"
                        stroke={isDragging ? 'var(--color-white)' : color}
                        strokeWidth="4" strokeDasharray={circumference}
                        animate={{ strokeDashoffset }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        strokeLinecap="round"
                        style={{
                            opacity: bipolar && Math.abs(value - 0.5) < 0.02 ? 0.2 : 1,
                            filter: isDragging ? 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' : 'none',
                        }}
                    />
                </svg>
            </div>
            <div className="font-mono text-[9px] leading-none text-text-mono opacity-80">{getReadout()}</div>
            <span className="mt-[2px] text-center font-sans text-[8px] font-bold uppercase leading-none tracking-widest text-text-primary">
                {label}
            </span>
        </div>
    );
};

/* ═══════════════════════════════════════════
   PERFORMANCE TOOLS — Beat Jump Button
   ═══════════════════════════════════════════ */
const JumpButton: React.FC<{
    label: string;
    beats: number;
    direction: 'back' | 'forward';
    disabled: boolean;
    dispatch: (action: DeckAction) => void;
    deckId: string;
}> = ({ label, beats, direction, disabled, dispatch, deckId }) => (
    <button
        className={[
            'flex flex-1 flex-col items-center justify-center rounded-[3px] border py-1 transition-all duration-150',
            disabled
                ? 'cursor-not-allowed border-white/[0.05] text-text-secondary/30'
                : 'border-white/[0.08] bg-black/20 text-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-text-primary active:scale-95',
        ].join(' ')}
        disabled={disabled}
        onClick={() =>
            dispatch({
                type: direction === 'back' ? 'BEAT_JUMP_BACK' : 'BEAT_JUMP_FORWARD',
                deckId,
                beats,
            } as DeckAction)
        }
        title={`${direction === 'back' ? '←' : '→'} ${beats} beat${beats !== 1 ? 's' : ''}`}
    >
        <span className="font-mono text-[11px] font-bold leading-none">{label}</span>
    </button>
);

/* ═══════════════════════════════════════════
   PERFORMANCE TOOLS — FX Toggle Button
   ═══════════════════════════════════════════ */
const FxButton: React.FC<{
    label: string;
    effectType: EffectType;
    isActive: boolean;
    disabled: boolean;
    color: string;
    dispatch: (action: DeckAction) => void;
    deckId: string;
}> = ({ label, effectType, isActive, disabled, color, dispatch, deckId }) => (
    <button
        className={[
            'flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[3px] border py-1 transition-all duration-150',
            disabled
                ? 'cursor-not-allowed border-white/[0.05] text-text-secondary/30'
                : isActive
                    ? 'border-white/20 bg-white/[0.07] text-text-primary'
                    : 'border-white/[0.08] bg-black/20 text-text-secondary hover:border-white/15 hover:bg-white/[0.04] hover:text-text-primary',
        ].join(' ')}
        disabled={disabled}
        onClick={() =>
            dispatch({
                type: 'TOGGLE_EFFECT',
                deckId,
                effectType,
            } as DeckAction)
        }
        title={`Toggle ${label}`}
    >
        {/* LED dot */}
        <div
            className="h-[5px] w-[5px] rounded-full transition-all duration-150"
            style={{
                backgroundColor: isActive && !disabled ? color : 'rgba(255,255,255,0.12)',
                boxShadow: isActive && !disabled ? `0 0 5px ${color}80` : 'none',
            }}
        />
        <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-wider">{label}</span>
    </button>
);

/* ═══════════════════════════════════════════
   DECK COMPONENT
   Layout:
   1. Header: DECK badge | title | artist | remaining | BPM | Key | Pitch
   2. Waveform (100px)
   3. Track overview mini bar
   4. Transport row: [Play][CUE] | CUES LOOP | [SYNC]
   5. Performance area (flex-1):
      LEFT  — Hot Cue Pads (3×3)
      CENTER — Beat Jump (2×2 grid)
      RIGHT — Loop + FX controls
   ═══════════════════════════════════════════ */

interface DeckProps {
    deckState: DeckState;
    dispatch: (action: DeckAction) => void;
    activeColor: string;
}

export const Deck: React.FC<DeckProps> = ({ deckState, dispatch, activeColor }) => {
    const {
        id, track, hasAudioBuffer, isPlaying, progress,
        pitch, pitchRange, cuePoints, waveformData, level,
        activeLoop, keyLock, keyShift, isSynced,
        fx,
    } = deckState;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pitchStartY = useRef(0);
    const pitchStartValue = useRef(0);

    const [isDragOver, setIsDragOver] = useState(false);
    const [isDraggingPitch, setIsDraggingPitch] = useState(false);
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [deleteCandidateIndex, setDeleteCandidateIndex] = useState<number | null>(null);

    const duration = track?.duration ?? 0;
    const loopRegion = activeLoop ? AudioEngine.getLoopBoundaries(id) : null;
    const canTransport = Boolean(track && hasAudioBuffer);
    const pitchPercent = pitch * pitchRange * 100;
    const bpmDisplay = track ? (track.bpm * (1 + (pitch * pitchRange))).toFixed(1) : '--.-';

    // Resolve active FX states — fx map may be undefined in older state shapes
    const isReverbOn = fx?.get?.(EffectType.REVERB)?.enabled ?? false;
    const isDelayOn  = fx?.get?.(EffectType.DELAY)?.enabled ?? false;
    const isFilterOn = fx?.get?.(EffectType.FILTER)?.enabled ?? false;

    const formatClock = (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds <= 0) return { main: '0:00', sub: '.00' };
        const minutes = Math.floor(seconds / 60);
        const wholeSeconds = Math.floor(seconds % 60);
        const hundredths = Math.floor((seconds % 1) * 100);
        return {
            main: `${minutes}:${wholeSeconds.toString().padStart(2, '0')}`,
            sub: `.${hundredths.toString().padStart(2, '0')}`,
        };
    };

    const remainingTime = formatClock(duration * (1 - progress));
    const openFilePicker = () => fileInputRef.current?.click();

    // Pitch drag
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

    // Drag & drop
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
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
            if (payload.track?.title) { dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload.track }); return; }
            if (payload.title) { dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload }); }
        } catch (error) { console.error(error); }
    };

    const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { AudioEngine.resume(); dispatch({ type: 'LOAD_FILE', deckId: id, file }); }
        if (e.target) e.target.value = '';
    };

    // Cue pad handlers
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
        if (pressTimer) clearTimeout(pressTimer);
        if (deleteCandidateIndex === null) {
            const point = cuePoints[index];
            if (point !== null) dispatch({ type: 'TRIGGER_CUE', deckId: id, index });
            else dispatch({ type: 'SET_CUE', deckId: id, index });
        }
        setPressTimer(null);
        setDeleteCandidateIndex(null);
    };

    /* ═══════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════ */
    return (
        <div
            className="surface-panel relative flex h-full flex-col overflow-hidden rounded-panel"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input ref={fileInputRef} type="file" onChange={handleFileLoad} className="hidden" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" />

            {/* ──── ROW 1: HEADER ──── */}
            <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-white/6 bg-black/25 px-4">
                <div className="shrink-0 rounded-[3px] border border-white/12 bg-black/40 px-3 py-1.5">
                    <span className="font-sans text-[13px] font-extrabold uppercase tracking-[0.08em] text-text-primary">
                        Deck {id}
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="truncate font-sans text-[14px] font-bold text-text-primary">
                        {track?.title || 'No track loaded'}
                    </div>
                    <div className="font-sans text-[10px] text-text-secondary">
                        {track ? 'Inter Medium' : ''}
                    </div>
                </div>

                <div className="min-w-0">
                    <div className="font-sans text-[14px] text-text-primary">
                        {track?.artist || ''}
                    </div>
                    <div className="font-sans text-[10px] text-text-secondary">
                        {track ? 'Inter Regular' : ''}
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <div className="font-mono text-[14px] font-bold tracking-tight text-text-primary">
                        {remainingTime.main}<span className="text-[10px] text-text-secondary">{remainingTime.sub}</span>
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">Remaining</div>
                </div>

                <div className="shrink-0 text-right">
                    <div className={`font-mono text-[14px] font-bold tracking-tight ${isSynced ? 'text-signal-nominal' : 'text-text-primary'}`}>
                        {bpmDisplay}
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">BPM</div>
                </div>

                <div className="shrink-0 text-right">
                    <div className={`font-mono text-[14px] font-bold tracking-tight ${keyLock ? 'text-signal-nominal' : 'text-text-primary'}`}>
                        {track ? `${track.key}${keyShift !== 0 ? `${keyShift > 0 ? '+' : ''}${keyShift}` : ''}` : '--'}
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">Key</div>
                </div>

                <div
                    className={`shrink-0 cursor-ns-resize select-none text-right ${isDraggingPitch ? 'brightness-125' : ''}`}
                    onMouseDown={handlePitchMouseDown}
                    onDoubleClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: 0 })}
                    title="Drag vertically to adjust pitch. Shift for fine control. Double-click to reset."
                >
                    <div className={`font-mono text-[14px] font-bold tracking-tight ${Math.abs(pitchPercent) > 0.01 ? 'text-signal-nominal' : 'text-text-primary'}`}>
                        {pitchPercent >= 0 ? '+' : ''}{pitchPercent.toFixed(1)}%
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">Pitch</div>
                </div>
            </div>

            {/* ──── ROW 2: WAVEFORM ──── */}
            <div className="relative h-[100px] shrink-0 border-b border-white/6 bg-[#0a0a0a]">
                <Waveform
                    key={`${id}-${track?.id || 'none'}`}
                    isPlaying={isPlaying} progress={progress} color={activeColor}
                    data={waveformData} cuePoints={cuePoints} loopRegion={loopRegion}
                />
                {!track && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button
                            onClick={openFilePicker}
                            className={[
                                'absolute inset-2 flex items-center justify-center rounded-[4px] border transition-all duration-200',
                                isDragOver
                                    ? 'border-solid border-signal-nominal text-signal-nominal'
                                    : 'border-dashed border-text-secondary/50 text-text-secondary hover:border-text-secondary/80',
                            ].join(' ')}
                        >
                            <span className="font-sans text-[10px] tracking-[0.08em]">
                                {isDragOver ? 'Drop to load' : 'Drop a track or click to browse'}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Track overview */}
            <TrackOverview
                data={waveformData || []} progress={progress} color={activeColor}
                loopRegion={loopRegion} cuePoints={cuePoints} duration={duration}
                onSeek={(value) => { if (track) dispatch({ type: 'SEEK_POSITION', deckId: id, value }); }}
            />

            {/* ──── ROW 3: TRANSPORT ──── */}
            <div className="flex h-[42px] shrink-0 items-center gap-3 border-b border-white/6 bg-black/20 px-3">
                {/* Play/Pause */}
                <button
                    className={[
                        'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150',
                        !canTransport
                            ? 'cursor-not-allowed border-white/10 text-text-secondary/40'
                            : isPlaying
                                ? 'border-signal-nominal bg-signal-nominal/20 text-signal-nominal'
                                : 'border-signal-nominal text-signal-nominal hover:bg-signal-nominal/10',
                    ].join(' ')}
                    disabled={!canTransport}
                    onClick={() => dispatch({ type: 'TOGGLE_PLAY', deckId: id })}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                            <rect x="0" y="0" width="4" height="14" rx="1" />
                            <rect x="8" y="0" width="4" height="14" rx="1" />
                        </svg>
                    ) : (
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                            <path d="M0 0.5C0 0.191 0.344 0 0.6 0.167L11.4 6.667C11.656 6.834 11.656 7.166 11.4 7.333L0.6 13.833C0.344 14 0 13.809 0 13.5V0.5Z" />
                        </svg>
                    )}
                </button>

                {/* CUE */}
                <button
                    className={[
                        'flex h-[30px] shrink-0 items-center justify-center rounded-[4px] border px-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-150',
                        canTransport
                            ? 'border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.08]'
                            : 'cursor-not-allowed border-white/6 text-text-secondary/40',
                    ].join(' ')}
                    disabled={!canTransport}
                    onClick={() => dispatch({ type: 'CUE_MASTER', deckId: id })}
                >
                    CUE
                </button>

                <div className="flex-1" />

                {/* Mode labels: CUES + LOOP only (stems removed) */}
                {(['CUES', 'LOOP'] as const).map((tab) => (
                    <span
                        key={tab}
                        className="relative px-2 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-text-primary"
                    >
                        {tab}
                        <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-text-primary" />
                    </span>
                ))}

                <div className="flex-1" />

                {/* SYNC */}
                <button
                    className={[
                        'flex h-[30px] shrink-0 items-center justify-center rounded-[4px] border px-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-150',
                        !canTransport
                            ? 'cursor-not-allowed border-white/6 text-text-secondary/40'
                            : isSynced
                                ? 'border-signal-nominal/40 bg-signal-nominal/14 text-signal-nominal'
                                : 'border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.08]',
                    ].join(' ')}
                    disabled={!canTransport}
                    onClick={() => dispatch({ type: 'SYNC_DECK', deckId: id })}
                >
                    SYNC
                </button>
            </div>

            {/* ──── ROW 4: PERFORMANCE AREA ──── */}
            {/*
                Three-column layout replacing the old cues+stems split:
                  LEFT   — 8 Hot Cue Pads (3×3 grid, pad 9 empty)
                  CENTER — Beat Jump (4 buttons: ◀4 ◀1 ▶1 ▶4) + Loop size grid
                  RIGHT  — FX toggles (REVERB, DELAY, FILTER) + Loop controls (½, IN/OUT, 2×)
            */}
            <div className="flex min-h-0 flex-1 border-t border-white/4">

                {/* ── LEFT: Hot Cue Pads ── */}
                <div className="flex w-[38%] shrink-0 flex-col border-r border-white/6 p-2.5">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            CUE
                        </span>
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: cuePoints[i] !== null ? CUE_COLORS[i] : 'rgba(255,255,255,0.08)' }} />
                            ))}
                        </div>
                    </div>
                    <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-1.5">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
                            if (index >= 8) {
                                return <div key={index} className="rounded-[3px] border border-white/[0.05] bg-black/20" />;
                            }
                            const cue = cuePoints[index];
                            const isSet = cue !== null;
                            const color = CUE_COLORS[index];
                            return (
                                <button
                                    key={index}
                                    className={[
                                        'relative flex flex-col items-center justify-center rounded-[3px] border transition-all',
                                        isSet
                                            ? 'border-white/12 bg-white/[0.04] text-text-primary'
                                            : 'border-white/[0.06] bg-black/20 text-text-secondary/50 hover:border-white/12',
                                    ].join(' ')}
                                    onMouseDown={() => handlePadDown(index)}
                                    onMouseUp={() => handlePadUp(index)}
                                    onMouseLeave={() => pressTimer && clearTimeout(pressTimer)}
                                    aria-label={`Hot Cue ${index + 1}`}
                                >
                                    {isSet && (
                                        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-[3px]" style={{ backgroundColor: color }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── CENTER: Beat Jump + Loop Grid ── */}
                <div className="flex w-[32%] flex-col border-r border-white/6 p-2.5">
                    {/* Section label */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            JUMP
                        </span>
                    </div>

                    {/* Beat jump row */}
                    <div className="mb-2 flex gap-1.5">
                        <JumpButton label="◀4" beats={4} direction="back"    disabled={!canTransport} dispatch={dispatch} deckId={id} />
                        <JumpButton label="◀1" beats={1} direction="back"    disabled={!canTransport} dispatch={dispatch} deckId={id} />
                        <JumpButton label="▶1" beats={1} direction="forward" disabled={!canTransport} dispatch={dispatch} deckId={id} />
                        <JumpButton label="▶4" beats={4} direction="forward" disabled={!canTransport} dispatch={dispatch} deckId={id} />
                    </div>

                    {/* Loop size grid (2×3) */}
                    <div className="mb-1.5 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            LOOP
                        </span>
                    </div>
                    <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1.5">
                        {LOOP_SIZES.map((beats) => {
                            const label = beats < 1 ? `1/${1 / beats}` : `${beats}`;
                            const selected = activeLoop === beats;
                            return (
                                <button
                                    key={beats}
                                    className={[
                                        'flex flex-col items-center justify-center rounded-[3px] border transition-all duration-150',
                                        selected
                                            ? 'border-signal-nominal/30 bg-signal-nominal/12 text-text-primary'
                                            : 'border-white/[0.06] bg-black/20 text-text-secondary hover:border-white/12 hover:text-text-primary',
                                        !canTransport ? 'cursor-not-allowed opacity-40' : '',
                                    ].join(' ')}
                                    onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats })}
                                    disabled={!canTransport}
                                    aria-label={`Loop ${label} beats`}
                                >
                                    <div className="font-mono text-[14px] font-bold leading-none">{label}</div>
                                    <div className="mt-0.5 font-sans text-[8px] uppercase text-text-secondary">bar{beats !== 1 ? 's' : ''}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── RIGHT: Loop Controls + FX ── */}
                <div className="flex flex-1 flex-col p-2.5">

                    {/* Loop in/out controls */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            CTRL
                        </span>
                    </div>
                    <div className="mb-2 flex gap-1.5">
                        {/* Loop halve */}
                        <button
                            className={[
                                'flex flex-1 items-center justify-center rounded-[3px] border py-1 font-mono text-[11px] font-bold transition-all duration-150',
                                canTransport && activeLoop
                                    ? 'border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.08] active:scale-95'
                                    : 'cursor-not-allowed border-white/[0.05] text-text-secondary/30',
                            ].join(' ')}
                            disabled={!canTransport || !activeLoop}
                            onClick={() => dispatch({ type: 'LOOP_HALVE', deckId: id } as DeckAction)}
                            title="Halve loop length"
                        >
                            ½
                        </button>
                        {/* Loop in/out toggle */}
                        <button
                            className={[
                                'flex flex-1 items-center justify-center rounded-[3px] border py-1 font-sans text-[9px] font-bold uppercase tracking-wider transition-all duration-150',
                                canTransport
                                    ? activeLoop
                                        ? 'border-signal-nominal/40 bg-signal-nominal/14 text-signal-nominal'
                                        : 'border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.08]'
                                    : 'cursor-not-allowed border-white/[0.05] text-text-secondary/30',
                            ].join(' ')}
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: activeLoop ? 'LOOP_EXIT' : 'LOOP_TRACK', deckId: id, beats: 4 } as DeckAction)}
                            title={activeLoop ? 'Exit loop' : 'Set loop (4 bars)'}
                        >
                            {activeLoop ? 'EXIT' : 'IN/OUT'}
                        </button>
                        {/* Loop double */}
                        <button
                            className={[
                                'flex flex-1 items-center justify-center rounded-[3px] border py-1 font-mono text-[11px] font-bold transition-all duration-150',
                                canTransport && activeLoop
                                    ? 'border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.08] active:scale-95'
                                    : 'cursor-not-allowed border-white/[0.05] text-text-secondary/30',
                            ].join(' ')}
                            disabled={!canTransport || !activeLoop}
                            onClick={() => dispatch({ type: 'LOOP_DOUBLE', deckId: id } as DeckAction)}
                            title="Double loop length"
                        >
                            ×2
                        </button>
                    </div>

                    {/* FX section */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            FX
                        </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex gap-1.5">
                            <FxButton
                                label="REV"
                                effectType={EffectType.REVERB}
                                isActive={isReverbOn}
                                disabled={!canTransport}
                                color="var(--color-cyan)"
                                dispatch={dispatch}
                                deckId={id}
                            />
                            <FxButton
                                label="DLY"
                                effectType={EffectType.DELAY}
                                isActive={isDelayOn}
                                disabled={!canTransport}
                                color="var(--color-amber)"
                                dispatch={dispatch}
                                deckId={id}
                            />
                            <FxButton
                                label="FLT"
                                effectType={EffectType.FILTER}
                                isActive={isFilterOn}
                                disabled={!canTransport}
                                color="var(--color-orange)"
                                dispatch={dispatch}
                                deckId={id}
                            />
                        </div>

                        {/* Key lock toggle — good use of remaining vertical space */}
                        <button
                            className={[
                                'flex w-full items-center justify-center gap-2 rounded-[3px] border py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-150',
                                !canTransport
                                    ? 'cursor-not-allowed border-white/[0.05] text-text-secondary/30'
                                    : keyLock
                                        ? 'border-signal-nominal/40 bg-signal-nominal/12 text-signal-nominal'
                                        : 'border-white/10 bg-black/20 text-text-secondary hover:border-white/20 hover:text-text-primary',
                            ].join(' ')}
                            disabled={!canTransport}
                            onClick={() => dispatch({ type: 'TOGGLE_KEY_LOCK', deckId: id } as DeckAction)}
                            title="Toggle key lock (maintains pitch when changing tempo)"
                        >
                            {/* Lock icon */}
                            <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" className="opacity-80">
                                <rect x="1" y="5" width="8" height="6" rx="1" />
                                <path d="M3 5V3.5a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                            </svg>
                            KEY LOCK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deck;
