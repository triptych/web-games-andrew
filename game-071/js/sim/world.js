/**
 * world.js — the World: time, weather, the current space, actors and the event queue.
 *
 * Pure simulation. main.js calls tick(dt, input) at a fixed step and drains `events` once a
 * frame for the view, audio and UI.
 */
import { getTerrain } from './terrain.js';
import { Colliders } from './colliders.js';
import { ExteriorSpace, moveBody } from './physics.js';
import { Weather } from './weather.js';
import { Rng } from './rng.js';
import { regionAt, LOC, LOCATIONS } from './geography.js';
import { makeFlora, addFloraColliders } from './flora.js';

export const SPEED = { walk: 2.3, run: 4.9, sprint: 7.4, sneak: 1.9, sneakRun: 2.7, swim: 2.5, swimFast: 3.6, encumbered: 1.6 };
export const TIMESCALE = 20;   // game seconds per real second

export function makePlayer() {
    return {
        id: 'player', kind: 'player', name: 'Stranger',
        pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, r: 0.36, h: 1.78,
        yaw: 0, camYaw: 0, camPitch: 0,
        onGround: false, swim: false, wade: false, sneaking: false, sprinting: false, moving: 0,
        hp: 100, hpMax: 100, mp: 100, mpMax: 100, sp: 100, spMax: 100, spDelay: 0,
        third: false,
        stepDist: 0,
    };
}

export class World {
    constructor(opts = {}) {
        this.terrain = opts.terrain || getTerrain();
        this.colliders = new Colliders();
        this.ext = new ExteriorSpace(this.terrain, this.colliders);
        const keepOut = LOCATIONS.map((l) => ({ x: l.x, z: l.z, r: (l.flat || 30) + 6 }));
        this.flora = makeFlora(this.terrain, keepOut);
        addFloraColliders(this.flora, this.colliders);
        this.space = this.ext;
        this.cellId = 'ext';
        this.rng = new Rng(opts.seed ?? 12345);
        this.time = { hour: 8.5, day: 0, total: 8.5 };
        this.weather = new Weather(this.rng.fork(3));
        this.events = [];
        this.player = makePlayer();
        this.actors = [];
        this.timeScale = 1;
        this.region = 'pinewood';
        this.frozen = false;
    }

    emit(type, data = {}) {
        data.type = type;
        this.events.push(data);
        if (this.events.length > 800) this.events.splice(0, this.events.length - 800);
        return data;
    }

    drain() { const e = this.events; this.events = []; return e; }

    placePlayer(x, z, yaw = 0) {
        const p = this.player;
        p.pos.x = x; p.pos.z = z;
        p.pos.y = this.space.ground(x, z, 1e4);
        p.vel.x = p.vel.y = p.vel.z = 0;
        p.yaw = p.camYaw = yaw;
        p.onGround = true;
    }

    placeAt(locId, dx = 0, dz = 0) {
        const l = LOC[locId];
        this.placePlayer(l.x + dx, l.z + dz, 0);
    }

    hourAdvance(hours) {
        this.time.total += hours;
        this.time.hour = ((this.time.hour + hours) % 24 + 24) % 24;
        this.time.day = Math.floor(this.time.total / 24);
    }

    tick(dt, input) {
        const sdt = dt * this.timeScale;
        // time of day
        const dh = sdt * TIMESCALE / 3600;
        const prevHour = this.time.hour;
        this.hourAdvance(dh);
        if (Math.floor(prevHour) !== Math.floor(this.time.hour)) this.emit('hour', { hour: Math.floor(this.time.hour) });
        if (this.cellId === 'ext') this.region = regionAt(this.player.pos.x, this.player.pos.z);
        this.weather.update(dh, sdt, this.region, this.events);
        if (input) this.controlPlayer(dt, input);
    }

