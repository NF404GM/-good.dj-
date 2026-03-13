import React, { useState, useEffect, useCallback, useReducer, createContext, useContext, useRef } from 'react';
import { produce } from 'immer';
import {
    GlobalDjState,
    DeckAction,
    DeckState,
    StemType,
    EffectType,
    LibraryTrack,
    Playlist,
    StemPlaybackMode,
} from '../types';
import { AudioEngine } from '../services/audio';
import { MidiService } from '../services/midi';
import { LibraryService } from '../services/library';

const DEFAULT_STEMS = (): DeckState['stems'] => ({
    [StemType.LOW]: { active: true, volume: 1, param: 0.5 },
    [StemType.BASS]: { active: true, volume: 1, param: 0.5 },
    [StemType.MID]: { active: true, volume: 1, param: 0.5 },
    [StemType.HIGH]: { active: true, volume: 1, param: 0.5 },
});

const DEFAULT_EQ = () => ({ trim: 0.75, high: 0.75, mid: 0.75, low: 0.75 });

const DEFAULT_FX = (): DeckState['fx'] => ({
    active: false,
    activeType: EffectType.REVERB,
    wet: 0.3,
    knob1: 0.5,
    knob2: 0.5,
});

const createDeck = (id: string): DeckState => ({
    id,
    track: null,
    hasAudioBuffer: false,
    isPlaying: false,
    isLoading: false,
    progress: 0,
    pitch: 0,
    pitchRange: 0.08,
    level: 0,
    stems: DEFAULT_STEMS(),
    eq: DEFAULT_EQ(),
    fx: DEFAULT_FX(),
    cuePoints: [null, null, null, null, null, null, null, null],
    waveformData: null,
    activeLoop: null,
    gridOffset: 0,
    keyLock: false,
    keyShift: 0,
    color: 0.5,
    channelVolume: 1,
    isSynced: false,
    stemMode: 'filters' as StemPlaybackMode,
    isSeparatingStems: false,
});

const INITIAL_STATE: GlobalDjState = {
    activeDeckId: null,
    crossfader: 50,
    isRecording: false,
    recordingDuration: 0,
    settings: {
        isOpen: false,
        audioOutputId: '',
        midiMappings: {},
    },
    library: {
        tracks: [],
        playlists: [],
        isInitialized: false,
    },
    decks: {
        A: createDeck('A'),
        B: createDeck('B'),
    },
};

