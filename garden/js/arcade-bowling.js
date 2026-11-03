// The Lighthouse Arcade's bowling alley. Every lane works: click one and you are
// the bowler at its foul line. Slide the ball across the approach, lock the aim as
// the arrow sweeps, then lock the power as the meter swings, and the ball goes. The
// pins are a little 2D physics sim on the deck (ball on pin, pin on pin, the side
// kickbacks and the pit), a pin that is hit hard enough topples, and the pinsetter
// sweeps the deadwood and resets the rack. Ten frames, scored the real way, with
// strikes, spares and the tenth frame's bonus balls, on a monitor over the lane
// and on a score sheet on screen.

import * as THREE from 'three';
import { LANE_W, GUTTER, LANE_PITCH, LANE_LEN, APPROACH } from './arcade-layout.js';
import { PIXEL_FONT } from './arcade-screens.js';
import { clamp, lerp, rng } from './util.js';

const LY = 0.03;                       // the boards' surface
const BALL_R = 0.109, BALL_M = 7;
const PIN_R = 0.062, PIN_M = 1.5;
const PIN_H = 0.381;
const SPACE = 0.305;                   // pin spacing (12 inches)
const ROW = SPACE * Math.sin(Math.PI / 3);
const HALF = LANE_W / 2;
const DECK_END = LANE_LEN + 3 * ROW + 0.35;
const PIT = LANE_LEN + 1.25;
const STEP = 1 / 240;

/** The ten pin spots, head pin first, in lane coordinates (u across, s down the lane). */
export const SPOTS = (() => {
    const out = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ u: (k - r / 2) * SPACE, s: LANE_LEN + r * ROW });
    return out;
})();

/** Cumulative score per frame for a list of rolls; a frame waiting for its bonus balls is left off. */
export function scoreFrames(rolls) {
    const out = [];
    let i = 0, total = 0;
    for (let f = 0; f < 10 && i < rolls.length; f++) {
        if (rolls[i] === 10) {
            if (rolls[i + 2] === undefined) break;
            total += 10 + rolls[i + 1] + rolls[i + 2];
            i += 1;
        } else {
            if (rolls[i + 1] === undefined) break;
            if (rolls[i] + rolls[i + 1] === 10) {
                if (rolls[i + 2] === undefined) break;
                total += 10 + rolls[i + 2];
            } else total += rolls[i] + rolls[i + 1];
            i += 2;
        }
        out.push(total);
    }
    return out;
}

/** The marks in a frame's boxes: X, /, - or a number. */
export function frameMarks(fr, tenth) {
    const n = (v) => (v === 0 ? '-' : String(v));
    if (!tenth) {
        if (fr[0] === 10) return ['', 'X'];
        return [fr[0] === undefined ? '' : n(fr[0]), fr[1] === undefined ? '' : fr[0] + fr[1] === 10 ? '/' : n(fr[1])];
    }
    const [a, b, c] = fr;
    const m = ['', '', ''];
    if (a !== undefined) m[0] = a === 10 ? 'X' : n(a);
    if (b !== undefined) m[1] = a === 10 ? (b === 10 ? 'X' : n(b)) : a + b === 10 ? '/' : n(b);
    if (c !== undefined) {
        const fresh = (a === 10 && b === 10) || (a !== 10 && a + b === 10);
        m[2] = fresh ? (c === 10 ? 'X' : n(c)) : b + c === 10 ? '/' : n(c);
    }
    return m;
}

/** A game of ten frames: what the next ball is for, and how the rack is left after each one. */
export class BowlingGame {
    constructor() {
        this.frames = Array.from({ length: 10 }, () => []);
        this.f = 0;
        this.done = false;
    }

    get rolls() {
        return this.frames.flat();
    }

    get scores() {
        return scoreFrames(this.rolls);
    }

    get total() {
        const s = this.scores;
        return s.length ? s[s.length - 1] : 0;
    }

    /** Records a ball. Returns { reset: whether the rack is set fresh, mark: 'strike'|'spare'|'' }. */
    roll(n) {
        const fr = this.frames[this.f];
        fr.push(n);
        let reset = false, mark = '';
        if (this.f < 9) {
            if (fr.length === 1 && n === 10) (reset = true), (mark = 'strike');
            else if (fr.length === 2) {
                reset = true;
                if (fr[0] + fr[1] === 10) mark = 'spare';
            }
            if (reset) this.f++;
        } else {
            const [a, b] = fr;
            if (fr.length === 1) {
                if (n === 10) (reset = true), (mark = 'strike');
            } else if (fr.length === 2) {
                if (a === 10 || a + b === 10) {
                    if (b === 10) (reset = true), (mark = 'strike');
                    else if (a !== 10) (reset = true), (mark = 'spare');
                } else this.done = true;
            } else {
                if (n === 10) mark = 'strike';
                else if (a === 10 && b !== 10 && b + n === 10) mark = 'spare';
                this.done = true;
            }
        }
        return { reset, mark };
    }

    /** Three strikes in a row ends in a turkey. */
    get turkey() {
        const r = this.rolls;
        return r.length >= 3 && r.slice(-3).every((v) => v === 10);
    }
}

// ------------------------------------------------------------------ the look

