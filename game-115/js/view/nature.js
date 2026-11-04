// Trees, boulders and the little wild things, painted at high resolution with soft gradients.
// A tree comes in four shapes and four seasons; the shape is chosen by the node's seed.

import { canvas, ctx2, PX, INK, rnd, mix, lighten, darken, lin, rad, circle, ellipse, poly, line, box, softShadow } from './paint.js';

const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

const LEAF = [
    ['#8fd06a', '#6dbb55', '#4f9a45'],      // spring
    ['#5fae4c', '#4a9a40', '#35803a'],      // summer
    ['#f0b13c', '#e0842c', '#b95a24'],      // autumn
    ['#dfe9f0', '#c6d6e2', '#a9bccb'],      // winter (snow)
];

function blob(g, x, y, r, cols, rng) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = rad(g, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.05, [[0, cols[0]], [0.55, cols[1]], [1, cols[2]]]);
    g.fill();
    g.strokeStyle = 'rgba(40,24,16,0.55)'; g.lineWidth = 1.6; g.stroke();
    g.clip();
    for (let i = 0; i < 16; i++) {
        g.fillStyle = `rgba(255,255,255,${0.05 + rng() * 0.1})`;
        g.beginPath(); g.arc(x + (rng() - 0.5) * r * 1.5, y + (rng() - 0.6) * r * 1.4, 1.5 + rng() * 2.4, 0, 7); g.fill();
        g.fillStyle = `rgba(20,40,20,${0.06 + rng() * 0.1})`;
        g.beginPath(); g.arc(x + (rng() - 0.5) * r * 1.5, y + (rng() - 0.2) * r * 1.4, 1.5 + rng() * 2.2, 0, 7); g.fill();
    }
    g.restore();
}

function trunk(g, x, y, w, h, bark) {
    g.fillStyle = lin(g, x - w / 2, 0, x + w / 2, 0, [[0, lighten(bark, 0.12)], [1, darken(bark, 0.25)]]);
    poly(g, [[x - w / 2, y], [x - w * 0.35, y - h], [x + w * 0.35, y - h], [x + w / 2, y]], g.fillStyle, INK, 1.8);
    g.strokeStyle = 'rgba(40,24,16,0.4)'; g.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * w * 0.18, y - 2); g.lineTo(x + i * w * 0.12, y - h + 4); g.stroke(); }
}

