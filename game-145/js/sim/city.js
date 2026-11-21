// The city of Ashmere, generated from a seed. Pure: no DOM, no renderer, no Math.random.
//
// Layout: an 11 x 11 grid of blocks, each 25 tiles square, with five-tile streets between them (sidewalk, three
// lanes, sidewalk) and a street around the outside that runs off into the fog. Blocks get a district from their
// distance to the centre: downtown (towers, the mall, the hotel, the radio station), a mixed ring (apartments,
// the hospital, the school, the library, shops, parks), the residential outskirts (houses with yards), and an
// industrial side (factories, warehouses, yards) where a 2 x 2 block compound holds the Threshold Laboratory.
//
// Everything here is plain data: typed arrays for the ground, a list of buildings (rectangles of tiles plus
// a type, a height and a lock), a list of props, outdoor fence edges. Interiors are generated later, per building,
// from the building's own seed (interior.js), so a building is the same whenever it is first visited.

import { CITY, CITY_TILES as N } from '../config.js';
import { makeRng, hashSeed, noise2 } from '../rng.js';

export const G_VOID = 0, G_ROAD = 1, G_WALK = 2, G_GRASS = 3, G_LOT = 4, G_DIRT = 5, G_PLAZA = 6, G_BUILDING = 7;

/** Building types: floors, floor height (m) and facade materials to pick from. */
export const BTYPES = {
    house:     { floors: [1, 2], h: 3.0, facade: ['siding', 'siding', 'brick', 'stucco'] },
    apartment: { floors: [3, 5], h: 3.0, facade: ['brick', 'stucco', 'facade'] },
    office:    { floors: [3, 7], h: 3.2, facade: ['facade', 'facade', 'brick'] },
    hotel:     { floors: [4, 6], h: 3.0, facade: ['stucco'] },
    mall:      { floors: [3, 3], h: 5.0, facade: ['facade'] },
    hospital:  { floors: [4, 5], h: 3.4, facade: ['facade'] },
    school:    { floors: [2, 2], h: 3.4, facade: ['brick'] },
    library:   { floors: [2, 2], h: 4.0, facade: ['brick'] },
    shop:      { floors: [1, 2], h: 3.2, facade: ['brick', 'stucco', 'facade'] },
    factory:   { floors: [2, 2], h: 6.0, facade: ['rust', 'brick'] },
    warehouse: { floors: [1, 2], h: 5.0, facade: ['rust', 'facade'] },
    garage:    { floors: [3, 4], h: 3.0, facade: ['facade'] },
    lab:       { floors: [3, 3], h: 3.4, facade: ['lab'] },
    hall:      { floors: [1, 1], h: 10.0, facade: ['lab'] },
};

const SHOP_NAMES = ['LANTERN DINER', 'GREY & SON — WATCHES', 'SUDS LAUNDROMAT', 'PELL ST PHARMACY', 'SECOND CHAPTER BOOKS',
    'ASHMERE HARDWARE', 'REWIND VIDEO', 'GOLDEN PAWN', 'NITE OWL DELI', 'ROSE NAILS', 'BUDGET TV & RADIO', 'KWIK MART',
    'MAPLE BAKERY', 'STARDUST ARCADE', 'HARBOR FISH & CHIPS', 'CORNER FLORIST', 'BIG LOU\'S TIRES', 'SUNRISE CAFE'];
const OFFICE_NAMES = ['MERIDIAN INSURANCE', 'ASHMERE SAVINGS & LOAN', 'HALVERSON TOWER', 'CITY HALL ANNEX', 'NORTHGATE PLAZA',
    'PIONEER BUILDING', 'THE CAXTON', 'COLUMBIA HOUSE', 'TRI-COUNTY GAS & ELECTRIC', 'BELLWEATHER MUTUAL'];
const APT_NAMES = ['THE ORCHARD ARMS', 'PELL COURT', 'ELM TERRACE', 'HALSEY MANSIONS', 'GLENVIEW APARTMENTS', 'THE WINSLOW',
    'RIVERSIDE FLATS', 'BIRCH HOUSE', 'CEDAR COURT', 'THE CHANCERY'];
const FACTORY_NAMES = ['LINDQVIST CANNING CO.', 'ASHMERE STEEL & WIRE', 'KESSLER TEXTILES', 'UNION BOTTLING WORKS', 'DAWSON MOTOR PARTS'];
const WAREHOUSE_NAMES = ['BRANNOCK STORAGE', 'ROUTE 9 BUS DEPOT', 'FREIGHT ANNEX B', 'COLD STORE 4', 'TRI-STATE HAULAGE', 'DEPOT 12'];

