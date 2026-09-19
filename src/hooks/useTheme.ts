"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const KEY = "vidojo:theme";

/**
 * The theme lives on <html data-theme>, written by an inline script before the
 * first paint. React just subscribes to it, so nothing ever flashes.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private browsing can refuse storage, the theme still applies for now
    }
    for (const listener of listeners) listener();
  }, []);

  const toggle = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
