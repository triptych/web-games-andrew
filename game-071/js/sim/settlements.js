/**
 * settlements.js — the built world: towns, keeps, camps, towers, shrines and dungeon mouths.
 *
 * Authored layouts in metres relative to each location's centre. Produces:
 *   buildings  { id, loc, type, x, z, y, rot, w, d, h, roof, wall, door, interior, name }
 *   props      { type, x, z, y, rot, s, loc }           (wells, stalls, crafting stations, lamps…)
 *   walls      { pts, h, thick, style, loc }             (city walls and palisades)
 *   doors      { id, x, z, y, rot, to, name, loc, locked } load doors into interior cells
 *   stations   { id, type, x, z, y, rot, loc }           crafting stations the player can use
 *   anchors    { id, loc, kind, x, z, y, rot }           where NPCs sit, work, guard and sleep
 * and registers colliders for all of it.
 */
import { LOC, LOCATIONS, SIGNPOSTS } from './geography.js';

// footprint and look per building type; rot 0 = the door faces +z (south)
export const BTYPES = {
    house_s:  { w: 8,  d: 6,  h: 3.2, roof: 'shingle', wall: 'log', interior: 'house' },
    house_m:  { w: 10, d: 7,  h: 3.4, roof: 'shingle', wall: 'log', interior: 'house' },
    house_l:  { w: 13, d: 8,  h: 3.6, roof: 'shingle', wall: 'log', interior: 'house' },
    hut:      { w: 6,  d: 5,  h: 2.6, roof: 'thatch',  wall: 'plank', interior: 'house' },
    inn:      { w: 17, d: 11, h: 4.2, roof: 'shingle', wall: 'log', interior: 'inn' },
    shop:     { w: 10, d: 8,  h: 3.6, roof: 'shingle', wall: 'log', interior: 'shop' },
    hall:     { w: 32, d: 15, h: 6.5, roof: 'shingle', wall: 'log', interior: 'hall' },
    guild:    { w: 24, d: 12, h: 5,   roof: 'turf',    wall: 'log', interior: 'guild' },
    temple:   { w: 15, d: 11, h: 5.5, roof: 'stone',   wall: 'stone', interior: 'temple' },
    barracks: { w: 14, d: 8,  h: 4,   roof: 'shingle', wall: 'stone', interior: 'barracks' },
    smithy:   { w: 8,  d: 6,  h: 3,   roof: 'shingle', wall: 'open', interior: null },
    stable:   { w: 12, d: 6,  h: 3,   roof: 'thatch',  wall: 'open', interior: null },
    mill:     { w: 11, d: 8,  h: 4.5, roof: 'shingle', wall: 'plank', interior: 'house' },
    stone_s:  { w: 9,  d: 7,  h: 3.8, roof: 'flat',    wall: 'stone', interior: 'house' },
    stone_l:  { w: 14, d: 10, h: 5,   roof: 'flat',    wall: 'stone', interior: 'shop' },
    keep:     { w: 26, d: 18, h: 9,   roof: 'flat',    wall: 'stone', interior: 'hall' },
    tower:    { w: 9,  d: 9,  h: 15,  roof: 'cone',    wall: 'stone', interior: null, round: true },
    ruin_tower: { w: 10, d: 10, h: 13, roof: 'none',   wall: 'stone', interior: null, round: true, ruined: true },
    spire:    { w: 14, d: 14, h: 34,  roof: 'cone',    wall: 'stone', interior: 'academy', round: true },
    monastery: { w: 30, d: 16, h: 8,  roof: 'stone',   wall: 'stone', interior: 'monastery' },
    tent:     { w: 4,  d: 3.5, h: 2.2, roof: 'tent',   wall: 'none', interior: null },
    hidetent: { w: 7,  d: 7,  h: 4.5, roof: 'hide',    wall: 'none', interior: null },
    shack:    { w: 7,  d: 5,  h: 2.8, roof: 'shingle', wall: 'plank', interior: 'house' },
};

const BIG_WALL = { h: 6, thick: 2.2, style: 'stone' };

export class Settlements {
    constructor(terrain, colliders) {
        this.T = terrain;
        this.C = colliders;
        this.buildings = []; this.props = []; this.walls = []; this.doors = []; this.stations = []; this.anchors = [];
        this.lights = [];   // torches and braziers: { x, y, z, kind }
        this.build();
    }

