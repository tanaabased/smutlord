import { join } from 'node:path';

import checkDriveFile from './utils/check-drive-file.js';
import jobFileStamp from './utils/job-file-stamp.js';

const requireResult = (condition, code) => {
  if (!condition) throw new Error(code);
};

/** Nothing here is a prerequisite for delivery. Stop at the first uncertain cleanup result. */
export default async function cleanupDelivery({
  commands,
  workspace,
  archive,
  getFile,
  list,
  folder,
  recordCleanup,
}) {
  const output = join(workspace, '.agent-system', 'backups');
  const plan = await commands.backup(['prune', '--keep', '5', '--dry-run']);
  const contained = (path) =>
    typeof path === 'string' &&
    path.startsWith(`${output}/smutlord-`) &&
    !path.slice(output.length + 1).includes('/') &&
    path.endsWith('.tar.gz');
  requireResult(
    plan?.status === 'preview' &&
      plan.agentId === 'smutlord' &&
      plan.keep === 5 &&
      plan.output === output &&
      Array.isArray(plan.kept) &&
      plan.kept.length > 0 &&
      plan.kept.length <= 5 &&
      plan.kept.includes(archive.path) &&
      plan.kept.every(contained) &&
      Array.isArray(plan.wouldDelete) &&
      plan.wouldDelete.every(contained) &&
      new Set([...plan.kept, ...plan.wouldDelete]).size ===
        plan.kept.length + plan.wouldDelete.length,
    'retention-preview-invalid',
  );

  const owned = [];
  for (const entry of await list()) {
    const stamp = jobFileStamp(entry.name);
    if (!stamp) continue;
    const file = await getFile(entry.id);
    // A matching name alone is never ownership or permission to delete.
    if (file?.ownedByMe !== true) continue;
    requireResult(
      file.id === entry.id &&
        file.name === entry.name &&
        /^[a-f0-9]{64}$/.test(file.sha256Checksum) &&
        /^[a-f0-9]{32}$/.test(file.md5Checksum) &&
        /^[1-9][0-9]*$/.test(String(file.size)) &&
        checkDriveFile(
          file,
          { name: entry.name, size: file.size, sha256: file.sha256Checksum, md5: file.md5Checksum },
          folder,
        ),
      'remote-retention-unsafe',
    );
    owned.push({ ...file, stamp });
  }
  owned.sort((a, b) => b.stamp.localeCompare(a.stamp) || a.name.localeCompare(b.name));
  const current = owned.find((file) => file.id === archive.remoteId);
  // Explicitly resumed legacy uploads are preserved, never adopted into automatic cleanup.
  requireResult(current || !jobFileStamp(archive.name), 'remote-retention-current-missing');
  const keep = new Set([
    ...(current ? [current.id] : []),
    ...owned
      .filter((file) => file.id !== current?.id)
      .slice(0, current ? 4 : 5)
      .map((file) => file.id),
  ]);
  let remoteDeleted = 0;
  for (const file of owned.filter((file) => !keep.has(file.id))) {
    const fresh = await getFile(file.id);
    requireResult(
      fresh?.id === file.id &&
        checkDriveFile(
          fresh,
          { name: file.name, size: file.size, sha256: file.sha256Checksum, md5: file.md5Checksum },
          folder,
        ),
      'remote-integrity-failed',
    );
    await recordCleanup({ remoteDeleted, pendingRemoteId: file.id });
    await commands.drive(['drive', 'delete', file.id, '--force']);
    const trashed = await getFile(file.id);
    requireResult(trashed?.id === file.id && trashed.trashed === true, 'remote-delete-unverified');
    remoteDeleted++;
    await recordCleanup({ remoteDeleted });
  }
  await recordCleanup({ remoteDeleted, local: 'pending' });
  const result = await commands.backup(['prune', '--keep', '5']);
  requireResult(
    result?.status === 'pruned' &&
      result.agentId === 'smutlord' &&
      result.keep === 5 &&
      result.output === output &&
      Array.isArray(result.kept),
    'local-prune-failed',
  );
  await recordCleanup({ remoteDeleted, local: 'completed' });
  return {
    retention: 'completed',
    localKept: result.kept.length,
    remoteKept: keep.size,
    remoteDeleted,
  };
}
