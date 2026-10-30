// The three.js view: an HD-2D diorama. Pixel sprites stand in a lit 3D castle seen through a tilt-shift lens. It reads
// G every frame and turns sim events into effects; it never changes G.
//
// The camera frames the room the Overlord is working in (or all four, in the overview) inside whatever part of the
// screen the panels leave free: setViewOffset shifts the picture so the room sits in the middle of that space.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { buildCastle, RW, RH, RD, GAP, T, roomX, SLOTS_PER_KIND, LANE, VISIT } from './castle.js';
import { SpriteLib } from './sprites.js';
import { Particles, Rings, Billboard, SHAPE } from './fx.js';
import { SPRITE_SCALE } from './art.js';
import { HOBBIES, HOBBY, MINIONS, LAIRS, DECOR_BY } from '../sim/data.js';
import { masteryLevel } from '../sim/game.js';
import { fmt } from '../fmt.js';

const HOBBY_COL = { cook: [0xff9ec7, 0xffd6e8, 0xfff0a0], sew: [0xb48cff, 0xff8fc2, 0xe8d8ff], deco: [0xffcf6b, 0xb02a5a, 0xfff3d6], party: [0x7fe0d0, 0xff6fa5, 0xffd36b] };
const ease = (a, b, k) => a + (b - a) * k;

export class View {
    constructor(canvas, { quality = 2 } = {}) {
        this.canvas = canvas;
        this.stage = new Stage(canvas, quality);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
        this.stage.setScene(this.scene, this.camera);
        this.sprites = new SpriteLib();
        this.scene.add(new THREE.HemisphereLight(0xd8c8ff, 0x2a2038, 1.3));
        const moon = new THREE.DirectionalLight(0xbfb0ff, 1.1);
        moon.position.set(-6, 14, 12);
        this.scene.add(moon);
        this.moon = moon;
        this.fxLight = new THREE.PointLight(0xb070ff, 0, 10, 1.6);
        this.scene.add(this.fxLight);
        this.particles = new Particles(this.scene);
        this.rings = new Rings(this.scene);
        this.raycaster = new THREE.Raycaster();
        this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
        this.overview = false;
        this.focus = 'cook';
        this.camPos = new THREE.Vector3(0, 6, 22);
        this.camTarget = new THREE.Vector3(0, 2.6, 0);
        this.pointer = { x: 0, y: 0 };
        this.lairIdx = -1;
        this.minions = {};          // id → Billboard[]
        this.visitors = new Map();  // vid → actor
        this.poseT = 0; this.pose = 'idle'; this.squash = 0; this.stationSquash = 0;
        this.cowerT = 0; this.flashWin = 0; this.lightning = 0; this.stormT = 0; this.fadeK = 1; this.relocating = 0;
        this.emitAcc = 0;
        this.floatEl = document.getElementById('floaters');
        this.floatN = 0;
        this.time = 0;
        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        window.addEventListener('pointermove', (e) => { this.pointer.x = e.clientX / innerWidth - 0.5; this.pointer.y = e.clientY / innerHeight - 0.5; });
    }

    setQuality(q) { this.stage.setQuality(q); this.resize(true); }
    setInsets(ins) {
        const same = ['top', 'right', 'bottom', 'left'].every((k) => Math.round(ins[k] || 0) === Math.round(this.insets[k] || 0));
        if (same) return;
        this.insets = { top: ins.top || 0, right: ins.right || 0, bottom: ins.bottom || 0, left: ins.left || 0 };
        this.resize(true);
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!this.stage.resize(w, h) && !force) return;
        this.w = w; this.h = h;
        const { top, right, bottom, left } = this.insets;
        this.freeW = Math.max(120, w - right - left);
        this.freeH = Math.max(120, h - top - bottom);
        this.camera.aspect = w / h;
        // shift the picture so the projection centre is the centre of the free area
        this.camera.setViewOffset(w, h, (right - left) / 2, (bottom - top) / 2, w, h);
        this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------------ the lair
    buildLair(idx) {
        if (this.castle) { this.scene.remove(this.castle.root); this.castle.root.traverse((o) => { o.geometry?.dispose?.(); }); }
        for (const id in this.minions) for (const b of this.minions[id]) b.group.parent?.remove(b.group);
        for (const v of this.visitors.values()) v.bb.group.parent?.remove(v.bb.group);
        this.visitors.clear();
        this.minions = {};
        this.lairIdx = idx;
        this.castle = buildCastle(LAIRS[idx].id);
        this.scene.add(this.castle.root);
        this.scene.background = new THREE.Color(this.castle.pal.clear);
        // a centrepiece in every room, and the Overlord herself
        this.stations = {};
        for (const r of this.castle.rooms) {
            const bb = new Billboard(this.sprites.station(r.id, 0), { emissive: 0.5, scale: 1.25 });
            bb.group.position.copy(r.station);
            bb.tier = 0;
            this.scene.add(bb.group);
            this.stations[r.id] = bb;
        }
        if (!this.over) this.over = new Billboard(this.sprites.overlord('idle', 'cook'), { emissive: 0.55, scale: 1.15 });
        this.scene.add(this.over.group);
        this.overRoom = null;
        this.decorSeen = {};
    }

