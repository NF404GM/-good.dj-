/**
 * Waveform Rendering Worker (OffscreenCanvas)
 * Persists canvas and state across messages.
 * Canvas is sent once via transferable; subsequent messages update state only.
 */

let canvas = null;
let ctx = null;
let state = {
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

self.onmessage = (e) => {
    const msg = e.data;

    // First message includes the OffscreenCanvas via transferable
    if (msg.canvas) {
        canvas = msg.canvas;
        ctx = canvas.getContext('2d', { alpha: true });
    }

    if (!ctx) return;

    // Merge incoming values into persisted state
    if (msg.width !== undefined) state.width = msg.width;
    if (msg.height !== undefined) state.height = msg.height;
    if (msg.dpr !== undefined) state.dpr = msg.dpr;
    if (msg.data !== undefined) state.data = msg.data;
    if (msg.progress !== undefined) state.progress = msg.progress;
    if (msg.isPlaying !== undefined) state.isPlaying = msg.isPlaying;
    if (msg.color !== undefined) state.color = msg.color;
    if (msg.cuePoints !== undefined) state.cuePoints = msg.cuePoints;
    if (msg.loopRegion !== undefined) state.loopRegion = msg.loopRegion;

    // Resize the OffscreenCanvas pixel buffer when dimensions change
    if (msg.width !== undefined || msg.height !== undefined) {
        canvas.width = state.width;
        canvas.height = state.height;
    }

    render();
};

function render() {
    if (!ctx || !canvas) return;

    const { data, progress, isPlaying, color, cuePoints, loopRegion, width, height } = state;

    // The canvas pixel dimensions are already set to width*dpr x height*dpr
    // We draw in physical pixels, so all coordinates need to be in that space
    const w = width;
    const h = height;
    const centerY = h / 2;
    const centerX = w / 2;

    const themeActiveColor = color || 'var(--color-signal-sync)';
    const themeIdleColor = '#1a1a1a';
    const playheadColor = '#ffffff'; // Stark white playhead for maximum contrast in good. mode

    const CUE_COLORS = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    ctx.clearRect(0, 0, w, h);

    // --- RENDERING CONFIG ---
    const barWidth = 2;
    const barSpacing = 3;
    const hasData = data && data.length > 0;

    const totalBars = hasData ? data.length : Math.floor(w / barSpacing);
    const progressInBars = progress * totalBars;

    // Visible range — only draw bars that are on screen
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
            if (loopX1 > 0 && loopX1 < w) ctx.fillRect(loopX1, 0, 2, h);
            if (loopX2 > 0 && loopX2 < w) ctx.fillRect(loopX2 - 2, 0, 2, h);
        }
    }

    // --- WAVEFORM BARS ---
    for (let i = startIdx; i < endIdx; i++) {
        const x = centerX + (i - progressInBars) * barSpacing;
        const normalizedPos = i / totalBars;
        const isPast = normalizedPos < progress;

        if (hasData) {
            const point = data[i];
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
            // Idle animation when no track is loaded
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

            // Vertical line
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = cueColor;
            ctx.fillRect(cueX - 0.5, 0, 1.5, h);
            ctx.shadowBlur = 6;
            ctx.shadowColor = cueColor;
            ctx.fillRect(cueX - 0.5, 0, 1.5, h);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // Triangle marker at top
            ctx.beginPath();
            ctx.moveTo(cueX - 4, 0);
            ctx.lineTo(cueX + 4, 0);
            ctx.lineTo(cueX, 7);
            ctx.closePath();
            ctx.fillStyle = cueColor;
            ctx.fill();
        }
    }

    // --- PLAYHEAD (center line) ---
    ctx.fillStyle = playheadColor;
    ctx.fillRect(centerX, 0, 2, h);
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
    ctx.fillRect(centerX - 0.5, 0, 3, h);
    ctx.shadowBlur = 0;

    // Playhead triangle
    ctx.beginPath();
    ctx.moveTo(centerX - 6, 0);
    ctx.lineTo(centerX + 6, 0);
    ctx.lineTo(centerX, 8);
    ctx.fillStyle = playheadColor;
    ctx.fill();
}
