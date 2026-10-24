// Things you collect, break, step on or read: pearls, curios, crates, sponges, barrels, vents,
// switches, gates, flags, signs, hazards. Static ones are built once; each has an update that
// follows the sim.

import { THREE, G, toon, inked, mesh, Merger, glowSprite, canvasTex, textTexture, shade, mix, clamp, smooth, lerp } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SIGNS, PARTS } from '../sim/data.js';

const TAU = Math.PI * 2;
const part = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o = {}) => {
    const m = o.ink === false ? mesh(geo, toon(color, o.mat), { cast: true }) : inked(geo, toon(color, o.mat), o.ink ?? 0.03);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
};

// ================================================================ pearls
export class Pearls {
    constructor(list) {
        this.list = list;
        const n = Math.max(1, list.length);
        this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshToonMaterial({ color: 0xfff2f8, gradientMap: null, emissive: 0x6a4a66 }), n);
        this.mesh.material = toon(0xfff4fa, { emissive: 0x7a5a7a });
        this.mesh.castShadow = false;
        this.mesh.frustumCulled = false;
        this.halo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd6f2, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }), n);
        this.halo.frustumCulled = false;
        this.root = new THREE.Group(); this.root.add(this.mesh, this.halo);
        this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
        this.pop = new Map();
    }
    update(G0, t) {
        const L = G0.pearlL;
        let k = 0;
        for (let i = 0; i < L.length; i++) {
            const q = L[i];
            if (q.got) continue;
            const bob = Math.sin(t * 2.6 + i * 0.7) * 0.07;
            this.p.set(q.x, q.y + bob, q.z);
            const sc = 1 + Math.sin(t * 5 + i) * 0.04;
            this.s.set(sc, sc, sc);
            this.m.compose(this.p, this.q, this.s);
            this.mesh.setMatrixAt(k, this.m);
            this.s.setScalar(sc * (1 + Math.sin(t * 3 + i * 1.3) * 0.2));
            this.m.compose(this.p, this.q, this.s);
            this.halo.setMatrixAt(k, this.m);
            k++;
        }
        this.mesh.count = k; this.halo.count = k;
        this.mesh.instanceMatrix.needsUpdate = true; this.halo.instanceMatrix.needsUpdate = true;
    }
}

// ================================================================ curios (the found things)
function curioModel(kind) {
    const g = new THREE.Group();
    const gold = 0xffd34d;
    switch (kind) {
        case 'cap': {
            g.add(part(G.cyl(0.3, 0.32, 0.12, 16), 0xe94b4b, 0, 0, 0, 1, 1, 1, { ink: 0.025 }));
            g.add(part(G.cyl(0.34, 0.34, 0.05, 16), 0xf6d34d, 0, 0.07, 0, 1, 1, 1, { ink: false }));
            g.rotation.x = 0.5; break;
        }
        case 'button': {
            g.add(part(G.cyl(0.32, 0.32, 0.1, 18), 0x4d96ff, 0, 0, 0, 1, 1, 1, { ink: 0.025, rot: [Math.PI / 2, 0, 0] }));
            for (const [x, y] of [[-0.1, -0.1], [0.1, 0.1], [-0.1, 0.1], [0.1, -0.1]]) g.add(part(G.sphere(0.045, 6, 5), 0x1a2a5a, x, y, 0.06, 1, 1, 0.5, { ink: false }));
            break;
        }
        case 'glass': {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshToonMaterial({ color: 0x5ee8c8, gradientMap: null, transparent: true, opacity: 0.85, emissive: 0x1a6a5a }));
            m.material = toon(0x5ee8c8, { opacity: 0.85, emissive: 0x1a6a5a }); m.scale.set(1, 1.15, 0.8); g.add(m); break;
        }
        case 'spring': {
            for (let i = 0; i < 5; i++) g.add(part(G.torus(0.2, 0.05, 6, 14), i % 2 ? 0xdde6ee : 0xb4c2d0, 0, -0.22 + i * 0.11, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
            break;
        }
        case 'gear': {
            g.add(part(G.cyl(0.26, 0.26, 0.1, 14), 0xc99a4a, 0, 0, 0, 1, 1, 1, { ink: 0.025, rot: [Math.PI / 2, 0, 0] }));
            for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.add(part(G.box(0.11, 0.11, 0.1), 0xc99a4a, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 1, 1, 1, { ink: false, rot: [0, 0, a] })); }
            g.add(part(G.cyl(0.09, 0.09, 0.12, 8), 0x6a4a1a, 0, 0, 0, 1, 1, 1, { ink: false, rot: [Math.PI / 2, 0, 0] }));
            break;
        }
        case 'string': {
            const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.2, 0.06, 40, 6, 2, 3), toon(0xf0c27a));
            m.castShadow = true; g.add(m); break;
        }
        case 'cork': {
            g.add(part(G.cyl(0.18, 0.15, 0.4, 12), 0xd49a5a, 0, 0, 0, 1, 1, 1, { ink: 0.025 }));
            g.rotation.z = 0.7; break;
        }
        case 'spoon': {
            g.add(part(G.cyl(0.03, 0.04, 0.5, 6), 0xdde6ee, 0, -0.1, 0, 1, 1, 1, { ink: false }));
            g.add(part(G.sphere(0.13, 10, 8), 0xdde6ee, 0, 0.22, 0, 1, 1.3, 0.4, { ink: 0.02 }));
            g.rotation.z = 0.5; break;
        }
        case 'magnet': {
            const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 16, Math.PI), toon(0xe94b4b)); m.castShadow = true; m.rotation.z = 0; g.add(m);
            for (const s of [-1, 1]) { g.add(part(G.cyl(0.08, 0.08, 0.22, 8), 0xe94b4b, s * 0.2, -0.11, 0, 1, 1, 1, { ink: false })); g.add(part(G.cyl(0.082, 0.082, 0.08, 8), 0xdde6ee, s * 0.2, -0.25, 0, 1, 1, 1, { ink: false })); }
            break;
        }
        case 'bulb': {
            g.add(part(G.sphere(0.22, 12, 10), 0xfff4a0, 0, 0.1, 0, 1, 1, 1, { ink: 0.025, mat: { emissive: 0x806a20 } }));
            g.add(part(G.cyl(0.1, 0.12, 0.2, 8), 0xaab4c0, 0, -0.15, 0, 1, 1, 1, { ink: 0.02 }));
            break;
        }
        default: g.add(part(G.sphere(0.25, 8, 6), gold));
    }
    return g;
}

