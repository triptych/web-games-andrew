// The static-ish world: sea, island, streets, the buildings with their floors, bridges, clouds.
// Built once per city from G; update() animates floors dropping and walls wobbling.

import * as THREE from 'three';
import { toon, overlay } from './toon.js';
import { FLOOR_H, DECK_H } from '../config.js';
import { THEMES } from './themes.js';
import * as M from './models.js';

const TAU = Math.PI * 2;

function softSquare() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.4)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    return t;
}

function waveTexture(base, foam) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = foam; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
        const x = (i * 53) % 128, y = (i * 37 + 11) % 128;
        for (const ox of [-128, 0, 128]) {
            g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + 12, y - 7, x + ox + 26, y); g.stroke();
        }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

export class World {
    constructor(scene, G) {
        this.scene = scene;
        this.th = THEMES[G.level];
        this.root = new THREE.Group();
        scene.add(this.root);
        this.nodes = new Map();           // building id → node
        this.cables = [];
        this.time = 0;
        this.disposables = [];
        this.build(G);
    }

    dispose() {
        this.scene.remove(this.root);
        this.root.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } }
        });
        for (const t of this.texs || []) for (const x of t) x.dispose();
    }

    build(G) {
        const th = this.th, L = G.layout, W = L.W, H = L.H;
        const root = this.root;

        // ---- the sea and the island
        this.seaTex = waveTexture('#ffffff', '#ffffff');
        this.seaTex.repeat.set(160, 160);
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), toon({ map: this.seaTex, color: th.water }));
        sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, -0.9, H / 2);
        root.add(sea);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 2.2, H + 1), toon({ color: th.plate }));
        plate.position.set(W / 2, -1.25, H / 2);
        root.add(plate);

        // ---- streets, sidewalks, lots: thin coloured slabs merged into one mesh
        const k = new M.Kit();
        const slab = (x0, z0, w, d, top, c) => k.box(w, top, d, x0 + w / 2, top / 2, z0 + d / 2, c);
        // layers, bottom to top, each at least 0.04 above the one beneath: ground, streets, dashes, sidewalks, lots
        slab(0, 0, W, H, 0.0, th.ground);
        for (const hr of L.hroads) {
            if (hr.river) continue;
            slab(0, hr.y, W, hr.h, 0.12, th.road);
            for (let x = 1; x < W - 1; x += 3.4) {
                const cx = x + 0.7;
                if (L.vroads.some((v) => cx > v.x - 0.8 && cx < v.x + v.w + 0.8)) continue;          // no dashes across a crossing
                k.box(1.4, 0.04, 0.14, cx, 0.14, hr.cy, th.line);
            }
        }
        const rv = L.river;
        for (const vr of L.vroads) {
            const segs = rv ? [[0, rv.y], [rv.y + rv.h, L.roadEnd]] : [[0, L.roadEnd]];
            for (const [a, b] of segs) {
                if (b - a < 0.5) continue;
                slab(vr.x, a, vr.w, b - a, 0.12, th.road);
                for (let y = a + 1; y < b - 1; y += 3.4) {
                    const cy = y + 0.7;
                    if (L.hroads.some((h) => !h.river && cy > h.y - 0.8 && cy < h.y + h.h + 0.8)) continue;
                    k.box(0.14, 0.04, 1.4, vr.cx, 0.14, cy, th.line);
                }
            }
        }
        for (const bk of L.blocks) {
            slab(bk.x, bk.y, bk.w, bk.h, 0.2, th.walk);
            slab(bk.x + 0.6, bk.y + 0.6, bk.w - 1.2, bk.h - 1.2, 0.26, th.lot);
        }
        // the plaza: a checkerboard of paving
        const pz = L.plaza;
        for (let tx = 0; tx < Math.ceil(W / 3); tx++) {
            for (let ty = 0; ty < Math.ceil(pz.h / 3); ty++) {
                const w = Math.min(3, W - tx * 3), d = Math.min(3, pz.h - ty * 3);
                slab(tx * 3, pz.y + ty * 3, w, d, 0.12, (tx + ty) % 2 ? th.walk : th.bank);
            }
        }
        // sea wall round the island
        const wc = th.walk;
        k.box(W + 1.4, 1.0, 0.6, W / 2, 0.5, -0.3, wc); k.box(W + 1.4, 1.0, 0.6, W / 2, 0.5, H + 0.3, wc);
        k.box(0.6, 1.0, H, -0.3, 0.5, H / 2, wc); k.box(0.6, 1.0, H, W + 0.3, 0.5, H / 2, wc);
        for (let x = 0; x <= W; x += 4) { k.cyl(0.22, 0.22, 1.5, x, 0.75, -0.3, th.accents[(x / 4 | 0) % 4], 0, 0, 0, 6); k.cyl(0.22, 0.22, 1.5, x, 0.75, H + 0.3, th.accents[(x / 4 | 0) % 4], 0, 0, 0, 6); }
        for (let y = 0; y <= H; y += 4) { k.cyl(0.22, 0.22, 1.5, -0.3, 0.75, y, th.accents[(y / 4 | 0) % 4], 0, 0, 0, 6); k.cyl(0.22, 0.22, 1.5, W + 0.3, 0.75, y, th.accents[(y / 4 | 0) % 4], 0, 0, 0, 6); }
        this.flat = new THREE.Mesh(k.build(), toon({ vertexColors: true }));
        root.add(this.flat);

        // ---- the river
        if (rv) {
            this.riverTex = waveTexture('#ffffff', '#ffffff');
            this.riverTex.repeat.set(W / 5, rv.h / 5);
            const river = new THREE.Mesh(new THREE.PlaneGeometry(W, rv.h), toon({ map: this.riverTex, color: th.water }));
            river.rotation.x = -Math.PI / 2; river.position.set(W / 2, 0.08, rv.y + rv.h / 2);
            root.add(river);
            const kb = new M.Kit();
            kb.box(W, 0.2, 0.5, W / 2, 0.1, rv.y - 0.05, th.bank);
            kb.box(W, 0.2, 0.5, W / 2, 0.1, rv.y + rv.h + 0.05, th.bank);
            root.add(new THREE.Mesh(kb.build(), toon({ vertexColors: true })));
        }

        // ---- buildings
        this.texs = M.makeWindowTextures(th.night);
        this.wallMats = new Map();
        this.solidMat = toon({ vertexColors: true });
        this.shadowTex = softSquare();
        const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
        this.shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }), G.buildings.length);
        this.shadows.frustumCulled = false; this.shadows.renderOrder = 1;
        root.add(this.shadows);
        overlay(this.shadows);
        this.tmp = new THREE.Object3D();
        this.ruinMat = toon({ vertexColors: true });
        this.cableMat = toon({ color: 0xf1e3d0 });

        const bridges = new Map();
        G.buildings.forEach((b, i) => {
            const node = { b, i, group: new THREE.Group(), disp: b.fl, shake: 0, ruin: null, body: null, roof: null };
            node.group.position.set(b.x, 0, b.y);
            root.add(node.group);
            if (b.shape === 'box' && b.t !== 'deck' && b.t !== 'pylon') {
                const lit = th.night ? (b.id % 10 < 7 ? 1 : 0) : (b.id % 10 < 2 ? 1 : 0);
                const key = `${b.st}-${lit}-${b.col}`;
                let mat = this.wallMats.get(key);
                if (!mat) { mat = toon({ map: this.texs[b.st][lit], color: th.walls[b.col % th.walls.length] }); this.wallMats.set(key, mat); }
                node.body = new THREE.Mesh(M.windowBody(b), mat);
                node.group.add(node.body);
                node.roof = new THREE.Mesh(M.buildRoof(b, th), this.solidMat);
                node.group.add(node.roof);
                this.placeRoof(node, b.fl);
            } else {
                node.body = new THREE.Mesh(M.buildSolid(b, th), this.solidMat);
                node.group.add(node.body);
                node.solid = true;
            }
            this.nodes.set(b.id, node);
            if (b.t === 'pylon') {
                if (!bridges.has(b.bridge)) bridges.set(b.bridge, []);
                bridges.get(b.bridge).push(node);
            }
        });
        // suspension cables: from each pylon top down to both banks
        for (const [, pair] of bridges) {
            for (const node of pair) {
                const b = node.b, top = new THREE.Vector3(b.x, b.fl0 * FLOOR_H + 0.9, b.y);
                const group = new THREE.Group();
                for (const dir of [-1, 1]) {
                    const end = new THREE.Vector3(b.x, 0.5, b.y + dir * (G.layout.river.h / 2 + 0.4));
                    const mid = new THREE.Vector3(b.x, top.y * 0.42, b.y + dir * (G.layout.river.h * 0.28));
                    const curve = new THREE.QuadraticBezierCurve3(top, mid, end);
                    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.06, 4), this.cableMat));
                }
                root.add(group);
                node.cable = group;
            }
        }

        // ---- sky furniture
        this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon({ color: th.cloud }), 60);
        this.clouds.frustumCulled = false;
        this.cloudData = [];
        for (let i = 0; i < 12; i++) {
            const side = i % 3;
            const cx = side === 0 ? -35 - (i * 7) % 50 : side === 1 ? W + 35 + (i * 11) % 50 : (i * 17) % (W + 80) - 40;
            const cz = side === 2 ? -45 - (i * 5) % 40 : (i * 13) % (H + 60) - 30;
            this.cloudData.push({ x: cx, z: cz, y: 16 + (i * 7) % 12, s: 3 + (i * 3) % 4, sp: 0.3 + (i % 4) * 0.1 });
        }
        root.add(this.clouds);
        this.boats = new THREE.InstancedMesh(M.sailboatModel(), M.kitMaterial(true), 10);
        this.boats.frustumCulled = false;
        this.boatData = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU, rx = W / 2 + 22 + (i % 3) * 9, rz = H / 2 + 22 + (i % 3) * 9;
            this.boatData.push({ a, rx, rz, sp: 0.02 + (i % 3) * 0.006 });
            this.boats.setColorAt(i, new THREE.Color(M.PAINT[i % M.PAINT.length]));
        }
        root.add(this.boats);
        if (th.snow) this.makeSnow(W, H);
    }

    makeSnow(W, H) {
        const n = 500, pos = new Float32Array(n * 3);
        this.snowSeed = [];
        for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 90 - 45; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = Math.random() * 90 - 45; }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.85, depthWrite: false }));
        this.snow.frustumCulled = false;
        this.root.add(this.snow);
        overlay(this.snow);
    }

    placeRoof(node, floors) {
        const b = node.b;
        const p = M.roofPose(b, floors);
        node.roof.position.set(p.ox, p.y, p.oz);
        node.roof.scale.setScalar(1);
    }

    /** A hit on a building: wobble it. */
    hit(id, amount) { const n = this.nodes.get(id); if (n) n.shake = Math.min(0.5, n.shake + amount); }

    /** Floors dropped or the whole thing fell. */
    collapse(id) {
        const n = this.nodes.get(id);
        if (!n || n.ruin) return;
        const b = n.b;
        const k = new M.Kit();
        const col = this.th.walls[b.col % this.th.walls.length];
        const w = b.shape === 'circle' ? b.r * 2 : b.w, d = b.shape === 'circle' ? b.r * 2 : b.d;
        for (let i = 0; i < 6; i++) {
            const a = i * 2.1 + b.id, rr = 0.28 * Math.min(w, d);
            k.add(new THREE.IcosahedronGeometry(1, 0), {
                p: [Math.cos(a) * rr, 0.1, Math.sin(a) * rr], s: [w * 0.18, 0.28 + (i % 3) * 0.08, d * 0.18], r: [0, a, 0], c: i % 2 ? col : 0x8d8f98,
            });
        }
        k.box(w * 0.95, 0.06, d * 0.95, 0, 0.03, 0, 0x4a4650);
        n.ruin = new THREE.Mesh(k.build(), this.ruinMat);
        n.group.add(n.ruin);
    }

    update(G, dt, time) {
        this.time = time;
        const tmp = this.tmp;
        for (const n of this.nodes.values()) {
            const b = n.b;
            // floors sink toward the true count
            if (n.disp > b.fl) n.disp = Math.max(b.fl, n.disp - dt * 9);
            else if (n.disp < b.fl) n.disp = b.fl;
            const visible = !(b.dead && n.disp <= 0.001);
            n.group.visible = visible || !!n.ruin;
            if (n.body) n.body.visible = visible;
            if (n.roof) n.roof.visible = visible;
            if (n.ruin) n.ruin.visible = b.dead;
            if (!b.dead || n.disp > 0.001) {
                if (!n.solid) {
                    n.body.geometry.setDrawRange(0, Math.ceil(n.disp - 1e-4) * M.INDICES_PER_FLOOR);
                    this.placeRoof(n, n.disp);
                    const fall = n.disp - b.fl;
                    if (fall > 0.01) { n.roof.rotation.z = Math.sin(time * 30 + b.id) * 0.06 * Math.min(1, fall); }
                    else n.roof.rotation.z = 0;
                } else {
                    n.body.scale.y = b.fl0 ? Math.max(0.001, n.disp / b.fl0) : 1;
                    if (b.dead) n.body.visible = n.disp > 0.001;
                }
            }
            if (n.cable) n.cable.visible = !b.dead;
            // wobble from hits
            if (n.shake > 0) {
                n.shake = Math.max(0, n.shake - dt * 1.6);
                const s = n.shake * Math.sin(time * 38 + b.id);
                n.group.position.set(b.x + s * 0.5, 0, b.y + s * 0.3);
                n.group.rotation.z = s * 0.06;
            } else if (n.group.rotation.z !== 0) { n.group.rotation.z = 0; n.group.position.set(b.x, 0, b.y); }
            // soft shadow, stretched away from the sun
            const h = n.solid ? n.disp * (b.t === 'deck' ? DECK_H : FLOOR_H) : n.disp * FLOOR_H;
            const w = b.shape === 'circle' ? b.r * 2 : b.w, d = b.shape === 'circle' ? b.r * 2 : b.d;
            const lh = Math.min(7, h * 0.4);
            tmp.position.set(b.x + lh * 0.5, 0.3, b.y - lh * 0.5);
            tmp.rotation.set(0, 0, 0);
            const vis = h > 0.02 ? 1 : 0;
            tmp.scale.set((w + lh + 0.8) * vis + 0.001, 1, (d + lh + 0.8) * vis + 0.001);
            tmp.updateMatrix();
            this.shadows.setMatrixAt(n.i, tmp.matrix);
        }
        this.shadows.instanceMatrix.needsUpdate = true;

        this.seaTex.offset.set(time * 0.012, time * 0.007);
        if (this.riverTex) this.riverTex.offset.set(-time * 0.05, 0);
        // clouds
        let ci = 0;
        for (const c of this.cloudData) {
            const x = c.x + ((time * c.sp) % 120);
            const px = x > G.layout.W + 90 ? x - 180 : x;
            for (let j = 0; j < 5; j++) {
                tmp.position.set(px + (j - 2) * c.s * 0.9, c.y + Math.sin(j * 1.7) * 0.6, c.z);
                tmp.scale.set(c.s * (1 - Math.abs(j - 2) * 0.16), c.s * 0.55, c.s * 0.8);
                tmp.rotation.set(0, j, 0);
                tmp.updateMatrix();
                this.clouds.setMatrixAt(ci++, tmp.matrix);
            }
        }
        this.clouds.count = ci;
        this.clouds.instanceMatrix.needsUpdate = true;
        // boats
        this.boatData.forEach((bd, i) => {
            const a = bd.a + time * bd.sp;
            tmp.position.set(G.layout.W / 2 + Math.cos(a) * bd.rx, -0.7 + Math.sin(time * 1.3 + i) * 0.08, G.layout.H / 2 + Math.sin(a) * bd.rz);
            tmp.rotation.set(0, -a - Math.PI / 2, Math.sin(time + i) * 0.05);
            tmp.scale.setScalar(1.2);
            tmp.updateMatrix();
            this.boats.setMatrixAt(i, tmp.matrix);
        });
        this.boats.instanceMatrix.needsUpdate = true;
        if (this.boats.instanceColor) this.boats.instanceColor.needsUpdate = true;
        if (this.snow) {
            const p = this.snow.geometry.attributes.position, c = this.cx || 0, z = this.cz || 0;
            for (let i = 0; i < p.count; i++) {
                let y = p.getY(i) - dt * (2.5 + (i % 5) * 0.4);
                if (y < 0) y += 40;
                p.setY(i, y);
                p.setX(i, p.getX(i) + Math.sin(time + i) * dt * 0.4);
            }
            p.needsUpdate = true;
            this.snow.position.set(c, 0, z);
        }
    }

    /** Keep the snow around the camera's focus. */
    follow(x, z) { this.cx = x; this.cz = z; }
}
