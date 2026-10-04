/**
 * bot.js — an auto-player. It explores room by room, kites and strafes,
 * leads its shots, rolls through bullets, throws grenades into crowds,
 * pulses when boxed in, shops and reads terminals.
 *
 * Used by dev/simtest.mjs (balance, the whole campaign headless) and by the
 * title screen's attract demo. Deterministic: it never touches w.rng.
 */

import { WEAPONS, PLAYER } from '../config.js';
import { los, angDiff, queryHash } from './core.js';
import { roomAtPos } from './level.js';
import { wants } from './world.js';

/**
 * skill 1 sees every bullet and aims true; lower skills miss a share of
 * incoming bullets, react late and aim loosely, which is closer to a person.
 */
export function makeBot(skill = 1) {
    return {
        goal: null, goalKey: '', flow: null, flowT: 0, lastX: 0, lastY: 0, stuckT: 0, wander: 0, wx: 0, wy: 0, t: 0, swapT: 0, strafe: 1, strafeT: 0,
        skill, seed: 12345, seen: new WeakMap(), jitter: 0, jitterT: 0,
    };
}

function brand(bot) { bot.seed = (bot.seed * 16807) % 2147483647; return bot.seed / 2147483647; }

function goalFlow(w, bot, gx, gy) {
    const lv = w.lv;
    const n = lv.w * lv.h;
    if (!bot.flow || bot.flow.length !== n) { bot.flow = new Uint16Array(n); bot.q = new Int32Array(n); }
    const dist = bot.flow, q = bot.q;
    dist.fill(65535);
    const s = Math.floor(gy) * lv.w + Math.floor(gx);
    let head = 0, tail = 0;
    dist[s] = 0; q[tail++] = s;
    const W = lv.w;
    while (head < tail) {
        const i = q[head++];
        const d = dist[i] + 1;
        const x = i % W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
        for (const j of nb) {
            if (j < 0 || j >= n || lv.solid[j] || dist[j] <= d) continue;
            dist[j] = d; q[tail++] = j;
        }
    }
}

function followFlow(w, bot, x, y) {
    const lv = w.lv, W = lv.w;
    const tx = Math.floor(x), ty = Math.floor(y);
    let best = bot.flow[ty * W + tx], bx = 0, by = 0, found = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= lv.h) continue;
        if (lv.solid[ny * W + nx]) continue;
        if (dx && dy && (lv.solid[ty * W + nx] || lv.solid[ny * W + tx])) continue;
        const d = bot.flow[ny * W + nx];
        if (d < best) { best = d; bx = nx + 0.5; by = ny + 0.5; found = true; }
    }
    if (!found) return null;
    const dx = bx - x, dy = by - y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
}

function chooseGoal(w) {
    const p = w.player, lv = w.lv;
    if (w.mode === 'escape') { const pad = lv.rooms[lv.padRoom]; return { x: pad.cx, y: pad.cy, key: 'pad' }; }
    if (w.mode === 'horde') { const r = lv.rooms[0]; return { x: r.cx, y: r.cy, key: 'centre' }; }
    // Items worth walking to.
    for (const it of w.items) {
        if (it.used) continue;
        if (it.kind === 'elevator' || it.kind === 'cocoon' || it.kind === 'chest' || it.kind === 'terminal' || (it.kind === 'med' && p.hp < p.maxHp * 0.7)) {
            return { x: it.x, y: it.y + (it.kind === 'terminal' ? 0.8 : 0.6), key: 'item' + it.id };
        }
        if (it.kind === 'shopitem' && p.salvage >= (it.price || 999) && wantsShop(w, it)) return { x: it.x, y: it.y + 0.6, key: 'shop' + it.id };
    }
    // A sealed room: hunt down whatever is left in it.
    if (w.activeRoom >= 0) {
        let best = null, bd = 1e9;
        for (const e of w.enemies) {
            if (e.dead || e.room !== w.activeRoom || e.spawnT > 0) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < bd) { bd = d; best = e; }
        }
        if (best) return { x: best.x, y: best.y, key: 'hunt' + best.id + ':' + Math.floor(best.x) + ',' + Math.floor(best.y) };
    }
    // Wanted pickups nearby.
    let pk = null, pd = 12;
    for (const k of w.pickups) {
        if (k.kind === 'salvage' && w.activeRoom >= 0) continue;
        if (!wants(w, k)) continue;
        const d = Math.hypot(k.x - p.x, k.y - p.y);
        if (d < pd) { pd = d; pk = k; }
    }
    if (pk) return { x: pk.x, y: pk.y, key: 'pk' + pk.id };
    // Nearest unvisited / uncleared room, the boss last.
    let best = null, bd = 1e9;
    const pending = lv.rooms.filter((r) => (!r.visited || (r.type === 'combat' && r.state !== 'cleared')) && r.type !== 'boss');
    const list = pending.length ? pending : lv.rooms.filter((r) => r.type === 'boss' && r.state !== 'cleared');
    for (const r of list) {
        const d = Math.hypot(r.cx - p.x, r.cy - p.y);
        if (d < bd) { bd = d; best = r; }
    }
    if (best) return { x: best.cx, y: best.cy, key: 'room' + best.id };
    return null;
}

