/**
 * populate.js — fills a built level with monsters, loot, chests, traps,
 * braziers, shrines, fountains, merchants, Wayfarers (quests), journal pages,
 * vault keys and Wardens. Pure: works on the run with a per-floor rng.
 */

import { T, TP, DIRS8, cheb } from './tiles.js';
import { WORLDS, floorInWorld } from './worlds.js';
import { SPECIES, makeMonster, spawnTable } from './monsters.js';
import { rollItem, makeConsumable } from './items.js';
import { hashSeed } from './rng.js';
import { distanceMap } from './path.js';
import { planQuest, wayfarerName } from './quests.js';
import { makeBoss, BOSS_BY_WORLD } from './bosses.js';

const walk = (t) => TP[t].pass || t === T.DOOR;

export function populate(run, lv, rng) {
    const W = WORLDS[lv.world];
    const f = lv.floor;
    const fiw = floorInWorld(f);
    run.mons = []; run.items = []; run.objs = []; run.hazards = []; run.fields = [];
    const D = distanceMap(lv, [[lv.start.x, lv.start.y]], (i) => walk(lv.tiles[i]));
    const taken = new Set([lv.start.y * lv.w + lv.start.x, lv.down.y * lv.w + lv.down.x]);
    const inVault = (x, y) => lv.vault && x >= lv.vault.x && x < lv.vault.x + lv.vault.w && y >= lv.vault.y && y < lv.vault.y + lv.vault.h;
    const free = (x, y) => {
        const i = y * lv.w + x;
        const t = lv.tiles[i];
        return (t === T.FLOOR || t === T.MOSS || t === T.SHALLOW || t === T.ICE || t === T.RUBBLE) && !taken.has(i) && !inVault(x, y);
    };
    // Blocking things (chests, braziers, people) only go where they can't plug a corridor.
    const open = (x, y) => {
        let n = 0;
        for (const [dx, dy] of DIRS8) if (walk(lv.tiles[(y + dy) * lv.w + x + dx])) n++;
        return n >= 7 && !nearDoorTile(lv, x, y);
    };
    const randomTile = (minD = 0, maxD = 9999, needOpen = false) => {
        for (let k = 0; k < 500; k++) {
            const x = rng.int(1, lv.w - 2), y = rng.int(1, lv.h - 2);
            const d = D[y * lv.w + x];
            if (d < minD || d > maxD || !free(x, y)) continue;
            if (needOpen && !open(x, y)) continue;
            return [x, y];
        }
        return null;
    };
    const take = (x, y) => taken.add(y * lv.w + x);
    const addObj = (o) => { o.id = run.nextId++; run.objs.push(o); take(o.x, o.y); for (const [dx, dy] of DIRS8) take(o.x + dx, o.y + dy); return o; };
    const dropItem = (x, y, it) => { run.items.push({ id: it.id, x, y, it }); take(x, y); };
    const placeMonster = (sp, minD, opts) => {
        const pos = randomTile(minD);
        if (!pos) return null;
        const m = makeMonster(run, sp, pos[0], pos[1], f, rng, opts);
        m.asleep = rng.chance(0.55); m.awake = false;
        run.mons.push(m); take(pos[0], pos[1]);
        return m;
    };

    if (lv.boss) return populateArena(run, lv, rng, W, addObj, dropItem);

    // ---- Monsters
    const area = lv.tiles.reduce((n, t) => n + (walk(t) ? 1 : 0), 0);
    const count = Math.round(5 + area / 80 + f * 0.06);
    const tbl = spawnTable(lv.world, fiw, W.bestiary);
    const eliteP = f >= 3 ? 0.07 + f * 0.0012 : 0;
    let made = 0;
    for (let k = 0; k < count * 3 && made < count; k++) {
        const sp = rng.weighted(tbl);
        const S = SPECIES[sp];
        const pos = randomTile(7);
        if (!pos) break;
        if (S.a === 'pack') {
            const n = rng.int(S.grp[0], S.grp[1]);
            const leaderElite = rng.chance(eliteP * 0.5);
            for (let j = 0; j < n; j++) {
                const c = j === 0 ? pos : nearFree(lv, pos[0], pos[1], free, rng);
                if (!c) break;
                const m = makeMonster(run, sp, c[0], c[1], f, rng, { elite: j === 0 && leaderElite });
                m.asleep = rng.chance(0.5);
                run.mons.push(m); take(c[0], c[1]);
                made += 0.5;
            }
        } else if (S.a === 'ambusher' && sp !== 'mimic') {
            const m = makeMonster(run, sp, pos[0], pos[1], f, rng, { elite: rng.chance(eliteP) });
            run.mons.push(m); take(pos[0], pos[1]); made++;
        } else {
            const m = makeMonster(run, sp, pos[0], pos[1], f, rng, { elite: rng.chance(eliteP) });
            m.asleep = rng.chance(0.55);
            run.mons.push(m); take(pos[0], pos[1]); made++;
        }
    }

    // ---- Loot on the floor
    const goldN = rng.int(3, 6);
    for (let k = 0; k < goldN; k++) {
        const pos = randomTile(2);
        if (pos) dropItem(pos[0], pos[1], { id: run.nextId++, k: 'gold', n: Math.round(rng.int(4, 12) * (1 + f * 0.12)) });
    }
    const itemsN = rng.int(3, 5);
    for (let k = 0; k < itemsN; k++) {
        const pos = randomTile(2);
        if (pos) dropItem(pos[0], pos[1], rollItem(run, rng, f));
    }
    // The lantern clock must never be unwinnable: one flask is guaranteed, a second is likely.
    for (let k = 0; k < (rng.chance(0.55) ? 2 : 1); k++) {
        const pos = randomTile(4);
        if (pos) dropItem(pos[0], pos[1], makeConsumable(run, 'oil'));
    }
    if (f <= 4 || rng.chance(0.5)) { const pos = randomTile(3); if (pos) dropItem(pos[0], pos[1], makeConsumable(run, 'heal')); }

    // ---- Chests (and the odd mimic)
    const chests = rng.int(1, 3);
    for (let k = 0; k < chests; k++) {
        const pos = randomTile(6, 9999, true);
        if (!pos) break;
        if (f >= 4 && rng.chance(0.1)) {
            const m = makeMonster(run, 'mimic', pos[0], pos[1], f, rng);
            run.mons.push(m); take(pos[0], pos[1]);
        } else addObj({ k: 'chest', x: pos[0], y: pos[1], open: false, tier: 0 });
    }

    // ---- Braziers (unlit ones are kindle-quest fodder; otherwise mostly lit)
    const braziers = [];
    const nb = W.braziers + rng.int(0, 1);
    for (let k = 0; k < nb; k++) {
        const r = rng.pick(lv.rooms.filter((r) => !r.cave));
        if (!r) break;
        const x = r.x + (r.w >> 1) + rng.int(-1, 1), y = r.y + (r.h >> 1) + rng.int(-1, 1);
        if (!free(x, y) || !open(x, y) || nearStairs(lv, x, y)) continue;
        const lit = rng.chance(0.7);
        braziers.push(addBrazier(run, lv, addObj, x, y, lit));
    }

    // ---- Traps
    const traps = Math.round(1 + f * 0.04 + rng.int(0, 2));
    const kinds = ['spike', 'spike', 'fire', 'gas', 'alarm', 'tele'];
    for (let k = 0; k < traps; k++) {
        const pos = randomTile(5);
        if (pos) addObj({ k: 'trap', trap: rng.pick(kinds), x: pos[0], y: pos[1], hidden: true });
    }

    // ---- Shrine / fountain
    if (rng.chance(0.3)) { const pos = randomTile(4, 9999, true); if (pos) addObj({ k: 'shrine', x: pos[0], y: pos[1], used: false }); }
    if (rng.chance(0.2)) { const pos = randomTile(4, 9999, true); if (pos) addObj({ k: 'fountain', x: pos[0], y: pos[1], used: false }); }

    // ---- Merchant: always on floor 5 of a world, sometimes elsewhere.
    if (fiw === 5 || (f > 2 && rng.chance(0.1))) {
        const pos = randomTile(3, 25, true);
        if (pos) {
            const stock = [];
            for (const c of ['heal', 'heal', 'oil', 'oil', 'antidote']) stock.push(makeConsumable(run, c));
            stock.push(makeConsumable(run, rng.pick(['haste', 'mapping', 'warding', 'firebomb', 'teleport', 'heal2'])));
            if (rng.chance(0.25)) stock.push(makeConsumable(run, 'might'));
            for (let k = 0; k < 4; k++) stock.push(rollItem(run, rng, f + 1, 'gear', 0.6));
            const nm = wayfarerName(rng);
            addObj({ k: 'merchant', x: pos[0], y: pos[1], stock, name: nm.name });
        }
    }

    // ---- A Wayfarer with a quest
    if (rng.chance(0.45)) {
        const pos = randomTile(4, 30, true);
        if (pos) {
            const nm = wayfarerName(rng);
            const npc = addObj({ k: 'npc', x: pos[0], y: pos[1], name: nm.name, title: nm.title, look: rng.int(0, 999) });
            const q = planQuest(run, rng, npc, {
                bestiary: Object.keys(tbl), placeMonster, dropItem, addObj,
                farTile: (minD) => {
                    // Far from the giver as well as the start; open ground (captives block).
                    for (let k = 0; k < 60; k++) { const t = randomTile(minD, 9999, true); if (t && cheb(t[0], t[1], npc.x, npc.y) >= 10) return t; }
                    return randomTile(minD, 9999, true);
                },
                unlitBraziers: (n) => {
                    let placed = 0;
                    for (let k = 0; k < 120 && placed < n; k++) {
                        const t = randomTile(5, 9999, true);
                        if (!t) break;
                        if (run.objs.some((o) => o.k === 'brazier' && cheb(o.x, o.y, t[0], t[1]) < 7)) continue;
                        const b = addBrazier(run, lv, addObj, t[0], t[1], false);
                        b.questUnlit = true;
                        placed++;
                    }
                    return placed;
                },
            });
            if (q) { npc.quest = q.id; run.quests.push(q); }
        }
    }

    // ---- Maren's journal page for this world
    if (fiw === pageFloor(run, lv.world)) {
        const pos = randomTile(10);
        if (pos) { const it = makeConsumable(run, 'page'); it.name = `Maren's Journal (${W.short})`; it.world = lv.world; dropItem(pos[0], pos[1], it); }
    }

    // ---- Vault: sealed room with better loot; its key lies elsewhere on the floor.
    if (lv.vault) {
        const v = lv.vault;
        let n = 0;
        for (let y = v.y; y < v.y + v.h && n < 3; y++) for (let x = v.x; x < v.x + v.w && n < 3; x++) {
            if ((x + y) % 2 || !rng.chance(0.6)) continue;
            if (n === 0) addObj({ k: 'chest', x, y, open: false, tier: 1 });
            else dropItem(x, y, n === 1 ? rollItem(run, rng, f + 2, 'gear', 1.2) : { id: run.nextId++, k: 'gold', n: Math.round(rng.int(20, 40) * (1 + f * 0.12)) });
            n++;
        }
        if (n === 0) addObj({ k: 'chest', x: v.x, y: v.y, open: false, tier: 1 });
        const pos = randomTile(6);
        if (pos) dropItem(pos[0], pos[1], makeConsumable(run, 'key'));
        lv.lights.push({ x: v.x + (v.w >> 1), y: v.y + (v.h >> 1), r: 3, on: true, k: 'glow', g: 'gems' });
    }
}

