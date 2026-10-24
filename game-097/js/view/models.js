// Procedural pieces: a gothic chess set built from lathes and boxes, no asset files. Each unit's
// `model` picks a silhouette, its colours pick the stone and the glow, and its element is a gem that
// floats over its head. Player pieces stand on a gold ring, the dead on a crimson one.
// The piece faces -z (up the board); the rig is turned for the enemy.

import * as THREE from 'three';
import { UNITS, ELEMENTS } from '../sim/data.js';

const V = (r, y) => new THREE.Vector2(r, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), seg);

/** The height of the crown of each model, for the gem and the health bar. */
const HEIGHT = {
    pawn: 0.85, rook: 1.1, bishop: 1.2, knight: 1.15, king: 1.4, queen: 1.3, wazir: 1.0, alfil: 1.0, rider: 1.35,
    cannon: 1.0, dancer: 1.15, hopper: 0.85, witch: 1.3, archbishop: 1.55, empress: 1.3, champion: 1.4, wraith: 1.15, gargoyle: 1.0,
};

// ---------------------------------------------------------------- surfaces
// Each element has its own stone: cracked basalt with lava seams, wave-scaled slate, mossy bark,
// swirled violet marble, ivory marble veined with gold. A colour map and a matching glow map (only the
// seams light up), made once and shared by every piece of that element.
const rnd = (i, j = 0) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
const TEX = {};
function surface(el) {
    if (TEX[el]) return TEX[el];
    const N = 256;
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    const base = mk(), glow = mk();
    const g = base.getContext('2d'), h = glow.getContext('2d');
    h.fillStyle = '#000'; h.fillRect(0, 0, N, N);
    const speckle = (n, lo, hi, a) => { for (let i = 0; i < n; i++) { const v = lo + Math.floor(rnd(i, 3) * (hi - lo)); g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(rnd(i, 1) * N, rnd(i, 2) * N, 1 + rnd(i, 4) * 3, 1 + rnd(i, 5) * 3); } };
    const vein = (ctx, n, col, w, wob, seed) => {
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        for (let k = 0; k < n; k++) {
            ctx.lineWidth = w * (0.5 + rnd(k, seed));
            ctx.beginPath();
            let x = rnd(k, seed + 1) * N, y = rnd(k, seed + 2) * N;
            ctx.moveTo(x, y);
            for (let s = 0; s < 9; s++) { x += (rnd(k, s + seed) - 0.5) * wob; y += (rnd(k, s + seed + 9) - 0.2) * wob; ctx.lineTo(x, y); }
            ctx.stroke();
        }
    };
    if (el === 'ember') {
        g.fillStyle = '#7a3a2c'; g.fillRect(0, 0, N, N);
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${40 + rnd(i) * 50},${14 + rnd(i, 2) * 20},${10},0.55)`; g.beginPath(); g.arc(rnd(i, 1) * N, rnd(i, 2) * N, 14 + rnd(i, 3) * 26, 0, 7); g.fill(); }
        speckle(900, 120, 230, 0.12);
        vein(g, 9, '#1a0806', 4, 90, 20); vein(h, 9, '#ff7a2a', 3, 90, 20); vein(h, 5, '#ffd070', 1.2, 90, 20);
    } else if (el === 'tide') {
        g.fillStyle = '#3f7f9a'; g.fillRect(0, 0, N, N);
        for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++) {
            const x = c * 32 + (r % 2) * 16, y = r * 22;
            const gr = g.createRadialGradient(x, y + 6, 2, x, y + 6, 22);
            gr.addColorStop(0, `rgba(160,235,250,${0.35 + rnd(r, c) * 0.3})`); gr.addColorStop(1, 'rgba(10,50,80,0.55)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y + 6, 20, 0, Math.PI); g.fill();
            h.strokeStyle = 'rgba(80,200,255,0.55)'; h.lineWidth = 1.5; h.beginPath(); h.arc(x, y + 6, 20, 0.1, Math.PI - 0.1); h.stroke();
        }
    } else if (el === 'thorn') {
        g.fillStyle = '#56733c'; g.fillRect(0, 0, N, N);
        for (let i = 0; i < 70; i++) { const x = rnd(i) * N; g.fillStyle = `rgba(${30 + rnd(i, 2) * 40},${40 + rnd(i, 3) * 50},20,0.45)`; g.fillRect(x, 0, 2 + rnd(i, 4) * 7, N); }
        speckle(600, 90, 190, 0.12);
        vein(g, 7, '#243314', 5, 70, 40); vein(h, 7, '#9aff60', 2.2, 70, 40);
        for (let i = 0; i < 18; i++) { const x = rnd(i, 7) * N, y = rnd(i, 8) * N; h.fillStyle = '#c0ff80'; h.beginPath(); h.arc(x, y, 2.4, 0, 7); h.fill(); }
    } else if (el === 'umbra') {
        const gr = g.createLinearGradient(0, 0, N, N); gr.addColorStop(0, '#4a3a78'); gr.addColorStop(1, '#2a1f4a');
        g.fillStyle = gr; g.fillRect(0, 0, N, N);
        for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(150,110,230,${0.1 + rnd(i) * 0.15})`; g.lineWidth = 6 + rnd(i, 2) * 14; g.beginPath(); g.arc(rnd(i, 3) * N, rnd(i, 4) * N, 20 + rnd(i, 5) * 70, rnd(i, 6) * 6, rnd(i, 6) * 6 + 2.4); g.stroke(); }
        speckle(500, 100, 220, 0.1);
        vein(g, 8, '#c8a0ff', 2.2, 80, 60); vein(h, 8, '#b070ff', 2.4, 80, 60);
    } else {
        g.fillStyle = '#d6cdb8'; g.fillRect(0, 0, N, N);
        for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${200 + rnd(i) * 40},${190 + rnd(i, 2) * 40},${160 + rnd(i, 3) * 30},0.4)`; g.beginPath(); g.arc(rnd(i, 1) * N, rnd(i, 2) * N, 10 + rnd(i, 3) * 30, 0, 7); g.fill(); }
        speckle(700, 150, 255, 0.1);
        vein(g, 6, '#b0966a', 2.4, 80, 80); vein(h, 6, '#ffd060', 2.2, 80, 80);
    }
    const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
    return (TEX[el] = { map: tex(base), glow: tex(glow) });
}

export function makeMaterials(def) {
    const [c1, c2] = def.colors;
    const acc = new THREE.Color(c2), gold = new THREE.Color(0xd9b45e);
    // the unit's own colour tints its element's stone, pulled towards white so the texture stays readable
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(c1).multiplyScalar(2.2), 0.42);
    const tex = surface(def.el);
    return {
        body: new THREE.MeshStandardMaterial({ map: tex.map, color: tint, emissiveMap: tex.glow, emissive: acc.clone().lerp(new THREE.Color(0xffffff), 0.3), emissiveIntensity: 1.2, roughness: 0.5, metalness: 0.15, vertexColors: true }),
        dark: new THREE.MeshStandardMaterial({ map: tex.map, color: tint.clone().multiplyScalar(0.6), emissiveMap: tex.glow, emissive: acc, emissiveIntensity: 0.5, roughness: 0.75, metalness: 0.1, vertexColors: true }),
        trim: new THREE.MeshStandardMaterial({ color: acc.clone().lerp(gold, 0.55), emissive: acc, emissiveIntensity: 0.25, roughness: 0.28, metalness: 0.75, vertexColors: true }),
        glow: new THREE.MeshStandardMaterial({ color: c2, emissive: c2, emissiveIntensity: 1.4, roughness: 0.4 }),
    };
}

/** Darker at the foot, lighter at the crown: a vertex colour gradient so a lathe has form even in flat light. */
function shade(geo) {
    if (geo.attributes.color) return;
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox, pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3), span = Math.max(0.001, max.y - min.y);
    for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - min.y) / span, v = 0.68 + 0.42 * t;
        col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

const add = (g, geo, mat, x = 0, y = 0, z = 0) => { if (mat.vertexColors) shade(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

function crown(g, m, y, r, n, h) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = add(g, cone(0.045, h, 5), m.trim, Math.cos(a) * r, y, Math.sin(a) * r);
        c.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    }
}

function horseHead(g, m, y = 0.6) {
    const neck = add(g, box(0.2, 0.55, 0.26), m.body, 0, y + 0.05, 0.04); neck.rotation.x = -0.35;
    add(g, box(0.22, 0.22, 0.4), m.body, 0, y + 0.42, -0.14).rotation.x = 0.3;
    add(g, box(0.17, 0.15, 0.2), m.dark, 0, y + 0.34, -0.38);
    add(g, cone(0.045, 0.14, 4), m.body, -0.07, y + 0.62, -0.02);
    add(g, cone(0.045, 0.14, 4), m.body, 0.07, y + 0.62, -0.02);
    add(g, box(0.05, 0.4, 0.16), m.trim, 0, y + 0.25, 0.14).rotation.x = -0.35;
    add(g, sph(0.035, 8, 6), m.glow, -0.115, y + 0.46, -0.2);
    add(g, sph(0.035, 8, 6), m.glow, 0.115, y + 0.46, -0.2);
}

const BUILD = {
    pawn(g, m) {
        add(g, lathe([[0.3, 0.1], [0.3, 0.14], [0.2, 0.2], [0.12, 0.4], [0.12, 0.5], [0.22, 0.55], [0.1, 0.6], [0, 0.6]]), m.body);
        add(g, sph(0.17), m.body, 0, 0.72, 0);
        add(g, new THREE.TorusGeometry(0.14, 0.025, 6, 16), m.trim, 0, 0.58, 0).rotation.x = Math.PI / 2;
    },
    rook(g, m) {
        add(g, lathe([[0.34, 0.1], [0.3, 0.2], [0.24, 0.35], [0.22, 0.75], [0.31, 0.8], [0.31, 0.96], [0.2, 0.96], [0.2, 0.9], [0, 0.9]]), m.body);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = add(g, box(0.12, 0.14, 0.12), m.body, Math.cos(a) * 0.25, 1.02, Math.sin(a) * 0.25); b.rotation.y = -a; }
        add(g, box(0.05, 0.22, 0.04), m.glow, 0, 0.55, -0.235);
    },
    bishop(g, m) {
        add(g, lathe([[0.32, 0.1], [0.24, 0.2], [0.14, 0.45], [0.13, 0.62], [0.22, 0.68], [0.1, 0.75], [0, 0.75]]), m.body);
        const h = add(g, sph(0.17, 14, 12), m.body, 0, 0.92, 0); h.scale.set(1, 1.4, 1);
        add(g, sph(0.05), m.trim, 0, 1.2, 0);
        const slit = add(g, box(0.04, 0.26, 0.22), m.glow, 0.0, 0.98, -0.05); slit.rotation.z = 0.7;
    },
    knight(g, m) {
        add(g, lathe([[0.32, 0.1], [0.26, 0.2], [0.18, 0.4], [0.2, 0.55], [0, 0.55]]), m.body);
        horseHead(g, m);
    },
    king(g, m) {
        add(g, lathe([[0.34, 0.1], [0.28, 0.22], [0.2, 0.5], [0.18, 0.85], [0.28, 0.92], [0.26, 1.06], [0.12, 1.1], [0, 1.1]]), m.body);
        add(g, box(0.07, 0.3, 0.07), m.trim, 0, 1.3, 0);
        add(g, box(0.22, 0.07, 0.07), m.trim, 0, 1.33, 0);
        add(g, new THREE.TorusGeometry(0.2, 0.03, 6, 20), m.trim, 0, 1.08, 0).rotation.x = Math.PI / 2;
    },
    queen(g, m) {
        add(g, lathe([[0.32, 0.1], [0.24, 0.25], [0.13, 0.7], [0.27, 0.85], [0.2, 1.0], [0.16, 1.02], [0, 1.0]]), m.body);
        crown(g, m, 1.05, 0.2, 7, 0.22);
        add(g, sph(0.06, 10, 8), m.glow, 0, 1.12, 0);
    },
    wazir(g, m) {
        BUILD.pawn(g, m);
        add(g, cone(0.2, 0.34, 7), m.dark, 0, 0.98, 0);
        const t = add(g, new THREE.TorusGeometry(0.17, 0.03, 6, 14, Math.PI * 1.2), m.trim, 0, 0.3, 0.18); t.rotation.set(0.4, 0.6, 0);
    },
    alfil(g, m) {
        BUILD.pawn(g, m);
        const w1 = add(g, box(0.55, 0.04, 0.26), m.dark, -0.3, 0.7, 0.04); w1.rotation.set(0, 0, 0.5);
        const w2 = add(g, box(0.55, 0.04, 0.26), m.dark, 0.3, 0.7, 0.04); w2.rotation.set(0, 0, -0.5);
        add(g, cone(0.05, 0.2, 5), m.trim, 0, 0.72, -0.2).rotation.x = -Math.PI / 2;
        add(g, sph(0.03, 6, 6), m.glow, -0.07, 0.76, -0.14);
        add(g, sph(0.03, 6, 6), m.glow, 0.07, 0.76, -0.14);
    },
    rider(g, m) {
        g.scale.setScalar(1.08);
        add(g, lathe([[0.32, 0.1], [0.26, 0.2], [0.2, 0.5], [0.22, 0.65], [0, 0.65]]), m.body);
        horseHead(g, m, 0.7);
        const c = add(g, new THREE.TorusGeometry(0.2, 0.03, 8, 24, Math.PI * 1.3), m.glow, 0, 1.3, 0.1); c.rotation.set(0, 0, 0.9);
        add(g, box(0.5, 0.5, 0.02), m.dark, 0, 0.55, 0.3).rotation.x = 0.4;
    },
    cannon(g, m) {
        add(g, lathe([[0.36, 0.1], [0.3, 0.2], [0.28, 0.4], [0.2, 0.45], [0, 0.45]]), m.body);
        add(g, cyl(0.18, 0.18, 0.1, 12), m.trim, 0, 0.1, 0.12).rotation.z = Math.PI / 2;
        const h = new THREE.Group(); h.position.set(0, 0.55, 0); h.rotation.x = -0.7; g.add(h);
        add(h, cyl(0.15, 0.2, 0.75, 14), m.dark, 0, 0.2, 0);
        add(h, new THREE.TorusGeometry(0.16, 0.03, 6, 14), m.trim, 0, 0.5, 0).rotation.x = Math.PI / 2;
        add(h, cyl(0.1, 0.1, 0.04, 12), m.glow, 0, 0.58, 0);
    },
    dancer(g, m) {
        add(g, lathe([[0.1, 0.1], [0.12, 0.3], [0.1, 0.6], [0.15, 0.7], [0.08, 0.76], [0, 0.76]]), m.body);
        add(g, cone(0.34, 0.4, 14), m.body, 0, 0.32, 0).material = m.dark;
        add(g, sph(0.12), m.body, 0, 0.9, 0);
        const a1 = add(g, box(0.04, 0.4, 0.04), m.body, -0.2, 0.9, 0); a1.rotation.z = -0.7;
        const a2 = add(g, box(0.04, 0.4, 0.04), m.body, 0.2, 0.9, 0); a2.rotation.z = 0.7;
        add(g, new THREE.TorusGeometry(0.28, 0.02, 6, 24), m.glow, 0, 0.6, 0).rotation.x = Math.PI / 2.4;
    },
    hopper(g, m) {
        const b = add(g, sph(0.3, 16, 12), m.body, 0, 0.45, 0); b.scale.set(1, 0.85, 1.1);
        for (const [x, z] of [[-0.24, -0.14], [0.24, -0.14], [-0.24, 0.16], [0.24, 0.16]]) {
            const l = add(g, cyl(0.04, 0.05, 0.45, 6), m.dark, x, 0.25, z); l.rotation.z = x < 0 ? 0.5 : -0.5;
        }
        add(g, sph(0.07, 8, 8), m.glow, -0.1, 0.6, -0.24);
        add(g, sph(0.07, 8, 8), m.glow, 0.1, 0.6, -0.24);
        add(g, cone(0.06, 0.18, 5), m.trim, -0.14, 0.78, -0.06);
        add(g, cone(0.06, 0.18, 5), m.trim, 0.14, 0.78, -0.06);
    },
    witch(g, m) {
        add(g, lathe([[0.3, 0.1], [0.2, 0.25], [0.12, 0.55], [0.17, 0.7], [0.1, 0.78], [0, 0.78]]), m.body);
        add(g, cyl(0.38, 0.38, 0.03, 16), m.dark, 0, 0.9, 0);
        add(g, cone(0.2, 0.5, 10), m.dark, 0, 1.15, 0).rotation.z = 0.12;
        add(g, new THREE.TorusGeometry(0.2, 0.025, 6, 16), m.glow, 0, 0.95, 0).rotation.x = Math.PI / 2;
        add(g, cyl(0.02, 0.02, 1.1, 5), m.trim, 0.34, 0.55, 0);
        add(g, sph(0.06, 8, 8), m.glow, 0.34, 1.12, 0);
    },
    archbishop(g, m) {
        g.scale.set(1, 1.15, 1);
        BUILD.bishop(g, m);
        add(g, cone(0.12, 0.3, 4), m.trim, 0, 1.3, 0);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(g, sph(0.04, 6, 6), m.glow, Math.cos(a) * 0.32, 0.5 + i * 0.12, Math.sin(a) * 0.32); }
    },
    empress(g, m) {
        BUILD.rook(g, m);
        crown(g, m, 1.12, 0.2, 5, 0.2);
        add(g, sph(0.07, 10, 8), m.glow, 0, 1.2, 0);
    },
    champion(g, m) {
        BUILD.king(g, m);
        add(g, box(0.06, 0.5, 0.36), m.trim, -0.36, 0.6, -0.05);
        add(g, box(0.04, 0.8, 0.07), m.glow, 0.34, 0.8, -0.1).rotation.z = 0.15;
    },
    wraith(g, m) {
        const cloak = add(g, new THREE.ConeGeometry(0.4, 1.1, 14, 1, true), new THREE.MeshStandardMaterial({ map: m.body.map, color: m.body.color, emissiveMap: m.body.emissiveMap, emissive: m.body.emissive, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.6, 0);
        cloak.scale.set(1, 1, 0.9);
        add(g, sph(0.17, 12, 10), m.dark, 0, 1.05, 0);
        add(g, sph(0.04, 6, 6), m.glow, -0.07, 1.07, -0.14);
        add(g, sph(0.04, 6, 6), m.glow, 0.07, 1.07, -0.14);
    },
    gargoyle(g, m) {
        add(g, lathe([[0.32, 0.1], [0.28, 0.22], [0.22, 0.5], [0.16, 0.6], [0, 0.6]]), m.body);
        add(g, sph(0.17), m.body, 0, 0.75, 0);
        const w1 = add(g, box(0.5, 0.04, 0.32), m.dark, -0.34, 0.58, 0.1); w1.rotation.set(0.2, 0, 0.7);
        const w2 = add(g, box(0.5, 0.04, 0.32), m.dark, 0.34, 0.58, 0.1); w2.rotation.set(0.2, 0, -0.7);
        add(g, cone(0.045, 0.2, 5), m.trim, -0.1, 0.95, 0);
        add(g, cone(0.045, 0.2, 5), m.trim, 0.1, 0.95, 0);
        add(g, sph(0.035, 6, 6), m.glow, -0.06, 0.78, -0.14);
        add(g, sph(0.035, 6, 6), m.glow, 0.06, 0.78, -0.14);
    },
};

/** A piece: root (positioned by the view) → rig (turned to face) → parts, plus a gem and a health bar. */
export function makePiece(key, team, { bar = true } = {}) {
    const def = UNITS[key];
    const m = makeMaterials(def);
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const body = new THREE.Group();
    rig.add(body);
    (BUILD[def.model] || BUILD.pawn)(body, m);
    rig.rotation.y = team === 'e' ? Math.PI : 0;

    // base disc and the team ring
    const ring = team === 'e' ? 0xc2203a : 0xe8c46a;
    add(rig, cyl(0.4, 0.44, 0.1, 24), m.dark, 0, 0.05, 0);
    const rmat = new THREE.MeshStandardMaterial({ color: ring, emissive: ring, emissiveIntensity: 0.7, roughness: 0.4 });
    add(rig, new THREE.TorusGeometry(0.4, 0.025, 6, 32), rmat, 0, 0.1, 0).rotation.x = Math.PI / 2;

    const top = HEIGHT[def.model] ?? 1.1;
    const el = ELEMENTS[def.el];
    const gemMat = new THREE.MeshStandardMaterial({ color: el.color, emissive: el.color, emissiveIntensity: 1.6, roughness: 0.2, transparent: true, opacity: 0.95 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), gemMat);
    gem.scale.y = 1.4;
    gem.position.y = top + 0.22;
    root.add(gem);

    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: team === 'e' ? 0xd23a4a : 0x58d07a, depthTest: false, transparent: true }));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.12), new THREE.MeshBasicMaterial({ color: 0x08060a, depthTest: false, transparent: true, opacity: 0.85 }));
    const hp = new THREE.Group();
    hp.add(back, fill);
    hp.position.y = top + 0.52;
    back.renderOrder = 10; fill.renderOrder = 11;
    fill.position.z = 0.001;
    hp.visible = bar;
    root.add(hp);

    const mats = [];
    root.traverse((o) => { if (o.isMesh && o !== gem && o.parent !== hp) mats.push(o.material); });
    for (const mt of new Set(mats)) mt.userData.c0 = mt.color.clone();
    root.userData = { gem, gemMat, hp, fill, rig, body, top, mats: [...new Set(mats)], key, team, hpFrac: 1 };
    setHp(root, 1);
    return root;
}

export function setHp(root, frac) {
    const { fill } = root.userData;
    const f = Math.max(0.001, Math.min(1, frac));
    fill.scale.set(0.68 * f, 0.07, 1);
    fill.position.x = -0.34 * (1 - f);
    fill.material.color.setHex(f > 0.5 ? (root.userData.team === 'e' ? 0xd23a4a : 0x58d07a) : f > 0.25 ? 0xe0b040 : 0xe03030);
    root.userData.hpFrac = f;
}

/** Grey a piece that has acted. */
export function setSpent(root, spent) {
    for (const mt of root.userData.mats) {
        if (!mt.userData.c0) continue;
        mt.color.copy(mt.userData.c0);
        if (spent) mt.color.multiplyScalar(0.45);
    }
    root.userData.gemMat.opacity = spent ? 0.35 : 0.95;
}

export function disposeTree(o) {
    o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((mt) => mt.dispose());
    });
}
