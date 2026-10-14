// The player: movement, jump and jetpack, guns, kick, pipe bombs, Overdrive, pickups. Pure.
//
// Input, one step's worth: { mx, my (strafe right / forward, -1..1), dyaw, dpitch (radians),
// fire, jump (held), kick, reload, use, bomb, over, last (edges), slot (-1 or 0..3), cycle (0, ±1) }.

import { PLAYER, STEP_UP, KICK, BOMB, FURY, AMMO_MAX, LIQUID_DPS } from '../config.js';
import { moveBody, supportAt, inLiquid } from './world.js';
import { ev, quip, noise, hitscan, beam, spawnProj, damageEnemy, damageBarrel, hurtPlayer, healPlayer } from './combat.js';

export const NO_INPUT = { mx: 0, my: 0, dyaw: 0, dpitch: 0, fire: false, jump: false, kick: false, reload: false, use: false, bomb: false, over: false, last: false, slot: -1, cycle: 0 };

export function newPlayer() {
    return {
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, r: PLAYER.radius, h: PLAYER.height,
        hp: PLAYER.hp, armor: 0, fuel: PLAYER.fuelMax, ground: true, airT: 0, jet: false,
        weapons: [], cur: 0, prev: 0, switchT: 0, fireT: 0, reloadT: 0, spin: 0,
        ammo: {}, bombs: 2, keys: 0, kickT: 0, fury: 0, overdrive: 0, hurtT: 0, liqT: 0,
        dead: false, combo: { n: 0, t: 0 }, lowWarned: false, nearGun: -1, noAuto: -1,
    };
}

export function aimDir(p) {
    const cp = Math.cos(p.pitch);
    return [Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp];
}

export function switchTo(G, slot) {
    const p = G.player;
    if (slot < 0 || slot >= p.weapons.length || slot === p.cur) return;
    p.prev = p.cur;
    p.cur = slot;
    p.switchT = 0.35;
    p.reloadT = 0;
    p.spin = 0;
    ev(G, 'switch', { slot });
}

