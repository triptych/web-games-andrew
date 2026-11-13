// TITAN'S VAULT: entering areas, town, waystones, the town portal, bosses, quests and rifts. Pure.

import { RIFT, POTION } from '../config.js';
import { childSeed } from '../rng.js';
import { AREAS, CAMPAIGN, NPCS, TOWN, RIFT_MODS, LORE } from './data/world.js';
import { BOSSES } from './data/monsters.js';
import { generateArea, fits } from './world.js';
import { populate, makeMonster } from './monsters.js';
import { placePet } from './pet.js';

/** Features: things in an area the player walks to or interacts with. */
function townFeatures(G) {
    const f = [];
    const at = ([x, y]) => ({ x: x + 0.5, y: y + 0.5 });
    f.push({ id: 'waystone', kind: 'waystone', ...at(TOWN.waystone) });
    f.push({ id: 'stash', kind: 'stash', ...at(TOWN.stash) });
    f.push({ id: 'shrine', kind: 'shrine', ...at(TOWN.shrine) });
    f.push({ id: 'gate', kind: 'exit', to: 'wilds', ...at(TOWN.gate) });
    f.push({ id: 'obelisk', kind: 'obelisk', locked: !G.player.bossesKilled.includes('kolossar'), ...at(TOWN.obelisk) });
    for (const [id, n] of Object.entries(NPCS)) f.push({ id, kind: 'npc', role: n.role, x: n.x + 0.5, y: n.y + 0.5 });
    if (G.portalBack) f.push({ id: 'portal', kind: 'portal', x: TOWN.spawn[0] + 2.5, y: TOWN.spawn[1] - 1.5 });
    return f;
}

function dungeonFeatures(G, A, def) {
    const f = [{ id: 'waystone', kind: 'waystone', x: A.waystone.x, y: A.waystone.y }];
    const bossAlive = def.boss && !G.player.bossesKilled.includes(def.boss);
    if (A.exit && !G.rift) f.push({ id: 'exit', kind: 'exit', to: def.next, x: A.exit.x, y: A.exit.y, locked: !!bossAlive, offset: !!def.boss });
    const lore = LORE[A.id] || [];
    A.lore.forEach((p, i) => { if (lore[i]) f.push({ id: 'lore' + i, kind: 'lore', lore: i, x: p.x, y: p.y }); });
    // a few chests in out-of-the-way spots, and decor props by the walls (the view draws them; nothing collides)
    const rng = G.rng;
    const far = A.spawns.filter((p) => p.d > 15);
    for (let k = 0; k < 2 && far.length; k++) { const p = rng.pick(far); f.push({ id: 'chest' + k, kind: 'chest', x: p.x, y: p.y }); }
    return f;
}

function decorFor(G, A) {
    const out = [], rng = G.rng, kinds = {
        wilds: ['tree', 'tree', 'column', 'statue'], temple: ['column', 'column', 'brazier', 'statue'],
        crypt: ['sarcophagus', 'brazier', 'column'], vault: ['brazier', 'column', 'statue'], rift: ['obelisk', 'column', 'brazier'], town: [],
    }[AREAS[A.id].tex] || ['column'];
    if (!kinds.length) return out;
    for (let t = 0; t < 600 && out.length < 34; t++) {
        const x = rng.int(1, A.w - 2) + 0.5, y = rng.int(1, A.h - 2) + 0.5;
        if (!fits(A, x, y, 0.45)) continue;
        // against a wall, not in a corridor, not on the path start/exit
        let walls = 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (A.grid[(Math.floor(y) + oy * 2) * A.w + Math.floor(x) + ox * 2] === 0) walls++;
        if (walls !== 1) continue;
        if (Math.hypot(x - A.start.x, y - A.start.y) < 4 || (A.exit && Math.hypot(x - A.exit.x, y - A.exit.y) < 4)) continue;
        if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 4)) continue;
        out.push({ kind: rng.pick(kinds), x, y, rot: rng() * 6.28 });
    }
    return out;
}

/**
 * Go to an area. via: 'start' (the entrance), 'waystone' (its waystone), 'portal' (restore the snapshot), 'town'.
 * opts.tier for rifts.
 */