/** The floor (2–9) of a world that holds Maren's page — fixed per run seed. */
export function pageFloor(run, world) {
    return 2 + (hashSeed(run.seed, world, 77) % 8);
}

function addBrazier(run, lv, addObj, x, y, lit) {
    const o = addObj({ k: 'brazier', x, y, lit });
    lv.lights.push({ x, y, r: 5, on: lit, k: 'brazier', obj: o.id });
    return o;
}

function nearDoorTile(lv, x, y) {
    for (const [dx, dy] of DIRS8) { const t = lv.tiles[(y + dy) * lv.w + x + dx]; if (t === T.DOOR || t === T.VAULT_DOOR || t === T.DOOR_OPEN) return true; }
    return false;
}

function nearStairs(lv, x, y) {
    return cheb(x, y, lv.start.x, lv.start.y) <= 2 || cheb(x, y, lv.down.x, lv.down.y) <= 2;
}

function nearFree(lv, x, y, free, rng) {
    const c = [];
    for (const [dx, dy] of DIRS8) if (free(x + dx, y + dy)) c.push([x + dx, y + dy]);
    return c.length ? rng.pick(c) : null;
}

function populateArena(run, lv, rng, W, addObj, dropItem) {
    // Braziers that ring the arena become (lit) objects.
    for (const l of lv.lights) if (l.k === 'brazier') { const o = addObj({ k: 'brazier', x: l.x, y: l.y, lit: true, fixed: true }); l.obj = o.id; }
    const a = lv.arena;
    const id = BOSS_BY_WORLD[lv.world];
    const boss = makeBoss(run, id, W.warden.name, a.cx, a.y + 3, lv.floor);
    run.mons.push(boss);
    // Vesper's bone piles; a pair of healing draughts in the antechamber.
    dropItem(lv.start.x - 2, lv.start.y - 1, makeConsumable(run, 'heal'));
    dropItem(lv.start.x + 2, lv.start.y - 1, makeConsumable(run, 'oil'));
    if (lv.world >= 4) dropItem(lv.start.x, lv.start.y - 2, makeConsumable(run, rng.pick(['warding', 'haste', 'heal2'])));
}
