import { classify, classifyBig, firstNonBlank, isBlankLine, CLOSERS, PAIRS } from "./text";
import type { EditorState, Pos } from "./types";

export type MotionKind = "exclusive" | "inclusive" | "linewise";

export type MotionResult = {
  pos: Pos;
  kind: MotionKind;
  failed?: boolean;
  /** w behaves differently when it is the target of an operator */
  operatorHint?: "wordEnd";
};

type Ctx = {
  lines: string[];
  from: Pos;
  count: number;
  /** whether the user actually typed digits, which is what G cares about */
  hasCount: boolean;
  state: EditorState;
};

function at(lines: string[], line: number): string {
  return lines[line] ?? "";
}

function lastLine(lines: string[]): number {
  return Math.max(0, lines.length - 1);
}

function stepForward(lines: string[], pos: Pos): Pos | null {
  const text = at(lines, pos.line);
  if (pos.col < text.length - 1 || (text.length === 0 && pos.line < lastLine(lines))) {
    if (text.length === 0) return { line: pos.line + 1, col: 0 };
    return { line: pos.line, col: pos.col + 1 };
  }
  if (pos.line >= lastLine(lines)) return null;
  return { line: pos.line + 1, col: 0 };
}

function stepBack(lines: string[], pos: Pos): Pos | null {
  if (pos.col > 0) return { line: pos.line, col: pos.col - 1 };
  if (pos.line === 0) return null;
  const above = at(lines, pos.line - 1);
  return { line: pos.line - 1, col: Math.max(0, above.length - 1) };
}

function charAt(lines: string[], pos: Pos): string | undefined {
  return at(lines, pos.line)[pos.col];
}

function wordForward(lines: string[], from: Pos, big: boolean): Pos {
  const cls = big ? classifyBig : classify;
  let pos = from;
  const start = cls(charAt(lines, pos));

  // Step off the current run of same class characters.
  if (start !== "blank") {
    while (true) {
      const next = stepForward(lines, pos);
      if (!next) return pos;
      if (next.line !== pos.line) {
        pos = next;
        // An empty line is a word of its own.
        if (at(lines, pos.line) === "") return pos;
        break;
      }
      pos = next;
      if (cls(charAt(lines, pos)) !== start) break;
    }
  }

  // Then skip blanks until the next word starts.
  while (cls(charAt(lines, pos)) === "blank") {
    if (at(lines, pos.line) === "" && pos !== from) return pos;
    const next = stepForward(lines, pos);
    if (!next) return pos;
    pos = next;
    if (at(lines, pos.line) === "") return pos;
  }

  return pos;
}

function wordBack(lines: string[], from: Pos, big: boolean): Pos {
  const cls = big ? classifyBig : classify;
  let pos = from;

  let prev = stepBack(lines, pos);
  if (!prev) return pos;
  pos = prev;

  while (cls(charAt(lines, pos)) === "blank") {
    if (at(lines, pos.line) === "") return pos;
    prev = stepBack(lines, pos);
    if (!prev) return pos;
    pos = prev;
  }

  const runClass = cls(charAt(lines, pos));
  while (true) {
    const back = stepBack(lines, pos);
    if (!back) return pos;
    if (back.line !== pos.line) return pos;
    if (cls(charAt(lines, back)) !== runClass) return pos;
    pos = back;
  }
}

function wordEnd(lines: string[], from: Pos, big: boolean): Pos {
  const cls = big ? classifyBig : classify;
  let pos = from;

  let next = stepForward(lines, pos);
  if (!next) return pos;
  pos = next;

  while (cls(charAt(lines, pos)) === "blank") {
    next = stepForward(lines, pos);
    if (!next) return pos;
    pos = next;
  }

  const runClass = cls(charAt(lines, pos));
  while (true) {
    const ahead = stepForward(lines, pos);
    if (!ahead || ahead.line !== pos.line) return pos;
    if (cls(charAt(lines, ahead)) !== runClass) return pos;
    pos = ahead;
  }
}

function paragraphForward(lines: string[], from: Pos): Pos {
  let line = from.line + 1;
  while (line < lines.length && isBlankLine(lines[line])) line += 1;
  while (line < lines.length && !isBlankLine(lines[line])) line += 1;
  return { line: Math.min(line, lastLine(lines)), col: 0 };
}

