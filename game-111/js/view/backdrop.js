// Behind the lattice: a nebula that regains its colour as the arcana are rekindled, a field of
// stars that wakes with it, slow rings of runes, and the wheel of the 22 cards around the board.

import * as THREE from 'three';
import { paintCard, paintBack, CARD_W, CARD_H } from './cardart.js';
import { makeRng } from '../rng.js';

const NEBULA_VS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NEBULA_FS = /* glsl */`
    uniform float uTime, uRestore, uPulse;
    uniform vec3 uHue;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    void main() {
        vec2 p = (vUv - 0.5) * vec2(3.2, 2.2);
        float t = uTime * 0.015;
        vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        float n = fbm(p * 1.4 + q * 1.6 + t * 0.5);
        float m = fbm(p * 2.6 - q + 3.0);
        // the dead world: ash and bruise; the restored one: magenta, cyan and gold
        vec3 ash = mix(vec3(0.020, 0.016, 0.030), vec3(0.075, 0.050, 0.095), n);
        vec3 a = vec3(0.55, 0.06, 0.45), b = vec3(0.03, 0.35, 0.55), c = vec3(0.65, 0.42, 0.10);
        vec3 alive = mix(a, b, smoothstep(0.3, 0.7, q.x));
        alive = mix(alive, c, smoothstep(0.62, 0.85, m) * 0.6);
        alive = mix(alive, uHue, 0.25);
        alive *= pow(clamp(n, 0.0, 1.0), 2.2) * 1.4;
        vec3 col = mix(ash, alive, clamp(uRestore * 0.85 + 0.12, 0.0, 1.0));
        col *= 1.0 + uPulse * 0.6;
        float vign = smoothstep(1.25, 0.2, length((vUv - 0.5) * vec2(1.6, 1.2)));
        gl_FragColor = vec4(col * vign, 1.0);
    }`;

const STAR_VS = /* glsl */`
    attribute float aSize, aPhase, aWake;
    uniform float uTime, uRestore, uPixel;
    varying float vA;
    varying vec3 vCol;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float awake = step(aWake, uRestore);
        float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aPhase) + aPhase * 30.0);
        vA = mix(0.18, 1.0, awake) * tw;
        vCol = mix(vec3(0.6, 0.6, 0.75), mix(vec3(1.0, 0.7, 1.0), vec3(0.6, 1.0, 1.0), fract(aPhase * 7.0)), awake);
        gl_PointSize = aSize * uPixel * mix(0.7, 1.4, awake) * 40.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
    }`;
const STAR_FS = /* glsl */`
    varying float vA;
    varying vec3 vCol;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = smoothstep(0.5, 0.0, d);
        float cross = smoothstep(0.06, 0.0, abs(c.x)) + smoothstep(0.06, 0.0, abs(c.y));
        float a = (core * core + cross * core * 0.6) * vA;
        gl_FragColor = vec4(vCol * a * 1.6, a);
    }`;

