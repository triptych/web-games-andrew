// The eleven treats, drawn in code. drawTreat(ctx, tier, r) draws one centred on the origin
// and filling a disc of radius r px (the disc is what the physics uses). Shapes that aren't
// round (the gingerbread man, the wreath, the present, the house) sit on a faint frosted disc
// so the edge the physics sees is still readable.

import { hash3 } from '../rng.js';

const TAU = Math.PI * 2;

/** One spark colour per treat, for the merge bursts and the chain strip. */
export const TREAT_COLORS = ['#ff4d5e', '#3fcf7f', '#ff7fc0', '#a0623a', '#d08a48', '#2fa865', '#e8394a', '#4f8ff0', '#9fd8ff', '#c47a3a', '#ffd23f'];

function disc(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

function sphere(ctx, x, y, r, light, mid, dark) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, light);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, dark);
    disc(ctx, x, y, r);
    ctx.fillStyle = g;
    ctx.fill();
}

function gloss(ctx, x, y, r, a = 0.55) {
    ctx.save();
    ctx.translate(x - r * 0.36, y - r * 0.42);
    ctx.rotate(-0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.32, r * 0.16, 0, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.42, r * 0.22, r * 0.06, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    ctx.fill();
    ctx.restore();
}

function rim(ctx, x, y, r, color, w) {
    disc(ctx, x, y, r);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function halo(ctx, r) {
    disc(ctx, 0, 0, r * 0.97);
    ctx.fillStyle = 'rgba(235,245,255,0.13)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.stroke();
}

function roundRect(ctx, x, y, w, h, rr) {
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

// ------------------------------------------------------------------ the treats

function peppermint(ctx, r) {
    sphere(ctx, 0, 0, r * 0.97, '#ffffff', '#fbf3f3', '#e2cfd2');
    ctx.save();
    disc(ctx, 0, 0, r * 0.97);
    ctx.clip();
    ctx.fillStyle = '#e22a3d';
    for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * TAU, a1 = a0 + TAU / 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a0 - 0.7) * r * 0.6, Math.sin(a0 - 0.7) * r * 0.6, Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.arc(0, 0, r, a0, a1);
        ctx.quadraticCurveTo(Math.cos(a1 - 0.7) * r * 0.6, Math.sin(a1 - 0.7) * r * 0.6, 0, 0);
        ctx.fill();
    }
    ctx.restore();
    disc(ctx, 0, 0, r * 0.16);
    ctx.fillStyle = '#fff';
    ctx.fill();
    rim(ctx, 0, 0, r * 0.97, '#b3172a', Math.max(1, r * 0.08));
    gloss(ctx, 0, 0, r, 0.7);
}

function gumdrop(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.96, r * 0.42);
    ctx.bezierCurveTo(-r * 1.0, -r * 0.55, -r * 0.55, -r * 0.98, 0, -r * 0.98);
    ctx.bezierCurveTo(r * 0.55, -r * 0.98, r * 1.0, -r * 0.55, r * 0.96, r * 0.42);
    ctx.quadraticCurveTo(r * 0.7, r * 0.92, 0, r * 0.94);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.92, -r * 0.96, r * 0.42);
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#9af5b8');
    g.addColorStop(0.5, '#2fc471');
    g.addColorStop(1, '#14834a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.strokeStyle = '#0f6a3a';
    ctx.stroke();
    // sugar
    for (let i = 0; i < 22; i++) {
        const a = hash3(i, 1) * TAU, d = Math.sqrt(hash3(i, 2)) * r * 0.78;
        const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9 - r * 0.05;
        ctx.fillStyle = hash3(i, 3) > 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(210,255,225,0.75)';
        ctx.fillRect(x, y, Math.max(1, r * 0.07), Math.max(1, r * 0.07));
    }
    gloss(ctx, 0, 0, r, 0.6);
}

function lollipop(ctx, r) {
    const R = r * 0.97;
    sphere(ctx, 0, 0, R, '#ffd0e6', '#ff6fae', '#d63f86');
    ctx.save();
    disc(ctx, 0, 0, R);
    ctx.clip();
    const cols = ['#ffffff', '#ffe066', '#5fe0d0'];
    ctx.lineWidth = r * 0.17;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
            const th = (i / 80) * TAU * 2.2;
            const d = (th / (TAU * 2.2)) * R * 1.05;
            const a = th + (k * TAU) / 3;
            const x = Math.cos(a) * d, y = Math.sin(a) * d;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cols[k];
        ctx.stroke();
    }
    ctx.restore();
    rim(ctx, 0, 0, R, '#b52d6c', Math.max(1, r * 0.07));
    gloss(ctx, 0, 0, r, 0.6);
}