function paragraphBack(lines: string[], from: Pos): Pos {
  let line = from.line - 1;
  while (line >= 0 && isBlankLine(lines[line])) line -= 1;
  while (line >= 0 && !isBlankLine(lines[line])) line -= 1;
  return { line: Math.max(line, 0), col: 0 };
}

function findInLine(
  line: string,
  from: number,
  char: string,
  key: string,
  count: number,
): number | null {
  const forward = key === "f" || key === "t";
  let index = from;
  let found = from;

  for (let n = 0; n < count; n += 1) {
    if (forward) {
      // t stops before the character, so it has to look past where it landed.
      const begin = n === 0 ? index + 1 : index + (key === "t" ? 2 : 1);
      const hit = line.indexOf(char, begin);
      if (hit === -1) return null;
      index = hit;
    } else {
      const begin = n === 0 ? index - 1 : index - (key === "T" ? 2 : 1);
      if (begin < 0) return null;
      const hit = line.lastIndexOf(char, begin);
      if (hit === -1) return null;
      index = hit;
    }
    found = index;
  }

  if (key === "t") return Math.max(0, found - 1);
  if (key === "T") return Math.min(line.length - 1, found + 1);
  return found;
}

/** Bounce to the bracket that matches the one at or after the cursor. */
export function matchBracket(lines: string[], from: Pos): Pos | null {
  const text = at(lines, from.line);
  let col = from.col;
  while (col < text.length && !PAIRS[text[col]] && !CLOSERS[text[col]]) col += 1;
  if (col >= text.length) return null;

  const char = text[col];
  const forward = Boolean(PAIRS[char]);
  const open = forward ? char : CLOSERS[char];
  const close = forward ? PAIRS[char] : char;

  let depth = 0;
  let pos: Pos = { line: from.line, col };

  while (true) {
    const current = charAt(lines, pos);
    if (current === open) depth += forward ? 1 : -1;
    else if (current === close) depth += forward ? -1 : 1;
    if (depth === 0) return pos;

    const next = forward ? stepForward(lines, pos) : stepBack(lines, pos);
    if (!next) return null;
    pos = next;
  }
}

export function searchFrom(
  lines: string[],
  from: Pos,
  pattern: string,
  forward: boolean,
  ignorecase: boolean,
): Pos | null {
  let regex: RegExp;
  try {
    // A pattern that is all lower case matches loosely, which is smartcase.
    const smart = ignorecase && pattern === pattern.toLowerCase();
    regex = new RegExp(pattern, smart ? "gi" : "g");
  } catch {
    return null;
  }

  const total = lines.length;

  for (let step = 1; step <= total; step += 1) {
    const lineIndex = forward
      ? (from.line + step - 1) % total
      : (from.line - step + 1 + total * 2) % total;
    const isStartLine = step === 1;
    const text = lines[lineIndex];
    const hits: number[] = [];
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      hits.push(match.index);
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
      match = regex.exec(text);
    }
    if (hits.length === 0) continue;

    if (forward) {
      const hit = hits.find((index) => !isStartLine || index > from.col);
      if (hit !== undefined) return { line: lineIndex, col: hit };
    } else {
      const usable = hits.filter((index) => !isStartLine || index < from.col);
      if (usable.length > 0) {
        return { line: lineIndex, col: usable[usable.length - 1] };
      }
    }
  }

  return null;
}

export function allMatches(
  lines: string[],
  pattern: string,
  ignorecase: boolean,
): Record<number, Array<[number, number]>> {
  const found: Record<number, Array<[number, number]>> = {};
  if (!pattern) return found;

  let regex: RegExp;
  try {
    const smart = ignorecase && pattern === pattern.toLowerCase();
    regex = new RegExp(pattern, smart ? "gi" : "g");
  } catch {
    return found;
  }

  lines.forEach((text, index) => {
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      if (match[0].length > 0) {
        (found[index] ??= []).push([match.index, match.index + match[0].length]);
      }
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
      match = regex.exec(text);
    }
  });

  return found;
}

/**
 * Resolve a motion key into a destination. Returns null when the key is not a
 * motion at all, so the caller can try it as a command instead.
 */
