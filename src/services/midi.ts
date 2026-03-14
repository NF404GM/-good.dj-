
import { DeckAction, MidiMapping } from '../types';

/**
 * Maps a 0-127 MIDI CC value to a -1 to +1 pitch range.
 * Includes a +/-3% dead zone around center to eliminate
 * jitter from physical fader imprecision at the center detent.
 */
function mapPitchCC(value: number): number {
    const DEAD_ZONE = 0.03;
    const normalized = (value - 64) / 63;

    if (Math.abs(normalized) < DEAD_ZONE) {
        return 0;
    }

    const sign = normalized > 0 ? 1 : -1;
    const scaled = sign * (Math.abs(normalized) - DEAD_ZONE) / (1 - DEAD_ZONE);
    return Math.max(-1, Math.min(1, scaled));
}

export class MidiService {
    private access: any = null;
    private onAction: (action: DeckAction) => void;
    private onStatusChange: (isConnected: boolean, deviceName: string) => void;

    // Dynamic Mapping Storage
    public mappings: Map<string, string> = new Map(); // Key: "channel:note:type", Value: actionId

    // Learn Mode
    public isLearning: boolean = false;
    public pendingActionId: string | null = null;
    public onLearnSuccess?: (mapping: MidiMapping) => void;

    private readonly boundHandleMessage = this.handleMessage.bind(this);

    constructor(
        onAction: (action: DeckAction) => void,
        onStatusChange: (isConnected: boolean, deviceName: string) => void
    ) {
        this.onAction = onAction;
        this.onStatusChange = onStatusChange;
    }

    // Load mappings from storage
    public setMappings(savedMappings: Record<string, MidiMapping>) {
        this.mappings.clear();
        Object.values(savedMappings).forEach(m => {
            const key = `${m.channel}:${m.note}:${m.type}`;
            this.mappings.set(key, m.id);
        });
    }

    public enableLearn(actionId: string, callback: (m: MidiMapping) => void) {
        this.isLearning = true;
        this.pendingActionId = actionId;
        this.onLearnSuccess = callback;
    }

    private attachInput(input: any) {
        input.onmidimessage = this.boundHandleMessage;
        this.onStatusChange(true, input.name);
    }

    async init() {
        if (!(navigator as any).requestMIDIAccess) return;
        try {
            this.access = await (navigator as any).requestMIDIAccess({ sysex: false });
            this.access.onstatechange = (e: any) => {
                if (e.port.type !== 'input') return;

                if (e.port.state === 'connected') {
                    this.attachInput(e.port);
                } else {
                    e.port.onmidimessage = null;
                    this.onStatusChange(false, e.port.name);
                }
            };
            for (const input of this.access.inputs.values()) {
                this.attachInput(input);
            }
        } catch (err) {
            console.error("MIDI Init Failed", err);
        }
    }

    private handleMessage(event: any) {
        const [status, data1, data2] = event.data;
        const channel = status & 0x0f;
        const cmd = status & 0xf0;
        const type = cmd === 0xB0 ? 'cc' : 'note';

        // --- LEARN MODE ---
        if (this.isLearning && this.pendingActionId) {
            // Ignore NoteOff
            if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) return;

            const mapping: MidiMapping = {
                id: this.pendingActionId,
                note: data1,
                channel: channel,
                type: type as 'cc' | 'note'
            };

            // Save internally
            const key = `${channel}:${data1}:${type}`;
            this.mappings.set(key, this.pendingActionId);

            // Notify UI
            if (this.onLearnSuccess) this.onLearnSuccess(mapping);

            // Reset
            this.isLearning = false;
            this.pendingActionId = null;
            return;
        }

        // --- EXECUTION MODE ---
        const key = `${channel}:${data1}:${type}`;
        const actionId = this.mappings.get(key);

        if (actionId) {
            const val = data2 / 127.0;
            this.dispatchMappedAction(actionId, val, data2);
        } else {
            // Fallback to default hardcoded map if strict dynamic map not found?
            // For now, let's keep it strictly dynamic to enforce the "Settings" flow.
        }
    }

    destroy() {
        if (this.access) {
            // Remove all input listeners
            for (const input of this.access.inputs.values()) {
                input.onmidimessage = null;
            }
            // Remove state change listener
            this.access.onstatechange = null;
            this.access = null;
        }
        // Clear all mappings
        this.mappings.clear();
        this.isLearning = false;
        this.pendingActionId = null;
        this.onLearnSuccess = undefined;
    }

    private dispatchMappedAction(actionId: string, value: number, rawValue: number) {
        // Global Map
        if (actionId === 'CROSSFADER') {
            this.onAction({ type: 'SET_CROSSFADER', value: value * 100 });
            return;
        }

        // Expected format: DECK_{A|B}_{FEATURE}_{SUBFEATURE?}
        const parts = actionId.split('_');
        if (parts.length < 3) return;

        const deckId = parts[1]; // A or B
        const feature = parts[2]; // PLAY, CUE, SYNC, EQ, VOL, FILTER, PITCH, HOTCUE, LOOP, FX
        const subFeature = parts[3];

        if (feature === 'PLAY' && value > 0) {
            this.onAction({ type: 'TOGGLE_PLAY', deckId });
        } else if (feature === 'CUE' && value > 0) {
            this.onAction({ type: 'CUE_MASTER', deckId }); // Usually CUE jumps to cue point or sets it
        } else if (feature === 'SYNC' && value > 0) {
            this.onAction({ type: 'SYNC_DECK', deckId });
        } else if (feature === 'VOL') {
            this.onAction({ type: 'SET_CHANNEL_VOLUME', deckId, value });
        } else if (feature === 'PITCH') {
            this.onAction({ type: 'SET_PITCH', deckId, value: mapPitchCC(rawValue) });
        } else if (feature === 'FILTER') {
            // Color filter. Center is 0.5. 
            this.onAction({ type: 'SET_COLOR_FILTER', deckId, value });
        } else if (feature === 'EQ') {
            const band = subFeature?.toLowerCase() as 'low' | 'mid' | 'high' | 'trim';
            if (band) this.onAction({ type: 'SET_EQ', deckId, band, value });
        } else if (feature === 'HOTCUE' && value > 0) {
            const index = parseInt(subFeature, 10) - 1;
            if (!isNaN(index)) {
                this.onAction({ type: 'TRIGGER_CUE', deckId, index });
            }
        } else if (feature === 'LOOP' && subFeature === 'AUTO' && value > 0) {
            // Auto Loop triggers a standard 4 beat loop. 
            // In a more complex architecture, we'd toggle it based on current state.
            // For now, assume it activates a 4-beat loop, or turns it off if already on.
            // We can dispatch LOOP_TRACK with -1 to signal a toggle of the default size to useDjState,
            // or just always set it to 4 beats for now since we don't have getState.
            this.onAction({ type: 'LOOP_TRACK', deckId, beats: 4 });
        } else if (feature === 'FX') {
            if (subFeature === 'WET') {
                this.onAction({ type: 'SET_FX_WET', deckId, value });
            } else if (subFeature === 'ON' && value > 0) {
                this.onAction({ type: 'TOGGLE_FX', deckId });
            }
        }
    }
}
