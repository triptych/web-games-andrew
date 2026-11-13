// Cartoon sprites, drawn in code: thick ink outlines, flat bright fills, one highlight each.
// Every function draws in world units around the origin; the caller sets up the transform.
// Walkers stand with their feet at (0, 0) and face right (+x); the caller flips them.

export const INK = '#1b1030';
const LW = 0.085;

export function shape(ctx, fill, lw = LW) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
export function ell(ctx, x, y, rx, ry, fill, lw, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); shape(ctx, fill, lw);
}
export function rr(ctx, x, y, w, h, r, fill, lw) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); shape(ctx, fill, lw);
}
function poly(ctx, pts, fill, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); shape(ctx, fill, lw);
}
function line(ctx, x1, y1, x2, y2, w = LW, col = INK) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
}
function eye(ctx, x, y, r, look = 0.3, blink = false) {
    if (blink) { line(ctx, x - r, y, x + r, y, 0.06); return; }
    ell(ctx, x, y, r, r * 1.15, '#fff', 0.05);
    ell(ctx, x + r * look, y + r * 0.1, r * 0.48, r * 0.55, INK, 0);
    ell(ctx, x + r * look + r * 0.15, y - r * 0.15, r * 0.14, r * 0.14, '#fff', 0);
}
function legs(ctx, xs, top, len, phase, col, w = 0.15) {
    xs.forEach((x, i) => {
        const sw = Math.sin(phase + i * Math.PI) * 0.12;
        line(ctx, x, top, x + sw, -0.02, w + LW * 2, INK);
        line(ctx, x, top, x + sw, -0.02, w, col);
    });
}
function dazedStars(ctx, y, t) {
    for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        star(ctx, Math.cos(a) * 0.5, y + Math.sin(a) * 0.15, 0.16, '#ffe14d');
    }
}
export function star(ctx, x, y, r, fill, lw = 0.04) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); shape(ctx, fill, lw);
}

// ------------------------------------------------------------------ livestock
export function cow(ctx, o) {
    const gold = o.gold;
    const body = gold ? '#ffd23f' : '#fffaf0', spot = gold ? '#e89a00' : '#2a2238';
    const ph = o.walk * 9;
    ctx.save();
    if (o.lift) ctx.rotate(Math.sin(o.t * 6) * 0.25);
    legs(ctx, [-0.5, -0.3, 0.35, 0.55], -0.5, 0.5, o.lift ? o.t * 14 : ph, body);
    line(ctx, -0.78, -0.8, -0.95, -0.45 + Math.sin(o.t * 3) * 0.05, 0.06);          // tail
    ell(ctx, 0, -0.78, 0.8, 0.42, body);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.78, 0.8, 0.42, 0, 0, Math.PI * 2); ctx.clip();
    ell(ctx, -0.3, -0.95, 0.28, 0.2, spot, 0); ell(ctx, 0.3, -0.6, 0.22, 0.17, spot, 0); ell(ctx, -0.55, -0.55, 0.15, 0.12, spot, 0);
    ctx.restore();
    ell(ctx, 0, -0.78, 0.8, 0.42, null);
    ell(ctx, -0.05, -0.42, 0.18, 0.08, '#ff9fb8', 0.05);                         // udder
    // head
    ctx.save(); ctx.translate(0.82, -1.0 + Math.sin(o.t * 2) * 0.02);
    poly(ctx, [-0.1, -0.25, -0.03, -0.45, 0.08, -0.25], gold ? '#fff2a8' : '#fff1c9', 0.05);   // horns
    poly(ctx, [0.18, -0.25, 0.28, -0.45, 0.34, -0.22], gold ? '#fff2a8' : '#fff1c9', 0.05);
    ell(ctx, -0.22, -0.12, 0.17, 0.08, body, 0.06, -0.4);                        // ear
    rr(ctx, -0.18, -0.3, 0.52, 0.55, 0.22, body);
    ell(ctx, 0.12, 0.17, 0.3, 0.17, '#ffb4c6');                                  // snout
    ell(ctx, 0.02, 0.17, 0.04, 0.05, INK, 0); ell(ctx, 0.22, 0.17, 0.04, 0.05, INK, 0);
    eye(ctx, 0.12, -0.1, 0.1, o.lift ? 0 : 0.4, o.blink);
    if (o.lift) { ell(ctx, 0.12, 0.33, 0.07, 0.06, INK, 0); }                 // "moo"
    ctx.restore();
    if (gold) for (let i = 0; i < 2; i++) star(ctx, Math.sin(o.t * 2 + i * 3) * 0.7, -1.4 - i * 0.2, 0.12, '#fff', 0.03);
    ctx.restore();
}

