// Roadside props, buildings and the caravan's carts, all drawn in code. Props are billboards: they get a
// screen position for their base and a scale in pixels per world unit. Carts are real boxes, projected
// corner by corner through the road's own projection, so they turn with the road and shrink into the distance.

const TAU = Math.PI * 2;

/** Darken (k < 0) or lighten (k > 0) a #rrggbb colour. Returns #rrggbb, so results can be shaded again. */
export function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return '#' + ((1 << 24) | ((r | 0) << 16) | ((g | 0) << 8) | (b | 0)).toString(16).slice(1);
}
export function mix(a, b, t) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
}

export function shadow(ctx, x, y, w, s) {
    ellipse(ctx, x, y, w * s * 0.5, w * s * 0.12, 'rgba(0,0,0,0.22)');
}

// ------------------------------------------------------------------ props (world units: a tree is ~900 tall)
export function drawProp(ctx, kind, x, y, s, v, night) {
    const dim = night ? -0.45 : 0;
    switch (kind) {
        case 'tree': {
            shadow(ctx, x, y, 700, s);
            ctx.fillStyle = shade('#6a4a30', dim);
            ctx.fillRect(x - 40 * s, y - 380 * s, 80 * s, 380 * s);
            const g = ['#3f8a3a', '#4c9a40', '#357a34'][v % 3];
            ellipse(ctx, x, y - 560 * s, 330 * s, 300 * s, shade(g, dim - 0.1));
            ellipse(ctx, x - 90 * s, y - 640 * s, 220 * s, 200 * s, shade(g, dim));
            ellipse(ctx, x + 70 * s, y - 700 * s, 170 * s, 150 * s, shade(g, dim + 0.12));
            break;
        }
        case 'bush':
            shadow(ctx, x, y, 400, s);
            ellipse(ctx, x, y - 110 * s, 220 * s, 130 * s, shade('#4a8a3c', dim));
            ellipse(ctx, x + 60 * s, y - 150 * s, 120 * s, 80 * s, shade('#5aa04a', dim));
            if (v % 2) for (let i = 0; i < 4; i++) ellipse(ctx, x - 120 * s + i * 80 * s, y - 160 * s + (i % 2) * 40 * s, 18 * s, 18 * s, night ? '#a08080' : '#ff7a9a');
            break;
        case 'fence':
            ctx.fillStyle = shade('#8a6a44', dim);
            for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 160 * s - 14 * s, y - 200 * s, 28 * s, 200 * s);
            ctx.fillRect(x - 200 * s, y - 170 * s, 400 * s, 22 * s);
            ctx.fillRect(x - 200 * s, y - 90 * s, 400 * s, 22 * s);
            break;
        case 'cactus': {
            shadow(ctx, x, y, 300, s);
            const c = shade('#4f8a4a', dim);
            ctx.fillStyle = c;
            ctx.fillRect(x - 50 * s, y - 600 * s, 100 * s, 600 * s);
            ctx.fillRect(x - 180 * s, y - 380 * s, 60 * s, 180 * s);
            ctx.fillRect(x - 180 * s, y - 230 * s, 160 * s, 50 * s);
            ctx.fillRect(x + 120 * s, y - 470 * s, 60 * s, 200 * s);
            ctx.fillRect(x + 20 * s, y - 320 * s, 160 * s, 50 * s);
            ellipse(ctx, x, y - 600 * s, 50 * s, 40 * s, c);
            break;
        }
        case 'rock': {
            shadow(ctx, x, y, 500, s);
            const c = ['#8a7a6a', '#7a8090', '#6a6058'][v % 3];
            ctx.fillStyle = shade(c, dim);
            ctx.beginPath();
            ctx.moveTo(x - 240 * s, y); ctx.lineTo(x - 180 * s, y - 180 * s); ctx.lineTo(x - 40 * s, y - 260 * s);
            ctx.lineTo(x + 150 * s, y - 200 * s); ctx.lineTo(x + 250 * s, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = shade(c, dim + 0.18);
            ctx.beginPath(); ctx.moveTo(x - 180 * s, y - 180 * s); ctx.lineTo(x - 40 * s, y - 260 * s); ctx.lineTo(x - 10 * s, y - 120 * s); ctx.closePath(); ctx.fill();
            break;
        }
        case 'dune':
            ctx.fillStyle = shade('#e8c07a', dim - 0.05);
            ctx.beginPath(); ctx.ellipse(x, y, 700 * s, 200 * s, 0, Math.PI, TAU); ctx.fill();
            break;
        case 'willow': {
            shadow(ctx, x, y, 700, s);
            ctx.fillStyle = shade('#4a3a2a', dim);
            ctx.fillRect(x - 50 * s, y - 500 * s, 100 * s, 500 * s);
            ellipse(ctx, x, y - 620 * s, 360 * s, 220 * s, shade('#4a7a50', dim));
            ctx.fillStyle = shade('#3e6a46', dim);
            for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 90 * s - 20 * s, y - 620 * s, 40 * s, (300 + (i % 2) * 90) * s);
            break;
        }
        case 'mushroom': {
            ctx.fillStyle = shade('#e8e0c8', dim);
            ctx.fillRect(x - 40 * s, y - 260 * s, 80 * s, 260 * s);
            const cap = ['#c84a4a', '#8a5ac8', '#4ac8a0'][v % 3];
            ctx.fillStyle = night ? shade(cap, 0.1) : cap;
            ctx.beginPath(); ctx.ellipse(x, y - 260 * s, 200 * s, 140 * s, 0, Math.PI, TAU); ctx.fill();
            if (night) ellipse(ctx, x, y - 300 * s, 260 * s, 200 * s, 'rgba(120,255,200,0.12)');
            break;
        }
        case 'reeds':
            ctx.strokeStyle = shade('#6a8a4a', dim); ctx.lineWidth = Math.max(1, 14 * s);
            for (let i = 0; i < 6; i++) {
                ctx.beginPath(); ctx.moveTo(x + (i - 3) * 50 * s, y);
                ctx.quadraticCurveTo(x + (i - 3) * 60 * s, y - 200 * s, x + (i - 3) * 80 * s + 30 * s, y - (300 + (i % 3) * 60) * s); ctx.stroke();
            }
            break;
        case 'pine': {
            shadow(ctx, x, y, 500, s);
            ctx.fillStyle = shade('#4a3424', dim);
            ctx.fillRect(x - 30 * s, y - 200 * s, 60 * s, 200 * s);
            for (let k = 0; k < 3; k++) {
                const top = y - (500 + k * 230) * s, half = (330 - k * 80) * s;
                ctx.fillStyle = shade('#2f5a48', dim + k * 0.05);
                ctx.beginPath(); ctx.moveTo(x, top - 230 * s); ctx.lineTo(x + half, top + 120 * s); ctx.lineTo(x - half, top + 120 * s); ctx.closePath(); ctx.fill();
                ctx.fillStyle = shade('#f4f8ff', dim);
                ctx.beginPath(); ctx.moveTo(x, top - 230 * s); ctx.lineTo(x + half * 0.45, top - 80 * s); ctx.lineTo(x - half * 0.45, top - 80 * s); ctx.closePath(); ctx.fill();
            }
            break;
        }
        case 'deadtree': {
            ctx.strokeStyle = shade('#2a1e1a', dim * 0.5); ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(1, 60 * s);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 * s, y - 600 * s); ctx.stroke();
            ctx.lineWidth = Math.max(1, 26 * s);
            ctx.beginPath(); ctx.moveTo(x + 10 * s, y - 380 * s); ctx.lineTo(x - 180 * s, y - 560 * s);
            ctx.moveTo(x + 18 * s, y - 470 * s); ctx.lineTo(x + 200 * s, y - 640 * s); ctx.stroke();
            break;
        }
        case 'lavarock':
            drawProp(ctx, 'rock', x, y, s, 2, night);
            ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = Math.max(1, 14 * s);
            ctx.beginPath(); ctx.moveTo(x - 150 * s, y - 60 * s); ctx.lineTo(x - 40 * s, y - 160 * s); ctx.lineTo(x + 60 * s, y - 90 * s); ctx.stroke();
            ellipse(ctx, x, y - 120 * s, 260 * s, 160 * s, 'rgba(255,120,40,0.12)');
            break;
        case 'vent':
            ellipse(ctx, x, y, 200 * s, 60 * s, '#2a1a18');
            ellipse(ctx, x, y - 10 * s, 120 * s, 30 * s, '#ff8a3a');
            break;
        case 'crystal': {
            const c = ['#9a86ff', '#7ad0ff', '#ff9ae0'][v % 3];
            ellipse(ctx, x, y - 200 * s, 300 * s, 260 * s, night ? 'rgba(160,140,255,0.18)' : 'rgba(160,140,255,0.08)');
            for (let i = -1; i <= 1; i++) {
                const h = (420 - Math.abs(i) * 140) * s;
                ctx.fillStyle = shade(c, i * 0.15 + (night ? 0.1 : 0));
                ctx.beginPath(); ctx.moveTo(x + i * 90 * s, y - h); ctx.lineTo(x + i * 90 * s + 60 * s, y); ctx.lineTo(x + i * 90 * s - 60 * s, y); ctx.closePath(); ctx.fill();
            }
            break;
        }
        case 'obelisk':
            shadow(ctx, x, y, 300, s);
            ctx.fillStyle = shade('#3a3050', dim * 0.3);
            ctx.beginPath(); ctx.moveTo(x - 70 * s, y); ctx.lineTo(x - 50 * s, y - 700 * s); ctx.lineTo(x, y - 800 * s); ctx.lineTo(x + 50 * s, y - 700 * s); ctx.lineTo(x + 70 * s, y); ctx.closePath(); ctx.fill();
            ellipse(ctx, x, y - 520 * s, 24 * s, 24 * s, '#c0b0ff');
            break;
        case 'waystone': {
            // v: 1 lit, 0 dark
            shadow(ctx, x, y, 500, s);
            ctx.fillStyle = shade('#8a8478', dim * 0.6);
            ctx.beginPath(); ctx.moveTo(x - 110 * s, y); ctx.lineTo(x - 80 * s, y - 900 * s); ctx.lineTo(x, y - 1000 * s); ctx.lineTo(x + 80 * s, y - 900 * s); ctx.lineTo(x + 110 * s, y); ctx.closePath(); ctx.fill();
            if (v) {
                ellipse(ctx, x, y - 760 * s, 320 * s, 320 * s, 'rgba(255,220,120,0.25)');
                ellipse(ctx, x, y - 760 * s, 60 * s, 60 * s, '#ffe9a0');
            } else ellipse(ctx, x, y - 760 * s, 40 * s, 40 * s, '#2a2830');
            break;
        }
    }
}