export function blockOrigin(bi) { return CITY.edge + bi * CITY.pitch; }
export const BLOCK = CITY.pitch - CITY.road;      // 25 tiles of buildable land

/** Build the whole city for a seed. */
export function makeCity(seed) {
    const rng = makeRng(hashSeed(seed ^ 0x51C17));
    const C = {
        seed, n: N,
        ground: new Uint8Array(N * N),
        owner: new Int16Array(N * N).fill(-1),
        solid: new Uint8Array(N * N),          // outdoor tiles with a car, a tree, a container on them
        fence: new Map(),                      // outdoor edge key → { kind, lock }
        buildings: [],
        props: [],                             // outdoor dressing: { k, x, z, r, ... } in metres
        lights: [],                            // street lights { x, z, on }
        blocks: [],
        district: new Uint8Array(CITY.blocks * CITY.blocks),
        interiors: new Map(),                  // lazily generated (interior.js); never saved
        lab: null,
        industrialSide: rng.int(0, 3),
    };
    layStreets(C, rng);
    assignDistricts(C, rng);
    for (let bj = 0; bj < CITY.blocks; bj++) for (let bi = 0; bi < CITY.blocks; bi++) {
        if (C.blocks[bj * CITY.blocks + bi].done) continue;
        fillBlock(C, rng, bi, bj);
    }
    dressStreets(C, rng);
    for (const b of C.buildings) chooseEntrances(C, rng, b);
    return C;
}

// ------------------------------------------------------------------ ground

function layStreets(C, rng) {
    C.ground.fill(G_ROAD);
    for (let bj = 0; bj < CITY.blocks; bj++) for (let bi = 0; bi < CITY.blocks; bi++) {
        const x0 = blockOrigin(bi), z0 = blockOrigin(bj);
        C.blocks.push({ bi, bj, x0, z0, kind: null, done: false });
        // sidewalk ring around the block, inside the road strip
        for (let z = z0 - 1; z <= z0 + BLOCK; z++) for (let x = x0 - 1; x <= x0 + BLOCK; x++) C.ground[z * N + x] = G_WALK;
        for (let z = z0; z < z0 + BLOCK; z++) for (let x = x0; x < x0 + BLOCK; x++) C.ground[z * N + x] = G_GRASS;
    }
}

function assignDistricts(C, rng) {
    const B = CITY.blocks, mid = (B - 1) / 2;
    const side = C.industrialSide;
    // the industrial side: the three outermost rows of blocks on one side
    const indus = (bi, bj) => (side === 0 ? bi >= B - 3 : side === 1 ? bi <= 2 : side === 2 ? bj >= B - 3 : bj <= 2);
    for (let bj = 0; bj < B; bj++) for (let bi = 0; bi < B; bi++) {
        const d = Math.max(Math.abs(bi - mid), Math.abs(bj - mid));
        let k = d <= 1 ? 'downtown' : d <= 2 ? 'ring' : 'residential';
        if (indus(bi, bj) && d >= 3) k = 'industrial';
        C.blocks[bj * B + bi].kind = k;
    }
    // the lab compound: a 2 x 2 run of industrial blocks on the far edge, off-centre
    const far = side === 0 ? [B - 2, null] : side === 1 ? [0, null] : side === 2 ? [null, B - 2] : [null, 0];
    const along = rng.pick([1, 2, 6, 7]);
    const li = far[0] ?? along, lj = far[1] ?? along;
    C.lab = { bi: li, bj: lj };
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const blk = C.blocks[(lj + dj) * B + li + di];
        blk.kind = 'lab'; blk.done = true;
    }
    makeLab(C, rng, li, lj);
    // the one-of-a-kind buildings each get a block of their own
    const pickBlocks = (kind, n) => rng.shuffle(C.blocks.filter((b) => b.kind === kind && !b.special)).slice(0, n);
    const [m, h, r, g] = pickBlocks('downtown', 4);
    m.special = 'mall'; h.special = 'hotel'; r.special = 'radio'; g.special = 'garage';
    const [hs, sc, lb] = pickBlocks('ring', 3);
    hs.special = 'hospital'; sc.special = 'school'; lb.special = 'library';
}

// ------------------------------------------------------------------ buildings

function nextName(C, list, rng) {
    const used = (C.usedNames ??= new Set());
    const free = list.filter((n) => !used.has(n));
    const n = free.length ? rng.pick(free) : rng.pick(list);
    used.add(n);
    return n;
}

