// A player that follows the planner: fetch the key, carry it to the gate, lay
// the bridge, arm the charge, kill the shard dragons, fight the boss, carry
// the chalice home. It plays through the same input snapshot a person does,
// so the attract-mode demo and the tests exercise the real game. It replans
// from the world as it is every second, so a bat that steals its key or a
// dragon that swallows it only costs it time.

import { T } from '../config.js';
import { solve } from './plan.js';
import { bfsPath } from './nav.js';

const cx = (e) => e.x + e.w / 2;
const cy = (e) => e.y + e.h / 2;

export class Bot {
    constructor(world, opts = {}) {
        this.w = world;
        this.fight = opts.fight !== false;
        this.plan = null; this.planT = 0;
        this.path = null; this.pathGoal = null; this.pathT = 0;
        this.stuckT = 0; this.lastX = 0; this.lastY = 0; this.jitter = 0; this.jx = 0; this.jy = 0;
        this.fleeT = 0; this.fleeFrom = null; this.pushT = 0;
        this.useCool = 0;
        this.note = '';
    }

    /** One input snapshot. */
    think(dt) {
        const w = this.w, p = w.player;
        const out = { ax: 0, ay: 0, use: false, drop: false, dash: false };
        if (p.dead || w.cleared || w.over) { this.path = null; return out; }
        if (this.useCool > 0) this.useCool -= dt;
        this.planT -= dt;
        if (this.planT <= 0 || !this.plan) { this.plan = solve(w); this.planT = 1; }

        // stuck? wiggle
        if (Math.hypot(p.x - this.lastX, p.y - this.lastY) > 2) { this.lastX = p.x; this.lastY = p.y; this.stuckT = 0; }
        else this.stuckT += dt;
        if (this.stuckT > 1.6) { this.stuckT = 0; this.jitter = 0.35; this.jx = w.rng() * 2 - 1; this.jy = w.rng() * 2 - 1; this.path = null; }
        if (this.jitter > 0) { this.jitter -= dt; out.ax = this.jx; out.ay = this.jy; return out; }

        // fights come first
        if (this.fight && this.combat(out)) return out;

        const step = this.plan && this.plan[0];
        let goal = null, onArrive = null;
        const held = p.held;
        const get = (it) => { goal = it.kind === 'bridge' && !held ? [it.x - 4, cy(it)] : [cx(it), cy(it)]; };

        if (this.fleeT > 0) {
            this.fleeT -= dt;
            goal = this.fleeSpot;
        } else if (!step) {
            this.note = 'lost';
            goal = [w.map.start.x + 4, w.map.start.y + 4];
        } else if (step.type === 'gate') {
            const key = w.items.find((i) => i.kind === 'key' && i.color === step.color);
            const g = w.map.gates[step.gate];
            this.note = `gate ${step.color}`;
            if (held !== key) get(key);
            else { goal = [(g.x + g.w / 2) * T, (g.y + g.h) * T + 6]; onArrive = () => { out.ay = -1; }; }
        } else if (step.type === 'crack') {
            this.note = 'crack';
            const ch = w.items.find((i) => i.kind === 'charge' && !(i.fuse > 0));
            if (held && held.kind === 'charge') {
                const best = this.nearestTile(step.approach);
                goal = best;
                onArrive = () => {
                    if (this.useCool <= 0) {
                        out.use = true; this.useCool = 0.5;
                        this.fleeT = 2.6; this.fleeSpot = this.fleeFromPoint(cx(p), cy(p), 6);
                    }
                };
            } else if (ch) get(ch);
            else if (w.map.dispenser) goal = [w.map.dispenser.x + 4, w.map.dispenser.y + 22];
        } else if (step.type === 'barrier') {
            this.note = 'barrier';
            const px = w.items.find((i) => i.kind === 'pixel');
            const b = w.map.barrier;
            if (held !== px) get(px);
            else { goal = [(b.x + b.w / 2) * T, (b.y + b.h) * T + 6]; onArrive = () => { out.ay = -1; }; }
        } else if (step.type === 'bridge') {
            this.note = 'bridge';
            const br = w.items.find((i) => i.kind === 'bridge');
            if (held !== br) get(br);
            else {
                goal = this.nearestTile(step.approach);
                onArrive = () => { out.drop = true; this.plan = null; };
            }
        } else if (step.type === 'shards') {
            this.note = 'shards';
            const sword = w.items.find((i) => i.kind === 'sword');
            const shard = w.pickups.find((s) => s.kind === 'shard' && !s.taken);
            const d = w.dragons.filter((d) => d.shard && !d.dead).sort((a, b) => Math.hypot(cx(a) - cx(p), cy(a) - cy(p)) - Math.hypot(cx(b) - cx(p), cy(b) - cy(p)))[0];
            if (shard) goal = [cx(shard), cy(shard)];
            else if (held !== sword) get(sword);
            else if (d) { goal = [cx(d), cy(d)]; this.hunt(d, out); }
        } else if (step.type === 'boss') {
            this.note = 'boss';
            const sword = w.items.find((i) => i.kind === 'sword');
            if (held !== sword) get(sword);
            else {
                const b = w.boss;
                const R = w.roomRect(b.room);
                if (w.room !== b.room) goal = [R.x + R.w / 2, R.y + R.h - 40];
                else if (b.dull || !b.active) { goal = [cx(b), cy(b)]; this.hunt(b, out); }
                else {
                    // keep away, off the laser line
                    const a = Math.atan2(cy(p) - cy(b), cx(p) - cx(b));
                    let tx = cx(b) + Math.cos(a) * 70, ty = cy(b) + Math.sin(a) * 60;
                    if (b.state === 'laserTell' || b.state === 'laser') ty = b.laserY + (cy(p) < b.laserY ? -40 : 40);
                    tx = Math.max(R.x + 24, Math.min(R.x + R.w - 24, tx)); ty = Math.max(R.y + 24, Math.min(R.y + R.h - 24, ty));
                    goal = [tx, ty];
                }
            }
        } else if (step.type === 'deliver') {
            this.note = 'deliver';
            const ch = w.items.find((i) => i.kind === 'chalice');
            if (!ch) { goal = null; }
            else if (held !== ch) get(ch);
            else { const R = w.roomRect(w.map.homeVault); goal = [R.x + R.w / 2, R.y + R.h / 2]; }
        }

        if (goal) this.walk(goal, out, onArrive, dt);
        return out;
    }