// ------------------------------------------------------------------ town houses (billboards beside the road)
export function drawHouse(ctx, x, y, s, v, pal, night) {
    const w = (520 + (v % 4) * 120) * s, h = (420 + ((v >> 2) % 3) * 160) * s;
    const wall = pal.walls[v % pal.walls.length], roof = pal.roofs[(v >> 1) % pal.roofs.length];
    shadow(ctx, x, y, 900, s);
    ctx.fillStyle = shade(wall, night ? -0.5 : 0);
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = shade(roof, night ? -0.5 : 0);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 50 * s, y - h); ctx.lineTo(x, y - h - 300 * s); ctx.lineTo(x + w / 2 + 50 * s, y - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade('#3a2a20', night ? -0.3 : 0);
    ctx.fillRect(x - 60 * s, y - 220 * s, 120 * s, 220 * s);
    const lit = night ? '#ffd27a' : shade('#7ab0d0', -0.1);
    ctx.fillStyle = lit;
    ctx.fillRect(x - w / 2 + 70 * s, y - h + 80 * s, 100 * s, 90 * s);
    ctx.fillRect(x + w / 2 - 170 * s, y - h + 80 * s, 100 * s, 90 * s);
    if (night) {
        ellipse(ctx, x - w / 2 + 120 * s, y - h + 125 * s, 120 * s, 100 * s, 'rgba(255,200,100,0.15)');
        ellipse(ctx, x + w / 2 - 120 * s, y - h + 125 * s, 120 * s, 100 * s, 'rgba(255,200,100,0.15)');
    }
}

