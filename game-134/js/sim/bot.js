// An auto-pilot. It plays through the same input the player uses, so the tests, the balance table and
// the title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1 notices every threat and aims true; lower skill misses threats (per threat, decided once)
// and aims with a wobble that grows as skill falls.

import { GROUND, UFO, BEAM, MOTHER, CEIL, FLOOR, DROP } from '../config.js';
import { SPECIMENS, ENEMIES, SHOTS, UPGRADES } from './data.js';
import { makeRng, mixSeed } from '../rng.js';
import { holdCap, intakeX, level, canDock } from './game.js';
import { beamHalf } from './actors.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const UP_ORDER = ['hull', 'hold', 'beam', 'speed', 'coolant', 'warranty', 'tape'];

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(mixSeed(seed * 31 + 7)), target: null, since: 0, noticed: {}, wob: 0, wobT: 0, greedy: skill >= 0.9 ? 3 : 1 };
}

function notices(bot, key) {
    if (bot.skill >= 1) return true;
    if (!(key in bot.noticed)) bot.noticed[key] = bot.rng() < bot.skill;
    return bot.noticed[key];
}

export function botInput(G, bot, dt = 1 / 120) {
    const out = { x: 0, y: 0, beam: false, a: false, drop: false, cmd: null };
    if (G.phase === 'brief') { out.a = true; return out; }
    if (G.phase === 'report') {
        out.cmd = G.offers.length ? { t: 'upgrade', id: UP_ORDER.find((k) => G.offers.includes(k)) || G.offers[0] } : { t: 'next' };
        return out;
    }
    if (G.phase !== 'play') return out;
    const u = G.ufo;
    if (u.dead > 0) return out;
    const L = level(G);

    bot.wobT -= dt;
    if (bot.wobT <= 0) { bot.wobT = 0.7; bot.wob = (bot.rng() * 2 - 1) * (1 - bot.skill) * 2.2; }

    // ---------------------------------------------------------- where to go
    let gx = u.x, gy = u.y, beam = false, drop = false;
    const home = { x: intakeX(G), y: 2.4 };
    const cap = holdCap(G);
    const boss = G.enemies.find((e) => e.kind === 'boss');
    const homeDist = Math.abs(u.x - home.x);
    const tripTime = homeDist / (UFO.speed * 0.8) + 3;
    const needed = L.quota - G.stats.bankedN;

    let goHome = false;
    if (canDock(G) && !u.hold.length) {
        // quota met: grab a few extras if there's time, then dock
        goHome = G.stats.bankedN >= L.quota + bot.greedy * 2 || G.timeLeft < tripTime + 12 || L.boss;
    } else if (u.hold.length >= cap) goHome = true;
    else if (u.hold.length && !L.boss && u.hold.length >= needed) goHome = true;
    else if (u.hold.length && G.timeLeft < tripTime + 2) goHome = true;

    let target = null;
    if (boss && u.hold.length && !goHome) {
        // bombing run: lead the boss by the fall time
        const fall = Math.sqrt((2 * (GROUND - ENEMIES.boss.h - u.y)) / DROP.gravity);
        const lead = boss.x + boss.dir * ENEMIES.boss.walk * fall * (boss.wind > 0 || boss.fire > 0 ? 0 : 1);
        gx = lead;
        gy = 4.5;
        if (Math.abs(u.x - lead) < 0.9 && u.y < GROUND - ENEMIES.boss.h - 2 && boss.inv <= 0) drop = true;
    } else if (goHome) {
        gx = home.x; gy = home.y;
    } else {
        target = pickTarget(G, bot);
        if (target) {
            gx = target.x + (target.state === 'walk' ? target.dir * SPECIMENS[target.kind].walk * 0.4 : 0) + bot.wob;
            gy = clamp(GROUND - 7, CEIL + 1, FLOOR - 1);
            const mid = target.y - SPECIMENS[target.kind].h / 2;
            const half = beamHalf(G, mid);
            const aligned = Math.abs(u.x - target.x) < half * 0.75 || (u.beam && target.state === 'lift');
            const foilInCone = G.enemies.some((e) => e.kind === 'tinfoil' && Math.abs(e.x - u.x) < beamHalf(G, GROUND - 1) + 0.6);
            beam = aligned && !u.lock && !(foilInCone && notices(bot, 'foil'));
            if (u.beam && target.state === 'lift') gx = target.x;
        } else { gx = home.x + Math.sin(G.t * 0.3) * 10; gy = 6; }
        // a skilled pilot drops spare livestock on armour it passes over
        if (bot.skill >= 0.9 && u.hold.length >= 2 && !beam) {
            for (const e of G.enemies) {
                if (!ENEMIES[e.kind].armored || e.kind === 'boss') continue;
                const fall = Math.sqrt((2 * Math.max(0.5, GROUND - ENEMIES[e.kind].h - u.y)) / DROP.gravity);
                if (Math.abs(u.x - (e.x + (e.wind > 0 ? 0 : e.dir * ENEMIES[e.kind].walk * fall))) < 0.6) drop = true;
            }
        }
    }

    let mx = clamp((gx - u.x) * 0.9, -1, 1);
    let my = clamp((gy - u.y) * 0.9, -1, 1);
    if (Math.abs(gx - u.x) < 0.15) mx = 0;

    // ---------------------------------------------------------- staying alive
    const dodge = threat(G, bot);
    if (dodge) { mx = dodge.x; my = dodge.y; if (dodge.stopBeam) beam = false; }

    if (u.fx.dazzle > 0) { mx = -mx; my = -my; }   // it knows its controls are backwards
    out.x = mx; out.y = my; out.beam = beam; out.drop = drop;
    return out;
}

