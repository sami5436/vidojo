import type { Pos } from "./types";

export type Span = { start: Pos; end: Pos };

/** Pull the text between two inclusive positions out as lines. */
export function sliceSpan(lines: string[], span: Span): string[] {
  const { start, end } = span;
  if (start.line === end.line) {
    return [(lines[start.line] ?? "").slice(start.col, end.col + 1)];
  }
  const out: string[] = [(lines[start.line] ?? "").slice(start.col)];
  for (let l = start.line + 1; l < end.line; l += 1) out.push(lines[l] ?? "");
  out.push((lines[end.line] ?? "").slice(0, end.col + 1));
  return out;
}

/** Remove the inclusive span and report where the cursor should land. */
export function deleteSpan(
  lines: string[],
  span: Span,
): { lines: string[]; cursor: Pos } {
  const { start, end } = span;
  const next = [...lines];

  if (start.line === end.line) {
    const text = next[start.line] ?? "";
    next[start.line] = text.slice(0, start.col) + text.slice(end.col + 1);
  } else {
    const headText = (next[start.line] ?? "").slice(0, start.col);
    const tailText = (next[end.line] ?? "").slice(end.col + 1);
    next.splice(start.line, end.line - start.line + 1, headText + tailText);
  }

  if (next.length === 0) next.push("");
  return { lines: next, cursor: { ...start } };
}

export function deleteLines(
  lines: string[],
  from: number,
  to: number,
): { lines: string[]; cursor: Pos } {
  const next = [...lines];
  next.splice(from, to - from + 1);
  if (next.length === 0) next.push("");
  const line = Math.min(from, next.length - 1);
  return { lines: next, cursor: { line, col: 0 } };
}

export function insertText(
  lines: string[],
  at: Pos,
  text: string[],
): { lines: string[]; cursor: Pos } {
  const next = [...lines];
  const target = next[at.line] ?? "";
  const head = target.slice(0, at.col);
  const tail = target.slice(at.col);

  if (text.length === 1) {
    next[at.line] = head + text[0] + tail;
    return {
      lines: next,
      cursor: { line: at.line, col: at.col + Math.max(0, text[0].length - 1) },
    };
  }

  const block = [
    head + text[0],
    ...text.slice(1, -1),
    text[text.length - 1] + tail,
  ];
  next.splice(at.line, 1, ...block);
  return {
    lines: next,
    cursor: {
      line: at.line + text.length - 1,
      col: Math.max(0, text[text.length - 1].length - 1),
    },
  };
}

export function insertLines(
  lines: string[],
  at: number,
  text: string[],
): string[] {
  const next = [...lines];
  next.splice(at, 0, ...text);
  return next;
}

const INDENT = "  ";

export function shiftLines(
  lines: string[],
  from: number,
  to: number,
  direction: 1 | -1,
): string[] {
  const next = [...lines];
  for (let l = from; l <= to; l += 1) {
    const text = next[l] ?? "";
    if (direction === 1) {
      next[l] = text.trim() === "" ? text : INDENT + text;
    } else {
      next[l] = text.startsWith(INDENT)
        ? text.slice(INDENT.length)
        : text.replace(/^\s+/, "");
    }
  }
  return next;
}

export function swapCase(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) =>
    char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase(),
  );
}

export function joinLines(
  lines: string[],
  at: number,
  count: number,
): { lines: string[]; cursor: Pos } {
  const next = [...lines];
  let cursorCol = 0;
  const joins = Math.max(1, count - 1);

  for (let i = 0; i < joins; i += 1) {
    if (at + 1 >= next.length) break;
    const head = next[at].replace(/\s+$/, "");
    const tail = next[at + 1].replace(/^\s+/, "");
    cursorCol = head.length;
    // vi puts one space between the pieces unless the tail starts with a paren.
    const glue = head === "" || tail === "" || tail.startsWith(")") ? "" : " ";
    next.splice(at, 2, head + glue + tail);
  }

  return { lines: next, cursor: { line: at, col: cursorCol } };
}
