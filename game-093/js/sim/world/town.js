// Town generator. Every town is the same bones (a main road, three cross streets, a plaza, rows of buildings facing south)
// with a theme, a seed and a set of civic buildings, so no two feel alike but all of them are walkable.

import { makeRng, hashStr } from '../../rng.js';
import { T } from './tiles.js';
import { LOCS } from './locations.js';

export const TW = 44, TH = 36;

const THEMES = {
    village: { ground: T.GRASS, road: T.DIRT, plaza: T.STONE, tree: 'oak', roofs: ['#b84a3a', '#c8683a', '#a8503a'], wall: '#e8d8b8', waterEast: false },
    river: { ground: T.GRASS, road: T.BRICK, plaza: T.STONE, tree: 'oak', roofs: ['#4a6a9a', '#5a7aa8', '#6a5a8a'], wall: '#e0e4ea', canal: true },
    harbor: { ground: T.STONE, road: T.BRICK, plaza: T.STONE, tree: 'palm', roofs: ['#3a8a9a', '#c8683a', '#e8c06a'], wall: '#f0e8d8', waterEast: true },
    oasis: { ground: T.SAND, road: T.SANDSTONE, plaza: T.SANDSTONE, tree: 'palm', roofs: ['#d89a4a', '#c87a3a', '#e8b86a'], wall: '#f0d8a8', pond: true },
    snow: { ground: T.SNOW, road: T.STONE, plaza: T.STONE, tree: 'pine', roofs: ['#6a4a3a', '#8a5a3a', '#4a5a7a'], wall: '#c8b8a0' },
};

const BUILD_ORDER = {
    // which civic buildings each town gets, in the order they are dealt out to lots (nearest to the plaza first)
    emberfield: ['elder', 'inn', 'shop', 'gear', 'guild'],
    silverbrook: ['chapel', 'inn', 'shop', 'gear', 'guild', 'tavern'],
    portazura: ['inn', 'shop', 'gear', 'guild', 'tavern', 'warehouse'],
    dunehaven: ['library', 'inn', 'shop', 'gear', 'guild'],
    hoarhold: ['barracks', 'inn', 'shop', 'gear', 'guild'],
};

