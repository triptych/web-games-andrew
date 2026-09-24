/**
 * ascii.mjs — print a generated level as text, with the cells reachable for a gadget set.
 *   node dev/ascii.mjs <seed> <world> <index> [gadgets comma list|base] [x0] [x1]
 */
import { generateLevel } from '../js/levelgen.js';
import { reach } from '../js/validate.js';
import { baselineFor } from '../js/config.js';
import { T } from '../js/tiles.js';

const [seed, world, index, gs = 'base', x0 = 0, x1 = 9999] = process.argv.slice(2);
const L = generateLevel(Number(seed), Number(world), Number(index), { skipValidate: process.env.RAW === '1' });
const gadgets = gs === 'base' ? baselineFor(Number(world)) : new Set(gs.split(',').filter(Boolean));
const r = reach(L, gadgets);
const CH = { [T.EMPTY]: ' ', [T.GROUND]: '#', [T.BRICK]: 'b', [T.QBLOCK]: '?', [T.USED]: 'u', [T.HARD]: 'H', [T.ONEWAY]: '=',
    [T.SPIKE]: '^', [T.LAVA]: '~', [T.LAVA_FILL]: '~', [T.RED]: 'R', [T.BUBBLE]: 'o', [T.CRACK]: 'c', [T.COIN]: '$', [T.HIDDEN]: 'h',
    [T.SPRING]: 'S', [T.CEIL]: '%', [T.POLE]: '|', [T.PIPE_TL]: 'P', [T.PIPE_TR]: 'P', [T.PIPE_L]: 'p', [T.PIPE_R]: 'p' };
const ents = {};
for (const e of L.entities) ents[e.y * L.w + e.x] = e.t === 'shard' ? String(e.slot) : e.t === 'vault' ? 'V' : e.t === 'enemy' ? 'e' : e.t[0].toUpperCase();
console.log(`${L.name} ${L.theme} w=${L.w} attempt=${L.attempt} report=${JSON.stringify(L.report)} gates=${L.gates} nodes=${r.nodes}`);
for (const e of L.entities) if (e.pocket || e.t === 'shard' || e.t === 'vault') console.log(' ', e.t, e.slot ?? e.item, e.pocket || 'route', e.x, e.y, r.visited[e.y * L.w + e.x] ? 'REACHED' : 'no');
const a = Math.max(0, Number(x0)), b = Math.min(L.w, Number(x1));
let hdr = '';
for (let x = a; x < b; x++) hdr += x % 10 === 0 ? String((x / 10) % 10) : ' ';
console.log('   ' + hdr);
for (let y = 0; y < L.h; y++) {
    let line = String(y).padStart(2) + ' ';
    for (let x = a; x < b; x++) {
        const i = y * L.w + x;
        let c = ents[i] || CH[L.tiles[i]] || (L.tiles[i] >= T.DECO_A ? ' ' : '?');
        if (c === ' ' && r.visited[i]) c = '.';
        line += c;
    }
    console.log(line);
}
