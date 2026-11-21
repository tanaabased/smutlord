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
const early = new Set(['arguments-invalid', 'runtime-unsupported']);
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
export default function formatUpdateReport({ result, failure, runtime }) {
  const doctor = result?.steps?.doctor;
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
    result?.status === 'success';
  const reporting = [...(result?.steps?.install?.reporting ?? []), ...(doctor?.reporting ?? [])];
  const healthy = doctor?.health?.status === 'healthy' && !doctor?.reporting?.length;
  const verified = executed && healthy;
  const warned =
    actionableWarnings(result?.steps?.install) > 0 || (doctor?.health?.warnings ?? 0) > 0;
  const attention = Boolean(failure || !executed);
  const reason = failure ?? new Error(result?.reason);
  const code =
    !failure && !reason.message
      ? 'evidence-incomplete'
      : early.has(reason.message)
        ? reason.message
        : failureCode(reason);
  const commandFailed = (step) =>
    Boolean(step?.processFailure || (Number.isInteger(step?.exitCode) && step.exitCode !== 0));
  const failed =
    Object.values(result?.steps ?? {})
      .filter((step) => step !== result?.steps?.doctor)
      .some(commandFailed) ||
    commandFailed(doctor) ||
    (Boolean(failure || result?.reason) &&
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
    const label = {
      source: 'Repository',
      dependencies: 'Dependencies',
      install: 'Install',
      doctor: 'Doctor',
    }[key];
    const stopReason =
      step?.reason ?? (key === 'source' && step?.status === 'skipped' ? result?.reason : undefined);
    if ((!step || ['unattempted', 'skipped'].includes(step.status)) && !stopReason) {
      rows.push([label, 'ℹ️ Skipped', 'Skipped']);
      continue;
    }
    const state = step.status === 'skipped' && stopReason ? 'blocked' : step.status;
    let value = Object.hasOwn(states, state) ? states[state] : 'Not attempted';
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
      : key === 'doctor' && step.health?.status === 'drift'
        ? '⚠️ Drift detected'
        : needsAction
          ? `⚠️ ${complete ? 'Needs attention' : Object.hasOwn(states, state) ? states[state] : 'Not attempted'}`
          : `✅ ${key === 'source' ? (before === after ? 'Current' : 'Updated') : key === 'dependencies' ? 'Installed' : key === 'install' ? 'Aligned' : 'Healthy'}`;
    const detail =
      key === 'source' && !stopReason && complete
        ? card.facts[0].value
        : key === 'dependencies' && complete
          ? 'Frozen dependencies installed; scripts disabled.'
          : key === 'install' && complete
            ? `Setup intentionally skipped.${actionableWarnings(step) > 0 ? ` ${actionableWarnings(step)} warnings.` : ''}${step.reporting?.length ? ' Install detail unavailable.' : ''}`
            : key === 'doctor' && complete && !needsAction
              ? 'No outstanding repairs.'
              : value;
    const entries = step.checkoutStatusEntries;
    const countAvailable = Number.isSafeInteger(entries) && entries > 0;
    const checkoutIssue = stopReason === 'dirty' || entries === null || countAvailable;
    if (checkoutIssue)
      card.actions.push(
        'Run git status --short in your agent workspace checkout. Review any changes, then commit or move them as appropriate before retrying.',
      );
    rows.push([
      label,
      status,
      [
        detail,
        stopReason && `Reason: ${failureCode(new Error(stopReason))}.`,
        key === 'source' && !complete && (before || after || target) && card.facts[0].value,
        checkoutIssue &&
          (countAvailable
            ? `Checkout status: ${entries} changed path entries.`
            : 'Checkout status unavailable.'),
      ]
        .filter(Boolean)
        .join(' '),
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
  if (attention) {
    card.actions.push(
      code === 'runtime-unsupported'
        ? `Use a stable Bun runtime matching ${maintenanceBunRange} for updates, then retry.`
        : code === 'arguments-invalid'
          ? 'Use no arguments or --help.'
          : code === 'automation-execution-stale'
            ? 'Reconcile the changed configuration through Agent System Install, then verify loaded state.'
            : 'Review the failed step and runner output.',
    );
  } else if (warned && !card.actions.length)
    card.actions.push('Inspect Install warnings and health findings.');
  if (!attention && (!verified || reporting.length) && !card.actions.length)
    card.actions.push('Inspect health findings or runner output for missing details.');
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
  const stamp = result?.finishedAt ?? result?.startedAt;
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
    rows.push(['Run', failed ? '❌ Failed' : '⚠️ Needs attention', `Reason: ${code}.`]);
  const body = [
    `## ${icon} UPDATE AGENT · ${card.status === 'success' ? 'RUN RESULTS' : card.status === 'error' ? 'RUN FAILED' : 'ACTION NEEDED'}`,
    `**Agent:** SMUTLORD · ${dateLabel}`,
    '| Step | Status | Result |\n|---|---|---|\n' +
      rows.map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n'),
    ...[...card.findings, ...extra].map((finding) => cell(finding)),
    `**Action needed:** ${card.actions.length ? card.actions.map(cell).join(' ') : card.status === 'success' ? 'None.' : 'Inspect this run’s results above.'}`,
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
    stderr: attention ? `Agent update (${code}).\n` : '',
    exitCode: attention ? 1 : 0,
  };
}
