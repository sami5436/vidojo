"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { languageFor, highlightLines, TONE_CLASS, type TokenTone } from "@/lib/highlight";
import { allMatches } from "@/lib/vi/motions";
import { isVisual, visualSpan } from "@/lib/vi/engine";
import { orderPos, type EditorState, type Mode } from "@/lib/vi/types";

const LINE_HEIGHT = 20;

const MODE_LABEL: Partial<Record<Mode, string>> = {
  insert: "INSERT",
  replace: "REPLACE",
  visual: "VISUAL",
  vline: "VISUAL LINE",
  vblock: "VISUAL BLOCK",
};

type Cell = {
  char: string;
  tone: TokenTone;
  selected: boolean;
  matched: boolean;
  cursor: boolean;
};

function cellsFor(
  text: string,
  tokens: { text: string; tone: TokenTone }[],
  marks: { selected?: [number, number]; matches?: Array<[number, number]>; cursor?: number },
): Cell[] {
  const tones: TokenTone[] = [];
  for (const token of tokens) {
    for (let i = 0; i < token.text.length; i += 1) tones.push(token.tone);
  }

  const cells: Cell[] = [];
  const length = Math.max(text.length, (marks.cursor ?? 0) + 1);

  for (let i = 0; i < length; i += 1) {
    const inSelection =
      marks.selected !== undefined && i >= marks.selected[0] && i <= marks.selected[1];
    const inMatch = (marks.matches ?? []).some(([from, to]) => i >= from && i < to);
    cells.push({
      char: text[i] ?? " ",
      tone: tones[i] ?? "plain",
      selected: inSelection,
      matched: inMatch,
      cursor: marks.cursor === i,
    });
  }

  return cells;
}

/** Collapse neighbouring cells that render identically into single spans. */
function groupCells(cells: Cell[]) {
  const groups: Array<{ text: string; cell: Cell }> = [];
  for (const cell of cells) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.cell.tone === cell.tone &&
      last.cell.selected === cell.selected &&
      last.cell.matched === cell.matched &&
      !last.cell.cursor &&
      !cell.cursor
    ) {
      last.text += cell.char;
    } else {
      groups.push({ text: cell.char, cell });
    }
  }
  return groups;
}

type Props = {
  state: EditorState;
  focused: boolean;
  onRows: (rows: number) => void;
};

