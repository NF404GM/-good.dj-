
import { ArchitectureFile, TrackData, LibraryTrack } from './types';

export const MOCK_TRACK_A: TrackData = {
  id: 't1',
  title: 'HYPER-REALITY',
  artist: 'UNKNOWN OP',
  bpm: 128.00,
  key: '4A',
  duration: 345,
};

export const MOCK_TRACK_B: TrackData = {
  id: 't2',
  title: 'SILENT STATE',
  artist: 'VOIDWALKER',
  bpm: 130.00,
  key: '5A',
  duration: 280,
};

export const MOCK_LIBRARY: LibraryTrack[] = [
    { id: 't1', title: 'HYPER-REALITY', artist: 'UNKNOWN OP', album: 'System Core', genre: 'Techno', bpm: 128.00, key: '4A', duration: 345, rating: 5, dateAdded: '2023-10-12', analyzed: true },
    { id: 't2', title: 'SILENT STATE', artist: 'VOIDWALKER', album: 'Null Pointer', genre: 'Minimal', bpm: 130.00, key: '5A', duration: 280, rating: 4, dateAdded: '2023-11-01', analyzed: true },
    { id: 't3', title: 'NEON RAIN', artist: 'SYNTHETIC SOUL', album: 'Blade Runner', genre: 'Synthwave', bpm: 100.00, key: '8A', duration: 240, rating: 3, dateAdded: '2023-11-05', analyzed: true },
    { id: 't4', title: 'DEEP DIVE', artist: 'AQUATIC', album: 'Submerge', genre: 'Deep House', bpm: 122.00, key: '2A', duration: 310, rating: 4, dateAdded: '2023-11-10', analyzed: false },
    { id: 't5', title: 'INDUSTRIAL COMPLEX', artist: 'GEAR GRINDER', album: 'Factory Reset', genre: 'Industrial', bpm: 135.00, key: '6A', duration: 295, rating: 2, dateAdded: '2023-11-12', analyzed: true },
    { id: 't6', title: 'ACID RAIN', artist: '303 STATE', album: 'Silver Box', genre: 'Acid', bpm: 128.00, key: '11B', duration: 400, rating: 5, dateAdded: '2023-11-15', analyzed: true },
    { id: 't7', title: 'ZERO GRAVITY', artist: 'ORBITAL MECHANICS', album: 'Space Cadet', genre: 'Trance', bpm: 138.00, key: '1A', duration: 380, rating: 4, dateAdded: '2023-11-18', analyzed: false },
    { id: 't8', title: 'DATA MOSH', artist: 'GLITCH MOB', album: 'Corrupted', genre: 'Glitch', bpm: 110.00, key: '9A', duration: 210, rating: 3, dateAdded: '2023-11-20', analyzed: true },
    { id: 't9', title: 'BASS WEIGHT', artist: 'SUB FOCUS', album: 'Low End', genre: 'Dubstep', bpm: 140.00, key: '12A', duration: 260, rating: 5, dateAdded: '2023-11-22', analyzed: true },
    { id: 't10', title: 'ABSTRACT THOUGHT', artist: 'MIND GAMES', album: 'Cognition', genre: 'IDM', bpm: 125.00, key: '3A', duration: 330, rating: 4, dateAdded: '2023-11-25', analyzed: true },
    { id: 't11', title: 'WAREHOUSE 99', artist: 'RAVE CULTURE', album: '1999', genre: 'Techno', bpm: 132.00, key: '7A', duration: 350, rating: 4, dateAdded: '2023-11-28', analyzed: true },
    { id: 't12', title: 'SOFT SIGNAL', artist: 'LOFI GIRL', album: 'Study Beats', genre: 'Lofi', bpm: 85.00, key: '5B', duration: 180, rating: 2, dateAdded: '2023-12-01', analyzed: false },
    { id: 't13', title: 'HARD WIRED', artist: 'CYBERPUNK', album: 'Night City', genre: 'EBM', bpm: 126.00, key: '4B', duration: 305, rating: 5, dateAdded: '2023-12-05', analyzed: true },
];

