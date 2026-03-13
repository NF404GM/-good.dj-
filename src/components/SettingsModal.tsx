import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalDjState, DeckAction, StemModelStatus } from '../types';

interface SettingsModalProps {
    state: GlobalDjState;
    dispatch: (action: DeckAction) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ state, dispatch }) => {
    const [activeTab, setActiveTab] = useState<'AUDIO' | 'MIDI' | 'APPEARANCE' | 'STEMS'>('APPEARANCE');
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [stemModelStatus, setStemModelStatus] = useState<StemModelStatus | null>(null);
    const [stemModelError, setStemModelError] = useState<string | null>(null);
    const [isInstallingStemModel, setIsInstallingStemModel] = useState(false);
    const [isRemovingStemModel, setIsRemovingStemModel] = useState(false);
    const stemModelInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeTab === 'AUDIO') {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                setAudioDevices(devices.filter(d => d.kind === 'audiooutput'));
            });
        }
    }, [activeTab]);

    useEffect(() => {
        if (!state.settings.isOpen || !window.gooddj?.stems?.getStatus) {
            return;
        }

        let active = true;
        window.gooddj.stems.getStatus()
            .then((status) => {
                if (active) {
                    setStemModelStatus(status);
                    setStemModelError(null);
                }
            })
            .catch((error) => {
                if (active) {
                    setStemModelError(error instanceof Error ? error.message : String(error));
                }
            });

        return () => {
            active = false;
        };
    }, [state.settings.isOpen, activeTab]);

    const handleLearn = (actionId: string) => {
        dispatch({ type: 'LEARN_MIDI', actionId });
    };

    const syncStemModelStatus = async () => {
        if (!window.gooddj?.stems?.getStatus) {
            return;
        }

        const status = await window.gooddj.stems.getStatus();
        setStemModelStatus(status);
        setStemModelError(null);
        window.dispatchEvent(new CustomEvent('gooddj:stem-model-status-changed'));
    };

    const handleStemModelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const filePath = (file as any)?.path as string | undefined;

        if (!filePath || !window.gooddj?.stems?.installModel) {
            return;
        }

        setIsInstallingStemModel(true);
        setStemModelError(null);

        try {
            const status = await window.gooddj.stems.installModel(filePath);
            setStemModelStatus(status);
            window.dispatchEvent(new CustomEvent('gooddj:stem-model-status-changed'));
        } catch (error) {
            setStemModelError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsInstallingStemModel(false);
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    const handleRemoveStemModel = async () => {
        if (!window.gooddj?.stems?.removeInstalledModel) {
            return;
        }

        setIsRemovingStemModel(true);
        setStemModelError(null);

        try {
            const status = await window.gooddj.stems.removeInstalledModel();
            setStemModelStatus(status);
            window.dispatchEvent(new CustomEvent('gooddj:stem-model-status-changed'));
        } catch (error) {
            setStemModelError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsRemovingStemModel(false);
        }
    };

    const formatShape = (shape: Array<string | number | null | undefined>) =>
        shape.length > 0 ? shape.map((part) => part ?? '?').join(' x ') : 'Unknown';

    const MAPPING_GROUPS = [
        {
            label: 'DECK A',
            actions: [
                { id: 'DECK_A_PLAY', label: 'PLAY' },
                { id: 'DECK_A_CUE', label: 'CUE' },
                { id: 'DECK_A_SYNC', label: 'SYNC' },
                { id: 'DECK_A_PITCH', label: 'PITCH' },
                { id: 'DECK_A_EQ_TRIM', label: 'TRIM' },
                { id: 'DECK_A_EQ_HIGH', label: 'EQ HI' },
                { id: 'DECK_A_EQ_MID', label: 'EQ MID' },
                { id: 'DECK_A_EQ_LOW', label: 'EQ LOW' },
                { id: 'DECK_A_FILTER', label: 'FILTER' },
                { id: 'DECK_A_VOL', label: 'FADER' },
                { id: 'DECK_A_HOTCUE_1', label: 'HOTCUE 1' },
                { id: 'DECK_A_HOTCUE_2', label: 'HOTCUE 2' },
                { id: 'DECK_A_HOTCUE_3', label: 'HOTCUE 3' },
                { id: 'DECK_A_HOTCUE_4', label: 'HOTCUE 4' },
                { id: 'DECK_A_HOTCUE_5', label: 'HOTCUE 5' },
                { id: 'DECK_A_HOTCUE_6', label: 'HOTCUE 6' },
                { id: 'DECK_A_HOTCUE_7', label: 'HOTCUE 7' },
                { id: 'DECK_A_HOTCUE_8', label: 'HOTCUE 8' },
                { id: 'DECK_A_LOOP_AUTO', label: 'AUTO LOOP' },
                { id: 'DECK_A_FX_ON', label: 'FX ON' },
                { id: 'DECK_A_FX_WET', label: 'FX WET' },
            ]
        },
        {
            label: 'DECK B',
            actions: [
                { id: 'DECK_B_PLAY', label: 'PLAY' },
                { id: 'DECK_B_CUE', label: 'CUE' },
                { id: 'DECK_B_SYNC', label: 'SYNC' },
                { id: 'DECK_B_PITCH', label: 'PITCH' },
                { id: 'DECK_B_EQ_TRIM', label: 'TRIM' },
                { id: 'DECK_B_EQ_HIGH', label: 'EQ HI' },
                { id: 'DECK_B_EQ_MID', label: 'EQ MID' },
                { id: 'DECK_B_EQ_LOW', label: 'EQ LOW' },
                { id: 'DECK_B_FILTER', label: 'FILTER' },
                { id: 'DECK_B_VOL', label: 'FADER' },
                { id: 'DECK_B_HOTCUE_1', label: 'HOTCUE 1' },
                { id: 'DECK_B_HOTCUE_2', label: 'HOTCUE 2' },
                { id: 'DECK_B_HOTCUE_3', label: 'HOTCUE 3' },
                { id: 'DECK_B_HOTCUE_4', label: 'HOTCUE 4' },
                { id: 'DECK_B_HOTCUE_5', label: 'HOTCUE 5' },
                { id: 'DECK_B_HOTCUE_6', label: 'HOTCUE 6' },
                { id: 'DECK_B_HOTCUE_7', label: 'HOTCUE 7' },
                { id: 'DECK_B_HOTCUE_8', label: 'HOTCUE 8' },
                { id: 'DECK_B_LOOP_AUTO', label: 'AUTO LOOP' },
                { id: 'DECK_B_FX_ON', label: 'FX ON' },
                { id: 'DECK_B_FX_WET', label: 'FX WET' },
            ]
        },
        {
            label: 'GLOBAL',
            actions: [
                { id: 'CROSSFADER', label: 'CROSSFADER' }
            ]
        }
    ];

    return (
        <AnimatePresence>
            {state.settings.isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Settings"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-[680px] h-[560px] bg-canvas border border-white/10 shadow-huge flex flex-col rounded-panel overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-idle">
                            <h2 className="text-sm font-bold tracking-widest text-text-primary">SETTINGS</h2>
                            <button onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} className="text-text-secondary hover:text-text-primary transition-colors p-1 text-lg">X</button>
                        </div>

                        <div className="flex border-b border-white/10 bg-surface-idle/50">
                            {[
                                { id: 'APPEARANCE', label: 'APPEARANCE' },
                                { id: 'AUDIO', label: 'AUDIO OUTPUT' },
                                { id: 'MIDI', label: 'MIDI MAPPING' },
                                { id: 'STEMS', label: 'STEM MODEL' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`flex-1 py-3 text-[10px] font-bold tracking-wider transition-all relative ${activeTab === tab.id ? 'text-text-primary' : 'bg-transparent text-text-secondary hover:text-text-primary/70'}`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <motion.div layoutId="settings-tab-indicator" className="absolute bottom-0 left-4 right-4 h-0.5 bg-signal-nominal rounded-full shadow-[0_0_10px_rgba(var(--signal-nominal-rgb),0.5)]" />}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-canvas relative">
                            <AnimatePresence mode="wait">
                                {activeTab === 'APPEARANCE' && (
                                    <motion.div
                                        key="appearance"
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        className="flex flex-col gap-8"
                                    >
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-[10px] font-bold text-text-data uppercase tracking-widest">Global Theme</h3>
                                            <div className="flex items-center gap-3 p-4 bg-surface-idle border border-white/5 rounded-btn-sm">
                                                <div className="w-8 h-8 rounded-full shadow-lg bg-[#0f0f0f] border border-white/10" />
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold tracking-widest text-text-primary">HARDWARE WARM</span>
                                                    <span className="text-[9px] text-text-secondary mt-1">Dark, high-contrast studio theme</span>
                                                </div>
                                                <div className="ml-auto w-2 h-2 rounded-full bg-signal-nominal animate-pulse" />
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 bg-surface-idle border border-white/5 rounded-btn-sm">
                                            <p className="text-[9px] text-text-secondary leading-relaxed">
                                                <strong>Hardware Warm</strong> is good.dj&apos;s signature studio theme: deep blacks, precision typography, and signal-green accents optimized for performance.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'AUDIO' && (
                                    <motion.div
                                        key="audio"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col gap-4"
                                    >
                                        <label className="text-[10px] text-text-data uppercase">Master Output Device</label>
                                        <select
                                            className="w-full bg-surface-idle border border-white/10 rounded-btn-sm p-3 text-xs text-text-primary focus:border-signal-nominal outline-none shadow-inner"
                                            value={state.settings.audioOutputId}
                                            onChange={(e) => dispatch({ type: 'SET_AUDIO_OUTPUT', deviceId: e.target.value })}
                                        >
                                            <option value="default">System Default</option>
                                            {audioDevices.map(d => (
                                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 5)}...`}</option>
                                            ))}
                                        </select>
                                        <p className="text-[9px] text-text-data/50 mt-2">
                                            Note: Audio Output Selection requires Chrome/Edge (Chromium 88+). On other browsers, use system settings.
                                        </p>
                                    </motion.div>
                                )}

                                {activeTab === 'MIDI' && (
                                    <motion.div
                                        key="midi"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col gap-6"
                                    >
                                        <div className="bg-signal-nominal/10 border border-signal-nominal/20 p-3 rounded-btn-sm">
                                            <p className="text-[9px] text-signal-nominal font-bold">
                                                Click a function button below, then move a control on your hardware to map it.
                                            </p>
                                        </div>

                                        {MAPPING_GROUPS.map(group => (
                                            <div key={group.label}>
                                                <h3 className="text-[9px] text-text-data font-bold mb-2 border-b border-white/5 pb-1">{group.label}</h3>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {group.actions.map(action => {
                                                        const isMapped = !!state.settings.midiMappings[action.id];
                                                        return (
                                                            <button
                                                                key={action.id}
                                                                onClick={() => handleLearn(action.id)}
                                                                className={`h-10 text-[9px] font-bold border rounded-btn-sm transition-all relative overflow-hidden
                                                                    ${isMapped
                                                                        ? 'bg-surface-active border-signal-nominal/30 text-text-primary hover:bg-white/10'
                                                                        : 'bg-surface-idle border-white/10 text-text-data/50 hover:text-text-secondary'}`}
                                                            >
                                                                {action.label}
                                                                {isMapped && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-signal-nominal shadow-[0_0_5px_currentColor]" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}

                                {activeTab === 'STEMS' && (
                                    <motion.div
                                        key="stems"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col gap-4"
                                    >
                                        <input
                                            ref={stemModelInputRef}
                                            type="file"
                                            accept=".onnx"
                                            onChange={handleStemModelFile}
                                            className="hidden"
                                        />

                                        <div className="bg-surface-idle border border-white/10 rounded-btn-sm p-4 flex flex-col gap-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-[10px] font-bold tracking-widest text-text-data uppercase">Current Stem Model</div>
                                                    <div className="text-xs text-text-primary mt-1">
                                                        {stemModelStatus?.available ? stemModelStatus.fileName : 'No local model installed'}
                                                    </div>
                                                </div>
                                                <div className={`px-2 py-1 text-[9px] font-bold rounded-btn-sm border ${
                                                    stemModelStatus?.available
                                                        ? 'border-signal-nominal/30 text-signal-nominal bg-signal-nominal/10'
                                                        : 'border-white/10 text-text-secondary bg-canvas'
                                                }`}>
                                                    {stemModelStatus?.available ? 'READY' : 'INACTIVE'}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                                                <div className="bg-canvas border border-white/5 rounded-btn-sm p-3">
                                                    <div className="text-text-data uppercase tracking-widest text-[9px] mb-1">Source</div>
                                                    <div className="text-text-primary">{stemModelStatus?.source ?? 'None'}</div>
                                                </div>
                                                <div className="bg-canvas border border-white/5 rounded-btn-sm p-3">
                                                    <div className="text-text-data uppercase tracking-widest text-[9px] mb-1">Input Shape</div>
                                                    <div className="text-text-primary">{formatShape(stemModelStatus?.inputShape ?? [])}</div>
                                                </div>
                                                <div className="bg-canvas border border-white/5 rounded-btn-sm p-3">
                                                    <div className="text-text-data uppercase tracking-widest text-[9px] mb-1">Output Shape</div>
                                                    <div className="text-text-primary">{formatShape(stemModelStatus?.outputShape ?? [])}</div>
                                                </div>
                                                <div className="bg-canvas border border-white/5 rounded-btn-sm p-3">
                                                    <div className="text-text-data uppercase tracking-widest text-[9px] mb-1">Status</div>
                                                    <div className="text-text-primary">{stemModelStatus?.message ?? 'Electron-only feature'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-signal-nominal/10 border border-signal-nominal/20 p-3 rounded-btn-sm">
                                            <p className="text-[9px] text-signal-nominal font-bold leading-relaxed">
                                                This project can bundle a provided stem model for free noncommercial releases, but the default production build still keeps model bundling opt-in.
                                            </p>
                                        </div>

                                        <div className="bg-[#3b0b0b] border border-[#7f1d1d] p-3 rounded-btn-sm">
                                            <p className="text-[9px] text-[#fecaca] leading-relaxed">
                                                Keep attribution with any bundled-model giveaway. Do not reuse that same release path later for paid, sponsored, or monetized distribution without re-checking the model rights.
                                            </p>
                                        </div>

                                        {stemModelError && (
                                            <div className="bg-[#3b0b0b] border border-[#7f1d1d] rounded-btn-sm p-3 text-[9px] text-[#fecaca]">
                                                {stemModelError}
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => stemModelInputRef.current?.click()}
                                                disabled={!window.gooddj?.stems || isInstallingStemModel}
                                                className={`flex-1 py-3 text-[10px] font-bold tracking-widest rounded-btn-sm border transition-all ${
                                                    !window.gooddj?.stems || isInstallingStemModel
                                                        ? 'bg-surface-idle border-white/10 text-text-secondary cursor-not-allowed'
                                                        : 'bg-surface-active border-signal-nominal/30 text-text-primary hover:bg-white/10'
                                                }`}
                                            >
                                                {isInstallingStemModel ? 'INSTALLING...' : 'INSTALL LOCAL ONNX MODEL'}
                                            </button>

                                            <button
                                                onClick={() => void syncStemModelStatus()}
                                                disabled={!window.gooddj?.stems}
                                                className={`px-4 py-3 text-[10px] font-bold tracking-widest rounded-btn-sm border transition-all ${
                                                    !window.gooddj?.stems
                                                        ? 'bg-surface-idle border-white/10 text-text-secondary cursor-not-allowed'
                                                        : 'bg-canvas border-white/10 text-text-primary hover:bg-white/5'
                                                }`}
                                            >
                                                REFRESH
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => void handleRemoveStemModel()}
                                            disabled={!window.gooddj?.stems || !stemModelStatus?.available || stemModelStatus.source !== 'user-installed' || isRemovingStemModel}
                                            className={`py-3 text-[10px] font-bold tracking-widest rounded-btn-sm border transition-all ${
                                                !window.gooddj?.stems || !stemModelStatus?.available || stemModelStatus.source !== 'user-installed' || isRemovingStemModel
                                                    ? 'bg-surface-idle border-white/10 text-text-secondary cursor-not-allowed'
                                                    : 'bg-canvas border-[#7f1d1d] text-[#fecaca] hover:bg-[#3b0b0b]'
                                            }`}
                                        >
                                            {isRemovingStemModel ? 'REMOVING...' : 'REMOVE USER-INSTALLED MODEL'}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
