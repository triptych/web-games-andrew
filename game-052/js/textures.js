// Every texture in the game is painted here on a 2D canvas at boot.
// Colour management is off (see main.js), so canvas colours are used as-is.

import * as THREE from 'three';
import { mulberry32 } from './rng.js';

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

function tex(c, { repeat = false, nearest = false, mips = true } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.generateMipmaps = mips;
    t.anisotropy = 4;
    return t;
}

// ------------------------------------------------------------------
// CJK font detection: on a machine with no CJK font every glyph is the
// same tofu box, so we fall back to Latin-only signs rather than a city
// of empty rectangles.
// ------------------------------------------------------------------
let _cjk = null;
export function hasCJK() {
    if (_cjk !== null) return _cjk;
    try {
        const c = canvas(40, 40), g = c.getContext('2d', { willReadFrequently: true });
        const draw = (ch) => {
            g.clearRect(0, 0, 40, 40);
            g.fillStyle = '#fff';
            g.font = '32px sans-serif';
            g.fillText(ch, 2, 32);
            return g.getImageData(0, 0, 40, 40).data.join(',');
        };
        _cjk = draw('電') !== draw('雨') && draw('雨') !== draw('\u{10FFFD}');
    } catch { _cjk = false; }
    return _cjk;
}

// ------------------------------------------------------------------
// Building facades: one 512² sheet of 32×32 window cells. The bottom row is
// a windowless band — roofs map into it and, because the sheet repeats, it
// also reads as a mechanical floor every 32 storeys.
// ------------------------------------------------------------------
export function makeWindowTexture(seed) {
    const N = 32, P = 16, S = N * P;
    const c = canvas(S, S), g = c.getContext('2d');
    const r = mulberry32(seed);
    g.fillStyle = '#0a0a11';
    g.fillRect(0, 0, S, S);
    // faint vertical panel seams
    for (let x = 0; x < S; x += P) {
        g.fillStyle = 'rgba(40,40,60,0.25)';
        g.fillRect(x, 0, 1, S);
    }
    const lit = [
        [255, 196, 128], [255, 210, 150], [255, 180, 110], [170, 210, 255],
        [220, 225, 210], [255, 120, 200], [120, 255, 230], [255, 236, 190],
    ];
    // Lit windows come in runs (a whole office floor left on) — reads better
    // than salt-and-pepper noise at distance.
    for (let row = 0; row < N - 1; row++) {
        let run = 0, runCol = null;
        const rowBias = r() < 0.18 ? 0.55 : r() < 0.3 ? 0.04 : 0.24;
        for (let col = 0; col < N; col++) {
            if (run <= 0) {
                run = 1 + Math.floor(r() * 6);
                runCol = r() < rowBias ? lit[Math.floor(r() * (r() < 0.75 ? 3 : lit.length))] : null;
            }
            run--;
            const x = col * P, y = row * P;
            if (runCol && r() < 0.85) {
                const k = 0.55 + r() * 0.45;
                g.fillStyle = `rgb(${runCol[0] * k | 0},${runCol[1] * k | 0},${runCol[2] * k | 0})`;
                g.fillRect(x + 3, y + 4, 10, 9);
                // blinds or a silhouette now and then
                if (r() < 0.25) {
                    g.fillStyle = 'rgba(0,0,0,0.35)';
                    for (let b = 0; b < 4; b++) g.fillRect(x + 3, y + 5 + b * 2, 10, 1);
                } else if (r() < 0.1) {
                    g.fillStyle = 'rgba(10,6,14,0.8)';
                    g.fillRect(x + 6, y + 8, 3, 5);
                    g.fillRect(x + 6.5, y + 6, 2, 2);
                }
            } else {
                g.fillStyle = r() < 0.5 ? '#12121c' : '#161622';
                g.fillRect(x + 3, y + 4, 10, 9);
                g.fillStyle = 'rgba(90,90,140,0.12)';
                g.fillRect(x + 3, y + 4, 10, 2);
            }
        }
    }
    // windowless band (v ∈ [0, 1/32])
    g.fillStyle = '#0c0b12';
    g.fillRect(0, S - P, S, P);
    g.fillStyle = 'rgba(60,60,90,0.25)';
    g.fillRect(0, S - P + 2, S, 1);
    return tex(c, { repeat: true });
}

