import React from 'react';
import { DeckAction, GlobalDjState } from '../types';
import { VUMeter } from './StemControl';
import { TechnicalKnob } from './Deck';

interface CentralMixerProps {
    state: GlobalDjState;
    dispatch: React.Dispatch<DeckAction>;
}

/* ═══════════════════════════════════════════
   CENTRAL MIXER — Slim center column
   Reference layout: ~4 rotary knobs stacked vertically
   between two VU meter strips. No channel strips.
   ═══════════════════════════════════════════ */

export const CentralMixer: React.FC<CentralMixerProps> = ({ state, dispatch }) => {
    const deckA = state.decks.A;
    const deckB = state.decks.B;

    return (
        <div className="flex h-full w-[80px] shrink-0 flex-col items-center gap-0" role="group" aria-label="Mixer">

            {/* Main mixer body */}
            <div className="flex min-h-0 flex-1 w-full">

                {/* Left VU meter (Deck A) */}
                <div className="flex w-3 shrink-0 flex-col py-3 pl-1">
                    <VUMeter level={deckA.level} className="h-full w-full" />
                </div>

                {/* Center knobs column */}
                <div className="flex flex-1 flex-col items-center justify-start gap-2 py-3 px-1">

                    {/* Master / Gain knob — larger */}
                    <TechnicalKnob
                        value={deckA.eq.trim}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'A', band: 'trim', value })}
                        label="Gain A"
                        size={32}
                        color="var(--color-text-primary)"
                        displayValue={`${((deckA.eq.trim - 0.5) * 24).toFixed(0)}dB`}
                    />

                    {/* Filter/EQ knob for Deck A */}
                    <TechnicalKnob
                        value={deckA.color}
                        onChange={(value) => dispatch({ type: 'SET_COLOR_FILTER', deckId: 'A', value })}
                        label="Filt A"
                        size={28}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* Spacer line */}
                    <div className="my-1 h-px w-8 bg-white/8" />

                    {/* Filter/EQ knob for Deck B */}
                    <TechnicalKnob
                        value={deckB.color}
                        onChange={(value) => dispatch({ type: 'SET_COLOR_FILTER', deckId: 'B', value })}
                        label="Filt B"
                        size={28}
                        color="var(--color-signal-sync)"
                        bipolar
                    />

                    {/* Master / Gain knob for Deck B */}
                    <TechnicalKnob
                        value={deckB.eq.trim}
                        onChange={(value) => dispatch({ type: 'SET_EQ', deckId: 'B', band: 'trim', value })}
                        label="Gain B"
                        size={32}
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
