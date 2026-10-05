// Procedural ships. A seed + class + style produce a fuselage (lathe), wings, fins, nacelles,
// greebles and a canopy, merged into one vertex-coloured mesh plus glass and engine glows.
// Ships face +Z with +Y up, matching the sim's forward vector at yaw 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../rng.js';
import { glowTexture } from './renderer.js';

const tmpC = new THREE.Color();

function prep(geo, color, fn = null) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
        const c = fn ? fn(p.getX(i), p.getY(i), p.getZ(i)) : color;
        tmpC.set(c);
        cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
}

function wingShape(pts, thick) {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    g.translate(0, 0, -thick / 2);
    g.rotateX(-Math.PI / 2); // shape (span, back) → (x, ·, -z)
    return g;
}

const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// opts: { seed, cls (1–5), style: 'guild'|'trader'|'reaver'|'swarm'|'warden', colors: {a,b,c}, scale }
const designCache = new Map();

export function buildShip(opts) {
    const style = opts.style || 'guild';
    const col = opts.colors || { a: '#e9e4d8', b: '#2b3a55', c: '#ffb547' };
    if (style === 'warden') return buildWarden(new RNG(opts.seed || 1), col, opts);
    const key = `${opts.seed}|${opts.cls}|${style}|${col.a}|${col.b}|${col.c}`;
    if (!designCache.has(key)) {
        if (designCache.size > 60) designCache.clear();
        designCache.set(key, design(opts, style, col));
    }
    return assemble(designCache.get(key), opts, style, col);
}

