import React, { useState, useEffect, useCallback, useReducer, useRef, useContext, createContext } from 'react';
import { produce } from 'immer';
import { GlobalDjState, DeckAction, DeckState, StemType, EffectType, TrackData, LibraryState, LibraryTrack } from '../types';
import { MOCK_LIBRARY } from '../constants';
import { MidiService } from '../services/midi';
import { AudioEngine } from '../services/audio';
import { goodDB } from '../services/library';
import { analyzeTrack, TrackAnalysisResult } from '../services/trackAnalyzer';
import { parseRekordboxXml } from '../services/rekordbox';

const createInitialDeck = (id: string, track: TrackData | null): DeckState => ({
    id,
    track,
    hasAudioBuffer: false,
    isPlaying: false,
    isLoading: false,
    progress: 0,
    pitch: 0,
    pitchRange: 0.08, // 8% Default
    level: 0,
    channelVolume: 0.8,
    stems: {
        [StemType.DRUMS]: { active: true, volume: 1, param: 0 },
        [StemType.BASS]: { active: true, volume: 1, param: 0.5 },
        [StemType.VOCALS]: { active: true, volume: 1, param: 0.5 },
        [StemType.HARMONIC]: { active: true, volume: 1, param: 0.5 },
    },
    eq: { trim: 0.75, high: 0.5, mid: 0.5, low: 0.5 },
    fx: { active: false, activeType: EffectType.DELAY, wet: 0.5, knob1: 0.5, knob2: 0.5 },
    cuePoints: Array(8).fill(null),
    waveformData: null,
    activeLoop: null,
    gridOffset: 0,
    keyLock: false,
    keyShift: 0,
    color: 0.5,
    isSynced: false
});

// Load saved mappings (guarded for incognito / restricted contexts)
let initialMappings: Record<string, any> = {};
try {
    const savedMappings = localStorage.getItem('good_dj_midi_map');
    if (savedMappings) initialMappings = JSON.parse(savedMappings);
} catch { /* localStorage unavailable */ }

const initialLibrary: LibraryState = {
    tracks: [],
    playlists: [],
    isInitialized: false
};

export const initialState: GlobalDjState = {
    activeDeckId: null,
    crossfader: 50,
    isRecording: false,
    recordingDuration: 0,
    settings: {
        isOpen: false,
        audioOutputId: 'default',
        midiMappings: initialMappings
    },
    library: initialLibrary,
    decks: {
        A: createInitialDeck('A', null),
        B: createInitialDeck('B', null),
    },
};



