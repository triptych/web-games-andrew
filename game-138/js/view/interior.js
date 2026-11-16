// Interior mapping: a flat quad that shows a whole room behind it.
//
// The quad is a window (or the mouth of a well). In the fragment shader the view ray is carried into the quad's own
// space and intersected, from the inside, with an imaginary box behind it: x and y in [-0.5, 0.5], z from 0 back to
// -depth. Whichever face it hits first (back wall, side walls, floor or ceiling) is looked up in a painted atlas, so
// one quad shows a little library or a deep shaft with true perspective as you walk past. A middle layer (an alpha
// cut-out at 45 % of the depth: an armchair, a sleeping dragon's tail) gives the room a foreground.
//
// Atlas layout, 3 × 2 slots of 256 px: [back, left, right] / [floor, ceiling, middle layer].

import * as THREE from 'three';
import { clock, withFog } from './materials.js';

const VERT = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vPos;
varying vec3 vCam;
void main() {
    vPos = position;
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform sampler2D atlas;
uniform float depth;
uniform float glow;
uniform float shaft;      // 1 for a well: darker the deeper you look
uniform float uTime;
uniform vec3 tint;
varying vec3 vPos;
varying vec3 vCam;
vec4 slot(vec2 uv, float i) {
    vec2 o = vec2(mod(i, 3.0), 1.0 - floor(i / 3.0));
    uv = clamp(uv, 0.004, 0.996);
    return texture2D(atlas, (o + uv) / vec2(3.0, 2.0));
}
void main() {
    vec3 dir = normalize(vPos - vCam);
    vec3 p = vPos;
    float tx = ((dir.x > 0.0 ? 0.5 : -0.5) - p.x) / dir.x;
    float ty = ((dir.y > 0.0 ? 0.5 : -0.5) - p.y) / dir.y;
    float tz = (-depth - p.z) / min(dir.z, -1e-4);
    float t = min(min(tx, ty), tz);
    vec3 hit = p + dir * t;
    vec4 col;
    float d = clamp(-hit.z / depth, 0.0, 1.0);
    if (t == tz) col = slot(hit.xy + 0.5, 0.0);
    else if (t == tx) col = dir.x < 0.0 ? slot(vec2(d, hit.y + 0.5), 1.0) : slot(vec2(1.0 - d, hit.y + 0.5), 2.0);
    else col = dir.y < 0.0 ? slot(vec2(hit.x + 0.5, 1.0 - d), 3.0) : slot(vec2(hit.x + 0.5, d), 4.0);
    // the middle layer
    float tm = (-depth * 0.45 - p.z) / min(dir.z, -1e-4);
    if (tm < t) {
        vec3 m = p + dir * tm;
        if (abs(m.x) < 0.5 && abs(m.y) < 0.5) {
            vec4 mid = slot(m.xy + 0.5, 5.0);
            col.rgb = mix(col.rgb, mid.rgb, mid.a);
            d = mix(d, 0.45, mid.a);
        }
    }
    float flick = 0.92 + 0.08 * sin(uTime * 7.0 + sin(uTime * 3.1) * 2.0);
    float light = mix(1.0, exp(-d * 3.2), shaft);
    vec3 c = col.rgb * tint * light * mix(1.0, flick, glow);
    // a little warmth spilling out of the window
    c += vec3(1.0, 0.7, 0.35) * glow * 0.12 * (1.0 - d);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

// ------------------------------------------------------------------ painting the rooms
const S = 256;

function ctxFor() {
    const c = document.createElement('canvas');
    c.width = S * 3; c.height = S * 2;
    return c;
}
/** Draw into one slot with (0, 0) at its top-left, S × S. */
function inSlot(g, i, fn) {
    g.save();
    g.translate((i % 3) * S, Math.floor(i / 3) * S);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    fn(g);
    g.restore();
}
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function planks(g, col, dark, vertical = false) {
    g.fillStyle = col; g.fillRect(0, 0, S, S);
    g.strokeStyle = dark; g.lineWidth = 3;
    for (let k = 0; k <= S; k += 32) { g.beginPath(); vertical ? (g.moveTo(k, 0), g.lineTo(k, S)) : (g.moveTo(0, k), g.lineTo(S, k)); g.stroke(); }
}
function stones(g, base, mortar, r) {
    g.fillStyle = mortar; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) for (let x = -((y / 32) % 2) * 24; x < S; x += 48) {
        const k = 0.8 + r() * 0.35;
        g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
        g.fillRect(x + 2, y + 2, 44, 28);
    }
}
function shelfWall(g, r, items) {
    planks(g, '#6b4528', '#4a2e1a', true);
    for (let y = 40; y < S; y += 64) {
        g.fillStyle = '#3b2414'; g.fillRect(0, y + 44, S, 8);
        for (let x = 6; x < S - 10;) {
            const w = 8 + r() * 12, h = 26 + r() * 16;
            items(g, x, y + 44 - h, w, h, r);
            x += w + 2;
        }
    }
}
function glowBlob(g, x, y, rad, col) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

const BOOK = ['#b5473a', '#3f6e9a', '#d9a441', '#4f8a55', '#8a4f8a', '#c97a3c', '#2f5d5d'];
const ROOMS = {
    library(g, r) {
        const book = (g2, x, y, w, h, rr) => { g2.fillStyle = BOOK[Math.floor(rr() * BOOK.length)]; g2.fillRect(x, y, w, h); g2.fillStyle = 'rgba(255,230,160,0.5)'; g2.fillRect(x + 2, y + 5, w - 4, 2); };
        for (const i of [0, 1, 2]) inSlot(g, i, (c) => { shelfWall(c, r, book); glowBlob(c, S * 0.5, S * 0.35, S * 0.7, 'rgba(255,190,110,0.35)'); });
        inSlot(g, 3, (c) => { planks(c, '#7a5232', '#5a3a22'); c.fillStyle = '#9b3d3d'; c.fillRect(48, 48, 160, 160); c.strokeStyle = '#e0b060'; c.lineWidth = 6; c.strokeRect(60, 60, 136, 136); });
        inSlot(g, 4, (c) => { planks(c, '#4a301c', '#2e1c10'); glowBlob(c, S / 2, S / 2, 70, 'rgba(255,200,120,0.8)'); });
        inSlot(g, 5, (c) => {
            // an armchair and a reading lamp
            c.fillStyle = '#8a3b3b'; c.beginPath(); c.roundRect(40, 130, 120, 110, 24); c.fill();
            c.fillStyle = '#a84a4a'; c.beginPath(); c.roundRect(28, 170, 30, 70, 12); c.roundRect(142, 170, 30, 70, 12); c.fill();
            c.fillStyle = '#3b2414'; c.fillRect(200, 110, 6, 140);
            c.fillStyle = '#f0c46a'; c.beginPath(); c.moveTo(180, 112); c.lineTo(226, 112); c.lineTo(214, 80); c.lineTo(192, 80); c.fill();
            glowBlob(c, 203, 110, 50, 'rgba(255,210,120,0.6)');
        });
    },
    cellar(g, r) {
        const bottle = (g2, x, y, w, h, rr) => { g2.fillStyle = rr() > 0.5 ? '#3d5a2e' : '#5a2338'; g2.fillRect(x, y + h * 0.35, w * 0.8, h * 0.65); g2.fillRect(x + w * 0.25, y, w * 0.3, h * 0.4); };
        inSlot(g, 0, (c) => { stones(c, [150, 92, 70], '#5a3a2c', r); for (let x = 20; x < S; x += 76) { c.fillStyle = '#6a4224'; c.beginPath(); c.ellipse(x + 30, 190, 32, 46, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3b2414'; c.fillRect(x, 160, 60, 5); c.fillRect(x, 215, 60, 5); } });
        for (const i of [1, 2]) inSlot(g, i, (c) => { stones(c, [150, 92, 70], '#5a3a2c', r); c.fillStyle = 'rgba(40,24,14,0.85)'; c.fillRect(0, 40, S, 150); for (let y = 52; y < 180; y += 34) for (let x = 6; x < S; x += 20) bottle(c, x, y, 14, 28, r); });
        inSlot(g, 3, (c) => stones(c, [120, 80, 62], '#4a2e22', r));
        inSlot(g, 4, (c) => { planks(c, '#3e2a1a', '#24170e'); glowBlob(c, S / 2, S / 2, 60, 'rgba(255,170,90,0.5)'); });
        inSlot(g, 5, (c) => { c.fillStyle = '#7a4c2a'; c.beginPath(); c.ellipse(90, 200, 50, 56, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3b2414'; c.fillRect(40, 170, 100, 6); c.fillRect(40, 228, 100, 6); });
    },
    den(g, r) {
        for (const i of [0, 1, 2]) inSlot(g, i, (c) => { c.fillStyle = '#5a4636'; c.fillRect(0, 0, S, S); for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(30,20,14,${0.2 + r() * 0.3})`; c.beginPath(); c.arc(r() * S, r() * S, 10 + r() * 30, 0, Math.PI * 2); c.fill(); } glowBlob(c, S * 0.5, S * 0.8, S * 0.6, 'rgba(255,150,80,0.3)'); });
        inSlot(g, 3, (c) => { c.fillStyle = '#c9a85a'; c.fillRect(0, 0, S, S); c.strokeStyle = '#a8883a'; c.lineWidth = 2; for (let k = 0; k < 200; k++) { const x = r() * S, y = r() * S, a = r() * Math.PI; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); c.stroke(); } });
        inSlot(g, 4, (c) => { c.fillStyle = '#3a2c22'; c.fillRect(0, 0, S, S); });
        inSlot(g, 5, (c) => {
            // a curled sleeping creature and a "z"
            c.fillStyle = '#d98a3a'; c.beginPath(); c.ellipse(128, 205, 95, 45, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#f2c98a'; c.beginPath(); c.ellipse(128, 215, 60, 24, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#d98a3a'; c.beginPath(); c.ellipse(205, 180, 30, 24, 0.3, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#3b2414'; c.lineWidth = 3; c.beginPath(); c.arc(212, 178, 6, 0.2, Math.PI - 0.2); c.stroke();
            c.fillStyle = '#fff6e0'; c.font = 'bold 34px sans-serif'; c.fillText('z', 210, 130); c.font = 'bold 24px sans-serif'; c.fillText('z', 232, 104);
        });
    },
    grotto(g, r) {
        const crystals = (c, n, base) => {
            for (let k = 0; k < n; k++) {
                const x = r() * S, h = 40 + r() * 120, w = 12 + r() * 20;
                c.fillStyle = base[Math.floor(r() * base.length)];
                c.beginPath(); c.moveTo(x - w / 2, S); c.lineTo(x, S - h); c.lineTo(x + w / 2, S); c.fill();
            }
        };
        for (const i of [0, 1, 2]) inSlot(g, i, (c) => { c.fillStyle = '#241838'; c.fillRect(0, 0, S, S); glowBlob(c, S / 2, S * 0.7, S * 0.6, 'rgba(190,120,255,0.45)'); crystals(c, 14, ['#b48cff', '#8a5cff', '#d9b8ff', '#6ad8ff']); });
        inSlot(g, 3, (c) => { c.fillStyle = '#2e2048'; c.fillRect(0, 0, S, S); glowBlob(c, S / 2, S / 2, S * 0.5, 'rgba(160,110,255,0.6)'); });
        inSlot(g, 4, (c) => { c.fillStyle = '#1a1028'; c.fillRect(0, 0, S, S); for (let k = 0; k < 60; k++) { c.fillStyle = 'rgba(220,200,255,0.8)'; c.fillRect(r() * S, r() * S, 2, 2); } });
        inSlot(g, 5, (c) => { crystals(c, 5, ['rgba(200,160,255,0.95)', 'rgba(120,220,255,0.9)']); });
    },
    pantry(g, r) {
        const jar = (g2, x, y, w, h, rr) => { g2.fillStyle = ['#e0a040', '#c84a3a', '#7aa84a', '#e8d070'][Math.floor(rr() * 4)]; g2.fillRect(x, y + 6, w, h - 6); g2.fillStyle = '#d8d0c0'; g2.fillRect(x - 1, y + 2, w + 2, 6); };
        for (const i of [0, 1, 2]) inSlot(g, i, (c) => { shelfWall(c, r, jar); glowBlob(c, S / 2, S * 0.3, S * 0.6, 'rgba(255,200,120,0.3)'); });
        inSlot(g, 3, (c) => planks(c, '#8a6a42', '#6a4a2a'));
        inSlot(g, 4, (c) => { planks(c, '#5a3a22', '#3a2414'); for (let x = 30; x < S; x += 50) { c.fillStyle = '#c84a3a'; c.beginPath(); c.arc(x, 40 + (x % 3) * 20, 14, Math.PI, 0); c.fill(); } });
        inSlot(g, 5, (c) => {
            // hanging strings of mushrooms and herbs
            for (let x = 30; x < S; x += 56) {
                c.strokeStyle = '#4a3020'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 120); c.stroke();
                for (let y = 30; y < 120; y += 26) { c.fillStyle = y % 52 ? '#c84a3a' : '#e8d8b0'; c.beginPath(); c.arc(x, y, 10, Math.PI, 0); c.fill(); }
            }
        });
    },
    well(g, r) {
        // a deep round shaft: stone on every side, dark water far below
        for (const i of [1, 2]) inSlot(g, i, (c) => stones(c, [120, 116, 108], '#3a3632', r));
        inSlot(g, 4, (c) => stones(c, [120, 116, 108], '#3a3632', r));
        inSlot(g, 3, (c) => stones(c, [120, 116, 108], '#3a3632', r));
        inSlot(g, 0, (c) => { c.fillStyle = '#123040'; c.fillRect(0, 0, S, S); glowBlob(c, S / 2, S / 2, S * 0.45, 'rgba(110,220,255,0.7)'); for (let k = 0; k < 30; k++) { c.fillStyle = 'rgba(200,250,255,0.6)'; c.fillRect(r() * S, r() * S, 3, 3); } });
        inSlot(g, 5, () => {});
    },
};

const atlases = new Map();
function atlasFor(kind) {
    if (atlases.has(kind)) return atlases.get(kind);
    const c = ctxFor();
    const g = c.getContext('2d');
    (ROOMS[kind] || ROOMS.library)(g, rnd(kind.length * 7919 + 13));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    atlases.set(kind, t);
    return t;
}

/** A material showing a fake room of `kind` (a NOOKS id, or 'well') `depth` units behind the quad. */
export function interiorMaterial(kind, { depth = 1.4, glow = 1, shaft = 0, tint = 0xffffff } = {}) {
    return new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, fog: true,
        uniforms: withFog({
            atlas: { value: atlasFor(kind) }, depth: { value: depth }, glow: { value: glow }, shaft: { value: shaft },
            uTime: clock, tint: { value: new THREE.Color(tint) },
        }),
    });
}
