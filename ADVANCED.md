# Advanced

helpful commands for `smutlord`'s installed workspace. for initial setup, use the
[README quickstart](./README.md#quickstart).

## Command cheat sheet

run individual commands as needed from the installed checkout.

```sh
# validate the manifest without applying changes.
openclaw agent-system validate

# apply configuration changes and run setup.
# apply openclaw.patch.json through this installer, not directly.
openclaw agent-system install --yes

# inspect readiness and drift without applying repairs.
openclaw agent-system doctor

# reconcile configured components while skipping all setup checks and tasks.
# this does not establish full setup readiness.
openclaw agent-system install --skip-setup

# confirm the agent's GitHub identity.
openclaw agent-system tool gh -- api user --jq .login

# inspect configured automations and installed schedules.
openclaw agent-system automations list

# inspect recent nightly backup execution and delivery results.
openclaw agent-system automations runs backup-agent-nightly --limit 10
```

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [OpenClaw model authorization](https://docs.openclaw.ai/cli/models)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
