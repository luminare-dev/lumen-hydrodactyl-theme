# Customizing

Everything is in **Admin → Appearance** (`/admin/appearance`). Changes are stored in the database
and applied as CSS variables on the next page load; there is no rebuild.

## The editor

- **Presets:** Luminare (default), Graphite (neutral, no Luminare logos), Aurora and High
  contrast. A preset replaces the whole draft; nothing is saved until you press **Save**.
- **Import / Export JSON:** a `.lumen.json` file is the full token set ([tokens.md](tokens.md)).
  Import checks every value and lists the ones it replaced. **Load default** puts the Luminare
  preset in the draft; **Reset saved appearance** deletes the saved set on the server.
- **Live preview:** while the page is open, the whole panel shows the draft, in the mode whose
  colours you are editing. Switch it off with the toggle above the samples. The two samples show
  both modes side by side.
- **Mode:** the default mode (system, dark or light) and whether users may switch. A user's choice
  is stored per account (table `lumen_user_preferences`) and follows them to other browsers.
- **Colours:** one palette per mode, with a colour picker and a hex field per role. Pairs below
  WCAG AA are flagged next to the colour and listed under the preview.
- **Typography, shape and spacing, layout:** fonts, text size, heading weight, corner radius,
  spacing unit, density, shadows, borders, sidebar style and width, active-item style, content
  width, background glow.
- **Branding:** product name, logo for dark and light mode, favicon, login background. Upload PNG,
  JPEG, WebP, GIF, ICO or SVG up to 4 MB, or paste an https URL. SVG files with scripts, event
  handlers or external references are refused. Uploads go to `storage/app/public/lumen/`; files no
  saved token uses are removed a day later.
- **Custom CSS:** added after the tokens on every page.

## Replacing the Luminare branding

The default preset shows the Luminare mark and favicon. To use your own: upload your logos and
favicon in **Branding**, or apply the **Graphite** preset (no logos, the panel's own logo and
favicon come back) and then adjust the colours. A logo set in Hydrodactyl's own Settings → Branding
also replaces the shipped Luminare favicon; a favicon uploaded in Appearance wins over both. The Luminare files themselves are not licensed for
other use (see NOTICE).

## Custom CSS tips

Use the variables, so your rules follow both modes and later token changes:

```css
:root[data-lumen] .my-banner {
    border: 1px solid var(--lumen-border);
    background: var(--lumen-surface-raised);
    color: var(--lumen-text);
}
:root[data-lumen][data-theme="light"] .my-banner { box-shadow: var(--shadow-md); }
```

`--lumen-<role>` exists for every colour role, plus `--lumen-gradient`, `--lumen-font-display`,
`--lumen-font-body`, `--lumen-font-mono` and `--lumen-radius`.

## Without the editor

The saved set is one row in `lumen_appearance` (`key = 'active'`, column `tokens` holds the JSON).
After changing it by hand, clear the cache entry: `php artisan cache:forget lumen:appearance:v1`.
