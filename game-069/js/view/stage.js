/**
 * stage.js — the renderer, the race scene's sky and light, post-processing and the cameras.
 *
 * Post: render → sanitize (any NaN pixel to black, so bloom can never smear one into a flashing box;
 * game-065's lesson) → bloom → grade (warmth, saturation, vignette, a radial speed blur while
 * boosting) → output. Quality tiers move pixels, not features: 0 = full (pixel ratio ≤ 2, 2048
 * shadows, bloom), 1 = phone (≤ 1.5, 1024 shadows, bloom at half resolution), 2 = low (1, no
 * shadows, no post).
 *
 * The canvas is sized in px to the visible viewport (innerWidth × innerHeight), never 100vh, so the
 * picture is never stretched under a phone's URL bar (games 058 and 067 learned that).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { cloudTexture } from './textures.js';

export let renderer, scene, camera, composer;
let renderPass, bloom, grade, sanitize;
let quality = 0;
let sky, stars, sun, hemi, cloudGroup;
let lastW = 0, lastH = 0, lastDpr = 0;
let pmrem = null, envRT = null;
const sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
export const view = { night: 0, look: null };

const SANITIZE = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
            if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = vec4(max(c.rgb, vec3(0.0)), c.a); }`,
};

const GRADE = {
    uniforms: { tDiffuse: { value: null }, uWarm: { value: 0 }, uSat: { value: 1.08 }, uVig: { value: 0.35 }, uBlur: { value: 0 }, uFlash: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uWarm, uSat, uVig, uBlur, uFlash; uniform vec3 uTint; varying vec2 vUv;
        void main(){
            vec2 q = vUv - 0.5;
            vec4 c = texture2D(tDiffuse, vUv);
            if (uBlur > 0.001) {
                // Radial zoom blur toward the edges while boosting.
                vec4 acc = c; float w = 1.0;
                for (int i = 1; i <= 6; i++) {
                    float s = float(i) * uBlur * 0.012 * length(q) * 2.0;
                    acc += texture2D(tDiffuse, vUv - q * s); w += 1.0;
                }
                c = acc / w;
            }
            float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            c.rgb = mix(vec3(l), c.rgb, uSat);
            c.rgb *= mix(vec3(1.0), vec3(1.06, 1.0, 0.92), uWarm) * uTint;
            c.rgb *= 1.0 - dot(q, q) * uVig * 2.2;
            c.rgb += uFlash;
            gl_FragColor = vec4(max(c.rgb, vec3(0.0)), c.a);
        }`,
};

export function initStage(canvas, q) {
    quality = q;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q < 2, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = q < 2;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcccccc, 100, 600);
    camera = new THREE.PerspectiveCamera(64, 1, 0.3, 4000);

    hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.castShadow = q < 2;
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 400;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    sky = new THREE.Mesh(
        new THREE.SphereGeometry(1800, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uGround: { value: new THREE.Color() } },
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
            fragmentShader: `uniform vec3 uTop, uHor, uSunCol, uGround; uniform vec3 uSun; varying vec3 vDir;
                void main(){
                    vec3 d = normalize(vDir);
                    float h = clamp(d.y, 0.0, 1.0);
                    vec3 c = mix(uHor, uTop, 1.0 - pow(1.0 - h, 3.5));
                    c = mix(c, uGround, smoothstep(0.0, -0.15, d.y));
                    float s = clamp(dot(d, normalize(uSun)), 0.0, 1.0);
                    c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 30.0) * 0.35 + pow(s, 4.0) * 0.12);
                    gl_FragColor = vec4(c, 1.0);
                }`,
        }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    const sg = new THREE.BufferGeometry(), sp = [];
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
        const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.97);
        sp.push(Math.sin(ph) * Math.cos(th) * 1500, Math.cos(ph) * 1500, Math.sin(ph) * Math.sin(th) * 1500);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    stars.frustumCulled = false;
    scene.add(stars);

    cloudGroup = new THREE.Group();
    scene.add(cloudGroup);

    pmrem = new THREE.PMREMGenerator(renderer);

    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    renderPass = new RenderPass(scene, camera);
    sanitize = new ShaderPass(SANITIZE);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.92);
    grade = new ShaderPass(GRADE);
    composer.addPass(renderPass);
    composer.addPass(sanitize);
    composer.addPass(bloom);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    setQuality(q);
    resize();
    addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return { renderer, scene, camera };
}

export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q | 0));
    const size = quality === 0 ? 2048 : 1024;
    renderer.shadowMap.enabled = quality < 2;
    sun.castShadow = quality < 2;
    if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    lastDpr = 0;
    resize();
}
export const getQuality = () => quality;

export function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 0 ? 2 : quality === 1 ? 1.5 : 1);
    if (w === lastW && h === lastH && dpr === lastDpr) return false;
    lastW = w; lastH = h; lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    const bs = quality === 0 ? 0.5 : 0.35;
    bloom.resolution.set(w * dpr * bs, h * dpr * bs);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
}

/** Point the sky, sun, fog and grade at an environment look (js/view/envs.js). */
export function applyLook(L, bounds) {
    view.look = L;
    const u = sky.material.uniforms;
    u.uTop.value.setHex(L.skyTop);
    u.uHor.value.setHex(L.skyHor);
    u.uGround.value.setHex(L.fog);
    const el = L.sunEl, az = L.sunAz;
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    u.uSun.value.copy(sunDir);
    u.uSunCol.value.setHex(L.sunCol).multiplyScalar(L.night ? 0.15 : 1);
    sun.color.setHex(L.sunCol);
    sun.intensity = L.sunI;
    hemi.color.setHex(L.hemiSky);
    hemi.groundColor.setHex(L.hemiGround);
    hemi.intensity = L.hemiI;
    scene.fog.color.setHex(L.fog);
    scene.fog.near = L.fogNear;
    scene.fog.far = L.fogFar;
    renderer.setClearColor(L.fog);
    renderer.toneMappingExposure = L.exposure || 1;
    view.night = L.night || 0;
    stars.material.opacity = L.stars ? 1 : (L.night || 0) * 0.7;
    bloom.strength = 0.25 + (L.night || 0) * 0.55;
    bloom.threshold = L.night ? 0.75 : 0.9;
    grade.uniforms.uWarm.value = L.time === 'Sunset' || L.time === 'Golden hour' ? 1 : L.time === 'Noon' ? 0.4 : 0;
    grade.uniforms.uSat.value = L.night ? 1.15 : 1.08;
    grade.uniforms.uVig.value = L.night ? 0.5 : 0.32;

    // Clouds: soft billboards around the horizon.
    while (cloudGroup.children.length) { const c = cloudGroup.children.pop(); c.material.dispose(); }
    const cx = bounds ? (bounds.x0 + bounds.x1) / 2 : 0, cz = bounds ? (bounds.z0 + bounds.z1) / 2 : 0;
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < (L.clouds || 0); k++) {
        const a = rnd() * Math.PI * 2, e = 0.06 + rnd() * 0.22, r = 1300;
        const m = new THREE.SpriteMaterial({ map: cloudTexture(), color: L.cloudCol, transparent: true, opacity: 0.75 + rnd() * 0.2, fog: false, depthWrite: false });
        const spr = new THREE.Sprite(m);
        spr.position.set(cx + Math.cos(a) * r * Math.cos(e), Math.sin(e) * r, cz + Math.sin(a) * r * Math.cos(e));
        const w = 260 + rnd() * 380;
        spr.scale.set(w, w * 0.45, 1);
        spr.renderOrder = -9;
        cloudGroup.add(spr);
    }
    // Reflections: an environment map baked from the sky.
    const env = new THREE.Scene();
    const sk = sky.clone();
    sk.material = sky.material.clone();
    sk.material.uniforms.uSunCol.value.multiplyScalar(0.4);
    env.add(sk);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(env, 0.02, 1, 3000);
    scene.environment = envRT.texture;
    sk.material.dispose();
}

