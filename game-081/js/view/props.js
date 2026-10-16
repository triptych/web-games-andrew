// Furniture and dungeon dressing, built in code. Each builder returns a Group standing on y = 0 at
// the centre of its cell (cells are 2 m), facing +z, with optional userData.update(t, state).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';
import { glow } from './textures.js';
import { glowMaterial, fireMaterial } from './shaders.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
const lit = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

let woodM = null, darkWoodM = null, brassM = null, ironM = null;
function mats() {
    if (woodM) return;
    woodM = TX.texMat(TX.planks, { color: 0xffffff, rough: 0.75, repeat: [0.5, 0.5] });
    darkWoodM = TX.texMat(TX.planks, { color: 0x8a6a58, rough: 0.8, repeat: [0.5, 0.5] });
    brassM = std(0xc8962e, { metal: 0.85, rough: 0.32 });
    ironM = std(0x3a3a40, { metal: 0.7, rough: 0.5 });
}

function m(geo, mat, pos, rot, scale) {
    const o = new THREE.Mesh(geo, mat);
    if (pos) o.position.copy(pos);
    if (rot) o.rotation.set(...rot);
    if (scale) o.scale.set(...scale);
    o.castShadow = true; o.receiveShadow = true;
    return o;
}
const box = (w, h, d, mat, pos, rot) => m(new THREE.BoxGeometry(w, h, d), mat, pos, rot);
const rbox = (w, h, d, mat, pos, rot) => m(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.15), mat, pos, rot);

/** A candle flame: a little lit cone plus a glow sprite. */
export function flame(size = 1, color = [2, 1.2, 0.4]) {
    const g = new THREE.Group();
    const f = m(new THREE.ConeGeometry(0.025 * size, 0.08 * size, 8), lit(...color), V(0, 0.04 * size, 0));
    f.castShadow = false;
    g.add(f);
    const s = new THREE.Sprite(glowMaterial(glow(), new THREE.Color(color[0] / 2, color[1] / 2, color[2] / 2), 0.7));
    s.scale.setScalar(0.35 * size);
    s.position.y = 0.05 * size;
    g.add(s);
    g.userData.update = (t) => { f.scale.y = 1 + Math.sin(t * 13 + g.id) * 0.18; f.scale.x = 1 + Math.sin(t * 7 + g.id) * 0.08; };
    return g;
}

function candle(h = 0.2) {
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.03, 0.035, h, 10), std(0xf2e8d0, { rough: 0.6 }), V(0, h / 2, 0)));
    const f = flame(1); f.position.y = h; g.add(f);
    g.userData.update = f.userData.update;
    return g;
}

// ------------------------------------------------------------------ clinic

function bench() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.7, 0.08, 0.5, woodM, V(0, 0.45, 0)));
    g.add(rbox(1.7, 0.4, 0.06, woodM, V(0, 0.8, -0.24)));
    for (const x of [-0.75, 0.75]) for (const z of [-0.2, 0.2]) g.add(box(0.07, 0.45, 0.07, darkWoodM, V(x, 0.22, z)));
    return g;
}

function desk() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(2.0, 1.0, 1.0, darkWoodM, V(0, 0.5, 0)));
    g.add(rbox(2.1, 0.08, 1.15, woodM, V(0, 1.04, 0)));
    // ledger, inkpot, a bell and a sign
    g.add(box(0.5, 0.06, 0.36, std(0x6a2a20), V(-0.4, 1.11, 0.1), [0, 0.2, 0]));
    g.add(box(0.48, 0.02, 0.34, std(0xf0e6c8), V(-0.4, 1.15, 0.1), [0, 0.2, 0]));
    g.add(m(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), std(0x1a1a2a, { rough: 0.2 }), V(0.3, 1.12, 0.2)));
    g.add(m(new THREE.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brassM, V(0.6, 1.08, 0.25)));
    const c = candle(0.18); c.position.set(0.85, 1.08, -0.2); g.add(c);
    g.userData.update = c.userData.update;
    return g;
}

