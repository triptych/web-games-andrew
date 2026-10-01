/**
 * ai.js — monster and ally behaviour, one action per call.
 *
 * Monsters hunt along a distance map flooded from the hero each turn
 * (run._t.dmap). Archetypes decide what to do once they have noticed you;
 * every dangerous move (bomber fuses, charges) is telegraphed as a hazard the
 * turn before it lands.
 */

import { T, TP, DIRS8, cheb } from './tiles.js';
import { SPECIES, makeMonster } from './monsters.js';
import { R, ev, log, attack, alive, isPlayer, actorAt, canEnter, heal, applyStatus, hostile, freeNear, tileAt, inBounds, damage } from './combat.js';
import { lineOfFire, cornerOk } from './path.js';
import { bossAct } from './bosses.js';

export function monsterAct(run, m) {
    if (!alive(m)) return;
    if (m.st.frozen || m.st.stun) return;
    const rng = R(run);
    const p = run.p;
    const S = SPECIES[m.sp] || {};
    if (m.dormant) {
        if (cheb(m.x, m.y, p.x, p.y) <= 1) {
            m.dormant = false; m.awake = true;
            ev(run, { t: 'reveal', id: m.id });
            log(run, m.sp === 'mimic' ? 'The chest was a Mimic!' : `A ${m.name} bursts from hiding!`, 'warn');
            attack(run, m, p);
        }
        return;
    }
    if (m.boss) return bossAct(run, m);
    if (m.ally) return allyAct(run, m);
    if (S.a === 'nest') return nestAct(run, m);

    const sees = canSeeHero(run, m);
    if (!m.awake) {
        if (sees) {
            const d = cheb(m.x, m.y, p.x, p.y);
            const ch = m.asleep ? (d <= 2 ? 0.7 : 0.18) : (d <= 4 ? 0.9 : 0.5);
            if (rng.chance(ch)) { m.awake = true; m.asleep = false; ev(run, { t: 'alert', id: m.id }); }
        }
        if (!m.awake) { if (!m.asleep && rng.chance(0.35)) wander(run, m); return; }
    }
    if (sees) { m.lastSeen = { x: p.x, y: p.y }; m.lost = 0; } else m.lost = (m.lost || 0) + 1;
    if (m.lost > 14) { m.awake = false; m.lost = 0; return; }

    // Phasing: blink to the hero's side now and then.
    if ((S.phase || m.aff.includes('phasing')) && sees && cheb(m.x, m.y, p.x, p.y) > 2 && (m.ai.phase = (m.ai.phase || 0) + 1) % 5 === 0) {
        const c = freeNear(run, p.x, p.y, m, 1);
        if (c) { ev(run, { t: 'tele', id: m.id, fx: m.x, fy: m.y, x: c[0], y: c[1] }); m.x = c[0]; m.y = c[1]; return; }
    }
    if (m.st.fear) return flee(run, m);

    // Healers look after their friends first.
    if (S.a === 'healer' && (m.ai.cd = (m.ai.cd || 0) - 1) <= 0) {
        const hurt = run.mons.filter((o) => o !== m && alive(o) && !o.ally && o.hp < o.hpMax * 0.7 && cheb(o.x, o.y, m.x, m.y) <= 5 && lineOfFire(run.lv, m.x, m.y, o.x, o.y))
            .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
        if (hurt) {
            m.ai.cd = 4;
            ev(run, { t: 'shot', id: m.id, fx: m.x, fy: m.y, x: hurt.x, y: hurt.y, kind: 'heal' });
            heal(run, hurt, hurt.hpMax * 0.3);
            return;
        }
    }
    // Summoners call help.
    if (S.a === 'summoner' && sees && (m.ai.cd = (m.ai.cd || 0) - 1) <= 0) {
        const mine = run.mons.filter((o) => alive(o) && o.summoner === m.id).length;
        if (mine < 3) {
            m.ai.cd = 7;
            const n = rng.int(1, 2);
            for (let k = 0; k < n; k++) summon(run, m, S.sum, m.x, m.y);
            log(run, `The ${m.name} calls for aid.`, 'warn');
            return;
        }
    }
    const d = cheb(m.x, m.y, p.x, p.y);
    // Bombers: light the fuse when adjacent.
    if (S.a === 'bomber') {
        if (m.fuse) return;
        if (d <= 1) return lightFuse(run, m);
        return approach(run, m);
    }
    // Chargers: line up, telegraph, then charge next turn.
    if (S.a === 'charger') {
        if (m.charging) return;
        const dx = p.x - m.x, dy = p.y - m.y;
        if ((m.ai.ccd = (m.ai.ccd || 0) - 1) <= 0 && d >= 2 && d <= 5 && sees && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
            const sx = Math.sign(dx), sy = Math.sign(dy);
            const tiles = [];
            let x = m.x + sx, y = m.y + sy, ok = true;
            for (let k = 0; k < 6; k++) {
                if (!inBounds(run, x, y) || !TP[tileAt(run, x, y)].pass) break;
                const o = actorAt(run, x, y);
                if (o && !isPlayer(o) && !o.ally) { ok = false; break; }
                tiles.push(y * run.lv.w + x);
                x += sx; y += sy;
            }
            if (ok && tiles.length >= d) {
                m.ai.ccd = 6;
                m.charging = true;
                run.hazards.push({ id: run.nextId++, tiles, t: 1, dmg: Math.round(m.dmg[1] * 1.5), kind: 'charge', owner: m.id, charge: { sx, sy }, st: { k: 'stun', n: 1 } });
                ev(run, { t: 'hazard', tiles, kind: 'charge', id: m.id });
                log(run, `The ${m.name} lowers its head to charge!`, 'warn');
                return;
            }
        }
    }
    // Ranged attackers.
    if ((S.a === 'archer' || S.a === 'caster' || S.a === 'summoner') && m.r) {
        const visible = run._t.vis[m.y * run.lv.w + m.x];
        if (visible && d <= m.r && d >= 1 && lineOfFire(run.lv, m.x, m.y, p.x, p.y, (x, y) => !!actorAt(run, x, y))) {
            if (d === 1 && rng.chance(0.5) && !m.still && stepAway(run, m)) return;
            const kind = S.bolt || 'arrow';
            ev(run, { t: 'shot', id: m.id, fx: m.x, fy: m.y, x: p.x, y: p.y, kind });
            attack(run, m, p, { ranged: true, kind: boltKind(kind), mult: S.a === 'summoner' ? 0.7 : 1 });
            return;
        }
        if (m.still) return;
        if (d < 3 && rng.chance(0.6) && stepAway(run, m)) return;
    }
    if (m.still) return;
    // Melee.
    const target = adjacentFoe(run, m);
    if (target) { if (!m.st.root || cheb(target.x, target.y, m.x, m.y) <= 1) attack(run, m, target); return; }
    if (m.st.root) return;
    approach(run, m);
}

