# Workspace Registration Example

## What this example does

Register checked-out repository as `smutlord`'s workspace and import identity.
Check resulting registration and configuration. Identity file and clean checkout
must survive untouched.

## What it doesn't do

Registration is not proof agent can run. This example configures no model,
starts no Gateway, and does not prove runtime skill loading or model behavior.
Static skill and asset checks belong to [development checks](../../README.md#development).
Installed Canon skill availability belongs to [setup](../setup/README.md);
credentials belong to [install](../install/README.md).

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
grep -F '"avatar": "assets/icon-large.png"' "${TMPDIR}/identity.json"

# should validate the resulting OpenClaw configuration
openclaw config validate --json | tr -d '[:space:]' | grep -F '"valid":true'

# should preserve the reviewed identity file byte-for-byte
cmp -s "${TMPDIR}/IDENTITY.before.md" "$GITHUB_WORKSPACE/IDENTITY.md"

# should leave the repository worktree clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