function djReducer(state: GlobalDjState, action: DeckAction): GlobalDjState {
    return produce(state, (draft) => {
        switch (action.type) {

            case 'TOGGLE_PLAY': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.track || !deck.hasAudioBuffer) break;
                const newIsPlaying = !deck.isPlaying;
                deck.isPlaying = newIsPlaying;
                if (newIsPlaying) {
                    AudioEngine.play(action.deckId);
                } else {
                    AudioEngine.pause(action.deckId);
                }
                break;
            }

            case 'SET_PLAYING': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isPlaying = action.value;
                break;
            }

            case 'CUE_MASTER': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.track || !deck.hasAudioBuffer) break;
                AudioEngine.jumpToCue(action.deckId, deck.cuePoint ?? 0);
                deck.isPlaying = false;
                break;
            }

            case 'SET_CUE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.track || !deck.hasAudioBuffer) break;
                const cueTime = AudioEngine.getCurrentTime(action.deckId);
                deck.cuePoints[action.index] = cueTime;
                break;
            }

            case 'TRIGGER_CUE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                const point = deck.cuePoints[action.index];
                if (point === null || point === undefined) break;
                AudioEngine.jumpToCue(action.deckId, point);
                break;
            }

            case 'DELETE_CUE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.cuePoints[action.index] = null;
                break;
            }

            case 'LOOP_TRACK': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.hasAudioBuffer) break;
                if (action.beats === null) {
                    deck.activeLoop = null;
                    AudioEngine.setLoop(action.deckId, null, null);
                } else {
                    deck.activeLoop = action.beats;
                    AudioEngine.setBeatLoop(action.deckId, action.beats, deck.track?.bpm ?? 120);
                }
                break;
            }

            case 'LOOP_HALVE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.activeLoop) break;
                const newBeats = Math.max(0.25, deck.activeLoop / 2);
                deck.activeLoop = newBeats;
                AudioEngine.setBeatLoop(action.deckId, newBeats, deck.track?.bpm ?? 120);
                break;
            }

            case 'LOOP_DOUBLE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.activeLoop) break;
                const newBeats = Math.min(64, deck.activeLoop * 2);
                deck.activeLoop = newBeats;
                AudioEngine.setBeatLoop(action.deckId, newBeats, deck.track?.bpm ?? 120);
                break;
            }

            case 'BEAT_JUMP': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.hasAudioBuffer) break;
                AudioEngine.beatJump(action.deckId, action.beats, deck.track?.bpm ?? 120);
                break;
            }

            case 'SEEK_POSITION': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (!deck.hasAudioBuffer) break;
                AudioEngine.seek(action.deckId, action.value);
                deck.progress = action.value;
                break;
            }

            case 'SET_PITCH': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.pitch = action.value;
                AudioEngine.setPitch(action.deckId, action.value, deck.pitchRange, deck.keyLock, deck.keyShift);
                break;
            }

            case 'SET_PITCH_RANGE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.pitchRange = action.value;
                AudioEngine.setPitch(action.deckId, deck.pitch, action.value, deck.keyLock, deck.keyShift);
                break;
            }

            case 'TOGGLE_KEY_LOCK': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.keyLock = !deck.keyLock;
                AudioEngine.setPitch(action.deckId, deck.pitch, deck.pitchRange, deck.keyLock, deck.keyShift);
                break;
            }

            case 'SET_KEY_SHIFT': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.keyShift = action.value;
                AudioEngine.setPitch(action.deckId, deck.pitch, deck.pitchRange, deck.keyLock, action.value);
                break;
            }

            case 'SET_VOLUME': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.stems[action.stem].volume = action.value;
                AudioEngine.setStemVolume(action.deckId, action.stem, action.value);
                break;
            }

            case 'TOGGLE_STEM': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.stems[action.stem].active = !deck.stems[action.stem].active;
                AudioEngine.setStemVolume(action.deckId, action.stem, deck.stems[action.stem].active ? deck.stems[action.stem].volume : 0);
                break;
            }

            case 'SET_STEM_PARAM': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.stems[action.stem].param = action.value;
                AudioEngine.setStemParam(action.deckId, action.stem, action.value);
                break;
            }

            case 'SET_EQ': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.eq[action.band] = action.value;
                AudioEngine.setEq(action.deckId, action.band, action.value);
                break;
            }

            case 'SET_COLOR_FILTER': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.color = action.value;
                AudioEngine.setColorFilter(action.deckId, action.value);
                break;
            }

            case 'TOGGLE_FX': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.fx.active = !deck.fx.active;
                AudioEngine.setFxWet(action.deckId, deck.fx.active ? deck.fx.wet : 0);
                break;
            }

            case 'SET_FX_WET': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.fx.wet = action.value;
                if (deck.fx.active) AudioEngine.setFxWet(action.deckId, action.value);
                break;
            }

            case 'SET_FX_TYPE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.fx.activeType = action.effectType;
                break;
            }

            case 'SET_FX_PARAM': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (action.knob === 1) {
                    deck.fx.knob1 = action.value;
                } else {
                    deck.fx.knob2 = action.value;
                }
                AudioEngine.setFxParam(action.deckId, action.knob, action.value);
                break;
            }

            case 'SET_CROSSFADER': {
                draft.crossfader = action.value;
                AudioEngine.setCrossfader(action.value);
                break;
            }

            case 'TOGGLE_SETTINGS': {
                draft.settings.isOpen = !draft.settings.isOpen;
                break;
            }

            case 'SET_AUDIO_OUTPUT': {
                draft.settings.audioOutputId = action.deviceId;
                break;
            }

            case 'LEARN_MIDI': {
                break;
            }

            case 'SET_GRID_OFFSET': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.gridOffset = action.value;
                break;
            }

            case 'TOGGLE_RECORDING': {
                draft.isRecording = !draft.isRecording;
                if (draft.isRecording) {
                    AudioEngine.startRecording();
                } else {
                    AudioEngine.stopRecording();
                    draft.recordingDuration = 0;
                }
                break;
            }

            case 'LOAD_TRACK': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.track = action.track;
                deck.isPlaying = false;
                deck.progress = 0;
                deck.cuePoints = [null, null, null, null, null, null, null, null];
                deck.activeLoop = null;
                deck.waveformData = null;
                deck.hasAudioBuffer = action.hasAudioBuffer ?? false;
                break;
            }

            case 'LOAD_FILE': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isLoading = true;
                deck.track = null;
                deck.hasAudioBuffer = false;
                break;
            }

            case 'SEPARATE_STEMS': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isSeparatingStems = true;
                break;
            }

            case 'EJECT_TRACK': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                if (deck.isPlaying) AudioEngine.pause(action.deckId);
                deck.track = null;
                deck.hasAudioBuffer = false;
                deck.isPlaying = false;
                deck.progress = 0;
                deck.cuePoints = [null, null, null, null, null, null, null, null];
                deck.activeLoop = null;
                deck.waveformData = null;
                AudioEngine.unloadDeck(action.deckId);
                break;
            }

            case 'DOUBLE_DECK': {
                const sourceDeck = draft.decks[action.deckId as 'A' | 'B'];
                const targetDeckId = action.deckId === 'A' ? 'B' : 'A';
                const targetDeck = draft.decks[targetDeckId];
                targetDeck.track = sourceDeck.track;
                targetDeck.waveformData = sourceDeck.waveformData;
                targetDeck.hasAudioBuffer = false;
                AudioEngine.copyDeck(action.deckId, targetDeckId);
                break;
            }

            case 'SET_LOADING': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isLoading = action.isLoading;
                break;
            }

            case 'SET_PROGRESS': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.progress = action.value;
                break;
            }

            case 'SET_LEVEL': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.level = action.level;
                break;
            }

            case 'SET_WAVEFORM': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.waveformData = action.data;
                break;
            }

            case 'LIBRARY_INIT': {
                draft.library.tracks = action.tracks;
                draft.library.playlists = action.playlists;
                draft.library.isInitialized = true;
                break;
            }

            case 'LIBRARY_IMPORT': {
                // File imports are handled by the useEffect side-effect below
                break;
            }

            case 'LIBRARY_ADD_TRACK': {
                const exists = draft.library.tracks.some((t) => t.id === action.track.id);
                if (!exists) {
                    draft.library.tracks.push(action.track);
                }
                break;
            }

            case 'LIBRARY_CREATE_PLAYLIST': {
                const id = action.playlistId ?? `playlist-${Date.now()}`;
                draft.library.playlists.push({
                    id,
                    name: action.name,
                    trackIds: [],
                });
                break;
            }

            case 'LIBRARY_DELETE_PLAYLIST': {
                draft.library.playlists = draft.library.playlists.filter((p) => p.id !== action.playlistId);
                break;
            }

            case 'LIBRARY_ADD_TO_PLAYLIST': {
                const playlist = draft.library.playlists.find((p) => p.id === action.playlistId);
                if (playlist && !playlist.trackIds.includes(action.trackId)) {
                    playlist.trackIds.push(action.trackId);
                }
                break;
            }

            case 'LIBRARY_ADD_TRACKS_TO_PLAYLIST': {
                const playlist = draft.library.playlists.find((p) => p.id === action.playlistId);
                if (playlist) {
                    for (const trackId of action.trackIds) {
                        if (!playlist.trackIds.includes(trackId)) {
                            playlist.trackIds.push(trackId);
                        }
                    }
                }
                break;
            }

            case 'LIBRARY_SET_RATING': {
                const track = draft.library.tracks.find((t) => t.id === action.trackId);
                if (track) track.rating = action.rating;
                break;
            }

            case 'TRACK_ENDED': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isPlaying = false;
                deck.progress = 0;
                break;
            }

            case 'SET_CHANNEL_VOLUME': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.channelVolume = action.value;
                AudioEngine.setChannelVolume(action.deckId, action.value);
                break;
            }

            case 'SET_STEMS_LOADING': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isSeparatingStems = action.value;
                break;
            }

            case 'STEMS_LOADED': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                deck.isSeparatingStems = false;
                deck.stemMode = 'real';
                break;
            }

            case 'UPDATE_TRACK_METADATA': {
                const deck = Object.values(draft.decks).find((d) => d.track?.id === action.trackId);
                if (deck?.track) {
                    if (action.bpm !== undefined) deck.track.bpm = action.bpm;
                    if (action.key !== undefined) deck.track.key = action.key;
                    if (action.beats !== undefined) deck.track.beats = action.beats;
                }
                const libTrack = draft.library.tracks.find((t) => t.id === action.trackId);
                if (libTrack) {
                    if (action.bpm !== undefined) libTrack.bpm = action.bpm;
                    if (action.key !== undefined) libTrack.key = action.key;
                    if (action.beats !== undefined) libTrack.beats = action.beats;
                }
                break;
            }

            case 'LIBRARY_REMOVE_TRACK': {
                draft.library.tracks = draft.library.tracks.filter((t) => t.id !== action.trackId);
                break;
            }

            case 'SYNC_DECK': {
                const deck = draft.decks[action.deckId as 'A' | 'B'];
                const otherDeckId = action.deckId === 'A' ? 'B' : 'A';
                const otherDeck = draft.decks[otherDeckId];

                if (!otherDeck.track || !deck.track) break;

                const masterBpm = otherDeck.track.bpm * (1 + (otherDeck.pitch * otherDeck.pitchRange));
                const targetPitch = (masterBpm / deck.track.bpm - 1) / deck.pitchRange;

                deck.pitch = Math.max(-1, Math.min(1, targetPitch));
                deck.isSynced = true;
                AudioEngine.setPitch(action.deckId, deck.pitch, deck.pitchRange, deck.keyLock, deck.keyShift);
                break;
            }

            default:
                break;
        }
    });
}

