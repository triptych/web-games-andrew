// The player, the pet, monsters and shades: Meshy models moved to where the sim says, walking when they move,
// lunging when they attack, flashing when hit, sinking when they die. Never changes G.

import * as THREE from 'three';
import { CLASSES, MASTERIES } from '../sim/data/masteries.js';
import { MONSTERS, BOSSES } from '../sim/data/monsters.js';
import { model, modelState, preload } from './models.js';

const faceRot = (f) => Math.PI / 2 - f;       // models look down +Z; the sim's face is an angle in (x, y)
const STATIC_GAIT = new Set(['mon-gorehound', 'mon-wraith', 'mon-gorgon', 'boss-skyllith', 'boss-morwen', 'pet']);

function ring(color, r, opacity = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.04;
    return m;
}

export class Actors {
    constructor(view) {
        this.view = view;
        this.scene = view.scene;
        this.map = new Map();          // sim id → { g, kind, ... }
        this.modelState = modelState;
        this.player = null; this.pet = null;
        preload(['hero-ironsworn', 'hero-stormcaller', 'hero-shadebinder', 'pet']);
    }

    resetArea(G) {
        for (const a of this.map.values()) this.scene.remove(a.g);
        this.map.clear();
        if (this.player && this.player.cls !== G.player.cls) { this.scene.remove(this.player.g); this.player = null; }
        preload([...new Set(G.mons.map((m) => (m.boss ? BOSSES[m.boss] : MONSTERS[m.kind]).model))]);
    }

    makePlayer(G) {
        const C = CLASSES[G.player.cls];
        const g = model(C.model, 1.8, { color: MASTERIES[C.mastery].hex });
        g.add(ring(MASTERIES[C.mastery].hex, 0.7, 0.35));
        this.scene.add(g);
        this.player = { g, cls: G.player.cls, lunge: 0, hit: 0, shield: null, bob: 0 };
        const sh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
        sh.position.y = 1; sh.visible = false; g.add(sh); this.player.shield = sh;
        const aura = ring(0xff5030, 1.6, 0.4); aura.visible = false; g.add(aura); this.player.aura = aura;
    }

