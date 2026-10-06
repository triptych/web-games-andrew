// The pilot: an autoplayer that plays SCRAPWRIGHT through the same Game API as the UI — walking
// with directions, pressing A, answering prompts, choosing battle actions. dev/simtest.mjs uses it
// to prove the story can be finished and to balance the Forgemasters; the title screen's attract
// mode could use it too. It is a careful but unimaginative player: it follows the objective,
// grinds when underlevelled, heals when hurt, catches new bots, crafts and shops.

import { MAPS } from './data/maps.js';
import { SPECIES } from './dex.js';
import { MOVES } from './data/moves.js';
import { ITEMS, RECIPES, BLUEPRINTS } from './data/items.js';
import { scoreMoves, expectedFrac } from './ai.js';
import { calcStats, evolutionTarget } from './unit.js';
import { effAgainst } from './data/types.js';
import { DIRS, SOLID, isDigit } from './world.js';

/** Rough level the team should have before each story step. */
const NEED = { 0: 1, 1: 1, 2: 5, 3: 13, 4: 13, 5: 15, 6: 16, 7: 20, 8: 20, 9: 26, 10: 26, 11: 31, 12: 31, 13: 36, 14: 34, 15: 35, 16: 36, 17: 41, 18: 41, 19: 46, 20: 45, 21: 50, 22: 53, 23: 54, 24: 57, 25: 57 };
const DIR_LIST = ['up', 'down', 'left', 'right'];
const OUT = { up: 'down', down: 'up', left: 'right', right: 'left' };

export class Pilot {
    constructor(game, opts = {}) {
        this.g = game;
        this.log = opts.log || (() => {});
        this.verbose = !!opts.verbose;
        this.banned = new Set();
        this.banSig = '';
        this.actions = 0;
        this.grindDir = 0;
        this.catchTries = 0;
        this.healUses = 0;
        this.lastSig = '';
        this.stall = 0;
        this.stats = { battles: 0, wins: 0, losses: 0, caught: 0, grindSteps: 0, blackouts: [] };
        this.wantDataLink = true;
        this.visitedLocker = 0;
        this.extra = 0;            // grind further after losses, as a person would
    }

    get st() { return this.g.state; }
    get w() { return this.g.world; }

    /** One decision. Returns false when the game is finished. */
    tick() {
        const g = this.g;
        this.actions++;
        if (g.battle) { this.battleTick(); return true; }
        if (g.pending) { this.answer(g.pending); return true; }
        if (g.busy()) { g.update(0.3, {}); return true; }
        if (this.st.story >= 25) return false;
        this.worldTick();
        return true;
    }

    run(maxActions = 400000) {
        while (this.actions < maxActions) {
            if (!this.tick()) return true;
            const sig = `${this.st.story}|${this.st.seals}|${this.teamLevel()}|${this.st.party.length}`;
            if (sig !== this.lastSig) { this.lastSig = sig; this.stall = 0; } else if (++this.stall > 60000) { this.log(`STUCK at story ${this.st.story} on ${this.w.id} (${this.w.player.x},${this.w.player.y})`); return false; }
        }
        return false;
    }

    need() { return (NEED[this.st.story] || 1) + this.extra; }

    teamLevel() {
        const lv = this.st.party.map((u) => u.lv).sort((a, b) => b - a);
        const top = lv.slice(0, 3);
        return top.length ? Math.floor(top.reduce((a, b) => a + b, 0) / top.length) : 0;
    }

    // ================================================================== prompts
    answer(p) {
        const g = this.g;
        switch (p.type) {
            case 'say': case 'evolved': case 'ending': g.respond(null); break;
            case 'ask': g.respond(0); break;
            case 'evolve': g.respond(true); break;
            case 'repair': g.respond(2); break;
            case 'learn': g.respond(this.learnSlot(g.unitByUid(p.uid), p.move)); break;
            case 'shop': this.shop(p); g.respond(null); break;
            case 'bench': this.bench(); g.respond(null); break;
            case 'locker': this.locker(); this.visitedLocker = this.w; g.respond(null); break;
            default: g.respond(null);
        }
    }