    nearestTile(list) {
        const w = this.w, p = w.player, M = w.map;
        let best = null, bd = 1e9;
        for (const k of list) {
            if (!w.reach[k]) continue;
            const x = (k % M.gw) * T + 4, y = ((k / M.gw) | 0) * T + 4;
            const d = Math.hypot(x - cx(p), y - cy(p));
            if (d < bd) { bd = d; best = [x, y]; }
        }
        return best || [cx(p), cy(p)];
    }

    fleeFromPoint(x, y, tiles) {
        const w = this.w, M = w.map;
        let best = [x, y], bd = 0;
        for (let k = 0; k < 40; k++) {
            const a = k / 40 * Math.PI * 2;
            const tx = Math.floor((x + Math.cos(a) * tiles * T) / T), ty = Math.floor((y + Math.sin(a) * tiles * T) / T);
            if (tx < 0 || ty < 0 || tx >= M.gw || ty >= M.gh || !w.reach[ty * M.gw + tx]) continue;
            if (w.roomAt(tx * T, ty * T) !== w.roomAt(x, y)) continue;
            const d = Math.hypot(tx * T - x, ty * T - y);
            if (d > bd) { bd = d; best = [tx * T + 4, ty * T + 4]; }
        }
        return best;
    }

    hunt(t, out) {
        const p = this.w.player;
        const d = Math.hypot(cx(t) - cx(p), cy(t) - cy(p));
        if (d < 28 && this.useCool <= 0) { out.use = true; this.useCool = 0.3; }
    }

    combat(out) {
        const w = this.w, p = w.player;
        // sidestep fire that is coming this way
        for (const s of w.projectiles) {
            const dx = cx(p) - s.x, dy = cy(p) - s.y;
            const d = Math.hypot(dx, dy);
            if (d > 34) continue;
            const v = Math.hypot(s.vx, s.vy) || 1;
            if ((dx * s.vx + dy * s.vy) / (d * v) < 0.6) continue;   // not heading at us
            const px = -s.vy / v, py = s.vx / v;
            const side = px * dx + py * dy >= 0 ? 1 : -1;
            out.ax = px * side; out.ay = py * side;
            if (d < 16 && p.dashCool <= 0) out.dash = true;
            return true;
        }
        const sword = p.held && p.held.kind === 'sword';
        for (const d of w.dragons) {
            if (d.dead || w.roomOf(d) !== w.room) continue;
            const dd = Math.hypot(cx(d) - cx(p), cy(d) - cy(p));
            if (sword && dd < 30) {
                const dx = cx(d) - cx(p), dy = cy(d) - cy(p);
                out.ax = Math.sign(dx) * (Math.abs(dx) > 3 ? 1 : 0); out.ay = Math.sign(dy) * (Math.abs(dy) > 3 ? 1 : 0);
                if (this.useCool <= 0) { out.use = true; this.useCool = 0.3; }
                return true;
            }
            if (!sword && dd < 24 && d.biteT > 0 && p.dashCool <= 0) {
                const dx = cx(p) - cx(d), dy = cy(p) - cy(d), l = Math.hypot(dx, dy) || 1;
                out.ax = dx / l; out.ay = dy / l; out.dash = true;
                return true;
            }
        }
        return false;
    }

