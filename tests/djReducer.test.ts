import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/audio', () => ({
  AudioEngine: {
    setCrossfader: vi.fn(),
    setChannelGain: vi.fn(),
    onTrackEnd: null,
    pause: vi.fn(),
    play: vi.fn(),
    setPitch: vi.fn(),
    syncDecks: vi.fn(),
    setEq: vi.fn(),
    setStemState: vi.fn(),
    setFx: vi.fn(),
    setFxParam: vi.fn(),
    seek: vi.fn(),
    handleCue: vi.fn(),
    setLoop: vi.fn(),
    setAudioOutput: vi.fn(),
    eject: vi.fn(),
    setGridOffset: vi.fn(),
    stopRecording: vi.fn(),
    startRecording: vi.fn(),
    setColorFilter: vi.fn(),
    setKeyLock: vi.fn(),
    setKeyShift: vi.fn(),
    cloneDeck: vi.fn(),
    resume: vi.fn(),
    loadFile: vi.fn(),
    getProgress: vi.fn().mockReturnValue(0),
    getLevel: vi.fn().mockReturnValue(0),
  },
}));

vi.mock('../services/library', () => ({
  goodDB: {
    init: vi.fn(),
    getAllTracks: vi.fn().mockResolvedValue([]),
    getAllPlaylists: vi.fn().mockResolvedValue([]),
    getTrackBlob: vi.fn().mockResolvedValue(null),
    saveTrack: vi.fn(),
    createPlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    addTracksToPlaylist: vi.fn(),
    setTrackRating: vi.fn(),
  },
}));

vi.mock('../services/midi', () => ({
  MidiService: class {
    init() {}
    setMappings() {}
    enableLearn() {}
  },
}));

import { djReducer, initialState } from '../hooks/useDjState';
import type { GlobalDjState, TrackData } from '../types';

const makeState = (): GlobalDjState => structuredClone(initialState);

const testTrack: TrackData = {
  id: 'track-1',
  title: 'Test Track',
  artist: 'Test Artist',
  bpm: 128,
  key: '1A',
  duration: 240,
};

describe('djReducer regressions', () => {
  it('updates key shift for a deck', () => {
    const state = makeState();
    const next = djReducer(state, { type: 'SET_KEY_SHIFT', deckId: 'A', value: 5 });

    expect(next.decks.A.keyShift).toBe(5);
    expect(next.decks.B.keyShift).toBe(0);
  });

  it('does not toggle play when no audio buffer is loaded', () => {
    const state = makeState();
    state.decks.A.track = testTrack;
    state.decks.A.hasAudioBuffer = false;

    const next = djReducer(state, { type: 'TOGGLE_PLAY', deckId: 'A' });

    expect(next.decks.A.isPlaying).toBe(false);
  });

  it('toggles play when buffer is loaded', () => {
    const state = makeState();
    state.decks.A.track = testTrack;
    state.decks.A.hasAudioBuffer = true;

    const next = djReducer(state, { type: 'TOGGLE_PLAY', deckId: 'A' });

    expect(next.decks.A.isPlaying).toBe(true);
  });

  it('uses provided playlist id to keep state/db ids aligned', () => {
    const state = makeState();
    const next = djReducer(state, {
      type: 'LIBRARY_CREATE_PLAYLIST',
      name: 'My Playlist',
      playlistId: 'pl-fixed-id',
    });

    expect(next.library.playlists).toHaveLength(1);
    expect(next.library.playlists[0].id).toBe('pl-fixed-id');
  });

  it('deletes a cue point', () => {
    const state = makeState();
    state.decks.A.cuePoints[0] = 0.5;
    
    const next = djReducer(state, {
      type: 'DELETE_CUE',
      deckId: 'A',
      index: 0
    });

    expect(next.decks.A.cuePoints[0]).toBeNull();
  });
});
