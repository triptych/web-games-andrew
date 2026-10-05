/**
 * view.js — glues the sim to three.js: owns the renderer, the current stage
 * set, actor sprites and effects; turns world events into sparks, shakes and
 * flashes; places the camera.
 */

import * as THREE from 'three';
import { Renderer } from './scene.js';
import { Actors } from './actors.js';
import { FX } from './fx.js';
import { buildStage } from './stages.js';
import { ENEMIES } from '../sim/enemies.js';
import { BOSSES } from '../sim/bosses.js';

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.actors = new Actors(this.r.scene);
        this.fx = new FX(this.r.scene, this.actors);
        this.stage = null; this.level = null;
        this.t = 0;
        this.ambientBase = new THREE.Vector3(1, 1, 1);
    }

    resize(w, h, dpr) { return this.r.resize(w, h, dpr); }

    /** Character sprite keys a stage needs (for baking up front). */
    static charsFor(level, character = 'juno') {
        const keys = new Set(['juno']);
        for (const ev of level.events) {
            for (const wv of ev.waves || []) for (const s of wv) keys.add(ENEMIES[s[0]].sprite);
            for (const s of ev.spawns || []) keys.add(ENEMIES[s[0]].sprite);
            if (ev.t === 'boss') {
                keys.add(BOSSES[ev.id].sprite);
                if (ev.id === 'jackhammer') keys.add('punk');
                if (ev.id === 'bulwark') { keys.add('guard'); keys.add('gunner'); }
                if (ev.id === 'goliath') keys.add('husk');
                if (ev.id === 'mika') keys.add('drone');
                if (ev.id === 'magnus') { keys.add('magnus2'); keys.add('synth'); keys.add('drone'); keys.add('mika'); }
            }
        }
        void character;
        return [...keys];
    }

    loadStage(level) {
        if (this.stage) {
            this.r.scene.remove(this.stage.fg); this.r.bgScene.remove(this.stage.bg);
            const dispose = (o) => o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => m.dispose()); } });
            dispose(this.stage.fg); dispose(this.stage.bg);
        }
        this.actors.clear(); this.fx.clear();
        this.level = level;
        this.stage = buildStage(level, this.r);
        this.r.scene.add(this.stage.fg);
        this.r.bgScene.add(this.stage.bg);
        const fogC = new THREE.Color(level.fog ?? 0x000000);
        this.r.scene.fog = new THREE.Fog(fogC, 900, 2400);
        this.r.bgScene.fog = new THREE.Fog(new THREE.Color(this.stage.theme.sky.bottom), 1400, 7000);
        const a = level.ambient || [1, 1, 1];
        this.ambientBase.set(a[0], a[1], a[2]);
        this.fx.setRain(!!level.rain, level.key === 'market' ? 0xd8a0a0 : 0x8aa0d8);
    }

    /** React to one world event with effects. */
    handle(e, w) {
        const fx = this.fx, r = this.r;
        switch (e.t) {
            case 'hit': fx.hit(e); if (e.dmg >= 12) r.addShake(2, 0.15); break;
            case 'block': fx.block(e); break;
            case 'dust': fx.dust(e.x, e.z, e.big); break;
            case 'explode': fx.explode(e.x, e.y, e.z, e.r); r.addShake(5, 0.35); r.flashScreen('white', 0.25); break;
            case 'shock': fx.shock(e.x, e.z, e.r, e.color); break;
            case 'arc': fx.arc(e.x, e.y, e.z, e.od); r.aberr = 2; break;
            case 'shake': r.addShake(e.a, 0.25 + e.a * 0.03); break;
            case 'break': fx.debris(e.x, e.z, e.type); break;
            case 'trail': { const f = w.fighters.find((o) => o.id === e.id); if (f) fx.trail(f, e.dur, f.team === 'player' ? (f.ally ? [1, 0.6, 0.8] : [0.3, 1, 1]) : [1, 0.3, 0.4]); break; }
            case 'warn': { const f = w.fighters.find((o) => o.id === e.id); if (f) fx.bang(f.x, f.y + f.h + 10, f.z); break; }
            case 'glint': { const f = w.fighters.find((o) => o.id === e.id); if (f) fx.glint(f.x + f.face * 30, f.y + 50, f.z); break; }
            case 'slashfx': fx.slash(e.x, e.z); break;
            case 'pickup': fx.pickup(e.x, e.z); break;
            case 'flashScreen': r.flashScreen(e.color, 0.65); break;
            case 'bossDown': r.flashScreen('white', 0.8); r.addShake(8, 0.8); r.aberr = 4; break;
            case 'odStart': r.aberr = 5; r.flashScreen('cyan', 0.4); break;
            case 'vanish': case 'appear': { const f = w.fighters.find((o) => o.id === e.id); if (f) for (let k = 0; k < 4; k++) fx.smokeAt(f.x + (Math.random() - 0.5) * 20, 20 + k * 12, f.z); break; }
            case 'steam': { const f = w.fighters.find((o) => o.id === e.id); if (f) for (let k = 0; k < 6; k++) fx.smokeAt(f.x + (Math.random() - 0.5) * 40, 80 + k * 10, f.z); break; }
            case 'weaponBreak': for (let k = 0; k < 5; k++) fx.spawn('deb1', e.x, e.y, e.z, { single: true, vx: (Math.random() - 0.5) * 200, vy: 100 + Math.random() * 100, grav: 600, life: 0.6, glow: 0 }); break;
            case 'projDie': if (e.type === 'pulse' || e.type === 'pulseR' || e.type === 'orb') fx.spawn('sparkE', e.x, e.y, e.z, { fps: 24 }); else if (e.type === 'acid') fx.spawn('dust', e.x, 0, e.z, { fps: 12 }); break;
            case 'respawn': fx.shock(w.player.x, w.player.z, 60, 'cyan'); break;
            case 'freeze': r.aberr = 3; break;
            default: break;
        }
    }

    frame(w, dt, extra = {}) {
        this.t += dt;
        const t = this.t;
        const lightning = this.stage && this.stage.lightning();
        const lf = lightning ? lightning.flash : 0;
        this.actors.ambient.set(this.ambientBase.x + lf * 0.8, this.ambientBase.y + lf * 0.8, this.ambientBase.z + lf);
        if (lf > 0.9) { this.r.flashScreen('white', 0.35); }
        const camX = w ? w.camX : (extra.camX || 0);
        if (this.stage) this.stage.update(dt, t, camX);
        if (w) this.actors.sync(w, dt, t);
        this.fx.update(dt, camX);
        const zMid = w ? (w.zMin + w.zMax) / 2 : 32;
        this.r.placeCamera(camX, zMid, dt);
        this.r.render(dt, t);
    }
}
