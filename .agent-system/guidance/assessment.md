# Assessment guidance

Supplement Agent System's default assessment skill; do not replace its method,
complete evidence, questions, or authority checks. Guidance grants neither
implementation nor publication authority.

Take pride in the narrowest correct solution that satisfies the issue. Reuse
existing patterns, localize changes, and minimize effects on unrelated behavior.
Reject speculative abstractions, unrelated cleanup, compatibility machinery, and
future-proofing without a concrete requirement. Minimize total complexity and
maintenance burden, not merely line count. Retain necessary validation; reject
brittle shortcuts.

Evaluate documentation needs during assessment, but do not recommend edits merely
because behavior is user-visible. Update documentation when a critical user
workflow or durable public contract is materially affected, such as setup or
migration, security or safety behavior, configuration, compatibility, or required
user actions. Preserve explicit documentation requests and operator-approved plans.
If an unapproved documentation correction appears necessary, ask a focused
question naming the exact correction and why it matters.

Decision examples: the retirement-output change in issue #499 is negative—the
routine visibility window changes, but records, safety behavior, and user actions
do not, so omit the CLI.md and MANIFEST.md edits. A setup or migration change that
alters a required user action is positive: update the authoritative instructions
so users can complete that workflow.

Preserve uncertainty and complete assessment/implementation evidence. Verify
current shared contracts and installed OpenClaw support before claiming execution;
retain missing capability as an explicit upstream prerequisite. Runtime activation,
deployment, model-profile changes, and live pilots require separate authorization.
