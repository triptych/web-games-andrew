/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop: the character-creation wizard by clicking → the first-day page →
 * every page in the registry renders without errors → commentary (post, get a
 * reply) → forest fights by hotkey until out of turns (fights, events, auto-
 * fight) → master challenge and level-up → buying gear → bank → inn (drink,
 * flirt, bard, room, sleep → new day) → dying → the Pale Shore (torment, then
 * resurrection) → PvP → the Jade Wyrm and the Wyrm-kill reset → mail with a
 * reply → export, reload, log back in, import → 40 simulated days with sanity
 * checks on the world → classic pacing dawn.
 * Phones (390×844 and 844×390, touch only): quick start, every nav button on
 * screen and ≥ 40 px tall, taps work, the drawers open and close, no
 * horizontal overflow. Fails on any console error/warning, page error or
 * failed request. Screenshots → dev/shots/.
 *
 *   python3 -m http.server 8053                 # from the REPO ROOT
 *   node game-053/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served
 * from disk (still the genuine r165):
 *   cd game-053/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 *
 * Env: BASE (default http://127.0.0.1:8053), THREE_PKG, OUT, ONLY=desktop|phones, VERBOSE=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8053';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let passed = 0;
function ok(c, msg) { if (!c) { errors.push('assert: ' + msg); console.log('  ✗', msg); } else { passed++; if (process.env.VERBOSE) console.log('  ✓', msg); } }

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}, prefs = { quality: 'low' }) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true, ...extra });
    await ctx.addInitScript((pr) => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); localStorage.setItem('jadewyrm.prefs', JSON.stringify(pr)); sessionStorage.setItem('__c', '1'); } } catch { /* */ } }, prefs);
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 404, body: '' }));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
    page.on('requestfailed', (r) => { const u = r.url(); if (!u.includes('favicon') && !u.includes('fonts.')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-053/index.html?debug=1&seed=browsertest`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const pageId = (page) => ev(page, () => __jw.game.cur?.id);
const title = (page) => page.textContent('#page .page-head h1');
async function key(page, k) { await page.keyboard.press(k); await page.waitForTimeout(60); }
async function navText(page) { return page.$$eval('.navbtn', (bs) => bs.map((b) => b.textContent)); }

// ======================================================================
async function desktop() {
    console.log('desktop');
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    ok(await page.isVisible('#title-screen'), 'title screen shows');
    ok((await page.$$('.slot.empty')).length === 3, 'three empty slots');
    await shot(page, 'bt-title');

    // ---- creation wizard by clicking
    await page.click('.slot.empty');
    await page.fill('.big-input', 'X');
    await page.click('text=Next');
    ok(((await page.textContent('.err')) || '').length > 0, 'a one-letter name is rejected');
    await page.fill('.big-input', 'Brynhild Ash');
    await page.click('.cards .card:nth-child(2)'); // she/her
    ok(await page.$eval('.cards .card.sel', (e) => e.textContent.includes('She')), 'pronoun card selects');
    await page.click('text=Next');
    await page.click('.card:has-text("Dwarf")');
    await page.click('text=Next');
    await page.click('.card:has-text("Arcane Lore")');
    await page.click('text=Next');
    ok((await page.textContent('.summary')).includes('Brynhild Ash'), 'summary shows the name');
    await shot(page, 'bt-create');
    await page.click('text=Enter Hollowmere');
    await page.waitForTimeout(300);
    ok(await page.isVisible('#app'), 'the game opens');
    ok(await pageId(page) === 'newday', 'first page is the welcome/new-day page');
    ok((await title(page)).includes('Welcome'), 'welcome title');
    let p = await ev(page, () => ({ race: __jw.p.race, spec: __jw.p.spec, sex: __jw.p.sex, turns: __jw.p.turns, day: __jw.p.day, mail: __jw.p.mail.length }));
    ok(p.race === 'dwarf' && p.spec === 'arcane' && p.sex === 'f', 'choices stored');
    ok(p.turns === 10 && p.day === 1, `day 1 with 10 forest fights (got ${p.turns}, day ${p.day})`);
    ok(p.mail === 1, 'welcome letter from the admin');
    ok(await page.isVisible('.mail-badge:not(.hidden)'), 'unread mail badge');
    await key(page, 'e');
    ok(await pageId(page) === 'village', 'E enters the village');
    await page.waitForTimeout(1500);
    await shot(page, 'bt-village');

    // ---- every page renders
    const ids = await ev(page, () => Object.keys(__jw.PAGES));
    for (const id of ids) {
        if (['fight', 'event', 'dkwin', 'newday', 'shades', 'graveyard', 'mausoleum'].includes(id)) continue;
        const before = errors.length;
        await ev(page, (i) => __jw.game.goto(i), id);
        const t = await title(page);
        ok(t && t.length > 2, `page ${id} renders a title (${t})`);
        ok(errors.length === before, `page ${id} renders without errors`);
    }
    await ev(page, () => __jw.game.goto('village'));

    // ---- commentary
    const chatBefore = await ev(page, () => __jw.w.chat.village.length);
    ok(chatBefore >= 3, `square has recent chatter (${chatBefore})`);
    await page.fill('.chat-form input', 'hello everyone! `@how do i level up?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    ok(await page.$eval('.chat-log', (l) => l.textContent.includes('hello everyone')), 'my post appears in the commentary');
    ok(await page.$eval('.chat-log .mine .c2b', (e) => !!e), 'colour codes render in chat');
    await ev(page, () => { for (const q of __jw.game.queue) q.due = 0; __jw.game.tick(); });
    const after = await ev(page, () => __jw.w.chat.village.slice(-3).map((e) => e.who + ': ' + e.text));
    ok(after.some((l) => !l.startsWith('Brynhild')), `someone answers (${after.join(' | ')})`);
    ok(await ev(page, () => !!__jw.p.deeds.chat), 'deed: Social Butterfly');

    // ---- forest by hotkeys until out of turns
    await key(page, 'f');
    ok(await pageId(page) === 'village', 'hotkeys are ignored while typing in the chat box');
    await key(page, 'Escape');
    await key(page, 'f');
    ok(await pageId(page) === 'forest', 'F goes to the Gloamwood');
    let fights = 0, eventsSeen = 0, guard = 0;
    while (guard++ < 60) {
        const id = await pageId(page);
        const alive = await ev(page, () => __jw.p.alive);
        if (!alive) break;
        if (id === 'forest') {
            const turns = await ev(page, () => __jw.p.turns);
            if (turns <= 0) break;
            await ev(page, () => { __jw.p.hp = __jw.S.maxHp(__jw.p); });
            await key(page, 'l');
        } else if (id === 'fight') {
            fights++;
            if (fights === 1) { await page.waitForTimeout(900); await shot(page, 'bt-fight'); }
            await key(page, 'a');
            const over = await ev(page, () => __jw.p.fight?.over);
            ok(over === true || (await ev(page, () => __jw.p.hp < __jw.S.maxHp(__jw.p) * 0.25)), 'auto-fight ends the fight (or stops when hurt)');
            if (!over) await key(page, 'a');
            if (await ev(page, () => __jw.p.fight?.over && __jw.p.fight.result === 'win')) await key(page, 'f');
            else if (await ev(page, () => __jw.p.fight?.over)) { await ev(page, () => { __jw.p.fight = null; __jw.game.goto('forest'); }); }
            else await ev(page, () => { __jw.p.fight = null; __jw.game.goto('forest'); });
        } else if (id === 'event') {
            eventsSeen++;
            const btn = await page.$('.navbtn:not([disabled])');
            await btn.click();
            await page.waitForTimeout(60);
            if (await pageId(page) === 'event') await ev(page, () => { __jw.p.event = null; __jw.game.goto('forest'); });
        } else {
            await ev(page, () => __jw.game.goto('forest'));
        }
    }
    p = await ev(page, () => ({ kills: __jw.p.stats.kills, exp: __jw.p.exp, gold: __jw.p.gold, turns: __jw.p.turns }));
    ok(fights >= 5, `fought in the forest (${fights} fights, ${eventsSeen} events, ${p.kills} kills)`);
    ok(p.kills >= 3 && p.exp > 0, `gained XP (${p.exp}) from kills`);
    ok(p.turns === 0, 'spent every forest fight');
    ok(await ev(page, () => !!__jw.p.deeds.firstblood), 'deed: First Blood');
    await ev(page, () => __jw.game.goto('forest'));
    ok(await page.$eval('.navbtn:has-text("Look for something")', (b) => b.disabled), 'no searching when out of turns');

    // ---- every forest event renders and resolves
    const evIds = await ev(page, () => __jw.game.pages && Object.keys(__jw.PAGES) && (window.__evs = null, null));
    const eventList = await ev(page, async () => (await import('./js/pages/events.js')).EVENTS.map((e) => e.id));
    for (const id of eventList) {
        const before = errors.length;
        await ev(page, async (i) => { const m = await import('./js/pages/events.js'); __jw.p.gold = 5000; __jw.p.gems = 5; __jw.p.turns = 5; __jw.p.level = 12; m.EVENTS.find((e) => e.id === i).start(__jw.game); __jw.game.goto('event'); }, id);
        ok((await page.$$('.navbtn:not([disabled])')).length > 0, `event ${id} offers a choice`);
        await page.click('.navbtn:not([disabled])');
        await page.waitForTimeout(40);
        const now = await pageId(page);
        if (now === 'event') { // multi-step (old man): guess until done
            for (let i = 0; i < 8 && await pageId(page) === 'event'; i++) { const inp = await page.$('input[type=number]'); if (!inp) break; await inp.fill(String(10 + i * 11)); await page.click('.formrow .btn'); await page.waitForTimeout(30); }
        }
        ok(['forest', 'fight'].includes(await pageId(page)), `event ${id} resolves (${await pageId(page)})`);
        ok(errors.length === before, `event ${id} without errors`);
        await ev(page, () => { __jw.p.fight = null; __jw.p.event = null; __jw.p.level = 1; __jw.p.hp = __jw.S.maxHp(__jw.p); });
    }

    // ---- master
    await ev(page, () => { __jw.p.exp = 150; __jw.p.hp = __jw.S.maxHp(__jw.p); __jw.p.weapon = 6; __jw.p.armor = 6; __jw.game.goto('training'); });
    await key(page, 'q');
    ok((await page.textContent('.flash')).includes('ready'), 'master says you are ready');
    await key(page, 'c');
    ok(await pageId(page) === 'fight', 'challenge starts a fight');
    await key(page, 'a'); await key(page, 'a');
    p = await ev(page, () => ({ level: __jw.p.level, over: __jw.p.fight?.over, res: __jw.p.fight?.result }));
    ok(p.over && p.res === 'win' && p.level === 2, `beat the master → level 2 (level ${p.level}, ${p.res})`);
    ok(await ev(page, () => __jw.w.news.some((n) => n.text.includes('Brynhild') && n.text.includes('level'))), 'level-up is in the Herald');
    await key(page, 'b');
    ok(await pageId(page) === 'training', 'back to the yard');

    // ---- shops
    await ev(page, () => { __jw.p.weapon = 0; __jw.p.armor = 0; __jw.p.gold = 2000; __jw.game.goto('weapons'); });
    await page.click('table.shop tr:nth-child(3) button');
    p = await ev(page, () => ({ w: __jw.p.weapon, g: __jw.p.gold }));
    ok(p.w === 3 && p.g === 2000 - 585, `bought weapon 3 (${p.w}, gold ${p.g})`);
    await ev(page, () => __jw.game.goto('weapons'));
    await page.click('table.shop tr:nth-child(1) button');
    p = await ev(page, () => ({ w: __jw.p.weapon, g: __jw.p.gold }));
    ok(p.w === 1 && p.g === 2000 - 585 - 48 + Math.round(585 * 0.75), `trade-in works (${p.g})`);
    await ev(page, () => __jw.game.goto('armor'));
    await page.click('table.shop tr:nth-child(2) button');
    ok(await ev(page, () => __jw.p.armor === 2), 'bought armour 2');

    // ---- bank
    await ev(page, () => { __jw.p.gold = 1000; __jw.p.bank = 0; __jw.game.goto('bank'); });
    await page.fill('.formrow input[type=number]', '600');
    await page.click('.formrow .btn:has-text("Deposit")');
    p = await ev(page, () => ({ g: __jw.p.gold, b: __jw.p.bank }));
    ok(p.g === 400 && p.b === 600, `deposit 600 (${p.g}/${p.b})`);
    await page.click('.formrow .btn:has-text("Withdraw all")');
    ok(await ev(page, () => __jw.p.gold === 1000 && __jw.p.bank === 0), 'withdraw all');

    // ---- inn
    await ev(page, () => { __jw.p.gold = 1000; __jw.p.drunk = 0; __jw.p.buffs = []; __jw.p.flags = {}; __jw.game.goto('inn'); });
    await key(page, 'b');
    ok(await pageId(page) === 'bar', 'B: bar');
    await page.click('.navbtn:has-text("Antler Ale")');
    ok(await ev(page, () => __jw.p.drunk === 1 && __jw.p.buffs.some((b) => b.id === 'ale')), 'ale: drunk + buff');
    await key(page, 'g');
    ok((await page.textContent('.flash')).length > 20, 'gossip');
    await ev(page, () => __jw.game.goto('flirt', 'willa'));
    await page.click('.navbtn:has-text("Wink")');
    ok(await ev(page, () => __jw.p.flags.flirt === true), 'flirted');
    ok(await page.$eval('.navbtn:has-text("Wink")', (b) => b.disabled), 'one flirt a day');
    await ev(page, () => __jw.game.goto('bard'));
    ok(await ev(page, () => __jw.p.flags.bard), 'heard the bard');
    // marriage path
    await ev(page, () => { __jw.p.charm = 40; __jw.p.flirt = 6; __jw.p.flags.flirt = false; __jw.R.seed(3); __jw.game.goto('flirt', 'corwin'); });
    for (let i = 0; i < 12 && !(await ev(page, () => __jw.p.spouse)); i++) { await ev(page, () => { __jw.p.flags.flirt = false; __jw.game.refresh(); }); await page.click('.navbtn:has-text("Propose")'); }
    ok(await ev(page, () => __jw.p.spouse === 'corwin'), 'married Corwin');
    // room → sleep → new day
    const dayBefore = await ev(page, () => __jw.p.day);
    await ev(page, () => { __jw.p.gold = 500; __jw.game.goto('room'); });
    await key(page, 's');
    ok(await pageId(page) === 'newday', 'sleeping at the inn starts a new day');
    p = await ev(page, () => ({ day: __jw.p.day, turns: __jw.p.turns, drunk: __jw.p.drunk, wday: __jw.w.day, spouseBuff: __jw.p.buffs.some((b) => b.id === 'spouse') }));
    ok(p.day === dayBefore + 1 && p.wday === p.day, `day advanced (${p.day}, world ${p.wday})`);
    ok(p.turns >= 8 && p.drunk === 0, `turns reset (${p.turns}), sober again`);
    ok(p.spouseBuff, 'spouse buff at dawn');
    await shot(page, 'bt-newday');

    // ---- death and the Pale Shore
    await ev(page, () => { __jw.p.gold = 321; __jw.p.hp = 1; __jw.p.turns = 3; __jw.p.buffs = []; __jw.game.goto('forest'); });
    await ev(page, () => { const { startFight } = __jw; });
    await ev(page, async () => {
        const c = await import('./js/engine/combat.js');
        c.startFight(__jw.p, 'forest', { name: 'Test Ogre', weapon: 'a big club', kind: 'brute', color: 0x888866, level: 9, maxhp: 999, atk: 400, def: 400, gold: 1, exp: 1, death: 'x' }, { mod: 0 });
        __jw.scene?.showFoe(__jw.p.fight.foe);
        __jw.game.goto('fight');
    });
    await key(page, 'a');
    p = await ev(page, () => ({ alive: __jw.p.alive, gold: __jw.p.gold, res: __jw.p.fight?.result }));
    ok(!p.alive && p.gold === 0 && p.res === 'lose', 'died and lost the gold on hand');
    ok(await ev(page, () => __jw.w.news.some((n) => n.text.includes('Test Ogre'))), 'death in the Herald');
    await key(page, 'c');
    ok(await pageId(page) === 'shades', 'continue → the Pale Shore');
    await page.waitForTimeout(800);
    await shot(page, 'bt-shades');
    await ev(page, () => __jw.game.goto('village'));
    ok(await pageId(page) === 'shades', 'the dead cannot visit the village');
    await key(page, 't');
    ok(await pageId(page) === 'graveyard', 'T: Barrow Field');
    await key(page, 't');
    ok(await pageId(page) === 'fight', 'torment a soul');
    await key(page, 'a'); await key(page, 'a');
    p = await ev(page, () => ({ favor: __jw.p.favor, hp: __jw.p.hp, alive: __jw.p.alive, res: __jw.p.fight?.result }));
    ok(!p.alive && p.hp === 0, `still dead after tormenting (${p.res}, favour ${p.favor})`);
    await ev(page, () => { __jw.p.fight = null; __jw.p.favor = 120; __jw.game.goto('mausoleum'); });
    await key(page, 'a');
    p = await ev(page, () => ({ alive: __jw.p.alive, favor: __jw.p.favor, id: __jw.game.cur.id }));
    ok(p.alive && p.favor === 20 && p.id === 'village', 'Vorgath resurrects for 100 favour');

    // ---- PvP
    await ev(page, () => { const n = __jw.w.npcs.find((x) => x.dk === 0); __jw.w.npcs.splice(__jw.w.npcs.indexOf(n), 1); __jw.w.npcs.unshift(n); n.weapon = 0; n.armor = 0; n.alive = true; n.sleep = 'fields'; n.level = __jw.p.level; n.gold = 777; __jw.game.online = __jw.game.online.filter((x) => x !== n); __jw.p.pvp = 3; __jw.p.hp = __jw.S.maxHp(__jw.p); __jw.p.weapon = 15; __jw.p.armor = 15; __jw.game.goto('pvp'); });
    const target = await ev(page, () => __jw.w.npcs[0].name);
    ok((await page.textContent('#page')).includes(target), 'a sleeping warrior is listed as a target');
    await page.click(`tr:has-text("${target}") button:has-text("Attack")`);
    ok(await pageId(page) === 'fight', 'attack starts a fight');
    await key(page, 'a'); await key(page, 'a');
    p = await ev(page, (nm) => ({ res: __jw.p.fight?.result, wins: __jw.p.stats.pvpWins, npcAlive: __jw.w.npcs[0].alive }), target);
    ok(p.res === 'win' && p.wins === 1 && !p.npcAlive, `won the PvP fight (${p.res})`);
    ok(await ev(page, () => __jw.p.pvp === 2), 'used a PvP attack');
    await key(page, 'r');

    // ---- the Jade Wyrm
    await ev(page, () => { const p = __jw.p; p.level = 15; p.exp = 99999; p.weapon = 15; p.armor = 15; p.dkBonus.atk = 60; p.dkBonus.def = 60; p.dkBonus.hp = 60; p.hp = __jw.S.maxHp(p); p.turns = 2; __jw.game.goto('forest'); });
    ok((await navText(page)).some((t) => t.includes('Jade Wyrm')), 'level 15: seek the Wyrm');
    await key(page, 'g');
    ok(await pageId(page) === 'wyrm', 'G: the lair');
    await key(page, 'e');
    await page.waitForTimeout(1200);
    await shot(page, 'bt-wyrm');
    for (let i = 0; i < 6 && !(await ev(page, () => __jw.p.fight?.over)); i++) await key(page, 'a');
    p = await ev(page, () => ({ res: __jw.p.fight?.result }));
    ok(p.res === 'win', `slew the Wyrm (${p.res})`);
    await key(page, 'c');
    ok(await pageId(page) === 'dkwin', 'victory page');
    await key(page, 't');
    p = await ev(page, () => ({ dk: __jw.p.dk, level: __jw.p.level, w: __jw.p.weapon, bt: __jw.p.dkBonus.turns, title: __jw.S.title(__jw.p), id: __jw.game.cur.id, spouse: __jw.p.spouse }));
    ok(p.dk === 1 && p.level === 1 && p.w === 0 && p.bt === 1, `Wyrm kill reset (dk ${p.dk}, level ${p.level}, +turns ${p.bt})`);
    ok(p.title === 'Page', `new title (${p.title})`);
    ok(p.spouse === 'corwin', 'still married');
    ok(await ev(page, () => !!__jw.p.deeds.dk1), 'deed: Wyrmslayer');
    ok(await ev(page, () => __jw.w.news.some((n) => n.text.includes('slain the Jade Wyrm') && n.text.includes('Brynhild'))), 'Wyrm kill in the Herald');
    await ev(page, () => { for (const q of __jw.game.queue) q.due = 0; __jw.game.tick(); });
    ok(await ev(page, () => __jw.w.chat.village.slice(-6).some((e) => /brynhild/i.test(e.text))), 'the square reacts to the Wyrm kill');
    await ev(page, () => __jw.game.goto('stone'));
    ok((await title(page)).includes('Standing Stone') && (await page.$$('.chat')).length === 1, 'the Standing Stone opens for a Wyrmslayer');

    // ---- mail
    await ev(page, () => __jw.game.goto('mail', { compose: __jw.w.npcs.find((n) => n.pers !== 'lurker').id }));
    await page.fill('.compose input[type=text]', 'Hello there');
    await page.fill('.compose textarea', 'Fancy a hunt tomorrow?');
    await page.click('.btn:has-text("Send the raven")');
    ok(await pageId(page) === 'mail', 'sent → inbox');
    await ev(page, () => { __jw.R.seed(1); });
    await ev(page, () => { for (const m of __jw.p.mailQueue || []) m.due = 0; __jw.game.tick(); });
    const mails = await ev(page, () => __jw.p.mail.map((m) => m.from));
    ok(mails.length >= 2, `mail arrives (${mails.join(', ')})`);
    await ev(page, () => __jw.game.goto('mail', { read: __jw.p.mail[0].id }));
    ok(await page.isVisible('.letter'), 'read a letter');

    // ---- export / reload / import
    await ev(page, () => __jw.game.goto('prefs'));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.btn:has-text("Export save file")')]);
    const file = path.join(OUT, 'export.json');
    await dl.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    ok(data.player.name === 'Brynhild Ash' && data.world.npcs.length >= 60, 'export holds the player and the world');
    const stamp = await ev(page, () => ({ day: __jw.p.day, dk: __jw.p.dk, gold: __jw.p.gold }));
    await page.reload();
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    ok(await page.isVisible('.slot:not(.empty)'), 'the saved warrior is on the login');
    await page.click('.slot .btn:has-text("Enter realm")');
    await page.waitForTimeout(200);
    p = await ev(page, () => ({ day: __jw.p.day, dk: __jw.p.dk, gold: __jw.p.gold }));
    ok(p.day === stamp.day && p.dk === stamp.dk && p.gold === stamp.gold, 'state survives a reload');
    await ev(page, () => __jw.logout(null));
    await page.setInputFiles('#import-file', file);
    await page.waitForTimeout(300);
    ok((await page.$$('.slot:not(.empty)')).length === 2, 'import fills a second slot');
    ok((await page.textContent('.title-msg')).includes('Imported'), 'import confirmation');

    // ---- 40 simulated days
    await page.click('.slot:nth-child(1) .btn:has-text("Enter realm")');
    const sim = await ev(page, () => {
        const g = __jw.game; const bad = [];
        for (let i = 0; i < 40; i++) {
            g.p.sleptAt = i % 2 ? 'fields' : 'inn';
            g.newDay();
            for (const n of g.w.npcs) for (const k of ['level', 'dk', 'exp', 'gold', 'bank', 'weapon', 'armor']) if (!Number.isFinite(n[k]) || n[k] < 0) bad.push(n.name + '.' + k + '=' + n[k]);
            for (const k of ['gold', 'exp', 'hp', 'turns']) if (!Number.isFinite(g.p[k])) bad.push('p.' + k);
        }
        const dks = g.w.npcs.reduce((s, n) => s + n.dk, 0);
        const levels = new Set(g.w.npcs.map((n) => n.level)).size;
        return { bad: bad.slice(0, 5), news: g.w.news.length, npcs: g.w.npcs.length, day: g.w.day, dks, levels, maxLevel: Math.max(...g.w.npcs.map((n) => n.level)) };
    });
    ok(sim.bad.length === 0, `no NaN/negatives over 40 days (${sim.bad.join(', ')})`);
    ok(sim.news > 100 && sim.news <= 400, `the Herald fills up (${sim.news})`);
    ok(sim.npcs >= 60 && sim.npcs <= 80, `population steady (${sim.npcs})`);
    ok(sim.levels >= 8, `a spread of levels (${sim.levels} distinct)`);
    await ev(page, () => __jw.game.goto('hof'));
    ok((await page.$$('table.tbl tbody tr')).length === 25, 'Hall of Heroes lists 25');
    await ev(page, () => __jw.game.goto('list'));
    ok((await page.$$('table.roll tbody tr')).length >= 60, 'the Roll lists everyone');
    await page.click('table.roll tbody tr:first-child .linkbtn');
    ok(await page.isVisible('.modal-card .profile'), 'profile modal');
    await page.keyboard.press('Escape');
    ok(!(await page.isVisible('.modal-card')), 'Esc closes the modal');

    // ---- classic pacing dawn
    await ev(page, () => { __jw.p.pacing = 'classic'; __jw.p.lastDawn = Date.now() - 7 * 3600000; __jw.game.goto('village'); });
    const d0 = await ev(page, () => __jw.p.day);
    await ev(page, () => __jw.game.tick());
    ok(await ev(page, (d) => __jw.p.day === d + 1 && __jw.game.cur.id === 'newday', d0), 'classic: a new day dawns after 6 real hours');
    await ev(page, () => { __jw.p.pacing = 'classic'; __jw.p.lastDawn = Date.now(); __jw.game.goto('fields'); });
    await page.click('.navbtn:has-text("Bed down")');
    await page.waitForTimeout(100);
    if (await page.isVisible('.modal-card')) await page.click('.modal-card .btn.primary');
    await page.waitForTimeout(200);
    ok(await page.isVisible('#title-screen') && (await page.textContent('.title-msg')).includes('dawns in'), 'classic: sleeping before dawn logs out with a countdown');
    await ctx.close();
}

// ======================================================================
async function phone(w, h) {
    console.log(`phone ${w}×${h}`);
    const { ctx, page } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    ok(await page.isVisible('.slot.empty'), 'login fits');
    await ev(page, () => __jw.quickStart({ name: 'Pip' }));
    await page.waitForTimeout(300);
    await page.tap('.navbtn');
    ok(await pageId(page) === 'village', 'tap enters the village');
    await page.waitForTimeout(1200);
    await shot(page, `bt-phone-${w}x${h}`);
    const sizes = await page.$$eval('.navbtn', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [r.height, r.width, r.left, r.right]; }));
    ok(sizes.every(([hh]) => hh >= 40), `nav buttons ≥ 40 px tall (min ${Math.min(...sizes.map((s) => s[0]))})`);
    ok(sizes.every(([, , l, r]) => l >= 0 && r <= w + 1), 'nav buttons inside the screen');
    const overflow = await ev(page, () => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!overflow, 'no horizontal overflow');
    await page.tap('.navbtn:has-text("Gloamwood")');
    ok(await pageId(page) === 'forest', 'tap: forest');
    await page.tap('.navbtn:has-text("Look for something")');
    const id = await pageId(page);
    if (id === 'fight') {
        await page.waitForTimeout(600);
        await shot(page, `bt-phone-fight-${w}x${h}`);
        await page.tap('.navbtn:has-text("Auto-fight to the end")');
        ok(await ev(page, () => __jw.p.fight?.over || __jw.p.hp < __jw.S.maxHp(__jw.p) * 0.3), 'tap auto-fight');
    }
    await ev(page, () => { __jw.p.fight = null; __jw.p.event = null; __jw.game.goto('village'); });
    await page.tap('#mb-vitals');
    await page.waitForFunction(() => document.getElementById('side').getBoundingClientRect().top < innerHeight - 100, null, { timeout: 4000 }).catch(() => {});
    ok(await ev(page, () => { const r = document.getElementById('side').getBoundingClientRect(); return r.top < innerHeight - 100; }), 'vitals drawer slides up');
    ok(await page.isVisible('#vitals .v-name'), 'vitals visible in the drawer');
    await page.tap('.side-tabs [data-tab=online]');
    ok(await page.isVisible('#online .onl'), 'online tab');
    await page.tap('.side-close');
    await page.waitForTimeout(500);
    ok(await ev(page, () => !document.getElementById('side').classList.contains('open')), 'drawer closes');
    const mb = await page.$$eval('#mbar button', (bs) => bs.map((b) => b.getBoundingClientRect().height));
    ok(mb.every((x) => x >= 40), 'bottom bar buttons ≥ 40 px');
    await page.tap('#mb-mail');
    ok(await pageId(page) === 'mail', 'mail button');
    await ctx.close();
}

try {
    if (process.env.ONLY !== 'phones') await desktop();
    if (process.env.ONLY !== 'desktop') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push('exception: ' + e.stack);
}
await browser.close();
console.log(`\n${passed} passed, ${errors.length} problems`);
for (const e of errors.slice(0, 40)) console.log(' -', e);
process.exit(errors.length ? 1 : 0);
