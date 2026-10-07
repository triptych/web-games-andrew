/**
 * portraits.js — character portraits painted in a canvas: head, hair, hats, glasses, beards and
 * clothes from a short description per character, and the eyes, brows and mouth from the mood
 * (neutral, happy, grin, smug, angry, sad, shock). The player is drawn in a helmet in their car's
 * paint colour.
 */

const LOOK = {
    gus:    { skin: '#e8b48c', hair: '#e8e4dc', style: 'bald', bg: ['#6a3a1a', '#d9a62e'], shirt: '#8a2a22', collar: 'overalls', cap: { col: '#c0392b', text: 'H' }, glasses: true, mous: 'walrus', wrinkles: true, brows: '#e8e4dc' },
    june:   { skin: '#a86a44', hair: '#2a1a12', style: 'curly', bg: ['#14504a', '#3bbd9b'], shirt: '#3a5a8a', collar: 'overalls', bandana: '#2f6be0', smudge: true },
    colt:   { skin: '#f2c8a4', hair: '#f2d27a', style: 'swept', bg: ['#15161a', '#e0b23c'], shirt: '#15161a', collar: 'racing', trim: '#e0b23c' },
    victor: { skin: '#e8bc98', hair: '#9aa0a8', style: 'slick', bg: ['#1d1e24', '#6a6e78'], shirt: '#16171c', collar: 'suit', tie: '#e0b23c', mous: 'thin', sharp: true },
    rex:    { skin: '#d8a07a', hair: '#3a2416', style: 'pomp', bg: ['#7a2a10', '#ff7a3a'], shirt: '#e8a020', collar: 'suit', tie: '#d8322a', headset: true },
    earl:   { skin: '#e0a07a', hair: '#8a5a32', style: 'short', bg: ['#6a2a1a', '#d8503a'], shirt: '#2f6be0', collar: 'overalls', hat: 'cowboy', hatCol: '#e8cc7a', beard: '#8a5a32', big: true },
    fern:   { skin: '#f4d0b4', hair: '#c8502a', style: 'braid', bg: ['#1f4a2a', '#5fbf6a'], shirt: '#4a6a3a', collar: 'ranger', hat: 'ranger', hatCol: '#8a6a3a', freckles: true },
    sal:    { skin: '#b8784e', hair: '#1a1a1a', style: 'short', bg: ['#7a3a10', '#ff9a3a'], shirt: '#e2852b', collar: 'racing', trim: '#2a2a2a', bandana: '#d8322a', shades: true, goatee: '#1a1a1a', scar: true },
    gator:  { skin: '#c8906a', hair: '#9a9a90', style: 'short', bg: ['#2a3a1a', '#9acb4a'], shirt: '#5a6a3a', collar: 'vest', hat: 'boonie', hatCol: '#6a6a4a', stubble: true, goldTooth: true },
    ivanka: { skin: '#f6e2d8', hair: '#f2f4f8', style: 'bob', bg: ['#14305a', '#8ad0ff'], shirt: '#e8f0f8', collar: 'fur', trim: '#2d6fd6', eye: '#4ab0ff', lips: '#b84a6a' },
    max:    { skin: '#d8a888', hair: '#a04aff', style: 'pomp', bg: ['#3a0a5a', '#d07aff'], shirt: '#8e2bd9', collar: 'racing', trim: '#39f0ff', shadesUp: true, sparkle: true },
};

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Paint a portrait into a canvas (size × size). `who` is a CAST id; `paint` tints the player's helmet. */
export function drawPortrait(cv, who, mood = 'neutral', paint = '#f5c518') {
    const g = cv.getContext('2d');
    const S = cv.width;
    g.save();
    g.scale(S / 256, S / 256);
    g.clearRect(0, 0, 256, 256);
    const L = who === 'you' ? { skin: '#e0b090', bg: ['#2a2a30', paint], shirt: paint, collar: 'racing', trim: '#f4f1e8', helmet: paint } : LOOK[who] || LOOK.rex;

    // Background: a radial burst in the character's colours.
    const bg = g.createRadialGradient(128, 110, 10, 128, 128, 180);
    bg.addColorStop(0, L.bg[1]); bg.addColorStop(1, L.bg[0]);
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.12;
    g.fillStyle = '#fff';
    for (let k = 0; k < 12; k++) { g.beginPath(); g.moveTo(128, 120); g.arc(128, 120, 260, (k / 12) * Math.PI * 2, (k / 12 + 1 / 24) * Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;

    const big = L.big ? 1.12 : 1;
    // Shoulders and clothes.
    g.fillStyle = L.shirt;
    g.beginPath(); g.ellipse(128, 262, 112 * big, 70, 0, Math.PI, 0); g.fill();
    if (L.collar === 'overalls') {
        g.fillStyle = shade(L.shirt, 0.8);
        g.fillRect(84, 214, 16, 50); g.fillRect(156, 214, 16, 50);
        g.fillStyle = '#d8d0b0'; g.beginPath(); g.arc(92, 228, 4, 0, 7); g.arc(164, 228, 4, 0, 7); g.fill();
    } else if (L.collar === 'racing') {
        g.fillStyle = L.trim || '#fff';
        g.fillRect(104, 200, 48, 10);
        g.fillRect(30, 238, 196, 6);
    } else if (L.collar === 'suit') {
        g.fillStyle = '#f2f2ee'; g.beginPath(); g.moveTo(110, 200); g.lineTo(128, 240); g.lineTo(146, 200); g.fill();
        g.fillStyle = L.tie; g.beginPath(); g.moveTo(122, 208); g.lineTo(134, 208); g.lineTo(138, 250); g.lineTo(128, 258); g.lineTo(118, 250); g.fill();
        g.fillStyle = shade(L.shirt, 1.6); g.beginPath(); g.moveTo(100, 200); g.lineTo(122, 252); g.lineTo(88, 230); g.fill(); g.beginPath(); g.moveTo(156, 200); g.lineTo(134, 252); g.lineTo(168, 230); g.fill();
    } else if (L.collar === 'fur') {
        g.fillStyle = '#f8f8fa';
        for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(60 + k * 10.5, 212 + Math.sin(k) * 4, 14, 0, 7); g.fill(); }
        g.fillStyle = L.trim; g.fillRect(118, 226, 20, 30);
    } else if (L.collar === 'ranger') {
        g.fillStyle = '#e8d8a0'; g.beginPath(); g.moveTo(104, 202); g.lineTo(128, 226); g.lineTo(152, 202); g.fill();
        g.fillStyle = '#d8b040'; g.beginPath(); g.arc(160, 238, 9, 0, 7); g.fill();
    } else if (L.collar === 'vest') {
        g.fillStyle = '#6a5a3a'; g.fillRect(60, 214, 40, 60); g.fillRect(156, 214, 40, 60);
    }

    // Neck and head.
    g.fillStyle = shade(L.skin, 0.88);
    g.fillRect(110, 168, 36, 40);
    const hw = 52 * big, hh = 64;
    if (L.helmet) {
        // The player: a full-face helmet, visor up.
        g.fillStyle = L.helmet;
        g.beginPath(); g.ellipse(128, 118, 66, 74, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = shade(L.helmet.startsWith('#') ? L.helmet : '#888888', 0.75);
        g.beginPath(); g.ellipse(128, 160, 58, 30, 0, 0, Math.PI); g.fill();
        g.fillStyle = '#f4f1e8'; g.fillRect(62, 104, 132, 8);
        // Face in the opening.
        g.fillStyle = L.skin;
        rr(g, 84, 98, 88, 70, 26); g.fill();
        g.fillStyle = '#1a2230'; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(128, 70, 56, 14, 0, Math.PI, 0); g.fill();
        g.globalAlpha = 1;
    } else {
        g.fillStyle = L.skin;
        g.beginPath(); g.ellipse(128, 118, hw, hh, 0, 0, Math.PI * 2); g.fill();
        // Ears.
        g.beginPath(); g.ellipse(128 - hw + 2, 124, 9, 14, 0, 0, 7); g.ellipse(128 + hw - 2, 124, 9, 14, 0, 0, 7); g.fill();
        if (L.sharp) { g.fillStyle = shade(L.skin, 0.9); g.beginPath(); g.moveTo(90, 150); g.lineTo(128, 186); g.lineTo(166, 150); g.lineTo(128, 176); g.fill(); }
    }

    // Hair (behind hats).
    if (!L.helmet) {
        g.fillStyle = L.hair;
        const st = L.style;
        if (st === 'bald') {
            g.beginPath(); g.ellipse(80, 108, 10, 22, 0, 0, 7); g.ellipse(176, 108, 10, 22, 0, 0, 7); g.fill();
        } else if (st === 'curly') {
            for (let k = 0; k < 16; k++) { const a = Math.PI + (k / 15) * Math.PI; g.beginPath(); g.arc(128 + Math.cos(a) * 54, 104 + Math.sin(a) * 58, 16, 0, 7); g.fill(); }
            g.beginPath(); g.arc(78, 130, 16, 0, 7); g.arc(178, 130, 16, 0, 7); g.fill();
        } else if (st === 'swept') {
            g.beginPath(); g.moveTo(74, 110); g.quadraticCurveTo(80, 40, 150, 46); g.quadraticCurveTo(200, 52, 184, 108); g.quadraticCurveTo(160, 70, 120, 76); g.quadraticCurveTo(90, 80, 74, 110); g.fill();
        } else if (st === 'slick') {
            g.beginPath(); g.ellipse(128, 76, 54, 28, 0, Math.PI, 0); g.fill();
            g.fillRect(74, 76, 12, 40); g.fillRect(170, 76, 12, 40);
        } else if (st === 'pomp') {
            g.beginPath(); g.moveTo(76, 100); g.quadraticCurveTo(70, 30, 140, 28); g.quadraticCurveTo(196, 30, 182, 100); g.quadraticCurveTo(170, 66, 128, 64); g.quadraticCurveTo(88, 64, 76, 100); g.fill();
        } else if (st === 'short') {
            g.beginPath(); g.ellipse(128, 80, 54, 30, 0, Math.PI, 0); g.fill();
        } else if (st === 'braid') {
            g.beginPath(); g.ellipse(128, 82, 56, 32, 0, Math.PI, 0); g.fill();
            for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(184, 130 + k * 16, 10, 10, 0, 0, 7); g.fill(); }
        } else if (st === 'bob') {
            g.beginPath(); g.moveTo(70, 160); g.quadraticCurveTo(60, 50, 128, 46); g.quadraticCurveTo(196, 50, 186, 160); g.lineTo(170, 160); g.quadraticCurveTo(172, 90, 128, 84); g.quadraticCurveTo(84, 90, 86, 160); g.fill();
        }
    }

    // Face features.
    const ey = 120, ex = 22 * big;
    const eyeCol = L.eye || '#2a1a10';
    const m = mood;
    if (L.shades) {
        g.fillStyle = '#121418';
        rr(g, 86, 106, 38, 22, 8); g.fill(); rr(g, 132, 106, 38, 22, 8); g.fill();
        g.fillRect(122, 112, 12, 4);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(92, 110, 10, 4); g.fillRect(138, 110, 10, 4);
    } else {
        g.fillStyle = '#fff';
        const open = m === 'shock' ? 11 : m === 'smug' ? 5 : m === 'angry' ? 6 : m === 'grin' || m === 'happy' ? 7 : 8;
        for (const s of [-1, 1]) {
            g.beginPath(); g.ellipse(128 + s * ex, ey, 11, open, 0, 0, 7); g.fill();
            g.fillStyle = eyeCol;
            g.beginPath(); g.arc(128 + s * ex + (m === 'smug' ? 3 : 0), ey + 1, Math.min(6, open - 1), 0, 7); g.fill();
            g.fillStyle = '#fff';
            g.beginPath(); g.arc(128 + s * ex + 2, ey - 2, 1.8, 0, 7); g.fill();
            if (m === 'happy' || m === 'grin') { g.fillStyle = L.skin; g.beginPath(); g.ellipse(128 + s * ex, ey + 9, 13, 6, 0, 0, 7); g.fill(); }
            g.fillStyle = '#fff';
        }
    }
    // Brows.
    g.strokeStyle = L.brows || L.hair || '#3a2a1a';
    g.lineWidth = L.brows ? 7 : 5;
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
        const tilt = m === 'angry' ? 7 : m === 'sad' ? -6 : m === 'smug' ? (s > 0 ? -5 : 3) : m === 'shock' ? -4 : 0;
        g.beginPath();
        g.moveTo(128 + s * (ex - 11), ey - 16 + (m === 'shock' ? -6 : 0) + tilt * 0.5);
        g.lineTo(128 + s * (ex + 11), ey - 16 + (m === 'shock' ? -6 : 0) - tilt * 0.5);
        g.stroke();
    }
    // Nose.
    g.strokeStyle = shade(L.skin, 0.75); g.lineWidth = 3;
    g.beginPath(); g.moveTo(128, 124); g.quadraticCurveTo(122, 142, 130, 144); g.stroke();
    if (L.freckles) { g.fillStyle = '#c8784a'; for (let k = 0; k < 10; k++) g.fillRect(100 + (k % 5) * 6 + (k > 4 ? 40 : 0), 134 + (k % 3) * 4, 2.5, 2.5); }
    if (L.wrinkles) { g.strokeStyle = shade(L.skin, 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(102, 88); g.lineTo(154, 88); g.moveTo(106, 96); g.lineTo(150, 96); g.stroke(); }
    if (L.scar) { g.strokeStyle = '#8a4a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(160, 132); g.lineTo(170, 152); g.stroke(); }
    if (L.smudge) { g.fillStyle = 'rgba(30,20,10,0.55)'; g.beginPath(); g.ellipse(152, 146, 10, 5, 0.3, 0, 7); g.fill(); }
    if (L.stubble) { g.fillStyle = 'rgba(80,80,70,0.35)'; g.beginPath(); g.ellipse(128, 160, 40, 24, 0, 0, Math.PI); g.fill(); }

    // Mouth.
    const my = 160;
    g.strokeStyle = '#5a2a1a'; g.lineWidth = 4;
    g.fillStyle = '#5a1a14';
    if (m === 'grin' || m === 'happy') {
        g.beginPath(); g.moveTo(106, my - 4); g.quadraticCurveTo(128, my + (m === 'grin' ? 22 : 16), 150, my - 4); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.fillRect(112, my - 3, 32, 5);
        if (L.goldTooth) { g.fillStyle = '#e8b33a'; g.fillRect(132, my - 3, 6, 5); }
    } else if (m === 'smug') {
        g.beginPath(); g.moveTo(112, my + 2); g.quadraticCurveTo(136, my + 4, 150, my - 6); g.stroke();
    } else if (m === 'angry') {
        g.beginPath(); g.moveTo(110, my + 4); g.quadraticCurveTo(128, my - 4, 146, my + 4); g.stroke();
    } else if (m === 'sad') {
        g.beginPath(); g.moveTo(112, my + 6); g.quadraticCurveTo(128, my - 2, 144, my + 6); g.stroke();
    } else if (m === 'shock') {
        g.beginPath(); g.ellipse(128, my + 2, 9, 12, 0, 0, 7); g.fill();
    } else {
        g.beginPath(); g.moveTo(114, my); g.lineTo(142, my); g.stroke();
    }
    if (L.lips) { g.strokeStyle = L.lips; g.lineWidth = 3; g.beginPath(); g.moveTo(116, my); g.quadraticCurveTo(128, my + 4, 140, my); g.stroke(); }

    // Facial hair.
    if (L.mous === 'walrus') {
        g.fillStyle = L.hair;
        g.beginPath(); g.moveTo(98, 156); g.quadraticCurveTo(128, 132, 158, 156); g.quadraticCurveTo(150, 166, 128, 152); g.quadraticCurveTo(106, 166, 98, 156); g.fill();
    } else if (L.mous === 'thin') {
        g.strokeStyle = L.hair; g.lineWidth = 3; g.beginPath(); g.moveTo(108, 152); g.quadraticCurveTo(128, 146, 148, 152); g.stroke();
    }
    if (L.beard) {
        g.fillStyle = L.beard;
        g.beginPath(); g.moveTo(80, 128); g.quadraticCurveTo(80, 196, 128, 200); g.quadraticCurveTo(176, 196, 176, 128); g.quadraticCurveTo(160, 172, 128, 172); g.quadraticCurveTo(96, 172, 80, 128); g.fill();
    }
    if (L.goatee) { g.fillStyle = L.goatee; g.beginPath(); g.ellipse(128, 180, 12, 10, 0, 0, 7); g.fill(); }

    // Glasses.
    if (L.glasses) {
        g.strokeStyle = '#2a2a2a'; g.lineWidth = 3;
        for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * ex, ey, 14, 0, 7); g.stroke(); }
        g.beginPath(); g.moveTo(114 + 0, ey); g.lineTo(142, ey); g.stroke();
    }
    if (L.shadesUp) {
        g.fillStyle = '#121418'; rr(g, 86, 66, 38, 16, 6); g.fill(); rr(g, 132, 66, 38, 16, 6); g.fill();
        g.fillStyle = '#39f0ff'; g.fillRect(92, 70, 10, 3);
    }

    // Hats and headgear.
    if (L.cap) {
        g.fillStyle = L.cap.col;
        g.beginPath(); g.ellipse(128, 76, 58, 34, 0, Math.PI, 0); g.fill();
        g.fillRect(70, 72, 116, 10);
        g.fillStyle = shade(L.cap.col, 0.7);
        g.beginPath(); g.ellipse(150, 82, 52, 10, 0.05, 0, 7); g.fill();
        g.fillStyle = '#f4f1e8'; g.font = '900 26px "Bungee", Impact, sans-serif'; g.textAlign = 'center'; g.fillText(L.cap.text, 128, 70);
    }
    if (L.hat === 'cowboy') {
        g.fillStyle = L.hatCol;
        g.beginPath(); g.ellipse(128, 72, 96, 18, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(84, 72); g.quadraticCurveTo(86, 18, 128, 26); g.quadraticCurveTo(170, 18, 172, 72); g.fill();
        g.fillStyle = '#8a3a22'; g.fillRect(86, 58, 84, 9);
    }
    if (L.hat === 'ranger') {
        g.fillStyle = L.hatCol;
        g.beginPath(); g.ellipse(128, 70, 90, 14, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(88, 70); g.lineTo(104, 22); g.lineTo(128, 36); g.lineTo(152, 22); g.lineTo(168, 70); g.fill();
        g.fillStyle = '#4a3a1a'; g.fillRect(90, 60, 76, 7);
    }
    if (L.hat === 'boonie') {
        g.fillStyle = L.hatCol;
        g.beginPath(); g.ellipse(128, 76, 80, 18, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(128, 64, 54, 30, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#d8c060'; g.fillRect(140, 46, 4, 18);
    }
    if (L.bandana) {
        g.fillStyle = L.bandana;
        g.beginPath(); g.ellipse(128, 72, 56, 26, 0, Math.PI, 0); g.fill();
        g.fillRect(72, 68, 112, 12);
        g.beginPath(); g.moveTo(180, 74); g.lineTo(204, 64); g.lineTo(198, 86); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(90 + k * 15, 64 + (k % 2) * 6, 2.5, 0, 7); g.fill(); }
    }
    if (L.headset) {
        g.strokeStyle = '#1a1a1a'; g.lineWidth = 6;
        g.beginPath(); g.arc(128, 112, 62, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        g.fillStyle = '#1a1a1a'; rr(g, 64, 104, 16, 30, 6); g.fill(); rr(g, 176, 104, 16, 30, 6); g.fill();
        g.lineWidth = 4; g.beginPath(); g.moveTo(72, 130); g.quadraticCurveTo(80, 170, 112, 166); g.stroke();
        g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(114, 166, 6, 0, 7); g.fill();
    }
    if (L.sparkle) {
        g.fillStyle = '#fff';
        for (const [x, y, r] of [[40, 50, 6], [216, 70, 5], [200, 200, 7], [56, 196, 4]]) {
            g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.5, y); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.5, y); g.fill();
            g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x, y + r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x, y - r * 0.5); g.fill();
        }
    }
    g.restore();
}
