/**
 * monsters.js — live monsters: AI, attacks, damage and death.
 *
 * States: idle → (sees/hears you) → chase ⇄ windup → attack → chase
 *         any → pain (short flinch) | stagger (low HP: glowing, open to an
 *         Arc Blade execution) | dying → corpse
 *         spawning (ambushes and summons fade in through a portal)
 *
 * Movement: straight at the target when there's line of sight, otherwise
 * down the world's flow field (Dijkstra from the player's cell). Bodies are
 * DOOM squares; fliers ignore steps and hold an altitude. Monsters open
 * unlocked doors, push each other apart, and turn on each other when one
 * shoots another (infighting).
 */
import * as THREE from 'three';
import { ARCHETYPES, ELITE_MODS, PROJECTILES } from './bestiary.js';
import { instantiate, animate, muzzleWorld } from './models.js';
import { CELL, STEP } from '../config.js';
import { voice, sfx } from '../audio.js';
import { glowMaterial, GLOW_GEO } from '../render/materials.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();
let uid = 1;

export class Monster {
    constructor(S, opts) {
        const A = ARCHETYPES[opts.arch];
        this.S = S;
        this.id = uid++;
        this.arch = opts.arch;
        this.A = A;
        this.sp = S.species[opts.arch];
        this.boss = !!A.boss || !!opts.boss;
        this.elite = opts.elite >= 0 ? ELITE_MODS[opts.elite] : null;
        const d = S.diff;
        const em = this.elite ?? { hp: 1, dmg: 1, speed: 1 };
        this.maxHp = Math.round(A.hp * this.sp.hpMul * (this.boss ? 1 : d.hp) * em.hp * (opts.hpMul ?? 1));
        this.hp = this.maxHp;
        this.dmgMul = d.dmg * em.dmg * (opts.dmgMul ?? 1);
        this.speed = A.speed * this.sp.speedMul * d.speed * em.speed;
        this.r = Math.min(A.radius, 0.92);
        this.h = A.height;
        this.fly = !!A.fly;
        this.static = !!A.static;
        this.x = opts.x; this.z = opts.z;
        const cell = S.world.cellAt(this.x, this.z);
        this.floorY = S.world.L.floor[cell] ?? 0;
        this.y = this.fly ? this.floorY + (A.hover ?? 1.5) : this.floorY;
        this.vy = 0;
        this.yaw = opts.angle ?? 0;
        this.state = opts.spawning ? 'spawning' : 'idle';
        this.stateT = 0;
        this.awake = !!opts.awake;
        this.target = null;
        this.cool = rnd(0.5, 1.5);
        this.meleeCool = 0;
        this.losT = Math.random() * 0.25;
        this.hasLos = false;
        this.dist = 99;
        this.walk = Math.random() * 6;
        this.moveAmt = 0;
        this.attackPose = 0;
        this.painT = 0;
        this.hit = 0;
        this.deadT = 0;
        this.zone = opts.zone ?? 0;
        this.ambush = !!opts.ambush;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = rnd(1, 3);
        this.infight = null;
        this.infightT = 0;
        this.idleVoiceT = rnd(4, 12);
        this.counted = opts.counted !== false;
        this.raised = 0;
        this.phase = 0;
        this.shielded = false;
        this.lunge = null;
        this.flame = null;
        this.beam = null;
        this.burst = null;

        const tintVec = this.elite ? this.elite.tint : null;
        this.model = instantiate(this.sp, { tintVec });
        this.model.mat.uniforms.uRim.value = this.boss ? 0.55 : 0.5;
        this.root = this.model.root;
        this.root.userData.monster = this;
        S.scene.add(this.root);
        this._place();
        if (this.state === 'spawning') this.model.mat.uniforms.uDissolve.value = 1;
        if (this.elite) {
            // a halo under elites so you can spot them
            this.aura = new THREE.Mesh(GLOW_GEO, glowMaterial(new THREE.Color(...this.elite.tint).multiplyScalar(0.5), 0x000000, 0.7, 1.4));
            this.aura.scale.setScalar(this.h * 1.4);
            this.root.add(this.aura);
            this.aura.position.y = this.h * 0.5;
        }
    }

    get cx() { return this.x; }
    get cy() { return this.y + this.h * 0.55; }
    get cz() { return this.z; }
    get alive() { return this.state !== 'dead' && this.state !== 'dying'; }

    _place() {
        const off = this.fly ? (this.model.tpl.plan === 'orb' || this.model.tpl.plan === 'skull' ? this.h * 0.5 : 0) : 0;
        this.root.position.set(this.x, this.y + off, this.z);
        this.root.rotation.y = this.yaw;
    }

