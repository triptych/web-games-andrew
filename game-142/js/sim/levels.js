// The castles. Each is built from a small kit (walls in running bond, interlocking square towers,
// round towers, slabs, roofs, crenels, crates) so that every assembly is made of real blocks that
// stack and fall. Pure data out: build() returns a list of body specs, the game turns them into
// bodies. dev/simtest.mjs proves every castle stands on its own, fully awake, before a shot.
//
// Coordinates: the cannon is at the origin and fires along +z; the ground is y = 0.

import { generateCastle } from './castlegen.js';

const GAP = 0.003;          // blocks side by side are made this much narrower, so they don't start overlapping

function quatYaw(a) { return [0, Math.sin(a / 2), 0, Math.cos(a / 2)]; }

/** Brick lengths for one course of running bond: odd courses start (and so end) with a half brick. */
function bond(span, L, odd) {
    const out = [];
    let rest = span;
    if (odd) { out.push(L / 2); rest -= L / 2; }
    while (rest > 1e-6) { const w = rest > L + 1e-6 ? L : rest; out.push(w); rest -= w; }
    return out;
}

export function makeKit() {
    const parts = [];
    const K = {
        parts,
        /** a block by its bottom-centre and full size */
        block(mat, x, y0, z, sx, sy, sz, o = {}) {
            parts.push({
                shape: 'box', mat, p: [x, y0 + sy / 2, z], q: o.yaw ? quatYaw(o.yaw) : [0, 0, 0, 1],
                h: [sx / 2 - GAP, sy / 2, sz / 2 - GAP], look: o.look, st: !!o.st,
            });
            return y0 + sy;
        },
        /** a wall running along x, in running bond: odd courses start and end with a half brick */
        wallX(mat, x0, x1, z, y0, courses, o = {}) {
            const H = o.H ?? 0.5, T = o.T ?? 0.5, L = o.L ?? 1;
            for (let c = 0; c < courses; c++) {
                const y = y0 + c * H;
                const m = o.matAt ? o.matAt(c) : mat;
                let x = x0;
                for (const w of bond(x1 - x0, L, (c + (o.phase ?? 0)) % 2)) { K.block(m, x + w / 2, y, z, w, H, T); x += w; }
            }
            return y0 + courses * H;
        },
        wallZ(mat, z0, z1, x, y0, courses, o = {}) {
            const H = o.H ?? 0.5, T = o.T ?? 0.5, L = o.L ?? 1;
            for (let c = 0; c < courses; c++) {
                const y = y0 + c * H;
                const m = o.matAt ? o.matAt(c) : mat;
                let z = z0;
                for (const w of bond(z1 - z0, L, (c + (o.phase ?? 0)) % 2)) { K.block(m, x, y, z + w / 2, T, H, w); z += w; }
            }
            return y0 + courses * H;
        },
        /**
         * A hollow square tower S × S, walls T thick. The courses interlock at the corners: even
         * courses run the front and back walls the full width, odd courses the sides.
         * o.window(c, side) → a material for that course's middle brick on a side (glass windows).
         */
        tower(mat, cx, cz, S, y0, courses, o = {}) {
            const H = o.H ?? 0.5, T = o.T ?? 0.5;
            const half = S / 2;
            for (let c = 0; c < courses; c++) {
                const y = y0 + c * H;
                const m = o.matAt ? o.matAt(c) : mat;
                const fullX = c % 2 === 0;
                const runs = [];
                if (fullX) {
                    runs.push({ ax: 'x', a0: cx - half, a1: cx + half, at: cz - half + T / 2, side: 0 });
                    runs.push({ ax: 'x', a0: cx - half, a1: cx + half, at: cz + half - T / 2, side: 2 });
                    runs.push({ ax: 'z', a0: cz - half + T, a1: cz + half - T, at: cx - half + T / 2, side: 3 });
                    runs.push({ ax: 'z', a0: cz - half + T, a1: cz + half - T, at: cx + half - T / 2, side: 1 });
                } else {
                    runs.push({ ax: 'z', a0: cz - half, a1: cz + half, at: cx - half + T / 2, side: 3 });
                    runs.push({ ax: 'z', a0: cz - half, a1: cz + half, at: cx + half - T / 2, side: 1 });
                    runs.push({ ax: 'x', a0: cx - half + T, a1: cx + half - T, at: cz - half + T / 2, side: 0 });
                    runs.push({ ax: 'x', a0: cx - half + T, a1: cx + half - T, at: cz + half - T / 2, side: 2 });
                }
                for (const r of runs) {
                    const span = r.a1 - r.a0;
                    if (span < 0.2) continue;
                    const n = Math.max(1, Math.round(span / (o.L ?? 1)));
                    const w = span / n;
                    for (let i = 0; i < n; i++) {
                        const a = r.a0 + w * (i + 0.5);
                        const mm = (o.window && i === Math.floor(n / 2) && o.window(c, r.side)) || m;
                        if (r.ax === 'x') K.block(mm, a, y, r.at, w, H, T); else K.block(mm, r.at, y, a, T, H, w);
                    }
                }
            }
            return y0 + courses * H;
        },
        /** a round tower: a ring of n bricks per course, every other course turned half a brick */
        ring(mat, cx, cz, R, y0, courses, o = {}) {
            const n = o.n ?? 8, H = o.H ?? 0.5, T = o.T ?? 0.45;
            const L = 2 * (R - T / 2) * Math.tan(Math.PI / n) - 0.02;
            for (let c = 0; c < courses; c++) {
                const m = o.matAt ? o.matAt(c) : mat;
                const off = (c % 2) * Math.PI / n;
                for (let i = 0; i < n; i++) {
                    const a = off + (i / n) * Math.PI * 2;
                    const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
                    parts.push({ shape: 'box', mat: m, p: [x, y0 + c * H + H / 2, z], q: quatYaw(a), h: [L / 2, H / 2, T / 2] });
                }
            }
            return y0 + courses * H;
        },
        slab(mat, cx, y0, cz, sx, sz, t = 0.2) { return K.block(mat, cx, y0, cz, sx, t, sz); },
        /** cubes along the top edge of an S × S square */
        crenels(mat, cx, cz, S, y0, s = 0.4) {
            const a = S / 2 - s / 2;
            for (const [x, z] of [[-a, -a], [a, -a], [-a, a], [a, a], [0, -a], [0, a], [-a, 0], [a, 0]]) K.block(mat, cx + x, y0, cz + z, s, s, s);
            return y0 + s;
        },
        /** a roof: its body is a squat box; the view draws a tall cone (look) on top of it */
        roof(cx, y0, cz, S, Hc = 1.6, look = 'cone') {
            parts.push({ shape: 'box', mat: 'roof', p: [cx, y0 + 0.3, cz], q: [0, 0, 0, 1], h: [S / 2 - GAP, 0.3, S / 2 - GAP], look, coneH: Hc });
            return y0 + 0.6;
        },
        column(mat, x, y0, z, n, s = 0.5) { let y = y0; for (let i = 0; i < n; i++) y = K.block(mat, x, y, z, s, s, s); return y; },
        crate(x, y0, z, s = 0.6) { return K.block('tnt', x, y0, z, s, s, s); },
        rock(x, y0, z, sx, sy, sz) { return K.block('rock', x, y0, z, sx, sy, sz, { st: true }); },
        /** a character standing on a surface at height y0, facing the cannon */
        char(role, x, y0, z, name) {
            parts.push({ char: role, name, p: [x, y0, z] });
            return y0;
        },
        flag(x, y0, z, color = 'red') { parts.push({ flag: color, p: [x, y0, z] }); },
    };
    return K;
}

