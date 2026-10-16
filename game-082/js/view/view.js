// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) with y down maps to world (x, H − y, 0); the camera looks straight at the field.
// Between sectors the old one scrolls up and the next rises from below, Bubble Bobble style,
// while Pip rides a bubble back to the start.

import * as THREE from 'three';
import { H, PLAYER, TIMING, BUBBLE, ITEMS, POWERS, LETTERS } from '../config.js';
import { Stage } from './stage.js';
import { Backdrop } from './backdrop.js';
import { buildTiles, disposeTiles } from './tiles.js';
import { makePip, makeEnemy, makeWraith, makeBaron, makeItem, tint } from './models.js';
import { Bubbles } from './bubbles.js';
import { Fx } from './fx.js';
import { themeOf } from '../sim/levels.js';

const FACE_R = -0.55, FACE_L = Math.PI + 0.55;
const ITEM_NAMES = Object.fromEntries(ITEMS.map((i) => [i.id, i.name]));

export class View {
    constructor(canvas, quality = 1) {
        this.stage = new Stage(canvas, quality);
        const scene = this.stage.scene;
        this.scene = scene;
        scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x302040, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(-10, 30, 40);
        scene.add(key);
        this.backdrop = new Backdrop(scene);
        this.tiles = null;
        this.next = null;
        this.pip = makePip();
        scene.add(this.pip);
        this.enemies = new Map();
        this.items = new Map();
        this.wraith = makeWraith();
        this.wraith.visible = false;
        scene.add(this.wraith);
        this.baron = null;
        this.bubbles = new Bubbles(scene);
        this.fx = new Fx(scene);
        this.flash = 0;
        this.lastLevel = -1;
    }

    setQuality(q) { this.stage.setQuality(q); }

    /** Make sure the right sector is built (no scrolling: after a load or a continue). */
    ensureLevel(G) {
        if (this.tiles && this.tiles.userData.idx === G.level) return;
        if (this.next && this.next.userData.idx === G.level) {
            if (this.tiles) { this.scene.remove(this.tiles); disposeTiles(this.tiles); }
            this.tiles = this.next;
            this.next = null;
        } else {
            if (this.tiles) { this.scene.remove(this.tiles); disposeTiles(this.tiles); }
            if (this.next) { this.scene.remove(this.next); disposeTiles(this.next); this.next = null; }
            this.tiles = buildTiles(G.level);
            this.scene.add(this.tiles);
            this.backdrop.setTheme(themeOf(G.level), G.level, this.lastLevel < 0);
        }
        this.tiles.position.y = 0;
        this.lastLevel = G.level;
    }

    /** Start fresh on a game that was just made or loaded: no leftovers. */
    reset(G) {
        for (const m of this.enemies.values()) this.scene.remove(m);
        this.enemies.clear();
        for (const m of this.items.values()) this.scene.remove(m);
        this.items.clear();
        this.fx.clearAll();
        this.ensureLevel(G);
        this.backdrop.setTheme(themeOf(G.level), G.level, true);
    }

