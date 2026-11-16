# Advanced

Commands for installed `smutlord` workspace. For initial setup, use
[README quickstart](./README.md#quickstart).

## Command cheat sheet

Choose command you need and run it from installed checkout. This is cheat sheet,
not script to run from top to bottom.

```sh
# Validate manifest without applying changes.
openclaw agent-system validate

# Apply configuration changes and run setup.
# Apply openclaw.patch.json through this installer, not directly.
openclaw agent-system install --yes

# Inspect readiness and drift. No repairs applied.
openclaw agent-system doctor

# Reconcile configured components; skip all setup checks and tasks.
# Skipped checks do not prove setup is ready.
openclaw agent-system install --skip-setup

# Confirm agent's GitHub identity.
openclaw agent-system tool gh -- api user --jq .login

# Inspect configured automations and installed schedules.
openclaw agent-system automations list

# Run backup now (creates and delivers a real backup).
openclaw agent-system automations run backup-agent

# Inspect recent backup execution and delivery results.
openclaw agent-system automations runs backup-agent --limit 10
```

## Backup ID migration

`backup-agent` replaces `backup-agent-nightly`; display name is **💾 BACKUP AGENT**.
This changes invocation ID, not agent identity or backup format. Archive names,
Drive destination, retention, permissions, credentials, and backup command stay
unchanged. Schedule remains daily at 03:00 America/New_York.

Apply this live change only with separate operator authorization, from installed
workspace, not a task worktree:

1. Before updating the installed declaration, record `automations list --json`
   and `automations runs backup-agent-nightly --limit 10 --json` using the command
   prefix above. Confirm owned old job, enabled state, cron/timezone, reporting
   destination, and no active backup. Compare installed backup settings with the
   proposed declaration. Stop on drift or uncertain ownership; do not reset state.
   If old job was intentionally disabled, preserve that intent with `enabled: false`
   on the replacement declaration before sync. Do not enable it just for validation.
2. Update installed checkout to the reviewed rename. Run
   `openclaw agent-system validate`, then
   `openclaw agent-system automations sync --json`. This uses supported ownership
   reconciliation without unrelated setup work. Run away from the 03:00 boundary:
   replacement creation and old-job disabling are not an atomic rename. If sync
   fails, inspect its completed/pending outcomes before continuing; do not manually
   add another job, delete the old job, or edit the ownership ledger.
3. Inspect `openclaw agent-system automations list --json`. Expect replacement
   native name `SMUTLORD: backup-agent`, display **💾 BACKUP AGENT**, unchanged
   cron/timezone and intended enabled state. For an enabled installation, only
   replacement should be active. Old job stays disabled and owned, with history
   retained; it is not an orphan to delete. Repeating sync should be unchanged,
   with no duplicate replacement. Check both IDs with `automations runs`;
   historical runs remain under `backup-agent-nightly`, not merged into the new ID.
4. Only when a real backup is authorized, use the manual command above. Inspect
   returned run ID with `automations runs backup-agent --run-id <run-id> --json`.
   Queued is not completed: confirm execution and delivery separately. Preserve
   run evidence and note when live migration occurred. No live migration or real
   backup is implied by repository checks alone.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [OpenClaw model authorization](https://docs.openclaw.ai/cli/models)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
