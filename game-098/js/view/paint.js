// The painterly toolkit: toon materials with a three-step ramp, ink outlines (inverted hulls pushed
// out along the normals), and canvas brushwork for textures. Everything the view draws is built
// from these, so the whole game shares one look: bright flat colour, soft bands of shade, a dark
// ink line, and visible brush strokes on the ground.

import * as THREE from 'three';

let RAMP = null;
/** A three-band shading ramp: shadow, mid, light. */
export function ramp() {
    if (RAMP) return RAMP;
    const d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
    RAMP = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
    RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
    RAMP.generateMipmaps = false;
    RAMP.needsUpdate = true;
    return RAMP;
}

const TOON = new Map();
/** A shared toon material for a colour (and optional glow). Don't change it: use toonOwn for that. */
export function toon(color, { emissive = 0x000000, ei = 0, side = THREE.FrontSide, flat = false } = {}) {
    const key = `${color}|${emissive}|${ei}|${side}|${flat}`;
    if (!TOON.has(key)) TOON.set(key, toonOwn(color, { emissive, ei, side, flat }));
    return TOON.get(key);
}
export function toonOwn(color, { emissive = 0x000000, ei = 0, side = THREE.FrontSide, flat = false, transparent = false, opacity = 1 } = {}) {
    void flat;
    return new THREE.MeshToonMaterial({
        color: new THREE.Color(color), gradientMap: ramp(), emissive: new THREE.Color(emissive), emissiveIntensity: ei,
        side, transparent, opacity,
    });
}

const INK = new Map();
/** Ink outline: back faces pushed out along their normals by `w` world units. */
export function ink(w = 0.03, color = 0x1a1020) {
    const key = `${w}|${color}`;
    if (INK.has(key)) return INK.get(key);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.inkW = { value: w };
        sh.vertexShader = 'uniform float inkW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * inkW;');
    };
    m.customProgramCacheKey = () => 'ink' + w;
    INK.set(key, m);
    return m;
}

/** A mesh with an ink outline as a child. */
export function inked(geo, mat, w = 0.03) {
    const m = new THREE.Mesh(geo, mat);
    if (w > 0) {
        const o = new THREE.Mesh(geo, ink(w));
        o.userData.ink = true;
        o.raycast = () => {};
        m.add(o);
    }
    return m;
}

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
}

/** Deterministic little random for brushwork (so a board repaints the same every time). */
export function brushRand(seed) {
    let a = seed >>> 0 || 1;
    return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; };
}

export const css = (c) => '#' + new THREE.Color(c).getHexString();
/** Shift a colour: dl lightness, ds saturation, dh hue (all −1..1). */
export function shade(c, dl = 0, ds = 0, dh = 0) {
    const col = new THREE.Color(c);
    const hsl = {};
    col.getHSL(hsl);
    col.setHSL((hsl.h + dh + 1) % 1, Math.max(0, Math.min(1, hsl.s + ds)), Math.max(0, Math.min(1, hsl.l + dl)));
    return col.getHex();
}

/** Paint a dab: a soft elongated stroke with a darker edge, like a loaded brush. */
export function dab(g, x, y, len, wid, ang, color, alpha = 0.5) {
    g.save();
    g.translate(x, y); g.rotate(ang);
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = alpha * 0.35;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
}

/** Paper grain for the full-screen overlay. */
export function paperDataUrl(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = brushRand(77);
    g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
        const v = 100 + Math.floor(r() * 60);
        g.fillStyle = `rgba(${v},${v},${v},0.35)`;
        g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 160; i++) {
        g.strokeStyle = `rgba(${r() < 0.5 ? 60 : 200},${r() < 0.5 ? 60 : 200},${r() < 0.5 ? 60 : 200},0.12)`;
        g.lineWidth = 1 + r() * 3;
        g.beginPath();
        const x = r() * size, y = r() * size, a = r() * Math.PI;
        g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
        g.stroke();
    }
    return c.toDataURL();
}
