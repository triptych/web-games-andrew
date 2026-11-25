// The campus overmap: Lumina Academy's floating island, built in code (stone buildings with blue slate roofs, cherry
// trees, the fountain, the sky bridge) with Meshy characters walking it. Kai follows G.pos; friends wait at their
// places; Echo Charms, moonpetals and marshmallows float where they lie. Day turns to evening and night with the
// slot; on the night of the Hollow Moon the sky goes violet and crystal cages hold the captured students.

import * as THREE from 'three';
import { MAP } from '../config.js';
import { PLACES, PLACE_IDS, CHARMS, PETALS, TREATS, RESCUES, FRIENDS, CAST } from '../sim/data.js';
import { SOLIDS } from '../sim/game.js';
import { hash3 } from '../rng.js';
import { Actor, RAMP, blobShadow } from './assets.js';

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });
const STONE = 0xf2ece1, STONE2 = 0xdcd2c2, SLATE = 0x4c6fb8, SLATE2 = 0x5a4da8, GOLD = 0xe8c46a;

const LIGHT = {
    morning: { sky: 0x8cc4ff, hemi: [0xdff1ff, 0x7fa86a, 1.05], sun: [0xfff4dc, 2.0], fog: 0xaed6ff },
    afternoon: { sky: 0x82bdfc, hemi: [0xe6f3ff, 0x7fa86a, 1.05], sun: [0xfff0d0, 2.1], fog: 0xa6d0ff },
    evening: { sky: 0xf2a77e, hemi: [0xffd2b0, 0x6a5a7a, 1.3], sun: [0xffb070, 2.0], fog: 0xe8a48a },
    night: { sky: 0x1c2350, hemi: [0x6a78c8, 0x1a1a30, 1.0], sun: [0x9fb2ff, 0.8], fog: 0x1c2350 },
    moon: { sky: 0x1e1438, hemi: [0x8c84c8, 0x1c1628, 0.85], sun: [0xc8b0ff, 1.1], fog: 0x2a1a48 },
};

export class Campus {
    constructor(view) {
        this.view = view;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
        this.sky = new THREE.Color(LIGHT.morning.sky);
        this.scene.fog = new THREE.Fog(LIGHT.morning.fog, 60, 170);
        this.hemi = new THREE.HemisphereLight(...LIGHT.morning.hemi);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(...LIGHT.morning.sun);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        const sc = this.sun.shadow.camera;
        sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
        this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
        this.scene.add(this.sun, this.sun.target);
        this.camAt = new THREE.Vector3(0, 0, 30);
        this.lightKey = null;
        this.lamps = [];
        this.build();
        this.kai = new Actor('kai', { height: 2.5, color: 0x9fb6ff });
        this.scene.add(this.kai.root);
        this.mochi = new Actor('mochi', { height: 0.9, color: 0xffffff });
        this.scene.add(this.mochi.root);
        this.mochiPos = new THREE.Vector3(1, 0, 31);
        this.friends = {};
        for (const f of FRIENDS) {
            const a = new Actor(f, { height: 2.4, color: new THREE.Color(CAST[f].color).getHex() });
            const p = PLACES[CAST[f].home];
            a.root.position.set(p.x + 2.2, 0, p.z - 0.6);
            a.root.lookAt(0, 0, 8);
            this.scene.add(a.root);
            this.friends[f] = a;
        }
        this.cages = {};
        this.loadedOnce = false;
    }

