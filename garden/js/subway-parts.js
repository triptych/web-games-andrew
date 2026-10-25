// Building blocks for the underground railway behind the hut's train ticket:
// procedural tile/concrete/poster textures, the vaulted station hall, and the
// three-car train. Everything is drawn from primitives and canvases, no files.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { rng, TAU } from './util.js';

// ------------------------------------------------------------------ layout
// World frame while the train is standing still: the track runs along z at x = 0,
// the platform is on the -x side, a second track (where other trains rush past)
// at x = 4.5. The hall is centred between the two tracks.

export const HALL = { cx: 2.25, hw: 11.25, wallY: 5, arch: 3.4, H: 42, pit: -1.0 };
export const TRAIN = { cars: 3, carLen: 14.5, halfW: 1.5, height: 3.5 };
TRAIN.len = TRAIN.cars * TRAIN.carLen;
export const PLATFORM = { x0: -9, x1: -1.8, z: 40 };
export const TRACK2_X = 4.5;
export const LEFT_X = HALL.cx - HALL.hw;     // -9
export const RIGHT_X = HALL.cx + HALL.hw;    // 13.5

/** Vault height above the hall centre line at x. */
export const vaultY = (x) => {
    const u = Math.min(1, Math.abs(x - HALL.cx) / HALL.hw);
    return HALL.wallY + HALL.arch * Math.sqrt(1 - u * u);
};

// ------------------------------------------------------------------ canvases

function cnv(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function asTexture(c, { srgb = true, repeat = true, aniso = 4 } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
}

/** Glazed wall tile, 0.3 m x 0.15 m, on a 1.2 m square. Returns { map, bump }. */
function tileTextures() {
    const n = 256, c = cnv(n), b = cnv(n);
    const x = c.getContext('2d'), y = b.getContext('2d');
    const r = rng('tiles');
    x.fillStyle = '#8d897f';
    x.fillRect(0, 0, n, n);
    y.fillStyle = '#000';
    y.fillRect(0, 0, n, n);
    const cols = 4, rows = 8, cw = n / cols, ch = n / rows;
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const off = (j % 2) * cw * 0.5;
            const px = i * cw + off, py = j * ch;
            const l = 226 + r() * 22;
            x.fillStyle = `rgb(${l},${l - 4},${l - 14})`;
            for (const dx of [0, -n]) x.fillRect(px + 2 + dx, py + 2, cw - 4, ch - 4);
            y.fillStyle = '#fff';
            for (const dx of [0, -n]) y.fillRect(px + 2 + dx, py + 2, cw - 4, ch - 4);
        }
    }
    // soot and age
    for (let i = 0; i < 260; i++) {
        x.fillStyle = `rgba(60,50,40,${r() * 0.05})`;
        x.beginPath();
        x.arc(r() * n, r() * n, 4 + r() * 18, 0, TAU);
        x.fill();
    }
    return { map: asTexture(c), bump: asTexture(b, { srgb: false }) };
}

function concreteTexture(base = [120, 118, 116]) {
    const n = 256, c = cnv(n), x = c.getContext('2d');
    const r = rng('concrete' + base[0]);
    x.fillStyle = `rgb(${base})`;
    x.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
        const l = (r() - 0.5) * 36;
        x.fillStyle = `rgba(${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${Math.abs(l) / 255})`;
        x.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 3);
    }
    for (let i = 0; i < 24; i++) {
        x.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`;
        x.beginPath();
        let px = r() * n, py = r() * n;
        x.moveTo(px, py);
        for (let k = 0; k < 6; k++) x.lineTo((px += (r() - 0.5) * 40), (py += (r() - 0.5) * 40));
        x.stroke();
    }
    return asTexture(c);
}

/** 0.6 m floor tiles on a 1.2 m square. */
function floorTexture() {
    const n = 256, c = cnv(n), x = c.getContext('2d');
    const r = rng('floor');
    x.fillStyle = '#4a4742';
    x.fillRect(0, 0, n, n);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const l = 128 + r() * 18;
        x.fillStyle = `rgb(${l + 6},${l},${l - 8})`;
        x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        for (let k = 0; k < 160; k++) {
            x.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
            x.fillRect(i * 128 + 3 + r() * 120, j * 128 + 3 + r() * 120, 2, 2);
        }
    }
    return asTexture(c);
}

/** Yellow tactile warning strip with a grid of studs. */
function tactileTexture() {
    const n = 128, c = cnv(n), x = c.getContext('2d');
    x.fillStyle = '#d9a91c';
    x.fillRect(0, 0, n, n);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        x.fillStyle = '#f4cc3c';
        x.beginPath();
        x.arc(i * 16 + 8, j * 16 + 8, 5.5, 0, TAU);
        x.fill();
        x.fillStyle = 'rgba(0,0,0,0.25)';
        x.beginPath();
        x.arc(i * 16 + 9, j * 16 + 10, 5.5, 0, TAU);
        x.fill();
        x.fillStyle = '#f7d65a';
        x.beginPath();
        x.arc(i * 16 + 8, j * 16 + 8, 4.6, 0, TAU);
        x.fill();
    }
    return asTexture(c);
}

function roundRect(x, px, py, w, h, rad) {
    x.beginPath();
    x.moveTo(px + rad, py);
    x.arcTo(px + w, py, px + w, py + h, rad);
    x.arcTo(px + w, py + h, px, py + h, rad);
    x.arcTo(px, py + h, px, py, rad);
    x.arcTo(px, py, px + w, py, rad);
    x.closePath();
}

/** An enamel station sign. */
export function signCanvas(title, sub, { bg = '#2a1d52', fg = '#fff6df', accent = '#b79bff', w = 1024, h = 256, line = true } = {}) {
    const c = cnv(w, h), x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = fg;
    x.lineWidth = 8;
    x.strokeRect(12, 12, w - 24, h - 24);
    x.fillStyle = fg;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `700 ${sub ? h * 0.42 : h * 0.5}px Georgia, "Times New Roman", serif`;
    x.fillText(title, w / 2, sub ? h * 0.4 : h * 0.52);
    if (sub) {
        x.fillStyle = accent;
        x.font = `600 ${h * 0.15}px system-ui, sans-serif`;
        x.fillText(sub, w / 2, h * 0.76);
    }
    if (line) {
        x.fillStyle = accent;
        x.fillRect(24, h - 34, w - 48, 8);
    }
    return c;
}

/** A vintage-style travel poster made of gradients and shapes. */
function posterCanvas(i) {
    const w = 256, h = 384, c = cnv(w, h), x = c.getContext('2d');
    const r = rng('poster' + i);
    const hue = (i * 47) % 360;
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hue},70%,22%)`);
    g.addColorStop(1, `hsl(${(hue + 50) % 360},75%,58%)`);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // a sun or moon, hills, a tiny train
    x.fillStyle = `hsla(${(hue + 160) % 360},90%,80%,0.95)`;
    x.beginPath();
    x.arc(60 + r() * 130, 110 + r() * 40, 30 + r() * 22, 0, TAU);
    x.fill();
    for (let k = 0; k < 3; k++) {
        x.fillStyle = `hsl(${(hue + 200 + k * 20) % 360},50%,${16 + k * 8}%)`;
        x.beginPath();
        x.moveTo(0, 270 + k * 24);
        for (let px = 0; px <= w; px += 16) x.lineTo(px, 230 + k * 24 + Math.sin(px * 0.03 + k * 2 + i) * 26 + r() * 6);
        x.lineTo(w, h);
        x.lineTo(0, h);
        x.fill();
    }
    const titles = ['VISIT THE ORCHARD', 'MIND THE GAP', 'LOST: ONE FOX', 'PLAY MORE GAMES', 'TEA AT PRISM HALT', 'THE LAST TRAIN IS EARLY', 'SEE THE POOL OF LIGHT', 'QUIET PLEASE'];
    x.fillStyle = '#fff6df';
    x.textAlign = 'center';
    x.font = '700 30px Georgia, serif';
    const words = titles[i % titles.length].split(' ');
    words.forEach((wd, k) => x.fillText(wd, w / 2, 48 + k * 34));
    x.strokeStyle = '#fff6df';
    x.lineWidth = 6;
    x.strokeRect(8, 8, w - 16, h - 16);
    return c;
}

