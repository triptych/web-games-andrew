/**
 * browsertest.mjs — the real thing: real Chromium, real WebGL, real three.js.
 *
 * Loads game-040/index.html unmodified, walks title -> intro -> briefing ->
 * play -> boss -> flare -> pause -> a 390x844 phone viewport, screenshots each
 * step, and fails on any console error, page error or failed request.
 *
 * Setup (nothing here is committed to the repo):
 *
 *   npm i playwright                       # or npx playwright
 *   python3 -m http.server 8040            # from the REPO ROOT, not this folder
 *   node dev/browsertest.mjs
 *
 * If the machine cannot reach unpkg.com (a sandbox, an air-gapped CI), fetch the
 * matching package once and point THREE_PKG at it; requests to the CDN are then
 * fulfilled from disk, so the page still runs the genuine three.js r165:
 *
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node dev/browsertest.mjs
 *
 * Other env vars: BASE (default http://127.0.0.1:8040), PW_CHROMIUM_PATH (needed
 * where Playwright's bundled Chromium has dropped old headless mode -- point it
 * at a headless_shell binary), OUT (screenshot directory).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SP = path.dirname(new URL(import.meta.url).pathname);
const PKG = process.env.THREE_PKG ?? path.join(SP, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8040';
const OUT = process.env.OUT ?? path.join(SP, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// Only stub the CDN when a local copy was provided; otherwise let the real
// request through so this test also covers the shipped import map end to end.
if (fs.existsSync(PKG)) await page.route('https://unpkg.com/**', (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) { console.log('  [route] MISSING', rel); return route.abort(); }
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});

page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => {
    if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
});

const step = async (label, fn) => { console.log(`\n== ${label}`); await fn(); };
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log(`  shot: ${name}.png`); };
const stat = async () => page.evaluate(() => {
    const c = document.querySelector('canvas#gl');
    return {
        canvas: c ? { w: c.width, h: c.height } : null,
        screenVisible: !document.getElementById('screen').classList.contains('hidden'),
        hudVisible: !document.getElementById('hud').classList.contains('hidden'),
        title: document.querySelector('.title-mark')?.textContent ?? null,
        score: document.getElementById('score-val')?.textContent,
        saved: document.getElementById('saved-val')?.textContent,
        level: document.getElementById('level-name')?.textContent,
        boss: document.getElementById('boss-bar')?.classList.contains('hidden') ? null
              : document.getElementById('boss-name')?.textContent,
    };
});
// NOTE: this reads back the WebGL canvas, which is cleared after compositing
// unless preserveDrawingBuffer is set — so it reports 0 even when the frame is
// full of light. The screenshots are the real evidence; this is only a
// canvas-exists probe.
const brightness = async () => page.evaluate(async () => {
    const c = document.querySelector('canvas#gl');
    const bmp = await createImageBitmap(c);
    const off = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = off.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    let lit = 0, sum = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
        const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sum += v;
        if (v > 28) lit++;
    }
    return { avg: +(sum / (data.length / (4 * 97))).toFixed(1), litFraction: +(lit / (data.length / (4 * 97))).toFixed(3) };
});

await step('load the title screen', async () => {
    await page.goto(`${BASE}/game-040/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const s = await stat();
    console.log('  ', JSON.stringify(s));
    console.log('   pixels:', JSON.stringify(await brightness()));
    if (s.title !== 'STARCADET') errors.push(`title screen did not render (${s.title})`);
    await shot('01-title');
});

await step('intro crawl -> briefing', async () => {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await shot('02-intro');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const brief = await page.evaluate(() => document.querySelector('.brief-num')?.textContent ?? null);
    console.log('   briefing:', brief);
    if (!brief) errors.push('briefing did not render');
    await shot('03-briefing');
});

await step('launch and fly level 1', async () => {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    let s = await stat();
    console.log('   after launch:', JSON.stringify(s));
    if (!s.hudVisible) errors.push('HUD did not appear');
    // fly around for a while, using the real input path
    for (let i = 0; i < 6; i++) {
        await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(450); await page.keyboard.up('ArrowLeft');
        await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowUp'); await page.waitForTimeout(280); await page.keyboard.up('ArrowUp');
        await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(220); await page.keyboard.up('ShiftLeft');
    }
    s = await stat();
    console.log('   after ~6s of play:', JSON.stringify(s));
    console.log('   pixels:', JSON.stringify(await brightness()));
    if (!(Number(s.score) > 0)) errors.push(`score did not move (${s.score})`);
    await shot('04-playing');
});

await step('fast-forward to the boss', async () => {
    await page.evaluate(() => {
        const w = window.__sc?.state?.world;
        if (!w) return;
        const cue = w.level.cues.find((c) => c.kind === 'boss');
        w.t = cue.t - 0.05;
        w.cueIndex = w.level.cues.indexOf(cue);
        w.player.lives = 9;
    });
    await page.waitForTimeout(4000);
    const s = await stat();
    console.log('   boss bar:', s.boss);
    console.log('   pixels:', JSON.stringify(await brightness()));
    await shot('05-boss');
});

await step('flare + overdrive + pause', async () => {
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(500);
    await shot('06-flare');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const paused = await page.evaluate(() => !!document.querySelector('.pause'));
    console.log('   paused panel:', paused);
    if (!paused) errors.push('pause panel did not render');
    await shot('07-pause');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
});

await step('phone viewport (390x844)', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    const s = await stat();
    console.log('   canvas:', JSON.stringify(s.canvas));
    console.log('   pixels:', JSON.stringify(await brightness()));
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    if (!noHScroll) errors.push('horizontal scroll at phone width');
    await shot('08-phone');
});

console.log(`\n${errors.length === 0 ? 'NO CONSOLE/PAGE ERRORS' : `${errors.length} ERROR(S):`}`);
for (const e of errors.slice(0, 12)) console.log('  -', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
