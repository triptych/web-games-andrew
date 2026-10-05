/**
 * bake.js — renders every frame of a character into one palette-index atlas.
 *
 * Output per character:
 *   data      RGBA bytes, R = palette index, A = 255 where opaque. The GPU looks
 *             the index up in a palette texture, so a palette swap (grunt
 *             variants, a boss's rage colours, Juno's Overdrive glow) costs one
 *             uniform instead of another atlas.
 *   palette   32 RGBA entries per row; alpha 255 marks an emissive colour that
 *             ignores the stage's ambient tint (neon, visors, cores).
 *   anims     name -> { start, count, fps, loop, phases }
 *   frames    per-frame metadata: front-hand position/angle (weapons attach
 *             there) in pixels from the anchor.
 *
 * Pure JS (no DOM), so dev/spritesheet.mjs can run it in Node.
 */

import { IndexBuffer, closeOutline } from './raster.js';
import { buildOps, rasterOps } from './rig.js';
import { ANIMS, STANCE, flattenAnim } from './poses.js';
import { CHARS, ramp, hexToRgb } from './chars.js';

export const PAL_W = 32;
/** Global art scale: rig units -> sprite pixels (and world units). */
export const ART_SCALE = 1.25;
const cache = new Map();

export function paletteRow(ch, overrides = {}) {
    const row = new Uint8Array(PAL_W * 4);
    const o = hexToRgb(overrides.outline || ch.outline);
    row.set([o[0], o[1], o[2], 128], 4);
    ch.matNames.forEach((name, m) => {
        const tones = ramp(overrides[name] || ch.mats[name]);
        const em = ch.emissive.includes(name) ? 255 : 128;
        for (let t = 0; t < 3; t++) {
            const i = (2 + m * 3 + t) * 4;
            row.set([tones[t][0], tones[t][1], tones[t][2], em], i);
        }
    });
    return row;
}

function animDef(ch, name) {
    return ch.animOverrides[name] || ANIMS[name];
}

function idleHip(ch) {
    if (ch._idleHip !== undefined) return ch._idleHip;
    const base = ch.animOverrides.idle ? ch.animOverrides.idle.frames[0] : STANCE;
    ch._idleHip = buildOps(ch, base, 0).hipY;
    return ch._idleHip;
}

export function bakeChar(key) {
    if (cache.has(key)) return cache.get(key);
    const ch = CHARS[key];
    if (!ch) throw new Error(`unknown character ${key}`);
    const sc = (ch.scale || 1) * ART_SCALE;
    const cw = Math.ceil(ch.cell[0] * sc), chh = Math.ceil(ch.cell[1] * sc);
    const ax = Math.floor(cw / 2), ay = chh - 3;
    const hip = idleHip(ch);

    const poses = [], anims = {};
    for (const name of ch.anims) {
        const def = animDef(ch, name);
        if (!def) continue;
        const f = flattenAnim(def);
        anims[name] = { start: poses.length, count: f.frames.length, fps: f.fps || 8, loop: !!f.loop, phases: f.phases || null };
        poses.push(...f.frames);
    }

    const n = poses.length;
    const cols = Math.max(1, Math.min(n, Math.floor(2048 / cw)));
    const rows = Math.ceil(n / cols);
    const W = cols * cw, H = rows * chh;
    const data = new Uint8Array(W * H * 4);
    const buf = new IndexBuffer(cw, chh);
    const frames = [];

    poses.forEach((pose, fi) => {
        buf.clear();
        const res = buildOps(ch, pose, hip);
        rasterOps(buf, res.ops, sc, ax, ay);
        closeOutline(buf);
        const ox = (fi % cols) * cw, oy = Math.floor(fi / cols) * chh;
        for (let y = 0; y < chh; y++) {
            for (let x = 0; x < cw; x++) {
                const v = buf.idx[y * cw + x];
                if (!v) continue;
                const o = ((oy + y) * W + ox + x) * 4;
                data[o] = v; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
            }
        }
        frames.push({ hand: { x: res.hand.x * sc, y: res.hand.y * sc, ang: res.hand.ang }, head: { x: res.head.x * sc, y: res.head.y * sc } });
    });

    const rowNames = ['base', ...Object.keys(ch.variants)];
    const palette = new Uint8Array(PAL_W * 4 * rowNames.length);
    rowNames.forEach((r, i) => palette.set(paletteRow(ch, r === 'base' ? {} : ch.variants[r]), i * PAL_W * 4));
    const paletteRows = {};
    rowNames.forEach((r, i) => { paletteRows[r] = i; });

    const out = { key, sc, cw, ch: chh, ax, ay, cols, rows, W, H, data, anims, frames, palette, paletteRows, nRows: rowNames.length };
    cache.set(key, out);
    return out;
}

