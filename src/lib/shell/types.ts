import type { DirNode } from "@/lib/fs/types";

export type Tone =
  | "fg"
  | "dim"
  | "faint"
  | "err"
  | "warn"
  | "info"
  | "dir"
  | "exec"
  | "accent";

export type Span = { text: string; tone?: Tone };

export type OutLine = Span[];

export type ShellEnv = {
  root: DirNode;
  cwd: string;
  history: string[];
};

export type CommandResult = {
  out: OutLine[];
  /** a new working directory, when the command changed it */
  cwd?: string;
  /** wipe the scrollback */
  clear?: boolean;
  /** hand control to the editor on this absolute path */
  openEditor?: string;
  /** the command asked to leave the session */
  exit?: boolean;
};

export const EMPTY: CommandResult = { out: [] };

export function line(text: string, tone: Tone = "fg"): OutLine {
  return [{ text, tone }];
}

export function lines(text: string, tone: Tone = "fg"): OutLine[] {
  return text.split("\n").map((entry) => line(entry, tone));
}

export function errorOut(command: string, message: string): CommandResult {
  return { out: [line(`${command}: ${message}`, "err")] };
}
