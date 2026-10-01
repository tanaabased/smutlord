# Workspace Registration Example

This scenario verifies workspace registration, identity import, and the local voice-skill contract without configuring a model or starting a Gateway. It does not prove skill loading or model behavior.

## Setup

```bash
# should register the checked-out repository with lowercase machine id and reviewed display name
set -o pipefail
cp "$GITHUB_WORKSPACE/IDENTITY.md" "${TMPDIR}/IDENTITY.before.md"
openclaw agents add smutlord --workspace "$GITHUB_WORKSPACE" --non-interactive --json | tee "${TMPDIR}/agent.json"

# should import smutlord identity from the workspace
set -o pipefail
openclaw agents set-identity --agent smutlord --workspace "$GITHUB_WORKSPACE" --from-identity --json | tee "${TMPDIR}/identity.json"
```

## Testing

```bash
# should report the registered smutlord workspace and reviewed display name
grep -F '"agentId": "smutlord"' "${TMPDIR}/agent.json"
grep -F '"name": "smutlord"' "${TMPDIR}/agent.json"
grep -F "\"workspace\": \"$GITHUB_WORKSPACE\"" "${TMPDIR}/agent.json"
openclaw agents list --json | grep -F '"id": "smutlord"'

# should report smutlord identity from the workspace
grep -F '"name": "smutlord"' "${TMPDIR}/identity.json"

# should validate the resulting OpenClaw configuration
openclaw config validate --json | tr -d '[:space:]' | grep -F '"valid":true'

# should validate the workspace voice skill
bun "$GITHUB_WORKSPACE/skills/skill-author/scripts/validate-skill.js" --skill-dir "$GITHUB_WORKSPACE/skills/voice"

# should preserve the reviewed identity file byte-for-byte
cmp -s "${TMPDIR}/IDENTITY.before.md" "$GITHUB_WORKSPACE/IDENTITY.md"
grep -Fx -- '- Name: smutlord' "$GITHUB_WORKSPACE/IDENTITY.md"

# should leave the repository worktree clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
