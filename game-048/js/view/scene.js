/**
 * scene.js — renderer, camera rig, lantern + light pool, post-processing,
 * camera juice and screen-space helpers.
 *
 * World mapping: tile (x, y) → three (x, height, y). North is up the screen;
 * the camera sits south of its focus, tilted down, and follows the hero.
 *
 * Post chain: RenderPass → NaN scrub → UnrealBloom (emissives only) → a grade
 * pass (vignette, flash, low-HP heartbeat, darkness, chromatic shift) → OutputPass.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export let renderer, scene, camera, composer, hemi, lantern;
export const pool = [];            // static-light pool (braziers, torches, lava, glows)
export const POOL_SIZE = 8;

const FOV = 40;
let bloom, grade, sanitize;
let quality = 0;

const rig = {
    dist: 15, zoom: 1, tilt: THREE.MathUtils.degToRad(56),
    focus: new THREE.Vector3(), want: new THREE.Vector3(),
    trauma: 0, punch: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), danger: 0, dark: 0, t: 0, aberr: 0,
};

const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || !(c.a == c.a);
          gl_FragColor = bad ? vec4(0.0,0.0,0.0,1.0) : vec4(min(c.rgb, vec3(48.0)), c.a); }`,
};

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uDanger: { value: 0 }, uTime: { value: 0 }, uDark: { value: 0 }, uAberr: { value: 0 }, uVignette: { value: 1.15 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uFlash, uDanger, uTime, uDark, uAberr, uVignette; uniform vec3 uFlashColor;
        varying vec2 vUv;
        void main() {
            vec2 d = vUv - 0.5;
            float r = dot(d, d);
            vec4 c = texture2D(tDiffuse, vUv);
            if (uAberr > 0.001) {
                c.r = texture2D(tDiffuse, vUv + d * uAberr).r;
                c.b = texture2D(tDiffuse, vUv - d * uAberr).b;
            }
            c.rgb *= clamp(1.0 - r * uVignette, 0.0, 1.0);
            c.rgb *= 1.0 - uDark * smoothstep(0.02, 0.22, r);
            float beat = 0.6 + 0.4 * sin(uTime * 5.5);
            c.rgb = mix(c.rgb, vec3(0.55, 0.0, 0.04), clamp(uDanger * r * 3.0 * beat, 0.0, 0.65));
            c.rgb += uFlashColor * uFlash;
            gl_FragColor = c;
        }`,
};

export function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.id = 'game-canvas';
    document.body.prepend(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('Lanterndeep: WebGL context lost'); });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 14, 34);
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);

    hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
    scene.add(hemi);
    lantern = new THREE.PointLight(0xffb060, 30, 9, 1.4);
    lantern.castShadow = true;
    lantern.shadow.mapSize.set(512, 512);
    lantern.shadow.bias = -0.004;
    lantern.shadow.camera.near = 0.2;
    lantern.shadow.camera.far = 14;
    scene.add(lantern);
    for (let i = 0; i < POOL_SIZE; i++) {
        const l = new THREE.PointLight(0xff8a3a, 0, 6, 1.6);
        l.userData.want = 0;
        pool.push(l);
        scene.add(l);
    }

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(sanitize);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.78);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    setQuality(coarse ? 1 : 0);
    window.addEventListener('resize', onResize);
    onResize();
}

export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q));
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, [2, 1.5, 1][quality]));
    renderer.shadowMap.enabled = quality === 0;
    lantern.castShadow = quality === 0;
    if (lantern.shadow.map) { lantern.shadow.map.dispose(); lantern.shadow.map = null; }
    bloom.enabled = quality < 2;
    sanitize.enabled = quality < 2;
    onResize();
}
export const getQuality = () => quality;

function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitDistance();
}

/** Show roughly 15 tiles across the narrower screen dimension, scaled by zoom. */
function fitDistance() {
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const wantAcross = 15;
    const byW = (wantAcross / 2) / (halfTan * Math.min(camera.aspect, 1.6));
    const byH = (wantAcross * 0.62) / halfTan;
    rig.dist = Math.max(9, Math.min(byW, byH * 1.2)) / rig.zoom;
    scene.fog.near = rig.dist * 0.85;
    scene.fog.far = rig.dist * 2.1;
}

