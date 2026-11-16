// meshy-batch.mjs WORKDIR [ids...] — make every 3D model for LANTERNHOLLOW with the Meshy CLI (0.4.0).
// Adapted from game-135/dev/assets/meshy-batch.mjs. For each element in prompts.mjs:
//   1. a reference render (Meshy text-to-image, nano-banana-pro), 9 credits;
//   2. image-to-3d, smart topology at the polycount in prompts.mjs, textured (2k, no PBR), 15 credits;
//   3. the GLB and its thumbnail downloaded into WORKDIR as raw-<model>.glb and th-<model>.png.
// Progress is journalled in WORKDIR/state.json, so running it again resumes instead of paying twice.
// Needs the Meshy CLI signed in (`meshy auth status`). Then shrink each with opt.mjs (README.md).
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { REFS } from './prompts.mjs';
const run = promisify(execFile);

const WORK = path.resolve(process.argv[2] || '.');
const ONLY = process.argv.slice(3);
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

async function one(job) {
    const name = job.name;
    const s = (state[name] ||= {});
    try {
        if (!s.t2i) {
            s.t2i = (await meshy(['text-to-image', 'create', '--ai-model', 'nano-banana-pro', '--prompt', job.prompt,
                '--aspect-ratio', '1:1', '--operation-id', `lh138-t2i-${name}`, '--async'])).task_id;
            save();
        }
        if (!s.t2iDone) {
            const r = await meshy(['text-to-image', 'wait', s.t2i, '--timeout', '600']);
            if (r.task?.status !== 'SUCCEEDED') throw new Error('reference ' + r.task?.status);
            s.t2iDone = true; s.credits = (s.credits || 0) + (r.task.consumed_credits || 0); save();
            try { execFileSync('curl', ['-sS', '-o', path.join(WORK, `ref-${name}.png`), r.task.image_urls[0]]); } catch { /* the preview is optional */ }
        }
        if (!s.i3d) {
            s.i3d = (await meshy(['image-to-3d', 'create', '--input-task-id', s.t2i, '--model-type', 'smart-topology',
                '--target-polycount', String(job.poly), '--should-texture', 'true', '--enable-pbr', 'false', '--texture-resolution', '2k',
                '--target-formats', 'glb', '--operation-id', `lh138-i3d-${name}`, '--async'])).task_id;
            save();
        }
        if (!s.glb) {
            const r = await meshy(['image-to-3d', 'wait', s.i3d, '--timeout', '900', '--save-json', `i3d-${name}.json`]);
            if (r.task?.status !== 'SUCCEEDED') throw new Error('mesh ' + r.task?.status);
            s.credits = (s.credits || 0) + (r.task.consumed_credits || 0);
            await meshy(['download', '--task-json', `i3d-${name}.json`, '--model-format', 'glb', '--output', `raw-${name}.glb`, '--workspace', '.', '--overwrite']);
            await meshy(['download', '--task-json', `i3d-${name}.json`, '--asset', 'thumbnail.primary', '--output', `th-${name}.png`, '--workspace', '.', '--overwrite']);
            s.glb = `raw-${name}.glb`; save();
        }
        console.log('done', name, s.credits ?? '?', 'credits');
    } catch (err) {
        s.error = String(err.message || err).slice(0, 300); save();
        console.log('FAIL', name, s.error);
    }
}

const jobs = REFS.filter((j) => !ONLY.length || ONLY.includes(j.id) || ONLY.includes(j.name));
const POOL = 6;
let next = 0;
await Promise.all([...Array(POOL)].map(async () => { while (next < jobs.length) await one(jobs[next++]); }));
console.log('credits so far', Object.values(state).reduce((a, s) => a + (s.credits || 0), 0));
