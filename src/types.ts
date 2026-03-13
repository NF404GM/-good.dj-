

export interface TrackData {
    id: string;
    title: string;
    artist: string;
    bpm: number;
    key: string;
    duration: number; // seconds
    beats?: number[]; // Array of beat timestamps in seconds for quantized looping
    filePath?: string;
}

export interface LibraryTrack extends TrackData {
    album: string;
    genre: string;
    rating: number; // 0-5
    dateAdded: string;
    analyzed: boolean;
    storageKey?: number; // IndexedDB ID
    fileBlob?: Blob; // For transient access or re-hydration
    filePath?: string; // Optional backend path
}

export interface Playlist {
    id: string;
    name: string;
    trackIds: string[];
}

export enum StemType {
    LOW = 'LOW',
    BASS = 'BASS',
    MID = 'MID',
    HIGH = 'HIGH',
}

export type StemPlaybackMode = 'filters' | 'real';

export interface StemSeparationResult {
    drums: Float32Array;
    bass: Float32Array;
    other: Float32Array;
    vocals: Float32Array;
    sampleRate: number;
}

export interface StemModelStatus {
    available: boolean;
    source: 'environment' | 'user-installed' | 'bundled' | 'dev-resource' | null;
    path: string | null;
    fileName: string | null;
    inputName: string | null;
    outputName: string | null;
    inputShape: Array<string | number | null | undefined>;
    outputShape: Array<string | number | null | undefined>;
    message: string;
}



export enum EffectType {
    REVERB = 'REVERB',
    DELAY = 'DELAY',
    ECHO = 'ECHO', // Simulated via Delay settings
    GATER = 'GATER', // Simulated via Volume modulation (future)
}

// --- AUDIO ENGINE TYPES ---

export interface AudioDeck {
    source: AudioBufferSourceNode | null;
    stretchNode: any | null; // For Signalsmith Stretch
    isKeyLockEnabled: boolean;
    isLooping: boolean;
    loopStart: number; // Loop start time in seconds (0 if no loop)
    loopEnd: number;   // Loop end time in seconds (0 if no loop)
    volumeNode: GainNode; // Channel Volume
    crossfaderNode: GainNode; // Crossfader Attenuation
    trimNode: GainNode; // Input Gain
    filters: {
        high: BiquadFilterNode;
        mid: BiquadFilterNode;
        low: BiquadFilterNode;
    };
    stemFilters: {
        bass: BiquadFilterNode;
        mid: BiquadFilterNode;
        high: BiquadFilterNode;
        drumsKick: BiquadFilterNode;
        drumsHigh: BiquadFilterNode;
    };
    // FX Chain
    fxNodes: {
        dry: GainNode;
        wet: GainNode;
        delayInput: GainNode;
        reverbInput: GainNode;
        tunaReverb: any;
        tunaDelay: any;
    };
    analyser: AnalyserNode;
    pannerNode: StereoPannerNode | null;
    buffer: AudioBuffer | null;
    isPlaying: boolean;
    startTime: number; // Context time when playback started
    pauseTime: number; // Offset within the buffer when paused
    pitch: number;
    cuePoint: number; // Stored Cue Point (in seconds)
    gridOffset: number; // Seconds offset for the downbeat
    // Color FX
    colorFilter: BiquadFilterNode;
}

export interface AudioEngineState {
    ctx: AudioContext;
    masterGain: GainNode;
    decks: {
        A: AudioDeck;
        B: AudioDeck;
    };
}

// --- STATE MANAGEMENT TYPES ---

export interface StemState {
    active: boolean;
    volume: number;
    param: number;
}

export interface EqState {
    trim: number;
    high: number;
    mid: number;
    low: number;
}

export interface FxState {
    active: boolean;
    activeType: EffectType;
    wet: number;
    knob1: number; // Generic Param 1 (e.g. Decay, Time)
    knob2: number; // Generic Param 2 (e.g. Tone, Feedback)
}

export interface DeckState {
    id: string;
    track: TrackData | null; // Nullable if no track loaded
    hasAudioBuffer: boolean; // True only when audio data is decoded/loaded in engine
    isPlaying: boolean;
    isLoading: boolean;
    progress: number;
    pitch: number; // -1 to 1 (Fader Position)
    pitchRange: number; // e.g. 0.08 for 8%
    level: number; // 0-1 RMS Level
    stems: Record<StemType, StemState>;
    eq: EqState;
    fx: FxState;
    cuePoints: (number | null)[];
    waveformData: any[] | null;
    activeLoop: number | null;
    gridOffset: number;
    keyLock: boolean;
    keyShift: number; // Semitones (-12 to +12)
    color: number; // 0 to 1 (0.5 is off)
    channelVolume: number; // 0 to 1
    isSynced: boolean;
    stemMode: StemPlaybackMode;
    isSeparatingStems: boolean;
}

export interface MidiMapping {
    id: string; // e.g. "DECK_A_PLAY"
    note: number; // MIDI Note or CC number
    channel: number;
    type: 'note' | 'cc';
}