    controlPlayer(dt, inp) {
        const p = this.player;
        // look
        p.camYaw -= inp.look.dx;
        p.camPitch = Math.max(-1.45, Math.min(1.45, p.camPitch - inp.look.dy));
        if (inp.pressed.has('sneak')) p.sneaking = !p.sneaking;
        if (inp.pressed.has('camera')) p.third = !p.third;
        // movement relative to the camera
        let mx = inp.move.x, my = inp.move.y;
        const mag = Math.min(1, Math.hypot(mx, my));
        const sy = Math.sin(p.camYaw), cy = Math.cos(p.camYaw);
        // forward = (−sin, −cos), right = (cos, −sin)
        let wx = -sy * my + cy * mx, wz = -cy * my - sy * mx;
        const wl = Math.hypot(wx, wz);
        if (wl > 1e-4) { wx /= wl; wz /= wl; }
        const walk = inp.walk || (inp.device === 'touch' || inp.device === 'pad') && mag < 0.55;
        const canSprint = p.sp > 1 && !p.sneaking && my > 0.3;
        p.sprinting = !!inp.sprint && canSprint && mag > 0.2;
        let speed;
        if (p.swim) speed = p.sprinting ? SPEED.swimFast : SPEED.swim;
        else if (p.sprinting) speed = SPEED.sprint;
        else if (p.sneaking) speed = walk ? SPEED.sneak : SPEED.sneakRun;
        else speed = walk ? SPEED.walk : SPEED.run;
        if (p.encumbered) { speed = Math.min(speed, SPEED.encumbered); p.sprinting = false; }
        speed *= mag > 0.05 ? Math.max(0.35, mag) : 0;
        const jump = inp.pressed.has('jump') && !p.encumbered && p.sp > 5;
        if (jump && p.onGround) { p.sp -= 6; p.spDelay = 1; }
        const res = moveBody(p, { x: wx * speed, z: wz * speed, jump }, dt, this.space);
        if (res.landed > 4.5) {
            const dmg = Math.round((res.landed - 4.5) * (res.landed - 4.5) * 2.4);
            this.emit('fall', { dmg });
            p.hp -= dmg;
        }
        // facing: first person follows the camera; third person turns toward movement
        const hs = Math.hypot(p.vel.x, p.vel.z);
        p.moving = hs;
        if (!p.third || p.aiming) p.yaw = p.camYaw;
        else if (hs > 0.5) {
            const target = Math.atan2(-p.vel.x, -p.vel.z);
            let d = target - p.yaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            p.yaw += d * Math.min(1, dt * 10);
        }
        // stamina
        if (p.sprinting && hs > 1) { p.sp = Math.max(0, p.sp - 7 * dt); p.spDelay = 1.2; }
        p.spDelay -= dt;
        if (p.spDelay <= 0) p.sp = Math.min(p.spMax, p.sp + p.spMax * 0.05 * dt * 2);
        p.mp = Math.min(p.mpMax, p.mp + p.mpMax * 0.03 * dt);
        p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.007 * dt);
        // footsteps
        if (p.onGround && hs > 0.4) {
            p.stepDist += hs * dt;
            const stride = p.sprinting ? 2.1 : p.sneaking ? 1.1 : 1.6;
            if (p.stepDist > stride) { p.stepDist = 0; this.emit('step', { actor: p, surface: this.surfaceAt(p.pos.x, p.pos.z), sneak: p.sneaking }); }
        }
    }

    /** grass, snow, stone, wood, dirt, water */
    surfaceAt(x, z) {
        if (this.cellId !== 'ext') return this.space.surface || 'stone';
        const T = this.terrain;
        if (this.player.wade) return 'water';
        if (this.space.onPlatform && this.space.onPlatform(x, z, this.player.pos.y)) return 'wood';
        if (T.maskAt(x, z, 1) > 0.5) return 'snow';
        if (T.maskAt(x, z, 2) > 0.5) return 'dirt';
        if (T.slopeAt(x, z) > 0.35) return 'stone';
        return 'grass';
    }
}
