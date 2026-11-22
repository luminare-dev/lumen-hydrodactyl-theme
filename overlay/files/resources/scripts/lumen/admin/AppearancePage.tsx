// Admin → Appearance: the Lumen customizer. Edits the token set with a live preview of the whole
// panel and a side-by-side dark/light sample, then saves it to the server, where it is applied as
// CSS variables on the next page load without a rebuild.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import http from '@/api/http';
import { MainPageHeader } from '@/components/elements/MainPageHeader';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { Button } from '@/components/ui/button';
import {
    type BrandingAssetKey,
    COLOR_KEYS,
    type ColorKey,
    compile,
    contrastReport,
    ENUMS,
    layoutAttributes,
    normalize,
    RANGES,
    type ThemeMode,
    type Tokens,
} from '@/lumen/core';
import './appearance.css';

interface AppearanceState {
    tokens: Tokens;
    defaults: Tokens;
    presets: Record<string, Tokens>;
    saved: boolean;
    updatedAt: string | null;
    upload: { maxKb: number; extensions: string[] };
}

const api = {
    get: (): Promise<AppearanceState> => http.get('/admin/api/lumen/appearance').then(({ data }) => data),
    save: (tokens: Tokens): Promise<AppearanceState> =>
        http.put('/admin/api/lumen/appearance', { tokens }).then(({ data }) => data),
    reset: (): Promise<AppearanceState> => http.delete('/admin/api/lumen/appearance').then(({ data }) => data),
    upload: (slot: BrandingAssetKey, file: File): Promise<{ url: string }> => {
        const form = new FormData();
        form.append('slot', slot);
        form.append('file', file);
        return http.post('/admin/api/lumen/assets', form).then(({ data }) => data);
    },
};

const COLOR_LABELS: Record<ColorKey, [string, string]> = {
    canvas: ['Page background', 'Behind everything'],
    surfaceSunken: ['Sunken surface', 'Sidebar frame, wells'],
    surface: ['Surface', 'Cards and panels'],
    surfaceRaised: ['Raised surface', 'Hover, inputs, active items'],
    border: ['Border', 'Card and input borders'],
    text: ['Text', 'Body text and headings'],
    textMuted: ['Muted text', 'Hints and secondary text'],
    accent: ['Accent', 'Buttons and highlights'],
    accentSecondary: ['Accent gradient end', 'Second colour of the accent gradient'],
    accentText: ['Accent text', 'Links and accent text on surfaces'],
    accentContrast: ['Text on accent', 'Button labels'],
    success: ['Success', 'Running, saved'],
    warning: ['Warning', 'Starting, attention'],
    danger: ['Danger', 'Errors, delete'],
    info: ['Info', 'Notes'],
    focus: ['Focus ring', 'Keyboard focus outline'],
};

const ASSET_LABELS: Record<BrandingAssetKey, [string, string]> = {
    logoDark: ['Logo, dark mode', 'Square or wide; SVG or PNG'],
    logoLight: ['Logo, light mode', 'Falls back to the dark logo'],
    favicon: ['Favicon', 'SVG, PNG or ICO'],
    loginBackground: ['Login background', 'Large image; empty for the Lumen gradient'],
};

const PRESET_ORDER = ['luminare', 'graphite', 'aurora', 'contrast'];

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value: string) {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'lumen'
    );
}

// ------------------------------------------------------------------------------------------
// Live preview of the whole panel: swaps the server-rendered token stylesheet while editing.
// ------------------------------------------------------------------------------------------

