import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { YAML } from 'bun';

const manifest = YAML.parse(
  readFileSync(new URL('../.agent-system/agent.yaml', import.meta.url), 'utf8'),
);
const allowedSigners = readFileSync(
  new URL('../.agent-system/allowed_signers', import.meta.url),
  'utf8',
);

describe('agent identity isolation', () => {
  it('requires smutlord-specific credential sources without Google access', () => {
    assert.equal(manifest.agent.id, 'smutlord');
    assert.equal(manifest.agent.email['from-environment'], 'EMAIL');
    assert.equal(manifest.github.username, 'smutlord');
    assert.equal(manifest.github.token, 'GH_TOKEN');
    assert.equal(manifest.git.ssh['private-keys']['from-environment'], 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.git.signing.key, 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.memory.search['api-key'], 'SMUT_RECALL_KEY');
    assert.deepEqual(manifest.environment.required, [
      'EMAIL',
      'GH_TOKEN',
      'SMUTLORD_SSH_KEY',
      'SMUT_RECALL_KEY',
    ]);
    assert.equal(manifest.environment.op, '3t5psl4lnq2vqfvub3u6pq4tdm');
    assert.deepEqual(manifest.environment.set, {
      SMUTLORD_SSH_KEY: {
        'from-op': 'op://gwhijlujd334yr67wonpmsrr2y/id_smutkey/private key?ssh-format=openssh',
      },
    });
    assert.equal(manifest.google, undefined);
    assert.equal(manifest.github['ssh-keys'].key, manifest.github['ssh-signing-keys'].key);
    assert.match(manifest.github['ssh-keys'].key, /^ssh-ed25519 /u);
    assert.equal(
      allowedSigners.trim(),
      `smutlord@tanaab.dev ${manifest.github['ssh-signing-keys'].key}`,
    );
  });
});
