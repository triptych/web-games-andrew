// The player's ship: movement, the three pilots' guns, options, rockets, halo, warp, bombs, Burst, pickups,
// grazing and being hit. Pure.

import { FIELD, PLAYER, WEAPON, BURST, SCORE, LIMITS } from '../config.js';
import { PILOT_BY_ID } from './data/pilots.js';
import { POWERUPS } from './data/powerups.js';
import { SYNERGIES } from './data/powerups.js';
import { ev, addScore, addBurst, cancelBullets, damageEnemy, hitPlayer, chainTier } from './core.js';
import { beamDist } from './patterns.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newPlayer(pilotId) {
    const pl = PILOT_BY_ID[pilotId];
    return {
        pilot: pilotId, x: PLAYER.startX, y: PLAYER.startY, vx: 0, vy: 0, hit: pl.stats.hitbox,
        power: 1, options: 0, rockets: 0, shield: 0, warpMax: 0, warp: 0, warpT: 0, halo: 0,
        overdriveT: 0, chronoT: 0, magnetT: 0, burstT: 0, bombT: 0,
        inv: 2, dead: 0, shotT: 0, optT: 0, rocketT: 0, haloA: 0, focus: false, wake: 0, wakeX: 0, wakeY: 0, wakeX2: 0, wakeY2: 0,
        graze: 0, burstFx: 0,
    };
}

// ------------------------------------------------------------------ synergies
export function synergyState(G) {
    const p = G.player;
    const have = {
        shield: p.shield > 0, warp: p.warpMax > 0, rockets: p.rockets > 0, options2: p.options >= 2, options4: p.options >= 4,
        halo: p.halo > 0, overdrive: p.overdriveT > 0, chrono: p.chronoT > 0, magnet: p.magnetT > 0,
        bombs3: G.bombs >= 3, power6: p.power >= 6,
    };
    const s = {};
    for (const syn of SYNERGIES) s[syn.id] = syn.need.every((k) => have[k]);
    return s;
}

function updateSynergies(G) {
    const now = synergyState(G);
    for (const syn of SYNERGIES) {
        if (now[syn.id] && !G.syn[syn.id]) { G.synSeen[syn.id] = (G.synSeen[syn.id] || 0) + 1; ev(G, 'synergy', { id: syn.id, name: syn.name }); }
    }
    G.syn = now;
}

// ------------------------------------------------------------------ pickups
export function collect(G, kind) {
    const p = G.player;
    switch (kind) {
        case 'P': if (p.power < WEAPON.maxPower) p.power++; else addScore(G, 10000); break;
        case 'B': if (G.bombs < PLAYER.maxBombs) G.bombs++; else addScore(G, 10000); break;
        case 'S': p.shield = Math.min(WEAPON.maxShield, p.shield + 1); break;
        case 'R': if (p.rockets < WEAPON.maxRockets) p.rockets++; else addScore(G, 10000); break;
        case 'O': if (p.options < WEAPON.maxOptions) p.options++; else addScore(G, 10000); break;
        case 'W': p.warpMax = Math.min(WEAPON.maxWarp, p.warpMax + 1); p.warp = Math.min(p.warpMax, p.warp + 1); break;
        case 'H': if (p.halo < WEAPON.maxHalo) p.halo++; else addScore(G, 10000); break;
        case 'X': p.overdriveT = WEAPON.overdrive; break;
        case 'T': p.chronoT = WEAPON.chrono; break;
        case 'M': p.magnetT = WEAPON.magnet; break;
        case 'U': G.lives++; ev(G, 'extend', { lives: G.lives }); break;
        default: break;
    }
    G.collected[kind] = (G.collected[kind] || 0) + 1;
    ev(G, 'powerup', { kind, name: POWERUPS[kind]?.name || kind, x: p.x, y: p.y });
    updateSynergies(G);
}

// ------------------------------------------------------------------ shots
function addShot(G, s) {
    if (G.shots.length >= LIMITS.shots) return;
    s.life = s.life ?? 1.2;
    s.hit = s.pierce ? [] : null;
    G.shots.push(s);
}

function nearestEnemy(G, x, y, ahead = true) {
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
        if (e.dead || (ahead && e.x < x - 1) || e.x > FIELD.w + 0.5) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
    }
    if (G.boss && G.boss.vuln && !G.boss.dead) {
        const c = G.boss.coreW;
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bd) return { id: 'boss', x: c.x, y: c.y };
    }
    return best;
}

