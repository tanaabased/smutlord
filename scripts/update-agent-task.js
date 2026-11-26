#!/usr/bin/env bun
// keep previously installed schedules working until manifest is reapplied.
import { fileURLToPath } from 'node:url';

import { spawn } from 'bun';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write(
    'Agent update: bun scripts/update-agent-task.js [--help]\nReports use the Agent System structured JSON document.\n',
  );
  process.exit(0);
}
if (args.length) {
  process.stderr.write('Unexpected arguments. Use --help.\n');
  process.exit(1);
}

const script = fileURLToPath(new URL('./update-agent.sh', import.meta.url));
const child = spawn(['bash', script], { stdout: 'inherit', stderr: 'inherit' });
process.once('SIGTERM', () => child.kill('SIGTERM'));
process.once('SIGINT', () => child.kill('SIGINT'));
process.exitCode = await child.exited;
