"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EditorView from "@/components/EditorView";
import ShellView from "@/components/ShellView";
import type { Session } from "@/hooks/useSession";

const SPECIAL = new Set([
  "Enter",
  "Escape",
  "Backspace",
  "Tab",
  "Delete",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

// Browser shortcuts worth leaving alone even while the terminal has focus.
const PASS_THROUGH = new Set(["r", "t", "w", "n", "c", "v", "x", "a"]);

type Props = {
  session: Session;
};

export default function Terminal({ session }: Props) {
  const capture = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const { sendKey } = session;

  const focus = useCallback(() => {
    capture.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    focus();
  }, [focus]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.metaKey) return;

      const key = event.key;

      // Android soft keyboards report composing keys, the input event has them.
      if (key === "Unidentified" || event.keyCode === 229) return;

      if (event.ctrlKey || event.altKey) {
        if (key.length !== 1) return;
        if (event.ctrlKey && !event.altKey && PASS_THROUGH.has(key.toLowerCase())) {
          if (key.toLowerCase() === "c" || key.toLowerCase() === "v") return;
        }
        event.preventDefault();
        sendKey(`<C-${key.toLowerCase()}>`);
        return;
      }

      if (SPECIAL.has(key)) {
        event.preventDefault();
        sendKey(key);
        return;
      }

      if (key.length === 1) {
        event.preventDefault();
        sendKey(key);
      }
    },
    [sendKey],
  );

  // Fallback path for soft keyboards that do not report real key values.
  const onInput = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      const node = event.currentTarget;
      const value = node.value;
      node.value = "";
      for (const char of value) {
        if (char === "\n") sendKey("Enter");
        else sendKey(char);
      }
    },
    [sendKey],
  );

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-bg"
      onMouseDown={(event) => {
        // Let people select text without stealing the caret back mid drag.
        if (window.getSelection()?.toString()) return;
        event.preventDefault();
        focus();
      }}
      onTouchStart={focus}
    >
      <textarea
        ref={capture}
        aria-label="Terminal input"
        className="pointer-events-none absolute top-0 left-0 h-px w-px resize-none border-0 bg-transparent p-0 text-transparent opacity-0 outline-none"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {session.screen === "editor" && session.editor ? (
        <EditorView
          state={session.editor}
          focused={focused}
          onRows={session.setRows}
        />
      ) : (
        <ShellView
          scrollback={session.scrollback}
          cwd={session.cwd}
          input={session.input}
          inputCol={session.inputCol}
          focused={focused}
        />
      )}
    </div>
  );
}
