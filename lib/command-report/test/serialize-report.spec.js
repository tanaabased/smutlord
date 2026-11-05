import assert from 'node:assert/strict';

import serializeReport from '../utils/serialize-report.js';

const card = {
  id: 'backup-agent-nightly',
  title: 'Backup',
  status: 'warning',
  summary: 'Cleanup deferred.',
};

describe('lib/command-report/utils/serialize-report', () => {
  it('should emit one complete preferred document and sanitize every displayed field', () => {
    const output = serializeReport([
      {
        ...card,
        title: 'Backup\nstatus',
        facts: [{ label: 'Drive\nstatus', value: 'token=hidden' }],
        findings: ['github_pat_abc123'],
        actions: ['password=hidden'],
      },
    ]);
    const report = JSON.parse(output);
    assert.equal(report.schema, 'agent-system.report');
    assert.equal(report.version, 1);
    assert.equal(report.cards.length, 1);
    assert.equal(report.cards[0].format, 'structured');
    assert.equal(report.cards[0].status, 'warning');
    assert.doesNotMatch(report.cards[0].title, /\n/);
    assert.doesNotMatch(report.cards[0].facts[0].label, /\n/);
    assert.doesNotMatch(output, /hidden|abc123/);
  });

  it('should preserve each outcome and severity when reducing oversized details', () => {
    const cards = ['success', 'warning', 'error'].map((status, index) => ({
      ...card,
      id: String(index),
      status,
      facts: Array.from({ length: 30 }, () => ({ label: 'Detail', value: 'x'.repeat(700) })),
    }));
    const original = structuredClone(cards);
    const output = serializeReport(cards);
    const report = JSON.parse(output);
    assert(Buffer.byteLength(output) <= 16 * 1024);
    assert.deepEqual(
      report.cards.map(({ status }) => status),
      ['success', 'warning', 'error'],
    );
    assert(report.cards.every((item) => item.findings.some((text) => text.includes('omitted'))));
    assert.deepEqual(cards, original);
  });

  it('should disclose capacity failure instead of dropping a prefix of outcomes', () => {
    const output = serializeReport(
      Array.from({ length: 300 }, (_, index) => ({ ...card, id: String(index) })),
    );
    const report = JSON.parse(output);
    assert(Buffer.byteLength(output) <= 16 * 1024);
    assert.equal(report.cards.length, 1);
    assert.equal(report.cards[0].id, 'report-capacity');
    assert.equal(report.cards[0].status, 'error');
    assert.match(report.cards[0].summary, /300/);
    assert.match(report.cards[0].actions[0], /do not repeat mutations/);
  });
});
