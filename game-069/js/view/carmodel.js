/**
 * carmodel.js — procedural cars. One builder makes every car in the game from a "look":
 *   { kind, levels: { engine, drive, tires, susp, body, nitro }, paint | paintHex, livery, trim | trimHex, num }
 *
 * kind picks the body (buggy, pickup, rally, dune, swamp, ice, trophy, raven); the upgrade levels
 * bolt parts on, so the player's tiny featureless primer Bucket grows exhausts, a scoop, a blower,
 * wings, bigger tyres on better rims, coil springs, a bull bar, a roll cage, nerf bars, a light bar,
 * riveted armour and nitro bottles as the career goes on.
 *
 * The livery (stripes, flames, numbers...) is painted into one canvas whose regions are mapped onto
 * the left side, right side and roof of the body, so text reads the right way round on both sides.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paintById, trimById } from '../sim/parts.js';
import { canvas, cssHex, treadTexture, softDot } from './textures.js';

const KINDS = {
    //        length width tub-h cabin [z, len, h, w]       wheelbase  base wheel r  hood?
    buggy:  { L: 2.9, W: 1.55, H: 0.5, cab: [-0.25, 1.2, 0.62, 1.2], wb: 0.37, r: 0.36, open: false },
    pickup: { L: 4.3, W: 1.95, H: 0.75, cab: [0.25, 1.5, 0.8, 1.75], wb: 0.33, r: 0.46, bed: true },
    rally:  { L: 3.8, W: 1.75, H: 0.62, cab: [-0.2, 2.0, 0.66, 1.55], wb: 0.33, r: 0.4, hatch: true },
    dune:   { L: 3.3, W: 1.7, H: 0.38, cab: [-0.2, 1.4, 0.0, 1.4], wb: 0.38, r: 0.44, open: true },
    swamp:  { L: 3.6, W: 1.9, H: 0.6, cab: [-0.3, 1.4, 0.0, 1.6], wb: 0.34, r: 0.62, open: true, fan: true },
    ice:    { L: 3.9, W: 1.8, H: 0.48, cab: [-0.35, 1.6, 0.5, 1.4], wb: 0.35, r: 0.4, wedge: true },
    trophy: { L: 4.6, W: 2.05, H: 0.62, cab: [-0.4, 1.7, 0.72, 1.7], wb: 0.36, r: 0.52, neon: true },
    raven:  { L: 4.2, W: 1.95, H: 0.5, cab: [-0.4, 1.6, 0.55, 1.45], wb: 0.36, r: 0.46, raven: true },
};

const matCache = new Map();
const _probe = { i: 0, f: 0, d: 0, tx: 0, tz: 1 };
function std(hex, rough = 0.6, metal = 0, extra = {}) {
    const key = `${hex}|${rough}|${metal}|${JSON.stringify(extra)}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, ...extra });
    matCache.set(key, m);
    return m;
}
const DARK = () => std(0x1c1d21, 0.55, 0.2);
const CHROME = () => std(0xe8ecf0, 0.15, 1);
const GOLD = () => std(0xe8b33a, 0.25, 1);
const GLASS = () => std(0x0e1622, 0.08, 0.6);

// ------------------------------------------------------------------ livery canvas
function liveryCanvas(look, paintHex, trimHex) {
    const { c, g } = canvas(512, 512);
    g.fillStyle = cssHex(paintHex);
    g.fillRect(0, 0, 512, 512);
    const trim = cssHex(trimHex);
    const lv = look.livery || 'none';
    const num = String(look.num ?? 7);
    // Region rectangles: [x, y, w, h, frontAtLeft]
    const regions = { left: [0, 0, 512, 160, true], right: [0, 170, 512, 160, false], top: [0, 340, 512, 160, true] };
    const roundel = (x, y, r, rot = 0) => {
        g.save();
        g.translate(x, y); g.rotate(rot);
        g.fillStyle = '#f6f3ea';
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.lineWidth = r * 0.12; g.strokeStyle = trim; g.stroke();
        g.fillStyle = '#16161a';
        g.font = `900 ${r * 1.15}px "Bungee", "Arial Black", Impact, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(num, 0, r * 0.06);
        g.restore();
    };
    for (const [name, [x, y, w, h, frontLeft]] of Object.entries(regions)) {
        g.save();
        g.beginPath(); g.rect(x, y, w, h); g.clip();
        const fx = (u) => x + (frontLeft ? u : 1 - u) * w;    // u: 0 = front, 1 = rear
        if (lv === 'stripes' || lv === 'halloway') {
            g.fillStyle = trim;
            if (name === 'top') { g.fillRect(x, y + h * 0.36, w, h * 0.1); g.fillRect(x, y + h * 0.54, w, h * 0.1); }
            else { g.fillRect(x, y + h * 0.42, w, h * 0.12); g.fillRect(x, y + h * 0.6, w, h * 0.05); }
        }
        if (lv === 'flames') {
            const cols = ['#ffd23a', '#ff8a1f', '#e8321e'];
            cols.forEach((col, k) => {
                g.fillStyle = col;
                g.beginPath();
                const yy = name === 'top' ? y + h * 0.1 : y + h * 0.2;
                const hh = name === 'top' ? h * 0.8 : h * 0.75;
                g.moveTo(fx(0), yy + hh * 0.05);
                for (let s = 0; s <= 6; s++) {
                    const u = 0.12 + s * 0.07 - k * 0.04;
                    g.lineTo(fx(u + 0.06), yy + hh * (s / 6) - hh * 0.06);
                    g.lineTo(fx(u - 0.02), yy + hh * ((s + 0.5) / 6));
                }
                g.lineTo(fx(0), yy + hh);
                g.closePath();
                g.fill();
            });
        }
        if (lv === 'checker') {
            const s = h / 6;
            for (let r = 0; r < 6; r++) for (let q = 0; q < 10; q++) {
                if ((r + q) % 2) continue;
                g.fillStyle = trim;
                g.fillRect(fx(0.62 + q * 0.04) - (frontLeft ? 0 : w * 0.04), y + r * s, w * 0.04, s);
            }
        }
        if (lv === 'bolt') {
            g.fillStyle = trim;
            g.beginPath();
            const yy = y + h * 0.25, hh = h * 0.5;
            g.moveTo(fx(0.05), yy + hh * 0.5); g.lineTo(fx(0.4), yy); g.lineTo(fx(0.38), yy + hh * 0.42);
            g.lineTo(fx(0.95), yy + hh * 0.3); g.lineTo(fx(0.55), yy + hh); g.lineTo(fx(0.57), yy + hh * 0.6);
            g.closePath(); g.fill();
        }
        if (lv === 'splatter') {
            let s = 1;
            const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
            g.fillStyle = 'rgba(70,46,24,0.85)';
            for (let k = 0; k < 70; k++) {
                const u = Math.pow(rnd(), 0.6), r = 3 + rnd() * 14;
                g.beginPath(); g.arc(fx(1 - u * 0.9), y + h * (0.4 + rnd() * 0.6), r, 0, Math.PI * 2); g.fill();
            }
        }
        if (lv === 'halloway') {
            g.fillStyle = '#d9a62e';
            g.font = `900 ${h * 0.22}px "Bungee", "Arial Black", sans-serif`;
            g.textAlign = 'center';
            if (name !== 'top') g.fillText('HALLOWAY', x + w * 0.5, y + h * 0.3);
        }
        if (lv !== 'none' && lv !== 'splatter') {
            if (name === 'top') roundel(x + w * 0.5, y + h * 0.5, h * 0.36, frontLeft ? Math.PI / 2 : -Math.PI / 2);
            else roundel(x + w * 0.5, y + h * 0.5, h * 0.33);
        } else if (lv === 'splatter' || lv === 'none') {
            if (look.num != null && lv === 'splatter' && name !== 'top') roundel(x + w * 0.5, y + h * 0.48, h * 0.3);
        }
        g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** Map a box-like geometry's UVs into the livery canvas regions by face direction. */
