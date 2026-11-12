/**
 * browsertest.mjs — HOLLOWDEEP in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title and the ← Games link; New Game by click; the narration subtitles; the town square,
 *   the guild (hire with a click), the shop (buy), the inn; the gate (enter B1F); real keys walk and turn (the
 *   view's camera follows); the minimap draws; the dungeon picture is not blank; a battle by real number keys
 *   (Attack → target, Defend…), monster sprites load and sit on screen, the round plays out; Escape opens the camp
 *   menu and closes it; the map; the stairs back to town; Save & Quit → Continue restores the game; ElevenLabs
 *   music, an effect and a voice line decode and sound reaches the master bus.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the town and the gate, the walking pad
 *   moves the party, a battle by taps (tap a command, tap a monster), controls ≥ 44 px and on screen, no sideways
 *   scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots, starts and walks.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8129          # from the REPO ROOT
 *   node game-129/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8129), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8129';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
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
        window.confirm = () => true;
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-129/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__hd && __hd.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
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
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const idle = (page) => page.waitForFunction(() => __hd.idle, null, { timeout: 30000, polling: 100 }).catch(() => {});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'the title is up, with no Continue before a save');
    check(await Q(page, () => getComputedStyle(document.querySelector('.title-art')).backgroundImage.includes('title.webp')), 'the title art is the fal key art');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hd.mode === 'game' && __hd.G.mode === 'town' && !document.getElementById('town').hidden, 'New Game opens on the town square');
    await until(page, () => !document.getElementById('dialogue').hidden && /Brindlemoor/.test(document.getElementById('dlg-line').textContent), 'the narrator\'s opening line is subtitled');
    check(await Q(page, () => document.querySelectorAll('#party .pc:not(.empty)').length === 3), 'three heroes stand in the party bar');

    // the guild: hire one with a click
    await click(page, '#town-body [data-act="guild"]');
    await until(page, () => document.getElementById('town-title').textContent.includes('Guild'), 'the Guild opens');
    check(await Q(page, () => document.getElementById('town-bg').style.backgroundImage.includes('guild.webp')), 'with its painted backdrop');
    const roster0 = await Q(page, () => __hd.G.roster.length);
    await click(page, '#town-body [data-act="hire"]:not([disabled])');
    await until(page, (n) => __hd.G.roster.length === n + 1 && __hd.G.party.length === 4, 'hiring a recruit adds them to the party', 10000, roster0);
    await click(page, '#town-body .menu .btn:last-child');
    // the shop: buy a potion
    await click(page, '#town-body [data-act="shop"]');
    const pots = await Q(page, () => __hd.G.inv.find((e) => e.id === 'potion')?.n || 0);
    await click(page, '#town-body [data-act="buy"][data-id="potion"]');
    await until(page, (n) => (__hd.G.inv.find((e) => e.id === 'potion')?.n || 0) === n + 1, 'buying at Odo\'s adds a potion', 10000, pots);
    await shot(page, 'desktop-shop');
    // take Ansel's quest at the gate, then enter
    await click(page, '#town-body .menu .btn:last-child');
    await click(page, '#town-body [data-act="gate"]');
    await until(page, () => document.getElementById('town-title').textContent.includes('Gate'), 'the Gate opens');
    await click(page, '#town-body [data-act="take"]');
    await until(page, () => __hd.G.quests.active.some((q) => q.id === 's_knight'), 'Old Ansel\'s quest can be accepted');
    await click(page, '#town-body [data-act="enter"]');
    await until(page, () => __hd.G.mode === 'dungeon' && __hd.G.floor === 1 && !document.getElementById('hud').hidden, 'the gate takes the party to B1F');
    await until(page, () => __hd.view.floorKey && !__hd.view.busy, 'the floor is built');
    check(await Q(page, () => document.getElementById('hud-depth').textContent === 'B1F'), 'the HUD shows B1F');

    // the picture is not blank
    await page.waitForTimeout(800);
    const px = await Q(page, () => __hd.view.sample());
    const mean = px.reduce((a, b) => a + b, 0) / px.length;
    const spread = Math.max(...px) - Math.min(...px);
    check(mean > 8 && spread > 20, `the dungeon picture is not blank (mean ${mean.toFixed(0)}, spread ${spread.toFixed(0)})`);
    check(await Q(page, () => { const c = document.getElementById('minimap').getContext('2d').getImageData(0, 0, 150, 150).data; let n = 0; for (let i = 0; i < c.length; i += 4) if (c[i] > 40) n++; return n > 100; }), 'the minimap draws the explored cells');

    // real keys: turn and walk
    await Q(page, () => { __hd.faceOpen(); });
    const p0 = await Q(page, () => ({ ...__hd.G.pos }));
    await page.keyboard.press('KeyD');
    await until(page, (d) => __hd.G.pos.d === (d + 1) % 4, 'D turns right', 10000, p0.d);
    await page.keyboard.press('KeyA');
    await until(page, (d) => __hd.G.pos.d === d && !__hd.view.busy, 'A turns back', 10000, p0.d);
    await page.keyboard.press('KeyW');
    await until(page, (p) => __hd.G.pos.x !== p.x || __hd.G.pos.y !== p.y || __hd.G.mode === 'battle', 'W steps forward', 10000, p0);
    await until(page, () => { const c = __hd.view.camera.position; const g = __hd.G.pos; return Math.abs(c.x - g.x * 2) < 0.2 && Math.abs(c.z - g.y * 2) < 0.2; }, 'the camera follows the party', 10000);
    await shot(page, 'desktop-dungeon');

    // a battle with real keys
    await idle(page);
    if (await Q(page, () => __hd.G.mode !== 'battle')) await Q(page, () => __hd.fight('random'));
    await until(page, () => !document.getElementById('battle').hidden && document.querySelectorAll('#foes .foe').length > 0, 'a battle shows the monsters');
    await until(page, () => [...document.querySelectorAll('#foes .foe img')].every((i) => i.complete && i.naturalWidth > 0), 'every monster sprite (fal art) loads', 20000);
    check(await Q(page, () => [...document.querySelectorAll('#foes .foe img')].every((i) => { const r = i.getBoundingClientRect(); return r.width > 30 && r.height > 30 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight; })), 'the sprites are on screen and a sensible size');
    await until(page, () => !document.getElementById('battle-menu').hidden, 'the command menu appears');
    await shot(page, 'desktop-battle');
    const round0 = await Q(page, () => __hd.G.battle.round);
    // give every hero a command with number keys: 1 (attack) then 1 (first foe), or 3 (defend)
    for (let i = 0; i < 4; i++) {
        if (await Q(page, (r) => !__hd.G.battle || __hd.G.battle.round !== r || __hd.G.battle.phase !== 'input', round0)) break;
        await page.waitForFunction(() => !document.getElementById('battle-menu').hidden && !__hd.battle.busy, null, { timeout: 15000 }).catch(() => {});
        if (i % 2 === 0) { await page.keyboard.press('Digit1'); await page.waitForTimeout(150); await page.keyboard.press('Digit1'); }
        else await page.keyboard.press('Digit3');
        await page.waitForTimeout(250);
    }
    await until(page, (r) => !__hd.G.battle || __hd.G.battle.round > r, 'number keys give every hero a command and the round resolves', 20000, round0);
    await until(page, () => (__hd.seen.hit || 0) + (__hd.seen.miss || 0) > 0, 'blows land (or miss)');
    // finish the fight with Auto (key 6)
    for (let i = 0; i < 40 && await Q(page, () => __hd.G.mode === 'battle'); i++) {
        await page.waitForFunction(() => __hd.G.mode !== 'battle' || (!document.getElementById('battle-menu').hidden && !__hd.battle.busy), null, { timeout: 20000 }).catch(() => {});
        if (await Q(page, () => __hd.G.mode === 'battle')) await page.keyboard.press('Digit6');
        await page.waitForTimeout(200);
    }
    await until(page, () => __hd.G.mode !== 'battle' && document.getElementById('battle').hidden, 'Auto finishes the fight and the battle screen closes', 40000);

    // sound: the music and a voice are ElevenLabs files that decode
    await until(page, () => Object.keys(__hd.audio.buffers).some((k) => k.startsWith('sfx-')) && Object.keys(__hd.audio.buffers).some((k) => k.startsWith('vo/')), 'effects and voice lines (ElevenLabs) decode', 20000);
    await until(page, () => { const t = __hd.audio.tracks[__hd.audio.current]; return t && !t.paused && t.readyState >= 2; }, 'a music track is playing', 20000);
    check(await Q(page, () => __hd.audio.failed.size === 0), 'no audio file failed to load');
    await until(page, () => { __hd.audio.fx('hit'); return __hd.audio.level() > 0.01; }, 'sound reaches the master bus', 10000);

    // camp and map with keys
    if (await Q(page, () => __hd.G.mode === 'dungeon')) {
        await page.keyboard.press('Escape');
        await until(page, () => !document.getElementById('camp').hidden, 'Escape opens the camp menu');
        await shot(page, 'desktop-camp');
        await page.keyboard.press('Escape');
        await until(page, () => document.getElementById('camp').hidden, 'and Escape closes it');
        await page.keyboard.press('KeyM');
        await until(page, () => !document.getElementById('mapview').hidden, 'M opens the map');
        await page.keyboard.press('KeyM');
        await until(page, () => document.getElementById('mapview').hidden, 'and closes it');
    }
    // teleport to the up stairs (the walking was tested above) and press Enter
    await Q(page, async () => { const m = await import('./js/sim/dungeon.js'); const f = m.getFloor(__hd.G.seed, __hd.G.floor); __hd.G.pos = { ...f.start }; __hd.hud.dungeon(__hd.G); });
    await until(page, () => !document.getElementById('hud-prompt').hidden, 'standing on the stairs shows the climb prompt');
    await page.keyboard.press('Enter');
    await until(page, () => __hd.G.mode === 'town' && !document.getElementById('town').hidden, 'Enter on the up stairs of B1F climbs back to town');

    // save, quit, continue
    const gold = await Q(page, () => __hd.G.gold);
    await click(page, '#town-body [data-act="camp"]');
    await until(page, () => !document.getElementById('camp').hidden, 'the camp opens from town');
    await click(page, '#camp-tabs [data-tab="system"]');
    await Q(page, () => [...document.querySelectorAll('#camp-body .btn')].find((b) => b.textContent.includes('Quit'))?.click());
    await until(page, () => __hd.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (g) => __hd.mode === 'game' && __hd.G.gold === g && __hd.G.quests.active.some((q) => q.id === 's_knight'), 'Continue restores the saved game', 20000, gold);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hd.G?.mode === 'town', 'a tap on New Game starts in town');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    await tapSel('#town-body [data-act="gate"]');
    await until(page, () => document.getElementById('town-title').textContent.includes('Gate'), 'a tap opens the Gate');
    await shot(page, `phone-${w}x${h}-town`);
    await tapSel('#town-body [data-act="enter"]');
    await until(page, () => __hd.G.mode === 'dungeon' && !document.getElementById('pad').hidden, 'a tap enters the dungeon and the walking pad appears');
    const sizes = await Q(page, () => [...document.querySelectorAll('#pad button, #btn-camp, #btn-map')].map((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    check(sizes.length >= 8 && sizes.every(Boolean), 'the pad and the HUD buttons are at least 44 px and on screen');
    await Q(page, () => { __hd.faceOpen(); __hd.G.danger = -5; });
    await page.waitForTimeout(300);
    const p0 = await Q(page, () => ({ ...__hd.G.pos }));
    await tapSel('#pad [data-move="f"]');
    await until(page, (p) => __hd.G.pos.x !== p.x || __hd.G.pos.y !== p.y, 'tapping ▲ steps forward', 15000, p0);
    await idle(page);
    const d0 = await Q(page, () => __hd.G.pos.d);
    await tapSel('#pad [data-turn="1"]');
    await until(page, (d) => __hd.G.pos.d === (d + 1) % 4, 'tapping ↻ turns right', 15000, d0);
    await shot(page, `phone-${w}x${h}-dungeon`);
    // a battle by taps
    await idle(page);
    await Q(page, () => __hd.fight('random'));
    await until(page, () => !document.getElementById('battle-menu').hidden, 'the battle menu appears');
    check(await Q(page, () => document.getElementById('pad').offsetParent === null || getComputedStyle(document.getElementById('pad')).display === 'none'), 'the walking pad hides during a battle');
    const bsz = await Q(page, () => [...document.querySelectorAll('#bm-list .btn')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1; }));
    check(bsz, 'the command buttons are at least 44 px tall and on screen');
    await shot(page, `phone-${w}x${h}-battle`);
    const round0 = await Q(page, () => __hd.G.battle.round);
    await tapSel('#bm-list .btn');                         // Attack
    await page.waitForTimeout(250);
    const foe = await Q(page, () => { const i = document.querySelector('#foes .foe:not(.dead) img'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(foe.x, foe.y);              // tap the monster
    await until(page, () => __hd.G.battle ? __hd.G.battle.cursor >= 1 || __hd.G.battle.round > 1 : true, 'tapping Attack then the monster commands the first hero', 15000);
    for (let i = 0; i < 30 && await Q(page, () => __hd.G.mode === 'battle'); i++) {
        await page.waitForFunction(() => __hd.G.mode !== 'battle' || (!document.getElementById('battle-menu').hidden && !__hd.battle.busy), null, { timeout: 20000 }).catch(() => {});
        if (await Q(page, () => __hd.G.mode === 'battle')) await tapSel('#bm-list [data-key="6"]');
        await page.waitForTimeout(200);
    }
    void round0;
    await until(page, () => __hd.G.mode !== 'battle' && document.getElementById('battle').hidden, 'tapping Auto finishes the fight', 40000);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hd.G?.mode === 'town', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __hd.send({ t: 'enter', floor: 1 }));
    await until(page, () => __hd.G.mode === 'dungeon', 'and enters the dungeon');
    check(await Q(page, () => __hd.saveNow() === false), 'saving fails quietly');
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
