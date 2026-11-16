// Placing elements (monsters, hoards, lights, cozy things, flora), wall torches and peek windows on a level.
// Pure. Every feature sits on one micro cell ({ mx, my }) and is checked as it is placed: a blocking feature may never
// cut the path between the stairs or leave another feature unreachable (a flood fill with it in place).
//
// A feature: { id, kind, mx, my, rot, block, dir?, nook? }
//   kind: an ELEMENTS id, or 'torch' / 'window' (on a wall: dir is the wall's side, 0 N 1 E 2 S 3 W)

import { ELEMENTS, ELEMENT_IDS, NOOK_IDS } from './data/elements.js';
import { THEMES } from './data/themes.js';
import { TILES, FAMILIES, DX, DY, isWalk } from './tiles.js';

/** Elements per 100 walkable micro cells at slider 5. */
const RATE = { monsters: 0.9, hoards: 0.7, lights: 0.7, cozy: 1.0, flora: 1.0 };
const TORCH_RATE = 1.7, WINDOW_RATE = 0.8;

export const featureId = (k, mx, my, extra = '') => `${k}:${mx}:${my}${extra}`;

/** Facts about one micro cell that placement needs. */
export function microInfo(L, mx, my) {
    const ch = L.grid[my]?.[mx];
    const cell = ((my / 3) | 0) * L.w + ((mx / 3) | 0);
    const fam = TILES[L.tiles[cell]]?.fam;
    return { ch, cell, fam, room: !!FAMILIES[fam]?.room };
}

const charAt = (L, x, y) => (x < 0 || y < 0 || x >= L.mw || y >= L.mh ? '#' : L.grid[y][x]);

/** Walkable micro cells reachable from the stairs up, with `blocked` cells removed. */
export function reach(L, blocked) {
    const seen = new Uint8Array(L.mw * L.mh);
    const s = L.up.my * L.mw + L.up.mx;
    seen[s] = 1;
    const q = [s];
    while (q.length) {
        const c = q.pop(), x = c % L.mw, y = (c / L.mw) | 0;
        for (let d = 0; d < 4; d++) {
            const nx = x + DX[d], ny = y + DY[d];
            if (nx < 0 || ny < 0 || nx >= L.mw || ny >= L.mh) continue;
            const nc = ny * L.mw + nx;
            if (seen[nc] || blocked[nc] || !isWalk(L.grid[ny][nx])) continue;
            seen[nc] = 1;
            q.push(nc);
        }
    }
    return seen;
}

/** True when blocking `idx` (plus what is already blocked) still leaves the stairs and every blocker reachable. */
function stillOpen(L, blocked, idx, blockers) {
    blocked[idx] = 1;
    const seen = reach(L, blocked);
    let ok = !L.down || seen[L.down.my * L.mw + L.down.mx];
    for (const b of ok ? blockers.concat(idx) : []) {
        const x = b % L.mw, y = (b / L.mw) | 0;
        if (![0, 1, 2, 3].some((d) => { const nx = x + DX[d], ny = y + DY[d]; return nx >= 0 && ny >= 0 && nx < L.mw && ny < L.mh && seen[ny * L.mw + nx]; })) { ok = false; break; }
    }
    if (!ok) blocked[idx] = 0;
    return ok;
}

/** Where a kind may go: the candidate micro cells of a level, by `where`. */
function candidates(L) {
    const out = { room: [], wall: [], nook: [], water: [], any: [] };
    const nearStairs = (x, y) => [L.up, L.down].some((s) => s && Math.abs(s.mx - x) <= 1 && Math.abs(s.my - y) <= 1);
    for (let y = 0; y < L.mh; y++) {
        for (let x = 0; x < L.mw; x++) {
            if (L.grid[y][x] !== '.' || nearStairs(x, y)) continue;
            const info = microInfo(L, x, y);
            let walls = 0, doorway = false, water = false;
            for (let d = 0; d < 4; d++) {
                const nx = x + DX[d], ny = y + DY[d], ch = charAt(L, nx, ny);
                if (ch === '#') walls++;
                if (ch === '~') water = true;
                // a walkable neighbour in a tunnel cell: this is a doorway, keep it clear
                if (isWalk(ch) && nx >= 0 && ny >= 0 && nx < L.mw && ny < L.mh && !microInfo(L, nx, ny).room && info.room) doorway = true;
            }
            for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (charAt(L, x + dx, y + dy) === '~') water = true;
            if (doorway) continue;
            const c = { x, y };
            if (info.fam === 'dead' && walls === 3) { out.nook.push(c); out.any.push(c); continue; }
            if (!info.room) continue;
            out.any.push(c);
            if (walls >= 2) out.nook.push(c);
            if (walls >= 1) out.wall.push(c);
            else out.room.push(c);
            if (water) out.water.push(c);
        }
    }
    return out;
}

