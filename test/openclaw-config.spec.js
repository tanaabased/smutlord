import assert from 'node:assert/strict';

import {
  buildOpenClawConfigPatch,
  configPatchSatisfied,
  loadOpenClawConfigFragment,
  memoryStatusHealthy,
  sessionMemoryHookHealthy,
  sqliteVectorExtensionPath,
  withoutCanonSkillDir,
} from '../lib/setup/openclaw-config.js';

const home = '/Users/smutlord';
const canonPath = `${home}/tanaab/canon`;
const vectorExtensionPath = '/opt/homebrew/lib/node_modules/sqlite-vec-darwin-arm64/vec0.dylib';

function buildPatch(current = {}, operatorModelAdmissions = []) {
  return buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath,
    home,
    operatorModelAdmissions,
    vectorExtensionPath,
  });
}

describe('lib/setup/openclaw-config', () => {
  it('should leave existing channel defaults, accounts, plugins, and routes untouched', () => {
    const current = {
      channels: {
        imessage: {
          defaultAccount: 'emori',
          dmPolicy: 'allowlist',
          accounts: { emori: { enabled: true, dbPath: '/fixture/emori/chat.db' } },
        },
      },
      bindings: [
        { type: 'route', agentId: 'emori', match: { channel: 'imessage', accountId: 'emori' } },
      ],
      plugins: { entries: { imessage: { enabled: true } } },
    };
    const original = structuredClone(current);
    const patch = buildPatch(current);
    assert.equal(patch.channels, undefined);
    assert.equal(patch.bindings, undefined);
    assert.equal(patch.plugins, undefined);
    assert.deepEqual(current, original);
  });

  it('should derive the installed platform-specific vector extension path', () => {
    assert.equal(
      sqliteVectorExtensionPath('/opt/homebrew/lib/node_modules\n', 'darwin', 'arm64'),
      vectorExtensionPath,
    );
  });

  it('should preserve managed tool grants and explicitly admitted operator models', () => {
    const patch = buildPatch(
      {
        agents: {
          entries: {
            smutlord: {
              tools: { alsoAllow: ['agent_system_git', 'agent_system_github'] },
              modelPolicy: { allow: ['openai/gpt-6-astra', 'operator/custom-model'] },
            },
          },
        },
      },
      ['operator/custom-model'],
    );
    assert.deepEqual(patch.agents.entries.smutlord.tools.alsoAllow, [
      'agent_system_git',
      'agent_system_github',
    ]);
    assert.deepEqual(patch.agents.entries.smutlord.modelPolicy.allow, [
      'operator/custom-model',
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6-sol',
    ]);
  });

  it('should migrate the six-model allowlist to GPT-6 and converge without mutating input', () => {
    const current = {
      agents: {
        entries: {
          smutlord: {
            modelPolicy: {
              allow: [
                'openai/gpt-5.5',
                'openai/gpt-6-astra',
                'openai/gpt-5.6-sol',
                'openai/gpt-6-luna',
                'openai/gpt-5.6-terra',
                'openai/gpt-6-sol',
              ],
            },
          },
        },
      },
    };
    const original = structuredClone(current);
    const patch = buildPatch(current);
    assert.deepEqual(patch.agents.entries.smutlord.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6-sol',
    ]);
    assert.equal(configPatchSatisfied(current, patch), false);
    const reconciled = structuredClone(patch);
    assert.equal(configPatchSatisfied(reconciled, buildPatch(reconciled)), true);
    assert.deepEqual(current, original);
  });

  it('should retire owned models removed from the fragment and preserve operator models and other agents', () => {
    const fragment = loadOpenClawConfigFragment();
    fragment.agents.entries.smutlord.modelPolicy.allow = ['openai/gpt-6-astra'];
    const current = {
      agents: {
        entries: {
          smutlord: {
            tools: { alsoAllow: ['agent_system_git'] },
            modelPolicy: {
              allow: ['openai/gpt-6-astra', 'openai/gpt-6-sol', 'operator/custom-model'],
            },
          },
          other: {
            tools: { alsoAllow: ['other/tool'] },
            modelPolicy: { allow: ['openai/gpt-6-sol'] },
          },
        },
      },
    };
    const original = structuredClone(current);
    const options = {
      canonPath,
      home,
      vectorExtensionPath,
      operatorModelAdmissions: ['operator/custom-model'],
    };
    const patch = buildOpenClawConfigPatch(fragment, current, options);
    assert.deepEqual(patch.agents.entries.smutlord.modelPolicy.allow, [
      'operator/custom-model',
      'openai/gpt-6-astra',
    ]);
    assert.deepEqual(patch.agents.entries.smutlord.tools.alsoAllow, ['agent_system_git']);
    assert.equal(patch.agents.entries.other, undefined);
    const reconciled = structuredClone(patch);
    reconciled.agents.entries.other = structuredClone(current.agents.entries.other);
    assert.equal(
      configPatchSatisfied(reconciled, buildOpenClawConfigPatch(fragment, reconciled, options)),
      true,
    );
    assert.deepEqual(reconciled.agents.entries.other, original.agents.entries.other);
    assert.deepEqual(current, original);
  });

  it('should reject unknown or conflicting model ownership without mutating input', () => {
    const current = {
      agents: { entries: { smutlord: { modelPolicy: { allow: ['operator/custom-model'] } } } },
    };
    const original = structuredClone(current);
    assert.throws(
      () => buildPatch(current),
      /Unresolved model admission ownership: operator\/custom-model/u,
    );
    for (const model of ['openai/gpt-5.6-sol', 'openai/gpt-6-sol']) {
      assert.throws(() => buildPatch(current, [model]), /Model admission ownership conflicts/u);
    }
    assert.throws(() => buildPatch(current, 'all'), /Operator model admissions must be an array/u);
    assert.deepEqual(current, original);
  });

  it('should remove only Canon skill discovery', () => {
    const patch = buildPatch({
      skills: {
        load: { extraDirs: ['~/tanaab/canon/skills', '/opt/shared-skills'] },
      },
    });

    assert.deepEqual(patch.skills.load.extraDirs, ['/opt/shared-skills']);
    assert.deepEqual(withoutCanonSkillDir(['~/tanaab/canon/skills'], canonPath, home), []);
  });

  it('should carry every owned static policy through one patch', () => {
    const patch = buildPatch();
    assert.equal(
      patch.agents.entries.smutlord.models['openai/gpt-6-astra'].agentRuntime.id,
      'codex',
    );
    assert.equal(
      patch.agents.entries.smutlord.models['openai/gpt-6-luna'].agentRuntime.id,
      'codex',
    );
    assert.equal(patch.agents.entries.smutlord.models['openai/gpt-6-sol'].agentRuntime.id, 'codex');
    assert.deepEqual(patch.agents.entries.smutlord.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6-sol',
    ]);
    assert.equal(patch.agents.entries.smutlord.tools.profile, 'coding');
    assert.equal(patch.agents.entries.smutlord.tools.exec.mode, 'auto');
    assert.deepEqual(patch.agents.entries.smutlord.tools.alsoAllow, []);
    assert.equal(patch.agents.entries.smutlord.tools.message, undefined);
    assert.equal(
      patch.agents.entries.smutlord.memory.search.store.vector.extensionPath,
      vectorExtensionPath,
    );
    assert.deepEqual(patch.agents.entries.smutlord.memory.search.sources, ['memory', 'sessions']);
    assert.equal(patch.hooks.internal.entries['session-memory'].enabled, false);
    assert.equal(patch.skills.workshop.autonomous.mode, 'propose');
    assert.equal(patch.tools.sessions.visibility, 'agent');
  });

  it('should recognize a converged patch including deletions and exact arrays', () => {
    const patch = buildPatch();
    const current = structuredClone(patch);
    patch.skills.load = { extraDirs: null };
    current.skills.load = {};
    assert.equal(configPatchSatisfied(current, patch), true);

    current.agents.entries.smutlord.memory.search.sources = ['sessions', 'memory'];
    assert.equal(configPatchSatisfied(current, patch), false);
  });

  it('should require the configured memory runtime and disabled legacy hook', () => {
    assert.equal(
      memoryStatusHealthy(
        [
          {
            agentId: 'smutlord',
            status: {
              sources: ['memory', 'sessions'],
              vector: { enabled: true, extensionPath: vectorExtensionPath },
            },
          },
        ],
        vectorExtensionPath,
      ),
      true,
    );
    assert.equal(memoryStatusHealthy([], vectorExtensionPath), false);
    assert.equal(
      sessionMemoryHookHealthy({
        hooks: [{ name: 'session-memory', disabled: true, enabledByConfig: false }],
      }),
      true,
    );
    assert.equal(
      sessionMemoryHookHealthy({
        hooks: [{ name: 'session-memory', disabled: false, enabledByConfig: true }],
      }),
      false,
    );
  });

  it('should reject malformed shared arrays before replacing them', () => {
    assert.throws(
      () => buildPatch({ agents: { entries: { smutlord: { tools: { alsoAllow: 'message' } } } } }),
      /additional tool grants must be an array of strings/u,
    );
    assert.throws(
      () => buildPatch({ skills: { load: { extraDirs: [42] } } }),
      /extra skill directories must be an array of strings/u,
    );
    assert.throws(
      () => buildPatch({ agents: { entries: { smutlord: { modelPolicy: { allow: 'all' } } } } }),
      /model allowlist must be an array of strings/u,
    );
  });
});
