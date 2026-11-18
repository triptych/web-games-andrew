// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// SANDSUNK is turn-based: everything the player can do is a command passed to act(G, cmd), which changes G
// and pushes events for the view, the sound and the HUD. The UI, the bot and the tests all go through act().
//
// Commands
//   { t: 'dig', i }        strike the block at cell i (or attack the monster there, or turn the channel there)
//   { t: 'mark', i }       mark / unmark a block as dangerous
//   { t: 'rot', i }        turn the sun channel at cell i a quarter turn
//   { t: 'press', i, k }   press rune k (0–4) of the chest lock at cell i
//   { t: 'use', id, i }    use an item (blast needs a target cell i)
//   { t: 'descend' }       go down the open hatch of a cleared floor
//   { t: 'camp' }          climb up to camp     { t: 'embark' }   climb back down
//   { t: 'buy', id }       buy from Zahra (camp only)
//   { t: 'learn', id }     spend a skill point
//   { t: 'claim', q }      claim the reward of finished quest q
//   { t: 'continue' }      after the ending, carry on into the endless deeps

import {
    BASE, PER_RANK, LEVEL_CAP, xpToNext, LEVEL_GIFT, FAINT_FEE, SAFE_FLOOR_HP, FALSE_ALARM, AMBUSH_MULT,
    SHOP, ITEM_FX, STORY_FLOORS,
} from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { BLOCKS } from './data/blocks.js';
import { MONSTERS, monsterStats, TRAPS, trapDamage } from './data/monsters.js';
import { ARTIFACTS, ART_BY_ID } from './data/artifacts.js';
import { SKILL_BY_ID } from './data/skills.js';
import { QUESTS } from './data/quests.js';
import { LINES } from './data/story.js';
import { genFloor, neighbours4, neighbours8, power, ORDINARY } from './floor.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ derived numbers
export const rank = (G, id) => G.skills[id] || 0;
export const has = (G, id) => !!G.arts[id];
export const maxHp = (G) => BASE.hp + PER_RANK.hp * rank(G, 'vitality');
export const maxSt = (G) => BASE.stamina + PER_RANK.stamina * rank(G, 'stamina')
    + (has(G, 'compass') ? 8 : 0) + (has(G, 'hourglass') ? 10 : 0) + (has(G, 'heart') ? 10 : 0);
export const pickPower = (G) => BASE.pick + rank(G, 'pick') + (has(G, 'pickhead') ? 1 : 0) + (has(G, 'heart') ? 1 : 0);
export const goldMult = (G) => (1 + 0.2 * rank(G, 'greed')) * (has(G, 'scarab') ? 1.15 : 1);

/** Damage one strike does to a block of type b, before luck and the gauntlet. */
export function blockDamage(G, b) {
    const P = pickPower(G);
    const fam = BLOCKS[b].family;
    if (fam === 'stone') return P + rank(G, 'stone');
    if (fam === 'obsidian') return Math.max(1, Math.floor(P * (1 + rank(G, 'obsidian') + (has(G, 'chisel') ? 1 : 0)) / 3));
    if (fam === 'crystal') return Math.max(1, Math.floor(P * (1 + rank(G, 'crystal') + (has(G, 'fork') ? 1 : 0)) / 3));
    return P;
}

/** A block can be struck when it touches open floor on one of its four sides. */
export function exposed(F, i) {
    const c = F.cells[i];
    return c.k === 'b' && neighbours4(F, i).some((j) => F.cells[j].k === 'o');
}
const isDanger = (c) => c.k === 'b' && !!c.c?.d;

// ------------------------------------------------------------------ setup
export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(Math.floor(hash3(seed, 7, 77) * 4294967296)),
        mode: 'dig',
        n: 1,
        F: null,
        hp: 0, st: 0,
        lv: 1, xp: 0, sp: 0,
        skills: {},
        arts: {}, artOrder: [],
        gold: 0, gems: 0,
        inv: { potion: 1, tonic: 1, hyper: 0, ward: 0, blast: 0, dowse: 0 },
        keys: 0, hyper: 0, ward: 0, phoenix: 0,
        quests: [], qn: 0,
        stats: {
            blocks: 0, stone: 0, floors: 0, disarmed: 0, monsters: 0, chests: 0, puzzles: 0,
            trapsHit: 0, faints: 0, exhausted: 0, expeditions: 1, strikes: 0, falseAlarms: 0, damage: 0,
            art_tool: 0, art_jewel: 0, art_relic: 0, art_idol: 0,
        },
        said: {},
        deepest: 1,
        ended: false,
        turn: 0,
        events: [],
    };
    G.hp = maxHp(G);
    G.st = maxSt(G);
    say(G, 'intro');
    say(G, 'intro2');
    enterFloor(G, 1);
    fillQuests(G);
    return G;
}