function truffle(ctx, r) {
    const R = r * 0.97;
    sphere(ctx, 0, 0, R, '#a8724c', '#6b3d22', '#331a0c');
    ctx.save();
    disc(ctx, 0, 0, R);
    ctx.clip();
    // white chocolate drizzle
    ctx.strokeStyle = '#fff4e2';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const y0 = -r * 0.45 + k * r * 0.38;
        for (let i = 0; i <= 12; i++) {
            const x = -R + (i / 12) * 2 * R;
            const y = y0 + (i % 2 ? r * 0.16 : -r * 0.12) + x * 0.15;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
    // sprinkles
    const sc = ['#e8394a', '#2fc471', '#fff'];
    for (let i = 0; i < 9; i++) {
        const a = hash3(i, 7) * TAU, d = Math.sqrt(hash3(i, 8)) * r * 0.7;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(hash3(i, 9) * TAU);
        ctx.fillStyle = sc[i % 3];
        roundRect(ctx, -r * 0.09, -r * 0.03, r * 0.18, r * 0.06, r * 0.03);
        ctx.fill();
        ctx.restore();
    }
    rim(ctx, 0, 0, R, '#24110a', Math.max(1, r * 0.06));
    gloss(ctx, 0, 0, r, 0.35);
}

function gingerman(ctx, r) {
    halo(ctx, r);
    const body = '#c9803f', edge = '#7e4718';
    const limbs = [
        [-0.22, -0.12, -0.8, 0.0], [0.22, -0.12, 0.8, 0.0],      // arms
        [-0.16, 0.34, -0.44, 0.8], [0.16, 0.34, 0.44, 0.8],       // legs
    ];
    const pass = (color, extra) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = r * 0.34 + extra;
        for (const [x0, y0, x1, y1] of limbs) {
            ctx.beginPath();
            ctx.moveTo(x0 * r, y0 * r);
            ctx.lineTo(x1 * r, y1 * r);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.36 + extra / 2, r * 0.42 + extra / 2, 0, 0, TAU);
        ctx.fill();
        disc(ctx, 0, -r * 0.52, r * 0.33 + extra / 2);
        ctx.fill();
    };
    pass(edge, r * 0.1);
    pass(body, 0);
    // icing zigzags on wrists and ankles
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineCap = 'round';
    const zig = (x, y, ang) => {
        ctx.save();
        ctx.translate(x * r, y * r);
        ctx.rotate(ang);
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) ctx.lineTo((i % 2 ? 0.06 : -0.06) * r, (-0.13 + i * 0.065) * r);
        ctx.stroke();
        ctx.restore();
    };
    zig(-0.66, -0.03, -0.2); zig(0.66, -0.03, 0.2);
    zig(-0.38, 0.68, 0.45); zig(0.38, 0.68, -0.45);
    // face
    ctx.fillStyle = '#3b2312';
    disc(ctx, -r * 0.12, -r * 0.58, r * 0.055); ctx.fill();
    disc(ctx, r * 0.12, -r * 0.58, r * 0.055); ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.14, 0.25, Math.PI - 0.25);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,120,0.45)';
    disc(ctx, -r * 0.2, -r * 0.46, r * 0.05); ctx.fill();
    disc(ctx, r * 0.2, -r * 0.46, r * 0.05); ctx.fill();
    // gumdrop buttons
    const bc = ['#e8394a', '#2fc471', '#ffd23f'];
    for (let i = 0; i < 3; i++) {
        disc(ctx, 0, -r * 0.07 + i * r * 0.18, r * 0.07);
        ctx.fillStyle = bc[i];
        ctx.fill();
    }
}

