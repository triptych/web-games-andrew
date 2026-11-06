// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI and the bot change G only through step() and act().
//
//   newGame(seed, name)  a fresh castaway on a fresh island
//   step(G, inp, dt)     inp = { mx, my, dyaw, dpitch, sprint, jump } (jump: pressed since the last step)
//   act(G, cmd)          everything discrete: use, cast, inscribe, experiment, eat, rest, say...
//   serialize / deserialize

import { PLAYER, SURVIVAL, DAY, START_TOD, MAGIC, PHASES } from '../config.js';
import { makeRng, hashStr } from '../rng.js';
import { genLaws } from './laws.js';
import { SITES, HILLTOP, REGION_NAMES } from './world.js';
import { REAGENTS, REAGENT_IDS, ITEMS } from './data/reagents.js';
import { PAGES, INSPECT, NIB } from './data/text.js';
import { worldOf, emit, msg, bark, phaseOf, phaseNow, isNight, itemName, addItem, takeItem, clamp } from './util.js';
import { supportAt, moveBody, collide } from './body.js';
import { castSlot, tickFields, wardOn, ventActive, ventPos, nearFire, stillAt, ECHO_POS, circleObjects } from './magic.js';
import { experiment, newNotes, gnote, noteLog } from './research.js';
import { openDialog, advance, closeDialog, hint, currentGoal } from './story.js';

export { currentGoal };

/** What anyone can see of a glyph by looking at it: its name, its strokes, and whether it is ringed. */
export function publicGlyph(G, id) {
    const g = G.laws.glyphs.find((x) => x.id === id);
    return g && { id: g.id, name: g.name, kind: g.kind, strokes: g.strokes };
}

// ------------------------------------------------------------------ a new game
export function newGame(seed = 1, name = 'Rowan') {
    const W = worldOf({ seed });
    const s = SITES.start;
    const G = {
        v: 1, seed, name: String(name || 'Rowan').slice(0, 18),
        rng: makeRng(hashStr('hum-run-' + seed)),
        t: 0, tod: START_TOD, day: 1,
        p: { x: s.x, y: W.height(s.x, s.z), z: s.z, vx: 0, vz: 0, vy: 0, yaw: 0.12, pitch: 0.02, ground: true,
            vigor: 72, warmth: 58, health: 100, wards: {}, safe: { x: s.x, z: s.z }, region: 'shore', inside: false },
        bag: {},
        hasWand: false,
        wand: Array.from({ length: MAGIC.slots }, () => ({ glyphs: [], feed: [], charges: 0 })),
        sel: 0,
        glyphs: [],
        notes: newNotes(),
        flags: {},
        vents: [0, 1, 2].map(() => ({ plugged: false, clear: 0 })),
        pickups: [],
        seals: [],
        shades: [],
        nib: { mode: 'caged', x: SITES.cage.x, y: W.height(SITES.cage.x, SITES.cage.z), z: SITES.cage.z, yaw: 0, barked: {}, gather: 0 },
        pages: [], echoes: {}, regions: ['shore'], affection: 0,
        story: { hinted: {}, said: {} },
        dialog: null,
        stats: { experiments: 0, casts: 0, fizzles: 0, walked: 0, collapses: 0, firstSpellDay: null },
        over: false, won: false, ending: null,
        events: [],
    };
    G.laws = genLaws(seed);
    spawnPickups(G);
    msg(G, 'You wake on wet sand with the sea in your ears. Your ship is gone.', 'story');
    return G;
}

function spawnPickups(G) {
    const W = worldOf(G);
    const L = G.laws;
    let n = 0;
    const add = (kind, item, pts) => { for (const pt of pts) G.pickups.push({ id: 'k' + (n++), kind, item, x: pt.x, z: pt.z, alive: true }); };
    for (const id of REAGENT_IDS) {
        const def = REAGENTS[id];
        const count = L.reagents[id].potency >= 2 ? 3 : def.region === 'shore' ? 7 : 6;
        add('reagent', id, W.spawnPoints(def.region, count, id));
    }
    add('food', 'clam', W.spawnPoints('shore', 7, 'clam'));
    add('food', 'driftwood', W.spawnPoints('shore', 8, 'driftwood'));
    add('food', 'chanterelle', W.spawnPoints('wood', 6, 'chanterelle'));
    add('bush', 'berries', [...W.spawnPoints('heath', 7, 'bush'), ...W.spawnPoints('wood', 5, 'bush2')]);
    // a few pieces of driftwood always lie right where you wake
    const s = SITES.start;
    add('food', 'driftwood', [{ x: s.x + 5, z: s.z + 2 }, { x: s.x - 6, z: s.z + 3 }, { x: s.x + 12, z: s.z + 1 }]);
}

