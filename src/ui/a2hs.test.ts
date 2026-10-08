import { describe, expect, it } from 'vitest';
import { A2HS_DISMISSED_KEY, dismissA2hs, isIosSafariTab, shouldShowA2hs } from './a2hs';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

function memStorage(): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('isIosSafariTab', () => {
  it('matches iPhone Safari in a normal tab', () => {
    expect(isIosSafariTab({ userAgent: IOS_UA, standalone: false })).toBe(true);
  });
  it('does not match when launched from the Home Screen', () => {
    expect(isIosSafariTab({ userAgent: IOS_UA, standalone: true })).toBe(false);
  });
  it('does not match browsers without navigator.standalone (Android, desktop, headless)', () => {
    expect(isIosSafariTab({ userAgent: ANDROID_UA })).toBe(false);
    expect(isIosSafariTab({ userAgent: IOS_UA })).toBe(false);
    expect(isIosSafariTab(undefined)).toBe(false);
  });
  it('treats a touch "Macintosh" as iPadOS', () => {
    expect(isIosSafariTab({ userAgent: MAC_UA, standalone: false, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafariTab({ userAgent: MAC_UA, standalone: false, maxTouchPoints: 0 })).toBe(false);
  });
});

describe('shouldShowA2hs', () => {
  const ios = { userAgent: IOS_UA, standalone: false };
  it('shows only from the 3rd discovery', () => {
    const s = memStorage();
    expect(shouldShowA2hs(2, ios, s)).toBe(false);
    expect(shouldShowA2hs(3, ios, s)).toBe(true);
    expect(shouldShowA2hs(40, ios, s)).toBe(true);
  });
  it('never shows outside an iOS Safari tab', () => {
    expect(shouldShowA2hs(10, { userAgent: ANDROID_UA }, memStorage())).toBe(false);
    expect(shouldShowA2hs(10, { userAgent: IOS_UA, standalone: true }, memStorage())).toBe(false);
  });
  it('stays dismissed once dismissed, via the persisted key', () => {
    const s = memStorage();
    dismissA2hs(s);
    expect(s.data[A2HS_DISMISSED_KEY]).toBe('1');
    expect(shouldShowA2hs(10, ios, s)).toBe(false);
  });
  it('survives a throwing storage', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => dismissA2hs(bad)).not.toThrow();
    expect(shouldShowA2hs(10, ios, bad)).toBe(true);
  });
});