function useLivePreview(tokens: Tokens | null, enabled: boolean, mode: ThemeMode) {
    const original = useRef<{ css: string; attributes: Record<string, string | null>; theme: string | null } | null>(
        null,
    );

    useEffect(() => {
        const root = document.documentElement;
        const style = document.getElementById('lumen-tokens');
        if (!original.current) {
            const attributes: Record<string, string | null> = {};
            for (const name of root.getAttributeNames()) {
                if (name.startsWith('data-lumen')) attributes[name] = root.getAttribute(name);
            }
            original.current = { css: style?.textContent ?? '', attributes, theme: root.getAttribute('data-theme') };
        }
        return () => {
            const saved = original.current;
            if (!saved) return;
            const current = document.getElementById('lumen-tokens');
            if (current) current.textContent = saved.css;
            for (const [name, value] of Object.entries(saved.attributes)) {
                if (value !== null) root.setAttribute(name, value);
            }
            if (saved.theme) root.setAttribute('data-theme', saved.theme);
        };
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const saved = original.current;
        let style = document.getElementById('lumen-tokens');
        if (!style) {
            style = document.createElement('style');
            style.id = 'lumen-tokens';
            document.head.appendChild(style);
        }
        if (!tokens || !enabled) {
            if (saved) {
                style.textContent = saved.css;
                for (const [name, value] of Object.entries(saved.attributes)) {
                    if (value !== null) root.setAttribute(name, value);
                }
                if (saved.theme) root.setAttribute('data-theme', saved.theme);
            }
            return;
        }
        style.textContent = compile(tokens);
        for (const [name, value] of Object.entries(layoutAttributes(tokens))) root.setAttribute(name, value);
        root.setAttribute('data-theme', mode);
        root.style.colorScheme = mode;
    }, [tokens, enabled, mode]);

    return {
        commit(tokens: Tokens) {
            if (original.current) {
                original.current.css = compile(tokens);
                original.current.attributes = layoutAttributes(tokens);
            }
        },
    };
}

// ------------------------------------------------------------------------------------------
// Small controls
// ------------------------------------------------------------------------------------------

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className='lumen-ap-section'>
        <header>
            <h2>{title}</h2>
            {hint && <p>{hint}</p>}
        </header>
        <div className='lumen-ap-section-body'>{children}</div>
    </section>
);

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => {
    const id = useId();
    return (
        <div className='lumen-ap-row' data-label-id={id}>
            <span className='lumen-ap-row-label' id={id}>
                {label}
                {hint && <small>{hint}</small>}
            </span>
            <span className='lumen-ap-row-control'>{children}</span>
        </div>
    );
};

function Segmented<T extends string>({
    value,
    options,
    onChange,
    labels,
    name,
}: {
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
    labels?: Partial<Record<T, string>>;
    name: string;
}) {
    return (
        <span className='lumen-ap-segmented' title={name}>
            {options.map((option) => (
                <button
                    key={option}
                    type='button'
                    aria-pressed={value === option}
                    data-active={value === option}
                    onClick={() => onChange(option)}
                >
                    {labels?.[option] ?? option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
            ))}
        </span>
    );
}

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
        type='button'
        role='switch'
        aria-checked={checked}
        aria-label={label}
        className='lumen-ap-switch'
        data-on={checked}
        onClick={() => onChange(!checked)}
    >
        <span />
    </button>
);

const Range = ({
    value,
    range,
    step,
    unit,
    onChange,
}: {
    value: number;
    range: readonly [number, number];
    step: number;
    unit?: string;
    onChange: (v: number) => void;
}) => (
    <span className='lumen-ap-range'>
        <input
            type='range'
            min={range[0]}
            max={range[1]}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
        />
        <output>
            {value}
            {unit}
        </output>
    </span>
);

const ColorField = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    return (
        <span className='lumen-ap-color'>
            <input
                type='color'
                aria-label={`${label} colour picker`}
                value={value.toLowerCase()}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
            />
            <input
                type='text'
                aria-label={`${label} hex value`}
                value={text}
                spellCheck={false}
                maxLength={7}
                onChange={(e) => {
                    const next = e.target.value.trim();
                    setText(next);
                    if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toUpperCase());
                }}
                onBlur={() => setText(value)}
            />
        </span>
    );
};

