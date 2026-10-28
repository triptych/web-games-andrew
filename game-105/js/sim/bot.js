// An auto-player. It plays through the same commands the player uses (act) and lets time pass one
// step at a time, so the tests, the balance table and the Autoplay button all exercise the real rules.
// Pure, like the rest of js/sim. Everything is a generator: each `yield` means "let one step pass".

import { BENCH, BIN, UPGRADES } from '../config.js';
import { act } from './game.js';
import { nextGoal, parkSpot, refPos } from './plan.js';
import { defaultTool, portWorld } from './rules.js';

const STEPS_PER_MOVE = 40;

function* wait(n) { for (let i = 0; i < n; i++) yield; }

function aim(G, ref, pos) {
    act(G, { t: 'move', ref, bx: pos[0], bz: pos[2] ?? pos[1], ax: pos[0], az: pos[2] ?? pos[1] });
}

/** Press on a ref, drag to a place on the bench, let go. Handles a part that "sticks" to the cursor. */
function* drag(G, ref, from, to, steps = STEPS_PER_MOVE) {
    act(G, { t: 'down', ref, bx: from[0], bz: from[2], ax: from[0], az: from[2] });
    yield;
    for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        aim(G, null, [from[0] + (to[0] - from[0]) * k, 0, from[2] + (to[2] - from[2]) * k]);
        yield;
    }
    act(G, { t: 'up' });
    yield;
    if (G.job && G.job.held) {                     // a quick short drag sticks to the cursor: press again to put it down
        act(G, { t: 'down', ref: null, bx: to[0], bz: to[2], ax: to[0], az: to[2] });
        yield;
        act(G, { t: 'up' });
        yield;
    }
}

function clampBench(x, z) {
    return [Math.max(BENCH.x0 + 1, Math.min(BENCH.x1 - 1, x)), Math.max(BENCH.z0 + 1, Math.min(BENCH.z1 - 1, z))];
}

function* doGoal(G, goal) {
    const J = G.job, dev = J.dev;
    // choose the tool the way a player would: the one that does the obvious thing to this
    if (['turn', 'lift', 'unplug', 'plugin', 'place', 'stash'].includes(goal.k) && goal.ref) {
        const want = defaultTool(dev, goal.ref);
        if (want && G.tool !== want) { act(G, { t: 'tool', tool: want }); yield; }
    }
    switch (goal.k) {
        case 'turn': {
            const p = refPos(dev, goal.ref);
            act(G, { t: 'down', ref: goal.ref, bx: p[0], bz: p[2], ax: p[0], az: p[2] });
            for (let n = 0; n < 2000 && G.job.use && G.job.use.k === 'turn'; n++) yield;
            act(G, { t: 'up' }); yield;
            return;
        }
        case 'oilhole': case 'oil': case 'brush': case 'probe': case 'solder': {
            const tool = goal.k === 'oilhole' ? 'oil' : goal.k;
            act(G, { t: 'tool', tool }); yield;
            const p = refPos(dev, goal.ref);
            yield* useTool(G, goal, tool, p);
            return;
        }
        case 'lift': {
            const p = refPos(dev, goal.ref);
            const free = Object.values(dev.parts).filter((q) => q.loc === 'free').length;
            const dest = goal.dest === 'bin' ? [BIN.x, 0, BIN.z] : (() => { const s = parkSpot(dev, free); const c = clampBench(s[0], s[1]); return [c[0], 0, c[1]]; })();
            yield* drag(G, goal.ref, p, dest);
            return;
        }
        case 'unplug': {
            const p = refPos(dev, goal.ref);
            const to = clampBench(p[0] + 0.4, Math.min(p[2] + 2.6, BENCH.z1 - 1));
            yield* drag(G, goal.ref, p, [to[0], 0, to[1]]);
            return;
        }
        case 'plugin': {
            const w = dev.wires[goal.wire];
            const from = refPos(dev, goal.ref);
            const to = portWorld(dev, w.ends[goal.end].port);
            yield* drag(G, goal.ref, from, to);
            return;
        }
        case 'place': {
            const from = refPos(dev, goal.ref);
            const slot = dev.slots[goal.slot];
            yield* drag(G, goal.ref, [from[0], from[1], from[2]], [slot.pos[0], 0, slot.pos[2]]);
            // a sub-slot's centre depends on the board it sits on
            return;
        }
        case 'spare': {
            act(G, { t: 'spare', spec: goal.spec });
            yield* wait(30);
            return;
        }
        case 'stash': {
            const p = refPos(dev, goal.ref);
            act(G, { t: 'down', ref: goal.ref, bx: p[0], bz: p[2], ax: p[0], az: p[2] }); yield;
            act(G, { t: 'up' }); yield;
            return;
        }
        case 'test': {
            act(G, { t: 'test' });
            for (let n = 0; n < 3000 && G.job && G.job.test; n++) yield;
            return;
        }
        case 'putdown': {
            act(G, { t: 'down', ref: null, bx: 0, bz: 5, ax: 0, az: 5 }); yield;
            act(G, { t: 'up' }); yield;
            return;
        }
        default: throw new Error('bot: unknown goal ' + goal.k);
    }
}

