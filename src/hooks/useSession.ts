"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { mkdir, writeFile } from "@/lib/fs/ops";
import { basename, dirname, lookup } from "@/lib/fs/path";
import { buildRoot } from "@/lib/fs/tree";
import { HOME, fileSize, isFile, type DirNode } from "@/lib/fs/types";
import { complete } from "@/lib/shell/complete";
import { promptFor, runCommand } from "@/lib/shell/commands";
import { line, type OutLine, type Span } from "@/lib/shell/types";
import { CR, ESC, handleKey } from "@/lib/vi/engine";
import { createEditor, type EditorState } from "@/lib/vi/types";
import type { Probe } from "@/lib/lessons/types";

export type Screen = "shell" | "editor";

const MAX_SCROLLBACK = 1200;
const SCROLL_OFF = 3;

/** Keep the cursor inside the window, with a few lines of breathing room. */
function clampTop(top: number, cursorLine: number, rows: number, total: number): number {
  const maxTop = Math.max(0, total - rows);
  let next = top;
  if (cursorLine < next + SCROLL_OFF) next = cursorLine - SCROLL_OFF;
  if (cursorLine > next + rows - 1 - SCROLL_OFF) next = cursorLine - rows + 1 + SCROLL_OFF;
  return Math.max(0, Math.min(next, maxTop));
}

const BANNER: OutLine[] = [
  line("vidojo 1.0, a simulated Linux box", "accent"),
  line("Nothing here touches your real machine.", "faint"),
  [],
  [
    { text: "Type ", tone: "dim" },
    { text: "help", tone: "accent" },
    { text: " for commands, or ", tone: "dim" },
    { text: "vi notes.txt", tone: "accent" },
    { text: " to start editing.", tone: "dim" },
  ],
  [],
];

export type Session = ReturnType<typeof useSession>;

