import assert from 'node:assert/strict';

import runUpdate from '../run.js';
import updateCommands from '../commands.js';
import formatUpdateReport from '../utils/format-update-report.js';

const oldRevision = 'a'.repeat(40);
const newRevision = 'b'.repeat(40);

function fixture({ equal = false, observation = {}, fail } = {}) {
  const calls = [];
  const checkout = {
    workspace: '/fixture/smutlord',
    canonical: true,
    dirty: false,
    branch: 'main',
    upstream: 'origin/main',
    remoteApproved: true,
    remote: 'approved',
    inProgress: false,
    fastForward: true,
    head: oldRevision,
    target: equal ? oldRevision : newRevision,
    ...observation,
  };
  const commands = Object.fromEntries(
    ['fetch', 'advance', 'dependencies', 'install', 'doctor'].map((name) => [
      name,
      async (...args) => {
        calls.push(name);
        if (fail === name) throw new Error('command-failed');
        if (name === 'advance') checkout.head = args[0];
      },
    ]),
  );
  commands.inspect = async () => ({ ...checkout });
  return {
    calls,
    checkout,
    commands,
    run: () =>
      runUpdate({
        workspace: '/fixture/smutlord',
        commands,
        now: () => 0,
        id: 'fixture-run',
      }),
  };
}

