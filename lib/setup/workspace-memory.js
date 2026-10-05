import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const memorySeed = '# Memory\n\nPrivate, curated notes for this agent.\n';

function pathType(path) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return 'a symbolic link';
    if (stat.isDirectory()) return 'a directory';
    if (stat.isFile()) return 'a file';
    return 'a non-regular path';
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent';
    throw error;
  }
}

function inspectWorkspaceMemory(workspace) {
  const root = resolve(workspace);
  const memoryFile = join(root, 'MEMORY.md');
  const memoryDirectory = join(root, 'memory');
  const fileType = pathType(memoryFile);
  const directoryType = pathType(memoryDirectory);

  if (fileType !== 'absent' && fileType !== 'a file') {
    throw new Error(
      `Workspace memory path ${memoryFile} must be a regular file; found ${fileType}.`,
    );
  }
  if (directoryType !== 'absent' && directoryType !== 'a directory') {
    throw new Error(
      `Workspace memory path ${memoryDirectory} must be a directory; found ${directoryType}.`,
    );
  }

  return { memoryFile, memoryDirectory, fileType, directoryType };
}

export function checkWorkspaceMemory(workspace = process.cwd()) {
  const { fileType, directoryType } = inspectWorkspaceMemory(workspace);
  return fileType === 'a file' && directoryType === 'a directory';
}

export function applyWorkspaceMemory(workspace = process.cwd()) {
  const { memoryFile, memoryDirectory, fileType, directoryType } =
    inspectWorkspaceMemory(workspace);
  if (directoryType === 'absent') mkdirSync(memoryDirectory, { mode: 0o700 });
  if (fileType === 'absent') {
    writeFileSync(memoryFile, memorySeed, { flag: 'wx', mode: 0o600 });
  }
}
