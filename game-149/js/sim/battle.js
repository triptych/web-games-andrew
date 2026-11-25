// Turn-based battles. Pure. A charge-time queue (each actor fills by its speed; at 100 it acts). Heroes wait for a
// command; foes act on their own after the view has had BATTLE.wait seconds to show the last action.
//
// Kai's Echo copies the last spell anyone cast, a foe's included, at 125%: echo a Starfall and it rains on the
// enemy; echo the Hollow Requiem and the Choir's own song hits the Choir.

import { BATTLE, CLIMAX } from '../config.js';
import { HEROES, FOES, SKILLS, ENCOUNTERS, ITEMS, CAST } from './data.js';
import { heroStats, party, addXp } from './rules.js';

const NOT_ECHOABLE = new Set(['strike', 'echo', 'sonic', 'choir', 'bonk']);

function foeStats(kind, lv) {
    const f = FOES[kind], k = 1 + 0.16 * (lv - 1);
    return { mhp: Math.round(f.hp * k), atk: Math.round(f.atk * k), mag: Math.round(f.mag * k), def: Math.round(f.def * k), spd: f.spd };
}

function makeFoe(B, kind, lv, mul = 1) {
    const s = foeStats(kind, lv), f = FOES[kind];
    const n = B.actors.filter((a) => a.kind === kind).length;
    return {
        id: 'f' + (B.nextId++), side: 'foe', kind, model: f.model, name: f.name + (n ? ' ' + String.fromCharCode(66 + n - 1) : ''), lv,
        mhp: Math.round(s.mhp * mul), hp: Math.round(s.mhp * mul), mp: 0, mmp: 0, atk: Math.round(s.atk * Math.sqrt(mul)), mag: Math.round(s.mag * Math.sqrt(mul)), def: s.def, spd: s.spd,
        weak: f.weak, resist: f.resist, ct: 0, guard: false, shield: 0, alive: true, boss: !!f.boss,
    };
}

export function bossMul(G) {
    const C = G.climax;
    if (!C) return 1;
    return 1 + CLIMAX.perUnrescued * (4 - C.freed.length) + (C.late ? CLIMAX.lateBonus : 0);
}

export function startBattle(G, enc) {
    const E = ENCOUNTERS[enc];
    if (!E) throw new Error('no encounter ' + enc);
    const B = {
        enc, phase: 'wait', wait: 0.6, actors: [], cur: -1, last: null, turn: 0, nextId: 0,
        optional: !!E.optional, music: E.music, where: E.where, xp: 0, lumens: 0, result: null,
    };
    const members = party(G);
    if (E.guest) members.push(E.guest);
    for (const id of members) {
        const h = G.heroes[id];
        const s = heroStats(id, h.lv);
        B.actors.push({
            id, side: 'hero', kind: id, model: CAST[id].model, name: id === 'kai' ? G.name : CAST[id].name, lv: h.lv, guest: id === E.guest,
            mhp: s.mhp, hp: Math.max(1, Math.min(s.mhp, h.hp ?? s.mhp)), mmp: s.mmp, mp: Math.min(s.mmp, h.mp ?? s.mmp),
            atk: s.atk, mag: s.mag, def: s.def, spd: s.spd, weak: [], resist: [], ct: 0, guard: false, shield: 0, alive: true,
        });
    }
    let list = E.foes;
    const plv = Math.round(B.actors.filter((a) => a.side === 'hero' && !a.guest).reduce((s, a) => s + a.lv, 0) / Math.max(1, members.length - (E.guest ? 1 : 0)));
    if (list === 'random') {
        const lv = Math.max(1, Math.min(6, Math.round(G.day / 2)));
        const pool = G.day >= 7 ? ['wisp', 'acolyte', 'gargoyle'] : ['wisp', 'acolyte'];
        const n = 2 + (G.rng() < 0.4 ? 1 : 0);
        list = Array.from({ length: n }, () => [G.rng.pick(pool), lv]);
    }
    for (const [kind, lv0] of list) {
        const lv = E.scale === 'party' ? Math.max(1, plv) : lv0;
        const ease = Math.max(BATTLE.retryFloor, BATTLE.retryEase ** (G.retries?.[enc] || 0));
        B.actors.push(makeFoe(B, kind, lv, (FOES[kind].boss ? bossMul(G) : 1) * ease));
    }
    // a little jitter in the starting charge so turns aren't always in the same order
    for (const a of B.actors) a.ct = Math.floor(G.rng() * 30);
    G.battle = B;
    G.mode = 'battle';
    G.events.push({ type: 'battleStart', enc, music: E.music });
    return B;
}