function addBuilding(C, rng, type, x0, z0, w, d, opts = {}) {
    const T = BTYPES[type];
    const floors = opts.floors ?? rng.int(T.floors[0], T.floors[1]);
    const b = {
        id: C.buildings.length, type, x0, z0, w, d, floors, h: opts.h ?? T.h,
        facade: opts.facade ?? rng.pick(T.facade),
        seed: (hashSeed(C.seed * 7919 + C.buildings.length * 104729) >>> 0),
        decay: Math.min(1, 0.25 + rng() * 0.6 + (type === 'house' ? 0.1 : 0)),
        name: opts.name ?? null, lock: null, innerLock: null,
        entrances: [], sides: opts.sides ?? null, compound: !!opts.compound, roof: rng.int(0, 2),
    };
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
        C.owner[z * N + x] = b.id;
        C.ground[z * N + x] = G_BUILDING;
    }
    C.buildings.push(b);
    return b;
}

function paveRect(C, x0, z0, w, d, g) {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) if (C.owner[z * N + x] < 0) C.ground[z * N + x] = g;
}

function fillBlock(C, rng, bi, bj) {
    const blk = C.blocks[bj * CITY.blocks + bi];
    const x0 = blk.x0, z0 = blk.z0, S = BLOCK;
    const k = blk.kind;
    const roll = rng();
    blk.done = true;
    if (k === 'downtown') {
        if (blk.special === 'mall') {
            paveRect(C, x0, z0, S, S, G_PLAZA);
            addBuilding(C, rng, 'mall', x0 + 1, z0 + 1, 23, 23, { name: 'HOLLOW OAKS MALL' });
            return;
        }
        if (blk.special === 'hotel') {
            paveRect(C, x0, z0, S, S, G_PLAZA);
            addBuilding(C, rng, 'hotel', x0 + 1, z0 + 2, 12, 21, { name: 'STARLITE HOTEL' });
            addBuilding(C, rng, 'office', x0 + 14, z0 + 1, 10, 11, { name: nextName(C, OFFICE_NAMES, rng) });
            parkingLot(C, rng, x0 + 14, z0 + 13, 10, 11);
            return;
        }
        if (blk.special === 'radio') {
            paveRect(C, x0, z0, S, S, G_PLAZA);
            addBuilding(C, rng, 'office', x0 + 1, z0 + 1, 11, 11, { name: 'WKVR 88.3', floors: 3 });
            addBuilding(C, rng, 'office', x0 + 13, z0 + 1, 11, 11, { name: 'ASHMERE POLICE DEPT.', floors: 3 });
            addBuilding(C, rng, 'office', x0 + 1, z0 + 13, 23, 11, { name: nextName(C, OFFICE_NAMES, rng) });
            return;
        }
        if (blk.special === 'garage') {
            paveRect(C, x0, z0, S, S, G_PLAZA);
            addBuilding(C, rng, 'garage', x0 + 1, z0 + 1, 14, 23, { name: 'CIVIC CENTRE PARKING' });
            addBuilding(C, rng, 'office', x0 + 16, z0 + 1, 8, 23, { name: nextName(C, OFFICE_NAMES, rng) });
            return;
        }
        // towers in quadrants, sometimes a plaza
        paveRect(C, x0, z0, S, S, G_PLAZA);
        const q = [[0, 0], [13, 0], [0, 13], [13, 13]];
        rng.shuffle(q);
        const plaza = rng.chance(0.4) ? q.pop() : null;
        for (const [dx, dz] of q) addBuilding(C, rng, rng.chance(0.75) ? 'office' : 'apartment', x0 + dx + 1, z0 + dz + 1, 11, 11,
            { name: null });
        for (const b of C.buildings.slice(-q.length)) b.name ??= nextName(C, b.type === 'office' ? OFFICE_NAMES : APT_NAMES, rng);
        if (plaza) plazaProps(C, rng, x0 + plaza[0], z0 + plaza[1], 12, 12);
        return;
    }
    if (k === 'ring') {
        if (blk.special === 'hospital') {
            addBuilding(C, rng, 'hospital', x0 + 2, z0 + 2, 21, 21, { name: 'ST. BRIGID\'S HOSPITAL' });
            return;
        }
        if (blk.special === 'school') {
            addBuilding(C, rng, 'school', x0 + 2, z0 + 2, 21, 12, { name: 'ASHMERE ELEMENTARY' });
            paveRect(C, x0 + 2, z0 + 16, 21, 8, G_LOT);
            playground(C, rng, x0 + 2, z0 + 16, 21, 8);
            return;
        }
        if (blk.special === 'library') {
            addBuilding(C, rng, 'library', x0 + 4, z0 + 3, 17, 14, { name: 'ASHMERE PUBLIC LIBRARY' });
            park(C, rng, x0, z0 + 18, S, 7);
            return;
        }
        if (roll < 0.68) {   // a shopping street: two rows of shops facing the streets
            paveRect(C, x0, z0, S, S, G_LOT);
            for (const dz of [0, 17]) for (let i = 0; i < 4; i++) {
                const b = addBuilding(C, rng, 'shop', x0 + i * 6 + (i ? 1 : 0), z0 + dz, i ? 5 : 6, 8, {});
                b.name = nextName(C, SHOP_NAMES, rng);
            }
            parkingLot(C, rng, x0, z0 + 9, S, 7);
            return;
        }
        if (roll < 0.86) {
            addBuilding(C, rng, 'apartment', x0 + 1, z0 + 1, 10, 22, { name: nextName(C, APT_NAMES, rng) });
            addBuilding(C, rng, 'apartment', x0 + 14, z0 + 1, 10, 22, { name: nextName(C, APT_NAMES, rng) });
            return;
        }
        return park(C, rng, x0, z0, S, S);
    }
    if (k === 'industrial') {
        if (roll < 0.45) {
            paveRect(C, x0, z0, S, S, G_LOT);
            addBuilding(C, rng, 'factory', x0 + 1, z0 + 1, 23, 16, { name: nextName(C, FACTORY_NAMES, rng) });
            yard(C, rng, x0, z0 + 18, S, 7);
            return;
        }
        paveRect(C, x0, z0, S, S, G_LOT);
        addBuilding(C, rng, 'warehouse', x0 + 1, z0 + 1, 11, 20, { name: nextName(C, WAREHOUSE_NAMES, rng) });
        addBuilding(C, rng, 'warehouse', x0 + 13, z0 + 1, 11, 12, { name: nextName(C, WAREHOUSE_NAMES, rng) });
        yard(C, rng, x0 + 13, z0 + 14, 12, 11);
        return;
    }
    // residential: a grid of house lots with yards
    if (roll < 0.1) return park(C, rng, x0, z0, S, S);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const lx = x0 + c * 8 + (c === 2 ? 1 : 0), lz = z0 + r * 13;
        const lw = 8, ld = 12;
        if (rng.chance(0.08)) { overgrownLot(C, rng, lx, lz, lw, ld); continue; }
        const w = rng.int(5, 6), d = rng.int(6, 7);
        const hx = lx + 1 + rng.int(0, lw - w - 1), hz = r === 0 ? lz + 1 + rng.int(0, 1) : lz + ld - d - 1 - rng.int(0, 1);
        addBuilding(C, rng, 'house', hx, hz, w, d, { sides: r === 0 ? 'n' : 's' });
        yardDress(C, rng, lx, lz, lw, ld);
    }
}


