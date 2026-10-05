import assert from 'node:assert/strict';
import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyWorkspaceMemory, checkWorkspaceMemory } from '../lib/setup/workspace-memory.js';

describe('workspace memory setup', () => {
  let workspace;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smutlord-workspace-memory-'));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it('should check without changing a fresh workspace, then initialize both paths', () => {
    assert.equal(checkWorkspaceMemory(workspace), false);
    assert.deepEqual(readdirSync(workspace), []);
    applyWorkspaceMemory(workspace);
    assert.equal(lstatSync(join(workspace, 'memory')).isDirectory(), true);
    assert.equal(
      readFileSync(join(workspace, 'MEMORY.md'), 'utf8'),
      '# Memory\n\nPrivate, curated notes for this agent.\n',
    );
    assert.equal(checkWorkspaceMemory(workspace), true);
  });

  it('should initialize only the absent path in a partial workspace', () => {
    mkdirSync(join(workspace, 'memory'));
    applyWorkspaceMemory(workspace);
    assert.equal(lstatSync(join(workspace, 'memory')).isDirectory(), true);
    assert.equal(readFileSync(join(workspace, 'MEMORY.md'), 'utf8').startsWith('# Memory'), true);
  });

  it('should preserve existing notes and an empty MEMORY.md', () => {
    mkdirSync(join(workspace, 'memory'));
    writeFileSync(join(workspace, 'memory', '2026-10-03.md'), 'private note\n');
    writeFileSync(join(workspace, 'MEMORY.md'), 'Existing continuity.\n');
    applyWorkspaceMemory(workspace);
    assert.equal(readFileSync(join(workspace, 'MEMORY.md'), 'utf8'), 'Existing continuity.\n');
    assert.equal(
      readFileSync(join(workspace, 'memory', '2026-10-03.md'), 'utf8'),
      'private note\n',
    );

    writeFileSync(join(workspace, 'MEMORY.md'), '');
    applyWorkspaceMemory(workspace);
    assert.equal(readFileSync(join(workspace, 'MEMORY.md'), 'utf8'), '');
  });

  it('should fail without replacing a conflicting MEMORY.md path', () => {
    mkdirSync(join(workspace, 'MEMORY.md'));
    assert.throws(() => applyWorkspaceMemory(workspace), /must be a regular file/u);
    assert.equal(lstatSync(join(workspace, 'MEMORY.md')).isDirectory(), true);
    assert.deepEqual(readdirSync(workspace), ['MEMORY.md']);
  });

  it('should fail without replacing a conflicting memory path', () => {
    writeFileSync(join(workspace, 'memory'), 'keep me');
    assert.throws(() => applyWorkspaceMemory(workspace), /must be a directory/u);
    assert.equal(readFileSync(join(workspace, 'memory'), 'utf8'), 'keep me');
    assert.deepEqual(readdirSync(workspace), ['memory']);
  });

  it('should be safe to apply repeatedly', () => {
    applyWorkspaceMemory(workspace);
    const content = readFileSync(join(workspace, 'MEMORY.md'), 'utf8');
    applyWorkspaceMemory(workspace);
    assert.equal(readFileSync(join(workspace, 'MEMORY.md'), 'utf8'), content);
  });
});
