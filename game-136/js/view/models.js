// Every clay thing, made in code from rounded, lumpy primitives (see clay.js). One builder per kind;
// each returns a Group whose origin is the middle of its footprint on the floor, facing +z
// (rot 0, sim +y). Wall things are built facing out of the wall (+z) with their centre at the origin.
//
// group.userData: { light: {x, y, z, color, fire} } for lamps and fires (the view lends them a
// point light), flames: [meshes] to flicker, top: height a rider stands at.

import * as THREE from 'three';
import { KINDS, COLOR } from '../sim/data/catalog.js';
import { clay, rbox, puck, blob, capsule, torus, slab, mesh } from './clay.js';
import { ART, ROOT } from '../media.js';

export const ROW = 0.7;          // wall cell height
export const ROW0 = 0.25;        // the bottom of wall row 0
export const WALL_H = ROW0 + ROW * 3 + 0.25;

const hex = (id) => COLOR[id]?.hex ?? 0xcccccc;
const shade = (h, k) => {
    const c = new THREE.Color(h);
    const hsl = {}; c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
    return c.getHex();
};
const WOOD = 0x9a6a44, DARK = 0x3a3036, SOIL = 0x5a3d2b, GLOW_WARM = 0xffd27a, GLOW_COOL = 0xbfe4ff;

/** Lamp shades and flames glow; the view turns them up at night. */
export const GLOWING = new Set();
function glowMat(h, emissive, glow = 0.6) {
    const m = clay(h, { emissive, glow, rim: 1.4 });
    GLOWING.add(m);
    return m;
}

// ------------------------------------------------------------------ paintings (fal, with a code fallback)
const loader = new THREE.TextureLoader();
const paintings = new Map();
function fallbackPainting(i) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#9fd3f0'; g.fillRect(0, 0, 128, 128);
    const col = ['#f6cf57', '#e8553f', '#f28a3a', '#5aa04a', '#e8553f', '#ffffff'][i % 6];
    g.fillStyle = col;
    g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const waits = [];
