// The Heartfire: the lava chamber at the end of the line. A vast hollow in the
// mountain with a lake of lava, a spatter cone in the middle throwing up a
// fountain, falls of lava down the walls, organ-pipe basalt around the shore,
// natural arches, stalactites, and high above a shaft of daylight (or night)
// that the weather can reach. The track breaks out of the wall onto a cliff of
// rock, with a rail around its edge and the cart at its end.

import * as THREE from 'three';
import { frameAt, WALL_S, END_S } from './minepath.js';
import { rockGeometry, spikeGeometry, fbm3, noise3 } from './minegeo.js';
import { lavaMaterial, Spray, ribbonGeometry } from './mine-fx.js';
import { boxUV } from './mine-parts.js';
import { smoothstep, clamp, lerp, TAU } from './util.js';

const R_LEDGE = 90;      // radius of the chamber at the height of the cliff
const DROP = 64;         // from the cliff down to the lava
const TOP = 292;         // from the lava up to the top of the shaft

/** The chamber's inner radius at angle th and height h above the lava, before noise. */
function baseRadius(h) {
    if (h < 0) {
        const u = clamp(-h / 34, 0, 1);
        return 5 + 74 * Math.sqrt(1 - u * u);
    }
    if (h < 108) {
        const u = h / 108;
        return 77 + 15 * Math.sin(u * Math.PI * 0.95) + 4 * u;
    }
    if (h < 166) {
        const v = (h - 108) / 58;
        return 17 + 62 * Math.sqrt(Math.max(0, 1 - v * v));
    }
    if (h < TOP - 14) return 17 + 1.5 * Math.sin(h * 0.05);
    const w = (TOP - h) / 14;
    return 1 + 16 * Math.sqrt(clamp(1 - (1 - w) * (1 - w), 0, 1));
}

