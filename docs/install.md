# Installing

Lumen is a build-time overlay: a set of new files and five small patches that
`scripts/install.sh` applies to a Hydrodactyl checkout, followed by the panel's normal frontend
build. Hydrodactyl does not load Blueprint extensions, so there is no extension file to upload.

## Supported versions

| Component | Tested with | Supported |
|---|---|---|
| Hydrodactyl | v6.4.2 (`fc93a1f`, pinned in `upstream.lock`) | v6.4.x; newer versions when `scripts/check-overlay.sh --panel DIR` passes |
| PHP | 8.5 (CI image) | what Hydrodactyl needs (8.4 or 8.5) |
| Node.js / pnpm | 22 / the version in Hydrodactyl's `package.json` | same as Hydrodactyl |
| Database | MariaDB 10.5 (CI) | MySQL, MariaDB, PostgreSQL |

## Before you start: back up

The scripts never run on their own and never touch a panel they are not pointed at. Still, take a
backup you can restore before you install, update or remove the theme:

```bash
cd /var/www/hydrodactyl                         # your panel directory
tar -czf ~/panel-files-$(date +%F).tar.gz --exclude=node_modules .
mysqldump --single-transaction panel > ~/panel-db-$(date +%F).sql   # or pg_dump
git status                                      # a git checkout makes the patches easy to read
```

Put the panel into maintenance mode while you build: `php artisan down`, and `php artisan up`
afterwards.

## Install

```bash
git clone https://github.com/luminare-dev/lumen-hydrodactyl-theme.git
cd lumen-hydrodactyl-theme
scripts/check-overlay.sh --panel /var/www/hydrodactyl     # read-only: do the patches apply?
scripts/install.sh --panel /var/www/hydrodactyl           # asks you to type "install"
```

`install.sh` then:

1. checks the overlay again and stops if a patch does not apply or a new file would overwrite an
   upstream file;
2. copies the files in `overlay/files/` and applies `overlay/patches/*.patch` (with `git apply`
   in a git checkout, `patch -p1` otherwise), and records both in `.lumen/` inside the panel;
3. runs only the Lumen migration (`php artisan migrate --path=database/migrations/2026_11_22_000001_create_lumen_appearance_tables.php`);
4. clears the view, route and config caches;
5. runs `pnpm install --frozen-lockfile` and `pnpm build`.

Options: `--yes` (no prompt), `--no-migrate`, `--no-build` (build yourself later),
`--dry-run` (check only). Run it as the user that owns the panel files, then fix ownership if your
setup needs it (for example `chown -R www-data:www-data .`). Re-cache when you normally do:
`php artisan config:cache && php artisan route:cache && php artisan view:cache`.

### Small servers: take the frontend build from CI

`pnpm install` and `pnpm build` need well over a gigabyte of memory. On a small server, install
with `--no-build` and use the build of the `panel-build` workflow instead. It builds the pinned
Hydrodactyl release plus the overlay for every change on `main` (or on demand) and keeps the
artifact `panel-build` for 90 days: `panel-build.tar.gz`, its SHA-256 and `BUILD-INFO`. Take the
run of the commit you install from:

```bash
COMMIT=$(git rev-parse HEAD)
RUN=$(gh run list --repo luminare-dev/lumen-hydrodactyl-theme --workflow panel-build.yml \
  --commit "$COMMIT" --status success --json databaseId --jq '.[0].databaseId')
gh run download "$RUN" --repo luminare-dev/lumen-hydrodactyl-theme --name panel-build --dir /root/panel-build
cd /root/panel-build && sha256sum -c panel-build.tar.gz.sha256 && grep "theme_commit=$COMMIT" BUILD-INFO
rm -rf /var/www/hydrodactyl/public/build
tar -C /var/www/hydrodactyl/public -xzf panel-build.tar.gz
```

The build only fits a panel that matches `upstream.lock` (`check-overlay.sh --panel` passes and
the panel's files are the pinned release).

Make sure `public/storage` links to `storage/app/public` (`php artisan storage:link`): uploaded
logos are stored there.

## Docker image

Build the panel image from a checkout with the overlay applied; the upstream `Dockerfile` runs
the frontend build and the entrypoint runs every migration:

```bash
git clone --branch v6.4.2 https://github.com/BlueprintFramework/hydrodactyl.git panel
lumen-hydrodactyl-theme/scripts/install.sh --panel panel --yes --no-migrate --no-build
docker build -t hydrodactyl-lumen panel
```

CI does exactly this (`ci/`), then boots the image with MariaDB and Redis.

## Update Hydrodactyl or the theme

The patches are tied to the files they change, so remove the theme before you update either side:

```bash
scripts/uninstall.sh --panel /var/www/hydrodactyl --no-build   # keeps the saved appearance
# update Hydrodactyl (git pull / new release), then:
scripts/check-overlay.sh --panel /var/www/hydrodactyl
scripts/install.sh --panel /var/www/hydrodactyl
```

If the check fails on a new Hydrodactyl release, wait for a Lumen release that supports it. The
weekly `upstream` workflow in this repository tests the overlay against Hydrodactyl's `main` and
latest release.

## Uninstall

```bash
scripts/uninstall.sh --panel /var/www/hydrodactyl                # reverts patches, removes files, rebuilds
scripts/uninstall.sh --panel /var/www/hydrodactyl --drop-tables  # also deletes the saved appearance
```

Uploaded logos stay in `storage/app/public/lumen/`; delete that folder if you no longer need them.

## Rollback without the scripts

Restore the backup from above, or in a git checkout: `git checkout -- .`, delete the paths listed
in `.lumen/files.txt`, then `pnpm build`.