export class Curios {
    constructor(list) {
        this.root = new THREE.Group();
        this.items = list.map((c) => {
            const g = new THREE.Group();
            g.position.set(c.x, c.y, c.z);
            const model = curioModel(c.kind);
            model.scale.setScalar(1.5);
            const ring = mesh(G.torus(0.62, 0.035, 6, 24), toon(0xffd34d, { emissive: 0x806a20 }), { cast: false });
            ring.rotation.x = Math.PI / 2;
            const halo = glowSprite(0xffe08a, 2.4, 0.6);
            const beam = mesh(G.cyl(0.1, 0.32, 6, 10, 1), new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }), { cast: false });
            beam.position.y = 3;
            g.add(model, ring, halo, beam);
            this.root.add(g);
            return { g, model, ring, halo, beam, c };
        });
    }
    update(G0, t) {
        this.items.forEach((it, i) => {
            const got = G0.curioL[i].got;
            it.g.visible = !got;
            if (got) return;
            it.g.position.y = it.c.y + Math.sin(t * 2 + i) * 0.12;
            it.model.rotation.y = t * 1.6 + i;
            it.ring.rotation.z = t * 1.2;
            it.ring.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.05);
            it.halo.material.opacity = 0.5 + Math.sin(t * 3 + i) * 0.15;
        });
    }
}

