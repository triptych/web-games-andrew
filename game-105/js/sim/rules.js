// The rules of a device: where things are, what covers what, what may be lifted or dropped,
// which tool does what, and whether the thing works. Pure functions over a `dev` (see device.js).

import { FAST, TUNE } from '../config.js';
import { SYS_FAIL } from './kinds.js';

// ------------------------------------------------------------------ geometry
/** Rotate a local (x, z) offset by a yaw, the way three.js turns an object about +Y. */
export function rot(ox, oz, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [ox * c + oz * s, -ox * s + oz * c];
}

export function slotPlace(dev, slot) {
    if (!slot.parentPart) return { x: slot.pos[0], y: slot.pos[1], z: slot.pos[2], yaw: slot.yaw };
    const pp = partPlace(dev, dev.parts[slot.parentPart]);
    const [dx, dz] = rot(slot.rel[0], slot.rel[2], pp.yaw);
    return { x: pp.x + dx, y: pp.y + slot.rel[1], z: pp.z + dz, yaw: pp.yaw + slot.relYaw };
}

export function partPlace(dev, part) {
    if (part.loc === 'slot') return slotPlace(dev, dev.slots[part.slot]);
    return { x: part.pos[0], y: part.pos[1], z: part.pos[2], yaw: part.yaw };
}

/** World position of the top of a hole (where the fastener head sits). */
export function holePos(dev, slot, hole) {
    const pl = slotPlace(dev, slot);
    const part = slot.occ ? dev.parts[slot.occ] : null;
    const [dx, dz] = rot(hole.ox, hole.oz, pl.yaw);
    return [pl.x + dx, pl.y + (part ? part.h : 0.3), pl.z + dz];
}

export function portWorld(dev, portId) {
    const [sid, pid] = portId.split('.');
    const slot = dev.slots[sid];
    if (!slot || !slot.occ) return null;
    const port = slot.ports.find((p) => p.id === pid);
    const pl = slotPlace(dev, slot);
    const [dx, dz] = rot(port.ox, port.oz, pl.yaw);
    return [pl.x + dx, pl.y + port.oy, pl.z + dz];
}

export function wireEndPos(dev, wire, e) {
    const end = wire.ends[e];
    if (end.at) {
        const p = portWorld(dev, end.at);
        if (p) return p;
    }
    return end.pos;
}

const overlap = (a, b, m = 0.04) =>
    Math.abs(a[0] - b[0]) < (a[2] + b[2]) / 2 - m && Math.abs(a[1] - b[1]) < (a[3] + b[3]) / 2 - m;

// ------------------------------------------------------------------ covering and lifting
function parentOf(dev, slot) { return slot.parentPart ? dev.parts[slot.parentPart] : null; }

/** Is this slot part of the assembled device (its parent chain all seated)? */
export function inAssembly(dev, slot) {
    const par = parentOf(dev, slot);
    if (!par) return true;
    return par.loc === 'slot' && inAssembly(dev, dev.slots[par.slot]);
}

function descends(dev, slot, ancestor) {
    let s = slot;
    while (s.parentPart) {
        const par = dev.parts[s.parentPart];
        if (par.loc === 'slot' && par.slot === ancestor.id) return true;
        if (par.loc !== 'slot') return false;
        s = dev.slots[par.slot];
    }
    return false;
}

/** Occupied slots of a higher layer that sit over this slot's footprint. */
export function blockers(dev, slot) {
    if (!inAssembly(dev, slot)) return [];
    const out = [];
    for (const id of dev.slotOrder) {
        const t = dev.slots[id];
        if (t === slot || !t.occ || t.layer <= slot.layer) continue;
        if (descends(dev, t, slot) || !inAssembly(dev, t)) continue;
        if (overlap(t.fp, slot.fp)) out.push(t);
    }
    return out;
}

export function slotLabel(slot) { return slot.name; }

/** Can this part leave its slot right now? */
export function liftCheck(dev, part) {
    if (part.loc !== 'slot') return { ok: true };
    const slot = dev.slots[part.slot];
    const tight = slot.holes.filter((h) => h.prog > 0.001);
    if (tight.length) {
        const clips = tight.every((h) => h.type === 'clip');
        return { ok: false, why: 'screws', text: clips ? `Held by ${tight.length} clip${tight.length > 1 ? 's' : ''}.` : `Still fastened down (${tight.length} left).` };
    }
    if (slot.ports.some((p) => p.plug)) return { ok: false, why: 'wires', text: 'Cables are still plugged in.' };
    const b = blockers(dev, slot);
    if (b.length) return { ok: false, why: 'covered', text: `Something is in the way: ${b[0].name}.`, by: b[0].id };
    return { ok: true };
}