export function chicken(ctx, o) {
    const ph = o.walk * 16;
    ctx.save();
    if (o.lift) ctx.rotate(Math.sin(o.t * 12) * 0.3);
    legs(ctx, [-0.08, 0.1], -0.25, 0.25, o.lift ? o.t * 20 : ph, '#ffb02e', 0.06);
    ell(ctx, 0, -0.42, 0.3, 0.24, '#fffdf5');
    ell(ctx, -0.05, -0.42, 0.15, 0.1, '#f2eadb', 0.05, o.lift ? Math.sin(o.t * 30) : 0.3);   // wing
    ell(ctx, 0.2, -0.66, 0.15, 0.16, '#fffdf5');
    poly(ctx, [0.13, -0.8, 0.18, -0.9, 0.23, -0.82, 0.3, -0.88, 0.3, -0.76], '#ff3d3d', 0.04);   // comb
    poly(ctx, [0.33, -0.68, 0.46, -0.63, 0.33, -0.59], '#ffb02e', 0.04);
    ell(ctx, 0.31, -0.55, 0.04, 0.06, '#ff3d3d', 0.03);
    eye(ctx, 0.24, -0.7, 0.05, 0.5, o.blink);
    poly(ctx, [-0.28, -0.45, -0.42, -0.62, -0.36, -0.38], '#fffdf5', 0.05);       // tail
    ctx.restore();
}

export function pig(ctx, o) {
    const ph = o.walk * 11;
    ctx.save();
    if (o.lift) ctx.rotate(Math.sin(o.t * 7) * 0.25);
    legs(ctx, [-0.35, -0.18, 0.2, 0.36], -0.35, 0.35, o.lift ? o.t * 14 : ph, '#ff9ec0', 0.13);
    ctx.beginPath(); ctx.moveTo(-0.6, -0.6);                                       // curly tail
    ctx.bezierCurveTo(-0.8, -0.8, -0.85, -0.5, -0.7, -0.55); ctx.lineWidth = 0.05; ctx.strokeStyle = INK; ctx.stroke();
    ell(ctx, 0, -0.55, 0.62, 0.36, '#ffb3cf');
    ell(ctx, -0.15, -0.68, 0.2, 0.1, '#ffd0e2', 0);
    ell(ctx, 0.55, -0.62, 0.28, 0.27, '#ffb3cf');
    poly(ctx, [0.42, -0.85, 0.5, -1.02, 0.6, -0.84], '#ff9ec0', 0.05);
    ell(ctx, 0.8, -0.58, 0.1, 0.12, '#ff8fb3', 0.05);
    ell(ctx, 0.78, -0.62, 0.02, 0.035, INK, 0); ell(ctx, 0.83, -0.55, 0.02, 0.035, INK, 0);
    eye(ctx, 0.6, -0.7, 0.07, 0.5, o.blink);
    ctx.restore();
}

