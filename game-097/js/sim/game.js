// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive act()/step() directly.
//
// G.meta   everything that outlives a battle: shards, the roster, the party, chapters cleared, pity.
// G.battle the fight in progress (or just finished), or null at the sanctum.
//
// The game is turn-based, so input is a command, not a stick: act(G, cmd).
//   { t: 'move', id, to }        move a piece, or take whatever stands on `to`
//   { t: 'ability', id, to }     use its special ability on a square
//   { t: 'wait', id }            end that piece's action without moving
//   { t: 'end' }                 end the player phase
//   { t: 'start', ch }  { t: 'leave', retreat }  { t: 'party', rids }  { t: 'summon', n }

import { AI_DELAY, BOND, GACHA, MAX_TURNS, PARTY_MAX, START } from '../config.js';
import { makeRng } from '../rng.js';
import { CHAPTERS, STAR_POOL, expectedGains, power } from './data.js';
import { genMoves, unitAt } from './moves.js';
import { fight } from './battle.js';
import { applyAbility, canTarget } from './abilities.js';
import { bestForUnit } from './ai.js';
import { gainXp, killUnit, makeUnit, rec, xpFor } from './core.js';

// ---------------------------------------------------------------- new game and saves
function makeRec(rid, key, lv = 1) {
    return { rid, key, lv, xp: 0, gains: expectedGains(key, lv), bond: 0 };
}

export function newGame(seed = 1) {
    const roster = START.party.map((k, i) => makeRec(i + 1, k));
    return {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        meta: {
            shards: START.shards,
            roster,
            party: roster.map((r) => r.rid),
            cleared: {},
            pulls: 0,
            pity: { p5: 0, p4: 0 },
            nextRid: roster.length + 1,
        },
        battle: null,
        events: [],                 // { type, ... } since the last drain; never saved
    };
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !d.meta || !Array.isArray(d.meta.roster)) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

// ---------------------------------------------------------------- the roster
export const unlocked = (G, ci) => ci === 0 || !!G.meta.cleared[CHAPTERS[ci - 1].id];
export const nextChapter = (G) => { const i = CHAPTERS.findIndex((c) => !G.meta.cleared[c.id]); return i < 0 ? CHAPTERS.length - 1 : i; };

function newcomerLevel(G) {
    const top = G.meta.roster.map((r) => r.lv).sort((a, b) => b - a).slice(0, 4);
    return Math.max(1, Math.round(top.reduce((a, b) => a + b, 0) / top.length) - 1);
}

/** Add a unit to the roster, or if the player has it already, a Bond level (and shards at the cap). */
export function recruit(G, key) {
    const m = G.meta;
    const have = m.roster.find((r) => r.key === key);
    if (!have) {
        const r = makeRec(m.nextRid++, key, newcomerLevel(G));
        m.roster.push(r);
        if (m.party.length < PARTY_MAX) m.party.push(r.rid);
        return { key, isNew: true, bond: 0 };
    }
    if (have.bond < BOND.max) { have.bond++; return { key, isNew: false, bond: have.bond }; }
    m.shards += BOND.refund;
    return { key, isNew: false, bond: have.bond, refund: BOND.refund };
}

export function autoParty(G) {
    const ranked = G.meta.roster.slice().sort((a, b) => power(b) - power(a)).slice(0, PARTY_MAX);
    G.meta.party = ranked.map((r) => r.rid);
}

// ---------------------------------------------------------------- summoning
function rollRarity(G) {
    const p = G.meta.pity;
    if (p.p5 + 1 >= GACHA.pity5) return 5;
    const r = G.rng();
    let star = r < GACHA.rates[5] ? 5 : r < GACHA.rates[5] + GACHA.rates[4] ? 4 : 3;
    if (star === 3 && p.p4 + 1 >= GACHA.pity4) star = 4;
    return star;
}

export function summon(G, n) {
    const m = G.meta;
    const cost = n === 10 ? GACHA.ten : GACHA.single * n;
    if (m.shards < cost) return null;
    m.shards -= cost;
    const pulls = [];
    for (let i = 0; i < n; i++) {
        const star = rollRarity(G);
        m.pulls++;
        m.pity.p5 = star === 5 ? 0 : m.pity.p5 + 1;
        m.pity.p4 = star >= 4 ? 0 : m.pity.p4 + 1;
        const pool = STAR_POOL[star];
        const key = pool[Math.floor(G.rng() * pool.length)];
        pulls.push({ star, ...recruit(G, key) });
    }
    G.events.push({ type: 'summon', pulls, cost });
    return pulls;
}

