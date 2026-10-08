import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { DragonSvg, type DragonMood } from './DragonSvg';

export type { DragonMood };

/** Smoosh the Dragon in a mood box. Idle blinks on a random cadence. */
export function Dragon({ mood }: { mood: DragonMood }): ReactElement {
  // New random blink cadence every time the mood changes (so idle never looks metronomic).
  const blinkDur = useMemo(() => `${(3 + Math.random() * 3).toFixed(2)}s`, [mood]);
  return (
    <div className={`dragon dragon--${mood}`} style={{ '--blink-dur': blinkDur } as CSSProperties}>
      <DragonSvg mood={mood} />
    </div>
  );
}