export function sheep(ctx, o) {
    const ph = o.walk * 10;
    ctx.save();
    if (o.lift) ctx.rotate(Math.sin(o.t * 6) * 0.2);
    legs(ctx, [-0.35, -0.15, 0.2, 0.38], -0.35, 0.35, o.lift ? o.t * 14 : ph, '#3a3048', 0.09);
    for (const [x, y, r] of [[-0.4, -0.6, 0.27], [-0.1, -0.78, 0.3], [0.22, -0.7, 0.28], [0.05, -0.45, 0.28], [-0.32, -0.38, 0.22], [0.35, -0.45, 0.22]]) ell(ctx, x, y, r, r * 0.9, '#fbf7ff');
    ell(ctx, 0.55, -0.72, 0.17, 0.24, '#3a3048');
    ell(ctx, 0.38, -0.78, 0.12, 0.06, '#3a3048', 0.05, 0.4);
    ell(ctx, 0.5, -0.92, 0.14, 0.1, '#fbf7ff', 0.05);
    eye(ctx, 0.6, -0.76, 0.06, 0.4, o.blink);
    ctx.restore();
}

// ------------------------------------------------------------------ people
function person(ctx, o, look) {
    // look: { pants, shirt, skin, hat: fn, extra: fn, arms: fn }
    const ph = o.walk * 10;
    ctx.save();
    if (o.lift) ctx.rotate(Math.sin(o.t * 5) * 0.35);
    legs(ctx, [-0.12, 0.12], -0.75, 0.75, o.lift ? o.t * 16 : ph, look.pants, 0.17);
    ell(ctx, -0.12, -0.04, 0.13, 0.06, INK, 0); ell(ctx, 0.15, -0.04, 0.13, 0.06, INK, 0);
    rr(ctx, -0.28, -1.35, 0.56, 0.7, 0.14, look.shirt);
    if (look.torso) look.torso(ctx);
    const panic = o.lift || o.flee;
    if (look.arms) look.arms(ctx, o);
    else {
        const a = panic ? -1.3 + Math.sin(o.t * 18) * 0.4 : 0.15 + Math.sin(ph) * 0.15;
        for (const s of [-1, 1]) {
            ctx.save(); ctx.translate(s * 0.24, -1.25); ctx.rotate(s * a);
            line(ctx, 0, 0, 0, 0.5, 0.15 + LW * 2); line(ctx, 0, 0, 0, 0.5, 0.15, look.shirt);
            ell(ctx, 0, 0.55, 0.08, 0.08, look.skin, 0.04);
            ctx.restore();
        }
    }
    ell(ctx, 0.03, -1.6, 0.27, 0.29, look.skin);
    if (look.face) look.face(ctx, o);
    else {
        eye(ctx, 0.12, -1.65, 0.07, 0.5, o.blink);
        eye(ctx, -0.04, -1.65, 0.07, 0.5, o.blink);
        if (panic) ell(ctx, 0.08, -1.45, 0.08, 0.09, INK, 0);
        else line(ctx, 0.0, -1.47, 0.16, -1.48, 0.04);
    }
    if (look.hat) look.hat(ctx, o);
    if (o.dazed) dazedStars(ctx, -2.05, o.t);
    ctx.restore();
}

const SKIN = ['#ffd2a6', '#e0a271', '#a8693f', '#f4c48f'];

export function farmer(ctx, o) {
    person(ctx, o, {
        pants: '#3c6cd6', shirt: '#e8473b', skin: SKIN[o.v % 4],
        torso: (c) => { rr(c, -0.24, -1.05, 0.48, 0.42, 0.06, '#3c6cd6', 0.05); line(c, -0.18, -1.05, -0.18, -1.3, 0.06, '#3c6cd6'); line(c, 0.18, -1.05, 0.18, -1.3, 0.06, '#3c6cd6'); },
        hat: (c) => { ell(c, 0.03, -1.8, 0.45, 0.08, '#f4d35e'); rr(c, -0.2, -2.05, 0.46, 0.27, 0.1, '#f4d35e'); line(c, -0.18, -1.84, 0.24, -1.84, 0.06, '#d14b3b'); },
    });
}

export function townie(ctx, o) {
    const shirts = ['#2ec4b6', '#ff8c42', '#9b5de5', '#f15bb5'];
    person(ctx, o, {
        pants: '#5a4b3c', shirt: shirts[o.v % 4], skin: SKIN[(o.v + 1) % 4],
        hat: (c) => { ell(c, -0.05, -1.82, 0.28, 0.14, ['#5b3a1a', '#f6d860', '#1b1030', '#c0392b'][o.v % 4], 0.05); },
    });
}