function plant() {
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 14), std(0xa85a3a, { rough: 0.9 }), V(0, 0.25, 0)));
    for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const leaf = m(new THREE.SphereGeometry(0.22, 10, 6), std(0x3a7a3a, { rough: 0.8 }), V(Math.cos(a) * 0.18, 0.75 + (i % 3) * 0.18, Math.sin(a) * 0.18), [0.4 * Math.cos(a), a, 0], [0.5, 1.4, 0.2]);
        g.add(leaf);
    }
    // moonflowers that glow faintly
    for (let i = 0; i < 4; i++) g.add(m(new THREE.SphereGeometry(0.06, 8, 6), std(0xe8e0ff, { emissive: 0x8a7aff, ei: 0.8 }), V(Math.cos(i * 1.6) * 0.25, 1.15 + (i % 2) * 0.1, Math.sin(i * 1.6) * 0.25)));
    return g;
}

/**
 * A fireplace built into the wall behind it (the cell's back edge is z = −1): a stone surround with
 * a recessed firebox, a mantel, a chimney breast up to the ceiling, a hearthstone, andirons, logs,
 * glowing embers and a shader fire.
 */
function hearth(ceiling = 3.4) {
    const g = new THREE.Group();
    // stone sized to each part, so a block is about 0.4 × 0.2 m everywhere (one texture tile is 0.8 m)
    const stone = (w, h) => TX.texMat(TX.blocks, { color: 0xc8b49a, repeat: [w / 0.8, h / 0.8] });
    const stoneDark = (w, h) => TX.texMat(TX.blocks, { color: 0x6a5a4a, repeat: [w / 0.8, h / 0.8] });
    const soot = std(0x120c0a, { rough: 1 });
    const iron = std(0x2a2624, { metal: 0.7, rough: 0.5 });
    const W = 1.9, D = 0.62, back = -1.0, front = back + D;
    const openW = 1.0, openH = 0.9;
    // surround: two jambs and a lintel framing the opening
    const jambW = (W - openW) / 2;
    for (const s of [-1, 1]) g.add(box(jambW, openH, D, stone(jambW, openH), V(s * (openW / 2 + jambW / 2), openH / 2, back + D / 2)));
    g.add(box(W, 0.32, D, stone(W, 0.32), V(0, openH + 0.16, back + D / 2)));
    // the firebox: a sooty recess with a back wall and splayed sides
    g.add(box(openW, openH, 0.06, soot, V(0, openH / 2, back + 0.03)));
    for (const s of [-1, 1]) g.add(box(0.05, openH, D - 0.08, soot, V(s * (openW / 2 - 0.02), openH / 2, back + D / 2 - 0.02)));
    g.add(box(openW, 0.05, D - 0.06, soot, V(0, openH - 0.025, back + D / 2)));
    g.add(box(openW, 0.04, D, stoneDark(openW, D), V(0, 0.02, back + D / 2)));
    // mantel shelf with a candle and a jar of moonflowers
    g.add(rbox(W + 0.25, 0.1, D + 0.18, woodMat(), V(0, openH + 0.37, back + (D + 0.18) / 2)));
    const c1 = candle(0.2); c1.position.set(-0.7, openH + 0.42, front - 0.05); g.add(c1);
    const c2 = candle(0.14); c2.position.set(-0.55, openH + 0.42, front - 0.12); g.add(c2);
    g.add(m(new THREE.CylinderGeometry(0.07, 0.06, 0.2, 12), new THREE.MeshPhysicalMaterial({ color: 0x9ad0c0, roughness: 0.1, transparent: true, opacity: 0.6, clearcoat: 1 }), V(0.62, openH + 0.52, front - 0.08)));
    for (let i = 0; i < 3; i++) g.add(m(new THREE.SphereGeometry(0.05, 8, 6), std(0xe8e0ff, { emissive: 0x8a7aff, ei: 0.8 }), V(0.62 + (i - 1) * 0.05, openH + 0.7 + (i % 2) * 0.05, front - 0.08)));
    // chimney breast up to the ceiling
    const breastH = ceiling - (openH + 0.42);
    g.add(box(W - 0.3, breastH, D - 0.12, stone(W - 0.3, breastH), V(0, openH + 0.42 + breastH / 2, back + (D - 0.12) / 2)));
    // hearthstone on the floor in front
    g.add(rbox(W + 0.2, 0.06, 0.55, stoneDark(W + 0.2, 0.55), V(0, 0.03, front + 0.27)));
    // andirons and logs
    for (const s of [-1, 1]) {
        g.add(box(0.04, 0.22, 0.04, iron, V(s * 0.3, 0.13, front - 0.12)));
        g.add(box(0.04, 0.04, 0.42, iron, V(s * 0.3, 0.06, back + D / 2)));
    }
    const logM = TX.texMat(TX.bark, { repeat: [1, 1] });
    const logs = [[0, 0.12, back + 0.32, 0.12, 0.06], [0.02, 0.2, back + 0.36, -0.1, 0.055], [-0.05, 0.13, back + 0.22, 0.3, 0.05]];
    for (const [x, y, z, rz, r] of logs) {
        const l = m(new THREE.CylinderGeometry(r, r * 1.1, 0.78, 10), logM, V(x, y, z), [0, 0, Math.PI / 2]);
        l.rotation.y = rz;
        g.add(l);
    }
    // glowing embers on the firebox floor
    const embers = m(new THREE.PlaneGeometry(openW - 0.15, D - 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.35, 0.05) }), V(0, 0.045, back + D / 2), [-Math.PI / 2, 0, 0]);
    embers.castShadow = false;
    g.add(embers);
    // the fire: three crossed flame sheets
    const fire = new THREE.Group(); fire.position.set(0, 0.1, back + 0.3); g.add(fire);
    const sheets = [];
    for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.78 - i * 0.12, 0.78 - i * 0.1), fireMaterial(i * 1.37, 1 - i * 0.15));
        f.position.y = (0.78 - i * 0.1) / 2;
        f.rotation.y = (i - 1) * 0.7;
        f.renderOrder = 4;
        f.castShadow = false;
        fire.add(f); sheets.push(f);
    }
    const glowS = new THREE.Sprite(glowMaterial(glow(), new THREE.Color(1.2, 0.5, 0.12), 0.55));
    glowS.scale.set(1.6, 1.1, 1); glowS.position.set(0, 0.45, back + 0.4); g.add(glowS);
    const light = new THREE.PointLight(0xff8a3a, 3.2, 10, 1.6);
    light.position.set(0, 0.55, front + 0.4);
    g.add(light);
    g.userData.update = (t) => {
        c1.userData.update(t); c2.userData.update(t);
        const k = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23 + 1.3) * 0.06 + Math.sin(t * 3.1) * 0.05;
        light.intensity = 3.2 * k;
        glowS.material.opacity = 0.45 * k;
        embers.material.color.setRGB(1.4 * k, 0.35 * k, 0.05);
    };
    return g;
}

