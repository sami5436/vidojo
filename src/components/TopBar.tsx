"use client";

import type { Theme } from "@/hooks/useTheme";

export type AppMode = "learn" | "sandbox";

type Props = {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  theme: Theme;
  onThemeToggle: () => void;
  right?: React.ReactNode;
};

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3" />
        <path d="M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.2A8.2 8.2 0 019.8 4a8.4 8.4 0 102 10.2 8.2 8.2 0 008.2 0z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TopBar({
  mode,
  onModeChange,
  theme,
  onThemeToggle,
  right,
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-edge bg-raised px-3 text-[13px] select-none sm:px-4">
      <div className="flex items-baseline gap-2">
        <span className="font-bold tracking-tight text-fg">vidojo</span>
        <span className="hidden text-[11px] text-faint sm:inline">
          vi, for real
        </span>
      </div>

      <nav
        className="ml-auto flex items-center rounded-md border border-edge bg-sunken p-0.5"
        aria-label="Practice mode"
      >
        {(["learn", "sandbox"] as const).map((value) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              aria-pressed={active}
              className={[
                "rounded px-2.5 py-1 text-[12px] capitalize transition-colors",
                active
                  ? "bg-accentsoft text-accent"
                  : "text-dim hover:text-fg",
              ].join(" ")}
            >
              {value}
            </button>
          );
        })}
      </nav>

      {right}

      <button
        type="button"
        onClick={onThemeToggle}
        aria-label={
          theme === "dark" ? "Switch to light terminal" : "Switch to dark terminal"
        }
        title={theme === "dark" ? "Light terminal" : "Dark terminal"}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-edge bg-sunken text-dim transition-colors hover:text-accent"
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
