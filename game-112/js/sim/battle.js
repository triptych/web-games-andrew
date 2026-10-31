// The battle: a hex field, creature stacks Heroes-style (a count of creatures, the top one wounded),
// and a deck of orders Spire-style. Pure: no DOM, no renderer, no Math.random, no clock.
//
// Your turn: draw 5, 3 ink. Every order is a card. A stack may move once and attack once a turn;
// cards say which and how. Foes show their next move (intent) at the start of your turn and carry it
// out, one at a time, when you end it. A stack struck in melee strikes back once a round.

import { FIELD, HAND, COMBAT } from '../config.js';
import { CREATURES, FOES, CARDS } from './data.js';
export { CARDS };
import * as H from './hex.js';
import { makeRng } from '../rng.js';

const UNTIL_NEXT = new Set(['brace', 'taunt']);      // last until the owner's next turn starts
const AILMENTS = ['weak', 'vuln', 'root', 'stun', 'burn'];

// ------------------------------------------------------------------ lookups
export const unitDef = (s) => (s.side === 'p' ? CREATURES[s.key] : FOES[s.key]);
export function cardDef(card) {
    const d = CARDS[card.id];
    if (!d) return null;
    return card.up && d.up ? { ...d, ...d.up, name: d.name + '+' } : d;
}
export const has = (B, relic) => B.relics.includes(relic);
export const mine = (B) => B.stacks.filter((s) => s.side === 'p');
export const foes = (B) => B.stacks.filter((s) => s.side === 'e');
export const stackById = (B, id) => B.stacks.find((s) => s.id === id) || null;
export const stackAt = (B, c, r) => B.stacks.find((s) => s.c === c && s.r === r) || null;
export const isRock = (B, c, r) => B.rocks.includes(H.key(c, r));
export const isFree = (B, c, r) => H.inBounds(B, c, r) && !isRock(B, c, r) && !stackAt(B, c, r);
export const totalHp = (s) => (s.count > 0 ? (s.count - 1) * unitDef(s).hp + s.top : 0);
export const fullHp = (s) => s.start * unitDef(s).hp;
export const ranged = (s) => !!unitDef(s).rng;
export const flies = (s) => !!unitDef(s).fly;

export function atkOf(B, s) { return unitDef(s).atk + (s.side === 'p' ? B.hero.atk : B.foeBonus); }
export function defOf(B, s) { return unitDef(s).def + (s.side === 'p' ? B.hero.def : B.foeBonus); }
export function spdOf(B, s) {
    let v = unitDef(s).spd;
    if (s.st.haste) v += 2;
    if (s.side === 'p' && has(B, 'boots')) v += 1;
    return v;
}
export const spellPower = (B, d) => Math.round((d.base || 0) + (d.per || 0) * B.hero.lore);

function adjacentFoes(B, s) {
    return B.stacks.filter((o) => o.side !== s.side && H.dist(o.c, o.r, s.c, s.r) === 1);
}

// ------------------------------------------------------------------ building a battle
/**
 * A new battle. groups: [[foeKey, count], ...]. army: the legion's stacks ({ key, count }).
 * Stacks are auto-deployed (archers at the back); the player may rearrange them before it begins.
 */
export function makeBattle({ seed, army, groups, relics = [], hero, kind = 'battle', act = 0, deck = [], rocks = null, boss = null }) {
    const rng = makeRng(seed);
    const B = {
        v: 1, kind, act, cols: FIELD.cols, rows: FIELD.rows,
        rng, rocks: [], stacks: [], nextId: 1,
        relics: relics.slice(), hero: { ...hero }, foeBonus: act,
        phase: 'deploy', turn: 0, ink: 0, inkMax: HAND.ink, drawN: HAND.draw,
        draw: [], hand: [], discard: [], exhaust: [], curseUid: -1,
        drumUsed: false, sigilUsed: false, eq: [], eqT: 0,
        over: null, events: [], log: [],
        boss,
    };
    // obstacles in the middle columns
    if (rocks) B.rocks = rocks.slice();
    else {
        const n = rng.int(2, 5);
        for (let i = 0, tries = 0; i < n && tries < 50; tries++) {
            const c = rng.int(FIELD.deploy, FIELD.cols - FIELD.deploy - 1), r = rng.int(0, FIELD.rows - 1);
            const k = H.key(c, r);
            if (!B.rocks.includes(k)) { B.rocks.push(k); i++; }
        }
    }
    // the legion, auto-deployed
    const slots = deploySlots(B);
    const back = army.map((a, i) => ({ a, i })).filter(({ a }) => CREATURES[a.key].rng);
    const front = army.map((a, i) => ({ a, i })).filter(({ a }) => !CREATURES[a.key].rng);
    const rowsBy = [2, 3, 1, 4, 0, 5];
    const used = new Set();
    const take = (col) => {
        for (const r of rowsBy) { const k = H.key(col, r); if (!used.has(k) && slots.has(k)) { used.add(k); return [col, r]; } }
        for (const k of slots) if (!used.has(k)) { used.add(k); return H.unkey(k); }
        return null;
    };
    for (const { a, i } of [...front, ...back]) {
        if (a.count <= 0) continue;
        const at = take(CREATURES[a.key].rng ? 0 : 1);
        if (!at) break;
        addStack(B, 'p', a.key, a.count, at[0], at[1], { ai: i });
    }
    // the foe, on the far columns
    const erows = [2, 3, 1, 4, 0, 5];
    let ei = 0;
    for (const [key, count] of groups) {
        const big = !!FOES[key].boss;
        const col = big || FOES[key].rng ? FIELD.cols - 1 : FIELD.cols - 2;
        let placed = false;
        for (let t = 0; t < 12 && !placed; t++) {
            const r = erows[(ei + t) % 6];
            for (const c of [col, col === FIELD.cols - 1 ? FIELD.cols - 2 : FIELD.cols - 1]) {
                if (isFree(B, c, r)) { addStack(B, 'e', key, Math.max(1, count), c, r, { boss: big }); placed = true; break; }
            }
        }
        ei++;
    }
    B.deck = deck.map((c) => ({ ...c }));
    return B;
}

