// Magic: how a written spell is judged, how it is thrown, worn or set down, and what it does to
// the island. Pure. The rules come from G.laws; what the caster learns goes to research.js.

import { MAGIC, PLAYER, ESSENCE_INFO, FORM_INFO } from '../config.js';
import { SITES, HILLTOP, FEN_FLOOR } from './world.js';
import { worldOf, emit, msg, bark, phaseNow, isNight, itemName } from './util.js';
import { supportAt } from './body.js';
import { recordCast } from './research.js';
import { NIB } from './data/text.js';

const glyph = (L, id) => L.glyphs.find((g) => g.id === id);

// ------------------------------------------------------------------ judging a spell
/**
 * spell = { glyphs: [id...], feed: [reagentId | null ...] } (feed parallel to glyphs).
 * Returns a failure { fail, text, starved? } or a success { form, essence | 'unweave', pair, power }.
 */
export function evaluate(L, spell, phase) {
    const gs = spell.glyphs.map((id) => glyph(L, id));
    if (!gs.length) return { fail: 'empty', text: 'The page is blank.' };
    const shapes = gs.filter((g) => g.kind === 'shape');
    const words = gs.map((g, i) => ({ g, r: spell.feed[i] || null })).filter((w) => w.g.kind === 'essence');
    if (!shapes.length) return { fail: 'noshape', text: 'The words have no shape. They scatter like sparks and are gone.' };
    if (shapes.length > 1) return { fail: 'twoshapes', text: 'Two shapes fight over the words, and the whole spell knots itself up.' };
    if (!words.length) return { fail: 'hollow', text: 'A shape with nothing in it. It closes on thin air.' };
    const si = gs.indexOf(shapes[0]);
    const wantFirst = L.order === 'shape-first';
    if ((wantFirst && si !== 0) || (!wantFirst && si !== gs.length - 1)) {
        return { fail: 'tangle', text: 'The words tangle round each other and fall apart. The shape is at the wrong end.' };
    }
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const nth = words.length > 1 ? (i === 0 ? 'The first word' : 'The second word') : 'The word';
        if (!w.r) return { fail: 'starve', starved: i, text: `${nth} is hungry: nothing feeds it, and it fades.` };
        const carried = L.reagents[w.r]?.essence;
        if (carried !== w.g.essence) return { fail: 'starve', starved: i, text: `${nth} starves. ${itemName(w.r)} does not feed it.` };
    }
    const form = shapes[0].form;
    const power = words.reduce((s, w) => s + L.reagents[w.r].potency + (L.wax[w.g.essence] === phase ? 1 : 0), 0);
    if (words.length === 2) {
        const [a, b] = [words[0].g.essence, words[1].g.essence];
        if (a === b) return { form, essence: a, power, doubled: true };
        if (L.opp[a] === b) return { form, essence: 'unweave', pair: [a, b], power };
        return { fail: 'discord', text: 'Two different words grind against each other and come to nothing.' };
    }
    return { form, essence: words[0].g.essence, power };
}

export const spellColor = (L, res) => (res.essence === 'unweave' ? '#e8e4ff' : L.color[res.essence]);

// ------------------------------------------------------------------ the things magic can touch
const CIRCLE_OBJ = [
    { id: 'candle', e: 'kindle', a: 0, say: 'The candle in the circle lights itself.' },
    { id: 'bowl', e: 'rime', a: 1, say: 'The bowl of water in the circle freezes solid with a crack.' },
    { id: 'lantern', e: 'lumen', a: 2, say: 'The empty lantern in the circle fills with light.' },
    { id: 'pot', e: 'bloom', a: 3, say: 'A seedling bursts up out of the clay pot in the circle.' },
    { id: 'pinwheel', e: 'gale', a: 4, say: 'The pinwheel in the circle spins so hard it whistles.' },
    { id: 'pendulum', e: 'still', a: 5, say: 'The pendulum clock in the circle stops dead, mid-swing.' },
];
export const circleObjects = (W) => {
    const c = W.hutAt('circle');
    return CIRCLE_OBJ.map((o) => {
        const ang = (o.a / 6) * Math.PI * 2 + Math.PI / 6;
        return { ...o, x: c.x + Math.cos(ang) * 1.3, z: c.z + Math.sin(ang) * 1.3 };
    });
};
export const ventPos = (i) => ({ x: SITES.pool.x - SITES.pool.r + 1.2 + i * 1.8, z: SITES.pool.z });
export const thornPoints = () => Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    return { i, a, x: Math.cos(a) * SITES.thorn.r, z: Math.sin(a) * SITES.thorn.r };
});
export const ECHO_POS = {
    e1: () => ({ x: SITES.hut.x, z: SITES.hut.z + 1.0, inHut: true }),
    e2: () => ({ x: SITES.mere.x + 1.6, z: SITES.mere.z - 1.6 }),
    e3: () => ({ x: SITES.herald.x - 1.5, z: SITES.herald.z + 2 }),
    e4: () => ({ x: -7, z: 10 }),
};

