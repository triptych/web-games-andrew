/**
 * weapons.js — the arsenal: switching, firing, ammo, auto-aim and the
 * first-person animation of each gun.
 *
 * Firing rules
 *   hitscan     pellets with spread; shotgun pellets on one target are summed
 *               into a single hit so overkill can gib
 *   projectile  spawned at the muzzle, aimed at whatever the crosshair ray
 *               hits so it converges on the crosshair
 *   rail        pierces every body on the line to the wall
 *   melee       the Arc Blade hits the nearest body in a cone; on a
 *               staggered demon it's an execution that bursts into health
 *   singularity charges for 0.8 s, then launches the black hole
 * Overdrive triples damage, Berserk multiplies the blade by eight, Haste
 * speeds up the trigger. Vertical auto-aim (DOOM-style) is on by default on
 * touch screens and optional on desktop.
 */
import { WEAPONS, WEAPON_BY_ID } from '../config.js';
import { sfx } from '../audio.js';
import { input } from '../input.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const AUTO_ORDER = ['plasma', 'ssg', 'chaingun', 'shotgun', 'rail', 'rocket', 'pistol', 'blade'];

export class Weapons {
    constructor(S, vm) {
        this.S = S;
        this.vm = vm;
        this.current = 'pistol';
        this.pending = null;
        this.last = 'blade';
        this.raise = 0;       // 0 lowered … 1 ready
        this.phase = 'raising';
        this.cool = 0;
        this.spin = 0;
        this.charge = 0;
        this.charging = false;
        this.recoil = 0;
        this.actionT = 9;     // seconds since the last shot (drives pump / reload anims)
        this.flashT = 0;
        this.bob = 0;
        this.sway = { x: 0, y: 0 };
        this.swing = 9;
        this.spinAngle = 0;
        this.firedThisPress = false;
        vm.show(this.current);
    }

    get def() { return WEAPON_BY_ID[this.current]; }

    has(id) { return this.S.player.weapons.has(id); }

    hasAmmo(id) {
        const w = WEAPON_BY_ID[id];
        if (!w.ammo) return true;
        return this.S.player.ammo[w.ammo] >= w.use;
    }

    select(id, force = false) {
        if (!this.has(id) || (!force && id === this.current && !this.pending)) return false;
        if (id === this.current && this.pending) { this.pending = null; this.phase = 'raising'; return true; }
        this.pending = id;
        this.phase = 'lowering';
        this.charging = false; this.charge = 0;
        return true;
    }

    selectSlot(slot) {
        const w = WEAPONS.find((x) => x.slot === slot);
        if (w && this.has(w.id)) this.select(w.id);
    }

    cycle(dir) {
        const owned = WEAPONS.filter((w) => this.has(w.id));
        const cur = this.pending ?? this.current;
        let i = owned.findIndex((w) => w.id === cur);
        for (let k = 0; k < owned.length; k++) {
            i = (i + dir + owned.length) % owned.length;
            if (this.hasAmmo(owned[i].id)) { this.select(owned[i].id); return; }
        }
    }

    autoSwitch() {
        for (const id of AUTO_ORDER) if (this.has(id) && this.hasAmmo(id)) { this.select(id); return; }
    }

    /** F / right mouse / ⚔: a blade strike without switching weapons. */
    quickMelee() {
        const P = this.S.player;
        if (this.meleeCool > 0 || !P.alive || !this.S.canFire()) return;
        this.meleeCool = 0.45;
        if (this.current === 'blade') { if (this.cool <= 0 && this.phase === 'ready') this._fire(WEAPON_BY_ID.blade); return; }
        this.S.playerMelee(WEAPON_BY_ID.blade, (P.powers.overdrive > 0 ? 3 : 1) * (P.powers.berserk > 0 ? 8 : 1));
        P.kick(-0.03);
        this.recoil = 0.8;
    }

    /** Called by the session when a weapon is picked up. */
    onPickup(id, isNew) { if (isNew) this.select(id); }

