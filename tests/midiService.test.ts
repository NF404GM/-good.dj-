import { describe, expect, it, vi } from 'vitest';
import { MidiService } from '../src/services/midi';

describe('MidiService hot-plug handling', () => {
  it('binds new input devices on connect and clears handlers on disconnect', async () => {
    const initialInput: any = {
      type: 'input',
      state: 'connected',
      name: 'Initial Deck',
      onmidimessage: null,
    };

    const access: any = {
      inputs: new Map([['initial', initialInput]]),
      onstatechange: null,
    };

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn().mockResolvedValue(access),
    });

    const statusSpy = vi.fn();
    const service = new MidiService(() => undefined, statusSpy);

    await service.init();

    expect(typeof initialInput.onmidimessage).toBe('function');
    expect(statusSpy).toHaveBeenCalledWith(true, 'Initial Deck');

    const hotPlugInput: any = {
      type: 'input',
      state: 'connected',
      name: 'Hot Plug Deck',
      onmidimessage: null,
    };

    access.onstatechange({ port: hotPlugInput });

    expect(typeof hotPlugInput.onmidimessage).toBe('function');
    expect(statusSpy).toHaveBeenCalledWith(true, 'Hot Plug Deck');

    hotPlugInput.state = 'disconnected';
    access.onstatechange({ port: hotPlugInput });

    expect(hotPlugInput.onmidimessage).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith(false, 'Hot Plug Deck');
  });
});
