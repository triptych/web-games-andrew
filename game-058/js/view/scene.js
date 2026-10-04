/**
 * scene.js — renderer, camera, lights, the meadow around the blanket and the
 * blanket itself. Exports live bindings used by the other view modules.
 *
 * The camera looks down at the blanket from the near side. fitBoard() picks
 * the camera distance and a setViewOffset() shift so the blanket (plus the
 * basket) lands inside the screen area the HUD leaves free.
 */

import * as THREE from 'three';
import { ROWS, COLS } from '../sim/game.js';
import { GARDENS, MASKS } from '../config.js';

// Older mobile Safari has no canvas roundRect; square corners are fine there.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}

export let renderer, scene, camera;
export const clock = new THREE.Clock();
export const boardRoot = new THREE.Group();
export const BASKET_POS = new THREE.Vector3(0, 0, ROWS / 2 + 1.05);

const CAM_DIR = new THREE.Vector3(0, Math.sin(1.0), Math.cos(1.0)).normalize();   // ~57° down
let sun, hemi;
let decor = null, blanket = null, ground = null;
let fancy = true;
let freeRect = null;
let animTime = 0;
let basketSide = false;
const swayers = [];   // decor that sways: { obj, base, amp, speed, phase }
const flyers = [];    // butterflies

export function cellToWorld(r, c, out = new THREE.Vector3()) {
    return out.set(c - (COLS - 1) / 2, 0, r - (ROWS - 1) / 2);
}

export function initScene(canvas, opts = {}) {
    fancy = opts.fancy ?? true;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyQuality(fancy);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9edc6a);
    scene.fog = new THREE.Fog(0xbfe8a0, 30, 60);

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 120);

    hemi = new THREE.HemisphereLight(0xeaf6ff, 0x6a9a4a, 1.25);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
    sun.position.set(4.5, 11, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -7; s.right = 7; s.top = 7; s.bottom = -7; s.near = 2; s.far = 30;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun);
    scene.add(sun.target);

    scene.add(boardRoot);
    buildGround();
    resize();
}

export function applyQuality(isFancy) {
    fancy = isFancy;
    if (!renderer) return;
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, isFancy ? 2 : 1.25));
    renderer.shadowMap.enabled = isFancy;
    if (scene) scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    if (renderer.domElement) renderer.setSize(window.innerWidth, window.innerHeight, false);
}

export function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    fitBoard(freeRect);
}

/**
 * Fit the blanket into a screen rect { left, top, right, bottom } in CSS px.
 * Binary-search the camera distance until the projected board fits, then
 * shift the projection so its centre sits in the middle of the rect.
 */
export function fitBoard(rect) {
    freeRect = rect;
    const W = window.innerWidth, H = window.innerHeight;
    const r = rect ?? { left: 0, top: 0, right: W, bottom: H };
    const fw = Math.max(80, r.right - r.left), fh = Math.max(80, r.bottom - r.top);
    const target = new THREE.Vector3(0, 0, 0.35);
    // The basket sits below the blanket, or beside it on wide screens.
    const hw = COLS / 2 + 0.25, hz0 = -ROWS / 2 - 0.35, hz1 = basketSide ? ROWS / 2 + 0.45 : ROWS / 2 + 1.6;
    const xr = basketSide ? COLS / 2 + 2.15 : hw;
    const corners = [
        [-hw, 0.9, hz0], [xr, 0.9, hz0], [-hw, 0, hz1], [xr, 0, hz1],
        [-hw, 0, hz0], [xr, 0, hz0], [-hw, 0.9, hz1 - 0.6], [xr, 0.9, hz1 - 0.6],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    camera.clearViewOffset();
    const v = new THREE.Vector3();
    const measure = (d) => {
        camera.position.copy(target).addScaledVector(CAM_DIR, d);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of corners) {
            v.copy(c).project(camera);
            const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        return { x0, x1, y0, y1 };
    };
    let lo = 4, hi = 120, box = null;
    for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        box = measure(mid);
        if (box.x1 - box.x0 <= fw * 0.96 && box.y1 - box.y0 <= fh * 0.96) hi = mid; else lo = mid;
    }
    box = measure(hi);
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const tx = (r.left + r.right) / 2, ty = (r.top + r.bottom) / 2;
    camera.setViewOffset(W, H, cx - tx, cy - ty, W, H);
    camera.updateProjectionMatrix();
}

