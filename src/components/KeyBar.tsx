"use client";

import { useState } from "react";
import type { Mode } from "@/lib/vi/types";

type Key = {
  /** what shows on the cap */
  label: string;
  /** what gets sent, defaults to the label */
  send?: string;
  /** a wider cap for the keys people reach for most */
  wide?: boolean;
};

const ARROWS: Key[] = [
  { label: "←", send: "ArrowLeft" },
  { label: "↓", send: "ArrowDown" },
  { label: "↑", send: "ArrowUp" },
  { label: "→", send: "ArrowRight" },
];

const NAMED = new Set([
  "Escape", "Enter", "Tab", "Backspace",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
]);

const NORMAL_KEYS: Key[] = [
  { label: "w" },
  { label: "b" },
  { label: "e" },
  { label: "0" },
  { label: "^" },
  { label: "$" },
  { label: "gg" },
  { label: "G" },
  { label: "{" },
  { label: "}" },
  { label: "%" },
  { label: "x" },
  { label: "dd" },
  { label: "dw" },
  { label: "ciw" },
  { label: "yy" },
  { label: "p" },
  { label: "u" },
  { label: "." },
  { label: "o" },
  { label: "A" },
  { label: "v" },
  { label: "V" },
  { label: ">>" },
  { label: "<<" },
  { label: "⌃r", send: "<C-r>" },
  { label: "⌃d", send: "<C-d>" },
  { label: "⌃u", send: "<C-u>" },
];

const INSERT_KEYS: Key[] = [
  { label: "⇥", send: "Tab" },
  { label: "⌫", send: "Backspace" },
  { label: "{" },
  { label: "}" },
  { label: "(" },
  { label: ")" },
  { label: "[" },
  { label: "]" },
  { label: "<" },
  { label: ">" },
  { label: "&" },
  { label: "*" },
  { label: "_" },
  { label: '"' },
  { label: ";" },
];

const SHELL_KEYS: Key[] = [
  { label: "⇥", send: "Tab" },
  { label: "ls" },
  { label: "cd " },
  { label: "vi " },
  { label: "cat " },
  { label: "../", send: "../" },
  { label: "~/", send: "~/" },
  { label: "|" },
  { label: "-" },
  { label: "." },
  { label: "/" },
];

type Props = {
  onKey: (key: string) => void;
  screen: "shell" | "editor";
  mode: Mode | null;
};

export default function KeyBar({ onKey, screen, mode }: Props) {
  const [ctrl, setCtrl] = useState(false);

  const send = (key: string) => {
    if (ctrl && key.length === 1) {
      onKey(`<C-${key.toLowerCase()}>`);
      setCtrl(false);
      return;
    }
    setCtrl(false);

    if (NAMED.has(key) || key.startsWith("<C-")) {
      onKey(key);
      return;
    }

    // Multi character caps such as dd or ciw are just a run of keystrokes.
    for (const char of key) onKey(char);
  };

  const inserting = mode === "insert" || mode === "replace";
  const row: Key[] =
    screen === "shell" ? SHELL_KEYS : inserting ? INSERT_KEYS : NORMAL_KEYS;

  const cap = (key: Key, tone: "plain" | "accent" = "plain") => (
    <button
      key={key.label}
      type="button"
      // Pointer down keeps the hidden input focused, so the keyboard stays up.
      onPointerDown={(event) => {
        event.preventDefault();
        send(key.send ?? key.label);
      }}
      className={[
        "h-9 shrink-0 rounded-md border px-2.5 text-[13px] leading-none",
        "active:bg-accentsoft active:text-accent",
        key.wide ? "min-w-14" : "min-w-9",
        tone === "accent"
          ? "border-accent/50 bg-sunken text-accent"
          : "border-edge bg-sunken text-fg",
      ].join(" ")}
    >
      {key.label}
    </button>
  );

  return (
    <div
      className="shrink-0 border-t border-edge bg-raised"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        {screen === "editor" &&
          cap({ label: "Esc", send: "Escape", wide: true }, "accent")}

        {screen === "shell" && (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              setCtrl((on) => !on);
            }}
            className={[
              "h-9 min-w-11 shrink-0 rounded-md border px-2 text-[13px] leading-none",
              ctrl
                ? "border-accent bg-accent text-[var(--bg)]"
                : "border-edge bg-sunken text-fg",
            ].join(" ")}
          >
            Ctrl
          </button>
        )}

        {screen === "editor" && cap({ label: ":", wide: false }, "accent")}
        {screen === "editor" && cap({ label: "/", wide: false }, "accent")}
        {screen === "shell" && cap({ label: "↵", send: "Enter", wide: true }, "accent")}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {ARROWS.map((key) => cap(key))}
        </div>
      </div>

      <div className="thin-scroll flex items-center gap-1.5 overflow-x-auto px-2 py-1.5">
        {row.map((key) => cap(key))}
      </div>
    </div>
  );
}