    makeMonster(m) {
        const def = m.boss ? BOSSES[m.boss] : MONSTERS[m.kind];
        const h = def.h * (m.elite && !m.elite.minion ? 1.18 : 1);
        const g = model(def.model, h, { color: def.color });
        if (m.elite) g.add(ring(m.elite.tier === 'rare' ? 0xffd84a : m.elite.tier === 'champion' ? 0x5b8cff : 0x8a8a8a, def.radius + 0.25, 0.55));
        if (m.boss) { g.add(ring(0xff4020, def.radius + 0.6, 0.45)); const l = new THREE.PointLight(def.color, 30, 10, 1.5); l.position.y = h * 0.7; g.add(l); }
        this.scene.add(g);
        return { g, kind: 'mon', def, lunge: 0, hit: 0, static: STATIC_GAIT.has(def.model), dead: 0, bob: Math.random() * 6 };
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'cast' && this.player) this.player.lunge = 1;
            else if (e.type === 'monAttack' || e.type === 'bossCast') { const a = this.map.get(e.id); if (a) a.lunge = 1; }
            else if (e.type === 'hit') { const a = this.map.get(e.id); if (a) a.hit = 1; }
            else if (e.type === 'hurt' && this.player) this.player.hit = 1;
            else if (e.type === 'petBite' && this.pet) this.pet.lunge = 1;
        }
    }

    /** Drive a model: position, facing, walk clip speed, lunge, hit flash. */
    pose(a, x, y, face, moving, speed, dt, time) {
        const g = a.g;
        const nx = x, ny = y;
        g.position.x = nx; g.position.z = ny;
        // turn smoothly
        const target = faceRot(face);
        let d = target - g.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        g.rotation.y += d * Math.min(1, dt * 14);
        a.lunge = Math.max(0, a.lunge - dt * 5);
        const lunge = Math.sin(a.lunge * Math.PI) * 0.35;
        g.position.x += Math.cos(face) * lunge; g.position.z += Math.sin(face) * lunge;
        const u = g.userData;
        if (u.mixer) {
            if (moving) { u.walk.paused = false; u.walk.timeScale = Math.max(0.6, speed / 2.4); }
            else { u.walk.paused = true; u.walk.time = (u.clipLen || 1) * 0.02; }
            u.mixer.update(dt);
            g.rotation.x = -lunge * 0.4;
        } else {
            // models without a rig: a gait in code (bob, a lean into the run, a lunge)
            a.bob += dt * (moving ? speed * 2.4 : 1.2);
            g.position.y = moving ? Math.abs(Math.sin(a.bob)) * 0.08 * (u.h || 1) : Math.sin(a.bob) * 0.02;
            g.rotation.x = moving ? 0.08 : 0;
            g.rotation.z = moving ? Math.sin(a.bob) * 0.04 : 0;
            if (a.def?.model === 'mon-wraith' || a.def?.model === 'boss-morwen') g.position.y = 0.25 + Math.sin(time * 2 + a.bob) * 0.12;
        }
        a.hit = Math.max(0, a.hit - dt * 6);
        if (a.hit > 0 || a.flashed) {
            a.flashed = a.hit > 0;
            g.traverse((o) => { if (o.isMesh && o.material?.emissive && !o.material.userData?.ghost) { o.material.userData.e0 ??= o.material.emissive.getHex(); o.material.emissive.setHex(a.hit > 0 ? 0x803020 : o.material.userData.e0); } });
        }
    }

    frame(G, dt, time) {
        const P = G.player;
        if (!this.player) this.makePlayer(G);
        const pa = this.player;
        const moving = !!P.moving || !!P.channel;
        this.pose(pa, P.x, P.y, P.face, moving, P.stats.moveSpeed, dt, time);
        pa.g.visible = G.mode !== 'dead' || Math.sin(time * 20) > 0;
        pa.shield.visible = P.buffs.some((b) => b.k === 'shield');
        pa.aura.visible = P.buffs.some((b) => b.k === 'warcry' || b.k === 'bulwark');

        // pet
        if (!this.pet) { const g = model('pet', 1.05, { color: 0x6a6a70 }); this.scene.add(g); this.pet = { g, lunge: 0, hit: 0, static: true, bob: 0, def: { model: 'pet' } }; }
        const pet = G.pet;
        this.pet.g.visible = pet.state !== 'away';
        if (pet.state !== 'away') {
            const mv = this.pet.px !== undefined && Math.hypot(pet.x - this.pet.px, pet.y - this.pet.py) > 0.002;
            this.pose(this.pet, pet.x, pet.y, pet.face, mv, 6, dt, time);
            this.pet.g.rotation.z = pet.state === 'down' ? 1.3 : this.pet.g.rotation.z;
            this.pet.px = pet.x; this.pet.py = pet.y;
        }

        // monsters and minions
        const seen = new Set();
        const near = (x, y) => Math.abs(x - P.x) < 30 && Math.abs(y - P.y) < 26;
        for (const m of G.mons) {
            seen.add(m.id);
            let a = this.map.get(m.id);
            if (!near(m.x, m.y)) { if (a) a.g.visible = false; continue; }
            if (!a) { a = this.makeMonster(m); this.map.set(m.id, a); a.px = m.x; a.py = m.y; }
            a.g.visible = true;
            const mv = Math.hypot(m.x - a.px, m.y - a.py) > 0.001;
            a.px = m.x; a.py = m.y;
            if (m.state === 'dead') {
                a.dead += dt;
                a.g.rotation.z = Math.min(1.5, a.dead * 5) * (m.id % 2 ? 1 : -1);
                a.g.position.y = -Math.max(0, a.dead - 2) * 0.4;
                if (a.g.userData.mixer) a.g.userData.walk.paused = true;
                continue;
            }
            this.pose(a, m.x, m.y, m.face, mv && m.state !== 'stagger', m.speed, dt, time);
            if (m.state === 'stagger' || m.state === 'stun') a.g.rotation.x = -0.25;
        }
        for (const s of G.minions) {
            seen.add(s.id);
            let a = this.map.get(s.id);
            if (!a) {
                const g = s.kind === 'decoy' ? model(CLASSES[P.cls].model, 1.8, { tint: 0x8a5aff, opacity: 0.45 }) : model('mon-thrall', 1.7, { tint: 0xa77bff, opacity: 0.5, color: 0xa77bff });
                this.scene.add(g);
                a = { g, lunge: 0, hit: 0, bob: 0, px: s.x, py: s.y };
                this.map.set(s.id, a);
            }
            const mv = Math.hypot(s.x - a.px, s.y - a.py) > 0.001;
            const f = mv ? Math.atan2(s.y - a.py, s.x - a.px) : (a.f ?? 0);
            a.f = f; a.px = s.x; a.py = s.y;
            this.pose(a, s.x, s.y, f, mv, 6, dt, time);
        }
        for (const [id, a] of this.map) if (!seen.has(id)) { this.scene.remove(a.g); this.map.delete(id); }
    }
}
