// Print a realm's tile map as text: node game-075/dev/mapdump.mjs [realm 1-6] [remix seed]
import { buildRealm } from '../js/sim/build.js';
import { T } from '../js/config.js';

const ri = Math.max(1, +(process.argv[2] || 1)) - 1;
const M = buildRealm(ri, { remix: +(process.argv[3] || 0) });
const CH = ['.', '#', '=', '~', '%', '!', 'o', 'C', 'B', ' '];
const grid = [];
for (let y = 0; y < M.gh; y++) {
    let line = '';
    for (let x = 0; x < M.gw; x++) line += CH[M.at(x, y)];
    grid.push(line.split(''));
}
const mark = (px, py, ch) => { const x = Math.floor(px / T), y = Math.floor(py / T); if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ch; };
for (const it of M.items) mark(it.x + it.w / 2, it.y + it.h / 2, { sword: 'S', key: 'K', chalice: 'Y', magnet: 'U', bridge: 'H', lamp: 'L', shield: 'D', charge: '*', pixel: 'p' }[it.kind]);
for (const d of M.dragons) mark(d.x + 8, d.y + 8, 'Δ');
for (const p of M.pickups) mark(p.x + p.w / 2, p.y + p.h / 2, { gem: '+', biggem: '◆', battery: 'b', oneup: '1', cassette: 'c', shard: 's' }[p.kind]);
mark(M.start.x + 4, M.start.y + 4, '@');
console.log(`${M.realm.name}  (${M.cols}×${M.rows} rooms, ${M.gw}×${M.gh} tiles)`);
console.log(grid.map((l) => l.join('')).join('\n'));
