import React from 'react';
import { DeckAction, GlobalDjState } from '../types';
import { VUMeter } from './StemControl';
import { TechnicalKnob } from './Deck';

interface CentralMixerProps {
    state: GlobalDjState;
    dispatch: React.Dispatch<DeckAction>;
}

/* ═══════════════════════════════════════════
   CENTRAL MIXER — Center column between decks
   Layout (top to bottom):
   - Deck A: Gain → EQ Hi/Mid/Lo → Channel Volume fader → VU
   - Divider
   - Deck B: Gain → EQ Hi/Mid/Lo → Channel Volume fader → VU
   ═══════════════════════════════════════════ */

/* Vertical channel fader — slim volume slider */
const ChannelFader: React.FC<{
    value: number;
    onChange: (v: number) => void;
    label: string;
}> = ({ value, onChange, label }) => {
    return (
        <div className="flex w-full flex-col items-center gap-1">
            <div className="relative h-[60px] w-3 overflow-hidden rounded-[3px] border border-white/10 bg-black/40">
                {/* Fill */}
                <div
                    className="absolute inset-x-0 bottom-0 rounded-b-[2px] bg-text-primary/60 transition-all duration-75"
                    style={{ height: `${value * 100}%` }}
                />
                {/* Hidden range input */}
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    onDoubleClick={() => onChange(0.8)}
                    className="absolute inset-0 z-10 h-full w-full cursor-ns-resize opacity-0"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
                    title={`${label} — Double-click to reset`}
                    aria-label={label}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(value * 100)}
                />
            </div>
            <span className="font-sans text-[7px] font-bold uppercase tracking-[0.08em] text-text-secondary">
                {label}
            </span>
        </div>
    );
};

export const CentralMixer: React.FC<CentralMixerProps> = ({ state, dispatch }) => {
    const deckA = state.decks.A;
    const deckB = state.decks.B;

    return (
        <div className="flex h-full w-[90px] shrink-0 flex-col items-center gap-0" role="group" aria-label="Mixer">

            {/* Main mixer body */}
            <div className="flex min-h-0 flex-1 w-full">

                {/* Left VU meter (Deck A) */}
                <div className="flex w-3 shrink-0 flex-col py-3 pl-1">
                    <VUMeter level={deckA.level} className="h-full w-full" />
                </div>

                {/* Center controls column */}
                <div className="flex flex-1 flex-col items-center justify-start gap-1 overflow-y-auto py-2 px-1">

                    {/* ─── DECK A SECTION ─── */}
                    {/* Gain A */}
                    <TechnicalKnob
                        value={deckA.eq.trim}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'A', band: 'trim', value })}
                        label="Gain"
                        size={28}
                        color="var(--color-text-primary)"
                        displayValue={`${((deckA.eq.trim - 0.5) * 24).toFixed(0)}dB`}
                    />

                    {/* EQ Hi A */}
                    <TechnicalKnob
                        value={deckA.eq.high}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'A', band: 'high', value })}
                        label="Hi"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* EQ Mid A */}
                    <TechnicalKnob
                        value={deckA.eq.mid}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'A', band: 'mid', value })}
                        label="Mid"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* EQ Lo A */}
                    <TechnicalKnob
                        value={deckA.eq.low}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'A', band: 'low', value })}
                        label="Lo"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* Channel Volume A */}
                    <ChannelFader
                        value={deckA.channelVolume}
                        onChange={(value) => dispatch({ type: 'SET_CHANNEL_VOLUME', deckId: 'A', value })}
                        label="Vol A"
                    />

                    {/* Filter A */}
                    <TechnicalKnob
                        value={deckA.color}
                        onChange={(value) => dispatch({ type: 'SET_COLOR_FILTER', deckId: 'A', value })}
                        label="Filt"
                        size={24}
                        color="var(--color-cyan)"
                        bipolar
                    />

                    {/* ─── DIVIDER ─── */}
                    <div className="my-1 h-px w-10 bg-white/10" />

                    {/* ─── DECK B SECTION ─── */}
                    {/* Filter B */}
                    <TechnicalKnob
                        value={deckB.color}
                        onChange={(value) => dispatch({ type: 'SET_COLOR_FILTER', deckId: 'B', value })}
                        label="Filt"
                        size={24}
                        color="var(--color-amber)"
                        bipolar
                    />

                    {/* Channel Volume B */}
                    <ChannelFader
                        value={deckB.channelVolume}
                        onChange={(value) => dispatch({ type: 'SET_CHANNEL_VOLUME', deckId: 'B', value })}
                        label="Vol B"
                    />

                    {/* EQ Hi B */}
                    <TechnicalKnob
                        value={deckB.eq.high}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'B', band: 'high', value })}
                        label="Hi"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* EQ Mid B */}
                    <TechnicalKnob
                        value={deckB.eq.mid}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'B', band: 'mid', value })}
                        label="Mid"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* EQ Lo B */}
                    <TechnicalKnob
                        value={deckB.eq.low}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'B', band: 'low', value })}
                        label="Lo"
                        size={24}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* Gain B */}
                    <TechnicalKnob
                        value={deckB.eq.trim}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'B', band: 'trim', value })}
                        label="Gain"
                        size={28}
                        color="var(--color-text-primary)"
                        displayValue={`${((deckB.eq.trim - 0.5) * 24).toFixed(0)}dB`}
                    />

                </div>

                {/* Right VU meter (Deck B) */}
                <div className="flex w-3 shrink-0 flex-col py-3 pr-1">
                    <VUMeter level={deckB.level} className="h-full w-full" />
                </div>

            </div>
        </div>
    );
};
