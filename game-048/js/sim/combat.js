/**
 * combat.js — one fight, resolved instantly. Every player action returns the
 * list of events it caused; the battle director plays them back with timing.
 *
 * Phases: 'ready' (press SPIN) → 'landed' (nudge / respin / hold / purge, then
 * ENGAGE) → enemies act → 'ready' … until 'won' or 'lost'.
 */

import { makeStateRng } from './rng.js';
import { SYMBOLS, LINE_MULT, PAYABLE, WEAPONS } from './symbols.js';
import { buildStrip, stripAt, evaluateGrid, mod } from './slot.js';
import { makeEnemy, rewardScale, BOSSES } from './enemies.js';
import { BOOSTERS } from './boosters.js';

const rngOf = (st) => makeStateRng(st.rngObj);

export function createCombat({ L, encounter, seed, hp = null, boosters = {} }) {
    const rngObj = { s: (seed >>> 0) || 0x1234567 };
    const rng = makeStateRng(rngObj);
    const st = {
        rngObj, L, turn: 1, phase: 'ready',
        cols: L.cols, rows: L.rows, lines: L.lines,
        reels: [],
        sticky: [], stickyActive: [], overlay: [], expanded: [],
        grid: null, preview: null,
        player: {
            hp: Math.min(L.maxHp, hp ?? L.maxHp), maxHp: L.maxHp, shield: 0,
            energy: L.startFull ? L.maxEnergy : Math.min(L.maxEnergy, 2),
            maxEnergy: L.maxEnergy, freeNudges: L.freeNudges, emergencyUsed: false,
        },
        enemies: [], nextId: 0, target: 0,
        x: encounter.x, chapter: encounter.chapter, kind: encounter.kind,
        reward: rewardScale(encounter.x),
        overdrive: 0, overdriveMult: L.overdriveMult, bonus: false,
        streak: 0, spins: 0, lastBest: 0, tide: 0, holdsPaid: [],
        boosters: { ...boosters }, boostersUsed: {},
        loot: { scrap: 0, xp: 0, boosters: [] },
        stats: { kills: 0, elites: 0, lines: {}, linesTotal: 0, maxChain: 0, maxSpin: 0, overdrives: 0, jackpots: 0, dmgTaken: 0, five: 0, dmgDealt: 0, cascades: 0, crits: 0, scrap: 0 },
    };
    for (let c = 0; c < L.cols; c++) {
        const strip = buildStrip(L.weights, rng);
        st.reels.push({ strip, pos: rng.int(0, strip.length - 1), lock: 0, jammed: false, hold: false });
    }
    for (const e of encounter.enemies) addEnemy(st, e);
    st.target = st.enemies[0].id;
    for (const e of st.enemies) rollIntent(st, e, rng);
    computeGrid(st);
    return st;
}

function addEnemy(st, e) {
    const copy = JSON.parse(JSON.stringify(e));
    copy.id = st.nextId++;
    st.enemies.push(copy);
    return copy;
}

export const alive = (st) => st.enemies.filter((e) => e.hp > 0);
export const enemyById = (st, id) => st.enemies.find((e) => e.id === id);

function currentTarget(st) {
    let t = enemyById(st, st.target);
    if (!t || t.hp <= 0) {
        // the boss before minions, otherwise the first alive
        const a = alive(st);
        t = a.find((e) => e.boss) ?? a[0];
        if (t) st.target = t.id;
    }
    return t;
}

export function setTarget(st, id) {
    const e = enemyById(st, id);
    if (e && e.hp > 0) st.target = id;
}

// ------------------------------------------------------------------ grid

export function computeGrid(st) {
    st.grid = buildGrid(st);
    st.preview = evaluateGrid(st.grid, st.L, st.lines);
    return st.grid;
}

/** The visible grid for the reels' current positions, without storing it. */
export function buildGrid(st) {
    const grid = [];
    for (let c = 0; c < st.cols; c++) {
        const reel = st.reels[c];
        const col = [];
        for (let r = 0; r < st.rows; r++) col.push(reel.jammed ? 'glitch' : stripAt(reel, r));
        grid.push(col);
    }
    for (const [c, r] of [...st.stickyActive, ...st.overlay]) if (!st.reels[c].jammed) grid[c][r] = 'wild';
    for (const c of st.expanded) if (!st.reels[c].jammed) for (let r = 0; r < st.rows; r++) grid[c][r] = 'wild';
    return grid;
}

const gridCopy = (g) => g.map((c) => c.slice());

// ------------------------------------------------------------------ player actions

export function spin(st) {
    if (st.phase !== 'ready') return [];
    const rng = rngOf(st);
    const ev = [];
    st.bonus = st.overdrive > 0;
    if (st.bonus) st.overdrive--;
    st.stickyActive = st.sticky.filter((s) => s.turns > 0).map((s) => [s.c, s.r]);
    st.sticky = st.sticky.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
    st.overlay = [];
    st.expanded = [];
    st.holdsPaid = [];
    const held = [], jammed = [], from = [];
    st.reels.forEach((reel, c) => {
        from.push(reel.pos);
        reel.jammed = reel.lock > 0;
        if (reel.lock > 0) reel.lock--;
        if (reel.jammed) jammed.push(c);
        else if (reel.hold) held.push(c);
        else reel.pos = rng.int(0, reel.strip.length - 1);
        reel.hold = false;
    });
    computeGrid(st);
    st.phase = 'landed';
    ev.push({ t: 'spin', grid: gridCopy(st.grid), from, pos: st.reels.map((r) => r.pos), held, jammed, bonus: st.bonus, sticky: st.stickyActive.slice() });
    return ev;
}

