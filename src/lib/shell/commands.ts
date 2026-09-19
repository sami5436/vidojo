import { copy, listDir, mkdir, move, remove, touch } from "@/lib/fs/ops";
import { basename, dirname, lookup, lookupDir, resolve, tilde } from "@/lib/fs/path";
import {
  HOME,
  HOST,
  USER,
  fileSize,
  isDir,
  isFile,
  type DirNode,
  type FsNode,
} from "@/lib/fs/types";
import { parse, type ParsedCommand } from "./parse";
import {
  EMPTY,
  errorOut,
  line,
  lines,
  type CommandResult,
  type OutLine,
  type ShellEnv,
  type Span,
} from "./types";

type Handler = (cmd: ParsedCommand, env: ShellEnv) => CommandResult;

function nameSpan(node: FsNode): Span {
  if (isDir(node)) return { text: node.name, tone: "dir" };
  if (node.executable) return { text: node.name, tone: "exec" };
  return { text: node.name, tone: "fg" };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

const ls: Handler = (cmd, env) => {
  const targets = cmd.args.length > 0 ? cmd.args : ["."];
  const showHidden = cmd.flags.has("a") || cmd.flags.has("all");
  const long = cmd.flags.has("l");
  const out: OutLine[] = [];

  targets.forEach((target, index) => {
    const path = resolve(env.cwd, target);
    const node = lookup(env.root, path);

    if (!node) {
      out.push(line(`ls: ${target}: No such file or directory`, "err"));
      return;
    }

    if (isFile(node)) {
      out.push([nameSpan(node)]);
      return;
    }

    if (targets.length > 1) {
      if (index > 0) out.push([]);
      out.push(line(`${target}:`, "dim"));
    }

    const entries = listDir(node, showHidden);

    if (long) {
      out.push(line(`total ${entries.length * 4}`, "dim"));
      const sizeWidth = Math.max(
        4,
        ...entries.map((entry) =>
          String(isFile(entry) ? fileSize(entry) : 4096).length,
        ),
      );
      for (const entry of entries) {
        const size = isFile(entry) ? fileSize(entry) : 4096;
        out.push([
          { text: `${entry.mode} `, tone: "faint" },
          { text: `${pad(USER, 6)} ${pad(USER, 6)} `, tone: "faint" },
          { text: `${padStart(String(size), sizeWidth)} `, tone: "dim" },
          { text: `${entry.mtime} `, tone: "dim" },
          nameSpan(entry),
        ]);
      }
      return;
    }

    if (entries.length === 0) return;

    // Lay the names out in columns the way a real ls does.
    const width = Math.max(...entries.map((entry) => entry.name.length)) + 2;
    const perRow = Math.max(1, Math.floor(76 / width));
    for (let i = 0; i < entries.length; i += perRow) {
      const row = entries.slice(i, i + perRow);
      const spans: Span[] = [];
      row.forEach((entry, column) => {
        const span = nameSpan(entry);
        const isLast = column === row.length - 1;
        spans.push({
          ...span,
          text: isLast ? span.text : pad(span.text, width),
        });
      });
      out.push(spans);
    }
  });

  return { out };
};

const cd: Handler = (cmd, env) => {
  const target = cmd.args[0] ?? "~";
  if (target === "-") {
    return { out: [line("cd: OLDPWD not set", "err")] };
  }

  const path = resolve(env.cwd, target);
  const node = lookup(env.root, path);

  if (!node) return errorOut("cd", `${target}: No such file or directory`);
  if (!isDir(node)) return errorOut("cd", `${target}: Not a directory`);

  return { out: [], cwd: path };
};

const pwd: Handler = (_cmd, env) => ({ out: [line(env.cwd)] });

const cat: Handler = (cmd, env) => {
  if (cmd.args.length === 0) {
    return errorOut("cat", "missing file operand");
  }

  const numbered = cmd.flags.has("n");
  const out: OutLine[] = [];
  let counter = 1;

  for (const target of cmd.args) {
    const node = lookup(env.root, resolve(env.cwd, target));
    if (!node) {
      out.push(line(`cat: ${target}: No such file or directory`, "err"));
      continue;
    }
    if (isDir(node)) {
      out.push(line(`cat: ${target}: Is a directory`, "err"));
      continue;
    }
    for (const text of node.lines) {
      if (numbered) {
        out.push([
          { text: `${padStart(String(counter), 6)}  `, tone: "faint" },
          { text, tone: "fg" },
        ]);
        counter += 1;
      } else {
        out.push(line(text));
      }
    }
  }

  return { out };
};

const head: Handler = (cmd, env) => {
  const count = Number(cmd.args.find((arg) => /^\d+$/.test(arg)) ?? 10);
  const target = cmd.args.find((arg) => !/^\d+$/.test(arg));
  if (!target) return errorOut("head", "missing file operand");

  const node = lookup(env.root, resolve(env.cwd, target));
  if (!node || isDir(node)) {
    return errorOut("head", `${target}: No such file or directory`);
  }
  return { out: node.lines.slice(0, count).map((text) => line(text)) };
};

const tail: Handler = (cmd, env) => {
  const count = Number(cmd.args.find((arg) => /^\d+$/.test(arg)) ?? 10);
  const target = cmd.args.find((arg) => !/^\d+$/.test(arg));
  if (!target) return errorOut("tail", "missing file operand");

  const node = lookup(env.root, resolve(env.cwd, target));
  if (!node || isDir(node)) {
    return errorOut("tail", `${target}: No such file or directory`);
  }
  return { out: node.lines.slice(-count).map((text) => line(text)) };
};

const wc: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("wc", "missing file operand");
  const out: OutLine[] = [];

  for (const target of cmd.args) {
    const node = lookup(env.root, resolve(env.cwd, target));
    if (!node || isDir(node)) {
      out.push(line(`wc: ${target}: No such file or directory`, "err"));
      continue;
    }
    const words = node.lines.join(" ").split(/\s+/).filter(Boolean).length;
    out.push(
      line(
        `${padStart(String(node.lines.length), 7)}${padStart(String(words), 8)}${padStart(String(fileSize(node)), 8)} ${target}`,
      ),
    );
  }

  return { out };
};