function wreath(ctx, r) {
    halo(ctx, r);
    const R = r * 0.66;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.lineWidth = r * 0.5;
    ctx.strokeStyle = '#155b36';
    ctx.stroke();
    const greens = ['#2e9a5c', '#1f7a46', '#3fb06e', '#17663a'];
    for (let i = 0; i < 34; i++) {
        const a = (i / 34) * TAU + hash3(i, 11) * 0.2;
        const d = R + (hash3(i, 12) - 0.5) * r * 0.36;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(a + 0.9 + hash3(i, 13));
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.17, r * 0.075, 0, 0, TAU);
        ctx.fillStyle = greens[i % 4];
        ctx.fill();
        ctx.restore();
    }
    // berries
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU - 0.4;
        for (let k = 0; k < 2; k++) {
            const aa = a + (k ? 0.1 : -0.06), dd = R + (k ? r * 0.08 : -r * 0.06);
            disc(ctx, Math.cos(aa) * dd, Math.sin(aa) * dd, r * 0.065);
            ctx.fillStyle = '#e02035';
            ctx.fill();
        }
    }
    // the bow
    ctx.save();
    ctx.translate(0, R + r * 0.02);
    ctx.fillStyle = '#e8394a';
    ctx.strokeStyle = '#9e1f2e';
    ctx.lineWidth = Math.max(1, r * 0.03);
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * r * 0.12, r * 0.3);
        ctx.lineTo(s * r * 0.24, r * 0.26);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(s * r * 0.19, -r * 0.04, r * 0.19, r * 0.11, s * 0.3, 0, TAU);
        ctx.fill(); ctx.stroke();
    }
    disc(ctx, 0, -r * 0.02, r * 0.07);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function bauble(ctx, r) {
    const cy = r * 0.1, R = r * 0.86;
    // cap and loop
    ctx.fillStyle = '#d9a520';
    roundRect(ctx, -r * 0.17, -r * 0.92, r * 0.34, r * 0.2, r * 0.04);
    ctx.fill();
    ctx.strokeStyle = '#8c6a10';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.95, r * 0.05, Math.PI, TAU);
    ctx.stroke();
    sphere(ctx, 0, cy, R, '#ff9aa4', '#e22a3d', '#7d0f1d');
    // gold band with dots
    ctx.save();
    disc(ctx, 0, cy, R);
    ctx.clip();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = r * 0.08;
    for (const off of [-0.16, 0.16]) {
        ctx.beginPath();
        ctx.ellipse(0, cy + off * r, R, R * 0.28, 0, 0, Math.PI);
        ctx.stroke();
    }
    ctx.fillStyle = '#fff6d0';
    for (let i = 0; i < 7; i++) {
        const x = -R * 0.8 + (i / 6) * R * 1.6;
        const y = cy + Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * R * 0.28;
        disc(ctx, x, y, r * 0.05);
        ctx.fill();
    }
    // a snowflake
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.save();
    ctx.translate(r * 0.15, cy - r * 0.42);
    for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-r * 0.14, 0); ctx.lineTo(r * 0.14, 0);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    rim(ctx, 0, cy, R, '#5e0a15', Math.max(1, r * 0.04));
    gloss(ctx, 0, cy, R, 0.65);
}

function present(ctx, r) {
    halo(ctx, r);
    const x0 = -r * 0.74, y0 = -r * 0.58, w = r * 1.48, h = r * 1.4;
    roundRect(ctx, x0, y0, w, h, r * 0.16);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#6aa8ff');
    g.addColorStop(1, '#2d5fc0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // white snowflake dots
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        disc(ctx, x0 + (i + 0.5 + (j % 2) * 0.5) * (w / 4), y0 + (j + 0.5) * (h / 4), r * 0.045);
        ctx.fill();
    }
    // lid
    ctx.fillStyle = 'rgba(20,40,110,0.25)';
    ctx.fillRect(x0, y0 + r * 0.3, w, r * 0.06);
    // ribbon
    ctx.fillStyle = '#ffcf3a';
    ctx.fillRect(-r * 0.12, y0, r * 0.24, h);
    ctx.fillRect(x0, -r * 0.02, w, r * 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-r * 0.12, y0, r * 0.06, h);
    ctx.restore();
    roundRect(ctx, x0, y0, w, h, r * 0.16);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = '#1d3f86';
    ctx.stroke();
    // bow
    ctx.fillStyle = '#ffcf3a';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = Math.max(1, r * 0.035);
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.22, y0 - r * 0.12, r * 0.24, r * 0.14, s * -0.45, 0, TAU);
        ctx.fill(); ctx.stroke();
    }
    disc(ctx, 0, y0 - r * 0.04, r * 0.1);
    ctx.fill(); ctx.stroke();
}

