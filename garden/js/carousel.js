// The Starlight Carousel: a band-organ merry-go-round on its own paved plaza
// between the paths. A turning platform painted with an inlaid star, a mirrored
// centre drum, barley-twist brass poles, a rounding board with the carousel's
// name, a scalloped valance, a striped roof with a crescent-moon finial and
// some three hundred and seventy bulbs, carrying eight creatures of legend
// (carousel-creatures.js). Click one and you climb on: the bell rings, the
// organ strikes up a waltz (carousel-audio.js) and round you go, rising and
// falling on your pole, until you click again and it slows to let you off.
// After dark the bulbs run in colours, and when the midnight fireworks go up
// the carousel starts by itself and plays along.

import * as THREE from 'three';
import { Batch } from './materials.js';
import { canvas, toTexture, glowSprite } from './textures.js';
import { TAU, clamp, damp, smoothstep } from './util.js';
import { CREATURES, buildCreature, sharedMaterials, M, taperTube } from './carousel-creatures.js';
import { CarouselMusic, CAROUSEL_BEAT } from './carousel-audio.js';

const R_BASE = 6.55;     // the plinth: nobody walks on the turning part
const R_PLAT = 6.0;      // the platform
const P = 0.6;           // the platform's top above the plaza
const RING = 4.35;       // where the creatures go round
const SEAT_Y = 1.25;     // a creature's saddle above the platform, at the middle of its rise
const BOB = 0.28;        // how far each rises and falls
const BOARD0 = 3.6, BOARD1 = 4.35; // the rounding board, above the platform
const ROOF_TOP = 6.65;
const RIDE = TAU / 12;   // radians a second: five turns a minute
const SHOW = TAU / 14;
const EYE = 1.65;
const N = CREATURES.length;
/** The rider's eyes, in the creature's own frame. */
const SEAT_EYE = new THREE.Vector3(-0.22, 1.12, -0.5); // behind the pole and a little outboard of it

const PALETTE = [0.0, 0.08, 0.14, 0.33, 0.52, 0.62, 0.75, 0.88]; // hues: red, orange, gold, green, cyan, blue, violet, pink

// ------------------------------------------------------------------ textures

function deckTexture() {
    const n = 1024;
    const c = canvas(n);
    const ctx = c.getContext('2d');
    const m = n / 2;
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(0, 0, n, n);
    // radial planks, each a slightly different brown
    for (let i = 0; i < 64; i++) {
        const a0 = (i / 64) * TAU, a1 = ((i + 1) / 64) * TAU;
        ctx.fillStyle = `hsl(${24 + (i * 7) % 9}, ${42 + (i * 13) % 12}%, ${26 + (i * 11) % 9}%)`;
        ctx.beginPath();
        ctx.moveTo(m, m);
        ctx.arc(m, m, m, a0, a1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,15,5,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    // a brass ring, a painted band of diamonds, and an eight-point star inlaid in the middle
    const ring = (r, w, col) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(m, m, r, 0, TAU);
        ctx.stroke();
    };
    ring(m * 0.97, 10, '#d8a850');
    ring(m * 0.86, 30, '#1a2458');
    for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU;
        ctx.save();
        ctx.translate(m + Math.cos(a) * m * 0.86, m + Math.sin(a) * m * 0.86);
        ctx.rotate(a);
        ctx.fillStyle = i % 2 ? '#f0c060' : '#e04a6a';
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(0, -12);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 12);
        ctx.fill();
        ctx.restore();
    }
    ring(m * 0.82, 6, '#d8a850');
    ring(m * 0.9, 6, '#d8a850');
    ring(m * 0.27, 8, '#d8a850');
    ctx.save();
    ctx.translate(m, m);
    for (let k = 0; k < 16; k++) {
        ctx.rotate(TAU / 16);
        ctx.fillStyle = k % 2 ? '#f2d58a' : '#c88a3a';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-m * 0.05, m * 0.1);
        ctx.lineTo(0, k % 2 ? m * 0.42 : m * 0.62);
        ctx.lineTo(m * 0.05, m * 0.1);
        ctx.fill();
    }
    ctx.restore();
    return toTexture(c);
}

/** A band of gilded scrolls and jewels for the platform's edge. */
function skirtTexture() {
    const c = canvas(512, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5a0e2a';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#d8a850';
    ctx.fillRect(0, 0, 512, 7);
    ctx.fillRect(0, 57, 512, 7);
    for (let i = 0; i < 8; i++) {
        const x = i * 64 + 32;
        ctx.strokeStyle = '#f0c868';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x - 16, 32, 12, Math.PI * 0.2, Math.PI * 1.8);
        ctx.arc(x + 16, 32, 12, Math.PI * 1.2, Math.PI * 0.8, true);
        ctx.stroke();
        ctx.fillStyle = i % 2 ? '#3a8fff' : '#ff4a7a';
        ctx.beginPath();
        ctx.arc(x, 32, 8, 0, TAU);
        ctx.fill();
    }
    const t = toTexture(c);
    t.repeat.set(10, 1);
    return t;
}