function pickTarget(G, bot) {
    const u = G.ufo;
    const cur = bot.target != null && G.specs.find((s) => s.id === bot.target);
    if (cur && cur.noBeam <= 0) {
        bot.since += 1 / 120;
        if (bot.since < 6) return cur;
    }
    let best = null, bs = -Infinity;
    for (const s of G.specs) {
        if (s.noBeam > 0 && s.state !== 'fall') continue;
        if (s.state === 'fall') continue;
        const d = SPECIMENS[s.kind];
        let score = d.value / (Math.abs(s.x - u.x) + 6);
        if (level(G).order === s.kind && !G.stats.banked[s.kind]) score *= 2;
        if (!G.stats.banked[s.kind]) score *= 1.3;
        for (const e of G.enemies) {
            if (Math.abs(e.x - s.x) < 3.5 && (e.kind === 'tinfoil' || e.kind === 'gunner') && notices(bot, 'near' + e.id)) score *= 0.5;
        }
        if (s.wake && s.daze < 2.2) score *= 0.3;
        if (cur && s.id === cur.id) score *= 0.6;       // stuck on it too long: try another
        if (score > bs) { bs = score; best = s; }
    }
    bot.target = best ? best.id : null;
    bot.since = 0;
    return best;
}

/** The way out of the most urgent danger, or null. */
function threat(G, bot) {
    const u = G.ufo;
    if (u.fx.shield > 0) return null;
    // a laser column about to fire, or firing
    for (const e of G.enemies) {
        if ((e.kind === 'laser' || e.kind === 'boss') && (e.wind > 0 || e.fire > 0) && e.aimX && notices(bot, 'las' + e.id + ':' + e.pattern + (e.cd | 0))) {
            const dx = u.x - e.aimX;
            if (Math.abs(dx) < 2.6) return { x: dx >= 0 ? 1 : -1, y: 0, stopBeam: true };
        }
        if ((e.kind === 'gunner' || e.kind === 'agent' || e.kind === 'tank') && e.wind > 0 && notices(bot, 'w' + e.id + (e.cd | 0))) {
            const dx = u.x - e.x, dy = u.y - (GROUND - ENEMIES[e.kind].h);
            if (Math.hypot(dx, dy) < ENEMIES[e.kind].range + 1.5 && e.kind === 'gunner') return { x: dx >= 0 ? 1 : -1, y: -1, stopBeam: false };
        }
        if (e.kind === 'tinfoil' && e.wind > 0 && Math.abs(u.x - e.x) < 5 && notices(bot, 'fl' + e.id + (e.cd | 0))) {
            return { x: u.x >= e.x ? 1 : -1, y: -0.5, stopBeam: true };
        }
    }
    // jets
    for (const j of G.jets) {
        if (Math.abs(u.y - j.y) < 1.8 && (j.warn > 0 || (u.x - j.x) * j.dir > -3) && notices(bot, 'jet' + j.y.toFixed(2))) {
            const up = j.y > (CEIL + FLOOR) / 2;
            return { x: 0, y: (u.y < j.y) === true ? -1 : 1, stopBeam: false, ...(Math.abs(u.y - j.y) < 0.3 ? { y: up ? -1 : 1 } : {}) };
        }
    }
    // bullets: look ahead along each shot
    let best = null, bt = Infinity;
    for (const s of G.shots) {
        const r = SHOTS[s.kind].r + 1.0;
        for (let t = 0; t <= 0.55; t += 0.05) {
            const sx = s.x + s.vx * t - (u.x + u.vx * t * 0.3), sy = s.y + s.vy * t - (u.y + u.vy * t * 0.3);
            if ((sx / (UFO.rx + r)) ** 2 + (sy / (UFO.ry + r)) ** 2 < 1) {
                if (t < bt && notices(bot, 'sh' + Math.round(s.x * 7) + ':' + Math.round(s.vx))) { bt = t; best = s; }
                break;
            }
        }
    }
    if (best) {
        // step sideways to the shot's path, away from the line it is on
        const l = Math.hypot(best.vx, best.vy) || 1;
        let px = -best.vy / l, py = best.vx / l;
        const side = (u.x - best.x) * px + (u.y - best.y) * py;
        if (side < 0) { px = -px; py = -py; }
        if (u.y + py * 2 > FLOOR || u.y + py * 2 < CEIL) py = 0;
        if ((u.x + px * 2 > G.W - 2 && px > 0) || (u.x + px * 2 < 2 && px < 0)) px = -px;
        return { x: px, y: py, stopBeam: bt < 0.25 };
    }
    return null;
}

export { MOTHER, BEAM, UPGRADES };
