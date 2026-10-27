// Auto-explore: one command at a time, through the same act() the player uses. It opens every chest,
// gathers, reads tablets, explores every reachable square, fights every battle with the party's
// automatic commands, and heals anyone who drops under a threshold (field skills first, then potions).
// It stops when the floor is done, when it can't heal the party, or when nothing is changing. Pure.

import { DIRS } from '../config.js';
import { calc, isAlive } from './party.js';
import { cellIdx, featAt, getEdge, passable, inb } from './dungeon.js';
import { autoCmds } from './battle.js';
import { act } from './game.js';
import { POTIONS } from './items.js';

export function makeAuto(o = {}) {
    return { heal: o.heal ?? 0.5, idle: 0, last: '', cmds: 0 };
}

const frac = (m) => m.hp / calc(m).maxhp;
const potions = (G, eff) => G.inv.filter((x) => x.t === 'p' && x.eff === eff);
const relMove = (facing, dir) => ['f', 'sr', 'b', 'sl'][(dir - facing + 4) % 4];

/** First direction of a shortest path to the nearest square satisfying goal, never entering `blocked` squares. */
function pathDir(f, sx, sy, goal, blocked) {
    const prev = new Int8Array(f.w * f.h).fill(-2);
    const q = [cellIdx(f, sx, sy)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], x = c % f.w, y = (c / f.w) | 0;
        if ((x !== sx || y !== sy) && goal(x, y)) {
            let k = c, d = -1;
            while (prev[k] !== -1) { d = prev[k]; k = cellIdx(f, (k % f.w) - DIRS[d].dx, ((k / f.w) | 0) - DIRS[d].dy); }
            return d;
        }
        for (let d = 0; d < 4; d++) {
            if (!passable(getEdge(f, x, y, d))) continue;
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny) || blocked(nx, ny)) continue;
            const ni = cellIdx(f, nx, ny);
            if (prev[ni] !== -2) continue;
            prev[ni] = d;
            q.push(ni);
        }
    }
    return -1;
}

/** Try to heal someone under the threshold. Returns true if it did something, 'none' if someone needs it and nothing can help. */
function healStep(G, thr) {
    const hurt = G.party.map((m, i) => ({ m, i, f: frac(m) })).filter((x) => isAlive(x.m) && x.f < thr).sort((a, b) => a.f - b.f);
    const fallen = G.party.findIndex((m) => !isAlive(m));
    if (!hurt.length && fallen < 0) return false;
    // the fallen first: a revive skill, then a revival draught
    if (fallen >= 0) {
        for (const [i, m] of G.party.entries()) {
            if (isAlive(m) && m.cls === 'cleric' && m.lvl >= 20 && m.mp >= 20) { const before = G.party[fallen].hp; act(G, { t: 'skill', who: i, skill: 'revive', target: fallen }); if (G.party[fallen].hp > before) return true; }
        }
        const rv = potions(G, 'revive')[0];
        if (rv) { act(G, { t: 'use', item: rv.id, who: fallen }); return true; }
    }
    if (!hurt.length) return fallen >= 0 ? 'none' : false;
    const worst = hurt[0];
    for (const sk of ['healall', 'heal', 'tonic', 'elixirdose']) {
        for (const [i, m] of G.party.entries()) {
            if (!isAlive(m)) continue;
            const before = G.party.map((p) => p.hp).join();
            const mp = m.mp;
            act(G, { t: 'skill', who: i, skill: sk, target: worst.i });
            if (G.party.map((p) => p.hp).join() !== before || m.mp !== mp) return true;
        }
    }
    const pot = potions(G, 'heal').sort((a, b) => a.pot - b.pot)[0];
    if (pot && POTIONS.heal) { act(G, { t: 'use', item: pot.id, who: worst.i }); return true; }
    return 'none';
}

export function exploredFrac(f) {
    let v = 0;
    for (let i = 0; i < f.seen.length; i++) if (f.seen[i] === 2) v++;
    return v / f.seen.length;
}