/** variant 0 oak, 1 pine, 2 birch, 3 round fruit tree. season 0..3. Returns { c, w, h } (w, h in tiles). */
export function tree(variant, season) {
    return memo(`tree:${variant}:${season}`, () => {
        const W = Math.round(PX * 1.5), H = Math.round(PX * 2.3);
        const c = canvas(W, H), g = ctx2(c);
        const rng = rnd(variant * 31 + season * 7 + 3);
        const cols = LEAF[season];
        const cx = W / 2, by = H - 8;
        softShadow(g, cx, by, 34, 9, 0.32);
        if (variant === 1) {
            trunk(g, cx, by, 12, 30, '#7a5230');
            const layers = [[0, 70, 30], [-26, 56, 26], [-50, 42, 22], [-72, 28, 18]];
            for (const [dy, w, h] of layers) {
                const y = by - 26 + dy;
                poly(g, [[cx - w / 2, y], [cx, y - h * 2.0], [cx + w / 2, y]], null, INK, 1.8);
                g.fillStyle = lin(g, cx - w / 2, 0, cx + w / 2, 0, [[0, season === 3 ? '#f3f8fb' : lighten(cols[0], 0.05)], [0.5, season === 3 ? '#dbe7ef' : cols[1]], [1, season === 3 ? '#b4c6d4' : cols[2]]]);
                g.fill();
                g.stroke();
            }
            if (season === 3) { g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx + (rng() - 0.5) * 40, by - 50 - rng() * 90, 2 + rng() * 2, 0, 7); g.fill(); } }
        } else if (variant === 2) {
            trunk(g, cx, by, 10, 62, '#e8e2d4');
            g.fillStyle = '#4a4036';
            for (let i = 0; i < 6; i++) g.fillRect(cx - 4 + rng() * 6, by - 8 - i * 9, 4, 2);
            if (season === 3) { line(g, cx, by - 40, cx - 22, by - 78, '#6a5a48', 2.4); line(g, cx, by - 50, cx + 20, by - 88, '#6a5a48', 2.4); line(g, cx, by - 58, cx + 2, by - 100, '#6a5a48', 2.4); }
            else { for (const [dx, dy, r] of [[0, -92, 26], [-17, -72, 20], [17, -74, 20], [0, -66, 22]]) blob(g, cx + dx, by + dy, r, cols.map((x) => lighten(x, 0.08)), rng); }
        } else if (variant === 3) {
            trunk(g, cx, by, 14, 36, '#8a5a3a');
            for (const [dx, dy, r] of [[-18, -52, 22], [18, -52, 22], [0, -78, 26], [0, -48, 26]]) blob(g, cx + dx, by + dy, r, cols, rng);
            if (season !== 3) {
                const fruit = season === 0 ? '#ffd0e0' : season === 2 ? '#f2d046' : '#e04a3a';
                for (let i = 0; i < 9; i++) circle(g, cx + (rng() - 0.5) * 70, by - 50 - rng() * 44, 3.2, fruit, 'rgba(40,24,16,0.6)', 1);
            }
        } else {
            trunk(g, cx, by, 16, 44, '#7d5230');
            if (season === 3) {
                line(g, cx, by - 36, cx - 28, by - 78, '#5a3d28', 3.4); line(g, cx, by - 40, cx + 26, by - 82, '#5a3d28', 3.4); line(g, cx, by - 44, cx - 4, by - 100, '#5a3d28', 3.4);
                line(g, cx - 14, by - 60, cx - 34, by - 66, '#5a3d28', 2.4); line(g, cx + 14, by - 64, cx + 34, by - 72, '#5a3d28', 2.4);
                g.fillStyle = '#ffffff'; for (const [dx, dy] of [[-28, -78], [26, -82], [-4, -100], [-34, -66], [34, -72]]) { g.beginPath(); g.ellipse(cx + dx, by + dy, 7, 3, 0, 0, 7); g.fill(); }
            } else {
                for (const [dx, dy, r] of [[-24, -60, 24], [24, -62, 24], [0, -92, 30], [-4, -62, 30], [-30, -84, 18], [30, -86, 18]]) blob(g, cx + dx, by + dy, r, cols, rng);
                if (season === 0) for (let i = 0; i < 14; i++) circle(g, cx + (rng() - 0.5) * 80, by - 60 - rng() * 64, 2.2, '#ffe0ec', null);
            }
        }
        return { c, w: W / PX, h: H / PX };
    });
}

export function stump() {
    return memo('stump', () => {
        const c = canvas(PX * 0.7, PX * 0.55), g = ctx2(c);
        const cx = c.width / 2, by = c.height - 6;
        softShadow(g, cx, by, 22, 6, 0.3);
        poly(g, [[cx - 14, by], [cx - 11, by - 14], [cx + 11, by - 14], [cx + 14, by]], lin(g, cx - 14, 0, cx + 14, 0, [[0, '#b58a55'], [1, '#6e4a2a']]), INK, 1.8);
        ellipse(g, cx, by - 14, 11, 4.5, '#d9b27a', INK, 1.6);
        ellipse(g, cx, by - 14, 6, 2.2, null, 'rgba(120,80,40,0.7)', 1);
        return { c, w: c.width / PX, h: c.height / PX };
    });
}

/** variant 0..3 boulders; season 3 adds snow. */
export function rock(variant, season) {
    return memo(`rock:${variant}:${season}`, () => {
        const W = Math.round(PX * 1.0), H = Math.round(PX * 0.85);
        const c = canvas(W, H), g = ctx2(c);
        const rng = rnd(variant * 17 + 5);
        const cx = W / 2, by = H - 7;
        softShadow(g, cx, by, 30, 8, 0.3);
        const shapes = [
            [[-26, 0], [-30, -16], [-14, -34], [10, -36], [28, -20], [30, 0]],
            [[-30, 0], [-22, -26], [0, -30], [24, -22], [32, 0]],
            [[-22, 0], [-28, -12], [-12, -22], [-6, -34], [14, -30], [26, -12], [24, 0]],
            [[-30, 0], [-26, -20], [-8, -26], [12, -24], [30, -10], [28, 0]],
        ];
        const pts = shapes[variant % 4].map(([x, y]) => [cx + x, by + y]);
        poly(g, pts, lin(g, cx - 30, by - 36, cx + 30, by, [[0, '#cfc9bd'], [0.55, '#a29b8e'], [1, '#6f695f']]), INK, 2);
        g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 12 + rng() * 24, by - 8 - rng() * 22); g.lineTo(cx - 8 + rng() * 20, by - 4 - rng() * 12); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(cx - 8, by - 24, 9, 4, -0.5, 0, 7); g.fill();
        if (season === 3) { g.fillStyle = '#f7fbff'; g.beginPath(); g.ellipse(cx, by - 30, 20, 6, 0, 0, 7); g.fill(); }
        else { g.fillStyle = 'rgba(95,150,70,0.8)'; g.beginPath(); g.ellipse(cx + 12, by - 4, 11, 4, 0, 0, 7); g.fill(); }
        return { c, w: W / PX, h: H / PX };
    });
}

