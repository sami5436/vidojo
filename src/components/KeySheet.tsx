"use client";

import { useEffect } from "react";

type Row = [string, string];

const SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Modes",
    rows: [
      ["i a I A", "insert before, after, at first word, at end of line"],
      ["o O", "open a line below or above"],
      ["v V", "visual by character, visual by line"],
      ["Esc", "back to normal mode, always"],
      [": / ?", "command line, search forward, search back"],
    ],
  },
  {
    title: "Moving",
    rows: [
      ["h j k l", "left, down, up, right"],
      ["w b e", "next word, previous word, end of word"],
      ["0 ^ $", "column one, first real character, end of line"],
      ["gg G 5G", "top, bottom, line five"],
      ["{ }", "previous paragraph, next paragraph"],
      ["f x  t x", "jump to x on this line, or stop before it"],
      ["; ,", "repeat that jump forward or back"],
      ["%", "bounce to the matching bracket"],
      ["n N", "next and previous search hit"],
      ["ctrl d  ctrl u", "half a screen down or up"],
    ],
  },
  {
    title: "Operators",
    rows: [
      ["d c y", "delete, change, yank"],
      ["dw d$ dd", "delete a word, to end of line, a whole line"],
      ["cw cc", "change a word, change the line"],
      ["yy p P", "yank a line, put after, put before"],
      ["x s r", "delete a character, substitute it, replace it"],
      ["> <", "indent right or left"],
      ["J", "join this line with the next"],
      ["3dw 5j", "any command takes a count in front"],
    ],
  },
  {
    title: "Text objects",
    rows: [
      ["ciw diw", "change or delete the word you are inside"],
      ["ci\" di'", "the text between quotes"],
      ["ci( ci{ ci[", "the text between brackets"],
      ["daw", "the word plus the space after it"],
      ["ca(", "the brackets as well as their contents"],
      ["dap", "the whole paragraph"],
    ],
  },
  {
    title: "Undo and repeat",
    rows: [
      ["u", "undo"],
      ["ctrl r", "redo"],
      [".", "repeat the last change"],
      ["m a  then  'a", "set a mark, then jump back to it"],
    ],
  },
  {
    title: "Leaving",
    rows: [
      [":w", "write the file"],
      [":q", "quit, if nothing is unsaved"],
      [":q!", "quit and throw the changes away"],
      [":wq", "write and quit"],
      [":set nu  :set nonu", "turn line numbers on or off"],
    ],
  },
];

export default function KeySheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-3 sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="thin-scroll max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-edge bg-raised p-4 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="vi key sheet"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-bold text-fg">The key sheet</h2>
          <span className="text-[12px] text-faint">
            everything this dojo understands
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded border border-edge px-2 py-1 text-[12px] text-dim transition-colors hover:text-fg"
          >
            close
          </button>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-[12px] font-bold tracking-wide text-accent uppercase">
                {section.title}
              </h3>
              <dl className="mt-1.5">
                {section.rows.map(([keys, what]) => (
                  <div
                    key={keys}
                    className="flex items-baseline gap-3 border-b border-edge-soft py-1 last:border-0"
                  >
                    <dt className="w-32 shrink-0 text-[12px] text-fg">{keys}</dt>
                    <dd className="text-[12px] leading-snug text-dim">{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="mt-5 text-[12px] text-faint">
          At the shell, type help for the commands this box understands.
        </p>
      </div>
    </div>
  );
}