export function targets(G) {
    const W = worldOf(G), S = SITES, F = G.flags;
    const out = [];
    const at = (x, z, dy) => W.height(x, z) + dy;
    if (G.nib.mode === 'caged') out.push({ id: 'cage', x: S.cage.x, y: at(S.cage.x, S.cage.z, 0.8), z: S.cage.z, r: 1.2 });
    if (!F.iceWall) { const x = S.fen.x - S.fen.r - 3.5; out.push({ id: 'icewall', x, y: at(x, S.fen.z, 3), z: S.fen.z, r: 5 }); }
    for (let i = 0; i < 3; i++) if (!G.vents[i].plugged) { const v = ventPos(i); out.push({ id: 'vent', i, x: v.x, y: FEN_FLOOR + 1.6, z: v.z, r: 1.0 }); }
    if (!F.stoneWood) out.push({ id: 'stone', reg: 'wood', x: S.mere.x, y: at(S.mere.x, S.mere.z, 1.6), z: S.mere.z, r: 1.1 });
    if (!F.stoneFen) out.push({ id: 'stone', reg: 'fen', x: S.pool.x, y: at(S.pool.x, S.pool.z, 1.6), z: S.pool.z, r: 1.1 });
    if (!F.stoneMoor) out.push({ id: 'stone', reg: 'moor', x: S.storm.x, y: at(S.storm.x, S.storm.z, 1.6), z: S.storm.z, r: 1.1 });
    if (!F.bridge) out.push({ id: 'seedbed', x: S.seedbed.x, y: at(S.seedbed.x, S.seedbed.z, 0.3), z: S.seedbed.z, r: 1.8 });
    for (const p of G.pickups) if (p.kind === 'bush' && !p.alive) out.push({ id: 'bush', p, x: p.x, y: at(p.x, p.z, 0.7), z: p.z, r: 1.0 });
    if (!F.thornGap) for (const t of thornPoints()) out.push({ id: 'thorn', i: t.i, x: t.x, y: 9, z: t.z, r: 3.5 });
    if (!F.door) out.push({ id: 'door', x: 0, y: HILLTOP + 1.6, z: S.keep.z1, r: 1.6 });
    if (!G.won) out.push({ id: 'heart', x: S.heart.x, y: HILLTOP + S.gallery.up + 1.7, z: S.heart.z, r: 1.4 });
    for (const s of G.shades) out.push({ id: 'shade', s, x: s.x, y: s.y + 1.2, z: s.z, r: 0.9 });
    const floor = W.hutFloor;
    for (const o of circleObjects(W)) out.push({ id: 'circle', o, x: o.x, y: floor + 0.75, z: o.z, r: 0.35 });
    if (!F.hearth) { const h = W.hutAt('hearth'); out.push({ id: 'hearth', x: h.x, y: floor + 0.6, z: h.z, r: 0.8 }); }
    for (const id in ECHO_POS) if (!G.echoes[id]) {
        const p = ECHO_POS[id]();
        out.push({ id: 'echo', echo: id, x: p.x, y: (p.inHut ? floor : W.height(p.x, p.z)) + 1.4, z: p.z, r: 2.5 });
    }
    return out;
}

