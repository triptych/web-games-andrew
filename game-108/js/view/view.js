// The view: plays the sim's events back as animation, one at a time, and draws the board and the
// enemy every frame. It reads G and the events; it never changes G.
//
// While anything plays, `busy` is true, and the game ignores the board until it is done (main.js
// also counts undrained G.events as busy: for one frame the sim has moved on and the view has not
// heard yet).

import * as THREE from 'three';
import { Stage, cellPos, ENEMY_POS, HALF } from './stage.js';
import { Tokens } from './tokens.js';
import { Sparks, Shards, Bolts, Glows, Floats } from './fx.js';
import { monster, heroFigure } from './models.js';
import { COLORS, HERO, ENEMIES, OATHS, REGIONS, ABILITY_TEXT, STAGES } from '../sim/data.js';
import { W } from '../sim/board.js';

const ease = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k;
const back = (k) => { const s = 1.6; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };
const cellOf = (i) => [i % W, (i / W) | 0];

/** A list of timed tasks. Blocking tasks keep the event pump waiting. */
class Timeline {
    constructor() { this.q = []; }
    add(delay, dur, fn, block = true) { this.q.push({ t: -delay, dur: Math.max(0.0001, dur), fn, block }); }
    get busy() { return this.q.some((a) => a.block); }
    update(dt) {
        for (let i = 0; i < this.q.length; i++) {
            const a = this.q[i];
            a.t += dt;
            if (a.t < 0) continue;
            const k = Math.min(1, a.t / a.dur);
            a.fn(k);
            if (k >= 1) { this.q.splice(i, 1); i--; }
        }
    }
    flush() { while (this.q.length) { const a = this.q.shift(); a.fn(1); } }
}

export class View {
    constructor(canvas, { floats, hooks = {} } = {}) {
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.tokens = new Tokens(this.stage);
        this.sparks = new Sparks(this.scene);
        this.shards = new Shards(this.scene, this.stage.env);
        this.bolts = new Bolts(this.scene, this.sparks);
        this.glows = new Glows(this.scene);
        this.floats = new Floats(floats);
        this.hooks = hooks;
        this.tl = new Timeline();
        this.q = [];
        this.speed = 1;
        this.enemy = null;            // { root, parts, def, base }
        this.time = 0;
        this.sel = null;              // selected cell index
        this.cursor = null;           // keyboard cursor cell index
        this.hint = null;             // [i, j]
        this.calm = false;
        this.quiet = false;           // the attract board: animate, but no HUD or sound
        this.portraitQ = [];
        this.portraits = new Map();
        this.portraitScene = this.makePortraitScene();
    }

    get busy() { return this.q.length > 0 || this.tl.busy; }
    setPad(p) { this.stage.setPad(p); }
    setCalm(on) { this.calm = on; this.stage.shakeScale = on ? 0.2 : 1; }

    /** Drop everything queued or playing and empty the board (a new battle, back to the title). */
    reset() {
        this.tl.flush();
        this.q.length = 0;
        this.tokens.clear();
        this.dropEnemy();
        this.sel = this.cursor = null;
        this.hint = null;
    }

    /** Queue sim events for playback. */
    push(events) { for (const e of events) this.q.push(e); }

    /** Snap the board to G with no animation (a loaded save, the attract board). */
    syncBoard(B) {
        this.tl.flush();
        this.q.length = 0;
        this.tokens.clear();
        if (!B) { this.tokens.hidden = true; return; }
        this.tokens.hidden = false;
        B.g.forEach((t, i) => { if (t) this.tokens.add(t, i); });
        this.stage.setSky(REGIONS[B.region].sky);
        if (B.enemy && B.enemy.hp > 0) this.showEnemy(B.enemy.id, false);
        else this.dropEnemy();
    }

    // ------------------------------------------------------------------ the enemy
    showEnemy(id, animate = true) {
        this.dropEnemy();
        const def = ENEMIES[id];
        const root = monster(def);
        root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        const s = def.scale * 1.05;
        root.position.copy(ENEMY_POS);
        root.scale.setScalar(animate ? 0.01 : s);
        this.scene.add(root);
        this.enemy = { root, parts: root.userData.parts, def, s, lunge: 0, hit: 0, cast: 0, dying: 0 };
        this.stage.daisMat.uniforms.uCol.value.set(COLORS[def.c].hex);
        if (animate) {
            this.glows.beam(ENEMY_POS, COLORS[def.c].hex, 1.0, 3.2);
            this.tl.add(0, 0.7 / this.speed, (k) => root.scale.setScalar(s * back(k)));
        }
    }
    dropEnemy() {
        if (!this.enemy) return;
        this.scene.remove(this.enemy.root);
        for (const m of this.enemy.parts.mats) m.dispose();
        this.enemy = null;
    }
    enemyHead() {
        const e = this.enemy;
        const p = ENEMY_POS.clone();
        p.y += (e ? 2.2 * e.s : 2);
        return p;
    }

