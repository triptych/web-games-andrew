// The tarot cards, painted in code onto any 2D canvas: neon line art on a dark card, one symbol
// per Major Arcanum. Used by the 3D view (as textures) and by the DOM (the HUD, the deck screen).
// No three.js here, so the DOM can import it without the renderer.

import { ARCANA } from '../sim/arcana.js';

export const CARD_W = 300, CARD_H = 500;
export const SERIF = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

/** HSL hue 0..1 → a neon CSS colour. */
export function neon(h, l = 62, s = 100) { return `hsl(${Math.round(((h % 1) + 1) % 1 * 360)}, ${s}%, ${l}%)`; }

/**
 * Paint arcanum i onto ctx at (0, 0) at size w × h.
 * lit: rekindled (full neon) or still dark (ash-grey lines, a faint ember).
 * glow: false skips shadowBlur (fast, for tiny thumbnails).
 */
export function paintCard(ctx, i, w, h, { lit = true, glow = true } = {}) {
    const a = ARCANA[i];
    const k = w / CARD_W;
    ctx.save();
    ctx.scale(k, h / CARD_H);
    const W = CARD_W, H = CARD_H;
    const main = lit ? neon(a.hue) : 'rgba(150, 140, 170, 0.55)';
    const second = lit ? neon(a.hue + 0.5, 70) : 'rgba(110, 100, 130, 0.45)';
    const gold = lit ? '#ffd27a' : 'rgba(150, 130, 110, 0.5)';

    // the card body
    rounded(ctx, 4, 4, W - 8, H - 8, 22);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (lit) { bg.addColorStop(0, '#120a24'); bg.addColorStop(0.5, '#0a0618'); bg.addColorStop(1, '#16082a'); }
    else { bg.addColorStop(0, '#0d0c12'); bg.addColorStop(1, '#09080d'); }
    ctx.fillStyle = bg;
    ctx.fill();
    if (lit) {
        const rg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W * 0.75);
        rg.addColorStop(0, hsla(a.hue, 0.28));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fill();
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (col, lw, blur = 14) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.shadowColor = col;
        ctx.shadowBlur = glow && lit ? blur : 0;
        ctx.stroke();
    };

    // double frame with corner studs
    rounded(ctx, 14, 14, W - 28, H - 28, 16); stroke(main, 3);
    rounded(ctx, 24, 24, W - 48, H - 48, 10); stroke(second, 1.2, 6);
    for (const [x, y] of [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]]) {
        ctx.beginPath(); diamond(ctx, x, y, 7); stroke(gold, 2, 8);
    }

    // numeral and name
    ctx.shadowBlur = glow && lit ? 10 : 0;
    ctx.fillStyle = gold;
    ctx.shadowColor = gold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${SERIF}`;
    ctx.fillText(a.numeral, W / 2, 58);
    ctx.beginPath(); ctx.moveTo(W / 2 - 60, 84); ctx.lineTo(W / 2 + 60, 84); stroke(gold, 1.2, 4);
    ctx.font = `700 ${a.name.length > 14 ? 22 : 26}px ${SERIF}`;
    ctx.fillStyle = main;
    ctx.shadowColor = main;
    fitText(ctx, a.name.toUpperCase(), W / 2, H - 56, W - 70);
    ctx.beginPath(); ctx.moveTo(W / 2 - 80, H - 84); ctx.lineTo(W / 2 + 80, H - 84); stroke(gold, 1.2, 4);

    // the symbol, in a box from y 100 to H - 100
    ctx.save();
    ctx.translate(W / 2, H / 2);
    SYMBOLS[i](ctx, { main, second, gold, stroke });
    ctx.restore();

    if (!lit) {
        // a dormant card: a faint ember at its heart
        ctx.shadowBlur = 0;
        const em = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 46);
        em.addColorStop(0, 'rgba(255, 140, 60, 0.18)');
        em.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = em;
        ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
}

/** The back of every card: a sigil wheel. */
export function paintBack(ctx, w, h) {
    ctx.save();
    ctx.scale(w / CARD_W, h / CARD_H);
    const W = CARD_W, H = CARD_H;
    rounded(ctx, 4, 4, W - 8, H - 8, 22);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1a0830'); bg.addColorStop(1, '#06121e');
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineCap = 'round';
    const s = (col, lw, blur = 12) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.stroke(); };
    rounded(ctx, 14, 14, W - 28, H - 28, 16); s('#ff4fd8', 3);
    rounded(ctx, 24, 24, W - 48, H - 48, 10); s('#38e8ff', 1.2, 6);
    ctx.translate(W / 2, H / 2);
    for (let r = 40; r <= 120; r += 40) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); s(r === 80 ? '#ffd27a' : '#9b6bff', 1.6); }
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); s('#38e8ff', 1, 6);
    }
    ctx.beginPath(); star(ctx, 0, 0, 30, 12, 8); s('#ffd27a', 2.4);
    ctx.beginPath(); ctx.moveTo(0, -200); ctx.lineTo(0, -140); ctx.moveTo(0, 140); ctx.lineTo(0, 200); s('#ff4fd8', 2);
    ctx.restore();
}

// ------------------------------------------------------------------ helpers

function hsla(h, a) { return `hsla(${Math.round(h * 360)}, 100%, 55%, ${a})`; }
function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function diamond(ctx, x, y, r) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
function star(ctx, x, y, R, r, n, rot = -Math.PI / 2) {
    for (let k = 0; k < n * 2; k++) {
        const a = rot + (k / (n * 2)) * Math.PI * 2;
        const rr = k % 2 ? r : R;
        k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
}
function fitText(ctx, text, x, y, max) {
    let size = parseFloat(ctx.font.match(/(\d+(?:\.\d+)?)px/)[1]);
    while (ctx.measureText(text).width > max && size > 10) {
        size -= 1;
        ctx.font = ctx.font.replace(/\d+(?:\.\d+)?px/, `${size}px`);
    }
    ctx.fillText(text, x, y);
}
const C = Math.PI * 2;
function circle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, C); }
function rays(ctx, r0, r1, n, rot = 0) {
    for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * C;
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    }
}
function crescent(ctx, x, y, r, dir = 1) {
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, dir < 0);
    ctx.arc(x + dir * r * 0.45, y, r * 0.86, Math.PI / 2, -Math.PI / 2, dir > 0);
    ctx.closePath();
}
function cup(ctx, x, y, s) {
    ctx.moveTo(x - s, y - s); ctx.quadraticCurveTo(x - s, y + s * 0.6, x, y + s * 0.6);
    ctx.quadraticCurveTo(x + s, y + s * 0.6, x + s, y - s); ctx.closePath();
    ctx.moveTo(x, y + s * 0.6); ctx.lineTo(x, y + s * 1.4); ctx.moveTo(x - s * 0.6, y + s * 1.4); ctx.lineTo(x + s * 0.6, y + s * 1.4);
}
function infinity(ctx, x, y, s) {
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.55, x + s * 1.1, y - s * 0.55, x + s * 1.1, y);
    ctx.bezierCurveTo(x + s * 1.1, y + s * 0.55, x + s * 0.5, y + s * 0.55, x, y);
    ctx.bezierCurveTo(x - s * 0.5, y - s * 0.55, x - s * 1.1, y - s * 0.55, x - s * 1.1, y);
    ctx.bezierCurveTo(x - s * 1.1, y + s * 0.55, x - s * 0.5, y + s * 0.55, x, y);
}
function figure(ctx, x, y, s) {
    // a simple standing figure: head, body, arms raised
    circle(ctx, x, y - s * 1.1, s * 0.32);
    ctx.moveTo(x, y - s * 0.75); ctx.lineTo(x, y + s * 0.5);
    ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x - s * 0.45, y + s * 1.3);
    ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.45, y + s * 1.3);
    ctx.moveTo(x - s * 0.7, y - s * 0.75); ctx.lineTo(x, y - s * 0.35); ctx.lineTo(x + s * 0.7, y - s * 0.75);
}
function key(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    circle(ctx, 0, -s, s * 0.35);
    ctx.moveTo(0, -s * 0.65); ctx.lineTo(0, s); ctx.lineTo(s * 0.35, s); ctx.moveTo(0, s * 0.7); ctx.lineTo(s * 0.3, s * 0.7);
    ctx.restore();
}

/** One painter per arcanum. Origin is the card's centre; keep within about ±120 × ±150. */
const SYMBOLS = [
    // 0 The Fool: a sun over a cliff edge, a wandering step, a rose
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 50, -90, 30); stroke(gold, 3);
        ctx.beginPath(); rays(ctx, 40, 58, 12); stroke(gold, 2);
        ctx.beginPath(); ctx.moveTo(-120, 120); ctx.lineTo(-40, 120); ctx.lineTo(-10, 60); ctx.lineTo(30, 70); ctx.lineTo(60, 150); stroke(second, 3);
        ctx.beginPath(); figure(ctx, -40, 0, 46); stroke(main, 3.5);
        ctx.beginPath(); ctx.moveTo(-72, -40); ctx.lineTo(-110, -90); circle(ctx, -114, -96, 10); stroke(main, 2.5);
    },
    // I The Magician: ∞ above a raised wand, the four suits below
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); infinity(ctx, 0, -110, 46); stroke(gold, 3.5);
        ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 70); stroke(main, 5);
        ctx.beginPath(); circle(ctx, 0, -66, 9); stroke(main, 3);
        ctx.beginPath(); cup(ctx, -80, 92, 16); stroke(second, 2.5);
        ctx.beginPath(); circle(ctx, -27, 110, 16); star(ctx, -27, 110, 11, 4, 5); stroke(gold, 2);
        ctx.beginPath(); ctx.moveTo(27, 130); ctx.lineTo(27, 80); ctx.moveTo(15, 118); ctx.lineTo(39, 118); stroke(second, 2.5);
        ctx.beginPath(); ctx.moveTo(80, 132); ctx.lineTo(80, 82); circle(ctx, 80, 80, 5); stroke(main, 2.5);
    },
    // II The High Priestess: two pillars and the crescent moon between
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.rect(-100, -120, 30, 250); ctx.rect(70, -120, 30, 250); stroke(second, 3);
        ctx.beginPath(); ctx.moveTo(-108, -120); ctx.lineTo(-62, -120); ctx.moveTo(62, -120); ctx.lineTo(108, -120); stroke(second, 4);
        ctx.beginPath(); crescent(ctx, 0, -20, 50, 1); stroke(main, 3.5);
        ctx.beginPath(); ctx.moveTo(-40, 90); ctx.quadraticCurveTo(0, 60, 40, 90); ctx.quadraticCurveTo(0, 120, -40, 90); stroke(gold, 2.5);
        ctx.beginPath(); ctx.moveTo(-60, 40); ctx.lineTo(60, 40); stroke(gold, 1.5);
    },
    // III The Empress: the Venus sign in a wreath of wheat
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, -40, 48); ctx.moveTo(0, 8); ctx.lineTo(0, 100); ctx.moveTo(-36, 58); ctx.lineTo(36, 58); stroke(main, 5);
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(s * 70, 130); ctx.quadraticCurveTo(s * 120, 0, s * 70, -130); stroke(second, 2.5);
            ctx.beginPath();
            for (let k = 0; k < 7; k++) { const y = 110 - k * 36, x = s * (80 + Math.sin(k) * 12 + 14); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 18, y - 10, x + s * 6, y - 26); }
            stroke(gold, 2);
        }
        ctx.beginPath(); star(ctx, 0, -40, 14, 6, 6); stroke(gold, 2);
    },
    // IV The Emperor: a throne-square crowned with ram's horns
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.rect(-60, -10, 120, 120); stroke(main, 4);
        ctx.beginPath(); ctx.moveTo(-60, 50); ctx.lineTo(60, 50); ctx.moveTo(0, -10); ctx.lineTo(0, 110); stroke(second, 2);
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(s * 12, -30);
            ctx.bezierCurveTo(s * 40, -120, s * 120, -90, s * 100, -40);
            ctx.bezierCurveTo(s * 90, -10, s * 60, -30, s * 70, -55);
            stroke(gold, 3.5);
        }
        ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(-20, -60); ctx.lineTo(0, -40); ctx.lineTo(20, -60); ctx.lineTo(30, -30); ctx.closePath(); stroke(gold, 2.5);
    },
    // V The Hierophant: the triple cross over two crossed keys
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(0, 40);
        for (const [y, w] of [[-115, 24], [-85, 38], [-55, 52]]) { ctx.moveTo(-w, y); ctx.lineTo(w, y); }
        stroke(gold, 4.5);
        ctx.beginPath(); key(ctx, -30, 90, 44, -0.7); key(ctx, 30, 90, 44, 0.7); stroke(main, 3);
        ctx.beginPath(); circle(ctx, 0, 40, 10); stroke(second, 2.5);
    },
    // VI The Lovers: two hearts entwined under a radiant sun
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, -100, 24); rays(ctx, 32, 46, 16); stroke(gold, 2.5);
        const heart = (x, y, s) => {
            ctx.moveTo(x, y + s * 0.9);
            ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.8, y - s * 1.1, x, y - s * 0.4);
            ctx.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
        };
        ctx.beginPath(); heart(-30, 30, 56); stroke(main, 3.5);
        ctx.beginPath(); heart(30, 50, 56); stroke(second, 3.5);
    },
    // VII The Chariot: a canopied car on two wheels under stars
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.rect(-70, -30, 140, 80); stroke(main, 4);
        ctx.beginPath(); ctx.moveTo(-90, -40); ctx.quadraticCurveTo(0, -120, 90, -40); stroke(second, 3);
        ctx.beginPath(); ctx.moveTo(-70, -30); ctx.lineTo(-80, -45); ctx.moveTo(70, -30); ctx.lineTo(80, -45); stroke(second, 2);
        for (const x of [-60, 60]) {
            ctx.beginPath(); circle(ctx, x, 80, 30);
            ctx.save(); ctx.translate(x, 80); rays(ctx, 0, 30, 6); ctx.restore();
            stroke(gold, 2.5);
        }
        ctx.beginPath(); star(ctx, -40, -80, 8, 3, 5); star(ctx, 0, -92, 10, 4, 5); star(ctx, 40, -80, 8, 3, 5); stroke(gold, 2);
    },
    // VIII Strength: the lion's mane beneath an infinity sign
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); infinity(ctx, 0, -115, 40); stroke(gold, 3);
        ctx.beginPath(); circle(ctx, 0, 20, 52); stroke(main, 4);
        ctx.beginPath();
        for (let k = 0; k < 18; k++) { const a = (k / 18) * C; ctx.moveTo(Math.cos(a) * 62, 20 + Math.sin(a) * 62); ctx.quadraticCurveTo(Math.cos(a + 0.2) * 90, 20 + Math.sin(a + 0.2) * 90, Math.cos(a + 0.35) * 100, 20 + Math.sin(a + 0.35) * 100); }
        stroke(second, 2);
        ctx.beginPath(); circle(ctx, -18, 8, 5); circle(ctx, 18, 8, 5); ctx.moveTo(-12, 42); ctx.quadraticCurveTo(0, 50, 12, 42); stroke(main, 2.5);
    },
    // IX The Hermit: a lantern holding a six-pointed star, on a staff
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(-70, -140); ctx.lineTo(-70, 150); stroke(second, 4);
        ctx.beginPath(); ctx.moveTo(-70, -100); ctx.lineTo(10, -100); ctx.lineTo(10, -70); stroke(second, 2.5);
        ctx.beginPath(); ctx.moveTo(-20, -70); ctx.lineTo(40, -70); ctx.lineTo(55, -10); ctx.lineTo(40, 60); ctx.lineTo(-20, 60); ctx.lineTo(-35, -10); ctx.closePath(); stroke(main, 3.5);
        ctx.beginPath(); star(ctx, 10, -5, 30, 15, 6); stroke(gold, 2.5, 22);
        ctx.beginPath(); ctx.moveTo(-10, 80); ctx.lineTo(30, 80); stroke(main, 2);
    },
    // X Wheel of Fortune: an eight-spoked wheel with marks at the cardinal points
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, 0, 105); stroke(main, 4);
        ctx.beginPath(); circle(ctx, 0, 0, 70); circle(ctx, 0, 0, 16); stroke(second, 2.5);
        ctx.beginPath(); rays(ctx, 16, 105, 8, Math.PI / 8); stroke(gold, 2);
        ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = (k / 4) * C - Math.PI / 2; diamond(ctx, Math.cos(a) * 88, Math.sin(a) * 88, 8); } stroke(gold, 2.5);
        ctx.beginPath(); ctx.moveTo(0, 105); ctx.lineTo(0, 150); ctx.moveTo(-40, 150); ctx.lineTo(40, 150); stroke(second, 3);
    },
    // XI Justice: scales over an upright sword
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(0, 130); ctx.moveTo(-26, 90); ctx.lineTo(26, 90); stroke(second, 4);
        ctx.beginPath(); ctx.moveTo(-90, -70); ctx.lineTo(90, -70); stroke(gold, 3.5);
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(s * 90, -70); ctx.lineTo(s * 60, 0); ctx.moveTo(s * 90, -70); ctx.lineTo(s * 120, 0);
            ctx.moveTo(s * 55, 0); ctx.quadraticCurveTo(s * 90, 40, s * 125, 0); ctx.closePath(); stroke(main, 2.8);
        }
        ctx.beginPath(); diamond(ctx, 0, -140, 10); stroke(gold, 2.5);
    },
    // XII The Hanged Man: a figure hanging from a beam by one foot, a halo below
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(-90, -130); ctx.lineTo(90, -130); ctx.moveTo(-80, -130); ctx.lineTo(-80, -100); ctx.moveTo(80, -130); ctx.lineTo(80, -100); stroke(second, 4);
        ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(0, -90);
        ctx.moveTo(0, -90); ctx.lineTo(0, 10); ctx.moveTo(0, -90); ctx.lineTo(30, -50); ctx.lineTo(0, -30);
        ctx.moveTo(0, 0); ctx.lineTo(-40, -30); ctx.moveTo(0, 0); ctx.lineTo(40, -30);
        stroke(main, 3.5);
        ctx.beginPath(); circle(ctx, 0, 34, 20); stroke(main, 3);
        ctx.beginPath(); circle(ctx, 0, 34, 40); rays(ctx, 46, 60, 12); stroke(gold, 2);
    },
    // XIII Death: a scythe before a rising sun
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.arc(0, 110, 70, Math.PI, 0); stroke(gold, 3);
        ctx.beginPath(); for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; ctx.moveTo(Math.cos(a) * 80, 110 + Math.sin(a) * 80); ctx.lineTo(Math.cos(a) * 100, 110 + Math.sin(a) * 100); } stroke(gold, 2);
        ctx.beginPath(); ctx.moveTo(-120, 110); ctx.lineTo(120, 110); stroke(second, 2.5);
        ctx.beginPath(); ctx.moveTo(-60, 140); ctx.lineTo(50, -140); stroke(main, 4);
        ctx.beginPath(); ctx.moveTo(50, -140); ctx.quadraticCurveTo(-60, -150, -110, -70); ctx.quadraticCurveTo(-50, -110, 40, -112); stroke(main, 3.5);
    },
    // XIV Temperance: water poured from cup to cup, a triangle within a square
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.rect(-36, -140, 72, 72); stroke(gold, 2.5);
        ctx.beginPath(); ctx.moveTo(0, -132); ctx.lineTo(30, -76); ctx.lineTo(-30, -76); ctx.closePath(); stroke(gold, 2);
        ctx.save(); ctx.translate(-60, -10); ctx.rotate(0.5); ctx.beginPath(); cup(ctx, 0, 0, 26); stroke(main, 3); ctx.restore();
        ctx.beginPath(); cup(ctx, 60, 80, 26); stroke(main, 3);
        ctx.beginPath(); ctx.moveTo(-40, 0); ctx.bezierCurveTo(10, 10, 50, 20, 55, 58); ctx.moveTo(-36, 10); ctx.bezierCurveTo(0, 30, 40, 30, 66, 58); stroke(second, 2.5);
    },
    // XV The Devil: an inverted pentagram in a circle, chains below
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, -20, 90); stroke(main, 3.5);
        ctx.beginPath();
        for (let k = 0; k <= 5; k++) { const a = Math.PI / 2 + (k * 2 / 5) * C; const x = Math.cos(a) * 88, y = -20 + Math.sin(a) * 88; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        stroke(gold, 3);
        for (const s of [-1, 1]) { ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(s * 50 + 10, 90 + k * 22); ctx.ellipse(s * 50, 90 + k * 22, 10, 7, k % 2 ? 0 : Math.PI / 2, 0, C); } stroke(second, 2.5); }
    },
    // XVI The Tower: a tower struck by lightning, its crown flying off
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(-50, 140); ctx.lineTo(-38, -60); ctx.lineTo(38, -60); ctx.lineTo(50, 140); ctx.closePath(); stroke(second, 3.5);
        ctx.beginPath(); ctx.rect(-12, -20, 24, 34); ctx.rect(-12, 50, 24, 34); stroke(second, 2);
        ctx.beginPath(); ctx.moveTo(-30, -80); ctx.lineTo(-20, -110); ctx.lineTo(0, -92); ctx.lineTo(24, -120); ctx.lineTo(40, -88); stroke(gold, 3);
        ctx.beginPath(); ctx.moveTo(110, -150); ctx.lineTo(40, -70); ctx.lineTo(70, -66); ctx.lineTo(10, 0); stroke(main, 4.5, 26);
    },
    // XVII The Star: a great eight-pointed star, seven small ones, pouring water
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); star(ctx, 0, -60, 64, 18, 8); stroke(gold, 3.5, 24);
        ctx.beginPath();
        for (let k = 0; k < 7; k++) { const a = Math.PI + 0.25 + (k / 6) * (Math.PI - 0.5); star(ctx, Math.cos(a) * 110, -60 + Math.sin(a) * 110 * -0.6 - 10, 10, 4, 8); }
        stroke(main, 2);
        ctx.beginPath(); for (let k = 0; k < 3; k++) { const y = 70 + k * 24; ctx.moveTo(-100, y); ctx.bezierCurveTo(-50, y - 14, -30, y + 14, 0, y); ctx.bezierCurveTo(30, y - 14, 50, y + 14, 100, y); } stroke(second, 2.5);
    },
    // XVIII The Moon: a face in the crescent over two towers and the tide
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, -70, 58); stroke(gold, 2);
        ctx.beginPath(); crescent(ctx, 0, -70, 54, -1); stroke(main, 3.5);
        ctx.save(); ctx.translate(0, -70); ctx.beginPath(); rays(ctx, 66, 80, 24); ctx.restore(); stroke(gold, 1.5);
        ctx.beginPath(); ctx.rect(-110, 20, 34, 90); ctx.rect(76, 20, 34, 90); stroke(second, 3);
        ctx.beginPath(); for (let k = 0; k < 2; k++) { const y = 120 + k * 22; ctx.moveTo(-110, y); ctx.bezierCurveTo(-55, y - 16, -40, y + 16, 0, y); ctx.bezierCurveTo(40, y - 16, 55, y + 16, 110, y); } stroke(main, 2.5);
    },
    // XIX The Sun: a radiant sun with a face
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); circle(ctx, 0, -10, 62); stroke(gold, 4.5, 26);
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * C, r0 = 76, r1 = k % 2 ? 108 : 128;
            ctx.moveTo(Math.cos(a - 0.08) * r0, -10 + Math.sin(a - 0.08) * r0);
            ctx.lineTo(Math.cos(a) * r1, -10 + Math.sin(a) * r1);
            ctx.lineTo(Math.cos(a + 0.08) * r0, -10 + Math.sin(a + 0.08) * r0);
        }
        stroke(main, 2.5);
        ctx.beginPath(); circle(ctx, -22, -24, 6); circle(ctx, 22, -24, 6); ctx.moveTo(-26, 12); ctx.quadraticCurveTo(0, 32, 26, 12); stroke(second, 3);
    },
    // XX Judgement: a trumpet with a banner, sleepers rising
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.moveTo(-100, -120); ctx.lineTo(40, -40); ctx.lineTo(60, -80); ctx.lineTo(70, -10); ctx.lineTo(20, -30); ctx.closePath(); stroke(gold, 3.5);
        ctx.beginPath(); ctx.rect(-50, -100, 40, 30); ctx.moveTo(-30, -100); ctx.lineTo(-30, -70); ctx.moveTo(-50, -85); ctx.lineTo(-10, -85); stroke(main, 2);
        ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(70 + k * 4, -10); ctx.lineTo(90 + k * 18, 40); } stroke(gold, 1.5);
        ctx.beginPath(); figure(ctx, -60, 90, 32); figure(ctx, 0, 80, 36); figure(ctx, 60, 90, 32); stroke(second, 3);
        ctx.beginPath(); ctx.moveTo(-110, 140); ctx.lineTo(110, 140); stroke(main, 2.5);
    },
    // XXI The World: a wreath around a dancer, four stars at the corners
    (ctx, { main, second, gold, stroke }) => {
        ctx.beginPath(); ctx.ellipse(0, 0, 70, 115, 0, 0, C); stroke(main, 4);
        ctx.beginPath();
        for (let k = 0; k < 24; k++) { const a = (k / 24) * C; const x = Math.cos(a) * 70, y = Math.sin(a) * 115; ctx.moveTo(x, y); ctx.lineTo(x * 1.16, y * 1.08 - 6); } stroke(second, 2);
        ctx.beginPath(); figure(ctx, 0, 0, 40); stroke(gold, 3);
        ctx.beginPath(); for (const [x, y] of [[-100, -130], [100, -130], [-100, 130], [100, 130]]) star(ctx, x, y, 14, 5, 4); stroke(gold, 2.5);
    },
];