/** The pilot's main gun, once. level 1-6, focus narrows it, mul scales damage. opt = fired by an option. */
function fireGun(G, x, y, level, focus, mul, opt = false) {
    const pl = PILOT_BY_ID[G.player.pilot];
    const sh = pl.shot;
    const dmg = sh.dmg * mul;
    if (sh.kind === 'spread') {
        const n = opt ? 1 : [3, 5, 5, 7, 7, 9][level - 1];
        const arc = opt ? 0 : focus ? 0.05 * n : 0.18 + level * 0.07;
        for (let i = 0; i < n; i++) {
            const a = n > 1 ? (i / (n - 1) - 0.5) * arc : 0;
            addShot(G, { x: x + 0.6, y: y + (focus ? (i - (n - 1) / 2) * 0.12 : 0), vx: Math.cos(a) * sh.speed, vy: Math.sin(a) * sh.speed, dmg: dmg * (focus ? 1.15 : 1), k: 'vulcan', life: 0.8 });
        }
    } else if (sh.kind === 'lance') {
        const w = opt ? 1 : focus ? 1 : Math.min(3, 1 + Math.floor(level / 2));
        for (let i = 0; i < w; i++) {
            const oy = (i - (w - 1) / 2) * 0.45;
            addShot(G, { x: x + 0.8, y: y + oy, vx: sh.speed, vy: 0, dmg: dmg * (focus ? 1.5 + level * 0.12 : 1 + level * 0.1), k: 'lance', pierce: focus ? 99 : 2 + (level >> 1), life: 0.55 });
        }
    } else {
        const n = opt ? 1 : [2, 3, 3, 4, 5, 6][level - 1];
        for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * (focus ? 0.06 : 0.35);
            const t = focus ? null : nearestEnemy(G, x, y);
            addShot(G, { x: x + 0.5, y, vx: Math.cos(a) * sh.speed, vy: Math.sin(a) * sh.speed, dmg: dmg * (focus ? 1.2 : 1), k: 'needle', life: 1.3, target: t ? t.id : null, turn: focus ? 0 : 9 });
        }
    }
}

export function optionPositions(G) {
    const p = G.player, out = [];
    const n = p.options;
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, tier = (i >> 1) + 1;
        if (p.focus) out.push({ x: p.x - 0.7 - tier * 0.35, y: p.y + side * 0.55 * tier });
        else out.push({ x: p.x - 0.6 * tier, y: p.y + side * 1.35 * tier });
    }
    return out;
}

function stepGuns(G, dt) {
    const p = G.player;
    const pl = PILOT_BY_ID[p.pilot];
    const od = p.overdriveT > 0;
    const level = od ? WEAPON.maxPower : p.power;
    const rateMul = (od ? 2 : 1) * (p.burstT > 0 ? 1.4 : 1);
    const mul = (od ? 1.5 : 1) * (p.burstT > 0 ? 1.3 : 1);
    p.shotT -= dt * rateMul;
    if (p.shotT <= 0) {
        p.shotT += pl.shot.rate;
        fireGun(G, p.x, p.y, level, p.focus, mul);
        G.firing = (G.firing || 0) + 1;
    }
    // options copy the gun (or fire lances once SERAPH WINGS is lit)
    if (p.options > 0) {
        p.optT -= dt * rateMul;
        if (p.optT <= 0) {
            p.optT += WEAPON.optionEvery;
            for (const o of optionPositions(G)) {
                if (G.syn.wings) addShot(G, { x: o.x + 0.6, y: o.y, vx: 70, vy: 0, dmg: 0.9 * mul, k: 'lance', pierce: 6, life: 0.5 });
                else fireGun(G, o.x, o.y, level, p.focus, 0.55 * mul, true);
            }
        }
    }
    // rockets
    if (p.rockets > 0) {
        p.rocketT -= dt * (G.syn.nova ? 3 : 1) * (od ? 1.5 : 1);
        if (p.rocketT <= 0) {
            p.rocketT += WEAPON.rocketEvery;
            const launch = (x, y, i) => {
                const t = nearestEnemy(G, x, y, false);
                addShot(G, { x, y, vx: 4, vy: i % 2 ? -7 : 7, dmg: WEAPON.rocketDmg * mul, k: 'rocket', life: 2.4, target: t ? t.id : null, turn: 7, accel: 30, max: WEAPON.rocketSpeed, splash: WEAPON.rocketSplash });
            };
            for (let i = 0; i < p.rockets; i++) launch(p.x, p.y, i);
            if (G.syn.swarm) optionPositions(G).forEach((o, i) => launch(o.x, o.y, i));
            ev(G, 'rockets', { n: p.rockets });
        }
    }
}

