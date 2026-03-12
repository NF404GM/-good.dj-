import React, { useRef, useEffect, useCallback } from 'react';

interface TrackOverviewProps {
    data: any[]; // Works with both mono and spectral data
    progress: number;
    color: string;
    loopRegion?: { start: number; end: number } | null;
    cuePoints?: (number | null)[];
    duration?: number;
    onSeek: (position: number) => void;
}

// 8 distinct hot cue colors matching DJ hardware standards
const CUE_COLORS = [
    '#ef4444', // 1 - Red
    '#f97316', // 2 - Orange
    '#eab308', // 3 - Yellow
    '#22c55e', // 4 - Green
    '#06b6d4', // 5 - Cyan
    '#3b82f6', // 6 - Blue
    '#8b5cf6', // 7 - Purple
    '#ec4899', // 8 - Pink
];

export const TrackOverview: React.FC<TrackOverviewProps> = ({ data, progress, color, loopRegion, cuePoints, duration, onSeek }) => {
    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const lastDataRef = useRef<any[] | null>(null);

    // --- LAYER 1: Draw the static waveform (only when data changes) ---
    useEffect(() => {
        const canvas = waveformCanvasRef.current;
        if (!canvas || !data || data.length === 0) return;

        // Skip redraw if data reference hasn't changed
        if (lastDataRef.current === data) return;
        lastDataRef.current = data;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = '#0a0a0a'; // Ultra-deep matte for contrast
        ctx.fillRect(0, 0, width, height);

        const isSpectral = data[0] !== undefined && typeof data[0] !== 'number';

        // Center line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, height / 2, width, 1);

        if (isSpectral) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < width; i++) {
                const dataIdx = Math.floor((i / width) * data.length);
                const pt = data[dataIdx];
                if (!pt) continue;

                const hL = Math.min(1, pt.l * 1.5) * height * 0.4;
                const hM = Math.min(1, pt.m * 1.5) * height * 0.4;
                const hH = Math.min(1, pt.h * 1.5) * height * 0.4;

                const x = i;
                const centerY = height / 2;

                // Lows - Clipping Red (§7.4)
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.fillRect(x, centerY - hL, 1, hL * 2);

                // Mids - Nominal Green (§7.4)
                ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
                ctx.fillRect(x, centerY - hM, 1, hM * 2);

                // Highs - Sync Blue (§7.4)
                ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
                ctx.fillRect(x, centerY - hH, 1, hH * 2);
            }
            ctx.globalCompositeOperation = 'source-over';
        } else {
            // Fallback Mono Rendering
            ctx.fillStyle = 'rgba(191, 183, 173, 0.4)';
            for (let i = 0; i < width; i++) {
                const dataIdx = Math.floor((i / width) * data.length);
                const val = data[dataIdx] || 0;
                const h = val * height * 0.8;
                ctx.fillRect(i, (height - h) / 2, 1, h);
            }
        }
    }, [data]);

    // --- LAYER 2: Draw the lightweight progress overlay (runs every frame) ---
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Only resize if needed
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        if (!data || data.length === 0) return;

        // Dark overlay on unplayed portion
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(progress * width, 0, width - (progress * width), height);

    }, [data, progress]);

    const handleInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!data || data.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        onSeek(pct);
    };

    return (
        <div
            className="w-full h-8 relative cursor-crosshair border-b border-white/5 bg-canvas group shrink-0"
            onMouseDown={handleInteraction}
        >
            {/* Layer 1: Static waveform (redrawn only on data change) */}
            <canvas
                ref={waveformCanvasRef}
                className="w-full h-full absolute inset-0 block"
                style={{ imageRendering: 'pixelated' }}
            />
            {/* Layer 2: Progress overlay (lightweight, redrawn every frame) */}
            <canvas
                ref={overlayCanvasRef}
                className="w-full h-full absolute inset-0 block z-[1]"
            />

            {/* Loop Region Overlay */}
            {loopRegion && (
                <>
                    <div
                        className="absolute top-0 bottom-0 bg-signal-nominal/15 pointer-events-none z-[5] border-l-2 border-r-2 border-signal-nominal/60"
                        style={{
                            left: `${loopRegion.start * 100}%`,
                            width: `${(loopRegion.end - loopRegion.start) * 100}%`,
                        }}
                    />
                    {/* Loop IN marker */}
                    <div
                        className="absolute top-0 bottom-0 w-[2px] bg-signal-nominal shadow-[0_0_6px_rgba(var(--signal-nominal-rgb),0.6)] z-[6] pointer-events-none"
                        style={{ left: `${loopRegion.start * 100}%` }}
                    />
                    {/* Loop OUT marker */}
                    <div
                        className="absolute top-0 bottom-0 w-[2px] bg-signal-nominal shadow-[0_0_6px_rgba(var(--signal-nominal-rgb),0.6)] z-[6] pointer-events-none"
                        style={{ left: `${loopRegion.end * 100}%` }}
                    />
                </>
            )}

            {/* Hot Cue Markers */}
            {cuePoints && duration && duration > 0 && cuePoints.map((cue, idx) => {
                if (cue === null) return null;
                const pct = cue * 100; // cuePoints are already 0-1 progress values
                const cueColor = CUE_COLORS[idx] || '#ffffff';
                return (
                    <div key={idx} className="absolute top-0 z-[8] pointer-events-none" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                        {/* Triangle marker */}
                        <div style={{
                            width: 0, height: 0,
                            borderLeft: '4px solid transparent',
                            borderRight: '4px solid transparent',
                            borderTop: `6px solid ${cueColor}`,
                            filter: `drop-shadow(0 0 3px ${cueColor})`,
                        }} />
                        {/* Vertical line */}
                        <div className="w-[1px] h-full absolute top-[6px] left-1/2 -translate-x-1/2 opacity-50" style={{ backgroundColor: cueColor, height: '26px' }} />
                        {/* Number label */}
                        <div className="absolute top-[1px] left-1/2 -translate-x-1/2 text-[5px] font-black text-white pointer-events-none" style={{ textShadow: `0 0 3px ${cueColor}` }}>
                            {idx + 1}
                        </div>
                    </div>
                );
            })}

            {/* Playhead Marker */}
            {(data && data.length > 0) && (
                <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 pointer-events-none transition-[left] duration-75 ease-linear"
                    style={{ left: `${progress * 100}%`, transform: 'translateX(-50%)' }}
                />
            )}

            {/* Empty state */}
            {!data || data.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="text-[8px] font-mono tracking-widest text-text-secondary">NO OVERVIEW</span>
                </div>
            ) : null}
        </div>
    );
};
