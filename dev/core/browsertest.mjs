/**
 * browsertest.mjs — every lib/core module in real Chromium, on a desktop and a touch-only phone,
 * with storage working and with every localStorage access throwing (as in a browser that blocks
 * site data, or itch.io's iframe). Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000          # from the REPO ROOT
 *   node dev/core/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8000).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
let fails = 0;

for (const nostorage of [false, true]) for (const phone of [false, true]) {
    const tag = `${phone ? 'phone' : 'desktop'}${nostorage ? ' + nostorage' : ''}`;
    const ok = (c, m) => { if (c) console.log('  ok', tag, m); else { fails++; console.log('  FAIL', tag, m); } };
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    }, nostorage);
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
    page.on('requestfailed', (r) => errs.push(`failed ${r.url()}`));
    await page.goto(`${BASE}/dev/core/probe.html`);
    await page.waitForFunction(() => window.__core && __core().frames > 30, null, { timeout: 15000 });
    if (phone) await page.tap('#b'); else await page.click('#b');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(400);
    const p = await page.evaluate(() => __core());
    ok(errs.length === 0, `no errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
    ok(p.sim.p === 2 && p.sim.r > 0 && p.sim.n > 0, 'pure modules load in the page');
    ok(p.audio === 'running', `audio context running after a gesture (${p.audio})`);
    ok(p.sized && p.sized.w === (phone ? 390 : 1280) && p.sized.h === (phone ? 844 : 760), `viewport ${p.sized?.w}×${p.sized?.h}`);
    ok(p.steps > 0, `fixed steps ran (${p.steps} in ${p.frames} frames)`);
    ok(p.state.x === 1 && p.queue >= 1, 'held D reads as x = 1 and the press is queued');
    ok(p.esc === '&lt;a&gt;' && p.t === '1m 15s' && p.toast === 'Hello <b>there</b>', 'dom helpers (a toast is text, not markup)');
    if (nostorage) ok(p.saved === false && p.loaded === null && p.storage === false && p.settings.sfx === 0.5, 'blocked storage: no save, defaults, no throw');
    else ok(p.saved === true && p.loaded?.x === 3 && p.storage === true, 'save slot round trip');
    await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
