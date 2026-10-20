// The museum: currencies, the story's tasks, staff, the collection, the till, and the dig in
// progress. Pure: no DOM, no rendering library, no Math.random, no clock.
//
// Everything the player does is an action function (startDig, digSwap, doTask, ...) that checks
// it is allowed, changes G and pushes events. step(G, inp, dt) only moves the museum's clock:
// the till fills while the doors are open.

import { COINS, TILL, APPEAL, BOOSTER_MOVES } from '../config.js';
import { makeRng } from '../rng.js';
import * as Bd from './board.js';
import { levelSpec, starsFor, STORY_LEVELS, PER_CHAPTER } from './levels.js';
import { ITEMS, ITEM, DINOS, BONE_PARTS, TASKS, TASK, HALLS, DECOR, STAFF, rewardFor } from './data.js';

export function newGame(seed = 1, name = 'Rowan') {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        name: cleanName(name),
        t: 0,
        stars: 0,
        coins: 100,
        level: 0,                 // highest level cleared
        best: {},                 // level -> best stars
        bestScore: {},
        items: [],                // ids of finds owned, in the order found
        tasks: [],                // ids of tasks done
        staff: [],
        decor: [],
        boosters: { hammer: 1, shuffle: 1 },
        till: 0,
        seenTips: {},
        introDone: false,
        finished: false,
        stats: { played: 0, wins: 0, losses: 0, bestChain: 0, fossils: 0, relics: 0, specials: 0, coinsEarned: 0 },
        dig: null,
        events: [],               // { type, ... } since the last drain; never saved
    };
    return G;
}