export function gunner(ctx, o) {
    const aim = o.wind ? -1.1 : -0.5;
    person(ctx, o, {
        pants: '#3c6cd6', shirt: '#7c5c3e', skin: '#ffd2a6',
        torso: (c) => { rr(c, -0.24, -1.05, 0.48, 0.42, 0.06, '#3c6cd6', 0.05); },
        arms: (c) => {
            c.save(); c.translate(0.1, -1.15); c.rotate(aim);
            rr(c, -0.1, -0.07, 1.25, 0.14, 0.05, '#5b3a1a', 0.05);                // shotgun
            rr(c, 0.55, -0.06, 0.75, 0.1, 0.03, '#8d99ae', 0.05);
            if (o.wind) { star(c, 1.45, 0, 0.18 + Math.sin(o.t * 40) * 0.05, '#fff36b'); }
            c.restore();
        },
        face: (c) => {
            eye(c, 0.12, -1.65, 0.07, 0.6, false);
            line(c, 0.04, -1.76, 0.2, -1.72, 0.05);                                  // angry brow
            ell(c, 0.06, -1.42, 0.2, 0.12, '#cfcfcf', 0.05);                         // beard
        },
        hat: (c) => { ell(c, 0.03, -1.82, 0.38, 0.07, '#a0522d'); rr(c, -0.17, -2.0, 0.4, 0.2, 0.08, '#a0522d'); },
    });
}

export function agent(ctx, o) {
    person(ctx, o, {
        pants: '#15121c', shirt: '#15121c', skin: SKIN[o.v % 4],
        torso: (c) => { poly(c, [-0.1, -1.35, 0.1, -1.35, 0, -1.05], '#fff', 0.03); poly(c, [-0.03, -1.3, 0.03, -1.3, 0.04, -1.0, 0, -0.95, -0.04, -1.0], INK, 0); },
        arms: o.dazed || o.lift ? null : (c) => {
            c.save(); c.translate(0.15, -1.15); c.rotate(o.wind ? -0.9 : -0.2);
            line(c, 0, 0, 0.45, 0, 0.15 + LW * 2); line(c, 0, 0, 0.45, 0, 0.15, '#15121c');
            rr(c, 0.35, -0.12, 0.45, 0.2, 0.05, '#9aa3b5', 0.05);                      // net gun
            ell(c, 0.82, -0.02, 0.09, 0.12, '#5ecbff', 0.04);
            c.restore();
        },
        face: (c, oo) => {
            rr(c, -0.17, -1.72, 0.42, 0.13, 0.05, INK, 0);                           // sunglasses
            line(c, 0.0, -1.47, 0.16, -1.47, 0.04);
            if (oo.dazed) ell(c, 0.08, -1.45, 0.07, 0.08, INK, 0);
            c.fillStyle = '#7fd7ff'; c.fillRect(0.1, -1.7, 0.07, 0.03);
        },
        hat: (c) => { ell(c, 0.0, -1.83, 0.3, 0.14, '#15121c', 0.05); },
    });
}

export function tinfoil(ctx, o) {
    person(ctx, o, {
        pants: '#6b8f3a', shirt: '#4cb944', skin: '#ffd2a6',
        arms: (c, oo) => {
            const up = oo.wind ? 1 : 0;
            c.save(); c.translate(0.18, -1.2); c.rotate(-0.9 * up - 0.2);
            line(c, 0, 0, 0.4, 0, 0.15 + LW * 2); line(c, 0, 0, 0.4, 0, 0.15, '#4cb944');
            rr(c, 0.3, -0.18, 0.4, 0.3, 0.05, '#2b2b2b', 0.05);                         // camera
            ell(c, 0.5, -0.03, 0.09, 0.09, '#8fd3ff', 0.03);
            rr(c, 0.33, -0.27, 0.15, 0.1, 0.02, '#ddd', 0.03);
            if (oo.wind) star(c, 0.5, -0.4, 0.15 + (Math.sin(oo.t * 30) + 1) * 0.08, '#fff', 0.03);
            c.restore();
        },
        face: (c, oo) => {
            eye(c, 0.14, -1.64, 0.09, Math.sin(oo.t * 3) * 0.6, false);
            eye(c, -0.06, -1.64, 0.07, -Math.sin(oo.t * 3) * 0.6, false);              // one wide eye, one squint
            c.beginPath(); c.arc(0.06, -1.47, 0.08, 0, Math.PI); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke();
        },
        hat: (c, oo) => {
            const g = c.createLinearGradient(-0.3, -2.4, 0.3, -1.8);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#a9b4c2'); g.addColorStop(1, '#e8eef5');
            poly(c, [-0.3, -1.78, 0.36, -1.78, 0.05, -2.45 - Math.sin(oo.t * 8) * 0.03], g);
            line(c, -0.1, -2.0, 0.1, -2.1, 0.03, '#7d8794'); line(c, 0.0, -1.9, 0.2, -2.0, 0.03, '#7d8794');
        },
    });
}

