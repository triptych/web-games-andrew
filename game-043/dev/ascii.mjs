/**
 * ascii.mjs — print the overworld (or a dungeon floor) as text.
 *   node dev/ascii.mjs [seed] [step]              overworld, every `step` tiles (default 1)
 *   node dev/ascii.mjs [seed] floor <site> <n>    one dungeon/cave floor
 */
import { generateWorld } from '../js/gen/world.js';
import { G, O } from '../js/data/tiles.js';

const seed = Number(process.argv[2] ?? 12345);
const w = generateWorld(seed);

if (process.argv[3] === 'floor') {
    const { generateFloor } = await import('../js/gen/dungeon.js');
    const f = generateFloor(seed, w.siteById[process.argv[4] ?? 'd1'], Number(process.argv[5] ?? 1));
    printFloor(f);
    process.exit(0);
}

const step = Number(process.argv[3] ?? 1);
const gch = { [G.GRASS]: '.', [G.GRASS2]: ',', [G.PATH]: ':', [G.SAND]: '_', [G.WATER]: '~', [G.SHALLOW]: '-', [G.CLIFF]: '#', [G.ROCKY]: "'", [G.SNOW]: '"', [G.ICE]: '=', [G.LAVA]: '%', [G.MARSH]: ';', [G.PLAZA]: '+', [G.FARM]: 'f', [G.BRIDGE]: 'H', [G.ASH]: '`' };
const och = { [O.TREE]: 'T', [O.PINE]: 'A', [O.BUSH]: 'b', [O.ROCK]: 'o', [O.WEED]: 'w', [O.OLDTREE]: '&', [O.THORN]: 'X', [O.BOULDER]: 'O', [O.DARK]: '@', [O.GLIMMER]: '*', [O.FORAGE]: 'q', [O.DUNGEON]: 'D', [O.CAVE]: 'C', [O.FACADE]: 'n', [O.HEART]: 'H', [O.LOTSIGN]: 'L', [O.SIGN]: 'S', [O.BOARD]: 'J', [O.BIN]: 'B', [O.DEADTREE]: 't', [O.BIGROCK]: 'Q', [O.CRYSTAL]: 'c', [O.ORE]: 'r', [O.STUMP]: 'u' };
let out = '';
for (let y = 0; y < w.H; y += step) {
    for (let x = 0; x < w.W; x += step) {
        const i = y * w.W + x;
        out += och[w.obj[i]] ?? gch[w.ground[i]] ?? '?';
    }
    out += '\n';
}
console.log(out);
console.log('regions:', w.regions.map(r => `${r.idx}:${r.biome.id} "${r.name}" gate=${r.gate.kind}(${r.gate.tiles.length})`).join('\n  '));
console.log('sites:', w.sites.map(s => `${s.id} ${s.name} @${s.x},${s.y}`).join(', '));
console.log('lots:', w.lots.length, 'glimmers:', w.glimmers.length, 'forage:', w.forage.length, 'glen:', w.glen.name);

export function printFloor(f) {
    let s = '';
    for (let y = 0; y < f.H; y++) {
        for (let x = 0; x < f.W; x++) {
            const i = y * f.W + x;
            const m = f.monsters.find(m => m.x === x && m.y === y);
            s += m ? 'M' : ({ [O.DOWN]: '>', [O.UP]: '<', [O.CHEST]: '$', [O.LOCKED]: '+', [O.ORE]: 'r', [O.GEM]: 'g', [O.ROCK]: 'o', [O.TORCH]: 'i', [O.PEDESTAL]: 'P' }[f.obj[i]] ?? (f.ground[i] === G.WALL ? '#' : f.ground[i] === G.WATER ? '~' : '.'));
        }
        s += '\n';
    }
    console.log(s);
}