/** A small route map: the line with its stations, a dot for the train. */
export function routeCanvas(progress, names) {
    const w = 1024, h = 128, c = cnv(w, h), x = c.getContext('2d');
    x.fillStyle = '#f1ead8';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#6a3fbf';
    x.fillRect(80, h / 2 - 7, w - 160, 14);
    names.forEach((nm, i) => {
        const px = 80 + (i / (names.length - 1)) * (w - 160);
        x.fillStyle = '#fff';
        x.strokeStyle = '#2a1d52';
        x.lineWidth = 6;
        x.beginPath();
        x.arc(px, h / 2, 17, 0, TAU);
        x.fill();
        x.stroke();
        x.fillStyle = '#2a1d52';
        x.font = '600 24px system-ui, sans-serif';
        x.textAlign = i === 0 ? 'left' : 'right';
        x.fillText(nm, i === 0 ? 40 : w - 40, 32);
    });
    const tx = 80 + progress * (w - 160);
    x.fillStyle = '#ff5fa8';
    x.beginPath();
    x.arc(tx, h / 2, 11, 0, TAU);
    x.fill();
    x.fillStyle = 'rgba(255,95,168,0.3)';
    x.beginPath();
    x.arc(tx, h / 2, 22, 0, TAU);
    x.fill();
    return c;
}

/** Amber dot-matrix board whose lines can be rewritten. */
export class LedBoard {
    constructor(w = 512, h = 128, color = '#ffb347') {
        this.c = cnv(w, h);
        this.x = this.c.getContext('2d');
        this.color = color;
        this.tex = asTexture(this.c, { repeat: false });
        this.last = '';
    }

    set(lines) {
        const key = lines.join('|');
        if (key === this.last) return;
        this.last = key;
        const { x, c } = this;
        x.fillStyle = '#080604';
        x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = this.color;
        x.shadowColor = this.color;
        x.shadowBlur = 8;
        x.textBaseline = 'middle';
        const lh = c.height / lines.length;
        lines.forEach((ln, i) => {
            x.font = `700 ${lh * 0.66}px "Courier New", monospace`;
            x.textAlign = 'left';
            x.fillText(ln, 18, lh * (i + 0.52));
        });
        x.shadowBlur = 0;
        // the dot-matrix grid
        x.fillStyle = 'rgba(0,0,0,0.5)';
        for (let px = 0; px < c.width; px += 4) x.fillRect(px, 0, 1, c.height);
        for (let py = 0; py < c.height; py += 4) x.fillRect(0, py, c.width, 1);
        this.tex.needsUpdate = true;
    }

    mesh(w, h) {
        const mat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    }
}

// ------------------------------------------------------------------ materials

