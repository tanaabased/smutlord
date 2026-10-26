import assert from 'node:assert/strict';

import jobFileStamp from '../utils/job-file-stamp.js';

describe('lib/backup/utils/job-file-stamp', () => {
  const name =
    'smutlord-nightly-2026-01-20T03-00-00-123Z-00000000-0000-4000-8000-000000000000.tar.gz';
  it('should identify a valid job-namespaced capture time', () => {
    assert.equal(jobFileStamp(name), '2026-01-20T03-00-00-123Z');
  });
  for (const invalid of [
    name.replace('smutlord-nightly-', 'smutlord-'),
    name.replace('2026-01-20', '2026-02-30'),
    name.replace('03-00-00', '25-00-00'),
    name.replace('00000000-0000', 'not-a-uuid'),
    `unrelated-${name}`,
  ]) {
    it('should leave legacy, malformed and unrelated names outside automatic deletion', () => {
      assert.equal(jobFileStamp(invalid), undefined);
    });
  }
});
