import {
  deleteLines,
  deleteSpan,
  insertLines,
  insertText,
  joinLines,
  shiftLines,
  sliceSpan,
  swapCase,
  type Span,
} from "./edits";
import { runEx, runSearch } from "./excmd";
import { applyMotion } from "./motions";
import { parseCommand, type Cmd, type Target } from "./parse";
import { firstNonBlank } from "./text";
import { textObject } from "./textobjects";
import {
  clampCol,
  comparePos,
  orderPos,
  type EditorState,
  type Message,
  type Pos,
} from "./types";

/** The single character tokens the view sends for Escape and Enter. */
export const ESC = String.fromCharCode(27);
export const CR = String.fromCharCode(13);

const ENTERS_INSERT = new Set(["c", "s", "S", "C", "i", "a", "I", "A", "o", "O"]);
const CHANGE_OPS = new Set(["d", "c", ">", "<", "gu", "gU", "g~"]);
const CHANGE_SIMPLE = new Set([
  "x", "X", "D", "C", "s", "S", "p", "P", "J", "~", "r",
  "i", "a", "I", "A", "o", "O", "R", "gJ",
]);

const MAX_UNDO = 240;

function copy(state: EditorState): EditorState {
  return {
    ...state,
    cursor: { ...state.cursor },
    visualStart: state.visualStart ? { ...state.visualStart } : null,
    options: { ...state.options },
    marks: { ...state.marks },
    register: { ...state.register, lines: [...state.register.lines] },
    message: null,
    pendingWrite: null,
    exit: null,
  };
}

function say(state: EditorState, text: string, tone: Message["tone"] = "fg") {
  state.message = { text, tone };
  return state;
}

function pushUndo(state: EditorState) {
  state.undo = [...state.undo, { lines: state.lines, cursor: { ...state.cursor } }];
  if (state.undo.length > MAX_UNDO) state.undo = state.undo.slice(-MAX_UNDO);
  state.redo = [];
}

function lineAt(state: EditorState, index: number): string {
  return state.lines[index] ?? "";
}

function settle(state: EditorState) {
  state.cursor.line = Math.max(0, Math.min(state.cursor.line, state.lines.length - 1));
  state.cursor.col = clampCol(lineAt(state, state.cursor.line), state.cursor.col, state.mode);
}

const isVisual = (state: EditorState) =>
  state.mode === "visual" || state.mode === "vline" || state.mode === "vblock";

/* ------------------------------------------------------------------ */
/* motions                                                             */
/* ------------------------------------------------------------------ */

function moveTo(state: EditorState, cmd: Extract<Cmd, { kind: "motion" }>): EditorState {
  if (cmd.key === "'" || cmd.key === "`") {
    const mark = cmd.arg ? state.marks[cmd.arg] : undefined;
    if (!mark) return say(state, `E20: Mark not set: ${cmd.arg ?? ""}`, "err");
    const target = Math.min(mark.line, state.lines.length - 1);
    state.cursor = {
      line: target,
      col: cmd.key === "'" ? firstNonBlank(lineAt(state, target)) : mark.col,
    };
    settle(state);
    state.desiredCol = state.cursor.col;
    return state;
  }

  const vertical =
    cmd.key === "j" || cmd.key === "k" || cmd.key === "+" || cmd.key === "-";
  const from: Pos = vertical
    ? { line: state.cursor.line, col: state.desiredCol }
    : state.cursor;

  const result = applyMotion(
    cmd.key,
    {
      lines: state.lines,
      from,
      count: cmd.count,
      hasCount: cmd.hasCount,
      state,
    },
    cmd.arg,
  );

  if (!result || result.failed) return state;

  if (cmd.key === "f" || cmd.key === "F" || cmd.key === "t" || cmd.key === "T") {
    state.lastFind = { key: cmd.key, char: cmd.arg ?? "" };
  }

  state.cursor = { ...result.pos };
  settle(state);

  if (cmd.key === "$") {
    state.desiredCol = Number.MAX_SAFE_INTEGER;
  } else if (!vertical) {
    state.desiredCol = state.cursor.col;
  }

  return state;
}