// ------------------------------------------------------------------ the carts
/**
 * A cart as a projected box. P(x, y, z) projects a world point (x across the road, y up, z along it) and
 * returns { X, Y, s }. cart = { cls, color, cloth, x, z, w, h, len, wheel (rotation), lead }.
 */
export function drawCart(ctx, P, c, night, t) {
    const hw = c.w / 2, top = c.h, bed = 160;
    const z0 = c.z, z1 = c.z + c.len;
    const q = (x, y, z) => P(c.x + x, y, z);
    // shadow
    const s0 = q(0, 0, z0 + c.len / 2);
    shadow(ctx, s0.X, s0.Y, c.w * 1.5, s0.s);
    // wheels behind the body on the far side first: draw all four as ellipses on the sides
    const wheel = (x, z) => {
        const a = q(x, 110, z), r = 110 * a.s;
        ellipse(ctx, a.X, a.Y, r * 0.35, r, shade('#3a2a1c', night ? -0.4 : 0));
        ctx.strokeStyle = shade('#c8a070', night ? -0.5 : 0);
        ctx.lineWidth = Math.max(1, 12 * a.s);
        ctx.beginPath(); ctx.ellipse(a.X, a.Y, r * 0.3, r * 0.9, 0, 0, TAU); ctx.stroke();
        for (let k = 0; k < 3; k++) {
            const ang = c.wheel + (k * Math.PI) / 3;
            ctx.beginPath(); ctx.moveTo(a.X - Math.cos(ang) * r * 0.3, a.Y - Math.sin(ang) * r * 0.9);
            ctx.lineTo(a.X + Math.cos(ang) * r * 0.3, a.Y + Math.sin(ang) * r * 0.9); ctx.stroke();
        }
    };
    // which side of the box faces the camera
    const rearL = q(-hw, bed, z0), rearR = q(hw, bed, z0), frontL = q(-hw, bed, z1), frontR = q(hw, bed, z1);
    const showLeft = frontL.X > rearL.X - 0.5, showRight = frontR.X < rearR.X + 0.5;
    const quad = (a, b, cc, d, fill) => {
        ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.lineTo(cc.X, cc.Y); ctx.lineTo(d.X, d.Y); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
    };
    const dim = night ? -0.45 : 0;
    const body = shade(c.color, dim - 0.15), bodySide = shade(c.color, dim - 0.3);
    wheel(-hw - 10, z1 - 90); wheel(hw + 10, z1 - 90);
    // sides of the bed
    const H = 340;
    if (showLeft) quad(q(-hw, bed, z0), q(-hw, bed, z1), q(-hw, H, z1), q(-hw, H, z0), bodySide);
    if (showRight) quad(q(hw, bed, z0), q(hw, bed, z1), q(hw, H, z1), q(hw, H, z0), bodySide);
    // canopy: hoops of cloth over the bed
    const hoops = 4;
    const cloth = shade(c.cloth, dim);
    const clothSide = shade(c.cloth, dim - 0.18);
    const arc = (z, k) => {
        const pts = [];
        for (let i = 0; i <= 8; i++) {
            const a = Math.PI - (i / 8) * Math.PI;
            pts.push(q(Math.cos(a) * (hw + 10), H + Math.sin(a) * (top - H) * k, z));
        }
        return pts;
    };
    const rear = arc(z0 + 20, 1), front = arc(z1 - 20, 1);
    // canopy top surface between rear and front arcs
    for (let i = 0; i < 8; i++) {
        const a = rear[i], b = rear[i + 1], cc = front[i + 1], d = front[i];
        quad(a, b, cc, d, i < 2 || i > 5 ? clothSide : cloth);
    }
    for (let h = 1; h < hoops; h++) {
        const z = z0 + (c.len * h) / hoops;
        const pts = arc(z, 1.02);
        ctx.strokeStyle = shade(c.cloth, dim - 0.35); ctx.lineWidth = Math.max(1, 10 * pts[4].s);
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y))); ctx.stroke();
    }
    // the rear face: tailboard and the canopy's open end
    quad(q(-hw, bed, z0), q(hw, bed, z0), q(hw, H, z0), q(-hw, H, z0), body);
    ctx.beginPath(); rear.forEach((p, i) => (i ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y))); ctx.closePath();
    ctx.fillStyle = shade(c.cloth, dim - 0.1); ctx.fill();
    // dark interior and the emblem
    const inner = arc(z0 + 22, 0.82);
    ctx.beginPath(); inner.forEach((p, i) => (i ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y))); ctx.closePath();
    ctx.fillStyle = night ? '#2a1a10' : '#2a1e18'; ctx.fill();
    const e = q(0, (H + top) / 2 - 10, z0 + 24);
    emblem(ctx, c.cls, e.X, e.Y, 60 * e.s, night, t);
    // rear wheels in front of everything
    wheel(-hw - 10, z0 + 90); wheel(hw + 10, z0 + 90);
    // a lantern on the lead wagon's pole
    if (c.lead) {
        const l = q(0, top + 160, z1 + 120);
        const pole = q(0, top - 40, z1 - 10);
        ctx.strokeStyle = shade('#5a4030', dim); ctx.lineWidth = Math.max(1, 12 * l.s);
        ctx.beginPath(); ctx.moveTo(pole.X, pole.Y); ctx.lineTo(l.X, l.Y - 40 * l.s); ctx.stroke();
        const flick = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
        if (night) {
            const g = ctx.createRadialGradient(l.X, l.Y, 0, l.X, l.Y, 900 * l.s * flick);
            g.addColorStop(0, 'rgba(255,210,120,0.45)'); g.addColorStop(1, 'rgba(255,210,120,0)');
            ctx.fillStyle = g; ctx.fillRect(l.X - 900 * l.s, l.Y - 900 * l.s, 1800 * l.s, 1800 * l.s);
        }
        ellipse(ctx, l.X, l.Y, 34 * l.s, 46 * l.s, night ? '#ffe7a0' : '#ffd060');
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(l.X - 40 * l.s, l.Y - 60 * l.s, 80 * l.s, 16 * l.s);
    }
}

