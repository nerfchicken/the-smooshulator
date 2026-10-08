import { useEffect, useMemo, useRef, type Dispatch, type ReactElement, type RefObject } from 'react';
import type { Card } from '../engine/types';
import { RECIPES } from '../data/recipes';
import type { Action, State } from '../state/store';
import { blip } from '../audio/sounds';
import { CardView } from './CardView';
import { wordFromId } from './emoji';

type Props = {
  state: State;
  dispatch: Dispatch<Action>;
  allCards: Card[];
  /** Refocused on close when the opener can't be determined (Safari doesn't focus clicked buttons). */
  fallbackFocus: RefObject<HTMLButtonElement>;
};

type Ref = { emoji: string; word: string };

export function Smooshopedia({ state, dispatch, allCards, fallbackFocus }: Props): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);
  const byId = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);

  const resolve = (id: string): Ref => {
    const c = byId.get(id) ?? state.discovered[id];
    if (c) return { emoji: c.emoji, word: c.word };
    if (id.startsWith('typed:')) return { emoji: '⌨️', word: wordFromId(id) };
    return { emoji: '❓', word: wordFromId(id) };
  };

  const entries = useMemo(
    () =>
      [...state.log]
        .reverse()
        .map((d) => ({ d, card: state.discovered[d.cardId] }))
        .filter((e): e is { d: (typeof state.log)[number]; card: Card } => e.card !== undefined),
    [state.log, state.discovered],
  );

  const close = (): void => dispatch({ type: 'closePedia' });

  useEffect(() => {
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : fallbackFocus.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (card: Card): void => {
    blip();
    dispatch({ type: 'pick', card });
    close();
  };

  const startOver = (): void => {
    if (window.confirm('Start over? This erases your whole Smooshopedia.')) {
      dispatch({ type: 'reset' });
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pedia-title">
      <div className="modal__backdrop" onClick={close} data-testid="pedia-backdrop" />
      <div className="modal__panel">
        <div className="modal__head">
          <h2 className="modal__title" id="pedia-title">
            <span className="modal__title-emoji" aria-hidden="true">📖</span> Smooshopedia
          </h2>
          <span className="modal__count" data-testid="pedia-count" aria-label={`${state.log.length} of ${RECIPES.length} found`}>
            {state.log.length} of {RECIPES.length}
          </span>
        </div>
        <div className="modal__grid">
          {entries.length === 0 && (
            <p className="pedia__empty">Nothing yet! Smoosh two cards together to fill this up.</p>
          )}
          {entries.map(({ d, card }) => {
            const [i1, i2] = d.inputs.map(resolve);
            return (
              <div className="pedia__entry" key={d.key}>
                <CardView card={card} ariaLabel={`${card.word}. Tap to use it.`} onClick={() => pick(card)} />
                <div className="pedia__recipe">
                  <span className="emoji">{i1.emoji}</span> {i1.word} + <span className="emoji">{i2.emoji}</span> {i2.word}
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={startOver}>
            Start over
          </button>
          <button ref={closeRef} type="button" className="btn btn--primary" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
