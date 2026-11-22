#!/usr/bin/env bash
# Fetches Hydrodactyl into DIR (shallow): the pinned commit from upstream.lock, or REF.
#   scripts/fetch-upstream.sh DIR [REF]
. "$(dirname "$0")/common.sh"

dest="${1:?usage: fetch-upstream.sh DIR [REF]}"
ref="${2:-$UPSTREAM_COMMIT}"
[ ! -e "$dest" ] || [ -z "$(ls -A "$dest")" ] || die "$dest exists and is not empty"
mkdir -p "$dest"
git -C "$dest" init -q
git -C "$dest" remote add origin "$UPSTREAM_REPO"
git -C "$dest" fetch -q --depth 1 origin "$ref"
git -C "$dest" -c advice.detachedHead=false checkout -q FETCH_HEAD
say "Hydrodactyl $(git -C "$dest" rev-parse HEAD) in $dest"
