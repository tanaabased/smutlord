import assert from 'node:assert/strict';

import formatUpdateReport from '../utils/format-update-report.js';

const complete = {
  id: 'original',
  status: 'success',
  finishedAt: '2026-11-17T12:00:00Z',
  before: 'a'.repeat(40),
  after: 'b'.repeat(40),
  steps: Object.fromEntries(
    ['source', 'dependencies', 'install', 'doctor'].map((key) => [
      key,
      {
        status: 'completed',
        ...(key === 'doctor' ? { health: { status: 'healthy', findings: [] } } : {}),
      },
    ]),
  ),
};
const body = (report) => {
  const document = JSON.parse(report.stdout);
  assert.equal(document.cards.length, 1);
  assert.equal(document.cards[0].format, 'markdown');
  return document.cards[0].body;
};
const changed = (steps, extra = {}) => ({
  ...complete,
  ...extra,
  steps: { ...complete.steps, ...steps },
});

describe('lib/update-agent/utils/format-update-report', () => {
  it('should render one compact green card from completed evidence, including expected setup skipping', () => {
    const report = formatUpdateReport({
      result: changed({
        install: {
          status: 'completed',
          warnings: 1,
          warningDetails: [
            { component: 'setup', code: 'setup-skipped', message: 'Setup skipped.' },
          ],
        },
      }),
    });
    assert.equal(report.exitCode, 0);
    const text = body(report);
    assert.match(text, /✅ UPDATE AGENT · RUN RESULTS/);
    assert.match(text, /SMUTLORD · November 17, 2026/);
    assert.match(text, /Step \| Status \| Result/);
    assert.match(text, /Repository \| ✅ Updated \| aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.match(text, /Install \| ✅ Aligned \| Setup intentionally skipped/);
    assert.match(text, /Doctor \| ✅ Healthy/);
    assert.match(text, /Action needed:\*\* None/);
    assert.doesNotMatch(text, /⚠️|❌|Gateway|activated|Lockfile unchanged/);
    const current = body(formatUpdateReport({ result: { ...complete, after: complete.before } }));
    assert.match(current, /Repository \| ✅ Current/);
  });
  it('should show unresolved health and actionable warnings yellow with remediation', () => {
    for (const health of [
      undefined,
      { status: 'unknown' },
      {
        status: 'drift',
        findings: [
          {
            component: 'backup',
            code: 'schedule',
            status: 'drift',
            message: 'Schedule differs',
            remediation: 'Apply declared schedule',
          },
        ],
      },
    ]) {
      const report = formatUpdateReport({
        result: changed({ doctor: { status: 'completed', exitCode: 0, health } }),
      });
      assert.equal(report.exitCode, 0);
      assert.match(body(report), /⚠️ UPDATE AGENT · ACTION NEEDED/);
      assert.match(body(report), /Doctor \| ⚠️/);
      assert.doesNotMatch(body(report), /Doctor \| ✅ Healthy|Action needed:\*\* None/);
      if (health?.status === 'drift') {
        assert.match(body(report), /Doctor \| ⚠️ Drift detected/);
        assert.match(body(report), /Apply declared schedule/);
      }
    }
    const warning = body(
      formatUpdateReport({
        result: changed({
          install: {
            status: 'completed',
            warnings: 2,
            warningDetails: [{ component: 'fixture', code: 'manual', message: 'Inspect fixture' }],
          },
        }),
      }),
    );
    assert.match(warning, /⚠️ UPDATE AGENT/);
    assert.match(warning, /2 warnings/);
    assert.match(warning, /Inspect fixture/);
  });
  it('should keep refusals yellow and command or close failures red without changing exit semantics', () => {
    const refusal = formatUpdateReport({
      result: changed({ source: { status: 'skipped' } }, { status: 'attention', reason: 'dirty' }),
    });
    assert.equal(refusal.exitCode, 1);
    assert.match(body(refusal), /⚠️ UPDATE AGENT/);
    for (const input of [
      { result: changed({ install: { status: 'completed', exitCode: 2 } }) },
      {
        result: changed({
          doctor: {
            status: 'blocked',
            processFailure: { kind: 'exit', exitCode: 1 },
            health: { status: 'healthy' },
          },
        }),
      },
      { result: complete, closeFailed: true },
      { failure: new Error('command-timeout') },
    ]) {
      const report = formatUpdateReport(input);
      assert.equal(report.exitCode, 1);
      assert.match(body(report), /❌ UPDATE AGENT · RUN FAILED/);
      assert.match(body(report), /\| ❌ Failed \|/);
      assert.doesNotMatch(body(report), /Action needed:\*\* None/);
    }
  });
  it('should preserve interrupted targets and original attempts after linked recovery', () => {
    const interrupted = formatUpdateReport({
      result: {
        status: 'attention',
        reason: 'interrupted-run',
        pending: 'source',
        before: complete.before,
        target: complete.after,
        steps: { source: { status: 'running' } },
      },
    });
    assert.equal(interrupted.exitCode, 1);
    assert.match(body(interrupted), /after unknown; target bbbbbbbbbbbb not verified/);
    assert.match(body(interrupted), /Uncertain/);
    assert.doesNotMatch(body(interrupted), /→|✅ Healthy/);
    assert.match(body(interrupted), /Doctor \| — Not run/);
    const recovered = formatUpdateReport({
      result: changed(
        { doctor: { status: 'blocked', reason: 'doctor-unhealthy' } },
        { status: 'attention', reason: 'command-failed' },
      ),
      verification: {
        updateId: 'original',
        status: 'success',
        steps: { doctor: complete.steps.doctor },
      },
      reportOnly: true,
    });
    assert.equal(recovered.exitCode, 0);
    assert.match(body(recovered), /✅ UPDATE AGENT/);
    assert.match(body(recovered), /original update attempt is unchanged/);
    assert.match(body(recovered), /Original health check: Blocked; doctor-unhealthy/);
    assert.match(body(recovered), /no update, health check or message delivery/);
  });
  it('should sanitize and escape every interpolated field without inventing dates or health', () => {
    const report = formatUpdateReport({
      result: changed(
        {
          doctor: {
            status: 'completed',
            reporting: ['Unavailable | [click](https://bad.test)\n> forged'],
            health: { status: 'healthy' },
          },
        },
        { finishedAt: 'bad', before: 'github_pat_private' },
      ),
      runtime: { version: 'secret' },
      failure: new Error('arbitrary private exception'),
    });
    const text = body(report);
    assert.match(text, /Run date unavailable/);
    assert.doesNotMatch(text, /github_pat|arbitrary private exception|Doctor \| ✅ Healthy/);
    assert(text.includes('Unavailable \\| \\[click\\]'));
  });
});
