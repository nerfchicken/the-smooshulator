import { beforeEach, describe, expect, it } from 'vitest';
import type { Card } from '../../src/engine/types';
import {
  discoveryCount,
  initialState,
  load,
  reducer,
  save,
  STORAGE_KEY,
  type Action,
  type CombineResult,
  type State,
} from '../../src/state/store';

/** Tiny in-memory stand-in for window.localStorage (Vitest env is node). */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k);
    },
    setItem: (k, v) => {
      data.set(k, String(v));
    },
  };
}

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id,
  word: id[0].toUpperCase() + id.slice(1),
  emoji: '✨',
  tags: [],
  modifiers: [],
  base: true,
  ...extra,
});

const cat = card('cat', { emoji: '🐱' });
const dog = card('dog', { emoji: '🐶' });
const pizza = card('pizza', { emoji: '🍕' });

const result = (c: Card, inputs: [string, string], key = `${inputs[0]}+${inputs[1]}`): CombineResult => ({
  card: c,
  source: 'mash',
  key,
  inputs,
});

const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);

describe('reducer: slots', () => {
  it('pick fills slot 1, then slot 2, then replaces slot 2', () => {
    const s1 = reducer(initialState, { type: 'pick', card: cat });
    expect(s1.slots).toEqual([cat, null]);
    const s2 = reducer(s1, { type: 'pick', card: dog });
    expect(s2.slots).toEqual([cat, dog]);
    const s3 = reducer(s2, { type: 'pick', card: pizza });
    expect(s3.slots).toEqual([cat, pizza]);
  });

  it('pick fills slot 1 when only slot 1 is empty', () => {
    const s = reducer({ ...initialState, slots: [null, dog] }, { type: 'pick', card: cat });
    expect(s.slots).toEqual([cat, dog]);
  });

  it('setSlot and clearSlot target a specific index', () => {
    const s = run([
      { type: 'setSlot', index: 1, card: dog },
      { type: 'setSlot', index: 0, card: cat },
    ]);
    expect(s.slots).toEqual([cat, dog]);
    expect(reducer(s, { type: 'clearSlot', index: 0 }).slots).toEqual([null, dog]);
    expect(reducer(s, { type: 'setSlot', index: 1, card: null }).slots).toEqual([cat, null]);
  });

  it('does not mutate the previous state', () => {
    const before = structuredClone(initialState);
    reducer(initialState, { type: 'pick', card: cat });
    expect(initialState).toEqual(before);
  });
});

describe('reducer: smooshed / useResult', () => {
  const catdog = card('catdog', { word: 'Cat Dog', base: false });

  it('records a first-time discovery as isNew and logs it once', () => {
    const s1 = reducer(initialState, { type: 'smooshed', result: result(catdog, ['cat', 'dog']) });
    expect(s1.result).toEqual({ card: catdog, isNew: true, source: 'mash', key: 'cat+dog' });
    expect(s1.discovered.catdog).toEqual(catdog);
    expect(s1.log).toHaveLength(1);
    expect(s1.log[0]).toMatchObject({ key: 'cat+dog', cardId: 'catdog', inputs: ['cat', 'dog'], source: 'mash' });
    expect(typeof s1.log[0].at).toBe('number');
    expect(discoveryCount(s1)).toBe(1);

    const s2 = reducer(s1, { type: 'smooshed', result: result(catdog, ['cat', 'dog']) });
    expect(s2.result?.isNew).toBe(false);
    expect(s2.log).toHaveLength(1);
    expect(discoveryCount(s2)).toBe(1);
  });

  it('treats a different key as a new discovery even for the same card', () => {
    const s1 = reducer(initialState, { type: 'smooshed', result: result(catdog, ['cat', 'dog'], 'a') });
    const s2 = reducer(s1, { type: 'smooshed', result: result(catdog, ['cat', 'dog'], 'b') });
    expect(s2.result?.isNew).toBe(true);
    expect(s2.log.map((d) => d.key)).toEqual(['a', 'b']);
  });

  it('useResult moves the result card into slot 1, clears slot 2 and the result', () => {
    const s = run([
      { type: 'pick', card: cat },
      { type: 'pick', card: dog },
      { type: 'smooshed', result: result(catdog, ['cat', 'dog']) },
      { type: 'useResult' },
    ]);
    expect(s.slots).toEqual([catdog, null]);
    expect(s.result).toBeNull();
  });

  it('useResult with no result is a no-op', () => {
    const s = reducer(initialState, { type: 'pick', card: cat });
    expect(reducer(s, { type: 'useResult' })).toBe(s);
  });
});

