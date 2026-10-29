// Shared bits for the Observatory tower: canvas textures (wallpapers, floor
// mosaics, stained glass, plaques, labels), glowing sprites and materials.
// Everything is drawn in code, as in the rest of the garden.

import * as THREE from 'three';
import { glowSprite } from './textures.js';
import { rng, TAU } from './util.js';

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    t.anisotropy = 4;
    return t;
}

const css = (c) => '#' + new THREE.Color(c).getHexString();

/** Repeating wallpaper: 'stripes', 'stars', 'damask', 'clouds', 'grid', 'dots', 'scales' or 'plain'. */
export function wallpaper(pattern, base, ink, accent = ink, repeat = [4, 2]) {
    return canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = css(base);
        x.fillRect(0, 0, w, h);
        const r = rng('wp-' + pattern + base);
        // a little mottling so no wall looks printed
        for (let i = 0; i < 260; i++) {
            x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.025 + r() * 0.03})`;
            x.beginPath();
            x.arc(r() * w, r() * h, 6 + r() * 26, 0, TAU);
            x.fill();
        }
        x.fillStyle = css(ink);
        x.strokeStyle = css(ink);
        if (pattern === 'stripes') {
            for (let i = 0; i < 4; i++) {
                x.globalAlpha = 0.55;
                x.fillRect(i * 64 + 6, 0, 22, h);
                x.globalAlpha = 0.9;
                x.fillStyle = css(accent);
                x.fillRect(i * 64 + 34, 0, 3, h);
                x.fillStyle = css(ink);
            }
        } else if (pattern === 'stars') {
            const star = (cx, cy, s) => {
                x.beginPath();
                for (let k = 0; k < 10; k++) {
                    const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? s * 0.42 : s;
                    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
                }
                x.closePath();
                x.fill();
            };
            x.globalAlpha = 0.85;
            for (const [cx, cy, s] of [[64, 64, 14], [192, 192, 14], [192, 64, 6], [64, 192, 6], [128, 128, 4], [0, 128, 4], [128, 0, 4], [256, 128, 4], [128, 256, 4]]) star(cx, cy, s);
            x.fillStyle = css(accent);
            for (let i = 0; i < 26; i++) {
                x.beginPath();
                x.arc(r() * w, r() * h, 1 + r() * 1.4, 0, TAU);
                x.fill();
            }
        } else if (pattern === 'damask') {
            x.globalAlpha = 0.5;
            x.lineWidth = 3;
            for (const [cx, cy] of [[128, 128], [0, 0], [256, 0], [0, 256], [256, 256]]) {
                x.beginPath();
                x.ellipse(cx, cy, 34, 58, 0, 0, TAU);
                x.stroke();
                x.beginPath();
                x.ellipse(cx, cy, 14, 26, 0, 0, TAU);
                x.fill();
                for (const s of [-1, 1]) {
                    x.beginPath();
                    x.arc(cx + s * 40, cy - 40, 12, 0, TAU);
                    x.stroke();
                    x.beginPath();
                    x.arc(cx + s * 40, cy + 40, 12, 0, TAU);
                    x.stroke();
                }
            }
            x.fillStyle = css(accent);
            x.globalAlpha = 0.6;
            for (const [cx, cy] of [[128, 0], [0, 128], [256, 128], [128, 256]]) {
                x.beginPath();
                x.arc(cx, cy, 6, 0, TAU);
                x.fill();
            }
        } else if (pattern === 'clouds') {
            x.globalAlpha = 0.5;
            for (const [cx, cy] of [[60, 70], [190, 190], [200, 60], [70, 200]]) {
                for (let k = 0; k < 5; k++) {
                    x.beginPath();
                    x.arc(cx + (k - 2) * 14, cy + (k % 2 ? -8 : 2), 16 + (k % 2) * 6, 0, TAU);
                    x.fill();
                }
            }
        } else if (pattern === 'grid') {
            x.globalAlpha = 0.35;
            x.lineWidth = 1;
            for (let i = 0; i <= 256; i += 32) {
                x.beginPath();
                x.moveTo(i, 0);
                x.lineTo(i, h);
                x.moveTo(0, i);
                x.lineTo(w, i);
                x.stroke();
            }
            x.globalAlpha = 0.6;
            x.strokeStyle = css(accent);
            x.beginPath();
            x.arc(128, 128, 40, 0, TAU);
            x.moveTo(88, 128);
            x.lineTo(168, 128);
            x.moveTo(128, 88);
            x.lineTo(128, 168);
            x.stroke();
        } else if (pattern === 'dots') {
            x.globalAlpha = 0.7;
            for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
                x.fillStyle = (i + j) % 3 ? css(ink) : css(accent);
                x.beginPath();
                x.arc(i * 32 + (j % 2) * 16 + 8, j * 32 + 16, 3.5, 0, TAU);
                x.fill();
            }
        } else if (pattern === 'scales') {
            x.globalAlpha = 0.45;
            x.lineWidth = 2.5;
            for (let j = -1; j < 9; j++) for (let i = -1; i < 9; i++) {
                x.beginPath();
                x.arc(i * 32 + (j % 2 ? 16 : 0), j * 32, 16, 0, Math.PI);
                x.stroke();
            }
        }
        x.globalAlpha = 1;
    }, { repeat });
}

/** Floor tiles: 'checker', 'herringbone', 'parquet' or 'flag'. */
export function floorTex(pattern, a, b, repeat = [5, 5]) {
    return canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = css(a);
        x.fillRect(0, 0, w, h);
        const r = rng('fl-' + pattern + a);
        x.fillStyle = css(b);
        if (pattern === 'checker') {
            for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
            x.strokeStyle = 'rgba(0,0,0,0.25)';
            for (let i = 0; i <= 4; i++) {
                x.beginPath();
                x.moveTo(i * 64, 0);
                x.lineTo(i * 64, h);
                x.moveTo(0, i * 64);
                x.lineTo(w, i * 64);
                x.stroke();
            }
        } else if (pattern === 'parquet' || pattern === 'herringbone') {
            for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
                const shade = 0.75 + r() * 0.35;
                const c = new THREE.Color(b).multiplyScalar(shade);
                x.fillStyle = css(c);
                if ((i + j) % 2) x.fillRect(i * 32 + 1, j * 32 + 1, 30, 14), x.fillRect(i * 32 + 1, j * 32 + 17, 30, 14);
                else x.fillRect(i * 32 + 1, j * 32 + 1, 14, 30), x.fillRect(i * 32 + 17, j * 32 + 1, 14, 30);
            }
        } else if (pattern === 'flag') {
            for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
                const c = new THREE.Color(b).lerp(new THREE.Color(a), r() * 0.6);
                x.fillStyle = css(c);
                x.fillRect(i * 43 + 2, j * 43 + 2, 39, 39);
            }
        }
        // a gloss of wear
        for (let i = 0; i < 80; i++) {
            x.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
            x.beginPath();
            x.arc(r() * w, r() * h, 8 + r() * 30, 0, TAU);
            x.fill();
        }
    }, { repeat });
}

/** The great floor mosaic of a hub: rings, a sixteen-point compass star and a ring of glyphs. */
export function mosaicTex(pal, seed) {
    const [deep, gold, mid, pale] = pal;
    return canvasTex(1024, 1024, (x, w) => {
        const c = w / 2;
        const r = rng('mosaic' + seed);
        x.fillStyle = deep;
        x.fillRect(0, 0, w, w);
        // tesserae speckle
        for (let i = 0; i < 9000; i++) {
            const a = r() * TAU, d = Math.sqrt(r()) * c;
            x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
            x.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 6, 6);
        }
        const ring = (rad, lw, col) => {
            x.strokeStyle = col;
            x.lineWidth = lw;
            x.beginPath();
            x.arc(c, c, rad, 0, TAU);
            x.stroke();
        };
        ring(500, 16, gold);
        ring(470, 4, pale);
        ring(380, 6, gold);
        ring(300, 3, pale);
        // a ring of glyphs between the rings
        x.fillStyle = pale;
        x.font = '600 44px Georgia, serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        const glyphs = ['☉', '☽', '☿', '♀', '♁', '♂', '♃', '♄', '★', '✶', '✷', '✦'];
        for (let k = 0; k < 24; k++) {
            const a = (k / 24) * TAU;
            x.save();
            x.translate(c + Math.cos(a) * 425, c + Math.sin(a) * 425);
            x.rotate(a + Math.PI / 2);
            x.fillText(glyphs[k % glyphs.length], 0, 0);
            x.restore();
        }
        // sixteen-point star
        for (let pass = 0; pass < 2; pass++) {
            const n = 8, R = pass ? 360 : 290, rr = pass ? 70 : 60;
            for (let k = 0; k < n; k++) {
                const a = (k / n) * TAU + (pass ? 0 : Math.PI / n);
                const a1 = a - Math.PI / n, a2 = a + Math.PI / n;
                for (const half of [0, 1]) {
                    x.fillStyle = half ? (pass ? gold : mid) : pass ? pale : deep;
                    x.beginPath();
                    x.moveTo(c, c);
                    x.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
                    x.lineTo(c + Math.cos(half ? a2 : a1) * rr, c + Math.sin(half ? a2 : a1) * rr);
                    x.closePath();
                    x.fill();
                }
            }
        }
        ring(60, 10, gold);
        x.fillStyle = mid;
        x.beginPath();
        x.arc(c, c, 52, 0, TAU);
        x.fill();
    });
}

/** Stained glass for a lancet window: leaded cells in jewel colours around a star or a moon. */
export function stainedGlassTex(colors, seed) {
    const W = 160, H = 400;
    return canvasTex(W, H, (x) => {
        const r = rng('glass' + seed);
        const pts = [];
        for (let i = 0; i < 26; i++) pts.push([r() * W, r() * H, colors[Math.floor(r() * colors.length)]]);
        const img = x.createImageData(W, H);
        for (let y = 0; y < H; y++) {
            for (let xx = 0; xx < W; xx++) {
                let d1 = 1e9, d2 = 1e9, best = null;
                for (const p of pts) {
                    const d = (p[0] - xx) ** 2 + (p[1] - y) ** 2;
                    if (d < d1) {
                        d2 = d1;
                        d1 = d;
                        best = p;
                    } else if (d < d2) d2 = d;
                }
                const edge = Math.sqrt(d2) - Math.sqrt(d1);
                const col = new THREE.Color(best[2]);
                const k = (y * W + xx) * 4;
                const lead = edge < 2.2 ? 0.08 : 1;
                const sheen = 0.75 + 0.25 * Math.sin((xx + y) * 0.05 + best[0]);
                img.data[k] = col.r * 255 * lead * sheen;
                img.data[k + 1] = col.g * 255 * lead * sheen;
                img.data[k + 2] = col.b * 255 * lead * sheen;
                img.data[k + 3] = 255;
            }
        }
        x.putImageData(img, 0, 0);
        // a motif in the upper half, outlined in lead
        x.lineWidth = 5;
        x.strokeStyle = '#140d08';
        x.fillStyle = '#fff2c0';
        const cx = W / 2, cy = H * 0.3;
        x.beginPath();
        if (seed % 2) {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * TAU - Math.PI / 2, rr = k % 2 ? 16 : 40;
                x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            x.closePath();
        } else {
            x.arc(cx, cy, 34, 0, TAU);
            x.fill();
            x.stroke();
            x.fillStyle = colors[0];
            x.beginPath();
            x.arc(cx + 14, cy - 6, 30, 0, TAU);
        }
        x.fill();
        x.stroke();
        x.strokeRect(3, 3, W - 6, H - 6);
    });
}

/** A brass plaque with engraved text. */
export function plaqueTex(title, sub, accent = '#d9b46a') {
    return canvasTex(512, 160, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#d8b664');
        g.addColorStop(1, '#8a6a2c');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        x.strokeStyle = '#4a3410';
        x.lineWidth = 6;
        x.strokeRect(8, 8, w - 16, h - 16);
        x.fillStyle = '#2a1a06';
        x.textAlign = 'center';
        x.font = '600 46px Georgia, serif';
        x.fillText(title, w / 2, sub ? 72 : 96, w - 40);
        if (sub) {
            x.font = 'italic 30px Georgia, serif';
            x.fillStyle = '#3d2a0c';
            x.fillText(sub, w / 2, 122, w - 40);
        }
        x.fillStyle = accent;
        x.fillRect(40, h - 22, w - 80, 3);
    });
}

export function plaqueMesh(title, sub, w = 0.6, accent) {
    const tex = plaqueTex(title, sub, accent);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.3125), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
    return m;
}

/** A glowing additive sprite. */
export function glow(color, size = 1, opacity = 0.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1);
    return s;
}

export function emissiveMat(color, intensity = 1.5, extra = {}) {
    return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra });
}

/** A floating text label drawn on a sprite (names of constellations and the like). */
export function textSprite(text, { color = '#fff2c8', size = 0.5, font = 'italic 600 54px Georgia, serif', glowColor = 'rgba(160,190,255,0.9)' } = {}) {
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    x.font = font;
    const tw = Math.ceil(x.measureText(text).width) + 40;
    c.width = tw;
    c.height = 90;
    x.font = font;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = glowColor;
    x.shadowBlur = 16;
    x.fillStyle = color;
    x.fillText(text, tw / 2, 46);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(size * (tw / 90), size, 1);
    return s;
}

/** A cloud of soft glowing points (motes, spores, snow, stardust) whose positions you animate. */
export function motes(n, color, size = 0.12, opacity = 0.9) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({ map: glowSprite(), color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
}

/** Points with a colour per point. */
export function colorMotes(n, size = 0.12, opacity = 0.9) {
    const p = motes(n, 0xffffff, size, opacity);
    p.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    p.material.vertexColors = true;
    return p;
}

/** Easing helpers shared by the rooms. */
export const ease = {
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2),
};

export const RAINBOW = ['#ff4f6a', '#ff9a3c', '#ffe14d', '#5cf27a', '#3fd0ff', '#5b6dff', '#c45cff'];
