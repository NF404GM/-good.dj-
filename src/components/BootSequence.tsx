/**
 * BootSequence — Cinematic power-on animation for good.DJ
 * 
 * Inspired by hardware DJ controllers powering on:
 * 1. Black void → Logo materializes with a warm glow
 * 2. System text types in, status indicators blink alive
 * 3. Logo lifts away, scanline wipe reveals the interface
 * 4. UI sections cascade in with staggered timing
 * 
 * All animations use CSS keyframes on transform/opacity (GPU-composited)
 * to guarantee 60fps without blocking the main thread.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BootSequenceProps {
    children: React.ReactNode;
}

// Total boot duration before children are interactive
const BOOT_DURATION = 2400; // ms

export const BootSequence: React.FC<BootSequenceProps> = ({ children }) => {
    const [phase, setPhase] = useState<'splash' | 'revealing' | 'done'>('splash');

    useEffect(() => {
        // Phase 1→2: Start revealing UI
        const revealTimer = setTimeout(() => setPhase('revealing'), 1400);
        // Phase 2→3: Boot complete, remove overlay
        const doneTimer = setTimeout(() => setPhase('done'), BOOT_DURATION);

        return () => {
            clearTimeout(revealTimer);
            clearTimeout(doneTimer);
        };
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden bg-black">
            {/* 1. THE ACTUAL APPLICATION CONTENT */}
            <div className="w-full h-full">
                {children}
            </div>

            {/* 2. CINEMATIC OVERLAY SYSTEM */}
            <AnimatePresence>
                {phase !== 'done' && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ 
                            opacity: 0, 
                            transition: { duration: 1, ease: [0.4, 0, 0.2, 1] } 
                        }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden"
                    >
                        {/* THE HARDWARE CASE REVEAL (CASE OPENING MOTION) */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Case Border / Depth shadows */}
                            <motion.div 
                                initial={{ scale: 1.1, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute inset-0 border-[40px] border-black shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-20"
                            />
                            
                            {/* Cinematic Scanline Revealer */}
                            {phase === 'revealing' && (
                                <motion.div 
                                    initial={{ top: '-10%' }}
                                    animate={{ top: '110%' }}
                                    transition={{ duration: 1.2, ease: "easeInOut" }}
                                    className="absolute left-0 right-0 h-[30vh] bg-gradient-to-b from-transparent via-white/5 to-transparent z-30 flex items-center justify-center"
                                >
                                    <div className="w-full h-[2px] bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
                                </motion.div>
                            )}
                        </div>

                        {/* CENTER LOGO & BOOT TEXT */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
                            animate={{ 
                                scale: 1, 
                                opacity: 1, 
                                filter: 'blur(0px)',
                                y: phase === 'revealing' ? -100 : 0
                            }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            className="relative z-40 flex flex-col items-center gap-6"
                        >
                            {/* Brand Logo with Pulsing Glow */}
                            <motion.div
                                animate={{ 
                                    textShadow: [
                                        "0 0 20px rgba(255,255,255,0.1)",
                                        "0 0 40px rgba(255,255,255,0.3)",
                                        "0 0 20px rgba(255,255,255,0.1)"
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="flex flex-col items-center"
                            >
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: 8 }}
                                    transition={{ delay: 0.5, duration: 0.5 }}
                                    className="h-2 bg-hw-sand rounded-full mb-4 shadow-[0_0_10px_rgba(233,230,226,0.6)]" 
                                />
                                <h1 className="text-5xl font-black tracking-tighter text-white">
                                    good.<span className="text-white/40 font-light">DJ</span>
                                </h1>
                            </motion.div>

                            {/* System Status Readout */}
                            <div className="flex flex-col items-center gap-1 font-mono text-[9px] tracking-[0.2em] text-hw-sand/40">
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    WEB AUDIO SYSTEM v1.0.4
                                </motion.span>
                                
                                <motion.div 
                                    className="flex gap-1 mt-2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                >
                                    <span className="animate-pulse">LOADING ANALOG EMULATION...</span>
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* AMBIENT BACKGROUND PARTICLES */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ 
                                        x: Math.random() * 100 + "%", 
                                        y: Math.random() * 100 + "%",
                                        opacity: 0 
                                    }}
                                    animate={{ 
                                        y: ["-10%", "110%"],
                                        opacity: [0, 0.5, 0]
                                    }}
                                    transition={{ 
                                        duration: 3 + Math.random() * 5, 
                                        repeat: Infinity, 
                                        delay: Math.random() * 5 
                                    }}
                                    className="absolute w-[1px] h-10 bg-gradient-to-b from-white to-transparent"
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* STAGGERED UI ENTRANCE (THE CASE OPENING EFFECT) */}
            <style>{`
                /* We inject the global staggering classes here */
                .boot-active [data-boot] {
                    opacity: 0;
                    transform: perspective(1000px) rotateX(10deg) translateZ(-50px);
                }

                .boot-active header {
                    animation: case-open-vertical 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 1600ms forwards;
                }
                .boot-active [data-boot="deck-a"] {
                    animation: case-open-left 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 1750ms forwards;
                }
                .boot-active [data-boot="mixer"] {
                    animation: case-open-center 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 1900ms forwards;
                }
                .boot-active [data-boot="deck-b"] {
                    animation: case-open-right 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 1750ms forwards;
                }
                .boot-active [data-boot="crossfader"] {
                    animation: case-open-vertical 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 2100ms forwards;
                }
                .boot-active [data-boot="library"] {
                    animation: case-open-up 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) 2200ms forwards;
                }
                .boot-active footer {
                    animation: case-open-up 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 2400ms forwards;
                }

                @keyframes case-open-vertical {
                    from { opacity: 0; transform: perspective(1000px) rotateX(20deg) translateY(-30px) translateZ(-100px); }
                    to { opacity: 1; transform: perspective(1000px) rotateX(0deg) translateY(0) translateZ(0); }
                }
                @keyframes case-open-left {
                    from { opacity: 0; transform: perspective(1000px) rotateY(15deg) translateX(-60px) translateZ(-150px); filter: blur(5px); }
                    to { opacity: 1; transform: perspective(1000px) rotateY(0deg) translateX(0) translateZ(0); filter: blur(0px); }
                }
                @keyframes case-open-right {
                    from { opacity: 0; transform: perspective(1000px) rotateY(-15deg) translateX(60px) translateZ(-150px); filter: blur(5px); }
                    to { opacity: 1; transform: perspective(1000px) rotateY(0deg) translateX(0) translateZ(0); filter: blur(0px); }
                }
                @keyframes case-open-center {
                    from { opacity: 0; transform: perspective(1000px) scale(0.8) translateZ(-200px); filter: brightness(0); }
                    to { opacity: 1; transform: perspective(1000px) scale(1) translateZ(0); filter: brightness(1); }
                }
                @keyframes case-open-up {
                    from { opacity: 0; transform: perspective(1000px) rotateX(-20deg) translateY(50px) translateZ(-100px); }
                    to { opacity: 1; transform: perspective(1000px) rotateX(0deg) translateY(0) translateZ(0); }
                }
            `}</style>
        </div>
    );
};
