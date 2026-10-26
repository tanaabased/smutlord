# `smutlord`

<p align="center">
  <img src="./assets/icon-large-circle.png" alt="smutlord" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-linter.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-linter.yml?event=pull_request&label=Lint" alt="Lint" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-unit-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-unit-tests.yml?event=pull_request&label=Unit%20Tests" alt="Unit tests" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-examples-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-examples-tests.yml?event=pull_request&label=Examples" alt="Example tests" /></a>
</p>

`smutlord` is an artificial agent for bounded bugs, tasks, and features, with a
Russian voice, late-’80s hair-metal attitude, and a soft heart. he makes the
smallest defensible change, verifies it, and delivers a reviewable PR.

**trust, but verify.**

this is his public [OpenClaw](https://openclaw.ai) workspace, managed through
[Agent System](https://github.com/tanaabased/openclaw-agent-system).

## Prerequisites

1. provision the Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart)
   and install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation).
2. use the dependencies and versions declared in [package.json](./package.json),
   [.bun-version](./.bun-version), and [.node-version](./.node-version).
3. configure the environment sources and required variables in
   [agent.yaml](./.agent-system/agent.yaml), following Agent System's
   [credential setup](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#credential-storage)
   and [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding).

## Quickstart

run as the OpenClaw user with `smutlord`'s 1Password service account token ready.
keep Agent System commands in this checkout.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/smutlord.git ~/tanaab/smutlord
cd ~/tanaab/smutlord

# install the workspace's locked dependencies, including the backup runner.
bun install --frozen-lockfile --ignore-scripts

# use the agent's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/smutlord.git

# store the 1Password service account token at the masked prompt.
openclaw agent-system credentials set op

# validate the manifest, then accept and run its declared setup.
openclaw agent-system validate
openclaw agent-system install --yes

# authorize the agent to use the selected provider profile.
# NOTE: adapt Tanaab's OpenAI example to your provider/account and model configuration.
openclaw models auth login --device-code --agent smutlord --profile-id openai:smutlord
openclaw models auth order set --agent smutlord openai:smutlord

# check installed state, including Google account verification, and confirm GitHub identity.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

for later configuration changes and readiness checks, see the
[Advanced cheat sheet](./ADVANCED.md#command-cheat-sheet).

## Usage

configure issue assigners (`github.issue-assignment.allowed`) and permitted
repository owners (`github.allowed-repository-owners`) in
[agent.yaml](./.agent-system/agent.yaml), following Agent System's
[GitHub workflow configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#github-workflows).
rerun [installation](./ADVANCED.md#command-cheat-sheet) to apply changes, then
have an approved assigner assign an [eligible issue](./AGENTS.md#work-eligibility)
to `@smutlord`.

## Config

| Files                                                                                             | Purpose                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [agent.yaml](./.agent-system/agent.yaml)                                                          | agent configuration and environment bindings.                 |
| [host setup](./.agent-system/setup-host.yaml) and [agent setup](./.agent-system/setup-agent.yaml) | installation tasks.                                           |
| [OpenClaw policy](./openclaw.patch.json)                                                          | execution and memory settings, applied through the installer. |
| [IDENTITY.md](./IDENTITY.md), [SOUL.md](./SOUL.md), and [AGENTS.md](./AGENTS.md)                  | identity, personality, and work eligibility.                  |

## Skills

| Skill                                                     | Purpose                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`smutlord-skill-author`](./skills/skill-author/SKILL.md) | creates and checks local skills.                                                              |
| [`smutlord-voice`](./skills/voice/SKILL.md)               | Russian-influenced prose and a [sourced phrase palette](./skills/voice/references/README.md). |
| [Tanaab plugin](https://github.com/tanaabased/canon)      | shared workflows.                                                                             |

## Automations

| Automation             | Schedule                      | Purpose                                                                                       |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `backup-agent-nightly` | daily, 03:00 America/New_York | backs up workspace and agent state to Google Drive, verifies delivery, and applies retention. |

configured in [agent.yaml](./.agent-system/agent.yaml); inspect installed jobs and
run history with the [Advanced commands](./ADVANCED.md#command-cheat-sheet).

## Development

```sh
bun install --frozen-lockfile --ignore-scripts
bun run lint
bun run test
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/skill-author
```

operational examples run in [CI](./.github/workflows/pr-examples-tests.yml).

## Issues, Questions and Support

Bring tasks, bugs, and feature requests to the
[GitHub task queue](https://github.com/tanaabased/smutlord/issues/new/choose).
Say what happened or what would help. A good description can survive without a
sales pitch.

## Changelog

[CHANGELOG.md](./CHANGELOG.md) records the changes.
[GitHub releases](https://github.com/tanaabased/smutlord/releases) will list published versions.

## Maintainers

- [`@smutlord`](https://github.com/smutlord)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/smutlord/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/smutlord" alt="smutlord contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
