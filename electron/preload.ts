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
        getTrackById: (id: string) => ipcRenderer.invoke('library:getTrackById', id),
        readTrackFile: (filePath: string) => ipcRenderer.invoke('library:readTrackFile', filePath),
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
    stems: {
        separate: (filePath: string) => ipcRenderer.invoke('stems:separate', filePath),
        getStatus: () => ipcRenderer.invoke('stems:getStatus'),
        installModel: (filePath: string) => ipcRenderer.invoke('stems:installModel', filePath),
        removeInstalledModel: () => ipcRenderer.invoke('stems:removeInstalledModel'),
    },
    // App info
    getVersion: () => ipcRenderer.invoke('app:version'),
    getUploadsDir: () => ipcRenderer.invoke('app:getUploadsDir'),
    platform: process.platform,
    // Event listeners
    onUpdateAvailable: (callback: (info: { current: string; latest: string; url: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, info: { current: string; latest: string; url: string }) => callback(info);
        ipcRenderer.on('update-available', handler);
        return () => ipcRenderer.removeListener('update-available', handler);
    },
    onPlayerStatus: (callback: (state: any) => void) => {
        const handler = (_event: any, state: any) => callback(state);
        ipcRenderer.on('prolink:status', handler);
        return () => ipcRenderer.removeListener('prolink:status', handler);
    },
    onDeviceUpdate: (callback: (data: { type: string, device: any }) => void) => {
        const handler = (_event: any, data: any) => callback(data);
        ipcRenderer.on('prolink:device', handler);
        return () => ipcRenderer.removeListener('prolink:device', handler);
    },
});