/* ------------------------------------------------------------------ */
/* operator ranges                                                     */
/* ------------------------------------------------------------------ */

type Resolved = { span: Span; linewise: boolean } | null;

function resolveTarget(state: EditorState, op: string, target: Target): Resolved {
  const cursor = state.cursor;

  if (target.kind === "line") {
    const endLine = Math.min(state.lines.length - 1, cursor.line + target.count - 1);
    return {
      span: {
        start: { line: cursor.line, col: 0 },
        end: { line: endLine, col: Math.max(0, lineAt(state, endLine).length - 1) },
      },
      linewise: true,
    };
  }

  if (target.kind === "object") {
    const range = textObject(state.lines, cursor, target.scope, target.target);
    if (!range) return null;
    return {
      span: { start: range.start, end: range.end },
      linewise: Boolean(range.linewise),
    };
  }

  let key = target.key;
  // cw on a word acts like ce, which is the one place vi bends its own rule.
  if (op === "c" && (key === "w" || key === "W")) {
    const char = lineAt(state, cursor.line)[cursor.col];
    if (char && !/\s/.test(char)) key = key === "w" ? "e" : "E";
  }

  const result = applyMotion(
    key,
    {
      lines: state.lines,
      from: cursor,
      count: target.count,
      hasCount: true,
      state,
    },
    target.arg,
  );

  if (!result || result.failed) return null;

  if (result.kind === "linewise") {
    const [a, b] = [cursor.line, result.pos.line].sort((x, y) => x - y);
    return {
      span: {
        start: { line: a, col: 0 },
        end: { line: b, col: Math.max(0, lineAt(state, b).length - 1) },
      },
      linewise: true,
    };
  }

  let [start, end] = orderPos(cursor, result.pos);
  start = { ...start };
  end = { ...end };

  if (result.kind === "exclusive") {
    // dw on the last word of a line stops at the line end instead of joining.
    if ((key === "w" || key === "W") && end.line > start.line) {
      const tail = lineAt(state, start.line);
      if (tail.slice(start.col).trim() !== "") {
        return {
          span: {
            start,
            end: { line: start.line, col: Math.max(0, tail.length - 1) },
          },
          linewise: false,
        };
      }
    }

    if (end.col === 0 && end.line > start.line) {
      const above = end.line - 1;
      const aboveEnd = { line: above, col: Math.max(0, lineAt(state, above).length - 1) };
      // An exclusive motion that lands in column zero becomes linewise.
      if (start.col <= firstNonBlank(lineAt(state, start.line))) {
        return {
          span: { start: { line: start.line, col: 0 }, end: aboveEnd },
          linewise: true,
        };
      }
      end = aboveEnd;
    } else {
      end = { ...end, col: end.col - 1 };
    }
  }

  if (comparePos(start, end) > 0) return null;
  return { span: { start, end }, linewise: false };
}

function wholeLines(state: EditorState, span: Span): Span {
  return {
    start: { line: span.start.line, col: 0 },
    end: {
      line: span.end.line,
      col: Math.max(0, lineAt(state, span.end.line).length - 1),
    },
  };
}

function visualSpan(state: EditorState): { span: Span; linewise: boolean } {
  const anchor = state.visualStart ?? state.cursor;
  const [a, b] = orderPos(anchor, state.cursor);

  if (state.mode === "vline") {
    return { span: wholeLines(state, { start: a, end: b }), linewise: true };
  }

  return { span: { start: { ...a }, end: { ...b } }, linewise: false };
}

/* ------------------------------------------------------------------ */
/* operators                                                           */
/* ------------------------------------------------------------------ */

