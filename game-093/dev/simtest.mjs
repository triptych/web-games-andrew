/**
 * simtest.mjs — headless checks of Dawnshard Saga's simulation. No browser.
 *
 *   node game-093/dev/simtest.mjs                  # everything (the bot section plays a whole game, about 4 minutes)
 *   ONLY=purity,rules,determinism,world,quests node game-093/dev/simtest.mjs     # the fast ones, seconds
 *   SEEDS=3 VERBOSE=1 node game-093/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock, and never import the
 *    view, the UI, the audio or the input.
 * 2. rules: shields, weaknesses, Break, Boost, BP, turn order, items, levelling, shops, fleeing, boss charges and phases.
 * 3. determinism: same seed and inputs give the same game; a save round trip plays on identically; an unknown version is rejected.
 * 4. world: every place on the overmap can be walked to from every other; every town door, villager and exit can be reached;
 *    every dungeon's chests, crystal, ramps and boss are reachable once cracked walls are broken.
 * 5. quests: boards and villager storylines for every town on several seeds are completable (items exist, targets exist).
 * 6. bot: the auto-player plays a whole game to the ending with invariants checked as it goes, and prints the balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 1);
const want = (n) => !ONLY.length || ONLY.includes(n);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/battle.js');
const Pt = await import('../js/sim/party.js');
const Qs = await import('../js/sim/quests.js');
const Nav = await import('../js/sim/world/nav.js');
const Loc = await import('../js/sim/world/locations.js');
const Mp = await import('../js/sim/world/maps.js');
const Bot = await import('../js/sim/bot.js');
const { ITEMS } = await import('../js/sim/data/items.js');
const { ENEMIES } = await import('../js/sim/data/enemies.js');
const { BEATS } = await import('../js/sim/data/story.js');
const { CHARS, SKILLS } = await import('../js/sim/data/classes.js');
const { ARCS } = await import('../js/sim/data/npcdata.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg); return cond; };
const section = (n) => console.log(`\n== ${n}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) { Gm.step(G, inp, DT); } };
const drain = (G) => G.events.splice(0);

// ---------------------------------------------------------------- 1. purity
if (want('purity')) {
    section('purity');
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } };
    walk(path.join(ROOT, 'js/sim')); files.push(path.join(ROOT, 'js/rng.js'), path.join(ROOT, 'js/config.js'));
    const bad = [[/\bdocument\.|\bwindow\.|\blocalStorage\b|\bnavigator\./, 'DOM or storage'], [/Math\.random/, 'Math.random'], [/Date\.now|new Date|performance\.now|setTimeout|setInterval|requestAnimationFrame/, 'clock'], [/from\s+['"][^'"]*(view|ui|audio|input|save|main)[^'"]*['"]/, 'import of view/ui/audio/input/save/main'], [/from\s+['"]three/, 'three.js']];
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const [re, what] of bad) ok(!re.test(src), `${path.relative(ROOT, f)} has no ${what}`);
    }
}

// ---------------------------------------------------------------- 2. rules
function lab(seed = 11, members = ['kael'], lvl = 5, enemies = [{ kind: 'slime', lvl: 3 }]) {
    const G = Gm.newGame(seed); drain(G); G.scene = null; G.mode = 'field';
    for (const id of members) if (!G.party.members[id]) Pt.recruit(G, id);
    for (const id of G.party.active) { const m = G.party.members[id]; m.lvl = lvl; const s = Pt.memberStats(m); m.hp = s.mhp; m.mp = s.mmp; }
    const B = Bt.startBattle(G, { enemies, bg: 'grass' });
    return { G, B };
}
const waitCmd = (G) => { for (let i = 0; i < 50 && G.battle && !G.battle.result && !Bt.canAct(G); i++) Bt.advance(G); return Bt.canAct(G); };
const unit = (B, id) => B.units.find((u) => u.id === id);

if (want('rules')) {
    section('rules: a new game');
    {
        const G = Gm.newGame(5);
        ok(G.map === 'emberfield' && G.party.active.length === 1 && G.party.active[0] === 'kael', 'starts in Emberfield with Kael');
        ok(Object.keys(CHARS).length === 8, 'eight characters exist');
        const ev = drain(G);
        ok(ev.some((e) => e.type === 'map'), 'the first event loads the map');
        run(G, NONE, 0.5);
        ok(G.mode === 'scene' || G.scene, 'the opening scene begins');
    }
    section('rules: the field');
    {
        const G = Gm.newGame(5); drain(G); G.scene = null; G.mode = 'field'; G.flags.intro_done = true; G.story.i = 99;
        const x0 = G.px, y0 = G.py;
        run(G, { x: 0, y: 1, a: false }, 0.6);
        ok(G.py > y0 + 1, 'walking down moves the party');
        run(G, { x: 1, y: 0, a: false }, 40);
        ok(Number.isFinite(G.px) && G.px < Gm.curMap(G).w, 'walking into walls never leaves the map');
        const map = Gm.curMap(G);
        ok(map.exits.length > 0, 'the town has exits');
        void x0;
    }
    section('rules: standing off from cliffs');
    {
        // a sprite leans back, so in towns the party keeps further from the foot of a cliff than from a wall
        const G = Gm.newGame(5); drain(G); G.scene = null; G.mode = 'field'; G.story.i = 99;
        const { WALKABLE } = await import('../js/sim/world/tiles.js');
        let tested = 0, worst = 9;
        for (const t of ['emberfield', 'silverbrook', 'portazura']) {
            G.map = t; const m = Gm.curMap(G);
            for (let y = 2; y < m.h - 2 && tested < 40; y++) for (let x = 2; x < m.w - 2 && tested < 40; x++) {
                const i = y * m.w + x, up = (y - 1) * m.w + x;
                // a low standable tile with a cliff straight north of it
                if (!WALKABLE[m.tile[i]] || m.blk[i] || !WALKABLE[m.tile[up]] || m.blk[up] || m.hgt[up] - m.hgt[i] <= 1) continue;
                G.px = x + 0.5; G.py = y + 0.95; G.trail = [];
                const ok0 = !m.npcs.some((n) => Math.hypot(n.x - G.px, n.y - G.py) < 1.5);
                if (!ok0) continue;
                for (let k = 0; k < 120; k++) Gm.step(G, { x: 0, y: -1, a: false }, DT);
                worst = Math.min(worst, G.py - y);
                tested++;
            }
        }
        ok(tested > 0, `found cliffs to walk into (${tested})`);
        ok(worst >= 0.45, `the party stops at least 0.45 tile from a cliff foot (closest ${worst.toFixed(2)})`);
    }
    section('rules: shields, weaknesses and Break');
    {
        const { G, B } = lab(11, ['kael'], 8, [{ kind: 'slime', lvl: 3 }]);
        ok(waitCmd(G), 'a hero gets a command window');
        const e = unit(B, 'e0'); e.weak = ['sword', 'fire']; e.shield = 2; e.mshield = 2; e.hp = e.mhp = 9999;
        const hp0 = e.hp;
        ok(Bt.playerAct(G, { type: 'attack', target: 'e0', boost: 0 }), 'an attack is accepted');
        ok(e.shield === 1, `a weapon hit on a weakness chips one shield (${e.shield})`);
        ok(e.revealed.has('sword'), 'the weakness is revealed');
        ok(hp0 - e.hp > 0, 'it deals damage');
        const dmgWeak = hp0 - e.hp;
        waitCmd(G);
        G.events.length = 0;
        ok(Bt.playerAct(G, { type: 'attack', target: 'e0', boost: 0 }), 'a second attack');
        const evs = G.events.slice();
        ok(evs.some((x) => x.type === 'b_act' && x.hits.some((h) => h.broke)), 'the shield reaches zero: BREAK');
        ok(evs.some((x) => x.type === 'b_skip' && x.reason === 'break'), 'a broken foe loses its turn');
        ok(evs.some((x) => x.type === 'b_recover') && e.shield === e.mshield && !e.broken, 'it recovers with its shield restored');
        void dmgWeak;
    }
    section('rules: broken foes take more damage');
    {
        const dmg = (broken) => {
            const { G, B } = lab(3, ['kael'], 8, [{ kind: 'wolf', lvl: 4 }]);
            waitCmd(G); const e = unit(B, 'e0'); e.weak = ['bow']; e.shield = 9; e.hp = e.mhp = 99999; e.broken = broken; const h = e.hp;
            G.rng.setState(1234);
            Bt.playerAct(G, { type: 'attack', target: 'e0', boost: 0 });
            return h - e.hp;
        };
        const a = dmg(false), b = dmg(true);
        ok(b > a * 1.3, `Break multiplies damage (${a} → ${b})`);
    }
    section('rules: Boost and BP');
    {
        const { G, B } = lab(11, ['kael'], 8, [{ kind: 'goblin', lvl: 3 }]);
        waitCmd(G); const k = B.units.find((u) => u.id === 'p0');
        ok(k.bp === 1, `a hero gains 1 BP at the start of a turn (${k.bp})`);
        k.bp = 3; const e = unit(B, 'e0'); e.hp = e.mhp = 99999; e.shield = 99;
        const hp0 = e.hp; G.rng.setState(77);
        Bt.playerAct(G, { type: 'attack', target: 'e0', boost: 3 });
        const boosted = hp0 - e.hp;
        ok(k.bp <= 1, `Boost spends the BP (${k.bp} left, one may have been earned since)`);
        ok(G.events.some((x) => x.type === 'b_act' && x.bpSpent === 3), 'the action event carries the boost');
        const l2 = lab(11, ['kael'], 8, [{ kind: 'goblin', lvl: 3 }]); waitCmd(l2.G); const e2 = unit(l2.B, 'e0'); e2.hp = e2.mhp = 99999; e2.shield = 99; l2.G.rng.setState(77);
        Bt.playerAct(l2.G, { type: 'attack', target: 'e0', boost: 0 });
        ok(boosted > (99999 - e2.hp) * 1.5, `a boosted attack hits harder (${99999 - e2.hp} → ${boosted})`);
        const l3 = lab(11, ['kael'], 8, [{ kind: 'goblin', lvl: 3 }]); waitCmd(l3.G);
        ok(l3.B.units[0].bp <= C.MAX_BP, 'BP never passes the cap');
    }
    section('rules: items, MP, defend, fleeing');
    {
        const { G, B } = lab(21, ['kael', 'lyra'], 6, [{ kind: 'slime', lvl: 2 }]);
        waitCmd(G);
        const me = unit(B, B.actor);
        me.hp = Math.max(1, me.mhp - 40); G.inv.potion = 2;
        const h0 = me.hp;
        ok(Bt.playerAct(G, { type: 'item', item: 'potion', target: me.id }), 'a potion can be used');
        ok(me.hp > h0 && G.inv.potion === 1, 'it heals and is spent');
        waitCmd(G);
        const g = unit(B, B.actor); const mp0 = g.mp;
        ok(Bt.playerAct(G, { type: 'defend' }), 'defend works');
        void mp0;
        for (let i = 0; i < 30 && G.battle && !G.battle.result; i++) { if (Bt.canAct(G)) { if (!Bt.playerAct(G, { type: 'flee' })) Bt.playerAct(G, { type: 'defend' }); } else Bt.advance(G); }
        ok(!G.battle || G.battle.result, 'fleeing from a weak foe ends the fight sooner or later');
    }
    section('rules: winning, XP and levels');
    {
        const { G, B } = lab(31, ['kael'], 1, [{ kind: 'slime', lvl: 1 }]);
        const m = G.party.members.kael; const l0 = m.lvl;
        for (let i = 0; i < 200 && G.battle && !G.battle.result; i++) { if (Bt.canAct(G)) Bt.playerAct(G, { type: 'attack', target: Bt.living(G.battle, 'enemy')[0].id, boost: 0 }); else Bt.advance(G); }
        ok(B.result === 'victory', 'a level-1 hero beats one level-1 slime');
        const ev = G.events.find((e) => e.type === 'b_end');
        ok(ev && ev.rewards && ev.rewards.xp > 0, 'victory carries rewards');
        Gm.act(G, { type: 'battleDone' });
        ok(G.mode === 'field' && !G.battle, 'battleDone returns to the field');
        ok(m.lvl >= l0, 'XP never lowers a level');
        const m2 = { ...Pt.newMember('kael', 1) }; Pt.gainXp(m2, 1e9);
        ok(m2.lvl === C.MAX_LEVEL, `levels cap at ${C.MAX_LEVEL}`);
        for (const id of Object.keys(CHARS)) for (const lv of [1, 10, 30, 50]) { const mm = Pt.newMember(id, lv); const s = Pt.memberStats(mm); ok(s.mhp > 0 && s.atk >= 0 && s.mmp >= 0, `${id} lv ${lv} has sane stats`); }
    }
    section('rules: bosses charge and are cancelled by Break');
    {
        let any = false, cancelled = false;
        for (const [id, e] of Object.entries(ENEMIES)) {
            if (!e.boss) continue;
            const { G, B } = lab(41, ['kael', 'lyra', 'thorne', 'elara'], 30, [{ kind: id, lvl: 25 }]);
            for (let i = 0; i < 120 && G.battle && !G.battle.result; i++) {
                if (Bt.canAct(G)) { const u = B.units.find((x) => x.id === B.actor); const t = Bt.living(B, 'enemy')[0]; u.bp = 3; for (const en of B.units) if (en.side === 'enemy') en.weak = ['sword', 'bow', 'fire', 'ice', 'thunder', 'holy', 'dark', 'wind', 'axe', 'dagger', 'spear']; Bt.playerAct(G, { type: 'attack', target: t.id, boost: 3 }); } else Bt.advance(G);
                if (G.events.some((x) => x.type === 'b_charge')) any = true;
                if (G.events.some((x) => x.cancelled || (x.hits && x.hits.some((h) => h.cancelled)))) cancelled = true;
                G.events.length = 0;
            }
        }
        ok(any, 'at least one boss telegraphs a charged move');
        ok(cancelled, 'a Break cancels a charged move');
    }
    section('rules: shops');
    {
        const G = Gm.newGame(5); drain(G); G.scene = null; G.mode = 'shop'; G.gold = 500; G.inv = {};
        G.shop = { kind: 'shop', town: 'emberfield', stock: ['potion', 'ether'], name: 'General Store' };
        ok(Gm.act(G, { type: 'buy', item: 'potion', n: 2 }) && G.inv.potion === 2 && G.gold < 500, 'buying takes gold and gives items');
        ok(!Gm.act(G, { type: 'buy', item: 'hiPotion', n: 1 }), 'items not in stock cannot be bought');
        const g1 = G.gold; ok(Gm.act(G, { type: 'sell', item: 'potion', n: 1 }) && G.gold > g1, 'selling gives gold');
        G.gold = 0; ok(!Gm.act(G, { type: 'buy', item: 'potion', n: 1 }), 'no gold, no purchase');
    }
    section('rules: data tables');
    {
        for (const [id, it] of Object.entries(ITEMS)) ok(it.name && (it.type || it.use), `item ${id} is complete`);
        for (const [id, e] of Object.entries(ENEMIES)) { ok(Array.isArray(e.weak) && e.weak.length > 0 && e.shield > 0, `enemy ${id} has weaknesses and a shield`); ok(e.sprite, `enemy ${id} has a sprite`); }
        for (const [id, s] of Object.entries(SKILLS)) ok(s.name && s.mp >= 0, `skill ${id} is complete`);
        BEATS.forEach((b, i) => { ok(b.obj && b.scene && b.trig, `beat ${i} ${b.id} is complete`); for (const c of b.scene) if (c && c.battle) for (const en of c.battle.enemies) ok(ENEMIES[en.kind], `beat ${b.id} uses a real enemy ${en.kind}`); });
    }
}

// ---------------------------------------------------------------- 3. determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed), bot = Bot.makeBot(); for (let t = 0; t < secs; t += DT) { Gm.step(G, Bot.botInput(G, bot), DT); G.events.length = 0; } return G; };
    const a = play(8, 90), b = play(8, 90);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed, same inputs: the same game after 90 s');
    const c = play(9, 90);
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(c)), 'a different seed plays differently');
    // save round trip, mid-game
    const G0 = play(4, 120);
    while (G0.mode !== 'field' || G0.scene || G0.pending || G0.warp) { Gm.step(G0, NONE, DT); G0.events.length = 0; }
    const snap = Gm.serialize(G0);
    const G = Gm.deserialize(JSON.parse(JSON.stringify(snap)));
    ok(JSON.stringify(snap) === JSON.stringify(Gm.serialize(Gm.deserialize(JSON.parse(JSON.stringify(snap))))), 'serialize → deserialize → serialize is stable');
    const g2 = Gm.deserialize(JSON.parse(JSON.stringify(snap)));
    const b1 = Bot.makeBot(), b2 = Bot.makeBot();
    for (let t = 0; t < 60; t += DT) { Gm.step(G, Bot.botInput(G, b1), DT); Gm.step(g2, Bot.botInput(g2, b2), DT); G.events.length = 0; g2.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(g2)), 'a loaded game plays on identically');
    let threw = false; try { Gm.deserialize({ ...snap, v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected');
    threw = false; try { Gm.deserialize({}); } catch { threw = true; }
    ok(threw, 'an empty save is rejected');
}

// ---------------------------------------------------------------- 4. world
if (want('world')) {
    section('world: the overmap');
    {
        const G = Gm.newGame(1); const over = Mp.getMap(G, 'over');
        ok(over.w === C.OVER_W && over.h === C.OVER_H, `the overmap is ${C.OVER_W}×${C.OVER_H}`);
        const ids = Object.keys(Loc.LOCS);
        const start = Loc.LOCS.emberfield;
        const seen = Nav.reach(over, start.x + 0.5, start.y + 1.5, null);
        for (const id of ids) { const L = Loc.LOCS[id]; ok(seen[((L.y + 1) | 0) * over.w + (L.x | 0)], `${id} can be walked to from Emberfield (gates open)`); }
        const closed = Bot.lockMask(G, over);
        const seen2 = Nav.reach(over, start.x + 0.5, start.y + 1.5, closed);
        ok(seen2[((Loc.LOCS.woods.y + 1) | 0) * over.w + Loc.LOCS.woods.x], 'the Whispering Woods are open from the start');
        ok(seen2[((Loc.LOCS.silverbrook.y + 1) | 0) * over.w + Loc.LOCS.silverbrook.x], 'Silverbrook is open from the start');
        ok(seen2[((Loc.LOCS.portazura.y + 1) | 0) * over.w + Loc.LOCS.portazura.x], 'Port Azura is open once the mountains are crossed');
        const at = (m, id) => m[((Loc.LOCS[id].y + 1) | 0) * over.w + Loc.LOCS[id].x];
        ok(!at(seen2, 'dunehaven') && !at(seen2, 'hoarhold'), 'the desert and the ice are sealed until the story opens them');
        G.flags.open_sand = true; G.flags.open_ice = true;
        const seen3 = Nav.reach(over, start.x + 0.5, start.y + 1.5, Bot.lockMask(G, over));
        ok(['dunehaven', 'pyramid', 'hoarhold', 'glacier', 'spire', 'maw'].every((id) => at(seen3, id)), 'everything opens once both passes are open');
    }
    for (let seed = 1; seed <= 3; seed++) {
        section(`world: towns and dungeons, seed ${seed}`);
        const G = Gm.newGame(seed);
        for (const t of Loc.TOWNS) {
            const m = Mp.getMap(G, t);
            const seen = Nav.reach(m, m.spawn[0], m.spawn[1], null);
            const at = (x, y) => seen[Math.floor(y) * m.w + Math.floor(x)];
            const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy));
            ok(at(m.spawn[0], m.spawn[1]), `${t}: spawn is walkable`);
            ok(m.exits.length && m.exits.every((e) => near(e.x + (e.w || 1) / 2, e.y + 0.5)), `${t}: every exit is reachable`);
            ok((m.buildings || []).every((b) => near(b.door[0] + 0.5, b.door[1] + 0.6)), `${t}: every door is reachable (${(m.buildings || []).length})`);
            ok(m.npcs.length >= 9, `${t}: at least nine villagers (${m.npcs.length})`);
            ok(m.npcs.every((n) => near(n.x, n.y)), `${t}: every villager stands somewhere reachable`);
            ok((m.props || []).some((p) => p.type === 'board'), `${t}: a notice board`);
                        const kinds = new Set((m.buildings || []).map((b) => b.kind));
            ok(kinds.has('inn') && kinds.has('shop') && kinds.has('gear') && kinds.has('guild'), `${t}: inn, store, smithy and guild exist`);
        }
        for (const d of Loc.DUNGEONS) {
            const m = Mp.getMap(G, d);
            const bm = new Uint8Array(m.blk); for (const p of m.props) if (p.type === 'crack') m.blk[p.y * m.w + p.x] = 0;
            const seen = Nav.reach(m, m.spawn[0], m.spawn[1], null);
            m.blk.set(bm);
            const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => seen[Math.floor(y + dy) * m.w + Math.floor(x + dx)]);
            ok(m.exits.every((e) => near(e.x + 0.5, e.y + 0.5)), `${d}: the way out is reachable`);
            const chests = m.props.filter((p) => p.type === 'chest');
            ok(chests.length >= 3, `${d}: chests (${chests.length})`);
            ok(chests.every((c) => near(c.x + 0.5, c.y + 0.5)), `${d}: every chest is reachable once cracks are broken`);
            ok(m.props.some((p) => p.type === 'save'), `${d}: a save crystal`);
            ok(m.bossRoom && near(m.bossRoom.cx + 0.5, m.bossRoom.cy + 0.5), `${d}: the boss room is reachable`);
            ok(m.mobs.length >= 3 && m.mobs.every((mb) => ENEMIES[mb.form[0].kind]), `${d}: visible monsters with real forms (${m.mobs.length})`);
        }
    }
}

// ---------------------------------------------------------------- 5. quests and villagers
if (want('quests')) {
    section('quests and villager storylines');
    for (let seed = 1; seed <= 3; seed++) {
        const G = Gm.newGame(seed); drain(G);
        for (const t of Loc.TOWNS) {
            const board = Qs.ensureBoard(G, t);
            ok(board.length >= 3, `seed ${seed} ${t}: the board offers ${board.length} jobs`);
            for (const q of board) {
                ok(q.title && q.text && q.reward.gold > 0, `${t}: "${q.title}" is described and pays`);
                const p = q.p;
                if (p.type === 'hunt') ok(ENEMIES[p.kind] && p.n > 0, `${t}: hunt target ${p.kind} exists`);
                if (p.type === 'fetch') ok(ITEMS[p.item] && Object.values(ENEMIES).some((e) => e.mat === p.item), `${t}: someone drops ${p.item}`);
                if (p.type === 'recover') ok(Loc.LOCS[p.dungeon] && ITEMS[p.item], `${t}: recover target in ${p.dungeon}`);
                if (p.type === 'courier') ok(Loc.LOCS[p.town] && p.town !== t, `${t}: courier destination ${p.town}`);
                ok(Qs.accept(G, q), `${t}: "${q.title}" can be accepted`);
            }
            const m = Mp.getMap(G, t); const arcs = m.npcs.filter((n) => n.arc);
            ok(arcs.length === 2, `${t}: two villagers with a storyline (${arcs.length})`);
            for (const n of arcs) { const a = ARCS.find((x) => x.id === n.arc); ok(a && a.stages.length === 3, `${t}: ${n.name}'s arc ${n.arc} has three stages`); ok(Qs.arcQuest(G, n, t), `${t}: ${n.name}'s first stage is a quest`); }
        }
        // the same seed makes the same villagers
        const names = (g) => Loc.TOWNS.map((t) => Mp.getMap(g, t).npcs.map((n) => n.name).join(',')).join('|');
        ok(names(G) === names(Gm.newGame(seed)), `seed ${seed}: villagers are deterministic`);
    }
    const n1 = Loc.TOWNS.map((t) => Mp.getMap(Gm.newGame(1), t).npcs.map((n) => n.name).join(',')).join('|');
    const n2 = Loc.TOWNS.map((t) => Mp.getMap(Gm.newGame(2), t).npcs.map((n) => n.name).join(',')).join('|');
    ok(n1 !== n2, 'different seeds make different villagers');
}

// ---------------------------------------------------------------- 6. the bot plays the whole game
if (want('bot')) {
    section('bot: whole games');
    const HOURS = +(process.env.BOT_HOURS || 12);
    for (let s = 0; s < SEEDS; s++) {
        const seed = 3 + s * 17;
        const G = Gm.newGame(seed), bot = Bot.makeBot();
        const table = []; let lastI = -1, bad = null;
        const t0 = Date.now();
        for (let i = 0; i < 120 * 3600 * HOURS; i++) {
            Gm.step(G, Bot.botInput(G, bot), DT);
            G.events.length = 0;
            if (G.story.i !== lastI) {
                lastI = G.story.i;
                const ms = Object.values(G.party.members);
                table.push({ beat: BEATS[G.story.i]?.id || 'end', min: Math.round(G.stats.playtime / 60), lv: Math.round(ms.reduce((a, m) => a + m.lvl, 0) / ms.length), deaths: G.stats.deaths, battles: G.stats.battles, gold: G.gold });
            }
            if (i % 600 === 0 && !bad) {
                for (const m of Object.values(G.party.members)) { const st = Pt.memberStats(m); if (!(m.hp >= 0 && m.hp <= st.mhp && m.mp >= 0 && m.mp <= st.mmp && Number.isFinite(m.hp))) bad = `${m.id} hp ${m.hp}/${st.mhp} mp ${m.mp}/${st.mmp}`; }
                if (!(G.gold >= 0) || !Number.isFinite(G.px) || !Number.isFinite(G.py)) bad = `gold ${G.gold} pos ${G.px},${G.py}`;
                for (const k of Object.keys(G.inv)) if (!(G.inv[k] >= 0)) bad = `inventory ${k} = ${G.inv[k]}`;
            }
            if (G.mode === 'ending' || G.flags.game_complete) break;
        }
        ok(!bad, `seed ${seed}: invariants hold all game${bad ? ' — ' + bad : ''}`);
        ok(G.mode === 'ending' || G.flags.game_complete, `seed ${seed}: the bot reaches the ending (${Math.round(G.stats.playtime / 60)} min of play, ${((Date.now() - t0) / 1000).toFixed(0)} s real)`);
        ok(Object.keys(G.party.members).length === 8, `seed ${seed}: all eight heroes join (${Object.keys(G.party.members).length})`);
        console.log('\n  beat           min   lv  deaths battles  gold');
        for (const r of table) console.log(`  ${r.beat.padEnd(14)} ${String(r.min).padStart(4)} ${String(r.lv).padStart(4)} ${String(r.deaths).padStart(6)} ${String(r.battles).padStart(7)} ${String(r.gold).padStart(6)}`);
        ok(G.stats.playtime < 3600 * 9, `seed ${seed}: a bot finishes under nine hours (the bot grinds more than a person does)`);
    }
}

console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);