    moveValue(u, id) {
        const m = MOVES[id];
        if (m.cat === 'U') return 25;
        const stab = SPECIES[u.sp].types.includes(m.type) ? 1.5 : 1;
        const st = calcStats(u);
        const ratio = m.cat === 'K' ? st.atk / Math.max(1, st.spa) : st.spa / Math.max(1, st.atk);
        const multi = m.fx.find((f) => f.k === 'multi') ? 3 : 1;
        const bad = m.fx.some((f) => f.k === 'recharge' || f.k === 'boom') ? 0.5 : 1;
        return m.pow * multi * (m.acc ? m.acc / 100 : 1.05) * stab * Math.min(1.4, Math.max(0.6, ratio)) * bad;
    }
    learnSlot(u, move) {
        if (!u) return -1;
        const vals = u.moves.map((m) => this.moveValue(u, m.id));
        // Keep at most one utility technique.
        const utils = u.moves.map((m, i) => (MOVES[m.id].cat === 'U' ? i : -1)).filter((i) => i >= 0);
        if (utils.length > 1) vals[utils[1]] = 1;
        const nv = this.moveValue(u, move);
        let lo = 0;
        vals.forEach((v, i) => { if (v < vals[lo]) lo = i; });
        // Don't throw away the only coverage of a type.
        return nv > vals[lo] + 5 ? lo : -1;
    }

    shop(p) {
        const g = this.g;
        const stock = p.stock;
        const heal = ['full-rebuild', 'overhaul-kit', 'rivet-kit', 'patch-kit'].find((id) => stock.includes(id));
        const spike = ['tesla-spike', 'brass-spike', 'reboot-spike'].find((id) => stock.includes(id));
        const buyTo = (id, n) => { while (id && (this.st.bag[id] || 0) < n && this.st.cogs >= ITEMS[id].price + 1500) g.buy(id, 1); };
        buyTo(heal, 10);
        buyTo('restart-cell', stock.includes('restart-cell') ? 4 : 0);
        buyTo(spike, 8);
        buyTo('universal-solvent', stock.includes('universal-solvent') ? 3 : 0);
    }

    bench() {
        const g = this.g;
        const want = { 'reboot-spike': 10, 'brass-spike': 6, 'rivet-kit': 6, 'patch-kit': 6, 'overhaul-kit': 6, 'restart-cell': 3, 'learning-chip': 1 };
        RECIPES.forEach((r, i) => {
            const target = want[r.out] ?? 0;
            let guard = 0;
            while ((this.st.bag[r.out] || 0) < target && g.canCraft(r) && guard++ < 20) g.craft(i);
        });
        // Kits for evolutions the team is waiting on.
        for (const u of this.st.party) {
            const e = SPECIES[u.sp].evolves;
            if (!e || e.k !== 'kit' || this.st.bag[e.item]) continue;
            const ri = RECIPES.findIndex((r) => r.out === e.item);
            if (ri >= 0 && g.canCraft(RECIPES[ri])) g.craft(ri);
        }
        for (const bp of Object.keys(BLUEPRINTS)) if (g.canBuild(bp)) g.build(bp);
    }

    /** Keep the six strongest bots (with some type spread) in the team. */
    locker() {
        const g = this.g;
        const all = [...this.st.party, ...this.st.locker];
        const power = (u) => u.lv * 10 + SPECIES[u.sp].total / 6;
        all.sort((a, b) => power(b) - power(a));
        const pick = [], types = new Set();
        for (const u of all) {
            if (pick.length >= 6) break;
            const t = SPECIES[u.sp].types[0];
            if (types.has(t) && all.length - all.indexOf(u) > 6 - pick.length && pick.length >= 3) continue;
            pick.push(u); types.add(t);
        }
        for (const u of all) if (pick.length < 6 && !pick.includes(u)) pick.push(u);
        this.st.party.length = 0; this.st.party.push(...pick);
        this.st.locker.length = 0; this.st.locker.push(...all.filter((u) => !pick.includes(u)));
        void g;
    }