export function stepPlayer(G, inp, dt) {
    const p = G.player;
    if (p.dead) return;
    // ------------------------------------------------ look
    p.yaw += inp.dyaw || 0;
    p.yaw = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw));
    p.pitch = Math.max(-PLAYER.lookMaxPitch, Math.min(PLAYER.lookMaxPitch, p.pitch + (inp.dpitch || 0)));

    // ------------------------------------------------ weapon choice
    if (inp.slot >= 0) switchTo(G, inp.slot);
    if (inp.cycle && p.weapons.length > 1) switchTo(G, (p.cur + inp.cycle + p.weapons.length) % p.weapons.length);
    if (inp.last) switchTo(G, p.prev);

    // ------------------------------------------------ move
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    let wx = c * (inp.mx || 0) + s * (inp.my || 0);
    let wz = s * (inp.mx || 0) - c * (inp.my || 0);
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const tx = wx * PLAYER.speed, tz = wz * PLAYER.speed;
    if (p.ground || wl > 0.1) {
        const acc = (p.ground ? PLAYER.accelGround : PLAYER.accelAir) * dt;
        let dx = tx - p.vx, dz = tz - p.vz;
        const dl = Math.hypot(dx, dz);
        // in the air, only add speed toward the stick; never brake a rocket jump
        if (!p.ground) {
            const along = (p.vx * wx + p.vz * wz);
            if (along > PLAYER.speed) { dx = 0; dz = 0; }
        }
        if (dl > acc) { dx *= acc / dl; dz *= acc / dl; }
        p.vx += dx; p.vz += dz;
    }

    // ------------------------------------------------ jump and jetpack
    if (inp.jump && p.ground) {
        p.vy = PLAYER.jump; p.ground = false; p.airT = 0;
        ev(G, 'jump', {});
    }
    if (!p.ground) p.airT += dt;
    const jet = !p.ground && inp.jump && p.airT > 0.22 && p.fuel > 0;
    if (jet) {
        p.vy = Math.min(7, p.vy + PLAYER.jetThrust * dt);
        p.fuel = Math.max(0, p.fuel - PLAYER.jetBurn * dt);
    } else if (p.ground) p.fuel = Math.min(PLAYER.fuelMax, p.fuel + PLAYER.jetRegen * dt);
    if (jet !== p.jet) ev(G, jet ? 'jet_on' : 'jet_off', {});
    p.jet = jet;
    p.vy -= PLAYER.gravity * dt;

    const hit = moveBody(G, p, p.vx * dt, p.vz * dt, STEP_UP);
    if (hit.hitX) p.vx = 0;
    if (hit.hitZ) p.vz = 0;
    p.y += p.vy * dt;
    const sup = supportAt(G, p.x, p.z, p.r);
    if (p.y <= sup.floor) {
        if (!p.ground && p.vy < -9) ev(G, 'land', { v: -p.vy });
        p.y = sup.floor;
        if (p.vy < 0) p.vy = 0;
        p.ground = true; p.airT = 0;
    } else if (p.ground && p.y - sup.floor < STEP_UP + 0.05 && p.vy <= 0) {
        p.y = sup.floor; p.vy = 0;                     // walk down stairs instead of hopping
    } else p.ground = false;
    if (p.y + p.h > sup.ceil) { p.y = Math.max(sup.floor, sup.ceil - p.h); p.vy = Math.min(0, p.vy); }

    // enemies are solid
    for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = p.x - e.x, dz = p.z - e.z, rr = e.r + p.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        if (p.y > e.y + e.h - 0.1 || p.y + p.h < e.y) continue;
        const d = Math.sqrt(d2);
        moveBody(G, p, dx / d * (rr - d) * 0.6, dz / d * (rr - d) * 0.6, STEP_UP);
    }

    // liquid hurts
    if (inLiquid(G, p)) {
        p.liqT += dt;
        if (p.liqT >= 0.5) { p.liqT = 0; hurtPlayer(G, LIQUID_DPS * 0.5 / G.diff.dmg, p.x, p.z, 'liquid'); }
    } else p.liqT = 0.45;
    if (p.dead) return;

    // ------------------------------------------------ actions
    p.kickT -= dt;
    if (inp.kick && p.kickT <= 0) kick(G);
    if (inp.bomb && p.bombs > 0) throwBomb(G);
    if (inp.over && p.fury >= FURY.max && p.overdrive <= 0) {
        p.overdrive = FURY.duration; p.fury = 0;
        ev(G, 'overdrive', { on: true });
        quip(G, 'overdrive', true);
    }
    if (p.overdrive > 0) {
        p.overdrive -= dt;
        if (p.overdrive <= 0) { p.overdrive = 0; ev(G, 'overdrive', { on: false }); }
    }
    stepGun(G, inp, dt);
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.combo.t > 0) { p.combo.t -= dt; if (p.combo.t <= 0) p.combo.n = 0; }
    pickups(G, inp);
}

// ==================================================================== guns

function stepGun(G, inp, dt) {
    const p = G.player;
    p.fireT -= dt;
    p.switchT -= dt;
    const g = p.weapons[p.cur];
    if (!g) return;
    if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) {
            const take = g.infinite ? g.mag - g.clip : Math.min(g.mag - g.clip, p.ammo[g.ammo] || 0);
            g.clip += take;
            if (!g.infinite) p.ammo[g.ammo] -= take;
            ev(G, 'reloaded', {});
        }
        return;
    }
    const reserve = g.infinite ? Infinity : (p.ammo[g.ammo] || 0);
    if (inp.reload && g.clip < g.mag && reserve > 0) { startReload(G, g); return; }
    if (g.spin) p.spin = inp.fire ? Math.min(1, p.spin + dt / g.spin) : Math.max(0, p.spin - dt * 1.5);
    if (!inp.fire || p.switchT > 0 || p.fireT > 0) return;
    if (g.clip < g.ammoPer) {
        if (reserve > 0) startReload(G, g);
        else { ev(G, 'empty', {}); p.fireT = 0.35; }
        return;
    }
    fire(G, g);
    g.clip -= g.ammoPer;
    const rate = g.rate * (g.spin ? 0.3 + 0.7 * p.spin : 1);
    p.fireT = Math.max(p.fireT, 0) + 1 / rate;
    if (g.clip < g.ammoPer && reserve > 0) startReload(G, g);
}

function startReload(G, g) {
    const p = G.player;
    p.reloadT = g.reload;
    ev(G, 'reload', { t: g.reload, arch: g.arch });
}

