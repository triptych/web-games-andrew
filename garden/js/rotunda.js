// The Spectrum Rotunda: a round room at the far end of Prism Halt. A mosaic
// floor, a ring of marble pillars, a dome of slow aurora and, in the middle, a
// huge pool of swirling colour and light that answers when you touch the air
// above it. Built around its own centre; the caller places the group.

import * as THREE from 'three';
import { glowSprite } from './textures.js';
import { rng, TAU, smoothstep } from './util.js';

export const ROT = { R: 24, wallH: 9, pool: 9.6, coping: 11, cx: -44 };

const CORRIDOR = { x0: -22.2, x1: -8.5, half: 2.1 };

const POOL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec4 uRip[8];       // x, z (local to the pool), start time, strength
uniform vec2 uPlayer;
uniform float uPlayerNear;
varying vec2 vXZ; varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(3.1, 1.7); a *= 0.5; } return s; }
vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
vec2 swirl(vec2 p, float t, float k) {
    float r = length(p);
    float a = atan(p.y, p.x) + k * (1.15 - r) * (1.15 - r) * 3.2 + t * (0.35 + (1.0 - r) * 0.9);
    return vec2(cos(a), sin(a)) * r;
}
void main() {
    vec2 p = vXZ / ${ROT.pool.toFixed(1)};        // -1..1 across the pool
    float r = length(p);
    if (r > 1.0) discard;
    float t = uTime;
    // ripples: rings that travel outward from where the air was touched
    float rip = 0.0; vec2 push = vec2(0.0);
    for (int i = 0; i < 8; i++) {
        vec4 q = uRip[i];
        float age = t - q.z;
        if (q.w > 0.0 && age > 0.0 && age < 7.0) {
            vec2 d = vXZ - q.xy;
            float dist = length(d);
            float front = age * 4.2;
            float w = sin((dist - front) * 2.4) * exp(-abs(dist - front) * 0.55) * exp(-age * 0.55) * q.w;
            rip += w;
            push += normalize(d + 1e-4) * w * 0.05;
        }
    }
    // the player's own wake along the rim
    float pd = length(vXZ - uPlayer);
    rip += uPlayerNear * sin(pd * 3.0 - t * 5.0) * exp(-pd * 0.7) * 0.5;
    p += push;
    // two layers at different "depths", the lower one drifting the other way
    vec2 s1 = swirl(p, t, 1.0);
    vec2 s2 = swirl(p * 1.15, -t * 0.7 + 3.0, -0.6);
    float n1 = fbm(s1 * 3.2 + vec2(t * 0.05, 0.0));
    float n2 = fbm(s2 * 5.0 + n1 * 2.0 - t * 0.04);
    float n3 = fbm(s1 * 9.0 + n2 * 3.0 + t * 0.1);
    vec3 deep = pal(n2 * 0.9 + r * 0.45 + t * 0.03) * (0.25 + 0.9 * n1);
    vec3 top  = pal(n1 + n3 * 0.5 - t * 0.04 + 0.35) * (0.4 + n3);
    vec3 col = mix(deep, top, smoothstep(0.3, 0.8, n3));
    // glowing filaments and travelling bands of light
    float fil = pow(1.0 - abs(2.0 * fbm(s1 * 4.0 + n1 * 3.0) - 1.0), 7.0);
    col += pal(n1 * 2.0 + t * 0.06) * fil * 1.4;
    float band = pow(0.5 + 0.5 * sin(r * 26.0 - t * 1.8 + n1 * 6.0), 6.0);
    col += pal(r + t * 0.1 + 0.5) * band * 0.7 * (1.0 - r * 0.5);
    // the bright eye of the whirlpool
    float eye = exp(-r * r * 22.0);
    col = mix(col, vec3(1.0, 0.92, 1.0) * 1.5, eye * 0.5);
    col += pal(t * 0.2) * exp(-r * r * 5.0) * 0.5;
    // glitter
    vec2 g = floor(s1 * 70.0);
    float tw = step(0.985, hash(g)) * (0.5 + 0.5 * sin(t * 4.0 + hash(g + 4.0) * 30.0));
    col += vec3(1.0) * tw * 0.9;
    col += vec3(0.7, 0.85, 1.0) * rip * 0.6;
    // rim glow and a darker soft edge so the water meets the stone
    float rim = smoothstep(0.82, 1.0, r);
    col += pal(t * 0.1 + r) * rim * 0.9;
    col *= 1.0 - smoothstep(0.985, 1.0, r) * 0.7;
    gl_FragColor = vec4(col * 0.8, 1.0);
}`;

const POINTS_VERT = /* glsl */ `
uniform float uTime; uniform float uScale;
attribute vec4 aSeed;     // radius, phase, speed, kind
attribute float aHue;
varying vec3 vColor;
vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
void main() {
    float kind = aSeed.w;
    vec3 p;
    float a = aSeed.y + uTime * aSeed.z;
    float tw = 0.6 + 0.4 * sin(uTime * 3.0 + aSeed.y * 9.0);
    float size;
    if (kind < 0.5) {
        // swimmers: bright beads circling just above the water
        float rad = aSeed.x * ${ROT.pool.toFixed(1)} * (0.92 + 0.06 * sin(uTime * 0.7 + aSeed.y * 5.0));
        p = vec3(cos(a) * rad, 0.5 + 0.1 * sin(uTime * 2.0 + aSeed.y * 7.0), sin(a) * rad);
        size = 1.6;
    } else {
        // risers: motes that spiral up out of the pool toward the oculus
        float life = fract(aSeed.y * 0.159 + uTime * 0.045 * (0.5 + aSeed.z));
        float h = life * ${(ROT.wallH + 11).toFixed(1)};
        float rad = aSeed.x * ${ROT.pool.toFixed(1)} * (1.0 - life * 0.7);
        float ang = aSeed.y + life * 6.0 * aSeed.z + uTime * 0.4;
        p = vec3(cos(ang) * rad, 0.5 + h, sin(ang) * rad);
        tw *= smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.75, 1.0, life));
        size = 1.0 + aSeed.x;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 26.0);
    vColor = pal(aHue + uTime * 0.05) * tw * (kind < 0.5 ? 1.1 : 0.55);
}`;

const POINTS_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - r), 2.0);
    gl_FragColor = vec4(vColor * a, a);
}`;