function design(opts, style, col) {
    const r = new RNG(opts.seed || 1);
    const cls = opts.cls || 1;
    const parts = [];
    const engines = [];
    const lights = [];
    const L = 13 + cls * 2.2 + r.range(-1, 2);
    const R = (2 + cls * 0.38) * r.range(0.85, 1.15) * (style === 'swarm' ? 0.85 : 1);
    const wide = r.range(1.0, 1.6) * (style === 'reaver' ? 1.15 : 1);
    const tall = r.range(0.55, 0.95);
    const segs = style === 'swarm' ? 12 : r.pick([6, 8, 8, 10, 12]);

    // --- fuselage profile (t: 0 tail → 1 nose)
    const noseSharp = r.range(1.2, 3);
    const midT = r.range(0.3, 0.55);
    const tailR = r.range(0.45, 0.8);
    const prof = [];
    const N = 12;
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        let k;
        if (t < midT) k = tailR + (1 - tailR) * Math.sin((t / midT) * Math.PI / 2);
        else k = Math.pow(Math.cos(((t - midT) / (1 - midT)) * Math.PI / 2), 1 / noseSharp);
        if (style === 'swarm') k = Math.pow(Math.sin(t * Math.PI), 0.7) * (1 + 0.25 * Math.sin(t * 18));
        prof.push(new THREE.Vector2(Math.max(0.05, k * R), (t - 0.5) * L));
    }
    const fus = new THREE.LatheGeometry(prof, segs, Math.PI / segs);
    fus.rotateX(Math.PI / 2);
    fus.scale(wide, tall, 1);
    const stripeW = R * wide * r.range(0.15, 0.3);
    const striped = r.chance(0.7);
    parts.push(prep(fus, col.a, (x, y, z) => (striped && y > 0 && Math.abs(x) < stripeW && z < L * 0.35 ? col.c : z < -L * 0.42 ? shade(col.b, 1.2) : col.a)));

    // --- canopy
    const canZ = L * r.range(0.12, 0.28);
    const canopy = new THREE.SphereGeometry(1, 12, 8);
    canopy.scale(R * wide * 0.3, R * tall * 0.34, R * r.range(0.8, 1.25));
    canopy.translate(0, R * tall * 0.78, canZ);

    // --- wings
    const wingType = style === 'swarm' ? 'organic' : style === 'reaver' ? r.pick(['forward', 'jagged', 'delta']) : r.pick(['delta', 'swept', 'straight', 'swept', 'forward', 'split']);
    const span = R * wide * r.range(1.6, 2.8) * (1 + cls * 0.12);
    const chord = L * r.range(0.25, 0.42);
    const wingZ = L * r.range(-0.15, 0.08);
    const thick = R * 0.18;
    const dihedral = r.range(-0.15, 0.25);
    const wingY = R * tall * r.range(-0.4, 0.2);
    const rootX = R * wide * 0.7;
    const wingPts = (sx) => {
        const s = sx;
        switch (wingType) {
            case 'delta': return [[0, 0], [s * span, chord * 0.95], [s * span * 0.95, chord * 1.05], [0, chord]];
            case 'swept': return [[0, 0], [s * span, chord * 0.7], [s * span, chord * 1.05], [0, chord]];
            case 'straight': return [[0, 0], [s * span, chord * 0.1], [s * span, chord * 0.65], [0, chord]];
            case 'forward': return [[0, chord * 0.3], [s * span, -chord * 0.25], [s * span, chord * 0.2], [0, chord * 1.1]];
            case 'jagged': return [[0, 0], [s * span * 0.6, chord * 0.2], [s * span, -chord * 0.1], [s * span * 0.8, chord * 0.6], [s * span * 0.5, chord * 0.5], [0, chord]];
            case 'split': return [[0, 0], [s * span * 0.9, chord * 0.4], [s * span, chord * 0.55], [0, chord * 0.55]];
            case 'organic': return [[0, 0], [s * span * 0.5, chord * 0.3], [s * span, chord * 1.2], [s * span * 0.7, chord * 0.9], [0, chord * 0.7]];
            default: return [[0, 0], [s * span, chord], [0, chord]];
        }
    };
    for (const s of [1, -1]) {
        const w = wingShape(wingPts(s), thick);
        w.rotateZ(-s * dihedral);
        w.translate(s * rootX, wingY, wingZ + chord * 0.4);
        const tipX = s * (rootX + span * 0.85);
        parts.push(prep(w, col.b, (x) => (Math.abs(x) > Math.abs(tipX) * 0.92 ? col.c : col.b)));
        // Nav lights at the tips
        lights.push({ x: s * (rootX + span * 0.98), y: wingY - s * dihedral * span, z: wingZ + chord * 0.4 - chord * 0.6, c: s > 0 ? '#ff3344' : '#33ff66' });
        if (wingType === 'split' || (cls >= 3 && r.chance(0.5))) {
            const w2 = wingShape(wingPts(s).map(([x, y]) => [x * 0.6, y * 0.6]), thick);
            w2.rotateZ(s * dihedral * 2);
            w2.translate(s * rootX, wingY + R * tall * 0.5, wingZ - chord * 0.45);
            parts.push(prep(w2, shade(col.b, 1.15)));
        }
        // Canards
        if (r.chance(0.35) || cls >= 4) {
            const cn = wingShape([[0, 0], [s * span * 0.35, chord * 0.25], [s * span * 0.3, chord * 0.4], [0, chord * 0.35]], thick * 0.7);
            cn.translate(s * R * wide * 0.6, 0, L * 0.32);
            parts.push(prep(cn, col.c));
        }
        // Wing guns
        const gun = new THREE.CylinderGeometry(R * 0.08, R * 0.1, chord * 0.9, 6);
        gun.rotateX(Math.PI / 2);
        gun.translate(s * (rootX + span * 0.35), wingY, wingZ + chord * 0.7);
        parts.push(prep(gun, '#2a2d33'));
    }

    // --- tail fins
    const finType = r.pick(['single', 'twin', 'none', 'single', 'twin']);
    const finH = R * tall * r.range(1.4, 2.4);
    const finC = chord * r.range(0.5, 0.8);
    const fin = (x, tilt) => {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(finC * 0.45, finH); sh.lineTo(finC * 0.75, finH); sh.lineTo(finC, 0); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: thick * 0.8, bevelEnabled: false });
        g.translate(0, 0, -thick * 0.4);
        g.rotateY(Math.PI / 2); // shape x → -z
        g.rotateZ(tilt);
        g.translate(x, R * tall * 0.5, -L * 0.5 + finC + L * 0.04);
        parts.push(prep(g, col.a, (px, py) => (py > R * tall * 0.5 + finH * 0.75 ? col.c : col.a)));
    };
    if (finType === 'single') fin(0, 0);
    if (finType === 'twin') { const fx = R * wide * 0.6; fin(fx, -0.35); fin(-fx, 0.35); }

    // --- engines
    const engCount = style === 'swarm' ? 1 : Math.min(4, r.pick([1, 2, 2, 3]) + (cls >= 4 ? 1 : 0));
    const engR = R * r.range(0.35, 0.55) * (engCount === 1 ? 1.4 : 1);
    const engL = L * r.range(0.28, 0.42);
    const placements = engCount === 1 ? [[0, 0]] : engCount === 2 ? [[1, 0], [-1, 0]] : engCount === 3 ? [[0, 0.6], [1, -0.2], [-1, -0.2]] : [[1, 0.5], [-1, 0.5], [1, -0.5], [-1, -0.5]];
    const engSpread = R * wide * r.range(0.8, 1.4);
    for (const [ex, ey] of placements) {
        const x = ex * engSpread, y = ey * R * tall;
        const nac = new THREE.CylinderGeometry(engR * 0.85, engR, engL, segs);
        nac.rotateX(Math.PI / 2);
        nac.translate(x, y, -L * 0.5 + engL * 0.42);
        parts.push(prep(nac, shade(col.b, 0.9)));
        const noz = new THREE.CylinderGeometry(engR * 1.05, engR * 0.8, engL * 0.18, segs, 1, true);
        noz.rotateX(Math.PI / 2);
        noz.translate(x, y, -L * 0.5 - engL * 0.02);
        parts.push(prep(noz, '#3a3d44'));
        engines.push({ x, y, z: -L * 0.5 - engL * 0.1, r: engR * 0.85 });
        if (ex !== 0) {
            // pylon
            const py = new THREE.BoxGeometry(Math.abs(x) - R * wide * 0.4, thick, engL * 0.5);
            py.translate(x / 2, y, -L * 0.5 + engL * 0.4);
            parts.push(prep(py, col.b));
        }
    }

    // --- cargo pods & greebles
    if (cls >= 2 && style !== 'swarm') {
        const pods = cls >= 4 ? 2 : 1;
        for (let i = 0; i < pods; i++) {
            const pz = -L * 0.05 - i * L * 0.22;
            for (const s of [1, -1]) {
                const pod = new THREE.BoxGeometry(R * 0.8, R * 0.8 * tall, L * 0.18);
                pod.translate(s * R * wide * 0.95, -R * tall * 0.55, pz);
                parts.push(prep(pod, shade(col.a, 0.8)));
            }
        }
    }
    const greebles = 4 + cls * 3 + r.int(0, 4);
    for (let i = 0; i < greebles; i++) {
        const gw = R * r.range(0.15, 0.45), gh = R * r.range(0.08, 0.25), gl = L * r.range(0.04, 0.12);
        const box = new THREE.BoxGeometry(gw, gh, gl);
        const gx = r.range(-0.55, 0.55) * R * wide;
        const gz = r.range(-0.42, 0.25) * L;
        const t = gz / L + 0.5;
        const k = t < midT ? tailR + (1 - tailR) * Math.sin((t / midT) * Math.PI / 2) : Math.cos(((t - midT) / (1 - midT)) * Math.PI / 2);
        box.translate(gx, R * tall * Math.max(0.3, k * 0.92), gz);
        parts.push(prep(box, r.chance(0.3) ? col.c : shade(col.a, r.range(0.55, 0.85))));
    }
    if (style === 'reaver') {
        // Spikes and scrap plates.
        for (let i = 0; i < 5; i++) {
            const sp = new THREE.ConeGeometry(R * 0.15, R * r.range(1, 2.2), 4);
            sp.rotateX(Math.PI / 2 * r.range(0.6, 1));
            sp.translate(r.range(-1, 1) * R * wide, r.range(-0.5, 0.8) * R, r.range(-0.3, 0.45) * L);
            parts.push(prep(sp, '#2a2222'));
        }
    }
    if (style === 'swarm') {
        // Mandibles and legs
        for (const s of [1, -1]) {
            const m = new THREE.ConeGeometry(R * 0.2, L * 0.35, 5);
            m.rotateX(Math.PI / 2);
            m.rotateY(-s * 0.25);
            m.translate(s * R * 0.5, -R * 0.2, L * 0.55);
            parts.push(prep(m, col.c));
            for (let k = 0; k < 2; k++) {
                const leg = new THREE.CylinderGeometry(R * 0.06, R * 0.03, span * 0.9, 4);
                leg.rotateZ(s * (Math.PI / 2 - 0.4));
                leg.translate(s * (R + span * 0.3), -R * 0.5, -L * 0.1 - k * L * 0.18);
                parts.push(prep(leg, col.b));
            }
        }
        lights.length = 0;
        lights.push({ x: R * 0.35, y: R * 0.35, z: L * 0.38, c: col.c, big: true }, { x: -R * 0.35, y: R * 0.35, z: L * 0.38, c: col.c, big: true });
    }

    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    return { geo, canopy, engines, lights, R, L };
}

