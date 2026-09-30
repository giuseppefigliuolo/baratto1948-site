#!/usr/bin/env bash
# Uso: move-card.sh <numero-issue> <Backlog|Ready|"In progress"|"In review"|Done>
# Sposta la card della issue nella colonna indicata della board "Baratto1948".
set -euo pipefail
issue=$1; status=$2; owner=@me; title=Baratto1948

proj=$(gh project list --owner "$owner" --format json --jq ".projects[]|select(.title==\"$title\")|.number")
[ -n "$proj" ] || { echo "Board '$title' non trovata" >&2; exit 1; }
pid=$(gh project view "$proj" --owner "$owner" --format json --jq .id)
field=$(gh project field-list "$proj" --owner "$owner" --format json --jq '.fields[]|select(.name=="Status")')
fid=$(jq -r .id <<<"$field")
oid=$(jq -r --arg s "$status" '.options[]|select(.name==$s)|.id' <<<"$field")
[ -n "$oid" ] || { echo "Colonna '$status' non trovata" >&2; exit 1; }
item=$(gh project item-list "$proj" --owner "$owner" --limit 200 --format json --jq ".items[]|select(.content.number==$issue)|.id")
[ -n "$item" ] || { echo "Issue #$issue non è nella board" >&2; exit 1; }

gh project item-edit --id "$item" --project-id "$pid" --field-id "$fid" --single-select-option-id "$oid"
