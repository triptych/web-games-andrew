/**
 * scene.js — renderer, camera rig, lights, post-processing and camera juice.
 *
 * World mapping: sim (x, y) → three (x, height, −y). The room runs "up" the
 * screen away from a camera tilted ~58° down, which follows the player
 * along the room and fits the 11-wide room plus its walls to any aspect
 * ratio (portrait phones included).
 *
 * Post chain: RenderPass → NaN scrub → UnrealBloom (only bright emissive things cross the
 * threshold) → a grade pass (vignette, damage flash, low-HP pulse) → OutputPass.
 */

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

export let renderer, scene, camera, composer;
export let hemi, sun;

const FOV = 42;
const TILT = THREE.MathUtils.degToRad(63);
let bloom, grade, sanitize;
let quality = 0;

const rig = {
    dist: 20,
    focus: new THREE.Vector3(),        // smoothed look-at point
    want: new THREE.Vector3(),
    trauma: 0, punch: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), danger: 0,
    t: 0, minZ: -10, maxZ: 0, rows: 15, span: 16,
};

const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || !(c.a == c.a);
            gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(64.0)), c.a);
        }
    `,
};

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uDanger: { value: 0 },
        uTime: { value: 0 },
        uVignette: { value: 0.9 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uFlash, uDanger, uTime, uVignette;
        uniform vec3 uFlashColor;
        varying vec2 vUv;
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            vec2 d = vUv - 0.5;
            float r = dot(d, d);
            c.rgb *= clamp(1.0 - r * uVignette, 0.0, 1.0);
            // Low HP: a red heartbeat creeping in from the edges.
            float beat = 0.6 + 0.4 * sin(uTime * 6.0);
            c.rgb = mix(c.rgb, vec3(0.75, 0.02, 0.05), clamp(uDanger * r * 3.2 * beat, 0.0, 0.7));
            c.rgb += uFlashColor * uFlash;
            gl_FragColor = c;
        }
    `,
};

export function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(renderer.domElement);
    renderer.domElement.id = 'game-canvas';
    renderer.domElement.addEventListener('webglcontextlost', () => console.warn('Quiverspire: WebGL context lost'));
    renderer.domElement.addEventListener('webglcontextrestored', () => console.warn('Quiverspire: WebGL context restored'));

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 18, 46);
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Scrub non-finite pixels before bloom: one NaN fragment would otherwise be
    // blurred across the whole frame by the bloom mip chain (a black screen).
    sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(sanitize);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    setQuality(coarse ? 1 : 0);
    window.addEventListener('resize', onResize);
    onResize();
}

export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q));
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, [2, 1.5, 1][quality]));
    renderer.shadowMap.enabled = quality < 2;
    sun.castShadow = quality < 2;
    sun.shadow.mapSize.set(quality === 0 ? 2048 : 1024, quality === 0 ? 2048 : 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    bloom.enabled = quality < 2;
    sanitize.enabled = quality < 2;      // only bloom can spread a stray NaN
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
    // Fit ~13.4 units (room + walls) across, and at least ~12 units of room tall.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const byWidth = 6.3 / (halfTan * camera.aspect);
    const byHeight = 7.2 / halfTan;
    rig.dist = Math.max(byWidth, byHeight * 0.95, 13);
    // Roughly how much floor (along the room) is on screen.
    rig.span = (2 * rig.dist * halfTan) / Math.sin(TILT);
    scene.fog.near = rig.dist * 1.05;
    scene.fog.far = rig.dist * 2.6;
}

/** Apply a biome's lighting and fog. */
export function setAtmosphere(b) {
    scene.background = new THREE.Color(b.bg);
    scene.fog.color.set(b.fog);
    hemi.color.set(b.hemiSky);
    hemi.groundColor.set(b.hemiGround);
    hemi.intensity = b.hemiI;
    sun.color.set(b.sun);
    sun.intensity = b.sunI;
}

/** Limits for the camera focus along the room (three z). */
export function setRoomBounds(rows) {
    rig.rows = rows;
    rig.maxZ = -4.6;
    rig.minZ = Math.min(rig.maxZ, -(rows - 4.6));
}

export function snapCamera(x, y) {
    rig.want.set(0, 0, clampZ(-(y + 3)));
    rig.focus.copy(rig.want);
}

// When the whole room fits on screen (tall phones), just centre it.
const clampZ = (z) => (rig.span >= rig.rows + 3 ? -(rig.rows / 2 + 0.6) : Math.max(rig.minZ, Math.min(rig.maxZ, z)));

/** Follow a sim position (the player). */
export function follow(x, y) {
    rig.want.set(x * 0.12, 0, clampZ(-(y + 3)));
}

// ------------------------------------------------------------------ Juice

export function shake(a) { rig.trauma = Math.min(1, rig.trauma + a); }
export function punch(a) { rig.punch = Math.min(5, rig.punch + a); }
export function flash(a, color = 0xffffff) {
    rig.flash = Math.min(0.45, Math.max(rig.flash, a));
    rig.flashColor.set(color);
}
export function setDanger(v) { rig.danger = v; }

const _off = new THREE.Vector3();

export function renderFrame(dt, time) {
    rig.t += dt;
    rig.trauma = Math.max(0, rig.trauma - dt * 1.8);
    rig.punch *= Math.pow(0.02, dt);
    rig.flash *= Math.pow(0.003, dt);
    rig.focus.lerp(rig.want, 1 - Math.pow(0.004, dt));

    const f = rig.focus;
    camera.position.set(f.x, f.y + Math.sin(TILT) * rig.dist, f.z + Math.cos(TILT) * rig.dist);
    const s = rig.trauma * rig.trauma;
    if (s > 0.0001) {
        _off.set(
            (Math.sin(rig.t * 71.3) + Math.sin(rig.t * 43.1)) * s * 0.35,
            (Math.sin(rig.t * 57.7) + Math.sin(rig.t * 31.9)) * s * 0.2,
            (Math.sin(rig.t * 63.7) + Math.sin(rig.t * 37.9)) * s * 0.35,
        );
        camera.position.add(_off);
    }
    camera.lookAt(f.x + _off.x * s * 0.5, f.y, f.z);
    const fov = FOV - rig.punch;
    if (Math.abs(camera.fov - fov) > 0.001) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // Keep the shadow frustum centred on what the camera sees.
    sun.position.set(f.x - 5, 14, f.z + 7);
    sun.target.position.set(f.x, 0, f.z);

    grade.uniforms.uFlash.value = rig.flash;
    grade.uniforms.uFlashColor.value.copy(rig.flashColor);
    grade.uniforms.uDanger.value = rig.danger;
    grade.uniforms.uTime.value = time;
    composer.render();
}

/** Screen position (CSS px) of a sim point at a height. */
const _v = new THREE.Vector3();
export function toScreen(x, y, h = 0) {
    _v.set(x, h, -y).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight, behind: _v.z > 1 };
}