// ------------------------------------------------------------------
// Neon sign atlas: 32 vertical blade signs (64×256) in the top half and 32
// horizontal ones (256×64) in the bottom half. Glow is baked with shadowBlur.
// ------------------------------------------------------------------
const V_CJK = ['ラーメン', '居酒屋', '電気', '夜市', '酒場', '薬局', 'ホテル', 'カラオケ', '寿司', '未来', '愛', '夢', '光', '麺', '喫茶', '占い', '銀河', '龍', '月見', '雨', '強力', '遊戯', '天国', '電脳'];
const V_LAT = ['BAR', 'HOTEL', 'NOODLE', 'OPEN', 'LIVE', 'SAKE', 'TAXI', 'CLUB', 'SUSHI', '24H', 'SOMA', 'DATA', 'BOOKS', 'DANCE', 'GIN', 'TEA'];
const H_LAT = ['NOODLES', 'OPEN 24H', 'HOTEL LUNA', 'KAIJU COLA', 'NEXIS', 'OKAMI', 'SYNTH', 'VAPOR', 'PACHINKO', 'KARAOKE', 'NIGHT OWL', 'LIQUOR', 'TATTOO', 'REPAIRS', 'MEMORY', 'DREAMS', 'ROBOTICS', 'PAWN', 'ECHO', 'ORIGAMI', 'HOLO', 'PHARMACY', 'DRINKS', 'AURORA', 'BLUE MOON', 'NO VACANCY', 'CYBERNETICS', 'GOLDFISH', 'CHROME', 'MOTEL', 'ARCADE', 'SODA'];
const H_CJK = ['雨夜', 'ラーメン', '電気街', '未来', '居酒屋', 'ゲーム', '夢の国', '銀河鉄道'];
const NEON = ['#ff2fa8', '#2ff3ff', '#ffb02f', '#a07bff', '#ff4b4b', '#4bff9b', '#ffe94b', '#ff6ad5', '#3bffd1', '#ff8c2f', '#4b8bff', '#ffffff'];

