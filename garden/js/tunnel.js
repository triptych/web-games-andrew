// The long tunnel between the two stations. The train stands still in the
// world and the line is carried past it: a ring of twelve-metre segments is
// recycled around the train, each dressed by where along the line it sits
// (white tile, old brick, raw rock with glowing veins, then aurora glass), with
// ghost stations, a cavern viaduct, other trains rushing by and a shaft of light
// from a ventilation well. The walls are one shader, so none of it needs lights.

import * as THREE from 'three';
import { TUNNEL, tunnelProfile, sweep, signCanvas, TRACK2_X } from './subway-parts.js';
import { rng, smoothstep, TAU } from './util.js';

export const SEG = 12;
const COUNT = 28;

const WALL_VERT = /* glsl */ `
uniform float uZ0;
varying vec3 vP; varying vec3 vN; varying float vDepth;
void main() {
    vP = vec3(position.x, position.y, position.z + uZ0);
    vN = normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;

const WALL_FRAG = /* glsl */ `
uniform vec4 uW;          // weights: tile, brick, rock, aurora
uniform vec3 uLamp;
uniform float uLampOn;
uniform float uTime;
uniform float uOpen;
uniform float uGlow;
uniform float uPulse;
varying vec3 vP; varying vec3 vN; varying float vDepth;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
vec3 pal(float t) { return 0.55 + 0.45 * cos(6.28318 * (vec3(1.0, 1.0, 1.0) * t + vec3(0.0, 0.33, 0.67))); }

vec3 wallColor(vec3 p) {
    float u = p.z, v = p.y;
    // tile: pale ceramic below a violet stripe, concrete above
    vec3 tile;
    {
        vec2 c = vec2(u / 0.3 + step(0.5, fract(v / 0.3)) * 0.5, v / 0.15);
        vec2 f = fract(c);
        float grout = (step(f.x, 0.06) + step(f.y, 0.08)) * (1.0 - smoothstep(10.0, 40.0, vDepth));
        float lum = 0.78 + 0.18 * hash(floor(c));
        vec3 t = mix(vec3(lum, lum * 0.97, lum * 0.88), vec3(0.32, 0.3, 0.28), clamp(grout, 0.0, 1.0));
        vec3 conc = vec3(0.34, 0.33, 0.34) * (0.7 + 0.5 * fbm(vec2(u, v) * 1.7));
        tile = v < 1.7 ? t : (v < 1.95 ? vec3(0.38, 0.22, 0.75) : conc);
        // cable trays high up
        float tray = (1.0 - smoothstep(0.0, 0.03, abs(v - 3.4))) + (1.0 - smoothstep(0.0, 0.03, abs(v - 3.0)));
        tile = mix(tile, vec3(0.05), tray);
        tile *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.7, abs(fract(u / 3.0) - 0.5)));
    }
    // brick: staggered courses and lighter arch ribs every six metres
    vec3 brick;
    {
        float row = floor(v / 0.075);
        vec2 c = vec2(u / 0.23 + mod(row, 2.0) * 0.5, v / 0.075);
        vec2 f = fract(c);
        float mortar = (step(f.x, 0.06) + step(f.y, 0.12)) * (1.0 - smoothstep(10.0, 45.0, vDepth));
        float h = hash(floor(c));
        vec3 b = mix(vec3(0.46, 0.2, 0.14), vec3(0.62, 0.34, 0.2), h) * (0.75 + 0.5 * fbm(c * 0.5));
        brick = mix(b, vec3(0.22, 0.19, 0.17), clamp(mortar, 0.0, 1.0));
        float rib = 1.0 - smoothstep(0.3, 0.35, abs(fract(u / 6.0) - 0.5) * 6.0 - 2.5);
        brick = mix(brick, vec3(0.55, 0.5, 0.46), rib * 0.8);
        brick *= 0.8 + 0.2 * smoothstep(0.0, 1.0, fbm(vec2(u * 0.4, v * 1.2)));
        // damp streaks
        brick *= 1.0 - 0.35 * smoothstep(0.55, 0.9, fbm(vec2(u * 0.9, v * 0.12 - 3.0)));
    }
    // rock with luminous veins
    vec3 rock;
    {
        float n = fbm(vec2(u, v) * 0.55);
        float m = fbm(vec2(u * 1.7, v * 1.7) + 9.0);
        rock = mix(vec3(0.08, 0.075, 0.09), vec3(0.3, 0.26, 0.24), n) * (0.6 + 0.8 * m);
        float vein = 1.0 - abs(2.0 * fbm(vec2(u * 0.35 + 4.0, v * 0.35)) - 1.0);
        float glowv = pow(smoothstep(0.86, 0.99, vein), 2.0);
        float pulse = 0.65 + 0.35 * sin(uTime * 1.3 + u * 0.15);
        rock += vec3(0.1, 0.8, 0.95) * glowv * uGlow * pulse * 2.2;
    }
    // aurora glass: dark with slow ribbons of colour
    vec3 aur;
    {
        float w = fbm(vec2(u * 0.12, v * 0.4) + uTime * 0.04);
        float ribbon = sin(u * 0.35 + v * 1.4 + w * 6.0 + uTime * 0.6);
        float band = smoothstep(0.2, 1.0, ribbon);
        aur = vec3(0.02, 0.015, 0.05) + pal(w + u * 0.01 + uTime * 0.03) * band * 0.55 * (0.5 + uGlow);
        aur += pal(v * 0.2 + uTime * 0.05) * 0.04;
        float glass = 1.0 - smoothstep(0.0, 0.02, abs(fract(u / 2.0) - 0.5) - 0.48);
        aur += vec3(0.5, 0.7, 1.0) * glass * 0.35;
    }
    return tile * uW.x + brick * uW.y + rock * uW.z + aur * uW.w;
}

