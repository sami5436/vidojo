import { basename, dirname, lookup, lookupDir, normalize } from "./path";
import { isDir, isFile, type DirNode, type FileNode, type FsNode } from "./types";

export type FsResult = { ok: true } | { ok: false; error: string };

const STAMP = "Sep 19 09:24";

function ok(): FsResult {
  return { ok: true };
}

function fail(error: string): FsResult {
  return { ok: false, error };
}

export function newFile(name: string, lines: string[] = [""]): FileNode {
  return {
    kind: "file",
    name,
    lines: lines.length > 0 ? lines : [""],
    mode: "-rw-r--r--",
    mtime: STAMP,
  };
}

export function newDir(name: string): DirNode {
  return { kind: "dir", name, children: {}, mode: "drwxr-xr-x", mtime: STAMP };
}

export function makePath(root: DirNode, path: string, node: FsNode): FsResult {
  const parent = lookupDir(root, dirname(path));
  if (!parent) return fail(`${dirname(path)}: No such file or directory`);
  parent.children[basename(path)] = node;
  return ok();
}

export function mkdir(
  root: DirNode,
  path: string,
  parents = false,
): FsResult {
  const clean = normalize(path);
  if (lookup(root, clean)) {
    return parents ? ok() : fail(`${path}: File exists`);
  }

  if (parents) {
    let cursor: DirNode = root;
    for (const part of clean.split("/").filter(Boolean)) {
      const existing: FsNode | undefined = cursor.children[part];
      if (existing) {
        if (!isDir(existing)) return fail(`${part}: Not a directory`);
        cursor = existing;
      } else {
        const made = newDir(part);
        cursor.children[part] = made;
        cursor = made;
      }
    }
    return ok();
  }

  return makePath(root, clean, newDir(basename(clean)));
}

export function touch(root: DirNode, path: string): FsResult {
  const existing = lookup(root, path);
  if (existing) return ok();
  return makePath(root, path, newFile(basename(path)));
}

export function writeFile(
  root: DirNode,
  path: string,
  lines: string[],
): FsResult {
  const existing = lookup(root, path);
  if (existing) {
    if (!isFile(existing)) return fail(`${path}: Is a directory`);
    existing.lines = lines.length > 0 ? lines : [""];
    return ok();
  }
  return makePath(root, path, newFile(basename(path), lines));
}

export function remove(
  root: DirNode,
  path: string,
  recursive = false,
): FsResult {
  const clean = normalize(path);
  if (clean === "/") return fail("/: Operation not permitted");

  const node = lookup(root, clean);
  if (!node) return fail(`${path}: No such file or directory`);
  if (isDir(node) && !recursive) {
    return fail(`${path}: is a directory`);
  }

  const parent = lookupDir(root, dirname(clean));
  if (!parent) return fail(`${path}: No such file or directory`);
  delete parent.children[basename(clean)];
  return ok();
}

function clone(node: FsNode): FsNode {
  if (isFile(node)) return { ...node, lines: [...node.lines] };
  const copied = newDir(node.name);
  for (const [name, child] of Object.entries(node.children)) {
    copied.children[name] = clone(child);
  }
  return copied;
}

/** Work out the real destination path, so `cp a.txt dir` lands as dir/a.txt. */
function destinationFor(root: DirNode, from: string, to: string): string {
  const target = lookup(root, to);
  if (target && isDir(target)) {
    return normalize(`${to}/${basename(from)}`);
  }
  return normalize(to);
}

export function copy(
  root: DirNode,
  from: string,
  to: string,
  recursive = false,
): FsResult {
  const source = lookup(root, from);
  if (!source) return fail(`${from}: No such file or directory`);
  if (isDir(source) && !recursive) return fail(`${from}: is a directory`);

  const dest = destinationFor(root, from, to);
  const copied = clone(source);
  copied.name = basename(dest);
  return makePath(root, dest, copied);
}

export function move(root: DirNode, from: string, to: string): FsResult {
  const source = lookup(root, from);
  if (!source) return fail(`${from}: No such file or directory`);

  const dest = destinationFor(root, from, to);
  if (normalize(from) === dest) return ok();

  const moved = source;
  const removed = remove(root, from, true);
  if (!removed.ok) return removed;

  moved.name = basename(dest);
  return makePath(root, dest, moved);
}

export function listDir(node: DirNode, showHidden = false): FsNode[] {
  return Object.values(node.children)
    .filter((child) => showHidden || !child.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));
}