function assemble(d, opts, style, col) {
    const { geo, canopy, engines, lights, R, L } = d;
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.42, flatShading: true });
    const hull = new THREE.Mesh(geo, hullMat);
    group.add(hull);
    const glass = new THREE.Mesh(canopy, new THREE.MeshStandardMaterial({ color: style === 'swarm' ? col.c : '#0b1a2e', metalness: 0.9, roughness: 0.08, emissive: new THREE.Color(style === 'reaver' ? '#ff3020' : style === 'swarm' ? col.c : '#2a8cff'), emissiveIntensity: style === 'swarm' ? 1.2 : 0.18 }));
    if (style !== 'swarm') group.add(glass);

    // Engine glows: an additive cone (flame) + a sprite per engine.
    const glowCol = new THREE.Color(style === 'reaver' ? '#ff5a2a' : style === 'swarm' ? col.c : opts.engineColor || '#5ef0ff');
    const flames = [];
    for (const e of engines) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(e.r * 0.9, e.r * 4, 10, 1, true), new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(1.3), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
        cone.rotation.x = -Math.PI / 2;
        cone.position.set(e.x, e.y, e.z - e.r * 2);
        group.add(cone);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: glowCol.clone().multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.position.set(e.x, e.y, e.z);
        sp.scale.setScalar(e.r * 4);
        group.add(sp);
        flames.push({ cone, sp, r: e.r, z: e.z });
    }
    for (const l of lights) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(l.c).multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.position.set(l.x, l.y, l.z);
        sp.scale.setScalar(l.big ? R * 0.9 : R * 0.5);
        sp.userData.blink = !l.big;
        group.add(sp);
    }
    const s = opts.scale || 1;
    group.scale.setScalar(s);
    group.userData = { engines, flames, length: L * s, radius: geo.boundingSphere.radius * s, glowCol };
    group.userData.setThrust = (k, t = 0) => {
        for (const f of flames) {
            const len = 0.3 + k * 1.3;
            f.cone.scale.set(1, len, 1);
            f.cone.position.z = f.z - f.r * 2 * len;
            f.cone.material.opacity = 0.08 + k * 0.22 + Math.sin(t * 50) * 0.03;
            f.sp.scale.setScalar(f.r * (1.6 + k * 2.2));
        }
        group.children.forEach((c) => { if (c.userData.blink) c.visible = Math.sin(t * 4 + c.position.x) > 0.2; });
    };
    group.userData.dispose = () => group.traverse((o) => { if (o.material) o.material.dispose(); });
    return group;
}

