// The five desk-side mini-games. Each is a small pure state machine kept in G.mg: startMg() deals it from
// G.rng, mgAct() takes one input, and when it is over the rewards are applied and mg.done / mg.result are set
// for the UI to show. Only Stamp Rush runs on a clock, and that clock is fed in as dt (mgTick).

import { MG, RANKS } from '../config.js';
import { addXp, bumpAff, bump } from './rules.js';

// ------------------------------------------------------------------ shared tables (the player learns these)
export const BEATS = { guard: 'strike', strike: 'feint', feint: 'guard' };     // key beats value
export const TELLS = {
    strike: ['Their weight rolls onto the front foot.', 'The sword arm draws back.', 'A sharp breath in.'],
    guard: ['Their heels dig in.', 'The blade comes up across the body.', 'Their shoulders square.'],
    feint: ['Their eyes flick to your left.', 'A little half-step, too showy.', 'The grip loosens, just slightly.'],
};
export const MASKED = 'They give nothing away.';
export const INGREDIENTS = ['Moonpetal', 'Emberroot', 'Frogwort', 'Starsalt'];
export const TERRAIN = { 1: 'road', 2: 'forest', 3: 'hills', 4: 'marsh', 9: 'peak' };
const PARTIES = ['The Brass Larks', 'Hob & Daughters', 'The Unlikely Four', 'Moorwalkers', 'The Second Breakfast Club', 'Greycloak Company',
    'The Tin Gauntlets', 'Wend & Wane', 'The Lantern-Moths', 'Three Goats Abreast', 'Silverfen Irregulars', 'The Polite Ogres'];
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

/** A quest form is approved only if every line of the checklist holds. */
export function formValid(f) {
    return f.seal && f.sign && f.paid && f.p >= f.q && (f.site < 2 || f.counter);
}

// ------------------------------------------------------------------ dealing
export function startMg(G, game, arg) {
    const rng = G.rng;
    let mg = null;
    if (game === 'stamp') {
        const forms = [];
        for (let i = 0; i < MG.stamp.forms; i++) {
            const q = rng.int(0, 3), site = rng.int(0, 2);
            const f = { party: rng.pick(PARTIES), q, p: Math.min(4, q + rng.int(0, 1)), seal: true, sign: true, paid: true, site, counter: site === 2 };
            if (rng.chance(0.5)) {
                const flaws = ['seal', 'sign', 'paid', 'rank'];
                if (site === 2) flaws.push('counter');
                const flaw = rng.pick(flaws);
                if (flaw === 'rank') { if (f.q === 0) f.q = 1; f.p = f.q - 1; } else f[flaw] = false;
            }
            forms.push(f);
        }
        mg = { game, forms, i: 0, right: 0, wrong: 0, time: MG.stamp.time };
    } else if (game === 'brew') {
        mg = { game, round: 0, seq: [], pos: 0, made: 0 };
        dealBrew(G, mg);
    } else if (game === 'route') {
        mg = { game, ...dealRoute(G), spent: 0, trail: [] };
        mg.x = 0; mg.y = mg.sy;
    } else if (game === 'dice') {
        if (G.gold < MG.dice.stake) return false;
        G.gold -= MG.dice.stake;
        mg = { game, round: 0, pot: 0, banked: 0, last: null, bust: false };
    } else if (game === 'spar') {
        const a = G.advs.find((x) => x.id === arg);
        if (!a || a.state !== 'ready') return false;
        mg = { game, adv: a.id, round: 0, wins: 0, last: null };
        dealSpar(G, mg);
    } else return false;
    mg.done = false; mg.result = null;
    G.mg = mg;
    G.events.push({ type: 'mgstart', game });
    return true;
}

function dealBrew(G, mg) {
    const n = MG.brew.rounds[mg.round];
    mg.seq = Array.from({ length: n }, () => G.rng.int(0, MG.brew.kinds - 1));
    mg.pos = 0;
    G.events.push({ type: 'brewseq', seq: mg.seq.slice() });
}

function dealSpar(G, mg) {
    const a = G.advs.find((x) => x.id === mg.adv);
    mg.move = G.rng.pick(['strike', 'guard', 'feint']);
    const masked = a.rank >= 2 && G.rng.chance(0.25);
    mg.tell = masked ? MASKED : G.rng.pick(TELLS[mg.move]);
}