export function enterArea(G, id, via = 'start', opts = {}) {
    const P = G.player;
    const def = AREAS[id];
    if (via === 'portal' && G.portalBack) {
        const s = G.portalBack;
        G.area = s.area; G.mons = s.mons; G.drops = s.drops; G.rift = s.rift; G.features = s.features; G.decor = s.decor;
        G.shots = []; G.zones = [];
        P.x = s.x; P.y = s.y;
        G.portalBack = null;
        G.area.uid = G.nextId++;
        G._flow = null;
        placePet(G);
        G.events.push({ type: 'area', id: G.area.id, via });
        return;
    }
    G.visits = (G.visits || 0) + 1;
    const gen = def.gen === 'rift' ? 'rooms' : def.gen;
    const A = generateArea(gen, childSeed(G.seed, CAMPAIGN.indexOf(id) + 10, G.visits), def.w, def.h, { boss: !!def.boss });
    A.id = id; A.uid = G.nextId++;
    G.area = A;
    G.mons = []; G.shots = []; G.zones = []; G.drops = []; G.minions = [];
    G._flow = null;
    if (id === 'rift') {
        const tier = opts.tier || 1;
        const mods = [];
        const keys = Object.keys(RIFT_MODS);
        const n = tier >= 3 ? 2 : 1;
        while (mods.length < n) { const k = G.rng.pick(keys); if (!mods.includes(k)) mods.push(k); }
        G.rift = { tier, mods, progress: 0, need: RIFT.need, guardian: false, done: false, t: 0, mf: mods.includes('bountiful') ? 50 : 0 };
    } else G.rift = null;
    G.features = A.kind === 'town' ? townFeatures(G) : dungeonFeatures(G, A, def);
    G.decor = A.kind === 'town' ? [] : decorFor(G, A);
    populate(G);
    if (G.rift) {
        // the bar is three quarters of what this rift holds, so a rift can always be finished
        let worth = 0;
        for (const m of G.mons) worth += m.elite ? (m.elite.minion ? RIFT.progress.champion : RIFT.progress.elite) : RIFT.progress.normal;
        G.rift.need = Math.max(20, Math.min(RIFT.need, Math.round(worth * 0.75)));
    }
    const at = via === 'waystone' ? A.waystone : A.start;
    P.x = at.x; P.y = at.y;
    if (via === 'waystone' && A.kind !== 'town') P.y += 1.2;
    P.moveGoal = null; P.channel = null; P.busy = 0;
    if (A.kind === 'town') { P.potion.charges = POTION.charges; P.life = P.stats.maxLife; }
    // quest progress: entering a campaign area further along advances the chronicle
    const ci = CAMPAIGN.indexOf(id);
    if (ci >= 0 && ci + 1 > P.reached) {
        P.reached = ci + 1;
        const actCard = { wilds: 'act1', necropolis: 'act2', halls: 'act3' }[id];
        if (actCard) card(G, actCard);
    }
    placePet(G);
    G.events.push({ type: 'area', id, via, tier: G.rift?.tier });
}

export function card(G, id) {
    if (G.seenCards.includes(id)) return;
    G.seenCards.push(id);
    G.events.push({ type: 'card', id });
}

/** Snapshot the dungeon and go to town through a portal. */
export function portalToTown(G) {
    if (G.area.kind === 'town') return 'already in town';
    G.portalBack = { area: G.area, mons: G.mons, drops: G.drops, rift: G.rift, features: G.features, decor: G.decor, x: G.player.x, y: G.player.y };
    G.events.push({ type: 'portal', x: G.player.x, y: G.player.y });
    enterArea(G, 'town', 'start');
    return '';
}

/** A boss died: record it, open the way on, and tell the story. */
export function bossKilled(G, boss) {
    const P = G.player;
    if (G.rift) {
        G.rift.done = true;
        P.riftBest = Math.max(P.riftBest, G.rift.tier);
        // the way home opens beside the player, on floor (never in a wall)
        let at = { x: P.x, y: P.y };
        for (let k = 0; k < 8; k++) { const a = k * 0.785, x = P.x + Math.cos(a) * 2, y = P.y + Math.sin(a) * 2; if (fits(G.area, x, y, 0.5)) { at = { x, y }; break; } }
        G.features.push({ id: 'exit', kind: 'exit', to: 'town', x: at.x, y: at.y, rift: true });
        G.events.push({ type: 'riftDone', tier: G.rift.tier });
        return;
    }
    if (!P.bossesKilled.includes(boss)) P.bossesKilled.push(boss);
    const ex = G.features.find((f) => f.kind === 'exit');
    if (ex) ex.locked = false;
    G.events.push({ type: 'bossDead', boss, name: BOSSES[boss].name });
    if (boss === 'kolossar') { G.won = true; card(G, 'victory'); card(G, 'rifts'); }
}

/** Fill the rift's bar → the guardian comes. */
export function stepRift(G, dt) {
    const R = G.rift;
    if (!R || R.done) return;
    R.t += dt;
    if (!R.guardian && R.progress >= R.need) {
        R.guardian = true;
        const P = G.player;
        const boss = G.rng.pick(Object.keys(BOSSES));
        // on a spot big enough for it, searching outward; never inside a wall (the bot found one there)
        let x = P.x, y = P.y, found = false;
        for (let r = 6; r >= 2 && !found; r -= 1) for (let k = 0; k < 16 && !found; k++) {
            const a = k * 0.3927, tx = P.x + Math.cos(a) * r, ty = P.y + Math.sin(a) * r;
            if (fits(G.area, tx, ty, BOSSES[boss].radius * 0.8)) { x = tx; y = ty; found = true; }
        }
        const m = makeMonster(G, null, x, y, RIFT.baseLevel + (R.tier - 1) * RIFT.levelPerTier + 2, { boss, aggro: true });
        m.guardian = true;
        G.events.push({ type: 'guardian', boss, name: BOSSES[boss].name });
    }
}

