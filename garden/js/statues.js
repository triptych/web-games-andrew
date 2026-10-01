// One statue per game: a pedestal with a bronze plaque (icon + title from a
// shared canvas atlas) and a figure or sculpture sculpted from primitives,
// chosen by genre and varied per game. All statues merge into a handful of
// meshes; an aId vertex attribute lets one shader light up the hovered one.

import * as THREE from 'three';
import { Batch, xf, under } from './materials.js';
import { lathe } from './architecture.js';
import { rng, TAU } from './util.js';
import { canvas, toTexture } from './textures.js';

const PED_H = 1.25;
export const STATUE_TOP = 3.6; // pick cylinder height above the ground

// -------------------------------------------------------------- hover shader

export const hoverUniforms = {
    uHover: { value: -1 },
    uHoverColor: { value: new THREE.Color('#ffffff') },
    uHoverTime: { value: 0 },
    uNightGlow: { value: 0 },
};

export function hoverMaterial(base, { rimOnly = false } = {}) {
    const m = base.clone();
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, hoverUniforms);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aId;\nvarying float vId;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvId = aId;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uHover, uHoverTime, uNightGlow;\nuniform vec3 uHoverColor;\nvarying float vId;')
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float hov = 1.0 - step(0.5, abs(vId - uHover));
                float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
                float pulse = 0.75 + 0.25 * sin(uHoverTime * 5.0);
                totalEmissiveRadiance += uHoverColor * hov * (rim * 1.6 + ${rimOnly ? '0.0' : '0.12'}) * pulse;
                // moonlit marble keeps a faint glow at night
                totalEmissiveRadiance += vec3(0.55, 0.65, 0.9) * rim * uNightGlow * 0.25;`
            );
    };
    m.customProgramCacheKey = () => 'hover' + (rimOnly ? 'r' : '');
    return m;
}

// --------------------------------------------------------------- plaque atlas

const ATLAS_COLS = 4, ATLAS_ROWS = 16, PER_PAGE = ATLAS_COLS * ATLAS_ROWS;

function wrapText(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) {
            lines.push(line);
            line = w;
        } else line = t;
    }
    if (line) lines.push(line);
    return lines;
}

function drawPlaque(ctx, x0, y0, W, H, game, genre) {
    const g = ctx.createLinearGradient(x0, y0, x0, y0 + H);
    g.addColorStop(0, '#5b3d1f');
    g.addColorStop(0.5, '#3b2612');
    g.addColorStop(1, '#2a1a0c');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, W, H);
    // bevelled gilt border
    ctx.lineWidth = H * 0.05;
    ctx.strokeStyle = '#d9b46a';
    ctx.strokeRect(x0 + H * 0.04, y0 + H * 0.04, W - H * 0.08, H - H * 0.08);
    ctx.lineWidth = H * 0.012;
    ctx.strokeStyle = genre.accent;
    ctx.strokeRect(x0 + H * 0.1, y0 + H * 0.1, W - H * 0.2, H - H * 0.2);
    // icon medallion
    const cx = x0 + H * 0.52, cy = y0 + H * 0.5, r = H * 0.32;
    const rg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
    rg.addColorStop(0, '#f6e7c0');
    rg.addColorStop(1, '#b8904c');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${r * 1.15}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillStyle = '#000';
    ctx.fillText(game.icon, cx, cy + r * 0.06);
    // title, engraved
    const tx = x0 + H * 0.95, tw = W - H * 1.1;
    ctx.textAlign = 'left';
    let size = H * 0.2;
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    let lines = wrapText(ctx, game.title, tw);
    while (lines.length > 2 && size > H * 0.12) {
        size *= 0.9;
        ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
        lines = wrapText(ctx, game.title, tw);
    }
    lines = lines.slice(0, 2);
    const lh = size * 1.1;
    const ty = y0 + H * 0.44 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => {
        ctx.fillStyle = '#1a0f05';
        ctx.fillText(l, tx + 1.5, ty + i * lh + 1.5, tw);
        ctx.fillStyle = '#f1d99a';
        ctx.fillText(l, tx, ty + i * lh, tw);
    });
    ctx.font = `italic ${H * 0.1}px Georgia, serif`;
    ctx.fillStyle = '#cfae6e';
    const sub = `${game.version ? 'v' + game.version + ' · ' : ''}${game.id.replace('game-', 'No. ')}`;
    ctx.fillText(sub, tx, y0 + H * 0.78, tw);
}

function buildAtlases(statues, cellW) {
    const W = cellW, H = cellW / 2;
    const pages = [];
    statues.forEach((st, i) => {
        const p = Math.floor(i / PER_PAGE), k = i % PER_PAGE;
        if (!pages[p]) {
            const c = canvas(W * ATLAS_COLS, H * ATLAS_ROWS);
            pages[p] = { c, ctx: c.getContext('2d') };
        }
        const col = k % ATLAS_COLS, row = Math.floor(k / ATLAS_COLS);
        drawPlaque(pages[p].ctx, col * W, row * H, W, H, st.game, st.genre);
        st.atlas = { page: p, u0: col / ATLAS_COLS, v0: 1 - (row + 1) / ATLAS_ROWS, du: 1 / ATLAS_COLS, dv: 1 / ATLAS_ROWS };
    });
    return pages.map(({ c }) => {
        const t = toTexture(c);
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        return t;
    });
}

// --------------------------------------------------------------- sculpting

/** Collects statue parts in the statue's local frame. */
class Sculpt {
    constructor(batch, base, id) {
        this.batch = batch;
        this.base = base;
        this.id = id;
        this.glows = [];
    }
    add(key, geo, local) {
        this.batch.add(key, geo, local ? under(this.base, local) : this.base, { aId: this.id });
    }
    tube(key, pts, r, segs = 12) {
        const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
        this.add(key, new THREE.TubeGeometry(c, segs, r, 7));
    }
    glow(p, color, size = 1) {
        const v = new THREE.Vector3(...p).applyMatrix4(this.base);
        this.glows.push({ x: v.x, y: v.y, z: v.z, color, size });
    }
}

/** Robe with folds, as a lathe whose radius ripples around the hem. */
function robeGeo(r, { width = 1, hem = 0.42, folds = 9 }) {
    const p = [[0, 0], [hem * width, 0], [(hem + 0.02) * width, 0.05], [(hem - 0.02) * width, 0.2], [0.33 * width, 0.6], [0.26 * width, 0.98], [0.22 * width, 1.1], [0.25 * width, 1.3], [0.27 * width, 1.45], [0.27 * width, 1.55], [0.21 * width, 1.64], [0.085, 1.7], [0.075, 1.78], [0, 1.8]];
    const g = lathe(p, 28);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const phase = r() * TAU;
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (v.y < 1.15) {
            const a = Math.atan2(v.x, v.z);
            const k = 1 + Math.sin(a * folds + phase + v.y * 1.5) * 0.06 * (1.15 - v.y);
            pos.setXYZ(i, v.x * k, v.y, v.z * k);
        }
    }
    g.computeVertexNormals();
    return g;
}

const ARMS = {
    staff: { R: [[0.24, 1.58, 0], [0.34, 1.3, 0.08], [0.36, 1.12, 0.18]], L: [[-0.24, 1.58, 0], [-0.36, 1.45, 0.22], [-0.3, 1.5, 0.45]] },
    book: { R: [[0.24, 1.58, 0], [0.3, 1.28, 0.12], [0.17, 1.25, 0.34]], L: [[-0.24, 1.58, 0], [-0.3, 1.28, 0.12], [-0.17, 1.25, 0.34]] },
    sword: { R: [[0.24, 1.58, 0], [0.28, 1.25, 0.18], [0.06, 1.08, 0.36]], L: [[-0.24, 1.58, 0], [-0.28, 1.25, 0.18], [-0.06, 1.08, 0.36]] },
    raise: { R: [[0.24, 1.58, 0], [0.38, 1.9, 0.05], [0.34, 2.25, 0.12]], L: [[-0.24, 1.58, 0], [-0.32, 1.25, 0.04], [-0.3, 0.98, 0.08]] },
    bow: { R: [[0.24, 1.58, 0], [0.18, 1.55, 0.3], [0.02, 1.62, 0.18]], L: [[-0.24, 1.58, 0], [-0.3, 1.58, 0.36], [-0.28, 1.6, 0.68]] },
    basket: { R: [[0.24, 1.58, 0], [0.33, 1.3, 0.1], [0.24, 1.14, 0.3]], L: [[-0.24, 1.58, 0], [-0.33, 1.3, 0.1], [-0.24, 1.14, 0.3]] },
    open: { R: [[0.24, 1.58, 0], [0.45, 1.4, 0.15], [0.62, 1.5, 0.3]], L: [[-0.24, 1.58, 0], [-0.45, 1.4, 0.15], [-0.62, 1.5, 0.3]] },
};

function figure(s, r, { pose, hood = false, helm = false, armour = false, width = 1, key = 'statueMarble' }) {
    s.add(key, robeGeo(r, { width: armour ? 0.92 : width, hem: armour ? 0.36 : 0.42 }));
    // head
    s.add(key, new THREE.SphereGeometry(0.125, 18, 14), xf(0, 1.9, 0.01, 0, 0.92, 1.08, 0.98));
    // a hint of a face: nose and brow, so you can tell which way they look
    s.add(key, new THREE.ConeGeometry(0.022, 0.07, 6), xf(0, 1.89, 0.125, 0, 1, 1, 1, Math.PI / 2 - 0.35));
    s.add(key, new THREE.BoxGeometry(0.15, 0.025, 0.04), xf(0, 1.94, 0.105, 0, 1, 1, 1, 0.2));
    // hood: open at the front so the face shows
    if (hood) s.add(key, new THREE.SphereGeometry(0.165, 16, 12, Math.PI / 2 + 0.95, TAU - 1.9, 0, Math.PI * 0.66), xf(0, 1.9, -0.02, 0, 1, 1.15, 1, -0.15));
    else if (!helm) s.add(key, new THREE.SphereGeometry(0.13, 14, 10, 0, TAU, 0, Math.PI * 0.45), xf(0, 1.93, -0.015, 0, 1, 1, 1, -0.35)); // hair
    if (helm) {
        s.add(key, new THREE.SphereGeometry(0.15, 16, 12, 0, TAU, 0, Math.PI * 0.6), xf(0, 1.9, 0));
        s.add(key, new THREE.BoxGeometry(0.035, 0.16, 0.32), xf(0, 2.05, -0.02));
    }
    if (armour) {
        for (const sx of [-1, 1]) s.add(key, new THREE.SphereGeometry(0.15, 12, 8, 0, TAU, 0, Math.PI / 2), xf(sx * 0.25, 1.56, 0, 0, 1, 0.8, 1, 0, sx * -0.5));
        s.add(key, new THREE.TorusGeometry(0.235, 0.03, 6, 20), xf(0, 1.1, 0, 0, 1, 1, 1, Math.PI / 2));
    }
    // arms with sleeves
    const arm = ARMS[pose] || ARMS.staff;
    for (const side of ['R', 'L']) {
        const pts = arm[side];
        s.tube(key, pts, 0.062);
        const [sx, sy, sz] = pts[1];
        s.add(key, new THREE.SphereGeometry(0.075, 10, 8), xf(sx, sy, sz));
        const [hx, hy, hz] = pts[2];
        s.add(key, new THREE.SphereGeometry(0.058, 10, 8), xf(hx, hy, hz));
        if (!armour) {
            const dir = new THREE.Vector3(hx - sx, hy - sy, hz - sz);
            const len = dir.length();
            const sleeve = new THREE.CylinderGeometry(0.075, 0.12, len * 0.55, 10, 1, true);
            const o = new THREE.Object3D();
            o.position.set(sx + (hx - sx) * 0.62, sy + (hy - sy) * 0.62, sz + (hz - sz) * 0.62);
            o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
            o.updateMatrix();
            s.add(key, sleeve, o.matrix);
        }
    }
    return arm;
}

function sword(s, x, y, z, key) {
    s.add(key, new THREE.BoxGeometry(0.06, 0.95, 0.018), xf(x, y - 0.55, z));
    s.add(key, new THREE.BoxGeometry(0.3, 0.04, 0.05), xf(x, y - 0.05, z));
    s.add(key, new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6), xf(x, y + 0.04, z));
    s.add(key, new THREE.SphereGeometry(0.035, 8, 6), xf(x, y + 0.13, z));
}

const SCULPTS = {
    mage(s, r, g) {
        figure(s, r, { pose: 'staff', hood: r() < 0.6 });
        s.add('statueMarble', new THREE.CylinderGeometry(0.025, 0.03, 2.25, 6), xf(0.36, 1.05, 0.18));
        s.add('statueGilt', new THREE.OctahedronGeometry(0.11, 0), xf(0.36, 2.25, 0.18, 0, 1, 1.5, 1));
        s.glow([0.36, 2.25, 0.18], g.accent, 0.9);
        s.glow([-0.3, 1.62, 0.47], g.accent2, 0.7);
    },
    sage(s, r, g) {
        figure(s, r, { pose: r() < 0.5 ? 'open' : 'raise', hood: true, width: 1.05 });
        s.glow([0.34, 2.38, 0.12], g.accent, 0.8);
    },
    knight(s, r, g) {
        const planted = r() < 0.6;
        figure(s, r, { pose: planted ? 'sword' : 'raise', helm: true, armour: true });
        if (planted) sword(s, 0, 1.08, 0.37, 'statueMarble');
        else {
            sword(s, 0.34, 2.9, 0.12, 'statueMarble');
            s.add('statueMarble', new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), xf(-0.36, 1.25, 0.12, 0, 1, 1, 1, Math.PI / 2, 0.15));
            s.add('statueGilt', new THREE.TorusGeometry(0.34, 0.025, 6, 24), xf(-0.39, 1.25, 0.12, Math.PI / 2 - 0.15));
        }
        s.glow([0, 1.15, 0.4], g.accent, 0.4);
    },
    lantern(s, r, g) {
        figure(s, r, { pose: 'raise', hood: true });
        s.add('statueGilt', new THREE.BoxGeometry(0.18, 0.24, 0.18), xf(0.34, 2.12, 0.12));
        s.add('statueGilt', new THREE.ConeGeometry(0.14, 0.12, 4), xf(0.34, 2.3, 0.12, Math.PI / 4));
        s.glow([0.34, 2.1, 0.12], '#ffb347', 1.2);
    },
    archer(s, r, g) {
        figure(s, r, { pose: 'bow' });
        // the bow stands upright in the forward hand, bulging toward the target
        const R = 0.62, arc = Math.PI * 0.75;
        const [hx, hy, hz] = ARMS.bow.L[2];
        s.add('statueMarble', new THREE.TorusGeometry(R, 0.022, 6, 24, arc), xf(hx, hy, hz - R, -Math.PI / 2, 1, 1, 1, 0, -arc / 2));
        const ty = R * Math.sin(arc / 2), tz = hz - R + R * Math.cos(arc / 2);
        s.tube('statueMarble', [[hx, hy + ty, tz], [0.02, 1.62, 0.18], [hx, hy - ty, tz]], 0.006, 4);
        s.glow([hx, hy, hz + 0.05], g.accent, 0.6);
    },
    reader(s, r, g) {
        figure(s, r, { pose: 'book', hood: r() < 0.3 });
        s.add('statueMarble', new THREE.BoxGeometry(0.24, 0.02, 0.32), xf(-0.12, 1.3, 0.36, 0, 1, 1, 1, -0.5, 0.18));
        s.add('statueMarble', new THREE.BoxGeometry(0.24, 0.02, 0.32), xf(0.12, 1.3, 0.36, 0, 1, 1, 1, -0.5, -0.18));
        s.glow([0, 1.45, 0.42], g.accent2, 0.6);
    },
    gardener(s, r, g) {
        figure(s, r, { pose: 'basket', width: 1.08 });
        s.add('statueMarble', lathe([[0, 0], [0.16, 0], [0.24, 0.12], [0.26, 0.2], [0, 0.2]], 14), xf(0, 1.12, 0.36));
        s.flowers = [0, 1.33, 0.36, 0.22];
        s.glow([0, 1.4, 0.36], g.accent, 0.5);
    },
    orrery(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.45, 0], [0.45, 0.12], [0.2, 0.3], [0.14, 1.2], [0.3, 1.35], [0, 1.4]], 20));
        const y = 2.2;
        s.add('statueGilt', new THREE.TorusGeometry(0.75, 0.035, 8, 48), xf(0, y, 0, 0, 1, 1, 1, Math.PI / 2 + 0.3));
        s.add('statueGilt', new THREE.TorusGeometry(0.62, 0.03, 8, 40), xf(0, y, 0, 0.9, 1, 1, 1, 0.2));
        s.add('statueGilt', new THREE.TorusGeometry(0.5, 0.028, 8, 36), xf(0, y, 0, -0.6, 1, 1, 1, 1.1));
        s.add('statueGilt', new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), xf(0, y, 0, 0, 1, 1, 1, 0.3));
        s.add('statueMarble', new THREE.SphereGeometry(0.2, 16, 12), xf(0, y, 0));
        s.glow([0, y, 0], g.accent, 1.3);
        s.glow([0.62, y + 0.1, 0], g.accent2, 0.35);
    },
    comet(s, r, g) {
        const body = lathe([[0, 0], [0.12, 0.1], [0.3, 0.5], [0.34, 0.9], [0.28, 1.4], [0.15, 1.8], [0, 2.05]], 24);
        s.add('statueMarble', body, xf(0, 0.25, 0, 0, 1, 1, 1, 0.12));
        for (let k = 0; k < 3; k++) {
            const a = (k / 3) * TAU;
            s.add('statueGilt', new THREE.BoxGeometry(0.03, 0.7, 0.4), xf(Math.sin(a) * 0.3, 0.55, Math.cos(a) * 0.3, a, 1, 1, 1, -0.2));
        }
        s.add('statueMarble', new THREE.CylinderGeometry(0.5, 0.55, 0.25, 20), xf(0, 0.12, 0));
        s.glow([0, 0.4, 0], g.accent2, 1.0);
        s.glow([0.05, 2.3, 0.25], g.accent, 0.5);
    },
    sentinel(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.42, 0], [0.42, 0.15], [0.3, 0.2], [0.2, 2.0], [0.0, 2.25]], 4), xf(0, 0, 0, Math.PI / 4));
        s.glow([0, 2.65, 0], g.accent, 1.2);
        s.floater = [0, 2.65, 0, g.accent];
    },
    cubes(s, r, g) {
        let y = 0.2;
        for (let k = 0; k < 6; k++) {
            const size = 0.62 - k * 0.07;
            const key = k === 3 ? 'statueGilt' : 'statueMarble';
            s.add(key, new THREE.BoxGeometry(size, size, size), xf(r.range(-0.08, 0.08), y + size / 2, r.range(-0.08, 0.08), k * 0.32 + r() * 0.2));
            y += size + 0.04;
        }
        s.glow([0, y + 0.3, 0], g.accent, 0.8);
        s.floater = [0, y + 0.35, 0, g.accent2];
    },
    knot(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.4, 0], [0.4, 0.12], [0.14, 0.25], [0.1, 0.9], [0.25, 1.0], [0, 1.02]], 16));
        const p = 2 + Math.floor(r() * 2), q = 3 + Math.floor(r() * 2);
        s.add(r() < 0.5 ? 'statueGilt' : 'statueMarble', new THREE.TorusKnotGeometry(0.42, 0.09, 128, 10, p, q), xf(0, 1.65, 0, r() * TAU, 1, 1, 1, 0.3));
        s.glow([0, 1.65, 0], g.accent, 0.9);
    },
    chess(s, r, g) {
        const kind = r.pick(['king', 'queen', 'rook', 'bishop']);
        const base = [[0, 0], [0.55, 0], [0.55, 0.12], [0.48, 0.18], [0.5, 0.26], [0.32, 0.36], [0.26, 0.5], [0.2, 1.3], [0.36, 1.4], [0.36, 1.48], [0.22, 1.52]];
        const tops = {
            king: [[0.26, 1.7], [0.3, 1.9], [0.12, 2.0], [0, 2.02]],
            queen: [[0.3, 1.75], [0.36, 1.98], [0.2, 2.02], [0.08, 2.08], [0, 2.1]],
            rook: [[0.3, 1.55], [0.34, 1.9], [0.0, 1.9]],
            bishop: [[0.28, 1.68], [0.24, 1.95], [0.1, 2.18], [0, 2.22]],
        };
        s.add('statueMarble', lathe([...base, ...tops[kind]], 28));
        if (kind === 'king') {
            s.add('statueGilt', new THREE.BoxGeometry(0.07, 0.34, 0.07), xf(0, 2.17, 0));
            s.add('statueGilt', new THREE.BoxGeometry(0.22, 0.07, 0.07), xf(0, 2.22, 0));
        } else if (kind === 'queen') {
            for (let k = 0; k < 8; k++) {
                const a = (k / 8) * TAU;
                s.add('statueGilt', new THREE.SphereGeometry(0.045, 8, 6), xf(Math.sin(a) * 0.33, 2.02, Math.cos(a) * 0.33));
            }
            s.add('statueGilt', new THREE.SphereGeometry(0.07, 10, 8), xf(0, 2.15, 0));
        } else if (kind === 'rook') {
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * TAU;
                s.add('statueMarble', new THREE.BoxGeometry(0.14, 0.16, 0.1), xf(Math.sin(a) * 0.28, 1.98, Math.cos(a) * 0.28, a));
            }
        } else {
            s.add('statueGilt', new THREE.SphereGeometry(0.06, 10, 8), xf(0, 2.27, 0));
        }
        s.glow([0, 2.45, 0], g.accent, 0.6);
    },
    tower(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.5, 0], [0.5, 0.15], [0.42, 0.2], [0.36, 1.6], [0.46, 1.7], [0.46, 1.85], [0, 1.85]], 16));
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU;
            s.add('statueMarble', new THREE.BoxGeometry(0.16, 0.18, 0.12), xf(Math.sin(a) * 0.4, 1.94, Math.cos(a) * 0.4, a));
        }
        s.add('statueGilt', new THREE.ConeGeometry(0.3, 0.6, 8), xf(0, 2.2, 0));
        s.add('statueGilt', new THREE.BoxGeometry(0.02, 0.3, 0.02), xf(0, 2.6, 0));
        s.add('statueGilt', new THREE.BoxGeometry(0.22, 0.14, 0.01), xf(0.11, 2.68, 0));
        s.glow([0, 1.0, 0.38], g.accent, 0.5);
    },
    urn(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.32, 0], [0.32, 0.08], [0.18, 0.18], [0.16, 0.32], [0.42, 0.62], [0.52, 0.95], [0.46, 1.25], [0.3, 1.42], [0.28, 1.52], [0.42, 1.6], [0.44, 1.66], [0.36, 1.66], [0.0, 1.55]], 28));
        for (const sx of [-1, 1]) s.tube('statueMarble', [[sx * 0.3, 1.5, 0], [sx * 0.58, 1.48, 0], [sx * 0.55, 1.15, 0], [sx * 0.44, 1.05, 0]], 0.035, 10);
        s.flowers = [0, 1.66, 0, 0.42];
        s.glow([0, 1.85, 0], g.accent, 0.6);
    },
    book(s, r, g) {
        s.add('statueMarble', lathe([[0, 0], [0.4, 0], [0.4, 0.1], [0.14, 0.22], [0.1, 1.05], [0.3, 1.12], [0, 1.15]], 14));
        const page = new THREE.BoxGeometry(0.5, 0.05, 0.7);
        s.add('statueMarble', page, xf(-0.26, 1.28, 0, 0, 1, 1, 1, -0.35, 0.22));
        s.add('statueMarble', page, xf(0.26, 1.28, 0, 0, 1, 1, 1, -0.35, -0.22));
        s.add('statueGilt', new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), xf(0, 1.2, 0, 0, 1, 1, 1, Math.PI / 2 - 0.35));
        for (let k = 0; k < 3; k++) {
            const pg = new THREE.PlaneGeometry(0.45, 0.62, 4, 1);
            const p = pg.attributes.position;
            for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 0.45 + 0.5) * Math.PI) * 0.12);
            pg.computeVertexNormals();
            s.add('statueMarble', pg, xf(-0.1 + k * 0.1, 1.45 + k * 0.06, 0.05, 0, 1, 1, 1, -Math.PI / 2 - 0.35, -0.6 + k * 0.5));
        }
        s.glow([0, 1.7, 0.05], g.accent, 1.0);
    },
};

function fineMarble(m) {
    const c = m.clone();
    for (const k of ['map', 'normalMap']) {
        c[k] = m[k].clone();
        c[k].repeat.set(3, 3);
        c[k].needsUpdate = true;
    }
    return c;
}

export function buildStatues(world) {
    const { layout, mats, root } = world;
    const statues = layout.spokes.flatMap((sp) => sp.statues);
    statues.forEach((st, i) => (st.id = i));
    const pages = buildAtlases(statues, world.quality.plaqueCell);

    const hover = {
        statueMarble: hoverMaterial(fineMarble(mats.marble)),
        statueGilt: hoverMaterial(new THREE.MeshStandardMaterial({ color: 0xe0b860, metalness: 1, roughness: 0.28 })),
        pedestal: hoverMaterial(mats.granite, { rimOnly: true }),
        plaqueFrame: hoverMaterial(mats.bronze, { rimOnly: true }),
    };
    pages.forEach((tex, p) => {
        hover['plaque' + p] = hoverMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08 }));
        world.nightSigns.push(hover['plaque' + p]);
    });

    const batch = new Batch();
    const glows = [], floaters = [];
    for (const st of statues) {
        const g = st.genre;
        const r = rng(st.game.id + g.id);
        const gy = world.groundAt(st.x, st.z) - 0.06;
        st.y = gy;
        const base = xf(st.x, gy, st.z, st.rot);
        const pedS = new Sculpt(batch, base, st.id);
        // pedestal: plinth, die and cornice
        pedS.add('pedestal', new THREE.BoxGeometry(1.4, 0.22, 1.4), xf(0, 0.11, 0));
        pedS.add('pedestal', new THREE.BoxGeometry(1.24, 0.08, 1.24), xf(0, 0.26, 0));
        pedS.add('pedestal', new THREE.BoxGeometry(1.0, 0.82, 1.0), xf(0, 0.71, 0));
        pedS.add('pedestal', new THREE.BoxGeometry(1.2, 0.08, 1.2), xf(0, 1.16, 0));
        pedS.add('pedestal', new THREE.BoxGeometry(1.1, 0.06, 1.1), xf(0, 1.22, 0));
        // plaque on the front face
        pedS.add('plaqueFrame', new THREE.BoxGeometry(0.9, 0.48, 0.03), xf(0, 0.72, 0.51));
        const face = new THREE.PlaneGeometry(0.84, 0.42);
        const uv = face.attributes.uv;
        const a = st.atlas;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, a.u0 + uv.getX(k) * a.du, a.v0 + uv.getY(k) * a.dv);
        pedS.add('plaque' + a.page, face, xf(0, 0.72, 0.527));

        // the sculpture, chosen from the genre's family and varied per game
        const kinds = g.statues;
        const kind = kinds[(st.game.id.charCodeAt(st.game.id.length - 1) + st.side + 3) % kinds.length];
        const scale = r.range(0.95, 1.06);
        const s = new Sculpt(batch, under(base, xf(0, PED_H, 0, r.range(-0.12, 0.12), scale)), st.id);
        (SCULPTS[kind] || SCULPTS.sage)(s, r, g);
        st.kind = kind;
        for (const gl of s.glows) glows.push({ ...gl, statue: st });
        if (s.floater) {
            const v = new THREE.Vector3(s.floater[0], s.floater[1], s.floater[2]).applyMatrix4(s.base);
            floaters.push({ x: v.x, y: v.y, z: v.z, color: s.floater[3], phase: r() * TAU });
        }
        if (s.flowers) {
            const v = new THREE.Vector3(s.flowers[0], s.flowers[1], s.flowers[2]).applyMatrix4(s.base);
            world.flowerBeds.push({ x: v.x, z: v.z, y: v.y, r0: 0, r1: s.flowers[3] * scale, colors: g.flowers, n: 26, mound: true });
        }

        world.colliders.push({ x: st.x, z: st.z, r: 0.95 });
        world.floors.push({ x: st.x, z: st.z, r: 0.75, y: gy + 0.2, block: true });
        world.flowerBeds.push({ x: st.x, z: st.z, r0: 1.05, r1: 1.55, colors: g.flowers, n: 34 });
        // a curved hedge niche behind each statue, cypresses at its ends
        world.hedges.push({ x: st.x, z: st.z, r: 2.35, a0: st.rot + Math.PI - 1.15, a1: st.rot + Math.PI + 1.15, h: 1.5, w: 0.7, seed: st.id });
        for (const e of [-1, 1]) {
            const ca = st.rot + Math.PI + e * 1.35;
            world.cypress.push({ x: st.x + Math.sin(ca) * 2.5, z: st.z + Math.cos(ca) * 2.5, h: r.range(4.2, 5.6) });
        }
    }
    const group = batch.build(hover);
    root.add(group);

    // floating crystals over the sentinels and cube towers
    if (floaters.length) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
        const im = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), mat, floaters.length);
        floaters.forEach((f, i) => im.setColorAt(i, new THREE.Color(f.color)));
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1.6, 1), p = new THREE.Vector3();
        world.updaters.push((t) => {
            floaters.forEach((f, i) => {
                e.set(0, t * 0.8 + f.phase, 0);
                q.setFromEuler(e);
                p.set(f.x, f.y + Math.sin(t * 1.4 + f.phase) * 0.1, f.z);
                m.compose(p, q, sc);
                im.setMatrixAt(i, m);
            });
            im.instanceMatrix.needsUpdate = true;
        });
        root.add(im);
    }
    world.statues = statues;
    world.statueGlows = glows;
    return statues;
}