    update(dt, look) {
        const S = this.S, P = S.player;
        const haste = P.powers.haste > 0 ? 1.5 : 1;
        this.cool -= dt * haste;
        this.meleeCool = (this.meleeCool ?? 0) - dt;
        this.actionT += dt * haste;
        this.swing += dt * haste;
        this.flashT -= dt;
        this.recoil = Math.max(0, this.recoil - dt * 7);
        // switching
        if (this.phase === 'lowering') {
            this.raise -= dt * 6 * haste;
            if (this.raise <= 0) {
                this.raise = 0;
                this.last = this.current;
                this.current = this.pending ?? this.current;
                this.pending = null;
                this.phase = 'raising';
                this.vm.show(this.current);
                sfx.weaponUp();
                this.spin = 0; this.cool = Math.max(this.cool, 0.05);
            }
        } else if (this.phase === 'raising') {
            this.raise += dt * 5 * haste;
            if (this.raise >= 1) { this.raise = 1; this.phase = 'ready'; }
        }

        const w = this.def;
        const firing = input.fire && P.alive && S.canFire();
        if (!input.fire) this.firedThisPress = false;

        // chaingun spin-up
        if (w.id === 'chaingun') {
            const want = firing && this.phase === 'ready' ? 1 : 0;
            if (want && this.spin === 0) sfx.spin(null, true);
            if (!want && this.spin > 0.9) sfx.spin(null, false);
            this.spin = Math.max(0, Math.min(1, this.spin + (want ? dt / w.spinup : -dt * 1.5)));
        } else this.spin = 0;

        if (this.phase === 'ready' && firing) {
            if (w.id === 'bfg') {
                if (!this.charging && this.cool <= 0) {
                    if (!this.hasAmmo('bfg')) { this._dry(); }
                    else { this.charging = true; this.charge = 0; sfx.bfgCharge(null); }
                }
            } else if (this.cool <= 0 && (w.auto || w.id === 'pistol' || w.id === 'blade' || !this.firedThisPress || w.rate < 2)) {
                if (w.id !== 'chaingun' || this.spin >= 1) this._fire(w);
            }
        }
        if (this.charging) {
            this.charge += dt * haste;
            if (this.charge >= w.charge) { this.charging = false; this._fire(w); this.charge = 0; }
        }

        // ---- view model pose
        const moving = Math.hypot(P.vx, P.vz);
        const bobAmt = P.grounded ? Math.min(1, moving / 8) : 0.15;
        this.bob += dt * (6 + moving * 0.6);
        this.sway.x += (-look.x * 0.35 - this.sway.x) * Math.min(1, dt * 10);
        this.sway.y += (look.y * 0.35 - this.sway.y) * Math.min(1, dt * 10);
        const sx = Math.max(-0.06, Math.min(0.06, this.sway.x)), sy = Math.max(-0.05, Math.min(0.05, this.sway.y));
        const lower = 1 - easeOut(this.raise);
        const pose = {
            x: Math.sin(this.bob) * 0.014 * bobAmt + sx,
            y: -Math.abs(Math.cos(this.bob)) * 0.02 * bobAmt - lower * 0.42 + sy - P.landDip * 0.06 + Math.sin(S.time * 1.6) * 0.003,
            z: this.recoil * (w.id === 'ssg' || w.id === 'rocket' ? 0.12 : 0.07),
            rx: this.recoil * (w.id === 'ssg' ? 0.32 : 0.16) - lower * 0.7,
            ry: sx * 1.2,
            rz: -sx * 0.8 + Math.sin(this.bob * 0.5) * 0.012 * bobAmt,
        };
        this._animParts(w, pose, dt);
        this.vm.pose(this.current, pose);
        this.vm.setCloak(P.powers.cloak > 0);
        this.vm.flash(this.current, this.flashT > 0);
        const amb = S.ambientAt(P.x, P.z);
        this.vm.setLighting(amb, this.flashT > 0 ? 6 : 0, w.id === 'plasma' ? 0x50c8ff : w.id === 'rail' || w.id === 'bfg' ? 0xa070ff : 0xffaa55);
    }

