/**
 * battle.js — a gem duel between the hero ('p') and a monster ('e').
 *
 * makeBattle(playerSide, monsterSide, seed) → battle. Actions (each returns an event list
 * that the view plays back in order):
 *   doSwap(bt, a, b)     the side whose turn it is plays a move
 *   doCast(bt, spellIx)  cast a spell (ends the turn unless the spell is quick)
 *   doPotion(bt, id)     player only; always quick
 *   monsterTurn(bt)      let the AI take its whole action (used when bt.turn === 'e')
 * Battle events: turn, gain, dmg, heal, shield, cast, potion, burn, stun, buff, drain,
 * extra, over, plus everything board.js emits.
 */

import { makeRng, clamp } from './rng.js';
import { G, MANA, SP, SPELLS, POTIONS, rankMult } from './data.js';
import { createBoard, playSwap, destroyCells, morphCells, W, H, indexOf, findMoves } from './board.js';
import { chooseMonsterAction } from './ai.js';

export function makeBattle(p, e, seed, opts = {}) {
    const rng = makeRng(seed);
    const bt = {
        seed, rng, turn: 'p', turnNo: 1, over: null,
        board: createBoard(rng),
        sides: { p, e },
        loot: { gold: 0, xp: 0 },
        potions: { ...(opts.potions || {}) },
        stats: { gems: new Array(8).fill(0), fours: 0, fives: 0, cascades: 0, spells: 0, potions: 0, maxChain: 0, moves: 0, crits: 0, dmgTaken: 0 },
        coinValue: opts.coinValue || 1, starValue: opts.starValue || 1,
        haste: false,
        kind: opts.kind || 'battle',
    };
    for (const s of [p, e]) {
        s.shield = s.shield || 0;
        s.buffs = s.buffs || [];
        s.stun = 0; s.stunImmune = 0; s.burn = null;
        s.hp = s.maxHp;
        for (const m of MANA) s.mana[m] = clamp(s.mana[m] || 0, 0, s.manaCap);
    }
    return bt;
}

const other = (k) => (k === 'p' ? 'e' : 'p');

// ------------------------------------------------------------------ Helpers

export function skullDamage(s) {
    let n = s.skullDmg;
    for (const b of s.buffs) if (b.key === 'skull') n += b.n;
    for (const b of s.buffs) if (b.key === 'skullMult') n *= b.n;
    return n;
}

export function canCast(bt, sideKey, ix) {
    const s = bt.sides[sideKey];
    const sp = s.spells[ix];
    if (!sp) return false;
    const def = SPELLS[sp.id] || sp.def;
    for (const [c, n] of Object.entries(def.cost)) if ((s.mana[c] || 0) < n) return false;
    return true;
}

export function spellPower(s, def, rank) {
    let p = s.spellPower * rankMult(rank);
    if (s.fireBoost && def.ops.some((o) => o.el === 'fire')) p *= 1 + s.fireBoost;
    return p;
}

function addMana(bt, s, sideKey, color, n, ev) {
    const before = s.mana[color];
    s.mana[color] = clamp(before + n, 0, s.manaCap);
    return s.mana[color] - before;
}

function damage(bt, targetKey, amount, kind, ev, extra = {}) {
    if (bt.over) return 0;
    const t = bt.sides[targetKey];
    let n = Math.max(0, amount);
    if (kind === 'skull' && t.ward) n *= 1 - t.ward;
    if (extra.el && t.weak === extra.el) n *= 1.5;
    if (extra.el && t.resist === extra.el) n *= 0.6;
    n = Math.round(n);
    if (n <= 0) return 0;
    let absorbed = 0;
    if (t.shield > 0) { absorbed = Math.min(t.shield, n); t.shield -= absorbed; n -= absorbed; }
    t.hp = Math.max(0, t.hp - n);
    if (targetKey === 'p') bt.stats.dmgTaken += n;
    ev.push({ k: 'dmg', side: targetKey, n, absorbed, kind, crit: !!extra.crit, hp: t.hp, shield: t.shield, weak: extra.el && t.weak === extra.el });
    if (t.hp <= 0) finish(bt, targetKey === 'e' ? 'win' : 'lose', ev);
    return n + absorbed;
}

