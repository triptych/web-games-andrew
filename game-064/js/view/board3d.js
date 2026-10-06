// board3d.js — the eight-by-eight patch of sea, the ships on it, and how they move.
//
// The board is one plane with a shader: chequered shallows and deeps, toon ripples,
// caustics, glints, and every highlight (selection, legal moves, captures, last move,
// check, hint, hover) read from an 8x8 marks texture. Ships live in a map of
// square -> item, kept in step with the simulation by replaying play() records.

import * as THREE from 'three';
import { PALETTE, TEX, NO_OUTLINE } from './toon.js';
import { createPiece } from './ships.js';
import { tween, wait, ease, lerp, lerpAngle } from './anim.js';
import { uniforms } from './stage.js';
import { fileOf, rankOf, ALL_SQUARES, sq as mkSq, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../sim/chess.js';

export const squarePos = (s, y = 0) => new THREE.Vector3(fileOf(s) - 3.5, y, 3.5 - rankOf(s));
export function squareAt(x, z) {
    const f = Math.floor(x + 4), r = Math.floor(4 - z);
    return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : mkSq(f, r);
}
const GLYPH = { [KING]: '♚', [QUEEN]: '♛', [ROOK]: '♜', [BISHOP]: '♝', [KNIGHT]: '♞', [PAWN]: '♟' };

const labelTex = new Map();
function glyphTexture(piece) {
    if (labelTex.has(piece)) return labelTex.get(piece);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = piece > 0 ? '#fdf8ea' : '#2a2530';
    g.strokeStyle = piece > 0 ? '#2c5ea8' : '#c23b2e';
    g.lineWidth = 8;
    g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.stroke();
    g.fillStyle = piece > 0 ? '#2c5ea8' : '#f4f0e6';
    g.font = '78px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(GLYPH[Math.abs(piece)], 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    labelTex.set(piece, t);
    return t;
}

export class BoardView {
    constructor(scene, fx) {
        this.scene = scene;
        this.fx = fx;
        this.items = new Map();
        this.nextId = 1;
        this.labels = false;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.marksData = new Uint8Array(8 * 8 * 4);
        this.marks = new THREE.DataTexture(this.marksData, 8, 8, THREE.RGBAFormat);
        this.marks.minFilter = this.marks.magFilter = THREE.NearestFilter;
        this.marks.needsUpdate = true;

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: uniforms.uTime, uStorm: uniforms.uStorm, uMarks: { value: this.marks },
                uLight: { value: new THREE.Color(PALETTE.boardLight) },
                uDark: { value: new THREE.Color(PALETTE.boardDark) },
                uSel: { value: new THREE.Color(0xffd65a) },
                uMove: { value: new THREE.Color(0xfff6c8) },
                uCap: { value: new THREE.Color(0xff5a4a) },
                uLast: { value: new THREE.Color(0xffe27a) },
                uCheck: { value: new THREE.Color(0xff2a3a) },
                uHint: { value: new THREE.Color(0x9cff8a) },
            },
            vertexShader: `varying vec2 vUv; varying vec3 vWorld;
                void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
            fragmentShader: `
                uniform sampler2D uMarks; uniform float uTime, uStorm;
                uniform vec3 uLight, uDark, uSel, uMove, uCap, uLast, uCheck, uHint;
                varying vec2 vUv; varying vec3 vWorld;
                float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
                void main(){
                    vec2 g = vUv * 8.0; vec2 cell = floor(g); vec2 l = fract(g);
                    float chk = mod(cell.x + cell.y, 2.0);
                    vec3 col = mix(uDark, uLight, chk);
                    vec2 p = vWorld.xz;
                    float w = sin(p.x * 2.1 + uTime * 0.8 + sin(p.y * 1.7 + uTime * 0.6) * 1.2) + sin(p.y * 2.5 - uTime * 0.9 + sin(p.x * 1.3) * 1.1);
                    if (w > 1.3) col = mix(col, vec3(1.0), chk > 0.5 ? 0.2 : 0.12);
                    else if (w < -1.4) col *= 0.92;
                    float c = abs(sin(p.x * 4.6 + sin(p.y * 3.9 + uTime) * 0.9) + sin(p.y * 5.1 + sin(p.x * 3.6 - uTime * 0.8) * 0.9));
                    if (c < 0.1) col = mix(col, vec3(1.0), chk > 0.5 ? 0.38 : 0.16);
                    vec2 sg = floor(p * 5.0);
                    if (hash(sg + floor(uTime * 0.8)) > 0.988) {
                        vec2 q = fract(p * 5.0) - 0.5;
                        float s = 1.0 - smoothstep(0.0, 0.1, abs(q.x) * abs(q.y) * 36.0 + length(q) * 0.55);
                        col = mix(col, vec3(1.0), s * 0.9);
                    }
                    vec2 e = min(l, 1.0 - l); float edge = min(e.x, e.y);
                    col = mix(col, col * 0.8, 1.0 - smoothstep(0.0, 0.025, edge));
                    vec4 m = texture2D(uMarks, (cell + 0.5) / 8.0);
                    float d = length(l - 0.5);
                    col = mix(col, uLast, m.b * 0.42);
                    col = mix(col, uCheck, m.a * (0.5 + 0.25 * sin(uTime * 6.0)));
                    if (m.r > 0.9) { col = mix(col, uSel, 0.55); col = mix(col, vec3(1.0), smoothstep(0.035, 0.0, abs(d - 0.43)) * 0.9); }
                    else if (m.r > 0.6) col = mix(col, uHint, 0.5 + 0.2 * sin(uTime * 5.0));
                    else if (m.r > 0.3) col = mix(col, vec3(1.0), 0.28);
                    if (m.g > 0.75) {
                        float ring = smoothstep(0.05, 0.0, abs(d - 0.41));
                        col = mix(col, uCap, min(1.0, ring + 0.22));
                    } else if (m.g > 0.25) {
                        float dotm = 1.0 - smoothstep(0.1, 0.125, d);
                        float ring = smoothstep(0.022, 0.0, abs(d - 0.2 - 0.03 * sin(uTime * 3.0)));
                        col = mix(col, uMove, max(dotm * 0.92, ring * 0.75));
                    }
                    col = mix(col, col * vec3(0.55, 0.6, 0.7), uStorm);
                    gl_FragColor = vec4(col, 1.0);
                    #include <colorspace_fragment>
                }`,
        });
        mat.userData.outlineParameters = NO_OUTLINE;
        const plane = new THREE.PlaneGeometry(8, 8, 1, 1);
        plane.rotateX(-Math.PI / 2);
        this.water = new THREE.Mesh(plane, mat);
        this.water.position.y = 0;
        scene.add(this.water);

        this.foamMat = new THREE.MeshBasicMaterial({ map: TEX.wakeRing(), transparent: true, depthWrite: false, opacity: 0.85 });
        this.foamMat.userData.outlineParameters = NO_OUTLINE;
        this.foamGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        this.marksState = { sel: -1, hover: -1, hint: [], targets: [], last: null, check: -1 };
    }

    // ---------------------------------------------------------------- items
    makeItem(piece, s) {
        const p = createPiece(piece);
        if (p.beam) p.beam.visible = false;   // daylight: beams only on the horizon lighthouse
        const item = { id: this.nextId++, piece, sq: s, ...p, phase: Math.random() * 6.28, sinking: false };
        item.root.position.copy(squarePos(s));
        const foam = new THREE.Mesh(this.foamGeo, this.foamMat);
        foam.scale.set(p.size.B * 2.1 + 0.15, 1, p.size.L * 1.5 + 0.1);
        if (p.building) foam.scale.set(0.95, 1, 0.95);
        foam.position.y = 0.012;
        foam.renderOrder = 2;
        item.root.add(foam);
        item.foam = foam;
        // Picking uses the ship's real meshes: what you see is what you click.
        item.pick = [];
        item.body.traverse((o) => { if (o.isMesh && o !== p.beam) { o.userData.item = item; item.pick.push(o); } });
        const lm = new THREE.SpriteMaterial({ map: glyphTexture(piece), depthTest: false, transparent: true });
        lm.userData.outlineParameters = NO_OUTLINE;
        item.label = new THREE.Sprite(lm);
        item.label.scale.setScalar(0.42);
        item.label.position.y = p.size.top + 0.3;
        item.label.renderOrder = 20;
        item.label.visible = this.labels;
        item.root.add(item.label);
        this.group.add(item.root);
        return item;
    }

    disposeItem(item) {
        this.group.remove(item.root);
        item.label.material.dispose();
    }

    setBoard(board) {
        for (const it of this.items.values()) this.disposeItem(it);
        this.items.clear();
        for (const s of ALL_SQUARES) if (board[s]) this.items.set(s, this.makeItem(board[s], s));
    }

    /** True if every square holds the piece the simulation says it does. */
    matches(board) {
        for (const s of ALL_SQUARES) {
            const it = this.items.get(s);
            if ((it ? it.piece : 0) !== board[s]) return false;
        }
        return this.items.size === ALL_SQUARES.filter((s) => board[s]).length;
    }

    setLabels(on) {
        this.labels = on;
        for (const it of this.items.values()) it.label.visible = on;
    }

    pickables() { const out = []; for (const it of this.items.values()) out.push(...it.pick); return out; }

    // ---------------------------------------------------------------- marks
    setMarks(m) {
        Object.assign(this.marksState, m);
        const d = this.marksData;
        d.fill(0);
        const at = (s) => (rankOf(s) * 8 + fileOf(s)) * 4;
        const st = this.marksState;
        if (st.last) for (const s of [st.last.from, st.last.to]) if (s >= 0) d[at(s) + 2] = 255;
        if (st.check >= 0) d[at(st.check) + 3] = 255;
        if (st.hover >= 0) d[at(st.hover)] = 128;
        for (const s of st.hint) d[at(s)] = 191;
        if (st.sel >= 0) d[at(st.sel)] = 255;
        for (const t of st.targets) d[at(t.to) + 1] = t.capture ? 255 : 128;
        this.marks.needsUpdate = true;
    }

    // ---------------------------------------------------------------- per frame
    update(dt, t) {
        for (const it of this.items.values()) this.bob(it, t);
        for (const it of this.extraBobbers || []) this.bob(it, t);
    }

    bob(it, t) {
        if (it.sinking) return;
        const b = it.body;
        const k = it.building ? 0.25 : 1;
        b.position.y = Math.sin(t * 1.5 + it.phase) * 0.018 * k;
        b.rotation.z = Math.sin(t * 1.15 + it.phase) * 0.045 * k + (it.lean || 0);
        b.rotation.x = Math.sin(t * 0.9 + it.phase * 1.3) * 0.028 * k + (it.pitch || 0);
        if (it.beam) it.beam.rotation.y = t * 1.3 + it.phase;
        it.foam.material.opacity = 0.85;
        it.foam.rotation.y = Math.sin(t * 0.5 + it.phase) * 0.15;
    }

    // ---------------------------------------------------------------- motion
    /** Yaw that points this item's bow along (dx, dz). */
    headingFor(it, dx, dz) {
        const yaw = Math.atan2(-dx, -dz);
        return it.color > 0 ? yaw : yaw - Math.PI;
    }

    turnTo(it, yaw, dur = 0.25) {
        if (it.building) return Promise.resolve();
        const y0 = it.root.rotation.y;
        return tween(dur, (k) => { it.root.rotation.y = lerpAngle(y0, yaw, k); });
    }

    /**
     * Sail an item to a square. opts: { dur, arc (height), turn (face travel), wake, lean }.
     * Does not touch the items map; callers re-key it.
     */
    async sail(it, toSq, opts = {}) {
        const from = it.root.position.clone();
        const to = squarePos(toSq);
        const dx = to.x - from.x, dz = to.z - from.z;
        const dist = Math.hypot(dx, dz);
        const dur = opts.dur ?? Math.min(1.25, 0.42 + dist * 0.17);
        const turn = opts.turn !== false && !it.building && dist > 0.01;
        const yaw0 = it.root.rotation.y;
        const yaw = turn ? this.headingFor(it, dx, dz) : yaw0;
        if (turn) await this.turnTo(it, yaw, 0.18);
        let wakeT = 0;
        const arc = opts.arc || 0;
        await tween(dur, (k) => {
            it.root.position.set(lerp(from.x, to.x, k), Math.sin(Math.PI * k) * arc, lerp(from.z, to.z, k));
            it.pitch = arc ? -Math.cos(Math.PI * k) * 0.35 : Math.sin(Math.PI * k) * 0.06;
            it.lean = (opts.lean || 0) * Math.sin(Math.PI * k);
            if (opts.wake !== false && this.fx && !arc) {
                wakeT += 1;
                if (wakeT % 3 === 0) this.fx.wake(it.root.position, it.root.rotation.y + (it.color > 0 ? 0 : Math.PI));
            }
        }, opts.ease || ease.inOut);
        it.pitch = 0; it.lean = 0;
        if (arc && this.fx) this.fx.splash(to, 0.8);
        if (turn && opts.faceHome !== false) await this.turnTo(it, 0, 0.22);
        it.sq = toSq;
    }

    /** Sink an item where it is, then drop it from the scene. */
    async sink(it, opts = {}) {
        it.sinking = true;
        const p0 = it.root.position.clone();
        const roll = (Math.random() < 0.5 ? -1 : 1) * (it.building ? 0.5 : 1.1);
        const dur = opts.dur ?? 1.0;
        if (this.fx) this.fx.bubbles(p0, 14, dur + 0.4);
        await tween(dur, (k) => {
            it.root.position.y = p0.y - k * k * 1.3;
            it.body.rotation.z = roll * k;
            it.body.rotation.x = (opts.pitch ?? 0.5) * k;
            it.foam.material = it.foam.material; // shared; fade via scale instead
            it.foam.scale.multiplyScalar(0.985);
        }, ease.in);
        this.disposeItem(it);
    }

    /** Raise a new item from the depths (salvage). */
    async rise(it, dur = 1.1) {
        it.sinking = true;
        const p = it.root.position.clone();
        it.root.position.y = -1.3;
        it.body.rotation.z = 0.6;
        await tween(dur, (k) => {
            it.root.position.y = lerp(-1.3, p.y, k);
            it.body.rotation.z = 0.6 * (1 - k);
        }, ease.backOut);
        it.sinking = false;
        if (this.fx) this.fx.splash(p, 0.9);
    }

    /** Swap a piece's model in place (promotion). */
    async transform(it, newPiece) {
        const old = { root: it.root };
        await tween(0.3, (k) => { old.root.scale.setScalar(1 - k * 0.9); }, ease.in);
        this.disposeItem(it);
        const fresh = this.makeItem(newPiece, it.sq);
        fresh.id = it.id;
        fresh.root.position.copy(it.root.position);
        fresh.root.scale.setScalar(0.1);
        this.items.set(it.sq, fresh);
        if (this.fx) this.fx.sparkle(fresh.root.position, 26);
        await tween(0.45, (k) => { fresh.root.scale.setScalar(0.1 + 0.9 * k); }, ease.backOut);
        return fresh;
    }

    /** Re-key the map after simultaneous moves [{ item, to }]. */
    rekey(list) {
        // sail() has already updated item.sq, so find each item's old key by identity.
        const moving = new Set(list.map((x) => x.item));
        for (const [s, it] of [...this.items]) if (moving.has(it)) this.items.delete(s);
        for (const { item, to } of list) { item.sq = to; this.items.set(to, item); }
    }

    // ---------------------------------------------------------------- a full move
    /** Animate a move record from Match.play(). Updates the items map. */
    async playMove(mv, sounds) {
        const it = this.items.get(mv.from);
        if (!it) return;
        const isKnight = Math.abs(mv.piece) === KNIGHT;
        const victim = mv.captured ? this.items.get(mv.capSq) : null;
        if (victim) {
            this.items.delete(mv.capSq);
            const target = squarePos(mv.capSq);
            const from = it.root.position.clone();
            if (!it.building) await this.turnTo(it, this.headingFor(it, target.x - from.x, target.z - from.z), 0.22);
            sounds?.cannon();
            const muzzle = from.clone().add(new THREE.Vector3(target.x - from.x, 0, target.z - from.z).normalize().multiplyScalar(0.35));
            muzzle.y = it.building ? 0.9 : 0.16;
            this.fx?.cannon(muzzle, target);
            await wait(0.32);
            sounds?.hit();
            this.fx?.splash(target, 1.2);
            this.fx?.flash(target.clone().setY(0.3));
            const sinking = this.sink(victim, { dur: 0.95 });
            await wait(0.25);
            await this.sail(it, mv.to, { arc: isKnight ? 0.7 : 0, turn: true });
            await sinking;
        } else if (mv.rookFrom !== undefined) {
            const rook = this.items.get(mv.rookFrom);
            sounds?.creak();
            await Promise.all([this.sail(it, mv.to, { dur: 0.8 }), rook ? this.sail(rook, mv.rookTo, { dur: 0.8 }) : null]);
            if (rook) { this.items.delete(mv.rookFrom); }
            this.items.delete(mv.from);
            this.items.set(mv.to, it);
            if (rook) this.items.set(mv.rookTo, rook);
            return;
        } else {
            sounds?.creak();
            await this.sail(it, mv.to, { arc: isKnight ? 0.75 : 0 });
        }
        this.items.delete(mv.from);
        this.items.set(mv.to, it);
        if (mv.promo) {
            sounds?.promote();
            await this.transform(it, mv.promo * mv.color);
        }
    }

    squareOfPoint(p) { return squareAt(p.x, p.z); }
}
