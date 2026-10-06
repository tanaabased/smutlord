# smutlord

<p align="center">
  <img src="./assets/icon-large-circle.png" alt="smutlord" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-linter.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-linter.yml?event=pull_request&label=Lint" alt="Lint" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-unit-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-unit-tests.yml?event=pull_request&label=Unit%20Tests" alt="Unit tests" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-examples-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-examples-tests.yml?event=pull_request&label=Examples" alt="Example tests" /></a>
</p>

smutlord is an artificial agent for bounded Bugs, Tasks, and Features. Within
his allowed repositories, he takes work assessed at size 5 or below, verifies
the change, and submits a reviewable PR. Explicit special-project exceptions
are defined in [AGENTS.md](./AGENTS.md).
Trust, but verify; enthusiasm is not a test result.

This is his public [OpenClaw](https://openclaw.ai) workspace.
[Agent System](https://github.com/tanaabased/openclaw-agent-system) handles his
identity, tool credentials, and GitHub work intake.

## Overview

- Agent System has [model and effort profiles](./.agent-system/agent.yaml) for
  low, medium, and high task complexity. A small task needn't become a research
  fellowship.
- GitHub assignments run under his own agent identity, in managed Git worktrees.
  Who did the work should be easy to establish.

## Prerequisites

1. Provision the Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart).
2. Update OpenClaw to the version declared in
   [`devDependencies.openclaw`](./package.json). Agentbox's bundled version may
   be older than smutlord's tested baseline.
3. Install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation)
   with shared Codex prerequisite support into that OpenClaw environment;
   Agentbox does not install it yet.
4. Give smutlord's 1Password service account access to the
   [required environment values](./.agent-system/agent.yaml) in his manifest.

Homebrew and Node/npm must be available to the runtime user. smutlord's install
handles his additional [`Brewfile`](./Brewfile) dependencies automatically.

## Quickstart

Run as the OpenClaw runtime user on the Agentbox Mac, with smutlord's 1Password
service account token ready. Keep Agent System commands in this checkout so
that they find his manifest.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/smutlord.git ~/tanaab/smutlord
cd ~/tanaab/smutlord

# use smutlord's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/smutlord.git

# store the 1Password service account token at the masked prompt.
openclaw agent-system credentials set op

# validate the manifest, then accept and run its declared setup.
openclaw agent-system validate
openclaw agent-system install --yes

# authorize smutlord to use the selected provider profile.
# NOTE: adapt Tanaab's OpenAI example to your provider/account and model configuration.
openclaw models auth login --device-code --agent smutlord --profile-id openai:smutlord
openclaw models auth order set --agent smutlord openai:smutlord

# check installed state and confirm the managed GitHub identity is smutlord.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

Agent System provisions the shared Codex plugin before setup. Installation then
runs the host setup in
[`.agent-system/setup-host.yaml`](./.agent-system/setup-host.yaml) before
reconciling managed tools, then runs the agent setup in
[`.agent-system/setup-agent.yaml`](./.agent-system/setup-agent.yaml):

| Step                | Effect                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| `brew-dependencies` | Installs Brewfile dependencies and the platform-specific SQLite vector package. |
| `canon-checkout`    | Clones Canon when absent and preserves existing checkouts.                      |
| `canon-plugin`      | Links Canon's `tanaab` plugin and exposes its shared skills.                    |
| `openclaw-config`   | Reconciles execution, Workshop, and memory policy.                              |

Finish [manual onboarding](./ADVANCED.md#manual-onboarding) for Codex/OpenAI
sign-in. Installation does not complete account consent. For later changes, see
[reconciliation](./ADVANCED.md#reconciliation).

## Configuration

| File                                                                 | Purpose                                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`.agent-system/agent.yaml`](./.agent-system/agent.yaml)             | Identity, model and effort profiles, environment sources, managed Git, GitHub, assignment admission, and setup references. |
| [`.agent-system/setup-host.yaml`](./.agent-system/setup-host.yaml)   | Host dependency check and apply command, run before managed-tool reconciliation.                                           |
| [`.agent-system/setup-agent.yaml`](./.agent-system/setup-agent.yaml) | Ordered agent-aware setup checks and apply commands.                                                                       |
| [`ADVANCED.md`](./ADVANCED.md)                                       | Manual onboarding, reconciliation, configuration ownership, and private continuity.                                        |
| [`IDENTITY.md`](./IDENTITY.md)                                       | Public identity metadata.                                                                                                  |
| [`SOUL.md`](./SOUL.md)                                               | Work remit, character, and voice.                                                                                          |
| [`AGENTS.md`](./AGENTS.md)                                           | Operating and execution guidance.                                                                                          |
| [`USER.md`](./USER.md)                                               | Context about smutlord's operator.                                                                                         |
| [`HEARTBEAT.md`](./HEARTBEAT.md)                                     | Inactive heartbeat instructions; no recurring chores.                                                                      |

See Agent System's
[manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
for manifest options. Private memory stays in ignored workspace files; machine
configuration, credentials, channel state, and transcripts stay outside this
repository.

## Skills

- [`smutlord-skill-author`](./skills/skill-author/SKILL.md) creates and checks
  smutlord-local skills.
- [`smutlord-voice`](./skills/voice/SKILL.md) gives his work prose its
  Russian-influenced cadence and [sourced phrase palette](./skills/voice/references/README.md).

Shared `tanaab-*` workflows come from the
[`tanaab` plugin](https://github.com/tanaabased/canon). His judgment and character
are set out in `SOUL.md`; [behavior scenarios](./references/behavior-scenarios.md)
cover intake, scope, verification, voice, and identity.

## Development

Use Node.js 26.9.0 (selected by [`.node-version`](./.node-version)) and Bun 1.4.2
for repository tooling. Node.js 24.16.0 and later 24.x releases remain supported.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run lint
bun run test
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/skill-author
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/voice
```

[Leia examples](./examples/workspace/README.md) run in isolated GitHub-hosted
OpenClaw profiles: workspace registration, installation, full setup, shared
plugin reuse, and backup recovery. Install and setup use `SMUTLORDKEY` as
`OP_SERVICE_ACCOUNT_TOKEN`; Agent System resolves the manifest's 1Password
sources. Workspace, shared, and backup scenarios need no live credentials.
OpenClaw setup selects a compatible Node.js runtime for the examples.
Run operational scenarios in CI; local unit and skill checks need no credentials.

## Issues, Questions and Support

Bring tasks, bugs, and feature requests to the
[GitHub task queue](https://github.com/tanaabased/smutlord/issues/new/choose).
Say what happened or what would help. A good description can survive without a
sales pitch.

## Changelog

[CHANGELOG.md](./CHANGELOG.md) records the changes.
[GitHub releases](https://github.com/tanaabased/smutlord/releases) will list published versions.

## Maintainers

- [@smutlord](https://github.com/smutlord)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/smutlord/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/smutlord" alt="smutlord contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
