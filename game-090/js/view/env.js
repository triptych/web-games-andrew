// Environments: turns a generated floor (sim/gen.js) into a lit, fogged three.js scene.
// Floors and walls are InstancedMesh with hand-painted textures; scenery is one InstancedMesh per
// kind (props.js); a shadow-casting sun follows the Agent; a few point lights hop between the
// nearest lamps; spores, embers or data-motes drift through the air; and the walls between the
// camera and the Agent sink out of the way.

import * as THREE from 'three';
import { toonMat, TOON, K, merge, part, glow } from './toon.js';
import { TEX, dotTexture } from './tex.js';
import { propGeometry, LIT, PROP_GLOW } from './props.js';
import { ZONES } from '../sim/data/zones.js';
import { cellAt, FLOOR, WALL, VOID } from '../sim/gen.js';
import { hash3 } from '../rng.js';

export const CELL = 2;
export const toWorld = (x, y) => new THREE.Vector3(x * CELL, 0, y * CELL);

const THEME = {
    tunnel: { floor: () => TEX.tiles('#4c5c5a', '#0a1414', 3), wall: () => TEX.bricks('#4a6058', '#0e1814'), top: '#2c3c38', wallH: 3.2, particle: '#7affd0', pk: 'motes', hemi: ['#7affd0', '#0a1a1a'], sunI: 1.1, ambient: 0.55, water: true },
    hall: { floor: () => TEX.grass('#4a6a4a', '#8ae05a', 5), wall: () => TEX.noise('#a8a090', 4), top: '#6a6a60', wallH: 3.0, particle: '#fff2b0', pk: 'spores', hemi: ['#fff2d0', '#1a3a1a'], sunI: 1.9, ambient: 0.7 },
    racks: { floor: () => TEX.metal('#2a3250', 4), wall: () => TEX.circuit('#161c30', '#3acaff', 10), top: '#101424', wallH: 3.2, particle: '#5af0ff', pk: 'motes', hemi: ['#5af0ff', '#080c1c'], sunI: 0.9, ambient: 0.5 },
    nave: { floor: () => TEX.tiles('#4a4468', '#0e0a1c', 6), wall: () => TEX.bricks('#4a4268', '#12102a', 3), top: '#2a2644', wallH: 4.0, particle: '#c8b0ff', pk: 'motes', hemi: ['#b08aff', '#0a0818'], sunI: 1.0, ambient: 0.5, water: true },
    rail: { floor: () => TEX.metal('#6a7a8c', 7), wall: () => TEX.metal('#8a9aac', 5), top: '#6a7a8c', wallH: 1.0, particle: '#ffffff', pk: 'wind', hemi: ['#bff0ff', '#4a6a8a'], sunI: 2.2, ambient: 0.8, void: true },
    spire: { floor: () => TEX.hex('#e8e0f0', '#ff4ad8', 6), wall: () => TEX.glass('#2a1a3c', 9), top: '#1c1228', wallH: 3.6, particle: '#ff8af0', pk: 'motes', hemi: ['#ff8af0', '#12081c'], sunI: 1.1, ambient: 0.6 },
};
export const themeOf = (name) => THEME[name] || THEME.hall;

// ---------------------------------------------------------------- the sky dome
function skyDome(top, bottom) {
    const m = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTop: { value: new THREE.Color(top) }, uBot: { value: new THREE.Color(bottom) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uTop; uniform vec3 uBot; varying vec3 vP; void main(){ float k = smoothstep(-0.2, 0.9, vP.y); gl_FragColor = vec4(mix(uBot, uTop, k), 1.0); }',
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(200, 16, 10), m);
    s.renderOrder = -10;
    s.frustumCulled = false;
    return s;
}

