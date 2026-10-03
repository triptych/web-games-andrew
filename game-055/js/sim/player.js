// The AH-77 Kestrel: movement, the chin gun and everything the hangar can
// bolt onto it. Reads the loadout (sim/skills.js computeLoadout) once.

import { TAU, clamp, angDiff } from './util.js';

const BASE_SPEED = 300;

export function makePlayer(w) {
    const L = w.L;
    const maxArmor = Math.max(1, L.maxArmor + w.diff.armorBonus);
    return {
        x: w.W / 2, y: w.H - 110, px: w.W / 2, py: w.H - 110, vx: 0, vy: 0,
        r: 3.4 * L.hitboxMul, graze: 24,
        armor: maxArmor, maxArmor, shield: L.shield ? 1 : 0, shieldT: 0,
        bombs: L.bombs, od: 0, odT: 0, invuln: 2.5, bombT: 0,
        focus: false, alive: true, firing: false,
        gunT: 0, mslT: 0.6, rktT: 1, arcT: 0.9, droneT: 0, regenT: 0,
        phoenix: L.phoenix, bank: 0, volley: 0, beam: false, beamLen: 0,
        drones: Array.from({ length: L.drones }, (_, i) => ({ x: w.W / 2, y: w.H - 80, side: i ? 1 : -1 })),
        hitT: 0, deadT: 0,
    };
}

function nearestEnemy(w, x, y, maxD, exclude, preferTough) {
    let best = null, bd = maxD * maxD, bestScore = -Infinity;
    for (const e of w.enemies) {
        if (!e.alive || e.delay > 0 || e.def.noHit || e.y < -10 || e.y > w.H || e.x < -10 || e.x > w.W + 10) continue;
        if (exclude && exclude.includes(e)) continue;
        let tx = e.x, ty = e.y;
        if (e.boss) { const c = w.bossTarget(e); if (!c) continue; tx = c.x; ty = c.y; }
        const dx = tx - x, dy = ty - y;
        const d = dx * dx + dy * dy;
        if (d > maxD * maxD) continue;
        if (preferTough) {
            const s = (e.boss ? 5000 : e.maxHp) - Math.sqrt(d) * 2;
            if (s > bestScore) { bestScore = s; best = e; }
        } else if (d < bd) { bd = d; best = e; }
    }
    return best;
}

export function stepPlayer(w, dt, input) {
    const p = w.player;
    const L = w.L;
    p.px = p.x; p.py = p.y;
    if (!p.alive) { p.deadT += dt; return; }
    p.focus = !!input.focus;
    const spd = BASE_SPEED * L.speedMul * (p.focus ? 0.45 : 1);
    let mx = input.mx || 0, my = input.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.x += mx * spd * dt + (input.dx || 0);
    p.y += my * spd * dt + (input.dy || 0);
    p.x = clamp(p.x, 14, w.W - 14);
    p.y = clamp(p.y, 26, w.H - 22);
    const vx = (p.x - p.px) / dt;
    p.bank += (clamp(vx / 320, -1, 1) - p.bank) * Math.min(1, dt * 8);
    p.vx = vx; p.vy = (p.y - p.py) / dt;

    p.invuln = Math.max(0, p.invuln - dt);
    p.hitT = Math.max(0, p.hitT - dt);
    if (p.odT > 0) { p.odT -= dt; if (p.odT <= 0) { p.odT = 0; w.ev('odEnd', {}); } }
    if (p.bombT > 0) {
        p.bombT -= dt;
        w.cancelBullets(false);
        for (const e of w.enemies) if (e.alive && !e.def.noHit && e.y > -20 && e.delay <= 0) w.damageEnemy(e, 70 * (L.clap ? 2 : 1) * dt * (e.boss ? 0.4 : 1), e.x, e.y, 'bomb');
    }
    if (L.regen && p.armor < p.maxArmor) {
        p.regenT += dt;
        if (p.regenT >= L.regen) { p.regenT = 0; p.armor++; w.ev('repair', { x: p.x, y: p.y }); }
    }
    if (L.shield && !p.shield) {
        p.shieldT -= dt;
        if (p.shieldT <= 0) { p.shield = 1; w.ev('shieldUp', { x: p.x, y: p.y }); }
    }

    if (input.bomb && p.bombs > 0 && p.bombT <= 0) bomb(w);
    if (input.od && p.od >= 1 && p.odT <= 0) {
        p.od = 0; p.odT = L.odDur;
        w.ev('od', { x: p.x, y: p.y });
        w.director.bark('overdrive');
    }

    // drones trail the helicopter, closing in when focused
    for (const d of p.drones) {
        const tx = p.x + d.side * (p.focus ? 24 : 42), ty = p.y + (p.focus ? -4 : 18);
        const k = 1 - Math.exp(-dt * 10);
        d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
    }

    p.firing = !!input.fire;
    p.beam = false;
    if (p.firing) fireWeapons(w, dt);
    else { p.gunT = Math.max(0, p.gunT - dt); }
}

function bomb(w) {
    const p = w.player, L = w.L;
    p.bombs--;
    p.bombT = 1.2;
    p.invuln = Math.max(p.invuln, 3 + (L.clap ? 1 : 0));
    w.stats.bombs++;
    const n = w.cancelBullets(true);
    w.addScore(n * 10, false);
    if (L.stormBreaker) w.salvageGain(n * 0.6);
    for (const e of w.enemies) if (e.alive && !e.def.noHit && e.y > -20 && e.delay <= 0) w.damageEnemy(e, 140 * (L.clap ? 2 : 1) * (e.boss ? 0.5 : 1), e.x, e.y, 'bomb');
    w.ev('bomb', { x: p.x, y: p.y, n });
    w.director.bark('bomb');
}

