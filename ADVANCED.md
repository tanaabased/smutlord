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
version and installation before setup. Hosted setup CI uses Agent System's
`main` revision.
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

## Drive backups

Nightly backup runs at **03:00 America/New_York** through `backup-agent-nightly`.
It captures a fresh archive with required OpenClaw agent state, uploads it to the
[supplied private My Drive folder](https://drive.google.com/drive/folders/1L21gQkLgTmCZ05UQqV9-zp5n0lp22EMH),
compares the remote size and checksums, and records delivery before cleanup.
Use an Agent System installation whose
[`backup create` verifies before publishing](https://github.com/tanaabased/openclaw-agent-system/blob/main/agent/backup-service.ts).
The nightly wrapper does not download or reverify that archive. Workspace and
database capture are not an atomic snapshot.

Cleanup attempts the existing five-backup local policy and keeps five new
`smutlord-nightly-*` owned Drive uploads. Legacy remote files and unrelated files
are preserved, not adopted or synchronized. A cleanup error reports
`delivered: true` with `retention: "deferred"`; storage can exceed five copies.
An upload or integrity failure still exits nonzero and never starts cleanup.

From the installed smutlord checkout, an explicitly authorized operator can pilot
without either local or remote pruning:

```sh
cd /Users/emori/tanaab/smutlord
bun scripts/backup-drive-task.js --operator --pilot
```

Pilot success prints `"status":"piloted"`. Omit `--pilot` only when intentionally
authorizing retention too. The scheduled command omits `--operator` and requires
the automation runner's active-agent binding, with no host-credential fallback.
A manual pass does not prove unattended execution. Installing this code does not
itself validate a live scheduled run.

Private delivery evidence lives in ignored `.private/backup-drive/delivery.json`
and `delivery-status.json`. Existing `journal.json`, `status.json`, and archives
are preserved during transition; they do not gate fresh nightly delivery. Normal
post-delivery local retention can still remove eligible excess local archives.
An uncertain upload is not retried automatically. A later ordinary invocation
captures new state and preserves superseded intent in `uncertain-*.json`.
Never publish these records or archive contents.

To select one exact completed archive instead of capturing fresh state:

```sh
bun scripts/backup-drive-task.js --operator --pilot --resume-archive .agent-system/backups/EXACT-ARCHIVE.tar.gz
```

Explicit resume verifies that archive and checks its exact delivery evidence. It
can confirm an accepted upload whose reply was lost, but an empty listing never
authorizes replay of a pending upload. Preserve uncertain evidence for
investigation; do not clear it to force another upload. Interrupted staging and
hidden `.pending-*` files are not selected or deleted by this wrapper.

The workflow uses a nonblocking kernel `flock` through `@lickle/lock`, requiring
a supported macOS or Linux native binding and local filesystem. Each direct
managed command inherits the held descriptor, maintaining exclusion after wrapper
death while that command lives. This does not supervise arbitrary descendants.
Closing the last held descriptor releases ownership. The empty `run.lock` stays
in place; never delete or replace it to unlock a run.

Before first upgrading from the existence-only wrapper, stop old scheduled/manual
writers and establish that their outstanding commands have exited. A nonempty
legacy lock reports `legacy-backup-lock`; preserve it under another private
evidence filename only after writer quiescence. Keep the journal, status and all
archives. Installation performs no live cutover.

## Source and artwork

The public setup baseline was seeded from
[EMORI commit `789df21b4aba17ddce56bffff64112f910aea85e`](https://github.com/tanaabased/emori/commit/789df21b4aba17ddce56bffff64112f910aea85e)
under the preserved [MIT license](./LICENSE). EMORI's persona, credentials,
private state, and release history are separate.

Backup orchestration adapts
[EMORI PR #113](https://github.com/tanaabased/emori/pull/113) under the same MIT
license, with smutlord's own identity and destination.

smutlord uses his own [skull-and-guitar artwork](./assets/README.md): the square
PNG for agent identity and the circular variant for the README. Local skills
share these assets and the composer mark.