/** Put the basket beside the blanket (wide screens) or below it. */
export function setBasketSide(side) {
    basketSide = side;
    if (side) BASKET_POS.set(COLS / 2 + 1.3, 0, ROWS / 2 - 1.0);
    else BASKET_POS.set(0, 0, ROWS / 2 + 1.05);
    if (basket) basket.position.copy(BASKET_POS);
}

const nearBasket = (x, z, d = 1.4) => Math.hypot(x - COLS / 2 - 1.3, z - ROWS / 2 + 1.0) < d || Math.hypot(x, z - ROWS / 2 - 1.05) < d;

/** Screen position (CSS px) of a world point. */
export function toScreen(p, out = { x: 0, y: 0 }) {
    const v = new THREE.Vector3().copy(p).project(camera);
    out.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return out;
}

const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4);
/** Board-plane hit for a screen point, as fractional (row, col). */
export function screenToCell(x, y) {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!_ray.ray.intersectPlane(_plane, hit)) return null;
    return { r: hit.z + (ROWS - 1) / 2, c: hit.x + (COLS - 1) / 2, point: hit };
}

// ------------------------------------------------------------
// Ground & decor
// ------------------------------------------------------------

function buildGround() {
    const g = new THREE.PlaneGeometry(90, 90, 60, 60);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const d = Math.hypot(x, z);
        const bump = d > 9 ? (Math.sin(x * 0.35) * Math.cos(z * 0.3) + 1) * 0.35 * Math.min(1, (d - 9) / 8) : 0;
        p.setY(i, bump - 0.02);
        const n = Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(x * 0.5 - z * 1.3) * 0.5;
        c.setHSL(0.27 + n * 0.015, 0.55, 0.5 + n * 0.04 + bump * 0.05);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true;
    scene.add(ground);
}

function tintGround(hex) {
    const base = new THREE.Color(hex);
    const hsl = {}; base.getHSL(hsl);
    const p = ground.geometry.attributes.position, col = ground.geometry.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
        const n = Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(x * 0.5 - z * 1.3) * 0.5;
        c.setHSL(hsl.h + n * 0.015, hsl.s, hsl.l + n * 0.04 + y * 0.05);
        col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    scene.background.setHex(hex);
    scene.fog.color.setHex(hex).lerp(new THREE.Color(0xffffff), 0.25);
}

const M = (hex, rough = 0.8) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough });

function tree(kind, accent) {
    const g = new THREE.Group();
    const trunkM = M(0x8a5a32);
    if (kind === 'palm') {
        const segs = 6;
        for (let i = 0; i < segs; i++) {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.19 - i * 0.012, 0.5, 7), M(i % 2 ? 0x9a6a3a : 0x8a5a2a));
            t.position.set(i * i * 0.012, 0.25 + i * 0.48, 0);
            t.rotation.z = -i * 0.05;
            t.castShadow = true;
            g.add(t);
        }
        const top = new THREE.Vector3(0.45, 2.95, 0);
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 4), M(0x3aa84a));
            leaf.scale.set(1.5, 0.12, 0.42);
            leaf.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 0.65, -0.2, Math.sin(a) * 0.65));
            leaf.rotation.y = -a;
            leaf.rotation.z = -0.35;
            leaf.castShadow = true;
            g.add(leaf);
        }
        for (let i = 0; i < 3; i++) {
            const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M(0x6a4a2a));
            nut.position.copy(top).add(new THREE.Vector3(Math.cos(i * 2) * 0.15, -0.2, Math.sin(i * 2) * 0.15));
            g.add(nut);
        }
        return g;
    }
    if (kind === 'sunflower') {
        const stemM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), M(0x4a9a3a));
        stemM.position.y = 1.2;
        stemM.castShadow = true;
        g.add(stemM);
        const head = new THREE.Group();
        head.position.set(0, 2.45, 0.05);
        head.rotation.x = 0.5;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), M(0x6a3a1a));
        disc.rotation.x = Math.PI / 2;
        head.add(disc);
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), M(0xffc81a));
            petal.scale.set(0.5, 1.2, 0.2);
            petal.position.set(Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0);
            petal.rotation.z = -a;
            head.add(petal);
        }
        head.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.add(head);
        for (const s of [-1, 1]) {
            const lf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 4), M(0x4caf38));
            lf.scale.set(1, 0.15, 0.5);
            lf.position.set(s * 0.3, 1.1 + s * 0.2, 0);
            lf.rotation.z = s * 0.4;
            g.add(lf);
        }
        return g;
    }
    if (kind === 'bush') {
        const leafM = M(0x4a9a3a);
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.05, 12, 8), leafM);
            b.position.set(Math.cos(i * 1.7) * 0.4, 0.4 + (i % 2) * 0.15, Math.sin(i * 1.7) * 0.3);
            b.castShadow = true;
            g.add(b);
        }
        const berryM = M(accent, 0.4);
        for (let i = 0; i < 14; i++) {
            const be = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), berryM);
            const a = i * 2.4, h = 0.25 + (i % 5) * 0.12;
            be.position.set(Math.cos(a) * 0.72, h, Math.sin(a) * 0.55);
            g.add(be);
        }
        return g;
    }
    // Round orchard tree.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 7), trunkM);
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    g.add(trunk);
    const leafM = M(0x5ab040);
    for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.85 - i * 0.12, 14, 10), leafM);
        b.position.set(Math.cos(i * 2.1) * 0.45 * (i ? 1 : 0), 1.9 + (i ? 0.25 : 0), Math.sin(i * 2.1) * 0.35 * (i ? 1 : 0));
        b.castShadow = true;
        g.add(b);
    }
    const fM = M(accent, 0.4);
    for (let i = 0; i < 10; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fM);
        const a = i * 2.4, h = 1.6 + (i % 4) * 0.22;
        f.position.set(Math.cos(a) * 0.82, h, Math.sin(a) * 0.82);
        g.add(f);
    }
    return g;
}

