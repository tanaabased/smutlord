import { basename, join } from 'node:path';

import checkDriveFile from './utils/check-drive-file.js';
import cleanupDelivery from './cleanup.js';
import { inspectArchive } from './storage.js';
import readDrivePage from './utils/read-drive-page.js';
import safeFailure from './utils/safe-failure.js';

export const destinationFolder = '1L21gQkLgTmCZ05UQqV9-zp5n0lp22EMH';
const fileFields = 'id,name,size,mimeType,parents,md5Checksum,sha256Checksum,ownedByMe,trashed';
const requireResult = (condition, code) => {
  if (!condition) throw new Error(code);
};

async function listFolder(commands, name) {
  const files = [];
  const tokens = new Set();
  let token = '';
  do {
    requireResult(tokens.size < 100, 'drive-list-limit');
    const page = readDrivePage(
      await commands.drive([
        'drive',
        'ls',
        '--parent',
        destinationFolder,
        '--query',
        `trashed = false${name ? ` and name = '${name}'` : ''}`,
        '--max',
        '100',
        '--fields',
        'files(id,name),nextPageToken,incompleteSearch',
        ...(token ? ['--page', token] : []),
      ]),
      tokens,
    );
    files.push(...page.files);
    token = page.next;
    if (token) tokens.add(token);
  } while (token);
  requireResult(
    new Set(files.map((file) => file.id)).size === files.length,
    'drive-list-duplicates',
  );
  return name ? files.filter((file) => file.name === name) : files;
}

function captureValid(result, path, status, workspace) {
  return (
    result?.status === status &&
    result.agentId === 'smutlord' &&
    result.archive === path &&
    result.settings?.openclawState === 'required' &&
    result.settings?.output === join(workspace, '.agent-system', 'backups') &&
    result.coverage?.openclawState === 'captured' &&
    result.coverage?.stage === 'workspace-and-agent-state' &&
    result.diagnostics?.length === 0 &&
    Number.isFinite(Date.parse(result.capturedAt))
  );
}

