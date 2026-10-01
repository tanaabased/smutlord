# smutlord

Tanaab-based neckbeard for optimal bug fix throughput.

This public workspace contains SMUTLORD's reusable setup code, local skill tooling,
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
The [agent setup](./.agent-system/setup-agent.yaml) reconciles Canon, Codex,
iMessage, and OpenClaw configuration after provisioning. Persona and runtime
policy are separate work; the copied [OpenClaw fragment](./openclaw.patch.json)
is a rebranded baseline, not a new policy decision.

## Development

Use Node.js 26.9.0 and Bun 1.4.2 (Node.js 24.15.0+ in the 24.x line is also
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
credentials; their CI job is disabled until the operator provisions its
`SMUTLORD_*` values and enables `SMUTLORD_HOSTED_EXAMPLES_ENABLED`. Local
unit and skill checks do not need live credentials.

[`smutlord-skill-author`](./skills/skill-author/SKILL.md) owns local skill
scaffolding and validation. [`smutlord-voice`](./skills/voice/SKILL.md) retains
the voice-skill structure without importing EMORI's persona; voice decisions
remain open. See the [changelog](./CHANGELOG.md) for smutlord's own version
history.
