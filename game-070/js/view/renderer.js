// The monitor. Beams are drawn additively into a half-float target, blended over
// a decayed copy of the previous frame (phosphor persistence), bloomed at two
// sizes, then put onto curved glass with a vignette, a faint reflection, beam
// flicker and colour flashes. Vector monitors have no scanlines, so there are
// none. "CRT FX" off keeps the bloom and drops the rest.
//
// The world camera is a narrow perspective camera far back, so the z = 0 plane
// maps exactly onto the 400 × 300 logical screen while anything with depth
// (wireframe meteors, bosses, explosion fragments flying at the glass) is truly 3D.

import * as THREE from 'three';
import { VIEW_W, VIEW_H } from '../config.js';
import { Beams } from './beams.js';

export const CAM_DIST = 1000;
export const FOV = 2 * Math.atan(VIEW_H / 2 / CAM_DIST) * 180 / Math.PI;

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PERSIST_FS = `
uniform sampler2D cur; uniform sampler2D prev; uniform float decay; varying vec2 vUv;
void main(){
  vec3 c = texture2D(cur, vUv).rgb;
  vec3 p = texture2D(prev, vUv).rgb * decay;
  gl_FragColor = vec4(max(c, p), 1.0);
}`;

const BRIGHT_FS = `
uniform sampler2D tex; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tex, vUv).rgb;
  gl_FragColor = vec4(c, 1.0);
}`;

const BLUR_FS = `
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tex, vUv).rgb * 0.227;
  c += texture2D(tex, vUv + dir * 1.385).rgb * 0.316; c += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
  c += texture2D(tex, vUv + dir * 3.23).rgb * 0.07;  c += texture2D(tex, vUv - dir * 3.23).rgb * 0.07;
  gl_FragColor = vec4(c, 1.0);
}`;