    _animParts(w, pose, dt) {
        const g = this.vm.get(this.current);
        const U = g.userData;
        const t = this.actionT;
        switch (w.id) {
            case 'blade': {
                const s = this.swing;
                const k = s < 0.32 ? Math.sin((s / 0.32) * Math.PI) : 0;
                const dir = this.swingSide ?? 1;
                pose.x += -k * 0.25 * dir; pose.y += k * 0.06; pose.z -= k * 0.15;
                pose.rz += k * 1.1 * dir; pose.ry += k * 0.5 * dir; pose.rx -= k * 0.4;
                U.glow.material.color.setRGB(0.4 + k * 1.5, 1.6 + k, 2.2 + k);
                break;
            }
            case 'pistol': U.slide.position.z = t < 0.12 ? Math.sin((t / 0.12) * Math.PI) * 0.035 : 0; break;
            case 'shotgun': {
                const k = t > 0.28 && t < 0.72 ? Math.sin(((t - 0.28) / 0.44) * Math.PI) : 0;
                U.pump.position.z = -0.24 + k * 0.08;
                pose.rz += k * 0.08; pose.x -= k * 0.02;
                if (t > 0.45 && !this._ejected) { this._ejected = true; this._shell(true); }
                break;
            }
            case 'ssg': {
                const k = t > 0.3 && t < 1.25 ? Math.sin(((t - 0.3) / 0.95) * Math.PI) : 0;
                U.barrels.rotation.x = -k * 0.55;
                pose.rx -= k * 0.25; pose.y -= k * 0.05; pose.rz += k * 0.25;
                U.shells.visible = t > 0.75 && t < 1.05;
                U.shells.position.z = 0.0 + (1.05 - Math.min(1.05, t)) * 0.3;
                if (t > 0.5 && !this._ejected) { this._ejected = true; this._shell(true); this._shell(true); }
                break;
            }
            case 'chaingun': this.spinAngle += dt * this.spin * 38; U.spinner.rotation.z = this.spinAngle; break;
            case 'plasma': U.coils.children.forEach((c, i) => c.scale.setScalar(1 + Math.max(0, Math.sin(this.S.time * 12 - i)) * 0.15 + (this.flashT > 0 ? 0.2 : 0))); break;
            case 'rail': {
                const ready = Math.max(0, Math.min(1, 1 - this.cool / (1 / w.rate)));
                U.lights.children.forEach((c, i) => { const on = ready * 6 > i; c.material.color.setRGB(on ? 1.4 : 0.15, on ? 0.6 : 0.05, on ? 2.6 : 0.2); });
                U.core.material.color.setRGB(0.6 + ready, 0.2 + ready * 0.4, 1.2 + ready * 1.4);
                break;
            }
            case 'bfg': {
                const c = this.charging ? this.charge / w.charge : 0;
                U.core.rotation.x += dt * (2 + c * 20); U.core.rotation.y += dt * (3 + c * 25);
                U.core.scale.setScalar(1 + c * 0.8 + Math.sin(this.S.time * 8) * 0.06);
                U.chamber.children.forEach((ch, i) => { if (i >= 2) ch.rotation.z += dt * (1 + c * 10) * (i % 2 ? 1 : -1); });
                pose.x += (Math.random() - 0.5) * c * 0.01; pose.y += (Math.random() - 0.5) * c * 0.01;
                break;
            }
        }
    }

    _dry() {
        if (this.cool > 0) return;
        sfx.dry();
        this.cool = 0.4;
        this.autoSwitch();
    }

    _shell(shotgun) {
        const S = this.S, P = S.player;
        const r = P.right(), f = P.forward();
        S.fx.shell(P.x + r[0] * 0.3 + f[0] * 0.3, P.eyeY - 0.25, P.z + r[2] * 0.3 + f[2] * 0.3, r[0] * 2.5, r[2] * 2.5, shotgun);
    }

