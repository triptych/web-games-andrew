// The overworld at runtime: one map, the player and the entities on it. Grid movement with smooth
// interpolation (the view reads px/py), ledges, tools (Cutter Torch, Lift Coil, Hover Skiff),
// warps, wild encounters in scrap drifts, trainers spotting the player, wandering townsfolk.
// World never talks to the UI: it pushes events into game.events and calls game hooks.

import { MAPS } from './data/maps.js';
import { STEP_TIME, RUN_TIME } from '../config.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SOLID = new Set(['#', 'T', 'B', '=', 'K', '%', '+']);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function isDigit(c) { return c >= '0' && c <= '9'; }

export class World {
    constructor(game, mapId, x, y, dir = 'down') {
        this.game = game;
        this.map = MAPS[mapId];
        if (!this.map) throw new Error(`no map ${mapId}`);
        this.id = mapId;
        const st = game.state;
        // Tiles: letters become floor; removed fences and blocks become road.
        this.grid = this.map.rows.map((r, yy) => [...r].map((c, xx) => {
            if (c >= 'a' && c <= 'z') return this.map.floor;
            if ((c === 'X' || c === 'O') && st.removed[`${mapId}:${xx},${yy}`]) return ',';
            return c;
        }));
        this.ents = [];
        for (let yy = 0; yy < this.map.H; yy++) for (let xx = 0; xx < this.map.W; xx++) {
            const c = this.map.rows[yy][xx];
            if (c < 'a' || c > 'z') continue;
            const def = this.map.ents[c];
            const key = def.id || `${mapId}:${c}`;
            this.ents.push({ key, letter: c, def, x: xx, y: yy, hx: xx, hy: yy, px: xx, py: yy, dir: def.face || 'down', move: null, wanderT: 1 + (xx * 7 + yy * 3) % 4, visible: true, walkPath: null });
        }
        this.player = { x, y, px: x, py: y, dir, move: null, run: false, skiff: this.grid[y] && this.grid[y][x] === '~', bump: 0, hopping: false };
        this.arrivedByWarp = true;
        this.refreshVisibility();
        this.time = 0;
    }

    refreshVisibility() {
        const st = this.game.state;
        for (const e of this.ents) {
            const d = e.def;
            let vis = true;
            if (d.when && !this.game.cond(d.when)) vis = false;
            if (d.unless && this.game.cond(d.unless)) vis = false;
            if ((d.k === 'item' || d.k === 'heap' || d.k === 'wreck') && st.taken[e.key]) vis = false;
            if (d.k === 'titan' && st.flags[d.flag]) vis = false;
            e.visible = vis;
        }
    }

    tile(x, y) { return y >= 0 && y < this.map.H && x >= 0 && x < this.map.W ? this.grid[y][x] : null; }
    entAt(x, y, onlyVisible = true) {
        return this.ents.find((e) => (!onlyVisible || e.visible) && e.def.k !== 'trigger' && ((e.x === x && e.y === y) || (e.move && e.move.tx === x && e.move.ty === y)));
    }
    blockedForNpc(x, y) {
        const c = this.tile(x, y);
        if (c === null || SOLID.has(c) || c === '~' || c === 'X' || c === 'O' || c === '^' || isDigit(c)) return true;
        if (this.entAt(x, y)) return true;
        const p = this.player;
        if ((p.x === x && p.y === y) || (p.move && p.move.tx === x && p.move.ty === y)) return true;
        return false;
    }

    // ------------------------------------------------------------------ the player
    /** input: { dir, run } — called every frame when the player is free to move. */
    update(dt, input) {
        this.time += dt;
        const p = this.player;
        if (p.bump > 0) p.bump -= dt;
        if (p.move) {
            p.move.t += dt;
            const k = Math.min(1, p.move.t / p.move.dur);
            p.px = p.move.fx + (p.move.tx - p.move.fx) * k;
            p.py = p.move.fy + (p.move.ty - p.move.fy) * k;
            if (k >= 1) {
                p.x = p.move.tx; p.y = p.move.ty; p.px = p.x; p.py = p.y;
                const hop = p.move.hop;
                p.move = null; p.hopping = false;
                this.arrive(hop);
                if (this.game.busy()) { this.updateEnts(dt); return; }
            }
        }
        if (!p.move && input && input.dir && !this.game.busy()) this.tryMove(input.dir, input.run);
        this.updateEnts(dt);
    }