function stepShots(G, dt) {
    const out = [];
    for (const s of G.shots) {
        s.life -= dt;
        if (s.life <= 0) { if (s.splash) splash(G, s); continue; }
        if (s.target != null && s.turn) {
            const t = s.target === 'boss' ? (G.boss && G.boss.vuln && !G.boss.dead ? G.boss.coreW : null) : G.byId.get(s.target);
            if (t && !t.dead) {
                const v = Math.hypot(s.vx, s.vy) || 1;
                const a = Math.atan2(s.vy, s.vx), want = Math.atan2(t.y - s.y, t.x - s.x);
                let da = want - a;
                while (da > Math.PI) da -= Math.PI * 2;
                while (da < -Math.PI) da += Math.PI * 2;
                const na = a + clamp(da, -s.turn * dt, s.turn * dt);
                s.vx = Math.cos(na) * v; s.vy = Math.sin(na) * v;
            } else s.target = null;
        }
        if (s.accel) {
            const v = Math.hypot(s.vx, s.vy) || 1, nv = Math.min(s.max, v + s.accel * dt);
            s.vx *= nv / v; s.vy *= nv / v;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x > FIELD.w + 2 || s.x < -2 || s.y < -2 || s.y > FIELD.h + 2) continue;
        if (wallAt(G, s.x, s.y)) { if (s.splash) splash(G, s); ev(G, 'spark', { x: s.x, y: s.y }); continue; }
        if (hitSomething(G, s)) continue;
        out.push(s);
    }
    G.shots = out;
}

function splash(G, s) {
    ev(G, 'boom', { x: s.x, y: s.y, r: s.splash });
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < s.splash + e.r) damageEnemy(G, e, s.dmg * 0.5, 'rocket');
    hitBoss(G, s.x, s.y, s.splash, s.dmg * 0.4);
}

/** True when the shot is used up. */
function hitSomething(G, s) {
    for (const e of G.enemies) {
        if (e.dead) continue;
        const r = e.r + 0.22;
        const dx = e.x - s.x, dy = e.y - s.y;
        if (dx > r || dx < -r || dy > r || dy < -r || dx * dx + dy * dy > r * r) continue;
        if (s.hit) { if (s.hit.includes(e.id)) continue; s.hit.push(e.id); }
        damageEnemy(G, e, s.dmg, s.k === 'rocket' ? 'rocket' : s.k === 'needle' && s.target ? 'homing' : 'shot', s.x - s.vx * 0.02);
        G.hits++;
        if (s.splash) { splash(G, s); return true; }
        if (!s.hit || s.hit.length >= s.pierce) return true;
    }
    if (hitBoss(G, s.x, s.y, 0.22, s.dmg)) {
        if (s.splash) splash(G, s);
        if (!s.hit) return true;
        s.hit.push('boss');
        return s.hit.length >= Math.min(3, s.pierce);
    }
    return false;
}

/** Damage the boss core if (x, y, r) touches it while it is exposed. */
export function hitBoss(G, x, y, r, dmg) {
    const B = G.boss;
    if (!B || B.dead || !B.vuln || B.entering > 0) return false;
    const c = B.coreW;
    if (Math.hypot(c.x - x, c.y - y) > c.r + r) return false;
    B.hp -= dmg * (B.armor || 1);
    B.flash = 0.05;
    G.bossDmg += dmg;
    return true;
}

// ------------------------------------------------------------------ walls (capital ships, the mothership)
export function wallAt(G, x, y, pad = 0) {
    for (const w of G.walls) if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return w;
    return null;
}

