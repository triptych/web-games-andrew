/**
 * scene.js — the renderer: a real three.js scene drawn into a small render
 * target (240 px tall) and blown up with nearest-neighbour filtering, so
 * every surface — sprites, textures, geometry edges — lands on the same
 * chunky pixel grid. A tiny bloom pass makes neon glow, and an optional CRT
 * pass adds scanlines and a vignette.
 *
 * World mapping: three X = x, Y = y * YS, Z = -z * ZS. The camera pitches
 * down 27° so the walkable strip reads as depth; sprites stay upright and are
 * stretched by YS = 1/cos(pitch) so they keep their true pixel height.
 */

import * as THREE from 'three';

export const LOW_H = 240;
export const PITCH = 27 * Math.PI / 180;
export const YS = 1 / Math.cos(PITCH);
export const ZS = 2.2;
export const CAM_DIST = 600;
export const LOOK_Y = 80;

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FS = `
uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec3 c = texture2D(tex, vUv + vec2(float(i), float(j)) * texel * 1.5).rgb;
    float l = max(c.r, max(c.g, c.b));
    float wgt = 1.0 / (1.0 + float(i*i + j*j));
    acc += c * smoothstep(0.74, 1.0, l) * wgt; wsum += wgt;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
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
uniform sampler2D tex; uniform sampler2D bloom; uniform vec2 lowRes; uniform float crt; uniform float bloomAmt;
uniform vec4 flash; uniform float time; uniform float aberr; uniform float fade;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  vec3 c = texture2D(tex, uv).rgb;
  if (aberr > 0.0) {
    float o = aberr / lowRes.x;
    c.r = texture2D(tex, uv + vec2(o, 0.0)).r;
    c.b = texture2D(tex, uv - vec2(o, 0.0)).b;
  }
  c += texture2D(bloom, uv).rgb * bloomAmt;
  if (crt > 0.5) {
    float row = fract(uv.y * lowRes.y);
    c *= 0.84 + 0.16 * smoothstep(0.0, 0.35, row) * smoothstep(1.0, 0.65, row);
    vec2 d = uv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
  }
  c = mix(c, flash.rgb, flash.a);
  c *= fade;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
        this.gl.setPixelRatio(1);
        THREE.ColorManagement.enabled = false;
        this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        this.gl.autoClear = false;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(22, 16 / 9, 20, 3000);
        // Sky, skyline and distant towers live in their own scene with a level
        // camera, drawn first; the street scene is drawn over it after a depth
        // clear. Lets the pitched street camera still show a horizon.
        this.bgScene = new THREE.Scene();
        this.bgCamera = new THREE.PerspectiveCamera(22, 16 / 9, 50, 9000);
        this.clearColor = new THREE.Color(0x000000);
        this.lowW = 427; this.lowH = LOW_H;
        this.crt = true; this.bloomOn = true;
        this.flash = new THREE.Vector4(1, 1, 1, 0);
        this.shake = 0; this.shakeT = 0; this.aberr = 0; this.fade = 1;
        this.camX = 0; this.camYOff = 0; this.zoom = 1;

        const rtOpts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, type: THREE.UnsignedByteType };
        this.rt = new THREE.WebGLRenderTarget(16, 16, rtOpts);
        const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
        this.rtB1 = new THREE.WebGLRenderTarget(8, 8, lin);
        this.rtB2 = new THREE.WebGLRenderTarget(8, 8, lin);

        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quad = new THREE.PlaneGeometry(2, 2);
        this.brightMat = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: BRIGHT_FS, uniforms: { tex: { value: this.rt.texture }, texel: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
        this.blurMat = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: BLUR_FS, uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
        this.finalMat = new THREE.ShaderMaterial({
            vertexShader: POST_VS, fragmentShader: FINAL_FS, depthTest: false, depthWrite: false,
            uniforms: { tex: { value: this.rt.texture }, bloom: { value: this.rtB2.texture }, lowRes: { value: new THREE.Vector2() }, crt: { value: 1 }, bloomAmt: { value: 0.9 }, flash: { value: this.flash }, time: { value: 0 }, aberr: { value: 0 }, fade: { value: 1 } },
        });
        this.quad = new THREE.Mesh(quad, this.finalMat);
        this.quad.frustumCulled = false;
        this.postScene.add(this.quad);
    }

    /** Fit to the CSS size of the canvas. Returns the low-res width (= world view width). */
    resize(cssW, cssH, dpr) {
        const pr = Math.min(dpr || 1, 2);
        this.gl.setSize(Math.round(cssW * pr), Math.round(cssH * pr), false);
        this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
        const aspect = cssW / cssH;
        this.lowH = LOW_H;
        this.lowW = Math.max(240, Math.min(600, Math.round(LOW_H * aspect)));
        this.rt.setSize(this.lowW, this.lowH);
        this.rtB1.setSize(this.lowW >> 1, this.lowH >> 1);
        this.rtB2.setSize(this.lowW >> 1, this.lowH >> 1);
        this.brightMat.uniforms.texel.value.set(1 / this.lowW, 1 / this.lowH);
        this.finalMat.uniforms.lowRes.value.set(this.lowW, this.lowH);
        this.camera.aspect = this.lowW / this.lowH;
        this.camera.fov = 2 * Math.atan((LOW_H / 2) / CAM_DIST) * 180 / Math.PI;
        this.camera.updateProjectionMatrix();
        this.bgCamera.aspect = this.camera.aspect; this.bgCamera.fov = this.camera.fov * 1.6;
        this.bgCamera.updateProjectionMatrix();
        return this.lowW;
    }

    /** Put the camera over world x (and depth centre zMid in sim units). */
    placeCamera(camX, zMid, dt) {
        let sx = 0, sy = 0;
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            const a = this.shake * Math.min(1, this.shakeT * 4);
            sx = (Math.random() - 0.5) * a * 2; sy = (Math.random() - 0.5) * a * 2;
        }
        const tz = -zMid * ZS;
        const d = CAM_DIST / this.zoom;
        const tx = Math.round(camX) + sx, ty = LOOK_Y + this.camYOff + sy;
        this.camera.position.set(tx, ty + Math.sin(PITCH) * d, tz + Math.cos(PITCH) * d);
        this.camera.lookAt(tx, ty, tz);
        this.bgCamera.position.set(tx, 140 + sy * 0.5, 0);
        this.bgCamera.lookAt(tx, 196 + sy * 0.5, -1000);
    }

    addShake(a, dur = 0.3) { this.shake = Math.max(this.shake * (this.shakeT > 0 ? 1 : 0), a); this.shakeT = Math.max(this.shakeT, dur); }

    render(dt, t) {
        const gl = this.gl;
        gl.setRenderTarget(this.rt);
        gl.setClearColor(this.clearColor, 1);
        gl.clear(true, true, true);
        gl.render(this.bgScene, this.bgCamera);
        gl.clearDepth();
        gl.render(this.scene, this.camera);
        if (this.bloomOn) {
            this.quad.material = this.brightMat;
            gl.setRenderTarget(this.rtB1); gl.render(this.postScene, this.postCam);
            this.quad.material = this.blurMat;
            this.blurMat.uniforms.tex.value = this.rtB1.texture; this.blurMat.uniforms.dir.value.set(2 / this.lowW, 0);
            gl.setRenderTarget(this.rtB2); gl.render(this.postScene, this.postCam);
            this.blurMat.uniforms.tex.value = this.rtB2.texture; this.blurMat.uniforms.dir.value.set(0, 2 / this.lowH);
            gl.setRenderTarget(this.rtB1); gl.render(this.postScene, this.postCam);
            this.finalMat.uniforms.bloom.value = this.rtB1.texture;
        }
        this.finalMat.uniforms.bloomAmt.value = this.bloomOn ? 0.85 : 0;
        this.finalMat.uniforms.crt.value = this.crt ? 1 : 0;
        this.finalMat.uniforms.time.value = t;
        if (this.flash.w > 0) this.flash.w = Math.max(0, this.flash.w - dt * 3);
        if (this.aberr > 0) this.aberr = Math.max(0, this.aberr - dt * 8);
        this.finalMat.uniforms.aberr.value = this.aberr;
        this.finalMat.uniforms.fade.value = this.fade;
        this.quad.material = this.finalMat;
        gl.setRenderTarget(null);
        gl.render(this.postScene, this.postCam);
    }

    flashScreen(color, a = 0.7) {
        const c = { white: [1, 1, 1], red: [1, 0.2, 0.25], gold: [1, 0.85, 0.4], cyan: [0.4, 1, 1] }[color] || [1, 1, 1];
        this.flash.set(c[0], c[1], c[2], a);
    }
}

/** World (sim) coordinates -> three.js position. */
export function toThree(x, y, z, out) {
    out.set(x, y * YS, -z * ZS);
    return out;
}