    tryMove(dir, run) {
        const p = this.player;
        const [dx, dy] = DIRS[dir];
        const turned = p.dir !== dir;
        p.dir = dir;
        const nx = p.x + dx, ny = p.y + dy;
        const here = this.tile(p.x, p.y);
        const c = this.tile(nx, ny);
        // Walking off the edge of the map (or off a door mat) from a warp tile.
        if (c === null) {
            if (isDigit(here)) { this.game.onWarp(this.id, here, p.x, p.y); return; }
            return this.bump();
        }
        if (this.entAt(nx, ny)) return turned ? null : this.bump();
        if (c === 'X' || c === 'O') {
            const tool = c === 'X' ? 'cutter-torch' : 'lift-coil';
            if (this.game.state.bag[tool]) {
                this.grid[ny][nx] = ',';
                this.game.state.removed[`${this.id}:${nx},${ny}`] = true;
                this.game.emit({ t: 'tool', tool, x: nx, y: ny });
                this.game.toast(c === 'X' ? 'The Cutter Torch slices through the chains!' : 'The Lift Coil hauls the engine block aside!');
                return;
            }
            if (!turned) this.game.toast(c === 'X' ? 'A chained metal fence. A cutting torch could get through.' : 'A huge engine block. You\'d need a magnetic lift to move it.');
            return this.bump();
        }
        if (c === '^') {
            if (dir !== 'down') return this.bump();
            // Hop the ledge: land on the tile beyond.
            const lx = nx, ly = ny + 1;
            const lc = this.tile(lx, ly);
            if (lc === null || SOLID.has(lc) || this.entAt(lx, ly) || lc === '^') return this.bump();
            this.startMove(lx, ly, STEP_TIME * 1.6, true);
            this.game.emit({ t: 'ledge' });
            return;
        }
        if (c === '~' && !this.game.state.bag['hover-skiff']) { if (!turned) this.game.toast('Sludge. Don\'t even think about swimming in it.'); return this.bump(); }
        if (SOLID.has(c)) return turned ? null : this.bump();
        // Locked warps (the Furnace Four's doors).
        if (isDigit(c) && this.map.lock && this.map.lock[c] && !this.game.cond(`flag:${this.map.lock[c][0]}`)) {
            if (!turned) this.game.toast(this.map.lock[c][1]);
            return this.bump();
        }
        const boots = run && this.game.state.bag['steam-boots'];
        this.startMove(nx, ny, boots ? RUN_TIME : STEP_TIME, false);
        p.run = !!boots;
    }

    startMove(tx, ty, dur, hop) {
        const p = this.player;
        p.move = { fx: p.x, fy: p.y, tx, ty, t: 0, dur, hop };
        p.hopping = hop;
        this.arrivedByWarp = false;
        const c = this.tile(tx, ty);
        const wasSkiff = p.skiff;
        p.skiff = c === '~';
        if (p.skiff && !wasSkiff) this.game.emit({ t: 'skiff', on: true });
        if (!p.skiff && wasSkiff) this.game.emit({ t: 'skiff', on: false });
    }

    bump() {
        const p = this.player;
        if (p.bump <= 0) { this.game.emit({ t: 'bump' }); p.bump = 0.35; }
        return null;
    }

    /** The player finished a step onto (x, y). */
    arrive(hop) {
        const p = this.player;
        const c = this.tile(p.x, p.y);
        this.game.onStep(hop);
        if (isDigit(c)) { this.game.onWarp(this.id, c, p.x, p.y); return; }
        // Row triggers (scripted meetings).
        for (const e of this.ents) {
            if (!e.visible || e.def.k !== 'trigger') continue;
            if (p.y === e.y) { this.game.onTrigger(e); return; }
        }
        // Trainers who can see the player.
        const spotter = this.spottedBy();
        if (spotter) { this.game.onSpotted(spotter); return; }
        // Wild encounters.
        if (c === '"' || c === '~') this.game.onDrift(c === '~');
    }

    /** A visible, unbeaten trainer whose line of sight reaches the player. */
    spottedBy() {
        const p = this.player;
        for (const e of this.ents) {
            const d = e.def;
            if (!e.visible || d.k !== 'trainer' || !(d.sight > 0) || this.game.state.flags[`beat:${e.key}`]) continue;
            const [dx, dy] = DIRS[e.dir];
            for (let i = 1; i <= d.sight; i++) {
                const x = e.x + dx * i, y = e.y + dy * i;
                const c = this.tile(x, y);
                if (c === null || SOLID.has(c) || c === 'X' || c === 'O') break;
                if (p.x === x && p.y === y) return e;
                if (this.entAt(x, y)) break;
            }
        }
        return null;
    }

