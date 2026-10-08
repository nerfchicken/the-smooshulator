import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type ReactElement } from 'react';
import type { Card } from '../engine/types';
import { cardFromTypedWord } from '../engine';
import { EMOJI_KEYWORDS, WORD_ALIASES } from '../data/emojiMap';
import type { Action } from '../state/store';
import { blip } from '../audio/sounds';
import { CardView } from './CardView';

const REJECT_MS = 400;

type Props = {
  index: 0 | 1;
  card: Card | null;
  hint: string;
  knownCards: Card[];
  dispatch: Dispatch<Action>;
  /** A dragged tray card is hovering over this slot. */
  isOver?: boolean;
};

/**
 * One calculator input. Three looks: empty (hint, tap to type), typing (text
 * input), filled (card + clear button). Always carries `data-slot` so the
 * tray's desktop drag can find it as a drop target.
 */
export function Slot({ index, card, hint, knownCards, dispatch, isOver }: Props): ReactElement {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
  }, []);

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  // A card arriving from the tray/random ends typing mode.
  useEffect(() => {
    if (card) {
      setTyping(false);
      setText('');
    }
  }, [card]);

  /**
   * Turn the typed text into a card. Nothing usable (punctuation only, etc.)
   * returns null: on Enter the input shakes and keeps focus so the kid can fix
   * it; on blur we just close quietly (they walked away).
   */
  const commit = (viaBlur = false): void => {
    const value = text.trim();
    if (!value) {
      setTyping(false);
      setText('');
      return;
    }
    const made = cardFromTypedWord(value, EMOJI_KEYWORDS, knownCards, WORD_ALIASES);
    if (!made) {
      if (viaBlur) {
        setTyping(false);
        setText('');
        return;
      }
      setRejected(true);
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setRejected(false), REJECT_MS);
      inputRef.current?.focus();
      return;
    }
    setTyping(false);
    setText('');
    blip();
    dispatch({ type: 'setSlot', index, card: made });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTyping(false);
      setText('');
    }
  };

  const over = isOver ? ' is-over' : '';
  const label = `Slot ${index + 1}`;

  if (card) {
    return (
      <div className={`slot slot--filled${over}`} data-slot={index}>
        <CardView
          card={card}
          size="lg"
          ariaLabel={`${card.word} in slot ${index + 1}. Tap to remove.`}
          onClick={() => {
            blip();
            dispatch({ type: 'clearSlot', index });
          }}
        />
        <button
          type="button"
          className="slot__clear"
          aria-label={`Clear slot ${index + 1}`}
          onClick={() => {
            blip();
            dispatch({ type: 'clearSlot', index });
          }}
        >
          ×
        </button>
      </div>
    );
  }

  if (typing) {
    return (
      <div className={`slot slot--filled${over}`} data-slot={index}>
        <input
          ref={inputRef}
          className={`slot__input${rejected ? ' is-rejected' : ''}`}
          aria-invalid={rejected || undefined}
          type="text"
          value={text}
          placeholder="type…"
          aria-label={`Type a word for slot ${index + 1}`}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={24}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(true)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`slot slot--empty${over}`}
      data-slot={index}
      data-hint={hint}
      aria-label={`${label}: empty. ${hint}`}
      onClick={() => setTyping(true)}
    />
  );
}