export function subwayMaterials(base) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const tile = tileTextures();
    const strip = tactileTexture();
    const m = { ...base };
    m.tile = std({ map: tile.map, bumpMap: tile.bump, bumpScale: 1.2, roughness: 0.32, color: 0xf3ecdd });
    m.concrete = std({ map: concreteTexture(), roughness: 0.96, color: 0xb9b5ae });
    m.ceilingConcrete = std({ map: concreteTexture([90, 88, 92]), roughness: 1, color: 0x8a8790 });
    m.platform = std({ map: floorTexture(), roughness: 0.55, color: 0xdad4c8 });
    m.tactile = std({ map: strip, roughness: 0.6 });
    m.ballast = std({ map: concreteTexture([60, 58, 56]), roughness: 1, color: 0x6a6764 });
    m.sleeper = std({ color: 0x3a2f28, roughness: 0.9 });
    m.rail = std({ color: 0xa9adb8, roughness: 0.28, metalness: 0.9 });
    m.thirdRail = std({ color: 0x23242a, roughness: 0.6, metalness: 0.4 });
    m.steel = std({ color: 0x9aa0aa, roughness: 0.35, metalness: 0.85 });
    m.cream = std({ color: 0xece4d2, roughness: 0.45, metalness: 0.1 });
    m.violet = std({ color: 0x6a3fbf, roughness: 0.4, metalness: 0.15 });
    m.fabric = std({ color: 0x5b3aa6, roughness: 0.95 });
    m.rubber = std({ color: 0x2a2a31, roughness: 0.9 });
    m.panel = std({ color: 0xd8d3c6, roughness: 0.6 });
    m.black = std({ color: 0x111115, roughness: 0.6 });
    m.skin = std({ color: 0xd9a77f, roughness: 0.8 });
    m.emitWhite = std({ color: 0x000000, emissive: 0xfff1d6, emissiveIntensity: 2.4 });
    m.emitCool = std({ color: 0x000000, emissive: 0xcfe8ff, emissiveIntensity: 2.2 });
    m.emitViolet = std({ color: 0x000000, emissive: 0x9a6bff, emissiveIntensity: 2.6 });
    m.emitCyan = std({ color: 0x000000, emissive: 0x3fe6ff, emissiveIntensity: 2.6 });
    m.emitRed = std({ color: 0x000000, emissive: 0xff2a20, emissiveIntensity: 2.6 });
    m.emitAmber = std({ color: 0x000000, emissive: 0xffa030, emissiveIntensity: 2.2 });
    m.emitGreen = std({ color: 0x000000, emissive: 0x30ff70, emissiveIntensity: 2.2 });
    m.mosaic = std({ map: concreteTexture([70, 60, 110]), roughness: 0.4, color: 0xc9b8ff, emissive: 0x2a1a60, emissiveIntensity: 0.6 });
    return m;
}

// ------------------------------------------------------------------ geometry helpers

/** A box whose texture coordinates are in metres (times `s`), so tiles keep their size. */
export function ubox(w, h, d, s = 1 / 1.2) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
        for (let i = 0; i < 4; i++) {
            const k = f * 4 + i;
            uv.setXY(k, uv.getX(k) * dims[f][0] * s, uv.getY(k) * dims[f][1] * s);
        }
    }
    return g;
}

/**
 * Sweeps an (x, y) profile along z, with every face turned to face `inside`
 * (so the result is the inner skin of a tunnel or hall). UVs are in metres / uvScale.
 */