// ------------------------------------------------------------------ the lab compound

function makeLab(C, rng, li, lj) {
    const x0 = blockOrigin(li), z0 = blockOrigin(lj);
    const S = BLOCK * 2 + CITY.road;        // 55 tiles
    paveRect(C, x0 - 1, z0 - 1, S + 2, S + 2, G_LOT);
    C.lab.x0 = x0; C.lab.z0 = z0; C.lab.size = S;
    // the perimeter fence runs along the inner edge of the sidewalk
    const gateSide = C.industrialSide;     // the gate faces back into town
    const gateDir = [3, 1, 0, 2][gateSide]; // 0 N, 1 E, 2 S, 3 W
    const mid = Math.floor(S / 2);
    for (let i = 0; i < S; i++) {
        const gate = i === mid || i === mid - 1;
        const lock = gate ? 'gate' : null;
        const kind = gate ? 'gate' : 'fence';
        setFence(C, x0 + i, z0, 0, gateDir === 0 ? kind : 'fence', gateDir === 0 ? lock : null);
        setFence(C, x0 + i, z0 + S - 1, 2, gateDir === 2 ? kind : 'fence', gateDir === 2 ? lock : null);
        setFence(C, x0, z0 + i, 3, gateDir === 3 ? kind : 'fence', gateDir === 3 ? lock : null);
        setFence(C, x0 + S - 1, z0 + i, 1, gateDir === 1 ? kind : 'fence', gateDir === 1 ? lock : null);
    }
    const gx = gateDir === 1 ? x0 + S - 1 : gateDir === 3 ? x0 : x0 + mid - 1;
    const gz = gateDir === 2 ? z0 + S - 1 : gateDir === 0 ? z0 : z0 + mid - 1;
    C.lab.gate = { x: gx, z: gz, dir: gateDir };
    // the great hall with the ring, the office/lab block, the substation
    const hall = addBuilding(C, rng, 'hall', x0 + 14, z0 + 16, 27, 23, { name: 'THRESHOLD — HALL C', compound: true });
    const labb = addBuilding(C, rng, 'lab', x0 + 3, z0 + 3, 22, 10, { name: 'THRESHOLD RESONANCE LABORATORY', compound: true });
    const sub = addBuilding(C, rng, 'lab', x0 + 43, z0 + 4, 9, 8, { name: 'SUBSTATION 2', floors: 1, compound: true });
    hall.lock = 'lab'; labb.lock = null; sub.lock = 'boards';
    C.lab.hall = hall.id; C.lab.labb = labb.id; C.lab.sub = sub.id;
    // dressing: cooling towers, pipes, trucks, containers
    for (let i = 0; i < 3; i++) {
        const tx = x0 + 4 + i * 6, tz = z0 + 44;
        C.props.push({ k: 'tower', x: (tx + 1) * 2, z: (tz + 1) * 2, r: 0, s: 1 + rng() * 0.3 });
        for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 2; dx++) setSolid(C, tx + dx, tz + dz);
    }
    for (let i = 0; i < 5; i++) {
        const tx = x0 + 44 + (i % 2) * 4, tz = z0 + 20 + i * 6;
        container(C, rng, tx, tz, 0);
    }
    for (let i = 0; i < 4; i++) car(C, rng, x0 + 4 + i * 3, z0 + 16, 1, rng.chance(0.5) ? 'van' : 'car');
    C.props.push({ k: 'pipes', x: (x0 + 26) * 2, z: (z0 + 14) * 2, r: 0 });
    for (let i = 0; i < 6; i++) C.lights.push({ x: (x0 + 8 + i * 8) * 2 + 1, z: (z0 + 14) * 2 + 1, on: true, kind: 'flood' });
}

