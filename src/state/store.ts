import { useEffect, useReducer, type Dispatch } from 'react';
import type { Card } from '../engine/types';

/**
 * Structural copy of the engine's CombineResult so the store doesn't depend
 * on src/engine/index.ts existing yet. Any object with this shape is accepted.
 */
export type CombineResult = {
  card: Card;
  source: 'recipe' | 'double' | 'mash' | 'portmanteau';
  key: string;
  inputs: [string, string];
};

export type Slot = Card | null;

export type Discovery = {
  key: string;
  cardId: string;
  inputs: [string, string];
  at: number;
  source: string;
};

export type State = {
  version: 1;
  slots: [Slot, Slot];
  result: { card: Card; isNew: boolean; source: string; key: string } | null;
  /** id -> full card, so generated cards survive a reload without re-running the engine. */
  discovered: Record<string, Card>;
  /** Chronological, first-time discoveries only. */
  log: Discovery[];
  muted: boolean;
  pediaOpen: boolean;
};

export type Action =
  | { type: 'pick'; card: Card }
  | { type: 'setSlot'; index: 0 | 1; card: Slot }
  | { type: 'clearSlot'; index: 0 | 1 }
  | { type: 'smooshed'; result: CombineResult; at?: number }
  | { type: 'useResult' }
  | { type: 'random'; cards: Card[]; rng?: () => number }
  | { type: 'toggleMute' }
  | { type: 'openPedia' }
  | { type: 'closePedia' }
  | { type: 'reset' };

export const STORAGE_KEY = 'smooshulator.v1';

export const initialState: State = {
  version: 1,
  slots: [null, null],
  result: null,
  discovered: {},
  log: [],
  muted: false,
  pediaOpen: false,
};

export function discoveryCount(state: State): number {
  return state.log.length;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'pick': {
      const [a, b] = state.slots;
      const slots: [Slot, Slot] = a === null ? [action.card, b] : [a, action.card];
      return { ...state, slots };
    }

    case 'setSlot': {
      const slots: [Slot, Slot] = [...state.slots];
      slots[action.index] = action.card;
      return { ...state, slots };
    }

    case 'clearSlot': {
      const slots: [Slot, Slot] = [...state.slots];
      slots[action.index] = null;
      return { ...state, slots };
    }

    case 'smooshed': {
      const { card, key, source, inputs } = action.result;
      const isNew = !state.log.some((d) => d.key === key);
      const log = isNew
        ? [...state.log, { key, cardId: card.id, inputs, at: action.at ?? Date.now(), source }]
        : state.log;
      return {
        ...state,
        result: { card, isNew, source, key },
        discovered: { ...state.discovered, [card.id]: card },
        log,
      };
    }

    case 'useResult': {
      if (!state.result) return state;
      return { ...state, slots: [state.result.card, null], result: null };
    }

    case 'random': {
      const { cards } = action;
      if (cards.length === 0) return state;
      const rng = action.rng ?? Math.random;
      const first = pickIndex(cards.length, rng);
      if (cards.length === 1) return { ...state, slots: [cards[first], null], result: null };
      // Pick the second from the remaining n-1 and skip over the first.
      let second = pickIndex(cards.length - 1, rng);
      if (second >= first) second += 1;
      return { ...state, slots: [cards[first], cards[second]], result: null };
    }

    case 'toggleMute':
      return { ...state, muted: !state.muted };

    case 'openPedia':
      return { ...state, pediaOpen: true };

    case 'closePedia':
      return { ...state, pediaOpen: false };

    case 'reset':
      return initialState;
  }
}

function pickIndex(n: number, rng: () => number): number {
  const r = rng();
  const i = Math.floor((Number.isFinite(r) ? r : 0) * n);
  return Math.min(Math.max(i, 0), n - 1);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type Persisted = Pick<State, 'version' | 'discovered' | 'log' | 'muted'>;

function defaultStorage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    // Accessing localStorage can throw (e.g. blocked third-party storage).
    return undefined;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isCard(v: unknown): v is Card {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.word === 'string' &&
    typeof v.emoji === 'string' &&
    Array.isArray(v.tags) &&
    Array.isArray(v.modifiers) &&
    typeof v.base === 'boolean'
  );
}

function isDiscovery(v: unknown): v is Discovery {
  return (
    isRecord(v) &&
    typeof v.key === 'string' &&
    typeof v.cardId === 'string' &&
    Array.isArray(v.inputs) &&
    v.inputs.length === 2 &&
    typeof v.at === 'number' &&
    typeof v.source === 'string'
  );
}

function parsePersisted(raw: string | null): Persisted | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== 1) return null;
  if (!isRecord(data.discovered) || !Array.isArray(data.log)) return null;

  const discovered: Record<string, Card> = {};
  for (const [id, card] of Object.entries(data.discovered)) {
    if (isCard(card)) discovered[id] = card;
  }
  const log = data.log.filter(isDiscovery);
  return { version: 1, discovered, log, muted: data.muted === true };
}

/** Reads persisted progress. Slots/result/pedia always start fresh. */
export function load(storage: Storage | undefined = defaultStorage()): State {
  if (!storage) return initialState;
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return initialState;
  }
  const persisted = parsePersisted(raw);
  return persisted ? { ...initialState, ...persisted } : initialState;
}

/** Persists discovered/log/muted. Never throws (quota, private mode, no storage). */
export function save(state: State, storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  const payload: Persisted = {
    version: 1,
    discovered: state.discovered,
    log: state.log,
    muted: state.muted,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded / storage disabled: play on without persistence.
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useStore(): [State, Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, undefined, () => load());
  const { discovered, log, muted } = state;
  useEffect(() => {
    save(state);
    // Only the persisted slices matter; slot/result/pedia changes shouldn't write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered, log, muted]);
  return [state, dispatch];
}
