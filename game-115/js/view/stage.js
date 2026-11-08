// Renderer, camera and the light of the day. The camera is a gentle perspective looking down at
// about 50°, which is what gives painted sprites standing in a lit 3D diorama their HD-2D look.
// Post: bloom (windows, forges, lanterns glow at night), a tilt-shift blur toward the top and bottom
// of the frame, a warm grade and a soft vignette.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAP } from '../config.js';

import { roundBloom } from '../../../lib/round-bloom.js';

export const PITCH = 50 * Math.PI / 180;           // camera elevation
export const LEAN = 30 * Math.PI / 180;            // how far sprites lean back, so they face the camera
export const FOV = 26;

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 1 },
        uTint: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.5 }, uSat: { value: 1.08 }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uBlur, uVig, uSat, uTime; uniform vec3 uTint;
        varying vec2 vUv;
        void main(){
            // tilt-shift: blur grows toward the top and bottom edges
            float edge = smoothstep(0.36, 0.52, abs(vUv.y - 0.5)) * uBlur;
            vec2 px = 1.0 / uRes;
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            if (edge > 0.01) {
                vec3 acc = col * 2.0; float wsum = 2.0;
                for (int i = 1; i <= 4; i++) {
                    float o = float(i) * 1.6 * edge;
                    acc += texture2D(tDiffuse, vUv + vec2(0.0, o) * px * 2.0).rgb + texture2D(tDiffuse, vUv - vec2(0.0, o) * px * 2.0).rgb;
                    acc += texture2D(tDiffuse, vUv + vec2(o, 0.0) * px).rgb * 0.5 + texture2D(tDiffuse, vUv - vec2(o, 0.0) * px).rgb * 0.5;
                    wsum += 3.0;
                }
                col = acc / wsum;
            }
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, uSat) * uTint;
            vec2 c = vUv - 0.5; float v = 1.0 - dot(c, c) * uVig * 1.6;
            col *= clamp(v, 0.0, 1.0);
            gl_FragColor = vec4(col, 1.0);
        }`,
};

/** Light colour and night amount for an hour and the weather. */
export function lightAt(hour, weather, season) {
    const night = hour >= 21 || hour < 4.8 ? 1 : hour >= 19 ? (hour - 19) / 2 : hour < 6.6 ? 1 - (hour - 4.8) / 1.8 : 0;
    const dusk = hour >= 17 && hour < 21 ? Math.sin(Math.min(1, (hour - 17) / 3) * Math.PI) : 0;
    const dawn = hour >= 4.8 && hour < 8 ? Math.sin(Math.min(1, (hour - 4.8) / 3.2) * Math.PI) : 0;
    const day = new THREE.Color(1.0, 0.985, 0.94), nightC = new THREE.Color(0.27, 0.34, 0.66), warm = new THREE.Color(1.0, 0.66, 0.46), pink = new THREE.Color(1.0, 0.8, 0.74);
    const c = day.clone().lerp(nightC, night).lerp(warm, dusk * 0.7 * (1 - night)).lerp(pink, dawn * 0.5 * (1 - night));
    if (weather === 'rain') c.multiplyScalar(0.8).lerp(new THREE.Color(0.7, 0.78, 0.9), 0.25);
    if (weather === 'snow') c.lerp(new THREE.Color(0.86, 0.92, 1.0), 0.25);
    if (season === 3) c.lerp(new THREE.Color(0.88, 0.94, 1.0), 0.15);
    return { color: c, night };
}

export class Stage {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.quality = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0, powerPreference: 'high-performance', alpha: false });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.setClearColor(0x24382a);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);
        // uniforms shared by every sprite, so one change lights the whole town
        this.shared = { uLight: { value: new THREE.Color(1, 1, 1) }, uNight: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } };
        this.cam = { x: MAP.w / 2, z: MAP.h / 2, zoom: 1 };
        this.visH = 12;
        this.composer = null;
        this.makeComposer();
        this.resize(true);
    }

    makeComposer() {
        const r = this.renderer;
        const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.quality >= 2 ? 4 : 0 });
        this.composer = new EffectComposer(r, rt);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.85);
        roundBloom(this.bloom);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
    }

    setQuality(q) { this.quality = q; this.composer = null; this.makeComposer(); this.resize(true); }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, [1, 1.25, 2][this.quality]) * [0.8, 1, 1][this.quality];
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);                  // sets the canvas CSS size in px, never 100vh
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
        this.grade.uniforms.uRes.value.set(w * pr, h * pr);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.fit();
        return true;
    }

    /** How many tiles of height we show at zoom 1: about 11 tiles across a portrait phone. */
    fit() {
        const a = this.camera.aspect;
        this.visH = Math.max(12.5, 12 / a) * 0.92;
    }
    get dist() { return (this.visH / 2 / Math.tan((FOV * Math.PI) / 360)) / this.cam.zoom; }

    clampCam() {
        const c = this.cam;
        c.zoom = Math.max(0.55, Math.min(2.4, c.zoom));
        c.x = Math.max(1, Math.min(MAP.w - 1, c.x));
        c.z = Math.max(2, Math.min(MAP.h - 1, c.z));
    }

    place(time) {
        this.clampCam();
        const c = this.cam, d = this.dist;
        this.camera.position.set(c.x, Math.sin(PITCH) * d, c.z + Math.cos(PITCH) * d);
        this.camera.lookAt(c.x, 0, c.z);
        this.camera.near = Math.max(0.5, d - 40);
        this.camera.far = d + 80;
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
    }

    setLight(hour, weather, season, time) {
        const L = lightAt(hour, weather, season);
        this.shared.uLight.value.copy(L.color);
        this.shared.uNight.value = L.night;
        this.shared.uTime.value = time;
        this.light = L;
        // night grade: a touch cooler and more vignette
        this.grade.uniforms.uTint.value.setRGB(1 - L.night * 0.06, 1 - L.night * 0.02, 1 + L.night * 0.04);
        this.grade.uniforms.uVig.value = 0.5 + L.night * 0.2;
        this.bloom.strength = 0.3 + L.night * 0.6;
        this.bloom.threshold = 1.08 - L.night * 0.32;          // by day nothing blooms, not even snow; at night windows and forges do
        this.renderer.setClearColor(new THREE.Color(0.14, 0.22, 0.16).multiply(L.color));
    }

    /** World point → CSS px on the canvas. */
    project(x, y, z, out = {}) {
        const v = new THREE.Vector3(x, y, z).project(this.camera);
        out.x = (v.x * 0.5 + 0.5) * this.w;
        out.y = (-v.y * 0.5 + 0.5) * this.h;
        out.z = v.z;
        out.vis = v.z > -1 && v.z < 1;
        return out;
    }

    /** CSS px → the point on the ground (y = 0) under it. */
    unproject(px, py) {
        const ndc = new THREE.Vector3((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1, 0.5).unproject(this.camera);
        const dir = ndc.sub(this.camera.position).normalize();
        const t = -this.camera.position.y / dir.y;
        return { x: this.camera.position.x + dir.x * t, z: this.camera.position.z + dir.z * t };
    }

    render(time) {
        this.grade.uniforms.uTime.value = time;
        this.grade.uniforms.uBlur.value = this.quality >= 2 ? 1 : 0;
        if (this.quality === 0) this.renderer.render(this.scene, this.camera);
        else this.composer.render();
    }
}

// ---------------------------------------------------------------- the sprite material
const VERT = /* glsl */`
    uniform vec4 uRect; uniform float uSway, uTime, uClip; uniform vec2 uScale;
    varying vec2 vUv; varying float vY;
    void main(){
        vUv = mix(uRect.xy, uRect.zw, uv);
        vY = uv.y;
        vec3 p = position;
        float sway = uSway * sin(uTime * 1.6 + position.x * 3.0 + (instanceMatrix[3].x + instanceMatrix[3].z) * 1.7) * uv.y * uv.y;
        p.x += sway;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
const VERT_PLAIN = VERT.replace('modelMatrix * instanceMatrix', 'modelMatrix').replace(/\(instanceMatrix\[3\]\.x \+ instanceMatrix\[3\]\.z\)/, '(modelMatrix[3].x + modelMatrix[3].z)');
const FRAG = /* glsl */`
    uniform sampler2D map, emi; uniform vec3 uLight, uTint; uniform float uNight, uAlpha, uHi, uClip, uHasEmi, uTime, uFlash;
    varying vec2 vUv; varying float vY;
    void main(){
        if (vY > uClip) discard;
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.4) discard;
        vec3 col = c.rgb * uLight * uTint;
        if (uHasEmi > 0.5) { vec4 e = texture2D(emi, vUv); col += e.rgb * e.a * uNight * 1.25; }
        col += uHi * (0.5 + 0.5 * sin(uTime * 5.0)) * vec3(0.30, 0.22, 0.08);
        col += uFlash * vec3(0.25, 0.2, 0.1);
        gl_FragColor = vec4(col, c.a * uAlpha);
        #include <colorspace_fragment>
    }`;

export function tex(canvas, { pixel = false, mip = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = true;
    if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    else { t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.anisotropy = 4; }
    t.needsUpdate = true;
    return t;
}

let EMPTY = null;
const emptyTex = () => EMPTY || (EMPTY = (() => { const c = document.createElement('canvas'); c.width = c.height = 2; return tex(c, { mip: false }); })());

/** A material for a billboard sprite (single mesh, or an InstancedMesh when `instanced`). */
export function spriteMaterial(shared, map, { emi = null, instanced = false, sway = 0, rect = [0, 0, 1, 1], alphaCoverage = true } = {}) {
    const m = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: map }, emi: { value: emi || emptyTex() }, uHasEmi: { value: emi ? 1 : 0 },
            uRect: { value: new THREE.Vector4(...rect) }, uSway: { value: sway }, uAlpha: { value: 1 }, uHi: { value: 0 }, uClip: { value: 1.01 },
            uTint: { value: new THREE.Color(1, 1, 1) },
            uLight: shared.uLight, uNight: shared.uNight, uTime: shared.uTime, uFlash: shared.uFlash,
        },
        vertexShader: instanced ? VERT : VERT_PLAIN,
        fragmentShader: FRAG,
        transparent: false, side: THREE.DoubleSide,
    });
    m.alphaToCoverage = alphaCoverage;
    return m;
}

/** Unit quad with its pivot at the bottom centre. */
export function spriteGeometry() {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    return g;
}