function flower(colour) {
    const g = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), M(0x4a9a3a));
    st.position.y = 0.15;
    g.add(st);
    const pm = M(colour, 0.6);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pm);
        p.scale.set(1, 0.4, 1);
        p.position.set(Math.cos(a) * 0.065, 0.31, Math.sin(a) * 0.065);
        g.add(p);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), M(0xffd23a));
    c.position.y = 0.32;
    g.add(c);
    return g;
}

function butterfly(colour) {
    const g = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: colour, side: THREE.DoubleSide, roughness: 0.6 });
    const wings = [];
    for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), wm);
        w.geometry.translate(0.12, 0, 0);
        const pivot = new THREE.Group();
        pivot.scale.x = s;
        pivot.add(w);
        w.rotation.x = -Math.PI / 2;
        g.add(pivot);
        wings.push(pivot);
    }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 4), M(0x2a1a10));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    g.userData.wings = wings;
    return g;
}

/** Rebuild the meadow for a garden (trees, flowers, butterflies, blanket colour). */
export function setGarden(gi, maskId = 'full') {
    const G = GARDENS[gi] ?? GARDENS[0];
    tintGround(G.grass);
    if (decor) {
        scene.remove(decor);
        decor.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    swayers.length = 0;
    flyers.length = 0;
    decor = new THREE.Group();
    scene.add(decor);

    const treeKind = ['round', 'bush', 'sunflower', 'palm'][gi] ?? 'round';
    const accents = [0xef3b3b, 0xd2387a, 0xff9a1f, 0xffd83b];
    let seed = 1337 + gi * 101;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    // Trees in a loose ring, kept off the blanket and basket.
    const spots = [];
    for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 7.2 + rnd() * 9;
        const x = Math.cos(a) * d * 1.05, z = Math.sin(a) * d - 1;
        if (Math.abs(x) < 5.4 && z > -6.5 && z < 8) continue;
        if (nearBasket(x, z, 2.2)) continue;
        if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 2.2)) continue;
        spots.push([x, z]);
        const t = tree(i % 4 === 3 && treeKind !== 'round' ? 'round' : treeKind, accents[gi]);
        t.position.set(x, 0, z);
        t.rotation.y = rnd() * Math.PI * 2;
        const s = 0.8 + rnd() * 0.5;
        t.scale.setScalar(s);
        decor.add(t);
        swayers.push({ obj: t, amp: 0.02, speed: 0.6 + rnd() * 0.4, phase: rnd() * 6 });
    }
    // Flower clumps.
    const fcols = [0xffffff, 0xff8ac0, 0xffd23a, 0xb08aff, 0xff7a5a];
    for (let i = 0; i < 70; i++) {
        const x = (rnd() - 0.5) * 26, z = (rnd() - 0.5) * 30;
        if (Math.abs(x) < COLS / 2 + 0.7 && z > -ROWS / 2 - 0.8 && z < ROWS / 2 + 2.2) continue;
        if (nearBasket(x, z)) continue;
        const f = flower(fcols[i % fcols.length]);
        f.position.set(x, 0, z);
        f.scale.setScalar(0.9 + rnd() * 0.8);
        decor.add(f);
        swayers.push({ obj: f, amp: 0.12, speed: 1.2 + rnd(), phase: rnd() * 6 });
    }
    // Grass tufts (one instanced mesh).
    const tuftGeo = new THREE.ConeGeometry(0.05, 0.28, 3);
    tuftGeo.translate(0, 0.14, 0);
    const tufts = new THREE.InstancedMesh(tuftGeo, M(0x4f9a35), 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let i = 0; i < 600 && n < 260; i++) {
        const x = (rnd() - 0.5) * 24, z = (rnd() - 0.5) * 28;
        if (Math.abs(x) < COLS / 2 + 0.6 && z > -ROWS / 2 - 0.7 && z < ROWS / 2 + 2.0) continue;
        if (nearBasket(x, z, 1.2)) continue;
        e.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5);
        q.setFromEuler(e);
        const s = 0.7 + rnd() * 0.9;
        m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
        tufts.setMatrixAt(n++, m4);
    }
    tufts.count = n;
    decor.add(tufts);
    // Butterflies.
    for (let i = 0; i < 4; i++) {
        const b = butterfly(fcols[(i + 1) % fcols.length]);
        decor.add(b);
        flyers.push({ obj: b, cx: (rnd() - 0.5) * 12, cz: (rnd() - 0.5) * 10, r: 2 + rnd() * 3, speed: 0.25 + rnd() * 0.2, phase: rnd() * 6 });
    }

    buildBlanket(gi, maskId);
    buildBasket();
}

