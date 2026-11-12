// An auto-player. It plays through the same input the player uses: it walks, turns, presses the interact button and
// calls directions to Thimble. The tests use it to prove the whole story can be finished; `explore` makes it a
// completionist that also picks up every small thing and reads every inscription. Pure, like the rest of js/sim.

import { PLAYER } from '../config.js';
import { nextGoal } from './game.js';
import { zone, findThing, lattice, distField, standNear, tunnel, tunnelOpen, edgeOpen } from './world.js';

export function makeBot({ explore = false } = {}) {
    return { explore, key: '', dist: null, target: null, wait: 0, stuck: 0, lastX: 0, lastZ: 0, log: [] };
}

const NONE = { x: 0, y: 0, turn: 0, dyaw: 0, a: false, run: false, cmd: null };
const doorKey = (G) => Object.keys(G.flags).filter((f) => G.flags[f]).sort().join(',');

/** A distance field to a thing (or to a bare point), from where a body would stand to use it. */
function fieldTo(G, t) {
    const starts = t.type === 'item' || t.type === 'pick' ? [[t.x, t.z], [t.x + 1, t.z], [t.x - 1, t.z], [t.x, t.z + 1], [t.x, t.z - 1]] : standNear(G.zone, G.flags, t);
    return distField(G.zone, G.flags, starts);
}

function reachable(G, dist) {
    const L = lattice(G.zone), i = L.index(G.player.x, G.player.z);
    if (i >= 0 && dist[i] >= 0) return true;
    return [-1, 1, -L.w, L.w].some((d) => dist[i + d] >= 0);
}

/** Pick what to walk to in this zone: the story's thing, the way toward it, or (exploring) the nearest small find. */
function choose(G, bot) {
    const Z = zone(G.zone);
    if (bot.explore) {
        const here = distField(G.zone, G.flags, [[G.player.x, G.player.z]]), L = lattice(G.zone);
        let best = null, bd = Infinity;
        const tryIt = (t) => {
            let d = -1;
            for (const [x, z] of t.type === 'pick' ? [[t.x, t.z]] : standNear(G.zone, G.flags, t)) { const i = L.index(x, z); if (i >= 0 && here[i] >= 0 && (d < 0 || here[i] < d)) d = here[i]; }
            if (d >= 0 && d < bd) { bd = d; best = t; }
        };
        for (const c of G.pickups[G.zone]) if (!c.g) tryIt({ type: 'pick', id: 'pick', x: c.x, z: c.z });
        for (const t of Z.things) if (t.type === 'lore' && !G.lore.includes(t.id)) tryIt(t);
        if (best) return best;
    }
    const goal = nextGoal(G);
    if (!goal.thing) return null;
    const where = findThing(goal.thing);
    const candidates = [];
    if (where.zone === G.zone) candidates.push(where.thing);
    else if (G.zone !== 'isle') candidates.push(Z.things.find((t) => t.type === 'portal' && t.to === 'isle'));
    else candidates.push(Z.things.find((t) => t.type === 'portal' && t.to === where.zone));
    if (G.zone === 'isle') candidates.push(Z.byId.vineFoot, Z.byId.vineTop);
    for (const t of candidates) { const d = fieldTo(G, t); if (reachable(G, d)) { bot.dist = d; return t; } }
    return null;
}