function pay(st, cost) {
    const p = st.player;
    if (p.energy < cost) return false;
    p.energy -= cost;
    return true;
}

export function nudgeCost(st) {
    return st.player.freeNudges > 0 ? 0 : st.L.nudgeCost;
}

export function canAct(st, action, c) {
    if (st.phase !== 'landed') return false;
    const reel = st.reels[c];
    if (!reel) return false;
    if (action === 'purge') return reel.jammed && st.player.energy >= st.L.purgeCost;
    if (reel.jammed) return false;
    if (action === 'nudge') return st.player.freeNudges > 0 || st.player.energy >= st.L.nudgeCost;
    if (action === 'respin') return st.player.energy >= st.L.respinCost;
    if (action === 'hold') {
        if (reel.hold) return true;
        const holds = st.reels.filter((r) => r.hold).length;
        return holds < st.cols - 1 && st.player.energy >= st.L.holdCost;
    }
    return false;
}

export function nudge(st, c, dir) {
    if (!canAct(st, 'nudge', c)) return [];
    if (st.player.freeNudges > 0) st.player.freeNudges--;
    else pay(st, st.L.nudgeCost);
    const reel = st.reels[c];
    reel.pos = mod(reel.pos - dir, reel.strip.length);
    computeGrid(st);
    return [{ t: 'nudge', reel: c, dir, pos: reel.pos, grid: gridCopy(st.grid), energy: st.player.energy }];
}

export function respin(st, c) {
    if (!canAct(st, 'respin', c)) return [];
    pay(st, st.L.respinCost);
    const reel = st.reels[c];
    const from = reel.pos;
    reel.pos = rngOf(st).int(0, reel.strip.length - 1);
    computeGrid(st);
    return [{ t: 'respin', reel: c, from, pos: reel.pos, grid: gridCopy(st.grid), energy: st.player.energy }];
}

export function hold(st, c) {
    if (!canAct(st, 'hold', c)) return [];
    const reel = st.reels[c];
    if (reel.hold) {
        reel.hold = false;
        if (st.holdsPaid.includes(c)) { st.player.energy += st.L.holdCost; st.holdsPaid = st.holdsPaid.filter((x) => x !== c); }
    } else {
        pay(st, st.L.holdCost);
        reel.hold = true;
        st.holdsPaid.push(c);
    }
    return [{ t: 'hold', reel: c, on: reel.hold, energy: st.player.energy }];
}

export function purge(st, c) {
    if (!canAct(st, 'purge', c)) return [];
    pay(st, st.L.purgeCost);
    const reel = st.reels[c];
    reel.jammed = false;
    const from = reel.pos;
    reel.pos = rngOf(st).int(0, reel.strip.length - 1);
    computeGrid(st);
    return [{ t: 'purge', reel: c, from, pos: reel.pos, grid: gridCopy(st.grid), energy: st.player.energy }];
}

export function canBoost(st, id) {
    if ((st.boosters[id] ?? 0) <= 0) return false;
    if (st.phase !== 'ready' && st.phase !== 'landed') return false;
    const w = BOOSTERS[id].when;
    if (w === 'landed' && st.phase !== 'landed') return false;
    if (w === 'ready' && st.phase !== 'ready') return false;
    if (id === 'nanite' && st.player.hp >= st.player.maxHp) return false;
    return true;
}

export function useBooster(st, id) {
    if (!canBoost(st, id)) return [];
    const rng = rngOf(st);
    const ev = [];
    st.boosters[id]--;
    st.boostersUsed[id] = (st.boostersUsed[id] ?? 0) + 1;
    ev.push({ t: 'booster', id });
    const p = st.player;
    if (id === 'nanite') {
        const amt = Math.round(p.maxHp * 0.35);
        p.hp = Math.min(p.maxHp, p.hp + amt);
        ev.push({ t: 'gain', what: 'heal', amt, hp: p.hp });
    } else if (id === 'battery') {
        p.energy += 3;
        ev.push({ t: 'gain', what: 'energy', amt: 3, energy: p.energy });
    } else if (id === 'emp') {
        ev.push({ t: 'fire', sym: 'emp', kind: 'emp', targets: alive(st).map((e) => e.id), power: 0 });
        for (const e of alive(st)) {
            e.shield = 0;
            hitEnemy(st, ev, e, e.maxHp * 0.12, { sym: 'emp', pierce: true });
        }
        unjamAll(st, ev);
    } else if (id === 'coin') {
        const open = st.reels.map((r, c) => c).filter((c) => !st.reels[c].jammed);
        rng.shuffle(open);
        const mid = Math.floor((st.rows - 1) / 2);
        const cells = open.slice(0, 2).map((c) => [c, mid]);
        st.overlay.push(...cells);
        computeGrid(st);
        ev.push({ t: 'coin', cells, grid: gridCopy(st.grid) });
    } else if (id === 'chip') {
        st.overdrive += 2;
        st.overdriveMult = st.L.overdriveMult;
        st.stats.overdrives++;
        ev.push({ t: 'overdrive', spins: st.overdrive, mult: st.overdriveMult });
    } else if (id === 'patch') {
        let n = 0;
        for (const reel of st.reels) for (let i = 0; i < reel.strip.length; i++) if (reel.strip[i] === 'glitch') { reel.strip[i] = rng.pick(['blade', 'cannon', 'energy']); n++; }
        unjamAll(st, ev);
        ev.push({ t: 'patch', n });
    }
    if (st.phase === 'landed') computeGrid(st);
    checkEnd(st, ev);
    return ev;
}

