import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/update-agent.sh', import.meta.url));
const legacy = fileURLToPath(new URL('../scripts/update-agent-task.js', import.meta.url));
const commands = [
  ['managed-git', 'pull --ff-only'],
  ['managed-git', 'rev-parse --short HEAD'],
  ['bun', 'install --frozen-lockfile --ignore-scripts'],
  ['openclaw', 'agent-system install --skip-setup'],
];

describe('scripts/update-agent', () => {
  async function run(failure = '', entry = 'bash', args = []) {
    const workspace = await mkdtemp(join(tmpdir(), 'update agent-'));
    try {
      for (const name of new Set(commands.map(([command]) => command))) {
        await writeFile(
          join(workspace, name),
          `#!/bin/bash
printf '%s %s\\n' "${name}" "$*" >> calls
if [ "$1" = rev-parse ]; then
  printf '%s\\n' abc1234
else
  printf '%s\\n' "${name} output"
fi
if [ "${name} $*" = "$UPDATE_TEST_FAILURE" ]; then
  exit 17
fi
`,
          { mode: 0o755 },
        );
      }
      const result = spawnSync(entry, [entry === 'bash' ? script : legacy, ...args], {
        cwd: workspace,
        encoding: 'utf8',
        timeout: 10000,
        env: {
          PATH: `${workspace}:${process.env.PATH}`,
          AGENT_SYSTEM_GIT: join(workspace, 'managed-git'),
          UPDATE_TEST_FAILURE: failure,
        },
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      const calls = (
        await readFile(join(workspace, 'calls'), 'utf8').catch((error) => {
          if (error.code !== 'ENOENT') throw error;
          return '';
        })
      ).trim();
      return { ...result, calls: calls ? calls.split('\n') : [] };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  function report(stdout) {
    const { schema, version, cards } = JSON.parse(stdout);
    assert.equal(schema, 'agent-system.report');
    assert.equal(version, 1);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].id, 'update-agent');
    assert.equal(cards[0].format, 'markdown');
    assert.match(cards[0].body, /\*\*Agent:\*\* SMUTLORD/);
    assert.match(cards[0].body, /Doctor \| — Not run/);
    return cards[0].body;
  }

  it('should run each update step in order and emit only its report on stdout', async () => {
    const result = await run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      result.calls,
      commands.map((command) => command.join(' ')),
    );
    assert.match(result.stderr, /bun output/);
    const body = report(result.stdout);
    assert.match(body, /✅ UPDATE AGENT · RUN RESULTS/);
    assert.match(body, /Repository \| ✅ Complete \| abc1234/);
    assert.match(body, /Dependencies \| ✅ Complete/);
    assert.match(body, /Install \| ✅ Complete/);
  });

  for (const [index, label, completed, skipped] of [
    [0, 'Repository', [], ['Dependencies', 'Install']],
    [2, 'Dependencies', ['Repository'], ['Install']],
    [3, 'Install', ['Repository', 'Dependencies'], []],
  ]) {
    it(`should report ${label} failure and propagate its exit status`, async () => {
      const expected = commands.slice(0, index + 1).map((command) => command.join(' '));
      const result = await run(expected.at(-1));
      assert.equal(result.status, 17, result.stderr);
      assert.deepEqual(result.calls, expected);
      const body = report(result.stdout);
      assert.match(body, /❌ UPDATE AGENT · RUN FAILED/);
      assert.ok(body.includes(`| ${label} | ❌ Failed | Exit 17 |`));
      for (const step of completed) assert.ok(body.includes(`| ${step} | ✅ Complete |`));
      for (const step of skipped) assert.ok(body.includes(`| ${step} | — Not run |`));
    });
  }

  it('should pass through the same structured failure from previously installed schedules', async () => {
    const failure = commands[2].join(' ');
    const expected = await run(failure);
    const result = await run(failure, process.execPath);
    assert.equal(result.status, expected.status, result.stderr);
    assert.equal(result.stdout, expected.stdout);
    assert.deepEqual(result.calls, expected.calls);
  });

  it('should keep legacy help read-only', async () => {
    const result = await run('', process.execPath, ['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /scripts\/update-agent-task\.js \[--help\]/);
    assert.deepEqual(result.calls, []);
  });
});
