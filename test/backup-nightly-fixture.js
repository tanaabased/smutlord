#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const mode = process.env.BACKUP_TEST_MODE;
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const folder = '1L21gQkLgTmCZ05UQqV9-zp5n0lp22EMH';
const output = join(process.cwd(), 'archives with spaces');
const name = `smutlord-2026-11-13T08-00-00-000Z-${process.env.BACKUP_TEST_UUID}.tar.gz`;
const nightly = name.replace('smutlord-', 'smutlord-nightly-');
appendFileSync('calls.jsonl', `${JSON.stringify([basename(process.argv[1]), ...args])}\n`);
const file = (id, day) => ({
  id,
  name: day ? nightly.replace('11-13T', `11-${day}T`) : nightly,
  parents: [folder],
  mimeType: 'application/gzip',
  ownedByMe: true,
  trashed: false,
});
if (args[0] === 'agent-system') {
  if (mode === 'create-failure') process.exit(1);
  if (mode === 'hold-create') {
    writeFileSync('ready', 'ready');
    const deadline = Date.now() + 5000;
    while (!existsSync('release')) {
      if (Date.now() > deadline) process.exit(5);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  writeFileSync(join(output, name), 'completed archive bytes');
  emit({
    status: 'created',
    agentId: 'smutlord',
    archive: join(output, name),
    settings: { output },
  });
} else if (args[1] === 'upload') {
  if (mode === 'upload-failure') process.exit(1);
  if (readFileSync(args[2], 'utf8') !== 'completed archive bytes') process.exit(2);
  if (basename(args[2]) !== nightly || args[4] !== nightly || args[6] !== folder) process.exit(3);
  emit(mode === 'upload-malformed' ? {} : { file: { id: 'current' } });
} else if (args[1] === 'get') {
  emit({
    file:
      args[2] === folder
        ? {
            id: folder,
            mimeType: 'application/vnd.google-apps.folder',
            capabilities: { canAddChildren: true },
            permissions: [{ type: mode === 'public-folder' ? 'anyone' : 'user' }],
          }
        : file(args[2], args[2].slice(3)),
  });
} else if (args[1] === 'ls') {
  const entries = [file('current')];
  if (['rotation', 'rotation-paged', 'list-cycle'].includes(mode)) {
    for (const day of ['01', '02', '03', '04', '05', '06']) entries.push(file(`old${day}`, day));
    entries.push({ ...file('manual'), name: 'manual.tar.gz' });
    entries.push({ ...file('invalid-date'), name: nightly.replace('11-13T', '02-31T') });
    entries.push({ ...file('foreign', '01'), ownedByMe: false });
    entries.push({ ...file('elsewhere', '01'), parents: ['another-folder'] });
  }
  const paged = mode === 'rotation-paged';
  const next = mode === 'list-cycle' || (paged && !args.includes('--page'));
  emit({
    files:
      mode === 'list-malformed'
        ? null
        : paged
          ? next
            ? entries.slice(0, 4)
            : entries.slice(4)
          : entries,
    has_more: next,
    nextPageToken: next ? 'next' : '',
    incompleteSearch: mode === 'list-incomplete',
  });
} else if (args[1] !== 'delete') {
  process.exit(4);
}