const boltKind = (b) => (b === 'fire' ? 'fire' : b === 'frost' ? 'cold' : b === 'spore' ? 'poison' : 'magic');

export function canSeeHero(run, m) {
    const i = m.y * run.lv.w + m.x;
    if (!run._t.los[i]) return false;
    const d = cheb(m.x, m.y, run.p.x, run.p.y);
    if (run.p.st.invis) return d <= 1;
    return d <= 9;
}

function adjacentFoe(run, m) {
    const p = run.p;
    const foes = [];
    if (cheb(m.x, m.y, p.x, p.y) <= 1 && cornerOk(run.lv, m.x, m.y, p.x - m.x, p.y - m.y)) foes.push(p);
    for (const o of run.mons) if (o.ally && alive(o) && cheb(m.x, m.y, o.x, o.y) <= 1) foes.push(o);
    if (!foes.length) return null;
    return foes.includes(p) && R(run).chance(0.75) ? p : R(run).pick(foes);
}

/** Step along the distance map towards the hero. */
export function approach(run, m) {
    const D = run._t.dmap;
    const w = run.lv.w;
    const here = D[m.y * w + m.x];
    let best = null, bd = here < 0 ? 1e9 : here;
    const opts = [];
    for (const [dx, dy] of DIRS8) {
        const X = m.x + dx, Y = m.y + dy;
        if (!inBounds(run, X, Y)) continue;
        const d = D[Y * w + X];
        if (d < 0) continue;
        if (!cornerOk(run.lv, m.x, m.y, dx, dy)) continue;
        const t = tileAt(run, X, Y);
        if (t === T.DOOR) { if (d < bd) opts.push([d, X, Y, true]); continue; }
        if (!canEnter(run, m, X, Y)) continue;
        if (d < bd || (here < 0 && d >= 0)) opts.push([d, X, Y, false]);
    }
    if (!opts.length) {
        // Blocked by friends or out of the map's reach: drift towards last sighting.
        if (here < 0 && m.lastSeen) return stepTowards(run, m, m.lastSeen.x, m.lastSeen.y);
        return false;
    }
    opts.sort((a, b) => a[0] - b[0]);
    const top = opts.filter((o) => o[0] === opts[0][0]);
    best = R(run).pick(top);
    if (best[3]) { openDoor(run, best[1], best[2]); return true; }
    moveTo(run, m, best[1], best[2]);
    return true;
}

