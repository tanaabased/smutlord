import { spawnSync } from 'node:child_process';

import safeFailure from './utils/safe-failure.js';

/** Use only the strict bound launcher, or the operator's explicit managed CLI mode. */
export default function backupCommands({
  workspace,
  operator,
  storage,
  environment = process.env,
  spawn = spawnSync,
}) {
  if (!operator && !environment.AGENT_SYSTEM_GOG) throw new Error('agent-binding-required');
  if (!Number.isInteger(storage?.lockFd) || storage.lockFd < 0)
    throw new Error('backup-lock-required');
  const execute = async (command, argv) => {
    await storage.assertHeld();
    const result = spawn(command, argv, {
      cwd: workspace,
      env: environment,
      encoding: 'utf8',
      // Keep the same flock alive if the wrapper is killed while this command runs.
      stdio: ['ignore', 'pipe', 'pipe', storage.lockFd],
      maxBuffer: 4 * 1024 * 1024,
      timeout: 600_000,
      killSignal: 'SIGKILL',
    });
    const failure = (code) => {
      let upstream;
      try {
        upstream = JSON.parse(result.stdout);
      } catch {
        /* No raw output in diagnostics. */
      }
      const error = new Error(code);
      error.diagnostic = safeFailure({
        diagnostic: {
          exitCode: result.status,
          signal: result.signal,
          timedOut: result.error?.code === 'ETIMEDOUT',
          code: result.error?.code,
          upstreamCode: upstream?.code ?? upstream?.error?.code ?? upstream?.diagnostics?.[0]?.code,
        },
      }).diagnostic;
      return error;
    };
    if (result.error || result.status !== 0 || result.signal)
      throw failure('managed-command-failed');
    await storage.assertHeld();
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw failure('managed-output-invalid');
    }
  };
  return {
    backup: (argv) => execute('openclaw', ['agent-system', 'backup', ...argv, '--json']),
    drive: (argv) =>
      operator
        ? execute('openclaw', ['agent-system', 'tool', 'gog', '--', ...argv])
        : execute(environment.AGENT_SYSTEM_GOG, argv),
  };
}