function fire(G, g) {
    const p = G.player;
    const [dx, dy, dz] = aimDir(p);
    const ox = p.x, oy = p.y + PLAYER.eye, oz = p.z;
    // screen-right and screen-up for spread
    const rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
    const ux = -Math.sin(p.yaw) * Math.sin(p.pitch), uy = Math.cos(p.pitch), uz = Math.cos(p.yaw) * Math.sin(p.pitch);
    const rnd = () => (G.rng() + G.rng() - 1);
    const dirWithSpread = (sp) => {
        const a = rnd() * sp, b = rnd() * sp;
        const x = dx + rx * a + ux * b, y = dy + uy * b, z = dz + rz * a + uz * b;
        const l = Math.hypot(x, y, z);
        return [x / l, y / l, z / l];
    };
    if (g.kind === 'hitscan') {
        for (let k = 0; k < g.pellets; k++) {
            const [ax, ay, az] = dirWithSpread(g.spread);
            hitscan(G, ox, oy, oz, ax, ay, az, g, g.dmg);
        }
    } else if (g.kind === 'beam') {
        beam(G, ox, oy, oz, dx, dy, dz, g, g.dmg);
    } else {
        for (let k = 0; k < g.pellets; k++) {
            const side = g.pellets > 1 ? (k - (g.pellets - 1) / 2) * 0.35 : 0;
            const [ax, ay, az] = dirWithSpread(g.spread + (g.pellets > 1 ? 0.03 : 0));
            spawnProj(G, {
                x: ox + rx * (0.18 + side) + dx * 0.4, y: oy - 0.18 + dy * 0.4, z: oz + rz * (0.18 + side) + dz * 0.4,
                vx: ax * g.speed, vy: ay * g.speed, vz: az * g.speed,
                owner: 'p', dmg: g.dmg, kind: g.arch, element: g.element, splash: g.splash, splashFrac: g.splashFrac,
                bounce: g.bounce, homing: g.homing, r: g.arch === 'disc' ? 0.35 : g.arch === 'rocket' ? 0.2 : 0.15,
                life: g.arch === 'disc' ? 3 : 5, gun: { vamp: g.vamp, element: g.element, arch: g.arch },
            });
        }
    }
    noise(G, p.x, p.z, g.kind === 'beam' ? 14 : 20);
    ev(G, 'fire', { arch: g.arch, element: g.element, legendary: g.legendary, slot: p.cur, rarity: g.rarity });
}

// ==================================================================== kick, bombs

function kick(G) {
    const p = G.player;
    p.kickT = KICK.cooldown;
    const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let hits = 0;
    for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > KICK.range + e.r || e.y > p.y + 1.6 || e.y + e.h < p.y) continue;
        if (d > 0.3 && (dx * fx + dz * fz) / d < KICK.cone) continue;
        hits++;
        damageEnemy(G, e, KICK.damage * (1 + 0.12 * G.level), { src: 'p', kick: true, dx: fx, dz: fz, knock: KICK.knock });
    }
    for (const b of G.barrels) {
        if (b.dead) continue;
        const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
        if (d < KICK.range + 0.4 && (d < 0.3 || (dx * fx + dz * fz) / d > KICK.cone)) { hits++; damageBarrel(G, b, 15); }
    }
    ev(G, 'kick', { hits });
}

function throwBomb(G) {
    const p = G.player;
    const [dx, dy, dz] = aimDir(p);
    p.bombs--;
    spawnProj(G, {
        x: p.x + dx * 0.5, y: p.y + PLAYER.eye - 0.2, z: p.z + dz * 0.5,
        vx: dx * BOMB.speed + p.vx * 0.5, vy: dy * BOMB.speed + 3, vz: dz * BOMB.speed + p.vz * 0.5,
        owner: 'p', dmg: BOMB.damage * (1 + 0.12 * G.level), kind: 'bomb', splash: BOMB.radius, grav: 20, fuse: BOMB.fuse, r: 0.12, life: 10,
    });
    ev(G, 'throw', {});
}

// ==================================================================== pickups

const AMMO_PICK = { bullet: 40, shell: 10, cell: 45, rocket: 4 };

/** Would walking over this pickup take it? (The bot uses this too.) */
export function canTake(G, pk) {
    const p = G.player, k = pk.kind;
    if (k === 'cola') return p.hp < PLAYER.hpOver;
    if (k === 'burger') return p.hp < PLAYER.hpMax;
    if (k === 'vest') return p.armor < PLAYER.armorMax;
    if (AMMO_PICK[k]) return (p.ammo[k] || 0) < AMMO_MAX[k];
    if (k === 'bomb') return p.bombs < BOMB.max;
    if (k === 'gun') return freeSlot(p);
    return true;
}