function yankInto(state: EditorState, span: Span, linewise: boolean) {
  const text = linewise
    ? state.lines.slice(span.start.line, span.end.line + 1)
    : sliceSpan(state.lines, span);
  state.register = { lines: text, linewise };
}

function applyOperator(
  state: EditorState,
  op: string,
  span: Span,
  linewise: boolean,
): EditorState {
  if (op === "y") {
    yankInto(state, span, linewise);
    state.cursor = { ...span.start };
    settle(state);
    const count = span.end.line - span.start.line + 1;
    if (linewise && count > 1) say(state, `${count} lines yanked`, "dim");
    return state;
  }

  if (op === "d" || op === "c") {
    pushUndo(state);
    yankInto(state, span, linewise);

    if (linewise && op === "c") {
      // Linewise change empties the lines and leaves one to type on.
      const indent = lineAt(state, span.start.line).match(/^\s*/)?.[0] ?? "";
      const next = [...state.lines];
      next.splice(span.start.line, span.end.line - span.start.line + 1, indent);
      state.lines = next;
      state.cursor = { line: span.start.line, col: indent.length };
      state.mode = "insert";
      state.dirty = true;
      return state;
    }

    const result = linewise
      ? deleteLines(state.lines, span.start.line, span.end.line)
      : deleteSpan(state.lines, span);

    state.lines = result.lines;
    state.cursor = result.cursor;
    state.dirty = true;

    if (op === "c") {
      state.mode = "insert";
    } else if (linewise) {
      state.cursor.col = firstNonBlank(lineAt(state, state.cursor.line));
    }

    settle(state);
    return state;
  }

  if (op === ">" || op === "<") {
    pushUndo(state);
    state.lines = shiftLines(
      state.lines,
      span.start.line,
      span.end.line,
      op === ">" ? 1 : -1,
    );
    state.cursor = {
      line: span.start.line,
      col: firstNonBlank(lineAt(state, span.start.line)),
    };
    state.dirty = true;
    settle(state);
    return state;
  }

  if (op === "gu" || op === "gU" || op === "g~") {
    pushUndo(state);
    const transform = (text: string) =>
      op === "gu"
        ? text.toLowerCase()
        : op === "gU"
          ? text.toUpperCase()
          : swapCase(text);

    const next = [...state.lines];
    if (linewise) {
      for (let l = span.start.line; l <= span.end.line; l += 1) {
        next[l] = transform(next[l]);
      }
    } else if (span.start.line === span.end.line) {
      const text = next[span.start.line];
      next[span.start.line] =
        text.slice(0, span.start.col) +
        transform(text.slice(span.start.col, span.end.col + 1)) +
        text.slice(span.end.col + 1);
    } else {
      next[span.start.line] =
        next[span.start.line].slice(0, span.start.col) +
        transform(next[span.start.line].slice(span.start.col));
      for (let l = span.start.line + 1; l < span.end.line; l += 1) {
        next[l] = transform(next[l]);
      }
      next[span.end.line] =
        transform(next[span.end.line].slice(0, span.end.col + 1)) +
        next[span.end.line].slice(span.end.col + 1);
    }

    state.lines = next;
    state.cursor = { ...span.start };
    state.dirty = true;
    settle(state);
    return state;
  }

  if (op === "=") {
    return say(state, "Auto indent is not part of this dojo", "dim");
  }

  return state;
}

/* ------------------------------------------------------------------ */
/* paste                                                               */
/* ------------------------------------------------------------------ */

function paste(state: EditorState, after: boolean, count: number): EditorState {
  const register = state.register;
  if (register.lines.length === 0) return say(state, "Nothing to put", "dim");

  pushUndo(state);
  state.dirty = true;

  if (register.linewise) {
    const block: string[] = [];
    for (let i = 0; i < count; i += 1) block.push(...register.lines);
    const at = after ? state.cursor.line + 1 : state.cursor.line;
    state.lines = insertLines(state.lines, at, block);
    state.cursor = { line: at, col: firstNonBlank(lineAt(state, at)) };
    settle(state);
    return state;
  }

  const text = [...register.lines];
  if (count > 1 && text.length === 1) text[0] = text[0].repeat(count);

  const line = lineAt(state, state.cursor.line);
  const col = after ? Math.min(line.length, state.cursor.col + 1) : state.cursor.col;
  const result = insertText(state.lines, { line: state.cursor.line, col }, text);
  state.lines = result.lines;
  state.cursor = result.cursor;
  settle(state);
  return state;
}

