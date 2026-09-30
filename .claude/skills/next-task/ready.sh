#!/usr/bin/env bash
# Stampa "<numero>\t<titolo>" delle issue nella colonna Ready della board "Baratto1948", in ordine di colonna.
set -euo pipefail
proj=$(gh project list --owner @me --format json --jq '.projects[]|select(.title=="Baratto1948")|.number')
gh project item-list "$proj" --owner @me --limit 200 --format json \
  --jq '.items[]|select(.status=="Ready" and .content.type=="Issue")|"\(.content.number)\t\(.content.title)"'
