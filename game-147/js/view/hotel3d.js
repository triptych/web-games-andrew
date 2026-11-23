// The inn as a sunlit dollhouse cutaway, seen from the front at a three-quarter angle: the lobby and kitchen on the
// ground floor, the courtyard garden beside them, four guest rooms above, the Sunroom Suite on top. Furniture,
// characters, guests, meals and dust bunnies are Meshy models; walls, floors and roof are built here.
// Reads G every frame (sync) and answers events; never writes G.

import * as THREE from 'three';
import { Actor, prop, RAMP } from './assets.js';
import { FX } from './fx.js';
import { HEROES, GUESTS, ITEMS } from '../sim/data.js';
import { HOTEL, DAY_LEN } from '../config.js';

const FLOOR_H = 2.9;
// rooms: x0..x1 along the front, depth z -2.4..2.4, floor level
export const LAYOUT = {
    lobby: { x0: -7, x1: -1, lv: 0, name: 'Lobby' },
    kitchen: { x0: -1, x1: 4, lv: 0, name: 'Kitchen' },
    garden: { x0: 4.4, x1: 9.4, lv: 0, name: 'Courtyard', outdoor: true },
    r1: { x0: -7, x1: -3.5, lv: 1 }, r2: { x0: -3.5, x1: 0, lv: 1 }, r3: { x0: 0, x1: 3.5, lv: 1 }, r4: { x0: 3.5, x1: 7, lv: 1 },
    r5: { x0: -3.5, x1: 3.5, lv: 2 },
};
const Z0 = -2.4, Z1 = 2.4;
const STAIR_X = -7.9;
const DOOR = new THREE.Vector3(-1.6, 0, 2.2);
const stairZ = (lv) => 1.8 - lv * 6 * 0.33;          // where the outside stair meets each floor

const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
const M = {
    floor: mat(0xd9a66b), floor2: mat(0xc98f5a), plaster: mat(0xfff3dc), timber: mat(0x9b6a3f), roof: mat(0x5f86c4),
    grass: mat(0x8fd16a), dirt: mat(0xb98a5e), stone: mat(0xd8d2c4), plank: mat(0xa77b4f), glass: new THREE.MeshToonMaterial({ color: 0xbfe7ff, transparent: true, opacity: 0.35, gradientMap: RAMP }),
    kitchenWall: mat(0xffe3c7), roomWall: [mat(0xfff0f4), mat(0xeef6ff), mat(0xf2ffe9), mat(0xfff7e0), mat(0xfff9ec)],
    lamp: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
};
const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };

export const roomCenter = (id) => {
    const R = LAYOUT[id];
    return new THREE.Vector3((R.x0 + R.x1) / 2, R.lv * FLOOR_H, 0.6);
};

export class Hotel3D {
    constructor(stage) {
        this.stage = stage;
        this.scene = stage.makeScene('hotel');
        this.cam = stage.makeIso('hotel', { at: [0.8, 3.2, 0], dir: [0.42, 0.5, 1], span: 19, tall: 0.44 });
        this.fx = new FX(this.scene);
        this.actors = {};          // key → { actor, path: [Vector3], speed, home }
        this.bunnies = {};         // roomId → [Actor]
        this.hits = [];            // invisible click boxes: { mesh, kind, id }
        this.meals = [];
        this.decor = {};
        this.boards = {};
        this.lamps = [];
        this.build();
    }

