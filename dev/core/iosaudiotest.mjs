/**
 * iosaudiotest.mjs — lib/ios-audio.js in real games, on an emulated iPhone and on a desktop.
 *
 * Chromium can't reproduce iOS's ringer switch or an interrupted AudioContext, so this checks the
 * parts that can be checked: on an iPhone user agent the script switches on, the first tap starts
 * the silent loop, a hidden tab pauses it and showing the tab starts it again, an AudioContext the
 * game makes is tracked, and an 'interrupted' state (simulated) is resumed. On a desktop it does
 * nothing at all. Every game must load with no page errors either way.
 *
 *   python3 -m http.server 8000          # from the REPO ROOT
 *   node dev/core/iosaudiotest.mjs [game-NNN ...]
 *
 * Env: BASE (default http://127.0.0.1:8000), THREE_PKG.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const PKG = process.env.THREE_PKG ?? path.join(HERE, '../package');
// one of each kind: canvas, Kaplay, Phaser, three.js, the game that had the fix first, a DOM game
const GAMES = process.argv.slice(2).length ? process.argv.slice(2) : ['game-001', 'game-004', 'game-019', 'game-065', 'game-100', 'game-139'];

let fails = 0;
const check = (c, m) => { console.log(c ? '  ok' : '  FAIL', m); if (!c) fails++; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function open(game, ctxOpts) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route(/https:\/\/(unpkg\.com|cdn\.jsdelivr\.net\/npm)\/three@0\.165\.0\/.*/, (r) => {
            const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^.*three@0\.165\.0\//, ''));
            return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort();
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/${game}/index.html`);
    await page.waitForTimeout(3000);
    return { ctx, page, errors };
}

const setHidden = (page, hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

for (const game of GAMES) {
    console.log(game);
    // ---------------------------------------------------------------- iPhone
    {
        const { ctx, page, errors } = await open(game, { ...devices['iPhone 13'] });
        check(await page.evaluate(() => window.__iosAudio?.active === true), 'iPhone: switched on');
        await page.touchscreen.tap(195, 420);
        await page.waitForTimeout(600);
        check(await page.evaluate(() => !!window.__iosAudio.media && !window.__iosAudio.media.paused), 'iPhone: the first tap starts the silent loop');
        await setHidden(page, true);
        await page.waitForTimeout(200);
        check(await page.evaluate(() => window.__iosAudio.media?.paused === true), 'iPhone: a hidden tab pauses it');
        await setHidden(page, false);
        await page.waitForTimeout(400);
        check(await page.evaluate(() => window.__iosAudio.media?.paused === false), 'iPhone: showing the tab starts it again');
        // an AudioContext made now is tracked, and a (simulated) 'interrupted' state is resumed
        const r = await page.evaluate(async () => {
            const ctx = new AudioContext();
            const before = window.__iosAudio.resumed;
            let resumeCalled = false;
            Object.defineProperty(ctx, 'state', { configurable: true, get: () => 'interrupted' });
            ctx.resume = () => { resumeCalled = true; return Promise.resolve(); };
            ctx.dispatchEvent(new Event('statechange'));
            return { tracked: [...window.__iosAudio.contexts].some((w) => w.deref() === ctx), resumeCalled, counted: window.__iosAudio.resumed > before };
        });
        check(r.tracked, 'iPhone: a new AudioContext is tracked');
        check(r.resumeCalled && r.counted, 'iPhone: an interrupted context is resumed');
        check(await page.evaluate(() => document.querySelectorAll('audio[aria-hidden]').length <= 1), 'iPhone: one silent loop, not several');
        check(errors.length === 0, `iPhone: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
        await ctx.close();
    }
    // ---------------------------------------------------------------- desktop
    {
        const { ctx, page, errors } = await open(game, { viewport: { width: 1280, height: 760 } });
        await page.mouse.click(640, 380);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        const d = await page.evaluate(() => ({ active: window.__iosAudio?.active, media: !!window.__iosAudio?.media }));
        check(d.active === false && !d.media, 'desktop: does nothing');
        check(errors.length === 0, `desktop: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
        await ctx.close();
    }
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