// ------------------------------------------------------------------ the things you can use
let STATIC = null, STATIC_SEED = null;
function staticUses(G) {
    if (STATIC && STATIC_SEED === G.seed) return STATIC;
    const W = worldOf(G), S = SITES;
    const h = (x, z, dy) => W.height(x, z) + dy;
    const f = W.hutFloor;
    const hut = (k, dy) => ({ ...W.hutAt(k), y: f + dy });
    const list = [
        { id: 'desk', kind: 'desk', ...hut('desk', 1.0), label: 'Desk' },
        { id: 'alembic', kind: 'inst', inst: 'alembic', ...hut('alembic', 1.1), label: 'The Alembic' },
        { id: 'bells', kind: 'inst', inst: 'bells', ...hut('bells', 1.2), label: 'The Bells' },
        { id: 'orrery', kind: 'inst', inst: 'orrery', ...hut('orrery', 1.1), label: 'The Orrery' },
        { id: 'bed', kind: 'bed', ...hut('bed', 0.6), label: 'Bed' },
        { id: 'hearth', kind: 'hearth', ...hut('hearth', 0.7), label: 'Hearth' },
        { id: 'lintel', kind: 'carving', glyphs: 'lintel', ...hut('lintel', 2.0), label: 'Marks above the circle', reach: 1.6 },
        { id: 'post', kind: 'carving', glyphs: 'wood', x: S.seedbed.x + 1.6, z: S.seedbed.z - 1.3, y: h(S.seedbed.x + 1.6, S.seedbed.z - 1.3, 1.1), label: 'Seedbed post' },
        { id: 'bellows', kind: 'carving', glyphs: 'fen', x: S.bellows.x, z: S.bellows.z, y: h(S.bellows.x, S.bellows.z, 1.4), label: 'Bellows Rock', reach: 1.6 },
        { id: 'herald', kind: 'carving', glyphs: 'moor', x: S.herald.x, z: S.herald.z, y: h(S.herald.x, S.herald.z, 1.5), label: 'Herald Stone', reach: 0.8 },
        { id: 'stoneWood', kind: 'stone', reg: 'wood', x: S.mere.x, z: S.mere.z, y: h(S.mere.x, S.mere.z, 1.5), label: 'Standing stone', reach: 0.8 },
        { id: 'stoneFen', kind: 'stone', reg: 'fen', x: S.pool.x, z: S.pool.z, y: h(S.pool.x, S.pool.z, 1.5), label: 'Standing stone', reach: 0.8 },
        { id: 'stoneMoor', kind: 'stone', reg: 'moor', x: S.storm.x, z: S.storm.z, y: h(S.storm.x, S.storm.z, 1.5), label: 'Standing stone', reach: 0.8 },
        { id: 'sign', kind: 'look', text: INSPECT.sign, x: S.cross.x + 2, z: S.cross.z, y: h(S.cross.x, S.cross.z, 1.5), label: 'Signpost' },
        { id: 'wreck', kind: 'look', text: INSPECT.wreck, x: S.wreck.x, z: S.wreck.z, y: h(S.wreck.x, S.wreck.z, 1.5), label: 'The wreck', reach: 3 },
        { id: 'seedbed', kind: 'look', text: INSPECT.seedbed, x: S.seedbed.x, z: S.seedbed.z, y: h(S.seedbed.x, S.seedbed.z, 0.4), label: 'Seedbed', reach: 1 },
        { id: 'heartLook', kind: 'look', text: INSPECT.heart, x: S.heart.x, z: S.heart.z, y: HILLTOP + S.gallery.up + 1.6, label: 'Elowen', reach: 2 },
        { id: 'storm', kind: 'look', text: INSPECT.storm, x: S.storm.x, z: S.storm.z + S.storm.wind, y: h(S.storm.x, S.storm.z + S.storm.wind, 1.2), label: 'The storm ring', reach: 2 },
    ];
    const pagePos = {
        p1: hut('desk', 1.0), p2: { ...W.hutAt('alembic'), x: W.hutAt('alembic').x + 0.9, y: f + 1.4 },
        p3: { x: S.boat.x + 0.6, z: S.boat.z, y: h(S.boat.x, S.boat.z, 0.8) },
        p4: { x: S.cage.x + 4, z: S.cage.z - 3, y: h(S.cage.x + 4, S.cage.z - 3, 0.3) },
        p5: { x: S.seedbed.x + 2.2, z: S.seedbed.z + 1.4, y: h(S.seedbed.x + 2.2, S.seedbed.z + 1.4, 1.0) },
        p6: { x: 70, z: 14, y: h(70, 14, 1.2) },
        p7: { x: S.moorcamp.x, z: S.moorcamp.z, y: h(S.moorcamp.x, S.moorcamp.z, 0.5) },
        p8: { x: 3.5, z: 68.5, y: h(3.5, 68.5, 1.1) },
        p9: { x: 7, z: 11, y: HILLTOP + 0.3 },
        p10: { x: 0, z: -1.2, y: HILLTOP + 0.1 },
    };
    for (const id in pagePos) {
        if (id === 'p1') continue;       // the journal on the desk is the desk
        list.push({ id: 'page_' + id, kind: 'page', page: id, ...pagePos[id], label: PAGES[id].title });
    }
    for (const id in ECHO_POS) {
        const e = ECHO_POS[id]();
        list.push({ id: 'echo_' + id, kind: 'echo', echo: id, x: e.x, z: e.z, y: (e.inHut ? f : W.height(e.x, e.z)) + 1.3, label: 'A faint figure', reach: 1.5 });
    }
    STATIC = list; STATIC_SEED = G.seed;
    return list;
}