// ---------------------------------------------------------------- starting a battle
/** The opening position of a chapter, without starting it: the title and the sanctum show it. */
export function buildBattle(G, ci) {
    const ch = CHAPTERS[ci];
    const B = {
        ch: ci, w: ch.map[0].length, h: ch.map.length, tiles: ch.map.slice(),
        units: [], nextId: 1, turn: 1, phase: 'p', over: null,
        aiQueue: [], aiClock: 0,
        recruitKey: null,
        stats: { kills: 0, losses: 0, levelups: [] },
    };
    const party = G.meta.party.slice(0, ch.slots);
    party.forEach((rid, i) => { const r = rec(G, rid); const [x, y] = ch.player[i]; B.units.push(makeUnit(B, r.key, 'p', x, y, { record: r })); });
    for (const e of ch.enemies) {
        B.units.push(makeUnit(B, e.u, 'e', e.x, e.y, { lv: e.lv, boss: !!e.boss, recruit: !!e.recruit }));
        if (e.recruit) B.recruitKey = e.u;
    }
    return B;
}

export function startBattle(G, ci) {
    const B = G.battle = buildBattle(G, ci);
    G.events.push({ type: 'phase', phase: 'p', turn: 1, start: true });
    return B;
}

// ---------------------------------------------------------------- phases
function startPhase(G, team) {
    const B = G.battle;
    B.phase = team;
    for (const u of B.units) {
        if (u.team !== team) continue;
        u.acted = false;
        if (u.cd > 0) u.cd--;
        u.mods = u.mods.filter((m) => --m.turns > 0);
    }
    if (team === 'p') B.turn++;
    G.events.push({ type: 'phase', phase: team, turn: B.turn });
    if (team === 'e') {
        const dist = (u) => Math.min(99, ...B.units.filter((o) => o.team === 'p').map((o) => Math.abs(o.x - u.x) + Math.abs(o.y - u.y)));
        B.aiQueue = B.units.filter((u) => u.team === 'e').sort((a, b) => dist(a) - dist(b) || a.id - b.id).map((u) => u.id);
        B.aiClock = 0;
    } else if (B.turn > MAX_TURNS) {
        lose(G, 'The night outlasts you.');
    }
}

function endPlayerPhase(G) {
    if (G.battle.over) return;
    startPhase(G, 'e');
}

function aiAct(G) {
    const B = G.battle;
    while (B.aiQueue.length) {
        const id = B.aiQueue.shift();
        const u = B.units.find((o) => o.id === id);
        if (!u || u.acted) continue;
        const best = bestForUnit(G, u);
        perform(G, u, best.cmd);
        return;
    }
    startPhase(G, 'p');
}

// ---------------------------------------------------------------- doing things
function checkEnd(G) {
    const B = G.battle;
    if (B.over) return;
    const ch = CHAPTERS[B.ch];
    const foes = B.units.filter((u) => u.team === 'e');
    const won = ch.victory === 'boss' ? !foes.some((u) => u.boss) : foes.length === 0;
    if (won) win(G);
    else if (!B.units.some((u) => u.team === 'p')) lose(G, 'Your party has fallen.');
}

function win(G) {
    const B = G.battle, m = G.meta, ch = CHAPTERS[B.ch];
    const first = !m.cleared[ch.id];
    m.cleared[ch.id] = true;
    const shards = Math.round(ch.reward.shards * (first ? 1 : 0.4));
    m.shards += shards;
    const rewards = { shards, first, recruit: null };
    if (B.recruitKey) rewards.recruit = recruit(G, B.recruitKey);
    B.over = 'win';
    B.rewards = rewards;
    G.events.push({ type: 'win', rewards, stats: B.stats });
}

function lose(G, why) {
    const B = G.battle;
    if (B.over) return;
    B.over = 'lose';
    G.events.push({ type: 'lose', why, stats: B.stats });
}

