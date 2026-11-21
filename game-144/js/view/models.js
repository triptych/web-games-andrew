// Procedural models: the three Seraphs, every enemy, capital-ship hulls and the six bosses. Everything faces +x
// (the player) or -x (the enemy) in world space, where world y is up (sim y is down). No asset files.

import * as THREE from 'three';

// ---------------------------------------------------------------------------- materials (shared)
const M = {};
export function mat(key, make) { return M[key] || (M[key] = make()); }
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.35, metalness: o.m ?? 0.7, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat, transparent: !!o.t, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide });
export const glow = (c, i = 2.5) => mat('glow' + c + '_' + i, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false }));
const metal = (c) => mat('metal' + c, () => std(c, { r: 0.32, m: 0.85 }));
const paint = (c) => mat('paint' + c, () => std(c, { r: 0.4, m: 0.45 }));
const crystal = (c, e) => mat('crys' + c + e, () => std(c, { r: 0.05, m: 0.3, e, ei: 0.8, flat: true, t: true, op: 0.88 }));
const flesh = (c, e) => mat('flesh' + c + e, () => std(c, { r: 0.75, m: 0.05, e, ei: 0.35 }));

// ---------------------------------------------------------------------------- geometry helpers
/** A lathe body along +x from a profile of [x, radius] points. */
function body(profile, seg = 14) {
    const pts = profile.map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), x));
    const g = new THREE.LatheGeometry(pts, seg);
    g.rotateZ(-Math.PI / 2);
    return g;
}
/** A flat wing from an outline (x, y in the wing's plane), extruded thin; lies in the x-z plane. */
function wing(outline, depth = 0.08) {
    const s = new THREE.Shape();
    outline.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2);
    g.rotateX(Math.PI / 2);
    return g;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const sph = (r, m, x, y, z, s = 12) => mesh(new THREE.SphereGeometry(r, s, Math.max(6, s - 4)), m, x, y, z);
const cyl = (r1, r2, h, m, s = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m);
function flame(color, len = 1, r = 0.22) {
    // an engine flame: a glowing cone pointing backwards, flickered by the view
    const g = new THREE.ConeGeometry(r, len, 10, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(-len / 2, 0, 0);
    const m = new THREE.Mesh(g, mat('flame' + color, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    m.userData.flame = true;
    return m;
}

/** An eyeball texture (iris, pupil, glints) for eyes, cores and the Mother. */
const eyeTex = {};
export function eyeTexture(iris = '#ffcc33', ring = '#ff3300') {
    const k = iris + ring;
    if (eyeTex[k]) return eyeTex[k];
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#f2e8e0'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) { x.strokeStyle = `rgba(200,40,40,${0.2 + (i % 5) * 0.06})`; x.lineWidth = 1 + (i % 3); x.beginPath(); x.moveTo(128 + Math.cos(i) * 128, 128 + Math.sin(i * 1.7) * 128); x.quadraticCurveTo(128 + Math.cos(i * 2) * 70, 128 + Math.sin(i * 2) * 70, 128 + Math.cos(i * 0.5) * 60, 128 + Math.sin(i * 0.9) * 60); x.stroke(); }
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 80);
    g.addColorStop(0, '#000'); g.addColorStop(0.28, '#000'); g.addColorStop(0.32, iris); g.addColorStop(0.85, ring); g.addColorStop(1, 'rgba(0,0,0,0.9)');
    x.fillStyle = g; x.beginPath(); x.arc(128, 128, 80, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(104, 100, 12, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return (eyeTex[k] = t);
}
function eyeball(r, iris, ring, glowCol) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ map: eyeTexture(iris, ring), roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(glowCol), emissiveIntensity: 0.4, emissiveMap: eyeTexture(iris, ring) });
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), m);
    s.rotation.y = -Math.PI / 2;                 // the iris looks along -x (at the player)
    g.add(s);
    g.userData.eye = s;
    return g;
}

