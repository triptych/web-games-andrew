/**
 * projectiles.js — everything that flies: fireballs, orbs, spit, bolts,
 * homing missiles, rockets, ion bolts and the Singularity.
 *
 * Each projectile is a glow billboard (plus a small mesh for rockets and the
 * Singularity's black core), lights the room around it through the dynamic
 * light pool, leaves a particle trail, and is swept against the grid and
 * against bodies in sub-steps so nothing tunnels through a wall or a monster.
 */
import * as THREE from 'three';
import { PROJECTILES } from './bestiary.js';
import { glowMaterial, GLOW_GEO, actorMaterial } from '../render/materials.js';
import { sfx } from '../audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);

const rocketGeo = (() => {
    const g = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
    g.rotateX(Math.PI / 2);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.55), 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.userData.shared = true;
    return g;
})();

const voidGeo = (() => {
    const g = new THREE.SphereGeometry(0.42, 20, 14);
    g.userData.shared = true;
    return g;
})();

const voidMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.5); float s = 0.5 + 0.5 * sin(uTime * 14.0 + f * 20.0);
        gl_FragColor = vec4(vec3(0.55, 0.3, 1.0) * f * (1.5 + s) + vec3(1.0) * pow(f, 6.0) * 2.0, 1.0); }`,
});
voidMat.userData.shared = true;

export class Projectiles {
    constructor(S) {
        this.S = S;
        this.list = [];
        this.mats = {};
        this.rocketMat = actorMaterial({ tint: 0x9a9aa0, glow: 0xff8a3a, rim: 0.2 });
        this.rocketMat.userData.shared = true;
    }

    _glowMat(type) {
        if (!this.mats[type]) {
            const P = PROJECTILES[type];
            this.mats[type] = glowMaterial(P.color, P.core, 1.6, 1.8);
            this.mats[type].userData.shared = true;
        }
        return this.mats[type];
    }

    spawn(type, x, y, z, dir, speed, dmg, owner, opts = {}) {
        const P = PROJECTILES[type];
        const S = this.S;
        const glow = new THREE.Mesh(GLOW_GEO, this._glowMat(type));
        glow.scale.setScalar(P.size * (type === 'singularity' ? 4 : 5));
        glow.renderOrder = 22;
        S.scene.add(glow);
        let core = null;
        if (type === 'rocket' || type === 'missile') {
            core = new THREE.Mesh(rocketGeo, this.rocketMat);
            if (type === 'missile') core.scale.setScalar(0.8);
            S.scene.add(core);
        } else if (type === 'singularity') {
            core = new THREE.Mesh(voidGeo, voidMat);
            S.scene.add(core);
        }
        const p = {
            type, P, x, y, z, vx: dir[0] * speed, vy: dir[1] * speed, vz: dir[2] * speed, speed,
            dmg, owner, splash: opts.splash ?? 0, radius: opts.radius ?? 0, homing: opts.homing ?? 0, target: opts.target ?? null,
            life: type === 'singularity' ? 6 : 8, glow, core, trailT: 0, zapT: 0, age: 0, dead: false,
            kind: opts.kind ?? type, fromPlayer: owner === S.player,
        };
        this.list.push(p);
        return p;
    }

    update(dt) {
        const S = this.S;
        voidMat.uniforms.uTime.value += dt;
        for (const p of this.list) {
            if (p.dead) continue;
            p.age += dt;
            p.life -= dt;
            if (p.life <= 0) { this._explode(p, null); continue; }
            // homing
            if (p.homing && p.target && (p.target.alive ?? true) && p.age > 0.15) {
                const T = p.target;
                const ty = T === S.player ? S.player.eyeY - 0.5 : T.cy;
                const dx = T.x - p.x, dy = ty - p.y, dz = T.z - p.z;
                const d = Math.hypot(dx, dy, dz) || 1;
                const k = Math.min(1, p.homing * dt);
                p.vx += (dx / d * p.speed - p.vx) * k;
                p.vy += (dy / d * p.speed - p.vy) * k;
                p.vz += (dz / d * p.speed - p.vz) * k;
                const l = Math.hypot(p.vx, p.vy, p.vz) || 1;
                p.vx *= p.speed / l; p.vy *= p.speed / l; p.vz *= p.speed / l;
            }
            // sweep in sub-steps
            const dist = Math.hypot(p.vx, p.vy, p.vz) * dt;
            const n = Math.max(1, Math.ceil(dist / 0.25));
            for (let k = 0; k < n && !p.dead; k++) {
                const nx = p.x + p.vx * dt / n, ny = p.y + p.vy * dt / n, nz = p.z + p.vz * dt / n;
                // bodies
                const body = this._bodyAt(p, nx, ny, nz);
                if (body) { p.x = nx; p.y = ny; p.z = nz; this._explode(p, body); break; }
                // world
                const c = S.world.cellAt(nx, nz);
                const W = S.world;
                const solid = c < 0 || !W.L.open[c] || ny < W.L.floor[c] || ny > W.ceilAt(c);
                if (solid) {
                    const sky = c >= 0 && W.L.open[c] && W.L.sky[c] && ny > W.L.ceil[c] && W.L.door[c] < 0;
                    if (sky) { this._remove(p); break; }
                    // find the surface for the decal/normal
                    const sp = Math.hypot(p.vx, p.vy, p.vz) || 1;
                    const hit = W.raycast(p.x, p.y, p.z, p.vx / sp, p.vy / sp, p.vz / sp, dist / n + 0.5);
                    p.x = hit.x - p.vx / sp * 0.05; p.y = hit.y - p.vy / sp * 0.05; p.z = hit.z - p.vz / sp * 0.05;
                    this._explode(p, null, hit);
                    break;
                }
                p.x = nx; p.y = ny; p.z = nz;
            }
            if (p.dead) continue;
            // visuals
            p.glow.position.set(p.x, p.y, p.z);
            if (p.core) {
                p.core.position.set(p.x, p.y, p.z);
                if (p.type !== 'singularity') p.core.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
                else p.core.scale.setScalar(0.85 + Math.sin(p.age * 20) * 0.08);
            }
            S.R.light(p.x, p.y, p.z, p.P.light, p.type === 'singularity' ? 12 : p.type === 'plasma' ? 4.5 : 6, p.type === 'singularity' ? 2.4 : 1.3, p.fromPlayer ? 1.2 : 1);
            p.trailT -= dt;
            if (p.P.trail && p.trailT <= 0) {
                p.trailT = p.P.trail === 'smoke' ? 0.016 : 0.03;
                S.fx.trail(p.x - p.vx * 0.01, p.y - p.vy * 0.01, p.z - p.vz * 0.01, p.P.trail);
                if (p.type === 'rocket' || p.type === 'missile') S.fx.trail(p.x, p.y, p.z, 'fire');
            }
            if (p.type === 'singularity') this._singularity(p, dt);
        }
        this.list = this.list.filter((p) => !p.dead);
    }

    _bodyAt(p, x, y, z) {
        const S = this.S;
        const pr = p.P.size * 0.8;
        if (!p.fromPlayer && p.owner !== S.player) {
            const P = S.player;
            if (P.alive && Math.abs(P.x - x) < P.r + pr && Math.abs(P.z - z) < P.r + pr && y > P.y - pr && y < P.y + P.h + pr) return P;
        }
        for (const m of S.monsters) {
            if (!m.alive || m === p.owner || m.state === 'spawning') continue;
            // monster projectiles pass through their own kind (no infighting from friendly fire between the same species)
            if (!p.fromPlayer && p.owner && p.owner.arch === m.arch && !m.boss) continue;
            if (Math.abs(m.x - x) < m.r + pr && Math.abs(m.z - z) < m.r + pr && y > m.y - pr && y < m.y + m.h + pr) return m;
        }
        for (const b of S.barrels) {
            if (b.dead) continue;
            if (Math.abs(b.x - x) < 0.4 + pr && Math.abs(b.z - z) < 0.4 + pr && y > b.y && y < b.y + 1.1) return b;
        }
        return null;
    }

    _explode(p, body, hit) {
        const S = this.S;
        if (p.dead) return;
        if (body) {
            const sp = Math.hypot(p.vx, p.vy, p.vz) || 1;
            const dir = [p.vx / sp, p.vy / sp, p.vz / sp];
            if (body === S.player) S.damagePlayer(p.dmg, p.owner, dir);
            else if (body.isBarrel) S.damageBarrel(body, p.dmg, p.owner);
            else S.damageMonster(body, p.dmg, p.owner, { dir, kind: p.kind });
        }
        const T = p.type;
        if (T === 'rocket' || (T === 'missile' && p.splash)) {
            S.fx.explosion(p.x, p.y, p.z, 1);
            sfx.explosion({ x: p.x, y: p.y, z: p.z });
            if (hit && hit.what !== 'sky') S.fx.decals.add(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 1, 2.2);
            S.radiusDamage(p.x, p.y, p.z, p.radius || 4, p.splash || p.dmg, p.owner, { exclude: body });
        } else if (T === 'singularity') {
            S.singularityBoom(p);
        } else if (T === 'plasma') {
            S.fx.plasmaBurst(p.x, p.y, p.z, 0x3ac8ff);
            if (hit) S.fx.decals.add(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 3, 0.35);
            if (Math.random() < 0.3) sfx.plasmaHit({ x: p.x, y: p.y, z: p.z });
        } else if (T === 'missile') {
            S.fx.explosion(p.x, p.y, p.z, 0.55, 0xffaa55);
            sfx.explosion({ x: p.x, y: p.y, z: p.z }, 0.6);
            if (hit) S.fx.decals.add(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 1, 1.2);
        } else {
            const c = p.P.color;
            S.fx.plasmaBurst(p.x, p.y, p.z, c);
            for (let k = 0; k < 6; k++) S.fx.trail(p.x, p.y, p.z, T === 'fireball' ? 'fire' : 'spark');
            if (hit) S.fx.decals.add(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 1, 0.6);
            if (p.splash) S.radiusDamage(p.x, p.y, p.z, p.radius || 2, p.splash, p.owner, { exclude: body });
        }
        this._remove(p);
    }

    /** The Singularity arcs lightning into everything near it as it flies. */
    _singularity(p, dt) {
        const S = this.S;
        p.zapT -= dt;
        S.fx.trail(p.x, p.y, p.z, 'void');
        if (p.zapT > 0) return;
        p.zapT = 0.12;
        let zaps = 0;
        for (const m of S.monsters) {
            if (!m.alive || m.state === 'spawning') continue;
            const d = Math.hypot(m.x - p.x, m.cy - p.y, m.z - p.z);
            if (d > 11 || zaps >= 5) continue;
            if (!S.world.los(p.x, p.y, p.z, m.x, m.cy, m.z)) continue;
            zaps++;
            S.fx.beams.add([p.x, p.y, p.z], [m.x, m.cy, m.z], 0x9a6aff, 0.06, 0.14, 7);
            S.damageMonster(m, rnd(14, 22) * (S.player.powers.overdrive > 0 ? 3 : 1), S.player, { kind: 'zap' });
            if (Math.random() < 0.4) sfx.zap({ x: m.x, y: m.cy, z: m.z });
        }
    }

    _remove(p) {
        p.dead = true;
        this.S.scene.remove(p.glow);
        if (p.core) this.S.scene.remove(p.core);
    }

    clear() {
        for (const p of this.list) this._remove(p);
        this.list = [];
    }
}
export { rnd };
