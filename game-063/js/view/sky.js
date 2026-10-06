// The sky dome (gradient, sun glow, painted cloud bands, stars, an aurora), drifting cloud puffs, a
// ring of distant mountains and, in the Sky Citadel, a sea of cloud below the islands.

import * as THREE from 'three';
import { toonMat, part, merge, sph, cone } from './toon.js';

const skyVS = `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
}`;
const skyFS = `
uniform vec3 uTop, uMid, uHorizon, uGround, uSun, uSunDir;
uniform float uTime, uStars, uAurora, uClouds;
varying vec3 vDir;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += n2(p) * a; p *= 2.07; a *= 0.5; } return s; }
void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = y > 0.0 ? mix(uHorizon, uMid, smoothstep(0.0, 0.25, y)) : mix(uHorizon, uGround, smoothstep(0.0, -0.18, y));
    col = y > 0.25 ? mix(uMid, uTop, smoothstep(0.25, 0.85, y)) : col;
    // sun glow and disc
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSun * (pow(sd, 6.0) * 0.35 + pow(sd, 60.0) * 0.6);
    col = mix(col, uSun * 1.6, smoothstep(0.9985, 0.9992, sd));
    // painted cloud bands
    if (uClouds > 0.0 && y > -0.02) {
        vec2 uv = d.xz / (y + 0.18) * 1.6 + vec2(uTime * 0.008, 0.0);
        float c = fbm(uv * 1.3);
        c = smoothstep(0.55, 0.62, c) * 0.55 + smoothstep(0.62, 0.7, c) * 0.45;
        c *= smoothstep(-0.02, 0.12, y) * uClouds;
        vec3 cc = mix(uHorizon, vec3(1.0), 0.75) + uSun * 0.08;
        col = mix(col, cc, c * 0.85);
    }
    // stars
    if (uStars > 0.0 && y > 0.0) {
        vec2 sp = d.xz / (y + 0.4) * 140.0;
        float st = step(0.985, h21(floor(sp)));
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + h21(floor(sp)) * 40.0);
        col += vec3(st * tw) * uStars * smoothstep(0.05, 0.4, y);
    }
    // aurora ribbons
    if (uAurora > 0.0 && y > 0.05) {
        // wavy curtains along the horizon, with fine vertical rays
        float az = atan(d.x, d.z);
        float h = 0.3 + 0.07 * sin(az * 3.0 + uTime * 0.08) + 0.03 * sin(az * 7.0 - uTime * 0.13);
        float k = y - h;
        float ribbon = smoothstep(-0.01, 0.03, k) * smoothstep(0.24, 0.0, k);
        float rays = 0.55 + 0.45 * sin(az * 70.0 + fbm(vec2(az * 9.0, uTime * 0.12)) * 7.0);
        vec3 ac = mix(vec3(0.25, 1.0, 0.65), vec3(0.7, 0.35, 1.0), smoothstep(0.0, 0.2, k));
        col += ac * ribbon * rays * 0.42 * uAurora * (0.6 + 0.4 * sin(az * 2.0 + uTime * 0.2));
    }
    gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
    constructor(scene) {
        this.scene = scene;
        this.uni = {
            uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
            uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 },
            uStars: { value: 0 }, uAurora: { value: 0 }, uClouds: { value: 1 },
        };
        const geo = new THREE.SphereGeometry(900, 32, 16);
        this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false }));
        this.dome.frustumCulled = false;
        this.dome.renderOrder = -10;
        scene.add(this.dome);
        this.extras = new THREE.Group();
        scene.add(this.extras);
        this.puffs = [];
    }

    apply(P, centre = new THREE.Vector3(), radius = 200, seed = 1) {
        const u = this.uni;
        u.uTop.value.set(P.skyTop); u.uMid.value.set(P.skyMid); u.uHorizon.value.set(P.horizon); u.uGround.value.set(P.ground);
        u.uSun.value.set(P.sun); u.uSunDir.value.set(...P.sunDir).normalize();
        u.uStars.value = P.stars; u.uAurora.value = P.aurora; u.uClouds.value = P.clouds;
        // rebuild mountains and puffs
        for (const c of [...this.extras.children]) { this.extras.remove(c); c.geometry?.dispose(); }
        this.puffs = [];
        let s = seed;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        if (!P.cloudSea) {
            const geos = [];
            const R = radius + 260;
            for (let i = 0; i < 46; i++) {
                const a = (i / 46) * Math.PI * 2 + rnd() * 0.1;
                const h = 50 + rnd() * 110, r = 50 + rnd() * 70;
                const g = cone(r, h, 6);
                g.translate(Math.sin(a) * (R + rnd() * 140), h / 2 - 20, Math.cos(a) * (R + rnd() * 140));
                geos.push(part(g, i % 2 ? P.mountains[0] : P.mountains[1]));
                if (P.key === 'frost' || P.key === 'meadow') {
                    // snow cap: the top 38% of the same cone, a hair larger
                    const cap = cone(r * 0.4, h * 0.38, 6);
                    cap.translate(0, h * 0.81 - 20 + 0.3, 0);
                    const cx = g.attributes.position.getX(0), cz = g.attributes.position.getZ(0);
                    cap.translate(cx, 0, cz);
                    geos.push(part(cap, '#ffffff'));
                }
            }
            const m = new THREE.Mesh(merge(geos), new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
            m.position.copy(centre); m.position.y = Math.min(centre.y, 0) - 4;
            this.extras.add(m);
        } else {
            // a sea of cloud below the islands
            const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2), cloudSeaMat(P));
            sea.position.set(centre.x, -38, centre.z);
            this.extras.add(sea);
            this.sea = sea;
            // distant floating islands
            const geos = [];
            for (let i = 0; i < 18; i++) {
                const a = rnd() * Math.PI * 2, d = radius + 120 + rnd() * 300;
                const r = 10 + rnd() * 26;
                const top = sph(r, 10, 6); top.scale(1, 0.25, 1); top.translate(0, 0, 0);
                const bottom = cone(r, r * 1.6, 8); bottom.rotateX(Math.PI); bottom.translate(0, -r * 0.8, 0);
                const y = -10 + rnd() * 80;
                for (const g of [part(top, '#7ad88a'), part(bottom, '#8a7aa8')]) { g.translate(centre.x + Math.sin(a) * d, y, centre.z + Math.cos(a) * d); geos.push(g); }
            }
            this.extras.add(new THREE.Mesh(merge(geos), toonMat({ vertexColors: true })));
        }
        // cloud puffs
        if (P.clouds > 0.2) {
            const mat = toonMat({ color: '#ffffff', emissive: '#c8c8e0', emissiveIntensity: P.key === 'sky' ? 0.12 : 0.3 });
            for (let i = 0; i < Math.round(14 * P.clouds); i++) {
                const geos = [];
                const n = 4 + Math.floor(rnd() * 4);
                for (let k = 0; k < n; k++) geos.push(part(sph(6 + rnd() * 6, 10, 8), null, [k * 7 - n * 3.5, rnd() * 3, rnd() * 5]));
                const m = new THREE.Mesh(merge(geos), mat);
                const a = rnd() * Math.PI * 2, d = radius * 0.6 + rnd() * 260;
                m.position.set(centre.x + Math.sin(a) * d, (P.cloudSea ? -20 : 70) + rnd() * 70, centre.z + Math.cos(a) * d);
                m.rotation.y = rnd() * Math.PI;
                m.userData.drift = 1.5 + rnd() * 2;
                this.extras.add(m);
                this.puffs.push(m);
            }
        }
    }

    update(dt, t, camPos) {
        this.uni.uTime.value = t;
        this.dome.position.copy(camPos);
        for (const p of this.puffs) p.position.x += p.userData.drift * dt;
        if (this.sea) this.sea.material.uniforms.uTime.value = t;
    }
}

function cloudSeaMat(P) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(P.horizon) }, uB: { value: new THREE.Color('#ffffff') }, uFog: { value: new THREE.Color(P.fog) } },
        transparent: true, depthWrite: false,
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
uniform float uTime; uniform vec3 uA, uB, uFog; varying vec3 vW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
void main(){
    vec2 p = vW.xz * 0.02 + vec2(uTime * 0.01, uTime * 0.004);
    float c = n2(p) * 0.6 + n2(p * 2.3) * 0.3 + n2(p * 5.1) * 0.1;
    float puff = smoothstep(0.35, 0.65, c);
    vec3 col = mix(uA, uB, puff);
    float d = length(vW.xz - cameraPosition.xz);
    col = mix(col, uFog, smoothstep(200.0, 1000.0, d));
    gl_FragColor = vec4(col, 0.95);
}`,
    });
}