    wake(target) {
        if (this.static) return;
        if (!this.awake) {
            this.awake = true;
            this.cool = rnd(...this.A.reaction);
            voice(this.sp.voice, 'sight', { x: this.x, y: this.cy, z: this.z });
            this.S.onSight?.(this);
        }
        if (target) this.target = target;
    }

    // ------------------------------------------------------------------ update

    update(dt) {
        const S = this.S;
        this.stateT += dt;
        this.hit = Math.max(0, this.hit - dt * 6);
        this.painT = Math.max(0, this.painT - dt);
        this.model.mat.uniforms.uHit.value = this.hit;

        if (this.state === 'dying' || this.state === 'dead') { this._updateDead(dt); return; }
        if (S.demo) { this.walk += dt * (Math.sin(S.time * 0.3 + this.id) > 0.3 ? 2 : 0); this._anim(dt); return; }
        if (this.state === 'spawning') {
            const k = Math.min(1, this.stateT / 0.9);
            this.model.mat.uniforms.uDissolve.value = 1 - k;
            if (k >= 1) { this.state = 'chase'; this.stateT = 0; this.wake(S.player); }
            this._anim(dt);
            return;
        }
        if (this.static) { this._anim(dt); return; }

        const P = S.player;
        // choose a target
        if (this.infight && (!this.infight.alive || (this.infightT -= dt) <= 0)) this.infight = null;
        const T = this.infight ?? P;
        this.target = T;
        const tx = T.x, tz = T.z, ty = T === P ? P.eyeY - 0.3 : T.cy;
        const dx = tx - this.x, dz = tz - this.z;
        this.dist = Math.hypot(dx, dz);

        // senses, throttled
        this.losT -= dt;
        if (this.losT <= 0) {
            this.losT = 0.2 + Math.random() * 0.1;
            const eyeY = this.y + this.h * 0.8;
            this.hasLos = this.dist < 60 && S.world.los(this.x, eyeY, this.z, tx, ty, tz);
            if (!this.awake && this.hasLos && this.dist < this.A.sight && P.alive) {
                // must be roughly in front unless very close; cloak halves sight
                const fwd = Math.atan2(dx, dz) - this.yaw;
                const facing = Math.cos(fwd) > -0.2 || this.dist < 6;
                const sight = this.A.sight * (P.powers.cloak > 0 ? 0.35 : 1);
                if (facing && this.dist < sight) this.wake(P);
            }
        }
        if (!this.awake) {
            this.idleVoiceT -= dt;
            this._anim(dt);
            return;
        }
        if (T === P && !P.alive) { this._wander(dt); this._anim(dt); return; }

        // idle grumbles
        this.idleVoiceT -= dt;
        if (this.idleVoiceT <= 0) { this.idleVoiceT = rnd(5, 12); if (this.dist < 25) voice(this.sp.voice, 'idle', { x: this.x, y: this.cy, z: this.z }, !this.hasLos); }

        this.cool -= dt * (S.diff.aggro ?? 1);
        this.meleeCool -= dt;

        // ongoing specials
        if (this.lunge) { this._updateLunge(dt); this._anim(dt); return; }
        if (this.flame) this._updateFlame(dt);
        if (this.beam) this._updateBeam(dt);
        if (this.burst) this._updateBurst(dt);
        if (this.boss) this._bossPhase();

        if (this.state === 'pain') {
            if (this.stateT > 0.28) this._setState('chase');
            this._anim(dt);
            return;
        }
        if (this.state === 'stagger') {
            if (this.stateT > 3.2) this._setState('chase');
            this.model.mat.uniforms.uHit.value = 0.25 + 0.25 * Math.sin(this.stateT * 12);
            this._anim(dt);
            return;
        }
        if (this.state === 'windup') {
            this._face(dt, Math.atan2(dx, dz), 8);
            this.attackPose = Math.min(1, this.attackPose + dt * 4);
            if (this.stateT >= this.atk.windup) this._fire(this.atk);
            this._anim(dt);
            return;
        }
        if (this.state === 'recover') {
            this.attackPose = Math.max(0, this.attackPose - dt * 3);
            if (this.stateT > 0.35) this._setState('chase');
            this._anim(dt);
            return;
        }

        // ---- chase
        this.attackPose = Math.max(0, this.attackPose - dt * 3);
        // melee
        const M = this.A.melee;
        if (M && this.dist < M.reach + (T.r ?? 0.4) && this.meleeCool <= 0 && Math.abs((T.y ?? 0) - this.y) < 2.2) {
            this.meleeCool = M.cooldown;
            this.attackPose = 1;
            voice(this.sp.voice, 'attack', { x: this.x, y: this.cy, z: this.z });
            this._hurtTarget(T, rnd(...M.dmg), [dx / (this.dist || 1), 0, dz / (this.dist || 1)], 'melee');
        }
        // ranged
        if (this.hasLos && this.cool <= 0) {
            const usable = this.A.attacks.filter((a) => this.dist <= a.range && (a.kind !== 'slam' || this.dist < a.range) && (a.kind !== 'lunge' || this.dist > 2.5));
            if (usable.length) {
                const pick = usable[Math.floor(Math.random() * usable.length)];
                if (pick.kind === 'flame' && this.flame) { this.cool = 0.5; }
                else {
                    this.atk = pick;
                    this._setState('windup');
                    if (pick.kind === 'flame') this.flame = { t: 0, x: P.x, z: P.z };
                    if (pick.kind !== 'hitscan') voice(this.sp.voice, 'attack', { x: this.x, y: this.cy, z: this.z });
                    this._anim(dt);
                    return;
                }
            }
        }
        // hierophant: raise the dead
        if (this.A.raises && this.cool <= 0.4 && Math.random() < dt * 0.6) this._tryRaise();

        this._move(dt, T, dx, dz);
        this._anim(dt);
    }