const DOME_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.05; a *= 0.5; } return s; }
vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec2 uv = vec2(atan(d.x, d.z) * 1.4, acos(clamp(d.y, -1.0, 1.0)) * 3.0);
    // ribbons of aurora wheeling around the oculus
    float w = fbm(uv * 0.7 + vec2(uTime * 0.03, 0.0));
    float rib = sin(uv.x * 3.0 + uv.y * 4.0 + w * 7.0 - uTime * 0.5);
    float band = smoothstep(0.1, 1.0, rib) * (0.4 + 0.6 * h);
    vec3 col = vec3(0.012, 0.01, 0.04) + pal(w * 1.2 + uTime * 0.02 + uv.y * 0.08) * band * 0.5;
    // constellations: a sprinkle of stars
    vec2 sg = floor(uv * vec2(40.0, 26.0));
    float star = step(0.975, hash(sg)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(sg + 3.0) * 20.0));
    col += vec3(1.0, 0.95, 0.85) * star * 0.9;
    // the pool's light reflecting up the dome in wide rings
    float ring = pow(0.5 + 0.5 * sin(acos(clamp(d.y, -1.0, 1.0)) * 18.0 - uTime * 1.2), 5.0);
    col += pal(uTime * 0.07 + h) * ring * (1.0 - h) * 0.5;
    // the oculus: a white-hot eye at the top
    col += vec3(1.0, 0.9, 1.0) * smoothstep(0.93, 1.0, d.y) * 2.2;
    gl_FragColor = vec4(col, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
void main() {
    float u = vUv.x, v = vUv.y;
    float streak = noise(vec2(u * 14.0, v * 2.0 - uTime * 0.8)) * noise(vec2(u * 6.0 + 4.0, v * 0.7 - uTime * 0.35));
    float edge = sin(u * 3.14159);
    float a = streak * edge * (1.0 - smoothstep(0.0, 1.0, v)) * 1.4 + 0.05 * edge * (1.0 - v);
    gl_FragColor = vec4(pal(v * 0.6 + uTime * 0.06) * a * 0.55, a * 0.6);
}`;

/** A radial mosaic for the floor, painted once. */
function floorCanvas() {
    const n = 1024, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d'), h = n / 2;
    const r = rng('rotunda-floor');
    const grad = x.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, '#1d1740');
    grad.addColorStop(1, '#0c0a22');
    x.fillStyle = grad;
    x.fillRect(0, 0, n, n);
    const px = n / (ROT.R * 2);   // pixels per metre
    // rings of small tesserae
    for (let ring = 10; ring < 24; ring += 0.55) {
        const rad = ring * px, hue = (ring * 21) % 360;
        const count = Math.floor((TAU * rad) / (0.5 * px));
        for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU;
            const alt = (Math.floor(ring / 0.55) + i) % 2;
            x.fillStyle = `hsl(${hue + (alt ? 20 : 0)},${55 + r() * 20}%,${alt ? 26 + r() * 10 : 14 + r() * 8}%)`;
            x.save();
            x.translate(h + Math.cos(a) * rad, h + Math.sin(a) * rad);
            x.rotate(a);
            x.fillRect(-0.2 * px, -0.22 * px, 0.4 * px, 0.4 * px);
            x.restore();
        }
    }
    // gold lines and a star of spokes
    x.strokeStyle = '#d9b46a';
    for (const rad of [11.4, 13.5, 17, 21, 23.2]) {
        x.lineWidth = rad === 17 ? 5 : 3;
        x.beginPath();
        x.arc(h, h, rad * px, 0, TAU);
        x.stroke();
    }
    x.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        x.beginPath();
        x.moveTo(h + Math.cos(a) * 11.6 * px, h + Math.sin(a) * 11.6 * px);
        x.lineTo(h + Math.cos(a) * 17 * px, h + Math.sin(a) * 17 * px);
        x.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU, cxp = h + Math.cos(a) * 15 * px, cyp = h + Math.sin(a) * 15 * px;
        x.fillStyle = `hsl(${i * 45},80%,60%)`;
        x.beginPath();
        for (let k = 0; k < 8; k++) {
            const aa = (k / 8) * TAU + a, rr = k % 2 ? 0.5 * px : 1.2 * px;
            x[k ? 'lineTo' : 'moveTo'](cxp + Math.cos(aa) * rr, cyp + Math.sin(aa) * rr);
        }
        x.closePath();
        x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

export class Rotunda {
    constructor(mats) {
        this.group = new THREE.Group();
        this.colliders = [];
        this.u = { uTime: { value: 0 } };
        this.cx = ROT.cx;
        const g = this.group;
        const { R, wallH, pool, coping } = ROT;
        const C = new THREE.Group();     // everything round hangs off the rotunda's centre
        C.position.set(ROT.cx, 0, 0);
        g.add(C);
        this.centre = C;

        // floor
        const tex = floorCanvas();
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(R, 96),
            new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.28, roughness: 0.28, metalness: 0.1 }),
        );
        floor.rotation.x = -Math.PI / 2;
        C.add(floor);

        // wall: a drum of mosaic stone with the entrance left open (x+ side, theta = pi/2)
        const gap = 0.13;
        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(R, R, wallH, 96, 1, true, Math.PI / 2 + gap, TAU - gap * 2),
            new THREE.MeshStandardMaterial({ color: 0x2a2150, roughness: 0.55, metalness: 0.15, side: THREE.BackSide, emissive: 0x150f33, emissiveIntensity: 0.8 }),
        );
        wall.position.y = wallH / 2;
        C.add(wall);

        // pillars with capitals, a double cornice that glows, and niches between with a small light each
        const pil = new THREE.Group();
        const marble = mats.marble;
        const pillarGeo = new THREE.CylinderGeometry(0.46, 0.54, wallH, 16);
        const capGeo = new THREE.BoxGeometry(1.5, 0.35, 1.5);
        const baseGeo = new THREE.CylinderGeometry(0.75, 0.8, 0.4, 16);
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * TAU;
            if (Math.abs(a - Math.PI / 2) < 0.2) continue;
            const x = Math.sin(a) * (R - 1.0), z = Math.cos(a) * (R - 1.0);
            const p = new THREE.Mesh(pillarGeo, marble);
            p.position.set(x, wallH / 2, z);
            const cap = new THREE.Mesh(capGeo, marble);
            cap.position.set(x, wallH - 0.1, z);
            cap.rotation.y = a;
            const base = new THREE.Mesh(baseGeo, marble);
            base.position.set(x, 0.2, z);
            pil.add(p, cap, base);
            this.colliders.push({ x: ROT.cx + x, z, r: 0.8 });
            // a niche lamp on the wall behind
            const nx = Math.sin(a + TAU / 48) * (R - 0.15), nz = Math.cos(a + TAU / 48) * (R - 0.15);
            const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: new THREE.Color().setHSL(i / 24, 0.8, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
            lamp.scale.set(2.2, 2.2, 1);
            lamp.position.set(nx, 3.2, nz);
            pil.add(lamp);
            (this.nicheLamps ??= []).push(lamp);
        }
        C.add(pil);
        this.cornice = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.5 });
        for (const [rad, y, th] of [[R - 0.5, wallH + 0.05, 0.16], [R - 0.9, wallH - 0.5, 0.07]]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, th, 8, 120), this.cornice);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            C.add(ring);
        }

        // the dome, with an aurora shader on its inside
        const domeMat = new THREE.ShaderMaterial({
            uniforms: this.u,
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: DOME_FRAG,
            side: THREE.BackSide,
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.2, 64, 32, 0, TAU, 0, Math.PI / 2).scale(1, 0.7, 1), domeMat);
        dome.position.y = wallH;
        C.add(dome);

        // the pool: a raised marble coping, the water, and a column of light
        const lathe = new THREE.LatheGeometry([new THREE.Vector2(pool, 0), new THREE.Vector2(pool, 0.55), new THREE.Vector2(coping, 0.55), new THREE.Vector2(coping, 0), new THREE.Vector2(coping + 0.6, 0), new THREE.Vector2(coping + 0.6, 0.2), new THREE.Vector2(coping, 0.2)], 96);
        const rim = new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ color: 0xd8d2e8, roughness: 0.3, metalness: 0.1 }));
        C.add(rim);
        const inlay = new THREE.Mesh(new THREE.TorusGeometry((pool + coping) / 2, 0.06, 6, 120), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd890, emissiveIntensity: 1.0 }));
        inlay.rotation.x = Math.PI / 2;
        inlay.position.y = 0.56;
        C.add(inlay);
        this.rippleData = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0));
        this.playerVec = new THREE.Vector2(100, 100);
        this.waterUniforms = { uTime: this.u.uTime, uRip: { value: this.rippleData }, uPlayer: { value: this.playerVec }, uPlayerNear: { value: 0 } };
        const water = new THREE.Mesh(
            new THREE.CircleGeometry(pool, 96).rotateX(-Math.PI / 2),
            new THREE.ShaderMaterial({
                uniforms: this.waterUniforms,
                vertexShader: 'varying vec2 vXZ; varying vec3 vWorld; void main(){ vXZ = position.xz; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
                fragmentShader: POOL_FRAG,
            }),
        );
        water.position.y = 0.34;
        water.userData.kind = 'pool';
        C.add(water);
        this.water = water;
        // pick target a little above the water so a click on the air over it also counts
        this.poolHit = water;

        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(3.4, 6.2, wallH + 9, 40, 1, true).translate(0, (wallH + 9) / 2, 0),
            new THREE.ShaderMaterial({
                uniforms: this.u,
                vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
                fragmentShader: BEAM_FRAG,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            }),
        );
        beam.position.y = 0.4;
        // vUv.y runs 0 at the bottom; flip so the beam is brightest low and fades up
        C.add(beam);

        // lights beads and rising motes
        const n = 1500, r = rng('pool-points');
        const seed = new Float32Array(n * 4), hue = new Float32Array(n), pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const kind = i < 180 ? 0 : 1;
            seed.set([kind ? Math.sqrt(r()) * 0.95 : 0.15 + r() * 0.8, r() * TAU, (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.5) / (kind ? 1 : 0.4 + (r()) * 1.0), kind], i * 4);
            hue[i] = r();
        }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
        pg.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
        this.pointUniforms = { uTime: this.u.uTime, uScale: { value: 700 } };
        const pts = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: this.pointUniforms, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pts.frustumCulled = false;
        C.add(pts);

        // eight crystal obelisks around the pool, each pulsing its own colour, and lanterns drifting overhead
        this.obelisks = [];
        const crystalGeo = new THREE.OctahedronGeometry(1, 0).scale(0.55, 2.4, 0.55);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + TAU / 16;
            const x = Math.sin(a) * 16, z = Math.cos(a) * 16;
            const mat = new THREE.MeshStandardMaterial({ color: 0x222233, emissive: new THREE.Color().setHSL(i / 8, 0.9, 0.55), emissiveIntensity: 1.8, roughness: 0.1, metalness: 0.2, flatShading: true });
            const cr = new THREE.Mesh(crystalGeo, mat);
            cr.position.set(x, 3.4, z);
            const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 8), marble);
            plinth.position.set(x, 0.45, z);
            const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: mat.emissive, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
            halo.scale.set(6, 8, 1);
            halo.position.set(x, 3.4, z);
            C.add(plinth, cr, halo);
            this.obelisks.push({ cr, mat, halo, a, base: 3.4 });
            this.colliders.push({ x: ROT.cx + x, z, r: 1.1 });
        }
        this.lanterns = [];
        const rl = rng('lanterns');
        for (let i = 0; i < 16; i++) {
            const col = new THREE.Color().setHSL(rl(), 0.85, 0.65);
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }));
            s.scale.set(1.5, 1.5, 1);
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
            const grp = new THREE.Group();
            grp.add(s, core);
            C.add(grp);
            this.lanterns.push({ grp, rad: 6 + rl() * 13, h: 3 + rl() * 5.5, w: (0.05 + rl() * 0.09) * (rl() < 0.5 ? -1 : 1), a: rl() * TAU, ph: rl() * TAU, sprite: s, col });
        }

        // benches in eight arcs at the edge
        const benchGeo = new THREE.CylinderGeometry(19.8, 19.8, 0.5, 8, 1, false, 0, 0.3).translate(0, 0.25, 0);
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a2d6a, roughness: 0.7 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + TAU / 16;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(19.3, 0.32, 6, 10, 0.34).rotateX(Math.PI / 2), benchMat);
            ring.position.y = 0.45;
            ring.rotation.y = a - 0.17;
            C.add(ring);
            for (let k = 0; k < 4; k++) {
                const aa = a + (k - 1.5) * 0.085;
                this.colliders.push({ x: ROT.cx + Math.sin(aa) * 19.3, z: Math.cos(aa) * 19.3, r: 0.7 });
            }
        }
        void benchGeo;

        // the way in: a corridor of glowing mosaic from the platform
        const cor = new THREE.Group();
        const L = CORRIDOR.x1 - CORRIDOR.x0, mid = (CORRIDOR.x0 + CORRIDOR.x1) / 2, w = CORRIDOR.half * 2 + 0.9;
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x241b4a, roughness: 0.5, metalness: 0.15, emissive: 0x120c30, emissiveIntensity: 1 });
        const floorM = new THREE.MeshStandardMaterial({ color: 0x1a1438, roughness: 0.3 });
        const f = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 0.3, w), floorM);
        f.position.set(mid - ROT.cx, -0.15, 0);
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 0.4, w + 0.4), wallMat);
        ceil.position.set(mid - ROT.cx, 4.4, 0);
        cor.add(f, ceil);
        for (const s of [-1, 1]) {
            const wl = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 4.6, 0.4), wallMat);
            wl.position.set(mid - ROT.cx, 2.2, s * (w / 2 + 0.2));
            cor.add(wl);
        }
        this.corridorStrips = [];
        for (let x = CORRIDOR.x0 + 1; x < CORRIDOR.x1 - 0.5; x += 1.6) {
            const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color().setHSL(((x - CORRIDOR.x0) / L) * 0.9, 0.9, 0.6), emissiveIntensity: 2.2 });
            for (const s of [-1, 1]) {
                const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.08), m);
                strip.position.set(x - ROT.cx, 1.8, s * (CORRIDOR.half + 0.4));
                cor.add(strip);
            }
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 3.6), m);
            top.position.set(x - ROT.cx, 4.15, 0);
            cor.add(top);
            const floorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.1), m);
            floorStrip.position.set(x - ROT.cx, 0.01, 0);
            cor.add(floorStrip);
            this.corridorStrips.push({ m, x });
        }
        C.add(cor);
        this.corridor = cor;
        // the plaque at the mouth of the rotunda
        const plc = document.createElement('canvas');
        plc.width = 1024;
        plc.height = 256;
        const px = plc.getContext('2d');
        px.fillStyle = '#17123a';
        px.fillRect(0, 0, 1024, 256);
        px.strokeStyle = '#d9b46a';
        px.lineWidth = 8;
        px.strokeRect(14, 14, 996, 228);
        px.fillStyle = '#fff3d6';
        px.textAlign = 'center';
        px.font = '700 76px Georgia, serif';
        px.fillText('The Spectrum Rotunda', 512, 120);
        px.fillStyle = '#9fe9ff';
        px.font = '600 34px system-ui, sans-serif';
        px.fillText('Look, listen, and touch the air above the water.', 512, 188);
        const pt = new THREE.CanvasTexture(plc);
        pt.colorSpace = THREE.SRGBColorSpace;
        const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: pt, toneMapped: false }));
        plaque.position.set(CORRIDOR.x1 - 1.2 - ROT.cx, 3.2, -CORRIDOR.half - 0.18);
        plaque.rotation.y = 0;
        cor.add(plaque);

        this.lightColors = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
        this.age = 0;
    }

    /** Whether (x, z) — world x, z relative to the station's centre line — is floor you can stand on. */
    walkable(x, z) {
        if (x >= CORRIDOR.x0 && x <= CORRIDOR.x1 && Math.abs(z) < CORRIDOR.half) return true;
        const d = Math.hypot(x - ROT.cx, z);
        return d > ROT.coping + 0.9 && d < ROT.R - 2.0;
    }

    /** Is the point in the round room proper, not the corridor? */
    inside(x, z) {
        return Math.hypot(x - ROT.cx, z) < ROT.R - 1;
    }

    /** Touch the water at world (x, z): a ring spreads out from there. */
    ripple(x, z, t, strength = 1) {
        const i = this.rippleIdx = ((this.rippleIdx ?? -1) + 1) % 8;
        this.rippleData[i].set(x - ROT.cx, z, t, strength);
    }

    /** Colours of the four pooled lights this frame. */
    update(dt, t, localX, localZ) {
        this.age += dt;
        this.u.uTime.value = t;
        const near = Math.hypot(localX - ROT.cx, localZ);
        this.waterUniforms.uPlayerNear.value = near < ROT.coping + 3.5 ? 1 : 0;
        this.playerVec.set(localX - ROT.cx, localZ);
        for (const o of this.obelisks) {
            const k = 0.5 + 0.5 * Math.sin(t * 1.4 + o.a * 2);
            o.mat.emissive.setHSL(((o.a / TAU) + t * 0.04) % 1, 0.9, 0.55);
            o.mat.emissiveIntensity = 1.2 + k * 1.8;
            o.cr.position.y = o.base + Math.sin(t * 0.8 + o.a) * 0.25;
            o.cr.rotation.y = t * 0.3 + o.a;
            o.halo.material.color.copy(o.mat.emissive);
            o.halo.position.y = o.cr.position.y;
            o.halo.material.opacity = 0.2 + 0.2 * k;
        }
        for (const l of this.lanterns) {
            l.a += l.w * dt;
            l.grp.position.set(Math.cos(l.a) * l.rad, l.h + Math.sin(t * 0.6 + l.ph) * 0.7, Math.sin(l.a) * l.rad);
            l.sprite.material.opacity = 0.45 + 0.2 * Math.sin(t * 2 + l.ph);
        }
        this.nicheLamps.forEach((s, i) => s.material.color.setHSL(((i / 24) + t * 0.03) % 1, 0.8, 0.6));
        this.cornice.emissive.setHSL((t * 0.05) % 1, 0.9, 0.55);
        for (const s of this.corridorStrips) s.m.emissive.setHSL((((s.x - CORRIDOR.x0) / 13.7) * 0.9 + t * 0.06) % 1, 0.9, 0.6);
        for (let i = 0; i < 4; i++) this.lightColors[i].setHSL(((t * 0.05 + i * 0.25) % 1), 0.9, 0.58);
        return this.lightColors;
    }
}

export { smoothstep };