function setFence(C, x, z, dir, kind, lock) {
    C.fence.set(edgeKey(x, z, dir), { kind, lock });
}

/** One key per tile edge, whichever side it is asked from. */
export function edgeKey(x, z, dir) {
    if (dir === 0) return `h${x},${z}`;          // edge above tile (x, z)
    if (dir === 2) return `h${x},${z + 1}`;
    if (dir === 3) return `v${x},${z}`;          // edge left of tile (x, z)
    return `v${x + 1},${z}`;
}

// ------------------------------------------------------------------ outdoor dressing

function setSolid(C, x, z) { if (x >= 0 && z >= 0 && x < N && z < N && C.owner[z * N + x] < 0) C.solid[z * N + x] = 1; }

function car(C, rng, tx, tz, axis, kind = 'car', angle = 0) {
    // a car is 1 x 2 tiles along `axis` (0 = along x, 1 = along z)
    const t2x = axis === 0 ? tx + 1 : tx, t2z = axis === 0 ? tz : tz + 1;
    for (const [x, z] of [[tx, tz], [t2x, t2z]]) {
        if (x < 0 || z < 0 || x >= N || z >= N || C.owner[z * N + x] >= 0 || C.solid[z * N + x]) return false;
    }
    setSolid(C, tx, tz); setSolid(C, t2x, t2z);
    const cx = (tx + t2x + 1) / 2 * 2, cz = (tz + t2z + 1) / 2 * 2;
    C.props.push({
        k: kind, x: cx, z: cz, r: (axis === 0 ? Math.PI / 2 : 0) + angle + (rng.chance(0.5) ? Math.PI : 0),
        c: rng.int(0, 7), rust: rng(), flat: rng.chance(0.4), doorOpen: rng.chance(0.15), lightsOn: rng.chance(0.06),
    });
    return true;
}

function container(C, rng, tx, tz, axis) {
    for (let i = 0; i < 3; i++) setSolid(C, axis ? tx : tx + i, axis ? tz + i : tz);
    C.props.push({ k: 'container', x: (tx + (axis ? 0.5 : 1.5)) * 2, z: (tz + (axis ? 1.5 : 0.5)) * 2, r: axis ? 0 : Math.PI / 2, c: rng.int(0, 4) });
}

function tree(C, rng, tx, tz, dead = rng.chance(0.55)) {
    if (C.owner[tz * N + tx] >= 0 || C.solid[tz * N + tx]) return;
    setSolid(C, tx, tz);
    C.props.push({ k: dead ? 'deadtree' : 'tree', x: tx * 2 + 1, z: tz * 2 + 1, r: rng() * 6.28, s: 0.8 + rng() * 0.6 });
}

