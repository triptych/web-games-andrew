// Realm data → a playable map: one global tile grid for the whole realm (rooms
// side by side), the room table, gates, lasers, teleport pads, cracked-wall
// groups, bridge spots, and the starting positions of everything that moves.
// Pure and seeded: the same realm + seed always builds the same map.

import { makeRng } from '../rng.js';
import { T, RW, RH, ROOM_W, ROOM_H, FLOOR, WALL, GATE, CHASM, CRACK, FACADE, BARRIER, VOID } from '../config.js';
import { REALMS, CASTLE_COLOR, TYPE_NAMES } from './realms.js';

export const ITEM_SIZE = {
    sword: [12, 6], key: [12, 6], chalice: [8, 10], magnet: [8, 8], bridge: [16, 48], lamp: [8, 10],
    shield: [8, 10], charge: [8, 8], pixel: [2, 2],
};
export const PICKUP_SIZE = { gem: [6, 6], biggem: [8, 8], battery: [6, 8], oneup: [8, 8], cassette: [10, 7], shard: [6, 8] };

const CASTLES = 'HGBPNVC';

/** Parse a realm's character map into a room grid and its links. */
export function parseMap(map) {
    const rows = Math.ceil(map.length / 2);
    const cols = Math.max(...map.map((l) => Math.ceil(l.length / 2)));
    const cell = (c, r) => {
        const ch = (map[r * 2] || '')[c * 2];
        return ch && ch !== '.' && ch !== ' ' ? ch : null;
    };
    const rooms = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const ch = cell(c, r);
        if (!ch) { rooms.push(null); continue; }
        const e = (map[r * 2] || '')[c * 2 + 1] === '-' && cell(c + 1, r);
        const s = (map[r * 2 + 1] || '')[c * 2];
        rooms.push({ c, r, ch, linkE: !!e, linkS: (s === '|' || s === '!') && !!cell(c, r + 1) ? s : null });
    }
    return { cols, rows, rooms };
}