function laneTexture() {
    const c = Object.assign(document.createElement('canvas'), { width: 128, height: 2048 });
    const ctx = c.getContext('2d');
    // maple boards: 39 of them across a real lane
    for (let b = 0; b < 39; b++) {
        const x = (b / 39) * 128;
        const l = 62 + ((b * 37) % 11);
        ctx.fillStyle = `hsl(32, 52%, ${l}%)`;
        ctx.fillRect(x, 0, 128 / 39 + 0.5, 2048);
    }
    for (let k = 0; k < 400; k++) {
        ctx.fillStyle = `rgba(120,70,20,${0.04 + (k % 5) * 0.01})`;
        ctx.fillRect((k * 53) % 128, (k * 197) % 2048, 1, 30 + (k % 7) * 20);
    }
    // the dots near the foul line and the arrows further down, every five boards
    ctx.fillStyle = '#1b1430';
    const y = (s) => 2048 - (s / LANE_LEN) * 2048;
    for (const b of [3, 5, 8, 11, 14, 25, 28, 31, 34, 36]) {
        ctx.beginPath();
        ctx.arc((b / 39) * 128, y(2.1), 1.3, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let a = 0; a < 7; a++) {
        const b = 5 + a * 5;
        const x = (b / 39) * 128, yy = y(4.6 + Math.abs(a - 3) * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, yy - 12);
        ctx.lineTo(x - 2.2, yy + 6);
        ctx.lineTo(x + 2.2, yy + 6);
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

function pinGeometry() {
    const prof = [[0, 0], [0.026, 0], [0.04, 0.02], [0.055, 0.06], [0.0605, 0.115], [0.055, 0.17], [0.042, 0.215], [0.03, 0.238], [0.025, 0.25], [0.022, 0.262], [0.021, 0.275], [0.026, 0.31], [0.031, 0.34], [0.027, 0.365], [0.015, 0.378], [0, PIN_H]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 14);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const red = (y > 0.232 && y < 0.244) || (y > 0.256 && y < 0.268);
        col.set(red ? [0.85, 0.05, 0.08] : [0.97, 0.96, 0.93], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
}

function ballMaterial(hue) {
    const c = Object.assign(document.createElement('canvas'), { width: 256, height: 128 });
    const ctx = c.getContext('2d');
    const r = rng('ball' + hue);
    ctx.fillStyle = `hsl(${hue}, 80%, 35%)`;
    ctx.fillRect(0, 0, 256, 128);
    for (let k = 0; k < 40; k++) {
        ctx.strokeStyle = `hsla(${hue + r.range(-40, 40)}, 90%, ${r.range(40, 75)}%, 0.5)`;
        ctx.lineWidth = r.range(2, 8);
        ctx.beginPath();
        const y = r() * 128;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y + r.range(-40, 40), 170, y + r.range(-40, 40), 256, y);
        ctx.stroke();
    }
    for (let k = 0; k < 160; k++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.7})`;
        ctx.fillRect(r() * 256, r() * 128, 1, 1);
    }
    // the finger holes
    ctx.fillStyle = '#05030a';
    for (const [x, y] of [[60, 52], [72, 50], [66, 70]]) {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.12, metalness: 0.15, emissive: new THREE.Color().setHSL(hue / 360, 0.9, 0.5), emissiveMap: t, emissiveIntensity: 0.25 });
}

export class Bowling {
    /** @param {object} env { plan, scene, audio, camera, mats } */
    constructor(env) {
        this.env = env;
        this.plan = env.plan.bowling;
        this.lanes = this.plan.lanes;
        this.scene = env.scene;
        this.audio = env.audio;
        this.camera = env.camera;
        this.active = false;
        this.lane = null;
        this.state = 'idle';
        this.pickables = [];
        this.u = 0;
        this.aim = 0;
        this.power = 0;
        this.t = 0;
        this._build();
        this._dom();
    }

    // ------------------------------------------------------------ building

    _build() {
        const { scene } = this;
        const P = this.plan;
        const n = this.lanes.length;
        const laneTex = laneTexture();
        const boards = new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.16, metalness: 0.05, color: 0xf0e0c8 });
        const approachMat = new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.3, color: 0xd8c0a0 });
        const gutterMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
        const capMat = new THREE.MeshStandardMaterial({ color: 0x0b0a12, roughness: 0.25, metalness: 0.3 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.25 });
        const pitMat = new THREE.MeshBasicMaterial({ color: 0x020205 });
        const foulMat = new THREE.MeshBasicMaterial({ color: 0xff2040, toneMapped: false });
        const neon = [new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30e8ff).multiplyScalar(1.6), toneMapped: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3fd0).multiplyScalar(1.6), toneMapped: false })];
        this.neon = neon;
        const group = new THREE.Group();
        this.group = group;
        const box = (mat, w, h, d, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z);
            group.add(m);
            return m;
        };
        const lenWorld = P.foulZ - P.backZ;
        for (const L of this.lanes) {
            // the boards, foul line to the end of the deck
            const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, LANE_LEN).rotateX(-Math.PI / 2), boards);
            lane.position.set(L.x, LY, P.foulZ - LANE_LEN / 2);
            lane.userData = { kind: 'lane', lane: L.i };
            group.add(lane);
            this.pickables.push(lane);
            const deck = box(deckMat, LANE_W, 0.02, DECK_END - LANE_LEN + 0.3, L.x, LY - 0.01, P.foulZ - (LANE_LEN - 0.3 + DECK_END) / 2);
            deck.userData = { kind: 'lane', lane: L.i };
            this.pickables.push(deck);
            // the approach
            const ap = new THREE.Mesh(new THREE.PlaneGeometry(LANE_PITCH - 0.02, APPROACH).rotateX(-Math.PI / 2), approachMat);
            ap.position.set(L.x, 0.012, P.foulZ + APPROACH / 2);
            group.add(ap);
            box(foulMat, LANE_PITCH - 0.02, 0.004, 0.025, L.x, 0.016, P.foulZ);
            // the gutters: half-pipes either side of the boards
            for (const sd of [-1, 1]) {
                const g = new THREE.Mesh(new THREE.CylinderGeometry(GUTTER / 2, GUTTER / 2, LANE_LEN + 1.6, 12, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), gutterMat);
                g.position.set(L.x + sd * (HALF + GUTTER / 2), LY, P.foulZ - (LANE_LEN + 1.6) / 2);
                group.add(g);
            }
            // the pit behind the deck
            const pit = new THREE.Mesh(new THREE.PlaneGeometry(LANE_PITCH, 1.8).rotateX(-Math.PI / 2), pitMat);
            pit.position.set(L.x, -0.15, P.foulZ - DECK_END - 0.9);
            group.add(pit);
        }
        // the capping between lanes, with a strip of blacklight neon down each
        for (let i = 0; i <= n; i++) {
            const x = P.x0 + i * LANE_PITCH;
            const w = LANE_PITCH - LANE_W - GUTTER * 2;
            box(capMat, w, 0.09, LANE_LEN + 1.6, x, 0.045, P.foulZ - (LANE_LEN + 1.6) / 2);
            box(neon[i % 2], 0.03, 0.012, LANE_LEN + 1.6, x, 0.095, P.foulZ - (LANE_LEN + 1.6) / 2);
            // kickback walls beside the deck
            box(capMat, w, 0.7, DECK_END - LANE_LEN + 1.6, x, 0.35, P.foulZ - (LANE_LEN + DECK_END + 1.6) / 2 - 0.2);
        }
        // the masking unit over the pinsetters, all lanes wide, with the lane numbers
        const mw = n * LANE_PITCH;
        const mc = Object.assign(document.createElement('canvas'), { width: 256 * n, height: 192 });
        const mx = mc.getContext('2d');
        const sky = mx.createLinearGradient(0, 0, 0, 192);
        sky.addColorStop(0, '#1a0638');
        sky.addColorStop(1, '#3a0a5a');
        mx.fillStyle = sky;
        mx.fillRect(0, 0, mc.width, 192);
        const r = rng('masking');
        for (let k = 0; k < 160; k++) {
            mx.fillStyle = `rgba(255,255,255,${r() * 0.8})`;
            mx.fillRect(r() * mc.width, r() * 192, 2, 2);
        }
        // planets and a ringed one, in day-glo
        for (let k = 0; k < n; k++) {
            const cx = 256 * k + 60 + r() * 140, cy = 50 + r() * 60, rad = 14 + r() * 22;
            mx.fillStyle = ['#ff3fd0', '#30e8ff', '#ffe94a', '#5fff8f'][k % 4];
            mx.beginPath();
            mx.arc(cx, cy, rad, 0, Math.PI * 2);
            mx.fill();
            mx.strokeStyle = '#ffffff';
            mx.lineWidth = 3;
            mx.beginPath();
            mx.ellipse(cx, cy, rad * 1.8, rad * 0.45, -0.3, 0, Math.PI * 2);
            mx.stroke();
        }
        mx.font = `48px ${PIXEL_FONT}`;
        mx.textAlign = 'center';
        mx.textBaseline = 'middle';
        for (let k = 0; k < n; k++) {
            mx.shadowColor = '#30e8ff';
            mx.shadowBlur = 14;
            mx.fillStyle = '#ffffff';
            mx.fillText(String(k + 1), 256 * k + 128, 150);
        }
        const mt = new THREE.CanvasTexture(mc);
        mt.colorSpace = THREE.SRGBColorSpace;
        const mask = new THREE.Mesh(new THREE.PlaneGeometry(mw, 1.5), new THREE.MeshBasicMaterial({ map: mt, toneMapped: false, color: 0xcccccc }));
        mask.position.set(P.x0 + mw / 2, 1.45, P.foulZ - LANE_LEN - 0.55);
        group.add(mask);
        box(capMat, mw, 3.2, 0.2, P.x0 + mw / 2, 3.8, P.foulZ - LANE_LEN - 0.6);
        box(capMat, mw, 0.7, 2.8, P.x0 + mw / 2, 2.55, P.foulZ - DECK_END - 0.2);
        // the back wall behind the pits
        box(capMat, mw, 2.2, 0.2, P.x0 + mw / 2, 1.1, P.foulZ - DECK_END - 1.9);
        // a light over the pin decks, as in every alley
        const deckLight = box(new THREE.MeshBasicMaterial({ color: 0xfff6e8, toneMapped: false }), mw, 0.04, 0.3, P.x0 + mw / 2, 0.68, P.foulZ - LANE_LEN - 0.4);
        deckLight.rotation.x = 0.3;
        const pl = new THREE.PointLight(0xfff0e0, 6, 9, 1.6);
        pl.position.set(P.x0 + mw / 2, 0.7, P.foulZ - LANE_LEN + 0.2);
        group.add(pl);

        // the ball returns, with a rack of balls in every colour
        const hood = new THREE.MeshStandardMaterial({ color: 0x241a3a, roughness: 0.3, metalness: 0.4 });
        this.rackBalls = [];
        P.returns.forEach((rt, k) => {
            box(hood, 0.5, 0.55, 1.6, rt.x, 0.275, rt.z);
            for (const sd of [-1, 1]) box(neon[k % 2], 0.02, 0.025, 1.62, rt.x + sd * 0.25, 0.56, rt.z);
            for (let b = 0; b < 4; b++) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), ballMaterial((k * 97 + b * 61) % 360));
                m.position.set(rt.x + (b % 2 ? 0.12 : -0.12), 0.56 + BALL_R, rt.z - 0.45 + Math.floor(b / 2) * 0.5);
                m.rotation.set(b, b * 2, 0);
                group.add(m);
                this.rackBalls.push(m);
            }
        });
        // a glass-block wall between the alley and the arcade floor, lit from inside
        const wallZ0 = P.backZ, wallZ1 = P.foulZ + 0.6;
        const glass = new THREE.MeshStandardMaterial({ color: 0x6a5aff, emissive: 0x3a2aa0, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.55 });
        const blocks = Math.floor((wallZ1 - wallZ0) / 0.42);
        const glassG = new THREE.BoxGeometry(0.2, 0.4, 0.4);
        const gi = new THREE.InstancedMesh(glassG, glass, blocks * 6);
        const m4 = new THREE.Matrix4();
        let gk = 0;
        for (let b = 0; b < blocks; b++) for (let y = 0; y < 6; y++) {
            m4.makeTranslation(P.wallX, 0.21 + y * 0.42, wallZ0 + 0.21 + b * 0.42);
            gi.setMatrixAt(gk++, m4);
        }
        group.add(gi);
        box(neon[1], 0.24, 0.04, wallZ1 - wallZ0, P.wallX, 2.55, (wallZ0 + wallZ1) / 2);

        // the score monitors hanging over the approaches, one to a lane
        this.monitors = this.lanes.map((L) => {
            const c = Object.assign(document.createElement('canvas'), { width: 512, height: 224 });
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.66), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
            m.position.set(L.x, 3.0, P.foulZ - 1.2);
            m.rotation.x = 0.25;
            group.add(m);
            box(capMat, 1.6, 0.74, 0.08, L.x, 3.0, P.foulZ - 1.25).rotation.x = 0.25;
            box(capMat, 0.04, 3.2, 0.04, L.x, 4.8, P.foulZ - 1.3);
            const mon = { c, ctx: c.getContext('2d'), tex, lane: L.i, flash: '', flashT: 0 };
            this._drawMonitor(mon, null);
            return mon;
        });

        // pins: ten to a lane, all in one instanced mesh
        this.pinMesh = new THREE.InstancedMesh(pinGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0 }), n * 10);
        this.pinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.pinMesh.frustumCulled = false;
        group.add(this.pinMesh);
        this.racks = this.lanes.map(() => SPOTS.map((sp) => ({ u: sp.u, s: sp.s, vu: 0, vs: 0, down: false, tip: 0, dir: 0, out: false, gone: false })));
        for (let i = 0; i < n; i++) this._writePins(i);

        // the ball you bowl, the aim arrow and the pinsetter's sweep bar
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), ballMaterial(320));
        this.ball.visible = false;
        group.add(this.ball);
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 1.6);
        arrowShape.lineTo(-0.09, 1.25);
        arrowShape.lineTo(-0.035, 1.25);
        arrowShape.lineTo(-0.035, 0.25);
        arrowShape.lineTo(0.035, 0.25);
        arrowShape.lineTo(0.035, 1.25);
        arrowShape.lineTo(0.09, 1.25);
        arrowShape.lineTo(0, 1.6);
        this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30ffb0).multiplyScalar(1.5), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }));
        this.arrow.visible = false;
        group.add(this.arrow);
        this.sweepBar = box(new THREE.MeshStandardMaterial({ color: 0x2a2a34, metalness: 0.7, roughness: 0.35 }), LANE_W + GUTTER * 2, 0.16, 0.05, 0, 0.6, 0);
        this.sweepBar.visible = false;
        scene.add(group);
    }

    _dom() {
        const $ = (id) => document.getElementById(id);
        this.hud = $('bowl-hud');
        this.sheet = $('bowl-sheet');
        this.meter = $('bowl-meter');
        this.meterFill = $('bowl-meter-fill');
        this.say = $('bowl-say');
        this.hint = $('bowl-hint');
        this.holds = { left: false, right: false };
        if (!this.hud) return;
        const hold = (el, key) => {
            if (!el) return;
            const on = (e) => {
                e.preventDefault();
                this.holds[key] = true;
            };
            const off = () => (this.holds[key] = false);
            el.addEventListener('pointerdown', on);
            for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, off);
        };
        hold($('bowl-left'), 'left');
        hold($('bowl-right'), 'right');
        $('bowl-go')?.addEventListener('click', () => this.tap());
        $('bowl-quit')?.addEventListener('click', () => this.onQuit?.());
        $('bowl-again')?.addEventListener('click', () => this.newGame());
        this.keys = new Set();
        addEventListener('keydown', (e) => {
            if (!this.active || e.target.closest?.('input, textarea')) return;
            const k = e.key.toLowerCase();
            if (k === 'escape') return this.onQuit?.();
            if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) this.keys.add(k);
            if ((k === ' ' || k === 'enter') && !e.repeat) {
                // a focused button does its own thing with Space and Enter
                if (e.target.closest?.('button')) return;
                e.preventDefault();
                this.tap();
            }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        addEventListener('blur', () => this.keys.clear());
    }

    // ------------------------------------------------------------ playing

    /** Steps up to lane `i`'s foul line. */
    start(i, controls) {
        this.lane = this.lanes[i];
        this.controls = controls;
        this.active = true;
        this.startedAt = performance.now();
        this.game = new BowlingGame();
        this._reset(true);
        this._aim();
        // glide in from where you stood, unless that was across the hall (or behind the glass)
        const behind = new THREE.Vector3(this.lane.x, 1.5, this.lane.foulZ + 3.2);
        this.camPos = this.camera.position.distanceTo(behind) < 5 ? this.camera.position.clone() : behind.add(new THREE.Vector3(0, 0.3, 0.8));
        this.camLook = new THREE.Vector3(this.lane.x, 0.4, this.lane.foulZ - 4);
        this.hud && (this.hud.hidden = false);
        this._sheet();
        this._drawMonitor(this.monitors[i], this.game);
        this.audio?.coin();
    }

    stop() {
        if (!this.active) return;
        this.active = false;
        this.ball.visible = false;
        this.arrow.visible = false;
        this.sweepBar.visible = false;
        this.audio?.roll(0);
        if (this.hud) this.hud.hidden = true;
        // pins left mid-game are set back up for the next bowler
        const i = this.lane.i;
        this._reset(true);
        this._drawMonitor(this.monitors[i], null);
        this.state = 'idle';
        this.lane = null;
    }

    newGame() {
        if (!this.active) return;
        this.game = new BowlingGame();
        this._reset(true);
        this._aim();
        this._sheet();
        this._drawMonitor(this.monitors[this.lane.i], this.game);
    }

    get rack() {
        return this.racks[this.lane.i];
    }

    _reset(full) {
        const rack = this.racks[this.lane.i];
        rack.forEach((p, k) => {
            if (full) Object.assign(p, { u: SPOTS[k].u, s: SPOTS[k].s, down: false, gone: false, out: false, tip: 0 });
            else if (p.down || p.out) p.gone = true;
            p.vu = p.vs = 0;
        });
        this._writePins(this.lane.i);
    }

    _aim() {
        this.state = 'aim';
        this.t = 0;
        this.u = clamp(this.u, -HALF + BALL_R, HALF - BALL_R);
        this.ball.visible = true;
        this.arrow.visible = true;
        this._say('');
        this._showMeter(false);
        if (this.hint) this.hint.textContent = this.game.done ? '' : `Frame ${this.game.f + 1} · ball ${this.game.frames[this.game.f].length + 1} — slide with ◀ ▶ (A/D) · tap or Space to lock the aim`;
    }

    /** A click, a tap or Space: lock the aim, then the power, then nothing until the pins settle. */
    tap() {
        // the click that stepped up to the lane is not a throw
        if (!this.active || performance.now() - this.startedAt < 350) return;
        if (this.state === 'aim') {
            this.state = 'power';
            this.t = 0;
            this._showMeter(true);
            if (this.hint) this.hint.textContent = 'Tap or Space to set the power';
            this.audio?.pin(0.05);
        } else if (this.state === 'power') {
            this._release();
        } else if (this.state === 'over') this.newGame();
    }

    _release() {
        this.state = 'roll';
        this.arrow.visible = false;
        this._showMeter(false);
        if (this.hint) this.hint.textContent = '';
        // no two throws quite alike: a hair of wobble in the line and the pace
        const speed = 5.2 + this.power * 4.6 + (Math.random() - 0.5) * 0.3;
        const aim = this.aim + (Math.random() - 0.5) * 0.004;
        this.b = { u: this.u, s: 0, vu: Math.sin(aim) * speed, vs: Math.cos(aim) * speed, gutter: false };
        this.rollT = 0;
        this.settleT = 0;
        this.hitT = -1;
        this.standing = this.rack.filter((p) => !p.gone && !p.down).length;
        this.standingSet = new Set(this.rack.filter((p) => !p.gone && !p.down));
        this.lastPinSound = 0;
    }

    _sim(dt) {
        const b = this.b;
        const rack = this.rack;
        const pins = rack.filter((p) => !p.gone && !p.out);
        let acc = dt;
        while (acc > 1e-6) {
            const h = Math.min(STEP, acc);
            acc -= h;
            // the ball
            if (b) {
                b.u += b.vu * h;
                b.s += b.vs * h;
                b.vs *= 1 - 0.03 * h;
                if (!b.gutter && Math.abs(b.u) > HALF + 0.01 && b.s < LANE_LEN - 0.2) {
                    b.gutter = true;
                    b.u = Math.sign(b.u) * (HALF + GUTTER / 2);
                    b.vu = 0;
                    this.audio?.gutter();
                }
                if (!b.gutter && Math.abs(b.u) > HALF + GUTTER + 0.1 - BALL_R) {
                    b.u = Math.sign(b.u) * (HALF + GUTTER + 0.1 - BALL_R);
                    b.vu *= -0.4;
                }
            }
            // pins slide and slow on the deck
            for (const p of pins) {
                if (p.vu === 0 && p.vs === 0) continue;
                p.u += p.vu * h;
                p.s += p.vs * h;
                const sp = Math.hypot(p.vu, p.vs);
                const f = (p.down ? 3.2 : 4.5) * h;
                if (sp <= f) p.vu = p.vs = 0;
                else {
                    p.vu -= (p.vu / sp) * f;
                    p.vs -= (p.vs / sp) * f;
                }
                // kickbacks either side of the deck, and the cushion at the back of the pit
                const wall = HALF + GUTTER + 0.1 - PIN_R;
                if (Math.abs(p.u) > wall && p.s > LANE_LEN - 0.4) {
                    p.u = Math.sign(p.u) * wall;
                    p.vu *= -0.55;
                    if (!p.down) this._topple(p, Math.abs(p.vu) + 0.4);
                }
                if (Math.abs(p.u) > HALF + 0.02 && p.s < LANE_LEN - 0.3) p.out = true;
                if (p.s > DECK_END) p.out = true;
                if (p.s < LANE_LEN - 1.5) p.out = true;
                // nudged off its spot: it wobbles and goes over
                if (!p.down && Math.hypot(p.u - p.u0, p.s - p.s0) > 0.07) this._topple(p, 0.5);
            }
            // ball on pins
            if (b && !b.gutter) {
                for (const p of pins) this._collide(b, BALL_R, BALL_M, p, PIN_R, PIN_M, 0.7);
            }
            // pins on pins
            for (let i = 0; i < pins.length; i++) {
                for (let j = i + 1; j < pins.length; j++) this._collide(pins[i], PIN_R * (pins[i].down ? 1.5 : 1), PIN_M, pins[j], PIN_R * (pins[j].down ? 1.5 : 1), PIN_M, 0.55);
            }
        }
    }

    _collide(a, ra, ma, p, rp, mp, e) {
        const du = p.u - a.u, ds = p.s - a.s;
        const d = Math.hypot(du, ds), min = ra + rp;
        if (d >= min || d < 1e-6) return;
        const nu = du / d, ns = ds / d;
        // push apart by mass
        const over = min - d;
        const ia = 1 / ma, ip = 1 / mp;
        a.u -= nu * over * (ia / (ia + ip));
        a.s -= ns * over * (ia / (ia + ip));
        p.u += nu * over * (ip / (ia + ip));
        p.s += ns * over * (ip / (ia + ip));
        const rel = (p.vu - a.vu) * nu + (p.vs - a.vs) * ns;
        if (rel >= 0) return;
        const j = (-(1 + e) * rel) / (ia + ip);
        a.vu -= j * ia * nu;
        a.vs -= j * ia * ns;
        p.vu += j * ip * nu;
        p.vs += j * ip * ns;
        const hit = -rel;
        if (hit > 0.3) {
            if (p.tip !== undefined && !p.down) this._topple(p, hit);
            if (a.tip !== undefined && !a.down) this._topple(a, hit);
            const now = performance.now();
            if (now - this.lastPinSound > 25) {
                this.lastPinSound = now;
                this.audio?.pin(hit / 6);
            }
            if (this.hitT < 0) this.hitT = this.rollT;
        }
    }

    _topple(p, strength) {
        p.down = true;
        p.dir = Math.atan2(p.vu || (Math.random() - 0.5), p.vs || 0.5);
        p.tipV = 4 + Math.min(10, strength * 3);
        setTimeout(() => this.audio?.thud(), 200 + Math.random() * 200);
    }

    update(dt) {
        if (!this.active) return;
        this.t += dt;
        const L = this.lane;
        const P = this.plan;
        const W = (u, s, y) => new THREE.Vector3(L.x + u, y, P.foulZ - s);
        let camTo, lookTo;
        const slide = (this.keys.has('a') || this.keys.has('arrowleft') || this.holds.left ? -1 : 0) + (this.keys.has('d') || this.keys.has('arrowright') || this.holds.right ? 1 : 0);
        if (this.state === 'aim' || this.state === 'power') {
            if (this.state === 'aim') {
                this.u = clamp(this.u + slide * dt * 0.55, -HALF + BALL_R + 0.02, HALF - BALL_R - 0.02);
                this.aim = Math.sin(this.t * 1.9) * 0.045;
            } else {
                this.power = 0.5 - 0.5 * Math.cos(this.t * 3.4);
                if (this.meterFill) this.meterFill.style.transform = `scaleX(${this.power.toFixed(3)})`;
            }
            this.ball.position.copy(W(this.u, -0.25, LY + BALL_R));
            this.arrow.position.copy(W(this.u, -0.25, LY + 0.004));
            this.arrow.rotation.y = -this.aim;
            this.arrow.scale.setScalar(this.state === 'power' ? 1 + this.power * 0.8 : 1);
            // far enough back and high enough that the ball sits above the controls
            camTo = W(this.u * 0.4, -3.2, 1.5);
            lookTo = W(this.u * 0.25, 5, 0.05);
        } else if (this.state === 'roll') {
            this.rollT += dt;
            this._sim(dt);
            const b = this.b;
            this.ball.visible = b.s < PIT + 0.2;
            const y = b.gutter ? LY - 0.05 + BALL_R * 0.7 : LY + BALL_R;
            this.ball.position.copy(W(b.u, b.s, b.s > DECK_END ? y - Math.min(0.4, (b.s - DECK_END) * 0.6) : y));
            this.ball.rotation.x -= (b.vs * dt) / BALL_R;
            this.audio?.roll(b.s < DECK_END ? clamp(Math.hypot(b.vu, b.vs) / 9, 0, 1) : 0, b.gutter);
            const cs = Math.min(b.s, LANE_LEN - 4.2);
            camTo = W(b.u * 0.3, cs - 2.6, 1.15 + Math.max(0, b.s - 6) * 0.04);
            lookTo = W(0, Math.min(b.s + 4, LANE_LEN + 0.5), 0.15);
            const moving = this.rack.some((p) => !p.gone && !p.out && (Math.abs(p.vu) + Math.abs(p.vs) > 0.04 || (p.down && p.tip < 1)));
            const ballDone = b.s > PIT || Math.hypot(b.vu, b.vs) < 0.3;
            if (ballDone && !moving) this.settleT += dt;
            else this.settleT = 0;
            if (this.settleT > 0.9 || this.rollT > 12) this._settle();
        } else if (this.state === 'result' || this.state === 'sweep' || this.state === 'over') {
            camTo = W(0, LANE_LEN - 4.4, 1.25);
            lookTo = W(0, LANE_LEN + 0.6, 0.15);
            if (this.state === 'result' && this.t > 1.4) this._sweep();
            if (this.state === 'sweep') {
                const k = this.t / 1.6;
                const drop = k < 0.3 ? k / 0.3 : k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
                const sweepS = k < 0.3 ? LANE_LEN - 0.3 : lerp(LANE_LEN - 0.3, DECK_END, Math.min(1, (k - 0.3) / 0.4));
                this.sweepBar.visible = true;
                this.sweepBar.position.copy(W(0, sweepS, LY + 0.08 + (1 - drop) * 0.6));
                // the deadwood goes into the pit as the bar passes it
                for (const p of this.rack) if ((p.down || p.out) && p.s < sweepS && k > 0.3) p.gone = true;
                if (k >= 1) {
                    this.sweepBar.visible = false;
                    if (this.game.done) this._over();
                    else {
                        this._reset(this.pendingReset);
                        this._aim();
                    }
                }
            }
        }
        // pins tipping over
        for (const p of this.rack) {
            if (p.down && p.tip < 1) p.tip = Math.min(1, p.tip + dt * (p.tipV || 6) * (1 - p.tip * 0.6));
        }
        this._writePins(L.i);
        if (camTo) {
            this.camPos.lerp(camTo, 1 - Math.exp(-dt * (this.state === 'roll' ? 6 : 3)));
            this.camLook.lerp(lookTo, 1 - Math.exp(-dt * 4));
            this.camera.position.copy(this.camPos);
            this.camera.lookAt(this.camLook);
        }
        const mon = this.monitors[L.i];
        if (mon.flash && (mon.flashT -= dt) <= 0) {
            mon.flash = '';
            this._drawMonitor(mon, this.game);
        }
    }

    _settle() {
        this.state = 'result';
        this.t = 0;
        this.audio?.roll(0);
        this.ball.visible = false;
        let n = 0;
        for (const p of this.standingSet) if (p.down || p.out) n++;
        const { reset, mark } = this.game.roll(n);
        this.pendingReset = reset;
        const turkey = mark === 'strike' && this.game.turkey;
        const msg = turkey ? 'TURKEY!' : mark === 'strike' ? 'STRIKE!' : mark === 'spare' ? 'SPARE!' : n === 0 ? (this.b.gutter ? 'GUTTER BALL' : 'MISS') : `${n} PIN${n === 1 ? '' : 'S'}`;
        this._say(msg, mark || (n === 0 ? 'miss' : ''));
        this.audio?.fanfare(turkey ? 'turkey' : mark || (n === 0 ? 'miss' : 'pins'));
        const mon = this.monitors[this.lane.i];
        mon.flash = mark || turkey ? msg : '';
        mon.flashT = 2.6;
        this._drawMonitor(mon, this.game);
        this._sheet();
        this.onRoll?.(n, mark);
    }

    _sweep() {
        this.state = 'sweep';
        this.t = 0;
        this.audio?.sweep();
    }

    _over() {
        this.state = 'over';
        this.ball.visible = false;
        const total = this.game.total;
        const best = this.onBest?.(total);
        this._say(`GAME OVER · ${total}${best ? ' · NEW BEST!' : ''}`, 'done');
        this.audio?.fanfare('done');
        if (this.hint) this.hint.textContent = 'Tap or Space for another game · Esc to step off the lane';
        const again = document.getElementById('bowl-again');
        if (again) again.hidden = false;
        this._reset(true);
    }

    _writePins(i) {
        const rack = this.racks[i];
        const L = this.lanes[i];
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
        rack.forEach((p, k) => {
            if (p.u0 === undefined || (!p.down && p.vu === 0 && p.vs === 0 && p.tip === 0)) (p.u0 = p.u), (p.s0 = p.s);
            if (p.gone) {
                sc.setScalar(0);
                pos.set(L.x, -5, 0);
                q.identity();
            } else {
                sc.setScalar(1);
                // a toppled pin pivots on its base toward where it was going
                const tip = p.tip * (Math.PI / 2 - 0.08);
                e.set(Math.cos(p.dir) * -tip, 0, Math.sin(p.dir) * -tip, 'XYZ');
                q.setFromEuler(e);
                const sink = p.out && Math.abs(p.u) > HALF ? 0.06 : p.s > DECK_END ? 0.4 : 0;
                pos.set(L.x + p.u, LY - sink + Math.sin(tip) * PIN_R * 0.6, this.plan.foulZ - p.s);
            }
            m.compose(pos, q, sc);
            this.pinMesh.setMatrixAt(i * 10 + k, m);
        });
        this.pinMesh.instanceMatrix.needsUpdate = true;
    }

    // ------------------------------------------------------------ the score

    _drawMonitor(mon, game) {
        const { ctx, c } = mon;
        const W = c.width, H = c.height;
        ctx.fillStyle = '#05030c';
        ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        if (mon.flash) {
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, '#ff3fd0');
            g.addColorStop(1, '#30e8ff');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            ctx.font = `44px ${PIXEL_FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 0;
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#1a0630';
            ctx.strokeText(mon.flash, W / 2, H / 2);
            ctx.fillText(mon.flash, W / 2, H / 2);
            mon.tex.needsUpdate = true;
            return;
        }
        ctx.font = `16px ${PIXEL_FONT}`;
        ctx.fillStyle = '#30e8ff';
        ctx.fillText(`LANE ${mon.lane + 1}`, W / 2, 20);
        if (!game) {
            ctx.fillStyle = '#ffe94a';
            ctx.font = `20px ${PIXEL_FONT}`;
            ctx.fillText('OPEN BOWLING', W / 2, 90);
            ctx.fillStyle = '#ff3fd0';
            ctx.font = `12px ${PIXEL_FONT}`;
            ctx.fillText('CLICK THE LANE TO PLAY', W / 2, 140);
            ctx.fillStyle = '#8a8fb0';
            ctx.fillText(`BEST ${this.best?.() ?? 0}`, W / 2, 180);
            mon.tex.needsUpdate = true;
            return;
        }
        // ten boxes across
        const bw = (W - 20) / 10, y0 = 44, bh = 96;
        const scores = game.scores;
        ctx.lineWidth = 2;
        for (let f = 0; f < 10; f++) {
            const x = 10 + f * bw;
            ctx.strokeStyle = f === game.f && !game.done ? '#ffe94a' : '#5a5aa0';
            ctx.strokeRect(x, y0, bw, bh);
            const marks = frameMarks(game.frames[f], f === 9);
            ctx.font = `12px ${PIXEL_FONT}`;
            ctx.fillStyle = '#ffffff';
            marks.forEach((mk, k) => ctx.fillText(mk, x + bw - (marks.length - k - 0.5) * (bw / 3.2), y0 + 18));
            ctx.font = `13px ${PIXEL_FONT}`;
            ctx.fillStyle = '#5fff8f';
            if (scores[f] !== undefined) ctx.fillText(String(scores[f]), x + bw / 2, y0 + 64);
        }
        ctx.font = `18px ${PIXEL_FONT}`;
        ctx.fillStyle = '#ff3fd0';
        ctx.fillText(`TOTAL ${game.total}`, W / 2, 180);
        mon.tex.needsUpdate = true;
    }

    _sheet() {
        if (!this.sheet || !this.game) return;
        const g = this.game, s = g.scores;
        const again = document.getElementById('bowl-again');
        if (again) again.hidden = !g.done;
        this.sheet.innerHTML = g.frames.map((fr, f) => {
            const m = frameMarks(fr, f === 9);
            return `<div class="bf${f === g.f && !g.done ? ' now' : ''}"><span class="bf-n">${f + 1}</span><span class="bf-m">${m.map((x) => `<i>${x}</i>`).join('')}</span><b>${s[f] ?? ''}</b></div>`;
        }).join('') + `<div class="bf bf-total"><span class="bf-n">Total</span><b>${g.total}</b></div>`;
    }

    _showMeter(on) {
        if (this.meter) this.meter.hidden = !on;
    }

    _say(text, kind = '') {
        if (!this.say) return;
        this.say.textContent = text;
        this.say.className = 'bowl-say' + (kind ? ' ' + kind : '');
        this.say.hidden = !text;
    }

    /** For the tests: the pins left standing on the active lane. */
    get standingNow() {
        return this.lane ? this.rack.filter((p) => !p.gone && !p.down && !p.out).length : 0;
    }
}