    roomOf(id) { return this.castle.rooms.find((r) => r.id === id); }

    // ------------------------------------------------------------------ minions and décor follow the sim
    syncMinions(G, initial = false) {
        MINIONS.forEach((m, mi) => {
            const list = (this.minions[m.id] ||= []);
            const want = Math.min(G.owned[m.id], SLOTS_PER_KIND, this.roomOf(m.hobby).slots[m.id].length);
            while (list.length < want) {
                const r = this.roomOf(m.hobby), slot = r.slots[m.id][list.length];
                const bb = new Billboard(this.sprites.minion(m.id), { emissive: 0.4, shadow: slot.mode !== 'wall' && slot.mode !== 'hang' });
                bb.group.position.set(r.x + slot.x, slot.y, slot.z);
                bb.slot = slot; bb.kind = m.id; bb.ph = list.length * 1.7 + mi * 0.9; bb.pop = initial ? 1 : 0;
                if (slot.mode === 'hang') {
                    const thread = new THREE.Mesh(new THREE.BoxGeometry(0.02, RH - slot.y, 0.02), new THREE.MeshBasicMaterial({ color: 0xe8e0ff }));
                    thread.position.y = (RH - slot.y) / 2 + bb.h * 0.6;
                    bb.group.add(thread);
                }
                this.scene.add(bb.group);
                list.push(bb);
                if (!initial) {
                    const p = bb.group.position;
                    this.particles.burst(p.x, p.y + 0.6, p.z, 16, { color: [0xffffff, ...HOBBY_COL[m.hobby]], shape: SHAPE.star, size: 9, glow: 2, speed: 2.5, up: 2.5, life: 0.8 });
                    this.rings.add(p.x, p.y + 0.05, p.z, { color: 0xffffff, size: 1.6, life: 0.5 });
                }
            }
            while (list.length > want) { const bb = list.pop(); bb.group.parent?.remove(bb.group); bb.dispose(); }
        });
        // rooms with no minions are dim and cobwebbed
        for (const r of this.castle.rooms) {
            const n = MINIONS.reduce((s, m) => s + (m.hobby === r.id ? G.owned[m.id] : 0), 0);
            const open = n > 0 || r.id === 'cook';
            if (open && r.open === false && !initial) {
                // the room opens: the cobwebs blow away and the lights come up
                for (const w of r.webs.children) { const p = w.getWorldPosition(new THREE.Vector3()); this.particles.burst(p.x, p.y, p.z + 0.2, 14, { color: [0xe8e0ff, 0xffffff], shape: SHAPE.square, size: 7, speed: 3, up: 1, grav: -3, life: 1.2, glow: 1.2 }); }
                this.particles.burst(r.x, 3, 0, 40, { color: [0xffd36b, 0xffffff, 0xff9ec7], shape: SHAPE.star, size: 10, speed: 5, up: 3, life: 1.4, glow: 2.4 });
            }
            if (initial || r.lightK === undefined) r.lightK = open ? 1 : 0;
            r.open = open;
            r.webs.visible = !open;
        }
    }

