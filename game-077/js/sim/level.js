// Parse an ASCII level definition into the static level `L` (never mutated
// during play) and the initial mutable tile array.
//
// Map legend
//   ' '  void (solid, invisible)     '.' ',' ';'  floor styles A, B, C
//   ':'  sand                        '#'  wall      'H'  alt wall (brick, containers)
//   '='  glass (breaks at speed)     '%'  cracked wall (explosions, Tito)
//   'X'  crate (explosions, Tito)    'r'  railing (low, see-through)
//   '~'  water (a pocket)            'o'  open manhole (a round pocket)
//   '"'  hedge (hides a resting ball) '_'  oil slick
//   'T'  palm   'O'  pillar   'B'  neon bumper
//   '1'–'4' door, opened by a switch or terminal with that group
//   'S'  start   'E'  extraction   'I'  intel   '$'  vice tape (bonus)
//   'K'  terminal   'W'  floor switch   'G'  target (see def.targets)

import { T } from './physics.js';

const WALLISH = { '#': T.WALL, 'H': T.WALL2, '=': T.GLASS, '%': T.CRACK, 'X': T.CRATE, 'r': T.RAIL, ' ': T.VOID, '~': T.WATER };

export function parseLevel(def) {
    const rows = def.map;
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const tiles = new Uint8Array(w * h);
    const floor = new Array(w * h).fill(def.floors[0]);
    const holeAt = new Uint8Array(w * h), blockAt = new Uint8Array(w * h);
    const exitAt = new Uint8Array(w * h), hedgeAt = new Uint8Array(w * h);
    const L = {
        def, w, h, floor, holeAt, blockAt, exitAt, hedgeAt,
        circles: [], starts: [], exits: [], doors: {}, holes: [],
        intel: [], tapes: [], terms: [], switches: [], targets: [], palms: [],
    };
    const special = [];
    let iIntel = 0, iTerm = 0, iSwitch = 0, iTarget = 0;
    for (let y = 0; y < h; y++) {
        const row = rows[y];
        for (let x = 0; x < w; x++) {
            const c = row[x] ?? ' ';
            const i = y * w + x;
            const cx = x + 0.5, cy = y + 0.5;
            if (c in WALLISH) { tiles[i] = WALLISH[c]; continue; }
            tiles[i] = T.FLOOR;
            if (c === '.') { floor[i] = def.floors[0]; continue; }
            if (c === ',') { floor[i] = def.floors[1] ?? def.floors[0]; continue; }
            if (c === ';') { floor[i] = def.floors[2] ?? def.floors[0]; continue; }
            if (c === ':') { floor[i] = 'sand'; continue; }
            special.push(i);
            switch (c) {
                case '"': tiles[i] = T.HEDGE; hedgeAt[i] = 1; break;
                case '_': tiles[i] = T.OIL; break;
                case 'o': holeAt[i] = 1; L.holes.push({ x: cx, y: cy }); break;
                case 'T': L.circles.push({ kind: 'palm', x: cx, y: cy, r: 0.22, opaque: false }); L.palms.push({ x: cx, y: cy }); blockAt[i] = 1; break;
                case 'O': L.circles.push({ kind: 'pillar', x: cx, y: cy, r: 0.42, opaque: true }); blockAt[i] = 1; break;
                case 'B': L.circles.push({ kind: 'bumper', x: cx, y: cy, r: 0.36, opaque: false }); blockAt[i] = 1; break;
                case 'S': L.starts.push({ x: cx, y: cy }); break;
                case 'E': exitAt[i] = 1; L.exits.push({ x: cx, y: cy }); break;
                case 'I': L.intel.push({ x: cx, y: cy, ...(def.intel?.[iIntel++] ?? { name: 'the evidence' }) }); break;
                case '$': L.tapes.push({ x: cx, y: cy }); break;
                case 'K': {
                    const t = { x: cx, y: cy, ...(def.terms?.[iTerm++] ?? {}) };
                    L.terms.push(t);
                    L.circles.push({ kind: 'term', x: cx, y: cy, r: 0.3, opaque: false, term: L.terms.length - 1 });
                    blockAt[i] = 1;
                    break;
                }
                case 'W': L.switches.push({ x: cx, y: cy, ...(def.switches?.[iSwitch++] ?? {}) }); break;
                case 'G': L.targets.push({ x: cx, y: cy, ...(def.targets?.[iTarget++] ?? { kind: 'bug', text: 'Plant the bug' }) }); break;
                case '1': case '2': case '3': case '4':
                    tiles[i] = T.DOOR;
                    (L.doors[c] ??= []).push(i);
                    break;
                default:
                    throw new Error(`level ${def.id}: unknown map char '${c}' at ${x},${y}`);
            }
        }
    }
    // Special tiles take the floor style most common among their neighbours.
    for (const i of special) {
        const x = i % w, y = Math.floor(i / w);
        const count = {};
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const c = rows[ny][nx];
            if (c === '.' || c === ',' || c === ';' || c === ':') { const f = floor[ny * w + nx]; count[f] = (count[f] || 0) + 1; }
        }
        let best = floor[i], bn = 0;
        for (const [f, n] of Object.entries(count)) if (n > bn) { bn = n; best = f; }
        floor[i] = best;
    }
    L.tilesInit = tiles;
    return L;
}

/** Objectives for a level, in the order they are listed in the HUD. */
export function buildObjectives(L) {
    const def = L.def, out = [];
    if (def.recruit) out.push({ id: 'recruit', text: def.recruit.text, done: false });
    L.intel.forEach((it, i) => out.push({ id: `intel${i}`, text: `Recover ${it.name}`, done: false }));
    L.terms.forEach((t, i) => { if (t.obj) out.push({ id: `term${i}`, text: t.obj, done: false }); });
    L.targets.forEach((t, i) => out.push({ id: `target${i}`, text: t.text, done: false }));
    if (def.vip) out.push({ id: 'vip', text: def.vip.text, done: false });
    for (const f of def.foes ?? []) if (f.sink) out.push({ id: `sink-${f.k}`, text: f.sink, done: false });
    out.push({ id: 'extract', text: def.extractText ?? 'Get everyone to the car', done: false });
    return out;
}
