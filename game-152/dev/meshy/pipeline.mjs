/**
 * pipeline.mjs — turn ElevenLabs reference pictures into Meshy models: image-to-3D (smart topology, textured), wait,
 * download the GLB and its thumbnail. Resumable: state lives in WORKDIR/state.json, so a stopped run never pays twice.
 * A submission the account's queue refuses (rate_limit) costs nothing and is retried a little later.
 *
 *   node game-152/dev/meshy/pipeline.mjs WORKDIR JOBS.json
 *
 * JOBS.json: [{ "name": "solitaire", "image": "/abs/ref-solitaire.png", "polycount": 8000 }, ...]
 * Output: WORKDIR/glb/<name>.glb, WORKDIR/thumb/<name>.png. Needs a signed-in Meshy CLI 0.4.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const W = path.resolve(process.argv[2]);
const JOBS = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const STATE = path.join(W, 'state.json');
const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
for (const d of ['glb', 'thumb']) fs.mkdirSync(path.join(W, d), { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pause = (s) => execFileSync('sleep', [String(s)]);

function meshy(args) {
    let out;
    try {
        out = execFileSync('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args, '--output-schema', 'v1', '--format', 'json', '--no-update-check'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, cwd: W });
    } catch (e) { out = e.stdout || ''; }
    try { return JSON.parse(out); } catch { return { ok: false, error: { code: 'bad_json', message: out.slice(0, 200) } }; }
}

function submit(j) {
    const s = (st[j.name] ||= {});
    const n = (s.tries || 0) + 1;
    const r = meshy(['image-to-3d', 'create', '--image-url', j.image, '--model-type', 'smart-topology', '--target-polycount', String(j.polycount || 6000),
        '--should-texture', 'true', '--enable-pbr', 'false', '--texture-resolution', '2k', '--target-formats', 'glb',
        ...(j.pose ? ['--pose-mode', j.pose] : []),
        '--async', '--operation-id', `hrs152-${process.env.TAG || ''}${j.name}-${n}`]);
    const id = r.result?.submission?.task_id;
    if (id) { s.task = id; save(); log('submitted', j.name, id); return true; }
    s.tries = n; save();
    if (r.error?.code === 'rate_limit' || r.error?.code === 'too_many_pending') return false;
    log('submit failed', j.name, JSON.stringify(r.error).slice(0, 240));
    if (n > 3) { s.failed = r.error?.code || 'unknown'; save(); }
    return false;
}

function poll(j) {
    const s = st[j.name];
    const r = meshy(['image-to-3d', 'get', s.task]);
    const t = r.result?.task;
    if (!t) return false;
    if (t.status === 'SUCCEEDED') { s.done = true; s.credits = t.consumed_credits ?? null; save(); log('done', j.name, s.credits, 'credits'); return true; }
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') { s.failed = t.status; save(); log('FAILED', j.name, JSON.stringify(t.task_error || '').slice(0, 200)); return true; }
    return false;
}

function fetch(j) {
    const s = st[j.name];
    const glb = path.join(W, 'glb', `${j.name}.glb`), th = path.join(W, 'thumb', `${j.name}.png`);
    if (!fs.existsSync(glb)) meshy(['download', '--resource', 'image-to-3d', '--task-id', s.task, '--model-format', 'glb', '--output', glb, '--workspace', W]);
    if (!fs.existsSync(th)) meshy(['download', '--resource', 'image-to-3d', '--task-id', s.task, '--asset', 'thumbnail.primary', '--output', th, '--workspace', W]);
    if (fs.existsSync(glb)) { s.downloaded = true; save(); log('downloaded', j.name, Math.round(fs.statSync(glb).size / 1024) + ' KB'); }
}

for (;;) {
    let left = 0, moved = false;
    for (const j of JOBS) {
        const s = (st[j.name] ||= {});
        if (s.downloaded || s.failed) continue;
        left++;
        if (!s.task) { if (submit(j)) moved = true; continue; }
        if (!s.done) { if (poll(j)) moved = true; continue; }
        fetch(j); moved = true;
    }
    if (!left) break;
    if (!moved) pause(20);
}
const credits = Object.values(st).reduce((a, s) => a + (s.credits || 0), 0);
log('ALL DONE', Object.values(st).filter((s) => s.downloaded).length, 'models,', Object.values(st).filter((s) => s.failed).length, 'failed,', credits, 'credits');