    // ================================================================== battles
    battleTick() {
        const g = this.g, b = g.battle;
        if (b.over) {
            this.stats.battles++;
            if (b.result === 'win' || b.result === 'caught') this.stats.wins++;
            if (b.result === 'caught') this.stats.caught++;
            if (b.result === 'lose') { this.stats.losses++; this.extra = Math.min(6, this.extra + 1); this.stats.blackouts.push(`${this.w.id}@story${this.st.story}`); }
            this.catchTries = 0; this.healUses = 0;
            g.closeBattle();
            this.afterBattle();
            return;
        }
        if (b.need === 'switch') { g.battleChoose({ k: 'switch', i: this.bestSwitch(b) }); return; }
        g.battleChoose(this.chooseBattle(b));
    }

    bestSwitch(b, exclude = -1) {
        const opp = b.act(1);
        let best = -1, bs = -1e9;
        b.side[0].units.forEach((u, i) => {
            if (u.hp <= 0 || i === exclude || i === b.side[0].active) return;
            let off = 0;
            for (const m of u.moves) { const mv = MOVES[m.id]; if (mv.cat !== 'U' && m.pp > 0) off = Math.max(off, effAgainst(mv.type, SPECIES[opp.sp].types) * (SPECIES[u.sp].types.includes(mv.type) ? 1.5 : 1) * mv.pow); }
            let def = 1;
            for (const t of SPECIES[opp.sp].types) def = Math.max(def, effAgainst(t, SPECIES[u.sp].types));
            const s = off + u.lv * 3 + (u.hp / calcStats(u).hp) * 40 - def * 30;
            if (s > bs) { bs = s; best = i; }
        });
        return best < 0 ? b.side[0].units.findIndex((u) => u.hp > 0) : best;
    }

    chooseBattle(b) {
        const u = b.act(0), foe = b.act(1);
        const frac = u.hp / calcStats(u).hp;
        const ffrac = foe.hp / calcStats(foe).hp;
        const scores = scoreMoves(b, 0);
        const best = scores.length ? scores.reduce((a, x) => (x.score > a.score ? x : a), scores[0]) : null;
        // Catch something new in the wild.
        if (b.kind === 'wild' && b.canCatch && !this.st.owned[foe.sp] && this.st.party.length + this.st.locker.length < 200) {
            const spike = ['tesla-spike', 'brass-spike', 'reboot-spike', 'magna-spike', 'fathom-spike'].find((id) => (this.st.bag[id] || 0) > 0);
            if (spike && this.catchTries < 8) {
                if (ffrac <= 0.45 || (SPECIES[foe.sp].catchRate >= 150 && ffrac <= 0.8)) { this.catchTries++; return { k: 'spike', id: spike }; }
                // Weaken without knocking it out.
                const gentle = scores.filter((x) => MOVES[x.id].cat !== 'U' && x.score > 0 && expectedFrac(b, 0, MOVES[x.id]) < 0.8).sort((a, c) => c.score - a.score)[0];
                if (gentle) return { k: 'move', i: gentle.i };
            }
        }
        // Heal in tough battles.
        if (b.kind === 'trainer' && frac < 0.3 && this.healUses < 4 && best && best.score < 100) {
            const heal = ['full-rebuild', 'overhaul-kit', 'rivet-kit', 'patch-kit'].find((id) => (this.st.bag[id] || 0) > 0);
            if (heal) { this.healUses++; return { k: 'item', id: heal }; }
        }
        // Revive a fallen heavy hitter in a leader fight.
        if (b.kind === 'trainer' && b.side[1].ai >= 2 && this.healUses < 4 && (this.st.bag['restart-cell'] || 0) > 0) {
            const dead = b.side[0].units.findIndex((x) => x.hp <= 0 && x.lv >= this.teamLevel() - 2);
            if (dead >= 0 && frac > 0.5) { this.healUses++; return { k: 'item', id: 'restart-cell', target: dead }; }
        }
        // Switch out of a hopeless matchup.
        if (best && best.score < 12 && b.alive(0).length > 1 && !b.side[0].vol.justIn) {
            const s = this.bestSwitch(b);
            if (s >= 0 && s !== b.side[0].active) return { k: 'switch', i: s };
        }
        if (!best) return { k: 'move', i: 0 };
        return { k: 'move', i: best.i };
    }