/** The centre drum: framed mirrors between painted panels of moons and stars. */
function coreTexture() {
    const w = 1024, h = 512;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a0e3a';
    ctx.fillRect(0, 0, w, h);
    const panels = 6, pw = w / panels;
    for (let i = 0; i < panels; i++) {
        const x = i * pw;
        ctx.strokeStyle = '#e0b058';
        ctx.lineWidth = 10;
        ctx.strokeRect(x + 10, 14, pw - 20, h - 28);
        if (i % 2 === 0) {
            const g = ctx.createLinearGradient(x, 0, x + pw, h);
            g.addColorStop(0, '#dff2ff');
            g.addColorStop(0.45, '#8fb8d8');
            g.addColorStop(0.55, '#f6fbff');
            g.addColorStop(1, '#7a9ab8');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x + pw / 2, h / 2, pw * 0.32, h * 0.38, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#f0c868';
            ctx.lineWidth = 8;
            ctx.stroke();
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#101a4a');
            g.addColorStop(1, '#3a1450');
            ctx.fillStyle = g;
            ctx.fillRect(x + 22, 26, pw - 44, h - 52);
            ctx.fillStyle = '#ffe9a8';
            ctx.beginPath();
            ctx.arc(x + pw / 2, h * 0.4, 46, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#18184a';
            ctx.beginPath();
            ctx.arc(x + pw / 2 + 20, h * 0.37, 42, 0, TAU);
            ctx.fill();
            for (let s = 0; s < 14; s++) {
                ctx.fillStyle = '#fff6d0';
                ctx.beginPath();
                ctx.arc(x + 34 + ((s * 53) % (pw - 68)), 50 + ((s * 97) % (h - 100)), 2 + (s % 3), 0, TAU);
                ctx.fill();
            }
        }
    }
    return toTexture(c);
}

/** The ceiling under the canopy: a night sky with constellations round a golden sun. */
function ceilingTexture() {
    const n = 1024, m = n / 2;
    const c = canvas(n);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(m, m, 10, m, m, m);
    g.addColorStop(0, '#3a2a6a');
    g.addColorStop(0.5, '#141850');
    g.addColorStop(1, '#0a0c2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,250,230,${0.4 + r() * 0.6})`;
        ctx.beginPath();
        ctx.arc(r() * n, r() * n, r() * 2.2 + 0.4, 0, TAU);
        ctx.fill();
    }
    // a few constellations
    ctx.strokeStyle = 'rgba(240, 200, 120, 0.7)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, rr = m * 0.66;
        let x = m + Math.cos(a) * rr, y = m + Math.sin(a) * rr;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
            x += (r() - 0.5) * 90;
            y += (r() - 0.5) * 90;
            ctx.lineTo(x, y);
            ctx.fillStyle = '#fff2c0';
            ctx.fillRect(x - 3, y - 3, 6, 6);
        }
        ctx.stroke();
    }
    // the sun at the hub, with rays
    ctx.save();
    ctx.translate(m, m);
    for (let k = 0; k < 24; k++) {
        ctx.rotate(TAU / 24);
        ctx.fillStyle = k % 2 ? '#f0b040' : '#ffd870';
        ctx.beginPath();
        ctx.moveTo(-16, 120);
        ctx.lineTo(0, k % 2 ? 190 : 230);
        ctx.lineTo(16, 120);
        ctx.fill();
    }
    ctx.restore();
    return toTexture(c);
}