export function paintingTexture(i) {
    if (paintings.has(i)) return paintings.get(i);
    const name = ART.motifs[i % ART.motifs.length];
    let done;
    waits.push(new Promise((r) => { done = r; }));
    const tex = loader.load(`${ROOT}art/motif-${name}.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; done(); }, undefined, () => {
        tex.image = fallbackPainting(i).image; tex.needsUpdate = true; done();
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    paintings.set(i, tex);
    return tex;
}
/** Start loading every painting; resolves when each has loaded or fallen back (never rejects). */
export function preloadPaintings() {
    for (let i = 0; i < ART.motifs.length; i++) paintingTexture(i);
    return Promise.all(waits);
}
const paintMats = new Map();
function paintMat(i) {
    if (!paintMats.has(i)) paintMats.set(i, new THREE.MeshStandardMaterial({ map: paintingTexture(i), roughness: 0.9, metalness: 0 }));
    return paintMats.get(i);
}

// ------------------------------------------------------------------ helpers
function leg(g, mat, x, z, h, r = 0.045, seed = 0) {
    g.add(mesh(puck(r * 0.85, r, h, 0.015, 1, seed, 10), mat, x, h / 2, z));
}
function legs4(g, mat, w, d, h, inset = 0.1, r = 0.045, seed = 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(g, mat, sx * (w / 2 - inset), sz * (d / 2 - inset), h, r, seed + sx + sz * 2);
}
const lightAt = (g, x, y, z, warm, fire = false) => { g.userData.light = { x, y, z, color: fire ? 0xff9a4a : warm ? 0xffc98a : 0xcfe6ff, fire }; };

// ------------------------------------------------------------------ builders
const B = {
    bed(g, it, w, d, h, c0, c1, s) {
        const fr = clay(c0), bl = clay(c1), cream = clay(0xf6efe2), v = it.variant;
        const legH = v === 2 ? 0.16 : 0.1;
        legs4(g, fr, w * 0.92, d * 0.94, legH + 0.05, 0.08, 0.05, s);
        g.add(mesh(rbox(w * 0.92, 0.22, d * 0.94, 0.07, 1, s), fr, 0, legH + 0.11, 0));
        g.add(mesh(rbox(w * 0.86, 0.14, d * 0.86, 0.06, 1, s + 1), cream, 0, legH + 0.27, 0.02));
        const puff = v === 0 ? 1.6 : 1;
        g.add(mesh(rbox(w * 0.9, 0.09 * puff, d * 0.62, 0.045 * puff, 1.6, s + 2), bl, 0, legH + 0.34 + 0.02 * puff, d * 0.16));
        const n = w > 1.5 ? 2 : 1;
        for (let i = 0; i < n; i++) {
            const p = mesh(blob(0.2, 1.2, s + i), cream, (i - (n - 1) / 2) * 0.42, legH + 0.4, -d * 0.34);
            p.scale.set(1.15, 0.45, 0.75);
            g.add(p);
        }
        // headboard
        const hb = mesh(rbox(w * 0.94, v === 2 ? 0.45 : 0.62, 0.12, 0.06, 1, s + 3), fr, 0, legH + (v === 2 ? 0.32 : 0.4), -d * 0.47 + 0.06);
        g.add(hb);
        if (v === 0) { const k = mesh(blob(0.11, 1, s), clay(c1), 0, legH + 0.72, -d * 0.47 + 0.08); k.scale.set(1, 1, 0.5); g.add(k); }
        if (v === 1) {   // four-poster: posts and a canopy frame
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(puck(0.045, 0.05, 1.35, 0.02, 1, s, 10), fr, sx * (w * 0.45), 0.68, sz * (d * 0.45)));
            g.add(mesh(rbox(w * 0.96, 0.06, d * 0.96, 0.03, 1, s), fr, 0, 1.36, 0));
            const can = mesh(rbox(w * 0.9, 0.04, d * 0.9, 0.02, 2, s + 4), clay(c1), 0, 1.4, 0);
            g.add(can);
        }
        if (v === 2) {   // cot: spindle sides
            for (const sx of [-1, 1]) for (let i = 0; i < Math.round(d * 4); i++) g.add(mesh(puck(0.022, 0.022, 0.3, 0.01, 1, s + i, 8), fr, sx * (w * 0.46), legH + 0.4, -d * 0.4 + (i + 0.5) * (d * 0.8) / Math.round(d * 4)));
        }
    },
    sofa(g, it, w, d, h, c0, c1, s) {
        const body = clay(c0), cush = clay(c1), v = it.variant;
        const r = v === 1 ? 0.04 : 0.1;
        g.add(mesh(rbox(w * 0.96, 0.3, d * 0.8, r, 1.2, s), body, 0, 0.2, 0.02));
        if (v === 2) {
            const back = mesh(capsule(0.19, w * 0.78, 1.2, s), body, 0, 0.5, -d * 0.3);
            back.rotation.z = Math.PI / 2;
            g.add(back);
        } else g.add(mesh(rbox(w * 0.96, 0.5, 0.24, r, 1.2, s + 1), body, 0, 0.42, -d * 0.3));
        for (const sx of [-1, 1]) g.add(mesh(rbox(0.2, v === 2 ? 0.34 : 0.42, d * 0.8, r, 1.2, s + 2), body, sx * (w * 0.48 - 0.1), 0.32, 0.02));
        const n = Math.max(2, Math.round(w));
        const cw = (w * 0.96 - 0.4) / n;
        for (let i = 0; i < n; i++) {
            g.add(mesh(rbox(cw * 0.96, 0.12, d * 0.56, 0.05, 1.6, s + i), cush, -w * 0.48 + 0.2 + cw * (i + 0.5), 0.41, 0.08));
            const p = mesh(blob(0.17, 1.3, s + i), cush, -w * 0.48 + 0.2 + cw * (i + 0.5), 0.6, -d * 0.18);
            p.scale.set(1, 0.85, 0.45); p.rotation.x = -0.25;
            g.add(p);
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(blob(0.045, 0.5, s), clay(DARK), sx * (w * 0.44), 0.03, sz * d * 0.3));
    },
    armchair(g, it, w, d, h, c0, c1, s) {
        const body = clay(c0), cush = clay(c1), v = it.variant, k = h / 0.75;
        if (v === 2) {   // rocker
            for (const sx of [-1, 1]) {
                // an arc of a big ring, centred under the chair, in the y–z plane
                const rk = mesh(torus(0.9, 0.03, 0.9, 1, s), clay(WOOD));
                rk.rotation.z = -Math.PI / 2 - 0.45;
                const hold = new THREE.Group();
                hold.add(rk); hold.rotation.y = Math.PI / 2; hold.position.set(sx * 0.3, 0.92, 0);
                g.add(hold);
            }
        }
        const base = v === 2 ? 0.12 : 0.05;
        if (v === 1) {   // tub: a round body
            g.add(mesh(puck(0.4, 0.36, 0.34 * k, 0.1, 1.2, s), body, 0, base + 0.17 * k, 0.02));
            const back = mesh(torus(0.32, 0.11 * k, Math.PI * 1.25, 1.2, s), body);
            back.rotation.z = -Math.PI / 2 - Math.PI * 0.625;
            const hold = new THREE.Group();
            hold.add(back); hold.rotation.x = Math.PI / 2; hold.position.set(0, base + 0.4 * k, 0.02);
            g.add(hold);
            g.add(mesh(puck(0.33, 0.33, 0.1, 0.05, 1.5, s), cush, 0, base + 0.38 * k, 0.04));
            return;
        }
        g.add(mesh(rbox(0.78, 0.28 * k, 0.72, 0.09, 1.2, s), body, 0, base + 0.16 * k, 0.03));
        const tall = v === 0 ? 0.75 : 0.55;
        g.add(mesh(rbox(0.78, tall * k, 0.2, 0.08, 1.2, s + 1), body, 0, base + (0.2 + tall / 2) * k, -0.28));
        if (v === 0) for (const sx of [-1, 1]) { const wg = mesh(rbox(0.12, 0.3 * k, 0.26, 0.05, 1, s), body, sx * 0.36, base + 0.66 * k, -0.18); g.add(wg); }
        for (const sx of [-1, 1]) g.add(mesh(rbox(0.16, 0.36 * k, 0.66, 0.07, 1.2, s + 2), body, sx * 0.33, base + 0.3 * k, 0.03));
        g.add(mesh(rbox(0.5, 0.12, 0.52, 0.05, 1.6, s + 3), cush, 0, base + 0.36 * k, 0.07));
        if (v !== 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(blob(0.045, 0.5, s), clay(DARK), sx * 0.33, 0.03, sz * 0.3));
    },
    chair(g, it, w, d, h, c0, c1, s) {
        const wood = clay(c0), seat = clay(c1), v = it.variant, sh = h * 0.85;
        if (v === 1) {   // stool
            for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const l = mesh(puck(0.03, 0.04, sh, 0.01, 1, s + i, 8), wood, Math.cos(a) * 0.17, sh / 2, Math.sin(a) * 0.17); l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = -Math.sin(a) * 0.12; g.add(l); }
            g.add(mesh(puck(0.24, 0.22, 0.09, 0.04, 1.4, s), seat, 0, sh + 0.03, 0));
            return;
        }
        legs4(g, wood, 0.5, 0.5, sh, 0.06, 0.035, s);
        g.add(mesh(rbox(0.52, 0.08, 0.5, 0.04, 1, s), wood, 0, sh, 0));
        g.add(mesh(rbox(0.46, 0.06, 0.44, 0.03, 1.6, s + 1), seat, 0, sh + 0.06, 0.01));
        const bh = 0.5;
        for (const sx of [-1, 1]) g.add(mesh(puck(0.03, 0.035, bh, 0.012, 1, s + sx, 8), wood, sx * 0.21, sh + bh / 2, -0.22));
        if (v === 0) {
            for (let i = -1; i <= 1; i++) g.add(mesh(puck(0.018, 0.018, bh * 0.8, 0.008, 1, s + i, 8), wood, i * 0.1, sh + bh * 0.42, -0.22));
            g.add(mesh(rbox(0.5, 0.09, 0.07, 0.03, 1, s), wood, 0, sh + bh, -0.22));
        } else for (let i = 0; i < 3; i++) g.add(mesh(rbox(0.44, 0.05, 0.05, 0.02, 1, s + i), wood, 0, sh + 0.15 + i * 0.15, -0.22));
    },
    table(g, it, w, d, h, c0, c1, s) {
        const top = clay(c0), lg = clay(c1), v = it.variant;
        if (v === 1) {
            const r = Math.min(w, d) * 0.46;
            const t = mesh(puck(r, r, 0.07, 0.03, 1, s, 26), top, 0, h, 0);
            t.scale.set(w / Math.min(w, d), 1, d / Math.min(w, d));
            g.add(t);
            g.add(mesh(puck(0.07, 0.09, h - 0.06, 0.02, 1, s, 12), lg, 0, (h - 0.06) / 2, 0));
            g.add(mesh(puck(0.22, 0.25, 0.05, 0.02, 1, s, 16), lg, 0, 0.025, 0));
            return;
        }
        g.add(mesh(rbox(w * 0.94, 0.07, d * 0.94, 0.03, 1, s), top, 0, h, 0));
        if (v === 2) {
            for (const sx of [-1, 1]) g.add(mesh(rbox(0.07, h - 0.04, d * 0.7, 0.025, 1, s + sx), lg, sx * (w * 0.36), (h - 0.04) / 2, 0));
            g.add(mesh(rbox(w * 0.72, 0.05, 0.05, 0.02, 1, s), lg, 0, h * 0.3, 0));
        } else legs4(g, lg, w * 0.94, d * 0.94, h - 0.03, 0.08, 0.04, s);
    },
    desk(g, it, w, d, h, c0, c1, s) {
        const wood = clay(c0), knob = clay(c1), v = it.variant;
        g.add(mesh(rbox(w * 0.96, 0.07, d * 0.8, 0.03, 1, s), wood, 0, h, -0.06));
        if (v === 0 || v === 2) {
            const dw = 0.42;
            g.add(mesh(rbox(dw, h - 0.03, d * 0.76, 0.03, 1, s + 1), wood, w * 0.48 - dw / 2 - 0.02, (h - 0.03) / 2, -0.06));
            for (let i = 0; i < 3; i++) g.add(mesh(blob(0.03, 0.4, s + i), knob, w * 0.48 - dw / 2 - 0.02, 0.12 + i * (h - 0.16) / 3, d * 0.33));
            legs4(g, wood, w * 0.96, d * 0.8, h - 0.03, 0.07, 0.035, s);
            if (v === 2) g.add(mesh(rbox(w * 0.9, 0.3, 0.12, 0.03, 1, s + 2), wood, 0, h + 0.18, -d * 0.4));
        } else {
            legs4(g, wood, w * 0.96, d * 0.8, h - 0.03, 0.07, 0.03, s);
            g.add(mesh(rbox(w * 0.5, 0.08, d * 0.6, 0.02, 1, s + 3), knob, 0, h - 0.09, -0.06));
        }
    },
    bookshelf(g, it, w, d, h, c0, c1, s) {
        const wood = clay(c0), v = it.variant;
        const dd = 0.4, z = -d / 2 + dd / 2 + 0.04;
        const shelves = Math.max(2, Math.round(h / 0.36));
        if (v === 2) {   // a ladder shelf, leaning on the wall
            for (const sx of [-1, 1]) { const r = mesh(rbox(0.06, h * 1.04, 0.06, 0.02, 1, s), wood, sx * (w * 0.46), h / 2, z); r.rotation.x = -0.12; g.add(r); }
        } else {
            g.add(mesh(rbox(w * 0.94, h, 0.05, 0.02, 1, s), wood, 0, h / 2, z - dd / 2 + 0.03));
            for (const sx of [-1, 1]) g.add(mesh(rbox(0.06, h, dd, 0.02, 1, s + sx), wood, sx * (w * 0.47 - 0.03), h / 2, z));
        }
        const book = [c1, shade(c1, 0.75), 0xf3e6cc, shade(c1, 1.25), 0x5a7fd6, 0x8aa66f];
        for (let k = 0; k <= shelves; k++) {
            const y = 0.04 + k * (h - 0.06) / shelves;
            const sw = v === 2 ? w * 0.9 * (1 - k * 0.04) : w * 0.92;
            g.add(mesh(rbox(sw, 0.045, dd * (v === 2 ? 0.8 - k * 0.08 : 1), 0.015, 1, s + k), wood, 0, y, z + (v === 2 ? k * 0.012 : 0)));
            if (k === shelves) break;
            const space = (h - 0.06) / shelves - 0.06;
            let x = -sw / 2 + 0.06;
            let i = 0;
            if (v === 1 && w > 1.5) {   // cubby: a divider every tile
                for (let c = 1; c < Math.round(w); c++) g.add(mesh(rbox(0.04, space + 0.04, dd * 0.9, 0.012, 1, s), wood, -w / 2 + c, y + space / 2 + 0.03, z));
            }
            while (x < sw / 2 - 0.12) {
                const bw = 0.05 + ((s * 7 + k * 3 + i * 5) % 4) * 0.012;
                const bh = space * (0.6 + ((s + k + i * 3) % 4) * 0.1);
                const bk = mesh(rbox(bw, bh, dd * 0.7, 0.012, 0.6, s + i), clay(book[(i + k + s) % book.length]), x + bw / 2, y + 0.022 + bh / 2, z + 0.02);
                if ((i + k) % 7 === 5) bk.rotation.z = 0.25;
                g.add(bk);
                x += bw + 0.012 + ((i + k) % 5 === 2 ? 0.1 : 0);
                i++;
            }
        }
    },
    nightstand(g, it, w, d, h, c0, c1, s) {
        const wood = clay(c0), knob = clay(c1), v = it.variant;
        if (v === 1) {
            g.add(mesh(puck(0.3, 0.27, h, 0.06, 1.2, s), wood, 0, h / 2, 0));
            g.add(mesh(blob(0.04, 0.4, s), knob, 0, h * 0.55, 0.28));
            return;
        }
        g.add(mesh(rbox(0.62, h, 0.56, v === 2 ? 0.02 : 0.05, 1.2, s), wood, 0, h / 2, 0));
        if (v === 2) for (let i = 0; i < 3; i++) g.add(mesh(rbox(0.64, 0.03, 0.03, 0.01, 1, s + i), clay(shade(c0, 0.75)), 0, 0.1 + i * (h - 0.15) / 2, 0.29));
        else {
            g.add(mesh(rbox(0.5, h * 0.36, 0.04, 0.02, 1, s), clay(shade(c0, 0.9)), 0, h * 0.62, 0.28));
            g.add(mesh(blob(0.035, 0.4, s), knob, 0, h * 0.62, 0.31));
        }
    },
    fireplace(g, it, w, d, h, c0, c1, s) {
        const stone = clay(c0), mantel = clay(c1), v = it.variant, z = -d / 2 + 0.25;
        const flames = [];
        if (v === 1) {   // a round stove with a pipe
            g.add(mesh(puck(0.34, 0.3, 0.6, 0.08, 1.2, s), clay(DARK), 0, 0.36, z + 0.05));
            // the pipe rises, then bends back into the wall under the shelf
            g.add(mesh(puck(0.07, 0.07, 0.24, 0.02, 1, s, 12), clay(DARK), 0, 0.78, z + 0.05));
            const elbow = mesh(capsule(0.07, 0.2, 1, s), clay(DARK), 0, 0.86, z - 0.08); elbow.rotation.x = Math.PI / 2; g.add(elbow);
            for (const sx of [-1, 1]) leg(g, clay(DARK), sx * 0.2, z + 0.05, 0.08, 0.04, s);
            g.add(mesh(rbox(w * 0.9, 0.06, 0.4, 0.02, 1, s), mantel, 0, h, z - 0.05));
            const win = mesh(puck(0.13, 0.13, 0.04, 0.015, 1, s), glowMat(0xff9a4a, 0xff7a2a, 1.2), 0, 0.36, z + 0.36);
            win.rotation.x = Math.PI / 2; g.add(win); flames.push(win);
        } else {
            g.add(mesh(rbox(w * 0.94, h - 0.1, 0.5, 0.05, 1.6, s), stone, 0, (h - 0.1) / 2, z));
            const hole = v === 2 ? mesh(puck(0.32, 0.32, 0.1, 0.03, 1, s, 20), clay(0x241a18), 0, 0.3, z + 0.21) : mesh(rbox(w * 0.5, 0.5, 0.1, 0.04, 1, s), clay(0x241a18), 0, 0.3, z + 0.21);
            if (v === 2) hole.rotation.x = Math.PI / 2;
            g.add(hole);
            g.add(mesh(rbox(w, 0.08, 0.6, 0.03, 1, s + 1), mantel, 0, h - 0.06, z + 0.04));
            if (v === 0) for (let i = 0; i < 10; i++) {   // a few proud bricks
                const b = mesh(rbox(0.2, 0.09, 0.04, 0.02, 1, s + i), clay(shade(c0, 0.85 + (i % 3) * 0.08)), -w * 0.4 + ((i * 37) % 10) / 10 * w * 0.8, 0.08 + ((i * 53) % 9) / 9 * (h - 0.3), z + 0.25);
                if (Math.abs(b.position.x) > w * 0.27 || b.position.y > 0.6) g.add(b);
            }
            for (let i = 0; i < 2; i++) { const lg = mesh(capsule(0.05, 0.3, 1, s + i), clay(WOOD), 0, 0.14, z + 0.18 + i * 0.05); lg.rotation.z = Math.PI / 2 + (i ? 0.3 : -0.3); g.add(lg); }
            for (let i = 0; i < 3; i++) {
                const f = mesh(blob(0.09 - i * 0.015, 0.8, s + i), glowMat([0xffb347, 0xff7a2a, 0xffe08a][i], [0xff8a2a, 0xff5a1a, 0xffc04a][i], 1.4), (i - 1) * 0.09, 0.26 + (i === 1 ? 0.04 : 0), z + 0.2);
                f.scale.set(0.8, 1.6, 0.8);
                g.add(f); flames.push(f);
            }
        }
        g.userData.flames = flames;
        lightAt(g, 0, 0.4, z + 0.5, true, true);
    },
    floorlamp(g, it, w, d, h, c0, c1, s) {
        const stand = clay(c0), v = it.variant, warm = (it.motif | 0) === 0;
        const glow = warm ? GLOW_WARM : GLOW_COOL;
        g.add(mesh(puck(0.2, 0.22, 0.06, 0.025, 1, s), stand, 0, 0.03, 0));
        if (v === 2) {   // arc
            const arc = mesh(torus(0.38, 0.025, Math.PI * 0.9, 1, s), stand, -0.05, h - 0.38, 0);
            g.add(mesh(puck(0.025, 0.03, h - 0.4, 0.01, 1, s, 8), stand, -0.43, (h - 0.4) / 2, 0));
            arc.position.x = -0.05; g.add(arc);
            const sh = mesh(blob(0.17, 1, s), glowMat(c1, glow), 0.3, h - 0.12, 0);
            sh.scale.set(1, 0.65, 1); g.add(sh);
            lightAt(g, 0.3, h - 0.25, 0, warm);
            return;
        }
        g.add(mesh(puck(0.025, 0.03, h - 0.3, 0.01, 1, s, 8), stand, 0, (h - 0.3) / 2 + 0.05, 0));
        const shadeGeo = v === 0 ? puck(0.12, 0.24, 0.3, 0.03, 1.2, s, 20) : puck(0.2, 0.2, 0.3, 0.04, 1.2, s, 20);
        g.add(mesh(shadeGeo, glowMat(c1, glow), 0, h - 0.15, 0));
        lightAt(g, 0, h - 0.3, 0, warm);
    },
    tablelamp(g, it, w, d, h, c0, c1, s) {
        const base = clay(c0), v = it.variant, warm = (it.motif | 0) === 0, k = h / 0.45;
        const glow = warm ? GLOW_WARM : GLOW_COOL;
        if (v === 2) {   // candle in a holder
            g.add(mesh(puck(0.14, 0.15, 0.05, 0.02, 1, s), base, 0, 0.025, 0));
            g.add(mesh(puck(0.05, 0.05, 0.22 * k, 0.015, 0.6, s, 12), clay(0xf6efe2), 0, 0.05 + 0.11 * k, 0));
            const f = mesh(blob(0.03, 0.3, s), glowMat(0xffd27a, 0xffb347, 1.6), 0, 0.08 + 0.22 * k, 0);
            f.scale.set(0.8, 1.8, 0.8); g.add(f);
            g.userData.flames = [f];
            lightAt(g, 0, 0.1 + 0.22 * k, 0, true);
            return;
        }
        const b = mesh(blob(0.11 * k, 1, s), base, 0, 0.1 * k, 0); b.scale.set(1, 0.9, 1); g.add(b);
        g.add(mesh(puck(0.02, 0.02, 0.12 * k, 0.008, 1, s, 8), base, 0, 0.22 * k, 0));
        if (v === 0) { const sh = mesh(blob(0.17 * k, 1.2, s), glowMat(c1, glow), 0, 0.3 * k, 0); sh.scale.set(1, 0.6, 1); g.add(sh); }
        else g.add(mesh(puck(0.08 * k, 0.15 * k, 0.16 * k, 0.025, 1.2, s), glowMat(c1, glow), 0, 0.34 * k, 0));
        lightAt(g, 0, 0.28 * k, 0, warm);
    },
    plant(g, it, w, d, h, c0, c1, s) {
        const pot = clay(c0), leaf = clay(c1), v = it.variant, k = h / 0.55;
        const ph = 0.16 * Math.max(0.8, k * 0.8);
        g.add(mesh(puck(0.15 * Math.min(1.3, k), 0.11 * Math.min(1.3, k), ph, 0.03, 1.2, s), pot, 0, ph / 2, 0));
        g.add(mesh(puck(0.13 * Math.min(1.3, k), 0.13 * Math.min(1.3, k), 0.02, 0.008, 1, s), clay(SOIL), 0, ph, 0));
        if (v === 1) {   // cactus
            const c = mesh(capsule(0.07 * k, 0.18 * k, 1, s), leaf, 0, ph + 0.16 * k, 0); g.add(c);
            for (const sx of [-1, 1]) { const a = mesh(capsule(0.04 * k, 0.07 * k, 1, s + sx), leaf, sx * 0.09 * k, ph + 0.2 * k, 0); a.rotation.z = -sx * 0.7; g.add(a); }
            g.add(mesh(blob(0.035, 0.5, s), clay(0xf3a1a8), 0, ph + 0.33 * k, 0));
            return;
        }
        if (v === 2) {   // flowers
            for (let i = 0; i < 4; i++) {
                const a = i * 1.7 + s;
                const x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06, sh = (0.18 + (i % 2) * 0.08) * k;
                g.add(mesh(puck(0.012, 0.012, sh, 0.005, 1, s + i, 6), clay(0x4f8a4a), x, ph + sh / 2, z));
                g.add(mesh(blob(0.05 * Math.min(1.3, k), 1.2, s + i), clay([0xe8553f, 0xf6cf57, 0xf3a1a8, 0xb79be0][(i + s) % 4]), x, ph + sh, z));
            }
            for (let i = 0; i < 3; i++) { const l = mesh(blob(0.06, 1, s + i), leaf, Math.cos(i * 2.1) * 0.08, ph + 0.04, Math.sin(i * 2.1) * 0.08); l.scale.set(1, 0.4, 0.6); l.rotation.y = i * 2.1; g.add(l); }
            return;
        }
        const n = 5 + Math.round(k * 2);
        for (let i = 0; i < n; i++) {
            const a = i * 2.39996 + s, up = 0.3 + (i / n) * 0.9;
            const l = mesh(blob(0.07 * Math.min(1.4, k), 1.2, s + i), leaf, Math.cos(a) * 0.08 * k, ph + up * 0.24 * k, Math.sin(a) * 0.08 * k);
            l.scale.set(0.55, 1.4, 0.3); l.rotation.set(0, -a, Math.cos(a) * 0.5); l.rotation.x = Math.sin(a) * 0.5;
            g.add(l);
        }
    },
    toy(g, it, w, d, h, c0, c1, s) {
        const main = clay(c0), trim = clay(c1), v = it.variant, k = h / 0.38;
        if (v === 0) {   // teddy
            const b = mesh(blob(0.12 * k, 1, s), main, 0, 0.12 * k, 0); b.scale.set(1, 1.05, 0.9); g.add(b);
            g.add(mesh(blob(0.09 * k, 1, s + 1), main, 0, 0.29 * k, 0.01));
            for (const sx of [-1, 1]) { g.add(mesh(blob(0.035 * k, 0.5, s), main, sx * 0.07 * k, 0.37 * k, 0)); g.add(mesh(blob(0.045 * k, 0.6, s), main, sx * 0.12 * k, 0.15 * k, 0.04 * k)); g.add(mesh(blob(0.045 * k, 0.6, s), main, sx * 0.07 * k, 0.04 * k, 0.07 * k)); }
            const sn = mesh(blob(0.04 * k, 0.5, s), trim, 0, 0.27 * k, 0.08 * k); sn.scale.set(1.2, 0.8, 0.8); g.add(sn);
            for (const sx of [-1, 1]) g.add(mesh(blob(0.012 * k, 0.1, s), clay(DARK), sx * 0.035 * k, 0.31 * k, 0.085 * k));
        } else if (v === 1) {   // ball
            g.add(mesh(blob(0.15 * k, 0.6, s, 22, 16), main, 0, 0.15 * k, 0));
            const band = mesh(torus(0.15 * k, 0.025, Math.PI * 2, 0.4, s), trim, 0, 0.15 * k, 0); band.rotation.y = 0.6; g.add(band);
        } else if (v === 2) {   // duck
            const b = mesh(blob(0.12 * k, 1, s), main, 0, 0.1 * k, 0); b.scale.set(0.9, 0.75, 1.2); g.add(b);
            g.add(mesh(blob(0.07 * k, 1, s + 1), main, 0, 0.22 * k, 0.07 * k));
            const bk = mesh(blob(0.035 * k, 0.4, s), trim, 0, 0.21 * k, 0.14 * k); bk.scale.set(1.3, 0.5, 1); g.add(bk);
            for (const sx of [-1, 1]) g.add(mesh(blob(0.012 * k, 0.1, s), clay(DARK), sx * 0.035 * k, 0.25 * k, 0.12 * k));
        } else if (v === 3) {   // rocket
            g.add(mesh(capsule(0.08 * k, 0.18 * k, 1, s), main, 0, 0.2 * k, 0));
            const n = mesh(blob(0.07 * k, 0.6, s), trim, 0, 0.36 * k, 0); n.scale.set(1, 1.3, 1); g.add(n);
            for (let i = 0; i < 3; i++) { const f = mesh(rbox(0.02, 0.12 * k, 0.08 * k, 0.008, 0.5, s + i), trim, Math.cos(i * 2.09) * 0.09 * k, 0.07 * k, Math.sin(i * 2.09) * 0.09 * k); f.rotation.y = -i * 2.09; g.add(f); }
            const wdw = mesh(puck(0.035 * k, 0.035 * k, 0.02, 0.008, 0.3, s), clay(0x86c5ee), 0, 0.24 * k, 0.075 * k); wdw.rotation.x = Math.PI / 2; g.add(wdw);
        } else {   // blocks
            const cols = [main, trim, clay(0xf6cf57)];
            for (let i = 0; i < 3; i++) { const b = mesh(rbox(0.13 * k, 0.13 * k, 0.13 * k, 0.025, 0.8, s + i), cols[i], (i === 2 ? 0.0 : (i ? 0.08 : -0.08)) * k, (i === 2 ? 0.2 : 0.065) * k, (i === 2 ? 0 : 0.02) * k); b.rotation.y = i * 0.4; g.add(b); }
        }
    },
    rug(g, it, w, d, h, c0, c1, s) {
        const base = clay(c0, { rough: 0.95 }), pat = clay(c1, { rough: 0.95 }), v = it.variant, m = it.motif | 0;
        const W = w * 0.94, D = d * 0.94, th = 0.035;
        if (v === 1 || v === 2) {
            const r = Math.min(W, D) / 2;
            const sx = W / (2 * r), sz = D / (2 * r);
            if (v === 2) {   // braided: rings
                const rings = Math.max(3, Math.round(r / 0.09));
                for (let i = 0; i < rings; i++) {
                    const rr = r * (1 - i / rings) - 0.03;
                    if (rr < 0.05) break;
                    const t = mesh(torus(rr, 0.045, Math.PI * 2, 0.4, s + i), i % 2 ? pat : base, 0, 0.04, 0);
                    t.rotation.x = Math.PI / 2; t.scale.set(sx, sz, 0.6); t.castShadow = false;
                    g.add(t);
                }
                return;
            }
            const disc = mesh(puck(r, r, th, 0.015, 0.6, s, 32), base, 0, th / 2, 0);
            disc.scale.set(sx, 1, sz); disc.castShadow = false; g.add(disc);
            if (m === 1) for (let i = 1; i < 4; i++) { const t = mesh(torus(r * i / 4, 0.025, Math.PI * 2, 0.3, s + i), pat, 0, th + 0.004, 0); t.rotation.x = Math.PI / 2; t.scale.set(sx, sz, 0.35); g.add(t); }
            if (m === 2) for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = (0.25 + (i % 3) * 0.25) * r; const dt = mesh(blob(0.05, 0.4, s + i), pat, Math.cos(a) * rr * sx, th + 0.005, Math.sin(a) * rr * sz); dt.scale.set(1, 0.18, 1); g.add(dt); }
            if (m === 3) { const t = mesh(torus(r * 0.86, 0.035, Math.PI * 2, 0.3, s), pat, 0, th + 0.004, 0); t.rotation.x = Math.PI / 2; t.scale.set(sx, sz, 0.35); g.add(t); }
            return;
        }
        const slabM = mesh(rbox(W, th, D, 0.015, 0.6, s), base, 0, th / 2, 0); slabM.castShadow = false; g.add(slabM);
        if (m === 1) { const n = Math.round(W * 3); for (let i = 0; i < n; i += 2) g.add(mesh(rbox(W / n * 0.9, 0.012, D * 0.94, 0.005, 0.4, s + i), pat, -W / 2 + (i + 0.5) * W / n, th + 0.004, 0)); }
        if (m === 2) for (let x = 0; x < Math.round(W * 2.5); x++) for (let z = 0; z < Math.round(D * 2.5); z++) { if ((x + z) % 2) continue; const dt = mesh(blob(0.05, 0.4, s + x + z), pat, -W / 2 + (x + 0.5) * W / Math.round(W * 2.5), th + 0.004, -D / 2 + (z + 0.5) * D / Math.round(D * 2.5)); dt.scale.set(1, 0.18, 1); g.add(dt); }
        if (m === 3) for (const [bw, bd, bx, bz] of [[W * 0.86, 0.07, 0, D * 0.4], [W * 0.86, 0.07, 0, -D * 0.4], [0.07, D * 0.8, W * 0.4, 0], [0.07, D * 0.8, -W * 0.4, 0]]) g.add(mesh(rbox(bw, 0.012, bd, 0.005, 0.4, s), pat, bx, th + 0.004, bz));
        // a fringe on the short ends
        for (const sz2 of [-1, 1]) for (let i = 0; i < Math.round(W * 6); i++) g.add(mesh(rbox(0.02, 0.01, 0.06, 0.004, 0.2, s), clay(0xf3e6cc), -W / 2 + (i + 0.5) * W / Math.round(W * 6), 0.006, sz2 * (D / 2 + 0.025)));
    },
    // ------- wall things: centred on the origin, facing +z, flat against z = 0
    picture(g, it, w, d, h, c0, c1, s, cells) {
        const [cw, ch] = cells, W = cw * 0.86, H = ch * ROW * 0.86, v = it.variant;
        const frame = clay(c0), mat = clay(c1);
        if (v === 2) {   // pennant: a clay flag hanging from a string, painted
            const sh = new THREE.Shape(); sh.moveTo(-W / 2, H / 2); sh.lineTo(W / 2, H / 2); sh.lineTo(0, -H / 2); sh.closePath();
            g.add(mesh(slab(sh, 0.03, `pen${cw}${ch}`), mat, 0, 0, 0.03));
            const p = new THREE.Mesh(new THREE.CircleGeometry(Math.min(W, H) * 0.24, 24), paintMat(it.motif | 0));
            p.position.set(0, H * 0.12, 0.062); g.add(p);
            const rod = mesh(capsule(0.02, W * 1.05, 0.3, s), frame, 0, H / 2 + 0.02, 0.04); rod.rotation.z = Math.PI / 2; g.add(rod);
            return;
        }
        if (v === 1) {   // round frame
            const r = Math.min(W, H) / 2;
            const t = mesh(torus(r - 0.04, 0.045, Math.PI * 2, 1, s), frame, 0, 0, 0.05); g.add(t);
            { const m_ = mesh(puck(r - 0.04, r - 0.04, 0.03, 0.01, 0.4, s, 28), mat, 0, 0, 0.02); m_.rotation.x = Math.PI / 2; g.add(m_); }
            const p = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 28), paintMat(it.motif | 0));
            p.position.set(0, 0, 0.04); g.add(p);
            return;
        }
        g.add(mesh(rbox(W, H, 0.05, 0.02, 0.6, s), mat, 0, 0, 0.025));
        for (const [bw, bh, bx, by] of [[W + 0.06, 0.07, 0, H / 2], [W + 0.06, 0.07, 0, -H / 2], [0.07, H, W / 2, 0], [0.07, H, -W / 2, 0]]) g.add(mesh(rbox(bw, bh, 0.08, 0.025, 1, s), frame, bx, by, 0.04));
        const pw = W - 0.16, ph = H - 0.16, side = Math.min(pw, ph);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(side, side), paintMat(it.motif | 0));
        p.position.set(0, 0, 0.053); g.add(p);
    },
    clock(g, it, w, d, h, c0, c1, s) {
        const face = clay(c0), hands = clay(c1), v = it.variant;
        const r = 0.24;
        if (v === 1) {   // cuckoo house
            const sh = new THREE.Shape(); sh.moveTo(-0.24, -0.22); sh.lineTo(0.24, -0.22); sh.lineTo(0.24, 0.12); sh.lineTo(0, 0.32); sh.lineTo(-0.24, 0.12); sh.closePath();
            g.add(mesh(slab(sh, 0.1, 'cuckoo'), clay(WOOD), 0, 0, 0.06));
            { const m_ = mesh(puck(0.12, 0.12, 0.03, 0.01, 0.3, s, 20), face, 0, 0.0, 0.12); m_.rotation.x = Math.PI / 2; g.add(m_); }
            for (const sx of [-1, 1]) g.add(mesh(capsule(0.025, 0.12, 0.3, s), hands, sx * 0.08, -0.3, 0.06));
        } else {
            if (v === 2) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const ray = mesh(capsule(0.02, 0.1, 0.4, s), hands, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.04); ray.rotation.z = a + Math.PI / 2; g.add(ray); }
            { const m_ = mesh(puck(r, r, 0.07, 0.025, 0.6, s, 28), face, 0, 0, 0.05); m_.rotation.x = Math.PI / 2; g.add(m_); }
            const rim = mesh(torus(r, 0.03, Math.PI * 2, 0.5, s), hands, 0, 0, 0.09); g.add(rim);
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.add(mesh(blob(0.016, 0.1, s), hands, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 0.09)); }
        }
        const z = v === 1 ? 0.14 : 0.1, y0 = v === 1 ? 0 : 0;
        const hh = mesh(rbox(0.025, 0.11, 0.015, 0.007, 0.2, s), hands, 0, y0 + 0.045, z); g.add(hh);
        const mh = mesh(rbox(0.02, 0.16, 0.015, 0.007, 0.2, s), hands, 0.05, y0 + 0.03, z + 0.005); mh.rotation.z = -1.1; g.add(mh);
        g.add(mesh(blob(0.022, 0.1, s), hands, 0, y0, z + 0.01));
    },
};

/** Build the model of a thing (placed or not: rot and position are the view's job). */
export function buildModel(it) {
    const K = KINDS[it.kind];
    const g = new THREE.Group();
    const [fw, fd] = K.fp[it.size];
    const h = K.h[it.size];
    const s = (it.lump | 0) % 1000;
    const c0 = hex(it.colors[0]), c1 = hex(it.colors[1]);
    if (K.layer === 'wall') B[it.kind](g, it, fw, fd, h, c0, c1, s, [fw, fd]);
    else B[it.kind](g, it, fw, fd, h, c0, c1, s);
    g.userData.top = K.surface ? h + 0.04 : 0;
    g.userData.kind = it.kind;
    return g;
}

/** Same model in see-through clay, for the placement ghost. */
export function ghostOf(model) {
    const g = model.clone(true);
    g.traverse((o) => {
        if (!o.isMesh) return;
        const c = o.material.color ? o.material.color.getHex() : 0xffffff;
        o.material = clay(c, { ghost: true });
        o.castShadow = false;
    });
    return g;
}