// ------------------------------------------------------------------ aiming
export function aimDir(p) {
    const cp = Math.cos(p.pitch);
    return { x: Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * cp };
}

/** A bolt's flight: the first target or the ground it meets. */
export function raycast(G, list = targets(G)) {
    const W = worldOf(G);
    const p = G.p;
    const o = { x: p.x, y: p.y + PLAYER.eye - 0.1, z: p.z };
    const d = aimDir(p);
    let tMax = MAGIC.boltRange;
    for (let t = 0.5; t < MAGIC.boltRange; t += 0.5) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < supportAt(G, x, z, y + 0.3) - 0.05) { tMax = t; break; }
    }
    let best = null, bt = tMax;
    for (const tg of list) {
        const vx = tg.x - o.x, vy = tg.y - o.y, vz = tg.z - o.z;
        const tca = vx * d.x + vy * d.y + vz * d.z;
        if (tca < 0) continue;
        const d2 = vx * vx + vy * vy + vz * vz - tca * tca;
        if (d2 > tg.r * tg.r) continue;
        const t = Math.max(0, tca - Math.sqrt(tg.r * tg.r - d2));
        if (t < bt) { bt = t; best = tg; }
    }
    return { target: best, t: bt, from: o, to: { x: o.x + d.x * bt, y: o.y + d.y * bt, z: o.z + d.z * bt } };
}

// ------------------------------------------------------------------ casting
export function castSlot(G) {
    const L = G.laws;
    if (!G.hasWand) { msg(G, 'You have nothing to cast with.'); return null; }
    const slot = G.wand[G.sel];
    if (!slot || !slot.glyphs.length) { msg(G, 'That slot of your Focus is blank. Write a spell in your book (Tab).'); emit(G, { type: 'blank' }); return null; }
    if (slot.charges <= 0) { msg(G, 'That spell is spent. Feed it again in your book.'); emit(G, { type: 'blank' }); return null; }
    const res = evaluate(L, slot, phaseNow(G));
    slot.charges--;
    G.stats.casts++;
    recordCast(G, slot, res);
    const p = G.p;
    if (res.fail) {
        G.stats.fizzles++;
        msg(G, res.text, 'fizzle');
        emit(G, { type: 'fizzle', fail: res.fail, x: p.x, y: p.y + PLAYER.eye, z: p.z });
        bark(G, 'fizzle', NIB.barks.fizzle);
        return res;
    }
    if (!G.flags.firstSpell) {
        G.flags.firstSpell = true;
        G.stats.firstSpellDay = G.day;
        emit(G, { type: 'firstSpell' });
    }
    const color = spellColor(L, res);
    const name = res.essence === 'unweave' ? 'Unweaving' : ESSENCE_INFO[res.essence].name;
    const list = targets(G);
    let reacted = false;
    if (res.form === 'bolt') {
        const hit = raycast(G, list);
        emit(G, { type: 'cast', form: 'bolt', essence: res.essence, color, power: res.power, from: hit.from, to: hit.to, hit: hit.target?.id || null });
        if (hit.target) reacted = affect(G, hit.target, res);
    } else if (res.form === 'ward') {
        const dur = MAGIC.wardBase + MAGIC.wardPer * res.power;
        G.p.wards[res.essence] = Math.max(G.p.wards[res.essence] || 0, dur);
        emit(G, { type: 'cast', form: 'ward', essence: res.essence, color, power: res.power, x: p.x, y: p.y, z: p.z, dur });
        const c = { x: p.x, y: p.y + 1, z: p.z };
        for (const t of list) if (near(t, c, 3.4)) reacted = affect(G, t, res) || reacted;
    } else {
        const f = { x: Math.sin(p.yaw), z: -Math.cos(p.yaw) };
        const x = p.x + f.x * 1.8, z = p.z + f.z * 1.8;
        const y = supportAt(G, x, z, p.y + 0.4);
        const seal = makeSeal(G, res, x, y, z);
        emit(G, { type: 'cast', form: 'seal', essence: res.essence, color, power: res.power, x, y, z, kind: seal.kind });
        const c = { x, y: y + 1, z };
        for (const t of list) if (near(t, c, t.id === 'heart' ? 3.2 : 3.4)) reacted = affect(G, t, res, seal) || reacted;
    }
    if (!reacted) msg(G, `${name} ${FORM_INFO[res.form].name.toLowerCase()}${res.power >= 2 ? ` (strength ${res.power})` : ''}.`, 'spell');
    return res;
}