export function deploySlots(B) {
    const s = new Set();
    for (let c = 0; c < FIELD.deploy; c++) for (let r = 0; r < B.rows; r++) if (!isRock(B, c, r)) s.add(H.key(c, r));
    return s;
}

function addStack(B, side, key, count, c, r, extra = {}) {
    const def = side === 'p' ? CREATURES[key] : FOES[key];
    const s = {
        id: B.nextId++, side, key, count, start: count, top: def.hp, ward: 0, st: {},
        c, r, moved: false, attacked: false, retal: false, intent: null, mi: 0, hist: [], horned: false,
        ...extra,
    };
    B.stacks.push(s);
    return s;
}

/** Deployment: put one of your stacks on a hex of your two columns, swapping with whatever of yours is there. */
export function place(B, id, c, r) {
    if (B.phase !== 'deploy') return { ok: false, err: 'not deploying' };
    const s = stackById(B, id);
    if (!s || s.side !== 'p') return { ok: false, err: 'no such stack' };
    if (!deploySlots(B).has(H.key(c, r))) return { ok: false, err: 'outside your lines' };
    const o = stackAt(B, c, r);
    if (o && o.side !== 'p') return { ok: false, err: 'occupied' };
    if (o) { o.c = s.c; o.r = s.r; }
    s.c = c; s.r = r;
    B.events.push({ type: 'deploy', id, c, r, swap: o ? o.id : null });
    return { ok: true };
}

/** Deployment over: shuffle the deck, start-of-battle relics, the first turn. */
export function begin(B) {
    if (B.phase !== 'deploy') return { ok: false, err: 'already begun' };
    B.draw = shuffle(B, B.deck.map((c) => ({ ...c })));
    if (has(B, 'astrolabe')) B.hand.push(curse(B, 'doubt'));
    B.events.push({ type: 'begin' });
    startTurn(B);
    return { ok: true };
}

function shuffle(B, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(B.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}
function curse(B, id) { return { uid: B.curseUid--, id, up: false, temp: true }; }

// ------------------------------------------------------------------ cards in hand
function drawCards(B, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
        if (B.hand.length >= HAND.max) break;
        if (!B.draw.length) {
            if (!B.discard.length) break;
            B.draw = shuffle(B, B.discard.splice(0));
            B.events.push({ type: 'reshuffle' });
        }
        B.hand.push(B.draw.pop());
        got++;
    }
    if (got) B.events.push({ type: 'draw', n: got });
    return got;
}

/** A signature card whose creatures are not on the field (dead, or never came) can't be played. */
export function orphaned(B, card) {
    const d = cardDef(card);
    return !!(d.actor && CREATURES[d.actor] && !mine(B).some((s) => s.key === d.actor));
}

export function costOf(B, card) {
    const d = cardDef(card);
    if (d.kind === 'attack' && has(B, 'sigil') && !B.sigilUsed) return 0;
    return d.cost;
}

/** What a card needs picked: 'actor+hex', 'actor', 'hex' or 'none'. */
export function needs(card) {
    const d = cardDef(card);
    const fixed = d.actor && CREATURES[d.actor];
    if (fixed) return d.target === 'none' ? 'none' : 'hex';
    if (d.actor) return d.kind === 'move' || d.kind === 'attack' ? 'actor+hex' : 'actor';
    return d.target === 'none' ? 'none' : 'hex';
}

function actorOk(B, d, s) {
    if (s.side !== 'p' || s.count <= 0 || s.st.stun) return false;
    if (d.actor === 'melee' && ranged(s)) return false;
    if (d.actor === 'ranged' && !ranged(s)) return false;
    if (CREATURES[d.actor] && s.key !== d.actor) return false;
    if (d.kind === 'move') {
        if (s.moved && !d.free) return false;
        if (s.st.root && !d.tele) return false;
    }
    if (d.kind === 'attack' && s.attacked) return false;
    if (d.kind === 'special' && d.fx === 'warhost') return true;
    return true;
}

/** Stacks that could carry the card out: ids, or [null] for a card that needs no one. */
export function cardActors(B, card) {
    const d = cardDef(card);
    if (!d || d.unplayable || B.phase !== 'player') return [];
    if (!d.actor) return [null];
    return mine(B).filter((s) => actorOk(B, d, s) && (needs(card) !== 'actor+hex' && needs(card) !== 'hex' ? true : cardTargets(B, card, s.id).length > 0)).map((s) => s.id);
}

/** Where a walker can step: a reach map from its hex. */
export function reachOf(B, s, bonus = 0) {
    if (s.st.root) return new Map([[H.key(s.c, s.r), { d: 0, prev: -1 }]]);
    return H.reach(B, s.c, s.r, spdOf(B, s) + bonus, (x, y) => isFree(B, x, y), flies(s));
}

/**
 * Where a walker stands to hit `t`: its own hex if adjacent, else the reachable hex next to t with the
 * shortest walk (or, for a joust, the longest). Null when it can't get there this turn.
 */
export function approach(B, a, t, bonus = 0, { canMove = true, far = false } = {}) {
    if (H.dist(a.c, a.r, t.c, t.r) === 1 && !far) return { k: H.key(a.c, a.r), d: 0, path: [[a.c, a.r]] };
    const map = canMove ? reachOf(B, a, bonus) : new Map([[H.key(a.c, a.r), { d: 0, prev: -1 }]]);
    let best = null;
    for (const [nx, ny] of H.neighbors(B, t.c, t.r)) {
        const k = H.key(nx, ny);
        const n = map.get(k);
        if (!n) continue;
        const better = !best || (far ? n.d > best.d : n.d < best.d) ||
            (n.d === best.d && H.dist(nx, ny, a.c, a.r) < H.dist(...H.unkey(best.k), a.c, a.r));
        if (better) best = { k, d: n.d };
    }
    if (!best) return null;
    best.path = flies(a) ? [[a.c, a.r], H.unkey(best.k)] : H.pathTo(map, best.k);
    return best;
}

