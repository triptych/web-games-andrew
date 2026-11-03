// Things in Gearfall's air: sheets of paper skittering along the ground and
// lifting on the gusts, ash drifting down, motes of the crater's light rising
// near it, steam leaking from pipes and manholes, and sparks going up from the
// burning barrels. All of it is drawn round the camera, so there is always
// some about you.

import * as THREE from 'three';
import { GLSL_HASH } from './gearfall-kit.js';
import { glowSprite } from './textures.js';

const V3 = THREE.Vector3;

const PAPER_VERT = /* glsl */ `
uniform vec3 uCam; uniform float uTime; uniform vec2 uWind; uniform float uFeet;
attribute float aSeed;
varying vec2 vUv; varying float vA; varying float vShade; varying float vSeed;
void main() {
    float s = aSeed;
    vec2 base = vec2(fract(s * 13.7), fract(s * 71.3)) * 44.0 - 22.0;
    float speed = 0.8 + fract(s * 5.1) * 1.8;
    float g = smoothstep(0.62, 1.0, sin(uTime * 0.31 + s * 40.0) * 0.5 + 0.5);
    vec2 p = base + uWind * (uTime * speed + g * 4.0) + vec2(sin(uTime * 0.8 + s * 9.0), cos(uTime * 0.7 + s * 7.0)) * 0.5;
    p = mod(p - uCam.xz + 22.0, 44.0) - 22.0 + uCam.xz;
    float lift = g * (0.4 + fract(s * 3.3) * 2.6) * (0.6 + 0.4 * sin(uTime * 1.3 + s * 20.0));
    float hop = abs(sin(uTime * (2.0 + fract(s * 7.7) * 2.0) + s * 30.0)) * 0.08 * (1.0 - g);
    float y = uFeet + 0.02 + lift + hop;
    float a1 = uTime * (1.5 + fract(s * 2.9) * 3.0) + s * 50.0;
    float a2 = uTime * (0.4 + fract(s * 4.3) * 1.2) * (0.3 + g) + s * 20.0;
    vec3 q = vec3(position.x * 0.21, 0.0, position.y * 0.29);
    q.y += sin(position.x * 3.0 + uTime * 9.0 + s * 10.0) * 0.025 * (0.3 + g * 2.0);
    float ra = mix(0.12 * sin(a1), a1, g);
    q = vec3(q.x, q.y * cos(ra) - q.z * sin(ra), q.y * sin(ra) + q.z * cos(ra));
    q = vec3(q.x * cos(a2) + q.z * sin(a2), q.y, -q.x * sin(a2) + q.z * cos(a2));
    vec3 wp = vec3(p.x, y, p.y) + q;
    vUv = uv;
    vSeed = s;
    float d = distance(wp, cameraPosition);
    vA = 1.0 - smoothstep(15.0, 21.0, d);
    vShade = 0.65 + 0.35 * abs(cos(ra));
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const PAPER_FRAG = /* glsl */ `
uniform float uLight; uniform float uAmount;
varying vec2 vUv; varying float vA; varying float vShade; varying float vSeed;
${GLSL_HASH}
void main() {
    vec3 c = mix(vec3(0.86, 0.82, 0.7), vec3(0.72, 0.64, 0.48), fract(vSeed * 17.0));
    // lines of type, a stain, a torn corner
    float line = step(0.5, fract(vUv.y * 22.0)) * step(0.12, vUv.x) * step(vUv.x, 0.88 - 0.3 * step(0.8, fract(vUv.y * 3.7 + vSeed))) * step(0.1, vUv.y) * step(vUv.y, 0.86);
    c *= 1.0 - line * 0.25;
    c *= 1.0 - smoothstep(0.3, 0.0, length(vUv - vec2(0.7, 0.3)) - fract(vSeed * 3.0) * 0.2) * 0.3;
    if (vUv.x + vUv.y > 1.75 + fract(vSeed * 11.0) * 0.2) discard;
    float a = vA * uAmount;
    if (a < 0.02) discard;
    gl_FragColor = vec4(c * vShade * uLight, a);
}`;

const ASH_VERT = /* glsl */ `
uniform vec3 uCam; uniform float uTime; uniform float uScale; uniform vec2 uWind;
attribute float aSeed;
varying float vA;
void main() {
    float s = aSeed;
    vec3 p = position + vec3(uWind.x * uTime * 0.6 + sin(uTime * 0.6 + s * 20.0) * 0.8, -uTime * (0.25 + s * 0.25), uWind.y * uTime * 0.6 + cos(uTime * 0.5 + s * 13.0) * 0.8);
    p = mod(p - uCam + 16.0, 32.0) - 16.0 + uCam;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    vA = smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(10.0, 16.0, d));
    gl_PointSize = (0.035 + s * 0.04) * uScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
}`;
const ASH_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAmount; varying float vA;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.2, 0.5, d)) * vA * uAmount;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * 0.7);
}`;

