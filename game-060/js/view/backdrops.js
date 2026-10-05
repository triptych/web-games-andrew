// Backdrops, drawn into the same 240×320 target behind the playfield so they come
// out as chunky dithered pixels. Each sector has its own; everything is kept dark
// (under the bloom threshold) so the game pops in front.
//
// A plane at depth z (negative = away) fills the screen when it is
// W·(CAM_DIST − z)/CAM_DIST wide; `fill(z)` makes one.

import * as THREE from 'three';
import { CAM_DIST } from './renderer.js';
import { W, H } from '../config.js';

const span = (z) => (CAM_DIST - z) / CAM_DIST;

const COMMON = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
float b2(vec2 p){ float x = mod(p.x, 2.0), y = mod(p.y, 2.0); return 2.0 * abs(x - y) + y; }
float bayer(vec2 fc){ vec2 p = floor(fc); return (4.0 * b2(p) + b2(floor(p / 2.0))) / 16.0; }
vec3 posterize(vec3 c, float levels, vec2 fc){ return floor(c * levels + bayer(fc)) / levels; }
`;

const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function quad(z, fs, uniforms) {
    const s = span(z);
    const geo = new THREE.PlaneGeometry(W * s * 1.08, H * s * 1.08);
    const mat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: COMMON + fs, uniforms, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(W / 2, H / 2, z);
    m.renderOrder = -10;
    return m;
}

// ------------------------------------------------------------------ starfield
function starLayer(n, z, speed, size, tint) {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = 0; seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const s = span(z);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSpeed: { value: speed }, uSpan: { value: new THREE.Vector2(W * s * 1.1, H * s * 1.1) }, uZ: { value: z }, uTint: { value: new THREE.Color(...tint) }, uWarp: { value: 0 } },
        vertexShader: `attribute float seed; uniform float uT, uSpeed, uZ, uWarp; uniform vec2 uSpan; varying float vB;
            void main(){ float y = fract(position.y - uT * uSpeed * (1.0 + uWarp * 14.0));
              vec3 p = vec3(${(W / 2).toFixed(1)} + (position.x - 0.5) * uSpan.x, ${(H / 2).toFixed(1)} + (y - 0.5) * uSpan.y, uZ);
              vB = 0.45 + 0.55 * abs(sin(uT * (1.5 + seed * 4.0) + seed * 40.0));
              gl_PointSize = ${size.toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `uniform vec3 uTint; varying float vB; void main(){ gl_FragColor = vec4(uTint * vB, 1.0); }`,
        depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = -5;
    return pts;
}

// ------------------------------------------------------------------ sector skies
const SKY = {
    moon: `uniform float uT; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy;
        vec3 c = mix(vec3(0.0, 0.01, 0.04), vec3(0.02, 0.03, 0.09), vUv.y);
        gl_FragColor = vec4(posterize(c, 24.0, fc), 1.0); }`,
    nebula: `uniform float uT; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy; vec2 p = vUv * vec2(3.0, 4.0);
        float n = fbm(p + vec2(uT * 0.02, -uT * 0.035));
        float m = fbm(p * 1.7 - vec2(uT * 0.03, uT * 0.01) + n);
        vec3 c = vec3(0.01, 0.0, 0.03);
        c += vec3(0.32, 0.04, 0.26) * smoothstep(0.45, 0.85, n) ;
        c += vec3(0.06, 0.08, 0.30) * smoothstep(0.5, 0.9, m);
        c += vec3(0.28, 0.12, 0.30) * pow(smoothstep(0.62, 0.95, n * m * 1.6), 2.0);
        gl_FragColor = vec4(posterize(c * 0.85, 10.0, fc), 1.0); }`,
    asteroids: `uniform float uT; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy;
        float d = fbm(vUv * vec2(2.0, 3.0) + vec2(uT * 0.01, -uT * 0.02));
        vec3 c = mix(vec3(0.02, 0.01, 0.02), vec3(0.07, 0.04, 0.03), d * vUv.y);
        c += vec3(0.10, 0.05, 0.02) * smoothstep(0.55, 0.85, d) * 0.6;
        gl_FragColor = vec4(posterize(c, 14.0, fc), 1.0); }`,
    synth: `uniform float uT; uniform float uBeat; uniform float uDim; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy; vec2 uv = vUv;
        float hz = 0.36;
        vec3 c;
        if (uv.y > hz) {
          float k = (uv.y - hz) / (1.0 - hz);
          c = mix(vec3(0.30, 0.05, 0.22), vec3(0.03, 0.0, 0.10), pow(k, 0.6));
          vec2 sc = vec2(0.5, hz + 0.16);
          vec2 d = (uv - sc) * vec2(1.0, 1.33);
          float r = length(d);
          if (r < 0.2) {
            float band = step(0.5, fract((uv.y - hz) * 38.0 - uT * 0.4)) + step(0.13, uv.y - hz);
            vec3 sun = mix(vec3(0.95, 0.25, 0.45), vec3(1.0, 0.82, 0.25), clamp((uv.y - hz) / 0.36, 0.0, 1.0));
            if (band > 0.5) c = sun * (0.82 + 0.18 * uBeat);
          }
          c += vec3(0.25, 0.05, 0.2) * smoothstep(0.32, 0.2, r) * 0.35;
          float mtn = hz + 0.05 + 0.07 * fbm(vec2(uv.x * 5.0, 1.0)) - 0.02;
          if (uv.y < mtn) c = vec3(0.06, 0.0, 0.10) + vec3(0.18, 0.0, 0.18) * step(mtn - 0.006, uv.y);
        } else {
          float k = (hz - uv.y) / hz;
          float z = 1.0 / (k + 0.04);
          float gx = abs(fract((uv.x - 0.5) * z * 2.4) - 0.5);
          float gy = abs(fract(z * 0.6 + uT * 1.2) - 0.5);
          float line = max(smoothstep(0.46, 0.5, 0.5 - gx + 0.46) , 0.0);
          float lx = 1.0 - smoothstep(0.0, 0.06 * z * 0.3 + 0.03, gx);
          float ly = 1.0 - smoothstep(0.0, 0.05, gy);
          c = vec3(0.04, 0.0, 0.07);
          c += vec3(0.85, 0.12, 0.75) * max(lx, ly) * (0.35 + 0.65 * (1.0 - k)) * (0.75 + 0.25 * uBeat);
        }
        gl_FragColor = vec4(posterize(c * 0.62 * uDim, 10.0, fc), 1.0); }`,
    hive: `uniform float uT; uniform float uBeat; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy; vec2 d = vUv - 0.5; d.y *= 1.33;
        float r = length(d), a = atan(d.y, d.x);
        float tun = 1.0 / (r + 0.05);
        float v = fbm(vec2(a * 3.0, tun * 0.8 - uT * 1.4));
        vec3 c = vec3(0.02, 0.0, 0.01) + vec3(0.16, 0.02, 0.04) * smoothstep(0.5, 0.85, v) * smoothstep(0.0, 0.45, r);
        c += vec3(0.2, 0.03, 0.05) * uBeat * smoothstep(0.35, 0.6, r) * 0.4;
        c *= smoothstep(0.02, 0.25, r);
        gl_FragColor = vec4(posterize(c, 12.0, fc), 1.0); }`,
    warp: `uniform float uT; varying vec2 vUv;
      void main(){ vec2 fc = gl_FragCoord.xy; vec2 d = vUv - 0.5; d.y *= 1.33;
        float r = length(d), a = atan(d.y, d.x);
        float s = step(0.92, hash(vec2(floor(a * 40.0), 0.0)));
        float streak = s * step(0.5, fract(r * 3.0 - uT * 2.5 + hash(vec2(floor(a * 40.0), 3.0))));
        vec3 hue = 0.5 + 0.5 * cos(6.28 * (a / 6.28 + uT * 0.1 + vec3(0.0, 0.33, 0.67)));
        vec3 c = vec3(0.02, 0.0, 0.05) + hue * streak * smoothstep(0.05, 0.5, r) * 0.55;
        gl_FragColor = vec4(posterize(c, 10.0, fc), 1.0); }`,
};

// ------------------------------------------------------------------ 3D pieces
function earth() {
    const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: COMMON + `uniform float uT; varying vec3 vN; varying vec3 vP;
          void main(){ vec2 fc = gl_FragCoord.xy;
            float lon = atan(vP.z, vP.x) + uT * 0.05, lat = vP.y;
            float land = fbm(vec2(lon * 2.0, lat * 3.0) + 3.0);
            vec3 c = land > 0.52 ? mix(vec3(0.10, 0.35, 0.10), vec3(0.45, 0.40, 0.20), smoothstep(0.6, 0.75, land)) : vec3(0.05, 0.15, 0.45);
            float cloud = smoothstep(0.55, 0.75, fbm(vec2(lon * 3.0 + uT * 0.02, lat * 5.0)));
            c = mix(c, vec3(0.8), cloud * 0.7);
            float l = clamp(dot(vN, normalize(vec3(-0.6, 0.4, 0.7))), 0.0, 1.0);
            c *= 0.08 + 0.9 * l;
            float rim = pow(1.0 - abs(vN.z), 3.0);
            c += vec3(0.15, 0.35, 0.9) * rim * 0.6;
            gl_FragColor = vec4(posterize(c * 0.7, 10.0, fc), 1.0); }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
    m.scale.setScalar(26);
    return m;
}

function moonGround() {
    const z = -120;
    const s = span(z);
    const R = 520;
    const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: COMMON + `uniform float uT; varying vec2 vP;
          void main(){ vec2 fc = gl_FragCoord.xy; vec2 p = vP / ${R.toFixed(1)};
            float r = length(p);
            vec2 q = p * 9.0 + vec2(uT * 0.04, 0.0);
            float n = fbm(q);
            vec2 cell = floor(q * 1.3); vec2 f = fract(q * 1.3) - 0.5;
            float h = hash(cell);
            float crater = h > 0.6 ? smoothstep(0.32, 0.22, length(f)) - smoothstep(0.22, 0.1, length(f + vec2(0.06, -0.06))) * 0.7 : 0.0;
            vec3 c = vec3(0.12, 0.12, 0.15) * (0.6 + 0.6 * n) + vec3(0.05) * crater;
            c *= 0.5 + 0.7 * smoothstep(0.7, 1.0, r);
            c += vec3(0.25, 0.28, 0.35) * smoothstep(0.985, 1.0, r) * 0.6;
            gl_FragColor = vec4(posterize(c, 10.0, fc), 1.0); }`,
        depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(R, 96), mat);
    m.position.set(W / 2, H / 2 - H * s / 2 - R + 70 * s, z);
    m.renderOrder = -8;
    return m;
}

function rocks() {
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: COMMON + `varying vec3 vW;
          void main(){ vec2 fc = gl_FragCoord.xy; vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
            float l = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0, 1.0);
            vec3 c = vec3(0.30, 0.22, 0.16) * (0.15 + 0.85 * l);
            gl_FragColor = vec4(posterize(c * 0.75, 10.0, fc), 1.0); }`,
    });
    const list = [];
    for (let i = 0; i < 12; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 0);
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.75 + Math.random() * 0.5), p.getY(k) * (0.75 + Math.random() * 0.5), p.getZ(k) * (0.75 + Math.random() * 0.5));
        const m = new THREE.Mesh(geo, mat);
        const z = -250 - Math.random() * 2600;
        const s = span(z);
        m.position.set(W / 2 + (Math.random() - 0.5) * W * s, H / 2 + (Math.random() - 0.5) * H * s, z);
        m.scale.setScalar(10 + Math.random() * 40);
        m.userData = { vx: (Math.random() - 0.5) * 30 * s, vy: -(8 + Math.random() * 20) * s, ax: Math.random() - 0.5, ay: Math.random() - 0.5, span: s };
        g.add(m); list.push(m);
    }
    g.userData.list = list;
    return g;
}

function tunnel() {
    const g = new THREE.Group();
    const list = [];
    for (let i = 0; i < 14; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x601018, transparent: true, opacity: 1, depthWrite: false });
        const m = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 6, 1), mat);
        m.scale.setScalar(260);
        m.position.set(W / 2, H / 2, -200 - i * 230);
        m.rotation.z = i * 0.15;
        m.renderOrder = -7;
        g.add(m); list.push(m);
    }
    g.userData.list = list;
    return g;
}

export class Backdrops {
    constructor(scene) {
        this.scene = scene;
        this.groups = {};
        this.current = null;
        this.stars = [
            starLayer(160, -2600, 0.006, 1, [0.35, 0.38, 0.55]),
            starLayer(90, -900, 0.016, 1, [0.55, 0.55, 0.7]),
            starLayer(40, -150, 0.04, 1, [0.75, 0.75, 0.85]),
        ];
        for (const s of this.stars) scene.add(s);
        this.t = 0;
        this.warp = 0;
    }

    build(name) {
        const g = new THREE.Group();
        const sky = quad(-3600, SKY[name === 'city' ? 'synth' : name] || SKY.moon, { uT: { value: 0 }, uBeat: { value: 0 }, uDim: { value: name === 'city' ? 0.5 : 1 } });
        g.add(sky);
        g.userData.sky = sky;
        if (name === 'moon') {
            const e = earth(); e.position.set(186, 252, -700); g.add(e); g.userData.earth = e;
            g.add(moonGround());
        }
        if (name === 'asteroids') { const r = rocks(); g.add(r); g.userData.rocks = r; }
        if (name === 'hive') { const t = tunnel(); g.add(t); g.userData.tunnel = t; }
        this.scene.add(g);
        return g;
    }

    set(name) {
        if (this.current === name) return;
        for (const [k, g] of Object.entries(this.groups)) g.visible = k === name;
        if (!this.groups[name]) this.groups[name] = this.build(name);
        this.groups[name].visible = true;
        this.current = name;
        this.warp = name === 'warp' ? 1 : 0;
    }

    update(dt, beat = 0) {
        this.t += dt;
        const t = this.t;
        for (const s of this.stars) { s.material.uniforms.uT.value = t; s.material.uniforms.uWarp.value = this.warp; }
        const g = this.groups[this.current];
        if (!g) return;
        const u = g.userData.sky.material.uniforms;
        u.uT.value = t; u.uBeat.value = beat;
        if (g.userData.earth) { g.userData.earth.rotation.y = t * 0.05; g.userData.earth.material.uniforms.uT.value = t; }
        if (g.userData.rocks) {
            for (const m of g.userData.rocks.userData.list) {
                const d = m.userData;
                m.position.x += d.vx * dt; m.position.y += d.vy * dt;
                m.rotation.x += d.ax * dt; m.rotation.y += d.ay * dt;
                const hw = W * d.span * 0.6, hh = H * d.span * 0.6;
                if (m.position.y < H / 2 - hh) m.position.y = H / 2 + hh;
                if (m.position.x < W / 2 - hw) m.position.x = W / 2 + hw;
                if (m.position.x > W / 2 + hw) m.position.x = W / 2 - hw;
            }
        }
        if (g.userData.tunnel) {
            for (const m of g.userData.tunnel.userData.list) {
                m.position.z += 420 * dt;
                if (m.position.z > -60) m.position.z -= 14 * 230;
                const k = Math.min(1, (m.position.z + 3200) / 3000);
                m.material.color.setRGB(0.06 + 0.2 * k + 0.12 * beat * k, 0.01 + 0.02 * k, 0.03 + 0.04 * k);
                m.rotation.z += dt * 0.2;
            }
        }
    }
}