    ground(x, z) { return this.T.heightAt(x, z); }

    // ------------------------------------------------------------ primitives
    bld(loc, id, type, x, z, rot = 0, extra = {}) {
        const t = { ...BTYPES[type], ...extra };
        const L = LOC[loc];
        const wx = L.x + x, wz = L.z + z;
        // the footing goes down to the lowest corner; the floor sits on the highest
        const c = Math.cos(rot), s = Math.sin(rot);
        let lo = Infinity, hi = -Infinity;
        for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
            const lx = cx * t.w / 2, lz = cz * t.d / 2;
            const g = this.ground(wx + lx * c + lz * s, wz - lx * s + lz * c);
            lo = Math.min(lo, g); hi = Math.max(hi, g);
        }
        const b = { id: `${loc}:${id}`, loc, type, x: wx, z: wz, y: hi + 0.15, foot: lo - 0.5, rot, ...t, name: extra.name || null };
        // door on the front (+z local) face
        if (t.interior && !extra.noDoor) {
            const dl = t.round ? t.w / 2 : t.d / 2;
            const dx = s * (dl + 0.25), dz = c * (dl + 0.25);
            b.door = { x: wx + dx, z: wz + dz, y: b.y, rot };
            this.doors.push({ id: b.id, x: b.door.x, z: b.door.z, y: b.y, rot, to: b.id, interior: extra.interiorKind || t.interior, name: extra.name || defaultName(t.interior), loc, locked: extra.locked || 0, owner: extra.owner || null });
        }
        this.buildings.push(b);
        if (t.wall !== 'none') {
            if (t.round) this.C.add({ t: 'c', x: wx, z: wz, r: t.w / 2, y0: b.foot, y1: b.y + t.h + 4, building: b.id });
            else if (t.wall === 'open') {   // posts only, and the roof
                for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.C.add({ t: 'c', x: wx + (px * t.w / 2 - 0.2 * px) * c + (pz * t.d / 2 - 0.2 * pz) * s, z: wz - (px * t.w / 2 - 0.2 * px) * s + (pz * t.d / 2 - 0.2 * pz) * c, r: 0.22, y0: b.foot, y1: b.y + t.h });
            } else this.C.add({ t: 'b', x: wx, z: wz, hw: t.w / 2, hd: t.d / 2, rot, y0: b.foot, y1: b.y + t.h + 5, building: b.id });
        } else if (type === 'tent' || type === 'hidetent') {
            this.C.add({ t: 'b', x: wx, z: wz, hw: t.w / 2 * 0.8, hd: t.d / 2 * 0.8, rot, y0: b.foot, y1: b.y + t.h });
        }
        return b;
    }

    prop(loc, type, x, z, rot = 0, extra = {}) {
        const L = LOC[loc];
        const wx = L.x + x, wz = L.z + z;
        const p = { type, x: wx, z: wz, y: extra.y ?? this.ground(wx, wz), rot, s: extra.s || 1, loc, ...extra };
        p.x = wx; p.z = wz;
        this.props.push(p);
        const col = PROP_COLLIDE[type];
        if (col) {
            if (col.r) this.C.add({ t: 'c', x: wx, z: wz, r: col.r * p.s, y0: p.y - 0.5, y1: p.y + col.h * p.s });
            else this.C.add({ t: 'b', x: wx, z: wz, hw: col.w / 2 * p.s, hd: col.d / 2 * p.s, rot, y0: p.y - 0.5, y1: p.y + col.h * p.s, walk: !!col.walk });
        }
        if (STATION_TYPES.includes(type)) this.stations.push({ id: `${loc}:${type}:${this.stations.length}`, type, x: wx, z: wz, y: p.y, rot, loc });
        if (LIGHT_TYPES[type]) this.lights.push({ x: wx, y: p.y + LIGHT_TYPES[type], z: wz, kind: type });
        return p;
    }

    anchor(loc, kind, x, z, rot = 0, id = null) {
        const L = LOC[loc];
        const a = { id: id || `${loc}:${kind}:${this.anchors.length}`, loc, kind, x: L.x + x, z: L.z + z, rot };
        a.y = this.ground(a.x, a.z);
        this.anchors.push(a);
        return a;
    }

    /** A wall along local points (closed if `closed`), with gaps at `gates` (segment indices). */
    wall(loc, pts, opts = {}) {
        const L = LOC[loc];
        const P = pts.map(([x, z]) => [L.x + x, L.z + z]);
        const st = { ...BIG_WALL, ...opts };
        const segs = [];
        const n = opts.closed ? P.length : P.length - 1;
        for (let i = 0; i < n; i++) {
            if (opts.gates && opts.gates.includes(i)) continue;
            const a = P[i], b = P[(i + 1) % P.length];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
            const rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
            const y0 = Math.min(this.ground(a[0], a[1]), this.ground(b[0], b[1]), this.ground(mx, mz)) - 1;
            segs.push({ a, b, mx, mz, len, rot, y0 });
            this.C.add({ t: 'b', x: mx, z: mz, hw: st.thick / 2, hd: len / 2 + 0.3, rot, y0, y1: y0 + st.h + 3 });
        }
        this.walls.push({ loc, segs, ...st });
    }

    ringPts(r, n, skipFrom = null, skipTo = null) {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return pts;
    }

    // ------------------------------------------------------------ the world
    build() {
        this.brightwater();
        this.pinebrook();
        this.hrimvik();
        this.stonecleft();
        this.mirefen();
        this.kelvik();
        this.hollowmere();
        this.highcairn();
        this.smallSites();
        for (const s of SIGNPOSTS) this.props.push({ type: 'signpost', x: s.x, z: s.z, y: this.ground(s.x, s.z), rot: 0, s: 1, to: s.to });
        for (const br of this.T.bridges) {
            this.props.push({ type: 'bridge', x: br.x, z: br.z, y: br.h, rot: br.ang, s: 1, len: br.len });
            // deck: a walkable box (and low rails)
            this.C.add({ t: 'b', x: br.x, z: br.z, hw: 3, hd: br.len / 2, rot: br.ang, y0: br.h - 1.2, y1: br.h, walk: true });
            for (const side of [-1, 1]) {
                const c = Math.cos(br.ang), s = Math.sin(br.ang);
                this.C.add({ t: 'b', x: br.x + c * 3.1 * side, z: br.z - s * 3.1 * side, hw: 0.15, hd: br.len / 2, rot: br.ang, y0: br.h, y1: br.h + 1.1 });
            }
        }
    }

    brightwater() {
        const L = 'brightwater';
        // lower town centre is (40,-95) = local (0, 25); the hall terrace is local (0,-58) at +11 m
        const cz = 25;
        const ring = [];
        for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ring.push([Math.cos(a) * 108, cz + Math.sin(a) * 108]); }
        // gates at south (a=π/2 → index 7), east (index 0) and west (index 14); the north arc meets the terrace
        this.wall(L, ring, { closed: true, gates: [6, 7, 13, 14, 27, 0, 19, 20, 21, 22] });
        for (const [gx, gz] of [[0, cz + 108], [108, cz], [-108, cz]]) {
            const ang = Math.atan2(gx, gz - cz);
            this.prop(L, 'gatehouse', gx, gz, ang);
            this.lights.push({ x: LOC[L].x + gx + Math.cos(ang) * 4, y: this.ground(LOC[L].x + gx, LOC[L].z + gz) + 4, z: LOC[L].z + gz - Math.sin(ang) * 4, kind: 'torch' });
            this.anchor(L, 'guard', gx * 0.94, cz + (gz - cz) * 0.94, ang + Math.PI);
        }
        this.prop(L, 'tower_small', 77, cz - 77, 0); this.prop(L, 'tower_small', -77, cz - 77, 0);
        this.prop(L, 'tower_small', 77, cz + 77, 0); this.prop(L, 'tower_small', -77, cz + 77, 0);
        // the terrace: retaining wall, stairs, Wyrmguard Hall
        this.prop(L, 'terrace', 0, -58, 0, { r: 42, rise: 11, y: this.ground(LOC[L].x, LOC[L].z - 58) });
        this.prop(L, 'stairs', 0, -10, 0, { len: 26, rise: 11, wid: 7, y: this.ground(LOC[L].x, LOC[L].z - 0) });
        this.bld(L, 'hall', 'hall', 0, -66, 0, { name: 'Wyrmguard Hall', owner: 'warden_sigrun' });
        for (const bx of [-12, 12]) this.prop(L, 'banner', bx, -57, 0, { color: 0xc8a43c });
        this.prop(L, 'brazier', -6, -52, 0); this.prop(L, 'brazier', 6, -52, 0);
        this.anchor(L, 'guard', -5, -50, 0); this.anchor(L, 'guard', 5, -50, 0);
        // plaza with the Eldertree, the well and the market
        this.prop(L, 'eldertree', 0, 22, 0);
        this.prop(L, 'well', 16, 40, 0);
        for (const [sx, sz, r] of [[-16, 45, 0.3], [-24, 30, 0.9], [20, 55, -0.3]]) { this.prop(L, 'stall', sx, sz, r); this.anchor(L, 'vendor', sx + Math.sin(r) * -1.5, sz - Math.cos(r) * 1.5, r); }
        for (const [bx, bz, r] of [[-8, 30, 0.5], [8, 14, -2.6], [-10, 12, 2.4]]) { this.prop(L, 'bench', bx, bz, r); this.anchor(L, 'sit', bx, bz, r); }
        // main street lamps
        for (const z of [100, 80, 60, 40]) { this.prop(L, 'lamp', -5, z, 0); this.prop(L, 'lamp', 5, z + 10, 0); }
        // buildings
        this.bld(L, 'forge', 'smithy', 28, 102, -Math.PI / 2, { name: 'Steelheart Forge' });
        this.prop(L, 'forge', 32, 108, -Math.PI / 2); this.prop(L, 'anvil', 30, 104, 0); this.prop(L, 'grindstone', 24, 110, 0); this.prop(L, 'workbench', 34, 98, Math.PI); this.prop(L, 'smelter', 38, 104, -Math.PI / 2); this.prop(L, 'tanning', 22, 98, 0.3);
        this.anchor(L, 'work', 30, 105, Math.PI / 2, 'brightwater:anvil');
        this.bld(L, 'eira_house', 'house_m', 46, 92, -Math.PI / 2, { name: "Eira's House", owner: 'eira' });
        this.bld(L, 'sundries', 'shop', -30, 74, Math.PI / 2, { name: "Orrin's Sundries" });
        this.bld(L, 'thistle', 'shop', 30, 70, -Math.PI / 2, { name: 'Thistle & Thorn', interiorKind: 'alchemist' });
        this.bld(L, 'inn', 'inn', -34, 36, Math.PI / 2, { name: 'The Laughing Mare' });
        this.bld(L, 'temple', 'temple', 44, 34, -Math.PI / 2, { name: 'Temple of the Sky-Mother' });
        this.bld(L, 'hearthhall', 'guild', -58, -2, Math.PI / 2, { name: 'Hearthhall' });
        this.bld(L, 'cottage', 'house_s', 62, 92, -Math.PI / 2, { name: 'Windward Cottage', locked: 100, owner: 'player_house' });
        this.bld(L, 'barracks', 'barracks', -70, 46, Math.PI / 2, { name: 'Brightwater Barracks' });
        this.bld(L, 'house1', 'house_m', -24, 100, Math.PI / 2, { name: "Hrolfgar's House" });
        this.bld(L, 'house2', 'house_s', -46, 86, Math.PI / 2, { name: "Ulla's House" });
        this.bld(L, 'house3', 'house_l', 62, 56, -Math.PI / 2, { name: 'Greywind House' });
        this.bld(L, 'house4', 'house_m', -62, 70, 0.9, { name: "Torvald's House" });
        this.bld(L, 'house5', 'house_s', 80, 20, -2.2, { name: "Agna's House" });
        this.bld(L, 'house6', 'house_m', 70, -6, -2.6, { name: 'Battle-Born Lodge' });
        this.bld(L, 'house7', 'house_s', -76, 20, 2.1, { name: 'Old Kari\'s House' });
        for (const [x, z] of [[-16, 60], [16, 82], [-40, 52], [50, 20], [-50, 18]]) this.prop(L, 'barrel', x, z, x * 0.1);
        this.prop(L, 'crate', 18, 62, 0.3); this.prop(L, 'cart', -14, 110, 0.4);
        // the stables outside the south gate, with the wagon and the farms
        this.bld(L, 'stables', 'stable', 34, 132, 0, { name: 'Brightwater Stables' });
        this.prop(L, 'wagon', 18, 134, 0.2);
        this.anchor(L, 'work', 30, 128, 0, 'brightwater:stables');
        this.bld(L, 'farm1', 'house_m', -70, 150, 0.4, { name: 'Pelagia Farm' });
        this.prop(L, 'haystack', -58, 156, 0); this.prop(L, 'fence', -60, 140, 0, { len: 24 });
        this.anchor(L, 'work', -60, 152, 0, 'brightwater:farm');
    }

    pinebrook() {
        const L = 'pinebrook';
        this.bld(L, 'inn', 'inn', -26, -8, Math.PI / 2, { name: 'The Sleeping Elk' });
        this.bld(L, 'goods', 'shop', -20, 22, Math.PI / 2, { name: 'Riverside Goods' });
        this.bld(L, 'hakon', 'house_m', -34, -40, Math.PI / 2, { name: "Hakon's House" });
        this.bld(L, 'forge', 'smithy', -14, -34, Math.PI / 2, { name: "Hakon's Forge" });
        this.prop(L, 'forge', -12, -38, Math.PI / 2); this.prop(L, 'anvil', -10, -33, 0); this.prop(L, 'grindstone', -8, -40, 0); this.prop(L, 'workbench', -16, -28, 0); this.prop(L, 'smelter', -6, -30, 0.2); this.prop(L, 'tanning', -18, -44, 0.4);
        this.anchor(L, 'work', -10, -35, -Math.PI / 2, 'pinebrook:anvil');
        this.bld(L, 'ragna', 'house_s', -46, 10, Math.PI / 2, { name: "Ragna's House" });
        this.bld(L, 'house1', 'house_s', -40, 40, 1.3, { name: "Faendal's House" });
        this.bld(L, 'mill', 'mill', 30, 8, -Math.PI / 2, { name: 'Pinebrook Mill' });
        this.prop(L, 'waterwheel', 17, 8, -Math.PI / 2);
        this.prop(L, 'woodpile', 30, 26, 0); this.prop(L, 'logpile', 40, -10, 0.4);
        this.anchor(L, 'work', 34, 22, Math.PI, 'pinebrook:mill');
        this.bld(L, 'house2', 'house_m', 38, -28, -Math.PI / 2, { name: "Sven's Cabin" });
        this.bld(L, 'house3', 'house_s', 42, 40, -2.2, { name: 'Alvi\'s House' });
        this.prop(L, 'fence', -54, -20, Math.PI / 2, { len: 18 });
        this.prop(L, 'cookpot', -8, 6, 0); this.prop(L, 'campfire', -8, 6, 0);
        for (const [x, z] of [[-4, -14], [-30, 34], [24, -16]]) this.prop(L, 'lamp', x, z, 0);
        this.anchor(L, 'sit', -10, 9, Math.PI); this.anchor(L, 'stand', 0, 0, 0);
    }

    hrimvik() {
        const L = 'hrimvik';
        this.bld(L, 'hall', 'hall', 0, -20, 0, { name: 'The Frost Hall', w: 26, d: 13 });
        this.bld(L, 'inn', 'inn', -40, 26, Math.PI / 2, { name: 'The Frozen Hearth' });
        this.bld(L, 'shop', 'shop', 38, 30, -Math.PI / 2, { name: "Birna's Oddments" });
        this.bld(L, 'house1', 'house_m', -50, -24, Math.PI / 2);
        this.bld(L, 'house2', 'house_s', 46, -10, -Math.PI / 2);
        this.bld(L, 'house3', 'house_s', -10, 56, Math.PI);
        this.bld(L, 'house4', 'house_m', 20, 64, Math.PI);
        this.bld(L, 'spire', 'spire', 72, -44, Math.PI * 0.75, { name: 'The Frostspire' });
        this.bld(L, 'forge', 'smithy', 52, 52, Math.PI);
        this.prop(L, 'forge', 50, 55, Math.PI); this.prop(L, 'anvil', 54, 49, 0); this.prop(L, 'grindstone', 46, 50, 0); this.prop(L, 'workbench', 58, 54, 0);
        this.anchor(L, 'work', 54, 50, 0, 'hrimvik:anvil');
        this.prop(L, 'brazier', -6, -8, 0); this.prop(L, 'brazier', 6, -8, 0);
        for (const [x, z] of [[-20, 40], [10, 30], [30, 10], [-30, 0]]) this.prop(L, 'lamp', x, z, 0);
        this.anchor(L, 'guard', 0, 80, Math.PI); this.anchor(L, 'guard', -60, 50, Math.PI / 2);
        this.prop(L, 'dock', -10, -105, 0, { len: 30 });
        this.prop(L, 'boat', 6, -118, 1.2);
    }

    stonecleft() {
        const L = 'stonecleft';
        this.bld(L, 'keep', 'keep', -62, 0, Math.PI / 2, { name: 'Understone Keep' });
        this.prop(L, 'brazier', -46, -8, 0); this.prop(L, 'brazier', -46, 8, 0);
        this.bld(L, 'inn', 'stone_l', 10, -36, 0, { name: 'The Ore & Anvil', interiorKind: 'inn' });
        this.bld(L, 'shop', 'stone_l', 26, 30, Math.PI, { name: "Arnleif's Goods", interiorKind: 'shop' });
        this.bld(L, 'temple', 'temple', -20, 48, Math.PI, { name: 'Hall of the Deep Mother' });
        for (const [i, x, z, r] of [[1, 40, -6, -Math.PI / 2], [2, -16, -50, 0], [3, 50, 52, Math.PI], [4, -36, -44, 0.3], [5, 62, -40, -Math.PI / 2]]) this.bld(L, `house${i}`, 'stone_s', x, z, r);
        this.bld(L, 'forge', 'smithy', 30, 0, -Math.PI / 2);
        this.prop(L, 'forge', 34, 4, -Math.PI / 2); this.prop(L, 'anvil', 32, -2, 0); this.prop(L, 'grindstone', 26, -6, 0); this.prop(L, 'smelter', 38, -6, 0); this.prop(L, 'workbench', 26, 8, 0);
        this.anchor(L, 'work', 32, -3, Math.PI / 2, 'stonecleft:anvil');
        this.prop(L, 'statue', 0, 10, 0);
        for (const [x, z] of [[-10, -20], [10, 20], [40, 30], [-30, 20]]) this.prop(L, 'lamp', x, z, 0);
        this.wall(L, [[70, -95], [96, -40], [100, 20], [80, 80], [40, 100]], { h: 7, style: 'stone', gates: [1] });
        this.anchor(L, 'guard', 98, -10, -Math.PI / 2); this.anchor(L, 'guard', 98, 10, -Math.PI / 2);
    }

    mirefen() {
        const L = 'mirefen';
        this.bld(L, 'keep', 'keep', 0, -50, 0, { name: 'Mirefen Keep', w: 22, d: 15 });
        this.bld(L, 'inn', 'inn', -40, 10, Math.PI / 2, { name: 'The Honeywort Tavern' });
        this.bld(L, 'shop', 'shop', 34, -10, -Math.PI / 2, { name: 'Marsh & Market' });
        this.bld(L, 'meadery', 'house_l', 50, 40, -Math.PI / 2, { name: 'Goldhollow Meadery', interiorKind: 'house' });
        this.bld(L, 'cistern', 'shack', -8, 46, Math.PI, { name: 'The Old Cistern', interiorKind: 'ratway' });
        for (const [i, x, z, r] of [[1, -50, -40, Math.PI / 2], [2, -60, 50, 1.2], [3, 20, 66, Math.PI], [4, 60, -50, -Math.PI / 2], [5, -20, -80, 0]]) this.bld(L, `house${i}`, i % 2 ? 'house_m' : 'house_s', x, z, r, { roof: 'shingle', wall: 'plank' });
        this.bld(L, 'forge', 'smithy', 10, 20, 0);
        this.prop(L, 'forge', 12, 24, 0); this.prop(L, 'anvil', 8, 22, 0); this.prop(L, 'grindstone', 4, 18, 0); this.prop(L, 'workbench', 16, 18, 0);
        this.anchor(L, 'work', 8, 23, Math.PI, 'mirefen:anvil');
        this.prop(L, 'dock', 92, 20, Math.PI / 2, { len: 34 });
        this.prop(L, 'boat', 110, 34, 0.3);
        this.prop(L, 'well', 0, 0, 0);
        for (const [x, z] of [[-20, 0], [20, 10], [0, 40], [30, -30]]) this.prop(L, 'lamp', x, z, 0);
        this.wall(L, [[-96, -60], [-80, -96], [-30, -100], [40, -96], [80, -70]], { h: 5, style: 'palisade' });
        this.anchor(L, 'guard', 0, 90, 0); this.anchor(L, 'guard', -90, 0, Math.PI / 2);
    }

    kelvik() {
        const L = 'kelvik';
        this.bld(L, 'inn', 'inn', -18, 0, Math.PI / 2, { name: 'The Mountain Hearth', w: 14, d: 10 });
        this.bld(L, 'house1', 'house_s', 16, -20, -Math.PI / 2);
        this.bld(L, 'house2', 'house_m', 20, 18, -Math.PI / 2);
        this.prop(L, 'stepsmarker', -10, -40, 0);
        this.prop(L, 'campfire', 4, 4, 0);
        this.anchor(L, 'sit', 6, 6, 0);
    }

    hollowmere() {
        const L = 'hollowmere';
        const ring = [[-48, -40], [48, -40], [48, 40], [-48, 40]];
        this.wall(L, ring, { closed: true, h: 8, gates: [0], style: 'stone' });
        for (const [x, z] of ring) this.prop(L, 'tower_small', x, z, 0, { s: 1.2 });
        this.bld(L, 'keep', 'keep', 0, 18, Math.PI, { name: 'Hollowmere Keep', interiorKind: 'undercroft' });
        this.bld(L, 'house1', 'house_s', -30, -18, Math.PI / 2, { burned: true, noDoor: true });
        this.bld(L, 'house2', 'house_s', 30, -16, -Math.PI / 2, { burned: true, noDoor: true });
        this.prop(L, 'block', 0, -20, 0);
        this.prop(L, 'gatehouse', 0, -40, Math.PI);
    }

    highcairn() {
        const L = 'highcairn';
        this.bld(L, 'monastery', 'monastery', 0, -4, Math.PI * 0.85, { name: 'Highcairn' });
        this.prop(L, 'brazier', 6, 12, 0); this.prop(L, 'brazier', -6, 12, 0);
        this.prop(L, 'stairs_stone', 18, 18, 0.6);
    }

    smallSites() {
        for (const L of LOCATIONS) {
            const id = L.id;
            if (['brightwater', 'pinebrook', 'hrimvik', 'stonecleft', 'mirefen', 'kelvik', 'hollowmere', 'highcairn'].includes(id)) continue;
            const face = L.face || 0;
            if (L.dungeon && id !== 'undercroft') {
                const th = L.dungeon.theme;
                const kind = th === 'barrow' ? 'barrow_door' : th === 'cave' ? 'cave_mouth' : th === 'mine' ? 'mine_door' : th === 'deepforge' ? 'deep_door' : th === 'temple' ? 'temple_door' : th === 'fort' ? 'fort' : 'cave_mouth';
                const dx = Math.sin(face) * 3, dz = Math.cos(face) * 3;
                this.prop(id, kind, 0, 0, face);
                this.doors.push({ id: `${id}:entrance`, x: L.x + dx, z: L.z + dz, y: this.ground(L.x + dx, L.z + dz), rot: face, to: `${id}:d0`, interior: 'dungeon', name: L.name, loc: id, locked: 0 });
                if (th === 'barrow' || th === 'temple') { this.prop(id, 'brazier', Math.sin(face) * 5 + Math.cos(face) * 4, Math.cos(face) * 5 - Math.sin(face) * 4, 0); }
                if (th === 'fort') { this.wall(id, [[-30, -30], [30, -30], [30, 30], [-30, 30]], { closed: true, h: 7, gates: [2] }); this.prop(id, 'tower_small', 30, 30, 0); this.prop(id, 'tower_small', -30, 30, 0); }
            }
            if (id === 'undercroft') {
                this.prop(id, 'cave_mouth', 0, 0, face);
                const dx = Math.sin(face) * 3, dz = Math.cos(face) * 3;
                this.doors.push({ id: 'undercroft:exit', x: L.x + dx, z: L.z + dz, y: this.ground(L.x + dx, L.z + dz), rot: face, to: 'hollowmere:keep', interior: 'undercroft', name: 'Hollowmere Undercroft', loc: id, locked: 0, exitOnly: true });
            }
            if (L.kind === 'tower') { this.bld(id, 'tower', 'ruin_tower', 0, 0, 0); this.prop(id, 'rubble', 8, 4, 0); this.prop(id, 'rubble', -6, -8, 1); }
            if (id === 'twintolls') { this.bld(id, 'tower2', 'ruin_tower', 24, 4, 0); this.prop(id, 'campfire', 12, 10, 0); this.prop(id, 'tent', 6, 16, 0.4); }
            if (L.kind === 'totem') {
                const n = L.totems.length;
                L.totems.forEach((tt, i) => { const a = i / n * Math.PI * 2; this.prop(id, 'totem', Math.cos(a) * (n > 1 ? 7 : 0), Math.sin(a) * (n > 1 ? 7 : 0), -a, { totem: tt }); });
            }
            if (L.kind === 'mound') this.prop(id, 'mound', 0, 0, 0);
            if (L.kind === 'shrine' || L.sigil) this.prop(id, 'sigilstone', 0, 0, face, { ring: L.sigil });
            if (id === 'summit') { this.prop(id, 'sigilstone', 0, -6, 0, { ring: 'embers' }); this.prop(id, 'rubble', 6, 4, 0); }
            if (L.camp === 'bandits') { for (let i = 0; i < 4; i++) this.prop(id, 'tent', Math.cos(i * 1.6) * 9, Math.sin(i * 1.6) * 9, i * 1.6 + Math.PI / 2); this.prop(id, 'campfire', 0, 0, 0); this.prop(id, 'palisade', 0, 0, 0, { r: 15 }); }
            if (L.camp === 'giant' || L.camp === 'giant2') { this.bld(id, 'tent', 'hidetent', -6, -4, 0.5); this.prop(id, 'bigfire', 4, 4, 0); this.prop(id, 'tusks', 10, -6, 0.3); }
            if (id === 'hotsprings') for (let i = 0; i < 5; i++) this.prop(id, 'spring', Math.cos(i * 1.3) * 12, Math.sin(i * 1.3) * 12, 0, { s: 0.7 + (i % 3) * 0.3 });
            if (id === 'wreck') this.prop(id, 'wreck', 0, 0, 0.6);
        }
    }
}

