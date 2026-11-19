// The castle generator: new castles from the same building kit as the hand-made ones, for the
// campaign (fixed seeds, proved by dev/simtest.mjs to stand and to be winnable) and for Endless
// Siege (any seed; game.js checks a generated castle stands before it is played).
//
// A castle is a row of modules across the meadow (towers, walls, keeps, spires, crate stores,
// colonnades), sometimes a second row behind and a cliff underneath, then bridges between towers
// of the same height. Every module reports its "perches": the surfaces it built that someone can
// stand on. People only ever stand on a perch, so nobody floats or stands inside a roof.
// Pure: randomness only from the seed.

import { makeRng } from '../rng.js';

const PALETTES = {
    meadow: { wall: ['stone', 'stone', 'brick'], tower: ['stone', 'brick', 'wood'], accent: ['wood'], tip: 'meadow' },
    frost: { wall: ['stone', 'stone', 'ice'], tower: ['stone', 'ice'], accent: ['ice', 'wood'], tip: 'frost' },
    sunset: { wall: ['brick', 'brick', 'stone'], tower: ['brick', 'stone', 'wood'], accent: ['wood'], tip: 'sunset' },
    marsh: { wall: ['stone', 'wood', 'brick'], tower: ['stone', 'wood', 'brick'], accent: ['wood', 'ice'], tip: 'marsh' },
};

const NAME_A = ['Wobble', 'Puddle', 'Crumble', 'Bumble', 'Snooze', 'Tumble', 'Pickle', 'Muffin', 'Jiggle', 'Doodle', 'Biscuit', 'Fiddle', 'Noodle', 'Waffle', 'Pudding', 'Sprocket', 'Thimble', 'Gumdrop', 'Hiccup', 'Turnip', 'Bramble', 'Sniffle', 'Custard', 'Teacup'];
const NAME_B = ['stone', 'bottom', 'top', 'spire', 'hold', 'wick', 'nook', 'gate', 'crest', 'ford', 'moat', 'tower', 'mere', 'wood', 'bury', 'cliff'];
const KINDS = ['Castle', 'Fort', 'Keep', 'Citadel', 'Stronghold', 'Bastion', 'Towers', 'Palace', 'Hall'];
const KNIGHTS = ['Sir Clank', 'Sir Bonkers', 'Dame Wobbly', 'Sir Fumbles', 'Sir Dimple', 'Dame Tinpot', 'Sir Kettle', 'Sir Noggin', 'Dame Pudding', 'Sir Squeak', 'Sir Pebble', 'Dame Jangle', 'Sir Butterfingers', 'Sir Oddsock', 'Dame Clatter', 'Sir Biscuit', 'Sir Hobnob', 'Dame Rattle', 'Sir Wibble', 'Sir Teacake'];
const KINGS = ['King Waffle', 'Queen Crumpet', 'King Doodlebug', 'Queen Marmalade', 'King Snorkel', 'Queen Bonbon'];
const WIZARDS = ['Fizzlebeard', 'Old Mumblewort', 'Sparkletoes', 'Hocus Pokewell', 'Nimbus Snoot'];
const INTROS = [
    '{who} and friends think these walls are unbreakable. Show them otherwise.',
    'Everyone inside is having a nice cup of tea. What a shame.',
    'The builders were paid in jam. It shows.',
    '{who} has been practising looking brave all morning.',
    'Look at all those blocks. Just look at them. Begging to fall over.',
    'Rumour says {who} once survived a sneeze. Let\'s test that.',
    'A fine castle with a fine view. Of you. And your cannon.',
    'Somebody stacked this very carefully. It would be rude not to un-stack it.',
];

const quatYaw = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
// the most blocks a generated castle starts with: breaking can add up to BREAK.maxBodies (520), and
// a phone has to simulate a collapse of all of it
const BUDGET = 340;

