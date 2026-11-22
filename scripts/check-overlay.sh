#!/usr/bin/env bash
# Checks that the overlay applies cleanly to a Hydrodactyl tree, without changing it.
#
#   scripts/check-overlay.sh                 fetch the pinned commit (upstream.lock) into a temp dir
#   scripts/check-overlay.sh --ref main      fetch another branch or tag instead
#   scripts/check-overlay.sh --panel DIR     check an existing checkout (read-only)
#
# Exit 0 when every patch applies and no new file would overwrite an upstream file.
. "$(dirname "$0")/common.sh"

panel="" ref="$UPSTREAM_COMMIT"
while [ $# -gt 0 ]; do
    case "$1" in
        --panel) panel="$2"; shift 2 ;;
        --ref) ref="$2"; shift 2 ;;
        -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
        *) die "unknown option $1" ;;
    esac
done

tmp=""
if [ -z "$panel" ]; then
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    say "Fetching $UPSTREAM_REPO at $ref"
    git -C "$tmp" init -q
    git -C "$tmp" remote add origin "$UPSTREAM_REPO"
    git -C "$tmp" fetch -q --depth 1 origin "$ref"
    git -C "$tmp" checkout -q FETCH_HEAD
    panel="$tmp"
    say "Upstream commit: $(git -C "$tmp" rev-parse HEAD)"
fi
require_panel "$panel"

failed=0
while read -r patch; do
    if apply_patch "$panel" "$patch" check 2>/dev/null; then
        printf '  ok        %s\n' "$(basename "$patch")"
    elif apply_patch "$panel" "$patch" reverse-check 2>/dev/null; then
        printf '  applied   %s (already installed)\n' "$(basename "$patch")"
    else
        printf '  FAILED    %s\n' "$(basename "$patch")"
        failed=1
    fi
done < <(overlay_patches)

while read -r file; do
    if [ -e "$panel/$file" ] && ! cmp -s "$LUMEN_FILES/$file" "$panel/$file"; then
        if [ ! -f "$panel/.lumen/files.txt" ] || ! grep -qxF "$file" "$panel/.lumen/files.txt"; then
            printf '  CONFLICT  %s exists upstream\n' "$file"
            failed=1
        fi
    fi
done < <(overlay_files)

[ "$failed" -eq 0 ] || die "the overlay does not apply cleanly"
say "The overlay applies cleanly."
