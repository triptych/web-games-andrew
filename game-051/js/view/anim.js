/**
 * anim.js — procedural animation for every rig (characters and monsters).
 *
 * An Actor wraps a rig with a base transform and a small state machine:
 *   idle · run · attack(kind) · cast · hit · die · victory · stunned · spawn
 * Actions are promises so the battle director can await them.
 */

import * as THREE from 'three';

const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
export { ease };

const lerp = (a, b, t) => a + (b - a) * t;
const _v = new THREE.Vector3();

export class Actor {
    constructor(rig, opts = {}) {
        this.rig = rig;
        this.root = rig.root;
        this.home = new THREE.Vector3();
        this.facing = 0;
        this.t = Math.random() * 10;
        this.speed = 1;
        this.state = 'idle';
        this.stateT = 0;
        this.tasks = [];
        this.offset = new THREE.Vector3();
        this.dead = false;
        this.stunned = false;
        this.flashT = 0;
        this.baseScale = rig.root.scale.x;
        this.squash = 0;
        this.hover = rig.floats ? 0.25 : 0;
        this.walkTo = null;
        this.onUpdate = null;
    }

    place(pos, facing) {
        this.home.copy(pos);
        this.facing = facing;
        this.root.position.copy(pos);
        this.root.rotation.y = facing;
    }

    /** Runs fn(k) over dur seconds (k: 0 → 1); resolves when done. */
    tween(dur, fn) {
        return new Promise((res) => { this.tasks.push({ dur: Math.max(0.001, dur), t: 0, fn, res }); });
    }

    flash(color = '#ffffff', dur = 0.18) {
        this.rig.flashColor.value.set(color);
        this.flashT = dur;
        this.flashDur = dur;
    }

    async lunge(target, dist = 0.9, dur = 0.42) {
        const from = this.home.clone();
        const dir = _v.copy(target).sub(from); dir.y = 0;
        const len = dir.length();
        dir.normalize();
        const to = from.clone().addScaledVector(dir, Math.max(0, len - dist));
        this.state = 'lunge';
        await this.tween(dur * 0.45, (k) => { this.root.position.lerpVectors(from, to, ease.inOut(k)); this.root.position.y = from.y + Math.sin(k * Math.PI) * 0.25; });
        this.state = 'strike';
        this.stateT = 0;
        await this.tween(0.16, () => {});
        return async () => {
            this.state = 'return';
            await this.tween(dur * 0.45, (k) => { this.root.position.lerpVectors(to, from, ease.inOut(k)); });
            this.state = this.dead ? 'dead' : 'idle';
        };
    }

    async strike(dur = 0.28) { this.state = 'strike'; this.stateT = 0; await this.tween(dur, () => {}); this.state = 'idle'; }
    async cast(dur = 0.5) { this.state = 'cast'; this.stateT = 0; await this.tween(dur, () => {}); if (!this.dead) this.state = 'idle'; }
    async shoot(dur = 0.35) { this.state = 'shoot'; this.stateT = 0; await this.tween(dur, () => {}); if (!this.dead) this.state = 'idle'; }

    hit(strong = false) {
        if (this.dead) return;
        this.state = 'hit';
        this.stateT = 0;
        this.hitStrong = strong;
        this.flash('#ffffff', 0.16);
        this.rig.setExpression('hurt');
        clearTimeout(this._exprT);
        this._exprT = setTimeout(() => { if (!this.dead) this.rig.setExpression(this.stunned ? 'ko' : 'normal'); }, 420);
    }

    die() {
        this.dead = true;
        this.state = 'die';
        this.stateT = 0;
        this.rig.setExpression('ko');
    }

    revive() {
        this.dead = false;
        this.state = 'idle';
        this.root.visible = true;
        this.root.rotation.set(0, this.facing, 0);
        this.root.position.copy(this.home);
        this.root.scale.setScalar(this.baseScale);
        this.rig.setExpression('normal');
        this.flash('#fff6c0', 0.5);
    }

    victory() { if (!this.dead) { this.state = 'victory'; this.stateT = 0; this.rig.setExpression('happy'); } }
    setStunned(on) { this.stunned = on; if (!this.dead) this.rig.setExpression(on ? 'ko' : 'normal'); }

