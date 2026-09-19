import { searchFrom } from "./motions";
import { clampCol, type EditorState, type Message } from "./types";

function say(state: EditorState, text: string, tone: Message["tone"] = "fg") {
  state.message = { text, tone };
  return state;
}

function setOption(state: EditorState, raw: string): EditorState {
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return say(state, "E518: Unknown option", "err");
  }

  for (const part of parts) {
    const off = part.startsWith("no");
    const name = off ? part.slice(2) : part;

    switch (name) {
      case "nu":
      case "number":
        state.options.number = !off;
        break;
      case "rnu":
      case "relativenumber":
        state.options.relativenumber = !off;
        break;
      case "hls":
      case "hlsearch":
        state.options.hlsearch = !off;
        break;
      case "ic":
      case "ignorecase":
        state.options.ignorecase = !off;
        break;
      case "list":
        state.options.list = !off;
        break;
      default:
        return say(state, `E518: Unknown option: ${part}`, "err");
    }
  }

  return state;
}

function substitute(state: EditorState, raw: string): EditorState {
  // Supports :s/from/to/ and :%s/from/to/g, which is as far as this dojo goes.
  const wholeFile = raw.startsWith("%");
  const body = wholeFile ? raw.slice(1) : raw;
  const match = body.match(/^s(.)(.*)$/);
  if (!match) return say(state, "E486: Pattern not found", "err");

  const sep = match[1];
  const parts = match[2].split(sep);
  const pattern = parts[0] ?? "";
  const replacement = parts[1] ?? "";
  const flags = parts[2] ?? "";

  if (!pattern) return say(state, "E35: No previous regular expression", "err");

  let regex: RegExp;
  try {
    regex = new RegExp(
      pattern,
      `${flags.includes("g") ? "g" : ""}${flags.includes("i") ? "i" : ""}`,
    );
  } catch {
    return say(state, `E486: Bad pattern: ${pattern}`, "err");
  }

  const from = wholeFile ? 0 : state.cursor.line;
  const to = wholeFile ? state.lines.length - 1 : state.cursor.line;
  const next = [...state.lines];
  let changedLines = 0;
  let changes = 0;

  for (let l = from; l <= to; l += 1) {
    const before = next[l];
    const after = before.replace(regex, replacement);
    if (after !== before) {
      changedLines += 1;
      changes += flags.includes("g") ? (before.match(regex)?.length ?? 1) : 1;
      next[l] = after;
    }
  }

  if (changedLines === 0) {
    return say(state, `E486: Pattern not found: ${pattern}`, "err");
  }

  state.undo.push({ lines: state.lines, cursor: { ...state.cursor } });
  state.redo = [];
  state.lines = next;
  state.dirty = true;
  state.cursor = {
    line: Math.min(state.cursor.line, next.length - 1),
    col: 0,
  };
  return say(state, `${changes} substitutions on ${changedLines} lines`, "dim");
}

export function runEx(state: EditorState, input: string): EditorState {
  const raw = input.trim();
  if (raw === "") return state;

  if (/^\d+$/.test(raw)) {
    const line = Math.min(state.lines.length - 1, Math.max(0, Number(raw) - 1));
    state.cursor = { line, col: 0 };
    return state;
  }

  if (raw === "$") {
    state.cursor = { line: state.lines.length - 1, col: 0 };
    return state;
  }

  if (raw.startsWith("s") || raw.startsWith("%s")) {
    return substitute(state, raw);
  }

  const [head, ...rest] = raw.split(/\s+/);
  const argument = rest.join(" ");
  const bang = head.endsWith("!");
  const name = bang ? head.slice(0, -1) : head;

  switch (name) {
    case "w":
    case "write":
      state.pendingWrite = { path: argument || state.path };
      return state;

    case "q":
    case "quit":
      if (state.dirty && !bang) {
        return say(
          state,
          "E37: No write since last change. Add ! to override, or use :wq",
          "err",
        );
      }
      state.exit = { written: false };
      return state;

    case "wq":
    case "x":
    case "xit":
      state.pendingWrite = { path: argument || state.path };
      state.exit = { written: true };
      return state;

    case "qa":
    case "qall":
      state.exit = { written: false };
      return state;

    case "set":
    case "se":
      return setOption(state, argument);

    case "noh":
    case "nohl":
    case "nohlsearch":
      state.lastSearch = state.lastSearch
        ? { ...state.lastSearch, pattern: state.lastSearch.pattern }
        : null;
      state.options.hlsearch = false;
      return state;

    case "e":
    case "edit":
      if (state.dirty && !bang) {
        return say(state, "E37: No write since last change", "err");
      }
      return say(state, "Reload is not wired up in this dojo yet", "dim");

    case "help":
      return say(state, "Press ? in normal mode for the key sheet", "accent");

    default:
      return say(state, `E492: Not an editor command: ${name}`, "err");
  }
}

export function runSearch(state: EditorState, pattern: string, forward: boolean): EditorState {
  if (pattern === "" && state.lastSearch) {
    pattern = state.lastSearch.pattern;
  }
  if (pattern === "") return state;

  state.lastSearch = { pattern, forward };
  state.options.hlsearch = true;

  const hit = searchFrom(
    state.lines,
    state.cursor,
    pattern,
    forward,
    state.options.ignorecase,
  );

  if (!hit) {
    return say(state, `E486: Pattern not found: ${pattern}`, "err");
  }

  state.cursor = hit;
  state.cursor.col = clampCol(state.lines[hit.line], hit.col, state.mode);
  return state;
}