function unjamAll(st, ev) {
    const reels = [];
    st.reels.forEach((reel, c) => {
        if (reel.lock > 0 || reel.jammed) reels.push(c);
        reel.lock = 0;
        if (reel.jammed) { reel.jammed = false; }
    });
    if (st.phase === 'landed') computeGrid(st);
    if (reels.length) ev.push({ t: 'unjam', reels, grid: st.phase === 'landed' ? gridCopy(st.grid) : null });
}

// ------------------------------------------------------------------ resolution

/** Power of one symbol of `sym` before line/chain multipliers. */
export function symPower(st, sym) {
    const P = st.L.power;
    if (sym === 'wild') return Math.max(P.blade, P.cannon, P.missile, P.arc) * 1.5;
    return P[sym] ?? 0;
}

function linePower(st, win) {
    return symPower(st, win.sym) * win.len * LINE_MULT[win.len];
}

/** Rough value of a grid, for the preview number and the bot. */
export function estimateGrid(st, grid) {
    const res = evaluateGrid(grid, st.L, st.lines);
    let v = 0, chain = 0;
    const used = new Set();
    for (const w of res.wins) {
        chain++;
        const m = (1 + st.L.chainStep * (chain - 1)) * (w.dir < 0 ? st.L.mods.mirror : 1) * (w.wilds ? st.L.wildAmp : 1);
        v += valueOf(st, w.sym, linePower(st, w) * m);
        for (const [c, r] of w.cells) used.add(c * 10 + r);
    }
    for (let c = 0; c < grid.length; c++) for (let r = 0; r < grid[0].length; r++) {
        if (used.has(c * 10 + r)) continue;
        const s = grid[c][r];
        if (s === 'wild') v += valueOf(st, 'blade', st.L.power.blade);
        else if (PAYABLE.includes(s)) v += valueOf(st, s, symPower(st, s) * (SYMBOLS[s].kind === 'attack' ? 1 + st.L.hot : 1));
    }
    if (res.cores >= st.L.jackpotAt) v += 400;
    else if (res.cores >= 3) v += 120;
    else if (res.cores === 2) v += 6;
    return { value: v, res };
}

function valueOf(st, sym, power) {
    const k = SYMBOLS[sym === 'wild' ? 'blade' : sym].kind;
    const n = alive(st).length;
    if (sym === 'missile') return power * Math.max(1, n);
    if (sym === 'arc') return power * Math.min(n, 3) * 0.8;
    if (k === 'attack') return power;
    const p = st.player;
    if (k === 'shield') return power * 0.6;
    if (k === 'repair') return power * (p.hp < p.maxHp * 0.6 ? 1 : 0.25);
    if (k === 'energy') return power * 3;
    if (k === 'scrap') return power * 0.2;
    return 0;
}