/** Valid target hexes for a card, given the stack carrying it out (or null). */
export function cardTargets(B, card, actorId) {
    const d = cardDef(card);
    const a = actorId != null ? stackById(B, actorId) : CREATURES[d.actor] ? mine(B).find((s) => s.key === d.actor) : null;
    if (d.actor && (!a || !actorOk(B, d, a))) return [];
    const out = [];
    const all = (fn) => { for (let c = 0; c < B.cols; c++) for (let r = 0; r < B.rows; r++) if (fn(c, r)) out.push([c, r]); };
    switch (d.kind) {
        case 'move': {
            if (d.tele) { all((c, r) => isFree(B, c, r)); break; }
            for (const [k, n] of reachOf(B, a, d.bonus || 0)) if (n.d > 0) out.push(H.unkey(k));
            break;
        }
        case 'attack': {
            for (const t of foes(B)) {
                if (d.swoop) { if (H.neighbors(B, t.c, t.r).some(([x, y]) => isFree(B, x, y) || (x === a.c && y === a.r))) out.push([t.c, t.r]); continue; }
                if (ranged(a) && !d.line) { out.push([t.c, t.r]); continue; }
                if (approach(B, a, t, d.bonus || 0, { canMove: !a.moved })) out.push([t.c, t.r]);
            }
            break;
        }
        case 'spell':
            if (d.target === 'enemy') for (const t of foes(B)) { if (d.notBoss && unitDef(t).boss) continue; out.push([t.c, t.r]); }
            else if (d.target === 'hex') all(() => true);
            break;
        case 'heal': case 'ward': case 'buff':
            if (d.target === 'ally' && CREATURES[d.actor]) for (const s of mine(B)) out.push([s.c, s.r]);
            break;
        case 'earthwork':
            all((c, r) => isFree(B, c, r) && earthworkOk(B, c, r));
            break;
        default: break;
    }
    return out;
}

/** An earthwork may not wall the field in two: walkers must still be able to cross. */
function earthworkOk(B, c, r) {
    if (B.rocks.length >= 9) return false;
    const rocks = new Set([...B.rocks, H.key(c, r)]);
    const goals = [];
    for (let y = 0; y < B.rows; y++) if (!rocks.has(H.key(0, y))) goals.push([0, y]);
    const f = H.distField(B, goals, (x, y) => !rocks.has(H.key(x, y)));
    for (let y = 0; y < B.rows; y++) if (f.has(H.key(B.cols - 1, y))) return true;
    return false;
}

export function playable(B, card) {
    if (B.phase !== 'player' || B.over) return false;
    const d = cardDef(card);
    if (!d || d.unplayable || orphaned(B, card)) return false;
    if (costOf(B, card) > B.ink) return false;
    const need = needs(card);
    const actors = cardActors(B, card);
    if (!actors.length) return false;
    if (need === 'hex') return cardTargets(B, card, actors[0]).length > 0;
    if (d.kind === 'special' && d.fx === 'warhost') return mine(B).some((s) => !s.attacked && !s.st.stun);
    return true;
}

// ------------------------------------------------------------------ damage
/** Damage `a` deals `t` at a multiplier, before Ward. */
export function calcDamage(B, a, t, mult = 1, o = {}) {
    const ua = unitDef(a);
    let dmg = a.count * ua.dmg * mult;
    const A = atkOf(B, a), D = defOf(B, t);
    dmg *= A >= D ? Math.min(COMBAT.atkCap, 1 + (A - D) * COMBAT.atkStep) : Math.max(COMBAT.defFloor, 1 - (D - A) * COMBAT.defStep);
    if (!o.retal && !o.noFlank) {
        const n = B.stacks.filter((s) => s.side === a.side && s !== a && H.dist(s.c, s.r, t.c, t.r) === 1).length;
        const per = o.flankPer ?? COMBAT.flank;
        dmg *= 1 + Math.min(o.flankPer ? 9 : COMBAT.flankCap, n * per);
    }
    if (o.joust) dmg *= 1 + o.joust;
    if (a.st.might) dmg *= 1 + (a.st.mightP || 25) / 100;
    if (a.st.weak) dmg *= COMBAT.weak;
    if (t.st.vuln) dmg *= COMBAT.vuln;
    if (o.shot && adjacentFoes(B, a).length) dmg *= COMBAT.rangedInMelee;
    if (o.retal && ranged(a)) dmg *= COMBAT.rangedInMelee;
    if (o.drum) dmg *= 1.5;
    if (o.nat20) dmg *= 3;
    return Math.max(1, Math.round(dmg));
}

/** Take damage: Ward first (unless pierced), then the top creature, then the rest. */
function hurt(B, t, dmg, { pierce = false, src = null } = {}) {
    let left = dmg, ward = 0;
    if (!pierce && t.ward > 0) { ward = Math.min(t.ward, left); t.ward -= ward; left -= ward; }
    const hp = unitDef(t).hp;
    const before = t.count, was = totalHp(t);
    const total = was - left;
    if (total <= 0) { t.count = 0; t.top = 0; }
    else { t.count = Math.ceil(total / hp); t.top = total - (t.count - 1) * hp; }
    const killed = before - t.count;
    if (t.side === 'e') B.slain = (B.slain || 0) + killed;
    B.events.push({ type: 'hit', id: t.id, dmg, ward, lost: left, killed, count: t.count, src });
    if (t.count <= 0) kill(B, t);
    else if (t.side === 'p' && has(B, 'horn') && !t.horned && t.count < t.start / 2) {
        t.horned = true;
        gainWard(B, t, 0.3, 'horn');
    }
    return { killed, lost: Math.min(left, was), dead: t.count <= 0 };
}

function kill(B, t) {
    B.stacks = B.stacks.filter((s) => s !== t);
    B.events.push({ type: 'death', id: t.id, side: t.side, key: t.key });
    if (t.side === 'p') B.fallen = (B.fallen || []).concat({ ai: t.ai, key: t.key, start: t.start });
}

