// Every character is drawn in code: chibi shapes on a Canvas 2D context, no image files.
// drawActor(ctx, key, footX, footY, scale, anim) draws one standing on a point; bust(key, px)
// returns a cached head-and-shoulders canvas for dialogue portraits and the turn strip.
//
// anim: { t: seconds, dir: 1 | -1, hop: px, lean: rad, squash: 0..1, flash: 0..1, face: 'idle'|'happy'|'hurt'|'ko', alpha }

const TAU = Math.PI * 2;
const LINE = 'rgba(80,45,70,0.6)';
const EYE = '#3a2438';

function ell(c, x, y, rx, ry, fill, stroke = LINE, lw = 1.2) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function poly(c, pts, fill, stroke = LINE, lw = 1.2) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function line(c, x1, y1, x2, y2, col, w = 2) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = w; c.lineCap = 'round'; c.strokeStyle = col; c.stroke();
}
function star(c, x, y, r, fill, rot = 0) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 1; c.strokeStyle = LINE; c.stroke();
}

/** Eyes, cheeks and a mouth around (x, y). */
function face(c, x, y, mood, o = {}) {
    const sp = o.spread ?? 5.6;
    if (mood === 'ko' || mood === 'hurt') {
        c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = EYE;
        for (const s of [-1, 1]) {
            c.beginPath();
            c.moveTo(x + s * sp - 2.5 * s, y - 3); c.lineTo(x + s * sp + 2 * s, y); c.lineTo(x + s * sp - 2.5 * s, y + 3);
            c.stroke();
        }
        ell(c, x, y + 8, 2.2, 3, '#7a3a4a', null);
    } else if (mood === 'happy' || o.calm) {
        c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = EYE;
        for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * sp, y + 1, 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        c.beginPath(); c.arc(x, y + 5, 3.2, 0.15, Math.PI - 0.15); c.lineWidth = 1.6; c.stroke();
    } else {
        for (const s of [-1, 1]) {
            ell(c, x + s * sp, y, 2.9, 4, EYE, null);
            ell(c, x + s * sp - 0.9, y - 1.4, 1.1, 1.4, '#fff', null);
            ell(c, x + s * sp + 0.8, y + 1.5, 0.6, 0.6, '#fff', null);
        }
        c.beginPath(); c.arc(x, y + 5.5, 2.6, 0.2, Math.PI - 0.2); c.lineWidth = 1.5; c.strokeStyle = EYE; c.lineCap = 'round'; c.stroke();
    }
    const blush = o.blush ?? 0.4;
    ell(c, x - sp - 3.4, y + 5, 3.3, 2, `rgba(255,110,140,${blush})`, null);
    ell(c, x + sp + 3.4, y + 5, 3.3, 2, `rgba(255,110,140,${blush})`, null);
}

/** The shared little body: feet, robe, sleeves, head. Per-character parts are passed in. */
function humanoid(c, o, a, t, bob) {
    const hy = -40 + bob;
    o.back?.(c, hy, t, a);
    ell(c, -6, -3, 5.2, 3.2, o.shoe || '#7a4a3a');
    ell(c, 6, -3, 5.2, 3.2, o.shoe || '#7a4a3a');
    poly(c, [[-9, -28 + bob], [9, -28 + bob], [13.5, -5], [-13.5, -5]], o.body);
    if (o.trim) { c.lineWidth = 2.4; c.strokeStyle = o.trim; c.beginPath(); c.moveTo(-13, -6); c.lineTo(13, -6); c.stroke(); }
    o.torso?.(c, bob, t);
    ell(c, -12.5, -19 + bob * 0.6, 3.8, 4.4, o.sleeve || o.body);
    ell(c, 12.5, -19 + bob * 0.6, 3.8, 4.4, o.sleeve || o.body);
    ell(c, -13.4, -14 + bob * 0.4, 2.7, 2.7, o.skin);
    ell(c, 13.4, -14 + bob * 0.4, 2.7, 2.7, o.skin);
    o.prop?.(c, t, bob, a);
    o.headBack?.(c, hy, t);
    ell(c, 0, hy, 14.5, 13.5, o.skin);
    face(c, 0, hy + 2, a.face || 'idle', { blush: o.blush, calm: o.calm, spread: o.spread });
    o.front?.(c, hy, t, a);
}

