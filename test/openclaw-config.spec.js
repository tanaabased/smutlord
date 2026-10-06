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

function buildPatch(current = {}) {
  return buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath,
    home,
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

  it('should preserve managed tool grants', () => {
    const patch = buildPatch({
      agents: {
        entries: {
          smutlord: {
            tools: { alsoAllow: ['agent_system_git', 'agent_system_github'] },
          },
        },
      },
    });
    assert.deepEqual(patch.agents.entries.smutlord.tools.alsoAllow, [
      'agent_system_git',
      'agent_system_github',
    ]);
  });

  it('should leave model bindings, selection, and admissions to the manifest lifecycle', () => {
    const current = buildPatch();
    current.agents.entries.smutlord.model = {
      primary: 'openai/gpt-6.1-sol',
      fallbacks: ['openai/gpt-6-luna'],
    };
    current.agents.entries.smutlord.models = {
      'openai/gpt-6.1-sol': { agentRuntime: { id: 'codex' } },
      'openai/gpt-6-luna': { agentRuntime: { id: 'codex' } },
    };
    current.agents.entries.smutlord.modelPolicy = {
      allow: ['openai/gpt-6.1-sol', 'openai/gpt-6-luna'],
    };
    const original = structuredClone(current);
    const patch = buildPatch(current);
    assert.equal(patch.agents.entries.smutlord.models, undefined);
    assert.equal(patch.agents.entries.smutlord.model, undefined);
    assert.equal(patch.agents.entries.smutlord.modelPolicy, undefined);
    assert.equal(configPatchSatisfied(current, patch), true);
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

  it('should configure non-model workspace policies', () => {
    const patch = buildPatch({ tools: { sessions: { visibility: 'all' } } });
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
    assert.equal(patch.tools, undefined);
  });

  it('should preserve existing tool and selection settings', () => {
    const current = buildPatch();
    current.tools = { sessions: { visibility: 'all' } };
    const agent = current.agents.entries.smutlord;
    agent.model = { primary: 'openai/gpt-6.1-sol', fallbacks: ['openai/gpt-6-luna'] };
    agent.thinkingDefault = 'high';
    agent.models = {};
    agent.models['openai/gpt-6-luna'] = {
      alias: 'Luna',
      agentRuntime: { id: 'codex' },
      params: { temperature: 0.2 },
    };
    agent.models['openai/gpt-6.1-sol'] = {
      agentRuntime: { id: 'codex' },
      params: { reasoningEffort: 'medium' },
    };
    const before = structuredClone(current);
    const patch = buildPatch(current);

    assert.equal(configPatchSatisfied(current, patch), true);
    assert.equal(patch.agents.entries.smutlord.models, undefined);
    assert.equal(patch.agents.entries.smutlord.model, undefined);
    assert.equal(patch.agents.entries.smutlord.thinkingDefault, undefined);
    assert.equal(patch.agents.entries.smutlord.modelPolicy, undefined);
    assert.equal(patch.tools, undefined);
    assert.deepEqual(current, before);
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
  });
});
