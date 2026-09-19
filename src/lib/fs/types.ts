export type FileNode = {
  kind: "file";
  name: string;
  /** stored as lines so the editor never has to split on every keystroke */
  lines: string[];
  mode: string;
  mtime: string;
  executable?: boolean;
};

export type DirNode = {
  kind: "dir";
  name: string;
  children: Record<string, FsNode>;
  mode: string;
  mtime: string;
};

export type FsNode = FileNode | DirNode;

export const USER = "sami";
export const HOST = "vidojo";
export const HOME = `/home/${USER}`;

export function isDir(node: FsNode): node is DirNode {
  return node.kind === "dir";
}

export function isFile(node: FsNode): node is FileNode {
  return node.kind === "file";
}

export function fileSize(node: FileNode): number {
  if (node.lines.length === 0) return 0;
  return node.lines.reduce((sum, line) => sum + line.length + 1, 0);
}
