// The sky, the sun and moon, and every light of the scene: a gradient dome with stars and drifting clouds, a shadow-casting key
// light that follows the player, a pool of point lights borrowed by whichever lamps and torches are nearest, and the fog.

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
const mixC = (out, a, b, t) => out.copy(a).lerp(b, t);

const SKY_KEYS = [
    // sun elevation → [zenith, horizon]
    { e: -0.4, top: C(0x142450), hor: C(0x2c3c78) }, { e: -0.1, top: C(0x1c2c64), hor: C(0x5a4a80) }, { e: 0.0, top: C(0x3a4a8a), hor: C(0xff9a5a) },
    { e: 0.18, top: C(0x5a8ad8), hor: C(0xffd0a0) }, { e: 0.6, top: C(0x3a78d8), hor: C(0xa8d4ff) }, { e: 1, top: C(0x2a68d0), hor: C(0xa0d0ff) },
];
const DUSK = { top: C(0x4a3a6a), hor: C(0xc8785a) };   // the Long Dusk: the world's light, before the shards come back

function skyColors(elev, light, outTop, outHor) {
    let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) if (elev >= SKY_KEYS[i].e && elev <= SKY_KEYS[i + 1].e) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    const t = (elev - a.e) / Math.max(1e-4, b.e - a.e);
    outTop.copy(a.top).lerp(b.top, t); outHor.copy(a.hor).lerp(b.hor, t);
    // dim and bruise the day sky while the light is low
    const day = sstep(-0.05, 0.3, elev) * (1 - light);
    outTop.lerp(DUSK.top, day * 0.8); outHor.lerp(DUSK.hor, day * 0.75);
}