export default function EditorView({ state, focused, onRows }: Props) {
  const frame = useRef<HTMLDivElement>(null);

  // The window height belongs to the session, which also owns the scroll line.
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      onRows(Math.max(4, Math.floor(node.clientHeight / LINE_HEIGHT)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onRows]);

  const rows = state.rows;
  const top = state.topLine;
  const cursorLine = state.cursor.line;

  const language = useMemo(() => languageFor(state.name), [state.name]);
  const tokens = useMemo(
    () => highlightLines(state.lines, language),
    [language, state.lines],
  );

  const matches = useMemo(() => {
    if (!state.options.hlsearch || !state.lastSearch) return {};
    return allMatches(state.lines, state.lastSearch.pattern, state.options.ignorecase);
  }, [state.lastSearch, state.lines, state.options.hlsearch, state.options.ignorecase]);

  const selection = useMemo(() => {
    if (!isVisual(state)) return null;
    const { span } = visualSpan(state);
    const [a, b] = orderPos(span.start, span.end);
    return { a, b, block: state.mode === "vblock", lineMode: state.mode === "vline" };
  }, [state]);

  const visible = state.lines.slice(top, top + rows);
  const gutterWidth = String(state.lines.length).length + 1;
  const inCommand = state.mode === "command";

  const selectionFor = (index: number): [number, number] | undefined => {
    if (!selection) return undefined;
    const { a, b } = selection;
    if (index < a.line || index > b.line) return undefined;
    const text = state.lines[index] ?? "";

    if (selection.lineMode) return [0, Math.max(0, text.length - 1)];

    if (selection.block) {
      const [from, to] = [a.col, b.col].sort((x, y) => x - y);
      return [from, to];
    }

    const from = index === a.line ? a.col : 0;
    const to = index === b.line ? b.col : Math.max(0, text.length - 1);
    return [from, to];
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div
        ref={frame}
        className="min-h-0 flex-1 overflow-hidden px-1 pt-1 text-[13px] sm:px-2"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      >
        {visible.map((text, offset) => {
          const index = top + offset;
          const isCursorLine = index === cursorLine;
          const cells = cellsFor(text, tokens[index] ?? [], {
            selected: selectionFor(index),
            matches: matches[index],
            cursor: isCursorLine && !inCommand ? state.cursor.col : undefined,
          });

          const number = state.options.relativenumber && !isCursorLine
            ? Math.abs(index - cursorLine)
            : index + 1;

          return (
            <div key={index} className="flex whitespace-pre">
              {state.options.number && (
                <span
                  className={[
                    "shrink-0 select-none pr-3 text-right tabular-nums",
                    isCursorLine ? "text-[var(--fg-dim)]" : "text-[var(--fg-faint)]",
                  ].join(" ")}
                  style={{ width: `${gutterWidth + 2}ch` }}
                >
                  {number}
                </span>
              )}
              <span className="min-w-0 flex-1">
                {groupCells(cells).map((group, groupIndex) => (
                  <span
                    key={groupIndex}
                    className={[
                      group.cell.cursor
                        ? focused
                          ? "bg-[var(--cursor)] text-[var(--bg)]"
                          : "outline outline-1 outline-[var(--cursor)]"
                        : group.cell.selected
                          ? `bg-[var(--sel)] ${TONE_CLASS[group.cell.tone]}`
                          : group.cell.matched
                            ? "bg-[var(--warn)] text-[var(--bg)]"
                            : TONE_CLASS[group.cell.tone],
                      state.options.list ? "" : "",
                    ].join(" ")}
                  >
                    {group.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}

        {Array.from({ length: Math.max(0, rows - visible.length) }).map((_, index) => (
          <div key={`tilde-${index}`} className="flex whitespace-pre">
            <span
              className="shrink-0 select-none pr-3 text-right text-[var(--tilde)]"
              style={{ width: `${gutterWidth + 2}ch` }}
            >
              ~
            </span>
          </div>
        ))}
      </div>

      <StatusLine state={state} />
    </div>
  );
}

function StatusLine({ state }: { state: EditorState }) {
  const label = MODE_LABEL[state.mode];
  const percent =
    state.lines.length <= 1
      ? "All"
      : `${Math.round((state.cursor.line / (state.lines.length - 1)) * 100)}%`;

  return (
    <div className="shrink-0 border-t border-edge-soft bg-raised px-2 py-1 text-[12px] sm:px-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-[var(--fg)]">
          {state.name}
          {state.dirty && <span className="text-[var(--warn)]"> [+]</span>}
        </span>

        {label && (
          <span className="shrink-0 font-bold text-[var(--accent)]">
            {`-- ${label} --`}
          </span>
        )}

        <span className="ml-auto shrink-0 tabular-nums text-[var(--fg-dim)]">
          {state.cursor.line + 1},{state.cursor.col + 1}
        </span>
        <span className="shrink-0 tabular-nums text-[var(--fg-faint)]">{percent}</span>
      </div>

      <div className="flex h-[1.4em] items-center gap-2">
        {state.mode === "command" ? (
          <span className="text-[var(--fg)]">
            {state.cmdPrefix}
            {state.cmdline}
            <span className="cursor-blink bg-[var(--cursor)] text-[var(--bg)]"> </span>
          </span>
        ) : state.message ? (
          <span
            className={
              state.message.tone === "err"
                ? "text-[var(--err)]"
                : state.message.tone === "accent"
                  ? "text-[var(--accent)]"
                  : state.message.tone === "warn"
                    ? "text-[var(--warn)]"
                    : "text-[var(--fg-dim)]"
            }
          >
            {state.message.text}
          </span>
        ) : null}

        {state.pending && (
          <span className="ml-auto tabular-nums text-[var(--fg-dim)]">{state.pending}</span>
        )}
      </div>
    </div>
  );
}