/**
 * Make a castle. tier in [0, 1]: 0 is a gentle first castle, 1 a monster.
 * Returns a level like those in levels.js: { id, name, region, intro, ammo, stars, star, build(K) }.
 */
export function generateCastle(seed, tier, region, id) {
    const rng = makeRng(((seed * 2654435761) ^ 0x5bd1e995) >>> 0);
    const pal = PALETTES[region] || PALETTES.meadow;
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const chance = (p) => rng() < p;
    const T = Math.max(0, Math.min(1, tier));

    // ------------------------------------------------------------------ the plan (data only)
    const plan = { mods: [], back: null, cliff: null };
    const span = 7 + T * 6;                 // half width of the front row
    const z0 = 28 + rng() * 3;
    const baseCourses = 4 + Math.round(T * 6);
    let x = -span;
    const types = ['tower', 'tower', 'round', 'wall', 'wall', 'keep', 'shelf', 'colonnade', 'spire'];
    while (x < span - 1.5) {
        let t = pick(types);
        if (t === 'spire' && T < 0.3) t = 'tower';
        if (t === 'keep' && x > span - 4.5) t = 'tower';
        let w;
        if (t === 'tower') w = chance(0.3 + T * 0.3) ? 3 : 2;
        else if (t === 'round') w = 2.4;
        else if (t === 'wall') w = 2 + Math.floor(rng() * 3);   // 2..4
        else if (t === 'keep') w = 4;
        else if (t === 'shelf') w = 3;
        else if (t === 'colonnade') w = 3;
        else w = 1.5;
        if (x + w > span + 0.5) { t = 'tower'; w = 2; if (x + w > span + 0.5) break; }
        plan.mods.push({ t, x: x + w / 2, w, mat: t === 'wall' ? pick(pal.wall) : pick(pal.tower) });
        x += w + (t === 'wall' ? 0 : 0.6 + rng() * 0.8);
    }
    // walls only between other things: a wall at an end becomes a tower
    // (and steps 0.3 outward: a wall's neighbour sits flush against it, and a round tower or a
    // spire's slab pokes 0.2 past its footprint)
    plan.mods.forEach((m, i) => {
        if (m.t !== 'wall' || (i !== 0 && i !== plan.mods.length - 1)) return;
        const out = i === 0 ? -1 : 1;
        m.x += out * (0.3 + (m.w - 2) / 2);
        m.t = 'tower'; m.w = 2;
    });
    if (T > 0.35 && chance(0.6)) plan.back = { x: (rng() - 0.5) * 4, w: 4, courses: baseCourses + 4, mat: pick(pal.tower) };
    if (region === 'sunset' && chance(0.5) || region === 'marsh' && chance(0.3)) plan.cliff = { h: 1.5 + Math.round(rng() * 3) * 0.5 };

    // ------------------------------------------------------------------ people
    const people = 2 + Math.round(T * 4 + rng() * 1.2);
    const crates = plan.mods.some((m) => m.t === 'shelf') || chance(0.25 + T * 0.3);

    // rack: enough for a careful player, a little spare for fun
    const ammo = { iron: 2 + Math.round(T * 2) };
    if (people >= 3 || crates) ammo.boom = 1 + (T > 0.6 ? 1 : 0);
    if (people >= 3 && chance(0.7)) ammo.triple = 1;
    if (T > 0.3 && chance(0.6)) ammo.bertha = 1;
    if (T > 0.45 && chance(0.4)) ammo.boing = 1;
    // casual: always at least one ball more than there are people (no random draw here, so the
    // castle itself doesn't change)
    const balls = Object.values(ammo).reduce((a, b) => a + b, 0);
    if (balls < people + 1) ammo.iron += people + 1 - balls;

    // the ending of the made-up word mustn't repeat the kind ("Towers Sprockettower", "Thimblehold Stronghold")
    const kind = pick(KINDS);
    const ends = NAME_B.filter((b) => !kind.toLowerCase().includes(b) && !(b === 'tower' && kind === 'Towers'));
    const word = `${pick(NAME_A)}${pick(ends)}`;
    const name = chance(0.5) ? `${kind} ${word}` : `The ${word} ${kind}`;
    const knightNames = [...KNIGHTS];
    const nextKnight = () => knightNames.splice(Math.floor(rng() * knightNames.length), 1)[0] || 'Sir Extra';
    const king = T > 0.45 && chance(0.55) ? pick(KINGS) : null;
    const wizard = plan.mods.some((m) => m.t === 'spire') || (T > 0.3 && chance(0.3)) ? pick(WIZARDS) : null;
    const who = king || wizard || knightNames[0];
    const intro = pick(INTROS).replace('{who}', who);
    const seedSalt = Math.floor(rng() * 1e9);

    // ------------------------------------------------------------------ building
    function build(K) {
        const r = makeRng(seedSalt);
        const perches = [];   // { x, y, z, w, h (height for "the top"), kind }
        const y0 = plan.cliff ? K.rock(0, 0, z0 + 2.5, span * 2 + 3, plan.cliff.h, 11) : 0;
        const roofs = (S, top, xx, zz) => {
            K.roof(xx, top, zz, S, 1.4 + S * 0.25);
        };
        const towers = [];
        for (const m of plan.mods) {
            const zz = z0;
            const c = baseCourses + Math.round((r() - 0.3) * 4);
            if (K.parts.length > BUDGET) { m.skipped = true; continue; }
            if (m.t === 'tower') {
                const S = m.w;
                const win = m.mat !== 'ice' && r() < 0.5 ? (cc, side) => (cc % 4 === 2 && side === 0 ? 'ice' : null) : undefined;
                const top = K.tower(m.mat, m.x, zz, S, y0, c, { window: win });
                K.slab('wood', m.x, top, zz, S, S);
                if (r() < 0.4) { roofs(S, top + 0.2, m.x, zz); }
                else if (r() < 0.5 && S >= 3) {
                    K.crenels(m.mat, m.x, zz, S, top + 0.2, 0.4);
                    perches.push({ x: m.x, y: top + 0.2, z: zz, w: S - 1.6, kind: 'top' });
                } else {
                    towers.push({ x: m.x, top: top + 0.2, half: S / 2, z: zz });   // a plain top: a bridge may land on it
                    perches.push({ x: m.x, y: top + 0.2, z: zz, w: S - 1.0, kind: 'top' });
                }
                if (r() < 0.25) K.flag(m.x + S / 2 - 0.3, top + 0.6, zz + S / 2 - 0.3, pick(['red', 'blue', 'gold']));
            } else if (m.t === 'round') {
                const R = 1.0 + r() * 0.2;
                const top = K.ring(m.mat === 'wood' ? 'stone' : m.mat, m.x, zz, R, y0, c + 2, { n: 8 });
                K.slab('wood', m.x, top, zz, R * 2 + 0.2, R * 2 + 0.2);
                if (r() < 0.35) roofs(R * 1.6, top + 0.2, m.x, zz);
                else {
                    towers.push({ x: m.x, top: top + 0.2, half: R + 0.1, z: zz });
                    perches.push({ x: m.x, y: top + 0.2, z: zz, w: R * 1.4, kind: 'top' });
                }
            } else if (m.t === 'wall') {
                const cc = Math.max(3, c - 2 - Math.round(r() * 2));
                const top = K.wallX(m.mat, m.x - m.w / 2 + 0.25, m.x + m.w / 2 - 0.25, zz, y0, cc);
                perches.push({ x: m.x, y: top, z: zz, w: m.w - 1.2, kind: 'wall', thin: true });
            } else if (m.t === 'keep') {
                const top = K.tower(m.mat, m.x, zz, 4, y0, c, { window: (cc, side) => (cc % 3 === 1 && side === 0 && m.mat !== 'ice' ? 'ice' : null) });
                // an inner floor on four columns, out of sight until the walls come down
                const fh = Math.min(c - 1, 3);
                for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) K.column('stone', m.x + dx, y0, zz + dz, fh);
                K.slab('wood', m.x, y0 + fh * 0.5, zz, 2.6, 2.6);
                perches.push({ x: m.x, y: y0 + fh * 0.5 + 0.2, z: zz, w: 1.2, kind: 'inside' });
                K.slab('wood', m.x, top, zz, 4, 4);
                if (r() < 0.5) { K.crenels(m.mat, m.x, zz, 4, top + 0.2); perches.push({ x: m.x, y: top + 0.2, z: zz, w: 1.8, kind: 'top' }); }
                else { towers.push({ x: m.x, top: top + 0.2, half: 2, z: zz }); perches.push({ x: m.x, y: top + 0.2, z: zz, w: 2.2, kind: 'top' }); }
            } else if (m.t === 'shelf') {
                // built after the loop (columns, crates, a plank); people stand on the plank
                m.perch = { x: m.x, y: y0 + 2.65, z: zz, w: 2.2, kind: 'shelf' };
                perches.push(m.perch);
            } else if (m.t === 'colonnade') {
                const h = 3 + Math.round(r() * 3);
                let t = y0;
                for (const dx of [-1.1, 1.1]) t = K.column(m.mat === 'wood' ? 'stone' : m.mat, m.x + dx, y0, zz, h);
                K.slab('wood', m.x, t, zz, 3.0, 1.0, 0.2);
                perches.push({ x: m.x, y: t + 0.2, z: zz, w: 1.6, kind: 'top', thin: true });
            } else if (m.t === 'spire') {
                const top = K.tower('stone', m.x, zz, 1.5, y0, c + 8, { L: 0.75 });
                K.slab('wood', m.x, top, zz, 1.9, 1.9);
                towers.push({ x: m.x, top: top + 0.2, half: 0.95, z: zz });
                perches.push({ x: m.x, y: top + 0.2, z: zz, w: 0.6, kind: 'spire' });
            }
        }
        // shelves: built here so both columns are the same height
        for (const m of plan.mods) {
            if (m.t !== 'shelf' || m.skipped) continue;
            if (K.parts.length > BUDGET) { m.perch.dead = true; continue; }   // no shelf, so nobody stands where it would be
            for (const dx of [-1, 1]) { const t = K.column('wood', m.x + dx, y0, z0, 3, 0.6); K.crate(m.x + dx, t, z0); }
            K.slab('wood', m.x, y0 + 2.4, z0, 3.0, 1.2, 0.25);
            K.crate(m.x, y0, z0);
        }
        // bridges between neighbouring towers whose tops are level
        towers.sort((a, b) => a.x - b.x);
        for (let i = 0; i + 1 < towers.length; i++) {
            const a = towers[i], b = towers[i + 1];
            const gap = (b.x - b.half) - (a.x + a.half);
            if (Math.abs(a.top - b.top) < 0.01 && gap > 0.4 && gap < 3.2 && r() < 0.7) {
                const len = gap + 0.8;
                K.slab('wood', (a.x + a.half + b.x - b.half) / 2, a.top, z0, len, 1.0, 0.2);
                perches.push({ x: (a.x + a.half + b.x - b.half) / 2, y: a.top + 0.2, z: z0, w: Math.max(0.4, gap - 0.6), kind: 'bridge', thin: true });
            }
        }
        // a big keep behind
        if (plan.back && K.parts.length < BUDGET - 110) {
            const B = plan.back, zz = z0 + 5;
            const top = K.tower(B.mat, B.x, zz, B.w, y0, B.courses, { window: (cc, side) => (cc % 4 === 2 && side === 0 && B.mat !== 'ice' ? 'ice' : null) });
            K.slab('wood', B.x, top, zz, B.w, B.w);
            perches.push({ x: B.x, y: top + 0.2, z: zz, w: 2.2, kind: 'top', high: true });
        }
        // crates scattered at the foot of the walls
        if (crates) {
            const n = 1 + Math.floor(r() * (2 + T * 3));
            for (let i = 0; i < n; i++) {
                const xx = -span + 1 + r() * (span * 2 - 2);
                const zz = z0 - 1.3 - r() * 0.4;
                if (!K.parts.some((p) => !p.char && !p.flag && Math.abs(p.p[0] - xx) < (p.h ? p.h[0] + 0.45 : 0.5) && Math.abs(p.p[2] - zz) < (p.h ? p.h[2] + 0.45 : 0.5) && p.p[1] - (p.h ? p.h[1] : 0) < y0 + 0.7)) K.crate(xx, y0, zz);
            }
        }
        // ground perches: in front of the castle, when someone has to stand down there
        perches.push({ x: -span + 1, y: y0, z: z0 - 2.7, w: span * 2 - 2, kind: 'ground' });

        // ------------------------------------------------------------------ seat the people
        const slots = [];
        for (const p of perches) {
            if (p.dead) continue;
            const n = Math.max(1, Math.floor((p.w + 0.4) / 0.9));
            for (let i = 0; i < n && slots.length < 40; i++) {
                const xx = p.kind === 'ground' ? p.x + (i + 0.5) * (p.w / n) : p.x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * p.w);
                slots.push({ x: xx, y: p.y, z: p.z, kind: p.kind, high: p.y, thin: p.thin });
            }
        }
        // the most important people get the highest seats; ground seats come last
        slots.sort((a, b) => (a.kind === 'ground') - (b.kind === 'ground') || b.high - a.high || r() - 0.5);
        const used = [];
        // a seat is only good if the person's box there touches no block (a bridge landing on a
        // tower top, a crenel, a roof): checked against the real parts, axis-aligned and generous
        const clear = (q, role) => {
            const hw = role === 'knight' ? 0.24 : 0.3, hh = role === 'knight' ? 0.7 : 0.9;
            for (const p of K.parts) {
                if (p.char || p.flag) continue;
                const turned = p.q && Math.abs(p.q[1]) > 1e-6;
                const ex = turned ? Math.max(p.h[0], p.h[2]) : p.h[0], ez = turned ? ex : p.h[2];
                if (Math.abs(p.p[0] - q.x) < ex + hw && Math.abs(p.p[2] - q.z) < ez + hw && p.p[1] + p.h[1] > q.y + 0.01 && p.p[1] - p.h[1] < q.y + hh) return false;
            }
            return true;
        };
        const seat = (role, name, pred = () => true) => {
            const s = slots.find((q) => !used.includes(q) && pred(q) && !(role !== 'knight' && q.thin) && clear(q, role));
            if (!s) return false;
            used.push(s);
            K.char(role, s.x, s.y, s.z, name);
            return true;
        };
        let placed = 0;
        if (king && seat('king', king)) placed++;
        if (wizard && (seat('wizard', wizard, (q) => q.kind === 'spire') || seat('wizard', wizard))) placed++;
        // spread the rest: alternate high seats and others so they aren't all on one tower
        const rest = slots.filter((q) => !used.includes(q));
        const order = [];
        for (let i = 0; i < rest.length; i++) order.push(rest[i % 2 ? rest.length - 1 - Math.floor(i / 2) : Math.floor(i / 2)]);
        for (const q of order) {
            if (placed >= people) break;
            if (used.includes(q)) continue;
            if (used.some((u) => Math.abs(u.x - q.x) < 0.75 && Math.abs(u.y - q.y) < 0.5 && Math.abs(u.z - q.z) < 0.75)) continue;
            if (!clear(q, 'knight')) continue;
            used.push(q);
            K.char('knight', q.x, q.y, q.z, nextKnight());
            placed++;
        }
    }

    const star = king ? 'king' : wizard ? 'wizard' : 'knight';
    return { id, name, region, intro, ammo, star, gen: { seed, tier: T }, build };
}
