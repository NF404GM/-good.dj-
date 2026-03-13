
import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StemType, EffectType, DeckState, DeckAction, StemModelStatus } from '../types';
import { StemControl, HorizontalBar, VerticalFader, VUMeter } from './StemControl';
import { Waveform } from './Waveform';
import { TrackOverview } from './TrackOverview';
import { AudioEngine } from '../services/audio';

// 8 distinct hot cue colors — matching waveform & overview markers
const CUE_COLORS = [
    'var(--color-signal-peak)', // 1 - Red
    '#f97316', // 2 - Orange
    '#eab308', // 3 - Yellow
    '#22c55e', // 4 - Green
    '#06b6d4', // 5 - Cyan
    '#3b82f6', // 6 - Blue
    '#8b5cf6', // 7 - Purple
    '#ec4899', // 8 - Pink
];

// --- ANIMATION CONSTANTS (Physical Springs) ---
const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 } as const;
const SPRING_BOUNCY = { type: 'spring', stiffness: 400, damping: 15, mass: 1 } as const;
const SPRING_SMOOTH = { type: 'spring', stiffness: 300, damping: 25 } as const;

// --- TECHNICAL HUD COMPONENTS (good.MATTE) ---

export const TechnicalKnob: React.FC<{
    value: number;
    onChange: (v: number) => void;
    label: string;
    color?: string;
    bipolar?: boolean; // If true, fills from center (0.5)
    size?: number;
    displayValue?: string; // Optional override for value readout
}> = ({ value, onChange, label, color = "var(--color-text-primary)", bipolar = false, size = 36, displayValue }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef<number>(0);
    const startVal = useRef<number>(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startX.current = e.clientY;
        startVal.current = value;
        document.body.style.cursor = 'ew-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            // Precision Control:
            const range = e.shiftKey ? 1200 : 400; // Increased precision
            const deltaY = startX.current - e.clientY; // Swap to vertical drag (up = increase)
            const deltaVal = deltaY / range;
            let newVal = Math.max(0, Math.min(1, startVal.current + deltaVal));

            // Smart Snap to Center (for Bipolar Knobs)
            if (bipolar) {
                if (newVal > 0.45 && newVal < 0.55) {
                    newVal = 0.5;
                }
            }

            onChange(newVal);
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
    }, [isDragging, onChange, bipolar]);

    // SVG Math
    const radius = size * 0.4; // Responsive radius based on container size
    const circumference = 2 * Math.PI * radius;
    // Use 75% arc (270 degrees)
    const arcLen = circumference * 0.75;

    let strokeDashoffset: number;

    if (bipolar) {
        // Simple linear map to keep it robust
        const fillAmt = value * arcLen;
        strokeDashoffset = circumference - fillAmt;
    } else {
        const fillAmt = value * arcLen;
        strokeDashoffset = circumference - fillAmt;
    }

    // Dynamic Label generation
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
            className="flex flex-col items-center justify-center gap-[2px] select-none group relative py-1 hover:brightness-125 transition-all duration-150 cursor-ns-resize"
            data-dragging={isDragging}
            onMouseDown={handleMouseDown}
            onDoubleClick={() => onChange(bipolar ? 0.5 : 0.75)}
            title="Drag vertically to adjust. Shift for precise. Double-click to reset."
        >
            <div
                className="relative hover:scale-105 transition-transform active:scale-100 group-data-[dragging=true]:cursor-grabbing cursor-ew-resize tactile-knob rounded-full"
                style={{ width: size, height: size }}
            >
                <svg width={size} height={size} viewBox="0 0 40 40" className="transform rotate-90 drop-shadow-md will-change-transform transform-gpu">
                    <defs>
                        <radialGradient id="knobGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.1)', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: 'rgba(0,0,0,0.4)', stopOpacity: 1 }} />
                        </radialGradient>
                    </defs>
                    {/* Background Track */}
                    <circle
                        cx="20" cy="20" r={16}
                        fill="url(#knobGradient)"
                        stroke="var(--surface-idle)"
                        strokeWidth="4"
                        strokeDasharray={arcLen + " " + circumference}
                        strokeLinecap="round"
                    />

                    {/* Value Arc */}
                    <motion.circle
                        cx="20" cy="20" r={16}
                        fill="none"
                        stroke={isDragging ? "#ffffff" : color}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        strokeLinecap="round"
                        style={{
                            opacity: bipolar && Math.abs(value - 0.5) < 0.02 ? 0.2 : 1,
                            filter: isDragging ? 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' : 'none'
                        }}
                    />
                </svg>

                {/* Center / Bipolar Indicator Tick */}
                {bipolar && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-white/20 pointer-events-none" />
                )}
            </div>

            {/* Value Readout (Static) */}
            <div className="font-mono text-[9px] text-text-mono opacity-80 leading-none mt-0.5">
                {getReadout()}
            </div>
            {/* Label */}
            <span className="font-sans font-bold text-[8px] uppercase tracking-widest text-text-primary mt-[2px] leading-none text-center">{label}</span>
        </div>
    );
};


