import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CrossfaderProps {
    value?: number;
    onChange?: (val: number) => void;
}

function getMixLabel(value: number) {
    if (value <= 5) return 'A HARD';
    if (value >= 95) return 'B HARD';
    if (value < 40) return 'A LEAN';
    if (value > 60) return 'B LEAN';
    return 'CENTER';
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
        (current) => `clamp(42px, ${current}%, calc(100% - 42px))`
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(Number(e.target.value));
    };

    const deckAOpacity = value < 50 ? 1 : 1 - ((value - 50) / 50);
    const deckBOpacity = value > 50 ? 1 : 1 - ((50 - value) / 50);

    return (
        <div className="surface-panel flex h-20 w-full items-center px-6 py-3">
            <div className="flex w-full items-center gap-5">
                <div className="flex min-w-[52px] flex-col items-center gap-1">
                    <span
                        className="font-mono text-[9px] font-black uppercase tracking-[0.22em] transition-colors"
                        style={{
                            color: value <= 52 ? 'var(--color-signal-sync)' : 'var(--color-text-secondary)',
                            opacity: deckAOpacity,
                        }}
                    >
                        Deck A
                    </span>
                    <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                </div>

                <div className="relative flex-1">
                    <div className="relative h-14 overflow-hidden rounded-panel border border-white/8 bg-black/45 shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]">
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_34%,transparent_66%,rgba(255,255,255,0.02))]" />
                        <div className="absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/8" />
                        <div className="absolute inset-x-3 top-1/2 h-[1px] -translate-y-1/2 rounded-full bg-white/12" />
                        <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/12" />

                        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-1/2 items-center">
                            <div
                                className="h-8 w-full bg-gradient-to-r from-signal-sync/18 to-transparent"
                                style={{ opacity: deckAOpacity * 0.55 }}
                            />
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center">
                            <div
                                className="h-8 w-full bg-gradient-to-l from-signal-sync/18 to-transparent"
                                style={{ opacity: deckBOpacity * 0.55 }}
                            />
                        </div>

                        <div className="pointer-events-none absolute inset-x-4 bottom-2 flex items-end justify-between">
                            {Array.from({ length: 11 }).map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-px bg-white/18 ${index === 5 ? 'h-4' : index % 2 === 0 ? 'h-2.5' : 'h-2'}`}
                                />
                            ))}
                        </div>

                        <motion.div
                            className="pointer-events-none absolute inset-y-1 z-10 w-[84px] will-change-transform"
                            style={{
                                left: handleLeft,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            <div className="flex h-full items-center justify-center rounded-btn-lg border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(0,0,0,0.28))] shadow-[0_14px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
                                <div className="absolute inset-y-2 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-signal-sync shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                                <div className="flex gap-1 opacity-55">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div key={index} className="h-6 w-[2px] rounded-full bg-white/40" />
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={value}
                            onChange={handleChange}
                            onDoubleClick={() => onChange?.(50)}
                            className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                            title="Crossfader. Double-click to return to center."
                            aria-label="Crossfader"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(value)}
                            aria-valuetext={getMixLabel(value)}
                        />
                    </div>
                </div>

                <div className="flex min-w-[108px] flex-col items-center gap-1">
                    <span className="font-mono text-[8px] font-black uppercase tracking-[0.24em] text-text-secondary">
                        {getMixLabel(value)}
                    </span>
                    <span className="font-mono text-[12px] font-bold tracking-[0.16em] text-text-primary">
                        {value.toFixed(0)}%
                    </span>
                </div>

                <div className="flex min-w-[52px] flex-col items-center gap-1">
                    <span
                        className="font-mono text-[9px] font-black uppercase tracking-[0.22em] transition-colors"
                        style={{
                            color: value >= 48 ? 'var(--color-signal-sync)' : 'var(--color-text-secondary)',
                            opacity: deckBOpacity,
                        }}
                    >
                        Deck B
                    </span>
                    <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                </div>
            </div>
        </div>
    );
};