export class Sky {
    constructor(scene, quality = 2) {
        this.scene = scene;
        this.top = new THREE.Color(); this.hor = new THREE.Color();
        const geo = new THREE.SphereGeometry(180, 24, 16);
        this.uniforms = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.5 }, uCloudCol: { value: new THREE.Color(1, 1, 1) }, uMoon: { value: new THREE.Vector3(0, -1, 0) } };
        this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uniforms,
            vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
            fragmentShader: `uniform vec3 uTop, uHor, uBot, uSun, uSunCol, uCloudCol, uMoon; uniform float uStars, uTime, uCloud; varying vec3 vD;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += n(p) * a; p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD);
  float y = d.y;
  vec3 c = y > 0.0 ? mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(uHor, uBot, clamp(-y * 3.0, 0.0, 1.0));
  float sd = max(dot(d, normalize(uSun)), 0.0);
  c += uSunCol * (pow(sd, 700.0) * 3.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12);
  float md = max(dot(d, normalize(uMoon)), 0.0);
  c += vec3(0.8, 0.85, 1.0) * pow(md, 900.0) * 2.0 * uStars + vec3(0.4, 0.5, 0.8) * pow(md, 30.0) * 0.1 * uStars;
  if (y > 0.02) {
    vec2 sp = d.xz / (d.y + 0.25) * 6.0;
    float st = step(0.985, h(floor(sp * 16.0))) * uStars * smoothstep(0.1, 0.4, y);
    c += vec3(st) * (0.6 + 0.4 * sin(uTime * 3.0 + h(floor(sp * 16.0)) * 30.0));
    vec2 cp = d.xz / (d.y + 0.35) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
    float cl = smoothstep(0.52 - uCloud * 0.2, 0.9, fbm(cp));
    cl *= smoothstep(0.02, 0.22, y);
    c = mix(c, uCloudCol * (0.8 + 0.4 * sd) , cl * 0.78);
  }
  gl_FragColor = vec4(c, 1.0);
}`,
        }));
        this.dome.renderOrder = -10; this.dome.frustumCulled = false;
        scene.add(this.dome);
        // lights
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
        this.sun = new THREE.DirectionalLight(0xffffff, 2);
        this.sun.castShadow = true;
        const S = 17; Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 90 });
        this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; this.sun.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
        this.sun.target = new THREE.Object3D();
        scene.add(this.hemi, this.sun, this.sun.target);
        this.points = [];
        for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 1.6); scene.add(l); this.points.push(l); }
        scene.fog = new THREE.Fog(0x88aadd, 30, 90);
        this.night = 0; this.sunMul = 1; this.glow = 0.5; this.tint = new THREE.Color(1, 1, 1);
        this.sunVec = new THREE.Vector3(0.4, 0.8, 0.3);
        this.mode = 'sun';
    }

    /** Daylight and the story's light level. kind: 'over' | 'town' for a real sky; dungeons and battles pass a fixed mood. */
    update(dt, st) {
        const { clock, light, px, py, pz, time } = st;
        const u = this.uniforms;
        u.uTime.value = time;
        if (st.fixed) return this.fixedMood(st);
        const ang = clock * Math.PI * 2;
        const elev = Math.sin(ang), az = Math.cos(ang);
        const sunDir = this.sunVec.set(az * 0.9, Math.max(elev, 0.08) * 0.95 + 0.12, 0.35).normalize();
        const dayF = sstep(-0.08, 0.28, elev);
        this.night = 1 - sstep(-0.22, 0.05, elev);
        skyColors(elev, light, this.top, this.hor);
        u.uTop.value.copy(this.top); u.uHor.value.copy(this.hor); u.uBot.value.copy(this.hor).multiplyScalar(0.5);
        u.uSun.value.set(az * 0.9, elev, 0.35).normalize(); u.uMoon.value.set(-az * 0.9, -elev, -0.35).normalize();
        u.uStars.value = this.night; u.uSunCol.value.set(1, 0.85, 0.6).multiplyScalar(sstep(-0.1, 0.1, elev));
        u.uCloud.value = 0.4 + (1 - light) * 0.4; u.uCloudCol.value.set(1, 1, 1).lerp(new THREE.Color(1, 0.7, 0.6), (1 - light) * 0.5 + (1 - dayF) * 0.4).multiplyScalar(0.55 + dayF * 0.45);
        // key light: warm sun, orange at the edges of the day, blue moon at night
        const low = 1 - sstep(0.0, 0.4, elev);
        const key = new THREE.Color(1, 0.96, 0.86).lerp(new THREE.Color(1, 0.55, 0.28), low * dayF).lerp(new THREE.Color(0.45, 0.6, 1), this.night);
        const lm = 0.4 + light * 0.6;
        this.sun.color.copy(key);
        this.sun.intensity = lerp(0.9, 2.7, dayF) * lm;
        const lightDir = this.night > 0.5 ? new THREE.Vector3(-az * 0.6, 0.8, -0.3).normalize() : sunDir;
        this.sun.position.set(px + lightDir.x * 40, py + lightDir.y * 40, pz + lightDir.z * 40);
        this.sun.target.position.set(px, py, pz);
        this.hemi.color.copy(this.hor).lerp(new THREE.Color(0xcfe0ff), 0.45).multiplyScalar(1);
        this.hemi.groundColor.set(0x6a5a44).lerp(new THREE.Color(0x3a3a68), this.night);
        this.hemi.intensity = lerp(0.55, 1.05, dayF) * (0.7 + light * 0.3);
        this.scene.fog.color.copy(this.hor).lerp(this.top, 0.2);
        this.sunMul = lerp(0.5, 1, dayF) * (0.7 + 0.3 * light);
        this.glow = lerp(0.5, 1.9, this.night);
        this.tint.copy(this.hor).lerp(new THREE.Color(1, 1, 1), 0.6);
        this.dome.position.set(px, py, pz);
        this.grade = { warm: low * dayF * 0.5, dusk: (1 - light), night: this.night };
        this.sun.castShadow = true;
    }

    /** Indoor mood: no sun, a coloured ambient and the colour of the dark. */
    fixedMood(st) {
        const f = st.fixed, u = this.uniforms;
        u.uTop.value.set(f.top ?? f.fog); u.uHor.value.set(f.hor ?? f.fog); u.uBot.value.set(f.fog);
        u.uStars.value = f.stars ?? 0; u.uSunCol.value.set(0, 0, 0); u.uCloud.value = f.cloud ?? 0;
        this.sun.intensity = f.sun ?? 0; this.sun.color.set(f.sunColor ?? 0xffffff);
        if (f.sun) { this.sun.position.set(st.px + (f.sunDir?.[0] ?? 0.5) * 40, st.py + (f.sunDir?.[1] ?? 0.9) * 40, st.pz + (f.sunDir?.[2] ?? 0.4) * 40); this.sun.target.position.set(st.px, st.py, st.pz); }
        this.hemi.color.set(f.ambient); this.hemi.groundColor.set(f.ground ?? 0x201818); this.hemi.intensity = f.ambientI ?? 0.9;
        this.scene.fog.color.set(f.fog); this.scene.fog.near = f.fogNear ?? 14; this.scene.fog.far = f.fogFar ?? 48;
        this.dome.position.set(st.px, st.py, st.pz);
        this.night = f.night ?? 1; this.sunMul = f.sunMul ?? 0.6; this.glow = f.glow ?? 1.7; this.tint.set(f.tint ?? 0xffffff);
        this.grade = { warm: f.warm ?? 0, dusk: 0, night: 0 };
        this.sun.castShadow = !!f.shadow;
    }

    /** Hand the nearest lamps and torches to the point-light pool. */
    assignLights(lights, px, py, pz, time, nightF, always = false) {
        const cand = [];
        for (const l of lights) {
            const d = Math.hypot(l.x - px, l.y - pz);
            if (d > 16) continue;
            cand.push([d, l]);
        }
        cand.sort((a, b) => a[0] - b[0]);
        for (let i = 0; i < this.points.length; i++) {
            const pl = this.points[i], c = cand[i];
            if (!c) { pl.intensity = 0; continue; }
            const [d, l] = c;
            const on = l.night ? (always ? 1 : nightF) : 1;
            const flick = l.flicker ? 0.86 + 0.14 * Math.sin(time * 11 + l.x * 3.1) * Math.sin(time * 7.3 + l.y) : 1;
            pl.position.set(l.x, py * 0 + (l.gy ?? 0) + l.z, l.y);
            pl.color.set(l.color);
            pl.distance = l.r * 1.25; pl.decay = 1.5;
            pl.intensity = l.intensity * on * flick * (1 - sstep(l.r * 0.9, l.r * 1.4, d)) * 2.2;
        }
    }
}