function gainWard(B, s, frac, why = null) {
    let amt = Math.round(frac * Math.max(totalHp(s), unitDef(s).hp));
    if (s.side === 'p' && has(B, 'wardstone')) amt = Math.round(amt * 1.5);
    if (amt <= 0) return 0;
    s.ward += amt;
    B.events.push({ type: 'ward', id: s.id, amt, why });
    return amt;
}

/** Raise the fallen: heal up to the stack's number at the start of the battle. */
function healHp(B, s, amt) {
    const hp = unitDef(s).hp;
    const before = s.count;
    const total = Math.min(fullHp(s), totalHp(s) + Math.max(0, Math.round(amt)));
    s.count = Math.ceil(total / hp); s.top = total - (s.count - 1) * hp;
    B.events.push({ type: 'heal', id: s.id, n: s.count - before, count: s.count });
    return s.count - before;
}

function applySt(B, s, list) {
    if (!list || s.count <= 0) return;
    for (const [k, n] of list) {
        if (k === 'stun' && unitDef(s).boss && s.side === 'e' && (s.st.stunImm || 0) > 0) continue;
        if (k === 'burn') { s.st.burn = Math.max(s.st.burn || 0, n); s.st.burnD = Math.max(s.st.burnD || 0, Math.round(unitDef(s).hp * 0.6 + 4)); }
        else s.st[k] = Math.max(s.st[k] || 0, n);
        B.events.push({ type: 'status', id: s.id, k, n });
    }
}

function rollD20(B, a) {
    if (a.side !== 'p' || !has(B, 'd20') || B.noRandom) return false;
    const roll = B.rng.int(1, 20);
    B.events.push({ type: 'd20', id: a.id, roll });
    return roll === 20;
}

/**
 * One attack, with the strike back. o: mult, shot, noRetal, pierce, st, flankPer, joust, src
 * Returns the hurt() result for the target.
 */
function attack(B, a, t, o = {}) {
    const shot = !!o.shot;
    let drum = false;
    if (a.side === 'p' && has(B, 'drum') && !B.drumUsed && !o.free) { B.drumUsed = true; drum = true; }
    const nat20 = rollD20(B, a);
    const dmg = calcDamage(B, a, t, o.mult ?? 1, { ...o, drum, nat20 });
    B.events.push({ type: 'attack', id: a.id, target: t.id, shot, dmg, nat20, retal: !!o.retal, from: [a.c, a.r], to: [t.c, t.r], fx: o.fx || null });
    const res = hurt(B, t, dmg, { pierce: o.pierce, src: a.id });
    if (unitDef(a).drain && res.lost > 0 && a.count > 0) healHp(B, a, res.lost * 0.4);
    if (!res.dead) applySt(B, t, o.st);
    if (!shot && !o.retal && !o.noRetal && !res.dead && a.count > 0 && !t.st.stun && (!t.retal || unitDef(t).retalAll)) {
        t.retal = true;
        attack(B, t, a, { mult: t.st.brace ? 2 : 1, retal: true, free: true });
    }
    checkEnd(B);
    return res;
}

function moveTo(B, s, path, fly = flies(s)) {
    if (!path || path.length < 2) return;
    const [c, r] = path[path.length - 1];
    B.events.push({ type: 'move', id: s.id, path: path.map((p) => [p[0], p[1]]), fly });
    s.c = c; s.r = r;
}

// ------------------------------------------------------------------ the free move
/** Every stack may move once a turn without a card (an attack that walks up counts as its move). */
export function canMove(B, s) { return B.phase === 'player' && !B.over && s && s.side === 'p' && !s.moved && !s.st.root && !s.st.stun; }
export function moveTargets(B, s) {
    if (!canMove(B, s)) return [];
    const out = [];
    for (const [k, n] of reachOf(B, s)) if (n.d > 0) out.push(H.unkey(k));
    return out;
}
export function moveStack(B, id, at) {
    const s = stackById(B, id);
    if (!canMove(B, s)) return { ok: false, err: 'that stack cannot move' };
    const map = reachOf(B, s);
    const k = H.key(at[0], at[1]);
    if (!map.has(k) || map.get(k).d === 0) return { ok: false, err: 'out of reach' };
    moveTo(B, s, flies(s) ? [[s.c, s.r], at] : H.pathTo(map, k));
    s.moved = true;
    return { ok: true };
}

// ------------------------------------------------------------------ playing a card
/** cmd: { uid, actor, at: [c, r] } */
export function playCard(B, cmd) {
    if (B.phase !== 'player' || B.over) return { ok: false, err: 'not your turn' };
    const hi = B.hand.findIndex((c) => c.uid === cmd.uid);
    if (hi < 0) return { ok: false, err: 'not in hand' };
    const card = B.hand[hi];
    const d = cardDef(card);
    if (d.unplayable) return { ok: false, err: 'unplayable' };
    if (orphaned(B, card)) return { ok: false, err: 'its bearers are gone' };
    const cost = costOf(B, card);
    if (cost > B.ink) return { ok: false, err: 'not enough ink' };
    const need = needs(card);
    let a = null;
    if (d.actor) {
        a = CREATURES[d.actor] ? mine(B).find((s) => s.key === d.actor) : stackById(B, cmd.actor);
        if (!a || !actorOk(B, d, a)) return { ok: false, err: 'that stack cannot' };
    }
    let at = cmd.at || null;
    if (need === 'hex' || need === 'actor+hex') {
        if (!at || !cardTargets(B, card, a ? a.id : null).some(([c, r]) => c === at[0] && r === at[1])) return { ok: false, err: 'bad target' };
    }
    if (d.kind === 'special' && d.fx === 'warhost' && !mine(B).some((s) => !s.attacked && !s.st.stun)) return { ok: false, err: 'no one can' };

    // pay, and put the card away
    B.ink -= cost;
    if (d.kind === 'attack' && has(B, 'sigil') && !B.sigilUsed) B.sigilUsed = true;
    B.hand.splice(hi, 1);
    if (d.exhaust || card.temp && d.kind === 'curse') B.exhaust.push(card); else B.discard.push(card);
    B.events.push({ type: 'card', uid: card.uid, id: card.id, up: !!card.up, actor: a ? a.id : null, at });

    resolve(B, d, a, at);
    checkEnd(B);
    return { ok: true };
}