function enterFloor(G, n) {
    G.n = n;
    G.F = genFloor(G.seed, n);
    G.deepest = Math.max(G.deepest, n);
    const F = G.F;
    // Dowsing shows some of the floor's dangers from the start
    const show = rank(G, 'dowse') >= 3 ? 3 : rank(G, 'dowse') >= 2 ? 1 : 0;
    if (show) {
        const list = [];
        F.cells.forEach((c, i) => { if (isDanger(c)) list.push(i); });
        for (let k = 0; k < show && list.length; k++) F.cells[list.splice(Math.floor(G.rng() * list.length), 1)[0]].seen = 1;
    }
    G.events.push({ type: 'floor', n });
    if (F.runeN) say(G, F.hidden && has(G, 'tablet') ? 'runeHidden' : 'rune');
    if (F.door >= 0) say(G, 'door');
    if (F.lens >= 0) say(G, has(G, 'lens') ? 'conduit' : 'noLens');
    if (F.boss) say(G, 'boss');
    settle(G);
}

// ------------------------------------------------------------------ the one entry point
/** Apply one command. Returns true if it did something; a refused command pushes a 'deny' event. */
export function act(G, cmd) {
    if (!cmd || typeof cmd.t !== 'string') return false;
    const r = run(G, cmd);
    if (r !== true) G.events.push({ type: 'deny', why: r || 'no', cmd: cmd.t });
    return r === true;
}

function run(G, cmd) {
    switch (cmd.t) {
        case 'dig': return dig(G, cmd.i);
        case 'mark': return mark(G, cmd.i);
        case 'rot': return rotate(G, cmd.i);
        case 'press': return press(G, cmd.i, cmd.k);
        case 'use': return use(G, cmd.id, cmd.i);
        case 'descend': return descend(G);
        case 'camp': return toCamp(G, 'walk');
        case 'embark': return embark(G);
        case 'buy': return buy(G, cmd.id);
        case 'learn': return learn(G, cmd.id);
        case 'claim': return claim(G, cmd.q);
        case 'continue': return carryOn(G);
        default: return 'unknown';
    }
}

const cellOk = (G, i) => G.mode === 'dig' && Number.isInteger(i) && i >= 0 && i < G.F.cells.length;

function dig(G, i) {
    if (!cellOk(G, i)) return 'mode';
    const F = G.F, c = F.cells[i];
    if (c.k === 'o' && c.o?.t === 'mon') return attack(G, i);
    if (c.k === 'o' && c.o?.t === 'pipe') return rotate(G, i);
    if (c.k === 'o' && c.o?.t === 'chest' && !c.o.open) { G.events.push({ type: 'chestUi', i }); return true; }
    if (c.k === 'o' && c.o?.t === 'stairs' && F.cleared) return descend(G);
    if (c.k !== 'b') return 'empty';
    if (!exposed(F, i)) return 'buried';
    if (c.b === 'panel') { G.events.push({ type: 'sealed', i }); return 'sealed'; }
    if (c.b === 'door') {
        if (G.keys <= 0) { G.events.push({ type: 'locked', i }); return 'locked'; }
        G.keys--;
        spend(G, 1);
        G.events.push({ type: 'unlock', i });
        breakCell(G, i, 'key');
        return endTurn(G);
    }
    if (c.b === 'rune') return runeStrike(G, i);
    return strike(G, i);
}

function mark(G, i) {
    if (!cellOk(G, i)) return 'mode';
    const c = G.F.cells[i];
    if (c.k !== 'b' || c.b === 'rune' || c.b === 'panel' || c.b === 'door') return 'nomark';
    c.m = c.m ? 0 : 1;
    G.events.push({ type: 'mark', i, on: c.m });
    return true;
}

function spend(G, n) {
    G.st = Math.max(0, G.st - n);
    G.stats.strikes++;
}