export function usables(G) {
    const W = worldOf(G);
    const out = [];
    for (const u of staticUses(G)) {
        if (u.kind === 'page' && G.pages.includes(u.page)) continue;
        if (u.kind === 'echo' && G.echoes[u.echo] !== 'shown') continue;
        if (u.id === 'page_p10' && !G.flags.door) continue;
        if (u.kind === 'carving' && G.story.said['carve_' + u.glyphs]) continue;
        if (u.id === 'heartLook' && G.won) continue;
        out.push(u);
    }
    for (const p of G.pickups) {
        if (!p.alive) continue;
        const label = p.kind === 'bush' ? 'Bramble bush' : itemName(p.item);
        out.push({ id: p.id, kind: 'pickup', p, x: p.x, z: p.z, y: W.height(p.x, p.z) + 0.25, label });
    }
    if (G.nib.mode !== 'caged') out.push({ id: 'nib', kind: 'nib', x: G.nib.x, z: G.nib.z, y: G.nib.y + 0.6, label: 'Nib', reach: 0.6 });
    else out.push({ id: 'cage', kind: 'look', text: INSPECT.cage, x: SITES.cage.x, z: SITES.cage.z, y: W.height(SITES.cage.x, SITES.cage.z) + 0.8, label: 'A ball of black thorns', reach: 0.8, talk: NIB.caged });
    for (const s of G.seals) if (s.kind === 'fire') out.push({ id: s.id, kind: 'fire', x: s.x, z: s.z, y: s.y + 0.4, label: 'Your fire', reach: 0.8 });
    // things in the way, so the prompt can say why
    if (!G.flags.iceWall) { const x = SITES.fen.x - SITES.fen.r - 3.5; out.push({ id: 'icewall', kind: 'look', text: INSPECT.icewall, x, z: SITES.fen.z, y: W.height(x, SITES.fen.z) + 1.6, label: 'Frozen falls', reach: 2 }); }
    if (!G.flags.thornGap) out.push({ id: 'thorn', kind: 'look', text: INSPECT.thorn, x: 0, z: SITES.thorn.r, y: 8.6, label: 'The thornwall', reach: 2.4 });
    if (!G.flags.door) out.push({ id: 'door', kind: 'look', text: INSPECT.door, x: 0, z: SITES.keep.z1 + 0.5, y: HILLTOP + 1.6, label: 'A blank wall', reach: 1.2 });
    if (!G.flags.gallery && G.flags.door) out.push({ id: 'gallery', kind: 'look', text: INSPECT.gallery, x: 0, z: -2.2, y: HILLTOP + 1.5, label: 'The fallen stair', reach: 1.5 });
    for (let i = 0; i < 3; i++) if (ventActive(G, i)) { const v = ventPos(i); out.push({ id: 'vent' + i, kind: 'look', text: INSPECT.vent, x: v.x, z: v.z, y: 5.6, label: 'Steam vent', reach: 0.6 }); }
    return out;
}

/** The thing you are looking at that "use" would act on, or null. */
export function focusOf(G) {
    const p = G.p;
    const ex = p.x, ey = p.y + PLAYER.eye, ez = p.z;
    const cp = Math.cos(p.pitch);
    const dx = Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * cp;
    let best = null, bs = Infinity;
    for (const u of usables(G)) {
        const vx = u.x - ex, vy = u.y - ey, vz = u.z - ez;
        const d = Math.hypot(vx, vy, vz);
        if (d > PLAYER.reach + (u.reach || 0) + 0.6) continue;
        const along = (vx * dx + vy * dy + vz * dz) / (d || 1);
        if (along < 0.72 && d > 1.1) continue;
        const s = d * 0.35 + (1 - along) * 6;
        if (s < bs) { bs = s; best = u; }
    }
    return best;
}