    build() {
        const s = this.scene;
        // the hill and the courtyard
        const ground = box(26, 0.6, 10, M.grass); ground.position.set(0.5, -0.32, 0.6); s.add(ground);
        const path = box(1.8, 0.62, 3, M.stone); path.position.set(-2.6, -0.3, 4.2); s.add(path);
        for (const [id, R] of Object.entries(LAYOUT)) {
            const w = R.x1 - R.x0, y = R.lv * FLOOR_H, cx = (R.x0 + R.x1) / 2;
            if (R.outdoor) {
                const soil = box(w, 0.12, 4.8, M.dirt); soil.position.set(cx, 0.02, 0); soil.receiveShadow = true; s.add(soil);
                for (let i = 0; i < 9; i++) { const post = box(0.12, 0.7, 0.12, M.plank); post.position.set(R.x1 - 0.06, 0.35, Z0 + i * 0.6); s.add(post); }
                const rail = box(0.08, 0.08, 4.8, M.plank); rail.position.set(R.x1 - 0.06, 0.6, 0); s.add(rail);
            } else {
                const fl = box(w, 0.2, Z1 - Z0, R.lv ? M.floor2 : M.floor); fl.position.set(cx, y - 0.1, 0); s.add(fl);
                const wallM = id === 'kitchen' ? M.kitchenWall : id === 'lobby' ? M.plaster : M.roomWall[(+id.slice(1) - 1) % 5];
                const back = box(w, FLOOR_H - 0.2, 0.2, wallM); back.position.set(cx, y + (FLOOR_H - 0.2) / 2, Z0 - 0.1); s.add(back);
                // timber frame on the back wall
                for (const xx of [R.x0 + 0.08, R.x1 - 0.08]) { const t = box(0.16, FLOOR_H - 0.2, 0.06, M.timber); t.position.set(xx, y + (FLOOR_H - 0.2) / 2, Z0 + 0.02); s.add(t); }
                const beam = box(w, 0.16, 0.06, M.timber); beam.position.set(cx, y + FLOOR_H - 0.3, Z0 + 0.02); s.add(beam);
                // a window
                const win = box(Math.min(1.4, w * 0.35), 0.9, 0.05, M.glass); win.position.set(cx + w * 0.2, y + 1.6, Z0 + 0.03); s.add(win);
                // side walls at the building ends (left), and thin dividers
                // the building's left wall has a doorway onto the outside stair at each floor
                if (R.x0 === -7) {
                    const gz = stairZ(R.lv), g0 = gz - 0.55, g1 = gz + 0.55;
                    for (const [a, b] of [[Z0, g0], [g1, Z1]]) if (b - a > 0.05) { const w2 = box(0.18, FLOOR_H - 0.2, b - a, wallM); w2.position.set(R.x0, y + (FLOOR_H - 0.2) / 2, (a + b) / 2); s.add(w2); }
                    const lintel = box(0.2, 0.5, 1.1, M.timber); lintel.position.set(R.x0, y + FLOOR_H - 0.45, gz); s.add(lintel);
                } else { const side = box(0.18, FLOOR_H - 0.2, Z1 - Z0, wallM); side.position.set(R.x0, y + (FLOOR_H - 0.2) / 2, 0); s.add(side); }
                // a warm lamp per room for the evening
                const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.lamp.clone()); lamp.position.set(cx - w * 0.25, y + FLOOR_H - 0.55, Z0 + 0.3); s.add(lamp);
                const pl = new THREE.PointLight(0xffc977, 0, 5, 1.6); pl.position.copy(lamp.position); pl.position.z += 0.4; s.add(pl);
                this.lamps.push({ lamp, pl });
            }
            // click box for the room
            const hb = new THREE.Mesh(new THREE.BoxGeometry(w, FLOOR_H, Z1 - Z0), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.set(cx, y + FLOOR_H / 2, 0);
            s.add(hb);
            this.hits.push({ mesh: hb, kind: 'room', id });
        }
        // right walls at the end of each floor
        for (const [x, lv, h] of [[4, 0, 1], [7, 1, 1], [3.5, 2, 1]]) { const w = box(0.18, FLOOR_H - 0.2, Z1 - Z0, M.plaster); w.position.set(x, lv * FLOOR_H + (FLOOR_H - 0.2) / 2, 0); s.add(w); }
        // posts under the East Wing's overhang
        for (const z of [Z0 + 0.2, Z1 - 0.2]) { const p = box(0.22, FLOOR_H, 0.22, M.timber); p.position.set(6.9, FLOOR_H / 2, z); s.add(p); }
        // the sunroom: glass walls, then the roof
        const glassBack = box(7, FLOOR_H - 0.2, 0.06, M.glass); glassBack.position.set(0, 2 * FLOOR_H + 1.35, Z0 - 0.15); s.add(glassBack);
        const roofY = 3 * FLOOR_H - 0.1;
        for (const sgn of [-1, 1]) {
            const r = box(8.6, 0.2, 3.1, M.roof); r.position.set(0, roofY + 0.9, sgn * 1.25 - 0.4); r.rotation.x = sgn * 0.62; s.add(r);
        }
        const sideRoof = box(4.2, 0.2, 5.4, M.roof); sideRoof.position.set(-5.25, 2 * FLOOR_H + 0.05, 0); s.add(sideRoof);
        const sideRoof2 = box(3.6, 0.2, 5.4, M.roof); sideRoof2.position.set(5.25, 2 * FLOOR_H + 0.05, 0); s.add(sideRoof2);
        // the outside stair on the left
        for (let i = 0; i < 12; i++) { const st = box(0.9, 0.12, 0.6, M.plank); st.position.set(STAIR_X, i * (2 * FLOOR_H / 12), 1.8 - i * 0.33); s.add(st); }
        // the dragonfly sign by the door
        const sign = box(1.1, 0.5, 0.08, M.plank); sign.position.set(-1.3, 2.3, Z1 + 0.15); s.add(sign);

        // furniture (Meshy)
        const put = (name, h, x, y, z, ry = 0) => { const p = prop(name, h); p.position.set(x, y, z); p.rotation.y = ry; this.scene.add(p); return p; };
        put('item-desk', 1.05, -4.2, 0, -1.1);
        put('item-armchair', 0.95, -6.2, 0, 0.9, 0.7);
        put('item-bookshelf', 1.7, -6.4, 0, -1.9);
        put('item-stove', 1.5, 0.3, 0, -1.8);
        put('item-table', 0.95, 2.4, 0, 0.6);
        put('item-planter', 0.8, 6.0, 0, -1.2);
        put('item-planter', 0.8, 8.0, 0, -1.2);
        put('item-bathtub', 0.8, 7.6, 0, 1.2, -0.4);
        for (const id of ['r1', 'r2', 'r3', 'r4']) {
            const R = LAYOUT[id], y = FLOOR_H;
            put('item-bed', 0.95, R.x0 + 1.1, y, -1.2);
            put('item-wardrobe', 1.65, R.x1 - 0.6, y, -1.7);
        }
        put('item-bed', 1.0, -2.0, 2 * FLOOR_H, -1.2);
        put('item-armchair', 0.95, 1.6, 2 * FLOOR_H, 0.2, -0.5);
        put('item-bookshelf', 1.7, 2.9, 2 * FLOOR_H, -1.9);
        // boards over rooms that aren't open yet
        for (const id of ['r3', 'r4', 'r5']) {
            const R = LAYOUT[id], g = new THREE.Group();
            // two crossed planks over the opening: clearly closed, but the room behind still reads
            const w = R.x1 - R.x0, hh = FLOOR_H - 0.4, len = Math.hypot(w, hh), ang = Math.atan2(hh, w);
            for (const sgn of [1, -1]) { const b = box(len, 0.26, 0.08, M.plank); b.position.set((R.x0 + R.x1) / 2, R.lv * FLOOR_H + 0.2 + hh / 2, Z1 + 0.1 + (sgn > 0 ? 0 : 0.05)); b.rotation.z = sgn * ang; g.add(b); }
            this.scene.add(g);
            this.boards[id] = g;
        }
        this.decorSpots = [new THREE.Vector3(-2.4, 0, -1.9), new THREE.Vector3(-1.6, 0, -1.2), new THREE.Vector3(-6.6, 0, 1.6)];
        // the inn's people: Maple by the desk
        this.ensureActor('maple', 'maple', new THREE.Vector3(-4.2, 0, 0.1), 1.35);
    }