const woodMat = () => { mats(); return woodM; };

function cot() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.0, 0.35, 1.9, darkWoodM, V(0, 0.25, 0)));
    g.add(rbox(0.92, 0.16, 1.8, std(0xe8e0d0, { rough: 1 }), V(0, 0.5, 0)));
    g.add(rbox(0.94, 0.08, 1.2, std(0x5a3a7a, { rough: 1 }), V(0, 0.6, 0.3)));
    g.add(rbox(0.6, 0.14, 0.32, std(0xf4f0e8, { rough: 1 }), V(0, 0.64, -0.7)));
    return g;
}

function grimoire() {
    mats();
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.12, 0.25, 1.0, 8), darkWoodM, V(0, 0.5, 0)));
    g.add(rbox(0.7, 0.06, 0.5, woodM, V(0, 1.02, 0), [-0.4, 0, 0]));
    const book = new THREE.Group(); book.position.set(0, 1.1, 0.02); book.rotation.x = -0.4; g.add(book);
    for (const s of [-1, 1]) book.add(box(0.28, 0.03, 0.4, std(0xf0e6c8), V(0.15 * s, 0.02, 0), [0, 0, s * 0.08]));
    book.add(box(0.6, 0.02, 0.42, std(0x5a1a2a), V(0, -0.01, 0)));
    const runes = new THREE.Group(); book.add(runes);
    for (let i = 0; i < 5; i++) {
        const r = m(new THREE.TorusGeometry(0.05 + i * 0.012, 0.004, 4, 20), lit(0.8, 1.6, 0.9), V(0, 0.15 + i * 0.07, 0), [Math.PI / 2, 0, 0]);
        r.castShadow = false;
        runes.add(r);
    }
    const light = new THREE.PointLight(0x9affb0, 0.8, 3); light.position.set(0, 1.5, 0.2); g.add(light);
    g.userData.update = (t, st) => {
        runes.rotation.y = t * 0.8;
        runes.children.forEach((r, i) => { r.position.y = 0.12 + ((t * 0.15 + i * 0.2) % 1) * 0.35; r.material.opacity = 1; });
        runes.visible = !!st?.points;
        light.intensity = st?.points ? 1.0 + Math.sin(t * 3) * 0.4 : 0.25;
    };
    return g;
}

