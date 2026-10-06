/**
 * simtest.mjs — headless tests of the pure simulation (no browser).
 *
 *   node game-062/dev/simtest.mjs
 *
 * ONLY=purity,gen,determinism,items,combat,bot   SEEDS=40   BOT_SEEDS=1,2   CLASSES=knight,ranger,mage   VERBOSE=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, '../js');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const VERBOSE = !!process.env.VERBOSE;
let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));

const { generateFloor, bfs } = await import(`${JS}/sim/dungeon.js`);
const { buildTown } = await import(`${JS}/sim/town.js`);
const { T, walkable } = await import(`${JS}/sim/tiles.js`);
const { createHero, computeStats, itemScore } = await import(`${JS}/sim/hero.js`);
const { Game, loadHero } = await import(`${JS}/sim/game.js`);
const { makeItem, rollKind, rollRarity } = await import(`${JS}/sim/items.js`);
const { STAT_LABEL } = await import(`${JS}/sim/data/items.js`);
const { RNG } = await import(`${JS}/rng.js`);
const { Bot } = await import(`${JS}/sim/bot.js`);
const { FLOORS } = await import(`${JS}/config.js`);
const { MONSTERS } = await import(`${JS}/sim/data/monsters.js`);

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

if (want('purity')) {
    console.log('\n== purity: js/sim imports no three, touches no DOM, never calls Math.random');
    let bad = 0;
    for (const f of listFiles(path.join(JS, 'sim'))) {
        const code = strip(fs.readFileSync(f, 'utf8'));
        if (/from\s+['"]three/.test(code)) { bad++; fail(`${f} imports three`); }
        if (/\bdocument\.|\bwindow\.|localStorage|requestAnimationFrame/.test(code)) { bad++; fail(`${f} touches the DOM`); }
        if (/Math\.random\(/.test(code)) { bad++; fail(`${f} calls Math.random`); }
        if (/from\s+['"]\.\.\/(view|ui)\//.test(code)) { bad++; fail(`${f} imports the view or UI`); }
    }
    check(bad === 0, 'js/sim is pure');
}

if (want('gen')) {
    const SEEDS = +(process.env.SEEDS || 40);
    console.log(`\n== generator: ${FLOORS} floors × ${SEEDS} seeds`);
    let maps = 0, maxAttempt = 0, bad = 0, monTotal = 0, monMin = 1e9, monMax = 0;
    const t0 = Date.now();
    for (let s = 1; s <= SEEDS; s++) for (let f = 1; f <= FLOORS; f++) {
        let m;
        try { m = generateFloor(s * 7919, f); } catch (e) { bad++; fail(`seed ${s} floor ${f}: ${e.message}`); continue; }
        maps++;
        maxAttempt = Math.max(maxAttempt, m.attempt);
        const g = { w: m.w, h: m.h, t: m.t, at: m.at };
        const sx = Math.floor(m.start.x), sy = Math.floor(m.start.y);
        if (!walkable(m.at(sx, sy))) { bad++; fail(`seed ${s} floor ${f}: start not walkable`); continue; }
        const dist = bfs(g, sx, sy);
        const reach = (x, y) => dist[Math.floor(y) * m.w + Math.floor(x)] >= 0;
        // Every walkable tile is reachable (the generator fills pockets).
        let pockets = 0;
        for (let i = 0; i < m.w * m.h; i++) if (walkable(m.t[i]) && dist[i] < 0) pockets++;
        if (pockets) { bad++; fail(`seed ${s} floor ${f}: ${pockets} unreachable tiles`); }
        if (!m.boss) {
            const down = m.objs.find((o) => o.type === 'down');
            if (!down || !reach(down.x, down.y)) { bad++; fail(`seed ${s} floor ${f}: stairs down missing/unreachable`); }
        } else {
            const boss = m.packs.find((p) => p.elite === 'boss');
            if (!boss || !reach(boss.x, boss.y)) { bad++; fail(`seed ${s} floor ${f}: boss missing/unreachable`); }
            if (!m.arena || !reach(m.arena.cx, m.arena.cy + 2)) { bad++; fail(`seed ${s} floor ${f}: arena stairs spot unreachable`); }
        }
        const up = m.objs.find((o) => o.type === 'up');
        if (!up || !reach(up.x, up.y)) { bad++; fail(`seed ${s} floor ${f}: stairs up unreachable`); }
        for (const o of m.objs) if (!walkable(m.at(Math.floor(o.x), Math.floor(o.y))) || !reach(o.x, o.y)) { bad++; fail(`seed ${s} floor ${f}: ${o.type} on a bad tile`); }
        // Solid objects never seal a corridor: removing them must not be needed for reachability.
        const solid = new Set(m.objs.filter((o) => !['up', 'down'].includes(o.type)).map((o) => Math.floor(o.y) * m.w + Math.floor(o.x)));
        const t2 = Uint8Array.from(m.t);
        for (const i of solid) t2[i] = T.SOLID;
        const d2 = bfs({ w: m.w, h: m.h, t: t2, at: (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? T.SOLID : t2[y * m.w + x]) }, sx, sy);
        let cut = 0;
        for (let i = 0; i < m.w * m.h; i++) if (walkable(t2[i]) && d2[i] < 0) cut++;
        if (cut > 3) { bad++; fail(`seed ${s} floor ${f}: objects cut off ${cut} tiles`); }
        for (const p of m.packs) {
            const t = m.at(Math.floor(p.x), Math.floor(p.y));
            if (!(walkable(t) || (MONSTERS[p.type].flying && t === T.PUNCH))) { bad++; fail(`seed ${s} floor ${f}: pack ${p.type} on tile ${t}`); }
        }
        const n = m.packs.reduce((a, p) => a + p.count, 0);
        monTotal += n; monMin = Math.min(monMin, n); monMax = Math.max(monMax, n);
        if (f === 2 && !m.objs.some((o) => o.type === 'lectern')) { bad++; fail(`seed ${s}: no lectern on floor 2`); }
        if (f === 6 && !m.objs.some((o) => o.type === 'anvil')) { bad++; fail(`seed ${s}: no anvil on floor 6`); }
        if (f === 7 && !m.packs.some((p) => p.type === 'thief')) { bad++; fail(`seed ${s}: no thief on floor 7`); }
        if (Math.hypot(m.start.x - (up ? up.x : 0), m.start.y - (up ? up.y : 0)) > 4) { bad++; fail(`seed ${s} floor ${f}: start far from stairs up`); }
    }
    check(bad === 0, `${maps} floors valid (max retry attempt ${maxAttempt}, ${((Date.now() - t0) / maps).toFixed(1)} ms/floor)`);
    console.log(`    monsters per floor: min ${monMin}, avg ${(monTotal / maps).toFixed(0)}, max ${monMax}`);
    check(monMin >= 20 && monMax <= 160, 'monster counts in range');
    const town = buildTown();
    const td = bfs(town, Math.floor(town.start.x), Math.floor(town.start.y));
    const tReach = (x, y) => td[Math.floor(y) * town.w + Math.floor(x)] >= 0;
    check(town.npcs.every((n) => tReach(n.x, n.y)), 'every townsfolk is reachable');
    check(tReach(town.wellSpot.x, town.wellSpot.y) && tReach(20, 6), 'well and cellar reachable');
}

if (want('determinism')) {
    console.log('\n== determinism');
    const a = generateFloor(12345, 5), b = generateFloor(12345, 5), c = generateFloor(12346, 5);
    check(Buffer.from(a.t).equals(Buffer.from(b.t)) && JSON.stringify(a.packs) === JSON.stringify(b.packs), 'same seed → same floor');
    check(!Buffer.from(a.t).equals(Buffer.from(c.t)), 'different seed → different floor');
    // Two games with the same hero seed play out identically for 30 sim-seconds under the bot.
    const run = () => {
        const g = new Game(createHero({ name: 'Det', cls: 'knight' }, 77));
        const bot = new Bot(g);
        for (let i = 0; i < 30 * 30; i++) bot.step(1 / 30);
        const w = g.world;
        return `${w.floor}:${w.hero.x.toFixed(4)},${w.hero.y.toFixed(4)}:${g.hero.xp}:${g.hero.stats.kills}`;
    };
    const r1 = run(), r2 = run();
    check(r1 === r2, `bot run reproducible (${r1})`);
}

if (want('items')) {
    console.log('\n== items');
    const rng = new RNG(99);
    const counts = { normal: 0, magic: 0, rare: 0, legendary: 0 };
    let bad = 0;
    const hero = createHero({ name: 'Item', cls: 'mage' }, 3);
    for (let i = 0; i < 6000; i++) {
        const lvl = 1 + (i % 50);
        const kind = rollKind(rng, ['knight', 'ranger', 'mage'][i % 3]);
        const it = makeItem(rng, kind, lvl, rollRarity(rng, i % 4 ? 0 : 200, 1 + (i % 3)));
        counts[it.rarity]++;
        if (!it.name || !it.base || !(it.value > 0) || !it.slot) { bad++; if (bad < 5) fail(`bad item ${JSON.stringify(it)}`); }
        for (const a of it.affixes) if (!STAT_LABEL[a.s] || !Number.isFinite(a.v)) { bad++; if (bad < 5) fail(`bad affix ${a.s}=${a.v} on ${it.name}`); }
        if (it.dmg && !(it.dmg[0] > 0 && it.dmg[1] >= it.dmg[0])) { bad++; fail(`bad dmg on ${it.name}`); }
        if (Number.isNaN(itemScore(hero, it))) { bad++; fail(`NaN score ${it.name}`); }
    }
    check(bad === 0, '6000 items well-formed');
    console.log(`    rarities: ${JSON.stringify(counts)}`);
    check(counts.legendary > 0 && counts.rare > counts.legendary && counts.magic > counts.rare, 'rarity ordering sensible');
    for (const cls of ['knight', 'ranger', 'mage']) {
        const h = createHero({ name: 'S', cls }, 5);
        const st = computeStats(h);
        const nan = Object.entries(st).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v));
        check(!nan.length && st.maxHp > 30 && st.dmgMax > 0, `${cls} level-1 stats sane (HP ${st.maxHp}, Juice ${st.maxJuice}, dmg ${st.dmgMin}-${st.dmgMax}, armour ${st.armor})`);
    }
    const g = new Game(createHero({ name: 'Save', cls: 'ranger' }, 11));
    const json = g.serialize();
    const back = loadHero(json);
    check(JSON.stringify({ ...back, sessions: 0 }) === JSON.stringify({ ...JSON.parse(json), sessions: 0, hp: undefined, juice: undefined }), 'save → load round trip');
}

if (want('combat')) {
    console.log('\n== combat & town');
    const g = new Game(createHero({ name: 'C', cls: 'knight' }, 21));
    check(g.world.town && g.world.npcs.length === 5, 'starts in Tristrawberry with five townsfolk');
    const d = g.talk('cane');
    check(d.quest && d.quest.id === 'freshfruit' && g.hero.quests.freshfruit === 1, 'Deckard Cane gives "Ahh, Fresh Fruit!"');
    g.talk('granny');
    check(g.hero.quests.recipe === 1, "Granny gives her recipe quest");
    check(g.shop('smith').length > 0 && g.shop('oracle').length > 0, 'shops have stock');
    const before = g.hero.sugar;
    g.buyPotion('hp', 1);
    check(g.hero.sugar < before && g.hero.potions.hp === 5, 'bought a Strawberry Jam');
    // Into the cellar.
    const cellar = g.world.objs.find((o) => o.type === 'cellar');
    g.world.hero.x = cellar.x; g.world.hero.y = cellar.y + 1;
    g.world.heroInteract(cellar.id);
    for (let i = 0; i < 120 && g.world.town; i++) g.update(1 / 30);
    check(g.world.floor === 1, 'cellar door leads to Root Cellar level 1');
    const w = g.world;
    const m = w.spawnMon('grape', w.hero.x + 1.2, w.hero.y, {});
    m.aggro = true;
    let t = 0;
    w.heroAttack(m.id, 0);
    while (!m.dead && t < 10) { g.update(1 / 30); t += 1 / 30; if (!w.hero.intent) w.heroAttack(m.id, 0); }
    check(m.dead, `a level-1 Melon Knight squashes a Moldy Grape in ${t.toFixed(1)} s`);
    const xp0 = g.hero.xp;
    check(xp0 > 0, `and earns ${xp0} xp`);
    // Portal pie round trip.
    const pies = g.hero.potions.pie;
    check(g.usePie() && g.hero.potions.pie === pies - 1, 'Portal Pie opens a portal');
    const p = w.objs.find((o) => o.type === 'portal');
    w.hero.x = p.x + 0.3; w.hero.y = p.y;
    w.heroInteract(p.id);
    for (let i = 0; i < 60 && !g.world.town; i++) g.update(1 / 30);
    check(g.world.town && g.world.objs.some((o) => o.type === 'portal'), 'portal leads home and a return portal waits in town');
    const tp = g.world.objs.find((o) => o.type === 'portal');
    g.world.hero.x = tp.x + 0.3; g.world.hero.y = tp.y;
    g.world.heroInteract(tp.id);
    for (let i = 0; i < 60 && g.world.town; i++) g.update(1 / 30);
    check(g.world.floor === 1 && !g.portal, 'return portal goes back down and closes');
    // Every skill of every class casts without throwing.
    for (const cls of ['knight', 'ranger', 'mage']) {
        const gg = new Game(createHero({ name: 'K', cls }, 31));
        gg.enter(3, 'waypoint');
        const ww = gg.world;
        gg.god = true;
        const hero = gg.hero;
        hero.level = 20;
        for (const s of Object.keys(hero.skills)) hero.skills[s] = 3;
        hero.bar = [...Object.keys(hero.skills)];
        ww.refreshStats();
        ww.hero.juice = ww.hero.maxJuice = 999;
        let thrown = null, casts = 0;
        try {
            for (let slot = 0; slot < 6; slot++) {
                for (let k = 0; k < 3; k++) {
                    const mm = ww.spawnMon('grape', ww.hero.x + 2, ww.hero.y + 0.5, {});
                    mm.aggro = true;
                    ww.hero.cds = {}; ww.hero.juice = 999;
                    if (ww.heroSkill(slot, mm.x, mm.y, 0)) casts++;
                    for (let i = 0; i < 60; i++) gg.update(1 / 30);
                }
            }
        } catch (e) { thrown = e; }
        check(!thrown && casts >= 12, `${cls}: all six skills cast (${casts} casts)${thrown ? ' — ' + thrown.stack : ''}`);
    }
}

if (want('bot')) {
    const seeds = (process.env.BOT_SEEDS || '1').split(',').map(Number);
    const classes = (process.env.CLASSES || 'knight,ranger,mage').split(',');
    const LIMIT = +(process.env.BOT_MINUTES || 240) * 60;
    console.log(`\n== bot: plays from a new hero to Durian the Diabolical (limit ${LIMIT / 60} sim-minutes)`);
    for (const cls of classes) for (const seed of seeds) {
        const t0 = Date.now();
        const g = new Game(createHero({ name: 'Bot', cls }, seed * 101));
        const bot = new Bot(g);
        const dt = 1 / 30;
        let t = 0, err = null, lastFloor = 0;
        const levels = {};
        try {
            while (t < LIMIT && g.hero.quests.core < 2) {
                bot.step(dt); t += dt;
                const f = g.world.floor;
                if (f > lastFloor) { levels[f] = g.hero.level; lastFloor = f; if (VERBOSE) console.log(`    ${cls} reached floor ${f} at ${(t / 60).toFixed(1)} min, L${g.hero.level}`); }
            }
        } catch (e) { err = e; }
        const won = g.hero.quests.core >= 2;
        const h = g.hero;
        const st = g.world.hero.st;
        const fl = Object.entries(bot.floorTimes).filter(([f]) => +f > 0).map(([f, s]) => `${f}:${(s / 60).toFixed(1)}`).join(' ');
        console.log(`    ${cls} seed ${seed}: ${won ? 'WON' : 'not won'} in ${(t / 60).toFixed(1)} sim-min (${((Date.now() - t0) / 1000).toFixed(1)} s real), L${h.level}, deaths ${h.stats.deaths}, kills ${h.stats.kills}, sugar ${h.sugar}, HP ${st.maxHp}, dmg ${st.dmgMin}-${st.dmgMax}`);
        console.log(`      level on arrival: ${JSON.stringify(levels)}`);
        console.log(`      minutes per floor: ${fl}`);
        if (bot.log.length) console.log(`      ${bot.log.slice(0, 12).join('; ')}${bot.log.length > 12 ? ` … (${bot.log.length})` : ''}`);
        if (err) fail(`${cls} seed ${seed} threw: ${err.stack}`);
        check(won, `${cls} beats the game`);
    }
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