/** The rounding board: the carousel's name twice round, between mirrors and scrolls. */
function boardTexture() {
    const w = 2048, h = 128;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7a1838');
    g.addColorStop(1, '#4a0a22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0b058';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 10, w, 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) {
        const x0 = k * (w / 2);
        // the name in a gilded cartouche
        ctx.fillStyle = '#1a1a50';
        ctx.fillRect(x0 + 180, 22, 660, h - 44);
        ctx.strokeStyle = '#f0c868';
        ctx.lineWidth = 6;
        ctx.strokeRect(x0 + 180, 22, 660, h - 44);
        ctx.fillStyle = '#ffe9a8';
        ctx.shadowColor = '#ffb040';
        ctx.shadowBlur = 10;
        ctx.font = '600 52px Georgia, "Times New Roman", serif';
        ctx.fillText('✦ Starlight Carousel ✦', x0 + 510, h / 2 + 2, 620);
        ctx.shadowBlur = 0;
        // mirrors and painted scrolls between
        for (const mx of [x0 + 80, x0 + 920]) {
            const mg = ctx.createLinearGradient(mx - 40, 0, mx + 40, h);
            mg.addColorStop(0, '#e8f6ff');
            mg.addColorStop(0.5, '#88a8c8');
            mg.addColorStop(1, '#f4fbff');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.ellipse(mx, h / 2, 46, 40, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#f0c868';
            ctx.stroke();
        }
        // a little scroll beside each mirror
        ctx.strokeStyle = '#f0c868';
        ctx.lineWidth = 5;
        for (const sx of [x0 + 140, x0 + 880]) {
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                ctx.arc(sx, h / 2 - 18 + s * 18, 10, 0, Math.PI * 1.5);
                ctx.stroke();
            }
        }
    }
    return toTexture(c);
}

/** Roof stripes: midnight blue with gold stars, and cream, sixteen of each. */
function roofTexture() {
    const w = 1024, h = 256;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const n = 32, sw = w / n;
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? '#f4ead2' : '#1c2668';
        ctx.fillRect(i * sw, 0, sw, h);
        if (i % 2 === 0) {
            ctx.fillStyle = '#f0c060';
            for (let s = 0; s < 3; s++) {
                const cx = i * sw + sw / 2, cy = 40 + s * 70;
                ctx.beginPath();
                for (let p = 0; p < 10; p++) {
                    const a = (p / 10) * TAU - Math.PI / 2, rr = p % 2 ? 4 : 10;
                    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
                }
                ctx.fill();
            }
        }
        ctx.fillStyle = '#d8a850';
        ctx.fillRect(i * sw - 1.5, 0, 3, h);
    }
    return toTexture(c);
}

/** A soft ring of light for the paving round the carousel at night. */
function poolTexture() {
    const n = 256, m = n / 2;
    const c = canvas(n);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.66, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    return toTexture(c);
}

// ------------------------------------------------------------------- shapes