function bottleShelf(w = 1.8, fancy = false) {
    mats();
    const g = new THREE.Group();
    g.add(box(w, 2.3, 0.08, darkWoodM, V(0, 1.15, -0.92)));
    for (const s of [-1, 1]) g.add(box(0.08, 2.3, 0.5, darkWoodM, V(s * (w / 2 - 0.04), 1.15, -0.68)));
    g.add(box(w, 0.08, 0.5, darkWoodM, V(0, 2.3, -0.68)));
    const colors = [0x6ae0a0, 0xff6a8a, 0x8ab0ff, 0xffd060, 0xb07aff, 0xff9a4a];
    for (let s = 0; s < 4; s++) {
        g.add(box(w - 0.1, 0.04, 0.46, woodM, V(0, 0.35 + s * 0.5, -0.68)));
        for (let i = 0; i < 6; i++) {
            const c = colors[(i + s * 2) % colors.length];
            const h = 0.14 + ((i * 7 + s) % 3) * 0.05;
            const shape = (i + s) % 3;
            const geo = shape === 0 ? new THREE.CylinderGeometry(0.05, 0.06, h, 10) : shape === 1 ? new THREE.SphereGeometry(0.07, 10, 8) : new THREE.ConeGeometry(0.07, h, 8);
            const b = m(geo, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.1, transparent: true, opacity: 0.88, emissive: c, emissiveIntensity: fancy ? 0.7 : 0.3, clearcoat: 1 }), V(-w / 2 + 0.22 + i * (w - 0.44) / 5, 0.37 + s * 0.5 + (shape === 1 ? 0.07 : h / 2), -0.62));
            g.add(b);
            if (shape !== 1) g.add(m(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6), std(0x8a5a2a), V(b.position.x, 0.37 + s * 0.5 + h + 0.02, -0.62)));
        }
    }
    if (fancy) { const sign = m(new THREE.BoxGeometry(0.9, 0.3, 0.04), std(0x3a2418), V(0, 2.55, -0.85)); g.add(sign); const l = new THREE.PointLight(0xffd090, 0.6, 3); l.position.set(0, 1.6, 0); g.add(l); }
    return g;
}

function examTable() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.0, 0.12, 1.9, darkWoodM, V(0, 0.75, 0)));
    g.add(rbox(0.9, 0.1, 1.8, std(0xe8ecf0, { rough: 0.9 }), V(0, 0.85, 0)));
    for (const x of [-0.42, 0.42]) for (const z of [-0.85, 0.85]) g.add(m(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 8), brassM, V(x, 0.37, z)));
    return g;
}

/** The Lumen Lens: a great crystal on a brass stand, with Pip living inside. */
function lens() {
    mats();
    const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(0.3, 0.42, 0.2, 16), brassM, V(0, 0.1, 0)));
    g.add(m(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 10), brassM, V(0, 0.75, 0)));
    const ring = m(new THREE.TorusGeometry(0.45, 0.04, 10, 36), brassM, V(0, 1.75, 0));
    g.add(ring);
    const crystal = m(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshPhysicalMaterial({ color: 0x9ae8ff, roughness: 0.05, metalness: 0, clearcoat: 1, iridescence: 1, transparent: true, opacity: 0.55, emissive: 0x2a8acf, emissiveIntensity: 0.5 }), V(0, 1.75, 0), null, [0.8, 1.2, 0.8]);
    g.add(crystal);
    const core = new THREE.Sprite(glowMaterial(glow(), new THREE.Color(0.5, 0.9, 1.2), 0.9));
    core.scale.setScalar(0.9); core.position.y = 1.75; g.add(core);
    const light = new THREE.PointLight(0x7ad8ff, 1.6, 6); light.position.y = 1.75; g.add(light);
    g.userData.update = (t, st) => {
        crystal.rotation.y = t * 0.5;
        ring.rotation.x = Math.sin(t * 0.7) * 0.3; ring.rotation.y = t * 0.4;
        const on = st?.ready ? 1 : 0.4;
        core.material.opacity = (0.5 + Math.sin(t * 3) * 0.2) * on + 0.2;
        light.intensity = 1.0 + on * 1.2;
    };
    return g;
}