// ================================================================ crates
const crateTextures = {};
function crateTex(kind) {
    if (crateTextures[kind]) return crateTextures[kind];
    const S = 128;
    const t = canvasTex(S, S, (c) => {
        const base = { wood: '#d9a15c', pearl: '#d9a15c', iron: '#8c97a6', check: '#58c866', heart: '#f2688c' }[kind];
        c.fillStyle = base; c.fillRect(0, 0, S, S);
        const edge = { wood: '#7a4a22', pearl: '#7a4a22', iron: '#4a5360', check: '#2a7a3a', heart: '#a02a50' }[kind];
        c.strokeStyle = edge; c.lineWidth = 10; c.strokeRect(5, 5, S - 10, S - 10);
        c.lineWidth = 7;
        if (kind === 'wood' || kind === 'pearl') {
            c.beginPath(); c.moveTo(10, 10); c.lineTo(S - 10, S - 10); c.moveTo(S - 10, 10); c.lineTo(10, S - 10); c.stroke();
            c.strokeStyle = 'rgba(122,74,34,0.35)'; c.lineWidth = 3;
            for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(14, i * 32); c.lineTo(S - 14, i * 32 + 3); c.stroke(); }
        }
        if (kind === 'pearl') {
            const g = c.createRadialGradient(54, 50, 4, 64, 64, 34); g.addColorStop(0, '#fff'); g.addColorStop(1, '#f7b6dc');
            c.fillStyle = g; c.beginPath(); c.arc(64, 64, 32, 0, TAU); c.fill(); c.strokeStyle = '#7a4a22'; c.lineWidth = 5; c.stroke();
        }
        if (kind === 'iron') {
            c.beginPath(); c.moveTo(10, 10); c.lineTo(S - 10, S - 10); c.moveTo(S - 10, 10); c.lineTo(10, S - 10); c.stroke();
            c.fillStyle = '#d6dde6';
            for (const [x, y] of [[18, 18], [S - 18, 18], [18, S - 18], [S - 18, S - 18], [64, 64]]) { c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }
        }
        if (kind === 'check') {
            c.fillStyle = '#fff'; c.font = '700 84px Fredoka, Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('C', 64, 70);
        }
        if (kind === 'heart') {
            c.fillStyle = '#fff'; c.beginPath();
            c.moveTo(64, 98); c.bezierCurveTo(20, 66, 28, 28, 64, 50); c.bezierCurveTo(100, 28, 108, 66, 64, 98); c.fill();
        }
    });
    t.userData.keep = true;                    // shared by every crate of its kind, in every level
    crateTextures[kind] = t;
    return t;
}
let crateGeo = null;

export class Crates {
    constructor(list) {
        this.root = new THREE.Group();
        crateGeo = crateGeo || new RoundedBoxGeometry(0.92, 0.92, 0.92, 3, 0.07);
        this.items = list.map((c) => {
            const m = mesh(crateGeo, toon(0xffffff, { map: crateTex(c.kind) }), { cast: true, receive: true });
            m.position.set(c.x, c.y + 0.46, c.z);
            this.root.add(m);
            if (c.kind === 'check' || c.kind === 'heart') {
                const gl = glowSprite(c.kind === 'check' ? 0x9bff9b : 0xff9ac0, 2.2, 0.35);
                gl.position.y = 0.3; m.add(gl);
            }
            return { m, c, was: 1 };
        });
    }
    update(G0, t, fx) {
        this.items.forEach((it, i) => {
            const c = G0.crates[i];
            if (c.alive) {
                it.m.visible = true;
                const bob = it.c.kind === 'check' || it.c.kind === 'heart' ? Math.sin(t * 2 + i) * 0.04 : 0;
                it.m.position.y = it.c.y + 0.46 + bob;
                it.m.rotation.y = it.c.kind === 'check' ? Math.sin(t * 1.4) * 0.12 : 0;
            } else it.m.visible = false;
        });
    }
}

// ================================================================ sponges
export class Springs {
    constructor(list) {
        this.root = new THREE.Group();
        this.items = list.map((s, i) => {
            const g = new THREE.Group(); g.position.set(s.x, s.y, s.z);
            const body = part(G.cyl(0.62, 0.72, 0.5, 16), 0xffd24a, 0, 0.25, 0, 1, 1, 1, { ink: 0.035 });
            g.add(body);
            for (let k = 0; k < 7; k++) { const a = k * 2.4 + i; g.add(part(G.sphere(0.07, 6, 5), 0xc98a1a, Math.cos(a) * 0.38, 0.5 - (k % 3) * 0.02, Math.sin(a) * 0.38, 1, 0.5, 1, { ink: false })); }
            g.add(part(G.sphere(0.24, 8, 6), 0xff9a52, 0, 0.5, 0, 1, 0.3, 1, { ink: false }));
            const arrow = part(G.cone(0.14, 0.26, 3), 0xffffff, 0, 1.05, 0, 1, 1, 0.4, { ink: false });
            g.add(arrow);
            this.root.add(g);
            return { g, body, arrow };
        });
    }
    update(G0, t) {
        this.items.forEach((it, i) => {
            const pop = G0.springs[i].pop;
            const k = pop > 0 ? Math.sin((1 - pop / 0.35) * Math.PI * 2) * pop * 1.3 : 0;
            it.g.scale.set(1 - k * 0.2, 1 + k * 0.5, 1 - k * 0.2);
            it.arrow.position.y = 1.05 + Math.sin(t * 4 + i) * 0.1;
        });
    }
}