const grep: Handler = (cmd, env) => {
  const [pattern, ...targets] = cmd.args;
  if (!pattern) return errorOut("grep", "missing pattern");

  const ignoreCase = cmd.flags.has("i");
  const recursive = cmd.flags.has("r") || cmd.flags.has("R");
  const withNumbers = cmd.flags.has("n");

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, ignoreCase ? "i" : "");
  } catch {
    return errorOut("grep", `invalid pattern: ${pattern}`);
  }

  const out: OutLine[] = [];

  const searchFile = (path: string, label: string, showLabel: boolean) => {
    const node = lookup(env.root, path);
    if (!node || isDir(node)) return;
    node.lines.forEach((text, index) => {
      if (!regex.test(text)) return;
      const spans: Span[] = [];
      if (showLabel) spans.push({ text: `${label}:`, tone: "info" });
      if (withNumbers) {
        spans.push({ text: `${index + 1}:`, tone: "warn" });
      }
      spans.push({ text, tone: "fg" });
      out.push(spans);
    });
  };

  const walk = (path: string, label: string) => {
    const node = lookup(env.root, path);
    if (!node) {
      out.push(line(`grep: ${label}: No such file or directory`, "err"));
      return;
    }
    if (isFile(node)) {
      searchFile(path, label, recursive || targets.length > 1);
      return;
    }
    if (!recursive) {
      out.push(line(`grep: ${label}: Is a directory`, "err"));
      return;
    }
    for (const child of listDir(node, false)) {
      walk(`${path}/${child.name}`, `${label}/${child.name}`);
    }
  };

  const roots = targets.length > 0 ? targets : ["."];
  for (const target of roots) walk(resolve(env.cwd, target), target);

  return { out };
};

const find: Handler = (cmd, env) => {
  // -name is a predicate, not a flag, so find reads the raw token list.
  const nameIndex = cmd.tokens.indexOf("-name");
  const pattern = nameIndex >= 0 ? (cmd.tokens[nameIndex + 1] ?? null) : null;
  const start = cmd.tokens.find((token) => !token.startsWith("-")) === pattern
    ? "."
    : (cmd.tokens.find((token) => !token.startsWith("-")) ?? ".");
  const matcher = pattern
    ? new RegExp(`^${pattern.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`)
    : null;

  const out: OutLine[] = [];

  const walk = (path: string, label: string, node: FsNode) => {
    if (!matcher || matcher.test(basename(label))) {
      out.push([{ text: label, tone: isDir(node) ? "dir" : "fg" }]);
    }
    if (isDir(node)) {
      for (const child of listDir(node, false)) {
        walk(`${path}/${child.name}`, `${label}/${child.name}`, child);
      }
    }
  };

  const startPath = resolve(env.cwd, start);
  const node = lookup(env.root, startPath);
  if (!node) return errorOut("find", `${start}: No such file or directory`);

  walk(startPath, start, node);
  return { out };
};

