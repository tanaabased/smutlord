# Setup

This scenario verifies smutlord's full setup and repeat convergence. Keeping both
runs together proves idempotence against the state the first run created.
It also seeds legacy model admissions and verifies migration to the GPT-6 policy.
Cross-agent plugin reuse is covered separately by [shared](../shared/README.md).

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
# should start without smutlord setup effects and record host dependency readiness
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
! openclaw plugins inspect tanaab --json >/dev/null 2>&1
! openclaw plugins inspect imessage --json >/dev/null 2>&1
if node scripts/setup-brew-dependencies-task.js check; then
  printf unchanged > "${TMPDIR}/brew-expected-status"
else
  test "$?" -eq 1
  printf updated > "${TMPDIR}/brew-expected-status"
fi
openclaw config set skills.load.extraDirs "[\"$HOME/tanaab/canon/skills\"]" --strict-json

# should install Codex before host setup and then reconcile agent setup
openclaw agent-system validate
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-installed" and .outcomes[0].status == "created" and .outcomes[1].stepId == "brew-dependencies"' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory", "canon-checkout", "canon-plugin", "openclaw-config"]' "${TMPDIR}/setup-install.json"
jq -e --arg brew "$(cat "${TMPDIR}/brew-expected-status")" '[.outcomes[] | select(.component == "setup") | .status] == [$brew, "updated", "updated", "updated", "updated"]' "${TMPDIR}/setup-install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"
grep -Fx '# Memory' "$GITHUB_WORKSPACE/MEMORY.md"
printf '\nPreserved setup example note.\n' >> "$GITHUB_WORKSPACE/MEMORY.md"
cp "$GITHUB_WORKSPACE/MEMORY.md" "${TMPDIR}/memory-before-repeat.md"

# should satisfy smutlord's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"

# should clone canon over SSH for shared skills
test -d "$HOME/tanaab/canon/.git"
git -C "$HOME/tanaab/canon" remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
test ! -e "$HOME/tanaab/openclaw-agent-system"

# should use smutlord's managed Git identity in his own workspace
cd "$GITHUB_WORKSPACE"
openclaw agent-system tool git --agent smutlord -- var GIT_AUTHOR_IDENT | grep -F 'smutlord <smutlord@tanaab.dev>'

# should deny managed Git access to the shared canon checkout
cd "$HOME/tanaab/canon"
if openclaw agent-system tool git --agent smutlord -- remote get-url origin > "${TMPDIR}/canon-git-denied.log" 2>&1; then
  printf '%s\n' 'Managed Git unexpectedly admitted the shared Canon checkout.' >&2
  exit 1
fi
grep -Fx 'tool: The git tool working directory is invalid. code=invalid_arguments' "${TMPDIR}/canon-git-denied.log"

# should activate Canon as the plugin-owned source of shared skills
openclaw plugins inspect tanaab --json | jq -e '
  .plugin.id == "tanaab" and
  .plugin.enabled == true and
  .plugin.status != "error" and
  .plugin.rootDir == (env.HOME + "/tanaab/canon") and
  .install.source == "path" and
  .install.sourcePath == (env.HOME + "/tanaab/canon") and
  (.install.acceptedSurface.skills | index("./skills")) != null
'
openclaw skills info tanaab-project-optimizer --agent smutlord --json | jq -e '
  .name == "tanaab-project-optimizer" and
  .eligible == true and
  .disabled == false and
  (.filePath | split("/") | index("plugin-skills")) != null
'
! openclaw config get skills.load.extraDirs --json >/dev/null 2>&1

# should leave the shared Codex plugin healthy after agent setup
openclaw plugins inspect codex --json | tee "${TMPDIR}/codex-after-setup.json" | jq -e '.plugin.id == "codex" and .plugin.enabled == true and .plugin.status != "error"'
jq -S .install "${TMPDIR}/codex-after-setup.json" > "${TMPDIR}/codex-receipt-before.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-before.json"

# should retain smutlord's Codex runtime bindings and model admission
openclaw config get agents.entries.smutlord --json | jq -e --slurpfile desired "$GITHUB_WORKSPACE/openclaw.patch.json" '
  . as $agent |
  $desired[0].agents.entries.smutlord as $owned |
  all($owned.models | to_entries[];
    $agent.models[.key].agentRuntime.id == .value.agentRuntime.id) and
  all($owned.modelPolicy.allow[]; . as $model |
    ($agent.modelPolicy.allow | index($model)) != null)
'