export function applyMotion(
  key: string,
  ctx: Ctx,
  argument?: string,
): MotionResult | null {
  const { lines, from, count, state } = ctx;
  const line = at(lines, from.line);
  const last = lastLine(lines);

  switch (key) {
    case "h":
    case "Backspace":
      return {
        pos: { line: from.line, col: Math.max(0, from.col - count) },
        kind: "exclusive",
      };
    case "l":
    case " ":
      return {
        pos: {
          line: from.line,
          col: Math.min(Math.max(0, line.length - 1), from.col + count),
        },
        kind: "exclusive",
      };
    case "j":
    case "+":
      return {
        pos: { line: Math.min(last, from.line + count), col: from.col },
        kind: "linewise",
      };
    case "k":
    case "-":
      return {
        pos: { line: Math.max(0, from.line - count), col: from.col },
        kind: "linewise",
      };
    case "0":
      return { pos: { line: from.line, col: 0 }, kind: "exclusive" };
    case "^":
      return {
        pos: { line: from.line, col: firstNonBlank(line) },
        kind: "exclusive",
      };
    case "$": {
      const target = Math.min(last, from.line + count - 1);
      return {
        pos: { line: target, col: Math.max(0, at(lines, target).length - 1) },
        kind: "inclusive",
      };
    }
    case "g_": {
      const trimmed = line.replace(/\s+$/, "");
      return {
        pos: { line: from.line, col: Math.max(0, trimmed.length - 1) },
        kind: "inclusive",
      };
    }
    case "w":
    case "W": {
      let pos = from;
      for (let i = 0; i < count; i += 1) pos = wordForward(lines, pos, key === "W");
      return { pos, kind: "exclusive" };
    }
    case "b":
    case "B": {
      let pos = from;
      for (let i = 0; i < count; i += 1) pos = wordBack(lines, pos, key === "B");
      return { pos, kind: "exclusive" };
    }
    case "e":
    case "E": {
      let pos = from;
      for (let i = 0; i < count; i += 1) pos = wordEnd(lines, pos, key === "E");
      return { pos, kind: "inclusive" };
    }
    case "gg":
      return {
        pos: {
          line: Math.min(last, Math.max(0, count - 1)),
          col: firstNonBlank(at(lines, Math.min(last, count - 1))),
        },
        kind: "linewise",
      };
    case "G": {
      const target = ctx.hasCount ? count - 1 : last;
      return {
        pos: { line: Math.min(last, Math.max(0, target)), col: firstNonBlank(at(lines, target)) },
        kind: "linewise",
      };
    }
    case "{": {
      let pos = from;
      for (let i = 0; i < count; i += 1) pos = paragraphBack(lines, pos);
      return { pos, kind: "exclusive" };
    }
    case "}": {
      let pos = from;
      for (let i = 0; i < count; i += 1) pos = paragraphForward(lines, pos);
      return { pos, kind: "exclusive" };
    }
    case "H":
      return { pos: { line: state.topLine, col: 0 }, kind: "linewise" };
    case "L":
      return { pos: { line: Math.min(last, state.topLine + 20), col: 0 }, kind: "linewise" };
    case "M":
      return { pos: { line: Math.floor(last / 2), col: 0 }, kind: "linewise" };
    case "f":
    case "F":
    case "t":
    case "T": {
      if (!argument) return { pos: from, kind: "inclusive", failed: true };
      const hit = findInLine(line, from.col, argument, key, count);
      if (hit === null) return { pos: from, kind: "inclusive", failed: true };
      return {
        pos: { line: from.line, col: hit },
        kind: key === "f" || key === "t" ? "inclusive" : "exclusive",
      };
    }
    case "%": {
      const hit = matchBracket(lines, from);
      if (!hit) return { pos: from, kind: "inclusive", failed: true };
      return { pos: hit, kind: "inclusive" };
    }
    case "n":
    case "N": {
      const search = state.lastSearch;
      if (!search) return { pos: from, kind: "exclusive", failed: true };
      const forward = key === "n" ? search.forward : !search.forward;
      let pos = from;
      for (let i = 0; i < count; i += 1) {
        const hit = searchFrom(
          lines,
          pos,
          search.pattern,
          forward,
          state.options.ignorecase,
        );
        if (!hit) return { pos: from, kind: "exclusive", failed: true };
        pos = hit;
      }
      return { pos, kind: "exclusive" };
    }
    default:
      return null;
  }
}

export const MOTION_KEYS = new Set([
  "h", "j", "k", "l", "w", "W", "b", "B", "e", "E",
  "0", "^", "$", "{", "}", "%", "G", "H", "M", "L",
  "n", "N", "+", "-", " ", "Backspace",
]);

export const FIND_KEYS = new Set(["f", "F", "t", "T"]);
