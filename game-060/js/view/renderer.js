// The monitor: a three.js scene drawn into a 240×320 render target and blown up
// with nearest-neighbour sampling. On the way to the screen it gets phosphor
// persistence, bloom, and a CRT pass (curvature, scanlines, aperture grille,
// vignette, chromatic aberration, colour flashes).
//
// The camera is far back with a narrow FOV, so the z = 0 plane maps exactly onto
// the low-res pixel grid (1 world unit = 1 pixel) while anything with depth —
// debris, backdrops, the logo assembling — is still really 3D.

import * as THREE from 'three';
import { W as LW, H as LH } from '../config.js';

export const CAM_DIST = 1600;
export const FOV = 2 * Math.atan(LH / 2 / CAM_DIST) * 180 / Math.PI;

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PERSIST_FS = `
uniform sampler2D cur; uniform sampler2D prev; uniform float decay; varying vec2 vUv;
void main(){
  vec3 c = texture2D(cur, vUv).rgb;
  vec3 p = texture2D(prev, vUv).rgb * decay;
  gl_FragColor = vec4(max(c, p), 1.0);
}`;

const BRIGHT_FS = `
uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec3 acc = vec3(0.0);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec3 c = texture2D(tex, vUv + vec2(float(i), float(j)) * texel).rgb;
    float l = max(c.r, max(c.g, c.b));
    acc += c * smoothstep(0.62, 1.15, l);
  }
  gl_FragColor = vec4(acc / 9.0, 1.0);
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
uniform sampler2D tex; uniform sampler2D bloom; uniform vec2 lowRes; uniform vec2 outRes;
uniform float crt; uniform float bloomAmt; uniform vec4 flash; uniform float time; uniform float aberr; uniform float fade; uniform float mask;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  float edge = 1.0;
  if (crt > 0.5) {
    vec2 cc = uv - 0.5;
    uv = 0.5 + cc * (1.0 + 0.085 * dot(cc, cc) * 4.0) * 0.985;
    vec2 e = smoothstep(vec2(0.0), vec2(0.006), uv) * smoothstep(vec2(0.0), vec2(0.006), 1.0 - uv);
    edge = e.x * e.y;
  }
  vec3 c = texture2D(tex, uv).rgb;
  if (aberr > 0.0) {
    float o = aberr / lowRes.x;
    c.r = texture2D(tex, uv + vec2(o, 0.0)).r;
    c.b = texture2D(tex, uv - vec2(o, 0.0)).b;
  }
  vec3 b = texture2D(bloom, uv).rgb;
  c += b * bloomAmt;
  if (crt > 0.5) {
    float row = fract(uv.y * lowRes.y);
    float scan = mix(1.0, 0.80 + 0.20 * smoothstep(0.0, 0.4, row) * smoothstep(1.0, 0.6, row), clamp(outRes.y / lowRes.y / 2.5, 0.0, 1.0));
    c *= scan;
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 grille = m < 1.0 ? vec3(1.08, 0.94, 0.94) : (m < 2.0 ? vec3(0.94, 1.08, 0.94) : vec3(0.94, 0.94, 1.08));
    c *= mix(vec3(1.0), grille, mask);
    vec2 d = uv - 0.5;
    c *= 1.0 - dot(d, d) * 0.7;
    c *= 0.985 + 0.015 * sin(time * 120.0);
    c += b * 0.08;
  }
  c = mix(c, flash.rgb, flash.a);
  c *= fade * edge;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        gl.setPixelRatio(1);
        THREE.ColorManagement.enabled = false;
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        gl.autoClear = false;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, LW / LH, 20, 9000);
        this.hudScene = new THREE.Scene();
        this.hudCam = new THREE.OrthographicCamera(0, LW, LH, 0, -10, 10);

        this.crt = true; this.bloomOn = true; this.persist = true;
        this.flash = new THREE.Vector4(1, 1, 1, 0);
        this.shakeAmt = 0; this.shakeT = 0; this.rollAmt = 0; this.aberr = 0; this.fade = 1;
        this.camOff = new THREE.Vector3();

        const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, type: THREE.HalfFloatType };
        this.rt = new THREE.WebGLRenderTarget(LW, LH, nearest);
        const nearestNoDepth = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, type: THREE.HalfFloatType };
        this.rtP = [new THREE.WebGLRenderTarget(LW, LH, nearestNoDepth), new THREE.WebGLRenderTarget(LW, LH, nearestNoDepth)];
        this.pIdx = 0;
        const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, type: THREE.HalfFloatType };
        this.rtB1 = new THREE.WebGLRenderTarget(LW / 2, LH / 2, lin);
        this.rtB2 = new THREE.WebGLRenderTarget(LW / 2, LH / 2, lin);

        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
        this.persistMat = mk(PERSIST_FS, { cur: { value: this.rt.texture }, prev: { value: null }, decay: { value: 0.55 } });
        this.brightMat = mk(BRIGHT_FS, { tex: { value: null }, texel: { value: new THREE.Vector2(1 / LW, 1 / LH) } });
        this.blurMat = mk(BLUR_FS, { tex: { value: null }, dir: { value: new THREE.Vector2() } });
        this.finalMat = mk(FINAL_FS, {
            tex: { value: null }, bloom: { value: this.rtB1.texture }, lowRes: { value: new THREE.Vector2(LW, LH) }, outRes: { value: new THREE.Vector2(LW, LH) },
            crt: { value: 1 }, bloomAmt: { value: 0.9 }, flash: { value: this.flash }, time: { value: 0 }, aberr: { value: 0 }, fade: { value: 1 }, mask: { value: 0 },
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
        this.quad.frustumCulled = false;
        this.postScene.add(this.quad);
        this.placeCamera(0);
    }

    resize(cssW, cssH, dpr) {
        const pr = Math.min(dpr || 1, 2);
        const w = Math.max(1, Math.round(cssW * pr)), h = Math.max(1, Math.round(cssH * pr));
        this.gl.setSize(w, h, false);
        this.canvas.style.width = cssW + 'px';
        this.canvas.style.height = cssH + 'px';
        this.finalMat.uniforms.outRes.value.set(w, h);
        // the aperture grille only reads when each low-res pixel is several device pixels wide
        this.finalMat.uniforms.mask.value = Math.max(0, Math.min(1, (w / LW - 2.5) / 2)) * 0.6;
    }

    shake(amount, dur = 0.25, roll = 0) {
        this.shakeAmt = Math.max(this.shakeT > 0 ? this.shakeAmt : 0, amount);
        this.shakeT = Math.max(this.shakeT, dur);
        this.rollAmt = Math.max(this.rollAmt, roll);
    }

    flashScreen(rgb, a = 0.6) { this.flash.set(rgb[0], rgb[1], rgb[2], Math.max(this.flash.w, a)); }
    aberrate(a) { this.aberr = Math.max(this.aberr, a); }

    placeCamera(dt) {
        let sx = 0, sy = 0, roll = 0;
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            const k = Math.min(1, this.shakeT * 5);
            sx = Math.round((Math.random() - 0.5) * 2 * this.shakeAmt * k);
            sy = Math.round((Math.random() - 0.5) * 2 * this.shakeAmt * k);
            roll = (Math.random() - 0.5) * this.rollAmt * k;
        } else { this.rollAmt = 0; }
        const cx = LW / 2 + sx + this.camOff.x, cy = LH / 2 + sy + this.camOff.y;
        this.camera.position.set(cx, cy, CAM_DIST + this.camOff.z);
        this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
        this.camera.lookAt(cx, cy, 0);
    }

    render(dt, t) {
        const gl = this.gl;
        this.placeCamera(dt);
        gl.setRenderTarget(this.rt);
        gl.setClearColor(0x000000, 1);
        gl.clear(true, true, true);
        gl.render(this.scene, this.camera);
        gl.clearDepth();
        gl.render(this.hudScene, this.hudCam);

        let src = this.rt.texture;
        if (this.persist) {
            const out = this.rtP[this.pIdx], prev = this.rtP[1 - this.pIdx];
            this.persistMat.uniforms.prev.value = prev.texture;
            this.quad.material = this.persistMat;
            gl.setRenderTarget(out); gl.render(this.postScene, this.postCam);
            src = out.texture;
            this.pIdx = 1 - this.pIdx;
        }
        if (this.bloomOn) {
            this.brightMat.uniforms.tex.value = src;
            this.quad.material = this.brightMat;
            gl.setRenderTarget(this.rtB1); gl.render(this.postScene, this.postCam);
            this.quad.material = this.blurMat;
            this.blurMat.uniforms.tex.value = this.rtB1.texture; this.blurMat.uniforms.dir.value.set(2 / LW, 0);
            gl.setRenderTarget(this.rtB2); gl.render(this.postScene, this.postCam);
            this.blurMat.uniforms.tex.value = this.rtB2.texture; this.blurMat.uniforms.dir.value.set(0, 2 / LH);
            gl.setRenderTarget(this.rtB1); gl.render(this.postScene, this.postCam);
        }
        const u = this.finalMat.uniforms;
        u.tex.value = src;
        u.bloomAmt.value = this.bloomOn ? 0.95 : 0;
        u.crt.value = this.crt ? 1 : 0;
        u.time.value = t;
        if (this.flash.w > 0) this.flash.w = Math.max(0, this.flash.w - dt * 3.2);
        if (this.aberr > 0) this.aberr = Math.max(0, this.aberr - dt * 7);
        u.aberr.value = this.aberr;
        u.fade.value = this.fade;
        this.quad.material = this.finalMat;
        gl.setRenderTarget(null);
        gl.clear(true, true, true);
        gl.render(this.postScene, this.postCam);
    }
}
