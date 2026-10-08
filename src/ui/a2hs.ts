/**
 * "Add to Home Screen" hint logic (pure; see A2hsHint.tsx for the toast).
 *
 * WebKit wipes all script-writable storage for a site after 7 days of Safari
 * use without a visit, unless the app was launched from the Home Screen
 * (docs/review-engine.md S5). So once a kid has something worth keeping,
 * iOS Safari users get a one-line nudge to install it.
 */

export const A2HS_DISMISSED_KEY = 'smooshulator.hint.a2hs';
/** Discoveries before the hint is worth showing. */
export const A2HS_AFTER = 3;

export type NavigatorLike = { userAgent?: string; standalone?: boolean; maxTouchPoints?: number };

/**
 * iOS Safari running as a normal tab. `navigator.standalone` exists only on
 * iOS WebKit: `true` from the Home Screen, `false` in the browser, undefined
 * everywhere else (so Android, desktop and test runners never match).
 */
export function isIosSafariTab(nav: NavigatorLike | undefined): boolean {
  if (!nav || nav.standalone !== false) return false;
  const ua = nav.userAgent ?? '';
  const iphone = /iP(hone|ad|od)/.test(ua);
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  const ipadAsMac = /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
  return iphone || ipadAsMac;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function isA2hsDismissed(storage: StorageLike | undefined): boolean {
  try {
    return storage?.getItem(A2HS_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissA2hs(storage: StorageLike | undefined): void {
  try {
    storage?.setItem(A2HS_DISMISSED_KEY, '1');
  } catch {
    // Storage unavailable: the hint just comes back next session.
  }
}

export function shouldShowA2hs(found: number, nav: NavigatorLike | undefined, storage: StorageLike | undefined): boolean {
  return found >= A2HS_AFTER && isIosSafariTab(nav) && !isA2hsDismissed(storage);
}
