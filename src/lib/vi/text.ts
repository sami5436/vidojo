export type CharClass = "blank" | "word" | "punct";

const WORD = /[A-Za-z0-9_]/;

export function classify(char: string | undefined): CharClass {
  if (char === undefined || char === "" || /\s/.test(char)) return "blank";
  return WORD.test(char) ? "word" : "punct";
}

/** Big word motions only care about blank versus not blank. */
export function classifyBig(char: string | undefined): CharClass {
  if (char === undefined || char === "" || /\s/.test(char)) return "blank";
  return "word";
}

export function firstNonBlank(line: string): number {
  const index = line.search(/\S/);
  return index === -1 ? 0 : index;
}

export function lastNonBlank(line: string): number {
  const trimmed = line.replace(/\s+$/, "");
  return Math.max(0, trimmed.length - 1);
}

export function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

export const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

export const CLOSERS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};
