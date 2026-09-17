'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A small per-viewer preference kept in localStorage — a collapsed sidebar, a
 * dismissed guide. Never anything that matters: this is one browser's
 * convenience, it does not reach the server, and it can come back empty.
 *
 * Built on useSyncExternalStore rather than "read it in an effect and
 * setState", which is the obvious approach and the wrong one: it renders once
 * with the default, then immediately again with the stored value, so the
 * sidebar visibly jumps. This subscribes to the store instead, and returns the
 * default as the server snapshot so hydration matches.
 */

/** Fired on the window so other hooks in THIS tab see a change too. The native
 *  `storage` event only reaches other tabs. */
const CHANGE_EVENT = 'local-preference-change';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useLocalPreference(
  key: string,
  defaultValue: boolean
): [boolean, (next: boolean) => void] {
  const getSnapshot = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? defaultValue : stored === '1';
    } catch {
      // Private windows and blocked site data both throw here.
      return defaultValue;
    }
  }, [key, defaultValue]);

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // The preference just will not persist; the UI still updates below.
      }

      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key]
  );

  return [value, setValue];
}