export const heroesOf = (B) => B.actors.filter((a) => a.side === 'hero');
export const foesOf = (B) => B.actors.filter((a) => a.side === 'foe');
const alive = (list) => list.filter((a) => a.alive);
const sideOf = (B, side) => B.actors.filter((a) => a.side === side);
const other = (s) => (s === 'hero' ? 'foe' : 'hero');

/** The skill an Echo would cast right now (and whether it's the sonic fallback). */
export function echoTarget(B) {
    return B.last && !NOT_ECHOABLE.has(B.last.skill) ? B.last.skill : 'sonic';
}

export function skillCost(G, actor, id) {
    if (id === 'echo' && G.flags.grandEcho) return 0;
    return SKILLS[id].mp;
}

/** Can this hero use this skill now? */
export function canUse(G, B, actor, id) {
    if (actor.side !== 'hero') return true;
    if (id === 'strike') return true;
    if (!HEROES[actor.kind].skills.includes(id)) return false;
    return actor.mp >= skillCost(G, actor, id);
}

function elemMul(target, el) {
    if (!el) return 1;
    if (target.weak.includes(el)) return BATTLE.weak;
    if (target.resist.includes(el)) return BATTLE.resist;
    return 1;
}

function damage(G, B, src, dst, sk, mul) {
    const stat = sk.stat === 'atk' ? src.atk : src.mag;
    let d = stat * sk.power * 2.0 * mul * (1 - dst.def / (dst.def + 40));
    d *= 0.9 + G.rng() * 0.2;
    const em = elemMul(dst, sk.el);
    d *= em;
    let crit = false;
    if (src.side === 'hero' && G.rng() < 0.06) { d *= 1.5; crit = true; }
    if (dst.guard) d *= BATTLE.guard;
    if (dst.shield > 0) d *= BATTLE.shield;
    const n = Math.max(1, Math.round(d));
    dst.hp = Math.max(0, dst.hp - n);
    const ko = dst.hp === 0;
    if (ko) { dst.alive = false; dst.ct = 0; dst.shield = 0; }
    let mp = 0;
    if (sk.drainMp) {
        mp = Math.min(dst.mp, sk.drainMp);
        dst.mp -= mp;
        if (src.side === 'hero') src.mp = Math.min(src.mmp, src.mp + sk.drainMp);
    }
    return { id: dst.id, dmg: n, crit, weak: em > 1, resist: em < 1, ko, mpLost: mp };
}

/** Resolve one action. Returns false if it isn't legal. */
function perform(G, B, actor, cmd) {
    const out = { type: 'act', actor: actor.id, side: actor.side, cmd: cmd.t, targets: [] };
    if (cmd.t === 'defend') {
        actor.guard = true;
        out.skill = 'defend';
        G.events.push(out);
        return true;
    }
    if (cmd.t === 'item') {
        const it = ITEMS[cmd.item];
        if (actor.side !== 'hero' || !it || !(G.inv[cmd.item] > 0)) return false;
        const allies = sideOf(B, 'hero');
        const tgt = B.actors.find((a) => a.id === cmd.target && a.side === 'hero');
        const k = it.kind;
        if (k === 'revive') { if (!tgt || tgt.alive) return false; tgt.alive = true; tgt.hp = Math.round(tgt.mhp * it.value); out.targets.push({ id: tgt.id, heal: tgt.hp, revive: true }); }
        else if (k === 'heal') { if (!tgt || !tgt.alive) return false; const h = Math.min(it.value, tgt.mhp - tgt.hp); tgt.hp += h; out.targets.push({ id: tgt.id, heal: h }); }
        else if (k === 'mp') { if (!tgt || !tgt.alive) return false; const h = Math.min(it.value, tgt.mmp - tgt.mp); tgt.mp += h; out.targets.push({ id: tgt.id, mp: h }); }
        else if (k === 'healall') { for (const a of alive(allies)) { const h = Math.min(it.value, a.mhp - a.hp); a.hp += h; out.targets.push({ id: a.id, heal: h }); } }
        else if (k === 'mpall') { for (const a of alive(allies)) { const h = Math.min(it.value, a.mmp - a.mp); a.mp += h; out.targets.push({ id: a.id, mp: h }); } }
        else return false;
        G.inv[cmd.item]--;
        if (!G.inv[cmd.item]) delete G.inv[cmd.item];
        out.skill = 'item'; out.item = cmd.item;
        G.events.push(out);
        return true;
    }
    let id = cmd.t === 'attack' ? 'strike' : cmd.id;
    if (!SKILLS[id] || !canUse(G, B, actor, id)) return false;
    let mul = 1;
    if (actor.side === 'hero') actor.mp -= skillCost(G, actor, id);
    if (id === 'echo') {
        out.echo = true;
        id = echoTarget(B);
        mul = id === 'sonic' ? 1 : SKILLS.echo.power;
        out.echoOf = id;
    }
    const sk = SKILLS[id];
    out.skill = id; out.el = sk.el || null;
    const foes = alive(sideOf(B, other(actor.side)));
    const allies = alive(sideOf(B, actor.side));
    if (sk.kind === 'dmg') {
        let targets = sk.target === 'foes' ? foes : [foes.find((a) => a.id === cmd.target) || foes[0]];
        targets = targets.filter(Boolean);
        for (const t of targets) {
            const m = mul * (out.echo && t.boss ? BATTLE.echoBoss : 1);
            out.targets.push(damage(G, B, actor, t, sk, m));
        }
        if (sk.haste) for (const a of allies) if (a !== actor) a.ct += sk.haste;
    } else if (sk.kind === 'heal') {
        for (const a of allies) {
            const h = Math.min(a.mhp - a.hp, Math.round(actor.mag * sk.power * 2.2 * mul));
            a.hp += h;
            out.targets.push({ id: a.id, heal: h });
        }
    } else if (sk.kind === 'shield') {
        for (const a of allies) { a.shield = sk.turns; out.targets.push({ id: a.id, shield: sk.turns }); }
    } else if (sk.kind === 'summon') {
        if (actor.side === 'foe' && foes.length && alive(sideOf(B, 'foe')).length < 3) {
            const f = makeFoe(B, sk.summon, Math.max(1, actor.lv - 2));
            B.actors.push(f);
            out.targets.push({ id: f.id, summoned: true });
        }
    }
    if (!NOT_ECHOABLE.has(id)) B.last = { skill: id, side: actor.side, by: actor.id };
    G.events.push(out);
    return true;
}

