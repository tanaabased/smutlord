# Advanced operations

Operator details for smutlord's installed workspace. Start with the
[README quickstart](./README.md#quickstart).

## Manual onboarding

After provisioning smutlord-specific credentials and completing installation,
sign in to Codex/OpenAI using the operator-approved account flow.

## Reconciliation

From smutlord's checkout, rerun `openclaw agent-system install --yes` to reconcile
changes, then run `openclaw agent-system doctor` to inspect readiness and drift.
Existing Canon checkouts are preserved; installation does not pull their latest
changes.

Installation-only automation can use `openclaw agent-system install --skip-setup`.
This skips every setup check and apply, so it does not establish full readiness.

## Configuration ownership

Agent System owns the identity, model and effort profiles, credentials, Git/SSH,
GitHub admission, Google account and credentials, and memory-provider binding declared in
[the manifest](./.agent-system/agent.yaml).

Use Agent System with shared Codex prerequisite support; it owns the plugin
version and installation before setup. Hosted setup CI pins an installable
revision containing the declared-runtime fix.
For an existing conflicting plugin, follow [Agent System's upgrade guide](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md).

smutlord's final setup step reconciles [non-model OpenClaw policy](./openclaw.patch.json),
including his execution and memory settings. It preserves managed tool
grants and leaves channel configuration and routing to the operator. Make those
policy changes in the fragment and rerun installation; do not apply the raw
fragment directly, which would bypass the merge logic and replace shared arrays.
Keep chat-model runtime, profiles, effort, and admissions in the Agent System
manifest; Agent System installs them and manages primary and fallback selection.

EMORI's setup owns the shared session-memory hook and Workshop autonomy settings
on the Agentbox. smutlord's setup preserves the host's values and does not require
particular values to pass its checks. On a separate host, the operator owns them.

## Private continuity

Setup does not restore private memory, import conversations, or force an index
rebuild. Continuity restoration, authenticated indexing, and retrieval
verification require separate authorization after setup.

Private memory belongs in ignored workspace storage; credentials, channel state,
and transcripts belong outside this repository. Ignore rules prevent accidental
tracking, not disclosure.

## Source and artwork

The public setup baseline was seeded from
[EMORI commit `789df21b4aba17ddce56bffff64112f910aea85e`](https://github.com/tanaabased/emori/commit/789df21b4aba17ddce56bffff64112f910aea85e)
under the preserved [MIT license](./LICENSE). EMORI's persona, credentials,
private state, and release history are separate.

smutlord uses his own [skull-and-guitar artwork](./assets/README.md): the square
PNG for agent identity and the circular variant for the README. Local skills
share these assets and the composer mark.
