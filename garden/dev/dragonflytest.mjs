/**
 * dragonflytest.mjs — the dragonfly companion (companion.js, dragonfly.js,
 * dragonfly-ui.js, dragonfly-talk.js), in Node and in real Chromium.
 *
 * Node: the talk module on its own: news from js/updates.json (new since your
 * last visit, the newest game, updates), greetings that count visits, names
 * cleaned, every place's words, looks and unlocks.
 *
 * Browser, fresh storage: it waits on the lamp at the end of the dock, flies
 * over when you arrive and opens the meeting; you name it and it joins (HUD
 * portrait, name). It finds the Hub and a genre path with you and says so; it
 * flies ahead to a landmark; it counts a statue you stand at; the Travel tab
 * lists only where you have been and flies you back to the dock, to a game's
 * statue, into the Hut and down to the Violet Line, and it follows you into
 * each of those scenes. Snacks, a trick, a new look and a rename; Catch me!
 * by clicking it; the panel by K. Reload as a returning visitor 2 hours later:
 * the visit is counted, it greets you by number and its hunger has grown.
 * "Not now" sends it back to the lamp. ?dragonfly=0 builds nothing. A phone
 * (touch only): the HUD button is at least 44 px and clear of the top bar,
 * and the panel fits the screen. No console errors throughout.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/dragonflytest.mjs
 *
 * Env: BASE, THREE_PKG, PW_CHROMIUM_PATH (see browsertest.mjs), SHOTS=1 for screenshots.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../js/dragonfly-talk.js';
import games from '../../js/gamedata.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
const SHOTS = !!process.env.SHOTS;
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
    console.log('  ok  ' + msg);
};

// ------------------------------------------------------------------ node: the words
console.log('talk');
{
    const upd = JSON.parse(fs.readFileSync(path.join(HERE, '../../js/updates.json'), 'utf8')).games;
    const ids = Object.keys(upd).filter((id) => games.some((g) => g.id === id));
    const last = Math.max(...ids.map((id) => Date.parse(upd[id].added)));
    const now = last + 3 * 36e5;
    const news = T.buildNews(games, upd, now, last - 1);
    check(news[0].kind === 'since' && /new game/.test(news[0].text), `news starts with what is new since your last visit: "${news[0].text}"`);
    const newest = news.find((n) => n.kind === 'newest');
    check(newest && newest.game && newest.text.includes(newest.game.title) && /3 hours ago/.test(newest.text), `the newest game is named, with when: "${newest?.text}"`);
    check(news.some((n) => n.kind === 'update'), 'recent updates are in the news');
    check(news.at(-1).kind === 'count' && news.at(-1).text.includes(String(games.length)), 'and the count of games');
    const noUpd = T.buildNews(games, null, now);
    check(noUpd.length === 2 && noUpd[0].game.id === [...games].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0].id, 'without updates.json it still knows the newest game (by id)');
    const g = T.greeting('Pip', { visits: 7, prevSeen: now - 3 * 864e5 }, now, { night: 0.9 });
    check(/7th visit/.test(g) && /3 days ago/.test(g) && /lamps are lit/.test(g), `the greeting counts visits and days: "${g}"`);
    check(/ages/.test(T.greeting('Pip', { visits: 2, prevSeen: now - 60 * 864e5 }, now)), 'a long absence is noticed');
    check(T.cleanName('  <Glim\u0007mer>   the  Bold and Very Shiny ') === 'Glimmer the Bold a', 'names lose markup and control characters, and are cut to 18');
    check(T.cleanName('   ') === '', 'a blank name is empty');
    check(T.PLACES.every((p) => p.about && p.name && p.icon && (p.zone || p.landmark || p.room)), 'every place has its words and a way to find it');
    check(T.PLACES.filter((p) => p.id !== 'dock').every((p) => p.hint), 'every place but the dock has a hint');
    check(new Set(T.PLACES.map((p) => p.id)).size === T.PLACES.length, 'place ids are unique');
    check(T.placeForRoom('mine').id === 'cove' && T.placeForZone('ship').id === 'wharf' && T.placeForZone('The Great Tree').id === 'tree', 'rooms, areas and landmarks map to places');
    const mem = { games: {}, places: {}, visits: 1 };
    check(T.ACCESSORIES.filter((a) => a.unlock && a.unlock(mem)).length === 0, 'the special accessories start locked');
    check(T.ACCESSORIES.find((a) => a.id === 'lantern').unlock({ ...mem, visits: 3 }), 'the lantern unlocks on the third visit');
    const d = T.decay(0.8, 0.9, 6);
    check(d.full === 0 && d.joy > 0.5, 'six hours away empties its tummy, and it is still fond of you');
    check(T.moodOf(0.1, 0.9).word === 'Hungry' && T.moodOf(0.6, 0.9).word === 'Overjoyed', 'moods');
}

// ------------------------------------------------------------------ the browser
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function open({ viewport = { width: 960, height: 600 }, touch = false, url = '', storage = null } = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((seed) => {
        try {
            if (sessionStorage.getItem('df-seeded')) return;
            sessionStorage.setItem('df-seeded', '1');
            localStorage.clear();
            if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        } catch {
            /* ignore */
        }
    }, storage);
    if (fs.existsSync(PKG)) {
        await ctx.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
    await page.goto(`${BASE}/index.html?debug&enter&bigdt&pr=0.4&t=0.4&w=clear&fox=0${url}`);
    const G = (expr) => page.evaluate(`(() => { const g = window.__garden, c = g?.companion; return ${expr}; })()`);
    const until = (expr, timeout = 300000) => page.waitForFunction(`(() => { const g = window.__garden, c = g?.companion; return ${expr}; })()`, null, { timeout, polling: 100 }).catch(async (e) => {
        const st = await page.evaluate(() => { const c = window.__garden?.companion; return c && JSON.stringify({ mode: c.mode, active: c.active, activeFor: c.activeFor, met: c.met, here: c.here }); }).catch(() => '');
        throw new Error(`timed out waiting for ${expr} (${st})` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''), { cause: e });
    });
    const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const shot = async (name) => {
        if (!SHOTS) return;
        await frames(3);
        await page.screenshot({ path: path.join(OUT, `dragonfly-${name}.png`), timeout: 180000 });
    };
    await until('g?.entered', 900000);
    // hold the clock still: with ?bigdt a day goes by in minutes
    await G('g.sky.paused = true');
    // DOM buttons are pressed from inside the page: under software GL a frame can take long enough for
    // Playwright's own click to time out waiting on it (the 3D dragonfly gets real mouse clicks)
    page.btn = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    page.setVal = (sel, v) => page.evaluate(([s, v]) => (document.querySelector(s).value = v), [sel, v]);
    return { ctx, page, G, until, frames, shot };
}

