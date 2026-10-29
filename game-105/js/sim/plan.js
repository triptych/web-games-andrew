// The planner: given a job in progress, what is the next sensible thing to do?
// It powers the Hint button and the test bot. It reads the sim state only (it may see which parts
// are faulty, which a player has to find out), so hints stay honest to what is physically in the way
// but are not a replacement for diagnosis.

import { BIN, FAST, SPAWN } from '../config.js';
import { MODS } from './modules.js';
import { blockers, holePos, isDefective, jointsLeft, partPlace, placeCheck, portWorld, rot, slotPlace, stashOpen, wireEndPos } from './rules.js';

/** World position of a ref, for aiming a pointer at it. */
export function refPos(dev, ref) {
    const i = ref.indexOf(':'), k = ref.slice(0, i), id = ref.slice(i + 1);
    if (k === 'part') { const p = partPlace(dev, dev.parts[id]); return [p.x, p.y + dev.parts[id].h / 2, p.z]; }
    if (k === 'hole') { const sid = id.split('.')[0]; const slot = dev.slots[sid]; return holePos(dev, slot, slot.holes.find((h) => h.id === id)); }
    if (k === 'plug') { const [w, e] = id.split('.'); return wireEndPos(dev, dev.wires[w], +e); }
    if (k === 'wire' || k === 'cut') {
        const w = dev.wires[id];
        const a = wireEndPos(dev, w, 0), b = wireEndPos(dev, w, 1);
        const t = w.cut ? w.cut.t : 0.5;
        return [a[0] + (b[0] - a[0]) * t, Math.max(a[1], b[1]) + 0.9, a[2] + (b[2] - a[2]) * t];
    }
    if (k === 'joint') {
        const [pid, j] = id.split('.');
        const part = dev.parts[pid], pl = partPlace(dev, part), jt = part.cond.joints[+j];
        const [dx, dz] = rot(jt.x, jt.z, pl.yaw);
        return [pl.x + dx, pl.y + part.h, pl.z + dz];
    }
    if (k === 'stash') { const s = dev.stash.find((x) => x.id === id); return [s.x, 0.5, s.z]; }
    return [0, 0, 0];
}

/** Where a removed part is parked on the mat. */
export function parkSpot(dev, n) {
    const row = Math.floor(n / 4), col = n % 4;
    return [-3.6 + col * 2.4, Math.min(7.2, Math.max(6.0, dev.D / 2 + 1.5) + row * 1.3)];
}

function freePartFor(dev, spec) {
    return Object.values(dev.parts).find((p) => p.loc === 'free' && p.spec === spec);
}

/** The next goal to get a slot's occupant out of the device. */
function removal(G, slot, opt) {
    const dev = G.job.dev;
    const part = dev.parts[slot.occ];
    const b = blockers(dev, slot);
    if (b.length) return removal(G, b[0], opt);
    const tight = slot.holes.find((h) => h.prog > 0.001);
    if (tight) {
        if (tight.rust > 0.02) return { k: 'oilhole', ref: `hole:${tight.id}`, text: `The ${FAST[tight.type].name.toLowerCase()} on the ${slot.name} is rusted solid. Oil it.` };
        return { k: 'turn', ref: `hole:${tight.id}`, text: `Undo the ${FAST[tight.type].name.toLowerCase()}s on the ${slot.name}: hold on a screw and slide across the rest.` };
    }
    const plugged = slot.ports.find((p) => p.plug);
    if (plugged) {
        const [wid, e] = plugged.plug.split('.');
        return { k: 'unplug', wire: wid, end: +e, ref: `plug:${plugged.plug}`, text: `Pull the ${dev.wires[wid].color} cable out of the ${slot.name} (note its letter, ${dev.wires[wid].tag}) and let it lie.` };
    }
    const toBin = isDefective(part) || (part.mod === 'gov' && opt.pullGov) || part.spare;
    return {
        k: 'lift', part: part.id, dest: toBin ? 'bin' : 'park', ref: `part:${part.id}`,
        text: toBin ? `Lift out the ${slot.name} and drop it in the SCRAP bin.` : `Tap the ${slot.name} to lift it, then tap again to set it down in the PARTS area at the front of the mat.`,
    };
}