// --- MAIN DECK COMPONENT ---

interface DeckProps {
    deckState: DeckState;
    dispatch: (action: DeckAction) => void;
    activeColor: string;
}

export const Deck: React.FC<DeckProps> = ({ deckState, dispatch, activeColor }) => {
    const { id, track, hasAudioBuffer, isPlaying, isLoading, progress, pitch, pitchRange, stems, eq, fx, cuePoints, waveformData, level, activeLoop, gridOffset, keyLock, keyShift, isSynced, stemMode, isSeparatingStems } = deckState;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [deleteCandidateIndex, setDeleteCandidateIndex] = useState<number | null>(null);
    const [padMode, setPadMode] = useState<'HOT_CUE' | 'STEMS' | 'LOOP'>('HOT_CUE');
    const [stemModelStatus, setStemModelStatus] = useState<StemModelStatus | null>(null);

    // --- PITCH FADER DRAG STATE ---
    const [isDraggingPitch, setIsDraggingPitch] = useState(false);
    const pitchStartY = useRef<number>(0);
    const pitchStartVal = useRef<number>(0);

    const handlePitchMouseDown = (e: React.MouseEvent) => {
        if (!track) return;
        setIsDraggingPitch(true);
        pitchStartY.current = e.clientY;
        pitchStartVal.current = pitch;
        document.body.style.cursor = 'ns-resize';
    };

    useEffect(() => {
        const handlePitchMouseMove = (e: MouseEvent) => {
            if (!isDraggingPitch) return;
            // Native fader throws are longer, so a large range divisor gives supreme precision
            const range = e.shiftKey ? 1600 : 400;
            // Drag UP (smaller clientY) = positive pitch (faster)
            const deltaY = pitchStartY.current - e.clientY;
            const deltaVal = deltaY / range;
            const newVal = Math.max(-1, Math.min(1, pitchStartVal.current + deltaVal));
            dispatch({ type: 'SET_PITCH', deckId: id, value: newVal });
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
    }, [isDraggingPitch, id, dispatch]);

    useEffect(() => {
        if (!window.gooddj?.stems?.getStatus) {
            return;
        }

        let active = true;
        const refreshStemModelStatus = async () => {
            try {
                const status = await window.gooddj?.stems.getStatus();
                if (active && status) {
                    setStemModelStatus(status);
                }
            } catch {
                if (active) {
                    setStemModelStatus(null);
                }
            }
        };

        const handleStatusChanged = () => {
            void refreshStemModelStatus();
        };

        void refreshStemModelStatus();
        window.addEventListener('gooddj:stem-model-status-changed', handleStatusChanged);

        return () => {
            active = false;
            window.removeEventListener('gooddj:stem-model-status-changed', handleStatusChanged);
        };
    }, []);

    // --- DRAG & DROP HANDLERS ---
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
            // Silently ignore unsupported formats (no alert)
            return;
        }

        const data = e.dataTransfer.getData('application/json');
        if (data) {
            try {
                const payload = JSON.parse(data);
                // Library drag format: { trackIds: string[], track: object }
                if (payload.track && payload.track.title) {
                    dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload.track });
                    return;
                }

                // Direct track data format (fallback)
                if (payload.title) {
                    dispatch({ type: 'LOAD_TRACK', deckId: id, track: payload });
                }
            } catch (err) { console.error(err); }
        }
    };

    const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            AudioEngine.resume();
            dispatch({ type: 'LOAD_FILE', deckId: id, file: file });
        }
        if (e.target) e.target.value = '';
    };

    // --- CUE PAD LOGIC ---
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

    const formatTime = (totalSeconds: number) => {
        if (!Number.isFinite(totalSeconds)) return { main: "0:00", sub: ".00" };
        const min = Math.floor(totalSeconds / 60);
        const sec = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 100);
        return {
            main: `${min}:${sec.toString().padStart(2, '0')}`,
            sub: `.${ms.toString().padStart(2, '0')}`
        };
    };

    const duration = track ? track.duration : 0;
    const timeObj = formatTime(duration * progress);
    const remainObj = formatTime(duration * (1 - progress));
    const canTransport = !!track && hasAudioBuffer;

    const stemOrder = [StemType.LOW, StemType.BASS, StemType.MID, StemType.HIGH];
    const stemConfig = {
        [StemType.LOW]: { label: stemMode === 'real' ? 'DRUMS' : 'LOW', color: 'var(--stem-drums)' },
        [StemType.BASS]: { label: 'BASS', color: 'var(--stem-bass)' },
        [StemType.MID]: { label: stemMode === 'real' ? 'OTHER' : 'MID', color: 'var(--stem-vocals)' },
        [StemType.HIGH]: { label: stemMode === 'real' ? 'VOCALS' : 'HIGH', color: 'var(--stem-harmonic)' },
    };
    const canSeparateStems = Boolean(window.gooddj?.stems && track?.filePath && stemModelStatus?.available);

    const LOOP_SIZES = [0.5, 1, 2, 4, 8];

    const getFxLabels = () => {
        switch (fx.activeType) {
            case EffectType.DELAY: return ['TIME', 'FDBK'];
            case EffectType.REVERB: return ['DECAY', 'TONE'];
            default: return ['PARAM 1', 'PARAM 2'];
        }
    };
    const [fxLabel1, fxLabel2] = getFxLabels();

    // Normalize pitch (-1..1 to 0..1 inverted for visual display: UP = faster)
    // If pitch = 1 (fastest), visual should be top (0).
    // If pitch = -1 (slowest), visual should be bottom (1).
    const pitchPct = 0.5 - (pitch * 0.5);

    const cyclePitchRange = () => {
        const ranges = [0.06, 0.10, 0.16, 1.0];
        const nextIdx = (ranges.indexOf(pitchRange) + 1) % ranges.length;
        dispatch({ type: 'SET_PITCH_RANGE', deckId: id, value: ranges[nextIdx] });
    };

    return (
        <div
            className="flex flex-col h-full bg-canvas border border-white/5 rounded-none overflow-hidden relative shadow-2xl ring-1 ring-white/5"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input type="file" ref={fileInputRef} onChange={handleFileLoad} className="hidden" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" />

            {/* Drop Zone overlay logic moved to Waveform area */}

            {/* HEADER */}
            <div className="h-12 flex border-b border-white/5 bg-canvas shrink-0 z-20 shadow-sm relative overflow-hidden">
                {/* Deck Color Strip */}
                <div className="absolute top-0 bottom-0 left-0 w-1 opacity-80 mix-blend-screen" style={{ backgroundColor: activeColor }} />

                {/* Left Side: Badge & Info */}
                <div className="flex-1 flex items-center pl-3 pr-3 gap-3 overflow-hidden relative">
                    {/* INDUSTRIAL DECK BADGE */}
                    <div className={`relative px-3 py-1 bg-black border border-white/5 shadow-inner flex flex-col items-center justify-center min-w-[50px] overflow-hidden group/badge transition-all duration-300 ${isPlaying ? 'border-signal-nominal/50 shadow-[0_0_10px_rgba(var(--signal-nominal-rgb),0.2)]' : ''}`}>
                        <div className={`absolute inset-0 bg-signal-nominal/5 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`} />
                        <span className={`text-[7px] font-mono leading-none tracking-[0.2em] mb-0.5 transition-colors ${isPlaying ? 'text-signal-nominal' : 'text-text-secondary opacity-80'}`}>DECK</span>
                        <span className={`text-lg font-black italic leading-none tracking-tighter transition-colors ${isPlaying ? 'text-signal-nominal' : 'text-text-primary'}`}>{id}</span>
                        {/* Status Bit LED */}
                        <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full transition-all duration-300 ${isPlaying ? 'bg-signal-nominal shadow-[0_0_6px_rgba(var(--signal-nominal-rgb),1)] animate-pulse' : 'bg-white/20'}`} />
                    </div>

                    {/* Track Info */}
                    {track || hasAudioBuffer ? (
                        <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="flex flex-col justify-center overflow-hidden min-w-0 flex-1"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-text-primary tracking-tight truncate leading-tight uppercase font-inter">
                                    {track?.title || "LOADED TRACK"}
                                </span>
                            </div>
                            <span className="text-[9px] font-mono font-medium text-text-secondary tracking-widest truncate mt-0.5 uppercase">
                                {track?.artist || "LOCAL AUDIO"}
                            </span>
                        </motion.div>
                    ) : (
                        <motion.div
                            whileHover={{ scale: 0.98, opacity: 0.8 }}
                            whileTap={{ scale: 0.95, y: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className={`flex flex-col justify-center items-center w-full h-[32px] cursor-pointer border border-dashed rounded-xs
                                ${isDragOver ? 'border-signal-nominal bg-signal-nominal/5' : 'border-white/10 bg-surface-idle hover:border-white/30 hover:bg-surface-active'}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className={`text-[8px] font-mono font-bold tracking-[0.2em] uppercase ${isDragOver ? 'text-signal-nominal' : 'text-text-data/40 group-hover:text-text-data/80'}`}>
                                {isDragOver ? 'DROP TO LOAD' : 'NO TRACK LOADED'}
                            </span>
                        </motion.div>
                    )}
                </div>                {/* Right Side: Readouts */}
                <div className="flex bg-black/40 shrink-0 divide-x divide-white/5 h-full items-stretch">
                    {/* Time */}
                    <div className="flex flex-col justify-center items-end px-5 min-w-[95px] group cursor-pointer hover:bg-white/5 transition-colors relative border-l border-white/5">
                        <span className="text-[7px] font-mono font-bold text-text-data/60 uppercase tracking-[0.2em] mb-0.5">REMAIN</span>
                        <div className="font-mono text-text-primary leading-none flex items-baseline gap-0.5">
                            <span className="text-xl font-bold tracking-[-0.05em]">{remainObj.main}</span>
                            <span className="text-[12px] font-medium text-text-secondary w-5">{remainObj.sub}</span>
                        </div>
                    </div>
                    {/* Key Readout */}
                    <div className="flex flex-col justify-center items-center px-4 min-w-[65px] group cursor-pointer hover:bg-white/5 transition-colors">
                        <span className="text-[7px] font-mono font-bold text-text-data/60 uppercase tracking-[0.2em] mb-0.5">KEY</span>
                        <span className={`text-[15px] font-mono font-bold leading-none ${isPlaying ? 'text-signal-nominal shadow-[0_0_8px_rgba(var(--signal-nominal-rgb),0.3)]' : 'text-text-primary'}`}>
                            {track ? track.key : '--'}
                        </span>
                    </div>

                    {/* KEY CONTROLS OVERLAY */}
                    <div className="flex flex-col justify-center items-end px-3 border-r border-white/5 group relative min-w-[65px] cursor-pointer">
                        <span className={`text-[15px] font-mono font-bold leading-none group-hover:opacity-0 transition-opacity ${keyLock ? 'text-signal-nominal' : 'text-text-primary'}`}>
                            {track ? track.key : '--'}
                            {keyShift !== 0 && <span className="text-[11px] ml-1">{keyShift > 0 ? '+' : ''}{keyShift}</span>}
                        </span>

                        {/* Hover Overlay Buttons */}
                        <div className="absolute inset-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity bg-black disabled:opacity-0 disabled:pointer-events-none" style={{ pointerEvents: track ? 'auto' : 'none' }}>
                            <div className="flex-1 flex w-full border-b border-white/5">
                                <button
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.max(-12, keyShift - 1) }); }}
                                    className="flex-1 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10"
                                    title="Key Down (Semitone)"
                                ><span className="text-[10px] leading-none mb-1">-</span></button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_KEY_SHIFT', deckId: id, value: Math.min(12, keyShift + 1) }); }}
                                    className="flex-1 border-l border-white/5 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10"
                                    title="Key Up (Semitone)"
                                ><span className="text-[10px] leading-none mb-1">+</span></button>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_KEY_LOCK', deckId: id }); }}
                                className={`flex-[1.5] flex items-center justify-center text-[7px] font-mono font-bold tracking-widest uppercase transition-colors ${keyLock ? 'bg-signal-nominal/20 text-signal-nominal hover:bg-signal-nominal/30' : 'text-text-secondary hover:text-white hover:bg-white/10'}`}
                                title="Toggle Key Lock / Master Tempo"
                            >
                                LOCK
                            </button>
                        </div>
                    </div>

                    {/* BPM */}
                    <div className="flex flex-col justify-center items-end px-5 min-w-[90px] group cursor-pointer hover:bg-white/5 transition-colors">
                        <span className="text-[7px] font-mono font-bold text-text-data/60 uppercase tracking-[0.2em] mb-0.5">BPM</span>
                        <span className="text-xl font-mono font-bold text-text-primary leading-none tracking-tighter">
                            {track ? (track.bpm * (1 + (pitch * pitchRange))).toFixed(1) : '--.-'}
                        </span>
                    </div>
                </div>

                {/* Util Buttons */}
                <div className="flex flex-col divide-y divide-white/5 bg-black/60 border-l border-white/5 min-w-[32px]">
                    <button onClick={() => dispatch({ type: 'DOUBLE_DECK', deckId: id })} className="h-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors" title="Clone Track from Deck">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button onClick={() => dispatch({ type: 'EJECT_TRACK', deckId: id })} className="h-full flex items-center justify-center text-text-secondary hover:text-[#ef4444] hover:bg-white/10 transition-colors" title="Eject Track">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M18 7h-2.5L12 2 8.5 7H6v2h12V7zm0 6H6v2h12v-2z" /></svg>
                    </button>
                </div>
            </div>

            {/* DECK BODY: A robust horizontal split between Performance and Pitch */}
            <div className={`flex-1 flex min-h-0 relative group/deck-body ${id === 'B' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* 1. PERFORMANCE AREA (Main Stack) */}
                <div className="flex-1 flex flex-col min-w-0 relative bg-surface-idle">
                    {/* TRACK OVERVIEW */}
                    <TrackOverview
                        data={waveformData}
                        progress={progress}
                        color={activeColor}
                        loopRegion={activeLoop ? AudioEngine.getLoopBoundaries(id) : null}
                        cuePoints={cuePoints}
                        duration={track?.duration || 0}
                        onSeek={(pct) => {
                            if (!track) return;
                            dispatch({ type: 'SEEK_POSITION', deckId: id, value: pct });
                        }}
                    />

                    {/* WAVEFORM */}
                    <div className="relative bg-black group h-[100px] min-h-[100px] border-b border-white/5 flex will-change-transform transform-gpu overflow-hidden shrink-0">
                        <div className="flex-1 relative min-w-0 cursor-crosshair active:cursor-grabbing"
                            onClick={(e) => {
                                if (!track) {
                                    fileInputRef.current?.click();
                                    return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const pct = Math.max(0, Math.min(1, x / rect.width));
                                dispatch({ type: 'SEEK_POSITION', deckId: id, value: pct });
                            }}
                        >
                            <Waveform
                                key={`${id}-${track?.id || 'none'}`}
                                isPlaying={isPlaying}
                                progress={progress}
                                color={activeColor}
                                data={waveformData}
                                cuePoints={cuePoints}
                                loopRegion={activeLoop ? AudioEngine.getLoopBoundaries(id) : null}
                            />

                            {track && (
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-30">
                                    <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-sm text-[11px] font-mono text-text-primary shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                        {timeObj.main}{timeObj.sub}
                                    </div>
                                </div>
                            )}

                            {/* Solid Drawing: Subtle depth gradient over the waveform */}
                            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_20px_40px_rgba(0,0,0,0.4),inset_0_-20px_40px_rgba(0,0,0,0.4)] z-10" />
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black via-transparent to-black opacity-30 z-10" />

                            {/* Loop Size Indicator */}
                            {activeLoop !== null && track && (
                                <div className="absolute top-2 left-2 z-20 pointer-events-none animate-pulse">
                                    <div className="bg-signal-nominal/90 backdrop-blur-sm border border-signal-nominal px-2 py-0.5 rounded-sm shadow-[0_0_12px_rgba(var(--signal-nominal-rgb),0.4)] flex items-center gap-1">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/></svg>
                                        <span className="text-[9px] font-mono font-black text-white tracking-wider">
                                            {activeLoop < 1 ? '1/2' : activeLoop}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PERFORMANCE PADS & MODE TOGGLE SECTION */}
                    <div className={`flex-1 flex flex-col min-h-0 bg-[#0c0c0c] transition-opacity duration-300 ${!track ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                        {/* MODE TABS */}
                        <div className="flex h-8 bg-black/60 border-b border-white/5 shrink-0 px-2 gap-2 items-center">
                            {[
                                { id: 'HOT_CUE', label: 'CUES' },
                                { id: 'STEMS', label: 'STEMS' },
                                { id: 'LOOP', label: 'LOOP' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setPadMode(mode.id as any)}
                                    className={`px-3 h-5 flex items-center justify-center rounded-xs text-[7px] font-mono font-black tracking-[0.2em] uppercase transition-all
                                        ${padMode === mode.id 
                                            ? 'bg-signal-nominal/20 text-signal-nominal border border-signal-nominal/30 shadow-[0_0_8px_rgba(var(--signal-nominal-rgb),0.2)]' 
                                            : 'text-white/20 hover:text-white/40 border border-white/5'}`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        {/* PAD CONTENT: Refined spacing and robust labels */}
                        <div className="flex-1 min-h-[160px] overflow-y-auto custom-scrollbar relative p-3">
                            {padMode === 'HOT_CUE' && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.98 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    className="h-full"
                                >
                                    <div className="grid grid-cols-4 grid-rows-2 gap-3 h-full">
                                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                                            const isSet = cuePoints[i] !== null;
                                            const padColor = CUE_COLORS[i];
                                            return (
                                                <motion.button
                                                    key={i}
                                                    whileHover={{ y: -2, scale: 1.02, filter: 'brightness(1.1)' }}
                                                    whileTap={{ scale: 0.94, y: 1 }}
                                                    transition={SPRING_SNAPPY}
                                                    onMouseDown={(e) => {
                                                        if (e.button === 0) handlePadDown(i);
                                                    }}
                                                    onMouseUp={() => handlePadUp(i)}
                                                    onMouseLeave={() => { if (pressTimer) clearTimeout(pressTimer); setPressTimer(null); }}
                                                    className={`relative flex flex-col items-center justify-center min-h-[70px] rounded-sm transition-all duration-300 overflow-hidden group
                                                        ${isSet ? 'border-t border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.8)]' : 'bg-[#0f0f0f] border border-white/10 opacity-30 hover:opacity-100'}
                                                    `}
                                                    style={{
                                                        backgroundColor: isSet ? '#333333' : undefined,
                                                        boxShadow: isSet ? `0 6px 0 #000, 0 12px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 20px ${padColor}33` : 'inset 0 4px 8px rgba(0,0,0,0.5)',
                                                    }}
                                                >
                                                    {/* Color indicator bar (Brighter & Glowing) */}
                                                    <div className="absolute inset-x-0 top-0 h-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-all duration-300" 
                                                         style={{ 
                                                            backgroundColor: isSet ? padColor : 'transparent', 
                                                            opacity: isSet ? 1 : 0,
                                                            boxShadow: isSet ? `0 0 15px ${padColor}, 0 0 5px #fff8` : 'none',
                                                            filter: isSet ? 'brightness(1.2)' : 'none'
                                                         }} />
                                                    
                                                    {/* Pad Label (High Contrast) */}
                                                    <span className={`text-[15px] font-mono font-black italic tracking-widest transition-all duration-300 ${isSet ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-white/5'}`}>
                                                        {i + 1}
                                                    </span>
                                                    
                                                    {isSet && (
                                                        <span className="text-[10px] font-mono font-black text-white/70 mt-1 uppercase tracking-tighter backdrop-blur-sm bg-black/20 px-1 rounded-xs">
                                                            {formatTime(track!.duration * (cuePoints[i] ?? 0)).main}
                                                        </span>
                                                    )}

                                                    {/* Delete Button (X) - Improved Visibility & Interaction */}
                                                    {isSet && (
                                                        <motion.button
                                                            whileHover={{ scale: 1.2, backgroundColor: '#ef4444', color: '#fff' }}
                                                            whileTap={{ scale: 0.9 }}
                                                            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-black/60 border border-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-lg"
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onMouseUp={(e) => e.stopPropagation()}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                dispatch({ type: 'DELETE_CUE', deckId: id, index: i });
                                                            }}
                                                            title="Delete Hot Cue"
                                                        >
                                                            <span className="text-[11px] font-bold leading-none mt-[-1px]">×</span>
                                                        </motion.button>
                                                    )}

                                                    {/* Subtle Gradient Overlay for Depth */}
                                                    {isSet && (
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-white/5 pointer-events-none" />
                                                    )}

                                                    {/* Hover Glow */}
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-white pointer-events-none" />
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {padMode === 'STEMS' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={SPRING_SMOOTH} className="h-full flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3 rounded-sm border border-white/5 bg-black/40 px-3 py-2">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-mono font-black tracking-[0.22em] text-white/80 uppercase">
                                                {stemMode === 'real' ? 'Stem Separation Ready' : 'Stem Separation'}
                                            </span>
                                            <span className="text-[8px] font-mono text-white/30 uppercase tracking-[0.18em]">
                                                {isSeparatingStems
                                                    ? 'Analyzing stems... ~15s'
                                                    : stemMode === 'real'
                                                        ? 'Real drums / bass / other / vocals loaded'
                                                        : !window.gooddj?.stems
                                                            ? 'Stem separation is available in Electron only'
                                                            : !stemModelStatus?.available
                                                                ? 'Install or bundle a noncommercial ONNX model first'
                                                                : stemModelStatus.source === 'user-installed'
                                                                    ? 'User-installed stem model ready'
                                                                    : stemModelStatus.source === 'bundled'
                                                                        ? 'Bundled free-release stem model ready'
                                                                        : 'Stem model ready'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => dispatch({ type: 'SEPARATE_STEMS', deckId: id })}
                                            disabled={!canSeparateStems || isSeparatingStems || stemMode === 'real'}
                                            className={`shrink-0 px-3 py-1.5 rounded-xs border text-[8px] font-mono font-black uppercase tracking-[0.18em] transition-all ${
                                                !canSeparateStems || isSeparatingStems || stemMode === 'real'
                                                    ? 'border-white/10 text-white/25 bg-white/5 cursor-not-allowed'
                                                    : 'border-signal-nominal/30 text-signal-nominal bg-signal-nominal/10 hover:bg-signal-nominal/20'
                                            }`}
                                        >
                                            {isSeparatingStems ? 'Working' : stemMode === 'real' ? 'Loaded' : canSeparateStems ? 'Separate' : 'Unavailable'}
                                        </button>
                                    </div>

                                    <div className="flex-1 flex gap-2">
                                        {stemOrder.map(type => {
                                            const sConfig = stemConfig[type];
                                            const sState = stems[type];
                                            return (
                                                <div key={type} className="flex-1 flex flex-col bg-canvas rounded-sm border border-white/5 p-1 relative overflow-hidden shadow-inner">
                                                    <StemControl
                                                        type={type}
                                                        volume={sState.volume}
                                                        param={sState.param}
                                                        isActive={sState.active}
                                                        color={sConfig.color}
                                                        label={sConfig.label}
                                                        onToggle={() => dispatch({ type: 'TOGGLE_STEM', deckId: id, stem: type })}
                                                        onVolumeChange={(v) => dispatch({ type: 'SET_VOLUME', deckId: id, stem: type, value: v })}
                                                        onParamChange={(v) => dispatch({ type: 'SET_STEM_PARAM', deckId: id, stem: type, value: v })}
                                                        className="w-full h-full border-none bg-transparent p-0"
                                                        hideValue={true}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {padMode === 'LOOP' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    transition={SPRING_BOUNCY}
                                    className="h-full flex flex-col gap-3"
                                >
                                    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3">
                                        {[1, 4, 8, 16].map((beats) => (
                                            <motion.button
                                                key={beats}
                                                whileHover={{ y: -1, filter: 'brightness(1.1)' }}
                                                whileTap={{ scale: 0.95 }}
                                                transition={SPRING_SNAPPY}
                                                onClick={() => dispatch({ type: 'LOOP_TRACK', deckId: id, beats: activeLoop === beats ? null : beats })}
                                                className={`relative rounded-sm border-t border-white/10 flex flex-col items-center justify-center transition-all ${activeLoop === beats ? 'bg-signal-nominal/30 border-signal-nominal/40 shadow-[0_0_20px_rgba(var(--signal-nominal-rgb),0.2)]' : 'bg-[#1a1a1a] border-white/5 shadow-tactile-out'}`}
                                            >
                                                <span className={`text-xl font-mono font-black italic tracking-tighter ${activeLoop === beats ? 'text-signal-nominal' : 'text-text-secondary'}`}>
                                                    {beats}
                                                </span>
                                                <span className="text-[7px] font-mono opacity-40 uppercase tracking-[0.2em] -mt-1">BEATS</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                    {/* Action row with improved padding for labels */}
                                    <div className="flex gap-4 h-12 mt-auto">
                                        <motion.button 
                                            whileTap={{ scale: 0.94 }}
                                            transition={SPRING_SNAPPY}
                                            onClick={() => dispatch({ type: 'LOOP_HALVE', deckId: id })} 
                                            disabled={!activeLoop} 
                                            className="flex-1 bg-black/60 border border-white/10 rounded-sm font-mono text-[11px] font-black tracking-widest hover:bg-white/5 active:bg-black transition-all disabled:opacity-10 uppercase flex items-center justify-center gap-2 group"
                                        >
                                            <span className="text-white/40 group-hover:text-white transition-colors">1/2</span>
                                            <span className="text-signal-nominal">X</span>
                                        </motion.button>
                                        <motion.button 
                                            whileTap={{ scale: 0.94 }}
                                            transition={SPRING_SNAPPY}
                                            onClick={() => dispatch({ type: 'LOOP_DOUBLE', deckId: id })} 
                                            disabled={!activeLoop} 
                                            className="flex-1 bg-black/60 border border-white/10 rounded-sm font-mono text-[11px] font-black tracking-widest hover:bg-white/5 active:bg-black transition-all disabled:opacity-10 uppercase flex items-center justify-center gap-2 group"
                                        >
                                            <span className="text-white/40 group-hover:text-white transition-colors">2</span>
                                            <span className="text-signal-nominal">X</span>
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* TRANSPORT FOOTER: Fixed to bottom of Performance Area */}
                        <div className="shrink-0 bg-[#060606] border-t border-black px-6 py-6 shadow-[0_-16px_48px_rgba(0,0,0,1)]">
                            <div className="flex items-end gap-6 h-24">
                                {/* CUE */}
                                <motion.button
                                    whileHover={{ y: -2, filter: 'brightness(1.1)' }}
                                    whileTap={{ scale: 0.94, y: 1 }}
                                    transition={SPRING_SNAPPY}
                                    className={`relative flex-1 max-w-[140px] h-full rounded-sm border-t border-white/10 bg-[#1e1e1e] shadow-[0_5px_0_#000,0_10px_24px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center transition-all ${!canTransport ? 'opacity-10 pointer-events-none' : ''}`}
                                    onClick={() => dispatch({ type: 'CUE_MASTER', deckId: id })}
                                    disabled={!canTransport}
                                >
                                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/5 opacity-50" />
                                    <span className="text-[14px] font-mono font-black italic text-text-primary tracking-[0.25em] mb-1">CUE</span>
                                </motion.button>
 
                                {/* PLAY (Dominant Center) */}
                                <motion.button
                                    whileHover={{ y: -3, filter: 'brightness(1.05)' }}
                                    whileTap={{ scale: 0.96, y: 2 }}
                                    transition={SPRING_BOUNCY}
                                    className={`relative flex-[2] h-full rounded-sm border-t transition-all duration-400 flex flex-col items-center justify-center group overflow-hidden
                                        ${!canTransport ? 'opacity-10 pointer-events-none' : ''}
                                        ${isPlaying ? 'border-signal-clipping/60 bg-[#450a0a] shadow-[0_0_50px_rgba(239,68,68,0.25),inset_0_0_30px_rgba(239,68,68,0.15)]' : 'border-white/20 bg-[#252525] shadow-[0_6px_0_#000,0_12px_28px_rgba(0,0,0,0.85)]'}
                                    `}
                                    onClick={() => dispatch({ type: 'TOGGLE_PLAY', deckId: id })}
                                    disabled={!canTransport}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <span className={`text-2xl font-mono font-black italic tracking-[0.4em] transition-all duration-300 ${isPlaying ? 'text-signal-clipping drop-shadow-[0_0_20px_#ef4444]' : 'text-white/90'}`}>
                                            {isPlaying ? 'PAUSE' : 'PLAY'}
                                        </span>
                                        <div className={`w-12 h-[3px] rounded-sm transition-all duration-500 ${isPlaying ? 'bg-signal-clipping shadow-[0_0_15px_#ef4444]' : 'bg-white/10'}`} />
                                    </div>
                                    
                                    {/* Glass reflection effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none opacity-20" />
                                </motion.button>
 
                                {/* SYNC */}
                                <motion.button
                                    whileHover={{ y: -2, filter: 'brightness(1.1)' }}
                                    whileTap={{ scale: 0.94, y: 1 }}
                                    transition={SPRING_SNAPPY}
                                    className={`relative flex-1 max-w-[140px] h-full rounded-sm border-t border-white/10 bg-[#1e1e1e] shadow-[0_5px_0_#000,0_10px_24px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center transition-all ${!canTransport ? 'opacity-10 pointer-events-none' : ''}`}
                                    onClick={() => dispatch({ type: 'SYNC_DECK', deckId: id })}
                                    disabled={!canTransport}
                                >
                                    <span className={`text-[12px] font-mono font-black italic tracking-[0.15em] transition-colors duration-300 ${isSynced ? 'text-signal-sync drop-shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'text-white/30'}`}>SYNC</span>
                                    <div className={`mt-3 w-2 h-2 rounded-full transition-all duration-400 ${isSynced ? 'bg-signal-sync shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse' : 'bg-white/5'}`} />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PITCH Sidebar (Sibling to Performance Area) */}
                <div className={`w-14 bg-[#0a0a0a] relative flex flex-col z-20 shrink-0 select-none ${id === 'B' ? 'border-r' : 'border-l'} border-white/5`}>
                    {/* BPM Readout Header */}
                    <div className="h-10 w-full flex flex-col items-center justify-center border-b border-white/5 bg-canvas shadow-sm">
                        <span className="text-[7px] font-bold text-text-secondary tracking-widest mb-[1px]">BPM</span>
                        <span className={`text-[11px] font-mono leading-none tracking-tight ${Math.abs(pitch) > 0.001 ? 'text-signal-nominal' : 'text-white'}`}>
                            {track ? (track.bpm * (1 + (pitch * pitchRange))).toFixed(2) : '0.00'}
                        </span>
                    </div>

                    {/* Range Selector */}
                    <button onClick={cyclePitchRange} className="h-5 w-full flex items-center justify-center text-[7px] font-mono text-text-secondary hover:text-white border-b border-white/5 bg-surface-idle/50 hover:bg-surface-active" title="Toggle Pitch Range">±{(pitchRange * 100).toFixed(0)}%</button>

                    {/* Fader Track Area */}
                    <div className="flex-1 relative flex justify-center py-4">
                        <div className="absolute inset-0 bg-[#080808]" />
                        <div className={`absolute inset-y-4 w-full flex flex-col justify-between pointer-events-none opacity-40 ${id === 'B' ? 'left-0 items-start' : 'right-0 items-end'}`}>{[...Array(21)].map((_, i) => <div key={i} className={`h-[1px] bg-white ${i % 5 === 0 ? 'w-full opacity-80' : 'w-1/3 opacity-40'}`} />)}</div>
                        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/20 -translate-y-1/2" />
                        <div className={`absolute top-1/2 w-2 h-[2px] bg-white -translate-y-1/2 shadow-[0_0_5px_rgba(255,255,255,0.5)] ${id === 'B' ? 'left-0' : 'right-0'}`} />
                        <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-[2px] bg-surface-idle border-x border-white/5 rounded-full" />

                        {/* Hardware Accelerated Pitch Handle */}
                        <div
                            className={`absolute left-0 right-0 z-20 pointer-events-none shadow-xl flex items-center justify-center ${!track ? 'opacity-50' : ''} tactile-fader-cap will-change-transform transform-gpu transition-transform duration-75 ease-out`}
                            style={{
                                top: `calc(1rem + ${pitchPct} * (100% - 2rem))`,
                                transform: 'translateY(-50%)'
                            }}
                        >
                            <div className="w-full h-[1px] bg-white/20 mb-[2px]" />
                            <div className="w-full h-[1px] bg-signal-nominal shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                            <div className="w-full h-[1px] bg-white/20 mt-[2px]" />
                        </div>
                        <div
                            onMouseDown={handlePitchMouseDown}
                            onDoubleClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: 0 })}
                            className={`absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-30 ${!track ? 'pointer-events-none' : ''}`}
                        />
                    </div>

                    {/* Pitch Bend Buttons */}
                    <div className="h-10 w-full flex border-t border-white/5 bg-canvas">
                        <button
                            className="flex-1 border-r border-white/5 hover:bg-white/10 text-white opacity-60 hover:opacity-100 flex items-center justify-center transition-all disabled:opacity-20"
                            disabled={!track}
                            onClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: Math.max(-1, pitch - 0.005) })}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
                        </button>
                        <button
                            className="flex-1 hover:bg-white/10 text-white opacity-60 hover:opacity-100 flex items-center justify-center transition-all disabled:opacity-20"
                            disabled={!track}
                            onClick={() => dispatch({ type: 'SET_PITCH', deckId: id, value: Math.min(1, pitch + 0.005) })}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deck;