export function placeCheck(dev, part, slot) {
    if (slot.occ) return { ok: false, why: 'taken', text: 'Already something there.' };
    if (slot.spec !== part.spec) return { ok: false, why: 'spec', text: `Wrong part: this wants a ${slot.spec}, not a ${part.spec}.` };
    if (slot.parentPart && !dev.parts[slot.parentPart]) return { ok: false, why: 'parent', text: 'Nothing to mount it on.' };
    const b = blockers(dev, slot);
    if (b.length) return { ok: false, why: 'covered', text: `Something is in the way: ${b[0].name}.`, by: b[0].id };
    return { ok: true };
}

/** The slot a carried part would drop into: compatible, empty, uncovered and close enough. */
export function snapSlot(dev, part) {
    let best = null, bd = Infinity;
    const px = part.pos[0], pz = part.pos[2];
    for (const id of dev.slotOrder) {
        const s = dev.slots[id];
        if (s.occ || s.spec !== part.spec) continue;
        if (s.parentPart && !dev.parts[s.parentPart]) continue;
        if (s.parentPart === part.id) continue;
        if (!placeCheck(dev, part, s).ok) continue;
        const pl = slotPlace(dev, s);
        const d = Math.hypot(pl.x - px, pl.z - pz);
        const reach = TUNE.snap + Math.min(s.size[0], s.size[1]) * 0.25;
        if (d < reach && d < bd) { bd = d; best = s; }
    }
    return best;
}

/** Is the stash under an empty, uncovered slot within reach? */
export function stashOpen(dev, st) {
    const slot = dev.slots[st.slot];
    return !st.taken && !slot.occ && blockers(dev, slot).length === 0;
}

// ------------------------------------------------------------------ refs and tools
export function parseRef(ref) {
    if (!ref) return null;
    const i = ref.indexOf(':');
    return { k: ref.slice(0, i), id: ref.slice(i + 1) };
}

export function holeOf(dev, id) {
    const sid = id.split('.')[0];
    const slot = dev.slots[sid];
    if (!slot) return null;
    const hole = slot.holes.find((h) => h.id === id);
    return hole ? { slot, hole } : null;
}

export function jointOf(dev, id) {
    const [pid, j] = id.split('.');
    const part = dev.parts[pid];
    const joint = part && part.cond.joints && part.cond.joints[+j];
    return joint ? { part, joint } : null;
}

/** Can the current tool act on this kind of thing? (Bit and socket are checked separately.) */
export function canAct(dev, tool, ref) {
    const r = parseRef(ref);
    if (!r) return false;
    switch (tool) {
        case 'hand': return r.k === 'plug' || r.k === 'stash' || (r.k === 'part' && !dev.parts[r.id].small);
        case 'tweezers': return r.k === 'stash' || (r.k === 'part' && dev.parts[r.id].small);
        case 'driver': case 'ratchet': case 'pry': {
            if (r.k !== 'hole') return false;
            return FAST[holeOf(dev, r.id).hole.type].tool === tool;
        }
        case 'solder': return r.k === 'joint' || r.k === 'cut';
        case 'brush': return r.k === 'part';
        case 'oil': return r.k === 'part' || r.k === 'hole';
        case 'probe': return r.k === 'part' || r.k === 'wire' || r.k === 'plug' || r.k === 'joint';
        default: return false;
    }
}

/** The tool that does the obvious thing to this ref. */
export function defaultTool(dev, ref) {
    const r = parseRef(ref);
    if (!r) return null;
    switch (r.k) {
        case 'part': return dev.parts[r.id].small ? 'tweezers' : 'hand';
        case 'hole': return FAST[holeOf(dev, r.id).hole.type].tool;
        case 'plug': case 'stash': return 'hand';
        case 'joint': case 'cut': return 'solder';
        case 'wire': return 'probe';
        default: return null;
    }
}

/** Does this fastener need a different bit or socket than the one in hand? */
export function bitFor(type) {
    const f = FAST[type];
    return f.tool === 'driver' ? { bit: f.bit } : f.tool === 'ratchet' ? { size: f.size } : {};
}

// ------------------------------------------------------------------ condition helpers
export function isDefective(part) {
    const c = part.cond;
    return !!(c.burnt || c.dead || c.cracked);
}
export function jointsLeft(part) { return (part.cond.joints || []).filter((j) => !j.done).length; }
export function grimeOf(part) { return (part.cond.corr || 0) + (part.cond.clog || 0); }

