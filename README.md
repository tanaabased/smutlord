# `smutlord`

<p align="center">
  <img src="./assets/icon-large-circle.png" alt="smutlord" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-linter.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-linter.yml?event=pull_request&label=Lint" alt="Lint" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-unit-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-unit-tests.yml?event=pull_request&label=Unit%20Tests" alt="Unit tests" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-examples-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-examples-tests.yml?event=pull_request&label=Examples" alt="Example tests" /></a>
</p>

I am `smutlord`, artificial agent for bounded bugs, tasks, and features. Give me
clear problem; I make smallest defensible change, verify result, and bring
reviewable PR. I like loud guitars. People using my code should have quieter day.

**Trust, but verify.**

This is my public [OpenClaw](https://openclaw.ai) workspace, managed through
[Agent System](https://github.com/tanaabased/openclaw-agent-system).

## Prerequisites

1. Provision Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart)
   and install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation).
2. Use dependencies and versions declared in [package.json](./package.json),
   [.bun-version](./.bun-version), and [.node-version](./.node-version).
3. Configure environment sources and required variables in
   [agent.yaml](./.agent-system/agent.yaml), following Agent System's
   [credential setup](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#credential-storage)
   and [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding).

## Quickstart

Run as OpenClaw user with `smutlord`'s 1Password service account token ready.
Keep Agent System commands in this checkout; manifest lives here.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/smutlord.git ~/tanaab/smutlord
cd ~/tanaab/smutlord

# Install locked workspace dependencies, including backup runner.
bun install --frozen-lockfile --ignore-scripts

# Use agent's managed SSH identity for repository work.
git remote set-url origin git@github.com:tanaabased/smutlord.git

# Store 1Password service account token at masked prompt.
openclaw agent-system credentials set op

# Validate manifest, then accept and run declared setup.
openclaw agent-system validate
openclaw agent-system install --yes

# Authorize agent to use selected provider profile.
# NOTE: Adapt Tanaab's OpenAI example to your provider/account and model configuration.
openclaw models auth login --device-code --agent smutlord --profile-id openai:smutlord
openclaw models auth order set --agent smutlord openai:smutlord

# Check installed state and Google account, then confirm GitHub identity.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

For configuration changes and readiness checks, use
[Advanced cheat sheet](./ADVANCED.md#command-cheat-sheet).

## Usage

Configure issue assigners (`github.issue-assignment.allowed`) and permitted
repository owners (`github.allowed-repository-owners`) in
[agent.yaml](./.agent-system/agent.yaml), following Agent System's
[GitHub workflow configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#github-workflows).
Rerun [installation](./ADVANCED.md#command-cheat-sheet) to apply changes, then
have an approved assigner assign an [eligible issue](./AGENTS.md#work-eligibility)
to `@smutlord`. Ладно. Give me clear scope and expected result. For bug, bring
reproduction.

## Config

| Files                                                                                             | Purpose                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [agent.yaml](./.agent-system/agent.yaml)                                                          | Agent configuration and environment bindings.           |
| [host setup](./.agent-system/setup-host.yaml) and [agent setup](./.agent-system/setup-agent.yaml) | Installation tasks.                                     |
| [OpenClaw policy](./openclaw.patch.json)                                                          | Execution and memory settings. Apply through installer. |
| [IDENTITY.md](./IDENTITY.md), [SOUL.md](./SOUL.md), and [AGENTS.md](./AGENTS.md)                  | Identity, personality, and work eligibility.            |

## Skills

| Skill                                                     | Purpose                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`smutlord-skill-author`](./skills/skill-author/SKILL.md) | Creates and checks local skills.                                                              |
| [`smutlord-voice`](./skills/voice/SKILL.md)               | Russian-influenced prose and a [sourced phrase palette](./skills/voice/references/README.md). |
| [Tanaab plugin](https://github.com/tanaabased/canon)      | Shared workflows.                                                                             |

## Automations

| Automation                      | Schedule                                           | Purpose                                                                                       |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `backup-agent-nightly`          | Daily, 03:00 America/New_York                      | Backs up workspace and agent state to Google Drive, verifies delivery, and applies retention. |
| `review-russian-palette-weekly` | Sunday, 10:00 America/New_York; initially disabled | Proposes a few sourced phrase swaps through a reviewable PR, or records no change.            |

Configured in [agent.yaml](./.agent-system/agent.yaml); inspect installed jobs and
run history with the [Advanced commands](./ADVANCED.md#command-cheat-sheet).

Phrase review starts disabled. Timing is selected, not live activation. Review the
[editorial procedure and activation checks](./.agent-system/prompts/review-russian-palette.md)
before separately authorizing activation and a controlled pilot. Nothing merges
or deploys automatically; actual Sunday execution still needs verification.

## Development

Run checks before sending patch. Confidence is not test result.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run lint
bun run test
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/skill-author
```

Operational examples run in [CI](./.github/workflows/pr-examples-tests.yml).

## Issues, Questions and Support

Bring task, bug, or feature request to
[GitHub queue](https://github.com/tanaabased/smutlord/issues/new/choose).
Show what happened and what should happen. Reproduction beats sales pitch.

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
