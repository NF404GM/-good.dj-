import React from 'react';
import { motion } from 'framer-motion';
import { DeckAction, EffectType, GlobalDjState } from '../types';
import { VerticalFader, VUMeter } from './StemControl';
import { TechnicalKnob } from './Deck';

interface CentralMixerProps {
    state: GlobalDjState;
    dispatch: React.Dispatch<DeckAction>;
}

function getFxLabels(effectType: EffectType) {
    switch (effectType) {
        case EffectType.DELAY:
        case EffectType.ECHO:
            return ['TIME', 'FDBK'];
        case EffectType.REVERB:
            return ['DECAY', 'TONE'];
        case EffectType.GATER:
            return ['RATE', 'DEPTH'];
        default:
            return ['P1', 'P2'];
    }
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="font-mono text-[7px] font-black uppercase tracking-[0.22em] text-text-data">
        {children}
    </div>
);

const KillSwitch: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
}> = ({ label, active, onClick }) => (
    <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.94 }}
        onClick={onClick}
        className={[
            'flex h-5 min-w-[24px] items-center justify-center rounded-btn-sm border font-mono text-[7px] font-black uppercase tracking-[0.16em] transition-all',
            active
                ? 'border-signal-clipping/35 bg-signal-clipping/18 text-signal-clipping'
                : 'border-white/8 bg-black/35 text-text-secondary hover:border-white/16 hover:text-text-primary',
        ].join(' ')}
    >
        {label}
    </motion.button>
);

const FxTypeButton: React.FC<{
    active: boolean;
    label: string;
    onClick: () => void;
}> = ({ active, label, onClick }) => (
    <button
        onClick={onClick}
        className={[
            'rounded-btn-sm border px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[0.18em] transition-all',
            active
                ? 'border-signal-sync/35 bg-signal-sync/16 text-signal-sync'
                : 'border-white/8 bg-black/35 text-text-secondary hover:border-white/14 hover:text-text-primary',
        ].join(' ')}
    >
        {label}
    </button>
);