const tree: Handler = (cmd, env) => {
  const start = cmd.args[0] ?? ".";
  const path = resolve(env.cwd, start);
  const node = lookup(env.root, path);
  if (!node) return errorOut("tree", `${start}: No such file or directory`);
  if (!isDir(node)) return { out: [[nameSpan(node)]] };

  const out: OutLine[] = [[{ text: start, tone: "dir" }]];
  let dirs = 0;
  let files = 0;

  const walk = (current: DirNode, prefix: string) => {
    const entries = listDir(current, false);
    entries.forEach((entry, index) => {
      const last = index === entries.length - 1;
      out.push([
        { text: `${prefix}${last ? "`-- " : "|-- "}`, tone: "faint" },
        nameSpan(entry),
      ]);
      if (isDir(entry)) {
        dirs += 1;
        walk(entry, `${prefix}${last ? "    " : "|   "}`);
      } else {
        files += 1;
      }
    });
  };

  walk(node, "");
  out.push([]);
  out.push(line(`${dirs} directories, ${files} files`, "dim"));
  return { out };
};

const mkdirCmd: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("mkdir", "missing operand");
  const out: OutLine[] = [];
  for (const target of cmd.args) {
    const result = mkdir(env.root, resolve(env.cwd, target), cmd.flags.has("p"));
    if (!result.ok) out.push(line(`mkdir: ${result.error}`, "err"));
  }
  return { out };
};

const touchCmd: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("touch", "missing file operand");
  const out: OutLine[] = [];
  for (const target of cmd.args) {
    const result = touch(env.root, resolve(env.cwd, target));
    if (!result.ok) out.push(line(`touch: ${result.error}`, "err"));
  }
  return { out };
};

const rm: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("rm", "missing operand");
  const recursive = cmd.flags.has("r") || cmd.flags.has("R") || cmd.flags.has("f");
  const out: OutLine[] = [];
  for (const target of cmd.args) {
    const result = remove(env.root, resolve(env.cwd, target), recursive);
    if (!result.ok && !cmd.flags.has("f")) {
      out.push(line(`rm: ${result.error}`, "err"));
    }
  }
  return { out };
};

const rmdir: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("rmdir", "missing operand");
  const out: OutLine[] = [];
  for (const target of cmd.args) {
    const path = resolve(env.cwd, target);
    const node = lookup(env.root, path);
    if (!node || !isDir(node)) {
      out.push(line(`rmdir: ${target}: Not a directory`, "err"));
      continue;
    }
    if (Object.keys(node.children).length > 0) {
      out.push(line(`rmdir: ${target}: Directory not empty`, "err"));
      continue;
    }
    remove(env.root, path, true);
  }
  return { out };
};

const cp: Handler = (cmd, env) => {
  if (cmd.args.length < 2) return errorOut("cp", "missing destination operand");
  const to = cmd.args[cmd.args.length - 1];
  const sources = cmd.args.slice(0, -1);
  const out: OutLine[] = [];
  for (const from of sources) {
    const result = copy(
      env.root,
      resolve(env.cwd, from),
      resolve(env.cwd, to),
      cmd.flags.has("r") || cmd.flags.has("R"),
    );
    if (!result.ok) out.push(line(`cp: ${result.error}`, "err"));
  }
  return { out };
};

const mv: Handler = (cmd, env) => {
  if (cmd.args.length < 2) return errorOut("mv", "missing destination operand");
  const to = cmd.args[cmd.args.length - 1];
  const sources = cmd.args.slice(0, -1);
  const out: OutLine[] = [];
  for (const from of sources) {
    const result = move(env.root, resolve(env.cwd, from), resolve(env.cwd, to));
    if (!result.ok) out.push(line(`mv: ${result.error}`, "err"));
  }
  return { out };
};

