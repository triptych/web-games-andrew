// Procedural textures: the tile atlas, the brass of Thimble, the town's walls and roofs,
// glow sprites and character portraits. Everything is painted on 2D canvases at boot.

import { STRATA, ORES, RELICS } from '../config.js';
import { makeRng } from '../rng.js';

export const CELL = 64;
export const GRID = 16;
export const ATLAS = {
    base: (s, v) => s * 4 + v,       // 0..27
    back: (s) => 28 + s,             // 28..34
    grass: 35,
    ore: (id) => 36 + id,            // 36..48
    gas: 49, lava: 50, boulder: 51, rune: 52,
    relic: (id) => 53 + id,          // 53..59
    artifact: 60, page: 61,
    brick: (k) => 62 + k,            // 0 greystone, 1 kharadun, 2 obsidian
    gate: 65, shard: 66, cache: 67, bedrock: 68, waystone: 69, wreck: 70, heart: 71, crack: 72,
};

const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mix = (a, b, t) => a + (b - a) * t;
function shade(col, k) { return col.map((v) => Math.max(0, Math.min(255, v * k))); }
function hexToArr(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function cellCtx(ctx, i) {
    const x = (i % GRID) * CELL, y = Math.floor(i / GRID) * CELL;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, CELL, CELL); ctx.clip();
    ctx.translate(x, y);
    return () => ctx.restore();
}

function speckle(ctx, rng, n, col, sMin, sMax, alpha = 1) {
    for (let i = 0; i < n; i++) {
        const s = mix(sMin, sMax, rng());
        ctx.fillStyle = rgb(...shade(col, mix(0.7, 1.3, rng())), alpha);
        ctx.fillRect(rng() * CELL, rng() * CELL, s, s);
    }
}

function blob(ctx, rng, cx, cy, r, sides = 7) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + rng() * 0.4;
        const rr = r * mix(0.65, 1.15, rng());
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
}

