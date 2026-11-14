/**
 * make-icons.mjs — renders Pocket Garden's app icons and install-dialog
 * screenshots in Chromium.
 *
 *   console/icons/icon.svg           → icon-192.png, icon-512.png      (purpose "any": a rounded tile)
 *   console/icons/icon-maskable.svg  → icon-maskable-192.png, -512.png (full bleed, device in the safe circle)
 *                                    → apple-touch-icon.png (180; iOS rounds the corners itself)
 *   the console itself               → screenshot-wide.jpg (1280×800), screenshot-narrow.jpg (390×844)
 *
 * The screenshots need the repo served:
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node console/dev/make-icons.mjs        # SHOTS=0 skips the screenshots
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.join(HERE, '..', 'icons');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const render = async (svgFile, size, out) => {
        const svg = fs.readFileSync(path.join(ICONS, svgFile), 'utf8');
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
        await page.waitForFunction(() => document.images[0].complete);
        await page.screenshot({ path: path.join(ICONS, out), omitBackground: true });
        console.log('wrote', out);
    };
    await render('icon.svg', 192, 'icon-192.png');
    await render('icon.svg', 512, 'icon-512.png');
    await render('icon-maskable.svg', 192, 'icon-maskable-192.png');
    await render('icon-maskable.svg', 512, 'icon-maskable-512.png');
    await render('icon-maskable.svg', 180, 'apple-touch-icon.png');

    if (process.env.SHOTS !== '0') {
        for (const [name, viewport, touch] of [
            ['screenshot-wide.jpg', { width: 1280, height: 800 }, false],
            ['screenshot-narrow.jpg', { width: 390, height: 844 }, true],
        ]) {
            const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
            await ctx.addInitScript(() => {
                try {
                    localStorage.setItem('garden.starred', JSON.stringify(['game-089', 'game-123', 'game-135']));
                } catch {
                    /* fine */
                }
            });
            const p = await ctx.newPage();
            await p.goto(`${BASE}/console/#game-135`);
            await p.waitForFunction(() => window.pocketGarden);
            await p.waitForTimeout(1600); // fonts, art and the cartridge dropping in
            await p.screenshot({ path: path.join(ICONS, name), type: 'jpeg', quality: 82 });
            console.log('wrote', name);
            await ctx.close();
        }
    }
} finally {
    await browser.close();
}
