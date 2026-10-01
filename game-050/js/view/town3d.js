/**
 * town3d.js — Lumenhall: a floating storybook island with the Great Library at its
 * heart, thirteen building plots, villagers, trees, a waterfall and drifting clouds.
 *
 * The Library visibly heals as books come home: ink blots vanish from its walls, its
 * dome warms from grey to gold, and every returned book orbits the spire in its colour.
 * Buildings are rebuilt whenever their level changes (bigger, flags at 4, gold trim at 8).
 */

import * as THREE from 'three';
import { BUILDINGS } from '../sim/town.js';
import { BOOKS } from '../sim/books.js';
import { makeRng } from '../sim/rng.js';

let grad = null;
function gradientMap() {
    if (grad) return grad;
    grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    return grad;
}
const matCache = new Map();
function tm(color, o = {}) {
    const { unique, ...rest } = o;
    const key = color + JSON.stringify(rest);
    if (!unique && matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
    if (!unique) matCache.set(key, m);
    return m;
}
function mesh(geo, mat, pos, rot, parent) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
}
const box = (w, h, d, c, pos, parent, rot) => mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? tm(c) : c, pos, rot, parent);
const cyl = (rt, rb, h, c, pos, parent, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? tm(c) : c, pos, null, parent);
const cone = (r, h, c, pos, parent, seg = 12, rot) => mesh(new THREE.ConeGeometry(r, h, seg), typeof c === 'number' ? tm(c) : c, pos, rot, parent);
const ball = (r, c, pos, parent) => mesh(new THREE.SphereGeometry(r, 14, 10), typeof c === 'number' ? tm(c) : c, pos, null, parent);

function gable(w, h, d, c, pos, parent) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.15, 0); s.lineTo(0, h); s.lineTo(w / 2 + 0.15, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.3, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.3) / 2);
    return mesh(g, tm(c), pos, null, parent);
}
function pyramid(r, h, c, pos, parent) { return cone(r, h, c, pos, parent, 4, [0, Math.PI / 4, 0]); }

// Plot positions: an inner ring in front of the Library and an outer ring around it.
export const PLOT_POS = (() => {
    const out = [];
    const inner = 7.2, outer = 11.3;
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + i * 0.175); out.push([Math.cos(a) * inner, Math.sin(a) * inner * 0.8 + 1.2]); }
    for (let i = 0; i < 8; i++) { const a = -0.4 + i * ((Math.PI + 0.8) / 7); out.push([Math.cos(a) * outer, Math.sin(a) * outer * 0.78 + 0.4]); }
    return out.map(([x, z]) => new THREE.Vector3(x, 0, z));
})();

export class TownView {
    constructor(scene, camera, fx) {
        this.scene = scene;
        this.camera = camera;
        this.fx = fx;
        this.time = 0;
        this.anims = [];
        this.built = {};        // id -> { level, group }
        this.plotGroups = [];
        this.hit = [];
        this.villagers = [];
        this.smoke = [];
        this.yaw = -0.25;
        this.wantYaw = -0.25;
        this.pitch = 0.62;
        this.dist = 40;
        this.wantDist = 40;
        this.autoSpin = 0;
        this.focus = new THREE.Vector3(0, 0, 0.5);
        this.root = new THREE.Group();
        scene.add(this.root);
        this._sky();
        this._lights();
        this._island();
        this._library();
        this._plots();
        this._decor();
        this._villagers();
        this._smokePool();
    }

    // ------------------------------------------------------------------ World