export function buildChamber(mine, r) {
    const q = mine.quality.tier;
    // where it stands: round the end of the line, with the cliff at the wall
    const wall = mine.at(WALL_S, 0, 0);
    const fr = {};
    frameAt(WALL_S, fr);
    const dir = new THREE.Vector3(fr.t.x, 0, fr.t.z).normalize();
    const ledgeY = wall.y - 0.45;
    const lavaY = ledgeY - DROP;
    const C = new THREE.Vector3(wall.x + dir.x * R_LEDGE, lavaY, wall.z + dir.z * R_LEDGE);
    const ch = { C, lavaY, ledgeY, topY: lavaY + TOP, dir };

    const wallR = (th, y) => {
        const h = y - lavaY;
        const R = baseRadius(h);
        const px = C.x + Math.cos(th) * R, pz = C.z + Math.sin(th) * R;
        let d = 7 * fbm3(px * 0.03, y * 0.03, pz * 0.03, 3) + 3.2 * fbm3(px * 0.09 + 5, y * 0.09, pz * 0.09, 2) + 1.1 * noise3(px * 0.3, y * 0.3, pz * 0.3);
        // fluted walls near the lava: the lines of columnar jointing
        const flute = Math.pow(Math.abs(Math.sin(th * 34 + fbm3(px * 0.05, y * 0.05, pz * 0.05, 2) * 3)), 0.5) - 0.62;
        d += flute * 2.6 * smoothstep(70, 20, h) * smoothstep(-10, 6, h);
        // a few great ribs and shelves in the walls
        d += 5 * Math.pow(Math.abs(Math.sin(th * 5 + y * 0.012)), 3) * smoothstep(0, 40, h) * smoothstep(150, 90, h);
        d += 3.5 * smoothstep(0.6, 1, Math.sin(h * 0.19 + fbm3(px * 0.04, 0, pz * 0.04, 2) * 4)) * smoothstep(8, 40, h) * smoothstep(120, 80, h);
        // the shaft stays round
        return R + d * smoothstep(176, 110, h) * (h < 0 ? 0.5 : 1) * (R > 30 ? 1 : 0.35);
    };
    ch.wallR = wallR;

    // ---- the cavern shell
    const mat = mine.rockMaterial({ cut: true });
    mine.chamberMat = mat;
    const segs = q === 'high' ? 220 : q === 'medium' ? 168 : 120;
    const y0 = lavaY - 34;
    const rows = q === 'high' ? 150 : q === 'medium' ? 120 : 90;
    const ys = [];
    // rows are closer together through the walls, where you look, and sparser up the shaft
    for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        ys[i] = y0 + (TOP + 34) * (t < 0.62 ? (t / 0.62) * 0.42 : 0.42 + ((t - 0.62) / 0.38) * 0.58);
    }
    ys[rows] = lavaY + TOP;
    const pos = new Float32Array((rows + 1) * segs * 3);
    for (let i = 0; i <= rows; i++) {
        for (let j = 0; j < segs; j++) {
            const th = (j / segs) * TAU;
            const R = wallR(th, ys[i]);
            const k = i * segs + j;
            pos[k * 3] = C.x + Math.cos(th) * R; pos[k * 3 + 1] = ys[i]; pos[k * 3 + 2] = C.z + Math.sin(th) * R;
        }
    }
    const idx = new Uint32Array(rows * segs * 6);
    let n = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < segs; j++) {
            const j1 = (j + 1) % segs;
            const a = i * segs + j, b = i * segs + j1, c = (i + 1) * segs + j, d = (i + 1) * segs + j1;
            idx[n++] = a; idx[n++] = b; idx[n++] = c;
            idx[n++] = b; idx[n++] = d; idx[n++] = c;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    // ---- lava falls down the walls (built before the rock is painted, so their glow lands on it)
    ch.falls = [];
    const fallDefs = [[0.5, 100, 7], [1.7, 88, 5], [2.55, 105, 9], [3.5, 94, 6], [4.4, 98, 5], [5.5, 90, 7]];
    for (const [th, top, w] of fallDefs) {
        const pts = [], sides = [];
        for (let y = lavaY + top; y > lavaY - 1; y -= 2) {
            const R = wallR(th, y) - 0.9;
            pts.push(new THREE.Vector3(C.x + Math.cos(th) * R, y, C.z + Math.sin(th) * R));
            sides.push(new THREE.Vector3(-Math.sin(th), 0, Math.cos(th)));
        }
        const widths = pts.map((_, i) => w * (0.5 + 0.7 * (i / pts.length)));
        const f = mine.lava(pts, sides, widths, { flow: [0, -1], scale: [2, 4], speed: 0.2, bright: 2.3, edge: 0.7, vScale: 7, glow: 0.5, radius: 36, lights: 2, lightEvery: 40, intensity: 1200, dist: 110, lift: 0 });
        ch.falls.push(f);
    }
    // the lake's glow on the walls, and the fountain's
    for (let a = 0; a < 16; a++) {
        const th = (a / 16) * TAU;
        for (const h of [2, 14, 32]) {
            const R = wallR(th, lavaY + h) - 2;
            mine.glow.add(C.x + Math.cos(th) * R, lavaY + h, C.z + Math.sin(th) * R, 0.9 / (1 + h * 0.04), 0.24 / (1 + h * 0.04), 0.04, 44);
        }
    }
    mine.glow.add(C.x, lavaY + 22, C.z, 0.9, 0.3, 0.06, 130);
    mine.glow.add(C.x, lavaY + 40, C.z, 0.5, 0.18, 0.04, 140);

    // paint the shell
    const colAttr = new Float32Array((rows + 1) * segs * 3), glowAttr = new Float32Array((rows + 1) * segs * 3), veinAttr = new Float32Array((rows + 1) * segs * 4);
    const nrm = geo.attributes.normal.array;
    const v = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, gr: 0, gg: 0, gb: 0 };
    for (let k = 0; k < (rows + 1) * segs; k++) {
        v.x = pos[k * 3]; v.y = pos[k * 3 + 1]; v.z = pos[k * 3 + 2];
        v.nx = nrm[k * 3]; v.ny = nrm[k * 3 + 1]; v.nz = nrm[k * 3 + 2];
        v.gr = v.gg = v.gb = 0;
        mine.glow.sample(v);
        const h = v.y - lavaY;
        const nz = fbm3(v.x * 0.05, v.y * 0.05, v.z * 0.05, 3);
        const m = 0.8 + 0.5 * nz;
        // basalt: black-brown, redder low down where the heat has cooked it
        const heat = Math.exp(-Math.max(0, h) / 30);
        colAttr[k * 3] = (0.2 + 0.12 * heat) * m; colAttr[k * 3 + 1] = (0.16 + 0.04 * heat) * m; colAttr[k * 3 + 2] = (0.15 - 0.02 * heat) * m;
        glowAttr[k * 3] = v.gr + 0.5 * heat; glowAttr[k * 3 + 1] = v.gg + 0.12 * heat; glowAttr[k * 3 + 2] = v.gb + 0.02 * heat;
        // fissures that glow through the walls
        veinAttr[k * 4] = 1.0; veinAttr[k * 4 + 1] = 0.2; veinAttr[k * 4 + 2] = 0.03; veinAttr[k * 4 + 3] = 0.1 + 0.2 * heat;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glowAttr, 3));
    geo.setAttribute('aVein', new THREE.BufferAttribute(veinAttr, 4));
    geo.computeBoundingSphere();
    const shell = new THREE.Mesh(geo, mat);
    shell.frustumCulled = false;
    mine.root.add(shell);
    // the hole the tunnel comes through
    mat.userData.uniforms.uCutP.value.copy(wall);
    mat.userData.uniforms.uCutD.value.set(fr.t.x, fr.t.y, fr.t.z);
    mat.userData.uniforms.uCutR.value = 5.1;

    // ---- the lake, the cone and the fountain
    const lake = new THREE.Mesh(new THREE.CircleGeometry(98, 96).rotateX(-Math.PI / 2), (() => { const m = lavaMaterial({ flow: [0.3, 1], scale: [16, 16], speed: 0.035, bright: 2.1, edge: 0 }); mine.lavaMats.push(m); return m; })());
    lake.position.set(C.x, lavaY, C.z);
    mine.root.add(lake);
    // crust plates and lumps floating on it: dark rafts of cooled rock
    const raft = rockGeometry(3, { detail: 1, rough: 0.5, stretch: [1, 0.12, 1] });
    const rafts = new THREE.InstancedMesh(withRockAttrs(raft, 0.05), mat, 26);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 26; i++) {
        const a = r() * TAU, d = 24 + r() * 58, sc = 2 + r() * 6;
        m4.compose(new THREE.Vector3(C.x + Math.cos(a) * d, lavaY + 0.05, C.z + Math.sin(a) * d), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(sc, sc, sc));
        rafts.setMatrixAt(i, m4);
    }
    rafts.frustumCulled = false;
    mine.root.add(rafts);

    const cone = coneGeometry(lavaY);
    const coneMesh = new THREE.Mesh(cone, mat);
    coneMesh.position.set(C.x, 0, C.z);
    mine.root.add(coneMesh);
    const vent = new THREE.Vector3(C.x, lavaY + 12.6, C.z);
    ch.vent = vent;
    const crater = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24).rotateX(-Math.PI / 2), (() => { const m = lavaMaterial({ flow: [0, 1], scale: [2, 2], speed: 0.25, bright: 3.2 }); mine.lavaMats.push(m); return m; })());
    crater.position.copy(vent).add(new THREE.Vector3(0, -0.3, 0));
    mine.root.add(crater);

    // the fountain: streaks of lava on ballistic arcs, a glowing column, a crown of spray
    ch.spray = new Spray({ count: q === 'high' ? 520 : q === 'medium' ? 380 : 240, origin: vent, up: [30, 58], out: 10, gravity: 14, life: [4.2, 7.5], size: [1.4, 3.2], spread: 2.4, streak: 0.05, seed: 'fountain' });
    mine.root.add(ch.spray.mesh);
    mine.updaters.push((dt, t) => {
        ch.spray.update(t);
        ch.spray.U.uAmt.value = 0.72 + 0.28 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 2);
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.6, 30, 18, 1, true).translate(0, 15, 0), fountainColumn(mine));
    col.position.copy(vent);
    mine.root.add(col);
    // a splash crown low down
    ch.splash = new Spray({ count: 160, origin: vent.clone().add(new THREE.Vector3(0, 1, 0)), up: [8, 17], out: 14, gravity: 14, life: [1.6, 3], size: [0.7, 1.5], spread: 4, streak: 0.06, seed: 'splash' });
    mine.root.add(ch.splash.mesh);
    mine.updaters.push((dt, t) => ch.splash.update(t));
    // light from the fountain: a big one, and the lake
    mine.pool.add({ x: vent.x, y: vent.y + 18, z: vent.z, color: new THREE.Color(0xff7a22), intensity: 9000, dist: 260, flicker: 0.18 });
    mine.pool.add({ x: vent.x, y: lavaY + 6, z: vent.z + 30, color: new THREE.Color(0xff4a10), intensity: 3000, dist: 200, flicker: 0.25 });
    mine.pool.add({ x: vent.x + 40, y: lavaY + 6, z: vent.z - 20, color: new THREE.Color(0xff4a10), intensity: 3000, dist: 200, flicker: 0.25 });

    // ---- organ-pipe basalt round the shore
    const prism = new THREE.CylinderGeometry(1, 1.05, 1, 6, 1).translate(0, 0.5, 0);
    {
        // heat in the lower metres: glow fades up the column
        const p = prism.attributes.position;
        const gl = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); const f = Math.max(0, 1 - y * 1.1); gl.set([0.9 * f, 0.2 * f, 0.03 * f], i * 3); }
        prism.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.count * 3).fill(0.12), 3));
        prism.setAttribute('aGlow', new THREE.BufferAttribute(gl, 3));
        prism.setAttribute('aVein', new THREE.BufferAttribute(new Float32Array(p.count * 4), 4));
    }
    const cols = q === 'low' ? 120 : 260;
    const pipes = new THREE.InstancedMesh(prism, mat, cols);
    for (let i = 0; i < cols; i++) {
        const th = (i / cols) * TAU + (r() - 0.5) * 0.02;
        // leave the doorway clear: the cliff and the tunnel mouth are at the angle of the line
        const a0 = Math.atan2(wall.z - C.z, wall.x - C.x);
        const da = Math.abs(((th - a0 + Math.PI) % TAU + TAU) % TAU - Math.PI);
        if (da < 0.22) continue;
        const hh = 7 + r() * 32 * (0.4 + 0.6 * Math.abs(Math.sin(th * 3.7)));
        const rad = 1.5 + r() * 1.5;
        const R = wallR(th, lavaY + 4) - rad * 0.6;
        m4.compose(new THREE.Vector3(C.x + Math.cos(th) * R, lavaY - 6, C.z + Math.sin(th) * R), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.06, r() * 3, (r() - 0.5) * 0.06)), new THREE.Vector3(rad, hh + 6, rad));
        pipes.setMatrixAt(i, m4);
    }
    pipes.frustumCulled = false;
    mine.root.add(pipes);

    // ---- stalactites on the shoulders of the dome
    {
        const sg = spikeGeometry(7);
        const sc = sg.attributes.position.count;
        sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sc * 3).fill(0.1), 3));
        sg.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(sc * 3), 3));
        sg.setAttribute('aVein', new THREE.BufferAttribute(new Float32Array(sc * 4), 4));
        const count = q === 'low' ? 60 : 130;
        const spikes = new THREE.InstancedMesh(sg, mat, count);
        let k = 0;
        for (let tries = 0; tries < count * 8 && k < count; tries++) {
            const th = r() * TAU, y = lavaY + 108 + r() * 50;
            const R = wallR(th, y);
            if (R < 30) continue;
            const L = 5 + r() * 24, G = 1 + r() * 3;
            m4.compose(new THREE.Vector3(C.x + Math.cos(th) * (R - 0.6), y, C.z + Math.sin(th) * (R - 0.6)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(G, L, G));
            spikes.setMatrixAt(k++, m4);
        }
        spikes.count = k;
        spikes.frustumCulled = false;
        mine.root.add(spikes);
    }

    // ---- two natural arches across the cavern
    for (const [th, rad, height, tube] of [[1.1, 34, 62, 5.5], [3.9, 26, 118, 4.5]]) {
        const g = new THREE.TorusGeometry(rad, tube, 14, 44, Math.PI);
        const p = g.attributes.position, vv = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            vv.fromBufferAttribute(p, i);
            const d = 1 + 0.28 * fbm3(vv.x * 0.1, vv.y * 0.1, vv.z * 0.1, 3) + 0.1 * noise3(vv.x * 0.4, vv.y * 0.4, vv.z * 0.4);
            vv.x *= d; vv.z *= d * 1.5; vv.y *= d;
            p.setXYZ(i, vv.x, vv.y, vv.z);
        }
        g.computeVertexNormals();
        const arch = new THREE.Mesh(withRockAttrs(g, 0.14), mat);
        arch.position.set(C.x + Math.cos(th) * 4, lavaY + height - rad * 0.4, C.z + Math.sin(th) * 4);
        arch.rotation.set(0, -th + Math.PI / 2 + 0.2, 0);
        arch.frustumCulled = false;
        mine.root.add(arch);
    }

    // ---- the shaft up to the sky
    ch.vent2 = ventLight(mine, ch);

    // ---- the cliff
    cliff(mine, ch, mat, r);
    return ch;
}