    syncDecor(G, initial = false) {
        for (const id in this.castle.decor) {
            const on = !!G.decor[id];
            for (const o of this.castle.decor[id]) {
                if (on && !o.visible) {
                    o.visible = true;
                    o.userData.pop = initial ? 1 : 0;
                    if (!initial) {
                        const r = this.roomOf(DECOR_BY[id].room === 'all' ? G.room : DECOR_BY[id].room);
                        if (r) this.particles.burst(r.x + (o.position.x || 0), 2, (o.position.z || 0), 30, { color: [0xffd36b, 0xffffff, 0xff9ec7], shape: SHAPE.star, glow: 2.4, speed: 4, up: 4, life: 1.2 });
                    }
                }
                if (!on) o.visible = false;
            }
        }
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'craft': this.onCraft(G, e); break;
                case 'cackle': this.onCackle(G); break;
                case 'visitor': this.addVisitor(G, e); break;
                case 'greet': this.onGreet(G, e); break;
                case 'visitorLeft': case 'heroGossip': this.dismiss(e.vid, e.type === 'heroGossip'); break;
                case 'upgrade': this.sparkleOverlord(0xffd36b); break;
                case 'ability': this.onAbility(G, e.id); break;
                case 'room': this.poof(); break;
                case 'relocate': this.relocating = 1; break;
                case 'schemeDone': if (e.heirloom) this.sparkleOverlord(0xff9ec7); break;
                default: break;
            }
        }
    }

    stationTop() {
        const st = this.stations?.[this.focus];
        if (!st) return new THREE.Vector3();
        return st.group.position.clone().add(new THREE.Vector3(0, st.h * 0.75, 0.3));
    }

    onCraft(G, e) {
        this.pose = 'craft'; this.poseT = 0.16; this.squash = 1; this.stationSquash = 1;
        const p = this.stationTop();
        const cols = HOBBY_COL[e.room];
        const n = 3 + Math.round(e.flow / 25);
        this.particles.burst(p.x, p.y, p.z, n, { color: cols, shape: e.room === 'party' ? SHAPE.note : SHAPE.heart, size: 12, speed: 2.4, up: 3.4, life: 0.9, grav: -4, glow: 1.6 });
        if (e.flow > 60) this.particles.burst(p.x, p.y, p.z, 2, { color: 0xffffff, shape: SHAPE.star, size: 8, glow: 3, speed: 3, up: 4, life: 0.6 });
        const at = this.lastPointer && performance.now() - this.lastPointer.t < 250 ? this.lastPointer : this.toScreen(p);
        this.floater('+' + fmt(e.amount), at.x, at.y - 10, e.flow >= 80 ? 'flow' : '');
    }

    onCackle(G) {
        this.pose = 'cackle'; this.poseT = 1.1; this.cowerT = 1;
        const r = this.roomOf(G.room), p = r.overlord;
        this.rings.add(p.x, 0.06, p.z, { color: 0xa070ff, size: 9, life: 0.9 });
        this.rings.add(p.x, 1.6, p.z + 0.2, { color: 0xff3b6a, size: 5, life: 0.6, flat: false });
        this.particles.burst(p.x, 0.6, p.z - 0.4, 16, { color: [0x5a2a8a, 0x2a1440, 0xa070ff], shape: SHAPE.circle, size: 11, speed: 4, up: 0.8, grav: 1.5, life: 1.0, glow: 1 });
        this.stage.flash(0.55, 0.25, 0.9, this.calm ? 0.08 : 0.35);
        if (!this.calm) this.stage.kick(0.6);
        this.flashWin = 1;
        this.fxLight.intensity = 60;
    }

    onAbility(G, id) {
        const r = this.roomOf(G.room);
        if (id === 'taste') this.sparkleOverlord(0xffe36a, 40);
        else if (id === 'storm') { this.stormT = 4; this.lightning = 1; this.stage.flash(0.8, 0.8, 1, this.calm ? 0.1 : 0.6); if (!this.calm) this.stage.kick(1); }
        else if (id === 'soiree') {
            for (let k = 0; k < 4; k++) this.particles.burst(r.x - 4 + k * 2.6, 6.5, 0.5, 30, { color: [0xff6fa5, 0x7fe0d0, 0xffd36b, 0xb48cff, 0xffffff], shape: SHAPE.square, size: 9, speed: 2, up: 0.5, grav: -2.5, drag: 1.5, life: 3, glow: 1.4, wob: 1.2 });
        }
    }

    sparkleOverlord(color, n = 18) {
        const p = this.over.group.position;
        this.particles.burst(p.x, 1.8, p.z, n, { color: [color, 0xffffff], shape: SHAPE.star, size: 10, glow: 2.6, speed: 2.5, up: 3, life: 1.1 });
    }

    poof() {
        if (!this.over) return;
        const p = this.over.group.position;
        this.particles.burst(p.x, 1.2, p.z, 24, { color: [0x5a2a8a, 0xb48cff, 0x2a1440], shape: SHAPE.circle, size: 18, speed: 2, up: 1.5, grav: 1, life: 1, glow: 1 });
        this.overRoom = null;          // placed afresh in the new room next frame
    }

    // ------------------------------------------------------------------ visitors
    addVisitor(G, e) {
        if (this.visitors.has(e.vid)) return;
        const v = G.visitors.find((x) => x.vid === e.vid);
        const side = v?.side || 1;
        const bb = new Billboard(this.sprites.visitor(e.kind), { emissive: 0.6, scale: e.kind === 'kitten' ? 1.3 : 1.1 });
        this.scene.add(bb.group);
        // x is room-local: the visitor waits behind the next wall while the portcullis rises, then walks in
        this.visitors.set(e.vid, { vid: e.vid, kind: e.kind, bb, side, x: side * VISIT.start, state: 'in', t: 0, react: 0, wait: 0.7 });
    }
    onGreet(G, e) {
        const a = this.visitors.get(e.vid);
        if (!a) return;
        const p = a.bb.group.position;
        if (e.kind === 'kitten') this.particles.burst(p.x, 1, p.z, 20, { color: [0xff6fa5, 0xff9ec7], shape: SHAPE.heart, size: 14, glow: 1.8, speed: 2, up: 3, life: 1.4 });
        else if (e.kind === 'critic') this.particles.burst(p.x, 1.8, p.z, 22, { color: [0xffd36b, 0xffffff], shape: SHAPE.star, size: 12, glow: 2.6, speed: 3, up: 3.5, life: 1.2 });
        else if (e.kind === 'bard') this.particles.burst(p.x, 1.8, p.z, 16, { color: [0x7fe0d0, 0xffffff, 0xb48cff], shape: SHAPE.note, size: 14, glow: 1.8, speed: 2, up: 2.5, grav: -1, life: 1.6, wob: 1 });
        else { this.particles.burst(p.x, 2, p.z, 14, { color: [0x9ad8ff, 0xffffff], shape: SHAPE.circle, size: 7, glow: 1.6, speed: 2.5, up: 3, life: 0.8 }); this.rings.add(p.x, 0.06, p.z, { color: 0xff3b6a, size: 3, life: 0.5 }); }
        if (e.amount) { const s = this.toScreen(p.clone().setY(2.4)); this.floater('+' + fmt(e.amount), s.x, s.y, 'big'); }
        a.state = 'out'; a.react = e.kind === 'hero' ? 2.6 : 1.2; a.t = 0;
    }
    dismiss(vid, gossip) {
        const a = this.visitors.get(vid);
        if (!a) return;
        a.state = 'out'; a.react = 0.9; a.t = 0;
        if (gossip) { const p = a.bb.group.position; const s = this.toScreen(p.clone().setY(2.8)); this.floater('“Doilies?!”', s.x, s.y, 'gossip'); }
    }

    // ------------------------------------------------------------------ picking and screen space
    toScreen(v) {
        const p = v.clone().project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
    }
    /** What is under a client point: a visitor, the centrepiece, a room (in the overview), or nothing. */
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(ndc, this.camera);
        for (const a of this.visitors.values()) {
            if (a.state !== 'stay') continue;
            // a generous target: the sprite's box grown by half again
            const p = a.bb.group.position;
            const s = this.toScreen(p.clone().setY(a.bb.h * 0.5));
            const top = this.toScreen(p.clone().setY(a.bb.h));
            const rad = Math.max(34, Math.abs(s.y - top.y) * 1.5);
            if (Math.hypot(clientX - s.x, clientY - s.y) < rad) return { type: 'visitor', vid: a.vid };
        }
        if (this.overview) {
            const hit = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), RD / 2 - 0.5), hit) || this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
                const i = Math.round(hit.x / GAP);
                if (i >= 0 && i < HOBBIES.length && Math.abs(hit.x - roomX(i)) < RW / 2 + 0.6) return { type: 'room', id: HOBBIES[i].id };
            }
            return null;
        }
        return { type: 'craft' };
    }
    /** Screen position of a visitor (for tests and the visitor button). */
    visitorScreen(vid) {
        const a = this.visitors.get(vid);
        return a ? this.toScreen(a.bb.group.position.clone().setY(a.bb.h * 0.5)) : null;
    }

    /** True once every minion and piece of décor has finished popping in. */
    settled() {
        for (const id in this.minions) for (const bb of this.minions[id]) if (bb.pop < 1) return false;
        for (const id in this.castle.decor) for (const o of this.castle.decor[id]) if (o.visible && (o.userData.pop ?? 1) < 1) return false;
        return true;
    }

    /** Every place along the visitors' lane where the biggest visitor would pass through a wall or touch furniture (for the tests). */
    laneReport() {
        const out = [], a = new THREE.Box3(), b = new THREE.Box3();
        this.scene.updateMatrixWorld(true);
        const e = this.sprites.visitor('hero'), w = e.w * SPRITE_SCALE * 1.1, h = e.h * SPRITE_SCALE * 1.1;
        const walls = this.castle.rooms.flatMap((r) => r.walls);
        for (const r of this.castle.rooms) {
            const things = [...walls, ...r.blockers.filter((o) => o.visible)];
            for (const side of [-1, 1]) {
                for (let x = VISIT.stand; x <= VISIT.gone; x += 0.1) {
                    const wx = r.x + side * x;
                    a.min.set(wx - w / 2, 0.05, LANE - 0.05);
                    a.max.set(wx + w / 2, h + 0.15, LANE + 0.05);
                    for (const o of things) {
                        o.traverse((m) => {
                            if (!m.isMesh || !m.visible) return;
                            b.setFromObject(m);
                            if (b.max.y < 0.1 || !a.intersectsBox(b)) return;
                            const c = b.getCenter(new THREE.Vector3());
                            out.push(`the ${r.id} room's ${side < 0 ? 'left' : 'right'} lane at x ${(side * x).toFixed(1)} hits a box at (${(c.x - r.x).toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})`);
                        });
                    }
                }
            }
        }
        return [...new Set(out)];
    }

    /** Every minion sprite that intersects a piece of furniture, décor or a window it isn't meant to touch (for the tests). */
    clipReport() {
        const out = [], a = new THREE.Box3(), b = new THREE.Box3();
        this.scene.updateMatrixWorld(true);
        for (const m of MINIONS) {
            const r = this.roomOf(m.hobby);
            for (const bb of this.minions[m.id] || []) {
                a.setFromObject(bb.mesh);
                a.expandByVector(new THREE.Vector3(-0.03, -0.03, 0.04));
                for (const o of r.blockers) {
                    if (!o.visible) continue;
                    o.traverse((x) => {
                        if (!x.isMesh || !x.visible) return;
                        b.setFromObject(x);
                        if (b.max.y < 0.1 || !a.intersectsBox(b)) return;
                        const c = b.getCenter(new THREE.Vector3());
                        out.push(`${m.id} at (${(bb.group.position.x - r.x).toFixed(1)}, ${bb.group.position.z.toFixed(1)}) inside a box at (${(c.x - r.x).toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}) in the ${r.id} room`);
                    });
                }
            }
        }
        return out;
    }

    floater(text, x, y, cls = '') {
        if (!this.floatEl || this.floatN > 26 || this.floatersOn === false) return;
        const el = document.createElement('div');
        el.className = 'floater ' + cls;
        el.textContent = text;
        el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
        el.style.top = `${y}px`;
        this.floatEl.appendChild(el);
        this.floatN++;
        setTimeout(() => { el.remove(); this.floatN--; }, 1100);
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time) {
        this.time = time;
        this.resize();
        if (this.lairIdx !== G.lair && !(this.relocating > 0.5)) { this.buildLair(G.lair); this.syncMinions(G, true); this.syncDecor(G, true); }
        if (this.relocating > 0) {
            // fade to black, rebuild the new lair, fade back in
            this.relocating += dt;
            this.fadeK = this.relocating < 1.6 ? Math.max(0, 1 - (this.relocating - 1) / 0.6) : Math.min(1, (this.relocating - 1.6) / 0.8);
            if (this.relocating >= 1.6 && this.lairIdx !== G.lair) { this.buildLair(G.lair); this.syncMinions(G, true); this.syncDecor(G, true); }
            if (this.relocating >= 2.4) { this.relocating = 0; this.fadeK = 1; }
        }
        this.syncMinions(G);
        this.syncDecor(G);
        this.focus = G.room;

        const D = G.dread / 100;
        const cam = this.camera;
        // ----- camera
        let tx, ty, width;
        if (this.overview) { tx = roomX(1.5); ty = 2.6; width = GAP * 4 + 1; } else { tx = this.roomOf(this.focus).x; ty = 2.1; width = RW + 3; }   // wide enough to show both side doorways
        const tanV = Math.tan((cam.fov * Math.PI) / 360);
        const distW = (width / 2) / (tanV * (this.freeW / this.h));
        const distH = ((this.overview ? RH + 3 : RH + 0.6) / 2) / (tanV * (this.freeH / this.h));
        const dist = Math.max(distW, distH) * 1.02;
        const shake = this.stage.shake;
        const sx = Math.sin(time * 0.31) * 0.25 + this.pointer.x * 0.8 + (Math.random() - 0.5) * shake * 0.35;
        const sy = Math.sin(time * 0.23) * 0.12 - this.pointer.y * 0.4 + (Math.random() - 0.5) * shake * 0.35;
        const want = new THREE.Vector3(tx + sx, ty + dist * 0.45 + sy, -0.4 + dist * 0.893);
        const k = 1 - Math.exp(-dt * 4);
        this.camPos.lerp(want, k);
        this.camTarget.lerp(new THREE.Vector3(tx + sx * 0.3, ty, -0.4), k);
        cam.position.copy(this.camPos);
        cam.lookAt(this.camTarget);
        const yaw = Math.atan2(cam.position.x - this.camTarget.x, cam.position.z - this.camTarget.z);

        // ----- the Overlord
        const room = this.roomOf(G.room);
        if (this.overRoom !== G.room) {
            this.over.group.position.copy(room.overlord);
            this.overRoom = G.room;
            this.particles.burst(room.overlord.x, 1.2, room.overlord.z, 18, { color: [0x5a2a8a, 0xb48cff], shape: SHAPE.circle, size: 16, speed: 2, up: 1.5, grav: 1, life: 0.9, glow: 1 });
        }
        this.poseT -= dt;
        if (this.poseT <= 0) this.pose = 'idle';
        this.over.setEntry(this.sprites.overlord(this.pose, G.room));
        this.squash = Math.max(0, this.squash - dt * 7);
        const breathe = Math.sin(time * 2.2) * 0.02;
        this.over.inner.scale.set(1 + this.squash * 0.08, 1 - this.squash * 0.07 + breathe, 1);
        this.over.inner.rotation.y = yaw;
        this.over.inner.position.y = this.pose === 'cackle' ? Math.abs(Math.sin(time * 18)) * 0.08 : 0;
        this.fxLight.position.set(room.overlord.x, 2.2, room.overlord.z + 1);
        this.fxLight.intensity = Math.max(0, this.fxLight.intensity - dt * 90);

        // ----- centrepieces grow with mastery
        this.stationSquash = Math.max(0, this.stationSquash - dt * 6);
        for (const h of HOBBIES) {
            const st = this.stations[h.id];
            const tier = Math.min(3, Math.floor(masteryLevel(G.mastery[h.id]) / 4));
            if (tier !== st.tier) {
                st.tier = tier;
                st.setEntry(this.sprites.station(h.id, tier));
                const p = st.group.position;
                this.particles.burst(p.x, 1.5, p.z, 30, { color: [0xffffff, ...HOBBY_COL[h.id]], shape: SHAPE.star, glow: 2.4, speed: 3, up: 3, life: 1.2 });
            }
            const sq = h.id === G.room ? this.stationSquash : 0;
            st.inner.scale.set(1 + sq * 0.06, 1 - sq * 0.08, 1);
            st.inner.rotation.y = yaw;
        }

        // ----- minions at work
        const cower = this.cowerT = Math.max(0, this.cowerT - dt * 1.4);
        for (const id in this.minions) {
            for (const bb of this.minions[id]) {
                const t = time + bb.ph;
                bb.pop = Math.min(1, (bb.pop ?? 1) + dt * 3);
                const pop = bb.pop < 1 ? 1 + Math.sin(bb.pop * Math.PI) * 0.35 : 1;
                let y = 0, sx2 = 1, sy2 = 1, rz = 0;
                switch (id) {
                    case 'imp': y = Math.max(0, Math.sin(t * 6)) * 0.18; break;
                    case 'cauldron': sy2 = 1 + Math.sin(t * 5) * 0.04; break;
                    case 'golem': rz = Math.sin(t * 1.6) * 0.05; break;
                    case 'spider': y = Math.sin(t * 1.3) * 0.25; break;
                    case 'loom': sx2 = 1 + Math.sin(t * 7) * 0.02; break;
                    case 'bat': y = Math.sin(t * 9) * 0.12; bb.group.position.x = this.roomOf('sew').x + bb.slot.x + Math.sin(t * 0.7) * 0.8; break;
                    case 'gargoyle': rz = Math.sin(t * 0.5) > 0.95 ? 0.08 : 0; break;
                    case 'wraith': y = Math.sin(t * 1.4) * 0.3; break;
                    case 'skeleton': rz = Math.sin(t * 3) * 0.08; y = Math.abs(Math.sin(t * 3)) * 0.06; break;
                    case 'mimic': sy2 = 1 + Math.max(0, Math.sin(t * 4)) * 0.08; break;
                    case 'lich': y = 0.15 + Math.sin(t * 1.2) * 0.12; break;
                    default: break;
                }
                bb.inner.position.y = y;
                bb.inner.scale.set(sx2 * pop, sy2 * pop * (1 - cower * 0.18), 1);
                bb.inner.rotation.set(0, bb.slot.mode === 'wall' ? 0 : yaw, rz);
            }
        }
        // hearts drift up from the busy rooms, in proportion to how many minions are at work
        this.emitAcc += dt;
        if (this.emitAcc > 0.12) {
            this.emitAcc = 0;
            for (const h of HOBBIES) {
                const list = MINIONS.filter((m) => m.hobby === h.id).flatMap((m) => this.minions[m.id] || []);
                if (!list.length || Math.random() > Math.min(0.9, 0.12 + list.length * 0.04)) continue;
                const bb = list[(Math.random() * list.length) | 0], p = bb.group.position;
                this.particles.add({ x: p.x, y: p.y + bb.h * 0.9, z: p.z + 0.1, vx: (Math.random() - 0.5) * 0.4, vy: 1.1, life: 1.4, size: 9, color: HOBBY_COL[h.id][0], glow: 1.5, shape: h.id === 'party' ? SHAPE.note : SHAPE.heart, grav: 0, drag: 0.5, wob: 0.4 });
            }
        }

        // ----- décor that moves
        for (const id in this.castle.decor) for (const o of this.castle.decor[id]) {
            if (!o.visible) continue;
            if (o.userData.spin) o.rotation.y += dt * o.userData.spin;
            if (o.userData.wheel) o.userData.wheel.rotation.z -= dt * 1.4;
            o.userData.pop = Math.min(1, (o.userData.pop ?? 1) + dt * 2.5);
            const s = o.userData.pop < 1 ? 1 + Math.sin(o.userData.pop * Math.PI) * 0.25 : 1;
            if (!o.userData.spin) o.scale.setScalar(s);
        }

        // ----- visitors come through a side door, wait with a ‘!’, and leave the way they came
        for (const [vid, a] of this.visitors) {
            a.t += dt;
            let walking = false;
            if (a.state === 'in') {
                a.wait -= dt;
                if (a.wait <= 0) {
                    const to = a.side * VISIT.stand, d = to - a.x;
                    a.x += Math.sign(d) * Math.min(Math.abs(d), dt * 3.2);
                    walking = true;
                    if (Math.abs(to - a.x) < 1e-3) a.state = 'stay';
                }
            } else if (a.state === 'out') {
                a.react -= dt;
                if (a.react <= 0) { a.x += a.side * dt * (a.kind === 'hero' ? 7 : 3.2); walking = true; }
                if (Math.abs(a.x) > VISIT.gone) { a.bb.group.parent?.remove(a.bb.group); a.bb.dispose(); this.visitors.delete(vid); continue; }
            }
            a.bb.group.position.set(room.x + a.x, 0, LANE);
            a.bb.inner.position.y = walking ? Math.abs(Math.sin(a.t * 10)) * 0.12 : (a.state === 'stay' ? Math.abs(Math.sin(a.t * 3)) * 0.05 : 0);
            a.bb.inner.rotation.y = yaw;
            a.bb.inner.scale.x = (a.state === 'out' && a.react <= 0 ? a.side : -a.side) * Math.abs(a.bb.inner.scale.x || 1);
            if (a.state === 'stay' && Math.random() < dt * 3) {
                const p = a.bb.group.position;
                this.particles.add({ x: p.x, y: a.bb.h + 0.3, z: p.z, vy: 0.6, life: 0.8, size: 12, color: a.kind === 'hero' ? 0xff3b5c : 0xffe36a, glow: 2.2, shape: SHAPE.star, grav: 0 });
            }
        }
        // portcullises rise for anyone coming in or going out through them, and drop behind them
        for (const r of this.castle.rooms) for (const d of r.doors) {
            const dx = r.x + d.x;
            let want = 0;
            for (const a of this.visitors.values()) {
                if (a.state === 'stay') continue;
                const doorX = room.x + a.side * (RW / 2 + T / 2);
                if (Math.abs(dx - doorX) < 1.2) want = 1;
            }
            d.open += Math.sign(want - d.open) * Math.min(Math.abs(want - d.open), dt * 2.4);
            d.grate.position.y = d.open * (2.75);
        }

        // ----- lights, flames, windows, sky
        for (const r of this.castle.rooms) {
            const flick = 0.85 + Math.sin(time * 9 + r.index) * 0.06 + Math.sin(time * 23 + r.index * 3) * 0.05;
            r.lightK += ((r.open ? 1 : 0) - r.lightK) * Math.min(1, dt * 1.5);
            const base = r.baseLight * (0.18 + 0.82 * r.lightK);
            r.light.intensity = base * flick * (1 - D * 0.25);
            if (r.id === 'party' && G.decor.mirrorball) r.light.color.setHSL((time * 0.1) % 1, 0.5, 0.65);
            else r.light.color.set(this.castle.pal.lamp);
        }
        for (const f of this.castle.flames) { f.scale.x = 1 + Math.sin(time * 14 + f.id) * 0.12; }
        this.flashWin = Math.max(0, this.flashWin - dt * 3);
        if (this.stormT > 0) {
            this.stormT -= dt;
            // at most about one strike a second, never two flashes within half a second
            this.sinceStrike = (this.sinceStrike || 0) + dt;
            if (this.sinceStrike > 0.6 && Math.random() < dt * (this.calm ? 0.4 : 1.4)) { this.sinceStrike = 0; this.lightning = this.calm ? 0.4 : 1; if (!this.calm) this.stage.flash(0.8, 0.8, 1, 0.25); }
        }
        if (G.decor.spire && D > 0.6 && Math.random() < dt * 0.08) this.lightning = 1;
        this.lightning = Math.max(0, this.lightning - dt * 4);
        const wu = this.castle.windowUniforms;
        wu.uDread.value = ease(wu.uDread.value, D, Math.min(1, dt * 2));
        wu.uTime.value = time;
        wu.uFlash.value = Math.max(this.flashWin * 0.8, this.lightning);
        this.moon.intensity = 0.6 + (1 - D) * 1.1 + this.lightning * 3;
        this.moon.color.setRGB(ease(1, 0.75, D), ease(0.95, 0.7, D), 1);

        // ----- frenzy sparkle
        const frenzy = G.buffs.some((b) => b.kind === 'prod');
        if (frenzy && Math.random() < dt * 14) {
            this.particles.add({ x: room.x + (Math.random() - 0.5) * RW, y: Math.random() * RH, z: -2 + Math.random() * 5, vy: 0.4, life: 1.4, size: 8, color: 0xffe36a, glow: 2.6, shape: SHAPE.star, grav: 0 });
        }

        this.particles.update(dt, this.h * this.stage.pr / (2 * tanV) / 30);
        this.rings.update(dt);
        // focus the tilt-shift band on the room's middle, in the free area
        const focus = 1 - (this.insets.top + this.freeH * 0.55) / this.h;
        this.stage.render(dt, time, { dread: wu.uDread.value, frenzy: frenzy ? 1 : 0, focus, range: this.overview ? 0.3 : 0.17, blur: this.overview ? 2 : 3, fade: this.fadeK, bloom: 0.5 + this.lightning * 0.4 });
    }
}

export { HOBBY };
