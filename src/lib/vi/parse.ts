import { FIND_KEYS, MOTION_KEYS } from "./motions";
import { OBJECT_TARGETS } from "./textobjects";
import type { Mode } from "./types";

export type MotionToken = { key: string; arg?: string };

export type Target =
  | { kind: "motion"; key: string; arg?: string; count: number }
  | { kind: "object"; scope: "i" | "a"; target: string; count: number }
  | { kind: "line"; count: number };

export type Cmd =
  | { kind: "motion"; count: number; hasCount: boolean; key: string; arg?: string }
  | { kind: "operator"; op: string; count: number; target: Target }
  | { kind: "simple"; key: string; count: number; hasCount: boolean; arg?: string };

export type Parsed =
  | { status: "incomplete" }
  | { status: "invalid" }
  | { status: "ok"; cmd: Cmd };

const INCOMPLETE: Parsed = { status: "incomplete" };
const INVALID: Parsed = { status: "invalid" };

const SIMPLE_KEYS = new Set([
  "x", "X", "D", "C", "Y", "s", "S", "p", "P", "J", "u", ".", "~",
  "i", "a", "I", "A", "o", "O", "v", "V", "R", ":", "/", "?",
]);

const VISUAL_SIMPLE = new Set([
  "x", "X", "D", "C", "Y", "s", "S", "p", "J", "u", "U", "~", "o",
  "v", "V", ":", "/", "?", "d", "c", "y", ">", "<",
]);

const OPERATORS = new Set(["d", "c", "y", ">", "<", "="]);
const G_OPERATORS = new Set(["gu", "gU", "g~"]);
const G_MOTIONS = new Set(["gg", "g_", "ge", "gE"]);
const G_SIMPLE = new Set(["gv", "gJ"]);

function readCount(input: string, start: number): { count: number; hasCount: boolean; next: number } {
  let i = start;
  let digits = "";
  // A leading zero is the start of line motion, never part of a count.
  while (i < input.length && /\d/.test(input[i]) && !(input[i] === "0" && digits === "")) {
    digits += input[i];
    i += 1;
  }
  return { count: digits === "" ? 1 : Number(digits), hasCount: digits !== "", next: i };
}

type Read<T> = { value: T; next: number } | "incomplete" | null;

function readMotion(input: string, start: number): Read<MotionToken> {
  const char = input[start];
  if (char === undefined) return "incomplete";

  if (char === "g") {
    const second = input[start + 1];
    if (second === undefined) return "incomplete";
    const pair = char + second;
    if (G_MOTIONS.has(pair)) return { value: { key: pair }, next: start + 2 };
    return null;
  }

  if (FIND_KEYS.has(char)) {
    const arg = input[start + 1];
    if (arg === undefined) return "incomplete";
    return { value: { key: char, arg }, next: start + 2 };
  }

  if (char === "'" || char === "`") {
    const arg = input[start + 1];
    if (arg === undefined) return "incomplete";
    return { value: { key: char, arg }, next: start + 2 };
  }

  if (MOTION_KEYS.has(char)) return { value: { key: char }, next: start + 1 };

  return null;
}

function readOperator(input: string, start: number): Read<string> {
  const char = input[start];
  if (char === undefined) return "incomplete";

  if (char === "g") {
    const second = input[start + 1];
    if (second === undefined) return "incomplete";
    const pair = char + second;
    if (G_OPERATORS.has(pair)) return { value: pair, next: start + 2 };
    return null;
  }

  if (OPERATORS.has(char)) return { value: char, next: start + 1 };
  return null;
}

function readTarget(input: string, start: number, op: string): Parsed | { target: Target } {
  const { count, next } = readCount(input, start);
  const char = input[next];
  if (char === undefined) return INCOMPLETE;

  // dd, cc, yy, >>, << and guu all mean "this many whole lines"
  const lineForm = op.length === 1 ? op : op[1];
  if (char === lineForm || (op.length === 2 && char === op[1])) {
    return { target: { kind: "line", count } };
  }

  if (char === "i" || char === "a") {
    const objectTarget = input[next + 1];
    if (objectTarget === undefined) return INCOMPLETE;
    if (!OBJECT_TARGETS.has(objectTarget)) return INVALID;
    return { target: { kind: "object", scope: char, target: objectTarget, count } };
  }

  const motion = readMotion(input, next);
  if (motion === "incomplete") return INCOMPLETE;
  if (motion === null) return INVALID;

  return {
    target: { kind: "motion", key: motion.value.key, arg: motion.value.arg, count },
  };
}