function checkEnd(G, B) {
    if (!alive(foesOf(B)).length) {
        B.phase = 'won';
        let xp = 0, lumens = 0;
        for (const f of foesOf(B)) { const F = FOES[f.kind]; xp += Math.round(F.xp * BATTLE.xpMul * (1 + 0.3 * (f.lv - 1))); lumens += Math.round(F.lumens * (1 + 0.2 * (f.lv - 1))); }
        B.result = { xp, lumens };
        G.lumens += lumens;
        for (const id of Object.keys(G.heroes)) if (id === 'kai' || G.joined[id]) addXp(G, id, xp);
        G.events.push({ type: 'won', xp, lumens, enc: B.enc });
        return true;
    }
    if (!alive(heroesOf(B).filter((a) => !a.guest)).length) {
        B.phase = 'lost';
        G.events.push({ type: 'lost', enc: B.enc });
        return true;
    }
    return false;
}

/** Choose a foe's move. */
export function foeAI(G, B, f) {
    const F = FOES[f.kind];
    const heroes = alive(heroesOf(B));
    let opts = F.ai.filter(([s]) => s !== 'choir' || alive(foesOf(B)).length < 3);
    if (f.boss && f.hp < f.mhp * 0.5) opts = opts.map(([s, w]) => [s, s === 'lance' ? w + 2 : w]);
    const tot = opts.reduce((s, [, w]) => s + w, 0);
    let r = G.rng() * tot, id = opts[0][0];
    for (const [s, w] of opts) { if ((r -= w) <= 0) { id = s; break; } }
    let target = heroes[Math.floor(G.rng() * heroes.length)];
    if (G.rng() < 0.4) target = heroes.reduce((a, b) => (b.hp / b.mhp < a.hp / a.mhp ? b : a), heroes[0]);
    return id === 'strike' ? { t: 'attack', target: target.id } : { t: 'skill', id, target: target.id };
}