function defaultName(kind) {
    return { house: 'House', inn: 'Inn', shop: 'Shop', hall: 'Hall', guild: 'Guild Hall', temple: 'Temple', barracks: 'Barracks', academy: 'Academy', monastery: 'Observatory' }[kind] || 'Door';
}

export const STATION_TYPES = ['forge', 'grindstone', 'workbench', 'smelter', 'tanning', 'alchemy', 'enchanter', 'cookpot'];
const LIGHT_TYPES = { lamp: 2.6, brazier: 1.3, campfire: 0.5, bigfire: 1, forge: 1, torch: 0 };
const PROP_COLLIDE = {
    well: { r: 1.3, h: 1.2 }, stall: { w: 3, d: 2, h: 2.6 }, bench: { w: 2, d: 0.6, h: 0.5 }, lamp: { r: 0.15, h: 3 },
    forge: { w: 2, d: 1.6, h: 1.4 }, anvil: { r: 0.4, h: 0.8 }, grindstone: { r: 0.5, h: 1 }, workbench: { w: 2, d: 0.9, h: 1 },
    smelter: { r: 1, h: 2 }, tanning: { w: 1.8, d: 0.3, h: 2 }, barrel: { r: 0.4, h: 1 }, crate: { w: 1, d: 1, h: 1, walk: true },
    cart: { w: 1.6, d: 3, h: 1.4 }, eldertree: { r: 1.6, h: 20 }, gatehouse: null, tower_small: { r: 3, h: 12 }, brazier: { r: 0.45, h: 1.2 },
    statue: { r: 1.4, h: 6 }, totem: { r: 1, h: 6 }, sigilstone: { r: 3.2, h: 5 }, campfire: { r: 0.6, h: 0.4 }, bigfire: { r: 1.6, h: 1 },
    tent: { w: 3, d: 3, h: 2 }, haystack: { r: 1.4, h: 2 }, woodpile: { w: 3, d: 1, h: 1.2 }, logpile: { w: 4, d: 2, h: 1.2 }, wagon: { w: 1.8, d: 3.5, h: 2 },
    signpost: { r: 0.15, h: 3 }, block: { w: 1, d: 0.6, h: 0.8 }, cookpot: null, stepsmarker: { r: 0.5, h: 2 }, tusks: { r: 1.5, h: 3 },
    mound: null, rubble: { r: 1.5, h: 1.2 }, wreck: { w: 5, d: 16, h: 4 }, cave_mouth: null, barrow_door: null, mine_door: null, deep_door: null, temple_door: null,
};
