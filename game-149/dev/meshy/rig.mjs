/**
 * rig.mjs — rig Meshy characters and give them clips from Meshy's animation library. Resumable (WORKDIR/rig-state.json).
 *
 *   node game-149/dev/meshy/rig.mjs WORKDIR RIGS.json OUTDIR
 *   TAG=v2 node …rig.mjs …              # a redo: new local operation ids
 *
 * RIGS.json: [{ "name": "maple", "task": "<image-to-3d task id>", "height": 1.1, "clips": { "attack": 219, ... } }]
 * For each: a rigging task (5 credits; it comes with walking and running clips), then one animate task per clip
 * (3 credits each). Writes OUTDIR/<name>.glb (the rigged character, full texture: shrink it afterwards),
 * OUTDIR/<name>-walk.glb and -run.glb (Meshy's armature-only clips), and OUTDIR/<name>-<clip>.glb stripped to the
 * animation by clip.py. Needs a signed-in Meshy CLI 0.4.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const W = path.resolve(process.argv[2]);
const JOBS = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OUT = path.resolve(process.argv[4]);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE = path.join(W, 'rig-state.json');
const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
fs.mkdirSync(path.join(W, 'rigraw'), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function meshy(args) {
    let out;
    try { out = execFileSync('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args, '--output-schema', 'v1', '--format', 'json', '--no-update-check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, cwd: W }); }
    catch (e) { out = e.stdout || ''; }
    try { return JSON.parse(out); } catch { return { ok: false, error: { code: 'bad_json', message: out.slice(0, 200) } }; }
}
const pause = (s) => execFileSync('sleep', [String(s)]);

function run(kind, key, createArgs, opId) {
    // submit (once), then wait until terminal; returns the saved task JSON path or null
    const s = st[key] ||= {};
    if (s.failed) return null;
    const file = path.join(W, 'rigraw', `${key}.json`);
    if (s.done && fs.existsSync(file)) return file;
    while (!s.task) {
        const r = meshy([kind, 'create', ...createArgs, '--async', '--operation-id', `${opId}${process.env.TAG ? '-' + process.env.TAG : ''}-${(s.tries || 0) + 1}`]);
        const id = r.result?.submission?.task_id;
        if (id) { s.task = id; save(); log('submitted', key, id); break; }
        s.tries = (s.tries || 0) + 1; save();
        if (r.error?.code !== 'rate_limit' || s.tries > 30) { log('submit failed', key, JSON.stringify(r.error).slice(0, 200)); s.failed = r.error?.code || 'submit'; save(); return null; }
        pause(20);
    }
    for (;;) {
        const r = meshy([kind, 'wait', s.task, '--timeout', '900', '--save-json', file]);
        const t = r.result?.task;
        if (t?.status === 'SUCCEEDED') { s.done = true; s.credits = t.consumed_credits; save(); log('done', key, t.consumed_credits, 'credits'); return file; }
        if (t && ['FAILED', 'CANCELED', 'EXPIRED'].includes(t.status)) { s.failed = t.status; save(); log('FAILED', key, JSON.stringify(t.task_error || '').slice(0, 300)); return null; }
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
}

function dl(taskJson, asset, dest) {
    if (fs.existsSync(dest)) return true;
    const r = meshy(['download', '--task-json', taskJson, '--asset', asset, '--output', dest, '--workspace', path.dirname(dest)]);
    if (!r.ok) log('download failed', dest, JSON.stringify(r.error).slice(0, 200));
    return r.ok;
}

for (const j of JOBS) {
    const rigFile = run('rigging', `rig-${j.name}`, ['--input-task-id', j.task, '--height-meters', String(j.height || 1.1)], `eha149-rig-${j.name}`);
    if (!rigFile) continue;
    const rigId = st[`rig-${j.name}`].task;
    const raw = path.join(W, 'rigraw');
    dl(rigFile, 'result.rigged_character_glb_url', path.join(raw, `${j.name}.glb`)) && fs.copyFileSync(path.join(raw, `${j.name}.glb`), path.join(OUT, `${j.name}.glb`));
    dl(rigFile, 'result.basic_animations.walking_armature_glb_url', path.join(raw, `${j.name}-walk.glb`)) && fs.copyFileSync(path.join(raw, `${j.name}-walk.glb`), path.join(OUT, `${j.name}-walk.glb`));
    dl(rigFile, 'result.basic_animations.running_armature_glb_url', path.join(raw, `${j.name}-run.glb`)) && fs.copyFileSync(path.join(raw, `${j.name}-run.glb`), path.join(OUT, `${j.name}-run.glb`));
    for (const [clip, action] of Object.entries(j.clips || {})) {
        const dest = path.join(OUT, `${j.name}-${clip}.glb`);
        if (fs.existsSync(dest)) continue;
        const f = run('animate', `anim-${j.name}-${clip}`, ['--rig-task-id', rigId, '--action-id', String(action)], `eha149-anim-${j.name}-${clip}`);
        if (!f) continue;
        const full = path.join(raw, `${j.name}-${clip}-full.glb`);
        if (dl(f, 'result.animation_glb_url', full)) execFileSync('python3', ['-I', path.join(HERE, 'clip.py'), full, dest], { stdio: 'ignore' });
    }
    log('finished', j.name);
}
const credits = Object.values(st).reduce((a, s) => a + (s.credits || 0), 0);
log('ALL DONE', credits, 'credits;', Object.entries(st).filter(([, s]) => s.failed).map(([k, s]) => `${k}:${s.failed}`).join(' ') || 'no failures');