function readSimple(input: string, start: number): Read<MotionToken> {
  const char = input[start];
  if (char === undefined) return "incomplete";

  if (char === "r" || char === "m") {
    const arg = input[start + 1];
    if (arg === undefined) return "incomplete";
    return { value: { key: char, arg }, next: start + 2 };
  }

  if (char === "Z") {
    const arg = input[start + 1];
    if (arg === undefined) return "incomplete";
    if (arg !== "Z" && arg !== "Q") return null;
    return { value: { key: `Z${arg}` }, next: start + 2 };
  }

  if (char === "g") {
    const second = input[start + 1];
    if (second === undefined) return "incomplete";
    const pair = char + second;
    if (G_SIMPLE.has(pair)) return { value: { key: pair }, next: start + 2 };
    return null;
  }

  if (SIMPLE_KEYS.has(char)) return { value: { key: char }, next: start + 1 };
  return null;
}

const isVisual = (mode: Mode) =>
  mode === "visual" || mode === "vline" || mode === "vblock";

export function parseCommand(input: string, mode: Mode): Parsed {
  if (input === "") return INCOMPLETE;

  const { count, hasCount, next } = readCount(input, 0);
  if (next >= input.length) return INCOMPLETE;

  if (isVisual(mode)) {
    const char = input[next];

    if (char === "i" || char === "a") {
      const target = input[next + 1];
      if (target === undefined) return INCOMPLETE;
      if (!OBJECT_TARGETS.has(target)) return INVALID;
      return {
        status: "ok",
        cmd: {
          kind: "operator",
          op: "select",
          count,
          target: { kind: "object", scope: char, target, count },
        },
      };
    }

    if (char === "g") {
      const second = input[next + 1];
      if (second === undefined) return INCOMPLETE;
      const pair = char + second;
      if (G_MOTIONS.has(pair)) {
        return { status: "ok", cmd: { kind: "motion", count, hasCount, key: pair } };
      }
      if (G_OPERATORS.has(pair)) {
        return {
          status: "ok",
          cmd: { kind: "simple", count, hasCount, key: pair },
        };
      }
      return INVALID;
    }

    if (char === "r" || char === "m") {
      const arg = input[next + 1];
      if (arg === undefined) return INCOMPLETE;
      return { status: "ok", cmd: { kind: "simple", count, hasCount, key: char, arg } };
    }

    const motion = readMotion(input, next);
    if (motion === "incomplete") return INCOMPLETE;
    if (motion !== null) {
      return {
        status: "ok",
        cmd: { kind: "motion", count, hasCount, key: motion.value.key, arg: motion.value.arg },
      };
    }

    if (VISUAL_SIMPLE.has(char)) {
      return { status: "ok", cmd: { kind: "simple", count, hasCount, key: char } };
    }

    return INVALID;
  }

  const operator = readOperator(input, next);
  if (operator === "incomplete") return INCOMPLETE;

  if (operator !== null) {
    const result = readTarget(input, operator.next, operator.value);
    if ("status" in result) return result;
    return {
      status: "ok",
      cmd: { kind: "operator", op: operator.value, count, target: result.target },
    };
  }

  const motion = readMotion(input, next);
  if (motion === "incomplete") return INCOMPLETE;
  if (motion !== null) {
    return {
      status: "ok",
      cmd: { kind: "motion", count, hasCount, key: motion.value.key, arg: motion.value.arg },
    };
  }

  const simple = readSimple(input, next);
  if (simple === "incomplete") return INCOMPLETE;
  if (simple !== null) {
    return {
      status: "ok",
      cmd: { kind: "simple", count, hasCount, key: simple.value.key, arg: simple.value.arg },
    };
  }

  return INVALID;
}