export function buildRealm(realmIndex, opts = {}) {
    const realm = REALMS[realmIndex];
    const seed = (realm.seed ^ (opts.remix ? Math.imul(opts.remix, 2654435761) : 0)) >>> 0;
    const { cols, rows, rooms: grid } = parseMap(realm.map);
    const gw = cols * RW, gh = rows * RH;
    const tiles = new Uint8Array(gw * gh).fill(VOID);
    const at = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh ? VOID : tiles[y * gw + x]);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < gw && y < gh) tiles[y * gw + x] = v; };

    const M = {
        realm, realmIndex, seed, cols, rows, gw, gh, tiles, at, set,
        rooms: [], gates: [], lasers: [], pads: [], cracks: [], bridgeSpots: [], barrier: null,
        dispenser: null, homeVault: -1, home: -1, start: null, items: [], pickups: [], dragons: [], bat: null, boss: null,
        decor: [],
    };
    const idx = (c, r) => r * cols + c;
    const get = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : grid[idx(c, r)]);

    // ---- room table and links ------------------------------------------------
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const g = get(c, r);
        if (!g) { M.rooms.push(null); continue; }
        const extra = realm.rooms?.[`${c},${r}`] || {};
        const room = {
            i: idx(c, r), c, r, ch: g.ch, x0: c * RW, y0: r * RH, extra,
            castle: CASTLES.includes(g.ch) ? CASTLE_COLOR[g.ch] : null,
            vault: g.ch === 'v' || g.ch === 'h' || g.ch === 'A',
            dark: g.ch === 'K' || !!extra.dark,
            exits: { n: null, e: null, s: null, w: null },
            name: extra.name || null,
        };
        M.rooms.push(room);
    }
    for (const g of grid) {
        if (!g) continue;
        const a = M.rooms[idx(g.c, g.r)];
        if (g.linkE) { a.exits.e = 'open'; M.rooms[idx(g.c + 1, g.r)].exits.w = 'open'; }
        if (g.linkS) {
            const b = M.rooms[idx(g.c, g.r + 1)];
            const kind = g.linkS === '!' ? 'barrier' : (b.castle && a.vault ? 'gate' : 'open');
            a.exits.s = kind; b.exits.n = kind;
        }
    }
    // name the unnamed rooms
    const nameRng = makeRng(seed ^ 0x51ED);
    const used = {};
    for (const room of M.rooms) {
        if (!room || room.name) continue;
        const list = TYPE_NAMES[room.ch] || ['THE GRID'];
        used[room.ch] = (used[room.ch] ?? nameRng.int(0, list.length - 1)) + 1;
        room.name = list[used[room.ch] % list.length];
    }

    // ---- carve every room --------------------------------------------------------
    for (const room of M.rooms) {
        if (!room) continue;
        const rng = makeRng((seed + room.i * 7919) >>> 0);
        const L = (x, y, v) => set(room.x0 + x, room.y0 + y, v);
        const G = (x, y) => at(room.x0 + x, room.y0 + y);
        const rect = (x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L(x + i, y + j, v); };
        rect(0, 0, RW, RH, FLOOR);
        rect(0, 0, RW, 2, WALL); rect(0, RH - 2, RW, 2, WALL); rect(0, 0, 2, RH, WALL); rect(RW - 2, 0, 2, RH, WALL);
        room.rect = rect; room.L = L; room.G = G;

        const ch = room.ch;
        if (ch === 'M' || ch === 'K') carveMaze(room, rng, ch === 'K' ? 0.2 : 0.12);
        else if (room.castle) carveCourtyard(room, M);
        else if (ch === 'R') carveRiver(room);
        else if (ch === 'X') carveCracked(room);
        else if (ch === 'A') rect(10, 7, 3, 3, WALL), rect(27, 7, 3, 3, WALL), rect(10, 15, 3, 3, WALL), rect(27, 15, 3, 3, WALL);
        else if (ch === 'O' || ch === 'L' || ch === 'T') scatterPillars(room, rng, ch === 'O' ? rng.int(2, 5) : rng.int(0, 2));

        // exits
        const ex = room.exits;
        if (ex.n === 'open' || ex.n === 'barrier') { rect(16, 0, 8, 2, ex.n === 'barrier' ? BARRIER : FLOOR); vestibule(room, 'n'); }
        if (ex.s === 'open' || ex.s === 'barrier') { rect(16, RH - 2, 8, 2, FLOOR); vestibule(room, 's'); }
        if (ex.e) { rect(RW - 2, 9, 2, 7, FLOOR); vestibule(room, 'e'); }
        if (ex.w) { rect(0, 9, 2, 7, FLOOR); vestibule(room, 'w'); }
        if (ex.s === 'gate') { rect(18, RH - 2, 4, 2, FLOOR); rect(18, RH - 5, 4, 3, FLOOR); }
        if (ex.n === 'barrier') M.barrier = { x: room.x0 + 16, y: room.y0, w: 8, h: 2, room: room.i, broken: false };

        if (room.extra.pocket) {
            const [px, py] = room.extra.pocket;
            rect(px - 2, py - 2, 5, 5, WALL); rect(px - 1, py - 1, 3, 3, FLOOR);
        }
        if (ch === 'L') makeLasers(room, M, rng);
        if (ch === 'T') {
            rect(18, 10, 4, 4, FLOOR);
            M.pads.push({ room: room.i, x: (room.x0 + 18) * T, y: (room.y0 + 10) * T, w: 32, h: 32, link: -1 });
        }
        if (room.extra.dispenser) {
            const [dx, dy] = room.extra.dispenser;
            M.dispenser = { x: (room.x0 + dx) * T, y: (room.y0 + dy) * T, room: room.i };
        }
        if (ch === 'h') { M.homeVault = room.i; }
        if (ch === 'H') { M.home = room.i; M.start = { x: (room.x0 + 20) * T - 4, y: (room.y0 + 17) * T }; }
        if (ch === 'S') rect(8, 6, 2, 2, WALL), rect(30, 6, 2, 2, WALL), rect(8, 17, 2, 2, WALL), rect(30, 17, 2, 2, WALL);
    }

    // ---- teleport links ------------------------------------------------------------
    for (const [a, b] of realm.tele || []) {
        const pa = M.pads.find((p) => p.room === roomIndexOf(M, a));
        const pb = M.pads.find((p) => p.room === roomIndexOf(M, b));
        if (pa && pb) { pa.link = M.pads.indexOf(pb); pb.link = M.pads.indexOf(pa); }
    }

    // ---- cracked-wall groups ---------------------------------------------------------
    const seen = new Uint8Array(gw * gh);
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] !== CRACK || seen[i]) continue;
        const group = []; const q = [i]; seen[i] = 1;
        while (q.length) {
            const k = q.pop(); group.push(k);
            const x = k % gw, y = (k / gw) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const n = (y + dy) * gw + x + dx;
                if (x + dx >= 0 && x + dx < gw && y + dy >= 0 && y + dy < gh && !seen[n] && tiles[n] === CRACK) { seen[n] = 1; q.push(n); }
            }
        }
        M.cracks.push({ tiles: group, broken: false });
    }

    // ---- bridge spots ----------------------------------------------------------------
    for (const b of realm.bridges || []) {
        const room = M.rooms[roomIndexOf(M, b.room)];
        M.bridgeSpots.push(bridgeSpot(M, (room.x0 + b.tx) * T, (room.y0 + b.ty) * T));
    }

    // ---- entities --------------------------------------------------------------------
    const placeRng = makeRng(seed ^ 0xA11CE);
    const place = (roomKey, atTile, w, h) => {
        const room = M.rooms[roomIndexOf(M, roomKey)];
        return nearestFloor(M, room, atTile[0], atTile[1], w, h);
    };
    let itemId = 1;
    let items = opts.items || realm.items;
    let dragons = opts.dragons || realm.dragons;
    if (opts.remix && !opts.items) ({ items, dragons } = remixPlacement(M, realm, makeRng(seed ^ 0xBEEF)));
    for (const it of items) {
        const [w, h] = ITEM_SIZE[it.kind];
        const p = place(it.room, it.at, w, h);
        M.items.push({ id: itemId++, kind: it.kind, color: it.color || null, x: p.x, y: p.y, w, h, orient: 'v' });
    }
    if (M.dispenser) M.items.push({ id: itemId++, kind: 'charge', x: M.dispenser.x, y: M.dispenser.y, w: 8, h: 8, fromDispenser: true });
    for (const pk of realm.pickups || []) {
        const [w, h] = PICKUP_SIZE[pk.kind];
        const p = place(pk.room, pk.at, w, h);
        M.pickups.push({ kind: pk.kind, x: p.x, y: p.y, w, h });
    }
    // gems: a few in every ordinary room, a big one in each vault
    for (const room of M.rooms) {
        if (!room || room.ch === 'S' || room.ch === 'A') continue;
        const n = room.vault ? 1 : placeRng.int(2, 4);
        for (let k = 0; k < n; k++) {
            const kind = room.vault ? 'biggem' : (placeRng.chance(0.12) ? 'biggem' : 'gem');
            const [w, h] = PICKUP_SIZE[kind];
            const tx = placeRng.int(4, RW - 6), ty = placeRng.int(4, RH - 6);
            const p = nearestFloor(M, room, room.vault ? 10 + k * 20 : tx, room.vault ? 6 : ty, w, h);
            if (!M.pickups.some((o) => Math.abs(o.x - p.x) < 12 && Math.abs(o.y - p.y) < 12)) M.pickups.push({ kind, x: p.x, y: p.y, w, h });
        }
    }
    // the secret room's prize
    const secret = M.rooms.find((r) => r && r.ch === 'S');
    if (secret) {
        M.pickups.push({ kind: 'oneup', ...xy(nearestFloor(M, secret, 20, 15, 8, 8)), w: 8, h: 8 });
        for (let k = 0; k < 6; k++) M.pickups.push({ kind: 'biggem', ...xy(nearestFloor(M, secret, 12 + k * 3, 19, 8, 8)), w: 8, h: 8 });
    }
    for (const d of dragons) {
        const p = place(d.room, d.at, 16, 16);
        M.dragons.push({ kind: d.kind, x: p.x, y: p.y, guard: d.guard || null, shard: !!d.shard });
    }
    if (realm.bat) { const p = place(realm.bat.room, realm.bat.at, 14, 8); M.bat = { x: p.x, y: p.y }; }
    if (realm.boss) {
        const room = M.rooms[roomIndexOf(M, realm.boss.room)];
        M.boss = { room: room.i, x: (room.x0 + 20) * T - 16, y: (room.y0 + 6) * T };
    }
    return M;
}

