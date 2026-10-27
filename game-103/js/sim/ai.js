// One brain for the enemy and for the test bot, so the balance table tests the AI the player meets.
// aiCommand() is stateless: it looks at the board and the turn flags and returns the next command,
// so a game saved halfway through a turn picks up exactly where it left off.

import { CLASSES, SKILLS, itemAmount } from './data.js';
import {
    DIRS, affectedFrom, calcDamage, healAmount, isFoe, isFriend, rangeTiles, skillsOf, standable, tileAt, validTarget,
} from './core.js';

const SQUISHY = new Set(['mina', 'juniper', 'fenn', 'blot', 'sprite']);

/** Steps from every tile to the nearest of `sources`, walking round walls and gaps. */
function distanceField(B, sources) {
    const f = new Array(B.w * B.h).fill(99);
    const q = [];
    for (const s of sources) { f[s.y * B.w + s.x] = 0; q.push({ x: s.x, y: s.y }); }
    for (let i = 0; i < q.length; i++) {
        const c = q[i];
        for (const [dx, dy] of DIRS) {
            const nx = c.x + dx, ny = c.y + dy;
            const t = tileAt(B, nx, ny);
            if (!t || t.block) continue;
            if (f[ny * B.w + nx] <= f[c.y * B.w + c.x] + 1) continue;
            f[ny * B.w + nx] = f[c.y * B.w + c.x] + 1;
            q.push({ x: nx, y: ny });
        }
    }
    return f;
}

function actionScore(B, u, sk, pos, tx, ty) {
    const ts = affectedFrom(B, u, sk, tx, ty, pos.x, pos.y);
    let s = 0;
    if (sk.kind === 'phys' || sk.kind === 'mag') {
        for (const d of ts) {
            const dmg = Math.min(d.hp, calcDamage(B, u, d, sk, pos.x, pos.y) * (sk.hits || 1));
            s += (dmg / d.maxhp) * 10 + (dmg >= d.hp ? 6 : 0) + (d.key === 'juniper' || d.key === 'mina' ? 1 : 0);
            if (d.st.sleepy > 0) s -= 1;
        }
    } else if (sk.kind === 'heal') {
        for (const d of ts) {
            const gain = (Math.min(d.maxhp - d.hp, healAmount(u, sk)) / d.maxhp) * 10;
            s += d.hp / d.maxhp < 0.4 ? gain * 1.4 : gain;
            if (sk.status && d.hp < d.maxhp) s += 0.4;
        }
        if (s < 1.5) return 0;
    } else if (sk.kind === 'buff') {
        for (const d of ts) {
            const foeNear = B.units.some((o) => isFoe(d, o) && Math.abs(o.x - d.x) + Math.abs(o.y - d.y) <= 6);
            if (foeNear && !(d.st[sk.status] > 0)) s += 2.2;
        }
        if (s < 3) return 0;
    } else if (sk.kind === 'status') {
        for (const d of ts) if (!d.boss && !(d.st[sk.status] > 0)) s += 3 + Math.max(d.atk, d.mag) / 6;
        if (s < 3) return 0;
    }
    return s > 0 ? s - sk.cost * 0.25 : 0;
}

/**
 * Use a carried item on whoever needs it (self or a friend next to us) when it is worth the action:
 * someone below half health, or a caster nearly out of MP.
 */
function itemCommand(B, u) {
    let best = null;
    const near = B.units.filter((o) => o.alive && o.team === u.team && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) <= 1);
    u.items.forEach((it, slot) => {
        for (const to of near) {
            const hp = Math.min(to.maxhp - to.hp, itemAmount(it, 'hp', to.lvl));
            const mp = Math.min(Math.max(0, to.maxmp - to.mp), itemAmount(it, 'mp', to.lvl));
            let v = 0;
            if (to.hp / to.maxhp < 0.5 && hp >= to.maxhp * 0.25) v += (hp / to.maxhp) * 10 * (to.hp / to.maxhp < 0.3 ? 1.5 : 1);
            if (to.maxmp >= 8 && to.mp <= 2 && mp >= 3) v += 3;
            if (v > 2.5 && (!best || v > best.v)) best = { v, cmd: { t: 'item', slot, x: to.x, y: to.y } };
        }
    });
    return best?.cmd || null;
}

export function aiCommand(G, u) {
    const B = G.B, T = B.turn;
    const foes = B.units.filter((o) => isFoe(u, o));
    const friends = B.units.filter((o) => isFriend(u, o) && o.id !== u.id);
    if (!foes.length) return { t: 'wait' };

    if (u.team === 'e' && u.ai === 'guard' && !u.awake) {
        if (foes.some((o) => Math.abs(o.x - u.x) + Math.abs(o.y - u.y) <= u.move + 4)) u.awake = true;
        else return { t: 'wait' };
    }

    if (!T.acted && u.items?.length) { const c = itemCommand(B, u); if (c) return c; }

    // where to head when nothing can be hit: the hurt friend (healers) or the nearest foe
    const hurt = friends.filter((o) => o.hp / o.maxhp < 0.7);
    const healer = skillsOf(u).some((id) => SKILLS[id].kind === 'heal');
    const field = distanceField(B, healer && hurt.length ? hurt : foes);
    const squishy = SQUISHY.has(u.key);
    const known = skillsOf(u).filter((id) => SKILLS[id].cost <= u.mp);

    const spots = T.moved ? [{ x: u.x, y: u.y }] : standable(B, u);
    let best = null;
    for (const pos of spots) {
        const t = tileAt(B, pos.x, pos.y);
        let posScore = (t.cover ? 0.5 : 0) + t.h * 0.25;
        if (u.team === 'p' && u.items.length < 4 && B.drops?.some((o) => o.x === pos.x && o.y === pos.y)) posScore += 1.5;      // a dropped item is worth a short walk
        const adj = foes.filter((o) => Math.abs(o.x - pos.x) + Math.abs(o.y - pos.y) === 1).length;
        posScore -= adj * (squishy ? 1.2 : 0.15);
        let bestAct = null, actScore = 0;
        if (!T.acted) {
            for (const id of known) {
                const sk = SKILLS[id];
                for (const tt of rangeTiles(B, sk, pos.x, pos.y)) {
                    if (!validTarget(B, u, sk, tt.x, tt.y, pos.x, pos.y)) continue;
                    const s = actionScore(B, u, sk, pos, tt.x, tt.y);
                    if (s > actScore) { actScore = s; bestAct = { t: 'skill', id, x: tt.x, y: tt.y }; }
                }
            }
        }
        posScore -= (bestAct ? 0.05 : 0.4) * field[pos.y * B.w + pos.x];
        if (squishy && !bestAct && friends.length) posScore -= 0.15 * Math.min(...friends.map((o) => Math.abs(o.x - pos.x) + Math.abs(o.y - pos.y)));
        const total = actScore + posScore;
        if (!best || total > best.total) best = { total, pos, act: bestAct };
    }
    if (!best) return { t: 'wait' };
    if (!T.moved && (best.pos.x !== u.x || best.pos.y !== u.y)) return { t: 'move', x: best.pos.x, y: best.pos.y };
    if (!T.acted && best.act) return best.act;
    return { t: 'wait' };
}
