// Painted faces: a transparent canvas texture (eyes with highlights, brows, mouth, blush) wrapped on
// a cap in front of the head. One texture per look × expression, cached.
// Expressions: normal, happy, surprised, angry, sad, smug, blink, hurt, focus.

import * as THREE from 'three';

const cache = new Map();
const S = 256;

function eye(g, cx, cy, f, expr, flip) {
    const ink = f.ink ?? '#2a1622';
    g.save();
    g.translate(cx, cy);
    if (flip) g.scale(-1, 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const W = f.eyeW ?? 27, H = f.eyeH ?? 34;
    if (expr === 'happy' || expr === 'blink') {
        g.strokeStyle = ink; g.lineWidth = 8;
        g.beginPath();
        if (expr === 'blink') { g.moveTo(-W, 4); g.quadraticCurveTo(0, 12, W, 4); }
        else { g.moveTo(-W, 8); g.quadraticCurveTo(0, -16, W, 8); }
        g.stroke(); g.restore(); return;
    }
    if (expr === 'hurt') {
        g.strokeStyle = ink; g.lineWidth = 8;
        g.beginPath(); g.moveTo(-W * 0.8, -14); g.lineTo(W * 0.6, 0); g.lineTo(-W * 0.8, 14); g.stroke();
        g.restore(); return;
    }
    let h = H, w = W;
    if (expr === 'surprised') { h *= 1.12; w *= 0.95; }
    if (expr === 'angry' || expr === 'focus') h *= 0.82;
    // white
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill();
    // iris
    const ir = expr === 'surprised' ? w * 0.55 : w * 0.78;
    const gr = g.createLinearGradient(0, -h, 0, h);
    gr.addColorStop(0, shade(f.eyes, -0.45)); gr.addColorStop(0.55, f.eyes); gr.addColorStop(1, shade(f.eyes, 0.4));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(2, 3, ir, h * 0.86, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
    g.beginPath(); g.ellipse(2, 4, ir * 0.45, h * 0.45, 0, 0, Math.PI * 2); g.fill();
    // highlights
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(-w * 0.28, -h * 0.38, w * 0.3, h * 0.24, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w * 0.32, h * 0.38, w * 0.13, 0, Math.PI * 2); g.fill();
    // lid line
    g.strokeStyle = ink; g.lineWidth = 7;
    g.beginPath();
    if (expr === 'angry') { g.moveTo(-w - 2, -h * 0.55); g.lineTo(w + 2, -h * 0.95); }
    else if (expr === 'sad') { g.moveTo(-w - 2, -h * 0.95); g.lineTo(w + 2, -h * 0.6); }
    else if (expr === 'smug') { g.moveTo(-w - 2, -h * 0.2); g.quadraticCurveTo(0, -h * 0.45, w + 2, -h * 0.2); }
    else g.ellipse(0, 0, w + 1, h + 1, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    if (expr === 'smug') { g.fillStyle = f.skin; g.fillRect(-w - 6, -h - 8, w * 2 + 12, h * 0.75); }
    if (expr === 'angry') { g.fillStyle = f.skin; g.beginPath(); g.moveTo(-w - 6, -h - 8); g.lineTo(w + 6, -h - 8); g.lineTo(w + 6, -h * 0.98); g.lineTo(-w - 6, -h * 0.58); g.fill(); }
    // lashes
    g.strokeStyle = ink; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w * 0.8, -h * 0.6); g.lineTo(w + 9, -h * 0.82); g.stroke();
    g.restore();
}

function shade(hex, k) {
    const c = new THREE.Color(hex);
    if (k > 0) c.lerp(new THREE.Color('#ffffff'), k); else c.multiplyScalar(1 + k);
    return '#' + c.getHexString();
}

/**
 * f: { skin, eyes, ink, blush, mouth: 'cat'|'small'|'teeth'|'beak', brows: bool, browColor,
 *      beard: colour (draws a moustache), eyeW, eyeH, eyeY, eyeGap }
 */
export function faceTexture(f, expr = 'normal') {
    const key = JSON.stringify(f) + expr;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const ink = f.ink ?? '#2a1622';
    const ey = f.eyeY ?? 132, gap = f.eyeGap ?? 52;
    // blush
    if (f.blush !== false) {
        for (const s of [-1, 1]) {
            const gr = g.createRadialGradient(128 + s * 70, 172, 2, 128 + s * 70, 172, 24);
            gr.addColorStop(0, f.blush ?? 'rgba(255,120,140,0.55)'); gr.addColorStop(1, 'rgba(255,120,140,0)');
            g.fillStyle = gr; g.fillRect(128 + s * 70 - 30, 142, 60, 60);
        }
    }
    eye(g, 128 - gap, ey, f, expr, false);
    eye(g, 128 + gap, ey, f, expr, true);
    // brows
    if (f.brows !== false) {
        g.strokeStyle = f.browColor ?? ink; g.lineWidth = f.bushy ? 12 : 6; g.lineCap = 'round';
        for (const s of [-1, 1]) {
            const bx = 128 + s * gap, by = ey - (f.eyeH ?? 34) - 14;
            g.beginPath();
            if (expr === 'angry' || expr === 'focus') { g.moveTo(bx - s * 22, by - 6); g.lineTo(bx + s * 18, by + 8); }
            else if (expr === 'sad' || expr === 'hurt') { g.moveTo(bx - s * 20, by + 6); g.lineTo(bx + s * 18, by - 6); }
            else if (expr === 'surprised') { g.moveTo(bx - 18, by - 8); g.quadraticCurveTo(bx, by - 18, bx + 18, by - 8); }
            else { g.moveTo(bx - 18, by); g.quadraticCurveTo(bx, by - 8, bx + 18, by); }
            g.stroke();
        }
    }
    // mouth
    g.lineCap = 'round'; g.lineJoin = 'round';
    const my = f.mouthY ?? 192;
    g.strokeStyle = ink; g.lineWidth = 6;
    const m = f.mouth ?? 'small';
    if (m === 'beak') {
        g.fillStyle = '#f0a020';
        g.beginPath(); g.moveTo(108, my - 14); g.lineTo(148, my - 14); g.lineTo(128, my + (expr === 'surprised' ? 18 : 8)); g.closePath(); g.fill();
        g.stroke();
    } else if (expr === 'surprised' || expr === 'hurt') {
        g.fillStyle = '#7a2032';
        g.beginPath(); g.ellipse(128, my + 4, 11, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (expr === 'happy' || (expr === 'smug' && m !== 'teeth')) {
        g.fillStyle = '#7a2032';
        g.beginPath(); g.moveTo(104, my - 6); g.quadraticCurveTo(128, my + 30, 152, my - 6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ff8a9a';
        g.beginPath(); g.ellipse(128, my + 8, 12, 6, 0, 0, Math.PI * 2); g.fill();
    } else if (expr === 'angry') {
        if (m === 'teeth') {
            g.fillStyle = '#ffffff'; g.fillRect(104, my - 8, 48, 16); g.strokeRect(104, my - 8, 48, 16);
            g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(104 + i * 12, my - 8); g.lineTo(104 + i * 12, my + 8); } g.stroke();
        } else { g.beginPath(); g.moveTo(108, my + 6); g.quadraticCurveTo(128, my - 8, 148, my + 6); g.stroke(); }
    } else if (expr === 'sad') {
        g.beginPath(); g.moveTo(112, my + 6); g.quadraticCurveTo(128, my - 6, 144, my + 6); g.stroke();
    } else if (m === 'cat') {
        g.beginPath(); g.moveTo(108, my - 4); g.quadraticCurveTo(118, my + 8, 128, my - 2); g.quadraticCurveTo(138, my + 8, 148, my - 4); g.stroke();
    } else if (m === 'teeth') {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(106, my - 6); g.quadraticCurveTo(128, my + 18, 150, my - 6); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(122, my - 4); g.lineTo(122, my + 6); g.moveTo(134, my - 4); g.lineTo(134, my + 6); g.stroke();
    } else {
        g.beginPath(); g.moveTo(114, my); g.quadraticCurveTo(128, my + 10, 142, my); g.stroke();
    }
    if (f.beard) {
        g.fillStyle = f.beard;
        g.strokeStyle = shade(f.beard, -0.3); g.lineWidth = 3;
        g.beginPath();
        g.moveTo(128, my - 22);
        g.bezierCurveTo(100, my - 34, 66, my - 18, 54, my + 2);
        g.bezierCurveTo(78, my - 4, 104, my - 4, 128, my - 10);
        g.bezierCurveTo(152, my - 4, 178, my - 4, 202, my + 2);
        g.bezierCurveTo(190, my - 18, 156, my - 34, 128, my - 22);
        g.fill(); g.stroke();
    }
    if (expr === 'sad') { g.fillStyle = 'rgba(120,190,255,0.85)'; g.beginPath(); g.ellipse(128 + gap + 8, ey + 34, 6, 10, 0, 0, Math.PI * 2); g.fill(); }
    if (expr === 'angry' && f.vein !== false) {
        g.strokeStyle = '#e03040'; g.lineWidth = 5;
        const vx = 128 + gap + 30, vy = ey - 58;
        g.beginPath(); g.moveTo(vx - 8, vy); g.lineTo(vx + 8, vy); g.moveTo(vx, vy - 8); g.lineTo(vx, vy + 8); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
    return t;
}

/** The cap the face is painted on: a slice of sphere in front of the head. */
export function faceCap(R, sx = 1, sy = 1) {
    // phi ≈ π/2 is +z (the front); u runs from the character's right (−x) to left, v from top down
    const g = new THREE.SphereGeometry(R * 1.012, 32, 20, Math.PI / 2 - Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.2, Math.PI * 0.52);
    g.scale(sx, sy, 1);
    return g;
}
