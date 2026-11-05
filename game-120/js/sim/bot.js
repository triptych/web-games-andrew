// An auto-player. It plays through the same input the player uses, so the tests, the balance table and
// the title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.

import { TRACKS, MAX_TIER, COSTS } from './data.js';
import { yawOf, angDiff, clamp } from './core.js';
import { buy } from './game.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, t: 0, stuck: 0, lx: 0, lz: 0, jumpHold: 0, mslT: 0, sx: 1, sxT: 0, dirKeep: null, keepT: 0, noise: 1 };
}

const DIRS = 16;

export function botInput(G, bot, dt = 1 / 120) {
    const p = G.player, st = G.st, w = G.world;
    bot.t += dt; bot.mslT -= dt; bot.jumpHold -= dt; bot.sxT -= dt; bot.keepT -= dt;
    if (bot.sxT <= 0) { bot.sx = -bot.sx; bot.sxT = 1.5 + ((bot.t * 7) % 2); }
    const out = { x: 0, y: 0, aim: false, ax: 0, az: -1, ad: 26, fire: false, msl: false, jump: false, jet: false, boost: false };

    // ---- what to shoot
    let tgt = null, bd = 1e9, awakeNear = 0, inFront = 0;
    const boss = G.enemies.find((e) => e.b && e.hp > 0 && e.awake);
    const shielded = boss && boss.b.shield;
    for (const e of G.enemies) {
        if (e.hp <= 0 || (e.b && e.b.under) || (e.b && e.b.dying > 0)) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (!e.awake && d > 40) continue;
        if (d < 60) awakeNear++;
        if (d < 45 && Math.abs(angDiff(p.yaw, yawOf(e.x - p.x, e.z - p.z))) < 1.2) inFront++;
        let s = d - (e.type === 'pylon' && shielded ? 30 : 0) - (e.b && !shielded ? 6 : 0) + (e.type === 'turret' ? 4 : 0);
        if (e.b && shielded) s += 40;
        if (s < bd && d < 65) { bd = s; tgt = e; }
    }
    // pods: crack the nearest one that is close
    let pod = null;
    for (const q of G.pods) if (!q.freed) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < 40 && (!pod || d < pod.d)) pod = { q, d }; }
    let aimX = 0, aimZ = 0, aimDist = 0, haveAim = false;
    if (tgt) { aimX = tgt.x - p.x; aimZ = tgt.z - p.z; aimDist = Math.hypot(aimX, aimZ); haveAim = true; }
    else if (pod && pod.d < 36) { aimX = pod.q.x - p.x; aimZ = pod.q.z - p.z; aimDist = pod.d; haveAim = true; }
    if (haveAim) {
        const err = (1 - bot.skill) * 0.28 * Math.sin(bot.t * 3.1 + 1.3) + (1 - bot.skill) * 0.12 * Math.sin(bot.t * 11);
        const a = yawOf(aimX, aimZ) + err;
        out.aim = true; out.ax = Math.sin(a); out.az = -Math.cos(a); out.ad = aimDist;
        const wantFire = aimDist < 58 && (bot.skill > 0.8 || Math.sin(bot.t * 2.3) > -0.4);
        out.fire = wantFire;
    }

    // ---- where to go
    const aheadZ = p.z - 26;
    let gx = w.cx(aheadZ) - p.x, gz = aheadZ - p.z;
    if (G.bossAlive && -p.z > w.L - 78) {            // boss arena: kite around the boss
        const b = boss || G.enemies.find((e) => e.b);
        if (b) {
            const d = Math.hypot(b.x - p.x, b.z - p.z) || 1;
            const want = 22 + (b.r || 3) * 0.6;
            const fx = (b.x - p.x) / d, fz = (b.z - p.z) / d;
            const radial = clamp((d - want) / 6, -1.2, 1);
            gx = fx * radial + -fz * bot.sx * 0.9; gz = fz * radial + fx * bot.sx * 0.9;
            if (!b.awake) { gx = w.arena.x - p.x; gz = w.arena.z - p.z; }
        }
    } else if (G.bossDone && G.phase === 'play') { gx = w.gate.x - p.x; gz = w.gate.z - p.z; }
    else if (pod && pod.d > 14) { gx = pod.q.x - p.x; gz = pod.q.z - p.z; }
    else if (pod) { gx = -(pod.q.z - p.z) * bot.sx * 0.3; gz = (pod.q.x - p.x) * bot.sx * 0.3; }
    else if (tgt && bd < 34) {                     // fight at range: sidestep while advancing slowly
        const d = Math.hypot(tgt.x - p.x, tgt.z - p.z) || 1;
        const fx = (tgt.x - p.x) / d, fz = (tgt.z - p.z) / d;
        const radial = d < 12 ? -1 : d > 24 ? 0.6 : 0.1;
        gx = fx * radial - fz * bot.sx * 0.8 + 0.0; gz = fz * radial + fx * bot.sx * 0.8;
        const fwdx = w.cx(aheadZ) - p.x, fwdz = aheadZ - p.z, fl = Math.hypot(fwdx, fwdz) || 1;
        gx += fwdx / fl * 0.1; gz += fwdz / fl * 0.1;
    }
    // badly hurt: back off from the fight and head for a repair kit
    if (p.hp < st.maxHp * 0.42 && awakeNear > 0) {
        let rx = 0, rz = 0;
        for (const e of G.enemies) { if (e.hp <= 0 || !e.awake) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < 55) { rx -= (e.x - p.x) / (d + 1); rz -= (e.z - p.z) / (d + 1); } }
        // never retreat sideways into the wall or backwards past the start
        gx = rx; gz = rz + 0.0;
        for (const k of G.pickups) if (k.type === 'hp' && Math.hypot(k.x - p.x, k.z - p.z) < 22) { gx = k.x - p.x; gz = k.z - p.z; break; }
    }
    // loose scrap
    for (const k of G.pickups) {
        if (k.type === 'scrap' || (k.type === 'hp' && p.hp < st.maxHp * 0.7)) {
            const d = Math.hypot(k.x - p.x, k.z - p.z);
            if (d < 16 && !(tgt && bd < 14) && p.hp > st.maxHp * 0.42) { gx = k.x - p.x; gz = k.z - p.z; break; }
        }
    }
    const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;

    // ---- score steering directions by danger
    let best = null, bs = -1e9;
    const careless = bot.skill < 0.75 ? 0.5 : 1;
    for (let i = 0; i < DIRS; i++) {
        const a = (i / DIRS) * 6.2832, dx = Math.sin(a), dz = -Math.cos(a);
        let s = (dx * gx + dz * gz) * 2.2;
        for (const dist of [2.5, 6]) {
            const x = p.x + dx * dist, z = p.z + dz * dist;
            if (Math.abs(x - w.cx(z)) > w.hw(z) * 0.9) s -= 1.5;
            if (z > 4) s -= 3;
            const up = w.h(x, z) - p.y;
            if (up > 0 && up / dist > st.climb * 0.8) s -= 3;
            const hz = w.hazardAt(x, z);
            if (hz) s -= (hz.type === 'lava' ? 4 : 1.2) * careless;
            for (const b of w.near(x, z)) if (b.h > st.clear && Math.hypot(b.x - x, b.z - z) < b.r + st.rad + 0.6) s -= 2.2;
            for (const f of G.fires) if (Math.hypot(f.x - x, f.z - z) < f.r + 1) s -= (f.lava ? 4 : 1.5) * careless;
        }
        const fx = p.x + dx * 6, fz = p.z + dz * 6;
        for (const m of G.marks) if (m.t < 1.9 && Math.hypot(m.x - fx, m.z - fz) < m.r + 2.5 && m.kind !== 'drop') s -= 3.2 * careless;
        for (const m of G.marks) if (m.t < 1.9 && Math.hypot(m.x - p.x, m.z - p.z) < m.r + 1.5 && m.kind !== 'drop') s += (dx * (p.x - m.x) + dz * (p.z - m.z)) / (Math.hypot(p.x - m.x, p.z - m.z) + 0.1) * 2.5 * careless;
        let near = 0;
        for (const b of G.bullets) {
            if (b.team !== 'e') continue;
            const bx = b.x - p.x, bz = b.z - p.z;
            if (bx * bx + bz * bz > 24 * 24) continue;
            if (near++ > 14) break;
            const tx = b.x + b.vx * 0.45, tz = b.z + b.vz * 0.45;
            if (Math.hypot(tx - (p.x + dx * st.speed * 0.45), tz - (p.z + dz * st.speed * 0.45)) < st.rad + 2) s -= 0.55 * careless;
        }
        for (const e of G.enemies) {
            if (e.hp <= 0 || e.fly) continue;
            const d = Math.hypot(e.x - (p.x + dx * 3), e.z - (p.z + dz * 3));
            if (d < e.r + st.rad + 0.5) s -= 1.2;
        }
        if (s > bs) { bs = s; best = [dx, dz]; }
    }
    if (best) { out.x = best[0]; out.y = best[1]; }
    if (!tgt && !pod && !G.bossAlive) { out.x = best ? best[0] : 0; out.y = best ? best[1] : -1; }

    // ---- waves: jump them
    let wavePending = false;
    for (const wv of G.waves) {
        const d = Math.hypot(p.x - wv.x, p.z - wv.z);
        if (wv.r < d && d - wv.r < 5.5 && !wv.hit) wavePending = true;
    }
    if (wavePending && p.grounded && p.fuel >= 14) { out.jump = true; bot.jumpHold = 0.35; }
    // beams: hop when swept
    const bm = G.enemies.find((e) => e.b && e.b.act && e.b.act.k === 'beam' && e.b.act.on);
    if (bm && p.grounded && p.fuel >= 14) {
        const a = bm.b.act, bearing = yawOf(p.x - bm.x, p.z - bm.z);
        if (Math.abs(angDiff(a.ang, bearing)) < 0.22) { out.jump = true; bot.jumpHold = 0.5; }
    }
    if (!p.grounded && bot.jumpHold > 0 && p.vy < 4) out.jet = true;

    // ---- stuck: hop over it
    if (bot.t % 1 < dt) {
        const moved = Math.hypot(p.x - bot.lx, p.z - bot.lz);
        bot.stuck = moved < 0.8 && Math.hypot(out.x, out.y) > 0.5 ? bot.stuck + 1 : 0;
        bot.lx = p.x; bot.lz = p.z;
    }
    if (bot.stuck >= 1 && p.grounded && p.fuel > 20) { out.jump = true; bot.jumpHold = 0.6; bot.stuck = 1; if (bot.stuck > 2) { out.x = -out.x; } }

    // ---- boost when nothing awake is near
    if (awakeNear === 0 && p.fuel > st.fuelMax * 0.55 && !G.bossAlive && !pod) out.boost = true;

    // ---- missiles
    if (bot.mslT <= 0 && p.missiles >= 2 && ((boss && !shielded && tgt === boss && bd < 55) || inFront >= 3 || (tgt && tgt.maxhp > 300 && bd < 45))) { out.msl = true; bot.mslT = 0.7; }
    return out;
}

/** Spend scrap in the hangar: keep the five tracks roughly level, weighting guns and armour. */
export function botBuy(G) {
    const weight = { guns: 1.35, armor: 1.25, legs: 1, missiles: 0.9, fuel: 0.75 };
    let bought = 0;
    for (let guard = 0; guard < 30; guard++) {
        const cands = TRACKS.filter((t) => G.upg[t] < MAX_TIER).sort((a, b) => G.upg[a] / weight[a] - G.upg[b] / weight[b]);
        const t = cands.find((c) => COSTS[c][G.upg[c]] <= G.scrap);
        if (!t) break;
        // do not skip a much more valuable upgrade for a cheap one unless it is nearly as good
        if (cands[0] !== t && G.upg[t] / weight[t] > G.upg[cands[0]] / weight[cands[0]] + 0.9) break;
        if (!buy(G, t).ok) break;
        bought++;
    }
    return bought;
}