// ------------------------------------------------------------------------------------------
// Side-by-side sample, scoped to .lumen-preview so it never touches the rest of the page
// ------------------------------------------------------------------------------------------

const Sample = ({ tokens, mode }: { tokens: Tokens; mode: ThemeMode }) => {
    const logo = mode === 'dark' ? tokens.branding.logoDark || tokens.branding.logoLight : tokens.branding.logoLight;
    return (
        <div
            className='lumen-preview lumen-sample'
            data-theme={mode}
            data-lumen-indicator={tokens.layout.indicator}
            data-lumen-sidebar={tokens.layout.sidebar}
            data-lumen-glow={tokens.layout.backgroundGlow ? 'on' : 'off'}
        >
            <div className='lumen-sample-mode'>{mode === 'dark' ? 'Dark' : 'Light'}</div>
            <div className='lumen-sample-frame'>
                <aside className='lumen-sample-nav'>
                    <div className='lumen-sample-brand'>
                        {logo ? <img src={logo} alt='' /> : <span className='lumen-sample-dot' />}
                        <strong>{tokens.branding.productName || 'Panel'}</strong>
                    </div>
                    <span data-active='true'>Servers</span>
                    <span>Account</span>
                    <span>API keys</span>
                </aside>
                <div className='lumen-sample-main'>
                    <div className='lumen-sample-card'>
                        <h3>Survival world</h3>
                        <p>Paper 1.21 · 4 GB · eu-central</p>
                        <div className='lumen-sample-badges'>
                            <span data-tone='success'>Running</span>
                            <span data-tone='warning'>Starting</span>
                            <span data-tone='danger'>Offline</span>
                            <span data-tone='info'>Note</span>
                        </div>
                        <span className='lumen-sample-input'>server.example.com</span>
                        <div className='lumen-sample-actions'>
                            <span className='lumen-sample-primary'>Start</span>
                            <span className='lumen-sample-secondary'>Console</span>
                            <span className='lumen-sample-link'>Open files</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ------------------------------------------------------------------------------------------
// The page
// ------------------------------------------------------------------------------------------

const AppearanceEditor = ({
    initial,
    onSaved,
}: {
    initial: AppearanceState;
    onSaved: (s: AppearanceState) => void;
}) => {
    const [state, setState] = useState(initial);
    const [draft, setDraft] = useState<Tokens>(() => clone(initial.tokens));
    const [editMode, setEditMode] = useState<ThemeMode>(
        document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    );
    const [live, setLive] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const importInput = useRef<HTMLInputElement>(null);
    const preview = useLivePreview(draft, live, editMode);

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(state.tokens), [draft, state.tokens]);
    const report = useMemo(() => contrastReport(draft), [draft]);
    const failing = report.filter((r) => !r.ok);
    const scopedCss = useMemo(() => compile(draft, { scope: '.lumen-preview', withCustomCss: false }), [draft]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (dirty) event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const update = (change: (next: Tokens) => void) => {
        setDraft((current) => {
            const next = clone(current);
            change(next);
            return next;
        });
    };

    const applyState = (next: AppearanceState) => {
        setState(next);
        setDraft(clone(next.tokens));
        preview.commit(next.tokens);
        const config = (window as { LumenAppearance?: { branding?: Record<string, string> } }).LumenAppearance;
        if (config) {
            config.branding = {
                productName: next.tokens.branding.productName,
                logoDark: next.tokens.branding.logoDark,
                logoLight: next.tokens.branding.logoLight,
            };
        }
        onSaved(next);
    };

    const save = async () => {
        setBusy('save');
        try {
            applyState(await api.save(draft));
            toast.success('Appearance saved. Every page uses it from the next load.');
        } catch {
            toast.error('Could not save the appearance. Check the values and try again.');
        } finally {
            setBusy(null);
        }
    };

    const resetServer = async () => {
        if (!window.confirm('Remove the saved appearance and go back to the Luminare default?')) return;
        setBusy('reset');
        try {
            applyState(await api.reset());
            toast.success('Back to the default appearance.');
        } catch {
            toast.error('Could not reset the appearance.');
        } finally {
            setBusy(null);
        }
    };

    const importFile = async (file: File) => {
        try {
            const { tokens, errors } = normalize(JSON.parse(await file.text()), state.defaults);
            setDraft(tokens);
            if (errors.length > 0) {
                toast.warning(`Imported. Replaced invalid values: ${errors.slice(0, 6).join(', ')}`);
            } else {
                toast.success(`Imported "${tokens.meta.name}". Save to apply it.`);
            }
        } catch {
            toast.error('That file is not a Lumen token file (JSON).');
        }
    };

    const upload = async (slot: BrandingAssetKey, file: File) => {
        if (file.size > state.upload.maxKb * 1024) {
            toast.error(`The file is larger than ${state.upload.maxKb} KB.`);
            return;
        }
        setBusy(slot);
        try {
            const { url } = await api.upload(slot, file);
            update((next) => {
                next.branding[slot] = url;
            });
        } catch {
            toast.error('Upload failed. Use a PNG, JPEG, WebP, GIF, ICO or a plain SVG without scripts.');
        } finally {
            setBusy(null);
        }
    };

    const presets = PRESET_ORDER.filter((key) => state.presets[key]).concat(
        Object.keys(state.presets).filter((key) => !PRESET_ORDER.includes(key)),
    );
    const colors = draft.color[editMode];

    return (
        <div className='lumen-ap'>
            <style>{scopedCss}</style>

            <div className='lumen-ap-grid'>
                <div className='lumen-ap-controls'>
                    <Section
                        title='Presets'
                        hint='Start from a preset, or import a token file. Nothing is saved until you press Save.'
                    >
                        <div className='lumen-ap-presets'>
                            {presets.map((key) => {
                                const preset = state.presets[key] as Tokens;
                                return (
                                    <button
                                        key={key}
                                        type='button'
                                        className='lumen-ap-preset'
                                        data-active={draft.meta.name === preset.meta.name}
                                        onClick={() => setDraft(clone(preset))}
                                    >
                                        <span className='lumen-ap-swatches'>
                                            {(['dark', 'light'] as const).map((m) =>
                                                (['canvas', 'surface', 'accent', 'accentSecondary'] as const).map(
                                                    (c) => <i key={m + c} style={{ background: preset.color[m][c] }} />,
                                                ),
                                            )}
                                        </span>
                                        <strong>{preset.meta.name}</strong>
                                        <small>{preset.meta.description}</small>
                                    </button>
                                );
                            })}
                        </div>
                        <div className='lumen-ap-buttons'>
                            <Button type='button' variant='secondary' onClick={() => importInput.current?.click()}>
                                Import JSON
                            </Button>
                            <Button
                                type='button'
                                variant='secondary'
                                onClick={() =>
                                    download(
                                        `${slug(draft.meta.name)}.lumen.json`,
                                        `${JSON.stringify(draft, null, 4)}\n`,
                                    )
                                }
                            >
                                Export JSON
                            </Button>
                            <Button type='button' variant='secondary' onClick={() => setDraft(clone(state.defaults))}>
                                Load default
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                disabled={!state.saved || busy !== null}
                                onClick={() => void resetServer()}
                            >
                                Reset saved appearance
                            </Button>
                            <input
                                ref={importInput}
                                type='file'
                                accept='application/json,.json'
                                hidden
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void importFile(file);
                                    e.target.value = '';
                                }}
                            />
                        </div>
                        <Row label='Preset name' hint='Shown in exports'>
                            <input
                                className='lumen-ap-input'
                                value={draft.meta.name}
                                maxLength={60}
                                onChange={(e) =>
                                    update((n) => {
                                        n.meta.name = e.target.value.replace(/[<>]/g, '');
                                    })
                                }
                            />
                        </Row>
                    </Section>

                    <Section title='Mode' hint='What people see first, and whether they may switch.'>
                        <Row label='Default mode' hint='System follows the device setting'>
                            <Segmented
                                name='Default mode'
                                value={draft.mode.default}
                                options={ENUMS.defaultMode}
                                onChange={(v) =>
                                    update((n) => {
                                        n.mode.default = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Allow users to switch' hint='Their choice is remembered per account'>
                            <Toggle
                                label='Allow users to switch'
                                checked={draft.mode.allowToggle}
                                onChange={(v) =>
                                    update((n) => {
                                        n.mode.allowToggle = v;
                                    })
                                }
                            />
                        </Row>
                    </Section>

                    <Section title='Colours' hint='Each mode has its own colours. Contrast is checked against WCAG AA.'>
                        <div className='lumen-ap-modebar'>
                            <Segmented
                                name='Edit colours for'
                                value={editMode}
                                options={['dark', 'light'] as const}
                                onChange={setEditMode}
                                labels={{ dark: 'Dark mode', light: 'Light mode' }}
                            />
                            <span className='lumen-ap-contrast-summary' data-ok={failing.length === 0}>
                                {failing.length === 0
                                    ? 'All contrast checks pass'
                                    : `${failing.length} contrast warning${failing.length > 1 ? 's' : ''}`}
                            </span>
                        </div>
                        <div className='lumen-ap-colors'>
                            {COLOR_KEYS.map((key) => {
                                const [label, hint] = COLOR_LABELS[key];
                                const warnings = report.filter(
                                    (r) => r.mode === editMode && !r.ok && (r.fg === key || r.bg === key),
                                );
                                return (
                                    <div key={key} className='lumen-ap-color-row' data-warn={warnings.length > 0}>
                                        <span className='lumen-ap-row-label'>
                                            {label}
                                            <small>{hint}</small>
                                        </span>
                                        <ColorField
                                            label={label}
                                            value={colors[key]}
                                            onChange={(v) =>
                                                update((n) => {
                                                    n.color[editMode][key] = v;
                                                })
                                            }
                                        />
                                        {warnings.map((w) => (
                                            <span key={w.label} className='lumen-ap-warning' role='status'>
                                                {w.label}: {w.ratio.toFixed(2)}:1, needs {w.min}:1
                                            </span>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={() =>
                                update((n) => {
                                    n.color[editMode] = clone(state.defaults.color[editMode]);
                                })
                            }
                        >
                            Reset {editMode} colours
                        </Button>
                    </Section>

                    <Section title='Typography'>
                        <datalist id='lumen-fonts'>
                            <option value='Sora' />
                            <option value='system-ui' />
                            <option value='Inter, system-ui' />
                            <option value='ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' />
                        </datalist>
                        {(['display', 'body', 'mono'] as const).map((key) => (
                            <Row
                                key={key}
                                label={{ display: 'Headings font', body: 'Body font', mono: 'Code font' }[key]}
                                hint={key === 'display' ? 'Sora ships with the theme' : undefined}
                            >
                                <input
                                    className='lumen-ap-input'
                                    list='lumen-fonts'
                                    value={draft.typography[key]}
                                    onChange={(e) =>
                                        update((n) => {
                                            n.typography[key] = e.target.value.replace(/[^A-Za-z0-9 ,'"_.-]/g, '');
                                        })
                                    }
                                />
                            </Row>
                        ))}
                        <Row label='Font stylesheet' hint='Optional https URL, for example a font service'>
                            <input
                                className='lumen-ap-input'
                                placeholder='https://'
                                value={draft.typography.stylesheet}
                                onChange={(e) =>
                                    update((n) => {
                                        n.typography.stylesheet = e.target.value.trim();
                                    })
                                }
                            />
                        </Row>
                        <Row label='Text size'>
                            <Range
                                value={draft.typography.scale}
                                range={RANGES.scale}
                                step={0.05}
                                unit='×'
                                onChange={(v) =>
                                    update((n) => {
                                        n.typography.scale = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Heading weight'>
                            <Range
                                value={draft.typography.headingWeight}
                                range={RANGES.headingWeight}
                                step={100}
                                onChange={(v) =>
                                    update((n) => {
                                        n.typography.headingWeight = v;
                                    })
                                }
                            />
                        </Row>
                    </Section>

                    <Section title='Shape and spacing'>
                        <Row label='Corner radius' hint='Cards use the full radius'>
                            <Range
                                value={draft.radius.base}
                                range={RANGES.radius}
                                step={1}
                                unit='px'
                                onChange={(v) =>
                                    update((n) => {
                                        n.radius.base = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Spacing unit' hint='Scales every gap and padding'>
                            <Range
                                value={draft.spacing.base}
                                range={RANGES.spacing}
                                step={0.5}
                                unit='px'
                                onChange={(v) =>
                                    update((n) => {
                                        n.spacing.base = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Density'>
                            <Segmented
                                name='Density'
                                value={draft.density}
                                options={ENUMS.density}
                                onChange={(v) =>
                                    update((n) => {
                                        n.density = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Shadows'>
                            <Segmented
                                name='Shadows'
                                value={draft.elevation.shadow}
                                options={ENUMS.shadow}
                                onChange={(v) =>
                                    update((n) => {
                                        n.elevation.shadow = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Borders on cards'>
                            <Toggle
                                label='Borders on cards'
                                checked={draft.elevation.borders}
                                onChange={(v) =>
                                    update((n) => {
                                        n.elevation.borders = v;
                                    })
                                }
                            />
                        </Row>
                    </Section>

                    <Section title='Layout'>
                        <Row label='Sidebar' hint='Floating draws it as a card'>
                            <Segmented
                                name='Sidebar'
                                value={draft.layout.sidebar}
                                options={ENUMS.sidebar}
                                onChange={(v) =>
                                    update((n) => {
                                        n.layout.sidebar = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Sidebar width'>
                            <Range
                                value={draft.layout.sidebarWidth}
                                range={RANGES.sidebarWidth}
                                step={10}
                                unit='px'
                                onChange={(v) =>
                                    update((n) => {
                                        n.layout.sidebarWidth = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Active item'>
                            <Segmented
                                name='Active item'
                                value={draft.layout.indicator}
                                options={ENUMS.indicator}
                                onChange={(v) =>
                                    update((n) => {
                                        n.layout.indicator = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Content width'>
                            <Segmented
                                name='Content width'
                                value={draft.layout.contentWidth}
                                options={ENUMS.contentWidth}
                                onChange={(v) =>
                                    update((n) => {
                                        n.layout.contentWidth = v;
                                    })
                                }
                            />
                        </Row>
                        <Row label='Background glow' hint='Soft accent light behind the page'>
                            <Toggle
                                label='Background glow'
                                checked={draft.layout.backgroundGlow}
                                onChange={(v) =>
                                    update((n) => {
                                        n.layout.backgroundGlow = v;
                                    })
                                }
                            />
                        </Row>
                    </Section>

                    <Section title='Branding' hint='Replace the Luminare logos with your own, or leave a slot empty.'>
                        <Row label='Product name' hint='Shown on the login page; empty keeps the panel text'>
                            <input
                                className='lumen-ap-input'
                                value={draft.branding.productName}
                                maxLength={60}
                                onChange={(e) =>
                                    update((n) => {
                                        n.branding.productName = e.target.value.replace(/[<>]/g, '');
                                    })
                                }
                            />
                        </Row>
                        {(Object.keys(ASSET_LABELS) as BrandingAssetKey[]).map((slot) => {
                            const [label, hint] = ASSET_LABELS[slot];
                            const value = draft.branding[slot];
                            return (
                                <div key={slot} className='lumen-ap-asset'>
                                    <span className='lumen-ap-asset-thumb' data-slot={slot}>
                                        {value ? <img src={value} alt='' /> : <em>None</em>}
                                    </span>
                                    <span className='lumen-ap-row-label'>
                                        {label}
                                        <small>{hint}</small>
                                        <input
                                            className='lumen-ap-input'
                                            aria-label={`${label} URL`}
                                            placeholder='/storage/lumen/… or https://'
                                            value={value}
                                            onChange={(e) =>
                                                update((n) => {
                                                    n.branding[slot] = e.target.value.trim();
                                                })
                                            }
                                        />
                                    </span>
                                    <span className='lumen-ap-asset-actions'>
                                        <label className='lumen-ap-upload'>
                                            {busy === slot ? 'Uploading…' : 'Upload'}
                                            <input
                                                type='file'
                                                hidden
                                                accept={state.upload.extensions.map((e) => `.${e}`).join(',')}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) void upload(slot, file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                        <Button
                                            type='button'
                                            variant='secondary'
                                            size='sm'
                                            disabled={!value}
                                            onClick={() =>
                                                update((n) => {
                                                    n.branding[slot] = '';
                                                })
                                            }
                                        >
                                            Clear
                                        </Button>
                                    </span>
                                </div>
                            );
                        })}
                    </Section>

                    <Section
                        title='Custom CSS'
                        hint='Added after the tokens on every page. Use the --lumen-* variables to stay in sync with both modes.'
                    >
                        <textarea
                            className='lumen-ap-input lumen-ap-code'
                            rows={8}
                            spellCheck={false}
                            maxLength={20000}
                            placeholder={
                                ':root[data-theme="dark"] .my-banner { background: var(--lumen-surface-raised); }'
                            }
                            value={draft.customCss}
                            onChange={(e) =>
                                update((n) => {
                                    n.customCss = e.target.value;
                                })
                            }
                        />
                    </Section>
                </div>

                <aside className='lumen-ap-preview'>
                    <div className='lumen-ap-preview-head'>
                        <strong>Preview</strong>
                        <span className='lumen-ap-row-label'>
                            <small>Apply to this page while editing</small>
                        </span>
                        <Toggle label='Live preview on this page' checked={live} onChange={setLive} />
                    </div>
                    <Sample tokens={draft} mode='dark' />
                    <Sample tokens={draft} mode='light' />
                    {failing.length > 0 && (
                        <ul className='lumen-ap-contrast-list'>
                            {failing.map((r) => (
                                <li key={r.mode + r.label}>
                                    <b>{r.mode === 'dark' ? 'Dark' : 'Light'}</b> {r.label}: {r.ratio.toFixed(2)}:1
                                    (needs {r.min}:1)
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>

            <div className='lumen-ap-savebar' data-dirty={dirty}>
                <span>{dirty ? 'Unsaved changes' : state.saved ? 'Saved' : 'Using the default appearance'}</span>
                <Button
                    type='button'
                    variant='secondary'
                    disabled={!dirty || busy !== null}
                    onClick={() => setDraft(clone(state.tokens))}
                >
                    Discard
                </Button>
                <Button type='button' disabled={!dirty || busy !== null} onClick={() => void save()}>
                    {busy === 'save' ? 'Saving…' : 'Save'}
                </Button>
            </div>
        </div>
    );
};

const AppearancePage = () => {
    const [state, setState] = useState<AppearanceState | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        api.get()
            .then(setState)
            .catch(() => setError(true));
    }, []);

    return (
        <PageContentBlock title='Appearance'>
            <MainPageHeader direction='column' title='Appearance'>
                <p className='text-sm text-neutral-400'>
                    Colours, fonts, spacing, layout and logos for the client area and the admin area. Changes apply
                    without a rebuild.
                </p>
            </MainPageHeader>
            {error && <p className='lumen-ap-error'>The appearance settings could not be loaded.</p>}
            {state && <AppearanceEditor initial={state} onSaved={setState} />}
        </PageContentBlock>
    );
};

export default AppearancePage;