function stepTowards(run, m, tx, ty) {
    const dx = Math.sign(tx - m.x), dy = Math.sign(ty - m.y);
    for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]]) {
        if (!ax && !ay) continue;
        if (canEnter(run, m, m.x + ax, m.y + ay) && cornerOk(run.lv, m.x, m.y, ax, ay)) { moveTo(run, m, m.x + ax, m.y + ay); return true; }
    }
    return false;
}

function stepAway(run, m) {
    const D = run._t.dmap;
    const w = run.lv.w;
    let best = null, bd = D[m.y * w + m.x];
    for (const [dx, dy] of DIRS8) {
        const X = m.x + dx, Y = m.y + dy;
        if (!canEnter(run, m, X, Y) || !cornerOk(run.lv, m.x, m.y, dx, dy)) continue;
        const d = D[Y * w + X];
        if (d > bd) { bd = d; best = [X, Y]; }
    }
    if (!best) return false;
    moveTo(run, m, best[0], best[1]);
    return true;
}

function flee(run, m) {
    if (!stepAway(run, m)) { const t = adjacentFoe(run, m); if (t) attack(run, m, t); }
}

function wander(run, m) {
    const rng = R(run);
    const [dx, dy] = rng.pick(DIRS8);
    const X = m.x + dx, Y = m.y + dy;
    if (cheb(X, Y, m.home.x, m.home.y) > 6) return;
    if (canEnter(run, m, X, Y) && cornerOk(run.lv, m.x, m.y, dx, dy)) moveTo(run, m, X, Y);
}

export function moveTo(run, m, x, y) {
    ev(run, { t: 'move', id: m.id, fx: m.x, fy: m.y, x, y });
    m.x = x; m.y = y;
}

export function openDoor(run, x, y) {
    run.lv.tiles[y * run.lv.w + x] = T.DOOR_OPEN;
    ev(run, { t: 'door', x, y });
    run._t.fovDirty = true;
}

export function summon(run, m, spId, x, y) {
    const c = freeNear(run, x, y, { id: -1, sp: spId }, 2);
    if (!c) return null;
    const s = makeMonster(run, spId, c[0], c[1], Math.max(1, m.lvl - 1), R(run));
    s.awake = true; s.summoner = m.id; s.xp = Math.round(s.xp * 0.4);
    // A Warden's minions are a nuisance, not a second boss.
    if (m.boss) { s.hpMax = s.hp = Math.max(1, Math.round(s.hpMax * 0.55)); s.dmg = [Math.max(1, Math.round(s.dmg[0] * 0.7)), Math.max(1, Math.round(s.dmg[1] * 0.7))]; }
    run.mons.push(s);
    ev(run, { t: 'spawn', id: s.id, summoned: true });
    return s;
}

