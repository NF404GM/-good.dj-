import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CrossfaderProps {
    value?: number;
    onChange?: (val: number) => void;
}

export const Crossfader: React.FC<CrossfaderProps> = ({ value = 50, onChange }) => {
    
    // Spring-based motion for the premium "WWDC" feel
    const springValue = useSpring(value, {
        stiffness: 400,
        damping: 35,
        mass: 0.5
    });

    React.useEffect(() => {
        springValue.set(value);
    }, [value, springValue]);

    const left = useTransform(springValue, (v) => `clamp(40px, ${v}%, calc(100% - 40px))`);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(Number(e.target.value));
    };

    // Calculate Opacity for A and B indicators
    const opacityA = value < 50 ? 1 : 1 - ((value - 50) / 50);
    const opacityB = value > 50 ? 1 : 1 - ((50 - value) / 50);

    return (
        <div className="w-full h-24 flex items-center justify-center px-8 relative shrink-0 group select-none bg-black/20 border-t border-white/5">
            
            {/* BRAVO UNIT DECAL - TECHNICAL SPEC */}
            <div className="absolute top-1 left-8 opacity-10 font-mono text-[6px] tracking-[0.2em] flex gap-4 uppercase">
                <span>Ref-ID: X-FADER-9002</span>
                <div className="flex gap-1 items-center">
                    <div className="w-1 h-1 rounded-full bg-signal-sync" />
                    <span>Linear-Curve Opt</span>
                </div>
            </div>

            <div className="flex items-center gap-6 w-full max-w-2xl relative">

                {/* Deck A Indicator Cluster */}
                <div className="flex flex-col items-center gap-2 min-w-[30px]">
                    <div 
                        className="text-[11px] font-mono font-black transition-all duration-200"
                        style={{ color: value < 55 ? 'var(--color-signal-sync)' : 'rgba(255,255,255,0.1)', opacity: opacityA }}
                    >
                        UNIT A
                    </div>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                </div>

                {/* Fader Track - Industrial "The Rails" */}
                <div className="flex-1 h-14 relative bg-[#050505] rounded-xs border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] overflow-hidden">
                    
                    {/* Industrial Rails (Metal Finish) */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] flex flex-col justify-between opacity-30 px-2 pointer-events-none">
                        <div className="w-full h-[0.5px] bg-white/20" />
                        <div className="w-full h-[0.5px] bg-white/20 mt-1" />
                    </div>

                    {/* Technical Mix Curve Visualizer (The "X") */}
                    <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" preserveAspectRatio="none">
                        <line x1="0" y1="100%" x2="100%" y2="0" stroke="white" strokeWidth="1" />
                        <line x1="0" y1="0" x2="100%" y2="100%" stroke="white" strokeWidth="1" />
                        {/* High-density grid lines */}
                        {[10, 20, 30, 40, 60, 70, 80, 90].map(pos => (
                            <line key={pos} x1={`${pos}%`} y1="0" x2={`${pos}%`} y2="100%" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" />
                        ))}
                    </svg>

                    {/* Background Glows for L/R Balance */}
                    <div className="absolute inset-0 pointer-events-none flex">
                        <div 
                            className="flex-1 bg-gradient-to-r from-signal-sync/10 to-transparent transition-opacity duration-300"
                            style={{ opacity: opacityA * 0.4 }}
                        />
                        <div 
                            className="flex-1 bg-gradient-to-l from-signal-sync/10 to-transparent transition-opacity duration-300"
                            style={{ opacity: opacityB * 0.4 }}
                        />
                    </div>

                    {/* Center Calibration Point */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10 -translate-x-1/2 z-10" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 p-[2px] bg-[#050505] border border-white/10 rounded-full mt-[-2px]">
                        <div className="w-1 h-1 rounded-full bg-signal-sync/60 shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                    </div>

                    {/* Calibrated Scale Ticks */}
                    <div className="absolute bottom-0 inset-x-0 h-4 flex justify-between px-2 opacity-20 items-end">
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pos => (
                            <div key={pos} className={`w-[1px] ${pos % 50 === 0 ? 'h-3' : 'h-1.5'} bg-white`} />
                        ))}
                    </div>

                    {/* The Rail Handle (Animated with Springs) */}
                    <motion.div
                        className="absolute top-0 bottom-0 w-20 z-20 pointer-events-none will-change-transform transform-gpu"
                        style={{
                            left,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {/* Physical Grip Cap - Solid Drawing Principle */}
                        <div className="absolute inset-y-1 inset-x-1 bg-[#1a1a1a] rounded-sm border border-white/20 shadow-[0_10px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden">
                            {/* Texture: Rubberized Grip Ribs */}
                            <div className="flex gap-[4px] opacity-40">
                                <div className="w-[1.5px] h-6 bg-white rounded-full shadow-inner" />
                                <div className="w-[1.5px] h-6 bg-white rounded-full shadow-inner" />
                                <div className="w-[1.5px] h-6 bg-white rounded-full shadow-inner" />
                                <div className="w-[1.5px] h-6 bg-white rounded-full shadow-inner" />
                            </div>

                            {/* Center Active Indicator Line (Laser Cut) */}
                            <div className="absolute inset-x-0 h-[2px] bg-signal-sync top-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(59,130,246,1)] z-10" />
                            
                            {/* Inner Side Shadows for Depth */}
                            <div className="absolute inset-y-0 left-0 w-2 bg-black/40 blur-[1px]" />
                            <div className="absolute inset-y-0 right-0 w-2 bg-black/40 blur-[1px]" />
                        </div>
                    </motion.div>

                    {/* Active Input Overlay */}
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={value}
                        onChange={handleChange}
                        onDoubleClick={() => onChange?.(50)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                        title="Crossfader: Double-click to Reset"
                    />
                </div>

                {/* Deck B Indicator Cluster */}
                <div className="flex flex-col items-center gap-2 min-w-[30px]">
                    <div 
                        className="text-[11px] font-mono font-black transition-all duration-200"
                        style={{ color: value > 45 ? 'var(--color-signal-sync)' : 'rgba(255,255,255,0.1)', opacity: opacityB }}
                    >
                        UNIT B
                    </div>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                </div>

            </div>

            {/* UNIT SERIAL MARKER */}
            <div className="absolute bottom-1 right-8 opacity-10 font-mono text-[6px] tracking-[0.2em] flex gap-4 uppercase">
                <span>Maglev Rail System v4.0</span>
                <span>MFG Date: 2026.Q1</span>
            </div>
        </div>
    );
};
