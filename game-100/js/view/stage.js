// The renderer and its post chain.
//
//   RenderPass (the party)  →  RenderPass (the UI canvas as a texture, over it)  →  Sanitize
//   →  UnrealBloom (half size)  →  CRT tube  →  OutputPass
//
// The whole picture goes through the tube: the HUD, the menus and the board are one image, so
// they bend, scan-line and glow together. The tube is our own pass: barrel curvature, a little
// chromatic aberration, scanlines locked to the UI's pixel rows, an aperture-grille mask, a
// vignette, a rolling hum bar, tape-style glitching and the power-on collapse.
//
// The canvas is sized in px from visualViewport (never 100vh). Because the tube bends the image,
// every pointer is mapped back through the same bend (crtBend) before it is used.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const CRT_LOOKS = {
    off: { curv: 0, scan: 0, mask: 0, aberr: 0.0002, vig: 0.12, noise: 0, bloom: 0.3 },
    lite: { curv: 0.7, scan: 0.22, mask: 0, aberr: 0.0005, vig: 0.28, noise: 0.012, bloom: 0.36 },
    full: { curv: 1.35, scan: 0.42, mask: 0.1, aberr: 0.0009, vig: 0.42, noise: 0.02, bloom: 0.4 },
};

// The same bend the shader applies, for mapping a pointer back onto the flat image.
export function crtBend(u, v, curv) {
    let x = u * 2 - 1, y = v * 2 - 1;
    const ox = Math.abs(y) / 6.0, oy = Math.abs(x) / 4.5;
    x += x * ox * ox * curv; y += y * oy * oy * curv;
    const k = curv > 0.0001 ? 0.975 : 1;                    // a curved tube pulls the picture in a little; a flat one doesn't
    x *= k; y *= k;
    return [x * 0.5 + 0.5, y * 0.5 + 0.5];
}

const PassVS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SanitizeShader = {
    name: 'SanitizeShader',
    uniforms: { tDiffuse: { value: null } },
    vertexShader: PassVS,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = clamp(c, vec4(0.0), vec4(48.0));
        }`,
};

const CrtShader = {
    name: 'CrtShader',
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uRows: { value: 240 },
        uCurv: { value: 1.35 },
        uScan: { value: 0.42 },
        uMask: { value: 0.1 },
        uAberr: { value: 0.0016 },
        uVig: { value: 0.42 },
        uNoise: { value: 0.02 },
        uRoll: { value: 0 },
        uGlitch: { value: 0 },
        uPower: { value: 1 },
        uFade: { value: 1 },
    },
    vertexShader: PassVS,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uTime, uRows, uCurv, uScan, uMask, uAberr, uVig, uNoise, uRoll, uGlitch, uPower, uFade;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec2 bend(vec2 uv) {
            vec2 u = uv * 2.0 - 1.0;
            vec2 o = abs(u.yx) / vec2(6.0, 4.5);
            u += u * o * o * uCurv;
            u *= uCurv > 0.0001 ? 0.975 : 1.0;
            return u * 0.5 + 0.5;
        }
        void main() {
            vec2 uv = vUv;
            // power-on: the picture collapses to a line and opens up
            float p = clamp(uPower, 0.0, 1.0);
            float ey = smoothstep(0.0, 0.55, p), ex = smoothstep(0.35, 1.0, p);
            float bright = 1.0 + (1.0 - p) * 2.4;
            vec2 u = bend(uv);
            u.y = 0.5 + (u.y - 0.5) / max(ey, 0.004);
            u.x = 0.5 + (u.x - 0.5) / max(0.12 + 0.88 * ex, 0.004);
            if (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
            // tape glitch: a few rows slide sideways
            float row = floor(u.y * 60.0);
            float g = step(1.0 - uGlitch * 0.5, hash(vec2(row, floor(uTime * 20.0))));
            u.x += g * (hash(vec2(row, uTime)) - 0.5) * 0.05 * uGlitch;
            float ab = uAberr * (0.6 + 0.8 * length(uv - 0.5)) + uGlitch * 0.004;
            vec3 c;
            c.r = texture2D(tDiffuse, u + vec2(ab, 0.0)).r;
            c.g = texture2D(tDiffuse, u).g;
            c.b = texture2D(tDiffuse, u - vec2(ab, 0.0)).b;
            // scanlines, locked to the UI's pixel rows; fade them out when a row is too thin to resolve
            float ppr = uRes.y / uRows;
            float k = smoothstep(1.6, 3.4, ppr);
            float line = pow(max(sin(3.14159265 * fract(u.y * uRows)), 0.0), 0.7);
            c *= mix(1.0, mix(1.0 - uScan, 1.0, line) * (1.0 + uScan * 0.35), k);
            // aperture grille
            float m = mod(gl_FragCoord.x, 3.0);
            vec3 grille = m < 1.0 ? vec3(1.1, 0.92, 0.92) : (m < 2.0 ? vec3(0.92, 1.1, 0.92) : vec3(0.92, 0.92, 1.1));
            c *= mix(vec3(1.0), grille, uMask * smoothstep(1.5, 3.0, ppr));
            // rolling hum bar and a little noise
            float bar = exp(-pow((fract(u.y - uTime * 0.045) - 0.5) * 7.0, 2.0));
            c *= 1.0 + uRoll * bar * 0.07;
            c += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * uNoise * (0.3 + dot(c, vec3(0.33)));
            // vignette and the rounded glass edge
            vec2 d = uv - 0.5;
            c *= 1.0 - uVig * dot(d, d) * 2.6;
            vec2 q = abs(uv - 0.5) * 2.0;
            float edge = 1.0 - smoothstep(0.985, 1.0, max(q.x, q.y));
            float corner = length(max(q - vec2(0.93), 0.0));
            edge *= 1.0 - smoothstep(0.03, 0.07, corner) * step(0.0001, uCurv);
            c *= edge * bright * uFade;
            gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        }`,
};

