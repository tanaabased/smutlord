# Install

## What this example does

Installs and reconciles smutlord's checked-out workspace in an isolated OpenClaw
profile using his declared credentials. It runs host dependency setup, verifies
managed Git and GitHub identity and Google account readiness, and checks intake
activation. A repeat installation checks convergence, credential and intake
retention, and preservation of private memory.

`--yes` consents to enrollment only in this isolated CI profile. Automatic cron
execution is disabled so installed schedules cannot run during these checks.

## What it doesn't do

It skips agent setup, which belongs to [setup](../setup/README.md), and does not
exercise ongoing intake polling, feedback handling, or model execution. Doctor
also inspects skipped setup steps and model availability, so this example checks
Google findings independently of Doctor's overall readiness status.

## Setup

```bash
# should store smutlord's 1password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare smutlord's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/smutlord"

# should start the isolated gateway for consented enrollment verification
openclaw config set cron.enabled false --strict-json
openclaw-gateway start
```

## Testing

```bash
# should validate and install smutlord with host dependencies but without agent setup
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw agent-system validate
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/install.json"
jq -e 'any(.outcomes[]; .component == "codex-plugin" and .code == "codex-plugin-installed" and .status == "created") and [.outcomes[] | select(.component == "codex-plugin" or (.component == "setup" and .stepId == "brew-dependencies")) | .component] == ["codex-plugin", "setup"]' "${TMPDIR}/install.json"
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

# should activate supported issue intake while completing installation
jq -e '
  .agentId == "smutlord" and
  (has("blocked") | not) and (has("unattempted") | not) and
  all(.warnings[]; .code != "github-notification-runtime-unsupported") and
  any(.outcomes[]; .component == "github-intake" and .code == "intake-activated" and .status == "updated") and
  any(.outcomes[]; .component == "github" and (.status == "created" or .status == "updated" or .status == "unchanged"))
' "${TMPDIR}/install.json"

# should install GoG before reconciling smutlord's declared Google account
gog --version
jq -e '.outcomes | any(.code == "google-credentials-created") and ([.[] | .stepId // .component] | index("brew-dependencies") < index("google"))' "${TMPDIR}/install.json"
```

```bash
# should leave smutlord's repeated installation converged
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/reinstall.json"
jq -e 'any(.outcomes[]; .component == "codex-plugin" and .code == "codex-plugin-unchanged" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] == ["unchanged", "unchanged"]' "${TMPDIR}/reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should retain supported issue intake on repeat installation
jq -e '
  .agentId == "smutlord" and
  (has("blocked") | not) and (has("unattempted") | not) and
  all(.warnings[]; .code != "github-notification-runtime-unsupported") and
  any(.outcomes[]; .component == "github-intake" and .code == "intake-retained" and .status == "unchanged") and
  any(.outcomes[]; .component == "github" and .status == "unchanged")
' "${TMPDIR}/reinstall.json"

# should retain Google credentials on repeat installation
cd "$GITHUB_WORKSPACE"
jq -e '.outcomes | any(.code == "google-credentials-unchanged")' "${TMPDIR}/reinstall.json"

# should verify the configured Google account independently of overall readiness
cd "$GITHUB_WORKSPACE"
if openclaw agent-system doctor --json > "${TMPDIR}/install-doctor.json"; then
  doctor_exit=0
else
  doctor_exit=$?
fi
jq '{status, findings: [.findings[] | {component, stepId, code, status}]}' "${TMPDIR}/install-doctor.json"
jq -e --argjson exit "$doctor_exit" '
  (.status == "healthy" and $exit == 0) or
  ((.status == "drift" or .status == "blocked") and $exit == 1)
' "${TMPDIR}/install-doctor.json"
jq -e '.findings | map(select(.component == "google")) | any(.code == "google-live-identity-ready" and .status == "healthy") and all(.status == "healthy")' "${TMPDIR}/install-doctor.json"

# should use smutlord's managed git identity in his own workspace
cd "$GITHUB_WORKSPACE"
openclaw agent-system tool git --agent smutlord -- var GIT_AUTHOR_IDENT | grep -F 'smutlord <smutlord@tanaab.dev>'

# should use smutlord's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx smutlord

# should leave smutlord's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