export function sweep(profile, z0, z1, inside, { uvScale = 1.2, zSteps = 1 } = {}) {
    const n = profile.length, rows = zSteps + 1;
    const pos = [], nor = [], uv = [], idx = [];
    // arc length along the profile
    const arc = [0];
    for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
    // segment normals (ty, -tx), flipped to face the inside point
    const segN = [];
    let flip = 0;
    for (let i = 0; i < n - 1; i++) {
        const tx = profile[i + 1][0] - profile[i][0], ty = profile[i + 1][1] - profile[i][1];
        const l = Math.hypot(tx, ty) || 1;
        const nx = ty / l, ny = -tx / l;
        segN.push([nx, ny]);
        const mx = (profile[i][0] + profile[i + 1][0]) / 2, my = (profile[i][1] + profile[i + 1][1]) / 2;
        flip += Math.sign(nx * (inside[0] - mx) + ny * (inside[1] - my));
    }
    const s = flip >= 0 ? 1 : -1;
    for (let r = 0; r < rows; r++) {
        const z = z0 + ((z1 - z0) * r) / zSteps;
        for (let i = 0; i < n; i++) {
            const a = segN[Math.max(0, i - 1)], b = segN[Math.min(n - 2, i)];
            let nx = a[0] + b[0], ny = a[1] + b[1];
            const l = Math.hypot(nx, ny) || 1;
            pos.push(profile[i][0], profile[i][1], z);
            nor.push((nx / l) * s, (ny / l) * s, 0);
            uv.push(z / uvScale, arc[i] / uvScale);
        }
    }
    for (let r = 0; r < rows - 1; r++) {
        for (let i = 0; i < n - 1; i++) {
            const i0 = r * n + i, i1 = i0 + 1, j0 = (r + 1) * n + i, j1 = j0 + 1;
            if (s > 0) idx.push(i0, i1, j0, i1, j1, j0);
            else idx.push(i0, j0, i1, i1, j0, j1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
}

/** Profile of the station hall: from the top of the left wall over the vault to the right wall's foot. */
export function hallProfile() {
    const pts = [];
    const { cx, hw, wallY, arch } = HALL;
    pts.push([cx - hw, -1.2]);
    pts.push([cx - hw, wallY]);
    for (let i = 1; i < 32; i++) {
        const a = Math.PI - (i / 32) * Math.PI;
        pts.push([cx + Math.cos(a) * hw, wallY + Math.sin(a) * arch]);
    }
    pts.push([cx + hw, wallY]);
    pts.push([cx + hw, -1.2]);
    return pts;
}

/** The tunnel's cross-section: floor, walls and an arch, as a loop starting at the floor's right edge. */
export const TUNNEL = { cx: HALL.cx, hw: 5.6, wallY: 2.2, arch: 2.6, floor: -1.0 };
export function tunnelProfile() {
    const { cx, hw, wallY, arch, floor } = TUNNEL;
    const pts = [[cx + hw, floor], [cx + hw * 0.3, floor], [cx - hw * 0.3, floor], [cx - hw, floor], [cx - hw, 0.6], [cx - hw, wallY]];
    for (let i = 1; i < 20; i++) {
        const a = Math.PI - (i / 20) * Math.PI;
        pts.push([cx + Math.cos(a) * hw, wallY + Math.sin(a) * arch]);
    }
    pts.push([cx + hw, wallY], [cx + hw, 0.6], [cx + hw, floor]);
    return pts;
}

/** A shape of the hall's outline with the tunnel mouth cut out: the wall at each end of the hall. */
export function endWallGeometry() {
    const { cx, hw, wallY, arch } = HALL;
    const shape = new THREE.Shape();
    shape.moveTo(cx - hw, -1.3);
    shape.lineTo(cx - hw, wallY);
    for (let i = 1; i < 32; i++) {
        const a = Math.PI - (i / 32) * Math.PI;
        shape.lineTo(cx + Math.cos(a) * hw, wallY + Math.sin(a) * arch);
    }
    shape.lineTo(cx + hw, wallY);
    shape.lineTo(cx + hw, -1.3);
    shape.closePath();
    const hole = new THREE.Path();
    const tp = tunnelProfile().slice(2, -1);   // skip the floor edge so the hole sits just above the pit floor
    hole.moveTo(tp[0][0], TUNNEL.floor + 0.02);
    for (const p of tp) hole.lineTo(p[0], p[1]);
    hole.lineTo(tp[tp.length - 1][0], TUNNEL.floor + 0.02);
    hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape, 8);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.2, pos.getY(i) / 1.2);
    return g;
}

// ------------------------------------------------------------------ the station hall

/**
 * One station. `kind` is 'hearthside' (the first one, with the stair up to the hut) or
 * 'prism' (the far one, with the glowing way through to the round room). Built around
 * z = 0; the caller moves the group to where the station sits along the line.
 */
export function buildHall(kind, mats, name) {
    const group = new THREE.Group();
    const colliders = [];
    const lamps = [];      // where the pooled hall lights can sit
    const boards = [];     // LedBoards to keep fresh
    const clocks = [];
    const b = new Batch();
    const H = HALL.H;
    const prism = kind === 'prism';
    const cx = HALL.cx;

    // vault and right-hand wall
    {
        const g = sweep(hallProfile().slice(1), -H, H, [cx, 3], { zSteps: 14 });
        b.add('tile', g, null);
    }
    // the vault above the wall tiles is plain painted plaster: a cap over the arch
    {
        const prof = [];
        for (let i = 0; i <= 32; i++) {
            const a = Math.PI - (i / 32) * Math.PI;
            prof.push([cx + Math.cos(a) * (HALL.hw - 0.02), HALL.wallY + Math.sin(a) * (HALL.arch - 0.02)]);
        }
        b.add('ceilingConcrete', sweep(prof, -H + 0.01, H - 0.01, [cx, 3], { zSteps: 14 }), null);
    }
    // ribs across the vault
    for (let z = -H + 3; z <= H; z += 6) {
        const prof = [];
        for (let i = 0; i <= 32; i++) {
            const a = Math.PI - (i / 32) * Math.PI;
            prof.push([cx + Math.cos(a) * (HALL.hw - 0.01), HALL.wallY + Math.sin(a) * (HALL.arch - 0.01)]);
        }
        b.add('concrete', sweep(prof, z - 0.28, z + 0.28, [cx, 3], { zSteps: 1 }), xf(0, -0.05, 0, 0, 1, 1, 1));
    }
    // end walls with the tunnel mouths
    for (const sz of [-1, 1]) {
        const g = endWallGeometry();
        b.add('tile', g, xf(0, 0, sz * H, sz > 0 ? Math.PI : 0));
        // a dark portal frame around the mouth
        const tp = tunnelProfile().slice(3, -2);
        for (let i = 0; i < tp.length - 1; i++) {
            const [x0, y0] = tp[i], [x1, y1] = tp[i + 1];
            const len = Math.hypot(x1 - x0, y1 - y0);
            b.add('black', new THREE.BoxGeometry(len + 0.05, 0.18, 0.4), xf((x0 + x1) / 2, (y0 + y1) / 2, sz * (H - 0.18), 0, 1, 1, 1, 0, Math.atan2(y1 - y0, x1 - x0)));
        }
    }
    // left wall: whole in the first station, with a portal in the far one
    const wallH = HALL.wallY + 1.3, wallMid = (HALL.wallY - 1.3) / 2;
    const gaps = prism ? [[-2.8, 2.8]] : [[-31.6, -28.4]];
    {
        let z = -H;
        const pieces = [];
        for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
            pieces.push([z, g0]);
            z = g1;
        }
        pieces.push([z, H]);
        for (const [z0, z1] of pieces) b.add('tile', ubox(0.3, wallH, z1 - z0), xf(LEFT_X - 0.15, wallMid, (z0 + z1) / 2));
        const [g0, g1] = gaps[0];
        const top = prism ? 4.0 : 2.7;
        b.add('tile', ubox(0.3, HALL.wallY - top, g1 - g0), xf(LEFT_X - 0.15, (HALL.wallY + top) / 2, (g0 + g1) / 2));
    }
    // a violet band and a dado rail along both walls
    // (the left wall's band stops short of the stair or the passage, so neither is barred)
    {
        const spans = [];
        let z = -H;
        for (const [g0, g1] of gaps) {
            spans.push([z, g0 - 0.25]);
            z = g1 + 0.25;
        }
        spans.push([z, H]);
        for (const [z0, z1] of spans) {
            b.add('violet', new THREE.BoxGeometry(0.05, 0.28, z1 - z0), xf(LEFT_X + 0.03, 1.9, (z0 + z1) / 2));
            b.add('steel', new THREE.BoxGeometry(0.07, 0.05, z1 - z0), xf(LEFT_X + 0.03, 1.72, (z0 + z1) / 2));
        }
        b.add('violet', new THREE.BoxGeometry(0.05, 0.28, 2 * H), xf(RIGHT_X - 0.03, 1.9, 0));
        b.add('steel', new THREE.BoxGeometry(0.07, 0.05, 2 * H), xf(RIGHT_X - 0.03, 1.72, 0));
    }

    // the platforms and the pit
    const pw = PLATFORM.x1 - PLATFORM.x0;
    b.add('platform', ubox(pw, 1.0, 2 * H), xf((PLATFORM.x0 + PLATFORM.x1) / 2, -0.5, 0));
    b.add('platform', ubox(RIGHT_X - 6.3, 1.0, 2 * H), xf((6.3 + RIGHT_X) / 2, -0.5, 0));
    b.add('ballast', ubox(6.3 - PLATFORM.x1, 0.04, 2 * H), xf((PLATFORM.x1 + 6.3) / 2, -0.98, 0));
    for (const [x0, x1] of [[PLATFORM.x1 - 0.65, PLATFORM.x1], [6.3, 6.95]]) {
        const tg = new THREE.BoxGeometry(x1 - x0, 0.02, 2 * H - 2);
        const uv = tg.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 0.8, uv.getY(i) * (2 * H) / 0.8);
        b.add('tactile', tg, xf((x0 + x1) / 2, 0.012, 0));
        b.add('black', new THREE.BoxGeometry(0.06, 0.04, 2 * H - 2), xf(x0 < 0 ? PLATFORM.x1 - 0.67 : 6.97, 0.02, 0));
    }
    // rails, sleepers and the third rail on both tracks
    for (const tx of [0, TRACK2_X]) {
        for (const s of [-1, 1]) b.add('rail', new THREE.BoxGeometry(0.08, 0.16, 2 * H), xf(tx + s * 0.72, -0.84, 0));
        b.add('thirdRail', new THREE.BoxGeometry(0.12, 0.1, 2 * H), xf(tx + 1.25, -0.88, 0));
        for (let z = -H + 0.4; z < H; z += 0.7) b.add('sleeper', new THREE.BoxGeometry(2.5, 0.12, 0.24), xf(tx, -0.92, z));
    }

    // columns down both platforms
    for (const colX of [-5.2, 9.7]) {
        const hh = vaultY(colX) + 0.1;
        for (let z = -32; z <= 32; z += 8) {
            b.add('concrete', new THREE.CylinderGeometry(0.34, 0.38, hh + 1, 14), xf(colX, hh / 2 - 0.5, z));
            b.add('violet', new THREE.CylinderGeometry(0.4, 0.4, 0.22, 14), xf(colX, 1.2, z));
            b.add('steel', new THREE.BoxGeometry(0.9, 0.3, 0.9), xf(colX, hh - 0.1, z));
            b.add('emitWhite', new THREE.BoxGeometry(0.1, 0.8, 0.1), xf(colX + (colX < 0 ? 0.4 : -0.4), 2.6, z));
            colliders.push({ x: colX, z, r: 0.45 });
        }
    }
    // hanging strip lights along the vault: three rows
    for (const lx of [-3.6, cx, 8.1]) {
        const ly = vaultY(lx) - 0.7;
        for (let z = -H + 5; z < H; z += 5) {
            b.add('steel', new THREE.BoxGeometry(0.05, 0.6, 0.05), xf(lx, ly + 0.35, z));
            b.add('steel', new THREE.BoxGeometry(0.34, 0.06, 2.6), xf(lx, ly, z));
            b.add(prism ? 'emitViolet' : 'emitWhite', new THREE.BoxGeometry(0.26, 0.04, 2.4), xf(lx, ly - 0.04, z));
        }
        if (lx !== cx) for (let z = -30; z <= 30; z += 15) lamps.push({ x: lx, y: ly - 0.8, z });
    }
    // benches, a bin, the vending and ticket machines on the platform
    for (const z of [-20, -4, 14, 28]) {
        const bx = LEFT_X + 0.6;
        b.add('wood', new THREE.BoxGeometry(0.5, 0.06, 2.2), xf(bx, 0.48, z));
        b.add('wood', new THREE.BoxGeometry(0.06, 0.55, 2.2), xf(bx - 0.22, 0.78, z));
        for (const dz of [-1, 1]) b.add('iron', new THREE.BoxGeometry(0.46, 0.46, 0.06), xf(bx, 0.23, z + dz));
        colliders.push({ x: bx, z: z - 0.7, r: 0.4 }, { x: bx, z: z + 0.7, r: 0.4 });
    }
    b.add('iron', new THREE.CylinderGeometry(0.2, 0.17, 0.8, 12), xf(-7.8, 0.4, -9));
    colliders.push({ x: -7.8, z: -9, r: 0.3 });
    b.add('steel', new THREE.BoxGeometry(0.7, 1.9, 1.2), xf(LEFT_X + 0.5, 0.95, 6.5));
    b.add('violet', new THREE.BoxGeometry(0.62, 1.7, 1.1), xf(LEFT_X + 0.57, 0.95, 6.5));
    b.add('emitCool', new THREE.BoxGeometry(0.04, 1.2, 0.9), xf(LEFT_X + 0.85, 1.05, 6.5));
    colliders.push({ x: LEFT_X + 0.6, z: 6.5, r: 0.7 });
    b.add('steel', new THREE.BoxGeometry(0.6, 1.5, 0.9), xf(LEFT_X + 0.45, 0.75, -12.8));
    b.add('emitAmber', new THREE.BoxGeometry(0.04, 0.3, 0.5), xf(LEFT_X + 0.76, 1.1, -12.8));
    colliders.push({ x: LEFT_X + 0.5, z: -12.8, r: 0.55 });

    // yellow "stand behind the line" studs are in the tactile strip; a platform-edge screen door frame is left out on purpose
    // overhead signs and clocks
    group.add(b.build(mats, { castShadow: false, receiveShadow: false }));

    const plane = (canvas, w, h, x, y, z, ry, emissive = 0.55) => {
        const tex = asTexture(canvas, { repeat: false });
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive, roughness: 0.6 }),
        );
        m.position.set(x, y, z);
        m.rotation.y = ry;
        group.add(m);
        return m;
    };
    // the name, in tile-sign style, up and down both walls
    const accent = prism ? '#7ff3ff' : '#b79bff';
    for (let z = -33; z <= 33; z += 11) {
        plane(signCanvas(name, prism ? 'Violet Line' : 'Violet Line · for the Hut', { accent, bg: prism ? '#14194a' : '#2a1d52' }), 3.2, 0.8, LEFT_X + 0.02, 2.75, z, Math.PI / 2);
        plane(signCanvas(name, 'Violet Line', { accent, bg: prism ? '#14194a' : '#2a1d52' }), 3.2, 0.8, RIGHT_X - 0.02, 2.75, z + 5.5, -Math.PI / 2);
    }
    // posters on the back wall
    for (let i = 0; i < 8; i++) {
        const z = -36 + i * 9 + (i % 2) * 1.2;
        if (!prism && Math.abs(z + 30) < 3.2) continue;
        if (prism && Math.abs(z) < 4.2) continue;
        plane(posterCanvas(i + (prism ? 8 : 0)), 1.1, 1.65, LEFT_X + 0.02, 1.55, z, Math.PI / 2, 0.25);
    }
    for (let i = 0; i < 6; i++) plane(posterCanvas(i + 20), 1.1, 1.65, RIGHT_X - 0.02, 1.55, -33 + i * 13, -Math.PI / 2, 0.25);
    // hanging boards that count down to the next train
    for (const z of [-14, 16]) {
        const led = new LedBoard(512, 128);
        const mesh = led.mesh(2.4, 0.6);
        mesh.position.set(-5.0, 3.9, z);
        mesh.rotation.y = Math.PI / 2;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 2.5), mats.black);
        back.position.set(-5.0 - 0.05, 3.9, z);
        const rodA = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 6), mats.steel);
        rodA.position.set(-5.0, 5.4, z - 1);
        const rodB = rodA.clone();
        rodB.position.z = z + 1;
        mesh.position.x += 0.12;
        group.add(mesh, back, rodA, rodB);
        boards.push(led);
        // the same board seen from the other side
        const mesh2 = led.mesh(2.4, 0.6);
        mesh2.position.set(-5.0 - 0.22, 3.9, z);
        mesh2.rotation.y = -Math.PI / 2;
        group.add(mesh2);
    }
    // a station clock on the back wall, redrawn once a second
    const clockCanvas = cnv(256);
    const clockTex = asTexture(clockCanvas, { repeat: false });
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }));
    clock.position.set(LEFT_X + 0.03, 3.6, prism ? -9 : 0);
    clock.rotation.y = Math.PI / 2;
    group.add(clock);
    clocks.push({ canvas: clockCanvas, tex: clockTex, last: -1 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 32), mats.brass);
    rim.position.copy(clock.position);
    rim.rotation.copy(clock.rotation);
    group.add(rim);

    // the other platform: a few silhouettes of commuters waiting, far across the tracks
    const waiters = new THREE.Group();
    const r = rng('waiters' + kind);
    for (let i = 0; i < 6; i++) {
        const p = person(mats, r, i);
        p.position.set(8.2 + r() * 3, 0, -28 + i * 11 + r() * 4);
        p.rotation.y = -Math.PI / 2 + (r() - 0.5) * 0.8;
        waiters.add(p);
    }
    group.add(waiters);

    return { group, colliders, lamps, boards, clocks };
}

