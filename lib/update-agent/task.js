import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import checkRuntime from './utils/check-runtime.js';
import formatUpdateReport from './utils/format-update-report.js';
import updateCommands from './commands.js';
import runUpdate from './run.js';

/** Run update commands and report this invocation. */
export default async function runUpdateTask({
  argv = [],
  cwd,
  runtimeVersion = process.versions.bun,
  runtimeExecutable = process.execPath,
  stdout = process.stdout,
  stderr = process.stderr,
  canonicalize = realpath,
  commands = updateCommands,
  run = runUpdate,
}) {
  if (argv.length === 1 && argv[0] === '--help') {
    stdout.write(
      'Agent update: bun scripts/update-agent-task.js [--help]\nReports use the Agent System structured JSON document.\n',
    );
    return 0;
  }
  const runtime = checkRuntime({ version: runtimeVersion, executable: runtimeExecutable });
  let result;
  let failure;
  try {
    if (argv.length) throw new Error('arguments-invalid');
    if (!runtime.supported) throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    if (workspace !== (await canonicalize(fileURLToPath(new URL('../../', import.meta.url)))))
      throw new Error('unsupported-target');
    result = await run({ workspace, commands: commands({ workspace }) });
  } catch (error) {
    failure = error;
  }
  const rendered = formatUpdateReport({
    result,
    failure,
    runtime,
  });
  stdout.write(rendered.stdout);
  if (rendered.stderr) stderr.write(rendered.stderr);
  return rendered.exitCode;
}