function heal(bt, sideKey, n, ev) {
    const s = bt.sides[sideKey];
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + Math.round(n));
    if (s.hp > before) ev.push({ k: 'heal', side: sideKey, n: s.hp - before, hp: s.hp });
}

function finish(bt, result, ev) {
    if (bt.over) return;
    bt.over = result;
    ev.push({ k: 'over', result });
}

/** Turn gems collected by `sideKey` into mana, damage, gold and XP. */
function collector(bt, sideKey, ev) {
    return (tally, info) => {
        if (bt.over) return;
        const s = bt.sides[sideKey], foe = other(sideKey);
        const gain = { side: sideKey, mana: {}, gold: 0, xp: 0, step: info.step };
        MANA.forEach((m, i) => {
            if (!tally[i]) return;
            const got = addMana(bt, s, sideKey, m, tally[i] + (s.manaPer?.[m] || 0), ev);
            gain.mana[m] = got;
        });
        if (sideKey === 'p') {
            for (let i = 0; i < 7; i++) bt.stats.gems[i] += tally[i];
            if (tally[G.COIN]) { gain.gold = Math.round(tally[G.COIN] * bt.coinValue * (s.goldMult || 1)); bt.loot.gold += gain.gold; }
            if (tally[G.STAR]) { gain.xp = Math.round(tally[G.STAR] * bt.starValue * (s.xpMult || 1)); bt.loot.xp += gain.xp; }
            if (info.step > 1) bt.stats.cascades++;
            bt.stats.maxChain = Math.max(bt.stats.maxChain, info.step);
            if (s.leafHeal && tally[G.LEAF]) heal(bt, 'p', tally[G.LEAF] * s.leafHeal, ev);
        } else {
            // Monsters pocket coins (you lose them) and feed on stars (mana of their colour).
            if (tally[G.COIN]) { gain.gold = -Math.min(bt.loot.gold, Math.round(tally[G.COIN] * bt.coinValue * (s.greedy ? 2 : 1))); bt.loot.gold += gain.gold; }
            if (tally[G.STAR] && s.color) gain.mana[s.color] = (gain.mana[s.color] || 0) + addMana(bt, s, sideKey, s.color, tally[G.STAR], ev);
        }
        ev.push({ k: 'gain', ...gain });
        if (tally[G.SKULL]) {
            let n = tally[G.SKULL] * skullDamage(s);
            const crit = s.crit > 0 && bt.rng.next() < s.crit;
            if (crit) { n *= 1.5; if (sideKey === 'p') bt.stats.crits++; }
            const dealt = damage(bt, foe, n, 'skull', ev, { crit, from: sideKey });
            if (s.lifesteal && dealt > 0) heal(bt, sideKey, dealt * s.lifesteal, ev);
            const t = bt.sides[foe];
            if (t.thorns && dealt > 0 && !bt.over) damage(bt, sideKey, t.thorns, 'thorns', ev);
        }
    };
}

// ------------------------------------------------------------------ Turn flow

function endTurn(bt, ev, extra) {
    if (bt.over) return;
    const cur = bt.turn;
    const s = bt.sides[cur];
    if (!extra && cur === 'p' && bt.haste) { bt.haste = false; extra = true; }
    if (extra) {
        ev.push({ k: 'extra', side: cur });
        return;
    }
    // Buffs tick down at the end of their owner's turn.
    s.buffs = s.buffs.filter((b) => --b.turns > 0);
    if (s.stunImmune > 0) s.stunImmune--;
    bt.turn = other(cur);
    if (bt.turn === 'p') bt.turnNo++;
    startTurn(bt, ev);
}

function startTurn(bt, ev) {
    const key = bt.turn;
    const s = bt.sides[key];
    ev.push({ k: 'turn', side: key, n: bt.turnNo });
    if (s.burn) {
        damage(bt, key, s.burn.n, 'burn', ev);
        if (--s.burn.turns <= 0) s.burn = null;
        if (bt.over) return;
    }
    if (s.stun > 0) {
        s.stun--;
        if (s.stun === 0) s.stunImmune = 3;
        ev.push({ k: 'stun', side: key, skipped: true });
        s.buffs = s.buffs.filter((b) => --b.turns > 0);
        bt.turn = other(key);
        if (bt.turn === 'p') bt.turnNo++;
        startTurn(bt, ev);
    }
}

