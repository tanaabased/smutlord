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
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw agent-system validate
openclaw agent-system install --skip-setup-agent --json | tee "${TMPDIR}/install.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-installed" and .outcomes[0].status == "created" and .outcomes[1].stepId == "brew-dependencies"' "${TMPDIR}/install.json"
jq -e '.outcomes | any(.component == "agent" and .status == "created")' "${TMPDIR}/install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"
grep -Fx '# Memory' "$GITHUB_WORKSPACE/MEMORY.md"
printf '\nPreserved setup example note.\n' >> "$GITHUB_WORKSPACE/MEMORY.md"
cp "$GITHUB_WORKSPACE/MEMORY.md" "${TMPDIR}/memory-before-repeat.md"
openclaw agents list --json | grep -F '"id": "smutlord"'
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"

# should install GoG before reconciling smutlord's declared Google account
gog --version
jq -e '.outcomes | any(.code == "google-credentials-created") and ([.[] | .stepId // .component] | index("brew-dependencies") < index("google"))' "${TMPDIR}/install.json"
```

```bash
# should leave smutlord's repeated installation converged
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --skip-setup-agent --json | tee "${TMPDIR}/reinstall.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-unchanged" and .outcomes[0].status == "unchanged"' "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.stepId == "brew-dependencies" or .stepId == "workspace-memory") | .status] == ["unchanged", "unchanged"]' "${TMPDIR}/reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should retain Google credentials and verify the configured account on repeat installation
cd "$GITHUB_WORKSPACE"
jq -e '.outcomes | any(.code == "google-credentials-unchanged")' "${TMPDIR}/reinstall.json"
openclaw agent-system doctor --json | jq -e '.findings | any(.code == "google-live-identity-ready")'

# should use smutlord's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx smutlord

# should leave smutlord's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
