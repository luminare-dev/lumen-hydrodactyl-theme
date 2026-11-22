#!/usr/bin/env bash
# CI only: fails when the overlay adds TypeScript errors. Hydrodactyl's tree has known errors of
# its own, so the check compares "file: message" lines (without line numbers) of the patched tree
# with the same tree with the patches reverted. Run in the panel checkout after install.sh.
set -euo pipefail
lumen="${1:?usage: tsc-diff.sh LUMEN_REPO}"

errors() { (pnpm exec tsc -p tsconfig.json --noEmit || true) | grep 'error TS' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort; }

errors >"$RUNNER_TEMP/tsc-lumen.txt"
for patch in $(ls -r "$lumen"/overlay/patches/*.patch); do git apply -R "$patch"; done
mv resources/scripts/lumen "$RUNNER_TEMP/lumen-scripts"
errors >"$RUNNER_TEMP/tsc-upstream.txt"
mv "$RUNNER_TEMP/lumen-scripts" resources/scripts/lumen
for patch in "$lumen"/overlay/patches/*.patch; do git apply "$patch"; done

echo "upstream: $(wc -l <"$RUNNER_TEMP/tsc-upstream.txt") errors, with Lumen: $(wc -l <"$RUNNER_TEMP/tsc-lumen.txt")"
new="$(comm -13 "$RUNNER_TEMP/tsc-upstream.txt" "$RUNNER_TEMP/tsc-lumen.txt")"
if [ -n "$new" ]; then
    echo "New TypeScript errors from the overlay:"
    echo "$new"
    exit 1
fi