const FINAL_FS = `
uniform sampler2D tex; uniform sampler2D bloomA; uniform sampler2D bloomB;
uniform float crt; uniform vec4 flash; uniform float time; uniform float aberr; uniform float fade; uniform vec2 res;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  float edge = 1.0;
  if (crt > 0.5) {
    vec2 cc = uv - 0.5;
    uv = 0.5 + cc * (1.0 + 0.06 * dot(cc, cc) * 4.0) * 0.988;
    vec2 e = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
    edge = e.x * e.y;
  }
  vec3 c = texture2D(tex, uv).rgb;
  if (aberr > 0.0) {
    float o = aberr / res.x;
    c.r = texture2D(tex, uv + vec2(o, 0.0)).r;
    c.b = texture2D(tex, uv - vec2(o, 0.0)).b;
  }
  vec3 b1 = texture2D(bloomA, uv).rgb;
  vec3 b2 = texture2D(bloomB, uv).rgb;
  c += b1 * 0.9 + b2 * 0.75;
  // soft knee: hot cores go white instead of clipping to a flat colour
  c = vec3(1.0) - exp(-c * 1.25);
  if (crt > 0.5) {
    vec2 d = uv - 0.5;
    c *= 1.0 - dot(d, d) * 0.85;
    c *= 0.975 + 0.025 * sin(time * 97.0);
    // the glass: a faint blue-black glow and a reflection across the top-left
    c += vec3(0.010, 0.014, 0.024) * (1.0 - dot(d, d) * 2.0);
    float refl = smoothstep(0.55, 0.0, length((uv - vec2(0.18, 0.82)) * vec2(1.0, 1.6)));
    c += vec3(0.022, 0.026, 0.034) * refl;
    c += (hash(uv * res + time) - 0.5) * 0.012;
  }
  c = mix(c, flash.rgb, flash.a);
  c *= fade * edge;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
        gl.setPixelRatio(1);
        THREE.ColorManagement.enabled = false;
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        gl.autoClear = false;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, VIEW_W / VIEW_H, 50, 4000);
        this.hudScene = new THREE.Scene();
        this.hudCam = new THREE.OrthographicCamera(0, VIEW_W, VIEW_H, 0, -10, 10);

        this.world = new Beams(26000, false);
        this.hud = new Beams(9000, true);
        this.scene.add(this.world.mesh);
        this.hudScene.add(this.hud.mesh);

        this.crt = true;
        this.flash = new THREE.Vector4(1, 1, 1, 0);
        this.shakeAmt = 0; this.shakeT = 0; this.aberr = 0; this.fade = 1;
        this.w = 4; this.h = 3;

        const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, type: THREE.HalfFloatType };
        this.rt = new THREE.WebGLRenderTarget(4, 3, opts);
        this.rtP = [new THREE.WebGLRenderTarget(4, 3, opts), new THREE.WebGLRenderTarget(4, 3, opts)];
        this.pIdx = 0;
        this.rtA1 = new THREE.WebGLRenderTarget(4, 3, opts);
        this.rtA2 = new THREE.WebGLRenderTarget(4, 3, opts);
        this.rtB1 = new THREE.WebGLRenderTarget(4, 3, opts);
        this.rtB2 = new THREE.WebGLRenderTarget(4, 3, opts);

        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
        this.persistMat = mk(PERSIST_FS, { cur: { value: this.rt.texture }, prev: { value: null }, decay: { value: 0.6 } });
        this.brightMat = mk(BRIGHT_FS, { tex: { value: null } });
        this.blurMat = mk(BLUR_FS, { tex: { value: null }, dir: { value: new THREE.Vector2() } });
        this.finalMat = mk(FINAL_FS, {
            tex: { value: null }, bloomA: { value: this.rtA1.texture }, bloomB: { value: this.rtB1.texture },
            crt: { value: 1 }, flash: { value: this.flash }, time: { value: 0 }, aberr: { value: 0 }, fade: { value: 1 }, res: { value: new THREE.Vector2(4, 3) },
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
        this.quad.frustumCulled = false;
        this.postScene.add(this.quad);
        this.placeCamera(0);
    }

    resize(cssW, cssH, dpr) {
        // cap the drawing buffer: every pixel goes through several full-screen passes
        let pr = Math.min(dpr || 1, 2);
        const maxPx = 2.4e6;
        if (cssW * cssH * pr * pr > maxPx) pr = Math.sqrt(maxPx / (cssW * cssH));
        const w = Math.max(4, Math.round(cssW * pr)), h = Math.max(3, Math.round(cssH * pr));
        this.gl.setSize(w, h, false);
        this.canvas.style.width = cssW + 'px';
        this.canvas.style.height = cssH + 'px';
        this.w = w; this.h = h;
        this.rt.setSize(w, h);
        this.rtP[0].setSize(w, h); this.rtP[1].setSize(w, h);
        const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
        this.rtA1.setSize(hw, hh); this.rtA2.setSize(hw, hh);
        const qw = Math.max(2, w >> 3), qh = Math.max(2, h >> 3);
        this.rtB1.setSize(qw, qh); this.rtB2.setSize(qw, qh);
        this.finalMat.uniforms.res.value.set(w, h);
        const unit = h / VIEW_H;
        this.world.setView(w, h, unit, CAM_DIST);
        this.hud.setView(w, h, unit, 1);
        this.clearHistory = true;
    }

    shake(amount, dur = 0.25) {
        this.shakeAmt = Math.max(this.shakeT > 0 ? this.shakeAmt : 0, amount);
        this.shakeT = Math.max(this.shakeT, dur);
    }
    flashScreen(rgb, a = 0.5) { this.flash.set(rgb[0], rgb[1], rgb[2], Math.max(this.flash.w, a)); }
    aberrate(a) { this.aberr = Math.max(this.aberr, a); }

    placeCamera(dt) {
        let sx = 0, sy = 0;
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            const k = Math.min(1, this.shakeT * 5);
            sx = (Math.random() - 0.5) * 2 * this.shakeAmt * k;
            sy = (Math.random() - 0.5) * 2 * this.shakeAmt * k;
        }
        const cx = VIEW_W / 2 + sx, cy = VIEW_H / 2 + sy;
        this.camera.position.set(cx, cy, CAM_DIST);
        this.camera.lookAt(cx, cy, 0);
        this.camera.updateMatrixWorld();
    }

    blur(src, a, b, w, h) {
        const gl = this.gl;
        this.quad.material = this.blurMat;
        this.blurMat.uniforms.tex.value = src; this.blurMat.uniforms.dir.value.set(1.6 / w, 0);
        gl.setRenderTarget(a); gl.render(this.postScene, this.postCam);
        this.blurMat.uniforms.tex.value = a.texture; this.blurMat.uniforms.dir.value.set(0, 1.6 / h);
        gl.setRenderTarget(b); gl.render(this.postScene, this.postCam);
    }

    render(dt, t) {
        const gl = this.gl;
        this.placeCamera(dt);
        gl.setRenderTarget(this.rt);
        gl.setClearColor(0x000000, 1);
        gl.clear(true, false, false);
        gl.render(this.scene, this.camera);
        gl.render(this.hudScene, this.hudCam);

        let src = this.rt.texture;
        if (this.crt) {
            const out = this.rtP[this.pIdx], prev = this.rtP[1 - this.pIdx];
            if (this.clearHistory) {
                for (const r of this.rtP) { gl.setRenderTarget(r); gl.clear(true, false, false); }
                this.clearHistory = false;
            }
            this.persistMat.uniforms.prev.value = prev.texture;
            this.persistMat.uniforms.decay.value = Math.pow(1e-15, Math.max(1 / 240, Math.min(dt, 0.05)));
            this.quad.material = this.persistMat;
            gl.setRenderTarget(out); gl.render(this.postScene, this.postCam);
            src = out.texture;
            this.pIdx = 1 - this.pIdx;
        }
        // bloom: half-res tight glow, eighth-res wide glow
        this.quad.material = this.brightMat;
        this.brightMat.uniforms.tex.value = src;
        gl.setRenderTarget(this.rtA2); gl.render(this.postScene, this.postCam);
        this.blur(this.rtA2.texture, this.rtA1, this.rtA2, this.rtA1.width, this.rtA1.height);
        this.quad.material = this.brightMat;
        this.brightMat.uniforms.tex.value = this.rtA2.texture;
        gl.setRenderTarget(this.rtB2); gl.render(this.postScene, this.postCam);
        this.blur(this.rtB2.texture, this.rtB1, this.rtB2, this.rtB1.width, this.rtB1.height);
        this.blur(this.rtB2.texture, this.rtB1, this.rtB2, this.rtB1.width, this.rtB1.height);

        const u = this.finalMat.uniforms;
        u.tex.value = src;
        u.bloomA.value = this.rtA2.texture;
        u.bloomB.value = this.rtB2.texture;
        u.crt.value = this.crt ? 1 : 0;
        u.time.value = t;
        if (this.flash.w > 0) this.flash.w = Math.max(0, this.flash.w - dt * 2.8);
        if (this.aberr > 0) this.aberr = Math.max(0, this.aberr - dt * 8);
        u.aberr.value = this.aberr;
        u.fade.value = this.fade;
        this.quad.material = this.finalMat;
        gl.setRenderTarget(null);
        gl.clear(true, true, true);
        gl.render(this.postScene, this.postCam);
    }
}
