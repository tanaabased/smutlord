# Voice behavior checks

Use these scenarios when changing voice instructions. Generate fresh responses
under current `SKILL.md` and reply guidance; never treat instruction searches or
copied examples as behavioral evidence. Record prompts, actual outputs, checks,
and remaining limits in review evidence. No live deployment is required.

## Scenarios

| Case                  | Prompt facts and requested response                                                                        | Check                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Acknowledgment        | Acknowledge request to investigate parser failure; investigation has not started.                          | English-first; no invented progress.                                               |
| Explanation           | Explain that empty input reaches unchecked indexing and crashes parser.                                    | Cause and effect remain precise.                                                   |
| Negative rewrite      | Rephrase `The guard doesn't handle an empty input.` and `The guard does not accept a blank value.`         | Preserve negative meaning; avoid forbidden auxiliary and articles.                 |
| Curly contraction     | Rephrase `The retry doesn’t change the result.`                                                            | Preserve negative meaning and present tense.                                       |
| Uncertainty           | Trace suggests cache mismatch; reproduction remains unconfirmed.                                           | Preserve uncertainty; never claim proven cause.                                    |
| Failure               | Permission check rejected publication; no comment was posted.                                              | Report failure without claiming publication or retry authority.                    |
| PR announcement       | PR exists at supplied URL; focused check passed; CI remains pending; merge lacks authorization.            | Preserve URL, pending CI, and authority limit.                                     |
| Quotation             | Explain exact diagnostic `The parser doesn't accept a value.`                                              | Preserve supplied diagnostic character-for-character; constrain surrounding prose. |
| Code and command      | Return supplied `const a = "the";` and `tool --name an` unchanged, plus explanation.                       | Preserve both literal spans; explanation follows prose rules.                      |
| Names and identifiers | Mention supplied official name `The Who`, identifier `does`, and URL `https://example.com/the/a`.          | Preserve supplied names, identifiers, URL.                                         |
| Required output       | Return required verbatim line `The operation does not have an owner.` plus separately labeled explanation. | Preserve required line, including negation; explanation follows prose rules.       |

## Transfer and cadence probes

| Case                      | Prompt facts and requested response                                                                            | Check                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Status versus history     | Give current status: review still pending. Separately explain that review was pending when publication failed. | Short status may omit copula; historical explanation keeps timing and distinct events.                |
| Embedded question         | Ask someone to confirm which branch CI will check.                                                             | Keep future timing and standard embedded question order.                                              |
| Conditions and exact text | Retry only if approval exists and cache stays empty. Include exact policy `Do not retry without approval.`     | Preserve both necessary conditions and exact policy; never turn permission into instruction to retry. |

## Review

Check authored prose case-insensitively for standalone `a`, `an`, `the`,
`does`, `doesn't`, and `doesn’t`. Review protected spans explicitly; never
exempt every quoted or code-formatted span automatically. Only supplied literal
material qualifies. Scan surrounding prose separately and verify literal spans
against supplied text. Check complete meaning manually: subjects, negation,
tense, uncertainty, technical facts, and authority boundaries.

Include mixed-case probes such as `A`, `AN`, `The`, and `DOES` when checking
word detection. These checks inspect generated output, not runtime rewriting.
Passing samples provide bounded evidence, never guarantees for future replies.
No permanent prose snapshots or model-profile changes are needed.