/** Four swappable slots; Dad's pistol rides along outside them and can't be dropped. */
export function freeSlot(p) { return p.weapons.filter((g) => !g.infinite).length < PLAYER.slots; }

export function givePickup(G, pk) {
    const p = G.player;
    const k = pk.kind;
    if (k === 'cola') { if (!healPlayer(G, 15, true)) return false; }
    else if (k === 'burger') { if (!healPlayer(G, 50, false)) return false; }
    else if (k === 'vest') { if (p.armor >= PLAYER.armorMax) return false; p.armor = Math.min(PLAYER.armorMax, p.armor + 50); }
    else if (AMMO_PICK[k]) {
        if ((p.ammo[k] || 0) >= AMMO_MAX[k]) return false;
        p.ammo[k] = Math.min(AMMO_MAX[k], (p.ammo[k] || 0) + AMMO_PICK[k] * (pk.dropped ? 0.5 : 1));
    } else if (k === 'bomb') { if (p.bombs >= BOMB.max) return false; p.bombs++; }
    else if (k === 'key') { p.keys |= 1 << pk.key; G.keysChanged = true; }
    else if (k === 'tape') { G.tapes[G.level][pk.tape] = true; G.tally.tapes++; quip(G, 'tape', true); }
    else if (k === 'gun') {
        if (!freeSlot(p)) return false;
        p.weapons.push(pk.gun);
        p.ammo[pk.gun.ammo] = Math.min(AMMO_MAX[pk.gun.ammo], (p.ammo[pk.gun.ammo] || 0) + Math.round(pk.gun.mag * 0.5));
        switchTo(G, p.weapons.length - 1);
        if (pk.gun.rarity >= 3) quip(G, 'gun');
    }
    ev(G, 'pickup', { id: pk.id, kind: k, key: pk.key, tape: pk.tape, level: G.level, name: pk.gun?.name, rarity: pk.gun?.rarity });
    return true;
}

/** Swap the gun in your hands for the one on the floor. */
export function swapGun(G, pk) {
    const p = G.player;
    if (freeSlot(p)) return givePickup(G, pk);
    const old = p.weapons[p.cur];
    if (old.infinite) { ev(G, 'nodrop', {}); return false; }
    p.weapons[p.cur] = pk.gun;
    p.ammo[pk.gun.ammo] = Math.min(AMMO_MAX[pk.gun.ammo], (p.ammo[pk.gun.ammo] || 0) + Math.round(pk.gun.mag * 0.5));
    p.switchT = 0.35; p.reloadT = 0; p.spin = 0;
    pk.gun = old;                      // the old gun stays on the floor where the new one was
    pk.dropped = true;
    p.noAuto = pk.id;
    ev(G, 'pickup', { id: pk.id, kind: 'gun', name: p.weapons[p.cur].name, rarity: p.weapons[p.cur].rarity, swap: true });
    if (p.weapons[p.cur].rarity >= 3) quip(G, 'gun');
    return 'swap';
}

function pickups(G, inp) {
    const p = G.player;
    let near = -1, nd = 2.2 * 2.2;
    for (let k = G.pickups.length - 1; k >= 0; k--) {
        const pk = G.pickups[k];
        const dx = pk.x - p.x, dz = pk.z - p.z, d2 = dx * dx + dz * dz;
        if (Math.abs(pk.y - p.y) > 1.7) continue;
        if (pk.kind === 'gun') {
            if (d2 < nd) { nd = d2; near = pk.id; }
            if (d2 < 1.3 * 1.3 && freeSlot(p) && p.noAuto !== pk.id) {
                if (givePickup(G, pk)) G.pickups.splice(k, 1);
            }
            continue;
        }
        if (d2 < 1.25 * 1.25 && givePickup(G, pk)) G.pickups.splice(k, 1);
    }
    if (p.noAuto >= 0 && !G.pickups.some((q) => q.id === p.noAuto && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 4)) p.noAuto = -1;
    p.nearGun = near;
    if (inp.use && near >= 0) {
        const k = G.pickups.findIndex((q) => q.id === near);
        if (k >= 0) {
            const r = swapGun(G, G.pickups[k]);
            if (r === true) G.pickups.splice(k, 1);
        }
    }
}
