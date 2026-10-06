/**
 * sky.js — the night sky over the grove: a gradient dome with twinkling stars,
 * the milky way, a moon with a halo, and aurora curtains that brighten as the
 * Aurora Looms (and the tree) grow.
 */

import * as THREE from 'three';
import { U } from './stage.js';

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w * 0.99999;
}`;

const SKY_FS = /* glsl */`
uniform float uTime;
uniform vec3 uMoonDir;
uniform float uAurora;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform float uSeason;
varying vec3 vDir;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.55));
    // horizon haze
    col += vec3(0.05, 0.09, 0.1) * exp(-abs(h) * 9.0);

    // stars
    vec3 sp = d * 220.0;
    vec3 cell = floor(sp);
    float s = hash(cell);
    if (s > 0.965 && h > 0.02) {
        vec3 f = fract(sp) - 0.5;
        float tw = 0.6 + 0.4 * sin(uTime * (1.5 + s * 4.0) + s * 40.0);
        float star = smoothstep(0.32, 0.0, length(f)) * tw * (s - 0.965) * 30.0;
        col += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.02, 0.25, h);
    }
    // milky way band
    vec3 band = normalize(vec3(0.3, 0.5, -0.8));
    float b = 1.0 - abs(dot(d, band));
    float mw = pow(b, 6.0) * (0.5 + 0.8 * noise(d * 6.0)) * smoothstep(0.0, 0.3, h);
    col += vec3(0.12, 0.12, 0.2) * mw;

    // moon + halo
    float md = dot(d, uMoonDir);
    col += vec3(0.95, 0.97, 1.0) * smoothstep(0.9993, 0.9996, md);
    col += vec3(0.35, 0.45, 0.6) * pow(max(md, 0.0), 300.0) * 0.6;
    col += vec3(0.15, 0.22, 0.32) * pow(max(md, 0.0), 18.0) * 0.5;

    // aurora curtains
    if (uAurora > 0.001 && h > 0.0) {
        float az = atan(d.x, d.z);
        float wave = sin(az * 3.0 + uTime * 0.05) * 0.08 + noise(vec3(az * 2.0, uTime * 0.04, 0.0)) * 0.12;
        float y = h - 0.32 - wave;
        float curtain = smoothstep(0.24, 0.0, abs(y)) * smoothstep(-0.2, 0.15, y + 0.2);
        float rays = 0.55 + 0.45 * noise(vec3(az * 24.0, uTime * 0.25, h * 3.0));
        vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.35, 1.0), smoothstep(0.0, 0.25, y + 0.05));
        col += ac * curtain * rays * uAurora * 0.55;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

export class Sky {
    constructor(scene) {
        this.uniforms = {
            uTime: U.uTime,
            uMoonDir: U.uMoonDir,
            uAurora: { value: 0 },
            uTop: { value: new THREE.Color(0x050a1c) },
            uHorizon: { value: new THREE.Color(0x10303a) },
            uSeason: U.uSeason,
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS,
            side: THREE.BackSide, depthWrite: false, fog: false,
        });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
        this.mesh.renderOrder = -10;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.aurora = 0;
        this.wantAurora = 0;
        // season palettes: [top, horizon, fog]
        this.palettes = [
            [0x07102a, 0x1a3440, 0x0d1d26],   // spring: soft teal
            [0x050d22, 0x123a3a, 0x0b1e22],   // summer: deep green-blue
            [0x0d0a20, 0x33263a, 0x16141f],   // autumn: dusky plum
            [0x08122c, 0x2a3d55, 0x141f2e],   // winter: cold blue
        ];
        this._a = new THREE.Color(); this._b = new THREE.Color();
    }

    setAurora(v) { this.wantAurora = v; }

    update(dt, cameraPos, seasonF, fogColor) {
        this.mesh.position.copy(cameraPos);
        this.aurora += (this.wantAurora - this.aurora) * (1 - Math.exp(-dt * 0.8));
        this.uniforms.uAurora.value = this.aurora;
        const i = Math.floor(seasonF) % 4, j = (i + 1) % 4;
        const f = smooth(seasonF - Math.floor(seasonF));
        const pa = this.palettes[i], pb = this.palettes[j];
        this.uniforms.uTop.value.copy(this._a.setHex(pa[0])).lerp(this._b.setHex(pb[0]), f);
        this.uniforms.uHorizon.value.copy(this._a.setHex(pa[1])).lerp(this._b.setHex(pb[1]), f);
        fogColor.copy(this._a.setHex(pa[2])).lerp(this._b.setHex(pb[2]), f);
    }
}

// seasons cross-fade only in the last 15% of each season
function smooth(x) { const t = Math.max(0, (x - 0.85) / 0.15); return t * t * (3 - 2 * t); }