/** Paints the face of an analogue clock. */
export function drawClock(c, date = new Date()) {
    const x = c.canvas.getContext('2d');
    const n = c.canvas.width, h = n / 2;
    x.fillStyle = '#f4efe0';
    x.fillRect(0, 0, n, n);
    x.strokeStyle = '#222';
    x.fillStyle = '#222';
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        x.lineWidth = i % 3 === 0 ? 8 : 4;
        x.beginPath();
        x.moveTo(h + Math.sin(a) * h * 0.78, h - Math.cos(a) * h * 0.78);
        x.lineTo(h + Math.sin(a) * h * 0.92, h - Math.cos(a) * h * 0.92);
        x.stroke();
    }
    const s = date.getSeconds(), m = date.getMinutes() + s / 60, hr = (date.getHours() % 12) + m / 60;
    const hand = (v, len, w, col) => {
        const a = v * TAU;
        x.strokeStyle = col;
        x.lineWidth = w;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(h, h);
        x.lineTo(h + Math.sin(a) * h * len, h - Math.cos(a) * h * len);
        x.stroke();
    };
    hand(hr / 12, 0.5, 10, '#222');
    hand(m / 60, 0.76, 7, '#222');
    hand(s / 60, 0.82, 3, '#c0392b');
    c.tex.needsUpdate = true;
}

