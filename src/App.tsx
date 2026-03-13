import React, { useEffect, useState, Suspense, lazy } from 'react';
import { AppView, DeckAction, GlobalDjState } from './types';
import { Deck } from './components/Deck';
import { Crossfader } from './components/Crossfader';
import { SettingsModal } from './components/SettingsModal';
import { useDjState, DjProvider } from './hooks/useDjState';
import { CentralMixer } from './components/CentralMixer';
import { BootSequence } from './components/BootSequence';
import { useProLink } from './hooks/useProLink';
import { ActivationGate } from './components/ActivationGate';
import { SHOW_ARCHITECTURE_VIEW } from './services/config';

// --- LAZY LOADED VIEWS (Code Splitting) ---
const LibraryView = lazy(() => import('./components/LibraryView').then(module => ({ default: module.LibraryView })));
const ArchitectureView = SHOW_ARCHITECTURE_VIEW
    ? lazy(() => import('./components/ArchitectureView').then(module => ({ default: module.ArchitectureView })))
    : null;

// --- LAYOUT COMPONENT (Persistent Shell) ---
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
    prolink: { 
        isConnected: boolean; 
        devices: any[]; 
        syncEnabled: boolean; 
        setSyncEnabled: (v: boolean) => void 
    };
    dispatch: (action: DeckAction) => void;
}> = ({ children, currentView, onNavigate, midiDevice, onToggleSettings, isRecording, onToggleRecording, updateInfo, onDismissUpdate, prolink, dispatch }) => {
    return (
        <div
            className="w-screen h-screen flex flex-col bg-canvas text-text-primary overflow-hidden"
            onDragOver={(e) => {
                const hasFiles = e.dataTransfer.types.includes('Files');
                if (hasFiles) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            onDrop={(e) => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`[good.dj] Global drop received: ${e.dataTransfer.files.length} files`);
                    dispatch({ type: 'LIBRARY_IMPORT', files: Array.from(e.dataTransfer.files) });
                }
            }}
        >
            {/* ── BACKGROUND WATERMARK (§7.1) ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
                <div className="absolute top-[15%] right-[-5%] text-[24vw] font-black italic text-white/[0.02] leading-none tracking-tighter">
                    good.
                </div>
                <div className="absolute bottom-[10%] left-[-2%] text-[18vw] font-black italic text-white/[0.01] leading-none tracking-tighter">
                    DJ
                </div>
                {/* Surface texture grid */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
                        backgroundSize: '48px 48px'
                    }}
                />
            </div>

            {/* MAIN APP SHELL (Z-indexed above watermark) */}
            <div className="relative flex flex-col w-full h-full z-10">
            {/* HEADER */}
            <header className="h-10 border-b border-white/10 flex items-center justify-between px-3 bg-surface-idle shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(var(--signal-nominal-rgb),0.5)] transition-colors duration-500 ${midiDevice ? 'bg-signal-nominal animate-pulse' : 'bg-text-secondary'}`} />
                    <span className="font-bold tracking-tighter text-sm">good.<span className="font-medium text-text-secondary">DJ</span></span>
                    <span className="text-[9px] font-mono text-text-data px-1.5 py-0.5 border border-white/10 rounded-btn-sm bg-surface-idle">WEB v1.0</span>
                    {updateInfo && (
                        <a
                            href={updateInfo.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={onDismissUpdate}
                            className="px-2 py-0.5 text-[8px] font-mono font-black bg-green-500/20 text-green-400 border border-green-500/30 rounded uppercase tracking-widest hover:bg-green-500/30 transition-all"
                        >
                            UPDATE {updateInfo.latest} ↗
                        </a>
                    )}
                </div>

                <nav className="flex gap-1 bg-canvas/50 p-[1px] rounded-btn-sm border border-white/5 shadow-inner">
                    <button
                        onClick={() => onNavigate(AppView.INTERFACE)}
                        className={`px-4 py-1.5 text-[10px] font-bold tracking-[0.15em] rounded-btn-sm transition-all
                            ${currentView === AppView.INTERFACE ? 'bg-text-primary text-canvas shadow-sm' : 'text-text-data hover:text-text-primary hover:bg-white/5'}`}
                    >
                        PERFORM
                    </button>
                    <button
                        onClick={() => onNavigate(AppView.LIBRARY)}
                        className={`px-4 py-1.5 text-[10px] font-bold tracking-[0.15em] rounded-btn-sm transition-all
                            ${currentView === AppView.LIBRARY ? 'bg-text-primary text-canvas shadow-sm' : 'text-text-data hover:text-text-primary hover:bg-white/5'}`}
                    >
                        LIBRARY
                    </button>
                </nav>

                <div className="flex items-center gap-3 text-[9px] font-mono text-text-data hidden sm:flex">

                    <button
                        onClick={onToggleSettings}
                        className="hover:text-white transition-colors"
                        title="Settings & MIDI Mapping"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>

                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-colors ${midiDevice ? 'border-signal-nominal/30 bg-signal-nominal/10 text-signal-nominal' : 'border-transparent text-text-data'}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 12h8" />
                            <path d="M12 8v8" />
                        </svg>
                        <span className="font-bold tracking-wider">
                            {midiDevice ? midiDevice.toUpperCase() : 'NO MIDI'}
                        </span>
                    </div>

                    {/* PROLINK STATUS */}
                    <div className="flex items-center gap-2">
                         <div 
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-colors ${prolink.isConnected ? 'border-signal-nominal/30 bg-signal-nominal/10 text-signal-nominal' : 'border-white/5 bg-white/5 text-text-data cursor-help'}`}
                            title={prolink.isConnected ? `${prolink.devices.length} Devices Linked` : "Connect Pioneer Hardware via ProLink Bridge"}
                        >
                            <span className="font-bold tracking-wider">CDJ</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${prolink.isConnected ? 'bg-signal-nominal animate-pulse' : 'bg-white/10'}`} />
                        </div>
                        
                        {prolink.isConnected && (
                            <button
                                onClick={() => prolink.setSyncEnabled(!prolink.syncEnabled)}
                                className={`px-2 py-1 text-[8px] font-bold border rounded-btn-sm transition-all
                                    ${prolink.syncEnabled ? 'bg-signal-nominal text-canvas border-signal-nominal' : 'border-white/20 text-text-data hover:border-white/40'}`}
                            >
                                HW-SYNC
                            </button>
                        )}
                    </div>

                    <button
                        onClick={onToggleRecording}
                        className={`px-3 py-1 text-[9px] font-bold border rounded-btn-sm transition-all flex items-center gap-2
                            ${isRecording ? 'bg-signal-clipping text-white border-signal-clipping animate-dot-pulse shadow-[0_0_10px_rgba(var(--signal-clipping-rgb),0.5)]' : 'bg-surface-idle text-text-data border-white/10 hover:border-white/30'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white' : 'bg-signal-clipping'}`} />
                        REC
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT SLOT */}
            <main className="flex-1 overflow-hidden min-h-0 flex flex-col relative">
                {children}
            </main>

            {/* FOOTER */}
            <footer className="h-5 border-t border-white/5 flex items-center px-4 bg-surface-idle text-[8px] text-text-data font-mono justify-between shrink-0 z-50">
                <div className="flex gap-4">
                    <span>CORE: v1.0.0 // WEB MIDI: {midiDevice ? 'ACTIVE' : 'IDLE'} // 48kHz</span>
                    <span className="opacity-40 italic tracking-widest hidden lg:block">serch gen | where.t.at</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-text-data/40">MARCH 2026 // ED. 1.0</span>
                    <div className="w-[1px] h-2 bg-text-data/20 mx-1" />
                    <span>good.DJ © 2026</span>
                </div>
            </footer>
            </div>
        </div>
    )
}