    afterBattle() {
        // Patch up with items between fights so we don't trek back after every battle.
        const g = this.g;
        for (let i = 0; i < this.st.party.length; i++) {
            const u = this.st.party[i];
            if (u.hp > 0 && u.st) { const c = ['universal-solvent', { ovh: 'coolant', cor: 'antirust', shc: 'grounding-strap', frz: 'thaw-torch', pdn: 'jumpstart' }[u.st]].find((id) => this.st.bag[id]); if (c) g.useItem(c, i); }
        }
        // Install kits the team can use.
        for (let i = 0; i < this.st.party.length; i++) {
            const u = this.st.party[i];
            const e = SPECIES[u.sp].evolves;
            if (e && e.k === 'kit' && this.st.bag[e.item] && evolutionTarget(u, e.item)) { g.useKit(e.item, i); return; }
        }
    }

    // ================================================================== the world
    worldTick() {
        const g = this.g;
        if (this.w.player.move) { g.update(0.3, {}); return; }      // finish the step before planning
        const sig = `${this.st.story}|${Object.keys(this.st.bag).length}|${this.st.seals}|${Object.keys(this.st.flags).length}`;
        if (sig !== this.banSig) { this.banSig = sig; this.banned.clear(); }
        const goal = this.chooseGoal();
        if (!goal) { g.update(0.3, {}); return; }
        if (goal.grind) { this.grind(); return; }
        if (goal.map !== this.w.id) { this.travel(goal.map); return; }
        if (goal.ent) {
            const e = this.w.ents.find((x) => x.letter === goal.ent && x.visible);
            if (!e) { this.wander(); return; }
            this.interactWith(e);
            return;
        }
        if (goal.tile) { this.walkTo(goal.tile[0], goal.tile[1]); return; }
        this.wander();
    }

    needsHeal() {
        const P = this.st.party;
        if (!P.length) return false;
        const down = P.filter((u) => u.hp <= 0).length;
        const hp = P.reduce((a, u) => a + u.hp, 0), max = P.reduce((a, u) => a + calcStats(u).hp, 0);
        const ppLow = P.slice(0, 3).some((u) => u.moves.every((m) => m.pp <= 1 || MOVES[m.id].cat === 'U'));
        return down >= Math.min(2, P.length) || hp / max < 0.45 || ppLow;
    }

    chooseGoal() {
        const g = this.g, st = this.st;
        const obj = g.objective().goal;
        if (!st.flags.starter) return obj;
        // Heal first.
        if (this.st.story !== this.lastStory) { this.lastStory = this.st.story; this.extra = 0; }
        const leaderNext = obj && obj.ent && this.isBattleEnt(obj);
        const full = st.party.every((u) => u.hp >= calcStats(u).hp);
        if (this.needsHeal() || (leaderNext && !full && this.teamLevel() >= this.need() - 1 && this.healGoal()?.dist <= 2)) {
            const h = this.healGoal();
            if (h) return h.goal;
        }
        // Grind if under-levelled.
        if (this.teamLevel() < this.need() && this.st.party.length) return { grind: true };
        // Optional: the Data Link.
        if (st.seals >= 1 && !st.bag['data-link'] && this.wantDataLink) return { map: 'gasket-house', ent: 'a' };
        // Visit the locker now and then to rotate the team.
        if (st.locker.length && this.w.map.style === 'station' && this.visitedLocker !== this.w) return { map: this.w.id, ent: 'l', locker: true };
        // Grab nearby loot on the current map.
        const loot = this.w.ents.find((e) => e.visible && (e.def.k === 'item' || e.def.k === 'heap' || (e.def.k === 'wreck' && this.canRepair(e))) && this.pathTo(e.x, e.y, true));
        if (loot) return { map: this.w.id, ent: loot.letter };
        return obj;
    }