function parkingLot(C, rng, x0, z0, w, d) {
    paveRect(C, x0, z0, w, d, G_LOT);
    for (let x = x0 + 1; x < x0 + w - 1; x += 2) {
        if (rng.chance(0.4)) car(C, rng, x, z0 + 1, 1, rng.chance(0.15) ? 'van' : 'car', rng.range(-0.1, 0.1));
        if (d > 5 && rng.chance(0.35)) car(C, rng, x, z0 + d - 3, 1, 'car', rng.range(-0.1, 0.1));
    }
    C.props.push({ k: 'lotlines', x: (x0 + w / 2) * 2, z: (z0 + d / 2) * 2, w: w * 2, d: d * 2 });
}

function park(C, rng, x0, z0, w, d) {
    paveRect(C, x0, z0, w, d, G_GRASS);
    // a path cross and a dry fountain
    const cx = x0 + Math.floor(w / 2), cz = z0 + Math.floor(d / 2);
    for (let x = x0; x < x0 + w; x++) C.ground[cz * N + x] = G_DIRT;
    for (let z = z0; z < z0 + d; z++) C.ground[z * N + cx] = G_DIRT;
    if (w >= 12 && d >= 12) {
        C.props.push({ k: 'fountain', x: cx * 2 + 1, z: cz * 2 + 1, r: 0 });
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setSolid(C, cx + dx, cz + dz);
    }
    for (let i = 0; i < (w * d) / 22; i++) {
        const tx = x0 + rng.int(0, w - 1), tz = z0 + rng.int(0, d - 1);
        if (tx === cx || tz === cz) continue;
        tree(C, rng, tx, tz);
    }
    for (let i = 0; i < 4; i++) C.props.push({ k: 'bench', x: (cx + (i % 2 ? 2 : -2)) * 2 + 1, z: (cz + (i < 2 ? 3 : -3)) * 2 + 1, r: i < 2 ? 0 : Math.PI });
    if (rng.chance(0.5)) C.props.push({ k: 'swings', x: (x0 + 3) * 2, z: (z0 + 3) * 2, r: rng() * 6 });
}

function playground(C, rng, x0, z0, w, d) {
    C.props.push({ k: 'swings', x: (x0 + 4) * 2, z: (z0 + 4) * 2, r: 0 });
    C.props.push({ k: 'slide', x: (x0 + 12) * 2, z: (z0 + 4) * 2, r: 1.2 });
    C.props.push({ k: 'hoop', x: (x0 + 18) * 2, z: (z0 + 2) * 2, r: Math.PI });
}

function plazaProps(C, rng, x0, z0, w, d) {
    const cx = x0 + Math.floor(w / 2), cz = z0 + Math.floor(d / 2);
    C.props.push({ k: 'fountain', x: cx * 2 + 1, z: cz * 2 + 1, r: 0 });
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setSolid(C, cx + dx, cz + dz);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) tree(C, rng, cx + dx, cz + dz, rng.chance(0.4));
    for (let i = 0; i < 3; i++) C.props.push({ k: 'bench', x: (cx - 3 + i * 3) * 2 + 1, z: (cz + 3) * 2 + 1, r: Math.PI });
}

function yard(C, rng, x0, z0, w, d) {
    paveRect(C, x0, z0, w, d, G_LOT);
    for (let i = 0; i < Math.floor(w / 5); i++) {
        if (rng.chance(0.6)) container(C, rng, x0 + 1 + i * 5, z0 + 1 + rng.int(0, Math.max(0, d - 3)), rng.chance(0.5) ? 1 : 0);
    }
    for (let i = 0; i < 3; i++) if (rng.chance(0.5)) car(C, rng, x0 + rng.int(1, w - 3), z0 + rng.int(1, d - 3), rng.int(0, 1), 'truck');
    for (let i = 0; i < 6; i++) C.props.push({ k: rng.pick(['barrel', 'barrel', 'pallet', 'tyres']), x: (x0 + rng() * w) * 2, z: (z0 + rng() * d) * 2, r: rng() * 6 });
}

function overgrownLot(C, rng, x0, z0, w, d) {
    paveRect(C, x0, z0, w, d, G_GRASS);
    for (let i = 0; i < 4; i++) tree(C, rng, x0 + rng.int(1, w - 2), z0 + rng.int(1, d - 2), false);
    C.props.push({ k: 'sign', x: (x0 + 1) * 2, z: (z0 + 1) * 2, r: 0, text: 'LOT FOR SALE' });
}