function luck(G) {
    return G.rng() < rank(G, 'crit') * 0.12;
}

function strike(G, i) {
    const F = G.F, c = F.cells[i];
    spend(G, 1);
    if (c.m) {
        if (c.c?.d === 'trap') {
            const kind = c.c.kind;
            c.c = null;
            c.m = 0;
            G.stats.disarmed++;
            addXp(G, 3);
            addGold(G, 2 + (G.n >> 1), i, 'disarm');
            G.events.push({ type: 'disarm', i, kind });
            say(G, 'disarm');
        } else if (c.c?.d === 'mon') {
            c.amb = 1;       // the monster wakes stunned and takes an ambush blow when the block breaks
        } else {
            c.m = 0;
            G.st = Math.max(0, G.st - FALSE_ALARM);
            G.stats.falseAlarms++;
            G.events.push({ type: 'falseAlarm', i, cost: FALSE_ALARM });
            say(G, 'falseAlarm');
        }
    }
    const crit = luck(G);
    let dmg = blockDamage(G, c.b) * (crit ? 2 : 1) * (G.hyper > 0 ? 3 : 1);
    if (G.hyper > 0) G.hyper--;
    c.hp = Math.max(0, c.hp - dmg);
    G.events.push({ type: 'strike', i, dmg, hp: c.hp, mx: c.mx, b: c.b, crit, hyper: G.hyper > 0 });
    if (c.hp <= 0) {
        breakCell(G, i, 'pick');
        const sh = rank(G, 'shock');
        if (sh) {
            for (const j of neighbours4(F, i)) {
                const n = F.cells[j];
                if (n.k !== 'b' || !ORDINARY(n.b) || G.mode !== 'dig') continue;
                n.hp = Math.max(0, n.hp - sh);
                G.events.push({ type: 'shock', i: j, from: i, hp: n.hp });
                if (n.hp <= 0) breakCell(G, j, 'shock');
            }
        }
    }
    return endTurn(G);
}

/** A block is gone: resolve what was inside it. by: pick | shock | blast | rune | panel | key */
function breakCell(G, i, by) {
    const F = G.F, c = F.cells[i];
    if (c.k !== 'b') return;
    const b = c.b;
    c.k = 'o';
    c.hp = 0;
    G.stats.blocks++;
    if (BLOCKS[b].family === 'stone') G.stats.stone++;
    addXp(G, BLOCKS[b].xp);
    G.events.push({ type: 'break', i, b, by });
    const careful = c.m || by === 'blast';
    const content = c.c;
    c.c = null;
    c.m = 0;
    c.seen = 0;
    if (content?.d === 'trap') {
        if (careful) {
            G.stats.disarmed++;
            addXp(G, 3);
            G.events.push({ type: 'disarm', i, kind: content.kind });
            say(G, 'disarm');
        } else {
            const dmg = trapDamage(content.kind, G.n);
            G.stats.trapsHit++;
            G.events.push({ type: 'trap', i, kind: content.kind, dmg });
            say(G, 'trap');
            const drain = TRAPS[content.kind].stamina;
            if (drain) G.st = Math.max(0, G.st - drain);
            hurt(G, dmg, 'trap', i);
        }
    } else if (content?.d === 'mon') {
        const s = monsterStats(content.id, G.n);
        const m = { t: 'mon', id: content.id, hp: s.hp, mx: s.hp, atk: s.atk, gold: s.gold, stun: 0 };
        c.o = m;
        const ambush = careful || c.amb;
        G.events.push({ type: 'monster', i, id: content.id, ambush: !!ambush });
        say(G, 'monster');
        if (ambush) {
            m.stun = 1;
            const dmg = pickPower(G) * AMBUSH_MULT;
            m.hp = Math.max(0, m.hp - dmg);
            G.events.push({ type: 'ambush', i, dmg, hp: m.hp });
            if (m.hp <= 0) killMonster(G, i);
        }
    } else if (content?.loot) {
        collect(G, content, i);
    }
    c.amb = 0;
    if (c.o?.t === 'chest') say(G, 'chest');
}

