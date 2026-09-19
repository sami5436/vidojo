export type TokenTone =
  | "plain"
  | "keyword"
  | "type"
  | "string"
  | "number"
  | "comment"
  | "preproc"
  | "func"
  | "punct";

export type Token = { text: string; tone: TokenTone };

const KEYWORDS = new Set([
  "alignas", "alignof", "and", "asm", "auto", "break", "case", "catch",
  "class", "concept", "const", "consteval", "constexpr", "constinit",
  "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
  "default", "delete", "do", "dynamic_cast", "else", "enum", "explicit",
  "export", "extern", "false", "for", "friend", "goto", "if", "inline",
  "mutable", "namespace", "new", "noexcept", "not", "nullptr", "operator",
  "or", "override", "private", "protected", "public", "register",
  "reinterpret_cast", "requires", "return", "sizeof", "static",
  "static_assert", "static_cast", "struct", "switch", "template", "this",
  "thread_local", "throw", "true", "try", "typedef", "typeid", "typename",
  "union", "using", "virtual", "volatile", "while",
]);

const TYPES = new Set([
  "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float",
  "int", "long", "short", "signed", "unsigned", "void", "wchar_t",
  "size_t", "std", "string", "vector", "ostream", "istream", "uint8_t",
  "int32_t", "int64_t", "uint32_t", "uint64_t", "ptrdiff_t",
]);

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUMBER = /(?:0[xX][0-9a-fA-F']+|\d[\d'.]*(?:[eE][+-]?\d+)?)[uUlLfF]*/y;

function push(tokens: Token[], text: string, tone: TokenTone) {
  if (text === "") return;
  const last = tokens[tokens.length - 1];
  if (last && last.tone === tone) last.text += text;
  else tokens.push({ text, tone });
}

/**
 * A small line scoped C++ tokenizer. It is not a parser, it just has to make
 * the file read the way it would in a real terminal.
 */
function highlightCpp(line: string, inBlockComment: boolean): {
  tokens: Token[];
  inBlockComment: boolean;
} {
  const tokens: Token[] = [];
  let i = 0;
  let block = inBlockComment;

  if (block) {
    const close = line.indexOf("*/");
    if (close === -1) return { tokens: [{ text: line, tone: "comment" }], inBlockComment: true };
    push(tokens, line.slice(0, close + 2), "comment");
    i = close + 2;
    block = false;
  }

  const trimmed = line.slice(i).trimStart();
  if (trimmed.startsWith("#")) {
    const hashAt = line.indexOf("#", i);
    push(tokens, line.slice(i, hashAt), "plain");
    const rest = line.slice(hashAt);
    const angle = rest.indexOf("<");
    const quote = rest.indexOf('"');
    const cut = angle >= 0 ? angle : quote;
    if (cut > 0) {
      push(tokens, rest.slice(0, cut), "preproc");
      push(tokens, rest.slice(cut), "string");
    } else {
      push(tokens, rest, "preproc");
    }
    return { tokens, inBlockComment: false };
  }

  while (i < line.length) {
    const char = line[i];

    if (char === "/" && line[i + 1] === "/") {
      push(tokens, line.slice(i), "comment");
      break;
    }

    if (char === "/" && line[i + 1] === "*") {
      const close = line.indexOf("*/", i + 2);
      if (close === -1) {
        push(tokens, line.slice(i), "comment");
        block = true;
        break;
      }
      push(tokens, line.slice(i, close + 2), "comment");
      i = close + 2;
      continue;
    }

    if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < line.length && (line[j] !== char || line[j - 1] === "\\")) j += 1;
      push(tokens, line.slice(i, Math.min(j + 1, line.length)), "string");
      i = j + 1;
      continue;
    }

    NUMBER.lastIndex = i;
    const number = NUMBER.exec(line);
    if (number && number.index === i && !/[A-Za-z_]/.test(line[i - 1] ?? "")) {
      push(tokens, number[0], "number");
      i += number[0].length;
      continue;
    }

    IDENT.lastIndex = i;
    const ident = IDENT.exec(line);
    if (ident && ident.index === i) {
      const word = ident[0];
      let after = i + word.length;
      while (line[after] === " ") after += 1;
      const tone: TokenTone = KEYWORDS.has(word)
        ? "keyword"
        : TYPES.has(word)
          ? "type"
          : line[after] === "(" && !KEYWORDS.has(word)
            ? "func"
            : /^[A-Z]/.test(word)
              ? "type"
              : "plain";
      push(tokens, word, tone);
      i += word.length;
      continue;
    }

    if (/[{}()[\];,.<>:=+\-*/%&|!?~^]/.test(char)) {
      push(tokens, char, "punct");
      i += 1;
      continue;
    }

    push(tokens, char, "plain");
    i += 1;
  }

  return { tokens, inBlockComment: block };
}

function highlightMarkdown(line: string): Token[] {
  if (/^#{1,6}\s/.test(line)) return [{ text: line, tone: "keyword" }];
  if (/^\s{4,}/.test(line)) return [{ text: line, tone: "string" }];
  if (/^\s*[-*]\s/.test(line) || /^\s*\[[ x]\]/.test(line)) {
    const cut = line.search(/\S/) + (line.trim().startsWith("[") ? 3 : 1);
    return [
      { text: line.slice(0, cut), tone: "punct" },
      { text: line.slice(cut), tone: "plain" },
    ];
  }
  return [{ text: line, tone: "plain" }];
}

function highlightConfig(line: string): Token[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#") || trimmed.startsWith('"')) {
    return [{ text: line, tone: "comment" }];
  }
  const tokens: Token[] = [];
  const match = line.match(/^([A-Za-z_][\w.]*)(\s*[:+?]?=\s*)(.*)$/);
  if (match) {
    push(tokens, match[1], "type");
    push(tokens, match[2], "punct");
    push(tokens, match[3], "string");
    return tokens;
  }
  const words = line.split(/(\s+)/);
  for (const word of words) {
    push(tokens, word, /^(set|syntax|filetype|export|alias)$/.test(word) ? "keyword" : "plain");
  }
  return tokens;
}

export type Language = "cpp" | "markdown" | "config" | "plain";

export function languageFor(name: string): Language {
  if (/\.(cpp|cc|cxx|h|hpp|hh)$/.test(name)) return "cpp";
  if (/\.(md|markdown)$/.test(name)) return "markdown";
  if (name === "Makefile" || /^\.(vimrc|bashrc|profile)$/.test(name)) return "config";
  return "plain";
}

/** Tokenize a whole file at once so block comments carry across lines. */
export function highlightLines(lines: string[], language: Language): Token[][] {
  if (language === "plain") {
    return lines.map((line) => [{ text: line, tone: "plain" as const }]);
  }
  if (language === "markdown") return lines.map(highlightMarkdown);
  if (language === "config") return lines.map(highlightConfig);

  let block = false;
  return lines.map((line) => {
    const result = highlightCpp(line, block);
    block = result.inBlockComment;
    return result.tokens;
  });
}

export const TONE_CLASS: Record<TokenTone, string> = {
  plain: "text-[var(--fg)]",
  keyword: "text-[var(--kw)]",
  type: "text-[var(--type)]",
  string: "text-[var(--str)]",
  number: "text-[var(--num)]",
  comment: "text-[var(--com)] italic",
  preproc: "text-[var(--pre)]",
  func: "text-[var(--fn)]",
  punct: "text-[var(--fg-dim)]",
};
