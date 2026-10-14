// Everything that moves: the squad, the guards, the witness, cars, darts,
// bullets and boomboxes. Each frame `sync()` reads the sim state and places
// meshes; one-off animations (squash on impact, falling over, sinking,
// hopping into the getaway car) are driven by events through `on()`.

import * as THREE from 'three';
import { CREW, FOES } from '../sim/data.js';
import { makeCharacter, makeDog, makeVehicle, makeRing } from './models.js';
import { icon } from './textures.js';
import { isDown } from '../sim/ai.js';

const faceRot = (a) => Math.PI / 2 - a;
const lerpAngle = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export class Actors {
    constructor(group) {
        this.group = group;
        this.map = new Map();      // body id -> visual
        this.cars = [];
        this.proj = new Map();
        this.boxes = new Map();
        this.selected = null;
        this.time = 0;
    }

    build(W) {
        for (const b of W.S.bodies) this._make(b);
        for (const c of W.S.cars) {
            const m = makeVehicle(c.police ? 'police' : 'car', c.color ?? 0xffffff);
            m.position.set(c.x, 0, c.y);
            m.rotation.y = faceRot(c.a);
            m.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
            this.group.add(m);
            const v = { m, c };
            if (c.target != null) {
                const ring = makeRing(1.1, 0xff2e3e);
                ring.scale.set(1, 1, 1);
                m.add(ring);
                v.ring = ring;
            }
            this.cars.push(v);
        }
    }

    _make(b) {
        let v;
        if (b.kind === 'foe') {
            const kd = FOES[b.k];
            v = kd.dog ? makeDog(kd.look, b.r) : makeCharacter({ ...kd.look, jacket: kd.look.suit, hairStyle: kd.look.hat ? 'slick' : 'slick', glasses: kd.look.shades ? 'shades' : null }, b.r, kd.cop ? 'cop' : 'foe', { ring: 0xff2e3e });
            const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon('?'), transparent: true, depthWrite: false, depthTest: false }));
            ic.scale.set(0.7, 0.7, 1); ic.position.y = b.r * 2 + 0.55; ic.visible = false; ic.renderOrder = 20;
            v.root.add(ic);
            v.icon = ic; v.iconKind = '';
            // stars for knocked-out guards
            const stars = new THREE.Group(); stars.position.y = b.r * 2 + 0.15; stars.visible = false;
            for (let k = 0; k < 3; k++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon('star'), transparent: true, depthWrite: false }));
                s.scale.set(0.24, 0.24, 1);
                stars.add(s);
            }
            v.root.add(stars);
            v.stars = stars;
        } else if (b.kind === 'vip') {
            v = makeCharacter({ skin: '#e8b898', hair: '#8a7a6a', hairStyle: 'slick', jacket: '#c8e0ff', shirt: '#c8e0ff' }, b.r, 'vip', { ring: 0xffe45c });
            for (const s of [-1, 1]) {
                const cast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                cast.rotation.x = Math.PI / 2; cast.position.set(s * 0.15, -b.r * 0.75, 0.25);
                v.pivot.add(cast);
            }
        } else {
            const c = CREW[b.who];
            v = makeCharacter(c.look, b.r, 'crew', { ring: c.look.ring });
            if (b.kind === 'recruit') {
                const help = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon('help'), transparent: true, depthWrite: false, depthTest: false }));
                help.scale.set(1.0, 1.0, 1); help.position.y = b.r * 2 + 0.6; help.renderOrder = 20;
                v.root.add(help);
                v.help = help;
                // rope round the middle
                const rope = new THREE.Mesh(new THREE.TorusGeometry(b.r * 1.0, 0.035, 6, 24), new THREE.MeshStandardMaterial({ color: 0xc8a060 }));
                rope.rotation.x = Math.PI / 2; v.pivot.add(rope); v.rope = rope;
            }
            // hearts above the head (only shown when hurt or selected)
            const hearts = new THREE.Group(); hearts.position.y = b.r * 2 + 0.3; v.root.add(hearts);
            v.hearts = hearts; v.heartN = -1;
            const sel = makeRing(b.r * 1.25, 0xffffff);
            sel.material.opacity = 0; v.root.add(sel); v.sel = sel;
        }
        v.root.position.set(b.x, 0, b.y);
        v.pivot.rotation.y = faceRot(b.face ?? Math.PI / 2);
        v.squash = 0; v.tilt = 0; v.sink = 0; v.extract = null; v.idleT = 0; v.ko = 0; v.yaw = faceRot(b.face ?? Math.PI / 2);
        v.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.group.add(v.root);
        this.map.set(b.id, v);
        return v;
    }

    /** Remove all actors (episode end). */
    clear() {
        for (const v of this.map.values()) this.group.remove(v.root);
        for (const v of this.cars) this.group.remove(v.m);
        for (const m of this.proj.values()) this.group.remove(m);
        for (const m of this.boxes.values()) this.group.remove(m);
        this.map.clear(); this.cars = []; this.proj.clear(); this.boxes.clear();
    }

    on(e, W, getaway) {
        const v = e.id != null ? this.map.get(e.id) : null;
        switch (e.type) {
            case 'clack': case 'wall': case 'bumper':
                for (const [id, vv] of this.map) {
                    const b = W.body(id);
                    if (b && Math.hypot(b.x - e.x, b.y - e.y) < b.r + 0.6) vv.squash = Math.min(0.35, (e.v ?? 4) * 0.03);
                }
                break;
            case 'extract':
                if (v) v.extract = { t: 0, from: v.root.position.clone(), to: getaway ? getaway.position.clone() : v.root.position.clone() };
                break;
            case 'join': {
                // recruit becomes crew: drop the rope and the help sign
                if (v) { if (v.help) v.root.remove(v.help); if (v.rope) v.pivot.remove(v.rope); v.help = null; v.rope = null; v.squash = 0.3; }
                break;
            }
            case 'rewind':
                // rebuild from scratch: positions and states jump
                this.clear();
                this.build(W);
                break;
        }
    }

    sync(W, dt, ctx) {
        this.time += dt;
        const S = W.S;
        for (const b of S.bodies) {
            let v = this.map.get(b.id);
            if (!v) v = this._make(b);
            if (b.kind === 'recruit' && !v.help && !v.joined) { /* joined handled by event */ }
            this._syncBody(b, v, dt, W, ctx);
        }
        // cars
        for (const v of this.cars) {
            const c = v.c = S.cars.find((k) => k === v.c) ?? S.cars[this.cars.indexOf(v)];
            if (!c) continue;
            v.m.position.set(c.x, 0, c.y);
            v.m.rotation.y = faceRot(c.a);
            if (c.traffic) for (const w of v.m.userData.wheels ?? []) w.rotation.z -= Math.abs(c.vx) * dt * 4;
            if (v.ring) { v.ring.visible = !c.wreck; v.ring.material.opacity = 0.5 + 0.4 * Math.sin(this.time * 6); }
            if (c.wreck && !v.wrecked) {
                v.wrecked = true;
                v.m.traverse((o) => { if (o.isMesh && o.material?.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.18); if (o.material.emissive) o.material.emissiveIntensity = 0; } });
                v.m.rotation.z = 0.05;
            }
        }
        // projectiles
        const live = new Set();
        for (const p of S.projectiles) {
            live.add(p.id);
            let m = this.proj.get(p.id);
            if (!m) {
                const col = p.kind === 'dart' ? 0x6affd8 : 0xffd060;
                m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, p.kind === 'dart' ? 0.32 : 0.45, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3), toneMapped: false }));
                this.group.add(m);
                this.proj.set(p.id, m);
            }
            m.position.set(p.x, 0.4, p.y);
            m.rotation.set(Math.PI / 2, 0, -Math.atan2(p.vy, p.vx) + Math.PI / 2);
            m.rotation.order = 'YXZ';
            m.rotation.set(Math.PI / 2, -Math.atan2(p.vy, p.vx) + Math.PI / 2, 0);
        }
        for (const [id, m] of this.proj) if (!live.has(id)) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); this.proj.delete(id); }
        // boomboxes
        const bl = new Set();
        for (const bb of S.boomboxes) {
            bl.add(bb.id);
            let m = this.boxes.get(bb.id);
            if (!m) { m = makeBoombox(); this.group.add(m); this.boxes.set(bb.id, m); }
            m.position.set(bb.x, 0, bb.y);
            const k = 1 + Math.max(0, Math.sin(this.time * 14)) * 0.12;
            m.scale.set(k, 1 / k * 1.1, k);
        }
        for (const [id, m] of this.boxes) if (!bl.has(id)) { this.group.remove(m); this.boxes.delete(id); }
    }

    _syncBody(b, v, dt, W, ctx) {
        const S = W.S;
        const sp = Math.hypot(b.vx, b.vy);
        // extraction hop
        if (v.extract) {
            v.extract.t += dt * 1.6;
            const t = Math.min(1, v.extract.t);
            v.root.position.lerpVectors(v.extract.from, v.extract.to, t);
            v.root.position.y = Math.sin(t * Math.PI) * 1.4;
            v.root.scale.setScalar(1 - t * 0.7);
            if (t >= 1) v.root.visible = false;
            return;
        }
        if (b.gone) {
            if (b.kind === 'foe' || b.kind === 'vip') {
                v.sink = Math.min(1, v.sink + dt * 1.5);
                v.root.position.y = -v.sink * 1.0;
                v.root.visible = v.sink < 1;
                if (v.icon) v.icon.visible = false;
                if (v.stars) v.stars.visible = false;
                v.ring.visible = false;
            } else v.root.visible = false;
            return;
        }
        v.root.visible = true;
        v.root.position.set(b.x, 0, b.y);
        v.root.scale.setScalar(1);
        // facing
        let want = faceRot(b.face ?? 0);
        if (b.kind === 'crew' || b.kind === 'recruit' || b.kind === 'vip') {
            if (sp < 0.05) { v.idleT += dt; if (v.idleT > 0.6 && S.phase === 'aim') want = ctx.camYaw ?? 0; } else v.idleT = 0;
        }
        v.yaw = lerpAngle(v.yaw, want, Math.min(1, dt * (b.kind === 'foe' ? 12 : 8)));
        v.pivot.rotation.y = v.yaw;
        // knocked over / downed
        const down = (b.kind === 'foe' && isDown(b)) || (b.kind === 'crew' && b.downed);
        v.ko += ((down ? 1 : 0) - v.ko) * Math.min(1, dt * 6);
        // roll lean + squash
        v.squash = Math.max(0, v.squash - dt * 1.6);
        const lean = Math.min(0.35, sp * 0.03);
        v.pivot.rotation.x = lean + v.ko * 1.25;
        v.pivot.rotation.z = Math.sin(this.time * 9 + b.id) * Math.min(0.08, sp * 0.01);
        const sq = 1 - v.squash * Math.abs(Math.sin(this.time * 30));
        v.pivot.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
        const bob = b.kind === 'foe' && b.ctl && sp > 0.2 ? Math.abs(Math.sin(this.time * 10 + b.id)) * 0.06 : 0;
        const dance = b.kind === 'foe' && b.state === 'dance' ? Math.abs(Math.sin(this.time * 9 + b.id)) * 0.18 : 0;
        v.pivot.position.y = b.r * (1 - v.ko * 0.35) + bob + dance;
        // ghost
        const ghost = b.kind === 'crew' && b.ghost;
        for (const m of v.mats) { m.opacity = ghost ? 0.28 + Math.sin(this.time * 20) * 0.08 : 1; m.depthWrite = !ghost; }
        if (b.kind === 'crew' && b.downed) for (const m of v.mats) m.color?.setScalar?.(1);
        // selection ring + hearts
        if (v.sel) {
            const on = ctx.selected === b.id && S.phase === 'aim';
            v.sel.material.opacity = on ? 0.6 + Math.sin(this.time * 6) * 0.3 : 0;
            v.sel.scale.setScalar(on ? 1 + Math.sin(this.time * 4) * 0.06 : 1);
            const can = W.canShoot?.(b) && S.phase === 'aim';
            v.ring.material.opacity = b.kind === 'recruit' ? 0.3 : can ? 0.95 : 0.35;
            const show = b.kind === 'crew' && (b.hp < b.maxHp || on) ? b.hp : 0;
            if (show !== v.heartN) {
                v.heartN = show;
                v.hearts.clear();
                for (let k = 0; k < show; k++) {
                    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon('heart'), transparent: true, depthWrite: false, depthTest: false }));
                    s.scale.set(0.24, 0.24, 1);
                    s.position.x = (k - (show - 1) / 2) * 0.24;
                    s.renderOrder = 19;
                    v.hearts.add(s);
                }
            }
        }
        if (v.help) v.help.position.y = b.r * 2 + 0.6 + Math.sin(this.time * 4) * 0.08;
        // guard status icon
        if (v.icon) {
            let kind = '';
            if (b.state === 'sleep') kind = 'zzz';
            else if (b.state === 'alert') kind = '!';
            else if (b.state === 'suspicious' || b.state === 'investigate' || b.state === 'search' || (b.sus > 0.12 && !isDown(b))) kind = '?';
            else if (b.state === 'dance') kind = 'note';
            if (kind !== v.iconKind) {
                v.iconKind = kind;
                if (kind) { v.icon.material.map = icon(kind); v.icon.material.needsUpdate = true; }
            }
            v.icon.visible = !!kind && !b.gone;
            if (kind === '?') { const k = 0.45 + Math.min(1, b.sus) * 0.45; v.icon.scale.set(k, k, 1); v.icon.material.opacity = 0.6 + b.sus * 0.4; }
            else if (kind) { v.icon.scale.set(0.7, 0.7, 1); v.icon.material.opacity = 1; }
            v.icon.position.y = b.r * 2 + 0.55 + Math.sin(this.time * 6) * 0.05;
            v.stars.visible = b.state === 'ko';
            if (v.stars.visible) v.stars.children.forEach((s, k) => { const a = this.time * 4 + k * 2.1; s.position.set(Math.cos(a) * 0.35, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.35); });
            v.ring.material.color.set(b.state === 'alert' ? 0xff2e3e : isDown(b) ? 0x606070 : b.sus > 0.2 ? 0xffb040 : 0xff5a6a);
            v.ring.material.opacity = isDown(b) ? 0.35 : 0.85;
            if (v.tail) v.tail.rotation.z = Math.sin(this.time * 14) * 0.5;
        }
    }

    /** Teammate under a world point, if any (for picking). */
    pick(W, x, y, extra = 0.35) {
        let best = null, bd = 1e9;
        for (const b of W.S.bodies) {
            if (b.kind !== 'crew' || b.gone) continue;
            const d = Math.hypot(b.x - x, b.y - y);
            if (d < b.r + extra && d < bd) { bd = d; best = b; }
        }
        return best;
    }
}

function makeBoombox() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.2), new THREE.MeshStandardMaterial({ color: 0x18181e, metalness: 0.6, roughness: 0.3 }));
    body.position.y = 0.2; g.add(body);
    for (const s of [-1, 1]) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x080808, emissive: 0xff3fa4, emissiveIntensity: 0.8 }));
        sp.rotation.x = Math.PI / 2; sp.position.set(s * 0.18, 0.2, 0.11); g.add(sp);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: 0.9 }));
    handle.position.y = 0.36; g.add(handle);
    const ring = makeRing(0.6, 0xffe45c);
    g.add(ring);
    return g;
}
