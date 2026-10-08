import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Smoke tests only: the module must never throw, whether or not an AudioContext
 * exists. Each test re-imports the module fresh so the lazily created context
 * doesn't leak between cases.
 */
const freshModule = async () => {
  vi.resetModules();
  return import('./sounds');
};

const callEverything = (m: Awaited<ReturnType<typeof freshModule>>) => {
  m.unlockAudio();
  m.blip();
  m.crunch();
  m.discovery();
  m.ew();
  m.yawn();
};

/** Minimal chainable stand-in for the handful of WebAudio nodes we use. */
function fakeAudioContext(state: AudioContextState = 'running') {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const node = () => {
    const n: Record<string, unknown> = {
      connect: vi.fn(() => n),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(),
      gain: param(),
      Q: param(),
      type: '',
      buffer: null,
    };
    return n;
  };
  const sampleRate = 8000;
  return {
    state,
    sampleRate,
    currentTime: 0,
    destination: node(),
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(node),
    createGain: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBuffer: vi.fn((_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) })),
  };
}

const g = globalThis as { window?: unknown; document?: unknown };

afterEach(() => {
  delete g.window;
  delete g.document;
});

describe('sounds (node smoke)', () => {
  it('every function is a no-op without window', async () => {
    const m = await freshModule();
    expect(() => callEverything(m)).not.toThrow();
  });

  it('every function is a no-op when window has no AudioContext', async () => {
    g.window = {};
    const m = await freshModule();
    expect(() => callEverything(m)).not.toThrow();
  });

  it('every function is a no-op when AudioContext construction throws', async () => {
    g.window = {
      AudioContext: class {
        constructor() {
          throw new Error('not allowed');
        }
      },
    };
    const m = await freshModule();
    expect(() => callEverything(m)).not.toThrow();
  });

  it('schedules nodes against a fake context and respects mute', async () => {
    const fake = fakeAudioContext('suspended');
    const Ctor = vi.fn(function () {
      return fake;
    });
    g.window = { AudioContext: Ctor };
    g.document = { hidden: false, addEventListener: vi.fn() };
    const m = await freshModule();

    m.unlockAudio();
    expect(fake.resume).toHaveBeenCalled();
    expect(() => callEverything(m)).not.toThrow();
    expect(fake.createOscillator).toHaveBeenCalled();
    expect(fake.createBufferSource).toHaveBeenCalled();
    // Only one AudioContext is ever created.
    expect(Ctor).toHaveBeenCalledTimes(1);

    const before = fake.createOscillator.mock.calls.length;
    m.setMuted(true);
    expect(m.isMuted()).toBe(true);
    callEverything(m);
    expect(fake.createOscillator.mock.calls.length).toBe(before);
    m.setMuted(false);
    expect(m.isMuted()).toBe(false);
  });

  it('keeps every gain at or below 0.25 at the destination', async () => {
    const fake = fakeAudioContext();
    g.window = {
      AudioContext: function () {
        return fake;
      },
    };
    const m = await freshModule();
    m.unlockAudio();
    // The master gain is the only node wired straight to the destination.
    const masterCall = fake.createGain.mock.results[0];
    expect((masterCall.value as { gain: { value: number } }).gain.value).toBeLessThanOrEqual(0.25);
  });
});