export function botInput(G, bot) {
    if (G.cards.length) { bot.key = ''; return { ...NONE, a: true }; }
    if (G.tun) return tunnelInput(G, bot);
    if (bot.wait > 0) { bot.wait--; return NONE; }

    const key = G.zone + '|' + doorKey(G) + '|' + G.gems.length + '|' + JSON.stringify(G.items) + '|' + G.lore.length + '|' + Object.values(G.counts).join('.') + '|' + Object.keys(G.taken).length + '|' + (G.seq[G.zone] || 0);
    if (key !== bot.key) {
        bot.key = key; bot.dist = null;
        bot.target = choose(G, bot);
        if (bot.target && !bot.dist) bot.dist = fieldTo(G, bot.target);
        bot.log.push(`${G.t.toFixed(0)}s ${G.zone} → ${bot.target ? bot.target.id : 'nothing'}`);
    }
    const t = bot.target, p = G.player;
    if (!t) return NONE;

    const needsUse = t.type !== 'item' && t.type !== 'pick';
    if (needsUse && G.prompt && G.prompt.id === t.id) { bot.wait = 20; bot.key = ''; return { ...NONE, a: true }; }

    // walk down the distance field; close in, aim straight at the thing
    const L = lattice(G.zone);
    let i = L.index(p.x, p.z);
    if (i < 0 || bot.dist[i] < 0) { const n = [-1, 1, -L.w, L.w, -L.w - 1, -L.w + 1, L.w - 1, L.w + 1].map((d) => i + d).find((j) => bot.dist[j] >= 0); if (n !== undefined) i = n; }
    let ax = t.x, az = t.z;
    if (bot.dist[i] > 1 || (bot.dist[i] < 0)) {
        let j = i;
        for (let s = 0; s < (bot.side ? 1 : 3); s++) {
            let best = j;
            for (const d of [-1, 1, -L.w, L.w]) {
                const k = j + d;
                if (!(bot.dist[k] >= 0 && bot.dist[k] < bot.dist[best])) continue;
                const [x0, z0] = L.at(j), [x1, z1] = L.at(k);          // the edge itself must be walkable, not just its ends
                if (edgeOpen(G.zone, G.flags, x0, z0, x1, z1)) best = k;
            }
            j = best;
        }
        [ax, az] = L.at(j);
    }
    const want = Math.atan2(ax - p.x, -(az - p.z));
    let diff = want - p.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const near = Math.hypot(t.x - p.x, t.z - p.z) < PLAYER.reach * 0.7 + (t.solid || 0);
    // nudge sideways when something small is in the way
    // not getting anywhere (a corner cut into a tree): follow the lattice one careful node at a time for a while
    if (++bot.stuck % 120 === 0) { const moved = Math.hypot(p.x - bot.lastX, p.z - bot.lastZ); bot.lastX = p.x; bot.lastZ = p.z; bot.side = moved < 0.4 ? 6 : Math.max(0, (bot.side || 0) - 1); }
    return { ...NONE, turn: Math.max(-1, Math.min(1, diff * 5)), y: Math.abs(diff) < (bot.side ? 0.25 : 0.7) && !(needsUse && near && Math.abs(diff) < 0.2) ? -1 : 0, run: !bot.side && bot.dist[i] > 12 };
}

/** In a tunnel: breadth-first to the next bauble (when exploring) or the goal, then feel, then back out. */
function tunnelInput(G, bot) {
    if (bot.wait > 0) { bot.wait--; return NONE; }
    bot.wait = 30;
    const T = tunnel(G.tun.id), s = G.tun;
    const done = T.def.flag ? !!G.flags[T.def.flag] : !!G.taken['tunnel:' + T.id];
    const wants = [];
    if (bot.explore) for (const b of T.baubles) if (!G.taken[`bauble:${T.id}:${b.x},${b.y}`]) wants.push(b);
    if (!wants.length && !done) wants.push(T.goal);
    if (!wants.length) return { ...NONE, cmd: { t: 'back' } };
    if (!done && wants[0] === T.goal && s.x === T.goal.x && s.y === T.goal.y) return { ...NONE, cmd: { t: 'feel' } };
    // BFS from Thimble to the nearest wanted cell; take the first step of that path
    const prev = { [s.x + ',' + s.y]: null }, q = [[s.x, s.y]];
    for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        if (wants.some((w) => w.x === x && w.y === y)) {
            let k = x + ',' + y, first = null;
            while (prev[k]) { first = prev[k].d; k = prev[k].from; }
            return { ...NONE, cmd: { t: 'go', d: first } };
        }
        for (const [d, dx, dy] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]) {
            const k = (x + dx) + ',' + (y + dy);
            if (prev[k] === undefined && tunnelOpen(T, x + dx, y + dy)) { prev[k] = { from: x + ',' + y, d }; q.push([x + dx, y + dy]); }
        }
    }
    return { ...NONE, cmd: { t: 'back' } };
}
