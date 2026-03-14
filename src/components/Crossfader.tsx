import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CrossfaderProps {
    value?: number;
    onChange?: (val: number) => void;
}

export const Crossfader: React.FC<CrossfaderProps> = ({ value = 50, onChange }) => {
    const springValue = useSpring(value, {
        stiffness: 420,
        damping: 38,
        mass: 0.55,
    });

    React.useEffect(() => {
        springValue.set(value);
    }, [springValue, value]);

    const handleLeft = useTransform(
        springValue,
        (current) => `clamp(20px, ${current}%, calc(100% - 20px))`
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(Number(e.target.value));
    };

    return (
        <div className="flex h-10 w-full items-center justify-center gap-4 px-6">
            {/* A/B label left */}
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                A/B
            </span>

            {/* Slider track */}
            <div className="relative flex-1 max-w-[400px]">
                <div className="relative h-6 overflow-hidden rounded-[4px] border border-white/8 bg-black/40">
                    {/* Center tick */}
                    <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-white/12" />

                    {/* Track line */}
                    <div className="absolute inset-x-2 top-1/2 h-[1px] -translate-y-1/2 bg-white/10" />

                    {/* Handle */}
                    <motion.div
                        className="pointer-events-none absolute inset-y-0.5 z-10 w-10"
                        style={{
                            left: handleLeft,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <div className="flex h-full items-center justify-center rounded-[3px] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(0,0,0,0.3))]">
                            <div className="absolute inset-y-1 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-white/50" />
                        </div>
                    </motion.div>

                    {/* Hidden range input */}
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={value}
                        onChange={handleChange}
                        onDoubleClick={() => onChange?.(50)}
                        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                        title="Crossfader. Double-click to center."
                        aria-label="Crossfader"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(value)}
                    />
                </div>
            </div>

            {/* A/B label right */}
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                A/B
            </span>
        </div>
    );
};