// ------------------------------------------------------------------ the army
export function tank(ctx, o) {
    ctx.save();
    rr(ctx, -1.4, -0.55, 2.8, 0.55, 0.27, '#3b3b2e');                               // treads
    for (let i = 0; i < 5; i++) {
        const x = -1.1 + i * 0.55;
        ell(ctx, x, -0.27, 0.19, 0.19, '#7a7a68', 0.05);
        line(ctx, x, -0.27, x + Math.cos(o.t * 6 * o.dir + i) * 0.15, -0.27 + Math.sin(o.t * 6 * o.dir + i) * 0.15, 0.04);
    }
    rr(ctx, -1.25, -1.05, 2.5, 0.55, 0.12, '#6b8e23');
    star(ctx, -0.6, -0.78, 0.17, '#fff', 0.03);
    ctx.save(); ctx.translate(0.1, -1.15); ctx.rotate(o.aim);
    rr(ctx, 0, -0.1, 1.5, 0.2, 0.06, '#556b2f');
    rr(ctx, 1.35, -0.14, 0.25, 0.28, 0.05, '#3b3b2e');
    if (o.wind) star(ctx, 1.75, 0, 0.18 + Math.sin(o.t * 40) * 0.06, '#ffec5c');
    ctx.restore();
    ell(ctx, 0.1, -1.2, 0.62, 0.35, '#7fa33a');
    rr(ctx, -0.15, -1.62, 0.4, 0.15, 0.05, '#556b2f', 0.05);
    ctx.restore();
}

export function laser(ctx, o) {
    rr(ctx, -0.9, -0.5, 1.8, 0.5, 0.08, '#5d6470');
    poly(ctx, [-0.9, -0.5, 0.9, -0.5, 0.6, -0.8, -0.6, -0.8], '#8a94a6');
    for (let i = -1; i <= 1; i++) rr(ctx, i * 0.5 - 0.12, -0.32, 0.24, 0.18, 0.04, (o.wind && Math.floor(o.t * 10) % 2) ? '#ff3b3b' : '#ffd23f', 0.04);
    rr(ctx, -0.18, -1.45, 0.36, 0.7, 0.08, '#9aa3b5');
    ell(ctx, 0, -1.55, 0.45, 0.16, '#c7cfdc');
    ell(ctx, 0, -1.6, 0.18, 0.08, o.wind ? '#ff4d4d' : '#ff9e9e', 0.04);
    if (o.wind) ell(ctx, 0, -1.62, 0.3 + Math.sin(o.t * 30) * 0.08, 0.12, 'rgba(255,60,60,0.5)', 0);
}