export function engage(st) {
    if (st.phase !== 'landed') return [];
    const rng = rngOf(st);
    const L = st.L;
    const ev = [];
    st.spins++;
    st.phase = 'resolving';
    st._leech = 0;
    st._spinDmg = 0;
    const ventEnergy = st.player.energy;
    let globalMult = st.bonus ? st.overdriveMult : 1;
    ev.push({ t: 'engage', bonus: st.bonus, mult: globalMult });
    if (L.mods.seventh && st.spins % 7 === 0) {
        globalMult *= L.mods.seventh;
        ev.push({ t: 'seventh', mult: L.mods.seventh });
    }
    const streakMult = 1 + L.streak * st.streak;

    // expanding wilds
    if (L.mods.expand) {
        for (let c = 0; c < st.cols; c++) {
            if (st.reels[c].jammed || st.expanded.includes(c)) continue;
            if (st.grid[c].includes('wild') && rng.chance(L.mods.expand)) {
                st.expanded.push(c);
                ev.push({ t: 'expand', reel: c });
            }
        }
        if (st.expanded.length) { computeGrid(st); ev.push({ t: 'grid', grid: gridCopy(st.grid) }); }
    }
    // sticky wilds remember where they landed
    if (L.mods.sticky) {
        for (let c = 0; c < st.cols; c++) {
            if (st.reels[c].jammed) continue;
            for (let r = 0; r < st.rows; r++) {
                if (stripAt(st.reels[c], r) === 'wild' && !st.stickyActive.some(([x, y]) => x === c && y === r)) {
                    st.sticky.push({ c, r, turns: L.mods.sticky });
                }
            }
        }
    }

    const scatter = st.preview.cores;
    // glitch eater (energy mode)
    if (L.mods.eater && L.mods.eater < 3 && st.preview.glitches > 0) {
        const amt = st.preview.glitches;
        st.player.energy += amt;
        ev.push({ t: 'gain', what: 'energy', amt, energy: st.player.energy, src: 'eater' });
    }

    let grid = gridCopy(st.grid);
    let chain = 0;
    let first = true;
    let cascadesLeft = L.mods.cascade;
    let anyLine = false;
    let best = null, bestPower = 0;
    let used = new Set();
    const fell = new Array(st.cols).fill(0);
    for (;;) {
        const res = evaluateGrid(grid, L, st.lines);
        used = new Set();
        if (!res.wins.length) break;
        anyLine = true;
        for (const w of res.wins) {
            if (!alive(st).length && SYMBOLS[w.sym === 'wild' ? 'blade' : w.sym].kind === 'attack') continue;
            chain++;
            const chainMult = 1 + L.chainStep * (chain - 1);
            let mult = chainMult * globalMult * streakMult;
            if (first) mult *= L.focus;
            if (w.wilds) mult *= L.wildAmp;
            if (w.dir < 0) mult *= L.mods.mirror;
            first = false;
            const power = linePower(st, w) * mult;
            for (const [c, r] of w.cells) used.add(c * 10 + r);
            ev.push({ t: 'line', line: w.line, cells: w.cells, sym: w.sym, len: w.len, chain, mult: chainMult, power, kind: w.kind, dir: w.dir, wilds: w.wilds });
            st.stats.lines[w.sym] = (st.stats.lines[w.sym] ?? 0) + 1;
            st.stats.linesTotal++;
            if (w.len >= 5) st.stats.five++;
            if (SYMBOLS[w.sym === 'wild' ? 'blade' : w.sym].kind === 'attack' && power > bestPower) { bestPower = power; best = w; }
            applySymbol(st, ev, w.sym, power, { line: true, len: w.len, cells: w.cells });
            if (st.player.hp <= 0) break;
        }
        st.stats.maxChain = Math.max(st.stats.maxChain, chain);
        if (!cascadesLeft || !alive(st).length || st.player.hp <= 0) break;
        // cascade: winning symbols shatter, the column drops, new symbols fall in from the strip
        cascadesLeft--;
        const removed = [];
        for (let c = 0; c < st.cols; c++) {
            const keep = [];
            let k = 0;
            for (let r = 0; r < st.rows; r++) {
                if (used.has(c * 10 + r)) { removed.push([c, r]); k++; } else keep.push(grid[c][r]);
            }
            if (!k) continue;
            // fresh symbols come from the strip above the window; the reel's own position is
            // left alone so a held reel still shows what the player held
            const reel = st.reels[c];
            fell[c] += k;
            const fresh = [];
            for (let i = 0; i < k; i++) fresh.push(reel.strip[mod(reel.pos - fell[c] + i, reel.strip.length)]);
            grid[c] = fresh.concat(keep);
        }
        st.stats.cascades++;
        ev.push({ t: 'cascade', removed, grid: gridCopy(grid), n: L.mods.cascade - cascadesLeft });
        used = new Set();
    }
    st.grid = grid;

    // loose symbols: everything on the final grid that is in no paying line
    if (alive(st).length && st.player.hp > 0) {
        const groups = {};
        for (let c = 0; c < st.cols; c++) for (let r = 0; r < st.rows; r++) {
            if (used.has(c * 10 + r)) continue;
            let s = grid[c][r];
            if (s === 'wild') s = 'blade';
            if (!PAYABLE.includes(s)) continue;
            (groups[s] ??= []).push([c, r]);
        }
        for (const s of ['shield', 'repair', 'energy', 'scrap', 'blade', 'cannon', 'arc', 'missile']) {
            const cells = groups[s];
            if (!cells) continue;
            if (!alive(st).length && SYMBOLS[s].kind === 'attack') continue;
            const hot = SYMBOLS[s].kind === 'attack' ? 1 + L.hot : 1;
            const power = symPower(st, s) * cells.length * hot * globalMult * streakMult;
            ev.push({ t: 'loose', sym: s, cells, power, n: cells.length });
            applySymbol(st, ev, s, power, { line: false, len: cells.length, cells });
            if (st.player.hp <= 0) break;
        }
    }

    // scatter: Overdrive and the Jackpot
    if (scatter >= 3 && st.player.hp > 0) {
        if (scatter >= L.jackpotAt && alive(st).length) {
            st.stats.jackpots++;
            const atk = WEAPONS.reduce((a, w) => a + (L.power[w] ?? 0), 0);
            const power = atk * 10 * globalMult;
            ev.push({ t: 'jackpot', cores: scatter, power });
            ev.push({ t: 'fire', sym: 'core', kind: 'jackpot', targets: alive(st).map((e) => e.id), power });
            for (const e of alive(st)) hitEnemy(st, ev, e, power, { sym: 'core', pierce: true });
            const bonus = Math.round(40 * st.reward);
            st.loot.scrap += bonus;
            ev.push({ t: 'gain', what: 'scrap', amt: bonus, total: st.loot.scrap });
        }
        st.overdrive += L.overdriveSpins;
        st.overdriveMult = L.overdriveMult;
        st.stats.overdrives++;
        ev.push({ t: 'overdrive', spins: st.overdrive, mult: st.overdriveMult, cores: scatter });
    }

    // echo: the best line fires again
    if (L.mods.echo && best && alive(st).length) {
        const power = bestPower * L.mods.echo;
        ev.push({ t: 'echo', cells: best.cells, sym: best.sym, power });
        applySymbol(st, ev, best.sym, power, { line: true, len: best.len, cells: best.cells, echo: true });
    }
    // overheat valve: unspent energy vents as damage
    if (L.mods.overheat && ventEnergy > 0 && alive(st).length) {
        const vent = Math.min(ventEnergy, st.player.energy);
        if (vent > 0) {
            st.player.energy -= vent;
            const t = currentTarget(st);
            const power = vent * L.mods.overheat * L.power.blade * globalMult;
            ev.push({ t: 'fire', sym: 'energy', kind: 'vent', targets: [t.id], power, energy: st.player.energy });
            hitEnemy(st, ev, t, power, { sym: 'energy' });
        }
    }
    if (st._leech > 0 && st.player.hp > 0) {
        const amt = Math.min(st.player.maxHp - st.player.hp, Math.round(st._leech));
        if (amt > 0) { st.player.hp += amt; ev.push({ t: 'gain', what: 'heal', amt, hp: st.player.hp, src: 'leech' }); }
    }

    st.streak = anyLine ? Math.min(5, st.streak + 1) : 0;
    if (L.streak && st.streak > 1) ev.push({ t: 'streak', n: st.streak });
    st.lastBest = bestPower;
    st.stats.maxSpin = Math.max(st.stats.maxSpin, st._spinDmg);
    ev.push({ t: 'spinTotal', dmg: st._spinDmg, chain });

    if (checkEnd(st, ev)) return ev;
    if (st.overdrive > 0) {
        startTurn(st, ev, true);
        return ev;
    }
    enemyPhase(st, ev);
    return ev;
}

