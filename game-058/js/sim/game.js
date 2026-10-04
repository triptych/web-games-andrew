/**
 * game.js — the rules of Bumble Basket. Pure: no three.js, no DOM, no
 * Math.random. Every action applies instantly and returns a list of events
 * that the view plays back as animation.
 *
 * Board: rows × cols cells, row 0 at the far (top) edge. Gravity pulls
 * fruit toward the last row; new fruit drops in at row 0. Fixed cells
 * (holes, leaf piles, frosted fruit) are skipped over, so no column stalls.
 *
 * Event types:
 *   harvest { items:[{id,r,c,fruit}], source:'chain'|'honey'|'bomb', links? }
 *   leaf    { r, c, left }            a layer raked off a pile
 *   thaw    { r, c, id, left }        a frost layer melted
 *   paint   { items:[{id,r,c,colour}], r, c }
 *   golden  { r, c, fruit }           a golden fruit grew where a trail ended
 *   settle  { moves:[{id,r,c,fromR}], spawns:[{fruit,r,c,fromR}] }
 *   jar     { index, full }           a jar filled (full) or changed target
 *   shuffle { items:[{id,r,c}] }
 *   basket  { n }                     Picnic: a basket filled
 *   rainbow {}                        Rainbow Wings armed
 *   end     { status }
 */

import {
    KINDS, MASKS, SIZE_IDS, JARS, MAX_CHARGES, MIN_CHAIN, GOLDEN_CHAIN,
    CONTINUE_MOVES, STAR2_FRAC, STAR3_FRAC, SCORE,
    PICNIC_BASKET, levelSenses,
} from '../config.js';
import { makeRng } from './rng.js';
import { hasMove, neighbours, DIRS } from './search.js';

export const ROWS = 8;
export const COLS = 7;

/** Turn a level's kinds list into spawnable variants. */
export function buildPool(spec) {
    const sizes = spec.sizes ?? ['M'];
    const kinds = spec.kinds.map(k => {
        const [id, nCol] = Array.isArray(k) ? k : [k, 1];
        const colours = KINDS[id].colours.slice(0, Math.max(1, Math.min(nCol, KINDS[id].colours.length)));
        return { kind: id, colours };
    });
    return { kinds, sizes };
}

export class Game {
    /**
     * @param spec  a LEVELS entry, or a Picnic spec ({ picnic:true, ... })
     * @param opts  { seed, senses? }
     */
    constructor(spec, opts = {}) {
        this.spec = spec;
        this.rows = ROWS;
        this.cols = COLS;
        this.rng = makeRng(opts.seed ?? 1);
        this.senses = opts.senses ?? levelSenses(spec);
        this.picnic = !!spec.picnic;
        this.pool = buildPool(spec);
        this._nextId = 1;

        this.moves = this.picnic ? Infinity : spec.moves;
        this.movesUsed = 0;
        this.score = 0;
        this.status = 'playing';
        this.continued = false;
        this.wild = false;               // Rainbow Wings armed for the next trail
        this.stars = 0;
        this.leftoverBonus = 0;
        this.found = new Set();          // natural variants harvested (album)
        this.stats = { chains: 0, longest: 0, golden: 0, harvested: 0, powers: 0, shuffles: 0 };
        this.basket = 0;                 // Picnic baskets filled
        this.basketFill = 0;

        this.goals = (spec.goals ?? []).map(g => ({ ...g, have: 0 }));
        this.jars = this.senses.map(sense => ({ sense, power: JARS[sense].power, need: JARS[sense].need, fill: 0, charges: 0, target: null }));

        this._buildBoard();
        for (let i = 0; i < this.jars.length; i++) this._newJarTarget(i);
    }

    // ------------------------------------------------------------
    // Board
    // ------------------------------------------------------------