export const djReducer = (state: GlobalDjState, action: DeckAction): GlobalDjState => produce(state, (draft: GlobalDjState) => {
    switch (action.type) {
        case 'TOGGLE_PLAY': {
            const deck = draft.decks[action.deckId as 'A' | 'B'];
            if (!deck.track || !deck.hasAudioBuffer) return;
            draft.activeDeckId = action.deckId;
            deck.isPlaying = !deck.isPlaying;
            break;
        }
        case 'SYNC_DECK':
            draft.activeDeckId = action.deckId;
            draft.decks[action.deckId as 'A' | 'B'].isSynced = true;
            break;

        case 'TOGGLE_SETTINGS':
            draft.settings.isOpen = !draft.settings.isOpen;
            break;
        case 'SET_AUDIO_OUTPUT':
            draft.settings.audioOutputId = action.deviceId;
            break;
        case 'SET_LOADING':
            draft.decks[action.deckId as 'A' | 'B'].isLoading = action.isLoading;
            break;
        case 'TRACK_ENDED':
            draft.decks[action.deckId as 'A' | 'B'].isPlaying = false;
            draft.decks[action.deckId as 'A' | 'B'].progress = 1.0;
            break;
        case 'SET_CHANNEL_VOLUME':
            draft.decks[action.deckId as 'A' | 'B'].channelVolume = action.value;
            break;
        case 'SET_PROGRESS':
            draft.decks[action.deckId as 'A' | 'B'].progress = action.value;
            break;
        case 'SEEK_POSITION':
            draft.decks[action.deckId as 'A' | 'B'].progress = action.value;
            break;
        case 'SET_LEVEL':
            draft.decks[action.deckId as 'A' | 'B'].level = action.level;
            break;
        case 'SET_VOLUME':
            draft.decks[action.deckId as 'A' | 'B'].stems[action.stem].volume = action.value;
            break;
        case 'TOGGLE_STEM': {
            const stem = draft.decks[action.deckId as 'A' | 'B'].stems[action.stem];
            stem.active = !stem.active;
            break;
        }
        case 'SET_STEM_PARAM':
            draft.decks[action.deckId as 'A' | 'B'].stems[action.stem].param = action.value;
            break;
        case 'SET_EQ':
            draft.decks[action.deckId as 'A' | 'B'].eq[action.band] = action.value;
            break;
        case 'SET_COLOR_FILTER':
            draft.decks[action.deckId as 'A' | 'B'].color = action.value;
            break;

        case 'TOGGLE_FX': {
            const fx = draft.decks[action.deckId as 'A' | 'B'].fx;
            fx.active = !fx.active;
            break;
        }
        case 'SET_FX_WET':
            draft.decks[action.deckId as 'A' | 'B'].fx.wet = action.value;
            break;
        case 'SET_FX_TYPE':
            draft.decks[action.deckId as 'A' | 'B'].fx.activeType = action.effectType;
            break;
        case 'SET_FX_PARAM':
            const fx = draft.decks[action.deckId as 'A' | 'B'].fx;
            if (action.knob === 1) fx.knob1 = action.value;
            else fx.knob2 = action.value;
            break;

        case 'SET_CUE':
            draft.decks[action.deckId as 'A' | 'B'].cuePoints[action.index] = draft.decks[action.deckId as 'A' | 'B'].progress;
            break;
        case 'DELETE_CUE':
            draft.decks[action.deckId as 'A' | 'B'].cuePoints[action.index] = null;
            break;
        case 'TRIGGER_CUE': {
            const val = draft.decks[action.deckId as 'A' | 'B'].cuePoints[action.index];
            if (val !== null) draft.decks[action.deckId as 'A' | 'B'].progress = val;
            break;
        }
        case 'CUE_MASTER':
            draft.decks[action.deckId as 'A' | 'B'].isPlaying = false;
            break;
        case 'LOOP_TRACK':
            draft.decks[action.deckId as 'A' | 'B'].activeLoop = action.beats;
            break;

        case 'LOAD_TRACK': {
            const d = draft.decks[action.deckId as 'A' | 'B'];
            d.track = action.track;
            d.hasAudioBuffer = action.hasAudioBuffer ?? false;
            d.waveformData = null;
            d.isPlaying = false;
            d.progress = 0;
            d.cuePoints = Array(8).fill(null);
            d.eq = { trim: 0.75, high: 0.5, mid: 0.5, low: 0.5 };
            d.gridOffset = 0;
            d.keyLock = false;
            d.keyShift = 0;
            d.color = 0.5;
            d.pitch = 0;
            d.channelVolume = 0.8;
            d.isSynced = false;
            break;
        }
        case 'EJECT_TRACK':
            draft.decks[action.deckId as 'A' | 'B'] = createInitialDeck(action.deckId, null);
            break;

        case 'DOUBLE_DECK': {
            const targetId = action.deckId as 'A' | 'B';
            const sourceId = targetId === 'A' ? 'B' : 'A';
            const source = draft.decks[sourceId];
            if (!source.track) return;
            const target = draft.decks[targetId];
            target.track = source.track;
            target.hasAudioBuffer = source.hasAudioBuffer;
            target.waveformData = source.waveformData;
            target.pitch = source.pitch;
            target.gridOffset = source.gridOffset;
            target.cuePoints = [...source.cuePoints];
            target.isPlaying = false;
            break;
        }

        case 'SET_WAVEFORM':
            draft.decks[action.deckId as 'A' | 'B'].waveformData = action.data;
            break;
        case 'UPDATE_TRACK_METADATA': {
            const track = draft.decks[action.deckId as 'A' | 'B'].track;
            if (track) {
                track.bpm = action.bpm;
                track.key = action.key;
            }
            break;
        }
        case 'SET_PITCH':
            draft.decks[action.deckId as 'A' | 'B'].pitch = action.value;
            draft.decks[action.deckId as 'A' | 'B'].isSynced = false;
            break;
        case 'SET_PITCH_RANGE':
            draft.decks[action.deckId as 'A' | 'B'].pitchRange = action.value;
            break;
        case 'TOGGLE_KEY_LOCK':
            draft.decks[action.deckId as 'A' | 'B'].keyLock = !draft.decks[action.deckId as 'A' | 'B'].keyLock;
            break;
        case 'SET_KEY_SHIFT':
            draft.decks[action.deckId as 'A' | 'B'].keyShift = action.value;
            break;
        case 'SET_CROSSFADER':
            draft.crossfader = action.value;
            break;
        case 'SET_GRID_OFFSET':
            draft.decks[action.deckId as 'A' | 'B'].gridOffset = action.value;
            break;
        case 'TOGGLE_RECORDING':
            draft.isRecording = !draft.isRecording;
            draft.recordingDuration = 0;
            break;

        case 'LIBRARY_INIT':
            draft.library.tracks = action.tracks;
            draft.library.playlists = action.playlists;
            draft.library.isInitialized = true;
            break;
        case 'LIBRARY_ADD_TRACK':
            draft.library.tracks.push(action.track);
            break;
        case 'LIBRARY_CREATE_PLAYLIST':
            draft.library.playlists.push({
                id: action.playlistId ?? `pl-${Date.now()}`,
                name: action.name,
                trackIds: []
            });
            break;
        case 'LIBRARY_DELETE_PLAYLIST':
            draft.library.playlists = draft.library.playlists.filter(p => p.id !== action.playlistId);
            break;
        case 'LIBRARY_ADD_TO_PLAYLIST': {
            const playlist = draft.library.playlists.find(p => p.id === action.playlistId);
            if (playlist && !playlist.trackIds.includes(action.trackId)) {
                playlist.trackIds.push(action.trackId);
            }
            break;
        }
        case 'LIBRARY_ADD_TRACKS_TO_PLAYLIST': {
            const playlist = draft.library.playlists.find(p => p.id === action.playlistId);
            if (playlist) {
                action.trackIds.forEach(tid => {
                    if (!playlist.trackIds.includes(tid)) playlist.trackIds.push(tid);
                });
            }
            break;
        }
        case 'LIBRARY_SET_RATING': {
            const track = draft.library.tracks.find(t => t.id === action.trackId);
            if (track) track.rating = action.rating;
            break;
        }
    }
});

