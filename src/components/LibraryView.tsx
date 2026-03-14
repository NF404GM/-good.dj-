import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useDjState } from '../hooks/useDjState';
import { DeckAction, LibraryTrack, Playlist } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { isHarmonicMatch, shiftCamelotKey } from '../services/trackAnalyzer';
import { API_BASE, SERVER_BASE } from '../services/config';

interface LibraryViewProps {
    dispatch: (action: DeckAction) => void;
    className?: string;
}

interface RecordingItem {
    id: string;
    title: string;
    duration: number;
    filePath: string;
    dateRecorded: string | Date;
}

const SORT_OPTIONS: Array<{ key: keyof LibraryTrack; label: string }> = [
    { key: 'dateAdded', label: 'Newest' },
    { key: 'title', label: 'Title' },
    { key: 'artist', label: 'Artist' },
    { key: 'bpm', label: 'BPM' },
    { key: 'key', label: 'Key' },
    { key: 'rating', label: 'Rating' },
];

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="font-mono text-[8px] font-black uppercase tracking-[0.22em] text-text-data">
        {children}
    </div>
);

const StatChip: React.FC<{
    label: string;
    value: React.ReactNode;
    accent?: 'green' | 'blue' | 'amber' | null;
}> = ({ label, value, accent = null }) => {
    const accentClass = accent === 'green'
        ? 'border-signal-nominal/28 bg-signal-nominal/12 text-signal-nominal'
        : accent === 'blue'
            ? 'border-signal-sync/28 bg-signal-sync/12 text-signal-sync'
            : accent === 'amber'
                ? 'border-amber-400/28 bg-amber-400/12 text-amber-300'
                : 'border-white/8 bg-black/30 text-text-primary';

    return (
        <div className={`rounded-btn-sm border px-3 py-2 ${accentClass}`}>
            <div className="font-mono text-[7px] font-black uppercase tracking-[0.2em] text-text-data">
                {label}
            </div>
            <div className="mt-1 font-mono text-[11px] font-bold tracking-[0.14em]">
                {value}
            </div>
        </div>
    );
};