    _buildBoard() {
        const mask = MASKS[this.spec.mask ?? 'full'];
        this.cells = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({ hole: mask[r][c] !== '.', leaf: 0, fruit: null });
            }
            this.cells.push(row);
        }
        for (const [r, c, n] of this.spec.leaves ?? []) {
            if (!this.cells[r][c].hole) this.cells[r][c].leaf = n ?? 1;
        }
        const frost = new Map((this.spec.frost ?? []).map(([r, c, n]) => [r * this.cols + c, n ?? 1]));
        for (let tries = 0; tries < 60; tries++) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.cells[r][c];
                    if (cell.hole || cell.leaf) { cell.fruit = null; continue; }
                    cell.fruit = this._spawnFruit();
                    const f = frost.get(r * this.cols + c);
                    if (f) cell.fruit.frost = f;
                }
            }
            if (hasMove(this, false)) break;
        }
    }

    _spawnFruit() {
        const k = this.rng.pick(this.pool.kinds);
        const colour = this.rng.pick(k.colours);
        const size = this.rng.pick(this.pool.sizes);
        return this._makeFruit(k.kind, colour, size);
    }

    _makeFruit(kind, colour, size, golden = false) {
        return { id: this._nextId++, kind, colour, size, family: KINDS[kind].family, golden, frost: 0 };
    }

    inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }

    /** A fruit that can be part of a trail. */
    selectable(r, c) {
        if (!this.inBounds(r, c)) return false;
        const f = this.cells[r][c].fruit;
        return !!f && !f.frost;
    }

    /** Fixed cells don't move under gravity: holes, leaf piles, frosted fruit. */
    _fixed(cell) {
        return cell.hole || cell.leaf > 0 || (cell.fruit && cell.fruit.frost > 0);
    }

    forEachFruit(fn) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const f = this.cells[r][c].fruit;
                if (f) fn(f, r, c);
            }
        }
    }

    // ------------------------------------------------------------
    // Links
    // ------------------------------------------------------------

    /** Traits the two fruit share that the bee can sense. */
    linkTraits(a, b, wild = this.wild) {
        if (!a || !b) return [];
        const out = [];
        if (a.golden || b.golden) out.push('golden');
        for (const s of this.senses) {
            if (s === 'colour' && (a.golden || b.golden)) continue;
            if (a[s] === b[s]) out.push(s);
        }
        if (!out.length && wild) out.push('rainbow');
        return out;
    }

    canLink(a, b, wild = this.wild) {
        if (!a || !b) return false;
        if (wild || a.golden || b.golden) return true;
        for (const s of this.senses) if (a[s] === b[s]) return true;
        return false;
    }

    static adjacent(a, b) {
        return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
    }

    /** Can the trail `path` be extended with (r, c)? */
    canExtend(path, r, c) {
        if (!this.selectable(r, c)) return false;
        if (path.some(([pr, pc]) => pr === r && pc === c)) return false;
        if (!path.length) return true;
        const last = path[path.length - 1];
        if (!Game.adjacent(last, [r, c])) return false;
        return this.canLink(this.cells[last[0]][last[1]].fruit, this.cells[r][c].fruit);
    }

    validChain(path) {
        if (!Array.isArray(path) || path.length < MIN_CHAIN) return false;
        const seen = new Set();
        for (let i = 0; i < path.length; i++) {
            const [r, c] = path[i];
            if (!this.selectable(r, c)) return false;
            const k = r * this.cols + c;
            if (seen.has(k)) return false;
            seen.add(k);
            if (i > 0) {
                const [pr, pc] = path[i - 1];
                if (!Game.adjacent([pr, pc], [r, c])) return false;
                if (!this.canLink(this.cells[pr][pc].fruit, this.cells[r][c].fruit)) return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------
    // Goals
    // ------------------------------------------------------------

    static fruitMatches(goal, f) {
        switch (goal.t) {
            case 'kind':   return f.kind === goal.v;
            case 'colour': return !f.golden && f.colour === goal.v;
            case 'size':   return f.size === goal.v;
            case 'family': return f.family === goal.v;
            case 'any':    return true;
            default:       return false;
        }
    }

    /** How much a set of cells would advance unfinished goals (bot / hints). */
    goalValue(path) {
        let v = 0;
        for (const g of this.goals) {
            if (g.have >= g.n) continue;
            if (g.t === 'golden') { if (path.length >= GOLDEN_CHAIN) v += 6; continue; }
            if (g.t === 'leaf' || g.t === 'frost') {
                v += this._obstaclesTouched(path, g.t) * 4;
                continue;
            }
            let m = 0;
            for (const [r, c] of path) {
                const f = this.cells[r][c].fruit;
                if (f && Game.fruitMatches(g, f)) m++;
            }
            v += Math.min(m, g.n - g.have);
        }
        return v;
    }

    _obstaclesTouched(path, type) {
        const hit = new Set();
        for (const [r, c] of path) {
            for (const [nr, nc] of neighbours(this, r, c)) {
                const cell = this.cells[nr][nc];
                if (type === 'leaf' && cell.leaf > 0) hit.add(nr * this.cols + nc);
                if (type === 'frost' && cell.fruit && cell.fruit.frost > 0) hit.add(nr * this.cols + nc);
            }
        }
        return hit.size;
    }

    goalsDone() {
        return this.goals.length > 0 && this.goals.every(g => g.have >= g.n);
    }

    _countHarvest(fruits) {
        for (const f of fruits) {
            for (const g of this.goals) if (Game.fruitMatches(g, f)) g.have = Math.min(g.n, g.have + 1);
            if (!f.golden && KINDS[f.kind].colours.includes(f.colour)) this.found.add(`${f.kind}|${f.colour}|${f.size}`);
        }
        this.stats.harvested += fruits.length;
    }

    _bumpGoal(t, n = 1) {
        for (const g of this.goals) if (g.t === t) g.have = Math.min(g.n, g.have + n);
    }

    // ------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------

    /** Harvest a trail. Returns events, or null if the trail is not legal. */
    playChain(path) {
        if (this.status !== 'playing' || this.movesLeft() <= 0) return null;
        if (!this.validChain(path)) return null;
        const events = [];
        const links = [];
        for (let i = 1; i < path.length; i++) {
            const a = this.cells[path[i - 1][0]][path[i - 1][1]].fruit;
            const b = this.cells[path[i][0]][path[i][1]].fruit;
            links.push(this.linkTraits(a, b));
        }
        const usedWild = this.wild;
        this.wild = false;
        this.movesUsed++;
        this.stats.chains++;
        this.stats.longest = Math.max(this.stats.longest, path.length);

        const items = path.map(([r, c]) => ({ id: this.cells[r][c].fruit.id, r, c, fruit: this.cells[r][c].fruit }));
        const n = path.length;
        this.score += SCORE.perChainSq * n * n;
        events.push({ type: 'harvest', items, source: 'chain', links, wild: usedWild });
        this._removeFruits(items);

        // Golden fruit grows where the trail ended.
        let golden = null;
        if (n >= GOLDEN_CHAIN) {
            const last = items[items.length - 1];
            const [r, c] = path[path.length - 1];
            golden = this._makeFruit(last.fruit.kind, last.fruit.colour, last.fruit.size, true);
            this.cells[r][c].fruit = golden;
            this.stats.golden++;
            this._bumpGoal('golden');
            events.push({ type: 'golden', r, c, fruit: golden });
        }

        this._afterHarvest(path, items, events);
        return events;
    }

    /** Use a jar's power-up at (r, c). Rainbow needs no target. */
    usePower(jarIndex, r, c) {
        if (this.status !== 'playing') return null;
        const jar = this.jars[jarIndex];
        if (!jar || jar.charges <= 0) return null;
        const events = [];

        if (jar.power === 'rainbow') {
            if (this.wild || this.movesLeft() <= 0) return null;
            this.wild = true;
            jar.charges--;
            this.stats.powers++;
            events.push({ type: 'rainbow' });
            return events;
        }
        if (!this.inBounds(r, c) || this.cells[r][c].hole) return null;
        const target = this.cells[r][c].fruit;

        if (jar.power === 'honey') {
            if (!target) return null;
            const items = [];
            const thaw = [];
            this.forEachFruit((f, fr, fc) => {
                if (f.kind !== target.kind) return;
                if (f.frost) thaw.push([fr, fc]);
                else items.push({ id: f.id, r: fr, c: fc, fruit: f });
            });
            if (!items.length) return null;
            jar.charges--;
            this.stats.powers++;
            this.score += SCORE.powerFruit * items.length;
            events.push({ type: 'harvest', items, source: 'honey', r, c });
            this._removeFruits(items);
            for (const [fr, fc] of thaw) this._thaw(fr, fc, events);
            this._afterHarvest(items.map(i => [i.r, i.c]), items, events, { noObstacles: true });
            return events;
        }

        if (jar.power === 'paint') {
            if (!target || target.golden) return null;
            const items = [];
            for (const [nr, nc] of neighbours(this, r, c)) {
                const f = this.cells[nr][nc].fruit;
                if (!f || f.golden || f.frost || f.colour === target.colour) continue;
                f.colour = target.colour;
                items.push({ id: f.id, r: nr, c: nc, colour: target.colour });
            }
            jar.charges--;
            this.stats.powers++;
            events.push({ type: 'paint', items, r, c, colour: target.colour });
            this._ensureMove(events);
            this._checkEnd(events);
            return events;
        }

        if (jar.power === 'bomb') {
            const items = [];
            const area = [[r, c], ...neighbours(this, r, c)];
            for (const [nr, nc] of area) {
                const f = this.cells[nr][nc].fruit;
                if (f && !f.frost) items.push({ id: f.id, r: nr, c: nc, fruit: f });
            }
            const hasObstacle = area.some(([nr, nc]) => this.cells[nr][nc].leaf > 0 || (this.cells[nr][nc].fruit?.frost > 0));
            if (!items.length && !hasObstacle) return null;
            jar.charges--;
            this.stats.powers++;
            this.score += SCORE.powerFruit * items.length;
            events.push({ type: 'harvest', items, source: 'bomb', r, c });
            this._removeFruits(items);
            // The blast reaches obstacles in its own area as well as next to it.
            this._afterHarvest(area, items, events);
            return events;
        }
        return null;
    }

    /** Out of moves: take five more (once per attempt, caps stars at 1). */
    continueGame() {
        if (this.status !== 'lost' || this.continued) return false;
        this.continued = true;
        this.moves += CONTINUE_MOVES;
        this.status = 'playing';
        return true;
    }

    movesLeft() { return this.moves - this.movesUsed; }

    // ------------------------------------------------------------
    // Resolution
    // ------------------------------------------------------------

    _removeFruits(items) {
        const fruits = [];
        for (const it of items) {
            const cell = this.cells[it.r][it.c];
            if (cell.fruit && cell.fruit.id === it.id) {
                if (cell.fruit.golden) this.score += SCORE.golden;
                fruits.push(cell.fruit);
                cell.fruit = null;
            }
        }
        this._countHarvest(fruits);
        this._fillJars(fruits);
        if (this.picnic) this.basketFill += fruits.length;
    }

    /**
     * After fruit is removed: rake leaves and thaw frost next to the cells in
     * `area` (once per obstacle), drop fruit, refill, re-target jars, end check.
     */
    _afterHarvest(area, items, events, opts = {}) {
        if (!opts.noObstacles) {
            const hit = new Set();
            for (const [r, c] of area) {
                for (const [nr, nc] of [[r, c], ...neighbours(this, r, c)]) hit.add(nr * this.cols + nc);
            }
            for (const k of hit) {
                const r = Math.floor(k / this.cols), c = k % this.cols;
                const cell = this.cells[r][c];
                if (cell.leaf > 0) {
                    cell.leaf--;
                    events.push({ type: 'leaf', r, c, left: cell.leaf });
                    if (cell.leaf === 0) this._bumpGoal('leaf');
                } else if (cell.fruit && cell.fruit.frost > 0) {
                    this._thaw(r, c, events);
                }
            }
        }
        this._settle(events);
        if (this.picnic) {
            while (this.basketFill >= PICNIC_BASKET) {
                this.basketFill -= PICNIC_BASKET;
                this.basket++;
                this._growPicnicPool();
                events.push({ type: 'basket', n: this.basket });
            }
        }
        for (let i = 0; i < this.jars.length; i++) {
            const jar = this.jars[i];
            if (!this._targetOnBoard(jar)) { this._newJarTarget(i); events.push({ type: 'jar', index: i, full: false }); }
        }
        this._ensureMove(events);
        this._checkEnd(events);
    }

    _thaw(r, c, events) {
        const f = this.cells[r][c].fruit;
        if (!f || !f.frost) return;
        f.frost--;
        events.push({ type: 'thaw', r, c, id: f.id, left: f.frost });
        if (f.frost === 0) this._bumpGoal('frost');
    }

    /** Gravity + refill, column by column, skipping fixed cells. */
    _settle(events) {
        const moves = [], spawns = [];
        for (let c = 0; c < this.cols; c++) {
            // Movable slots, bottom to top.
            const slots = [];
            for (let r = this.rows - 1; r >= 0; r--) {
                if (!this._fixed(this.cells[r][c])) slots.push(r);
            }
            const fruits = [];
            for (const r of slots) {
                const f = this.cells[r][c].fruit;
                if (f) fruits.push({ f, r });
                this.cells[r][c].fruit = null;
            }
            let i = 0;
            for (; i < fruits.length; i++) {
                const r = slots[i];
                this.cells[r][c].fruit = fruits[i].f;
                if (fruits[i].r !== r) moves.push({ id: fruits[i].f.id, r, c, fromR: fruits[i].r });
            }
            let k = 0;
            for (; i < slots.length; i++, k++) {
                const r = slots[i];
                const f = this._spawnFruit();
                this.cells[r][c].fruit = f;
                spawns.push({ fruit: f, r, c, fromR: -1 - k });
            }
        }
        events.push({ type: 'settle', moves, spawns });
    }

    _ensureMove(events) {
        if (hasMove(this, false)) return;
        // Shuffle the movable fruit until a trail exists; failing that, reroll them.
        const cells = [];
        this.forEachFruit((f, r, c) => { if (!f.frost) cells.push([r, c]); });
        for (let tries = 0; tries < 40; tries++) {
            const fruits = cells.map(([r, c]) => this.cells[r][c].fruit);
            this.rng.shuffle(fruits);
            cells.forEach(([r, c], i) => { this.cells[r][c].fruit = fruits[i]; });
            if (tries > 20) {
                for (const [r, c] of cells) if (!this.cells[r][c].fruit.golden) this.cells[r][c].fruit = this._spawnFruit();
            }
            if (hasMove(this, false)) break;
        }
        this.stats.shuffles++;
        events.push({ type: 'shuffle', items: cells.map(([r, c]) => ({ id: this.cells[r][c].fruit.id, r, c, fruit: this.cells[r][c].fruit })) });
    }

    _checkEnd(events) {
        if (this.picnic || this.status !== 'playing') return;
        if (this.goalsDone()) {
            this.status = 'won';
            const left = Math.max(0, this.movesLeft());
            this.leftoverBonus = left * SCORE.leftover;
            this.score += this.leftoverBonus;
            const frac = left / this.spec.moves;
            this.stars = this.continued ? 1 : frac >= STAR3_FRAC ? 3 : frac >= STAR2_FRAC ? 2 : 1;
            events.push({ type: 'end', status: 'won' });
            return;
        }
        if (this.movesLeft() <= 0) {
            // Charged non-rainbow power-ups can still finish the job.
            const canPower = this.jars.some(j => j.charges > 0 && j.power !== 'rainbow');
            if (!canPower) {
                this.status = 'lost';
                events.push({ type: 'end', status: 'lost' });
            }
        }
    }

    // ------------------------------------------------------------
    // Jars
    // ------------------------------------------------------------

    static jarMatches(jar, f) {
        if (jar.sense === 'colour' && f.golden) return false;
        return f[jar.sense] === jar.target;
    }

    _fillJars(fruits) {
        for (let i = 0; i < this.jars.length; i++) {
            const jar = this.jars[i];
            if (jar.target == null) continue;
            let n = 0;
            for (const f of fruits) if (Game.jarMatches(jar, f)) n++;
            if (!n) continue;
            if (jar.charges >= MAX_CHARGES) { jar.fill = jar.need; continue; }
            jar.fill += n;
            while (jar.fill >= jar.need && jar.charges < MAX_CHARGES) {
                jar.fill -= jar.need;
                jar.charges++;
                jar.justFilled = true;
                this._newJarTarget(i);
            }
            if (jar.charges >= MAX_CHARGES) jar.fill = Math.min(jar.fill, jar.need);
        }
    }

    _targetOnBoard(jar) {
        if (jar.target == null) return false;
        let found = false;
        this.forEachFruit(f => { if (!found && Game.jarMatches(jar, f)) found = true; });
        return found;
    }

    /** Pick a new set for a jar from what is on the blanket, weighted by count. */
    _newJarTarget(i) {
        const jar = this.jars[i];
        const counts = new Map();
        this.forEachFruit(f => {
            if (f.golden) return;
            const v = f[jar.sense];
            counts.set(v, (counts.get(v) ?? 0) + 1);
        });
        const entries = [...counts.entries()].filter(([v]) => v !== jar.target || counts.size === 1);
        if (!entries.length) return;
        const total = entries.reduce((s, [, n]) => s + n, 0);
        let x = this.rng() * total;
        for (const [v, n] of entries) {
            x -= n;
            if (x <= 0) { jar.target = v; return; }
        }
        jar.target = entries[entries.length - 1][0];
    }

    /** Clear and return which jars just filled (for the HUD's sparkle). */
    takeFilledJars() {
        const out = [];
        this.jars.forEach((j, i) => { if (j.justFilled) { out.push(i); j.justFilled = false; } });
        return out;
    }

    // ------------------------------------------------------------
    // Picnic
    // ------------------------------------------------------------

    _growPicnicPool() {
        const extra = this.spec.extraKinds ?? [];
        const next = extra.find(k => !this.pool.kinds.some(p => p.kind === k.kind));
        if (next && this.pool.kinds.length < (this.spec.maxKinds ?? 10)) this.pool.kinds.push(next);
    }

    // ------------------------------------------------------------
    // Snapshot (tests / debugging)
    // ------------------------------------------------------------

    fruitCount() {
        let n = 0;
        this.forEachFruit(() => n++);
        return n;
    }

    playableCells() {
        let n = 0;
        for (const row of this.cells) for (const cell of row) if (!cell.hole && !cell.leaf) n++;
        return n;
    }
}

export { DIRS };