    ensureActor(key, model, pos, height = 1.1) {
        if (this.actors[key]) return this.actors[key];
        const a = new Actor(model, { height });
        a.root.position.copy(pos);
        a.setBase('idle');
        this.scene.add(a.root);
        const rec = { actor: a, path: [], speed: 1.9, key };
        this.actors[key] = rec;
        return rec;
    }

    removeActor(key) {
        const r = this.actors[key];
        if (!r) return;
        this.scene.remove(r.actor.root);
        delete this.actors[key];
    }

    /** Walk an actor to a spot, by way of the outside stair if it changes floor. */
    walkTo(key, dest) {
        const r = this.actors[key];
        if (!r) return;
        const p = r.actor.root.position;
        const from = Math.round(p.y / FLOOR_H), to = Math.round(dest.y / FLOOR_H);
        const path = [];
        if (from !== to) {
            // out through the side door, up or down the stair, in through the other door
            path.push(new THREE.Vector3(-6.4, from * FLOOR_H, stairZ(from)));
            path.push(new THREE.Vector3(STAIR_X, from * FLOOR_H, stairZ(from)));
            path.push(new THREE.Vector3(STAIR_X, to * FLOOR_H, stairZ(to)));
            path.push(new THREE.Vector3(to === 2 ? -5.2 : -6.4, to * FLOOR_H + (to === 2 ? 0.1 : 0), stairZ(to)));
        }
        path.push(dest.clone());
        r.path = path;
        r.actor.setBase('walk');
    }

