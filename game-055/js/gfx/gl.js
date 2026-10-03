// Thin WebGL2 helpers: programs, textures, framebuffers.

export function createGL(canvas) {
    const gl = canvas.getContext('webgl2', {
        antialias: false, alpha: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) return null;
    const floatRT = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    return { gl, floatRT };
}

function compile(gl, type, src, name) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(sh);
        const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
        console.error(`shader ${name} failed:\n${log}\n${lines}`);
        throw new Error(`shader ${name}: ${log}`);
    }
    return sh;
}

export function program(gl, vs, fs, name = 'prog') {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`link ${name}: ${gl.getProgramInfoLog(p)}`);
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const key = info.name.replace(/\[0\]$/, '');
        u[key] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
}

export function texture(gl, w, h, o = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const ifmt = o.internal ?? gl.RGBA8;
    const fmt = o.format ?? gl.RGBA;
    const type = o.type ?? gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, o.data ?? null);
    const filter = o.filter ?? gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
    const wrap = o.wrap ?? gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
}

/** Upload a canvas as a premultiplied, mipmapped texture. */
export function canvasTexture(gl, canvas, o = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (o.mips !== false) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = o.wrap ?? gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
}

export function framebuffer(gl, textures) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    textures.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) return null;
    return fb;
}

/** A render target: one colour texture + its framebuffer. */
export function target(gl, w, h, hdr) {
    let tex = texture(gl, w, h, hdr ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : {});
    let fb = framebuffer(gl, [tex]);
    if (!fb && hdr) { gl.deleteTexture(tex); tex = texture(gl, w, h); fb = framebuffer(gl, [tex]); }
    return { tex, fb, w, h };
}

export function freeTarget(gl, t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
}

/** Fullscreen triangle VAO (no attributes: positions from gl_VertexID). */
export const FS_VS = `#version 300 es
out vec2 vUV;
void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUV = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function drawFS(gl) { gl.drawArrays(gl.TRIANGLES, 0, 3); }
