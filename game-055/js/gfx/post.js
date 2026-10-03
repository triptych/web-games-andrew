// Post-processing: HDR bloom (threshold, 5-level down/up chain), then one
// composite pass that adds shockwave refraction, chromatic aberration,
// weather, cloud banks, lightning, colour grading, a filmic curve, grain,
// a vignette and a dimmed frame outside the play field.

import { program, target, freeTarget, FS_VS, drawFS } from './gl.js';

export const MAX_SHOCKS = 8;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
    vec2 d = uTexel;
    vec3 c = texture(uSrc, vUV + vec2(-d.x, -d.y)).rgb + texture(uSrc, vUV + vec2(d.x, -d.y)).rgb
           + texture(uSrc, vUV + vec2(-d.x, d.y)).rgb + texture(uSrc, vUV + vec2(d.x, d.y)).rgb;
    c = c * 0.25 * 0.5 + texture(uSrc, vUV).rgb * 0.5;
    if (uThreshold > 0.0) {
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThreshold + 0.25, 0.0, 0.5);
        soft = soft * soft / 0.5;
        float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
        c *= contrib;
    }
    o = vec4(c, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uScale;
void main() {
    vec2 d = uTexel;
    vec3 c = texture(uSrc, vUV).rgb * 4.0;
    c += (texture(uSrc, vUV + vec2(d.x, 0.0)).rgb + texture(uSrc, vUV - vec2(d.x, 0.0)).rgb + texture(uSrc, vUV + vec2(0.0, d.y)).rgb + texture(uSrc, vUV - vec2(0.0, d.y)).rgb) * 2.0;
    c += texture(uSrc, vUV + d).rgb + texture(uSrc, vUV - d).rgb + texture(uSrc, vUV + vec2(d.x, -d.y)).rgb + texture(uSrc, vUV + vec2(-d.x, d.y)).rgb;
    o = vec4(c / 16.0 * uScale, 1.0);
}`;

const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloomI;
uniform vec4 uShock[${MAX_SHOCKS}];
uniform int uShockN;
uniform float uCA;
uniform vec4 uFlashCol;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSat;
uniform float uCon;
uniform vec4 uField;     // uv rect of the play field (x0, y0, x1, y1), y up
uniform int uWeather;    // 0 clear, 1 rain, 2 sand, 3 snow, 4 storm, 5 ash
uniform float uWeatherI;
uniform float uCloud;
uniform float uCloudAmb;
uniform vec2 uCloudOff;
uniform vec3 uFog;
uniform float uLowHP;
uniform float uOD;
uniform float uHit;
uniform float uLightning;
uniform float uGrain;
uniform float uScan;
uniform float uExposure;

float n2(vec2 p) { return texture(uNoise, p).r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float rainLayer(vec2 uv, float scale, float speed, float slant, float len) {
    vec2 p = vec2(uv.x * uRes.x / uRes.y + uv.y * slant, uv.y) * vec2(scale, scale * 0.12);
    p.y += uTime * speed;
    vec2 c = floor(p);
    vec2 f = fract(p);
    float h = hash(c);
    if (h > 0.35) return 0.0;
    float x = hash(c + 7.1);
    float line = smoothstep(0.06, 0.0, abs(f.x - x));
    float y0 = hash(c + 3.3);
    float seg = smoothstep(y0, y0 + 0.05, f.y) * smoothstep(y0 + len, y0 + len - 0.1, f.y);
    return line * seg;
}
float snowLayerD(vec2 uv, float scale, float speed, float t, float density, float size) {
    vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * scale;
    p.y += t * speed;
    p.x += sin(t * 0.7 + p.y * 0.3) * 0.4;
    vec2 c = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash(c);
    if (h > density) return 0.0;
    vec2 off = vec2(hash(c + 1.7), hash(c + 5.3)) - 0.5;
    float d = length(f - off * 0.6);
    return smoothstep(size, size * 0.2, d);
}
float snowLayer(vec2 uv, float scale, float speed, float t) { return snowLayerD(uv, scale, speed, t, 0.4, 0.12); }

void main() {
    vec2 uv = vUV;
    float aspect = uRes.x / uRes.y;
    // shockwaves
    vec2 off = vec2(0.0);
    float ring = 0.0;
    for (int i = 0; i < ${MAX_SHOCKS}; i++) {
        if (i >= uShockN) break;
        vec4 s = uShock[i];
        vec2 d = uv - s.xy;
        d.x *= aspect;
        float r = length(d);
        float w = 0.025 + s.z * 0.12;
        float k = smoothstep(w, 0.0, abs(r - s.z));
        off += (d / max(r, 1e-4)) * k * s.w * vec2(1.0 / aspect, 1.0);
        ring += k * s.w * 8.0;
    }
    uv -= off;
    // chromatic aberration grows towards the edges
    vec2 cd = (uv - 0.5);
    float ca = uCA * (0.4 + dot(cd, cd) * 3.0);
    vec3 col;
    col.r = texture(uScene, uv + cd * ca).r;
    col.g = texture(uScene, uv).g;
    col.b = texture(uScene, uv - cd * ca).b;
    vec3 bloom = texture(uBloom, uv).rgb;
    col += bloom * uBloomI;
    col += ring * vec3(0.4, 0.45, 0.5) * 0.15;
    vec2 wuv = vec2(uv.x * aspect, uv.y);

    // weather
    if (uWeather == 1 || uWeather == 4) {
        float heavy = uWeather == 4 ? 1.0 : 0.6;
        float r = rainLayer(uv, 90.0, 2.6, 0.18, 0.5) * 0.5 + rainLayer(uv + 0.37, 60.0, 2.0, 0.16, 0.6) * 0.35 + rainLayer(uv + 0.71, 140.0, 3.4, 0.2, 0.4) * 0.25;
        col = mix(col, vec3(0.75, 0.8, 0.9), r * 0.45 * uWeatherI * heavy);
        col = mix(col, uFog, 0.08 * uWeatherI * heavy);
    } else if (uWeather == 2) {
        float h1 = n2(wuv * 0.6 + vec2(uTime * 0.12, uTime * 0.02));
        float h2 = n2(wuv * 1.7 + vec2(uTime * 0.3, -uTime * 0.05) + 0.3);
        float haze = smoothstep(0.3, 0.8, h1 * 0.7 + h2 * 0.5);
        col = mix(col, uFog * 0.9, haze * 0.32 * uWeatherI);
        float specks = step(0.985, hash(floor(wuv * 300.0 + vec2(uTime * 160.0, 0.0))));
        col += specks * 0.25 * uWeatherI * uFog;
    } else if (uWeather == 3) {
        float s = snowLayerD(uv, 26.0, 0.45, uTime, 0.3, 0.09) * 0.9 + snowLayerD(uv + 0.3, 44.0, 0.32, uTime, 0.35, 0.1) * 0.6 + snowLayerD(uv + 0.6, 70.0, 0.22, uTime, 0.4, 0.1) * 0.4;
        float h1 = n2(wuv * 0.5 + vec2(uTime * 0.03, uTime * 0.02));
        col = mix(col, uFog, smoothstep(0.4, 0.8, h1) * 0.18 * uWeatherI);
        col = mix(col, vec3(1.0), s * 0.8 * uWeatherI);
    } else if (uWeather == 5) {
        float h1 = n2(wuv * 0.7 + vec2(-uTime * 0.02, uTime * 0.03));
        col = mix(col, uFog * 0.6, smoothstep(0.35, 0.8, h1) * 0.25 * uWeatherI);
        float e = snowLayerD(uv, 30.0, -0.25, uTime, 0.08, 0.08) * 0.8 + snowLayerD(uv + 0.4, 52.0, -0.18, uTime, 0.1, 0.09);
        col += vec3(1.0, 0.45, 0.1) * e * 0.7 * uWeatherI;
        float a = snowLayerD(uv + 0.17, 40.0, 0.2, uTime * 0.7, 0.18, 0.1);
        col = mix(col, vec3(0.6, 0.58, 0.56), a * 0.5 * uWeatherI);
    }
    // clouds: thin high clouds in passing, and full banks for transitions
    if (uCloud > 0.001 || uCloudAmb > 0.001) {
        vec2 cp = wuv * 0.35 + uCloudOff;
        float c = n2(cp) * 0.55 + n2(cp * 2.1 + 0.4) * 0.3 + n2(cp * 4.3 + 0.7) * 0.15;
        float amb = smoothstep(0.55, 0.85, c) * uCloudAmb;
        float bank = smoothstep(1.0 - uCloud * 1.25, 1.1 - uCloud * 1.2 + 0.25, c + uCloud * 0.6);
        float cov = clamp(max(amb, bank * uCloud * 1.4), 0.0, 1.0);
        vec3 cc = mix(vec3(0.95, 0.96, 1.0), uFog * 1.2 + 0.25, 0.35) * (0.82 + c * 0.25);
        col = mix(col, cc, cov);
    }
    col += vec3(0.85, 0.9, 1.0) * uLightning;

    // grade
    col *= uExposure;
    col = aces(col);
    col = col * uGain + uLift * (1.0 - col);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat + uOD * 0.25);
    col = (col - 0.5) * uCon + 0.5;
    // overdrive: warm push; low health: red edge pulse
    vec2 vc = vUV - 0.5;
    float vig = dot(vc * vec2(aspect, 1.0), vc * vec2(aspect, 1.0));
    col = mix(col, col * vec3(1.15, 1.0, 0.75), uOD * 0.4);
    float pulse = uLowHP * (0.55 + 0.45 * sin(uTime * 6.0));
    col = mix(col, vec3(0.7, 0.0, 0.05), smoothstep(0.15, 0.6, vig) * pulse * 0.6);
    col = mix(col, vec3(1.0, 0.1, 0.1), uHit * smoothstep(0.05, 0.5, vig) * 0.7);
    col = mix(col, uFlashCol.rgb, uFlashCol.a);
    // outside the field
    bool inField = vUV.x >= uField.x && vUV.x <= uField.z && vUV.y >= uField.y && vUV.y <= uField.w;
    if (!inField) {
        float g = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(g) * vec3(0.8, 0.85, 1.0), 0.6) * 0.42;
    } else {
        float ex = min(min(vUV.x - uField.x, uField.z - vUV.x) * aspect, min(vUV.y - uField.y, uField.w - vUV.y));
        col *= mix(0.78, 1.0, smoothstep(0.0, 0.02, ex));
    }
    col *= 1.0 - smoothstep(0.35, 1.2, vig) * 0.45;
    // grain and optional scanlines
    float gr = texture(uNoise, vUV * uRes / 256.0 + vec2(fract(uTime * 13.7), fract(uTime * 7.3))).r - 0.5;
    col += gr * uGrain;
    if (uScan > 0.0) col *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
    o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Post {
    constructor(gl, hdr, noiseTex) {
        this.gl = gl;
        this.hdr = hdr;
        this.noise = noiseTex;
        this.down = program(gl, FS_VS, DOWN_FS, 'down');
        this.up = program(gl, FS_VS, UP_FS, 'up');
        this.comp = program(gl, FS_VS, COMP_FS, 'comp');
        this.scene = null;
        this.mips = [];
        this.w = this.h = 0;
        this.shocks = new Float32Array(MAX_SHOCKS * 4);
    }

    resize(w, h) {
        if (w === this.w && h === this.h) return;
        const gl = this.gl;
        this.w = w; this.h = h;
        freeTarget(gl, this.scene);
        for (const m of this.mips) freeTarget(gl, m);
        this.scene = target(gl, w, h, this.hdr);
        this.mips = [];
        let mw = w >> 1, mh = h >> 1;
        for (let i = 0; i < 5 && mw > 4 && mh > 4; i++) { this.mips.push(target(gl, mw, mh, this.hdr)); mw >>= 1; mh >>= 1; }
    }

    beginScene() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
        gl.viewport(0, 0, this.w, this.h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    bloom(threshold) {
        const gl = this.gl;
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
        let src = this.scene;
        gl.useProgram(this.down.p);
        gl.uniform1i(this.down.u.uSrc, 0);
        gl.activeTexture(gl.TEXTURE0);
        for (let i = 0; i < this.mips.length; i++) {
            const dst = this.mips[i];
            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
            gl.viewport(0, 0, dst.w, dst.h);
            gl.bindTexture(gl.TEXTURE_2D, src.tex);
            gl.uniform2f(this.down.u.uTexel, 1 / src.w, 1 / src.h);
            gl.uniform1f(this.down.u.uThreshold, i === 0 ? threshold : 0);
            drawFS(gl);
            src = dst;
        }
        gl.useProgram(this.up.p);
        gl.uniform1i(this.up.u.uSrc, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = this.mips.length - 1; i > 0; i--) {
            const s = this.mips[i], d = this.mips[i - 1];
            gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
            gl.viewport(0, 0, d.w, d.h);
            gl.bindTexture(gl.TEXTURE_2D, s.tex);
            gl.uniform2f(this.up.u.uTexel, 1 / s.w, 1 / s.h);
            gl.uniform1f(this.up.u.uScale, 1.0);
            drawFS(gl);
        }
        gl.disable(gl.BLEND);
    }

    composite(screenW, screenH, p) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, screenW, screenH);
        const P = this.comp;
        gl.useProgram(P.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips.length ? this.mips[0].tex : this.scene.tex);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.noise);
        gl.uniform1i(P.u.uScene, 0); gl.uniform1i(P.u.uBloom, 1); gl.uniform1i(P.u.uNoise, 2);
        gl.uniform2f(P.u.uRes, screenW, screenH);
        gl.uniform1f(P.u.uTime, p.time);
        gl.uniform1f(P.u.uBloomI, p.bloom);
        const n = Math.min(MAX_SHOCKS, p.shocks.length);
        for (let i = 0; i < n; i++) this.shocks.set(p.shocks[i], i * 4);
        gl.uniform4fv(P.u.uShock, this.shocks);
        gl.uniform1i(P.u.uShockN, n);
        gl.uniform1f(P.u.uCA, p.ca);
        gl.uniform4fv(P.u.uFlashCol, p.flash);
        gl.uniform3fv(P.u.uLift, p.grade.lift);
        gl.uniform3fv(P.u.uGain, p.grade.gain);
        gl.uniform1f(P.u.uSat, p.grade.sat);
        gl.uniform1f(P.u.uCon, p.grade.con);
        gl.uniform4fv(P.u.uField, p.field);
        gl.uniform1i(P.u.uWeather, p.weather);
        gl.uniform1f(P.u.uWeatherI, p.weatherI);
        gl.uniform1f(P.u.uCloud, p.cloud);
        gl.uniform1f(P.u.uCloudAmb, p.cloudAmb);
        gl.uniform2fv(P.u.uCloudOff, p.cloudOff);
        gl.uniform3fv(P.u.uFog, p.fog);
        gl.uniform1f(P.u.uLowHP, p.lowHP);
        gl.uniform1f(P.u.uOD, p.od);
        gl.uniform1f(P.u.uHit, p.hit);
        gl.uniform1f(P.u.uLightning, p.lightning);
        gl.uniform1f(P.u.uGrain, p.grain);
        gl.uniform1f(P.u.uScan, p.scan);
        gl.uniform1f(P.u.uExposure, p.exposure);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
        drawFS(gl);
    }
}
