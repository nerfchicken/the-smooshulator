import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import type { Card } from '../engine/types';
import { pairKey } from '../engine';
import { BASE_CARDS } from '../data/cards';
import { RECIPES } from '../data/recipes';
import type { Action, State } from '../state/store';
import { blip, setMuted } from '../audio/sounds';
import { CardView } from './CardView';

type Props = {
  state: State;
  dispatch: Dispatch<Action>;
  /** Base + discovered, deduped by id (the Random pool). */
  allCards: Card[];
  onDragOver: (slot: 0 | 1 | null) => void;
  pediaButtonRef: RefObject<HTMLButtonElement>;
};

const DRAG_START_PX = 8;
const DROP_MARGIN_PX = 16;

type Ghost = { card: Card; x: number; y: number; w: number; h: number; dx: number; dy: number };

/** Tray order: discovered (newest first), then base cards in data order. */
export function orderedTrayCards(state: State): Card[] {
  const out: Card[] = [];
  const seen = new Set<string>();
  for (let i = state.log.length - 1; i >= 0; i--) {
    const c = state.discovered[state.log[i].cardId];
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  for (const c of Object.values(state.discovered)) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  for (const c of BASE_CARDS) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/** id -> number of curated recipes involving that card not yet in the log. */
export function remainingRecipeCounts(log: State['log']): Map<string, number> {
  const found = new Set(log.map((d) => d.key));
  const counts = new Map<string, number>();
  for (const r of RECIPES) {
    const [a, b] = r.inputs;
    if (found.has(pairKey(a, b))) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
    if (b !== a) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return counts;
}

function slotAt(x: number, y: number): 0 | 1 | null {
  const els = document.querySelectorAll<HTMLElement>('[data-slot]');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (
      x >= r.left - DROP_MARGIN_PX &&
      x <= r.right + DROP_MARGIN_PX &&
      y >= r.top - DROP_MARGIN_PX &&
      y <= r.bottom + DROP_MARGIN_PX
    ) {
      return el.dataset.slot === '1' ? 1 : 0;
    }
  }
  return null;
}

export function Tray({ state, dispatch, allCards, onDragOver, pediaButtonRef }: Props): ReactElement {
  const cards = useMemo(() => orderedTrayCards(state), [state.log, state.discovered]);
  const remaining = useMemo(() => remainingRecipeCounts(state.log), [state.log]);
  const inSlots = new Set(state.slots.filter((s): s is Card => s !== null).map((s) => s.id));

  // ---- Desktop drag (mouse only; touch is tap-only) ----
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const drag = useRef<{ card: Card; startX: number; startY: number; el: HTMLButtonElement; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const overRef = useRef<0 | 1 | null>(null);

  const setOver = useCallback(
    (s: 0 | 1 | null) => {
      if (overRef.current !== s) {
        overRef.current = s;
        onDragOver(s);
      }
    },
    [onDragOver],
  );

  const onPointerDown = (card: Card) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { card, startX: e.clientX, startY: e.clientY, el: e.currentTarget, active: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_START_PX) return;
      d.active = true;
      try {
        d.el.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const r = d.el.getBoundingClientRect();
      setGhost({ card: d.card, x: e.clientX, y: e.clientY, w: r.width, h: r.height, dx: d.startX - r.left, dy: d.startY - r.top });
    } else {
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    }
    setOver(slotAt(e.clientX, e.clientY));
  };

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>, drop: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    try {
      d.el.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setGhost(null);
    setOver(null);
    if (drop) {
      const slot = slotAt(e.clientX, e.clientY);
      if (slot !== null) {
        blip();
        dispatch({ type: 'setSlot', index: slot, card: d.card });
      }
    }
  };

  const onPick = (card: Card) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    blip();
    dispatch({ type: 'pick', card });
  };

  return (
    <>
      <section className="tray" aria-label="Card tray">
        {cards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            selected={inSlots.has(card.id)}
            secret={(remaining.get(card.id) ?? 0) > 0}
            ariaLabel={card.word}
            onClick={onPick(card)}
            onPointerDown={onPointerDown(card)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e, true)}
            onPointerCancel={(e) => endDrag(e, false)}
          />
        ))}
      </section>
      <nav className="tray__toolbar" aria-label="Tools">
        <button
          ref={pediaButtonRef}
          type="button"
          className="btn btn--primary"
          onClick={() => {
            blip();
            dispatch({ type: 'openPedia' });
          }}
        >
          <span className="btn__emoji" aria-hidden="true">📖</span> Smooshopedia
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            blip();
            dispatch({ type: 'random', cards: allCards });
          }}
        >
          <span className="btn__emoji" aria-hidden="true">🔀</span> Random
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label={state.muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={state.muted}
          title={state.muted ? 'Sound is off' : 'Sound is on (on iPhone, flip the ring switch if you hear nothing)'}
          onClick={() => {
            const nowMuted = !state.muted;
            setMuted(nowMuted);
            dispatch({ type: 'toggleMute' });
            if (!nowMuted) blip();
          }}
        >
          {state.muted ? '🔇' : '🔊'}
        </button>
      </nav>
      {ghost && (
        <CardView
          card={ghost.card}
          ghost
          style={{ left: ghost.x - ghost.dx, top: ghost.y - ghost.dy, width: ghost.w, height: ghost.h }}
        />
      )}
    </>
  );
}
