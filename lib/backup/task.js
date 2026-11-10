import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import backupCommands from './commands.js';
import formatBackupReport from './utils/format-backup-report.js';
import openStorage from './storage.js';
import runBackupDrive from './drive-task.js';

/** Execute once; reporting failure must never replay maintenance or change default JSON. */
export default async function runBackupTask({
  argv = [],
  cwd,
  stdout = process.stdout,
  stderr = process.stderr,
  canonicalize = realpath,
  open = openStorage,
  commands = backupCommands,
  run = runBackupDrive,
  format = formatBackupReport,
}) {
  const args = [...argv];
  const report = args[0] === '--report';
  if (report) args.shift();
  let storage;
  let result;
  let failure;
  let closeFailed = false;
  let resumeArchive;
  try {
    const operator = args[0] === '--operator';
    if (operator) args.shift();
    const pilot = args[0] === '--pilot';
    if (pilot) args.shift();
    if (pilot && !operator) throw new Error('arguments-invalid');
    resumeArchive =
      args[0] === '--resume-archive' && args.length === 2 ? resolve(cwd, args[1]) : undefined;
    if (args.length && (!operator || !resumeArchive)) throw new Error('arguments-invalid');
    const workspace = await canonicalize(cwd);
    storage = await open(workspace);
    const boundCommands = commands({ workspace, operator, storage });
    result = await run({ workspace, commands: boundCommands, storage, resumeArchive, pilot });
    if (!report) stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await storage?.close();
    } catch {
      closeFailed = true;
    }
  }
  const exitCode = failure || closeFailed ? 1 : 0;
  if (!report) {
    if (failure) {
      const code = /^[a-z][a-z0-9-]{1,80}$/.test(failure.message) ? failure.message : 'task-failed';
      stderr.write(
        `Backup Drive task failed (${code}); inspect .private/backup-drive/delivery-status.json and delivery.json (legacy journal.json is preserved).\n`,
      );
    }
    if (closeFailed) stderr.write('Backup lock descriptor close failed.\n');
    return exitCode;
  }
  try {
    const rendered = format({ result, failure, closeFailed, resumed: Boolean(resumeArchive) });
    stdout.write(rendered.stdout);
    if (rendered.stderr) stderr.write(rendered.stderr);
    return exitCode;
  } catch {
    stderr.write(
      `Backup report unavailable; command outcome ${failure ? 'failed' : result ? 'returned' : 'unknown'}${closeFailed ? '; lock descriptor close failed' : ''}. Do not repeat backup to resend report; inspect retained run evidence.\n`,
    );
    return 1;
  }
}