const xy = (p) => ({ x: p.x, y: p.y });

/**
 * REMIX: Adventure's game 3. Tools, keys and dragons go to random rooms; the
 * chalice stays locked where it is. A key never lands in its own vault. The
 * caller checks the result with the planner and asks for another seed if it
 * can't be solved.
 */
function remixPlacement(M, realm, rng) {
    const keyOf = (r) => `${r.c},${r.r}`;
    const open = M.rooms.filter((r) => r && !['S', 'A', 'h'].includes(r.ch));
    const ownVault = (color) => {
        const court = M.rooms.find((r) => r && r.castle === color);
        return court ? `${court.c},${court.r - 1}` : null;
    };
    const items = realm.items.map((it) => {
        if (it.kind === 'chalice') return it;
        let room;
        for (let k = 0; k < 20; k++) {
            room = rng.pick(open);
            if (it.kind === 'key' && keyOf(room) === ownVault(it.color)) continue;
            if (it.kind !== 'key' && room.vault) continue;
            break;
        }
        return { ...it, room: keyOf(room), at: [rng.int(5, 34), rng.int(5, 19)] };
    });
    const free = open.filter((r) => !r.vault && r.ch !== 'H');
    const dragons = realm.dragons.map((d) => ({ ...d, room: keyOf(rng.pick(free)), at: [rng.int(8, 31), rng.int(6, 18)] }));
    return { items, dragons };
}

