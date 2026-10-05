// Procedural alien portraits on a 2D canvas, from a species' body plan, palette and face genes.

import { RNG } from '../rng.js';

const cache = new Map();

export function portrait(sp, size = 256) {
    const key = `${sp.id}:${sp.face.seed}:${size}`;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), sp, size);
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
}

function shadeHex(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
    const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
    return `rgb(${r},${g},${b})`;
}

function draw(g, sp, S) {
    const r = new RNG(sp.face.seed);
    const P = sp.palette, F = sp.face;
    const cx = S / 2, cy = S * 0.55;
    // Background: a comm-screen gradient with scanlines.
    const bg = g.createRadialGradient(cx, cy * 0.8, S * 0.1, cx, cy, S * 0.8);
    bg.addColorStop(0, shadeHex(P.dark, 1.4));
    bg.addColorStop(1, '#05070d');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.12;
    for (let y = 0; y < S; y += 4) { g.fillStyle = '#000'; g.fillRect(0, y, S, 2); }
    g.globalAlpha = 1;

    const hw = S * 0.27 * F.headShape, hh = S * 0.33 / Math.sqrt(F.headShape);
    const skin = (y0, y1) => {
        const gr = g.createLinearGradient(cx - hw, y0, cx + hw, y1);
        gr.addColorStop(0, shadeHex(P.skin, 1.25));
        gr.addColorStop(0.6, P.skin);
        gr.addColorStop(1, shadeHex(P.skin, 0.55));
        return gr;
    };

    // Shoulders / body
    g.fillStyle = shadeHex(P.dark, 1.1);
    g.beginPath();
    g.ellipse(cx, S * 1.05, S * 0.42, S * 0.3, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = P.accent;
    g.globalAlpha = 0.5;
    g.fillRect(cx - S * 0.3, S * 0.9, S * 0.6, S * 0.02);
    g.globalAlpha = 1;

    // Crest behind the head
    drawCrest(g, F.crest, cx, cy, hw, hh, P, r, S, true);

    // Head by body plan
    g.save();
    g.fillStyle = skin(cy - hh, cy + hh);
    g.strokeStyle = shadeHex(P.skin, 0.4);
    g.lineWidth = S * 0.012;
    g.beginPath();
    switch (sp.body) {
        case 'insectoid':
            g.moveTo(cx, cy - hh * 1.05);
            g.bezierCurveTo(cx + hw * 1.3, cy - hh * 0.9, cx + hw * 0.9, cy + hh * 0.6, cx, cy + hh * 1.1);
            g.bezierCurveTo(cx - hw * 0.9, cy + hh * 0.6, cx - hw * 1.3, cy - hh * 0.9, cx, cy - hh * 1.05);
            break;
        case 'cephalopod':
            g.ellipse(cx, cy - hh * 0.25, hw * 1.15, hh * 1.0, 0, 0, Math.PI * 2);
            break;
        case 'reptilian':
            g.moveTo(cx - hw, cy - hh * 0.6);
            g.quadraticCurveTo(cx, cy - hh * 1.3, cx + hw, cy - hh * 0.6);
            g.lineTo(cx + hw * 0.8 * F.jaw, cy + hh * 0.7);
            g.quadraticCurveTo(cx, cy + hh * 1.15, cx - hw * 0.8 * F.jaw, cy + hh * 0.7);
            g.closePath();
            break;
        case 'avian':
            g.ellipse(cx, cy - hh * 0.1, hw * 0.95, hh * 0.95, 0, 0, Math.PI * 2);
            break;
        case 'crystalline': {
            const n = 7;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 - Math.PI / 2;
                const rr = (0.85 + r.next() * 0.3);
                const x = cx + Math.cos(a) * hw * rr, y = cy + Math.sin(a) * hh * rr;
                if (i) g.lineTo(x, y); else g.moveTo(x, y);
            }
            g.closePath();
            break;
        }
        case 'fungoid':
            g.ellipse(cx, cy - hh * 0.55, hw * 1.45, hh * 0.6, 0, Math.PI, 0);
            g.lineTo(cx + hw * 0.6, cy + hh * 0.9);
            g.quadraticCurveTo(cx, cy + hh * 1.1, cx - hw * 0.6, cy + hh * 0.9);
            g.closePath();
            break;
        case 'amphibian':
            g.ellipse(cx, cy + hh * 0.05, hw * 1.25, hh * 0.85, 0, 0, Math.PI * 2);
            break;
        default: // mammalian
            g.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    }
    g.fill();
    g.stroke();
    g.clip();
    // Markings
    g.globalAlpha = 0.35;
    g.fillStyle = shadeHex(P.dark, 0.9);
    if (F.marking === 'spots' || F.marking === 'freckles') {
        const n = F.marking === 'spots' ? 14 : 40;
        for (let i = 0; i < n; i++) { g.beginPath(); g.arc(cx + r.range(-hw, hw), cy + r.range(-hh, hh), S * (F.marking === 'spots' ? r.range(0.015, 0.035) : 0.006), 0, Math.PI * 2); g.fill(); }
    } else if (F.marking === 'stripes') {
        for (let i = -4; i <= 4; i++) { g.fillRect(cx + i * hw * 0.25 - S * 0.01, cy - hh * 1.2, S * 0.02, hh * 0.9); }
    } else if (F.marking === 'chevrons') {
        g.lineWidth = S * 0.025; g.strokeStyle = shadeHex(P.dark, 0.8);
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - hw, cy - hh * 0.9 + i * hh * 0.25); g.lineTo(cx, cy - hh * 0.6 + i * hh * 0.25); g.lineTo(cx + hw, cy - hh * 0.9 + i * hh * 0.25); g.stroke(); }
    } else if (F.marking === 'glow') {
        g.globalAlpha = 0.5; g.fillStyle = P.eye;
        for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(cx + r.range(-hw, hw), cy + r.range(-hh * 0.2, hh), S * 0.012, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    // Rim shading
    const rim = g.createRadialGradient(cx - hw * 0.3, cy - hh * 0.4, hw * 0.2, cx, cy, hw * 1.5);
    rim.addColorStop(0, 'rgba(255,255,255,0.12)');
    rim.addColorStop(0.6, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = rim;
    g.fillRect(0, 0, S, S);
    g.restore();

    // Eyes
    const eyeY = cy - hh * (sp.body === 'cephalopod' ? 0.25 : sp.body === 'fungoid' ? 0.1 : 0.15);
    const n = F.eyes;
    const er = S * 0.045 * F.eyeSize * (n >= 4 ? 0.7 : 1);
    const positions = [];
    if (n === 1) positions.push([cx, eyeY]);
    else if (n === 2) positions.push([cx - hw * 0.42, eyeY], [cx + hw * 0.42, eyeY]);
    else if (n === 3) positions.push([cx - hw * 0.45, eyeY], [cx + hw * 0.45, eyeY], [cx, eyeY - hh * 0.35]);
    else if (n === 4) positions.push([cx - hw * 0.45, eyeY], [cx + hw * 0.45, eyeY], [cx - hw * 0.25, eyeY - hh * 0.3], [cx + hw * 0.25, eyeY - hh * 0.3]);
    else for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI; positions.push([cx + Math.cos(a) * hw * 0.55, eyeY + Math.sin(a) * hh * 0.35 + hh * 0.15]); }
    for (const [x, y] of positions) {
        const insect = sp.body === 'insectoid';
        g.fillStyle = insect ? shadeHex(P.eye, 0.5) : '#f2f0e6';
        g.beginPath();
        g.ellipse(x, y, er * (insect ? 1.5 : 1.25), er * (insect ? 1.2 : 0.9), insect ? (x < cx ? 0.5 : -0.5) : 0, 0, Math.PI * 2);
        g.fill();
        const ig = g.createRadialGradient(x, y, 0, x, y, er);
        ig.addColorStop(0, '#fff');
        ig.addColorStop(0.25, P.eye);
        ig.addColorStop(1, shadeHex(P.eye, 0.4));
        g.fillStyle = ig;
        g.beginPath(); g.arc(x, y, er * 0.8, 0, Math.PI * 2); g.fill();
        if (!insect) {
            g.fillStyle = '#05070d';
            g.beginPath();
            if (sp.body === 'reptilian' || sp.body === 'amphibian') g.ellipse(x, y, er * 0.15, er * 0.6, 0, 0, Math.PI * 2);
            else g.arc(x, y, er * 0.35, 0, Math.PI * 2);
            g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(x - er * 0.3, y - er * 0.3, er * 0.18, 0, Math.PI * 2); g.fill();
        // glow
        g.globalCompositeOperation = 'lighter';
        const gl = g.createRadialGradient(x, y, 0, x, y, er * 2.5);
        gl.addColorStop(0, P.eye.length === 7 ? P.eye + '55' : 'rgba(255,255,255,0.3)');
        gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl;
        g.beginPath(); g.arc(x, y, er * 2.5, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
    }

    // Mouth
    const my = cy + hh * 0.5;
    g.strokeStyle = shadeHex(P.skin, 0.3);
    g.fillStyle = shadeHex(P.dark, 0.5);
    g.lineWidth = S * 0.012;
    switch (F.mouth) {
        case 'beak':
            g.fillStyle = P.accent;
            g.beginPath(); g.moveTo(cx - hw * 0.25, my - hh * 0.15); g.lineTo(cx + hw * 0.25, my - hh * 0.15); g.lineTo(cx, my + hh * 0.35 * F.jaw); g.closePath(); g.fill(); g.stroke();
            break;
        case 'mandibles':
            g.fillStyle = shadeHex(P.dark, 0.8);
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * hw * 0.15, my - hh * 0.1); g.quadraticCurveTo(cx + s * hw * 0.6, my + hh * 0.2, cx + s * hw * 0.1, my + hh * 0.45); g.lineTo(cx + s * hw * 0.2, my + hh * 0.1); g.closePath(); g.fill(); }
            break;
        case 'tentacles':
            g.strokeStyle = shadeHex(P.skin, 0.75);
            g.lineWidth = S * 0.03;
            g.lineCap = 'round';
            for (let i = 0; i < 5; i++) { const x = cx + (i - 2) * hw * 0.22; g.beginPath(); g.moveTo(x, my - hh * 0.1); g.bezierCurveTo(x + r.range(-20, 20), my + hh * 0.3, x + r.range(-25, 25), my + hh * 0.5, x + r.range(-15, 15), my + hh * 0.8); g.stroke(); }
            break;
        case 'grin':
            g.beginPath(); g.moveTo(cx - hw * 0.45, my); g.quadraticCurveTo(cx, my + hh * 0.3 * F.jaw, cx + hw * 0.45, my); g.quadraticCurveTo(cx, my + hh * 0.12, cx - hw * 0.45, my); g.fill();
            g.fillStyle = '#f2f0e6';
            for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * hw * 0.11 - S * 0.008, my + hh * 0.04); g.lineTo(cx + i * hw * 0.11 + S * 0.008, my + hh * 0.04); g.lineTo(cx + i * hw * 0.11, my + hh * 0.1); g.fill(); }
            break;
        case 'tube':
            g.fillStyle = shadeHex(P.skin, 0.8);
            g.beginPath(); g.ellipse(cx, my + hh * 0.1, hw * 0.14, hh * 0.25, 0, 0, Math.PI * 2); g.fill(); g.stroke();
            g.fillStyle = '#05070d'; g.beginPath(); g.arc(cx, my + hh * 0.3, hw * 0.07, 0, Math.PI * 2); g.fill();
            break;
        case 'slit':
            g.beginPath(); g.moveTo(cx - hw * 0.35, my); g.lineTo(cx + hw * 0.35, my); g.stroke();
            break;
        default: break;
    }

    drawCrest(g, F.crest, cx, cy, hw, hh, P, r, S, false);

    // Vignette + frame
    const v = g.createRadialGradient(cx, cy, S * 0.3, cx, cy, S * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = v;
    g.fillRect(0, 0, S, S);
}