// ================================================================ barrels
export class Barrels {
    constructor(list) {
        this.root = new THREE.Group();
        const lathe = new THREE.LatheGeometry([[0.5, 0], [0.62, 0.3], [0.68, 0.6], [0.62, 0.95], [0.5, 1.2]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
        this.items = list.map((b) => {
            const g = new THREE.Group(); g.position.set(b.x, b.y, b.z);
            const body = inked(lathe, toon(0xb8743a), 0.04);
            g.add(body);
            for (const y of [0.15, 0.6, 1.05]) g.add(part(G.torus(0.6 + (y === 0.6 ? 0.07 : 0), 0.04, 6, 20), 0x4b5563, 0, y, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
            g.add(part(G.cyl(0.46, 0.46, 0.04, 18), 0x2a1a14, 0, 1.19, 0, 1, 1, 1, { ink: false }));
            const arrow = part(G.cone(0.2, 0.5, 4), 0xffd34d, 0, 1.9, 0, 1, 1, 1, { ink: false, mat: { emissive: 0x806a20 } });
            arrow.rotation.x = Math.PI;
            g.add(arrow);
            this.root.add(g);
            return { g, body, arrow, b };
        });
    }
    update(G0, t) {
        this.items.forEach((it, i) => {
            const s = G0.barrels[i];
            it.g.rotation.z = s.shake > 0 ? Math.sin(t * 60) * 0.1 : 0;
            it.g.rotation.x = s.shake > 0 ? Math.cos(t * 55) * 0.1 : 0;
            it.arrow.position.y = 1.9 + Math.sin(t * 4 + i) * 0.14;
            it.arrow.visible = s.cool <= 0;
        });
    }
}

// ================================================================ vents
export class Vents {
    constructor(list) {
        this.root = new THREE.Group();
        this.items = list.map((v) => {
            const g = new THREE.Group(); g.position.set(v.x, v.y, v.z);
            g.add(part(G.cyl(v.r * 0.85, v.r * 1.05, 0.2, 14), 0x6aa6c8, 0, 0.1, 0, 1, 1, 1, { ink: 0.03 }));
            g.add(part(G.torus(v.r * 0.78, 0.09, 6, 16), 0xdff6ff, 0, 0.22, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
            g.add(part(G.cyl(v.r * 0.6, v.r * 0.6, 0.06, 14), 0x7ad8ff, 0, 0.21, 0, 1, 1, 1, { ink: false, mat: { emissive: 0x2a8ab0 } }));
            const col = mesh(G.cyl(v.r * 0.95, v.r * 1.2, v.height, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc8f2ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }), { cast: false });
            col.position.y = v.height / 2;
            g.add(col);
            const rings = [];
            for (let i = 0; i < 3; i++) { const rg = mesh(G.torus(v.r, 0.04, 5, 20), new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.5, depthWrite: false }), { cast: false }); rg.rotation.x = Math.PI / 2; g.add(rg); rings.push(rg); }
            g.userData.rings = rings;
            this.root.add(g);
            return { g, v, col };
        });
    }
    update(G0, t, fx, dt, px, pz) {
        for (const it of this.items) {
            it.col.material.opacity = 0.14 + Math.sin(t * 3 + it.v.x) * 0.03;
            it.g.userData.rings.forEach((rg, i) => { const k = (t * 0.5 + i / 3) % 1; rg.position.y = 0.3 + k * it.v.height * 0.9; rg.material.opacity = 0.55 * (1 - k); rg.scale.setScalar(0.9 + k * 0.25); });
            if (Math.abs(px - it.v.x) < 60 && Math.abs(pz - it.v.z) < 60 && Math.random() < dt * 22) fx.bubbles(it.v.x, it.v.y + 0.3, it.v.z, 1, it.v.r * 0.7);
        }
    }
}

// ================================================================ switches and gates
export class Switches {
    constructor(list) {
        this.root = new THREE.Group();
        this.items = list.map((s) => {
            const g = new THREE.Group(); g.position.set(s.x, s.y, s.z);
            g.add(part(G.cyl(1.1, 1.2, 0.18, 18), 0x6b7280, 0, 0.09, 0, 1, 1, 1, { ink: 0.035 }));
            const btn = part(G.cyl(0.78, 0.86, 0.3, 18), 0xe94b4b, 0, 0.33, 0, 1, 1, 1, { ink: 0.035, mat: { emissive: 0x501010 } });
            g.add(btn);
            for (let i = 0; i < 4; i++) g.add(part(G.box(0.2, 0.06, 0.5), 0xffd34d, 0, 0.13, 0, 1, 1, 1, { ink: false, rot: [0, i * Math.PI / 4, 0] }));
            const arrow = part(G.cone(0.22, 0.5, 4), 0xffffff, 0, 1.6, 0, 1, 1, 1, { ink: false });
            arrow.rotation.x = Math.PI;
            g.add(arrow);
            this.root.add(g);
            return { g, btn, arrow, s };
        });
    }
    update(G0, t) {
        this.items.forEach((it, i) => {
            const down = G0.switchesDown[i];
            it.btn.position.y = down ? 0.2 : 0.33 + Math.sin(t * 3) * 0.02;
            it.btn.material = toon(down ? 0x5aa05a : 0xe94b4b, { emissive: down ? 0x103010 : 0x501010 });
            it.arrow.visible = !down;
            it.arrow.position.y = 1.6 + Math.sin(t * 4) * 0.15;
        });
    }
}

export class Gates {
    constructor(list, theme) {
        this.root = new THREE.Group();
        this.items = list.map((g0) => {
            const g = new THREE.Group();
            const w = Math.max(g0.x1 - g0.x0, g0.z1 - g0.z0), d = Math.min(g0.x1 - g0.x0, g0.z1 - g0.z0);
            const alongX = (g0.x1 - g0.x0) >= (g0.z1 - g0.z0);
            const h = g0.y1 - g0.y0;
            g.position.set((g0.x0 + g0.x1) / 2, g0.y0, (g0.z0 + g0.z1) / 2);
            if (!alongX) g.rotation.y = Math.PI / 2;
            const n = Math.max(3, Math.round(w / 0.55));
            for (let i = 0; i < n; i++) g.add(part(G.cyl(0.11, 0.11, h, 8), 0x55606e, -w / 2 + 0.3 + (i * (w - 0.6)) / (n - 1), h / 2, 0, 1, 1, 1, { ink: 0.025 }));
            g.add(part(G.box(w, 0.28, d * 0.9), 0x44505e, 0, h * 0.78, 0, 1, 1, 1, { ink: 0.03 }));
            g.add(part(G.box(w, 0.28, d * 0.9), 0x44505e, 0, h * 0.2, 0, 1, 1, 1, { ink: 0.03 }));
            const lock = part(G.box(0.8, 0.9, 0.5), 0xe94b4b, 0, h * 0.5, 0, 1, 1, 1, { ink: 0.03, mat: { emissive: 0x501010 } });
            g.add(lock);
            g.add(part(G.torus(0.22, 0.07, 6, 12), 0xffd34d, 0, h * 0.5 + 0.55, 0, 1, 1, 1, { ink: false }));
            this.root.add(g);
            return { g, g0, lock, y0: g0.y0, h };
        });
    }
    update(G0, t, dt) {
        for (const it of this.items) {
            const open = G0.gatesOpen[it.g0.id];
            const target = open ? it.y0 - it.h - 0.3 : it.y0;
            it.g.position.y += (target - it.g.position.y) * Math.min(1, dt * 5);
            it.lock.rotation.z = open ? 0 : Math.sin(t * 6) * 0.05;
        }
    }
}

// ================================================================ the goal and the flags
export function makeGoal(theme) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
        g.add(part(G.cyl(0.18, 0.22, 5.2, 10), 0xf6f0e0, s * 2.6, 2.6, 0, 1, 1, 1, { ink: 0.035 }));
        g.add(part(G.sphere(0.34, 10, 8), 0xffd34d, s * 2.6, 5.35, 0, 1, 1, 1, { ink: 0.03, mat: { emissive: 0x806a20 } }));
    }
    g.add(part(G.box(5.4, 0.2, 0.2), 0xf6f0e0, 0, 4.6, 0, 1, 1, 1, { ink: false }));
    const banner = mesh(new THREE.PlaneGeometry(5.0, 1.6), new THREE.MeshBasicMaterial({ map: textTexture('HOME THIS WAY!', { w: 512, h: 160, bg: '#ff6b6b', fg: '#fff7e0', size: 62, border: '#ffd34d' }), side: THREE.DoubleSide, fog: false }), { cast: false });
    banner.position.set(0, 3.7, 0); g.add(banner);
    const spin = new THREE.Group(); spin.position.set(0, 1.1, 0); g.add(spin);
    spin.add(part(G.cone(0.5, 1.1, 14), 0xffa6c9, 0, 0.1, 0, 1, 1, 1, { ink: 0.035 }));
    for (let i = 0; i < 4; i++) spin.add(part(G.torus(0.44 - i * 0.08, 0.09, 8, 16), i % 2 ? 0xfff0d8 : 0xff7aa8, 0, -0.35 + i * 0.28, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
    g.add(part(G.cyl(0.9, 1.05, 0.3, 16), 0xd8b080, 0, 0.15, 0, 1, 1, 1, { ink: 0.03 }));
    const glow = glowSprite(0xffd6ee, 5, 0.5); glow.position.y = 1.4; g.add(glow);
    return { root: g, spin, glow, banner };
}

export function makeFlag(color = 0x58c866) {
    const g = new THREE.Group();
    g.add(part(G.cyl(0.05, 0.06, 2.0, 6), 0xf6f0e0, 0, 1.0, 0, 1, 1, 1, { ink: false }));
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.9, 0.26); sh.lineTo(0, 0.52); sh.closePath();
    const cloth = mesh(new THREE.ShapeGeometry(sh), toon(color, { side: THREE.DoubleSide, emissive: 0x103010 }), { cast: false });
    cloth.position.set(0.05, 1.45, 0); g.add(cloth);
    g.userData.cloth = cloth;
    return g;
}

// ================================================================ signs
export function makeSign(key) {
    const g = new THREE.Group();
    g.add(part(G.cyl(0.07, 0.09, 1.2, 6), 0x7a4a22, -0.7, 0.6, 0, 1, 1, 1, { ink: 0.02 }));
    g.add(part(G.cyl(0.07, 0.09, 1.2, 6), 0x7a4a22, 0.7, 0.6, 0, 1, 1, 1, { ink: 0.02 }));
    const text = SIGNS[key] || key;
    const plaque = mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1), [toon(0x8a5a2e), toon(0x8a5a2e), toon(0x8a5a2e), toon(0x8a5a2e), new THREE.MeshToonMaterial({ map: textTexture(text, { w: 440, h: 220, size: 40 }), gradientMap: null, color: 0xffffff }), toon(0x8a5a2e)], { cast: true });
    plaque.position.y = 1.35;
    g.add(plaque);
    g.userData.plaque = plaque;
    return g;
}