/** Hull panel texture with lit windows (capital ships, cruisers). */
let panelTex = null;
export function hullTexture() {
    if (panelTex) return panelTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#585e6a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) { const v = 70 + ((i * 37) % 40); x.fillStyle = `rgb(${v},${v + 4},${v + 12})`; x.fillRect((i * 53) % 256, (i * 97) % 256, 20 + (i * 7) % 60, 10 + (i * 11) % 40); }
    x.strokeStyle = 'rgba(20,22,28,0.8)'; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    const e = document.createElement('canvas');
    e.width = e.height = 256;
    const y = e.getContext('2d');
    y.fillStyle = '#000'; y.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { y.fillStyle = i % 7 ? '#ffb070' : '#70c8ff'; y.fillRect((i * 71) % 250, (i * 43) % 250, 4, 2); }
    const t = new THREE.CanvasTexture(c), et = new THREE.CanvasTexture(e);
    for (const tt of [t, et]) { tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.colorSpace = THREE.SRGBColorSpace; }
    panelTex = { map: t, emissive: et };
    return panelTex;
}

// ---------------------------------------------------------------------------- the Seraphs
export function playerShip(id) {
    const g = new THREE.Group();
    const parts = { flames: [], glows: [] };
    if (id === 'sora') {
        const white = paint(0xe8f0ff), blue = metal(0x2a7fff), dark = metal(0x1a2236);
        g.add(mesh(body([[-1.1, 0.0], [-1.0, 0.24], [-0.4, 0.34], [0.4, 0.28], [1.1, 0.12], [1.5, 0.0]]), white));
        const w = wing([[0.3, 0], [-0.7, 1.35], [-1.0, 1.35], [-0.7, 0]]);
        const wl = mesh(w, blue, 0, -0.02, 0); g.add(wl);
        const wr = wl.clone(); wr.scale.z = -1; g.add(wr);
        const fin = wing([[-0.3, 0], [-0.9, 0.6], [-1.05, 0.6], [-0.9, 0]], 0.05);
        const f1 = mesh(fin, blue); f1.rotation.x = -Math.PI / 2; f1.position.set(0, 0.15, 0.22); g.add(f1);
        const f2 = f1.clone(); f2.position.z = -0.22; g.add(f2);
        g.add(mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('canopyC', () => std(0x60e0ff, { r: 0.05, m: 0.2, e: 0x1080c0, ei: 0.8 })), 0.45, 0.2, 0));
        g.add(box(0.6, 0.06, 0.5, dark, -0.3, -0.18, 0));
        for (const z of [0.55, -0.55]) { const s = box(0.9, 0.04, 0.05, glow(0x5fd8ff, 3), -0.4, 0.02, z); g.add(s); parts.glows.push(s); }
        const fl = flame(0x60c8ff, 1.2, 0.2); fl.position.x = -1.05; g.add(fl); parts.flames.push(fl);
    } else if (id === 'kaito') {
        const red = paint(0xc8202e), black = metal(0x1c1c22), gold = metal(0xd8a040);
        g.add(mesh(body([[-1.2, 0.0], [-1.1, 0.3], [-0.2, 0.38], [0.6, 0.3], [1.3, 0.12], [1.9, 0.04]]), black));
        g.add(mesh(body([[1.2, 0.08], [2.6, 0.03], [2.7, 0.0]], 8), gold));               // the halberd lance
        const w = wing([[0.4, 0], [-0.9, 1.1], [-1.3, 1.1], [-0.9, 0.2], [-1.0, 0]], 0.1);
        const wl = mesh(w, red); g.add(wl);
        const wr = wl.clone(); wr.scale.z = -1; g.add(wr);
        const can = wing([[0.3, 0], [-0.6, 0.55], [-0.85, 0.55], [-0.6, 0]], 0.05);
        const c1 = mesh(can, red); c1.rotation.x = -Math.PI / 2; c1.position.set(-0.2, 0.2, 0); g.add(c1);
        g.add(mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('canopyK', () => std(0xff6070, { r: 0.05, m: 0.2, e: 0x801020, ei: 0.8 })), 0.5, 0.22, 0));
        for (const z of [0.35, -0.35]) {
            const n = cyl(0.17, 0.2, 0.5, black); n.rotation.z = Math.PI / 2; n.position.set(-1.1, -0.05, z); g.add(n);
            const fl = flame(0xff6040, 1.1, 0.17); fl.position.set(-1.3, -0.05, z); g.add(fl); parts.flames.push(fl);
        }
        const s = box(1.2, 0.04, 0.05, glow(0xff4050, 3), -0.2, 0.12, 0); g.add(s); parts.glows.push(s);
    } else {
        const violet = mat('lyraBody', () => std(0x2a1838, { r: 0.25, m: 0.6, e: 0x5a1a90, ei: 0.35 })), edge = glow(0xc77dff, 3);
        g.add(mesh(body([[-1.0, 0.0], [-0.8, 0.22], [0.0, 0.3], [0.8, 0.18], [1.4, 0.0]]), violet));
        // crescent blade wings, swept forward like a moth's
        const blade = wing([[0.5, 0.1], [0.9, 0.9], [0.2, 1.6], [-0.6, 1.2], [-0.3, 0.6], [-0.4, 0.1]], 0.06);
        const wl = mesh(blade, violet); g.add(wl);
        const wr = wl.clone(); wr.scale.z = -1; g.add(wr);
        for (const sgn of [1, -1]) { const v = box(1.3, 0.03, 0.03, edge, 0.1, 0.03, sgn * 0.9); v.rotation.y = sgn * 0.6; g.add(v); parts.glows.push(v); }
        g.add(sph(0.18, mat('lyraEye', () => std(0xffd060, { r: 0.1, m: 0.1, e: 0xffa020, ei: 1.5 })), 0.6, 0.12, 0, 10));
        const fl = flame(0xc77dff, 1.3, 0.16); fl.position.x = -0.95; g.add(fl); parts.flames.push(fl);
    }
    g.userData.parts = parts;
    g.scale.setScalar(0.85);
    return g;
}

