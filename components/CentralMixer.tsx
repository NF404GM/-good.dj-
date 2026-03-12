import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalDjState, DeckAction, EffectType, StemType } from '../types';
import { VUMeter, VerticalFader } from './StemControl';
import { Crossfader } from './Crossfader';
import { TechnicalKnob } from './Deck';

interface CentralMixerProps {
    state: GlobalDjState;
    dispatch: React.Dispatch<DeckAction>;
}

export const CentralMixer: React.FC<CentralMixerProps> = ({ state, dispatch }) => {

    const renderDeckColumn = (deckId: 'A' | 'B') => {
        const deckState = state.decks[deckId];
        const eq = deckState.eq;
        const fx = deckState.fx;

        const getFxLabels = () => {
            switch (fx.activeType) {
                case EffectType.DELAY: return ['TIME', 'FDBK'];
                case EffectType.REVERB: return ['DECAY', 'TONE'];
                case EffectType.ECHO: return ['TIME', 'FDBK'];
                case EffectType.GATER: return ['RATE', 'DEPTH'];
                default: return ['PARAM 1', 'PARAM 2'];
            }
        };
        const [fxLabel1, fxLabel2] = getFxLabels();

        return (
            <div className="flex-1 flex min-w-0 relative divide-x divide-white/10 h-full">
                {/* 1. EQ Column */}
                <div className="flex-[1.1] flex flex-col items-center justify-between py-2 min-w-0 bg-[#0a0a0a] px-1 rounded-sm border border-white/5 shadow-inner">
                    <div className="w-full flex items-center justify-between px-2 mb-1.5 opacity-40">
                        <span className="text-[6px] font-mono font-black tracking-[0.2em]">{deckId} UNIT</span>
                        <div className="w-1 h-1 rounded-full bg-white/20" />
                    </div>

                    <TechnicalKnob value={eq.trim} onChange={(v) => dispatch({ type: 'SET_EQ', deckId, band: 'trim', value: v })} label="TRIM" size={30} displayValue={`${((eq.trim - 0.5) * 24).toFixed(1)}dB`} />
                    <div className="w-full px-2 my-1"><div className="h-[1px] bg-white/5" /></div>
                    
                    <TechnicalKnob value={eq.high} onChange={(v) => dispatch({ type: 'SET_EQ', deckId, band: 'high', value: v })} label="HI" size={28} displayValue={`${((eq.high - 0.5) * 12).toFixed(1)}dB`} bipolar color="var(--color-signal-nominal)" />
                    <TechnicalKnob value={eq.mid} onChange={(v) => dispatch({ type: 'SET_EQ', deckId, band: 'mid', value: v })} label="MID" size={28} displayValue={`${((eq.mid - 0.5) * 12).toFixed(1)}dB`} bipolar color="var(--color-signal-nominal)" />
                    <TechnicalKnob value={eq.low} onChange={(v) => dispatch({ type: 'SET_EQ', deckId, band: 'low', value: v })} label="LOW" size={28} displayValue={`${((eq.low - 0.5) * 12).toFixed(1)}dB`} bipolar color="var(--color-signal-nominal)" />

                    {/* Industrial Kill Switches */}
                    <div className="flex gap-1 mt-2 mb-1">
                        {['low', 'mid', 'high'].map(band => (
                            <motion.button
                                key={band}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9, y: 1 }}
                                onClick={() => dispatch({ type: 'SET_EQ', deckId, band: band as any, value: eq[band as keyof typeof eq] === 0 ? 0.5 : 0 })}
                                className={`w-6 h-4 rounded-xs border transition-all duration-150 flex items-center justify-center relative overflow-hidden ${eq[band as keyof typeof eq] === 0 ? 'bg-signal-clipping border-signal-clipping shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'bg-black border-white/10 hover:border-white/20'}`}
                                title={`Kill ${band.toUpperCase()}`}
                            >
                                <div className={`absolute top-0 left-0 right-0 h-[1.5px] ${eq[band as keyof typeof eq] === 0 ? 'bg-white/40' : 'bg-white/5'}`} />
                                <span className={`text-[7px] font-mono font-black ${eq[band as keyof typeof eq] === 0 ? 'text-white' : 'text-white/20'}`}>{band[0].toUpperCase()}</span>
                                
                                {/* Secondary Action: Kill Flash */}
                                <AnimatePresence>
                                    {eq[band as keyof typeof eq] === 0 && (
                                        <motion.div 
                                            initial={{ opacity: 0.6, scale: 0.5 }}
                                            animate={{ opacity: 0, scale: 2 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 bg-white pointer-events-none"
                                        />
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        ))}
                    </div>

                    <div className="w-full px-2 mt-2 mb-1"><div className="h-[1px] bg-white/10" /></div>
                    <TechnicalKnob value={deckState.color} onChange={(v) => dispatch({ type: 'SET_COLOR_FILTER', deckId, value: v })} label="FILTER" color="var(--color-signal-sync)" size={32} bipolar />
                </div>

                {/* 2. FX Column */}
                <div className="flex-[1] flex flex-col items-center py-2 min-w-0 px-1 bg-[#0c0c0c] pb-3 rounded-sm border border-white/5">
                    <div className="w-full flex items-center justify-center mb-2 px-1">
                        <span className="text-[6px] font-mono font-black text-white/10 tracking-[0.4em] uppercase">FX ENGINE</span>
                    </div>

                    <div className="grid grid-cols-2 w-full gap-1 mb-2 px-1">
                        {Object.values(EffectType).map(fxType => (
                            <button
                                key={fxType}
                                onClick={() => dispatch({ type: 'SET_FX_TYPE', deckId, effectType: fxType })}
                                className={`text-[7px] font-mono font-black py-1 text-center rounded-xs transition-all border ${fx.activeType === fxType ? 'bg-signal-sync/20 text-signal-sync border-signal-sync/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-black text-white/20 border-white/5 hover:border-white/20'}`}
                            >
                                {fxType.substring(0, 3)}
                            </button>
                        ))}
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95, y: 1 }}
                        className={`w-[90%] h-6 mb-3 rounded-xs text-[9px] font-mono font-black uppercase transition-all duration-150 border flex flex-col items-center justify-center relative overflow-hidden ${fx.active ? 'bg-signal-clipping text-white border-signal-clipping shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-black text-white/10 border-white/5'}`}
                        onClick={() => dispatch({ type: 'TOGGLE_FX', deckId })}
                    >
                        <div className={`absolute top-0 left-0 right-0 h-[1.5px] ${fx.active ? 'bg-white/40' : 'bg-white/5'}`} />
                        <span>{fx.active ? 'ACTIVE' : 'BYPASS'}</span>
                        
                        {/* Secondary Action: FX Flash */}
                        <AnimatePresence>
                            {fx.active && (
                                <motion.div 
                                    initial={{ opacity: 0.4, scale: 0.8 }}
                                    animate={{ opacity: 0, scale: 1.2 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-white pointer-events-none"
                                />
                            )}
                        </AnimatePresence>
                    </motion.button>

                    <div className="flex flex-col gap-2 w-full items-center">
                        <TechnicalKnob value={fx.knob1} onChange={(v) => dispatch({ type: 'SET_FX_PARAM', deckId, knob: 1, value: v })} label={fxLabel1} size={26} displayValue={`${(fx.knob1 * 100).toFixed(0)}%`} />
                        <TechnicalKnob value={fx.knob2} onChange={(v) => dispatch({ type: 'SET_FX_PARAM', deckId, knob: 2, value: v })} label={fxLabel2} size={26} displayValue={`${(fx.knob2 * 100).toFixed(0)}%`} />
                        <div className="w-8 h-[1px] bg-white/5 my-1" />
                        <TechnicalKnob value={fx.wet} onChange={(v) => dispatch({ type: 'SET_FX_WET', deckId, value: v })} label="DRY/WET" color="var(--color-signal-sync)" size={28} displayValue={`${(fx.wet * 100).toFixed(0)}%`} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-[420px] shrink-0 flex flex-col bg-[#080808] border-x border-white/10 px-1 relative shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {/* BRAVO UNIT TOP DECAL */}
            <div className="h-6 flex items-center justify-between px-4 border-b border-white/5 opacity-20">
                <span className="text-[7px] font-mono font-black tracking-[0.5em] uppercase">Master Control Unit Alpha-9</span>
                <div className="flex gap-4">
                    <span className="text-[7px] font-mono">SYSTEM: [ OK ]</span>
                    <span className="text-[7px] font-mono">LINK: [ ACTIVE ]</span>
                </div>
            </div>

            {/* MAIN MIXER RACK */}
            <div className="flex-1 flex gap-2 p-1 bg-transparent min-h-0 pt-3 pb-3">
                {/* DECK A controls */}
                <div className="flex-1 min-w-0 border border-white/10 shadow-huge rounded-sm bg-black/40 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-white/10 to-transparent" />
                    {renderDeckColumn('A')}
                </div>

                {/* MASTER METERS SECTION */}
                <div className="w-10 shrink-0 bg-[#050505] border border-white/10 rounded-sm flex flex-col p-1 shadow-2xl relative">
                    {/* Meter Decals */}
                    <div className="absolute inset-y-4 left-0 w-full flex flex-col justify-between px-1 pointer-events-none opacity-10">
                        {[...Array(10)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white" />)}
                    </div>
                    
                    <div className="flex-1 flex gap-1.5 bg-black/80 border border-white/5 rounded-xs p-1 justify-center relative overflow-hidden shadow-inner">
                        {/* High-Precision Peak Markers */}
                        <div className="absolute top-[8%] left-1 right-1 h-[1px] bg-signal-clipping/60 shadow-[0_0_5px_#ef4444] z-20" />
                        <div className="absolute top-[30%] left-1 right-1 h-[1px] bg-white/20 z-20" />
                        
                        <VUMeter level={state.decks.A.level} className="w-2 h-full rounded-none" />
                        <VUMeter level={state.decks.B.level} className="w-2 h-full rounded-none" />
                    </div>

                    <div className="mt-2 flex flex-col items-center gap-1">
                        <span className="text-[6px] font-mono font-black text-white/20 rotate-180 [writing-mode:vertical-lr]">MASTER</span>
                    </div>
                </div>

                {/* DECK B controls */}
                <div className="flex-1 min-w-0 border border-white/10 shadow-huge rounded-sm bg-black/40 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-white/10 to-transparent" />
                    {renderDeckColumn('B')}
                </div>
            </div>

            {/* PERSISTENT FOOTER (Volume Cluster) */}
            <div className="h-[140px] shrink-0 bg-[#060606] border-t border-white/10 shadow-[0_-12px_24px_rgba(0,0,0,0.6)] flex justify-around items-center p-3 px-8 rounded-t-sm relative overflow-hidden">
                {/* Visual Flair: Bottom Decals */}
                <div className="absolute bottom-1 left-4 opacity-10 font-mono text-[7px] tracking-[0.3em]">UNIT SERIAL #DJ-MCU-9002</div>
                
                {/* Deck A Vol */}
                <div className="w-16 h-full flex flex-col items-center">
                    <div className="flex-1 w-full flex justify-center py-2">
                        <VerticalFader value={state.decks.A.channelVolume} onChange={(v) => dispatch({ type: 'SET_CHANNEL_VOLUME', deckId: 'A', value: v })} label="CH A" color="var(--color-signal-nominal)" />
                    </div>
                </div>

                {/* Center Mixer Branding / Logo Unit */}
                <div className="flex flex-col items-center gap-3 select-none pointer-events-none py-4">
                    <div className="w-10 h-10 rounded-full border border-white/5 flex flex-col items-center justify-center p-1 relative overflow-hidden bg-black shadow-inner">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                        <span className="text-[6px] font-mono font-black text-white/20 tracking-tighter opacity-40">ALPHA</span>
                        <span className="text-[12px] font-mono font-black text-white italic tracking-tighter drop-shadow-md">MCU</span>
                        <span className="text-[6px] font-mono font-black text-signal-clipping tracking-widest mt-0.5">9-02</span>
                    </div>
                    <div className="w-[1px] h-6 bg-white/5" />
                    <span className="text-[8px] font-mono font-black tracking-[0.5em] text-white/10">GOOD.</span>
                </div>

                {/* Deck B Vol */}
                <div className="w-16 h-full flex flex-col items-center">
                    <div className="flex-1 w-full flex justify-center py-2">
                        <VerticalFader value={state.decks.B.channelVolume} onChange={(v) => dispatch({ type: 'SET_CHANNEL_VOLUME', deckId: 'B', value: v })} label="CH B" color="var(--color-signal-nominal)" />
                    </div>
                </div>
            </div>
        </div>
    );
};