const access = (G, slot, opt) => {
    const b = blockers(G.job.dev, slot);
    return b.length ? removal(G, b[0], opt) : null;
};

/** What to do with the thing in your hand. `zone` says where on the bench; `at` where it goes. */
function heldGoal(G, opt) {
    const J = G.job, dev = J.dev, h = J.held;
    if (h.k === 'plug') {
        const w = dev.wires[h.w];
        const at = portWorld(dev, w.ends[h.e].port);
        return at
            ? { k: 'putdown', at, text: `Plug the ${w.color} cable into the socket with the ${w.color} ring and the letter ${w.tag}.` }
            : { k: 'putdown', zone: 'park', text: `Set the ${w.color} cable down on the bench; its socket is not ready yet.` };
    }
    const part = dev.parts[h.id];
    const slot = dev.slotOrder.map((i) => dev.slots[i]).find((s) => !s.occ && s.spec === part.spec && (!s.parentPart || dev.parts[s.parentPart]));
    const fit = slot && placeCheck(dev, part, slot);
    // would the next step be to put this very part back? Look at the job as if it were lying on the bench.
    J.held = null; part.loc = 'free';
    let next = null;
    try { next = nextGoal(G, opt); } finally { part.loc = 'held'; J.held = h; }
    if (fit && fit.ok && next && next.k === 'place' && next.part === part.id) {
        const pl = slotPlace(dev, slot);
        return { k: 'putdown', at: [pl.x, pl.y, pl.z], text: `Fit the ${part.name} into its place: follow the blue ghost outline.` };
    }
    if (isDefective(part) || (part.mod === 'gov' && opt.pullGov) || (part.spare && !slot)) {
        return { k: 'putdown', zone: 'bin', text: `That one is no good. Drop it in the SCRAP bin (front right).` };
    }
    const why = slot && fit && fit.why === 'covered' ? ` Something is still in the way of its place (${fit.text.replace('Something is in the way: ', '').replace('.', '')}).` : '';
    return { k: 'putdown', zone: 'park', text: `Set the ${part.name} down in the PARTS area at the front of the mat. You will need it again.${why}` };
}

/**
 * The next atomic step, or null when the job is finished. opt: { clean, stash, pullGov, probe }.
 */