export interface SettingsState {
    isOpen: boolean;
    audioOutputId: string;
    midiMappings: Record<string, MidiMapping>;
}

export interface LibraryState {
    tracks: LibraryTrack[];
    playlists: Playlist[];
    isInitialized: boolean;
}

export interface GlobalDjState {
    activeDeckId: string | null;
    crossfader: number; // 0 to 100
    isRecording: boolean;
    recordingDuration: number;
    settings: SettingsState;
    library: LibraryState;
    decks: {
        A: DeckState;
        B: DeckState;
    };
}

// --- MIDI TYPES ---

export interface MidiDevice {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
}

export type DeckAction =
    | { type: 'TOGGLE_PLAY'; deckId: string }
    | { type: 'SET_PLAYING'; deckId: string; value: boolean }
    | { type: 'SYNC_DECK'; deckId: string }
    | { type: 'SET_CUE'; deckId: string; index: number }
    | { type: 'TRIGGER_CUE'; deckId: string; index: number }
    | { type: 'DELETE_CUE'; deckId: string; index: number }
    | { type: 'CUE_MASTER'; deckId: string }
    | { type: 'LOOP_TRACK'; deckId: string; beats: number | null }
    | { type: 'LOOP_HALVE'; deckId: string }
    | { type: 'LOOP_DOUBLE'; deckId: string }
    | { type: 'BEAT_JUMP'; deckId: string; beats: number }
    | { type: 'SEEK_POSITION'; deckId: string; value: number }
    | { type: 'SET_PITCH'; deckId: string; value: number }
    | { type: 'SET_PITCH_RANGE'; deckId: string; value: number }
    | { type: 'TOGGLE_KEY_LOCK'; deckId: string }
    | { type: 'SET_KEY_SHIFT'; deckId: string; value: number }
    | { type: 'SET_VOLUME'; deckId: string; stem: StemType; value: number }
    | { type: 'TOGGLE_STEM'; deckId: string; stem: StemType }
    | { type: 'SET_STEM_PARAM'; deckId: string; stem: StemType; value: number }
    | { type: 'SET_EQ'; deckId: string; band: keyof EqState; value: number }
    | { type: 'SET_COLOR_FILTER'; deckId: string; value: number }
    | { type: 'TOGGLE_FX'; deckId: string }
    | { type: 'SET_FX_WET'; deckId: string; value: number }
    | { type: 'SET_FX_TYPE'; deckId: string; effectType: EffectType }
    | { type: 'SET_FX_PARAM'; deckId: string; knob: 1 | 2; value: number }
    | { type: 'LOAD_TRACK'; deckId: string; track: TrackData; hasAudioBuffer?: boolean }
    | { type: 'LOAD_FILE'; deckId: string; file: File }
    | { type: 'SEPARATE_STEMS'; deckId: string }
    | { type: 'EJECT_TRACK'; deckId: string }
    | { type: 'DOUBLE_DECK'; deckId: string }
    | { type: 'SET_LOADING'; deckId: string; isLoading: boolean }
    | { type: 'SET_PROGRESS'; deckId: string; value: number }
    | { type: 'SET_LEVEL'; deckId: string; level: number }
    | { type: 'SET_WAVEFORM'; deckId: string; data: any[] | null }
    | { type: 'SET_CROSSFADER'; value: number }
    | { type: 'TOGGLE_SETTINGS' }
    | { type: 'SET_AUDIO_OUTPUT'; deviceId: string }
    | { type: 'LEARN_MIDI'; actionId: string }
    | { type: 'SET_GRID_OFFSET'; deckId: string; value: number }
    | { type: 'TOGGLE_RECORDING' }
    | { type: 'LIBRARY_INIT'; tracks: LibraryTrack[]; playlists: Playlist[] }
    | { type: 'LIBRARY_IMPORT'; files: File[] }
    | { type: 'LIBRARY_ADD_TRACK'; track: LibraryTrack }
    | { type: 'LIBRARY_CREATE_PLAYLIST'; name: string; playlistId?: string }
    | { type: 'LIBRARY_DELETE_PLAYLIST'; playlistId: string }
    | { type: 'LIBRARY_ADD_TO_PLAYLIST'; playlistId: string; trackId: string }
    | { type: 'LIBRARY_ADD_TRACKS_TO_PLAYLIST'; playlistId: string; trackIds: string[] }
    | { type: 'LIBRARY_SET_RATING'; trackId: string; rating: number }
    | { type: 'TRACK_ENDED'; deckId: string }
    | { type: 'SET_CHANNEL_VOLUME'; deckId: string; value: number }
    | { type: 'SET_STEMS_LOADING'; deckId: string; value: boolean }
    | { type: 'STEMS_LOADED'; deckId: string }
    | { type: 'UPDATE_TRACK_METADATA'; trackId: string; bpm?: number; key?: string; beats?: number[] }
    | { type: 'LIBRARY_REMOVE_TRACK'; trackId: string };
