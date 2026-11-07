// The wagon: everything that is built once. A barrel-vaulted room with damask walls and a striped canopy, a door and
// an arched window onto the village sky, shelves of jars, the round table with its embroidered cloth, the crystal
// ball, the candles, the deck, the journal, your hands, a chair for the guest, and a particle system.
// buildStage(scene, quality) returns the references the view animates.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { wallTexture, floorTexture, woodTexture, rugTexture, clothTexture, skirtTexture, canopyTexture, tapestryTexture, journalTexture, skyTexture, SLOT_FRAC } from './textures.js';
import { cardFace, cardBack, glyphCanvas, cloudCanvas, CARD_W, CARD_H } from './art.js';

const TAU = Math.PI * 2;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.7, ...o });

export const POS = {
    tableC: new THREE.Vector3(0, 0, -0.35),
    topY: 0.812,
    ball: new THREE.Vector3(0, 1.06, -0.5),
    chair: new THREE.Vector3(0, 0, -1.6),
    door: new THREE.Vector3(-1.2, 0, -2.75),
    deck: new THREE.Vector3(0.55, 0.845, -0.05),
    cam: new THREE.Vector3(0, 1.32, 0.95),
};
export const slotWorld = (i) => new THREE.Vector3((SLOT_FRAC[i][0] - 0.5) * 1.48, POS.topY + 0.004, -0.35 + (SLOT_FRAC[i][1] - 0.5) * 1.48);
export const CARD_SIZE = { w: 0.17, h: 0.29 };

const soft = (size = 64, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

function uvMeters(geo, su, sv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }

// ------------------------------------------------------------------------------------------- particles
const PV = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uK;
void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, aSize * uK / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const PF = `varying vec4 vC; void main(){ float d = clamp(length(gl_PointCoord - 0.5) * 2.0, 0.0, 1.0); float a = (1.0 - d); a = a * a; gl_FragColor = vec4(vC.rgb, vC.a * a); }`;

export class Particles {
    constructor(scene, max = 700, additive = true) {
        this.max = max; this.n = 0;
        this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
        this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
        this.size = new Float32Array(max); this.col = new Float32Array(max * 4); this.base = new Float32Array(max * 4);
        this.grav = new Float32Array(max); this.drag = new Float32Array(max);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        this.mat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 600 } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
        this.points = new THREE.Points(geo, this.mat);
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.geo = geo;
        for (let i = 0; i < max; i++) this.life[i] = 0;
    }
    setK(k) { this.mat.uniforms.uK.value = k; }
    emit(o) {
        let i = -1;
        for (let k = 0; k < this.max; k++) { const j = (this.n + k) % this.max; if (this.life[j] <= 0) { i = j; break; } }
        if (i < 0) i = this.n % this.max;
        this.n = (i + 1) % this.max;
        const c = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color || '#ffffff');
        this.p.set([o.x, o.y, o.z], i * 3); this.v.set([o.vx || 0, o.vy || 0, o.vz || 0], i * 3);
        this.life[i] = this.maxLife[i] = o.life || 1; this.size[i] = o.size || 0.05;
        this.base.set([c.r, c.g, c.b, o.alpha ?? 0.8], i * 4);
        this.grav[i] = o.grav || 0; this.drag[i] = o.drag ?? 0.5;
    }
    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
            this.life[i] -= dt;
            const k = i * 3, d = Math.max(0, 1 - this.drag[i] * dt);
            this.v[k] *= d; this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * dt; this.v[k + 2] *= d;
            this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
            const u = Math.max(0, this.life[i] / this.maxLife[i]);
            const f = Math.min(1, u * 3) * Math.min(1, (1 - u) * 12 + 0.2);
            this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
            this.col[i * 4 + 3] = this.base[i * 4 + 3] * f;
        }
        this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    }
}

