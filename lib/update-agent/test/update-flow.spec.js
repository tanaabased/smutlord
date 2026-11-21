import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import runUpdate from '../run.js';
import runUpdateTask from '../task.js';
import updateCommands from '../commands.js';
import formatUpdateReport from '../utils/format-update-report.js';

describe('lib/update-agent/update-flow (filesystem component)', () => {
  it('should finish with preloaded code despite an old interrupted checkpoint after self-update replaces source files', async () => {
    const workspace = await realpath(await mkdtemp(join(tmpdir(), 'smutlord-update-flow-')));
    const runPath = join(workspace, 'run.mjs');
    const commandsPath = join(workspace, 'commands.mjs');
    const calls = [];
    const output = { stdout: '', stderr: '' };
    const target = 'b'.repeat(40);
    let head = 'a'.repeat(40);
    try {
      await writeFile(runPath, await readFile(new URL('../run.js', import.meta.url), 'utf8'));
      await writeFile(
        commandsPath,
        (await readFile(new URL('../commands.js', import.meta.url), 'utf8')).replace(
          './utils/read-lifecycle-result.js',
          new URL('../utils/read-lifecycle-result.js', import.meta.url).href,
        ),
      );
      const { default: run } = await import(pathToFileURL(runPath).href);
      const { default: commands } = await import(pathToFileURL(commandsPath).href);
      const legacy = join(workspace, '.private/update-agent');
      await mkdir(legacy, { recursive: true });
      const saved = join(legacy, 'status.json');
      await writeFile(saved, '{"reason":"interrupted-run"}');
      const exit = await runUpdateTask({
        cwd: workspace,
        canonicalize: async () => workspace,
        run,
        commands: (options) =>
          commands({
            ...options,
            environment: {
              AGENT_SYSTEM_GIT: '/fixture/managed-git',
              PRIVATE_VALUE: 'must-not-persist',
            },
            spawn: (command, argv, options) => {
              calls.push([command, ...argv]);
              assert.equal(options.cwd, workspace);
              assert.equal(options.stdio.length, 3);
              let stdout = '';
              if (argv[0] === 'rev-parse')
                stdout =
                  argv[1] === '--show-toplevel'
                    ? workspace
                    : argv[1] === '--absolute-git-dir'
                      ? join(workspace, '.git')
                      : target;
              if (argv[0] === 'status')
                stdout = `# branch.oid ${head}\n# branch.head main\n# branch.upstream origin/main\n`;
              if (argv[0] === 'remote') stdout = 'git@github.com:tanaabased/smutlord.git';
              if (argv[0] === 'merge') {
                assert.deepEqual(argv, ['merge', '--ff-only', '--no-edit', target]);
                head = target;
                writeFileSync(
                  runPath,
                  'throw new Error("new runner must wait for the next occurrence");',
                );
                writeFileSync(
                  commandsPath,
                  'throw new Error("new commands must wait for the next occurrence");',
                );
              }
              if (argv.includes('--skip-setup'))
                stdout = JSON.stringify({
                  agentId: 'smutlord',
                  workspaceDir: workspace,
                  outcomes: [],
                  warnings: [],
                });
              if (argv.includes('doctor'))
                stdout = JSON.stringify({
                  agentId: 'smutlord',
                  workspaceDir: workspace,
                  status: 'healthy',
                  findings: [],
                });
              return { status: 0, stdout, stderr: '' };
            },
          }),
        stdout: {
          write: (value) => {
            output.stdout += value;
          },
        },
        stderr: {
          write: (value) => {
            output.stderr += value;
          },
        },
      });
      assert.equal(exit, 0);
      assert.match(JSON.parse(output.stdout).cards[0].body, /✅ UPDATE AGENT/);
      assert.equal(output.stderr, '');
      assert.equal(await readFile(saved, 'utf8'), '{"reason":"interrupted-run"}');
      assert.deepEqual(
        calls.filter(([command]) => command !== '/fixture/managed-git'),
        [
          ['bun', 'install', '--frozen-lockfile', '--ignore-scripts'],
          ['openclaw', 'agent-system', 'install', '--skip-setup', '--json'],
          ['openclaw', 'agent-system', 'doctor', '--json'],
        ],
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('lib/update-agent/lifecycle evidence (filesystem component)', () => {
  for (const [name, response, expected] of [
    ['unreadable success', { status: 0, stdout: 'must-not-persist' }, 'warning'],
    ['unavailable status', { status: 0, stdout: '{"findings":[]}' }, 'warning'],
    [
      'unfamiliar status',
      { status: 0, stdout: '{"status":"new health state","findings":[]}' },
      'warning',
    ],
    ['unreadable failure', { status: 7, stdout: 'must-not-persist' }, 'error'],
    [
      'failed healthy payload',
      { status: 7, stdout: '{"status":"healthy","findings":[]}' },
      'error',
    ],
    [
      'healthy success',
      { status: 0, stdout: '{"status":"healthy","findings":[],"unused":"must-not-persist"}' },
      'success',
    ],
  ]) {
    it(`should report ${name} from current command results`, async () => {
      const workspace = await realpath(await mkdtemp(join(tmpdir(), 'smutlord-evidence-')));
      const calls = [];
      try {
        const head = 'a'.repeat(40);
        const inspect = async () => ({
          workspace,
          canonical: true,
          dirty: false,
          branch: 'main',
          inProgress: false,
          upstream: 'origin/main',
          remoteApproved: true,
          fastForward: true,
          remote: 'approved',
          head,
          target: head,
        });
        const lifecycle = updateCommands({
          workspace,
          environment: { AGENT_SYSTEM_GIT: '/fixture/git', TOKEN: 'must-not-persist' },
          spawn: (_, argv) => {
            calls.push(argv[1]);
            if (argv[1] === 'doctor') return response;
            assert.equal(argv[1], 'install');
            // Successful execution establishes application, even without readable component details.
            return { status: 0, stdout: 'must-not-persist' };
          },
        });
        const result = await runUpdate({
          workspace,
          id: 'original',
          commands: { ...lifecycle, inspect, fetch: async () => {}, dependencies: async () => {} },
        });
        assert.equal(result.steps.install.status, 'completed');
        assert.equal(result.steps.install.exitCode, 0);
        assert.equal(result.steps.doctor.exitCode, response.status);
        assert.equal(result.pending, undefined);
        assert.equal(result.status, response.status ? 'attention' : 'success');
        if (response.status)
          assert.equal(result.steps.doctor.processFailure.exitCode, response.status);
        const report = formatUpdateReport({ result });
        assert.equal(report.exitCode, response.status ? 1 : 0);
        assert.doesNotMatch(report.stdout, /must-not-persist/);
        const card = JSON.parse(report.stdout).cards[0];
        // Install detail is unavailable in every case, so otherwise healthy execution is a warning.
        assert.match(card.body, expected === 'error' ? /❌ UPDATE AGENT/ : /⚠️ UPDATE AGENT/);
        const doctor = card.body.split('\n').find((row) => row.includes('| Doctor |'));
        if (expected !== 'success') assert.match(doctor, new RegExp(`exit ${response.status}`));
        if (expected !== 'success') assert.doesNotMatch(card.body, /Doctor \| ✅ Healthy/);
        assert.deepEqual(calls, ['install', 'doctor']);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }
});