function dealRoute(G) {
    const { w, h, slack } = MG.route;
    const pool = [1, 1, 1, 2, 2, 3, 4, 9];
    for (let tries = 0; tries < 60; tries++) {
        const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => G.rng.pick(pool)));
        const sy = G.rng.int(0, h - 1), gy = G.rng.int(0, h - 1);
        grid[sy][0] = 1; grid[gy][w - 1] = 1;
        const best = routeSolve({ grid, x: 0, y: sy, gx: w - 1, gy }).cost;
        if (best < Infinity) return { grid, sy, gx: w - 1, gy, best, budget: best + slack };
    }
    const grid = Array.from({ length: h }, () => Array(w).fill(1));
    return { grid, sy: 0, gx: w - 1, gy: 0, best: w - 1, budget: w - 1 + slack };
}

/** The cheapest way from (x, y) to the goal: { cost, path: ['r', 'd', ...] }. Also the bot's planner. */
export function routeSolve(mg) {
    const h = mg.grid.length, w = mg.grid[0].length;
    const dist = new Map(), prev = new Map();
    const key = (x, y) => y * w + x;
    dist.set(key(mg.x, mg.y), 0);
    const open = [[mg.x, mg.y]];
    while (open.length) {
        open.sort((a, b) => dist.get(key(...b)) - dist.get(key(...a)));
        const [x, y] = open.pop();
        const d = dist.get(key(x, y));
        for (const dir in DIRS) {
            const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || mg.grid[ny][nx] >= 9) continue;
            const nd = d + mg.grid[ny][nx];
            if (nd < (dist.get(key(nx, ny)) ?? Infinity)) { dist.set(key(nx, ny), nd); prev.set(key(nx, ny), [x, y, dir]); open.push([nx, ny]); }
        }
    }
    const cost = dist.get(key(mg.gx, mg.gy)) ?? Infinity;
    const path = [];
    if (cost < Infinity) for (let k = key(mg.gx, mg.gy); prev.has(k);) { const [px, py, dir] = prev.get(k); path.unshift(dir); k = key(px, py); }
    return { cost, path };
}

// ------------------------------------------------------------------ playing
export function mgAct(G, cmd) {
    const mg = G.mg;
    if (!mg || mg.done) return false;
    const a = cmd.a;
    if (mg.game === 'stamp') {
        if (a !== 'ok' && a !== 'no') return false;
        const good = formValid(mg.forms[mg.i]) === (a === 'ok');
        if (good) mg.right++; else mg.wrong++;
        G.events.push({ type: 'stamp', good });
        mg.i++;
        if (mg.i >= mg.forms.length || mg.wrong >= MG.stamp.strikes) finish(G);
        return true;
    }
    if (mg.game === 'brew') {
        if (!(a >= 0 && a < MG.brew.kinds)) return false;
        if (mg.seq[mg.pos] !== a) { G.events.push({ type: 'fizz' }); finish(G); return true; }
        mg.pos++;
        G.events.push({ type: 'drop', a });
        if (mg.pos >= mg.seq.length) {
            mg.made++; mg.round++;
            G.events.push({ type: 'bottled' });
            if (mg.round >= MG.brew.rounds.length) finish(G); else dealBrew(G, mg);
        }
        return true;
    }
    if (mg.game === 'route') {
        const d = DIRS[a];
        if (!d) return false;
        const nx = mg.x + d[0], ny = mg.y + d[1];
        if (nx < 0 || ny < 0 || ny >= mg.grid.length || nx >= mg.grid[0].length || mg.grid[ny][nx] >= 9) return false;
        mg.trail.push([mg.x, mg.y]);
        mg.x = nx; mg.y = ny; mg.spent += mg.grid[ny][nx];
        G.events.push({ type: 'step' });
        if ((nx === mg.gx && ny === mg.gy) || mg.spent > mg.budget) finish(G);
        return true;
    }
    if (mg.game === 'dice') {
        if (a === 'roll') {
            const d1 = G.rng.int(1, 6), d2 = G.rng.int(1, 6);
            mg.last = [d1, d2]; mg.bust = d1 === 1 || d2 === 1;
            if (d1 === 1 && d2 === 1) { mg.banked = 0; mg.pot = 0; mg.round++; }
            else if (mg.bust) { mg.pot = 0; mg.round++; }
            else mg.pot += d1 + d2;
            G.events.push({ type: 'roll', d1, d2, bust: mg.bust });
        } else if (a === 'bank') {
            if (!mg.pot) return false;
            mg.banked += mg.pot; mg.pot = 0; mg.round++; mg.bust = false;
            G.events.push({ type: 'bank' });
        } else return false;
        if (mg.round >= MG.dice.rounds) finish(G);
        return true;
    }
    if (mg.game === 'spar') {
        if (!(a in BEATS)) return false;
        const res = BEATS[a] === mg.move ? 'win' : BEATS[mg.move] === a ? 'lose' : 'draw';
        if (res === 'win') mg.wins++;
        mg.last = { you: a, them: mg.move, res };
        G.events.push({ type: 'clash', res });
        mg.round++;
        if (mg.round >= MG.spar.rounds) finish(G); else dealSpar(G, mg);
        return true;
    }
    return false;
}

