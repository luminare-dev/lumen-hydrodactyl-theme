// CI only: screenshots of the patched panel in dark and light mode.
//   node ci/playwright/screenshots.mjs <base-url> <out-dir> <server-short-id>
// The theme's default mode is "system", so the browser's colour scheme picks the mode.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [base = 'http://localhost:8080', out = 'screenshots', server = ''] = process.argv.slice(2);
const password = process.env.SEED_PASSWORD || 'lumen-ci-password';
mkdirSync(out, { recursive: true });

const pages = [
    ['client-dashboard', '/'],
    ['client-account', '/account'],
    ...(server ? [['client-server', `/server/${server}`]] : []),
    ['admin-overview', '/admin'],
    ['admin-servers', '/admin/servers'],
    ['admin-users', '/admin/users'],
    ['admin-nodes', '/admin/nodes'],
    ['admin-settings', '/admin/settings'],
    ['admin-appearance', '/admin/appearance'],
];

const report = [];
const browser = await chromium.launch();
for (const mode of ['dark', 'light']) {
    const context = await browser.newContext({ colorScheme: mode, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const shot = async (name) => {
        await page.waitForTimeout(1200);
        const file = join(out, `${name}-${mode}.png`);
        await page.screenshot({ path: file });
        const state = await page.evaluate(() => {
            const art = document.querySelector('.lumen-login-art');
            return {
                theme: document.documentElement.dataset.theme,
                lumen: document.documentElement.dataset.lumen ?? null,
                tokens: Boolean(document.getElementById('lumen-tokens')),
                loginArt: art ? getComputedStyle(art).backgroundImage.slice(0, 120) : null,
            };
        });
        report.push({ name, mode, url: page.url(), ...state });
        console.log(`${file}  theme=${state.theme} lumen=${state.lumen} tokens=${state.tokens}`);
    };

    await page.goto(`${base}/auth/login`, { waitUntil: 'networkidle' });
    await shot('login');
    await page.fill('#user', 'admin');
    await page.fill('#password', password);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30000 }), page.press('#password', 'Enter')]);

    for (const [name, path] of pages) {
        try {
            await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
        } catch {
            // The server page keeps a websocket retry going; take the shot anyway.
        }
        await shot(name);
    }

    await page.goto(`${base}/lumen-missing-page`, { waitUntil: 'networkidle' }).catch(() => {});
    await shot('not-found');
    if (errors.length) console.log(`page errors (${mode}):\n  ${errors.join('\n  ')}`);
    await context.close();
}
await browser.close();
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const missing = report.filter((r) => r.lumen !== '1' || !r.tokens);
if (missing.length) {
    console.error(`Lumen head missing on: ${missing.map((r) => `${r.name}-${r.mode}`).join(', ')}`);
    process.exit(1);
}
