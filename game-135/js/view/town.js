// The town: the painted ground, the river, trees and buildings, and everything a job leaves behind (asphalt,
// holes, concrete, bridge spans, a park). Reads G; never changes it.

import * as THREE from 'three';
import { WORLD, WORK } from '../config.js';
import { ROADS, RIVER, BRIDGE, BUILDINGS, TREES, ZONES } from '../sim/data/city.js';
import { JOBS } from '../sim/data/jobs.js';
import { buildingUp, cellsOf } from '../sim/world.js';
import { hash3 } from '../rng.js';
import { model } from './models.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); return b; };
const box = (w, h, d, m, x, y, z) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z); b.castShadow = true; return b; };
const disc = (r, color, x, z, y = 0.03) => { const d = mesh(new THREE.CircleGeometry(r, 28), mat(color), x, y, z); d.rotation.x = -Math.PI / 2; d.receiveShadow = true; return d; };

const HOUSE_HUES = [0xf3e3b5, 0xa9d4f5, 0xf5b7a0, 0xc8e6a0, 0xe7c6f0, 0xf7dc7a, 0xb7e3d8];
/** How far each Meshy building must be turned for its front door to be +Z (checked on dev/gallery.html). */
export const BYAW = { townhall: 0, school: 0, cannery: 0, barn: 0, house: 0, shop: 0 };
const HAS_MODEL = new Set(Object.keys(BYAW));

// ------------------------------------------------------------------------------------------------ ground
function groundTexture() {
    const S = 16, c = document.createElement('canvas');
    c.width = WORLD.w * S; c.height = WORLD.h * S;
    const g = c.getContext('2d');
    const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * S, y * S, w * S, h * S); };
    rect(0, 0, WORLD.w, WORLD.h, '#74c24c');
    for (let i = 0; i < 9000; i++) {                       // mown-grass speckle
        g.fillStyle = hash3(i, 1, 2) < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,60,0,0.08)';
        g.fillRect(hash3(i, 3, 4) * c.width, hash3(i, 5, 6) * c.height, 5, 5);
    }
    rect(4, 20, 24, 24, '#cdb98d'); rect(4, 52, 24, 24, '#b9b3a6'); rect(36, 36, 24, 8, '#dccfb6'); rect(36, 52, 24, 24, '#aaa08c');
    for (let i = 0; i < 13; i++) rect(115, 51 + i * 2, 12, 1.1, i % 2 ? '#8a6238' : '#76522d');     // the ploughed field
    rect(RIVER.x - 1.5, 0, RIVER.w + 3, WORLD.h, '#e6d7a0');                                          // sandy banks
    for (const r of ROADS) rect(r.x - 0.4, r.y - 0.4, r.w + 0.8, r.h + 0.8, '#e9e4d6');               // kerbs
    for (const r of ROADS) rect(r.x, r.y, r.w, r.h, '#565a62');
    g.fillStyle = '#f6d24a';
    for (const r of ROADS) {
        const horiz = r.w > r.h, len = horiz ? r.w : r.h;
        for (let t = 1; t < len - 1; t += 4) {
            const x = horiz ? r.x + t : r.x + r.w / 2 - 0.15, y = horiz ? r.y + r.h / 2 - 0.15 : r.y + t;
            if (ROADS.some((o) => o !== r && x > o.x - 0.5 && x < o.x + o.w + 0.5 && y > o.y - 0.5 && y < o.y + o.h + 0.5)) continue;   // no dashes across a junction
            g.fillRect(x * S, y * S, (horiz ? 2 : 0.3) * S, (horiz ? 0.3 : 2) * S);
        }
    }
    // the loading bay at the quarry and the parking bays in the yard
    g.strokeStyle = '#ffffff'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) g.strokeRect((17 + i * 2.6) * S, 55 * S, 2.6 * S, 5 * S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

function hazardTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f6c21c'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1d1d1f';
    for (let i = -8; i < 16; i += 2) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 32 + 256, 256); g.lineTo(i * 32 + 256, 256); g.fill(); }
    g.globalCompositeOperation = 'destination-in';
    g.beginPath(); g.arc(128, 128, 126, 0, 7); g.arc(128, 128, 96, 0, 7, true); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ------------------------------------------------------------------------------------------------ buildings