export function setZoom(z) { rig.zoom = Math.max(0.6, Math.min(1.8, z)); fitDistance(); }
export const getZoom = () => rig.zoom;

export function setAtmosphere(look) {
    scene.background = new THREE.Color(look.bg);
    scene.fog.color.set(look.bg);
    hemi.color.set(look.amb);
    hemi.groundColor.set(0x101010);
    hemi.intensity = look.ambI * 1.35;
    lantern.color.set(look.light);
}

export function snapCamera(x, y) { rig.want.set(x, 0, y); rig.focus.copy(rig.want); }
export function follow(x, y) { rig.want.set(x, 0, y); }

// ------------------------------------------------------------------ Juice

export function shake(a) { rig.trauma = Math.min(1, rig.trauma + a); }
export function punch(a) { rig.punch = Math.min(4, rig.punch + a); }
export function flash(a, color = 0xffffff) { rig.flash = Math.min(0.5, Math.max(rig.flash, a)); rig.flashColor.set(color); }
export function aberrate(a) { rig.aberr = Math.min(0.02, rig.aberr + a); }
export function setDanger(v) { rig.danger = v; }
export function setDark(v) { rig.dark = v; }

const _off = new THREE.Vector3();
export function renderFrame(dt, time) {
    rig.t += dt;
    rig.trauma = Math.max(0, rig.trauma - dt * 1.6);
    rig.punch *= Math.pow(0.02, dt);
    rig.flash *= Math.pow(0.004, dt);
    rig.aberr *= Math.pow(0.01, dt);
    rig.focus.lerp(rig.want, 1 - Math.pow(0.0015, dt));
    const f = rig.focus;
    camera.position.set(f.x, Math.sin(rig.tilt) * rig.dist, f.z + Math.cos(rig.tilt) * rig.dist);
    const s = rig.trauma * rig.trauma;
    _off.set(0, 0, 0);
    if (s > 0.0001) {
        _off.set((Math.sin(rig.t * 71.3) + Math.sin(rig.t * 43.1)) * s * 0.25, (Math.sin(rig.t * 57.7) + Math.sin(rig.t * 31.9)) * s * 0.15, (Math.sin(rig.t * 63.7) + Math.sin(rig.t * 37.9)) * s * 0.25);
        camera.position.add(_off);
    }
    camera.lookAt(f.x + _off.x * 0.4, 0, f.z - 0.6);
    const fov = FOV - rig.punch;
    if (Math.abs(camera.fov - fov) > 0.001) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const u = grade.uniforms;
    u.uFlash.value = rig.flash; u.uFlashColor.value.copy(rig.flashColor);
    u.uDanger.value = rig.danger; u.uTime.value = time; u.uDark.value = rig.dark; u.uAberr.value = rig.aberr;
    composer.render();
}

// ------------------------------------------------------------------ Screen helpers

const _v = new THREE.Vector3();
export function toScreen(x, y, h = 0) {
    _v.set(x, h, y).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight, behind: _v.z > 1 };
}

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
/** Screen (CSS px) → tile under the pointer, on the floor plane (or at a height). */
export function pickTile(sx, sy, h = 0) {
    _ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, camera);
    _plane.constant = -h;
    if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
    return { x: Math.round(_hit.x), y: Math.round(_hit.z) };
}

/** Mean brightness of a freshly rendered frame — used by the browser test. */
export function brightness() {
    composer.render();
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(4 * 64);
    let sum = 0, n = 0;
    for (let k = 0; k < 8; k++) {
        gl.readPixels(Math.floor(w * (0.2 + 0.08 * k)), Math.floor(h * 0.5), 8, 2, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let i = 0; i < px.length; i += 4) { sum += px[i] + px[i + 1] + px[i + 2]; n += 3; }
    }
    return sum / n;
}
