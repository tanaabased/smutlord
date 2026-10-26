import assert from 'node:assert/strict';

import runBackupDrive, { destinationFolder } from '../drive-task.js';

function fixture({ count = 1 } = {}) {
  const workspace = '/workspace';
  const events = [];
  const records = new Map();
  const files = new Map();
  const archives = Array.from({ length: count }, (_, index) => {
    const capturedAt = `2026-01-${String(20 - index).padStart(2, '0')}T00:00:00.000Z`;
    const localName = `smutlord-${capturedAt.replace(/[:.]/g, '-')}-00000000-0000-4000-8000-${String(index).padStart(12, '0')}.tar.gz`;
    return {
      path: `${workspace}/.agent-system/backups/${localName}`,
      name: `smutlord-nightly-${localName.slice(9)}`,
      capturedAt,
      size: 123,
      sha256: index.toString(16).padStart(64, '0'),
      md5: index.toString(16).padStart(32, '0'),
    };
  });
  const makeFile = (archive, id = `id-${archive.sha256}`) => ({
    id,
    name: archive.name,
    size: String(archive.size),
    sha256Checksum: archive.sha256,
    md5Checksum: archive.md5,
    parents: [destinationFolder],
    ownedByMe: true,
    mimeType: 'application/gzip',
  });
  let captures = 0;
  const metadata = (archive) => ({
    agentId: 'smutlord',
    archive: archive.path,
    capturedAt: archive.capturedAt,
    settings: { output: `${workspace}/.agent-system/backups`, openclawState: 'required' },
    coverage: { openclawState: 'captured', stage: 'workspace-and-agent-state' },
    diagnostics: [],
  });
  const storage = {
    async read(name = 'journal') {
      events.push(`read:${name}`);
      return structuredClone(records.get(name));
    },
    async write(name, value) {
      events.push(`write:${name}`);
      records.set(name, structuredClone(value));
    },
  };
  const commands = {
    async backup(argv) {
      if (argv[0] === 'create' && argv.includes('--dry-run')) {
        events.push('preflight');
        return {
          status: 'preview',
          agentId: 'smutlord',
          workspaceDir: workspace,
          settings: metadata(archives[0]).settings,
          files: ['MEMORY.md'],
          diagnostics: [],
        };
      }
      events.push(argv.includes('--dry-run') ? 'prune-preview' : argv[0]);
      if (argv[0] === 'create') return { status: 'created', ...metadata(archives[captures++]) };
      if (argv[0] === 'verify')
        return { status: 'verified', ...metadata(archives.find((a) => a.path === argv[1])) };
      return {
        status: argv.includes('--dry-run') ? 'preview' : 'pruned',
        agentId: 'smutlord',
        keep: 5,
        output: `${workspace}/.agent-system/backups`,
        kept: archives.slice(0, 5).map((a) => a.path),
        wouldDelete: archives.slice(5).map((a) => a.path),
        deleted: argv.includes('--dry-run') ? [] : archives.slice(5).map((a) => a.path),
      };
    },
    async drive(argv) {
      events.push([...argv]);
      if (argv[1] === 'get' && argv[2] === destinationFolder)
        return {
          file: {
            id: destinationFolder,
            mimeType: 'application/vnd.google-apps.folder',
            capabilities: { canAddChildren: true },
            permissions: [{ type: 'user' }],
          },
        };
      if (argv[1] === 'get') return { file: files.get(argv[2]) };
      if (argv[1] === 'ls')
        return {
          files: [...files.values()]
            .filter((file) => !file.trashed)
            .map(({ id, name }) => ({ id, name })),
          has_more: false,
          nextPageToken: '',
        };
      if (argv[1] === 'upload') {
        const archive = archives.find((a) => a.path === argv[2]);
        const file = { ...makeFile(archive), name: argv[argv.indexOf('--name') + 1] };
        files.set(file.id, file);
        return { file };
      }
      if (argv[1] === 'delete') {
        files.get(argv[2]).trashed = true;
        return {};
      }
      throw new Error('unexpected-command');
    },
  };
  return {
    args: {
      workspace,
      commands,
      storage,
      inspect: async (path) => {
        events.push(`inspect:${path}`);
        return archives.find((a) => a.path === path);
      },
    },
    archives,
    records,
    files,
    events,
    makeFile,
    calls: (verb) => events.filter((event) => Array.isArray(event) && event[1] === verb),
  };
}

