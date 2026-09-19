import { listDir } from "@/lib/fs/ops";
import { lookupDir, resolve } from "@/lib/fs/path";
import { isDir, type DirNode } from "@/lib/fs/types";
import { knownCommands } from "./commands";
import { tokenize } from "./parse";

export type Completion = {
  /** the line rewritten with the completion applied */
  line: string;
  /** every candidate, so the shell can list them when there is no single winner */
  candidates: string[];
};

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

/** Tab completion over commands for the first word and paths for the rest. */
export function complete(
  input: string,
  root: DirNode,
  cwd: string,
): Completion {
  const endsWithSpace = /\s$/.test(input);
  const tokens = tokenize(input);
  const completingNew = endsWithSpace || tokens.length === 0;
  const fragment = completingNew ? "" : tokens[tokens.length - 1];
  const isFirstWord = tokens.length === 0 || (tokens.length === 1 && !endsWithSpace);

  let candidates: string[];
  let replaceFrom = fragment;

  if (isFirstWord) {
    candidates = knownCommands().filter((name) => name.startsWith(fragment));
  } else {
    const slash = fragment.lastIndexOf("/");
    const dirPart = slash >= 0 ? fragment.slice(0, slash + 1) : "";
    const namePart = slash >= 0 ? fragment.slice(slash + 1) : fragment;
    const dirNode = lookupDir(root, resolve(cwd, dirPart || "."));
    if (!dirNode) return { line: input, candidates: [] };

    candidates = listDir(dirNode, namePart.startsWith("."))
      .filter((node) => node.name.startsWith(namePart))
      .map((node) => `${dirPart}${node.name}${isDir(node) ? "/" : ""}`);
    replaceFrom = fragment;
  }

  if (candidates.length === 0) return { line: input, candidates: [] };

  const shared = longestCommonPrefix(candidates);
  const head = input.slice(0, input.length - replaceFrom.length);
  const single = candidates.length === 1;
  const filled = single && !shared.endsWith("/") ? `${shared} ` : shared;

  return { line: `${head}${filled}`, candidates };
}