export function roomIndexOf(M, key) {
    const [c, r] = key.split(',').map(Number);
    return r * M.cols + c;
}

/** Nearest spot (top-left, px) to tile (tx, ty) in a room where a w×h box stands on floor only. */
export function nearestFloor(M, room, tx, ty, w, h) {
    const tw = Math.ceil(w / T), th = Math.ceil(h / T);
    const ok = (x, y) => {
        for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) if (M.at(room.x0 + x + i, room.y0 + y + j) !== FLOOR) return false;
        return x >= 2 && y >= 2 && x + tw <= RW - 2 && y + th <= RH - 2;
    };
    for (let rad = 0; rad < 40; rad++) {
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            if (ok(tx + dx, ty + dy)) {
                const cx = (room.x0 + tx + dx) * T + ((tw * T - w) >> 1), cy = (room.y0 + ty + dy) * T + ((th * T - h) >> 1);
                return { x: cx, y: cy };
            }
        }
    }
    return { x: (room.x0 + tx) * T, y: (room.y0 + ty) * T };
}

// ---------------------------------------------------------------- room carvers

function carveMaze(room, rng, loops) {
    const { rect } = room;
    rect(2, 2, RW - 4, RH - 4, WALL);
    const CW = 9, CH = 5;
    const vis = new Uint8Array(CW * CH);
    const open = (i, j) => rect(2 + 4 * i, 2 + 4 * j, 3, 3, FLOOR);
    const stack = [[rng.int(0, CW - 1), rng.int(0, CH - 1)]];
    vis[stack[0][1] * CW + stack[0][0]] = 1; open(...stack[0]);
    while (stack.length) {
        const [i, j] = stack[stack.length - 1];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
            const x = i + dx, y = j + dy;
            return x >= 0 && y >= 0 && x < CW && y < CH && !vis[y * CW + x];
        });
        if (!nb.length) { stack.pop(); continue; }
        const [dx, dy] = rng.pick(nb);
        const x = i + dx, y = j + dy;
        vis[y * CW + x] = 1; open(x, y);
        // knock down the wall between
        if (dx) rect(2 + 4 * Math.max(i, x) - 1, 2 + 4 * j, 1, 3, FLOOR);
        else rect(2 + 4 * i, 2 + 4 * Math.max(j, y) - 1, 3, 1, FLOOR);
        stack.push([x, y]);
    }
    // a few loops so a dragon can be dodged round a block
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        if (i < CW - 1 && rng.chance(loops)) rect(2 + 4 * i + 3, 2 + 4 * j, 1, 3, FLOOR);
        if (j < CH - 1 && rng.chance(loops)) rect(2 + 4 * i, 2 + 4 * j + 3, 3, 1, FLOOR);
    }
    room.maze = true;
}

function vestibule(room, side) {
    const { rect } = room;
    if (!room.maze) return;
    if (side === 'n') rect(16, 2, 8, 3, FLOOR);
    if (side === 's') rect(16, RH - 7, 8, 5, FLOOR);
    if (side === 'e') rect(RW - 6, 9, 4, 7, FLOOR);
    if (side === 'w') rect(2, 9, 4, 7, FLOOR);
}

