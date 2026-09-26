/**
 * mobiletest.mjs — an emulated phone driven only by touch (page.touchscreen),
 * in portrait (390×844) and landscape (844×390).
 *
 * Every tap first checks that its target is actually visible: on screen, the
 * topmost element at its centre (not hidden under the title or another
 * panel), and not under the black fade layer. Playwright's own click checks
 * miss that last case, because #fade has pointer-events:none — which is
 * exactly how "How to Play does nothing" and "Begin shows a black screen"
 * got past dev/walkthrough.mjs.
 *
 * Needs a static server on the repo root (python3 -m http.server 8044).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8044';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

let checks = 0, failed = 0;
function check(cond, label) {
    checks++;
    if (!cond) { failed++; console.log('  ✗ ' + label); } else if (process.env.VERBOSE) console.log('  ✓ ' + label);
}

async function run(name, viewport) {
    console.log(`${name} ${viewport.width}×${viewport.height}`);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem('game-044-prefs', JSON.stringify({ sound: false, textSpeed: 0 })); } catch { /* ignore */ }
    });
    await page.goto(`${BASE}/game-044/index.html`);
    await page.waitForTimeout(700);

    /** Is `sel` really visible and tappable? Returns its centre, or a reason. */
    const probe = (sel) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { why: 'missing' };
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return { why: 'zero size' };
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return { why: 'off screen' };
        const top = document.elementFromPoint(cx, cy);
        if (!top || !(top === el || el.contains(top))) return { why: 'covered by ' + (top?.closest('[id]')?.id || top?.tagName) };
        const fade = +getComputedStyle(document.getElementById('fade')).opacity;
        if (fade > 0.05) return { why: 'under the fade (opacity ' + fade + ')' };
        return { x: cx, y: cy, w: r.width, h: r.height };
    }, sel);

    async function tap(sel, label = sel) {
        let p;
        for (let i = 0; i < 20; i++) { p = await probe(sel); if (p.x !== undefined) break; await page.waitForTimeout(60); }
        check(p.x !== undefined, `${label} is visible and tappable${p.why ? ' — ' + p.why : ''}`);
        if (p.x === undefined) throw new Error(`${label}: ${p.why}`);
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForTimeout(80);
    }

    async function tapGame(id) {
        const pt = await page.evaluate((id) => {
            const s = __story.spots().find(h => h.id === id);
            const [x, y, w, h] = s.shape.rect;
            for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) {
                const gx = x + w * i / 8, gy = y + h * j / 8;
                if (__story.spotAt(gx, gy) === id) {
                    const r = document.getElementById('screen').getBoundingClientRect();
                    return { x: r.x + gx / 320 * r.width, y: r.y + gy / 200 * r.height };
                }
            }
            return null;
        }, id);
        await page.touchscreen.tap(pt.x, pt.y);
    }

    /** Tap through narration until a choice list, a page, or idle. */
    async function drain() {
        let idleSince = 0;
        for (let n = 0; n < 400; n++) {
            const st = await page.evaluate(() => ({
                msg: !document.getElementById('msg').hidden,
                choices: document.querySelectorAll('#msg-choices .choice').length,
                pages: !document.getElementById('pages').hidden,
                busy: __story.busy, moving: __story.player.moving,
            }));
            if (st.pages || (st.msg && st.choices)) return st;
            if (st.msg) { idleSince = 0; await tap('#msg-box', 'the text box'); continue; }
            // Idle must hold for a moment: a tap can land before the walk it starts.
            if (!st.busy && !st.moving) {
                if (!idleSince) idleSince = Date.now();
                if (Date.now() - idleSince > 300) return st;
            } else idleSince = 0;
            await page.waitForTimeout(60);
        }
        throw new Error('drain() stuck');
    }

    async function choose(text) {
        const i = await page.$$eval('#msg-choices .choice', (bs, t) => bs.findIndex(b => b.innerText.includes(t)), text);
        check(i >= 0, `choice "${text}" offered`);
        await tap(`#msg-choices .choice:nth-child(${i + 1})`, `choice "${text}"`);
    }

    // --- title → How to Play → back ----------------------------------------
    await tap('#t-howto', 'How to Play');
    check(await page.$eval('#pg-title', e => e.innerText.includes('How to Play')), 'How to Play page shows');
    await tap('#pg-btns button', 'How to Play: Continue');
    await tap('#t-new', 'Begin a New Tale');

    // --- prologue pages -------------------------------------------------------
    for (let i = 0; i < 3; i++) {
        const t = await page.$eval('#pg-btns button', b => b.innerText);
        await tap('#pg-btns button', `prologue page ${i + 1} (${t})`);
    }
    let st = await drain();
    check(await page.evaluate(() => __story.scene) === 'cottage', 'arrives in the cottage');
    check((await probe('#screen')).x !== undefined, 'the scene is visible (not blank)');

    // --- a real interaction by touch ----------------------------------------
    await tap('#v-talk', 'Talk verb');
    await tapGame('mab');
    st = await drain();
    check(st.msg && st.choices > 0, 'talking to Gran opens a dialogue');
    await choose("I'm going up the mountain");
    await drain();
    check(await page.evaluate(() => __story.inv.includes('book')), 'Gran hands over the Book');
    await tap('#v-use', 'Use verb');
    await tapGame('cake');
    await drain();
    check(await page.evaluate(() => __story.inv.includes('cake')), 'tapped the cake into the satchel');
    await tap('.slot[data-item="cake"]', 'satchel: cake');
    await tapGame('fire');
    await drain();

    // --- book, menu --------------------------------------------------------------
    await tap('#b-book', 'Book of Tales button');
    await tap('#book-close', 'Close the Book');
    await tap('#b-menu', 'Menu button');
    await tap('#menu-sheet [data-act="help"]', 'Menu: How to play');
    await tap('#pg-btns button', 'help: Continue');
    await tap('#b-menu', 'Menu button');
    await tap('#menu-sheet [data-act="save"]', 'Menu: Save');

    // --- layout ------------------------------------------------------------------
    const lay = await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('.verb, .slot, .sysbtn')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); });
        const sc = document.getElementById('screen').getBoundingClientRect();
        const bar = document.getElementById('bar').getBoundingClientRect();
        return { minTap: Math.min(...sizes), overflowX: document.documentElement.scrollWidth > innerWidth,
            screenOn: sc.top >= 0 && sc.bottom <= innerHeight + 1 && sc.left >= 0 && sc.right <= innerWidth + 1,
            barOn: bar.bottom <= innerHeight + 1, screenW: Math.round(sc.width) };
    });
    check(lay.minTap >= 34, `tap targets are at least 34px (smallest ${Math.round(lay.minTap)})`);
    check(!lay.overflowX, 'no sideways scrolling');
    check(lay.screenOn, 'the whole scene fits on screen');
    check(lay.barOn, 'the verb bar and satchel fit on screen');
    await page.screenshot({ path: `dev/shots/mobile-${name}.png` });

    if (errors.length) { failed++; console.log('  console errors:\n  ' + errors.join('\n  ')); }
    await ctx.close();
}

await run('portrait', { width: 390, height: 844 });
await run('landscape', { width: 844, height: 390 });
console.log(`\n${checks - failed}/${checks} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