function pushOutOfWalls(G) {
    const p = G.player, r = PLAYER.body;
    for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        for (const w of G.walls) {
            if (p.x + r <= w.x || p.x - r >= w.x + w.w || p.y + r <= w.y || p.y - r >= w.y + w.h) continue;
            const pens = [p.x + r - w.x, w.x + w.w - (p.x - r), p.y + r - w.y, w.y + w.h - (p.y - r)];
            const i = pens.indexOf(Math.min(...pens));
            if (i === 0) p.x = w.x - r; else if (i === 1) p.x = w.x + w.w + r; else if (i === 2) p.y = w.y - r; else p.y = w.y + w.h + r;
            moved = true;
        }
        if (!moved) break;
    }
    // squeezed off the left edge or into a wall by the scroll: that's a crash
    if (p.x < 0.3 || wallAt(G, p.x, p.y, -0.1)) {
        p.x = Math.max(0.6, p.x);
        hitPlayer(G, 'wall');
    }
}

// ------------------------------------------------------------------ bombs, warp, burst
function startBomb(G) {
    const p = G.player;
    G.bombs--;
    G.bombsUsed++;
    p.bombT = PLAYER.bombTime * (G.syn.cataclysm ? 1.5 : 1);
    p.inv = Math.max(p.inv, PLAYER.bombInv);
    cancelBullets(G, () => true, true, 150);
    G.beams.length = 0;
    ev(G, 'bomb', { x: p.x, y: p.y, big: !!G.syn.cataclysm });
    updateSynergies(G);
}

function startWarp(G, inp) {
    const p = G.player;
    const free = G.syn.phase;
    if (!free) p.warp--;
    let dx = inp.x, dy = inp.y;
    const l = Math.hypot(dx, dy);
    if (l < 0.2) { dx = 1; dy = 0; } else { dx /= l; dy /= l; }
    const x0 = p.x, y0 = p.y;
    let x1 = clamp(x0 + dx * WEAPON.warpDist, 0.8, FIELD.w - 1), y1 = clamp(y0 + dy * WEAPON.warpDist, 0.6, FIELD.h - 0.6);
    // never warp into a wall: step back along the line until clear
    for (let k = 0; k < 20 && wallAt(G, x1, y1, PLAYER.body); k++) { x1 -= dx * 0.4; y1 -= dy * 0.4; }
    p.x = x1; p.y = y1;
    p.inv = Math.max(p.inv, WEAPON.warpInv);
    const seg = { x: x0, y: y0, ang: Math.atan2(y1 - y0, x1 - x0), len: Math.hypot(x1 - x0, y1 - y0) };
    const rad = WEAPON.warpClear * (G.syn.aegis ? 2 : 1);
    cancelBullets(G, (b) => beamDist(seg, b.x, b.y) < rad, true, 60);
    for (const e of G.enemies) if (!e.dead && beamDist(seg, e.x, e.y) < e.r + 1) damageEnemy(G, e, WEAPON.warpDmg, 'warp');
    const c = G.boss && G.boss.coreW;
    if (c && beamDist(seg, c.x, c.y) < c.r + 1) hitBoss(G, c.x, c.y, 1, WEAPON.warpDmg);
    if (G.syn.aegis) { p.wake = 1.1; p.wakeX = x0; p.wakeY = y0; p.wakeX2 = x1; p.wakeY2 = y1; }
    G.warps++;
    ev(G, 'warp', { x0, y0, x1, y1, aegis: !!G.syn.aegis });
}

function startBurst(G) {
    const p = G.player;
    const pl = PILOT_BY_ID[p.pilot];
    G.burst = 0;
    p.burstT = pl.burst.time;
    p.burstFx = 0;
    p.inv = Math.max(p.inv, 1.0);
    G.bursts++;
    ev(G, 'burst', { pilot: p.pilot, name: pl.burst.name });
}

