# Setup

## What this example does

Run `smutlord`'s full setup twice in isolated OpenClaw profile. Check the Canon
plugin, manifest-declared models, execution policy, and desired memory settings.
Second installation must converge without configuration drift. Host preferences
and clean checkouts must stay intact.

`--yes` consents to enrollment only in this isolated CI profile. Automatic cron
execution stays disabled so registered schedules cannot start model turns during
setup checks.

## What it doesn't do

No skill execution, model turns, or memory indexing and recall checks here.
Credential and intake lifecycle checks belong to
[Agent System](https://github.com/tanaabased/openclaw-agent-system/tree/main/examples/os-install-online); shared plugin reuse belongs to
[shared](../shared/README.md).
Setup and model expectations come from the manifest; unrelated setup steps
need not stay in a particular order. Online memory health belongs to Doctor,
not a `memory status` probe against the running Gateway.

## Setup

```bash
# should store smutlord's 1password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare smutlord's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/smutlord"

# should read expected setup and model declarations from the workspace
cd "$GITHUB_WORKSPACE"
bun --eval '
  import { readFileSync } from "node:fs";
  import { resolve } from "node:path";
  const directory = resolve(".agent-system");
  const yaml = (file) => Bun.YAML.parse(readFileSync(file, "utf8"));
  const manifest = yaml(resolve(directory, "agent.yaml"));
  const setup = ["setup-host", "setup-agent"].flatMap((key) => yaml(resolve(directory, manifest[key].file)).steps.map(({ id }) => id));
  console.log(JSON.stringify({ setup, models: manifest.models, runtime: manifest.agent.runtime }));
' > "${TMPDIR}/setup-expected.json"

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
# should complete installation without blocked or unattempted work
cd "$GITHUB_WORKSPACE"
set -o pipefail
openclaw agent-system install --yes --json | tee "${TMPDIR}/setup-install.json" || {
  install_status=$?
  openclaw-gateway diagnostics || true
  exit "$install_status"
}
jq -e '
  .agentId == "smutlord" and
  .blocked == null and ((.unattempted // []) | length == 0)
' "${TMPDIR}/setup-install.json"

# should complete every manifest-declared setup step
jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  .outcomes as $outcomes |
  all($expected[0].setup[]; . as $stepId |
    any($outcomes[]; .component == "setup" and .stepId == $stepId)) and
  all(.outcomes[] | select(.component == "setup"); .status == "updated" or .status == "unchanged")
' "${TMPDIR}/setup-install.json"

# should install the codex prerequisite before running host setup
jq -e '
  (.outcomes | to_entries) as $outcomes |
  ([$outcomes[] | select(.value.component == "codex-plugin" and .value.code == "codex-plugin-installed" and .value.status == "created") | .key] | first) as $plugin |
  ([$outcomes[] | select(.value.component == "setup") | .key] | first) as $setup |
  $plugin != null and $setup != null and $plugin < $setup
' "${TMPDIR}/setup-install.json"

# should create the private workspace memory files
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"

# should load the Canon plugin with a nonempty skill surface from the shared ssh checkout
git -C "$HOME/tanaab/canon" remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
openclaw plugins inspect tanaab --runtime --json | jq -e '
  .plugin.id == "tanaab" and
  .plugin.enabled == true and
  (.install.acceptedSurface.skills | length) > 0
'

# should bind manifest-declared models and default effort to their runtime
openclaw config get agents.entries.smutlord --json | jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  . as $agent |
  .model.primary == $expected[0].models.default.model and
  .thinkingDefault == $expected[0].models.default.effort and
  ([$expected[0].models[] | .model] | unique |
    all(.[]; . as $model | $agent.models[$model].agentRuntime.id == $expected[0].runtime))
'

# should configure smutlord's execution policy and managed tools
openclaw config get agents.entries.smutlord.tools --json | jq -e '
  .profile == "coding" and
  .exec.mode == "auto" and
  (.alsoAllow | index("agent_system_git")) != null and
  (.alsoAllow | index("agent_system_github")) != null and
  (.alsoAllow | index("agent_system_google")) != null and
  (.exec.pathPrepend | length) > 0
'

# should configure private same-agent memory and session recall
openclaw config get agents.entries.smutlord.memory.search --json | jq -e '
  .rememberAcrossConversations == true and
  .sources == ["memory", "sessions"] and
  .experimental.sessionMemory == true
'

# should configure the installed vector extension
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

# should preserve the host's memory hook preference
openclaw config get hooks.internal.entries.session-memory.enabled --json | jq -e '. == true'

# should preserve the host's workshop preference
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "off"'

# should complete repeat installation
cd "$GITHUB_WORKSPACE"
set -euo pipefail
for section in agents hooks skills tools; do
  openclaw config get "$section" --json | jq -S . > "${TMPDIR}/${section}-before.json"
done
openclaw agent-system install --yes --json | tee "${TMPDIR}/setup-reinstall.json"

# should leave all declared setup steps satisfied on repeat installation
jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  .agentId == "smutlord" and
  .blocked == null and ((.unattempted // []) | length == 0) and
  (.outcomes as $outcomes |
    all($expected[0].setup[]; . as $stepId |
      any($outcomes[]; .component == "setup" and .stepId == $stepId))) and
  all(.outcomes[] | select(.component == "setup"); .status == "unchanged")
' "${TMPDIR}/setup-reinstall.json"

# should preserve installed policy across repeat reconciliation
for section in agents hooks skills tools; do
  openclaw config get "$section" --json | jq -S . > "${TMPDIR}/${section}-after.json"
  cmp "${TMPDIR}/${section}-before.json" "${TMPDIR}/${section}-after.json"
done

# should preserve smutlord's clean checkouts
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/smutlord" status --short --untracked-files=all)"
```
