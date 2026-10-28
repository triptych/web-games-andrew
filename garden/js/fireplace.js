// The hut's fireplace: a stone chimney breast with a sooty firebrick firebox,
// iron andirons, charred logs with glowing cracks, a bed of embers, procedural
// flames (camera-facing shader billboards), rising sparks and a flickering
// pair of lights. The stonework goes into the room's batch; everything that
// moves is added to the scene and driven by update().

import * as THREE from 'three';
import { xf } from './materials.js';
import { canvas, toTexture, glowSprite } from './textures.js';
import { rng, noise2 } from './util.js';

const NOISE3 = /* glsl */ `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; } return s; }`;

/** One tongue of flame on a quad that turns about the vertical to face the camera. */
const FLAME_VERT = /* glsl */ `
uniform vec2 uSize;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCam = cameraPosition - c;
    toCam.y = 0.0;
    vec3 f = normalize(toCam + vec3(1e-4, 0.0, 0.0));
    vec3 right = vec3(f.z, 0.0, -f.x);
    vec3 wp = c + right * position.x * uSize.x + vec3(0.0, position.y * uSize.y, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const FLAME_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uGain;
varying vec2 vUv;
${NOISE3}
void main() {
    vec2 uv = vUv;
    float t = uTime * (1.0 + fract(uSeed * 7.13) * 0.4);
    // turbulence that races upward, and a slower sway of the whole tongue
    float n = fbm3(vec3(uv.x * 3.2, uv.y * 2.4 - t * 2.1, uSeed + t * 0.3));
    float n2 = fbm3(vec3(uv.x * 7.0, uv.y * 5.0 - t * 3.4, uSeed * 1.7 + 4.0));
    float sway = (noise3(vec3(t * 0.9, uSeed, 0.0)) - 0.5) * 0.5;
    float x = (uv.x - 0.5) * 2.0;
    x += ((n - 0.5) * 1.1 + sway) * uv.y * 1.3;
    // a teardrop: full at the root, pinched to a point at the tip
    float width = mix(0.9, 0.04, pow(uv.y, 0.75));
    float body = 1.0 - smoothstep(width * 0.35, width, abs(x));
    float h = uv.y + (n2 - 0.5) * 0.45;
    float heat = body * (1.0 - smoothstep(0.15, 0.95, h));
    heat *= smoothstep(0.0, 0.12, uv.y);
    heat = clamp(heat * (0.55 + n2 * 1.0) * 1.35 - 0.08, 0.0, 1.0);
    // deep red at the edges and tips, orange through the body, a white-gold core
    vec3 col = mix(vec3(0.55, 0.06, 0.0), vec3(1.0, 0.42, 0.06), smoothstep(0.08, 0.45, heat));
    col = mix(col, vec3(1.0, 0.82, 0.45), smoothstep(0.55, 0.92, heat));
    // a hint of blue where the gas first catches, low and at the root
    col += vec3(0.05, 0.12, 0.45) * (1.0 - smoothstep(0.0, 0.18, uv.y)) * body * 0.8;
    float a = smoothstep(0.02, 0.3, heat);
    gl_FragColor = vec4(col * a * uGain * 1.6, 1.0);
}`;

/** Charred wood and coals: black with cracks that glow and breathe. */
const EMBER_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
}`;
const EMBER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uHeat;
uniform float uFlick;
uniform float uFloor;
varying vec3 vW; varying vec3 vN;
${NOISE3}
void main() {
    vec3 p = vW * 22.0;
    float n = fbm3(p);
    float cr = 1.0 - abs(fbm3(p * 0.4 + vec3(0.0, 3.0, 0.0)) * 2.0 - 1.0);
    float crack = pow(cr, 5.0);
    float pulse = 0.55 + 0.45 * noise3(vW * 6.0 + vec3(uTime * 0.7, uTime * 0.4, 0.0));
    // hottest underneath, close to the coals; the tops have cooled to ash-black
    float low = 1.0 - smoothstep(uFloor + 0.05, uFloor + 0.3, vW.y);
    float under = clamp(0.6 - vN.y, 0.0, 1.0);
    float heat = uHeat * pulse * (crack * 0.7 + smoothstep(0.45, 0.75, n) * 1.1) * (0.35 + 0.65 * max(low, under));
    vec3 ember = mix(vec3(0.45, 0.03, 0.0), vec3(1.0, 0.32, 0.02), smoothstep(0.15, 0.7, heat));
    ember = mix(ember, vec3(1.0, 0.78, 0.4), smoothstep(0.85, 1.4, heat));
    vec3 charCol = vec3(0.03, 0.024, 0.02) * (0.5 + n);
    charCol += vec3(0.6, 0.22, 0.05) * max(vN.y, 0.0) * 0.12 * uFlick;
    charCol = mix(charCol, vec3(0.16, 0.15, 0.14), smoothstep(0.62, 0.75, n) * (1.0 - low) * 0.5);
    gl_FragColor = vec4(charCol + ember * heat * 2.2, 1.0);
}`;

