# smutlord

Hair-metal neckbeard agent for small, narrow bug fixes.

This public workspace contains smutlord's reusable setup code, local skill tooling,
tests, issue forms, and workflows. It is seeded from
[EMORI commit `789df21b4aba17ddce56bffff64112f910aea85e`](https://github.com/tanaabased/emori/commit/789df21b4aba17ddce56bffff64112f910aea85e)
under the preserved [MIT license](./LICENSE). EMORI's persona, artwork, private
state, credentials, and release history are not part of this baseline.

## Status and setup

The [Agent System manifest](./.agent-system/agent.yaml) identifies `smutlord`
and `@smutlord`, but credentials are **unprovisioned**. No 1Password source,
SSH public key, or allowed-signer entry is inherited. Installation must wait for
the separate operator credential task; never use EMORI's credentials to fill the
gap. [Advanced setup notes](./ADVANCED.md) describe the inherited mechanics,
not a completed onboarding.

The [host setup](./.agent-system/setup-host.yaml) installs Brewfile dependencies.
Agent System provisions the shared Codex plugin before setup; the
[agent setup](./.agent-system/setup-agent.yaml) reconciles Canon, iMessage,
and OpenClaw configuration after provisioning. Persona and runtime
policy are documented in [SOUL.md](./SOUL.md) and [AGENTS.md](./AGENTS.md); the copied
[OpenClaw fragment](./openclaw.patch.json) remains a setup baseline, not proof
of completed onboarding.

## Development

Use Node.js 26.9.0 and Bun 1.4.2 (Node.js 24.16.0+ in the 24.x line is also
supported). Install dependencies without scripts, then run credential-free
checks:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run lint
bun run test
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/skill-author
bun skills/skill-author/scripts/validate-skill.js --skill-dir skills/voice
```

The [workspace example](./examples/workspace/README.md) is credential-free but
requires an isolated OpenClaw profile. The copied install, setup, and backup
examples are **hosted integration scenarios** requiring separately provisioned
credentials. Install and setup receive the `SMUTLORDKEY` Actions secret as
`OP_SERVICE_ACCOUNT_TOKEN`; Agent System resolves credentials through the
manifest's 1Password sources. The operator must configure those sources and
service-account access before enabling `HOSTED_EXAMPLES_ENABLED`. Example CI
selects the project Node.js version from `.node-version` after OpenClaw setup.
Local unit and skill checks do not need live credentials.

[`smutlord-skill-author`](./skills/skill-author/SKILL.md) owns local skill
scaffolding and validation. [`smutlord-voice`](./skills/voice/SKILL.md) owns
bug-work prose and its [sourced phrase palette](./skills/voice/references/README.md).
The [behavior scenarios](./references/behavior-scenarios.md) cover bug intake,
scope, verification, voice, and identity. See the
[changelog](./CHANGELOG.md) for smutlord's own version history.
