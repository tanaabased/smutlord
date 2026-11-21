import { randomUUID } from 'node:crypto';

const steps = ['source', 'dependencies', 'install', 'doctor'];
const codes = new Set([
  'unsupported-target',
  'dirty',
  'non-main',
  'detached',
  'unsafe-upstream',
  'in-progress',
  'ahead-or-diverged',
  'observation-changed',
  'deadline',
  'command-failed',
  'command-timeout',
  'command-output-limit',
  'doctor-unhealthy',
  'verification-refused',
  'command-output-invalid',
  'automation-execution-stale',
  'interrupted-run',
  'checkpoint-invalid',
]);

/** Never persist arbitrary exception text or subprocess output. */
export function failureCode(error) {
  return codes.has(error?.message) ? error.message : 'command-failed';
}

function eligibility(value, workspace) {
  if (value.workspace !== workspace || value.canonical !== true) return 'unsupported-target';
  if (value.dirty !== false) return 'dirty';
  if (!value.branch) return 'detached';
  if (value.branch !== 'main') return 'non-main';
  if (value.inProgress !== false) return 'in-progress';
  if (value.upstream !== 'origin/main' || value.remoteApproved !== true) return 'unsafe-upstream';
  if (value.fastForward !== true) return 'ahead-or-diverged';
  if (![value.head, value.target].every((sha) => /^[a-f0-9]{40}$/.test(sha)))
    return 'unsafe-upstream';
}

function unchanged(a, b) {
  return ['workspace', 'head', 'target', 'upstream', 'remote'].every((key) => a[key] === b[key]);
}

function assertEligible(observation, workspace, expectedHead) {
  const reason = eligibility(observation, workspace);
  if (!reason && (expectedHead === undefined || observation.head === expectedHead)) return;
  throw Object.assign(new Error(expectedHead === undefined ? reason : 'observation-changed'), {
    checkoutStatusEntries:
      reason === 'dirty' ? (observation.checkoutStatusEntries ?? null) : undefined,
  });
}

export default async function runUpdate({
  workspace,
  commands,
  now = Date.now,
  id = randomUUID(),
  budgetMs = 1_800_000,
}) {
  const started = now();
  const result = {
    version: 1,
    job: 'update-agent',
    id,
    workspace,
    startedAt: new Date(started).toISOString(),
    status: 'running',
    steps: Object.fromEntries(steps.map((step) => [step, { status: 'unattempted' }])),
  };
  let current = 'source';
  const guard = () => {
    if (now() - started >= budgetMs) throw new Error('deadline');
  };
  const step = async (name, operation) => {
    current = name;
    guard();
    result.steps[name] = { status: 'running' };
    const value = await operation(Math.max(1, budgetMs - (now() - started)));
    result.steps[name] = { status: 'completed', ...value };
  };
  try {
    await step('source', async (remaining) => {
      const before = await commands.inspect(remaining);
      assertEligible(before, workspace);
      result.before = before.head;
      guard();
      await commands.fetch(Math.max(1, budgetMs - (now() - started)));
      const fetched = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      assertEligible(fetched, workspace);
      if (before.head !== fetched.head || before.remote !== fetched.remote)
        throw new Error('observation-changed');
      guard();
      const checked = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      assertEligible(checked, workspace);
      if (!unchanged(fetched, checked)) throw new Error('observation-changed');
      result.target = checked.target;
      if (checked.head !== checked.target) {
        guard();
        await commands.advance(checked.target, Math.max(1, budgetMs - (now() - started)));
      }
      const after = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      assertEligible(after, workspace, checked.target);
      result.after = after.head;
      return { changed: checked.head !== checked.target };
    });
    await step('dependencies', async (remaining) => {
      await commands.dependencies(remaining);
      const after = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      assertEligible(after, workspace, result.after);
    });
    await step('install', async (remaining) => {
      const installed = await commands.install(remaining);
      return installed;
    });
    await step('doctor', async (remaining) => {
      return commands.doctor(remaining);
    });
    guard();
    result.status = 'success';
  } catch (error) {
    result.status = 'attention';
    result.reason = failureCode(error);
    result.steps[current] = { ...result.steps[current], status: 'blocked', reason: result.reason };
    if (error.health) result.steps[current].health = error.health;
    if (error.exitCode !== undefined) result.steps[current].exitCode = error.exitCode;
    if (error.reporting) result.steps[current].reporting = error.reporting;
    if (error.processFailure) result.steps[current].processFailure = error.processFailure;
    if (
      error.checkoutStatusEntries === null ||
      (Number.isSafeInteger(error.checkoutStatusEntries) && error.checkoutStatusEntries > 0)
    )
      result.steps[current].checkoutStatusEntries = error.checkoutStatusEntries;
    if (error.warningDetails) {
      result.steps[current].warningDetails = error.warningDetails;
      result.steps[current].warningsOmitted = error.warningsOmitted;
    }
    if (Number.isSafeInteger(error.warnings) && error.warnings >= 0)
      result.steps[current].warnings = error.warnings;
    if (
      [
        'unsupported-target',
        'dirty',
        'non-main',
        'detached',
        'unsafe-upstream',
        'in-progress',
        'ahead-or-diverged',
      ].includes(result.reason)
    )
      result.steps[current].status = 'skipped';
  }
  result.finishedAt = new Date(now()).toISOString();
  return result;
}