/* ------------------------------------------------------------------ */
/* simple commands                                                     */
/* ------------------------------------------------------------------ */

function enterInsert(state: EditorState, col: number): EditorState {
  pushUndo(state);
  state.mode = "insert";
  state.cursor.col = Math.max(0, Math.min(col, lineAt(state, state.cursor.line).length));
  return state;
}

function openLine(state: EditorState, below: boolean, count: number): EditorState {
  pushUndo(state);
  const source = lineAt(state, state.cursor.line);
  const indent = source.match(/^\s*/)?.[0] ?? "";
  const at = below ? state.cursor.line + 1 : state.cursor.line;
  const block = Array.from({ length: Math.max(1, count) }, () => indent);
  state.lines = insertLines(state.lines, at, block);
  state.cursor = { line: at, col: indent.length };
  state.mode = "insert";
  state.dirty = true;
  return state;
}

function leaveVisual(state: EditorState) {
  state.mode = "normal";
  state.visualStart = null;
}

function doSimple(
  state: EditorState,
  cmd: Extract<Cmd, { kind: "simple" }>,
): EditorState {
  if (isVisual(state)) return visualSimple(state, cmd);

  const { key, count } = cmd;
  const line = lineAt(state, state.cursor.line);

  switch (key) {
    case "i":
      return enterInsert(state, state.cursor.col);
    case "a":
      return enterInsert(state, state.cursor.col + 1);
    case "I":
      return enterInsert(state, firstNonBlank(line));
    case "A":
      return enterInsert(state, line.length);
    case "o":
      return openLine(state, true, count);
    case "O":
      return openLine(state, false, count);

    case "R":
      pushUndo(state);
      state.mode = "replace";
      return state;

    case "x": {
      if (line.length === 0) return state;
      pushUndo(state);
      const end = Math.min(line.length - 1, state.cursor.col + count - 1);
      const span = {
        start: { ...state.cursor },
        end: { line: state.cursor.line, col: end },
      };
      yankInto(state, span, false);
      const result = deleteSpan(state.lines, span);
      state.lines = result.lines;
      state.cursor = result.cursor;
      state.dirty = true;
      settle(state);
      return state;
    }

    case "X": {
      if (state.cursor.col === 0) return state;
      pushUndo(state);
      const span = {
        start: { line: state.cursor.line, col: Math.max(0, state.cursor.col - count) },
        end: { line: state.cursor.line, col: state.cursor.col - 1 },
      };
      yankInto(state, span, false);
      const result = deleteSpan(state.lines, span);
      state.lines = result.lines;
      state.cursor = result.cursor;
      state.dirty = true;
      settle(state);
      return state;
    }

    case "D":
    case "C": {
      pushUndo(state);
      if (line.length > 0) {
        const span = {
          start: { ...state.cursor },
          end: { line: state.cursor.line, col: Math.max(0, line.length - 1) },
        };
        yankInto(state, span, false);
        const result = deleteSpan(state.lines, span);
        state.lines = result.lines;
        state.cursor = result.cursor;
      }
      state.dirty = true;
      if (key === "C") state.mode = "insert";
      settle(state);
      return state;
    }

    case "Y": {
      const end = Math.min(state.lines.length - 1, state.cursor.line + count - 1);
      yankInto(
        state,
        { start: { line: state.cursor.line, col: 0 }, end: { line: end, col: 0 } },
        true,
      );
      return state;
    }

    case "s": {
      pushUndo(state);
      if (line.length > 0) {
        const end = Math.min(line.length - 1, state.cursor.col + count - 1);
        const span = {
          start: { ...state.cursor },
          end: { line: state.cursor.line, col: end },
        };
        yankInto(state, span, false);
        const result = deleteSpan(state.lines, span);
        state.lines = result.lines;
        state.cursor = result.cursor;
      }
      state.mode = "insert";
      state.dirty = true;
      return state;
    }

    case "S": {
      pushUndo(state);
      const end = Math.min(state.lines.length - 1, state.cursor.line + count - 1);
      yankInto(
        state,
        { start: { line: state.cursor.line, col: 0 }, end: { line: end, col: 0 } },
        true,
      );
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const next = [...state.lines];
      next.splice(state.cursor.line, end - state.cursor.line + 1, indent);
      state.lines = next;
      state.cursor = { line: state.cursor.line, col: indent.length };
      state.mode = "insert";
      state.dirty = true;
      return state;
    }

    case "p":
      return paste(state, true, count);
    case "P":
      return paste(state, false, count);

    case "J":
    case "gJ": {
      pushUndo(state);
      const result = joinLines(state.lines, state.cursor.line, Math.max(2, count));
      state.lines = result.lines;
      state.cursor = result.cursor;
      state.dirty = true;
      settle(state);
      return state;
    }

    case "~": {
      if (line.length === 0) return state;
      pushUndo(state);
      const end = Math.min(line.length, state.cursor.col + count);
      const next = [...state.lines];
      next[state.cursor.line] =
        line.slice(0, state.cursor.col) +
        swapCase(line.slice(state.cursor.col, end)) +
        line.slice(end);
      state.lines = next;
      state.cursor.col = Math.min(end, Math.max(0, next[state.cursor.line].length - 1));
      state.dirty = true;
      return state;
    }

    case "r": {
      if (!cmd.arg || line.length === 0) return state;
      if (state.cursor.col + count > line.length) return state;
      pushUndo(state);
      const next = [...state.lines];
      next[state.cursor.line] =
        line.slice(0, state.cursor.col) +
        cmd.arg.repeat(count) +
        line.slice(state.cursor.col + count);
      state.lines = next;
      state.cursor.col += count - 1;
      state.dirty = true;
      return state;
    }

    case "m":
      if (cmd.arg) state.marks[cmd.arg] = { ...state.cursor };
      return state;

    case "u": {
      const previous = state.undo[state.undo.length - 1];
      if (!previous) return say(state, "Already at oldest change", "dim");
      state.redo = [...state.redo, { lines: state.lines, cursor: { ...state.cursor } }];
      state.undo = state.undo.slice(0, -1);
      state.lines = previous.lines;
      state.cursor = { ...previous.cursor };
      state.dirty = true;
      settle(state);
      return say(state, "1 change, before", "dim");
    }

    case "v":
      state.mode = "visual";
      state.visualStart = { ...state.cursor };
      return state;
    case "V":
      state.mode = "vline";
      state.visualStart = { ...state.cursor };
      return state;
    case "gv":
      state.mode = "visual";
      state.visualStart = state.visualStart ?? { ...state.cursor };
      return state;

    case ":":
    case "/":
    case "?":
      state.mode = "command";
      state.cmdPrefix = key;
      state.cmdline = "";
      return state;

    case "ZZ":
      state.pendingWrite = { path: state.path };
      state.exit = { written: true };
      return state;
    case "ZQ":
      state.exit = { written: false };
      return state;

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* visual mode                                                         */
/* ------------------------------------------------------------------ */

function visualSimple(
  state: EditorState,
  cmd: Extract<Cmd, { kind: "simple" }>,
): EditorState {
  const { key } = cmd;
  const { span, linewise } = visualSpan(state);

  switch (key) {
    case "d":
    case "x": {
      leaveVisual(state);
      return applyOperator(state, "d", span, linewise);
    }
    case "D":
    case "X": {
      leaveVisual(state);
      return applyOperator(state, "d", wholeLines(state, span), true);
    }
    case "c":
    case "s": {
      leaveVisual(state);
      return applyOperator(state, "c", span, linewise);
    }
    case "S":
    case "C": {
      leaveVisual(state);
      return applyOperator(state, "c", wholeLines(state, span), true);
    }
    case "y": {
      leaveVisual(state);
      return applyOperator(state, "y", span, linewise);
    }
    case "Y": {
      leaveVisual(state);
      return applyOperator(state, "y", wholeLines(state, span), true);
    }
    case ">":
    case "<": {
      leaveVisual(state);
      return applyOperator(state, key, span, true);
    }
    case "u":
    case "U":
    case "~": {
      leaveVisual(state);
      const op = key === "u" ? "gu" : key === "U" ? "gU" : "g~";
      return applyOperator(state, op, span, linewise);
    }
    case "gu":
    case "gU":
    case "g~": {
      leaveVisual(state);
      return applyOperator(state, key, span, linewise);
    }
    case "J": {
      leaveVisual(state);
      pushUndo(state);
      const result = joinLines(
        state.lines,
        span.start.line,
        Math.max(2, span.end.line - span.start.line + 1),
      );
      state.lines = result.lines;
      state.cursor = result.cursor;
      state.dirty = true;
      settle(state);
      return state;
    }
    case "p": {
      leaveVisual(state);
      const saved = { ...state.register, lines: [...state.register.lines] };
      applyOperator(state, "d", span, linewise);
      state.register = saved;
      return paste(state, false, 1);
    }
    case "r": {
      if (!cmd.arg) return state;
      leaveVisual(state);
      pushUndo(state);
      const next = [...state.lines];
      for (let l = span.start.line; l <= span.end.line; l += 1) {
        const text = next[l];
        const from = l === span.start.line && !linewise ? span.start.col : 0;
        const to = l === span.end.line && !linewise ? span.end.col + 1 : text.length;
        next[l] = text.slice(0, from) + cmd.arg.repeat(Math.max(0, to - from)) + text.slice(to);
      }
      state.lines = next;
      state.cursor = { ...span.start };
      state.dirty = true;
      settle(state);
      return state;
    }
    case "o": {
      const anchor = state.visualStart ?? state.cursor;
      const swap = { ...state.cursor };
      state.cursor = { ...anchor };
      state.visualStart = swap;
      settle(state);
      return state;
    }
    case "v":
      if (state.mode === "visual") leaveVisual(state);
      else state.mode = "visual";
      return state;
    case "V":
      if (state.mode === "vline") leaveVisual(state);
      else state.mode = "vline";
      return state;
    case ":":
    case "/":
    case "?":
      state.mode = "command";
      state.cmdPrefix = key;
      state.cmdline = "";
      return state;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* insert mode                                                         */
/* ------------------------------------------------------------------ */

function insertKey(state: EditorState, key: string): EditorState {
  const { line: lineIndex, col } = state.cursor;
  const text = lineAt(state, lineIndex);

  if (key === ESC) {
    state.mode = "normal";
    state.cursor.col = Math.max(0, col - 1);
    settle(state);
    return state;
  }

  state.dirty = true;

  if (key === CR) {
    const indent = text.match(/^\s*/)?.[0] ?? "";
    const next = [...state.lines];
    next.splice(lineIndex, 1, text.slice(0, col), indent + text.slice(col));
    state.lines = next;
    state.cursor = { line: lineIndex + 1, col: indent.length };
    return state;
  }

  if (key === "Backspace") {
    if (col > 0) {
      const next = [...state.lines];
      next[lineIndex] = text.slice(0, col - 1) + text.slice(col);
      state.lines = next;
      state.cursor.col = col - 1;
      return state;
    }
    if (lineIndex === 0) return state;
    const above = lineAt(state, lineIndex - 1);
    const next = [...state.lines];
    next.splice(lineIndex - 1, 2, above + text);
    state.lines = next;
    state.cursor = { line: lineIndex - 1, col: above.length };
    return state;
  }

  if (key === "Tab") {
    const next = [...state.lines];
    next[lineIndex] = `${text.slice(0, col)}  ${text.slice(col)}`;
    state.lines = next;
    state.cursor.col = col + 2;
    return state;
  }

  if (key.length !== 1) return state;

  const next = [...state.lines];
  if (state.mode === "replace" && col < text.length) {
    next[lineIndex] = text.slice(0, col) + key + text.slice(col + 1);
  } else {
    next[lineIndex] = text.slice(0, col) + key + text.slice(col);
  }
  state.lines = next;
  state.cursor.col = col + 1;
  state.desiredCol = state.cursor.col;
  return state;
}

/* ------------------------------------------------------------------ */
/* command line mode                                                   */
/* ------------------------------------------------------------------ */

function commandKey(state: EditorState, key: string): EditorState {
  if (key === ESC) {
    state.mode = state.visualStart ? "visual" : "normal";
    state.cmdline = "";
    state.cmdPrefix = null;
    return state;
  }

  if (key === "Backspace") {
    if (state.cmdline === "") {
      state.mode = state.visualStart ? "visual" : "normal";
      state.cmdPrefix = null;
      return state;
    }
    state.cmdline = state.cmdline.slice(0, -1);
    return state;
  }

  if (key === CR) {
    const prefix = state.cmdPrefix;
    const input = state.cmdline;
    state.cmdline = "";
    state.cmdPrefix = null;
    state.mode = state.visualStart ? "visual" : "normal";
    if (input !== "") {
      state.cmdHistory = [...state.cmdHistory, `${prefix ?? ""}${input}`];
    }

    const result = prefix === ":" ? runEx(state, input) : runSearch(state, input, prefix === "/");
    settle(result);
    return result;
  }

  if (key.length === 1) state.cmdline += key;
  return state;
}

/* ------------------------------------------------------------------ */
/* control keys                                                        */
/* ------------------------------------------------------------------ */

function ctrlKey(state: EditorState, key: string): EditorState {
  const page = Math.max(1, Math.floor(state.rows / 2));

  switch (key) {
    case "<C-r>": {
      const next = state.redo[state.redo.length - 1];
      if (!next) return say(state, "Already at newest change", "dim");
      state.undo = [...state.undo, { lines: state.lines, cursor: { ...state.cursor } }];
      state.redo = state.redo.slice(0, -1);
      state.lines = next.lines;
      state.cursor = { ...next.cursor };
      settle(state);
      return say(state, "1 change, after", "dim");
    }
    case "<C-d>":
      state.cursor.line = Math.min(state.lines.length - 1, state.cursor.line + page);
      settle(state);
      return state;
    case "<C-u>":
      state.cursor.line = Math.max(0, state.cursor.line - page);
      settle(state);
      return state;
    case "<C-f>":
      state.cursor.line = Math.min(state.lines.length - 1, state.cursor.line + state.rows);
      settle(state);
      return state;
    case "<C-b>":
      state.cursor.line = Math.max(0, state.cursor.line - state.rows);
      settle(state);
      return state;
    case "<C-v>":
      if (state.mode === "vblock") leaveVisual(state);
      else {
        state.mode = "vblock";
        state.visualStart = { ...state.cursor };
      }
      return state;
    case "<C-g>":
      return say(
        state,
        `"${state.name}" ${state.lines.length} lines${state.dirty ? " [Modified]" : ""}`,
        "dim",
      );
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* dispatch                                                            */
/* ------------------------------------------------------------------ */

function isChange(cmd: Cmd): boolean {
  if (cmd.kind === "operator") return CHANGE_OPS.has(cmd.op);
  if (cmd.kind === "simple") return CHANGE_SIMPLE.has(cmd.key);
  return false;
}

function entersInsert(cmd: Cmd): boolean {
  if (cmd.kind === "operator") return cmd.op === "c";
  if (cmd.kind === "simple") return ENTERS_INSERT.has(cmd.key) || cmd.key === "R";
  return false;
}

function execute(state: EditorState, cmd: Cmd): EditorState {
  if (cmd.kind === "motion") {
    const next = moveTo(state, cmd);
    if (isVisual(next)) settle(next);
    return next;
  }

  if (cmd.kind === "simple") return doSimple(state, cmd);

  if (cmd.op === "select") {
    // In visual mode i( and friends grow the selection to the object.
    const resolved = resolveTarget(state, "select", cmd.target);
    if (!resolved) return state;
    state.visualStart = { ...resolved.span.start };
    state.cursor = { ...resolved.span.end };
    if (resolved.linewise) state.mode = "vline";
    settle(state);
    return state;
  }

  if (isVisual(state)) {
    const { span, linewise } = visualSpan(state);
    leaveVisual(state);
    return applyOperator(state, cmd.op, span, linewise);
  }

  // 2d3w means six words, so a count before and after the operator multiply.
  const target: Target =
    cmd.target.kind === "object"
      ? cmd.target
      : { ...cmd.target, count: cmd.count * cmd.target.count };

  const resolved = resolveTarget(state, cmd.op, target);
  if (!resolved) return state;

  return applyOperator(state, cmd.op, resolved.span, resolved.linewise);
}

function repeatLastChange(state: EditorState): EditorState {
  const recipe = state.lastChange;
  if (!recipe) return say(state, "Nothing to repeat", "dim");

  let current = state;
  for (const char of recipe) {
    current = handleKey(current, char, true);
  }
  return current;
}

function normalKey(state: EditorState, key: string, replaying: boolean): EditorState {
  if (key === ESC) {
    state.pending = "";
    if (isVisual(state)) leaveVisual(state);
    settle(state);
    return state;
  }

  if (key.startsWith("<C-")) {
    state.pending = "";
    return ctrlKey(state, key);
  }

  let resolved = key;
  if (key === "Backspace") resolved = "h";
  else if (key === CR) resolved = "j";
  if (resolved.length !== 1) return state;

  const input = state.pending + resolved;

  // The dot command replays the last change rather than parsing as a command.
  if (input === ".") {
    state.pending = "";
    return repeatLastChange(state);
  }

  // ; and , repeat the last f, F, t or T jump.
  if (input === ";" || input === ",") {
    state.pending = "";
    const find = state.lastFind;
    if (!find) return state;
    const flip: Record<string, string> = { f: "F", F: "f", t: "T", T: "t" };
    const useKey = input === ";" ? find.key : flip[find.key];
    return moveTo(state, {
      kind: "motion",
      count: 1,
      hasCount: false,
      key: useKey,
      arg: find.char,
    });
  }

  const parsed = parseCommand(input, state.mode);

  if (parsed.status === "incomplete") {
    state.pending = input;
    return state;
  }

  state.pending = "";
  if (parsed.status === "invalid") return state;

  const cmd = parsed.cmd;

  if (!replaying && isChange(cmd)) {
    if (entersInsert(cmd)) {
      state.recording = input;
    } else {
      state.lastChange = input;
      state.recording = null;
    }
  }

  return execute(state, cmd);
}

export function handleKey(
  state: EditorState,
  key: string,
  replaying = false,
): EditorState {
  const next = copy(state);

  if (next.mode === "command") return commandKey(next, key);

  if (next.mode === "insert" || next.mode === "replace") {
    if (!replaying && next.recording !== null) {
      next.recording += key;
      if (key === ESC) {
        next.lastChange = next.recording;
        next.recording = null;
      }
    }
    return insertKey(next, key);
  }

  return normalKey(next, key, replaying);
}

export { isVisual, visualSpan };
