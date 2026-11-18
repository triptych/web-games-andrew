// The painted stage. Backdrop, CG and portraits are composited into an offscreen 2D canvas, which is uploaded as a
// texture and drawn through a WebGL fragment shader that greys each band of hue until its ward has been opened.
// Every painting is generated in full colour; the world's colour is taken away here, and given back band by band.
//
//   Seven hue bands, one per ward: crimson, amber, gold, verdant, sapphire, indigo, violet (data/chapters.js HUES).
//   When a ward opens, its band returns as a ripple from the centre of the screen, with a ring of its colour.
//   Vignette and film grain are strongest in the grey world and fade as colour returns.
//
// Without WebGL the same composite is drawn with a CSS-style grayscale filter (1 - restored/7). A second canvas on
// top carries the particles: grey ash early on, coloured motes and petals as the hues come back.
// The view only reads what main.js hands it; it never touches G.

import { ART, img, GHOSTS } from '../assets.js';
import { HUES } from '../sim/data/chapters.js';
import { portrait } from '../sim/data/cast.js';

const VS = `attribute vec2 p; varying vec2 vUv;
void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// band edges (lo, hi) per hue; red wraps around 0
const BANDS = HUES.map((h) => [h.lo, h.hi < h.lo ? h.hi + 1 : h.hi]);
const FS = `precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uLv[7];
uniform vec4 uRip;          // centre xy, radius, hue index (-1: none)
uniform vec3 uRipCol;
uniform float uAspect, uGloom, uTime, uBoost;
const float E = 0.018;
vec3 hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-5)), d / (q.x + 1e-5), q.x);
}
float inb(float h, float lo, float hi) { return smoothstep(lo - E, lo + E, h) * (1.0 - smoothstep(hi - E, hi + E, h)); }
float band(float h, float lo, float hi) { return max(inb(h, lo, hi), max(inb(h + 1.0, lo, hi), inb(h - 1.0, lo, hi))); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    float h = hsv(c).x;
    vec2 d2 = (vUv - uRip.xy) * vec2(uAspect, 1.0);
    float dist = length(d2);
    float rip = 1.0 - smoothstep(uRip.z - 0.35, uRip.z, dist);
    float lv = 0.0, ws = 0.0;
${BANDS.map(([lo, hi], i) => `    { float w = band(h, ${lo.toFixed(3)}, ${hi.toFixed(3)}); float l = uLv[${i}]; if (abs(uRip.w - ${i}.0) < 0.5) l = max(l, rip); lv += w * l; ws += w; }`).join('\n')}
    lv /= max(ws, 1e-3);
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 grey = vec3(y) * vec3(0.94, 0.97, 1.04);
    vec3 col = mix(grey, c, lv);
    float y2 = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(y2), col, 1.0 + uBoost * 0.22);
    if (uRip.w >= 0.0) {
        float ring = exp(-pow((dist - uRip.z) / 0.05, 2.0)) * 0.45 * (1.0 - smoothstep(1.2, 2.4, uRip.z));
        col += uRipCol * ring;
    }
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    float vig = 1.0 - smoothstep(0.35, 1.05, length(q) / max(1.0, uAspect * 0.62));
    col *= mix(1.0, vig, 0.25 + 0.4 * uGloom);
    col *= 1.0 - 0.12 * uGloom;
    col += (hash(vUv * 731.0 + uTime) - 0.5) * 0.07 * uGloom;
    gl_FragColor = vec4(col, 1.0);
}`;

const POSX = { l: 0.22, c: 0.5, r: 0.78 };
const POSX_TALL = { l: 0.25, c: 0.5, r: 0.75 };
const ease = (a, b, k) => a + (b - a) * k;

export class Stage {
    constructor(canvas, fxCanvas, { reduceMotion = false } = {}) {
        this.canvas = canvas;
        this.fx = fxCanvas;
        this.fxc = fxCanvas.getContext('2d');
        this.reduce = reduceMotion;
        this.c2 = document.createElement('canvas');
        this.x2 = this.c2.getContext('2d');
        this.W = 2; this.H = 2;
        this.t = 0;
        this.bg = null; this.bgPrev = null; this.bgFade = 1; this.bgFit = 'cover';
        this.cg = null; this.cgPrev = null; this.cgFade = 1;
        this.actors = new Map();      // id -> { key, x, a, want, pos, speak, s }
        this.speaking = null;
        this.lv = [0, 0, 0, 0, 0, 0, 0];
        this.lvWant = [0, 0, 0, 0, 0, 0, 0];
        this.rip = null;              // { hue, r }
        this.boost = 0; this.boostWant = 0;
        this.gloom = 1;
        this.dirty = true;
        this.dark = new Map();        // portrait src -> darkened canvas
        this.parts = [];
        this.gl = null;
        try { this._initGL(); } catch (err) { console.warn('[stage] no WebGL, falling back to 2D', err); this.gl = null; }
        if (!this.gl) this.ctx = canvas.getContext('2d');
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
        canvas.addEventListener('webglcontextrestored', () => { this.lost = false; try { this._initGL(); this.dirty = true; } catch { this.gl = null; } });
    }

    get webgl() { return !!this.gl; }

    _initGL() {
        const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
        if (!gl) return;
        const sh = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        gl.useProgram(pr);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        this.u = {};
        for (const n of ['uLv', 'uRip', 'uRipCol', 'uAspect', 'uGloom', 'uTime', 'uBoost', 'uTex']) this.u[n] = gl.getUniformLocation(pr, n);
        gl.uniform1i(this.u.uTex, 0);
        this.gl = gl;
        this.uploaded = false;
    }

    /** Size in CSS px; the backing store is capped so a 3x phone does not upload a 2532 px texture every frame. */
    resize(cssW, cssH) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const s = Math.min(dpr, 1600 / Math.max(cssW, cssH));
        const W = Math.max(2, Math.round(cssW * s)), H = Math.max(2, Math.round(cssH * s));
        this.cssW = cssW; this.cssH = cssH;
        for (const c of [this.canvas, this.fx]) {
            c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
        }
        if (W === this.W && H === this.H) return;
        this.W = W; this.H = H;
        this.canvas.width = W; this.canvas.height = H;
        this.c2.width = W; this.c2.height = H;
        this.fx.width = W; this.fx.height = H;
        this.dirty = true;
    }

    // ------------------------------------------------------------ what is on the stage
    /** A backdrop: a bg id, a url, or null. `fit` is 'cover' or 'contain' (the map on a tall phone). */
    setBg(src, fit = 'cover', instant = false) {
        if (src && !src.includes('/')) src = ART.bg(src);
        if (src === this.bg && fit === this.bgFit) return;
        if (src !== this.bg) { this.bgPrev = this.bg; this.bg = src; this.bgFade = instant || !this.bgPrev ? 1 : 0; }
        this.bgFit = fit;
        if (src) img(src);
        this.dirty = true;
    }

    setCg(id) {
        const src = id ? ART.cg(id) : null;
        if (src === this.cg) return;
        this.cgPrev = this.cg; this.cg = src; this.cgFade = 0;
        if (src) img(src);
        this.dirty = true;
    }

    /** The portraits on stage: [{ id, expr, pos }], and who is speaking. */
    setActors(list, speaking = null) {
        const want = new Set(list.map((a) => a.id));
        for (const [id, A] of this.actors) if (!want.has(id)) A.want = 0;
        for (const a of list) {
            const key = portrait(a.id, a.expr);
            if (!key) continue;
            let A = this.actors.get(a.id);
            if (!A || A.want === 0 && A.a < 0.05) {
                A = { id: a.id, key, pos: a.pos, x: null, a: 0, want: 1, s: a.id === speaking ? 1 : 0 };
                this.actors.set(a.id, A);
            }
            A.key = key; A.pos = a.pos; A.want = 1;
            img(ART.por(key));
        }
        this.speaking = speaking;
        this.dirty = true;
    }

    clear() { this.setActors([]); this.setCg(null); }

    /** The restored hues (G.hues). `instant` jumps there (a loaded game); otherwise new bands wait for ripple(). */
    setHues(hues, instant = false) {
        for (let i = 0; i < 7; i++) {
            this.lvWant[i] = hues[i] ? 1 : 0;
            if (instant || !hues[i]) this.lv[i] = this.lvWant[i];
            if (this.rip && this.rip.hue === i && !hues[i]) this.rip = null;
        }
        const n = hues.reduce((a, b) => a + (b ? 1 : 0), 0);
        this.boostWant = n >= 7 ? 1 : 0;
        if (instant) { this.boost = this.boostWant; this.gloom = 1 - n / 7; }
        this.n = n;
    }

    /** A band of colour returns, spreading from (x, y) in 0..1 screen coordinates. */
    ripple(hue, x = 0.5, y = 0.5) {
        if (this.reduce) { this.lv[hue] = 1; return; }
        if (this.rip) this.lv[this.rip.hue] = 1;
        this.rip = { hue, r: 0, x, y: 1 - y };
        this.lv[hue] = 0;
    }

    /** The title screen's palette: only the book's gold until the story has been finished once. */
    titleHues(done) { return done ? [1, 1, 1, 1, 1, 1, 1] : [0, 0, 1, 0, 0, 0, 0]; }

    // ------------------------------------------------------------ frame
    frame(dt) {
        this.t += dt;
        const k = 1 - Math.exp(-dt * 6);
        let anim = false;
        if (this.bgFade < 1) { this.bgFade = Math.min(1, this.bgFade + dt / 0.8); anim = true; }
        if (this.cgFade < 1) { this.cgFade = Math.min(1, this.cgFade + dt / 0.7); anim = true; }
        for (const [id, A] of this.actors) {
            const tx = this._actorX(A.pos);
            if (A.x === null) A.x = tx;
            const s = id === this.speaking ? 1 : 0;
            if (Math.abs(A.x - tx) > 0.5 || Math.abs(A.a - A.want) > 0.01 || Math.abs(A.s - s) > 0.01) anim = true;
            A.x = ease(A.x, tx, k); A.a = ease(A.a, A.want, 1 - Math.exp(-dt * 8)); A.s = ease(A.s, s, k);
            if (A.want === 0 && A.a < 0.01) this.actors.delete(id);
            if (GHOSTS.has(id)) anim = true;
        }
        if (this.rip) {
            this.rip.r += dt * 0.75;
            if (this.rip.r > 2.6) { this.lv[this.rip.hue] = 1; this.rip = null; }
        }
        for (let i = 0; i < 7; i++) if (this.lvWant[i] && !(this.rip && this.rip.hue === i) && this.lv[i] < 1) this.lv[i] = Math.min(1, this.lv[i] + dt * 0.5);
        const restored = this.lv.reduce((a, b) => a + b, 0);
        this.gloom = ease(this.gloom, 1 - restored / 7, 1 - Math.exp(-dt * 1.5));
        this.boost = ease(this.boost, this.boostWant, 1 - Math.exp(-dt * 0.8));
        if (anim || this.dirty) this._compose();
        this.dirty = false;
        this._present();
        this._particles(dt);
    }

    _actorX(pos) {
        const P = this.W / this.H < 1 ? POSX_TALL : POSX;
        return (P[pos] ?? 0.5) * this.W;
    }

    /** The rectangle a w×h image fills: 'cover' or 'contain', centred. */
    fit(w, h, mode = 'cover') {
        const s = mode === 'cover' ? Math.max(this.W / w, this.H / h) : Math.min(this.W / w, this.H / h);
        const dw = w * s, dh = h * s;
        return { x: (this.W - dw) / 2, y: (this.H - dh) / 2, w: dw, h: dh, s };
    }

    _draw(src, alpha, mode = 'cover', yBias = 0.5) {
        if (!src || alpha <= 0) return;
        const im = img(src);
        if (!im.complete || !im.naturalWidth) { im.onload = () => { this.dirty = true; }; return; }
        const r = this.fit(im.naturalWidth, im.naturalHeight, mode);
        if (mode === 'contain') r.y = (this.H - r.h) * yBias;
        const x = this.x2;
        x.globalAlpha = alpha;
        x.drawImage(im, r.x, r.y, r.w, r.h);
        x.globalAlpha = 1;
    }

    _compose() {
        const x = this.x2, W = this.W, H = this.H;
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#0b0b0e';
        x.fillRect(0, 0, W, H);
        const fit = this.bgFit;
        if (this.bgFade < 1) this._draw(this.bgPrev, 1, fit);
        this._draw(this.bg, this.bgFade, fit);
        // portraits stand on the stage floor; in a tall window they are smaller so two can stand side by side
        const tall = W / H < 1;
        const ph = H * (tall ? 0.62 : 0.88);
        for (const A of this.actors.values()) {
            const src = ART.por(A.key);
            const im = img(src);
            if (!im.complete || !im.naturalWidth) { im.onload = () => { this.dirty = true; }; continue; }
            const h = ph, w = im.naturalWidth * (h / im.naturalHeight);
            const ghost = GHOSTS.has(A.id);
            const bob = ghost && !this.reduce ? Math.sin(this.t * 1.3) * H * 0.008 : 0;
            const y = H - h + (ghost ? -H * 0.02 + bob : H * 0.02);
            const px = A.x - w / 2;
            if (ghost) {
                x.globalCompositeOperation = 'lighter';
                x.globalAlpha = A.a * (0.78 + 0.12 * A.s + (this.reduce ? 0 : 0.05 * Math.sin(this.t * 2.1)));
                x.drawImage(im, px, y, w, h);
                x.globalCompositeOperation = 'source-over';
            } else {
                x.globalAlpha = A.a;
                x.drawImage(this._darkened(src, im), px, y, w, h);
                if (A.s > 0.01) { x.globalAlpha = A.a * A.s; x.drawImage(im, px, y, w, h); }
            }
            x.globalAlpha = 1;
        }
        // a CG covers the stage; on a tall screen it is shown whole in the upper part, over a dimmed copy of itself
        const drawCg = (src, a) => {
            if (!src || a <= 0) return;
            if (tall) {
                x.globalAlpha = a; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
                this._draw(src, a * 0.35, 'cover');
                this._draw(src, a, 'contain', 0.3);
            } else this._draw(src, a, 'cover');
        };
        if (this.cgFade < 1) drawCg(this.cgPrev, 1 - this.cgFade);
        drawCg(this.cg, this.cgFade);
        this.uploaded = false;
    }

    _darkened(src, im) {
        let c = this.dark.get(src);
        if (c) return c;
        c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = 'rgba(8, 8, 14, 0.34)';
        x.fillRect(0, 0, c.width, c.height);
        this.dark.set(src, c);
        return c;
    }

    _present() {
        const gl = this.gl;
        if (!gl || this.lost) {
            if (!this.ctx) return;
            const n = this.lv.reduce((a, b) => a + b, 0);
            this.ctx.filter = `grayscale(${(1 - n / 7).toFixed(3)})`;
            this.ctx.drawImage(this.c2, 0, 0);
            this.ctx.filter = 'none';
            return;
        }
        gl.viewport(0, 0, this.W, this.H);
        if (!this.uploaded) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.c2); this.uploaded = true; }
        gl.uniform1fv(this.u.uLv, this.lv);
        const r = this.rip;
        gl.uniform4f(this.u.uRip, r ? r.x : 0.5, r ? r.y : 0.5, r ? r.r : 0, r ? r.hue : -1);
        const col = r ? hexRgb(HUES[r.hue].css) : [0, 0, 0];
        gl.uniform3f(this.u.uRipCol, col[0], col[1], col[2]);
        gl.uniform1f(this.u.uAspect, this.W / this.H);
        gl.uniform1f(this.u.uGloom, this.gloom);
        gl.uniform1f(this.u.uTime, this.reduce ? 0 : (this.t % 100));
        gl.uniform1f(this.u.uBoost, this.boost);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ------------------------------------------------------------ particles: ash, then motes, then petals
    _particles(dt) {
        const c = this.fxc, W = this.W, H = this.H;
        c.clearRect(0, 0, W, H);
        if (this.reduce) return;
        const want = Math.round((W * H > 900000 ? 70 : 42) * (this.partScale ?? 1));
        const restored = [];
        for (let i = 0; i < 7; i++) if (this.lv[i] > 0.5) restored.push(i);
        const sc = W / 1000 + H / 1600;
        while (this.parts.length < want) this.parts.push(this._spawn(restored, true));
        if (this.parts.length > want) this.parts.length = want;
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.life += dt;
            p.x += (p.vx + Math.sin(this.t * p.wf + p.ph) * p.sw) * dt * sc * 60;
            p.y += p.vy * dt * sc * 60;
            if (p.y > H + 20 || p.y < -20 || p.x < -20 || p.x > W + 20) { this.parts[i] = this._spawn(restored, false); continue; }
            const fade = Math.min(1, p.life / 1.5);
            if (p.kind === 'ash') {
                c.globalCompositeOperation = 'source-over';
                c.globalAlpha = 0.35 * fade * p.o;
                c.fillStyle = p.col;
                c.save(); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
                c.fillRect(-p.s * sc, -p.s * sc * 0.6, p.s * sc * 2, p.s * sc * 1.2);
                c.restore();
            } else if (p.kind === 'petal') {
                c.globalCompositeOperation = 'source-over';
                c.globalAlpha = 0.8 * fade;
                c.fillStyle = p.col;
                c.save(); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
                c.beginPath(); c.ellipse(0, 0, p.s * sc * 1.6, p.s * sc * 0.8, 0, 0, Math.PI * 2); c.fill();
                c.restore();
            } else {
                c.globalCompositeOperation = 'lighter';
                const tw = 0.55 + 0.45 * Math.sin(this.t * p.wf * 3 + p.ph);
                c.globalAlpha = 0.75 * fade * tw;
                const r = p.s * sc * 3;
                const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g;
                c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
            }
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
    }

    _spawn(restored, anywhere) {
        const W = this.W, H = this.H;
        const n = restored.length;
        const r = Math.random();
        let kind = 'ash';
        if (n && r < n / 7 * 0.85) kind = n >= 7 && Math.random() < 0.45 ? 'petal' : 'mote';
        const hue = n ? restored[Math.floor(Math.random() * n)] : 0;
        const p = {
            kind, life: 0, ph: Math.random() * 6.28, wf: 0.4 + Math.random() * 0.8, spin: (Math.random() - 0.5) * 3,
            o: 0.5 + Math.random() * 0.5, s: 1 + Math.random() * 2,
        };
        if (kind === 'ash') {
            const g = 150 + Math.floor(Math.random() * 70);
            p.col = `rgb(${g},${g},${g + 6})`;
            p.vx = 0.15 + Math.random() * 0.25; p.vy = 0.25 + Math.random() * 0.45; p.sw = 0.3;
            p.x = Math.random() * W * 1.1 - W * 0.1; p.y = anywhere ? Math.random() * H : -10;
        } else if (kind === 'petal') {
            p.col = HUES[hue].css;
            p.vx = 0.3 + Math.random() * 0.4; p.vy = 0.35 + Math.random() * 0.5; p.sw = 0.6;
            p.x = Math.random() * W * 1.1 - W * 0.1; p.y = anywhere ? Math.random() * H : -10;
        } else {
            p.col = HUES[hue].css;
            p.vx = (Math.random() - 0.5) * 0.2; p.vy = -(0.15 + Math.random() * 0.35); p.sw = 0.4;
            p.x = Math.random() * W; p.y = anywhere ? Math.random() * H : H + 10;
        }
        return p;
    }
}

function hexRgb(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}