function door() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.3, 2.4, 0.16, darkWoodM, V(0, 1.2, 0.85)));
    g.add(m(new THREE.TorusGeometry(0.08, 0.015, 8, 16), brassM, V(0.4, 1.15, 0.95)));
    const lan = new THREE.Group(); lan.position.set(-0.85, 2.0, 0.7); g.add(lan);
    lan.add(m(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 6, 1, true), ironM));
    const f = flame(1.8); f.position.y = -0.06; lan.add(f);
    g.userData.update = f.userData.update;
    return g;
}

/** The cart you ride on calls. */
function cart() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.4, 0.5, 1.8, woodM, V(0, 0.7, 0)));
    for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) g.add(m(new THREE.TorusGeometry(0.35, 0.06, 8, 16), darkWoodM, V(0.72 * s, 0.38, z), [0, Math.PI / 2, 0]));
    g.add(m(new THREE.CylinderGeometry(0.85, 0.85, 1.7, 16, 1, true, 0, Math.PI), std(0xd8c8a0, { rough: 1, side: THREE.DoubleSide }), V(0, 1.0, 0), [Math.PI / 2, 0, 0]).rotateZ(Math.PI / 2));
    const lan = new THREE.Group(); lan.position.set(0.7, 1.6, 0.9); g.add(lan);
    const f = flame(2.2); lan.add(f);
    const light = new THREE.PointLight(0xffb060, 1.4, 6); lan.add(light);
    g.userData.update = f.userData.update;
    return g;
}

// ------------------------------------------------------------------ quests

function chest() {
    mats();
    const g = new THREE.Group();
    g.add(rbox(1.0, 0.55, 0.65, woodM, V(0, 0.28, 0)));
    for (const x of [-0.35, 0.35]) g.add(box(0.06, 0.57, 0.67, brassM, V(x, 0.28, 0)));
    const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.32); g.add(lid);
    const top = m(new THREE.CylinderGeometry(0.32, 0.32, 1.0, 16, 1, false, 0, Math.PI), woodM, V(0, 0, 0.32), [0, 0, Math.PI / 2]);
    top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    lid.add(top);
    const shine = new THREE.Sprite(glowMaterial(glow(), new THREE.Color(1.2, 0.95, 0.4), 0));
    shine.scale.setScalar(1.2); shine.position.y = 0.7; g.add(shine);
    let o = 0;
    g.userData.update = (t, st) => {
        o += ((st?.open ? 1 : 0) - o) * 0.08;
        lid.rotation.x = -o * 1.6;
        shine.material.opacity = st?.open ? Math.max(0, 1 - o) * 0.8 : 0.15 + Math.sin(t * 2) * 0.1;
    };
    return g;
}

