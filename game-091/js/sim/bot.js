// An auto-player. It plays through the same actions the player uses, so the tests, the balance
// table and the Autoplay demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1 reads every nudge and respin for the best payline and builds toward its reels;
// lower skill fires what it lands more often and picks rewards and stars more at random.

import { evaluate, line, incoming, intentOf, hitOf } from './battle.js';
import { available, nodeById } from './tree.js';
import { purgeable } from './game.js';
import { COST } from '../config.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    // the bot's own coin flips use a counter hash, so it never touches the game's RNG
    return { skill, n: seed * 7919 };
}

function flip(bot) {
    bot.n = (Math.imul(bot.n ^ (bot.n >>> 15), 2246822519) + 0x9E3779B9) | 0;
    return ((bot.n >>> 0) % 10000) / 10000;
}

const mod = (a, n) => ((a % n) + n) % n;

/** How good a payline is right now, in rough "damage-equivalent" points. */
export function valueOf(G, syms) {
    const B = G.b, r = evaluate(G, syms);
    const foes = B.enemies.filter((e) => e.hp > 0);
    const tgt = B.enemies[B.target];
    const kill = (e, d) => Math.min(d, e.hp + e.block) + (d >= e.hp + e.block ? 8 : 0);
    let v = 0;
    if (tgt && tgt.hp > 0) v += kill(tgt, r.dmg) + r.burn * 1.6;
    for (const e of foes) v += kill(e, r.aoe);
    const threat = Math.max(0, incoming(G) - B.block);
    v += Math.min(r.block, threat) * 1.1 + r.block * 0.15;
    v += Math.min(r.heal + r.leech, G.p.maxHp - G.p.hp) * (G.p.hp < G.p.maxHp * 0.5 ? 1.1 : 0.6);
    v += r.energy * 2.5;
    return v;
}

function bestTarget(G) {
    const B = G.b;
    let best = -1, bs = -Infinity;
    B.enemies.forEach((e, i) => {
        if (e.hp <= 0) return;
        const m = intentOf(e);
        const hits = m.k === 'atk' ? hitOf(e, m) * (m.n || 1) : m.k === 'jam' ? 6 : 3;
        const s = hits * 2 - (e.hp + e.block) * 0.5;
        if (s > bs) { bs = s; best = i; }
    });
    return best;
}

function battleMove(G, bot) {
    const B = G.b;
    if (!B.spun) return { t: 'spin' };
    const t = bestTarget(G);
    if (t >= 0 && t !== B.target && bot.skill >= 0.8) return { t: 'target', i: t };
    const canPay = B.free || B.energy >= COST.nudge;
    if (!canPay) return { t: 'fire' };
    if (flip(bot) > bot.skill) {
        // a careless pilot: sometimes a random nudge, mostly just fire
        if (flip(bot) < 0.3) return { t: 'nudge', reel: Math.floor(flip(bot) * B.reels.length), dir: flip(bot) < 0.5 ? -1 : 1 };
        return { t: 'fire' };
    }
    const now = line(G);
    const base = valueOf(G, now);
    let best = null, gain = 0.5;
    B.reels.forEach((strip, r) => {
        for (const dir of [-1, 1]) {
            const syms = now.slice();
            syms[r] = strip[mod(B.stops[r] + dir, strip.length)];
            const g = valueOf(G, syms) - base;
            if (g > gain) { gain = g; best = { t: 'nudge', reel: r, dir }; }
        }
        // a respin is worth its average outcome
        let sum = 0;
        for (const s of strip) { const syms = now.slice(); syms[r] = s; sum += valueOf(G, syms); }
        const g = sum / strip.length - base - 1.5;
        if (g > gain) { gain = g; best = { t: 'respin', reel: r }; }
    });
    return best || { t: 'fire' };
}

const SYM_TASTE = { wild: 9, blade: 6, comet: 5, hex: 4.5, shield: 4, mend: 2.5, charge: 2 };

function rewardMove(G, bot) {
    if (flip(bot) > bot.skill) return { t: 'pick', i: Math.floor(flip(bot) * 3) };
    // build toward what the reels already have plenty of, so matches come more often
    const counts = {};
    for (const s of G.p.reels[0]) counts[s] = (counts[s] || 0) + 1;
    const hurt = G.p.hp < G.p.maxHp * 0.45;
    let best = 0, bs = -1;
    G.reward.choices.forEach((s, i) => {
        let v = SYM_TASTE[s] + (counts[s] || 0) * 0.6 + (G.p.etch[s] || 0) * 2;
        if (hurt && s === 'mend') v += 4;
        if (v > bs) { bs = v; best = i; }
    });
    return { t: 'pick', i: best };
}

const NODE_TASTE = {
    reel: 20, supernova: 19, jackpot: 15, capacitor: 13, twin: 11, filter: 9, aegis: 8,
    sharp: 8, etch_blade: 8, wild: 8, etch_comet: 6, etch_hex: 6, hull: 6, plating: 5,
    spark: 6, leech: 5, etch_shield: 4, salvage: 5, etch_mend: 3,
};

function treeMove(G, bot) {
    const av = available(G.tree);
    if (!G.points || !av.length) return { t: 'leave' };
    if (flip(bot) > bot.skill) return { t: 'light', id: av[Math.floor(flip(bot) * av.length)] };
    // look one row ahead: a node is worth itself plus the best star it opens
    const T = G.tree;
    const score = (nid, depth) => {
        const n = nodeById(T, nid);
        let v = NODE_TASTE[n.kind] || 3;
        if (depth > 0) {
            const next = T.edges.filter((e) => e.startsWith(nid + '>')).map((e) => e.split('>')[1]);
            if (next.length) v += 0.5 * Math.max(...next.map((x) => score(x, depth - 1)));
        }
        return v;
    };
    let best = av[0], bs = -1;
    for (const nid of av) { const s = score(nid, 2); if (s > bs) { bs = s; best = nid; } }
    return { t: 'light', id: best };
}

function wayMove(G, bot) {
    const p = G.p;
    if (p.hp < p.maxHp * 0.7 || flip(bot) > bot.skill) return { t: 'rest' };
    const can = purgeable(G);
    for (const s of ['charge', 'mend', 'shield']) if (can.includes(s)) return { t: 'purge', sym: s };
    return { t: 'rest' };
}

/** The bot's next action for G, or null when the run is over. */
export function botAct(G, bot) {
    if (G.over) return null;
    if (G.phase === 'battle') return battleMove(G, bot);
    if (G.phase === 'reward') return rewardMove(G, bot);
    if (G.phase === 'tree') return treeMove(G, bot);
    if (G.phase === 'way') return wayMove(G, bot);
    return null;
}