function collect(G, L, i) {
    if (L.loot === 'gold') addGold(G, L.n, i, 'gold');
    else if (L.loot === 'gem') { G.gems += L.n; G.events.push({ type: 'loot', i, kind: 'gem', n: L.n }); }
    else if (L.loot === 'food') {
        const n = Math.round(L.n * (1 + 0.5 * rank(G, 'forage')));
        G.st = Math.min(maxSt(G), G.st + n);
        G.events.push({ type: 'loot', i, kind: 'food', n });
    } else if (L.loot === 'key') { G.keys++; G.events.push({ type: 'loot', i, kind: 'key', n: 1 }); }
    else if (L.loot === 'potion') { G.inv.potion = Math.min(9, G.inv.potion + 1); G.events.push({ type: 'loot', i, kind: 'potion', n: 1 }); }
    else if (L.loot === 'art') giveArtifact(G, L.id, i);
    else if (L.loot === 'cache') {
        addGold(G, L.gold, i, 'gold');
        G.gems += L.gems;
        G.events.push({ type: 'loot', i, kind: 'gem', n: L.gems });
    }
}

function addGold(G, n, i, kind = 'gold') {
    const g = Math.max(1, Math.round(n * goldMult(G)));
    G.gold += g;
    G.events.push({ type: 'loot', i, kind, n: g });
    return g;
}

function addXp(G, n) {
    G.xp += n;
    while (G.lv < LEVEL_CAP && G.xp >= xpToNext(G.lv)) {
        G.xp -= xpToNext(G.lv);
        G.lv++;
        G.sp++;
        G.st = Math.min(maxSt(G), G.st + LEVEL_GIFT.stamina);
        G.hp = Math.min(maxHp(G), G.hp + LEVEL_GIFT.hp);
        G.events.push({ type: 'levelup', lv: G.lv });
        say(G, 'levelup');
    }
}

function giveArtifact(G, id, i) {
    if (G.arts[id]) return;
    const a = ART_BY_ID[id];
    const before = maxSt(G);
    G.arts[id] = 1;
    G.artOrder.push(id);
    G.stats['art_' + a.kind]++;
    G.st += maxSt(G) - before;          // a stamina relic fills the new room in the flask too
    G.events.push({ type: 'artifact', i, id });
    say(G, id === 'heart' ? 'heart' : 'artifact');
    addXp(G, 15);
}

// ------------------------------------------------------------------ monsters
function attack(G, i) {
    const c = G.F.cells[i], m = c.o;
    spend(G, 1);
    const crit = luck(G);
    const dmg = pickPower(G) * (crit ? 2 : 1) * (G.hyper > 0 ? 3 : 1);
    if (G.hyper > 0) G.hyper--;
    m.hp = Math.max(0, m.hp - dmg);
    G.events.push({ type: 'mhit', i, dmg, hp: m.hp, mx: m.mx, crit });
    if (m.hp <= 0) killMonster(G, i);
    return endTurn(G);
}

function killMonster(G, i) {
    const c = G.F.cells[i], m = c.o;
    c.o = null;
    G.stats.monsters++;
    addXp(G, Math.ceil(m.mx * 0.8) + (MONSTERS[m.id].boss ? 40 : 0));
    G.events.push({ type: 'mdie', i, id: m.id });
    addGold(G, m.gold * (has(G, 'jackal') ? 2 : 1), i, 'gold');
}

function hurt(G, dmg, src, i = -1) {
    if (G.mode !== 'dig') return;
    if (G.ward > 0) {
        G.ward--;
        G.events.push({ type: 'warded', i, left: G.ward });
        return;
    }
    // never an instant knockout from healthy: a hit taken above a quarter of max HP leaves at least 1
    const top = G.hp > maxHp(G) * SAFE_FLOOR_HP;
    let hp = G.hp - dmg;
    if (top && hp < 1) hp = 1;
    const took = G.hp - hp;
    G.hp = hp;
    G.stats.damage += took;
    G.events.push({ type: 'hurt', dmg: took, hp: G.hp, src, i });
    if (G.hp <= 0) {
        if (has(G, 'feather') && !G.phoenix) {
            G.phoenix = 1;
            G.hp = Math.ceil(maxHp(G) / 2);
            G.events.push({ type: 'revive', hp: G.hp });
            say(G, 'revive', false);
            return;
        }
        const lost = Math.floor(G.gold * FAINT_FEE);
        G.gold -= lost;
        G.stats.faints++;
        G.events.push({ type: 'faint', lost });
        say(G, 'faint', false);
        toCamp(G, 'faint');
    }
}