    _spotIn(roomId, i = 0) {
        const R = LAYOUT[roomId];
        const x = R.x0 + 0.9 + ((i * 0.9) % Math.max(0.5, R.x1 - R.x0 - 1.6));
        return new THREE.Vector3(x + 0.6, R.lv * FLOOR_H, 0.4 + (i % 2) * 0.6);
    }

    // ------------------------------------------------------------------ reading the game
    sync(G, dt) {
        // rooms open / boarded
        for (const room of G.rooms) if (this.boards[room.id]) this.boards[room.id].visible = !room.open;
        // dust bunnies: one per 20 dust in each open room
        for (const room of G.rooms) {
            const want = room.open ? Math.ceil(room.dust / HOTEL.bunnyDust - 1e-9) : 0;
            const list = this.bunnies[room.id] ||= [];
            while (list.length < want) {
                const b = new Actor('dustbunny', { height: 0.46, face: Math.random() * 6 });
                const R = LAYOUT[room.id], i = list.length;
                b.root.position.set(R.x0 + 0.6 + ((i * 1.37) % (R.x1 - R.x0 - 1.2)), R.lv * FLOOR_H, 0.2 + ((i * 0.83) % 1.8));
                b.room = room.id;
                b.phase = Math.random() * 6;
                this.scene.add(b.root);
                list.push(b);
            }
            while (list.length > want) {
                const b = list.pop();
                this.fx.burst(b.root.position.clone().setY(b.root.position.y + 0.2), 'dust', 1.2);
                this.scene.remove(b.root);
            }
            for (const b of list) {
                b.phase += dt;
                b.root.position.y = LAYOUT[room.id].lv * FLOOR_H + Math.abs(Math.sin(b.phase * 4)) * 0.12;
                b.root.rotation.y += Math.sin(b.phase * 0.7) * dt;
                b.update(dt);
            }
        }
        // staff at their stations, party at home in the lobby, recruits in their rooms
        const away = new Set(G.exp ? G.party : []);
        const stations = { cook: new THREE.Vector3(0.5, 0, -0.6), concierge: new THREE.Vector3(-3.0, 0, -0.4), gardener: new THREE.Vector3(6.9, 0, -0.2), housekeeper: null };
        for (const id of Object.keys(HEROES)) {
            const h = G.heroes[id], key = 'hero-' + id;
            if (id === 'maple') continue;
            let want = null;
            if (h.joined && !away.has(id)) {
                const role = HEROES[id].staff;
                if (h.role !== 'party' && stations[role]) want = stations[role];
                else if (role === 'housekeeper' && h.role !== 'party') {
                    const dirty = G.rooms.filter((r) => r.open).sort((a, b) => b.dust - a.dust)[0];
                    want = this._spotIn(dirty?.id || 'r1', 2);
                } else want = new THREE.Vector3(-5.6 + Object.keys(HEROES).indexOf(id) * 0.5, 0, 1.6);
            } else if (!h.joined && G.recruits[id]?.stage !== 'none') {
                const g = Object.values(G.guests).find((x) => x.recruit === id);
                if (g?.room) want = this._spotIn(g.room, 1);
                else if (g) want = new THREE.Vector3(-2.2 - G.queue.indexOf(g.id) * 0.8, 0, 1.4);
            }
            this._place(key, id, want, 1.35);
        }
        // Maple: home in the lobby unless she's off on an expedition
        const maple = this.actors.maple;
        maple.actor.root.visible = !G.exp;
        // walk-in guests: in their rooms, or queueing by the door
        const seen = new Set();
        for (const g of Object.values(G.guests)) {
            if (g.recruit) continue;
            const key = 'guest-' + g.id;
            seen.add(key);
            const want = g.room ? this._spotIn(g.room, 0) : new THREE.Vector3(-2.0 - G.queue.indexOf(g.id) * 0.8, 0, 1.6);
            this._place(key, GUESTS[g.arch].model, want, 1.4, DOOR);
        }
        for (const key of Object.keys(this.actors)) if (key.startsWith('guest-') && !seen.has(key)) {
            const r = this.actors[key];
            if (!r.leaving) { r.leaving = true; this.walkTo(key, new THREE.Vector3(-2.6, 0, 5)); }
        }
        // meals on the kitchen table
        const want = G.pantry.slice(0, 6).map((m) => m.r);
        if (want.join() !== this.meals.map((m) => m.r).join()) {
            for (const m of this.meals) this.scene.remove(m.obj);
            this.meals = want.map((r, i) => {
                const obj = prop('item-' + r, 0.3); obj.position.set(1.9 + (i % 3) * 0.42, 0.95, 0.35 + Math.floor(i / 3) * 0.45); this.scene.add(obj);
                return { r, obj };
            });
        }
        // decor on display
        const dk = G.decor.join();
        if (dk !== this.decorKey) {
            this.decorKey = dk;
            for (const o of Object.values(this.decor)) this.scene.remove(o);
            this.decor = {};
            G.decor.forEach((d, i) => { const o = prop('item-' + d, d === 'armorStand' || d === 'luggageCart' ? 1.3 : 0.9); o.position.copy(this.decorSpots[i]); this.scene.add(o); this.decor[d] = o; });
        }
        // a pot on the stove while cooking
        if (!!G.cook !== !!this.pot) {
            if (G.cook) { this.pot = prop('item-copperPot', 0.35); this.pot.position.set(0.3, 1.5, -1.7); this.scene.add(this.pot); }
            else { this.scene.remove(this.pot); this.pot = null; }
        }
        if (this.pot && Math.random() < dt * 6) this.fx.burst(new THREE.Vector3(0.3, 1.9, -1.6), 'dust', 0.4);
        // time of day: a warm morning, a bright noon, a golden evening, a blue night with the lamps lit
        const f = G.clock / DAY_LEN;
        const sun = this.scene.userData.sun;
        const night = Math.max(0, (f - 0.78) / 0.22);
        const eve = Math.max(0, 1 - Math.abs(f - 0.68) / 0.15);
        sun.color.setRGB(1, 0.95 - eve * 0.2 - night * 0.4, 0.85 - eve * 0.35 - night * 0.2);
        sun.intensity = 2.1 - night * 1.3;
        for (const l of this.lamps) { l.pl.intensity = 0.4 + night * 2.2 + eve * 0.8; l.lamp.material.color.setRGB(1, 0.9, 0.6 + night * 0.2); }
        this.stage.bgEl.style.filter = `brightness(${(1 - night * 0.45).toFixed(2)}) saturate(${(1 + eve * 0.25).toFixed(2)}) hue-rotate(${(-eve * 12 + night * 20).toFixed(0)}deg)`;

        // move everyone along their paths
        for (const r of Object.values(this.actors)) {
            const a = r.actor, p = a.root.position;
            if (r.path.length) {
                const t = r.path[0];
                const d = t.clone().sub(p);
                const step = r.speed * dt;
                if (d.length() <= step) {
                    p.copy(t); r.path.shift();
                    if (!r.path.length) {
                        a.setBase('idle');
                        a.root.rotation.y = 0;
                        if (r.leaving) { this.removeActor(r.key); continue; }
                    }
                } else {
                    p.addScaledVector(d.normalize(), step);
                    if (Math.abs(d.x) + Math.abs(d.z) > 0.01) a.root.rotation.y = Math.atan2(d.x, d.z);
                }
            }
            a.update(dt);
        }
        this.fx.update(dt);
    }

