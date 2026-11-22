#!/usr/bin/env bash
# Removes the Lumen theme from a Hydrodactyl checkout: reverts the patches, deletes the files it
# added and rebuilds. The saved appearance stays in the database unless --drop-tables is given.
#
#   scripts/uninstall.sh --panel /var/www/hydrodactyl [--yes] [--drop-tables] [--no-build]
. "$(dirname "$0")/common.sh"

panel="" yes=0 drop=0 build=1
while [ $# -gt 0 ]; do
    case "$1" in
        --panel) panel="$2"; shift 2 ;;
        --yes|-y) yes=1; shift ;;
        --drop-tables) drop=1; shift ;;
        --no-build) build=0; shift ;;
        -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
        *) die "unknown option $1" ;;
    esac
done

[ -n "$panel" ] || die "pass the panel directory with --panel DIR"
panel="$(cd "$panel" && pwd)"
require_panel "$panel"
[ -f "$panel/.lumen/installed" ] || die "Lumen is not installed in $panel (no .lumen/installed)."

if [ "$yes" -ne 1 ]; then
    printf 'This reverts the Lumen files in %s. Type "uninstall": ' "$panel"
    read -r answer
    [ "$answer" = "uninstall" ] || die "cancelled"
fi

cd "$panel"
if [ "$drop" -eq 1 ]; then
    say "Dropping the Lumen tables"
    php artisan migrate:rollback --force --path="$LUMEN_MIGRATION"
fi

# Patches are reverted in reverse order, from the copies saved at install time.
tac .lumen/patches.txt | while read -r name; do
    say "Reverting $name"
    apply_patch "$panel" "$panel/.lumen/$name" reverse
done

while read -r file; do
    rm -f "$panel/$file"
done <.lumen/files.txt
for dir in resources/scripts/lumen/admin resources/scripts/lumen resources/lumen/presets resources/lumen \
    resources/views/lumen app/Lumen/Tokens app/Lumen/Http/Controllers app/Lumen/Http/Middleware app/Lumen/Http \
    app/Lumen public/lumen/fonts public/lumen/brand public/lumen; do
    rmdir "$dir" 2>/dev/null || true
done
rm -rf .lumen

clear_caches

if [ "$build" -eq 1 ]; then
    command -v pnpm >/dev/null || die "pnpm is missing; run: pnpm install --frozen-lockfile && pnpm build"
    say "Rebuilding the frontend"
    pnpm build
fi
say "Lumen is removed."