describe('reducer: random', () => {
  const cards = [cat, dog, pizza];

  it('fills both slots with two distinct cards', () => {
    const s = reducer(initialState, { type: 'random', cards });
    expect(s.slots[0]).not.toBeNull();
    expect(s.slots[1]).not.toBeNull();
    expect(s.slots[0]!.id).not.toBe(s.slots[1]!.id);
    expect(cards).toContain(s.slots[0]);
    expect(cards).toContain(s.slots[1]);
  });

  it('is deterministic given an injected rng and avoids collisions', () => {
    // rng always returns 0 -> would pick index 0 twice without the distinct guard
    const s = reducer(initialState, { type: 'random', cards, rng: () => 0 });
    expect(s.slots[0]).toBe(cat);
    expect(s.slots[1]).toBe(dog);
  });

  it('clears any previous result', () => {
    const withResult = reducer(initialState, {
      type: 'smooshed',
      result: result(card('x', { base: false }), ['cat', 'dog']),
    });
    expect(reducer(withResult, { type: 'random', cards }).result).toBeNull();
  });

  it('handles a single-card list by leaving slot 2 empty', () => {
    const s = reducer(initialState, { type: 'random', cards: [cat] });
    expect(s.slots).toEqual([cat, null]);
  });

  it('handles an empty list by leaving state unchanged', () => {
    expect(reducer(initialState, { type: 'random', cards: [] })).toBe(initialState);
  });
});

describe('reducer: toggles and reset', () => {
  it('toggleMute flips muted', () => {
    const s = reducer(initialState, { type: 'toggleMute' });
    expect(s.muted).toBe(true);
    expect(reducer(s, { type: 'toggleMute' }).muted).toBe(false);
  });

  it('openPedia / closePedia', () => {
    const open = reducer(initialState, { type: 'openPedia' });
    expect(open.pediaOpen).toBe(true);
    expect(reducer(open, { type: 'closePedia' }).pediaOpen).toBe(false);
  });

  it('reset returns to initialState (everything, including mute)', () => {
    const s = run([
      { type: 'pick', card: cat },
      { type: 'toggleMute' },
      { type: 'smooshed', result: result(card('x', { base: false }), ['cat', 'dog']) },
      { type: 'openPedia' },
    ]);
    expect(reducer(s, { type: 'reset' })).toEqual(initialState);
  });
});

describe('persistence', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('load with nothing stored returns initialState', () => {
    expect(load(storage)).toEqual(initialState);
  });

  it('load with corrupt JSON returns initialState', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    expect(load(storage)).toEqual(initialState);
  });

  it('load with wrong shape returns initialState', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, discovered: 'nope', log: 42 }));
    expect(load(storage)).toEqual(initialState);
    storage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(load(storage)).toEqual(initialState);
  });

  it('load tolerates a missing storage entirely', () => {
    expect(load(undefined)).toEqual(initialState);
  });

  it('save/load roundtrip keeps generated cards intact and starts slots/result empty', () => {
    const generated = card('snuggle-daddy', {
      word: 'Snuggle Daddy',
      emoji: '🛏️👨',
      tags: ['soft', 'warm', 'parent'],
      modifiers: ['Snuggle', 'Cozy', 'Dad'],
      nounForms: ['Daddy', 'Dad'],
      flavor: 'Warm. Snoring.',
      base: false,
    });
    const s = run([
      { type: 'pick', card: cat },
      { type: 'pick', card: dog },
      { type: 'smooshed', result: result(generated, ['blanket', 'daddy']) },
      { type: 'toggleMute' },
      { type: 'openPedia' },
    ]);
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.discovered).toEqual({ 'snuggle-daddy': generated });
    expect(loaded.log).toEqual(s.log);
    expect(loaded.muted).toBe(true);
    expect(loaded.slots).toEqual([null, null]);
    expect(loaded.result).toBeNull();
    expect(loaded.pediaOpen).toBe(false);
    expect(loaded.version).toBe(1);
  });

  it('a reloaded discovery is not "new" again', () => {
    const generated = card('x', { base: false });
    save(reducer(initialState, { type: 'smooshed', result: result(generated, ['cat', 'dog']) }), storage);
    const again = reducer(load(storage), { type: 'smooshed', result: result(generated, ['cat', 'dog']) });
    expect(again.result?.isNew).toBe(false);
  });

  it('reset clears everything including storage once saved', () => {
    const s = reducer(initialState, { type: 'smooshed', result: result(card('x', { base: false }), ['cat', 'dog']) });
    save(s, storage);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    const reset = reducer(s, { type: 'reset' });
    save(reset, storage);
    expect(load(storage)).toEqual(initialState);
  });

  it('save never throws when storage is unavailable or full', () => {
    expect(() => save(initialState, undefined)).not.toThrow();
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => save(initialState, broken)).not.toThrow();
  });

  it('load/save default to globalThis.localStorage when present', () => {
    const g = globalThis as { localStorage?: Storage };
    const prev = g.localStorage;
    g.localStorage = storage;
    try {
      const s = reducer(initialState, { type: 'toggleMute' });
      save(s);
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(load().muted).toBe(true);
    } finally {
      if (prev === undefined) delete g.localStorage;
      else g.localStorage = prev;
    }
  });
});