// C++ Architecture Content
export const CPP_FILES: ArchitectureFile[] = [
  {
    name: 'Directory Tree',
    language: 'plaintext',
    description: 'Project Structure',
    content: `good.DJ/
├── CMakeLists.txt              # Root build configuration
├── src/
│   ├── app/                    # UI Application Logic (React/Native Bridge)
│   ├── core/                   # Pure C++ DSP Engine
│   │   ├── AudioEngine.hpp     # Main Oboe/CoreAudio wrapper
│   │   ├── FluidGrid.hpp       # Elastic timing logic
│   │   ├── StemSplitter.hpp    # NPU Inference Interface
│   │   └── Theme.hpp           # JSON Theme Mapper
│   └── platform/               # OS Specific implementations
│       ├── android/
│       ├── ios/
│       └── windows/
└── third_party/                # Managed via FetchContent
    ├── oboe/
    ├── readerwriterqueue/
    ├── dr_libs/
    ├── rubberband/
    ├── aubio/
    └── json/`
  },
  {
    name: 'CMakeLists.txt',
    language: 'cmake',
    description: 'Build System & Dependencies',
    content: `cmake_minimum_required(VERSION 3.20)
project(goodDJ VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# 1. Audio I/O (Oboe for Android)
if(ANDROID)
    FetchContent_Declare(
        oboe
        GIT_REPOSITORY https://github.com/google/oboe
        GIT_TAG 1.8.0
    )
    FetchContent_MakeAvailable(oboe)
endif()

# 2. Concurrency (Lock-free Queue)
FetchContent_Declare(
    readerwriterqueue
    GIT_REPOSITORY https://github.com/cameron314/readerwriterqueue
    GIT_TAG master
)
FetchContent_MakeAvailable(readerwriterqueue)

# 3. Decoding (dr_libs)
FetchContent_Declare(
    dr_libs
    GIT_REPOSITORY https://github.com/mackron/dr_libs
    GIT_TAG master
)
FetchContent_MakeAvailable(dr_libs)

# 4. Time-Stretching (Rubberband)
FetchContent_Declare(
    rubberband
    GIT_REPOSITORY https://github.com/breakfastquay/rubberband
    GIT_TAG default
)
FetchContent_MakeAvailable(rubberband)

# 5. Analysis (Aubio)
FetchContent_Declare(
    aubio
    GIT_REPOSITORY https://github.com/aubio/aubio
    GIT_TAG master
)
FetchContent_MakeAvailable(aubio)

# Core Library
add_library(good_core
    src/core/AudioEngine.cpp
    src/core/FluidGrid.cpp
    src/core/StemSplitter.cpp
)

target_include_directories(good_core PUBLIC src/core)
target_link_libraries(good_core PRIVATE readerwriterqueue dr_libs rubberband aubio)

if(ANDROID)
    target_link_libraries(good_core PRIVATE oboe)
endif()`
  },
  {
    name: 'AudioEngine.hpp',
    language: 'cpp',
    description: 'Core Audio Engine Header',
    content: `#pragma once

#include "readerwriterqueue.h"
#include <vector>
#include <atomic>

// Architecture: Lock-free audio thread
// Purpose: Manages the audio callback and mixes stems

namespace good {

    struct AudioBuffer {
        float* data;
        size_t frames;
    };

    class AudioEngine {
    public:
        AudioEngine();
        ~AudioEngine();

        // Lifecycle
        void start();
        void stop();

        // IPC: Message passing from UI to Audio Thread
        // Uses SPSC queue to prevent priority inversion
        void enqueueCommand(const AudioCommand& cmd);

    private:
        // The High-Priority Audio Callback
        // CRITICAL: No malloc, no mutex, no I/O here.
        void onAudioReady(float* outputBuffer, int32_t numFrames);

        // State
        std::atomic<double> mCurrentTime{0.0};
        moodycamel::ReaderWriterQueue<AudioCommand> mCommandQueue;
        
        // DSP Chains
        std::unique_ptr<StemSplitter> mStemSplitter;
        std::unique_ptr<FluidGrid> mFluidGrid;
    };

}`
  },
  {
    name: 'FluidGrid.hpp',
    language: 'cpp',
    description: 'Dynamic Tempo Logic',
    content: `#pragma once
#include <vector>

namespace good {

    // Logic: 
    // 1. Detect onsets on Drum Stem.
    // 2. Calculate drift from Master Clock.
    // 3. Apply Rubberband stretch factor dynamically.

    class FluidGrid {
    public:
        void process(const std::vector<float>& drumStem, double masterBpm);
        
        // Returns the ratio required to align the next transient
        // to the nearest grid line.
        double getCalculatedStretchFactor() const;

    private:
        struct Transient {
            double time;
            float strength;
        };

        std::vector<Transient> mDetectedTransients;
        double mCurrentDriftMs;
    };
}`
  }
];