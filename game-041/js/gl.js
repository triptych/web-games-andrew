// ============================================================
// WebGL renderer: one sprite batcher + an arcade-monitor post pass.
// ============================================================
// Everything on screen — terrain, sprites, text, touch controls — is a
// textured quad from one atlas, drawn in device pixels. Pixel art is scaled
// to any size with a "sharp bilinear" filter: nearest-neighbour inside each
// texel, a one-screen-pixel blend at texel edges. That is what keeps 16px
// sprites crisp at 3.7x on a phone without the shimmer of non-integer
// nearest-neighbour.
//
// Post pass (HIGH quality): scene -> quarter-res bright pass -> separable
// blur -> composite with scanlines and vignette. LOW draws straight to the
// back buffer and skips all of it.

const FLOATS_PER_VERT = 9;           // x y u v r g b a mode
const MAX_QUADS = 6000;

const SPRITE_VS = `
attribute vec2 aPos;
attribute vec2 aUV;
attribute vec4 aCol;
attribute float aMode;
uniform vec2 uRes;
varying vec2 vUV;
varying vec4 vCol;
varying float vMode;
void main() {
    vUV = aUV; vCol = aCol; vMode = aMode;
    vec2 p = aPos / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

function spriteFS(deriv) {
    return `${deriv ? '#extension GL_OES_standard_derivatives : enable' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform vec2 uTexSize;
varying vec2 vUV;
varying vec4 vCol;
varying float vMode;
void main() {
    vec2 px = vUV * uTexSize;
    ${deriv ? `vec2 seam = floor(px + 0.5);
    vec2 d = max(fwidth(px), vec2(1e-4));
    px = seam + clamp((px - seam) / d, -0.5, 0.5);` : ''}
    vec4 t = texture2D(uTex, px / uTexSize);
    vec3 rgb = mix(t.rgb * vCol.rgb, vCol.rgb, vMode);
    gl_FragColor = vec4(rgb, t.a * vCol.a);
}`;
}

const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

// Four bilinear taps = a 4x4 box of full-res pixels per quarter-res pixel.
const BRIGHT_FS = PREC + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
varying vec2 vUV;
// Threshold sits above the brightest dirt speckle so only neon, sparks and
// highlights glow — not the sandy top stratum.
vec3 bright(vec3 c) { return max(c - 0.7, 0.0) * 3.3; }
void main() {
    vec3 c = bright(texture2D(uSrc, vUV + uTexel * vec2(-1.0, -1.0)).rgb)
           + bright(texture2D(uSrc, vUV + uTexel * vec2( 1.0, -1.0)).rgb)
           + bright(texture2D(uSrc, vUV + uTexel * vec2(-1.0,  1.0)).rgb)
           + bright(texture2D(uSrc, vUV + uTexel * vec2( 1.0,  1.0)).rgb);
    gl_FragColor = vec4(c * 0.25, 1.0);
}`;

const BLUR_FS = PREC + `
uniform sampler2D uSrc;
uniform vec2 uStep;
varying vec2 vUV;
void main() {
    vec3 c = texture2D(uSrc, vUV).rgb * 0.227027;
    c += texture2D(uSrc, vUV + uStep * 1.3846).rgb * 0.316216;
    c += texture2D(uSrc, vUV - uStep * 1.3846).rgb * 0.316216;
    c += texture2D(uSrc, vUV + uStep * 3.2308).rgb * 0.070270;
    c += texture2D(uSrc, vUV - uStep * 3.2308).rgb * 0.070270;
    gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FS = PREC + `
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform float uScan;
uniform float uScanOff;
uniform float uScanAmt;
uniform vec2 uRes;
varying vec2 vUV;
void main() {
    vec3 c = texture2D(uScene, vUV).rgb;
    vec3 b = texture2D(uBloom, vUV).rgb;
    c += b * uBloomAmt;
    // Scanlines at the sprite-pixel pitch, so they line up with the art.
    float y = (uRes.y - gl_FragCoord.y) - uScanOff;
    float s = 0.5 + 0.5 * cos(y / uScan * 6.2831853);
    c *= 1.0 - uScanAmt * (1.0 - s);
    vec2 q = vUV - 0.5;
    c *= 1.0 - dot(q, q) * 0.55;
    gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('shader: ' + log);
    }
    return s;
}

function program(gl, vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
}

const colorCache = new Map();
/** '#rrggbb' + alpha -> [r, g, b, a] in 0..1 (cached). */
export function rgba(hex, a = 1) {
    const key = hex + a;
    let c = colorCache.get(key);
    if (!c) {
        const n = parseInt(hex.slice(1), 16);
        c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
        colorCache.set(key, c);
    }
    return c;
}