function resolve(B, d, a, at) {
    const t = at ? stackAt(B, at[0], at[1]) : null;
    switch (d.kind) {
        case 'move': {
            if (d.tele) moveTo(B, a, [[a.c, a.r], at], true);
            else moveTo(B, a, H.pathTo(reachOf(B, a, d.bonus || 0), H.key(at[0], at[1])));
            a.moved = true;
            break;
        }
        case 'attack': doAttackCard(B, d, a, t); break;
        case 'ward': {
            const targets = d.all ? mine(B) : [d.target === 'ally' && t && !CREATURES[d.actor] ? t : a].filter(Boolean);
            for (const s of targets) {
                const desperate = d.desperate && s.count <= s.start / 2;
                gainWard(B, s, desperate ? d.desperate : d.ward);
                applySt(B, s, d.st);
            }
            if (d.adj) for (const s of mine(B)) if (s !== a && H.dist(s.c, s.r, a.c, a.r) === 1) gainWard(B, s, d.adj);
            break;
        }
        case 'buff': {
            const targets = d.all ? mine(B) : [a];
            for (const s of targets) {
                if (d.might) { s.st.might = 1; s.st.mightP = Math.max(s.st.mightP || 0, d.might); B.events.push({ type: 'status', id: s.id, k: 'might', n: 1 }); }
                if (d.ward) gainWard(B, s, d.ward);
                applySt(B, s, d.st);
                if (d.refreshMove) s.moved = false;
                if (d.refreshAtk) s.attacked = false;
            }
            break;
        }
        case 'spell': {
            const dmg = spellPower(B, d);
            let hits = [];
            if (d.allFoes) hits = foes(B);
            else if (d.area) hits = B.stacks.filter((s) => H.dist(s.c, s.r, at[0], at[1]) <= d.area);
            else if (t) hits = [t];
            B.events.push({ type: 'spell', id: d.id, card: d.name, at, ids: hits.map((s) => s.id), dmg, fx: spellFx(d) });
            const struck = [];
            for (const s of hits) {
                if (dmg > 0) { const res = hurt(B, s, Math.round(dmg * (s.st.vuln ? COMBAT.vuln : 1)), { src: 'spell' }); if (!res.dead) struck.push(s); }
                else struck.push(s);
            }
            for (const s of struck) applySt(B, s, d.st);
            if (d.chain && t) {
                const pool = foes(B).filter((s) => s !== t).sort((p, q) => H.dist(p.c, p.r, t.c, t.r) - H.dist(q.c, q.r, t.c, t.r)).slice(0, d.chain);
                for (const s of pool) {
                    B.events.push({ type: 'spell', card: d.name, at: [s.c, s.r], ids: [s.id], dmg, fx: 'bolt', from: [t.c, t.r] });
                    hurt(B, s, Math.round(dmg * 0.7 * (s.st.vuln ? COMBAT.vuln : 1)), { src: 'spell' });
                }
            }
            break;
        }
        case 'heal': {
            const targets = d.all ? mine(B) : [t && CREATURES[d.actor] ? t : a];
            for (const s of targets) {
                if (!s) continue;
                const amt = d.perUnit ? d.perUnit * a.count : Math.ceil(d.frac * (s.start - s.count)) * unitDef(s).hp;
                healHp(B, s, amt);
            }
            break;
        }
        case 'draw':
            if (d.ink) { B.ink += d.ink; B.events.push({ type: 'ink', n: d.ink }); }
            if (d.n) drawCards(B, d.n);
            break;
        case 'earthwork':
            B.rocks.push(H.key(at[0], at[1]));
            B.events.push({ type: 'rock', at });
            break;
        case 'special': doSpecial(B, d, a); break;
        default: break;
    }
}

function spellFx(d) {
    if (d.id === 'frostbind' || d.st?.some(([k]) => k === 'root') && !d.base) return 'frost';
    if (d.area) return 'meteor';
    if (d.allFoes) return d.base ? 'sparks' : 'hex';
    if (d.chain) return 'bolt';
    if (!d.base) return 'hex';
    return 'fire';
}

function doAttackCard(B, d, a, t) {
    const base = { mult: d.mult ?? 1, noRetal: d.noRetal, pierce: d.pierce, st: d.st, flankPer: d.flankPer, fx: d.id };
    if (d.swoop) {
        const home = [a.c, a.r];
        let spot = H.dist(a.c, a.r, t.c, t.r) === 1 ? home : null;
        if (!spot) {
            const opts = H.neighbors(B, t.c, t.r).filter(([x, y]) => isFree(B, x, y));
            opts.sort((p, q) => H.dist(p[0], p[1], a.c, a.r) - H.dist(q[0], q[1], a.c, a.r));
            spot = opts[0];
        }
        if (spot !== home) moveTo(B, a, [home, spot], true);
        a.attacked = true;
        attack(B, a, t, base);
        if (a.count > 0 && spot !== home && isFree(B, home[0], home[1])) moveTo(B, a, [[a.c, a.r], home], true);
        return;
    }
    if (ranged(a) && !d.line) {
        a.attacked = true;
        const r1 = attack(B, a, t, { ...base, shot: true });
        if (d.twice && !r1.dead && a.count > 0) attack(B, a, t, { ...base, shot: true, free: true });
        return;
    }
    const ap = approach(B, a, t, d.bonus || 0, { canMove: !a.moved, far: !!d.joust });
    if (!ap) return;
    if (ap.d > 0) { moveTo(B, a, ap.path); a.moved = true; }
    a.attacked = true;
    const res = attack(B, a, t, { ...base, joust: d.joust ? d.joust * ap.d : 0 });
    if (a.count <= 0) return;
    if (d.knock && !res.dead) {
        const dir = H.dirTo(a.c, a.r, t.c, t.r);
        const [nx, ny] = H.neighbor(t.c, t.r, dir);
        if (dir >= 0 && isFree(B, nx, ny)) { B.events.push({ type: 'knock', id: t.id, from: [t.c, t.r], to: [nx, ny] }); t.c = nx; t.r = ny; }
    }
    if (d.line) {
        const dir = H.dirTo(a.c, a.r, t.c, t.r);
        let [x, y] = [t.c, t.r];
        for (let i = 0; i < d.line - 1 && dir >= 0; i++) {
            [x, y] = H.neighbor(x, y, dir);
            const o = stackAt(B, x, y);
            if (o && o.side === 'e') attack(B, a, o, { ...base, noRetal: true, free: true });
        }
    }
    if (d.cleave) for (const o of adjacentFoes(B, a)) if (o !== t) attack(B, a, o, { mult: d.cleave, noRetal: true, free: true, fx: 'cleave' });
    if (d.onKill && res.dead) { a.attacked = false; B.ink += 1; B.events.push({ type: 'ink', n: 1 }); }
}

