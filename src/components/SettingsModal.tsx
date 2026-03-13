import React, { useState, useEffect, useRef } from 'react';
import { GlobalDjState, DeckAction } from '../types';

interface SettingsModalProps {
    state: GlobalDjState;
    dispatch: (action: DeckAction) => void;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-text-data">{title}</h3>
        <div className="space-y-2">{children}</div>
    </div>
);

const SettingsRow: React.FC<{ label: string; children: React.ReactNode; description?: string }> = ({ label, children, description }) => (
    <div className="flex items-center justify-between gap-4 rounded-btn-sm border border-white/6 bg-black/30 px-3 py-2.5">
        <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold text-text-primary">{label}</div>
            {description && <div className="mt-0.5 font-mono text-[8px] text-text-data/60">{description}</div>}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ state, dispatch }) => {
    const { settings } = state;
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [midiDevices, setMidiDevices] = useState<string[]>([]);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [isLearning, setIsLearning] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!settings.isOpen) return;
        setMediaError(null);

        navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
                setAudioDevices(devices.filter((d) => d.kind === 'audiooutput'));
            })
            .catch((err) => {
                setMediaError(`Could not enumerate audio devices: ${err.message}`);
            });

        if ('requestMIDIAccess' in navigator) {
            (navigator as any)
                .requestMIDIAccess()
                .then((midiAccess: any) => {
                    const inputs = Array.from(midiAccess.inputs.values()) as any[];
                    setMidiDevices(inputs.map((i) => i.name));
                })
                .catch(() => {
                    setMidiDevices([]);
                });
        }
    }, [settings.isOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && settings.isOpen) {
                dispatch({ type: 'TOGGLE_SETTINGS' });
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [dispatch, settings.isOpen]);

    if (!settings.isOpen) return null;

    const MIDI_ACTIONS = [
        { id: 'DECK_A_PLAY', label: 'Deck A — Play/Pause' },
        { id: 'DECK_A_CUE', label: 'Deck A — Cue' },
        { id: 'DECK_B_PLAY', label: 'Deck B — Play/Pause' },
        { id: 'DECK_B_CUE', label: 'Deck B — Cue' },
        { id: 'CROSSFADER', label: 'Crossfader (CC)' },
    ];

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm"
            onClick={(e) => { if (e.target === overlayRef.current) dispatch({ type: 'TOGGLE_SETTINGS' }); }}
        >
            <div className="surface-panel relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-panel border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4">
                    <div>
                        <h2 className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-text-primary">Settings</h2>
                        <p className="mt-0.5 font-mono text-[8px] text-text-data">Audio output, MIDI, and system configuration</p>
                    </div>
                    <button
                        onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                        className="flex h-8 w-8 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 text-text-data transition-all hover:border-white/20 hover:text-text-primary"
                    >
                        ×
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    {/* Audio Output */}
                    <SettingsSection title="Audio Output">
                        {mediaError ? (
                            <div className="rounded-btn-sm border border-signal-clipping/30 bg-signal-clipping/10 p-3 font-mono text-[9px] text-signal-clipping">
                                {mediaError}
                            </div>
                        ) : (
                            <SettingsRow
                                label="Output Device"
                                description="Select which audio device to use for playback"
                            >
                                <select
                                    value={settings.audioOutputId || ''}
                                    onChange={(e) => dispatch({ type: 'SET_AUDIO_OUTPUT', deviceId: e.target.value })}
                                    className="rounded-btn-sm border border-white/10 bg-black/40 px-2 py-1 font-mono text-[9px] text-text-primary"
                                >
                                    <option value="">Default Output</option>
                                    {audioDevices.map((device) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Device ${device.deviceId.slice(0, 6)}`}
                                        </option>
                                    ))}
                                </select>
                            </SettingsRow>
                        )}
                    </SettingsSection>

                    {/* MIDI */}
                    <SettingsSection title="MIDI">
                        <SettingsRow label="Connected Devices">
                            <div className="font-mono text-[9px] text-text-data">
                                {midiDevices.length > 0 ? midiDevices.join(', ') : 'None detected'}
                            </div>
                        </SettingsRow>

                        {MIDI_ACTIONS.map((action) => {
                            const mapping = settings.midiMappings?.[action.id];
                            return (
                                <SettingsRow
                                    key={action.id}
                                    label={action.label}
                                    description={mapping ? `${mapping.type.toUpperCase()} ${mapping.note} (Ch ${mapping.channel})` : 'Not mapped'}
                                >
                                    <button
                                        onClick={() => {
                                            dispatch({ type: 'LEARN_MIDI', actionId: action.id });
                                            setIsLearning(action.id);
                                            setTimeout(() => setIsLearning(null), 5000);
                                        }}
                                        className={`rounded-btn-sm border px-2 py-1 font-mono text-[8px] transition-all ${
                                            isLearning === action.id
                                                ? 'animate-pulse border-signal-nominal/50 bg-signal-nominal/15 text-signal-nominal'
                                                : 'border-white/10 bg-black/30 text-text-data hover:border-white/20'
                                        }`}
                                    >
                                        {isLearning === action.id ? 'LISTENING...' : 'LEARN'}
                                    </button>
                                </SettingsRow>
                            );
                        })}
                    </SettingsSection>

                    {/* Performance */}
                    <SettingsSection title="Performance">
                        <SettingsRow
                            label="Waveform Resolution"
                            description="Higher resolution uses more memory"
                        >
                            <div className="font-mono text-[9px] text-text-data">2048 samples</div>
                        </SettingsRow>
                        <SettingsRow
                            label="Analysis Engine"
                            description="BPM and key detection"
                        >
                            <div className="font-mono text-[9px] text-signal-nominal">Essentia.js</div>
                        </SettingsRow>
                        <SettingsRow
                            label="Pitch Engine"
                            description="Time-stretch / key-lock algorithm"
                        >
                            <div className="font-mono text-[9px] text-signal-nominal">SignalSmith</div>
                        </SettingsRow>
                        <SettingsRow
                            label="Stem Mode"
                            description="Current stem separation method"
                        >
                            <div className="font-mono text-[9px] text-text-data">EQ Filters (Web)</div>
                        </SettingsRow>
                    </SettingsSection>

                    {/* About */}
                    <SettingsSection title="About">
                        <SettingsRow label="Version">
                            <div className="font-mono text-[9px] text-text-data">1.0.0</div>
                        </SettingsRow>
                        <SettingsRow label="Build Target">
                            <div className="font-mono text-[9px] text-signal-nominal">WEB</div>
                        </SettingsRow>
                        <SettingsRow label="Runtime">
                            <div className="font-mono text-[9px] text-text-data">Browser (Web Audio API)</div>
                        </SettingsRow>
                    </SettingsSection>
                </div>
            </div>
        </div>
    );
};