/** The side of a wall a micro cell backs onto (for things that stand against a wall). */
function wallSide(L, x, y, rng) {
    const sides = [0, 1, 2, 3].filter((d) => charAt(L, x + DX[d], y + DY[d]) === '#');
    return sides.length ? rng.pick(sides) : -1;
}

/**
 * Place every feature on level L. params: the normalised dungeon params. deepest: this is the bottom level
 * (the drowsy dragon sleeps on its hoard in the biggest chamber there).
 */
export function placeFeatures(L, params, rng, deepest) {
    const feats = [];
    const blocked = new Uint8Array(L.mw * L.mh);
    const taken = new Uint8Array(L.mw * L.mh);
    const blockers = [];
    const cand = candidates(L);
    let walkable = 0;
    for (const row of L.grid) for (const ch of row) if (isWalk(ch)) walkable++;
    const el = params.el;
    const theme = THEMES[L.theme];

    const free = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < L.mw && ny < L.mh && taken[ny * L.mw + nx]) return false;
        }
        return true;
    };
    const nearStairs = (x, y) => [L.up, L.down].some((s) => s && Math.abs(s.mx - x) <= 1 && Math.abs(s.my - y) <= 1);
    const put = (kind, x, y, extra = {}) => {
        const idx = y * L.mw + x;
        // every placement (the dragon's hoard included) keeps the stairs' landing clear
        if (!free(x, y) || nearStairs(x, y)) return null;
        if (!stillOpen(L, blocked, idx, blockers)) return null;
        blockers.push(idx);
        taken[idx] = 1;
        const side = wallSide(L, x, y, rng);
        // things that stand against a wall face away from it; the rest face a random way
        const rot = ELEMENTS[kind].where === 'wall' && side >= 0 ? ((side + 2) % 4) * (Math.PI / 2) : rng.range(0, Math.PI * 2);
        const f = { id: featureId(L.k, x, y), kind, mx: x, my: y, rot, block: true, ...extra };
        feats.push(f);
        return f;
    };
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

    // 1. the dragon's lair on the deepest level: the biggest chamber, the cell farthest from its walls
    if (deepest && el.monsters > 0 && L.rooms.length) {
        const big = L.rooms.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
        let best = null, bd = -1;
        for (const c of cand.room) {
            if (L.roomOf[((c.y / 3) | 0) * L.w + ((c.x / 3) | 0)] !== big.id) continue;
            let d = 99;
            for (let r = 1; r < 6 && d === 99; r++) {
                for (let k = -r; k <= r; k++) {
                    if ([charAt(L, c.x + k, c.y - r), charAt(L, c.x + k, c.y + r), charAt(L, c.x - r, c.y + k), charAt(L, c.x + r, c.y + k)].some((ch) => ch !== '.')) { d = r; break; }
                }
            }
            const score = d + rng() * 0.5;
            if (score > bd) { bd = score; best = c; }
        }
        if (best && put('dragon', best.x, best.y, { lair: true })) {
            // her hoard, two steps away
            for (const [dx, dy] of shuffle([[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]])) {
                const x = best.x + dx, y = best.y + dy;
                if (charAt(L, x, y) === '.' && microInfo(L, x, y).room && put('gold', x, y, { lair: true })) break;
            }
        }
    }

    // 2. elements by category, each kind weighted towards what the theme favours
    const want = (cat) => Math.round((walkable / 100) * RATE[cat] * (el[cat] / 5) + (el[cat] > 0 ? rng() * 0.8 : 0));
    for (const cat of ['hoards', 'monsters', 'lights', 'cozy', 'flora']) {
        const kinds = ELEMENT_IDS.filter((id) => ELEMENTS[id].cat === cat && !ELEMENTS[id].boss);
        const n = want(cat);
        for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
            let sw = 0;
            const ws = kinds.map((id) => { const v = theme.favour.includes(id) ? 3 : 1; sw += v; return v; });
            let r = rng() * sw, kind = kinds[0];
            for (let j = 0; j < kinds.length; j++) { r -= ws[j]; if (r <= 0) { kind = kinds[j]; break; } }
            const pool = cand[ELEMENTS[kind].where];
            if (!pool.length) continue;
            const c = pool[Math.floor(rng() * pool.length)];
            if (put(kind, c.x, c.y)) i++;
        }
    }

    // 3. wall torches, spaced along every tunnel and chamber wall (they don't block)
    const lit = new Uint8Array(L.mw * L.mh);
    const torches = Math.round((walkable / 100) * TORCH_RATE * (el.lights / 5));
    // chamber floor and tunnel floor alike: any walkable '.' beside rock
    const wallSpots = cand.any.slice();
    for (let y = 0; y < L.mh; y++) for (let x = 0; x < L.mw; x++) {
        if (L.grid[y][x] === '.' && !microInfo(L, x, y).room) wallSpots.push({ x, y });
    }
    shuffle(wallSpots);
    let placed = 0;
    for (const c of wallSpots) {
        if (placed >= torches) break;
        const sides = [0, 1, 2, 3].filter((d) => charAt(L, c.x + DX[d], c.y + DY[d]) === '#');
        if (!sides.length) continue;
        let near = false;
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
            const nx = c.x + dx, ny = c.y + dy;
            if (nx >= 0 && ny >= 0 && nx < L.mw && ny < L.mh && lit[ny * L.mw + nx]) { near = true; break; }
        }
        if (near) continue;
        const dir = rng.pick(sides);
        lit[c.y * L.mw + c.x] = 1;
        feats.push({ id: featureId(L.k, c.x, c.y, 't'), kind: 'torch', mx: c.x, my: c.y, dir, rot: 0, block: false });
        placed++;
    }

    // 4. peek windows: a chamber wall with at least two micro cells of solid rock behind it
    const peeks = Math.round((walkable / 100) * WINDOW_RATE * (el.windows / 5));
    const winSpots = shuffle(cand.wall.slice());
    const peeked = [];
    let nw = 0;
    for (const c of winSpots) {
        if (nw >= peeks) break;
        for (const d of shuffle([0, 1, 2, 3])) {
            const px = -DY[d], py = DX[d];            // along the wall
            const solid = [[1, 0], [2, 0], [1, 1], [1, -1], [2, 1], [2, -1]].every(([a, b]) =>
                charAt(L, c.x + DX[d] * a + px * b, c.y + DY[d] * a + py * b) === '#');
            if (!solid) continue;
            if (peeked.some((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 5)) continue;
            if (feats.some((f) => f.kind === 'torch' && f.mx === c.x && f.my === c.y && f.dir === d)) continue;
            peeked.push(c);
            feats.push({ id: featureId(L.k, c.x, c.y, 'w' + d), kind: 'window', mx: c.x, my: c.y, dir: d, rot: 0, block: false, nook: rng.pick(NOOK_IDS) });
            nw++;
            break;
        }
    }

    // 5. what the player erased and stamped by hand
    const erased = params.erased.filter((e) => e.l === L.k);
    const kept = feats.filter((f) => !erased.some((e) => e.x === f.mx && e.y === f.my));
    if (kept.length !== feats.length) {
        // rebuild the blocking map without the erased ones
        blocked.fill(0); taken.fill(0); blockers.length = 0;
        for (const f of kept) if (f.block) { const i = f.my * L.mw + f.mx; blocked[i] = 1; taken[i] = 1; blockers.push(i); }
    }
    for (const s of params.stamps.filter((p) => p.l === L.k)) {
        const ok = canStampOn(L, kept, s.x, s.y, s.k, blocked, blockers);
        if (!ok) continue;
        const idx = s.y * L.mw + s.x;
        blocked[idx] = 1; taken[idx] = 1; blockers.push(idx);
        const side = [0, 1, 2, 3].find((d) => charAt(L, s.x + DX[d], s.y + DY[d]) === '#');
        const rot = ELEMENTS[s.k].where === 'wall' && side !== undefined ? ((side + 2) % 4) * (Math.PI / 2) : ((s.x * 7 + s.y * 13) % 8) * (Math.PI / 4);
        kept.push({ id: featureId(L.k, s.x, s.y), kind: s.k, mx: s.x, my: s.y, rot, block: true, stamped: true });
    }
    return kept;
}