function standIn(b) {
    const g = new THREE.Group(), w = b.w, d = b.h, k = b.kind, tall = b.tall;
    const roof = (color, h = tall * 0.35, y = tall * 0.65) => {
        const r = mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), mat(color), 0, y + h / 2, 0);
        r.rotation.y = Math.PI / 4; r.scale.set(w * 1.08, h, d * 1.08); r.castShadow = true; g.add(r);
    };
    if (k === 'rock') {
        for (let i = 0; i < 6; i++) {
            const r = mesh(new THREE.DodecahedronGeometry(1), mat(0x9a948a, { flatShading: true }), -w / 2 + (i + 0.5) * w / 6, tall * 0.3, (hash3(i, 7, 1) - 0.5) * d * 0.4);
            r.scale.set(w / 9, tall * (0.5 + hash3(i, 2, 2) * 0.5), d * 0.7); r.castShadow = true; g.add(r);
        }
    } else if (k === 'gazebo') {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.3, tall * 0.7, 0.3, mat(0xffffff), sx * w * 0.4, tall * 0.35, sz * d * 0.4));
        g.add(box(w, 0.3, d, mat(0xe9dcc0), 0, 0.15, 0));
        roof(0xd9382b, tall * 0.4, tall * 0.7);
    } else if (k === 'statue') {
        g.add(box(w, 1.6, d, mat(0xd9d2c2), 0, 0.8, 0));
        const gold = mat(0xf6c21c, { roughness: 0.3, metalness: 0.7 });
        const hat = mesh(new THREE.SphereGeometry(1.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 1.75, 0); hat.castShadow = true; g.add(hat);
        const brim = mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.14, 24), gold, 0, 1.75, 0.15); brim.castShadow = true; g.add(brim);
    } else {
        const wall = { townhall: 0xc0563f, school: 0xcf3b33, garage: 0x8f9aa3, cannery: 0x8a6a55, shop: 0x8fd9c0, barn: 0xc8372d }[k] ?? HOUSE_HUES[(b.hue || 0) % HOUSE_HUES.length];
        g.add(box(w, tall * 0.65, d, mat(wall), 0, tall * 0.325, 0));
        if (k === 'garage') { g.add(box(w * 1.04, 0.4, d * 1.04, mat(0x5d6770), 0, tall * 0.65 + 0.2, 0)); g.add(box(w * 0.6, tall * 0.45, 0.2, mat(0x2a2f36), 0, tall * 0.23, d / 2)); }
        else roof({ townhall: 0x5fae95, school: 0x8f9499, cannery: 0xa8603a, shop: 0x6fc9aa, barn: 0xf2f2f2 }[k] ?? 0xe58a3c);
        if (k === 'townhall') g.add(box(3, tall * 0.6, 3, mat(0xc0563f), 0, tall * 0.9, 0));
        g.add(box(1.4, 2.2, 0.2, mat(0x7a4a2a), 0, 1.1, d / 2));        // the front door, on +Z
    }
    return g;
}

