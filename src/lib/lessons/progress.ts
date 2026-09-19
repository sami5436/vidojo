export type Progress = {
  lesson: number;
  step: number;
  /** ids of lessons whose every checkpoint has been cleared */
  cleared: string[];
};

const KEY = "vidojo:progress";

const DEFAULT: Progress = { lesson: 0, step: 0, cleared: [] };

let cache: Progress = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    cache = {
      lesson: typeof parsed.lesson === "number" ? parsed.lesson : 0,
      step: typeof parsed.step === "number" ? parsed.step : 0,
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared : [],
    };
  } catch {
    // unreadable or blocked storage just means we start from the beginning
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProgress(): Progress {
  load();
  return cache;
}

export function getServerProgress(): Progress {
  return DEFAULT;
}

export function setProgress(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // progress simply will not survive a reload, which is not worth failing over
  }
  for (const listener of listeners) listener();
}

export function clearProgress() {
  setProgress(DEFAULT);
}
