#!/usr/bin/env bash
set -euo pipefail
umask 077

[[ $# == 0 ]] || { echo 'Nightly backup accepts no arguments.' >&2; exit 1; }
: "${AGENT_SYSTEM_GOG:?Run through the managed Agent System automation.}"
for command in flock jq; do
  command -v "$command" >/dev/null || { echo "$command missing; run managed setup before activating nightly backup." >&2; exit 1; }
done
folder=1L21gQkLgTmCZ05UQqV9-zp5n0lp22EMH
stage=create
delivered=false
for directory in .private .private/backup-drive; do
  [[ ! -L $directory ]]
  mkdir -p "$directory"
  chmod 700 "$directory"
done
lock=.private/backup-drive/run.lock
[[ ! -L $lock && ! -s $lock && ( ! -e $lock || -f $lock ) ]]
# Children inherit this descriptor, preserving updater/backup exclusion after parent death.
exec 9>> "$lock"
flock -n 9 || { echo 'Backup locked by another backup or updater.' >&2; exit 1; }
finish() {
  result=$?
  trap - EXIT
  if [[ $result != 0 ]]; then
    if $delivered; then
      echo "Backup delivered; $stage failed." >&2
    else
      echo "Backup not delivered; $stage failed. Local archives retained." >&2
    fi
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 1' INT TERM

# Create owns capture selection and archive verification.
created=$(openclaw agent-system backup create --json)
archive=$(jq -er 'select(.status == "created" and .agentId == "smutlord") | .archive | strings' <<< "$created")
output=$(jq -er '.settings.output | strings' <<< "$created")
name=${archive##*/}
pattern='[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tar\.gz'
[[ $output == /* && $archive == "$output/$name" && $name =~ ^smutlord-$pattern$ ]]
[[ -d $output && ! -L $output && -f $archive && ! -L $archive ]]
output=$(cd "$output" && pwd -P)
[[ $archive == "$output/$name" ]]
nightly=smutlord-nightly-${name#smutlord-}
[[ ! -e $output/$nightly && ! -L $output/$nightly ]]
mv "$archive" "$output/$nightly"
archive=$output/$nightly

stage=upload
# Keep the existing private destination requirement, not a second integrity check.
"$AGENT_SYSTEM_GOG" drive get "$folder" --fields id,mimeType,driveId,capabilities,permissions |
  jq -e --arg folder "$folder" '.file | .id == $folder and
    .mimeType == "application/vnd.google-apps.folder" and (.driveId | not) and
    .capabilities.canAddChildren == true and (.permissions | length > 0) and
    all(.permissions[]; .type == "user")' >/dev/null
uploaded=$("$AGENT_SYSTEM_GOG" drive upload "$archive" --name "$nightly" --parent "$folder" --mime-type application/gzip)
remote=$(jq -er '.file.id | strings | select(length > 0)' <<< "$uploaded")
delivered=true

stage='local cleanup'
shopt -s nullglob
for path in "$output"/smutlord-nightly-*.tar.gz; do
  [[ ${path##*/} =~ ^smutlord-nightly-$pattern$ ]] || continue
  [[ -f $path && ! -L $path ]] || continue
  rm -- "$path"
done

# Preserve the existing five-owned-nightly-file rotation, never broaden its namespace.
stage='remote retention'
files='[]'
page=''
seen='[]'
while :; do
  args=(drive ls --parent "$folder" --query 'trashed = false' --max 100
    --fields 'files(id,name,size,mimeType,parents,ownedByMe,trashed),nextPageToken,incompleteSearch')
  [[ -z $page ]] || args+=(--page "$page")
  listing=$("$AGENT_SYSTEM_GOG" "${args[@]}")
  jq -e --argjson seen "$seen" '(.files | type == "array") and
    .incompleteSearch != true and (.has_more | type == "boolean") and
    (.nextPageToken | type == "string") and .has_more == (.nextPageToken != "") and
    (.nextPageToken == "" or (.nextPageToken as $p | $seen | index($p) == null)) and
    all(.files[]; (.id | type == "string") and (.name | type == "string"))' <<< "$listing" >/dev/null
  files=$(jq -cn --argjson old "$files" --argjson new "$listing" '$old + $new.files')
  page=$(jq -r '.nextPageToken' <<< "$listing")
  [[ -n $page ]] || break
  seen=$(jq -cn --argjson old "$seen" --arg page "$page" '$old + [$page] | select(length < 100)')
done
jq -e 'length == (map(.id) | unique | length)' <<< "$files" >/dev/null
owned=$(jq -c --arg pattern "^smutlord-nightly-$pattern$" --arg folder "$folder" '
  def valid_stamp:
    (.name | ltrimstr("smutlord-nightly-") | .[0:19]) as $stamp |
    (try ($stamp | strptime("%Y-%m-%dT%H-%M-%S") | mktime |
      strftime("%Y-%m-%dT%H-%M-%S")) catch "") == $stamp;
  [.[] | select(.name | test($pattern)) | select(valid_stamp) | select(.ownedByMe == true) |
   select(.trashed != true and .mimeType == "application/gzip" and .parents == [$folder])]
  | sort_by(.name, .id) | reverse' <<< "$files")
jq -e --arg id "$remote" 'any(.[]; .id == $id)' <<< "$owned" >/dev/null
remove=$(jq -r --arg id "$remote" '[.[] | select(.id != $id)][4:] | .[].id' <<< "$owned")
while IFS= read -r id; do
  [[ -n $id ]] || continue
  expected=$(jq -r --arg id "$id" '.[] | select(.id == $id) | .name' <<< "$owned")
  # Recheck ownership and destination immediately before the existing destructive operation.
  "$AGENT_SYSTEM_GOG" drive get "$id" --fields id,name,mimeType,parents,ownedByMe,trashed |
    jq -e --arg id "$id" --arg expected "$expected" --arg folder "$folder" --arg pattern "^smutlord-nightly-$pattern$" '
      .file | .id == $id and .name == $expected and .ownedByMe == true and .trashed != true and
      .mimeType == "application/gzip" and .parents == [$folder] and (.name | test($pattern))' >/dev/null
  "$AGENT_SYSTEM_GOG" drive delete "$id" --force >/dev/null
done <<< "$remove"
printf 'Backup delivered; local nightly archives removed; remote retention completed.\n'
