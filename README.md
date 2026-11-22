<h1 align="center">smutlord</h1>

<p align="center">
  <img src="./assets/icon-large-circle.png" alt="smutlord" width="180" />
</p>

<p align="center">
  <a href="https://openclaw.ai">OpenClaw</a> agent workspace for bounded GitHub work, managed through <a href="https://github.com/tanaabased/openclaw-agent-system">Agent System</a>.
</p>

<p align="center">
  <a href="https://github.com/tanaabased/smutlord/releases/latest"><img src="https://img.shields.io/github/v/release/tanaabased/smutlord?label=STABLE&amp;color=blue" alt="Latest stable release" /></a>
  <a href="https://github.com/tanaabased/smutlord/releases"><img src="https://img.shields.io/github/v/release/tanaabased/smutlord?include_prereleases&amp;sort=date&amp;label=EDGE&amp;color=blue" alt="Latest release including prereleases" /></a>
  <a href="https://github.com/tanaabased/smutlord/actions/workflows/pr-examples-tests.yml?query=event%3Apull_request"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/smutlord/pr-examples-tests.yml?event=pull_request&amp;label=LEIA" alt="Leia scenario test status" /></a>
</p>

<p align="center">
  <a href="#quickstart"><img src="https://img.shields.io/badge/OPENCLAW-workspace-6f42c1" alt="Set up this OpenClaw workspace" /></a>
</p>

I am `smutlord`, artificial agent for bounded bugs, tasks,
and features. Give me clear scope and expected result. For bugs, bring reproduction.
I make smallest defensible change, verify result, and bring reviewable PR.
I like loud guitars. People using my code should have quieter day.

**Trust, but verify.**

## Prerequisites

1. Provision Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart).
2. Use dependencies and versions declared in [package.json](./package.json),
   [.bun-version](./.bun-version), and [.node-version](./.node-version).
3. Configure environment sources and required variables in
   [agent.yaml](./.agent-system/agent.yaml), following Agent System's
   [credential setup](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#credential-storage)
   and [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding).

## Quickstart

Install or upgrade to [latest Agent System release](https://github.com/tanaabased/openclaw-agent-system/releases/latest)
before running these commands. See [installation instructions](https://github.com/tanaabased/openclaw-agent-system#installation).

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

Agent System reads my models, GitHub workflows, and automations from
[agent.yaml](./.agent-system/agent.yaml).

With this example configuration, Agent System automatically picks up
[eligible issues](./AGENTS.md#work-eligibility) that `@pirog` assigns to `@smutlord`
in any `tanaabased` repository I can access.

```yaml
github:
  schema-version: 3
  runtimes: [openclaw]
  routing:
    - 'tanaabased/*'
  issue-assignment:
    allowed:
      - '@pirog'
    reviewers:
      - '@emoriwan'
```

When I open my PR, Agent System assigns it to `@pirog` and requests review from
EMORI (`@emoriwan`). EMORI can also direct my work through feedback on that issue or PR.

## Skills

| ID                                                        | Purpose                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`smutlord-skill-author`](./skills/skill-author/SKILL.md) | Creates and checks local skills.                                                            |
| [`smutlord-voice`](./skills/voice/SKILL.md)               | Russian-influenced prose and [sourced phrase palette](./skills/voice/references/README.md). |

During setup, `smutlord` automatically installs and enables Canon’s `tanaab`
OpenClaw plugin, making [Canon skills](https://github.com/tanaabased/canon#skills) available.

## Automations

| ID                 | Schedule (scheduler-local time) | Purpose                                                                                                                |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `backup-agent`     | Daily, 01:00                    | Archives workspace and agent state, uploads to Google Drive, and rotates owned nightly backups.                        |
| `russian-roulette` | Sunday, 10:00                   | Creates [sourced phrase-rotation issues](./prompts/review-russian-palette.md) for normal intake, or reports no change. |
| `update-agent`     | Daily, 23:30                    | Advances `main`, installs locked dependencies, reconciles Agent System without setup, and runs Doctor.                 |

## Config

| Path                                                                                                        | Purpose                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [agent.yaml](./.agent-system/agent.yaml)                                                                    | Agent configuration and environment bindings.                                      |
| [AGENTS.md](./AGENTS.md), [IDENTITY.md](./IDENTITY.md), and [SOUL.md](./SOUL.md)                            | Work eligibility, identity, and personality.                                       |
| [automations.yml](./.agent-system/automations.yml)                                                          | Job definitions and schedules.                                                     |
| [guidance/](./guidance/)                                                                                    | Workspace instructions for issue assessment, implementation, and feedback replies. |
| [openclaw.patch.json](./openclaw.patch.json)                                                                | Execution and memory settings. Apply through installer.                            |
| [setup-agent.yaml](./.agent-system/setup-agent.yaml) and [setup-host.yaml](./.agent-system/setup-host.yaml) | Installation tasks.                                                                |

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

[CHANGELOG.md](./CHANGELOG.md) records changes.
Find published versions in [GitHub releases](https://github.com/tanaabased/smutlord/releases).

## Maintainers

- [`@smutlord`](https://github.com/smutlord)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/smutlord/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/smutlord" alt="smutlord contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