const noPruning = (p) => {
  assert.equal(p.calls('delete').length, 0);
  assert.equal(p.events.includes('prune'), false);
};

describe('lib/backup/drive-task', () => {
  it('should create, upload and record a fresh delivery before any historical listing or cleanup', async () => {
    const p = fixture();
    p.records.set('journal', { invalid: 'obsolete' });
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'completed');
    assert.equal(p.calls('upload').length, 1);
    assert.equal(p.calls('download').length, 0);
    assert.equal(p.events.includes('verify'), false);
    assert.equal(p.events.includes('read:journal'), false);
    assert(p.events.indexOf('write:delivery') < p.events.indexOf(p.calls('upload')[0]));
    const delivered = p.events.indexOf('write:delivery-status');
    assert(delivered < p.events.indexOf('prune-preview'));
    assert(delivered < p.events.indexOf(p.calls('ls')[0]));
    assert.deepEqual(p.records.get('journal'), { invalid: 'obsolete' });
    assert(p.records.get('delivery').latest.deliveredAt);
    assert.equal(p.records.get('delivery').pending, undefined);
  });

  for (const failure of ['backup-retained-verification-failed', 'managed-command-failed']) {
    it(`should deliver fresh bytes when old-schema cleanup fails (${failure})`, async () => {
      const p = fixture();
      const backup = p.args.commands.backup;
      p.args.commands.backup = async (argv) => {
        if (argv[0] === 'prune') throw new Error(failure);
        return backup(argv);
      };
      const result = await runBackupDrive(p.args);
      assert.equal(result.delivered, true);
      assert.equal(result.status, 'completed');
      assert.equal(result.retention, 'deferred');
      assert.equal(result.code, failure);
      assert.equal(p.calls('upload').length, 1);
      assert.equal(p.calls('ls').length, 0);
      noPruning(p);
    });
  }

  it('should not inspect or reconcile a missing historical remote file', async () => {
    const p = fixture();
    p.records.set('journal', { receipts: { old: { remoteId: 'missing' } } });
    await runBackupDrive(p.args);
    assert.equal(
      p.calls('get').some((argv) => argv[2] === 'missing'),
      false,
    );
    assert.equal(p.events.includes('read:journal'), false);
  });

  for (const change of [
    { agentId: 'emori' },
    { workspaceDir: '/other' },
    { settings: { output: '/other', openclawState: 'required' } },
    { settings: { output: '/workspace/.agent-system/backups', openclawState: 'off' } },
  ]) {
    it('should reject invalid managed preflight before remote calls or creation', async () => {
      const p = fixture();
      const backup = p.args.commands.backup;
      p.args.commands.backup = async (argv) => ({ ...(await backup(argv)), ...change });
      await assert.rejects(runBackupDrive(p.args), /backup-preflight-failed/);
      assert.equal(p.calls('get').length, 0);
      assert.equal(p.events.includes('create'), false);
    });
  }

  for (const change of [
    { agentId: 'other' },
    { coverage: { openclawState: 'absent' } },
    { diagnostics: [{ code: 'failure' }] },
  ]) {
    it('should require verified creation metadata and captured agent state before uploading', async () => {
      const p = fixture();
      const backup = p.args.commands.backup;
      p.args.commands.backup = async (argv) => {
        const result = await backup(argv);
        return argv[0] === 'create' && !argv.includes('--dry-run')
          ? { ...result, ...change }
          : result;
      };
      await assert.rejects(runBackupDrive(p.args), /backup-capture-invalid/);
      assert.equal(p.calls('upload').length, 0);
      noPruning(p);
    });
  }

  for (const change of [
    { driveId: 'shared-drive' },
    { permissions: [{ type: 'anyone' }] },
    { capabilities: { canAddChildren: false } },
  ]) {
    it('should reject an unsafe destination before creating a capture', async () => {
      const p = fixture();
      const drive = p.args.commands.drive;
      p.args.commands.drive = async (argv) => {
        const result = await drive(argv);
        return { file: { ...result.file, ...change } };
      };
      await assert.rejects(runBackupDrive(p.args), /drive-folder-unsafe/);
      assert.equal(p.events.includes('create'), false);
    });
  }

  for (const change of [
    { size: '1' },
    { sha256Checksum: 'corrupt' },
    { md5Checksum: 'corrupt' },
    { ownedByMe: false },
    { parents: ['other'] },
    { id: 'wrong' },
  ]) {
    it('should not report success or prune after a remote integrity mismatch', async () => {
      const p = fixture();
      const drive = p.args.commands.drive;
      p.args.commands.drive = async (argv) => {
        const result = await drive(argv);
        return argv[1] === 'get' && argv[2] !== destinationFolder
          ? { file: { ...result.file, ...change } }
          : result;
      };
      await assert.rejects(runBackupDrive(p.args), /remote-integrity-failed/);
      assert.equal(p.records.get('delivery-status').status, 'failed');
      assert.equal(p.records.get('delivery').latest, undefined);
      assert(p.records.get('delivery').pending);
      noPruning(p);
    });
  }

  for (const accepted of [false, true]) {
    it(`should retain an uncertain upload and never duplicate it on explicit resume (accepted=${accepted})`, async () => {
      const p = fixture();
      const drive = p.args.commands.drive;
      p.args.commands.drive = async (argv) => {
        if (argv[1] === 'upload') {
          if (accepted) await drive(argv);
          throw new Error('timeout');
        }
        return drive(argv);
      };
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.records.get('delivery-status').status, 'failed');
      noPruning(p);
      p.args.commands.drive = drive;
      if (accepted)
        assert.equal(
          (await runBackupDrive({ ...p.args, resumeArchive: p.archives[0].path, pilot: true }))
            .delivered,
          true,
        );
      else
        await assert.rejects(
          runBackupDrive({ ...p.args, resumeArchive: p.archives[0].path }),
          /upload-outcome-unknown/,
        );
      assert.equal(p.calls('upload').length, accepted ? 1 : 0);
      assert.equal(p.events.filter((event) => event === 'create').length, 1);
      assert(p.events.includes('verify'));
      noPruning(p);
    });
  }

  it('should capture afresh after an uncertain upload without reading historical evidence', async () => {
    const p = fixture({ count: 2 });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'upload') throw new Error('timeout');
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args));
    const pending = structuredClone(p.records.get('delivery').pending);
    p.args.commands.drive = drive;
    assert.equal((await runBackupDrive(p.args)).delivered, true);
    assert.deepEqual(p.records.get(`uncertain-${pending.sha256}`), pending);
    assert.deepEqual(
      p.calls('upload').map((argv) => argv[2]),
      [p.archives[1].path],
    );
    assert.equal(
      p.events.filter((event) => typeof event === 'string' && event.startsWith('read:uncertain-'))
        .length,
      0,
    );
  });

  it('should recover a superseded uncertain upload only when explicitly selected', async () => {
    const p = fixture({ count: 2 });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'upload') throw new Error('timeout');
      return result;
    };
    await assert.rejects(runBackupDrive(p.args));
    p.args.commands.drive = drive;
    await runBackupDrive({ ...p.args, pilot: true });
    const result = await runBackupDrive({
      ...p.args,
      resumeArchive: p.archives[0].path,
      pilot: true,
    });
    assert.equal(result.delivered, true);
    assert.equal(p.calls('upload').length, 2);
    assert.equal(p.records.get('delivery').latest.path, p.archives[0].path);
    noPruning(p);
  });

  it('should capture again after the creation return is lost without adopting the orphan', async () => {
    const p = fixture({ count: 2 });
    const backup = p.args.commands.backup;
    let lost = false;
    p.args.commands.backup = async (argv) => {
      const result = await backup(argv);
      if (argv[0] === 'create' && !argv.includes('--dry-run') && !lost) {
        lost = true;
        throw new Error('backup-create-return-lost');
      }
      return result;
    };
    await assert.rejects(runBackupDrive(p.args));
    assert.equal((await runBackupDrive({ ...p.args, pilot: true })).delivered, true);
    assert.deepEqual(
      p.calls('upload').map((argv) => argv[2]),
      [p.archives[1].path],
    );
    noPruning(p);
  });

  it('should preserve an uncertain cleanup record before replacing the last delivery', async () => {
    const p = fixture({ count: 2 });
    const previous = {
      ...p.archives[1],
      remoteId: 'old',
      deliveredAt: '2026-01-19T01:00:00.000Z',
      cleanup: { pendingRemoteId: 'uncertain-trash', remoteDeleted: 1 },
    };
    p.records.set('delivery', {
      version: 1,
      agentId: 'smutlord',
      folder: destinationFolder,
      latest: previous,
    });
    await runBackupDrive({ ...p.args, pilot: true });
    assert.deepEqual(p.records.get(`cleanup-uncertain-${previous.sha256}`), previous);
    assert.equal(
      p.calls('get').some((argv) => argv[2] === 'uncertain-trash'),
      false,
    );
    noPruning(p);
  });

  it('should keep an operator pilot free of both local and remote cleanup', async () => {
    const p = fixture();
    const result = await runBackupDrive({ ...p.args, pilot: true });
    assert.equal(result.status, 'piloted');
    assert.equal(result.uploadedVerified, 1);
    assert.equal(result.retentionApplied, false);
    assert.equal(p.events.includes('prune-preview'), false);
    noPruning(p);
  });

  it('should keep five job-owned remote uploads and preserve legacy and unrelated files', async () => {
    const p = fixture({ count: 7 });
    p.archives.slice(1).forEach((archive) => {
      const file = p.makeFile(archive);
      p.files.set(file.id, file);
    });
    p.files.set('legacy', {
      ...p.makeFile(p.archives[6]),
      id: 'legacy',
      name: p.archives[6].name.replace('smutlord-nightly-', 'smutlord-'),
    });
    p.files.set('foreign', { ...p.makeFile(p.archives[5]), id: 'foreign', ownedByMe: false });
    const result = await runBackupDrive(p.args);
    assert.equal(result.remoteKept, 5);
    assert.equal(result.remoteDeleted, 2);
    assert.equal(p.files.get('legacy').trashed, undefined);
    assert.equal(p.files.get('foreign').trashed, undefined);
    assert.deepEqual(
      p.calls('delete').map((argv) => argv.slice(-1)),
      [['--force'], ['--force']],
    );
    assert(p.events.indexOf('write:delivery-status') < p.events.indexOf(p.calls('delete')[0]));
    assert(p.events.indexOf('prune') > p.events.indexOf(p.calls('delete')[1]));
  });

  it('should defer cleanup after trash failure and preserve the uncertain deletion evidence', async () => {
    const p = fixture({ count: 6 });
    p.archives.slice(1).forEach((archive) => {
      const file = p.makeFile(archive);
      p.files.set(file.id, file);
    });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'delete') throw new Error('drive-denied');
      return drive(argv);
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'deferred');
    assert.equal(p.events.includes('prune'), false);
    assert(p.records.get('delivery').latest.cleanup.pendingRemoteId);
    assert.equal(p.files.get(`id-${p.archives[5].sha256}`).trashed, undefined);
  });

  it('should defer cleanup on incomplete listing after delivering the fresh capture', async () => {
    const p = fixture();
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) =>
      argv[1] === 'ls' ? { files: [], has_more: true, nextPageToken: '' } : drive(argv);
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'deferred');
    assert.equal(result.code, 'drive-list-incomplete');
    noPruning(p);
  });

  it('should defer cleanup if the actual local prune fails after successful preview', async () => {
    const p = fixture();
    const backup = p.args.commands.backup;
    p.args.commands.backup = async (argv) => {
      if (argv[0] === 'prune' && !argv.includes('--dry-run'))
        throw new Error('backup-retained-verification-failed');
      return backup(argv);
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'deferred');
    assert.equal(p.records.get('delivery-status').status, 'completed');
    assert.equal(p.records.get('delivery').latest.cleanup.local, 'pending');
  });

  it('should preserve delivery and skip cleanup if status recording fails after confirmation', async () => {
    const p = fixture();
    const write = p.args.storage.write;
    p.args.storage.write = async (name, value) => {
      if (name === 'delivery-status') throw new Error('storage-write-failed');
      return write(name, value);
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'deferred');
    assert(p.records.get('delivery').latest.deliveredAt);
    assert.equal(p.events.includes('prune-preview'), false);
    noPruning(p);
  });

  for (const phase of ['create', 'upload-id', 'delivery-record']) {
    it(`should never prune or report success when fresh delivery fails at ${phase}`, async () => {
      const p = fixture();
      if (phase === 'create') {
        const backup = p.args.commands.backup;
        p.args.commands.backup = async (argv) => {
          if (argv[0] === 'create' && !argv.includes('--dry-run'))
            throw new Error('backup-create-failed');
          return backup(argv);
        };
      } else if (phase === 'upload-id') {
        const drive = p.args.commands.drive;
        p.args.commands.drive = async (argv) => (argv[1] === 'upload' ? {} : drive(argv));
      } else {
        const write = p.args.storage.write;
        p.args.storage.write = async (name, value) => {
          if (name === 'delivery' && value.latest) throw new Error('storage-write-failed');
          return write(name, value);
        };
      }
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.records.get('delivery-status').status, 'failed');
      assert.equal(p.records.get('delivery')?.latest, undefined);
      noPruning(p);
    });
  }

  it('should preserve all candidates if a listed job-owned file has unsafe metadata', async () => {
    const p = fixture({ count: 7 });
    p.archives.slice(1).forEach((archive) => {
      const file = p.makeFile(archive);
      p.files.set(file.id, file);
    });
    p.files.get(`id-${p.archives[6].sha256}`).parents = ['other'];
    const result = await runBackupDrive(p.args);
    assert.equal(result.retention, 'deferred');
    assert.equal(result.code, 'remote-retention-unsafe');
    noPruning(p);
  });

  it('should recheck the exact excess ID before trashing and stop if it changed', async () => {
    const p = fixture({ count: 6 });
    p.archives.slice(1).forEach((archive) => {
      const file = p.makeFile(archive);
      p.files.set(file.id, file);
    });
    const excess = `id-${p.archives[5].sha256}`;
    const drive = p.args.commands.drive;
    let reads = 0;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'get' && argv[2] === excess && ++reads === 2)
        return { file: { ...result.file, id: 'wrong-id' } };
      return result;
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivered, true);
    assert.equal(result.retention, 'deferred');
    assert.equal(result.code, 'remote-integrity-failed');
    noPruning(p);
  });

  it('should refuse an incomplete exact-attempt recovery listing without duplicating upload', async () => {
    const p = fixture();
    p.records.set('delivery', {
      version: 1,
      agentId: 'smutlord',
      folder: destinationFolder,
      pending: { ...p.archives[0], uploadPending: true },
    });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) =>
      argv[1] === 'ls' ? { files: [], has_more: true, nextPageToken: '' } : drive(argv);
    await assert.rejects(
      runBackupDrive({ ...p.args, resumeArchive: p.archives[0].path }),
      /drive-list-incomplete/,
    );
    assert.equal(p.calls('upload').length, 0);
    noPruning(p);
  });

  it('should reject ambiguous exact-attempt recovery without uploading', async () => {
    const p = fixture();
    for (const id of ['one', 'two']) p.files.set(id, p.makeFile(p.archives[0], id));
    await assert.rejects(
      runBackupDrive({ ...p.args, resumeArchive: p.archives[0].path }),
      /duplicate-remote-archive/,
    );
    assert.equal(p.calls('upload').length, 0);
    noPruning(p);
  });

  it('should verify and recover a legacy exact receipt without rewriting its journal', async () => {
    const p = fixture();
    const archive = {
      ...p.archives[0],
      name: p.archives[0].name.replace('smutlord-nightly-', 'smutlord-'),
    };
    const file = p.makeFile(archive);
    p.files.set(file.id, file);
    const legacy = {
      version: 1,
      folder: destinationFolder,
      receipts: { [archive.sha256]: { ...archive, remoteId: file.id, verified: true } },
    };
    p.records.set('journal', legacy);
    const result = await runBackupDrive({ ...p.args, resumeArchive: archive.path, pilot: true });
    assert.equal(result.delivered, true);
    assert.equal(p.events.includes('create'), false);
    assert.equal(p.events.filter((event) => event === 'verify').length, 1);
    assert.equal(p.calls('upload').length, 0);
    assert.deepEqual(p.records.get('journal'), legacy);
  });
});
