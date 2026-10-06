import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { sqliteVectorPackage } from './brew-dependencies.js';
import { parseJson, run } from './command.js';
import { readConfigValue } from './config.js';

const agentId = 'smutlord';
const configFragmentPath = new URL('../../openclaw.patch.json', import.meta.url);
const configSections = ['agents', 'hooks', 'skills', 'tools'];
// Keep retired admissions here so setup can remove them after they leave the fragment.
const workspaceOwnedModelAdmissions = [
  'openai/gpt-5.5',
  'openai/gpt-5.6-sol',
  'openai/gpt-5.6-terra',
  'openai/gpt-6-astra',
  'openai/gpt-6-luna',
  'openai/gpt-6-sol',
  'openai/gpt-6.1-sol',
];
const workspaceOwnedRuntimeModels = new Set([
  'openai/gpt-6-astra',
  'openai/gpt-6-luna',
  'openai/gpt-6-sol',
  'openai/gpt-6.1-sol',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function requireStringArray(value, label, fallback = []) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function configuredPath(path, home) {
  if (path === '~') return resolve(home);
  if (path.startsWith('~/')) return resolve(home, path.slice(2));
  return isAbsolute(path) ? resolve(path) : null;
}

function mergeUniqueStrings(current, desired) {
  return [...new Set([...current, ...desired])];
}

export function loadOpenClawConfigFragment(path = configFragmentPath) {
  return requireObject(
    parseJson(readFileSync(path, 'utf8'), 'openclaw.patch.json'),
    'smutlord OpenClaw config fragment',
  );
}

export function sqliteVectorExtensionPath(
  globalNpmRoot,
  platform = process.platform,
  arch = process.arch,
) {
  return resolve(globalNpmRoot.trim(), sqliteVectorPackage(platform, arch), 'vec0.dylib');
}

export function withoutCanonSkillDir(extraDirs, canon, home) {
  const canonSkills = resolve(canon, 'skills');
  return extraDirs.filter((path) => configuredPath(path, home) !== canonSkills);
}

export function buildOpenClawConfigPatch(fragment, current, options) {
  const patch = structuredClone(requireObject(fragment, 'smutlord OpenClaw config fragment'));
  const currentTools = current?.agents?.entries?.[agentId]?.tools;
  if (currentTools !== undefined) requireObject(currentTools, 'OpenClaw smutlord tools config');

  const patchTools = requireObject(
    patch?.agents?.entries?.[agentId]?.tools,
    'smutlord OpenClaw tools fragment',
  );
  patchTools.alsoAllow = mergeUniqueStrings(
    requireStringArray(currentTools?.alsoAllow, 'OpenClaw smutlord additional tool grants'),
    requireStringArray(patchTools.alsoAllow, 'smutlord additional tool grants'),
  );

  const currentModelPolicy = current?.agents?.entries?.[agentId]?.modelPolicy;
  if (currentModelPolicy !== undefined) {
    requireObject(currentModelPolicy, 'OpenClaw smutlord model policy');
  }
  const patchModelPolicy = requireObject(
    patch?.agents?.entries?.[agentId]?.modelPolicy,
    'smutlord model policy fragment',
  );
  const currentAdmissions = requireStringArray(
    currentModelPolicy?.allow,
    'OpenClaw smutlord model allowlist',
  );
  const desiredAdmissions = requireStringArray(patchModelPolicy.allow, 'smutlord model allowlist');
  const currentModels = requireObject(
    current?.agents?.entries?.[agentId]?.models ?? {},
    'OpenClaw smutlord models config',
  );
  const patchModels = requireObject(
    patch?.agents?.entries?.[agentId]?.models,
    'smutlord models fragment',
  );
  const ownedAdmissions = new Set([...workspaceOwnedModelAdmissions, ...desiredAdmissions]);
  const operatorAdmissions = new Set(
    requireStringArray(options.operatorModelAdmissions, 'Operator model admissions'),
  );
  const conflictingAdmissions = [...operatorAdmissions].filter((model) =>
    ownedAdmissions.has(model),
  );
  if (conflictingAdmissions.length > 0) {
    throw new Error(`Model admission ownership conflicts: ${conflictingAdmissions.join(', ')}.`);
  }
  const unresolvedModels = Object.keys(currentModels).filter(
    (model) =>
      model !== 'openai/*' &&
      !workspaceOwnedRuntimeModels.has(model) &&
      !operatorAdmissions.has(model),
  );
  if (unresolvedModels.length > 0) {
    throw new Error(`Unresolved model runtime ownership: ${unresolvedModels.join(', ')}.`);
  }
  for (const model of workspaceOwnedRuntimeModels) {
    const currentModel = currentModels[model];
    if (!Object.hasOwn(currentModels, model)) continue;
    requireObject(currentModel, `OpenClaw smutlord ${model} config`);
    if (currentModel.agentRuntime !== undefined) {
      requireObject(currentModel.agentRuntime, `OpenClaw smutlord ${model} runtime`);
      if (currentModel.agentRuntime.id !== 'codex') {
        throw new Error(
          `Conflicting exact model runtime for ${model}: ${currentModel.agentRuntime.id}.`,
        );
      }
    }
  }
  for (const model of operatorAdmissions) {
    if (Object.hasOwn(currentModels, model) && !Object.hasOwn(patchModels, model)) {
      patchModels[model] = currentModels[model];
    }
  }
  const unresolvedAdmissions = currentAdmissions.filter(
    (model) => !ownedAdmissions.has(model) && !operatorAdmissions.has(model),
  );
  if (unresolvedAdmissions.length > 0) {
    throw new Error(`Unresolved model admission ownership: ${unresolvedAdmissions.join(', ')}.`);
  }
  patchModelPolicy.allow = mergeUniqueStrings(
    currentAdmissions.filter((model) => operatorAdmissions.has(model)),
    desiredAdmissions,
  );

  const currentExtraDirs = current?.skills?.load?.extraDirs;
  if (currentExtraDirs !== undefined) {
    const extraDirs = requireStringArray(currentExtraDirs, 'OpenClaw extra skill directories');
    const retainedDirs = withoutCanonSkillDir(extraDirs, options.canonPath, options.home);
    if (retainedDirs.length !== extraDirs.length) {
      patch.skills.load = { extraDirs: retainedDirs.length === 0 ? null : retainedDirs };
    }
  }

  patch.agents.entries[agentId].memory.search.store.vector.extensionPath =
    options.vectorExtensionPath;
  return patch;
}

export function configPatchSatisfied(current, patch) {
  if (patch === null) return current === undefined;
  if (Array.isArray(patch) || !isObject(patch)) return isDeepStrictEqual(current, patch);
  if (!isObject(current)) return false;
  return Object.entries(patch).every(([key, value]) => configPatchSatisfied(current[key], value));
}

export function memoryStatusHealthy(statuses, vectorExtensionPath) {
  const status = Array.isArray(statuses)
    ? statuses.find((entry) => entry.agentId === agentId)?.status
    : undefined;
  return (
    status?.vector?.enabled === true &&
    status.vector.extensionPath === vectorExtensionPath &&
    isDeepStrictEqual(status.sources, ['memory', 'sessions'])
  );
}

export function sessionMemoryHookHealthy(hooks) {
  const hook = hooks?.hooks?.find((entry) => entry.name === 'session-memory');
  return hook?.disabled === true && hook.enabledByConfig === false;
}

function inspectConfig() {
  return Object.fromEntries(configSections.map((path) => [path, readConfigValue(path)]));
}

function installedVectorExtensionPath() {
  return sqliteVectorExtensionPath(run('npm', ['root', '--global']).stdout);
}

function desiredConfig() {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME is unavailable.');
  const vectorExtensionPath = installedVectorExtensionPath();
  if (!existsSync(vectorExtensionPath)) throw new Error('SQLite vector extension is unavailable.');
  const current = inspectConfig();
  const patch = buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath: resolve(home, 'tanaab', 'canon'),
    home,
    vectorExtensionPath,
    operatorModelAdmissions:
      process.env.SMUTLORD_OPERATOR_MODEL_ADMISSIONS === undefined
        ? []
        : parseJson(process.env.SMUTLORD_OPERATOR_MODEL_ADMISSIONS, 'operator model admissions'),
  });
  return { current, patch, vectorExtensionPath };
}

export function checkOpenClawConfig() {
  const { current, patch, vectorExtensionPath } = desiredConfig();
  if (!configPatchSatisfied(current, patch)) return false;

  const statuses = parseJson(
    run('openclaw', ['memory', 'status', '--agent', agentId, '--json']).stdout,
    'openclaw memory status',
  );
  const hooks = parseJson(
    run('openclaw', ['hooks', 'list', '--json']).stdout,
    'openclaw hooks list',
  );
  return memoryStatusHealthy(statuses, vectorExtensionPath) && sessionMemoryHookHealthy(hooks);
}

export function applyOpenClawConfig() {
  const { patch } = desiredConfig();
  const input = JSON.stringify(patch);
  run('openclaw', ['config', 'patch', '--stdin', '--dry-run', '--json'], { input });
  run('openclaw', ['config', 'patch', '--stdin'], { input });
}