/** Give a plain geometry the attributes the rock material reads. */
function withRockAttrs(g, albedo = 0.12) {
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(albedo), 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aVein', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    return g;
}

/** The little volcano in the middle of the lake: a cone of spatter with a glowing lip. */
function coneGeometry(lavaY) {
    const prof = [[0, -4], [17, -4], [15, 1], [12.5, 4], [9, 8], [6, 11], [4.6, 12.7], [3.6, 13], [3.3, 12.3], [0, 12]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y + lavaY)), 40);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), glow = new Float32Array(p.count * 3), vein = new Float32Array(p.count * 4);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const h = v.y - lavaY;
        const n = fbm3(v.x * 0.4, v.y * 0.4, v.z * 0.4, 3) + 0.4 * noise3(v.x * 1.4, v.y * 1.4, v.z * 1.4);
        const rr = Math.hypot(v.x, v.z) || 1;
        const k = 1 + n * 0.22;
        v.x *= k; v.z *= k; v.y += n * 0.6;
        p.setXYZ(i, v.x, v.y, v.z);
        col.set([0.06, 0.05, 0.05], i * 3);
        const hot = smoothstep(7, 12.5, h);
        glow.set([1.0 * hot + 0.3, 0.26 * hot + 0.06, 0.04 * hot], i * 3);
        vein.set([1, 0.22, 0.03, 1.2], i * 4);
        void rr;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 3));
    g.setAttribute('aVein', new THREE.BufferAttribute(vein, 4));
    g.computeVertexNormals();
    return g;
}