/** A barley-twist pole: a cylinder with spiral ridges. */
function twistPole(h, r) {
    const g = new THREE.CylinderGeometry(r, r, h, 10, Math.ceil(h * 14), true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const a = Math.atan2(z, x);
        const k = 1 + 0.3 * Math.sin(a * 2 + y * 16);
        p.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

function starShape(r0, r1, points = 5) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * TAU + Math.PI / 2, r = i % 2 ? r1 : r0;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _c = new THREE.Color();
const hash = (n) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
};

export class Carousel {
    constructor(world) {
        const site = world.carouselSite;
        this.ok = !!site;
        if (!site) return;
        this.world = world;
        this.site = site;
        this.x = site.x;
        this.z = site.z;
        this.y = site.y;
        this.theta = Math.random() * TAU;
        this.speed = 0;
        this.ride = null;        // { idx, phase: 'mount' | 'ride' | 'leave' | 'off', t, ... }
        this.pending = -1;       // a creature you are walking over to ride
        this.showUntil = -1;
        this.night = 0;
        this.time = 0;
        this.music = null;
        this.duck = 0;
        this.onEvent = null;     // (name, data) for the host's hints
        this.bulbs = [];

        this._buildBase(world);
        this.rotor = new THREE.Group();
        this.rotor.position.set(this.x, this.y, this.z);
        world.root.add(this.rotor);
        this._buildMachine(world);
        this._buildCreatures(world);
        this._buildLights(world);
        world.colliders.push({ x: this.x, z: this.z, r: R_BASE });
        this._place();
    }

    /** The plinth the platform turns in: it stays put. */
    _buildBase(world) {
        const batch = new Batch();
        const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs);
        batch.add('granite', lathe([[0, 0], [R_BASE + 0.1, 0], [R_BASE + 0.1, 0.2], [R_BASE - 0.12, 0.22], [R_BASE - 0.16, 0.5], [R_PLAT + 0.08, 0.52], [R_PLAT + 0.08, 0.36], [0, 0.36]], 72));
        batch.add('brass', new THREE.TorusGeometry(R_BASE - 0.15, 0.035, 6, 96).rotateX(Math.PI / 2).translate(0, 0.52, 0));
        const g = batch.build(world.mats);
        g.position.set(this.x, this.y, this.z);
        world.root.add(g);
    }

    _buildMachine(world) {
        const mats = {
            gold: new THREE.MeshStandardMaterial({ color: 0xf0c060, roughness: 0.25, metalness: 1 }),
            deck: new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.6, metalness: 0.05 }),
            skirt: new THREE.MeshStandardMaterial({ map: skirtTexture(), roughness: 0.4, metalness: 0.3 }),
            core: new THREE.MeshStandardMaterial({ map: coreTexture(), emissive: 0xffffff, roughness: 0.2, metalness: 0.4 }),
            ceiling: new THREE.MeshStandardMaterial({ map: ceilingTexture(), emissive: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }),
            board: new THREE.MeshStandardMaterial({ map: boardTexture(), emissive: 0xffffff, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }),
            roof: new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.75, side: THREE.DoubleSide }),
            flapA: new THREE.MeshStandardMaterial({ color: 0x1c2668, roughness: 0.6, side: THREE.DoubleSide }),
            flapB: new THREE.MeshStandardMaterial({ color: 0xf0c060, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }),
            flag: new THREE.MeshStandardMaterial({ color: 0xe04a7a, roughness: 0.6, side: THREE.DoubleSide }),
            starlight: new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.6 }),
        };
        for (const k of ['core', 'board', 'ceiling']) mats[k].emissiveMap = mats[k].map;
        world.glowMats.push({ mat: mats.core, day: 0.05, night: 0.55 }, { mat: mats.board, day: 0.05, night: 0.45 }, { mat: mats.ceiling, day: 0.1, night: 0.6 }, { mat: mats.starlight, day: 0.5, night: 3.5 });
        this.mats = mats;
        const b = new Batch();
        // the platform: a painted deck, a jewelled skirt, a brass edge
        b.add('deck', new THREE.CircleGeometry(R_PLAT, 72).rotateX(-Math.PI / 2), M([0, P + 0.003, 0]));
        b.add('skirt', new THREE.CylinderGeometry(R_PLAT, R_PLAT, 0.24, 72, 1, true), M([0, P - 0.12, 0]));
        b.add('gold', new THREE.TorusGeometry(R_PLAT, 0.04, 6, 96).rotateX(Math.PI / 2), M([0, P, 0]));
        // the centre drum, with gilded mouldings top and bottom
        b.add('core', new THREE.CylinderGeometry(1.45, 1.45, BOARD0, 30, 1, true), M([0, P + BOARD0 / 2, 0]));
        for (const [y, r] of [[P + 0.08, 1.6], [P + 0.6, 1.5], [P + BOARD0 - 0.4, 1.5], [P + BOARD0 - 0.05, 1.6]]) b.add('gold', new THREE.TorusGeometry(r, 0.07, 6, 40).rotateX(Math.PI / 2), M([0, y, 0]));
        b.add('gold', new THREE.CylinderGeometry(1.62, 1.68, 0.16, 30), M([0, P + 0.08, 0]));
        // the ceiling and the sweeps that carry the poles
        b.add('ceiling', new THREE.CircleGeometry(6.5, 64).rotateX(Math.PI / 2), M([0, P + BOARD0 + 0.12, 0]));
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU;
            b.add('gold', new THREE.BoxGeometry(0.1, 0.14, 5.05), M([Math.sin(a) * 3.98, P + BOARD0 + 0.03, Math.cos(a) * 3.98], [0, a, 0]));
        }
        // the rounding board, its mouldings and the scalloped valance under it
        b.add('board', new THREE.CylinderGeometry(6.5, 6.5, BOARD1 - BOARD0, 96, 1, true), M([0, P + (BOARD0 + BOARD1) / 2, 0]));
        for (const y of [P + BOARD0, P + BOARD1]) b.add('gold', new THREE.TorusGeometry(6.52, 0.06, 6, 96).rotateX(Math.PI / 2), M([0, y, 0]));
        const flaps = 56;
        for (let k = 0; k < flaps; k++) {
            const a = ((k + 0.5) / flaps) * TAU;
            b.add(k % 2 ? 'flapB' : 'flapA', new THREE.CircleGeometry(0.36, 10, Math.PI, Math.PI), M([Math.sin(a) * 6.53, P + BOARD0 - 0.02, Math.cos(a) * 6.53], [0, a, 0]));
        }
        // the striped roof, its gilded ribs, a little crown and the crescent moon finial
        const roofH = ROOF_TOP - BOARD1;
        b.add('roof', new THREE.CylinderGeometry(0.75, 6.62, roofH, 32, 1, true), M([0, P + BOARD1 + roofH / 2, 0]));
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU;
            const pts = [];
            for (let i = 0; i <= 6; i++) {
                const u = i / 6;
                const r = 6.66 - u * 5.9, y = P + BOARD1 + 0.02 + u * roofH + Math.sin(u * Math.PI) * 0.12;
                pts.push([Math.sin(a) * r, y, Math.cos(a) * r]);
            }
            b.add('gold', taperTube(pts, 0.045, 16, 5));
            // a pennant at the foot of every other rib
            if (k % 2 === 0) {
                const fx = Math.sin(a) * 6.62, fz = Math.cos(a) * 6.62;
                b.add('gold', new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), M([fx, P + BOARD1 + 0.4, fz]));
                b.add('gold', new THREE.SphereGeometry(0.05, 8, 6), M([fx, P + BOARD1 + 0.82, fz]));
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.lineTo(0.5, -0.1);
                s.lineTo(0, -0.24);
                b.add(k % 4 ? 'flag' : 'flapB', new THREE.ShapeGeometry(s), M([fx, P + BOARD1 + 0.8, fz], [0, a + Math.PI / 2, 0]));
            }
        }
        b.add('gold', new THREE.CylinderGeometry(0.82, 0.86, 0.5, 20), M([0, P + ROOF_TOP + 0.2, 0]));
        b.add('flapA', new THREE.CylinderGeometry(0.72, 0.72, 0.36, 20, 1, true), M([0, P + ROOF_TOP + 0.6, 0]));
        b.add('gold', new THREE.LatheGeometry([[0.8, 0], [0.75, 0.12], [0.55, 0.4], [0.25, 0.62], [0.08, 0.75], [0, 0.8]].map(([r, y]) => new THREE.Vector2(r, y)), 20), M([0, P + ROOF_TOP + 0.78, 0]));
        b.add('gold', new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), M([0, P + ROOF_TOP + 1.85, 0]));
        b.add('starlight', new THREE.TorusGeometry(0.3, 0.055, 8, 28, Math.PI * 1.3), M([0, P + ROOF_TOP + 2.5, 0], [0, 0, -Math.PI * 0.15]));
        b.add('starlight', new THREE.ExtrudeGeometry(starShape(0.16, 0.07), { depth: 0.05, bevelEnabled: false }), M([0.1, P + ROOF_TOP + 2.62, -0.025]));
        // the creatures' poles, barley-twisted brass, with knobs
        for (let k = 0; k < N; k++) {
            const a = (k / N) * TAU;
            const x = Math.sin(a) * RING, z = Math.cos(a) * RING;
            b.add('gold', twistPole(BOARD0, 0.05), M([x, P + BOARD0 / 2, z]));
            b.add('gold', new THREE.SphereGeometry(0.09, 10, 8), M([x, P + 0.06, z]));
            b.add('gold', new THREE.CylinderGeometry(0.1, 0.07, 0.16, 10), M([x, P + BOARD0 - 0.05, z]));
        }
        const machine = b.build(mats);
        this.rotor.add(machine);
    }

    _buildCreatures() {
        const shared = sharedMaterials();
        this.creatures = CREATURES.map((info, k) => {
            const c = buildCreature(info, shared);
            const a = (k / N) * TAU;
            const g = new THREE.Group();
            g.add(c.group);
            // an invisible box to click: cheaper and kinder than the creature's own triangles
            const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 2.4), new THREE.MeshBasicMaterial());
            proxy.visible = false;
            proxy.position.set(0, 0.25, -0.05);
            proxy.userData.creature = k;
            g.add(proxy);
            this.rotor.add(g);
            for (const n of c.night) this.world.glowMats.push(n);
            return { ...c, holder: g, proxy, a, k };
        });
        this.proxies = this.creatures.map((c) => c.proxy);
        this.skyMats = this.creatures.map((c) => c.sky).filter(Boolean);
    }

    _buildLights(world) {
        const add = (x, y, z, ring, i, n) => this.bulbs.push({ p: new THREE.Vector3(x, y, z), ring, i, n, a: Math.atan2(x, z) });
        const around = (ring, n, r, y, off = 0) => {
            for (let i = 0; i < n; i++) {
                const a = ((i + off) / n) * TAU;
                add(Math.sin(a) * r, y, Math.cos(a) * r, ring, i, n);
            }
        };
        around('board', 56, 6.58, P + BOARD0 + 0.16, 0);
        around('board2', 56, 6.58, P + BOARD1 - 0.16, 0.5);
        around('deck', 48, R_PLAT + 0.03, P - 0.12, 0);
        for (const [k, y] of [[0, 0.75], [1, 1.75], [2, 2.75]]) around('core' + k, 15, 1.53, P + y, k * 0.5);
        around('crown', 12, 0.9, P + ROOF_TOP + 0.45, 0);
        const roofH = ROOF_TOP - BOARD1;
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU;
            for (let i = 0; i < 6; i++) {
                const u = (i + 0.6) / 6.6;
                const r = 6.66 - u * 5.9 + 0.06, y = P + BOARD1 + 0.08 + u * roofH + Math.sin(u * Math.PI) * 0.12;
                this.bulbs.push({ p: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r), ring: 'rib', i, n: 6, k, a });
            }
            // and along the sweeps, to light the ceiling for the riders
            if (k % 2 === 0) {
                for (let i = 0; i < 4; i++) {
                    const r = 2.0 + i * 1.3;
                    this.bulbs.push({ p: new THREE.Vector3(Math.sin(a) * r, P + BOARD0 - 0.06, Math.cos(a) * r), ring: 'sweep', i, n: 4, k, a });
                }
            }
        }
        const geo = new THREE.SphereGeometry(0.055, 8, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const im = new THREE.InstancedMesh(geo, mat, this.bulbs.length);
        const m = new THREE.Matrix4();
        this.bulbs.forEach((bl, i) => {
            im.setMatrixAt(i, m.makeTranslation(bl.p.x, bl.p.y, bl.p.z));
            im.setColorAt(i, _c.setRGB(1, 0.85, 0.6));
        });
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false;
        this.bulbMesh = im;
        this.rotor.add(im);

        // one coloured light under the canopy, and a pool of colour on the paving
        this.light = new THREE.PointLight(0xff88dd, 0, 17, 1.6);
        this.light.position.set(this.x, this.y + P + 2.4, this.z);
        world.root.add(this.light);
        this.pool = new THREE.Mesh(
            new THREE.CircleGeometry(11, 64).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xff88dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
        );
        this.pool.position.set(this.x, this.y + 0.06, this.z);
        this.pool.renderOrder = 2;
        world.root.add(this.pool);
        this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffd890, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.halo.scale.setScalar(2.2);
        this.halo.position.set(this.x + 0.05, this.y + P + ROOF_TOP + 2.55, this.z);
        world.root.add(this.halo);
    }

    // --------------------------------------------------------------- the ride

    get busy() {
        return !!this.ride;
    }

    /** True while the carousel is turning to music. */
    get running() {
        return this.speed > 0.12;
    }

    /** Where you stand to climb on, on the near side of the plinth from (px, pz). */
    approach(px, pz) {
        const a = Math.atan2(px - this.x, pz - this.z);
        return { x: this.x + Math.sin(a) * (R_BASE + 0.8), z: this.z + Math.cos(a) * (R_BASE + 0.8) };
    }

    near(px, pz, d = 9.6) {
        return this.ok && Math.hypot(px - this.x, pz - this.z) < d;
    }

    /** Climb onto creature `idx`. */
    mount(idx, camera, controls) {
        if (!this.ok || this.ride) return;
        this.pending = -1;
        controls.seated = true;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        this.ride = { idx, phase: 'mount', t: 0, fromP: camera.position.clone(), fromQ: camera.quaternion.clone() };
        this.onEvent?.('mount', CREATURES[idx]);
    }

    /** Ask to get off: the carousel slows, and you step down when it stops. */
    leave() {
        const r = this.ride;
        if (!r || r.phase !== 'ride') return false;
        r.phase = 'leave';
        this.music?.bell(1);
        this.onEvent?.('leave');
        return true;
    }

    /** Off at once, wherever you are (the host is about to move you). */
    abort(controls) {
        if (!this.ride) return;
        this.ride = null;
        controls.seated = false;
        controls.pitch = -0.05;
    }

    /** The world pose of creature idx's rider: eye position and the forward yaw. */
    seatPose(idx, out) {
        const c = this.creatures[idx];
        c.holder.updateWorldMatrix(true, false);
        out.copy(SEAT_EYE).applyMatrix4(c.holder.matrixWorld);
        return this.theta + c.a + Math.PI / 2 + Math.PI; // the camera's yaw looking along the creature's nose
    }

    /** Turns the platform and bobs the creatures: every frame, wherever the player is. */
    spin(dt) {
        if (!this.ok) return;
        const r = this.ride;
        const showing = this.time < this.showUntil;
        let want = showing ? SHOW : 0;
        if (r && r.phase === 'ride') want = RIDE;
        else if (r && (r.phase === 'leave' || r.phase === 'off')) want = 0;
        this.speed = damp(this.speed, want, want > this.speed ? 0.5 : r?.phase === 'leave' ? 1.1 : 0.7, dt);
        if (want === 0 && this.speed < 0.004) this.speed = 0;
        this.theta = (this.theta + this.speed * dt) % TAU;
        this._place();
    }

    _place() {
        this.rotor.rotation.y = this.theta;
        const sp = Math.min(1, this.speed / RIDE);
        for (const c of this.creatures) {
            const ph = this.theta * 4 + c.k * Math.PI;
            c.holder.position.set(Math.sin(c.a) * RING, P + SEAT_Y + Math.sin(ph) * BOB, Math.cos(c.a) * RING);
            c.holder.rotation.set(Math.cos(ph) * 0.07 * sp, c.a + Math.PI / 2, 0, 'YXZ');
        }
        this.rotor.updateMatrixWorld(true);
    }

    /** While riding, the camera rides too. */
    drive(dt, camera, controls) {
        const r = this.ride;
        if (!r) return;
        const yaw = this.seatPose(r.idx, _v);
        if (r.phase === 'mount') {
            r.t += dt / 1.3;
            const k = smoothstep(0, 1, Math.min(1, r.t));
            camera.position.lerpVectors(r.fromP, _v, k);
            camera.position.y += Math.sin(k * Math.PI) * 0.45;
            _q.setFromEuler(_e.set(-0.08, yaw, 0, 'YXZ'));
            camera.quaternion.slerpQuaternions(r.fromQ, _q, k);
            if (r.t >= 1) {
                r.phase = 'ride';
                controls.yaw = 0;
                controls.pitch = -0.08;
                this.music?.bell(2);
                this.onEvent?.('ride', CREATURES[r.idx]);
            }
        } else if (r.phase === 'ride' || r.phase === 'leave') {
            const c = this.creatures[r.idx];
            camera.position.copy(_v);
            camera.rotation.set(controls.pitch + c.holder.rotation.x * 0.6, yaw + controls.yaw, Math.sin(this.theta * 4) * 0.012 * Math.min(1, this.speed / RIDE), 'YXZ');
            if (r.phase === 'leave' && this.speed < 0.02) {
                // step down off the platform, on the outside, facing in
                const a = this.theta + c.a;
                const tx = this.x + Math.sin(a) * (R_BASE + 0.9), tz = this.z + Math.cos(a) * (R_BASE + 0.9);
                r.phase = 'off';
                r.t = 0;
                r.fromP = camera.position.clone();
                r.fromQ = camera.quaternion.clone();
                r.to = { x: tx, z: tz, yaw: a };
                r.toP = new THREE.Vector3(tx, this.world.walkHeight(tx, tz) + EYE, tz);
                r.toQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, a, 0, 'YXZ'));
            }
        } else if (r.phase === 'off') {
            r.t += dt / 1.0;
            const k = smoothstep(0, 1, Math.min(1, r.t));
            camera.position.lerpVectors(r.fromP, r.toP, k);
            camera.position.y += Math.sin(k * Math.PI) * 0.25;
            camera.quaternion.slerpQuaternions(r.fromQ, r.toQ, k);
            if (r.t >= 1) {
                this.ride = null;
                controls.seated = false;
                controls.teleport(r.to.x, r.to.z, r.to.yaw);
                this.onEvent?.('off');
                return;
            }
        }
        // the walker's position follows, so zones, weather and the grass know where you are
        controls.pos.x = camera.position.x;
        controls.pos.z = camera.position.z;
    }

    // ------------------------------------------------------------- picking

    /** The creature under a ray, if it is nearer than `maxT`: { idx, t } or null. */
    pick(ray, maxT = 70) {
        if (!this.ok) return null;
        _v.set(this.x, this.y + P + 2.5, this.z);
        if (ray.ray.distanceSqToPoint(_v) > 8 * 8) return null;
        const hit = ray.intersectObjects(this.proxies, false)[0];
        if (!hit || hit.distance > maxT) return null;
        return { idx: hit.object.userData.creature, t: hit.distance };
    }

    info(idx) {
        return CREATURES[idx];
    }

    // --------------------------------------------------------- lights, sound

    /**
     * Every frame in the garden: the bulbs, the light, the sky hide and the
     * organ. `show` is true while the midnight fireworks are going up.
     */
    update(dt, t, night, camera, show, audio, active = true) {
        if (!this.ok) return;
        this.time = t;
        this.night = night;
        if (show) this.showUntil = t + 7;
        if (audio && !this.music) this.music = new CarouselMusic(audio);
        if (!active) return this.hush(audio);

        // far away, the creatures are specks: skip drawing them
        const d = camera.position.distanceTo(_v.set(this.x, this.y + 2, this.z));
        const show3d = d < 110 || this.ride;
        for (const c of this.creatures) c.group.visible = show3d;
        for (const m of this.skyMats) {
            m.userData.uniforms.uTime.value = t;
            m.userData.uniforms.uNight.value = night;
        }

        // the organ
        const playing = this.running;
        const riding = this.ride && this.ride.phase !== 'mount';
        const vol = riding ? 1 : Math.pow(clamp(1 - (d - 9) / 60, 0, 1), 1.5);
        let pan = 0;
        const muffle = riding ? 0 : clamp((d - 12) / 55, 0, 1);
        if (!riding && d > 0.1) {
            camera.getWorldDirection(_v);
            const rl = Math.hypot(_v.x, _v.z) || 1;
            const rx = -_v.z / rl, rz = _v.x / rl; // the camera's right
            const dx = this.x - camera.position.x, dz = this.z - camera.position.z;
            pan = (dx * rx + dz * rz) / (Math.hypot(dx, dz) || 1);
        }
        this.music?.update(playing, vol, pan, muffle);
        // the garden's own score steps back while the organ is loud
        const want = playing ? vol * 0.85 : 0;
        if (audio?.ctx && Math.abs(want - this.duck) > 0.02 && !audio.underground) {
            this.duck = want;
            audio.music.gain.setTargetAtTime(audio.musicVol * (1 - want), audio.ctx.currentTime, 0.4);
        }

        // the bulbs
        const beat = this.music?.beatPos >= 0 ? this.music.beatPos : t / CAROUSEL_BEAT;
        const mode = Math.floor(beat / 12) % 4;
        const halfBeat = Math.floor(beat * 2);
        const bright = 0.8 + night * 1.5 + (show ? 0.4 : 0);
        const im = this.bulbMesh;
        for (let i = 0; i < this.bulbs.length; i++) {
            const b = this.bulbs[i];
            // pure hues: anything paler washes out to white under the tone mapping
            let h, s = 1, l;
            if (!playing) {
                if (night > 0.15) {
                    // at rest after dark: a slow rainbow drifting round
                    h = b.a / TAU + t * 0.03 + (b.ring === 'rib' ? b.i * 0.04 : 0);
                    l = 0.42 + 0.08 * Math.sin(t * 1.7 + i * 1.3);
                } else {
                    h = 0.1;
                    s = 0.55;
                    l = 0.5;
                }
            } else if (mode === 0) {
                // chasing round in threes, a new colour each bar
                const on = (b.i + halfBeat) % 3 === 0;
                h = PALETTE[(Math.floor(beat / 3) + (b.ring === 'rib' ? 3 : 0)) % PALETTE.length];
                l = on ? 0.5 : 0.14;
            } else if (mode === 1) {
                // a rainbow wheel turning against the platform
                h = b.a / TAU * 2 - beat * 0.06;
                l = 0.5;
            } else if (mode === 2) {
                // odd and even bulbs taking turns on the beat
                const on = (b.i % 2) === (Math.floor(beat) % 2);
                h = on ? PALETTE[(Math.floor(beat / 3) * 3) % PALETTE.length] : PALETTE[(Math.floor(beat / 3) * 3 + 4) % PALETTE.length];
                l = on ? 0.5 : 0.2;
            } else {
                // twinkle: each bulb its own colour, flickering on the half beat
                h = PALETTE[Math.floor(hash(i * 3.1 + halfBeat) * PALETTE.length)];
                l = hash(i * 7.7 + halfBeat) > 0.45 ? 0.5 : 0.1;
            }
            // up the roof ribs the lights climb with the music
            if (playing && b.ring === 'rib' && mode !== 3) l *= (b.i + halfBeat) % 6 < 3 ? 1.1 : 0.6;
            _c.setHSL(((h % 1) + 1) % 1, s, l);
            im.setColorAt(i, _c.multiplyScalar(bright));
        }
        im.instanceColor.needsUpdate = true;

        // the light under the canopy and the pool of colour on the paving
        const hue = playing ? PALETTE[Math.floor(beat / 3) % PALETTE.length] : (t * 0.03) % 1;
        _c.setHSL(hue, 0.8, 0.6);
        this.light.color.copy(_c);
        this.light.intensity = damp(this.light.intensity, night * (playing ? 16 : 7) + (playing ? 2 : 0), 3, dt);
        this.pool.material.color.copy(_c);
        this.pool.material.opacity = damp(this.pool.material.opacity, night * (playing ? 0.55 : 0.3), 3, dt);
        this.halo.material.opacity = 0.15 + night * 0.7;
    }

    /** Silence, and give the garden its music back. */
    hush(audio) {
        this.music?.update(false, 0, 0, 0);
        if (this.duck > 0 && audio?.ctx) {
            this.duck = 0;
            audio.music.gain.setTargetAtTime(audio.musicVol * (audio.underground ? 0.45 : 1), audio.ctx.currentTime, 0.4);
        }
    }
}

export { CREATURES };