const echo: Handler = (cmd) => ({ out: [line(cmd.rest.replace(/^["']|["']$/g, ""))] });

const openEditor: Handler = (cmd, env) => {
  if (cmd.args.length === 0) {
    return { out: [], openEditor: resolve(env.cwd, "[No Name]") };
  }
  const path = resolve(env.cwd, cmd.args[0]);
  const node = lookup(env.root, path);
  if (node && isDir(node)) {
    return errorOut("vi", `${cmd.args[0]}: Is a directory`);
  }
  return { out: [], openEditor: path };
};

const fileCmd: Handler = (cmd, env) => {
  if (cmd.args.length === 0) return errorOut("file", "missing operand");
  const out: OutLine[] = [];
  for (const target of cmd.args) {
    const node = lookup(env.root, resolve(env.cwd, target));
    if (!node) {
      out.push(line(`${target}: cannot open`, "err"));
      continue;
    }
    if (isDir(node)) {
      out.push(line(`${target}: directory`));
      continue;
    }
    const ext = target.slice(target.lastIndexOf(".") + 1);
    const kind =
      ext === "cpp" || ext === "h"
        ? "C++ source, ASCII text"
        : node.executable
          ? "ELF 64-bit LSB executable, x86-64"
          : "ASCII text";
    out.push(line(`${target}: ${kind}`));
  }
  return { out };
};

const BUILTINS = [
  ["ls", "list directory contents"],
  ["cd", "change directory"],
  ["pwd", "print working directory"],
  ["cat", "print a file, use -n for line numbers"],
  ["head", "first lines of a file"],
  ["tail", "last lines of a file"],
  ["wc", "count lines, words and bytes"],
  ["grep", "search text, -r to recurse, -n for line numbers"],
  ["find", "walk a tree, -name to filter"],
  ["tree", "draw the directory tree"],
  ["mkdir", "make a directory, -p for parents"],
  ["rmdir", "remove an empty directory"],
  ["touch", "create an empty file"],
  ["rm", "remove files, -r for directories"],
  ["cp", "copy files, -r for directories"],
  ["mv", "move or rename"],
  ["echo", "print the rest of the line"],
  ["file", "guess what a file holds"],
  ["vi", "open the editor, this is the whole point"],
  ["make", "build the raytracer project"],
  ["clear", "wipe the scrollback"],
  ["help", "this list"],
];

const help: Handler = () => {
  const out: OutLine[] = [
    line("vidojo shell, a small pretend Linux userspace", "accent"),
    [],
  ];
  for (const [name, blurb] of BUILTINS) {
    out.push([
      { text: `  ${pad(name, 9)}`, tone: "accent" },
      { text: blurb, tone: "dim" },
    ]);
  }
  out.push([]);
  out.push(line("Inside the editor, :help lists vi keys instead.", "dim"));
  return { out };
};

const makeCmd: Handler = (cmd, env) => {
  const project = lookupDir(env.root, resolve(env.cwd, "."));
  const hasMakefile = project && project.children["Makefile"];
  if (!hasMakefile) {
    return { out: [line("make: *** No targets specified.  Stop.", "err")] };
  }

  const target = cmd.args[0] ?? "all";

  if (target === "clean") {
    remove(env.root, resolve(env.cwd, "build"), true);
    mkdir(env.root, resolve(env.cwd, "build"));
    return { out: [line("rm -rf build out.ppm", "dim")] };
  }

  const srcDir = lookupDir(env.root, resolve(env.cwd, "src"));
  const sources = srcDir ? listDir(srcDir, false).map((n) => n.name) : [];
  const out: OutLine[] = [];

  if (target === "test") {
    out.push(
      line("g++ -std=c++17 -O2 -Wall -Wextra -Iinclude -o build/test_vec3 tests/test_vec3.cpp", "dim"),
    );
    out.push(line("./build/test_vec3", "dim"));
    out.push(line("all vec3 tests passed", "accent"));
    return { out };
  }

  mkdir(env.root, resolve(env.cwd, "build"), true);
  for (const source of sources) {
    const object = source.replace(/\.cpp$/, ".o");
    out.push(
      line(
        `g++ -std=c++17 -O2 -Wall -Wextra -Iinclude -c src/${source} -o build/${object}`,
        "dim",
      ),
    );
    touch(env.root, resolve(env.cwd, `build/${object}`));
  }
  out.push(
    line(
      `g++ -std=c++17 -O2 -Wall -Wextra -Iinclude -o build/raytracer ${sources.map((s) => `build/${s.replace(/\.cpp$/, ".o")}`).join(" ")}`,
      "dim",
    ),
  );

  const binary = resolve(env.cwd, "build/raytracer");
  touch(env.root, binary);
  const node = lookup(env.root, binary);
  if (node && isFile(node)) {
    node.executable = true;
    node.mode = "-rwxr-xr-x";
    node.lines = ["<binary>"];
  }

  out.push(line("build succeeded", "accent"));
  return { out };
};

const runBinary = (path: string, env: ShellEnv, args: string[]): CommandResult => {
  const node = lookup(env.root, path);
  if (!node) return errorOut("sh", `${path}: No such file or directory`);
  if (isDir(node)) return errorOut("sh", `${path}: Is a directory`);
  if (!node.executable) return errorOut("sh", `${path}: Permission denied`);

  if (basename(path) === "test_vec3") {
    return { out: [line("all vec3 tests passed", "accent")] };
  }

  if (args.includes("--help")) {
    return {
      out: lines(
        `usage: ${path} [width] [height] [samples]\n  width    image width in pixels, default 640\n  height   image height in pixels, default 360\n  samples  samples per pixel, default 16`,
      ),
    };
  }

  const width = Number(args[0] ?? 640);
  const height = Number(args[1] ?? 360);
  const samples = Number(args[2] ?? 16);
  return {
    out: [
      line(`rendering ${width}x${height} at ${samples} spp`, "dim"),
      line("done, traced 4 spheres", "dim"),
      line("output written to out.ppm", "accent"),
    ],
  };
};

const HANDLERS: Record<string, Handler> = {
  ls,
  ll: (cmd, env) => ls({ ...cmd, flags: new Set([...cmd.flags, "l", "a"]) }, env),
  cd,
  pwd,
  cat,
  less: cat,
  more: cat,
  head,
  tail,
  wc,
  grep,
  find,
  tree,
  mkdir: mkdirCmd,
  rmdir,
  touch: touchCmd,
  rm,
  cp,
  mv,
  echo,
  file: fileCmd,
  vi: openEditor,
  vim: openEditor,
  nano: openEditor,
  help,
  make: makeCmd,
  whoami: () => ({ out: [line(USER)] }),
  hostname: () => ({ out: [line(HOST)] }),
  uname: (cmd) => ({
    out: [
      line(
        cmd.flags.has("a")
          ? `Linux ${HOST} 6.8.0 #1 SMP x86_64 GNU/Linux`
          : "Linux",
      ),
    ],
  }),
  date: () => ({ out: [line("Sat Sep 19 09:24:11 UTC 2026")] }),
  env: () => ({
    out: lines(
      `USER=${USER}\nHOME=${HOME}\nSHELL=/bin/bash\nEDITOR=vi\nTERM=xterm-256color\nPATH=${HOME}/bin:/usr/local/bin:/usr/bin:/bin`,
    ),
  }),
  which: (cmd) => {
    const target = cmd.args[0];
    if (!target) return errorOut("which", "missing argument");
    if (HANDLERS[target]) return { out: [line(`/usr/bin/${target}`)] };
    return { out: [line(`which: no ${target} in (/usr/bin:/bin)`, "err")] };
  },
  man: (cmd) => {
    const target = cmd.args[0];
    const entry = BUILTINS.find(([name]) => name === target);
    if (!entry) {
      return { out: [line(`No manual entry for ${target ?? ""}`, "err")] };
    }
    return {
      out: [
        line(`${entry[0].toUpperCase()}(1)`, "accent"),
        [],
        line(`  ${entry[0]}  ${entry[1]}`),
      ],
    };
  },
  history: (_cmd, env) => ({
    out: env.history.map((entry, index) => [
      { text: `${padStart(String(index + 1), 5)}  `, tone: "faint" as const },
      { text: entry, tone: "fg" as const },
    ]),
  }),
  clear: () => ({ out: [], clear: true }),
  exit: () => ({ out: [line("There is no way out. Try :q inside vi.", "dim")] }),
  sudo: () => ({
    out: [line(`${USER} is not in the sudoers file. This incident is not being reported.`, "err")],
  }),
};

export function runCommand(input: string, env: ShellEnv): CommandResult {
  const cmd = parse(input);
  if (!cmd) return EMPTY;

  if (cmd.name.startsWith("./") || cmd.name.startsWith("/") || cmd.name.startsWith("~")) {
    return runBinary(resolve(env.cwd, cmd.name), env, cmd.args);
  }

  const handler = HANDLERS[cmd.name];
  if (!handler) {
    return {
      out: [
        line(`${cmd.name}: command not found`, "err"),
        line("Type help to see what this box understands.", "faint"),
      ],
    };
  }

  return handler(cmd, env);
}

export function knownCommands(): string[] {
  return Object.keys(HANDLERS).sort();
}

export function promptFor(cwd: string): Span[] {
  return [
    { text: `${USER}@${HOST}`, tone: "accent" },
    { text: ":", tone: "faint" },
    { text: tilde(cwd), tone: "info" },
    { text: "$ ", tone: "faint" },
  ];
}

export { dirname, lookup, lookupDir, resolve, tilde };
