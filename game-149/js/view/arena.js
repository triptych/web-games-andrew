// The battle arena: the party on the left, the foes on the right, on a glowing platform in front of the place's
// painted background. Sim events ('act', 'won', 'lost') play as a queue: the actor's clip, the spell's sparks at
// the impact, the targets' hit or faint, damage numbers. `busy` holds the sim's next turn until it has all landed.

import * as THREE from 'three';
import { FOES, CAST, SKILLS } from '../sim/data.js';
import { Actor, RAMP } from './assets.js';

const EL_COLOR = { fire: 0xff7a3a, star: 0xd8c8ff, water: 0x4fd6ff, wind: 0x8fe07a, echo: 0xe8f0ff, hollow: 0xb060ff };
const SFX_FOR = { fire: 'fire', star: 'star', water: 'water', wind: 'wind', echo: 'echo', hollow: 'hollow' };
const BARK = { blaze: ['hana', 'skill'], starfall: ['lys', 'skill'], tonic: ['pip', 'skill'], cyclone: ['ren', 'skill'], glyph: ['graves', 'glyph'], echo: ['kai', 'echo'] };

export class Arena {
    constructor(view) {
        this.view = view;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a8a, 1.7));
        const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
        sun.position.set(3, 9, 7); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
        this.scene.add(sun);
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.3, 48), new THREE.MeshToonMaterial({ color: 0xd6cbe8, gradientMap: RAMP, transparent: true, opacity: 0.55 }));
        plat.position.y = -0.2; plat.receiveShadow = true;
        this.scene.add(plat);
        this.ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.35, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
        this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.02;
        this.scene.add(this.ring);
        this.actors = {};
        this.queue = [];
        this.timers = [];
        this.parts = [];
        this.busyT = 0;
        this.audio = null;
        this.pops = document.getElementById('pops');
    }

    resize(w, h) {
        this.camera.aspect = w / h;
        this.camera.fov = w / h < 0.8 ? 64 : 40;
        this.camera.updateProjectionMatrix();
    }

    get busy() { return this.queue.length > 0 || this.busyT > 0; }

    enter(G) {
        this.leave();
        const B = G.battle;
        const heroes = B.actors.filter((a) => a.side === 'hero'), foes = B.actors.filter((a) => a.side === 'foe');
        heroes.forEach((a, i) => this.addActor(a, i, heroes.length));
        foes.forEach((a, i) => this.addActor(a, i, foes.length));
        this.portrait = this.camera.aspect < 0.8;
        const p = this.portrait;
        this.camera.position.set(0, p ? 4.2 : 2.6, p ? 14 : 9.6);
        this.camera.lookAt(0, p ? 1.5 : 1.2, 0);
    }

    slot(side, i, n) {
        const p = this.camera.aspect < 0.8;
        const spread = p ? 1.5 : 1.9;
        const sgn = side === 'hero' ? -1 : 1;
        const z = (i - (n - 1) / 2) * spread;
        // a diagonal line, so nobody stands right behind anybody from the camera's point of view
        return new THREE.Vector3(sgn * (p ? 2.2 : 3.0) + sgn * (i - (n - 1) / 2) * (p ? 0.7 : 1.0), 0, z);
    }

    addActor(a, i, n) {
        const h = a.side === 'hero' ? (a.kind === 'graves' ? 1.75 : 1.62) : FOES[a.kind].h;
        const act = new Actor(a.model, { height: h, color: a.side === 'hero' ? new THREE.Color(CAST[a.kind]?.color || '#fff').getHex() : 0xb070ff });
        const pos = this.slot(a.side, i, n);
        act.root.position.copy(pos);
        act.root.rotation.y = a.side === 'hero' ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35;
        act.home = pos.clone();
        act.setBase(act.rigged && act.name !== 'veymont' ? 'battleIdle' : 'idle');
        if (a.kind === 'wisp' || a.kind === 'boss') act.root.position.y = a.kind === 'wisp' ? 0.6 : 0;
        this.scene.add(act.root);
        this.actors[a.id] = act;
        act.data = a;
    }

    leave() {
        for (const a of Object.values(this.actors)) this.scene.remove(a.root);
        this.actors = {};
        this.queue = [];
        for (const p of this.parts) this.scene.remove(p.m);
        this.parts = [];
        this.busyT = 0;
    }

    onEvents(G, events) {
        if (!G.battle) return;
        for (const e of events) {
            if (e.type === 'act' || e.type === 'won' || e.type === 'lost') this.queue.push({ e, G });
        }
    }

    pop(id, text, cls) {
        const a = this.actors[id];
        if (!a) return;
        const v = a.root.position.clone(); v.y += (a.height || 1.6) + 0.3;
        const s = this.view.project(v, this.camera);
        const el = document.createElement('div');
        el.className = 'pop ' + (cls || '');
        el.textContent = text;
        el.style.left = s.x + (Math.random() - 0.5) * 30 + 'px';
        el.style.top = s.y + 'px';
        this.pops.appendChild(el);
        setTimeout(() => el.remove(), 1150);
    }

    burst(at, color, n = 18, spread = 1.2) {
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 + Math.random() * 0.08), new THREE.MeshBasicMaterial({ color, transparent: true }));
            m.position.copy(at);
            const v = new THREE.Vector3((Math.random() - 0.5) * spread * 3, Math.random() * spread * 3, (Math.random() - 0.5) * spread * 3);
            this.scene.add(m);
            this.parts.push({ m, v, t: 0, life: 0.6 + Math.random() * 0.4 });
        }
    }

    rings(at, color) {
        for (let k = 0; k < 3; k++) {
            const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true }));
            r.position.copy(at); r.rotation.y = Math.PI / 2;
            this.scene.add(r);
            this.parts.push({ m: r, v: new THREE.Vector3(), t: -k * 0.12, life: 0.7, grow: 4 });
        }
    }

    /** Play one queued event. */
    playNext() {
        const { e, G } = this.queue.shift();
        if (e.type === 'won') {
            for (const a of Object.values(this.actors)) if (a.data.side === 'hero' && a.data.alive !== false && a.has('victory')) a.play('victory', { hold: true });
            this.audio?.sfx('victory');
            const kai = G.battle?.actors.find((x) => x.id === 'kai');
            if (kai) this.audio?.bark('kai', 'win', 0.8);
            this.busyT = 0.8;
            return;
        }
        if (e.type === 'lost') { this.busyT = 0.6; return; }
        const src = this.actors[e.actor];
        if (!src) { this.busyT = 0.2; return; }
        const sk = SKILLS[e.skill];
        const el = e.el || (e.skill === 'strike' ? null : sk?.el);
        let clip = e.skill === 'strike' || e.skill === 'smash' || e.skill === 'dive' || e.skill === 'bonk' ? 'attack' : (e.skill === 'defend' || e.skill === 'item' ? 'wave' : 'skill');
        if (!src.has(clip)) clip = src.has('attack') ? 'attack' : clip;
        let dur = src.play(clip, { maxImpact: 0.7 });
        const impact = Math.min(src.lastImpact ?? dur * 0.45, 0.75);
        // voices: a skill shout now and then
        if (e.echo) this.audio?.bark('kai', 'echo', 0.6);
        else if (BARK[e.skill]) this.audio?.bark(...BARK[e.skill], 0.45);
        if (e.side === 'foe' && G.battle?.actors.find((a) => a.id === e.actor)?.kind === 'boss' && e.skill === 'requiem') this.audio?.bark('veymont', 'laugh', 0.35);
        // effects at impact
        const color = EL_COLOR[el] ?? 0xffffff;
        setTimeout(() => {
            if (e.echo) this.rings(src.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xe8f0ff);
            if (el) this.audio?.sfx(SFX_FOR[el] || 'hit');
            for (const t of e.targets) {
                const ta = this.actors[t.id];
                if (t.summoned) { const a = G.battle?.actors.find((x) => x.id === t.id); if (a) { const n = Object.values(this.actors).filter((x) => x.data.side === 'foe').length; this.addActor(a, n, n + 1); } continue; }
                if (!ta) continue;
                const at = ta.root.position.clone().add(new THREE.Vector3(0, (ta.height || 1.5) * 0.6, 0));
                if (t.dmg != null) {
                    this.burst(at, color, t.weak ? 28 : 16);
                    this.audio?.sfx('hit', { rate: 0.9 + Math.random() * 0.2, gain: 0.8 });
                    ta.hitFlash();
                    if (t.ko) { ta.play(ta.has('faint') ? 'faint' : 'hit', { hold: true }); if (ta.data.side === 'hero') this.audio?.bark(ta.data.kind === 'kai' ? 'kai' : ta.data.kind, 'hurt', 0.7); }
                    else ta.play('hit');
                    this.pop(t.id, (t.crit ? 'CRIT ' : '') + t.dmg, t.weak ? 'weak' : '');
                    if (t.weak) this.pop(t.id, 'Weak!', 'info');
                    if (t.resist) this.pop(t.id, 'Resist', 'info');
                    if (t.mpLost) this.pop(t.id, `-${t.mpLost} MP`, 'mp');
                } else if (t.heal != null || t.mp != null) {
                    this.burst(at, t.mp != null ? 0x7fb8ff : 0x8dffb0, 12, 0.6);
                    this.audio?.sfx('heal', { gain: 0.6 });
                    if (t.revive) { ta.setBase('battleIdle'); ta.play('wave'); }
                    this.pop(t.id, t.mp != null ? `+${t.mp} MP` : `+${t.heal}`, t.mp != null ? 'mp' : 'heal');
                } else if (t.shield) {
                    this.burst(at, 0xd8c8ff, 10, 0.5);
                    this.pop(t.id, 'Shield', 'info');
                }
            }
            if (e.skill === 'defend') this.pop(e.actor, 'Guard', 'info');
            if (e.skill === 'item') this.audio?.sfx('heal', { gain: 0.5 });
        }, impact * 1000);
        this.busyT = Math.max(impact + 0.55, 0.9);
    }

    frame(G, dt, time) {
        if (this.busyT > 0) this.busyT -= dt;
        else if (this.queue.length) this.playNext();
        for (const a of Object.values(this.actors)) {
            a.update(dt);
            const d = G.battle?.actors.find((x) => x.id === a.data.id);
            if (d) a.data = d;
            if (a.data.kind === 'wisp') a.root.position.y = 0.6 + Math.sin(time * 2 + a.home.z) * 0.15;
            // whose turn: a little lift
            const now = G.battle?.phase === 'cmd' && G.battle.actors[G.battle.cur]?.id === a.data.id;
            a.root.position.x = a.home.x + (now ? 0.5 : 0);
        }
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.t += dt;
            if (p.t < 0) continue;
            if (p.grow) { const s = 1 + p.t * p.grow; p.m.scale.set(s, s, s); }
            else { p.m.position.addScaledVector(p.v, dt); p.v.y -= dt * 4; }
            p.m.material.opacity = Math.max(0, 1 - p.t / p.life);
            if (p.t > p.life) { this.scene.remove(p.m); this.parts.splice(i, 1); }
        }
        this.ring.rotation.z += dt * 0.2;
    }
}