function stepBurst(G, dt) {
    const p = G.player;
    if (p.burstT <= 0) return;
    p.burstT -= dt;
    p.burstFx += dt;
    const kind = PILOT_BY_ID[p.pilot].burst.id;
    if (kind === 'starfall') {
        // blades rain across the whole screen
        while (p.burstFx > 0.05) {
            p.burstFx -= 0.05;
            const x = 6 + G.rng() * 26;
            addShot(G, { x, y: -1, vx: 6, vy: 26, dmg: 2.6, k: 'blade', life: 1.2 });
        }
    } else if (kind === 'halberd') {
        // a beam the height of the sky, straight ahead
        const band = { x: p.x, y: p.y, ang: 0, len: 40 };
        const h = 2.4;
        cancelBullets(G, (b) => b.x > p.x && Math.abs(b.y - p.y) < h, true, 40);
        for (const e of G.enemies) if (!e.dead && e.x > p.x && Math.abs(e.y - p.y) < h + e.r) damageEnemy(G, e, 38 * dt, 'burst');
        const c = G.boss && G.boss.coreW;
        if (c && c.x > p.x && Math.abs(c.y - p.y) < h + c.r) hitBoss(G, c.x, c.y, 99, 30 * dt);
        void band;
    } else {
        while (p.burstFx > 0.11) {
            p.burstFx -= 0.11;
            const t = nearestEnemy(G, p.x, p.y, false);
            const a = (G.rng() - 0.5) * 3;
            addShot(G, { x: p.x, y: p.y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, dmg: 4, k: 'phantom', life: 2, target: t ? t.id : null, turn: 6, eats: true });
        }
    }
    if (p.burstT <= 0) ev(G, 'burstEnd', {});
}

// ------------------------------------------------------------------ the step
export function stepPlayer(G, inp, dt) {
    const p = G.player;
    const pl = PILOT_BY_ID[p.pilot];
    // timers
    for (const k of ['inv', 'overdriveT', 'chronoT', 'magnetT', 'wake']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    const hadTimed = p._timed || '';
    const timed = `${p.overdriveT > 0}${p.chronoT > 0}${p.magnetT > 0}`;
    if (timed !== hadTimed) { p._timed = timed; updateSynergies(G); }

    if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) {
            if (G.lives < 0) { G.lives = 0; return 'gameover'; }
            p.x = PLAYER.startX - 3; p.y = PLAYER.startY; p.inv = PLAYER.respawnInv;
            G.bombs = Math.max(G.bombs, PLAYER.deathBombs);
            ev(G, 'respawn', {});
            updateSynergies(G);
        }
        return null;
    }

    // move
    p.focus = !!inp.focus;
    const speed = p.focus ? pl.stats.focusSpeed : pl.stats.speed;
    const l = Math.hypot(inp.x, inp.y), k = l > 1 ? 1 / l : 1;
    p.vx = inp.x * k * speed; p.vy = inp.y * k * speed;
    p.x = clamp(p.x + p.vx * dt, 0.5, FIELD.w - 0.8);
    p.y = clamp(p.y + p.vy * dt, 0.45, FIELD.h - 0.45);
    if (G.walls.length) pushOutOfWalls(G);
    if (p.dead > 0) return null;

    // actions
    if (inp.bomb && G.bombs > 0 && p.bombT <= 0) startBomb(G);
    if (inp.warp && (p.warp > 0 || (G.syn.phase && p.warpMax > 0))) startWarp(G, inp);
    if (inp.burst && G.burst >= BURST.max && p.burstT <= 0) startBurst(G);
    if (p.warpMax > 0 && p.warp < p.warpMax) {
        p.warpT += dt * (G.syn.phase ? 3 : 1);
        if (p.warpT >= WEAPON.warpRecharge) { p.warpT = 0; p.warp++; }
    }

    stepGuns(G, dt);
    stepBurst(G, dt);

    // bomb in progress
    if (p.bombT > 0) {
        p.bombT -= dt;
        cancelBullets(G, () => true, true, 20);
        const dps = PLAYER.bombDps * (G.syn.cataclysm ? 3 : 1);
        for (const e of G.enemies) if (!e.dead && e.x < FIELD.w + 0.5) damageEnemy(G, e, dps * dt, 'bomb');
        if (G.boss && G.boss.vuln) hitBoss(G, G.boss.coreW.x, G.boss.coreW.y, 99, dps * 0.35 * dt);
    }

    // halo blades
    if (p.halo > 0) {
        p.haloA += dt * 4.2;
        const n = p.halo * 2, R = WEAPON.haloRadius * (G.syn.sunwheel ? 1.45 : 1);
        for (let i = 0; i < n; i++) {
            const a = p.haloA + (i / n) * Math.PI * 2;
            const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
            const rr = WEAPON.haloBlade * (G.syn.sunwheel ? 1.4 : 1);
            const cut = cancelBullets(G, (b) => Math.abs(b.x - bx) < rr + b.r && Math.abs(b.y - by) < rr + b.r, !!G.syn.starfield, 10);
            if (cut && G.syn.sunwheel) for (let j = 0; j < cut; j++) addShot(G, { x: bx, y: by, vx: 30, vy: (G.rng() - 0.5) * 8, dmg: 1.2, k: 'refl', life: 0.7 });
            for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - bx, e.y - by) < e.r + rr) damageEnemy(G, e, WEAPON.haloDps * dt, 'halo');
            hitBoss(G, bx, by, rr, WEAPON.haloDps * 0.6 * dt);
        }
    }
    // the AEGIS JUMP wake keeps eating bullets
    if (p.wake > 0) {
        const seg = { x: p.wakeX, y: p.wakeY, ang: Math.atan2(p.wakeY2 - p.wakeY, p.wakeX2 - p.wakeX), len: Math.hypot(p.wakeX2 - p.wakeX, p.wakeY2 - p.wakeY) };
        cancelBullets(G, (b) => beamDist(seg, b.x, b.y) < 1.4, true, 20);
    }
    // phantoms eat bullets
    for (const s of G.shots) if (s.eats) cancelBullets(G, (b) => Math.abs(b.x - s.x) < 0.5 && Math.abs(b.y - s.y) < 0.5, true, 4);

    stepShots(G, dt);
    stepItems(G, dt);
    return null;
}