// ------------------------------------------------------------------ the step
export function step(G, inp, dt) {
    if (G.over || G.dialog) return;
    const W = worldOf(G);
    const p = G.p;
    G.t += dt;
    // time of day
    const before = phaseOf(G.tod);
    G.tod += dt / DAY;
    if (G.tod >= 1) { G.tod -= 1; newDay(G); }
    const ph = phaseOf(G.tod);
    if (ph !== before) onPhase(G, ph);

    // look
    p.yaw += inp.dyaw || 0;
    p.pitch = clamp(p.pitch + (inp.dpitch || 0), -PLAYER.pitchMax, PLAYER.pitchMax);

    // walking
    const mx = inp.mx || 0, my = inp.my || 0;
    const ml = Math.hypot(mx, my), mk = ml > 1 ? 1 / ml : 1;
    const speed = inp.sprint ? PLAYER.sprint : PLAYER.walk;
    const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    // forward f = (sin yaw, -cos yaw); right = (cos yaw, sin yaw) = (-fz, fx)
    const want = { vx: (fx * my - fz * mx) * mk * speed, vz: (fz * my + fx * mx) * mk * speed };

    // forces
    let push = null;
    const S = SITES;
    const sd = Math.hypot(p.x - S.storm.x, p.z - S.storm.z);
    if (sd < S.storm.wind && !wardOn(G, 'still') && !wardOn(G, 'gale') && !stillAt(G, p.x, p.z)) {
        const k = 9.5 * Math.min(1, (S.storm.wind - sd) / 2.5) * dt * 6;
        push = { x: ((p.x - S.storm.x) / (sd || 1)) * k, z: ((p.z - S.storm.z) / (sd || 1)) * k };
        want.vx *= 0.25; want.vz *= 0.25;
        if (!G.story.said.wind) { G.story.said.wind = true; msg(G, 'The wind in the ring shoves you back, howling. You cannot walk into it.'); }
    }
    for (let i = 0; i < 3; i++) {
        const v = ventPos(i);
        if (ventActive(G, i) && Math.hypot(p.x - v.x, p.z - v.z) < 1.35 && p.y < 7) {
            push = { x: -9 * dt * 6, z: 0 };
            p.health -= 14 * dt;
            if (!G.story.said['vent' + i] || G.t - G.story.said['vent' + i] > 4) { G.story.said['vent' + i] = G.t; msg(G, 'Scalding steam! It drives you back down the causeway.', 'bad'); emit(G, { type: 'scald' }); }
        }
    }
    let lift = null;
    for (const s of G.seals) if (s.kind === 'updraft' && Math.hypot(s.x - p.x, s.z - p.z) < s.r && p.y < s.lift + 1) lift = s.lift;
    if (lift != null && p.inside) lift = Math.min(lift, worldOf(G).hutFloor + 2.0);   // the roof
    const frost = wardOn(G, 'rime');
    const wasGround = p.ground;
    const r = moveBody(G, p, want, dt, { frost, glide: wardOn(G, 'gale'), push, lift,
        jump: inp.jump ? PLAYER.jump * (wardOn(G, 'gale') ? 1.5 : 1) : 0 });
    if (r.landed) emit(G, { type: 'land', v: r.landed });
    if (inp.jump && wasGround && p.vy > 0) emit(G, { type: 'jump' });
    if (r.plunged) plunge(G, r.plunged);
    G.stats.walked += Math.hypot(p.vx, p.vz) * dt;

    // where am I
    p.inside = Math.abs(p.x - S.hut.x) < S.hut.w / 2 && Math.abs(p.z - S.hut.z) < S.hut.d / 2;
    const reg = W.regionAt(p.x, p.z);
    if (reg !== p.region) {
        p.region = reg;
        if (!G.regions.includes(reg)) { G.regions.push(reg); emit(G, { type: 'region', id: reg, name: REGION_NAMES[reg] }); }
    }
    if (p.ground && !r.wading && !frost && !G.seals.some((s) => s.kind === 'floe' && Math.hypot(s.x - p.x, s.z - p.z) < s.r + 1)) {
        if ((G.safeT = (G.safeT || 0) + dt) > 0.5) { G.safeT = 0; p.safe = { x: p.x, z: p.z }; }
    }
    // milestones the world notices
    const F = G.flags;
    if (p.inside && !F.hutFound) { F.hutFound = true; msg(G, 'A hut, dry and empty, full of strange brass instruments. Somebody lived here, and left in a hurry.', 'story'); emit(G, { type: 'hutFound' }); }
    const rr = Math.hypot(p.x, p.z);
    if (!F.crossedMoat && rr < S.moat.inner - 1 && p.y > 8) { F.crossedMoat = true; emit(G, { type: 'flag', name: 'crossedMoat' }); }
    if (!F.inCastle && rr < S.walls.r - 1 && p.y > HILLTOP - 1) { F.inCastle = true; emit(G, { type: 'flag', name: 'inCastle' }); msg(G, 'You stand in the courtyard of the stilled castle. Nothing moves. Not even the dust.', 'story'); }
    if (!F.gallery && p.y > HILLTOP + S.gallery.up - 0.3 && p.ground && Math.abs(p.x) < 7 && p.z < -2) { F.gallery = true; emit(G, { type: 'flag', name: 'gallery' }); }
    if (!F.gate && F.stoneWood && F.stoneFen && F.stoneMoor) {
        F.gate = true;
        msg(G, 'Far away on the hill, three locks fall open. The castle gate swings wide.', 'good');
        emit(G, { type: 'flag', name: 'gate' });
        bark(G, 'gate', NIB.barks.gate);
    }
    if (G.nib.mode === 'freed' && Math.hypot(p.x - G.nib.x, p.z - G.nib.z) < 9) openDialog(G, 'rescue');

    tickFields(G, dt);
    survive(G, dt, r);
    tickShades(G, dt);
    tickNib(G, dt);
}

