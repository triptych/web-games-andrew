/**
 * simtest.mjs — headless checks of HOLLOWDEEP's simulation. No browser.
 *
 *   node game-129/dev/simtest.mjs                  # everything (about a minute)
 *   ONLY=purity,data,floors,rules,determinism,bot node game-129/dev/simtest.mjs
 *   SEEDS=8 STEPS=20000 VERBOSE=1 node game-129/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js, js/config.js never touch the DOM, a renderer, storage, Math.random or the clock
 * data         every monster, portrait, icon, texture, backdrop, music track, effect and voice line has its file
 * floors       floors 1–45 over 60 seeds: the down stairs are reachable; on guardian floors the guardian's cell is the
 *              only way to them (sufficient and necessary); every chest, the quest spot and the fountain are reachable
 * rules        battles, rows, statuses, fleeing, levels, the inn, the shop, gear, hiring, the temple, quests, warps
 * determinism  same seed and commands → same game; a save round trip mid-game plays on identically
 * bot          the bot plays SEEDS games of STEPS commands with per-command invariants, at two skills; balance bands
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const STEPS = +(process.env.STEPS || 16000);
const want = (n) => !ONLY.length || ONLY.includes(n);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Dg = await import('../js/sim/dungeon.js');
const Ba = await import('../js/sim/battle.js');
const { STRATA, MONSTERS, isBossFloor } = await import('../js/sim/data/monsters.js');
const { CLASSES, PORTRAITS } = await import('../js/sim/data/classes.js');
const { KINDS, ACCESSORIES, CONSUMABLES, QUEST_ITEMS, itemDef } = await import('../js/sim/data/items.js');
const { NPCS, PLACES, STORY } = await import('../js/sim/data/town.js');
const { VOICES } = await import('../js/voices.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (n) => console.log(`\n== ${n}`);
const drain = (G) => { const e = G.events.splice(0); return e; };
const hero = (G, i) => G.roster.find((c) => c.id === G.party[i]);

// ---------------------------------------------------------------- purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ---------------------------------------------------------------- data and assets
if (want('data')) {
    section('data');
    const has = (p) => fs.existsSync(path.join(ROOT, p));
    for (const id of Object.keys(MONSTERS)) ok(has(`art/mon/${id}.webp`), `sprite for ${id}`);
    for (const s of STRATA) {
        ok(s.monsters.length === 6 && MONSTERS[s.boss]?.boss, `${s.id}: six monsters and a guardian`);
        ok(has(`art/tex/${s.id}-wall.webp`) && has(`art/tex/${s.id}-floor.webp`), `${s.id}: wall and floor textures`);
    }
    for (const p of PORTRAITS) ok(has(`art/por/${p.id}.webp`) && CLASSES[p.cls], `portrait ${p.id}`);
    for (const id of Object.keys(NPCS)) ok(has(`art/por/${id}.webp`), `portrait for ${id}`);
    for (const id of Object.keys(PLACES)) ok(has(`art/bg/${id}.webp`), `backdrop for ${id}`);
    ok(has('art/bg/title.webp') && has('art/icons/gear.webp') && has('art/icons/misc.webp'), 'title art and icon atlases');
    // the Meshy props (js/view/models.js imports three, so read its table as text)
    const modelSrc = fs.readFileSync(path.join(ROOT, 'js/view/models.js'), 'utf8');
    const models = [...modelSrc.matchAll(/^ {4}(\w+): \{ (?:file: '(\w+)', )?fit:/gm)].map((m) => m[2] || m[1]);
    ok(models.length >= 6, `the model table lists the props (${models.length})`);
    for (const id of new Set(models)) ok(has(`art/models/${id}.glb`) && fs.statSync(path.join(ROOT, `art/models/${id}.glb`)).size < 600e3, `model ${id}.glb is there and under 600 KB`);
    for (const c of Object.values(CLASSES)) {
        ok(c.skills.length >= 5, `${c.name} has at least 5 skills`);
        for (const g of c.gear) ok(KINDS[g], `${c.name} gear kind ${g} exists`);
    }
    for (const id of [...Object.keys(KINDS).map((k) => k + '_0'), ...Object.keys(ACCESSORIES), ...Object.keys(CONSUMABLES), ...Object.keys(QUEST_ITEMS)]) {
        const d = itemDef(id);
        ok(d && d.name && Array.isArray(d.icon) && d.icon[1] >= 0 && d.icon[1] < 16, `item ${id} has a name and an icon`);
    }
    for (const q of STORY) {
        ok(NPCS[q.npc] && (!q.need || STORY.some((x) => x.id === q.need)), `story ${q.id}: giver and prerequisite exist`);
        if (q.kind === 'slay') ok(isBossFloor(q.floor), `story ${q.id}: slays a guardian floor`);
        if (q.item) ok(itemDef(q.item), `story ${q.id}: reward item exists`);
        if (q.item_q) ok(QUEST_ITEMS[q.item_q], `story ${q.id}: quest item exists`);
    }
    for (const t of ['title', 'town', 'dungeon-1', 'dungeon-2', 'dungeon-3', 'battle', 'boss', 'victory', 'defeat']) ok(has(`audio/music-${t}.mp3`), `music ${t}`);
    for (const s of ['step', 'bump', 'stairs', 'chest', 'coins', 'hit', 'crit', 'hurt', 'miss', 'fire', 'ice', 'bolt', 'holy', 'dark', 'heal', 'levelup', 'down', 'encounter', 'roar', 'bell', 'warp', 'trap', 'fountain', 'ambience']) ok(has(`audio/sfx-${s}.mp3`), `effect ${s}`);
    let lines = 0;
    for (const [id, v] of Object.entries(VOICES)) for (let i = 0; i < v.lines.length; i++) { lines++; ok(has(`audio/vo/${id}-${i + 1}.mp3`), `voice ${id}-${i + 1}`); }
    for (const p of PORTRAITS) ok(VOICES[p.id]?.lines.length === 4, `hero portrait ${p.id} has four voice lines`);
    for (const id of Object.keys(NPCS)) ok(VOICES[id]?.lines.slice(0, 3).join('|') === NPCS[id].lines.join('|'), `${id}'s voiced lines match the town text`);
    for (const s of STRATA) ok(VOICES[s.boss]?.lines.length === 2, `guardian ${s.boss} has a taunt and a death line`);
    console.log(`  ${Object.keys(MONSTERS).length} monsters, ${lines} voice lines`);
}

// ---------------------------------------------------------------- floors
if (want('floors')) {
    section('floors');
    let bad = 0, n = 0;
    for (let s = 1; s <= 60; s++) {
        for (let f = 1; f <= 45; f++) {
            const F = Dg.makeFloor(s * 104729, f);
            n++;
            const at = (p) => p.y * F.w + p.x;
            const d = Dg.bfs(F, F.start.x, F.start.y);
            let good = d[at(F.down)] > 0;
            for (const c of F.chests) good &&= d[at(c)] > 0;
            if (F.spot) good &&= d[at(F.spot)] > 0;
            if (F.fountain) good &&= d[at(F.fountain)] > 0;
            if (isBossFloor(f)) {
                good &&= !!F.boss;
                const blocked = Dg.bfs(F, F.start.x, F.start.y, (x, y) => x === F.boss.x && y === F.boss.y);
                good &&= blocked[at(F.down)] < 0;                 // necessary: no way round the guardian
                good &&= d[at(F.boss)] > 0;                        // and the guardian itself can be reached
            } else good &&= !F.boss;
            good &&= !(F.start.x === F.down.x && F.start.y === F.down.y);
            if (!good) { bad++; if (bad < 5) console.log('    bad floor', s, f); }
        }
    }
    ok(bad === 0, `${n} floors: stairs, chests, quest spot and fountain reachable; guardians block the only way down (${bad} bad)`);
    const a = Dg.makeFloor(5, 7), b = Dg.makeFloor(5, 7);
    ok(JSON.stringify(Array.from(a.cells)) === JSON.stringify(Array.from(b.cells)), 'a floor is a pure function of (seed, floor)');
    ok(Dg.makeFloor(5, 1).w < Dg.makeFloor(5, 40).w, 'floors grow with depth');
}

// ---------------------------------------------------------------- rules
if (want('rules')) {
    section('rules');
    // town basics
    let G = Gm.newGame(11);
    ok(G.mode === 'town' && G.party.length === 3 && G.recruits.length === 4, 'a new game: three heroes in town, four recruits at the guild');
    const gold0 = G.gold;
    ok(Gm.act(G, { t: 'buy', id: 'potion' }) && G.gold === gold0 - itemDef('potion').price, 'buying costs the price');
    ok(!Gm.act(G, { t: 'buy', id: 'sword_7' }), 'deep stock is not sold before the party has been deep');
    const pi = G.inv.findIndex((e) => e.id === 'potion');
    const before = G.inv[pi].n;
    ok(Gm.act(G, { t: 'sell', inv: pi }) && G.inv[pi].n === before - 1, 'selling one of a stack keeps the rest');
    // equip rules
    G.inv.push({ id: 'heavy_0', plus: 0 });
    const mage = G.roster.find((c) => c.cls === 'mage');
    ok(!Gm.act(G, { t: 'equip', cid: mage.id, inv: G.inv.length - 1 }), 'a mage cannot wear plate');
    const ftr = G.roster.find((c) => c.cls === 'fighter');
    const def0 = Gm.heroStats(ftr).def;
    ok(Gm.act(G, { t: 'equip', cid: ftr.id, inv: G.inv.length - 1 }) && Gm.heroStats(ftr).def > def0, 'a fighter in plate has more defence');
    ok(G.inv.some((e) => e.id === 'light_0'), 'and the old armour goes back to the pack');
    // hiring
    G.gold = 5000;
    const r = G.recruits[0];
    ok(Gm.act(G, { t: 'hire', i: 0 }) && G.roster.includes(r) && G.party.includes(r.id), 'hiring adds to the roster and the party');
    ok(!Gm.act(G, { t: 'party', ids: [1, 2, 3, 4, 5, 6] }), 'a party has at most five');
    // inn
    ftr.hp = 1;
    const gInn = G.gold;
    ok(Gm.act(G, { t: 'rest' }) && ftr.hp === Gm.heroStats(ftr).hp && G.gold < gInn && G.day === 2, 'the inn heals, costs gold and passes a day');
    // temple
    ftr.hp = 0;
    ok(Gm.act(G, { t: 'revive', cid: ftr.id }) && ftr.hp === 1, 'the temple raises the fallen');
    // no money: the stables
    G.gold = 0;
    ftr.hp = 1;
    ok(Gm.act(G, { t: 'rest' }) && ftr.hp === Math.ceil(Gm.heroStats(ftr).hp / 2) && G.gold === 0, 'with no gold the stables still give back half (no softlock)');

    // entering, moving, stairs
    G = Gm.newGame(12);
    ok(Gm.act(G, { t: 'enter', floor: 1 }) && G.mode === 'dungeon' && G.floor === 1, 'the gate opens on floor 1');
    ok(!Gm.act(G, { t: 'enter', floor: 6 }), 'nothing to enter while in the dungeon');
    const F = Dg.getFloor(G.seed, 1);
    ok(G.pos.x === F.start.x && G.pos.y === F.start.y, 'the party arrives on the up stairs');
    const d0 = G.pos.d;
    Gm.act(G, { t: 'turn', d: 1 });
    ok(G.pos.d === (d0 + 1) % 4, 'turning right changes the facing');
    Gm.act(G, { t: 'turn', d: -1 });
    const fwd = { x: G.pos.x + Dg.DX[G.pos.d], y: G.pos.y + Dg.DY[G.pos.d] };
    ok(Dg.open(F, fwd.x, fwd.y), 'the party starts facing an open corridor');
    ok(Gm.act(G, { t: 'move', dir: 'f' }) && G.pos.x === fwd.x && G.pos.y === fwd.y, 'moving forward steps one cell');
    Gm.act(G, { t: 'move', dir: 'b' });
    ok(G.pos.x === F.start.x && G.pos.y === F.start.y, 'moving back steps back');
    // into a wall
    let bumped = false;
    for (let k = 0; k < 4 && !bumped; k++) { const e = drain(G); Gm.act(G, { t: 'turn', d: 1 }); drain(G); if (!Dg.open(F, G.pos.x + Dg.DX[G.pos.d], G.pos.y + Dg.DY[G.pos.d])) { Gm.act(G, { t: 'move', dir: 'f' }); bumped = G.events.some((e2) => e2.type === 'bump'); } void e; }
    ok(bumped, 'walking into a wall bumps and goes nowhere');
    ok(Gm.act(G, { t: 'stairs' }) && G.mode === 'town', 'the up stairs on floor 1 lead to town');

    // descending and the deepest floor
    G = Gm.newGame(13);
    Gm.act(G, { t: 'enter', floor: 1 });
    const F1 = Dg.getFloor(G.seed, 1);
    G.pos = { x: F1.down.x, y: F1.down.y, d: 0 };
    ok(Gm.act(G, { t: 'stairs' }) && G.floor === 2 && G.deepest === 2, 'the down stairs lead to the next floor');
    ok(Gm.act(G, { t: 'stairs' }) && G.floor === 1, 'and its up stairs lead back');
    const F1b = Dg.getFloor(G.seed, 1);
    ok(G.pos.x === F1b.down.x && G.pos.y === F1b.down.y, 'arriving on the down stairs of the floor above');

    // encounters happen
    G = Gm.newGame(14);
    Gm.act(G, { t: 'enter', floor: 1 });
    let fights = 0;
    for (let i = 0; i < 600 && !fights; i++) {
        if (!Gm.act(G, { t: 'move', dir: 'f' })) Gm.act(G, { t: 'turn', d: G.rng() < 0.5 ? 1 : -1 });
        if (G.mode === 'battle') fights++;
        drain(G);
    }
    ok(fights > 0 && G.battle && G.battle.foes.length >= 1 && G.battle.foes.length <= C.MAX_ENEMIES, 'walking the floor meets monsters (1 to 5)');

    // a battle by hand
    const B = G.battle;
    ok(B.phase === 'input' && B.order.length === 3, 'every able hero gives a command');
    ok(!Gm.act(G, { t: 'move', dir: 'f' }), 'no walking in a battle');
    const tgt = B.foes[0];
    const hp0 = tgt.hp;
    tgt.hp = 9999; tgt.mhp = 9999;
    Gm.act(G, { t: 'cmd', a: 'attack', target: tgt.uid });
    ok(B.cursor === 1, 'a command moves to the next hero');
    ok(Gm.act(G, { t: 'back' }) && B.cursor === 0, 'back undoes the last command');
    Gm.act(G, { t: 'cmd', a: 'attack', target: tgt.uid });
    Gm.act(G, { t: 'cmd', a: 'defend' });
    Gm.act(G, { t: 'cmd', a: 'defend' });
    const ev = drain(G);
    ok(ev.some((e) => e.type === 'act' && e.kind === 'attack' && e.src.startsWith('h')), 'the round resolves: heroes act');
    ok(tgt.hp < 9999 || ev.some((e) => e.type === 'miss'), 'an attack hurts or misses');
    void hp0;

    const { monsterAt } = await import('../js/sim/stats.js');
    // back row takes less from physical attacks
    let tot = { front: 0, back: 0 };
    for (let i = 0; i < 200; i++) {
        const g = Gm.newGame(15);
        g.mode = 'dungeon'; g.floor = 3;
        g.party.push(...g.recruits.splice(0, 2).map((c) => { g.roster.push(c); return c.id; }));
        Ba.startBattle(g, 'random');
        g.battle.foes = [{ uid: 'e0', ...monsterAt('skeleton', 3), st: {}, alive: true }];
        g.battle.foes[0].mhp = g.battle.foes[0].hp = 99999;
        g.battle.foes[0].acts = [];
        for (const c of Ba.party(g)) { c.hp = 99999; }
        for (const id of g.battle.order) Gm.act(g, { t: 'cmd', a: 'defend' });
        for (const e of g.events) if (e.type === 'hit' && e.tgt.startsWith('h')) {
            const idx = g.party.indexOf(+e.tgt.slice(1));
            tot[idx < C.FRONT ? 'front' : 'back'] += 1;
        }
    }
    ok(tot.front > tot.back * 1.5, `monsters aim at the front row more often (${tot.front} front, ${tot.back} back)`);

    // weakness, holy vs undead
    {
        const g = Gm.newGame(16);
        g.mode = 'dungeon'; g.floor = 3;
        Ba.startBattle(g, 'random');
        const sk = { uid: 'e0', ...monsterAt('skeleton', 3), st: {}, alive: true };
        sk.hp = sk.mhp = 99999; sk.acts = []; sk.atk = 1; sk.mag = 1;
        g.battle.foes = [sk];
        const pr = g.roster.find((c) => c.cls === 'priest');
        pr.lv = 5; pr.mp = 99;
        const mg = g.roster.find((c) => c.cls === 'mage');
        mg.lv = 5; mg.mp = 99;
        Ba.startBattle(g, 'random'); g.battle.foes = [sk];
        drain(g);
        for (const id of g.battle.order) {
            const c = g.roster.find((x) => x.id === id);
            if (c.cls === 'priest') Gm.act(g, { t: 'cmd', a: 'skill', skill: 'turn_undead' });
            else if (c.cls === 'mage') Gm.act(g, { t: 'cmd', a: 'skill', skill: 'fire', target: 'e0' });
            else Gm.act(g, { t: 'cmd', a: 'defend' });
        }
        const hits = g.events.filter((e) => e.type === 'hit' && e.tgt === 'e0');
        ok(hits.some((e) => e.el === 'holy' && e.weak), 'holy light burns the undead (counts as a weakness)');
        ok(hits.some((e) => e.el === 'fire'), 'a firebolt lands');
    }

    // fleeing: never from a guardian
    {
        const g = Gm.newGame(17);
        g.mode = 'dungeon'; g.floor = 5; g.deepest = 5;
        Ba.startBattle(g, 'boss');
        ok(g.battle.foes[0].boss, 'a guardian fight has the stratum guardian');
        ok(!Gm.act(g, { t: 'flee' }) && g.mode === 'battle', 'there is no running from a guardian');
    }
    // poison ticks at round end
    {
        const g = Gm.newGame(18);
        g.mode = 'dungeon'; g.floor = 1;
        Ba.startBattle(g, 'random');
        for (const f of g.battle.foes) { f.atk = 0; f.mag = 0; f.acts = []; f.hp = f.mhp = 99999; }
        const c = hero(g, 0);
        c.st.poison = true;
        const h = c.hp;
        for (const id of g.battle.order) Gm.act(g, { t: 'cmd', a: 'defend' });
        ok(g.events.some((e) => e.type === 'dot' && e.tgt === 'h' + c.id) && c.hp < h, 'poison bites at the end of a round');
    }
    // a win pays xp and gold, and a level comes with it
    {
        const g = Gm.newGame(19);
        g.mode = 'dungeon'; g.floor = 1;
        Ba.startBattle(g, 'random');
        for (const f of g.battle.foes) { f.hp = 1; f.mhp = 1; f.xp = 500; f.gold = 50; }
        const gold = g.gold;
        let n = 0;
        while (g.mode === 'battle' && n++ < 20) Gm.act(g, { t: 'auto' });
        ok(g.mode === 'dungeon' && g.gold > gold, 'winning pays gold');
        ok(g.events.some((e) => e.type === 'levelup') && hero(g, 0).lv > 1, 'and experience raises levels');
        ok(g.events.some((e) => e.type === 'levelup' && e.learned.length), 'a level can teach a skill');
    }
    // a wipe carries the party home and costs gold
    {
        const g = Gm.newGame(20);
        g.mode = 'dungeon'; g.floor = 1; g.gold = 1000;
        Ba.startBattle(g, 'random');
        for (const f of g.battle.foes) { f.atk = 9999; f.spd = 999; f.hp = f.mhp = 99999; }
        let n = 0;
        while (g.mode === 'battle' && n++ < 30) Gm.act(g, { t: 'auto' });
        ok(g.mode === 'town' && g.events.some((e) => e.type === 'rescue_party'), 'a wiped party is carried back to town');
        ok(g.gold === 1000 - Math.floor(1000 * C.WIPE_GOLD_LOSS), 'and loses part of its gold');
        ok(Gm.act(g, { t: 'revive', cid: g.party[0] }) && g.gold === 1000 - Math.floor(1000 * C.WIPE_GOLD_LOSS), 'the Dawn raises the first of a broken party for free');
    }
    // the guardian and the warp stone
    {
        const g = Gm.newGame(21);
        g.mode = 'dungeon'; g.floor = 5; g.deepest = 5;
        Ba.startBattle(g, 'boss');
        g.battle.foes[0].hp = 1;
        let n = 0;
        while (g.mode === 'battle' && n++ < 20) Gm.act(g, { t: 'auto' });
        ok(g.bossDown[5] && g.warps.includes(6), 'beating a guardian lights the warp stone to the floor below');
        ok(g.events.some((e) => e.type === 'warp' && e.floor === 6), 'and says so');
        g.mode = 'town';
        ok(Gm.act(g, { t: 'enter', floor: 6 }) && g.floor === 6, 'the gate can send the party straight to floor 6');
        const F5 = Dg.getFloor(g.seed, 5);
        g.floor = 5; g.pos = { x: F5.boss.x, y: F5.boss.y, d: 0 };
        ok(Gm.tileAt(g, F5.boss.x, F5.boss.y) === 'floor', 'a beaten guardian is gone from its cell');
    }
    // stepping into the guardian's cell starts the fight
    {
        const g = Gm.newGame(22);
        Gm.act(g, { t: 'enter', floor: 1 });
        g.floor = 5; g.deepest = 5;
        const F5 = Dg.getFloor(g.seed, 5);
        // stand next to the guardian, facing it
        let from = null;
        for (let k = 0; k < 4; k++) { const x = F5.boss.x - Dg.DX[k], y = F5.boss.y - Dg.DY[k]; if (Dg.open(F5, x, y) && !(x === F5.down.x && y === F5.down.y)) from = { x, y, d: k }; }
        g.pos = from; g.danger = 0; g.steps = 0;
        Gm.act(g, { t: 'move', dir: 'f' });
        ok(g.mode === 'battle' && g.battle.kind === 'boss', 'walking into the guardian starts the guardian fight');
    }
    // chests open once and pay
    {
        const g = Gm.newGame(23);
        Gm.act(g, { t: 'enter', floor: 1 });
        const F1 = Dg.getFloor(g.seed, 1);
        const c = F1.chests[0];
        let from = null;
        for (let k = 0; k < 4; k++) { const x = c.x - Dg.DX[k], y = c.y - Dg.DY[k]; if (Dg.open(F1, x, y)) from = { x, y, d: k }; }
        g.pos = from; g.steps = 0;
        const gold = g.gold, inv = JSON.stringify(g.inv);
        Gm.act(g, { t: 'move', dir: 'f' });
        ok(g.events.some((e) => e.type === 'chest') && (g.gold > gold || JSON.stringify(g.inv) !== inv), 'a chest opens and gives something');
        ok(Gm.tileAt(g, c.x, c.y) === 'chest_open', 'and stays open');
    }
    // quests: story slay, hunt, fetch, rescue
    {
        const g = Gm.newGame(24);
        ok(Gm.storyFor(g, 'ansel')?.id === 's_knight', 'Old Ansel offers the first story quest');
        ok(Gm.act(g, { t: 'take', qid: 's_knight' }) && g.quests.active.some((q) => q.id === 's_knight'), 'it can be taken');
        ok(!Gm.act(g, { t: 'turnin', qid: 's_knight' }), 'and not turned in before it is done');
        g.bossDown[5] = true;
        const gold = g.gold;
        ok(Gm.act(g, { t: 'turnin', qid: 's_knight' }) && g.gold === gold + 300 && g.inv.some((e) => e.id === 'vigor_ring'), 'beating the guardian completes it: gold and the ring');
        ok(Gm.storyFor(g, 'elowen')?.id === 's_moon', 'and the next story quest opens');
        // a hunt bounty counts kills
        const b = { id: 'bx', kind: 'hunt', title: 't', text: 't', npc: 'pell', target: 'bone_rat', count: 2, have: 0, gold: 10, xp: 10, floor: 1 };
        g.quests.active.push(b);
        g.lastBattle = null;
        g.mode = 'dungeon'; g.floor = 1;
        Ba.startBattle(g, 'random');
        g.battle.foes = [{ uid: 'e0', ...monsterAt('bone_rat', 1), st: {}, alive: true }, { uid: 'e1', ...monsterAt('bone_rat', 1), st: {}, alive: true }];
        for (const f of g.battle.foes) { f.hp = f.mhp = 1; }
        let n = 0;
        while (g.mode === 'battle' && n++ < 20) Gm.act(g, { t: 'auto' });
        ok(b.have === 2 && Gm.isComplete(g, b), 'a hunt counts the monsters killed');
        // fetch: the glint at the quest spot
        const g2 = Gm.newGame(25);
        g2.deepest = 3;
        Gm.act(g2, { t: 'take', qid: 's_locket' });
        Gm.act(g2, { t: 'enter', floor: 1 });
        g2.floor = 3;
        const F3 = Dg.getFloor(g2.seed, 3);
        ok(Gm.tileAt(g2, F3.spot.x, F3.spot.y) === 'glint', 'the locket glints at the quest spot on floor 3');
        let from = null;
        for (let k = 0; k < 4; k++) { const x = F3.spot.x - Dg.DX[k], y = F3.spot.y - Dg.DY[k]; if (Dg.open(F3, x, y)) from = { x, y, d: k }; }
        g2.pos = from; g2.steps = 0;
        Gm.act(g2, { t: 'move', dir: 'f' });
        ok(g2.inv.some((e) => e.id === 'locket') && Gm.tileAt(g2, F3.spot.x, F3.spot.y) === 'floor', 'stepping on it picks it up');
        g2.mode = 'town';
        ok(Gm.act(g2, { t: 'turnin', qid: 's_locket' }) && !g2.inv.some((e) => e.id === 'locket'), 'Marta takes the locket and pays');
        // rescue: the delver joins
        const g3 = Gm.newGame(26);
        g3.quests.active.push({ id: 'r1', kind: 'rescue', title: 'Find Wren', text: '', npc: 'pell', floor: 2, who: 'Wren', gold: 50, xp: 50 });
        Gm.act(g3, { t: 'enter', floor: 1 });
        g3.floor = 2;
        const F2 = Dg.getFloor(g3.seed, 2);
        ok(Gm.tileAt(g3, F2.spot.x, F2.spot.y) === 'delver', 'the lost delver waits at the quest spot');
        from = null;
        for (let k = 0; k < 4; k++) { const x = F2.spot.x - Dg.DX[k], y = F2.spot.y - Dg.DY[k]; if (Dg.open(F2, x, y)) from = { x, y, d: k }; }
        g3.pos = from; g3.steps = 0;
        const nRoster = g3.roster.length;
        Gm.act(g3, { t: 'move', dir: 'f' });
        ok(g3.roster.length === nRoster + 1 && g3.roster.some((c) => c.name === 'Wren'), 'finding them adds them to the guild roster for free');
    }
    // the reaper hunts
    {
        let seen = 0, moved = 0;
        for (let s = 1; s <= 30 && !moved; s++) {
            const g = Gm.newGame(s);
            g.mode = 'dungeon';
            for (let f = 6; f <= 15; f++) {
                const F6 = Dg.getFloor(g.seed, f);
                if (!F6.reaper) continue;
                seen++;
                g.floor = f;
                Gm.floorState(g, f).reaper = { ...F6.reaper };
                // stand within sight and step
                const d = Dg.bfs(F6, F6.reaper.x, F6.reaper.y);
                let cell = -1;
                for (let i = 0; i < d.length; i++) if (d[i] >= 3 && d[i] <= 4) { cell = i; break; }
                if (cell < 0) continue;
                g.pos = { x: cell % F6.w, y: (cell / F6.w) | 0, d: 0 };
                g.steps = 0; g.danger = -99;
                const r0 = { ...Gm.floorState(g, f).reaper };
                for (let k = 0; k < 4; k++) { g.pos.d = k; if (Gm.act(g, { t: 'move', dir: 'f' })) break; }
                const r1 = Gm.floorState(g, f).reaper;
                if (r1 && (r1.x !== r0.x || r1.y !== r0.y)) moved++;
                break;
            }
        }
        ok(seen > 0 && moved > 0, 'the Lantern Reaper roams deeper floors and closes in on the party');
    }
}

// ---------------------------------------------------------------- determinism and saves
if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); for (let i = 0; i < n; i++) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; } return G; };
    ok(JSON.stringify(Gm.serialize(play(42, 3000))) === JSON.stringify(Gm.serialize(play(42, 3000))), 'same seed and commands, same game');
    const G = play(7, 2500);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 99 }), b2 = Bt.makeBot({ seed: 99 });
    for (let i = 0; i < 2500; i++) { Gm.act(G, Bt.botCommand(G, b1)); Gm.act(copy, Bt.botCommand(copy, b2)); G.events.length = 0; copy.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    // mid-battle save
    let g = play(8, 400);
    let guard = 0;
    while (g.mode !== 'battle' && guard++ < 5000) { Gm.act(g, Bt.botCommand(g, Bt.makeBot({ seed: guard }))); g.events.length = 0; }
    ok(g.mode === 'battle', 'found a battle to save in');
    const gc = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(g))));
    Gm.act(g, { t: 'auto' }); Gm.act(gc, { t: 'auto' });
    ok(JSON.stringify(Gm.serialize(g)) === JSON.stringify(Gm.serialize(gc)), 'a save in the middle of a battle resumes identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(JSON.stringify(Gm.serialize(play(9, 6000))).length < 60000, 'a save stays small (no maps in it)');
}

// ---------------------------------------------------------------- bot and balance
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const [label, opts] of [['careful', { skill: 1, dare: 1 }], ['reckless', { skill: 0.4, dare: 0.7, nerve: 0.2 }]]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ seed: s, ...opts });
            let bad = null, denied = 0, b5 = null;
            for (let i = 0; i < STEPS && !bad; i++) {
                const cmd = Bt.botCommand(G, bot);
                if (!Gm.act(G, cmd)) denied++;
                G.events.length = 0;
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = 'gold went bad';
                for (const c of G.roster) {
                    const st = Gm.heroStats(c);
                    if (!Number.isFinite(c.hp) || c.hp < 0 || c.hp > st.hp || c.mp < 0 || c.mp > st.mp) bad = `${c.name} hp/mp out of range (${c.hp}/${st.hp}, ${c.mp}/${st.mp})`;
                }
                if (G.mode === 'battle' && G.battle.foes.some((f) => !Number.isFinite(f.hp))) bad = 'a foe has NaN hp';
                if (G.bossDown[5] && b5 === null) b5 = G.stats.battles;
            }
            ok(!bad, `${label} seed ${s}: ${bad || 'invariants hold'}`);
            ok(denied < STEPS * 0.02, `${label} seed ${s}: the bot's commands are almost all legal (${denied} refused)`);
            const lv = Math.round(G.party.map((id) => G.roster.find((c) => c.id === id).lv).reduce((a, b) => a + b, 0) / Math.max(1, G.party.length));
            rows.push({ label, seed: s, deepest: G.deepest, lv, wipes: G.stats.wipes, battles: G.stats.battles, boss5: b5, quests: G.quests.done.length, gold: G.gold });
        }
    }
    console.table(rows);
    const of = (l) => rows.filter((r) => r.label === l);
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    ok(of('careful').every((r) => r.boss5 !== null), 'a careful party always beats the first guardian');
    ok(med(of('careful').map((r) => r.deepest)) >= 15, `a careful party gets to floor 15 or deeper (median ${med(of('careful').map((r) => r.deepest))})`);
    ok(med(of('careful').map((r) => r.wipes)) <= 4, `a careful party rarely wipes (median ${med(of('careful').map((r) => r.wipes))})`);
    ok(of('reckless').reduce((a, r) => a + r.wipes, 0) > of('careful').reduce((a, r) => a + r.wipes, 0), 'a reckless, sloppy party (dives early, fights on hurt) wipes more often than a careful one');
    ok(of('careful').every((r) => r.quests >= 3), 'quests get done along the way');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