function fireWeapons(w, dt) {
    const p = w.player, L = w.L;
    const od = p.odT > 0;
    const rof = L.rofMul * (od ? 1.8 : 1);
    const dmgMul = L.dmgMul * (od ? 1.35 : 1);

    // ---- chin gun / ion lance
    if (L.ion && p.focus) {
        p.beam = true;
        const dps = 12 * L.rofMul * L.streams * 6.5 * dmgMul * 1.25;
        w.beamAttack(p.x, p.y - 20, 15, dps * dt);
    } else {
        p.gunT -= dt;
        const iv = 1 / (12 * rof);
        while (p.gunT <= 0) {
            p.gunT += iv;
            const streams = [[-4.5, 0], [4.5, 0]];
            if (L.streams >= 4) { const a = p.focus ? 0.035 : 0.15; streams.push([-8, -a], [8, a]); }
            if (L.streams >= 6) { const a = p.focus ? 0.075 : 0.32; streams.push([-11, -a], [11, a]); }
            p.volley++;
            for (const [ox, a] of streams) {
                const crit = L.crit > 0 && w.rng.float() < L.crit;
                const ang = -Math.PI / 2 + a + (p.focus ? 0 : p.bank * 0.03);
                w.pshot(p.x + ox, p.y - 22, ang, 1150, 6.5 * dmgMul * (crit ? 2.5 : 1) * (p.focus ? 1.25 : 1), 'gun', { pierce: L.pierce, crit });
            }
            w.ev('pshot', { x: p.x, y: p.y, v: p.volley });
        }
    }

    // ---- homing missiles
    if (L.missiles) {
        p.mslT -= dt * (od ? 1.5 : 1);
        if (p.mslT <= 0) {
            p.mslT = 1.2;
            const used = [];
            for (let i = 0; i < L.missiles; i++) {
                for (const s of [-1, 1]) {
                    const t = nearestEnemy(w, p.x, p.y, 520, used, L.hunter);
                    if (t && !t.boss) used.push(t);
                    w.pshot(p.x + s * 13, p.y + 4, Math.PI / 2 + s * (1.1 + i * 0.25), 160, 26 * L.ordMul * (od ? 1.3 : 1), 'msl', { target: t, accel: 900, max: 760, turn: 7, life: 2.6, r: 7 });
                }
            }
            w.ev('mslLaunch', { x: p.x, y: p.y });
        }
    }
    // ---- rocket pods
    if (L.rockets) {
        p.rktT -= dt * (od ? 1.5 : 1);
        if (p.rktT <= 0) {
            p.rktT = L.rockets >= 2 ? 1.05 : 1.6;
            for (let i = 0; i < 4; i++) {
                const s = i % 2 ? 1 : -1;
                w.pshot(p.x + s * 15, p.y - 6, -Math.PI / 2 + s * 0.03 * (1 + (i >> 1)), 520, 18 * L.ordMul, 'rkt', { accel: 700, max: 1000, splash: 34, splashDmg: 12 * L.ordMul, delay: (i >> 1) * 0.06, r: 6 });
            }
            w.ev('rktLaunch', { x: p.x, y: p.y });
        }
    }
    // ---- drones
    if (p.drones.length) {
        p.droneT -= dt * (od ? 1.6 : 1);
        if (p.droneT <= 0) {
            p.droneT = 0.13;
            for (const d of p.drones) {
                let ang = -Math.PI / 2;
                if (!p.focus) {
                    const t = nearestEnemy(w, d.x, d.y, 420, null, L.hunter);
                    if (t) {
                        const c = t.boss ? w.bossTarget(t) || t : t;
                        const a = Math.atan2(c.y - d.y, c.x - d.x);
                        if (Math.abs(angDiff(-Math.PI / 2, a)) < 0.6) ang = a;
                    }
                }
                w.pshot(d.x, d.y - 8, ang, 950, 5 * L.dmgMul * L.ordMul, 'drone', { r: 4 });
            }
        }
    }
    // ---- arc caster
    if (L.arc) {
        p.arcT -= dt * (od ? 1.5 : 1);
        if (p.arcT <= 0) {
            const first = nearestEnemy(w, p.x, p.y, 300, null, false);
            if (first) {
                p.arcT = 0.85;
                const chain = [first];
                const pts = [p.x, p.y - 10];
                let cur = first;
                for (let i = 0; i < 5 && cur; i++) {
                    const c = cur.boss ? w.bossTarget(cur) || cur : cur;
                    pts.push(c.x, c.y);
                    w.damageEnemy(cur, 32 * L.ordMul, c.x, c.y, 'arc');
                    cur = nearestEnemy(w, c.x, c.y, 160, chain, false);
                    if (cur) chain.push(cur);
                }
                w.ev('arc', { pts });
            } else p.arcT = 0.2;
        }
    }
}

export function addOverdrive(w, amt) {
    const p = w.player;
    if (p.odT > 0) return;
    const before = p.od;
    p.od = Math.min(1, p.od + amt);
    if (before < 1 && p.od >= 1) w.ev('odReady', {});
}

export { TAU };