// ------------------------------------------------------------
// Blanket & basket
// ------------------------------------------------------------

const BLANKET_COLOURS = ['#e8453c', '#e2457a', '#3f8fd8', '#17a596'];

function buildBlanket(gi, maskId) {
    if (blanket) {
        scene.remove(blanket);
        blanket.geometry.dispose();
        blanket.material.map.dispose();
        blanket.material.dispose();
    }
    const mask = MASKS[maskId] ?? MASKS.full;
    const PX = 64, pad = 0.42;
    const w = COLS + pad * 2, h = ROWS + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * PX); cv.height = Math.round(h * PX);
    const ctx = cv.getContext('2d');
    const col = BLANKET_COLOURS[gi] ?? BLANKET_COLOURS[0];
    const ox = pad * PX, oy = pad * PX;
    const isCell = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && mask[r][c] === '.';
    // Hem: rounded blobs merged under every cell.
    ctx.fillStyle = '#fff6e6';
    const rr = (x, y, ww, hh, rad) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, rad); ctx.fill(); };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!isCell(r, c)) continue;
        rr(ox + c * PX - PX * 0.36, oy + r * PX - PX * 0.36, PX * 1.72, PX * 1.72, PX * 0.42);
    }
    // Scallops on the hem edge.
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!isCell(r, c)) continue;
        const cx = ox + (c + 0.5) * PX, cy = oy + (r + 0.5) * PX;
        const edges = [[-1, 0, 0, -1], [1, 0, 0, 1], [0, -1, -1, 0], [0, 1, 1, 0]];
        for (const [dc, dr] of edges) {
            if (isCell(r + dr, c + dc)) continue;
            for (let k = -1; k <= 1; k++) {
                const px = cx + dc * PX * 0.78 + (dr !== 0 ? k * PX * 0.3 : 0);
                const py = cy + dr * PX * 0.78 + (dc !== 0 ? k * PX * 0.3 : 0);
                ctx.beginPath(); ctx.arc(px, py, PX * 0.07, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1;
    // Gingham: white base, translucent stripes both ways.
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!isCell(r, c)) continue;
        const x = ox + c * PX - PX * 0.12, y = oy + r * PX - PX * 0.12;
        const s = PX * 1.24;
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x, y, s, s, PX * 0.12); ctx.clip();
        ctx.fillStyle = '#fffdf8';
        ctx.fillRect(x, y, s, s);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = col;
        const stripe = PX / 4;
        for (let k = -2; k < 8; k++) {
            const sx = ox + c * PX + k * stripe * 2;
            ctx.fillRect(sx, y, stripe, s);
            const sy = oy + r * PX + k * stripe * 2;
            ctx.fillRect(x, sy, s, stripe);
        }
        ctx.restore();
    }
    // Soft plate under each cell so fruit reads as sitting in a spot.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!isCell(r, c)) continue;
        ctx.beginPath(); ctx.arc(ox + (c + 0.5) * PX, oy + (r + 0.5) * PX, PX * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(w, h, 1, 1);
    geo.rotateX(-Math.PI / 2);
    blanket = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9 }));
    blanket.position.set(0, 0.01, 0);
    blanket.receiveShadow = true;
    scene.add(blanket);
}