// ------------------------------------------------------------------------------------------- the build
export function buildStage(scene, renderer, { high = true } = {}) {
    const S = {};
    scene.background = new THREE.Color(0x07040f);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;

    const wood = mat('#6a3f26', { map: woodTexture(), roughness: 0.6 });
    const darkWood = mat('#3a2010', { map: woodTexture('#33190c'), roughness: 0.55 });
    const gold = mat('#e8c14a', { metalness: 0.85, roughness: 0.28, emissive: new THREE.Color('#3a2a06') });
    const velvet = (c) => mat(c, { roughness: 0.95 });
    const W = 1.7, H1 = 1.5, HV = 1.15, Z0 = -3.0, Z1 = 2.05, LEN = Z1 - Z0;

    // --- floor and rug
    const floorGeo = new THREE.PlaneGeometry(2 * W, LEN); uvMeters(floorGeo, 2 * W / 0.5, LEN / 0.5);
    const floor = new THREE.Mesh(floorGeo, mat('#ffffff', { map: floorTexture(), roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2);
    scene.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshStandardMaterial({ map: rugTexture(), transparent: true, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, -0.6);
    scene.add(rug);

    // --- the barrel vault, in canopy stripes, with wooden ribs
    const segs = 36, vault = new THREE.PlaneGeometry(LEN, 1, 1, segs);
    const vp = vault.attributes.position;
    for (let i = 0; i < vp.count; i++) {
        const u = vp.getX(i), v = vp.getY(i) + 0.5;            // u along z, v around 0..1
        const a = v * Math.PI;
        vp.setXYZ(i, Math.cos(a) * W, H1 + Math.sin(a) * HV, Z0 + u + LEN / 2);
    }
    vault.computeVertexNormals();
    const cv = vault.attributes.uv; for (let i = 0; i < cv.count; i++) cv.setXY(i, cv.getY(i) * 1.0, cv.getX(i) * LEN * 0.1);
    const canopyT = canopyTexture(); canopyT.repeat.set(1, 1);
    const roof = new THREE.Mesh(vault, new THREE.MeshStandardMaterial({ map: canopyT, roughness: 0.95, side: THREE.DoubleSide }));
    scene.add(roof);
    for (const z of [-2.6, -1.4, -0.2, 1.0, 1.9]) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 36, Math.PI), wood);
        rib.scale.set(W - 0.01, HV - 0.01, 1); rib.position.set(0, H1, z);
        scene.add(rib);
        const swag = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 36, Math.PI), gold);
        swag.scale.set(W - 0.05, HV - 0.06, 1); swag.position.set(0, H1 - 0.02, z + 0.03);
        scene.add(swag);
    }

    // --- side walls: wallpaper over a dark wainscot
    const wallM = mat('#ffffff', { map: wallTexture(), roughness: 0.9 });
    for (const s of [-1, 1]) {
        const g = new THREE.PlaneGeometry(LEN, H1); uvMeters(g, LEN * 1.25, H1 * 1.25);
        const w = new THREE.Mesh(g, wallM); w.rotation.y = -s * Math.PI / 2; w.position.set(s * W, H1 / 2, (Z0 + Z1) / 2);
        scene.add(w);
        const wain = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, LEN), darkWood); wain.position.set(s * (W - 0.02), 0.31, (Z0 + Z1) / 2);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, LEN), gold); rail.position.set(s * (W - 0.03), 0.64, (Z0 + Z1) / 2);
        scene.add(wain, rail);
    }

    // --- the back wall with a door and an arched window, and the sky behind it
    const shape = new THREE.Shape();
    shape.moveTo(-W, 0); shape.lineTo(W, 0); shape.lineTo(W, H1); shape.absellipse(0, H1, W, HV, 0, Math.PI, false); shape.lineTo(-W, 0);
    const door = new THREE.Path(); door.moveTo(-1.55, 0); door.lineTo(-0.85, 0); door.lineTo(-0.85, 1.85); door.lineTo(-1.55, 1.85); door.lineTo(-1.55, 0);
    const win = new THREE.Path(); win.moveTo(0.4, 0.95); win.lineTo(1.3, 0.95); win.lineTo(1.3, 1.5); win.absellipse(0.85, 1.5, 0.45, 0.4, 0, Math.PI, false); win.lineTo(0.4, 0.95);
    shape.holes.push(door, win);
    const bg = new THREE.ShapeGeometry(shape, 24); uvMeters(bg, 1.25, 1.25);
    const back = new THREE.Mesh(bg, wallM); back.position.z = Z0; scene.add(back);
    const front = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-W, 0); s.lineTo(W, 0); s.lineTo(W, H1); s.absellipse(0, H1, W, HV, 0, Math.PI, false); s.lineTo(-W, 0); return s; })(), 24), velvet('#4a0c34'));
    front.position.z = Z1; front.rotation.y = Math.PI; scene.add(front);

    const skyT = skyTexture();
    S.sky = { tex: skyT, canvas: skyT.userData.canvas };
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: skyT, toneMapped: false }));
    sky.position.set(0.2, 1.45, Z0 - 0.7); scene.add(sky);
    S.skyMesh = sky;
    // window glass, bars and a gold arch
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x9ac8ff, transparent: true, opacity: 0.07, roughness: 0.05 }));
    glass.position.set(0.85, 1.45, Z0 + 0.01); scene.add(glass);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 28, Math.PI), gold); arch.scale.set(0.45, 0.4, 1); arch.position.set(0.85, 1.5, Z0 + 0.03); scene.add(arch);
    for (const [px, py, sx, sy] of [[0.85, 1.28, 0.9, 0.025], [0.85, 1.55, 0.9, 0.02], [0.85, 1.45, 0.025, 1.0], [0.4, 1.35, 0.04, 0.8], [1.3, 1.35, 0.04, 0.8]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.03), gold); bar.position.set(px, py, Z0 + 0.02); scene.add(bar);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.16), wood); sill.position.set(0.85, 0.95, Z0 + 0.06); scene.add(sill);
    S.sillPos = new THREE.Vector3(0.85, 1.0, Z0 + 0.1);
    // door
    const doorG = new THREE.Group(); doorG.position.set(-1.55, 0, Z0 + 0.02);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.84, 0.05), wood); leaf.position.set(0.35, 0.92, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.02), darkWood); panel.position.set(0.35, 0.92, 0.03);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), gold); knob.position.set(0.6, 0.95, 0.06);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), gold); moon.position.set(0.35, 1.4, 0.045);
    doorG.add(leaf, panel, knob, moon); scene.add(doorG);
    S.door = doorG;
    for (const [px, py, sx, sy] of [[-1.55, 0.92, 0.06, 1.88], [-0.85, 0.92, 0.06, 1.88], [-1.2, 1.87, 0.76, 0.06]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.1), darkWood); f.position.set(px, py, Z0 + 0.03); scene.add(f);
    }

    // --- curtains: fabric with folds, tied back with gold
    const curtain = (x, w, y0, y1, z, col, side) => {
        const g = new THREE.PlaneGeometry(w, y1 - y0, 24, 8), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const u = (p.getX(i) / w + 0.5); const fold = Math.sin(u * TAU * 3) * 0.035; const bulge = Math.sin((p.getY(i) / (y1 - y0) + 0.5) * Math.PI); p.setZ(i, fold + bulge * 0.04 * side * (u - 0.5)); }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }));
        m.position.set(x, (y0 + y1) / 2, z); scene.add(m); return m;
    };
    S.curtains = [curtain(0.28, 0.26, 0.75, 2.2, Z0 + 0.08, '#8a1a58', -1), curtain(1.42, 0.26, 0.75, 2.2, Z0 + 0.08, '#8a1a58', 1), curtain(-1.69 + 0.9, 0.3, 0.0, 2.3, Z0 + 0.1, '#1a6a74', 1)];
    for (const x of [0.38, 1.32]) { const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 14), gold); tie.position.set(x, 1.15, Z0 + 0.09); tie.rotation.y = Math.PI / 2; scene.add(tie); }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8), gold); rod.rotation.z = Math.PI / 2; rod.position.set(0.85, 2.2, Z0 + 0.1); scene.add(rod);

    // --- the tapestry, the shelves and the herbs
    const tap = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.MeshStandardMaterial({ map: tapestryTexture(), roughness: 0.95, emissive: new THREE.Color(0x221040), emissiveIntensity: 0.6 }));
    tap.rotation.y = -Math.PI / 2; tap.position.set(W - 0.01, 1.28, -1.0); scene.add(tap);
    const jars = [];
    for (let row = 0; row < 2; row++) {
        const y = 0.95 + row * 0.5;
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 2.1), wood); board.position.set(-W + 0.15, y, -1.7); scene.add(board);
        for (const z of [-2.7, -0.7]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), darkWood); br.position.set(-W + 0.12, y - 0.09, z); scene.add(br); }
        let z = -2.6;
        const liq = ['#ff4a8a', '#3ae0a0', '#ffc94a', '#8a5aff', '#4aa8ff', '#ff7a1f', '#c4e01a'];
        while (z < -0.8) {
            const r = Math.random();
            if (r < 0.6) {
                const h = 0.1 + Math.random() * 0.08, c = liq[(Math.random() * liq.length) | 0];
                const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, h, 12), new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 0.55, roughness: 0.2, transparent: true, opacity: 0.92 }));
                jar.position.set(-W + 0.13 + (Math.random() - 0.5) * 0.08, y + 0.02 + h / 2, z); scene.add(jar);
                const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.02, 10), gold); lid.position.set(jar.position.x, y + 0.03 + h, z); scene.add(lid);
                jars.push(jar); z += 0.13;
            } else if (r < 0.85) {
                const n = 2 + ((Math.random() * 3) | 0);
                for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15 + Math.random() * 0.05, 0.035), mat(['#7a1a3a', '#1a4a6a', '#6a4a1a', '#2a6a4a', '#4a2a7a'][(Math.random() * 5) | 0], { roughness: 0.8 })); b.position.set(-W + 0.14, y + 0.1, z + k * 0.04); scene.add(b); }
                z += 0.04 * n + 0.08;
            } else {
                const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color: 0xc89aff, emissive: 0x6a2aff, emissiveIntensity: 0.9, roughness: 0.1 })); cr.scale.y = 1.8; cr.position.set(-W + 0.14, y + 0.12, z); cr.rotation.y = z; scene.add(cr); z += 0.14;
            }
        }
    }
    S.jars = jars;
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mat('#e8dcc0', { roughness: 0.6 })); sk.position.set(-W + 0.14, 1.04, -0.95); scene.add(sk);
    for (let i = 0; i < 5; i++) {
        const bundle = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), mat(['#4a7a3a', '#6a5a2a', '#7a3a5a', '#3a6a6a', '#8a6a2a'][i], { roughness: 1 })); cone.rotation.x = Math.PI; cone.position.y = -0.13;
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), mat('#c8a060')); str.position.y = -0.0;
        bundle.add(cone, str); bundle.position.set(-1.25 + (i % 2) * 0.1, 2.2 - Math.abs(i - 2) * 0.05, -2.6 + i * 0.35); scene.add(bundle);
    }

    // --- the guest's chair
    const chair = new THREE.Group(); chair.position.copy(POS.chair); chair.position.z -= 0.18;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.5), velvet('#5a1a7a')); seat.position.y = 0.43;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.44), velvet('#8a1a58')); cushion.position.y = 0.49;
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.9, 0.06), wood); backrest.position.set(0, 0.95, -0.26);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.74, 0.02), velvet('#5a1a7a')); inlay.position.set(0, 0.95, -0.225);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 18, 1, false, 0, Math.PI), wood); crest.rotation.x = Math.PI / 2; crest.rotation.z = Math.PI / 2; crest.position.set(0, 1.4, -0.26);
    chair.add(seat, cushion, backrest, inlay, crest);
    for (const [x, z] of [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8), wood); l.position.set(x, 0.21, z); chair.add(l); }
    for (const x of [-0.29, 0.29]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), gold); f.position.set(x, 1.42, -0.26); chair.add(f); }
    scene.add(chair);

    // --- the table
    const T = POS.tableC;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 48), wood); top.position.set(T.x, 0.785, T.z); scene.add(top);
    const cloth = new THREE.Mesh(new THREE.CircleGeometry(0.74, 64), new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.9 }));
    cloth.rotation.x = -Math.PI / 2; cloth.position.set(T.x, POS.topY, T.z); scene.add(cloth);
    const skirtProf = [[0.74, 0.81], [0.78, 0.74], [0.86, 0.55], [0.93, 0.4], [0.94, 0.36]].map(([r, y]) => new THREE.Vector2(r, y));
    const skirtT = skirtTexture(); skirtT.repeat.set(6, 1);
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProf, 64), new THREE.MeshStandardMaterial({ map: skirtT, roughness: 0.95, side: THREE.DoubleSide }));
    skirt.position.set(T.x, 0, T.z); scene.add(skirt);
    const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.014, 6, 64), gold); fringe.rotation.x = Math.PI / 2; fringe.position.set(T.x, 0.36, T.z); scene.add(fringe);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.4, 16), wood); leg.position.set(T.x, 0.2, T.z); scene.add(leg);

    // --- the crystal ball
    const ball = new THREE.Group(); ball.position.copy(POS.ball); scene.add(ball);
    const stand = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0], [0.14, 0], [0.15, 0.02], [0.1, 0.05], [0.06, 0.09], [0.1, 0.13], [0.13, 0.17], [0.11, 0.18], [0.0, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 28), gold);
    stand.position.y = -0.25; ball.add(stand);
    const R = 0.17;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color('#5a2aff') }, uB: { value: new THREE.Color('#ff3aa8') }, uE: { value: 0.4 } },
        transparent: true, depthWrite: false, side: THREE.FrontSide,
        vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uE;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
            float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
            float rim = 1.0 - ndv; rim = rim * rim * rim;
            vec3 q = vP * 9.0 + vec3(uTime * 0.35, uTime * 0.2, -uTime * 0.3);
            float f = n3(q) * 0.6 + n3(q * 2.1 + 7.0) * 0.3 + n3(q * 4.3) * 0.1;
            vec3 c = mix(uA, uB, smoothstep(0.25, 0.8, f)) * (0.35 + f * 0.9) * uE;
            float spec = clamp(dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.5))), 0.0, 1.0); spec = spec * spec * spec * spec * spec * spec;
            vec3 col = c * (0.6 + 0.8 * (1.0 - rim)) + vec3(0.7, 0.8, 1.0) * rim * 0.55 + vec3(1.0) * spec * 0.7;
            gl_FragColor = vec4(col, clamp(0.28 + rim * 0.55 + uE * 0.32 + spec * 0.4, 0.0, 0.92));
        }`,
    }));
    ball.add(shell);
    const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6a3aff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    ball.add(core);
    const ballLight = new THREE.PointLight(0x8a5aff, 0.4, 2.4, 2); ball.add(ballLight);
    const vis = [];
    for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
        sp.position.set((i - 1) * 0.105, i === 1 ? 0.01 : -0.01, 0); sp.scale.setScalar(0.001); sp.renderOrder = 3;
        ball.add(sp); vis.push(sp);
    }
    S.ball = { group: ball, shell, core, light: ballLight, vis, R };
    scene.add(ball);

    // --- candles, incense, a teacup
    const flameTex = soft(64, [[0, 'rgba(255,250,210,1)'], [0.25, 'rgba(255,200,90,0.9)'], [0.6, 'rgba(255,110,30,0.35)'], [1, 'rgba(255,80,20,0)']]);
    const glowTex = soft(64, [[0, 'rgba(255,200,120,0.5)'], [1, 'rgba(255,120,40,0)']]);
    S.flames = [];
    const addCandle = (x, y, z, h, withLight, parent = scene) => {
        const grp = new THREE.Group(); grp.position.set(x, y, z);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 14), gold); base.position.y = 0.01;
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.015, 14), gold); dish.position.y = 0.028;
        const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, h, 12), mat('#f2e8d0', { roughness: 0.5, emissive: new THREE.Color('#4a3010'), emissiveIntensity: 0.4 })); wax.position.y = 0.035 + h / 2;
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        flame.position.y = 0.035 + h + 0.035; flame.scale.set(0.05, 0.09, 1);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.y = flame.position.y; halo.scale.setScalar(0.35);
        grp.add(base, dish, wax, flame, halo);
        let light = null;
        if (withLight) { light = new THREE.PointLight(0xffa860, 0.9, 3.2, 2); light.position.y = flame.position.y + 0.04; grp.add(light); }
        parent.add(grp);
        S.flames.push({ flame, halo, light, seed: Math.random() * 10, base: new THREE.Color(0xffa860) });
    };
    addCandle(-0.46, POS.topY, -0.78, 0.2, true);
    addCandle(0.5, POS.topY, -0.7, 0.14, true);
    addCandle(0.02, POS.topY, -0.98, 0.1, false);
    addCandle(-W + 0.16, 1.45 + 0.02, -2.1, 0.12, false);
    addCandle(-W + 0.16, 0.95 + 0.02, -1.2, 0.09, false);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.05, 14), mat('#e8dcc0', { roughness: 0.3 })); cup.position.set(-0.6, POS.topY + 0.03, -0.45); scene.add(cup);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.01, 18), mat('#e8dcc0', { roughness: 0.3 })); saucer.position.set(-0.6, POS.topY + 0.006, -0.45); scene.add(saucer);
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.06, 12), gold); burner.position.set(0.62, POS.topY + 0.03, -0.42); scene.add(burner);
    S.incensePos = new THREE.Vector3(0.62, POS.topY + 0.07, -0.42);

    // --- the journal and the deck
    const jr = new THREE.Group(); jr.position.set(-0.57, POS.topY + 0.01, 0.02); jr.rotation.y = 0.35; scene.add(jr);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.22), mat('#7a1a3a', { roughness: 0.6 })); jr.add(cover);
    const pg = mat('#ffffff', { map: journalTexture(), roughness: 0.9 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.2), pg); p.position.set(s * 0.078, 0.012, 0); p.rotation.z = -s * 0.05; jr.add(p); }
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), pg); page.geometry.translate(0.075, 0, 0); page.position.set(0, 0.02, 0); page.rotation.x = -Math.PI / 2; jr.add(page);
    S.journal = { group: jr, page };
    const deck = new THREE.Group(); deck.position.copy(POS.deck); scene.add(deck);
    const backT = new THREE.CanvasTexture(cardBack()); backT.colorSpace = THREE.SRGBColorSpace; backT.anisotropy = 4;
    const stack = new THREE.Mesh(new THREE.BoxGeometry(CARD_SIZE.w, 0.05, CARD_SIZE.h), [mat('#e8c14a', { roughness: 0.5 }), mat('#e8c14a', { roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: backT, roughness: 0.5, emissive: 0x2a1060, emissiveMap: backT, emissiveIntensity: 0.5 }), mat('#e8c14a'), mat('#e8c14a'), mat('#e8c14a')]);
    stack.position.y = -0.0; deck.add(stack); deck.rotation.y = -0.25;
    S.deck = deck;

    // --- the cards that lie on the table
    const faceTex = new Map();
    const getFace = (id) => { if (!faceTex.has(id)) { const t = new THREE.CanvasTexture(cardFace(id)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; faceTex.set(id, t); } return faceTex.get(id); };
    S.cards = [0, 1, 2].map((i) => {
        const outer = new THREE.Group(), inner = new THREE.Group();
        const geo = new THREE.PlaneGeometry(CARD_SIZE.w, CARD_SIZE.h);
        const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.45, emissive: 0xffffff, emissiveIntensity: 0.28 }));
        const bk = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: backT, roughness: 0.45, emissive: 0xffffff, emissiveMap: backT, emissiveIntensity: 0.3 }));
        bk.rotation.y = Math.PI; front.position.z = 0.0006; bk.position.z = -0.0006;
        inner.add(front, bk); outer.add(inner); outer.visible = false;
        const aura = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
        aura.rotation.x = -Math.PI / 2; aura.position.copy(slotWorld(i)); aura.position.y -= 0.0015; scene.add(aura);
        scene.add(outer);
        return { outer, inner, front, aura, shown: false, anim: 0, flipped: false, slot: i, face: -1 };
    });
    S.setCardFace = (c, id) => { c.front.material.map = getFace(id); c.front.material.emissiveMap = getFace(id); c.front.material.needsUpdate = true; c.face = id; };

    // --- your hands: a sleeve, a cuff, a palm, four fingers and a thumb
    const skin = mat('#e8b894', { roughness: 0.55 });
    S.hands = [-1, 1].map((s) => {
        const g = new THREE.Group();
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.5, 14), mat('#5a2a9a', { roughness: 0.8 })); sleeve.rotation.x = Math.PI / 2 - 0.06; sleeve.position.set(0, 0.015, 0.25);
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 18), gold); cuff.rotation.x = -0.06; cuff.position.set(0, 0.002, 0.01);
        const palm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), skin); palm.scale.set(1.05, 0.5, 1.2); palm.position.set(0, 0, -0.03);
        g.add(sleeve, cuff, palm);
        const fingers = [];
        for (let k = 0; k < 4; k++) {
            const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.04, 4, 8), skin);
            f.rotation.x = Math.PI / 2; f.position.set((k - 1.5) * 0.016, 0, -0.085);
            g.add(f); fingers.push(f);
        }
        const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), skin); th.rotation.set(Math.PI / 2, 0, s * 0.9); th.position.set(-s * 0.042, 0, -0.035); g.add(th);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: 0x9a7aff })); glow.scale.setScalar(0.35); glow.position.set(0, 0.02, -0.07); g.add(glow);
        g.position.set(s * 0.32, 0.9, 0.35); scene.add(g);
        return { group: g, fingers, glow, s };
    });

    // --- lights
    S.hemi = new THREE.HemisphereLight(0x8a6ac0, 0x2a1030, 0.55); scene.add(S.hemi);
    S.sun = new THREE.DirectionalLight(0xff9a7a, 0.5); S.sun.position.set(1.5, 2.2, -3); scene.add(S.sun);
    S.rim = new THREE.PointLight(0x9a8aff, 1.4, 3.5, 2); S.rim.position.set(0, 1.9, -2.6); scene.add(S.rim);
    S.fill = new THREE.PointLight(0xffc9a0, 0.9, 4, 2); S.fill.position.set(0.3, 1.55, 0.5); scene.add(S.fill);
    S.lanterns = [[-0.85, 2.0, -1.0], [0.95, 2.0, 0.2]].map(([x, y, z]) => {
        const g = new THREE.Group(); g.position.set(x, y, z);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xffb860, emissive: 0xff8a2a, emissiveIntensity: 1.4, roughness: 0.4, transparent: true, opacity: 0.95 }));
        const capT = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 6), gold); capT.position.y = 0.15;
        const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.03, 6), gold); capB.position.y = -0.125;
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), gold); chain.position.y = 0.45;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(0.9);
        const L = new THREE.PointLight(0xffa850, 1.5, 5, 2);
        g.add(body, capT, capB, chain, halo, L); scene.add(g);
        return { g, light: L, halo };
    });

    // --- particles: sparks and smoke (additive), and a slow field of dust motes
    S.fx = new Particles(scene, 900, true);
    S.dust = new Particles(scene, 110, true);
    for (let i = 0; i < 110; i++) S.dust.emit({ x: (Math.random() - 0.5) * 3, y: 0.3 + Math.random() * 2, z: -2.8 + Math.random() * 4.5, vx: 0, vy: 0, vz: 0, life: 1e6, size: 0.012 + Math.random() * 0.012, alpha: 0.35, color: '#ffe9c0', drag: 0 });
    S.dust.base.forEach((v, i) => { if (i % 4 === 3) S.dust.base[i] = 0.18 + Math.random() * 0.3; });
    S.glyphTex = new Map();
    S.glyphTexture = (sym, colour) => { const k = sym + colour; if (!S.glyphTex.has(k)) { const t = new THREE.CanvasTexture(glyphCanvas(sym, colour, 192)); t.colorSpace = THREE.SRGBColorSpace; S.glyphTex.set(k, t); } return S.glyphTex.get(k); };
    S.cloudTexture = (colour) => { const k = 'cloud' + colour; if (!S.glyphTex.has(k)) { const t = new THREE.CanvasTexture(cloudCanvas(colour, 192)); t.colorSpace = THREE.SRGBColorSpace; S.glyphTex.set(k, t); } return S.glyphTex.get(k); };
    S.dims = { W, H1, HV, Z0, Z1 };
    return S;
}