export function emblem(ctx, cls, x, y, r, night, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.lineCap = 'round';
    const gold = night ? '#c8a050' : '#ffd36a';
    ctx.strokeStyle = gold; ctx.fillStyle = gold;
    ctx.beginPath();
    switch (cls) {
        case 'captain': ctx.ellipse(0, 0, r * 0.45, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.fillRect(-r * 0.5, -r * 0.8, r, r * 0.18); break;
        case 'guard': ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.6, -r * 0.6); ctx.lineTo(r * 0.5, r * 0.2); ctx.lineTo(0, r * 0.8); ctx.lineTo(-r * 0.5, r * 0.2); ctx.closePath(); ctx.fill(); break;
        case 'cook': ctx.ellipse(0, r * 0.15, r * 0.7, r * 0.45, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(-r * 0.8, r * 0.05, r * 1.6, r * 0.15);
            // steam
            ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.1); ctx.quadraticCurveTo(-r * 0.4, -r * 0.5 + Math.sin(t * 4) * r * 0.1, -r * 0.1, -r * 0.8); ctx.stroke(); break;
        case 'smith': ctx.fillRect(-r * 0.7, -r * 0.2, r * 1.4, r * 0.35); ctx.fillRect(-r * 0.25, r * 0.15, r * 0.5, r * 0.5); ctx.fillRect(-r * 0.6, r * 0.6, r * 1.2, r * 0.15); break;
        case 'alchemist': ctx.moveTo(-r * 0.15, -r * 0.7); ctx.lineTo(r * 0.15, -r * 0.7); ctx.lineTo(r * 0.15, -r * 0.2); ctx.lineTo(r * 0.6, r * 0.6); ctx.lineTo(-r * 0.6, r * 0.6); ctx.lineTo(-r * 0.15, -r * 0.2); ctx.closePath(); ctx.fill(); break;
        case 'trader': ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a5a20'; ctx.fillRect(-r * 0.1, -r * 0.35, r * 0.2, r * 0.7); break;
        case 'scout': ctx.arc(-r * 0.2, 0, r * 0.7, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.7); ctx.lineTo(-r * 0.2, r * 0.7); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.7, 0); ctx.stroke(); break;
        case 'healer': ctx.fillRect(-r * 0.15, -r * 0.7, r * 0.3, r * 1.4); ctx.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.3); break;
        case 'bard': ctx.ellipse(-r * 0.15, r * 0.35, r * 0.4, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.fillRect(r * 0.15, -r * 0.8, r * 0.16, r * 1.15); break;
    }
    ctx.restore();
}