/** Keep the sun's shadow box centred on (x, y, z). */
export function followSun(x, y, z) {
    sun.position.set(x + sunDir.x * 160, y + sunDir.y * 160, z + sunDir.z * 160);
    sun.target.position.set(x, y, z);
    sky.position.set(x, 0, z);
    stars.position.set(x, 0, z);
    cloudGroup.position.set(x * 0.9, 0, z * 0.9);
}

export function setGrade({ blur = 0, flash = 0 } = {}) {
    grade.uniforms.uBlur.value = blur;
    grade.uniforms.uFlash.value = flash;
}

export function setScene(s) { renderPass.scene = s; }

export function render(s = scene) {
    if (quality >= 2) renderer.render(s, camera);
    else { renderPass.scene = s; composer.render(); }
}

// ------------------------------------------------------------------ chase camera
export const chase = {
    mode: 0,             // 0 = near, 1 = far, 2 = high
    x: 0, y: 5, z: -8, yaw: 0, fov: 64, shake: 0, init: false,
    lx: 0, ly: 0, lz: 0,
};
const MODES = [[6.2, 2.3, 1.1], [8.6, 3.3, 1.4], [12, 6.5, 1.6]];

/**
 * Third-person camera behind a car. Blends the car's heading with its direction of travel so a drift
 * shows the car sideways, keeps above the ground, widens the lens with speed and shakes on impacts.
 */
