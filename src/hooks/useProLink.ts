import { useState, useEffect, useRef } from 'react';
import { DeckAction } from '../types';

interface ProLinkState {
    isConnected: boolean;
    devices: { id: number; name: string; type: string }[];
    players: Record<number, {
        isPlaying: boolean;
        tempo: number;
        pitch: number;
        effectiveTempo: number;
        beat: number;
    }>;
}

export function useProLink(dispatch?: (action: DeckAction) => void) {
    const [state, setState] = useState<ProLinkState>({
        isConnected: false,
        devices: [],
        players: {}
    });
    const [syncEnabled, setSyncEnabled] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const applyPlayerStatus = (data: {
            deviceId: number;
            isPlaying: boolean;
            tempo: number;
            pitch: number;
            effectiveTempo: number;
            beat: number;
        }) => {
            setState(s => ({
                ...s,
                players: {
                    ...s.players,
                    [data.deviceId]: {
                        isPlaying: data.isPlaying,
                        tempo: data.tempo,
                        pitch: data.pitch,
                        effectiveTempo: data.effectiveTempo,
                        beat: data.beat
                    }
                }
            }));

            if (dispatch && syncEnabled) {
                const deckId = data.deviceId === 1 ? 'A' : data.deviceId === 2 ? 'B' : null;
                if (deckId) {
                    dispatch({ type: 'SET_PITCH', deckId, value: data.pitch });
                }
            }
        };

        const applyDeviceUpdate = (data: { type: string; device: { id: number; name: string; type: string } }) => {
            if (data.type === 'DEVICE_ADDED') {
                setState(s => ({
                    ...s,
                    isConnected: true,
                    devices: [...s.devices.filter(d => d.id !== data.device.id), data.device]
                }));
                return;
            }

            if (data.type === 'DEVICE_REMOVED') {
                setState(s => {
                    const newPlayers = { ...s.players };
                    delete newPlayers[data.device.id];
                    const remainingDevices = s.devices.filter(d => d.id !== data.device.id);
                    return {
                        ...s,
                        isConnected: remainingDevices.length > 0,
                        devices: remainingDevices,
                        players: newPlayers
                    };
                });
            }
        };

        if (window.gooddj?.onPlayerStatus && window.gooddj?.onDeviceUpdate) {
            const offStatus = window.gooddj.onPlayerStatus((data) => {
                applyPlayerStatus(data);
            });
            const offDevice = window.gooddj.onDeviceUpdate((data) => {
                applyDeviceUpdate(data);
            });

            return () => {
                offStatus?.();
                offDevice?.();
            };
        }

        const connect = () => {
            const ws = new WebSocket('ws://127.0.0.1:3001');
            wsRef.current = ws;

            ws.onopen = () => {
                setState(s => ({ ...s, isConnected: true }));
            };

            ws.onclose = () => {
                setState(s => ({ ...s, isConnected: false, devices: [], players: {} }));
                setTimeout(connect, 5000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'DEVICE_ADDED' || data.type === 'DEVICE_REMOVED') {
                        applyDeviceUpdate(data);
                    }
                    else if (data.type === 'PLAYER_STATUS') {
                        applyPlayerStatus(data);
                    }
                } catch (e) {
                    console.error("ProLink WS Parse Error", e);
                }
            };
        };

        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [dispatch, syncEnabled]);

    return { ...state, syncEnabled, setSyncEnabled };
}