/** A ring of runes painted on a canvas: the texture for the slow wheels behind the board. */
function runeRingTexture(seed) {
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const rng = makeRng(seed);
    g.translate(S / 2, S / 2);
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    ring(500, 3); ring(470, 1.5); ring(380, 2); ring(360, 1);
    const n = 36;
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        g.save();
        g.rotate(a);
        g.translate(0, -420);
        g.lineWidth = 2.5;
        g.beginPath();
        // a little rune: a stave with two or three random strokes
        g.moveTo(0, -22); g.lineTo(0, 22);
        for (let s = 0; s < 2 + Math.floor(rng() * 2); s++) {
            const y = -18 + rng() * 36, dir = rng() < 0.5 ? -1 : 1;
            g.moveTo(0, y); g.lineTo(dir * (8 + rng() * 10), y + (rng() - 0.5) * 22);
        }
        g.stroke();
        g.restore();
        g.save(); g.rotate(a + Math.PI / n); g.lineWidth = 2; g.beginPath(); g.moveTo(0, -500); g.lineTo(0, -470); g.stroke(); g.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class Backdrop {
    constructor(scene, board) {
        this.scene = scene;
        this.restore = 0;          // 0..1, how much of the world is rekindled (the view eases it)
        this.target = 0;
        this.pulse = 0;

        this.nebulaU = { uTime: { value: 0 }, uRestore: { value: 0 }, uPulse: { value: 0 }, uHue: { value: new THREE.Color(0.5, 0.2, 0.8) } };
        this.nebula = new THREE.Mesh(
            new THREE.PlaneGeometry(260, 180),
            new THREE.ShaderMaterial({ uniforms: this.nebulaU, vertexShader: NEBULA_VS, fragmentShader: NEBULA_FS, depthWrite: false }),
        );
        this.nebula.position.z = -90;
        this.nebula.renderOrder = -10;
        scene.add(this.nebula);

        // stars: each wakes at its own restore fraction
        const count = 1400;
        const rng = makeRng(77);
        const pos = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count), wake = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (rng() - 0.5) * 200;
            pos[i * 3 + 1] = (rng() - 0.5) * 140;
            pos[i * 3 + 2] = -30 - rng() * 55;
            size[i] = 0.6 + rng() * rng() * 2.6;
            phase[i] = rng();
            wake[i] = rng() * 0.98;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        sg.setAttribute('aWake', new THREE.BufferAttribute(wake, 1));
        this.starU = { uTime: { value: 0 }, uRestore: { value: 0 }, uPixel: { value: 1 } };
        this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
            uniforms: this.starU, vertexShader: STAR_VS, fragmentShader: STAR_FS,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        scene.add(this.stars);

        // rune rings behind the board, in its own (tilted) space
        this.rings = [];
        const ringDefs = [[13.5, 0x9b6bff, 0.035, 11], [10.2, 0x38e8ff, -0.05, 23], [17.5, 0xff4fd8, 0.02, 41]];
        for (const [r, col, speed, seed] of ringDefs) {
            const m = new THREE.Mesh(
                new THREE.PlaneGeometry(r * 2, r * 2),
                new THREE.MeshBasicMaterial({ map: runeRingTexture(seed), color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
            );
            m.position.z = -2.5 - this.rings.length * 1.5;
            m.userData = { speed, base: 0.18 };
            board.add(m);
            this.rings.push(m);
        }

        // the wheel of the Major Arcana, all around the board
        this.cards = [];
        this.cardGeo = new THREE.PlaneGeometry(1.5, 2.5);
        this.backTex = this.texture((g) => paintBack(g, CARD_W / 2, CARD_H / 2), CARD_W / 2, CARD_H / 2);
        this.wheel = new THREE.Group();
        this.wheel.position.z = -6;
        board.add(this.wheel);
        for (let i = 0; i < 22; i++) {
            const mat = new THREE.MeshBasicMaterial({ map: this.backTex, transparent: true, depthWrite: false, color: 0x777777 });
            const m = new THREE.Mesh(this.cardGeo, mat);
            m.userData = { i, lit: null, pulse: 0 };
            this.wheel.add(m);
            this.cards.push(m);
        }
        this.texCache = new Map();
        this.wheelR = 13;
        this.placeWheel(13, 1);
    }

    /** A CanvasTexture from a painter. */
    texture(paint, w, h) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        paint(cv.getContext('2d'));
        const t = new THREE.CanvasTexture(cv);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    }
    cardTexture(i, lit) {
        const k = `${i}:${lit}`;
        if (!this.texCache.has(k)) this.texCache.set(k, this.texture((g) => paintCard(g, i, CARD_W / 2, CARD_H / 2, { lit }), CARD_W / 2, CARD_H / 2));
        return this.texCache.get(k);
    }
    /** Fonts arrived: repaint every card. */
    repaint() {
        for (const t of this.texCache.values()) t.dispose();
        this.texCache.clear();
        for (const c of this.cards) c.userData.lit = null;
    }

    /** Lay the 22 cards on an ellipse of radii rx × ry around the board centre. */
    placeWheel(rx, ry) {
        this.cards.forEach((m, i) => {
            const a = Math.PI / 2 - (i / 22) * Math.PI * 2;      // The Fool at the top, then clockwise
            m.position.set(Math.cos(a) * rx, Math.sin(a) * ry, 0);
            m.rotation.z = a - Math.PI / 2;
            m.userData.home = m.position.clone();
        });
    }

    /** Where card i sits in the board's space (for the rekindling flight). */
    cardHome(i, out) {
        const c = this.cards[i];
        out.copy(c.userData.home).add(this.wheel.position);
        return out;
    }

    /** restored: a Set of arcanum indices; current: the arcanum being worked toward (or -1). */
    update(dt, time, restored, current, resonance, hue) {
        this.restore += (this.target - this.restore) * Math.min(1, dt * 1.5);
        this.pulse = Math.max(0, this.pulse - dt * 1.6);
        this.nebulaU.uTime.value = time;
        this.nebulaU.uRestore.value = this.restore;
        this.nebulaU.uPulse.value = this.pulse;
        this.nebulaU.uHue.value.setHSL(hue, 0.9, 0.45);
        this.starU.uTime.value = time;
        this.starU.uRestore.value = this.restore;
        this.starU.uPixel.value = Math.min(window.devicePixelRatio || 1, 2);
        this.rings.forEach((m, k) => {
            m.rotation.z += m.userData.speed * dt * (1 + resonance * 0.6);
            m.material.opacity = m.userData.base + resonance * 0.05 + this.pulse * 0.25 + this.restore * 0.12 + (k === 1 ? 0.04 : 0);
        });
        this.wheel.rotation.z = Math.sin(time * 0.05) * 0.03;
        for (const m of this.cards) {
            const i = m.userData.i;
            const lit = restored.has(i);
            if (m.userData.lit !== lit) {
                m.userData.lit = lit;
                m.material.map = this.cardTexture(i, lit);
                m.material.needsUpdate = true;
            }
            const cur = i === current;
            const glow = lit ? 1.25 : cur ? 0.75 + 0.25 * Math.sin(time * 3) : 0.42;
            m.material.color.setScalar(glow + m.userData.pulse);
            m.userData.pulse = Math.max(0, m.userData.pulse - dt * 1.2);
            const s = cur ? 1.12 + 0.04 * Math.sin(time * 3) : 1;
            m.scale.setScalar(s);
        }
    }
}