export function boss(ctx, o) {
    // The Buzzkill 9000: General Grumbles in a tank the size of a barn
    ctx.save();
    const shake = o.inv > 0 ? Math.sin(o.t * 60) * 0.08 : 0;
    ctx.translate(shake, 0);
    rr(ctx, -2.9, -1.0, 5.8, 1.0, 0.5, '#2f2f26');
    for (let i = 0; i < 7; i++) {
        const x = -2.4 + i * 0.8;
        ell(ctx, x, -0.5, 0.33, 0.33, '#77776a', 0.06);
        line(ctx, x, -0.5, x + Math.cos(o.t * 4 * o.dir + i) * 0.26, -0.5 + Math.sin(o.t * 4 * o.dir + i) * 0.26, 0.05);
    }
    rr(ctx, -2.7, -2.4, 5.4, 1.45, 0.3, '#5c7d1e');
    for (let i = 0; i < 6; i++) rr(ctx, -2.3 + i * 0.85, -2.1, 0.35, 0.35, 0.08, i < o.hp ? '#ff3b3b' : '#3a3a3a', 0.05);   // hp lights
    ctx.save(); ctx.translate(0, -2.75); ctx.rotate(o.aim);
    for (const dy of [-0.32, 0, 0.32]) rr(ctx, 0, dy - 0.11, 2.6, 0.22, 0.07, '#475e19');
    ctx.restore();
    rr(ctx, -1.6, -3.4, 3.2, 1.1, 0.4, '#6f9628');
    // the General in his hatch
    ell(ctx, 0.2, -3.75, 0.48, 0.45, '#ffcfa6');
    ell(ctx, 0.2, -4.05, 0.62, 0.28, '#4b6b19');
    rr(ctx, -0.42, -4.1, 1.24, 0.2, 0.08, '#4b6b19');
    star(ctx, 0.2, -4.12, 0.14, '#ffd23f', 0.03);
    eye(ctx, 0.36, -3.75, 0.08, 0.3, false); eye(ctx, 0.08, -3.75, 0.08, 0.3, false);
    line(ctx, 0.0, -3.9, 0.22, -3.84, 0.05); line(ctx, 0.28, -3.84, 0.5, -3.9, 0.05);
    ctx.beginPath(); ctx.ellipse(0.2, -3.55, 0.36, 0.12, 0, Math.PI, 0, true);
    shape(ctx, '#e8e8e8', 0.05);                                                  // mustache
    if (o.wind) star(ctx, 2.9, -2.75, 0.3, '#ffec5c');
    ctx.restore();
}

export function jet(ctx, o) {
    ctx.save();
    poly(ctx, [-1.6, 0.05, 1.5, 0.15, 1.9, 0.0, 1.5, -0.2, -1.4, -0.25], '#a7b4c4');
    poly(ctx, [-0.2, -0.05, 0.6, -0.05, -0.6, 0.65, -0.95, 0.65], '#8796aa');
    poly(ctx, [-1.4, -0.2, -0.95, -0.2, -1.55, -0.85, -1.8, -0.85], '#8796aa');
    ell(ctx, 0.95, -0.2, 0.42, 0.14, '#79d4ff', 0.05);
    star(ctx, -0.4, -0.05, 0.13, '#fff', 0.03);
    ell(ctx, -1.85, -0.05, 0.3 + Math.sin(o.t * 50) * 0.08, 0.12, '#ffb03b', 0);
    ctx.restore();
}