    resize(w, h) {
        this.camera.aspect = w / h;
        this.camera.fov = w / h < 0.8 ? 55 : 42;
        this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------------ the island
    build() {
        const S = this.scene;
        // the island: grass top, rocky underside, floating in the sky
        const top = new THREE.Mesh(new THREE.CylinderGeometry(MAP.radius + 1.5, MAP.radius - 1, 2.4, 72), toon(0x6fc25e));
        top.position.y = -1.2; top.receiveShadow = true; S.add(top);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(MAP.radius - 1, 8, 26, 36, 4), toon(0x9b8a78));
        rim.position.y = -15.4; S.add(rim);
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2, r = MAP.radius - 4 - hash3(i, 3) * 10;
            const rock = new THREE.Mesh(new THREE.ConeGeometry(2 + hash3(i, 5) * 3, 6 + hash3(i, 6) * 8, 6), toon(0x8a7a6a));
            rock.rotation.x = Math.PI; rock.position.set(Math.cos(a) * r, -6 - hash3(i, 7) * 6, Math.sin(a) * r); S.add(rock);
        }
        // waterfalls off the edge
        for (const a of [0.6, 2.4, 4.0]) {
            const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, 30), new THREE.MeshBasicMaterial({ color: 0xcdeaff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: true }));
            fall.position.set(Math.cos(a) * (MAP.radius + 0.6), -15, Math.sin(a) * (MAP.radius + 0.6));
            fall.lookAt(0, -15, 0); S.add(fall);
        }
        // clouds below and around
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        this.clouds = new THREE.Group();
        for (let i = 0; i < 26; i++) {
            const a = hash3(i, 11) * Math.PI * 2, r = 60 + hash3(i, 12) * 70;
            const c = new THREE.Group();
            for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(4 + hash3(i, k) * 4, 10, 8), cloudMat); s.position.set(k * 4 - 6, hash3(k, i) * 2, hash3(i, k + 9) * 3); c.add(s); }
            c.position.set(Math.cos(a) * r, -26 + hash3(i, 13) * 10, Math.sin(a) * r);
            this.clouds.add(c);
        }
        S.add(this.clouds);
        // a gradient sky dome (its colours follow the time of day) and a few floating islets far off
        this.skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { top: { value: new THREE.Color(0x5fa8ff) }, bottom: { value: new THREE.Color(0xd8ecff) } },
            vertexShader: 'varying float h; void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main() { float k = clamp(h * 1.6 + 0.35, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }',
        });
        this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat);
        S.add(this.skyDome);
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + 0.4, r = 120 + hash3(i, 91) * 60;
            const isle = new THREE.Group();
            const t = new THREE.Mesh(new THREE.CylinderGeometry(6 + hash3(i, 92) * 6, 2, 3, 10), toon(0x6fc25e)); isle.add(t);
            const rock = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 8), toon(0x8a7a6a)); rock.rotation.x = Math.PI; rock.position.y = -8; isle.add(rock);
            for (let k = 0; k < 3; k++) { const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), toon(0xff9cc2)); tr.position.set((k - 1) * 3, 3, hash3(i, k) * 2); isle.add(tr); }
            isle.position.set(Math.cos(a) * r, -6 + hash3(i, 93) * 30, Math.sin(a) * r);
            S.add(isle);
        }
        // flower patches on the lawns: one instanced mesh of little blooms
        {
            const geo = new THREE.IcosahedronGeometry(0.22, 0);
            const mat = new THREE.MeshToonMaterial({ gradientMap: RAMP });
            const N = 900, inst = new THREE.InstancedMesh(geo, mat, N);
            const tmp = new THREE.Object3D(), col = new THREE.Color();
            const COLS = [0xfff2a8, 0xffffff, 0xffa8d0, 0xb8a8ff, 0xffc890];
            let n = 0;
            for (let p = 0; p < 140 && n < N; p++) {
                const a = hash3(p, 101) * Math.PI * 2, r = 10 + Math.sqrt(hash3(p, 102)) * (MAP.radius - 13);
                const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
                if (this.blocked(cx, cz, 1)) continue;
                const c = COLS[p % COLS.length];
                for (let k = 0; k < 7 && n < N; k++) {
                    tmp.position.set(cx + (hash3(p, k + 110) - 0.5) * 3, 0.12, cz + (hash3(p, k + 120) - 0.5) * 3);
                    tmp.scale.setScalar(0.7 + hash3(p, k) * 0.6);
                    tmp.updateMatrix();
                    inst.setMatrixAt(n, tmp.matrix);
                    inst.setColorAt(n, col.set(c));
                    n++;
                }
            }
            inst.count = n;
            S.add(inst);
        }
        // paths: stone strips from the courtyard to every place, and the bridge
        const pathMat = toon(0xd9c8a6);
        const strip = (x0, z0, x1, z1, w = 3) => {
            const len = Math.hypot(x1 - x0, z1 - z0);
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathMat);
            m.rotation.x = -Math.PI / 2;
            m.rotation.z = -Math.atan2(x1 - x0, z1 - z0);
            m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
            m.receiveShadow = true;
            S.add(m);
        };
        for (const id of PLACE_IDS) if (id !== 'courtyard') strip(0, 8, PLACES[id].x, PLACES[id].z);
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), toon(0xeee2cc));
        plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.03, 8); plaza.receiveShadow = true; S.add(plaza);
        // the sky bridge and its gate
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 34), toon(STONE));
        bridge.position.set(0, -0.4, 58); bridge.receiveShadow = true; S.add(bridge);
        for (let z = 44; z <= 74; z += 6) for (const x of [-2.6, 2.6]) this.lamp(x, z, 0.9);
        this.arch(0, 42);
        // the fountain
        const f = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 24), toon(STONE)); base.position.y = 0.35;
        const water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 24), new THREE.MeshToonMaterial({ color: 0x7fd4ff, gradientMap: RAMP, emissive: 0x1a4a70 })); water.position.y = 0.66;
        const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 12), toon(STONE)); mid.position.y = 1.6;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 0.4, 20), toon(STONE)); bowl.position.y = 2.6;
        this.spray = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.6 })); this.spray.position.y = 3.4;
        f.add(base, water, mid, bowl, this.spray);
        for (const m of [base, mid, bowl]) m.castShadow = true;
        f.position.set(0, 0, 8); S.add(f);
        // buildings
        for (const s of SOLIDS) if (s.id) this.building(s.id, s);
        // trees: cherry blossoms around campus, the dark wood to the west
        for (let i = 0; i < 120; i++) {
            const a = hash3(i, 21) * Math.PI * 2, r = 8 + Math.sqrt(hash3(i, 22)) * (MAP.radius - 10);
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            if (this.blocked(x, z, 3.2)) continue;
            const wood = x < -28 && Math.abs(z - 6) < 20;
            this.tree(x, z, wood, i);
        }
        for (let i = 0; i < 40; i++) {
            const x = -34 - hash3(i, 31) * 10, z = -12 + hash3(i, 32) * 36;
            if (Math.hypot(x, z) > MAP.radius - 2 || this.blocked(x, z, 2.5)) continue;
            this.tree(x, z, true, i + 400);
        }
        // place markers: a glowing ring and a soft beam at each door
        this.markers = {};
        for (const id of PLACE_IDS) {
            const p = PLACES[id];
            const g = new THREE.Group();
            const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
            ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
            beam.position.y = 3;
            g.add(ring, beam);
            if (id === 'courtyard') { beam.visible = false; ring.scale.setScalar(2.4); }
            g.position.set(p.x, 0, p.z);
            S.add(g);
            this.markers[id] = { g, ring, beam };
        }
        // pickups: billboards of their icons
        const tl = new THREE.TextureLoader();
        const spr = (file, size) => {
            const t = tl.load(`art/icons/${file}.webp`); t.colorSpace = THREE.SRGBColorSpace;
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
            s.scale.set(size, size, 1);
            return s;
        };
        this.pick = { charms: {}, petals: {}, treats: {} };
        for (const c of CHARMS) { const s = spr('charm', 1.3); s.position.set(c.x, 1.2, c.z); S.add(s); this.pick.charms[c.id] = s; }
        for (const p of PETALS) { const s = spr('moonpetal', 1.1); s.position.set(p.x, 0.9, p.z); S.add(s); this.pick.petals[p.id] = s; }
        for (const p of TREATS) { const s = spr('mochitreat', 1.1); s.position.set(p.x, 0.9, p.z); S.add(s); this.pick.treats[p.id] = s; }
        // the Hollow Moon
        const moonTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 20, 64, 64, 64);
            g.addColorStop(0, '#f6e8ff'); g.addColorStop(0.55, '#c9a2ff'); g.addColorStop(0.7, '#6a2aa0'); g.addColorStop(0.78, 'rgba(60,10,90,0.9)'); g.addColorStop(1, 'rgba(60,10,90,0)');
            x.fillStyle = g; x.fillRect(0, 0, 128, 128);
            x.fillStyle = 'rgba(40,0,60,0.55)'; x.beginPath(); x.arc(64, 64, 22, 0, Math.PI * 2); x.fill();
            return new THREE.CanvasTexture(c);
        })();
        this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
        this.moon.scale.set(40, 40, 1);
        this.moon.position.set(-20, 70, -140);
        this.moon.visible = false;
        S.add(this.moon);
    }

    blocked(x, z, pad) {
        if (Math.hypot(x, z - 8) < 10) return true;                                  // the plaza
        if (Math.abs(x) < 4 && z > 8) return true;                                    // the bridge road
        for (const s of SOLIDS) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return true;
        for (const id of PLACE_IDS) { const p = PLACES[id]; if (Math.hypot(x - p.x, z - p.z) < 4 + pad) return true; }
        // the paths
        for (const id of PLACE_IDS) {
            const p = PLACES[id], dx = p.x, dz = p.z - 8, L = Math.hypot(dx, dz) || 1;
            const t = Math.max(0, Math.min(1, (x * dx + (z - 8) * dz) / (L * L)));
            if (Math.hypot(x - dx * t, z - 8 - dz * t) < 2 + pad * 0.5) return true;
        }
        for (const c of [...CHARMS, ...PETALS, ...TREATS]) if (Math.hypot(x - c.x, z - c.z) < 2) return true;
        return false;
    }

    tree(x, z, wood, i) {
        const g = new THREE.Group();
        const h = 1.8 + hash3(i, 41) * 1.2;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, h, 7), toon(wood ? 0x4a3a40 : 0x7a5a48));
        trunk.position.y = h / 2; trunk.castShadow = true;
        g.add(trunk);
        const leafCol = wood ? [0x2e5a5e, 0x264a56][i % 2] : [0xff9cc2, 0xff86b4, 0xffb4d0][i % 3];
        for (let k = 0; k < 3; k++) {
            const r = (wood ? 1.3 : 1.05) + hash3(i, k + 50) * 0.5;
            const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), toon(leafCol));
            s.position.set((hash3(i, k + 60) - 0.5) * 1.4, h + (k === 2 ? 1.0 : 0.3), (hash3(i, k + 70) - 0.5) * 1.4);
            s.castShadow = true;
            g.add(s);
        }
        if (wood && hash3(i, 80) < 0.5) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6ae0ff }));
            m.position.set(0.8, 0.05, 0.3); g.add(m);
        }
        g.position.set(x, 0, z);
        g.rotation.y = hash3(i, 90) * 6;
        this.scene.add(g);
    }

    lamp(x, z, y0 = 0) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), toon(0x5a5a7a));
        post.position.set(x, y0 + 1.3, z);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
        glow.position.set(x, y0 + 2.7, z);
        this.scene.add(post, glow);
        this.lamps.push(glow);
    }

    arch(x, z) {
        const m = toon(STONE);
        for (const sx of [-3.4, 3.4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), m); p.position.set(x + sx, 3, z); p.castShadow = true; this.scene.add(p); }
        const top = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1, 1.4), m); top.position.set(x, 6.4, z); this.scene.add(top);
        const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshToonMaterial({ color: GOLD, gradientMap: RAMP, emissive: 0x5a4010 })); crest.position.set(x, 7.6, z); this.scene.add(crest);
    }

    /** A castle building facing the courtyard. Shapes differ by place. */
    building(id, s) {
        const g = new THREE.Group();
        const stone = toon(STONE), stone2 = toon(STONE2), slate = toon(id === 'tower' ? SLATE2 : SLATE);
        const win = new THREE.MeshToonMaterial({ color: 0x8fd0ff, gradientMap: RAMP, emissive: 0x203050 });
        this.windows = this.windows || [];
        this.windows.push(win);
        const box = (w, h, d, x, y, z, m = stone) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
        const roof = (r, h, x, y, z, seg = 4) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), slate); c.position.set(x, y, z); if (seg === 4) c.rotation.y = Math.PI / 4; c.castShadow = true; g.add(c); return c; };
        const tower = (r, h, x, z) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 14), stone); t.position.set(x, h / 2, z); t.castShadow = true; g.add(t); roof(r * 1.25, r * 2.4, x, h + r * 1.2, z, 14); };
        const windows = (w, h, y, n) => { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2), win); m.position.set(-w / 2 + (i + 0.5) * (w / n), y, s.r * 0.86 + 0.02); g.add(m); } };
        switch (id) {
            case 'hall':
                box(10, 6, 7, 0, 3, 0); roof(6.6, 3.4, 0, 7.7, 0);
                box(2.6, 12, 2.6, 0, 6, -1.5, stone2); roof(2.2, 3, 0, 13.5, -1.5);
                { const clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); clock.position.set(0, 10, -0.18); g.add(clock); this.clock = clock; }
                tower(1, 7, -5, 2.5); tower(1, 7, 5, 2.5); windows(9, 1, 2.6, 6); windows(9, 1, 4.6, 6);
                break;
            case 'library': {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 5, 20), stone); body.position.y = 2.5; body.castShadow = true; g.add(body);
                const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x9fd8ff, gradientMap: RAMP, transparent: true, opacity: 0.85 })); dome.position.y = 5; g.add(dome);
                windows(6, 1, 2.6, 4);
                break;
            }
            case 'lab':
                box(7, 4.5, 6, 0, 2.25, 0); roof(5, 2.6, 0, 5.8, 0);
                { const ch = box(0.9, 4, 0.9, 2, 7, -1, toon(0xa06a50)); this.chimney = ch; }
                windows(6, 1, 2.4, 4);
                break;
            case 'arena': {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.9, 8, 28), stone); ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; ring.castShadow = true; g.add(ring);
                for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const flag = box(0.15, 3, 0.15, Math.cos(a) * 4.2, 2.4, Math.sin(a) * 4.2, toon(0x8a6a5a)); flag; const cloth = box(0.9, 0.6, 0.05, Math.cos(a) * 4.2 + 0.5, 3.5, Math.sin(a) * 4.2, toon(i % 2 ? 0xff6b5b : GOLD)); cloth; }
                const circle = new THREE.Mesh(new THREE.RingGeometry(2, 2.6, 32), new THREE.MeshBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.7 })); circle.rotation.x = -Math.PI / 2; circle.position.y = 0.05; g.add(circle);
                break;
            }
            case 'skyfield':
                tower(1.6, 12, 0, 0);
                { const sock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 10, 1, true), toon(0x8fe07a, { side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(1.3, 13.5, 0); g.add(sock); }
                for (let i = 0; i < 4; i++) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), new THREE.MeshToonMaterial({ color: GOLD, gradientMap: RAMP, emissive: 0x403010 })); hoop.position.set(4 + i * 3, 6 + i * 1.5, 2 - i * 2); hoop.rotation.y = 0.6; g.add(hoop); }
                break;
            case 'dorm':
                box(9, 5, 5, 0, 2.5, 0, toon(0xf6e6d4)); roof(6.4, 2.8, 0, 6.4, 0);
                windows(8, 1, 1.6, 5); windows(8, 1, 3.6, 5);
                break;
            case 'infirmary':
                box(5.5, 3.5, 5, 0, 1.75, 0, toon(0xffffff)); roof(4.2, 2, 0, 4.5, 0);
                { const heart = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: 0xff8fb8 })); heart.position.set(0, 2.6, 2.52); g.add(heart); }
                break;
            case 'tower':
                tower(2, 14, 0, 0);
                { const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshToonMaterial({ color: 0xc8a0ff, gradientMap: RAMP, emissive: 0x4a1a80 })); orb.position.set(0, 20.5, 0); g.add(orb); this.towerOrb = orb; }
                break;
        }
        g.position.set(s.x, 0, s.z);
        g.lookAt(0, 0, 8);
        this.scene.add(g);
    }

    // ------------------------------------------------------------------ events and frames
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'charm' || e.type === 'petal' || e.type === 'treat') {
                const s = this.pick[e.type + 's']?.[e.id];
                if (s) s.userData.gone = 1;
            }
            if (e.type === 'panel') { const f = PLACES[e.place].friend; if (f && this.friends[f]) this.friends[f].play('wave'); }
        }
    }

    lighting(G) {
        const key = G.climax ? 'moon' : ['morning', 'afternoon', 'evening', 'night'][G.slot];
        if (key === this.lightKey) return;
        this.lightKey = key;
        const L = LIGHT[key];
        this.sky.set(L.sky);
        const SKY = { morning: [0x5fa8ff, 0xd8ecff], afternoon: [0x4f9cff, 0xcfe6ff], evening: [0x6a5aa8, 0xffb88a], night: [0x0c1030, 0x2a3270], moon: [0x140a2a, 0x4a2a6a] }[key];
        this.skyMat.uniforms.top.value.set(SKY[0]); this.skyMat.uniforms.bottom.value.set(SKY[1]);
        this.scene.fog.color.set(L.fog);
        this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
        this.sun.color.set(L.sun[0]); this.sun.intensity = L.sun[1];
        const dark = key === 'night' || key === 'moon' || key === 'evening';
        for (const l of this.lamps) l.material.color.set(dark ? 0xfff0a8 : 0xbfe8ff);
        for (const w of this.windows || []) w.emissive.set(dark ? 0xffc060 : 0x203050);
        this.moon.visible = key === 'moon';
        this.clouds.visible = key !== 'moon';
    }

    /** Crystal cages at the rescue places on the night of the Hollow Moon. */
    cagesFor(G) {
        for (const r of RESCUES) {
            const want = !!G.climax && !G.climax.freed.includes(r.id);
            let c = this.cages[r.id];
            if (want && !c) {
                const p = PLACES[r.place];
                const g = new THREE.Group();
                const prism = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 6, 1, true), new THREE.MeshToonMaterial({ color: 0xc89aff, gradientMap: RAMP, transparent: true, opacity: 0.45, emissive: 0x401870, side: THREE.DoubleSide, depthWrite: false }));
                prism.position.y = 2.2;
                const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 80, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.35, depthWrite: false }));
                beam.position.y = 40;
                g.add(prism, beam);
                const who = r.id === 'best' ? G.captive : r.id === 'firsties' ? null : r.id;
                if (who) {
                    const a = new Actor(who, { height: 1.5, color: 0xffffff });
                    a.root.position.y = 0.5;
                    a.ready.then(() => a.has('faint') && a.play('faint', { hold: true }));
                    g.add(a.root);
                    g.userData.actor = a;
                }
                g.position.set(p.x - 2.2, 0, p.z + 1.2);
                this.scene.add(g);
                c = this.cages[r.id] = g;
            } else if (!want && c) {
                this.scene.remove(c);
                delete this.cages[r.id];
            }
        }
    }

    frame(G, dt, time) {
        this.lighting(G);
        this.cagesFor(G);
        // Kai
        const p = G.pos;
        const k = this.kai.root;
        k.position.set(p.x, 0, p.z);
        if (p.moving) k.rotation.y = p.face;
        this.kai.setBase(p.moving ? 'run' : 'idle');
        this.kai.update(dt);
        // Mochi trots after him
        const behind = new THREE.Vector3(p.x - Math.sin(k.rotation.y) * 1.4 + 0.7, 0, p.z - Math.cos(k.rotation.y) * 1.4);
        this.mochiPos.lerp(behind, 1 - Math.exp(-dt * 4));
        const mr = this.mochi.root;
        const mv = mr.position.distanceTo(this.mochiPos) / Math.max(dt, 1e-4);
        mr.position.copy(this.mochiPos);
        mr.position.y = 0.3 + Math.abs(Math.sin(time * 6)) * (mv > 0.5 ? 0.25 : 0.06);
        mr.rotation.y = k.rotation.y;
        this.mochi.update(dt);
        // friends: there in free time, not during the climax (and not if captured)
        for (const f of FRIENDS) {
            const a = this.friends[f];
            a.root.visible = !!(!G.climax && G.slot >= 1 && G.slot <= 2 && (G.day > 1 || f === 'ren' || G.flags['met' + f[0].toUpperCase() + f.slice(1)]));
            if (a.root.visible) a.update(dt);
        }
        // markers glow, the near one brightest
        for (const id of PLACE_IDS) {
            const m = this.markers[id];
            const hot = G.near === id;
            m.ring.material.opacity = hot ? 1 : 0.55 + Math.sin(time * 3 + id.length) * 0.15;
            m.ring.scale.setScalar((id === 'courtyard' ? 2.4 : 1) * (hot ? 1.15 + Math.sin(time * 6) * 0.05 : 1));
            m.beam.material.opacity = hot ? 0.28 : 0.1;
            const rescue = G.climax && RESCUES.find((r) => r.place === id && !G.climax.freed.includes(r.id));
            m.ring.material.color.set(rescue ? 0xd090ff : id === 'tower' && G.climax ? 0xff70c0 : 0xffe08a);
        }
        // pickups bob and spin; collected ones shrink away
        const show = (map, ids, visible) => {
            for (const [id, s] of Object.entries(map)) {
                if (s.userData.gone) { s.userData.gone += dt * 3; s.scale.multiplyScalar(0.9); s.position.y += dt * 3; if (s.userData.gone > 2) s.visible = false; continue; }
                s.visible = visible && !ids.includes(id);
                s.position.y = 1.1 + Math.sin(time * 2.5 + s.position.x) * 0.18;
            }
        };
        show(this.pick.charms, G.charms, true);
        show(this.pick.petals, G.petals, G.day >= 3);
        show(this.pick.treats, G.treats, G.quests.treats === 1);
        this.spray.scale.y = 1 + Math.sin(time * 5) * 0.1;
        this.clouds.rotation.y += dt * 0.004;
        if (this.towerOrb) this.towerOrb.rotation.y += dt * (G.climax ? 3 : 0.6);
        if (this.clock) this.clock.material.color.set(G.climax ? 0xc890ff : 0xfff2c0);
        for (const c of Object.values(this.cages)) { c.children[0].rotation.y += dt * 0.6; c.userData.actor?.update(dt); }
        // the camera follows Kai from behind and above (further back on a portrait phone)
        const portrait = this.camera.aspect < 0.8;
        this.camAt.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 6));
        const dist = portrait ? 26 : 21;
        this.camera.position.set(this.camAt.x, this.camAt.y + dist * 0.6, this.camAt.z + dist * 0.84);
        this.camera.lookAt(this.camAt.x, 1.5, this.camAt.z - 5);
        this.skyDome.position.copy(this.camera.position);
        this.sun.position.set(this.camAt.x + 18, 40, this.camAt.z + 14);
        this.sun.target.position.copy(this.camAt);
    }
}