// --- CONTEXT SETUP ---

const DjContext = createContext<{
    state: GlobalDjState;
    dispatch: (action: DeckAction) => void;
    midiDevice: string | null;
} | null>(null);

// --- STORE LOGIC ---
function useDjStore() {
    const [state, dispatch] = useReducer(djReducer, initialState);
    const [midiDevice, setMidiDevice] = useState<string | null>(null);
    const midiServiceRef = useRef<MidiService | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;



    useEffect(() => {
        try {
            // Sync Audio Engine Crossfader and Volumes on mount
            AudioEngine.setCrossfader(state.crossfader);
            AudioEngine.setChannelGain('A', state.decks.A.channelVolume);
            AudioEngine.setChannelGain('B', state.decks.B.channelVolume);
        } catch (e) {
            console.warn('[useDjStore] Initial AudioEngine sync failed:', e);
        }

        midiServiceRef.current = new MidiService(
            (action) => handleAction(action),
            (connected, name) => setMidiDevice(connected ? name : null)
        );
        midiServiceRef.current.init();
        midiServiceRef.current.setMappings(state.settings.midiMappings);

        const initLib = async () => {
            await goodDB.init();
            const tracks = await goodDB.getAllTracks();
            const playlists = await goodDB.getAllPlaylists();
            const finalTracks = tracks.length > 0 ? tracks : MOCK_LIBRARY;
            dispatch({ type: 'LIBRARY_INIT', tracks: finalTracks, playlists });
        };
        initLib();

        // --- PROLINK HARDWARE INTEGRATION ---
        if (window.gooddj) {
            window.gooddj.onPlayerStatus((status) => {
                console.log(`[good.dj ProLink] CDJ Status Update:`, status);
                // Dispatch logic for ProLink status (Phase 8 requirement)
                // For now, we just log to verify connection
            });

            window.gooddj.onDeviceUpdate((data) => {
                console.log(`[good.dj ProLink] Device update:`, data);
            });
        }

        return () => {
            AudioEngine.onTrackEnd = null;
        };
    }, []);

    const handleAction = useCallback(async (action: DeckAction) => {
        if (action.type === 'TOGGLE_PLAY') {
            const deckState = stateRef.current.decks[action.deckId as 'A' | 'B'];
            if (deckState.track && deckState.hasAudioBuffer) {
                if (deckState.isPlaying) AudioEngine.pause(action.deckId);
                else AudioEngine.play(action.deckId);
            } else if (!deckState.hasAudioBuffer) {
                return;
            }
        }
        else if (action.type === 'SYNC_DECK') {
            const target = action.deckId;
            const master = target === 'A' ? 'B' : 'A';
            const masterTrack = stateRef.current.decks[master].track;
            const targetTrack = stateRef.current.decks[target].track;
            if (masterTrack && targetTrack) {
                const masterDeck = stateRef.current.decks[master];
                const effectiveMasterBpm = masterTrack.bpm * (1 + (masterDeck.pitch * masterDeck.pitchRange));
                const requiredPitch = ((effectiveMasterBpm / targetTrack.bpm) - 1);
                const range = stateRef.current.decks[target].pitchRange;
                const sliderVal = Math.max(-1, Math.min(1, requiredPitch / range));
                dispatch({ type: 'SET_PITCH', deckId: target, value: sliderVal });
                AudioEngine.setPitch(target, sliderVal * range);
                AudioEngine.syncDecks(target, master, effectiveMasterBpm);
            }
        }
        else if (action.type === 'SET_PITCH') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            const effective = action.value * deck.pitchRange;
            AudioEngine.setPitch(action.deckId, effective);
        }
        else if (action.type === 'SET_PITCH_RANGE') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            const effective = deck.pitch * action.value;
            AudioEngine.setPitch(action.deckId, effective);
        }
        else if (action.type === 'SET_CHANNEL_VOLUME') AudioEngine.setChannelGain(action.deckId, action.value);
        else if (action.type === 'SET_EQ') AudioEngine.setEq(action.deckId, action.band, action.value);
        else if (action.type === 'SET_VOLUME') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            const active = deck.stems[action.stem].active;
            AudioEngine.setStemState(action.deckId, action.stem, action.value, active);
        }
        else if (action.type === 'TOGGLE_STEM') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            const stemState = deck.stems[action.stem];
            AudioEngine.setStemState(action.deckId, action.stem, stemState.volume, !stemState.active);
        }
        else if (action.type === 'TOGGLE_FX') {
            const fxState = stateRef.current.decks[action.deckId as 'A' | 'B'].fx;
            AudioEngine.setFx(action.deckId, fxState.activeType, fxState.wet, !fxState.active);
        }
        else if (action.type === 'SET_FX_WET') {
            const fxState = stateRef.current.decks[action.deckId as 'A' | 'B'].fx;
            AudioEngine.setFx(action.deckId, fxState.activeType, action.value, fxState.active);
        }
        else if (action.type === 'SET_FX_TYPE') {
            const fxState = stateRef.current.decks[action.deckId as 'A' | 'B'].fx;
            AudioEngine.setFx(action.deckId, action.effectType, fxState.wet, fxState.active);
            // Default parameters on type change
            if (action.effectType === EffectType.DELAY || action.effectType === EffectType.ECHO) {
                AudioEngine.setFxParam(action.deckId, 1, fxState.knob1, action.effectType);
                AudioEngine.setFxParam(action.deckId, 2, fxState.knob2, action.effectType);
            } else if (action.effectType === EffectType.REVERB) {
                AudioEngine.setFxParam(action.deckId, 1, fxState.knob1, action.effectType);
                AudioEngine.setFxParam(action.deckId, 2, fxState.knob2, action.effectType);
            }
        }
        else if (action.type === 'SET_FX_PARAM') {
            const type = stateRef.current.decks[action.deckId as 'A' | 'B'].fx.activeType;
            AudioEngine.setFxParam(action.deckId, action.knob, action.value, type);
        }
        else if (action.type === 'TRIGGER_CUE') {
            const deckState = stateRef.current.decks[action.deckId as 'A' | 'B'];
            const val = deckState.cuePoints[action.index];
            if (val !== null) {
                AudioEngine.seek(action.deckId, val);
                // True Hot Cue behavior: hitting it immediately starts playback
                if (!deckState.isPlaying) {
                    AudioEngine.play(action.deckId);
                    dispatch({ type: 'TOGGLE_PLAY', deckId: action.deckId });
                }
            }
        }
        else if (action.type === 'CUE_MASTER') AudioEngine.handleCue(action.deckId);
        else if (action.type === 'LOOP_TRACK') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            if (deck.track) AudioEngine.setLoop(action.deckId, action.beats, deck.track.bpm, deck.track.beats);
        }
        else if (action.type === 'LOOP_HALVE') {
            AudioEngine.halveLoop(action.deckId);
        }
        else if (action.type === 'LOOP_DOUBLE') {
            AudioEngine.doubleLoop(action.deckId);
        }
        else if (action.type === 'BEAT_JUMP') {
            const deck = stateRef.current.decks[action.deckId as 'A' | 'B'];
            if (deck.track) AudioEngine.beatJump(action.deckId, action.beats, deck.track.bpm, deck.track.beats);
        }
        else if (action.type === 'SEEK_POSITION') AudioEngine.seek(action.deckId, action.value);
        else if (action.type === 'SET_CROSSFADER') AudioEngine.setCrossfader(action.value);
        else if (action.type === 'SET_AUDIO_OUTPUT') AudioEngine.setAudioOutput(action.deviceId);
        else if (action.type === 'EJECT_TRACK') AudioEngine.eject(action.deckId);
        else if (action.type === 'SET_GRID_OFFSET') AudioEngine.setGridOffset(action.deckId, action.value);
        else if (action.type === 'TOGGLE_RECORDING') {
            if (stateRef.current.isRecording) AudioEngine.stopRecording();
            else AudioEngine.startRecording();
        }
        else if (action.type === 'SET_COLOR_FILTER') AudioEngine.setColorFilter(action.deckId, action.value);
        else if (action.type === 'TOGGLE_KEY_LOCK') AudioEngine.setKeyLock(action.deckId, !stateRef.current.decks[action.deckId as 'A' | 'B'].keyLock);
        else if (action.type === 'SET_KEY_SHIFT') AudioEngine.setKeyShift(action.deckId, action.value);

        else if (action.type === 'DOUBLE_DECK') {
            const sourceId = action.deckId === 'A' ? 'B' : 'A';
            if (stateRef.current.decks[sourceId].track) {
                AudioEngine.cloneDeck(sourceId, action.deckId);
            }
        }

        else if (action.type === 'LOAD_FILE') {
            const currentDeck = stateRef.current.decks[action.deckId as 'A' | 'B'];

            // Stop playing if it is currently playing
            if (currentDeck.isPlaying) {
                AudioEngine.pause(action.deckId);
                dispatch({ type: 'TRACK_ENDED', deckId: action.deckId });
            }

            dispatch({ type: 'SET_LOADING', deckId: action.deckId, isLoading: true });
            try {
                const { duration, waveform } = await AudioEngine.loadFile(action.deckId, action.file);

                // Get a reference to the buffer for analysis before dispatching LOAD_TRACK
                // (LOAD_TRACK will clear the old buffer state)
                const loadedBuffer = AudioEngine.getBuffer(action.deckId);

                dispatch({
                    type: 'LOAD_TRACK',
                    deckId: action.deckId,
                    track: {
                        id: `local-${Date.now()}`,
                        title: action.file.name.replace(/\.[^/.]+$/, "").substring(0, 30),
                        artist: "LOCAL AUDIO",
                        bpm: 124.0,
                        key: '1A',
                        duration: duration
                    },
                    hasAudioBuffer: true
                });
                dispatch({ type: 'SET_WAVEFORM', deckId: action.deckId, data: waveform });
                // Background: Run Essentia.js analysis
                if (loadedBuffer) {
                    const filePath = (action.file as any).path;
                    analyzeTrack(loadedBuffer, filePath).then((result) => {
                        dispatch({ type: 'UPDATE_TRACK_METADATA', deckId: action.deckId, bpm: result.bpm, key: result.key });
                    }).catch((err) => console.warn('[useDjState] Track analysis failed:', err));
                }
            } catch (err) {
                console.error("Critical: Failed to load file", err);
            } finally {
                dispatch({ type: 'SET_LOADING', deckId: action.deckId, isLoading: false });
            }
            return;
        }

        else if (action.type === 'LOAD_TRACK') {
            const currentDeck = stateRef.current.decks[action.deckId as 'A' | 'B'];

            // Stop playing if it is currently playing
            if (currentDeck.isPlaying) {
                AudioEngine.pause(action.deckId);
                dispatch({ type: 'TRACK_ENDED', deckId: action.deckId });
            }

            // Try to load audio blob from IndexedDB
            const blob = await goodDB.getTrackBlob(action.track.id);
            if (blob) {
                dispatch({ type: 'SET_LOADING', deckId: action.deckId, isLoading: true });
                try {
                    const { duration, waveform } = await AudioEngine.loadFile(action.deckId, blob as File);
                    // Update track with real duration if it was 0
                    const updatedTrack = { ...action.track, duration: duration || action.track.duration };
                    dispatch({ type: 'LOAD_TRACK', deckId: action.deckId, track: updatedTrack, hasAudioBuffer: true });
                    dispatch({ type: 'SET_WAVEFORM', deckId: action.deckId, data: waveform });
                    // Background: Run Essentia.js analysis
                    const loadedBuffer = AudioEngine.getBuffer(action.deckId);
                    if (loadedBuffer) {
                        const filePath = (action.track as LibraryTrack).filePath;
                        analyzeTrack(loadedBuffer, filePath).then((result) => {
                            dispatch({ type: 'UPDATE_TRACK_METADATA', deckId: action.deckId, bpm: result.bpm, key: result.key });
                        }).catch((err) => console.warn('[useDjState] Track analysis failed:', err));
                    }
                } catch (e) { console.error("DB Load Error", e); }
                dispatch({ type: 'SET_LOADING', deckId: action.deckId, isLoading: false });
            } else {
                // Track is from mock library — no audio blob exists
                // Still update the deck state so user sees the track info
                dispatch({ type: 'LOAD_TRACK', deckId: action.deckId, track: action.track, hasAudioBuffer: false });
            }
            return;
        }
        else if (action.type === 'LIBRARY_IMPORT') {
            console.log(`[good.dj] DEBUG: Starting library import session for ${action.files.length} files`);

            try {
                for (const file of action.files) {
                    try {
                        if (file.name.toLowerCase().endsWith('.xml')) {
                            console.log(`[good.dj] Processing Rekordbox XML: ${file.name}`);
                            const entries = await parseRekordboxXml(file);
                            await goodDB.saveRekordboxCache(entries);
                            console.log(`[good.dj] Saved ${Object.keys(entries).length} tracking keys from Rekordbox XML Cache`);
                            continue;
                        }

                        console.log(`[good.dj] DEBUG: Processing track: ${file.name}`);
                        const baseName = file.name.replace(/\.[^/.]+$/, "");
                        const id = `t-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                        const track: LibraryTrack = {
                            id,
                            title: baseName,
                            artist: 'Unknown Artist',
                            album: 'Imported',
                            genre: 'Unknown',
                            bpm: 120,
                            key: '1A',
                            duration: 0,
                            rating: 0,
                            dateAdded: new Date().toISOString().split('T')[0],
                            analyzed: false
                        };

                        const searchKey = baseName.toLowerCase().trim();
                        const cached = await goodDB.getRekordboxEntry(searchKey);

                        if (cached) {
                            console.log(`[good.dj] DEBUG: Rekordbox cache hit for: ${baseName}`);
                            track.title = cached.title;
                            track.artist = cached.artist;
                            track.bpm = cached.bpm;
                            track.key = cached.key;
                            track.duration = cached.duration;
                            track.analyzed = true;
                        } else {
                            console.log(`[good.dj] DEBUG: Decoding audio for analysis: ${file.name}`);
                            const arrayBuffer = await file.arrayBuffer();
                            const decoded = await AudioEngine.decodeAudioData(arrayBuffer);
                            track.duration = decoded.duration;

                            try {
                                console.log(`[good.dj] DEBUG: Starting MIR analysis (15s timeout): ${file.name}`);
                                const analysisPromise = analyzeTrack(decoded);
                                const timeoutPromise = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error("MIR Analysis Timeout")), 15000)
                                );

                                const analysis = await Promise.race([analysisPromise, timeoutPromise]) as TrackAnalysisResult;
                                track.bpm = analysis.bpm;
                                track.key = analysis.key;
                                track.beats = analysis.beats;
                                track.analyzed = true;
                                console.log(`[good.dj] DEBUG: MIR analysis success: ${file.name}`);
                            } catch (analysisErr) {
                                console.warn(`[good.dj] WARN: Analysis failed or timed out for ${file.name}:`, analysisErr);
                            }
                        }

                        await goodDB.saveTrack(track, file);
                        dispatch({ type: 'LIBRARY_ADD_TRACK', track });
                        console.log(`[good.dj] SUCCESS: Imported ${file.name}`);
                    } catch (fileErr) {
                        console.error(`[useDjState] Failed to process file ${file.name}:`, fileErr);
                    }
                }
            } finally {
                console.log(`[good.dj] Library import session complete.`);
            }
        }
        else if (action.type === 'LIBRARY_CREATE_PLAYLIST') {
            const playlist = await goodDB.createPlaylist(action.name);
            dispatch({ type: 'LIBRARY_CREATE_PLAYLIST', name: playlist.name, playlistId: playlist.id });
            return;
        }
        else if (action.type === 'LIBRARY_DELETE_PLAYLIST') {
            await goodDB.deletePlaylist(action.playlistId);
        }
        else if (action.type === 'LIBRARY_ADD_TO_PLAYLIST') {
            await goodDB.addTrackToPlaylist(action.playlistId, action.trackId);
        }
        else if (action.type === 'LIBRARY_ADD_TRACKS_TO_PLAYLIST') {
            await goodDB.addTracksToPlaylist(action.playlistId, action.trackIds);
        }
        else if (action.type === 'LIBRARY_SET_RATING') {
            await goodDB.setTrackRating(action.trackId, action.rating);
        }

        if (action.type === 'LEARN_MIDI') {
            if (midiServiceRef.current) {
                midiServiceRef.current.enableLearn(action.actionId, (mapping) => {
                    const newMappings = { ...stateRef.current.settings.midiMappings, [action.actionId]: mapping };
                    localStorage.setItem('good_dj_midi_map', JSON.stringify(newMappings));
                    midiServiceRef.current?.setMappings(newMappings);
                    console.log(`MIDI: Mapped ${action.actionId} to ${mapping.type.toUpperCase()} on Ch${mapping.channel}`);
                });
            }
        }

        dispatch(action);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Prevent space/enter from firing twice if user is focused on a button or input
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'BUTTON' || activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                handleAction({ type: 'TOGGLE_PLAY', deckId: 'A' });
            }
            if (e.code === 'Enter') {
                e.preventDefault();
                handleAction({ type: 'TOGGLE_PLAY', deckId: 'B' });
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleAction]);

    useEffect(() => {
        let animationFrameId: number;
        // Track previous values to avoid redundant dispatches
        let prevProgA = 0, prevProgB = 0, prevLevA = 0, prevLevB = 0;
        const PROGRESS_THRESHOLD = 0.0005;
        const LEVEL_THRESHOLD = 0.005;

        const loop = () => {
            const progA = AudioEngine.getProgress('A');
            const progB = AudioEngine.getProgress('B');
            const levA = AudioEngine.getLevel('A');
            const levB = AudioEngine.getLevel('B');

            if (Math.abs(progA - prevProgA) > PROGRESS_THRESHOLD) {
                dispatch({ type: 'SET_PROGRESS', deckId: 'A', value: progA });
                prevProgA = progA;
            }
            if (Math.abs(progB - prevProgB) > PROGRESS_THRESHOLD) {
                dispatch({ type: 'SET_PROGRESS', deckId: 'B', value: progB });
                prevProgB = progB;
            }
            if (Math.abs(levA - prevLevA) > LEVEL_THRESHOLD || (levA < 0.01 && prevLevA >= 0.01)) {
                dispatch({ type: 'SET_LEVEL', deckId: 'A', level: levA });
                prevLevA = levA;
            }
            if (Math.abs(levB - prevLevB) > LEVEL_THRESHOLD || (levB < 0.01 && prevLevB >= 0.01)) {
                dispatch({ type: 'SET_LEVEL', deckId: 'B', level: levB });
                prevLevB = levB;
            }

            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return { state, dispatch: handleAction, midiDevice };
}

// --- EXPORTS ---

export const DjProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const store = useDjStore();
    return React.createElement(DjContext.Provider, { value: store }, children);
};

export function useDjState() {
    const context = useContext(DjContext);
    if (!context) {
        throw new Error("useDjState must be used within a DjProvider");
    }
    return context;
}





