function wantsShop(w, it) {
    const p = w.player;
    switch (it.item) {
    case 'medkit': return p.hp < p.maxHp * 0.7;
    case 'armor': return p.armor < 50;
    case 'mod': return p.weapons.some((x) => x.mk < 3);
    case 'weapon': return false;
    default: return true;
    }
}

function bestWeapon(w) {
    const p = w.player;
    let best = 0, bs = -1;
    const pref = { pulse: 1, scatter: 3, flame: 4, smart: 5, arc: 6, rail: 5, gl: 5, minigun: 7, plasma: 6 };
    p.weapons.forEach((x, i) => {
        if (x.mag <= 0 && x.reserve <= 0) return;
        const s = (pref[x.id] ?? 1) + x.mk;
        if (s > bs) { bs = s; best = i; }
    });
    return best;
}

export function botInput(w, bot, dt = 1 / 60) {
    const p = w.player;
    bot.t += dt;
    const input = { mx: 0, my: 0, aimX: p.x + Math.cos(p.face), aimY: p.y + Math.sin(p.face), fire: false, roll: false, grenade: false, pulse: false, interact: false, reload: false, swap: 0, slot: -1, assist: true };
    if (!p.alive) return input;

    // Target: the nearest bug we can see, bosses always.
    let tgt = null, td = 1e9, near = 0, crowdX = 0, crowdY = 0, crowdN = 0;
    let rx = 0, ry = 0;
    for (const e of w.enemies) {
        if (e.dead || e.spawnT > 0.2 || e.under) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d < 4.5) { near++; const f = 1 / Math.max(0.3, d * d); rx -= (dx / d) * f; ry -= (dy / d) * f; }
        if (d > 3.5 && d < 9) { crowdX += e.x; crowdY += e.y; crowdN++; }
        const score = d - (e.boss ? (d < 3 ? 2 : 9) : 0) - (e.type === 'sac' ? 3 : 0);
        if (score < td && d < 15 && !e.hidden && los(w.lv, p.x, p.y, e.x, e.y)) { td = score; tgt = e; }
    }
    // Bullets about to hit: dodge sideways, roll if close.
    let bx = 0, by = 0, threat = 0;
    for (const b of w.ebullets) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 16) continue;
        if (bot.skill < 1) {
            let s = bot.seen.get(b);
            if (s === undefined) { s = brand(bot) < bot.skill; bot.seen.set(b, s); }
            if (!s) continue;
        }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const along = (dx * b.vx + dy * b.vy) / sp;
        if (along < 0) continue;
        const perp = (dx * b.vy - dy * b.vx) / sp;
        if (Math.abs(perp) > 1.1) continue;
        const tti = along / sp;
        const s = perp >= 0 ? 1 : -1;
        bx += (b.vy / sp) * s / (0.2 + tti); by += (-b.vx / sp) * s / (0.2 + tti);
        if (tti < 0.28 && Math.abs(perp) < 0.6) threat++;
    }
    // Movement.
    let mx = 0, my = 0;
    bot.flowT -= dt;
    const goal = chooseGoal(w);
    const fighting = !!tgt && (w.activeRoom >= 0 || td < 9 || w.mode !== 'campaign');
    if (fighting) {
        const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
        const want = tgt.boss ? 6.5 : tgt.type === 'spitter' || tgt.type === 'husk' ? 5 : 5.5;
        bot.strafeT -= dt;
        if (bot.strafeT <= 0) { bot.strafeT = 1.2 + (bot.t % 1.3); bot.strafe = -bot.strafe; }
        const radial = d < want ? -1 : d > want + 2 ? 0.7 : 0;
        mx = (dx / d) * radial + (-dy / d) * bot.strafe * 0.8;
        my = (dy / d) * radial + (dx / d) * bot.strafe * 0.8;
        // In the escape, keep heading for the pad while shooting.
        if (w.mode === 'escape' && goal) {
            if (bot.goalKey !== goal.key || bot.flowT <= 0) { goalFlow(w, bot, goal.x, goal.y); bot.goalKey = goal.key; bot.flowT = 0.5; }
            const f = followFlow(w, bot, p.x, p.y);
            if (f) { mx = mx * 0.4 + f.x; my = my * 0.4 + f.y; }
        }
        // Pull toward the room centre so we don't get pinned in corners.
        const ri = roomAtPos(w.lv, p.x, p.y);
        if (ri >= 0) {
            const r = w.lv.rooms[ri];
            mx += (r.cx - p.x) * 0.05; my += (r.cy - p.y) * 0.05;
        }
    } else if (goal) {
        if (bot.goalKey !== goal.key || bot.flowT <= 0) { goalFlow(w, bot, goal.x, goal.y); bot.goalKey = goal.key; bot.flowT = 0.5; }
        const f = followFlow(w, bot, p.x, p.y);
        if (f) { mx = f.x; my = f.y; }
        else { mx = goal.x - p.x; my = goal.y - p.y; }
    }
    mx += rx * 2.2 + bx * 1.2;
    my += ry * 2.2 + by * 1.2;
    // Unstick.
    if (bot.wander > 0) { bot.wander -= dt; mx = bot.wx; my = bot.wy; }
    else {
        bot.stuckT += dt;
        if (bot.stuckT > 2.5) {
            const moved = Math.hypot(p.x - bot.lastX, p.y - bot.lastY);
            if (moved < 0.8 && Math.hypot(mx, my) > 0.3) { bot.wander = 0.8; const a = bot.t * 7.3; bot.wx = Math.cos(a); bot.wy = Math.sin(a); }
            bot.stuckT = 0; bot.lastX = p.x; bot.lastY = p.y;
        }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0.01) { input.mx = mx / ml; input.my = my / ml; }

    // Aim and fire with a little lead.
    if (tgt) {
        const wp = p.weapons[p.cur];
        const sp = WEAPONS[wp.id].speed ?? 30;
        const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
        const t = Math.min(0.6, d / sp);
        input.aimX = tgt.x + tgt.vx * t;
        input.aimY = tgt.y + tgt.vy * t;
        if (bot.skill < 1) {
            bot.jitterT -= dt;
            if (bot.jitterT <= 0) { bot.jitterT = 0.3; bot.jitter = (brand(bot) - 0.5) * (1 - bot.skill) * 0.8; }
            const a = Math.atan2(input.aimY - p.y, input.aimX - p.x) + bot.jitter, dd = Math.hypot(input.aimX - p.x, input.aimY - p.y);
            input.aimX = p.x + Math.cos(a) * dd; input.aimY = p.y + Math.sin(a) * dd;
        }
        input.fire = d < (wp.id === 'flame' ? 5 : 14);
        // Grenade into a crowd.
        if (crowdN >= 6 && p.grenades > 0 && (bot.t % 3) < dt) { input.aimX = crowdX / crowdN; input.aimY = crowdY / crowdN; input.grenade = true; }
    } else if (goal) {
        input.aimX = p.x + input.mx * 4; input.aimY = p.y + input.my * 4;
    }
    // Roll and pulse.
    if ((threat > 0 || near >= 4) && p.rollCd <= 0 && (bot.skill >= 1 || brand(bot) < bot.skill * 0.5)) {
        input.roll = true;
        if (threat > 0 && Math.hypot(bx, by) > 0.01) { input.mx = bx; input.my = by; }
    }
    let close = 0;
    for (const b of w.ebullets) if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 9) close++;
    if (p.pulses > 0 && (close >= 10 || (p.hp < p.maxHp * 0.3 && close >= 4) || near >= 9)) input.pulse = true;
    // Interact with what we walked to.
    if (w.prompt) {
        const pr = w.prompt;
        if (pr.kind === 'shopitem') input.interact = pr.can && pr.item !== 'weapon';
        else if (pr.kind === 'med') input.interact = p.hp < p.maxHp * 0.85;
        else if (pr.kind === 'swap') input.interact = false;
        else input.interact = true;
    }
    // Weapons.
    bot.swapT -= dt;
    if (bot.swapT <= 0) {
        bot.swapT = 1.5;
        const b = bestWeapon(w);
        if (b !== p.cur) input.slot = b;
    }
    if (!tgt && p.weapons[p.cur].mag < WEAPONS[p.weapons[p.cur].id].mag * 0.5) input.reload = true;
    return input;
}

export { PLAYER, angDiff, queryHash };
