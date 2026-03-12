/**
 * Preload script for good.DJ Electron app.
 * Exposes a safe IPC bridge to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gooddj', {
    // License operations
    license: {
        verify: (key: string) => ipcRenderer.invoke('license:verify', key),
        getStatus: () => ipcRenderer.invoke('license:status'),
        clear: () => ipcRenderer.invoke('license:clear'),
    },
    // Library
    library: {
        getTracks: () => ipcRenderer.invoke('library:getTracks'),
        saveTrack: (track: any) => ipcRenderer.invoke('library:saveTrack', track),
        updateTrack: (id: string, updates: any) => ipcRenderer.invoke('library:updateTrack', id, updates),
        getPlaylists: () => ipcRenderer.invoke('library:getPlaylists'),
        savePlaylist: (name: string, id?: string) => ipcRenderer.invoke('library:savePlaylist', name, id),
        addTracksToPlaylist: (plId: string, tIds: string[]) => ipcRenderer.invoke('library:addTracksToPlaylist', plId, tIds),
        deletePlaylist: (id: string) => ipcRenderer.invoke('library:deletePlaylist', id),
        getRecordings: () => ipcRenderer.invoke('library:getRecordings'),
    },
    // Audio / DSP
    audio: {
        analyzeKey: (filePath: string) => ipcRenderer.invoke('audio:analyzeKey', filePath),
        saveRecording: (path: string, title: string, duration: number) => ipcRenderer.invoke('audio:saveRecording', path, title, duration),
    },
    // App info
    getVersion: () => ipcRenderer.invoke('app:version'),
    getUploadsDir: () => ipcRenderer.invoke('app:getUploadsDir'),
    platform: process.platform,
    // Event listeners
    onPlayerStatus: (callback: (state: any) => void) => ipcRenderer.on('prolink:status', (_event, state) => callback(state)),
    onDeviceUpdate: (callback: (data: { type: string, device: any }) => void) => ipcRenderer.on('prolink:device', (_event, data) => callback(data)),
});
