// The giant at the bottom of the crater: a robot thirty metres tall, sat down
// where it fell and leaning back, gone to rust. Its chest is torn open and the
// gears that drove it have spilled out down its lap and over the crater floor,
// some of them as big as houses, half buried in the slopes. One leg is broken
// off at the knee, one forearm lies where it dropped with its cables trailing,
// the other hand rests palm-up on the ground. Something in its chest still
// glows, and one eye still flickers. UNIT 1337 is stencilled on its chest.

import * as THREE from 'three';
import { Acc, C, mat, cyl, cone, sphere, gearGeo, tube, rusty, rock, TAU } from './gearfall-kit.js';
import { groundY } from './gearfall-land.js';
import { rng, clamp, lerp } from './util.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const _q = new THREE.Quaternion(), _d = new V3(), _s = new V3();

const PAINT = rusty('#46625a', 0.62, 0.9);
const PAINT2 = rusty('#6a6a5a', 0.7, 1.1);
const DARK = rusty('#2a2a28', 0.5, 2);
const GEARC = rusty('#7a6236', 0.6, 1.8);
const BRASS = rusty('#8a7238', 0.45, 2.2);

export class Robot {
    constructor({ scene, material }) {
        this.scene = scene;
        this.cols = [];
        this.r = rng('gearfall-robot');
        this.floorY = groundY(0, 0);
        const acc = new Acc();
        this.acc = acc;
        this._body();
        this._spill();
        this.mesh = new THREE.Mesh(acc.build(), material);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this._stencil();
        this._glows();
        // generous targets to click
        this.hits = [];
        for (const [p, rad] of [[this.chest, 9], [this.headAt, 5]]) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
            m.position.copy(p);
            m.userData.kind = 'robot';
            scene.add(m);
            this.hits.push(m);
        }
        this.wake = 0;
    }

    /** A box from a to b (its long axis), w x d across. */
    _limb(a, b, w, d, o) {
        _d.copy(b).sub(a);
        const L = _d.length();
        _q.setFromUnitVectors(UP, _d.normalize());
        const m = new THREE.Matrix4().compose(a, _q, _s.set(1, 1, 1));
        this.acc.box(w, L, d, m, o);
        return L;
    }

    _colChain(a, b, r) {
        const n = Math.max(1, Math.ceil(a.distanceTo(b) / (r * 0.8)));
        for (let i = 0; i <= n; i++) this.cols.push({ x: lerp(a.x, b.x, i / n), z: lerp(a.z, b.z, i / n), r });
    }

    _body() {
        const { acc, r } = this;
        const F = this.floorY;
        const W = (x, y, z) => new V3(x, F + y, z);
        // the pelvis, and hips
        acc.box(14, 6, 9, mat(0, F + 2.5, -2, 0, 1, 1, 1, -0.05), { colorFn: PAINT2 });
        for (const s of [-1, 1]) acc.add(sphere(14, 10), mat(s * 6.4, F + 5.8, 0, 0, 3), { colorFn: DARK });
        this.cols.push({ x: 0, z: -2, r: 8.5 });
        // the left leg, knee up, foot flat
        const hipL = W(-6.4, 5.8, 0), kneeL = W(-6.8, 8.2, 12.5), ankleL = W(-7, 1.8, 16.2);
        this._limb(hipL, kneeL, 4.6, 4.4, { colorFn: PAINT });
        acc.add(sphere(12, 8), mat(kneeL.x, kneeL.y, kneeL.z, 0, 2.7), { colorFn: DARK });
        this._limb(kneeL, ankleL, 4, 4.2, { colorFn: PAINT });
        acc.box(5.2, 2.4, 7.5, mat(ankleL.x, F - 0.2, ankleL.z + 1.4, 0.05), { colorFn: PAINT2 });
        for (let k = -1; k <= 1; k++) acc.box(1.4, 1.2, 2, mat(ankleL.x + k * 1.6, F - 0.2, ankleL.z + 5.6, 0), { colorFn: DARK });
        this._colChain(new V3(-6.4, 0, 0), new V3(-6.8, 0, 12.5), 2.6);
        this._colChain(new V3(-7, 0, 14), new V3(-7, 0, 21), 2.8);
        // the right leg, broken off at the knee: the shin and foot lie off to the side
        const hipR = W(6.4, 5.8, 0), kneeR = W(6.9, 6.6, 12);
        this._limb(hipR, kneeR, 4.6, 4.4, { colorFn: PAINT });
        acc.add(sphere(12, 8), mat(kneeR.x, kneeR.y, kneeR.z, 0, 2.4), { colorFn: DARK });
        const shinA = W(12.5, 1.6, 17), shinB = W(19, 1.8, 13);
        this._limb(shinA, shinB, 4, 3.8, { colorFn: PAINT });
        acc.box(5, 7.4, 2.4, mat(shinB.x + 1.6, F - 0.2, shinB.z - 1.0, -1.0, 1, 1, 1, 0, Math.PI / 2 - 0.15).multiply(mat(0, -2.4, 0)), { colorFn: PAINT2 });
        this._colChain(new V3(6.4, 0, 0), new V3(6.9, 0, 12), 2.5);
        this._colChain(new V3(12.5, 0, 17), new V3(21, 0, 12), 2.4);
        // wires out of the knee stump, down to the ground
        for (let i = 0; i < 6; i++) {
            const a = kneeR.clone().add(new V3(r.range(-1.2, 1.2), r.range(-1, 0.5), 1.8));
            const b = new V3(kneeR.x + r.range(-1, 3), F + 0.2, kneeR.z + r.range(2, 5));
            acc.add(tube([a, a.clone().lerp(b, 0.5).add(new V3(0, -0.5, 0.8)), b], 0.12, 8, 4), mat(0, 0, 0), { color: C(r.pick(['#1a1a1a', '#5a1a1a', '#1a2a4a', '#4a4a1a'])), sway: 0.06 });
        }

        // the torso, leaning back, its chest open
        const T = mat(0, F + 8.6, -3.5, 0, 1, 1, 1, -0.33, 0.06);
        this.T = T;
        const at = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, tx = 0, tz = 0) => T.clone().multiply(mat(x, y, z, ry, sx, sy, sz, tx, tz));
        const P = (x, y, z) => new V3(x, y, z).applyMatrix4(T);
        acc.box(18, 16, 7, at(0, 0, -2), { colorFn: PAINT });
        acc.box(18, 4, 4, at(0, 0, 3.5), { colorFn: PAINT });
        acc.box(18, 4, 4, at(0, 12, 3.5), { colorFn: PAINT });
        acc.box(5, 8, 4, at(-6.5, 4, 3.5), { colorFn: PAINT });
        // the right-hand plate torn open on its hinge
        acc.box(5, 8, 0.8, at(9, 4, 5.2, -1.1).multiply(mat(-2.5, 0, 0)), { colorFn: PAINT });
        acc.box(1.2, 8, 3.4, at(8.4, 4, 3.4), { colorFn: DARK });
        // inside the chest: a dark cavity, gears on their shafts, and the glowing core
        acc.box(8.2, 8, 0.3, at(0, 4, 1.6), { color: C('#0e0d0c') });
        for (const [x, y, z, s, k] of [[-2, 9, 2.6, 2.4, 1], [2.2, 7, 3.2, 1.9, 0], [-1, 5.2, 3.8, 1.5, 2], [2.8, 10.4, 2.4, 1.2, 3], [-3, 6.3, 2.2, 1.1, 0]]) {
            acc.add(gearGeo(k), at(x, y, z, 0, s, s, s, Math.PI / 2 + r.range(-0.2, 0.2), r.range(-0.2, 0.2)), { colorFn: k % 2 ? BRASS : GEARC });
            acc.add(cyl(8), at(x, y, 1.7, 0, 0.25, z - 1.5, 0.25, Math.PI / 2), { colorFn: DARK });
        }
        this.coreAt = P(0.6, 6.8, 2.0);
        // shoulders, with hazard-striped pauldrons
        for (const s of [-1, 1]) {
            acc.add(sphere(14, 10), at(s * 10.6, 13, -1.5, 0, 4), { colorFn: DARK });
            acc.box(7.5, 1.2, 8, at(s * 11, 16.2, -1.5, 0, 1, 1, 1, 0, -s * 0.35), { colorFn: PAINT2 });
            for (let i = 0; i < 6; i++) acc.box(1.2, 1.25, 0.15, at(s * (8.2 + i * 1.15), 16.2, 2.55, 0, 1, 1, 1, 0, -s * 0.35), { color: i % 2 ? C('#a8881e').multiplyScalar(0.7) : C('#1a1814') });
        }
        // rivets along the plates
        for (let x = -8.5; x <= 8.5; x += 1.4) for (const y of [0.5, 3.6, 12.4, 15.5]) acc.add(sphere(5, 3), at(x, y, 5.52, 0, 0.18), { colorFn: DARK });
        // pipes down its back
        for (const s of [-1, 0, 1]) acc.add(cyl(10), at(s * 3, 0, -5.8, 0, 0.6, 16, 0.6), { colorFn: rusty('#5a3a2a', 0.7, 2) });
        this.chest = P(0, 8, 3);
        this.stencilT = at(-6.5, 13, 5.53);

        // the left arm: down to an elbow on the ground, the hand resting palm up
        const shL = P(-10.6, 13, -1.5), elL = W(-15.5, 3.2, 3), wrL = W(-14.8, 1.4, 12.5);
        this._limb(shL, elL, 3.6, 3.6, { colorFn: PAINT });
        acc.add(sphere(12, 8), mat(elL.x, elL.y, elL.z, 0, 2.3), { colorFn: DARK });
        this._limb(elL, wrL, 3.2, 3.2, { colorFn: PAINT });
        acc.box(4.4, 1.3, 4.8, mat(wrL.x, F + 0.1, wrL.z + 2.8, 0.1), { colorFn: PAINT2 });
        for (let k = 0; k < 4; k++) {
            const fx = wrL.x - 1.6 + k * 1.07;
            acc.box(0.85, 0.85, 2.4, mat(fx, F + 0.6, wrL.z + 5.2, 0.1 + (k - 1.5) * 0.06, 1, 1, 1, -0.35 - k * 0.08), { colorFn: DARK });
        }
        acc.box(0.9, 0.9, 2.2, mat(wrL.x + 2.5, F + 0.7, wrL.z + 2.6, 0.9, 1, 1, 1, -0.3), { colorFn: DARK });
        this._colChain(new V3(elL.x, 0, elL.z), new V3(wrL.x, 0, wrL.z + 5), 2.4);
        // the right arm: hanging, the forearm gone at the elbow, lying further off with its cables trailing
        const shR = P(10.6, 13, -1.5), elR = W(16.5, 6.5, -1.5);
        this._limb(shR, elR, 3.6, 3.6, { colorFn: PAINT });
        acc.add(sphere(12, 8), mat(elR.x, elR.y, elR.z, 0, 2.2), { colorFn: DARK });
        const faA = W(22, 1.6, 4), faB = W(27, 1.6, 12);
        this._limb(faA, faB, 3.2, 3, { colorFn: PAINT });
        acc.box(4.2, 1.3, 4.6, mat(faB.x + 1.5, F + 0.6, faB.z + 2.6, -0.6, 1, 1, 1, 0, 1.2), { colorFn: PAINT2 });
        for (let i = 0; i < 5; i++) {
            const a = elR.clone().add(new V3(r.range(-1, 1), -1.5, r.range(-1, 1)));
            const b = faA.clone().add(new V3(r.range(-1, 1), 0, r.range(-1, 1)));
            acc.add(tube([a, new V3(lerp(a.x, b.x, 0.4), F + 0.6, lerp(a.z, b.z, 0.4)), b], 0.14, 10, 4), mat(0, 0, 0), { color: C(r.pick(['#1a1a1a', '#5a1a1a', '#1a2a4a'])), sway: 0.04 });
        }
        this._colChain(new V3(elR.x, 0, elR.z), new V3(elR.x, 0, elR.z), 2.2);
        this._colChain(new V3(faA.x, 0, faA.z), new V3(faB.x + 2, 0, faB.z + 3), 2.2);

        // the head: slumped forward and to one side, one eye still lit
        const neck = P(0, 16, -1.5);
        acc.add(cyl(12), at(0, 16, -1.5, 0, 1.8, 2.2, 1.8), { colorFn: DARK });
        const H = at(0, 18, -1.2, 0.25, 1, 1, 1, 0.75, 0.28);
        this.H = H;
        const ha = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, tx = 0, tz = 0) => H.clone().multiply(mat(x, y, z, ry, sx, sy, sz, tx, tz));
        acc.box(8, 6.5, 7, ha(0, 0, 0), { colorFn: PAINT });
        acc.box(6.4, 1.4, 0.6, ha(0, 3.6, 3.35), { color: C('#080808') });
        acc.box(8.4, 0.6, 7.4, ha(0, 6.3, 0), { colorFn: PAINT2 });
        for (let k = -2; k <= 2; k++) acc.box(0.25, 1.6, 0.3, ha(k * 0.7, 0.8, 3.5), { colorFn: DARK });
        for (const s of [-1, 1]) acc.add(cyl(14), ha(s * 4.1, 3.2, 0, 0, 1.4, 0.6, 1.4, 0, Math.PI / 2 * s), { colorFn: DARK });
        acc.add(cyl(5), ha(2.5, 6.6, -1.5, 0, 0.12, 4, 0.12, 0.2, -0.9), { colorFn: DARK });
        acc.add(sphere(8, 6), ha(-1.7, 4.3, 3.55, 0, 0.62), { color: C('#1a1410') });
        acc.add(sphere(8, 6), ha(1.7, 4.3, 3.55, 0, 0.62), { color: C('#ffb050'), glow: 4, flick: 0.37 });
        this.eyeAt = new V3(1.7, 4.3, 4.2).applyMatrix4(H);
        this.headAt = new V3(0, 3, 0).applyMatrix4(H);
    }

    _spill() {
        const { acc, r } = this;
        const F = this.floorY;
        // a cascade from the chest down the lap to the ground in front
        const lip = new V3(0, 4.3, 5).applyMatrix4(this.T);
        for (let i = 0; i < 46; i++) {
            const t = r() ** 0.8;
            const x = r.range(-4, 4) * (1 + t * 2.4);
            const z = lerp(lip.z, 26, t) + r.range(-1.5, 1.5);
            const ground = groundY(x, z);
            const y = t < 0.25 ? lerp(lip.y, F + 9.5, t / 0.25) : Math.max(ground, t < 0.45 ? F + 9.5 - (t - 0.25) * 30 : ground);
            const s = r.range(0.4, 2.3) * (t > 0.5 ? 1.1 : 0.85);
            const lying = y <= ground + 0.3;
            acc.add(gearGeo(r.int(0, 3)), mat(x, y + 0.12 * s, z, r() * TAU, s, s, s, lying ? r.range(-0.15, 0.15) : r.range(-1.2, 1.2), lying ? r.range(-0.15, 0.15) : r.range(-1, 1)), { colorFn: r() < 0.3 ? BRASS : GEARC });
            if (lying && s > 1.3) this.cols.push({ x, z, r: s * 0.75 });
        }
        // more strewn over the floor and up the slopes, and great ones buried edge-on
        for (let i = 0; i < 60; i++) {
            const a = r() * TAU, d = r.range(12, 74);
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            if (Math.hypot(x, z + 2) < 11) continue;
            const s = r.range(0.3, 1.6);
            acc.add(gearGeo(r.int(0, 3)), mat(x, groundY(x, z) + 0.05, z, r() * TAU, s, s, s, r.range(-0.3, 0.3), r.range(-0.3, 0.3)), { colorFn: r() < 0.3 ? BRASS : GEARC });
            if (s > 1.2) this.cols.push({ x, z, r: s * 0.7 });
        }
        for (let i = 0; i < 11; i++) {
            const a = (i / 11) * TAU + r.range(-0.2, 0.2), d = r.range(28, 66);
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            const s = r.range(3, 6.5);
            const y = groundY(x, z);
            acc.add(gearGeo(r.int(0, 3)), mat(x, y + s * 0.35, z, a + Math.PI / 2 + r.range(-0.4, 0.4), s, s, s, Math.PI / 2 + r.range(-0.45, 0.45), r.range(-0.2, 0.2)), { colorFn: GEARC });
            this.cols.push({ x, z, r: s * 0.55 });
        }
        // broken plates and shafts, and rocks thrown up by the fall
        for (let i = 0; i < 40; i++) {
            const a = r() * TAU, d = r.range(8, 80);
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            if (Math.hypot(x, z + 2) < 10) continue;
            const y = groundY(x, z);
            const k = r();
            if (k < 0.4) acc.box(r.range(1, 4), 0.3, r.range(1, 3), mat(x, y - 0.1, z, r() * TAU, 1, 1, 1, r.range(-0.4, 0.4), r.range(-0.4, 0.4)), { colorFn: r() < 0.5 ? PAINT : PAINT2 });
            else if (k < 0.6) acc.add(cyl(8), mat(x, y + 0.3, z, r() * TAU, 0.4, r.range(3, 7), 0.4, Math.PI / 2 - 0.1, 0), { colorFn: DARK });
            else {
                const s = r.range(0.8, 2.6);
                acc.add(rock(r() * 6), mat(x, y + s * 0.2, z, r() * 3, s), { color: C('#2a2824').multiplyScalar(0.8 + r() * 0.4) });
                if (s > 1.6) this.cols.push({ x, z, r: s * 0.8 });
            }
        }
    }

    /** UNIT 1337, in faded stencil on the chest plate and the shoulder. */
    _stencil() {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 160;
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(232, 220, 190, 0.85)';
        x.font = '700 92px "Courier New", monospace';
        x.textBaseline = 'middle';
        x.textAlign = 'center';
        x.fillText('UNIT 1337', 256, 84);
        // scrape the paint
        x.globalCompositeOperation = 'destination-out';
        const r = rng('stencil');
        for (let i = 0; i < 260; i++) {
            x.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
            x.fillRect(r() * 512, r() * 160, 2 + r() * 18, 1 + r() * 4);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
        const d = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), m);
        d.applyMatrix4(this.stencilT.clone().multiply(new THREE.Matrix4().makeTranslation(3.2, 1.9, 0.04)));
        this.scene.add(d);
        this.stencil = d;
    }

    _glows() {
        const F = this.floorY;
        // the core in the open chest, and its light
        this.coreMat = new THREE.MeshBasicMaterial({ color: 0x7affd8 });
        this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), this.coreMat);
        this.core.position.copy(this.coreAt);
        this.coreLight = new THREE.PointLight(0x6affd0, 120, 40, 1.4);
        this.coreLight.position.copy(this.coreAt).add(new V3(0, 0, 3));
        this.eyeLight = new THREE.PointLight(0xffa040, 30, 14, 1.6);
        this.eyeLight.position.copy(this.eyeAt).add(new V3(0, -0.3, 1.2));
        // the crater's own light, from the glowing ground
        this.craterLight = new THREE.PointLight(0x5affd0, 400, 150, 1.2);
        this.craterLight.position.set(0, F + 12, 16);
        // a column of light standing over the crater, seen from far off
        this.columnU = { uTime: { value: 0 }, uAmount: { value: 1 } };
        const g = new THREE.CylinderGeometry(46, 70, 320, 40, 8, true).translate(0, 160 + F, 0);
        this.column = new THREE.Mesh(g, new THREE.ShaderMaterial({
            uniforms: this.columnU,
            vertexShader: 'varying vec3 vW; varying vec3 vN; varying float vH; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vH = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: /* glsl */ `
uniform float uTime; uniform float uAmount; varying vec3 vW; varying vec3 vN; varying float vH;
void main() {
    vec3 v = normalize(cameraPosition - vW);
    float rim = pow(1.0 - abs(dot(v, vN)), 1.6);
    float a = (1.0 - vH) * (1.0 - vH) * (0.35 + 0.65 * rim);
    float wav = 0.75 + 0.25 * sin(vH * 30.0 - uTime * 1.6 + atan(vW.z, vW.x) * 5.0);
    float d = distance(cameraPosition.xz, vW.xz);
    a *= wav * smoothstep(8.0, 60.0, d) * uAmount;
    gl_FragColor = vec4(vec3(0.3, 1.0, 0.82) * a * 0.22, 1.0);
}`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        }));
        this.column.frustumCulled = false;
        this.column.renderOrder = 2;
        this.scene.add(this.core, this.coreLight, this.eyeLight, this.craterLight, this.column);
    }

    /** Touched: the eye flares and the core brightens for a moment. */
    poke() {
        this.wake = 1;
    }

    update(dt, t, flick) {
        this.wake = Math.max(0, this.wake - dt * 0.35);
        const pulse = 0.75 + 0.25 * Math.sin(t * 1.2);
        this.coreMat.color.setRGB(0.4 * pulse, 1.0 * pulse, 0.85 * pulse).multiplyScalar(1 + this.wake * 2);
        this.core.rotation.y += dt * 0.4;
        this.core.rotation.x += dt * 0.23;
        this.coreLight.intensity = (90 + 40 * pulse) * (1 + this.wake * 2);
        this.eyeLight.intensity = 30 * flick(t, 0.37) * (1 + this.wake * 4);
        this.craterLight.intensity = 360 + 80 * Math.sin(t * 1.2);
        this.columnU.uTime.value = t;
    }
}
