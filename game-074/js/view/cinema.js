// Story scenes and the title backdrop, staged in 3D with the same models the
// game uses: Cael on the left, whoever he is talking to on the right, in front
// of the sky of the circle they're in. The speaker is lit; the listener dims.

import * as THREE from 'three';
import { buildCael, buildVesper, setFade, group } from './models.js';
import { buildBoss } from './bossmodels.js';
import { BOSSES } from '../sim/bosses.js';
import { Sprites, SHAPE } from './sprites.js';

function posedBoss(kind) {
    const m = buildBoss(kind);
    const b = { kind, t: 0, st: 'fight', parts: [], x: 0, y: 0, open: 0.3, phase: 1, mode: 'hover', mt: 0, pulse: 0 };
    BOSSES[kind].init(b, null);
    for (const p of b.parts) { p.max = p.hp; p.alive = true; p.flash = 0; }
    m.fake = b;
    return m;
}

const CAST = {
    cael: { make: () => buildCael(), scale: 1.75, pos: [10.2, 8.0, 0], tilt: 0.75 },
    vesper: { make: (o) => buildVesper(!!o.vesperFree), scale: 1.55, pos: [21.8, 8.4, -0.5], right: true, tilt: 0.85 },
    malphas: { make: () => posedBoss('malphas'), scale: 0.62, pos: [24.5, 7.4, -5], right: true, boss: true },
    ferryman: { make: () => posedBoss('ferryman'), scale: 0.8, pos: [23.6, 4.6, -3], right: true, boss: true },
    sammael: { make: () => posedBoss('sammael'), scale: 1.05, pos: [21.8, 8.6, -0.5], right: true, boss: true, tilt: -0.5 },
    gorrmaw: { make: () => posedBoss('gorrmaw'), scale: 0.75, pos: [23.5, 6.5, -3], right: true, boss: true },
};

export class Cinema {
    constructor(view) {
        this.v = view;
        this.group = new THREE.Group();
        this.group.visible = false;
        view.scene.add(this.group);
        this.actors = {};
        this.lights = [new THREE.PointLight(0xfff0d0, 0, 18, 1.2), new THREE.PointLight(0xfff0d0, 0, 18, 1.2)];
        for (const l of this.lights) this.group.add(l);
        this.fill = new THREE.DirectionalLight(0xffffff, 0.25);
        this.fill.position.set(16, 12, 20);
        this.group.add(this.fill);
        this.motes = new Sprites(400, 5, true);
        this.group.add(this.motes.mesh);
        this.mp = [];
        this.speaker = null;
        this.kind = 'title';
        this.t = 0;
    }

    setVisible(v) {
        this.group.visible = v;
        if (v) { this.v.r.base.set(16, 9.2, 15.5); this.v.r.look.set(16, 8.8, 0); }
    }

    clear() {
        for (const a of Object.values(this.actors)) { this.group.remove(a.wrap); }
        this.actors = {};
    }

    addActor(name, opts = {}) {
        const def = CAST[name];
        if (!def) return null;
        const m = def.make(opts);
        const wrap = group(m.root);
        wrap.scale.setScalar(def.scale);
        wrap.position.set(...def.pos);
        if (def.right && !def.boss) wrap.rotation.y = Math.PI;
        if (def.tilt) m.root.rotation.z = def.tilt;
        if (name === 'sammael') wrap.rotation.y = 0;
        this.group.add(wrap);
        const a = { name, m, wrap, def, base: new THREE.Vector3(...def.pos), fade: 1 };
        this.actors[name] = a;
        return a;
    }

    /** Stage a story scene: def from sim/story.js SCENES. */
    stageScene(def) {
        this.clear();
        this.kind = def.ending ? 'ending' : 'scene';
        this.v.setLook(def.bg);
        if (def.left) this.addActor(def.left);
        if (def.right) this.addActor(def.right, def);
        if (def.bg === 7) {
            // the ending: both rise together
            const c = this.actors.cael, ve = this.actors.vesper;
            if (c) c.base.set(11.5, 7.6, 0);
            if (ve) { ve.base.set(19.5, 8.4, -0.4); }
        }
        this.speaker = null;
    }

    stageTitle() {
        this.clear();
        this.kind = 'title';
        this.v.setLook(0);
        const c = this.addActor('cael');
        c.base.set(10.6, 6.2, 0);
        c.wrap.scale.setScalar(1.6);
    }

    speak(who) { this.speaker = who; }

    update(dt, time) {
        this.t += dt;
        const t = this.t;
        this.v.backdrop.update(t * 4, time, dt);
        for (const a of Object.values(this.actors)) {
            const speaking = this.speaker === a.name;
            const target = this.kind === 'title' || !this.speaker || this.speaker === 'narrator' ? (this.speaker === 'narrator' ? 0.7 : 1) : speaking ? 1.15 : 0.55;
            a.fade += (target - a.fade) * Math.min(1, dt * 4);
            setFade(a.m, a.fade);
            const bob = Math.sin(t * 1.3 + a.base.x) * 0.18;
            const rise = this.kind === 'ending' ? Math.min(3, t * 0.12) : 0;
            a.wrap.position.set(a.base.x, a.base.y + bob + rise, a.base.z);
            if (a.def.boss) a.m.update(a.m.fake, t, dt, null);
            else a.m.update({ bank: Math.sin(t * 0.7) * 0.15, moving: 0 }, t, dt, { moving: 0 });
        }
        // the speaker's light
        const sp = this.actors[this.speaker];
        this.lights[0].intensity = sp ? 5 : 0;
        if (sp) this.lights[0].position.set(sp.wrap.position.x + (sp.def.right ? -3 : 3), sp.wrap.position.y + 2, 5);
        const c = this.actors.cael;
        this.lights[1].intensity = c ? 1.5 : 0;
        if (c) this.lights[1].position.set(c.wrap.position.x + 2, c.wrap.position.y, 4);
        this.v.r.base.x = 16 + Math.sin(t * 0.15) * 0.8;
        // floating motes
        const S = this.motes;
        if (this.mp.length < 120 && Math.random() < dt * 30) {
            const col = this.kind === 'ending' ? [1, 0.95, 0.75] : this.kind === 'title' ? [1, 0.55, 0.2] : [1, 0.8, 0.5];
            this.mp.push({ x: 4 + Math.random() * 24, y: 1 + Math.random() * 3, z: -2 + Math.random() * 6, vy: 0.6 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 0.4, t: 0, life: 6 + Math.random() * 6, s: 0.06 + Math.random() * 0.1, col });
        }
        S.begin();
        this.mp = this.mp.filter((p) => {
            p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
            const a = Math.min(1, p.t) * Math.min(1, p.life - p.t);
            S.add(p.x, p.y, p.z, p.s, p.s, 0, p.col[0], p.col[1], p.col[2], a * 1.5, SHAPE.orb);
            return p.t < p.life;
        });
        S.end(time);
    }
}
