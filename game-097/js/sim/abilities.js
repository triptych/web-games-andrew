// Special abilities: who each can target, and what it does. Pure. Every ability costs the unit its
// action and then rests for ABILITIES[id].cd rounds.

import { ABILITIES } from './data.js';
import { inB, unitAt, walkable, tileAt } from './moves.js';
import { spellDamage } from './battle.js';
import { addMod, killUnit, gainXp, xpFor } from './core.js';

const cheb = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y));
const man = (a, x, y) => Math.abs(a.x - x) + Math.abs(a.y - y);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** The first piece along a line from u, if bolts can reach it: walls stop a bolt, chasms do not. */
function firstInLine(B, u, dx, dy, range) {
    for (let i = 1; i <= range; i++) {
        const x = u.x + dx * i, y = u.y + dy * i;
        if (!inB(B, x, y) || tileAt(B, x, y) === '#') return null;
        const o = unitAt(B, x, y);
        if (o) return o;
    }
    return null;
}

export const abilityName = (u, def) => def.abilityName || ABILITIES[def.ability].name;

/** Squares this unit's ability can be aimed at right now ([] while resting). */
export function abilityTargets(B, u) {
    if (!u.ability || u.cd > 0 || u.acted) return [];
    const foe = (o) => o.team !== u.team, ally = (o) => o.team === u.team;
    const out = [];
    const pushUnit = (o) => out.push([o.x, o.y]);
    switch (u.ability) {
        case 'heal': for (const o of B.units) if (ally(o) && man(u, o.x, o.y) <= 3 && o.hp < o.hpMax) pushUnit(o); break;
        case 'ward': for (const o of B.units) if (ally(o) && cheb(u, o.x, o.y) <= 2) pushUnit(o); break;
        case 'rally': case 'bulwark': out.push([u.x, u.y]); break;
        case 'hex': for (const o of B.units) if (foe(o) && cheb(u, o.x, o.y) <= 3) pushUnit(o); break;
        case 'drain': case 'shove': for (const o of B.units) if (foe(o) && cheb(u, o.x, o.y) === 1) pushUnit(o); break;
        case 'smite': case 'hook':
            for (const [dx, dy] of DIRS) { const o = firstInLine(B, u, dx, dy, 4); if (o && foe(o)) pushUnit(o); }
            break;
        case 'swap':
            for (const [dx, dy] of DIRS) for (let i = 1; i <= 5; i++) {
                const o = unitAt(B, u.x + dx * i, u.y + dy * i);
                if (o && ally(o)) pushUnit(o);
            }
            break;
        case 'encore': for (const o of B.units) if (ally(o) && o !== u && o.acted && man(u, o.x, o.y) <= 3) pushUnit(o); break;
        case 'blink':
            for (let y = u.y - 3; y <= u.y + 3; y++) for (let x = u.x - 3; x <= u.x + 3; x++)
                if (walkable(B, x, y) && !unitAt(B, x, y)) out.push([x, y]);
            break;
        case 'flame':
            for (let y = u.y - 3; y <= u.y + 3; y++) for (let x = u.x - 3; x <= u.x + 3; x++) {
                if (!inB(B, x, y) || (x === u.x && y === u.y)) continue;
                if (B.units.some((o) => foe(o) && Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1)) out.push([x, y]);
            }
            break;
    }
    return out;
}

export function canTarget(B, u, x, y) {
    return abilityTargets(B, u).some((t) => t[0] === x && t[1] === y);
}

const sign = (v) => Math.sign(v);