/** kind: bush | flax | herbp | mush. full=false is the picked-over version. */
export function plant(kind, full, season, variant = 0) {
    return memo(`plant:${kind}:${full}:${season}:${variant}`, () => {
        const W = Math.round(PX * 0.9), H = Math.round(PX * 0.8);
        const c = canvas(W, H), g = ctx2(c);
        const rng = rnd(variant * 13 + (kind.charCodeAt(0) * 7));
        const cx = W / 2, by = H - 6;
        softShadow(g, cx, by, 24, 6, 0.25);
        const leaf = LEAF[season === 3 ? 1 : season];
        if (kind === 'bush') {
            for (const [dx, dy, r] of [[-14, -14, 14], [14, -14, 14], [0, -24, 16], [0, -12, 18]]) blob(g, cx + dx, by + dy, r, season === 3 ? ['#dfe9f0', '#a9bccb', '#8aa0b2'] : leaf, rng);
            if (full && season !== 3) for (let i = 0; i < 8; i++) circle(g, cx + (rng() - 0.5) * 40, by - 10 - rng() * 28, 3.1, '#d63a4a', 'rgba(60,10,20,0.7)', 1);
        } else if (kind === 'flax') {
            const n = full ? 9 : 3;
            for (let i = 0; i < n; i++) {
                const x = cx - 22 + i * (44 / Math.max(1, n - 1));
                const h = full ? 38 + rng() * 14 : 12 + rng() * 6;
                line(g, x, by, x + (rng() - 0.5) * 6, by - h, season === 2 ? '#c8a348' : '#6aa84f', 2.2);
                if (full) circle(g, x + (rng() - 0.5) * 6, by - h, 3, season === 3 ? '#e6eef5' : '#7aa8e8', 'rgba(30,40,80,0.6)', 1);
            }
        } else if (kind === 'herbp') {
            const n = full ? 7 : 3;
            for (let i = 0; i < n; i++) {
                const a = -0.9 + i * (1.8 / Math.max(1, n - 1));
                const len = full ? 30 + rng() * 6 : 12;
                const x1 = cx + Math.sin(a) * len, y1 = by - Math.cos(a) * len * 0.9;
                line(g, cx, by, x1, y1, '#4f8f45', 2);
                ellipse(g, x1, y1, 7, 4, season === 2 ? '#c9a43e' : '#7bbf5c', INK, 1.2);
                if (full && i % 2 === 0) circle(g, x1, y1 - 3, 2.4, '#b58ad0', null);
            }
        } else {
            const n = full ? 3 : 1;
            for (let i = 0; i < n; i++) {
                const x = cx - 10 + i * 10 + rng() * 3, h = 8 + (i === 1 ? 7 : 0) + rng() * 5, r = 8 + rng() * 3;
                poly(g, [[x - 3, by], [x - 2, by - h], [x + 2, by - h], [x + 3, by]], '#efe6cf', INK, 1.2);
                ellipse(g, x, by - h, r, r * 0.65, '#c8453a', INK, 1.4);
                circle(g, x - 2, by - h - 1, 1.6, '#ffe6d6'); circle(g, x + 3, by - h, 1.2, '#ffe6d6');
            }
        }
        return { c, w: W / PX, h: H / PX };
    });
}

/** A soft round shadow texture used under everything that stands. */
export function shadowTex() {
    return memo('shadow', () => {
        const c = canvas(64, 64), g = ctx2(c);
        g.fillStyle = rad(g, 32, 32, 0, 30, [[0, 'rgba(20,12,6,0.5)'], [0.6, 'rgba(20,12,6,0.3)'], [1, 'rgba(20,12,6,0)']]);
        g.fillRect(0, 0, 64, 64);
        return c;
    });
}
export function glowTex() {
    return memo('glowtex', () => {
        const c = canvas(64, 64), g = ctx2(c);
        g.fillStyle = rad(g, 32, 32, 0, 31, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
        g.fillRect(0, 0, 64, 64);
        return c;
    });
}