/** After every stamina-spending action: awake monsters strike, then everything settles. */
function endTurn(G) {
    G.turn++;
    const F = G.F;
    for (let i = 0; i < F.cells.length && G.mode === 'dig'; i++) {
        const m = F.cells[i].o;
        if (m?.t !== 'mon') continue;
        if (m.stun > 0) { m.stun--; continue; }
        const dmg = Math.max(1, m.atk - rank(G, 'armor') - (has(G, 'bangle') ? 1 : 0));
        G.events.push({ type: 'mattack', i, id: m.id, dmg });
        hurt(G, dmg, 'monster', i);
    }
    settle(G);
    if (G.mode === 'dig' && G.st <= 0) {
        G.stats.exhausted++;
        G.events.push({ type: 'exhausted' });
        say(G, 'exhausted', false);
        toCamp(G, 'tired');
    }
    return true;
}

// ------------------------------------------------------------------ puzzles
function runeStrike(G, i) {
    const F = G.F, c = F.cells[i];
    if (c.lit) return 'lit';
    spend(G, 1);
    if (c.r === F.runeNext) {
        c.lit = 1;
        F.runeNext++;
        G.events.push({ type: 'runeLit', i, k: c.r });
        if (F.runeNext > F.runeN) {
            const cells = [];
            F.cells.forEach((q, j) => { if (q.b === 'rune' && q.k === 'b') cells.push(j); });
            G.events.push({ type: 'runeSolved', cells });
            for (const j of cells) breakCell(G, j, 'rune');
            solved(G, 15 + G.n * 2);
        }
    } else if (rank(G, 'glyph') || has(G, 'scepter')) {
        G.events.push({ type: 'runeFizzle', i });
    } else {
        const cells = [];
        F.cells.forEach((q, j) => { if (q.b === 'rune' && q.lit) { q.lit = 0; cells.push(j); } });
        F.runeNext = 1;
        G.events.push({ type: 'runeReset', i, cells });
    }
    return endTurn(G);
}

function solved(G, gold) {
    G.stats.puzzles++;
    addXp(G, 10);
    addGold(G, gold, -1, 'puzzle');
}

function rotate(G, i) {
    if (!cellOk(G, i)) return 'mode';
    const c = G.F.cells[i];
    if (c.k !== 'o' || c.o?.t !== 'pipe') return 'nopipe';
    if (G.F.cells[G.F.panel]?.k === 'o') return 'done';
    c.o.r = (c.o.r + 1) & 3;
    G.events.push({ type: 'rot', i, r: c.o.r });
    settle(G);
    return true;
}

function press(G, i, k) {
    if (!cellOk(G, i) || !Number.isInteger(k) || k < 0 || k > 4) return 'mode';
    const c = G.F.cells[i];
    if (c.k !== 'o' || c.o?.t !== 'chest' || c.o.open) return 'nochest';
    const L = c.o.lock;
    for (const d of [-1, 0, 1]) L[(k + d + 5) % 5] ^= 1;
    G.events.push({ type: 'press', i, k, lock: L.slice() });
    if (L.every(Boolean)) {
        const ch = c.o;
        ch.open = 1;
        G.stats.chests++;
        addXp(G, 5);
        G.events.push({ type: 'chestOpen', i });
        addGold(G, ch.gold * (has(G, 'mask') ? 1.5 : 1), i, 'gold');
        if (ch.gems) { G.gems += ch.gems; G.events.push({ type: 'loot', i, kind: 'gem', n: ch.gems }); }
        if (ch.potion) { G.inv.potion = Math.min(9, G.inv.potion + 1); G.events.push({ type: 'loot', i, kind: 'potion', n: 1 }); }
        if (ch.art) giveArtifact(G, ch.art, i);
    }
    settle(G);
    return true;
}

/** The presses that open a 5-rune ring lock (each press flips a rune and its two neighbours). */
export function solveLock(lock) {
    for (let mask = 0; mask < 32; mask++) {
        const L = lock.slice();
        for (let k = 0; k < 5; k++) if (mask & (1 << k)) for (const d of [-1, 0, 1]) L[(k + d + 5) % 5] ^= 1;
        if (L.every(Boolean)) return [0, 1, 2, 3, 4].filter((k) => mask & (1 << k));
    }
    return null;
}