// ------------------------------------------------------------------ the hand-made castles
// ammo: what is in the rack. stars: score for two and three stars (one is for clearing it).
const HANDMADE = [
    {
        id: 'watchtower', name: 'The Wobbly Watchtower', region: 'meadow',
        intro: 'Sir Wobbleton keeps watch from the top. Knock him off his perch!',
        ammo: { iron: 4 }, stars: [2500, 4500],
        build(K) {
            const top = K.tower('stone', 0, 28, 2, 0, 8);
            K.slab('wood', 0, top, 28, 2, 2);
            K.crenels('stone', 0, 28, 2, top + 0.2);
            K.char('knight', 0, top + 0.2, 28, 'Sir Wobbleton');
            K.wallX('stone', -5, -1, 28, 0, 3);
            K.wallX('stone', 1, 5, 28, 0, 3);
            K.flag(0.8, top + 0.6, 28.8, 'red');
        },
    },
    {
        id: 'gatehouse', name: "Sir Grumble's Gatehouse", region: 'meadow',
        intro: 'Two towers, one grumpy gate. Three knights on guard.',
        ammo: { iron: 3, boom: 1 }, stars: [4500, 7500],
        build(K) {
            for (const x of [-3.5, 3.5]) {
                const top = K.tower('stone', x, 30, 2, 0, 10);
                K.slab('wood', x, top, 30, 2, 2);
                K.roof(x, top + 0.2, 30, 2, 1.8);
                K.flag(x, top + 2.5, 30, x < 0 ? 'blue' : 'red');
            }
            const wt = K.wallX('stone', -2.5, 2.5, 30, 0, 6, { matAt: (c) => (c < 2 ? 'stone' : 'brick') });
            K.char('knight', -1.2, wt, 30, 'Sir Grumble');
            K.char('knight', 1.2, wt, 30, 'Sir Mumble');
            K.wallX('stone', -2.5, 2.5, 31, 0, 2, { phase: 1 });
            K.char('knight', 0, 1, 31, 'Sir Fumble');
        },
    },
    {
        id: 'timberfort', name: 'The Timber Fort', region: 'meadow',
        intro: 'A fort of logs and planks... and crates marked BOOM. What could go wrong?',
        ammo: { iron: 2, boom: 1, triple: 1 }, stars: [3000, 9000],
        build(K) {
            const t = K.tower('wood', 0, 31, 3, 0, 6);
            K.slab('wood', 0, t, 31, 3, 3);
            K.crate(-0.6, 0, 31); K.crate(0.6, 0, 31);
            for (const x of [-4, 4]) {
                const tt = K.tower('wood', x, 29.5, 2, 0, 5);
                K.slab('wood', x, tt, 29.5, 2, 2);
                K.char('knight', x, tt + 0.2, 29.5, x < 0 ? 'Sir Splinter' : 'Dame Knotty');
            }
            K.crate(-2.2, 0, 29.5); K.crate(2.2, 0, 29.5); K.crate(-2.2, 0.6, 29.5);
            K.char('knight', 0, t + 0.2, 31, 'Sir Timberlee');
        },
    },
    {
        id: 'twintowers', name: 'The Twin Towers of Toot', region: 'meadow',
        intro: 'Two round towers and a rickety bridge. The knights on it look nervous.',
        ammo: { iron: 2, triple: 1, bertha: 1, boom: 1 }, stars: [4500, 7500],
        build(K) {
            let top = 0;
            for (const x of [-2.6, 2.6]) {
                top = K.ring('stone', x, 32, 1.1, 0, 14);
                K.slab('wood', x, top, 32, 2.4, 2.4);
                K.char('knight', x + Math.sign(x) * 0.5, top + 0.2, 32, x < 0 ? 'Sir Toot' : 'Sir Tootle');
            }
            K.slab('wood', 0, top + 0.2, 32, 3.8, 1.0, 0.2);
            K.char('knight', 0, top + 0.4, 32, 'Sir Teeter');
            K.wallX('brick', -1, 1, 32, 0, 4);
        },
    },
    {
        id: 'iciclekeep', name: 'Icicle Keep', region: 'frost',
        intro: 'Walls of ice glitter in the cold. Ice shatters. Just saying.',
        ammo: { iron: 3, triple: 1 }, stars: [3000, 5500],
        build(K) {
            const ice = (c) => (c < 3 ? 'stone' : 'ice');
            const t = K.tower('stone', 0, 30, 4, 0, 8, { matAt: ice });
            K.slab('wood', 0, t, 30, 4, 4);
            K.char('knight', -0.9, t + 0.2, 30, 'Sir Shiver');
            K.char('knight', 0.9, t + 0.2, 30, 'Dame Frostine');
            for (const [x, z] of [[-0.9, 29.1], [0.9, 29.1], [-0.9, 30.9], [0.9, 30.9]]) K.column('stone', x, 0, z, 3);
            K.slab('wood', 0, 1.5, 30, 2.6, 2.6);
            K.char('knight', 0, 1.7, 30, 'Sir Sniffles');
            for (const x of [-3.5, 3.5]) {
                const tt = K.tower('ice', x, 30, 2, 0, 6);
                K.roof(x, tt, 30, 2, 1.6);
            }
        },
    },
    {
        id: 'snowcap', name: 'Snowcap Citadel', region: 'frost',
        intro: 'A tall round citadel with ice windows. Bounce something around in there!',
        ammo: { iron: 2, boom: 2, boing: 1 }, stars: [4000, 6500],
        build(K) {
            const t = K.ring('stone', 0, 32, 1.8, 0, 12, { n: 10, matAt: (c) => (c % 4 === 2 ? 'ice' : 'stone') });
            K.slab('wood', 0, t, 32, 3.8, 3.8);
            K.roof(0, t + 0.2, 32, 2.4, 2.2);
            K.column('stone', 0, 0, 32, 6);
            K.slab('wood', 0, 3, 32, 1.8, 1.8);
            K.char('knight', 0, 3.2, 32, 'Sir Brrr');
            K.char('knight', 1.55, t + 0.2, 32, 'Sir Flurry');
            for (const x of [-4.5, 4.5]) {
                const tt = K.tower('stone', x, 30, 2, 0, 7, { window: (c) => (c === 4 ? 'ice' : null) });
                K.slab('wood', x, tt, 30, 2, 2);
                K.char('knight', x, tt + 0.2, 30, x < 0 ? 'Dame Sleet' : 'Sir Slush');
            }
        },
    },
    {
        id: 'spire', name: "The Wizard's Spire", region: 'frost',
        intro: 'Mumbleby the Wizard lives at the very top. It is a long way down.',
        ammo: { iron: 3, bertha: 1 }, stars: [3000, 5000],
        build(K) {
            const t = K.tower('stone', 0, 33, 1.5, 0, 20, { L: 0.75, window: (c, s) => (c % 5 === 3 && s === 0 ? 'ice' : null) });
            K.slab('wood', 0, t, 33, 2.2, 2.2);
            let ct = 0;
            for (const [x, z] of [[-0.85, 32.15], [0.85, 32.15], [-0.85, 33.85], [0.85, 33.85]]) ct = K.column('stone', x, t + 0.2, z, 3, 0.3);
            K.slab('wood', 0, ct, 33, 2.0, 2.0);
            K.roof(0, ct + 0.2, 33, 1.8, 2.2);
            K.char('wizard', 0, t + 0.2, 33, 'Mumbleby');
            for (const x of [-2.5, 2.5]) {
                const tt = K.column('stone', x, 0, 31, 4);
                K.slab('wood', x, tt, 31, 1.2, 1.2);
                K.char('knight', x, tt + 0.2, 31, x < 0 ? 'Sir Hiccup' : 'Sir Hush');
            }
        },
    },
    {
        id: 'bastion', name: 'Frostbite Bastion', region: 'frost',
        intro: 'The knights are hiding in the courtyard. Lob one over the wall!',
        ammo: { iron: 2, boom: 2, triple: 1, boing: 1 }, stars: [6000, 10000],
        build(K) {
            const z0 = 28, z1 = 35, x0 = -4, x1 = 4;
            K.wallX('stone', x0 + 1.5, x1 - 1.5, z0 + 0.25, 0, 6);
            K.wallX('stone', x0 + 1.5, x1 - 1.5, z1 - 0.25, 0, 6);
            K.wallZ('stone', z0 + 1.5, z1 - 1.5, x0 + 0.25, 0, 6);
            K.wallZ('stone', z0 + 1.5, z1 - 1.5, x1 - 0.25, 0, 6);
            for (const [x, z] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5]]) {
                const tt = K.tower('stone', x, z, 2, 0, 8, { matAt: (c) => (c > 5 ? 'ice' : 'stone') });
                K.roof(x, tt, z, 2, 1.7);
            }
            K.char('knight', -1.5, 0, 31.5, 'Sir Chatterteeth');
            K.char('knight', 1.5, 0, 31.5, 'Dame Icicle');
            K.char('knight', 0, 0, 33, 'Sir Mittens');
            K.crate(0, 0, 30.5);
        },
    },
    {
        id: 'bluff', name: "Bertha's Bluff", region: 'sunset',
        intro: 'A castle on a cliff. Bring something big.',
        ammo: { bertha: 2, iron: 2, boom: 1 }, stars: [5500, 9000],
        build(K) {
            const top = K.rock(0, 0, 33, 10, 3, 6);
            for (const x of [-3, 3]) {
                const tt = K.tower('brick', x, 32, 2, top, 9);
                K.slab('wood', x, tt, 32, 2, 2);
                K.roof(x, tt + 0.2, 32, 2, 1.8);
                K.flag(x, tt + 2.5, 32, 'gold');
            }
            const wt = K.wallX('brick', -2, 2, 32, top, 5);
            K.char('knight', -0.8, wt, 32, 'Sir Cliffton');
            K.char('knight', 0.8, wt, 32, 'Sir Ledgely');
            K.slab('wood', 0, top, 34, 3, 2, 0.2);
            K.char('knight', 0, top + 0.2, 34, 'Dame Pebble');
        },
    },
    {
        id: 'treasury', name: 'The TNT Treasury', region: 'sunset',
        intro: 'They keep the royal fireworks here. Lots of fireworks.',
        ammo: { iron: 2, triple: 1 }, stars: [8000, 15000],
        build(K) {
            for (let i = 0; i < 5; i++) {
                const x = -4 + i * 2;
                const t = K.column('wood', x, 0, 31, 3, 0.6);
                K.crate(x, t, 31);
            }
            K.slab('wood', 0, 2.4, 31, 10, 1.2, 0.25);
            for (const x of [-3, -1, 1, 3]) K.char('knight', x, 2.65, 31, ['Sir Fizz', 'Sir Bang', 'Dame Pop', 'Sir Whizz'][(x + 3) / 2]);
            for (const x of [-0.9, -0.3, 0.3, 0.9]) K.crate(x, 0, 32.5);
            for (const x of [-0.6, 0, 0.6]) K.crate(x, 0.6, 32.5);
            K.wallX('wood', -5, 5, 33.5, 0, 4);
        },
    },
    {
        id: 'palace', name: 'Palace of Prince Pompous', region: 'sunset',
        intro: 'The Prince is very important. Just ask him. Bonk him and his guards.',
        ammo: { iron: 3, boom: 2, triple: 1, bertha: 1 }, stars: [6500, 11000],
        build(K) {
            const t = K.tower('brick', 0, 33, 4, 0, 8, { window: (c, s) => (c % 3 === 1 && s === 0 ? 'ice' : null) });
            K.slab('wood', 0, t, 33, 4, 4);
            K.crenels('brick', 0, 33, 4, t + 0.2);
            K.char('king', 0, t + 0.2, 33, 'Prince Pompous');
            for (const [x, z] of [[-4, 30.5], [4, 30.5], [-4, 35.5], [4, 35.5]]) {
                const tt = K.ring('brick', x, z, 1.0, 0, 10);
                K.slab('wood', x, tt, z, 2.2, 2.2);
                K.roof(x, tt + 0.2, z, 1.8, 1.8);
                if (z < 33) K.char('knight', x, 0, z - 1.6, x < 0 ? 'Sir Pomp' : 'Sir Circumstance');
            }
            K.wallX('brick', -2.5, 2.5, 30.5, 0, 3);
            K.char('knight', 0, 1.5, 30.5, 'Sir Snoot');
        },
    },
    {
        id: 'grandcastle', name: "King Bumble's Grand Castle", region: 'sunset',
        intro: 'The biggest castle in the land. King Bumble is waiting at the top. Kaboom!',
        ammo: { iron: 3, boom: 2, triple: 1, bertha: 1, boing: 1 }, stars: [10000, 17000],
        build(K) {
            const t = K.tower('stone', 0, 35, 4, 0, 12, { window: (c, s) => (c % 4 === 2 ? 'ice' : null) });
            K.slab('wood', 0, t, 35, 4, 4);
            const t2 = K.tower('brick', 0, 35, 2, t + 0.2, 4);
            K.slab('wood', 0, t2, 35, 2, 2);
            K.char('king', 0, t2 + 0.2, 35, 'King Bumble');
            K.char('wizard', -1.4, t + 0.2, 35, 'Old Fizzwick');
            K.char('knight', 1.4, t + 0.2, 35, 'Sir Bumbleby');
            for (const x of [-5.5, 5.5]) {
                const tt = K.ring('stone', x, 31, 1.2, 0, 12);
                K.slab('wood', x, tt, 31, 2.6, 2.6);
                K.roof(x, tt + 0.2, 31, 2.2, 2);
                K.flag(x, tt + 2.6, 31, x < 0 ? 'blue' : 'red');
            }
            const wt = K.wallX('stone', -3.6, 3.6, 31, 0, 6, { L: 1.2 });
            K.char('knight', -2, wt, 31, 'Sir Humble');
            K.char('knight', 2, wt, 31, 'Sir Jumble');
            K.crate(-2.5, 0, 33); K.crate(2.5, 0, 33);
        },
    },
];

