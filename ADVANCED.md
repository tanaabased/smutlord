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
```

## Inspect backup and restore results

Use `openclaw agent-system automations runs backup-agent --limit 10` to inspect
recent runs. Upload completion means Drive accepted archive contents. Retention
can still fail after upload; check which stage failed before taking action.
Failed or unconfirmed uploads leave local nightly archives in place.

Use Agent System backup commands to verify archived contents and restore into staging.
Staged restore recovers files; it neither replaces your installed workspace nor
starts agent runtime. See [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create).

## Recover stopped Update Agent run

Nightly Update Agent advances `main`, installs locked dependencies, reconciles
Agent System without running setup checks or tasks, and runs Doctor.

From your installed `smutlord` checkout, not from any issue worktree, inspect
recent runs and read retained results without replaying changes:

```sh
openclaw agent-system automations runs update-agent --limit 10
bun scripts/update-agent-task.js --report-only
```

If retained results confirm source, dependencies, and install completed, and
Doctor alone remains blocked, use verification-only after correcting reported
health problems. Run only within managed execution; direct shell execution lacks
required authority. Verification requires clean `main` at its recorded commit
and reruns Doctor without pulling or reinstalling:

```sh
bun scripts/update-agent-task.js --verify-only
```

Without managed verification access, use interactive Doctor to inspect current
health. This leaves retained update results unchanged. If application is
uncertain or verification is refused, inspect retained results and checkout.
Do not replay Update Agent to clear uncertainty.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [OpenClaw model authorization](https://docs.openclaw.ai/cli/models)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