/** Look up a frame index for an animation at time t (or phase progress). */
export function frameFor(baked, anim, t, phase, phaseT) {
    let a = baked.anims[anim];
    if (!a) a = baked.anims[FALLBACK[anim]] || baked.anims[FALLBACK[FALLBACK[anim]]] || baked.anims.idle || baked.anims.hover || Object.values(baked.anims)[0];
    if (a.phases && phase) {
        const [s, c] = a.phases[phase] || a.phases.ac;
        if (!c) return a.start + a.phases.ac[0];
        return a.start + s + Math.min(c - 1, Math.floor((phaseT || 0) * c));
    }
    if (a.phases) return a.start + a.phases.ac[0];
    const k = Math.floor(t * a.fps);
    return a.start + (a.loop ? k % a.count : Math.min(a.count - 1, k));
}

export const FALLBACK = {
    run: 'walk', jump: 'fall', land: 'idle', stand: 'idle', dizzy: 'hurt', taunt: 'idle', victory: 'taunt',
    grabbed: 'hurt', spin: 'fall', getup: 'idle', hurt2: 'hurt', jab: 'punch', punch: 'jab', cross: 'punch',
    kick: 'punch', block: 'idle', walk: 'idle', hover: 'idle', fly: 'jump', portrait: 'idle', windup: 'idle',
    charge: 'run', stance: 'idle', land2: 'land', stomp: 'slam',
};

/**
 * Render a character directly to RGBA at any scale (portraits, title art).
 * crop: 'head' frames head and shoulders; 'full' the whole cell.
 */
export function renderRGBA(key, { anim = 'portrait', frame = 0, scale = 4, variant = 'base', crop = 'head', w, h } = {}) {
    const ch = CHARS[key];
    const def = animDef(ch, anim) || ANIMS[anim];
    const pose = flattenAnim(def).frames[frame] || STANCE;
    const hip = idleHip(ch);
    const res = buildOps(ch, pose, hip, scale);
    let W, H, ox, oy;
    if (crop === 'head') {
        const hr = ch.body.headR;
        const span = hr * 4.4;
        W = w || Math.round(span * scale); H = h || W;
        ox = W / 2 - res.head.x * scale - hr * 0.3 * scale;
        oy = H * 0.42 + res.head.y * scale;
    } else {
        W = w || ch.cell[0] * scale; H = h || ch.cell[1] * scale;
        ox = W / 2; oy = H - 3 * scale;
    }
    W = Math.round(W); H = Math.round(H);
    const buf = new IndexBuffer(W, H);
    rasterOps(buf, res.ops, scale, ox, oy);
    closeOutline(buf);
    const pal = paletteRow(ch, variant === 'base' ? {} : ch.variants[variant] || {});
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        const v = buf.idx[i];
        if (!v) continue;
        data[i * 4] = pal[v * 4]; data[i * 4 + 1] = pal[v * 4 + 1]; data[i * 4 + 2] = pal[v * 4 + 2]; data[i * 4 + 3] = 255;
    }
    return { w: W, h: H, data };
}
