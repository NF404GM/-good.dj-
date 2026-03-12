
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useDjState } from '../hooks/useDjState';
import { LibraryTrack, DeckAction, Playlist } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { isHarmonicMatch, shiftCamelotKey } from '../services/trackAnalyzer';

interface LibraryViewProps {
    dispatch: (action: DeckAction) => void;
    className?: string;
}

const StarRating: React.FC<{ rating: number; onChange: (r: number) => void }> = ({ rating, onChange }) => {
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    return (
        <div className="flex gap-[1px]" onMouseLeave={() => setHoverRating(null)}>
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    onClick={(e) => { e.stopPropagation(); onChange(star); }}
                    onMouseEnter={() => setHoverRating(star)}
                    className="text-[10px] w-3 h-3 flex items-center justify-center transition-all duration-150"
                >
                    <span
                        className={`transform transition-all duration-150 ${(hoverRating !== null ? star <= hoverRating : star <= rating)
                            ? 'text-white scale-110 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]'
                            : 'text-text-data/30 scale-100'
                            }`}
                    >
                        ★
                    </span>
                </button>
            ))}
        </div>
    );
};

export const LibraryView: React.FC<LibraryViewProps> = ({ dispatch, className = "" }) => {
    // Access global state directly to get real tracks/playlists
    const { state } = useDjState();
    const tracks = state.library.tracks;
    const playlists = state.library.playlists;

    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<keyof LibraryTrack>('dateAdded');
    const [sortAsc, setSortAsc] = useState(false);
    const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

    const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
    const realFileInputRef = useRef<HTMLInputElement>(null);

    // --- SELECTION STATE ---
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    // --- PLAYLIST STATE ---
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
    const [showPlaylistPicker, setShowPlaylistPicker] = useState<{ trackId: string; x: number; y: number } | null>(null);

    // --- RECORDINGS STATE ---
    const [showRecordings, setShowRecordings] = useState(false);
    const [recordings, setRecordings] = useState<any[]>([]);

    useEffect(() => {
        if (showRecordings) {
            fetch('http://127.0.0.1:3002/api/recordings')
                .then(res => res.json())
                .then(data => setRecordings(data));
        }
    }, [showRecordings]);

    // --- ACTIONS ---

    const handleSort = (key: keyof LibraryTrack) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const handleCreatePlaylist = () => {
        if (newPlaylistName.trim()) {
            dispatch({ type: 'LIBRARY_CREATE_PLAYLIST', name: newPlaylistName.trim() });
            setNewPlaylistName("");
            setIsCreatingPlaylist(false);
        }
    };

    const handleCancelCreate = () => {
        setNewPlaylistName("");
        setIsCreatingPlaylist(false);
    }

    const handleTrackClick = (e: React.MouseEvent, trackId: string) => {
        e.stopPropagation(); // Prevent drag interference if any

        const newSelected = new Set(selectedTrackIds);

        if (e.ctrlKey || e.metaKey) {
            // Toggle
            if (newSelected.has(trackId)) newSelected.delete(trackId);
            else newSelected.add(trackId);
            setLastSelectedId(trackId);
        } else if (e.shiftKey && lastSelectedId) {
            // Range Select
            const allIds = filteredTracks.map(t => t.id);
            const start = allIds.indexOf(lastSelectedId);
            const end = allIds.indexOf(trackId);
            const low = Math.min(start, end);
            const high = Math.max(start, end);
            for (let i = low; i <= high; i++) {
                newSelected.add(allIds[i]);
            }
        } else {
            // Single Select
            newSelected.clear();
            newSelected.add(trackId);
            setLastSelectedId(trackId);

            // Also toggle expand if simple click
            setExpandedTrackId(expandedTrackId === trackId ? null : trackId);
        }

        setSelectedTrackIds(newSelected);
    };

    const handleAddToPlaylist = (e: React.MouseEvent, trackId: string) => {
        e.stopPropagation();
        if (playlists.length === 0) {
            return; // No playlists — button hidden when none exist
        }
        if (playlists.length === 1) {
            // Auto-add to the only playlist
            dispatch({ type: 'LIBRARY_ADD_TO_PLAYLIST', playlistId: playlists[0].id, trackId });
            return;
        }
        // Show inline picker
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setShowPlaylistPicker({ trackId, x: rect.left, y: rect.bottom + 4 });
    };

    // --- DRAG & DROP LOGIC ---

    const handleDragStart = (e: React.DragEvent, trackId: string) => {
        let idsToSend = [trackId];
        if (selectedTrackIds.has(trackId)) {
            idsToSend = Array.from(selectedTrackIds);
        }

        // Find full track data for the primary dragged track (for deck loading)
        const primaryTrack = tracks.find(t => t.id === trackId);

        e.dataTransfer.setData('application/json', JSON.stringify({
            trackIds: idsToSend,
            track: primaryTrack || null  // Full track object for deck drops
        }));
        e.dataTransfer.effectAllowed = 'copy';

        // Visual flair
        const ghost = document.createElement('div');
        ghost.textContent = `${idsToSend.length} Track${idsToSend.length > 1 ? 's' : ''}`;
        ghost.style.background = 'var(--color-signal-nominal)';
        ghost.style.padding = '4px 8px';
        ghost.style.borderRadius = '4px';
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handlePlaylistDrop = (e: React.DragEvent, playlistId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverPlaylistId(null);
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            try {
                const payload = JSON.parse(data);
                if (payload.trackIds && Array.isArray(payload.trackIds)) {
                    dispatch({ type: 'LIBRARY_ADD_TRACKS_TO_PLAYLIST', playlistId, trackIds: payload.trackIds });
                }
            } catch (err) { console.error(err); }
        }
    };

    const handleImportFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            dispatch({ type: 'LIBRARY_IMPORT', files: Array.from(e.target.files) });
        }
        if (e.target) e.target.value = '';
    };

    // --- FILTER & SORT ---

    const filteredTracks = useMemo(() => {
        let result = tracks;

        // 1. Filter by Playlist
        if (activePlaylistId) {
            const pl = playlists.find(p => p.id === activePlaylistId);
            if (pl) {
                result = result.filter(t => pl.trackIds.includes(t.id));
            }
        }

        // 2. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.artist.toLowerCase().includes(q) ||
                t.album.toLowerCase().includes(q)
            );
        }

        // 3. Sort
        return [...result].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (valA === undefined) return 1;
            if (valB === undefined) return -1;

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [tracks, playlists, searchQuery, activePlaylistId, sortKey, sortAsc]);

    // --- HARMONIC MIXING ---
    const effectiveActiveKey = useMemo(() => {
        const activeDeckId = state.activeDeckId || (state.decks.A.isPlaying ? 'A' : (state.decks.B.isPlaying ? 'B' : 'A'));
        const activeDeck = state.decks[activeDeckId as 'A' | 'B'];
        const activeBaseKey = activeDeck.track?.key;

        if (!activeBaseKey || activeBaseKey === '?') return null;

        let totalShift = activeDeck.keyShift;
        if (!activeDeck.keyLock) {
            const pitchRatio = 1 + activeDeck.pitch;
            const pitchShift = Math.round(12 * Math.log2(pitchRatio));
            totalShift += pitchShift;
        }

        return shiftCamelotKey(activeBaseKey, totalShift);
    }, [state.activeDeckId, state.decks.A.isPlaying, state.decks.B.isPlaying, state.decks.A.track?.key, state.decks.B.track?.key, state.decks.A.keyShift, state.decks.B.keyShift, state.decks.A.keyLock, state.decks.B.keyLock, state.decks.A.pitch, state.decks.B.pitch]);

    // --- HELPER ---
    const formatTime = (sec: number) => {
        if (!sec) return "-:-";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const generateGradient = (id: string) => {
        const hash = id.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue1 = hash % 360;
        const hue2 = (hash + 180) % 360;
        return `linear-gradient(135deg, hsl(${hue1}, 60%, 20%), hsl(${hue2}, 60%, 20%))`;
    };

    return (
        <div className={`flex flex-1 bg-canvas overflow-hidden font-mono text-sm ${className}`} onClick={() => { setSelectedTrackIds(new Set()); setShowPlaylistPicker(null); }}>

            <input type="file" ref={realFileInputRef} onChange={handleImportFiles} multiple className="hidden" accept="audio/*" />

            {/* 1. INDUSTRIAL SIDEBAR (Matte Black) */}
            <div className="w-52 border-r border-white/5 flex flex-col bg-black/60 select-none backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                <div className="p-3 border-b border-white/5 bg-black/40">
                    <h3 className="text-[7px] font-mono font-black text-white/20 uppercase tracking-[0.4em]">Collection Unit</h3>
                </div>
                
                <nav className="flex flex-col py-4 gap-1">
                    <button
                        onClick={() => { setActivePlaylistId(null); setShowRecordings(false); }}
                        className={`text-left px-4 py-2 text-[10px] font-mono font-black uppercase tracking-widest transition-all relative overflow-hidden group
                            ${activePlaylistId === null && !showRecordings ? 'text-signal-sync bg-signal-sync/5' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
                    >
                        {activePlaylistId === null && !showRecordings && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-signal-sync shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                        All Tracks
                    </button>
                    <button
                        onClick={() => { setActivePlaylistId(null); setShowRecordings(true); }}
                        className={`text-left px-4 py-2 text-[10px] font-mono font-black uppercase tracking-widest transition-all relative overflow-hidden group
                            ${showRecordings ? 'text-signal-sync bg-signal-sync/5' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
                    >
                        {showRecordings && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-signal-sync shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                        Recordings
                    </button>
                    
                    <div className="mt-4 px-4 py-2 mb-2">
                        <div className="h-[1px] bg-white/5 w-full" />
                    </div>

                    <div className="px-4 flex items-center justify-between mb-2">
                        <h3 className="text-[7px] font-mono font-black text-white/20 uppercase tracking-[0.4em]">Playlists</h3>
                        <button
                            onClick={() => setIsCreatingPlaylist(true)}
                            className="w-4 h-4 rounded-xs border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all text-xs active:scale-90"
                        >
                            +
                        </button>
                    </div>

                    {isCreatingPlaylist && (
                        <div className="px-3 mb-2 animate-in slide-in-from-top-1 duration-200">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-black border border-signal-sync/30 rounded-xs text-[9px] font-mono text-white px-2 py-1 outline-none shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreatePlaylist();
                                    if (e.key === 'Escape') handleCancelCreate();
                                }}
                                onBlur={handleCancelCreate}
                                placeholder="NEW_PLAYLIST_ID..."
                            />
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
                        {playlists.map(p => (
                            <div
                                key={p.id}
                                onDragOver={(e) => { e.preventDefault(); setDragOverPlaylistId(p.id); }}
                                onDragLeave={() => setDragOverPlaylistId(null)}
                                onDrop={(e) => handlePlaylistDrop(e, p.id)}
                                className="relative group mb-[1px]"
                            >
                                <button
                                    onClick={() => { setActivePlaylistId(p.id); setShowRecordings(false); }}
                                    className={`w-full text-left px-3 py-2 text-[9px] font-mono font-bold transition-all truncate flex justify-between items-center rounded-xs
                                        ${activePlaylistId === p.id ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}
                                        ${dragOverPlaylistId === p.id ? 'bg-signal-sync/20 text-signal-sync border border-signal-sync/40' : 'border border-transparent'}
                                    `}
                                >
                                    <span className="truncate flex-1 tracking-wider">{p.name.toUpperCase()}</span>
                                    <span className="text-[7px] opacity-40 font-black min-w-[16px] text-right">{p.trackIds.length}</span>
                                </button>
                                
                                <button
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'LIBRARY_DELETE_PLAYLIST', playlistId: p.id }); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-signal-clipping opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/80 rounded-xs border border-white/5"
                                >
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <button onClick={() => realFileInputRef.current?.click()} className="mt-auto mx-4 mb-6 py-2 border border-white/10 rounded-xs text-[8px] font-mono font-black uppercase tracking-[0.2em] text-white/20 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-2 bg-white/5">
                        <span className="opacity-40 tracking-[0.4em]">Import_Native</span>
                    </button>
                </nav>
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col bg-transparent">

                {showRecordings ? (
                    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                            <h2 className="text-xl font-mono font-black text-white tracking-[0.2em] uppercase">Archive_Unit recordings</h2>
                            <div className="flex gap-2 text-[10px] font-mono">
                                <span className="text-white/20 uppercase tracking-widest">Storage: Online</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-signal-nominal animate-pulse" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {recordings.map(rec => (
                                <div key={rec.id} className="flex items-center justify-between p-4 bg-black/40 rounded-xs border border-white/10 hover:border-signal-sync/30 transition-all group overflow-hidden relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/5 group-hover:bg-signal-sync transition-colors" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-mono font-bold text-white mb-1 tracking-wider">{rec.title}</span>
                                        <span className="text-[8px] text-white/30 font-mono tracking-widest uppercase">{new Date(rec.dateRecorded).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <audio controls src={`http://127.0.0.1:3002${rec.filePath}`} className="hidden" id={`audio-${rec.id}`} />
                                        <div className="flex gap-2">
                                            <a href={`http://127.0.0.1:3002${rec.filePath}`} download className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-xs text-[9px] font-mono font-black uppercase tracking-wider transition-all">Export</a>
                                            <button
                                                onClick={() => {
                                                    if (confirm('Permanently delete record?')) {
                                                        fetch(`http://127.0.0.1:3002/api/recordings/${rec.id}`, { method: 'DELETE' }).then(() => setRecordings(recordings.filter(r => r.id !== rec.id)));
                                                    }
                                                }}
                                                className="px-3 py-1 bg-signal-clipping/10 hover:bg-signal-clipping/30 text-signal-clipping border border-signal-clipping/20 rounded-xs text-[9px] font-mono font-black uppercase tracking-wider transition-all"
                                            >
                                                Purge
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* High-Density Header Bar */}
                        <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 gap-4 shrink-0 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5" />
                            <div className="relative flex-1 max-w-lg">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none opacity-20">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="COLLECTION_QUERY..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xs py-1.5 pl-8 pr-4 text-[10px] font-mono text-white/80 focus:outline-none focus:border-signal-sync/50 focus:bg-black/60 transition-all placeholder:text-white/10 tracking-widest"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                {selectedTrackIds.size > 0 && (
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                                        <div className="px-2 py-0.5 bg-signal-sync/20 text-signal-sync text-[8px] font-mono font-black rounded-xs border border-signal-sync/40">
                                            {selectedTrackIds.size} SEGS SELECTED
                                        </div>
                                        <div className="h-4 w-[1px] bg-white/10" />
                                    </div>
                                )}
                                <div className="flex gap-1 text-[7px] font-mono font-black text-white/10 uppercase tracking-[0.3em]">
                                    <span>V-System</span>
                                    <span>[0.12.8]</span>
                                </div>
                            </div>
                        </div>

                        {/* High-Density Grid Header */}
                        <div className="grid grid-cols-12 gap-0 px-4 py-2 border-b border-white/10 bg-black/60 text-[8px] font-mono font-black text-white/30 uppercase tracking-[0.4em] sticky top-0 z-10 select-none shadow-lg">
                            <div className="col-span-1 text-center opacity-40">+</div>
                            <div onClick={() => handleSort('title')} className="col-span-4 cursor-pointer hover:text-white transition-colors">Track_Descriptor</div>
                            <div onClick={() => handleSort('artist')} className="col-span-3 cursor-pointer hover:text-white transition-colors pl-2">Source_Unit</div>
                            <div onClick={() => handleSort('bpm')} className="col-span-1 text-right cursor-pointer hover:text-white transition-colors pr-4">BPM</div>
                            <div onClick={() => handleSort('key')} className="col-span-1 text-center cursor-pointer hover:text-white transition-colors">Key</div>
                            <div onClick={() => handleSort('rating')} className="col-span-1 text-center cursor-pointer hover:text-white transition-colors">Rank</div>
                            <div onClick={() => handleSort('duration')} className="col-span-1 text-right cursor-pointer hover:text-white transition-colors">T-Len</div>
                        </div>

                            {/* High-Density Grid Body */}
                            <div
                                className={`flex-1 overflow-y-auto custom-scrollbar relative bg-[#0a0a0a]
                                    ${dragOverPlaylistId === 'library-root' ? 'bg-signal-sync/5 border-2 border-dashed border-signal-sync/30 m-2' : ''}`}
                                onClick={() => setSelectedTrackIds(new Set())}
                                onDragOver={(e) => {
                                    if (e.dataTransfer.types.includes('Files')) {
                                        e.preventDefault();
                                        setDragOverPlaylistId('library-root');
                                    }
                                }}
                                onDragLeave={() => setDragOverPlaylistId(null)}
                                onDrop={(e) => {
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverPlaylistId(null);
                                        dispatch({ type: 'LIBRARY_IMPORT', files: Array.from(e.dataTransfer.files) });
                                    }
                                }}
                            >
                                <AnimatePresence initial={false}>
                                    {filteredTracks.map((track, idx) => {
                                        const isExpanded = expandedTrackId === track.id;
                                        const isSelected = selectedTrackIds.has(track.id);
                                        const isCompatible = effectiveActiveKey && track.key && track.key !== '?' ? isHarmonicMatch(effectiveActiveKey, track.key) : false;

                                        return (
                                            <motion.div 
                                                layout
                                                key={track.id} 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                                            >
                                                <motion.div
                                                    draggable={true}
                                                    onDragStart={(e) => handleDragStart(e, track.id)}
                                                    whileHover={{ x: 2 }}
                                                    className={`grid grid-cols-12 gap-0 px-4 py-[6px] border-b border-white/[0.03] items-center group transition-all cursor-pointer select-none relative
                                                        ${isSelected ? 'bg-signal-sync/20 text-white z-10' : (isExpanded ? 'bg-white/[0.04]' : isCompatible ? 'bg-signal-nominal/[0.04] hover:bg-signal-nominal/[0.08]' : 'hover:bg-white/[0.02]')}`}
                                                    onClick={(e) => handleTrackClick(e, track.id)}
                                                >
                                                    {/* Selection Accent */}
                                                    {isSelected && (
                                                        <motion.div 
                                                            layoutId="selection-accent"
                                                            className="absolute left-0 top-0 bottom-0 w-[2px] bg-signal-sync shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                                                        />
                                                    )}
                                                    {isCompatible && !isSelected && <div className="absolute left-0 top-1 bottom-1 w-[1.5px] bg-signal-nominal/40" />}

                                                    {/* Add to Playlist Button */}
                                                    <div className="col-span-1 flex justify-center opacity-20 group-hover:opacity-100 transition-opacity">
                                                        <motion.button
                                                            whileTap={{ scale: 0.8 }}
                                                            onClick={(e) => handleAddToPlaylist(e, track.id)}
                                                            className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center transition-all text-[8px] font-black
                                                                ${isSelected ? 'border-white text-white' : 'border-white/10 text-white/40 hover:text-white hover:border-white/30'}`}
                                                        >
                                                            +
                                                        </motion.button>
                                                    </div>

                                                    {/* Title */}
                                                    <div className="col-span-4 flex flex-col justify-center overflow-hidden">
                                                        <span className={`text-[11px] truncate font-bold tracking-tight ${isSelected ? 'text-white' : 'text-white/80'}`}>{track.title}</span>
                                                    </div>

                                                    {/* Artist */}
                                                    <div className={`col-span-3 text-[10px] truncate pl-2 font-medium ${isSelected ? 'text-white/70' : 'text-white/40'}`}>{track.artist}</div>

                                                    {/* BPM */}
                                                    <div className={`col-span-1 text-right text-[10px] font-mono font-black pr-4 ${isCompatible ? 'text-signal-nominal' : (isSelected ? 'text-white' : 'text-white/50')}`}>
                                                        {track.bpm ? track.bpm.toFixed(1) : '---.-'}
                                                    </div>

                                                    {/* Camelot Key Badge matching flair */}
                                                    <div className="col-span-1 flex justify-center">
                                                        <motion.div 
                                                            whileHover={{ scale: 1.1 }}
                                                            className={`w-9 py-0.5 rounded-xs text-center text-[9px] font-mono font-black transition-all border
                                                            ${isCompatible 
                                                                ? 'bg-signal-nominal text-white border-white/20 shadow-[0_0_12px_rgba(22,197,94,0.4)]' 
                                                                : (isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-black/40 text-white/30 border-white/5')}
                                                        `}>
                                                            {track.key || '??'}
                                                        </motion.div>
                                                    </div>

                                                    {/* Star Rating */}
                                                    <div className="col-span-1 flex justify-center scale-90 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <StarRating
                                                            rating={track.rating || 0}
                                                            onChange={(r) => dispatch({ type: 'LIBRARY_SET_RATING', trackId: track.id, rating: r })}
                                                        />
                                                    </div>

                                                    {/* Duration */}
                                                    <div className={`col-span-1 text-right text-[10px] font-mono font-bold ${isSelected ? 'text-white/70' : 'text-white/20'}`}>
                                                        {formatTime(track.duration)}
                                                    </div>
                                                </motion.div>

                                                {/* Expandable Technical Card */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div 
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                            className="border-t border-b border-white/5 bg-[#050505] overflow-hidden" 
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="p-5 flex gap-8 relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 p-4 opacity-5 font-mono text-[6px] tracking-[0.5em] [writing-mode:vertical-lr] uppercase">Extended_Metadata_Record</div>
                                                                
                                                                {/* Album Art with Optimized Image */}
                                                                <div className="w-28 h-28 rounded-xs shadow-2xl border border-white/10 shrink-0 relative overflow-hidden group/art bg-black">
                                                                    <OptimizedImage
                                                                        alt={track.album}
                                                                        fallbackGradient={generateGradient(track.id)}
                                                                        className="w-full h-full rounded-xs transition-transform duration-500 group-hover/art:scale-110"
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/art:opacity-100 transition-opacity" />
                                                                </div>

                                                                {/* Extended Metadata Matrix */}
                                                                <div className="flex flex-col gap-4 flex-1">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex flex-col gap-1">
                                                                            <div className="text-[7px] font-mono font-black text-signal-sync uppercase tracking-[0.3em]">Sector: Physical_Medium</div>
                                                                            <div className="text-base font-bold text-white tracking-tight">{track.album || 'UNDEFINED_ALBUM_ROOT'}</div>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <motion.button
                                                                                whileHover={{ scale: 1.05 }}
                                                                                whileTap={{ scale: 0.95 }}
                                                                                onClick={() => dispatch({ type: 'LOAD_TRACK', deckId: 'A', track })}
                                                                                className="px-5 py-2 bg-signal-sync text-white rounded-xs text-[10px] font-mono font-black uppercase tracking-widest transition-all hover:brightness-125 shadow-lg"
                                                                            >
                                                                                Load_Unit_A
                                                                            </motion.button>
                                                                            <motion.button
                                                                                whileHover={{ scale: 1.05 }}
                                                                                whileTap={{ scale: 0.95 }}
                                                                                onClick={() => dispatch({ type: 'LOAD_TRACK', deckId: 'B', track })}
                                                                                className="px-5 py-2 bg-signal-sync text-white rounded-xs text-[10px] font-mono font-black uppercase tracking-widest transition-all hover:brightness-125 shadow-lg"
                                                                            >
                                                                                Load_Unit_B
                                                                            </motion.button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-3 gap-6 pt-2 border-t border-white/5">
                                                                        <div className="flex flex-col">
                                                                            <div className="text-[7px] font-mono font-black text-white/20 uppercase tracking-[0.3em] mb-1">Tag_Identifier</div>
                                                                            <div className="text-[11px] font-mono text-white/60 tracking-wider bg-white/5 px-2 py-1 rounded-xs border border-white/5">{track.genre || 'GENERIC'}</div>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <div className="text-[7px] font-mono font-black text-white/20 uppercase tracking-[0.3em] mb-1">Entry_Timestamp</div>
                                                                            <div className="text-[11px] font-mono text-white/60 tracking-wider bg-white/5 px-2 py-1 rounded-xs border border-white/5">{track.dateAdded}</div>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <div className="text-[7px] font-mono font-black text-white/20 uppercase tracking-[0.3em] mb-1">System_Match</div>
                                                                            <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-xs border border-white/5">
                                                                                <div className={`w-2 h-2 rounded-full ${track.analyzed ? 'bg-signal-nominal shadow-[0_0_5px_#16a34a]' : 'bg-white/10'}`} />
                                                                                <span className="text-[10px] font-mono text-white/60">{track.analyzed ? 'SYNC_COMPLETE' : 'PENDING'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>

                                <div className="h-20 flex items-center justify-center border-t border-white/[0.02]">
                                    <span className="text-[8px] font-mono font-black text-white/10 uppercase tracking-[0.6em]">End_of_Transmission</span>
                                </div>
                            </div>
                    </>
                )}

            </div>

            {/* Modal Playlist Picker (Tactile) */}
            {showPlaylistPicker && (
                <div
                    className="fixed z-[100] bg-black/90 backdrop-blur-xl border border-white/20 rounded-xs shadow-[0_20px_50px_rgba(0,0,0,0.8)] py-2 min-w-[200px] animate-in zoom-in-95 duration-200"
                    style={{ left: showPlaylistPicker.x, top: showPlaylistPicker.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 text-[8px] font-mono font-black text-signal-sync uppercase tracking-[0.3em] border-b border-white/10 mb-1 flex items-center justify-between">
                        <span>Assign_Unit</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-signal-sync" />
                    </div>
                    {playlists.map(p => (
                        <button
                            key={p.id}
                            onClick={() => {
                                dispatch({ type: 'LIBRARY_ADD_TO_PLAYLIST', playlistId: p.id, trackId: showPlaylistPicker.trackId });
                                setShowPlaylistPicker(null);
                            }}
                            className="w-full text-left px-4 py-2 text-[10px] font-mono font-bold text-white/60 hover:bg-signal-sync/20 hover:text-white transition-all flex items-center justify-between group"
                        >
                            <span className="truncate tracking-widest">{p.name.toUpperCase()}</span>
                            <span className="text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">&gt;&gt;</span>
                        </button>
                    ))}
                    {playlists.length === 0 && <div className="px-4 py-3 text-[10px] text-white/20 italic">No_Active_Collections</div>}
                </div>
            )}
        </div>
    );
};