/** Carry out one action for a piece (the player's or the AI's). */
function perform(G, u, cmd) {
    const B = G.battle;
    if (cmd.t === 'move') {
        const m = genMoves(B, u).find((o) => o.to[0] === cmd.to[0] && o.to[1] === cmd.to[1]);
        if (m.kind === 'move') {
            G.events.push({ type: 'move', id: u.id, from: [u.x, u.y], to: m.to, how: m.how });
            u.x = m.to[0]; u.y = m.to[1];
        } else {
            const d = unitAt(B, m.to[0], m.to[1]);
            const ev = fight(G, u, d, m.stop);
            const aDead = u.hp <= 0, dDead = d.hp <= 0;
            ev.kill = dDead ? 'd' : aDead ? 'a' : null;
            ev.end = dDead ? m.to.slice() : aDead ? null : m.stop.slice();
            G.events.push(ev);
            if (dDead) killUnit(G, d);
            if (aDead) killUnit(G, u);
            if (dDead && !aDead) { u.x = m.to[0]; u.y = m.to[1]; } else if (!aDead) { u.x = m.stop[0]; u.y = m.stop[1]; }
            if (!aDead) gainXp(G, u, xpFor(u, d, dDead));
            if (!dDead) gainXp(G, d, xpFor(d, u, aDead));
        }
    } else if (cmd.t === 'ability') {
        applyAbility(G, u, cmd.to[0], cmd.to[1]);
    }
    u.acted = true;
    checkEnd(G);
}

/** Validate and run a command. Returns { ok } or { ok: false, err }. */
export function act(G, cmd) {
    const no = (err) => ({ ok: false, err });
    const m = G.meta;
    switch (cmd?.t) {
        case 'party': {
            const rids = cmd.rids;
            if (!Array.isArray(rids) || !rids.length || rids.length > PARTY_MAX) return no('party size');
            if (new Set(rids).size !== rids.length || rids.some((r) => !rec(G, r))) return no('party members');
            m.party = rids.slice();
            return { ok: true };
        }
        case 'summon': {
            if (G.battle) return no('in battle');
            if (cmd.n !== 1 && cmd.n !== 10) return no('count');
            const pulls = summon(G, cmd.n);
            return pulls ? { ok: true, pulls } : no('shards');
        }
        case 'start':
            if (G.battle) return no('in battle');
            if (!CHAPTERS[cmd.ch] || !unlocked(G, cmd.ch)) return no('locked');
            if (!m.party.length) return no('empty party');
            startBattle(G, cmd.ch);
            return { ok: true };
        case 'leave':
            if (!G.battle) return no('no battle');
            if (!G.battle.over && !cmd.retreat) return no('battle not over');
            G.battle = null;
            return { ok: true };
    }
    const B = G.battle;
    if (!B || B.over || B.phase !== 'p') return no('not your phase');
    if (cmd.t === 'end') { endPlayerPhase(G); return { ok: true }; }
    const u = B.units.find((o) => o.id === cmd.id);
    if (!u || u.team !== 'p' || u.acted) return no('unit');
    if (cmd.t === 'wait') u.acted = true;
    else if (cmd.t === 'move') {
        if (!cmd.to || !genMoves(B, u).some((o) => o.to[0] === cmd.to[0] && o.to[1] === cmd.to[1])) return no('illegal move');
        perform(G, u, cmd);
    } else if (cmd.t === 'ability') {
        if (!cmd.to || !canTarget(B, u, cmd.to[0], cmd.to[1])) return no('illegal target');
        perform(G, u, cmd);
    } else return no('unknown command');
    // nobody left to move: the phase ends by itself
    if (!B.over && B.phase === 'p' && B.units.every((o) => o.team !== 'p' || o.acted)) endPlayerPhase(G);
    return { ok: true };
}

/** Advance the clock. inp = { cmd, hold }: a command to run, and `hold` while the view is still
 *  playing the last action (the enemy waits its turn). */
export function step(G, inp, dt) {
    G.t += dt;
    const B = G.battle;
    if (!B || B.over) { if (inp?.cmd) act(G, inp.cmd); return; }
    if (inp?.cmd) act(G, inp.cmd);
    if (B.over || B.phase !== 'e' || inp?.hold) return;
    B.aiClock += dt;
    if (B.aiClock >= AI_DELAY) { B.aiClock = 0; aiAct(G); }
}

/** For tests and the bot: play out the whole enemy phase at once. */
export function runEnemyPhase(G) {
    const B = G.battle;
    let guard = 64;
    while (B && !B.over && B.phase === 'e' && guard--) aiAct(G);
}