function newDay(G) {
    G.day++;
    for (const k of G.pickups) if (!k.alive && k.item !== 'driftwood') k.alive = true;
    emit(G, { type: 'day', day: G.day });
}

function onPhase(G, ph) {
    emit(G, { type: 'phase', phase: ph });
    if (ph === 'night') {
        spawnShades(G);
        bark(G, 'night', NIB.barks.night);
    }
    if (ph === 'dawn') {
        const keep = G.shades.filter((s) => s.court);
        if (G.shades.length > keep.length) emit(G, { type: 'shadesFade' });
        G.shades = keep;
    }
}

function spawnShades(G) {
    const W = worldOf(G);
    const rng = G.rng;
    const add = (x, z, court = false) => G.shades.push({ id: 'sh' + (G.shadeSeq = (G.shadeSeq || 0) + 1), x, z, y: court ? HILLTOP : W.height(x, z), court, ph: rng() * 6.28 });
    for (let i = 0; i < 5; i++) { const a = rng() * 6.283, d = 72 + rng() * 40; add(Math.cos(a) * d, Math.sin(a) * d); }
    for (let i = 0; i < 2; i++) add(rng.range(-30, 30), rng.range(-180, -115));
    if (!G.flags.courtSpawned) {
        G.flags.courtSpawned = true;
        for (let i = 0; i < 4; i++) { const a = rng() * 6.283; add(Math.cos(a) * 11, Math.sin(a) * 11 + 1, true); }
    }
}

function tickShades(G, dt) {
    const p = G.p;
    for (const s of G.shades) {
        const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
        const dy = Math.abs(p.y - s.y);
        s.ph += dt;
        const lumen = wardOn(G, 'lumen') || G.seals.some((b) => b.kind === 'beacon' && Math.hypot(b.x - s.x, b.z - s.z) < b.r);
        const frozen = stillAt(G, s.x, s.z) || (wardOn(G, 'still') && d < 6);
        let sp = 0, vx = 0, vz = 0;
        if (frozen) sp = 0;
        else if (lumen && d < 9) { sp = -3.2; vx = dx / (d || 1); vz = dz / (d || 1); }
        else if (d < 16 && dy < 6 && (!s.court || G.flags.inCastle)) { sp = 2.7; vx = dx / (d || 1); vz = dz / (d || 1); }
        else { vx = Math.cos(s.ph * 0.3); vz = Math.sin(s.ph * 0.37); sp = 0.6; }
        let nx = s.x + vx * sp * dt, nz = s.z + vz * sp * dt;
        if (s.court) { const r = Math.hypot(nx, nz); if (r > 15 || (nx > -8 && nx < 8 && nz > -10 && nz < 4)) { nx = s.x; nz = s.z; } }
        s.x = nx; s.z = nz;
        s.y = s.court ? HILLTOP : worldOf(G).height(s.x, s.z);
        if (d < 1.3 && dy < 2.5 && !frozen) {
            p.warmth -= 9 * dt; p.health -= 5 * dt;
            if (!G.story.said.shadeTouch || G.t - G.story.said.shadeTouch > 5) { G.story.said.shadeTouch = G.t; msg(G, 'A shade touches you, and the cold goes straight to your bones.', 'bad'); emit(G, { type: 'shadeTouch' }); bark(G, 'shade', NIB.barks.shade); }
        }
    }
}

function tickNib(G, dt) {
    const n = G.nib, p = G.p;
    if (n.mode !== 'follow') return;
    const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const tx = p.x - fx * 2.0 + fz * 1.1, tz = p.z - fz * 2.0 - fx * 1.1;
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if (d > 26 || Math.abs(p.y - n.y) > 6 && d > 4) {
        n.x = tx; n.z = tz; n.y = supportAt(G, tx, tz, p.y + 1, wardOn(G, 'rime'));
        emit(G, { type: 'nibHop' });
    } else if (d > 0.6) {
        const sp = Math.min(d * 2.2, 7.5);
        const c = collide(G, n.x + (dx / d) * sp * dt, n.z + (dz / d) * sp * dt, 0.25);
        n.x = c.x; n.z = c.z;
        n.yaw = Math.atan2(dx, -dz);
    }
    const g = supportAt(G, n.x, n.z, n.y + 0.6, true);
    n.y += (g - n.y) * Math.min(1, dt * 12);
    n.moving = d > 0.7;
    // Nib picks up reagents he passes
    n.gather -= dt;
    if (n.gather <= 0) {
        n.gather = 14;
        const k = G.pickups.find((k) => k.alive && k.kind === 'reagent' && Math.hypot(k.x - n.x, k.z - n.z) < 7);
        if (k) {
            k.alive = false;
            addItem(G, k.item);
            emit(G, { type: 'pickup', item: k.item, by: 'nib', x: k.x, z: k.z });
            bark(G, 'found' + k.item, NIB.barks.found(itemName(k.item)));
        }
    }
}