export function genTown(seed, id) {
    const L = LOCS[id], th = THEMES[L.theme];
    const rng = makeRng(hashStr(`${seed}:${id}`));
    const w = TW, h = TH, cx = w >> 1;
    const tile = new Uint8Array(w * h).fill(th.ground), hgt = new Int8Array(w * h), blk = new Uint8Array(w * h);
    const props = [], lights = [], anchors = {}, slots = [], buildings = [];
    const at = (x, y) => y * w + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

    // heights in three terraces
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hgt[at(x, y)] = y < 12 ? 3 : y < 22 ? 2 : 1;
    // roads and plaza
    const road = (x0, y0, x1, y1, t = th.road) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) tile[at(x, y)] = t; };
    road(cx - 1, 2, cx, h - 1);                           // main road
    for (const [y0, y1] of [[10, 11], [20, 21], [29, 30]]) road(2, y0, w - 3, y1);
    road(cx - 6, 12, cx + 5, 19, th.plaza);
    // the border: a wall of rock (trees are drawn on it), broken by the south gate
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (x < 2 || x >= w - 2 || y < 2) { tile[at(x, y)] = T.ROCK; hgt[at(x, y)] += 2; }
    }
    // the terrace step lines get a ramp where the main road crosses (already 1 level apart, so walkable)
    anchors.plaza = [cx, 16]; anchors.gate = [cx, h - 3]; anchors.exit = [cx, h - 1];
    if (id === 'emberfield') {
        // the Dawn Shrine closes the north end of the main road
        props.push({ type: 'shrine', x: cx - 2, y: 3, w: 4, h: 3 });
        for (let y = 3; y < 6; y++) for (let x = cx - 2; x < cx + 2; x++) blk[at(x, y)] = 1;
        anchors.shrine = [cx - 1, 7];
        lights.push({ x: cx, y: 4, z: 2.4, color: 0xffe9a0, intensity: 5, r: 12, kind: 'shrine' });
    }
    // optional water
    if (th.waterEast) {
        for (let y = 2; y < h; y++) for (let x = w - 9; x < w; x++) { tile[at(x, y)] = x < w - 6 ? T.SHALLOW : T.DEEP; hgt[at(x, y)] = 0; }
        for (const py of [8, 16, 24]) for (let x = w - 12; x < w - 4; x++) { tile[at(x, py)] = T.WOOD; tile[at(x, py + 1)] = T.WOOD; hgt[at(x, py)] = hgt[at(x, py + 1)] = hgt[at(w - 13, py)]; }
        anchors.dock = [w - 11, 16];
        // keep the east end of the cross streets from running into the sea
        for (let y = 2; y < h; y++) for (let x = w - 13; x < w - 9; x++) if (tile[at(x, y)] === T.ROCK) tile[at(x, y)] = th.ground;
    }
    if (th.pond) {
        for (let y = 4; y < 9; y++) for (let x = 6; x < 13; x++) { const d = Math.hypot(x - 9, y - 6); if (d < 3.2) { tile[at(x, y)] = d < 2.2 ? T.DEEP : T.SHALLOW; hgt[at(x, y)] = hgt[at(x, y)] - 1; } }
    }
    if (th.canal) {
        for (let y = 2; y < h; y++) { for (const x of [w - 7, w - 6]) { if (tile[at(x, y)] === T.ROCK && y < 2) continue; tile[at(x, y)] = T.SHALLOW; hgt[at(x, y)] = 0; } }
        for (const py of [10, 20, 29]) for (const x of [w - 7, w - 6]) { tile[at(x, py)] = T.BRIDGE; tile[at(x, py + 1)] = T.BRIDGE; hgt[at(x, py)] = hgt[at(x, py + 1)] = hgt[at(w - 8, py)]; }
    }
    const solid = (x, y, v = 1) => { if (inb(x, y)) blk[at(x, y)] = v; };
    const isRoad = (x, y) => { const t = tile[at(x, y)]; return t === th.road || t === th.plaza; };

    // lots: rows of buildings facing south onto the three cross streets
    const rows = [
        { bottom: 9, sides: [[4, cx - 3], [cx + 2, w - 5]] },
        { bottom: 19, sides: [[4, cx - 8], [cx + 7, w - 5]] },
        { bottom: 28, sides: [[4, cx - 3], [cx + 2, w - 5]] },
    ];
    const eastLimit = th.waterEast ? w - 14 : th.canal ? w - 9 : w - 4;
    const lots = [];
    for (const [ri, row] of rows.entries()) {
        for (const [x0, x1r] of row.sides) {
            const x1 = Math.min(x1r, eastLimit);
            let x = x0;
            while (x + 5 <= x1) {
                const bw = 5 + (rng() < 0.25 ? 1 : 0), bh = 4 + (rng() < 0.4 ? 1 : 0);
                lots.push({ x, y: row.bottom - bh + 1, bw, bh, row: ri, cx: x + bw / 2 });
                x += bw + 1 + (rng() < 0.3 ? 1 : 0);
            }
        }
    }
    // the civic buildings take the lots nearest the plaza; the rest are homes
    lots.sort((a, b) => Math.hypot(a.cx - cx, a.y + a.bh - 16) - Math.hypot(b.cx - cx, b.y + b.bh - 16) + (rng() - 0.5) * 6);
    const civic = BUILD_ORDER[id] || ['inn', 'shop', 'gear', 'guild'];
    lots.forEach((lot, i) => {
        const kind = civic[i] || 'house';
        const style = kind;
        const b = { type: 'building', kind, style, x: lot.x, y: lot.y, w: lot.bw, h: lot.bh, door: [lot.x + (lot.bw >> 1), lot.y + lot.bh], roof: th.roofs[Math.floor(rng() * th.roofs.length)], wall: th.wall, seed: Math.floor(rng() * 1e6), floors: kind === 'house' ? 1 + (rng() < 0.3 ? 1 : 0) : (kind === 'inn' || kind === 'chapel' || kind === 'library' || kind === 'barracks' ? 2 : 1), id: `${id}:b${i}` };
        for (let y = lot.y; y < lot.y + lot.bh; y++) for (let x = lot.x; x < lot.x + lot.bw; x++) solid(x, y);
        // a patch of dirt in front softens the join with the street
        buildings.push(b); props.push(b);
        if (kind !== 'house') anchors[kind] = [b.door[0], b.door[1]];
        lights.push({ x: b.door[0] - 0.9, y: b.door[1] - 0.8, z: 1.4, color: 0xffc070, intensity: 1.6, r: 5, night: true, kind: 'window' });
    });

    // plaza: a fountain, lamps, benches
    props.push({ type: 'fountain', x: cx - 1, y: 15, w: 2, h: 2 }); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) solid(cx - 1 + dx, 15 + dy);
    for (const [lx, ly] of [[cx - 6, 12], [cx + 5, 12], [cx - 6, 19], [cx + 5, 19]]) { props.push({ type: 'lamp', x: lx, y: ly }); solid(lx, ly); lights.push({ x: lx + 0.5, y: ly + 0.5, z: 2.0, color: 0xffd9a0, intensity: 2.4, r: 7, night: true, kind: 'lamp' }); }
    for (const [lx, ly] of [[cx - 4, 17], [cx + 3, 17]]) { props.push({ type: 'bench', x: lx, y: ly }); }
    // lamps along the main road
    for (const ly of [6, 25, 33]) for (const lx of [cx - 2, cx + 1]) if (isRoad(lx, ly) || tile[at(lx, ly)] === th.ground) { props.push({ type: 'lamp', x: lx, y: ly }); solid(lx, ly); lights.push({ x: lx + 0.5, y: ly + 0.5, z: 2.0, color: 0xffd9a0, intensity: 2.0, r: 6, night: true, kind: 'lamp' }); }
    // quest board beside the guild or the plaza
    const g = anchors.guild || [cx + 4, 20];
    props.push({ type: 'board', x: g[0] + 2, y: g[1], interact: 'board' }); solid(g[0] + 2, g[1]);
    anchors.board = [g[0] + 2, g[1]];
    // scenery: trees, bushes, crates on free ground
    const free = (x, y) => inb(x, y) && x > 2 && x < w - 3 && y > 2 && !blk[at(x, y)] && tile[at(x, y)] === th.ground && !(x >= cx - 2 && x <= cx + 1);
    const frontOfDoor = (x, y) => buildings.some((b) => Math.abs(x - b.door[0]) <= 1 && y >= b.door[1] && y <= b.door[1] + 1);
    for (let n = 0; n < 260; n++) {
        const x = rng.int(3, w - 4), y = rng.int(3, h - 3);
        if (!free(x, y) || frontOfDoor(x, y) || buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h && rng() < 0.6)) continue;
        const r = rng();
        if (y > 30 && x > cx - 4 && x < cx + 3) continue;
        if (r < 0.45) { props.push({ type: 'tree', kind: th.tree, x, y, seed: Math.floor(rng() * 1e6) }); solid(x, y); }
        else if (r < 0.65) props.push({ type: 'bush', x, y, seed: Math.floor(rng() * 1e6) });
        else if (r < 0.8) props.push({ type: 'flowers', x, y, seed: Math.floor(rng() * 1e6) });
        else if (r < 0.9) { props.push({ type: 'crate', x, y, seed: Math.floor(rng() * 1e6) }); solid(x, y); }
        else { props.push({ type: 'barrel', x, y }); solid(x, y); }
    }
    // the rock border gets trees
    for (let x = 0; x < w; x += 1) for (const y of [0, 1]) if (rng() < 0.7) props.push({ type: 'tree', kind: th.tree, x, y, border: true, seed: Math.floor(rng() * 1e6) });
    for (let y = 2; y < h; y += 1) for (const x of [0, 1, w - 2, w - 1]) if (tile[at(x, y)] === T.ROCK && rng() < 0.6) props.push({ type: 'tree', kind: th.tree, x, y, border: true, seed: Math.floor(rng() * 1e6) });
    // a gate arch at the south exit
    props.push({ type: 'gate', x: cx - 1, y: h - 3, w: 2, h: 1 });
    // NPC walking spots: road and plaza tiles away from doors
    for (let y = 10; y <= 30; y++) for (let x = 3; x < w - 3; x++) if (isRoad(x, y) && !blk[at(x, y)] && !frontOfDoor(x, y)) slots.push([x, y]);

    const exits = [{ x: cx - 1, y: h - 1, to: 'over', w: 2 }];
    const map = {
        id, kind: 'town', name: L.name, theme: L.theme, w, h, tile, hgt, blk, props, buildings, lights, anchors, slots, exits, npcs: [], mobs: [],
        spawn: [cx - 0.5, h - 4], music: 'town', tier: L.tier, zone: null, ground: th.ground,
    };
    return map;
}