const MOTE_VERT = /* glsl */ `
uniform vec3 uCam; uniform float uTime; uniform float uScale;
attribute float aSeed;
varying float vA;
void main() {
    float s = aSeed;
    float life = fract(uTime * (0.05 + s * 0.06) + s * 7.0);
    vec3 p = position + vec3(sin(uTime * 0.4 + s * 30.0) * 1.5, life * 26.0, cos(uTime * 0.35 + s * 17.0) * 1.5);
    p.xz = mod(p.xz - uCam.xz + 30.0, 60.0) - 30.0 + uCam.xz;
    p.y += uCam.y - 6.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float c = length(p.xz);
    vA = sin(life * 3.14159) * (1.0 - smoothstep(55.0, 115.0, c)) * smoothstep(0.5, 3.0, d) * (1.0 - smoothstep(26.0, 30.0, d));
    gl_PointSize = (0.06 + s * 0.12) * uScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
}`;
const MOTE_FRAG = /* glsl */ `
uniform float uAmount; varying float vA;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA * uAmount;
    gl_FragColor = vec4(vec3(0.4, 1.0, 0.85) * a * 1.4, 1.0);
}`;

export class GearfallFX {
    constructor(scene, cfg) {
        this.scene = scene;
        this.wind = new THREE.Vector2(0.86, -0.5);
        this._papers(cfg.papers);
        this._ash(cfg.ash);
        this._motes(cfg.motes);
        this._puffs();
    }