function doSpecial(B, d, a) {
    switch (d.fx) {
        case 'warhost':
            for (const s of mine(B)) {
                if (s.attacked || s.st.stun || !foes(B).length) continue;
                const t = nearestFoe(B, s, !ranged(s));
                if (!t) continue;
                if (ranged(s)) { s.attacked = true; attack(B, s, t, { mult: d.mult, shot: true }); continue; }
                const ap = approach(B, s, t, 0, { canMove: !s.moved });
                if (!ap) continue;
                if (ap.d > 0) { moveTo(B, s, ap.path); s.moved = true; }
                s.attacked = true;
                attack(B, s, t, { mult: d.mult });
            }
            break;
        case 'entangle': {
            B.events.push({ type: 'spell', card: d.name, at: [a.c, a.r], fx: 'roots', ids: [] });
            for (const t of foes(B).filter((t) => H.dist(t.c, t.r, a.c, a.r) <= 2)) {
                const r = hurt(B, t, calcDamage(B, a, t, d.mult, { noFlank: true }), { src: a.id });
                if (!r.dead) applySt(B, t, [['root', 1]]);
            }
            break;
        }
        case 'moonlight': {
            B.events.push({ type: 'spell', card: d.name, at: [a.c, a.r], fx: 'moon', ids: [] });
            for (const s of mine(B).filter((s) => H.dist(s.c, s.r, a.c, a.r) <= 2)) {
                healHp(B, s, d.perUnit * a.count);
                for (const k of AILMENTS) delete s.st[k];
            }
            break;
        }
        case 'sunfire':
            B.events.push({ type: 'spell', card: d.name, at: [a.c, a.r], fx: 'sun', ids: foes(B).map((s) => s.id) });
            for (const t of foes(B)) hurt(B, t, calcDamage(B, a, t, d.mult, { noFlank: true }), { src: a.id });
            break;
        default: break;
    }
}

function nearestFoe(B, s, mustReach) {
    let best = null, bd = Infinity;
    for (const t of B.stacks) {
        if (t.side === s.side) continue;
        if (mustReach && !approach(B, s, t, 0, { canMove: !s.moved })) continue;
        const d = H.dist(s.c, s.r, t.c, t.r);
        if (d < bd || (d === bd && totalHp(t) < totalHp(best))) { bd = d; best = t; }
    }
    return best;
}

// ------------------------------------------------------------------ turns
function tick(B, side) {
    for (const s of B.stacks) {
        if (s.side !== side) continue;
        for (const k of Object.keys(s.st)) {
            if (k === 'mightP' || k === 'burnD' || k === 'stunImm' || UNTIL_NEXT.has(k)) continue;
            s.st[k]--;
            if (s.st[k] <= 0) { delete s.st[k]; if (k === 'might') delete s.st.mightP; if (k === 'burn') delete s.st.burnD; }
        }
        if (s.st.stunImm) { s.st.stunImm--; if (!s.st.stunImm) delete s.st.stunImm; }
    }
}

/** Burns and regeneration at the start of a side's turn. */
function upkeep(B, side) {
    for (const s of B.stacks.slice()) {
        if (s.side !== side) continue;
        if (s.st.burn) { B.events.push({ type: 'burn', id: s.id }); hurt(B, s, s.st.burnD * Math.max(1, Math.ceil(s.count / 2)), { pierce: true, src: 'burn' }); }
        if (s.count > 0 && unitDef(s).regen && s.count < s.start) healHp(B, s, fullHp(s) * unitDef(s).regen);
        else if (s.count > 0 && unitDef(s).regen && s.top < unitDef(s).hp) healHp(B, s, unitDef(s).hp);
    }
    checkEnd(B);
}

function startTurn(B) {
    if (B.over) return;
    B.turn++;
    B.phase = 'player';
    B.drumUsed = false; B.sigilUsed = false;
    for (const s of B.stacks) {
        for (const k of UNTIL_NEXT) if (s.side === 'p') delete s.st[k];
        if (s.side === 'p') { s.ward = 0; s.moved = false; s.attacked = false; }
        else s.retal = false;
    }
    if (B.turn === 1 && has(B, 'banner')) for (const s of mine(B)) gainWard(B, s, 0.12, 'banner');
    B.events.push({ type: 'turn', side: 'p', n: B.turn });
    upkeep(B, 'p');
    if (B.over) return;
    let n = B.drawN + (has(B, 'astrolabe') ? 1 : 0);
    if (B.turn === 1) n += (has(B, 'ledger') ? 2 : 0) + (B.hero.draw || 0);
    drawCards(B, n);
    B.ink = B.inkMax + (has(B, 'crown') ? 1 : 0) + (has(B, 'grail') ? 1 : 0) + (B.turn === 1 ? (has(B, 'inkwell') ? 1 : 0) + (B.hero.ink || 0) : 0);
    if (has(B, 'candle') && foes(B).length && !B.noRandom) {
        const t = foes(B)[Math.floor(B.rng() * foes(B).length)];
        B.events.push({ type: 'spell', card: 'Ever-burning Candle', at: [t.c, t.r], ids: [t.id], fx: 'fire', dmg: 6 + 6 * B.hero.lore });
        hurt(B, t, 6 + 6 * B.hero.lore, { src: 'spell' });
        if (B.over) return;
    }
    for (const e of foes(B)) pickIntent(B, e);
}