/** An ox, seen from behind and above, pulling at world z. */
export function drawOx(ctx, P, x, z, step, night) {
    const a = P(x, 0, z), s = a.s;
    shadow(ctx, a.X, a.Y, 400, s);
    const hide = shade('#8a6a4a', night ? -0.45 : 0), dark = shade('#5a4030', night ? -0.45 : 0);
    const leg = (dx, ph) => {
        const lift = Math.max(0, Math.sin(step + ph)) * 40 * s;
        ctx.fillStyle = dark; ctx.fillRect(a.X + dx * s - 22 * s, a.Y - 240 * s - lift, 44 * s, 240 * s);
    };
    leg(-90, 0); leg(90, Math.PI);
    ellipse(ctx, a.X, a.Y - 330 * s, 170 * s, 150 * s, hide);
    const h = P(x, 330, z + 260);
    ellipse(ctx, h.X, h.Y - 10 * h.s, 80 * h.s, 70 * h.s, dark);
    ctx.strokeStyle = shade('#f0e6c8', night ? -0.4 : 0); ctx.lineWidth = Math.max(1, 18 * h.s);
    ctx.beginPath(); ctx.moveTo(h.X - 70 * h.s, h.Y - 40 * h.s); ctx.quadraticCurveTo(h.X - 150 * h.s, h.Y - 120 * h.s, h.X - 110 * h.s, h.Y - 160 * h.s);
    ctx.moveTo(h.X + 70 * h.s, h.Y - 40 * h.s); ctx.quadraticCurveTo(h.X + 150 * h.s, h.Y - 120 * h.s, h.X + 110 * h.s, h.Y - 160 * h.s); ctx.stroke();
    // tail
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 10 * s);
    ctx.beginPath(); ctx.moveTo(a.X, a.Y - 380 * s); ctx.quadraticCurveTo(a.X + Math.sin(step * 0.7) * 40 * s, a.Y - 250 * s, a.X + Math.sin(step * 0.7) * 60 * s, a.Y - 200 * s); ctx.stroke();
}