const DjStateContext = createContext<{
    state: GlobalDjState;
    dispatch: (action: DeckAction) => void;
    midiDevice: string | null;
} | null>(null);

export function DjProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(djReducer, INITIAL_STATE);
    const [midiDevice, setMidiDevice] = useState<string | null>(null);
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;

    useEffect(() => {
        AudioEngine.initialize().then(() => {
            console.log('[DJ] Audio engine initialized');
        }).catch(console.error);
    }, []);

    useEffect(() => {
        LibraryService.initialize().then(({ tracks, playlists }) => {
            dispatch({ type: 'LIBRARY_INIT', tracks, playlists });
        }).catch(console.error);
    }, []);

    useEffect(() => {
        MidiService.initialize((device) => setMidiDevice(device)).catch(console.error);
        return () => MidiService.dispose();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            for (const deckId of ['A', 'B'] as const) {
                const deck = state.decks[deckId];
                if (deck.isPlaying) {
                    const progress = AudioEngine.getProgress(deckId);
                    const level = AudioEngine.getLevel(deckId);
                    dispatchRef.current({ type: 'SET_PROGRESS', deckId, value: progress });
                    dispatchRef.current({ type: 'SET_LEVEL', deckId, level });
                }
            }
        }, 50);
        return () => clearInterval(interval);
    }, [state.decks]);

    const wrappedDispatch = useCallback((action: DeckAction) => {
        if (action.type === 'LOAD_FILE') {
            dispatch(action);
            AudioEngine.resume();
            AudioEngine.loadFile(action.deckId, action.file, (track) => {
                dispatchRef.current({ type: 'LOAD_TRACK', deckId: action.deckId, track, hasAudioBuffer: true });
                dispatchRef.current({ type: 'SET_LOADING', deckId: action.deckId, isLoading: false });
                AudioEngine.generateWaveformData(action.deckId, action.file).then((data) => {
                    dispatchRef.current({ type: 'SET_WAVEFORM', deckId: action.deckId, data });
                }).catch(console.error);
                AudioEngine.analyzeTrack(action.deckId, action.file).then((metadata) => {
                    if (metadata) dispatchRef.current({ type: 'UPDATE_TRACK_METADATA', trackId: track.id, ...metadata });
                }).catch(console.error);
                LibraryService.saveTrack({
                    ...track,
                    album: '',
                    genre: '',
                    rating: 0,
                    dateAdded: new Date().toISOString(),
                    analyzed: false,
                }, action.file).then((savedTrack) => {
                    dispatchRef.current({ type: 'LIBRARY_ADD_TRACK', track: savedTrack });
                }).catch(console.error);
            });
            return;
        }

        if (action.type === 'LIBRARY_IMPORT') {
            for (const file of action.files) {
                if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
                    AudioEngine.resume();
                    AudioEngine.loadFile('A', file, (track) => {
                        LibraryService.saveTrack({
                            ...track,
                            album: '',
                            genre: '',
                            rating: 0,
                            dateAdded: new Date().toISOString(),
                            analyzed: false,
                        }, file).then((savedTrack) => {
                            dispatchRef.current({ type: 'LIBRARY_ADD_TRACK', track: savedTrack });
                        }).catch(console.error);
                    });
                }
            }
            return;
        }

        dispatch(action);
    }, []);

    return React.createElement(
        DjStateContext.Provider,
        { value: { state, dispatch: wrappedDispatch, midiDevice } },
        children
    );
}

export function useDjState() {
    const ctx = useContext(DjStateContext);
    if (!ctx) throw new Error('useDjState must be used inside DjProvider');
    return ctx;
}
