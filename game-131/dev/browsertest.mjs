/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Journey by click → the intro
 *   cards close with the real E key and a click → W walks, → turns, dragging the mouse looks → a real E reads an
 *   inscription into the journal → J opens the journal, its three tabs fill → Escape closes it → P pauses and the
 *   sim stops → Settings opens over the pause sheet and Escape closes it with a slider focused → Space resumes →
 *   heal Fray (the bot), send her into the root-way and guide her with real arrow keys and Space → Save & Quit →
 *   Continue restores → the bot plays to the ending in the page → you can walk on. The picture is not blank, the
 *   models, paintings and sounds loaded, and a voice line made sound.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck appears, the
 *   stick walks, a drag on the right looks, ✋ closes a card and uses things, the tunnel panel's buttons guide Fray,
 *   controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8131          # from the REPO ROOT
 *   node game-131/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8131), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8131';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        // No network to the CDN? Serve the genuine three.js package from disk.
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-131/index.html?debug=1&fast=4&q=low`);
    await page.waitForFunction(() => window.__si && __si.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
/** Read the picture back over a grid of samples: distinct colours (4 bits a channel), the share of the commonest one, mean brightness. */
const picture = (page) => Q(page, () => new Promise((res) => requestAnimationFrame(() => {
    const src = document.getElementById('view'), c = document.createElement('canvas');
    c.width = 64; c.height = 36;
    const g = c.getContext('2d');
    __si.view.renderer.render(__si.view.scene, __si.view.camera);          // same task as the read, so the buffer is still there
    g.drawImage(src, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data, seen = new Map();
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4); seen.set(k, (seen.get(k) || 0) + 1); sum += d[i] + d[i + 1] + d[i + 2]; }
    res({ colours: seen.size, top: Math.max(...seen.values()) / (d.length / 4), mean: sum / (d.length / 4) / 765 });
})));
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const story = (page, goal) => Q(page, (g) => { for (let i = 0; i < 400 && !g.split('|').includes(__si.nextGoal().hint) && !__si.G.done; i++) __si.ff(2); return __si.nextGoal().hint; }, goal);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __si.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('card').hidden, 'New Journey starts and shows the first story card');
    check(await Q(page, () => document.getElementById('card-head').textContent === 'The Spiral Isle' && document.getElementById('card-text').textContent.length > 100), 'the card has its title and words');
    await until(page, () => { const im = document.getElementById('card-img'); return !im.hidden && im.naturalWidth > 600; }, 'and its painting loaded');
    await shot(page, 'desktop-card');
    await page.keyboard.press('KeyE');
    await until(page, () => __si.G.cards.length === 1, 'E closes a card (the press reaches a sim step)');
    await click(page, '#card-next');
    await until(page, () => __si.G.cards.length === 0 && document.getElementById('card').hidden, 'the Continue button closes the next');
    await until(page, () => __si.audio.musicPlaying, 'music is playing');

    const p0 = await Q(page, () => ({ ...__si.G.player }));
    await page.keyboard.down('KeyW');
    await until(page, (z) => __si.G.player.z < z - 2, 'holding W walks north', 30000, p0.z);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('ArrowRight');
    await until(page, (y) => Math.abs(__si.G.player.yaw - y) > 0.3, 'holding → turns', 30000, p0.yaw);
    await page.keyboard.up('ArrowRight');
    const y1 = await Q(page, () => __si.G.player.yaw);
    await page.mouse.move(600, 400); await page.mouse.down(); await page.mouse.move(700, 430, { steps: 4 }); await page.mouse.up();
    await until(page, (y) => Math.abs(__si.G.player.yaw - y) > 0.05 && Math.abs(__si.input.pitch) > 0.01, 'dragging the mouse looks about', 30000, y1);
    // read the picture back from a fixed viewpoint (the Rootshrine's ring, seen level): where the walking and
    // looking above leave the camera varies, and one tree crown or plain sky can fill the view
    await Q(page, () => { __si.input.pitch = 0; __si.goto('rootMural', 3); });
    await until(page, () => __si.view.info.tris > 1000 && Math.abs(__si.view.camera.rotation.x) < 0.01, 'the view has drawn the Rootshrine', 120000);      // the first frame here uploads the ring's models: slow under SwiftShader
    await page.waitForTimeout(800);
    if (process.env.VERBOSE) console.log('   ', JSON.stringify(await Q(page, () => ({ tris: __si.view.info.tris, rx: __si.view.camera.rotation.x, pitch: __si.input.pitch, locked: __si.input.locked, screens: __si.ui.stack, pos: [__si.G.player.x, __si.G.player.z, __si.G.player.yaw] }))));
    const pic = await picture(page);
    // a blank or fogged-out frame is one colour: require several, none covering most of the screen (sky, sea, sand and wood are flat low-poly colours, so the count is small)
    check(pic.colours >= 5 && pic.top < 0.7 && pic.mean > 0.08 && pic.mean < 0.95, `the picture is not blank or washed out (${pic.colours} colours, the commonest ${(pic.top * 100).toFixed(0)}% of the screen, brightness ${pic.mean.toFixed(2)})`);
    await shot(page, 'desktop-shore');

    // read an inscription with the real key
    await Q(page, () => __si.goto('cairn'));
    await until(page, () => __si.G.prompt?.id === 'cairn' && !document.getElementById('prompt').hidden, 'standing by the cairn shows its prompt');
    await page.keyboard.press('KeyE');
    await until(page, () => __si.G.lore.includes('cairn') && document.getElementById('card').className === 'lore', 'E reads it: an inscription card and a journal entry');
    await page.keyboard.press('Space');
    await until(page, () => __si.G.cards.length === 0, 'Space closes it');

    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    check(await Q(page, () => document.querySelectorAll('#journal-body .gem-row').length === 7), 'the pendant tab lists seven gems');
    await click(page, '#journal-tabs [data-tab="stories"]');
    check(await Q(page, () => document.querySelector('#journal-body .story b')?.textContent === 'The Welcome Cairn'), 'the stories tab has the cairn');
    await click(page, '#journal-tabs [data-tab="keepsakes"]');
    check(await Q(page, () => document.querySelectorAll('#journal-body .keep').length === 8), 'the keepsakes tab lists eight collections');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');

    await page.keyboard.press('KeyP');
    await until(page, () => !document.getElementById('pause').hidden, 'P pauses');
    const t0 = await Q(page, () => __si.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __si.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause sheet');
    check(await Q(page, () => { const s = document.getElementById('settings').getBoundingClientRect(); const e = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2); return !!e?.closest('#settings'); }), 'and sits on top of it');
    await Q(page, () => document.getElementById('set-music').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Walk on button resumes');

    // heal Fray with the bot, then guide her through the root-way by hand
    check((await story(page, 'rootTunnel')) === 'rootTunnel', 'the bot meets Fray, finds the moonmint and heals her');
    await Q(page, () => __si.skipCards());
    check(await Q(page, () => __si.G.thimble === undefined && __si.G.fray.state === 'follow' && __si.view.info.models.loaded >= 3 && __si.view.info.models.failed === 0), 'Fray follows, and the 3D models loaded');
    await Q(page, () => { __si.audio.hush(); __si.G.barkT = 0; });
    await Q(page, () => __si.goto('rootTunnel'));
    await until(page, () => __si.G.prompt?.id === 'rootTunnel', 'the root-way offers to send her in');
    await page.keyboard.press('KeyE');
    await until(page, () => __si.G.tun?.id === 'root' && !document.getElementById('tunnel').hidden, 'E sends Fray into the tunnel and the panel opens');
    await until(page, () => document.getElementById('tunnel-say').textContent.length > 5, 'she says something');
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']) { const n = await Q(page, () => __si.seen.tunStep || 0); await page.keyboard.press(k); await until(page, (m) => (__si.seen.tunStep || 0) > m, `↑ moves her (${k})`, 30000, n); }
    const bumps = await Q(page, () => __si.seen.tunBump || 0);
    await page.keyboard.press('ArrowUp');
    await until(page, (m) => (__si.seen.tunBump || 0) > m, 'a wall stops her and she says so', 30000, bumps);
    const steps = await Q(page, () => __si.seen.tunStep || 0);
    await page.keyboard.press('ArrowRight');
    await until(page, (m) => (__si.seen.tunStep || 0) > m && /lever/.test(document.getElementById('tunnel-say').textContent), '→ reaches the lever and she describes it', 30000, steps);
    await shot(page, 'desktop-tunnel');
    await page.keyboard.press('Space');
    await until(page, () => __si.G.flags.rootDoor, 'Space pulls it: the Rootshrine door opens');
    await until(page, () => __si.audio.level() > 0.01, 'her voice (or the door) is making sound', 20000);
    await page.keyboard.press('Escape');
    await until(page, () => !__si.G.tun && document.getElementById('tunnel').hidden, 'Escape calls her back');

    // save, quit, continue
    const where = await Q(page, () => ({ lore: __si.G.lore.length, door: __si.G.flags.rootDoor }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __si.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Return to Title shows Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (w) => __si.mode === 'play' && __si.G.lore.length === w.lore && __si.G.flags.rootDoor === w.door && __si.G.fray.state === 'follow', 'Continue restores the journey', 30000, where);

    // the bot plays the rest in the page
    await story(page, 'done');
    await until(page, () => __si.G.done && __si.G.gems.length === 7, 'the bot finishes the story in the page: seven gems', 60000);
    check(await Q(page, () => __si.seen.gem === 7 && __si.seen.travel >= 10 && document.querySelectorAll('#pendant i.on').length === 7), 'every gem lit the pendant on the way');
    await until(page, () => !document.getElementById('card').hidden, 'the last cards are up');
    await shot(page, 'desktop-ending');
    await Q(page, () => __si.skipCards());
    const pz = await Q(page, () => __si.G.player.x + __si.G.player.z);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ArrowLeft');
    await until(page, (v) => Math.abs(__si.G.player.x + __si.G.player.z - v) > 0.5, 'and you can walk on afterwards', 30000, pz);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowLeft');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.getAnimations?.().forEach((a) => a.finish()); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __si.mode === 'play', 'a tap on New Journey starts');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    check(await Q(page, () => { const b = document.getElementById('card-box').getBoundingClientRect(), n = document.getElementById('card-next').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && n.height >= 44 && b.top >= 40; }), 'the story card fits the screen, clear of the back link');
    await shot(page, `phone-${w}x${h}-card`);
    await tapSel('#card-next');
    await until(page, () => __si.G.cards.length === 1, 'a tap on Continue closes a card');
    await until(page, () => document.getElementById('card-head').textContent === 'The Letter', 'the next card is shown');
    await tapSel('#card-next');
    await until(page, () => __si.G.cards.length === 0 && document.getElementById('card').hidden, 'and another tap closes that one');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-a', '#btn-pause', '#btn-journal', '#btn-hint'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const a = document.getElementById('back-link').getBoundingClientRect(), b = document.getElementById('hud-top').getBoundingClientRect(); return b.left >= a.right - 1 || b.top >= a.bottom - 1; }), 'the HUD row does not sit under the back link');

    // walk with the stick, look with the right thumb
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.6 }; });
    const z0 = await Q(page, () => __si.G.player.z);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 10);
    await until(page, (z) => __si.G.player.z < z - 1, 'pushing the stick up walks forward', 30000, z0);
    await touch('touchEnd', 0, 0);
    const yaw0 = await Q(page, () => __si.G.player.yaw);
    const lz = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.3 }; });
    await touch('touchStart', lz.x, lz.y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', lz.x + i * 14, lz.y);
    await touch('touchEnd', 0, 0);
    await until(page, (y) => __si.G.player.yaw > y + 0.2, 'dragging on the right turns to look', 30000, yaw0);

    // use something, then guide Fray with the panel's buttons
    await Q(page, () => __si.goto('cairn'));
    await until(page, () => document.getElementById('btn-a').classList.contains('ready'), '✋ lights up beside the cairn');
    await tapSel('#btn-a');
    await until(page, () => __si.G.lore.includes('cairn'), 'tapping ✋ reads it');
    await tapSel('#card-next');
    await until(page, () => __si.G.cards.length === 0, 'tapping Continue closes the inscription');
    await Q(page, () => { const g = __si.G; g.flags.met = g.flags.healed = true; g.fray.state = 'follow'; __si.goto('rootTunnel'); });
    await until(page, () => __si.G.prompt?.id === 'rootTunnel', 'the root-way prompt shows');
    await tapSel('#btn-a');
    await until(page, () => __si.G.tun?.id === 'root' && !document.getElementById('tunnel').hidden, 'tapping ✋ sends Fray in');
    check(await Q(page, () => { const b = document.getElementById('tunnel-box').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.top >= 0 && [...document.querySelectorAll('#dpad button, #tun-back')].every((e) => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight + 1; }); }), 'the tunnel panel and its buttons fit, each at least 44 px');
    const s0 = await Q(page, () => __si.seen.tunStep || 0);
    await tapSel('#dpad [data-d="n"]');
    await until(page, (n) => (__si.seen.tunStep || 0) > n, 'tapping ▲ moves her', 30000, s0);
    await shot(page, `phone-${w}x${h}-tunnel`);
    await tapSel('#tun-back');
    await until(page, () => !__si.G.tun, 'tapping Call her back brings her out');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Walk on closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __si.mode === 'play', 'boots and starts a journey with localStorage throwing');
    await Q(page, () => { __si.skipCards(); __si.ff(20); });
    check(await Q(page, () => __si.save() === false && __si.G.t > 10), 'plays on; saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