export const WHITE = [1, 1, 1, 1];

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const opts = {
            antialias: false, alpha: false, depth: false, stencil: false,
            premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
        };
        const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
        if (!gl) throw new Error('WebGL is not available');
        this.gl = gl;
        this.verts = new Float32Array(MAX_QUADS * 4 * FLOATS_PER_VERT);
        this.nQuads = 0;
        this.post = true;
        this.bloomAmt = 1.0;
        this.scan = 3;
        this.scanOff = 0;
        this.scanAmt = 0.16;
        this.blendMode = 'alpha';
        this.drawCalls = 0;
        this.atlas = null;
        this.init();
    }

    /** Creates every GL resource. Called again after a lost context is restored. */
    init() {
        const gl = this.gl;
        this.deriv = !!gl.getExtension('OES_standard_derivatives');
        this.spriteProg = program(gl, SPRITE_VS, spriteFS(this.deriv), ['aPos', 'aUV', 'aCol', 'aMode']);
        this.bright = program(gl, QUAD_VS, BRIGHT_FS, ['aPos']);
        this.blur = program(gl, QUAD_VS, BLUR_FS, ['aPos']);
        this.comp = program(gl, QUAD_VS, COMPOSITE_FS, ['aPos']);

        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.verts.byteLength, gl.DYNAMIC_DRAW);

        const idx = new Uint16Array(MAX_QUADS * 6);
        for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) {
            idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2;
            idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
        }
        this.ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

        this.fsq = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fsq);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        this.targets = null;
        if (this.atlas) this.setAtlas(this.atlas);
        if (this.w) this.resize(this.w, this.h);
    }

    setAtlas(atlas) {
        const gl = this.gl;
        this.atlas = atlas;
        this.frames = atlas.frames;
        this.texSize = atlas.size;
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.size, atlas.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.pixels);
        const f = this.deriv ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.whiteUV = this._uv('white', 0.5);
    }

    _target(w, h) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return ok ? { tex, fb, w, h } : null;
    }

    _freeTargets() {
        const gl = this.gl;
        if (!this.targets) return;
        for (const t of Object.values(this.targets)) {
            if (!t) continue;
            gl.deleteTexture(t.tex);
            gl.deleteFramebuffer(t.fb);
        }
        this.targets = null;
    }

    resize(w, h) {
        this.w = w; this.h = h;
        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;
        this._freeTargets();
        if (this.post) {
            const qw = Math.max(1, Math.ceil(w / 4)), qh = Math.max(1, Math.ceil(h / 4));
            const t = { scene: this._target(w, h), a: this._target(qw, qh), b: this._target(qw, qh) };
            // Some mobile drivers refuse a render target: fall back to LOW rather than go black.
            if (t.scene && t.a && t.b) this.targets = t;
            else { this.targets = t; this._freeTargets(); this.post = false; }
        }
    }

    setPost(on) {
        this.post = on;
        if (this.w) this.resize(this.w, this.h);
    }

    // -------------------------------------------------------------- frame
    begin(clear = [0, 0, 0]) {
        const gl = this.gl;
        this.drawCalls = 0;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.post && this.targets ? this.targets.scene.fb : null);
        gl.viewport(0, 0, this.w, this.h);
        gl.clearColor(clear[0], clear[1], clear[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        this.blendMode = 'alpha';
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this._bindSprite();
    }

    _bindSprite() {
        const gl = this.gl, s = this.spriteProg;
        gl.useProgram(s.p);
        gl.uniform2f(s.u.uRes, this.w, this.h);
        gl.uniform2f(s.u.uTexSize, this.texSize, this.texSize);
        gl.uniform1i(s.u.uTex, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        const stride = FLOATS_PER_VERT * 4;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
    }

    /** 'alpha' for normal drawing, 'add' for glow (particles, bolts). */
    blend(mode) {
        if (mode === this.blendMode) return;
        this.flush();
        this.blendMode = mode;
        const gl = this.gl;
        if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    flush() {
        if (!this.nQuads) return;
        const gl = this.gl;
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts.subarray(0, this.nQuads * 4 * FLOATS_PER_VERT));
        gl.drawElements(gl.TRIANGLES, this.nQuads * 6, gl.UNSIGNED_SHORT, 0);
        this.nQuads = 0;
        this.drawCalls++;
    }

    /** Restrict drawing to a device-pixel rect (or null for the whole screen). */
    clip(r) {
        this.flush();
        const gl = this.gl;
        if (!r) { gl.disable(gl.SCISSOR_TEST); return; }
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.round(r.x), Math.round(this.h - r.y - r.h), Math.round(r.w), Math.round(r.h));
    }

    end() {
        this.flush();
        this.gl.disable(this.gl.SCISSOR_TEST);
        if (!this.post || !this.targets) return;
        const gl = this.gl, T = this.targets;
        gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fsq);
        for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

        // bright pass: scene -> a (quarter res)
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.a.fb);
        gl.viewport(0, 0, T.a.w, T.a.h);
        gl.useProgram(this.bright.p);
        gl.uniform1i(this.bright.u.uSrc, 0);
        gl.uniform2f(this.bright.u.uTexel, 1 / this.w, 1 / this.h);
        gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // blur a -> b (horizontal), b -> a (vertical), twice for a wider halo
        gl.useProgram(this.blur.p);
        gl.uniform1i(this.blur.u.uSrc, 0);
        for (let pass = 0; pass < 2; pass++) {
            const spread = pass === 0 ? 1 : 2;
            gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.fb);
            gl.uniform2f(this.blur.u.uStep, spread / T.a.w, 0);
            gl.bindTexture(gl.TEXTURE_2D, T.a.tex);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindFramebuffer(gl.FRAMEBUFFER, T.a.fb);
            gl.uniform2f(this.blur.u.uStep, 0, spread / T.a.h);
            gl.bindTexture(gl.TEXTURE_2D, T.b.tex);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        // composite -> screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.w, this.h);
        const c = this.comp;
        gl.useProgram(c.p);
        gl.uniform1i(c.u.uScene, 0);
        gl.uniform1i(c.u.uBloom, 1);
        gl.uniform1f(c.u.uBloomAmt, this.bloomAmt);
        gl.uniform1f(c.u.uScan, Math.max(2, this.scan));
        gl.uniform1f(c.u.uScanOff, this.scanOff);
        gl.uniform1f(c.u.uScanAmt, this.scan >= 2.5 ? this.scanAmt : 0);
        gl.uniform2f(c.u.uRes, this.w, this.h);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, T.a.tex);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.drawCalls += 6;
    }

    // -------------------------------------------------------------- primitives
    _uv(name, inset = 0) {
        const f = this.frames[name];
        if (!f) throw new Error('no sprite ' + name);
        const s = this.texSize;
        return [(f.x + inset) / s, (f.y + inset) / s, (f.x + f.w - inset) / s, (f.y + f.h - inset) / s];
    }

    _push(x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, col, mode) {
        if (this.nQuads >= MAX_QUADS) this.flush();
        const v = this.verts;
        let o = this.nQuads * 4 * FLOATS_PER_VERT;
        const r = col[0], g = col[1], b = col[2], a = col[3];
        v[o++] = x0; v[o++] = y0; v[o++] = u0; v[o++] = v0; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = a; v[o++] = mode;
        v[o++] = x1; v[o++] = y1; v[o++] = u1; v[o++] = v0; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = a; v[o++] = mode;
        v[o++] = x2; v[o++] = y2; v[o++] = u1; v[o++] = v1; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = a; v[o++] = mode;
        v[o++] = x3; v[o++] = y3; v[o++] = u0; v[o++] = v1; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = a; v[o++] = mode;
        this.nQuads++;
    }

    rect(x, y, w, h, col) {
        const [u0, v0, u1, v1] = this.whiteUV;
        this._push(x, y, x + w, y, x + w, y + h, x, y + h, u0, v0, u1, v1, col, 0);
    }

    /** Thick line segment as a rotated quad. */
    line(x1, y1, x2, y2, width, col) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * width / 2, ny = dx / len * width / 2;
        const [u0, v0, u1, v1] = this.whiteUV;
        this._push(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny, u0, v0, u1, v1, col, 0);
    }

    /** Circle outline from line segments — the vector-monitor look. */
    ring(cx, cy, r, width, col, segs = 40) {
        let px = cx + r, py = cy;
        for (let i = 1; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            this.line(px, py, x, y, width, col);
            px = x; py = y;
        }
    }

    /**
     * Draw a sprite centred on (cx, cy) at w x h device pixels.
     * o: { rot, flipX, flipY, col, flash (0/1 = solid colour silhouette) }
     */
    sprite(name, cx, cy, w, h, o) {
        let [u0, v0, u1, v1] = this._uv(name);
        const col = (o && o.col) || WHITE;
        const mode = o && o.flash ? 1 : 0;
        if (o && o.flipX) { const t = u0; u0 = u1; u1 = t; }
        if (o && o.flipY) { const t = v0; v0 = v1; v1 = t; }
        const hw = w / 2, hh = h / 2;
        const rot = o && o.rot;
        if (!rot) {
            this._push(cx - hw, cy - hh, cx + hw, cy - hh, cx + hw, cy + hh, cx - hw, cy + hh, u0, v0, u1, v1, col, mode);
            return;
        }
        const c = Math.cos(rot), s = Math.sin(rot);
        const X = (x, y) => cx + x * c - y * s;
        const Y = (x, y) => cy + x * s + y * c;
        this._push(X(-hw, -hh), Y(-hw, -hh), X(hw, -hh), Y(hw, -hh), X(hw, hh), Y(hw, hh), X(-hw, hh), Y(-hw, hh),
            u0, v0, u1, v1, col, mode);
    }

    /** Bitmap-font text. px = size of one font pixel. align: 'left' | 'center' | 'right'. */
    text(str, x, y, px, col, align = 'left') {
        str = String(str);
        const w = str.length ? (str.length * 6 - 1) * px : 0;
        let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        cx = Math.round(cx); y = Math.round(y);
        for (const ch of str) {
            if (ch !== ' ') {
                const name = this.frames['g_' + ch] ? 'g_' + ch : 'g_' + ch.toUpperCase();
                if (this.frames[name]) {
                    const [u0, v0, u1, v1] = this._uv(name);
                    this._push(cx, y, cx + 5 * px, y, cx + 5 * px, y + 7 * px, cx, y + 7 * px, u0, v0, u1, v1, col, 0);
                }
            }
            cx += 6 * px;
        }
        return w;
    }
}