function yardDress(C, rng, lx, lz, lw, ld) {
    // a broken picket fence along the street side, with a gap for the path
    for (let i = 0; i < 2; i++) if (rng.chance(0.55)) tree(C, rng, lx + rng.int(0, lw - 1), lz + rng.int(0, ld - 1));
    if (rng.chance(0.4)) C.props.push({ k: rng.pick(['tyres', 'barrel', 'trike', 'mower', 'mailbox']), x: (lx + rng() * lw) * 2, z: (lz + rng() * ld) * 2, r: rng() * 6 });
    // side fences between neighbouring yards (real edges with gaps, so no yard is ever closed off)
    for (let z = lz + 1; z < lz + ld - 1; z++) {
        if (rng.chance(0.75)) setFence(C, lx, z, 3, 'picket', null);
    }
}

function dressStreets(C, rng) {
    // traffic: abandoned cars along curbs and stopped in the lanes at odd angles; street lights on the sidewalks
    const B = CITY.blocks;
    const roadsX = [], roadsZ = [];
    for (let i = 0; i <= B; i++) roadsX.push(CITY.edge + i * CITY.pitch - CITY.road);   // the first tile of each road strip
    for (const r0 of roadsX) {
        for (let t = 0; t < N; t++) {
            const curbA = r0 + 1, curbB = r0 + 3;
            // vertical roads run along z at x = r0..r0+4; horizontal ones along x at z = r0..r0+4
            if (t % 9 === 0) {
                if (rng.chance(0.5)) C.lights.push({ x: r0 * 2 + 0.6, z: t * 2 + 1, on: rng.chance(0.35), kind: 'street', r: 0 });
                if (rng.chance(0.5)) C.lights.push({ x: t * 2 + 1, z: r0 * 2 + 0.6, on: rng.chance(0.35), kind: 'street', r: 1 });
            }
            if (C.ground[t * N + curbA] === G_ROAD && rng.chance(0.07)) car(C, rng, curbA, t, 1, rng.chance(0.12) ? 'van' : 'car', rng.range(-0.06, 0.06));
            if (C.ground[t * N + curbB] === G_ROAD && rng.chance(0.07)) car(C, rng, curbB, t, 1, 'car', rng.range(-0.06, 0.06));
            if (C.ground[curbA * N + t] === G_ROAD && rng.chance(0.07)) car(C, rng, t, curbA, 0, 'car', rng.range(-0.06, 0.06));
            if (C.ground[curbB * N + t] === G_ROAD && rng.chance(0.07)) car(C, rng, t, curbB, 0, rng.chance(0.1) ? 'van' : 'car', rng.range(-0.06, 0.06));
            if (C.ground[t * N + r0 + 2] === G_ROAD && rng.chance(0.012)) car(C, rng, r0 + 2, t, 1, 'car', rng.range(-0.6, 0.6));
            if (C.ground[(r0 + 2) * N + t] === G_ROAD && rng.chance(0.012)) car(C, rng, t, r0 + 2, 0, 'car', rng.range(-0.6, 0.6));
        }
    }
    // a bus abandoned in the middle of town, a few buses at stops
    for (let i = 0; i < 4; i++) {
        const r0 = rng.pick(roadsX.slice(1, -1)), t = rng.int(20, N - 20);
        const axis = rng.int(0, 1);
        const tx = axis ? r0 + 1 : t, tz = axis ? t : r0 + 1;
        let ok = true;
        for (let k = 0; k < 5; k++) { const x = axis ? tx : tx + k, z = axis ? tz + k : tz; if (C.solid[z * N + x] || C.ground[z * N + x] !== G_ROAD) ok = false; }
        if (!ok) continue;
        for (let k = 0; k < 5; k++) setSolid(C, axis ? tx : tx + k, axis ? tz + k : tz);
        C.props.push({ k: 'bus', x: (axis ? tx + 0.5 : tx + 2.5) * 2, z: (axis ? tz + 2.5 : tz + 0.5) * 2, r: axis ? 0 : Math.PI / 2, c: 0 });
    }
    // sidewalk furniture: shelters, hydrants, phone booths, newspaper boxes, bins, outdoor vending machines
    let vend = 0, phone = 0, paper = 0;
    for (const blk of C.blocks) {
        if (blk.kind === 'lab') continue;
        const sides = [[blk.x0 - 1, blk.z0 - 1, 1, 0, 0], [blk.x0 - 1, blk.z0 + BLOCK, 1, 0, Math.PI], [blk.x0 - 1, blk.z0 - 1, 0, 1, -Math.PI / 2], [blk.x0 + BLOCK, blk.z0 - 1, 0, 1, Math.PI / 2]];
        for (const [sx, sz, dx, dz, r] of sides) {
            for (let i = 3; i < BLOCK; i += rng.int(5, 9)) {
                const tx = sx + dx * i, tz = sz + dz * i;
                if (C.solid[tz * N + tx] || C.ground[tz * N + tx] !== G_WALK) continue;
                const pick = rng();
                const x = tx * 2 + 1, z = tz * 2 + 1;
                if (pick < 0.12 && vend < 40) { C.props.push({ k: 'vending', x, z, r: r + Math.PI, id: `v${vend++}` }); setSolid(C, tx, tz); }
                else if (pick < 0.2 && phone < 14) { C.props.push({ k: 'phone', x, z, r: r + Math.PI, id: `ph${phone++}` }); setSolid(C, tx, tz); }
                else if (pick < 0.3 && paper < 24) { C.props.push({ k: 'newsbox', x, z, r: r + Math.PI, id: `nb${paper++}` }); setSolid(C, tx, tz); }
                else if (pick < 0.42) C.props.push({ k: 'hydrant', x, z, r });
                else if (pick < 0.55) C.props.push({ k: 'bin', x, z, r });
                else if (pick < 0.62) { C.props.push({ k: 'shelter', x, z, r }); }
                else if (pick < 0.72) tree(C, rng, tx, tz);
                else if (pick < 0.8) C.props.push({ k: 'trash', x, z, r: rng() * 6 });
            }
        }
    }
    // traffic lights at intersections
    for (const rx of roadsX) for (const rz of roadsX) {
        if (rng.chance(0.6)) C.props.push({ k: 'signal', x: rx * 2 + 0.4, z: rz * 2 + 0.4, r: rng.int(0, 3) * Math.PI / 2, blink: rng.chance(0.5) });
    }
}

