// One brain for both sides: the enemy phase uses it unit by unit, and the test bot uses it to play
// the player's pieces. It scores every legal move and ability for a unit by looking one action ahead
// (expected damage, who is left standing where) and picks the best. Pure.

import { genMoves, unitAt, attacksSquare, tileAt, inB, walkable } from './moves.js';
import { forecast, expected, spellDamage } from './battle.js';
import { abilityTargets } from './abilities.js';
import { hash3 } from '../rng.js';

const man = (a, x, y) => Math.abs(a.x - x) + Math.abs(a.y - y);
const cheb = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y));

function nearestFoe(B, u, x, y) {
    let best = 99;
    for (const o of B.units) if (o.team !== u.team) best = Math.min(best, Math.abs(o.x - x) + Math.abs(o.y - y));
    return best;
}

/** How many enemy pieces could take u if it stood on (x, y)? `ignore` is a piece about to die. */
function threatAt(B, u, x, y, ignore = null) {
    const ox = u.x, oy = u.y;
    u.x = x; u.y = y;
    let n = 0;
    for (const o of B.units) if (o.team !== u.team && o !== ignore && attacksSquare(B, o, x, y)) n++;
    u.x = ox; u.y = oy;
    return n;
}

/** Steps to the nearest enemy of `team` from every square, walking round walls and chasms (pieces ignored).
 *  Distance by Manhattan metric gets a piece stuck behind a chasm; this does not. */
function distField(B, team) {
    const f = Array.from({ length: B.h }, () => Array(B.w).fill(99));
    const q = [];
    for (const o of B.units) if (o.team !== team) { f[o.y][o.x] = 0; q.push([o.x, o.y]); }
    for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!inB(B, nx, ny) || f[ny][nx] <= f[y][x] + 1 || !walkable(B, nx, ny)) continue;
            f[ny][nx] = f[y][x] + 1;
            q.push([nx, ny]);
        }
    }
    return f;
}

/** How many captures u would have from (x, y), if nothing else moved. A piece that cannot take its
 *  neighbour (a rider next to a king) needs this to find the square from which it can. */
function capsFrom(B, u, x, y) {
    const ox = u.x, oy = u.y;
    u.x = x; u.y = y;
    const n = genMoves(B, u).filter((m) => m.kind === 'cap').length;
    u.x = ox; u.y = oy;
    return n;
}

const wounded = (u) => u.hp < u.hpMax * 0.4;
const kill = (d) => 14 + d.hpMax * 0.4 + (d.boss ? 30 : 0);

function scoreMove(B, u, m, risk, field) {
    if (m.kind === 'cap') {
        const d = unitAt(B, m.to[0], m.to[1]);
        const ex = expected(forecast(B, u, d, m.stop), u.hp, d.hp);
        let s = ex.dealt * 2 - ex.taken * 1.2;
        if (ex.kills) s += kill(d);
        if (ex.dies) s -= 25 + u.hpMax * 0.6;
        const end = ex.kills ? m.to : m.stop;
        s -= 3 * risk * threatAt(B, u, end[0], end[1], ex.kills ? d : null) * (wounded(u) ? 2 : 1);
        return s;
    }
    return -1.1 * field[m.to[1]][m.to[0]] + 5 * Math.min(2, capsFrom(B, u, m.to[0], m.to[1]))
        - 3.5 * risk * threatAt(B, u, m.to[0], m.to[1]) * (wounded(u) ? 2 : 1);
}

