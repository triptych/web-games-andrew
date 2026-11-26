// Book covers, spines, page edges and title pages, painted into a 2D canvas from a book's procedural `look`.
// The same painter makes the little covers in the lists and the high-resolution textures of the 3D books
// (view/book3d.js), so a book looks the same everywhere. mode 'color' paints the picture; 'metal' paints a mask
// (white where the tooling is gilt) for metalness; 'bump' paints a height map (tooling raised, grain).

import { makeRng } from '../rng.js';

export const TITLE_FONT = '"Cinzel", "Trajan Pro", Georgia, serif';
export const BODY_FONT = '"Lora", Georgia, "Times New Roman", serif';

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${Math.max(0, Math.min(100, l))}%, ${a})`;

function grain(ctx, r, w, h, look, mode) {
    // leather pores, cloth weave, board grain or dragon scales
    const n = Math.round((w * h) / 90);
    if (look.material === 'cloth') {
        ctx.globalAlpha = mode === 'color' ? 0.07 : 0.18;
        ctx.strokeStyle = mode === 'color' ? '#000' : '#fff';
        ctx.lineWidth = Math.max(1, w / 400);
        for (let x = 0; x < w; x += w / 140) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += w / 140) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (look.material === 'board') {
        ctx.globalAlpha = mode === 'color' ? 0.12 : 0.25;
        ctx.strokeStyle = mode === 'color' ? hsl(30, 40, 15) : '#fff';
        ctx.lineWidth = Math.max(1, w / 300);
        for (let i = 0; i < 40; i++) {
            const y = r() * h;
            ctx.beginPath(); ctx.moveTo(0, y);
            for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, y + Math.sin(x / w * 6 + i) * h * 0.01);
            ctx.stroke();
        }
    } else if (look.material === 'dragonhide') {
        const s = w / 14;
        ctx.globalAlpha = mode === 'color' ? 0.28 : 0.5;
        for (let y = -s; y < h + s; y += s * 0.6) for (let x = ((y / (s * 0.6)) % 2) * s / 2 - s; x < w + s; x += s) {
            ctx.beginPath();
            ctx.ellipse(x, y, s * 0.48, s * 0.42, 0, 0, Math.PI);
            ctx.strokeStyle = mode === 'color' ? hsl(look.hue, look.sat, look.lit - 14) : '#fff';
            ctx.lineWidth = Math.max(1, s / 10);
            ctx.stroke();
            if (mode === 'color') { ctx.fillStyle = hsl(look.hue + 10, look.sat, look.lit + 8, 0.25); ctx.fill(); }
        }
    }
    ctx.globalAlpha = mode === 'color' ? 0.08 : 0.15;
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = mode === 'color' ? (r() < 0.5 ? '#000' : '#fff') : (r() < 0.5 ? '#000' : '#fff');
        const s = r() * w / 260 + 0.5;
        ctx.fillRect(r() * w, r() * h, s, s);
    }
    ctx.globalAlpha = 1;
}

function wear(ctx, r, w, h, look) {
    // scuffed corners and edges, lighter on old books
    const k = look.wear;
    if (k <= 0.02) return;
    ctx.globalAlpha = 0.5 * k;
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.25);
        g.addColorStop(0, 'rgba(255,240,210,0.7)'); g.addColorStop(1, 'rgba(255,240,210,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 30 * k; i++) {
        ctx.strokeStyle = 'rgba(255,235,200,0.5)';
        ctx.lineWidth = r() * w / 300 + 0.5;
        const x = r() * w, y = r() * h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * w * 0.15, y + (r() - 0.5) * w * 0.05); ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ emblems: little vector icons, drawn at (0,0) radius 1
const EMBLEM = {
    sun(c) { c.beginPath(); c.arc(0, 0, 0.42, 0, 7); c.fill(); for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * Math.PI / 6); c.beginPath(); c.moveTo(-0.07, -0.55); c.lineTo(0, -0.95); c.lineTo(0.07, -0.55); c.fill(); c.restore(); } },
    moon(c) { c.beginPath(); c.arc(0, 0, 0.8, 0, 7); c.arc(0.32, -0.18, 0.66, 0, 7, true); c.fill('evenodd'); },
    star(c) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.38 : 0.92; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); },
    eye(c) { c.beginPath(); c.moveTo(-0.95, 0); c.quadraticCurveTo(0, -0.8, 0.95, 0); c.quadraticCurveTo(0, 0.8, -0.95, 0); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 0.3, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; c.beginPath(); c.arc(0, 0, 0.16, 0, 7); c.fill(); },
    tree(c) { c.fillRect(-0.1, 0, 0.2, 0.9); c.beginPath(); c.arc(0, -0.25, 0.55, 0, 7); c.arc(-0.42, 0.05, 0.36, 0, 7); c.arc(0.42, 0.05, 0.36, 0, 7); c.fill(); },
    key(c) { c.beginPath(); c.arc(0, -0.55, 0.32, 0, 7); c.arc(0, -0.55, 0.15, 0, 7, true); c.fill('evenodd'); c.fillRect(-0.07, -0.25, 0.14, 1.1); c.fillRect(0, 0.55, 0.3, 0.12); c.fillRect(0, 0.75, 0.22, 0.12); },
    flame(c) { c.beginPath(); c.moveTo(0, -0.95); c.bezierCurveTo(0.55, -0.35, 0.6, 0.2, 0.4, 0.6); c.quadraticCurveTo(0, 1, -0.4, 0.6); c.bezierCurveTo(-0.6, 0.2, -0.3, -0.2, 0, -0.95); c.fill(); },
    wheat(c) { c.fillRect(-0.04, -0.6, 0.08, 1.5); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { c.save(); c.translate(0, -0.7 + i * 0.28); c.rotate(s * 0.6); c.beginPath(); c.ellipse(s * 0.16, 0, 0.18, 0.08, 0, 0, 7); c.fill(); c.restore(); } },
    rose(c) { for (let i = 0; i < 5; i++) { c.save(); c.rotate(i * Math.PI * 0.4); c.beginPath(); c.ellipse(0, -0.42, 0.3, 0.42, 0, 0, 7); c.fill(); c.restore(); } c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 0.2, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; c.beginPath(); c.arc(0, 0, 0.1, 0, 7); c.fill(); },
    sword(c) { c.beginPath(); c.moveTo(0, -0.98); c.lineTo(0.1, -0.75); c.lineTo(0.1, 0.35); c.lineTo(-0.1, 0.35); c.lineTo(-0.1, -0.75); c.closePath(); c.fill(); c.fillRect(-0.4, 0.35, 0.8, 0.12); c.fillRect(-0.06, 0.47, 0.12, 0.35); c.beginPath(); c.arc(0, 0.9, 0.1, 0, 7); c.fill(); },
    compass(c) { c.lineWidth = 0.08; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, 0, 0.82, 0, 7); c.stroke(); c.beginPath(); c.moveTo(0, -0.95); c.lineTo(0.18, 0); c.lineTo(0, 0.95); c.lineTo(-0.18, 0); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-0.95, 0); c.lineTo(0, 0.14); c.lineTo(0.95, 0); c.lineTo(0, -0.14); c.closePath(); c.fill(); },
    dragon(c) { c.beginPath(); c.moveTo(-0.9, 0.3); c.quadraticCurveTo(-0.4, -0.2, 0, 0.1); c.quadraticCurveTo(0.3, -0.7, 0.85, -0.55); c.lineTo(0.55, -0.35); c.quadraticCurveTo(0.6, 0.1, 0.2, 0.45); c.quadraticCurveTo(-0.3, 0.8, -0.9, 0.3); c.fill(); c.beginPath(); c.moveTo(-0.2, 0.05); c.lineTo(-0.55, -0.75); c.lineTo(0.05, -0.25); c.fill(); },
    quill(c) { c.beginPath(); c.moveTo(0.7, -0.95); c.quadraticCurveTo(-0.1, -0.5, -0.55, 0.6); c.lineTo(-0.45, 0.65); c.quadraticCurveTo(0.3, -0.2, 0.7, -0.95); c.fill(); c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.5, 0.6); c.lineTo(-0.75, 0.95); c.stroke(); },
    cauldron(c) {
        // a pot with handles and curls of steam (dots over a bowl read as a face)
        c.beginPath(); c.arc(0, 0.2, 0.62, 0, Math.PI); c.closePath(); c.fill();
        c.fillRect(-0.78, 0.12, 1.56, 0.13);
        c.lineWidth = 0.09; c.strokeStyle = c.fillStyle;
        for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.7, 0.38, 0.14, s > 0 ? -1.2 : 1.9, s > 0 ? 1.2 : 4.3); c.stroke(); }
        for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x, -0.05); c.bezierCurveTo(x + 0.18, -0.25, x - 0.18, -0.45, x, -0.7); c.stroke(); }
    },
    crown(c) { c.beginPath(); c.moveTo(-0.85, 0.5); c.lineTo(-0.85, -0.45); c.lineTo(-0.42, 0); c.lineTo(0, -0.75); c.lineTo(0.42, 0); c.lineTo(0.85, -0.45); c.lineTo(0.85, 0.5); c.closePath(); c.fill(); },
    gear(c) { for (let i = 0; i < 8; i++) { c.save(); c.rotate(i * Math.PI / 4); c.fillRect(-0.13, -0.95, 0.26, 0.3); c.restore(); } c.beginPath(); c.arc(0, 0, 0.7, 0, 7); c.arc(0, 0, 0.25, 0, 7, true); c.fill('evenodd'); },
    paw(c) { c.beginPath(); c.ellipse(0, 0.3, 0.42, 0.36, 0, 0, 7); c.fill(); for (const [x, y] of [[-0.55, -0.2], [-0.2, -0.55], [0.2, -0.55], [0.55, -0.2]]) { c.beginPath(); c.ellipse(x, y, 0.17, 0.22, 0, 0, 7); c.fill(); } },
    teacup(c) { c.beginPath(); c.moveTo(-0.7, -0.2); c.lineTo(0.5, -0.2); c.quadraticCurveTo(0.5, 0.6, -0.1, 0.6); c.quadraticCurveTo(-0.7, 0.6, -0.7, -0.2); c.fill(); c.lineWidth = 0.1; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0.55, 0.1, 0.2, -1.4, 1.4); c.stroke(); c.fillRect(-0.9, 0.62, 1.6, 0.1); },
};

function emblem(ctx, name, x, y, size, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = fill;
    (EMBLEM[name] || EMBLEM.star)(ctx);
    ctx.restore();
}

function fitText(ctx, text, maxW, size, font) {
    let s = size;
    ctx.font = `600 ${s}px ${font}`;
    while (ctx.measureText(text).width > maxW && s > 6) { s *= 0.92; ctx.font = `600 ${s}px ${font}`; }
    return s;
}

/** Word-wrap a title into at most `lines` lines that fit `maxW`; shrinks the font until it does. */
function wrapTitle(ctx, text, maxW, size, font, lines = 3) {
    for (let s = size; s > 6; s *= 0.9) {
        ctx.font = `600 ${s}px ${font}`;
        const words = text.split(' ');
        const out = [];
        let cur = '';
        for (const w of words) {
            const t = cur ? cur + ' ' + w : w;
            if (ctx.measureText(t).width <= maxW) cur = t;
            else { if (cur) out.push(cur); cur = w; }
        }
        if (cur) out.push(cur);
        if (out.length <= lines && out.every((l) => ctx.measureText(l).width <= maxW)) return { lines: out, size: s };
    }
    return { lines: [text], size: 6 };
}

/** The front cover. */
export function drawCover(ctx, book, w, h, mode = 'color') {
    const L = book.look;
    const r = makeRng(L.bump ^ 0x5bd1e995);
    const metal = mode === 'color' ? L.metalColor : mode === 'metal' ? '#fff' : '#fff';
    ctx.save();
    // base
    if (mode === 'color') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, hsl(L.hue, L.sat, L.lit + 6));
        g.addColorStop(1, hsl(L.hue, L.sat, L.lit - 6));
        ctx.fillStyle = g;
    } else ctx.fillStyle = mode === 'metal' ? '#000' : '#808080';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, r, w, h, L, mode);
    if (mode === 'color') {
        // a soft vignette and a sheen
        const v = ctx.createRadialGradient(w * 0.45, h * 0.4, w * 0.1, w * 0.5, h * 0.5, w * 0.9);
        v.addColorStop(0, 'rgba(255,255,255,0.08)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    }
    const u = w / 100;
    ctx.strokeStyle = metal;
    ctx.fillStyle = metal;
    ctx.lineCap = 'round';
    const pat = L.pattern;
    // borders: from a single rule to double rules with corner fleurons
    if (pat !== 'plain') {
        ctx.lineWidth = u * 1.1;
        ctx.strokeRect(u * 6, u * 6, w - u * 12, h - u * 12);
        if (pat !== 'border') { ctx.lineWidth = u * 0.5; ctx.strokeRect(u * 9, u * 9, w - u * 18, h - u * 18); }
    }
    if (pat === 'corners' || pat === 'filigree' || pat === 'vines') {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            ctx.save();
            ctx.translate(sx > 0 ? u * 9 : w - u * 9, sy > 0 ? u * 9 : h - u * 9);
            ctx.scale(sx, sy);
            ctx.beginPath();
            ctx.moveTo(0, u * 18); ctx.quadraticCurveTo(0, 0, u * 18, 0);
            ctx.moveTo(u * 4, u * 14); ctx.quadraticCurveTo(u * 6, u * 6, u * 14, u * 4);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(u * 5, u * 5, u * 2, 0, 7); ctx.fill();
            ctx.restore();
        }
    }
    if (pat === 'diamond') {
        ctx.lineWidth = u * 0.6;
        ctx.beginPath(); ctx.moveTo(w / 2, u * 12); ctx.lineTo(w - u * 12, h / 2); ctx.lineTo(w / 2, h - u * 12); ctx.lineTo(u * 12, h / 2); ctx.closePath(); ctx.stroke();
    }
    if (pat === 'vines' || pat === 'filigree') {
        ctx.lineWidth = u * 0.55;
        for (const side of [0, 1]) {
            ctx.beginPath();
            const x = side ? w - u * 14 : u * 14;
            ctx.moveTo(x, u * 24);
            for (let y = u * 24; y < h - u * 24; y += u * 8) ctx.quadraticCurveTo(x + (side ? -1 : 1) * u * 5 * (((y / (u * 8)) | 0) % 2 ? 1 : -1), y + u * 4, x, y + u * 8);
            ctx.stroke();
            for (let y = u * 30; y < h - u * 26; y += u * 16) { ctx.beginPath(); ctx.ellipse(x + (side ? -1 : 1) * u * 3, y, u * 2.4, u * 1.2, side ? -0.6 : 0.6, 0, 7); ctx.fill(); }
        }
    }
    if (pat === 'stars') {
        for (let i = 0; i < 26; i++) {
            const x = u * 14 + r() * (w - u * 28), y = u * 14 + r() * (h - u * 28);
            if (Math.abs(x - w / 2) < w * 0.3 && Math.abs(y - h * 0.62) < h * 0.2) continue;
            emblem(ctx, 'star', x, y, u * (1 + r() * 1.6), metal);
        }
    }
    if (pat === 'runes') {
        ctx.lineWidth = u * 0.6;
        ctx.save();
        ctx.font = `${u * 6}px serif`;
        ctx.textAlign = 'center';
        const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
        for (let i = 0; i < 16; i++) {
            const t = i / 16 * Math.PI * 2;
            ctx.fillText(runes[(i * 7 + (L.bump % 13)) % runes.length], w / 2 + Math.cos(t) * w * 0.33, h * 0.62 + Math.sin(t) * w * 0.33 + u * 2);
        }
        ctx.restore();
    }
    // the emblem in a ring, low on the cover
    const ex = w / 2, ey = h * 0.64, er = w * 0.16;
    if (pat !== 'plain') { ctx.lineWidth = u * 0.7; ctx.beginPath(); ctx.arc(ex, ey, er * 1.35, 0, 7); ctx.stroke(); }
    emblem(ctx, L.emblem, ex, ey, er, metal);
    // the title in a cartouche
    const { lines, size } = wrapTitle(ctx, book.title, w * 0.72, u * 9.5, TITLE_FONT, 3);
    const lh = size * 1.12;
    const top = h * 0.17;
    if (mode === 'color') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(w * 0.12, top - lh * 0.95, w * 0.76, lh * lines.length + lh * 0.5);
    }
    ctx.lineWidth = u * 0.5;
    ctx.strokeStyle = metal;
    ctx.strokeRect(w * 0.12, top - lh * 0.95, w * 0.76, lh * lines.length + lh * 0.5);
    ctx.fillStyle = metal;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${size}px ${TITLE_FONT}`;
    lines.forEach((ln, i) => {
        if (mode === 'color') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(ln, w / 2 + u * 0.3, top + i * lh + u * 0.4); ctx.fillStyle = metal; }
        ctx.fillText(ln, w / 2, top + i * lh);
    });
    // the author, small, near the foot
    const as = fitText(ctx, book.author, w * 0.7, u * 4.2, BODY_FONT);
    ctx.font = `italic ${as}px ${BODY_FONT}`;
    ctx.fillText(book.author, w / 2, h - u * 13);
    if (book.plus && mode !== 'bump') {
        for (let i = 0; i < book.plus; i++) emblem(ctx, 'star', w / 2 + (i - (book.plus - 1) / 2) * u * 6, h - u * 22, u * 2.2, metal);
    }
    if (mode === 'color') wear(ctx, r, w, h, L);
    ctx.restore();
}