/** Whether an element can be stamped at micro (x, y): bare floor, nobody there, and nothing cut off. */
function canStampOn(L, feats, x, y, kind, blocked, blockers) {
    if (!ELEMENTS[kind] || L.grid[y]?.[x] !== '.') return false;
    if ([L.up, L.down].some((s) => s && Math.abs(s.mx - x) <= 1 && Math.abs(s.my - y) <= 1)) return false;
    if (feats.some((f) => f.block && f.mx === x && f.my === y)) return false;
    const b = blocked.slice();
    return stillOpen(L, b, y * L.mw + x, blockers.slice());
}

/** For the UI: can `kind` be stamped at micro (x, y) of level L as it stands? Returns '' or a reason. */
export function stampProblem(L, x, y, kind) {
    if (x < 0 || y < 0 || x >= L.mw || y >= L.mh) return 'off the map';
    const ch = L.grid[y][x];
    if (ch === '#') return 'that is solid rock';
    if (ch === '~') return 'that is water';
    if (ch === 'o') return 'that is a well';
    if (ch === 'v' || ch === '^') return 'the stairs need to stay clear';
    if ([L.up, L.down].some((s) => s && Math.abs(s.mx - x) <= 1 && Math.abs(s.my - y) <= 1)) return 'the stairs need to stay clear';
    if (L.features.some((f) => f.block && f.mx === x && f.my === y)) return 'something is already there';
    const blocked = new Uint8Array(L.mw * L.mh), blockers = [];
    for (const f of L.features) if (f.block) { const i = f.my * L.mw + f.mx; blocked[i] = 1; blockers.push(i); }
    if (!stillOpen(L, blocked, y * L.mw + x, blockers)) return 'that would block the way';
    return '';
}