// ------------------------------------------------------------------ entrances

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export { DIRS };

function chooseEntrances(C, rng, b) {
    // candidate perimeter tiles whose outside neighbour is open ground (not another building, not a solid)
    const cand = [];
    for (let z = b.z0; z < b.z0 + b.d; z++) for (let x = b.x0; x < b.x0 + b.w; x++) {
        for (let dir = 0; dir < 4; dir++) {
            const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
            const inside = nx >= b.x0 && nx < b.x0 + b.w && nz >= b.z0 && nz < b.z0 + b.d;
            if (inside) continue;
            if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
            const g = C.ground[nz * N + nx];
            if (C.owner[nz * N + nx] >= 0 || C.solid[nz * N + nx] || g === G_VOID) continue;
            // stay off the corners, and prefer the faces that look onto a street
            const along = dir % 2 === 0 ? x - b.x0 : z - b.z0, len = dir % 2 === 0 ? b.w : b.d;
            if (along < 1 || along > len - 2) continue;
            let score = rng() * 0.5;
            for (let k = 1; k < 4; k++) {
                const ox = x + DIRS[dir][0] * k, oz = z + DIRS[dir][1] * k;
                if (ox >= 0 && oz >= 0 && ox < N && oz < N && (C.ground[oz * N + ox] === G_WALK || C.ground[oz * N + ox] === G_ROAD)) { score += 2 - k * 0.3; break; }
            }
            if (b.sides === 'n' && dir === 0) score += 3;
            if (b.sides === 's' && dir === 2) score += 3;
            score += Math.abs(along - len / 2) < 2 ? 0.8 : 0;
            cand.push({ x, z, dir, score });
        }
    }
    cand.sort((a, b2) => b2.score - a.score);
    const want = b.type === 'house' || b.type === 'shop' ? 1 + (rng.chance(0.4) ? 1 : 0) : b.type === 'mall' || b.type === 'hospital' ? 4 : 2;
    for (const c of cand) {
        if (b.entrances.length >= want) break;
        if (b.entrances.some((e) => e.dir === c.dir && Math.abs(e.x - c.x) + Math.abs(e.z - c.z) < 4)) continue;
        if (b.entrances.some((e) => e.dir === c.dir) && b.entrances.length < 2 && cand.some((o) => o.dir !== c.dir && o.score > 1.5 && !b.entrances.some((e) => e.dir === o.dir))) continue;
        b.entrances.push({ x: c.x - b.x0, z: c.z - b.z0, dir: c.dir });
    }
    if (!b.entrances.length) throw new Error(`building ${b.id} (${b.type}) has no entrance`);
}

/** The district noise used for decay, so neighbouring buildings rot alike. */
export function rot(C, x, z) { return noise2(x / 40, z / 40, C.seed & 0xffff); }
