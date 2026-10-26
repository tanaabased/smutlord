import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';

import { YAML } from 'bun';

const manifest = YAML.parse(
  readFileSync(new URL('../.agent-system/agent.yaml', import.meta.url), 'utf8'),
);
const allowedSigners = readFileSync(
  new URL('../.agent-system/allowed_signers', import.meta.url),
  'utf8',
);

describe('manifest static safety invariants', () => {
  it('should keep workflow and automation execution in OpenClaw', () => {
    assert.deepEqual(manifest.github.runtimes, ['openclaw']);
    for (const automation of manifest.automations) {
      assert.deepEqual(automation.runtimes, ['openclaw']);
    }
  });

  it('should resolve configured workspace assets and setup files', () => {
    accessSync(new URL(`../${manifest.agent.avatar}`, import.meta.url));
    for (const section of ['setup-host', 'setup-agent']) {
      const setupPath = new URL(`../.agent-system/${manifest[section].file}`, import.meta.url);
      const setup = YAML.parse(readFileSync(setupPath, 'utf8'));
      for (const step of setup.steps) {
        for (const operation of ['check', 'apply']) {
          accessSync(new URL(`../${step[operation].command}`, import.meta.url));
        }
      }
    }
  });

  it('denies release mutations and keeps worktrees isolated from shared checkouts', () => {
    assert.equal(manifest.github.policy.releases, 'deny');
    assert.deepEqual(manifest.git.worktrees, {});
  });

  it('requires smutlord-specific credential sources', () => {
    assert.equal(manifest.agent.id, 'smutlord');
    assert.equal(manifest.agent.email['from-environment'], 'EMAIL');
    assert.equal(manifest.github.username, 'smutlord');
    assert.equal(manifest.github.token, 'GH_TOKEN');
    assert.equal(manifest.git.ssh['private-keys']['from-environment'], 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.git.signing.key, 'SMUTLORD_SSH_KEY');
    assert.equal(manifest.memory.search['api-key'], 'SMUT_RECALL_KEY');
    for (const binding of [
      manifest.agent.email['from-environment'],
      manifest.github.token,
      manifest.git.ssh['private-keys']['from-environment'],
      manifest.git.signing.key,
      manifest.memory.search['api-key'],
      manifest.google.account['from-environment'],
      manifest.google['oauth-client'],
      manifest.google['oauth-token'],
      manifest.google['keyring-password'],
    ]) {
      assert.ok(manifest.environment.required.includes(binding), `${binding} must be required`);
    }
    assert.equal(manifest.github['ssh-keys'].key, manifest.github['ssh-signing-keys'].key);
    assert.match(manifest.github['ssh-keys'].key, /^ssh-ed25519 /u);
    assert.equal(
      allowedSigners.trim(),
      `smutlord@tanaab.dev ${manifest.github['ssh-signing-keys'].key}`,
    );
  });

  it('should bind Google explicitly to GOG_ACCOUNT instead of the agent email', () => {
    assert.equal(manifest.google.account['from-environment'], 'GOG_ACCOUNT');
    assert.equal(manifest.google['oauth-client'], 'GOG_CREDENTIALS_JSON');
    assert.equal(manifest.google['oauth-token'], 'GOG_TOKEN_JSON');
    assert.equal(manifest.google['keyring-password'], 'GOG_KEYRING_PASSWORD');
    assert.equal(manifest.agent.email['from-environment'], 'EMAIL');
  });
});