function survive(G, dt, mv) {
    const p = G.p, S = SURVIVAL;
    p.vigor -= S.vigorDrain * dt * (Math.hypot(p.vx, p.vz) > 6 ? 1.5 : 1);
    let dw = 0;
    const fire = nearFire(G, p.x, p.z, p.y);
    const night = isNight(G);
    if (fire) dw = S.fireWarm;
    else if (p.inside) dw = p.warmth < 85 ? S.hutWarm : 0;
    else {
        dw = night ? -S.coldNight : p.warmth < S.warmCap ? S.warmDayOut : 0;
        if (p.region === 'moor' && !night) dw -= S.coldWind;
    }
    if (mv.wading) {
        if (mv.wading.kind === 'hot') dw += 4;
        else if (mv.wading.kind === 'boil') { dw += 4; p.health -= 6 * dt; }
        else dw -= S.coldWater;
    }
    if (wardOn(G, 'kindle')) dw += 3;
    if (wardOn(G, 'rime')) dw -= 0.15;
    p.warmth = clamp(p.warmth + dw * dt, 0, 100);
    p.vigor = clamp(p.vigor, 0, 100);
    let dh = 0;
    if (p.vigor <= 0 || p.warmth <= 0) dh -= S.starve;
    else if (p.vigor > 25 && p.warmth > 25) dh += S.regen;
    if (wardOn(G, 'bloom')) dh += 1.6;
    p.health = clamp(p.health + dh * dt, 0, 100);
    if (p.warmth < 15) bark(G, 'cold', NIB.barks.cold);
    if (p.vigor < 12) bark(G, 'hungry', NIB.barks.hungry);
    if (p.health <= 0) collapse(G);
}

function plunge(G, w) {
    const p = G.p;
    p.x = p.safe.x; p.z = p.safe.z;
    p.y = supportAt(G, p.x, p.z, 1e9);
    p.vx = p.vz = p.vy = 0;
    if (w.kind === 'moat') { p.health -= 18; p.warmth -= 20; msg(G, 'The black water seizes you and hurls you back onto the bank, shaking.', 'bad'); }
    else { p.warmth -= 14; msg(G, 'You plunge in over your head and scramble back to the shore, soaked.', 'bad'); }
    p.warmth = clamp(p.warmth, 0, 100);
    emit(G, { type: 'plunge', kind: w.kind });
}

function collapse(G) {
    const p = G.p;
    G.stats.collapses++;
    const W = worldOf(G);
    const bed = W.hutAt('bed');
    p.x = bed.x - 1.4; p.z = bed.z - 0.4; p.y = W.hutFloor; p.vx = p.vz = p.vy = 0; p.yaw = -Math.PI / 2; p.pitch = 0;
    // lose half of each reagent
    for (const id in G.bag) if (REAGENTS[id]) { G.bag[id] = Math.floor(G.bag[id] / 2); if (!G.bag[id]) delete G.bag[id]; }
    skipTo(G, 'dawn');
    p.health = 55; p.warmth = 80; p.vigor = Math.max(p.vigor, 45);
    p.wards = {};
    G.flags.hearth = true;
    const who = G.nib.mode === 'follow' ? 'Nib dragged you home, all the way, by the ankle.' : 'You do not remember how you got back to the hut.';
    msg(G, `Everything goes dark... You wake in the hut at dawn. ${who} Half your reagents are gone.`, 'bad');
    emit(G, { type: 'collapse' });
}

/** Jump forward to the start of the next named phase. */
function skipTo(G, phase) {
    const P = PHASES.find((x) => x.id === phase);
    let dt = P.from - G.tod;
    if (dt <= 0.002) dt += 1;
    const days = G.tod + dt >= 1;
    const before = phaseOf(G.tod);
    G.tod = P.from + 1e-6;
    G.t += dt * DAY;
    if (days) newDay(G);
    // the night's shades come and go while you sleep
    if (phase === 'dawn' || phase === 'day' || (phase === 'dusk' && before !== 'night')) { G.shades = G.shades.filter((s) => s.court); }
    if (phase === 'night') spawnShades(G);
    G.seals = [];                     // nothing magical lasts the night
    emit(G, { type: 'phase', phase });
    return dt;
}