/** Enemy bullets and beams against the player: graze, then hits. Run after the bullets have moved. */
export function checkPlayerHits(G) {
    const p = G.player;
    if (p.dead > 0) return;
    const gr = 1.05;
    for (const b of G.bullets) {
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx > 2 || dx < -2 || dy > 2 || dy < -2) continue;
        const d = Math.hypot(dx, dy);
        if (d < b.r + p.hit) { if (hitPlayer(G, 'bullet')) return; }
        else if (d < gr + b.r && !b.g) {
            b.g = 1;
            p.graze++;
            G.grazes++;
            addScore(G, SCORE.graze * chainTier(G));
            addBurst(G, BURST.graze);
            if (p.graze % 4 === 0) ev(G, 'graze', { x: b.x, y: b.y });
        }
    }
    for (const bm of G.beams) {
        if (bm.t < bm.warm) continue;
        const d = beamDist(bm, p.x, p.y);
        if (d < bm.w * 0.5 + p.hit) { if (hitPlayer(G, 'beam')) return; }
        else if (d < bm.w * 0.5 + 1.2 && G.rng() < 0.08) { addBurst(G, BURST.graze * 0.5); G.grazes++; }
    }
}

function stepItems(G, dt) {
    const p = G.player;
    const out = [];
    const magnet = p.magnetT > 0;
    for (const it of G.items) {
        it.t += dt;
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy) || 1;
        const homing = (it.kind === 'gem' && (it.auto ? it.t > 0.35 : d < 2.2)) || (magnet && d < 11) || (it.kind === 'gem' && G.bossClear > 0);
        if (homing && p.dead <= 0) {
            const s = 24;
            it.vx = dx / d * s; it.vy = dy / d * s;
        } else {
            it.vx += (-2.2 - it.vx) * dt * 1.5;
            it.vy *= Math.pow(0.5, dt);
            if (it.kind !== 'gem') {
                // capsules bob and bounce off the top and bottom
                if (it.y < 0.8 && it.vy < 0) it.vy = -it.vy;
                if (it.y > FIELD.h - 0.8 && it.vy > 0) it.vy = -it.vy;
                it.vy += Math.sin(it.t * 3) * 0.6 * dt;
            }
        }
        it.x += it.vx * dt; it.y += it.vy * dt;
        if (p.dead <= 0 && d < 1.15) {
            if (it.kind === 'gem') {
                const v = SCORE.gem * chainTier(G) * (G.syn.golden ? 3 : 1);
                addScore(G, v);
                addBurst(G, BURST.gem);
                G.gems++;
                if (G.gems % 12 === 0) ev(G, 'gems', { x: p.x, y: p.y });
            } else collect(G, it.kind);
            continue;
        }
        if (it.x < -2 || it.t > 30) continue;
        out.push(it);
    }
    G.items = out;
}

export { startBomb, updateSynergies };
