import safeText from '../../command-report/utils/safe-text.js';
import serializeReport from '../../command-report/utils/serialize-report.js';
import { failureCode } from '../run.js';
import checkRuntime, { maintenanceBunRange } from './check-runtime.js';

const labels = {
  source: 'Check for source changes',
  dependencies: 'Install required dependencies',
  install: 'Apply agent configuration (Install)',
  doctor: 'Check agent health (Doctor)',
};
const states = {
  completed: 'Completed',
  skipped: 'Skipped',
  blocked: 'Blocked',
  running: 'Unverified',
  unattempted: 'Not attempted',
};
const early = new Set([
  'arguments-invalid',
  'runtime-unsupported',
  'backup-run-locked',
  'update-run-locked',
  'backup-lock-lost',
  'update-lock-lost',
  'private-directory-unsafe',
  'update-lock-unsafe',
  'verification-refused',
  'checkpoint-invalid',
]);
const revision = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40,64}$/u.test(value) ? value.slice(0, 12) : undefined;

const expectedSkip = (item) => item?.component === 'setup' && item?.code === 'setup-skipped';
const actionableWarnings = (step) =>
  Math.max(
    0,
    (Number.isSafeInteger(step?.warnings) ? step.warnings : 0) -
      (step?.warningDetails ?? []).filter(expectedSkip).length,
  );