function globe(ctx, r) {
    // base
    ctx.beginPath();
    ctx.moveTo(-r * 0.66, r * 0.52);
    ctx.lineTo(r * 0.66, r * 0.52);
    ctx.lineTo(r * 0.44, r * 0.94);
    ctx.lineTo(-r * 0.44, r * 0.94);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, r * 0.5, 0, r * 0.95);
    bg.addColorStop(0, '#e8394a');
    bg.addColorStop(1, '#8f1222');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(-r * 0.6, r * 0.62, r * 1.2, r * 0.07);
    const cy = -r * 0.12, R = r * 0.8;
    // glass and scene
    ctx.save();
    disc(ctx, 0, cy, R);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sky.addColorStop(0, '#2b4c8f');
    sky.addColorStop(1, '#8fc3ef');
    ctx.fillStyle = sky;
    ctx.fillRect(-R, cy - R, 2 * R, 2 * R);
    ctx.beginPath();
    ctx.ellipse(0, cy + R * 0.78, R * 1.1, R * 0.4, 0, 0, TAU);
    ctx.fillStyle = '#f4fbff';
    ctx.fill();
    // tree
    ctx.fillStyle = '#6b3d22';
    ctx.fillRect(-r * 0.05, cy + R * 0.25, r * 0.1, R * 0.2);
    ctx.fillStyle = '#1f8a4c';
    for (let k = 0; k < 3; k++) {
        const top = cy - R * 0.55 + k * R * 0.22, wid = R * (0.22 + k * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, top);
        ctx.lineTo(wid, top + R * 0.36);
        ctx.lineTo(-wid, top + R * 0.36);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = '#ffd34d';
    disc(ctx, 0, cy - R * 0.58, r * 0.06);
    ctx.fill();
    // tiny cabin
    ctx.fillStyle = '#c9803f';
    ctx.fillRect(R * 0.35, cy + R * 0.32, R * 0.32, R * 0.22);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(R * 0.31, cy + R * 0.33); ctx.lineTo(R * 0.51, cy + R * 0.16); ctx.lineTo(R * 0.71, cy + R * 0.33);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.fillRect(R * 0.46, cy + R * 0.4, R * 0.08, R * 0.08);
    // snow
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 26; i++) {
        disc(ctx, (hash3(i, 21) - 0.5) * 2 * R, cy + (hash3(i, 22) - 0.6) * 2 * R, r * (0.02 + hash3(i, 23) * 0.025));
        ctx.fill();
    }
    ctx.restore();
    // glass shine
    const gl = ctx.createRadialGradient(-R * 0.3, cy - R * 0.35, R * 0.1, 0, cy, R);
    gl.addColorStop(0, 'rgba(255,255,255,0.35)');
    gl.addColorStop(0.6, 'rgba(255,255,255,0.04)');
    gl.addColorStop(1, 'rgba(200,230,255,0.35)');
    disc(ctx, 0, cy, R);
    ctx.fillStyle = gl;
    ctx.fill();
    rim(ctx, 0, cy, R, 'rgba(230,245,255,0.9)', Math.max(1, r * 0.035));
    ctx.beginPath();
    ctx.arc(0, cy, R * 0.82, Math.PI * 1.1, Math.PI * 1.45);
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
}