/** End your turn: discard, then the foes act one at a time (stepEnemy). */
export function endTurn(B) {
    if (B.phase !== 'player' || B.over) return { ok: false, err: 'not your turn' };
    const keep = [];
    if (has(B, 'satchel')) {
        const cand = B.hand.filter((c) => !cardDef(c).unplayable && !orphaned(B, c)).sort((p, q) => cardDef(q).cost - cardDef(p).cost);
        keep.push(...cand.slice(0, 2));
    }
    for (const c of B.hand.splice(0)) {
        if (keep.includes(c)) { B.hand.push(c); continue; }
        const d = cardDef(c);
        if (d.ethereal || orphaned(B, c) || c.temp) B.exhaust.push(c); else B.discard.push(c);
    }
    tick(B, 'p');
    B.phase = 'enemy';
    B.events.push({ type: 'turn', side: 'e', n: B.turn });
    for (const s of B.stacks) { if (s.side === 'e') s.ward = 0; else s.retal = false; }
    upkeep(B, 'e');
    if (B.over) return { ok: true };
    B.eq = foes(B).slice().sort((p, q) => spdOf(B, q) - spdOf(B, p) || p.id - q.id).map((s) => s.id);
    B.eqT = 0;
    return { ok: true };
}

/** One foe carries out its intent. Returns false when the enemy phase is over (and your turn has begun). */
export function stepEnemy(B) {
    if (B.phase !== 'enemy' || B.over) return false;
    while (B.eq.length) {
        const e = stackById(B, B.eq.shift());
        if (!e) continue;
        doIntent(B, e);
        checkEnd(B);
        if (B.eq.length && !B.over) return true;
        break;
    }
    if (B.over) return false;
    if (B.eq.length) return true;
    tick(B, 'e');
    startTurn(B);
    return false;
}

export function runEnemyPhase(B) {
    let guard = 0;
    while (B.phase === 'enemy' && !B.over && guard++ < 50) stepEnemy(B);
}

function checkEnd(B) {
    if (B.over) return;
    const boss = B.boss != null ? B.stacks.find((s) => s.side === 'e' && unitDef(s).boss) : null;
    if (!foes(B).length || (B.boss != null && !boss)) {
        for (const s of foes(B)) { B.events.push({ type: 'flee', id: s.id }); }
        B.stacks = mine(B);
        B.over = 'won';
        B.phase = 'over';
        B.events.push({ type: 'won' });
    } else if (!mine(B).length) {
        B.over = 'lost';
        B.phase = 'over';
        B.events.push({ type: 'lost' });
    }
}

// ------------------------------------------------------------------ the foe's mind
function canReach(B, e, s) { return ranged(e) || !!approach(B, e, s, 0, { canMove: !e.st.root }); }

function chooseTarget(B, e, m) {
    const ps = mine(B);
    if (!ps.length) return null;
    const pool = m.k === 'hex' || m.k === 'shoot' ? ps : ps.filter((s) => canReach(B, e, s));
    const taunt = ps.find((s) => s.st.taunt && (m.k === 'shoot' || m.k === 'hex' || canReach(B, e, s)));
    if (taunt) return taunt;
    const pref = unitDef(e).pref;
    const list = pool.length ? pool : ps;
    const score = (s) => {
        if (m.k === 'hex') return -(s.count * unitDef(s).dmg);                 // curse the hardest hitter
        if (m.k === 'shoot') return pref === 'weak' ? totalHp(s) : -(s.count * unitDef(s).dmg) + totalHp(s) * 0.02;
        if (pref === 'weak') return totalHp(s);
        return H.dist(e.c, e.r, s.c, s.r) * 1000 + totalHp(s) * 0.01;
    };
    return list.slice().sort((a, b) => score(a) - score(b) || a.id - b.id)[0];
}

function pickIntent(B, e) {
    if (e.st.stun) { e.intent = { i: -1, k: 'stunned', target: null, est: 0, reach: true }; return; }
    const moves = unitDef(e).moves;
    let i;
    if (unitDef(e).cycle) { i = e.mi % moves.length; e.mi++; }
    else {
        const ok = moves.map((m, j) => j).filter((j) => !(e.hist.length >= 2 && e.hist[0] === j && e.hist[1] === j) && validMove(B, e, moves[j]));
        const list = ok.length ? ok : [0];
        let tot = 0;
        for (const j of list) tot += moves[j].w || 1;
        let r = B.rng() * tot;
        i = list[0];
        for (const j of list) { r -= moves[j].w || 1; if (r <= 0) { i = j; break; } }
        e.hist = [i, ...e.hist].slice(0, 2);
    }
    const m = moves[i];
    const t = ['attack', 'shoot', 'hex', 'breath', 'sweep'].includes(m.k) ? chooseTarget(B, e, m) : null;
    e.intent = { i, k: m.k, target: t ? t.id : null, est: t && m.k !== 'hex' ? calcDamage(B, e, t, m.mult ?? 1, { shot: m.k === 'shoot' }) : 0, reach: t ? canReach(B, e, t) : true };
}

function validMove(B, e, m) {
    if (m.k === 'summon') return foes(B).length < 5;
    if (m.k === 'cry') return foes(B).length > 1;
    return true;
}