function neonText(g, text, x, y, color, size, font) {
    g.font = `${size}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = size * 0.45;
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.shadowBlur = size * 0.15;
    g.fillStyle = mixWhite(color, 0.55);
    g.fillText(text, x, y);
    g.shadowBlur = 0;
}

function mixWhite(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    return `rgb(${r + (255 - r) * k | 0},${gg + (255 - gg) * k | 0},${b + (255 - b) * k | 0})`;
}

function tube(g, x, y, w, h, color, rad = 8) {
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x, y, w, h, rad);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = mixWhite(color, 0.6);
    g.lineWidth = 1;
    g.stroke();
}

const CJK_FONT = '"Noto Sans CJK JP","Hiragino Sans","Yu Gothic","Meiryo","MS Gothic",sans-serif';
const LAT_FONT = '"Arial Black","Impact","Helvetica Neue",Arial,sans-serif';

export function makeSignAtlas(seed) {
    const S = 1024;
    const c = canvas(S, S), g = c.getContext('2d');
    const r = mulberry32(seed);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const cjk = hasCJK();
    const vertical = [], horizontal = [];

    for (let i = 0; i < 32; i++) {
        const x = (i % 16) * 64, y = Math.floor(i / 16) * 256;
        const color = pick(NEON);
        const panel = r() < 0.65;
        if (panel) {
            g.fillStyle = r() < 0.5 ? 'rgba(14,6,20,0.92)' : 'rgba(6,10,22,0.92)';
            g.beginPath(); g.roundRect(x + 6, y + 6, 52, 244, 6); g.fill();
            tube(g, x + 8, y + 8, 48, 240, color, 6);
        }
        const word = cjk && r() < 0.7 ? pick(V_CJK) : pick(V_LAT);
        const chars = [...word];
        const step = Math.min(56, 220 / chars.length);
        const size = Math.min(44, step * 0.9);
        const font = /[A-Z0-9]/.test(word) ? LAT_FONT : CJK_FONT;
        chars.forEach((ch, k) => {
            neonText(g, ch, x + 32, y + 128 + (k - (chars.length - 1) / 2) * step, color, size, font);
        });
        vertical.push(uvRect(x, y, 64, 256, S));
    }

    for (let i = 0; i < 32; i++) {
        const x = (i % 4) * 256, y = 512 + Math.floor(i / 4) * 64;
        const color = pick(NEON);
        const panel = r() < 0.55;
        if (panel) {
            g.fillStyle = 'rgba(10,6,18,0.9)';
            g.beginPath(); g.roundRect(x + 5, y + 5, 246, 54, 8); g.fill();
            tube(g, x + 7, y + 7, 242, 50, pick(NEON), 8);
        }
        const word = cjk && r() < 0.25 ? pick(H_CJK) : H_LAT[i % H_LAT.length];
        const font = /[A-Z0-9]/.test(word) ? LAT_FONT : CJK_FONT;
        g.font = `40px ${font}`;
        const w = g.measureText(word).width;
        const size = Math.min(40, 40 * 220 / Math.max(1, w));
        neonText(g, word, x + 128, y + 33, color, size, font);
        horizontal.push(uvRect(x, y, 256, 64, S));
    }
    const t = tex(c);
    return { texture: t, vertical, horizontal };
}

function uvRect(x, y, w, h, S) {
    // CanvasTexture has flipY on: canvas y = 0 is v = 1.
    return { u0: x / S, u1: (x + w) / S, v0: 1 - (y + h) / S, v1: 1 - y / S };
}

// ------------------------------------------------------------------
// Small sprites
// ------------------------------------------------------------------
export function makeSteamTexture() {
    const S = 64, c = canvas(S, S), g = c.getContext('2d');
    const r = mulberry32(7);
    for (let i = 0; i < 26; i++) {
        const x = 16 + r() * 32, y = 16 + r() * 32, rad = 6 + r() * 14;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, 'rgba(255,255,255,0.18)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, S, S);
    }
    return tex(c, { mips: false });
}

export function makeGlowTexture() {
    const S = 64, c = canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return tex(c, { mips: false });
}

// ------------------------------------------------------------------
// Distant skyline band: silhouettes in three depth layers, a few lit
// windows, aviation lights, and one great pyramid arcology on the horizon.
// ------------------------------------------------------------------
export function makeSkylineTexture(seed) {
    const W = 2048, H = 512;
    const c = canvas(W, H), g = c.getContext('2d');
    const r = mulberry32(seed);
    const layers = [
        { col: [34, 22, 52], maxH: 0.75, n: 70, win: 0.004 },
        { col: [20, 13, 32], maxH: 0.55, n: 90, win: 0.01 },
        { col: [9, 7, 15], maxH: 0.38, n: 120, win: 0.02 },
    ];
    // The arcology sits behind the front layers.
    const drawPyramid = (cx) => {
        const base = 520, top = 110, h = H * 0.62;
        g.fillStyle = 'rgb(16,10,24)';
        g.beginPath();
        g.moveTo(cx - base / 2, H); g.lineTo(cx - top / 2, H - h);
        g.lineTo(cx + top / 2, H - h); g.lineTo(cx + base / 2, H);
        g.fill();
        for (let y = H - h + 6; y < H; y += 5) {
            const k = (H - y) / h;
            const half = (base + (top - base) * k) / 2;
            for (let x = cx - half + 2; x < cx + half - 2; x += 3) {
                if (r() < 0.22) {
                    g.fillStyle = r() < 0.8 ? 'rgba(255,170,90,0.75)' : 'rgba(255,230,190,0.9)';
                    g.fillRect(x, y, 1.5, 1.5);
                }
            }
        }
        g.fillStyle = 'rgba(255,200,140,0.9)';
        g.fillRect(cx - top / 2, H - h - 2, top, 2);
    };
    layers.forEach((L, li) => {
        if (li === 1) drawPyramid(W * 0.68);
        for (let i = 0; i < L.n; i++) {
            const w = 14 + r() * 60;
            const x = r() * W;
            const h = H * (0.08 + Math.pow(r(), 1.6) * L.maxH);
            g.fillStyle = `rgb(${L.col.join(',')})`;
            const draw = (ox) => {
                g.fillRect(ox, H - h, w, h);
                if (r() < 0.3) g.fillRect(ox + w * 0.2, H - h - h * 0.15, w * 0.6, h * 0.15);
                if (r() < 0.25) g.fillRect(ox + w * 0.48, H - h - h * 0.15 - 30, 2, 30);
            };
            draw(x);
            if (x + w > W) draw(x - W);
            // windows
            for (let y = H - h + 4; y < H; y += 4) {
                for (let xx = x + 2; xx < x + w - 2; xx += 3) {
                    if (r() < L.win * 6) {
                        g.fillStyle = r() < 0.7 ? 'rgba(255,190,120,0.8)' : 'rgba(150,210,255,0.8)';
                        g.fillRect(xx % W, y, 1.2, 1.2);
                    }
                }
            }
            if (r() < 0.5) {
                g.fillStyle = 'rgba(255,40,40,0.95)';
                g.fillRect(x + w / 2, H - h - 3, 2, 2);
            }
        }
    });
    const t = tex(c, { repeat: true });
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
}

// ------------------------------------------------------------------
// Animated billboards: small canvases redrawn ~12 times a second.
// ------------------------------------------------------------------
export class Billboards {
    constructor() {
        this.items = [];
        const kinds = ['eye', 'koi', 'cola', 'geisha'];
        for (const k of kinds) {
            const c = canvas(256, 128);
            const t = tex(c, { mips: false });
            this.items.push({ kind: k, canvas: c, g: c.getContext('2d'), texture: t });
        }
        this.cjk = hasCJK();
        this._acc = 0;
        this.time = 0;
        this.update(0.1);
    }

    update(dt) {
        this.time += dt;
        this._acc += dt;
        if (this._acc < 1 / 12) return;
        this._acc = 0;
        const t = this.time;
        for (const it of this.items) {
            this['_' + it.kind](it.g, t);
            it.texture.needsUpdate = true;
        }
    }

    _scan(g) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < 128; y += 3) g.fillRect(0, y, 256, 1);
    }

    _eye(g, t) {
        g.fillStyle = '#05030a';
        g.fillRect(0, 0, 256, 128);
        const blink = (t % 5.5) > 5.25 ? 0.1 : 1;
        const lx = Math.sin(t * 0.7) * 26 + Math.sin(t * 2.3) * 4;
        g.save();
        g.translate(128, 64);
        g.scale(1, blink);
        g.fillStyle = '#e8dccf';
        g.beginPath(); g.ellipse(0, 0, 110, 46, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3a7f9a';
        g.beginPath(); g.arc(lx, 0, 34, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c8721c';
        g.beginPath(); g.arc(lx, 0, 18, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000';
        g.beginPath(); g.arc(lx, 0, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath(); g.arc(lx - 9, -10, 5, 0, Math.PI * 2); g.fill();
        g.restore();
        // reflected flames, as if the city were on fire behind you
        if ((t % 3) < 0.4) {
            g.fillStyle = 'rgba(255,140,40,0.35)';
            g.beginPath(); g.arc(128 + lx + 6, 60, 6, 0, Math.PI * 2); g.fill();
        }
        this._scan(g);
    }

    _koi(g, t) {
        const grd = g.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0, '#04122a'); grd.addColorStop(1, '#0a3050');
        g.fillStyle = grd;
        g.fillRect(0, 0, 256, 128);
        for (let i = 0; i < 2; i++) {
            const a = t * 0.9 + i * Math.PI;
            const x = 128 + Math.cos(a) * 70, y = 64 + Math.sin(a) * 30;
            const dir = a + Math.PI / 2;
            g.save();
            g.translate(x, y); g.rotate(dir);
            g.fillStyle = i ? '#ffffff' : '#ff6a1a';
            g.beginPath(); g.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = i ? '#ff4020' : '#ffffff';
            g.beginPath(); g.ellipse(4, 0, 7, 5, 0, 0, Math.PI * 2); g.fill();
            const wag = Math.sin(t * 8 + i) * 0.5;
            g.fillStyle = i ? '#ffffff' : '#ff8a3a';
            g.beginPath(); g.moveTo(-20, 0); g.lineTo(-34, -9 + wag * 8); g.lineTo(-34, 9 + wag * 8); g.fill();
            g.restore();
        }
        g.font = `bold 22px ${this.cjk ? CJK_FONT : LAT_FONT}`;
        g.textAlign = 'right'; g.textBaseline = 'top';
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillText(this.cjk ? '鯉' : 'KOI', 246, 8);
        g.font = `12px ${LAT_FONT}`;
        g.textAlign = 'left';
        g.fillText('SWIM DEEP', 10, 108);
        this._scan(g);
    }

    _cola(g, t) {
        const h = (t * 40) % 360;
        g.fillStyle = `hsl(${h},80%,18%)`;
        g.fillRect(0, 0, 256, 128);
        for (let i = 0; i < 9; i++) {
            g.fillStyle = `hsla(${(h + i * 40) % 360},90%,55%,0.18)`;
            g.fillRect(((t * 60 + i * 34) % 300) - 30, 0, 14, 128);
        }
        g.font = `34px ${LAT_FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const x = 128 + Math.sin(t * 1.3) * 8;
        g.shadowColor = '#ff2f6e'; g.shadowBlur = 14;
        g.fillStyle = '#ffffff';
        g.fillText('KAIJU COLA', x, 52);
        g.shadowBlur = 0;
        g.font = `14px ${LAT_FONT}`;
        g.fillStyle = '#ffe94b';
        g.fillText((t % 4) < 2 ? 'TASTE THE STORM' : 'NOW 30% MORE FIZZ', 128, 92);
        this._scan(g);
    }

    _geisha(g, t) {
        g.fillStyle = '#12020a';
        g.fillRect(0, 0, 256, 128);
        // a stylised face in profile, smiling now and then
        g.fillStyle = '#f2e6e0';
        g.beginPath(); g.ellipse(96, 70, 40, 52, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#100608';
        g.beginPath(); g.ellipse(96, 30, 54, 34, 0, Math.PI, Math.PI * 2); g.fill();
        g.fillRect(42, 26, 108, 14);
        g.fillStyle = '#d01436';
        const smile = (t % 6) > 4 ? 4 : 0;
        g.beginPath(); g.ellipse(96, 98 - smile * 0.3, 9, 3 + smile * 0.4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#100608';
        const blink = (t % 4.5) > 4.3;
        g.fillRect(74, 64, 14, blink ? 1 : 3);
        g.fillRect(104, 64, 14, blink ? 1 : 3);
        g.font = `bold 26px ${this.cjk ? CJK_FONT : LAT_FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#ffd6e4';
        const words = this.cjk ? ['強力', '元気', '夢'] : ['DREAM', 'AGAIN', 'SOON'];
        const w = words[Math.floor(t / 2) % words.length];
        g.fillText(w, 200, 64);
        this._scan(g);
    }
}