export function cleanName(s) {
    const t = String(s || '').replace(/[^\p{L}\p{N} '\-.]/gu, '').trim().slice(0, 16);
    return t || 'Rowan';
}

// ------------------------------------------------------------------ derived state
export const done = (G, id) => G.tasks.includes(id);
export const owns = (G, id) => G.items.includes(id);
/** Chapters whose last task is done. The chapter after them is the one being worked on. */
export function chaptersDone(G) { return TASKS.filter((t) => t.end && done(G, t.id)).length; }
export function currentChapter(G) { return Math.min(4, chaptersDone(G)); }
export function hallOpen(G, hall) { const t = TASKS.find((x) => x.opens === hall); return !!t && done(G, t.id); }
export function dinoBones(G, dino) { return BONE_PARTS.filter((p) => owns(G, `${dino}-${p}`)); }
export function dinoComplete(G, dino) { return dinoBones(G, dino).length === BONE_PARTS.length; }
export function dinoBuilt(G, dino) { return done(G, `build-${dino}`); }
export const hasStaff = (G, s) => G.staff.includes(s);

/** The highest level that may be played now. */
export function maxLevel(G) {
    if (G.finished) return G.level + 1;
    return Math.min(G.level + 1, (currentChapter(G) + 1) * PER_CHAPTER, STORY_LEVELS);
}
/** The level the big Dig button plays: the next new one, or null when the chapter's tasks block it. */
export function nextLevel(G) {
    const n = G.level + 1;
    return n <= maxLevel(G) ? n : null;
}

/** Tasks shown in the task list: the next three of this chapter that are not done. */
export function openTasks(G) {
    const ch = currentChapter(G);
    if (G.finished) return [];
    return TASKS.filter((t) => t.ch === ch && !done(G, t.id)).slice(0, 3);
}
/** Why a task can't be done yet, or null. */
export function taskBlock(G, id) {
    const t = TASK[id];
    if (!t || done(G, id)) return 'done';
    if (!openTasks(G).some((x) => x.id === id)) return 'not yet';
    if (t.end && TASKS.some((x) => x.ch === t.ch && !x.end && !done(G, x.id))) return 'Finish the other tasks first';
    if (t.end && G.level < (t.ch + 1) * PER_CHAPTER) return `Clear all ${PER_CHAPTER} digs of this chapter first`;
    if (t.needs && !dinoComplete(G, t.needs)) {
        const d = DINOS.find((x) => x.id === t.needs);
        return `Needs every ${d.name} bone (${dinoBones(G, t.needs).length}/${BONE_PARTS.length})`;
    }
    if (G.stars < t.cost) return `Needs ${t.cost} ★`;
    return null;
}

/** Finds on show: owned, and their hall open. */
export function displayed(G) { return G.items.filter((id) => hallOpen(G, ITEM[id].hall)); }

export function appeal(G) {
    let a = 0;
    for (const id of displayed(G)) if (ITEM[id].kind !== 'bone') a += APPEAL.perItem * (hasStaff(G, 'rosa') ? 2 : 1);
    for (const d of DINOS) if (dinoBuilt(G, d.id)) a += APPEAL.perDino;
    for (const h of HALLS) if (done(G, `open-${h.id}`) || (h.id === 'great' && done(G, 'grand'))) a += APPEAL.perHall;
    if (hasStaff(G, 'moss')) a += 5;
    for (const id of G.decor) a += DECOR.find((d) => d.id === id).appeal;
    if (hasStaff(G, 'kit')) a = Math.round(a * 1.5);
    return a;
}
/** The museum takes money once the ticket booth is fixed. */
export const museumOpen = (G) => done(G, 'booth');
export function coinRate(G) { return museumOpen(G) ? appeal(G) * APPEAL.coinsPerMinute * (hasStaff(G, 'penny') ? 1.25 : 1) : 0; }
export function tillCap(G) { return hasStaff(G, 'ledger') ? TILL.capLedger : TILL.cap; }

// ------------------------------------------------------------------ time
/** Advance the museum clock. inp is unused (the museum has no real-time input). */
export function step(G, inp, dt) {
    G.t += dt;
    const cap = tillCap(G);
    if (G.till < cap) G.till = Math.min(cap, G.till + (coinRate(G) / 60) * dt);
}

/** Time away from the game (from a save's timestamp), capped. */
export function away(G, seconds) {
    const s = Math.max(0, Math.min(seconds, TILL.awayCapHours * 3600));
    const before = G.till;
    step(G, null, s);
    if (G.till - before >= 1) G.events.push({ type: 'away', seconds: s, coins: Math.floor(G.till - before) });
}

// ------------------------------------------------------------------ the museum's actions
export function finishIntro(G) {
    if (G.introDone) return false;
    G.introDone = true;
    G.events.push({ type: 'intro' });
    return true;
}

export function collectTill(G) {
    const n = Math.floor(G.till);
    if (n < 1) return false;
    G.till -= n;
    G.coins += n;
    G.stats.coinsEarned += n;
    G.events.push({ type: 'till', coins: n });
    return true;
}

const STAFF_GIFT = { moss: { hammer: 2 }, penny: { shuffle: 2 }, ledger: { coins: 150 }, kit: { hammer: 3 }, rosa: { shuffle: 2, hammer: 2 } };

export function doTask(G, id) {
    if (taskBlock(G, id)) return false;
    const t = TASK[id];
    G.stars -= t.cost;
    G.tasks.push(id);
    G.events.push({ type: 'task', id, ch: t.ch, scene: id });
    if (t.staff && !G.staff.includes(t.staff)) {
        G.staff.push(t.staff);
        const gift = STAFF_GIFT[t.staff];
        if (gift.coins) G.coins += gift.coins;
        for (const k of ['hammer', 'shuffle']) if (gift[k]) G.boosters[k] += gift[k];
        G.events.push({ type: 'staff', id: t.staff, gift });
    }
    if (t.opens) G.events.push({ type: 'hall', id: t.opens });
    if (t.end) G.events.push({ type: 'chapter', ch: t.ch });
    if (t.finale) { G.finished = true; G.events.push({ type: 'finale' }); }
    return true;
}

export function buyDecor(G, id) {
    const d = DECOR.find((x) => x.id === id);
    if (!d || G.decor.includes(id) || G.coins < d.cost || !done(G, 'open-entrance')) return false;
    G.coins -= d.cost;
    G.decor.push(id);
    G.events.push({ type: 'decor', id });
    return true;
}

export function buyBooster(G, kind) {
    const cost = COINS.booster[kind];
    if (!cost || G.coins < cost) return false;
    G.coins -= cost;
    G.boosters[kind]++;
    G.events.push({ type: 'booster', kind, n: G.boosters[kind] });
    return true;
}

export function seeTip(G, n) { G.seenTips[n] = true; }

// ------------------------------------------------------------------ digs
export function startDig(G, n) {
    if (G.dig || n < 1 || n > maxLevel(G)) return false;
    const spec = levelSpec(n);
    const seed = Math.floor(G.rng() * 0x7fffffff) + 1;
    G.dig = { n, seed, B: Bd.makeBoard(spec, seed), result: null, extra: 0 };
    G.stats.played++;
    G.events.push({ type: 'digstart', n, replay: n <= G.level });
    return true;
}

/** Hand the board's script of this move to the view, then settle the result. */
function afterBoard(G) {
    const D = G.dig;
    const B = D.B;
    if (B.ev.length) G.events.push({ type: 'board', list: B.ev.splice(0) });
    G.stats.bestChain = Math.max(G.stats.bestChain, B.chainBest);
    if (B.state === 'won' && !D.result) finishWin(G);
    else if (B.state === 'lost' && !D.result) {
        D.result = { won: false };
        G.events.push({ type: 'diglost', n: D.n, goals: B.goals.map((g) => ({ ...g })) });
    }
}

export function digSwap(G, r1, c1, r2, c2) {
    const D = G.dig;
    if (!D || D.result) return false;
    const ok = Bd.trySwap(D.B, r1, c1, r2, c2);
    afterBoard(G);
    return ok;
}

export function digHammer(G, r, c) {
    const D = G.dig;
    if (!D || D.result || G.boosters.hammer <= 0) return false;
    if (!Bd.useHammer(D.B, r, c)) { afterBoard(G); return false; }
    G.boosters.hammer--;
    afterBoard(G);
    return true;
}

export function digShuffle(G) {
    const D = G.dig;
    if (!D || D.result || G.boosters.shuffle <= 0 || D.B.state !== 'play') return false;
    G.boosters.shuffle--;
    Bd.shuffle(D.B, false);
    afterBoard(G);
    return true;
}

/** Out of moves: pay for five more and carry on. */
export function buyMoves(G) {
    const D = G.dig;
    const cost = COINS.extraMoves * (1 + (D?.extra || 0));
    if (!D || !D.result || D.result.won || G.coins < cost) return false;
    G.coins -= cost;
    D.extra++;
    D.result = null;
    Bd.addMoves(D.B, BOOSTER_MOVES);
    G.events.push({ type: 'moremoves', cost });
    afterBoard(G);
    return true;
}
export const extraMovesCost = (G) => COINS.extraMoves * (1 + (G.dig?.extra || 0));

function finishWin(G) {
    const D = G.dig, B = D.B;
    const spec = levelSpec(D.n);
    const stars = starsFor(spec, B.score);
    const first = D.n > G.level;
    const prev = G.best[D.n] || 0;
    let gained = first ? stars : Math.max(1, stars - prev);
    if (D.n > STORY_LEVELS) gained = 1;
    const coins = COINS.perStar * stars + (first ? COINS.firstClear : 0);
    G.stars += gained;
    G.coins += coins;
    G.stats.coinsEarned += coins;
    G.best[D.n] = Math.max(prev, stars);
    G.bestScore[D.n] = Math.max(G.bestScore[D.n] || 0, B.score);
    G.stats.wins++;
    G.stats.specials += B.specialsMade;
    for (const g of B.goals) { if (g.kind === 'fossil') G.stats.fossils += g.got; if (g.kind === 'relic') G.stats.relics += g.got; }
    let item = null;
    if (first) {
        G.level = D.n;
        const r = rewardFor(D.n);
        if (r && !owns(G, r)) { G.items.push(r); item = r; }
    }
    D.result = { won: true, stars, gained, coins, item, score: B.score, first };
    G.events.push({ type: 'digwon', n: D.n, ...D.result });
    if (item && ITEM[item].kind === 'bone' && dinoComplete(G, ITEM[item].dino)) G.events.push({ type: 'dinoready', dino: ITEM[item].dino });
}

export function leaveDig(G) {
    const D = G.dig;
    if (!D) return false;
    if (!D.result || !D.result.won) G.stats.losses++;
    G.dig = null;
    G.events.push({ type: 'leftdig', n: D.n, won: !!D.result?.won });
    return true;
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (G.dig && G.dig.B) G.dig.B.ev = [];
    return G;
}

export { ITEMS };