function house(ctx, r) {
    halo(ctx, r);
    const wallTop = -r * 0.08, wallBot = r * 0.78, hw = r * 0.6;
    // walls
    ctx.fillStyle = '#c9803f';
    ctx.fillRect(-hw, wallTop, hw * 2, wallBot - wallTop);
    ctx.strokeStyle = '#7e4718';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.strokeRect(-hw, wallTop, hw * 2, wallBot - wallTop);
    // candy-cane corners
    for (const s of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(s * hw - r * 0.06, wallTop, r * 0.12, wallBot - wallTop);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(s * hw - r * 0.06, wallTop, r * 0.12, wallBot - wallTop);
        ctx.fillStyle = '#e22a3d';
        for (let y = wallTop - r * 0.2; y < wallBot; y += r * 0.16) {
            ctx.beginPath();
            ctx.moveTo(s * hw - r * 0.06, y);
            ctx.lineTo(s * hw + r * 0.06, y + r * 0.1);
            ctx.lineTo(s * hw + r * 0.06, y + r * 0.16);
            ctx.lineTo(s * hw - r * 0.06, y + r * 0.06);
            ctx.fill();
        }
        ctx.restore();
    }
    // windows
    for (const s of [-1, 1]) {
        const wx = s * r * 0.33 - r * 0.12, wy = r * 0.08;
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(wx, wy, r * 0.24, r * 0.22);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, r * 0.035);
        ctx.strokeRect(wx, wy, r * 0.24, r * 0.22);
        ctx.beginPath();
        ctx.moveTo(wx + r * 0.12, wy); ctx.lineTo(wx + r * 0.12, wy + r * 0.22);
        ctx.moveTo(wx, wy + r * 0.11); ctx.lineTo(wx + r * 0.24, wy + r * 0.11);
        ctx.stroke();
    }
    // door
    ctx.beginPath();
    ctx.moveTo(-r * 0.13, wallBot);
    ctx.lineTo(-r * 0.13, r * 0.48);
    ctx.arc(0, r * 0.48, r * 0.13, Math.PI, TAU);
    ctx.lineTo(r * 0.13, wallBot);
    ctx.closePath();
    ctx.fillStyle = '#6b3d22';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    disc(ctx, r * 0.07, r * 0.62, r * 0.025);
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
    // roof with icing snow
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.94);
    ctx.lineTo(r * 0.9, r * 0.06);
    ctx.lineTo(-r * 0.9, r * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#8a4f20';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.96);
    ctx.lineTo(r * 0.86, -r * 0.02);
    for (let i = 0; i <= 8; i++) {
        const x = r * 0.86 - (i / 8) * r * 1.72;
        ctx.lineTo(x, (i % 2 ? r * 0.04 : -r * 0.1) - Math.abs(x) * 0.08);
    }
    ctx.closePath();
    ctx.fillStyle = '#fbfdff';
    ctx.fill();
    ctx.strokeStyle = '#d4e6f5';
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.stroke();
    // gumdrops along the eaves
    const gc = ['#e8394a', '#2fc471', '#ffd23f', '#ff7fc0', '#4f8ff0'];
    for (let i = 0; i < 7; i++) {
        const t = i / 6, x = -r * 0.7 + t * r * 1.4;
        const y = -r * 0.94 + (Math.abs(x) / (r * 0.9)) * r * 1.0 - r * 0.02;
        disc(ctx, x * 0.86, y - r * 0.02, r * 0.055);
        ctx.fillStyle = gc[i % 5];
        ctx.fill();
    }
}

function bell(ctx, r) {
    const cy = r * 0.1, R = r * 0.86;
    // hanging loop
    ctx.beginPath();
    ctx.arc(0, -r * 0.84, r * 0.1, 0, TAU);
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = '#b07d12';
    ctx.stroke();
    sphere(ctx, 0, cy, R, '#fff6b8', '#f5c32c', '#8f5f00');
    // the band and the slot
    ctx.save();
    disc(ctx, 0, cy, R);
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,90,0,0.7)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, cy + r * 0.02, R, R * 0.3, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#3d2600';
    disc(ctx, -r * 0.3, cy + r * 0.5, r * 0.1); ctx.fill();
    disc(ctx, r * 0.3, cy + r * 0.5, r * 0.1); ctx.fill();
    ctx.fillRect(-r * 0.3, cy + r * 0.47, r * 0.6, r * 0.06);
    rim(ctx, 0, cy, R, '#7a5000', Math.max(1, r * 0.035));
    gloss(ctx, 0, cy, R, 0.75);
    // holly and berries on top
    ctx.fillStyle = '#1f8a4c';
    ctx.strokeStyle = '#0f5a30';
    ctx.lineWidth = Math.max(1, r * 0.02);
    for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * r * 0.2, -r * 0.62);
        ctx.rotate(s * 0.35);
        ctx.beginPath();
        ctx.moveTo(-s * r * 0.02, 0);
        for (let i = 0; i <= 6; i++) {
            const x = s * (i / 6) * r * 0.34;
            ctx.lineTo(x, (i % 2 ? -1 : -0.4) * r * 0.08);
        }
        for (let i = 6; i >= 0; i--) {
            const x = s * (i / 6) * r * 0.34;
            ctx.lineTo(x, (i % 2 ? 1 : 0.4) * r * 0.08);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    ctx.fillStyle = '#e02035';
    for (const [x, y] of [[-0.06, -0.66], [0.06, -0.66], [0, -0.58]]) {
        disc(ctx, x * r, y * r, r * 0.065);
        ctx.fill();
    }
}

const DRAW = [peppermint, gumdrop, lollipop, truffle, gingerman, wreath, bauble, present, globe, house, bell];

/** Draw treat `tier` centred on the origin, filling a disc of radius r px. */
export function drawTreat(ctx, tier, r) {
    ctx.save();
    DRAW[tier](ctx, r);
    ctx.restore();
}

/** Draw a treat into a small canvas (HUD, menus), sized for the device's pixel ratio. */
export function paintIcon(canvas, tier, cssSize) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(cssSize * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.translate(px / 2, px / 2);
    drawTreat(ctx, tier, px * 0.44);
}
