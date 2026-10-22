// The run. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() and act() directly.
//
// A run is three sectors of COURSE stops (fight, fight, Waystation, fight, boss). Each won fight
// offers a symbol to add to every reel and a point to spend climbing the Constellation.

import { PLAYER, REST_HEAL } from '../config.js';
import { makeRng } from '../rng.js';
import { SYMBOLS, STARTER_STRIP, REWARD_POOL, SECTORS, COURSE, NODES } from './data.js';
import { makeTree, available, nodeById } from './tree.js';
import { startBattle, battleAct, battleWon, canBattle, emit } from './battle.js';

export function newGame(seed = 1) {
    const rng = makeRng(seed);
    const G = {
        v: 1,                       // save format version
        seed,
        rng,
        t: 0,
        phase: 'battle',            // battle | reward | tree | way | won | lost
        over: false,
        sector: 0,
        stop: 0,
        points: 0,
        p: {
            hp: PLAYER.hp, maxHp: PLAYER.hp,
            reels: [],
            etch: {},
            perks: {},
        },
        tree: null,
        reward: null,
        b: null,
        stats: { dmg: 0, fights: 0, jackpots: 0, best: 0, taken: 0 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    for (let r = 0; r < PLAYER.reels; r++) G.p.reels.push(shuffle(rng, STARTER_STRIP.slice()));
    G.tree = makeTree(rng);
    enterStop(G);
    return G;
}

function shuffle(rng, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

export const stopKind = (G) => COURSE[G.stop];

function enterStop(G) {
    const S = SECTORS[G.sector];
    const kind = stopKind(G);
    if (kind === 'way') {
        G.phase = 'way';
        G.b = null;
        emit(G, { type: 'way' });
    } else if (kind === 'boss') {
        startBattle(G, S.boss, true);
    } else {
        startBattle(G, G.rng.pick(G.stop === 0 ? S.early : S.mid));
    }
}

function advance(G) {
    G.stop++;
    if (G.stop >= COURSE.length) {
        G.stop = 0;
        G.sector++;
        emit(G, { type: 'sector', sector: G.sector });
    }
    enterStop(G);
}

function rewardChoices(G) {
    const out = [];
    const pool = { ...REWARD_POOL };
    while (out.length < 3) {
        const keys = Object.keys(pool);
        const total = keys.reduce((s, k) => s + pool[k], 0);
        let x = G.rng() * total;
        let pick = keys[keys.length - 1];
        for (const k of keys) { x -= pool[k]; if (x < 0) { pick = k; break; } }
        out.push(pick);
        delete pool[pick];
    }
    return out;
}

function onWin(G) {
    const p = G.p, boss = G.b.boss;
    G.stats.fights++;
    if (p.perks.salvage) p.hp = Math.min(p.maxHp, p.hp + p.perks.salvage);
    if (boss) p.hp = p.maxHp;
    G.points++;
    emit(G, { type: 'win', boss });
    if (boss && G.sector === SECTORS.length - 1) {
        G.phase = 'won';
        G.over = true;
        emit(G, { type: 'over', won: true });
        return;
    }
    G.phase = 'reward';
    G.reward = { choices: rewardChoices(G) };
    emit(G, { type: 'reward' });
}

function onLose(G) {
    G.phase = 'lost';
    G.over = true;
    emit(G, { type: 'over', won: false });
}

function toTree(G) {
    G.reward = null;
    if (G.points > 0 && available(G.tree).length) {
        G.phase = 'tree';
        emit(G, { type: 'tree' });
    } else advance(G);
}

/** Add a symbol at a random place on every reel. */
function addEverywhere(G, sym) {
    for (const strip of G.p.reels) strip.splice(G.rng.int(0, strip.length), 0, sym);
}

function applyNode(G, kind) {
    const p = G.p, P = p.perks;
    if (kind === 'hull' || (kind === 'reel' && p.reels.length >= PLAYER.maxReels)) { p.maxHp += 8; p.hp += 8; }
    else if (kind === 'reel') p.reels.push(shuffle(G.rng, p.reels[0].slice()));
    else if (kind.startsWith('etch_')) { const s = kind.slice(5); p.etch[s] = (p.etch[s] || 0) + 1; }
    else if (kind === 'wild') addEverywhere(G, 'wild');
    else if (kind === 'plating' || kind === 'sharp' || kind === 'capacitor') P[kind] = (P[kind] || 0) + 1;
    else if (kind === 'salvage') P.salvage = (P.salvage || 0) + 5;
    else P[kind] = true;      // leech, spark, jackpot, twin, filter, aegis, supernova
}

/** Can action `a` be taken now? (The UI greys out what this refuses.) */
export function can(G, a) {
    if (!a || G.over) return false;
    if (G.phase === 'battle') return canBattle(G, a);
    if (G.phase === 'reward') return a.t === 'pick' && a.i >= -1 && a.i < 3;
    if (G.phase === 'tree') return a.t === 'leave' || (a.t === 'light' && G.points > 0 && available(G.tree).includes(a.id));
    if (G.phase === 'way') return a.t === 'rest' || (a.t === 'purge' && purgeable(G).includes(a.sym));
    return false;
}

/** Symbols a Waystation can strip out: one copy from every reel that has one, never below 4. */
export function purgeable(G) {
    const out = [];
    for (const s of Object.keys(SYMBOLS)) {
        if (s === 'static') continue;
        if (G.p.reels.some((strip) => strip.includes(s) && strip.length > 4)) out.push(s);
    }
    return out;
}

/** Take one action. Returns true if it was legal. */
export function act(G, a) {
    if (!can(G, a)) return false;
    if (G.phase === 'battle') {
        battleAct(G, a);
        if (battleWon(G)) onWin(G);
        else if (G.p.hp <= 0) onLose(G);
    } else if (G.phase === 'reward') {
        const sym = a.i >= 0 ? G.reward.choices[a.i] : null;
        if (sym) addEverywhere(G, sym);
        emit(G, { type: 'pick', sym });
        toTree(G);
    } else if (G.phase === 'tree') {
        if (a.t === 'leave') { advance(G); return true; }
        const n = nodeById(G.tree, a.id);
        G.tree.lit.push(n.id);
        G.points--;
        applyNode(G, n.kind);
        emit(G, { type: 'light', id: n.id, kind: n.kind, name: NODES[n.kind].name });
    } else if (G.phase === 'way') {
        if (a.t === 'rest') {
            const amount = Math.min(G.p.maxHp - G.p.hp, Math.round(G.p.maxHp * REST_HEAL));
            G.p.hp += amount;
            emit(G, { type: 'rest', amount });
        } else {
            for (const strip of G.p.reels) {
                const i = strip.indexOf(a.sym);
                if (i >= 0 && strip.length > 4) strip.splice(i, 1);
            }
            emit(G, { type: 'purge', sym: a.sym });
        }
        advance(G);
    }
    return true;
}

/** Advance one fixed step. inp = { act }: an action to take this step, or null. */
export function step(G, inp, dt) {
    G.t += dt;
    if (inp && inp.act) act(G, inp.act);
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