// ------------------------------------------------------------------ discrete actions
export function act(G, cmd) {
    if (G.over && cmd.t !== 'say') return { ok: false };
    if (G.dialog && cmd.t !== 'say' && cmd.t !== 'closeDialog') return { ok: false, text: 'busy' };
    switch (cmd.t) {
        case 'use': {
            let u = focusOf(G);
            if (cmd.id) {
                u = usables(G).find((x) => x.id === cmd.id);
                if (u && Math.hypot(u.x - G.p.x, u.z - G.p.z) > PLAYER.reach + (u.reach || 0) + 1.5) u = null;
            }
            return use(G, u);
        }
        case 'cast': return { ok: true, res: castSlot(G) };
        case 'select': G.sel = (cmd.slot + MAGIC.slots) % MAGIC.slots; emit(G, { type: 'select', slot: G.sel }); return { ok: true };
        case 'inscribe': return inscribe(G, cmd);
        case 'refill': return refill(G, cmd.slot, cmd.n || 1);
        case 'clearSlot': return clearSlot(G, cmd.slot);
        case 'experiment': {
            if (!nearInstrument(G, cmd.inst)) return { ok: false, text: 'You need to be at the instrument.' };
            const r = experiment(G, cmd.inst, cmd.a, cmd.b);
            if (!r.ok) msg(G, r.text);
            return r;
        }
        case 'eat': return eat(G, cmd.item);
        case 'cook': return cook(G);
        case 'rest': return rest(G, cmd.until);
        case 'say': advance(G, cmd.choice); return { ok: true };
        case 'closeDialog': closeDialog(G); return { ok: true };
        case 'pencil': {
            const m = (G.notes.pencil[cmd.g] ||= {});
            if (!cmd.mark) delete m[cmd.key]; else m[cmd.key] = cmd.mark;
            return { ok: true };
        }
        case 'hint': { const text = hint(G); emit(G, { type: 'hint', text }); return { ok: true, text }; }
    }
    return { ok: false };
}

function nearInstrument(G, inst) {
    const W = worldOf(G);
    const a = W.hutAt(inst);
    return a && Math.hypot(G.p.x - a.x, G.p.z - a.z) < 3.6;
}

function learnGlyphs(G, ids, where) {
    const fresh = ids.filter((g) => !G.glyphs.includes(g));
    for (const g of fresh) { G.glyphs.push(g); gnote(G, g); }
    if (fresh.length) {
        const names = fresh.map((g) => G.laws.glyphs.find((x) => x.id === g).name).join(', ');
        noteLog(G, `Copied ${fresh.length === 1 ? 'a mark' : fresh.length + ' marks'} from ${where}: ${names}.`);
        emit(G, { type: 'glyph', ids: fresh });
    }
    return fresh;
}

function use(G, u) {
    if (!u) return { ok: false };
    const F = G.flags;
    switch (u.kind) {
        case 'pickup': {
            const k = u.p;
            if (k.kind === 'bush') {
                k.alive = false; addItem(G, 'berries', 3);
                emit(G, { type: 'pickup', item: 'berries', n: 3, x: k.x, z: k.z });
                msg(G, 'You pick a handful of bramble berries.');
                return { ok: true };
            }
            k.alive = false; addItem(G, k.item);
            emit(G, { type: 'pickup', item: k.item, x: k.x, z: k.z });
            if (REAGENTS[k.item] && !G.notes.reagents[k.item]) {
                G.notes.reagents[k.item] = { essence: null, potency: null, wax: null };
                noteLog(G, `Found ${itemName(k.item)}. ${REAGENTS[k.item].blurb}`);
            }
            return { ok: true };
        }
        case 'desk':
            if (!G.hasWand) {
                G.hasWand = true; F.hutKnown = true;
                emit(G, { type: 'wand' });
                msg(G, 'You take the Focus from the desk: a hazel wand tipped with sea glass. It is warm in your hand.', 'good');
            }
            readPage(G, 'p1');
            return { ok: true };
        case 'page': readPage(G, u.page); return { ok: true };
        case 'echo': openDialog(G, 'echo:' + u.echo); return { ok: true };
        case 'carving': {
            const L = G.laws;
            const ids = u.glyphs === 'lintel' ? L.lintel : [L.regionGlyph[u.glyphs]];
            learnGlyphs(G, ids, u.label.toLowerCase());
            G.story.said['carve_' + u.glyphs] = true;
            if (u.glyphs === 'lintel') { F.lintel = true; F.hutKnown = true; msg(G, INSPECT.lintel, 'story'); }
            else msg(G, `A single mark is carved here. You trace it, and hear its name: ${L.glyphs.find((x) => x.id === ids[0]).name}.`, 'story');
            return { ok: true };
        }
        case 'stone': {
            const awake = F[u.id];
            msg(G, INSPECT.stone(u.reg, awake), 'story');
            learnGlyphs(G, [G.laws.regionGlyph[u.reg]], 'a standing stone');
            return { ok: true };
        }
        case 'inst':
            if (!F.hutKnown) { msg(G, 'A contraption of brass and glass. You should find out whose this is first. There is a journal on the desk.'); return { ok: false }; }
            emit(G, { type: 'openInstrument', inst: u.inst });
            return { ok: true, inst: u.inst };
        case 'bed': emit(G, { type: 'openRest', at: 'bed' }); return { ok: true };
        case 'fire': emit(G, { type: 'openRest', at: 'fire' }); return { ok: true };
        case 'hearth':
            if (!F.hearth) {
                if (takeItem(G, 'driftwood', 3)) {
                    F.hearth = true;
                    msg(G, 'You stack the driftwood, strike the flint, and coax a flame. The hut fills with warm, wavering light.', 'good');
                    emit(G, { type: 'flag', name: 'hearth' });
                    return { ok: true };
                }
                msg(G, `${INSPECT.hearthCold} (${G.bag.driftwood || 0} of 3 driftwood)`);
                return { ok: false };
            }
            emit(G, { type: 'openRest', at: 'hearth' });
            return { ok: true };
        case 'nib': {
            const text = hint(G);
            openDialog(G, 'say', { who: 'nib', text });
            return { ok: true, text };
        }
        case 'look':
            msg(G, u.text, 'story');
            if (u.talk) emit(G, { type: 'bark', text: u.talk, who: 'nib' });
            return { ok: true };
    }
    return { ok: false };
}