export function nextGoal(G, opt = {}) {
    const J = G.job, dev = J.dev;
    const slots = dev.slotOrder.map((i) => dev.slots[i]);
    const modSlots = slots.filter((s) => s.kind === 'mod');

    if (J.held) return heldGoal(G, opt);

    // 1. a hidden failure has to be found with the meter first
    for (const s of modSlots) {
        const part = s.occ && dev.parts[s.occ];
        if (part && part.cond.dead && !part.probed) {
            const a = access(G, s, opt);
            return a || { k: 'probe', ref: `part:${part.id}`, text: `Check the ${s.name} with the meter.` };
        }
    }
    // 2. replacements
    for (const s of modSlots) {
        const part = s.occ && dev.parts[s.occ];
        if (part && isDefective(part)) return removal(G, s, opt);
    }
    for (const s of modSlots) {
        if (s.occ || s.optional) continue;
        // a slot that was emptied for a replacement and has no matching original lying around
        const home = Object.values(dev.parts).find((p) => p.home === s.id && p.loc !== 'scrap' && !isDefective(p));
        if (home) continue;
        const have = freePartFor(dev, s.spec);
        if (have) {
            const a = access(G, s, opt);
            return a || { k: 'place', part: have.id, slot: s.id, ref: `part:${have.id}`, text: `Pick up the new ${s.spec} and fit it into the ${s.name}: follow the blue ghost.` };
        }
        return { k: 'spare', spec: s.spec, text: `Open Spares and take a ${s.spec}: the label must match the one on the burnt part.` };
    }
    // 3. cleaning, oiling, soldering, loose plugs
    for (const s of modSlots) {
        const part = s.occ && dev.parts[s.occ];
        if (!part) continue;
        if (part.cond.corr > 0.02 || part.cond.clog > 0.02) { const a = access(G, s, opt); return a || { k: 'brush', ref: `part:${part.id}`, text: `Scrub the ${s.name} clean with the brush.` }; }
        if (part.cond.seized > 0.02) { const a = access(G, s, opt); return a || { k: 'oil', ref: `part:${part.id}`, text: `Oil the stiff ${s.name}.` }; }
        if (jointsLeft(part)) {
            const a = access(G, s, opt);
            const j = part.cond.joints.findIndex((x) => !x.done);
            return a || { k: 'solder', ref: `joint:${part.id}.${j}`, text: `Re-flow the dull joints on the ${s.name} with the iron.` };
        }
    }
    for (const wid of dev.wireOrder) {
        const w = dev.wires[wid];
        if (w.cut && !w.cut.done) {
            for (const e of w.ends) { const a = access(G, dev.slots[e.port.split('.')[0]], opt); if (a) return a; }
            return { k: 'solder', ref: `cut:${wid}`, text: `The ${w.color} cable is severed. Join it with the iron.` };
        }
    }
    // a plug that was loose when it came in (not one pulled out just now to reach something else)
    for (const t of dev.truth) {
        if (t.type !== 'unplugged' || t.fixed) continue;
        const w = dev.wires[t.wire];
        if (w.ends[t.end].at) continue;
        const slot = dev.slots[w.ends[t.end].port.split('.')[0]];
        if (!slot.occ) continue;
        const a = access(G, slot, opt);
        return a || { k: 'plugin', wire: t.wire, end: t.end, ref: `plug:${t.wire}.${t.end}`, text: `Plug the ${w.color} cable back into the ${slot.name}.` };
    }
    // 4. optional work
    if (opt.stash) {
        for (const st of dev.stash) {
            if (st.taken) continue;
            const slot = dev.slots[st.slot];
            if (slot.occ) return removal(G, slot, opt);
            const a = access(G, slot, opt);
            return a || { k: 'stash', id: st.id, ref: `stash:${st.id}`, text: 'Something is hidden under there.' };
        }
    }
    if (opt.pullGov) {
        for (const s of modSlots) if (s.mod === 'gov' && s.occ) return removal(G, s, opt);
    }
    if (opt.clean) {
        for (const s of slots) {
            const part = s.occ && dev.parts[s.occ];
            if (part && part.cond.dust > 0.05) { const a = access(G, s, opt); if (a) continue; return { k: 'brush', ref: `part:${part.id}`, text: `Wipe the dust off the ${s.name}.` }; }
        }
    }
    // 5. put it all back: lowest layer first, fasteners and cables as each goes on
    const order = slots.slice().sort((x, y) => x.layer - y.layer);
    for (const s of order) {
        if (!s.occ) {
            const have = freePartFor(dev, s.spec);
            if (!have) continue;
            const a = access(G, s, opt);
            return a || { k: 'place', part: have.id, slot: s.id, ref: `part:${have.id}`, text: `Put the ${s.name} back where it came from (a blue ghost shows the place).` };
        }
        if (blockers(dev, s).length) continue;
        const tight = s.holes.find((h) => h.prog < 0.999);
        if (tight) return { k: 'turn', ref: `hole:${tight.id}`, text: `Screw the ${s.name} down again: hold the driver on each empty hole.` };
        for (const wid of dev.wireOrder) {
            const w = dev.wires[wid];
            for (let e = 0; e < 2; e++) {
                if (!w.ends[e].at && w.ends[e].port.startsWith(s.id + '.')) return { k: 'plugin', wire: wid, end: e, ref: `plug:${wid}.${e}`, text: `Plug the ${w.color} cable back in: its plug matches the socket with the ${w.color} ring and the letter ${w.tag}.` };
            }
        }
    }
    return { k: 'test', text: 'Everything is back where it belongs. Press Test.' };
}

export { stashOpen, MODS, BIN, SPAWN, slotPlace, portWorld };