describe('lib/update-agent/run', () => {
  it('should advance only the observed revision then reconcile dependencies, Install and Doctor', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(result.status, 'success');
    assert.equal(result.before, oldRevision);
    assert.equal(result.after, newRevision);
    assert.deepEqual(f.calls, ['fetch', 'advance', 'dependencies', 'install', 'doctor']);
  });

  it('should reconcile unchanged eligible code without advancing', async () => {
    const f = fixture({ equal: true });
    const result = await f.run();
    assert.equal(result.status, 'success');
    assert.equal(result.steps.source.changed, false);
    assert.deepEqual(f.calls, ['fetch', 'dependencies', 'install', 'doctor']);
  });

  for (const [observation, reason] of [
    [{ workspace: '/fixture/other' }, 'unsupported-target'],
    [{ canonical: false }, 'unsupported-target'],
    [{ dirty: true }, 'dirty'],
    [{ dirty: undefined }, 'dirty'],
    [{ branch: 'task' }, 'non-main'],
    [{ branch: undefined }, 'detached'],
    [{ inProgress: true }, 'in-progress'],
    [{ upstream: undefined }, 'unsafe-upstream'],
    [{ remoteApproved: false }, 'unsafe-upstream'],
    [{ fastForward: false }, 'ahead-or-diverged'],
    [{ fastForward: undefined }, 'ahead-or-diverged'],
    [{ target: 'not-a-revision' }, 'unsafe-upstream'],
  ]) {
    it(`should preserve a skipped checkout (${reason}, ${JSON.stringify(observation)})`, async () => {
      const f = fixture({ observation });
      const result = await f.run();
      assert.equal(result.status, 'attention');
      assert.equal(result.reason, reason);
      assert.deepEqual(f.calls, []);
      assert.equal(result.steps.install.status, 'unattempted');
    });
  }

  it('should refuse changed observations immediately before fast-forward', async () => {
    const f = fixture();
    let inspections = 0;
    f.commands.inspect = async () => ({ ...f.checkout, dirty: ++inspections === 3 });
    const result = await f.run();
    assert.equal(result.reason, 'dirty');
    assert.deepEqual(f.calls, ['fetch']);
    assert.equal(f.checkout.head, oldRevision);
  });

  for (const readable of [true, false]) {
    it(`should report checkout refusal and all later skips with readable status: ${readable}`, async () => {
      const f = fixture();
      const gitCalls = [];
      const commands = updateCommands({
        workspace: f.checkout.workspace,
        environment: { AGENT_SYSTEM_GIT: '/bound/git' },
        stat: async () => {
          throw Object.assign(new Error(), { code: 'ENOENT' });
        },
        spawn: (_command, argv) => {
          gitCalls.push(argv[0]);
          if (argv[1] === '--show-toplevel') return { status: 0, stdout: f.checkout.workspace };
          if (argv[1] === '--absolute-git-dir')
            return { status: 0, stdout: `${f.checkout.workspace}/.git` };
          if (argv[0] === 'status')
            return readable
              ? {
                  status: 0,
                  stdout: `# branch.oid ${oldRevision}\n# branch.head main\n? private-filename\n`,
                }
              : { status: 128, stdout: '', stderr: 'private-diagnostic' };
          assert.deepEqual(argv, ['remote', 'get-url', 'origin']);
          return { status: 0, stdout: 'git@github.com:tanaabased/smutlord.git' };
        },
      });
      const result = await runUpdate({
        workspace: f.checkout.workspace,
        commands,
      });
      const report = formatUpdateReport({ result });
      const { body } = JSON.parse(report.stdout).cards[0];
      assert.equal(report.exitCode, 1);
      assert.match(
        body,
        readable
          ? /Repository \| ⚠️ Blocked \| .*Reason: dirty.*Checkout status: 1 changed path/
          : /Repository \| ❌ Failed \| .*exit 128.*Checkout status unavailable/,
      );
      for (const label of ['Dependencies', 'Install', 'Doctor'])
        assert.ok(body.includes(`| ${label} | ℹ️ Skipped | Skipped |`));
      assert.match(body, /git status --short.*Review any changes.*commit or move.*before retrying/);
      assert.doesNotMatch(body + JSON.stringify(result), /private-filename|private-diagnostic/);
      assert.deepEqual(gitCalls, [
        'rev-parse',
        'rev-parse',
        'status',
        ...(readable ? ['remote'] : []),
      ]);
    });
  }

  it('should retain the original revision and report an uncertain fast-forward failure', async () => {
    const f = fixture({ fail: 'advance' });
    const result = await f.run();
    assert.equal(result.status, 'attention');
    assert.equal(f.checkout.head, oldRevision);
    assert.deepEqual(f.calls, ['fetch', 'advance']);
  });

  for (const failed of ['dependencies', 'install', 'doctor']) {
    it(`should preserve completed source work after ${failed} fails`, async () => {
      const f = fixture({ fail: failed });
      const result = await f.run();
      assert.equal(result.status, 'attention');
      assert.equal(result.after, newRevision);
      assert.equal(result.steps.source.status, 'completed');
      assert.equal(f.checkout.head, newRevision);
      assert.equal(f.calls.at(-1), failed);
    });
  }

  it('should run independently without source-job markers or host readiness flags', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(result.status, 'success');
    assert.deepEqual(Object.keys(result.steps), ['source', 'dependencies', 'install', 'doctor']);
    assert.deepEqual(f.calls, ['fetch', 'advance', 'dependencies', 'install', 'doctor']);
    assert.equal(result.loaded, undefined);
  });

  it('should preserve native stale-manifest refusal without re-admission or rollback', async () => {
    const f = fixture();
    f.commands.install = async () => {
      throw new Error('automation-execution-stale');
    };
    const result = await f.run();
    assert.equal(result.reason, 'automation-execution-stale');
    assert.equal(result.after, newRevision);
    assert.equal(result.steps.doctor.status, 'unattempted');
  });

  it('should report Install warnings without exposing raw component details', async () => {
    const f = fixture();
    f.commands.install = async () => {
      throw Object.assign(new Error('command-failed'), {
        lifecycle: { completed: 3, skipped: 1, unattempted: 2, raw: 'secret' },
        warnings: 1,
      });
    };
    const result = await f.run();
    assert.equal(result.after, newRevision);
    assert.equal(result.steps.install.lifecycle, undefined);
    assert.equal(result.steps.doctor.status, 'unattempted');
    assert.ok(!JSON.stringify(result).includes('secret'));
    assert.equal(result.steps.install.warnings, 1);
  });

  it('should preserve failed unreadable Install execution and try again on the next invocation', async () => {
    const f = fixture();
    const commands = updateCommands({
      workspace: '/fixture/smutlord',
      environment: { AGENT_SYSTEM_GIT: '/bound/git' },
      spawn: () => ({ status: 9, stdout: 'private output', stderr: 'private diagnostic' }),
    });
    f.commands.install = commands.install;
    const result = await f.run();
    assert.equal(result.steps.source.status, 'completed');
    assert.equal(result.steps.dependencies.status, 'completed');
    assert.equal(result.steps.doctor.status, 'unattempted');
    assert.equal(result.steps.install.exitCode, 9);
    assert.equal(result.steps.install.processFailure.exitCode, 9);
    assert.deepEqual(result.steps.install.reporting, ['Install output unreadable.']);
    assert.doesNotMatch(JSON.stringify(result), /private/);
    const next = await f.run();
    assert.equal(next.steps.install.exitCode, 9);
    assert.equal(f.calls.filter((name) => name === 'dependencies').length, 2);
  });

  it('should stop before work when the total budget is exhausted', async () => {
    const f = fixture();
    let time = 0;
    const result = await runUpdate({
      ...f,
      workspace: '/fixture/smutlord',
      now: () => time++,
      budgetMs: 1,
    });
    assert.equal(result.reason, 'deadline');
    assert.deepEqual(f.calls, []);
  });

  it('should exclude arbitrary command messages from retained diagnostics', async () => {
    const f = fixture();
    f.commands.dependencies = async () => {
      throw new Error('secret-value-from-command');
    };
    const result = await f.run();
    assert.equal(result.reason, 'command-failed');
    assert.ok(!JSON.stringify(result).includes('secret-value-from-command'));
  });
});