    _papers(n) {
        const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 3, 1));
        const seed = new Float32Array(n);
        for (let i = 0; i < n; i++) seed[i] = Math.random();
        g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
        g.instanceCount = n;
        this.paperU = { uCam: { value: new V3() }, uTime: { value: 0 }, uWind: { value: this.wind }, uFeet: { value: 0 }, uLight: { value: 1 }, uAmount: { value: 1 } };
        this.papers = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.paperU, vertexShader: PAPER_VERT, fragmentShader: PAPER_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: true }));
        this.papers.frustumCulled = false;
        this.scene.add(this.papers);
    }

    _ash(n) {
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos.set([(Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32], i * 3);
            seed[i] = Math.random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        this.ashU = { uCam: { value: new V3() }, uTime: { value: 0 }, uScale: { value: 400 }, uWind: { value: this.wind }, uColor: { value: new THREE.Color(0.6, 0.58, 0.55) }, uAmount: { value: 1 } };
        this.ash = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.ashU, vertexShader: ASH_VERT, fragmentShader: ASH_FRAG, transparent: true, depthWrite: false }));
        this.ash.frustumCulled = false;
        this.scene.add(this.ash);
    }

    _motes(n) {
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos.set([(Math.random() - 0.5) * 60, Math.random() * 4, (Math.random() - 0.5) * 60], i * 3);
            seed[i] = Math.random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        this.moteU = { uCam: { value: new V3() }, uTime: { value: 0 }, uScale: { value: 400 }, uAmount: { value: 1 } };
        this.motes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.moteU, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.motes.frustumCulled = false;
        this.scene.add(this.motes);
    }

    /** Puffs of steam and sparks from fires: a small pool of sprites, worked on the CPU. */
    _puffs() {
        const N = 90;
        this.puffN = N;
        this.puff = [];
        const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), kind = new Float32Array(N);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
        g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
        for (let i = 0; i < N; i++) this.puff.push({ life: 0, max: 1, p: new V3(), v: new V3(), s: 1, kind: 0 });
        this.puffU = { uScale: { value: 400 }, uMap: { value: glowSprite() }, uLight: { value: 1 } };
        this.puffs = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.puffU,
            vertexShader: /* glsl */ `
uniform float uScale; attribute float aSize; attribute float aAlpha; attribute float aKind;
varying float vA; varying float vK;
void main() { vA = aAlpha; vK = aKind; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: /* glsl */ `
uniform sampler2D uMap; uniform float uLight; varying float vA; varying float vK;
void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    if (vK > 0.5) gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * t.a * vA * 2.0, t.a * vA);
    else gl_FragColor = vec4(vec3(0.75, 0.74, 0.72) * uLight, t.a * vA * 0.35);
}`,
            transparent: true, depthWrite: false,
        }));
        this.puffs.frustumCulled = false;
        this.scene.add(this.puffs);
        this.emitT = 0;
    }

    _emit(kind, at, dir) {
        const p = this.puff.find((q) => q.life <= 0);
        if (!p) return;
        p.kind = kind;
        p.p.copy(at);
        if (kind) {
            p.max = 0.8 + Math.random() * 1.2;
            p.v.set((Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6);
            p.s = 0.05 + Math.random() * 0.05;
        } else {
            p.max = 1.6 + Math.random() * 1.4;
            p.v.set((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
            if (dir) p.v.addScaledVector(dir, 1.2);
            p.s = 0.4 + Math.random() * 0.3;
        }
        p.life = p.max;
    }

    /**
     * cam: camera position; feet: the ground under you; light: 0..1 how bright the day is;
     * indoor 0..1; vents [{x,y,z,dir}] and fires [{x,y,z}] near you.
     */
    update(dt, t, cam, feet, light, indoor, scale, vents, fires) {
        this.wind.set(Math.cos(0.5 + Math.sin(t * 0.02) * 0.6), Math.sin(0.5 + Math.sin(t * 0.02) * 0.6) * -1);
        const out = 1 - indoor;
        const u = this.paperU;
        u.uTime.value = t;
        u.uCam.value.copy(cam);
        u.uFeet.value = feet;
        u.uLight.value = 0.25 + light * 0.75;
        u.uAmount.value = out;
        this.papers.visible = out > 0.02;
        this.ashU.uTime.value = t;
        this.ashU.uCam.value.copy(cam);
        this.ashU.uScale.value = scale;
        this.ashU.uColor.value.setScalar(0.18 + light * 0.45);
        this.ashU.uAmount.value = 0.25 + out * 0.75;
        this.moteU.uTime.value = t;
        this.moteU.uCam.value.copy(cam);
        this.moteU.uScale.value = scale;
        this.moteU.uAmount.value = out;
        this.puffU.uScale.value = scale;
        this.puffU.uLight.value = 0.3 + light * 0.7;
        // emitters
        this.emitT -= dt;
        if (this.emitT <= 0) {
            this.emitT = 0.07;
            for (const v of vents) if (Math.random() < 0.35) this._emit(0, _a.set(v.x, v.y, v.z), v.dir);
            for (const f of fires) if (Math.random() < 0.6) this._emit(1, _a.set(f.x + (Math.random() - 0.5) * 0.3, f.y, f.z + (Math.random() - 0.5) * 0.3));
        }
        const g = this.puffs.geometry;
        const pos = g.attributes.position.array, size = g.attributes.aSize.array, alpha = g.attributes.aAlpha.array, kind = g.attributes.aKind.array;
        this.puff.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= dt;
                p.p.addScaledVector(p.v, dt);
                if (!p.kind) p.v.multiplyScalar(1 - dt * 0.6);
                const k = 1 - p.life / p.max;
                pos[i * 3] = p.p.x;
                pos[i * 3 + 1] = p.p.y;
                pos[i * 3 + 2] = p.p.z;
                size[i] = p.kind ? p.s : p.s * (1 + k * 3);
                alpha[i] = p.kind ? (1 - k) : Math.sin(k * Math.PI) * 0.9;
                kind[i] = p.kind;
            } else alpha[i] = 0;
        });
        g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aKind.needsUpdate = true;
    }
}
const _a = new V3();