/** A traveller on foot: a small figure at a screen point, scaled. */
export function drawWalker(ctx, x, y, s, cls, color, cloth, step, night, pose = 0) {
    const dim = night ? -0.4 : 0;
    const bob = Math.abs(Math.sin(step)) * 20 * s;
    shadow(ctx, x, y, 200, s);
    ctx.fillStyle = shade('#3a2a20', dim);
    const l1 = Math.sin(step) * 30 * s;
    ctx.fillRect(x - 40 * s, y - 220 * s + Math.max(0, l1), 30 * s, 220 * s - Math.max(0, l1));
    ctx.fillRect(x + 10 * s, y - 220 * s + Math.max(0, -l1), 30 * s, 220 * s - Math.max(0, -l1));
    ctx.fillStyle = shade(cloth, dim);
    ctx.beginPath();
    ctx.moveTo(x - 75 * s, y - 210 * s - bob); ctx.lineTo(x + 75 * s, y - 210 * s - bob);
    ctx.lineTo(x + 60 * s, y - 440 * s - bob); ctx.lineTo(x - 60 * s, y - 440 * s - bob); ctx.closePath(); ctx.fill();
    // arms: pose 1 raises the weapon arm
    ctx.strokeStyle = shade(cloth, dim - 0.15); ctx.lineWidth = Math.max(1, 26 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 60 * s, y - 420 * s - bob); ctx.lineTo(x - 90 * s, y - 280 * s - bob);
    if (pose) { ctx.moveTo(x + 60 * s, y - 420 * s - bob); ctx.lineTo(x + 130 * s, y - 560 * s - bob); }
    else { ctx.moveTo(x + 60 * s, y - 420 * s - bob); ctx.lineTo(x + 90 * s, y - 280 * s - bob); }
    ctx.stroke();
    ellipse(ctx, x, y - 510 * s - bob, 62 * s, 66 * s, shade('#e8c4a0', dim));
    ctx.fillStyle = shade(color, dim);
    ctx.beginPath(); ctx.ellipse(x, y - 545 * s - bob, 72 * s, 40 * s, 0, Math.PI, TAU); ctx.fill();
    if (pose) {
        ctx.strokeStyle = night ? '#a0a0b0' : '#e8e8f0'; ctx.lineWidth = Math.max(1, 12 * s);
        ctx.beginPath(); ctx.moveTo(x + 130 * s, y - 560 * s - bob); ctx.lineTo(x + 200 * s, y - 760 * s - bob); ctx.stroke();
    }
}

export function drawCampfire(ctx, x, y, s, t) {
    ellipse(ctx, x, y, 200 * s, 60 * s, '#3a2a20');
    const g = ctx.createRadialGradient(x, y - 100 * s, 0, x, y - 100 * s, 1200 * s);
    g.addColorStop(0, 'rgba(255,170,80,0.35)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 1200 * s, y - 1300 * s, 2400 * s, 2400 * s);
    for (let i = 0; i < 3; i++) {
        const h = (220 + Math.sin(t * 11 + i * 2) * 60) * s;
        ctx.fillStyle = ['#ff6a20', '#ffa030', '#ffe080'][i];
        ctx.beginPath(); ctx.moveTo(x - (90 - i * 25) * s, y - 20 * s);
        ctx.quadraticCurveTo(x + Math.sin(t * 7 + i) * 30 * s, y - h * 1.3, x + (90 - i * 25) * s, y - 20 * s); ctx.fill();
    }
}