const StarButton: React.FC<{
    active: boolean;
    onClick: () => void;
}> = ({ active, onClick }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="flex h-4 w-4 items-center justify-center"
    >
        <svg
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 transition-all ${active ? 'fill-white text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]' : 'fill-transparent text-white/18 stroke-current'}`}
            strokeWidth="1.2"
        >
            <path d="M10 2.4l2.17 4.4 4.86.71-3.51 3.42.83 4.83L10 13.5l-4.35 2.3.83-4.83L2.97 7.51l4.86-.71L10 2.4z" />
        </svg>
    </button>
);

const StarRating: React.FC<{
    rating: number;
    onChange: (rating: number) => void;
}> = ({ rating, onChange }) => {
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    return (
        <div
            className="flex items-center gap-[2px]"
            onMouseLeave={() => setHoverRating(null)}
        >
            {[1, 2, 3, 4, 5].map((star) => {
                const isActive = hoverRating !== null ? star <= hoverRating : star <= rating;
                return (
                    <div
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                    >
                        <StarButton active={isActive} onClick={() => onChange(star)} />
                    </div>
                );
            })}
        </div>
    );
};

function formatTime(seconds: number) {
    if (!seconds || !Number.isFinite(seconds)) {
        return '--:--';
    }

    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatDateValue(value: string | Date | null | undefined) {
    if (!value) {
        return 'Unknown';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString();
}

function generateGradient(id: string) {
    const hash = id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const hueA = hash % 360;
    const hueB = (hash + 120) % 360;
    return `linear-gradient(135deg, hsl(${hueA}, 54%, 22%), hsl(${hueB}, 54%, 18%))`;
}

function getRecordingSource(filePath: string) {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }

    return `${SERVER_BASE}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ dispatch, className = '' }) => {
    const { state } = useDjState();
    const tracks = state.library.tracks;
    const playlists = state.library.playlists;

    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<keyof LibraryTrack>('dateAdded');
    const [sortAsc, setSortAsc] = useState(false);
    const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
    const [showPlaylistPicker, setShowPlaylistPicker] = useState<{ trackId: string; x: number; y: number } | null>(null);
    const [showRecordings, setShowRecordings] = useState(false);
    const [recordings, setRecordings] = useState<RecordingItem[]>([]);
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const realFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!showRecordings) {
            return;
        }

        let active = true;

        const loadRecordings = async () => {
            try {
                // Recordings are stored locally in browser — no server API needed
                const nextRecordings: RecordingItem[] = [];

                if (active) {
                    setRecordings(nextRecordings as RecordingItem[]);
                }
            } catch (error) {
                console.error('[LibraryView] Failed to load recordings:', error);
                if (active) {
                    setRecordings([]);
                }
            }
        };

        void loadRecordings();

        return () => {
            active = false;
        };
    }, [showRecordings]);

    const filteredTracks = useMemo(() => {
        let nextTracks = tracks;

        if (activePlaylistId) {
            const playlist = playlists.find((item) => item.id === activePlaylistId);
            if (playlist) {
                nextTracks = nextTracks.filter((track) => playlist.trackIds.includes(track.id));
            }
        }

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            nextTracks = nextTracks.filter((track) => (
                track.title.toLowerCase().includes(query)
                || track.artist.toLowerCase().includes(query)
                || track.album.toLowerCase().includes(query)
                || track.genre.toLowerCase().includes(query)
                || track.key.toLowerCase().includes(query)
            ));
        }

        return [...nextTracks].sort((trackA, trackB) => {
            const valueA = trackA[sortKey];
            const valueB = trackB[sortKey];

            if (valueA === undefined) return 1;
            if (valueB === undefined) return -1;
            if (valueA < valueB) return sortAsc ? -1 : 1;
            if (valueA > valueB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [activePlaylistId, playlists, searchQuery, sortAsc, sortKey, tracks]);

    const effectiveActiveKey = useMemo(() => {
        const activeDeckId = state.activeDeckId
            || (state.decks.A.isPlaying ? 'A' : state.decks.B.isPlaying ? 'B' : 'A');
        const activeDeck = state.decks[activeDeckId as 'A' | 'B'];
        const activeBaseKey = activeDeck.track?.key;

        if (!activeBaseKey || activeBaseKey === '?') {
            return null;
        }

        let totalShift = activeDeck.keyShift;
        if (!activeDeck.keyLock) {
            const pitchRatio = 1 + activeDeck.pitch;
            const pitchShift = Math.round(12 * Math.log2(pitchRatio));
            totalShift += pitchShift;
        }

        return shiftCamelotKey(activeBaseKey, totalShift);
    }, [
        state.activeDeckId,
        state.decks.A.isPlaying,
        state.decks.B.isPlaying,
        state.decks.A.track?.key,
        state.decks.B.track?.key,
        state.decks.A.keyShift,
        state.decks.B.keyShift,
        state.decks.A.keyLock,
        state.decks.B.keyLock,
        state.decks.A.pitch,
        state.decks.B.pitch,
    ]);

    const focusedTrack = useMemo(() => {
        if (selectedTrackIds.size === 0) {
            return null;
        }

        if (lastSelectedId) {
            return tracks.find((track) => track.id === lastSelectedId) ?? null;
        }

        const [firstSelectedId] = Array.from(selectedTrackIds);
        return tracks.find((track) => track.id === firstSelectedId) ?? null;
    }, [lastSelectedId, selectedTrackIds, tracks]);

    const activePlaylist = activePlaylistId
        ? playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
        : null;

    const sourceLabel = showRecordings
        ? 'Recordings'
        : activePlaylist
            ? activePlaylist.name
            : 'All Tracks';

    const handleSortChange = (nextSortKey: keyof LibraryTrack) => {
        if (sortKey === nextSortKey) {
            setSortAsc((current) => !current);
            return;
        }

        setSortKey(nextSortKey);
        setSortAsc(nextSortKey !== 'dateAdded');
    };

    const handleTrackClick = (event: React.MouseEvent, trackId: string) => {
        event.stopPropagation();

        const nextSelection = new Set(selectedTrackIds);

        if (event.ctrlKey || event.metaKey) {
            if (nextSelection.has(trackId)) {
                nextSelection.delete(trackId);
            } else {
                nextSelection.add(trackId);
            }
            setLastSelectedId(trackId);
        } else if (event.shiftKey && lastSelectedId) {
            const visibleIds = filteredTracks.map((track) => track.id);
            const fromIndex = visibleIds.indexOf(lastSelectedId);
            const toIndex = visibleIds.indexOf(trackId);
            const start = Math.min(fromIndex, toIndex);
            const end = Math.max(fromIndex, toIndex);

            for (let index = start; index <= end; index += 1) {
                nextSelection.add(visibleIds[index]);
            }

            setLastSelectedId(trackId);
        } else {
            nextSelection.clear();
            nextSelection.add(trackId);
            setLastSelectedId(trackId);
        }

        setSelectedTrackIds(nextSelection);
    };

    const handleCreatePlaylist = () => {
        const trimmed = newPlaylistName.trim();
        if (!trimmed) {
            return;
        }

        dispatch({ type: 'LIBRARY_CREATE_PLAYLIST', name: trimmed });
        setNewPlaylistName('');
        setIsCreatingPlaylist(false);
    };

    const handleDragStart = (event: React.DragEvent, trackId: string) => {
        const trackIds = selectedTrackIds.has(trackId)
            ? Array.from(selectedTrackIds)
            : [trackId];
        const primaryTrack = tracks.find((track) => track.id === trackId) ?? null;

        event.dataTransfer.setData('application/json', JSON.stringify({
            trackIds,
            track: primaryTrack,
        }));
        event.dataTransfer.effectAllowed = 'copy';
    };

    const handlePlaylistDrop = (event: React.DragEvent, playlistId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOverPlaylistId(null);

        const payload = event.dataTransfer.getData('application/json');
        if (!payload) {
            return;
        }

        try {
            const parsed = JSON.parse(payload);
            if (Array.isArray(parsed.trackIds)) {
                dispatch({
                    type: 'LIBRARY_ADD_TRACKS_TO_PLAYLIST',
                    playlistId,
                    trackIds: parsed.trackIds,
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddToPlaylist = (event: React.MouseEvent, trackId: string) => {
        event.stopPropagation();

        if (playlists.length === 0) {
            return;
        }

        if (playlists.length === 1) {
            dispatch({
                type: 'LIBRARY_ADD_TO_PLAYLIST',
                playlistId: playlists[0].id,
                trackId,
            });
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        setShowPlaylistPicker({
            trackId,
            x: rect.left,
            y: rect.bottom + 4,
        });
    };

    const handleImportFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            dispatch({
                type: 'LIBRARY_IMPORT',
                files: Array.from(event.target.files),
            });
        }

        if (event.target) {
            event.target.value = '';
        }
    };

    return (
        <div
            className={`flex min-h-0 flex-1 overflow-hidden bg-transparent ${className}`}
            onClick={() => {
                setSelectedTrackIds(new Set());
                setLastSelectedId(null);
                setShowPlaylistPicker(null);
            }}
        >
            <input
                ref={realFileInputRef}
                type="file"
                onChange={handleImportFiles}
                multiple
                className="hidden"
                accept="audio/*"
            />

            <aside
                className="surface-panel mr-2 flex w-[220px] shrink-0 flex-col overflow-hidden rounded-panel"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-white/6 px-4 py-4">
                    <SectionLabel>Collection</SectionLabel>
                    <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                        {sourceLabel}
                    </div>
                </div>

                <div className="space-y-1 p-3">
                    <button
                        onClick={() => {
                            setActivePlaylistId(null);
                            setShowRecordings(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-btn-sm border px-3 py-2 text-left font-mono text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
                            !activePlaylistId && !showRecordings
                                ? 'border-signal-sync/30 bg-signal-sync/14 text-signal-sync'
                                : 'border-white/8 bg-black/30 text-text-secondary hover:border-white/14 hover:text-text-primary'
                        }`}
                    >
                        <span>All Tracks</span>
                        <span>{tracks.length}</span>
                    </button>
                    <button
                        onClick={() => {
                            setActivePlaylistId(null);
                            setShowRecordings(true);
                        }}
                        className={`flex w-full items-center justify-between rounded-btn-sm border px-3 py-2 text-left font-mono text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
                            showRecordings
                                ? 'border-signal-sync/30 bg-signal-sync/14 text-signal-sync'
                                : 'border-white/8 bg-black/30 text-text-secondary hover:border-white/14 hover:text-text-primary'
                        }`}
                    >
                        <span>Recordings</span>
                        <span>{recordings.length}</span>
                    </button>
                </div>

                <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <SectionLabel>Playlists</SectionLabel>
                    <button
                        onClick={() => setIsCreatingPlaylist(true)}
                        className="flex h-5 w-5 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 font-mono text-[10px] font-black text-text-secondary transition-all hover:border-white/18 hover:text-text-primary"
                    >
                        +
                    </button>
                </div>

                {isCreatingPlaylist ? (
                    <div className="px-4 pb-3">
                        <input
                            autoFocus
                            value={newPlaylistName}
                            onChange={(event) => setNewPlaylistName(event.target.value)}
                            onBlur={() => {
                                setIsCreatingPlaylist(false);
                                setNewPlaylistName('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    handleCreatePlaylist();
                                } else if (event.key === 'Escape') {
                                    setIsCreatingPlaylist(false);
                                    setNewPlaylistName('');
                                }
                            }}
                            placeholder="Playlist name"
                            className="w-full rounded-btn-sm border border-signal-sync/24 bg-black/45 px-3 py-2 font-mono text-[10px] text-text-primary outline-none transition-all focus:border-signal-sync/40"
                        />
                    </div>
                ) : null}

                <div className="custom-scrollbar flex-1 overflow-y-auto px-2 pb-3">
                    {playlists.length === 0 ? (
                        <div className="px-3 py-4 font-mono text-[8px] uppercase tracking-[0.18em] text-text-secondary">
                            No playlists yet
                        </div>
                    ) : (
                        playlists.map((playlist) => (
                            <div
                                key={playlist.id}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setDragOverPlaylistId(playlist.id);
                                }}
                                onDragLeave={() => setDragOverPlaylistId(null)}
                                onDrop={(event) => handlePlaylistDrop(event, playlist.id)}
                                className="group mb-1"
                            >
                                <button
                                    onClick={() => {
                                        setActivePlaylistId(playlist.id);
                                        setShowRecordings(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-btn-sm border px-3 py-2 text-left font-mono text-[9px] font-black uppercase tracking-[0.16em] transition-all ${
                                        activePlaylistId === playlist.id
                                            ? 'border-signal-nominal/28 bg-signal-nominal/12 text-signal-nominal'
                                            : dragOverPlaylistId === playlist.id
                                                ? 'border-signal-sync/28 bg-signal-sync/12 text-signal-sync'
                                                : 'border-transparent bg-black/20 text-text-secondary hover:border-white/10 hover:bg-black/35 hover:text-text-primary'
                                    }`}
                                >
                                    <span className="truncate">{playlist.name}</span>
                                    <span>{playlist.trackIds.length}</span>
                                </button>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        dispatch({ type: 'LIBRARY_DELETE_PLAYLIST', playlistId: playlist.id });
                                    }}
                                    className="mt-1 hidden w-full rounded-btn-sm border border-white/8 bg-black/25 px-3 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-signal-clipping/24 hover:text-signal-clipping group-hover:block"
                                >
                                    Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t border-white/6 p-3">
                    <button
                        onClick={() => realFileInputRef.current?.click()}
                        className="w-full rounded-btn-sm border border-white/10 bg-black/35 px-3 py-3 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-text-primary transition-all hover:border-white/18 hover:bg-white/[0.03]"
                    >
                        Import Audio
                    </button>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div
                    className="surface-panel flex items-center gap-3 rounded-panel px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="min-w-[180px]">
                        <SectionLabel>Library</SectionLabel>
                        <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                            {sourceLabel}
                        </div>
                    </div>

                    <div className="min-w-0 flex-1">
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search title, artist, album, genre, key"
                            className="w-full rounded-btn-sm border border-white/10 bg-black/35 px-3 py-2 font-mono text-[10px] text-text-primary outline-none transition-all placeholder:text-text-secondary focus:border-signal-sync/30"
                        />
                    </div>

                    <select
                        value={sortKey}
                        onChange={(event) => handleSortChange(event.target.value as keyof LibraryTrack)}
                        className="rounded-btn-sm border border-white/10 bg-black/35 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-text-primary outline-none"
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => setSortAsc((current) => !current)}
                        className="rounded-btn-sm border border-white/10 bg-black/35 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-text-primary transition-all hover:border-white/18"
                    >
                        {sortAsc ? 'Asc' : 'Desc'}
                    </button>

                    <div className="flex items-center gap-2">
                        <StatChip label="Tracks" value={filteredTracks.length} />
                        <StatChip label="Selected" value={selectedTrackIds.size} accent={selectedTrackIds.size > 0 ? 'blue' : null} />
                        {effectiveActiveKey ? <StatChip label="Active Key" value={effectiveActiveKey} accent="green" /> : null}
                    </div>
                </div>

                {showRecordings ? (
                    <div
                        className="surface-panel custom-scrollbar flex-1 overflow-y-auto rounded-panel p-4"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <SectionLabel>Recordings</SectionLabel>
                                <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                                    Recorded mixes
                                </div>
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-text-secondary">
                                {recordings.length} files
                            </div>
                        </div>

                        {recordings.length === 0 ? (
                            <div className="flex h-full min-h-[320px] items-center justify-center rounded-panel border border-dashed border-white/10 bg-black/25">
                                <div className="text-center">
                                    <div className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-text-primary">
                                        No recordings yet
                                    </div>
                                    <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                        Start a recording from the transport bar to build your archive.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {recordings.map((recording) => (
                                    <div
                                        key={recording.id}
                                        className="rounded-panel border border-white/8 bg-black/30 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-sans text-[16px] font-bold tracking-tight text-text-primary">
                                                    {recording.title}
                                                </div>
                                                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-text-secondary">
                                                    {formatDateValue(recording.dateRecorded)}
                                                </div>
                                            </div>
                                            <StatChip label="Length" value={formatTime(recording.duration)} />
                                        </div>
                                        <audio
                                            controls
                                            className="mt-4 w-full"
                                            src={getRecordingSource(recording.filePath)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 gap-2">
                        <div
                            className={`surface-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel ${
                                dragOverPlaylistId === 'library-root'
                                    ? 'border-signal-sync/30 bg-signal-sync/8'
                                    : ''
                            }`}
                            onClick={(event) => event.stopPropagation()}
                            onDragOver={(event) => {
                                if (event.dataTransfer.types.includes('Files')) {
                                    event.preventDefault();
                                    setDragOverPlaylistId('library-root');
                                }
                            }}
                            onDragLeave={() => setDragOverPlaylistId(null)}
                            onDrop={(event) => {
                                if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDragOverPlaylistId(null);
                                    dispatch({ type: 'LIBRARY_IMPORT', files: Array.from(event.dataTransfer.files) });
                                }
                            }}
                        >
                            <div role="row" className="grid grid-cols-[32px_minmax(0,2.2fr)_minmax(0,1.4fr)_72px_72px_108px_70px] gap-3 border-b border-white/6 px-4 py-3">
                                <div role="columnheader"><SectionLabel>+</SectionLabel></div>
                                <div role="columnheader" aria-sort={sortKey === 'title' ? (sortAsc ? 'ascending' : 'descending') : 'none'}><SectionLabel>Track</SectionLabel></div>
                                <div role="columnheader" aria-sort={sortKey === 'artist' ? (sortAsc ? 'ascending' : 'descending') : 'none'}><SectionLabel>Artist</SectionLabel></div>
                                <div role="columnheader" aria-sort={sortKey === 'bpm' ? (sortAsc ? 'ascending' : 'descending') : 'none'}><SectionLabel>BPM</SectionLabel></div>
                                <div role="columnheader" aria-sort={sortKey === 'key' ? (sortAsc ? 'ascending' : 'descending') : 'none'}><SectionLabel>Key</SectionLabel></div>
                                <div role="columnheader" aria-sort={sortKey === 'rating' ? (sortAsc ? 'ascending' : 'descending') : 'none'}><SectionLabel>Rating</SectionLabel></div>
                                <div role="columnheader"><SectionLabel>Time</SectionLabel></div>
                            </div>

                            <div role="grid" aria-label="Track library" className="custom-scrollbar flex-1 overflow-y-auto">
                                {filteredTracks.length === 0 ? (
                                    <div className="flex h-full min-h-[320px] items-center justify-center px-8">
                                        <div className="text-center">
                                            <div className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-text-primary">
                                                No tracks match this view
                                            </div>
                                            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                                Clear the filters or import fresh audio to continue building the collection.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    filteredTracks.map((track) => {
                                        const isSelected = selectedTrackIds.has(track.id);
                                        const isCompatible = Boolean(
                                            effectiveActiveKey
                                            && track.key
                                            && track.key !== '?'
                                            && isHarmonicMatch(effectiveActiveKey, track.key)
                                        );

                                        return (
                                            <motion.div
                                                key={track.id}
                                                draggable
                                                whileHover={{ x: 2 }}
                                                onDragStart={(event) => handleDragStart(event as unknown as React.DragEvent, track.id)}
                                                onClick={(event) => handleTrackClick(event, track.id)}
                                                role="row"
                                                className={`group relative grid grid-cols-[32px_minmax(0,2.2fr)_minmax(0,1.4fr)_72px_72px_108px_70px] gap-3 border-b border-white/[0.04] px-4 py-3 transition-all ${
                                                    isSelected
                                                        ? 'bg-signal-sync/14'
                                                        : isCompatible
                                                            ? 'bg-signal-nominal/[0.03] hover:bg-signal-nominal/[0.06]'
                                                            : 'hover:bg-white/[0.025]'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <div className="absolute inset-y-0 left-0 w-[2px] bg-signal-sync shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
                                                ) : isCompatible ? (
                                                    <div className="absolute inset-y-1 left-0 w-[2px] bg-signal-nominal/45" />
                                                ) : null}

                                                <div className="flex items-center justify-center">
                                                    <button
                                                        onClick={(event) => handleAddToPlaylist(event, track.id)}
                                                        className="flex h-5 w-5 items-center justify-center rounded-btn-sm border border-white/10 bg-black/30 font-mono text-[9px] font-black text-text-secondary opacity-0 transition-all hover:border-white/18 hover:text-text-primary group-hover:opacity-100"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="truncate font-sans text-[14px] font-semibold tracking-tight text-text-primary">
                                                        {track.title}
                                                    </div>
                                                    <div className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.16em] text-text-secondary">
                                                        {track.album || 'Unknown album'}
                                                    </div>
                                                </div>

                                                <div className="truncate font-mono text-[10px] font-medium text-text-secondary">
                                                    {track.artist}
                                                </div>

                                                <div className={`font-mono text-[10px] font-black ${isCompatible ? 'text-signal-nominal' : 'text-text-primary'}`}>
                                                    {track.bpm ? track.bpm.toFixed(1) : '--.-'}
                                                </div>

                                                <div className="flex items-center">
                                                    <div className={`rounded-btn-sm border px-2 py-1 font-mono text-[9px] font-black tracking-[0.12em] ${
                                                        isCompatible
                                                            ? 'border-signal-nominal/28 bg-signal-nominal/12 text-signal-nominal'
                                                            : 'border-white/8 bg-black/30 text-text-primary'
                                                    }`}>
                                                        {track.key || '--'}
                                                    </div>
                                                </div>

                                                <div className="flex items-center">
                                                    <StarRating
                                                        rating={track.rating || 0}
                                                        onChange={(rating) => dispatch({ type: 'LIBRARY_SET_RATING', trackId: track.id, rating })}
                                                    />
                                                </div>

                                                <div className="font-mono text-[10px] font-bold text-text-secondary">
                                                    {formatTime(track.duration)}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <aside
                            className="surface-panel flex w-[360px] shrink-0 flex-col overflow-hidden rounded-panel"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="border-b border-white/6 px-4 py-4">
                                <SectionLabel>Inspector</SectionLabel>
                                <div className="mt-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-text-primary">
                                    {focusedTrack ? 'Selected track' : 'Nothing selected'}
                                </div>
                            </div>

                            {focusedTrack ? (
                                <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                                    <div className="overflow-hidden rounded-panel border border-white/8 bg-black/30">
                                        <div className="relative aspect-square overflow-hidden border-b border-white/6">
                                            <OptimizedImage
                                                alt={focusedTrack.album}
                                                fallbackGradient={generateGradient(focusedTrack.id)}
                                                className="h-full w-full object-cover"
                                            />
                                            {selectedTrackIds.size > 1 ? (
                                                <div className="absolute right-3 top-3 rounded-full border border-signal-sync/28 bg-signal-sync/14 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em] text-signal-sync">
                                                    {selectedTrackIds.size} selected
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-4 p-4">
                                            <div>
                                                <div className="font-sans text-[20px] font-bold tracking-tight text-text-primary">
                                                    {focusedTrack.title}
                                                </div>
                                                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                                    {focusedTrack.artist || 'Unknown artist'}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <StatChip label="BPM" value={focusedTrack.bpm ? focusedTrack.bpm.toFixed(1) : '--.-'} accent="green" />
                                                <StatChip
                                                    label="Key"
                                                    value={focusedTrack.key || '--'}
                                                    accent={effectiveActiveKey && isHarmonicMatch(effectiveActiveKey, focusedTrack.key) ? 'green' : null}
                                                />
                                                <StatChip label="Length" value={formatTime(focusedTrack.duration)} />
                                                <StatChip label="Date" value={formatDateValue(focusedTrack.dateAdded)} />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => dispatch({ type: 'LOAD_TRACK', deckId: 'A', track: focusedTrack })}
                                                    className="rounded-btn-sm border border-signal-sync/28 bg-signal-sync/14 px-4 py-3 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-signal-sync transition-all hover:bg-signal-sync/22"
                                                >
                                                    Load Deck A
                                                </button>
                                                <button
                                                    onClick={() => dispatch({ type: 'LOAD_TRACK', deckId: 'B', track: focusedTrack })}
                                                    className="rounded-btn-sm border border-signal-sync/28 bg-signal-sync/14 px-4 py-3 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-signal-sync transition-all hover:bg-signal-sync/22"
                                                >
                                                    Load Deck B
                                                </button>
                                            </div>

                                            <button
                                                onClick={(event) => handleAddToPlaylist(event, focusedTrack.id)}
                                                disabled={playlists.length === 0}
                                                className={`w-full rounded-btn-sm border px-4 py-3 font-mono text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
                                                    playlists.length === 0
                                                        ? 'cursor-not-allowed border-white/8 bg-white/[0.03] text-white/25'
                                                        : 'border-white/10 bg-black/35 text-text-primary hover:border-white/18 hover:bg-white/[0.03]'
                                                }`}
                                            >
                                                Add to playlist
                                            </button>

                                            <div className="space-y-3 rounded-panel border border-white/6 bg-black/25 p-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <SectionLabel>Album</SectionLabel>
                                                        <div className="mt-1 font-mono text-[10px] text-text-primary">
                                                            {focusedTrack.album || 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <SectionLabel>Genre</SectionLabel>
                                                        <div className="mt-1 font-mono text-[10px] text-text-primary">
                                                            {focusedTrack.genre || 'Unknown'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <SectionLabel>Rating</SectionLabel>
                                                        <div className="mt-1">
                                                            <StarRating
                                                                rating={focusedTrack.rating || 0}
                                                                onChange={(rating) => dispatch({ type: 'LIBRARY_SET_RATING', trackId: focusedTrack.id, rating })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <SectionLabel>Status</SectionLabel>
                                                        <div className="mt-1 font-mono text-[10px] text-text-primary">
                                                            {focusedTrack.analyzed ? 'Analyzed' : 'Pending'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {effectiveActiveKey ? (
                                                    <div>
                                                        <SectionLabel>Harmonic match</SectionLabel>
                                                        <div className={`mt-1 font-mono text-[10px] ${
                                                            focusedTrack.key && isHarmonicMatch(effectiveActiveKey, focusedTrack.key)
                                                                ? 'text-signal-nominal'
                                                                : 'text-text-secondary'
                                                        }`}>
                                                            {focusedTrack.key && isHarmonicMatch(effectiveActiveKey, focusedTrack.key)
                                                                ? `Matches active deck key ${effectiveActiveKey}`
                                                                : `No direct harmonic match for ${effectiveActiveKey}`}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                <div>
                                                    <SectionLabel>Source</SectionLabel>
                                                    <div className="mt-1 break-all font-mono text-[9px] text-text-secondary">
                                                        {focusedTrack.filePath || 'No source path available'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-1 items-center justify-center p-8">
                                    <div className="max-w-[220px] text-center">
                                        <div className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-text-primary">
                                            Select a track
                                        </div>
                                        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                            The inspector shows metadata, harmonic context, and fast load actions for the current selection.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                )}
            </div>

            {showPlaylistPicker ? (
                <div
                    className="fixed z-[100] min-w-[220px] rounded-panel border border-white/14 bg-black/92 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                    style={{ left: showPlaylistPicker.x, top: showPlaylistPicker.y }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="border-b border-white/8 px-2 py-2 font-mono text-[8px] font-black uppercase tracking-[0.2em] text-text-data">
                        Add to playlist
                    </div>
                    <div className="pt-1">
                        {playlists.length === 0 ? (
                            <div className="px-2 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-text-secondary">
                                No playlists available
                            </div>
                        ) : (
                            playlists.map((playlist: Playlist) => (
                                <button
                                    key={playlist.id}
                                    onClick={() => {
                                        dispatch({
                                            type: 'LIBRARY_ADD_TO_PLAYLIST',
                                            playlistId: playlist.id,
                                            trackId: showPlaylistPicker.trackId,
                                        });
                                        setShowPlaylistPicker(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-btn-sm px-3 py-2 text-left font-mono text-[9px] font-black uppercase tracking-[0.16em] text-text-primary transition-all hover:bg-white/[0.05]"
                                >
                                    <span className="truncate">{playlist.name}</span>
                                    <span className="text-text-secondary">{playlist.trackIds.length}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
