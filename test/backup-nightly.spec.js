import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import openBackupStorage from '../lib/backup/storage.js';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
  realpath,
} from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/backup-drive-task.sh', import.meta.url));
const fixture = fileURLToPath(new URL('./backup-nightly-fixture.js', import.meta.url));
const old = 'smutlord-nightly-2026-11-12T08-00-00-000Z-00000000-0000-4000-8000-000000000000.tar.gz';
const link = old.replace('11-12T', '11-11T');
const manual = old.replace('smutlord-nightly-', 'smutlord-');
const temporary = `.${old}`;
const malformed = old.replace('000000000000.tar', 'not-a-uuid.tar');

describe('scripts/backup-drive-task', () => {
  let workspace;
  let output;
  beforeEach(async () => {
    workspace = await realpath(await mkdtemp(join(tmpdir(), 'nightly-backup-')));
    output = join(workspace, 'archives with spaces');
    await mkdir(output);
    await mkdir(join(workspace, '.agent-system'));
    await mkdir(join(workspace, 'bin'));
    // macOS has no stock flock CLI. This fixture locks the inherited descriptor
    // with the real OS primitive; owning-command integration stays operational acceptance.
    await writeFile(
      join(workspace, 'bin', 'flock'),
      `#!/usr/bin/perl
use Fcntl qw(LOCK_EX LOCK_NB);
open my $file, '>&=9' or die "missing inherited descriptor";
exit(flock($file, LOCK_EX | LOCK_NB) ? 0 : 1);
`,
      { mode: 0o755 },
    );
    for (const name of ['openclaw', 'gog']) {
      await writeFile(
        join(workspace, 'bin', name),
        `#!/usr/bin/env bash\nexec "${process.execPath}" "${fixture}" "$@"\n`,
        { mode: 0o755 },
      );
    }
    for (const name of [old, manual, temporary, malformed, 'legacy.tar.gz'])
      await writeFile(join(output, name), name);
    await writeFile(join(workspace, 'protected'), 'protected');
    await symlink(join(workspace, 'protected'), join(output, link));
    await mkdir(join(output, old.replace('11-12T', '11-10T')));
    await mkdir(join(output, 'nested'));
    await writeFile(join(output, 'nested', old), 'nested');
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });
  const run = (mode = '') =>
    spawnSync('bash', [script], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${workspace}/bin:${process.env.PATH}`,
        AGENT_SYSTEM_GOG: join(workspace, 'bin', 'gog'),
        BACKUP_TEST_MODE: mode,
        BACKUP_TEST_UUID: randomUUID(),
      },
    });
  const calls = async () =>
    (await readFile(join(workspace, 'calls.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);

  it('should upload renamed bytes then remove all reserved regular archives but preserve other entries', async () => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const names = await readdir(output);
    assert(!names.includes(old));
    for (const name of [manual, temporary, malformed, 'legacy.tar.gz', link, 'nested'])
      assert(names.includes(name));
    assert.equal(await readFile(join(workspace, 'protected'), 'utf8'), 'protected');
    assert.equal(await readFile(join(output, 'nested', old), 'utf8'), 'nested');
    assert.match(result.stdout, /delivered/);
  });
  for (const mode of ['create-failure', 'upload-failure', 'upload-malformed', 'public-folder']) {
    it(`should retain local archives and skip cleanup after ${mode}`, async () => {
      const result = run(mode);
      assert.notEqual(result.status, 0);
      assert((await readdir(output)).includes(old));
      assert(!(await calls()).some((call) => call[2] === 'delete'));
      assert.match(result.stderr, /not delivered/);
      if (mode === 'create-failure' || mode === 'public-folder')
        assert(!(await calls()).some((call) => call[2] === 'upload'));
    });
  }
  it('should distinguish successful delivery from failed local cleanup and return failure', async () => {
    await writeFile(join(workspace, 'bin', 'rm'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /delivered; local cleanup failed/);
    assert((await readdir(output)).includes(old));
    assert(!(await calls()).some((call) => call[2] === 'delete'));
  });
  it('should supersede failed-upload leftovers on a later successful run', async () => {
    assert.notEqual(run('upload-failure').status, 0);
    assert.equal(run().status, 0);
    assert(!(await readdir(output)).some((name) => name.startsWith('smutlord-nightly-2026-11-13')));
  });
  for (const mode of ['rotation', 'rotation-paged'])
    it(`should preserve five owned nightly remote files with ${mode}`, async () => {
      const result = run(mode);
      assert.equal(result.status, 0, result.stderr);
      const deleted = (await calls())
        .filter((call) => call[2] === 'delete')
        .map((call) => call[3])
        .sort();
      assert.deepEqual(deleted, ['old01', 'old02']);
    });
  for (const mode of ['list-incomplete', 'list-malformed', 'list-cycle'])
    it(`should refuse ${mode} without deleting remote history`, async () => {
      const result = run(mode);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /delivered; remote retention failed/);
      assert(!(await calls()).some((call) => call[2] === 'delete'));
    });
  it('should retain the shared OS lock in a running child after the shell is killed', async () => {
    const child = spawn('bash', [script], {
      cwd: workspace,
      env: {
        ...process.env,
        PATH: `${workspace}/bin:${process.env.PATH}`,
        AGENT_SYSTEM_GOG: join(workspace, 'bin', 'gog'),
        BACKUP_TEST_MODE: 'hold-create',
        BACKUP_TEST_UUID: randomUUID(),
      },
    });
    child.stdout.resume();
    child.stderr.resume();
    const exited = once(child, 'exit');
    const deadline = Date.now() + 4000;
    const waitForRelease = async () => {
      // The orphaned capture must finish before its disposable workspace is removed.
      while (true) {
        let storage;
        try {
          storage = await openBackupStorage(workspace);
        } catch (error) {
          if (!/backup-run-locked/.test(error.message)) throw error;
          assert(Date.now() < deadline, 'capture child retained lock');
          await new Promise((resolve) => setTimeout(resolve, 10));
          continue;
        }
        await storage.close();
        break;
      }
    };
    try {
      while (!(await readdir(workspace)).includes('ready')) {
        assert(Date.now() < deadline, 'capture child did not start');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await assert.rejects(openBackupStorage(workspace), /backup-run-locked/);
      child.kill('SIGKILL');
      await exited;
      await assert.rejects(openBackupStorage(workspace), /backup-run-locked/);
    } finally {
      await writeFile(join(workspace, 'release'), 'release');
      child.kill('SIGKILL');
      await exited;
      await waitForRelease();
    }
  });
  it('should refuse overlapping or interrupted runs before invoking owning commands', async () => {
    const storage = await openBackupStorage(workspace);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /locked/);
    await storage.close();
    await assert.rejects(readFile(join(workspace, 'calls.jsonl')), { code: 'ENOENT' });
  });
});