function drawCrest(g, crest, cx, cy, hw, hh, P, r, S, behind) {
    g.save();
    g.fillStyle = P.accent;
    g.strokeStyle = P.accent;
    g.lineCap = 'round';
    if (behind) {
        if (crest === 'frills') {
            g.globalAlpha = 0.85;
            for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - 0.12) * hw * 1.9, cy + Math.sin(a - 0.12) * hh * 1.5); g.lineTo(cx + Math.cos(a + 0.12) * hw * 1.9, cy + Math.sin(a + 0.12) * hh * 1.5); g.closePath(); g.fill(); }
        } else if (crest === 'fins') {
            g.beginPath(); g.moveTo(cx - hw * 0.2, cy - hh * 0.8); g.quadraticCurveTo(cx, cy - hh * 2, cx + hw * 0.2, cy - hh * 0.8); g.fill();
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * hw * 0.9, cy); g.quadraticCurveTo(cx + s * hw * 1.8, cy - hh * 0.4, cx + s * hw * 0.9, cy + hh * 0.4); g.fill(); }
        } else if (crest === 'crown') {
            for (let i = 0; i < 5; i++) { const x = cx + (i - 2) * hw * 0.35; g.beginPath(); g.moveTo(x - hw * 0.12, cy - hh * 0.8); g.lineTo(x, cy - hh * (1.3 + (i === 2 ? 0.3 : 0))); g.lineTo(x + hw * 0.12, cy - hh * 0.8); g.fill(); }
        }
    } else {
        g.lineWidth = S * 0.022;
        if (crest === 'horns') {
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * hw * 0.5, cy - hh * 0.75); g.quadraticCurveTo(cx + s * hw * 1.3, cy - hh * 1.2, cx + s * hw * 1.1, cy - hh * 1.6); g.lineTo(cx + s * hw * 0.75, cy - hh * 0.65); g.fill(); }
        } else if (crest === 'antennae') {
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * hw * 0.25, cy - hh * 0.85); g.quadraticCurveTo(cx + s * hw * 0.6, cy - hh * 1.6, cx + s * hw * 1.0, cy - hh * 1.5); g.stroke(); g.fillStyle = P.eye; g.beginPath(); g.arc(cx + s * hw * 1.0, cy - hh * 1.5, S * 0.02, 0, Math.PI * 2); g.fill(); g.fillStyle = P.accent; }
        } else if (crest === 'spikes') {
            for (let i = 0; i < 7; i++) { const a = Math.PI * 1.1 + (i / 6) * Math.PI * 0.8; const x0 = cx + Math.cos(a) * hw * 0.9, y0 = cy + Math.sin(a) * hh * 0.9; g.beginPath(); g.moveTo(x0 - 6, y0); g.lineTo(cx + Math.cos(a) * hw * 1.35, cy + Math.sin(a) * hh * 1.35); g.lineTo(x0 + 6, y0); g.fill(); }
        } else if (crest === 'tendrils') {
            g.globalAlpha = 0.8;
            for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1; const k = i % 3; g.beginPath(); g.moveTo(cx + s * hw * 0.7, cy - hh * 0.3 + k * hh * 0.3); g.bezierCurveTo(cx + s * hw * 1.3, cy + k * hh * 0.2, cx + s * hw * 1.1, cy + hh * 0.6, cx + s * hw * 1.4, cy + hh * (0.8 + k * 0.2)); g.stroke(); }
        }
    }
    g.restore();
}