function trap(theme) {
    const g = new THREE.Group();
    const gold = std(0xd8a838, { metal: 0.9, rough: 0.3 });
    let spin = null;
    if (theme === 'forest') {
        for (let i = 0; i < 5; i++) {
            const t = m(new THREE.TorusGeometry(0.6 + (i % 2) * 0.1, 0.02, 4, 40), std(0x8a8a90, { metal: 0.8, rough: 0.35 }), V(0, 0.5 + i * 0.25, 0), [Math.PI / 2 + (i - 2) * 0.12, 0, i * 0.4], [1, 1, 0.6]);
            g.add(t);
            for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(m(new THREE.ConeGeometry(0.02, 0.1, 4), std(0xa0a0a8, { metal: 0.8, rough: 0.3 }), V(Math.cos(a) * 0.6, 0.5 + i * 0.25, Math.sin(a) * 0.36), [0, 0, a])); }
        }
    } else if (theme === 'crypt') {
        const ward = m(new THREE.RingGeometry(0.5, 0.85, 6), lit(1.4, 0.4, 2.0), V(0, 0.03, 0), [-Math.PI / 2, 0, 0]);
        ward.castShadow = false;
        g.add(ward);
        spin = new THREE.Group(); g.add(spin);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = m(new THREE.OctahedronGeometry(0.1), lit(1.4, 0.5, 2.2), V(Math.cos(a) * 0.7, 1.0, Math.sin(a) * 0.7)); p.castShadow = false; spin.add(p); }
        const wall = m(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 24, 1, true), std(0x9a50ff, { emissive: 0x6a2aff, ei: 0.6, transparent: true, opacity: 0.18, side: THREE.DoubleSide }), V(0, 1.1, 0));
        wall.castShadow = false;
        g.add(wall);
    } else if (theme === 'forge') {
        g.add(box(1.8, 0.2, 1.8, std(0x2a2a2e, { metal: 0.6, rough: 0.5 }), V(0, 0.1, 0)));
        for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.add(m(new THREE.ConeGeometry(0.07, 0.7, 6), gold, V(x * 0.33, 0.55, z * 0.33)));
    } else {
        // a gilded snare with a bell, slung across the hall
        g.add(m(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), std(0x6a4a2a), V(0, 1.0, 0), [0, 0, Math.PI / 2]));
        g.add(m(new THREE.TorusGeometry(0.4, 0.025, 6, 24), gold, V(0, 0.55, 0), [0, 0, 0]));
        g.add(m(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), gold, V(0, 0.95, 0.05)));
        for (const s of [-1, 1]) g.add(m(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), std(0x3a2a20), V(0.95 * s, 1.2, 0)));
        g.add(m(new THREE.BoxGeometry(0.4, 0.25, 0.04), gold, V(0, 1.35, 0.06)));
    }
    let gone = 0;
    g.userData.update = (t, st) => {
        if (spin) spin.rotation.y = t * 0.8;
        gone += ((st?.disarmed ? 1 : 0) - gone) * 0.1;
        g.scale.setScalar(Math.max(0.001, 1 - gone));
        g.visible = gone < 0.98;
    };
    return g;
}

function gate(theme) {
    const g = new THREE.Group();
    const inner = new THREE.Group(); g.add(inner);
    if (theme === 'forest') {
        for (let i = 0; i < 18; i++) {
            const a = i * 1.7;
            const pts = [V(Math.sin(a) * 0.8, 0, 0), V(Math.sin(a + 1) * 0.6, 1.2, 0.2), V(Math.sin(a + 2) * 0.8, 2.6, -0.1), V(Math.sin(a + 3) * 0.4, 3.6, 0)];
            const c = new THREE.CatmullRomCurve3(pts);
            const t = m(new THREE.TubeGeometry(c, 20, 0.06, 6), std(0x3a2a14, { rough: 1 }));
            inner.add(t);
            for (let k = 0; k < 6; k++) { const p = c.getPointAt(k / 6 + 0.05); inner.add(m(new THREE.ConeGeometry(0.03, 0.14, 4), std(0x5a4a2a), p, [Math.random() * 3, 0, Math.random() * 3])); }
        }
    } else if (theme === 'crypt') {
        inner.add(box(1.9, 3.6, 0.3, TX.texMat(TX.blocks, { color: 0x6a7080, repeat: [1, 1.5] }), V(0, 1.8, 0)));
        for (let i = 0; i < 3; i++) { const r = m(new THREE.TorusGeometry(0.3 + i * 0.15, 0.02, 4, 6), lit(1.2, 0.4, 2), V(0, 1.8, 0.17)); r.castShadow = false; inner.add(r); }
    } else if (theme === 'forge') {
        const iron = std(0x2a2a30, { metal: 0.8, rough: 0.45 });
        inner.add(box(1.95, 4.5, 0.4, iron, V(0, 2.25, 0)));
        for (let y = 0; y < 5; y++) inner.add(box(1.98, 0.12, 0.45, std(0xc87a20, { metal: 0.8, rough: 0.3 }), V(0, 0.5 + y * 0.9, 0)));
    } else {
        mats();
        inner.add(box(1.95, 4.2, 0.25, darkWoodM, V(0, 2.1, 0)));
        inner.add(box(1.98, 0.15, 0.3, std(0xd8a838, { metal: 0.9, rough: 0.3 }), V(0, 3.9, 0)));
        const rune = m(new THREE.CircleGeometry(0.4, 6), lit(1.8, 0.3, 1.6), V(0, 2.1, 0.14));
        rune.castShadow = false;
        inner.add(rune);
    }
    let open = 0;
    g.userData.update = (t, st) => {
        open += ((st?.open ? 1 : 0) - open) * 0.03;
        inner.position.y = -open * 4.6;
        inner.visible = open < 0.99;
    };
    return g;
}

