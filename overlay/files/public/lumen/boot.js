/*
 * Lumen theme boot script. Runs in <head> before the panel's React bundles.
 *
 * - picks the mode: the user's saved choice (server), else this browser's, else the default
 *   from the tokens; with the toggle switched off, always the default;
 * - writes it to the panel's own appearance key, so the panel's theme toggle and settings agree;
 * - sets data-theme and the layout attributes on <html>;
 * - exposes window.Lumen.persistMode(), which the patched saveAppearance() calls.
 */
(function () {
    'use strict';
    var cfg = window.LumenAppearance || {};
    var modeCfg = cfg.mode || { default: 'system', allowToggle: true };
    var root = document.documentElement;
    var KEY = 'hydrodactyl:appearance';
    var MODES = ['system', 'dark', 'light'];

    function read() {
        try {
            var value = JSON.parse(window.localStorage.getItem(KEY) || 'null');
            return value && typeof value === 'object' ? value : {};
        } catch (e) {
            return {};
        }
    }

    function write(value) {
        try {
            window.localStorage.setItem(KEY, JSON.stringify(value));
        } catch (e) {
            /* private mode: the panel shows its own notice */
        }
    }

    function systemDark() {
        return !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function resolve(mode) {
        return mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode;
    }

    function applyAttributes(attributes) {
        Object.keys(attributes || {}).forEach(function (name) {
            root.setAttribute(name, attributes[name]);
        });
    }

    var saved = read();
    var mode = modeCfg.default;
    if (modeCfg.allowToggle) {
        if (cfg.user && MODES.indexOf(cfg.user.mode) !== -1) {
            mode = cfg.user.mode;
        } else if (MODES.indexOf(saved.mode) !== -1) {
            mode = saved.mode;
        }
    }

    saved.mode = mode;
    saved.palette = 'neutral';
    saved.accent = 'panel';
    write(saved);

    var theme = resolve(mode);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    applyAttributes(cfg.attributes);

    if (mode === 'system' && window.matchMedia) {
        var media = window.matchMedia('(prefers-color-scheme: dark)');
        var follow = function () {
            if (read().mode === 'system') {
                root.setAttribute('data-theme', resolve('system'));
                root.style.colorScheme = resolve('system');
            }
        };
        if (media.addEventListener) media.addEventListener('change', follow);
    }

    var lastSent = cfg.user ? cfg.user.mode : null;

    window.Lumen = {
        config: cfg,
        applyAttributes: applyAttributes,
        persistMode: function (next) {
            if (!cfg.user || !cfg.endpoints || MODES.indexOf(next) === -1 || next === lastSent) return;
            lastSent = next;
            var token = document.querySelector('meta[name="csrf-token"]');
            try {
                window.fetch(cfg.endpoints.mode, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': token ? token.getAttribute('content') : '',
                    },
                    body: JSON.stringify({ mode: next }),
                });
            } catch (e) {
                /* offline: the browser keeps the choice */
            }
        },
    };
})();