// ---------------------------------------------------------------- particles
export class Motes {
    constructor(n, color, kind) {
        this.n = n; this.kind = kind;
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(n * 3);
        this.seed = new Float32Array(n);
        for (let i = 0; i < n; i++) this.seed[i] = Math.random();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.mat = new THREE.PointsMaterial({ map: dotTexture(), color, size: kind === 'wind' ? 0.35 : 0.22, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.center = new THREE.Vector3();
    }
    update(t, c) {
        this.center.copy(c);
        const R = 14, D = 2 * R;
        const wrap = (v, ctr) => (((v - ctr + R) % D) + D) % D - R + ctr;
        for (let i = 0; i < this.n; i++) {
            const s = this.seed[i];
            let x = hash3(i, 1, 7) * D, z = hash3(i, 2, 7) * D, y = hash3(i, 3, 7) * 5;
            if (this.kind === 'wind') { x += t * (3 + s * 4); y = 0.5 + y * 0.8 + Math.sin(t + i) * 0.4; }
            else if (this.kind === 'spores') { y = (y + t * (0.15 + s * 0.2)) % 5; x += Math.sin(t * 0.6 + i) * 0.7; z += Math.cos(t * 0.5 + i * 1.7) * 0.7; }
            else { y = 0.4 + ((y + Math.sin(t * 0.4 + i) * 0.5) % 4.5 + 4.5) % 4.5; x += Math.sin(t * 0.3 + i) * 0.5; z += Math.cos(t * 0.35 + i) * 0.5; }
            this.pos[i * 3] = wrap(x, c.x);
            this.pos[i * 3 + 1] = y;
            this.pos[i * 3 + 2] = wrap(z, c.z);
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.mat.opacity = 0.65 + Math.sin(t * 1.3) * 0.15;
    }
}

// ---------------------------------------------------------------- the floor builder
/**
 * Builds a whole floor. Returns { group, update(t, px, py, camPos), lights, sunTarget, props: {lamps}, dispose() }.
 * quality: 0 low, 1 medium, 2 high.
 */
export function buildEnvironment(fl, zoneId, themeOverride, quality = 2) {
    const Z = ZONES[zoneId];
    const T = THEME[themeOverride || fl.theme] || THEME.hall;
    const group = new THREE.Group();
    const w = fl.w, h = fl.h;

    // --- floor
    const floorCells = [], wallCells = [], voidCells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = fl.cells[y * w + x];
        if (c === FLOOR) floorCells.push([x, y]);
        else {
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (cellAt(fl, x + dx, y + dy) === FLOOR) { near = true; break; }
            if (near) (c === VOID ? voidCells : wallCells).push([x, y]);
        }
    }
    const floorMat = toonMat({ map: T.floor(), color: 0xffffff });
    const fgeo = new THREE.PlaneGeometry(CELL, CELL); fgeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.InstancedMesh(fgeo, floorMat, floorCells.length);
    floorMesh.receiveShadow = true;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    floorCells.forEach(([x, y], i) => {
        m4.makeTranslation(x * CELL + CELL / 2, 0, y * CELL + CELL / 2);
        floorMesh.setMatrixAt(i, m4);
        const k = 0.82 + hash3(x, y, 11) * 0.3;
        floorMesh.setColorAt(i, col.setRGB(k, k, k * (0.96 + hash3(x, y, 3) * 0.08)));
    });
    group.add(floorMesh);

    // --- walls (or railings, where the floor is a platform over a void)
    const wallH = T.wallH;
    const wgeo = new THREE.BoxGeometry(CELL, wallH, CELL);
    const wallMat = toonMat({ map: T.wall(), color: 0xffffff });
    const wallMesh = new THREE.InstancedMesh(wgeo, wallMat, Math.max(1, wallCells.length));
    wallMesh.castShadow = quality > 0;
    wallMesh.receiveShadow = true;
    wallMesh.count = wallCells.length;
    const walls = [];
    wallCells.forEach(([x, y], i) => {
        const wh = wallH * (0.92 + hash3(x, y, 5) * 0.16);
        const p = new THREE.Vector3(x * CELL + CELL / 2, wh / 2, y * CELL + CELL / 2);
        walls.push({ i, x: p.x, z: p.z, base: wh, cur: 1, want: 1, y: wh / 2 });
        m4.compose(p, new THREE.Quaternion(), new THREE.Vector3(1, wh / wallH, 1));
        wallMesh.setMatrixAt(i, m4);
        const k = 0.75 + hash3(x, y, 8) * 0.35;
        wallMesh.setColorAt(i, col.setRGB(k, k, k));
    });
    group.add(wallMesh);

    // void edge: a dark abyss with cloud swirls under the platforms
    let abyss = null;
    if (T.void) {
        abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: TEX.noise('#cfe4f4', 12), color: '#ffffff', fog: true }));
        abyss.material.map.repeat.set(30, 30);
        abyss.rotation.x = -Math.PI / 2; abyss.position.set(w, -14, h);
        group.add(abyss);
        // railings along every floor edge
        const rails = [];
        for (const [x, y] of floorCells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cellAt(fl, x + dx, y + dy) !== FLOOR) rails.push([x, y, dx, dy]);
        const rgeo = merge([K.box(CELL, 0.08, 0.1, { c: '#cfd8e4', p: [0, 0.9, 0] }), K.box(CELL, 0.06, 0.08, { c: '#9aa6b4', p: [0, 0.45, 0] }), K.box(0.1, 1.0, 0.1, { c: '#8a96a6', p: [-CELL / 2 + 0.05, 0.5, 0] }), K.box(0.1, 1.0, 0.1, { c: '#8a96a6', p: [CELL / 2 - 0.05, 0.5, 0] })]);
        const rm = new THREE.InstancedMesh(rgeo, toonMat({ vertexColors: true }), rails.length);
        rails.forEach(([x, y, dx, dy], i) => {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx ? Math.PI / 2 : 0);
            m4.compose(new THREE.Vector3(x * CELL + CELL / 2 + dx * CELL / 2, 0, y * CELL + CELL / 2 + dy * CELL / 2), q, new THREE.Vector3(1, 1, 1));
            rm.setMatrixAt(i, m4);
        });
        group.add(rm);
    }

    // water on the floor of the tunnels and the nave: a shimmering, translucent sheet
    let water = null;
    if (T.water) {
        water = new THREE.Mesh(new THREE.PlaneGeometry(w * CELL, h * CELL), new THREE.MeshBasicMaterial({ map: TEX.water('#2a6a8a', '#bff0ff', 8), color: '#9ad8ff', transparent: true, opacity: 0.32, depthWrite: false }));
        water.material.map.repeat.set(w * 0.7, h * 0.7);
        water.rotation.x = -Math.PI / 2; water.position.set(w * CELL / 2, 0.02, h * CELL / 2);
        group.add(water);
    }

    // --- props
    const byTag = new Map();
    for (const p of fl.props) { if (!byTag.has(p.k)) byTag.set(p.k, []); byTag.get(p.k).push(p); }
    const lamps = [];
    for (const [tag, list] of byTag) {
        const geo = propGeometry(tag);
        const im = new THREE.InstancedMesh(geo, toonMat({ vertexColors: true }), list.length);
        im.castShadow = quality > 1 && tag !== 'puddle' && tag !== 'cable';
        list.forEach((p, i) => {
            const jx = (hash3(p.x, p.y, 21) - 0.5) * 0.4, jz = (hash3(p.x, p.y, 22) - 0.5) * 0.4;
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r * Math.PI / 2 + hash3(p.x, p.y, 23) * 0.5);
            const s = 0.9 + hash3(p.x, p.y, 24) * 0.25;
            m4.compose(new THREE.Vector3(p.x * CELL + CELL / 2 + jx, 0, p.y * CELL + CELL / 2 + jz), q, new THREE.Vector3(s, s, s));
            im.setMatrixAt(i, m4);
            if (LIT.has(tag)) { const g = PROP_GLOW[tag]; lamps.push(new THREE.Vector3(p.x * CELL + CELL / 2 + jx + g[0], g[1], p.y * CELL + CELL / 2 + jz + g[2])); }
        });
        group.add(im);
    }

    // --- lights
    const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.ambient * 1.4);
    group.add(hemi);
    const sun = new THREE.DirectionalLight(Z.light, T.sunI);
    sun.position.set(14, 24, 10);
    sun.castShadow = quality > 0;
    sun.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
    const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    group.add(sun, sun.target);
    const pts = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(Z.accent, 0, 16, 1.6); group.add(l); pts.push(l); }
    const lantern = new THREE.PointLight('#ffe8c0', 5, 12, 1.4);
    group.add(lantern);

    const sky = skyDome(Z.sky[0], Z.sky[1]);
    group.add(sky);

    const motes = new Motes(quality > 1 ? 260 : quality > 0 ? 150 : 70, T.particle, T.pk);
    group.add(motes.points);

    const fogColor = new THREE.Color(Z.fog);
    const info = { fogColor, fogNear: 18, fogFar: T.void ? 70 : 46, rim: Z.accent, rimK: 0.5 };

    function update(t, px, pz, camPos, camYaw) {
        const c = new THREE.Vector3(px, 0, pz);
        sun.position.set(px + 14, 24, pz + 10);
        sun.target.position.set(px, 0, pz);
        lantern.position.set(px, 2.4, pz);
        lantern.intensity = 5 + Math.sin(t * 5) * 0.3;
        sky.position.copy(camPos);
        if (abyss) abyss.position.set(px, -14, pz);
        if (water) water.material.map.offset.set(t * 0.02, t * 0.014);
        // the four lamps nearest the Agent get the point lights
        if (lamps.length) {
            const near = lamps.map((l) => ({ l, d: (l.x - px) ** 2 + (l.z - pz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 4);
            pts.forEach((pl, i) => { if (near[i] && near[i].d < 400) { pl.position.copy(near[i].l); pl.intensity = 7 * (1 - Math.min(1, near[i].d / 400)); } else pl.intensity = 0; });
        }
        motes.update(t, c.setY(0));
        // walls between the camera and the Agent sink so the Agent is never hidden
        const dx = camPos.x - px, dz = camPos.z - pz, dl = Math.hypot(dx, dz) || 1;
        let touched = false;
        for (const wl of walls) {
            const rx = wl.x - px, rz = wl.z - pz;
            const dist = Math.hypot(rx, rz);
            let want = 1;
            if (dist < 11) {
                const along = (rx * dx + rz * dz) / dl;       // how far toward the camera
                const side = Math.abs(rx * dz - rz * dx) / dl; // how far off the line
                if (along > 0.5 && side < 3.2 + along * 0.18) want = 0.28;
            }
            if (Math.abs(wl.cur - want) > 0.002) {
                wl.cur += (want - wl.cur) * 0.18;
                const hh = wl.base * wl.cur;
                m4.compose(new THREE.Vector3(wl.x, hh / 2, wl.z), new THREE.Quaternion(), new THREE.Vector3(1, hh / wallH, 1));
                wallMesh.setMatrixAt(wl.i, m4);
                touched = true;
            }
        }
        if (touched) wallMesh.instanceMatrix.needsUpdate = true;
    }

    function dispose() {
        group.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData?.shared && o.material.dispose) o.material.dispose(); if (o.isLight && o.shadow?.map) o.shadow.map.dispose(); });
    }
    return { group, update, info, lamps, theme: T, dispose, sun };
}