function evidence() {
    const g = new THREE.Group();
    const book = new THREE.Group(); book.position.y = 0.9; g.add(book);
    book.add(box(0.35, 0.08, 0.45, std(0x2a1a14, { rough: 0.6 })));
    book.add(box(0.33, 0.06, 0.43, std(0xf0e6c8), V(0.01, 0, 0)));
    book.add(box(0.1, 0.09, 0.1, std(0xd8a838, { metal: 0.9, rough: 0.3 }), V(0, 0.01, 0.18)));
    const s = new THREE.Sprite(glowMaterial(glow(), new THREE.Color(1.2, 1.0, 0.5), 0.8));
    s.scale.setScalar(1.0); s.position.y = 0.9; g.add(s);
    g.add(m(new THREE.CylinderGeometry(0.2, 0.3, 0.8, 8), TX.texMat(TX.marble, { repeat: [0.5, 0.5] }), V(0, 0.4, 0)));
    g.userData.update = (t) => { book.rotation.y = t; book.position.y = 1.0 + Math.sin(t * 2) * 0.05; s.material.opacity = 0.6 + Math.sin(t * 4) * 0.3; };
    return g;
}

// ------------------------------------------------------------------ themed blockers

export function pillar(theme) {
    const g = new THREE.Group();
    if (theme === 'forest') {
        g.add(m(new THREE.DodecahedronGeometry(0.9, 1), TX.texMat(TX.rock, { repeat: [0.6, 0.6] }), V(0, 0.55, 0), [0.3, 0.6, 0], [1, 0.75, 1]));
        return g;
    }
    const mat = theme === 'forge' ? TX.texMat(TX.basalt, { repeat: [0.6, 2], emissive: 0xffffff, emissiveIntensity: 0.6 }) :
        theme === 'citadel' ? TX.texMat(TX.marble, { repeat: [0.6, 2] }) : TX.texMat(TX.blocks, { color: 0x8a90a0, repeat: [0.6, 2] });
    const h = theme === 'forge' ? 6 : theme === 'citadel' ? 5.5 : 4;
    const seg = theme === 'forge' ? 6 : 16;
    g.add(m(new THREE.CylinderGeometry(0.42, 0.48, h, seg), mat, V(0, h / 2, 0)));
    g.add(m(new THREE.CylinderGeometry(0.6, 0.6, 0.3, seg), mat, V(0, 0.15, 0)));
    g.add(m(new THREE.CylinderGeometry(0.6, 0.5, 0.3, seg), mat, V(0, h - 0.15, 0)));
    if (theme === 'crypt') { const c = candle(0.25); c.position.set(0.3, 0.3, 0.45); g.add(c); g.userData.update = c.userData.update; }
    return g;
}

