/**
 * pipeline.mjs — run the Meshy jobs for VACANCY's models to the end: wait for each preview (geometry),
 * submit its refine (texture), wait, and download the GLB and its thumbnail. Submits any model without a preview
 * yet when the account's queue has room (the plan caps pending tasks; a refused submission costs nothing and is
 * retried later with a new local operation id).
 *
 *   node game-145/dev/meshy/pipeline.mjs WORKDIR        # WORKDIR holds models.json (from prompts.mjs) and the state
 *   VA_TAG=v2- node …pipeline.mjs WORKDIR2            # a redo in a fresh WORKDIR (new operation ids, so Meshy doesn't
 *                                                     # hand back the earlier tasks)
 *
 * State lives in WORKDIR/state.json, so the script can be stopped and started again without paying twice.
 * Needs a signed-in Meshy CLI 0.4.0 (see the meshy-3d-generation skill).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const W = path.resolve(process.argv[2]);
const MODELS = JSON.parse(fs.readFileSync(path.join(W, 'models.json'), 'utf8'));
const STATE = path.join(W, 'state.json');
const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
if (fs.existsSync(path.join(W, 'preview-ids.json'))) for (const [k, id] of Object.entries(JSON.parse(fs.readFileSync(path.join(W, 'preview-ids.json'), 'utf8')))) (st[k] ||= {}).preview ||= id;
const save = () => fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
fs.mkdirSync(path.join(W, 'raw'), { recursive: true });
fs.mkdirSync(path.join(W, 'thumb'), { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pause = (s) => execFileSync('sleep', [String(s)]);

function meshy(args) {
    let out;
    try { out = execFileSync('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args, '--output-schema', 'v1', '--format', 'json', '--no-update-check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }); }
    catch (e) { out = e.stdout || ''; }
    try { return JSON.parse(out); } catch { return { ok: false, error: { code: 'bad_json', message: out.slice(0, 200) } }; }
}

/** Submit; returns the task id, 'busy' (queue full: try later) or null (a real failure). */
function submit(kind, m, args) {
    const s = (st[m.name] ||= {});
    const n = (s[kind + 'Try'] || 0) + 1;
    const j = meshy([...args, '--async', '--operation-id', `va145-${process.env.VA_TAG || ''}${kind}-${m.name}-${n}`]);
    const id = j.result?.submission?.task_id;
    if (id) { s[kind] = id; save(); log('submitted', kind, m.name, id); return id; }
    if (j.error?.code === 'rate_limit') { s[kind + 'Try'] = n; save(); return 'busy'; }
    log('FAILED submit', kind, m.name, JSON.stringify(j.error).slice(0, 300));
    s[kind + 'Failed'] = j.error?.code || 'unknown'; save();
    return null;
}

function waitTask(kind, m) {
    const s = st[m.name];
    const id = s[kind];
    const file = path.join(W, `${kind}_${m.name}.json`);
    for (;;) {
        const j = meshy(['text-to-3d', 'wait', id, '--timeout', '900']);
        const status = j.result?.task?.status || j.result?.status;
        if (j.ok && status === 'SUCCEEDED') {
            if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(j, null, 1));
            s[kind + 'Done'] = true;
            s[kind + 'Credits'] = j.result?.task?.consumed_credits ?? null;
            save();
            log('done', kind, m.name);
            return true;
        }
        if (j.error?.code === 'timeout' || status === 'IN_PROGRESS' || status === 'PENDING') continue;
        log('FAILED', kind, m.name, status, JSON.stringify(j.error).slice(0, 300));
        s[kind + 'Failed'] = status || j.error?.code || 'unknown'; save();
        return false;
    }
}

function fetchModel(m) {
    const s = st[m.name];
    const dst = path.join(W, 'raw', `${m.name}.glb`);
    if (!fs.existsSync(dst)) {
        const j = meshy(['download', '--resource', 'text-to-3d', '--task-id', s.refine, '--model-format', 'glb', '--output', dst, '--workspace', W]);
        if (!j.ok) { log('FAILED download', m.name, JSON.stringify(j.error).slice(0, 300)); return; }
    }
    const th = path.join(W, 'thumb', `${m.name}.png`);
    if (!fs.existsSync(th)) meshy(['download', '--resource', 'text-to-3d', '--task-id', s.refine, '--asset', 'thumbnail.primary', '--output', th, '--workspace', W]);
    s.downloaded = true; save();
    log('downloaded', m.name, Math.round(fs.statSync(dst).size / 1024) + ' KB');
}

const refineArgs = (m) => ['text-to-3d', 'create', '--mode', 'refine', '--preview-task-id', st[m.name].preview, '--enable-pbr', 'true', '--texture-resolution', '2k', '--target-formats', 'glb'];
const previewArgs = (m) => ['text-to-3d', 'create', '--mode', 'preview', '--prompt', m.prompt.slice(0, 600), '--data', JSON.stringify({ target_polycount: m.polycount, should_remesh: true, topology: 'triangle', symmetry_mode: 'auto' }), '--target-formats', 'glb'];

// the loop: keep advancing every model a step; sleep only when nothing could move
for (;;) {
    let moved = false, left = 0;
    for (const m of MODELS) {
        const s = (st[m.name] ||= {});
        if (s.downloaded || s.previewFailed || s.refineFailed) continue;
        left++;
        if (!s.preview) { const r = submit('preview', m, previewArgs(m)); if (r && r !== 'busy') moved = true; continue; }
        if (!s.previewDone) { if (waitTask('preview', m)) moved = true; continue; }
        if (!s.refine) { const r = submit('refine', m, refineArgs(m)); if (r && r !== 'busy') moved = true; continue; }
        if (!s.refineDone) { if (waitTask('refine', m)) moved = true; continue; }
        fetchModel(m); moved = true;
    }
    if (!left) break;
    if (!moved) { log('queue full; waiting 30 s', left, 'left'); pause(30); }
}
const credits = Object.values(st).reduce((a, s) => a + (s.previewCredits || 0) + (s.refineCredits || 0), 0);
log('ALL DONE', Object.values(st).filter((s) => s.downloaded).length, 'models,', credits, 'credits reported');
