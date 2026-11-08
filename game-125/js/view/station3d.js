// The Ark Meridian's crew deck in first person. Walls are one merged mesh generated from js/sim/layout.js (the
// same rooms the sim walks you through), lit by a lamp per room and glowing strips along every wall. Through the
// Command Deck's window hangs Cradle, whose colours follow the Eden Index. Sleepers lie under pod glass.

import * as THREE from 'three';
import { ROOMS, DOORS, BOUNDS, TERMINALS, TERM_BY_ID, POD_ROWS, onFloor, roomAt } from '../sim/layout.js';
import { WALK } from '../config.js';
import { edenIndex } from '../sim/genetics.js';
import { Px } from './pixel.js';
import { pixelTex, skyDome } from './stage.js';
import { billboard, face, spriteTex } from './billboard.js';
import * as SP from './sprites.js';

const ROOM = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
const h2 = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

function tileCanvas(kind) {
    const P = new Px(32, 32);
    if (kind === 'floor') {
        P.mrect(0, 0, 32, 32).fill('#596173');
        P.mrect(1, 1, 30, 30).fill('#646d80');
        P.mrect(2, 2, 28, 1).mrect(2, 2, 1, 28).fill('#707a8e');
        P.mrect(0, 15, 32, 2).mrect(15, 0, 2, 32).fill('#4c5466');
        for (const [x, y] of [[4, 4], [27, 4], [4, 27], [27, 27]]) P.mp(x, y).fill('#9aa4b8');
    } else if (kind === 'wall') {
        P.mrect(0, 0, 32, 32).paint('#7a8496', { flat: true });
        P.mrect(2, 2, 28, 28).paint('#8a95a8', { soft: true, noline: true, tex: (x, y) => (h2(x, y, 9) < 0.05 ? -1 : 0) });
        P.mrect(0, 0, 32, 1).mrect(0, 31, 32, 1).fill('#5a6476');
        for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28]]) P.mp(x, y).fill('#c8d0e0');
    } else {
        P.mrect(0, 0, 32, 32).paint('#3a4252', { flat: true });
        P.mrect(0, 0, 32, 2).mrect(0, 0, 2, 32).fill('#2a3242');
        P.mrect(10, 10, 12, 12).fill('#4a5468');
    }
    return P.toCanvas();
}

function screenTex(lines, col = '#7affc8', bg = '#0a1420') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 80;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 80);
    g.fillStyle = col; g.font = 'bold 12px monospace';
    lines.forEach((l, i) => g.fillText(l, 6, 16 + i * 15));
    for (let y = 0; y < 80; y += 3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 128, 1); }
    return pixelTex(c);
}

/** Cradle: land and sea painted once; the shader colours the land between sick and healthy by the Eden Index. */
function planetMesh(r) {
    const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H);
    const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const a = h2(xi % 16, yi, s), b = h2((xi + 1) % 16, yi, s), cc = h2(xi % 16, yi + 1, s), d = h2((xi + 1) % 16, yi + 1, s); const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let n = 0, amp = 0.5, f = 1;
        for (let o = 0; o < 4; o++) { n += vn((x / W) * 4 * f, (y / H) * 4 * f, o * 7) * amp; amp *= 0.5; f *= 2; }
        const i = (y * W + x) * 4;
        img.data[i] = n > 0.5 ? 255 : 0; img.data[i + 1] = Math.round(n * 255); img.data[i + 2] = Math.round(vn(x / 9, y / 9, 31) * 255); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping;
    const U = { uMap: { value: tex }, uEden: { value: 0.3 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.7).normalize() } };
    const mat = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: 'varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