    canRepair(e) { return Object.entries(e.def.mats).every(([id, n]) => (this.st.bag[id] || 0) >= n); }
    isBattleEnt(goal) {
        const m = MAPS[goal.map];
        const d = m && m.ents[goal.ent];
        return d && d.k === 'trainer';
    }

    healGoal() {
        // Nearest map with a healer (by map hops), then its healer entity.
        const dist = this.mapDistances(this.w.id);
        let best = null;
        for (const [id, d] of Object.entries(dist)) {
            const m = MAPS[id];
            if (!m.heal) continue;
            if (id === 'workshop' && !this.st.flags.starter) continue;
            const letter = Object.keys(m.ents).find((k) => m.ents[k].k === 'healer' || m.ents[k].id === 'ma');
            if (!letter) continue;
            if (!best || d < best.dist) best = { dist: d, goal: { map: id, ent: letter } };
        }
        return best;
    }

    grind() {
        this.stats.grindSteps++;
        const m = this.w.map;
        if (m.enc && m.lv && m.lv[1] >= this.need() - 14) {
            // Pace back and forth on drift tiles.
            const p = this.w.player;
            const onDrift = this.w.tile(p.x, p.y) === '"';
            if (onDrift) {
                const dirs = this.grindDir ? ['left', 'up', 'right', 'down'] : ['right', 'down', 'left', 'up'];
                for (const d of dirs) {
                    const [dx, dy] = DIRS[d];
                    if (this.w.tile(p.x + dx, p.y + dy) === '"' && !this.w.entAt(p.x + dx, p.y + dy)) { this.grindDir ^= 1; this.g.update(0.3, { dir: d }); return; }
                }
            }
            const t = this.nearestTile((c) => c === '"');
            if (t) { this.walkTo(t[0], t[1]); return; }
        }
        // Go somewhere with drifts at a suitable level.
        const need = this.need();
        const dist = this.mapDistances(this.w.id);
        let best = null;
        for (const [id, d] of Object.entries(dist)) {
            const mm = MAPS[id];
            if (!mm.enc || !mm.lv) continue;
            const score = d * 3 + Math.abs(mm.lv[1] - need + 2);
            if (!best || score < best.score) best = { id, score };
        }
        if (best) this.travel(best.id); else this.wander();
    }

    wander() {
        const d = DIR_LIST[(this.actions >> 2) % 4];
        this.g.update(0.3, { dir: d });
    }

    // ------------------------------------------------------------------ pathfinding
    passable(x, y, allowEnt = null) {
        const w = this.w;
        const c = w.tile(x, y);
        if (c === null || SOLID.has(c)) return false;
        if (c === '~' && !this.st.bag['hover-skiff']) return false;
        if (c === 'X' && !this.st.bag['cutter-torch']) return false;
        if (c === 'O' && !this.st.bag['lift-coil']) return false;
        if (isDigit(c) && w.map.lock && w.map.lock[c] && !this.g.cond(`flag:${w.map.lock[c][0]}`)) return false;
        const e = w.entAt(x, y);
        if (e && e !== allowEnt) return false;
        return true;
    }

    /** BFS over tiles. target(x, y) decides the goal. Returns a list of directions or null. */
    bfs(target, allowEnt = null, avoidWarps = true) {
        const w = this.w, p = w.player;
        const W = w.map.W, H = w.map.H;
        const prev = new Map();
        const k0 = p.y * W + p.x;
        prev.set(k0, null);
        const q = [[p.x, p.y]];
        while (q.length) {
            const [x, y] = q.shift();
            if ((x !== p.x || y !== p.y) && target(x, y)) {
                const path = [];
                let k = y * W + x;
                while (prev.get(k)) { const [pk, d] = prev.get(k); path.unshift(d); k = pk; }
                return path;
            }
            for (const d of DIR_LIST) {
                const [dx, dy] = DIRS[d];
                let nx = x + dx, ny = y + dy;
                const c = w.tile(nx, ny);
                if (c === '^') { if (d !== 'down') continue; ny += 1; if (!this.passable(nx, ny) || w.tile(nx, ny) === '^') continue; }
                else if (!this.passable(nx, ny, allowEnt)) continue;
                const nk = ny * W + nx;
                if (prev.has(nk)) continue;
                prev.set(nk, [y * W + x, d]);
                // Don't walk through warps on the way (they would teleport us), unless it's the target.
                if (avoidWarps && isDigit(w.tile(nx, ny)) && !target(nx, ny)) continue;
                if (allowEnt && allowEnt.x === nx && allowEnt.y === ny && !target(nx, ny)) continue;
                q.push([nx, ny]);
            }
        }
        return null;
    }

