// The simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the UI, the bot and the tests all go through act().
//
// A campaign (G) walks through phases:  intro → battle → outro → intro … → ending.
// A battle (G.B) is turn-based with a charge-time queue: every unit fills up by its speed and
// the first to reach CT_READY acts. On its turn a unit may move once and act once, in either order.

import { CT_READY, MAX_TURNS, RULES } from '../config.js';
import { makeRng } from '../rng.js';
import { CHAPTERS, CLASSES, PARTY_ORDER, SKILLS, SNACKS } from './data.js';
import {
    affected, aoeTiles, basicOf, buildTiles, calcDamage, healAmount, isFoe, makeUnit, pathTo, reach,
    skillsOf, standable, unitAt, unitById, validTarget,
} from './core.js';
import { aiCommand } from './ai.js';

export const SAVE_VERSION = 1;
const no = (why) => ({ ok: false, why });
const OK = { ok: true };

export function newGame(seed = 1) {
    return {
        v: SAVE_VERSION, seed, rng: makeRng(seed),
        phase: 'intro', chapter: 0,
        roster: ['pip', 'bram'], party: ['pip', 'bram'],
        snack: 'scone', seenPre: false,
        B: null, result: null,
        events: [],               // { type, ... } since the last drain; never saved
    };
}

export const levelOf = (G) => G.chapter + 1;
export const chapterOf = (G) => CHAPTERS[Math.min(G.chapter, CHAPTERS.length - 1)];
export const slotsOf = (G) => chapterOf(G).slots;

/** Skills a unit learns at exactly this level, for the "what's new" lines. */
export function learnedAt(key, lvl) {
    return CLASSES[key].skills.filter((id) => SKILLS[id].lvl === lvl);
}

export function setParty(G, keys) {
    const ok = keys.includes('pip') && keys.length <= slotsOf(G) && keys.every((k) => G.roster.includes(k)) && new Set(keys).size === keys.length;
    if (!ok) return false;
    G.party = PARTY_ORDER.filter((k) => keys.includes(k));
    return true;
}

export function setSnack(G, id) { if (SNACKS[id]) G.snack = id; }

function fitParty(G) {
    const keep = G.party.filter((k) => G.roster.includes(k));
    const fill = G.roster.filter((k) => !keep.includes(k));
    const next = [...keep];
    for (const k of fill) if (next.length < slotsOf(G)) next.push(k);
    G.party = PARTY_ORDER.filter((k) => next.includes(k)).slice(0, slotsOf(G));
    if (!G.party.includes('pip')) G.party[0] = 'pip';
}

// ---------------------------------------------------------------- setting up a battle
export function beginBattle(G) {
    const ch = chapterOf(G);
    const lvl = levelOf(G);
    fitParty(G);
    const tiles = buildTiles(ch.map);
    const B = { w: ch.map[0].length, h: ch.map.length, tiles, units: [], turn: null, turnNo: 0, over: null, talked: {}, rescued: [], chapter: G.chapter, yielded: false };
    let id = 1;
    G.party.forEach((key, i) => {
        const [x, y] = ch.starts[i];
        B.units.push(makeUnit(id++, key, lvl, 'p', x, y));
    });
    for (const [key, x, y, ai] of ch.foes) B.units.push(makeUnit(id++, key, lvl, 'e', x, y, { ai }));
    if (ch.guest) B.units.push(makeUnit(id++, ch.guest.key, lvl, 'g', ch.guest.x, ch.guest.y));
    for (const u of B.units) if (u.team !== 'g') u.ct = G.rng.int(0, 30);
    const snack = SNACKS[G.snack];
    for (const u of B.units) {
        if (u.team !== 'p') continue;
        u.st[snack.status] = snack.dur;
        if (snack.mp) u.mp = Math.min(u.maxmp + snack.mp, u.mp + snack.mp);
    }
    G.B = B;
    G.phase = 'battle';
    G.result = null;
    G.events.push({ type: 'battle', chapter: G.chapter });
    nextTurn(G);
    return B;
}

// ---------------------------------------------------------------- turn order
function pushStatus(G, u, s, on) { G.events.push({ type: 'status', id: u.id, s, on }); }

function applyStatus(G, u, s, dur) {
    const active = G.B.turn && G.B.turn.id === u.id ? 1 : 0;      // the caster's own turn ends straight after
    u.st[s] = Math.max(u.st[s] || 0, dur + active);
    pushStatus(G, u, s, true);
}

function clearStatus(G, u, s) {
    if (!(s in u.st)) return;
    delete u.st[s];
    pushStatus(G, u, s, false);
}