/** One step of auto-explore. Returns { stop: bool, msg, done } and has acted unless stop. */
export function autoStep(G, st) {
    st.cmds++;
    if (!G.floor && !G.battle) return { stop: true, msg: 'Auto-explore stopped: the party is back in town.' };
    const sig = `${G.steps}|${G.stats.kills}|${G.gold}|${G.inv.length}|${exploredFrac(G.floor || { seen: [0] })}|${G.dialog ? G.dialog.kind : ''}|${G.battle ? G.battle.round : ''}`;
    if (sig === st.last) { if (++st.idle > 40) return { stop: true, msg: 'Auto-explore stopped: nothing is changing.' }; } else { st.idle = 0; st.last = sig; }

    // fights: the party's own automatic commands; flee a hopeless one
    if (G.battle) {
        const B = G.battle;
        if (B.over) { act(G, { t: 'endBattle' }); return { stop: false }; }
        const hp = G.party.reduce((a, m) => a + Math.max(0, m.hp), 0) / G.party.reduce((a, m) => a + calc(m).maxhp, 0);
        if (hp < 0.2 && !B.boss && !potions(G, 'heal').length) { act(G, { t: 'flee' }); return { stop: false }; }
        act(G, { t: 'round', cmds: autoCmds(G) });
        return { stop: false };
    }
    // whatever is open
    if (G.dialog) {
        const D = G.dialog, has = (id) => D.opts.some((o) => o.id === id && !o.off);
        let id = 'ok';
        if (D.kind === 'chest') id = has('disarm') && G.rng() < 0.6 ? 'disarm' : 'open';
        else if (D.kind === 'gather') id = 'gather';
        else if (D.kind === 'spring') id = 'drink';
        else if (D.kind === 'stairs' || D.kind === 'altar' || D.kind === 'merchant' || D.kind === 'npc') id = 'leave';
        act(G, { t: 'dlg', id });
        return { stop: false };
    }
    // heal first
    const h = healStep(G, st.heal);
    if (h === true) return { stop: false };
    if (h === 'none') {
        // nothing left to heal with: carry on while it is merely uncomfortable, stop when it is dangerous
        const down = G.party.filter((m) => !isAlive(m)).length;
        const critical = G.party.some((m) => isAlive(m) && frac(m) < 0.3) || down * 2 >= G.party.length;
        if (critical) return { stop: true, msg: 'Auto-explore stopped: the party is in danger and has nothing left to heal with.' };
    }

    const f = G.floor, p = G.pos;
    const guardKey = `${f.down.x},${f.down.y}`;
    const guarded = !!f.feat[guardKey]?.guard;
    const blocked = (x, y) => guarded && `${x},${y}` === guardKey;
    const hurtAny = G.party.some((m) => isAlive(m) && frac(m) < 0.8);
    const want = (x, y) => {
        const ft = featAt(f, x, y);
        if (!ft) return false;
        switch (ft.type) {
            case 'chest': return !ft.opened;
            case 'gather': return ft.left > 0;
            case 'tablet': return !ft.read;
            case 'relic': return !ft.taken;
            case 'spring': return ft.left > 0 && hurtAny;
            default: return false;
        }
    };
    const standing = featAt(f, p.x, p.y);
    if (standing && want(p.x, p.y)) { act(G, { t: 'interact' }); return { stop: false }; }
    let dir = pathDir(f, p.x, p.y, want, blocked);
    if (dir < 0) dir = pathDir(f, p.x, p.y, (x, y) => f.seen[cellIdx(f, x, y)] !== 2 && !blocked(x, y), blocked);
    if (dir < 0) return { stop: true, done: true, msg: guarded ? 'Floor explored. A guardian holds the stairs: stopping here.' : 'Floor explored. Auto-explore is done.' };
    act(G, { t: 'move', m: relMove(p.d, dir) });
    return { stop: false };
}
