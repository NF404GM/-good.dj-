import React, { Suspense, lazy, useState } from 'react';
import { AppView, DeckAction } from './types';
import { Deck } from './components/Deck';
import { Crossfader } from './components/Crossfader';
import { SettingsModal } from './components/SettingsModal';
import { useDjState, DjProvider } from './hooks/useDjState';
import { CentralMixer } from './components/CentralMixer';
import { BootSequence } from './components/BootSequence';
import { SHOW_ARCHITECTURE_VIEW } from './services/config';

const LibraryView = lazy(() => import('./components/LibraryView').then((module) => ({ default: module.LibraryView })));
const ArchitectureView = SHOW_ARCHITECTURE_VIEW
    ? lazy(() => import('./components/ArchitectureView').then((module) => ({ default: module.ArchitectureView })))
    : null;

const RootLayout: React.FC<{
    children: React.ReactNode;
    currentView: AppView;
    onNavigate: (view: AppView) => void;
    midiDevice: string | null;
    onToggleSettings: () => void;
    isRecording: boolean;
    onToggleRecording: () => void;
    updateInfo: { latest: string; url: string } | null;
    onDismissUpdate: () => void;
    dispatch: (action: DeckAction) => void;
}> = ({ children, currentView, onNavigate, midiDevice, onToggleSettings, isRecording, onToggleRecording, updateInfo, onDismissUpdate, dispatch }) => {

    return (
        <div
            className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-text-primary"
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            onDrop={(e) => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    dispatch({ type: 'LIBRARY_IMPORT', files: Array.from(e.dataTransfer.files) });
                }
            }}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.03] to-transparent" />
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/[0.02] to-transparent" />
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
            </div>

            <div className="relative z-10 flex h-full w-full flex-col">
                <header role="banner" className="surface-panel z-50 mx-2 mt-2 flex h-12 shrink-0 items-center justify-between rounded-panel px-4">
                    <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full transition-colors duration-500 ${midiDevice ? 'bg-signal-nominal animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-text-secondary/50'}`} />
                        <span className="text-sm font-bold tracking-tight">good.<span className="text-text-secondary">DJ</span></span>
                        <span className="rounded-btn-sm border border-white/8 bg-black/30 px-2 py-1 font-mono text-[8px] font-black tracking-[0.18em] text-text-data">
                            WEB
                        </span>
                        {updateInfo ? (
                            <a
                                href={updateInfo.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={onDismissUpdate}
                                className="rounded-btn-sm border border-green-500/30 bg-green-500/18 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-green-400 transition-all hover:bg-green-500/26"
                            >
                                UPDATE {updateInfo.latest}
                            </a>
                        ) : null}
                    </div>

                    <nav className="flex gap-1 rounded-btn-lg border border-white/8 bg-black/35 p-1">
                        <button
                            onClick={() => onNavigate(AppView.INTERFACE)}
                            className={`rounded-btn-sm px-4 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ${currentView === AppView.INTERFACE ? 'bg-text-primary text-canvas' : 'text-text-data hover:bg-white/[0.04] hover:text-text-primary'}`}
                        >
                            PERFORM
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.LIBRARY)}
                            className={`rounded-btn-sm px-4 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ${currentView === AppView.LIBRARY ? 'bg-text-primary text-canvas' : 'text-text-data hover:bg-white/[0.04] hover:text-text-primary'}`}
                        >
                            LIBRARY
                        </button>
                    </nav>

                    <div className="hidden items-center gap-3 text-[9px] font-mono text-text-data sm:flex">
                        <button
                            onClick={onToggleSettings}
                            className="rounded-btn-sm border border-white/8 bg-black/30 p-2 transition-colors hover:text-white"
                            title="Settings"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 3 15H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 20 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>

                        <div className={`flex items-center gap-1.5 rounded-btn-sm border px-2 py-1 transition-colors ${midiDevice ? 'border-signal-nominal/25 bg-signal-nominal/12 text-signal-nominal' : 'border-white/8 bg-black/30 text-text-data'}`}>
                            <span className="font-bold tracking-wider">{midiDevice ? midiDevice.toUpperCase() : 'NO MIDI'}</span>
                        </div>

                        <button
                            onClick={onToggleRecording}
                            className={`flex items-center gap-2 rounded-btn-sm border px-3 py-1 text-[9px] font-bold transition-all ${isRecording ? 'animate-dot-pulse border-signal-clipping bg-signal-clipping text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-white/10 bg-black/30 text-text-data hover:border-white/30'}`}
                        >
                            <div className={`h-2 w-2 rounded-full ${isRecording ? 'bg-white' : 'bg-signal-clipping'}`} />
                            REC
                        </button>
                    </div>
                </header>

                <main role="main" className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-2">
                    {children}
                </main>

                <footer className="z-50 mx-2 mb-2 flex h-7 shrink-0 items-center justify-between rounded-panel border border-white/8 bg-black/35 px-4 text-[8px] font-mono text-text-data">
                    <div className="flex gap-4">
                        <span>CORE v1.0.0</span>
                        <span>WEB MIDI: {midiDevice ? 'ACTIVE' : 'IDLE'}</span>
                        <span className="hidden lg:block">44.1kHz</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-text-data/40">MARCH 2026</span>
                        <div className="mx-1 h-2 w-[1px] bg-text-data/20" />
                        <span>good.DJ 2026</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};

function AppContent() {
    const [currentView, setCurrentView] = useState<AppView>(AppView.INTERFACE);
    const [updateInfo, setUpdateInfo] = useState<{ latest: string; url: string } | null>(null);
    const { state, dispatch, midiDevice } = useDjState();
    const { decks, crossfader } = state;

    return (
        <>
            <SettingsModal state={state} dispatch={dispatch} />

            <RootLayout
                currentView={currentView}
                onNavigate={setCurrentView}
                midiDevice={midiDevice}
                onToggleSettings={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                isRecording={state.isRecording}
                onToggleRecording={() => dispatch({ type: 'TOGGLE_RECORDING' })}
                updateInfo={updateInfo}
                onDismissUpdate={() => setUpdateInfo(null)}
                dispatch={dispatch}
            >
                <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-canvas font-mono text-xs text-signal-nominal">LOADING MODULE...</div>}>
                    <div className={`absolute inset-0 z-10 flex flex-col transition-opacity duration-300 ${currentView === AppView.INTERFACE || currentView === AppView.LIBRARY ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
                        <div
                            className={`relative flex shrink-0 gap-2 overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY ? 'max-h-0 flex-[0] p-0 opacity-0 pointer-events-none' : 'max-h-[2000px] flex-[3] border-b border-white/5 opacity-100'}`}
                        >
                            <div className="flex min-w-0 flex-[4] flex-col" data-boot="deck-a">
                                <Deck deckState={decks.A} dispatch={dispatch} activeColor="var(--color-cyan)" />
                            </div>
                            <div data-boot="mixer">
                                <CentralMixer state={state} dispatch={dispatch} />
                            </div>
                            <div className="flex min-w-0 flex-[4] flex-col" data-boot="deck-b">
                                <Deck deckState={decks.B} dispatch={dispatch} activeColor="var(--color-amber)" />
                            </div>
                        </div>

                        <div
                            data-boot="crossfader"
                            className={`z-30 shrink-0 overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY ? 'max-h-0 pointer-events-none opacity-0' : 'h-20 max-h-20 border-b border-white/5 opacity-100'}`}
                        >
                            <Crossfader value={crossfader} onChange={(value) => dispatch({ type: 'SET_CROSSFADER', value })} />
                        </div>

                        <div
                            data-boot="library"
                            className={`relative z-20 flex min-h-0 flex-col overflow-hidden transition-[flex] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY ? 'flex-1' : 'flex-[2]'}`}
                        >
                            <LibraryView dispatch={dispatch} className="flex-1 rounded-none bg-transparent" />
                        </div>
                    </div>

                    {SHOW_ARCHITECTURE_VIEW && ArchitectureView && currentView === AppView.ARCHITECTURE ? (
                        <div className="absolute inset-0 z-20 bg-canvas p-4">
                            <ArchitectureView />
                        </div>
                    ) : null}
                </Suspense>
            </RootLayout>
        </>
    );
}

export default function App() {
    return (
        <BootSequence>
            <DjProvider>
                <AppContent />
            </DjProvider>
        </BootSequence>
    );
}