let basket = null;
export function getBasket() { return basket; }

function weaveTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#b8783a';
    ctx.fillRect(0, 0, 128, 64);
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#d89a52' : '#c88842';
            ctx.beginPath();
            ctx.roundRect(x * 16 + 1, y * 16 + 1, 14, 14, 5);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,240,200,0.25)';
            ctx.fillRect(x * 16 + 3, y * 16 + 3, 10, 3);
        }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 1);
    return t;
}

function buildBasket() {
    if (basket) return;
    basket = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ map: weaveTexture(), roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 0.62, 24, 1, true), wm);
    body.material.side = THREE.DoubleSide;
    body.position.y = 0.31;
    body.castShadow = true;
    basket.add(body);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), M(0x9a6a32));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.04;
    basket.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 28), M(0xa86a32));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.62;
    basket.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 6, 20, Math.PI), M(0xa86a32));
    handle.position.y = 0.62;
    handle.rotation.y = 0.15;
    handle.castShadow = true;
    basket.add(handle);
    // A napkin peeking out.
    const nap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 4), M(0xfff3e0));
    nap.position.set(-0.45, 0.66, -0.15);
    nap.rotation.set(0.3, 0.3, 0.6);
    basket.add(nap);
    basket.position.copy(BASKET_POS);
    basket.scale.setScalar(0.9);
    scene.add(basket);
}

/** Fruit that lands in the basket stays visible as a little heap. */
const heap = [];
export function addToBasket(mesh) {
    if (!basket) return;
    heap.push(mesh);
    basket.add(mesh);
    const i = heap.length - 1;
    const a = i * 2.39996, d = Math.min(0.55, 0.12 + Math.sqrt(i) * 0.12);
    mesh.position.set(Math.cos(a) * d, 0.55 + Math.min(0.25, i * 0.006), Math.sin(a) * d);
    mesh.rotation.set(0, a, 0);
    mesh.scale.setScalar(0.42);
    while (heap.length > 24) {
        const old = heap.shift();
        basket.remove(old);
    }
}
export function clearBasket() {
    for (const m of heap) basket?.remove(m);
    heap.length = 0;
}
export function bumpBasket(t) {
    if (!basket) return;
    basket.userData.bump = t;
}

// ------------------------------------------------------------
// Per-frame
// ------------------------------------------------------------

export function updateScene(dt, gentle = false) {
    animTime += dt;
    const k = gentle ? 0.3 : 1;
    for (const s of swayers) {
        s.obj.rotation.z = Math.sin(animTime * s.speed + s.phase) * s.amp * k;
    }
    for (const f of flyers) {
        const t = animTime * f.speed + f.phase;
        f.obj.position.set(f.cx + Math.cos(t) * f.r, 1.2 + Math.sin(t * 2.3) * 0.4, f.cz + Math.sin(t * 1.3) * f.r);
        f.obj.rotation.y = -t + Math.PI / 2;
        const flap = Math.sin(animTime * 18 + f.phase) * 0.9;
        f.obj.userData.wings[0].rotation.z = flap;
        f.obj.userData.wings[1].rotation.z = flap;
    }
    if (basket && basket.userData.bump) {
        basket.userData.bump = Math.max(0, basket.userData.bump - dt * 4);
        const b = basket.userData.bump;
        basket.scale.set(0.9 * (1 + b * 0.12), 0.9 * (1 - b * 0.1), 0.9 * (1 + b * 0.12));
    }
}

export function render() {
    renderer.render(scene, camera);
}