export function useSession(onProbe?: (probe: Probe) => void) {
  const rootRef = useRef<DirNode>(buildRoot());
  const historyRef = useRef<string[]>([]);

  const [cwd, setCwd] = useState(HOME);
  const [scrollback, setScrollback] = useState<OutLine[]>(BANNER);
  const [input, setInput] = useState("");
  const [inputCol, setInputCol] = useState(0);
  const [historyAt, setHistoryAt] = useState(-1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [revision, setRevision] = useState(0);

  const screen: Screen = editor ? "editor" : "shell";

  // Lesson checks run against a snapshot taken right after every action.
  const report = useCallback(
    (at: {
      screen: Screen;
      editor: EditorState | null;
      cwd: string;
      command: string | null;
      key?: string;
    }) => {
      if (!onProbe) return;
      const editorState = at.editor;
      const onDisk = editorState ? lookup(rootRef.current, editorState.path) : null;

      onProbe({
        screen: at.screen,
        cwd: at.cwd,
        path: editorState?.path ?? null,
        name: editorState?.name ?? null,
        lines: editorState ? editorState.lines : [],
        cursor: editorState ? editorState.cursor : { line: 0, col: 0 },
        mode: editorState ? editorState.mode : null,
        dirty: editorState ? editorState.dirty : false,
        saved: onDisk && isFile(onDisk) ? onDisk.lines : [],
        search: editorState?.lastSearch?.pattern ?? null,
        keys: at.key ? [at.key] : [],
        commands: at.command ? [at.command] : [],
      });
    },
    [onProbe],
  );

  const append = useCallback((out: OutLine[]) => {
    if (out.length === 0) return;
    setScrollback((current) => {
      const next = [...current, ...out];
      return next.length > MAX_SCROLLBACK ? next.slice(-MAX_SCROLLBACK) : next;
    });
  }, []);

  const openEditor = useCallback(
    (path: string) => {
      const node = lookup(rootRef.current, path);
      const name = basename(path);
      const isNew = !node;
      const lines = node && isFile(node) ? [...node.lines] : [""];
      const next = createEditor(path, name, lines);

      next.message = isNew
        ? { text: `"${name}" [New File]`, tone: "dim" }
        : {
            text: `"${name}" ${lines.length}L, ${node && isFile(node) ? fileSize(node) : 0}B`,
            tone: "dim",
          };

      setEditor(next);
      report({ screen: "editor", editor: next, cwd, command: null });
    },
    [cwd, report],
  );

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const prompt: OutLine = [...promptFor(cwd), { text: raw, tone: "fg" }];

      if (text === "") {
        append([prompt]);
        setInput("");
        setInputCol(0);
        return;
      }

      historyRef.current = [...historyRef.current, text];
      setHistoryAt(-1);

      const result = runCommand(text, {
        root: rootRef.current,
        cwd,
        history: historyRef.current,
      });

      if (result.clear) {
        setScrollback([]);
      } else {
        append([prompt, ...result.out]);
      }

      if (result.cwd) setCwd(result.cwd);
      setInput("");
      setInputCol(0);
      setRevision((n) => n + 1);

      if (result.openEditor) {
        openEditor(result.openEditor);
      } else {
        report({
          screen: "shell",
          editor: null,
          cwd: result.cwd ?? cwd,
          command: text,
        });
      }
    },
    [append, cwd, openEditor, report],
  );

  const shellKey = useCallback(
    (key: string) => {
      if (key === "Enter") {
        submit(input);
        return;
      }

      if (key === "Tab") {
        const filled = complete(input, rootRef.current, cwd);
        if (filled.candidates.length > 1 && filled.line === input) {
          const spans: Span[] = filled.candidates.map((name) => ({
            text: `${name}  `,
            tone: name.endsWith("/") ? "dir" : "fg",
          }));
          append([[...promptFor(cwd), { text: input, tone: "fg" }], spans]);
        }
        setInput(filled.line);
        setInputCol(filled.line.length);
        return;
      }

      if (key === "ArrowUp" || key === "ArrowDown") {
        const history = historyRef.current;
        if (history.length === 0) return;
        const next =
          key === "ArrowUp"
            ? Math.min(history.length - 1, historyAt + 1)
            : historyAt - 1;
        setHistoryAt(next);
        const value = next < 0 ? "" : history[history.length - 1 - next];
        setInput(value);
        setInputCol(value.length);
        return;
      }

      if (key === "ArrowLeft") {
        setInputCol((c) => Math.max(0, c - 1));
        return;
      }
      if (key === "ArrowRight") {
        setInputCol((c) => Math.min(input.length, c + 1));
        return;
      }
      if (key === "Home" || key === "<C-a>") {
        setInputCol(0);
        return;
      }
      if (key === "End" || key === "<C-e>") {
        setInputCol(input.length);
        return;
      }

      if (key === "Backspace") {
        if (inputCol === 0) return;
        setInput(input.slice(0, inputCol - 1) + input.slice(inputCol));
        setInputCol(inputCol - 1);
        return;
      }
      if (key === "Delete") {
        setInput(input.slice(0, inputCol) + input.slice(inputCol + 1));
        return;
      }

      if (key === "<C-u>") {
        setInput(input.slice(inputCol));
        setInputCol(0);
        return;
      }
      if (key === "<C-k>") {
        setInput(input.slice(0, inputCol));
        return;
      }
      if (key === "<C-w>") {
        const head = input.slice(0, inputCol).replace(/\S+\s*$/, "");
        setInput(head + input.slice(inputCol));
        setInputCol(head.length);
        return;
      }
      if (key === "<C-l>") {
        setScrollback([]);
        return;
      }
      if (key === "<C-c>") {
        append([[...promptFor(cwd), { text: input, tone: "fg" }, { text: "^C", tone: "err" }]]);
        setInput("");
        setInputCol(0);
        return;
      }

      if (key === "Escape") return;

      if (key.length === 1) {
        setInput(input.slice(0, inputCol) + key + input.slice(inputCol));
        setInputCol(inputCol + 1);
      }
    },
    [append, cwd, historyAt, input, inputCol, submit],
  );

  const editorKey = useCallback(
    (key: string) => {
      if (!editor) return;

      const token = key === "Enter" ? CR : key === "Escape" ? ESC : key;
      const next = handleKey(editor, token);

      if (next.pendingWrite) {
        const path = next.pendingWrite.path;
        writeFile(rootRef.current, path, next.lines);
        setRevision((n) => n + 1);
        next.dirty = false;
        next.message = {
          text: `"${basename(path)}" ${next.lines.length}L, ${next.lines.reduce((sum, l) => sum + l.length + 1, 0)}B written`,
          tone: "dim",
        };
        next.pendingWrite = null;
      }

      next.topLine = clampTop(next.topLine, next.cursor.line, next.rows, next.lines.length);

      if (next.exit) {
        setEditor(null);
        report({ screen: "shell", editor: null, cwd, command: null, key });
        return;
      }

      setEditor(next);
      report({ screen: "editor", editor: next, cwd, command: null, key });
    },
    [cwd, editor, report],
  );

  const sendKey = useCallback(
    (key: string) => {
      if (screen === "editor") {
        editorKey(key);
        return;
      }
      shellKey(key);
      if (key !== "Enter") {
        report({ screen: "shell", editor: null, cwd, command: null, key });
      }
    },
    [cwd, editorKey, report, screen, shellKey],
  );

  /** Drop a file into the box and open it, which is how a lesson starts. */
  const loadFile = useCallback(
    (path: string, lines: string[]) => {
      mkdir(rootRef.current, dirname(path), true);
      writeFile(rootRef.current, path, lines);
      setRevision((n) => n + 1);
      openEditor(path);
    },
    [openEditor],
  );

  const reset = useCallback(() => {
    rootRef.current = buildRoot();
    historyRef.current = [];
    setCwd(HOME);
    setScrollback(BANNER);
    setInput("");
    setInputCol(0);
    setHistoryAt(-1);
    setEditor(null);
    setRevision((n) => n + 1);
  }, []);

  const setRows = useCallback((rows: number) => {
    setEditor((current) => {
      if (!current || current.rows === rows) return current;
      return {
        ...current,
        rows,
        topLine: clampTop(current.topLine, current.cursor.line, rows, current.lines.length),
      };
    });
  }, []);

  return useMemo(
    () => ({
      getRoot: () => rootRef.current,
      revision,
      screen,
      cwd,
      scrollback,
      input,
      inputCol,
      editor,
      sendKey,
      submit,
      openEditor,
      loadFile,
      reset,
      setRows,
    }),
    [cwd, editor, input, inputCol, loadFile, openEditor, reset, revision, screen, scrollback, sendKey, setRows, submit],
  );
}