    poseEnemy(dt) {
        const e = this.enemy;
        if (!e) return;
        const t = this.time, P = e.parts;
        e.hit = Math.max(0, e.hit - dt * 3);
        e.cast = Math.max(0, e.cast - dt * 1.5);
        const lift = P.float ? 0.25 + Math.sin(t * 1.6) * 0.12 : 0;
        P.body.position.y = lift + (P.float ? 0 : Math.abs(Math.sin(t * 1.3)) * 0.04);
        P.body.position.z = e.lunge * 1.4;
        P.body.rotation.x = -e.lunge * 0.25 + e.hit * 0.12;
        P.body.rotation.z = Math.sin(t * 0.9) * 0.03 + (Math.random() - 0.5) * e.hit * 0.15;
        P.body.scale.set(1 + Math.sin(t * 2.1) * 0.012, 1 + Math.sin(t * 2.1 + 1) * 0.02, 1);
        for (const [k, w] of P.wings.entries()) w.rotation.y = Math.sin(t * (P.float ? 7 : 2.2) + k) * 0.35 * (k ? 1 : -1);
        for (const [k, a] of P.arms.entries()) a.rotation.x = Math.sin(t * 1.8 + k * 1.7) * 0.12 - e.lunge * 0.7;
        if (P.jaw) P.jaw.rotation.x = 0.1 + e.lunge * 0.5 + Math.max(0, Math.sin(t * 0.7)) * 0.05;
        if (P.head) P.head.rotation.y = Math.sin(t * 0.6) * 0.18;
        if (P.tail) P.tail.rotation.z = Math.sin(t * 2.5) * 0.3;
        if (P.seals) P.seals.rotation.y = t * 0.6;
        if (P.mouthGlow) P.mouthGlow.scale.setScalar(0.8 + e.cast * 1.5 + Math.sin(t * 6) * 0.1);
        const flash = e.hit * 1.4 + e.cast * 0.8;
        for (const m of P.mats) {
            if (m.userData.e0 === undefined) { m.userData.e0 = m.emissive.clone(); m.userData.ei0 = m.emissiveIntensity; }
            if (flash > 0.01) { m.emissive.setRGB(1, e.cast > e.hit ? 0.6 : 0.95, e.cast > e.hit ? 0.9 : 0.9); m.emissiveIntensity = m.userData.ei0 * (1 - flash) + flash * 0.9; }
            else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
        }
        if (e.dying > 0) {
            const k = e.dying;
            e.root.scale.setScalar(e.s * (1 - k * 0.9));
            e.root.rotation.y = k * 4;
            e.root.position.y = ENEMY_POS.y - k * 0.6;
        }
    }