/** One symbol (or line, or loose group) fires. */
function applySymbol(st, ev, sym, power, ctx) {
    const L = st.L;
    const p = st.player;
    const s = sym === 'wild' ? 'blade' : sym;
    const kind = ctx.echo ? 'echo' : ctx.line ? 'line' : 'loose';
    const tgt = () => currentTarget(st);
    switch (s) {
        case 'blade': {
            const t = tgt(); if (!t) return;
            ev.push({ t: 'fire', sym, kind, targets: [t.id], cells: ctx.cells, power });
            hitEnemy(st, ev, t, power, { sym: 'blade', crit: true });
            if (ctx.line && L.mods.twin) {
                const t2 = tgt();
                if (t2) {
                    ev.push({ t: 'fire', sym: 'blade', kind: 'twin', targets: [t2.id], cells: ctx.cells, power: power * L.mods.twin });
                    hitEnemy(st, ev, t2, power * L.mods.twin, { sym: 'blade', crit: true });
                }
            }
            break;
        }
        case 'cannon': {
            const t = tgt(); if (!t) return;
            ev.push({ t: 'fire', sym, kind, targets: [t.id], cells: ctx.cells, power });
            hitEnemy(st, ev, t, power, { sym: 'cannon', crit: true, pierce: true });
            break;
        }
        case 'missile': {
            const volleys = 1 + (ctx.line && L.mods.splitter ? L.mods.splitter.n : 0);
            for (let v = 0; v < volleys; v++) {
                const a = alive(st);
                if (!a.length) break;
                const pw = v === 0 ? power : power * L.mods.splitter.pct;
                ev.push({ t: 'fire', sym, kind: v === 0 ? kind : 'volley', targets: a.map((e) => e.id), cells: ctx.cells, power: pw });
                for (const e of a) hitEnemy(st, ev, e, pw, { sym: 'missile', crit: true });
            }
            break;
        }
        case 'arc': {
            const t = tgt(); if (!t) return;
            const jumps = 2 + L.mods.conductor;
            const path = [t];
            const others = alive(st).filter((e) => e !== t);
            for (let i = 0; i < jumps && i < others.length; i++) path.push(others[i]);
            ev.push({ t: 'fire', sym, kind, targets: path.map((e) => e.id), cells: ctx.cells, power });
            path.forEach((e, i) => {
                const pw = L.mods.conductor ? power : power * Math.pow(0.7, i);
                if (e.hp > 0) hitEnemy(st, ev, e, pw, { sym: 'arc', crit: true, chain: i });
            });
            break;
        }
        case 'shield': {
            const amt = Math.round(power);
            p.shield += amt;
            ev.push({ t: 'gain', what: 'shield', amt, shield: p.shield, cells: ctx.cells, kind });
            if (L.bastion) {
                const t = tgt();
                if (t) { ev.push({ t: 'fire', sym: 'shield', kind: 'bastion', targets: [t.id], cells: ctx.cells, power: amt * 0.5 }); hitEnemy(st, ev, t, amt * 0.5, { sym: 'shield' }); }
            }
            break;
        }
        case 'repair': {
            const amt = Math.min(p.maxHp - p.hp, Math.round(power));
            p.hp += amt;
            ev.push({ t: 'gain', what: 'heal', amt: Math.round(power), hp: p.hp, cells: ctx.cells, kind });
            break;
        }
        case 'energy': {
            const amt = ctx.line ? ctx.len + (ctx.len >= 4 ? 1 : 0) : ctx.len;
            const before = p.energy;
            p.energy = Math.max(before, Math.min(p.maxEnergy, before + amt));
            ev.push({ t: 'gain', what: 'energy', amt: p.energy - before, energy: p.energy, cells: ctx.cells, kind });
            break;
        }
        case 'scrap': {
            const amt = Math.max(1, Math.round(power * st.reward * L.scrapMult));
            st.loot.scrap += amt;
            st.stats.scrap += amt;
            ev.push({ t: 'gain', what: 'scrap', amt, total: st.loot.scrap, cells: ctx.cells, kind });
            break;
        }
        default:
    }
}