    onEvents(G, events) {
        const fx = this.fx;
        const Y = (y) => H - y;
        for (const e of events) {
            switch (e.type) {
                case 'level': this.backdrop.setTheme(themeOf(e.idx), e.idx); break;
                case 'warp':
                    if (this.next) { this.scene.remove(this.next); disposeTiles(this.next); }
                    this.next = buildTiles(e.to);
                    this.next.position.y = -H;
                    this.scene.add(this.next);
                    this.warpFrom = { x: G.player.x, y: G.player.y };
                    this.backdrop.setTheme(themeOf(e.to), e.to);
                    break;
                case 'blow': fx.ring(e.x, Y(e.y), 8, 0xbff6ff, 0.4, { speed: 3, life: 0.2, size: 0.25 }); break;
                case 'pop':
                    if (e.kind === 'boss') { fx.burst(e.x, Y(e.y), 120, 0xffffff, { speed: 14, life: 1.2, size: 0.6, rainbow: true }); this.stage.shake = 0.5; }
                    else if (e.trapped) { fx.ring(e.x, Y(e.y), 16, 0xbff6ff, e.r, { speed: 6, life: 0.35 }); fx.burst(e.x, Y(e.y), 14, 0xffffff, { speed: 7, rainbow: true }); }
                    else fx.ring(e.x, Y(e.y), 10, e.kind === 'plain' ? 0x9fe8ff : 0xff9ae8, e.r * 0.9, { speed: 4, life: 0.25 });
                    break;
                case 'fizz': fx.ring(e.x, Y(e.y), 8, 0x6fa8c8, 0.8, { speed: 2, life: 0.3, size: 0.2 }); break;
                case 'trap': fx.burst(e.x, Y(e.y), 10, 0x9ff4ff, { speed: 4, life: 0.4 }); break;
                case 'escape': fx.burst(e.x, Y(e.y), 18, 0xff4060, { speed: 6 }); fx.label('!!', e.x, Y(e.y) + 1, '#ff6070'); break;
                case 'kill': fx.burst(e.x, Y(e.y), 12, 0xffe066, { speed: 6, life: 0.5 }); break;
                case 'chain': fx.label(`×${e.n} CHAIN!`, e.x, Y(e.y) + 1.5, '#7ff4ff', true); this.stage.shake = Math.max(this.stage.shake, 0.12 * e.n); break;
                case 'score': fx.label(String(e.n), e.x, Y(e.y), e.n >= 4000 ? '#ff9ae8' : '#ffe066'); break;
                case 'item': fx.burst(e.x, Y(e.y) + 0.6, 14, 0xffe8a0, { speed: 4, life: 0.5, up: 2 }); break;
                case 'letter': fx.label(LETTERS[e.idx], G.player.x, Y(G.player.y) + 2.2, '#ff8ae8', true); fx.burst(G.player.x, Y(G.player.y) + 1, 20, 0xff6ad8, { speed: 7 }); break;
                case 'extend': fx.burst(16, 13, 160, 0xffffff, { speed: 16, life: 1.4, size: 0.5, rainbow: true }); break;
                case 'life': fx.label('1UP', G.player.x, Y(G.player.y) + 2.6, '#7dff6a', true); break;
                case 'zap': fx.burst(e.x, Y(e.y), 24, 0xfff27a, { speed: 9, life: 0.4 }); this.stage.shake = Math.max(this.stage.shake, 0.15); break;
                case 'nova': fx.burst(e.x, Y(e.y), 40, 0xff8a3a, { speed: 8, up: 3, life: 0.7 }); this.stage.shake = Math.max(this.stage.shake, 0.2); break;
                case 'burn': fx.burst(e.x, Y(e.y) + 0.5, 10, 0xff5020, { speed: 4, up: 2 }); break;
                case 'die': fx.burst(e.x, Y(e.y), 50, 0xffffff, { speed: 10, life: 0.9, rainbow: true }); this.stage.shake = 0.4; this.flash = 0.5; break;
                case 'bounce': fx.ring(e.x, Y(e.y) + 0.9, 8, 0xbff6ff, 0.5, { speed: 3, life: 0.2 }); break;
                case 'land': fx.burst(G.player.x, Y(G.player.y) + 0.05, 4, 0x9aa4c4, { speed: 2, life: 0.25, size: 0.2, g: 0 }); break;
                case 'power': fx.label(POWERS[e.kind].name, e.x, Y(e.y) + 1.5, '#7ff4ff', true); fx.burst(e.x, Y(e.y) + 0.6, 30, 0x7ff4ff, { speed: 8, rainbow: true }); break;
                case 'powerAppear': fx.burst(e.x, Y(e.y) + 0.6, 24, 0xffffff, { speed: 5, rainbow: true }); break;
                case 'bomb': fx.burst(16, 13, 200, 0xffe8a0, { speed: 20, life: 1, size: 0.6 }); this.stage.shake = 0.6; this.flash = 0.8; break;
                case 'quick': fx.label(`QUICK CLEAR +${e.n}`, 16, 15, '#7dff6a', true); break;
                case 'eshot': fx.burst(e.x, Y(e.y), 5, e.kind === 'laser' ? 0x9fffd0 : 0x7dff6a, { speed: 3, life: 0.2 }); break;
                case 'bossThrow': fx.burst(e.x, Y(e.y), 16, 0xb05aff, { speed: 6 }); break;
                case 'bossHit': fx.burst(e.x, Y(e.y), 30, 0xfff27a, { speed: 10, life: 0.5 }); this.stage.shake = Math.max(this.stage.shake, 0.3); break;
                case 'bossTrap': fx.burst(e.x, Y(e.y), 80, 0xc89aff, { speed: 12, life: 1 }); this.stage.shake = 0.5; break;
                case 'heart': fx.burst(e.x, Y(e.y) + 1, 60, 0xff6aa8, { speed: 8, up: 4, life: 1.2 }); break;
                case 'ending': fx.burst(16, 13, 300, 0xffffff, { speed: 18, life: 2, size: 0.6, rainbow: true }); break;
                default: break;
            }
        }
    }