const LOOK = {
    pip: {
        skin: '#ffe3cf', body: '#ff9ec7', trim: '#fff0a8', sleeve: '#ff8ab8', blush: 0.6,
        back: (c, hy, t) => {
            const sway = Math.sin(t * 2) * 1.2;
            poly(c, [[-9, -29], [9, -29], [17 + sway, -3], [-17 + sway, -3]], '#b86be0');
            ell(c, -11, hy + 10, 6, 14, '#f2b84b');
            ell(c, 11, hy + 10, 6, 14, '#f2b84b');
        },
        torso: (c) => { ell(c, 0, -27, 2.6, 2.6, '#ffd94d'); },
        prop: (c, t) => {
            const w = Math.sin(t * 2.2) * 0.08;
            c.save(); c.translate(15, -16); c.rotate(0.35 + w);
            line(c, 0, 0, 0, -26, '#d9a441', 2.4);
            star(c, 0, -29, 6, '#ffe66d', t);
            c.restore();
        },
        front: (c, hy) => {
            c.fillStyle = '#f2b84b';
            c.beginPath(); c.ellipse(0, hy - 8, 14.5, 8.5, 0, Math.PI, TAU); c.fill();
            poly(c, [[-5, hy - 12], [3, hy - 4], [12, hy - 11], [4, hy - 9]], '#f2b84b', null);
            c.save(); c.translate(0, hy - 14); c.rotate(0.2);
            poly(c, [[-8, 0], [-8, -6], [-4, -3], [0, -8], [4, -3], [8, -6], [8, 0]], '#ffd94d');
            ell(c, 0, -2, 1.7, 1.7, '#ff6b9a', null);
            c.restore();
        },
    },
    bram: {
        skin: '#f2c9a0', body: '#4b6fb0', trim: '#e8eef8', sleeve: '#9db4d4', shoe: '#5a5a6a', blush: 0.5, spread: 5.8,
        torso: (c, bob) => {
            ell(c, -10, -26 + bob, 5.2, 4, '#c8d4e6'); ell(c, 10, -26 + bob, 5.2, 4, '#c8d4e6');
            poly(c, [[-9, -28 + bob], [9, -28 + bob], [7, -22 + bob], [-7, -22 + bob]], '#f4a6b8');   // knitted scarf
            c.lineWidth = 1.4; c.strokeStyle = '#ffd9a0'; c.beginPath(); c.moveTo(-7, -25 + bob); c.lineTo(7, -25 + bob); c.stroke();
        },
        prop: (c, t, bob) => {
            ell(c, -17, -17, 8, 10, '#f7f1dc');
            ell(c, -17, -17, 5, 7, '#4b6fb0');
            star(c, -17, -17, 3.2, '#ffd94d');
            line(c, 17, -14, 17, -34, '#d8dde8', 3);
            line(c, 13, -17, 21, -17, '#c8a45a', 2.6);
        },
        headBack: (c, hy) => { ell(c, 0, hy - 1, 15.5, 14, '#7a4b2a'); },
        front: (c, hy) => {
            c.fillStyle = '#7a4b2a';
            c.beginPath(); c.ellipse(0, hy - 7, 15, 8, 0, Math.PI, TAU); c.fill();
            c.beginPath(); c.moveTo(-14, hy - 4); c.quadraticCurveTo(-6, hy - 8, 2, hy - 12); c.quadraticCurveTo(10, hy - 7, 14, hy - 4); c.lineTo(14, hy - 9); c.lineTo(-14, hy - 9); c.fill();
        },
    },
    mina: {
        skin: '#fbe0d0', body: '#7a58c8', trim: '#c9b0ff', sleeve: '#6a48b8', shoe: '#4a3a5a',
        back: (c, hy) => { ell(c, -11, hy + 8, 6, 13, '#3b2a5a'); ell(c, 11, hy + 8, 6, 13, '#3b2a5a'); },
        torso: (c, bob) => { for (const [x, y] of [[-4, -20], [5, -14], [-6, -10], [2, -23]]) star(c, x, y + bob * 0.4, 1.8, '#ffe66d'); },
        prop: (c, t) => {
            c.save(); c.translate(-15, -18); c.rotate(-0.2);
            poly(c, [[-5, -8], [5, -8], [5, 6], [-5, 6]], '#d9584a');
            poly(c, [[-4, -7], [4, -7], [4, 5], [-4, 5]], '#f7e8d0', null, 0);
            line(c, -2, -4, 2, -4, '#a09080', 1); line(c, -2, -1, 2, -1, '#a09080', 1);
            c.restore();
        },
        headBack: (c, hy) => { ell(c, 0, hy + 1, 15.5, 14.5, '#3b2a5a'); },
        front: (c, hy, t) => {
            c.lineWidth = 1.5; c.strokeStyle = '#8a5a2a';
            for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 5.6, hy + 2, 4.6, 0, TAU); c.stroke(); }
            line(c, -1, hy + 2, 1, hy + 2, '#8a5a2a', 1.4);
            c.fillStyle = '#3b2a5a'; c.beginPath(); c.ellipse(0, hy - 8, 14.5, 7, 0, Math.PI, TAU); c.fill();
            ell(c, 0, hy - 11, 21, 4.8, '#6b4aa8');
            poly(c, [[-10, hy - 12], [10, hy - 12], [4, hy - 34 + Math.sin(t * 2) * 1.2], [-3, hy - 30]], '#6b4aa8');
            line(c, -10, hy - 13, 10, hy - 13, '#ffd94d', 2.4);
            star(c, -1, hy - 21, 3.4, '#ffe66d', t * 0.5);
        },
    },
    juniper: {
        skin: '#e8bf9a', body: '#8ccf8c', trim: '#fff6dc', sleeve: '#76bb78', calm: true, blush: 0.45,
        torso: (c) => { poly(c, [[-6, -27], [6, -27], [8, -6], [-8, -6]], '#fff6dc'); ell(c, 0, -17, 2, 2, '#e8a0b8', null); },
        prop: (c, t) => {
            ell(c, 17, -16, 6, 5, '#fff6dc');
            line(c, 22, -17, 25, -22, '#fff6dc', 2.4);
            poly(c, [[12, -20], [22, -20], [20, -22], [14, -22]], '#e8d0a8');
            c.globalAlpha = 0.5;
            for (let i = 0; i < 2; i++) ell(c, 17 + Math.sin(t * 2 + i) * 2, -26 - ((t * 8 + i * 6) % 12), 2.2, 2.2, '#fff', null);
            c.globalAlpha = 1;
        },
        headBack: (c, hy) => { ell(c, 0, hy, 15.5, 14.5, '#4a8a5a'); ell(c, 0, hy - 16, 6.5, 6, '#4a8a5a'); },
        front: (c, hy) => {
            c.fillStyle = '#4a8a5a'; c.beginPath(); c.ellipse(0, hy - 7, 14.5, 7.5, 0, Math.PI, TAU); c.fill();
            c.save(); c.translate(7, hy - 16); c.rotate(0.6); ell(c, 0, 0, 3, 5.4, '#b9e8a0'); line(c, 0, -4, 0, 4, '#76bb78', 1); c.restore();
            ell(c, -5, hy - 15, 2.4, 2.4, '#ff9ec7', null);
        },
    },
    fenn: {
        skin: '#e6b894', body: '#3b6a70', trim: '#f2c14e', sleeve: '#2f5a60', shoe: '#4a3a2a', spread: 5.4,
        back: (c, hy) => {
            poly(c, [[-9, hy - 4], [9, hy - 4], [6, -6], [-6, -6]], '#2f9aa0');
            c.save(); c.translate(-12, -28); c.rotate(-0.3);
            poly(c, [[-4, 0], [4, 0], [3, 18], [-3, 18]], '#8a5a2a');
            for (const x of [-2, 0, 2]) line(c, x, 0, x, -7, '#e8d8a8', 1.4);
            c.restore();
        },
        torso: (c, bob) => { poly(c, [[-9, -28 + bob], [9, -28 + bob], [7, -22 + bob], [-7, -22 + bob]], '#f2c14e'); },
        prop: (c) => {
            c.beginPath(); c.arc(-15, -22, 15, -1.0, 1.0); c.lineWidth = 2.6; c.strokeStyle = '#8a5a2a'; c.lineCap = 'round'; c.stroke();
            line(c, -15 + Math.cos(-1.0) * 15, -22 + Math.sin(-1.0) * 15, -15 + Math.cos(1.0) * 15, -22 + Math.sin(1.0) * 15, '#fff', 1);
        },
        headBack: (c, hy) => { ell(c, 0, hy, 15.5, 14.5, '#2f9aa0'); },
        front: (c, hy) => {
            c.fillStyle = '#2e2e3e'; c.beginPath(); c.ellipse(0, hy - 6, 14.5, 8, 0, Math.PI, TAU); c.fill();
            poly(c, [[-14, hy - 4], [-3, hy - 9], [-8, hy + 1]], '#2e2e3e', null);
            poly(c, [[14, hy - 4], [3, hy - 9], [8, hy + 1]], '#2e2e3e', null);
            c.beginPath(); c.moveTo(-15, hy - 1); c.quadraticCurveTo(0, hy - 24, 15, hy - 1); c.lineWidth = 3; c.strokeStyle = '#2f9aa0'; c.stroke();
            poly(c, [[10, hy - 12], [20, hy - 20], [13, hy - 5]], '#2f9aa0');
        },
    },
    hazel: {
        skin: '#f0d4bc', body: '#6a4a8a', trim: '#d9c8f0', calm: true,
        headBack: (c, hy) => { ell(c, 0, hy - 14, 7, 6.5, '#c8c8d8'); },
        front: (c, hy) => {
            c.fillStyle = '#c8c8d8'; c.beginPath(); c.ellipse(0, hy - 7, 14.5, 8, 0, Math.PI, TAU); c.fill();
            c.lineWidth = 1.5; c.strokeStyle = '#6a4a2a';
            for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 5.6, hy + 2, 4.4, 0, TAU); c.stroke(); }
        },
    },
};

