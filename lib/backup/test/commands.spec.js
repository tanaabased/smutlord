import assert from 'node:assert/strict';

import backupCommands from '../commands.js';

function fixture(result, { operator = false } = {}) {
  const calls = [];
  let held = 0;
  const commands = backupCommands({
    workspace: '/workspace',
    operator,
    environment: { AGENT_SYSTEM_GOG: '/managed/gog' },
    storage: {
      lockFd: 9,
      assertHeld: async () => {
        held++;
      },
    },
    spawn: (command, argv, options) => {
      calls.push({ command, argv, options });
      return result;
    },
  });
  return { commands, calls, held: () => held };
}

describe('lib/backup/commands', () => {
  it('should retain strict managed routes, held descriptor and bounded execution', async () => {
    const p = fixture({ status: 0, stdout: '{"status":"preview"}' });
    assert.equal((await p.commands.backup(['create', '--dry-run'])).status, 'preview');
    await p.commands.drive(['drive', 'get', 'folder']);
    assert.equal(p.calls[0].command, 'openclaw');
    assert.deepEqual(p.calls[0].argv, ['agent-system', 'backup', 'create', '--dry-run', '--json']);
    assert.equal(p.calls[1].command, '/managed/gog');
    assert.equal(p.calls[0].options.stdio[3], 9);
    assert(p.calls[0].options.maxBuffer <= 4 * 1024 * 1024);
    assert.equal(p.calls[0].options.timeout, 600_000);
    assert.equal(p.held(), 4);
  });

  it('should use the explicit managed operator route without host credentials', async () => {
    const p = fixture({ status: 0, stdout: '{}' }, { operator: true });
    await p.commands.drive(['drive', 'get', 'folder']);
    assert.deepEqual(p.calls[0].argv, [
      'agent-system',
      'tool',
      'gog',
      '--',
      'drive',
      'get',
      'folder',
    ]);
  });

  for (const result of [
    {
      status: 7,
      stdout:
        '{"status":"failed","diagnostics":[{"code":"backup-retained-verification-failed","message":"token=secret-value /private/path"}]}',
      stderr: 'Authorization: Bearer secret-value',
    },
    {
      status: null,
      signal: 'SIGKILL',
      error: { code: 'ETIMEDOUT', message: 'secret-value' },
      stdout: '',
    },
    { status: null, signal: 'SIGTERM', stdout: '', stderr: '/private/path secret-value' },
    { status: null, error: { code: 'ENOBUFS' }, stdout: 'secret-value'.repeat(10000) },
    { status: 0, stdout: 'not JSON secret-value /private/path' },
    { status: 1, stdout: '{"code":"token-secret-value","access_token":"secret-value"}' },
  ]) {
    it('should expose safe failure codes and exit metadata, never raw subprocess output', async () => {
      const p = fixture(result);
      await assert.rejects(p.commands.backup(['prune', '--keep', '5']), (error) => {
        assert.equal(
          error.message,
          result.status === 0 ? 'managed-output-invalid' : 'managed-command-failed',
        );
        assert.equal(error.diagnostic.exitCode, result.status);
        assert.equal(error.diagnostic.signal, result.signal ?? null);
        assert.equal(error.diagnostic.timedOut, result.error?.code === 'ETIMEDOUT');
        if (result.status === 7)
          assert.equal(error.diagnostic.upstreamCode, 'backup-retained-verification-failed');
        assert.doesNotMatch(
          JSON.stringify(error.diagnostic),
          /secret-value|private\/path|Bearer|access_token/,
        );
        return true;
      });
    });
  }
});