// ------------------------------------------------------------------ people

/** A small blocky commuter, seated or standing, built from primitives. */
export function person(mats, r, i, seated = false) {
    const g = new THREE.Group();
    const palette = [0x3a4a6a, 0x7a2a3a, 0x2f5a46, 0x8a6a2a, 0x4a2a5a, 0x555a60, 0xb0643a];
    const coat = new THREE.MeshStandardMaterial({ color: palette[Math.floor(r() * palette.length)], roughness: 0.9 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x23242a, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, seated ? 0.35 : 0.5, 4, 10), coat);
    body.position.y = seated ? 0.95 : 1.15;
    body.scale.z = 0.75;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mats.skin);
    head.position.y = seated ? 1.42 : 1.62;
    g.add(head);
    const hairCol = [0x2a1d14, 0x7a5a2a, 0xb0b0b0, 0x111111, 0x8a3a1a][Math.floor(r() * 5)];
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.9 }));
    hair.position.copy(head.position);
    hair.position.y += 0.02;
    g.add(hair);
    if (i % 3 === 0) {   // a hat
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.1, 12), coat);
        hat.position.copy(head.position);
        hat.position.y += 0.15;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14), coat);
        brim.position.copy(hat.position);
        brim.position.y -= 0.05;
        g.add(hat, brim);
    }
    if (seated) {
        for (const s of [-1, 1]) {
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), trousers);
            thigh.position.set(s * 0.11, 0.55, 0.25);
            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), trousers);
            shin.position.set(s * 0.11, 0.28, 0.5);
            g.add(thigh, shin);
        }
    } else {
        for (const s of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), trousers);
            leg.position.set(s * 0.1, 0.38, 0);
            g.add(leg);
        }
    }
    g.userData.body = body;
    g.userData.head = head;
    return g;
}