# should atomically configure smutlord's execution policy
openclaw config get agents.entries.smutlord.tools --json | jq -e '
  .profile == "coding" and
  .exec.mode == "auto" and
  (.alsoAllow | index("agent_system_git")) != null and
  (.alsoAllow | index("agent_system_github")) != null and
  (.exec.pathPrepend | length) > 0
'

# should leave iMessage uninstalled after setup
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "imessage")'

# should configure Workshop proposal policy
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "propose"'

# should configure smutlord's memory policy with the installed vector extension
case "$(uname -m)" in
  arm64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-arm64" ;;
  x86_64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-x64" ;;
  *) exit 1 ;;
esac
EXPECTED_VECTOR_EXTENSION="$(npm root --global)/${SQLITE_VECTOR_PACKAGE}/vec0.dylib"
test -f "$EXPECTED_VECTOR_EXTENSION"
openclaw config get agents.entries.smutlord.memory.search.store.vector --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  '.enabled == true and .extensionPath == $extension'
openclaw memory status --agent smutlord --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  'map(select(.agentId == "smutlord")) |
   length == 1 and
   .[0].status.vector.enabled == true and
   .[0].status.vector.extensionPath == $extension'

# should enable private same-agent recall without the legacy memory hook
openclaw config get agents.entries.smutlord.memory.search.rememberAcrossConversations --json | jq -e '. == true'
openclaw config get agents.entries.smutlord.memory.search.sources --json | jq -e '. == ["memory", "sessions"]'
openclaw config get agents.entries.smutlord.memory.search.experimental.sessionMemory --json | jq -e '. == true'
openclaw config get tools.sessions.visibility --json | jq -e '. == "agent"'
openclaw config get hooks.internal.entries.session-memory.enabled --json | jq -e '. == false'
openclaw memory status --agent smutlord --json | jq -e '
  map(select(.agentId == "smutlord")) |
  length == 1 and
  .[0].status.sources == ["memory", "sessions"]
'
openclaw hooks list --json | jq -e '
  [.hooks[] | select(.name == "session-memory")] |
  length == 1 and
  .[0].disabled == true and
  .[0].enabledByConfig == false
'
```

```bash
# should leave a converged setup unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-unchanged" and .outcomes[0].status == "unchanged"' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory", "canon-checkout", "canon-plugin", "openclaw-config"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should preserve the shared plugin receipt and configuration after repeat setup
openclaw plugins inspect codex --json | jq -S .install > "${TMPDIR}/codex-receipt-repeat.json"
cmp "${TMPDIR}/codex-receipt-before.json" "${TMPDIR}/codex-receipt-repeat.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-repeat.json"
cmp "${TMPDIR}/codex-config-before.json" "${TMPDIR}/codex-config-repeat.json"

# should preserve smutlord's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/smutlord" status --short --untracked-files=all)"
```

```bash
# should retire the six-model legacy allowlist on reconciliation
cd "$GITHUB_WORKSPACE"
openclaw config set agents.entries.smutlord.modelPolicy.allow '["openai/gpt-5.5","openai/gpt-6-astra","openai/gpt-5.6-sol","openai/gpt-6-luna","openai/gpt-5.6-terra","openai/gpt-6-sol"]' --strict-json
openclaw agent-system install --json | tee "${TMPDIR}/setup-model-migration.json"
jq -e '[.outcomes[] | select(.component == "setup" and .stepId == "openclaw-config")] | length == 1 and .[0].status == "updated"' "${TMPDIR}/setup-model-migration.json"
openclaw config get agents.entries.smutlord.modelPolicy.allow --json | jq -e --slurpfile desired "$GITHUB_WORKSPACE/openclaw.patch.json" '. == $desired[0].agents.entries.smutlord.modelPolicy.allow'

# should leave the migrated model policy unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-model-repeat.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | length == 5 and all(. == "unchanged")' "${TMPDIR}/setup-model-repeat.json"
openclaw config get agents.entries.smutlord.modelPolicy.allow --json | jq -e --slurpfile desired "$GITHUB_WORKSPACE/openclaw.patch.json" '. == $desired[0].agents.entries.smutlord.modelPolicy.allow'

# should preserve the shared Codex plugin and clean checkout after model migration
openclaw plugins inspect codex --json | jq -S .install > "${TMPDIR}/codex-receipt-models.json"
cmp "${TMPDIR}/codex-receipt-before.json" "${TMPDIR}/codex-receipt-models.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-models.json"
cmp "${TMPDIR}/codex-config-before.json" "${TMPDIR}/codex-config-models.json"
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/smutlord" status --short --untracked-files=all)"
```