    walk(goal, out, onArrive, dt) {
        const w = this.w, p = w.player, M = w.map;
        const gx = Math.floor(goal[0] / T), gy = Math.floor(goal[1] / T);
        const sx = Math.floor(cx(p) / T), sy = Math.floor(cy(p) / T);
        const close = Math.hypot(goal[0] - cx(p), goal[1] - cy(p));
        if (close < 5) {
            if (onArrive) onArrive();
            else { out.ax = Math.sign(goal[0] - cx(p)) * Math.min(1, Math.abs(goal[0] - cx(p)) / 2); out.ay = Math.sign(goal[1] - cy(p)) * Math.min(1, Math.abs(goal[1] - cy(p)) / 2); }
            return;
        }
        this.pathT -= dt;
        if (!this.path || !this.pathGoal || this.pathGoal[0] !== gx || this.pathGoal[1] !== gy || this.pathT <= 0) {
            this.path = this.findPath([sx, sy], [gx, gy]);
            this.pathGoal = [gx, gy]; this.pathT = 0.6;
        }
        if (!this.path || !this.path.length) {
            out.ax = Math.sign(goal[0] - cx(p)); out.ay = Math.sign(goal[1] - cy(p));
            return;
        }
        // drop tiles we've reached
        while (this.path.length && Math.abs(this.path[0][0] * T - p.x) < 1.2 && Math.abs(this.path[0][1] * T - p.y) < 1.2) this.path.shift();
        if (!this.path.length) return;
        const [nx, ny] = this.path[0];
        if (Math.abs(nx - sx) > 2 || Math.abs(ny - sy) > 2) {
            // a teleport hop: stand still on the pad
            if (Math.hypot(nx * T - p.x, ny * T - p.y) > 40) return;
            this.path.shift();
            return;
        }
        const dx = nx * T - p.x, dy = ny * T - p.y;
        out.ax = Math.abs(dx) > 0.6 ? Math.sign(dx) : 0;
        out.ay = Math.abs(dy) > 0.6 ? Math.sign(dy) : 0;
    }

    findPath(start, goal) {
        const w = this.w, M = w.map, p = w.player;
        const pads = M.pads;
        const links = (x, y) => {
            for (const pad of pads) {
                if (pad.link < 0) continue;
                if (x * T + 4 > pad.x + 8 && x * T + 4 < pad.x + pad.w - 8 && y * T + 4 > pad.y + 8 && y * T + 4 < pad.y + pad.h - 8) {
                    const to = pads[pad.link];
                    return [[Math.floor((to.x + to.w / 2 - 4) / T), Math.floor((to.y + to.h / 2 - 4) / T)]];
                }
            }
            return [];
        };
        // avoid bumping into loose items (touching one would swap what we carry)
        const avoid = new Set();
        if (p.held) for (const it of w.items) {
            if (it === p.held || it.holder) continue;
            if (it.kind === 'bridge' && it.laid) {
                // walk down the deck, never along a rail
                const deck = it.orient === 'v' ? Math.floor((it.x + 4) / T) : Math.floor((it.y + 4) / T);
                for (let y = Math.floor(it.y / T) - 1; y <= Math.floor((it.y + it.h) / T); y++) for (let x = Math.floor(it.x / T) - 1; x <= Math.floor((it.x + it.w) / T); x++) {
                    if ((it.orient === 'v' ? x : y) !== deck) avoid.add(y * M.gw + x);
                }
                continue;
            }
            for (let y = Math.floor((it.y - 7) / T); y <= Math.floor((it.y + it.h) / T); y++) for (let x = Math.floor((it.x - 7) / T); x <= Math.floor((it.x + it.w) / T); x++) avoid.add(y * M.gw + x);
        }
        const base = (x, y) => !w.boxBlocked(x * T, y * T, 8, 8, 'player');
        const pass = (x, y) => base(x, y) && (!avoid.has(y * M.gw + x) || (x === goal[0] && y === goal[1]));
        return bfsPath(M.gw, M.gh, start, goal, pass, links) || bfsPath(M.gw, M.gh, start, goal, base, links);
    }
}