    _setState(s) { this.state = s; this.stateT = 0; }

    _face(dt, want, rate = 6) {
        let d = want - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    }

    _move(dt, T, dx, dz) {
        const S = this.S, W = S.world;
        let mx = 0, mz = 0;
        const pref = this._preferredRange();
        if (this.hasLos && this.dist < 40) {
            const nd = this.dist || 1;
            let f = this.dist > pref ? 1 : this.dist < pref * 0.5 ? -0.6 : 0;
            if (this.A.melee && !this.A.attacks.some((a) => a.kind === 'proj' || a.kind === 'hitscan' || a.kind === 'homing')) f = 1;
            this.strafeT -= dt;
            if (this.strafeT <= 0) { this.strafeT = rnd(0.8, 2.6); this.strafe = -this.strafe; }
            const st = this.boss ? 0.6 : 0.45;
            mx = (dx / nd) * f + (-dz / nd) * this.strafe * st;
            mz = (dz / nd) * f + (dx / nd) * this.strafe * st;
        } else {
            // follow the flow field
            const c = W.cellAt(this.x, this.z);
            const nx = W.flowStep(c, this.fly);
            if (nx >= 0) {
                const [cx, cz] = W.cellCenter(nx);
                const ddx = cx - this.x, ddz = cz - this.z;
                const l = Math.hypot(ddx, ddz) || 1;
                mx = ddx / l; mz = ddz / l;
            } else if (this.hasLos) {
                const nd = this.dist || 1;
                mx = dx / nd; mz = dz / nd;
            }
        }
        // separation from other monsters
        for (const o of S.monsters) {
            if (o === this || !o.alive || o.static && false) continue;
            const ox = this.x - o.x, oz = this.z - o.z;
            const d2 = ox * ox + oz * oz, min = this.r + o.r;
            if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2); mx += (ox / d) * 0.8; mz += (oz / d) * 0.8; }
        }
        const ml = Math.hypot(mx, mz);
        let sp = this.speed * (this.state === 'stagger' ? 0.3 : 1);
        if (ml > 0.01) {
            mx /= ml; mz /= ml;
            const step = sp * dt;
            const res = W.move(this, mx * step, mz * step, this.fly ? 99 : STEP, this.fly);
            if (res.bumped !== null && res.bumped >= 0) {
                if (W.L.door[res.bumped] >= 0) W.openDoor(res.bumped, 'monster');
                else if (res.hitX && res.hitZ) this.strafe = -this.strafe;
            }
            this._face(dt, Math.atan2(mx, mz), 7);
            this.moveAmt = Math.min(1, this.moveAmt + dt * 4);
            this.walk += dt * sp * (this.A.plan === 'quad' ? 1.3 : 2.4);
        } else {
            this.moveAmt = Math.max(0, this.moveAmt - dt * 4);
            if (this.hasLos) this._face(dt, Math.atan2(dx, dz), 6);
        }
        // don't walk into the player
        const P = S.player;
        const px = this.x - P.x, pz = this.z - P.z, pd = Math.hypot(px, pz), pmin = this.r + P.r;
        if (pd < pmin && pd > 1e-4 && Math.abs(P.y - this.y) < this.h) W.move(this, (px / pd) * (pmin - pd), (pz / pd) * (pmin - pd), this.fly ? 99 : STEP, this.fly);
        this._vertical(dt);
        this._place();
    }

    _preferredRange() {
        if (this.A.melee && this.A.attacks.every((a) => a.kind === 'lunge' || a.kind === 'charge')) return 0;
        if (this.boss) return 12;
        if (this.arch === 'hierophant') return 14;
        if (this.A.melee) return 3;
        return 9 + (this.id % 5);
    }

    _vertical(dt) {
        const W = this.S.world;
        const ground = W.groundUnder(this.x, this.z, this.r);
        if (this.fly) {
            const P = this.S.player;
            const want = Math.max(ground + 0.4, Math.min(W.ceilOver(this.x, this.z, this.r) - this.h - 0.2, (this.target?.y ?? P.y) + (this.A.hover ?? 1.5) + Math.sin(this.S.time * 1.3 + this.id) * 0.4));
            this.y += (want - this.y) * Math.min(1, dt * 1.6);
        } else {
            if (this.y > ground + 0.01) { this.vy -= 26 * dt; this.y = Math.max(ground, this.y + this.vy * dt); }
            else { this.y += (ground - this.y) * Math.min(1, dt * 14); this.vy = 0; }
        }
        this.floorY = ground;
    }

    _wander(dt) {
        this.moveAmt = Math.max(0, this.moveAmt - dt * 2);
        this.yaw += Math.sin(this.S.time * 0.3 + this.id) * dt * 0.5;
        this._place();
    }

    _anim(dt) {
        const tpl = this.model.tpl;
        animate(this.model, {
            t: this.S.time + this.id * 1.7, walk: this.walk, move: this.moveAmt, attack: this.attackPose,
            pain: this.painT > 0 ? this.painT / 0.3 : 0, dead: 0, fly: this.fly,
            spin: this.arch === 'overseer' && (this.burst || this.state === 'windup') ? dt * 30 : 0,
        });
        if (this.fly && !this.alive) return;
        void tpl;
    }

    // ------------------------------------------------------------------ attacks

    _fire(a) {
        const S = this.S;
        const T = this.target ?? S.player;
        this._setState('recover');
        this.cool = rnd(...a.cooldown);
        this.attackPose = 1;
        const muzzle = this._muzzle(a);
        const aimY = T === S.player ? S.player.eyeY - 0.35 : T.cy;
        const occluded = !this.hasLos;
        switch (a.kind) {
            case 'hitscan': {
                const shots = a.shots ?? 1;
                if (a.burst) this.burst = { a, left: shots, t: 0, muzzle };
                else for (let k = 0; k < shots; k++) this._hitscanShot(a, muzzle, T, aimY);
                sfx.mAttack('hitscan', { x: this.x, y: this.cy, z: this.z }, occluded);
                break;
            }
            case 'proj': case 'homing': {
                const vol = a.volley ?? 1;
                if (vol > 1 || a.burst) this.burst = { a, left: a.burst ? a.count : vol, t: 0, muzzle };
                else this._volley(a, muzzle, T, aimY);
                sfx.mAttack(a.kind === 'homing' ? 'missile' : a.proj === 'rocket' ? 'rocket' : a.proj, { x: this.x, y: this.cy, z: this.z }, occluded);
                break;
            }
            case 'lunge': {
                const d = Math.hypot(T.x - this.x, T.z - this.z) || 1;
                this.lunge = { dx: (T.x - this.x) / d, dz: (T.z - this.z) / d, t: 0, hit: false, a };
                sfx.mAttack('charge', { x: this.x, y: this.cy, z: this.z });
                break;
            }
            case 'charge': {
                const dx = T.x - this.x, dy = aimY - this.cy, dz = T.z - this.z;
                const d = Math.hypot(dx, dy, dz) || 1;
                this.lunge = { dx: dx / d, dy: dy / d, dz: dz / d, t: 0, hit: false, a, fly: true };
                sfx.mAttack('charge', { x: this.x, y: this.cy, z: this.z });
                break;
            }
            case 'slam': {
                S.fx.flashes.ring(this.x, this.floorY, this.z, 0xff9a3a, a.radius, 0.5);
                S.fx.explosion(this.x, this.floorY + 0.3, this.z, 0.6, 0xff7a2a);
                sfx.mAttack('slam', { x: this.x, y: this.y, z: this.z });
                S.radiusDamage(this.x, this.floorY + 0.5, this.z, a.radius, rnd(...a.dmg) * this.dmgMul, this, { noSelf: true, knock: 9 });
                break;
            }
            case 'flame': {
                if (this.flame && this.hasLos) {
                    S.fx.explosion(this.flame.x, S.player.y + 0.8, this.flame.z, 0.9, 0xff8a2a);
                    S.radiusDamage(this.flame.x, S.player.y + 0.8, this.flame.z, a.radius, rnd(...a.dmg) * this.dmgMul, this, { noSelf: true, knock: 6, up: 9 });
                    sfx.explosion({ x: this.flame.x, y: S.player.y, z: this.flame.z }, 0.8);
                }
                this.flame = null;
                break;
            }
            case 'birth': {
                const n = Math.min(3, 24 - S.monsters.filter((m) => m.alive).length);
                for (let k = 0; k < n; k++) {
                    const ang = this.yaw + (k - 1) * 0.9 + rnd(-0.3, 0.3);
                    const sx = this.x + Math.sin(ang) * (this.r + 2.5), sz = this.z + Math.cos(ang) * (this.r + 2.5);
                    const c = S.world.cellAt(sx, sz);
                    if (c < 0 || !S.world.L.open[c]) continue;
                    S.spawnMonster(a.spawn[k % a.spawn.length], sx, sz, { spawning: true, awake: true, counted: false, hpMul: 0.7 });
                }
                sfx.mAttack('birth', { x: this.x, y: this.cy, z: this.z });
                break;
            }
            case 'wave': {
                S.shockwave(this.x, this.floorY, this.z, a.range, rnd(...a.dmg) * this.dmgMul, this);
                sfx.mAttack('wave', { x: this.x, y: this.y, z: this.z });
                break;
            }
            case 'beam': {
                const P = S.player;
                this.beam = { t: 0, time: a.time, a, aim: new THREE.Vector3(P.x, P.eyeY - 0.4, P.z), dmgAcc: 0 };
                sfx.mAttack('beam', { x: this.x, y: this.cy, z: this.z });
                break;
            }
        }
    }

    _muzzle(a) {
        const names = this.model.tpl.muzzles;
        let name = 'gun';
        if (a.kind === 'homing' && names.launchL) name = Math.random() < 0.5 ? 'launchL' : 'launchR';
        else if (a.kind === 'proj' && a.proj === 'rocket' && names.launchL && this.arch === 'overseer') name = Math.random() < 0.5 ? 'launchL' : 'launchR';
        else if (names.mouth && (this.arch === 'gazer' || this.arch === 'wisp' || this.arch === 'hound' || this.arch === 'mother')) name = 'mouth';
        else if (names.hand && (this.arch === 'imp' || this.arch === 'hierophant' || this.arch === 'archon')) name = Math.random() < 0.5 || !names.handL ? 'hand' : 'handL';
        else if (names.eye && this.arch === 'archon') name = 'eye';
        else if (!names.gun) name = Object.keys(names)[0];
        return muzzleWorld(this.model, name, new THREE.Vector3());
    }

    _hitscanShot(a, muzzle, T, aimY) {
        const S = this.S;
        let spread = a.spread * (Math.PI / 180) * (T === S.player && S.player.powers.cloak > 0 ? 3 : 1);
        const dx = T.x - muzzle.x, dy = aimY - muzzle.y, dz = T.z - muzzle.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const yaw = Math.atan2(dx, dz) + rnd(-spread, spread);
        const pitch = Math.asin(dy / d) + rnd(-spread, spread) * 0.6;
        const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
        S.monsterHitscan(this, muzzle, dir, a.range + 10, rnd(...a.dmg) * this.dmgMul);
    }

    _volley(a, muzzle, T, aimY) {
        const S = this.S;
        const P = PROJECTILES[a.proj];
        const n = a.burst ? 1 : (a.count ?? 1);
        const speed = a.speed * (S.diff.speed > 1.1 ? 1.25 : 1);
        // lead the target a little on harder difficulties
        let tx = T.x, tz = T.z;
        if (T === S.player && S.diff.aggro > 1) {
            const d = Math.hypot(tx - muzzle.x, tz - muzzle.z);
            const tt = d / speed * 0.5;
            tx += S.player.vx * tt; tz += S.player.vz * tt;
        }
        const dx = tx - muzzle.x, dy = aimY - muzzle.y, dz = tz - muzzle.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const baseYaw = Math.atan2(dx, dz), pitch = Math.asin(dy / d);
        const spreadR = (a.spread ?? 0) * Math.PI / 180;
        for (let k = 0; k < n; k++) {
            let yaw = baseYaw;
            if (a.ring) yaw = baseYaw + (k / n) * Math.PI * 2;
            else if (n > 1) yaw = baseYaw + (k / (n - 1) - 0.5) * spreadR;
            else yaw += rnd(-spreadR, spreadR) * 0.5;
            const pp = a.ring ? pitch * 0.3 : pitch;
            const dir = [Math.sin(yaw) * Math.cos(pp), Math.sin(pp), Math.cos(yaw) * Math.cos(pp)];
            S.spawnProjectile(a.proj, muzzle.x, muzzle.y, muzzle.z, dir, speed, rnd(...a.dmg) * this.dmgMul, this, {
                splash: (a.splash ?? 0) * this.dmgMul, radius: a.radius ?? 0, homing: a.kind === 'homing' ? (P.homing ?? 2) : 0, target: T,
            });
        }
    }

    _updateBurst(dt) {
        const b = this.burst;
        b.t -= dt;
        if (b.t > 0) return;
        const a = b.a;
        b.t = a.burst ?? a.volleyGap ?? 0.1;
        const T = this.target ?? this.S.player;
        const aimY = T === this.S.player ? this.S.player.eyeY - 0.35 : T.cy;
        const muzzle = this._muzzle(a);
        this.attackPose = 1;
        if (a.kind === 'hitscan') { this._hitscanShot(a, muzzle, T, aimY); if (b.left % 2 === 0) sfx.mAttack('hitscan', { x: this.x, y: this.cy, z: this.z }); }
        else { this._volley(a, muzzle, T, aimY); if (a.volley) sfx.mAttack(a.proj === 'rocket' ? 'rocket' : a.proj, { x: this.x, y: this.cy, z: this.z }); }
        if (a.kind === 'hitscan') this.S.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, 0xffc070, 0.5);
        b.left--;
        if (b.left <= 0) this.burst = null;
    }

    _updateLunge(dt) {
        const L = this.lunge;
        const S = this.S;
        L.t += dt;
        const sp = L.a.speed ?? this.speed * 2.6;
        const step = sp * dt;
        if (L.fly) {
            const res = S.world.move(this, L.dx * step, L.dz * step, 99, true);
            this.y += (L.dy ?? 0) * step;
            const g = S.world.groundUnder(this.x, this.z, this.r);
            if (this.y < g + 0.2) this.y = g + 0.2;
            if (res.hitX || res.hitZ) L.t = 99;
        } else {
            const res = S.world.move(this, L.dx * step, L.dz * step, STEP, false);
            if (res.hitX || res.hitZ) L.t = 99;
            this.moveAmt = 1; this.walk += dt * 14;
        }
        this.attackPose = 1;
        this._face(dt, Math.atan2(L.dx, L.dz), 10);
        const T = this.target ?? S.player;
        const hd = Math.hypot(T.x - this.x, T.z - this.z);
        if (!L.hit && hd < this.r + (T.r ?? 0.4) + 0.4 && Math.abs((T === S.player ? S.player.y + 0.9 : T.cy) - this.cy) < 1.8) {
            L.hit = true;
            this._hurtTarget(T, rnd(...L.a.dmg) * (this.boss ? 1 : 1), [L.dx, 0, L.dz], 'lunge');
            if (L.fly) { L.t = 99; this.x -= L.dx * 0.8; this.z -= L.dz * 0.8; }
        }
        if (L.t > (L.fly ? 1.2 : 0.55)) { this.lunge = null; this._setState('recover'); }
        this._place();
        if (this.fly) this.S.fx.trail(this.x, this.cy, this.z, 'fire');
    }

    _updateFlame(dt) {
        const F = this.flame;
        const P = this.S.player;
        F.t += dt;
        // the fire tracks you during the windup
        F.x += (P.x - F.x) * Math.min(1, dt * 6);
        F.z += (P.z - F.z) * Math.min(1, dt * 6);
        if (Math.random() < 0.8) this.S.fx.fire(F.x + rnd(-0.4, 0.4), P.y + rnd(0, 0.4), F.z + rnd(-0.4, 0.4), 1.4);
        this.S.R.light(F.x, P.y + 1, F.z, 0xff7a2a, 6, 1.4, 2);
        if (this.state !== 'windup' && this.state !== 'recover') this.flame = null;
    }

    _updateBeam(dt) {
        const B = this.beam;
        const S = this.S, P = S.player;
        B.t += dt;
        // the beam sweeps after you at a limited rate
        _v.set(P.x, P.eyeY - 0.4, P.z);
        const lag = Math.min(1, dt * 1.8);
        B.aim.lerp(_v, lag);
        const eye = muzzleWorld(this.model, 'eye', new THREE.Vector3());
        const dx = B.aim.x - eye.x, dy = B.aim.y - eye.y, dz = B.aim.z - eye.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const hit = S.world.raycast(eye.x, eye.y, eye.z, dx / d, dy / d, dz / d, 80);
        const end = [hit.x, hit.y, hit.z];
        const k = Math.min(1, B.t * 3);
        S.fx.beams.add([eye.x, eye.y, eye.z], end, 0xb080ff, 0.35 * k, 0.05);
        S.fx.beams.add([eye.x, eye.y, eye.z], end, 0xffffff, 0.1 * k, 0.05);
        S.R.light(hit.x - (dx / d), hit.y, hit.z - (dz / d), 0xb080ff, 8, 2.5, 3);
        if (Math.random() < 0.6) S.fx.sparks(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 3, [0.8, 0.6, 1]);
        // does the beam pass through the player?
        const px = P.x - eye.x, py = P.eyeY - 0.6 - eye.y, pz = P.z - eye.z;
        const t = (px * dx + py * dy + pz * dz) / d;
        if (t > 0 && t < hit.t) {
            const cx = eye.x + dx / d * t, cy = eye.y + dy / d * t, cz = eye.z + dz / d * t;
            const miss = Math.hypot(P.x - cx, (P.eyeY - 0.6) - cy, P.z - cz);
            if (miss < 0.75) {
                B.dmgAcc += dt * B.a.dmg[0] * this.dmgMul;
                if (B.dmgAcc > 6) { S.damagePlayer(B.dmgAcc, this, [dx / d, 0, dz / d]); B.dmgAcc = 0; }
            }
        }
        if (B.t > B.time) this.beam = null;
    }

    _tryRaise() {
        const S = this.S;
        const corpse = S.monsters.find((m) => m.state === 'dead' && !m.boss && !m.gibbed && m.raised < 2 && m.arch !== 'hierophant' && m.arch !== 'pylon' && Math.hypot(m.x - this.x, m.z - this.z) < 14 && S.world.los(this.x, this.cy, this.z, m.x, m.y + 0.5, m.z));
        if (!corpse) return;
        corpse.resurrect();
        this.cool = 3;
        this.attackPose = 1;
        S.fx.beams.add([this.x, this.cy + 0.5, this.z], [corpse.x, corpse.y + 0.6, corpse.z], 0xffd040, 0.12, 0.7, 6);
        voice(this.sp.voice, 'attack', { x: this.x, y: this.cy, z: this.z });
    }

    _bossPhase() {
        const S = this.S;
        const f = this.hp / this.maxHp;
        if (this.arch === 'archon') {
            if (this.phase === 0 && f < 0.66) { this.phase = 1; S.archonShield(this); }
            else if (this.phase === 1 && !this.shielded && f < 0.33) { this.phase = 2; S.archonShield(this); }
        }
        if (this.arch === 'mother' && this.phase === 0 && f < 0.5) { this.phase = 1; this.speed *= 1.4; this.cool = 0; }
        if (this.arch === 'overseer' && this.phase === 0 && f < 0.5) { this.phase = 1; this.speed *= 1.3; S.message('OVERSEER KELL: OVERRIDE ENGAGED'); }
    }

    _hurtTarget(T, dmg, dir, kind) {
        const S = this.S;
        if (T === S.player) {
            const dealt = S.damagePlayer(dmg * (kind === 'melee' || kind === 'lunge' ? this.dmgMul : 1), this, dir);
            if (this.elite?.id === 'vampiric' && dealt > 0) this.hp = Math.min(this.maxHp, this.hp + dealt * 2);
        } else if (T.alive) {
            S.damageMonster(T, dmg, this, { dir });
        }
    }

    // ------------------------------------------------------------------ damage

    damage(amount, source, opts = {}) {
        if (!this.alive || this.state === 'spawning') return 0;
        if (this.shielded) {
            this.S.fx.sparks(this.x, this.cy, this.z, 0, 1, 0, 3, [0.7, 0.5, 1]);
            return 0;
        }
        if (this.elite?.id === 'armored' && opts.splash) amount *= 0.5;
        this.hp -= amount;
        this.hit = 1;
        const S = this.S;
        if (source && source !== S.player && source instanceof Monster && source !== this && source.arch !== this.arch && !this.boss) {
            this.infight = source; this.infightT = 6;
        }
        if (source === S.player || !this.awake) this.wake(S.player);
        if (opts.dir && !this.boss && !this.static) {
            const kb = Math.min(4, amount / (this.A.heavy ? 200 : 40)) * (opts.knock ?? 1);
            S.world.move(this, opts.dir[0] * kb * 0.3, opts.dir[2] * kb * 0.3, STEP, this.fly);
        }
        if (this.hp <= 0) { this.die(amount, source, opts); return amount; }
        // stagger at low health: open to an execution
        if (!this.boss && !this.static && this.hp < this.maxHp * 0.22 && this.state !== 'stagger' && Math.random() < 0.55 && this.arch !== 'wisp') {
            this._setState('stagger');
            this.burst = null; this.lunge = null; this.flame = null;
            return amount;
        }
        if (Math.random() < this.A.painChance && this.state !== 'stagger' && amount > 4) {
            this.painT = 0.3;
            if (this.state === 'windup' && !this.boss) this._setState('pain');
            else if (this.state === 'chase') this._setState('pain');
            voice(this.sp.voice, 'pain', { x: this.x, y: this.cy, z: this.z });
        }
        return amount;
    }

    die(overkill, source, opts = {}) {
        const S = this.S;
        this.state = 'dying'; this.stateT = 0;
        this.burst = null; this.lunge = null; this.flame = null; this.beam = null;
        this.fallBack = Math.random() < 0.5;
        voice(this.sp.voice, 'death', { x: this.x, y: this.cy, z: this.z });
        const gib = !this.boss && !this.static && (opts.splash || opts.kind === 'rail' || opts.kind === 'execute') && -this.hp > this.maxHp * 0.6;
        if (gib) {
            this.gibbed = true;
            S.fx.gibs(this.x, this.y + this.h * 0.4, this.z, this.A.blood, Math.round(10 + this.h * 4), 7);
            S.fx.bloodSplat(this.x, this.z, this.floorY, this.A.blood, 2.2);
            sfx.gib({ x: this.x, y: this.cy, z: this.z });
            this.root.visible = false;
        } else {
            S.fx.blood(this.x, this.cy, this.z, this.A.blood, 14);
            S.fx.bloodSplat(this.x, this.z, this.floorY, this.A.blood, 1.6);
        }
        if (this.aura) this.aura.visible = false;
        S.onKill(this, source, opts);
        if (this.elite?.id === 'burning') {
            S.fx.explosion(this.x, this.cy, this.z, 0.9, 0xff6a1a);
            S.radiusDamage(this.x, this.cy, this.z, 4, 60, this, { noSelf: true });
            sfx.explosion({ x: this.x, y: this.cy, z: this.z }, 0.8);
        }
        if (this.elite?.id === 'splitting') {
            for (let k = 0; k < 3; k++) S.spawnMonster('wisp', this.x + rnd(-1, 1), this.z + rnd(-1, 1), { spawning: true, awake: true, counted: false, hpMul: 0.6 });
        }
    }

    resurrect() {
        this.state = 'spawning'; this.stateT = 0;
        this.hp = this.maxHp;
        this.raised++;
        this.root.visible = true;
        this.settled = false;
        this.model.mat.uniforms.uDissolve.value = 1;
        this.model.body.rotation.set(0, 0, 0);
        this.model.body.position.y = 0;
        this.counted = false;
        this.S.fx.teleport(this.x, this.y, this.z, 0xffd040);
        sfx.teleport({ x: this.x, y: this.y, z: this.z });
        this.awake = true;
    }

    _updateDead(dt) {
        if (this.gibbed) { this.state = 'dead'; return; }
        if (this.state === 'dead' && this.settled) {
            // corpses fade after a long while
            if (this.stateT > 40 && this.arch !== 'pylon') this.model.mat.uniforms.uDissolve.value = Math.min(1, (this.stateT - 40) / 2);
            return;
        }
        if (this.state === 'dead' && !this.boss) this.settled = !this.fly || this.y <= this.floorY + 0.01;
        const k = Math.min(1, this.stateT / (this.fly ? 0.7 : 0.6));
        if (this.fly) {
            // fall
            const g = this.S.world.groundUnder(this.x, this.z, this.r);
            this.floorY = g;
            if (this.y > g) { this.vy -= 22 * dt; this.y = Math.max(g, this.y + this.vy * dt); }
            this._place();
        }
        animate(this.model, { t: this.S.time, walk: this.walk, move: 0, attack: 0, pain: 0, dead: k, fly: this.fly, fallBack: this.fallBack, fallSide: this.id % 2 ? 1 : -1 });
        if (this.boss || this.arch === 'wisp' || this.arch === 'pylon') {
            // these burn away
            this.model.mat.uniforms.uDissolve.value = Math.min(1, this.stateT / (this.boss ? 3.5 : 1.0));
            if (this.arch === 'wisp' && this.stateT < 0.1) this.S.fx.explosion(this.x, this.cy, this.z, 0.4, 0xff8a2a);
        }
        if (k >= 1 && this.state === 'dying' && !this.boss) this.state = 'dead';
        if (this.boss && this.stateT > 3.6) this.state = 'dead';
        // corpses fade after a long while
        if (this.state === 'dead' && this.stateT > 40 && this.arch !== 'pylon') {
            this.model.mat.uniforms.uDissolve.value = Math.min(1, (this.stateT - 40) / 2);
        }
    }

    remove() {
        this.S.scene.remove(this.root);
        this.model.mat.dispose();
        if (this.aura) this.aura.material.dispose();
    }
}
export { CELL };
