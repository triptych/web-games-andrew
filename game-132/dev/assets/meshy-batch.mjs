// meshy-batch.mjs WORKDIR [names...] — make every 3D model for TITAN'S VAULT with the Meshy CLI (0.4.0).
//
// For each reference in dev/art/prompts.mjs (group `refs`):
//   1. the reference image: a fal render if WORKDIR/../raw/<ref>.png exists, else Meshy text-to-image
//      (nano-banana-pro, the same style prompt), 9 credits;
//   2. image-to-3d, smart topology at the polycount below, textured (2k, no PBR), A-pose for people, 15 credits;
//   3. the GLB and its thumbnail downloaded into WORKDIR as raw-<name>.glb and th-<name>.png.
// Progress is journalled in WORKDIR/state.json, so running it again resumes instead of paying twice.
// Needs the Meshy CLI signed in (`meshy auth status`). Then shrink with opt.mjs (see README.md).

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import fs from 'node:fs';
import path from 'node:path';
import { GROUPS, SYS } from '../art/prompts.mjs';

const WORK = path.resolve(process.argv[2] || '.');
const ONLY = process.argv.slice(3);
const RAW = path.join(WORK, '..', 'raw');
const STATE = path.join(WORK, 'state.json');
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));

/** Triangle budgets: people and bosses get more, props less. */
const POLY = (n) => (n.startsWith('boss-') ? 12000 : n.startsWith('hero-') ? 12000 : n.startsWith('npc-') ? 8000
    : n === 'pet' ? 8000 : n.startsWith('mon-') ? 7000 : n === 'prop-tree' ? 4000 : 3000);
const PEOPLE = new Set(['hero-ironsworn', 'hero-stormcaller', 'hero-shadebinder', 'npc-ysolde', 'npc-heron', 'mon-thrall', 'mon-archer', 'mon-hag', 'mon-wretch', 'mon-sentinel']);

async function meshy(args, timeout = 960000) {
    const { stdout } = await run('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args,
        '--output-schema', 'v1', '--format', 'json', '--no-update-check'], { cwd: WORK, timeout, maxBuffer: 1 << 24 });
    const d = JSON.parse(stdout);
    if (!d.ok) throw new Error(JSON.stringify(d.error));
    return d.result;
}

async function one(job) {
    const name = job.name.replace(/^ref-/, '');
    const s = (state[name] ||= {});
    try {
        if (!s.image && !s.t2i) {
            const local = path.join(RAW, job.name + '.png');
            if (fs.existsSync(local)) s.image = local;
            else {
                const ar = job.aspect_ratio === '2:3' ? '3:4' : job.aspect_ratio;
                s.t2i = (await meshy(['text-to-image', 'create', '--ai-model', 'nano-banana-pro', '--prompt', `${SYS.ref} ${job.prompt}`,
                    '--aspect-ratio', ar, '--operation-id', `tv132-t2i-${name}`, '--async'])).task_id;
            }
            save();
        }
        if (s.t2i && !s.t2iDone) {
            const r = await meshy(['text-to-image', 'wait', s.t2i, '--timeout', '600']);
            if (r.task?.status !== 'SUCCEEDED') throw new Error('reference ' + r.task?.status);
            s.t2iDone = true; s.credits = (s.credits || 0) + (r.task.consumed_credits || 0); save();
            try { execFileSync('curl', ['-sS', '-o', path.join(WORK, `ref-${name}.png`), r.task.image_urls[0]]); } catch { /* the preview is optional */ }
        }
        if (!s.i3d) {
            const src = s.image ? ['--image-url', s.image] : ['--input-task-id', s.t2i];
            s.i3d = (await meshy(['image-to-3d', 'create', ...src, '--model-type', 'smart-topology', '--target-polycount', String(POLY(name)),
                '--should-texture', 'true', '--enable-pbr', 'false', '--texture-resolution', '2k',
                ...(PEOPLE.has(name) ? ['--pose-mode', 'a-pose'] : []), '--target-formats', 'glb',
                '--operation-id', `tv132-i3d-${name}`, '--async'])).task_id;
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

const jobs = GROUPS.refs.filter((j) => !ONLY.length || ONLY.includes(j.name.replace(/^ref-/, '')));
const POOL = 6;
let next = 0;
await Promise.all([...Array(POOL)].map(async () => { while (next < jobs.length) await one(jobs[next++]); }));
console.log('credits so far', Object.values(state).reduce((a, s) => a + (s.credits || 0), 0));
