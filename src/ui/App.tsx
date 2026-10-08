import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Card } from '../engine/types';
import { BASE_CARDS } from '../data/cards';
import { discoveryCount, useStore } from '../state/store';
import { setMuted, unlockAudio } from '../audio/sounds';
import { Calculator } from './Calculator';
import { Dragon, type DragonMood } from './Dragon';
import { Smooshopedia } from './Smooshopedia';
import { Tray } from './Tray';

export default function App(): ReactElement {
  const [state, dispatch] = useStore();
  const [mood, setMood] = useState<DragonMood>('idle');
  const [overSlot, setOverSlot] = useState<0 | 1 | null>(null);
  const pediaButtonRef = useRef<HTMLButtonElement>(null);

  // Base + discovered, deduped by id (discovered wins).
  const allCards = useMemo<Card[]>(() => {
    const map = new Map<string, Card>();
    for (const c of BASE_CARDS) map.set(c.id, c);
    for (const c of Object.values(state.discovered)) map.set(c.id, c);
    return [...map.values()];
  }, [state.discovered]);

  useEffect(() => {
    setMuted(state.muted);
  }, [state.muted]);

  // WebAudio must be unlocked inside a trusted *activation* gesture. A touch
  // pointerdown is not one (iOS rejects it), so listen for pointerup, click and
  // keydown, once each: whichever lands first unlocks, the rest re-nudge.
  useEffect(() => {
    const events = ['pointerup', 'click', 'keydown'] as const;
    const unlock = (): void => unlockAudio();
    for (const ev of events) document.addEventListener(ev, unlock, { once: true });
    return () => {
      for (const ev of events) document.removeEventListener(ev, unlock);
    };
  }, []);

  const onDragOver = useCallback((s: 0 | 1 | null) => setOverSlot(s), []);
  const found = discoveryCount(state);

  return (
    <div className="app">
      <header className="app__header">
        <Dragon mood={mood} />
        <h1 className="title">
          <span className="title__the">The</span>
          <span className="title__name">Smooshulator</span>
        </h1>
        <div className="score" aria-label={`${found} ${found === 1 ? 'discovery' : 'discoveries'}`} data-testid="score">
          ★ {found}
        </div>
      </header>
      <Calculator state={state} dispatch={dispatch} allCards={allCards} setMood={setMood} overSlot={overSlot} />
      <Tray state={state} dispatch={dispatch} allCards={allCards} onDragOver={onDragOver} pediaButtonRef={pediaButtonRef} />
      {state.pediaOpen && (
        <Smooshopedia state={state} dispatch={dispatch} allCards={allCards} fallbackFocus={pediaButtonRef} />
      )}
    </div>
  );
}
