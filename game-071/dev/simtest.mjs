/**
 * simtest.mjs — headless checks of the simulation, in Node (no browser, no three.js).
 *
 *   node game-071/dev/simtest.mjs
 *
 * 1. Purity: nothing in js/sim imports three.js or touches the DOM.
 * 2. Data: every item, template, NPC and location a quest names exists.
 * 3. Dungeons: every dungeon level generates, every room is reachable from the entry.
 * 4. The main story: all eleven quests driven start to finish (fights resolved by script),
 *    including the prologue's doors and both endings of the chained-dragon choice.
 * 5. Systems: combat kills, sigils spend charge, embers grow it, crafting, alchemy,
 *    the law (assault → bounty → arrest → fine), fast travel, save → load round trip.
 * Fails loudly on any exception, NaN position, or broken expectation.
 */
globalThis.location = { search: '' };
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false });
const mem = new Map();
globalThis.localStorage = new Proxy({}, {
    get: (t, k) => ({ getItem: (x) => (mem.has(x) ? mem.get(x) : null), setItem: (x, v) => mem.set(x, String(v)), removeItem: (x) => mem.delete(x) })[k],
    ownKeys: () => [...mem.keys()],
    getOwnPropertyDescriptor: (t, k) => (mem.has(k) ? { enumerable: true, configurable: true, value: mem.get(k) } : undefined),
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.join(HERE, '../js/sim');
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const section = (s) => console.log(`\n== ${s}`);

// ------------------------------------------------------------------ 1. purity
section('purity');
for (const f of fs.readdirSync(SIM)) {
    const src = fs.readFileSync(path.join(SIM, f), 'utf8');
    ok(!/from ['"]three/.test(src), `${f} imports three`);
    ok(!/\b(document|window)\.[a-zA-Z]|localStorage/.test(src), `${f} touches the DOM`);
}

const { World } = await import('../js/sim/world.js');
const { LOC, LOCATIONS } = await import('../js/sim/geography.js');
const { ITEMS } = await import('../js/sim/items.js');
const { TEMPLATES, NPC } = await import('../js/sim/actors.js');
const { QUESTS } = await import('../js/sim/quests.js');
const { applyDamage } = await import('../js/sim/actor.js');
const { addItem, equip, countItem } = await import('../js/sim/inventory.js');
const { STATION_RECIPES, make, canMake } = await import('../js/sim/crafting.js');
const { serialize, applySave, Saves } = await import('../js/save.js');
const { optionsFor } = await import('../js/sim/dialogue.js');

// ------------------------------------------------------------------ 2. data
section('quest data');
{
    const src = fs.readFileSync(path.join(SIM, 'quests.js'), 'utf8');
    const items = new Set([...src.matchAll(/(?:give|take|has)\(w, '([a-z_0-9]+)'/g)].map((m) => m[1]));
    for (const id of items) ok(ITEMS[id], `quest item ${id}`);
    const tpls = new Set([...src.matchAll(/(?:spawn|spawnDragon)\('([a-z_]+)'/g)].map((m) => m[1]));
    for (const t of tpls) ok(TEMPLATES[t], `template ${t}`);
    const npcs = new Set([...src.matchAll(/(?:talk\(|giver: |npc: )'([a-z_]+)'/g)].map((m) => m[1]).filter((n) => n !== 'thurnvaal'));
    for (const n of npcs) ok(NPC[n], `npc ${n}`);
    const locs = new Set([...src.matchAll(/loc: '([a-z_]+)'|LOC\.([a-z_]+)|nearLoc\(w, '([a-z_]+)'/g)].map((m) => m[1] || m[2] || m[3]));
    for (const l of locs) ok(LOC[l], `location ${l}`);
    console.log(`  ${Object.keys(QUESTS).length} quests, ${items.size} items, ${npcs.size} NPCs checked`);
}

const t0 = Date.now();
const w = new World({ seed: 11 });
console.log(`  world built in ${Date.now() - t0} ms`);
const pristine = serialize(w);
const p = w.player;
p.invulnerable = true;
const step = (secs) => { for (let i = 0; i < secs * 30; i++) { w.tick(1 / 30, null); checkFinite(); } return w.drain(); };
function checkFinite() {
    for (const a of w.actors) if (!Number.isFinite(a.pos.x) || !Number.isFinite(a.pos.y) || !Number.isFinite(a.pos.z)) { ok(false, `NaN position on ${a.name}`); a.pos.x = a.pos.z = 0; a.pos.y = 0; }
}
const talkTo = (id, idx = 0) => { const a = w.pop.npc(id); const t = w.quests.topicsFor(a).filter((x) => !x.offer)[idx]; ok(t, `topic with ${id}`); t?.action(); step(0.2); return t; };
const goTo = (loc, dx = 0, dz = 0) => { if (w.cellId !== 'ext') w.exitToExt(null); w.placePlayer(LOC[loc].x + dx, LOC[loc].z + dz, 0); step(1); };

// ------------------------------------------------------------------ 3. dungeons
section('dungeons');
{
    let cells = 0, rooms = 0;
    for (const L of LOCATIONS.filter((x) => x.dungeon)) {
        for (let lv = 0; lv < (L.dungeon.levels || 1); lv++) {
            const c = w.interiors.get(`${L.id}:d${lv}`);
            cells++;
            const start = c.tileAt(c.entry.x, c.entry.z);
            for (const r of c.rooms) {
                rooms++;
                const path_ = c.path(c.entry, { x: (r.x + r.w / 2) * c.ts, z: (r.z + r.h / 2) * c.ts });
                ok(path_ && path_.length >= 0, `${c.id}: room at ${r.x},${r.z} unreachable from ${start}`);
            }
            ok(c.usables.some((u) => u.kind === 'door'), `${c.id} has a door`);
        }
    }
    // a line that ends inside a wall is blocked, even when the wall is close (third-person camera)
    {
        const c = w.interiors.get('undercroft:d0');
        const [tx, tz] = c.tileAt(c.entry.x, c.entry.z);
        let wall = null;
        for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!c.isFloor(tx + dx, tz + dz)) { wall = [dx, dz]; break; }
        ok(wall, 'the undercroft entry backs onto a wall');
        if (wall) {
            const e = c.center(tx, tz), y = c.floorAt(e.x, e.z) + 1.6;
            ok(c.blockedRay(e.x, y, e.z, e.x + wall[0] * c.ts * 0.58, y, e.z + wall[1] * c.ts * 0.58), 'a ray ending just inside the wall is blocked');
            ok(!c.blockedRay(e.x, y, e.z, e.x + wall[0] * c.ts * 0.3, y, e.z + wall[1] * c.ts * 0.3), 'a ray inside the room is clear');
        }
    }
    const eye = w.interiors.get('eye');
    ok(eye.open && eye.rooms.length === 6, 'the Eye arena');
    console.log(`  ${cells} dungeon levels, ${rooms} rooms`);
}

// ------------------------------------------------------------------ 4. the main story
section('main quest');
{
    const Q = w.quests;
    Q.start('mq01');
    goTo('hollowmere', 0, -40);
    step(25);
    ok(w.flags.scar, 'struck by the storm');
    ok(Q.state.mq01.step === 2, `mq01 at the keep door (${Q.state.mq01.step})`);
    w.travelDoor(w.settlements.doors.find((d) => d.to === 'hollowmere:keep')); step(1);
    const sword = addItem(p, { id: 'iron_sword' }); equip(p, sword); step(1);
    w.travelDoor(w.space.usables.find((u) => u.door?.to === 'undercroft:d0').door); step(1);
    w.travelDoor(w.space.usables.find((u) => u.kind === 'door' && u.door.to === 'ext').door); step(2);
    ok(Q.done('mq01') && w.flags.prologueDone, 'prologue complete');
    addItem(p, { id: 'sealed_letter' });
    talkTo('ragna'); talkTo('warden_sigrun');
    ok(Q.done('mq02'), 'mq02');
    talkTo('ivo');
    w.travelDoor(w.settlements.doors.find((d) => d.to === 'coldmarrow:d0' || (d.loc === 'coldmarrow' && d.interior === 'dungeon'))); step(1);
    ok(p.inv.some((e) => e.id === 'star_chart') || w.actors.some((a) => a.name === 'Treasure Hunter'), 'treasure hunter in Coldmarrow');
    addItem(p, { id: 'lodestone' }); step(1);
    talkTo('ivo');
    ok(Q.done('mq03'), 'mq03');
    goTo('greywatch', 0, 20); step(2);
    const d1 = w.byId(Q.state.mq04.vars.dragon);
    ok(d1 && d1.rig === 'dragon', 'Greywatch dragon');
    const emb0 = p.storm.chargeMax;
    w.kill(d1, p); step(1);
    ok(p.storm.chargeMax > emb0, 'ember absorbed');
    talkTo('warden_sigrun');
    ok(Q.done('mq04') && w.flags.dragonsReturn, 'mq04');
    goTo('highcairn'); step(1);
    talkTo('ostvald');
    for (const [i, c] of Q.cairnPositions().entries()) { w.placePlayer(c.x, c.z + 1.5, 0); step(0.5); const u = w.extUsables(p.pos, 5).find((x) => x.kind === 'cairn'); ok(u, `cairn ${i} usable`); if (u) Q.use(u); }
    step(1);
    talkTo('ostvald');
    ok(Q.done('mq05'), 'mq05');
    talkTo('sela');
    goTo('kalrstead', 0, 40); step(2);
    const sah = w.actors.find((a) => a.name === 'Sahlrok');
    ok(sah, 'Sahlrok rises');
    if (sah) w.kill(sah, p);
    step(1);
    talkTo('sela');
    ok(Q.done('mq06'), 'mq06');
    addItem(p, { id: 'chronicle' }); step(1);
    w.useItem(p.inv.find((e) => e.id === 'chronicle'));
    w.emit('bookRead', { id: 'chronicle' }); step(1);
    talkTo('ostvald');
    ok(Q.done('mq07') && p.storm.rings.earthbind >= 1, 'mq07');
    addItem(p, { id: 'orrery_core' }); step(1);
    w.travelDoor({ to: `deepforge:d${(LOC.deepforge.dungeon.levels || 1) - 1}` }); step(1);
    const orr = w.space.usables.find((u) => u.kind === 'orrery');
    ok(orr, 'the great orrery');
    if (orr) Q.use(orr);
    step(1);
    ok(Q.done('mq08') && p.storm.rings.earthbind >= 2, 'mq08');
    goTo('summit', -10, 0); step(2);
    const th = w.actors.find((a) => a.tpl === 'thurnvaal');
    ok(th?.chained && th.talkable, 'Thurnvaal chained');
    const branch = serialize(w);
    w.quests.topicsFor(th)[0].action(); step(8);
    const vy = w.byId(Q.state.mq09.vars.vid);
    ok(vy, 'Vyrthax arrives at the summit');
    vy.invulnerable = false; vy.hp = vy.hpMax * 0.5; step(1);
    ok(Q.done('mq09') && w.flags.thurnvaalFreed && p.storm.rings.earthbind === 3, 'mq09 (free him)');
    talkTo('warden_sigrun');
    w.travelDoor({ to: 'vahlokar:d0' }); step(1);
    const braz = w.space.usables.filter((u) => u.kind === 'ember_brazier');
    ok(braz.length >= 2, `braziers on level 0 (${braz.length})`);
    for (const b of braz) Q.use(b);
    w.travelDoor({ to: `vahlokar:d${(LOC.vahlokar.dungeon.levels || 1) - 1}` }); step(1);
    for (const b of w.space.usables.filter((u) => u.kind === 'ember_brazier')) Q.use(b);
    step(1);
    const hier = w.actors.find((a) => a.tpl === 'hierophant') || w.spawn('hierophant', p.pos.x + 3, p.pos.z);
    w.kill(hier, p); step(1);
    addItem(p, { id: 'hierophant_crown' }); step(1);
    const stair = w.space.usables.find((u) => u.kind === 'eyestair');
    ok(stair, 'the stair to the Eye');
    const evs = []; if (stair) Q.use(stair); for (const e of w.drain()) evs.push(e);
    const door = evs.find((e) => e.type === 'useDoor');
    ok(door, 'the stair opens');
    if (door) w.travelDoor(door.door);
    step(4);
    ok(Q.active('mq11'), 'mq11');
    const vy2 = w.byId(Q.state.mq11.vars.vid);
    ok(vy2 && !vy2.essential, 'Vyrthax in the Eye');
    ok(w.actors.some((a) => a.tpl === 'thurnvaal' && a.faction === 'player'), 'Thurnvaal fights beside you');
    step(4);
    if (vy2) w.kill(vy2, p);
    step(1);
    ok(w.flags.gameComplete, 'the game is won');
    ok(!w.space.usables.find((u) => u.eyeExit).hidden, 'the way home opens');
    // the other choice at the summit
    applySave(w, branch); step(1);
    const th2 = w.actors.find((a) => a.tpl === 'thurnvaal');
    w.quests.topicsFor(th2)[1].action(); step(1);
    ok(!th2.chained && th2.faction === 'dragon', 'Thurnvaal turns on you');
    w.kill(th2, p); step(8);
    ok(p.storm.rings.earthbind === 3, 'Anchor taken from his chains');
    const vy3 = w.byId(w.quests.state.mq09.vars.vid);
    ok(vy3, 'Vyrthax arrives after the fight');
}

// ------------------------------------------------------------------ 5. systems
section('systems');
{
    applySave(w, pristine); step(0.5);
    w.flags.prologueDone = true;
    goTo('brightwater', 5, 5); step(2);
    // combat
    const wolf = w.spawn('wolf', p.pos.x + 2, p.pos.z);
    let n = 0; while (!wolf.dead && n++ < 60) applyDamage(w, wolf, { amount: 10, type: 'phys', source: p });
    ok(wolf.dead, 'wolf killed');
    // coins in loot never get stuck in a container (a "take all" used to spin forever on them)
    {
        const c = w.container('test:gold', 'boss', { inv: null, level: 5 });
        ok(!c.inv.some((e) => e.id === 'gold'), 'container coins are a purse, not an item');
        const box = { inv: [{ id: 'gold', n: 7 }, { id: 'torch', n: 1 }], gold: 0 };
        const { removeItem } = await import('../js/sim/inventory.js');
        ok(removeItem(box, box.inv[0], 7) === 7 && !box.inv.some((e) => e.id === 'gold'), 'a gold entry in a list can be removed');
    }
    // rapid taps: every tap during a swing is queued, none are lost
    {
        const sw = addItem(p, { id: 'iron_sword' }); equip(p, sw); p.act = { kind: 'idle', t: 0 }; p.dirty = true;
        const blank = () => ({ move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: new Set(), pressed: new Set(), released: new Set() });
        let swings = 0, taps = 0;
        for (let i = 0; i < 60 * 4; i++) {   // 4 s at 60 Hz, a tap (down one tick, up the next) every 0.3 s
            const inp = blank();
            if (i % 18 === 0) { inp.pressed.add('attack'); inp.held.add('attack'); taps++; }
            if (i % 18 === 1) inp.released.add('attack');
            w.tick(1 / 60, inp);
            swings += w.drain().filter((e) => e.type === 'swing' && e.actor === p).length;
        }
        ok(swings >= 6 && swings <= taps, `rapid taps swing (${swings} swings from ${taps} taps)`);
        ok(swings === 0 || !p.act.power, 'taps stay light attacks');
        console.log(`  ${swings} swings from ${taps} rapid taps`);
        for (let i = 0; i < 90; i++) w.tick(1 / 60, null);
        w.drain();
    }
    // sigils
    p.storm.rings.gale = 1; p.storm.equipped = 'gale'; p.storm.charge = p.storm.chargeMax;
    const c0 = p.storm.charge;
    const { startSigil, releaseSigil } = await import('../js/sim/combat.js');
    startSigil(w, p); for (let i = 0; i < 10; i++) w.tick(1 / 30, null); releaseSigil(w, p); step(1);
    ok(p.storm.charge < c0, `sigil spends charge (${c0.toFixed(0)} → ${p.storm.charge.toFixed(0)})`);
    // crafting
    addItem(p, { id: 'ingot_iron' }, 4); addItem(p, { id: 'leather_strips' }, 4);
    const r = STATION_RECIPES.forge.find((x) => x.out === 'iron_dagger');
    ok(r && canMake(p, r), 'can forge an iron dagger');
    if (r) make(w, r, { type: 'forge' });
    ok(countItem(p, 'iron_dagger') >= 1, 'forged an iron dagger');
    // dialogue
    const eira = w.actors.find((a) => a.npcId && NPC[a.npcId].merchant) || w.pop.npc('eira');
    ok(optionsFor(w, eira).some((o) => /sale|eat|hands/.test(o.text)), 'merchant offers barter');
    // the law
    const guard = w.actors.find((a) => a.tpl === 'guard');
    const vic = w.actors.find((a) => a.npcId && !a.essential && a.faction !== 'guard');
    ok(guard && vic, 'guard and citizen nearby');
    if (guard && vic) {
        guard.pos.x = p.pos.x + 3; guard.pos.z = p.pos.z; vic.pos.x = p.pos.x + 1; vic.pos.z = p.pos.z + 1;
        applyDamage(w, vic, { amount: 3, type: 'phys', source: p });
        ok(p.bounty.brightwater > 0, 'assault seen: bounty');
        let arrest = null; for (let i = 0; i < 400 && !arrest; i++) { w.tick(1 / 30, null); arrest = w.drain().find((e) => e.type === 'arrest'); }
        ok(arrest, 'a guard stops you');
        p.gold = 500; w.payFine('brightwater');
        ok(!p.bounty.brightwater, 'fine paid');
    }
    // fast travel
    ok(w.canFastTravel() === null, `can fast travel (${w.canFastTravel()})`);
    w.fastTravel('hrimvik');
    ok(Math.hypot(p.pos.x - LOC.hrimvik.x, p.pos.z - LOC.hrimvik.z) < 160, 'arrived in Hrimvik');
    // save → load
    const saves = new Saves({ world: w, ui: null });
    p.gold = 1234; w.quests.start('t_ring');
    const slot = saves.save(null, 'manual');
    ok(slot && saves.list().length === 1, 'saved');
    applySave(w, pristine); step(0.2);
    ok(p.gold !== 1234, 'reset');
    applySave(w, saves.load(slot)); step(0.2);
    ok(p.gold === 1234 && w.quests.active('t_ring'), 'loaded');
    console.log(`  save is ${(JSON.stringify(serialize(w)).length / 1024).toFixed(1)} KB`);
}

console.log(`\n${passes} passed, ${fails} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