// ------------------------------------------------------------------ settle: numbers, power, quests, clear
function settle(G) {
    const F = G.F;
    if (G.mode !== 'dig' || !F) return;
    // danger numbers on open tiles
    let anyNumber = false;
    F.cells.forEach((c, i) => {
        if (c.k !== 'o') { c.n = 0; return; }
        let n = 0;
        for (const j of neighbours8(F, i)) if (isDanger(F.cells[j])) n++;
        c.n = n;
        if (n) anyNumber = true;
    });
    if (anyNumber) { say(G, 'numbers'); if (G.n >= 2 || G.stats.trapsHit) say(G, 'mark'); }
    // the sun conduit
    if (F.lens >= 0) {
        const lit = has(G, 'lens') ? power(F) : new Set();
        F.cells.forEach((c, i) => { c.pw = lit.has(i) ? 1 : 0; });
        if (lit.panelLit && F.cells[F.panel].k === 'b') {
            G.events.push({ type: 'panelOpen', i: F.panel, path: [...lit] });
            breakCell(G, F.panel, 'panel');
            solved(G, 18 + G.n * 2);
        }
    }
    // quests
    G.quests.forEach((q, k) => {
        if (!q.told && questDone(G, q)) { q.told = 1; G.events.push({ type: 'questReady', q: k }); say(G, 'quest'); }
    });
    // cleared?
    if (!F.cleared && F.cells.every((c) => c.k !== 'b' && c.o?.t !== 'mon' && !(c.o?.t === 'chest' && !c.o.open))) {
        F.cleared = true;
        G.stats.floors++;
        G.events.push({ type: 'clear', n: G.n });
        say(G, 'clear');
        G.quests.forEach((q, k) => {
            if (!q.told && questDone(G, q)) { q.told = 1; G.events.push({ type: 'questReady', q: k }); }
        });
    }
}

function descend(G) {
    if (G.mode !== 'dig') return 'mode';
    if (!G.F.cleared) return 'notClear';
    G.events.push({ type: 'descend', from: G.n });
    if (G.n === STORY_FLOORS && !G.ended) {
        G.ended = true;
        G.mode = 'ending';
        G.events.push({ type: 'ending' });
        say(G, 'ending', false);
        return true;
    }
    enterFloor(G, G.n + 1);
    return true;
}

function carryOn(G) {
    if (G.mode !== 'ending') return 'mode';
    G.mode = 'dig';
    say(G, 'deeper');
    enterFloor(G, G.n + 1);
    return true;
}

// ------------------------------------------------------------------ camp, shop, items
function toCamp(G, why) {
    if (G.mode !== 'dig') return 'mode';
    G.mode = 'camp';
    G.hp = maxHp(G);
    G.st = maxSt(G);
    G.phoenix = 0;
    G.hyper = 0;
    G.events.push({ type: 'camp', why });
    say(G, 'camp');
    return true;
}

function embark(G) {
    if (G.mode !== 'camp') return 'mode';
    G.mode = 'dig';
    G.stats.expeditions++;
    G.events.push({ type: 'embark', n: G.n });
    settle(G);
    return true;
}

function buy(G, id) {
    if (G.mode !== 'camp') return 'mode';
    const s = SHOP[id];
    if (!s) return 'unknown';
    if (G.inv[id] >= s.max) return 'full';
    if (s.gold && G.gold < s.gold) return 'gold';
    if (s.gems && G.gems < s.gems) return 'gems';
    G.gold -= s.gold || 0;
    G.gems -= s.gems || 0;
    G.inv[id]++;
    G.events.push({ type: 'buy', id });
    say(G, 'buy');
    return true;
}