function hitEnemy(st, ev, e, dmg, { sym, crit = false, pierce = false, chain = 0 } = {}) {
    if (!e || e.hp <= 0) return;
    const rng = rngOf(st);
    let isCrit = false;
    if (crit && rng.chance(st.L.crit)) { dmg *= 2; isCrit = true; st.stats.crits++; }
    if (!pierce && e.armor > 0) dmg = Math.max(dmg * 0.25, dmg - e.armor);
    dmg = Math.max(1, Math.round(dmg));
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    const rest = dmg - absorbed;
    const dealt = Math.min(rest, e.hp);
    const overkill = rest - dealt;
    e.hp -= dealt;
    st.stats.dmgDealt += dealt;
    st._spinDmg = (st._spinDmg ?? 0) + dealt + absorbed;
    st._leech = (st._leech ?? 0) + dealt * st.L.mods.leech;
    ev.push({ t: 'hit', id: e.id, dmg, crit: isCrit, absorbed, hp: e.hp, shield: e.shield, sym, chain });
    if (e.hp <= 0) kill(st, ev, e, overkill);
    else checkPhase(st, ev, e);
}

function checkPhase(st, ev, e) {
    if (!e.phases) return;
    for (const p of e.phases) {
        if (p.done || e.hp / e.maxHp > p.at) continue;
        p.done = true;
        e.phase++;
        e.ai = p.ai.slice();
        e.aiI = 0;
        e.shield += Math.round(e.maxHp * 0.08);
        ev.push({ t: 'phase', id: e.id, n: e.phase, line: p.line, shield: e.shield });
    }
}

function kill(st, ev, e, overkill) {
    const rng = rngOf(st);
    e.hp = 0;
    st.stats.kills++;
    if (e.elite) st.stats.elites++;
    st.loot.xp += e.xp;
    const bounty = Math.round(e.bounty * st.L.scrapMult);
    st.loot.scrap += bounty;
    ev.push({ t: 'kill', id: e.id, boss: e.boss, elite: e.elite, bounty, xp: e.xp });
    if (st.L.spree) {
        st.player.energy = Math.max(st.player.energy, Math.min(st.player.maxEnergy, st.player.energy + 1));
        ev.push({ t: 'gain', what: 'energy', amt: 1, energy: st.player.energy, src: 'spree' });
    }
    if (!e.boss && alive(st).length && rng.chance(e.elite ? 0.5 : 0.1)) {
        const id = rng.pick(['nanite', 'battery', 'emp', 'coin', 'patch', 'battery', 'nanite']);
        st.boosters[id] = (st.boosters[id] ?? 0) + 1;
        st.loot.boosters.push(id);
        ev.push({ t: 'drop', id: e.id, booster: id });
    }
    if (e.affixes.includes('volatile')) {
        ev.push({ t: 'explode', id: e.id });
        hurtPlayer(st, ev, e.dmg * 1.5, null);
    }
    if (st.L.overkill && overkill > 0) {
        const next = currentTarget(st);
        if (next) {
            ev.push({ t: 'fire', sym: 'blade', kind: 'overkill', targets: [next.id], power: overkill, from: e.id });
            hitEnemy(st, ev, next, overkill, { sym: 'overkill', pierce: true });
        }
    }
}

function hurtPlayer(st, ev, dmg, src) {
    const p = st.player;
    if (p.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg * (1 - st.L.hardened)));
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    const rest = dmg - absorbed;
    p.hp = Math.max(0, p.hp - rest);
    st.stats.dmgTaken += rest;
    ev.push({ t: 'phit', dmg, absorbed, hp: p.hp, shield: p.shield, from: src ? src.id : -1 });
    if (absorbed > 0 && st.L.thorns > 0 && src && src.hp > 0) {
        ev.push({ t: 'fire', sym: 'shield', kind: 'thorns', targets: [src.id], power: absorbed * st.L.thorns });
        hitEnemy(st, ev, src, absorbed * st.L.thorns, { sym: 'thorns', pierce: true });
    }
    if (st.L.emergency && !p.emergencyUsed && p.hp > 0 && p.hp < p.maxHp * 0.3) {
        p.emergencyUsed = true;
        const amt = Math.round(p.maxHp * 0.4);
        p.shield += amt;
        ev.push({ t: 'gain', what: 'shield', amt, shield: p.shield, src: 'emergency' });
    }
}

function checkEnd(st, ev) {
    if (st.player.hp <= 0) {
        st.phase = 'lost';
        ev.push({ t: 'defeat' });
        return true;
    }
    if (!alive(st).length) {
        st.phase = 'won';
        st.stats.flawless = st.stats.dmgTaken === 0 ? 1 : 0;
        if (st.L.medic > 0) {
            const amt = Math.min(st.player.maxHp - st.player.hp, Math.round(st.player.maxHp * st.L.medic));
            st.player.hp += amt;
        }
        ev.push({ t: 'victory', loot: { ...st.loot }, hp: st.player.hp });
        return true;
    }
    return false;
}