    pathTo(x, y, adjacent = false) {
        const e = this.w.entAt(x, y);
        if (adjacent) return this.bfs((ax, ay) => Math.abs(ax - x) + Math.abs(ay - y) === 1 || (Math.abs(ax - x) === 0 && ay - y === 2 && this.w.tile(x, y + 1) === '%'), e);
        return this.bfs((ax, ay) => ax === x && ay === y);
    }

    step(dir) { this.g.update(0.3, { dir, run: true }); }

    walkTo(x, y) {
        const path = this.pathTo(x, y);
        if (!path || !path.length) { this.wander(); return false; }
        this.step(path[0]);
        return true;
    }

    nearestTile(pred) {
        const w = this.w;
        const path = this.bfs((x, y) => pred(w.tile(x, y)));
        if (!path) return null;
        let x = w.player.x, y = w.player.y;
        for (const d of path) { const [dx, dy] = DIRS[d]; x += dx; y += dy; if (w.tile(x, y) === '^') y += 1; }
        return [x, y];
    }

    interactWith(e) {
        const p = this.w.player;
        const dx = e.x - p.x, dy = e.y - p.y;
        const across = dx === 0 && dy === -2 && this.w.tile(p.x, p.y - 1) === '%';
        if (Math.abs(dx) + Math.abs(dy) === 1 || across) {
            const dir = across ? 'up' : dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
            if (p.dir !== dir) { this.g.update(0.3, { dir }); return; }
            this.g.update(0.05, { a: true });
            return;
        }
        const path = this.pathTo(e.x, e.y, true);
        if (!path) { this.wander(); return; }
        this.step(path[0]);
    }

    // ------------------------------------------------------------------ the map graph
    edges(id) {
        const m = MAPS[id];
        const out = [];
        for (const [d, t] of Object.entries(m.w)) if (!this.banned.has(`${id}:${d}`)) out.push({ d, to: t[0] });
        return out;
    }
    mapDistances(from) {
        const dist = { [from]: 0 };
        const q = [from];
        while (q.length) {
            const id = q.shift();
            for (const e of this.edges(id)) if (dist[e.to] === undefined) { dist[e.to] = dist[id] + 1; q.push(e.to); }
        }
        return dist;
    }
    /** First warp digit on the route from the current map to target. */
    routeDigit(target) {
        const from = this.w.id;
        const prev = { [from]: null };
        const q = [from];
        while (q.length) {
            const id = q.shift();
            if (id === target) break;
            for (const e of this.edges(id)) if (!(e.to in prev)) { prev[e.to] = { id, d: e.d }; q.push(e.to); }
        }
        if (!(target in prev)) return null;
        let cur = target, d = null;
        while (prev[cur] && prev[cur].id !== from) cur = prev[cur].id;
        d = prev[cur] ? prev[cur].d : null;
        return d;
    }

    travel(target) {
        const d = this.routeDigit(target);
        if (d === null) { this.wander(); return; }
        const w = this.w, p = w.player;
        const here = w.tile(p.x, p.y);
        if (here === d) {
            // Standing on the warp: walk off the edge of the map, or step off and back on.
            const out = OUT[w.inwardDir(p.x, p.y)];
            const [dx, dy] = DIRS[out];
            if (w.tile(p.x + dx, p.y + dy) === null) { this.step(out); return; }
            const back = w.inwardDir(p.x, p.y);
            this.step(back);
            return;
        }
        const path = this.bfs((x, y) => w.tile(x, y) === d);
        if (!path) { this.banned.add(`${w.id}:${d}`); return; }
        this.step(path[0]);
    }
}
