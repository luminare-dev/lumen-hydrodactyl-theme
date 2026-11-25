# Lumen token schema, version 1

One JSON document describes a whole Lumen look: colours for both modes, type, shape, spacing,
layout switches and branding. The Hydrodactyl theme stores it server-side and turns it into CSS
variables on every page; other Lumen themes (Pterodactyl, KeyHelp, Roundcube) are meant to read
the same file, so a token file exported here can drive them too. Targets ignore what they cannot
show.

Reference implementations: `overlay/files/resources/scripts/lumen/core.ts` (TypeScript) and
`overlay/files/app/Lumen/Tokens/` (PHP). `tests/parity` checks that both normalize and compile
every preset and every test case to the same bytes. The presets live in
`overlay/files/resources/lumen/presets/`.

## Rules

- Tokens are plain data. Colours are `#RRGGBB`, numbers are JSON numbers, switches are booleans,
  choices are fixed strings. Only `customCss` carries CSS, and it is for trusted admins.
- A document may leave out anything. Missing keys take the default preset's value (Luminare).
- An invalid value is replaced by the default and reported by its path, for example
  `color.dark.accent` or `layout.sidebarWidth`. The panel refuses to save a document with errors;
  the import in the editor shows the replaced paths and keeps the rest.
- Text fields (`meta.*`, `branding.productName`) may not contain `<` or `>`.
- URLs are either `https://…` or a local path under `/storage/lumen/` (uploads) or
  `/lumen/brand/` (shipped files), without spaces, quotes, parentheses or backslashes.

## Document

```json
{
    "version": 1,
    "meta": { "name": "Luminare", "description": "…" },
    "mode": { "default": "system", "allowToggle": true },
    "color": { "dark": { "…": "#RRGGBB" }, "light": { "…": "#RRGGBB" } },
    "typography": { "display": "Sora", "body": "Sora", "mono": "ui-monospace, monospace", "stylesheet": "", "scale": 1, "headingWeight": 600 },
    "radius": { "base": 14 },
    "spacing": { "base": 4 },
    "density": "comfortable",
    "elevation": { "shadow": "soft", "borders": true },
    "layout": { "sidebar": "floating", "sidebarWidth": 280, "indicator": "pill", "contentWidth": "full", "backgroundGlow": true },
    "branding": { "productName": "", "logoDark": "/lumen/brand/luminare-mark.svg", "logoLight": "…", "favicon": "…", "loginBackground": "" },
    "customCss": ""
}
```

| Key | Type | Allowed | Meaning |
|---|---|---|---|
| `version` | number | `1` | Schema version. |
| `meta.name`, `meta.description` | string | ≤ 200 chars | Shown in the preset list and in exports. |
| `mode.default` | string | `system`, `dark`, `light` | First mode a visitor sees. `system` follows the device. |
| `mode.allowToggle` | boolean | | Users may switch; their choice is stored per account. When `false`, everyone gets `mode.default` and the toggle is hidden. |
| `color.dark.*`, `color.light.*` | `#RRGGBB` | 16 roles, below | One complete palette per mode. |
| `typography.display`, `.body`, `.mono` | string | ≤ 200 chars of `A–Z a–z 0–9 space , ' " _ . -` | Font family lists. Sora ships with the theme. |
| `typography.stylesheet` | URL | `https://…` or empty | Optional font stylesheet to load (a font service). |
| `typography.scale` | number | 0.85–1.25 | Multiplies every text size. |
| `typography.headingWeight` | number | 400–800 | Weight of headings. |
| `radius.base` | number | 0–28 (px) | The card radius; smaller parts use fixed fractions of it. |
| `spacing.base` | number | 3–6 (px) | The spacing unit every padding and gap is a multiple of (4 is the default unit). |
| `density` | string | `compact`, `comfortable`, `spacious` | Multiplies the spacing unit by 0.875, 1 or 1.125. |
| `elevation.shadow` | string | `none`, `soft`, `medium`, `strong` | Shadow strength (each mode has its own shadow colour). |
| `elevation.borders` | boolean | | Borders on cards and panels. |
| `layout.sidebar` | string | `floating`, `flush` | Sidebar drawn as a card, or flat on the background. |
| `layout.sidebarWidth` | number | 220–360 (px) | Width of the open sidebar. |
| `layout.indicator` | string | `pill`, `bar`, `glow` | Style of the active navigation item. |
| `layout.contentWidth` | string | `full`, `wide`, `narrow` | Maximum page width: none, 1440 px, 1200 px. |
| `layout.backgroundGlow` | boolean | | Soft accent light behind the page. |
| `branding.productName` | string | ≤ 60 chars | Name on the login page. Empty uses the panel name (Settings → General). |
| `branding.logoDark`, `.logoLight` | URL | | Logo per mode; one alone is used for both. Both empty: the panel's own logo. |
| `branding.favicon` | URL | | Favicon. Empty: the panel's own. |
| `branding.loginBackground` | URL | | Image for the login page. Empty: the Lumen gradient. |
| `customCss` | string | ≤ 20,000 chars | Extra CSS after the tokens. Every `<` is written as the CSS escape `\3c` (plus a space), so it cannot close the `<style>` element. |