// ------------------------------------------------------------------ enemies

function enemyPhase(st, ev) {
    const rng = rngOf(st);
    ev.push({ t: 'enemyPhase' });
    for (const e of st.enemies.slice()) {
        if (e.hp <= 0) continue;
        act(st, ev, e, rng);
        if (checkEnd(st, ev)) return;
    }
    for (const e of alive(st)) {
        if (e.affixes.includes('regen')) {
            const amt = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.08));
            if (amt > 0) { e.hp += amt; ev.push({ t: 'eheal', id: e.id, amt, hp: e.hp }); }
        }
        rollIntent(st, e, rng);
    }
    startTurn(st, ev, false);
}

function startTurn(st, ev, bonus) {
    const p = st.player;
    st.turn++;
    p.shield = st.L.memory ? Math.floor(p.shield / 2) : 0;
    if (!bonus) p.energy = Math.max(p.energy, Math.min(p.maxEnergy, p.energy + st.L.regen));
    p.freeNudges = st.L.freeNudges;
    st.phase = 'ready';
    for (const reel of st.reels) reel.jammed = false;
    st.overlay = [];
    st.expanded = [];
    ev.push({
        t: 'turn', turn: st.turn, energy: p.energy, shield: p.shield, bonus,
        overdrive: st.overdrive, locks: st.reels.map((r, c) => (r.lock > 0 ? c : -1)).filter((c) => c >= 0),
        intents: alive(st).map((e) => ({ id: e.id, intent: e.intent })),
    });
}

function rollIntent(st, e, rng) {
    const k = e.ai[e.aiI % e.ai.length];
    e.aiI++;
    const d = e.dmg;
    let it;
    switch (k) {
        case 'atk': it = { k: 'atk', dmg: d, hits: 1 }; break;
        case 'multi': it = { k: 'atk', dmg: d * 0.6, hits: e.boss ? 3 : 2 }; break;
        case 'heavy': it = { k: 'atk', dmg: d * 1.7, hits: 1, heavy: true }; break;
        case 'blast': it = { k: 'atk', dmg: d * 2.6, hits: 1, heavy: true }; break;
        case 'snipe': it = { k: 'atk', dmg: d * 2.2, hits: 1, heavy: true }; break;
        case 'crush': it = { k: 'atk', dmg: d * 2.2, hits: 1, heavy: true, crush: true }; break;
        case 'counter': it = { k: 'atk', dmg: Math.min(d * 2.2, Math.max(d, st.lastBest * 0.3)), hits: 1, counter: true }; break;
        case 'charge': it = { k: 'charge' }; break;
        case 'aim': it = { k: 'aim' }; break;
        case 'shield': it = { k: 'shield', all: true }; break;
        case 'shieldSelf': it = { k: 'shield', all: false }; break;
        case 'heal': it = { k: 'heal' }; break;
        case 'jam': it = { k: 'jam', n: 1 }; break;
        case 'jam2': it = { k: 'jam', n: 2 }; break;
        case 'glitch': it = { k: 'glitch', n: 2 }; break;
        case 'glitch3': it = { k: 'glitch', n: 3 }; break;
        case 'drain': it = { k: 'drain', n: 2, dmg: d * 0.5 }; break;
        case 'summon': it = { k: 'summon', n: 2 }; break;
        case 'tide': it = { k: 'tide', dmg: d * 0.6 }; break;
        case 'certainty': it = { k: 'certainty', n: 1 }; break;
        case 'zero': it = { k: 'zero', dmg: d * 0.8 }; break;
        default: it = { k: 'atk', dmg: d, hits: 1 };
    }
    if (it.dmg !== undefined) it.dmg = Math.max(1, Math.round(it.dmg));
    e.intent = it;
}

function lockReels(st, n, rng, fromRight = false) {
    const free = st.reels.map((r, c) => c).filter((c) => st.reels[c].lock === 0);
    const picks = fromRight ? free.slice(-n) : rng.shuffle(free).slice(0, n);
    for (const c of picks) st.reels[c].lock = 1;
    return picks.sort((a, b) => a - b);
}

function glitchStrips(st, spots, rng) {
    const out = [];
    for (const c of spots) {
        const reel = st.reels[c];
        const g = reel.strip.filter((s) => s === 'glitch').length;
        if (g >= Math.floor(reel.strip.length * 0.4)) continue;
        for (let tries = 0; tries < 8; tries++) {
            const i = rng.int(0, reel.strip.length - 1);
            const s = reel.strip[i];
            if (s === 'glitch' || s === 'core') continue;
            reel.strip[i] = 'glitch';
            out.push([c, i]);
            break;
        }
    }
    return out;
}