export function updateChase(car, dt, groundY, opts = {}) {
    const [dist, hgt, look] = MODES[chase.mode];
    const sp = car.speed;
    let travel = Math.atan2(car.vx, car.vz);
    let yawT = car.h;
    if (sp > 6) {
        let d = Math.atan2(Math.sin(travel - car.h), Math.cos(travel - car.h));
        d = Math.max(-0.6, Math.min(0.6, d));
        yawT = car.h + d * 0.55;
    }
    if (car.vLong < -2) yawT = car.h;
    if (!chase.init) { chase.yaw = yawT; }
    let dy = Math.atan2(Math.sin(yawT - chase.yaw), Math.cos(yawT - chase.yaw));
    chase.yaw += dy * Math.min(1, dt * (car.air ? 2.5 : 5.5));
    const fx = Math.sin(chase.yaw), fz = Math.cos(chase.yaw);
    const d2 = dist + Math.min(2.4, sp * 0.05);
    let tx = car.x - fx * d2, tz = car.z - fz * d2;
    let ty = car.y + hgt + Math.min(1, sp * 0.015);
    const gy = groundY ? groundY(tx, tz) : -Infinity;
    if (ty < gy + 1.2) ty = gy + 1.2;
    const k = chase.init ? 1 - Math.exp(-dt * 9) : 1;
    chase.x += (tx - chase.x) * k;
    chase.z += (tz - chase.z) * k;
    chase.y += (ty - chase.y) * (chase.init ? 1 - Math.exp(-dt * (car.air ? 3 : 7)) : 1);
    chase.init = true;
    const lx = car.x + fx * 3, ly = car.y + look, lz = car.z + fz * 3;
    chase.lx = lx; chase.ly = ly; chase.lz = lz;
    // Shake.
    chase.shake = Math.max(0, chase.shake - dt * 2.2);
    const s = chase.shake * chase.shake;
    const t = performance.now() / 1000;
    camera.position.set(chase.x + Math.sin(t * 61) * s * 0.3, chase.y + Math.sin(t * 53 + 1) * s * 0.25, chase.z + Math.cos(t * 47) * s * 0.3);
    camera.lookAt(lx, ly, lz);
    const fovT = 62 + Math.min(18, sp * 0.4) + (car.boosting || car.launch > 0 ? 8 : 0) + (opts.fovAdd || 0);
    chase.fov += (fovT - chase.fov) * Math.min(1, dt * 3);
    if (Math.abs(camera.fov - chase.fov) > 0.05) { camera.fov = chase.fov; camera.updateProjectionMatrix(); }
}

export function resetChase() { chase.init = false; chase.shake = 0; }
export function addShake(a) { chase.shake = Math.min(1.2, chase.shake + a); }

/** An orbiting camera around a point: title screen, results, pre-race flyby. */
export function orbitCam(x, y, z, r, h, yaw, lookY = 1, fov = 50, groundY = null) {
    camera.position.set(x + Math.sin(yaw) * r, y + h, z + Math.cos(yaw) * r);
    if (groundY) camera.position.y = Math.max(camera.position.y, groundY(camera.position.x, camera.position.z) + 1.1);
    camera.lookAt(x, y + lookY, z);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/** Screen position (CSS px) of a world point, or null if behind the camera. */
const _p = new THREE.Vector3();
export function toScreen(x, y, z) {
    _p.set(x, y, z).project(camera);
    if (_p.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (_p.x * 0.5 + 0.5) * r.width, y: r.top + (-_p.y * 0.5 + 0.5) * r.height };
}

export { sun, hemi };