// ------------------------------------------------------------------ the saucer
export function ufo(ctx, o) {
    // Zib's Model 7-B: one dent, one duct-tape patch, one antenna that won't stay straight
    ctx.save();
    ctx.rotate(o.tilt);
    // dome and pilot
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, -0.32, 0.62, 0.62, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(150, 236, 255, 0.55)'; ctx.fill();
    ctx.clip();
    ell(ctx, 0.05, -0.55, 0.3, 0.3, '#7ee05b', 0.06);                               // Zib
    eye(ctx, 0.1, -0.6, 0.15, o.lookX, o.blink);
    if (o.hurt) { line(ctx, -0.02, -0.75, 0.24, -0.7, 0.05); }
    ctx.beginPath(); ctx.arc(0.08, -0.4, 0.09, 0.1, Math.PI - 0.1); ctx.lineWidth = 0.04; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    line(ctx, 0.0, -0.82, -0.1 + Math.sin(o.t * 5) * 0.08, -1.2, 0.05);              // wonky antenna
    ell(ctx, -0.1 + Math.sin(o.t * 5) * 0.08, -1.22, 0.07, 0.07, o.glitch ? '#ff3b3b' : '#ffe14d', 0.04);
    ctx.beginPath(); ctx.ellipse(0, -0.32, 0.62, 0.62, 0, Math.PI, 0); ctx.closePath();
    shape(ctx, null);
    ell(ctx, -0.3, -0.6, 0.1, 0.18, 'rgba(255,255,255,0.7)', 0, 0.5);
    // hull
    ell(ctx, 0, 0, 1.3, 0.38, o.hullCol || '#c9c6e8');
    ell(ctx, 0, -0.09, 1.1, 0.16, '#e9e6ff', 0);
    ell(ctx, 0, 0.18, 0.62, 0.15, '#8b86b8', 0.06);
    // rim lights
    for (let i = 0; i < 6; i++) {
        const x = -1.0 + i * 0.4;
        const on = (Math.floor(o.t * 8) + i) % 3 === 0;
        ell(ctx, x, 0.04, 0.08, 0.07, on ? ['#ff4d6d', '#ffe14d', '#4dd2ff'][i % 3] : '#5a557a', 0.03);
    }
    // the dent and the tape
    ctx.beginPath(); ctx.arc(0.75, -0.08, 0.13, 0.2, Math.PI - 0.2); ctx.lineWidth = 0.04; ctx.strokeStyle = '#6f6a99'; ctx.stroke();
    ctx.save(); ctx.translate(-0.62, 0.02); ctx.rotate(0.6);
    rr(ctx, -0.18, -0.05, 0.36, 0.1, 0.01, '#b8b8b8', 0.03); ctx.rotate(-1.2); rr(ctx, -0.18, -0.05, 0.36, 0.1, 0.01, '#c8c8c8', 0.03);
    ctx.restore();
    ctx.restore();
}

// ------------------------------------------------------------------ the Mother Ship
export function motherFace(ctx, t, mood = 0) {
    // a big-hearted, big-haired alien matriarch with cat-eye glasses
    ell(ctx, 0, -1.25, 1.05, 0.95, '#c86bfa');                                       // beehive
    ell(ctx, -0.35, -1.5, 0.3, 0.25, '#dd8cff', 0);
    ell(ctx, 0, 0, 0.9, 0.85, '#8ff07a');
    for (const s of [-1, 1]) {                                                       // antennae curls
        ctx.beginPath(); ctx.moveTo(s * 0.4, -2.0); ctx.quadraticCurveTo(s * 0.7, -2.6, s * 0.45, -2.55);
        ctx.lineWidth = 0.07; ctx.strokeStyle = INK; ctx.stroke();
        star(ctx, s * 0.45, -2.6, 0.13, '#ffe14d', 0.04);
    }
    const blink = Math.sin(t * 1.3) > 0.97;
    for (const s of [-1, 1]) {
        poly(ctx, [s * 0.05, -0.25, s * 0.62, -0.42, s * 0.75, -0.05, s * 0.12, 0.05], '#ff4fb0', 0.06);   // cat-eye glasses
        eye(ctx, s * 0.37, -0.17, 0.14, 0.2, blink);
    }
    line(ctx, -0.05, -0.2, 0.05, -0.2, 0.06);
    // lips: a smile or a frown with the mood
    ctx.beginPath();
    if (mood >= 0) ctx.ellipse(0, 0.42, 0.28, 0.14 + mood * 0.06, 0, 0, Math.PI);
    else ctx.ellipse(0, 0.55, 0.26, 0.1, 0, Math.PI, 0);
    shape(ctx, '#ff3b6b', 0.06);
    ell(ctx, -0.52, 0.2, 0.12, 0.07, 'rgba(255, 120, 170, 0.6)', 0);
    ell(ctx, 0.52, 0.2, 0.12, 0.07, 'rgba(255, 120, 170, 0.6)', 0);
    rr(ctx, -0.25, 0.83, 0.5, 0.18, 0.06, '#ffe14d', 0.05);                         // pearl collar
}

