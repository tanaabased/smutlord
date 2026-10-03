# Install

This scenario installs Agent System from source in an isolated OpenClaw profile,
then validates and reconciles smutlord's checked-out workspace using his declared
credentials while running host dependency setup and skipping agent setup.

## Setup

```bash
# should store smutlord's 1password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare smutlord's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/smutlord"
```

## Testing

```bash
# should validate and install smutlord with host dependencies but without agent setup
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw agent-system validate
openclaw agent-system install --skip-setup-agent --json | tee "${TMPDIR}/install.json"
jq -e '.outcomes | any(.component == "agent" and .status == "created")' "${TMPDIR}/install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies"]' "${TMPDIR}/install.json"
gog --version
openclaw agents list --json | grep -F '"id": "smutlord"'
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
```

```bash
# should leave smutlord's repeated installation converged
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --skip-setup-agent --json | tee "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies"]' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.stepId == "brew-dependencies") | .status] == ["unchanged"]' "${TMPDIR}/reinstall.json"

# should use smutlord's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx smutlord

# should leave smutlord's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