function liveryUV(geo, W, H, L) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    const px = 1 / 512;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
        const uFront = (L / 2 - z) / L;                 // 0 at the nose
        const vy = (y + H / 2) / H;                      // 0 at the bottom
        let u, v;
        if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz) && ny > 0) {
            u = uFront; v = 1 - (340 + 160 * ((x + W / 2) / W)) * px;
        } else if (Math.abs(nx) >= Math.abs(nz) && Math.abs(nx) >= Math.abs(ny)) {
            if (nx > 0) { u = uFront; v = 1 - (160 * (1 - vy)) * px; }
            else { u = 1 - uFront; v = 1 - (170 + 160 * (1 - vy)) * px; }
        } else { u = 0.99; v = 0.005; }
        uv.setXY(i, Math.max(0, Math.min(1, u)), v);
    }
    uv.needsUpdate = true;
}

const tube = (a, b, r, mat) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
};
const boxM = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const cylM = (rt, rb, h, mat, s = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat);

// ------------------------------------------------------------------ the car
export class CarModel {
    constructor(look, opts = {}) {
        this.look = look;
        const K = KINDS[look.kind] || KINDS.buggy;
        this.K = K;
        const lv = { engine: 0, drive: 0, tires: 0, susp: 0, body: 0, nitro: 0, ...(look.levels || {}) };
        const L = (k) => Math.round(lv[k] || 0);
        const paint = look.paintHex ?? paintById(look.paint).hex;
        const metal = look.paintHex != null ? 0.25 : (paintById(look.paint).metal ?? 0.2);
        const trim = look.trimHex ?? trimById(look.trim).hex;
        this.paintHex = paint;

        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.wheels = [];
        this.flames = [];
        this.lamps = [];

        // Wheels and ride height from the tyre and suspension levels.
        const tl = L('tires'), sl = L('susp');
        const wr = K.r + tl * 0.035 + (look.kind === 'buggy' ? 0 : 0.02);
        const ww = 0.26 + tl * 0.03 + (K.fan ? 0.18 : 0);
        const ride = 0.12 + sl * 0.035 + (K.fan ? 0.12 : 0);
        this.wr = wr;
        const tubY = wr + ride + K.H / 2 - 0.12;
        const W = K.W, H = K.H, Lh = K.L;

        // ------------------------------------------------------------ the tub
        const tex = liveryCanvas(look, paint, trim);
        this.liveryTex = tex;
        const paintM = new THREE.MeshStandardMaterial({ map: tex, roughness: metal > 0.6 ? 0.18 : 0.32, metalness: metal });
        this.paintM = paintM;
        const tubG = new RoundedBoxGeometry(W, H, Lh, 2, Math.min(0.14, H * 0.3));
        if (K.wedge) {
            const p = tubG.attributes.position;
            for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setY(i, p.getY(i) - (p.getZ(i) / (Lh / 2)) * H * 0.55);
            tubG.computeVertexNormals();
        }
        liveryUV(tubG, W, H, Lh);
        const tub = new THREE.Mesh(tubG, paintM);
        tub.position.y = tubY;
        this.body.add(tub);

        // Hood bulge for the closed bodies.
        const darkM = DARK();
        if (!K.open && !K.wedge) {
            const hood = new THREE.Mesh(new RoundedBoxGeometry(W * 0.86, 0.14, Lh * 0.3, 1, 0.05), std(paint, 0.35, metal));
            hood.position.set(0, tubY + H / 2 + 0.03, Lh * 0.28);
            this.body.add(hood);
        }

        // ------------------------------------------------------------ cabin
        const [cz, cl, ch, cw] = K.cab;
        const topY = tubY + H / 2;
        if (ch > 0) {
            const cabG = new RoundedBoxGeometry(cw, ch, cl, 2, 0.12);
            const p = cabG.attributes.position;
            // Rake the windscreen and the back.
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i), z = p.getZ(i);
                if (y > 0) p.setZ(i, z - Math.sign(z) * (z > 0 ? 0.28 : K.hatch ? 0.1 : 0.16) * (y / (ch / 2)));
            }
            cabG.computeVertexNormals();
            const cab = new THREE.Mesh(cabG, std(paint, 0.32, metal));
            cab.position.set(0, topY + ch / 2 - 0.02, cz);
            this.body.add(cab);
            // Windows: slightly inset dark glass on each face.
            const glass = GLASS();
            const ws = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.82, ch * 0.62), glass);
            ws.position.set(0, topY + ch * 0.55, cz + cl / 2 - 0.12);
            ws.rotation.x = -0.42;
            this.body.add(ws);
            for (const s of [-1, 1]) {
                const sw = new THREE.Mesh(new THREE.PlaneGeometry(cl * 0.62, ch * 0.5), glass);
                sw.position.set(s * (cw / 2 + 0.005), topY + ch * 0.55, cz - 0.04);
                sw.rotation.y = s * Math.PI / 2;
                this.body.add(sw);
            }
            const rw = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.7, ch * 0.45), glass);
            rw.position.set(0, topY + ch * 0.55, cz - cl / 2 + 0.1);
            rw.rotation.y = Math.PI; rw.rotation.x = -0.3;
            this.body.add(rw);
        } else {
            // Open cockpit: seat, wheel and a helmeted driver.
            this.body.add(boxM(0.6, 0.5, 0.5, darkM, 0, topY + 0.1, cz - 0.2));
            const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), std(trim, 0.3, 0.2));
            helmet.position.set(0, topY + 0.62, cz);
            this.body.add(helmet);
            const visor = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 8, -0.9, 1.8, 1.1, 0.7), GLASS());
            visor.position.copy(helmet.position);
            this.body.add(visor);
            this.body.add(boxM(0.5, 0.36, 0.3, std(0x2a2a30, 0.8), 0, topY + 0.3, cz));
        }
        if (K.bed) {
            this.body.add(boxM(W * 0.94, 0.08, Lh * 0.36, darkM, 0, topY + 0.02, -Lh * 0.28));
            for (const s of [-1, 1]) this.body.add(boxM(0.08, 0.32, Lh * 0.36, std(paint, 0.35, metal), s * W * 0.46, topY + 0.16, -Lh * 0.28));
        }
        if (K.fan) {
            // Airboat fan in a cage.
            const cage = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 24), std(0xc8ccd2, 0.4, 0.8));
            cage.position.set(0, topY + 1.05, -Lh / 2 + 0.1);
            this.body.add(cage);
            const fan = new THREE.Group();
            for (let k = 0; k < 2; k++) fan.add(boxM(0.14, 1.5, 0.04, std(0x6a4a2a, 0.6), 0, 0, 0)).rotation.z = k * Math.PI / 2;
            fan.position.copy(cage.position);
            this.body.add(fan);
            this.fan = fan;
        }
        if (K.raven) {
            // Gold raven hood ornament: a little swept wing shape.
            const orn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), GOLD());
            orn.rotation.x = Math.PI / 2;
            orn.position.set(0, topY + 0.12, Lh * 0.42);
            this.body.add(orn);
            for (const s of [-1, 1]) {
                const wng = boxM(0.5, 0.03, 0.18, GOLD(), s * 0.22, topY + 0.14, Lh * 0.38);
                wng.rotation.y = s * 0.5; wng.rotation.z = s * 0.25;
                this.body.add(wng);
            }
        }
        if (K.neon) {
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, Lh * 0.9), new THREE.MeshBasicMaterial({ color: trim, transparent: true, opacity: 0.55, map: softDot(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
            glow.rotation.x = -Math.PI / 2;
            glow.position.y = 0.06;
            this.root.add(glow);
        }

        // Lights.
        const head = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
        const tail = new THREE.MeshBasicMaterial({ color: 0x8a0a06, toneMapped: false });
        this.tailM = tail;
        for (const s of [-1, 1]) {
            const hl = boxM(0.26, 0.12, 0.04, head, s * W * 0.32, tubY + H * 0.15, Lh / 2 + 0.005);
            this.body.add(hl);
            const tl2 = boxM(0.24, 0.1, 0.04, tail, s * W * 0.34, tubY + H * 0.15, -Lh / 2 - 0.005);
            this.body.add(tl2);
        }

        // ------------------------------------------------------------ upgrades you can see
        const el = L('engine'), dl = L('drive'), bl = L('body'), nl = L('nitro');
        const rearZ = -Lh / 2, exY = tubY - H * 0.2;
        const pipes = el >= 5 ? CHROME() : std(0x6a6a6e, 0.4, 0.8);
        const exhaustTips = [];
        if (el >= 1) {
            const xs = el >= 2 ? [-W * 0.25, W * 0.25] : [W * 0.3];
            for (const x of xs) {
                const pipe = cylM(0.07 + el * 0.008, 0.07 + el * 0.008, 0.5, pipes, 10);
                pipe.rotation.x = Math.PI / 2;
                pipe.position.set(x, exY, rearZ - 0.12);
                this.body.add(pipe);
                exhaustTips.push(new THREE.Vector3(x, exY, rearZ - 0.38));
            }
        }
        if (el >= 3) {
            const scoop = new THREE.Mesh(new RoundedBoxGeometry(W * 0.36, 0.22, 0.6, 1, 0.06), std(paint, 0.35, metal));
            scoop.position.set(0, topY + 0.14, Lh * 0.26);
            this.body.add(scoop);
            this.body.add(boxM(W * 0.3, 0.12, 0.04, darkM, 0, topY + 0.16, Lh * 0.26 + 0.31));
        }
        if (el >= 4) {
            const sc = el >= 5 ? CHROME() : std(0x9aa0a8, 0.35, 0.8);
            const blower = boxM(0.5, 0.32, 0.5, sc, 0, topY + 0.38, Lh * 0.3);
            this.body.add(blower);
            this.body.add(boxM(0.6, 0.12, 0.32, darkM, 0, topY + 0.6, Lh * 0.3));
            for (const s of [-1, 1]) {
                const p = cylM(0.08, 0.08, 0.06, sc, 12);
                p.rotation.z = Math.PI / 2;
                p.position.set(s * 0.28, topY + 0.38, Lh * 0.3 + 0.1);
                this.body.add(p);
            }
            if (el >= 5) for (let k = -1; k <= 1; k++) {
                const st = cylM(0.06, 0.06, 0.32, CHROME(), 8);
                st.position.set(k * 0.16, topY + 0.78, Lh * 0.3);
                this.body.add(st);
            }
        }
        if (dl >= 1) for (const s of [-1, 1]) this.body.add(boxM(0.36, 0.42, 0.04, darkM, s * (W / 2 + ww * 0.35), wr * 0.6, -Lh * K.wb * 1.0 - wr - 0.06));
        if (dl >= 2) {
            this.body.add(boxM(0.6, 0.12, 0.18, std(0x6a6a6e, 0.4, 0.7), 0, tubY - H * 0.45, rearZ - 0.08));
            const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), std(0xd8322a, 0.5, 0.3));
            hook.position.set(0, tubY - H * 0.45, rearZ - 0.22);
            this.body.add(hook);
        }
        if (dl === 3) {
            const duck = boxM(W * 0.9, 0.06, 0.32, std(paint, 0.35, metal), 0, topY + 0.08, rearZ + 0.2);
            duck.rotation.x = -0.35;
            this.body.add(duck);
        }
        if (dl >= 4) {
            const wingM = dl >= 5 ? std(trim, 0.35, 0.3) : std(paint, 0.35, metal);
            const wy = topY + (ch > 0 ? Math.max(0.5, ch * 0.75) : 0.65);
            const wing = boxM(W * 1.02, 0.06, 0.5, wingM, 0, wy, rearZ + 0.28);
            wing.rotation.x = 0.12;
            this.body.add(wing);
            for (const s of [-0.32, 0.32]) this.body.add(boxM(0.06, wy - topY, 0.12, darkM, s * W, topY + (wy - topY) / 2, rearZ + 0.28));
            if (dl >= 5) for (const s of [-1, 1]) this.body.add(boxM(0.04, 0.32, 0.6, std(trim, 0.35, 0.3), s * W * 0.52, wy + 0.05, rearZ + 0.28));
        }
        const cageM = bl >= 5 ? std(0x3a3c42, 0.3, 0.8) : std(0x2a2b30, 0.35, 0.7);
        if (bl >= 1) {
            const fz = Lh / 2 + 0.16, y0 = tubY - H * 0.3, y1 = tubY + H * 0.35;
            for (const s of [-1, 1]) this.body.add(tube([s * W * 0.32, y0, fz], [s * W * 0.32, y1, fz], 0.045, cageM));
            this.body.add(tube([-W * 0.4, y1, fz], [W * 0.4, y1, fz], 0.045, cageM));
            this.body.add(tube([-W * 0.4, y0 + 0.08, fz + 0.04], [W * 0.4, y0 + 0.08, fz + 0.04], 0.045, cageM));
        }
        if (bl >= 2) {
            const h = (ch > 0 ? ch : 0.85) + 0.08, z0 = cz + cl * 0.42, z1 = cz - cl * 0.5;
            for (const s of [-1, 1]) {
                this.body.add(tube([s * cw * 0.5, topY, z0], [s * cw * 0.42, topY + h, z0 - 0.2], 0.04, cageM));
                this.body.add(tube([s * cw * 0.5, topY, z1], [s * cw * 0.42, topY + h, z1 + 0.1], 0.04, cageM));
                this.body.add(tube([s * cw * 0.42, topY + h, z0 - 0.2], [s * cw * 0.42, topY + h, z1 + 0.1], 0.04, cageM));
            }
            this.body.add(tube([-cw * 0.42, topY + h, z0 - 0.2], [cw * 0.42, topY + h, z0 - 0.2], 0.04, cageM));
            this.body.add(tube([-cw * 0.42, topY + h, z1 + 0.1], [cw * 0.42, topY + h, z1 + 0.1], 0.04, cageM));
            this.cageTop = topY + h;
        }
        if (bl >= 3) for (const s of [-1, 1]) {
            this.body.add(tube([s * (W / 2 + 0.12), tubY - H * 0.35, Lh * 0.22], [s * (W / 2 + 0.12), tubY - H * 0.35, -Lh * 0.22], 0.05, cageM));
            for (const z of [Lh * 0.2, -Lh * 0.2]) this.body.add(tube([s * (W / 2 + 0.12), tubY - H * 0.35, z], [s * W / 2, tubY - H * 0.2, z], 0.035, cageM));
        }
        if (bl >= 4) {
            const ly = (this.cageTop || topY + ch) + 0.08, lz = cz + cl * 0.2;
            this.body.add(boxM(cw * 0.95, 0.14, 0.16, darkM, 0, ly, lz));
            const lm = new THREE.MeshBasicMaterial({ color: 0xfff8e0, toneMapped: false });
            for (let k = -2; k <= 2; k++) this.body.add(boxM(0.16, 0.09, 0.02, lm, k * cw * 0.18, ly, lz + 0.09));
            this.lamps.push(lm);
        }
        if (bl >= 5) {
            const plate = std(0x5a5e66, 0.4, 0.8);
            const riv = std(0xc8ccd2, 0.3, 1);
            for (const s of [-1, 1]) {
                this.body.add(boxM(0.04, H * 0.6, Lh * 0.5, plate, s * (W / 2 + 0.03), tubY - H * 0.05, 0));
                for (let k = -3; k <= 3; k++) for (const yy of [-0.2, 0.15]) {
                    const r = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), riv);
                    r.position.set(s * (W / 2 + 0.055), tubY + H * yy, k * Lh * 0.07);
                    this.body.add(r);
                }
            }
            this.body.add(boxM(W * 0.8, 0.04, 0.6, plate, 0, tubY - H / 2 - 0.03, Lh * 0.35));
        }
        if (nl >= 1) {
            const n = nl >= 4 ? 3 : nl >= 2 ? 2 : 1;
            const big = nl >= 5;
            const bottleM = big ? new THREE.MeshStandardMaterial({ color: 0x3ad0ff, emissive: 0x1a90c0, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.6 }) : std(0x2f6be0, 0.3, 0.6);
            const by = topY + (ch > 0 && !K.bed ? 0.16 : 0.2);
            const bz = K.bed ? -Lh * 0.28 : cz - cl / 2 - 0.25;
            for (let k = 0; k < n; k++) {
                const b = cylM(big ? 0.15 : 0.11, big ? 0.15 : 0.11, big ? 0.9 : 0.7, bottleM, 12);
                b.rotation.z = Math.PI / 2;
                b.position.set(0, by + k * 0.001, bz - k * 0.26);
                this.body.add(b);
                const cap = cylM(0.05, 0.05, 0.08, CHROME(), 8);
                cap.rotation.z = Math.PI / 2;
                cap.position.set((big ? 0.49 : 0.39), by, bz - k * 0.26);
                this.body.add(cap);
            }
        }
        // Exhaust flames: blue-white nitro cones (and orange on a big engine).
        const flameM = new THREE.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const tips = exhaustTips.length ? exhaustTips : [new THREE.Vector3(0, exY, rearZ - 0.1)];
        for (const t of tips) {
            const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 10, 1, true), flameM);
            f.rotation.x = -Math.PI / 2;
            f.position.copy(t).add(new THREE.Vector3(0, 0, -0.42));
            f.visible = false;
            this.body.add(f);
            this.flames.push(f);
        }
        this.flameM = flameM;

        // ------------------------------------------------------------ wheels
        const rimHex = tl >= 5 ? 0xe8b33a : tl >= 4 ? 0x1c1d21 : tl >= 3 ? 0x2a2b30 : tl >= 2 ? 0xc8ccd2 : 0x8a8e94;
        const rimM = tl >= 5 ? GOLD() : std(rimHex, 0.35, tl >= 2 ? 0.8 : 0.4);
        const tread = treadTexture(tl >= 2);
        const tireM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tread, roughness: 0.92 });
        const sideM = std(0x1d1d20, 0.85);
        const springM = sl >= 5 ? GOLD() : std(sl >= 3 ? 0xd8322a : 0xe8b33a, 0.4, 0.5);
        const wbZ = Lh * K.wb;
        for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
            const hub = new THREE.Group();
            hub.position.set(sx * (W / 2 + ww * 0.36), wr, sz * wbZ);
            const spin = new THREE.Group();
            hub.add(spin);
            const big = K.fan && !front ? 1.12 : 1;
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wr * big, wr * big, ww, 22, 1, true), tireM);
            tire.rotation.z = Math.PI / 2;
            spin.add(tire);
            for (const s of [-1, 1]) {
                const wall = new THREE.Mesh(new THREE.RingGeometry(wr * 0.6 * big, wr * big, 22), sideM);
                wall.rotation.y = s * Math.PI / 2;
                wall.position.x = s * ww / 2;
                spin.add(wall);
            }
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.6 * big, wr * 0.6 * big, ww * 0.9, 16), rimM);
            rim.rotation.z = Math.PI / 2;
            spin.add(rim);
            const out = -sx;   // the face pointing away from the car
            if (tl >= 2) {
                for (let k = 0; k < (tl >= 4 ? 6 : 5); k++) {
                    const sp = boxM(0.03, wr * 1.05 * big, 0.08, tl >= 3 ? std(0x101012, 0.4, 0.5) : rimM, -out * (ww * 0.46), 0, 0);
                    sp.rotation.x = (k / (tl >= 4 ? 6 : 5)) * Math.PI;
                    spin.add(sp);
                }
            }
            if (tl === 3) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(wr * 0.6, 0.03, 6, 16), std(0xc8ccd2, 0.3, 0.9));
                ring.rotation.y = Math.PI / 2;
                ring.position.x = -out * ww * 0.47;
                spin.add(ring);
            }
            const cap = cylM(wr * 0.16, wr * 0.16, ww * 0.95, tl >= 5 ? GOLD() : CHROME(), 10);
            cap.rotation.z = Math.PI / 2;
            spin.add(cap);
            // Suspension: a coil from the hub up into the body.
            if (sl >= 2) {
                const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, ride + K.H * 0.6, 8), springM);
                coil.position.set(-sx * ww * 0.6, (ride + K.H * 0.6) / 2, 0);
                hub.add(coil);
                if (sl >= 4) {
                    const c2 = coil.clone(); c2.position.z = 0.14 * sz; hub.add(c2);
                }
            }
            if (sl >= 3) {
                const arm = boxM(ww * 0.9 + 0.25, 0.06, 0.12, darkM, -sx * (ww * 0.6 + 0.1), 0.02, 0);
                hub.add(arm);
            }
            this.root.add(hub);
            this.wheels.push({ hub, spin, front, baseY: wr, sx });
        }
        this.spinA = 0;

        // Contact shadow: a soft dark blob that always sits on the ground.
        const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, Lh * 1.25), new THREE.MeshBasicMaterial({ map: softDot(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 0.04;
        blob.renderOrder = 3;
        this.blob = blob;
        this.root.add(blob);

        this.root.traverse((o) => { if (o.isMesh && o !== blob && !o.material.blending) { o.castShadow = !opts.noShadow; o.receiveShadow = true; } });
        this.bob = 0; this.bobV = 0; this.pitch = 0; this.roll = 0;
        this.exhaustTips = tips;
        this.length = Lh; this.width = W;
    }

    /**
     * Pose the model from a sim Car and the Track it is on. Smooths pitch and roll, bounces the body
     * on its springs, spins and steers the wheels and lights the nitro flames.
     */
    update(car, track, dt, t) {
        const r = this.root;
        r.position.set(car.x, car.y, car.z);
        // Ground pitch and roll: sample the road surface under the nose, tail and both sides and
        // tilt the car to match. Positive rotation.x drops the nose; positive rotation.z raises the
        // car's left side (+x local; the right is -x).
        let gp = 0, gr = 0;
        if (track) {
            const fx = Math.sin(car.h), fz = Math.cos(car.h);
            const hl = this.length * 0.4, hw = this.width * 0.5;
            const g = (ox, oz) => {
                track.locate(car.x + ox, car.z + oz, car.loc.i, _probe);
                return track.heightAt(_probe.i, _probe.f, Math.max(-track.wall, Math.min(track.wall, _probe.d)));
            };
            const front = g(fx * hl, fz * hl), back = g(-fx * hl, -fz * hl);
            const left = g(fz * hw, -fx * hw), right = g(-fz * hw, fx * hw);
            gp = -Math.atan2(front - back, hl * 2);
            gr = Math.atan2(left - right, hw * 2);
        }
        if (car.air) {
            this.pitch += (0.18 - this.pitch) * Math.min(1, dt * 0.8) + (car.throttle > 0 ? -0.15 * dt : 0.12 * dt);
            this.roll += (0 - this.roll) * Math.min(1, dt * 2);
        } else {
            const k = Math.min(1, dt * 14);
            this.pitch += (gp - this.pitch) * k;
            this.roll += (gr - this.roll) * k;
        }
        // Body lean: squat under acceleration, dive under braking, lean out of turns.
        const accLean = (car.throttle - car.brake * 1.5) * 0.03 * Math.min(1, car.speed / 8);
        const turnLean = car.w * car.speed * 0.0045;
        // Springy bob from the vertical speed changes.
        const target = 0;
        const force = (target - this.bob) * 180 - this.bobV * 14;
        this.bobV += force * dt;
        this.bob += this.bobV * dt;
        if (this.lastVy != null && !car.air) {
            const jolt = (car.vy - this.lastVy);
            if (jolt > 2) this.bobV -= jolt * 0.05;
        }
        this.lastVy = car.vy;
        if (car.justLanded) { this.bobV -= Math.min(4, car.justLanded * 0.35); car.justLanded = 0; }
        const rough = car.surface === 'gravel' || car.surface === 'rock' || car.surface === 'grass' || car.surface === 'snow' ? 1 : 0;
        const shake = rough * Math.min(1, car.speed / 20) * 0.02 * Math.sin(t * 47 + car.id);

        r.rotation.set(0, 0, 0);
        r.rotation.order = 'YXZ';
        r.rotation.y = car.h;
        r.rotation.x = this.pitch;
        r.rotation.z = this.roll;
        this.body.position.y = this.bob + shake;
        this.body.rotation.x = -accLean;
        this.body.rotation.z = turnLean;   // a left turn (w > 0) leans the body out to the right

        // Wheels.
        this.spinA += (car.vLong / this.wr) * dt;
        for (const w of this.wheels) {
            w.spin.rotation.x = this.spinA;
            if (w.front) w.hub.rotation.y = -car.steerVis * 0.45;
            w.hub.position.y = w.baseY + (car.air ? -0.12 : 0) + (w.front ? -this.bob * 0.3 : -this.bob * 0.2);
        }
        if (this.fan) this.fan.rotation.z += dt * (8 + car.speed * 1.2);

        // Lights and flames.
        this.tailM.color.setHex(car.brake > 0.1 ? 0xff2a1a : 0x8a0a06);
        const boost = car.boosting || car.launch > 0;
        for (const f of this.flames) {
            f.visible = boost;
            if (boost) { const s = 0.8 + Math.random() * 0.5; f.scale.set(s, s * (1 + Math.random() * 0.4), s); }
        }
        // The blob shadow stays flat on the ground.
        this.blob.position.y = car.air ? -(car.y - (car.groundY ?? car.y)) + 0.05 : 0.05;
        this.blob.material.opacity = car.air ? Math.max(0.15, 0.55 - (car.y - (car.groundY ?? car.y)) * 0.08) : 0.55;
    }

    /** World position of the exhausts and rear wheels, for particles. */
    rearWheelWorld(out, side) {
        const w = this.wheels[side < 0 ? 2 : 3];
        return w.hub.getWorldPosition(out);
    }

    dispose() {
        this.root.traverse((o) => {
            if (o.isMesh) {
                o.geometry.dispose();
                if (![...matCache.values()].includes(o.material) && o.material !== this.paintM) o.material.dispose?.();
            }
        });
        this.paintM.dispose();
        this.liveryTex.dispose();
    }
}

export const KIND_NAMES = { buggy: 'Buggy', pickup: 'Pickup', rally: 'Rally hatch', dune: 'Dune buggy', swamp: 'Swamp buggy', ice: 'Ice racer', trophy: 'Trophy truck', raven: 'Ravenwing' };