    async spawn(delay = 0) {
        this.root.scale.setScalar(0.001);
        await new Promise((r) => setTimeout(r, delay * 1000));
        await this.tween(0.45, (k) => this.root.scale.setScalar(this.baseScale * ease.back(k)));
    }

    update(dt) {
        this.t += dt * this.speed;
        this.stateT += dt;
        for (const task of [...this.tasks]) {
            task.t += dt;
            const k = Math.min(1, task.t / task.dur);
            task.fn(k);
            if (k >= 1) { this.tasks.splice(this.tasks.indexOf(task), 1); task.res(); }
        }
        if (this.flashT > 0) {
            this.flashT -= dt;
            this.rig.flash.value = Math.max(0, this.flashT / this.flashDur) * 0.75;
        } else this.rig.flash.value = 0;
        if (this.walkTo) this.updateWalk(dt);
        this.pose(dt);
        if (this.onUpdate) this.onUpdate(dt);
    }

    updateWalk(dt) {
        const w = this.walkTo;
        _v.copy(w.to).sub(this.root.position); _v.y = 0;
        const d = _v.length();
        if (d < 0.05) { this.walkTo = null; this.state = 'idle'; if (w.res) w.res(); return; }
        const step = Math.min(d, (w.speed || 1.2) * dt);
        _v.normalize();
        this.root.position.addScaledVector(_v, step);
        const want = Math.atan2(_v.x, _v.z);
        let diff = want - this.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.root.rotation.y += diff * Math.min(1, dt * 8);
        this.state = 'run';
    }

    walk(to, speed) { return new Promise((res) => { this.walkTo = { to: to.clone(), speed, res }; }); }

