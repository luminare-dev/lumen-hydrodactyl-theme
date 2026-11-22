# Shared helpers for install.sh, uninstall.sh and check-overlay.sh (sourced, not run).
set -euo pipefail

LUMEN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LUMEN_FILES="$LUMEN_ROOT/overlay/files"
LUMEN_PATCHES="$LUMEN_ROOT/overlay/patches"
LUMEN_VERSION="$(cat "$LUMEN_ROOT/version.txt" 2>/dev/null || echo 0.0.0)"
LUMEN_MIGRATION="database/migrations/2026_11_22_000001_create_lumen_appearance_tables.php"
# shellcheck source=../upstream.lock
. "$LUMEN_ROOT/upstream.lock"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# Lists the overlay's new files, relative to overlay/files.
overlay_files() {
    (cd "$LUMEN_FILES" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
}

overlay_patches() {
    find "$LUMEN_PATCHES" -name '*.patch' | LC_ALL=C sort
}

require_panel() {
    local dir="$1"
    [ -f "$dir/artisan" ] && [ -f "$dir/resources/scripts/admin/index.tsx" ] && [ -f "$dir/config/app.php" ] \
        || die "$dir does not look like a Hydrodactyl checkout (artisan, resources/scripts/admin/index.tsx)."
}

is_git() {
    git -C "$1" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
        && [ "$(git -C "$1" rev-parse --show-toplevel)" = "$(cd "$1" && pwd -P)" ]
}

# apply_patch DIR PATCH [check|apply|reverse-check|reverse]
apply_patch() {
    local dir="$1" patch="$2" action="${3:-apply}"
    if is_git "$dir"; then
        case "$action" in
            check) git -C "$dir" apply --check "$patch" ;;
            apply) git -C "$dir" apply "$patch" ;;
            reverse-check) git -C "$dir" apply --check -R "$patch" ;;
            reverse) git -C "$dir" apply -R "$patch" ;;
        esac
    else
        case "$action" in
            check) patch -d "$dir" -p1 --dry-run --forward --silent <"$patch" >/dev/null ;;
            apply) patch -d "$dir" -p1 --forward --silent <"$patch" ;;
            reverse-check) patch -d "$dir" -p1 --dry-run --reverse --silent <"$patch" >/dev/null ;;
            reverse) patch -d "$dir" -p1 --reverse --silent <"$patch" ;;
        esac
    fi
}

# Clears Laravel's compiled views, routes and config (skipped when vendor/ is missing, as in CI's
# overlay check on a bare checkout).
clear_caches() {
    if [ -f vendor/autoload.php ]; then
        php artisan view:clear >/dev/null
        php artisan route:clear >/dev/null
        php artisan config:clear >/dev/null
    else
        warn "vendor/ is missing: skipped clearing the Laravel caches"
    fi
}