// ================================================================ hazards
export function makeUrchin() {
    const g = new THREE.Group();
    g.add(part(G.sphere(0.42, 12, 9), 0x3a2a5a, 0, 0.45, 0, 1, 1, 1, { ink: 0.03 }));
    for (let i = 0; i < 18; i++) {
        const a = i * 2.4, b = Math.acos(1 - 2 * ((i + 0.5) / 18));
        const d = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
        const sp = part(G.cone(0.05, 0.4, 5), 0x6a4a9a, d.x * 0.5, 0.45 + d.y * 0.5, d.z * 0.5, 1, 1, 1, { ink: false });
        sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        g.add(sp);
    }
    return g;
}

export function makeSpinner(h) {
    const g = new THREE.Group();
    g.add(part(G.cyl(0.4, 0.5, 0.9, 12), 0x6b7280, 0, 0.45, 0, 1, 1, 1, { ink: 0.035 }));
    const arms = new THREE.Group(); arms.position.y = 0.55; g.add(arms);
    const L = h.len || 4, n = h.arms || 2;
    for (let k = 0; k < n; k++) {
        const a = (k * TAU) / n;
        const arm = new THREE.Group(); arm.rotation.y = -a;
        arm.add(part(G.box(L, 0.22, 0.26), 0xb8743a, L / 2, 0, 0, 1, 1, 1, { ink: 0.03 }));
        arm.add(part(G.sphere(0.38, 10, 8), 0xe94b4b, L, 0, 0, 1, 1, 1, { ink: 0.03 }));
        for (let s = 0; s < 4; s++) arm.add(part(G.cone(0.06, 0.2, 4), 0xf6f0e0, L + Math.cos(s * 1.57) * 0.3, Math.sin(s * 1.57) * 0.3, 0, 1, 1, 1, { ink: false, rot: [0, 0, s * 1.57 - 1.57] }));
        arms.add(arm);
    }
    g.userData.arms = arms;
    return g;
}
