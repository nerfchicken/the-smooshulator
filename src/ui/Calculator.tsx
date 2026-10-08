import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
} from 'react';
import type { Card } from '../engine/types';
import { combine } from '../engine';
import { RECIPES } from '../data/recipes';
import type { Action, State } from '../state/store';
import { crunch, discovery, ew, yawn } from '../audio/sounds';
import { CardView } from './CardView';
import type { DragonMood } from './Dragon';
import { Slot } from './Slot';

type Props = {
  state: State;
  dispatch: Dispatch<Action>;
  /** Base + discovered, deduped by id. */
  allCards: Card[];
  setMood: (mood: DragonMood) => void;
  overSlot: 0 | 1 | null;
};

const SHAKE_MS = 350;
const MOOD_MS = 2500;
const COPIED_MS = 1500;

const NEON = ['#ff4fd8', '#28f2ff', '#ffd93b', '#9dff3a', '#8a5cff', '#ff8a3d'];

async function fireConfetti(): Promise<void> {
  try {
    const { default: confetti } = await import('canvas-confetti');
    const common = { particleCount: 90, spread: 65, startVelocity: 45, colors: NEON, zIndex: 60, disableForReducedMotion: true };
    void confetti({ ...common, angle: 60, origin: { x: 0, y: 0.65 } });
    void confetti({ ...common, angle: 120, origin: { x: 1, y: 0.65 } });
  } catch {
    // Confetti is decoration; never block the game on it.
  }
}

function moodFor(card: Card, isNew: boolean): DragonMood {
  const tags = new Set(card.tags);
  if (tags.has('gross') || tags.has('stinky')) return 'ew';
  if (tags.has('sleepy') || tags.has('bedtime')) return 'sleepy';
  return isNew ? 'wow' : 'idle';
}

export function Calculator({ state, dispatch, allCards, setMood, overSlot }: Props): ReactElement {
  const [a, b] = state.slots;
  const [shaking, setShaking] = useState(false);
  const [popId, setPopId] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lastInputs, setLastInputs] = useState<[Card, Card] | null>(null);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const latest = useRef({ state, allCards });
  latest.current = { state, allCards };

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const after = (ms: number, fn: () => void): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const ready = a !== null && b !== null && !shaking;

  const smoosh = useCallback((): void => {
    const { state: s, allCards: cards } = latest.current;
    const [x, y] = s.slots;
    if (!x || !y || busy.current) return;
    busy.current = true;
    setShaking(true);
    setMood('think');
    crunch();
    after(SHAKE_MS, () => {
      const res = combine(x, y, { recipes: RECIPES, cards });
      const isNew = !latest.current.state.log.some((d) => d.key === res.key);
      dispatch({ type: 'smooshed', result: res });
      setLastInputs([x, y]);
      setPopId((n) => n + 1);
      setShaking(false);
      busy.current = false;
      setCopied(false);
      const mood = moodFor(res.card, isNew);
      if (isNew) {
        discovery();
        void fireConfetti();
      } else if (mood === 'ew') {
        ew();
      } else if (mood === 'sleepy') {
        yawn();
      }
      setMood(mood === 'idle' && isNew ? 'wow' : mood);
      after(MOOD_MS, () => setMood('idle'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, setMood]);

  // Enter anywhere (not inside a text field) smooshes once both slots are full.
  // Browsers leave focus on the last *clicked* button (Random, a tray card), so a
  // mouse/touch user who then presses Enter would re-fire that button instead.
  // Track the input modality: only a keyboard navigator (Tab) keeps the native
  // "Enter activates the focused button" behaviour. (`:focus-visible` can't tell
  // us this: both engines flip it to true on the very keydown we're handling.)
  useEffect(() => {
    let keyboardNav = false;
    const onPointer = (): void => {
      keyboardNav = false;
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') {
        keyboardNav = true;
        return;
      }
      if (e.key !== 'Enter' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      if (tag === 'BUTTON' && keyboardNav) return;
      if (latest.current.state.pediaOpen) return;
      const [x, y] = latest.current.state.slots;
      if (x && y) {
        e.preventDefault();
        smoosh();
      }
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [smoosh]);

  const result = state.result;
  const shareText = useMemo(() => {
    if (!result || !lastInputs) return '';
    const [x, y] = lastInputs;
    return `${x.emoji} ${x.word} + ${y.emoji} ${y.word} = ${result.card.emoji} ${result.card.word}`;
  }, [result, lastInputs]);

  const copy = async (): Promise<void> => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Clipboard can be unavailable (http, permissions); fall back to a prompt.
      try {
        window.prompt('Copy this:', shareText);
      } catch {
        // ignore
      }
    }
    setCopied(true);
    after(COPIED_MS, () => setCopied(false));
  };

  const hintFor = (i: 0 | 1): string => (i === 0 ? 'tap a card' : 'or type a word');

  return (
    <section className={`calc${shaking ? ' is-shaking' : ''}`} aria-label="Calculator">
      <div className={`calc__row${shaking ? ' is-slamming' : ''}`}>
        <Slot index={0} card={a} hint={hintFor(0)} knownCards={allCards} dispatch={dispatch} isOver={overSlot === 0} />
        <div className="calc__plus" aria-hidden="true">+</div>
        <Slot index={1} card={b} hint={hintFor(1)} knownCards={allCards} dispatch={dispatch} isOver={overSlot === 1} />
      </div>
      <button type="button" className="calc__equals" disabled={!ready} onClick={smoosh} aria-label="Smoosh them together">
        = SMOOSH!
      </button>
      <div className="calc__result" aria-live="polite" data-testid="result">
        {result && (
          <div className="result" key={`${result.key}-${popId}`}>
            <CardView
              card={result.card}
              size="xl"
              isNew={result.isNew}
              popping
              ariaLabel={`${result.isNew ? 'New! ' : ''}${result.card.word}. Tap to smoosh it again.`}
              onClick={() => dispatch({ type: 'useResult' })}
            />
            <div className="result__actions">
              <span className="result__hint">tap it to smoosh again</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copy()} aria-label="Copy this smoosh">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