export function optionDrone(color) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.OctahedronGeometry(0.28, 0), mat('opt' + color, () => std(0xdde6ff, { r: 0.2, m: 0.8, e: color, ei: 0.6 }))));
    const ring = mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 24), glow(color, 2.6));
    g.add(ring);
    g.userData.ring = ring;
    return g;
}

// ---------------------------------------------------------------------------- enemies
// Each returns a Group facing -x. `c` is the stage accent colour.
const RED = 0xff3040;
export function enemyModel(kind, c = RED) {
    const g = new THREE.Group();
    const hullD = metal(0x2c2f3a), hullL = metal(0x8a8f9c), bone = mat('bone', () => std(0xd8ccb0, { r: 0.7, m: 0.1 }));
    const eyeG = glow(c, 3);
    const add = (o) => (g.add(o), o);
    const P = { spin: [], flames: [], eye: null };
    switch (kind) {
        case 'mote': {
            add(sph(0.38, hullD, 0, 0, 0, 12));
            P.eye = add(sph(0.18, eyeG, -0.28, 0, 0, 8));
            for (const s of [1, -1]) { const f = add(mesh(wing([[0.1, 0], [0.5, 0.45], [0.25, 0.45], [-0.1, 0]], 0.04), hullL)); f.rotation.x = s * Math.PI / 2 + Math.PI / 2; }
            P.spin.push(add(mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 20), glow(c, 1.6))));
            break;
        }
        case 'dart': {
            add(mesh(body([[-0.8, 0.02], [-0.5, 0.18], [0.3, 0.22], [0.7, 0.0]]), hullD)).rotation.y = Math.PI;
            const w = add(mesh(wing([[0.3, 0], [0.8, 0.7], [0.6, 0.75], [-0.2, 0]], 0.05), hullL)); w.rotation.y = Math.PI;
            const w2 = w.clone(); w2.scale.z = -1; add(w2);
            P.eye = add(sph(0.12, eyeG, -0.55, 0.05, 0, 8));
            const fl = add(flame(0xff8040, 0.8, 0.14)); fl.rotation.y = Math.PI; fl.position.x = 0.7; P.flames.push(fl);
            break;
        }
        case 'pod': case 'mine': case 'egg': {
            const r = kind === 'pod' ? 0.7 : kind === 'egg' ? 0.5 : 0.55;
            if (kind === 'egg') { const e = add(sph(r, flesh(0x60ff90, 0x40ff80), 0, 0, 0, 14)); e.scale.set(1.2, 0.9, 0.9); P.eye = add(sph(0.2, glow(0xb0ffc0, 2), 0, 0, 0, 8)); break; }
            add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), kind === 'mine' ? metal(0x3a1018) : hullD));
            const spikes = new THREE.Group();
            for (let i = 0; i < 8; i++) { const s = cyl(0, 0.1, 0.5, kind === 'mine' ? glow(RED, 2) : hullL, 6); const a = (i / 8) * Math.PI * 2; s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); s.rotation.z = a - Math.PI / 2; spikes.add(s); }
            add(spikes); P.spin.push(spikes);
            P.eye = add(sph(0.22, eyeG, -r * 0.8, 0, 0, 8));
            break;
        }
        case 'gunship': case 'sentinel': case 'bearer': {
            add(box(1.8, 0.7, 1.0, hullD, 0, 0, 0));
            add(box(1.0, 0.4, 0.8, hullL, 0.3, 0.5, 0));
            for (const z of [0.6, -0.6]) { const b = cyl(0.09, 0.09, 1.0, hullL, 6); b.rotation.z = Math.PI / 2; b.position.set(-1.1, -0.15, z); add(b); }
            P.eye = add(box(0.15, 0.2, 0.6, eyeG, -0.92, 0.12, 0));
            if (kind === 'sentinel') { add(sph(0.38, hullL, 0.1, 0.95, 0, 10)); P.eye = add(sph(0.12, eyeG, -0.18, 0.98, 0, 8)); for (const z of [0.75, -0.75]) add(box(0.4, 1.3, 0.25, hullD, 0.2, -0.4, z)); }
            if (kind === 'bearer') { const s = add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20, 1, false, -Math.PI / 2, Math.PI), mat('shieldPlate', () => std(0x80d8ff, { r: 0.1, m: 0.3, e: 0x2080ff, ei: 1.2, t: true, op: 0.7 })))); s.rotation.x = Math.PI / 2; s.rotation.z = Math.PI / 2; s.position.x = -1.2; }
            const fl = add(flame(0xff7030, 1.0, 0.22)); fl.rotation.y = Math.PI; fl.position.x = 0.95; P.flames.push(fl);
            break;
        }
        case 'carrier': case 'cruiser': {
            const L = kind === 'carrier' ? 4.2 : 5.2;
            const hm = mat('hullTex', () => { const t = hullTexture(); return new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.45, metalness: 0.7 }); });
            const b = add(mesh(body([[-L / 2, 0.2], [-L / 2 + 0.6, 1.0], [L / 2 - 0.8, 1.1], [L / 2, 0.6]], 8), hm)); b.rotation.y = Math.PI; b.scale.set(1, 0.85, 0.6);
            add(box(L * 0.4, 0.7, 0.8, hullD, 0.4, 1.1, 0));
            if (kind === 'carrier') add(box(1.6, 0.9, 1.3, glow(0xff8030, 1.2), -L / 2 + 0.6, -0.2, 0));
            for (const z of [0.5, -0.5]) { const fl = add(flame(0x60a0ff, 1.6, 0.35)); fl.rotation.y = Math.PI; fl.position.set(L / 2 + 0.1, 0, z); P.flames.push(fl); }
            P.eye = add(box(0.2, 0.25, 1.2, eyeG, -L / 2 + 0.05, 0.4, 0));
            break;
        }
        case 'manta': case 'shard': case 'shardlet': {
            const cm = crystal(0xa0f8ff, 0x30d0ff);
            if (kind === 'manta') {
                const w = add(mesh(wing([[0.9, 0], [-0.2, 1.4], [-0.7, 1.2], [-0.4, 0]], 0.12), cm)); w.rotation.y = Math.PI;
                const w2 = w.clone(); w2.scale.z = -1; add(w2);
                add(mesh(body([[-0.9, 0.05], [-0.3, 0.3], [0.6, 0.15], [1.0, 0.0]]), cm)).rotation.y = Math.PI;
                P.eye = add(sph(0.16, glow(0xff50d0, 3), -0.6, 0.1, 0, 8));
            } else {
                const s = kind === 'shard' ? 0.7 : 0.35;
                const o = add(mesh(new THREE.OctahedronGeometry(s, 0), crystal(0xffb0f0, 0xff40c0)));
                o.scale.set(1, 1.6, 1);
                P.spin.push(o);
                P.eye = add(sph(s * 0.28, glow(0xffffff, 3), 0, 0, 0, 6));
            }
            break;
        }
        case 'squid': {
            const b = add(sph(0.65, flesh(0x6a3a8a, 0x8030ff), 0.2, 0, 0, 14)); b.scale.set(1.5, 0.9, 0.9);
            P.eye = add(sph(0.16, glow(0x80ffb0, 3), -0.6, 0.15, 0, 8));
            for (let i = 0; i < 5; i++) { const t = cyl(0.08, 0.02, 1.3, flesh(0x6a3a8a, 0x8030ff), 6); const a = -0.6 + i * 0.3; t.position.set(1.3, Math.sin(a) * 0.4, Math.cos(a) * 0.2); t.rotation.z = Math.PI / 2 + a * 0.5; add(t); P.spin.push(t); }
            break;
        }
        case 'eye': case 'tentacleEye': {
            const e = add(eyeball(kind === 'eye' ? 1.1 : 0.7, '#ffd040', '#ff4000', 0xff6020)); P.eye = e.userData.eye;
            if (kind === 'eye') add(mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 28), flesh(0x503040, 0x401020))).rotation.y = Math.PI / 2;
            break;
        }
        case 'serpentHead': case 'segment': case 'crystalSegment': {
            const cm = kind === 'serpentHead' ? crystal(0x90f0ff, 0x30c0ff) : crystal(0xc0f0ff, 0x40a8ff);
            if (kind === 'serpentHead') {
                const h = add(mesh(new THREE.ConeGeometry(0.75, 2.0, 6), cm)); h.rotation.z = Math.PI / 2;
                for (const z of [0.4, -0.4]) { const horn = add(mesh(new THREE.ConeGeometry(0.15, 1.1, 5), cm)); horn.position.set(0.5, 0.5, z); horn.rotation.z = -0.9; }
                P.eye = add(sph(0.14, glow(0xff60e0, 3), -0.3, 0.25, 0, 8));
            } else {
                const o = add(mesh(new THREE.OctahedronGeometry(0.62, 0), cm)); o.scale.set(1.4, 0.9, 0.9); P.spin.push(o);
                P.eye = add(sph(0.12, glow(0x80e8ff, 3), 0, 0, 0, 6));
            }
            break;
        }
        case 'kamikaze': {
            add(mesh(new THREE.ConeGeometry(0.35, 1.3, 6), metal(0x501010))).rotation.z = Math.PI / 2;
            P.eye = add(sph(0.16, glow(0xff2020, 4), 0.3, 0, 0, 8));
            const fl = add(flame(0xffa030, 1.2, 0.2)); fl.rotation.y = Math.PI; fl.position.x = 0.5; P.flames.push(fl);
            break;
        }
        case 'angel': {
            const w = mat('angelWhite', () => std(0xf4f0ff, { r: 0.25, m: 0.4, e: 0x8090ff, ei: 0.3 }));
            const b = add(mesh(body([[-0.9, 0.0], [-0.6, 0.35], [0.4, 0.3], [0.9, 0.0]], 12), w)); b.rotation.z = Math.PI / 2;
            add(sph(0.3, w, 0, 0.95, 0, 12));
            P.spin.push(add(mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), glow(0xffe080, 3))));
            g.children[g.children.length - 1].position.y = 1.4; g.children[g.children.length - 1].rotation.x = Math.PI / 2;
            for (const s of [1, -1]) { const wg = add(mesh(wing([[0, 0], [0.9, 1.6], [0.1, 1.9], [-0.6, 0.6]], 0.04), mat('angelWing', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.8, 1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })))); wg.rotation.x = Math.PI / 2 * s; wg.position.set(0.4, 0.4, 0); P.spin.push(wg); }
            P.eye = add(sph(0.12, glow(0x80a0ff, 4), -0.25, 0.98, 0, 8));
            break;
        }
        case 'turret': case 'bigturret': {
            const s = kind === 'bigturret' ? 1.35 : 1;
            add(mesh(new THREE.SphereGeometry(0.55 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hullD)).rotation.x = Math.PI / 2;
            const barrel = new THREE.Group();
            for (const z of kind === 'bigturret' ? [0.18, -0.18] : [0]) { const b = cyl(0.08 * s, 0.1 * s, 0.9 * s, hullL, 6); b.rotation.z = Math.PI / 2; b.position.set(-0.45 * s, 0, z); barrel.add(b); }
            add(barrel); g.userData.barrel = barrel;
            P.eye = add(sph(0.14 * s, eyeG, 0, 0, 0.45 * s, 8));
            break;
        }
        case 'haloRing': {
            P.spin.push(add(mesh(new THREE.TorusGeometry(1.0, 0.14, 8, 40), glow(0xffe090, 2.6))));
            P.eye = add(sph(0.3, mat('heartCore', () => std(0xffffff, { e: 0xffe8a0, ei: 2 })), 0, 0, 0, 12));
            break;
        }
        case 'engine': {
            const n = cyl(0.75, 1.0, 1.6, hullD, 14); n.rotation.z = Math.PI / 2; add(n);
            add(mesh(new THREE.TorusGeometry(0.85, 0.12, 8, 24), hullL)).rotation.y = Math.PI / 2;
            P.eye = add(sph(0.62, glow(0xff5030, 3), 0.55, 0, 0, 14));
            const fl = add(flame(0xff6030, 3.0, 0.7)); fl.rotation.y = Math.PI; fl.position.x = 0.9; P.flames.push(fl);
            break;
        }
        default:
            add(sph(0.5, hullD, 0, 0, 0));
    }
    g.userData.parts = P;
    return g;
}

