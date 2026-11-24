# smutlord Skill Standard

This is the contract for smutlord-local skills and their independent scaffolder
and validator. Explicit differences from its Tanaab seed are durable local
decisions, not temporary compatibility gaps.

## Layering

- smutlord-local skills use `smutlord-*` machine ids and own workflows specific to
  this workspace, identity, or operating model.
- Shared skills use `tanaab-*` machine ids and own reusable Tanaab capabilities
  and canon.
- When both layers apply, prefer the narrower smutlord skill for its local surface
  and use the Tanaab skill for everything outside that boundary.
- A local skill may specialize or depart from shared canon, but it must state
  the local boundary or difference explicitly.
- `smutlord-skill-author` creates and validates smutlord-local skills only.
  `tanaab-skill-author` remains the owner for Tanaab Canon skills.

## Validation Contract

- `[error]` means the local skill fails validation.
- `[warn]` means the shape needs review but may be intentional.
- `[manual]` means judgment is required because the rule is not fully
  machine-checkable.
- Shared Tanaab checks apply only where this standard adopts them or leaves the
  concern to the shared layer.

## Identity and Placement

- `[error]` Frontmatter `name` must use lowercase letters, digits, and hyphens
  and start with `smutlord-`.
- `[error]` Frontmatter `metadata.owner` must equal `smutlord`.
- `[error]` Frontmatter `description` must start with `smutlord-based` and say what
  the skill does and when to use it.
- `[error]` Frontmatter `license` must equal `MIT`.
- `[error]` `metadata.type` must match one of the local full-template type ids.
- `[error]` `metadata.tags` must include `smutlord`, the selected type, and at
  least one additional kebab-case category tag.
- `[error]` Strip an accidental duplicate `smutlord-` prefix.
- Inside this repository's `skills/` directory, a folder may omit the `smutlord-`
  prefix while frontmatter and prompts retain the full machine id. A standalone
  skill outside an agent workspace or plugin must use the full machine id as its
  folder name.

## Required Files and Metadata

```text
skill-folder/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── bin/           # optional public commands
├── lib/           # optional orchestration
├── scripts/       # optional internal commands
├── utils/         # optional independently testable units
├── test/          # optional flat tests and support
├── templates/     # optional skill-owned templates
├── assets/        # optional skill-owned assets
└── references/    # optional skill-owned references
```

- `[error]` `SKILL.md` must start with YAML frontmatter containing `name`,
  `description`, `license`, and `metadata`.
- `[error]` `metadata` must contain `type`, `owner`, `tags`, and `openclaw`.
- `[error]` `metadata.openclaw` must contain a skill-specific nonempty `emoji`
  and an HTTPS `homepage`.
- `[error]` Relative links in `SKILL.md` must resolve.
- `[error]` Frontmatter and `agents/openai.yaml` must be valid YAML mappings.
  String fields must remain strings; optional `policy.allow_implicit_invocation`
  uses YAML booleans (`true` or `false`, without quotes).
- `[error]` Section order must match the selected local full template; optional
  sections must appear in their declared positions.
- `[error]` `agents/openai.yaml` must contain `display_name`,
  `short_description`, `default_prompt`, `brand_color`, `icon_small`, and
  `icon_large` beneath `interface`.
- `[error]` `interface.short_description` must start with `smutlord-based`, the
  prompt must mention `$<machine-id>`, and the brand color must be `#00c88a`.
- `[error]` Interface icon paths are relative to the skill directory and must
  resolve. See [Codex category icons](#codex-category-icons) for shared artwork
  and standalone exports.

### Codex category icons

Choose by primary job, not by skill name, frontmatter type, or workflow stage.
Reuse [Tanaab Actions glyph colors](https://github.com/tanaabased/actions/blob/main/AGENTS.md#documentation)
for both square border and flame, but use local categories.

| Category      | Primary job                                                               | SVG                            | Color           |
| ------------- | ------------------------------------------------------------------------- | ------------------------------ | --------------- |
| Agent         | Maintain agent behavior, voice, or local skills                           | `skill-icon-agent.svg`         | Pink `#9c1c55`  |
| Code          | Build, test, review, or maintain code, including code-focused GitHub work | `skill-icon-code.svg`          | Blue `#0069b8`  |
| Miscellaneous | Handle work outside Agent and Code                                        | `skill-icon-miscellaneous.svg` | Green `#008f64` |

Skill Author and Voice both use Agent. Copy matching SVG from
[Skill Author assets](../skills/skill-author/assets/) into your skill's
`assets/` and point `interface.icon_small` to that local copy.
Scaffolds bundle Miscellaneous as `./assets/icon-small.svg`; replace its contents
for Agent or Code skills. Keep `icon_large` pointed at bundled copy of
`icon-large.png`. Codex can then find both icons when skills move or ship alone.
Keep `brand_color` and OpenClaw emoji independent of icon category. Check paths
with local validator and preview small marks on light and dark backgrounds.

## Resources and Code

- Keep support material with the nearest skill owner unless it is reused across
  live skills, defines a true repository-wide contract, or has standalone human
  value.
- Keep public commands in `bin/`, internal commands in `scripts/`, orchestration
  in `lib/`, independently testable functions in `utils/`, and flat tests in
  `test/`.
- Prefer kebab-case for repository-authored resource filenames unless an
  external tool requires a fixed name.
- Shebang-bearing entrypoints should be executable; ordinary source files
  should not be executable.

## Templates and Optimization

- Start smutlord-local skills from the matching local full template so the smutlord
  standard, OpenClaw metadata, and section order are deterministic.
- Supply a skill-specific OpenClaw emoji. Use the repository skill URL as the
  default homepage unless the skill has a different canonical source.
- Coding skills own their `Documentation` and `Testing` guidance and may retain
  optional `Deployment` only when one canonical delivery mechanism materially
  shapes the owned code surface.
- A coding skill's `GitHub Actions` section projects its owned lifecycle into
  canonical workflow paths and templates. It does not own or duplicate the
  underlying documentation, testing, deployment, or release doctrine.
- Retain and tailor `## Optimization` when the skill owns persistent alignment.
  Remove it for incident-specific, event-specific, or execution-only skills.
- Apply keep, reconcile, deduplicate, consolidate or merge, split, extract,
  move, tighten, and remove only where repository evidence supports them.

## Validation

- Run `bun skills/skill-author/scripts/validate-skill.js --skill-dir <path>`
  from the repository root for every created or standardized local skill.
- Fix every `[error]`; review `[warn]` and `[manual]` results explicitly.
- Confirm a smutlord-local skill owns one narrow local surface and does not absorb
  a shared Tanaab capability merely to override precedence.
- For coding skills, confirm optional `Deployment` has one material mechanism
  and `GitHub Actions` maps lifecycle sections without duplicating their rules.
- Search for stale ids, prompts, links, and folder names after identity changes.
