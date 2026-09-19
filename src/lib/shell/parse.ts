export type ParsedCommand = {
  name: string;
  args: string[];
  flags: Set<string>;
  /** every token after the command name, flags included, for find and friends */
  tokens: string[];
  /** everything after the command name, untouched, for echo and friends */
  rest: string;
};

/** Split a command line on whitespace while respecting single and double quotes. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }

    if (char === " " || char === "\t") {
      if (started || current.length > 0) {
        tokens.push(current);
        current = "";
        started = false;
      }
      continue;
    }

    current += char;
  }

  if (started || current.length > 0) tokens.push(current);
  return tokens;
}

export function parse(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const tokens = tokenize(trimmed);
  const [name, ...raw] = tokens;

  const flags = new Set<string>();
  const args: string[] = [];

  for (const token of raw) {
    if (token.startsWith("--") && token.length > 2) {
      flags.add(token.slice(2));
    } else if (token.startsWith("-") && token.length > 1 && token !== "-") {
      for (const letter of token.slice(1)) flags.add(letter);
    } else {
      args.push(token);
    }
  }

  const restStart = trimmed.indexOf(name) + name.length;
  return { name, args, flags, tokens: raw, rest: trimmed.slice(restStart).trim() };
}
