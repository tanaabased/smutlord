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
  it('declares one enabled nightly backup with explicit timezone and the verified command', () => {
    assert.deepEqual(manifest.automations, [
      {
        id: 'backup-drive-nightly',
        enabled: true,
        runtimes: ['openclaw'],
        schedule: { cron: '0 3 * * *', timezone: 'America/New_York' },
        run: ['bun', 'scripts/backup-drive-task.js'],
        'timeout-seconds': 3600,
      },
    ]);
  });

  it('uses Sol 6.1 for default, medium, and high while retaining Luna for low', () => {
    assert.deepEqual(manifest.models, {
      default: { model: 'openai/gpt-6.1-sol', effort: 'high' },
      low: { model: 'openai/gpt-6-luna', effort: 'medium' },
      medium: { model: 'openai/gpt-6.1-sol', effort: 'high' },
      high: { model: 'openai/gpt-6.1-sol', effort: 'high' },
    });
  });

  it('should declare only v2 OpenClaw plan intake without changing the agent runtime', () => {
    const notifications = manifest.github.notifications;
    assert.equal(manifest['schema-version'], 1);
    assert.equal(manifest.agent.runtime, 'codex');
    assert.equal(notifications['schema-version'], 2);
    assert.deepEqual(notifications.runtimes, ['openclaw']);
    assert.equal(notifications['interval-minutes'], 5);
    assert.equal(notifications['issue-assignment'].mode, 'plan');
    assert.deepEqual(
      new Set(Object.keys(notifications)),
      new Set([
        'schema-version',
        'runtimes',
        'interval-minutes',
        'allowed-repository-owners',
        'issue-assignment',
      ]),
    );
  });

  it('should retain pinned repository owners', () => {
    assert.deepEqual(manifest.github.notifications['allowed-repository-owners'], [
      { login: 'tanaabased', 'node-id': 'O_kgDODNGy1g' },
      { login: 'pirog', 'node-id': 'MDQ6VXNlcjcxMzQyNA==' },
      { login: 'lando', 'node-id': 'MDEyOk9yZ2FuaXphdGlvbjMxNjA1NTg0' },
    ]);
  });

  it('should admit delegation and self-assignment without granting agents operator ownership', () => {
    assert.deepEqual(manifest.github.notifications['issue-assignment'].allowed, [
      { login: 'pirog', 'node-id': 'MDQ6VXNlcjcxMzQyNA==', 'operator-owner': true },
      { login: 'emoriwan', 'node-id': 'U_kgDOEUqvpg' },
      { login: 'smutlord', 'node-id': 'MDQ6VXNlcjMxNTk5ODk0' },
    ]);
  });

  it('should inherit issue feedback and retain dynamic and pinned PR recipient roles', () => {
    const assignment = manifest.github.notifications['issue-assignment'];
    assert.deepEqual(assignment.feedback, { inherit: true });
    assert.deepEqual(assignment['pull-request'], {
      recipients: [
        { source: 'assignment-actor', roles: ['assignee'] },
        { login: 'pirog', 'node-id': 'MDQ6VXNlcjcxMzQyNA==', roles: ['assignee', 'reviewer'] },
      ],
    });
    assert.deepEqual(
      new Set(Object.keys(assignment)),
      new Set(['mode', 'allowed', 'feedback', 'pull-request']),
    );
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
    assert.deepEqual(manifest.environment.required, [
      'EMAIL',
      'GH_TOKEN',
      'SMUTLORD_SSH_KEY',
      'SMUT_RECALL_KEY',
      'GOG_ACCOUNT',
      'GOG_CREDENTIALS_JSON',
      'GOG_TOKEN_JSON',
      'GOG_KEYRING_PASSWORD',
    ]);
    assert.equal(manifest.environment.op, '3t5psl4lnq2vqfvub3u6pq4tdm');
    assert.deepEqual(manifest.environment.set, {
      SMUTLORD_SSH_KEY: {
        'from-op': 'op://gwhijlujd334yr67wonpmsrr2y/id_smutkey/private key?ssh-format=openssh',
      },
    });
    assert.equal(manifest.github['ssh-keys'].key, manifest.github['ssh-signing-keys'].key);
    assert.match(manifest.github['ssh-keys'].key, /^ssh-ed25519 /u);
    assert.equal(
      allowedSigners.trim(),
      `smutlord@tanaab.dev ${manifest.github['ssh-signing-keys'].key}`,
    );
  });

  it('should bind Google explicitly to GOG_ACCOUNT instead of the agent email', () => {
    assert.deepEqual(manifest.google, {
      account: { 'from-environment': 'GOG_ACCOUNT' },
      'credential-encoding': 'base64',
      'oauth-client': 'GOG_CREDENTIALS_JSON',
      'oauth-token': 'GOG_TOKEN_JSON',
      'keyring-password': 'GOG_KEYRING_PASSWORD',
    });
    assert.equal(manifest.agent.email['from-environment'], 'EMAIL');
  });
});
