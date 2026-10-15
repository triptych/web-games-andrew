// Prints each quest map with cells reachable from the start (gate shut, traps armed) as '·'.
import { MAPS, QUEST_MAPS } from '../js/sim/data/maps.js';
for (const id of (process.argv[2] ? [process.argv[2]] : QUEST_MAPS)) {
  const g = MAPS[id].grid.map((r) => r.split(''));
  const solid = (ch) => '#~oTGtXck1234B'.includes(ch);
  const [sx, sy] = MAPS[id].start;
  const seen = new Set([sx + ',' + sy]); const q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; const k = nx+','+ny; if (seen.has(k) || !g[ny] || g[ny][nx] === undefined || solid(g[ny][nx])) continue; seen.add(k); q.push([nx, ny]); } }
  console.log('\n' + id);
  g.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r.map((ch, x) => seen.has(x+','+y) && (ch === '.' || ch === ',') ? '·' : ch).join('')));
  console.log('   ' + Array.from({length: g[0].length}, (_, i) => i % 10).join(''));
}
