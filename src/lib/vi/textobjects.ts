import { classify, classifyBig, isBlankLine, CLOSERS, PAIRS } from "./text";
import type { Pos } from "./types";

export type ObjRange = {
  start: Pos;
  /** inclusive, the way vi operators expect */
  end: Pos;
  linewise?: boolean;
};

const OPEN_FOR: Record<string, string> = {
  "(": "(", ")": "(", b: "(",
  "[": "[", "]": "[",
  "{": "{", "}": "{", B: "{",
  "<": "<", ">": "<",
};

const CLOSE_FOR: Record<string, string> = {
  "(": ")", "[": "]", "{": "}", "<": ">",
};

const QUOTES = new Set(['"', "'", "`"]);

function at(lines: string[], index: number): string {
  return lines[index] ?? "";
}

function wordRange(
  lines: string[],
  from: Pos,
  around: boolean,
  big: boolean,
): ObjRange | null {
  const line = at(lines, from.line);
  if (line.length === 0) return { start: from, end: from };

  const cls = big ? classifyBig : classify;
  const col = Math.min(from.col, line.length - 1);
  const target = cls(line[col]);

  let start = col;
  while (start > 0 && cls(line[start - 1]) === target) start -= 1;
  let end = col;
  while (end < line.length - 1 && cls(line[end + 1]) === target) end += 1;

  if (around) {
    // aw takes the trailing whitespace, or the leading run when there is none.
    let after = end;
    while (after < line.length - 1 && cls(line[after + 1]) === "blank") after += 1;
    if (after > end) {
      end = after;
    } else {
      while (start > 0 && cls(line[start - 1]) === "blank") start -= 1;
    }
  }

  return { start: { line: from.line, col: start }, end: { line: from.line, col: end } };
}

function quoteRange(
  lines: string[],
  from: Pos,
  quote: string,
  around: boolean,
): ObjRange | null {
  const line = at(lines, from.line);

  // Collect every unescaped quote on the line, then pick the pair we sit in.
  const spots: number[] = [];
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === quote && line[i - 1] !== "\\") spots.push(i);
  }
  if (spots.length < 2) return null;

  for (let i = 0; i + 1 < spots.length; i += 2) {
    const open = spots[i];
    const close = spots[i + 1];
    if (from.col <= close) {
      if (around) {
        return {
          start: { line: from.line, col: open },
          end: { line: from.line, col: close },
        };
      }
      if (close - open <= 1) return null;
      return {
        start: { line: from.line, col: open + 1 },
        end: { line: from.line, col: close - 1 },
      };
    }
  }

  return null;
}

function bracketRange(
  lines: string[],
  from: Pos,
  open: string,
  around: boolean,
): ObjRange | null {
  const close = CLOSE_FOR[open];

  // Walk backwards to the unmatched opener, then forwards to its partner.
  let depth = 0;
  let startPos: Pos | null = null;

  outer: for (let l = from.line; l >= 0; l -= 1) {
    const text = at(lines, l);
    const begin = l === from.line ? Math.min(from.col, text.length - 1) : text.length - 1;
    for (let c = begin; c >= 0; c -= 1) {
      const char = text[c];
      if (char === close && !(l === from.line && c === from.col)) depth += 1;
      else if (char === open) {
        if (depth === 0) {
          startPos = { line: l, col: c };
          break outer;
        }
        depth -= 1;
      }
    }
  }

  if (!startPos) return null;

  depth = 0;
  let endPos: Pos | null = null;

  outer2: for (let l = startPos.line; l < lines.length; l += 1) {
    const text = at(lines, l);
    const begin = l === startPos.line ? startPos.col : 0;
    for (let c = begin; c < text.length; c += 1) {
      const char = text[c];
      if (char === open) depth += 1;
      else if (char === close) {
        depth -= 1;
        if (depth === 0) {
          endPos = { line: l, col: c };
          break outer2;
        }
      }
    }
  }

  if (!endPos) return null;
  if (around) return { start: startPos, end: endPos };

  // Inner, so step inside the brackets.
  let innerStart: Pos = { line: startPos.line, col: startPos.col + 1 };
  let innerEnd: Pos = { line: endPos.line, col: endPos.col - 1 };

  if (innerStart.col >= at(lines, startPos.line).length) {
    innerStart = { line: startPos.line + 1, col: 0 };
  }
  if (innerEnd.col < 0) {
    const above = endPos.line - 1;
    innerEnd = { line: above, col: Math.max(0, at(lines, above).length - 1) };
  }

  // A block that opens and closes on its own lines behaves linewise.
  if (innerStart.line > innerEnd.line) return null;
  const opensAlone = startPos.col + 1 >= at(lines, startPos.line).length;
  const closesAlone = at(lines, endPos.line).slice(0, endPos.col).trim() === "";
  if (opensAlone && closesAlone && innerStart.line <= innerEnd.line) {
    return {
      start: { line: innerStart.line, col: 0 },
      end: { line: innerEnd.line, col: Math.max(0, at(lines, innerEnd.line).length - 1) },
      linewise: true,
    };
  }

  return { start: innerStart, end: innerEnd };
}

function paragraphRange(lines: string[], from: Pos, around: boolean): ObjRange {
  const blank = isBlankLine(at(lines, from.line));
  let start = from.line;
  let end = from.line;

  while (start > 0 && isBlankLine(at(lines, start - 1)) === blank) start -= 1;
  while (end < lines.length - 1 && isBlankLine(at(lines, end + 1)) === blank) end += 1;

  if (around) {
    let after = end;
    while (after < lines.length - 1 && isBlankLine(at(lines, after + 1)) !== blank) {
      after += 1;
    }
    end = after;
  }

  return {
    start: { line: start, col: 0 },
    end: { line: end, col: Math.max(0, at(lines, end).length - 1) },
    linewise: true,
  };
}

/**
 * Resolve a text object such as iw, a", i( or ap.
 * `kind` is i or a, `target` is the character after it.
 */
export function textObject(
  lines: string[],
  from: Pos,
  kind: "i" | "a",
  target: string,
): ObjRange | null {
  const around = kind === "a";

  if (target === "w") return wordRange(lines, from, around, false);
  if (target === "W") return wordRange(lines, from, around, true);
  if (QUOTES.has(target)) return quoteRange(lines, from, target, around);
  if (OPEN_FOR[target]) return bracketRange(lines, from, OPEN_FOR[target], around);
  if (target === "p") return paragraphRange(lines, from, around);

  return null;
}

export const OBJECT_TARGETS = new Set([
  "w", "W", "p",
  '"', "'", "`",
  "(", ")", "b", "[", "]", "{", "}", "B", "<", ">",
]);

export { PAIRS, CLOSERS };