/** Do it. Assumes canTarget() was checked. Returns the 'ability' event (also pushed on G.events). */
export function applyAbility(G, u, tx, ty) {
    const B = G.battle;
    const fx = [];
    const from = [u.x, u.y];
    const tgt = unitAt(B, tx, ty);
    const hurt = [];
    const dmgTo = (o, n, extra = {}) => {
        o.hp = Math.max(0, o.hp - n);
        fx.push({ id: o.id, dmg: n, hp: o.hp, ...extra });
        hurt.push(o);
    };

    switch (u.ability) {
        case 'heal': {
            const n = Math.min(Math.max(8, Math.round(tgt.hpMax * 0.45)), tgt.hpMax - tgt.hp);
            tgt.hp += n; fx.push({ id: tgt.id, heal: n, hp: tgt.hp });
            break;
        }
        case 'ward': addMod(tgt, { name: 'Aegis', def: 5, turns: 2, good: true }); fx.push({ id: tgt.id, mod: 'Aegis +5 DEF' }); break;
        case 'rally':
            for (const o of B.units) if (o.team === u.team && cheb(u, o.x, o.y) <= 2) { addMod(o, { name: 'Hymn', atk: 4, turns: 2, good: true }); fx.push({ id: o.id, mod: 'Hymn +4 ATK' }); }
            break;
        case 'bulwark': {
            addMod(u, { name: 'Vigil', def: 6, turns: 2, good: true });
            const n = Math.min(6, u.hpMax - u.hp); u.hp += n;
            fx.push({ id: u.id, mod: 'Vigil +6 DEF', heal: n, hp: u.hp });
            break;
        }
        case 'hex': addMod(tgt, { name: 'Hex', def: -4, spd: -3, turns: 3, good: false }); fx.push({ id: tgt.id, mod: 'Hex −4 DEF −3 SPD' }); break;
        case 'blink': u.x = tx; u.y = ty; fx.push({ id: u.id, moved: [tx, ty] }); break;
        case 'swap': {
            tgt.x = from[0]; tgt.y = from[1]; u.x = tx; u.y = ty;
            fx.push({ id: u.id, moved: [tx, ty] }, { id: tgt.id, moved: from.slice() });
            break;
        }
        case 'encore': tgt.acted = false; fx.push({ id: tgt.id, mod: 'Acts again' }); break;
        case 'smite': dmgTo(tgt, spellDamage(B, u, tgt, 1)); break;
        case 'drain': {
            const n = spellDamage(B, u, tgt, 1.1);
            dmgTo(tgt, n);
            const h = Math.min(n, u.hpMax - u.hp); u.hp += h;
            fx.push({ id: u.id, heal: h, hp: u.hp });
            break;
        }
        case 'flame':
            for (const o of B.units.slice()) {
                if (o.team !== u.team && Math.abs(o.x - tx) <= 1 && Math.abs(o.y - ty) <= 1) dmgTo(o, spellDamage(B, u, o, 0.9));
            }
            break;
        case 'hook': {
            const dx = sign(tx - u.x), dy = sign(ty - u.y);
            let x = tgt.x, y = tgt.y;
            while (true) {
                const nx = x - dx, ny = y - dy;
                if (nx === u.x && ny === u.y) break;
                if (!walkable(B, nx, ny) || unitAt(B, nx, ny)) break;
                x = nx; y = ny;
            }
            const moved = x !== tgt.x || y !== tgt.y;
            tgt.x = x; tgt.y = y;
            dmgTo(tgt, 3, moved ? { moved: [x, y] } : {});
            break;
        }
        case 'shove': {
            const dx = sign(tx - u.x), dy = sign(ty - u.y);
            let x = tgt.x, y = tgt.y, extra = 0, fell = false, hit = null;
            for (let i = 0; i < 2; i++) {
                const nx = x + dx, ny = y + dy;
                if (!inB(B, nx, ny) || tileAt(B, nx, ny) === '#') { extra = 4; break; }
                if (tileAt(B, nx, ny) === '~') { x = nx; y = ny; fell = true; break; }
                const o = unitAt(B, nx, ny);
                if (o) { extra = 3; hit = o; break; }
                x = nx; y = ny;
            }
            tgt.x = x; tgt.y = y;
            if (fell) { tgt.hp = 0; fx.push({ id: tgt.id, dmg: 99, hp: 0, moved: [x, y], fell: true }); hurt.push(tgt); }
            else {
                dmgTo(tgt, 2 + extra, x !== tx || y !== ty ? { moved: [x, y] } : {});
                if (hit) dmgTo(hit, extra);
            }
            break;
        }
    }

    const ev = { type: 'ability', id: u.id, ab: u.ability, name: ABILITIES[u.ability].name, from, to: [tx, ty], el: u.el, fx };
    G.events.push(ev);

    // casualties, in the order they fell; the caster earns the XP
    const dead = [...new Set(hurt)].filter((o) => o.hp <= 0);
    for (const o of dead) {
        const fell = fx.some((f) => f.id === o.id && f.fell);
        gainXp(G, u, xpFor(u, o, true));
        killUnit(G, o, fell ? 'fall' : 'slain');
    }
    if (!dead.length) gainXp(G, u, hurt.some((o) => o.team !== u.team) ? 10 : 8);

    u.cd = ABILITIES[u.ability].cd;
    u.acted = true;
    return ev;
}
