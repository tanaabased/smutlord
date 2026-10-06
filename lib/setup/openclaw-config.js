import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { sqliteVectorPackage } from './brew-dependencies.js';
import { parseJson, run } from './command.js';
import { readConfigValue } from './config.js';

const agentId = 'smutlord';
const configFragmentPath = new URL('../../openclaw.patch.json', import.meta.url);
const configSections = ['agents', 'hooks', 'skills', 'tools'];

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
