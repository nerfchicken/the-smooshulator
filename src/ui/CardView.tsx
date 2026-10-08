import { forwardRef, type CSSProperties, type PointerEventHandler, type ReactElement } from 'react';
import type { Card } from '../engine/types';
import { graphemes } from './emoji';

export type CardSize = 'md' | 'lg' | 'xl';

type Props = {
  card: Card;
  size?: CardSize;
  isNew?: boolean;
  selected?: boolean;
  /** Undiscovered curated recipes involving this card; renders a small pill when > 0. */
  badge?: number;
  popping?: boolean;
  ghost?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
};

export function CardEmoji({ emoji }: { emoji: string }): ReactElement {
  const parts = graphemes(emoji);
  if (parts.length >= 2) {
    return (
      <span className="card__emoji card__emoji--duo" aria-hidden="true">
        <span>{parts[0]}</span>
        <span>{parts[1]}</span>
      </span>
    );
  }
  return (
    <span className="card__emoji" aria-hidden="true">
      {parts[0] ?? emoji}
    </span>
  );
}

/**
 * A card face. Renders a <button> when `onClick` (or pointer handlers) are
 * given, otherwise a plain <div> (ghost, static display).
 */
export const CardView = forwardRef<HTMLButtonElement, Props>(function CardView(
  { card, size = 'md', isNew, selected, badge, popping, ghost, className, style, ariaLabel, onClick, ...pointer },
  ref,
) {
  const classes = ['card'];
  if (size === 'lg') classes.push('card--lg');
  if (size === 'xl') classes.push('card--xl');
  if (isNew) classes.push('card--new');
  if (selected) classes.push('card--selected');
  if (popping) classes.push('is-popping');
  if (ghost) classes.push('card--ghost');
  if (className) classes.push(className);
  const cls = classes.join(' ');

  const body = (
    <>
      {badge !== undefined && badge > 0 && (
        <span className="card__badge" title={`${badge} more to find`}>
          {badge} more
        </span>
      )}
      <CardEmoji emoji={card.emoji} />
      <span className="card__word">{card.word}</span>
      {size === 'xl' && card.flavor && <span className="card__flavor">{card.flavor}</span>}
    </>
  );

  const interactive = onClick !== undefined || pointer.onPointerDown !== undefined;
  if (!interactive) {
    return (
      <div className={cls} style={style} aria-label={ariaLabel ?? card.word}>
        {body}
      </div>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      style={style}
      aria-label={ariaLabel ?? card.word}
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onClick}
      {...pointer}
    >
      {body}
    </button>
  );
});
