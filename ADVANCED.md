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

# Inspect recent backup or update runs.
openclaw agent-system automations runs backup-agent --limit 10
openclaw agent-system automations runs update-agent --limit 10

# Read retained update results without replaying changes.
bun scripts/update-agent-task.js --report-only

# After fixing Doctor findings, recheck applied update through managed execution only.
bun scripts/update-agent-task.js --verify-only
```

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [OpenClaw model authorization](https://docs.openclaw.ai/cli/models)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
