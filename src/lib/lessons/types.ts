import type { Mode, Pos } from "@/lib/vi/types";

/** A read only snapshot of the session, handed to every checkpoint test. */
export type Probe = {
  screen: "shell" | "editor";
  cwd: string;
  path: string | null;
  name: string | null;
  lines: string[];
  cursor: Pos;
  mode: Mode | null;
  dirty: boolean;
  /** the file as it currently sits on disk, which is what :w updates */
  saved: string[];
  /** the pattern of the last successful search, when there was one */
  search: string | null;
  /** keys sent since this checkpoint became current */
  keys: string[];
  /** shell commands run since this checkpoint became current */
  commands: string[];
};

export type Checkpoint = {
  /** what the learner is asked to do, kept to one short line */
  goal: string;
  /** the keys involved, shown as a chip row */
  keys: string[];
  /** extra nudge, revealed on demand */
  hint: string;
  done: (probe: Probe) => boolean;
};

export type Lesson = {
  id: string;
  title: string;
  /** one or two sentences on why this exists */
  blurb: string;
  /** the file this lesson practises on, written fresh when the lesson starts */
  file?: { path: string; lines: string[] };
  /** true when the lesson happens at the shell rather than in the editor */
  shell?: boolean;
  checkpoints: Checkpoint[];
};

export function wordAt(probe: Probe): string {
  const line = probe.lines[probe.cursor.line] ?? "";
  const left = line.slice(0, probe.cursor.col).match(/[A-Za-z0-9_]*$/)?.[0] ?? "";
  const right = line.slice(probe.cursor.col).match(/^[A-Za-z0-9_]*/)?.[0] ?? "";
  return left + right;
}

export function text(probe: Probe): string {
  return probe.lines.join("\n");
}

export function savedText(probe: Probe): string {
  return probe.saved.join("\n");
}
