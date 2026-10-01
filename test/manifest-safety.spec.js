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
  it('requires smutlord-specific environment values without a copied credential source', () => {
    assert.equal(manifest.agent.id, 'smutlord');
    assert.equal(manifest.agent.email['from-environment'], 'SMUTLORD_EMAIL');
    assert.equal(manifest.github.username, 'smutlord');
    assert.equal(manifest.github.token, 'SMUTLORD_GH_TOKEN');
    assert.equal(manifest.git.ssh['private-keys']['from-environment'], 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.git.signing.key, 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.memory.search['api-key'], 'SMUTLORD_MEMORY_BINDER');
    assert.ok(manifest.environment.required.every((name) => name.startsWith('SMUTLORD_')));
    assert.equal(manifest.environment.op, undefined);
    assert.equal(manifest.environment.set, undefined);
    assert.equal(manifest.github['ssh-keys'], undefined);
    assert.equal(manifest.github['ssh-signing-keys'], undefined);
    assert.doesNotMatch(allowedSigners, /ssh-(?:ed25519|rsa)/);
  });
});
