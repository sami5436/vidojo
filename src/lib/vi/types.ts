export type Mode =
  | "normal"
  | "insert"
  | "replace"
  | "visual"
  | "vline"
  | "vblock"
  | "command";

export type Pos = { line: number; col: number };

export type Register = {
  lines: string[];
  /** a linewise yank pastes below the cursor, a charwise one pastes after it */
  linewise: boolean;
  blockwise?: boolean;
};

export type Snapshot = {
  lines: string[];
  cursor: Pos;
};

export type Message = {
  text: string;
  tone: "fg" | "dim" | "err" | "warn" | "accent";
};

export type Search = {
  pattern: string;
  forward: boolean;
};

export type EditorState = {
  path: string;
  /** the name shown in the status line, usually the basename */
  name: string;
  lines: string[];
  cursor: Pos;
  /** remembered column so j and k keep their place across short lines */
  desiredCol: number;
  mode: Mode;

  /** keys typed so far that have not resolved into a command, such as "2d" */
  pending: string;
  visualStart: Pos | null;

  /** the : / or ? line being typed */
  cmdline: string;
  cmdPrefix: ":" | "/" | "?" | null;
  cmdHistory: string[];

  register: Register;
  marks: Record<string, Pos>;
  lastSearch: Search | null;
  /** the f, F, t or T jump that ; and , repeat */
  lastFind: { key: string; char: string } | null;

  undo: Snapshot[];
  redo: Snapshot[];

  /** the key sequence that made up the last change, replayed by the dot command */
  lastChange: string | null;
  recording: string | null;

  message: Message | null;
  dirty: boolean;
  topLine: number;
  /** how many text rows the viewport shows, kept in sync by the view */
  rows: number;

  options: {
    number: boolean;
    relativenumber: boolean;
    hlsearch: boolean;
    ignorecase: boolean;
    list: boolean;
  };

  /** set when the editor wants to hand control back to the shell */
  exit: null | { written: boolean };
  /** set when a write should be flushed to the filesystem */
  pendingWrite: null | { path: string };
};

export const TAB_WIDTH = 2;

export function clampCol(line: string, col: number, mode: Mode): number {
  // Normal mode parks on the last character, insert mode sits one past it.
  const max =
    mode === "insert" || mode === "replace" || mode === "visual" || mode === "vblock"
      ? line.length
      : Math.max(0, line.length - 1);
  return Math.max(0, Math.min(col, max));
}

export function createEditor(
  path: string,
  name: string,
  lines: string[],
  options?: Partial<EditorState["options"]>,
): EditorState {
  return {
    path,
    name,
    lines: lines.length > 0 ? [...lines] : [""],
    cursor: { line: 0, col: 0 },
    desiredCol: 0,
    mode: "normal",
    pending: "",
    visualStart: null,
    cmdline: "",
    cmdPrefix: null,
    cmdHistory: [],
    register: { lines: [], linewise: false },
    marks: {},
    lastSearch: null,
    lastFind: null,
    undo: [],
    redo: [],
    lastChange: null,
    recording: null,
    message: null,
    dirty: false,
    topLine: 0,
    rows: 20,
    options: {
      number: true,
      relativenumber: false,
      hlsearch: true,
      ignorecase: true,
      list: false,
      ...options,
    },
    exit: null,
    pendingWrite: null,
  };
}

export function snapshot(state: EditorState): Snapshot {
  return { lines: [...state.lines], cursor: { ...state.cursor } };
}

export function comparePos(a: Pos, b: Pos): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
}

export function orderPos(a: Pos, b: Pos): [Pos, Pos] {
  return comparePos(a, b) <= 0 ? [a, b] : [b, a];
}