// ---------------------------------------------------------------- non-humanoids
const CREATURE = {
    pudge(c, a, t, bob) {
        ell(c, -6, -3, 5.4, 3.4, '#b86f48'); ell(c, 6, -3, 5.4, 3.4, '#b86f48');
        ell(c, 0, -21 + bob, 17, 17, '#d98a5a');
        ell(c, -17, -20 + bob, 4.6, 6, '#d98a5a'); ell(c, 17, -20 + bob, 4.6, 6, '#d98a5a');
        c.lineWidth = 1.2; c.strokeStyle = 'rgba(120,60,30,.5)';
        c.beginPath(); c.moveTo(6, -30 + bob); c.lineTo(10, -24 + bob); c.lineTo(7, -19 + bob); c.stroke();
        c.beginPath(); c.moveTo(-10, -12 + bob); c.lineTo(-6, -8 + bob); c.stroke();
        ell(c, 0, -38 + bob, 13.5, 11.5, '#e29a68');
        face(c, 0, -37 + bob, a.face === 'idle' ? 'happy' : a.face, { blush: 0.5 });
        line(c, 0, -49 + bob, 0, -55 + bob, '#5aa05a', 2);
        ell(c, -4, -56 + bob, 4, 2.4, '#8ccf6a'); ell(c, 4, -57 + bob, 4, 2.4, '#8ccf6a');
    },
    bunny(c, a, t, bob) {
        const hop = Math.abs(Math.sin(t * 3.4)) * 1.5;
        ell(c, -6, -2, 4.6, 2.8, '#d6c9d9'); ell(c, 6, -2, 4.6, 2.8, '#d6c9d9');
        const ear = Math.sin(t * 2.4) * 0.12;
        for (const s of [-1, 1]) {
            c.save(); c.translate(s * 7, -34 + bob - hop); c.rotate(s * (0.28 + ear));
            ell(c, 0, -9, 3.6, 10, '#c9bcd0'); ell(c, 0, -9, 1.8, 7, '#f0b8c8', null); c.restore();
        }
        ell(c, 0, -17 + bob - hop, 17, 15, '#d9cce0');
        for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU; ell(c, Math.cos(an) * 15, -17 + bob - hop + Math.sin(an) * 13, 4, 4, '#d9cce0', null); }
        ell(c, 0, -17 + bob - hop, 15, 13, '#e6dcea', null);
        face(c, 0, -19 + bob - hop, a.face === 'idle' ? 'idle' : a.face, { blush: 0.5, spread: 5 });
        ell(c, 0, -15 + bob - hop, 1.8, 1.4, '#f08aa0', null);
    },
    blot(c, a, t, bob) {
        const w = Math.sin(t * 3) * 1.2;
        c.beginPath();
        c.moveTo(0, -48 + bob);
        c.bezierCurveTo(14 + w, -30 + bob, 18, -20, 15, -9);
        c.bezierCurveTo(12, -1, -12, -1, -15, -9);
        c.bezierCurveTo(-18, -20, -14 - w, -30 + bob, 0, -48 + bob);
        c.fillStyle = '#3a3a8a'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = '#1a1a4a'; c.stroke();
        ell(c, -7, -26 + bob, 3, 6, 'rgba(255,255,255,.18)', null);
        const drip = (Math.sin(t * 1.4) + 1) * 3;
        ell(c, 11, -3 + drip * 0.3, 2.2, 3 + drip * 0.5, '#3a3a8a', null);
        face(c, 0, -22 + bob, a.face, { blush: 0.2, spread: 5.6 });
    },
    thorn(c, a, t, bob) {
        ell(c, -6, -2, 5, 3, '#3d6a3a'); ell(c, 6, -2, 5, 3, '#3d6a3a');
        for (let i = 0; i < 14; i++) {
            const an = (i / 14) * TAU;
            poly(c, [[Math.cos(an) * 14, -20 + bob + Math.sin(an) * 14], [Math.cos(an + 0.2) * 21, -20 + bob + Math.sin(an + 0.2) * 20], [Math.cos(an + 0.4) * 14, -20 + bob + Math.sin(an + 0.4) * 14]], '#4f8a3f', null);
        }
        ell(c, 0, -20 + bob, 16, 15, '#5aa048');
        for (const [x, y] of [[-8, -10], [9, -26], [-9, -28]]) ell(c, x, y + bob, 2.4, 1.8, '#7cc060', null);
        // angry little brows over big eyes
        face(c, 0, -20 + bob, a.face, { blush: 0.35, spread: 5.8 });
        if (a.face === 'idle') { line(c, -9, -28 + bob, -3, -25 + bob, '#2a4a28', 1.8); line(c, 9, -28 + bob, 3, -25 + bob, '#2a4a28', 1.8); }
        for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * 0.55; ell(c, Math.cos(an) * 5, -38 + bob + Math.sin(an) * 3, 3.2, 3.2, '#ff8fb1', null); }
        ell(c, 0, -38 + bob, 2.2, 2.2, '#ffe66d', null);
    },
    crow(c, a, t, bob) {
        const flap = Math.sin(t * 9) * 0.6;
        const y = -26 + bob;
        for (const s of [-1, 1]) {
            c.save(); c.translate(s * 9, y - 2); c.rotate(s * (0.6 + flap));
            ell(c, s * 8, 0, 11, 4.6, '#2a2a3a'); c.restore();
        }
        ell(c, 0, y, 13, 12, '#34344a');
        ell(c, 0, y + 3, 8, 7, '#4a4a62', null);
        poly(c, [[-2, y + 1], [9, y + 3], [-2, y + 7]], '#f0a040');
        face(c, -1, y - 3, a.face, { blush: 0.15, spread: 4.6 });
        poly(c, [[-10, y + 8], [-6, y + 16], [-2, y + 9]], '#2a2a3a', null);
    },
    sprite(c, a, t, bob) {
        const y = -17 + bob;
        for (let i = 0; i < 16; i++) {
            const an = (i / 16) * TAU + t * 0.7;
            const l = 17 + Math.sin(t * 6 + i * 2) * 2.2;
            line(c, Math.cos(an) * 8, y + Math.sin(an) * 8, Math.cos(an) * l, y + Math.sin(an) * l, '#2a2430', 3);
        }
        ell(c, 0, y, 12, 12, '#2a2430', null);
        for (const s of [-1, 1]) { ell(c, s * 5, y - 1, 4.6, 5.4, '#fff', null); ell(c, s * 5 + 0.8, y, 2.2, 3, '#2a2430', null); }
        ell(c, -7.5, y + 5.5, 2.6, 1.6, 'rgba(255,140,90,.7)', null); ell(c, 7.5, y + 5.5, 2.6, 1.6, 'rgba(255,140,90,.7)', null);
        if (a.face === 'hurt') line(c, -4, y + 7, 4, y + 7, '#fff', 1.6);
    },
    scone(c, a, t, bob) {
        ell(c, -6, -3, 5.4, 3.2, '#8a6a4a'); ell(c, 6, -3, 5.4, 3.2, '#8a6a4a');
        poly(c, [[-11, -27 + bob], [11, -27 + bob], [14, -5], [-14, -5]], '#9a9ab2');
        ell(c, -14, -17, 4, 4.6, '#b8b8cc'); ell(c, 14, -17, 4, 4.6, '#b8b8cc');
        // the spear
        line(c, 19, -8, 19, -46, '#8a6a4a', 2.4); poly(c, [[16, -46], [22, -46], [19, -55]], '#d8d8e4');
        // shield: a lumpy biscuit
        ell(c, -19, -17, 7, 9, '#e0b070'); ell(c, -19, -17, 4, 6, '#f0cc90', null);
        // the dome helm is a scone
        c.beginPath(); c.moveTo(-17, -29 + bob); c.bezierCurveTo(-18, -54 + bob, 18, -54 + bob, 17, -29 + bob); c.closePath();
        c.fillStyle = '#e0b070'; c.fill(); c.lineWidth = 1.3; c.strokeStyle = LINE; c.stroke();
        for (const [x, y] of [[-8, -44], [6, -47], [10, -38], [-12, -36]]) ell(c, x, y + bob, 1.6, 1.3, '#b88a4a', null);
        c.fillStyle = '#4a3a30'; c.beginPath(); c.roundRect(-12, -40 + bob, 24, 7, 3); c.fill();
        for (const s of [-1, 1]) ell(c, s * 5, -36.5 + bob, 2.4, 2.6, a.face === 'hurt' ? '#fff' : '#8a2a3a', null);
        ell(c, 0, -26 + bob, 17, 3, '#c8985a');
    },
    basil(c, a, t, bob) {
        const sway = Math.sin(t * 1.4) * 1.4;
        poly(c, [[-12, -50 + bob], [12, -50 + bob], [25 + sway, -3], [-25 + sway, -3]], '#241838');
        poly(c, [[-14, -46 + bob], [-22, -62 + bob], [-8, -52 + bob]], '#241838', null);
        poly(c, [[14, -46 + bob], [22, -62 + bob], [8, -52 + bob]], '#241838', null);
        ell(c, -6, -3, 6, 3.4, '#2a1f3a'); ell(c, 6, -3, 6, 3.4, '#2a1f3a');
        poly(c, [[-11, -44 + bob], [11, -44 + bob], [14, -5], [-14, -5]], '#3a2a4a');
        poly(c, [[-7, -36 + bob], [7, -36 + bob], [10, -5], [-10, -5]], '#f4ead0');
        ell(c, 3, -18, 2.4, 1.8, '#c8a070', null);
        line(c, -2, -40 + bob, -2, -36 + bob, '#a89870', 1.4);
        // the oven glove
        ell(c, 16, -26 + bob, 5.2, 6, '#d9573a'); ell(c, 19, -30 + bob, 2.6, 3.6, '#d9573a');
        c.lineWidth = 1; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(12, -24 + bob); c.lineTo(20, -24 + bob); c.stroke();
        ell(c, -15, -26 + bob, 4, 5, '#a8b8a0');
        line(c, -18, -26 + bob, -22, -50 + bob, '#b9894a', 2.4);          // a wooden spoon tucked in the belt
        ell(c, -22.4, -52 + bob, 3, 4, '#b9894a');
        // horns, head, hair
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7, -60 + bob); c.quadraticCurveTo(s * 15, -66 + bob, s * 16, -76 + bob); c.quadraticCurveTo(s * 10, -68 + bob, s * 4, -58 + bob); c.fillStyle = '#d8d4cc'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = LINE; c.stroke(); }
        ell(c, 0, -57 + bob, 15, 14.5, '#a8b8a0');
        face(c, 0, -55 + bob, a.face === 'idle' ? 'idle' : a.face, { blush: 0.25, spread: 6 });
        for (const s of [-1, 1]) line(c, s * 8.5, -50 + bob, s * 3, -50 + bob, 'rgba(80,60,90,.5)', 1.2);   // bags under the eyes
        c.fillStyle = '#1a1424'; c.beginPath(); c.ellipse(0, -66 + bob, 14.5, 7.5, 0, Math.PI, TAU); c.fill();
        poly(c, [[-10, -66 + bob], [0, -74 + bob], [12, -64 + bob]], '#1a1424', null);
        c.beginPath(); c.moveTo(-5, -47 + bob); c.quadraticCurveTo(0, -49 + bob, 5, -47 + bob); c.lineWidth = 1.4; c.strokeStyle = '#6a4a5a'; c.stroke();
    },
};