export class Stage {
    constructor(canvas, quality = 'high') {
        this.canvas = canvas;
        this.quality = quality;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.NeutralToneMapping;
        r.toneMappingExposure = 1.05;
        r.localClippingEnabled = true;
        r.setClearColor(0x05020c);
        r.autoClear = false;

        const pmrem = new THREE.PMREMGenerator(r);
        this.envMap = pmrem.fromScene(buildDiscoEnv(), 0.03).texture;
        this.envRoom = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
        pmrem.dispose();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
        this.camera.position.set(0, 0, 18);
        this.fov = 34;

        // the UI canvas, drawn over the 3D picture
        this.uiScene = new THREE.Scene();
        this.uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.uiTex = null;
        this.uiMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        this.uiScene.add(this.uiMesh);

        this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 0 }));
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.uiPass = new RenderPass(this.uiScene, this.uiCam);
        this.uiPass.clear = false;
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.uiPass);
        this.composer.addPass(new ShaderPass(SanitizeShader));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.45, 0.95);
        this.composer.addPass(this.bloom);
        this.crtPass = new ShaderPass(CrtShader);
        this.composer.addPass(this.crtPass);
        this.composer.addPass(new OutputPass());
        this.C = this.crtPass.uniforms;

        this.look = 'full';
        this.curv = CRT_LOOKS.full.curv;
        this.calm = false;
        this.power = 1;
        this.glitch = 0;
        this.shake = 0;
        this.punch = 0;
        this.board = { cx: 0.5, cy: 0.5, size: 0.8, world: 9.2 };   // where the board sits, in fractions of the screen
        this.rows = 240;
        this.w = 0; this.h = 0;
        this.shakeV = new THREE.Vector3();
        this.pickPlane = new THREE.Plane();
        this.ray = new THREE.Raycaster();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.quality = q;
        const rt = this.composer.renderTarget1;
        rt.samples = q === 'high' ? 4 : 0;
        this.composer.renderTarget2.samples = rt.samples;
        this.bloom.enabled = q !== 'low';
        this.w = 0;
        this.resize();
    }

    setLook(name) {
        this.look = CRT_LOOKS[name] ? name : 'full';
        const l = CRT_LOOKS[this.look];
        // a tall phone screen gets less bulge: the same bend would pull its edges in too far
        this.curv = l.curv * Math.max(0.4, Math.min(1, (this.w || 1280) / (this.h || 760)));
        const C = this.C;
        C.uCurv.value = this.curv; C.uScan.value = l.scan; C.uMask.value = l.mask; C.uAberr.value = l.aberr;
        C.uVig.value = l.vig; C.uNoise.value = this.calm ? 0 : l.noise;
        this.bloom.strength = l.bloom * (this.calm ? 0.8 : 1);
    }

    /** The UI canvas to show; its height in pixel rows drives the scanlines. */
    setUi(canvas, force = false) {
        if (!force && this.uiTex && this.uiTex.image === canvas) return;
        this.uiTex?.dispose();
        this.uiTex = new THREE.CanvasTexture(canvas);
        this.uiTex.colorSpace = THREE.SRGBColorSpace;
        this.uiTex.minFilter = this.uiTex.magFilter = THREE.NearestFilter;
        this.uiTex.generateMipmaps = false;
        this.uiMesh.material.map = this.uiTex;
        this.uiMesh.material.needsUpdate = true;
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const cap = this.quality === 'high' ? 1.75 : this.quality === 'medium' ? 1.25 : 1;
        const pr = Math.min(window.devicePixelRatio || 1, cap);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);                  // also sets the canvas CSS size in px
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        this.C.uRes.value.set(w * pr, h * pr);
        this.camera.aspect = w / h;
        this.setLook(this.look);
        this.frame();
        this.onResize?.(w, h);
        return true;
    }

    /** Tell the stage where the board goes: centre (cx, cy) and edge length in CSS px. */
    setBoardRect(cx, cy, size, rows) {
        this.board.cx = cx; this.board.cy = cy; this.board.size = size;
        this.rows = rows;
        this.C.uRows.value = rows;
        this.frame();
    }

    /** Aim the camera so the board (9.2 world units across) fills the rect, with the board's centre at the rect's centre. */
    frame() {
        const { w, h, board } = this;
        const cam = this.camera;
        const dist = (h * board.world) / (2 * Math.tan((this.fov * Math.PI) / 360) * Math.max(40, board.size));
        const elev = 0.12;
        this.baseCam = new THREE.Vector3(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
        this.lookAt = new THREE.Vector3(0, 0, 0);
        cam.fov = this.fov;
        cam.aspect = w / h;
        cam.far = dist * 6;
        cam.setViewOffset(w, h, w / 2 - board.cx, h / 2 - board.cy, w, h);
        cam.position.copy(this.baseCam);
        cam.lookAt(this.lookAt);
        cam.updateMatrixWorld(true);
        this.dist = dist;
    }

    /** A kick of camera shake and a glitch burst, both capped and off in calm mode. */
    kick(shake = 0.2, glitch = 0) {
        if (this.calm) return;
        this.shake = Math.min(0.6, Math.max(this.shake, shake));
        this.glitch = Math.max(this.glitch, glitch);
    }

    /** Client px → the flat source image the tube shows, as 0-1 (v up), or null off the glass. */
    toSource(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const u = (clientX - rect.left) / rect.width, v = 1 - (clientY - rect.top) / rect.height;
        const [su, sv] = crtBend(u, v, this.curv);
        if (su < 0 || su > 1 || sv < 0 || sv > 1) return null;
        return { u: su, v: sv };
    }

    /** Client px → board cell via the plane of the board; { r, c, fr, fc } (fractional too) or null. */
    pickBoard(clientX, clientY, boardGroup) {
        const s = this.toSource(clientX, clientY);
        if (!s) return null;
        boardGroup.updateMatrixWorld(true);
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(boardGroup.matrixWorld);
        const origin = new THREE.Vector3().setFromMatrixPosition(boardGroup.matrixWorld);
        this.pickPlane.setFromNormalAndCoplanarPoint(normal, origin);
        this.camera.updateMatrixWorld(true);
        this.ray.setFromCamera(new THREE.Vector2(s.u * 2 - 1, s.v * 2 - 1), this.camera);
        const p = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(this.pickPlane, p)) return null;
        boardGroup.worldToLocal(p);
        const fc = p.x + 4, fr = 4 - p.y;
        return { fr, fc, r: Math.floor(fr), c: Math.floor(fc) };
    }

    /** A world point → UI canvas px (the UI canvas is `uiW` × `uiH`). */
    project(vec, uiW, uiH, out = { x: 0, y: 0 }) {
        const v = vec.clone().project(this.camera);
        out.x = (v.x * 0.5 + 0.5) * uiW;
        out.y = (1 - (v.y * 0.5 + 0.5)) * uiH;
        return out;
    }

    render(dt, time, look = {}) {
        this.resize();
        this.bloom.enabled = this.quality !== 'low';
        if (this.uiTex) this.uiTex.needsUpdate = true;
        // shake and punch-in
        this.shake = Math.max(0, this.shake - dt * 1.8);
        this.glitch = Math.max(0, this.glitch - dt * 2.2);
        const s = this.shake * this.shake;
        this.shakeV.set((Math.sin(time * 61) + Math.sin(time * 37)) * 0.5, (Math.cos(time * 53) + Math.sin(time * 29)) * 0.5, 0).multiplyScalar(s * 0.35);
        const sway = this.calm ? 0 : 1;
        this.camera.position.set(
            this.baseCam.x + this.shakeV.x + Math.sin(time * 0.37) * 0.18 * sway,
            this.baseCam.y + this.shakeV.y + Math.sin(time * 0.29) * 0.1 * sway,
            this.baseCam.z - (look.zoom || 0) * 0.5,
        );
        this.camera.lookAt(this.lookAt);
        this.camera.updateMatrixWorld(true);

        const C = this.C;
        C.uTime.value = time;
        C.uPower.value = this.power;
        C.uFade.value = look.fade ?? 1;
        C.uGlitch.value = this.calm ? 0 : this.glitch;
        C.uRoll.value = this.calm ? 0 : 1;
        const l = CRT_LOOKS[this.look];
        this.bloom.strength = l.bloom * (this.calm ? 0.75 : 1) * (look.bloom ?? 1);
        this.bloom.threshold = look.threshold ?? 0.95;
        this.renderer.toneMappingExposure = look.exposure ?? 1.05;
        this.composer.render(dt);
        if (this.sampler) this.sampleLuma();
    }

    /**
     * Test hook: read the frame just drawn and keep, per sample point (every 8 px), the lowest and
     * highest luminance seen since the sampler was armed. A flashing highlight shows up as points
     * whose luminance swings a long way while the picture sits still.
     */
    sampleLuma() {
        const gl = this.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const buf = this.sampler.buf ||= new Uint8Array(w * h * 4);
        if (buf.length !== w * h * 4) return;
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const S = this.sampler, step = 8, GX = 4, GY = 3;
        const sum = new Float64Array(GX * GY), cnt = new Float64Array(GX * GY);
        let k = 0;
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step, k++) {
                const i = (y * w + x) * 4;
                const l = (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255;
                if (S.frames === 0) { S.lo[k] = l; S.hi[k] = l; } else { if (l < S.lo[k]) S.lo[k] = l; if (l > S.hi[k]) S.hi[k] = l; }
                const r = Math.min(GY - 1, Math.floor((y / h) * GY)) * GX + Math.min(GX - 1, Math.floor((x / w) * GX));
                sum[r] += l; cnt[r]++;
            }
        }
        // a flash is a region whose average brightness jumps one way and then back: a drift or a moving edge doesn't do that
        for (let r = 0; r < GX * GY; r++) {
            const m = sum[r] / cnt[r];
            if (S.frames === 0) { S.prev[r] = m; S.sign[r] = 0; S.rev[r] = 0; continue; }
            const d = m - S.prev[r];
            if (Math.abs(d) > 0.05) {
                const sg = d > 0 ? 1 : -1;
                if (S.sign[r] && sg !== S.sign[r]) S.rev[r]++;
                S.sign[r] = sg;
                if (Math.abs(d) > S.maxStep) S.maxStep = Math.abs(d);
            }
            S.prev[r] = m;
        }
        S.frames++;
    }
    armSampler() { this.sampler = { frames: 0, lo: [], hi: [], prev: [], sign: [], rev: [], maxStep: 0, buf: null }; }
    /** The share of sample points whose luminance swung more than `by` (0-1) while armed. */
    swing(by = 0.25) {
        const S = this.sampler;
        if (!S || !S.frames) return null;
        let n = 0, big = 0, max = 0;
        for (let k = 0; k < S.lo.length; k++) {
            const d = S.hi[k] - S.lo[k]; n++;
            if (d > by) big++;
            if (d > max) max = d;
        }
        return { frames: S.frames, share: big / n, max };
    }
    /** The most times any region of the picture (a 4 x 3 grid) flipped brightness up and back while armed. */
    flicker() {
        const S = this.sampler;
        if (!S || !S.frames) return null;
        return { frames: S.frames, worst: Math.max(...S.rev), regions: S.rev.filter((n) => n > 0).length, maxStep: S.maxStep };
    }
}

/** A little room of coloured panels and lamps, for the chrome to reflect. */
function buildDiscoEnv() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0618);
    const panels = [
        [0xff2fa8, [-6, 3, -3], 6], [0x2de2ff, [6, 1, -3], 6], [0xffd21f, [0, 7, -2], 5],
        [0x9dff3a, [-5, -4, 3], 4], [0xff7a1a, [5, -3, 4], 5], [0x9b5cff, [0, -6, -4], 6], [0xffffff, [0, 2, 8], 3],
    ];
    for (const [col, pos, size] of panels) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), side: THREE.DoubleSide }));
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        scene.add(m);
    }
    return scene;
}
