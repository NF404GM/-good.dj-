/**
 * Waveform Rendering Worker (OffscreenCanvas)
 * Persists canvas and state across messages.
 * Canvas is sent once via transferable; subsequent messages update state only.
 */

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

interface RenderState {
    data: any[] | null;
    progress: number;
    isPlaying: boolean;
    color: string;
    cuePoints: (number | null)[];
    loopRegion: { start: number; end: number } | null;
    width: number;
    height: number;
    dpr: number;
}

let state: RenderState = {
    data: null,
    progress: 0,
    isPlaying: false,
    color: '#3b82f6',
    cuePoints: [],
    loopRegion: null,
    width: 300,
    height: 100,
    dpr: 1
};

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;

    switch (msg.type) {
        case 'INIT':
            if (msg.canvas) {
                canvas = msg.canvas as OffscreenCanvas;
                ctx = canvas.getContext('2d', { alpha: true });
            }
            // Fallthrough to sync data and state
        case 'UPDATE_DATA':
        case 'UPDATE_STATE':
            if (msg.data !== undefined) state.data = msg.data;
            if (msg.color !== undefined) state.color = msg.color;
            if (msg.cuePoints !== undefined) state.cuePoints = msg.cuePoints;
            if (msg.loopRegion !== undefined) state.loopRegion = msg.loopRegion;
            if (msg.progress !== undefined) state.progress = msg.progress;
            if (msg.isPlaying !== undefined) state.isPlaying = msg.isPlaying;
            break;
        case 'RESIZE':
            if (msg.width !== undefined) state.width = msg.width;
            if (msg.height !== undefined) state.height = msg.height;
            if (msg.dpr !== undefined) state.dpr = msg.dpr;
            if (canvas) {
                canvas.width = state.width;
                canvas.height = state.height;
            }
            break;
    }

    if (!ctx) return;
    render();
};

function render() {
    if (!ctx || !canvas) return;

    const { data, progress, isPlaying, color, cuePoints, loopRegion, width, height } = state;

    const w = width;
    const h = height;
    const centerY = h / 2;
    const centerX = w / 2;

    const themeActiveColor = color || '#3b82f6';
    const themeIdleColor = '#1a1a1a';
    const playheadColor = '#ffffff';

    const CUE_COLORS = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    ctx.clearRect(0, 0, w, h);

    const barWidth = 2 * state.dpr;
    const barSpacing = 3 * state.dpr;
    const hasData = data && data.length > 0;

    const totalBars = hasData ? data!.length : Math.floor(w / barSpacing);
    const progressInBars = progress * totalBars;

    const visibleRange = Math.ceil(centerX / barSpacing) + 5;
    const startIdx = Math.max(0, Math.floor(progressInBars - visibleRange));
    const endIdx = Math.min(totalBars, Math.ceil(progressInBars + visibleRange));

    // --- LOOP REGION ---
    if (loopRegion && hasData) {
        const loopStartBar = loopRegion.start * totalBars;
        const loopEndBar = loopRegion.end * totalBars;
        const loopX1 = centerX + (loopStartBar - progressInBars) * barSpacing;
        const loopX2 = centerX + (loopEndBar - progressInBars) * barSpacing;

        if (loopX2 > 0 && loopX1 < w) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
            ctx.fillRect(loopX1, 0, loopX2 - loopX1, h);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
            if (loopX1 > 0 && loopX1 < w) ctx.fillRect(loopX1, 0, 2 * state.dpr, h);
            if (loopX2 > 0 && loopX2 < w) ctx.fillRect(loopX2 - (2 * state.dpr), 0, 2 * state.dpr, h);
        }
    }

    // --- WAVEFORM BARS ---
    for (let i = startIdx; i < endIdx; i++) {
        const x = centerX + (i - progressInBars) * barSpacing;
        const normalizedPos = i / totalBars;
        const isPast = normalizedPos < progress;

        if (hasData) {
            const point = data![i];
            if (typeof point === 'number') {
                const amplitude = Math.pow(point || 0.01, 0.8);
                const barHeight = amplitude * (h * 0.45);
                ctx.fillStyle = isPast ? themeActiveColor : themeIdleColor;
                ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
            } else if (point) {
                const { l, m, h: hv } = point;
                const hL = Math.pow(Math.max(l, 0.01), 0.8) * (h * 0.45);
                const hM = Math.pow(Math.max(m, 0.01), 0.8) * (h * 0.45);
                const hH = Math.pow(Math.max(hv, 0.01), 0.8) * (h * 0.45);

                ctx.globalCompositeOperation = 'lighter';
                const alpha = isPast ? 1 : 0.35;
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`; // Lows
                ctx.fillRect(x, centerY - hL, barWidth, hL * 2);
                ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`; // Mids
                ctx.fillRect(x, centerY - hM, barWidth, hM * 2);
                ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`; // Highs
                ctx.fillRect(x, centerY - hH, barWidth, hH * 2);
                ctx.globalCompositeOperation = 'source-over';
            }
        } else {
            const t = isPlaying ? Date.now() / 1000 : 0;
            const wave1 = Math.sin(normalizedPos * 20 + t) * 0.5;
            const wave2 = Math.cos(normalizedPos * 45 - t * 2) * 0.3;
            const envelope = Math.sin(normalizedPos * Math.PI);
            const amplitude = (Math.abs(wave1) + Math.abs(wave2)) * envelope * 0.4;
            const barHeight = Math.max(amplitude, 0.01) * (h * 0.45);
            ctx.fillStyle = isPast ? themeActiveColor : themeIdleColor;
            ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
        }
    }

    // --- HOT CUE MARKERS ---
    if (cuePoints && hasData) {
        for (let idx = 0; idx < cuePoints.length; idx++) {
            const cue = cuePoints[idx];
            if (cue === null) continue;
            const cueBar = cue * totalBars;
            const cueX = centerX + (cueBar - progressInBars) * barSpacing;
            if (cueX < -10 || cueX > w + 10) continue;
            const cueColor = CUE_COLORS[idx] || '#ffffff';

            ctx.globalAlpha = 0.7;
            ctx.fillStyle = cueColor;
            ctx.fillRect(cueX - (0.5 * state.dpr), 0, 1.5 * state.dpr, h);
            ctx.shadowBlur = 6 * state.dpr;
            ctx.shadowColor = cueColor;
            ctx.fillRect(cueX - (0.5 * state.dpr), 0, 1.5 * state.dpr, h);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            ctx.beginPath();
            ctx.moveTo(cueX - (4 * state.dpr), 0);
            ctx.lineTo(cueX + (4 * state.dpr), 0);
            ctx.lineTo(cueX, 7 * state.dpr);
            ctx.closePath();
            ctx.fillStyle = cueColor;
            ctx.fill();
        }
    }

    // --- PLAYHEAD ---
    ctx.fillStyle = playheadColor;
    ctx.fillRect(centerX, 0, 2 * state.dpr, h);
    ctx.shadowBlur = 15 * state.dpr;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
    ctx.fillRect(centerX - (0.5 * state.dpr), 0, 3 * state.dpr, h);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(centerX - (6 * state.dpr), 0);
    ctx.lineTo(centerX + (6 * state.dpr), 0);
    ctx.lineTo(centerX, 8 * state.dpr);
    ctx.fillStyle = playheadColor;
    ctx.fill();
}