/** Describe application facts; execution and delivery remain the shared runner's job. */
export default function formatUpdateReport({
  result,
  verification,
  failure,
  closeFailed = false,
  runtime,
  reportOnly = false,
}) {
  const selected = verification?.updateId === result?.id ? verification : undefined;
  const doctor = selected?.steps?.doctor ?? result?.steps?.doctor;
  const executed =
    ['source', 'dependencies', 'install'].every(
      (key) =>
        result?.steps?.[key]?.status === 'completed' &&
        (result.steps[key].exitCode === undefined || result.steps[key].exitCode === 0) &&
        !result.steps[key].processFailure,
    ) &&
    doctor?.status === 'completed' &&
    (doctor.exitCode === undefined || doctor.exitCode === 0) &&
    !doctor.processFailure &&
    !result?.pending &&
    (selected?.status ?? result?.status) === 'success';
  const reporting = [...(result?.steps?.install?.reporting ?? []), ...(doctor?.reporting ?? [])];
  const healthy = doctor?.health?.status === 'healthy' && !doctor?.reporting?.length;
  const verified = executed && healthy;
  const warned =
    actionableWarnings(result?.steps?.install) > 0 || (doctor?.health?.warnings ?? 0) > 0;
  const attention = Boolean(failure || closeFailed || !executed);
  const reason = failure ?? new Error(selected ? selected.reason : result?.reason);
  const code =
    !failure && !reason.message
      ? 'evidence-incomplete'
      : early.has(reason.message)
        ? reason.message
        : failureCode(reason);
  const commandFailed = (step) =>
    Boolean(step?.processFailure || (Number.isInteger(step?.exitCode) && step.exitCode !== 0));
  const failed =
    closeFailed ||
    Object.values(result?.steps ?? {})
      .filter((step) => step !== result?.steps?.doctor)
      .some(commandFailed) ||
    commandFailed(doctor) ||
    (Boolean(failure || (selected ? selected.reason : result?.reason)) &&
      ['command-failed', 'command-timeout', 'command-output-limit', 'deadline'].includes(code));
  const card = {
    id: 'update-agent',
    status: failed
      ? 'error'
      : attention || !verified || warned || reporting.length
        ? 'warning'
        : 'success',
    facts: [],
    findings: [],
    actions: [],
  };
  if (reportOnly)
    card.findings.push(
      'Retained report only; no update, health check or message delivery was performed.',
    );
  const rows = [];
  const before = revision(result?.before),
    after = revision(result?.after),
    target = revision(result?.target);
  card.facts.push({
    label: 'Source revision',
    value: after
      ? before === after
        ? `Unchanged ${after}`
        : `${before ?? 'Unknown'} → ${after}`
      : `Before ${before ?? 'unknown'}; after unknown${target ? `; target ${target} not verified as reached` : ''}`,
  });
  for (const key of Object.keys(labels)) {
    const step = key === 'doctor' ? doctor : result?.steps?.[key];
    let value = Object.hasOwn(states, step?.status) ? states[step.status] : 'Not attempted';
    if (step?.status === 'completed')
      value =
        key === 'install'
          ? 'Complete; setup skipped'
          : key === 'doctor'
            ? 'Command completed'
            : key === 'dependencies'
              ? 'Reconciled (frozen)'
              : value;
    if (key === 'doctor') {
      value += step?.health?.status
        ? `; Doctor status: ${step.health.status}`
        : '; health verification unavailable';
      if (step?.reporting?.length) value += '; health verification unavailable or incomplete';
    }
    if (Number.isInteger(step?.exitCode)) value += `; exit ${step.exitCode}`;
    if (step?.processFailure)
      value += `; process ${['signal', 'spawn', 'exit'].includes(step.processFailure.kind) ? step.processFailure.kind : 'failure'}${Number.isInteger(step.processFailure.exitCode) ? ` ${step.processFailure.exitCode}` : ''}${['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(step.processFailure.signal) ? ` ${step.processFailure.signal}` : ''}`;
    if (actionableWarnings(step) > 0) value += `; ${actionableWarnings(step)} warnings`;
    const complete = step?.status === 'completed' && !commandFailed(step);
    const needsAction =
      !complete ||
      Boolean(step?.reporting?.length) ||
      actionableWarnings(step) > 0 ||
      (key === 'doctor' && (!healthy || (step?.health?.warnings ?? 0) > 0));
    const status = commandFailed(step)
      ? '❌ Failed'
      : needsAction
        ? `⚠️ ${complete ? 'Needs attention' : Object.hasOwn(states, step?.status) ? states[step.status] : 'Not attempted'}`
        : `✅ ${key === 'source' ? (before === after ? 'Current' : 'Updated') : key === 'dependencies' ? 'Installed' : key === 'install' ? 'Aligned' : 'Healthy'}`;
    const detail =
      key === 'source'
        ? card.facts[0].value
        : key === 'dependencies' && complete
          ? 'Frozen dependencies installed; scripts disabled.'
          : key === 'install' && complete
            ? `Setup intentionally skipped.${actionableWarnings(step) > 0 ? ` ${actionableWarnings(step)} warnings.` : ''}${step.reporting?.length ? ' Install detail unavailable.' : ''}`
            : key === 'doctor' && complete && !needsAction
              ? 'No outstanding repairs.'
              : value;
    rows.push([
      key === 'source'
        ? 'Repository'
        : key === 'dependencies'
          ? 'Dependencies'
          : key === 'install'
            ? 'Install'
            : 'Doctor',
      status,
      detail,
    ]);
    for (const issue of step?.reporting ?? []) card.findings.push(issue);
    for (const item of [
      ...(step?.warningDetails ?? []).filter((item) => !expectedSkip(item)),
      ...(step?.health?.findings ?? []).filter((item) => item.status !== 'healthy'),
    ]) {
      if (item.remediation) card.actions.push(item.remediation);
      card.findings.push(
        `${item.component} / ${item.code}${item.status ? ` (${item.status})` : ''}: ${item.message}${item.remediation ? ` Next: ${item.remediation}` : ''}`,
      );
    }
    const omitted = (step?.warningsOmitted ?? 0) + (step?.health?.omitted ?? 0);
    if (omitted > 0)
      card.findings.push(`${omitted} lifecycle detail entries omitted from private evidence.`);
  }
  if (selected) {
    card.findings.push(
      'Latest verification checked the already-applied configuration; the original update attempt is unchanged.',
    );
    const original = result.steps?.doctor;
    card.facts.push({
      label: 'Original health check',
      value: `${Object.hasOwn(states, original?.status) ? states[original.status] : 'Unverified'}${original?.reason ? `; ${failureCode(new Error(original.reason))}` : ''}`,
    });
  }
  if (Object.hasOwn(labels, result?.pending))
    card.findings.push(
      `Uncertain: ${labels[result.pending]}; completed work has not been rolled back.`,
    );
  if (closeFailed) card.findings.push('Failed: exclusion descriptor close.');
  if (!result && !failure)
    card.actions.push('No retained update result. Inspect native run history before recovery.');
  if (attention) {
    card.actions.push(
      code === 'runtime-unsupported'
        ? `Use a stable Bun runtime matching ${maintenanceBunRange} for updates, then retry.`
        : code === 'arguments-invalid'
          ? 'Use no arguments, --verify-only, --report-only or --help.'
          : code.endsWith('-run-locked')
            ? 'Wait for the lock owner to finish; do not remove its lock.'
            : code === 'automation-execution-stale'
              ? 'Reconcile the changed configuration through Agent System Install, then verify loaded state.'
              : 'Inspect .private/update-agent/status.json and native run details before recovery; do not blindly replay uncertain mutations.',
    );
  } else if (warned && !card.actions.length)
    card.actions.push(
      'Inspect retained Install warnings and health findings before further recovery.',
    );
  if (!attention && (!verified || reporting.length) && !card.actions.length)
    card.actions.push(
      'Health verification or report detail is unavailable or needs attention. Inspect retained results; use verification-only recovery when eligible, without replaying Install.',
    );
  if (code === 'runtime-unsupported') {
    const facts = checkRuntime({ version: runtime?.version, executable: runtime?.executable });
    card.facts.push(
      { label: 'Actual Bun', value: facts.version },
      { label: 'Supported Bun', value: maintenanceBunRange },
    );
    if (facts.executable) card.facts.push({ label: 'Executable', value: facts.executable });
  }
  const cell = (text) =>
    safeText(text, 700)
      .replace(/[\r\n]+/gu, ' ')
      .replace(/[\\`*_{}[\]()<>|#!]/gu, '\\$&');
  const stamp = selected?.finishedAt ?? result?.finishedAt ?? result?.startedAt;
  const date =
    typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(stamp) ? new Date(stamp) : undefined;
  const dateLabel =
    date && Number.isFinite(date.getTime())
      ? date.toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Run date unavailable';
  const icon = card.status === 'success' ? '✅' : card.status === 'error' ? '❌' : '⚠️';
  const extra = card.facts.slice(1).map(({ label, value }) => `${label}: ${value}`);
  if (attention)
    rows.push([
      'Run',
      failed ? '❌ Failed' : '⚠️ Needs attention',
      closeFailed ? 'Exclusion descriptor close failed.' : `Reason: ${code}.`,
    ]);
  const body = [
    `## ${icon} UPDATE AGENT · ${card.status === 'success' ? 'RUN RESULTS' : card.status === 'error' ? 'RUN FAILED' : 'ACTION NEEDED'}`,
    `**Agent:** SMUTLORD · ${dateLabel}`,
    '| Step | Status | Result |\n|---|---|---|\n' +
      rows.map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n'),
    ...[...card.findings, ...extra].map((finding) => cell(finding)),
    `**Action needed:** ${card.actions.length ? card.actions.map(cell).join(' ') : card.status === 'success' ? 'None.' : 'No completed update evidence. Inspect retained results before recovery.'}`,
  ].join('\n\n');
  return {
    stdout: serializeReport([
      {
        id: card.id,
        format: 'markdown',
        body: body
          .split('\n')
          .map((line) => `> ${line}`.trimEnd())
          .join('\n'),
      },
    ]),
    stderr: attention
      ? `Agent update (${code})${closeFailed ? '; exclusion-close-failed' : ''}.\n`
      : '',
    exitCode: attention ? 1 : 0,
  };
}