function scoreAbility(B, u, tx, ty) {
    const tgt = unitAt(B, tx, ty);
    switch (u.ability) {
        case 'heal': {
            const n = Math.min(Math.max(8, Math.round(tgt.hpMax * 0.45)), tgt.hpMax - tgt.hp);
            return n < 6 ? -Infinity : n * 1.5 * (tgt.hp < tgt.hpMax * 0.6 ? 1.5 : 0.7);
        }
        case 'smite': case 'drain': {
            const dmg = spellDamage(B, u, tgt, u.ability === 'drain' ? 1.1 : 1);
            return dmg * 2 + (dmg >= tgt.hp ? kill(tgt) : 0) + (u.ability === 'drain' ? Math.min(dmg, u.hpMax - u.hp) : 0);
        }
        case 'flame': {
            let s = 0;
            for (const o of B.units) if (o.team !== u.team && Math.abs(o.x - tx) <= 1 && Math.abs(o.y - ty) <= 1) {
                const dmg = spellDamage(B, u, o, 0.9);
                s += dmg * 2 + (dmg >= o.hp ? kill(o) : 0);
            }
            return s;
        }
        case 'hook': return 5;
        case 'shove': {
            const dx = Math.sign(tx - u.x), dy = Math.sign(ty - u.y);
            const t1 = tileAt(B, tx + dx, ty + dy) ?? '#';
            if (t1 === '~') return 40 + tgt.hpMax * 0.4;
            const t2 = t1 === '#' ? '#' : (tileAt(B, tx + 2 * dx, ty + 2 * dy) ?? '#');
            return t2 === '~' ? 40 + tgt.hpMax * 0.4 : t1 === '#' || t2 === '#' ? 7 : 3;
        }
        case 'hex': return tgt.mods.some((m) => m.name === 'Hex') ? -Infinity : 7 + (tgt.def >= 3 ? 2 : 0);
        case 'ward': return tgt.mods.some((m) => m.name === 'Aegis') || nearestFoe(B, tgt, tgt.x, tgt.y) > 4 ? -Infinity : 8;
        case 'bulwark': return nearestFoe(B, u, u.x, u.y) <= 4 && !u.mods.some((m) => m.name === 'Vigil') ? 6 : -Infinity;
        case 'rally': {
            const n = B.units.filter((o) => o.team === u.team && cheb(u, o.x, o.y) <= 2 && nearestFoe(B, o, o.x, o.y) <= 4).length;
            return n >= 2 ? 4 * n : -Infinity;
        }
        case 'blink': {
            const before = nearestFoe(B, u, u.x, u.y);
            const after = nearestFoe(B, u, tx, ty);
            return before > 3 ? (before - after) * 0.8 - 4 * threatAt(B, u, tx, ty) - 1 : -Infinity;
        }
        case 'encore': return genMoves(B, tgt).some((m) => m.kind === 'cap') ? 12 : -Infinity;
        default: return -Infinity;     // swap: the brain does not use it
    }
}

/** The best thing this unit can do: { cmd, score }. */
export function bestForUnit(G, u) {
    const B = G.battle;
    let best = null;
    const consider = (cmd, score) => {
        score += hash3(u.id, cmd.to ? cmd.to[0] * 8 + cmd.to[1] : 99, B.turn) * 0.2;      // break ties without Math.random
        if (!best || score > best.score) best = { cmd, score };
    };

    // a boss sits on its throne until someone comes near or it is hurt
    const holds = u.team === 'e' && u.boss && u.hp === u.hpMax && nearestFoe(B, u, u.x, u.y) > 4;
    // the dead are reckless; the bot starts careful and grows bolder every round, so no fight stalls
    const field = distField(B, u.team);
    const risk = u.team === 'e' ? 0.4 : Math.max(0.2, 1 - B.turn * 0.08);

    for (const m of genMoves(B, u)) {
        if (holds && m.kind !== 'cap') continue;
        consider({ t: 'move', id: u.id, to: m.to }, scoreMove(B, u, m, risk, field));
    }
    for (const [x, y] of abilityTargets(B, u)) {
        const s = scoreAbility(B, u, x, y);
        if (s > -Infinity) consider({ t: 'ability', id: u.id, to: [x, y] }, s);
    }
    const stay = -1.1 * field[u.y][u.x] - 3.5 * risk * threatAt(B, u, u.x, u.y) - 0.6;
    consider({ t: 'wait', id: u.id }, holds ? 0 : stay);
    return best;
}

/** The best action among a team's pieces that have not acted. Null when none are left. */
export function bestForTeam(G, team) {
    let best = null;
    for (const u of G.battle.units) {
        if (u.team !== team || u.acted) continue;
        const b = bestForUnit(G, u);
        if (b && (!best || b.score > best.score)) best = b;
    }
    return best;
}