function use(G, id, i) {
    if (G.mode !== 'dig') return 'mode';
    if (!(G.inv[id] > 0)) return 'none';
    const F = G.F;
    if (id === 'potion') {
        if (G.hp >= maxHp(G)) return 'full';
        G.hp = Math.min(maxHp(G), G.hp + ITEM_FX.potion);
    } else if (id === 'tonic') {
        if (G.st >= maxSt(G)) return 'full';
        G.st = Math.min(maxSt(G), G.st + ITEM_FX.tonic);
    } else if (id === 'hyper') G.hyper += ITEM_FX.hyper;
    else if (id === 'ward') G.ward += ITEM_FX.ward;
    else if (id === 'dowse') {
        let n = 0;
        F.cells.forEach((c) => { if (isDanger(c) && !c.seen) { c.seen = 1; n++; } });
        G.events.push({ type: 'dowsed', n });
    } else if (id === 'blast') {
        if (!Number.isInteger(i) || i < 0 || i >= F.cells.length) return 'target';
        const cells = [i, ...neighbours8(F, i)].filter((j) => F.cells[j].k === 'b' && ORDINARY(F.cells[j].b));
        if (!cells.length) return 'target';
        G.inv[id]--;
        G.events.push({ type: 'use', id, i });
        G.events.push({ type: 'blast', i, cells });
        for (const j of cells) breakCell(G, j, 'blast');
        settle(G);
        return true;
    } else return 'unknown';
    G.inv[id]--;
    G.events.push({ type: 'use', id, i });
    settle(G);
    return true;
}

// ------------------------------------------------------------------ skills
export function canLearn(G, id) {
    const s = SKILL_BY_ID[id];
    if (!s) return 'unknown';
    if (G.sp <= 0) return 'points';
    if (rank(G, id) >= s.max) return 'max';
    for (const [need, r] of Object.entries(s.needs || {})) if (rank(G, need) < r) return 'locked';
    return true;
}

function learn(G, id) {
    const ok = canLearn(G, id);
    if (ok !== true) return ok;
    const hp0 = maxHp(G), st0 = maxSt(G);
    G.skills[id] = rank(G, id) + 1;
    G.sp--;
    G.hp += maxHp(G) - hp0;
    G.st += maxSt(G) - st0;
    G.events.push({ type: 'learn', id, rank: G.skills[id] });
    return true;
}

// ------------------------------------------------------------------ quests
const statOf = (G, q) => (q.kind === 'artifact' ? G.stats['art_' + q.art] : G.stats[QUESTS[q.kind].stat]);
export const questProgress = (G, q) => clamp(statOf(G, q) - q.base, 0, q.need);
export const questDone = (G, q) => statOf(G, q) - q.base >= q.need;

/** Artifact kinds still waiting below (or on) the current floor, so an artifact quest can always be met. */
function kindsAhead(G) {
    const out = new Set();
    for (const a of ARTIFACTS) if (!G.arts[a.id] && a.floor >= G.n) out.add(a.kind);
    return [...out];
}

function fillQuests(G) {
    let guard = 0;
    while (G.quests.length < 3 && guard++ < 20) {
        const active = new Set(G.quests.map((q) => q.kind));
        const kinds = Object.keys(QUESTS).filter((k) => !active.has(k) && QUESTS[k].minFloor <= G.n
            && (k !== 'artifact' || kindsAhead(G).length));
        if (!kinds.length) break;
        const kind = kinds[Math.floor(G.rng() * kinds.length)];
        const Q = QUESTS[kind];
        const tier = G.qn + G.quests.length;
        const need = Math.max(1, Math.round(Q.base + Q.step * Math.min(tier, 30)));
        const q = { kind, need, base: 0, gold: 0, gems: (G.qn + G.quests.length) % 3 === 2 ? 1 : 0, told: 0 };
        if (kind === 'artifact') {
            const ks = kindsAhead(G);
            q.art = ks[Math.floor(G.rng() * ks.length)];
        }
        q.base = statOf(G, q);
        q.gold = Math.round(Q.gold * need * (1 + G.n * 0.08) * 0.6 + 10);
        G.quests.push(q);
    }
}

function claim(G, k) {
    const q = G.quests[k];
    if (!q) return 'none';
    if (!questDone(G, q)) return 'unfinished';
    G.quests.splice(k, 1);
    G.gold += q.gold;
    G.gems += q.gems;
    G.qn++;
    G.events.push({ type: 'claim', q: k, gold: q.gold, gems: q.gems });
    fillQuests(G);
    if (G.mode === 'dig') settle(G);
    return true;
}

// ------------------------------------------------------------------ talk
export function say(G, id, once = true) {
    if (!LINES[id]) return;
    if (once && G.said[id]) return;
    G.said[id] = 1;
    G.events.push({ type: 'say', id, who: LINES[id].who });
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (!G.F || !Array.isArray(G.F.cells)) throw new Error('save has no floor');
    return G;
}