const near = (t, c, r) => Math.hypot(t.x - c.x, (t.y - c.y) * 0.6, t.z - c.z) < r + t.r * 0.5;

function makeSeal(G, res, x, y, z) {
    const W = worldOf(G);
    const e = res.essence;
    const s = { id: 's' + (G.sealSeq = (G.sealSeq || 0) + 1), essence: e, x, y, z, t: MAGIC.sealTime, power: res.power, kind: 'sigil', r: 2 };
    if (e === 'kindle') { s.kind = 'fire'; s.r = MAGIC.fireSealRadius; }
    else if (e === 'rime') {
        // over (or right by) water: a floe you can stand on
        let wl = null;
        for (const [dx, dz] of [[0, 0], [1.8, 0], [-1.8, 0], [0, 1.8], [0, -1.8]]) {
            const w = W.water(x + dx, z + dz);
            if (w && w.kind !== 'boil' && w.kind !== 'hot') { wl = w.level; break; }
        }
        if (wl != null) { s.kind = 'floe'; s.r = MAGIC.iceRadius; s.level = wl; s.y = wl; }
        else s.kind = 'icicle';
    } else if (e === 'lumen') { s.kind = 'beacon'; s.r = MAGIC.beaconRadius; }
    else if (e === 'bloom') s.kind = 'growth';
    else if (e === 'gale') { s.kind = 'updraft'; s.r = MAGIC.updraftRadius; s.t = MAGIC.updraftTime; s.lift = y + MAGIC.updraftLift; }
    else if (e === 'still') { s.kind = 'stillness'; s.r = MAGIC.stillRadius; }
    else if (e === 'unweave') { s.kind = 'rend'; s.t = 6; s.r = 3; }
    G.seals.push(s);
    if (G.seals.length > 24) G.seals.shift();
    return s;
}

