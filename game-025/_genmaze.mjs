// Deterministic maze generation: recursive backtracker (seeded RNG), light
// braiding (remove some dead-ends -> loops for dodging), a door-gated exit
// chamber, then feature stamping. Verified with flood-fill before emit.
// Run once to regenerate LEVELS; not shipped with the game.
import { writeFileSync } from 'node:fs';

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

function genMaze(cw, ch, rand) {
  const W = 2 * cw + 1, H = 2 * ch + 1;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const visited = Array.from({ length: ch }, () => Array(cw).fill(false));
  const cellRC = (cx, cy) => [2 * cy + 1, 2 * cx + 1];
  const stack = [[0, 0]];
  visited[0][0] = true;
  { const [r, c] = cellRC(0, 0); g[r][c] = '.'; }
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const dirs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], rand);
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= cw || ny < 0 || ny >= ch || visited[ny][nx]) continue;
      const [r, c] = cellRC(cx, cy);
      g[r + dy][c + dx] = '.';
      const [nr, nc] = cellRC(nx, ny);
      g[nr][nc] = '.';
      visited[ny][nx] = true;
      stack.push([nx, ny]);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  return g;
}

function braid(g, rand, frac) {
  const H = g.length, W = g[0].length;
  const passCount = (r, c) => {
    let n = 0;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (g[r + dr][c + dc] === '.') n++;
    return n;
  };
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (g[r][c] !== '.') continue;
      if (passCount(r, c) === 1 && rand() < frac) {
        const opts = [];
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const wr = r + dr, wc = c + dc, pr = r + 2 * dr, pc = c + 2 * dc;
          if (pr > 0 && pr < H - 1 && pc > 0 && pc < W - 1 && g[wr][wc] === '#' && g[pr][pc] === '.')
            opts.push([wr, wc]);
        }
        if (opts.length) {
          const [wr, wc] = opts[Math.floor(rand() * opts.length)];
          g[wr][wc] = '.';
        }
      }
    }
  }
  return g;
}

const set = (g, r, c, ch) => { g[r][c] = ch; };
const rows = (g) => g.map((r) => r.join(''));

function exitChamber(g, doorCount) {
  const H = g.length, W = g[0].length;
  const r0 = H - 4, r1 = H - 2, c0 = W - 4, c1 = W - 2;
  for (let r = r0 - 1; r <= r1 + 1; r++)
    for (let c = c0 - 1; c <= c1 + 1; c++)
      if (r > 0 && r < H - 1 && c > 0 && c < W - 1) g[r][c] = '#';
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) g[r][c] = '.';
  set(g, r1, c1, 'X');
  const doorCol = c0 - 1;
  for (let i = 0; i < doorCount; i++) {
    const dr = r0 + i;
    set(g, dr, doorCol, 'D');
    if (doorCol - 1 > 0) set(g, dr, doorCol - 1, '.');
  }
}

function flood(g, doorWall) {
  const H = g.length, W = g[0].length;
  let sr, sc;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] === 'S') { sr = r; sc = c; }
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  const blk = (ch) => ch === '#' || (doorWall && ch === 'D');
  const q = [[sr, sc]];
  seen[sr][sc] = true;
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W || seen[nr][nc] || blk(g[nr][nc])) continue;
      seen[nr][nc] = true;
      q.push([nr, nc]);
    }
  }
  return seen;
}

function stampFeatures(g, rand, plan) {
  const H = g.length, W = g[0].length;
  set(g, 1, 1, 'S');
  const reach = flood(g, false);
  const floors = [];
  for (let r = 1; r < H - 1; r++)
    for (let c = 1; c < W - 1; c++)
      if (g[r][c] === '.' && reach[r][c]) floors.push([r, c]);
  shuffle(floors, rand);
  let idx = 0;
  const place = (ch) => {
    while (idx < floors.length) {
      const [r, c] = floors[idx++];
      if (r >= H - 5 && c >= W - 5) continue; // keep clear of exit chamber zone
      g[r][c] = ch;
      return true;
    }
    return false;
  };
  for (const [ch, n] of plan) for (let i = 0; i < n; i++) if (!place(ch)) return false;
  return true;
}

function buildLevel(cw, ch, seed, doorCount, plan, braidFrac) {
  const rand = rng(seed);
  const g = genMaze(cw, ch, rand);
  braid(g, rand, braidFrac);
  exitChamber(g, doorCount);
  if (!stampFeatures(g, rand, plan)) throw new Error('stamp failed seed ' + seed);
  return g;
}

function analyze(name, g) {
  const H = g.length, W = g[0].length;
  const ragged = g.some((r) => r.length !== W);
  const wd = flood(g, true), nd = flood(g, false);
  let X, issues = [];
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const ch = g[r][c];
      if (ch === 'X') X = { r, c };
      if ('KFTN'.includes(ch) && !nd[r][c]) issues.push(ch + ' unreachable @' + r + ',' + c);
      if (ch === 'K' && !wd[r][c]) issues.push('key-behind-door @' + r + ',' + c);
    }
  const gated = X && !wd[X.r][X.c] && nd[X.r][X.c];
  let deadends = 0;
  const open = '.SNKFT';
  for (let r = 1; r < H - 1; r++)
    for (let c = 1; c < W - 1; c++) {
      if (!open.includes(g[r][c])) continue;
      let n = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[r + dr][c + dc] !== '#') n++;
      if (n === 1) deadends++;
    }
  console.log(name, ragged ? 'RAGGED!' : W + 'x' + H, gated ? 'GATED' : 'NOT-GATED',
    'deadends=' + deadends, issues.length ? 'ISSUES: ' + issues.join('; ') : 'clean');
  return !ragged && gated && issues.length === 0;
}

const L1 = buildLevel(9, 9, 1337, 1, [['N', 2], ['K', 1], ['F', 2], ['T', 2]], 0.30);
const L2 = buildLevel(10, 9, 2024, 2, [['N', 3], ['K', 2], ['F', 2], ['T', 3]], 0.25);
const L3 = buildLevel(11, 10, 99, 3, [['N', 4], ['K', 3], ['F', 2], ['T', 3]], 0.20);

const ok = [analyze('L1', L1), analyze('L2', L2), analyze('L3', L3)].every(Boolean);
if (!ok) { console.log('VALIDATION FAILED'); process.exit(1); }

function emit(g, cm) {
  return '    // ' + cm + '\n    [\n' + rows(g).map((r) => "        '" + r + "',").join('\n') + '\n    ],';
}
const out = 'export const LEVELS = [\n' +
  emit(L1, 'Level 1 - recursive-backtracker maze, lightly braided; 1 door') + '\n' +
  emit(L2, 'Level 2 - bigger maze, 2 doors') + '\n' +
  emit(L3, 'Level 3 - final maze, 3 doors') + '\n];';
writeFileSync(new URL('./_levels.txt', import.meta.url), out);
console.log('\n' + out);