export function motherShip(ctx, o) {
    ctx.save();
    // lower hull and lights
    ell(ctx, 0, 0.6, 7.2, 1.6, '#7c4dff');
    ell(ctx, 0, 0.25, 6.6, 0.9, '#9c7bff', 0);
    for (let i = 0; i < 13; i++) {
        const x = -6 + i * 1.0;
        const on = (Math.floor(o.t * 4) + i) % 4 < 2;
        ell(ctx, x, 1.05 - Math.abs(x) * 0.05, 0.2, 0.16, on ? ['#ffe14d', '#ff4fb0', '#4dd2ff'][i % 3] : '#4a3a8a', 0.04);
    }
    ell(ctx, 0, 1.75, 2.2, 0.5, '#5a35c8');
    ell(ctx, 0, 1.85, 1.6, 0.32, o.dock ? '#b9ffef' : '#7ff5d4', 0.06);         // intake
    // the dome, with Mother in it
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, -0.2, 3.0, 2.7, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(150, 236, 255, 0.45)'; ctx.fill(); ctx.clip();
    ctx.translate(0, -0.9); ctx.scale(1.15, 1.15);
    motherFace(ctx, o.t, o.mood);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -0.2, 3.0, 2.7, 0, Math.PI, 0); ctx.closePath(); shape(ctx, null, 0.1);
    ell(ctx, -1.6, -1.8, 0.3, 0.7, 'rgba(255,255,255,0.55)', 0, 0.6);
    ctx.restore();
}

// ------------------------------------------------------------------ pickups
export function pickup(ctx, kind, t) {
    ell(ctx, 0, 0, 0.62, 0.62, 'rgba(255, 255, 255, 0.35)', 0.06);
    ctx.save();
    ctx.rotate(Math.sin(t * 2) * 0.2);
    if (kind === 'wrench') {
        rr(ctx, -0.07, -0.2, 0.14, 0.58, 0.05, '#c0c8d4', 0.05);
        ell(ctx, 0, -0.27, 0.2, 0.17, '#c0c8d4', 0.05);
        rr(ctx, -0.06, -0.48, 0.12, 0.17, 0.02, 'rgba(255,255,255,0.0)', 0);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-0.06, -0.47, 0.12, 0.14);
    } else if (kind === 'tape') {
        ell(ctx, 0, 0, 0.36, 0.36, '#b5bcc6'); ell(ctx, 0, 0, 0.17, 0.17, '#f3e1c0', 0.05);
        rr(ctx, 0.2, 0.15, 0.3, 0.13, 0.02, '#b5bcc6', 0.04);
    } else if (kind === 'turbo') {
        poly(ctx, [-0.15, -0.4, 0.2, -0.05, 0.02, -0.03, 0.15, 0.4, -0.22, 0.02, -0.04, 0.0], '#ffcf33');
    } else if (kind === 'mega') {
        poly(ctx, [-0.12, -0.3, 0.12, -0.3, 0.38, 0.32, -0.38, 0.32], 'rgba(170, 255, 120, 0.85)');
        ell(ctx, 0, -0.33, 0.3, 0.1, '#c9c6e8', 0.05);
    } else if (kind === 'shield') {
        ell(ctx, 0, 0, 0.4, 0.4, 'rgba(110, 200, 255, 0.6)', 0.06);
        ell(ctx, -0.12, -0.14, 0.1, 0.06, '#fff', 0, -0.6);
    } else if (kind === 'clock') {
        ell(ctx, 0, 0, 0.38, 0.38, '#fff');
        line(ctx, 0, 0, 0, -0.25, 0.06); line(ctx, 0, 0, Math.cos(t * 4) * 0.2, Math.sin(t * 4) * 0.2, 0.05);
        ell(ctx, -0.25, -0.33, 0.1, 0.07, '#ff4d4d', 0.04); ell(ctx, 0.25, -0.33, 0.1, 0.07, '#ff4d4d', 0.04);
    } else if (kind === 'star') {
        star(ctx, 0, 0, 0.42, '#ffd23f', 0.06);
    }
    ctx.restore();
}