    frame(G, dt, time) {
        this.stage.resize();
        const warping = G.phase === 'warp';
        if (!warping) this.ensureLevel(G);
        const k = warping ? Math.min(1, G.phaseT / TIMING.warp) : 0;
        const ease = k * k * (3 - 2 * k);
        if (warping && this.tiles) this.tiles.position.y = ease * H;
        if (warping && this.next) this.next.position.y = -(1 - ease) * H;
        const scroll = ease * H;

        this.updatePlayer(G, dt, time, warping, ease);
        this.updateEnemies(G, time, scroll);
        this.updateItems(G, time, scroll);
        this.updateWraith(G, time);
        this.updateBoss(G, time);
        // the carrier bubble round Pip while it rides in
        const carry = [];
        if (warping || G.phase === 'intro') {
            const p = this.pip.position;
            carry.push({ id: -1, kind: 'plain', mode: 'float', x: p.x, y: H - p.y - 0.85, r: 1.3, t: 1, enemy: null, trapT: 0 });
        }
        this.bubbles.update(warping ? { bubbles: carry } : { bubbles: [...G.bubbles, ...carry] }, time);
        this.fx.update(warping ? null : G, dt, time);
        this.backdrop.update(dt, time);

        this.stage.shake = Math.max(0, this.stage.shake - dt * 1.5);
        this.stage.sway.set(Math.sin(time * 0.21) * 0.25, Math.sin(time * 0.17) * 0.18);
        this.stage.place(time);
        this.stage.render();
    }

    updatePlayer(G, dt, time, warping, ease) {
        const p = G.player;
        const m = this.pip;
        let x = p.x, y = H - p.y;
        if (warping && this.warpFrom) {
            // ride a bubble from where you were to the start of the next sector
            const sx = this.warpFrom.x, sy = H - this.warpFrom.y + ease * H;
            x = sx + (PLAYER.startX - sx) * ease;
            y = sy + ((H - PLAYER.startY) - sy) * ease + Math.sin(ease * Math.PI) * 3;
        } else if (G.phase === 'intro') {
            y += Math.max(0, 1 - G.phaseT / TIMING.intro) * 0.9;
        }
        m.position.set(x, y, 0);
        m.rotation.y = p.face > 0 ? FACE_R : FACE_L;
        m.rotation.z = 0;
        m.visible = true;
        if (p.state === 'dead') {
            m.rotation.z = p.t * 9;
            m.rotation.y = p.t * 6;
            m.visible = p.t < 1.4 || Math.sin(time * 30) > 0;
        } else if (p.inv > 0 && Math.sin(time * 26) > 0.3) m.visible = false;
        if (p.stun > 0) m.rotation.z = Math.sin(time * 30) * 0.25;
        m.userData.anim(time, { moving: Math.abs(p.vx) > 0.1 && p.state === 'alive', air: !p.ground && !warping, vy: p.vy, blow: p.blow > 0 });
        tint(this.pip, p.stun > 0 ? 'angry' : null, p.stun > 0 ? 0.6 : 0);
    }

