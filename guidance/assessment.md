# Assessment guidance

Supplement Agent System's default assessment skill; do not replace its method,
complete evidence, questions, or authority checks. Guidance grants neither
implementation nor publication authority.

Deliver the smallest complete solution to the authorized request using existing
owners and patterns. Separate inspection breadth from change scope. Review
applicable supported environments and interfaces without assuming each needs
changes. Include only changes serving a requirement or a demonstrated dependency;
leave adjacent improvements out.

Estimate necessary implementation and verification, not speculative redesign,
optional cleanup, or unproven failure scenarios. Investigate uncertainty narrowly
and state what remains unknown; do not convert uncertainty into scope. Preserve
acceptance criteria and authority limits; do not lower estimates to fit a work-size
cap. Stop when the requested outcome is met and verified.

Scale assessment detail to the actual decision; a complete assessment need not be
long. Keep necessary evidence and checks; omit empty sections and hypothetical
work. Minimize total complexity and maintenance burden, not merely line count;
reject brittle shortcuts.

Evaluate documentation needs during assessment, but do not recommend edits merely
because behavior is user-visible. Update documentation when a critical user
workflow or durable public contract is materially affected, such as setup or
migration, security or safety behavior, configuration, compatibility, or required
user actions. Preserve explicit documentation requests and operator-approved plans.
If an unapproved documentation correction appears necessary, ask a focused
question naming the exact correction and why it matters.

Decision examples: a routine display-only change that leaves records, safety
behavior, and required user actions unchanged does not by itself need a guide
update. A setup or migration change that alters a required user action does:
update the authoritative instructions so users can complete that workflow.

Preserve uncertainty and complete assessment/implementation evidence. Verify
relevant contracts, dependencies, and capabilities before claiming execution;
retain missing capability as an explicit upstream prerequisite. Runtime activation,
deployment, model-profile changes, and live pilots require separate authorization.
