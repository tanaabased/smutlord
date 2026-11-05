import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import backupCommands from '../commands.js';
import runBackupTask from '../task.js';

const completed = {
  status: 'completed',
  agentId: 'smutlord',
  delivered: true,
  retention: 'completed',
  localKept: 5,
  remoteKept: 5,
  remoteDeleted: 1,
};

function fixture(argv = []) {
  const output = { stdout: '', stderr: '' };
  const calls = [];
  const storage = {
    lockFd: 17,
    assertHeld: async () => {},
    close: async () => calls.push('close'),
  };
  const commands = {};
  return {
    output,
    calls,
    storage,
    commands,
    options: {
      argv,
      cwd: '/workspace',
      stdout: {
        write: (text) => {
          output.stdout += text;
        },
      },
      stderr: {
        write: (text) => {
          output.stderr += text;
        },
      },
      canonicalize: async (path) => {
        calls.push(['canonicalize', path]);
        return '/canonical';
      },
      open: async (path) => {
        calls.push(['open', path]);
        return storage;
      },
      commands: (options) => {
        calls.push(['commands', options]);
        return commands;
      },
      run: async (options) => {
        calls.push(['run', options]);
        return completed;
      },
    },
  };
}

describe('lib/backup/task', () => {
  for (const report of [false, true]) {
    for (const args of [
      [],
      ['--operator'],
      ['--operator', '--pilot'],
      ['--operator', '--resume-archive', 'archive.tar.gz'],
      ['--operator', '--pilot', '--resume-archive', '/archive.tar.gz'],
    ]) {
      it(`should preserve execution arguments and JSON contract (${report}, ${args.join(' ')})`, async () => {
        const argv = [...(report ? ['--report'] : []), ...args];
        const original = [...argv];
        const f = fixture(argv);
        assert.equal(await runBackupTask(f.options), 0);
        if (report) {
          const document = JSON.parse(f.output.stdout);
          assert.equal(document.schema, 'agent-system.report');
          assert.equal(document.version, 1);
          assert.equal(document.cards.length, 1);
          assert.equal(document.cards[0].status, 'success');
          if (args.includes('--resume-archive'))
            assert.match(document.cards[0].facts[0].value, /Existing archive/);
        } else assert.equal(f.output.stdout, `${JSON.stringify(completed)}\n`);
        assert.equal(f.output.stderr, '');
        assert.deepEqual(f.calls.slice(0, 2), [
          ['canonicalize', '/workspace'],
          ['open', '/canonical'],
        ]);
        assert.deepEqual(f.calls[2], [
          'commands',
          {
            workspace: '/canonical',
            operator: args.includes('--operator'),
            storage: f.storage,
          },
        ]);
        const selected = args.includes('--resume-archive') ? args.at(-1) : undefined;
        assert.deepEqual(f.calls[3], [
          'run',
          {
            workspace: '/canonical',
            commands: f.commands,
            storage: f.storage,
            resumeArchive: selected?.startsWith('/')
              ? selected
              : selected
                ? `/workspace/${selected}`
                : undefined,
            pilot: args.includes('--pilot'),
          },
        ]);
        assert.equal(f.calls[4], 'close');
        assert.equal(f.calls.length, 5);
        assert.deepEqual(argv, original);
      });
    }
  }

  for (const report of [false, true]) {
    for (const args of [
      ['--pilot'],
      ['--resume-archive', '/archive'],
      ['--operator', '--resume-archive'],
      ['--operator', '--resume-archive', '/archive', 'extra'],
      ['--report', '--report'],
      ['--operator', '--report'],
      ['--pilot', '--operator'],
    ]) {
      it(`should reject invalid arguments before storage (${report}, ${args.join(' ')})`, async () => {
        const f = fixture([...(report ? ['--report'] : []), ...args]);
        assert.equal(await runBackupTask(f.options), 1);
        assert.deepEqual(f.calls, []);
        assert.match(f.output.stderr, /arguments-invalid/);
      });
    }
  }

  it('should keep default mode independent of report formatting and preserve close failure output', async () => {
    const f = fixture();
    f.options.format = () => {
      throw new Error('must-not-format');
    };
    f.storage.close = async () => {
      throw new Error('private-secret');
    };
    assert.equal(await runBackupTask(f.options), 1);
    assert.equal(f.output.stdout, `${JSON.stringify(completed)}\n`);
    assert.equal(f.output.stderr, 'Backup lock descriptor close failed.\n');
  });

  it('should preserve default failure diagnostics without exposing arbitrary errors', async () => {
    const f = fixture();
    f.options.run = async () => {
      throw new Error('token=private-secret');
    };
    assert.equal(await runBackupTask(f.options), 1);
    assert.equal(f.output.stdout, '');
    assert.equal(
      f.output.stderr,
      'Backup Drive task failed (task-failed); inspect .private/backup-drive/delivery-status.json and delivery.json (legacy journal.json is preserved).\n',
    );
    assert.equal(f.calls.at(-1), 'close');
  });

  it('should skip locked execution without invoking maintenance', async () => {
    const f = fixture(['--report']);
    f.options.open = async () => {
      throw new Error('backup-run-locked');
    };
    assert.equal(await runBackupTask(f.options), 1);
    const card = JSON.parse(f.output.stdout).cards[0];
    assert.equal(card.status, 'error');
    assert.match(card.findings.join(' '), /Skipped/);
    assert.match(card.actions.join(' '), /do not remove its lock/);
    assert.equal(f.calls.length, 1);
  });

  it('should report deferred cleanup independently of successful delivery and process exit', async () => {
    const f = fixture(['--report']);
    f.options.run = async () => ({
      ...completed,
      retention: 'deferred',
      code: 'local-prune-failed',
    });
    assert.equal(await runBackupTask(f.options), 0);
    const card = JSON.parse(f.output.stdout).cards[0];
    assert.equal(card.status, 'warning');
    assert.equal(card.facts.find(({ label }) => label === 'Drive delivery').value, 'Verified');
    assert.match(f.output.stderr, /local-prune-failed/);
  });

  for (const result of [
    { status: 17, stdout: '{"code":"backup-openclaw-state-required"}', stderr: 'private-secret' },
    { status: null, signal: 'SIGTERM', stdout: '', stderr: 'private-secret' },
    { status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT' }, stdout: '' },
  ]) {
    it('should preserve managed process failure diagnostics without replaying commands', async () => {
      const f = fixture(['--report']);
      let executions = 0;
      f.options.commands = (options) =>
        backupCommands({
          ...options,
          environment: { AGENT_SYSTEM_GOG: '/bound/google' },
          spawn: () => {
            executions++;
            return result;
          },
        });
      f.options.run = ({ commands }) => commands.backup(['create']);
      assert.equal(await runBackupTask(f.options), 1);
      assert.equal(executions, 1);
      assert.equal(JSON.parse(f.output.stdout).cards[0].status, 'error');
      assert.match(f.output.stderr, /managed-command-failed/);
      assert.match(f.output.stderr, result.status === 17 ? /child exit 17/ : /signal SIG/);
      if (result.error) assert.match(f.output.stderr, /timed out/);
      assert.doesNotMatch(JSON.stringify(f.output), /private-secret/);
      assert.equal(f.calls.at(-1), 'close');
    });
  }

  for (const boundary of ['format', 'stdout']) {
    it(`should separate ${boundary} failure from completed maintenance without replay`, async () => {
      const f = fixture(['--report']);
      if (boundary === 'format')
        f.options.format = () => {
          throw new Error('private-secret');
        };
      else
        f.options.stdout.write = () => {
          throw new Error('private-secret');
        };
      assert.equal(await runBackupTask(f.options), 1);
      assert.equal(f.output.stdout, '');
      assert.match(f.output.stderr, /report unavailable; command outcome returned/);
      assert.doesNotMatch(f.output.stderr, /private-secret/);
      assert.equal(f.calls.filter((call) => call[0] === 'run').length, 1);
      assert.equal(f.calls.at(-1), 'close');
    });
  }

  it('should preserve failed command outcome when the formatter also fails', async () => {
    const f = fixture(['--report']);
    f.options.run = async () => {
      f.calls.push(['run']);
      throw new Error('backup-create-failed');
    };
    f.options.format = () => {
      throw new Error('private-secret');
    };
    assert.equal(await runBackupTask(f.options), 1);
    assert.match(f.output.stderr, /report unavailable; command outcome failed/);
    assert.equal(f.calls.filter((call) => call[0] === 'run').length, 1);
  });

  it('should preserve confirmed delivery when closing the lock fails', async () => {
    const f = fixture(['--report']);
    f.storage.close = async () => {
      throw new Error('private-secret');
    };
    assert.equal(await runBackupTask(f.options), 1);
    const card = JSON.parse(f.output.stdout).cards[0];
    assert.equal(card.status, 'error');
    assert.equal(card.facts.find(({ label }) => label === 'Drive delivery').value, 'Verified');
    assert.match(f.output.stderr, /close failed/);
    assert.doesNotMatch(f.output.stderr, /private-secret/);
  });
});

describe('scripts/backup-drive-task process boundary', () => {
  it('should expose report streams and failure exit without touching backup storage', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'smutlord-backup-report-'));
    try {
      const entrypoint = fileURLToPath(
        new URL('../../../scripts/backup-drive-task.js', import.meta.url),
      );
      const result = spawnSync(process.execPath, [entrypoint, '--report', '--invalid'], {
        cwd: workspace,
        encoding: 'utf8',
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.equal(JSON.parse(result.stdout).cards[0].status, 'error');
      assert.match(result.stderr, /arguments-invalid/);
      assert.deepEqual(await readdir(workspace), []);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
