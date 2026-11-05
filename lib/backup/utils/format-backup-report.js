import safeFailure from './safe-failure.js';
import safeText from '../../command-report/utils/safe-text.js';
import serializeReport from '../../command-report/utils/serialize-report.js';

const codes = new Set([
  'agent-binding-required',
  'archive-changed',
  'archive-name-invalid',
  'archive-outside-backups',
  'archive-unsafe',
  'arguments-invalid',
  'backup-capture-invalid',
  'backup-create-failed',
  'backup-lock-lost',
  'backup-lock-required',
  'backup-lock-unsafe',
  'backup-preflight-failed',
  'backup-retained-verification-failed',
  'backup-run-locked',
  'capture-not-fresh',
  'delivery-record-invalid',
  'drive-folder-unsafe',
  'drive-list-duplicates',
  'drive-list-incomplete',
  'drive-list-limit',
  'duplicate-remote-archive',
  'journal-unsafe',
  'legacy-backup-lock',
  'legacy-receipt-invalid',
  'local-prune-failed',
  'managed-command-failed',
  'managed-output-invalid',
  'private-directory-unsafe',
  'receipt-conflict',
  'remote-delete-unverified',
  'remote-integrity-failed',
  'remote-retention-current-missing',
  'remote-retention-unsafe',
  'retention-preview-invalid',
  'storage-name-invalid',
  'upload-outcome-unknown',
]);
const stages = new Set([
  'preflight',
  'create',
  'delivery-record',
  'upload',
  'remote-check',
  'cleanup',
]);
const next =
  'Inspect .private/backup-drive/delivery-status.json and delivery.json before recovery; legacy journal.json is preserved.';

function diagnostic(value) {
  if (!value) return '';
  const { diagnostic: clean } = safeFailure({ diagnostic: value });
  const details = [
    ...(Number.isInteger(clean.exitCode) ? [`child exit ${clean.exitCode}`] : []),
    ...(clean.signal ? [`signal ${clean.signal}`] : []),
    ...(clean.timedOut ? ['timed out'] : []),
    ...(clean.code ? [clean.code] : []),
    ...(clean.upstreamCode ? [clean.upstreamCode] : []),
  ];
  return details.length ? ` (${details.join('; ')})` : '';
}

/** Adapt EMORI's report to SMUTLORD results; partial cleanup has no split telemetry. */
export default function formatBackupReport({
  result,
  failure,
  closeFailed = false,
  resumed = false,
}) {
  const confirmed =
    result?.agentId === 'smutlord' &&
    ['completed', 'piloted'].includes(result.status) &&
    result.delivered === true;
  const retained = confirmed && result.status === 'completed' && result.retention === 'completed';
  const pilot = confirmed && result.status === 'piloted' && result.retention === 'skipped';
  const locked = failure?.message === 'backup-run-locked';
  const code = codes.has(failure?.message ?? result?.code)
    ? (failure?.message ?? result.code)
    : 'task-failed';
  const stage = stages.has(result?.stage) ? ` at ${result.stage}` : '';
  const details = diagnostic(failure?.diagnostic ?? result?.diagnostic);
  const card = {
    id: 'backup-agent-nightly',
    title: 'Backup agent nightly',
    status:
      failure || closeFailed || result?.status === 'failed'
        ? 'error'
        : retained
          ? 'success'
          : confirmed
            ? 'warning'
            : 'unknown',
    summary: confirmed
      ? `Archive delivered to Drive and verified; ${retained ? 'retention complete' : pilot ? 'pilot intentionally skipped retention' : 'cleanup incomplete'}.`
      : 'Archive creation and Drive delivery are not confirmed by this wrapper.',
    facts: [
      {
        label: 'Archive',
        value: confirmed
          ? resumed
            ? 'Existing archive verified and reused'
            : 'Created and verified'
          : 'Unconfirmed',
      },
      { label: 'Drive delivery', value: confirmed ? 'Verified' : 'Unconfirmed' },
      {
        label: 'Retention',
        value: retained
          ? 'Complete (combined result)'
          : pilot
            ? 'Intentionally skipped for pilot'
            : 'Pending; cleanup may be incomplete',
      },
      ...['Drive retention', 'Local retention'].map((label) => ({
        label,
        value: retained
          ? 'Complete (combined result)'
          : pilot
            ? 'Skipped for pilot'
            : 'Not separately recorded',
      })),
    ],
    findings: [],
    actions: [],
  };
  if (retained) {
    for (const [key, label] of [
      ['localKept', 'Local archives kept'],
      ['remoteKept', 'Drive archives kept'],
      ['remoteDeleted', 'Drive archives removed'],
    ]) {
      if (Number.isSafeInteger(result[key]) && result[key] >= 0)
        card.facts.push({ label, value: String(result[key]) });
    }
  }
  if (failure || (confirmed && !retained && !pilot))
    card.findings.push(`Reason${stage}: ${code}${details}.`);
  if (locked) card.findings.push('Skipped: this backup execution; another run holds the lock.');
  if (confirmed && !retained && !pilot)
    card.findings.push('Cleanup may be incomplete; local archives may accumulate.');
  if (closeFailed) card.findings.push('Failed: backup lock descriptor close.');
  if (failure || closeFailed || !retained)
    card.actions.push(locked ? 'Wait for the lock owner to finish; do not remove its lock.' : next);
  let stderr = '';
  if (failure || (confirmed && !retained && !pilot))
    stderr = `Backup ${failure ? 'task failed' : 'retention deferred'}${stage} (${code})${details}; ${next}\n`;
  if (closeFailed) stderr += 'Backup lock descriptor close failed.\n';
  return { stdout: serializeReport([card]), stderr: safeText(stderr, 4096) + (stderr ? '\n' : '') };
}
