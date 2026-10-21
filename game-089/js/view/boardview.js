// The board scene: the island, the three tokens, roaming monsters, the dice, and a camera that
// follows whoever is moving. play(e) turns one sim event into an animation and returns how long
// to wait before the next one; the View runs the queue.

import * as THREE from 'three';
import { Island, tileTop, tileXZ, outward, along, HALF, TILE_TOP } from './island.js';
import { buildToken } from './chars.js';
import { buildMonster, animateMonster } from './monsters.js';
import { animate, setPose } from './anim.js';
import { DiceTray } from './dice.js';
import { FX } from './fx.js';
import { MONSTERS, RIVALS } from '../sim/data.js';
import { SPACES, DEEDS } from '../sim/board.js';

const PI = Math.PI;
export const COLORS = { you: '#4a8aff', baron: '#ffc83a', mira: '#b06aff' };

const yawOf = (dx, dz) => Math.atan2(dx, dz);
function lerpAngle(a, b, k) {
    let d = b - a;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    return a + d * k;
}

export class BoardView {
    constructor(overlay) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
        this.island = new Island(this.scene);
        this.fx = new FX(this.scene, overlay);
        this.dice = new DiceTray(this.scene);
        this.tokens = {};
        this.roamers = new Map();
        this.cam = { target: new THREE.Vector3(HALF - 6, 2, HALF - 6), yaw: 0, pitch: 0.82, dist: 26, tTarget: new THREE.Vector3(0, 2, 0), tYaw: 0, tPitch: 0.82, tDist: 26 };
        this.userYaw = 0;          // the player's own orbit offset (drag)
        this.userZoom = 1;
        this.mode = 'follow';      // follow | overview | free
        this.focus = 'you';
        this.t = 0;
        this.smokeT = 0;
        this.hover = -1;
        this.raycaster = new THREE.Raycaster();
    }

    /** Build tokens and match everything to the game (used on load). */
    sync(G) {
        const ids = ['you', ...G.rivals.map((r) => r.id)];
        for (const id of ids) {
            if (!this.tokens[id] || (id === 'you' && this.tokens.you.cls !== G.cls)) {
                if (this.tokens[id]) this.scene.remove(this.tokens[id].group);
                const t = buildToken(id === 'you' ? 'hero' : id, G.cls, COLORS[id]);
                t.cls = G.cls;
                t.id = id;
                this.scene.add(t.group);
                this.tokens[id] = t;
                setPose(t.rig, 'idle');
            }
            const pos = id === 'you' ? G.pos : G.rivals.find((r) => r.id === id).pos;
            this.tokens[id].pos = pos;
            this.placeToken(id, pos, true);
        }
        for (const s of DEEDS) {
            const d = G.deeds[s.deed];
            this.island.setDeed(s.deed, d.owner ? COLORS[d.owner] : null, d.level);
        }
        for (const [i, r] of this.roamers) { this.scene.remove(r.root); }
        this.roamers.clear();
        for (const r of G.roamers) this.addRoamer(r.i, r.id, false);
        this.unrest(G);
        this.focusOn(G.pos, true);
    }

    unrest(G) {
        const k = G.dragon.tries > 0 ? 1 : Math.min(1, (G.lap - 1) / Math.max(1, G.laps));
        this.island.setUnrest(k);
    }

    /** Where a token stands on a tile: you in front, rivals either side. */
    slot(id, i) {
        const p = tileTop(i);
        const [ox, oz] = outward(i), [ax, az] = along(i);
        const k = { you: 0, baron: -1, mira: 1 }[id] ?? 0;
        const corner = i % 10 === 0;
        p.x += ax * k * (corner ? 1.2 : 1.05) + ox * (k === 0 ? 0.55 : 0.1);
        p.z += az * k * (corner ? 1.2 : 1.05) + oz * (k === 0 ? 0.55 : 0.1);
        if (this.roamers.has(i)) { p.x += ox * 0.5; p.z += oz * 0.5; }
        return p;
    }

    placeToken(id, i, face = true) {
        const t = this.tokens[id];
        if (!t) return;
        t.group.position.copy(this.slot(id, i));
        if (face) { const [ox, oz] = outward(i); t.group.rotation.y = yawOf(-ox, -oz); }
    }

    addRoamer(i, id, anim = true) {
        if (this.roamers.has(i)) return;
        const rig = buildMonster(MONSTERS[id].model);
        const p = tileTop(i);
        const [ox, oz] = outward(i);
        p.x -= ox * 0.7; p.z -= oz * 0.7;
        rig.root.position.copy(p);
        rig.root.rotation.y = yawOf(-ox, -oz);
        const s = 0.75 / Math.max(0.8, rig.height / 1.4);
        rig.root.scale.multiplyScalar(s);
        rig.baseScale = rig.root.scale.x;
        // a red warning ring under it
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#ff3a3a', transparent: true, opacity: 0.7, depthWrite: false }));
        ring.rotation.x = -PI / 2;
        ring.position.copy(p).add(new THREE.Vector3(0, 0.03, 0));
        this.scene.add(ring);
        rig.ring = ring;
        this.scene.add(rig.root);
        this.roamers.set(i, rig);
        rig.spawnT = anim ? 0 : 1;
        if (anim) this.fx.puffs(p.clone().add(new THREE.Vector3(0, 0.4, 0)), '#e8e0ff', 10, { size: 0.8 });
        for (const id2 of Object.keys(this.tokens)) if (this.tokens[id2].pos === i) this.placeToken(id2, i);
    }

    removeRoamer(i, by) {
        const rig = this.roamers.get(i);
        if (!rig) return;
        this.roamers.delete(i);
        this.fx.puffs(rig.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), '#ffffff', 14, { size: 0.9 });
        this.fx.sparks(rig.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), by ? COLORS[by] : '#ffd27a', 16, 3);
        this.scene.remove(rig.root);
        this.scene.remove(rig.ring);
    }

    focusOn(i, snap = false, dist = 27) {
        const p = tileTop(i);
        const [ox, oz] = outward(i);
        // stand on the volcano side and look out over the tile, its landmark and the sea
        this.cam.tTarget.set(p.x + ox * 2.2, 1.4, p.z + oz * 2.2);
        this.cam.tYaw = yawOf(-ox, -oz) + (i % 10 === 0 ? 0 : -0.16);
        this.cam.tDist = dist;
        this.cam.tPitch = 0.7;
        if (snap) { this.cam.target.copy(this.cam.tTarget); this.cam.yaw = this.cam.tYaw; this.cam.dist = this.cam.tDist; this.cam.pitch = this.cam.tPitch; }
    }

    overview(on) {
        this.mode = on ? 'overview' : 'follow';
        if (on) { this.cam.tTarget.set(0, 2, 0); this.cam.tDist = 82; this.cam.tPitch = 0.95; }
    }

    // ------------------------------------------------------------------ events
    /** Play one event; returns seconds to wait (0 = run the next one now). */
    play(e, G, speed = 1) {
        const tok = this.tokens[e.who === 'you' || !e.who ? 'you' : e.who];
        switch (e.type) {
            case 'dice': {
                const t = this.tokens[e.who];
                const at = this.slot(e.who, t.pos);
                const [ax, az] = along(t.pos);
                at.x += ax * 2.2; at.z += az * 2.2;
                this.dice.throw(e.dice, at, this.cam.yaw, (e.who === 'you' ? 1 : 1.8) * speed);
                this.lastDice = e;
                this.dice.onLand = () => {
                    this.fx.text(at.clone().add(new THREE.Vector3(0, 1.6, 0)), String(e.total) + (e.doubles ? ' · Doubles!' : ''), e.doubles ? 'dice dbl' : 'dice', this.camera, { life: 1.2 });
                    if (e.doubles) this.fx.sparks(at.clone().add(new THREE.Vector3(0, 1, 0)), '#ffd84a', 26, 5);
                };
                if (e.who !== 'you') this.focusRival(e.who);
                return (e.who === 'you' ? 1.45 : 0.75) / speed;
            }
            case 'step': {
                const t = this.tokens[e.who];
                if (!t) return 0;
                const from = this.slot(e.who, e.from), to = this.slot(e.who, e.to);
                const dur = (e.who === 'you' ? 0.26 : 0.15) / speed;
                t.hop = { from, to, t: 0, dur };
                t.pos = e.to;
                const [ax, az] = [to.x - from.x, to.z - from.z];
                t.group.rotation.y = yawOf(ax, az);
                setPose(t.rig, 'hop', { dur });
                if (e.who === 'you' && this.mode === 'follow') this.focusOn(e.to);
                this.dice.hide();
                return dur;
            }
            case 'land': {
                const t = this.tokens[e.who];
                if (t) { this.placeToken(e.who, e.i); setPose(t.rig, e.who === 'you' ? 'wave' : 'idle'); t.waveT = 1.2; }
                if (e.who === 'you') this.pulse = { i: e.i, t: 0 };
                this.fx.ring(tileTop(e.i).add(new THREE.Vector3(0, 0.1, 0)), e.who === 'you' ? '#fff2a0' : COLORS[e.who], 2.2, 0.5);
                return (e.who === 'you' ? 0.35 : 0.2) / speed;
            }
            case 'warp': {
                const id = e.who;
                const t = this.tokens[id];
                if (!t) return 0;
                this.fx.sparks(t.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#d8b0ff', 24, 3);
                this.fx.ring(t.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), '#d8b0ff', 2.5, 0.6);
                t.pos = e.to;
                this.placeToken(id, e.to);
                this.fx.sparks(t.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#d8b0ff', 24, 3);
                if (id === 'you') this.focusOn(e.to, false);
                return 0.6 / speed;
            }
            case 'lap': {
                const p = tileTop(0).add(new THREE.Vector3(0, 1, 0));
                this.fx.confetti(p, 70);
                this.fx.text(p.clone().add(new THREE.Vector3(0, 1.5, 0)), e.lap > e.of ? 'The dragon wakes!' : `Lap ${e.lap} of ${e.of}`, 'lap', this.camera, { life: 1.8, rise: 1.6 });
                return 0.5 / speed;
            }
            case 'gold': {
                if (!e.amt) return 0;
                const p = this.tokens.you.group.position.clone().add(new THREE.Vector3(0, 2.0, 0));
                this.fx.text(p, `+${e.amt}g`, 'gold', this.camera, { life: 1.3, dx: (this.goldN = ((this.goldN || 0) + 1) % 3) * 22 - 22 });
                this.fx.sparks(p, '#ffd84a', 10, 2.5, { size: 0.25 });
                return 0.12 / speed;
            }
            case 'toll': {
                const from = this.tokens[e.from], to = this.tokens[e.to];
                if (from && to && e.amt > 0) {
                    const a = from.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), b = to.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                    for (let k = 0; k < 5; k++) setTimeout(() => this.fx.shoot(a, b, '#ffd84a', 0.6, null, 'orb', 0.16), k * 70);
                    this.fx.text(a.clone().add(new THREE.Vector3(0, 0.8, 0)), `−${e.amt}g toll`, 'toll', this.camera, { life: 1.4 });
                }
                return (e.from === 'you' || e.to === 'you' ? 0.8 : 0.3) / speed;
            }
            case 'buy': case 'upgrade': {
                const d = G.deeds[e.deed];
                this.island.setDeed(e.deed, COLORS[e.who], e.type === 'buy' ? 0 : e.level);
                const s = DEEDS.find((x) => x.deed === e.deed);
                const [x, z] = tileXZ(s.i), [ox, oz] = outward(s.i);
                const p = new THREE.Vector3(x + ox * 3.5, TILE_TOP + 1.5, z + oz * 3.5);
                this.fx.sparks(p, COLORS[e.who], 26, 4);
                this.fx.ring(p.clone().setY(TILE_TOP), COLORS[e.who], 3, 0.6);
                void d;
                return (e.who === 'you' ? 0.7 : 0.35) / speed;
            }
            case 'roamer': this.addRoamer(e.i, e.id); return 0.15 / speed;
            case 'roamerGone': this.removeRoamer(e.i, e.by); return 0.3 / speed;
            case 'roamerFight': {
                const rig = this.roamers.get(e.i);
                if (rig) { rig.angry = 1; this.fx.text(rig.root.position.clone().add(new THREE.Vector3(0, 2, 0)), '!', 'alert', this.camera, { life: 0.9 }); }
                return 0.6 / speed;
            }
            case 'rivalTurn': this.focusRival(e.who); return 0.1 / speed;
            case 'rivalFight': {
                const t = this.tokens[e.who];
                if (t) {
                    const p = t.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
                    this.fx.sparks(p, e.win ? '#ffd84a' : '#8a8aa0', 12, 3);
                    this.fx.text(p, e.win ? (e.amt ? `+${e.amt}g` : 'Victory') : 'Ouch!', e.win ? 'rgold' : 'rbad', this.camera, { life: 1.0 });
                    if (e.roamer != null) this.removeRoamer(e.roamer, e.who);
                }
                return 0.35 / speed;
            }
            case 'rivalGold': {
                const t = this.tokens[e.who];
                if (t && e.amt) this.fx.text(t.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), (e.amt > 0 ? '+' : '') + e.amt + 'g', e.amt > 0 ? 'rgold' : 'rbad', this.camera, { life: 1.0 });
                return 0.2 / speed;
            }
            case 'turn': if (this.mode !== 'overview') this.focusOn(G.pos); return 0.3 / speed;
            case 'heal': {
                const p = this.tokens.you.group.position.clone();
                this.fx.motes(p, '#9affc0', 26, 2.2);
                return 0.3 / speed;
            }
            case 'blessing': {
                const p = this.tokens.you.group.position.clone();
                this.fx.beam(p, '#fff2b0', 8, 0.9, 0.7);
                this.fx.motes(p, '#ffe8a0', 30, 3);
                return 0.6 / speed;
            }
            case 'fountain': {
                const p = this.island.fountainWorld?.clone() ?? tileTop(20);
                for (let k = 0; k < 4; k++) this.fx.sparks(p, '#ffd84a', 16, 5, { up: 4, g: 9, life: 1.1 });
                return 0.5 / speed;
            }
            case 'dragonWakes': {
                this.island.setUnrest(1);
                const top = new THREE.Vector3(0, this.island.volcanoTop + 3, 0);
                this.cam.tTarget.copy(top); this.cam.tDist = 30; this.cam.tPitch = 0.35;
                for (let k = 0; k < 6; k++) this.fx.puffs(top, '#5a4a4a', 10, { up: 4, size: 2, size1: 5, life: 2.5, spread: 2 });
                this.fx.sparks(top, '#ff8a3a', 60, 7, { up: 5, life: 1.5 });
                this.shake = 1.4;
                return 2.4 / speed;
            }
            case 'mimic': {
                const p = this.tokens.you.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                this.fx.text(p, 'It\'s a Mimic!', 'alert', this.camera, { life: 1.2 });
                return 0.6 / speed;
            }
            case 'treasure': {
                const p = this.tokens.you.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                this.fx.sparks(p, '#ffd84a', 30, 4, { up: 3 });
                return 0.3 / speed;
            }
        }
        void tok;
        return 0;
    }

    focusRival(id) {
        const t = this.tokens[id];
        if (!t || this.mode === 'overview') return;
        const p = t.group.position;
        const [ox, oz] = outward(t.pos);
        this.cam.tTarget.set(p.x + ox * 2, 1.4, p.z + oz * 2);
        this.cam.tYaw = yawOf(-ox, -oz) - 0.1;
        this.cam.tDist = 26;
        this.cam.tPitch = 0.7;
    }

    // ------------------------------------------------------------------ input
    orbit(dx, dy) {
        this.userYaw -= dx * 0.006;
        this.cam.tPitch = Math.max(0.3, Math.min(1.35, this.cam.tPitch + dy * 0.004));
        this.cam.pitch = this.cam.tPitch;
    }
    zoom(f) { this.userZoom = Math.max(0.45, Math.min(2.2, this.userZoom * f)); }

    /** The space under a screen point, or −1. */
    pick(nx, ny) {
        this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
        const meshes = this.island.tiles.map((t) => t.mesh);
        const hit = this.raycaster.intersectObjects(meshes, false)[0];
        if (!hit) return -1;
        return this.island.tiles.findIndex((t) => t.mesh === hit.object);
    }

    /** Screen position (CSS px) of a world point. */
    toScreen(p, w, h) {
        const v = p.clone().project(this.camera);
        return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 };
    }

    // ------------------------------------------------------------------ frame
    update(dt, t, w, h, G) {
        this.t = t;
        this.island.update(dt, t);
        this.dice.update(dt);
        for (const [id, tk] of Object.entries(this.tokens)) {
            if (tk.hop) {
                tk.hop.t += dt;
                const u = Math.min(1, tk.hop.t / tk.hop.dur);
                tk.group.position.lerpVectors(tk.hop.from, tk.hop.to, u);
                tk.group.position.y += Math.sin(u * PI) * 0.7;
                if (u >= 1) { tk.hop = null; setPose(tk.rig, 'idle'); }
            }
            if (tk.waveT > 0) { tk.waveT -= dt; if (tk.waveT <= 0) setPose(tk.rig, 'idle'); }
            animate(tk.rig, dt, t);
            void id;
        }
        for (const [, rig] of this.roamers) {
            animateMonster(rig, t, dt);
            if (rig.spawnT < 1) { rig.spawnT = Math.min(1, rig.spawnT + dt * 3); rig.root.scale.setScalar(rig.baseScale * (rig.spawnT < 1 ? Math.sin(rig.spawnT * PI * 0.75) * 1.25 : 1)); }
            rig.ring.material.opacity = 0.45 + Math.sin(t * 4) * 0.25;
            if (rig.angry > 0) { rig.angry -= dt; rig.root.scale.setScalar(rig.baseScale * (1 + Math.sin(rig.angry * 20) * 0.08)); }
        }
        // the active tile pulses
        if (this.pulse) {
            this.pulse.t += dt;
            const k = Math.max(0, 1 - this.pulse.t / 1.4);
            this.island.highlight(this.pulse.i, k * 0.9);
            if (k <= 0) this.pulse = null;
        }
        // smoke from the volcano, steam from the hot spring
        this.smokeT -= dt;
        if (this.smokeT <= 0) {
            this.smokeT = 0.25;
            for (const s of this.island.smokeSources) this.fx.puffs(s, this.island.dragonMode === 'roar' ? '#4a3a3a' : '#9a8a88', 1, { up: 2.2, size: 1.5, size1: 4.5, life: 4, spread: 1.2, out: 0.4, alpha: 0.55 });
            for (const s of this.island.steamSources) this.fx.puffs(s, '#ffffff', 1, { up: 0.8, size: 0.4, size1: 1.2, life: 1.8, spread: 0.3, out: 0.1, alpha: 0.6 });
            if (Math.random() < 0.3) this.fx.sparks(new THREE.Vector3((Math.random() - 0.5) * 3, this.island.volcanoTop + 0.3, (Math.random() - 0.5) * 3), '#ffb03a', 3, 2, { up: 4, life: 1.0, size: 0.25 });
        }
        // camera
        const c = this.cam;
        const k = 1 - Math.exp(-3.2 * dt);
        c.target.lerp(c.tTarget, k);
        c.yaw = lerpAngle(c.yaw, c.tYaw, k);
        c.pitch += (c.tPitch - c.pitch) * k;
        c.dist += (c.tDist * this.userZoom - c.dist) * k;
        // portrait screens need more distance to fit the same width
        const aspect = w / Math.max(1, h);
        const fit = aspect < 1 ? 1 + (1 - aspect) * 1.1 : 1;
        const yaw = c.yaw + this.userYaw;
        const d = c.dist * fit;
        let shakeX = 0, shakeY = 0;
        if (this.shake > 0) { this.shake -= dt; shakeX = (Math.random() - 0.5) * this.shake * 0.6; shakeY = (Math.random() - 0.5) * this.shake * 0.6; }
        this.camera.position.set(c.target.x + Math.sin(yaw) * Math.cos(c.pitch) * d + shakeX, c.target.y + Math.sin(c.pitch) * d + shakeY, c.target.z + Math.cos(yaw) * Math.cos(c.pitch) * d);
        this.camera.lookAt(c.target);
        this.fx.setScale(h);
        this.fx.update(dt, this.camera, w, h);
        void G;
    }
}

export { RIVALS, SPACES };