export function doSwap(bt, a, b) {
    const ev = [];
    if (bt.over) return ev;
    const key = bt.turn;
    const res = playSwap(bt.board, bt.rng, a, b, ev, collector(bt, key, ev));
    if (!res.ok) return ev;
    if (key === 'p') {
        bt.stats.moves++;
        if (res.maxGroup >= 4) bt.stats.fours++;
        if (res.maxGroup >= 5) bt.stats.fives++;
    }
    let extra = res.extra;
    if (!extra && !bt.over && bt.sides[key].hasteChance && bt.rng.next() < bt.sides[key].hasteChance) {
        extra = true;
        ev.push({ k: 'haste', side: key });
    }
    endTurn(bt, ev, extra);
    return ev;
}

export function doCast(bt, ix) {
    const ev = [];
    if (bt.over) return ev;
    const key = bt.turn;
    if (!canCast(bt, key, ix)) return ev;
    const s = bt.sides[key];
    const sp = s.spells[ix];
    const def = SPELLS[sp.id] || sp.def;
    for (const [c, n] of Object.entries(def.cost)) s.mana[c] -= n;
    ev.push({ k: 'cast', side: key, spell: sp.id, name: def.name, icon: def.icon, quick: !!def.quick });
    if (key === 'p') bt.stats.spells++;
    applyOps(bt, key, def.ops, spellPower(s, def, sp.rank), ev);
    if (!def.quick) endTurn(bt, ev, false);
    else if (!bt.over) ev.push({ k: 'quick', side: key });
    return ev;
}

export function doPotion(bt, id) {
    const ev = [];
    if (bt.over || bt.turn !== 'p' || !(bt.potions[id] > 0)) return ev;
    bt.potions[id]--;
    bt.stats.potions++;
    const s = bt.sides.p;
    ev.push({ k: 'potion', side: 'p', id, name: POTIONS[id].name, icon: POTIONS[id].icon });
    const ops = {
        heal: [{ op: 'heal', n: s.maxHp * 0.3, raw: true }],
        mana: [{ op: 'mana', color: 'all', n: 6 }],
        bomb: [{ op: 'special', kind: 'bomb', count: 2 }],
        skull: [{ op: 'convert', from: 'any', to: G.SKULL, count: 6 }],
        prism: [{ op: 'special', kind: 'prism', count: 1 }],
        swift: [{ op: 'haste' }],
    }[id];
    applyOps(bt, 'p', ops, 1, ev);
    if (!bt.over) ev.push({ k: 'quick', side: 'p' });
    return ev;
}

/** The monster's whole turn (spell or move, plus any extra turns it earns). */
export function monsterTurn(bt) {
    const ev = [];
    let guard = 0;
    while (!bt.over && bt.turn === 'e' && guard++ < 12) {
        const act = chooseMonsterAction(bt);
        let sub;
        if (act.cast !== undefined) sub = doCast(bt, act.cast);
        else sub = doSwap(bt, act.move.a, act.move.b);
        if (!sub.length) { // defensive: if the AI picked something illegal, play any legal move
            const m = findMoves(bt.board)[0];
            sub = doSwap(bt, m.a, m.b);
        }
        ev.push(...sub);
        // A single monster action at a time: the view plays it, then asks again.
        break;
    }
    return ev;
}

// ------------------------------------------------------------------ Spell ops

function plainCells(bt, filter) {
    const out = [];
    bt.board.cells.forEach((c, i) => { if (c && c.t < G.PRISM && !c.sp && (!filter || filter(c))) out.push(i); });
    return out;
}