function lightFuse(run, m) {
    const S = SPECIES[m.sp];
    m.fuse = true;
    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(run, m.x + dx, m.y + dy)) tiles.push((m.y + dy) * run.lv.w + m.x + dx);
    const kind = S.blast || 'fire';
    run.hazards.push({ id: run.nextId++, tiles, t: 1, dmg: Math.round((m.dmg[0] + m.dmg[1]) * 0.75), kind, owner: m.id, bomber: true,
        st: kind === 'poison' ? { k: 'poison', n: 4 } : kind === 'fire' ? { k: 'burn', n: 3 } : null,
        field: kind === 'poison' ? 3 : 0 });
    ev(run, { t: 'hazard', tiles, kind, id: m.id });
    ev(run, { t: 'fuse', id: m.id });
    log(run, `The ${m.name} swells — it's going to burst!`, 'warn');
}

function nestAct(run, m) {
    if ((m.ai.cd = (m.ai.cd || 4) - 1) > 0) return;
    m.ai.cd = 7;
    const mine = run.mons.filter((o) => alive(o) && o.summoner === m.id).length;
    if (mine >= 3) return;
    if (cheb(m.x, m.y, run.p.x, run.p.y) > 14) return;
    const s = summon(run, m, m.nestSp, m.x, m.y);
    if (s) { s.awake = run._t.los[m.y * run.lv.w + m.x] ? true : false; }
}

// ------------------------------------------------------------------ Allies

function allyAct(run, m) {
    const p = run.p;
    let foe = null, fd = 99;
    for (const o of run.mons) {
        if (!alive(o) || o.ally || o.dormant || !hostile(m, o)) continue;
        if (!run._t.vis[o.y * run.lv.w + o.x]) continue;
        const d = cheb(o.x, o.y, m.x, m.y);
        if (d < fd && d <= 6) { fd = d; foe = o; }
    }
    if (foe && fd <= 1) { attack(run, m, foe); return; }
    if (foe) { if (stepTowards(run, m, foe.x, foe.y)) return; }
    if (cheb(m.x, m.y, p.x, p.y) > 2) {
        const D = run._t.dmap;
        const w = run.lv.w;
        let best = null, bd = D[m.y * w + m.x];
        for (const [dx, dy] of DIRS8) {
            const X = m.x + dx, Y = m.y + dy;
            if (!canEnter(run, m, X, Y) || !cornerOk(run.lv, m.x, m.y, dx, dy)) continue;
            const d = D[Y * w + X];
            if (d >= 0 && d < bd) { bd = d; best = [X, Y]; }
        }
        if (best) moveTo(run, m, best[0], best[1]);
        else if (cheb(m.x, m.y, p.x, p.y) > 6) {
            // Lost: catch up.
            const c = freeNear(run, p.x, p.y, m, 2);
            if (c) { ev(run, { t: 'tele', id: m.id, fx: m.x, fy: m.y, x: c[0], y: c[1] }); m.x = c[0]; m.y = c[1]; }
        }
    }
}

/** Resolve a charger's dash after its hazard fires. */
export function finishCharge(run, h) {
    const m = run.mons.find((o) => o.id === h.owner);
    if (!m || !alive(m)) return;
    m.charging = false;
    let x = m.x, y = m.y;
    for (let k = 0; k < 7; k++) {
        const X = x + h.charge.sx, Y = y + h.charge.sy;
        if (!canEnter(run, m, X, Y)) break;
        x = X; y = Y;
    }
    if (x !== m.x || y !== m.y) { ev(run, { t: 'move', id: m.id, fx: m.x, fy: m.y, x, y, dash: true }); m.x = x; m.y = y; }
}

export { damage, applyStatus };