// ---------------------------------------------------------------------------- bosses (bodies; their parts are enemies)
export function bossModel(key) {
    const g = new THREE.Group();
    const P = { eye: null, core: null, glows: [], spin: [], extra: {} };
    const add = (o) => (g.add(o), o);
    const hullD = metal(0x24262e), hullL = metal(0x8c909c), boneM = mat('boneHull', () => std(0xe0d6c0, { r: 0.6, m: 0.2 }));
    if (key === 'bellwether') {
        // a bell-and-whale hull matching the sim's wall box (x -5.2..8.3, y ±2.4)
        const t = hullTexture();
        const hm = mat('bellHull', () => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xff8050, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0.65 }));
        const h = add(mesh(body([[-5.6, 0.4], [-4.8, 2.0], [-2, 2.55], [3, 2.5], [6.5, 2.2], [8.6, 1.3]], 18), hm)); h.scale.set(1, 1, 1.4);
        for (let i = 0; i < 6; i++) { const r = add(mesh(new THREE.TorusGeometry(2.6, 0.16, 6, 28, Math.PI), boneM)); r.position.x = -3 + i * 2; r.rotation.y = Math.PI / 2; r.scale.z = 1.4; }
        add(box(4.2, 1.4, 2.2, hullD, 1.2, 2.9, 0));
        for (let i = 0; i < 5; i++) add(cyl(0.12, 0.2, 1.2 + i * 0.3, hullL)).position.set(-2 + i * 1.4, 3.4 + i * 0.15, 0);
        P.core = add(sph(1.3, mat('bellCore', () => std(0x200408, { e: 0xff2030, ei: 2.5, r: 0.2 })), -6.0, 0, 0, 20));
        for (const z of [0.9, -0.9]) P.glows.push(add(sph(0.22, glow(0xff2020, 4), -5.2, 0.6, z, 8)));
    } else if (key === 'wyrm') {
        const cm = crystal(0x90f8ff, 0x40d0ff);
        const head = add(mesh(new THREE.ConeGeometry(1.25, 3.4, 6), cm)); head.rotation.z = Math.PI / 2;
        const jaw = add(mesh(new THREE.ConeGeometry(0.8, 2.6, 5), crystal(0xffa0f0, 0xff40d0))); jaw.rotation.z = Math.PI / 2 + 0.25; jaw.position.set(0.3, -0.6, 0); P.extra.jaw = jaw;
        for (const z of [0.7, -0.7]) for (let i = 0; i < 3; i++) { const horn = add(mesh(new THREE.ConeGeometry(0.2, 1.8 - i * 0.4, 5), cm)); horn.position.set(0.8 + i * 0.6, 0.9 - i * 0.1, z); horn.rotation.z = -1.0 + i * 0.15; }
        P.core = add(sph(0.5, glow(0xffffff, 2.5), -0.8, 0.2, 0, 12));
        for (const z of [0.55, -0.55]) P.glows.push(add(sph(0.2, glow(0xff60e0, 4), -0.2, 0.45, z, 8)));
    } else if (key === 'organ') {
        // a wall of organ pipes (sim wall x 0.4..6.4, y ±9) with the eye in front
        const pipeM = mat('pipe', () => std(0x6a4a40, { r: 0.35, m: 0.8, e: 0x401008, ei: 0.4 }));
        for (let i = 0; i < 14; i++) {
            const h = 6 + Math.abs(Math.sin(i * 1.7)) * 12;
            const p = add(cyl(0.55, 0.55, h, pipeM, 10)); p.position.set(1.2 + (i % 3) * 1.6, (i - 6.5) * 1.3, -1 - (i % 2));
            p.scale.y = 1; p.rotation.z = 0;
            p.position.y = (i - 6.5) * 1.25;
            const mouth = add(sph(0.35, glow(0xff4020, 1.5 + (i % 3)), p.position.x - 0.45, p.position.y, p.position.z + 0.5, 6)); P.glows.push(mouth);
        }
        add(box(6, 18.5, 2, mat('organFlesh', () => std(0x401818, { r: 0.8, m: 0.1, e: 0x300606, ei: 0.6 })), 3.4, 0, -2.5));
        for (let i = 0; i < 8; i++) { const v = add(new THREE.Mesh(new THREE.TorusGeometry(3 + i * 0.4, 0.12, 6, 20, Math.PI * 0.8), flesh(0x802020, 0xff2010))); v.position.set(-0.4, 0, 0.5); v.rotation.set(0, Math.PI / 2, i * 0.8); }
        const eye = add(eyeball(1.8, '#ff9020', '#ff1000', 0xff3010)); eye.position.set(-1.2, 0, 0.8); P.eye = eye.userData.eye; P.core = eye;
        const lid = add(mesh(new THREE.SphereGeometry(1.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('lid', () => std(0x5a2820, { r: 0.7, m: 0.2, side: THREE.DoubleSide })))); lid.position.copy(eye.position); P.extra.lidTop = lid;
        const lid2 = lid.clone(); lid2.rotation.x = Math.PI; add(lid2); P.extra.lidBot = lid2;
    } else if (key === 'titan') {
        const armor = metal(0x40424c), red = paint(0xa01822), gold = metal(0xd0a050);
        add(box(2.4, 2.6, 2.0, armor, 0.6, 0.2, 0));                 // torso
        add(box(2.8, 0.8, 2.4, red, 0.6, 1.4, 0));                    // chest plate
        add(box(1.0, 0.9, 0.9, armor, 0.4, 1.9, 0));                  // neck
        const head = add(box(1.1, 0.9, 1.0, red, 0.4, 2.5, 0)); P.extra.head = head;
        P.glows.push(add(box(0.12, 0.18, 0.8, glow(0xff3030, 4), -0.18, 2.55, 0)));
        for (const z of [1.2, -1.2]) add(box(1.4, 1.0, 0.8, red, 0.6, 1.9, z));         // shoulders
        for (const z of [0.6, -0.6]) { const leg = add(box(0.8, 3.2, 0.8, armor, 0.8, -2.6, z)); leg.rotation.z = 0.1; add(box(1.2, 0.5, 1.0, red, 0.6, -4.3, z)); }
        add(box(1.0, 1.0, 2.2, armor, 0.6, -0.9, 0));
        P.core = add(sph(0.6, glow(0xff5050, 2.2), 0.4, 1.2, 1.05, 12));
        for (let i = 0; i < 3; i++) { const fl = add(flame(0x80b0ff, 2.5, 0.4)); fl.rotation.z = Math.PI / 2; fl.position.set(1.5, -0.5 - i * 0.6, -1.1); fl.rotation.y = Math.PI; }
        // the arms reach for the cannon and the sword (parts in the sim)
        const armC = add(box(0.7, 2.4, 0.7, armor, -1.2, 0.4, 1.4)); armC.rotation.z = 0.7;
        const armS = add(box(0.6, 2.2, 0.6, armor, -0.5, 1.6, -1.4)); armS.rotation.z = -0.4;
        const blade = add(box(0.2, 4.5, 0.25, glow(0xa070ff, 3), -1.9, 3.6, -1.4)); blade.rotation.z = 0.6; P.extra.blade = blade;
        add(box(0.6, 0.6, 0.6, gold, -1.6, 2.2, -1.4));
    } else if (key === 'mother') {
        const eye = add(eyeball(2.0, '#ffe030', '#20a050', 0x40ff80)); P.eye = eye.userData.eye; P.core = eye;
        add(mesh(new THREE.TorusGeometry(2.3, 0.35, 10, 30), flesh(0x5a2a6a, 0x6020a0))).rotation.y = Math.PI / 2;
        const back = add(sph(2.6, flesh(0x3a1a4a, 0x4010a0), 1.2, 0, -0.8, 20)); back.scale.set(1.2, 1.1, 1);
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; P.glows.push(add(sph(0.12, glow(i % 2 ? 0x40ff90 : 0xb060ff, 3), 1.3 + Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.9, 6))); }
        // tentacles are drawn by the view between the body and each tentacle part
        P.extra.tentacles = [];
        for (let i = 0; i < 6; i++) {
            const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 1, 8, 1, true), flesh(0x5a2a6a, 0x6020a0));
            add(tm); P.extra.tentacles.push(tm);
        }
    } else if (key === 'heart') {
        const white = mat('heartWhite', () => std(0xf8f4ff, { r: 0.2, m: 0.5, e: 0xa0b8ff, ei: 0.4 }));
        const face = add(sph(1.4, white, 0, 0, 0.2, 28)); face.scale.set(0.8, 1.1, 0.9); P.core = face;
        for (const z of [0.42, -0.42]) P.glows.push(add(sph(0.12, glow(0xffffff, 6), -1.05, 0.25, z, 8)));
        add(box(0.05, 0.4, 0.5, glow(0x80a0ff, 3), -1.12, -0.45, 0.2));
        const crown = add(mesh(new THREE.TorusGeometry(2.0, 0.08, 6, 60), glow(0xffd870, 3))); crown.position.set(0.6, 1.5, 0); crown.rotation.y = Math.PI / 2; P.spin.push(crown);
        const wm = mat('heartWing', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.9, 1.8), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        P.extra.wings = [];
        for (let i = 0; i < 6; i++) {
            const w = add(mesh(wing([[0, 0], [2.2, 3.6], [1.0, 4.8], [-0.4, 3.4]], 0.02), wm));
            w.rotation.x = Math.PI / 2;
            w.rotation.z = (i < 3 ? 1 : -1) * (0.4 + (i % 3) * 0.5) + (i < 3 ? 0 : Math.PI);
            w.position.set(1.2, 0, -0.6);
            P.extra.wings.push(w);
        }
        const robe = add(mesh(body([[-0.6, 0.6], [-2.5, 1.6], [-5, 2.2]], 16), mat('robe', () => std(0xfff4e0, { r: 0.5, m: 0.2, e: 0xffd090, ei: 0.25, t: true, op: 0.85 }))));
        robe.rotation.z = Math.PI / 2; robe.position.set(0.4, -0.4, 0);
    }
    g.userData.parts = P;
    return g;
}

// ---------------------------------------------------------------------------- items
const capTex = {};
function letterTexture(ch, col) {
    if (capTex[ch]) return capTex[ch];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
    x.font = 'bold 72px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(ch, 64, 68);
    x.fillStyle = '#fff'; x.fillText(ch, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return (capTex[ch] = t);
}
export function capsule(kind, color) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat('capShell' + kind, () => std(color, { r: 0.1, m: 0.3, e: color, ei: 0.7, t: true, op: 0.55 })));
    g.add(shell);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(kind === 'U' ? '1UP' : kind, '#' + new THREE.Color(color).getHexString()), depthWrite: false, toneMapped: false }));
    sp.scale.setScalar(kind === 'U' ? 1.2 : 0.95);
    g.add(sp);
    g.userData.shell = shell;
    return g;
}