// --- APP CONTENT ---
function AppContent() {
    const [currentView, setCurrentView] = useState<AppView>(AppView.INTERFACE);
    const [updateInfo, setUpdateInfo] = useState<{ latest: string; url: string } | null>(null);
    const { state, dispatch, midiDevice } = useDjState();
    const prolink = useProLink(dispatch);

    const { decks, crossfader, isRecording } = state;

    useEffect(() => {
        const cleanup = (window as any).gooddj?.onUpdateAvailable?.((info: { latest: string; url: string }) => {
            setUpdateInfo(info);
        });

        return () => cleanup?.();
    }, []);

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
                prolink={prolink}
                dispatch={dispatch}
            >
                <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-canvas text-signal-nominal animate-pulse font-mono text-xs">
                        LOADING MODULE...
                    </div>
                }>
                    {/* INTERFACE PAGE (Main perform view wrapper) */}
                    <div className={`absolute inset-0 flex flex-col z-10 transition-opacity duration-300 ${currentView === AppView.INTERFACE || currentView === AppView.LIBRARY ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>

                        {/* Upper Deck Section */}
                        <div
                            className={`flex relative bg-canvas gap-1 overflow-hidden shrink-0 transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY
                                ? 'flex-[0] max-h-0 opacity-0 pointer-events-none p-0'
                                : 'flex-[3] max-h-[2000px] opacity-100 p-1 border-b border-white/5'
                                }`}
                        >
                            <div className="flex-[4] min-w-0 flex flex-col" data-boot="deck-a">
                                <Deck deckState={decks.A} dispatch={dispatch} activeColor="var(--signal-nominal)" />
                            </div>
                            <div data-boot="mixer">
                                <CentralMixer state={state} dispatch={dispatch} />
                            </div>
                            <div className="flex-[4] min-w-0 flex flex-col" data-boot="deck-b">
                                <Deck deckState={decks.B} dispatch={dispatch} activeColor="var(--signal-nominal)" />
                            </div>
                        </div>

                        {/* Full Width Crossfader Row */}
                        <div
                            data-boot="crossfader"
                            className={`shrink-0 bg-canvas border-white/5 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-30 overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY
                                ? 'max-h-0 opacity-0 pointer-events-none'
                                : 'max-h-20 h-20 border-b opacity-100'
                                }`}
                        >
                            <Crossfader value={crossfader} onChange={(v) => dispatch({ type: 'SET_CROSSFADER', value: v })} />
                        </div>

                        {/* Unified Library Section */}
                        <div
                            data-boot="library"
                            className={`bg-canvas relative z-20 overflow-hidden flex flex-col min-h-0 transition-[flex] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${currentView === AppView.LIBRARY
                                ? 'flex-1'
                                : 'flex-[2]'
                                }`}
                        >
                            <LibraryView dispatch={dispatch} className="flex-1 rounded-none bg-canvas" />
                        </div>
                    </div>

                    {/* ARCHITECTURE PAGE */}
                    {SHOW_ARCHITECTURE_VIEW && ArchitectureView && currentView === AppView.ARCHITECTURE && (
                        <div className="absolute inset-0 p-4 bg-canvas z-20">
                            <ArchitectureView />
                        </div>
                    )}
                </Suspense>
            </RootLayout>
        </>
    );
}

// --- ROOT APP ---
export default function App() {
    return (
        <ActivationGate>
            <BootSequence>
                <DjProvider>
                    <AppContent />
                </DjProvider>
            </BootSequence>
        </ActivationGate>
    );
}
