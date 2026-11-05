import assert from 'node:assert/strict';

import formatBackupReport from '../utils/format-backup-report.js';

const completed = {
  agentId: 'smutlord',
  status: 'completed',
  delivered: true,
  retention: 'completed',
};
const cardFor = (options) => JSON.parse(formatBackupReport(options).stdout).cards[0];
const fact = (card, label) => card.facts.find((item) => item.label === label).value;

describe('lib/backup/utils/format-backup-report', () => {
  it('should report verified creation and combined retention without inventing archive metadata', () => {
    const card = cardFor({
      result: { ...completed, remoteKept: 5, localKept: 4, remoteDeleted: 0 },
    });
    assert.equal(card.status, 'success');
    assert.equal(fact(card, 'Archive'), 'Created and verified');
    assert.equal(fact(card, 'Drive delivery'), 'Verified');
    assert.match(fact(card, 'Drive retention'), /combined result/);
    assert.match(fact(card, 'Local retention'), /combined result/);
    assert.equal(fact(card, 'Drive archives removed'), '0');
  });

  for (const retention of ['pending', 'deferred', undefined]) {
    it(`should retain uncertainty about each side of ${retention} cleanup`, () => {
      const rendered = formatBackupReport({
        result: { ...completed, retention, code: 'drive-list-incomplete', remoteKept: 5 },
      });
      const card = JSON.parse(rendered.stdout).cards[0];
      assert.equal(card.status, 'warning');
      assert.equal(fact(card, 'Drive delivery'), 'Verified');
      assert.equal(fact(card, 'Drive retention'), 'Not separately recorded');
      assert.equal(fact(card, 'Local retention'), 'Not separately recorded');
      assert.match(card.findings.join(' '), /local archives may accumulate/);
      assert.match(rendered.stderr, /drive-list-incomplete/);
    });
  }

  it('should explain intentionally skipped pilot retention and resumed archives', () => {
    const rendered = formatBackupReport({
      result: { ...completed, status: 'piloted', retention: 'skipped', retentionApplied: false },
      resumed: true,
    });
    const card = JSON.parse(rendered.stdout).cards[0];
    assert.equal(card.status, 'warning');
    assert.equal(fact(card, 'Archive'), 'Existing archive verified and reused');
    assert.equal(fact(card, 'Drive delivery'), 'Verified');
    assert.match(fact(card, 'Retention'), /Intentionally skipped/);
    assert.equal(rendered.stderr, '');
  });

  for (const result of [
    undefined,
    {},
    { ...completed, agentId: 'emori' },
    { ...completed, delivered: false },
    { ...completed, status: 'unknown' },
  ]) {
    it('should not infer verified delivery or retention from missing or foreign results', () => {
      const card = cardFor({ result });
      assert.equal(card.status, 'unknown');
      assert.equal(fact(card, 'Archive'), 'Unconfirmed');
      assert.equal(fact(card, 'Drive delivery'), 'Unconfirmed');
      assert.equal(fact(card, 'Local retention'), 'Not separately recorded');
    });
  }

  it('should allow only bounded known diagnostics and correct recovery files', () => {
    const failure = new Error('token=private-secret');
    failure.diagnostic = {
      exitCode: 7,
      signal: 'SIGKILL',
      timedOut: true,
      code: 'ENOENT',
      upstreamCode: 'google-permission-denied',
      message: '/sensitive/path',
    };
    const rendered = formatBackupReport({ failure });
    assert.match(
      rendered.stderr,
      /task-failed.*child exit 7.*SIGKILL.*timed out.*ENOENT.*google-permission-denied/,
    );
    assert.match(rendered.stderr, /delivery-status.json and delivery.json/);
    assert.doesNotMatch(rendered.stdout + rendered.stderr, /private-secret|sensitive/);
    assert(Buffer.byteLength(rendered.stderr) < 4096);
    assert(Buffer.byteLength(rendered.stdout) <= 16 * 1024);
  });
});