function carveCourtyard(room, M) {
    const { rect } = room;
    // the castle: towers at the corners, a keep between, a gate corridor in the middle
    rect(8, 2, 24, 11, FACADE);
    rect(18, 0, 4, 13, FLOOR);
    rect(18, 11, 4, 2, GATE);
    rect(16, 0, 8, 2, WALL); rect(18, 0, 4, 2, FLOOR);
    M.gates.push({
        id: M.gates.length, color: room.castle, room: room.i,
        x: room.x0 + 18, y: room.y0 + 11, w: 4, h: 2,
        open: room.castle === 'sunset' ? 1 : 0, opening: false, home: room.castle === 'sunset',
    });
    room.facade = { x: room.x0 + 8, y: room.y0 + 2, w: 24, h: 11 };
    if (room.castle === 'sunset') for (let x = 18; x < 22; x++) for (let y = 11; y < 13; y++) M.set(room.x0 + x, room.y0 + y, FLOOR);
}

function carveRiver(room) {
    const { rect } = room;
    if (room.extra.chasm === 'v') rect(27, 2, 4, RH - 4, CHASM);
    else rect(2, 16, RW - 4, 4, CHASM);
    room.chasm = room.extra.chasm || 'h';
}

function carveCracked(room) {
    const { rect } = room;
    const ex = room.extra;
    if (ex.crack === 'wall') {
        const x = ex.crackAt ?? 11;
        rect(x, 2, 2, RH - 4, CRACK);
    } else {
        const [cx, cy] = ex.pocketAt || [20, 12];
        rect(cx - 4, cy - 3, 9, 7, CRACK);
        rect(cx - 3, cy - 2, 7, 5, FLOOR);
    }
}

function scatterPillars(room, rng, n) {
    const { rect, G } = room;
    const clear = (x, y, w, h) => {
        // keep the cross of door lanes and the centre free
        if (x < 15 + 10 && x + w > 15 && true) return false;
        if (y < 8 + 9 && y + h > 8) return false;
        for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (G(x + i, y + j) !== FLOOR) return false;
        return true;
    };
    for (let k = 0; k < n * 4 && n > 0; k++) {
        const w = rng.int(2, 3), h = rng.int(2, 3);
        const x = rng.int(4, RW - 4 - w), y = rng.int(4, RH - 4 - h);
        if (!clear(x, y, w, h)) continue;
        rect(x, y, w, h, WALL);
        n--;
    }
}

function makeLasers(room, M, rng) {
    const per = rng.range(2.6, 3.4);
    // two vertical beams either side of the centre, out of phase, plus sometimes a horizontal one
    for (const [k, x] of [[0, 10], [1, 29]]) {
        M.lasers.push({ room: room.i, x: (room.x0 + x) * T + 3, y: (room.y0 + 2) * T, w: 2, h: (RH - 4) * T, period: per, phase: k * per / 2, duty: 0.45 });
        room.rect(x, 2, 1, 1, FLOOR);
    }
    if (rng.chance(0.5)) M.lasers.push({ room: room.i, x: (room.x0 + 2) * T, y: (room.y0 + 5) * T + 3, w: (RW - 4) * T, h: 2, period: per * 1.3, phase: per * 0.3, duty: 0.35 });
}

/** A bridge spot: the chasm tiles it covers when laid at (px, py), as a rect. */
export function bridgeSpot(M, px, py) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    // which way does the chasm run here?
    let horiz = 0, vert = 0;
    for (let d = -3; d <= 3; d++) { if (M.at(tx + d, ty) === CHASM) horiz++; if (M.at(tx, ty + d) === CHASM) vert++; }
    // band runs horizontally (wide in x) → bridge stands vertically
    const orient = horiz >= vert ? 'v' : 'h';
    let a = orient === 'v' ? ty : tx;
    const step = (k) => (orient === 'v' ? M.at(tx, k) : M.at(k, ty));
    let lo = a, hi = a;
    while (step(lo - 1) === CHASM) lo--;
    while (step(hi + 1) === CHASM) hi++;
    if (step(a) !== CHASM) { lo = a; hi = a; }
    const len = hi - lo + 1;
    return orient === 'v'
        ? { orient, x: tx * T - 4, y: (lo - 1) * T, w: 16, h: (len + 2) * T, tiles: len }
        : { orient, x: (lo - 1) * T, y: ty * T - 4, w: (len + 2) * T, h: 16, tiles: len };
}

export { REALMS };
