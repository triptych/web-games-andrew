// Instanced sprites. Everything that isn't terrain or post-processing is a
// rotated, tinted quad from one of two atlases, pushed into a named layer
// and drawn in layer order with one draw call each.
//
// Blending is premultiplied (ONE, ONE_MINUS_SRC_ALPHA) throughout, so a
// sprite that outputs alpha 0 adds light: additive and normal sprites share
// a layer and a draw call. Modes: 0 tint, 1 shadow, 2 bullet (channel coded),
// 3 alpha-mask tinted (fire, glows); +4 makes any of them additive.

import { program } from './gl.js';

const FL = 16; // floats per instance

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPos;
layout(location=2) in vec4 aUV;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aExt;
uniform vec4 uView;
out vec2 vUV;
out vec4 vCol;
out vec3 vExt;
void main() {
    float c = cos(aExt.x), s = sin(aExt.x);
    vec2 p = aCorner * aPos.zw;
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + aPos.xy;
    gl_Position = vec4(p * uView.xy + uView.zw, 0.0, 1.0);
    vUV = mix(aUV.xy, aUV.zw, aCorner + 0.5);
    vCol = aCol;
    vExt = aExt.yzw;
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
in vec2 vUV;
in vec4 vCol;
in vec3 vExt;
out vec4 o;
void main() {
    vec4 t = vExt.z < 0.5 ? texture(uTex0, vUV) : texture(uTex1, vUV);
    int m = int(vExt.y + 0.5);
    bool add = m >= 4;
    m = m & 3;
    vec4 c;
    if (m == 0) {
        vec3 col = t.rgb * vCol.rgb;
        col = mix(col, vec3(t.a), vExt.x);
        c = vec4(col, t.a) * vCol.a;
    } else if (m == 1) {
        c = vec4(0.0, 0.0, 0.0, t.a * vCol.a);
    } else if (m == 2) {
        vec3 ch = t.rgb;
        float a = clamp(ch.r + ch.g + ch.b, 0.0, 1.0);
        vec3 col = ch.r * vec3(1.0) + ch.g * mix(vCol.rgb, vec3(1.0), 0.15) + ch.b * vCol.rgb * 0.22;
        col = mix(col, vec3(a), vExt.x);
        c = vec4(col, a) * vCol.a;
    } else {
        c = vec4(vCol.rgb * t.a, t.a) * vCol.a;
    }
    if (add) c.a = 0.0;
    o = c;
}`;

export class Batch {
    constructor(gl, layerNames, caps) {
        this.gl = gl;
        this.prog = program(gl, VS, FS, 'batch');
        this.layers = {};
        this.order = layerNames;
        const quad = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        for (const name of layerNames) {
            const cap = caps[name] || 2048;
            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, cap * FL * 4, gl.DYNAMIC_DRAW);
            for (let i = 0; i < 4; i++) {
                gl.enableVertexAttribArray(1 + i);
                gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, FL * 4, i * 16);
                gl.vertexAttribDivisor(1 + i, 1);
            }
            gl.bindVertexArray(null);
            this.layers[name] = { vao, buf, data: new Float32Array(cap * FL), n: 0, cap };
        }
        this.tex = [null, null];
        this.sprites = [{}, {}];
    }

    setAtlas(i, tex, sprites) {
        for (const k in sprites) sprites[k].__i = i;
        this.tex[i] = tex; this.sprites[i] = sprites;
    }

    /** Look up a sprite by name in either atlas. */
    spr(name) { return this.sprites[0][name] || this.sprites[1][name] || null; }

    clear() { for (const k in this.layers) this.layers[k].n = 0; }

    /**
     * Push one instance. s: sprite (from spr()), w/h in world units (default: sprite size × scale).
     */
    push(layer, s, x, y, rot = 0, sx = 1, sy = sx, r = 1, g = 1, b = 1, a = 1, flash = 0, mode = 0) {
        if (!s) return;
        const L = this.layers[layer];
        if (L.n >= L.cap) return;
        const d = L.data;
        let o = L.n++ * FL;
        d[o++] = x; d[o++] = y; d[o++] = s.w * sx; d[o++] = s.h * sy;
        d[o++] = s.u0; d[o++] = s.v0; d[o++] = s.u1; d[o++] = s.v1;
        d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
        d[o++] = rot; d[o++] = flash; d[o++] = mode; d[o] = s.__i || 0;
    }

    /** Push with explicit size in world units. */
    pushWH(layer, s, x, y, rot, w, h, r = 1, g = 1, b = 1, a = 1, flash = 0, mode = 0) {
        if (!s) return;
        const L = this.layers[layer];
        if (L.n >= L.cap) return;
        const d = L.data;
        let o = L.n++ * FL;
        d[o++] = x; d[o++] = y; d[o++] = w; d[o++] = h;
        d[o++] = s.u0; d[o++] = s.v0; d[o++] = s.u1; d[o++] = s.v1;
        d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
        d[o++] = rot; d[o++] = flash; d[o++] = mode; d[o] = s.__i || 0;
    }

    begin(view) {
        const gl = this.gl;
        gl.useProgram(this.prog.p);
        gl.uniform4fv(this.prog.u.uView, view);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1] || this.tex[0]);
        gl.uniform1i(this.prog.u.uTex0, 0);
        gl.uniform1i(this.prog.u.uTex1, 1);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    drawLayer(name) {
        const gl = this.gl;
        const L = this.layers[name];
        if (!L.n) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.data, 0, L.n * FL);
        gl.bindVertexArray(L.vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, L.n);
        gl.bindVertexArray(null);
    }
}
