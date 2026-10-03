import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pluginModule = new URL('../lib/setup/plugin.js', import.meta.url).href;
const missing = {
  ok: false,
  error: {
    type: 'cli_error',
    message: 'Plugin not found: tanaab. Run `openclaw plugins list` to see installed plugins.',
  },
};

describe('lib/setup/plugin', () => {
  let directory;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'smutlord-plugin-inspection-'));
    writeFileSync(
      join(directory, 'openclaw'),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_CALLS"
if [ "$2" = inspect ]; then
  /bin/cat "$TEST_RESPONSE"
  exit "$TEST_STATUS"
fi
`,
      { mode: 0o700 },
    );
  });

  afterEach(() => rmSync(directory, { force: true, recursive: true }));

  function execute(status, response) {
    const responsePath = join(directory, 'response.json');
    const callsPath = join(directory, 'calls');
    writeFileSync(responsePath, typeof response === 'string' ? response : JSON.stringify(response));
    writeFileSync(callsPath, '');
    const task = join(directory, 'inspect-plugin.mjs');
    writeFileSync(
      task,
      `import { inspectPlugin } from ${JSON.stringify(pluginModule)};
try {
  process.stdout.write(JSON.stringify(inspectPlugin('tanaab')));
} catch (error) {
  process.stderr.write(error.message);
  process.exitCode = 2;
}
`,
    );
    const result = spawnSync(process.execPath, [task], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: directory,
        TEST_CALLS: callsPath,
        TEST_RESPONSE: responsePath,
        TEST_STATUS: String(status),
      },
    });
    assert.ifError(result.error);
    return { ...result, calls: readFileSync(callsPath, 'utf8').trim().split('\n') };
  }

  it('should report an inspected healthy plugin as converged', () => {
    const result = execute(0, {
      plugin: {
        id: 'tanaab',
        enabled: true,
        status: 'loaded',
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ['plugins inspect tanaab --json']);
    assert.equal(JSON.parse(result.stdout).plugin.enabled, true);
  });

  it('should return missing only after an explicit missing-plugin response', () => {
    const result = execute(1, missing);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), null);
    assert.deepEqual(result.calls, ['plugins inspect tanaab --json']);
  });

  it('should reject failed or invalid inspection instead of treating the plugin as missing', () => {
    const failures = [
      [1, { ok: false, error: { type: 'cli_error', message: 'Invalid configuration.' } }],
      [2, missing],
      [
        1,
        { ...missing, error: { ...missing.error, message: 'Plugin not found: other. Run help.' } },
      ],
      [1, 'not JSON'],
      [0, 'not JSON'],
      [0, null],
      [0, { plugin: { id: 'other' } }],
    ];
    for (const [status, response] of failures) {
      const result = execute(status, response);
      assert.equal(result.status, 2, `${JSON.stringify(response)}\n${result.stderr}`);
      assert.deepEqual(result.calls, ['plugins inspect tanaab --json']);
      assert.match(result.stderr, /could not inspect plugin tanaab|returned invalid JSON/u);
    }
  });
});