    _fire(w) {
        const S = this.S, P = S.player;
        if (!this.hasAmmo(w.id)) { this._dry(); return; }
        if (w.ammo) P.ammo[w.ammo] -= w.use;
        this.cool = 1 / w.rate;
        this.actionT = 0;
        this._ejected = false;
        this.firedThisPress = true;
        const od = P.powers.overdrive > 0 ? 3 : 1;
        const eye = P.eyePos();
        const muzzle = P.muzzlePos();
        S.onPlayerFire(w);

        if (w.kind === 'melee') {
            this.swing = 0;
            this.swingSide = -(this.swingSide ?? 1);
            S.playerMelee(w, od * (P.powers.berserk > 0 ? 8 : 1));
            return;
        }

        this.recoil = 1;
        this.flashT = 0.05;
        if (w.id !== 'plasma') P.kick(w.id === 'ssg' ? 0.06 : w.id === 'rocket' ? 0.05 : w.id === 'shotgun' ? 0.04 : w.id === 'rail' ? 0.05 : w.id === 'bfg' ? 0.08 : 0.012);
        const flashCol = w.id === 'plasma' ? 0x40c0ff : w.id === 'rail' || w.id === 'bfg' ? 0xa060ff : 0xffb060;
        S.fx.light(muzzle[0], muzzle[1], muzzle[2], flashCol, w.id === 'chaingun' ? 8 : 10, w.id === 'plasma' ? 1.2 : 2.0, 0.06);

        const aim = S.aimDirection(P.yaw, P.pitch, w);
        switch (w.kind) {
            case 'hitscan': {
                const hits = new Map();
                const [sx, sy] = w.spread;
                for (let k = 0; k < w.pellets; k++) {
                    const spreadX = (w.pellets === 1 && w.id === 'pistol' && this.actionT > 0.4) ? 0 : sx;
                    const yaw = aim.yaw + rnd(-1, 1) * spreadX * Math.PI / 180 * (k === 0 && w.pellets > 1 ? 0.2 : 1);
                    const pitch = aim.pitch + rnd(-1, 1) * sy * Math.PI / 180;
                    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
                    const dmg = rnd(...w.dmg) * od;
                    const res = S.playerHitscan(eye, dir, 120, dmg, k < 3 || w.pellets < 9);
                    if (res.body) hits.set(res.body, (hits.get(res.body) ?? 0) + dmg);
                    if (k % 3 === 0 || w.pellets < 4) S.fx.tracer([muzzle[0], muzzle[1], muzzle[2]], [res.x, res.y, res.z], w.id === 'chaingun' ? 0xffe0a0 : 0xffd090);
                }
                for (const [body, dmg] of hits) S.applyHit(body, dmg, { dir: aim.dir, kind: w.id === 'ssg' && dmg > 120 ? 'ssg' : 'bullet', splash: w.id === 'ssg' && dmg > 140 });
                const s = { pistol: sfx.pistol, shotgun: sfx.shotgun, ssg: sfx.ssg, chaingun: sfx.chaingun }[w.id];
                s?.(null);
                if (w.id === 'chaingun' || w.id === 'pistol') this._shell(false);
                break;
            }
            case 'projectile': {
                const target = S.crosshairPoint(eye, aim.dir);
                const dx = target[0] - muzzle[0], dy = target[1] - muzzle[1], dz = target[2] - muzzle[2];
                const d = Math.hypot(dx, dy, dz) || 1;
                const dir = d < 2.5 ? aim.dir : [dx / d, dy / d, dz / d];
                if (w.id === 'plasma') {
                    const jit = 0.012;
                    dir[0] += rnd(-jit, jit); dir[1] += rnd(-jit, jit); dir[2] += rnd(-jit, jit);
                }
                const p = S.spawnProjectile(w.proj, muzzle[0], muzzle[1], muzzle[2], dir, w.speed, rnd(...w.dmg) * od, P, { splash: (w.splash ?? 0) * od, radius: w.radius ?? 0, kind: w.proj });
                p.fromPlayer = true;
                if (w.id === 'rocket') sfx.rocket(null);
                else if (w.id === 'plasma') sfx.plasma(null);
                else if (w.id === 'bfg') { sfx.bfg(null); S.flash(0x9a6aff, 0.25); }
                break;
            }
            case 'rail': {
                sfx.rail(null);
                S.playerRail(eye, muzzle, aim.dir, rnd(...w.dmg) * od);
                S.flash(0x9a6aff, 0.05);
                break;
            }
        }
        if (w.ammo && P.ammo[w.ammo] < w.use) setTimeout(() => { if (this.current === w.id && !this.hasAmmo(w.id)) this.autoSwitch(); }, 250);
    }
}

function easeOut(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