    /** Put an actor where the game wants it: appear at the door the first time, then walk when the spot changes. */
    _place(key, model, want, height, enter = null) {
        if (!want) { if (this.actors[key] && !this.actors[key].leaving) { this.actors[key].leaving = true; this.walkTo(key, new THREE.Vector3(-2.6, 0, 5)); } return; }
        let r = this.actors[key];
        if (!r) { r = this.ensureActor(key, model, enter || want, height); r.want = null; }
        if (r.leaving) { r.leaving = false; }
        if (!r.want || r.want.distanceTo(want) > 0.3) { r.want = want.clone(); this.walkTo(key, want); }
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sweep') {
                const list = this.bunnies[e.room] || [];
                const b = list[list.length - 1];
                if (b) this.fx.burst(b.root.position.clone().setY(b.root.position.y + 0.25), 'dust', 1.3);
                if (!e.byStaff) this.mapleTo(e.room);
            } else if (e.type === 'cooked') {
                this.fx.burst(new THREE.Vector3(0.4, 1.8, -1.4), e.grade === 'perfect' ? 'star' : 'fire', 1.1);
            } else if (e.type === 'harvest') {
                this.fx.burst(new THREE.Vector3(7, 0.9, -1.2), 'leaf', 1.2);
            } else if (e.type === 'checkout' || e.type === 'paid' || e.type === 'served') {
                this.fx.burst(new THREE.Vector3(-4.2, 1.4, -0.8), 'coin', 0.9);
            } else if (e.type === 'guestArrive') {
                this.fx.ring(DOOR, 0xfff0a0, 1.5);
            } else if (e.type === 'recruited') {
                const r = this.actors['hero-' + e.hero];
                if (r) { r.actor.play('wave'); this.fx.burst(r.actor.root.position.clone().setY(1.2), 'heal', 1.4); }
            } else if (e.type === 'tierUp') {
                for (const id of Object.keys(this.boards)) this.fx.burst(roomCenter(id).setY(LAYOUT[id].lv * FLOOR_H + 1.2), 'star', 2);
                this.actors.maple?.actor.play('victory');
            }
        }
    }

    mapleTo(roomId) {
        if (!LAYOUT[roomId]) return;
        this.walkTo('maple', this._spotIn(roomId, 3));
    }

    // ------------------------------------------------------------------ input
    /** What's under the pointer: a dust bunny (beats everything), a room, or nothing. */
    pick(clientX, clientY) {
        const rc = this.stage.ray(clientX, clientY, 'hotel');
        const objs = [];
        for (const list of Object.values(this.bunnies)) for (const b of list) objs.push(b.root);
        const hitB = rc.intersectObjects(objs, true)[0];
        if (hitB) {
            let o = hitB.object;
            while (o && !objs.includes(o)) o = o.parent;
            const b = Object.values(this.bunnies).flat().find((x) => x.root === o);
            if (b) return { kind: 'bunny', room: b.room };
        }
        // a generous pick for bunnies: anything within 0.5 of the ray
        let best = null, bd = 0.45;
        for (const list of Object.values(this.bunnies)) for (const b of list) {
            const d = rc.ray.distanceToPoint(b.root.position.clone().setY(b.root.position.y + 0.2));
            if (d < bd) { bd = d; best = b; }
        }
        if (best) return { kind: 'bunny', room: best.room };
        const h = rc.intersectObjects(this.hits.map((x) => x.mesh), false)[0];
        if (h) { const x = this.hits.find((y) => y.mesh === h.object); return { kind: 'room', id: x.id }; }
        return null;
    }

    /** Screen position of a room's label anchor. */
    roomScreen(id) {
        const R = LAYOUT[id];
        return this.stage.toScreen(new THREE.Vector3((R.x0 + R.x1) / 2, R.lv * FLOOR_H + FLOOR_H - 0.4, Z1), 'hotel');
    }

    render() { this.stage.render('hotel', 'hotel'); }
}