function nextTurn(G) {
    const B = G.B;
    for (;;) {
        if (B.over) return;
        if (B.turnNo >= MAX_TURNS) { endBattle(G, 'lose', 'timeout'); return; }
        const live = B.units.filter((u) => u.alive && u.team !== 'g');
        if (!live.length) return;
        for (let guard = 0; guard < 1000 && !live.some((u) => u.ct >= CT_READY); guard++) for (const u of live) u.ct += u.spd;
        let best = null;
        for (const u of live) if (u.ct >= CT_READY && (!best || u.ct > best.ct)) best = u;
        B.turnNo++;
        best.mp = Math.min(best.maxmp, best.mp + RULES.mpPerTurn);
        if (best.st.regen > 0) {
            const amt = Math.min(best.maxhp - best.hp, RULES.regen + best.lvl);
            if (amt > 0) { best.hp += amt; G.events.push({ type: 'heal', id: best.id, amt, hp: best.hp }); }
        }
        if (best.st.sleepy > 0) {
            G.events.push({ type: 'sleepy', id: best.id });
            clearStatus(G, best, 'sleepy');
            best.ct -= CT_READY;
            continue;
        }
        B.turn = { id: best.id, moved: false, acted: false, from: { x: best.x, y: best.y } };
        G.events.push({ type: 'turn', id: best.id });
        return;
    }
}

/** The next `n` turns, as unit ids, without touching the game. */
export function turnOrder(B, n = 8) {
    const live = B.units.filter((u) => u.alive && u.team !== 'g');
    const ct = new Map(live.map((u) => [u.id, u.ct]));
    const out = [];
    if (B.turn) {
        out.push(B.turn.id);
        ct.set(B.turn.id, ct.get(B.turn.id) - CT_READY);
    }
    while (out.length < n && live.length) {
        for (let g = 0; g < 1000 && ![...ct.values()].some((v) => v >= CT_READY); g++) for (const u of live) ct.set(u.id, ct.get(u.id) + u.spd);
        let best = null;
        for (const u of live) if (ct.get(u.id) >= CT_READY && (!best || ct.get(u.id) > ct.get(best.id))) best = u;
        out.push(best.id);
        ct.set(best.id, ct.get(best.id) - CT_READY);
    }
    return out;
}

function endTurn(G) {
    const B = G.B;
    const u = unitById(B, B.turn.id);
    checkRescue(G);
    if (!B.over) {
        for (const s of Object.keys(u.st)) {
            u.st[s] -= 1;
            if (u.st[s] <= 0) clearStatus(G, u, s);
        }
        u.ct -= CT_READY;
        B.turn = null;
        nextTurn(G);
    }
}

function checkRescue(G) {
    const B = G.B;
    const ch = CHAPTERS[B.chapter];
    for (const g of B.units.filter((o) => o.team === 'g')) {
        const near = B.units.some((o) => o.alive && o.team === 'p' && Math.abs(o.x - g.x) + Math.abs(o.y - g.y) === 1);
        if (near) rescue(G, g, ch);
    }
}

function rescue(G, g, ch, lines = ch.rescue) {
    const B = G.B;
    g.team = 'p';
    g.ct = 40;
    B.rescued.push(g.key);
    G.events.push({ type: 'rescue', id: g.id });
    if (lines) G.events.push({ type: 'talk', lines });
}

function endBattle(G, result, why) {
    const B = G.B;
    if (B.over) return;
    B.over = { result, why };
    B.turn = null;
    if (result === 'win') {
        const fainted = B.units.filter((u) => u.team === 'p' && !u.alive).map((u) => u.key);
        for (const key of B.rescued) if (!G.roster.includes(key)) G.roster.push(key);
        G.roster = PARTY_ORDER.filter((k) => G.roster.includes(k));
        G.result = { turns: B.turnNo, rescued: [...B.rescued], fainted, yielded: B.yielded };
        G.phase = 'outro';
    }
    G.events.push({ type: 'end', result, why });
}

function checkEnd(G) {
    const B = G.B;
    if (B.over) return true;
    if (!B.units.some((u) => u.alive && u.team === 'p')) {
        // a stranded student who is still waiting steps in rather than watching the party get tuckered out
        const g = B.units.find((o) => o.team === 'g' && o.alive);
        if (g) {
            rescue(G, g, CHAPTERS[B.chapter], [[g.key, 'Nobody is left to come for me, so I am coming for you! Hold on!']]);
            return false;
        }
        endBattle(G, 'lose', 'fainted');
        return true;
    }
    if (!B.units.some((u) => u.alive && u.team === 'e')) {
        const ch = CHAPTERS[B.chapter];
        for (const g of B.units.filter((o) => o.team === 'g')) rescue(G, g, ch);    // nobody gets left behind
        endBattle(G, 'win');
        return true;
    }
    return false;
}