// ------------------------------------------------------------------ what a spell does to a thing
function affect(G, t, res, seal = null) {
    const L = G.laws, F = G.flags, e = res.essence, P = res.power;
    const say = (text, tone = 'spell') => msg(G, text, tone);
    switch (t.id) {
        case 'cage':
            if (e === 'kindle' || e === 'rime' || e === 'gale') {
                G.nib.mode = 'freed';
                say({ kindle: 'The thorns catch fire, crackle and fall away to ash.', rime: 'The thorns freeze white and shatter like glass.', gale: 'A gust tears the thorns apart and flings them into the trees.' }[e]);
                emit(G, { type: 'flag', name: 'nibFree', x: t.x, y: t.y, z: t.z });
                return true;
            }
            if (e === 'lumen') { say('The thorns flinch from the light, but hold tight.'); return true; }
            return false;
        case 'icewall':
            if (e === 'kindle' && P >= 2) {
                F.iceWall = true;
                say('The frozen falls groan, crack, and come down in a roar of meltwater. The gorge is open.', 'good');
                emit(G, { type: 'flag', name: 'iceWall', x: t.x, y: t.y, z: t.z });
                bark(G, 'icewall', NIB.barks.icewall);
                return true;
            }
            if (e === 'kindle') { say('The ice weeps a little where the warmth touches it, then freezes again. It needs far more strength.'); return true; }
            return false;
        case 'vent': {
            const v = G.vents[t.i];
            if (e === 'rime' && P >= 2) { v.plugged = true; say('The vent chokes on a plug of ice and falls silent for good.', 'good'); emit(G, { type: 'vent', i: t.i, plugged: true }); return true; }
            if (e === 'gale' || e === 'still') { v.clear = G.t + 90; say(e === 'gale' ? 'The wind blows the steam flat and holds it down.' : 'The steam stops rising, frozen in place like cotton.', 'good'); emit(G, { type: 'vent', i: t.i }); return true; }
            if (e === 'rime') { say('Ice forms in the vent and the steam melts it at once. Stronger cold might hold.'); return true; }
            if (e === 'kindle') { say('The vent roars hotter. That did not help.'); return true; }
            return false;
        }
        case 'stone': {
            const want = L.stoneEssence[t.reg];
            if (e !== want) { say(e === 'unweave' ? 'The stone shudders, but this is not its word.' : 'The stone ignores you. That is not its word.'); return true; }
            if (P < 2) { say('The stone stirs and its mark flickers, but it falls asleep again. It needs to hear its word more strongly.'); return true; }
            const key = { wood: 'stoneWood', fen: 'stoneFen', moor: 'stoneMoor' }[t.reg];
            F[key] = true;
            say('The stone wakes. Its mark blazes, and a thread of light leaps from it toward the castle on the hill.', 'good');
            emit(G, { type: 'stone', reg: t.reg, x: t.x, y: t.y, z: t.z, color: L.color[want] });
            bark(G, 'stone', NIB.barks.stone);
            return true;
        }
        case 'seedbed':
            if (e === 'bloom') {
                F.bridge = true;
                say('The seedbed erupts. Vines pour out across the water, knotting into a bridge as wide as a cart.', 'good');
                emit(G, { type: 'flag', name: 'bridge', x: t.x, y: t.y, z: t.z });
                bark(G, 'bridge', NIB.barks.bridge);
                return true;
            }
            return false;
        case 'bush':
            if (e === 'bloom') { t.p.alive = true; say('The bramble flowers and fruits in a breath.'); return true; }
            return false;
        case 'thorn':
            if (e === 'unweave') {
                if (t.i === 0) {
                    F.thornGap = true;
                    say('The thorns come apart like wet paper, and this time they stay apart. A way is open to the castle.', 'good');
                    emit(G, { type: 'flag', name: 'thornGap', x: t.x, y: t.y, z: t.z });
                    bark(G, 'thorns', NIB.barks.thorns);
                } else say('The thorns unravel, then knit again. They are thinnest where the old road meets them, to the south.');
                return true;
            }
            if (e === 'kindle') { say('The thorns burn black and grow straight back as you watch.'); return true; }
            if (e === 'rime' || e === 'gale') { say('The thorns shrug it off. This is the curse itself, not a hedge.'); return true; }
            return false;
        case 'door':
            if (e === 'lumen') {
                F.door = true;
                say('Under the light the blank wall shows its seams, and a door that was hiding there swings open.', 'good');
                emit(G, { type: 'flag', name: 'door', x: t.x, y: t.y, z: t.z });
                bark(G, 'door', NIB.barks.door);
                return true;
            }
            return false;
        case 'heart': {
            if (e !== 'unweave') { say(`Elowen's bubble does not so much as ripple. ${e === 'still' ? 'It is already as still as anything can be.' : ''}`); return true; }
            const want = [...L.elowen].sort().join('|');
            const got = [...res.pair].sort().join('|');
            if (got !== want) { say('The bubble shivers, then steadies. These words hate each other, but this is not the seam she tore.'); return true; }
            if (res.form !== 'seal') { say('The bubble shivers where the spell strikes it. It must be set down at her feet, not thrown.'); return true; }
            if (P < 3) { say('The seam in the air loosens... and closes again. It needs to be stronger.'); return true; }
            G.won = true;
            emit(G, { type: 'win', x: t.x, y: t.y, z: t.z });
            return true;
        }
        case 'shade':
            if (e === 'lumen' || e === 'unweave') {
                G.shades = G.shades.filter((s) => s !== t.s);
                emit(G, { type: 'shadeDie', x: t.s.x, y: t.s.y + 1, z: t.s.z });
                return true;
            }
            return false;
        case 'circle': {
            if (e === 'unweave') { msg(G, 'Everything in the circle flickers, as if for a moment it was not there at all.', 'spell'); emit(G, { type: 'circle', all: true }); return true; }
            if (t.o.e !== e) return false;
            msg(G, t.o.say, 'spell');
            emit(G, { type: 'circle', obj: t.o.id, x: t.x, y: t.y, z: t.z });
            return true;
        }
        case 'hearth':
            if (e === 'kindle') { F.hearth = true; msg(G, 'The hearth catches with a whump, and the hut fills with warm light.', 'good'); emit(G, { type: 'flag', name: 'hearth' }); return true; }
            return false;
        case 'echo':
            if ((e === 'lumen') && isNight(G)) {
                G.echoes[t.echo] = 'shown';
                msg(G, 'In the light, a faint figure of a girl stands where no one was. Her lips are moving.', 'good');
                emit(G, { type: 'echoShown', id: t.echo, x: t.x, y: t.y, z: t.z });
                return true;
            }
            return false;
    }
    return false;
}

