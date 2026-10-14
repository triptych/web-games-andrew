// The static stage for one episode: floor, walls with neon trim, glass,
// rails, crates, doors, water, palms and props, the getaway vehicle, and the
// world outside the map (sea or city). Built once per episode.
//
// Sim (x, y) maps to three.js (x, *, y): the map lies on the XZ plane with
// tile (0, 0) at the origin.

import * as THREE from 'three';
import { T } from '../sim/physics.js';
import { TIMES } from '../config.js';
import { paintFloor, crateTex, crackTex, neonText, screenTex, windowsTex, icon, tex, canvas } from './textures.js';
import { makePalm, makeProp, makeVehicle, makeBoat, makeHeli, makePickup } from './models.js';
import { hash01 } from '../rng.js';

export const WALL_H = { [T.WALL]: 0.9, [T.WALL2]: 1.05, [T.CRACK]: 0.9 };
const DOOR_COL = { 1: 0xff3fa4, 2: 0x2ff2e0, 3: 0xffe45c, 4: 0xb44cff };

// ------------------------------------------------------------------ water
export function waterMaterial(time) {
    const T0 = TIMES[time] ?? TIMES.night;
    return new THREE.ShaderMaterial({
        transparent: false,
        uniforms: {
            uTime: { value: 0 }, uNight: { value: T0.night },
            uDeep: { value: new THREE.Color(T0.night > 0.5 ? 0x061a2e : 0x0a3a5a) },
            uShallow: { value: new THREE.Color(T0.night > 0.5 ? 0x0a3a5a : 0x1a6a8a) },
            uPool: { value: new THREE.Color(0x1ab8cc) }, uSky: { value: new THREE.Color(T0.sky[0]) }, uFog: { value: new THREE.Color(T0.fog) },
        },
        vertexShader: `
            attribute float aPool; varying float vPool; varying vec3 vW;
            void main(){ vPool = aPool; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
            uniform float uTime, uNight; uniform vec3 uDeep, uShallow, uPool, uSky, uFog; varying float vPool; varying vec3 vW;
            float n(vec2 p){ return sin(p.x) * sin(p.y); }
            void main(){
                vec2 p = vW.xz;
                float w1 = n(p * 1.3 + vec2(uTime * 0.7, uTime * 0.4));
                float w2 = n(p * 2.9 - vec2(uTime * 0.5, -uTime * 0.9));
                float w = w1 * 0.6 + w2 * 0.4;
                vec3 col = mix(uDeep, uShallow, 0.5 + w * 0.25);
                col = mix(col, uPool * (1.0 + w * 0.25), vPool);
                // neon streaks: pink and cyan reflections in bands
                float s = smoothstep(0.9, 1.0, sin(p.x * 1.7 + w * 1.2 + uTime * 0.3) * sin(p.y * 4.3 + w1 * 1.5));
                col += s * mix(vec3(1.0, 0.25, 0.65), vec3(0.2, 0.95, 0.9), step(0.0, sin(p.x * 0.13 + p.y * 0.05))) * (0.035 + uNight * 0.07) * (1.0 - vPool * 0.6);
                col += (w * 0.5 + 0.5) * 0.04;
                // sky tint
                col = mix(col, uSky, 0.12 * (1.0 - vPool));
                // caustics in pools
                col += vPool * pow(abs(sin(p.x * 3.0 + w * 4.0 + uTime) * sin(p.y * 3.0 - w * 4.0 - uTime)), 6.0) * 0.35;
                // distance fade to fog
                float d = length(vW.xz - vec2(0.0));
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    });
}

// ------------------------------------------------------------------ helpers
class QuadBuf {
    constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.extra = []; }
    quad(a, b, c, d, nrm, col, uvs, ex = 0) {
        for (const v of [a, b, c, a, c, d]) this.p.push(v[0], v[1], v[2]);
        for (let k = 0; k < 6; k++) { this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col.r, col.g, col.b); this.extra.push(ex); }
        if (uvs) for (const u of [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]]) this.uv.push(u[0], u[1]);
    }
    geometry(extraName) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
        if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        if (extraName) g.setAttribute(extraName, new THREE.Float32BufferAttribute(this.extra, 1));
        return g;
    }
}

const isWallT = (t) => t === T.WALL || t === T.WALL2;

/** Connected components of WALL2 tiles (containers get one colour each). */
function components(S, type) {
    const id = new Int32Array(S.w * S.h).fill(-1);
    let n = 0;
    for (let i = 0; i < id.length; i++) {
        if (S.tiles[i] !== type || id[i] >= 0) continue;
        const q = [i]; id[i] = n;
        while (q.length) {
            const j = q.pop(), x = j % S.w, y = (j / S.w) | 0;
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + ox, ny = y + oy;
                if (nx < 0 || ny < 0 || nx >= S.w || ny >= S.h) continue;
                const k = ny * S.w + nx;
                if (S.tiles[k] === type && id[k] < 0) { id[k] = n; q.push(k); }
            }
        }
        n++;
    }
    return id;
}

// ------------------------------------------------------------------ build
export function buildBoard(L, S, def) {
    const group = new THREE.Group();
    const T0 = TIMES[def.time] ?? TIMES.night;
    const out = { group, breakables: new Map(), doors: {}, intel: [], tapes: [], switches: [], terms: [], targets: [], cams: [], lasers: [], palms: [], bumpers: [], blink: [], spin: [], getaway: null, water: null, floorMat: null, flutter: [], rotors: [], rain: null };

    // ---- floor
    const fl = paintFloor(L, def, S);
    const fq = new QuadBuf();
    const white = new THREE.Color(1, 1, 1);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const t = L.tilesInit[y * L.w + x];
        if (t === T.WATER || t === T.VOID) continue;
        const u0 = x / L.w, u1 = (x + 1) / L.w, v0 = 1 - y / L.h, v1 = 1 - (y + 1) / L.h;
        fq.quad([x, 0, y], [x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [0, 1, 0], white, [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]);
    }
    const floorMat = new THREE.MeshStandardMaterial({ map: fl.map, emissiveMap: fl.emissive, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.75, metalness: 0.05 });
    const floor = new THREE.Mesh(fq.geometry(), floorMat);
    floor.receiveShadow = true;
    group.add(floor);
    out.floorMat = floorMat;
    // edges of land drop down to the water: a little dock face
    const eq = new QuadBuf();
    const edgeCol = new THREE.Color(def.outside === 'sea' ? 0x5a4a3a : 0x2a2a30);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const t = L.tilesInit[y * L.w + x];
        if (t === T.WATER || t === T.VOID) continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            const nt = (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) ? T.VOID : L.tilesInit[ny * L.w + nx];
            if (nt !== T.WATER && !(nt === T.VOID && def.outside === 'sea')) continue;
            const ex = ox === 1 ? x + 1 : ox === -1 ? x : null, ez = oy === 1 ? y + 1 : oy === -1 ? y : null;
            if (ex !== null) eq.quad([ex, 0, y + (ox > 0 ? 1 : 0)], [ex, -0.6, y + (ox > 0 ? 1 : 0)], [ex, -0.6, y + (ox > 0 ? 0 : 1)], [ex, 0, y + (ox > 0 ? 0 : 1)], [ox, 0, 0], edgeCol);
            else eq.quad([x + (oy > 0 ? 0 : 1), 0, ez], [x + (oy > 0 ? 0 : 1), -0.6, ez], [x + (oy > 0 ? 1 : 0), -0.6, ez], [x + (oy > 0 ? 1 : 0), 0, ez], [0, 0, oy], edgeCol);
        }
    }
    if (eq.p.length) group.add(new THREE.Mesh(eq.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));

    // ---- walls (merged), with a neon trim along the top edge facing the room
    const wq = new QuadBuf(), tq = new QuadBuf();
    const comp = components(S, T.WALL2);
    const colA = new THREE.Color(def.walls?.a ?? 0xf3c9b4), colB = new THREE.Color(def.walls?.b ?? 0x6a5a8a);
    const ccols = (def.containerColors ?? []).map((c) => new THREE.Color(c));
    const tc = new THREE.Color(1, 1, 1);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const t = S.tiles[y * L.w + x];
        if (!isWallT(t)) continue;
        const H = WALL_H[t];
        let base = t === T.WALL ? colA : colB;
        if (t === T.WALL2 && ccols.length) base = ccols[comp[y * L.w + x] % ccols.length];
        const v = 0.92 + hash01(x * 31 + y * 17) * 0.1;
        const side = base.clone().multiplyScalar(v * 0.82), top = base.clone().multiplyScalar(Math.min(1.25, v * 1.12));
        wq.quad([x, H, y], [x, H, y + 1], [x + 1, H, y + 1], [x + 1, H, y], [0, 1, 0], top);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            const nt = (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) ? T.VOID : S.tiles[ny * L.w + nx];
            if (isWallT(nt) && WALL_H[nt] >= H) continue;
            // corrugation on containers: alternate shade per side strip
            const sc = side.clone();
            if (t === T.WALL2 && ccols.length) sc.multiplyScalar(0.9 + ((x + y) % 2) * 0.12);
            if (ox === 1) wq.quad([x + 1, H, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, H, y], [1, 0, 0], sc);
            if (ox === -1) wq.quad([x, H, y], [x, 0, y], [x, 0, y + 1], [x, H, y + 1], [-1, 0, 0], sc);
            if (oy === 1) wq.quad([x, H, y + 1], [x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, H, y + 1], [0, 0, 1], sc);
            if (oy === -1) wq.quad([x + 1, H, y], [x + 1, 0, y], [x, 0, y], [x, H, y], [0, 0, -1], sc);
            if (nt === T.VOID || nt === T.WATER) continue;
            // trim strip just under the top edge, slightly proud of the face
            const e = 0.012, th = 0.055;
            if (ox === 1) tq.quad([x + 1 + e, H, y + 1], [x + 1 + e, H - th, y + 1], [x + 1 + e, H - th, y], [x + 1 + e, H, y], [1, 0, 0], tc);
            if (ox === -1) tq.quad([x - e, H, y], [x - e, H - th, y], [x - e, H - th, y + 1], [x - e, H, y + 1], [-1, 0, 0], tc);
            if (oy === 1) tq.quad([x, H, y + 1 + e], [x, H - th, y + 1 + e], [x + 1, H - th, y + 1 + e], [x + 1, H, y + 1 + e], [0, 0, 1], tc);
            if (oy === -1) tq.quad([x + 1, H, y - e], [x + 1, H - th, y - e], [x, H - th, y - e], [x, H, y - e], [0, 0, -1], tc);
        }
    }
    const walls = new THREE.Mesh(wq.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    walls.castShadow = true; walls.receiveShadow = true;
    group.add(walls);
    if (tq.p.length) group.add(new THREE.Mesh(tq.geometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.trim ?? 0xff3fa4).multiplyScalar(2.2) })));

    // ---- breakables, rails, doors
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex(), roughness: 0.8 });
    const crackMat = new THREE.MeshStandardMaterial({ map: crackTex(def.walls?.a ?? 0xf3c9b4), roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ae8ff, transparent: true, opacity: 0.28, metalness: 0.9, roughness: 0.05, emissive: 0x2a6a8a, emissiveIntensity: 0.4, depthWrite: false });
    const glassEdge = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9af4ff).multiplyScalar(1.6) });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, metalness: 0.6, roughness: 0.3 });
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x, t = S.tiles[i];
        if (t === T.CRATE) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.8, 0.92), crateMat);
            m.position.set(x + 0.5, 0.4, y + 0.5); m.rotation.y = (hash01(i) - 0.5) * 0.2;
            m.castShadow = m.receiveShadow = true;
            group.add(m); out.breakables.set(i, m);
        } else if (t === T.CRACK) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_H[T.CRACK], 1), crackMat);
            m.position.set(x + 0.5, WALL_H[T.CRACK] / 2, y + 0.5);
            m.castShadow = m.receiveShadow = true;
            group.add(m); out.breakables.set(i, m);
        } else if (t === T.GLASS) {
            const horiz = isSolidLike(S, L, x - 1, y) || isSolidLike(S, L, x + 1, y);
            const g = new THREE.Group();
            const pane = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : 0.14, 0.85, horiz ? 0.14 : 1), glassMat);
            pane.position.y = 0.43;
            g.add(pane);
            const edge = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : 0.16, 0.04, horiz ? 0.16 : 1), glassEdge);
            edge.position.y = 0.87;
            g.add(edge);
            g.position.set(x + 0.5, 0, y + 0.5);
            group.add(g); out.breakables.set(i, g);
        } else if (t === T.RAIL) {
            const g = new THREE.Group();
            const horiz = !(L.tilesInit[(y - 1) * L.w + x] === T.RAIL || L.tilesInit[(y + 1) * L.w + x] === T.RAIL) || (L.tilesInit[y * L.w + x - 1] === T.RAIL || L.tilesInit[y * L.w + x + 1] === T.RAIL);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : 0.06, 0.06, horiz ? 0.06 : 1), railMat);
            bar.position.y = 0.5; g.add(bar);
            const bar2 = bar.clone(); bar2.position.y = 0.28; g.add(bar2);
            for (const s of [-0.5, 0]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), railMat);
                post.position.set(horiz ? s + 0.25 : 0, 0.27, horiz ? 0 : s + 0.25);
                g.add(post);
            }
            g.position.set(x + 0.5, 0, y + 0.5);
            g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            group.add(g);
        } else if (t === T.DOOR) {
            const gch = Object.keys(L.doors).find((k) => L.doors[k].includes(i));
            const col = DOOR_COL[gch] ?? 0xffffff;
            const g = new THREE.Group();
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.88, 0.98), new THREE.MeshStandardMaterial({ color: 0x2a2a34, metalness: 0.7, roughness: 0.35 }));
            m.position.y = 0.44; m.castShadow = true; g.add(m);
            for (const yy of [0.25, 0.6]) {
                const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2) }));
                s.position.y = yy; g.add(s);
            }
            g.position.set(x + 0.5, 0, y + 0.5);
            group.add(g);
            (out.doors[gch] ??= []).push({ g, t: 0 });
        }
    }

    // ---- hedges (instanced puffs)
    const hedgeTiles = [];
    for (let i = 0; i < L.hedgeAt.length; i++) if (L.hedgeAt[i]) hedgeTiles.push(i);
    if (hedgeTiles.length) {
        const per = 5;
        const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: 0x2f8a3a, roughness: 0.85, flatShading: true }), hedgeTiles.length * per);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        let n = 0;
        for (const i of hedgeTiles) {
            const x = i % L.w, y = (i / L.w) | 0;
            for (let k = 0; k < per; k++) {
                p.set(x + 0.2 + hash01(i * 7 + k) * 0.6, 0.25 + hash01(i + k * 3) * 0.18, y + 0.2 + hash01(i * 3 + k * 11) * 0.6);
                const sc = 0.8 + hash01(i * 5 + k) * 0.5;
                s.set(sc, sc * 0.85, sc);
                q.setFromEuler(new THREE.Euler(0, hash01(i + k) * 6, 0));
                m4.compose(p, q, s);
                im.setMatrixAt(n++, m4);
                im.setColorAt(n - 1, new THREE.Color().setHSL(0.33 + hash01(i * 13 + k) * 0.05, 0.55, 0.28 + hash01(i * 17 + k) * 0.1));
            }
        }
        im.castShadow = true; im.receiveShadow = true;
        group.add(im);
    }

    // ---- water: tiles inside the map, plus the sea around it
    const wtr = new QuadBuf();
    const enclosed = poolMask(L);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x;
        if (L.tilesInit[i] !== T.WATER) continue;
        if (def.outside === 'sea' && !enclosed[i]) continue;   // the sea plane covers it
        wtr.quad([x, -0.18, y], [x, -0.18, y + 1], [x + 1, -0.18, y + 1], [x + 1, -0.18, y], [0, 1, 0], white, null, enclosed[i] ? 1 : 0);
    }
    const wm = waterMaterial(def.time);
    out.water = wm;
    if (wtr.p.length) group.add(new THREE.Mesh(wtr.geometry('aPool'), wm));
    // pool walls (tiles round enclosed water)
    if (def.outside === 'sea') {
        const g = new THREE.PlaneGeometry(400, 400);
        g.rotateX(-Math.PI / 2);
        g.setAttribute('aPool', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
        const sea = new THREE.Mesh(g, wm);
        sea.position.set(L.w / 2, -0.22, L.h / 2);
        group.add(sea);
    } else buildStreet(group, L, def, out);

    // ---- holes
    for (const h of L.holes) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x040306 }));
        d.rotation.x = -Math.PI / 2; d.position.set(h.x, 0.012, h.y);
        group.add(d);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5a5a64, metalness: 0.8, roughness: 0.4 }));
        rim.rotation.x = Math.PI / 2; rim.position.set(h.x, 0.02, h.y);
        group.add(rim);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x3a3a44, metalness: 0.7, roughness: 0.5 }));
        lid.position.set(h.x + 0.62, 0.02, h.y + 0.1); lid.rotation.z = 0.05;
        group.add(lid);
    }

    // ---- static circles: palms, pillars, bumpers, terminals
    let bi = 0;
    for (const c of L.circles) {
        if (c.kind === 'palm') {
            const p = makePalm(Math.round(c.x * 13 + c.y * 7), 2.3 + hash01(c.x * 3 + c.y) * 0.6);
            p.position.set(c.x, 0, c.y);
            group.add(p);
            out.palms.push({ obj: p, x: c.x, y: c.y });
        } else if (c.kind === 'pillar') {
            const g = new THREE.Group();
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.4, 20), new THREE.MeshStandardMaterial({ color: 0xf4ece8, roughness: 0.3, metalness: 0.1 }));
            col.position.y = 0.7; col.castShadow = col.receiveShadow = true; g.add(col);
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.06, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.trim ?? 0xff3fa4).multiplyScalar(2) }));
            band.position.y = 1.1; g.add(band);
            g.position.set(c.x, 0, c.y);
            group.add(g);
        } else if (c.kind === 'bumper') {
            const colr = bi++ % 2 ? 0x2ff2e0 : 0xff3fa4;
            const g = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.32, 24), new THREE.MeshStandardMaterial({ color: 0x18101c, metalness: 0.6, roughness: 0.3 }));
            base.position.y = 0.16; base.castShadow = true; g.add(base);
            const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colr).multiplyScalar(1.6) });
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 8, 28), ringMat);
            ring.rotation.x = Math.PI / 2; ring.position.y = 0.33; g.add(ring);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: colr, emissiveIntensity: 1.2 }));
            cap.position.y = 0.36; g.add(cap);
            g.position.set(c.x, 0, c.y);
            group.add(g);
            out.bumpers.push({ x: c.x, y: c.y, ringMat, base: new THREE.Color(colr), flash: 0, cap });
        } else if (c.kind === 'term') {
            const tdef = L.terms[c.term];
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.42), new THREE.MeshStandardMaterial({ color: tdef.secure ? 0x2a1018 : 0x1a2028, metalness: 0.5, roughness: 0.4 }));
            body.position.y = 0.38; body.castShadow = true; g.add(body);
            const scrMat = new THREE.MeshBasicMaterial({ map: screenTex(tdef.secure ? ['SECURE', 'ACCESS', 'DENIED'] : ['> LOGIN', tdef.text?.toUpperCase().slice(0, 9) ?? 'TERMINAL', '_'], tdef.secure ? '#ff4a5a' : '#4dff8a', tdef.secure ? '#1a0408' : '#04140a') });
            const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.32), scrMat);
            scr.position.set(0, 0.62, 0.215); scr.rotation.x = -0.3; g.add(scr);
            const trim = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.04, 0.44), new THREE.MeshBasicMaterial({ color: tdef.secure ? 0xff3050 : 0x40ff90 }));
            trim.position.y = 0.76; g.add(trim);
            g.position.set(c.x, 0, c.y);
            group.add(g);
            out.terms[c.term] = { g, scrMat, trim, done: false };
        }
    }

    // ---- pickups, switches, targets
    for (const [list, kind, color] of [[L.intel, 'intel', 0xffe45c], [L.tapes, 'tape', 0xff3fa4]]) {
        for (const it of list) {
            const g = new THREE.Group();
            const p = makePickup(kind);
            p.position.y = 0.45;
            g.add(p);
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            beam.position.y = 1.1; g.add(beam);
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false }));
            ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
            g.position.set(it.x, 0, it.y);
            group.add(g);
            (kind === 'intel' ? out.intel : out.tapes).push({ g, p, got: false, t: 0 });
        }
    }
    for (const s of L.switches) {
        const g = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x30303a, metalness: 0.7, roughness: 0.3 }));
        plate.position.y = 0.03; g.add(plate);
        const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(DOOR_COL[s.opens] ?? 0xffe45c).multiplyScalar(1.8) });
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), lit);
        btn.position.y = 0.08; g.add(btn);
        g.position.set(s.x, 0, s.y);
        group.add(g);
        out.switches.push({ g, btn, lit, base: lit.color.clone(), done: false });
    }
    for (const t of L.targets) {
        const g = new THREE.Group();
        const color = t.kind === 'bug' ? 0xb44cff : t.kind === 'photo' ? 0xffe45c : 0xff2e3e;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; g.add(ring);
        if (t.kind === 'safe') {
            const sb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.85, roughness: 0.3 }));
            sb.position.y = 0.4; sb.castShadow = true; g.add(sb);
            const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.2 }));
            dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.45, 0.31); g.add(dial);
            g.userData.door = sb;
        } else if (t.kind !== 'car') {
            const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(t.kind === 'bug' ? 'B' : '◉'), color, depthWrite: false, transparent: true }));
            ic.scale.set(0.6, 0.6, 1); ic.position.y = 0.8; g.add(ic);
        }
        g.position.set(t.x, 0, t.y);
        group.add(g);
        out.targets.push({ g, ring, done: false, kind: t.kind });
    }

    // ---- security cameras and lasers
    for (const c of S.cams) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x404048 }));
        pole.position.y = 0.55; g.add(pole);
        const head = new THREE.Group(); head.position.y = 1.15; g.add(head);
        const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.42), new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.4, roughness: 0.4 }));
        bodyM.position.z = 0.12; head.add(bodyM);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x080810, metalness: 0.9, roughness: 0.1 }));
        lens.rotation.x = Math.PI / 2; lens.position.z = 0.35; head.add(lens);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
        led.position.set(0.08, 0.1, 0.25); head.add(led);
        g.position.set(c.x, 0, c.y);
        g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        group.add(g);
        out.cams.push({ g, head, led });
    }
    for (const l of S.lasers) {
        const g = new THREE.Group();
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy);
        const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2040).multiplyScalar(2.2), transparent: true, opacity: 0.9, depthWrite: false });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), beamMat);
        beam.rotation.z = Math.PI / 2;
        const holder = new THREE.Group();
        holder.position.set((l.x1 + l.x2) / 2, 0.35, (l.y1 + l.y2) / 2);
        holder.rotation.y = -Math.atan2(dy, dx);
        holder.add(beam);
        g.add(holder);
        for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x202028, metalness: 0.7 }));
            post.position.set(x, 0.3, y); g.add(post);
            const em = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), beamMat);
            em.position.set(x, 0.35, y); g.add(em);
        }
        group.add(g);
        out.lasers.push({ beamMat, beam });
    }

    // ---- signs
    for (const s of def.signs ?? []) {
        const nt = neonText(s.text, s.color, { font: '400 110px "Monoton", "Arial Black", sans-serif' });
        const hgt = 1.15 * (s.size ?? 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(hgt * nt.aspect, hgt), new THREE.MeshBasicMaterial({ map: nt.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        m.position.set(s.x, 1.2, s.y);
        m.rotation.order = 'YXZ';
        m.rotation.x = -0.7;
        m.renderOrder = 5;
        group.add(m);
        (out.signs ??= []).push(m);
        out.blink.push({ mat: m.material, sign: true, seed: s.x });
    }

    // ---- props
    for (const p of def.props ?? []) {
        const g = makeProp(p, def);
        g.position.set(p.x, 0, p.y);
        g.rotation.y = -((p.a ?? 0) * Math.PI) / 180;
        group.add(g);
        g.traverse((o) => {
            if (o.userData.blink) out.blink.push({ mat: o.material, seed: hash01(p.x * 7 + p.y) * 6 });
            if (o.userData.spin) out.spin.push(o);
            if (o.userData.flutter) out.flutter.push(o);
        });
    }

    // ---- getaway vehicle
    const ga = def.getaway;
    if (ga) {
        let v;
        if (ga.kind === 'speedboat') v = makeBoat(0xffffff, 1.3, true);
        else if (ga.kind === 'heli') v = makeHeli();
        else v = makeVehicle(ga.kind, ga.color ?? 0xff6fb0);
        v.position.set(ga.x, ga.kind === 'speedboat' ? -0.12 : 0, ga.y);
        v.rotation.y = Math.PI / 2 - ((ga.a ?? 0) * Math.PI) / 180;
        if (ga.kind === 'heli') v.rotation.y = Math.PI;
        v.traverse((o) => { if (o.userData.blink) out.blink.push({ mat: o.material, seed: 1 }); });
        group.add(v);
        out.getaway = v;
        if (v.userData.rotor) out.rotors.push(v.userData.rotor);
        // a glowing arrow so the player knows where home is
        const arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: neonText('▼', '#ff3fa4', { font: '900 90px Arial' }).tex, transparent: true, depthWrite: false, toneMapped: false }));
        arrow.scale.set(0.9, 0.9, 1);
        arrow.position.set(L.exits.reduce((a, e) => a + e.x, 0) / L.exits.length, 1.6, L.exits.reduce((a, e) => a + e.y, 0) / L.exits.length);
        group.add(arrow);
        out.exitArrow = arrow;
    }

    // ---- rain for the storm
    if (def.time === 'storm') {
        const n = 2400, pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const x = -6 + hash01(i) * (L.w + 12), z = -6 + hash01(i + 9999) * (L.h + 12), y = hash01(i + 5555) * 12;
            pos.set([x, y, z, x + 0.08, y + 0.5, z + 0.04], i * 6);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ab8e0, transparent: true, opacity: 0.4 }));
        rain.frustumCulled = false;
        group.add(rain);
        out.rain = rain;
    }
    return out;
}

function isSolidLike(S, L, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
    const t = S.tiles[y * L.w + x];
    return t === T.WALL || t === T.WALL2 || t === T.GLASS || t === T.CRACK || t === T.DOOR;
}

/** Water tiles that do not touch the map edge are pools (bright turquoise). */
function poolMask(L) {
    const out = new Uint8Array(L.w * L.h);
    const seen = new Uint8Array(L.w * L.h);
    const q = [];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        if (x !== 0 && y !== 0 && x !== L.w - 1 && y !== L.h - 1) continue;
        const i = y * L.w + x;
        if (L.tilesInit[i] === T.WATER) { seen[i] = 1; q.push(i); }
    }
    while (q.length) {
        const i = q.pop(), x = i % L.w, y = (i / L.w) | 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
            const j = ny * L.w + nx;
            if (!seen[j] && L.tilesInit[j] === T.WATER) { seen[j] = 1; q.push(j); }
        }
    }
    for (let i = 0; i < out.length; i++) out[i] = L.tilesInit[i] === T.WATER && !seen[i] ? 1 : 0;
    return out;
}

/** The city block round an indoor level: street, sidewalk, lamps, buildings. */
function buildStreet(group, L, def, out) {
    const c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#26242e'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${120 + hash01(k) * 60},${120 + hash01(k + 1) * 60},${130 + hash01(k + 2) * 60},${0.15 + hash01(k + 3) * 0.2})`; g.fillRect(hash01(k + 4) * 256, hash01(k + 5) * 256, 2, 2); }
    const t = tex(c, { repeat: true });
    t.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(L.w / 2, -0.02, L.h / 2);
    ground.receiveShadow = true;
    group.add(ground);
    // sidewalk ring
    const sw = new THREE.MeshStandardMaterial({ color: 0x8a8690, roughness: 0.9 });
    const pad = 2.2;
    for (const [x, z, w, d] of [[L.w / 2, -pad / 2, L.w + pad * 2, pad], [L.w / 2, L.h + pad / 2, L.w + pad * 2, pad], [-pad / 2, L.h / 2, pad, L.h], [L.w + pad / 2, L.h / 2, pad, L.h]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), sw);
        m.position.set(x, 0.0, z); m.receiveShadow = true;
        group.add(m);
    }
    // lane markings
    const lm = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
    for (let x = -14; x < L.w + 14; x += 3) {
        for (const z of [-pad - 3, L.h + pad + 3]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12), lm);
            m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0, z);
            group.add(m);
        }
    }
    // lamps, palms and parked cars along the sidewalk
    let k = 0;
    for (let x = 1; x < L.w; x += 6) {
        for (const [z, a] of [[-1.2, 0], [L.h + 1.2, Math.PI]]) {
            const lamp = makeProp({ p: 'lamp' }, def);
            lamp.position.set(x, 0, z); lamp.rotation.y = a;
            group.add(lamp);
            const palm = makePalm(x * 7 + z, 2.6);
            palm.position.set(x + 3, 0, z < 0 ? -1.4 : L.h + 1.4);
            group.add(palm);
            if (hash01(x * 3 + z) < 0.6) {
                const car = makeVehicle(hash01(x + z) < 0.15 ? 'police' : 'car', [0xff6fb0, 0x9ff0ff, 0xfff1a0, 0xffffff, 0xb44cff][k++ % 5]);
                car.position.set(x + 1.5, 0, z < 0 ? -pad - 1.4 : L.h + pad + 1.4);
                car.rotation.y = Math.PI / 2 * (z < 0 ? 1 : -1);
                group.add(car);
                car.traverse((o) => { if (o.userData.blink) out.blink.push({ mat: o.material, seed: x }); });
            }
        }
    }
    // buildings beyond the street
    const T0 = TIMES[def.time] ?? TIMES.night;
    const pastel = [0xf4b8c8, 0xa8e8e0, 0xf8e0a8, 0xc8b8f0, 0xf0f0f0, 0x98d0f0];
    for (let i = 0; i < 26; i++) {
        const side = i % 4;
        const along = hash01(i * 3) ;
        const h = 2 + hash01(i * 5) * 5;
        const w = 3 + hash01(i * 7) * 4;
        const x = side < 2 ? -10 + along * (L.w + 20) : side === 2 ? -pad - 9 : L.w + pad + 9;
        const z = side === 0 ? -pad - 9 : side === 1 ? L.h + pad + 10 : -6 + along * (L.h + 12);
        const wt = windowsTex(0.25 + T0.night * 0.5, i);
        wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(Math.round(w / 2), Math.round(h / 2));
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: pastel[i % pastel.length], roughness: 0.8, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.4 + T0.night * 0.8 }));
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        group.add(b);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.08, w + 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color([0xff3fa4, 0x2ff2e0, 0xffe45c, 0xb44cff][i % 4]).multiplyScalar(1.5) }));
        trim.position.set(x, h - 0.15, z);
        group.add(trim);
    }
}
