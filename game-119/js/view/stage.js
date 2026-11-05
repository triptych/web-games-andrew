// The HD-2D stage: a perspective camera looking down at about 48 degrees on a lit diorama, painted
// sprites standing up in it, then post: a little bloom (lanterns, forge fire, windows at night), a
// tilt-shift blur toward the top and bottom of the frame, a warm grade, a vignette and a faint canvas weave.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PITCH = 48 * Math.PI / 180;
export const LEAN = 0.66 * PITCH;                       // how far sprites lean back toward the camera
export const FOV = 28;
const SPRITE_STRETCH = 1 / Math.cos(PITCH - LEAN);      // undo the foreshortening of a leaning plane

const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.55 }, uSat: { value: 1.1 }, uTime: { value: 0 }, uWeave: { value: 0.045 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uBlur, uVig, uSat, uTime, uWeave; uniform vec3 uTint;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
            float edge = smoothstep(0.30, 0.50, abs(vUv.y - 0.46)) * uBlur;
            vec2 px = 1.0 / uRes;
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            if (edge > 0.01) {
                vec3 acc = col * 2.0; float wsum = 2.0;
                for (int i = 1; i <= 5; i++) {
                    float o = float(i) * 1.5 * edge;
                    acc += texture2D(tDiffuse, vUv + vec2(0.0, o * 2.0) * px).rgb + texture2D(tDiffuse, vUv - vec2(0.0, o * 2.0) * px).rgb;
                    acc += texture2D(tDiffuse, vUv + vec2(o, 0.0) * px).rgb * 0.6 + texture2D(tDiffuse, vUv - vec2(o, 0.0) * px).rgb * 0.6;
                    wsum += 3.2;
                }
                col = acc / wsum;
            }
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, uSat) * uTint;
            // soft painterly lift: a hint of warm in the lights, cool in the shadows
            col += (vec3(0.02, 0.012, 0.0) * l) - vec3(0.0, 0.0, 0.012) * (1.0 - l);
            vec2 c = vUv - 0.5; float v = 1.0 - dot(c, c) * uVig * 1.7;
            col *= clamp(v, 0.0, 1.0);
            // canvas weave
            vec2 w = vUv * uRes * 0.5;
            float weave = (sin(w.x * 1.9) * sin(w.y * 1.9) * 0.5 + hash(floor(w)) * 0.5) * uWeave;
            col *= 1.0 - weave * 0.5 + uWeave * 0.25;
            gl_FragColor = vec4(col, 1.0);
        }`,
};

export function lightAt(hour) {
    const night = hour >= 21 || hour < 4.8 ? 1 : hour >= 19 ? (hour - 19) / 2 : hour < 6.6 ? 1 - (hour - 4.8) / 1.8 : 0;
    const dusk = hour >= 16.5 && hour < 21 ? Math.sin(Math.min(1, (hour - 16.5) / 3.5) * Math.PI) : 0;
    const dawn = hour >= 4.8 && hour < 8.5 ? Math.sin(Math.min(1, (hour - 4.8) / 3.7) * Math.PI) : 0;
    const day = new THREE.Color(1.0, 0.985, 0.95), nightC = new THREE.Color(0.38, 0.45, 0.78), warm = new THREE.Color(1.0, 0.7, 0.5), pink = new THREE.Color(1.0, 0.82, 0.78);
    const c = day.clone().lerp(nightC, night).lerp(warm, dusk * 0.75 * (1 - night)).lerp(pink, dawn * 0.5 * (1 - night));
    return { color: c, night };
}

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x9ecbe8);
        this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
        this.target = new THREE.Vector3(50, 0, 36);
        this.dist = 60;
        this.shake = 0;
        this.light = lightAt(10);
        this.litMats = new Set();                // sprite materials tinted by the light
        this.glowMats = new Set();               // additive window glows, strength follows the night
        this.scene = null;
        this.w = 0; this.h = 0;
        this.composer = null;
        this.bloom = null; this.grade = null;
        this.texCache = new Map();
        this.low = this.detectSoftware() || new URLSearchParams(location.search).get('fx') === 'low';
    }
    /** A software GL (SwiftShader, llvmpipe) cannot afford bloom and MSAA; real GPUs get the full look. */
    detectSoftware() {
        try {
            const gl = this.renderer.getContext();
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
            return /swiftshader|llvmpipe|software/i.test(r);
        } catch { return false; }
    }

    /** A texture from a painted canvas: smooth, mip-mapped, no pixelation anywhere. */
    texture(cv) {
        const t = new THREE.CanvasTexture(cv);
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = this.low ? 1 : Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        return t;
    }
    /** A standing sprite (origin at its feet), width wu world units, height from the canvas aspect. */
    sprite(cv, wu, { lit = true, flip = false, key = null, yOff = 0 } = {}) {
        let mat = key && this.texCache.get(key);
        if (!mat) {
            mat = new THREE.MeshBasicMaterial({ map: this.texture(cv), transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide, fog: false });
            if (lit) this.litMats.add(mat);
            if (key) this.texCache.set(key, mat);
        }
        const hu = (wu * cv.height) / cv.width;
        const geo = new THREE.PlaneGeometry(wu, hu * SPRITE_STRETCH);
        geo.translate(0, (hu * SPRITE_STRETCH) / 2 + yOff, 0);
        if (flip) geo.scale(-1, 1, 1);
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -LEAN;
        m.userData.h = hu;
        return m;
    }
    /** The additive night glow that goes with a sprite. */
    glowOf(cv, wu, parent) {
        const mat = new THREE.MeshBasicMaterial({ map: this.texture(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
        this.glowMats.add(mat);
        const hu = (wu * cv.height) / cv.width;
        const geo = new THREE.PlaneGeometry(wu, hu * SPRITE_STRETCH);
        geo.translate(0, (hu * SPRITE_STRETCH) / 2, 0.02);
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -LEAN;
        m.position.copy(parent.position);
        return m;
    }

    makeComposer() {
        const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
        const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: this.low ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: this.low ? 0 : 4 });
        this.composer = new EffectComposer(this.renderer, rt);
        this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.7, 0.86);
        this.bloom.enabled = !this.low;
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GradeShader);
        if (this.low) this.grade.uniforms.uBlur.value = 0;
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
        const pr = this.renderer.getPixelRatio();
        this.grade.uniforms.uRes.value.set(this.w * pr, this.h * pr);
    }
    setScene(scene, bg) {
        this.scene = scene;
        if (!this.composer) this.makeComposer();
        this.renderPass.scene = scene;
        if (bg !== undefined) this.renderer.setClearColor(bg);
    }

    resize(force) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth)), h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.grade.uniforms.uRes.value.set(w * pr, h * pr); }
    }

    updateCamera() {
        const aspect = this.camera.aspect;
        // fit by whichever of width or height is tighter; a portrait phone sees a narrower slice, so back away
        const d = this.dist * (aspect < 1.2 ? 1.0 + (1.2 - aspect) * 0.9 : 1);
        const sh = this.shake > 0 ? [(Math.sin(this.shake * 80) * this.shake * 0.4), (Math.cos(this.shake * 70) * this.shake * 0.3)] : [0, 0];
        this.camera.position.set(this.target.x + sh[0], this.target.y + Math.sin(PITCH) * d + sh[1], this.target.z + Math.cos(PITCH) * d);
        this.camera.lookAt(this.target);
    }
    /** Where a ground point lands on screen (CSS px). */
    project(x, y, z) {
        const v = new THREE.Vector3(x, y, z).project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, behind: v.z > 1 };
    }

    setLight(hour) {
        const L = lightAt(hour);
        this.light = L;
        for (const m of this.litMats) m.color.copy(L.color);
        for (const m of this.glowMats) m.opacity = Math.min(1, L.night * 1.3 + 0.0);
        if (this.grade) { this.grade.uniforms.uTint.value.copy(new THREE.Color(1, 1, 1).lerp(L.color, 0.35)); }
        if (this.bloom) this.bloom.strength = 0.32 + L.night * 0.5;
    }

    render(dt, time) {
        this.shake = Math.max(0, this.shake - dt);
        this.updateCamera();
        if (this.grade) this.grade.uniforms.uTime.value = time;
        if (this.composer && this.scene) this.composer.render(dt);
    }
    dispose(obj) {
        obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
}
