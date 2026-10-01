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
  it('requires operator environment values without a copied credential source', () => {
    assert.equal(manifest.agent.id, 'smutlord');
    assert.equal(manifest.agent.email['from-environment'], 'EMAIL');
    assert.equal(manifest.github.username, 'smutlord');
    assert.equal(manifest.github.token, 'GH_TOKEN');
    assert.equal(manifest.git.ssh['private-keys']['from-environment'], 'SSH_KEY');
    assert.equal(manifest.git.signing.key, 'SSH_KEY');
    assert.equal(manifest.memory.search['api-key'], 'MEMORY_BINDER');
    assert.deepEqual(manifest.environment.required, [
      'EMAIL',
      'GH_TOKEN',
      'SSH_KEY',
      'MEMORY_BINDER',
      'GOG_CREDENTIALS_JSON',
      'GOG_TOKEN_JSON',
      'GOG_KEYRING_PASSWORD',
    ]);
    assert.equal(manifest.environment.op, undefined);
    assert.equal(manifest.environment.set, undefined);
    assert.equal(manifest.github['ssh-keys'], undefined);
    assert.equal(manifest.github['ssh-signing-keys'], undefined);
    assert.doesNotMatch(allowedSigners, /ssh-(?:ed25519|rsa)/);
  });
});
