import assert from 'node:assert/strict';

import runBackupDrive, { destinationFolder } from '../drive-task.js';

function pilot({
  count = 1,
  remote = false,
  requireDeleteConfirmation = false,
  freshCreates = false,
} = {}) {
  const workspace = '/workspace';
  const archives = Array.from({ length: count }, (_, index) => ({
    path: `/workspace/.agent-system/backups/smutlord-${index}.tar.gz`,
    name: `smutlord-${index}.tar.gz`,
    capturedAt: `2026-01-${String(10 - index).padStart(2, '0')}T00:00:00.000Z`,
    size: 123,
    sha256: `sha-${index}`,
    md5: `md5-${index}`,
  }));
  const files = new Map();
  const events = [];
  const driveCommands = [];
  let journal;
  let status;
  let captures = 0;
  const receipt = (archive) => ({ ...archive, remoteId: `id-${archive.sha256}`, verified: true });
  const makeFile = (archive) => ({
    id: `id-${archive.sha256}`,
    name: archive.name,
    size: String(archive.size),
    sha256Checksum: archive.sha256,
    md5Checksum: archive.md5,
    parents: [destinationFolder],
    ownedByMe: true,
    mimeType: 'application/gzip',
  });
  if (remote) {
    journal = {
      version: 1,
      folder: destinationFolder,
      run: null,
      receipts: Object.fromEntries(archives.map((archive) => [archive.sha256, receipt(archive)])),
    };
    archives.forEach((archive) => files.set(`id-${archive.sha256}`, makeFile(archive)));
  }
  const storage = {
    read: async () => structuredClone(journal),
    write: async (name, value) => {
      if (name === 'journal') journal = structuredClone(value);
      else status = structuredClone(value);
    },
  };
  const commands = {
    async backup(argv) {
      const command = argv[0];
      if (command === 'create' && argv.includes('--dry-run')) {
        events.push('create-preview');
        return {
          status: 'preview',
          agentId: 'smutlord',
          workspaceDir: workspace,
          settings: { output: workspace + '/.agent-system/backups', openclawState: 'required' },
          files: ['MEMORY.md'],
          diagnostics: [],
        };
      }
      events.push(
        command === 'prune' ? (argv.includes('--dry-run') ? 'preview' : 'prune') : command,
      );
      if (command === 'create')
        return {
          status: 'created',
          agentId: 'smutlord',
          archive: archives[freshCreates ? captures++ : 0].path,
        };
      if (command === 'verify')
        return {
          status: 'verified',
          agentId: 'smutlord',
          archive: argv[1],
          capturedAt: archives.find((a) => a.path === argv[1]).capturedAt,
          coverage: { openclawState: 'captured', stage: 'workspace-and-agent-state' },
          settings: { openclawState: 'required' },
          diagnostics: [],
        };
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
      driveCommands.push([...argv]);
      events.push(argv[1]);
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
            .filter((f) => !f.trashed)
            .map((f) => ({ id: f.id, name: f.name })),
          has_more: false,
          nextPageToken: '',
        };
      if (argv[1] === 'upload') {
        const file = makeFile(archives.find((a) => a.path === argv[2]));
        files.set(file.id, file);
        return { file };
      }
      if (argv[1] === 'delete') {
        if (requireDeleteConfirmation && !argv.includes('--force'))
          throw new Error('confirmation-required');
        files.get(argv[2]).trashed = true;
        return {};
      }
      throw new Error('unexpected-command');
    },
  };
  const args = {
    workspace,
    commands,
    storage,
    inspect: async (path) => archives.find((a) => a.path === path),
    roundTrip: async () => {
      events.push('round-trip');
    },
  };
  return {
    args,
    archives,
    files,
    events,
    driveCommands,
    receipt,
    makeFile,
    journal: () => journal,
    status: () => status,
  };
}