let flashCv = null;

/** Draw one actor. A hit flash is a white tint on an offscreen copy: ctx.filter on the main canvas halved the frame rate. */
export function drawActor(ctx, key, x, y, s, a = {}) {
    if (a.flash > 0.02 && ctx.canvas && !a.inFlash) return drawFlashed(ctx, key, x, y, s, a);
    const t = a.t || 0;
    const bob = Math.sin(t * 3 + (a.phase || 0)) * 1.1 * (a.bob ?? 1);
    ctx.save();
    if (a.alpha !== undefined) ctx.globalAlpha *= a.alpha;
    ctx.translate(x, y - (a.hop || 0));
    ctx.rotate(a.lean || 0);
    ctx.scale(s * (a.dir || 1) * (1 + (a.squash || 0)), s * (1 - (a.squash || 0)));
    ctx.lineJoin = 'round';
    const look = LOOK[key];
    if (look) humanoid(ctx, look, a, t, bob);
    else (CREATURE[key] || CREATURE.bunny)(ctx, a, t, bob);
    ctx.restore();
}

function drawFlashed(ctx, key, x, y, s, a) {
    const m = ctx.getTransform();
    const k = Math.hypot(m.a, m.b) || 1;
    const pix = k * s;                                   // device pixels per actor unit
    const W = Math.ceil(150 * pix), H = Math.ceil(190 * pix);
    if (!flashCv) flashCv = document.createElement('canvas');
    if (flashCv.width < W || flashCv.height < H) { flashCv.width = Math.max(flashCv.width, W); flashCv.height = Math.max(flashCv.height, H); }
    const o = flashCv.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, flashCv.width, flashCv.height);
    const fx = W / 2, fy = H - 12 * pix;
    drawActor(o, key, fx, fy, pix, { ...a, flash: 0, inFlash: true, hop: (a.hop || 0) * k });
    o.globalCompositeOperation = 'source-atop';
    o.fillStyle = `rgba(255,255,255,${Math.min(0.85, a.flash * 0.9)})`;
    o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    ctx.drawImage(flashCv, 0, 0, W, H, x - fx / k, y - fy / k, W / k, H / k);
}

