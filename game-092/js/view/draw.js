// Pixel drawing for NEONFALL. Everything is drawn into a 320×180 canvas with fillRect, so the
// pixels stay square when the view scales it up. No image files: Harry, the logs, the crocodiles
// and the treasure are all built from rectangles, scanline discs and Bresenham lines.

export const C = {
    ink: '#07020f', void: '#0b0418', plum: '#1a0838', violet: '#3a0b63', purple: '#5f1fa8', indigo: '#2a0f55',
    magenta: '#ff2a9d', pink: '#ff6ec7', cyan: '#25f4ee', ice: '#b9fbff', yellow: '#ffe66d', gold: '#ffc233',
    orange: '#ff8a2b', red: '#ff3355', green: '#3dff9a', lime: '#b6ff3b', white: '#ffffff', sand: '#ffb347',
    brick: '#c2185b', brickD: '#5a0a35', wood: '#7a3b1d', woodL: '#d98a45', rope: '#e8d28a',
};

export const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

export function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r + 0.5 - dy * dy));
        g.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
    }
}

export function line(g, x0, y0, x1, y1, c, t = 1) {
    g.fillStyle = c;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 400; i++) {
        g.fillRect(x0, y0, t, t);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

const fl = (n) => Math.floor(n);
export const tri = (t, p = 1) => Math.abs(((t / p) % 2 + 2) % 2 - 1);   // 0..1..0 triangle wave

// ------------------------------------------------------------------ Harry
/**
 * o = { face, pose, ph, t, vx, tint, alpha, sx, sy }
 * pose: stand run air vine ladder stun. Origin is the middle of his feet; y is up-negative.
 */
export function drawHarry(g, x, y, o) {
    const f = o.face >= 0 ? 1 : -1;
    const T = o.tint || null;
    const col = (c) => T || c;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.scale(f * (o.sx || 1), o.sy || 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    const R = (rx, ry, w, h, c) => { g.fillStyle = col(c); g.fillRect(rx, ry, w, h); };
    const L = (x0, y0, x1, y1, c, t = 2) => line(g, x0, y0, x1, y1, col(c), t);

    const ph = o.ph || 0;
    let fa = [-1.5, 0], fb = [1.5, 0], ha = [-4, -9], hb = [4, -9];
    let torso = 6;
    switch (o.pose) {
        case 'run': {
            const s = Math.sin(ph), c = Math.cos(ph);
            fa = [s * 4.5, -Math.max(0, c) * 3.5]; fb = [-s * 4.5, -Math.max(0, -c) * 3.5];
            ha = [-s * 4, -10]; hb = [s * 4, -10];
            break;
        }
        case 'air': fa = [3.5, -6]; fb = [-3, -3]; ha = [4.5, -18]; hb = [-4, -16]; break;
        case 'fall': fa = [2, -1]; fb = [-2, -1]; ha = [5, -14]; hb = [-5, -14]; break;
        case 'vine': {
            const sw = Math.sin(ph) * 2;
            fa = [2 + sw, -1]; fb = [-2 + sw, -2]; ha = [2, -13]; hb = [3, -15];
            break;
        }
        case 'ladder': {
            const s = Math.sin(ph);
            fa = [-2, -2 - (s > 0 ? 3 : 0)]; fb = [2, -2 - (s > 0 ? 0 : 3)];
            ha = [-3, -14 - (s > 0 ? 0 : 3)]; hb = [3, -14 - (s > 0 ? 3 : 0)];
            torso = 5;
            break;
        }
        case 'stun': fa = [-3, 0]; fb = [3, 0]; ha = [-5, -12]; hb = [5, -12]; break;
        default: break;
    }
    // back arm, back leg
    L(0, -12, hb[0] - 0.5, hb[1], '#1fb5b0', 2);
    L(0, -8, fb[0], fb[1] - 1, '#6a1fc2', 2);
    R(fb[0] - 2, fb[1] - 1, 4, 2, '#d96a10');
    // scarf: a neon streamer that trails behind
    if (o.pose !== 'ladder') {
        const lag = Math.max(-1, Math.min(1, (o.vx || 0) / 80));
        for (let i = 0; i < 4; i++) {
            const sy = -13 + Math.sin((o.t || 0) * 14 - i * 1.2) * 1.4 - (o.pose === 'air' ? i * 0.4 : 0);
            R(-3 - i * 2 - (lag > 0 ? i * lag : 0), Math.round(sy), 2, 1, i % 2 ? '#ff6ec7' : '#ff2a9d');
        }
    }
    // torso: jacket, stripe, belt
    R(-torso / 2, -14, torso, 6, '#25d7e8');
    R(-torso / 2, -14, torso, 1, '#b9fbff');
    R(-torso / 2, -9, torso, 1, '#ff2a9d');
    // legs (front)
    L(0, -8, fa[0], fa[1] - 1, '#8a2fff', 2);
    R(fa[0] - 2, fa[1] - 1, 4, 2, '#ff8a2b');
    // head
    R(-2, -18, 5, 4, '#ffc9a0');
    R(1, -17, 1, 1, '#07020f');                  // eye
    R(-2, -18, 1, 3, '#7a3b1d');                 // hair at the back
    // pith hat: brim and crown with a neon band
    R(-4, -19, 9, 1, '#ff2a9d');
    R(-3, -22, 6, 3, '#ff6ec7');
    R(-3, -20, 6, 1, '#25f4ee');
    // front arm
    L(0, -12, ha[0] + 0.5, ha[1], '#25d7e8', 2);
    R(ha[0] - 1, ha[1] - 1, 2, 2, '#ffc9a0');
    g.restore();
}

// ------------------------------------------------------------------ hazards
export function drawLog(g, x, y, ang) {
    // shadow
    g.globalAlpha = 0.35; px(g, x - 7, y - 1, 14, 2, '#000'); g.globalAlpha = 1;
    disc(g, x, y - 6, 6, '#3a1608');
    disc(g, x, y - 6, 5, C.wood);
    disc(g, x, y - 6, 3, '#9a5a2c');
    disc(g, x, y - 6, 1, '#3a1608');
    // bark knots rolling round the rim
    for (let k = 0; k < 3; k++) {
        const a = ang + k * 2.094;
        px(g, x + Math.cos(a) * 4.2, y - 6 + Math.sin(a) * 4.2, 1, 1, C.woodL);
    }
    // neon rim, top-lit
    px(g, x - 2, y - 12, 4, 1, C.orange);
    px(g, x - 4, y - 11, 1, 1, C.orange); px(g, x + 3, y - 11, 1, 1, C.orange);
}

export function drawCobra(g, x, y, t, id) {
    const sw = Math.sin(t * 3 + id) * 2, pulse = tri(t * 1.6 + id);
    g.globalAlpha = 0.35; px(g, x - 7, y - 1, 14, 2, '#000'); g.globalAlpha = 1;
    px(g, x - 6, y - 3, 12, 3, '#4a12a8'); px(g, x - 6, y - 3, 12, 1, '#8a4dff');
    px(g, x - 5, y - 6, 10, 3, '#5b1fc8'); px(g, x - 5, y - 6, 10, 1, '#a77bff');
    px(g, x - 3 + sw * 0.3, y - 9, 6, 3, '#4a12a8');
    // neck and hood
    px(g, x - 1 + sw * 0.5, y - 13, 3, 5, '#5b1fc8');
    const hw = 4 + Math.round(pulse * 1.5);
    px(g, x - hw + sw * 0.6, y - 15, hw * 2 + 1, 4, '#7a35ff');
    px(g, x - hw + 1 + sw * 0.6, y - 15, hw * 2 - 1, 1, '#c9a8ff');
    px(g, x - 1 + sw * 0.6, y - 13, 3, 2, '#ffe66d');               // hood pattern
    // head
    px(g, x - 2 + sw, y - 17, 5, 3, '#6b28e0');
    px(g, x - 1 + sw, y - 16, 1, 1, C.red); px(g, x + 2 + sw, y - 16, 1, 1, C.red);
    if (tri(t * 2.2 + id * 0.7) > 0.8) px(g, x + 1 + sw, y - 14, 1, 2, C.pink);   // tongue
}

export function drawFire(g, x, y, t, id) {
    g.globalAlpha = 0.35; px(g, x - 8, y - 1, 16, 2, '#000'); g.globalAlpha = 1;
    line(g, x - 6, y - 2, x + 6, y - 1, '#5a2a12', 2);
    line(g, x - 6, y - 1, x + 6, y - 3, '#7a3b1d', 2);
    for (let k = -2; k <= 2; k++) {
        const fh = 5 + Math.abs(Math.sin(t * 13 + k * 2.1 + id)) * 6 - Math.abs(k) * 1.2;
        px(g, x + k * 2 - 1, y - 3 - fh, 3, fh, '#ff4d1a');
        px(g, x + k * 2 - 1, y - 3 - fh * 0.75, 2, fh * 0.75, C.orange);
        px(g, x + k * 2, y - 3 - fh * 0.5, 1, fh * 0.5, C.yellow);
    }
    px(g, x - 1, y - 6, 2, 3, C.white);
}

export function drawCroc(g, c, openAmt, warn, t) {
    // openAmt 0 (shut) … 1 (wide). The head is the floor when shut: its top is at the surface.
    const x = c.x, y = c.sy;
    // body trailing under the water
    px(g, x - 15, y + 1, 30, 6, '#15904f');
    px(g, x - 15, y + 1, 30, 1, '#3dff9a');
    for (let k = -12; k <= 12; k += 6) px(g, x + k, y - 1, 3, 2, '#0f6f3b');      // back ridges
    if (openAmt < 0.1) {
        px(g, x - 15, y - 1, 30, 4, '#1fa860');
        px(g, x - 15, y - 1, 30, 1, '#7dffb8');
        px(g, x + 11, y - 3, 4, 2, '#1fa860');                                       // eye bump
        px(g, x + 12, y - 3, 2, 1, warn ? C.red : C.yellow);
        for (let k = -13; k < 13; k += 4) px(g, x + k, y + 3, 2, 1, C.white);        // teeth showing
        px(g, x - 14, y, 2, 1, '#0b5a30');
    } else {
        const lift = Math.round(openAmt * 9);
        // lower jaw
        px(g, x - 15, y + 1, 30, 3, '#1fa860');
        for (let k = -13; k < 14; k += 4) px(g, x + k, y - 1, 2, 2, C.white);
        // upper jaw swung up around the back hinge
        px(g, x - 15, y - 1 - lift, 30, 3, '#1fa860');
        px(g, x - 15, y - 1 - lift, 30, 1, '#7dffb8');
        for (let k = -13; k < 14; k += 4) px(g, x + k, y + 2 - lift, 2, 2, C.white);
        px(g, x - 15, y - lift, 2, lift + 2, '#15904f');
        px(g, x + 10, y - 3 - lift, 4, 2, '#1fa860'); px(g, x + 11, y - 3 - lift, 2, 1, C.red);
        px(g, x - 12, y + 1 - lift / 2, 24, Math.max(1, lift - 1), '#4a0618');      // the mouth
    }
}

export function drawScorpion(g, x, y, dir, t) {
    const lg = Math.floor(t * 9) % 2;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.scale(dir >= 0 ? 1 : -1, 1);
    px(g, -6, -1, 12, 1, 'rgba(0,0,0,0.4)');
    // legs
    for (let k = 0; k < 4; k++) px(g, -3 + k * 2, -2 + ((k + lg) % 2 ? 0 : -1), 1, 2, '#c43a10');
    // body
    px(g, -4, -5, 8, 3, '#ff5533'); px(g, -4, -5, 8, 1, '#ff9a6b');
    px(g, 2, -6, 3, 3, '#ff5533');
    px(g, 4, -5, 1, 1, C.cyan);
    // claws
    px(g, 5, -6, 3, 1, '#ff7a55'); px(g, 6, -4, 3, 1, '#ff7a55'); px(g, 8, -7, 1, 2, '#ff7a55');
    // tail arching over the body
    px(g, -5, -6, 2, 2, '#ff5533'); px(g, -6, -9, 2, 3, '#ff5533'); px(g, -4, -11, 3, 2, '#ff5533');
    px(g, -1, -11, 2, 2, '#ff5533'); px(g, 1, -9, 1, 2, C.yellow);
    g.restore();
}

// ------------------------------------------------------------------ treasure
export function drawTreasure(g, kind, x, y, t, id) {
    const by = y + Math.sin(t * 3 + id) * 1.4;
    g.globalAlpha = 0.35; px(g, x - 6, y - 1, 12, 2, '#000'); g.globalAlpha = 1;
    if (kind === 0) {                                        // money bag
        disc(g, x, by - 6, 5, '#13a85c'); disc(g, x, by - 6, 4, '#2fe085');
        px(g, x - 2, by - 12, 5, 2, '#13a85c'); px(g, x - 3, by - 11, 7, 1, C.yellow);
        px(g, x - 1, by - 8, 3, 1, '#0b6a38'); px(g, x - 1, by - 6, 3, 1, '#0b6a38'); px(g, x - 1, by - 4, 3, 1, '#0b6a38');
        px(g, x, by - 9, 1, 7, '#0b6a38');
    } else if (kind === 1) {                                 // silver bars
        px(g, x - 6, by - 4, 12, 4, '#8fb4d9'); px(g, x - 6, by - 4, 12, 1, C.white); px(g, x - 5, by - 3, 3, 1, '#d6ecff');
        px(g, x - 4, by - 8, 10, 4, '#a9cbe8'); px(g, x - 4, by - 8, 10, 1, C.white); px(g, x - 3, by - 7, 3, 1, '#e8f6ff');
    } else if (kind === 2) {                                 // gold bars
        px(g, x - 7, by - 3, 14, 3, '#e09a12'); px(g, x - 7, by - 3, 14, 1, C.yellow);
        px(g, x - 5, by - 6, 10, 3, '#f3b61f'); px(g, x - 5, by - 6, 10, 1, C.yellow);
        px(g, x - 3, by - 9, 7, 3, '#ffd23f'); px(g, x - 3, by - 9, 7, 1, C.white);
    } else {                                                 // diamond ring
        disc(g, x, by - 4, 4, C.gold); disc(g, x, by - 4, 2, '#0b0418');
        px(g, x - 2, by - 10, 5, 1, C.ice); px(g, x - 3, by - 9, 7, 2, C.cyan); px(g, x - 2, by - 7, 5, 1, '#16b8c8');
        px(g, x, by - 11, 1, 1, C.white);
        if (tri(t * 2 + id) > 0.85) { px(g, x - 5, by - 9, 3, 1, C.white); px(g, x + 3, by - 9, 3, 1, C.white); px(g, x, by - 13, 1, 3, C.white); }
    }
}

// ------------------------------------------------------------------ vine and ladder, bricks
export function drawVine(g, v, th, t) {
    const bx = v.x + Math.sin(th) * v.L, by = v.y0 + Math.cos(th) * v.L;
    // a bough the vine hangs from
    px(g, v.x - 9, v.y0 - 4, 18, 4, '#1a0838'); px(g, v.x - 9, v.y0 - 4, 18, 1, '#3dff9a');
    disc(g, v.x, v.y0, 2, C.green);
    // the rope, in segments so it reads as swinging
    const n = 10;
    let lx = v.x, ly = v.y0;
    for (let i = 1; i <= n; i++) {
        const s = (i / n) * v.L;
        const sag = Math.sin((i / n) * Math.PI) * -Math.sin(th) * 1.5;   // trails behind the swing
        const nx = v.x + Math.sin(th) * s + sag, ny = v.y0 + Math.cos(th) * s;
        line(g, lx, ly, nx, ny, i % 2 ? C.rope : '#b59a52', 1);
        lx = nx; ly = ny;
    }
    px(g, bx - 1, by, 3, 3, C.yellow);
    return { x: bx, y: by };
}

export function drawLadder(g, ly0, ly1, x) {
    px(g, x - 5, ly0, 2, ly1 - ly0, '#c2761a'); px(g, x + 4, ly0, 2, ly1 - ly0, '#c2761a');
    px(g, x - 5, ly0, 1, ly1 - ly0, '#ffb347'); px(g, x + 4, ly0, 1, ly1 - ly0, '#ffb347');
    for (let y = ly0 + 3; y < ly1; y += 6) { px(g, x - 3, y, 7, 2, '#8a4b14'); px(g, x - 3, y, 7, 1, '#ffb347'); }
}

export function drawWall(g, x, y0, y1) {
    px(g, x, y0, 12, y1 - y0, C.brickD);
    for (let y = y0, row = 0; y < y1; y += 6, row++) {
        px(g, x, y, 12, 5, C.brick);
        px(g, x, y, 12, 1, '#ff6b9a');
        const off = row % 2 ? 0 : 5;
        px(g, x + off, y, 1, 5, C.brickD);
        px(g, x + off + 6, y, 1, 5, C.brickD);
    }
    px(g, x - 1, y0, 1, y1 - y0, '#ff2a9d');
}
