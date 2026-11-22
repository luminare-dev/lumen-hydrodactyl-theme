#!/usr/bin/env bash
# Installs the Lumen theme into a Hydrodactyl checkout: copies the new files, applies the patches,
# runs the Lumen migration and builds the frontend.
#
#   scripts/install.sh --panel /var/www/hydrodactyl [--yes] [--no-migrate] [--no-build] [--dry-run]
#
# Back up the panel directory and the database first (docs/install.md). Nothing runs without
# --panel, and nothing changes without --yes or a typed confirmation.
. "$(dirname "$0")/common.sh"

panel="" yes=0 migrate=1 build=1 dry=0
while [ $# -gt 0 ]; do
    case "$1" in
        --panel) panel="$2"; shift 2 ;;
        --yes|-y) yes=1; shift ;;
        --no-migrate) migrate=0; shift ;;
        --no-build) build=0; shift ;;
        --dry-run) dry=1; shift ;;
        -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
        *) die "unknown option $1" ;;
    esac
done

[ -n "$panel" ] || die "pass the panel directory with --panel DIR (see docs/install.md)"
panel="$(cd "$panel" && pwd)"
require_panel "$panel"
[ ! -f "$panel/.lumen/installed" ] || die "Lumen is already installed in $panel; run scripts/uninstall.sh first to update."

say "Checking the overlay against $panel"
"$LUMEN_ROOT/scripts/check-overlay.sh" --panel "$panel"
[ "$dry" -eq 0 ] || { say "Dry run: nothing changed."; exit 0; }

if [ "$yes" -ne 1 ]; then
    printf 'This changes files in %s. Did you back up the panel and the database? Type "install": ' "$panel"
    read -r answer
    [ "$answer" = "install" ] || die "cancelled"
fi

mkdir -p "$panel/.lumen"
: >"$panel/.lumen/files.txt"
say "Copying $(overlay_files | wc -l) files"
while read -r file; do
    mkdir -p "$(dirname "$panel/$file")"
    cp "$LUMEN_FILES/$file" "$panel/$file"
    echo "$file" >>"$panel/.lumen/files.txt"
done < <(overlay_files)

: >"$panel/.lumen/patches.txt"
while read -r patch; do
    say "Applying $(basename "$patch")"
    apply_patch "$panel" "$patch" apply
    basename "$patch" >>"$panel/.lumen/patches.txt"
    cp "$patch" "$panel/.lumen/"
done < <(overlay_patches)

cat >"$panel/.lumen/installed" <<STAMP
version=$LUMEN_VERSION
upstream_commit=$UPSTREAM_COMMIT
installed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STAMP

cd "$panel"
if [ "$migrate" -eq 1 ]; then
    say "Running the Lumen migration"
    php artisan migrate --force --path="$LUMEN_MIGRATION"
fi
clear_caches
[ -f vendor/autoload.php ] && php artisan cache:forget lumen:appearance:v1 >/dev/null 2>&1 || true

if [ "$build" -eq 1 ]; then
    command -v pnpm >/dev/null || die "pnpm is missing; install it, then run: pnpm install --frozen-lockfile && pnpm build"
    say "Building the frontend (pnpm)"
    CI=true pnpm install --frozen-lockfile
    pnpm build
fi

say "Lumen $LUMEN_VERSION is installed. Re-cache if you use it: php artisan config:cache route:cache view:cache"
say "Customize it in Admin -> Appearance."