    /** Applies the pose for the current state to the rig's pivots. */
    pose(dt) {
        const r = this.rig, t = this.t, st = this.state, k = this.stateT;
        const humanoid = r.kind === 'humanoid';
        let bodyY = 0, bodyRX = 0, bodyRZ = 0, headRX = 0, headRY = 0;
        let armLX = 0, armLZ = 0.18, armRX = 0, armRZ = -0.18, legLX = 0, legRX = 0;
        let sq = 1;
        const breath = Math.sin(t * 2.2);
        if (st === 'idle' || st === 'return' || st === 'lunge') {
            bodyY = breath * 0.012 + (r.floats ? Math.sin(t * 1.6) * 0.06 : 0);
            headRX = Math.sin(t * 1.1) * 0.03;
            armLZ = 0.2 + breath * 0.03; armRZ = -0.2 - breath * 0.03;
            armRX = -0.1;
            sq = 1 + breath * 0.02;
            if (this.stunned) { headRX = 0.25; bodyRZ = Math.sin(t * 3) * 0.08; }
            if (st === 'lunge') { bodyRX = 0.25; armRX = -1.2; armLX = 0.5; legLX = Math.sin(t * 18) * 0.6; legRX = -legLX; }
        } else if (st === 'run') {
            const s = Math.sin(t * 13);
            legLX = s * 0.7; legRX = -s * 0.7;
            armLX = -s * 0.6; armRX = s * 0.6;
            bodyY = Math.abs(Math.cos(t * 13)) * 0.04;
            bodyRX = 0.12;
        } else if (st === 'strike') {
            const p = Math.min(1, k / 0.16);
            armRX = lerp(-2.6, 0.6, ease.out(p));
            armRZ = -0.3;
            bodyRX = lerp(-0.1, 0.25, p);
            bodyRZ = lerp(0.15, -0.12, p);
            armLX = 0.4;
            sq = 1 - 0.06 * Math.sin(p * Math.PI);
        } else if (st === 'cast') {
            const p = Math.min(1, k / 0.25);
            armRX = lerp(0, -2.4, ease.out(p)); armLX = lerp(0, -2.2, ease.out(p));
            armRZ = -0.5; armLZ = 0.5;
            headRX = -0.25 * p;
            bodyY = 0.06 * p + Math.sin(t * 20) * 0.005;
        } else if (st === 'shoot') {
            const p = Math.min(1, k / 0.2);
            armRX = -1.45; armLX = -1.45; armLZ = -0.2; armRZ = 0.25;
            bodyRZ = 0.05; headRY = 0.15;
            if (p >= 1) armRX = -1.2;
        } else if (st === 'hit') {
            const p = Math.min(1, k / 0.32);
            const amp = (this.hitStrong ? 0.45 : 0.28) * Math.sin(p * Math.PI);
            bodyRX = -amp; headRX = -amp * 0.8;
            armLZ = 0.6 * amp + 0.2; armRZ = -0.6 * amp - 0.2;
            sq = 1 + amp * 0.15;
            if (p >= 1) this.state = this.dead ? 'dead' : 'idle';
        } else if (st === 'die' || st === 'dead') {
            const p = Math.min(1, k / 0.7);
            bodyRX = -1.3 * ease.out(p);
            bodyY = -0.15 * p;
            headRX = -0.3 * p;
            armLZ = 1.0 * p; armRZ = -1.0 * p;
            if (k > 1.0) {
                const f = Math.min(1, (k - 1.0) / 0.6);
                this.root.scale.setScalar(this.baseScale * (1 - f * 0.999));
                if (f >= 1) this.root.visible = false;
            }
        } else if (st === 'victory') {
            const j = Math.abs(Math.sin(k * 5));
            bodyY = j * 0.18;
            armRX = -2.6 + Math.sin(k * 10) * 0.2; armLX = -2.6 - Math.sin(k * 10) * 0.2;
            armRZ = -0.6; armLZ = 0.6;
            legLX = -j * 0.3; legRX = -j * 0.3;
        }

        if (r.body) {
            r.body.position.y = (r.body.userData.baseY ??= r.body.position.y) + bodyY + this.hover;
            r.body.rotation.x = humanoid ? bodyRX * 0.6 : bodyRX * 0.35;
            r.body.rotation.z = bodyRZ;
            if (!humanoid) r.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        }
        if (humanoid && r.holder) r.holder.rotation.x = st === 'die' || st === 'dead' ? bodyRX * 0.5 : 0;
        if (r.neck) { r.neck.rotation.x = headRX; r.neck.rotation.y = headRY; }
        else if (r.head) r.head.rotation.x = headRX;
        if (r.armL) {
            const b = (r.armL.userData.baseZ ??= r.armL.rotation.z);
            r.armL.rotation.x = humanoid ? armLX : armLX * 0.5;
            r.armL.rotation.z = humanoid ? armLZ : b + (armLZ - 0.18) * 0.4;
        }
        if (r.armR) {
            const b = (r.armR.userData.baseZ ??= r.armR.rotation.z);
            r.armR.rotation.x = humanoid ? armRX : armRX * 0.5;
            r.armR.rotation.z = humanoid ? armRZ : b + (armRZ + 0.18) * 0.4;
        }
        if (humanoid && r.look && r.look.weapon === 'bow' && st !== 'shoot') { r.armR.rotation.z = -0.5; }
        if (r.legL && humanoid) r.legL.rotation.x = legLX;
        if (r.legR && humanoid) r.legR.rotation.x = legRX;
        if (r.legs && r.legs.length) {
            const moving = st === 'run' || st === 'lunge';
            r.legs.forEach((l, i) => {
                const base = (l.userData.baseX ??= l.rotation.x);
                l.rotation.x = base + (moving ? Math.sin(t * 14 + i * 1.7) * 0.5 : Math.sin(t * 2 + i) * 0.06);
            });
        }
        if (r.cape) r.cape.rotation.x = 0.12 + Math.sin(t * 2.4) * 0.05 + (st === 'run' || st === 'lunge' ? 0.5 : 0) + bodyY;
        if (r.tail) r.tail.rotation.y = Math.sin(t * 2.6) * 0.35;
        if (r.wingL) { const f = Math.sin(t * (r.floats || r.kind === 'monster' ? 9 : 3)) * (r.kind === 'monster' ? 0.5 : 0.18); r.wingL.rotation.y = -0.5 + f; r.wingR.rotation.y = 0.5 - f; }
    }
}
