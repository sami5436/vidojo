import { HOME, isDir, type DirNode, type FsNode } from "./types";

/** Collapse ".", ".." and duplicate slashes into a clean absolute path. */
export function normalize(path: string): string {
  const absolute = path.startsWith("/");
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  const joined = out.join("/");
  return absolute ? `/${joined}` : joined;
}

/** Turn whatever the user typed into an absolute path, honouring ~ and cwd. */
export function resolve(cwd: string, input: string): string {
  let raw = input;
  if (raw === "~") raw = HOME;
  else if (raw.startsWith("~/")) raw = `${HOME}/${raw.slice(2)}`;
  if (!raw.startsWith("/")) raw = `${cwd}/${raw}`;
  const normalized = normalize(raw);
  return normalized === "" ? "/" : normalized;
}

export function dirname(path: string): string {
  const clean = normalize(path);
  const cut = clean.lastIndexOf("/");
  if (cut <= 0) return "/";
  return clean.slice(0, cut);
}

export function basename(path: string): string {
  const clean = normalize(path);
  if (clean === "/") return "/";
  return clean.slice(clean.lastIndexOf("/") + 1);
}

export function join(...parts: string[]): string {
  return normalize(parts.join("/"));
}

/** Shorten an absolute path for display, so /home/sami/src reads as ~/src. */
export function tilde(path: string): string {
  if (path === HOME) return "~";
  if (path.startsWith(`${HOME}/`)) return `~/${path.slice(HOME.length + 1)}`;
  return path;
}

export function lookup(root: DirNode, path: string): FsNode | null {
  const clean = normalize(path);
  if (clean === "/") return root;
  let node: FsNode = root;
  for (const part of clean.split("/").filter(Boolean)) {
    if (!isDir(node)) return null;
    const next: FsNode | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

export function lookupDir(root: DirNode, path: string): DirNode | null {
  const node = lookup(root, path);
  return node && isDir(node) ? node : null;
}
