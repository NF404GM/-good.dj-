// good.DJ — Type Definitions

export interface TrackData {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    duration: number;
    waveformData?: number[];
    genre?: string;
    beats?: number[];
}

export interface LibraryTrack extends TrackData {
    id: string;
    file?: File;
    url?: string;
    addedAt: number;
    playCount: number;
    rating: number;
    lastPlayed?: number;
    color?: string;
}

export interface Playlist {
    id: string;
    name: string;
    trackIds: string[];
    createdAt: number;
}

export enum StemType {
    VOCALS = 'vocals',
    DRUMS = 'drums',
    BASS = 'bass',
    OTHER = 'other',
}

export type StemPlaybackMode = 'filters' | 'real';

export interface StemSeparationResult {
    vocals: AudioBuffer;
    drums: AudioBuffer;
    bass: AudioBuffer;
    other: AudioBuffer;
}

export interface StemModelStatus {
    // Whether the ONNX model is present
    available: boolean;
    // Whether stem separation is active for a deck
    isProcessing: boolean;
    // Progress percentage during separation
    progress: number;
    // Any error messages
    error?: string;
    // Model file size info
    modelSize?: string;
    modelPath?: string;
}

export enum EffectType {
    REVERB = 'reverb',
    DELAY = 'delay',
    FILTER = 'filter',
    FLANGER = 'flanger',
    PHASER = 'phaser',
    COMPRESSOR = 'compressor',
    BITCRUSHER = 'bitcrusher',
    WAHWAH = 'wahwah',
}

export interface AudioDeck {
    source: AudioBufferSourceNode | null;
    buffer: AudioBuffer | null;
    gainNode: GainNode;
    crossfaderNode: GainNode;
    analyser: AnalyserNode;
    eqHigh: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqLow: BiquadFilterNode;
    filterNode: BiquadFilterNode;
    stemNodes: {
        vocals: GainNode;
        drums: GainNode;
        bass: GainNode;
        other: GainNode;
    };
    stemFilters: {
        vocals: BiquadFilterNode[];
        drums: BiquadFilterNode[];
        bass: BiquadFilterNode[];
        other: BiquadFilterNode[];
    };
    stemMode: StemPlaybackMode;
    stemBuffers: StemSeparationResult | null;
    fxSend: GainNode;
    fxReturn: GainNode;
    dryNode: GainNode;
    trimNode: GainNode;
    effects: Map<EffectType, any>;
    effectEnabled: Map<EffectType, boolean>;
    startTime: number;
    pauseTime: number;
    isPlaying: boolean;
    playbackRate: number;
    keyLockEnabled: boolean;
    pitchShiftNode: AudioWorkletNode | null;
    originalBpm: number;
}

export interface AudioEngineState {
    isInitialized: boolean;
    masterGain: number;
    crossfaderPosition: number;
    sampleRate: number;
    decks: {
        A: AudioDeck;
        B: AudioDeck;
    };
}

export interface StemState {
    vocals: number;
    drums: number;
    bass: number;
    other: number;
}

export interface EqState {
    high: number;
    mid: number;
    low: number;
}

export interface FxState {
    type: EffectType;
    enabled: boolean;
    mix: number;
    params: Record<string, number>;
}

export interface DeckState {
    id: string;
    track: TrackData | null;
    isPlaying: boolean;
    isLoading: boolean;
    progress: number;
    volume: number;
    channelVolume: number;
    trim: number;
    eq: EqState;
    filter: number;
    stems: StemState;
    stemMode: StemPlaybackMode;
    stemsLoading: boolean;
    stemsLoaded: boolean;
    bpm: number;
    pitch: number;
    keyLock: boolean;
    cuePoints: (number | null)[];
    loopIn: number | null;
    loopOut: number | null;
    isLooping: boolean;
    fx: FxState[];
    level: number;
    waveformData: any[] | null;
    beatGridOffset: number;
}

export interface MidiMapping {
    channel: number;
    cc: number;
    action: string;
    deckId?: string;
}

export interface SettingsState {
    midiEnabled: boolean;
    midiMappings: MidiMapping[];
    audioOutput: string;
    theme: 'dark' | 'light';
}

export interface LibraryState {
    tracks: LibraryTrack[];
    playlists: Playlist[];
    isLoading: boolean;
    searchQuery: string;
}

export interface GlobalDjState {
    decks: {
        A: DeckState;
        B: DeckState;
    };
    crossfader: number;
    library: LibraryState;
    settings: SettingsState;
    view: AppView;
    isRecording: boolean;
    recordingDuration: number;
    midiLearnTarget: string | null;
}

export interface MidiDevice {
    id: string;
    name: string;
    manufacturer: string;
    connected: boolean;
}

export type DeckAction =
    | { type: 'LOAD_TRACK'; deckId: string; track: TrackData; file?: File }
    | { type: 'TOGGLE_PLAY'; deckId: string }
    | { type: 'SET_CUE'; deckId: string; index: number }
    | { type: 'TRIGGER_CUE'; deckId: string; index: number }
    | { type: 'DELETE_CUE'; deckId: string; index: number }
    | { type: 'SET_EQ'; deckId: string; band: 'high' | 'mid' | 'low'; value: number }
    | { type: 'SET_FILTER'; deckId: string; value: number }
    | { type: 'SET_STEM_VOLUME'; deckId: string; stem: keyof StemState; value: number }
    | { type: 'SET_STEM_MODE'; deckId: string; mode: StemPlaybackMode }
    | { type: 'SEPARATE_STEMS'; deckId: string }
    | { type: 'SET_VOLUME'; deckId: string; value: number }
    | { type: 'SET_TRIM'; deckId: string; value: number }
    | { type: 'SET_PITCH'; deckId: string; value: number }
    | { type: 'TOGGLE_KEY_LOCK'; deckId: string }
    | { type: 'TOGGLE_FX'; deckId: string; effectType: EffectType }
    | { type: 'SET_FX_MIX'; deckId: string; effectType: EffectType; value: number }
    | { type: 'SET_FX_PARAM'; deckId: string; effectType: EffectType; param: string; value: number }
    | { type: 'SET_LOOP_IN'; deckId: string }
    | { type: 'SET_LOOP_OUT'; deckId: string }
    | { type: 'TOGGLE_LOOP'; deckId: string }
    | { type: 'BEAT_JUMP'; deckId: string; beats: number }
    | { type: 'NUDGE'; deckId: string; direction: 'forward' | 'backward' }
    | { type: 'SEEK'; deckId: string; position: number }
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

export interface ArchitectureFile {
    name: string;
    language: string;
    content: string;
    description: string;
}

export enum AppView {
    INTERFACE = 'INTERFACE',
    LIBRARY = 'LIBRARY',
    ARCHITECTURE = 'ARCHITECTURE',
}