function readPage(G, id) {
    if (!G.pages.includes(id)) { G.pages.push(id); emit(G, { type: 'page', id }); }
    openDialog(G, 'page:' + id);
}

// --- the Focus: three slots, each a written spell with fed reagents held ready for casting
function inscribe(G, { slot, glyphs, feed, n = 1 }) {
    const L = G.laws;
    if (!G.hasWand) return { ok: false, text: 'You have no Focus to write into.' };
    if (!Array.isArray(glyphs) || glyphs.length < 1 || glyphs.length > 3) return { ok: false, text: 'A spell is one to three marks.' };
    if (!glyphs.every((g) => G.glyphs.includes(g))) return { ok: false, text: 'You do not know that mark.' };
    feed = glyphs.map((g, i) => (L.glyphs.find((x) => x.id === g).kind === 'essence' ? feed?.[i] || null : null));
    clearSlot(G, slot, true);
    const s = G.wand[slot];
    s.glyphs = glyphs.slice(); s.feed = feed;
    s.charges = 0;
    const r = refill(G, slot, n, true);
    emit(G, { type: 'inscribe', slot });
    return { ok: true, charges: s.charges, text: r.text };
}

function need(feed) {
    const m = {};
    for (const r of feed) if (r) m[r] = (m[r] || 0) + 1;
    return m;
}
function refill(G, slot, n, quiet = false) {
    const s = G.wand[slot];
    if (!s || !s.glyphs.length) return { ok: false };
    const m = need(s.feed);
    let added = 0;
    for (let i = 0; i < n && s.charges < MAGIC.charges; i++) {
        if (!Object.keys(m).every((r) => (G.bag[r] || 0) >= m[r])) break;
        for (const r in m) takeItem(G, r, m[r]);
        s.charges++; added++;
    }
    if (!Object.keys(m).length && s.charges < MAGIC.charges) { s.charges = Math.max(s.charges, 1); added = 1; }
    if (!quiet) emit(G, { type: 'inscribe', slot });
    return { ok: added > 0, added, text: added ? '' : 'Not enough reagents to feed it.' };
}
function clearSlot(G, slot, quiet = false) {
    const s = G.wand[slot];
    if (!s) return { ok: false };
    const m = need(s.feed);
    if (Object.keys(m).length) for (let i = 0; i < s.charges; i++) for (const r in m) addItem(G, r, m[r]);
    s.glyphs = []; s.feed = []; s.charges = 0;
    if (!quiet) emit(G, { type: 'inscribe', slot });
    return { ok: true };
}

function eat(G, item) {
    const def = ITEMS[item];
    if (!def?.food || !takeItem(G, item)) return { ok: false };
    G.p.vigor = clamp(G.p.vigor + def.food, 0, 100);
    if (item === 'clam') msg(G, 'Raw clam. Chewy, salty, regrettable.');
    emit(G, { type: 'eat', item });
    return { ok: true };
}

function cook(G) {
    if (!nearFire(G, G.p.x, G.p.z, G.p.y)) return { ok: false, text: 'You need a fire to cook.' };
    let n = 0;
    for (const id of ['clam', 'chanterelle']) {
        const c = G.bag[id] || 0;
        if (c) { delete G.bag[id]; addItem(G, ITEMS[id].cook, c); n += c; }
    }
    if (n) { msg(G, `You cook ${n} thing${n > 1 ? 's' : ''} over the fire. It smells wonderful.`); emit(G, { type: 'cook', n }); }
    return { ok: n > 0 };
}

function rest(G, until) {
    const W = worldOf(G), p = G.p;
    const bed = W.hutAt('bed');
    const atBed = Math.hypot(p.x - bed.x, p.z - bed.z) < 3.6;
    const atFire = nearFire(G, p.x, p.z, p.y);
    if (!atBed && !atFire) return { ok: false, text: 'You need a bed or a fire to rest by.' };
    if (!PHASES.some((x) => x.id === until)) return { ok: false };
    const dt = skipTo(G, until);
    const hours = dt * 24;
    p.vigor = clamp(p.vigor - hours * 1.6, 0, 100);
    p.warmth = 100;
    if (p.vigor > 10) p.health = clamp(p.health + hours * 8, 0, 100);
    p.wards = {};
    G.flags.slept = true;
    msg(G, `You rest until ${PHASES.find((x) => x.id === until).name.toLowerCase()}.`);
    emit(G, { type: 'rest', until, hours });
    return { ok: true };
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, laws, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    G.laws = genLaws(G.seed);
    return G;
}
