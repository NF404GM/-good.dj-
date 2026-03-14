import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DeckState, DeckAction } from '../types';
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

const LOOP_SIZES = [1, 2, 4, 8];

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
   DECK COMPONENT — matches reference mockup
   Layout:
   1. Header: DECK badge | title+font | artist+font | remaining | BPM | Key | Pitch
   2. Waveform (100px)
   3. Transport+Tabs row: [Play][CUE] | CUES LOOP | [SYNC]
   4. Performance: hot cues (3x3) | loop beats (3x2)
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

    // Pitch drag handlers
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
       DECK RENDER — matching reference mockup
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
                {/* DECK badge */}
                <div className="shrink-0 rounded-[3px] border border-white/12 bg-black/40 px-3 py-1.5">
                    <span className="font-sans text-[13px] font-extrabold uppercase tracking-[0.08em] text-text-primary">
                        Deck {id}
                    </span>
                </div>

                {/* Track title + font info */}
                <div className="min-w-0 flex-1">
                    <div className="truncate font-sans text-[14px] font-bold text-text-primary">
                        {track?.title || 'No track loaded'}
                    </div>
                    <div className="font-sans text-[10px] text-text-secondary">
                        {track ? 'Inter Medium' : ''}
                    </div>
                </div>

                {/* Artist + font info */}
                <div className="min-w-0">
                    <div className="font-sans text-[14px] text-text-primary">
                        {track?.artist || ''}
                    </div>
                    <div className="font-sans text-[10px] text-text-secondary">
                        {track ? 'Inter Regular' : ''}
                    </div>
                </div>

                {/* Stats: Remaining */}
                <div className="shrink-0 text-right">
                    <div className="font-mono text-[14px] font-bold tracking-tight text-text-primary">
                        {remainingTime.main}<span className="text-[10px] text-text-secondary">{remainingTime.sub}</span>
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">Remaining</div>
                </div>

                {/* BPM */}
                <div className="shrink-0 text-right">
                    <div className={`font-mono text-[14px] font-bold tracking-tight ${isSynced ? 'text-signal-nominal' : 'text-text-primary'}`}>
                        {bpmDisplay}
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">BPM</div>
                </div>

                {/* Key */}
                <div className="shrink-0 text-right">
                    <div className={`font-mono text-[14px] font-bold tracking-tight ${keyLock ? 'text-signal-nominal' : 'text-text-primary'}`}>
                        {track ? `${track.key}${keyShift !== 0 ? `${keyShift > 0 ? '+' : ''}${keyShift}` : ''}` : '--'}
                    </div>
                    <div className="font-sans text-[9px] text-text-secondary">Key</div>
                </div>

                {/* Pitch — draggable to adjust pitch */}
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

            {/* ──── ROW 2: WAVEFORM (100px) ──── */}
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

            {/* ──── ROW 3: TRANSPORT (single row) ──── */}
            <div className="flex h-[42px] shrink-0 items-center gap-3 border-b border-white/6 bg-black/20 px-3">
                {/* Play/Pause circle button */}
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

                {/* CUE button */}
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

                {/* Spacer */}
                <div className="flex-1" />

                {/* CUES / LOOP labels */}
                {(['CUES', 'LOOP'] as const).map((tab) => (
                    <span
                        key={tab}
                        className="relative px-2 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-text-primary"
                    >
                        {tab}
                        <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-text-primary" />
                    </span>
                ))}

                {/* Spacer */}
                <div className="flex-1" />

                {/* SYNC button */}
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

            {/* ──── ROW 4: PERFORMANCE AREA (cues + loops) ──── */}
            <div className="flex min-h-0 flex-1 border-t border-white/4">

                {/* LEFT: Hot Cue Pads — 3x3 grid */}
                <div className="flex flex-1 shrink-0 flex-col border-r border-white/6 p-2.5">
                    {/* CUE label row with color dots */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            CUE
                        </span>
                        {/* Color indicator dots */}
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: cuePoints[i] !== null ? CUE_COLORS[i] : 'rgba(255,255,255,0.08)' }} />
                            ))}
                        </div>
                    </div>

                    {/* 3x3 cue pad grid */}
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

                {/* RIGHT: Loop Beat Grid — 3x2 */}
                <div className="flex flex-1 flex-col p-2.5">
                    {/* LOOP label */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-[3px] border border-white/12 bg-white/[0.04] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-primary">
                            LOOP
                        </span>
                    </div>
                    <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1.5">
                        {LOOP_SIZES.concat([5, 6]).map((beats, idx) => {
                            const actualBeats = idx < 4 ? LOOP_SIZES[idx] : (idx === 4 ? 16 : 32);
                            const displayNum = idx + 1;
                            const selected = activeLoop === actualBeats;
                            return (
                                <button
                                    key={idx}
                                    className={[
                                        'flex flex-col items-center justify-center rounded-[3px] border transition-all',
                                        selected
                                            ? 'border-signal-nominal/30 bg-signal-nominal/12 text-text-primary'
                                            : 'border-white/[0.06] bg-black/20 text-text-secondary hover:border-white/12 hover:text-text-primary',
                                    ].join(' ')}
                                    onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats: actualBeats })}
                                    disabled={!canTransport}
                                >
                                    <div className="font-mono text-[16px] font-bold leading-none">{displayNum}</div>
                                    <div className="mt-0.5 font-sans text-[8px] uppercase text-text-secondary">Beat</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deck;