/** A sleeping cat, curled on the seat. */
export function cat() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0xe0903a, roughness: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), fur);
    body.scale.set(1.3, 0.7, 1);
    body.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), fur);
    head.position.set(0.2, 0.1, 0.04);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur);
        ear.position.set(0.21, 0.19, 0.04 + s * 0.05);
        g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 12, Math.PI * 1.3), fur);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(-0.05, 0.04, 0.02);
    g.add(body, head, tail);
    g.userData.body = body;
    return g;
}

// ------------------------------------------------------------------ the train

/** Where, along one car (local z), the openings sit. */
const DOORS = [-4.35, 4.35];
const WINDOWS = [[0, 2.5], [-6.15, 1.5], [6.15, 1.5]];
export const SEATS = [[-3.5, 3.5], [-7.0, -5.2], [5.2, 7.0]];   // bench runs per car (local z)
const SILL = 0.95, LINTEL = 2.25, DOOR_H = 2.15;

/** The three-car train, centred on the origin, floor at y = 0, platform on the -x side. */
export function buildTrain(mats) {
    const group = new THREE.Group();
    const { cars, carLen, halfW } = TRAIN;
    const b = new Batch();
    const doorLeaves = [];
    const led = [];
    const lights = [];
    const interior = new THREE.Group();
    group.add(interior);
    const people = [];
    const r = rng('train');

    for (let c = 0; c < cars; c++) {
        const z0 = (c - (cars - 1) / 2) * carLen;
        const hl = carLen / 2;
        // floor, underframe, roof
        b.add('rubber', new THREE.BoxGeometry(halfW * 2, 0.12, carLen - 0.1), xf(0, -0.06, z0));
        b.add('black', new THREE.BoxGeometry(halfW * 2 - 0.4, 0.5, carLen - 3), xf(0, -0.35, z0));
        for (const bz of [-5, 5]) {
            b.add('iron', new THREE.BoxGeometry(2.4, 0.25, 2.4), xf(0, -0.62, z0 + bz));
            for (const wz of [-0.8, 0.8]) for (const s of [-1, 1]) b.add('steel', new THREE.CylinderGeometry(0.46, 0.46, 0.14, 18), xf(s * 1.0, -0.68, z0 + bz + wz, 0, 1, 1, 1, 0, Math.PI / 2));
        }
        b.add('cream', new THREE.BoxGeometry(halfW * 2, 0.1, carLen - 0.1), xf(0, TRAIN.height - 0.05, z0));
        b.add('steel', new THREE.BoxGeometry(halfW * 1.2, 0.12, carLen - 1), xf(0, TRAIN.height + 0.06, z0));
        // interior ceiling lights
        for (const lz of [-4.4, 0, 4.4]) b.add('emitWhite', new THREE.BoxGeometry(0.5, 0.03, 2.4), xf(0, TRAIN.height - 0.12, z0 + lz));
        // side walls with window and door openings
        for (const side of [-1, 1]) {
            const x = side * (halfW - 0.04);
            const openings = [
                ...DOORS.map((z) => [z, 1.4, 0, DOOR_H]),
                ...WINDOWS.map(([z, w]) => [z, w, SILL, LINTEL]),
            ].sort((p, q) => p[0] - q[0]);
            // lower and upper strips plus pillars between openings
            let cur = -hl;
            const solid = (za, zb, y0, y1, key) => {
                if (zb - za < 0.01) return;
                b.add(key, new THREE.BoxGeometry(0.08, y1 - y0, zb - za), xf(x, (y0 + y1) / 2, z0 + (za + zb) / 2));
            };
            for (const [oz, ow, oy0, oy1] of openings) {
                const a = oz - ow / 2, e = oz + ow / 2;
                solid(cur, a, 0, TRAIN.height, 'cream');
                if (oy0 > 0) solid(a, e, 0, oy0, 'cream');
                solid(a, e, oy1, TRAIN.height, 'cream');
                cur = e;
            }
            solid(cur, hl, 0, TRAIN.height, 'cream');
            // livery stripe
            {
                let za = -hl + 0.05;
                for (const dz of [...DOORS, hl + 1]) {
                    const zb = Math.min(hl - 0.05, dz - 0.75);
                    if (zb > za) b.add('violet', new THREE.BoxGeometry(0.1, 0.16, zb - za), xf(x + side * 0.02, 0.62, z0 + (za + zb) / 2));
                    za = dz + 0.75;
                }
            }
            b.add('violet', new THREE.BoxGeometry(0.1, 0.12, carLen - 0.1), xf(x + side * 0.02, TRAIN.height - 0.3, z0));
            // window frames
            for (const [oz, ow] of WINDOWS) {
                const fy = (SILL + LINTEL) / 2, fh = LINTEL - SILL;
                for (const dz of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.1, fh, 0.05), xf(x, fy, z0 + oz + dz * ow / 2));
                for (const yy of [SILL, LINTEL]) b.add('steel', new THREE.BoxGeometry(0.1, 0.05, ow), xf(x, yy, z0 + oz));
            }
            // door leaves
            for (const dz of DOORS) {
                for (const leafSide of [-1, 1]) {
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, DOOR_H, 0.68), mats.cream);
                    leaf.position.set(x, DOOR_H / 2, z0 + dz + leafSide * 0.35);
                    // a window in each leaf
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.4), mats.black);
                    glass.position.set(0, 0.45, 0);
                    leaf.add(glass);
                    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, DOOR_H, 0.04), mats.violet);
                    edge.position.set(0, 0, -leafSide * 0.32);
                    leaf.add(edge);
                    group.add(leaf);
                    doorLeaves.push({ mesh: leaf, side, home: leaf.position.z, dir: leafSide, car: c, doorZ: z0 + dz });
                }
                // the green door-open lamp above the door
                b.add(side < 0 ? 'emitGreen' : 'emitRed', new THREE.BoxGeometry(0.1, 0.1, 0.2), xf(x - side * 0.02, DOOR_H + 0.15, z0 + dz));
            }
        }
        // benches along the walls (between the doors) with violet fabric
        for (const [sa, sb] of SEATS) {
            for (const side of [-1, 1]) {
                const sx = side * (halfW - 0.37);
                b.add('steel', new THREE.BoxGeometry(0.5, 0.3, sb - sa), xf(sx, 0.2, z0 + (sa + sb) / 2));
                b.add('fabric', new THREE.BoxGeometry(0.5, 0.1, sb - sa), xf(sx, 0.43, z0 + (sa + sb) / 2));
                // back-rest under the windows
                b.add('fabric', new THREE.BoxGeometry(0.08, 0.38, sb - sa), xf(side * (halfW - 0.12), 0.7, z0 + (sa + sb) / 2));
            }
        }
        // handrails: two long poles overhead, vertical poles by the doors, and hanging grips
        for (const px of [-0.55, 0.55]) b.add('steel', new THREE.CylinderGeometry(0.025, 0.025, carLen - 0.4, 8).rotateX(Math.PI / 2), xf(px, 2.45, z0));
        for (const dz of DOORS) for (const side of [-1, 1]) {
            for (const s of [-1, 1]) b.add('steel', new THREE.CylinderGeometry(0.025, 0.025, TRAIN.height - 0.2, 8), xf(side * 0.9, TRAIN.height / 2, z0 + dz + s * 0.9));
        }
        for (let gz = -6.5; gz <= 6.5; gz += 1.3) for (const px of [-0.55, 0.55]) {
            b.add('rubber', new THREE.TorusGeometry(0.085, 0.015, 6, 14), xf(px, 2.28, z0 + gz, Math.PI / 2));
            b.add('steel', new THREE.BoxGeometry(0.02, 0.15, 0.02), xf(px, 2.38, z0 + gz));
        }
        // end of the car: the gangway frame (open walk-through) and a luggage rack either side
        for (const side of [-1, 1]) {
            b.add('steel', new THREE.BoxGeometry(2.6, 0.08, 0.06), xf(0, TRAIN.height - 0.22, z0 + side * (hl - 0.04)));
            for (const s of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.08, TRAIN.height, 0.06), xf(s * 1.0, TRAIN.height / 2, z0 + side * (hl - 0.04)));
            b.add('black', new THREE.BoxGeometry(2.0, 0.04, 0.2), xf(0, 0.02, z0 + side * (hl - 0.05)));
        }
        // a car light that the pooled lighting can read
        const light = new THREE.PointLight(0xffe9c8, 7, 11, 1.7);
        light.position.set(0, TRAIN.height - 0.5, z0);
        group.add(light);
        lights.push(light);

        // route strips above the doors, an LED board at each end, advert panels
        for (const side of [-1, 1]) {
            const lbd = new LedBoard(512, 96);
            const m = lbd.mesh(1.5, 0.28);
            m.position.set(0, 2.9, z0 + side * (hl - 0.12));
            m.rotation.y = side > 0 ? Math.PI : 0;
            interior.add(m);
            led.push(lbd);
        }
        for (const side of [-1, 1]) {
            const route = { canvas: null };
            route.canvas = cnv(1024, 128);
            route.tex = asTexture(route.canvas, { repeat: false });
            const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.275), new THREE.MeshBasicMaterial({ map: route.tex, toneMapped: false }));
            m.position.set(side * (halfW - 0.1), 2.65, z0 + (c % 2 ? 0 : 0));
            m.rotation.y = -side * Math.PI / 2;
            interior.add(m);
            led.route ??= [];
            led.route.push(route);
        }
        // adverts on the pillars between windows and doors
        for (const side of [-1, 1]) {
            const tex = asTexture(posterCanvas(40 + c * 2 + (side > 0 ? 1 : 0)), { repeat: false });
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 }));
            m.position.set(side * (halfW - 0.09), 1.55, z0 + 2.62);
            m.rotation.y = -side * Math.PI / 2;
            interior.add(m);
        }
        // passengers
        const placeAt = [[-1, -2.4], [1, 2.6], [-1, 1.5], [1, -1.2], [-1, 6.2]];
        const count = c === 0 ? 3 : c === 1 ? 4 : 2;
        for (let k = 0; k < count; k++) {
            const [side, pz] = placeAt[(k + c * 2) % placeAt.length];
            const p = person(mats, r, k + c, true);
            p.position.set(side * (halfW - 0.4), 0.46 - 0.46, z0 + pz);
            p.position.y = 0;
            p.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
            interior.add(p);
            people.push(p);
        }
        if (c === 1) {
            const ct = cat();
            ct.position.set(halfW - 0.4, 0.48, z0 - 3.0);
            ct.rotation.y = Math.PI + 0.4;
            interior.add(ct);
            people.push(ct);
        }
    }
    // cab ends of the train: closed cream faces with a dark windscreen, a headlamp and a tail lamp
    for (const s of [-1, 1]) {
        const z = s * (TRAIN.len / 2);
        b.add('cream', new THREE.BoxGeometry(halfW * 2, TRAIN.height, 0.12), xf(0, TRAIN.height / 2, z));
        b.add('black', new THREE.BoxGeometry(2.2, 1.0, 0.14), xf(0, 2.1, z + s * 0.02));
        b.add('violet', new THREE.BoxGeometry(halfW * 2, 0.2, 0.15), xf(0, 0.8, z + s * 0.01));
        for (const x of [-0.9, 0.9]) b.add('emitWhite', new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14).rotateX(Math.PI / 2), xf(x, 1.0, z + s * 0.1));
    }
    group.add(b.build(mats, { castShadow: false, receiveShadow: false }));
    return { group, doorLeaves, led, lights, people, interior };
}