export const REGIONS = {
    meadow: { name: 'Greenmeadow', sky: 0x9fd4ff, fog: 0xcfe8ff, ground: 0x7cc35a },
    frost:  { name: 'Frostpeak',   sky: 0xbfe0ff, fog: 0xe8f4ff, ground: 0xe9f2fa },
    sunset: { name: 'Sunset Shire', sky: 0xffc59a, fog: 0xffe0c4, ground: 0xb9c35a },
    marsh:  { name: 'Moonbeam Marsh', sky: 0x2a3466, fog: 0x2c3a6e, ground: 0x3f7a6a },
};
export const REGION_ORDER = ['meadow', 'frost', 'sunset', 'marsh'];

// ------------------------------------------------------------------ the campaign: 48 castles
// Twelve per region. In the first three regions the hand-made castles sit at 1, 4, 8 and 12 and
// generated ones fill the rest; Moonbeam Marsh is all generated. Difficulty climbs across all 48.
// Every generated castle here is proved by dev/simtest.mjs to stand on its own and to be won by
// the bot with its rack.
export const PER_REGION = 12;
const HAND_SLOTS = [0, 3, 7, 11];

export const LEVELS = [];
for (let r = 0; r < REGION_ORDER.length; r++) {
    const region = REGION_ORDER[r];
    const hand = HANDMADE.filter((L) => L.region === region);
    for (let i = 0; i < PER_REGION; i++) {
        const g = r * PER_REGION + i;
        const h = HAND_SLOTS.indexOf(i);
        if (h >= 0 && hand[h]) { LEVELS.push(hand[h]); continue; }
        const tier = region === 'marsh' && i === PER_REGION - 1 ? 1 : Math.min(1, 0.06 + (g / 47) * 0.94);
        LEVELS.push(generateCastle(5000 + g * 37, tier, region, `${region}-${i + 1}`));
    }
}