/** Choose a hero's move: used by the auto-battle, the guest (Graves) and the bot. skill (0..1) dulls its judgement. */
export function heroAI(G, B, h, skill = 1, rand = G.rng) {
    const heroes = alive(heroesOf(B)), foes = alive(foesOf(B));
    const hurt = heroes.filter((a) => a.hp < a.mhp * 0.45);
    const smart = rand() < skill;
    if (h.kind === 'graves') return canUse(G, B, h, 'glyph') && !heroes.some((a) => a.shield > 0) ? { t: 'skill', id: 'glyph' } : { t: 'attack', target: foes[0].id };
    // fallen friend and a feather?
    const down = heroesOf(B).find((a) => !a.alive && !a.guest);
    if (smart && down && G.inv.phoenix > 0) return { t: 'item', item: 'phoenix', target: down.id };
    if (smart && hurt.length >= 2 || (smart && hurt.length && hurt[0].hp < hurt[0].mhp * 0.25)) {
        if (h.kind === 'pip' && canUse(G, B, h, 'tonic')) return { t: 'skill', id: 'tonic' };
        if (h.kind === 'kai' && canUse(G, B, h, 'harmony')) return { t: 'skill', id: 'harmony' };
        if (h.kind === 'kai' && canUse(G, B, h, 'echo') && SKILLS[echoTarget(B)].kind === 'heal') return { t: 'skill', id: 'echo' };
        const low = hurt.reduce((a, b) => (b.hp < a.hp ? b : a));
        if (G.inv.tart > 0 && hurt.length >= 2) return { t: 'item', item: 'tart', target: low.id };
        if (G.inv.healing > 0) return { t: 'item', item: 'healing', target: low.id };
        if (G.inv.candy > 0) return { t: 'item', item: 'candy', target: low.id };
    }
    if (smart && h.mp < 6 && G.inv.mana > 0 && h.mmp >= 20) return { t: 'item', item: 'mana', target: h.id };
    // target: a foe weak to my element first, else the one closest to falling
    const el = HEROES[h.kind].el;
    let target = foes.find((f) => f.weak.includes(el)) || foes.reduce((a, b) => (b.hp < a.hp ? b : a));
    if (!smart) target = foes[Math.floor(rand() * foes.length)];
    if (h.kind === 'kai') {
        const e = echoTarget(B), es = SKILLS[e];
        if (canUse(G, B, h, 'echo') && smart && (es.kind === 'dmg' || (es.kind === 'heal' && hurt.length))) return { t: 'skill', id: 'echo', target: target.id };
        return { t: 'attack', target: target.id };
    }
    const sk = HEROES[h.kind].skills[0];
    if (sk && canUse(G, B, h, sk) && SKILLS[sk].kind === 'dmg' && (SKILLS[sk].target === 'foe' || foes.length >= 2 || foes[0].boss) && (smart || rand() < 0.5)) return { t: 'skill', id: sk, target: target.id };
    return { t: 'attack', target: target.id };
}

/** Advance time. hold = the view is still animating, so nothing new happens. */
export function battleStep(G, dt, hold = false) {
    const B = G.battle;
    if (!B || B.phase === 'won' || B.phase === 'lost' || B.phase === 'cmd') return;
    if (B.wait > 0) { if (!hold) B.wait -= dt; return; }
    // whose turn: fill charge until someone reaches 100
    const live = B.actors.filter((a) => a.alive);
    let next = null;
    for (let guard = 0; guard < 100 && !next; guard++) {
        const ready = live.filter((a) => a.ct >= BATTLE.ctFull);
        if (ready.length) { next = ready.reduce((a, b) => (b.ct > a.ct ? b : a)); break; }
        const ticks = Math.min(...live.map((a) => Math.ceil((BATTLE.ctFull - a.ct) / Math.max(1, a.spd))));
        for (const a of live) a.ct += a.spd * Math.max(1, ticks);
    }
    if (!next) return;
    next.ct -= BATTLE.ctFull;
    next.guard = false;
    if (next.shield > 0 && next.side === 'hero') next.shield--;
    B.turn++;
    B.cur = B.actors.indexOf(next);
    if (next.side === 'foe') {
        perform(G, B, next, foeAI(G, B, next));
        B.wait = BATTLE.wait;
        checkEnd(G, B);
    } else if (next.guest || G.auto) {
        perform(G, B, next, heroAI(G, B, next));
        B.wait = BATTLE.wait;
        checkEnd(G, B);
    } else {
        B.phase = 'cmd';
        G.events.push({ type: 'turn', who: next.id });
    }
}

/** A command from the player (or the bot) for the hero whose turn it is. */
export function battleAct(G, cmd) {
    const B = G.battle;
    if (!B) return false;
    if (cmd.t === 'auto') { G.auto = !!cmd.on; if (G.auto && B.phase === 'cmd') { B.phase = 'wait'; B.wait = 0; B.actors[B.cur].ct += BATTLE.ctFull; } return true; }
    if (B.phase !== 'cmd') return false;
    const actor = B.actors[B.cur];
    if (!perform(G, B, actor, cmd)) return false;
    B.phase = 'wait';
    B.wait = BATTLE.wait;
    checkEnd(G, B);
    return true;
}

/** Write the heroes' HP and MP back after a battle (full heal, or a 40% top-up during the climax). */
export function settleHeroes(G, B) {
    for (const a of heroesOf(B)) {
        const h = G.heroes[a.kind];
        if (!h) continue;
        const s = heroStats(a.kind, h.lv);
        if (G.climax && B.phase === 'won') {
            h.hp = Math.min(s.mhp, Math.max(a.hp, 1) + Math.round(s.mhp * 0.4));
            h.mp = Math.min(s.mmp, a.mp + Math.round(s.mmp * 0.4));
        } else { h.hp = s.mhp; h.mp = s.mmp; }
    }
}