/** Firebrick lining, blackened by years of smoke (darkest up near the flue). */
function firebrickTexture() {
    const n = 256, c = canvas(n), x = c.getContext('2d'), r = rng('firebrick');
    x.fillStyle = '#2a2420';
    x.fillRect(0, 0, n, n);
    const rows = 8, bh = n / rows, bw = n / 3;
    for (let j = 0; j < rows; j++) {
        for (let i = -1; i < 4; i++) {
            const ox = (j % 2) * bw * 0.5;
            const v = r();
            x.fillStyle = `rgb(${90 + v * 40},${38 + v * 16},${26 + v * 10})`;
            x.fillRect(i * bw + ox + 2, j * bh + 2, bw - 4, bh - 4);
        }
    }
    const g = x.createLinearGradient(0, 0, 0, n);
    g.addColorStop(0, 'rgba(6,4,3,0.92)');
    g.addColorStop(0.55, 'rgba(10,7,5,0.7)');
    g.addColorStop(1, 'rgba(14,10,8,0.35)');
    x.fillStyle = g;
    x.fillRect(0, 0, n, n);
    for (let k = 0; k < 60; k++) {
        x.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.15})`;
        x.beginPath();
        x.arc(r() * n, r() * n * 0.8, 6 + r() * 22, 0, Math.PI * 2);
        x.fill();
    }
    return toTexture(c);
}

/** Smooth flicker in roughly [0, 1], different for each seed. */
const flicker = (t, s) => 0.5 + 0.5 * (noise2(t * 3.1, s) * 0.55 + noise2(t * 7.7, s + 13) * 0.3 + noise2(t * 17.3, s + 29) * 0.15);

/**
 * @param {object} o
 * @param {import('./materials.js').Batch} o.batch  the room's stonework batch
 * @param {THREE.Scene} o.scene
 * @param {object} o.mats  shared materials (granite, sandstone, darkWood, iron); 'firebrick' and 'mortar' are added
 * @param {number} o.x  centre of the chimney breast
 * @param {number} o.back  z of the inside face of the wall it stands against (the breast comes out toward +z)
 * @param {number} o.left  x of the inside face of the side wall, so the breast meets it
 * @param {number} o.ceil  ceiling height
 */
export function buildFireplace({ batch, scene, mats, x: FX, back, left, ceil }) {
    const b = batch;
    const box = (key, w, h, d, x, y, z, ry = 0) => b.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry));
    mats.firebrick ??= new THREE.MeshStandardMaterial({ map: firebrickTexture(), roughness: 1 });
    mats.mortar ??= new THREE.MeshStandardMaterial({ color: 0x5c554d, roughness: 1 });
    const r = rng('hut-hearth');

    const BW = 2 * (FX - left);                // breast width, meeting the side wall
    const BD = 0.72, zf = back + BD;           // breast depth and its front face
    const OW = 0.94, OH = 0.8, FD = 0.5;       // firebox opening and depth
    const y0 = 0.14;                           // raised hearth / firebox floor
    const LT = 0.26, MY = y0 + OH + LT;        // lintel height, underside of the mantel
    const jw = (BW - OW) / 2;

    // plinth and the hearth slab out in front
    box('granite', BW, y0, BD, FX, y0 / 2, back + BD / 2);
    box('sandstone', BW + 0.24, y0, 0.55, FX, y0 / 2, zf + 0.27);
    // a mortar core behind the dressed stones, so the joints read dark
    box('mortar', jw - 0.02, OH + LT, BD - 0.04, FX - (OW + jw) / 2, y0 + (OH + LT) / 2, back + BD / 2 - 0.02);
    box('mortar', jw - 0.02, OH + LT, BD - 0.04, FX + (OW + jw) / 2, y0 + (OH + LT) / 2, back + BD / 2 - 0.02);
    box('mortar', OW + 0.02, LT, BD - 0.04, FX, y0 + OH + LT / 2, back + BD / 2 - 0.02);
    // jambs: courses of dressed stone, alternating long and short
    const courses = 4, ch = OH / courses;
    for (const side of [-1, 1]) {
        const xin = FX + side * OW / 2, xout = FX + side * BW / 2;
        for (let k = 0; k < courses; k++) {
            const long = (k + (side > 0 ? 1 : 0)) % 2 === 0;
            const w = long ? jw : jw * 0.62;
            const cx = side > 0 ? xin + w / 2 : xin - w / 2;
            const stone = r() < 0.3 ? 'sandstone' : 'granite';
            box(stone, w - 0.018, ch - 0.018, BD - 0.02 + r() * 0.025, cx, y0 + k * ch + ch / 2, back + BD / 2 + 0.005);
            if (!long) {
                // the outer filler stone of a short course
                const w2 = jw - w;
                box('granite', w2 - 0.018, ch - 0.018, BD - 0.03 + r() * 0.02, side > 0 ? xout - w2 / 2 : xout + w2 / 2, y0 + k * ch + ch / 2, back + BD / 2);
            }
        }
    }
    // a flat arch of voussoirs over the opening, with a keystone
    const vn = 7, span = OW + 0.3, vw = span / vn;
    for (let k = 0; k < vn; k++) {
        const key = k === (vn - 1) / 2;
        const hgt = key ? LT + 0.02 : LT - 0.02;
        box(key ? 'sandstone' : 'granite', vw - 0.016, hgt - 0.016, (key ? 0.2 : 0.17), FX - span / 2 + vw * (k + 0.5), y0 + OH + hgt / 2, zf - 0.08 + (key ? 0.015 : 0));
    }
    box('granite', jw - 0.16, LT - 0.02, BD - 0.05, FX - BW / 2 + (jw - 0.16) / 2, y0 + OH + LT / 2, back + BD / 2);
    box('granite', jw - 0.16, LT - 0.02, BD - 0.05, FX + BW / 2 - (jw - 0.16) / 2, y0 + OH + LT / 2, back + BD / 2);
    // the mantel: a heavy timber beam on two brackets
    box('darkWood', BW + 0.16, 0.13, BD * 0.5 + 0.12, FX, MY + 0.065, zf - BD * 0.25 + 0.06);
    for (const side of [-1, 1]) box('darkWood', 0.1, 0.16, 0.14, FX + side * (BW / 2 - 0.12), MY - 0.08, zf + 0.04);
    // the chimney breast rising to the ceiling, faced with rubble courses
    const UW = BW - 0.3, UD = BD - 0.18, ux = FX - 0.15;
    box('mortar', UW, ceil - MY - 0.13, UD, ux, MY + 0.13 + (ceil - MY - 0.13) / 2, back + UD / 2);
    for (let y = MY + 0.14; y < ceil - 0.05; ) {
        const hgt = Math.min(0.2 + r() * 0.08, ceil - y);
        for (let xx = ux - UW / 2; xx < ux + UW / 2 - 0.02; ) {
            const w = Math.min(0.22 + r() * 0.26, ux + UW / 2 - xx);
            box(r() < 0.25 ? 'sandstone' : 'granite', w - 0.02, hgt - 0.02, 0.05 + r() * 0.02, xx + w / 2, y + hgt / 2, back + UD + 0.012);
            xx += w;
        }
        // and round the side that faces the room
        for (let zz = back; zz < back + UD - 0.02; ) {
            const d = Math.min(0.2 + r() * 0.2, back + UD - zz);
            box(r() < 0.25 ? 'sandstone' : 'granite', 0.05 + r() * 0.02, hgt - 0.02, d - 0.02, ux + UW / 2 + 0.012, y + hgt / 2, zz + d / 2);
            zz += d;
        }
        y += hgt;
    }
    // the firebox: back, sides and the throat above, all sooty brick
    const fb = zf - FD;
    box('firebrick', OW, OH + 0.02, 0.04, FX, y0 + OH / 2, fb);
    for (const side of [-1, 1]) {
        b.add('firebrick', new THREE.BoxGeometry(0.04, OH, FD), xf(FX + side * (OW / 2 - 0.02 - 0.05), y0 + OH / 2, fb + FD / 2 - 0.02, side * 0.2));
    }
    box('firebrick', OW, 0.04, FD, FX, y0 + OH - 0.02, fb + FD / 2 - 0.03);
    box('dark', OW - 0.04, 0.012, FD - 0.04, FX, y0 + 0.006, fb + FD / 2);

    // andirons and a grate
    const fz = fb + FD / 2;
    for (const side of [-1, 1]) {
        const ax = FX + side * 0.3;
        box('iron', 0.035, 0.035, FD - 0.08, ax, y0 + 0.12, fz);
        box('iron', 0.03, 0.12, 0.03, ax, y0 + 0.06, fz + FD / 2 - 0.08);
        box('iron', 0.03, 0.12, 0.03, ax, y0 + 0.06, fz - FD / 2 + 0.08);
        box('iron', 0.04, 0.2, 0.04, ax, y0 + 0.2, zf - 0.06);
        b.add('iron', new THREE.SphereGeometry(0.035, 10, 8), xf(ax, y0 + 0.32, zf - 0.06));
    }
    for (let k = 0; k < 4; k++) box('iron', 0.66, 0.02, 0.02, FX, y0 + 0.13, fb + 0.1 + k * 0.1);

    // logs and coals share one shader; the bed of coals runs hotter
    const emberMat = (heat) => new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uHeat: { value: heat }, uFlick: { value: 1 }, uFloor: { value: y0 } },
        vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG,
    });
    const logMat = emberMat(0.9), coalMat = emberMat(1.3);
    const logs = [
        [0, 0.075, 0.72, fz - 0.09, y0 + 0.22, 0.12, 0],
        [0.02, 0.07, 0.7, fz + 0.08, y0 + 0.215, -0.08, 0],
        [-0.04, 0.06, 0.62, fz, y0 + 0.35, 0.55, 0.12],
    ];
    for (const [dx, rad, len, z, y, ry, rz] of logs) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, len, 12, 1), logMat);
        log.rotation.set(0, ry, Math.PI / 2 + rz, 'YXZ');
        log.position.set(FX + dx, y, z);
        scene.add(log);
    }
    const coalGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let k = 0; k < 26; k++) {
        const coal = new THREE.Mesh(coalGeo, coalMat);
        const s = 0.02 + r() * 0.03;
        coal.scale.set(s * (1 + r() * 0.6), s * 0.6, s * (1 + r() * 0.5));
        coal.rotation.set(r() * 3, r() * 3, r() * 3);
        coal.position.set(FX + (r() - 0.5) * (OW - 0.24), y0 + 0.012 + s * 0.3, fz + (r() - 0.5) * (FD - 0.14));
        scene.add(coal);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(OW - 0.2, 0.02, FD - 0.12), coalMat);
    bed.position.set(FX, y0 + 0.012, fz);
    scene.add(bed);

    // flames: tongues of different sizes set along and across the logs
    const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const flames = [];
    const spots = [
        [0, 0, 0.34, 0.56], [-0.18, -0.06, 0.3, 0.46], [0.2, -0.04, 0.28, 0.5], [-0.08, 0.07, 0.26, 0.42],
        [0.1, 0.08, 0.24, 0.38], [-0.3, 0.02, 0.18, 0.28], [0.3, 0.03, 0.17, 0.26], [0.02, -0.1, 0.4, 0.32],
        [-0.12, -0.12, 0.2, 0.24], [0.14, 0.12, 0.2, 0.3],
    ];
    for (const [dx, dz, w, hgt] of spots) {
        const m = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uSeed: { value: r() * 50 }, uGain: { value: 1 }, uSize: { value: new THREE.Vector2(w, hgt) } },
            vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const f = new THREE.Mesh(flameGeo, m);
        f.position.set(FX + dx, y0 + 0.17, fz + dz);
        f.frustumCulled = false;
        f.renderOrder = 2;
        f.userData.base = hgt;
        scene.add(f);
        flames.push(f);
    }

    // sparks drifting up into the flue
    const NS = 48;
    const sp = new Float32Array(NS * 3), sc = new Float32Array(NS * 3);
    const sparks = Array.from({ length: NS }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, seed: r() * 100 }));
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const sMat = new THREE.PointsMaterial({ map: glowSprite(), size: 0.03, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sPts = new THREE.Points(sGeo, sMat);
    sPts.frustumCulled = false;
    scene.add(sPts);
    const respawn = (s, i) => {
        s.life = 0;
        s.max = 0.5 + Math.random() * 1.1;
        s.vx = (Math.random() - 0.5) * 0.12;
        s.vz = (Math.random() - 0.5) * 0.08;
        s.vy = 0.35 + Math.random() * 0.55;
        sp[i * 3] = FX + (Math.random() - 0.5) * 0.5;
        sp[i * 3 + 1] = y0 + 0.25 + Math.random() * 0.15;
        sp[i * 3 + 2] = fz + (Math.random() - 0.5) * 0.25;
    };
    sparks.forEach((s, i) => {
        respawn(s, i);
        s.life = Math.random() * s.max;
    });

    // a soft glow at the mouth, and the light the fire throws: one into the room, one inside the box
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff8a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
    glow.scale.set(1.3, 0.9, 1);
    glow.position.set(FX, y0 + 0.35, zf - 0.12);
    scene.add(glow);
    const room = new THREE.PointLight(0xff8636, 5, 7.5, 1.5);
    room.position.set(FX + 0.15, y0 + 0.45, zf + 0.3);
    const inner = new THREE.PointLight(0xff6a1e, 2.2, 1.4, 2);
    inner.position.set(FX, y0 + 0.4, fz);
    scene.add(room, inner);

    return {
        collider: { x: FX, z: back + (BD + 0.3) / 2, w: BW, d: BD + 0.3 },
        update(dt, t) {
            const f1 = flicker(t, 3), f2 = flicker(t * 1.3, 41);
            room.intensity = 3.4 + f1 * 2.6;
            room.position.x = FX + 0.15 + (f2 - 0.5) * 0.12;
            room.position.y = y0 + 0.42 + f1 * 0.1;
            inner.intensity = 1.6 + f2 * 1.4;
            glow.material.opacity = 0.16 + f1 * 0.16;
            logMat.uniforms.uTime.value = coalMat.uniforms.uTime.value = t;
            logMat.uniforms.uFlick.value = coalMat.uniforms.uFlick.value = 0.6 + f1 * 0.8;
            for (let k = 0; k < flames.length; k++) {
                const u = flames[k].material.uniforms;
                u.uTime.value = t;
                const g = flicker(t * 1.6, u.uSeed.value);
                u.uGain.value = 0.75 + g * 0.5;
                u.uSize.value.y = flames[k].userData.base * (0.85 + g * 0.25);
            }
            const step = Math.min(dt, 0.05);
            for (let i = 0; i < NS; i++) {
                const s = sparks[i];
                s.life += step;
                if (s.life > s.max || sp[i * 3 + 1] > y0 + OH - 0.04) respawn(s, i);
                s.vx += noise2(t * 2 + s.seed, s.seed) * step * 0.6;
                sp[i * 3] += s.vx * step;
                sp[i * 3 + 1] += s.vy * step;
                sp[i * 3 + 2] += s.vz * step;
                const fade = Math.max(0, 1 - s.life / s.max) * (0.6 + 0.4 * Math.sin(t * 30 + s.seed));
                sc[i * 3] = fade;
                sc[i * 3 + 1] = fade * 0.55;
                sc[i * 3 + 2] = fade * 0.15;
            }
            sGeo.attributes.position.needsUpdate = true;
            sGeo.attributes.color.needsUpdate = true;
        },
    };
}