export class Town {
    constructor(scene, { shadows = true } = {}) {
        this.scene = scene;
        const far = mesh(new THREE.PlaneGeometry(900, 900), mat(0x69b644), WORLD.w / 2, -0.05, WORLD.h / 2);
        far.rotation.x = -Math.PI / 2; scene.add(far);
        const ground = mesh(new THREE.PlaneGeometry(WORLD.w, WORLD.h), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }), WORLD.w / 2, 0, WORLD.h / 2);
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = shadows; scene.add(ground);
        // the river runs on past the edges of the map
        this.water = mesh(new THREE.PlaneGeometry(RIVER.w, 900), new THREE.MeshStandardMaterial({ color: 0x3fa7e0, roughness: 0.25, metalness: 0.1 }), RIVER.x + RIVER.w / 2, 0.02, WORLD.h / 2);
        this.water.rotation.x = -Math.PI / 2; scene.add(this.water);

        // trees: two instanced meshes; a ring of them hides the edge of the world
        const spots = TREES.map((t) => ({ ...t }));
        for (let i = 0; i < 90; i++) {
            const a = (i / 90) * Math.PI * 2, r = 1.12 + hash3(i, 4, 4) * 0.25;
            const x = WORLD.w / 2 + Math.cos(a) * WORLD.w * 0.62 * r, y = WORLD.h / 2 + Math.sin(a) * WORLD.h * 0.72 * r;
            if (x > RIVER.x - 3 && x < RIVER.x + RIVER.w + 3) continue;
            spots.push({ x, y, s: 1.2 + hash3(i, 9, 1) * 1.2 });
        }
        const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), mat(0x7a5230), spots.length);
        const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 1), mat(0x3f9b3f, { flatShading: true }), spots.length);
        const o = new THREE.Object3D(), col = new THREE.Color();
        spots.forEach((t, i) => {
            o.position.set(t.x, 0.8 * t.s, t.y); o.scale.setScalar(t.s); o.rotation.set(0, hash3(i, 1, 1) * 6, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
            o.position.y = 2.3 * t.s; o.scale.set(t.s, t.s * 1.15, t.s); o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
            leaves.setColorAt(i, col.setHSL(0.3 + hash3(i, 6, 6) * 0.06, 0.55, 0.36 + hash3(i, 8, 8) * 0.1));
        });
        trunks.castShadow = leaves.castShadow = shadows;
        scene.add(trunks, leaves);

        // buildings
        this.buildings = BUILDINGS.map((b) => {
            const odd = (b.f || 0) % 2 === 1;
            const g = HAS_MODEL.has(b.kind)
                ? model('bld-' + b.kind, { w: odd ? b.h : b.w, d: odd ? b.w : b.h }, withFacing(standIn(b), b, true), { yaw: BYAW[b.kind] })
                : standIn(b);
            g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
            if (HAS_MODEL.has(b.kind)) g.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][b.f || 0];
            g.visible = false;
            scene.add(g);
            return { b, g, shown: false, grow: 1, shake: 0 };
        });

        // the quarry's loading hopper
        const q = ZONES.quarry, hop = new THREE.Group();
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) hop.add(box(0.3, 6, 0.3, mat(0x5d6770), sx * 2.6, 3, sz * 2.6));
        hop.add(box(5.6, 1.4, 5.6, mat(0xf2b417), 0, 6.3, 0));
        hop.position.set(q.x, 0, q.y); scene.add(hop);

        // the hazard pad marks where things get tipped; the ring and beacon mark where to go next
        this.pad = mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: hazardTexture(), transparent: true, depthWrite: false }), 0, 0.06, 0);
        this.pad.rotation.x = -Math.PI / 2; this.pad.visible = false; scene.add(this.pad);
        this.ring = mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.08, 0);
        this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
        this.beacon = mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), 0, 15, 0);
        this.beacon.visible = false; scene.add(this.beacon);

        // debris, by id
        this.debris = new Map();
        this.debrisGeo = { boulder: new THREE.DodecahedronGeometry(1), chunk: new THREE.BoxGeometry(1.7, 1.3, 1.5), rubble: new THREE.IcosahedronGeometry(1, 0), rock: new THREE.DodecahedronGeometry(1) };
        this.debrisMat = { boulder: mat(0x8d8f94, { flatShading: true }), chunk: mat(0x9b5a45, { flatShading: true }), rubble: mat(0x8a6a55, { flatShading: true }), rock: mat(0xa59c8c, { flatShading: true }) };

        // what each job leaves behind, built the first time it is needed
        this.sites = {};
        this.deck = [];
        for (let i = 0; i < 4; i++) {
            const seg = box(BRIDGE.w / 4 + 0.02, 0.5, BRIDGE.h, mat(0x8d9299), BRIDGE.x + (i + 0.5) * BRIDGE.w / 4, 0.12, BRIDGE.y + BRIDGE.h / 2);
            seg.add(box(BRIDGE.w / 4, 0.9, 0.25, mat(0xd9382b), 0, 0.7, -BRIDGE.h / 2 + 0.15), box(BRIDGE.w / 4, 0.9, 0.25, mat(0xd9382b), 0, 0.7, BRIDGE.h / 2 - 0.15));
            seg.visible = false; seg.receiveShadow = true; scene.add(seg); this.deck.push(seg);
        }
        this.extras = {};
    }

    site(job) {
        if (this.sites[job.id]) return this.sites[job.id];
        const s = { steps: [] }, add = (o) => { o.visible = false; this.scene.add(o); return o; };
        job.steps.forEach((st, k) => {
            const v = {};
            if (st.kind === 'roll') {
                const cells = cellsOf(st.rect, WORK.rollCell), cw = st.rect.w / Math.ceil(st.rect.w / WORK.rollCell), ch = st.rect.h / Math.ceil(st.rect.h / WORK.rollCell);
                v.cells = cells;
                v.inst = add(new THREE.InstancedMesh(new THREE.BoxGeometry(cw, 1, ch), mat(0xffffff), cells.length));
                v.inst.receiveShadow = true;
                v.state = cells.map(() => -1);
                v.flat = new THREE.Color({ potholes: 0x484b52, farm: 0xb8a888, square: 0xd9c9a8 }[job.id] ?? 0x484b52);
                v.loose = new THREE.Color({ potholes: 0x1d1d20, farm: 0x7d705c, square: 0x9c8c70 }[job.id] ?? 0x1d1d20);
            }
            if (st.kind === 'haul') { v.pile = add(mesh(new THREE.ConeGeometry(2, 1.6, 9), mat(0x6b5a48, { flatShading: true }), st.site.x + 2.5, 0.8, st.site.y - 1.5)); v.pile.castShadow = true; }
            if (st.kind === 'dig') v.discs = st.spots.map((p) => add(disc(1.9, 0x4a3626, p.x, p.y, 0.035)));
            if (st.kind === 'pour') v.discs = st.spots.map((p) => add(disc(1.7, 0xbcbcb6, p.x, p.y, 0.05)));
            if (st.kind === 'lift' && job.id !== 'bridge') {
                const p = st.sites[0];
                v.stack = [...Array(st.n)].map((_, i) => add(box(3.2, 0.35, 0.5, mat(0x9a6b3c), p.x + 3.2, 0.2 + (i >> 1) * 0.4, p.y + (i % 2) * 0.7 - 0.35)));
            }
            s.steps.push(v);
        });
        this.sites[job.id] = s;
        return s;
    }

    /** Things that only exist once a job is finished. */
    extra(id) {
        if (this.extras[id]) return this.extras[id];
        const g = new THREE.Group();
        if (id === 'park') {
            const lawn = mesh(new THREE.PlaneGeometry(23, 23), mat(0x7fd058), 48, 0.025, 64); lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; g.add(lawn);
            g.add(mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 20), mat(0xd9d2c2), 54, 0.3, 68), mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.8, 12), mat(0xd9d2c2), 54, 1.2, 68),
                mesh(new THREE.SphereGeometry(0.55, 12, 8), mat(0x7fd0f5, { roughness: 0.2 }), 54, 2.2, 68));
            for (let i = 0; i < 26; i++) {
                const f = mesh(new THREE.SphereGeometry(0.22, 6, 5), mat([0xff6fa5, 0xffe14a, 0xffffff, 0xff8a3c][i % 4]), 38 + hash3(i, 1, 9) * 20, 0.25, 53.5 + hash3(i, 2, 9) * 21);
                if (Math.hypot(f.position.x - 48.5, f.position.z - 58) > 5 && Math.hypot(f.position.x - 54, f.position.z - 68) > 2.5) g.add(f);
            }
        }
        if (id === 'playground') {
            const red = mat(0xd9382b);
            for (const sx of [-1.6, 1.6]) { const a = box(0.18, 3.4, 0.18, red, 80 + sx, 1.6, 39.5 - 0.7), b = box(0.18, 3.4, 0.18, red, 80 + sx, 1.6, 39.5 + 0.7); a.rotation.x = 0.4; b.rotation.x = -0.4; g.add(a, b); }
            g.add(box(3.6, 0.18, 0.18, red, 80, 3.15, 39.5), box(0.7, 0.1, 0.4, mat(0x2f7fd6), 79.3, 0.9, 39.5), box(0.7, 0.1, 0.4, mat(0xf6c21c), 80.7, 0.9, 39.5));
        }
        g.visible = false;
        this.scene.add(g);
        return (this.extras[id] = g);
    }

    shake(id) { const e = this.buildings.find((x) => x.b.id === id); if (e) e.shake = 1; }

    frame(G, dt, time, tg) {
        // buildings: appear with a pop, sink a little with every blow of the ball
        for (const e of this.buildings) {
            const up = buildingUp(G, e.b);
            if (up && !e.shown) { e.grow = 0; }
            e.shown = up; e.g.visible = up;
            if (!up) continue;
            e.grow = Math.min(1, e.grow + dt * 1.6);
            e.shake = Math.max(0, e.shake - dt * 2.5);
            let sink = 1;
            if (e.b.until) { const js = G.jobs[e.b.until[0]]; if (js.prog && js.prog.hp != null) sink = 0.55 + 0.45 * (js.prog.hp / JOBS.find((j) => j.id === e.b.until[0]).steps[e.b.until[1]].hp); }
            const pop = e.grow < 1 ? 1 + Math.sin(e.grow * Math.PI) * 0.15 : 1;
            e.g.scale.set(pop, e.grow * sink * pop, pop);
            e.g.position.x = e.b.x + e.b.w / 2 + Math.sin(time * 60) * e.shake * 0.25;
            e.g.rotation.z = Math.sin(time * 47) * e.shake * 0.03;
        }
        this.water.material.color.setHSL(0.56, 0.72, 0.56 + Math.sin(time * 1.3) * 0.02);

        // debris
        for (const d of G.debris) {
            let m = this.debris.get(d.id);
            if (!m) {
                m = mesh(this.debrisGeo[d.kind], this.debrisMat[d.kind]);
                const s = d.kind === 'chunk' ? d.r / 1.0 : d.r;
                m.scale.set(s, s * (0.75 + hash3(d.id, 3, 3) * 0.3), s); m.rotation.set(hash3(d.id, 1, 1) * 6, hash3(d.id, 2, 2) * 6, 0);
                m.castShadow = true; m.userData.r = d.r; this.scene.add(m); this.debris.set(d.id, m);
            }
            // roll as it is pushed
            const dx = d.x - m.position.x, dz = d.y - m.position.z;
            if (m.userData.placed && d.kind !== 'chunk') { m.rotation.x += dz / d.r * 0.6; m.rotation.z -= dx / d.r * 0.6; }
            m.userData.placed = true; m.userData.seen = G.t;
            m.position.set(d.x, d.r * 0.75, d.y);
        }
        for (const [id, m] of this.debris) if (m.userData.seen !== G.t) { this.scene.remove(m); this.debris.delete(id); }

        // the jobs' leftovers
        const o = this._o || (this._o = new THREE.Object3D());
        for (const job of JOBS) {
            const js = G.jobs[job.id];
            if (js.st === 'locked' || (js.st === 'open' && js.step === 0 && !js.prog)) continue;
            const s = this.site(job), done = js.st === 'done';
            job.steps.forEach((st, k) => {
                const v = s.steps[k], past = done || js.step > k, active = !done && js.step === k && !!js.prog, pr = active ? js.prog : null;
                if (v.inst) {
                    v.inst.visible = past || active;
                    let dirty = false;
                    v.cells.forEach((c, i) => {
                        const flat = past || (pr && pr.cells[i]) ? 1 : 0;
                        if (v.state[i] === flat) return;
                        v.state[i] = flat; dirty = true;
                        o.position.set(c.x, flat ? 0.02 : 0.16, c.y); o.scale.set(1, flat ? 0.04 : 0.3 + hash3(i, k, 5) * 0.25, 1); o.rotation.set(0, 0, 0); o.updateMatrix();
                        v.inst.setMatrixAt(i, o.matrix); v.inst.setColorAt(i, flat ? v.flat : v.loose);
                    });
                    if (dirty) { v.inst.instanceMatrix.needsUpdate = true; if (v.inst.instanceColor) v.inst.instanceColor.needsUpdate = true; }
                }
                if (v.pile) { v.pile.visible = active && pr.n > 0; if (v.pile.visible) v.pile.scale.setScalar(0.6 + 0.4 * pr.n); }
                if (v.discs) {
                    const keep = st.kind === 'dig' && { park: 0x3fa7e0, playground: 0xe6d28f }[job.id];
                    v.discs.forEach((dsc, i) => {
                        const f = past ? 1 : pr ? pr.spots[i] : 0;
                        dsc.visible = f > 0 && (!done || !!keep);
                        dsc.scale.setScalar(0.25 + 0.75 * f);
                        if (keep && js.step > k + (job.id === 'playground' ? 1 : 0) || keep && done) dsc.material.color.setHex(keep);
                    });
                }
                if (v.stack) v.stack.forEach((b, i) => { b.visible = !done && (past || (pr && pr.n > i)); });
                if (st.kind === 'lift' && job.id === 'bridge') this.deck.forEach((seg, i) => { seg.visible = past || (!!pr && pr.n > i); });
            });
        }
        for (const id of ['park', 'playground']) if (G.jobs[id].st === 'done') this.extra(id).visible = true; else if (this.extras[id]) this.extras[id].visible = false;

        // where to go next
        const show = !!tg;
        this.ring.visible = this.beacon.visible = show;
        this.pad.visible = false;
        if (show) {
            const pulse = 1 + Math.sin(time * 5) * 0.06;
            this.ring.position.set(tg.x, 0.08, tg.y); this.ring.scale.setScalar(Math.max(1.6, tg.r) * pulse);
            this.beacon.position.set(tg.x, 15, tg.y);
            this.beacon.material.opacity = 0.2 + Math.sin(time * 3) * 0.08;
            const zone = tg.zone || (tg.what === 'tip' ? tg : null);
            if (zone) { this.pad.visible = true; this.pad.position.set(zone.x, 0.06, zone.y); this.pad.scale.setScalar(zone.r); this.pad.rotation.z = time * 0.3; }
        }
    }
}

/** A stand-in is built facing +Z with its footprint along the map; turn it back so the group's facing can turn it. */
function withFacing(g, b, pre) {
    if (pre) { const h = new THREE.Group(); g.rotation.y = -[0, Math.PI / 2, Math.PI, -Math.PI / 2][b.f || 0]; h.add(g); return h; }
    return g;
}