void main() {
    vec3 n = normalize(vN);
    bool floorP = n.y > 0.7;
    bool isCeil = n.y < -0.7;
    if (uOpen > 0.5 && !floorP && vP.y > -0.9) discard;
    vec3 col;
    float ambient = 0.2;
    if (floorP) {
        // ballast, two tracks of sleepers and rails
        vec3 g = vec3(0.16, 0.15, 0.14) * (0.5 + fbm(vP.xz * 2.5));
        for (int i = 0; i < 2; i++) {
            float cx = i == 0 ? 0.0 : ${TRACK2_X.toFixed(1)};
            float dx = abs(vP.x - cx);
            if (dx < 1.35) {
                float s = step(fract(vP.z / 0.7), 0.3);
                g = mix(g, vec3(0.2, 0.15, 0.12), s * step(dx, 1.25));
                float rail = 1.0 - smoothstep(0.03, 0.06, abs(dx - 0.72));
                g = mix(g, vec3(0.75, 0.78, 0.85), rail);
                g = mix(g, vec3(0.05), 1.0 - smoothstep(0.03, 0.06, abs(dx - 1.25)));
            }
        }
        col = g;
        ambient = 0.3;
    } else if (isCeil) {
        col = wallColor(vec3(vP.x, 3.0 + abs(vP.x - 2.25) * 0.3, vP.z)) * 0.7;
    } else {
        // unfold the wall: height up it, distance along the line
        float h = vP.y;
        if (vP.y > 2.2) h = 2.2 + (vP.y - 2.2) * 1.6;
        col = wallColor(vec3(vP.x, h, vP.z));
    }
    // the lamps: one every twelve metres on each wall, plus a faint pool from the train's windows
    float lz = abs(fract(vP.z / ${SEG.toFixed(1)} + 0.5) - 0.5) * ${SEG.toFixed(1)};
    float lit = 0.0;
    for (int s = 0; s < 2; s++) {
        float lx = s == 0 ? ${(TUNNEL.cx - TUNNEL.hw + 0.1).toFixed(2)} : ${(TUNNEL.cx + TUNNEL.hw - 0.1).toFixed(2)};
        vec3 d = vec3(vP.x - lx, vP.y - 3.0, lz);
        lit += 1.0 / (1.0 + dot(d, d) * 0.06);
    }
    lit = lit * uLampOn;
    vec3 lamp = uLamp * lit * (0.5 + 0.5 * uPulse);
    col = col * (ambient * 0.35 + lamp * 1.9);
    col += uLamp * 0.03 * uW.w * lit * 4.0;
    // fog towards the dark
    float fog = 1.0 - exp(-vDepth * 0.017);
    col = mix(col, vec3(0.004, 0.004, 0.01), fog);
    gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- the zones

/** Which style of tunnel lies at fraction f of the line (weights sum to one). */
function zoneWeights(f, out) {
    const tile = 1 - smoothstep(0.26, 0.32, f);
    const brick = smoothstep(0.24, 0.3, f) * (1 - smoothstep(0.42, 0.47, f));
    const rock = smoothstep(0.4, 0.46, f) * (1 - smoothstep(0.58, 0.64, f));
    const aur = smoothstep(0.56, 0.64, f);
    const s = tile + brick + rock + aur || 1;
    out.set(tile / s, brick / s, rock / s, aur / s);
    return out;
}

const CAVERN = [0.465, 0.535];

/** The line's stations as fractions of its length: the two ends and the ghost halts between. */
export const GHOSTS = [
    { f: 0.12, name: 'MOONWELL', sub: 'closed · mind the damp' },
    { f: 0.31, name: 'OLD ORCHARD', sub: 'trains do not stop' },
    { f: 0.585, name: 'NEVER STREET', sub: 'no service' },
];

// ---------------------------------------------------------------- the tunnel

export class Tunnel {
    /**
     * @param {number} D length of the line in metres (a multiple of SEG)
     * @param {object} mats subway materials (for the props)
     * @param {number} hideA,hideB   half-widths (in segments) to hide around each station
     */
    constructor(D, mats, hideSegs) {
        this.D = D;
        this.mats = mats;
        this.hideSegs = hideSegs;
        this.group = new THREE.Group();
        this.time = 0;
        this.pulse = 1;
        this.geo = sweep(tunnelProfile(), -SEG / 2, SEG / 2, [TUNNEL.cx, 1.0], { zSteps: 1 });
        this.segs = [];
        this.tmpW = new THREE.Vector4();
        this.lampGeo = new THREE.BoxGeometry(0.12, 0.5, 0.9);
        this.glowTex = null;
        for (let i = 0; i < COUNT; i++) this.segs.push(this._makeSeg(i));
        this._props();
        this._cavern();
        this.k0 = null;
    }

    _makeSeg(slot) {
        const mat = new THREE.ShaderMaterial({
            vertexShader: WALL_VERT,
            fragmentShader: WALL_FRAG,
            uniforms: {
                uZ0: { value: 0 },
                uW: { value: new THREE.Vector4(1, 0, 0, 0) },
                uLamp: { value: new THREE.Color(0.8, 0.95, 1) },
                uLampOn: { value: 1 },
                uTime: { value: 0 },
                uOpen: { value: 0 },
                uGlow: { value: 0 },
                uPulse: { value: 1 },
            },
        });
        const g = new THREE.Group();
        const wall = new THREE.Mesh(this.geo, mat);
        wall.frustumCulled = false;
        g.add(wall);
        // lamp fixtures on both walls, signal posts and numbered plates
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        const lamps = [];
        for (const x of [TUNNEL.cx - TUNNEL.hw + 0.12, TUNNEL.cx + TUNNEL.hw - 0.12]) {
            const l = new THREE.Mesh(this.lampGeo, lampMat);
            l.position.set(x, 3.0, 0);
            g.add(l);
            lamps.push(l);
        }
        const signal = new THREE.Group();
        const sig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.3), this.mats.black);
        sig.position.set(0, 0, 0);
        const red = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), new THREE.MeshBasicMaterial({ color: 0xff2a20, toneMapped: false }));
        red.position.set(0.07, 0.17, 0);
        red.rotation.y = Math.PI / 2;
        const grn = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), new THREE.MeshBasicMaterial({ color: 0x30ff70, toneMapped: false }));
        grn.position.set(0.07, -0.12, 0);
        grn.rotation.y = Math.PI / 2;
        signal.add(sig, red, grn);
        signal.position.set(TUNNEL.cx - TUNNEL.hw + 0.4, 2.2, 3);
        signal.userData = { red, grn };
        g.add(signal);
        // central colonnade for the brick section
        const cols = new THREE.Group();
        for (const z of [-3, 3]) {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.6, 10), this.mats.concrete);
            c.position.set(TUNNEL.cx, 1.3, z);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), this.mats.steel);
            cap.position.set(TUNNEL.cx, 3.65, z);
            cols.add(c, cap);
        }
        g.add(cols);
        // vent shaft light (an additive cone from the ceiling)
        const vent = new THREE.Mesh(
            new THREE.ConeGeometry(1.8, 6, 20, 1, true).translate(0, -3, 0),
            new THREE.MeshBasicMaterial({ color: 0xbfd9ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }),
        );
        vent.position.set(TUNNEL.cx, 4.8, 0);
        vent.visible = false;
        g.add(vent);
        this.group.add(g);
        return { g, wall, mat, lamps, lampMat, signal, cols, vent, k: null, slot };
    }

    /** Fixed props along the line: ghost-station platforms and their signs. */
    _props() {
        const m = this.mats;
        this.props = new THREE.Group();
        this.group.add(this.props);
        for (const gh of GHOSTS) {
            const z = Math.round((gh.f * this.D) / SEG) * SEG;
            const g = new THREE.Group();
            g.position.z = z;
            const left = TUNNEL.cx - TUNNEL.hw;
            // a platform slab along the left wall, with the tactile strip and the tile skirt
            const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 40), m.platform);
            slab.position.set(left + 0.75, -0.5, 0);
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 40), m.tactile);
            strip.position.set(left + 1.4, 0.015, 0);
            g.add(slab, strip);
            for (const cz of [-14, -4, 6, 16]) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 4.4, 8), m.concrete);
                col.position.set(left + 1.1, 2.2, cz);
                g.add(col);
            }
            const tex = new THREE.CanvasTexture(signCanvas(gh.name, gh.sub, { bg: '#17171f', fg: '#c9c4b0', accent: '#7a7a8a' }));
            tex.colorSpace = THREE.SRGBColorSpace;
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xaaaaaa }));
            sign.position.set(left + 0.03, 2.4, 0);
            sign.rotation.y = Math.PI / 2;
            const sign2 = sign.clone();
            sign2.position.z = -15;
            const sign3 = sign.clone();
            sign3.position.z = 15;
            g.add(sign, sign2, sign3);
            // a bench, a dim flickering lamp and a lone figure
            const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 2), m.wood);
            bench.position.set(left + 0.9, 0.5, 3);
            g.add(bench);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
            lamp.position.set(left + 1.0, 4.0, 0);
            g.add(lamp);
            gh.lamp = lamp;
            gh.group = g;
            gh.z = z;
            this.props.add(g);
        }
    }

    /** Glowing lantern-dust that fills the cavern; positions are wrapped around the train in the vertex shader. */
    _cavern() {
        const n = 5200, r = rng('cavern');
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, rad = 8 + Math.pow(r(), 0.6) * 150;
            pos[i * 3] = Math.cos(a) * rad + 2;
            pos[i * 3 + 1] = Math.sin(a) * rad * 0.8 + 10 - 8 * r();
            pos[i * 3 + 2] = r() * 400;
            c.setHSL(0.45 + r() * 0.5, 0.8, 0.6);
            col.set([c.r, c.g, c.b], i * 3);
            size[i] = 0.6 + r() * 2.6;
            phase[i] = r() * TAU;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        this.cavernUniforms = { uScroll: { value: 0 }, uAmount: { value: 0 }, uTime: { value: 0 }, uScale: { value: 600 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.cavernUniforms,
            vertexShader: /* glsl */ `
            uniform float uScroll, uTime, uScale, uAmount;
            attribute vec3 aColor; attribute float aSize, aPhase;
            varying vec3 vColor;
            void main() {
                vec3 p = position;
                p.z = mod(p.z - uScroll, 400.0) - 200.0;
                p.y += sin(uTime * 0.3 + aPhase) * 0.8;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 22.0);
                vColor = aColor * uAmount * (0.6 + 0.4 * sin(uTime * 1.6 + aPhase));
            }`,
            fragmentShader: /* glsl */ `
            varying vec3 vColor;
            void main() {
                float r = length(gl_PointCoord - 0.5) * 2.0;
                float a = pow(max(0.0, 1.0 - r), 2.0);
                gl_FragColor = vec4(vColor * a, a);
            }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.cavern = new THREE.Points(g, mat);
        this.cavern.frustumCulled = false;
        this.cavern.visible = false;
        // lives in world space, not in the scrolling line
        this.cavernOwner = this.cavern;
    }

    /** Tint, weights and variants for the segment holding index k. */
    _dress(s, k, time) {
        const z = k * SEG, f = THREE.MathUtils.clamp(z / this.D, 0, 1);
        const u = s.mat.uniforms;
        u.uZ0.value = z;
        zoneWeights(f, this.tmpW);
        u.uW.value.copy(this.tmpW);
        s.g.position.z = z;
        const [a, b] = this.hideSegs;
        s.g.visible = !(Math.abs(k) <= a || Math.abs(k - this.D / SEG) <= b);
        const r = rng('seg' + k);
        const w = this.tmpW;
        // lamp colour and whether this lamp is lit: cool white, sodium, sparse amber, then drifting hues
        const lamp = u.uLamp.value;
        lamp.setRGB(0.8, 0.95, 1.0).multiplyScalar(w.x);
        lamp.r += 1.0 * w.y; lamp.g += 0.55 * w.y; lamp.b += 0.2 * w.y;
        lamp.r += 0.8 * w.z; lamp.g += 0.5 * w.z; lamp.b += 0.2 * w.z;
        const hue = (z * 0.0021) % 1;
        const hc = new THREE.Color().setHSL(hue, 0.85, 0.6);
        lamp.r += hc.r * w.w; lamp.g += hc.g * w.w; lamp.b += hc.b * w.w;
        let on = 1;
        if (w.z > 0.5) on = r() < 0.35 ? 1 : 0.15;
        // a stretch of broken lamps in the old brick section
        if (w.y > 0.5 && r() < 0.18) on = 0.25;
        u.uLampOn.value = on;
        u.uGlow.value = w.z * 0.9 + w.w * 0.9;
        s.lampMat.color.copy(lamp).multiplyScalar(on > 0.5 ? 2.2 : 0.35);
        // cavern: no walls, only the floor deck
        const inCavern = f > CAVERN[0] && f < CAVERN[1];
        u.uOpen.value = inCavern ? 1 : 0;
        for (const l of s.lamps) l.visible = !inCavern;
        s.signal.visible = !inCavern && r() < 0.14;
        s.signal.userData.red.visible = r() < 0.5;
        s.signal.userData.grn.visible = !s.signal.userData.red.visible;
        s.cols.visible = w.y > 0.45 && !inCavern;
        s.vent.visible = !inCavern && (k % 23 === 0) && w.z + w.y > 0.3;
        s.k = k;
    }

    /**
     * @param {number} zTrain  the train's position along the line, in metres
     * @param {number} time    seconds
     * @param {number} speed   metres per second (for the strobing of the vents)
     */
    update(zTrain, time, speed, camera) {
        this.time = time;
        const kc = Math.round(zTrain / SEG);
        const lo = kc - Math.floor(COUNT / 2);
        for (let k = lo; k < lo + COUNT; k++) {
            const slot = ((k % COUNT) + COUNT) % COUNT;
            const s = this.segs[slot];
            if (s.k !== k) this._dress(s, k, time);
        }
        const f = zTrain / this.D;
        // pulse that quickens as the aurora deepens
        this.pulse = 1 + 0.5 * Math.sin(time * (1 + 3 * smoothstep(0.6, 1, f)));
        for (const s of this.segs) {
            const u = s.mat.uniforms;
            u.uTime.value = time;
            u.uPulse.value = 1 + (this.pulse - 1) * (u.uW.value.w + 0.2);
        }
        // ghost-station lamps flicker
        for (const gh of GHOSTS) gh.lamp.visible = Math.sin(time * 17 + gh.f * 40) + Math.sin(time * 5.3 + gh.f) > -1.3;
        // cavern dust follows the train and is visible only around the cavern
        const mid = (CAVERN[0] + CAVERN[1]) / 2 * this.D, half = (CAVERN[1] - CAVERN[0]) / 2 * this.D;
        const amount = 1 - smoothstep(half * 0.7, half + 160, Math.abs(zTrain - mid));
        const cu = this.cavernUniforms;
        cu.uAmount.value = amount;
        cu.uScroll.value = zTrain;
        cu.uTime.value = time;
        this.cavern.visible = amount > 0.01;
        if (camera) cu.uScale.value = 700;
        return { f, cavern: amount, zone: zoneWeights(f, new THREE.Vector4()) };
    }
}

// ---------------------------------------------------------------- other trains

/** An express going the other way on the second track: a dark body, lit windows, a headlamp. */
export class PassingTrain {
    constructor(mats) {
        this.group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.3, 46), new THREE.MeshStandardMaterial({ color: 0x1a1d29, roughness: 0.5, metalness: 0.4 }));
        body.position.y = 1.65;
        this.group.add(body);
        const win = new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false });
        for (let z = -20; z <= 20; z += 2.2) {
            for (const s of [-1, 1]) {
                const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), win);
                w.position.set(s * 1.41, 2.1, z);
                w.rotation.y = s * Math.PI / 2;
                this.group.add(w);
            }
        }
        for (const s of [-1, 1]) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.18, 46.1), new THREE.MeshBasicMaterial({ color: 0xff5fa8, toneMapped: false }));
            stripe.position.y = 0.9;
            this.group.add(stripe);
            break;
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
        head.position.set(0, 1.0, 23.1);
        this.group.add(head);
        const tail = head.clone();
        tail.material = new THREE.MeshBasicMaterial({ color: 0xff2a20, toneMapped: false });
        tail.position.z = -23.1;
        this.group.add(tail);
        this.light = new THREE.PointLight(0xfff0d0, 0, 22, 1.8);
        this.group.add(this.light);
        this.group.visible = false;
        this.active = false;
    }
}
