// The arcade monitor, in hand-written WebGL. The 2D screen canvas is uploaded
// as a texture each frame and drawn through four passes:
//   1. persistence  max(screen, previous × decay): bright things leave a short phosphor trail
//   2. bright pass  downsampled to a quarter, keeping what glows
//   3. blur         separable Gaussian, horizontal then vertical, twice
//   4. the tube     barrel curvature, chromatic aberration, bloom, scanlines on
//                   the 240 native rows, a slot mask, vignette, noise, flicker,
//                   and row tearing when THE NULL is near
// Returns null if WebGL isn't available, and the caller shows the 2D canvas.

const VS = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const PERSIST = `
precision mediump float;
varying vec2 uv;
uniform sampler2D src, prev;
uniform float decay;
void main() {
    vec3 a = texture2D(src, uv).rgb;
    vec3 b = max(texture2D(prev, uv).rgb * decay - 0.025, 0.0);   // the floor stops 8-bit rounding parking a ghost
    gl_FragColor = vec4(max(a, b), 1.0);
}`;

const BRIGHT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D src;
uniform vec2 texel;
void main() {
    vec3 c = vec3(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture2D(src, uv + vec2(float(x), float(y)) * texel).rgb;
    c /= 9.0;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(0.32, 0.85, l), 1.0);
}`;

const BLUR = `
precision mediump float;
varying vec2 uv;
uniform sampler2D src;
uniform vec2 dir;
void main() {
    vec3 c = texture2D(src, uv).rgb * 0.227;
    c += texture2D(src, uv + dir * 1.385).rgb * 0.316;
    c += texture2D(src, uv - dir * 1.385).rgb * 0.316;
    c += texture2D(src, uv + dir * 3.231).rgb * 0.070;
    c += texture2D(src, uv - dir * 3.231).rgb * 0.070;
    gl_FragColor = vec4(c, 1.0);
}`;

const TUBE = `
precision mediump float;
varying vec2 uv;
uniform sampler2D src, bloom;
uniform vec2 res;
uniform float time, curv, glitch, bloomK, rows, scan, mask;
float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 bend(vec2 u) {
    u = u * 2.0 - 1.0;
    vec2 o = abs(u.yx) / vec2(6.5, 5.0);
    u = u + u * o * o * curv;
    u *= 0.985;                    // pull the picture in so the bulge never crops the HUD
    return u * 0.5 + 0.5;
}
void main() {
    vec2 u = bend(uv);
    if (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    // the null tears rows sideways
    float row = floor((1.0 - u.y) * rows);
    float tear = step(1.0 - glitch * 0.35, rnd(vec2(row, floor(time * 24.0)))) * (rnd(vec2(row, time)) - 0.5) * 0.06 * glitch;
    u.x += tear;
    float ab = 0.0012 + glitch * 0.004;
    vec3 c;
    c.r = texture2D(src, u + vec2(ab, 0.0)).r;
    c.g = texture2D(src, u).g;
    c.b = texture2D(src, u - vec2(ab, 0.0)).b;
    c += texture2D(bloom, u).rgb * bloomK;
    // scanlines on the native rows
    float sl = sin((1.0 - u.y) * rows * 3.14159265 * 2.0) * 0.5 + 0.5;
    c *= mix(1.0, 0.62 + 0.38 * sl, scan);
    // slot mask
    float mx = mod(gl_FragCoord.x, 3.0);
    vec3 m = mx < 1.0 ? vec3(1.0, 0.82, 0.82) : mx < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
    c *= mix(vec3(1.0), m, mask);
    // vignette and the glass's edge
    vec2 d = u - 0.5;
    c *= 1.0 - dot(d, d) * 0.9;
    vec2 e = smoothstep(vec2(-0.004), vec2(0.006), u) * smoothstep(vec2(-0.004), vec2(0.006), 1.0 - u);
    c *= e.x * e.y;
    // noise and flicker
    c += (rnd(uv * res + time) - 0.5) * 0.035;
    c *= 0.985 + 0.015 * sin(time * 120.0);
    c += glitch * 0.06 * vec3(rnd(vec2(row, time)), 0.0, rnd(vec2(time, row)));
    gl_FragColor = vec4(c * 1.08, 1.0);
}`;

export function makeCRT(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };
    const prog = (fs) => {
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(p, 0, 'p');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {};
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
        return { p, u };
    };
    let P;
    try { P = { persist: prog(PERSIST), bright: prog(BRIGHT), blur: prog(BLUR), tube: prog(TUBE) }; } catch (e) { console.warn('CRT shader failed', e); return null; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = (w, h) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        return t;
    };
    const fbo = (w, h) => {
        const t = tex(w, h);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return { f, t, w, h };
    };
    const srcTex = tex(0, 0);
    let size = null, per = null, bl = null, flip = 0;

    const run = (pr, target, w, h, binds, uni) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
        gl.viewport(0, 0, w, h);
        gl.useProgram(pr.p);
        let unit = 0;
        for (const [name, t] of Object.entries(binds)) {
            gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.uniform1i(pr.u[name], unit++);
        }
        for (const [name, v] of Object.entries(uni)) {
            if (!pr.u[name]) continue;
            if (Array.isArray(v)) gl.uniform2f(pr.u[name], v[0], v[1]); else gl.uniform1f(pr.u[name], v);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    return {
        gl,
        on: true,
        render(source, o = {}) {
            const sw = source.width, sh2 = source.height;
            if (!size || size[0] !== sw || size[1] !== sh2) {
                size = [sw, sh2];
                per = [fbo(sw, sh2), fbo(sw, sh2)];
                const bw = Math.max(1, sw >> 2), bh = Math.max(1, sh2 >> 2);
                bl = [fbo(bw, bh), fbo(bw, bh)];
            }
            gl.bindTexture(gl.TEXTURE_2D, srcTex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            const a = per[flip], b = per[1 - flip];
            flip = 1 - flip;
            run(P.persist, a, sw, sh2, { src: srcTex, prev: b.t }, { decay: o.persist ?? 0.55 });
            const [bw, bh] = [bl[0].w, bl[0].h];
            run(P.bright, bl[0], bw, bh, { src: a.t }, { texel: [1 / sw * 2, 1 / sh2 * 2] });
            for (let k = 0; k < 2; k++) {
                run(P.blur, bl[1], bw, bh, { src: bl[0].t }, { dir: [(1 + k) / bw, 0] });
                run(P.blur, bl[0], bw, bh, { src: bl[1].t }, { dir: [0, (1 + k) / bh] });
            }
            run(P.tube, null, canvas.width, canvas.height, { src: a.t, bloom: bl[0].t }, {
                res: [canvas.width, canvas.height], time: o.time || 0, curv: o.curv ?? 1, glitch: o.glitch || 0,
                bloomK: o.bloom ?? 1.25, rows: o.rows ?? 180, scan: o.scan ?? 1, mask: canvas.width > 900 ? 0.35 : 0.15,
            });
        },
    };
}
