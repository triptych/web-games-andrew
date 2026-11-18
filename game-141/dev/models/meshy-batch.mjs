// meshy-batch.mjs RAW WORK [ids...] — make the 3D artifact models for SANDSUNK with the Meshy CLI (0.4.0).
// Adapted from game-138/dev/assets/meshy-batch.mjs. For each artifact in js/sim/data/artifacts.js:
//   image-to-3d from the fal reference picture RAW/art-<id>.png (the same picture the game's icon is cut from),
//   smart topology at POLY triangles, textured (2k, no PBR); the GLB and its thumbnail land in WORK.
// Progress is journalled in WORK/state.json, so running it again resumes instead of paying twice.
// Needs the Meshy CLI signed in (`meshy auth status`). Then shrink each with opt.mjs (README.md).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { ARTIFACTS } from '../../js/sim/data/artifacts.js';
const run = promisify(execFile);

const RAW = path.resolve(process.argv[2]);
const WORK = path.resolve(process.argv[3] || '.');
const ONLY = process.argv.slice(4);
const POLY = { heart: 6000 };
fs.mkdirSync(WORK, { recursive: true });
const STATE = path.join(WORK, 'state.json');
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));

async function meshy(args, timeout = 960000) {
    const { stdout } = await run('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args,
        '--output-schema', 'v1', '--format', 'json', '--no-update-check'], { cwd: WORK, timeout, maxBuffer: 1 << 24 });
    const d = JSON.parse(stdout);
    if (!d.ok) throw new Error(JSON.stringify(d.error));
    return d.result;
}

async function one(a) {
    const s = (state[a.id] ||= {});
    try {
        if (!s.i3d) {
            s.i3d = (await meshy(['image-to-3d', 'create', '--image-url', path.join(RAW, `art-${a.id}.png`), '--model-type', 'smart-topology',
                '--target-polycount', String(POLY[a.id] || 4000), '--should-texture', 'true', '--enable-pbr', 'false', '--texture-resolution', '2k',
                '--target-formats', 'glb', '--operation-id', `ss141-i3d-${a.id}`, '--async'])).task_id;
            save();
        }
        if (!s.glb) {
            const r = await meshy(['image-to-3d', 'wait', s.i3d, '--timeout', '900', '--save-json', `i3d-${a.id}.json`]);
            if (r.task?.status !== 'SUCCEEDED') throw new Error('mesh ' + r.task?.status);
            s.credits = r.task.consumed_credits ?? null;
            await meshy(['download', '--task-json', `i3d-${a.id}.json`, '--model-format', 'glb', '--output', `raw-${a.id}.glb`, '--workspace', '.', '--overwrite']);
            try { await meshy(['download', '--task-json', `i3d-${a.id}.json`, '--asset', 'thumbnail.primary', '--output', `th-${a.id}.png`, '--workspace', '.', '--overwrite']); } catch { /* optional */ }
            s.glb = `raw-${a.id}.glb`; save();
        }
        console.log('done', a.id, s.credits ?? '?', 'credits');
    } catch (err) {
        s.error = String(err.message || err).slice(0, 300); save();
        console.log('FAIL', a.id, s.error);
    }
}

const jobs = ARTIFACTS.filter((a) => !ONLY.length || ONLY.includes(a.id));
const POOL = 6;
let next = 0;
await Promise.all([...Array(POOL)].map(async () => { while (next < jobs.length) await one(jobs[next++]); }));
console.log('credits', Object.values(state).reduce((a, s) => a + (s.credits || 0), 0));