// ---------------------------------------------------------------- commands
export function act(G, cmd) {
    const B = G.B;
    if (G.phase !== 'battle' || !B || B.over || !B.turn) return no('no battle in progress');
    const u = unitById(B, B.turn.id);
    const T = B.turn;

    if (cmd.t === 'wait') { endTurn(G); return OK; }

    if (cmd.t === 'undo') {
        if (!T.moved || T.acted) return no('nothing to undo');
        u.x = T.from.x; u.y = T.from.y;
        T.moved = false;
        G.events.push({ type: 'warp', id: u.id, x: u.x, y: u.y });
        return OK;
    }

    if (cmd.t === 'move') {
        if (T.moved) return no('already moved');
        const r = reach(B, u);
        if (!standable(B, u, r).some((n) => n.x === cmd.x && n.y === cmd.y)) return no('cannot get there');
        if (cmd.x === u.x && cmd.y === u.y) return no('already there');
        const path = pathTo(B, r, cmd.x, cmd.y);
        u.x = cmd.x; u.y = cmd.y;
        T.moved = true;
        G.events.push({ type: 'move', id: u.id, path });
        if (T.acted) endTurn(G);
        return OK;
    }

    if (cmd.t === 'attack' || cmd.t === 'skill') {
        const id = cmd.t === 'attack' ? basicOf(u) : cmd.id;
        if (!skillsOf(u).includes(id)) return no('does not know that skill');
        const sk = SKILLS[id];
        if (T.acted) return no('already acted');
        if (u.mp < sk.cost) return no('not enough MP');
        if (!validTarget(B, u, sk, cmd.x, cmd.y)) return no('no valid target there');
        resolve(G, u, id, sk, cmd.x, cmd.y);
        T.acted = true;
        if (!checkEnd(G) && T.moved) endTurn(G);
        return OK;
    }
    return no('unknown command');
}

function resolve(G, u, id, sk, tx, ty) {
    const B = G.B;
    u.mp -= sk.cost;
    const targets = affected(B, u, sk, tx, ty);
    G.events.push({ type: 'skill', id: u.id, skill: id, x: tx, y: ty, tiles: aoeTiles(B, sk, tx, ty), targets: targets.map((t) => t.id) });

    if (sk.kind === 'phys' || sk.kind === 'mag') {
        const pipSwing = u.key === 'pip' && id === 'scepter';
        for (const d of targets) {
            for (let h = 0; h < (sk.hits || 1) && d.alive; h++) {
                let dmg = calcDamage(B, u, d, sk);
                if (pipSwing) {
                    const oops = Math.max(0.04, 0.22 - 0.03 * (u.lvl - 1));
                    if (G.rng() < oops) {
                        if (G.rng() < 0.5) {
                            G.events.push({ type: 'oops', id: u.id });
                            applyStatus(G, u, 'guard', 2);
                            dmg = 0;
                        } else {
                            G.events.push({ type: 'lucky', id: u.id });
                            dmg *= 2;
                        }
                    }
                }
                if (dmg > 0) {
                    d.hp = Math.max(0, d.hp - dmg);
                    clearStatus(G, d, 'sleepy');
                    d.awake = true;
                    G.events.push({ type: 'hit', id: d.id, from: u.id, dmg, hp: d.hp, skill: id });
                    if (d.hp === 0) { d.alive = false; G.events.push({ type: 'faint', id: d.id }); }
                }
            }
        }
        bossBeats(G);
    } else if (sk.kind === 'heal') {
        for (const d of targets) {
            const amt = Math.min(d.maxhp - d.hp, healAmount(u, sk));
            d.hp += amt;
            G.events.push({ type: 'heal', id: d.id, amt, hp: d.hp });
            if (sk.status) applyStatus(G, d, sk.status, sk.dur);
        }
    } else if (sk.kind === 'buff') {
        for (const d of targets) applyStatus(G, d, sk.status, sk.dur);
    } else if (sk.kind === 'status') {
        for (const d of targets) {
            if (d.boss) G.events.push({ type: 'resist', id: d.id });
            else applyStatus(G, d, sk.status, sk.dur);
        }
    }
}

// The Dread Lord talks mid-fight and, at 35% hp, gives up.
function bossBeats(G) {
    const B = G.B;
    const ch = CHAPTERS[B.chapter];
    const boss = B.units.find((o) => o.boss);
    if (!boss || !boss.alive || B.over) return;
    if (!B.talked.hp70 && ch.midTalk && boss.hp <= boss.maxhp * 0.7) {
        B.talked.hp70 = true;
        G.events.push({ type: 'talk', lines: ch.midTalk[0].lines });
    }
    if (ch.yield && boss.hp <= boss.maxhp * RULES.yieldAt) {
        B.yielded = true;
        G.events.push({ type: 'talk', lines: ch.yield });
        endBattle(G, 'win', 'yield');
    }
}

/**
 * Pace the AI: if the unit whose turn it is belongs to the enemy (or to the bot, with `auto`),
 * play one command. `hold` is true while the view is still showing the last one.
 */
export function step(G, inp = {}) {
    const B = G.B;
    if (G.phase !== 'battle' || !B || B.over || !B.turn || inp.hold) return false;
    const u = unitById(B, B.turn.id);
    if (u.team === 'p' && !inp.auto) return false;
    const cmd = inp.cmd || aiCommand(G, u);
    const r = act(G, cmd);
    if (!r.ok) act(G, { t: 'wait' });          // a command the AI cannot issue never stalls the game
    return true;
}

// ---------------------------------------------------------------- between battles
export function finishChapter(G) {
    G.chapter++;
    G.B = null;
    G.result = null;
    G.seenPre = false;
    if (G.chapter >= CHAPTERS.length) { G.phase = 'ending'; G.chapter = CHAPTERS.length - 1; return; }
    G.phase = 'intro';
    fitParty(G);
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { unitAt };
