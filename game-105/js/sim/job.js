// A repair job on the bench: the commands a player can give (act), the things that happen while a
// button is held (step), the power test and the marks it earns. Pure, like the rest of js/sim.
//
// The caller (the view, or the bot) tells the sim what is under the pointer as a `ref` string:
//   'part:p3'  'hole:s2.0'  'plug:w1.0'  'wire:w1'  'joint:p4.1'  'cut:w1'  'stash:t0'
// so the sim never needs a renderer to know what was touched.

import { BENCH, BIN, DISH, FAST, HOVER, SPAWN, TUNE, FLOOR_Y } from '../config.js';
import { MODS } from './modules.js';
import {
    blockers, bitFor, canAct, defaultTool, describe, evaluate, failMessage, holeOf, holePos, isDefective, jointOf, jointsLeft, liftCheck,
    parseRef, partPlace, placeCheck, portWorld, rot, slotPlace, snapSlot, stashOpen, wireEndPos, flowUntilFail,
} from './rules.js';

const CONTINUOUS = ['solder', 'brush', 'oil', 'probe'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampBench = (x, z) => [clamp(x, BENCH.x0 + 0.6, BENCH.x1 - 0.6), clamp(z, BENCH.z0 + 0.6, BENCH.z1 - 0.6)];

export function newJob(G, dev, info = {}) {
    G.job = {
        id: (G.jobCount = (G.jobCount || 0) + 1),
        kind: dev.kind, tier: dev.tier, name: info.name || dev.kind, customer: info.customer || null, story: info.story || null,
        dev, dish: {}, held: null, use: null, test: null, stage: 'work', time: 0,
        stats: { slips: 0, burns: 0, tests: 0, fails: 0, spent: 0, taps: 0, wrong: 0, scrapped: 0, hints: 0 },
        notes: [], say: '', sayT: 0, hint: '', pay: info.pay || 0, base: info.base || 0, extras: dev.extras.map((e) => ({ ...e })),
        gov: { pulled: false, seen: dev.gov }, found: [], result: null, reverse: false,
    };
    G.tool = G.tool || 'hand';
    G.ptr = { ref: null, bx: 0, bz: 0, ax: 0, az: 0, down: false, travel: 0, px: 0, pz: 0, moved: 0 };
    G.events.push({ type: 'job', id: G.job.id });
    return G.job;
}

const say = (G, text, t = 2.6) => { G.job.say = text; G.job.sayT = t; };
const ev = (G, e) => G.events.push(e);

function upgraded(G, id) { return !!(G.story && G.story.upgrades && G.story.upgrades[id]); }

// ------------------------------------------------------------------ commands
export function jobAct(G, c) {
    const J = G.job;
    if (!J || J.stage === 'done') return false;
    switch (c.t) {
        case 'tool': setTool(G, c.tool); return true;
        case 'reverse': J.reverse = !J.reverse; return true;
        case 'move': ptrMove(G, c); return true;
        case 'down': ptrMove(G, c); pointerDown(G, c); return true;
        case 'up': pointerUp(G); return true;
        case 'spare': return takeSpare(G, c.spec);
        case 'return': return returnHeld(G);
        case 'test': return startTest(G);
        case 'hint': J.stats.hints++; J.hint = c.text || ''; return true;
        default: return false;
    }
}

function setTool(G, tool) {
    if (G.tool === tool) {
        // choosing the driver or ratchet again cycles its bit or socket
        if (tool === 'driver') G.bit = G.bit === 'phil' ? 'flat' : 'phil';
        else if (tool === 'ratchet') G.socket = G.socket === 8 ? 10 : G.socket === 10 ? 13 : 8;
        ev(G, { type: 'tool', tool, bit: G.bit, socket: G.socket });
        return;
    }
    G.tool = tool;
    ev(G, { type: 'tool', tool, bit: G.bit, socket: G.socket });
}
function autoEquip(G, ref) {
    const J = G.job, dev = J.dev;
    if (G.manual) return;
    if (!canAct(dev, G.tool, ref)) {
        const t = defaultTool(dev, ref);
        if (t && t !== G.tool) { G.tool = t; ev(G, { type: 'tool', tool: t, bit: G.bit, socket: G.socket, auto: true }); }
    }
    const r = parseRef(ref);
    if (r && r.k === 'hole') {
        const b = bitFor(holeOf(dev, r.id).hole.type);
        if (b.bit && G.bit !== b.bit) { G.bit = b.bit; ev(G, { type: 'tool', tool: 'driver', bit: G.bit, socket: G.socket, auto: true }); }
        if (b.size && G.socket !== b.size) { G.socket = b.size; ev(G, { type: 'tool', tool: 'ratchet', bit: G.bit, socket: G.socket, auto: true }); }
    }
}

function ptrMove(G, c) {
    const p = G.ptr;
    if (c.bx !== undefined) {
        const d = Math.hypot(c.bx - p.bx, c.bz - p.bz);
        if (d < 4) { p.travel += d; if (G.job.held) G.job.held.travel += d; }
        p.bx = c.bx; p.bz = c.bz;
    }
    if (c.ax !== undefined) { p.ax = c.ax; p.az = c.az; }
    // the point on whatever surface is under the pointer (the bench plane when nothing is)
    if (c.px !== undefined) { p.px = c.px; p.pz = c.pz; } else if (c.bx !== undefined) { p.px = c.bx; p.pz = c.bz; }
    if (c.ref !== undefined) p.ref = c.ref;
}

function pointerDown(G, c) {
    const J = G.job, dev = J.dev, p = G.ptr;
    p.down = true; p.travel = 0;
    if (J.test) return;
    // a part carried "stuck" to the cursor lands where the next press is
    if (J.held && J.held.sticky) { release(G); return; }
    const ref = c.ref;
    p.ref = ref;
    p.chain = false;
    if (!ref) {
        // a brush or an iron can be pressed on bare bench and dragged onto its target
        if (CONTINUOUS.includes(G.tool) && !J.held) J.use = { k: G.tool, ref: null, acc: 0, t: 0 };
        return;
    }
    autoEquip(G, ref);
    const r = parseRef(ref);
    const tool = G.tool;
    if (!canAct(dev, tool, ref)) {
        if (CONTINUOUS.includes(tool)) { J.use = { k: tool, ref: null, acc: 0, t: 0 }; return; }
        if (G.manual) { ev(G, { type: 'slip', ref }); J.stats.slips++; say(G, `That needs ${toolName(defaultTool(dev, ref))}.`); }
        return;
    }
    // meter, brush, oil and iron work continuously while held; the other tools do one thing per press
    if (CONTINUOUS.includes(tool)) { J.use = { k: tool, ref, acc: 0, t: 0 }; return; }
    switch (r.k) {
        case 'part': return grabPart(G, r.id);
        case 'plug': return grabPlug(G, r.id);
        case 'stash': return takeStash(G, r.id);
        case 'hole': return beginTurn(G, r.id);
        default: break;
    }
}

function toolName(id) {
    return { hand: 'your hands', driver: 'the driver', ratchet: 'the ratchet', pry: 'the pry tool', tweezers: 'tweezers', solder: 'the iron', brush: 'the brush', oil: 'the oil can', probe: 'the meter' }[id] || 'another tool';
}

function pointerUp(G) {
    const J = G.job, p = G.ptr;
    p.down = false; p.chain = false;
    if (J.use) { ev(G, { type: 'use_end', k: J.use.k }); J.use = null; }
    const h = J.held;
    if (h && !h.sticky) {
        // a quick, small press picks the thing up and lets go of the button: carry it until the next press
        if (h.t < TUNE.tapTime && h.travel < TUNE.tapDist) { h.sticky = true; J.stats.taps++; return; }
        release(G);
    }
}

// ------------------------------------------------------------------ carrying
function grabPart(G, id) {
    const J = G.job, dev = J.dev;
    const part = dev.parts[id];
    if (!part || J.held) return;
    if (part.loc === 'slot') {
        const lc = liftCheck(dev, part);
        if (!lc.ok) { ev(G, { type: 'bonk', ref: `part:${id}`, why: lc.why }); say(G, lc.text); J.stats.wrong++; return; }
        const slot = dev.slots[part.slot];
        const pl = slotPlace(dev, slot);
        part.pos = [pl.x, pl.y, pl.z]; part.yaw = pl.yaw;
        part.loc = 'free'; part.slot = null;
        slot.occ = null;
        // anything that rides on this part (chips on a board) is now carried with it
        ev(G, { type: 'lift', ref: `part:${id}`, from: slot.id });
        if (part.mod === 'gov') { J.gov.pulled = true; ev(G, { type: 'gov_pulled' }); }
    } else if (part.loc === 'free') ev(G, { type: 'pick', ref: `part:${id}` });
    part.loc = 'held';
    J.held = { k: 'part', id, sticky: false, t: 0, travel: 0 };
    G.ptr.travel = 0;
}

function grabPlug(G, id) {
    const J = G.job, dev = J.dev;
    const [wid, e] = id.split('.');
    const w = dev.wires[wid], end = w.ends[+e];
    if (J.held) return;
    if (end.at) {
        // unplugging: the part must at least be reachable
        const [sid, pid] = end.at.split('.');
        const slot = dev.slots[sid];
        if (blockers(dev, slot).length) { say(G, `Something is in the way: ${blockers(dev, slot)[0].name}.`); ev(G, { type: 'bonk', ref: `plug:${id}`, why: 'covered' }); return; }
        const pos = portWorld(dev, end.at);
        slot.ports.find((p) => p.id === pid).plug = null;
        end.pos = pos.slice();
        end.at = null;
        ev(G, { type: 'unplug', wire: wid, end: +e });
    } else ev(G, { type: 'pick', ref: `plug:${id}` });
    J.held = { k: 'plug', w: wid, e: +e, sticky: false, t: 0, travel: 0 };
    G.ptr.travel = 0;
}

function takeStash(G, id) {
    const J = G.job, dev = J.dev;
    const st = dev.stash.find((s) => s.id === id);
    if (!st || st.taken) return;
    if (!stashOpen(dev, st)) { say(G, 'Something is sitting on it.'); return; }
    st.taken = true;
    J.found.push(st.id);
    ev(G, { type: 'stash', id: st.id, clue: st.clue, label: st.label });
}

function release(G) {
    const J = G.job, dev = J.dev, h = J.held;
    if (!h) return;
    J.held = null;
    if (h.k === 'plug') {
        const w = dev.wires[h.w], end = w.ends[h.e];
        // the port this end belongs to, if it is within reach and its module is in place
        const [sid, pid] = end.port.split('.');
        const slot = dev.slots[sid];
        const [wx, wz] = clampBench(G.ptr.ax, G.ptr.az);
        end.pos = [wx, end.pos[1], wz];
        const wp = end.pos;
        const port = slot.ports.find((p) => p.id === pid);
        let ok = false;
        if (slot.occ && !port.plug && !blockers(dev, slot).length) {
            const pw = portWorld(dev, end.port);
            if (Math.hypot(pw[0] - wp[0], pw[2] - wp[2]) < TUNE.plugSnap + 0.3 && wp[1] < pw[1] + 1.8) ok = true;
        }
        if (ok) {
            end.at = end.port; end.pos = null; port.plug = `${w.id}.${h.e}`;
            ev(G, { type: 'plug', wire: w.id, end: h.e });
            const tr = dev.truth.find((t) => t.type === 'unplugged' && t.wire === w.id && t.end === h.e);
            if (tr) tr.fixed = true;
        } else {
            const nearWrong = dev.slotOrder.some((id) => dev.slots[id].ports.some((p) => {
                if (p.plug || !dev.slots[id].occ) return false;
                const pw = portWorld(dev, `${id}.${p.id}`);
                return pw && Math.hypot(pw[0] - wp[0], pw[2] - wp[2]) < TUNE.plugSnap;
            }));
            end.pos = [wp[0], 0.14, wp[2]];
            if (nearWrong) { say(G, `The ${w.color} plug goes to the ${w.color}-ringed socket.`); ev(G, { type: 'bonk', ref: `plug:${w.id}.${h.e}`, why: 'wrong' }); J.stats.wrong++; }
            else ev(G, { type: 'drop', ref: `plug:${w.id}.${h.e}` });
        }
        return;
    }
    const part = dev.parts[h.id];
    const [x, z] = clampBench(G.ptr.ax, G.ptr.az);
    part.pos[0] = x; part.pos[2] = z;
    const slot = snapSlot(dev, part);
    if (slot) { seat(G, part, slot); return; }
    // a wrong-spec part dropped right over an empty slot: say why it will not go
    for (const id of dev.slotOrder) {
        const s = dev.slots[id];
        if (s.occ || s.mod !== part.mod) continue;
        const pl = slotPlace(dev, s);
        if (Math.hypot(pl.x - x, pl.z - z) < TUNE.snap && !placeCheck(dev, part, s).ok) {
            const chk = placeCheck(dev, part, s);
            say(G, chk.text); ev(G, { type: 'bonk', ref: `part:${part.id}`, why: chk.why }); J.stats.wrong++;
            break;
        }
    }
    // the scrap bin
    if (Math.hypot(x - BIN.x, z - BIN.z) < BIN.r + 0.3) {
        if (part.spare || isDefective(part) || part.mod === 'gov') { scrap(G, part); return; }
        say(G, 'That one is fine. Keep it.'); ev(G, { type: 'bonk', ref: `part:${part.id}`, why: 'fine' });
    }
    drop(G, part);
}

function drop(G, part) {
    const J = G.job, dev = J.dev;
    part.loc = 'free';
    // loose parts cannot rest on the device: slide them out to the nearest edge
    const hw = dev.W / 2 + 0.3, hd = dev.D / 2 + 0.3;
    if (Math.abs(part.pos[0]) < hw + part.w / 2 && Math.abs(part.pos[2]) < hd + part.d / 2) {
        const dx = hw + Math.max(part.w, part.d) / 2 - Math.abs(part.pos[0]), dz = hd + Math.max(part.w, part.d) / 2 - Math.abs(part.pos[2]);
        if (dz <= dx) part.pos[2] = (part.pos[2] >= 0 ? 1 : -1) * (hd + Math.max(part.w, part.d) / 2 + 0.05);
        else part.pos[0] = (part.pos[0] >= 0 ? 1 : -1) * (hw + Math.max(part.w, part.d) / 2 + 0.05);
        [part.pos[0], part.pos[2]] = clampBench(part.pos[0], part.pos[2]);
    }
    part.pos[1] = 0;
    ev(G, { type: 'drop', ref: `part:${part.id}` });
}

function seat(G, part, slot) {
    const J = G.job, dev = J.dev;
    part.loc = 'slot'; part.slot = slot.id; slot.occ = part.id;
    // a spare takes on the cable colours of the socket it joins
    part.ports = slot.ports.map((p) => ({ id: p.id, kind: p.kind, ox: p.ox, oy: p.oy, oz: p.oz, color: p.color, hex: p.hex, tag: p.tag }));
    part.name = slot.name;
    part.yaw = slot.yaw;
    ev(G, { type: 'seat', ref: `part:${part.id}`, slot: slot.id });
    if (part.mod === 'gov') J.gov.pulled = false;
    if (slot.holes.length === 0) ev(G, { type: 'secured', slot: slot.id });
}

function scrap(G, part) {
    const J = G.job, dev = J.dev;
    part.loc = 'scrap';
    J.stats.scrapped++;
    ev(G, { type: 'scrap', ref: `part:${part.id}`, bad: isDefective(part) });
    if (part.mod !== 'gov') say(G, isDefective(part) ? 'Into the scrap bin. Good riddance.' : 'Scrapped.');
}

function returnHeld(G) {
    const J = G.job, h = J.held;
    if (!h || h.k !== 'part') return false;
    const part = J.dev.parts[h.id];
    if (!part.spare) return false;
    J.held = null;
    part.loc = 'scrap';
    const price = part.price || 0;
    J.stats.spent -= price;
    ev(G, { type: 'return', ref: `part:${part.id}`, price });
    say(G, `Returned to the drawer (+${price} cr).`);
    return true;
}

function takeSpare(G, spec) {
    const J = G.job, dev = J.dev;
    const sp = dev.spares.find((s) => s.spec === spec);
    if (!sp || J.held) return false;
    const m = MODS[sp.mod];
    const id = `p${dev.n.p++}`;
    const price = upgraded(G, 'account') ? Math.ceil(sp.price / 2) : sp.price;
    dev.parts[id] = {
        id, mod: sp.mod, spec: sp.spec, name: m.name, loc: 'free', slot: null, pos: [SPAWN.x + ((dev.n.p % 3) - 1) * 0.5, 0, SPAWN.z - ((dev.n.p % 2) * 0.6)], yaw: 0, w: m.w, d: m.d, h: m.h,
        cond: { burnt: 0, dead: 0, cracked: 0, corr: 0, clog: 0, dust: 0, seized: 0, joints: [] }, probed: false, small: !!m.small, spare: true, home: null, ports: [], price,
    };
    J.stats.spent += price;
    ev(G, { type: 'spare', ref: `part:${id}`, spec, price });
    return true;
}

// ------------------------------------------------------------------ holding a tool on a screw
function beginTurn(G, id) {
    const J = G.job, dev = J.dev;
    const { slot, hole } = holeOf(dev, id);
    const f = FAST[hole.type];
    const part = slot.occ && dev.parts[slot.occ];
    if (!part) return;
    // bit and socket must match when the player chooses their own tools
    if (G.manual) {
        const need = bitFor(hole.type);
        if ((need.bit && G.bit !== need.bit) || (need.size && G.socket !== need.size)) {
            J.stats.slips++; ev(G, { type: 'slip', ref: `hole:${id}` });
            say(G, f.tool === 'driver' ? `That wants the ${need.bit === 'phil' ? 'Phillips' : 'slotted'} bit.` : `That wants the ${need.size} mm socket.`);
            return;
        }
    }
    if (blockers(dev, slot).length) { say(G, `Something is in the way: ${blockers(dev, slot)[0].name}.`); return; }
    const dir = hole.prog >= 0.999 ? -1 : hole.prog <= 0.001 ? 1 : (J.reverse ? -hole.dir : hole.dir);
    J.use = { k: 'turn', ref: `hole:${id}`, dir, acc: 0, t: 0, slipped: false };
    hole.dir = dir;
}

// ------------------------------------------------------------------ the fixed-step update
export function jobStep(G, dt) {
    const J = G.job;
    if (!J) return;
    J.time += dt;
    if (J.sayT > 0) { J.sayT -= dt; if (J.sayT <= 0) J.say = ''; }
    const dev = J.dev;
    updateHeld(G, dt);
    if (J.use) applyUse(G, dt);
    else if (G.ptr.down && G.ptr.chain && !J.held && !J.test) tryChain(G);
    // irons cool, parts settle
    for (const part of Object.values(dev.parts)) {
        for (const j of part.cond.joints || []) if (!j.done && !(J.use && J.use.k === 'solder' && J.use.ref === `joint:${part.id}.${part.cond.joints.indexOf(j)}`)) j.heat = Math.max(0, j.heat - TUNE.heatDown * dt);
    }
    for (const w of Object.values(dev.wires)) if (w.cut && !w.cut.done && !(J.use && J.use.k === 'solder' && J.use.ref === `cut:${w.id}`)) w.cut.heat = Math.max(0, w.cut.heat - TUNE.heatDown * dt);
    relax(G, dt);
    if (J.test) testTick(G, dt);
}

function updateHeld(G, dt) {
    const J = G.job, dev = J.dev, h = J.held, p = G.ptr;
    if (!h) return;
    h.t += dt;
    const k = 1 - Math.exp(-dt * 26);
    if (h.k === 'part') {
        const part = dev.parts[h.id];
        const [tx, tz] = clampBench(p.ax, p.az);
        part.pos[0] += (tx - part.pos[0]) * k;
        part.pos[2] += (tz - part.pos[2]) * k;
        part.pos[1] += (HOVER - part.pos[1]) * k;
    } else {
        const w = dev.wires[h.w], end = w.ends[h.e];
        const other = wireEndPos(dev, w, 1 - h.e);
        let [tx, tz] = clampBench(p.ax, p.az);
        // the cable can only stretch so far from its other end
        const dx = tx - other[0], dz = tz - other[2], d = Math.hypot(dx, dz);
        if (d > w.len * 0.92) { tx = other[0] + (dx / d) * w.len * 0.92; tz = other[2] + (dz / d) * w.len * 0.92; }
        end.pos[0] += (tx - end.pos[0]) * k;
        end.pos[2] += (tz - end.pos[2]) * k;
        end.pos[1] += (1.5 - end.pos[1]) * k;
    }
}

/** Loose parts keep out of each other's way. */
function relax(G, dt) {
    const J = G.job, dev = J.dev;
    const free = Object.values(dev.parts).filter((p) => p.loc === 'free');
    for (let i = 0; i < free.length; i++) {
        const a = free[i];
        for (let j = i + 1; j < free.length; j++) {
            const b = free[j];
            const dx = a.pos[0] - b.pos[0], dz = a.pos[2] - b.pos[2];
            const min = (Math.max(a.w, a.d) + Math.max(b.w, b.d)) * 0.42;
            const d = Math.hypot(dx, dz);
            if (d < min) {
                const push = (min - d) * Math.min(1, dt * 8) * 0.5;
                const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
                a.pos[0] += nx * push; a.pos[2] += nz * push; b.pos[0] -= nx * push; b.pos[2] -= nz * push;
            }
        }
        const [cx, cz] = clampBench(a.pos[0], a.pos[2]);
        a.pos[0] = cx; a.pos[2] = cz;
    }
}

function tryChain(G) {
    const J = G.job, dev = J.dev, p = G.ptr;
    const r = parseRef(p.ref);
    if (!r || r.k !== 'hole' || p.ref === p.lastDone) return;
    autoEquip(G, p.ref);
    if (canAct(dev, G.tool, p.ref)) beginTurn(G, r.id);
}

function applyUse(G, dt) {
    const J = G.job, dev = J.dev, u = J.use, p = G.ptr;
    if (!p.down) { J.use = null; return; }
    u.t += dt;
    switch (u.k) {
        case 'turn': return useTurn(G, u, dt);
        case 'solder': return useSolder(G, u, dt);
        case 'brush': return useBrush(G, u, dt);
        case 'oil': return useOil(G, u, dt);
        case 'probe': return useProbe(G, u, dt);
        default: break;
    }
}

function useTurn(G, u, dt) {
    const J = G.job, dev = J.dev, p = G.ptr;
    const id = u.ref.slice(5);
    const found = holeOf(dev, id);
    const { slot, hole } = found;
    const part = slot.occ && dev.parts[slot.occ];
    if (!part) { J.use = null; return; }
    // the tool lifts off if the pointer wanders away from the head
    const hp = holePos(dev, slot, hole);
    if (Math.hypot(p.px - hp[0], p.pz - hp[2]) > TUNE.reach + (hole.type === 'clip' ? 0.3 : 0)) {
        // the tool lifts off the head; with the button still down it can land on the next screw
        J.use = null; p.chain = true; p.lastDone = null;
        return;
    }
    u.idle = false;
    const f = FAST[hole.type];
    if (u.dir < 0 && hole.rust > 0.02) {
        if (!u.slipped) { u.slipped = true; J.stats.slips++; say(G, 'Rusted solid. Oil it first.'); ev(G, { type: 'slip', ref: u.ref, why: 'rust' }); }
        return;
    }
    if (f.tool === 'pry') {
        u.acc += dt;
        if (u.acc >= TUNE.clipTime) {
            hole.prog = u.dir < 0 ? 0 : 1;
            finishHole(G, slot, hole, u.dir);
        }
        return;
    }
    const rate = TUNE.turnRate * (upgraded(G, 'power') ? 1.7 : 1) / f.turns;
    const before = hole.prog;
    hole.prog = clamp(hole.prog + u.dir * rate * dt, 0, 1);
    u.acc += Math.abs(hole.prog - before) * f.turns;
    if (u.acc >= 0.25) { u.acc -= 0.25; ev(G, { type: 'turn', ref: u.ref, tool: f.tool }); }
    if (hole.prog <= 0 && u.dir < 0) finishHole(G, slot, hole, -1);
    else if (hole.prog >= 1 && u.dir > 0) finishHole(G, slot, hole, 1);
}

function finishHole(G, slot, hole, dir) {
    const J = G.job, dev = J.dev;
    const part = dev.parts[slot.occ];
    if (dir < 0) {
        hole.prog = 0;
        J.dish[hole.type] = (J.dish[hole.type] || 0) + 1;
        ev(G, { type: 'screw_out', ref: `hole:${hole.id}`, fast: hole.type });
    } else {
        hole.prog = 1;
        J.dish[hole.type] = Math.max(0, (J.dish[hole.type] || 0) - 1);
        ev(G, { type: 'screw_in', ref: `hole:${hole.id}`, fast: hole.type });
        if (slot.holes.every((h) => h.prog >= 0.999)) ev(G, { type: 'secured', slot: slot.id, part: part.id });
    }
    J.use = null;
    // still holding the button? sliding onto the next screw carries straight on
    G.ptr.chain = true; G.ptr.lastDone = `hole:${hole.id}`;
}

function useSolder(G, u, dt) {
    const J = G.job, dev = J.dev, p = G.ptr;
    // the iron follows the pointer to whatever it is over
    const ref = p.ref;
    const r = parseRef(ref);
    if (!r || (r.k !== 'joint' && r.k !== 'cut')) return;
    u.ref = ref;
    let tgt;
    if (r.k === 'joint') { const j = jointOf(dev, r.id); if (!j || j.joint.done) return; tgt = j.joint; }
    else { const w = dev.wires[r.id]; if (!w.cut || w.cut.done) return; tgt = w.cut; }
    // joints on a board under a part that is still covered cannot be reached
    const fine = upgraded(G, 'fine');
    const lo = TUNE.sweetLo - (fine ? 0.08 : 0), hi = TUNE.sweetHi + (fine ? 0.08 : 0);
    tgt.heat = clamp(tgt.heat + TUNE.heatUp * dt, 0, 1.05);
    if (tgt.heat >= lo && tgt.heat <= hi) {
        tgt.prog += dt / (TUNE.flowTime * (fine ? 0.7 : 1));
        u.acc += dt;
        if (u.acc > 0.18) { u.acc = 0; ev(G, { type: 'solder', ref, heat: tgt.heat }); }
        if (tgt.prog >= 1) {
            tgt.done = true; tgt.heat = 0;
            ev(G, { type: 'fixed', ref, what: r.k });
            J.use = null;
        }
    } else if (tgt.heat > TUNE.burnAt) {
        tgt.over += dt;
        if (tgt.over > 0.5) {
            tgt.over = 0; tgt.prog = Math.max(0, tgt.prog - 0.4); tgt.heat = 0.55;
            J.stats.burns++;
            say(G, 'Too hot! Let it cool; keep the heat in the green.');
            ev(G, { type: 'burn', ref });
        }
    }
}

function useBrush(G, u, dt) {
    const J = G.job, dev = J.dev, p = G.ptr;
    const r = parseRef(p.ref);
    const trav = p.travel; p.travel = 0;
    if (!r || r.k !== 'part' || trav <= 0) return;
    const part = dev.parts[r.id];
    if (!part || part.loc === 'scrap') return;
    const k = TUNE.scrub * (upgraded(G, 'sonic') ? 2 : 1) * Math.min(trav, 1.4);
    const c = part.cond;
    const before = c.corr + c.clog + c.dust;
    c.corr = Math.max(0, c.corr - k * 0.7); c.clog = Math.max(0, c.clog - k * 1.0); c.dust = Math.max(0, c.dust - k * 1.6);
    if (c.corr < 0.02) c.corr = 0;
    if (c.clog < 0.02) c.clog = 0;
    if (c.dust < 0.03) c.dust = 0;
    const after = c.corr + c.clog + c.dust;
    u.acc += trav;
    if (u.acc > 0.7) { u.acc = 0; ev(G, { type: 'scrub', ref: p.ref }); }
    if (before > 0 && after === 0) ev(G, { type: 'fixed', ref: p.ref, what: 'clean' });
    checkExtras(G);
}

function useOil(G, u, dt) {
    const J = G.job, dev = J.dev, p = G.ptr;
    const r = parseRef(p.ref);
    if (!r) return;
    u.acc += dt;
    if (u.acc > 0.16) { u.acc = 0; ev(G, { type: 'drip', ref: p.ref }); }
    if (r.k === 'part') {
        const part = dev.parts[r.id];
        if (part.cond.seized > 0) {
            part.cond.seized = Math.max(0, part.cond.seized - TUNE.oilRate * dt);
            if (part.cond.seized < 0.02) { part.cond.seized = 0; ev(G, { type: 'fixed', ref: p.ref, what: 'oil' }); }
        }
    } else if (r.k === 'hole') {
        const { hole } = holeOf(dev, r.id);
        if (hole.rust > 0) {
            hole.rust = Math.max(0, hole.rust - TUNE.rustRate * dt);
            if (hole.rust < 0.03) {
                hole.rust = 0; ev(G, { type: 'fixed', ref: p.ref, what: 'rust' });
                // the bolt is free: pick the wrench back up
                if (!G.manual) { G.tool = FAST[hole.type].tool; ev(G, { type: 'tool', tool: G.tool, bit: G.bit, socket: G.socket, auto: true }); }
            }
        }
    }
}

/** A reading, as the meter would show it. */
export function probeBad(dev, ref) {
    const r = parseRef(ref);
    if (r.k === 'part') {
        const p = dev.parts[r.id];
        return isDefective(p) || p.cond.corr > 0.2 || jointsLeft(p) > 0;
    }
    if (r.k === 'wire') { const w = dev.wires[r.id]; return !!(w.cut && !w.cut.done) || w.ends.some((e) => !e.at); }
    if (r.k === 'plug') { const w = dev.wires[r.id.split('.')[0]]; return !!(w.cut && !w.cut.done); }
    if (r.k === 'joint') { const j = jointOf(dev, r.id); return !j.joint.done; }
    return false;
}

function useProbe(G, u, dt) {
    const J = G.job, dev = J.dev, p = G.ptr;
    if (p.ref !== u.ref) { u.ref = p.ref; u.t = 0; u.done = false; }
    const r = parseRef(u.ref);
    if (!r || u.done) return;
    const need = upgraded(G, 'meter') ? 0.05 : TUNE.probeTime;
    if (u.t < need) return;
    u.done = true;
    const bad = probeBad(dev, u.ref);
    if (r.k === 'part') {
        const part = dev.parts[r.id];
        part.probed = true;
        J.notes.push({ ref: u.ref, bad, text: `${part.name}: ${bad ? 'reads FAULTY' : 'reads healthy'}` });
    } else if (r.k === 'wire' || r.k === 'plug') {
        const w = dev.wires[r.k === 'wire' ? r.id : r.id.split('.')[0]];
        w.probed = true;
        J.notes.push({ ref: u.ref, bad, text: `${w.color} cable: ${bad ? 'no continuity' : 'continuity ok'}` });
    } else if (r.k === 'joint') {
        const jo = jointOf(dev, r.id);
        jo.part.probed = true;
        J.notes.push({ ref: u.ref, bad, text: `Board joint: ${bad ? 'intermittent' : 'solid'}` });
    }
    ev(G, { type: bad ? 'probe_bad' : 'probe_ok', ref: u.ref });
}

function checkExtras(G) {
    const J = G.job, dev = J.dev;
    for (const e of J.extras) {
        if (e.id === 'clean' && !e.done && Object.values(dev.parts).every((p) => !(p.cond.dust > 0.05) || p.loc === 'scrap')) {
            e.done = true; ev(G, { type: 'extra', id: 'clean' });
        }
    }
}

// ------------------------------------------------------------------ the test
function startTest(G) {
    const J = G.job, dev = J.dev;
    if (J.test || J.held) { if (J.held) say(G, 'Put that down first.'); return false; }
    const flow = flowUntilFail(dev);
    J.stats.tests++;
    J.test = { t: 0, ok: flow.ok, lit: flow.lit, problem: flow.problem, total: dev.flow.length, msg: flow.ok ? 'All systems nominal.' : failMessage(flow.problem) };
    J.stage = 'testing';
    G.ptr.down = false; J.use = null;
    ev(G, { type: 'test_start', ok: flow.ok });
    return true;
}

function testTick(G, dt) {
    const J = G.job, T = J.test;
    T.t += dt;
    const total = TUNE.testTime * (T.ok ? 1 : 0.62);
    const lit = Math.floor(Math.min(1, T.t / (total * 0.7)) * (T.ok ? T.total : T.lit + 1));
    if (lit !== T.shown) { T.shown = lit; ev(G, { type: 'flow', n: lit }); }
    if (T.t >= total) {
        J.test = null;
        if (T.ok) {
            J.stage = 'done';
            finishJob(G);
            ev(G, { type: 'test_pass' });
        } else {
            J.stage = 'work';
            J.stats.fails++;
            say(G, T.msg, 5);
            ev(G, { type: 'test_fail', msg: T.msg, kind: T.problem.kind, ref: T.problem.slot ? `slot:${T.problem.slot}` : `wire:${T.problem.wire}` });
        }
    }
}

/** Marks: one star for working, two for a tidy bench, three for the extras without a burn. */
function finishJob(G) {
    const J = G.job, dev = J.dev;
    const loose = Object.values(dev.parts).filter((p) => p.loc === 'free' || p.loc === 'held').length;
    const tidy = loose === 0;
    checkExtras(G);
    const extrasOk = J.extras.every((e) => e.done);
    let stars = 1;
    if (tidy && J.stats.fails <= 2) stars = 2;
    if (stars === 2 && extrasOk && J.stats.burns === 0 && J.stats.slips <= 6) stars = 3;
    const base = J.base || 0;
    const gross = Math.round(base * TUNE.starMul[stars]);
    const net = Math.max(0, gross - J.stats.spent);
    const govSlot = Object.values(dev.slots).find((x) => x.mod === 'gov');
    const govPulled = !!(govSlot && !govSlot.occ);
    J.result = { govPulled, stars, tidy, extrasOk, loose, gross, spent: J.stats.spent, net, fails: J.stats.fails, burns: J.stats.burns, time: Math.round(J.time) };
}