    updateEnemies(G, time, scroll) {
        const live = new Set();
        for (const e of G.enemies) {
            live.add(e.id);
            let m = this.enemies.get(e.id);
            if (!m) { m = makeEnemy(e.type); m.userData.tint = null; this.enemies.set(e.id, m); this.scene.add(m); }
            let x = e.x, y = H - e.y + scroll, s = 1;
            m.rotation.set(0, e.face > 0 ? FACE_R : FACE_L, 0);
            if (e.st === 'trap') {
                s = 0.72;
                y += e.h / 2 * (1 - s);
                m.rotation.y = time * 1.5 + e.id;
            } else if (e.st === 'dead') {
                m.rotation.z = e.t * 14;
                m.rotation.x = e.t * 6;
            }
            m.position.set(x, y, 0);
            m.scale.setScalar(s);
            const angry = (e.mad || G.hurry) && e.st === 'live';
            const frozen = G.freezeT > 0 && e.st === 'live';
            const want = frozen ? 'frozen' : angry ? (Math.sin(time * 14) > 0 ? 'angry' : 'angry2') : null;
            if (want !== m.userData.tint) {
                m.userData.tint = want;
                tint(m, want === 'angry2' ? 'angry' : want, want === 'angry2' ? 0.35 : 0.7);
            }
            m.userData.anim(frozen ? 0 : time, { moving: e.st === 'live' && !frozen, air: !e.ground, angry });
        }
        for (const [id, m] of this.enemies) if (!live.has(id)) { this.scene.remove(m); this.enemies.delete(id); }
    }

    updateItems(G, time, scroll) {
        const live = new Set();
        for (const it of G.items) {
            live.add(it.id);
            let m = this.items.get(it.id);
            if (!m) { m = makeItem(it.kind); this.items.set(it.id, m); this.scene.add(m); }
            m.position.set(it.x, H - it.y + scroll, 0.3);
            const fading = it.kind !== 'heart' && it.t > TIMING.itemLife - 2 && G.phase === 'play';
            m.visible = !fading || Math.sin(time * 22) > 0;
            m.userData.anim(time + it.id);
        }
        for (const [id, m] of this.items) if (!live.has(id)) { this.scene.remove(m); this.items.delete(id); }
    }

    updateWraith(G, time) {
        const w = G.wraith;
        this.wraith.visible = !!w;
        if (!w) return;
        this.wraith.position.set(w.x, H - w.y - 0.95 + Math.sin(time * 2.5) * 0.15, 0.6);
        this.wraith.rotation.y = G.player.x >= w.x ? FACE_R : FACE_L;
        this.wraith.userData.anim(time);
    }

    updateBoss(G, time) {
        const B = G.boss;
        if (!B) { if (this.baron) this.baron.visible = false; return; }
        if (!this.baron) { this.baron = makeBaron(); this.scene.add(this.baron); }
        const m = this.baron;
        m.visible = true;
        let s = 1, y = H - B.y;
        m.rotation.set(0, B.face > 0 ? -0.35 : Math.PI + 0.35, 0);
        if (B.st === 'trap') { s = 0.55; y += B.h / 2 * (1 - s); m.rotation.y = time * 0.8; }
        if (B.st === 'dead') { m.rotation.z = B.t * 6; }
        m.scale.setScalar(s);
        m.position.set(B.x, y, -0.4);
        tint(m, B.flash > 0 ? 'hit' : null, 0.8);
        m.userData.anim(time, {});
    }

    /** For the item legend: a display name for a loot kind. */
    static itemName(kind) { return ITEM_NAMES[kind] || ''; }
}

export const BUBBLE_R = BUBBLE.r;