### Colour roles

| Role | Used for | Contrast checks (WCAG 2.2) |
|---|---|---|
| `canvas` | page background | |
| `surfaceSunken` | wells, the login form side, sunken fields | |
| `surface` | cards and panels | |
| `surfaceRaised` | hover, active items, raised controls | |
| `border` | borders and dividers | |
| `text` | body text and headings | 4.5 on canvas, surface, surfaceRaised |
| `textMuted` | hints, secondary text | 4.5 on surface and canvas |
| `accent` | primary buttons, highlights, logo colour | |
| `accentSecondary` | end of the accent gradient | |
| `accentText` | links and accent text | 4.5 on surface |
| `accentContrast` | text on the accent | 4.5 on accent and accentSecondary |
| `success`, `warning`, `danger`, `info` | status text and badges | 4.5 on surface |
| `focus` | keyboard focus ring | 3 on surface and canvas |

Contrast failures are warnings in the editor, not errors: a deliberate low-contrast brand stays
possible, but the editor lists every failing pair with its ratio.

## How the Hydrodactyl theme applies it

The compiler writes three rule blocks: shared values on `:root:root:root[data-lumen]`, and one
block per mode on `…[data-theme="dark"]` and `…[data-theme="light"]`. The selector outranks the
panel's own palette rules whatever order the stylesheets load in. Each colour role becomes
`--lumen-<role>` (kebab case, for example `--lumen-surface-raised`), and the panel's variables
are mapped onto them:

| Panel variable | From |
|---|---|
| `--color-canvas`, `--color-bg`, `--color-bg-raised`, `--color-bg-lowered` | canvas, canvas, surface, surfaceSunken |
| `--color-mocha-700 … 300` | canvas, surfaceSunken, surface, surfaceRaised, border |
| `--color-mocha-200 … 50` | mixes of border and textMuted |
| `--color-cream-*`, `--color-primary`, `--color-secondary` | text, textMuted |
| `--color-hydro-*`, `--color-brand-*`, `--brand-color` | accent, accentText and mixes |
| `--color-zinc/neutral/gray-*` | mixes of text and canvas (they flip with the mode) |
| `--color-red/green/emerald/yellow/amber/blue-*` | danger, success, warning, info |
| `--radius-*`, `--spacing`, `--text-*`, `--shadow-*`, `--font-sans`, `--font-mono` | radius, spacing × density, scale, elevation, typography |
| `--sidebar-full-width` | layout.sidebarWidth |

The layout switches become attributes on `<html>` (`data-lumen-sidebar`, `data-lumen-indicator`,
`data-lumen-width`, `data-lumen-glow`, `data-lumen-density`, `data-lumen-shadow`,
`data-lumen-toggle`, `data-lumen-login`), which `public/lumen/lumen.css` reads.

All arithmetic stays in CSS (`calc()`, `color-mix()`), so any target that supports modern CSS can
reuse the compiled output, and the compilers stay byte-identical.

## Versioning

A change that only adds optional keys keeps version 1. Renaming or removing a key, or changing
what a value means, raises the version; readers must refuse versions they do not know (the
normalizer reports `version` as an error and falls back to the defaults).