function act(st, ev, e, rng) {
    const it = e.intent;
    if (!it) return;
    ev.push({ t: 'eact', id: e.id, k: it.k, heavy: !!it.heavy });
    switch (it.k) {
        case 'atk':
            for (let h = 0; h < it.hits; h++) {
                hurtPlayer(st, ev, it.dmg, e);
                if (st.player.hp <= 0 || e.hp <= 0) break;
            }
            if (it.crush && st.tide) { st.tide = 0; }
            break;
        case 'charge':
        case 'aim':
            ev.push({ t: 'charge', id: e.id, k: it.k });
            break;
        case 'shield': {
            const who = it.all ? alive(st) : [e];
            for (const a of who) {
                const amt = Math.round(a.maxHp * (it.all ? 0.2 : 0.15));
                a.shield += amt;
                ev.push({ t: 'eshield', id: a.id, amt, shield: a.shield });
            }
            break;
        }
        case 'heal': {
            const hurt = alive(st).filter((a) => a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (hurt) {
                const amt = Math.min(hurt.maxHp - hurt.hp, Math.round(hurt.maxHp * 0.18));
                hurt.hp += amt;
                ev.push({ t: 'eheal', id: hurt.id, amt, hp: hurt.hp, from: e.id });
            }
            break;
        }
        case 'jam': {
            const reels = lockReels(st, Math.min(it.n, st.cols - 1), rng);
            if (reels.length) ev.push({ t: 'jam', id: e.id, reels });
            break;
        }
        case 'glitch': {
            const spots = [];
            for (let i = 0; i < it.n; i++) spots.push(rng.int(0, st.cols - 1));
            const done = glitchStrips(st, spots, rng);
            ev.push({ t: 'glitch', id: e.id, spots: done });
            break;
        }
        case 'certainty': {
            const spots = [];
            for (let c = 0; c < st.cols; c++) for (let i = 0; i < it.n; i++) spots.push(c);
            const done = glitchStrips(st, spots, rng);
            ev.push({ t: 'glitch', id: e.id, spots: done, certainty: true });
            break;
        }
        case 'drain': {
            const amt = Math.min(st.player.energy, it.n);
            st.player.energy -= amt;
            ev.push({ t: 'drain', id: e.id, amt, energy: st.player.energy });
            hurtPlayer(st, ev, it.dmg, e);
            break;
        }
        case 'summon': {
            const pool = e.bossId ? BOSSES[e.bossId].minions : ['mite'];
            for (let i = 0; i < it.n && alive(st).length < 5; i++) {
                const arch = pool.length ? pool[i % pool.length] : 'mite';
                const m = addEnemy(st, makeEnemy(rng, arch, st.x, { holo: st.chapter === 0 }));
                rollIntent(st, m, rng);
                ev.push({ t: 'summon', id: e.id, enemy: JSON.parse(JSON.stringify(m)) });
            }
            break;
        }
        case 'tide': {
            st.tide = Math.min(st.cols - 1, st.tide + 1);
            const reels = lockReels(st, st.tide, rng, true);
            if (reels.length) ev.push({ t: 'jam', id: e.id, reels, tide: true });
            hurtPlayer(st, ev, it.dmg, e);
            break;
        }
        case 'zero': {
            const reels = lockReels(st, Math.max(1, st.cols - 2), rng);
            if (reels.length) ev.push({ t: 'jam', id: e.id, reels, zero: true });
            hurtPlayer(st, ev, it.dmg, e);
            break;
        }
        default:
    }
}

/** Describe an intent for the UI: { icon, text, value }. */
export function intentLabel(it) {
    if (!it) return { icon: 'none', text: '' };
    switch (it.k) {
        case 'atk': return { icon: it.heavy ? 'heavy' : 'atk', value: it.hits > 1 ? `${it.dmg}×${it.hits}` : `${it.dmg}`, text: it.counter ? 'Counter-spin: mirrors your best line' : it.crush ? 'Crushing blow' : it.heavy ? 'Heavy attack' : it.hits > 1 ? 'Multi-attack' : 'Attack' };
        case 'charge': return { icon: 'charge', value: '', text: 'Charging a blast' };
        case 'aim': return { icon: 'aim', value: '', text: 'Taking aim' };
        case 'shield': return { icon: 'eshield', value: '', text: it.all ? 'Shields its squad' : 'Shields itself' };
        case 'heal': return { icon: 'eheal', value: '', text: 'Repairs an ally' };
        case 'jam': return { icon: 'jam', value: `${it.n}`, text: `Jams ${it.n} reel${it.n > 1 ? 's' : ''} next spin` };
        case 'glitch': return { icon: 'glitch', value: `${it.n}`, text: `Writes ${it.n} Glitches into your strips` };
        case 'drain': return { icon: 'drain', value: `${it.n}`, text: `Drains ${it.n} energy and hits for ${it.dmg}` };
        case 'summon': return { icon: 'summon', value: '', text: 'Calls reinforcements' };
        case 'tide': return { icon: 'jam', value: `${it.dmg}`, text: 'The tide rises: locks reels from the right' };
        case 'certainty': return { icon: 'glitch', value: '', text: 'CERTAINTY: a Glitch on every strip' };
        case 'zero': return { icon: 'jam', value: `${it.dmg}`, text: 'ZERO VARIANCE: jams most of your reels' };
        default: return { icon: 'none', text: '' };
    }
}

/** Result summary after a fight (for the profile). */
export function combatResult(st) {
    return {
        won: st.phase === 'won', hp: st.player.hp, maxHp: st.player.maxHp,
        loot: st.loot, stats: st.stats, boostersUsed: st.boostersUsed, turns: st.turn,
    };
}
