import assert from 'node:assert/strict';

import safeText from '../utils/safe-text.js';
import sanitizeDiagnostic from '../utils/sanitize-diagnostic.js';

describe('lib/command-report/utils/safe-text', () => {
  it('should redact known credentials before truncating and remove terminal and bidi controls', () => {
    const secret = 'opaque secret/with spaces';
    const value = `\u001b[31m\u202e${secret} ${encodeURIComponent(secret)}\u001b[0m`;
    const result = safeText(value, 20, { API_TOKEN: secret });
    assert.doesNotMatch(result, /opaque|secret|\u202e/);
    assert.equal(result.includes('\u001b'), false);
    assert.match(result, /redacted/);
  });

  it('should remove recognizable tokens, URL userinfo and private key material', () => {
    const result = safeText(
      'github_pat_abc123 https://user:pass@example.test/ token=hidden -----BEGIN PRIVATE KEY-----\nkey-data\n-----END PRIVATE KEY-----',
      700,
      {},
    );
    assert.doesNotMatch(result, /abc123|user:pass|hidden|key-data/);
    assert.match(result, /https:\/\/\[redacted\]@example.test/);
  });

  it('should bound diagnostics and tolerate missing text without leaking controls', () => {
    assert.equal(safeText(undefined), '');
    assert.equal(sanitizeDiagnostic('x'.repeat(1000), {}, 100).length, 100);
    assert.equal(sanitizeDiagnostic('\u0000safe\u0007'), 'safe');
  });
});