const barkMat = () => TX.texMat(TX.bark, { repeat: [1, 3] });
export function tree(theme, seed = 0) {
    const g = new THREE.Group();
    if (theme === 'forest') {
        const h = 6 + (seed % 3);
        g.add(m(new THREE.CylinderGeometry(0.28, 0.45, h, 10), barkMat(), V(0, h / 2, 0)));
        for (let i = 0; i < 3; i++) g.add(m(new THREE.CylinderGeometry(0.06, 0.2, 1.2, 6), barkMat(), V(Math.cos(i * 2.1) * 0.45, 0.25, Math.sin(i * 2.1) * 0.45), [Math.sin(i * 2.1) * 1.2, 0, -Math.cos(i * 2.1) * 1.2]));
        const leafM = new THREE.MeshStandardMaterial({ color: 0x2a4a1e, roughness: 0.9, flatShading: true });
        for (let i = 0; i < 4; i++) g.add(m(new THREE.IcosahedronGeometry(1.4 - i * 0.18, 1), leafM, V(Math.cos(i * 1.9 + seed) * 0.5, h - 0.6 + i * 0.6, Math.sin(i * 1.9 + seed) * 0.5)));
        if (seed % 2 === 0) for (let i = 0; i < 3; i++) g.add(m(new THREE.SphereGeometry(0.1, 8, 6), std(0xe8f0a0, { emissive: 0x9aff6a, ei: 1.2 }), V(Math.cos(i * 2) * 0.5, 0.15, Math.sin(i * 2) * 0.5)));
        return g;
    }
    if (theme === 'forge') {
        g.add(m(new THREE.ConeGeometry(0.7, 3.5, 7), TX.texMat(TX.basalt, { repeat: [1, 2], emissive: 0xffffff, emissiveIntensity: 0.6 }), V(0, 1.75, 0)));
        return g;
    }
    return pillar(theme);
}

// ------------------------------------------------------------------ dressing

export function wallLantern(color = [2, 1.3, 0.5]) {
    mats();
    const g = new THREE.Group();
    g.add(box(0.05, 0.3, 0.05, ironM, V(0, 0, -0.05)));
    g.add(m(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 6, 1, true), ironM, V(0, -0.1, 0.12)));
    const f = flame(1.6, color); f.position.set(0, -0.15, 0.12); g.add(f);
    g.userData.update = f.userData.update;
    return g;
}

export function banner(color = 0x4a1a6a) {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1.0, 2.4, 1, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -1.1) p.setY(i, p.getY(i) - Math.abs(p.getX(i)) * 0.4);
    const cloth = new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.3), side: THREE.DoubleSide });
    const b = m(geo, cloth);
    g.add(b);
    const sym = m(new THREE.CircleGeometry(0.22, 24), std(0xd8a838, { metal: 0.8, rough: 0.3, emissive: 0x6a4a10, ei: 0.4 }), V(0, 0.4, 0.01));
    g.add(sym);
    g.add(m(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), std(0xd8a838, { metal: 0.9, rough: 0.3 }), V(0, 1.22, 0), [0, 0, Math.PI / 2]));
    g.userData.update = (t) => { b.rotation.x = Math.sin(t * 0.8 + g.id) * 0.04; };
    return g;
}

export function chandelier() {
    const g = new THREE.Group();
    const iron = std(0x2a2a30, { metal: 0.7, rough: 0.5 });
    g.add(m(new THREE.TorusGeometry(0.8, 0.04, 6, 32), iron, V(0, 0, 0), [Math.PI / 2, 0, 0]));
    g.add(m(new THREE.CylinderGeometry(0.015, 0.015, 2, 4), iron, V(0, 1, 0)));
    const fl = [];
    for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const c = candle(0.18); c.position.set(Math.cos(a) * 0.8, 0.02, Math.sin(a) * 0.8); g.add(c); fl.push(c);
    }
    g.userData.update = (t) => fl.forEach((c) => c.userData.update(t));
    return g;
}

export function mushroomCluster(seed = 0) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const h = 0.15 + ((seed + i) % 3) * 0.08;
        const x = Math.cos(i * 2.3 + seed) * 0.2, z = Math.sin(i * 2.3 + seed) * 0.2;
        g.add(m(new THREE.CylinderGeometry(0.02, 0.03, h, 6), std(0xe8e0c8), V(x, h / 2, z)));
        const c = (seed + i) % 2 ? 0x6ae0ff : 0xc08aff;
        g.add(m(new THREE.SphereGeometry(0.07 + ((seed + i) % 2) * 0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(c, { emissive: c, ei: 0.9 }), V(x, h, z)));
    }
    return g;
}

export const PROPS = {
    bench, desk, plant, hearth, cot, grimoire, herbshelf: () => bottleShelf(1.8, false), shop: () => bottleShelf(1.8, true),
    table: examTable, lens, door, cart, chest, trap, gate, evidence,
};