/** Walk toward the nearest of your stacks when nothing can be reached this turn. */
function advance(B, e) {
    if (e.st.root) return;
    const goals = [];
    for (const s of mine(B)) for (const [x, y] of H.neighbors(B, s.c, s.r)) if (isFree(B, x, y) || (x === e.c && y === e.r)) goals.push([x, y]);
    if (!goals.length) return;
    const map = reachOf(B, e, 0);
    if (flies(e)) {
        let best = null, bd = Infinity;
        for (const [k] of map) { const [x, y] = H.unkey(k); for (const g of goals) { const d = H.dist(x, y, g[0], g[1]); if (d < bd) { bd = d; best = k; } } }
        if (best != null && best !== H.key(e.c, e.r)) moveTo(B, e, [[e.c, e.r], H.unkey(best)], true);
        return;
    }
    const field = H.distField(B, goals, (x, y) => isFree(B, x, y) || (x === e.c && y === e.r));
    let best = H.key(e.c, e.r), bd = field.get(best) ?? Infinity;
    for (const [k] of map) { const d = field.get(k); if (d != null && d < bd) { bd = d; best = k; } }
    if (best !== H.key(e.c, e.r)) moveTo(B, e, H.pathTo(map, best));
}

function doIntent(B, e) {
    const it = e.intent || { k: 'attack' };
    const m = unitDef(e).moves[it.i] || { k: 'attack', mult: 1 };
    e.intent = null;
    if (e.st.stun) {
        delete e.st.stun;
        if (unitDef(e).boss) e.st.stunImm = 2;
        B.events.push({ type: 'stunned', id: e.id });
        return;
    }
    B.events.push({ type: 'act', id: e.id, k: m.k });
    let t = it.target != null ? stackById(B, it.target) : null;
    const melee = (mult, o = {}) => {
        const taunt = mine(B).find((s) => s.st.taunt && approach(B, e, s, 0, { canMove: !e.st.root }));
        if (taunt) t = taunt;
        if (!t || !approach(B, e, t, 0, { canMove: !e.st.root })) t = mine(B).filter((s) => approach(B, e, s, 0, { canMove: !e.st.root })).sort((a, b) => H.dist(e.c, e.r, a.c, a.r) - H.dist(e.c, e.r, b.c, b.r) || totalHp(a) - totalHp(b))[0] || null;
        if (!t) { advance(B, e); return null; }
        const ap = approach(B, e, t, 0, { canMove: !e.st.root });
        if (ap.d > 0) moveTo(B, e, ap.path);
        return attack(B, e, t, { mult, st: m.st ? [m.st] : null, ...o });
    };
    switch (m.k) {
        case 'attack': melee(m.mult ?? 1); break;
        case 'shoot': {
            if (!t) t = chooseTarget(B, e, m);
            if (t) attack(B, e, t, { mult: m.mult ?? 1, shot: true, st: m.st ? [m.st] : null });
            break;
        }
        case 'ward': gainWard(B, e, m.f || 0.25); break;
        case 'cry':
            B.events.push({ type: 'cry', id: e.id });
            for (const s of foes(B)) { s.st.might = Math.max(s.st.might || 0, 2); s.st.mightP = Math.max(s.st.mightP || 0, m.p || 25); B.events.push({ type: 'status', id: s.id, k: 'might', n: 2 }); }
            break;
        case 'hex':
            if (!t) t = chooseTarget(B, e, m);
            if (t) { B.events.push({ type: 'spell', card: 'hex', at: [t.c, t.r], ids: [t.id], fx: m.st[0] === 'stun' ? 'gaze' : 'hex', from: [e.c, e.r] }); applySt(B, t, [m.st]); }
            break;
        case 'roar':
            B.events.push({ type: 'cry', id: e.id, roar: true });
            for (const s of mine(B)) applySt(B, s, [m.st]);
            break;
        case 'curse':
            B.discard.push(curse(B, m.card));
            B.events.push({ type: 'curse', id: e.id, card: m.card });
            break;
        case 'summon': {
            const n = Math.round(m.n * (1 + 0.08 * B.turn));
            const spots = [];
            for (let c = B.cols - 1; c >= 0; c--) for (let r = 0; r < B.rows; r++) if (isFree(B, c, r)) spots.push([c, r]);
            spots.sort((p, q) => H.dist(p[0], p[1], e.c, e.r) - H.dist(q[0], q[1], e.c, e.r));
            if (spots.length && foes(B).length < 5) {
                const s = addStack(B, 'e', m.key, n, spots[0][0], spots[0][1]);
                B.events.push({ type: 'summon', id: s.id, by: e.id, key: m.key, count: n, at: spots[0] });
            }
            break;
        }
        case 'breath': {
            if (!t || !approach(B, e, t)) t = mine(B).find((s) => approach(B, e, s)) || null;
            if (!t) { advance(B, e); break; }
            const ap = approach(B, e, t);
            if (ap.d > 0) moveTo(B, e, ap.path);
            const dir = H.dirTo(e.c, e.r, t.c, t.r);
            B.events.push({ type: 'spell', card: 'breath', at: [t.c, t.r], ids: [], fx: 'breath', from: [e.c, e.r] });
            let [x, y] = [e.c, e.r];
            for (let i = 0; i < 3 && dir >= 0; i++) {
                [x, y] = H.neighbor(x, y, dir);
                const o = stackAt(B, x, y);
                if (o && o.side === 'p') attack(B, e, o, { mult: m.mult, noRetal: true, st: m.st ? [m.st] : null, noFlank: true });
                if (B.over) break;
            }
            break;
        }
        case 'sweep': {
            const r = melee(m.mult ?? 1, { noRetal: true });
            if (r !== null && e.count > 0) for (const o of adjacentFoes(B, e)) if (o !== t) attack(B, e, o, { mult: m.mult ?? 1, noRetal: true, noFlank: true });
            break;
        }
        default: break;
    }
}

// ------------------------------------------------------------------ copies, previews
export function cloneBattle(B) {
    const { rng, events, ...rest } = B;
    const C = JSON.parse(JSON.stringify(rest));
    C.rng = makeRng(0); C.rng.setState(rng.state());
    C.events = [];
    return C;
}

/** What a card would do, without doing it: the events of a dry run with no dice. */
export function preview(B, cmd) {
    const C = cloneBattle(B);
    C.noRandom = true;
    const r = playCard(C, cmd);
    return r.ok ? C.events : null;
}

/** The legion's losses after a battle: who is left of each army slot. */
export function survivors(B) {
    const out = {};
    for (const s of mine(B)) out[s.ai] = s.count;
    return out;
}
