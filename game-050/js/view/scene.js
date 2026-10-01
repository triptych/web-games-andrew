/**
 * scene.js — one WebGL renderer, two scenes (the town diorama and the battle stage),
 * a bloom + grade post chain, screen-space mapping helpers and quality tiers.
 *
 * Battle layout: the DOM decides where the board and the monster go (#board-area and
 * #foe-area). The battle camera looks straight down -Z at a plane z = 0; screenToPlane()
 * turns a DOM rect into plane coordinates so 3D content lines up with the HUD exactly.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export let renderer, composer, envMap;
export const town = { scene: null, camera: null };
export const battle = { scene: null, camera: null };
let active = 'town';
let renderPass, bloom, grade;
let quality = 0, bloomBase = 0.22;
const BATTLE_FOV = 28, BATTLE_DIST = 30;

const juice = { shake: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), t: 0, kick: 0 };

const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b);
          gl_FragColor = bad ? vec4(0.0,0.0,0.0,1.0) : vec4(min(c.rgb, vec3(32.0)), 1.0); }`,
};

const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.55 }, uSat: { value: 1.18 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uFlash, uVig, uSat; uniform vec3 uFlashColor; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          c.rgb = mix(vec3(l), c.rgb, uSat);
          vec2 d = vUv - 0.5;
          c.rgb *= clamp(1.0 - dot(d, d) * uVig, 0.0, 1.0);
          c.rgb += uFlashColor * uFlash;
          gl_FragColor = c;
        }`,
};

export function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.domElement.id = 'game-canvas';
    document.body.prepend(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('Tomebound: WebGL context lost'); });

    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    town.scene = new THREE.Scene();
    town.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
    battle.scene = new THREE.Scene();
    battle.scene.environment = envMap;
    battle.scene.environmentIntensity = 0.45;
    battle.camera = new THREE.PerspectiveCamera(BATTLE_FOV, 1, 1, 200);
    battle.camera.position.set(0, 0, BATTLE_DIST);
    battle.camera.lookAt(0, 0, 0);

    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(town.scene, town.camera);
    composer.addPass(renderPass);
    composer.addPass(new ShaderPass(SanitizeShader));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
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
    renderer.shadowMap.enabled = quality < 2;
    bloom.enabled = quality < 2;
    bloom.strength = [bloomBase, bloomBase * 0.8, 0][quality];
    onResize();
}
export function getQuality() { return quality; }

export function onResize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    const half = quality === 0 ? 2 : 3;
    bloom.resolution.set(Math.max(64, Math.round(w / half)), Math.max(64, Math.round(h / half)));
    for (const c of [town.camera, battle.camera]) { c.aspect = w / h; c.updateProjectionMatrix(); }
}

export function setActive(which) {
    active = which;
    const s = which === 'battle' ? battle : town;
    renderPass.scene = s.scene;
    renderPass.camera = s.camera;
    grade.uniforms.uVig.value = which === 'battle' ? 0.7 : 0.45;
    bloomBase = which === 'battle' ? 0.42 : 0.22;
    bloom.threshold = which === 'battle' ? 0.9 : 0.95;
    bloom.strength = quality < 2 ? bloomBase * (quality ? 0.8 : 1) : 0;
}
export function getActive() { return active; }

// ------------------------------------------------------------------ Battle mapping

/** World units per CSS pixel on the battle plane z = 0. */
export function unitsPerPx() {
    const h = 2 * BATTLE_DIST * Math.tan(THREE.MathUtils.degToRad(BATTLE_FOV / 2));
    return h / window.innerHeight;
}

/** DOM rect → { cx, cy, w, h } in battle-plane units. */
export function rectToPlane(r) {
    const u = unitsPerPx();
    const W = window.innerWidth, H = window.innerHeight;
    return { cx: (r.left + r.width / 2 - W / 2) * u, cy: (H / 2 - (r.top + r.height / 2)) * u, w: r.width * u, h: r.height * u };
}

/** Battle-plane point → CSS pixel. */
export function planeToScreen(x, y, z = 0) {
    const v = new THREE.Vector3(x, y, z).project(battle.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
}

/** CSS pixel → battle-plane point. */
export function screenToPlane(px, py) {
    const u = unitsPerPx();
    return { x: (px - window.innerWidth / 2) * u, y: (window.innerHeight / 2 - py) * u };
}

/** Any world point in the town scene → CSS pixel (and whether it's in front of the camera). */
export function townToScreen(v3) {
    const v = v3.clone().project(town.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, ok: v.z < 1 };
}

// ------------------------------------------------------------------ Juice

export function shake(n) { juice.shake = Math.min(1, juice.shake + n); }
export function flash(n, color = 0xffffff) { juice.flash = Math.max(juice.flash, n); juice.flashColor.set(color); }
export function kick(n) { juice.kick = Math.max(juice.kick, n); }

export function render(dt) {
    juice.t += dt;
    juice.shake = Math.max(0, juice.shake - dt * 2.2);
    juice.flash = Math.max(0, juice.flash - dt * 2.5);
    juice.kick = Math.max(0, juice.kick - dt * 3);
    const cam = active === 'battle' ? battle.camera : town.camera;
    let ox = 0, oy = 0;
    if (juice.shake > 0) {
        const s = juice.shake * juice.shake * 0.35;
        ox = (Math.random() - 0.5) * s; oy = (Math.random() - 0.5) * s;
    }
    if (active === 'battle') {
        cam.position.set(ox, oy, BATTLE_DIST - juice.kick * 1.2);
    } else if (ox || oy) {
        cam.position.x += ox; cam.position.y += oy;
    }
    grade.uniforms.uFlash.value = juice.flash * 0.6;
    grade.uniforms.uFlashColor.value.copy(juice.flashColor);
    composer.render(dt);
    if (active !== 'battle' && (ox || oy)) { cam.position.x -= ox; cam.position.y -= oy; }
}

/** Mean brightness of a fresh frame (debug / browser tests: 0 means a black frame). */
export function brightness() {
    const gl = renderer.getContext();
    composer.render(0);
    const w = 32, h = 32;
    const px = new Uint8Array(w * h * 4);
    const cw = gl.drawingBufferWidth, ch = gl.drawingBufferHeight;
    gl.readPixels(Math.floor(cw / 2 - w / 2), Math.floor(ch / 2 - h / 2), w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0;
    for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
    return s / (w * h * 3);
}