// ---------------------------------------------------------------- portraits
const cache = new Map();
const PORTRAIT = {
    pip: [40, 56, 0.5], mina: [40, 68, 0.56], juniper: [40, 56, 0.5], fenn: [40, 56, 0.5], hazel: [40, 56, 0.5],
    pudge: [38, 60, 0.5], bunny: [18, 52, 0.62], blot: [22, 54, 0.62], thorn: [22, 50, 0.62], crow: [26, 56, 0.5],
    sprite: [17, 42, 0.55], scone: [40, 60, 0.56], basil: [57, 92, 0.56],
};

/** A head-and-shoulders picture in a square canvas of `px` pixels. Cached. */
export function bust(key, px = 96, face = 'idle') {
    const id = `${key}:${px}:${face}`;
    if (cache.has(id)) return cache.get(id);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    if (key === 'narrator') {
        c.fillStyle = '#fff6dc'; c.beginPath(); c.roundRect(px * 0.2, px * 0.22, px * 0.6, px * 0.56, px * 0.06); c.fill();
        c.strokeStyle = '#b9894a'; c.lineWidth = px * 0.04; c.stroke();
        c.beginPath(); c.moveTo(px * 0.5, px * 0.24); c.lineTo(px * 0.5, px * 0.76); c.stroke();
        c.fillStyle = '#ff9ec7'; c.font = `${px * 0.3}px serif`; c.textAlign = 'center'; c.fillText('✿', px * 0.5, px * 0.58);
    } else {
        // [head height above the feet, picture width in actor units, where the head sits in the picture]
        const [headY, span, at] = PORTRAIT[key] || [40, 52, 0.42];
        const sc = px / span;
        drawActor(c, key, px / 2, at * px + headY * sc, sc, { face, bob: 0 });
    }
    cache.set(id, cv);
    return cv;
}