/** A short phrase for the status line. */
export function describe(dev, ref, tool) {
    const r = parseRef(ref);
    if (!r) return '';
    if (r.k === 'part') {
        const p = dev.parts[r.id];
        if (!p) return '';
        let s = `${p.name} · ${p.spec}`;
        const c = p.cond;
        if (c.burnt) s += ' · burnt out';
        else if (c.cracked) s += ' · cracked';
        else if (c.dead && p.probed) s += ' · dead';
        if (c.corr > 0.05) s += ' · corroded';
        if (c.clog > 0.05) s += ' · clogged';
        if (c.seized > 0.05) s += ' · stiff';
        if (c.dust > 0.05) s += ' · dusty';
        if (jointsLeft(p)) s += ' · bad joints';
        if (p.loc === 'slot') {
            const lc = liftCheck(dev, p);
            s += lc.ok ? ' · free to lift' : ` · ${lc.text}`;
        }
        return s;
    }
    if (r.k === 'hole') {
        const { slot, hole } = holeOf(dev, r.id);
        const f = FAST[hole.type];
        return `${f.name} · ${hole.prog >= 0.999 ? 'tight' : hole.prog <= 0.001 ? 'empty hole' : 'half turned'}${hole.rust > 0.02 ? ' · rusted' : ''} · ${slot.name}`;
    }
    if (r.k === 'plug') {
        const [wid, e] = r.id.split('.');
        const w = dev.wires[wid];
        return `${w.color} cable plug · ${w.ends[+e].at ? 'plugged in' : 'loose'}`;
    }
    if (r.k === 'wire') return `${dev.wires[r.id].color} cable${dev.wires[r.id].cut && !dev.wires[r.id].cut.done ? ' · severed' : ''}`;
    if (r.k === 'joint') { const j = jointOf(dev, r.id); return `Solder joint · ${j.joint.done ? 'sound' : 'dull and cracked'}`; }
    if (r.k === 'cut') return 'Severed cable · needs solder';
    if (r.k === 'stash') return dev.stash.find((s) => s.id === r.id).label;
    return '';
}

// ------------------------------------------------------------------ does it work?
/**
 * Everything that has to be true for the device to run. Problems come back in flow order so the
 * test can show the power getting as far as the first fault.
 */
export function evaluate(dev) {
    const problems = [];
    const rank = (kind, id) => {
        const i = dev.flow.findIndex((f) => f.t === kind && f.id === id);
        return i < 0 ? 999 : i;
    };
    for (const id of dev.slotOrder) {
        const slot = dev.slots[id];
        if (slot.kind !== 'mod') continue;
        if (!slot.occ) {
            if (!slot.optional) problems.push({ kind: 'missing', slot: id, sys: slot.sys, rank: rank('slot', id), text: `${slot.name} is missing.` });
            continue;
        }
        const part = dev.parts[slot.occ];
        const c = part.cond;
        const add = (kind, text) => problems.push({ kind, slot: id, sys: slot.sys, rank: rank('slot', id), text });
        if (isDefective(part)) add('bad', `${slot.name} has failed.`);
        if (c.corr > 0.05) add('corr', `${slot.name} is corroded.`);
        if (c.clog > 0.05) add('clog', `${slot.name} is clogged.`);
        if (c.seized > 0.05) add('seized', `${slot.name} is stiff.`);
        if (jointsLeft(part)) add('joint', `${slot.name} has bad solder joints.`);
        if (slot.holes.some((h) => h.prog < 0.999)) add('loose', `${slot.name} isn't fastened down.`);
    }
    for (const id of dev.slotOrder) {
        const slot = dev.slots[id];
        if (slot.kind === 'mod') continue;
        // covers and brackets: the device is not finished until they are back on and tight
        if (!slot.occ) problems.push({ kind: 'missing', slot: id, sys: 'wiring', rank: 998, text: `${slot.name} is off.` });
        else if (slot.holes.some((h) => h.prog < 0.999)) problems.push({ kind: 'loose', slot: id, sys: 'wiring', rank: 998, text: `${slot.name} isn't fastened down.` });
    }
    for (const id of dev.wireOrder) {
        const w = dev.wires[id];
        const sys = dev.slots[w.ends[0].port.split('.')[0]].sys;
        if (w.ends.some((e) => !e.at)) problems.push({ kind: 'unplugged', wire: id, sys, rank: rank('wire', id), text: `The ${w.color} cable is unplugged.` });
        else if (w.cut && !w.cut.done) problems.push({ kind: 'cut', wire: id, sys, rank: rank('wire', id), text: `The ${w.color} cable is severed.` });
    }
    problems.sort((a, b) => a.rank - b.rank);
    return { ok: problems.length === 0, problems };
}

export function failMessage(problem) {
    return (SYS_FAIL[problem.kind] || SYS_FAIL.bad)(problem.sys);
}

/** The flow of a test: items light up in order until the first problem. */
export function flowUntilFail(dev) {
    const ev = evaluate(dev);
    if (ev.ok) return { ok: true, lit: dev.flow.length, problem: null };
    const first = ev.problems[0];
    return { ok: false, lit: Math.max(0, Math.min(dev.flow.length - 1, first.rank)), problem: first };
}