// ------------------------------------------------------------------ fields: wards and seals over time
export function wardOn(G, e) { return (G.p.wards[e] || 0) > 0; }

export function stillAt(G, x, z) {
    if (wardOn(G, 'still') && Math.hypot(G.p.x - x, G.p.z - z) < 3) return true;
    return G.seals.some((s) => s.kind === 'stillness' && Math.hypot(s.x - x, s.z - z) < s.r);
}
export function ventActive(G, i) {
    const v = G.vents[i];
    if (v.plugged || G.t < v.clear) return false;
    const p = ventPos(i);
    return !stillAt(G, p.x, p.z);
}
export function nearFire(G, x, z, y = null) {
    const W = worldOf(G);
    if (G.flags.hearth) { const h = W.hutAt('hearth'); if (Math.hypot(h.x - x, h.z - z) < 4.6) return 'hearth'; }
    const s = G.seals.find((s) => s.kind === 'fire' && Math.hypot(s.x - x, s.z - z) < s.r && (y == null || Math.abs(s.y - y) < 3));
    return s ? 'fire' : null;
}

export function tickFields(G, dt) {
    const p = G.p;
    for (const k in p.wards) { p.wards[k] -= dt; if (p.wards[k] <= 0) { delete p.wards[k]; emit(G, { type: 'wardEnd', essence: k }); } }
    for (const s of G.seals) s.t -= dt;
    if (G.seals.some((s) => s.t <= 0)) G.seals = G.seals.filter((s) => s.t > 0);
    // light shows what hides: the keep door (a lumen ward close by, or a beacon), and echoes by night
    const lit = (x, z, r) => (wardOn(G, 'lumen') && Math.hypot(p.x - x, p.z - z) < r) || G.seals.some((s) => s.kind === 'beacon' && Math.hypot(s.x - x, s.z - z) < s.r);
    if (!G.flags.door && lit(0, SITES.keep.z1, 6)) {
        G.flags.door = true;
        msg(G, 'Your light finds the seams in the blank wall, and a door that was hiding there swings open.', 'good');
        emit(G, { type: 'flag', name: 'door', x: 0, y: HILLTOP + 1.6, z: SITES.keep.z1 });
    }
    if (isNight(G)) {
        for (const id in ECHO_POS) {
            if (G.echoes[id]) continue;
            const e = ECHO_POS[id]();
            if (lit(e.x, e.z, 9)) {
                G.echoes[id] = 'shown';
                msg(G, 'In the light, a faint figure of a girl stands where no one was. Her lips are moving.', 'good');
                emit(G, { type: 'echoShown', id, x: e.x, y: p.y + 1.4, z: e.z });
            }
        }
    }
    // a growth seal set by a bush or the seedbed works like a bloom spell on them
    for (const s of G.seals) {
        if (s.kind !== 'growth' || s.done) continue;
        s.done = true;
        if (!G.flags.bridge && Math.hypot(s.x - SITES.seedbed.x, s.z - SITES.seedbed.z) < 4.5) {
            G.flags.bridge = true;
            msg(G, 'The seedbed erupts. Vines pour out across the water, knotting into a bridge as wide as a cart.', 'good');
            emit(G, { type: 'flag', name: 'bridge', x: SITES.seedbed.x, y: s.y, z: SITES.seedbed.z });
        }
        for (const b of G.pickups) if (b.kind === 'bush' && !b.alive && Math.hypot(b.x - s.x, b.z - s.z) < 4.5) b.alive = true;
    }
}