    /** The entity the player is facing (looking across counters), or null. */
    facing() {
        const p = this.player;
        const [dx, dy] = DIRS[p.dir];
        let x = p.x + dx, y = p.y + dy;
        let e = this.entAt(x, y);
        if (!e && this.tile(x, y) === '%') e = this.entAt(x + dx, y + dy);
        return e || null;
    }
    facingTile() {
        const p = this.player;
        const [dx, dy] = DIRS[p.dir];
        return { x: p.x + dx, y: p.y + dy, c: this.tile(p.x + dx, p.y + dy) };
    }

    // ------------------------------------------------------------------ entities
    updateEnts(dt) {
        const busy = this.game.busy();
        for (const e of this.ents) {
            if (e.move) {
                e.move.t += dt;
                const k = Math.min(1, e.move.t / e.move.dur);
                e.px = e.move.fx + (e.move.tx - e.move.fx) * k;
                e.py = e.move.fy + (e.move.ty - e.move.fy) * k;
                if (k >= 1) { e.x = e.move.tx; e.y = e.move.ty; e.px = e.x; e.py = e.y; e.move = null; }
                continue;
            }
            if (e.walkPath && e.walkPath.length) {
                const dir = e.walkPath[0];
                const [dx, dy] = DIRS[dir];
                e.dir = dir;
                if (this.blockedForNpc(e.x + dx, e.y + dy)) { e.walkPath = null; continue; }
                e.walkPath.shift();
                e.move = { fx: e.x, fy: e.y, tx: e.x + dx, ty: e.y + dy, t: 0, dur: STEP_TIME };
                continue;
            }
            const w = e.def.wander;
            if (!w || !e.visible || busy) continue;
            e.wanderT -= dt;
            if (e.wanderT > 0) continue;
            const rng = this.game.rng;
            e.wanderT = 1.2 + rng.next() * 2.5;
            const dir = rng.pick(['up', 'down', 'left', 'right']);
            e.dir = dir;
            if (rng.chance(0.4)) continue;                     // just look around
            const [dx, dy] = DIRS[dir];
            const nx = e.x + dx, ny = e.y + dy;
            if (Math.abs(nx - e.hx) > w || Math.abs(ny - e.hy) > w) continue;
            if (this.blockedForNpc(nx, ny)) continue;
            e.move = { fx: e.x, fy: e.y, tx: nx, ty: ny, t: 0, dur: STEP_TIME * 1.4 };
        }
    }

    /** Walk an entity straight toward the player until adjacent. Returns false if already there. */
    approach(e) {
        const p = this.player;
        const dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
        if (dist <= 1) { e.dir = p.x > e.x ? 'right' : p.x < e.x ? 'left' : p.y > e.y ? 'down' : 'up'; return false; }
        const steps = [];
        for (let i = 0; i < dist - 1; i++) steps.push(e.dir);
        e.walkPath = steps;
        return true;
    }
    /** Turn an entity to face the player (when talked to). */
    faceToPlayer(e) {
        const p = this.player;
        if (e.def.k === 'sign' || e.def.k === 'heap' || e.def.k === 'wreck' || e.def.k === 'item' || e.def.look === 'capsule') return;
        const dx = p.x - e.x, dy = p.y - e.y;
        e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    entsSettled() { return this.ents.every((e) => !e.move && !(e.walkPath && e.walkPath.length)); }

    /** Find the tile of a warp digit (the n-th one, for wide exits). */
    warpTile(d, n = 0) {
        const tiles = [];
        for (let y = 0; y < this.map.H; y++) for (let x = 0; x < this.map.W; x++) if (this.map.rows[y][x] === String(d)) tiles.push([x, y]);
        return tiles[Math.min(n, tiles.length - 1)];
    }
    warpIndex(d, x, y) {
        let n = 0;
        for (let yy = 0; yy < this.map.H; yy++) for (let xx = 0; xx < this.map.W; xx++) if (this.map.rows[yy][xx] === String(d)) { if (xx === x && yy === y) return n; n++; }
        return 0;
    }
    /** The direction that points into the map from an edge warp tile. */
    inwardDir(x, y) {
        if (y === 0) return 'down';
        if (y === this.map.H - 1) return 'up';
        if (x === 0) return 'right';
        if (x === this.map.W - 1) return 'left';
        // Doors: step out downwards.
        return 'down';
    }
}

export { OPPOSITE, SOLID };