function* useTool(G, goal, tool, p) {
    const J = G.job, dev = J.dev;
    act(G, { t: 'down', ref: goal.ref, bx: p[0], bz: p[2], ax: p[0], az: p[2] });
    yield;
    const done = () => {
        const [k, id] = [goal.ref.slice(0, goal.ref.indexOf(':')), goal.ref.slice(goal.ref.indexOf(':') + 1)];
        if (tool === 'solder') {
            if (k === 'joint') { const [pid, j] = id.split('.'); return dev.parts[pid].cond.joints[+j].done; }
            return dev.wires[id].cut.done;
        }
        if (tool === 'probe') return G.job.notes.some((n) => n.ref === goal.ref) && (k !== 'part' || dev.parts[id].probed);
        if (tool === 'oil') {
            if (k === 'hole') return dev.slots[id.split('.')[0]].holes.find((h) => h.id === id).rust === 0;
            return dev.parts[id].cond.seized === 0;
        }
        if (tool === 'brush') { const c = dev.parts[id].cond; return c.corr + c.clog + c.dust === 0 || (goal.text.startsWith('Wipe') && c.dust === 0); }
        return true;
    };
    let pressed = true;
    for (let n = 0; n < 4000 && !done(); n++) {
        if (tool === 'brush') {
            const off = Math.sin(n * 0.35) * 0.6;
            act(G, { t: 'move', ref: goal.ref, bx: p[0] + off, bz: p[2], ax: p[0] + off, az: p[2] });
        } else if (tool === 'solder') {
            const [k, id] = [goal.ref.slice(0, goal.ref.indexOf(':')), goal.ref.slice(goal.ref.indexOf(':') + 1)];
            const tgt = k === 'joint' ? dev.parts[id.split('.')[0]].cond.joints[+id.split('.')[1]] : dev.wires[id].cut;
            if (pressed && tgt.heat > 0.76) { act(G, { t: 'up' }); pressed = false; }
            else if (!pressed && tgt.heat < 0.5) { act(G, { t: 'down', ref: goal.ref, bx: p[0], bz: p[2], ax: p[0], az: p[2] }); pressed = true; }
        }
        yield;
    }
    act(G, { t: 'up' }); yield;
}

/** Repairs the job on the bench. Throws if it gets stuck. opt: { clean, stash, pullGov, maxGoals }. */
export function* repairJob(G, opt = {}) {
    let last = '', repeats = 0;
    for (let n = 0; n < (opt.maxGoals || 600); n++) {
        if (!G.job || G.phase !== 'bench') return;
        const goal = nextGoal(G, opt);
        if (!goal) return;
        const key = goal.k + (goal.ref || goal.spec || '') + (G.job.dev.slotOrder.map((id) => G.job.dev.slots[id].holes.map((h) => h.prog.toFixed(1)).join('')).join(''));
        repeats = key === last ? repeats + 1 : 0;
        last = key;
        if (repeats > 4) throw new Error(`bot stuck on: ${goal.text} (${goal.k} ${goal.ref || ''})`);
        const wasTest = goal.k === 'test';
        yield* doGoal(G, goal);
        if (wasTest && G.job && G.job.stage === 'work') throw new Error('the power test failed: ' + (G.job.say || ''));
        yield;
    }
    throw new Error('bot gave up after too many goals');
}

/** Plays the whole campaign (or just the dialogue and shop around bench jobs). */
export function* playCampaign(G, opt = {}) {
    const choice = opt.choice || 'end_quiet';
    act(G, { t: 'campaign', seed: opt.seed ?? G.seed });
    for (let n = 0; n < 200000; n++) {
        switch (G.phase) {
            case 'credits': return;
            case 'dialogue': {
                const line = G.dlg.lines[G.dlg.i];
                if (line.ask) {
                    const i = Math.max(0, line.ask.findIndex((a) => a.flag === choice));
                    act(G, { t: 'choose', i });
                } else act(G, { t: 'next' });
                break;
            }
            case 'shop':
                if (G.story.idx < G.story.queue.length) act(G, { t: 'call' }); else act(G, { t: 'close' });
                break;
            case 'brief': act(G, { t: 'accept' }); break;
            case 'bench': yield* repairJob(G, { clean: opt.clean !== false, stash: opt.stash !== false, pullGov: !!opt.pullGov }); break;
            case 'result': act(G, { t: 'collect' }); break;
            case 'endday': {
                const order = ['power', 'fine', 'sonic', 'meter', 'account', 'plant', 'cat', 'holo'];
                for (const id of order) if (!G.story.upgrades[id] && G.story.credits >= UPGRADES.find((u) => u.id === id).cost) act(G, { t: 'buy', id });
                act(G, { t: 'nextday' });
                break;
            }
            default: throw new Error('bot: stuck in phase ' + G.phase);
        }
        yield;
    }
    throw new Error('campaign did not finish');
}

/** Run a generator to the end, one simulation step per yield. */
export function drive(G, gen, step, dt, maxSteps = 5e7) {
    let n = 0;
    for (let r = gen.next(); !r.done; r = gen.next()) {
        step(G, {}, dt);
        if (++n > maxSteps) throw new Error('drive: too many steps');
    }
    return n;
}