/** The spine: raised bands, the title running up it, a little emblem. */
export function drawSpine(ctx, book, w, h, mode = 'color') {
    const L = book.look;
    const r = makeRng(L.bump ^ 0x27d4eb2d);
    const metal = mode === 'color' ? L.metalColor : '#fff';
    ctx.save();
    if (mode === 'color') {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, hsl(L.hue, L.sat, L.lit - 10));
        g.addColorStop(0.5, hsl(L.hue, L.sat, L.lit + 6));
        g.addColorStop(1, hsl(L.hue, L.sat, L.lit - 10));
        ctx.fillStyle = g;
    } else ctx.fillStyle = mode === 'metal' ? '#000' : '#808080';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, r, w, h, L, mode);
    const bands = L.bands;
    ctx.fillStyle = mode === 'color' ? hsl(L.hue, L.sat, L.lit - 16) : '#fff';
    const bh = h * 0.022;
    const ys = [];
    for (let i = 0; i < bands; i++) ys.push(h * (0.1 + 0.8 * (i + 0.5) / bands));
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1, w * 0.03);
    for (const y of ys) {
        if (mode !== 'metal') ctx.fillRect(0, y - bh / 2, w, bh);
        ctx.beginPath(); ctx.moveTo(0, y - bh / 2); ctx.lineTo(w, y - bh / 2); ctx.moveTo(0, y + bh / 2); ctx.lineTo(w, y + bh / 2); ctx.stroke();
    }
    // the title, rotated, between the second band and the foot
    ctx.save();
    ctx.translate(w / 2, h * 0.55);
    ctx.rotate(-Math.PI / 2);
    const s = fitText(ctx, book.title, h * 0.62, w * 0.46, TITLE_FONT);
    ctx.font = `600 ${s}px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'color') {
        ctx.fillStyle = hsl(L.hue, L.sat, L.lit - 14, 0.9);
        ctx.fillRect(-h * 0.33, -w * 0.32, h * 0.66, w * 0.64);
    }
    ctx.fillStyle = metal;
    ctx.fillText(book.title, 0, 0);
    ctx.restore();
    emblem(ctx, L.emblem, w / 2, h * 0.08, w * 0.22, metal);
    if (mode === 'color') wear(ctx, r, w, h, L);
    ctx.restore();
}

/** Page edges: fine lines, gilt, marbled or sprayed. */
export function drawEdge(ctx, book, w, h, mode = 'color') {
    const L = book.look;
    const r = makeRng(L.bump ^ 0x165667b1);
    ctx.save();
    if (mode === 'metal') { ctx.fillStyle = L.edge === 'gilt' ? '#fff' : '#000'; ctx.fillRect(0, 0, w, h); ctx.restore(); return; }
    ctx.fillStyle = L.edge === 'gilt' ? '#d6ad52' : '#efe2c4';
    ctx.fillRect(0, 0, w, h);
    if (L.edge === 'marbled' || L.edge === 'sprayed') {
        for (let i = 0; i < (L.edge === 'marbled' ? 60 : 400); i++) {
            ctx.fillStyle = L.edgeColor;
            ctx.globalAlpha = L.edge === 'marbled' ? 0.35 : 0.5;
            ctx.beginPath();
            if (L.edge === 'marbled') ctx.ellipse(r() * w, r() * h, r() * w * 0.12 + 2, r() * h * 0.04 + 1, r() * 3, 0, 7);
            else ctx.arc(r() * w, r() * h, r() * Math.max(w, h) * 0.006 + 0.5, 0, 7);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    // the leaves
    ctx.strokeStyle = L.edge === 'gilt' ? 'rgba(120,80,20,0.35)' : 'rgba(120,100,70,0.35)';
    ctx.lineWidth = 1;
    const vertical = h > w;
    const n = vertical ? w : h;
    for (let i = 0; i < n; i += 2 + r() * 2) {
        ctx.beginPath();
        if (vertical) { ctx.moveTo(i, 0); ctx.lineTo(i, h); } else { ctx.moveTo(0, i); ctx.lineTo(w, i); }
        ctx.stroke();
    }
    ctx.restore();
}

/** The title page, seen when the book is opened in the inspector. */
export function drawTitlePage(ctx, book, w, h, extra = {}) {
    const L = book.look;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#f6ecd4'); g.addColorStop(0.08, '#fbf4e3'); g.addColorStop(1, '#f2e5c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const u = w / 100;
    ctx.strokeStyle = L.metalColor; ctx.lineWidth = u * 0.4;
    ctx.strokeRect(u * 7, u * 7, w - u * 14, h - u * 14);
    ctx.fillStyle = '#3a2a1a';
    ctx.textAlign = 'center';
    const { lines, size } = wrapTitle(ctx, book.title, w * 0.76, u * 8, TITLE_FONT, 3);
    ctx.font = `600 ${size}px ${TITLE_FONT}`;
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h * 0.2 + i * size * 1.15));
    ctx.font = `italic ${u * 4.2}px ${BODY_FONT}`;
    ctx.fillText(`by ${book.author}`, w / 2, h * 0.2 + lines.length * size * 1.15 + u * 4);
    emblem(ctx, L.emblem, w / 2, h * 0.5, w * 0.1, L.metalColor);
    // an illuminated first line
    ctx.textAlign = 'left';
    const cap = (extra.opening || 'Once').charAt(0);
    ctx.fillStyle = hsl(L.hue, L.sat + 10, L.lit + 10);
    ctx.fillRect(u * 12, h * 0.62, u * 14, u * 14);
    ctx.fillStyle = L.metalColor;
    ctx.font = `700 ${u * 12}px ${TITLE_FONT}`;
    ctx.fillText(cap, u * 13.5, h * 0.62 + u * 12);
    ctx.fillStyle = '#4a3a2a';
    ctx.font = `${u * 3.6}px ${BODY_FONT}`;
    const text = (extra.opening || 'Once upon a time, in a town where every window held a lamp and every lamp a reader, there was a story waiting to be told.').slice(1);
    const words = text.split(' ');
    let x = u * 28, y = h * 0.62 + u * 4, lineW = w - u * 40;
    let cur = '';
    for (const wd of words) {
        const t = cur ? cur + ' ' + wd : wd;
        if (ctx.measureText(t).width > lineW) { ctx.fillText(cur, x, y); cur = wd; y += u * 5; if (y > h * 0.62 + u * 14) { x = u * 12; lineW = w - u * 24; } } else cur = t;
        if (y > h - u * 14) break;
    }
    if (cur && y <= h - u * 14) ctx.fillText(cur, x, y);
    ctx.font = `${u * 3}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a7a60';
    ctx.fillText(`Larkspur · ${book.year}`, w / 2, h - u * 10);
    ctx.restore();
}

// ------------------------------------------------------------------ thumbnails for the lists
const thumbs = new Map();
/** A small cover as an image URL, cached per book (and per rebinding). */
export function coverThumb(book, w = 72) {
    const key = `${book.id}:${book.seed}:${book.plus}:${w}`;
    if (thumbs.has(key)) return thumbs.get(key);
    const h = Math.round(w * book.look.h / book.look.w);
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    drawCover(ctx, book, c.width, c.height);
    const url = c.toDataURL('image/png');
    thumbs.set(key, url);
    if (thumbs.size > 400) thumbs.delete(thumbs.keys().next().value);
    return url;
}