const ChannelStrip: React.FC<{
    deckId: 'A' | 'B';
    state: GlobalDjState;
    dispatch: React.Dispatch<DeckAction>;
}> = ({ deckId, state, dispatch }) => {
    const deckState = state.decks[deckId];
    const { eq, fx } = deckState;
    const [fxLabel1, fxLabel2] = getFxLabels(fx.activeType);

    return (
        <div className="surface-panel flex min-w-0 flex-1 flex-col gap-3 rounded-panel p-3">
            <div className="flex items-center justify-between">
                <div>
                    <SectionLabel>Channel {deckId}</SectionLabel>
                    <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                        {deckState.track?.title || 'No track'}
                    </div>
                </div>
                <div className="rounded-full border border-white/8 bg-black/35 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-text-secondary">
                    {deckState.isPlaying ? 'Live' : 'Ready'}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
                <TechnicalKnob
                    value={eq.trim}
                    onChange={(value) => dispatch({ type: 'SET_EQ', deckId, band: 'trim', value })}
                    label="Trim"
                    size={34}
                    displayValue={`${((eq.trim - 0.5) * 24).toFixed(1)}dB`}
                />
                <TechnicalKnob
                    value={eq.high}
                    onChange={(value) => dispatch({ type: 'SET_EQ', deckId, band: 'high', value })}
                    label="High"
                    size={34}
                    displayValue={`${((eq.high - 0.5) * 12).toFixed(1)}dB`}
                    bipolar
                    color="var(--color-signal-nominal)"
                />
                <TechnicalKnob
                    value={eq.mid}
                    onChange={(value) => dispatch({ type: 'SET_EQ', deckId, band: 'mid', value })}
                    label="Mid"
                    size={34}
                    displayValue={`${((eq.mid - 0.5) * 12).toFixed(1)}dB`}
                    bipolar
                    color="var(--color-signal-nominal)"
                />
                <TechnicalKnob
                    value={eq.low}
                    onChange={(value) => dispatch({ type: 'SET_EQ', deckId, band: 'low', value })}
                    label="Low"
                    size={34}
                    displayValue={`${((eq.low - 0.5) * 12).toFixed(1)}dB`}
                    bipolar
                    color="var(--color-signal-nominal)"
                />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-3 rounded-panel border border-white/6 bg-black/30 p-3">
                    <div className="flex items-center justify-between">
                        <SectionLabel>EQ Kills</SectionLabel>
                        <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-text-secondary">
                            Instant cuts
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <KillSwitch
                            label="L"
                            active={eq.low === 0}
                            onClick={() => dispatch({ type: 'SET_EQ', deckId, band: 'low', value: eq.low === 0 ? 0.5 : 0 })}
                        />
                        <KillSwitch
                            label="M"
                            active={eq.mid === 0}
                            onClick={() => dispatch({ type: 'SET_EQ', deckId, band: 'mid', value: eq.mid === 0 ? 0.5 : 0 })}
                        />
                        <KillSwitch
                            label="H"
                            active={eq.high === 0}
                            onClick={() => dispatch({ type: 'SET_EQ', deckId, band: 'high', value: eq.high === 0 ? 0.5 : 0 })}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-btn-sm border border-white/6 bg-black/35 px-3 py-2">
                        <SectionLabel>Color</SectionLabel>
                        <TechnicalKnob
                            value={deckState.color}
                            onChange={(value) => dispatch({ type: 'SET_COLOR_FILTER', deckId, value })}
                            label="Filter"
                            size={32}
                            color="var(--color-signal-sync)"
                            bipolar
                        />
                    </div>
                </div>

                <div className="flex w-[54px] flex-col items-center gap-2 rounded-panel border border-white/6 bg-black/30 p-2">
                    <SectionLabel>Vol</SectionLabel>
                    <VerticalFader
                        value={deckState.channelVolume}
                        onChange={(value) => dispatch({ type: 'SET_CHANNEL_VOLUME', deckId, value })}
                        color="var(--color-signal-nominal)"
                        label={deckId}
                        hideValue
                    />
                </div>
            </div>

            <div className="rounded-panel border border-white/6 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                    <SectionLabel>FX</SectionLabel>
                    <button
                        onClick={() => dispatch({ type: 'TOGGLE_FX', deckId })}
                        className={[
                            'rounded-btn-sm border px-3 py-1 font-mono text-[7px] font-black uppercase tracking-[0.18em] transition-all',
                            fx.active
                                ? 'border-signal-clipping/35 bg-signal-clipping/18 text-signal-clipping'
                                : 'border-white/8 bg-black/35 text-text-secondary hover:border-white/14 hover:text-text-primary',
                        ].join(' ')}
                    >
                        {fx.active ? 'On' : 'Bypass'}
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.values(EffectType).map((effectType) => (
                        <FxTypeButton
                            key={effectType}
                            active={fx.activeType === effectType}
                            label={effectType}
                            onClick={() => dispatch({ type: 'SET_FX_TYPE', deckId, effectType })}
                        />
                    ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    <TechnicalKnob
                        value={fx.knob1}
                        onChange={(value) => dispatch({ type: 'SET_FX_PARAM', deckId, knob: 1, value })}
                        label={fxLabel1}
                        size={32}
                        displayValue={`${(fx.knob1 * 100).toFixed(0)}%`}
                    />
                    <TechnicalKnob
                        value={fx.knob2}
                        onChange={(value) => dispatch({ type: 'SET_FX_PARAM', deckId, knob: 2, value })}
                        label={fxLabel2}
                        size={32}
                        displayValue={`${(fx.knob2 * 100).toFixed(0)}%`}
                    />
                    <TechnicalKnob
                        value={fx.wet}
                        onChange={(value) => dispatch({ type: 'SET_FX_WET', deckId, value })}
                        label="Wet"
                        size={32}
                        color="var(--color-signal-sync)"
                        displayValue={`${(fx.wet * 100).toFixed(0)}%`}
                    />
                </div>
            </div>
        </div>
    );
};

export const CentralMixer: React.FC<CentralMixerProps> = ({ state, dispatch }) => {
    const masterLevel = Math.max(state.decks.A.level, state.decks.B.level);

    return (
        <div className="flex w-[430px] shrink-0 flex-col gap-2">
            <div className="surface-panel flex items-center justify-between rounded-panel px-4 py-3">
                <div>
                    <SectionLabel>Mixer</SectionLabel>
                    <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                        Central control
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-text-secondary">
                        Master {Math.round(masterLevel * 100)}%
                    </div>
                    <div className="h-2 w-16 overflow-hidden rounded-full border border-white/8 bg-black/35">
                        <div
                            className="h-full bg-gradient-to-r from-signal-nominal via-text-data to-signal-clipping"
                            style={{ width: `${Math.min(masterLevel, 1) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 gap-2">
                <ChannelStrip deckId="A" state={state} dispatch={dispatch} />

                <div className="surface-panel flex w-[84px] shrink-0 flex-col items-center rounded-panel px-3 py-4">
                    <SectionLabel>Master</SectionLabel>

                    <div className="mt-4 flex w-full flex-1 gap-2 rounded-panel border border-white/6 bg-black/35 p-2">
                        <VUMeter level={state.decks.A.level} className="h-full flex-1" />
                        <VUMeter level={state.decks.B.level} className="h-full flex-1" />
                    </div>

                    <div className="mt-4 flex w-full flex-col gap-2">
                        <div className="rounded-btn-sm border border-white/8 bg-black/35 px-2 py-2 text-center font-mono text-[7px] font-black uppercase tracking-[0.18em] text-text-secondary">
                            A
                        </div>
                        <div className="rounded-btn-sm border border-white/8 bg-black/35 px-2 py-2 text-center font-mono text-[7px] font-black uppercase tracking-[0.18em] text-text-secondary">
                            B
                        </div>
                    </div>
                </div>

                <ChannelStrip deckId="B" state={state} dispatch={dispatch} />
            </div>
        </div>
    );
};
