# Setup

## What this example does

Runs smutlord's full setup once in an isolated OpenClaw profile. It checks an
eligible Canon skill, agent configuration, reported memory settings, and
preservation of host preferences and clean checkouts.

`--yes` consents to enrollment only in this isolated CI profile. Automatic cron
execution is disabled so registered schedules cannot start model turns during
setup checks.

## What it doesn't do

It does not repeat installation, execute skills or model turns, or test memory
indexing and recall. Credential and intake lifecycle checks belong to
[install](../install/README.md); shared plugin reuse belongs to
[shared](../shared/README.md).

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

# should prepare a fresh setup with existing host preferences
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw config set skills.load.extraDirs "[\"$HOME/tanaab/canon/skills\"]" --strict-json
openclaw config set hooks.internal.entries.session-memory.enabled true --strict-json
openclaw config set skills.workshop.autonomous.mode '"off"' --strict-json
```

## Testing

```bash
# should complete all declared setup tasks with codex available before host setup
cd "$GITHUB_WORKSPACE"
set -o pipefail
openclaw agent-system install --yes --json | tee "${TMPDIR}/setup-install.json" || {
  install_status=$?
  openclaw-gateway diagnostics || true
  exit "$install_status"
}
jq -e '
  .agentId == "smutlord" and
  (has("blocked") | not) and (has("unattempted") | not) and
  any(.outcomes[]; .component == "codex-plugin" and .code == "codex-plugin-installed" and .status == "created") and
  [.outcomes[] | select(.component == "codex-plugin" or (.component == "setup" and .stepId == "brew-dependencies")) | .component] == ["codex-plugin", "setup"] and
  [.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory", "canon-checkout", "canon-plugin", "openclaw-config"] and
  all(.outcomes[] | select(.component == "setup"); .status == "updated" or .status == "unchanged")
' "${TMPDIR}/setup-install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"

# should expose an eligible canon skill from the shared ssh checkout
git -C "$HOME/tanaab/canon" remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
openclaw skills info tanaab-project-optimizer --agent smutlord --json | jq -e '
  .name == "tanaab-project-optimizer" and
  .eligible == true and
  .disabled == false and
  (.filePath | split("/") | index("plugin-skills")) != null
'

# should configure smutlord's model execution and private memory policy
openclaw config get agents.entries.smutlord --json | jq -e '
  .model.primary == "openai/gpt-6.1-sol" and
  .thinkingDefault == "high" and
  .models["openai/gpt-6.1-sol"].agentRuntime.id == "codex" and
  .models["openai/gpt-6-luna"].agentRuntime.id == "codex" and
  .tools.profile == "coding" and
  .tools.exec.mode == "auto" and
  (.tools.alsoAllow | index("agent_system_git")) != null and
  (.tools.alsoAllow | index("agent_system_github")) != null and
  (.tools.alsoAllow | index("agent_system_google")) != null and
  (.tools.exec.pathPrepend | length) > 0 and
  .memory.search.rememberAcrossConversations == true and
  .memory.search.sources == ["memory", "sessions"] and
  .memory.search.experimental.sessionMemory == true
'

# should report memory and session sources with the installed vector extension
case "$(uname -m)" in
  arm64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-arm64" ;;
  x86_64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-x64" ;;
  *) exit 1 ;;
esac
EXPECTED_VECTOR_EXTENSION="$(npm root --global)/${SQLITE_VECTOR_PACKAGE}/vec0.dylib"
test -f "$EXPECTED_VECTOR_EXTENSION"
openclaw memory status --agent smutlord --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  'map(select(.agentId == "smutlord")) |
   length == 1 and
   .[0].status.vector.enabled == true and
   .[0].status.vector.extensionPath == $extension and
   .[0].status.sources == ["memory", "sessions"]'

# should preserve the host's hook and workshop preferences
openclaw config get hooks.internal.entries.session-memory.enabled --json | jq -e '. == true'
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "off"'

# should preserve smutlord's clean checkouts
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/smutlord" status --short --untracked-files=all)"
```