    _sky() {
        const geo = new THREE.SphereGeometry(180, 32, 16);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            uniforms: { uTime: { value: 0 } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 vP; uniform float uTime;
                void main(){
                    float y = vP.y;
                    vec3 top = vec3(0.10, 0.40, 0.95), mid = vec3(0.35, 0.72, 1.0), hor = vec3(1.0, 0.80, 0.90), low = vec3(0.40, 0.78, 1.0);
                    vec3 c = mix(low, hor, smoothstep(-0.45, -0.02, y));
                    c = mix(c, mid, smoothstep(0.0, 0.18, y));
                    c = mix(c, top, smoothstep(0.18, 0.7, y));
                    vec3 sunDir = normalize(vec3(0.5, 0.45, -0.7));
                    float s = max(dot(vP, sunDir), 0.0);
                    c += vec3(1.0, 0.85, 0.5) * pow(s, 60.0) * 1.2 + vec3(1.0, 0.8, 0.6) * pow(s, 6.0) * 0.25;
                    gl_FragColor = vec4(c, 1.0);
                }`,
        });
        this.sky = new THREE.Mesh(geo, mat);
        this.scene.add(this.sky);
        // Clouds
        this.clouds = [];
        const cm = tm(0xffffff, { emissive: 0x606a80 });
        for (let i = 0; i < 14; i++) {
            const g = new THREE.Group();
            const n = 3 + (i % 3);
            for (let j = 0; j < n; j++) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(1.8 + Math.random() * 1.6, 12, 8), cm);
                b.position.set(j * 2.4 - n * 1.2, Math.random() * 0.8, Math.random() * 1.2);
                b.scale.y = 0.65;
                g.add(b);
            }
            const a = Math.random() * Math.PI * 2, r = 32 + Math.random() * 30;
            g.position.set(Math.cos(a) * r, -8 + Math.random() * 26, Math.sin(a) * r);
            g.userData = { a, r, sp: 0.01 + Math.random() * 0.02 };
            this.scene.add(g);
            this.clouds.push(g);
        }
        // Little floating islets far away
        for (let i = 0; i < 5; i++) {
            const g = new THREE.Group();
            cyl(2.2, 1.6, 0.8, 0x6ad35a, [0, 0, 0], g, 10);
            cone(1.6, 2.4, 0x8a6a4a, [0, -1.6, 0], g, 8, [Math.PI, 0, 0]);
            cone(0.7, 1.6, 0x2fae5a, [0.4, 1.1, 0.2], g, 7);
            const a = (i / 5) * Math.PI * 2 + 0.4, r = 55 + i * 6;
            g.position.set(Math.cos(a) * r, -4 + (i % 3) * 7, Math.sin(a) * r);
            g.userData = { y: g.position.y, ph: i };
            this.scene.add(g);
            this.anims.push({ kind: 'float', g });
        }
    }

    _lights() {
        this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8a6aa0, 1.5));
        const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
        sun.position.set(18, 30, 14);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera;
        sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 90;
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.03;
        this.scene.add(sun);
        this.sun = sun;
    }

    _island() {
        const R = 16;
        const rng = makeRng(7);
        // Grass top with gentle hills and vertex-coloured paths
        const top = new THREE.CircleGeometry(R, 72, 0, Math.PI * 2);
        top.rotateX(-Math.PI / 2);
        const sub = new THREE.BufferGeometry();
        // Subdivide by rebuilding as a polar grid for smooth hills
        const rings = 26, segs = 72, verts = [], cols = [], idx = [];
        const grass = new THREE.Color(0x6fd655), grass2 = new THREE.Color(0x4fc05a), path = new THREE.Color(0xf2d79a);
        const plotXZ = PLOT_POS.map((p) => [p.x, p.z]);
        for (let r = 0; r <= rings; r++) {
            for (let s = 0; s <= segs; s++) {
                const rr = (r / rings) * R, a = (s / segs) * Math.PI * 2;
                const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
                let h = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.25 + Math.sin(x * 0.9 + z * 0.7) * 0.06;
                h *= Math.min(1, (R - rr) / 3);
                // flatten plots and the library hill
                let flat = 1;
                for (const [px, pz] of plotXZ) { const d = Math.hypot(x - px, z - pz); if (d < 2.3) flat = Math.min(flat, d / 2.3); }
                h *= flat;
                const dl = Math.hypot(x, z + 1.5);
                if (dl < 5) h = Math.max(h, 0.6 * (1 - Math.max(0, dl - 3.2) / 1.8));
                verts.push(x, h, z);
                // paths: a ring at r≈9 and spokes; plus tint noise
                let c = grass.clone().lerp(grass2, (Math.sin(x * 1.3) * Math.cos(z * 1.1) + 1) * 0.3);
                const ringD = Math.abs(Math.hypot(x, z * 1.15) - 9.2);
                const spoke = Math.min(Math.abs(x) - 0.2, 99) < 0.6 && z > 2;
                if (ringD < 0.7 || (spoke && rr < 15) || dl < 4.2) c = path.clone().lerp(new THREE.Color(0xe6c47a), rng.next() * 0.3);
                cols.push(c.r, c.g, c.b);
            }
        }
        for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
            const a = r * (segs + 1) + s, b = a + segs + 1;
            idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
        sub.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        sub.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        sub.setIndex(idx);
        sub.computeVertexNormals();
        top.dispose();
        this.ground = mesh(sub, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() }), [0, 0, 0], null, this.root);
        this.ground.castShadow = false;
        // Cliff layers
        const layers = [[R, R * 0.97, 1.4, 0x9a6a3a], [R * 0.97, R * 0.9, 1.6, 0xb8844a], [R * 0.9, R * 0.8, 1.4, 0x8a5a32]];
        let y = -0.7;
        for (const [rt, rb, h, c] of layers) {
            const g = new THREE.CylinderGeometry(rt, rb, h, 40, 2, true);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) { const k = 1 + (rng.next() - 0.5) * 0.04; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
            g.computeVertexNormals();
            mesh(g, tm(c, { side: THREE.DoubleSide }), [0, y, 0], null, this.root);
            y -= h;
        }
        // Rocky underside
        const under = new THREE.ConeGeometry(R * 0.8, 14, 24, 4);
        const up = under.attributes.position;
        for (let i = 0; i < up.count; i++) { const k = 1 + (rng.next() - 0.5) * 0.18; up.setX(i, up.getX(i) * k); up.setZ(i, up.getZ(i) * k); }
        under.computeVertexNormals();
        mesh(under, tm(0x7a5a8a), [0, y - 7, 0], [Math.PI, 0, 0], this.root);
        // Glowing crystals under the island
        for (let i = 0; i < 9; i++) {
            const a = rng.next() * Math.PI * 2, r = 3 + rng.next() * 8;
            const cr = mesh(new THREE.OctahedronGeometry(0.6 + rng.next() * 0.8), tm([0x7fe3ff, 0xff7ae0, 0xffe46a][i % 3], { emissive: [0x2a6a8a, 0x6a1a4a, 0x6a5a10][i % 3] }), [Math.cos(a) * r, y - 2 - rng.next() * 6, Math.sin(a) * r], [rng.next(), rng.next(), rng.next()], this.root);
            cr.scale.y = 1.8;
        }
        // Pond + river + waterfall
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x3fc8ff, roughness: 0.1, metalness: 0.1, emissive: 0x0a3a6a, transparent: true, opacity: 0.9 });
        this.waterMat = waterMat;
        const pond = mesh(new THREE.CircleGeometry(1.6, 32), waterMat, [13.0, 0.1, 5.6], [-Math.PI / 2, 0, 0], this.root);
        pond.receiveShadow = true;
        const river = mesh(new THREE.PlaneGeometry(1.3, 2.6), waterMat, [14.4, 0.09, 6.2], [-Math.PI / 2, 0, 1.16 + Math.PI / 2], this.root);
        river.receiveShadow = true;
        const fallMat = new THREE.ShaderMaterial({
            transparent: true, uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide,
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec2 vUv; uniform float uTime;
                void main(){ float s = fract(vUv.y * 6.0 + uTime * 1.6 + sin(vUv.x * 20.0) * 0.05);
                  vec3 c = mix(vec3(0.35,0.8,1.0), vec3(0.9,1.0,1.0), smoothstep(0.6, 1.0, s));
                  float a = smoothstep(0.0, 0.25, vUv.y) * 0.9 * (0.7 + 0.3 * smoothstep(0.0, 0.2, min(vUv.x, 1.0 - vUv.x)));
                  gl_FragColor = vec4(c, a); }`,
        });
        this.fallMat = fallMat;
        const fall = mesh(new THREE.PlaneGeometry(1.4, 16), fallMat, [15.25, -7.9, 6.65], [0, 1.16, 0], this.root);
        fall.castShadow = false;
        this.fallPos = new THREE.Vector3(15.3, -15, 6.7);
    }

    _library() {
        const L = new THREE.Group();
        L.position.set(0, 0.55, -1.5);
        this.root.add(L);
        this.library = L;
        const stone = 0xf0e6ff, trim = 0xffcf4a;
        // stepped base
        cyl(4.6, 4.9, 0.5, 0xd8c8f0, [0, 0.25, 0], L, 24);
        cyl(4.1, 4.4, 0.4, 0xe8dcff, [0, 0.7, 0], L, 24);
        // main hall (round)
        const hall = cyl(3.3, 3.4, 3.4, stone, [0, 2.6, 0], L, 24);
        void hall;
        // columns
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            cyl(0.22, 0.26, 3.4, 0xffffff, [Math.cos(a) * 3.65, 2.6, Math.sin(a) * 3.65], L, 10);
        }
        cyl(4.0, 3.9, 0.4, trim, [0, 4.45, 0], L, 24);
        // windows: glowing arched panes, one per book (they light as books return)
        this.windows = [];
        for (let i = 0; i < 13; i++) {
            const a = Math.PI * 0.5 + (i - 6) * 0.42;
            const w = mesh(new THREE.PlaneGeometry(0.55, 1.3), new THREE.MeshBasicMaterial({ color: 0x3a2a5a, toneMapped: false }), [Math.cos(a) * 3.33, 2.7, Math.sin(a) * 3.33], [0, -a + Math.PI / 2, 0], L);
            w.castShadow = false;
            this.windows.push(w);
        }
        // grand door
        box(1.4, 2.2, 0.4, 0x8a4a22, [0, 1.95, 3.3], L);
        mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 16, 1, false, 0, Math.PI), tm(0x8a4a22), [0, 3.05, 3.3], [Math.PI / 2, 0, Math.PI / 2], L);
        // dome
        this.domeMat = tm(0x9a90b0, { unique: true });
        mesh(new THREE.SphereGeometry(3.1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat, [0, 4.6, 0], null, L);
        cyl(0.6, 0.9, 1.2, trim, [0, 7.9, 0], L, 12);
        this.spireMat = tm(0xb0a8c8, { unique: true });
        cone(0.55, 2.6, this.spireMat, [0, 9.8, 0], L, 12);
        this.beacon = mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x8a80a0, toneMapped: false }), [0, 11.6, 0], null, L);
        // ink blots that wash away as books return
        this.blots = [];
        const blotMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const rng = makeRng(99);
        for (let i = 0; i < 13; i++) {
            const a = Math.PI * 0.5 + (rng.next() - 0.5) * 2.6;
            const b = mesh(new THREE.CircleGeometry(0.5 + rng.next() * 0.5, 9), blotMat.clone(), [Math.cos(a) * 3.42, 1.8 + rng.next() * 2.2, Math.sin(a) * 3.42], [0, -a + Math.PI / 2, rng.next()], L);
            b.castShadow = false;
            b.scale.x = 0.8 + rng.next() * 0.6;
            this.blots.push(b);
        }
        // orbiting books
        this.orbit = new THREE.Group();
        this.orbit.position.y = 8.5;
        L.add(this.orbit);
        this.orbitBooks = [];
        // banners
        for (const s of [-1, 1]) {
            cyl(0.06, 0.06, 3, 0xffffff, [2.2 * s, 6.2, 2.2], L, 6);
            const flag = mesh(new THREE.PlaneGeometry(1.0, 0.6, 6, 1), tm(s > 0 ? 0xff5fa8 : 0x3fe0ff, { side: THREE.DoubleSide }), [2.2 * s + 0.5, 7.3, 2.2], null, L);
            this.anims.push({ kind: 'flag', g: flag });
        }
        this.hitLibrary = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 10, 12), new THREE.MeshBasicMaterial({ visible: false }));
        this.hitLibrary.position.set(0, 5, 0);
        this.hitLibrary.userData = { library: true };
        L.add(this.hitLibrary);
        this.hit.push(this.hitLibrary);
    }

    setBooks(books) {
        const n = Object.keys(books).length;
        if (n === this._bookN) return;
        const grow = this._bookN !== undefined && n > this._bookN;
        this._bookN = n;
        const k = n / 13;
        this.domeMat.color.setHSL(0.12, 0.15 + k * 0.85, 0.55 + k * 0.05);
        this.spireMat.color.setHSL(0.13, 0.1 + k * 0.9, 0.6);
        this.beacon.material.color.setHSL(0.14, k, 0.5 + k * 0.4);
        this.blots.forEach((b, i) => { b.visible = i >= n; });
        this.windows.forEach((w, i) => w.material.color.set(i < n ? BOOKS[i].color : 0x3a2a5a));
        this.orbit.clear();
        this.orbitBooks.length = 0;
        BOOKS.forEach((b, i) => {
            if (!books[b.id]) return;
            const g = new THREE.Group();
            const c = new THREE.Color(b.color);
            mesh(new THREE.BoxGeometry(0.7, 0.95, 0.22), new THREE.MeshToonMaterial({ color: c, gradientMap: gradientMap(), emissive: c.clone().multiplyScalar(0.35) }), [0, 0, 0], null, g);
            mesh(new THREE.BoxGeometry(0.62, 0.88, 0.16), tm(0xfff6e0), [0.05, 0, 0], null, g);
            const a = (i / 13) * Math.PI * 2;
            g.position.set(Math.cos(a) * 3.2, Math.sin(i * 1.7) * 0.6, Math.sin(a) * 3.2);
            this.orbit.add(g);
            this.orbitBooks.push(g);
        });
        if (grow) {
            const p = new THREE.Vector3(0, 9, -1.5);
            this.fx.burst(p, 0xffe46a, 60, { speed: 10, size: 0.9, life: 1.4, gravity: -3, star: true, hueJitter: 0.3 });
            this.fx.ring(p, 0xffffff, 9, { dur: 1 });
        }
    }

    _plots() {
        const stoneM = tm(0xd8c8b0), dirtM = tm(0xb8844a);
        PLOT_POS.forEach((p, i) => {
            const g = new THREE.Group();
            g.position.copy(p);
            this.root.add(g);
            const base = new THREE.Group();
            mesh(new THREE.BoxGeometry(3.3, 0.16, 3.3), stoneM, [0, 0.05, 0], null, base);
            mesh(new THREE.BoxGeometry(3.0, 0.2, 3.0), dirtM, [0, 0.08, 0], null, base);
            // little "for sale" sign
            const sign = new THREE.Group();
            cyl(0.06, 0.06, 1.0, 0x8a5a2a, [0, 0.5, 0], sign, 6);
            box(0.8, 0.5, 0.08, 0xfff0c8, [0, 1.05, 0], sign);
            const plus = new THREE.Group();
            box(0.3, 0.08, 0.1, 0x46b05a, [0, 1.05, 0.05], plus);
            box(0.08, 0.3, 0.1, 0x46b05a, [0, 1.05, 0.05], plus);
            sign.add(plus);
            sign.position.set(0.9, 0, 0.9);
            base.add(sign);
            g.add(base);
            const hb = new THREE.Mesh(new THREE.BoxGeometry(3.3, 4, 3.3), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.y = 2;
            hb.userData = { plot: i };
            g.add(hb);
            this.hit.push(hb);
            // facing: buildings look towards the camera side / the path
            g.rotation.y = Math.atan2(-p.x, -p.z + 6) * 0.35;
            this.plotGroups.push({ g, base, sign, building: null, glow: null });
        });
        // highlight ring for build mode
        this.plotGlow = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.25, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffe46a, transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }));
        this.plotGlow.rotation.x = -Math.PI / 2;
        this.plotGlow.rotation.z = Math.PI / 4;
        this.plotGlow.visible = false;
        this.root.add(this.plotGlow);
        this.buildMode = false;
        this.freeGlows = PLOT_POS.map((p) => {
            const m = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.0, 4, 1), new THREE.MeshBasicMaterial({ color: 0x7dffa4, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide }));
            m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 4;
            m.position.copy(p).setY(0.25);
            m.visible = false;
            this.root.add(m);
            return m;
        });
    }

    _decor() {
        const rng = makeRng(31);
        const trunk = tm(0x8a5a2a);
        const leaves = [0x2fbe5a, 0x46d06a, 0x7ad35a, 0xff8ad0, 0xffc04a];
        const near = (x, z) => {
            if (Math.hypot(x, z + 1.5) < 5.6) return true;
            if (Math.abs(Math.hypot(x, z * 1.15) - 9.2) < 1.2) return true;
            if (Math.abs(x) < 1.2 && z > 2) return true;
            if (Math.hypot(x - 13.6, z - 5.9) < 2.6) return true;
            for (const p of PLOT_POS) if (Math.hypot(x - p.x, z - p.z) < 2.6) return true;
            return false;
        };
        let placed = 0;
        for (let i = 0; i < 260 && placed < 46; i++) {
            const a = rng.next() * Math.PI * 2, r = 3 + rng.next() * 12.3;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            if (near(x, z)) continue;
            placed++;
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            const kind = rng.next();
            if (kind < 0.55) {
                cyl(0.14, 0.2, 0.9, trunk, [0, 0.45, 0], g, 6);
                const c = leaves[Math.floor(rng.next() * (rng.next() < 0.7 ? 3 : 5))];
                const s = 0.8 + rng.next() * 0.6;
                ball(0.8 * s, c, [0, 1.3 * s + 0.3, 0], g);
                ball(0.55 * s, c, [0.35 * s, 1.0 * s + 0.4, 0.2], g);
            } else if (kind < 0.8) {
                cyl(0.12, 0.18, 0.7, trunk, [0, 0.35, 0], g, 6);
                cone(0.75, 1.8, 0x1f9a5a, [0, 1.4, 0], g, 7);
                cone(0.55, 1.3, 0x2fbe6a, [0, 2.1, 0], g, 7);
            } else if (kind < 0.92) {
                for (let f = 0; f < 5; f++) {
                    const fx = (rng.next() - 0.5) * 1.2, fz = (rng.next() - 0.5) * 1.2;
                    cyl(0.02, 0.02, 0.3, 0x2f9a4a, [fx, 0.15, fz], g, 4);
                    ball(0.12, [0xff5fa8, 0xffe46a, 0x7fd8ff, 0xffffff, 0xff8a3a][f % 5], [fx, 0.33, fz], g);
                }
            } else {
                const r2 = mesh(new THREE.DodecahedronGeometry(0.5 + rng.next() * 0.4), tm(0xb8b0c8), [0, 0.25, 0], [rng.next(), rng.next(), 0], g);
                void r2;
            }
            g.rotation.y = rng.next() * 6;
            this.root.add(g);
        }
        // lamp posts along the ring
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            const x = Math.cos(a) * 10.4, z = Math.sin(a) * 10.4 / 1.15;
            if (near(x, z) && Math.abs(Math.hypot(x, z * 1.15) - 9.2) > 1.2) continue;
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            cyl(0.07, 0.09, 2.2, 0x3a2a5a, [0, 1.1, 0], g, 6);
            mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false }), [0, 2.3, 0], null, g);
            this.root.add(g);
        }
        // Hero statue-in-progress? No — the hero stands on the library steps.
        this.hero = new THREE.Group();
        this.hero.position.set(1.6, 0.8, 3.6);
        this.root.add(this.hero);
        // Birds
        this.birds = [];
        const bm = new THREE.MeshBasicMaterial({ color: 0x3a2a5a, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
            const g = new THREE.Group();
            for (const s of [-1, 1]) {
                const w = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), bm);
                w.position.x = 0.3 * s;
                g.add(w);
            }
            g.userData = { a: i, r: 14 + i * 2, h: 9 + (i % 3) * 2, sp: 0.25 + i * 0.03 };
            this.scene.add(g);
            this.birds.push(g);
        }
    }

    setHero(cls) {
        if (this._heroCls === cls) return;
        this._heroCls = cls;
        this.hero.clear();
        const h = this.hero;
        const skin = 0xffd8b0;
        const coat = cls === 'mage' ? 0x6a3adf : 0xc8324a;
        cyl(0.32, 0.42, 0.9, coat, [0, 0.45, 0], h, 10);
        ball(0.3, skin, [0, 1.15, 0], h);
        for (const s of [-1, 1]) ball(0.05, 0x2a1a3a, [0.1 * s, 1.18, 0.27], h);
        if (cls === 'mage') {
            cone(0.42, 0.9, 0x5a2ad8, [0, 1.75, 0], h, 10, [0.15, 0, 0]);
            cyl(0.5, 0.5, 0.05, 0x5a2ad8, [0, 1.35, 0], h, 16);
            cyl(0.04, 0.04, 1.6, 0x8a5a2a, [0.45, 0.8, 0.1], h, 6);
            mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, toneMapped: false }), [0.45, 1.7, 0.1], null, h);
        } else {
            mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), tm(0xc8c8d8), [0, 1.2, 0], null, h);
            cone(0.06, 0.3, 0xff5fa8, [0, 1.55, 0], h, 6);
            box(0.08, 1.1, 0.04, 0xe0e0f0, [0.5, 0.75, 0.1], h);
            box(0.3, 0.06, 0.06, 0xffcf4a, [0.5, 0.25, 0.1], h);
            cyl(0.35, 0.35, 0.06, 0xffcf4a, [-0.42, 0.6, 0.05], h, 14).rotation.z = Math.PI / 2;
        }
    }

    _villagers() {
        const shirts = [0xff5fa8, 0x3fe0ff, 0xffcf4a, 0x46e07a, 0xff8a3a, 0xb46bff];
        for (let i = 0; i < 9; i++) {
            const g = new THREE.Group();
            cyl(0.18, 0.24, 0.55, shirts[i % shirts.length], [0, 0.28, 0], g, 8);
            ball(0.17, 0xffd8b0, [0, 0.68, 0], g);
            if (i % 2) cone(0.2, 0.25, 0x8a5a2a, [0, 0.88, 0], g, 8);
            const a = (i / 9) * Math.PI * 2;
            g.position.set(Math.cos(a) * 9.2, 0, Math.sin(a) * 9.2 / 1.15);
            g.userData = { a, sp: (0.06 + (i % 3) * 0.02) * (i % 2 ? 1 : -1), hop: i, pause: 0 };
            this.root.add(g);
            this.villagers.push(g);
        }
    }

    _smokePool() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        for (let i = 0; i < 60; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
            s.visible = false;
            this.root.add(s);
            this.smoke.push({ s, life: 0 });
        }
    }

    _puff(pos, color = 0xeeeeff, size = 0.8) {
        const p = this.smoke.find((q) => q.life <= 0);
        if (!p) return;
        p.s.position.copy(pos);
        p.s.material.color.set(color);
        p.life = p.max = 2.2;
        p.size = size;
        p.s.visible = true;
    }

    // ------------------------------------------------------------------ Buildings

    sync(profile) {
        this.setBooks(profile.books);
        this.setHero(profile.cls);
        for (const [id, b] of Object.entries(profile.town)) {
            const cur = this.built[id];
            if (cur && cur.level === b.level && cur.plot === b.plot) continue;
            const pg = this.plotGroups[b.plot];
            if (cur) cur.pg.g.remove(cur.group);
            const group = this.buildModel(id, b.level);
            pg.g.add(group);
            pg.sign.visible = false;
            const isNew = !cur;
            this.built[id] = { level: b.level, plot: b.plot, group, pg };
            if (this._synced) {
                group.scale.setScalar(0.01);
                group.userData.grow = 0;
                const wp = pg.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.5, 0));
                this.fx.burst(wp, isNew ? 0xffe46a : 0x7dffa4, 40, { speed: 8, size: 0.6, life: 1, gravity: -6, star: true, hueJitter: 0.2 });
                this.fx.ring(wp.clone().setY(0.4), 0xffffff, 4, { flat: true, dur: 0.7 });
                for (let i = 0; i < 6; i++) this._puff(wp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -1, (Math.random() - 0.5) * 3)), 0xf2d79a, 1.4);
            }
        }
        for (const pg of this.plotGroups) pg.sign.visible = !Object.values(this.built).some((b) => b.pg === pg);
        this._synced = true;
    }

    buildingAnchor(id) {
        const b = this.built[id];
        if (!b) return null;
        const p = b.pg.g.getWorldPosition(new THREE.Vector3());
        p.y += (b.group.userData.height || 3) + 0.6;
        return p;
    }
    plotAnchor(i) { return this.plotGroups[i].g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.4, 0)); }

    setBuildMode(on, freePlots = []) {
        this.buildMode = on;
        this.freeGlows.forEach((m, i) => { m.visible = on && freePlots.includes(i); });
    }

    buildModel(id, level) {
        const g = new THREE.Group();
        const s = 0.9 + Math.min(level, 12) * 0.035;
        const inner = new THREE.Group();
        inner.scale.setScalar(s);
        g.add(inner);
        const B = inner;
        let height = 3;
        const spin = (obj, axis, speed) => this.anims.push({ kind: 'spin', g: obj, axis, speed, owner: g });
        const smoke = (x, y, z, color) => this.anims.push({ kind: 'smoke', g: B, pos: new THREE.Vector3(x, y, z), color, owner: g, t: Math.random() });
        switch (id) {
            case 'lumber': {
                box(2.2, 1.4, 1.8, 0xb8743a, [0, 0.8, -0.3], B);
                for (let i = 0; i < 4; i++) cyl(0.1, 0.1, 2.25, 0x8a4a22, [0, 0.3 + i * 0.35, 0.62], B, 6).rotation.z = Math.PI / 2;
                gable(2.2, 1.0, 1.8, 0x3a8a4a, [0, 1.5, -0.3], B);
                box(0.5, 0.8, 0.1, 0x5a2a12, [0.4, 0.5, 0.62], B);
                for (let i = 0; i < 3; i++) cyl(0.18, 0.18, 1.1, 0xc8844a, [-1.2 + i * 0.05, 0.2 + i * 0.36, 1.1], B, 8).rotation.x = Math.PI / 2;
                cyl(0.3, 0.35, 0.4, 0xa86a3a, [1.2, 0.2, 1.0], B, 10);
                const axe = new THREE.Group(); axe.position.set(1.2, 0.5, 1.0);
                box(0.05, 0.6, 0.05, 0x5a3a1a, [0, 0.25, 0], axe); box(0.25, 0.18, 0.04, 0xd8d8e8, [0.1, 0.5, 0], axe); axe.rotation.z = -0.4;
                B.add(axe);
                cyl(0.12, 0.12, 0.6, 0x7a7a8a, [-0.6, 2.2, -0.6], B, 6);
                smoke(-0.6, 2.6, -0.6);
                height = 2.6;
                break;
            }
            case 'market': {
                const cols = [0xff5fa8, 0x3fe0ff, 0xffcf4a];
                for (let i = 0; i < 3; i++) {
                    const x = -1 + i;
                    box(0.85, 0.6, 0.7, 0xc8844a, [x, 0.3, 0.2], B);
                    for (const sx of [-0.38, 0.38]) cyl(0.04, 0.04, 1.5, 0xffffff, [x + sx, 0.75, -0.1], B, 6);
                    const aw = mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), tm(cols[i]), [x, 1.5, 0.15], [0.25, 0, 0], B);
                    void aw;
                    for (let k = 0; k < 3; k++) ball(0.1, [0xff3b3b, 0xffe46a, 0x46e07a][k], [x - 0.2 + k * 0.2, 0.7, 0.35], B);
                }
                box(2.6, 1.2, 0.8, 0xffe8c8, [0, 0.6, -1.0], B);
                gable(2.6, 0.7, 0.8, 0xff7a3a, [0, 1.2, -1.0], B);
                const coin = cyl(0.35, 0.35, 0.08, tm(0xffcf4a, { emissive: 0x6a4a00 }), [0, 2.4, -1.0], B, 20);
                coin.rotation.x = Math.PI / 2;
                spin(coin, 'y', 2);
                height = 2.8;
                break;
            }
            case 'quarry': {
                for (let i = 0; i < 6; i++) mesh(new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.15), tm(0xb8b0c8), [-0.8 + (i % 3) * 0.7, 0.3 + Math.floor(i / 3) * 0.5, -0.5 + (i % 2) * 0.4], [i, i * 2, 0], B);
                box(0.8, 0.4, 0.5, 0x8a5a2a, [0.9, 0.35, 0.8], B);
                for (const sx of [-1, 1]) cyl(0.15, 0.15, 0.08, 0x3a2a2a, [0.9 + sx * 0.3, 0.15, 1.08], B, 10).rotation.x = Math.PI / 2;
                for (let i = 0; i < 3; i++) ball(0.14, 0xd8d0e0, [0.8 + i * 0.12, 0.65, 0.8], B);
                const crane = new THREE.Group(); crane.position.set(-1.1, 0, 0.8);
                cyl(0.08, 0.1, 2.4, 0x8a5a2a, [0, 1.2, 0], crane, 6);
                const arm = box(1.6, 0.08, 0.08, 0x8a5a2a, [0.6, 2.35, 0], crane);
                void arm;
                B.add(crane);
                spin(crane, 'y', 0.4);
                height = 2.6;
                break;
            }
            case 'guild': {
                box(2.4, 2.2, 2.0, 0xfff0d8, [0, 1.1, -0.2], B);
                box(2.5, 0.2, 2.1, 0x8a4a22, [0, 2.25, -0.2], B);
                pyramid(1.95, 1.5, 0x3a6adf, [0, 3.1, -0.2], B);
                box(0.7, 1.1, 0.1, 0x8a4a22, [0, 0.55, 0.82], B);
                for (const sx of [-0.8, 0.8]) box(0.45, 0.5, 0.1, 0x7fe3ff, [sx, 1.3, 0.82], B);
                for (const sx of [-1, 1]) {
                    cyl(0.04, 0.04, 1.6, 0xffffff, [sx * 1.0, 3.2, -0.2], B, 6);
                    const flag = mesh(new THREE.PlaneGeometry(0.7, 0.4, 5, 1), tm(sx > 0 ? 0xffcf4a : 0xff5fa8, { side: THREE.DoubleSide }), [sx * 1.0 + 0.35, 3.8, -0.2], null, B);
                    this.anims.push({ kind: 'flag', g: flag, owner: g });
                }
                height = 4.1;
                break;
            }
            case 'herbs': {
                for (let r = 0; r < 3; r++) {
                    box(2.5, 0.2, 0.5, 0x8a5a2a, [0, 0.1, -0.9 + r * 0.8], B);
                    for (let i = 0; i < 6; i++) {
                        ball(0.2, 0x2fbe5a, [-1.05 + i * 0.42, 0.35, -0.9 + r * 0.8], B);
                        ball(0.08, [0xff5fa8, 0xffe46a, 0xb46bff][(i + r) % 3], [-1.05 + i * 0.42, 0.55, -0.9 + r * 0.8], B);
                    }
                }
                const gh = mesh(new THREE.BoxGeometry(1.0, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.45, roughness: 0.05 }), [0.9, 0.45, 1.05], null, B);
                void gh;
                gable(1.0, 0.45, 0.9, 0x9ae0ff, [0.9, 0.9, 1.05], B);
                const can = cyl(0.12, 0.14, 0.25, 0x3fa8ff, [-1.0, 0.15, 1.1], B, 8);
                void can;
                height = 1.8;
                break;
            }
            case 'forge': {
                box(2.2, 1.6, 1.8, 0x8a8aa0, [0, 0.8, -0.3], B);
                gable(2.2, 0.9, 1.8, 0x5a3a3a, [0, 1.6, -0.3], B);
                box(0.5, 2.6, 0.5, 0x6a6a7a, [0.75, 1.9, -0.8], B);
                const fire = box(0.9, 0.6, 0.12, new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }), [0, 0.5, 0.62], B);
                this.anims.push({ kind: 'flicker', g: fire, owner: g });
                box(0.6, 0.35, 0.35, 0x3a3a4a, [-0.9, 0.35, 0.9], B);
                box(0.35, 0.15, 0.25, 0x3a3a4a, [-0.9, 0.6, 0.9], B);
                smoke(0.75, 3.3, -0.8, 0x9a9aaa);
                height = 3.4;
                break;
            }
            case 'training': {
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    cyl(0.05, 0.05, 0.6, 0x8a5a2a, [Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4], B, 5);
                }
                for (const x of [-0.6, 0.6]) {
                    const d = new THREE.Group(); d.position.set(x, 0, -0.2);
                    cyl(0.05, 0.05, 1.2, 0x8a5a2a, [0, 0.6, 0], d, 5);
                    cyl(0.25, 0.25, 0.6, 0xe8c87a, [0, 1.0, 0], d, 8);
                    ball(0.2, 0xe8c87a, [0, 1.45, 0], d);
                    box(0.9, 0.08, 0.08, 0x8a5a2a, [0, 1.1, 0], d);
                    B.add(d);
                    this.anims.push({ kind: 'wobble', g: d, owner: g, ph: x * 3 });
                }
                const target = cyl(0.45, 0.45, 0.08, 0xffffff, [0, 0.9, 0.9], B, 20);
                target.rotation.x = Math.PI / 2;
                cyl(0.3, 0.3, 0.09, 0xff3b3b, [0, 0.9, 0.9], B, 20).rotation.x = Math.PI / 2;
                cyl(0.12, 0.12, 0.1, 0xffcf4a, [0, 0.9, 0.9], B, 16).rotation.x = Math.PI / 2;
                height = 2;
                break;
            }
            case 'alchemist': {
                cyl(1.0, 1.1, 2.2, 0xe8dcff, [0, 1.1, -0.3], B, 12);
                cone(1.3, 1.6, 0x8a3adf, [0, 3.0, -0.3], B, 12);
                ball(0.18, tm(0xffe46a, { emissive: 0x8a6a00 }), [0, 3.9, -0.3], B);
                box(0.5, 0.9, 0.1, 0x5a2a7a, [0, 0.45, 0.75], B);
                const caul = cyl(0.45, 0.35, 0.5, 0x2a2a3a, [1.0, 0.3, 0.9], B, 12);
                void caul;
                const brew = mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x7dff6a, toneMapped: false }), [1.0, 0.56, 0.9], [-Math.PI / 2, 0, 0], B);
                void brew;
                this.anims.push({ kind: 'bubbles', g: B, pos: new THREE.Vector3(1.0, 0.6, 0.9), owner: g, t: 0 });
                height = 4;
                break;
            }
            case 'storehouse': {
                box(2.4, 1.6, 2.0, 0xd84a4a, [0, 0.8, -0.2], B);
                gable(2.4, 1.0, 2.0, 0x7a2a2a, [0, 1.6, -0.2], B);
                box(1.0, 1.1, 0.1, 0xfff0d8, [0, 0.55, 0.82], B);
                box(1.2, 0.1, 0.12, 0xd84a4a, [0, 0.55, 0.86], B, [0, 0, 0.75]);
                box(1.2, 0.1, 0.12, 0xd84a4a, [0, 0.55, 0.86], B, [0, 0, -0.75]);
                for (let i = 0; i < 3; i++) box(0.5, 0.5, 0.5, 0xc8944a, [-1.4 + (i % 2) * 0.2, 0.25 + i * 0.5 - (i === 2 ? 0.5 : 0), 1.0 - (i === 2 ? 0 : 0)], B);
                height = 2.8;
                break;
            }
            case 'crystal': {
                mesh(new THREE.DodecahedronGeometry(1.3), tm(0x8a7a9a), [0, 0.4, -0.2], [0.3, 0.5, 0], B).scale.y = 0.6;
                const cc = [0x7fe3ff, 0xff7ae0, 0xb48cff];
                for (let i = 0; i < 5; i++) {
                    const c = mesh(new THREE.OctahedronGeometry(0.35 + (i % 3) * 0.12), new THREE.MeshToonMaterial({ color: cc[i % 3], gradientMap: gradientMap(), emissive: new THREE.Color(cc[i % 3]).multiplyScalar(0.45) }), [-0.8 + i * 0.4, 1.0 + (i % 2) * 0.3, -0.2 + (i % 3) * 0.2], [0.2 * i, 0, 0.3 - i * 0.15], B);
                    c.scale.y = 2;
                    this.anims.push({ kind: 'pulse', g: c, owner: g, ph: i });
                }
                box(0.7, 0.9, 0.2, 0x3a2a3a, [0.9, 0.45, 0.7], B);
                cyl(0.2, 0.2, 0.08, 0xffe46a, [0.9, 1.05, 0.82], B, 8);
                height = 2.4;
                break;
            }
            case 'magetower': {
                cyl(0.75, 0.95, 3.6, 0xe0d8ff, [0, 1.8, -0.2], B, 10);
                cone(1.05, 2.0, 0x3a6adf, [0, 4.6, -0.2], B, 10);
                for (let i = 0; i < 3; i++) box(0.3, 0.45, 0.1, 0x7fe3ff, [0, 1.2 + i * 1.0, 0.66], B);
                const orb = ball(0.32, tm(0x7fe3ff, { emissive: 0x2a8aaa }), [0, 6.0, -0.2], B);
                this.anims.push({ kind: 'bob', g: orb, owner: g, y: 6.0 });
                const ring = mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffe46a, toneMapped: false }), [0, 6.0, -0.2], [Math.PI / 2, 0, 0], B);
                spin(ring, 'z', 1.5);
                height = 6.4;
                break;
            }
            case 'scriptorium': {
                box(2.4, 1.8, 1.8, 0xf0e0c8, [0, 0.9, -0.3], B);
                gable(2.4, 1.0, 1.8, 0x5a3adf, [0, 1.8, -0.3], B);
                for (const sx of [-0.7, 0.7]) box(0.4, 0.6, 0.1, 0xffe9a0, [sx, 1.1, 0.62], B);
                box(0.6, 1.0, 0.1, 0x6a3a1a, [0, 0.5, 0.62], B);
                const quill = new THREE.Group(); quill.position.set(0, 3.1, -0.3);
                cone(0.25, 1.6, 0xffffff, [0, 0.4, 0], quill, 6);
                cyl(0.03, 0.03, 0.6, 0x3a2a5a, [0, -0.55, 0], quill, 5);
                quill.rotation.z = 0.5;
                B.add(quill);
                this.anims.push({ kind: 'wobble', g: quill, owner: g, ph: 1 });
                cyl(0.18, 0.22, 0.3, 0x1a1030, [1.1, 0.15, 0.9], B, 10);
                height = 3.8;
                break;
            }
            case 'clocktower': {
                box(1.4, 4.6, 1.4, 0xe8dcc8, [0, 2.3, -0.3], B);
                pyramid(1.25, 1.6, 0x3a8a6a, [0, 5.4, -0.3], B);
                const face = cyl(0.55, 0.55, 0.08, 0xffffff, [0, 3.7, 0.42], B, 24);
                face.rotation.x = Math.PI / 2;
                const hands = new THREE.Group(); hands.position.set(0, 3.7, 0.48);
                box(0.05, 0.4, 0.03, 0x1a1030, [0, 0.18, 0], hands);
                B.add(hands);
                const hands2 = new THREE.Group(); hands2.position.set(0, 3.7, 0.49);
                box(0.06, 0.28, 0.03, 0xff3b6b, [0, 0.12, 0], hands2);
                B.add(hands2);
                spin(hands, 'z', -1.2); spin(hands2, 'z', -0.12);
                box(0.6, 1.0, 0.1, 0x6a3a1a, [0, 0.5, 0.42], B);
                height = 6.2;
                break;
            }
            default: box(2, 2, 2, 0xffffff, [0, 1, 0], B);
        }
        // level decorations
        if (level >= 4) {
            cyl(0.03, 0.03, 1.0, 0xffffff, [-1.3, 0.5, 1.2], B, 5);
            const f = mesh(new THREE.PlaneGeometry(0.45, 0.28, 4, 1), tm(0xffcf4a, { side: THREE.DoubleSide }), [-1.07, 0.88, 1.2], null, B);
            this.anims.push({ kind: 'flag', g: f, owner: g });
        }
        if (level >= 8) {
            const star = mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffe46a, toneMapped: false }), [0, height / s + 0.5, 0], null, B);
            spin(star, 'y', 2);
        }
        g.userData.height = height * s;
        g.userData.grow = 1;
        return g;
    }

    // ------------------------------------------------------------------ Camera & input

    orbitBy(dx, dy) { this.wantYaw -= dx * 0.006; this.pitch = Math.max(0.32, Math.min(1.1, this.pitch + dy * 0.003)); this.autoSpin = 0; }
    zoomBy(f) { this.wantDist = Math.max(22, Math.min(58, this.wantDist * f)); }

    pick(ndcX, ndcY) {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const hits = ray.intersectObjects(this.hit, false);
        if (!hits.length) return null;
        return hits[0].object.userData;
    }

    plotOfBuilding(id) { return this.built[id]?.plot; }

    update(dt, opts = {}) {
        this.time += dt;
        const t = this.time;
        if (opts.attract) this.wantYaw += dt * 0.08;
        this.yaw += (this.wantYaw - this.yaw) * Math.min(1, dt * 5);
        this.dist += (this.wantDist - this.dist) * Math.min(1, dt * 5);
        const c = this.camera;
        const fx = this.focus;
        // Narrow (portrait) screens pull the camera back so the whole island fits.
        const fit = c.aspect < 1.25 ? Math.min(2.3, Math.pow(1.25 / c.aspect, 0.9)) : 1;
        const dist = this.dist * fit;
        c.position.set(fx.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist, fx.y + Math.sin(this.pitch) * dist, fx.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist);
        c.lookAt(fx.x, fx.y + 1.5, fx.z);
        this.sky.position.copy(c.position);
        this.fallMat.uniforms.uTime.value = t;
        this.waterMat.emissive.setHSL(0.56, 0.8, 0.12 + Math.sin(t * 2) * 0.03);
        if (Math.random() < dt * 6) this._puff(this.fallPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5)), 0xffffff, 1.6);
        for (const cl of this.clouds) { const u = cl.userData; u.a += u.sp * dt; cl.position.x = Math.cos(u.a) * u.r; cl.position.z = Math.sin(u.a) * u.r; }
        this.orbit.rotation.y += dt * 0.5;
        this.orbitBooks.forEach((b, i) => { b.rotation.y += dt; b.position.y = Math.sin(t * 1.5 + i) * 0.5; });
        this.beacon.rotation.y += dt * 1.5;
        this.beacon.position.y = 11.6 + Math.sin(t * 2) * 0.2;
        for (const b of this.birds) { const u = b.userData; u.a += u.sp * dt; b.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t + u.r) * 0.6, Math.sin(u.a) * u.r); b.rotation.y = -u.a; b.children.forEach((w, i) => { w.rotation.z = Math.sin(t * 10 + u.r) * 0.6 * (i ? -1 : 1); }); }
        for (const v of this.villagers) {
            const u = v.userData;
            if (u.pause > 0) { u.pause -= dt; v.position.y = 0; continue; }
            if (Math.random() < dt * 0.05) u.pause = 1 + Math.random() * 2;
            u.a += u.sp * dt;
            const x = Math.cos(u.a) * 9.2, z = Math.sin(u.a) * 9.2 / 1.15;
            v.rotation.y = Math.atan2(x - v.position.x, z - v.position.z);
            v.position.set(x, Math.abs(Math.sin(t * 8 + u.hop)) * 0.12, z);
        }
        if (this.hero.children.length) this.hero.rotation.y = Math.sin(t * 0.5) * 0.4;
        for (let i = this.anims.length - 1; i >= 0; i--) {
            const a = this.anims[i];
            if (a.owner && !a.owner.parent) { this.anims.splice(i, 1); continue; }
            switch (a.kind) {
                case 'spin': a.g.rotation[a.axis] += dt * a.speed; break;
                case 'flag': { const p = a.g.geometry.attributes.position; if (!a.base) a.base = Float32Array.from(p.array); for (let k = 0; k < p.count; k++) { const x = a.base[k * 3]; p.setZ(k, Math.sin(t * 6 + x * 6) * 0.08 * (x + 0.5)); } p.needsUpdate = true; break; }
                case 'smoke': a.t += dt; if (a.t > 0.5) { a.t = 0; this._puff(a.g.localToWorld(a.pos.clone()), a.color || 0xf0f0ff, 0.7); } break;
                case 'flicker': a.g.material.color.setHSL(0.07 + Math.sin(t * 13) * 0.02, 1, 0.55 + Math.sin(t * 17) * 0.08); break;
                case 'wobble': a.g.rotation.z = Math.sin(t * 2 + (a.ph || 0)) * 0.12 + (a.g.rotation.z * 0); break;
                case 'bob': a.g.position.y = a.y + Math.sin(t * 2) * 0.15; break;
                case 'pulse': a.g.scale.set(1 + Math.sin(t * 3 + a.ph) * 0.06, 2 + Math.sin(t * 3 + a.ph) * 0.12, 1 + Math.sin(t * 3 + a.ph) * 0.06); break;
                case 'float': a.g.position.y = a.g.userData.y + Math.sin(t * 0.5 + a.g.userData.ph) * 0.8; break;
                case 'bubbles': a.t += dt; if (a.t > 0.25) { a.t = 0; this.fx.burst(a.g.localToWorld(a.pos.clone()), 0x7dff6a, 1, { speed: 0.6, up: 2.5, gravity: 0.5, size: 0.3, life: 0.9 }); } break;
                default: break;
            }
        }
        for (const b of Object.values(this.built)) {
            const u = b.group.userData;
            if (u.grow < 1) {
                u.grow = Math.min(1, u.grow + dt * 1.6);
                const k = u.grow;
                b.group.scale.setScalar(Math.max(0.01, 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2)));
            }
        }
        for (const p of this.smoke) {
            if (p.life <= 0) continue;
            p.life -= dt;
            const k = 1 - p.life / p.max;
            p.s.position.y += dt * 0.9;
            p.s.position.x += dt * 0.25;
            const sc = p.size * (0.5 + k * 1.4);
            p.s.scale.set(sc, sc, 1);
            p.s.material.opacity = Math.sin(k * Math.PI) * 0.6;
            if (p.life <= 0) p.s.visible = false;
        }
        if (this.freeGlows[0]) for (const m of this.freeGlows) if (m.visible) m.material.opacity = 0.55 + Math.sin(t * 5) * 0.35;
    }
}