// Lattice Wardens: crystalline geometry with an emissive core.
function buildWarden(r, col, opts) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#2a2440', metalness: 0.9, roughness: 0.2, flatShading: true, emissive: new THREE.Color('#6a3cff'), emissiveIntensity: 0.25 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), mat);
    core.scale.set(1, 1, 2.2);
    group.add(core);
    for (let i = 0; i < 6; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), mat);
        const a = (i / 6) * Math.PI * 2;
        shard.position.set(Math.cos(a) * 8, Math.sin(a) * 8, -2);
        shard.scale.set(0.5, 0.5, 2.5);
        shard.userData.orbit = a;
        group.add(shard);
    }
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#c79bff').multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    eye.scale.setScalar(10);
    group.add(eye);
    group.scale.setScalar(opts.scale || 1);
    group.userData = { engines: [], flames: [], length: 22, radius: 12, glowCol: new THREE.Color('#c79bff') };
    group.userData.setThrust = (k, t = 0) => {
        group.children.forEach((c) => { if (c.userData.orbit != null) { const a = c.userData.orbit + t * 1.5; c.position.set(Math.cos(a) * 8, Math.sin(a) * 8, -2); c.rotation.z = a; } });
        eye.scale.setScalar(9 + Math.sin(t * 6) * 2);
    };
    group.userData.dispose = () => group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    return group;
}
