/**
 * browsertest.mjs — Arcana Pull in real Chromium, driven by real input (mouse, keys, CDP touches).
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → New Reading by a real click (audio
 *   unlocks) → The Well → Draw 10 → the reveal deals ten backs, a real click turns one, Reveal all, Done → the
 *   Grimoire by key, a card's page by click, placed in a slot by click → Face the Threshold by click → the battle
 *   replays (cards, bars, pips, the canvas), 4× by key, Skip by click → the result, Continue by a real Enter →
 *   Threshold 2 → Escape pauses, Resume → the bot to the first Reading → a card chosen by click → the verdict →
 *   back to the parlour → Save & Quit → Continue restores the run → the effects, voices and music decode and play →
 *   the bot to the ending → Ascend. Every picture the screens show loads. No sideways scroll.
 * phones (touch only) at 390×844 and 844×390: taps through the title, the Well (draw, reveal, done), Auto, a battle
 *   whose eight cards are all on screen, Skip, the result; every control at least 44 px; the sheets fit.
 * nostorage: localStorage throws; the game still boots, draws and fights.
 * Fails on any console error, page error, failed request or HTTP error. The repo is served from disk (serve.mjs).
 *
 *   node game-012/dev/browsertest.mjs
 *   ONLY=desktop,phones,nostorage node game-012/dev/browsertest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0;
let errors = [];
let browser = null;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  ✗', msg); } };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `bt-${name}.png`) });
const ev = (page, f, a) => page.evaluate(f, a);
const until = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

async function open(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!sessionStorage.getItem('kept')) { try { localStorage.clear(); } catch { /* */ } sessionStorage.setItem('kept', '1'); }
    }, nostorage);
    const page = await ctx.newPage();
    await serve(page);
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => { if (!(r.url().endsWith('.mp3') && /aborted/i.test(r.failure()?.errorText || ''))) errors.push('request failed ' + r.url()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/game-012/index.html?debug=1`);
    await page.waitForFunction(() => window.__ap && window.__ap.frames > 3, null, { timeout: 60000 });
    return page;
}

/** A real click at the centre of an element (a real user gesture, unlike element.click()). */
async function click(page, sel) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error('no box for ' + sel);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function tap(page, sel) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error('no box for ' + sel);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
const visible = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0; }, sel);
const noSideScroll = (page) => ev(page, () => document.documentElement.scrollWidth <= innerWidth + 1);
/** Every <img> on screen that has finished loading has pixels (none broken). */
const imagesOk = (page) => ev(page, () => [...document.querySelectorAll('img')].filter((i) => i.offsetParent && i.complete).every((i) => i.naturalWidth > 0));
async function waitImages(page) { await until(page, () => [...document.querySelectorAll('img')].filter((i) => i.offsetParent).every((i) => i.complete), null, 20000); }

// ------------------------------------------------------------------ desktop
async function desktop() {
    console.log('desktop');
    const page = await open({ width: 1280, height: 760 });
    ok(await visible(page, '#title') && await visible(page, '#back-link'), 'title and the ← Games link');
    const top = await ev(page, () => { const r = document.getElementById('back-link').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; });
    ok(top === 'back-link', 'the back link is on top');
    await shot(page, 'title');
    await click(page, '#title-menu [data-act=new]');
    ok(await until(page, () => window.__ap.mode === 'hub'), 'New Reading opens the parlour');
    ok(await ev(page, () => !!window.__ap.audio.ctx), 'the click unlocked audio');
    // the Well
    await click(page, '#btn-well');
    ok(await visible(page, '#well'), 'the Well opens');
    await click(page, '#btn-pull10');
    ok(await until(page, () => document.querySelectorAll('#reveal-grid .rv').length === 10), 'ten cards dealt face down');
    await page.waitForTimeout(700);
    await click(page, '#reveal-grid .rv');
    ok(await ev(page, () => document.querySelector('#reveal-grid .rv').classList.contains('open')), 'a click turns a card');
    await click(page, '#btn-reveal-all');
    ok(await until(page, () => !document.getElementById('btn-reveal-done').hidden, null, 8000), 'Reveal all turns the rest');
    await shot(page, 'reveal');
    await click(page, '#btn-reveal-done');
    ok(await ev(page, () => window.__ap.G.stats.pulls === 10 && window.__ap.G.dust === 360), 'ten draws for 540');
    await click(page, '#well [data-close]');
    ok(await ev(page, () => window.__ap.G.party.filter(Boolean).length === 4), 'the first draw sets a spread');
    await waitImages(page);
    ok(await imagesOk(page), 'the parlour pictures load');
    await shot(page, 'hub');
    // the Grimoire and a card's page
    await page.keyboard.press('KeyG');
    ok(await visible(page, '#grimoire'), 'G opens the Grimoire');
    await click(page, '#grim-grid .gcell');
    ok(await visible(page, '#detail'), 'a card opens its page');
    const id = await ev(page, () => window.__ap.ui.detailId);
    await click(page, '#det-slots button:nth-child(2)');
    ok(await ev(page, (id) => window.__ap.G.party[1] === id, id), 'placed in the second slot by click');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    ok(!(await visible(page, '#grimoire')) && !(await visible(page, '#detail')), 'Escape closes the sheets');
    // a battle
    await click(page, '#btn-fight');
    ok(await until(page, () => window.__ap.mode === 'battle'), 'Face the Threshold starts a battle');
    ok(await ev(page, () => document.querySelectorAll('#stage .unit').length >= 6), 'both lines on the stage');
    await page.waitForTimeout(2500);
    ok(await ev(page, () => window.__ap.stage.i > 3), 'the timeline is playing');
    const canvasOk = await ev(page, () => { const c = document.getElementById('fx'); return c.width > 100 && c.height > 100; });
    ok(canvasOk, 'the effects canvas fills the stage');
    await shot(page, 'battle');
    await page.keyboard.press('Digit4');
    ok(await ev(page, () => window.__ap.settings.speed === 4), '4 sets 4×');
    await click(page, '#btn-skip');
    ok(await until(page, () => !document.getElementById('result').hidden, null, 10000), 'Skip ends the replay and shows the result');
    const won = await ev(page, () => window.__ap.G.phase === 'won');
    await page.waitForTimeout(400);
    await shot(page, 'result');
    await page.keyboard.press('Enter');
    ok(await until(page, () => window.__ap.mode === 'hub'), 'Enter on the result returns to the parlour');
    ok(await ev(page, (w) => window.__ap.G.trial === (w ? 2 : 1), won), 'onward (or the same Threshold after a loss)');
    // pause
    await page.keyboard.press('Escape');
    ok(await visible(page, '#pause'), 'Escape pauses');
    await click(page, '#pause-menu [data-act=resume]');
    ok(!(await visible(page, '#pause')), 'Resume');
    // the bot to the first Reading
    await ev(page, () => { for (let k = 0; k < 500 && window.__ap.mode !== 'reading' && window.__ap.G.phase !== 'over'; k++) window.__ap.ff(1); });
    ok(await ev(page, () => window.__ap.mode === 'reading' && document.querySelectorAll('#reading-row .rcard').length === 3), 'a Reading after the third Threshold');
    await waitImages(page);
    await shot(page, 'reading');
    await click(page, '#reading-row .rcard:nth-child(2)');
    ok(await until(page, () => !document.getElementById('btn-reading-done').hidden), 'a card chosen by click gives a verdict');
    ok(await ev(page, () => window.__ap.seen.omen === 1), 'the omen event');
    await click(page, '#btn-reading-done');
    ok(await until(page, () => window.__ap.mode === 'hub' && window.__ap.G.trial === 4), 'back in the parlour at Threshold 4');
    // Save & Quit, Continue
    await page.keyboard.press('Escape');
    await click(page, '#pause-menu [data-act=quit]');
    ok(await until(page, () => window.__ap.mode === 'title' && !document.getElementById('btn-continue').hidden), 'Save & Quit shows Continue');
    await click(page, '#btn-continue');
    ok(await until(page, () => window.__ap.mode === 'hub' && window.__ap.G.trial === 4), 'Continue restores the run');
    // sound
    ok(await until(page, () => Object.keys(window.__ap.audio.buffers).length >= 20 && Object.keys(window.__ap.audio.voices).length >= 20, null, 30000), 'effects and voices decode');
    ok(await until(page, () => window.__ap.audio.playing(), null, 15000), 'the music plays');
    ok(await ev(page, () => Object.keys(window.__ap.audio.played).some((k) => k.startsWith('vo:'))), 'a voice line played');
    // to the ending
    await ev(page, () => { for (let k = 0; k < 3000 && window.__ap.G.phase !== 'ending' && window.__ap.G.phase !== 'over'; k++) window.__ap.ff(1); });
    const phase = await ev(page, () => window.__ap.G.phase);
    if (phase === 'ending') {
        ok(await visible(page, '#ending'), 'the ending screen');
        await waitImages(page);
        await shot(page, 'ending');
        await click(page, '#btn-ascend');
        ok(await until(page, () => window.__ap.mode === 'hub' && window.__ap.G.asc === 1 && !document.getElementById('hud-asc').hidden), 'Ascend begins again, one higher');
    } else {
        // the last battle was lost: let the replay end, then the result leads to the last-candle screen
        await ev(page, () => window.__ap.stage.skip());
        ok(await until(page, () => !document.getElementById('result').hidden, null, 10000), 'the last result');
        await click(page, '#btn-res-next');
        ok(await until(page, () => window.__ap.mode === 'over') && await visible(page, '#over'), 'the run ended: the last-candle screen');
        await shot(page, 'over');
    }
    ok(await noSideScroll(page), 'no sideways scroll');
    ok(!errors.length, 'no errors: ' + errors.slice(0, 4).join(' | '));
}

// ------------------------------------------------------------------ phones
async function phone(w, h) {
    console.log(`phone ${w}×${h}`);
    const page = await open({ width: w, height: h }, { touch: true });
    await tap(page, '#title-menu [data-act=new]');
    ok(await until(page, () => window.__ap.mode === 'hub'), 'tap: New Reading');
    await tap(page, '#btn-well');
    await tap(page, '#btn-pull10');
    ok(await until(page, () => document.querySelectorAll('#reveal-grid .rv').length === 10), 'tap: ten cards dealt');
    await page.waitForTimeout(700);
    await tap(page, '#btn-reveal-all');
    ok(await until(page, () => !document.getElementById('btn-reveal-done').hidden, null, 8000), 'tap: Reveal all');
    const revealFits = await ev(page, () => [...document.querySelectorAll('#reveal-grid .rv')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
    ok(revealFits, 'every revealed card on screen');
    await shot(page, `reveal-${w}`);
    await tap(page, '#btn-reveal-done');
    await tap(page, '#well [data-close]');
    await tap(page, '#btn-auto');
    await waitImages(page);
    await shot(page, `hub-${w}`);
    const small = await ev(page, () => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('[hidden]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((b) => b.id || b.className || b.textContent).slice(0, 5));
    ok(!small.length, 'parlour controls ≥ 44 px: ' + small.join(', '));
    await tap(page, '#btn-fight');
    ok(await until(page, () => window.__ap.mode === 'battle'), 'tap: a battle');
    await page.waitForTimeout(1500);
    const onScreen = await ev(page, () => [...document.querySelectorAll('#stage .unit .card')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= -2 && r.right <= innerWidth + 2 && r.top >= 0 && r.bottom <= innerHeight; }));
    ok(onScreen, 'every card in the battle on screen');
    await shot(page, `battle-${w}`);
    const ctl = await ev(page, () => [...document.querySelectorAll('.battle-bar button')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight; }));
    ok(ctl, 'battle controls ≥ 44 px and on screen');
    await tap(page, '#btn-skip');
    ok(await until(page, () => !document.getElementById('result').hidden, null, 10000), 'tap: Skip shows the result');
    await tap(page, '#btn-res-next');
    ok(await until(page, () => window.__ap.mode === 'hub'), 'tap: back to the parlour');
    await tap(page, '#btn-grimoire');
    const fits = await ev(page, () => { const r = document.querySelector('#grimoire .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 1; });
    ok(fits, 'the Grimoire sheet fits');
    await page.waitForTimeout(400);
    await shot(page, `grimoire-${w}`);
    ok(await noSideScroll(page), 'no sideways scroll');
    ok(!errors.length, 'no errors: ' + errors.slice(0, 4).join(' | '));
}

// ------------------------------------------------------------------ storage blocked
async function nostorage() {
    console.log('nostorage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act=new]');
    ok(await until(page, () => window.__ap.mode === 'hub'), 'boots with storage blocked');
    await ev(page, () => { window.__ap.act({ t: 'pull', n: 10 }); document.getElementById('reveal').hidden = true; window.__ap.act({ t: 'fight' }); window.__ap.stage.skip(); });
    ok(await until(page, () => !document.getElementById('result').hidden, null, 10000), 'draws and fights');
    ok(!errors.length, 'no errors: ' + errors.slice(0, 4).join(' | '));
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  ✗ crashed:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
