// The stage: renderer, lights, sky, sea and the camera rig. Knows nothing about the game's rules.

import { THREE, clamp, damp, angleDamp } from './kit.js';
import { themeOf } from './themes.js';

const SKY_VS = `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
}`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uBelow;
void main() {
    float y = vDir.y;
    vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
    c = mix(c, uTop, smoothstep(0.18, 0.85, y));
    c = mix(c, uBelow, smoothstep(0.0, -0.18, y));
    float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    c += uSun * (pow(s, 600.0) * 1.5 + pow(s, 20.0) * 0.28 + pow(s, 4.0) * 0.08);
    gl_FragColor = vec4(c, 1.0);
    gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;
const WATER_VS = `
uniform float uTime; uniform float uWave;
varying vec3 vW; varying float vH;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    float h = sin(w.x * 0.35 + uTime * 1.3) * cos(w.z * 0.3 + uTime * 1.1) * uWave
            + sin((w.x + w.z) * 0.7 + uTime * 2.1) * uWave * 0.4;
    w.y += h; vW = w.xyz; vH = h;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FS = `
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uFog;
uniform float uFogN; uniform float uFogF; uniform float uTime; uniform float uAlpha; uniform float uWave; uniform vec3 uCam;
varying vec3 vW; varying float vH;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
    vec3 V = normalize(uCam - vW);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 1.6);
    vec3 col = mix(uShallow, uDeep, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
    vec2 uv = vW.xz * 0.28;
    float n = noise(uv + vec2(uTime * 0.11, uTime * 0.08)) + noise(uv * 2.4 - vec2(uTime * 0.13, uTime * 0.04)) * 0.6;
    float c = smoothstep(0.98, 1.35, n);
    col += uFoam * c * 0.22;
    col += uFoam * smoothstep(0.35, 1.0, vH / max(uWave, 0.01) * 0.5 + 0.5) * 0.07;
    float d = length(uCam - vW);
    col = mix(col, uFog, smoothstep(uFogN, uFogF, d));
    gl_FragColor = vec4(col, uAlpha);
    gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, 1, 0.3, 700);
        this.shadows = true;
        this.w = 0; this.h = 0; this.dpr = 1;

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 0.9);
        this.sun = new THREE.DirectionalLight(0xffffff, 2);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        const sc = this.sun.shadow.camera;
        sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 170;
        this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
        this.scene.add(this.hemi, this.sun, this.sun.target);

        this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: SKY_VS, fragmentShader: SKY_FS,
            uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uBelow: { value: new THREE.Color() } },
        }));
        this.sky.renderOrder = -10; this.sky.frustumCulled = false;
        this.scene.add(this.sky);

        this.water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 90, 90).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
            transparent: true, vertexShader: WATER_VS, fragmentShader: WATER_FS,
            uniforms: {
                uTime: { value: 0 }, uWave: { value: 0.2 }, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
                uFog: { value: new THREE.Color() }, uFogN: { value: 60 }, uFogF: { value: 240 }, uAlpha: { value: 0.9 }, uCam: { value: new THREE.Vector3() },
            },
        }));
        this.water.frustumCulled = false; this.water.renderOrder = 0;
        this.scene.add(this.water);

        this.rig = { x: 0, y: 3, z: 8, lx: 0, ly: 1, lz: 0, yaw: 0, fov: 52, shakeT: 0, init: false, focusY: 0 };
        this.theme = themeOf('beach');
        this.setTheme('beach');
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality({ shadows = true, dpr = 2 } = {}) {
        this.shadows = shadows; this.maxDpr = dpr;
        this.renderer.shadowMap.enabled = shadows;
        this.sun.castShadow = shadows;
        this.w = 0; this.resize();
    }

    setTheme(name) {
        const T = this.theme = themeOf(name);
        this.themeName = name;
        const u = this.sky.material.uniforms;
        u.uTop.value.set(T.sky[0]); u.uMid.value.set(T.sky[1]); u.uHor.value.set(T.sky[2]); u.uSun.value.set(T.sun); u.uBelow.value.set(T.fog);
        u.uSunDir.value.set(...T.sunDir).normalize();
        this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2];
        this.sun.color.set(T.sun); this.sun.intensity = T.sunI;
        this.scene.fog = new THREE.Fog(T.fog, T.fogN, T.fogF);
        const w = this.water.material.uniforms;
        w.uShallow.value.set(T.water[0]); w.uDeep.value.set(T.water[1]); w.uFoam.value.set(T.water[2]);
        w.uFog.value.set(T.fog); w.uFogN.value = T.fogN; w.uFogF.value = T.fogF; w.uAlpha.value = T.waterAlpha; w.uWave.value = T.waveH;
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);                 // also sets the canvas CSS size in px: no 100vh trap
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.onResize?.(w, h);
    }

    /** Where, in px, one world unit at one unit of depth lands: for the point-sprite shader. */
    pxScale() { return (this.h * this.dpr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 0.5; }

    setWaterLevel(y) { this.water.position.y = y; }

    /** Follow a target (the player) with the sun and shadow box. */
    followSun(x, y, z) {
        const T = this.theme, d = T.sunDir;
        const snap = 2;
        const sx = Math.round(x / snap) * snap, sz = Math.round(z / snap) * snap;
        this.sun.target.position.set(sx, y, sz);
        this.sun.position.set(sx + d[0] * 70, y + d[1] * 70, sz + d[2] * 70);
        this.sun.target.updateMatrixWorld();
    }

    render(time) {
        const c = this.camera;
        this.sky.position.copy(c.position);
        this.water.position.x = Math.round(c.position.x / 10) * 10; this.water.position.z = Math.round(c.position.z / 10) * 10;
        const wu = this.water.material.uniforms;
        wu.uTime.value = time; wu.uCam.value.copy(c.position);
        this.renderer.render(this.scene, c);
    }
}