    // ------------------------------------------------------------------ portraits
    makePortraitScene() {
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.4));
        const d = new THREE.DirectionalLight(0xffffff, 2.2);
        d.position.set(1, 2, 3);
        sc.add(d);
        const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
        cam.position.set(0, 0.85, 2.0);
        cam.lookAt(0, 0.55, 0);
        return { sc, cam };
    }
    /** A data URL portrait of hero id (made on a later frame), or null until it exists. */
    portrait(id) {
        if (this.portraits.has(id)) return this.portraits.get(id);
        if (!this.portraitQ.includes(id)) this.portraitQ.push(id);
        return null;
    }
    renderPortraits() {
        if (!this.portraitQ.length) return;
        const r = this.stage.renderer, pr = r.getPixelRatio();
        const S = 128;
        if (this.stage.canvas.width < S * pr || this.stage.canvas.height < S * pr) return;
        const { sc, cam } = this.portraitScene;
        for (let n = 0; n < 2 && this.portraitQ.length; n++) {
            const id = this.portraitQ.shift();
            const fig = heroFigure(HERO[id]);
            fig.rotation.y = -0.35;
            sc.add(fig);
            sc.background = new THREE.Color(COLORS[HERO[id].c].hex).multiplyScalar(0.18);
            r.setScissorTest(true);
            r.setViewport(0, 0, S, S);
            r.setScissor(0, 0, S, S);
            r.setRenderTarget(null);
            r.render(sc, cam);
            const cv = document.createElement('canvas');
            cv.width = cv.height = S;
            cv.getContext('2d').drawImage(r.domElement, 0, r.domElement.height - S * pr, S * pr, S * pr, 0, 0, S, S);
            sc.remove(fig);
            r.setScissorTest(false);
            r.setViewport(0, 0, this.stage.w, this.stage.h);
            const url = cv.toDataURL('image/png');
            this.portraits.set(id, url);
            this.hooks.portrait?.(id, url);
        }
    }

    /** Client px of cell i's centre (for the tests and for floating text). */
    cellScreen(i) {
        const [x, y] = cellOf(i);
        return this.stage.toScreen(cellPos(x, y).setY(0.25));
    }

    // ------------------------------------------------------------------ highlights
    setSel(i) { this.sel = i; }
    setCursor(i) { this.cursor = i; }
    setHint(pair) { this.hint = pair; this.hintT = 0; }
    updateGlows(dt) {
        const g = this.stage.cellGlow;
        const place = (m, i, a) => {
            if (i == null || i < 0) { m.visible = false; return; }
            const [x, y] = cellOf(i);
            cellPos(x, y, m.position).setY(0.012);
            m.visible = true;
            m.material.uniforms.uA.value = a;
        };
        place(g.sel, this.sel, 1);
        place(g.cur, this.cursor, 0.8);
        if (this.hint) { this.hintT += dt; place(g.hint, this.hint[(Math.floor(this.hintT * 1.5) % 2)], 0.6); }
        else g.hint.visible = false;
        for (const vt of this.tokens.vts.values()) {
            const target = vt.i === this.sel ? 0.45 : 0;
            vt.glow += (target - vt.glow) * Math.min(1, dt * 12);
            if (vt.i === this.sel) vt.lift = Math.max(vt.lift, 0.12 + Math.sin(this.time * 6) * 0.04);
        }
    }

    // ------------------------------------------------------------------ playback
    pump() {
        let guard = 0;
        while (!this.tl.busy && this.q.length && guard++ < 50) {
            const e = this.q.shift();
            const h = this['on_' + e.type];
            if (h) h.call(this, e);
        }
        if (!this.q.length && !this.tl.busy && this.wasBusy) this.hooks.idle?.();
        this.wasBusy = this.busy;
    }
    d(s) { return s / this.speed; }

    on_battle(e) {
        this.tokens.clear();
        this.tokens.hidden = false;
        this.sel = this.cursor = null;
        this.hint = null;
        const st = STAGES[e.stage];
        this.stage.setSky(REGIONS[st.region].sky);
        e.board.forEach((t, i) => {
            const vt = this.tokens.add(t, i);
            const [, y] = cellOf(i);
            vt.lift = 3 + y * 0.25;
            vt.sc = 0;
            this.tl.add(this.d(y * 0.04 + (i % W) * 0.015), this.d(0.42), (k) => { vt.lift = (1 - easeIn(k)) * (3 + y * 0.25); vt.sc = Math.min(1, k * 2); if (k >= 1) { vt.lift = 0; vt.sc = 1; } });
        });
        this.hooks.battleOpen?.(e);
    }

    on_enemy(e) {
        this.showEnemy(e.enemy.id, true);
        this.hooks.enemy?.(e);
    }

    on_place(e) {
        const old = this.tokens.get(e.old);
        if (old) this.tl.add(0, this.d(0.2), (k) => { old.sc = 1 - k; if (k >= 1) this.tokens.remove(old.id); });
        const vt = this.tokens.add(e.tok, e.i);
        vt.lift = 4; vt.sc = 0;
        this.glows.beam(vt.p, COLORS[e.tok.c].hex, this.d(1.1));
        this.tl.add(this.d(0.15), this.d(0.5), (k) => { vt.lift = 4 * (1 - ease(k)); vt.sc = Math.min(1, k * 1.5); });
    }

    on_arrive(e) {
        const vt = this.tokens.get(e.id);
        const h = HERO[e.hero];
        if (vt) {
            this.glows.beam(vt.p, COLORS[h.c].hex, this.d(1.2));
            this.glows.ripple(vt.p, COLORS[h.c].hex, this.d(0.8), 3);
            this.sparks.emit(vt.p.clone().setY(0.5), COLORS[h.c].hex, { n: 30, speed: 3, up: 3, life: 0.9 });
        }
        this.hooks.arrive?.(e);
        this.tl.add(0, this.d(0.55), () => {});
    }

    on_change(e) {
        const fromP = e.cause === 'enemy' ? this.enemyHead() : e.at >= 0 ? cellPos(...cellOf(e.at)).setY(0.6) : new THREE.Vector3(0, 1.5, HALF + 1);
        const col = e.cause === 'enemy' ? COLORS[ENEMIES[e.who].c].hex : COLORS[HERO[e.who].c].hex;
        if (e.cause === 'enemy' && this.enemy) this.enemy.cast = 1;
        e.changes.forEach((ch, n) => {
            const vt = this.tokens.get(ch.tok.id);
            if (!vt) return;
            const delay = this.d(0.05 + n * 0.035);
            this.bolts.fire(fromP, vt.p.clone().setY(0.4), col, delay, null, 0.6);
            let applied = false;
            this.tl.add(delay + this.d(0.25), this.d(0.3), (k) => {
                vt.morph = k < 0.5 ? 1 - k * 1.2 : 0.4 + (k - 0.5) * 1.2;
                vt.flash = Math.sin(k * Math.PI) * 0.6;
                if (k >= 0.5 && !applied) {
                    applied = true;
                    vt.tok = { ...ch.tok };
                    if (ch.tok.h) this.tokens.figureFor(vt);
                    this.sparks.emit(vt.p.clone().setY(0.35), COLORS[ch.tok.c]?.hex ?? 0xcccccc, { n: 6, speed: 1.5, up: 1.5, life: 0.5, size: 0.1 });
                }
                if (k >= 1) { vt.morph = 1; vt.flash = 0; }
            });
        });
        if (e.kind) this.hooks.change?.(e);
        if (!e.changes.length) this.tl.add(0, this.d(0.15), () => {});
    }

    on_shuffle(e) {
        this.hooks.banner?.('No moves — the stones shift', 'info');
        for (const ch of e.changes) {
            const vt = this.tokens.get(ch.tok.id);
            if (!vt) continue;
            let applied = false;
            this.tl.add(Math.random() * this.d(0.1), this.d(0.5), (k) => {
                vt.rot = k * Math.PI * 2;
                vt.morph = 1 - Math.sin(k * Math.PI) * 0.5;
                if (k >= 0.5 && !applied) { applied = true; vt.tok = { ...ch.tok }; }
                if (k >= 1) { vt.rot = 0; vt.morph = 1; }
            });
        }
    }

    on_swap(e) {
        const a = this.tokens.get(e.a), b = this.tokens.get(e.b);
        if (!a || !b) return;
        const pa = a.p.clone(), pb = b.p.clone();
        const ia = a.i, ib = b.i;
        this.sel = null;
        this.tl.add(0, this.d(0.16), (k) => {
            const q = ease(k);
            a.p.lerpVectors(pa, pb, q); b.p.lerpVectors(pb, pa, q);
            a.lift = b.lift = Math.sin(q * Math.PI) * 0.25;
            if (k >= 1) { a.i = ib; b.i = ia; }
        });
        if (!e.ok) {
            this.tl.add(this.d(0.16), this.d(0.16), (k) => {
                const q = ease(k);
                a.p.lerpVectors(pb, pa, q); b.p.lerpVectors(pa, pb, q);
                if (k >= 1) { a.i = ia; b.i = ib; a.lift = b.lift = 0; }
            });
            this.hooks.nope?.(e);
        }
    }

    on_clear(e) {
        const target = this.enemyHead();
        const bolts = [];
        let recruited = false;
        this.hooks.combo?.(e);
        e.cells.forEach((c, n) => {
            const vt = this.tokens.get(c.id);
            if (!vt) return;
            const col = c.kind === 'rubble' ? 0x9a928a : COLORS[c.c]?.hex ?? 0xffffff;
            if (c.h) {
                recruited = true;
                const h = HERO[c.h];
                this.glows.beam(vt.p, COLORS[h.c].hex, this.d(1.4), 1.2);
                this.sparks.emit(vt.p.clone().setY(0.6), 0xffe9a0, { n: 50, speed: 2.5, up: 5, life: 1.2, size: 0.14, grav: 2 });
                this.tl.add(0, this.d(0.9), (k) => { vt.figLift = easeIn(k) * 3; vt.spin = k * 8; vt.sc = 1 - Math.max(0, k - 0.6) * 2.5; if (k >= 1) this.tokens.remove(vt.id); });
                bolts.push({ from: vt.p.clone().setY(1), col: COLORS[h.c].hex, size: 1.8 });
                return;
            }
            this.tl.add(this.d(n * 0.012), this.d(0.22), (k) => {
                vt.sc = k < 0.4 ? 1 + k * 0.6 : (1.24) * (1 - (k - 0.4) / 0.6);
                vt.flash = k * 0.8;
                vt.lift = k * 0.2;
                if (k >= 1) {
                    this.tokens.remove(vt.id);
                    if (c.kind === 'rubble') this.shards.burst(vt.p, 0x8a827a, 6);
                    else { this.shards.burst(vt.p, col, 5); this.sparks.emit(vt.p.clone().setY(0.35), col, { n: 8, speed: 2.2, up: 2.4, life: 0.6 }); }
                }
            });
            if (c.kind !== 'rubble' && (n % 2 === 0 || e.cells.length < 6)) bolts.push({ from: vt.p.clone().setY(0.4), col, size: 1 });
        });
        for (const id of e.unfrozen) {
            const vt = this.tokens.get(id);
            if (vt) { vt.tok.fz = false; this.shards.burst(vt.p.clone().setY(0.3), 0xcfeeff, 8); }
        }
        for (const w of e.wakes) {
            const vt = this.tokens.get(w.id);
            if (vt) { vt.tok.wake = w.wake; this.glows.ripple(vt.p, 0xc9b8ff, this.d(0.6), 1.6); this.hooks.wake?.(w); }
        }
        if (e.quake != null) { this.stage.kick(0.8); this.glows.ripple(cellPos(3, e.quake), 0xffffff, this.d(0.6), 6); }
        // the damage lands when the last bolt does
        const dmg = e.dmg, ehp = e.ehp;
        bolts.forEach((b, k) => {
            const last = k === bolts.length - 1;
            this.bolts.fire(b.from, target, b.col, this.d(0.12 + k * 0.03), last ? () => this.enemyHit(dmg, ehp, e.combo) : null, b.size);
        });
        if (!bolts.length && dmg) this.enemyHit(dmg, ehp, e.combo);
        this.tl.add(0, this.d(recruited ? 0.5 : 0.24), () => {});
    }

    enemyHit(dmg, ehp, combo = 1) {
        if (this.enemy) this.enemy.hit = 1;
        this.stage.daisMat.uniforms.uPulse.value = 0.6;
        if (dmg) {
            const p = this.stage.toScreen(this.enemyHead());
            this.floats.pop(p.x + (Math.random() - 0.5) * 50, p.y, String(dmg), combo > 2 ? 'big' : '');
            this.stage.kick(Math.min(0.6, 0.1 + dmg / 400));
        }
        this.hooks.enemyHp?.(ehp);
    }

    on_fall(e) {
        let longest = 0;
        for (const m of e.moves) {
            const vt = this.tokens.get(m.id);
            if (!vt) continue;
            const p0 = vt.p.clone(), p1 = cellPos(...cellOf(m.i));
            const dist = p0.distanceTo(p1);
            const dur = this.d(0.12 + Math.sqrt(dist) * 0.1);
            longest = Math.max(longest, dur);
            vt.i = m.i;
            this.tl.add(0, dur, (k) => { vt.p.lerpVectors(p0, p1, easeIn(k)); vt.lift = Math.sin(k * Math.PI) * 0.08 * dist; });
        }
        for (const s of e.spawns) {
            const [x, y] = cellOf(s.i);
            const vt = this.tokens.add(s.tok, s.i);
            const p0 = cellPos(x, s.from), p1 = cellPos(x, y);
            vt.p.copy(p0);
            vt.sc = 0;
            vt.lift = 1.2;
            const dur = this.d(0.18 + Math.sqrt(Math.abs(y - s.from)) * 0.1);
            longest = Math.max(longest, dur);
            this.tl.add(0, dur, (k) => { vt.p.lerpVectors(p0, p1, easeIn(k)); vt.lift = 1.2 * (1 - k); vt.sc = Math.min(1, k * 2.5); if (k >= 1) { vt.lift = 0; vt.sc = 1; } });
        }
        this.tl.add(0, longest, () => {});
    }

    on_enemyTurn(e) {
        const en = this.enemy;
        const def = ENEMIES[e.enemy];
        if (e.kind === 'strike') {
            this.tl.add(0, this.d(0.5), (k) => {
                if (en) en.lunge = Math.sin(Math.min(1, k * 1.4) * Math.PI);
                if (k >= 0.4 && !this._struck) {
                    this._struck = true;
                    this.stage.flash(1, 0xff2a1a);
                    this.stage.kick(1);
                    this.sparks.emit(new THREE.Vector3(0, 0.6, HALF), 0xff5a3a, { n: 30, speed: 5, up: 2, life: 0.6 });
                    this.hooks.partyHit?.(e);
                }
                if (k >= 1) { this._struck = false; if (en) en.lunge = 0; }
            });
        } else {
            if (en) en.cast = 1;
            this.stage.daisMat.uniforms.uPulse.value = 1;
            this.glows.ripple(ENEMY_POS, COLORS[def.c].hex, this.d(0.8), 5);
            this.hooks.banner?.(`${def.name} ${ABILITY_TEXT[e.kind] || e.kind}`, 'foe');
            if (e.kind === 'heal') this.hooks.enemyHp?.(e.ehp);
            if (e.kind === 'drain') this.hooks.charge?.();
            this.tl.add(0, this.d(0.55), () => {});
        }
    }

    on_skill(e) {
        const h = HERO[e.hero];
        this.hooks.skill?.(e);
        this.glows.beam(new THREE.Vector3(0, 0, HALF + 0.6), COLORS[h.c].hex, this.d(0.9), 1.6);
        this.stage.flashLight.color.set(COLORS[h.c].hex);
        this.stage.flashLight.intensity = 30;
        this.tl.add(0, this.d(0.45), () => {});
    }

    on_strike(e) {
        const h = HERO[e.hero];
        const from = new THREE.Vector3(0, 1, HALF + 0.6);
        this.bolts.fire(from, this.enemyHead(), COLORS[h.c].hex, 0, () => this.enemyHit(e.dmg, e.ehp, 3), 2.4);
        this.tl.add(0, this.d(0.5), () => {});
    }

    on_heal(e) { this.hooks.partyHeal?.(e); this.sparks.emit(new THREE.Vector3(0, 0.3, HALF + 0.5), 0x7dff9a, { n: 30, speed: 2, up: 3, life: 0.9 }); }
    on_shield(e) { this.hooks.partyShield?.(e); this.glows.ripple(new THREE.Vector3(0, 0, HALF), 0x7ad8ff, this.d(0.7), 5); }
    on_delay(e) {
        const p = this.stage.toScreen(this.enemyHead());
        this.floats.pop(p.x, p.y - 30, `+${e.n} turn${e.n > 1 ? 's' : ''}`, 'info');
        this.hooks.enemyCd?.(e.cd);
    }
    on_recruit(e) { this.hooks.recruit?.(e); }

    on_defeat(e) {
        const en = this.enemy;
        // let the bolts in flight land first
        this.tl.add(0, 0.05, () => {});
        const wait = () => this.bolts.active;
        let started = false;
        this.tl.add(0, this.d(1.0), (k) => {
            if (wait() && k < 1) return;
            if (!started) {
                started = true;
                if (en) this.sparks.emit(this.enemyHead(), COLORS[en.def.c].hex, { n: 80, speed: 5, up: 4, life: 1.2, size: 0.18 });
                this.stage.kick(1.2);
                this.stage.flash(0.6, 0xffffff);
                this.hooks.defeat?.(e);
            }
            if (en) en.dying = Math.min(1, en.dying + 0.04 * this.speed);
            if (k >= 1 && this.enemy === en) this.dropEnemy();
        });
    }

    on_win(e) { this.tl.add(0, this.d(0.3), (k) => { if (k >= 1) this.hooks.result?.('win', e); }); }
    on_loss(e) { this.tl.add(0, this.d(0.3), (k) => { if (k >= 1) this.hooks.result?.('loss', e); }); }

    on_summon(e) {
        this.hooks.summon?.(e);
    }

    // ------------------------------------------------------------------ frame
    frame(dt, time) {
        this.time = time;
        this.stage.resize();
        this.pump();
        this.tl.update(dt);
        this.updateGlows(dt);
        this.tokens.frame(dt, time);
        this.poseEnemy(dt);
        this.sparks.update(dt);
        this.shards.update(dt);
        this.bolts.update(dt * this.speed);
        this.glows.update(dt, time);
        this.sparks.mat.uniforms.uScale.value = this.stage.h * this.stage.renderer.getPixelRatio() * 0.9;
        this.renderPortraits();
        this.stage.render(dt, time);
    }
}

export { OATHS };