export function applyOps(bt, key, ops, power, ev) {
    const s = bt.sides[key], foeKey = other(key), foe = bt.sides[foeKey];
    const collect = collector(bt, key, ev);
    for (const o of ops) {
        if (bt.over) break;
        switch (o.op) {
            case 'dmg': damage(bt, foeKey, o.n * power, 'spell', ev, { el: o.el }); break;
            case 'heal': heal(bt, key, o.raw ? o.n : o.n * power, ev); break;
            case 'shield': {
                const n = Math.round(o.n * power);
                s.shield += n;
                ev.push({ k: 'shield', side: key, n, total: s.shield });
                break;
            }
            case 'burn':
                foe.burn = { n: Math.max(1, Math.round(o.n * power)), turns: o.turns };
                ev.push({ k: 'burn', side: foeKey, n: foe.burn.n, turns: o.turns });
                break;
            case 'stun':
                // After a stun wears off the victim shrugs off stuns for two of its turns,
                // so a pair of stun spells can never lock someone out of the game.
                if (foe.stunImmune > 0) { ev.push({ k: 'resist', side: foeKey, what: 'stun' }); break; }
                foe.stun = Math.max(foe.stun, o.turns);
                ev.push({ k: 'stun', side: foeKey, turns: o.turns });
                break;
            case 'mana': {
                const colors = o.color === 'all' ? MANA : [o.color];
                const gain = { side: key, mana: {}, gold: 0, xp: 0 };
                for (const c of colors) gain.mana[c] = addMana(bt, s, key, c, o.n, ev);
                ev.push({ k: 'gain', ...gain });
                break;
            }
            case 'drain': {
                const colors = o.color === 'all' ? MANA : [o.color];
                const lost = {};
                for (const c of colors) { const n = Math.min(foe.mana[c], o.n); foe.mana[c] -= n; lost[c] = n; }
                ev.push({ k: 'drain', side: foeKey, mana: lost });
                break;
            }
            case 'buff':
                s.buffs.push({ key: o.key, n: o.n, turns: o.turns });
                ev.push({ k: 'buff', side: key, key: o.key, n: o.n, turns: o.turns });
                break;
            case 'haste':
                bt.haste = true;
                ev.push({ k: 'buff', side: key, key: 'haste', n: 1, turns: 1 });
                break;
            case 'destroyColor': {
                const cells = [];
                bt.board.cells.forEach((c, i) => { if (c && c.t === o.gem) cells.push(i); });
                if (o.per) damage(bt, foeKey, cells.length * o.per * power, 'spell', ev, { el: o.el });
                if (!bt.over) destroyCells(bt.board, bt.rng, cells, ev, collect, { collect: o.collect });
                break;
            }
            case 'destroyRandom': {
                const all = [];
                bt.board.cells.forEach((c, i) => { if (c) all.push(i); });
                bt.rng.shuffle(all);
                destroyCells(bt.board, bt.rng, all.slice(0, o.count), ev, collect, { collect: o.collect });
                break;
            }
            case 'destroyRows': {
                const rows = bt.rng.shuffle([...Array(H).keys()]).slice(0, o.count);
                const cells = [];
                for (const y of rows) for (let x = 0; x < W; x++) cells.push(indexOf(x, y));
                destroyCells(bt.board, bt.rng, cells, ev, collect, { collect: true });
                break;
            }
            case 'destroyArea': {
                const cells = [];
                for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) cells.push(indexOf(x, y));
                destroyCells(bt.board, bt.rng, cells, ev, collect, { collect: true });
                break;
            }
            case 'convert': {
                let cells;
                if (o.from === 'any') cells = bt.rng.shuffle(plainCells(bt, (c) => c.t !== o.to)).slice(0, o.count);
                else { cells = []; bt.board.cells.forEach((c, i) => { if (c && c.t === o.from) cells.push(i); }); }
                if (o.count && o.from !== 'any') cells = bt.rng.shuffle(cells).slice(0, o.count);
                morphCells(bt.board, bt.rng, cells.map((i) => ({ i, t: o.to })), ev, collect);
                break;
            }
            case 'special': {
                const cells = bt.rng.shuffle(plainCells(bt)).slice(0, o.count);
                const changes = cells.map((i) => {
                    if (o.kind === 'prism') return { i, t: G.PRISM, sp: SP.NONE };
                    if (o.kind === 'bomb') return { i, sp: SP.BOMB };
                    return { i, sp: bt.rng.chance(0.5) ? SP.LINE_H : SP.LINE_V };
                });
                morphCells(bt.board, bt.rng, changes, ev, collect);
                break;
            }
            default: break;
        }
    }
}

/** Plain-object copy for saves/tests (rng state included). */
export function battleSnapshot(bt) {
    return JSON.parse(JSON.stringify({ ...bt, rng: undefined, rngState: bt.rng.state }));
}