/** Stamp Rush's sand-glass. */
export function mgTick(G, dt) {
    const mg = G.mg;
    if (!mg || mg.done || mg.game !== 'stamp') return;
    mg.time -= dt;
    if (mg.time <= 0) { mg.time = 0; finish(G); }
}

function finish(G) {
    const mg = G.mg;
    let stars = 0, lines = [], title = '';
    if (mg.game === 'stamp') {
        const merit = Math.max(0, Math.floor(mg.right / 3) - mg.wrong), gold = mg.right * 2;
        G.merit += merit; G.gold += gold;
        const perfect = mg.right === mg.forms.length;
        if (perfect) G.renown += 1;
        stars = perfect ? 3 : mg.right >= 6 ? 2 : mg.right >= 3 ? 1 : 0;
        title = perfect ? 'Not a blot on the page' : mg.wrong >= MG.stamp.strikes ? 'Pell takes the stamp away' : 'The pile is cleared';
        lines = [`${mg.right} filed correctly, ${mg.wrong} wrong.`, `Merit +${merit} · Gold +${gold}${perfect ? ' · Renown +1' : ''}`];
    } else if (mg.game === 'brew') {
        G.potions += mg.made;
        stars = mg.made;
        title = mg.made === 3 ? 'Three clean bottles' : mg.made ? 'It will do' : 'It curdled';
        lines = [mg.made ? `You bottled ${mg.made} healing draught${mg.made > 1 ? 's' : ''}.` : 'The cauldron belches green smoke. Nothing to bottle.',
            'A draught mends a hurt adventurer at once, or steadies a party on a quest (+10% chance).'];
    } else if (mg.game === 'route') {
        const won = mg.x === mg.gx && mg.y === mg.gy && mg.spent <= mg.budget;
        const optimal = won && mg.spent === mg.best;
        if (won) { G.charts += optimal ? 2 : 1; G.merit += 1; }
        stars = optimal ? 3 : won ? 2 : 0;
        title = optimal ? 'The best road there is' : won ? 'A sound route' : 'The supplies ran out';
        lines = [won ? `Charted in ${mg.spent} days' supplies (best possible: ${mg.best}).` : 'The party would have starved on that road. No chart today.',
            won ? `Charts +${optimal ? 2 : 1} · Merit +1. A chart shortens a quest by a day and adds 5% to its chance.` : ''];
    } else if (mg.game === 'dice') {
        const win = Math.min(MG.dice.cap, mg.banked);
        G.gold += win;
        if (G.flags.met_bram) bumpAff(G, 'bram', 1);
        stars = win >= 40 ? 3 : win >= 25 ? 2 : win > 0 ? 1 : 0;
        title = win >= 40 ? 'The dragon is robbed blind' : win > MG.dice.stake ? 'A tidy night' : win ? 'Barely broke even' : 'The hoard keeps its gold';
        lines = [`You banked ${win} gold on a ${MG.dice.stake} gold stake.`];
    } else if (mg.game === 'spar') {
        const a = G.advs.find((x) => x.id === mg.adv);
        const xp = MG.spar.xp * (1 + mg.wins);
        const before = a.rank;
        addXp(G, a.id, xp);
        if (mg.wins >= 3) bump(G, 'fellow', 1);
        if (a.id in G.aff && G.flags['met_' + a.id]) bumpAff(G, a.id, 2);
        stars = mg.wins >= 5 ? 3 : mg.wins >= 3 ? 2 : mg.wins >= 1 ? 1 : 0;
        title = mg.wins >= 4 ? 'A proper lesson' : mg.wins >= 2 ? 'Honest sweat' : 'You mostly got hit';
        lines = [`You read ${mg.wins} of ${MG.spar.rounds} exchanges. +${xp} experience.`, a.rank > before ? `They have earned ${RANKS[a.rank]} rank!` : ''];
    }
    mg.done = true;
    mg.result = { title, lines: lines.filter(Boolean), stars };
    G.count['mg_' + mg.game] = (G.count['mg_' + mg.game] || 0) + 1;
    G.events.push({ type: 'mgdone', game: mg.game, stars });
}
