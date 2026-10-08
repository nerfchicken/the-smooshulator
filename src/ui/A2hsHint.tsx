import { useState, type ReactElement } from 'react';
import { dismissA2hs, shouldShowA2hs, type NavigatorLike } from './a2hs';

function nav(): NavigatorLike | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as NavigatorLike);
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * One-line toast for iOS Safari tabs: Safari forgets a site's storage after 7
 * days away unless it lives on the Home Screen. Appears after the 3rd
 * discovery; dismissal is remembered.
 */
export function A2hsHint({ found }: { found: number }): ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !shouldShowA2hs(found, nav(), storage())) return null;
  const close = (): void => {
    dismissA2hs(storage());
    setDismissed(true);
  };
  return (
    <div className="toast" role="status" data-testid="a2hs-hint">
      <span className="toast__emoji" aria-hidden="true">📲</span>
      <span className="toast__text">Add to Home Screen to keep your discoveries</span>
      <button type="button" className="toast__close" aria-label="Dismiss" onClick={close}>
        ×
      </button>
    </div>
  );
}