/** Create owns archive verification; this wrapper confirms delivery, then best-effort cleanup. */
export default async function runBackupDrive({
  workspace,
  commands,
  storage,
  resumeArchive,
  pilot = false,
  inspect = inspectArchive,
}) {
  let stage = 'preflight';
  const getFile = async (id) =>
    (await commands.drive(['drive', 'get', id, '--fields', fileFields])).file;
  let delivered = false;
  const finish = async (details) => {
    const result = {
      status: pilot ? 'piloted' : 'completed',
      agentId: 'smutlord',
      delivered: true,
      ...details,
    };
    await storage.write('delivery-status', { ...result, finishedAt: new Date().toISOString() });
    return result;
  };
  try {
    const preview = await commands.backup(['create', '--dry-run']);
    requireResult(
      preview?.status === 'preview' &&
        preview.agentId === 'smutlord' &&
        preview.workspaceDir === workspace &&
        preview.settings?.output === join(workspace, '.agent-system', 'backups') &&
        preview.settings?.openclawState === 'required' &&
        Array.isArray(preview.files) &&
        preview.diagnostics?.length === 0,
      'backup-preflight-failed',
    );
    const folder = (
      await commands.drive([
        'drive',
        'get',
        destinationFolder,
        '--fields',
        'id,mimeType,driveId,capabilities,permissions',
      ])
    ).file;
    requireResult(
      folder?.id === destinationFolder &&
        folder.mimeType === 'application/vnd.google-apps.folder' &&
        !folder.driveId &&
        folder.capabilities?.canAddChildren === true &&
        Array.isArray(folder.permissions) &&
        folder.permissions.length > 0 &&
        folder.permissions.every((permission) => permission.type === 'user'),
      'drive-folder-unsafe',
    );

    stage = 'create';
    const created = resumeArchive ? undefined : await commands.backup(['create']);
    const path = resumeArchive ?? created?.archive;
    requireResult(typeof path === 'string', 'backup-create-failed');
    const contents = await inspect(path, workspace);
    const verified = resumeArchive ? await commands.backup(['verify', path]) : created;
    requireResult(
      captureValid(verified, path, resumeArchive ? 'verified' : 'created', workspace),
      'backup-capture-invalid',
    );
    const localName = basename(path);
    requireResult(
      /^smutlord-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}\.tar\.gz$/.test(
        localName,
      ),
      'archive-name-invalid',
    );
    let archive = {
      path,
      name: `smutlord-nightly-${localName.slice(9)}`,
      capturedAt: verified.capturedAt,
      ...contents,
    };

    stage = 'delivery-record';
    const state = (await storage.read('delivery')) ?? {
      version: 1,
      agentId: 'smutlord',
      folder: destinationFolder,
    };
    requireResult(
      state.version === 1 && state.agentId === 'smutlord' && state.folder === destinationFolder,
      'delivery-record-invalid',
    );
    const checkpoint = () => storage.write('delivery', state);
    let receipt;
    if (resumeArchive) {
      receipt = [
        state.pending,
        state.latest,
        await storage.read(`uncertain-${archive.sha256}`),
      ].find((item) => item?.path === path);
      if (!receipt) {
        // Legacy state is evidence only for an explicitly selected archive, never a nightly prerequisite.
        const legacy = await storage.read('journal');
        if (legacy) {
          requireResult(
            legacy.version === 1 &&
              legacy.folder === destinationFolder &&
              legacy.receipts &&
              typeof legacy.receipts === 'object',
            'legacy-receipt-invalid',
          );
          receipt = legacy.receipts[archive.sha256];
        }
      }
      if (receipt) {
        requireResult(
          receipt.path === path &&
            receipt.sha256 === archive.sha256 &&
            receipt.md5 === archive.md5 &&
            receipt.size === archive.size &&
            [archive.name, localName].includes(receipt.name),
          'receipt-conflict',
        );
        archive = { ...archive, name: receipt.name };
      }
    }
    if (state.pending && state.pending.path !== path) {
      requireResult(/^[a-f0-9]{64}$/.test(state.pending.sha256), 'delivery-record-invalid');
      await storage.write(`uncertain-${state.pending.sha256}`, state.pending);
    }
    // Fresh create paths are unique. Never replay a prior capture after a lost response.
    requireResult(
      resumeArchive || ![state.pending, state.latest].some((item) => item?.path === path),
      'capture-not-fresh',
    );
    let remoteId = receipt?.remoteId;
    if (resumeArchive && !remoteId) {
      const matches = await listFolder(commands, archive.name);
      requireResult(matches.length <= 1, 'duplicate-remote-archive');
      remoteId = matches[0]?.id;
      requireResult(remoteId || !receipt, 'upload-outcome-unknown');
    }
    state.pending = { ...archive, ...(remoteId ? { remoteId } : {}), uploadPending: true };
    await checkpoint();
    stage = 'upload';
    if (!remoteId) {
      const uploaded = await commands.drive([
        'drive',
        'upload',
        path,
        '--name',
        archive.name,
        '--parent',
        destinationFolder,
        '--mime-type',
        'application/gzip',
      ]);
      remoteId = uploaded?.file?.id;
      requireResult(typeof remoteId === 'string' && remoteId.length > 0, 'upload-outcome-unknown');
      state.pending.remoteId = remoteId;
      await checkpoint();
    }
    stage = 'remote-check';
    const remote = await getFile(remoteId);
    requireResult(
      remote?.id === remoteId && checkDriveFile(remote, archive, destinationFolder),
      'remote-integrity-failed',
    );
    if (state.latest?.cleanup?.pendingRemoteId || state.latest?.cleanup?.local === 'pending') {
      requireResult(/^[a-f0-9]{64}$/.test(state.latest.sha256), 'delivery-record-invalid');
      await storage.write(`cleanup-uncertain-${state.latest.sha256}`, state.latest);
    }
    state.latest = { ...archive, remoteId, deliveredAt: new Date().toISOString() };
    delete state.pending;
    await checkpoint();
    delivered = true;
    // Delivery evidence survives even if cleanup or its status update is interrupted.
    await finish({
      retention: pilot ? 'skipped' : 'pending',
      ...(pilot ? { uploadedVerified: 1, retentionApplied: false } : {}),
    });
    if (pilot)
      return {
        status: 'piloted',
        agentId: 'smutlord',
        delivered: true,
        retention: 'skipped',
        uploadedVerified: 1,
        retentionApplied: false,
      };
    stage = 'cleanup';
    try {
      return await finish(
        await cleanupDelivery({
          commands,
          workspace,
          archive: state.latest,
          getFile,
          list: () => listFolder(commands),
          folder: destinationFolder,
          recordCleanup: async (cleanup) => {
            state.latest.cleanup = cleanup;
            await checkpoint();
          },
        }),
      );
    } catch (error) {
      return await finish({ retention: 'deferred', ...safeFailure(error) });
    }
  } catch (error) {
    if (delivered)
      return {
        status: pilot ? 'piloted' : 'completed',
        agentId: 'smutlord',
        delivered: true,
        retention: 'deferred',
        ...safeFailure(error),
      };
    await storage.write('delivery-status', {
      status: 'failed',
      stage,
      ...safeFailure(error),
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