try {
    // -------------------------------------------------------------- first meeting
    console.log('meeting');
    let { ctx, page, G, until, frames, shot } = await open();
    check(await G("c.mode === 'perch' || c.mode === 'approach' || c.mode === 'meeting'"), 'a dragonfly is on the dock when you arrive');
    const perch = await G('({ x: c.perch.x, y: c.perch.y, z: c.perch.z, dock: g.layout.dock.end, deck: g.layout.dock.y })');
    check(Math.abs(perch.z - (perch.dock - 0.6)) < 0.5 && perch.y > perch.deck + 2.5, `it perches on the lamp at the end of the dock (y ${perch.y.toFixed(2)})`);
    check(await G('document.getElementById("df-hud").hidden'), 'no companion HUD before you have met');
    await until("c.mode === 'meeting' && !document.getElementById('df-meet').hidden", 120000);
    check(await G('c.df.pos.distanceTo(g.camera.position) < 2.5'), 'it flies over to you and the meeting opens');
    check(await G("/Hello/.test(document.getElementById('df-meet-text').textContent) && document.querySelectorAll('#df-meet-ideas .chip').length === 4"), 'it introduces itself and offers four name ideas');
    await shot('1-meeting');
    // "Not now" first: back to the lamp
    await page.btn('#df-meet-later');
    check(await G("c.mode === 'return' && document.getElementById('df-meet').hidden && !c.met"), '"Not now" sends it back to the lamp');
    await until("c.mode === 'perch'", 60000);
    check(true, 'and it settles on the lamp');
    // clicking it brings it back
    await frames(4);
    const sp = await G('(() => { const s = c.df.screen(g.camera, innerWidth, innerHeight); return s && { x: s.x, y: s.y }; })()');
    if (sp) {
        await page.mouse.click(sp.x, sp.y);
    } else {
        // the lamp is behind you: turn round to face it
        await G("(() => { const p = g.controls.pos; g.controls.yaw = Math.atan2(-(c.perch.x - p.x), -(c.perch.z - p.z)); g.controls.pitch = 0.5; })()");
        await frames(4);
        const s2 = await G('(() => { const s = c.df.screen(g.camera, innerWidth, innerHeight); return s && { x: s.x, y: s.y }; })()');
        check(!!s2, 'the dragonfly on its lamp is on screen');
        await page.mouse.click(s2.x, s2.y);
    }
    await until("c.mode === 'meeting'", 60000);
    check(true, 'clicking it on its lamp brings it back to meet you');
    await page.setVal('#df-meet-name', 'Glimmer');
    await page.btn('#df-meet-go');
    check(await G("c.met && c.name === 'Glimmer' && c.mode === 'follow'"), 'naming it: it joins you');
    await until("!document.getElementById('df-hud').hidden", 10000);
    check(await G("document.getElementById('df-name').textContent === 'Glimmer' && c.log.some((l) => /Glimmer! What a lovely name/.test(l.text))"), 'its portrait and name are in the corner, and it says hello');
    check(await G("JSON.parse(localStorage.getItem('garden.companion')).name === 'Glimmer' && !!JSON.parse(localStorage.getItem('garden.companion')).places.dock"), 'it remembers its name, and the dock');
    await shot('2-joined');

    // -------------------------------------------------------------- following and finding
    console.log('finding');
    await G('g.controls.teleport(0, 11, 0)');
    await until("!!c.mem.places.hub", 30000);
    check(await G("c.df.group.parent === g.scene && c.df.pos.distanceTo(g.camera.position) < 4"), 'it keeps up with you (to the Hub) and finds it');
    // a genre path
    const path0 = await G('(() => { const sp = g.layout.spokes[0]; const { x, z } = sp.pts[Math.floor(sp.pts.length / 2)]; return { x, z, id: sp.genre.id, name: sp.genre.name }; })()');
    await G(`(c.view.hush(), g.controls.teleport(${path0.x}, ${path0.z}, 0))`);
    await until(`!!c.mem.places['path:${path0.id}']`, 30000);
    await until(`c.log.some((l) => l.text.includes(${JSON.stringify(path0.name)}))`, 30000);
    check(true, `it tells you about ${path0.name}`);
    // a statue
    const st = await G('(() => { const s = g.statues[3]; return { x: s.pathX + (s.x - s.pathX) * 0.45, z: s.pathZ + (s.z - s.pathZ) * 0.45, id: s.game.id }; })()');
    await G(`g.controls.teleport(${st.x}, ${st.z}, 0)`);
    await until(`c.mem.games['${st.id}'] >= 1`, 30000);
    check(true, 'standing at a statue counts a visit to its game');
    // a landmark ahead: it flies over to it
    const lm = await G(`(() => { const L = g.world.landmarks.find((l) => l.name === 'The Moon Fountain'); return { x: L.x, z: L.z }; })()`);
    await G(`(() => { c.lastScout = -1e9; c.mode = 'follow'; c.df.trick = null; const p = g.controls; const dx = ${lm.x}, dz = ${lm.z}; const d = Math.hypot(dx, dz); p.teleport(dx * (1 - 24 / d), dz * (1 - 24 / d), Math.atan2(dx, dz) + Math.PI); })()`);
    await until("c.mode === 'scout' || !!c.mem.places.fountain", 30000);
    check(await G('!!c.mem.places.fountain'), 'coming toward the Moon Fountain, it flies ahead to show you');
    await frames(6);
    check(await G(`Math.hypot(c.df.pos.x - ${lm.x}, c.df.pos.z - ${lm.z}) < Math.hypot(g.controls.pos.x - ${lm.x}, g.controls.pos.z - ${lm.z})`), 'and it is out ahead of you, nearer the fountain');
    await shot('3-scout');
    await until("c.mode === 'follow'", 30000);

    // -------------------------------------------------------------- the panel and travel
    console.log('travel');
    await G('c.view.hush()');
    await page.keyboard.press('k');
    check(await G("c.view.panelOpen && c.view.tab === 'talk'"), 'K opens its panel');
    await page.btn('[data-talk="news"]');
    check(await G("c.log.length >= 2 && document.querySelectorAll('#df-log .df-line').length >= 2"), 'asking for news answers in the panel');
    await page.btn('[data-talk="hint"]');
    check(await G("c.log.at(-1).text.length > 20"), 'and it gives a hint');
    await page.btn('[data-tab="travel"]');
    const listed = await G("[...document.querySelectorAll('[data-go]')].map((b) => b.dataset.go)");
    check(listed.includes('place:dock') && listed.includes('place:hub') && listed.includes(`game:${st.id}`) && !listed.includes('place:hut'), `Travel lists only where you have been (${listed.length} places)`);
    await shot('4-travel');
    await page.btn('[data-go="place:dock"]');
    await until("Math.hypot(g.controls.pos.x - g.layout.spawn.x, g.controls.pos.z - g.layout.spawn.z) < 0.5", 20000);
    check(await G('!c.view.panelOpen'), 'it flies you back to the dock');
    await frames(10);
    // beside you, or already off showing you something new near the dock
    check(await G("c.df.pos.distanceTo(g.camera.position) < (c.mode === 'scout' ? 40 : 4)"), 'and comes with you');
    await until('c.info.canTravel', 30000);
    await G('c.travel("game:" + ' + JSON.stringify(st.id) + ')');
    await until(`Math.hypot(g.controls.pos.x - ${st.x}, g.controls.pos.z - ${st.z}) < 8`, 20000);
    check(true, 'and to the statue of a game you visited');
    // into the Hut once, then back by dragonfly
    await G('g.throughDoor(true, "hut")');
    await until("g.roomKind === 'hut'", 60000);
    await until('!!c.mem.places.hut', 20000);
    await frames(6);
    check(await G('c.df.group.parent === g.hut.scene && c.df.group.visible'), 'it follows you into the Hut, and finds it');
    await shot('5-hut');
    await until('c.info.canTravel', 30000);
    await G('c.travel("place:hub")');
    await until('!g.below && Math.hypot(g.controls.pos.x, g.controls.pos.z) < 14', 20000);
    check(await G('c.df.group.parent === g.scene'), 'from the Hut it flies you to the Hub, and is back outside with you');
    await until('c.info.canTravel', 30000);
    await G('c.travel("place:hut")');
    await until("g.roomKind === 'hut'", 30000);
    check(true, 'and back into the Hut');
    // the Violet Line from wherever you are, once found
    await until('c.info.canTravel', 30000);   // the Hut's door has finished fading
    await G('g.startSubway()');
    await until("g.roomKind === 'subway'", 120000);
    await until('!!c.mem.places.subway', 20000);
    check(await G('c.df.group.parent === g.subway.scene'), 'it rides the Violet Line with you');
    await until('c.info.canTravel', 30000);
    await G('c.travel("place:hub")');
    await until('!g.below', 20000);
    await until('c.info.canTravel', 30000);
    await G('c.travel("place:subway")');
    await until("g.roomKind === 'subway'", 30000);
    check(true, 'and it can fly you straight down to the underground railway');
    await until('c.info.canTravel', 30000);
    await G('c.travel("place:dock")');
    await until('!g.below', 20000);

    // -------------------------------------------------------------- care, looks, play
    console.log('care');
    await G(`(c.mem.full = 0.3, c.view.openPanel("care"))`);
    await page.btn('[data-snack="honey"]');
    check(await G('c.mem.full > 0.45 && c.mem.fed.honey === 1 && c.df.wiggle > 0'), 'a honey bead: fuller, and a happy wiggle');
    await G('c.view.hush()');
    await page.btn('[data-play="loop"]');
    check(await G("c.df.trick?.kind === 'loop'"), 'loop the loop');
    await until('!c.df.trick', 20000);
    await G('c.view.openPanel("look")');
    await page.btn('[data-body="ruby"]');
    await page.btn('[data-wings="rainbow"]');
    await page.btn('[data-acc="tophat"]');
    check(await G("c.mem.look.body === 'ruby' && c.mem.look.wings === 'rainbow' && c.mem.look.acc === 'tophat' && c.df.accId === 'tophat' && c.df.wingMats[0].uniforms.uIri.value === 1"), 'a ruby body, rainbow wings and a top hat');
    check(await G("document.querySelector('#df-face .df-svg').dataset.acc === 'tophat' && document.getElementById('df-hud').style.getPropertyValue('--df-a') === '#ff4d63'"), 'and its portrait matches');
    check(await G('document.querySelector(\'[data-acc="crown"]\').disabled === Object.keys(c.mem.places).length < 8 && document.querySelector(\'[data-acc="lantern"]\').disabled'), 'the flower crown is earned by finding eight places, the lantern is still locked');
    await G('c.view.openPanel("care")');
    await page.setVal('#df-rename', 'Sir Glimmer');
    await page.btn('[data-rename]');
    check(await G("c.name === 'Sir Glimmer' && document.getElementById('df-name').textContent === 'Sir Glimmer'"), 'renamed');
    await shot('6-care');
    // Catch me!
    await page.btn('[data-play="catch"]');
    check(await G("c.mode === 'catch' && !c.view.panelOpen"), 'Catch me! starts');
    await G('c.catch.t = 1e4');   // plenty of time, whatever the frame rate
    let caught = 0;
    for (let i = 0; i < 40 && caught < 2; i++) {
        await frames(2);
        const s = await G('(() => { const s = c.df.screen(g.camera, innerWidth, innerHeight); return s && { x: s.x, y: s.y }; })()');
        if (!s) continue;
        await page.mouse.click(s.x, s.y);
        caught = await G('c.catch?.caught ?? 0');
    }
    check(caught >= 2, `clicking it catches it (${caught})`);
    await G('c.catch.t = 0');
    await until("c.mode === 'follow'", 10000);
    check(await G('c.mem.catchBest >= 2 && /caught me/i.test(document.getElementById("df-say").textContent)'), 'the score is kept');
    check(errors.length === 0, 'no errors so far');
    await ctx.close();

    // -------------------------------------------------------------- a returning visitor
    console.log('returning');
    const saved = { 'garden.companion': JSON.stringify({ v: 1, met: true, name: 'Pip', visits: 4, firstVisit: Date.now() - 9 * 864e5, lastSeen: Date.now() - 2 * 36e5, prevSeen: Date.now() - 3 * 864e5, metAt: Date.now() - 9 * 864e5, full: 0.9, joy: 0.8, moodAt: Date.now() - 2 * 36e5, places: { dock: 1, hub: 1 }, games: {}, fed: {}, look: { body: 'violet', wings: 'starry', acc: 'lantern' } }) };
    ({ ctx, page, G, until, frames, shot } = await open({ storage: saved }));
    check(await G('c.mem.visits === 5'), 'a visit after two hours away is counted (the fifth)');
    check(await G('c.mem.full < 0.65 && c.mem.full > 0.5'), 'and it has got hungrier while you were away');
    await until("c.mode === 'follow' && c.greeted", 60000);
    check(await G("c.log.some((l) => /5th visit/.test(l.text)) && !document.getElementById('df-hud').hidden"), 'it meets you on the dock and greets you by visit number');
    check(await G("c.df.accId === 'lantern' && c.mem.look.body === 'violet'"), 'in the look you left it in (the lantern is unlocked)');
    await shot('7-greeting');
    check(errors.length === 0, 'no errors as a returning visitor');
    await ctx.close();

    // -------------------------------------------------------------- left out
    ({ ctx, page, G } = await open({ url: '&dragonfly=0' }));
    check(await G('!c && !g.scene.getObjectByName("dragonfly") && document.getElementById("df-hud").hidden'), '?dragonfly=0 builds nothing');
    await ctx.close();

    // -------------------------------------------------------------- a phone
    console.log('phone');
    ({ ctx, page, G, until, frames, shot } = await open({ viewport: { width: 390, height: 844 }, touch: true, storage: saved }));
    await until("!document.getElementById('df-hud').hidden", 60000);
    const box = await page.locator('#df-face').boundingBox();
    const bar = await page.locator('#hud').boundingBox();
    check(box.width >= 44 && box.height >= 44, `the portrait button is ${box.width}px`);
    check(box.y > bar.y + bar.height && box.x + box.width <= 390, 'it sits in the lower corner, clear of the top bar');
    await page.locator('#df-face').tap({ timeout: 180000 });
    check(await G('c.view.panelOpen'), 'tapping it opens the panel');
    const pb = await page.locator('#df-panel').boundingBox();
    check(pb.x >= 0 && pb.x + pb.width <= 390 && pb.y >= 0 && pb.y + pb.height <= 844, 'the panel fits the phone');
    for (const tab of ['travel', 'care', 'look', 'memories']) await page.btn(`[data-tab="${tab}"]`);
    check(await G("c.view.tab === 'memories' && /visits/.test(document.getElementById('df-body').textContent)"), 'every tab opens; Memories counts your visits');
    await shot('8-phone');
    check(errors.length === 0, 'no errors on a phone');
    await ctx.close();
    console.log('\nall dragonfly checks passed');
} finally {
    await browser.close();
}