function bevel(ctx, strength = 0.35) {
    // light from the top-left: blocks read as blocks without hard outlines
    let g = ctx.createLinearGradient(0, 0, 0, 7);
    g.addColorStop(0, `rgba(255,240,220,${strength * 0.55})`); g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, 7);
    g = ctx.createLinearGradient(0, CELL - 8, 0, CELL);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, CELL - 8, CELL, 8);
    g = ctx.createLinearGradient(CELL - 6, 0, CELL, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength * 0.7})`);
    ctx.fillStyle = g; ctx.fillRect(CELL - 6, 0, 6, CELL);
    g = ctx.createLinearGradient(0, 0, 6, 0);
    g.addColorStop(0, `rgba(255,240,220,${strength * 0.3})`); g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 6, CELL);
}

// ------------------------------------------------------------------
// Rock for each stratum
// ------------------------------------------------------------------
function paintRock(ctx, s, v, back) {
    const rng = makeRng(1000 + s * 31 + v * 7 + (back ? 999 : 0));
    const base = STRATA[s].tint.map((c) => c * 255);
    const dark = back ? 0.42 : 1;
    const col = shade(base, dark);
    ctx.fillStyle = rgb(...col);
    ctx.fillRect(0, 0, CELL, CELL);
    // big soft mottling
    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = rgb(...shade(col, mix(0.78, 1.18, rng())), 0.5);
        blob(ctx, rng, rng() * CELL, rng() * CELL, mix(8, 18, rng()), 8);
        ctx.fill();
    }
    switch (s) {
        case 0: // loam: pebbles, roots, mushrooms
            speckle(ctx, rng, 70, shade(col, 0.7), 1, 3);
            speckle(ctx, rng, 20, [180, 150, 110], 1, 2, 0.8);
            ctx.strokeStyle = rgb(70, 45, 25, back ? 0.4 : 0.75);
            ctx.lineWidth = 2;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                let x = rng() * CELL, y = 0;
                ctx.moveTo(x, y);
                while (y < CELL) { x += mix(-8, 8, rng()); y += mix(6, 12, rng()); ctx.lineTo(x, y); }
                ctx.stroke();
            }
            if (v === 2 && !back) {
                // a tiny glowing fairy mushroom
                ctx.fillStyle = '#e8d8c0'; ctx.fillRect(40, 44, 3, 7);
                ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.ellipse(41.5, 44, 6, 3.5, 0, Math.PI, 0); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(38, 42, 1.5, 1.5); ctx.fillRect(43, 41, 1.5, 1.5);
            }
            break;
        case 1: // greystone: slate layers
            for (let y = 4; y < CELL; y += mix(7, 12, rng())) {
                ctx.strokeStyle = rgb(...shade(col, 0.62), 0.8);
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(0, y);
                for (let x = 0; x <= CELL; x += 8) ctx.lineTo(x, y + mix(-1.5, 1.5, rng()));
                ctx.stroke();
                ctx.strokeStyle = rgb(...shade(col, 1.25), 0.35);
                ctx.beginPath(); ctx.moveTo(0, y + 1.5); ctx.lineTo(CELL, y + 1.5 + mix(-1, 1, rng())); ctx.stroke();
            }
            speckle(ctx, rng, 40, shade(col, 0.8), 1, 2);
            break;
        case 2: // glimmerdeep: violet rock with tiny crystals
            speckle(ctx, rng, 50, shade(col, 0.75), 1, 3);
            for (let i = 0; i < 4; i++) {
                const x = rng() * CELL, y = rng() * CELL, h = mix(5, 12, rng());
                ctx.fillStyle = rgb(150, 200, 255, back ? 0.35 : 0.85);
                ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 3, y); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill();
                ctx.fillStyle = rgb(230, 250, 255, back ? 0.3 : 0.8); ctx.fillRect(x - 0.5, y - h + 2, 1, h * 0.5);
            }
            break;
        case 3: // kharadun: sandstone strata
            for (let y = 0; y < CELL; y += 6) {
                ctx.fillStyle = rgb(...shade(col, mix(0.85, 1.15, rng())), 0.55);
                ctx.fillRect(0, y, CELL, mix(3, 6, rng()));
            }
            speckle(ctx, rng, 40, [240, 210, 150], 1, 2, 0.5);
            break;
        case 4: // emberdeep: basalt with glowing cracks
            speckle(ctx, rng, 60, shade(col, 0.6), 1, 3);
            ctx.strokeStyle = rgb(255, 110, 40, back ? 0.35 : 0.75);
            ctx.lineWidth = 1.3;
            ctx.shadowColor = '#ff5010'; ctx.shadowBlur = 4;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                let x = rng() * CELL, y = rng() * CELL;
                ctx.moveTo(x, y);
                for (let k = 0; k < 5; k++) { x += mix(-10, 10, rng()); y += mix(-10, 10, rng()); ctx.lineTo(x, y); }
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
            break;
        case 5: // gloam: black-violet with swirls
            speckle(ctx, rng, 40, [20, 10, 30], 1, 4);
            ctx.strokeStyle = rgb(150, 90, 220, back ? 0.18 : 0.35);
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(rng() * CELL, rng() * CELL, mix(4, 12, rng()), rng() * 6, rng() * 6 + 3);
                ctx.stroke();
            }
            break;
        case 6: // wyrmheart: obsidian
            for (let i = 0; i < 6; i++) {
                ctx.fillStyle = rgb(90, 60, 130, 0.25);
                ctx.beginPath(); const x = rng() * CELL, y = rng() * CELL;
                ctx.moveTo(x, y); ctx.lineTo(x + mix(5, 15, rng()), y + mix(-5, 5, rng())); ctx.lineTo(x + 3, y + mix(6, 12, rng())); ctx.fill();
            }
            break;
        default: break;
    }
    if (!back) bevel(ctx, 0.4);
    else {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 0, CELL, 1); ctx.fillRect(0, 0, 1, CELL);
    }
}

function paintGrass(ctx) {
    const rng = makeRng(77);
    ctx.clearRect(0, 0, CELL, CELL);
    const g = ctx.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, '#7cc04a'); g.addColorStop(1, '#3f7a2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(CELL, 0); ctx.lineTo(CELL, 10);
    for (let x = CELL; x >= 0; x -= 4) ctx.lineTo(x, mix(9, 17, rng()));
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = rng() < 0.5 ? '#98d860' : '#4f9a34';
        ctx.lineWidth = 1.2;
        const x = rng() * CELL;
        ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + mix(-2, 2, rng()), 0); ctx.stroke();
    }
}

// ------------------------------------------------------------------
// Ores and things in the rock
// ------------------------------------------------------------------
function paintOre(ctx, o) {
    const rng = makeRng(500 + o.id * 13);
    ctx.clearRect(0, 0, CELL, CELL);
    const c1 = hexToArr(o.col), c2 = hexToArr(o.col2);
    const crystal = ['amber', 'moonquartz', 'sapphire', 'emberstone', 'dragonglass', 'voidpearl'].includes(o.key);
    const n = 5 + (o.id % 3);
    for (let i = 0; i < n; i++) {
        const cx = mix(12, 52, rng()), cy = mix(12, 52, rng()), r = mix(5, 10, rng());
        if (crystal) {
            const h = r * 1.8, a = mix(-0.5, 0.5, rng());
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
            ctx.fillStyle = rgb(...c1);
            ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(r * 0.6, -h * 0.3); ctx.lineTo(r * 0.5, h * 0.5); ctx.lineTo(-r * 0.5, h * 0.5); ctx.lineTo(-r * 0.6, -h * 0.3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = rgb(...c2, 0.85);
            ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(r * 0.6, -h * 0.3); ctx.lineTo(0, -h * 0.1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = rgb(...shade(c1, 0.5)); ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
        } else {
            ctx.fillStyle = rgb(...shade(c1, 0.55));
            blob(ctx, rng, cx + 1, cy + 1.5, r, 7); ctx.fill();
            ctx.fillStyle = rgb(...c1);
            blob(ctx, rng, cx, cy, r, 7); ctx.fill();
            ctx.fillStyle = rgb(...c2, 0.9);
            blob(ctx, rng, cx - r * 0.3, cy - r * 0.35, r * 0.38, 5); ctx.fill();
        }
    }
    if (o.key === 'voidpearl') {
        ctx.fillStyle = '#f8e0ff';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(mix(16, 48, rng()), mix(16, 48, rng()), 4, 0, 7); ctx.fill(); }
    }
}

function paintGas(ctx) {
    const rng = makeRng(49);
    ctx.clearRect(0, 0, CELL, CELL);
    for (let i = 0; i < 6; i++) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        const x = mix(14, 50, rng()), y = mix(14, 50, rng()), r = mix(8, 15, rng());
        ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
        g.addColorStop(0, 'rgba(170,255,120,0.9)'); g.addColorStop(0.6, 'rgba(90,200,70,0.55)'); g.addColorStop(1, 'rgba(60,140,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill();
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(30,60,20,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, 32, 20, 0.3, 2.6); ctx.stroke();
}

function paintLava(ctx) {
    const rng = makeRng(50);
    const g = ctx.createLinearGradient(0, 0, 0, CELL);
    g.addColorStop(0, '#ffd060'); g.addColorStop(0.4, '#ff7020'); g.addColorStop(1, '#a01808');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = rgb(60, 10, 5, 0.75);
        blob(ctx, rng, rng() * CELL, rng() * CELL, mix(4, 9, rng()), 6); ctx.fill();
    }
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,250,200,0.8)'; ctx.fillRect(rng() * CELL, rng() * CELL, 2, 2); }
}

function paintBoulder(ctx) {
    const rng = makeRng(51);
    ctx.clearRect(0, 0, CELL, CELL);
    const g = ctx.createRadialGradient(24, 22, 4, 32, 32, 30);
    g.addColorStop(0, '#b8b0a0'); g.addColorStop(0.7, '#6e665a'); g.addColorStop(1, '#3a342c');
    ctx.fillStyle = g;
    blob(ctx, rng, 32, 33, 27, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(30,25,20,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(32, 38); ctx.lineTo(44, 34); ctx.stroke();
}

function paintRune(ctx) {
    const g = ctx.createLinearGradient(0, 0, CELL, CELL);
    g.addColorStop(0, '#4a5560'); g.addColorStop(1, '#262c34');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, CELL);
    ctx.strokeStyle = '#7ad8ff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#40c0ff'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(32, 12); ctx.lineTo(32, 52); ctx.moveTo(32, 20); ctx.lineTo(44, 30); ctx.moveTo(32, 30); ctx.lineTo(20, 40);
    ctx.moveTo(22, 14); ctx.lineTo(42, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    bevel(ctx, 0.5);
}

function paintRelic(ctx, rel) {
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, 0, CELL, CELL);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    const c = hexToArr(rel.col);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, rgb(...c)); g.addColorStop(1, 'rgba(20,10,10,1)');
    ctx.fillStyle = g; ctx.fillRect(4, 4, CELL - 8, CELL - 8);
    ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, CELL - 10, CELL - 10);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = rel.col; ctx.shadowBlur = 10;
    ctx.fillText(rel.icon, 32, 34);
    ctx.shadowBlur = 0;
}

function paintArtifact(ctx, page) {
    ctx.clearRect(0, 0, CELL, CELL);
    if (page) {
        ctx.save(); ctx.translate(32, 32); ctx.rotate(-0.3);
        ctx.fillStyle = '#e8d8a8'; ctx.fillRect(-14, -18, 28, 36);
        ctx.fillStyle = '#c8b078'; ctx.fillRect(-16, -20, 32, 5); ctx.fillRect(-16, 16, 32, 5);
        ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 1;
        for (let y = -10; y < 12; y += 4) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(10, y); ctx.stroke(); }
        ctx.restore();
    } else {
        // a half-buried chest-ish trinket with a gold glint
        ctx.fillStyle = '#d8a830';
        ctx.beginPath(); ctx.arc(32, 34, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff4b0'; ctx.beginPath(); ctx.arc(28, 30, 4, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7a5010'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(32, 34, 12, 0, 7); ctx.stroke();
        ctx.fillStyle = '#c04040'; ctx.beginPath(); ctx.arc(32, 34, 4, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,220,0.9)';
    for (const [x, y] of [[14, 14], [50, 18], [46, 50]]) {
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 1, y - 1); ctx.lineTo(x + 4, y); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x, y + 4); ctx.lineTo(x - 1, y + 1); ctx.lineTo(x - 4, y); ctx.lineTo(x - 1, y - 1); ctx.fill();
    }
}

function paintBrick(ctx, k) {
    const cols = [[110, 112, 122], [190, 150, 95], [52, 40, 70]];
    const col = cols[k];
    const rng = makeRng(62 + k);
    ctx.fillStyle = rgb(...shade(col, 0.45)); ctx.fillRect(0, 0, CELL, CELL);
    const bh = 16;
    for (let row = 0; row < 4; row++) {
        const off = row % 2 ? -16 : 0;
        for (let x = off; x < CELL; x += 32) {
            ctx.fillStyle = rgb(...shade(col, mix(0.85, 1.12, rng())));
            ctx.fillRect(x + 1.5, row * bh + 1.5, 29, bh - 3);
            ctx.fillStyle = rgb(255, 255, 255, 0.12); ctx.fillRect(x + 1.5, row * bh + 1.5, 29, 2);
        }
    }
    if (k === 2) {
        ctx.strokeStyle = 'rgba(200,120,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(10, 8); ctx.lineTo(20, 20); ctx.lineTo(16, 40); ctx.stroke();
    }
    if (k === 1) {
        // a dwarf-rune carved in one brick
        ctx.strokeStyle = 'rgba(80,50,20,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(42, 20); ctx.lineTo(48, 28); ctx.lineTo(54, 20); ctx.stroke();
    }
    bevel(ctx, 0.3);
}

function paintGate(ctx) {
    ctx.fillStyle = '#1a1422'; ctx.fillRect(0, 0, CELL, CELL);
    ctx.fillStyle = '#3a2c4a'; ctx.fillRect(2, 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = '#ffd870'; ctx.lineWidth = 2; ctx.shadowColor = '#ffb030'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(32, 32, 16, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 12); ctx.lineTo(32, 52); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd870';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(32 + Math.cos(a) * 24 - 1.5, 32 + Math.sin(a) * 24 - 1.5, 3, 3); }
}

function paintShard(ctx) {
    ctx.fillStyle = '#100818'; ctx.fillRect(0, 0, CELL, CELL);
    const g = ctx.createLinearGradient(16, 4, 48, 60);
    g.addColorStop(0, '#ff9ae8'); g.addColorStop(0.5, '#8a2ad0'); g.addColorStop(1, '#2a0848');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(50, 24); ctx.lineTo(42, 62); ctx.lineTo(22, 62); ctx.lineTo(14, 24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd0ff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(44, 24); ctx.lineTo(32, 30); ctx.closePath(); ctx.fill();
}

function paintCache(ctx) {
    ctx.clearRect(0, 0, CELL, CELL);
    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(12, 24, 40, 26);
    ctx.fillStyle = '#8a4a20'; ctx.beginPath(); ctx.moveTo(12, 26); ctx.quadraticCurveTo(32, 8, 52, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8a830'; ctx.fillRect(12, 24, 40, 3); ctx.fillRect(30, 18, 4, 32); ctx.fillRect(12, 47, 40, 3);
    ctx.fillStyle = '#ffe070'; ctx.fillRect(29, 30, 6, 6);
}

function paintBedrock(ctx) {
    const rng = makeRng(68);
    ctx.fillStyle = '#16141a'; ctx.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = rgb(40, 36, 46, 0.9); blob(ctx, rng, rng() * CELL, rng() * CELL, mix(5, 12, rng()), 6); ctx.fill(); }
    bevel(ctx, 0.3);
}

function paintWaystone(ctx) {
    ctx.fillStyle = '#4a4a58'; ctx.fillRect(0, 0, CELL, CELL);
    ctx.fillStyle = '#6a6a7a'; ctx.fillRect(4, 0, CELL - 8, CELL);
    ctx.strokeStyle = '#80f0ff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#40e0ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(32, 8); ctx.lineTo(44, 32); ctx.lineTo(32, 56); ctx.lineTo(20, 32); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(32, 32, 6, 0, 7); ctx.stroke();
    ctx.shadowBlur = 0;
    bevel(ctx, 0.4);
}

function paintWreck(ctx) {
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(0, 0, CELL, CELL);
    ctx.fillStyle = '#a07030';
    ctx.save(); ctx.translate(32, 36); ctx.rotate(0.4);
    ctx.fillRect(-22, -14, 44, 26);
    ctx.fillStyle = '#5a3a18'; ctx.fillRect(-22, 6, 44, 6);
    ctx.fillStyle = '#d8c060'; ctx.beginPath(); ctx.arc(-8, -2, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#444'; ctx.fillRect(10, -24, 6, 12);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,120,40,0.7)'; ctx.fillRect(8, 50, 10, 2); ctx.fillRect(40, 54, 14, 2);
}

function paintHeart(ctx) {
    ctx.fillStyle = '#100810'; ctx.fillRect(0, 0, CELL, CELL);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ffe080'); g.addColorStop(0.7, '#ff8030'); g.addColorStop(1, 'rgba(60,10,20,1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(32, 4); ctx.lineTo(56, 28); ctx.lineTo(32, 60); ctx.lineTo(8, 28); ctx.closePath(); ctx.fill();
}

function paintCrack(ctx) {
    const rng = makeRng(72);
    ctx.clearRect(0, 0, CELL, CELL);
    ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        let x = 32 + mix(-4, 4, rng()), y = 32 + mix(-4, 4, rng());
        ctx.moveTo(x, y);
        const a = rng() * Math.PI * 2;
        for (let k = 0; k < 5; k++) { x += Math.cos(a + mix(-0.7, 0.7, rng())) * 7; y += Math.sin(a + mix(-0.7, 0.7, rng())) * 7; ctx.lineTo(x, y); }
        ctx.stroke();
    }
}

export function buildAtlasCanvas() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = CELL * GRID;
    const ctx = cv.getContext('2d');
    const paint = (i, fn) => { const done = cellCtx(ctx, i); fn(ctx); done(); };
    for (let s = 0; s < 7; s++) {
        for (let v = 0; v < 4; v++) paint(ATLAS.base(s, v), (c) => paintRock(c, s, v, false));
        paint(ATLAS.back(s), (c) => paintRock(c, s, 0, true));
    }
    paint(ATLAS.grass, paintGrass);
    for (const o of ORES) paint(ATLAS.ore(o.id), (c) => paintOre(c, o));
    paint(ATLAS.gas, paintGas);
    paint(ATLAS.lava, paintLava);
    paint(ATLAS.boulder, paintBoulder);
    paint(ATLAS.rune, paintRune);
    for (const r of RELICS) paint(ATLAS.relic(r.id), (c) => paintRelic(c, r));
    paint(ATLAS.artifact, (c) => paintArtifact(c, false));
    paint(ATLAS.page, (c) => paintArtifact(c, true));
    for (let k = 0; k < 3; k++) paint(ATLAS.brick(k), (c) => paintBrick(c, k));
    paint(ATLAS.gate, paintGate);
    paint(ATLAS.shard, paintShard);
    paint(ATLAS.cache, paintCache);
    paint(ATLAS.bedrock, paintBedrock);
    paint(ATLAS.waystone, paintWaystone);
    paint(ATLAS.wreck, paintWreck);
    paint(ATLAS.heart, paintHeart);
    paint(ATLAS.crack, paintCrack);
    return cv;
}

// ------------------------------------------------------------------
// Materials for models: brass, timber, plaster, shingles, stone
// ------------------------------------------------------------------
export function brassCanvas(tint = '#c8923a') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const rng = makeRng(9);
    ctx.fillStyle = tint; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = rgb(255, 230, 160, rng() * 0.12); ctx.fillRect(rng() * 128, rng() * 128, rng() * 20, 1); }
    for (let i = 0; i < 80; i++) { ctx.fillStyle = rgb(60, 30, 0, rng() * 0.15); ctx.fillRect(rng() * 128, rng() * 128, 2, 2); }
    // riveted seams
    for (const y of [10, 64, 118]) {
        ctx.fillStyle = 'rgba(70,40,10,0.55)'; ctx.fillRect(0, y - 1, 128, 3);
        for (let x = 4; x < 128; x += 10) {
            ctx.fillStyle = 'rgba(60,30,5,0.8)'; ctx.beginPath(); ctx.arc(x, y + 5, 2.4, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,240,190,0.8)'; ctx.beginPath(); ctx.arc(x - 0.6, y + 4.3, 1, 0, 7); ctx.fill();
        }
    }
    return cv;
}

export function wallCanvas(kind) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const rng = makeRng(kind.length * 17 + 3);
    if (kind === 'plaster') {
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 400; i++) { ctx.fillStyle = rgb(160, 140, 110, rng() * 0.15); ctx.fillRect(rng() * 256, rng() * 256, 3, 3); }
        ctx.fillStyle = '#5a3a22';
        for (const x of [0, 84, 168, 248]) ctx.fillRect(x, 0, 10, 256);
        ctx.fillRect(0, 0, 256, 10); ctx.fillRect(0, 124, 256, 10); ctx.fillRect(0, 246, 256, 10);
        ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = '#5a3a22';
        ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(84, 124); ctx.moveTo(248, 10); ctx.lineTo(168, 124); ctx.stroke(); ctx.restore();
    } else if (kind === 'stone') {
        ctx.fillStyle = '#5a5a60'; ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 28) {
            const off = (y / 28) % 2 ? 22 : 0;
            for (let x = -off; x < 256; x += 44) {
                ctx.fillStyle = rgb(...shade([130, 128, 124], mix(0.75, 1.15, rng())));
                ctx.fillRect(x + 2, y + 2, 40, 24);
            }
        }
    } else if (kind === 'shingle') {
        ctx.fillStyle = '#4a2a2a'; ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 20) {
            const off = (y / 20) % 2 ? 12 : 0;
            for (let x = -off; x < 256; x += 24) {
                ctx.fillStyle = rgb(...shade([150, 70, 55], mix(0.7, 1.1, rng())));
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y); ctx.lineTo(x + 22, y + 16); ctx.quadraticCurveTo(x + 11, y + 22, x, y + 16); ctx.fill();
            }
        }
    } else if (kind === 'slate') {
        ctx.fillStyle = '#2a3040'; ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 18) {
            const off = (y / 18) % 2 ? 14 : 0;
            for (let x = -off; x < 256; x += 28) {
                ctx.fillStyle = rgb(...shade([80, 92, 120], mix(0.7, 1.15, rng())));
                ctx.fillRect(x + 1, y + 1, 26, 15);
            }
        }
    } else if (kind === 'thatch') {
        ctx.fillStyle = '#8a6a30'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) { ctx.strokeStyle = rgb(...shade([200, 160, 80], mix(0.6, 1.2, rng())), 0.7); ctx.beginPath(); const x = rng() * 256, y = rng() * 256; ctx.moveTo(x, y); ctx.lineTo(x + mix(-3, 3, rng()), y + 14); ctx.stroke(); }
    } else if (kind === 'wood') {
        ctx.fillStyle = '#6a4424'; ctx.fillRect(0, 0, 256, 256);
        for (let x = 0; x < 256; x += 32) {
            ctx.fillStyle = rgb(...shade([120, 80, 45], mix(0.8, 1.15, rng()))); ctx.fillRect(x + 1, 0, 30, 256);
            for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(40,20,5,0.35)'; ctx.beginPath(); const yy = rng() * 256; ctx.moveTo(x + 4, yy); ctx.quadraticCurveTo(x + 16, yy + 12, x + 28, yy); ctx.stroke(); }
        }
    } else if (kind === 'grass') {
        ctx.fillStyle = '#4f8a32'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2500; i++) { ctx.fillStyle = rgb(...shade([90, 150, 60], mix(0.6, 1.3, rng())), 0.8); ctx.fillRect(rng() * 256, rng() * 256, 2, 3); }
        for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#f0e070', '#ffffff', '#d080e0'][i % 3]; ctx.fillRect(rng() * 256, rng() * 256, 3, 3); }
    } else if (kind === 'cobble') {
        ctx.fillStyle = '#4a4440'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 120; i++) { ctx.fillStyle = rgb(...shade([140, 128, 115], mix(0.7, 1.15, rng()))); blob(ctx, rng, rng() * 256, rng() * 256, mix(8, 13, rng()), 7); ctx.fill(); }
    }
    return cv;
}

/** A circular glow: white centre fading out. Used for particles, wisps, orbs and halos. */
export function glowCanvas(size = 64) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return cv;
}

/** A sign board: text on wood, for the shops. */
export function signCanvas(text, icon, col = '#ffe8b0') {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#3a2412'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(6, 6, 500, 116);
    ctx.strokeStyle = '#c89a50'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, 484, 100);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText(`${icon}  ${text}`, 256, 68);
    return cv;
}

// ------------------------------------------------------------------
// Portraits
// ------------------------------------------------------------------
export function drawPortrait(cv, who, cast, mood = 0) {
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const p = cast[who] || {};
    ctx.save();
    ctx.scale(S / 160, S / 160);
    const bg = ctx.createRadialGradient(80, 70, 10, 80, 80, 110);
    const bgc = { orla: '#5a2a1a', pell: '#2a4a3a', sedge: '#2a2a4a', mirabel: '#3a2a4a', ansel: '#4a3a1a', corvin: '#1a2a3a', thimble: '#1a3040', maren: '#40202e', wyrm: '#1a0a28', ysmereth: '#4a3010' }[who] || '#222';
    bg.addColorStop(0, bgc); bg.addColorStop(1, '#08060a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 160, 160);

    if (p.kind === 'automaton') drawAutomaton(ctx, p);
    else if (p.kind === 'wyrm') drawWyrm(ctx, p);
    else drawPerson(ctx, p);
    ctx.restore();
    void mood;
}

function drawAutomaton(ctx, p) {
    // brass barrel body with a porthole eye
    const g = ctx.createLinearGradient(30, 0, 130, 0);
    g.addColorStop(0, '#6a4410'); g.addColorStop(0.4, p.col); g.addColorStop(0.6, '#f0d090'); g.addColorStop(1, '#5a3a10');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(32, 40, 96, 110, 22); ctx.fill();
    ctx.fillStyle = '#5a3a10';
    for (const y of [60, 120]) { ctx.fillRect(32, y, 96, 5); for (let x = 38; x < 128; x += 12) { ctx.fillStyle = '#ffe8b0'; ctx.beginPath(); ctx.arc(x, y + 9, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a10'; } }
    // dome
    ctx.fillStyle = '#a07030'; ctx.beginPath(); ctx.ellipse(80, 42, 46, 20, 0, Math.PI, 0); ctx.fill();
    // eye
    ctx.fillStyle = '#2a1a08'; ctx.beginPath(); ctx.arc(80, 88, 26, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e8c070'; ctx.lineWidth = 5; ctx.stroke();
    const eg = ctx.createRadialGradient(80, 88, 2, 80, 88, 22);
    eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.35, p.eye); eg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(80, 88, 20, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(72, 80, 5, 0, 7); ctx.fill();
    // little vanes
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(40, 14, 34, 5); ctx.fillRect(86, 14, 34, 5); ctx.fillStyle = '#8a6a30'; ctx.fillRect(76, 12, 8, 14);
}

function drawWyrm(ctx, p) {
    const gold = p.col;
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.moveTo(20, 150); ctx.quadraticCurveTo(40, 60, 90, 50); ctx.quadraticCurveTo(150, 46, 150, 90); ctx.quadraticCurveTo(130, 110, 100, 104); ctx.quadraticCurveTo(80, 120, 70, 160); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(60 + i * 12, 70 + (i % 2) * 6, 7, 0, Math.PI); ctx.fill(); }
    // horns
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.moveTo(84, 54); ctx.quadraticCurveTo(60, 20, 70, 6); ctx.quadraticCurveTo(80, 30, 96, 52); ctx.fill();
    ctx.beginPath(); ctx.moveTo(104, 50); ctx.quadraticCurveTo(100, 16, 116, 4); ctx.quadraticCurveTo(114, 30, 116, 50); ctx.fill();
    // eye
    ctx.fillStyle = p.eye; ctx.shadowColor = p.eye; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(118, 72, 9, 5, -0.2, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.fillRect(117, 67, 2, 10);
}

function drawPerson(ctx, p) {
    const skin = p.skin || '#e0b090';
    const hair = p.hair || '#333';
    const wide = p.kind === 'dwarf' ? 1.18 : p.kind === 'gnome' ? 1.08 : p.kind === 'elf' ? 0.9 : 1;
    const headY = p.kind === 'gnome' ? 84 : 76;
    // shoulders / clothes
    const cloth = { dwarf: '#7a3020', gnome: '#3a6a4a', elf: '#3a3a6a', witch: '#4a2a5a', monk: '#8a6a30', human: '#2a3a5a' }[p.kind] || '#444';
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.ellipse(80, 160, 62 * wide, 44, 0, Math.PI, 0); ctx.fill();
    if (p.kind === 'monk') { ctx.fillStyle = '#6a4a20'; ctx.beginPath(); ctx.ellipse(80, 132, 30, 12, 0, 0, 7); ctx.fill(); }
    if (p.kind === 'human' && p.tophat) { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(70, 120); ctx.lineTo(80, 140); ctx.lineTo(90, 120); ctx.fill(); }
    // neck
    ctx.fillStyle = shadeHex(skin, 0.85); ctx.fillRect(70, headY + 26, 20, 20);
    // ears (elf long)
    ctx.fillStyle = skin;
    if (p.kind === 'elf') {
        ctx.beginPath(); ctx.moveTo(52, headY); ctx.lineTo(30, headY - 22); ctx.lineTo(56, headY + 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(108, headY); ctx.lineTo(130, headY - 22); ctx.lineTo(104, headY + 10); ctx.fill();
    } else if (p.kind === 'gnome') {
        ctx.beginPath(); ctx.ellipse(50, headY + 2, 9, 13, -0.3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(110, headY + 2, 9, 13, 0.3, 0, 7); ctx.fill();
    }
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(80, headY, 30 * wide, 36, 0, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = hair;
    if (!p.bald) {
        ctx.beginPath(); ctx.ellipse(80, headY - 22, 32 * wide, 20, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(80 - 32 * wide, headY - 24, 8, 30); ctx.fillRect(80 + 32 * wide - 8, headY - 24, 8, 30);
        if (p.kind === 'witch' || p.kind === 'elf') { ctx.fillRect(80 - 32 * wide, headY - 10, 10, 60); ctx.fillRect(80 + 32 * wide - 10, headY - 10, 10, 60); }
    } else {
        ctx.fillStyle = hair; ctx.fillRect(80 - 30 * wide, headY - 6, 7, 18); ctx.fillRect(80 + 30 * wide - 7, headY - 6, 7, 18);
    }
    if (p.braid) {
        ctx.fillStyle = hair;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(44, headY + 14 + i * 12, 7, 7, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(116, headY + 14 + i * 12, 7, 7, 0, 0, 7); ctx.fill(); }
    }
    // eyes
    const ey = headY - 2;
    for (const ex of [68, 92]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 6, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = p.eyes || '#333'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, 1.4, 0, 7); ctx.fill();
        ctx.strokeStyle = shadeHex(hair, 0.8); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(ex - 7, ey - 8); ctx.lineTo(ex + 6, ey - 9); ctx.stroke();
    }
    // nose and mouth
    ctx.fillStyle = shadeHex(skin, 0.8);
    const nose = p.kind === 'gnome' ? 9 : p.kind === 'dwarf' ? 7 : 5;
    ctx.beginPath(); ctx.ellipse(80, headY + 8, nose * 0.7, nose, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6a3a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(80, headY + 16, 8, 0.2, Math.PI - 0.2); ctx.stroke();
    if (p.scar) { ctx.strokeStyle = 'rgba(150,60,50,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(94, headY - 14); ctx.lineTo(100, headY + 8); ctx.stroke(); }
    if (p.beard) {
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.moveTo(52, headY + 4); ctx.quadraticCurveTo(80, headY + (p.kind === 'dwarf' ? 80 : 60), 108, headY + 4); ctx.quadraticCurveTo(80, headY + 30, 52, headY + 4); ctx.fill();
        ctx.strokeStyle = '#6a3a2a'; ctx.beginPath(); ctx.arc(80, headY + 18, 6, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    if (p.moustache) {
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.moveTo(80, headY + 12); ctx.quadraticCurveTo(64, headY + 8, 60, headY + 18); ctx.quadraticCurveTo(70, headY + 14, 80, headY + 15); ctx.quadraticCurveTo(90, headY + 14, 100, headY + 18); ctx.quadraticCurveTo(96, headY + 8, 80, headY + 12); ctx.fill();
    }
    if (p.spectacles) {
        ctx.strokeStyle = '#d8c070'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(68, ey, 9, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(92, ey, 9, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(77, ey); ctx.lineTo(83, ey); ctx.stroke();
    }
    if (p.goggles) {
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(48, headY - 30, 64, 8);
        for (const gx of [66, 94]) { ctx.fillStyle = '#c89a40'; ctx.beginPath(); ctx.arc(gx, headY - 26, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#8ad0e0'; ctx.beginPath(); ctx.arc(gx, headY - 26, 7, 0, 7); ctx.fill(); }
    }
    if (p.hat) {
        ctx.fillStyle = '#2a1a3a';
        ctx.beginPath(); ctx.ellipse(80, headY - 28, 52, 10, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(52, headY - 30); ctx.lineTo(96, headY - 100); ctx.lineTo(108, headY - 30); ctx.fill();
        ctx.fillStyle = '#d0a030'; ctx.fillRect(56, headY - 40, 50, 6);
    }
    if (p.tophat) {
        ctx.fillStyle = '#121218';
        ctx.fillRect(50, headY - 34, 60, 6); ctx.fillRect(58, headY - 80, 44, 48);
        ctx.fillStyle = '#8a2020'; ctx.fillRect(58, headY - 42, 44, 6);
    }
}

function shadeHex(h, k) { const a = hexToArr(h); return rgb(...shade(a, k)); }