/** A column of white-hot lava in the heart of the fountain. */
function fountainColumn(mine) {
    const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
            uniform float uTime; varying vec2 vUv; varying vec3 vP;
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
            void main(){
                float y = vUv.y;
                float fl = n(vec2(vUv.x * 14.0, y * 5.0 - uTime * 4.5)) * 0.6 + n(vec2(vUv.x * 30.0, y * 11.0 - uTime * 8.0)) * 0.4;
                float a = smoothstep(0.1, 0.9, fl) * (1.0 - smoothstep(0.35, 1.0, y)) * (0.4 + 0.6 * smoothstep(0.0, 0.2, y));
                vec3 c = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.25, 0.04), smoothstep(0.0, 0.8, y));
                gl_FragColor = vec4(c * a * 2.6, 1.0);
            }`,
    });
    mine.updaters.push((dt, t) => { m.uniforms.uTime.value = t; });
    return m;
}

/** The shaft of light (or night) from the sky, with the vent disc at its top. */
function ventLight(mine, ch) {
    const topY = ch.topY;
    const U = { uSky: { value: new THREE.Color(0.5, 0.65, 0.95) }, uAmount: { value: 1 }, uTime: { value: 0 }, uFlash: { value: 0 } };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 32).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: U, fog: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
            uniform vec3 uSky; uniform float uAmount, uTime, uFlash; varying vec2 vUv;
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
            void main(){
                float d = length(vUv - 0.5) * 2.0;
                vec3 c = uSky * (0.8 + 0.6 * smoothstep(1.0, 0.0, d)) * uAmount;
                // smoke drifting across it, lit red from below
                float sm = n(vUv * 5.0 + vec2(uTime * 0.2, uTime * 0.12)) * 0.6 + n(vUv * 11.0 - uTime * 0.3) * 0.4;
                c = mix(c, vec3(0.18, 0.06, 0.03) + vec3(0.5, 0.12, 0.02) * sm, smoothstep(0.35, 0.8, sm) * 0.8);
                c += vec3(0.7, 0.8, 1.0) * uFlash * 3.0;
                gl_FragColor = vec4(c, 1.0);
            }`,
    }));
    disc.position.set(ch.C.x, topY - 8, ch.C.z);
    mine.root.add(disc);
    // a column of light falling from it, brighter by day
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(14, 22, 190, 28, 1, true).translate(0, -95, 0), new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
            uniform vec3 uSky; uniform float uAmount, uTime; varying vec2 vUv;
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
            void main(){
                float a = vUv.y * vUv.y * (0.5 + 0.5 * n(vec2(vUv.x * 20.0, vUv.y * 3.0 - uTime * 0.3)));
                gl_FragColor = vec4(uSky * a * 0.07 * uAmount, 1.0);
            }`,
    }));
    shaft.position.set(ch.C.x, topY - 8, ch.C.z);
    mine.root.add(shaft);
    mine.updaters.push((dt, t) => { U.uTime.value = t; });
    return { U, disc, shaft };
}

/** The rock shelf the line ends on, its rail, and the walking bounds. */
function cliff(mine, ch, mat, r) {
    const fr = {};
    const mid = 1247;
    const o = mine.at(mid, 0, -0.45);
    frameAt(mid, fr);
    const tv = new THREE.Vector3(fr.t.x, 0, fr.t.z).normalize();
    const lv = new THREE.Vector3(fr.l.x, 0, fr.l.z).normalize();
    ch.ledge = { o, t: tv, l: lv, hl: 7.4, hs: 9.4, y: o.y };
    // a tongue of rock: an ellipsoid with a flat top, thick below
    const g = rockGeometry(11, { detail: 3, rough: 0.2, stretch: [9.6, 22, 11.5], flatTop: 0.94 });
    g.translate(0, -22 * 0.94, 0);
    const mesh = new THREE.Mesh(withRockAttrs(g, 0.2), mat);
    mesh.position.copy(o);
    // rotate so local x runs along the left vector and z along the tangent
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(lv, new THREE.Vector3(0, 1, 0), tv));
    mesh.frustumCulled = false;
    mine.root.add(mesh);
    // boulders and fallen blocks at its roots and rim
    for (let i = 0; i < 12; i++) {
        const gg = rockGeometry(20 + i, { detail: 1, rough: 0.5, stretch: [1, 0.7, 1] });
        const b = new THREE.Mesh(withRockAttrs(gg, 0.16), mat);
        const a = r() * TAU, d = 0.8 + r() * 0.35;
        const sc = 0.5 + r() * 1.5;
        b.position.copy(o).addScaledVector(lv, Math.cos(a) * ch.ledge.hl * d).addScaledVector(tv, Math.sin(a) * ch.ledge.hs * d + 1);
        b.position.y = o.y - 0.1 - r() * 1.2;
        b.scale.setScalar(sc);
        b.frustumCulled = false;
        mine.root.add(b);
    }
    // a rail of posts and chain along the front and sides
    const batch = mine.props;
    const post = new THREE.CylinderGeometry(0.05, 0.06, 1.15, 6);
    const chain = new THREE.BoxGeometry(0.04, 0.04, 1);
    const pts = [];
    for (let a = -Math.PI * 0.88; a <= Math.PI * 0.88 + 0.01; a += 0.2) {
        // the ellipse, front half and the sides; the back (toward the tunnel) is open
        const x = Math.sin(a) * (ch.ledge.hl - 0.55), s = Math.cos(a) * (ch.ledge.hs - 0.55);
        pts.push([x, s]);
    }
    pts.forEach(([x, s], i) => {
        const w = o.clone().addScaledVector(lv, x).addScaledVector(tv, s + 0.4);
        const m = new THREE.Matrix4().makeTranslation(w.x, o.y + 0.58, w.z);
        batch.add('blackIron', post, m);
        mine.cliffColliders.push({ x: w.x, z: w.z, r: 0.25 });
        if (i) {
            const [px, ps] = pts[i - 1];
            const w0 = o.clone().addScaledVector(lv, px).addScaledVector(tv, ps + 0.4);
            const len = w.distanceTo(w0);
            const mid2 = w.clone().add(w0).multiplyScalar(0.5);
            const mm = new THREE.Matrix4().lookAt(w, w0, new THREE.Vector3(0, 1, 0));
            mm.setPosition(mid2.x, o.y + 0.95 - 0.05 * Math.sin((i % 2) * 3.14), mid2.z);
            const sc = new THREE.Matrix4().makeScale(1, 1, len);
            batch.add('blackIron', chain, mm.multiply(sc));
            batch.add('blackIron', chain, new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(0, -0.32, 0), mm));
            // colliders along the chain so no one steps through
            for (let k = 1; k < 4; k++) {
                const f = k / 4;
                mine.cliffColliders.push({ x: lerp(w0.x, w.x, f), z: lerp(w0.z, w.z, f), r: 0.25 });
            }
        }
    });
    // two lanterns on posts and a sign: the last stop
    for (const sd of [-1, 1]) {
        const w = o.clone().addScaledVector(lv, sd * 4.6).addScaledVector(tv, -4.8);
        batch.add('blackIron', new THREE.CylinderGeometry(0.06, 0.07, 2.6, 6), new THREE.Matrix4().makeTranslation(w.x, o.y + 1.3, w.z));
        batch.add('lanternGlass', new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), new THREE.Matrix4().makeTranslation(w.x, o.y + 2.75, w.z));
        batch.add('brass', new THREE.ConeGeometry(0.17, 0.16, 8), new THREE.Matrix4().makeTranslation(w.x, o.y + 2.98, w.z));
        mine.emit(w.x, w.y ?? o.y + 2.7, w.z, 0xffa850, { intensity: 14, dist: 18, bake: 0, radius: 6, flicker: 0.15 });
        mine.cliffColliders.push({ x: w.x, z: w.z, r: 0.3 });
    }
    // the buffer stop at the end of the rails
    const e = mine.at(END_S + 1.2, 0, -0.1);
    batch.add('blackIron', new THREE.BoxGeometry(1.5, 0.45, 0.2), new THREE.Matrix4().makeTranslation(e.x, e.y + 0.18, e.z).multiply(new THREE.Matrix4().makeBasis(lv, new THREE.Vector3(0, 1, 0), tv)));
    void boxUV;
}
