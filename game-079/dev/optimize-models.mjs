// Shrinks the raw Meshy GLBs (about 1.3M triangles and 20-70 MB each) into game-sized files:
// weld -> simplify to a triangle budget -> resize textures -> WebP -> prune.
// Plain Node, shells out to @gltf-transform/cli (fetched by npx the first time, nothing installed).
//
//   node game-079/dev/optimize-models.mjs <raw-dir> [name ...]
//
// <raw-dir> holds <name>.glb straight from Meshy. Output goes to game-079/assets/models/<name>.glb.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models');
// [triangle budget, texture size, lock borders] per model; crowds of chompers need to stay cheap.
// Locking borders keeps the UV seams intact; the tank's tracks and turret turn to noise without it,
// and below about 26k triangles even with it. There are only ever a few tanks, so it gets the budget.
const BUDGET = {
    chomper: [5000, 1024], trooper: [10000, 1024], drone: [8000, 1024], brute: [12000, 1024], psy: [8000, 1024], tank: [26000, 1024, true],
    chompra: [16000, 2048], vrask: [16000, 2048], rourke: [18000, 2048],
};

const [rawDir, ...only] = process.argv.slice(2);
if (!rawDir) { console.error('usage: node optimize-models.mjs <raw-dir> [name ...]'); process.exit(1); }

function gt(...args) {
    const r = spawnSync('npm', ['exec', '--yes', '--package=@gltf-transform/cli', '--', 'gltf-transform', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status || 1); }
    return r.stdout.replace(/\x1b\[[0-9;]*m/g, '');
}
function triangles(file) {
    const m = gt('inspect', file).match(/TRIANGLES\s*│\s*[\d,]+\s*│\s*([\d,]+)/);
    return m ? +m[1].replace(/,/g, '') : 0;
}

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'vo-glb-'));
for (const name of only.length ? only : Object.keys(BUDGET)) {
    const [budget, tex, lock] = BUDGET[name];
    const src = join(rawDir, name + '.glb');
    const a = join(work, name + '.a.glb'), b = join(work, name + '.b.glb'), c = join(work, name + '.c.glb'), d = join(work, name + '.d.glb');
    const before = triangles(src);
    gt('weld', src, a);
    gt('simplify', a, b, '--ratio', String(Math.min(1, budget / before)), '--error', '0.02', ...(lock ? ['--lock-border', 'true'] : []));
    gt('resize', b, c, '--width', String(tex), '--height', String(tex));
    gt('webp', c, d, '--quality', '85');
    gt('prune', d, join(OUT, name + '.glb'));
    const out = join(OUT, name + '.glb');
    console.log(`${name}: ${before.toLocaleString()} -> ${triangles(out).toLocaleString()} triangles, ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
rmSync(work, { recursive: true, force: true });