uniform sampler2D uMap; uniform float uEden, uTime; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN;
void main() {
    vec4 m = texture2D(uMap, vUv + vec2(uTime * 0.004, 0.0));
    float land = m.r, h = m.g, cl = m.b;
    vec3 sick = mix(vec3(0.55, 0.24, 0.1), vec3(0.42, 0.12, 0.34), h);
    vec3 well = mix(vec3(0.1, 0.5, 0.14), vec3(0.4, 0.6, 0.2), h);
    vec3 sea = mix(vec3(0.28, 0.2, 0.3), vec3(0.08, 0.28, 0.55), uEden);
    vec3 col = land > 0.5 ? mix(sick, well, uEden) : sea;
    col = mix(col, vec3(0.95), smoothstep(0.7, 0.88, cl) * 0.55);
    float l = clamp(dot(normalize(vN), uSun), 0.0, 1.0);
    col *= 0.03 + 0.95 * l;
    col += vec3(0.25, 0.45, 0.9) * pow(1.0 - clamp(abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 3.0) * 0.6 * (0.3 + l);
    gl_FragColor = vec4(col, 1.0);
}`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat);
    m.userData.U = U;
    return m;
}

export class StationView {
    constructor() {
        const S = this.scene = new THREE.Scene();
        S.background = new THREE.Color(0x02030a);
        S.fog = new THREE.Fog(0x0a0e18, 18, 60);
        this.stars = skyDome(0x02030a, 0x050818, { stars: 1.4 });
        S.add(this.stars);
        S.add(new THREE.HemisphereLight(0xb0c0e0, 0x30303a, 0.55));
        this.buildShell();
        this.buildProps();
        this.tilly = new THREE.Group();
        this.tillyMood = '';
        this.tillyLight = new THREE.PointLight(0xffd88a, 1.2, 5, 1.8);
        this.tilly.add(this.tillyLight);
        S.add(this.tilly);
        this.tillyPos = new THREE.Vector3(0.8, 1.7, 6);
        this.marker = billboard('marker', () => markerSprite(), { emissive: 1.2, shadow: 0 });
        S.add(this.marker);
    }

    buildShell() {
        const pos = [], nor = [], uv = [], col = [], spos = [], scol = [];
        const tint = new THREE.Color();
        const quad = (a, b, h, n, room) => {
            // a, b: [x, z] wall ends; n: [nx, nz] into the room
            const [ax, az] = a, [bx, bz] = b;
            const p = [[ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az]];
            for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); nor.push(n[0], 0, n[1]); }
            for (const i of [0, 1, 2, 0, 2, 3]) uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 && i !== 0 ? h : 0);
            tint.set(ROOM[room].tint).lerp(new THREE.Color(0xffffff), 0.82);
            for (let k = 0; k < 6; k++) col.push(tint.r, tint.g, tint.b);
            // the glow strip near the ceiling
            const o = 0.03, y0 = h - 0.32, y1 = h - 0.22;
            const s = [[ax + n[0] * o, y0, az + n[1] * o], [bx + n[0] * o, y0, bz + n[1] * o], [bx + n[0] * o, y1, bz + n[1] * o], [ax + n[0] * o, y1, az + n[1] * o]];
            tint.set(ROOM[room].tint);
            for (const i of [0, 1, 2, 0, 2, 3]) { spos.push(...s[i]); scol.push(tint.r, tint.g, tint.b); }
        };
        const win = (x, z, room) => room === 'command' && z < ROOM.command.z0 + 1 && Math.abs(x) < 8;
        for (let z = BOUNDS.z0; z < BOUNDS.z1; z++) for (let x = BOUNDS.x0; x < BOUNDS.x1; x++) {
            const cx = x + 0.5, cz = z + 0.5;
            if (!onFloor(cx, cz)) continue;
            const room = roomAt(cx, cz), h = Math.min(ROOM[room].h, ...DOORS.filter((d) => cx > d.x0 && cx < d.x1 && cz > d.z0 && cz < d.z1).map(() => 2.8));
            if (!onFloor(cx, cz - 1) && !win(cx, cz, room)) quad([x + 1, z], [x, z], h, [0, 1], room);
            if (!onFloor(cx, cz + 1)) quad([x, z + 1], [x + 1, z + 1], h, [0, -1], room);
            if (!onFloor(cx - 1, cz)) quad([x, z], [x, z + 1], h, [1, 0], room);
            if (!onFloor(cx + 1, cz)) quad([x + 1, z + 1], [x + 1, z], h, [-1, 0], room);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const wt = pixelTex(tileCanvas('wall'), true);
        this.scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: wt, vertexColors: true, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide })));
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
        sg.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3));
        const sm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
        sm.color.setScalar(2.2);
        this.scene.add(new THREE.Mesh(sg, sm));
        // lintels: close the wall above each doorway up to the taller room's ceiling
        for (const d of [...DOORS, { x0: -2, x1: 2, z0: 1.9, z1: 2.1, room: 'wake', low: 3.0 }]) {
            const top = 7, bot = d.low ?? 2.8;
            const m = new THREE.Mesh(new THREE.BoxGeometry(d.x1 - d.x0 + 0.02, top - bot, d.z1 - d.z0 + 0.02), new THREE.MeshStandardMaterial({ map: wt, color: 0xd0d8e8, roughness: 0.8 }));
            m.position.set((d.x0 + d.x1) / 2, (top + bot) / 2, (d.z0 + d.z1) / 2);
            this.scene.add(m);
        }
        // floors and ceilings per room and door
        const ft = pixelTex(tileCanvas('floor'), true), ct = pixelTex(tileCanvas('ceil'), true);
        for (const r of [...ROOMS, ...DOORS.map((d) => ({ ...d, h: 2.8, id: d.room }))]) {
            const w = r.x1 - r.x0, d = r.z1 - r.z0;
            const f = ft.clone(); f.repeat.set(w / 2, d / 2); f.needsUpdate = true;
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: f, roughness: 0.55, metalness: 0.3 }));
            floor.rotation.x = -Math.PI / 2; floor.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
            this.scene.add(floor);
            const c = ct.clone(); c.repeat.set(w / 2, d / 2); c.needsUpdate = true;
            const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: c, roughness: 0.9 }));
            ceil.rotation.x = Math.PI / 2; ceil.position.set((r.x0 + r.x1) / 2, r.h ?? ROOM[r.id].h, (r.z0 + r.z1) / 2);
            this.scene.add(ceil);
        }
        // a lamp per room (and two along the spine)
        for (const r of ROOMS) {
            const spots = r.id === 'spine' ? [-28, -12, 0] : [null];
            for (const zz of spots) {
                const L = new THREE.PointLight(r.tint, r.id === 'hangar' || r.id === 'command' ? 60 : 30, 26, 1.4);
                L.position.set((r.x0 + r.x1) / 2, r.h - 0.6, zz ?? (r.z0 + r.z1) / 2);
                this.scene.add(L);
            }
        }
    }

    buildProps() {
        const S = this.scene;
        const steel = new THREE.MeshStandardMaterial({ color: 0x8a94a8, roughness: 0.5, metalness: 0.5 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x5a6680, roughness: 0.6, metalness: 0.3 });
        const glow = (c, k = 2) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.color.multiplyScalar(k); return m; };
        const glass = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.2, depthWrite: false });
        const at = (m, x, y, z) => { m.position.set(x, y, z); S.add(m); return m; };

        // ---- Command Deck: the holo-table, the window and Cradle beyond it
        const T = TERM_BY_ID.command;
        at(new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r + 0.2, 0.95, 32), dark), T.x, 0.475, T.z);
        at(new THREE.Mesh(new THREE.CylinderGeometry(T.r - 0.15, T.r - 0.15, 0.04, 32), glow(0x4a8aff, 1.4)), T.x, 0.97, T.z);
        this.holo = planetMesh(0.6);
        this.holo.material = this.holo.material.clone();
        this.holo.userData.U = this.holo.material.uniforms;
        at(this.holo, T.x, 1.75, T.z);
        const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.015, 6, 64), glow(0x7affc8, 2)), T.x, 1.75, T.z);
        ring.rotation.x = Math.PI / 2.3;
        this.holoRing = ring;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.3, 0.4), steel);
        at(frame, 0, 0.15, -51); at(frame.clone(), 0, ROOM.command.h - 0.15, -51);
        for (const x of [-8, -4, 0, 4, 8]) at(new THREE.Mesh(new THREE.BoxGeometry(0.25, ROOM.command.h, 0.3), steel), x, ROOM.command.h / 2, -51);
        this.planet = planetMesh(60);
        at(this.planet, 14, -36, -230);
        const atmo = new THREE.Mesh(new THREE.SphereGeometry(63, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6ab0ff, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }));
        at(atmo, 14, -36, -230);
        this.atmo = atmo;
        for (const [x, z] of [[-8, -40], [8, -40]]) {
            at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 0.8), dark), x, 0.5, z);
            const sc = at(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: screenTex(['NAV', 'ORBIT 412 KM', 'SYNC OK']) })), x, 1.45, z + 0.2);
            sc.rotation.x = -0.35;
        }

        // ---- Hangar: the fabrication console, the drop cradle, crates, the bay door
        const H = TERM_BY_ID.hangar;
        at(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.8), dark), H.x, 0.55, H.z);
        this.fabScreen = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ map: screenTex(['FABRICATOR', 'READY'], '#ffb06a') })), H.x, 1.5, H.z + 0.42);
        this.fabScreen.rotation.x = -0.3;
        const Lc = TERM_BY_ID.launch;
        at(new THREE.Mesh(new THREE.CylinderGeometry(Lc.r, Lc.r + 0.3, 0.25, 32), steel), Lc.x, 0.125, Lc.z);
        const cr = at(new THREE.Mesh(new THREE.TorusGeometry(Lc.r + 0.1, 0.05, 6, 48), glow(0xff9a5a, 2.5)), Lc.x, 0.27, Lc.z);
        cr.rotation.x = Math.PI / 2;
        this.cradleRing = cr;
        this.beam = at(new THREE.Mesh(new THREE.CylinderGeometry(Lc.r - 0.2, Lc.r - 0.2, 5.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a5a, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })), Lc.x, 3, Lc.z);
        this.botGen = -1;
        this.botBoard = null;
        for (const [x, z, s] of [[18, -18, 1.3], [5, -30, 1.2], [18.4, -30.5, 1], [17.2, -19.6, 0.8]]) at(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: 0xa8743a, roughness: 0.8 })), x, s / 2, z);
        at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 10), new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.6, metalness: 0.5 })), 19.9, 2.5, -24);
        for (let i = 0; i < 8; i++) at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.2), i % 2 ? glow(0xffcc33, 1.2) : dark), 19.75, 0.25, -28.2 + i * 1.2);
        for (let i = 0; i < 4; i++) at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 9.6), glow(0xff9a5a, 1.6)), 19.75, 1.2 + i * 1.1, -24);

        // ---- Gene Lab: the splicer column, two vats
        const Lb = TERM_BY_ID.lab;
        at(new THREE.Mesh(new THREE.CylinderGeometry(Lb.r, Lb.r, 0.4, 32), dark), Lb.x, 0.2, Lb.z);
        at(new THREE.Mesh(new THREE.CylinderGeometry(Lb.r, Lb.r, 0.3, 32), dark), Lb.x, 3.0, Lb.z);
        this.liquid = at(new THREE.Mesh(new THREE.CylinderGeometry(Lb.r - 0.15, Lb.r - 0.15, 2.4, 32), glow(0x3aff8a, 0.9)), Lb.x, 1.6, Lb.z);
        this.liquid.material.transparent = true; this.liquid.material.opacity = 0.55;
        at(new THREE.Mesh(new THREE.CylinderGeometry(Lb.r, Lb.r, 2.6, 32, 1, true), glass), Lb.x, 1.6, Lb.z);
        const bub = new THREE.BufferGeometry(), bp = [];
        for (let i = 0; i < 60; i++) { const a = h2(i, 1) * 6.28, r = h2(i, 2) * (Lb.r - 0.3); bp.push(Lb.x + Math.cos(a) * r, 0.5 + h2(i, 3) * 2.2, Lb.z + Math.sin(a) * r); }
        bub.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
        this.bubbles = at(new THREE.Points(bub, new THREE.PointsMaterial({ color: 0xcfffe0, size: 0.06, toneMapped: false })), 0, 0, 0);
        this.vatGlows = [];
        for (const [x, z] of [[-14, -5], [-14, -11]]) {
            at(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 1.6, 24), dark), x, 0.8, z);
            this.vatGlows.push(at(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 24), glow(0x3aff8a, 1.2)), x, 1.62, z));
        }
        this.labScreen = at(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ map: screenTex(['GENOME LIBRARY', 'SPLICER ONLINE']) })), -10, 2.1, -12.9);

        // ---- Research Lab: the console and its holo-tree
        const R = TERM_BY_ID.research;
        at(new THREE.Mesh(new THREE.CylinderGeometry(R.r, R.r + 0.2, 1.0, 24), dark), R.x, 0.5, R.z);
        at(new THREE.Mesh(new THREE.CylinderGeometry(R.r - 0.1, R.r - 0.1, 0.04, 24), glow(0xffd06a, 1.6)), R.x, 1.02, R.z);
        this.treeNodes = [];
        for (let i = 0; i < 25; i++) {
            const br = i % 3, lv = Math.floor(i / 3);
            const n = at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), glow(0x5a5a6a, 1)), R.x + (br - 1) * 0.5, 1.3 + lv * 0.17, R.z);
            this.treeNodes.push(n);
        }
        for (const [x, z] of [[-5.5, -26], [-15, -18]]) at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), steel), x, 1.2, z);

        // ---- Stasis Hall: three rows of pods, Iris's at the head of the first, the archive at the end
        this.pods = [];
        const podGeo = new THREE.BoxGeometry(0.86, 0.7, 1.1), lidGeo = new THREE.BoxGeometry(0.7, 0.08, 0.95);
        POD_ROWS.forEach((row, ri) => {
            const zc = (row.z0 + row.z1) / 2;
            for (let k = 0; k < 9; k++) {
                const x = 6.5 + k, seed = ri * 9 + k;
                at(new THREE.Mesh(podGeo, steel), x, 0.35, zc);
                const lid = at(new THREE.Mesh(lidGeo, glow(0x6ad0ff, 0.9)), x, 0.79, zc);
                lid.material = lid.material.clone(); lid.material.transparent = true; lid.material.opacity = 0.3; lid.material.depthWrite = false;
                const iris = ri === 0 && k === 0;
                const T2 = spriteTex(iris ? 'iris' : 'sleeper' + (seed % 9), () => SP.sleeper(iris ? 31207 : seed * 13 + 1, iris));
                const face2 = at(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: T2.tex, alphaTest: 0.5 })), x, 0.705, zc - 0.25);
                face2.rotation.x = -Math.PI / 2;
                this.pods.push({ lid, seed });
            }
        });
        const plate = at(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshBasicMaterial({ map: screenTex(['  IRIS  31,207', ''], '#ffd0e0', '#2a1020') })), 5.95, 0.55, -11.6);
        plate.rotation.y = -Math.PI / 2;
        const A = TERM_BY_ID.archive;
        at(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 1.6), dark), A.x + 0.6, 1.1, A.z);
        const as = at(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshBasicMaterial({ map: screenTex(['ARCHIVE', 'LOGS', 'ECHOES'], '#6ad0ff') })), A.x + 0.18, 1.5, A.z);
        as.rotation.y = -Math.PI / 2;

        // ---- Wake Bay: your pod, open
        const P = TERM_BY_ID.pod;
        at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.0), steel), P.x, 0.4, P.z + 0.3);
        const lid = at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.8), glass), P.x, 1.4, P.z + 0.9);
        lid.rotation.x = -1.0;
        for (const x of [-4, 4]) { at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.0), steel), x, 0.4, 9.6); at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.8), glow(0x6ad0ff, 0.8)), x, 0.84, 9.6); }
    }

    /** Called every frame. cam is already placed. */
    update(G, dt, time, cam, goalTerm) {
        const eden = edenIndex(G) / 100;
        for (const p of [this.planet, this.holo]) { const U = p.userData.U; U.uEden.value += (eden - U.uEden.value) * Math.min(1, dt * 2); U.uTime.value = time; }
        this.atmo.material.color.setHSL(0.58 - 0.25 * (1 - eden), 0.7, 0.6);
        this.holo.rotation.y = time * 0.25;
        this.holoRing.rotation.z = time * 0.4;
        this.stars.userData.U.uTime.value = time;
        this.stars.position.copy(cam.position);
        // the bot on the cradle
        const showBot = G.mode === 'station';
        if (this.botGen !== G.bot.gen) {
            if (this.botBoard) this.scene.remove(this.botBoard);
            this.botGen = G.bot.gen;
            this.botBoard = billboard('bot' + G.bot.gen, () => SP.bot(G.bot.gen), { emissive: 0.15 });
            const Lc = TERM_BY_ID.launch;
            this.botBoard.position.set(Lc.x, 0.25, Lc.z);
            this.scene.add(this.botBoard);
        }
        this.botBoard.visible = showBot;
        this.botBoard.userData.sprite.position.y = G.bot.busy > 0 ? 0 : Math.sin(time * 2) * 0.03;
        face(this.botBoard, cam);
        this.beam.material.opacity = G.bot.busy > 0 ? 0.2 + Math.sin(time * 8) * 0.08 : 0.05;
        this.cradleRing.material.color.setRGB(2.5, G.bot.busy > 0 ? 0.6 : 1.5, 0.6);
        // lab and research
        this.bubbles.position.y = (time * 0.4) % 0.5;
        this.liquid.material.color.setRGB(0.3, 1.1 + (G.vats.length ? Math.sin(time * 4) * 0.4 : 0), 0.6);
        this.vatGlows.forEach((v, i) => { v.visible = G.vats.length > i + 1 || (i === 0 && G.strains.length > 0); });
        const done = Object.keys(G.research.done).length, act = G.research.active.length;
        this.treeNodes.forEach((n, i) => {
            const on = i < done, busy = i >= done && i < done + act;
            n.material.color.setRGB(on ? 2.2 : busy ? 1.4 + Math.sin(time * 6) * 0.6 : 0.3, on ? 1.8 : busy ? 1.0 : 0.3, on ? 0.6 : 0.35);
            n.rotation.y = time + i;
        });
        // the pods dream harder as Reveille nears
        const drift = Math.max(0, (G.day - 90) / 275);
        this.pods.forEach((p, i) => { p.lid.material.opacity = 0.28 + Math.sin(time * (1 + drift * 3) + i) * 0.04 * (1 + drift * 4); });
        // TILLY floats beside you, or in front of you while she talks
        const fx = Math.sin(G.me.yaw), fz = -Math.cos(G.me.yaw);
        const talking = !!G.talk;
        const tx = G.me.x + fx * (talking ? 1.5 : 1.3) + (talking ? 0 : -fz * 0.85), tz = G.me.z + fz * (talking ? 1.5 : 1.3) + (talking ? 0 : fx * 0.85);
        this.tillyPos.lerp(new THREE.Vector3(tx, WALK.eye - (talking ? 0.05 : 0.35) + Math.sin(time * 1.7) * 0.05, tz), Math.min(1, dt * 3));
        const mood = this.wantMood || 'happy';
        if (mood !== this.tillyMood) {
            if (this.tillyBoard) this.tilly.remove(this.tillyBoard);
            this.tillyMood = mood;
            this.tillyBoard = billboard('tilly-' + mood, () => SP.tilly(mood), { emissive: 0.22, shadow: 0, scale: 0.55 });
            this.tilly.add(this.tillyBoard);
        }
        this.tilly.position.copy(this.tillyPos);
        this.tilly.visible = G.mode === 'station';
        face(this.tillyBoard, cam);
        // a waypoint over the goal
        const t = goalTerm && TERM_BY_ID[goalTerm];
        this.marker.visible = !!t && G.mode === 'station' && !G.talk;
        if (t) {
            const hh = { command: 2.9, launch: 3.2, hangar: 2.3, lab: 3.6, research: 2.6, archive: 2.6, iris: 1.4, pod: 2 }[t.id] || 2.5;
            this.marker.position.set(t.x, hh + Math.sin(time * 3) * 0.12, t.z);
            face(this.marker, cam);
        }
    }
}

function markerSprite() {
    const P = new Px(16, 16);
    P.mpoly([[2, 3], [14, 3], [8, 13]]).paint('#ffd76a', { hi: 1.4 });
    return { px: P.outline('#3a2a10', 0.7), h: 0.45 };
}