describe('backup Drive orchestration safety', () => {
  it('verifies each archive before its upload and the fresh download before older reconciliation or pruning', async () => {
    const p = pilot({ count: 6, remote: true });
    p.files.delete('id-sha-0');
    delete p.journal().receipts['sha-0'];
    await runBackupDrive(p.args);
    const created = p.events.indexOf('create');
    const uploaded = p.events.indexOf('upload');
    const recovered = p.events.indexOf('round-trip');
    const verified = p.events.flatMap((event, index) => (event === 'verify' ? [index] : []));
    assert.equal(verified.length, 6);
    assert(verified.every((index) => index > created));
    assert(verified[1] < uploaded);
    assert(verified[2] > recovered);
    assert(recovered > uploaded);
    assert(p.events.indexOf('prune') > recovered);
  });

  it('allows a complete operator pilot without either retention mutation', async () => {
    const p = pilot({ count: 6, remote: true });
    const result = await runBackupDrive({ ...p.args, pilot: true });
    assert.deepEqual(result, {
      status: 'piloted',
      agentId: 'smutlord',
      uploadedVerified: 5,
      retentionApplied: false,
    });
    assert(p.events.includes('verify') && p.events.includes('round-trip'));
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
    assert.equal(p.files.get('id-sha-5').trashed, undefined);
    assert.equal(p.journal().run, null);
  });

  it('refuses wrong identity, workspace, or missing required capture before any remote operation or creation', async () => {
    for (const change of [
      { agentId: 'emori' },
      { workspaceDir: '/other' },
      { settings: { output: '/workspace/.agent-system/backups', openclawState: 'off' } },
    ]) {
      const p = pilot();
      const backup = p.args.commands.backup;
      p.args.commands.backup = async (argv) => ({ ...(await backup(argv)), ...change });
      await assert.rejects(runBackupDrive(p.args), /backup-preflight-failed/);
      assert.deepEqual(p.events, ['create-preview']);
    }
  });

  it('delivers the fresh backup but defers cleanup when an older archive fails verification', async () => {
    const p = pilot({ count: 2 });
    const backup = p.args.commands.backup;
    p.args.commands.backup = async (argv) => {
      const result = await backup(argv);
      return argv[1] === p.archives[1].path ? { ...result, status: 'failed' } : result;
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.retention, 'deferred');
    assert.equal(result.code, 'backup-verification-failed');
    assert.equal(p.events.filter((event) => event === 'upload').length, 1);
    assert(p.events.includes('round-trip'));
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
  });

  it('stops both retention commands if the local plan changes', async () => {
    const p = pilot({ count: 6, remote: true });
    const backup = p.args.commands.backup;
    let previews = 0;
    p.args.commands.backup = async (argv) => {
      const result = await backup(argv);
      if (argv.includes('--dry-run') && ++previews === 2) result.wouldDelete = [];
      return result;
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.retention, 'deferred');
    assert.equal(result.code, 'local-retention-changed');
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
  });

  it('does not locally prune if remote retention fails', async () => {
    const p = pilot({ count: 6, remote: true });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'delete') throw new Error('drive-denied');
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args), /drive-denied/);
    assert.equal(p.events.includes('prune'), false);
    assert.equal(p.status().stage, 'remote-retention');
  });

  it('adopts the exact owned pilot upload and prunes only after recovery verification', async () => {
    const p = pilot();
    p.files.set('id-sha-0', p.makeFile(p.archives[0]));
    assert.equal((await runBackupDrive(p.args)).status, 'completed');
    assert.equal(p.events.includes('upload'), false);
    assert(p.events.indexOf('prune') > p.events.indexOf('round-trip'));
    assert.equal(p.journal().run, null);
  });

  it('keeps five, trashes only verified owned excess IDs, and leaves unrelated files untouched', async () => {
    const p = pilot({ count: 6, remote: true });
    p.files.set('unrelated', { id: 'unrelated', name: 'other-person.tar.gz' });
    await runBackupDrive(p.args);
    assert.equal(p.files.get('id-sha-5').trashed, true);
    assert.equal(p.files.get('unrelated').trashed, undefined);
    assert.equal(Object.keys(p.journal().receipts).length, 5);
    assert(p.events.indexOf('delete') > p.events.indexOf('round-trip'));
  });

  it('confirms the exact verified excess trash in a non-interactive run and completes retention', async () => {
    const p = pilot({ count: 6, remote: true, requireDeleteConfirmation: true });
    p.files.set('unrelated', { id: 'unrelated', name: 'other-person.tar.gz' });
    const result = await runBackupDrive(p.args);
    const deleteCommands = p.driveCommands.filter((argv) => argv[1] === 'delete');
    assert.deepEqual(deleteCommands, [['drive', 'delete', 'id-sha-5', '--force']]);
    assert.equal(result.status, 'completed');
    assert.equal(result.localKept, 5);
    assert.equal(result.remoteKept, 5);
    assert.equal(p.files.get('id-sha-5').trashed, true);
    assert.equal(p.files.get('unrelated').trashed, undefined);
    assert.equal(Object.keys(p.journal().receipts).length, 5);
    assert.equal(p.journal().run, null);
    assert.equal(p.status().status, 'completed');
  });

  it('captures fresh state and reconciles an older accepted upload without replaying it', async () => {
    const p = pilot({ count: 2, freshCreates: true });
    const drive = p.args.commands.drive;
    let failed = false;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'upload' && !failed) {
        failed = true;
        throw new Error('timeout');
      }
      return result;
    };
    await assert.rejects(runBackupDrive(p.args), /timeout/);
    assert.equal(p.events.includes('prune'), false);
    await runBackupDrive(p.args);
    assert.equal(p.events.filter((e) => e === 'create').length, 2);
    assert.equal(p.events.filter((e) => e === 'upload').length, 2);
    assert.equal(p.journal().receipts['sha-0'].verified, true);
    assert.equal(p.journal().receipts['sha-1'].verified, true);
  });

  it('delivers a fresh backup without replaying an uncertain older upload or pruning', async () => {
    const p = pilot({ count: 2, freshCreates: true });
    const drive = p.args.commands.drive;
    const uploads = [];
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'upload') {
        uploads.push(argv[2]);
        if (argv[2] === p.archives[0].path) throw new Error('timeout');
      }
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args));
    const pending = structuredClone(p.journal().receipts['sha-0']);
    const result = await runBackupDrive(p.args);
    assert.equal(result.status, 'completed');
    assert.equal(result.retention, 'deferred');
    assert.equal(p.events.filter((e) => e === 'create').length, 2);
    assert.deepEqual(
      uploads,
      p.archives.map((archive) => archive.path),
    );
    assert.deepEqual(p.journal().receipts['sha-0'], pending);
    assert.equal(p.journal().receipts['sha-1'].verified, true);
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
  });

  it('allows a fresh capture after creation fails or its successful return is lost', async () => {
    for (const lostReturn of [false, true]) {
      const p = pilot({ count: 2, freshCreates: true });
      const backup = p.args.commands.backup;
      let failed = false;
      p.args.commands.backup = async (argv) => {
        if (argv[0] === 'create' && !argv.includes('--dry-run') && !failed) {
          failed = true;
          if (lostReturn) await backup(argv);
          throw new Error('fixture-create-failed');
        }
        return backup(argv);
      };
      await assert.rejects(runBackupDrive(p.args), /fixture-create-failed/);
      assert.equal(p.journal().run, null);
      assert.equal((await runBackupDrive(p.args)).status, 'completed');
      assert.equal(p.journal().run, null);
      assert.equal(p.events.filter((event) => event === 'upload').length, 1);
    }
  });

  it('retires recognized legacy local checkpoints without resuming or discarding receipts', async () => {
    for (const run of [
      { creating: true },
      { archive: '/workspace/.agent-system/backups/old-missing.tar.gz' },
    ]) {
      const p = pilot({ remote: true });
      const original = p.journal().receipts;
      await p.args.storage.write('journal', { ...p.journal(), run });
      await runBackupDrive(p.args);
      assert.equal(p.events.filter((e) => e === 'create').length, 1);
      assert.deepEqual(p.journal().receipts, original);
      assert.equal(p.journal().run, null);
    }
  });

  it('should defer cleanup for missing old archives or unknown remote deletions after fresh verification', async () => {
    for (const missingLocal of [false, true]) {
      const p = pilot({ count: 6, remote: true });
      const original = structuredClone(p.journal().receipts);
      if (missingLocal) {
        const inspect = p.args.inspect;
        p.args.inspect = async (path) => {
          if (path === p.archives[1].path) throw new Error('fixture-archive-missing');
          return inspect(path);
        };
      } else {
        p.journal().receipts['sha-5'].deleting = true;
        p.files.delete('id-sha-5');
        original['sha-5'].deleting = true;
      }
      const result = await runBackupDrive(p.args);
      assert.equal(result.status, 'completed');
      assert.equal(result.retention, 'deferred');
      assert(p.events.includes('round-trip'));
      assert.deepEqual(p.journal().receipts, original);
      assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
    }
  });

  it('should verify only the explicitly selected archive and reject unknown local checkpoints', async () => {
    const p = pilot();
    await runBackupDrive({ ...p.args, resumeArchive: p.archives[0].path });
    assert.equal(p.events.includes('create'), false);
    assert(p.events.includes('round-trip'));
    await p.args.storage.write('journal', { ...p.journal(), run: { unknown: true } });
    await assert.rejects(runBackupDrive(p.args), /journal-run-invalid/);
    assert.deepEqual(p.journal().run, { unknown: true });
  });

  for (const phase of ['create', 'verify', 'upload', 'round-trip']) {
    it(`preserves backups after ${phase} failure`, async () => {
      const p = pilot();
      const backup = p.args.commands.backup;
      const drive = p.args.commands.drive;
      if (phase === 'round-trip')
        p.args.roundTrip = async () => {
          throw new Error('corrupt-download');
        };
      else if (phase === 'upload')
        p.args.commands.drive = async (argv) => {
          if (argv[1] === phase) throw new Error('failed-upload');
          return drive(argv);
        };
      else
        p.args.commands.backup = async (argv) => {
          if (argv[0] === phase && !argv.includes('--dry-run')) throw new Error('backup-failed');
          return backup(argv);
        };
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
      assert.equal(p.status().status, 'failed');
    });
  }

  it('stops before creating or pruning on incomplete listings', async () => {
    const p = pilot();
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) =>
      argv[1] === 'ls' ? { files: [], has_more: true, nextPageToken: '' } : drive(argv);
    await assert.rejects(runBackupDrive(p.args), /drive-list-incomplete/);
    assert.equal(p.events.includes('create') || p.events.includes('prune'), false);
  });

  it('refuses duplicate names or corrupted remote bytes without deleting anything', async () => {
    for (const duplicate of [false, true]) {
      const p = pilot();
      p.files.set('id-sha-0', { ...p.makeFile(p.archives[0]), sha256Checksum: 'corrupt' });
      if (duplicate) p.files.set('second', { ...p.makeFile(p.archives[0]), id: 'second' });
      await assert.rejects(
        runBackupDrive(p.args),
        duplicate ? /duplicate-remote-archive/ : /remote-integrity-failed/,
      );
      assert.equal(
        p.events.includes('upload') || p.events.includes('delete') || p.events.includes('prune'),
        false,
      );
    }
  });

  it('recovers a completed trash operation whose acknowledgment was lost', async () => {
    const p = pilot({ count: 6, remote: true });
    const drive = p.args.commands.drive;
    let failed = false;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'delete' && !failed) {
        failed = true;
        throw new Error('timeout');
      }
      return result;
    };
    await assert.rejects(runBackupDrive(p.args));
    assert.equal(p.events.includes('prune'), false);
    await runBackupDrive(p.args);
    assert.equal(p.events.filter((e) => e === 'delete').length, 1);
  });
});
