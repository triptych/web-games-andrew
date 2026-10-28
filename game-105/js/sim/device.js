// The device generator. A kind, a tier and a seed become a layout of slots (where things go),
// parts (what is there), cables between them, the faults that make it a job, and the spares drawer.
// Pure: it takes its randomness from the seed and never reads the clock.
//
//   slot  = a place something sits: position, footprint, layer, fastener holes, cable ports.
//   part  = a thing in (or out of) a slot, with a condition (burnt, corroded, stiff, dusty...).
//   wire  = a cable with a coloured plug at each end, plugged into two ports.
//
// Layers decide what covers what: modules 1, parts on boards 2, brackets 3, cover panels 4.

import { makeRng } from '../rng.js';
import { FLOOR_Y, TIERS, WIRE_COLORS, FAST } from '../config.js';
import { MODS, DECOY_MODS, holeOffsets } from './modules.js';
import { KINDS } from './kinds.js';
import { evaluate, portWorld, rot, slotPlace } from './rules.js';

const GND_COLORS = [{ id: 'black', hex: 0x2a2d35 }, { id: 'brown', hex: 0x9a6a3c }, { id: 'slate', hex: 0x6b7a90 }];
const TAGS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const round = (v, q = 0.1) => Math.round(v / q) * q;

function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

/** First-fit packing of rectangles into a region, scanning rows. Returns centres or null. */
function pack(rng, items, region, gap, step = 0.25, lenient = false) {
    const placed = [];
    const out = [];
    for (const it of items) {
        let spot = null;
        const tries = it.rot ? shuffle(rng, [false, true]) : [false];
        for (const rotated of tries) {
            const w = rotated ? it.d : it.w, d = rotated ? it.w : it.d;
            for (let z = region.z0 + d / 2; z <= region.z1 - d / 2 + 1e-6 && !spot; z += step) {
                for (let x = region.x0 + w / 2; x <= region.x1 - w / 2 + 1e-6; x += step) {
                    let clash = false;
                    for (const p of placed) {
                        if (Math.abs(x - p.x) < (w + p.w) / 2 + gap && Math.abs(z - p.z) < (d + p.d) / 2 + gap) { clash = true; break; }
                    }
                    if (!clash) { spot = { x, z, w, d, yaw: rotated ? Math.PI / 2 : 0 }; break; }
                }
            }
            if (spot) break;
        }
        if (!spot) { if (lenient) { out.push(null); continue; } return null; }
        placed.push(spot);
        out.push(spot);
    }
    return out;
}

function pickHoleType(rng, K, mod) {
    const pool = K.holes.filter((t) => t !== 'clip');
    // a module and its siblings share a screw family, so the bench has a few kinds, not a dozen
    return pool[Math.floor(rng() * pool.length)];
}

function makeHoles(rng, slot, type, rustP) {
    const out = [];
    holeOffsets(slot.mod, slot.mod === 'board' || slot.kind !== 'mod' ? slot.local[0] : slot.local[0], slot.local[1]).forEach(([ox, oz], i) => {
        out.push({ id: `${slot.id}.${i}`, type, ox, oz, prog: 1, dir: -1, rust: rng() < rustP && type !== 'clip' ? round(0.5 + rng() * 0.5, 0.05) : 0 });
    });
    return out;
}

const emptyCond = () => ({ burnt: 0, dead: 0, cracked: 0, corr: 0, clog: 0, dust: 0, seized: 0, joints: [] });

export function generateDevice(seed, kindId, tier, opts = {}) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const rng = makeRng((seed * 2654435761 + attempt * 97 + 13) >>> 0);
        const dev = tryBuild(rng, kindId, tier, opts, attempt);
        if (dev) {
            const v = validate(dev);
            if (v.ok) { dev.seed = seed; dev.attempt = attempt; return dev; }
            if (typeof process !== 'undefined' && process.env && process.env.GENDEBUG) console.log('  reject', kindId, tier, attempt, v.errors.slice(0, 3).join(' | '));
        } else if (typeof process !== 'undefined' && process.env && process.env.GENDEBUG) console.log('  nopack', kindId, tier, attempt);
    }
    throw new Error(`generator failed for ${kindId} tier ${tier} seed ${seed}`);
}

function tryBuild(rng, kindId, tier, opts, attempt) {
    const K = KINDS[kindId];
    const T = TIERS[tier];

    const dev = {
        kind: kindId, tier, W: 0, D: 0, floorY: FLOOR_Y, slots: {}, slotOrder: [], parts: {}, wires: {}, wireOrder: [],
        stash: [], flow: [], spares: [], truth: [], extras: [], n: { s: 0, p: 0, w: 0, t: 0, b: 0 },
        serial: 'SR-' + (Math.floor(rng() * 0xffff) + 0x1000).toString(16).toUpperCase(),
        complaint: '', gov: false,
    };
    const nid = (k) => `${k}${dev.n[k]++}`;

    // ---- which roles are present
    const core = K.roles.filter((r) => r.min <= 1);
    let roles = core.slice();
    for (const r of K.roles) if (r.min > 1 && r.min <= tier && roles.length < Math.max(T.mods, core.length) && !roles.includes(r)) roles.push(r);
    const have = new Set(roles.map((r) => r.role));
    const wireT = K.wires.filter(([a, b]) => have.has(a.split('.')[0]) && have.has(b.split('.')[0]));
    const sockets = wireT.reduce((n, [a, b]) => n + (a.startsWith('board.') ? 1 : 0) + (b.startsWith('board.') ? 1 : 0), 0);

    // ---- board size, then the parts on it
    const hasBoard = have.has('board');
    const nSubs = hasBoard ? rng.int(T.subs[0], T.subs[1]) : 0;
    const govOn = !!(K.gov && hasBoard && (opts.gov !== undefined ? opts.gov : rng() < 0.6));
    dev.gov = govOn;
    const rows = sockets > 7 ? 2 : 1;
    let bw = Math.max(3.6, Math.ceil(sockets / rows) * 0.82 + 1.4), bd = 2.9 + Math.min(nSubs + (govOn ? 1 : 0), 6) * 0.12 + (rows - 1) * 0.9;
    bw = round(bw, 0.1); bd = round(bd, 0.1);

    // ---- top-level layout. The device is sized to what goes in it, so every kind and tier fits.
    const items = roles.map((r) => {
        const m = MODS[r.mod];
        return r.role === 'board' ? { r, w: bw, d: bd, rot: false } : { r, w: m.w, d: m.d, rot: true };
    });
    const GAP = 0.48;
    const need = items.reduce((a, i) => a + (i.w + GAP) * (i.d + GAP), 0) / Math.max(0.4, 0.66 - attempt * 0.03);
    const aspect = K.dims[0] / K.dims[1];
    const rD = Math.sqrt(need / aspect);
    const W = round(Math.min(15.2, Math.max(K.dims[0] * 0.9, rD * aspect + 1.4)), 0.1), D = round(Math.min(9.4, Math.max(K.dims[1] * 0.9, rD + 1.4)), 0.1);
    dev.W = W; dev.D = D;
    const order = shuffle(rng, items.filter((i) => i.r.role !== 'board')).sort((a, b) => b.w * b.d - a.w * a.d);
    const ordered = hasBoard ? [items.find((i) => i.r.role === 'board'), ...order] : order;
    const region = { x0: -W / 2 + 0.7, x1: W / 2 - 0.7, z0: -D / 2 + 0.7, z1: D / 2 - 0.7 };
    const spots = pack(rng, ordered, region, GAP);
    if (!spots) return null;
    // centre the packed block, then maybe mirror it
    const bb = spots.reduce((b, s) => ({ x0: Math.min(b.x0, s.x - s.w / 2), x1: Math.max(b.x1, s.x + s.w / 2), z0: Math.min(b.z0, s.z - s.d / 2), z1: Math.max(b.z1, s.z + s.d / 2) }), { x0: 9e9, x1: -9e9, z0: 9e9, z1: -9e9 });
    const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
    const fx = rng() < 0.5 ? -1 : 1, fz = rng() < 0.5 ? -1 : 1;
    spots.forEach((s) => { s.x = round((s.x - cx) * fx, 0.05); s.z = round((s.z - cz) * fz, 0.05); });

    // ---- slots and the parts in them
    const specUsed = new Set();
    const pickSpec = (mod) => {
        const list = shuffle(rng, MODS[mod].specs);
        return list.find((s) => !specUsed.has(s)) || list[0];
    };
    const addSlot = (o) => {
        const slot = Object.assign({
            id: nid('s'), kind: 'mod', layer: 1, yaw: 0, parentPart: null, rel: null, relYaw: 0, holes: [], ports: [], occ: null, optional: false,
        }, o);
        dev.slots[slot.id] = slot; dev.slotOrder.push(slot.id);
        return slot;
    };
    const addPart = (slot, extra = {}) => {
        const m = MODS[slot.mod];
        const part = Object.assign({
            id: nid('p'), mod: slot.mod, spec: slot.spec, name: slot.name, loc: 'slot', slot: slot.id, pos: [0, 0, 0], yaw: slot.yaw,
            w: slot.local[0], d: slot.local[1], h: m.h, cond: emptyCond(), probed: false, small: !!m.small, spare: false, home: slot.id, ports: [],
        }, extra);
        dev.parts[part.id] = part; slot.occ = part.id;
        part.ports = slot.ports.map((p) => ({ id: p.id, kind: p.kind, ox: p.ox, oy: p.oy, oz: p.oz, color: p.color, hex: p.hex, tag: p.tag }));
        return part;
    };

    const byRole = {};
    ordered.forEach((it, i) => {
        const r = it.r, m = MODS[r.mod], s = spots[i];
        const slot = addSlot({
            role: r.role, name: r.name, mod: r.mod, sys: m.sys, spec: r.mod === 'board' ? `PCB-${rng.int(10, 99)}` : pickSpec(r.mod),
            pos: [s.x, FLOOR_Y, s.z], yaw: s.yaw, size: [s.w, s.d], fp: [s.x, s.z, s.w, s.d], local: [it.w, it.d], layer: 1,
        });
        specUsed.add(slot.spec);
        byRole[r.role] = slot;
        // fastener holes
        if (m.holes) {
            const type = pickHoleType(rng, K, r.mod);
            slot.holes = holeOffsets(r.mod, it.w, it.d).map(([ox, oz], k) => ({
                id: `${slot.id}.${k}`, type, ox, oz, prog: 1, dir: -1, rust: rng() < T.rust ? round(0.5 + rng() * 0.5, 0.05) : 0,
            }));
        }
        // fixed ports
        slot.ports = m.ports.map((p) => ({ id: p.id, kind: p.kind, ox: p.ox, oy: m.h, oz: p.oz, color: null, hex: 0, tag: null, plug: null }));
    });

    // ---- board sockets, in the order the cables need them
    const board = byRole.board;
    let sock = 0;
    const socketFor = (kind) => {
        const k = sock++;
        const per = Math.ceil(sockets / rows), col = k % per, row = Math.floor(k / per);
        const sp = per > 1 ? (bw - 1.5) / (per - 1) : 0;
        const p = { id: `j${k}`, kind, ox: per > 1 ? -bw / 2 + 0.75 + col * sp : 0, oy: MODS.board.h, oz: -bd / 2 + 0.5 + row * 0.9, color: null, hex: 0, tag: null, plug: null };
        board.ports.push(p);
        return p.id;
    };

    // ---- cables
    const palette = shuffle(rng, WIRE_COLORS);
    let pi = 0, gi = 0;
    const portExists = (role, pid) => byRole[role].ports.some((p) => p.id === pid);
    wireT.forEach(([a, b, kind]) => {
        const ends = [a, b].map((s) => {
            const [role, port] = s.split('.');
            return `${byRole[role].id}.${port === '#' ? socketFor(kind) : port}`;
        });
        if (!ends.every((e) => { const [sid, pid] = e.split('.'); return dev.slots[sid].ports.some((p) => p.id === pid); })) return;
        const col = kind === 'gnd' ? GND_COLORS[gi++ % GND_COLORS.length] : palette[pi++ % palette.length];
        const w = { id: nid('w'), color: col.id, hex: col.hex, kind, tag: TAGS[dev.n.w - 1 % TAGS.length] || '?', len: 4, ends: ends.map((e) => ({ port: e, at: e, pos: null })), cut: null, probed: false };
        w.tag = TAGS[(dev.n.w - 1) % TAGS.length];
        ends.forEach((e) => {
            const [sid, pid] = e.split('.');
            const port = dev.slots[sid].ports.find((p) => p.id === pid);
            port.color = col.id; port.hex = col.hex; port.tag = w.tag; port.plug = `${w.id}.${ends.indexOf(e)}`;
        });
        dev.wires[w.id] = w; dev.wireOrder.push(w.id);
    });
    for (const id of dev.slotOrder) {
        const s = dev.slots[id];
        if (s.ports.some((p) => p.plug === null && !p.color && s.mod === 'board')) s.ports = s.ports.filter((p) => p.color || s.mod !== 'board');
    }

    // ---- parts for every module, then the little ones on the board
    for (const id of dev.slotOrder.slice()) addPart(dev.slots[id]);

    if (hasBoard) {
        const bp = dev.parts[board.occ];
        const bx = board.pos[0], bz = board.pos[2];
        const area = { x0: -bw / 2 + 0.65, x1: bw / 2 - 0.65, z0: -bd / 2 + 1.25 + (rows - 1) * 0.9, z1: bd / 2 - 0.5 };
        const subMods = [];
        for (let i = 0; i < nSubs; i++) subMods.push(rng() < 0.5 ? 'chip' : 'cap');
        if (govOn) subMods.unshift('gov');
        const subItems = shuffle(rng, subMods).map((mod) => ({ mod, w: MODS[mod].w, d: MODS[mod].d, rot: false }));
        // the governor goes first, so it always finds a place
        subItems.sort((x, y) => (y.mod === 'gov') - (x.mod === 'gov'));
        const subSpots = pack(rng, subItems, area, 0.3, 0.2, true);
        let ci = 1, ui = 1;
        subItems.forEach((it, i) => {
            const sp = subSpots[i];
            if (!sp) return;
            const m = MODS[it.mod];
            const spec = it.mod === 'gov' ? 'MER-GOV' : pickSpec(it.mod);
            const name = it.mod === 'gov' ? 'Governor chip' : it.mod === 'cap' ? `Capacitor C${ci++}` : `Logic chip U${ui++}`;
            const slot = addSlot({
                role: `sub${i}`, name, mod: it.mod, sys: m.sys, spec, layer: 2, parentPart: bp.id, rel: [round(sp.x, 0.05), MODS.board.h, round(sp.z, 0.05)], relYaw: 0,
                pos: [bx + sp.x, FLOOR_Y + MODS.board.h, bz + sp.z], yaw: 0, size: [it.w, it.d], fp: [bx + sp.x, bz + sp.z, it.w, it.d], local: [it.w, it.d],
                optional: it.mod === 'gov',
            });
            specUsed.add(spec);
            addPart(slot);
        });
    }

    // ---- brackets over the sensitive bits
    const modSlots = () => dev.slotOrder.map((i) => dev.slots[i]).filter((s) => s.kind === 'mod' && !s.parentPart);
    const bracketsMade = [];
    const cands = shuffle(rng, modSlots().filter((s) => s.mod === 'board' || (MODS[s.mod].w >= 1.5 && s.mod !== 'cell')));
    for (const target of cands) {
        if (bracketsMade.length >= T.brackets) break;
        const pad = 0.28;
        const fp = [target.fp[0], target.fp[1], target.size[0] + pad * 2, target.size[1] + pad * 2];
        if (bracketsMade.some((b) => Math.abs(b.fp[0] - fp[0]) < (b.fp[2] + fp[2]) / 2 && Math.abs(b.fp[1] - fp[1]) < (b.fp[3] + fp[3]) / 2)) continue;
        const clip = tier >= 2 && rng() < 0.3;
        const type = clip ? 'clip' : rng.pick(['hex10', 'hex13', 'hex8']);
        const topH = target.mod === 'board' ? MODS.board.h + 0.55 : MODS[target.mod].h;
        const bn = ++dev.n.b;
        const slot = addSlot({
            role: `bracket${bn}`, name: target.mod === 'board' ? 'Shield plate' : `${MODS[target.mod].name} bracket`, mod: 'bracket', sys: 'wiring', spec: `BRK-${bn}`, kind: 'bracket',
            layer: 3, pos: [fp[0], FLOOR_Y + topH + 0.04, fp[1]], yaw: 0, size: [fp[2], fp[3]], fp, local: [fp[2], fp[3]],
        });
        const hx = fp[2] / 2 - 0.3;
        slot.holes = (fp[2] >= fp[3] ? [[-hx, 0], [hx, 0]] : [[0, -(fp[3] / 2 - 0.3)], [0, fp[3] / 2 - 0.3]]).map(([ox, oz], k) => ({
            id: `${slot.id}.${k}`, type, ox, oz, prog: 1, dir: -1, rust: !clip && rng() < T.rust ? round(0.5 + rng() * 0.5, 0.05) : 0,
        }));
        const part = addPart(slot, { h: 0.16, w: fp[2], d: fp[3] });
        part.small = false;
        bracketsMade.push(slot);
    }

    // ---- cover panels
    const all = dev.slotOrder.map((i) => dev.slots[i]);
    const ub = all.reduce((b, s) => ({ x0: Math.min(b.x0, s.fp[0] - s.fp[2] / 2), x1: Math.max(b.x1, s.fp[0] + s.fp[2] / 2), z0: Math.min(b.z0, s.fp[1] - s.fp[3] / 2), z1: Math.max(b.z1, s.fp[1] + s.fp[3] / 2) }), { x0: 9e9, x1: -9e9, z0: 9e9, z1: -9e9 });
    const topAll = Math.max(...all.map((s) => (s.kind === 'bracket' ? s.pos[1] - FLOOR_Y + 0.16 : s.kind === 'mod' && !s.parentPart ? MODS[s.mod].h + (s.mod === 'board' ? 0.6 : 0) : 0)));
    const longX = (ub.x1 - ub.x0) >= (ub.z1 - ub.z0);
    const nPan = Math.min(T.panels, longX ? Math.floor((ub.x1 - ub.x0) / 2.6) : Math.floor((ub.z1 - ub.z0) / 2.6)) || 1;
    const panelNames = nPan === 1 ? ['Top plate'] : ['Top plate', 'Side plate', 'Access hatch'];
    const cover = [];
    for (let i = 0; i < nPan; i++) {
        const lo = longX ? ub.x0 + ((ub.x1 - ub.x0) * i) / nPan : ub.z0 + ((ub.z1 - ub.z0) * i) / nPan;
        const hi = longX ? ub.x0 + ((ub.x1 - ub.x0) * (i + 1)) / nPan : ub.z0 + ((ub.z1 - ub.z0) * (i + 1)) / nPan;
        const gapPx = 0.06;
        const x0 = longX ? lo + (i ? gapPx : 0) - 0.3 * (i === 0) : ub.x0 - 0.3;
        const x1 = longX ? hi - (i < nPan - 1 ? gapPx : 0) + 0.3 * (i === nPan - 1) : ub.x1 + 0.3;
        const z0 = longX ? ub.z0 - 0.3 : lo + (i ? gapPx : 0) - 0.3 * (i === 0);
        const z1 = longX ? ub.z1 + 0.3 : hi - (i < nPan - 1 ? gapPx : 0) + 0.3 * (i === nPan - 1);
        cover.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, name: panelNames[i] });
    }
    // sometimes leave the last strip off, so a module sits in the open (a hatch job)
    if (nPan >= 2 && tier <= 3 && rng() < 0.4) cover.pop();
    const pHole = rng.pick(K.holes.filter((t) => t !== 'clip'));
    cover.forEach((c, i) => {
        const pn = ++dev.n.b;
        const clips = tier >= 2 && rng() < 0.18;
        const slot = addSlot({
            role: `panel${pn}`, name: c.name, mod: 'panel', sys: 'wiring', spec: `PNL-${pn}`, kind: 'panel', layer: 4,
            pos: [c.x, FLOOR_Y + topAll + 0.3, c.z], yaw: 0, size: [c.w, c.d], fp: [c.x, c.z, c.w, c.d], local: [c.w, c.d],
        });
        const hx = c.w / 2 - 0.4, hz = c.d / 2 - 0.4;
        const pts = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
        if (c.w > 5.5) pts.push([0, -hz], [0, hz]);
        slot.holes = pts.map(([ox, oz], k) => ({
            id: `${slot.id}.${k}`, type: clips && k % 2 === 0 ? 'clip' : pHole, ox, oz, prog: 1, dir: -1,
            rust: rng() < T.rust ? round(0.5 + rng() * 0.5, 0.05) : 0,
        }));
        slot.holes.forEach((h) => { if (h.type === 'clip') h.rust = 0; });
        addPart(slot, { h: 0.2, w: c.w, d: c.d });
    });

    // ---- faults
    assignFaults(rng, dev, K, T, tier, opts);

    // ---- dust and grime nobody asked about
    for (const id of dev.slotOrder) {
        const s = dev.slots[id];
        const part = s.occ && dev.parts[s.occ];
        if (part && s.kind !== 'bracket' && rng() < T.dust && !part.small) part.cond.dust = round(0.35 + rng() * 0.5, 0.05);
    }
    const dusty = Object.values(dev.parts).filter((p) => p.cond.dust > 0.2).length;
    if (dusty >= 2) dev.extras.push({ id: 'clean', text: 'Give the insides a good clean.', done: false });

    // ---- spares drawer
    makeSpares(rng, dev, tier);

    // ---- a hidden item under a part (a story clue)
    if (opts.stash) {
        const slot = opts.stash.role === 'board' ? board : byRole[opts.stash.role];
        if (slot) {
            dev.stash.push({
                id: nid('t'), slot: slot.id, x: round(slot.pos[0] + (rng() - 0.5) * Math.max(0, slot.size[0] - 1.4) * 0.5, 0.05),
                z: round(slot.pos[2] + (rng() - 0.5) * Math.max(0, slot.size[1] - 1.4) * 0.5, 0.05),
                label: opts.stash.label, clue: opts.stash.clue, taken: false,
            });
        }
    }

    // ---- the order the power travels, for the test animation
    const seen = new Set();
    const mark = (sid) => { if (!seen.has(sid)) { seen.add(sid); dev.flow.push({ t: 'slot', id: sid }); } };
    for (const wid of dev.wireOrder) {
        const w = dev.wires[wid];
        mark(w.ends[0].port.split('.')[0]);
        dev.flow.push({ t: 'wire', id: wid });
        mark(w.ends[1].port.split('.')[0]);
    }
    for (const id of dev.slotOrder) if (dev.slots[id].kind === 'mod' && !dev.slots[id].parentPart) mark(id);
    for (const id of dev.slotOrder) if (dev.slots[id].kind === 'mod' && dev.slots[id].parentPart) mark(id);

    // ---- cable lengths (long enough to reach anywhere on the bench from their other end)
    for (const wid of dev.wireOrder) {
        const w = dev.wires[wid];
        const a = portWorld(dev, w.ends[0].port), b = portWorld(dev, w.ends[1].port);
        w.len = round(Math.hypot(a[0] - b[0], a[2] - b[2]) * 1.15 + 3.4, 0.1);
    }
    // loose ends from the faults need a place to lie
    for (const wid of dev.wireOrder) {
        const w = dev.wires[wid];
        w.ends.forEach((e, i) => {
            if (!e.at) {
                const o = portWorld(dev, e.port) || [0, 0, 0];
                const other = portWorld(dev, w.ends[1 - i].port) || o;
                const ang = rng() * Math.PI * 2;
                e.pos = [o[0] + Math.cos(ang) * 1.6, 0.14, o[2] + Math.sin(ang) * 1.6];
                void other;
            }
        });
    }
    dev.complaint = complaintFor(rng, dev, K);
    return dev;
}

// ------------------------------------------------------------------ faults
function assignFaults(rng, dev, K, T, tier, opts) {
    const slots = dev.slotOrder.map((i) => dev.slots[i]);
    const used = new Set();
    const nWant = rng.int(T.faults[0], T.faults[1]);
    const truth = dev.truth;

    const fixSlot = (slot, type, hidden) => {
        const p = dev.parts[slot.occ];
        const c = p.cond;
        if (type === 'burnt') c.burnt = 1;
        else if (type === 'dead') c.dead = 1;
        else if (type === 'cracked') c.cracked = 1;
        else if (type === 'corr') c.corr = round(0.55 + rng() * 0.45, 0.05);
        else if (type === 'clog') c.clog = round(0.6 + rng() * 0.4, 0.05);
        else if (type === 'seized') c.seized = round(0.6 + rng() * 0.4, 0.05);
        used.add(slot.id);
        truth.push({ type, slot: slot.id, hidden: !!hidden });
    };
    const slotsFor = (type) => slots.filter((s) => {
        if (s.kind !== 'mod' || s.optional || used.has(s.id)) return false;
        const m = MODS[s.mod];
        if (type === 'replace') return m.rep;
        return m.faults.includes(type);
    });

    // forced faults from a story job
    for (const f of opts.faults || []) {
        const slot = slots.find((s) => s.role === f.role) || (f.role === 'sub' ? slots.find((s) => s.parentPart && s.mod === f.mod && !used.has(s.id)) : null);
        if (slot) fixSlot(slot, f.type, f.type === 'dead');
        else if (f.type === 'cut' || f.type === 'unplugged' || f.type === 'joints') applyWireOrBoard(rng, dev, f.type, used, truth);
    }
    let have = truth.length;

    const replaceType = (slot, hiddenWanted) => {
        const m = MODS[slot.mod];
        if (hiddenWanted && m.faults.includes('dead')) return 'dead';
        if (m.faults.includes('cracked')) return 'cracked';
        if (m.faults.includes('burnt')) return 'burnt';
        return 'dead';
    };

    // one replacement at least (a job is usually "something died")
    if (have < nWant && !truth.some((t) => ['burnt', 'dead', 'cracked'].includes(t.type))) {
        const c = slotsFor('replace').filter((s) => s.mod !== 'board');
        if (c.length) {
            const prefer = c.filter((s) => !s.parentPart);
            const slot = rng.pick(prefer.length && rng() < 0.7 ? prefer : c);
            const hidden = T.hidden > 0;
            fixSlot(slot, replaceType(slot, hidden), hidden && replaceType(slot, true) === 'dead');
            have++;
        }
    }
    // solder work
    let solders = 0;
    while (have < nWant && solders < T.solder) {
        const ok = applyWireOrBoard(rng, dev, rng() < 0.5 ? 'cut' : 'joints', used, truth);
        if (ok) { have++; solders++; } else break;
    }
    // a second hidden failure at the high tiers
    let hiddenCount = truth.filter((t) => t.hidden).length;
    while (have < nWant && hiddenCount < T.hidden) {
        const c = slotsFor('replace').filter((s) => MODS[s.mod].faults.includes('dead') && !s.parentPart);
        if (!c.length) break;
        fixSlot(rng.pick(c), 'dead', true); have++; hiddenCount++;
    }
    // everything else: grime, stiffness, a loose plug, another burn-out
    let guard = 0;
    while (have < nWant && guard++ < 40) {
        const roll = rng();
        if (roll < 0.28) {
            const c = slotsFor('corr'); if (c.length) { fixSlot(rng.pick(c), 'corr'); have++; }
        } else if (roll < 0.5) {
            const c = slotsFor('seized').concat(slotsFor('clog')); if (c.length) { const s = rng.pick(c); fixSlot(s, MODS[s.mod].faults.includes('seized') ? 'seized' : 'clog'); have++; }
        } else if (roll < 0.7) {
            if (applyWireOrBoard(rng, dev, 'unplugged', used, truth)) have++;
        } else {
            const c = slotsFor('replace').filter((s) => s.mod !== 'board');
            if (c.length) { const s = rng.pick(c); fixSlot(s, replaceType(s, false)); have++; }
        }
    }
}

function applyWireOrBoard(rng, dev, type, used, truth) {
    if (type === 'unplugged') {
        const wires = dev.wireOrder.map((i) => dev.wires[i]).filter((w) => !w.cut && w.ends.every((e) => e.at));
        if (!wires.length) return false;
        const w = rng.pick(wires);
        const i = rng() < 0.5 ? 0 : 1;
        const port = w.ends[i].port;
        const [sid, pid] = port.split('.');
        dev.slots[sid].ports.find((p) => p.id === pid).plug = null;
        w.ends[i].at = null;
        truth.push({ type: 'unplugged', wire: w.id, end: i });
        return true;
    }
    if (type === 'cut') {
        const wires = dev.wireOrder.map((i) => dev.wires[i]).filter((w) => !w.cut && w.ends.every((e) => e.at));
        if (!wires.length) return false;
        const w = rng.pick(wires);
        w.cut = { t: round(0.4 + rng() * 0.2, 0.01), heat: 0, prog: 0, over: 0, done: false };
        truth.push({ type: 'cut', wire: w.id });
        return true;
    }
    // bad solder joints on the board
    const board = dev.slotOrder.map((i) => dev.slots[i]).find((s) => s.mod === 'board');
    if (!board || used.has(board.id)) return false;
    const part = dev.parts[board.occ];
    const [bw, bd] = board.local;
    const n = rng.int(2, 3);
    const joints = [];
    const subs = dev.slotOrder.map((i) => dev.slots[i]).filter((s) => s.parentPart === part.id);
    for (let k = 0, g = 0; k < n && g < 80; g++) {
        const x = round(-bw / 2 + 0.7 + rng() * (bw - 1.4), 0.05), z = round(-bd / 2 + 1.2 + rng() * (bd - 1.9), 0.05);
        const clash = subs.some((s) => Math.abs(x - s.rel[0]) < s.size[0] / 2 + 0.5 && Math.abs(z - s.rel[2]) < s.size[1] / 2 + 0.5)
            || joints.some((j) => Math.hypot(j.x - x, j.z - z) < 0.9)
            || board.holes.some((h) => Math.hypot(h.ox - x, h.oz - z) < 0.7);
        if (clash) continue;
        joints.push({ x, z, heat: 0, prog: 0, over: 0, done: false });
        k++;
    }
    if (!joints.length) return false;
    part.cond.joints = joints;
    used.add(board.id);
    truth.push({ type: 'joints', slot: board.id, n: joints.length });
    return true;
}

// ------------------------------------------------------------------ the spares drawer
function makeSpares(rng, dev, tier) {
    const spares = [];
    const add = (mod, spec) => { if (!spares.some((s) => s.spec === spec)) spares.push({ spec, mod, price: Math.max(2, Math.round(MODS[mod].price * (0.9 + rng() * 0.25))) }); };
    for (const t of dev.truth) {
        if (!['burnt', 'dead', 'cracked'].includes(t.type)) continue;
        const slot = dev.slots[t.slot];
        add(slot.mod, slot.spec);
        const others = shuffle(rng, MODS[slot.mod].specs.filter((s) => s !== slot.spec));
        others.slice(0, tier >= 3 ? 2 : 1).forEach((s) => add(slot.mod, s));
        if (tier >= 3) {
            const cross = (DECOY_MODS[slot.mod] || []).filter((m) => m !== slot.mod);
            if (cross.length) { const m = rng.pick(cross); add(m, rng.pick(MODS[m].specs)); }
        }
    }
    // a few common things on the shelf regardless, so the drawer is never a giveaway
    for (const m of shuffle(rng, ['fuse', 'cap', 'chip', 'switch']).slice(0, tier >= 2 ? 2 : 1)) add(m, rng.pick(MODS[m].specs));
    dev.spares = shuffle(rng, spares);
}

function complaintFor(rng, dev, K) {
    const lines = [];
    const sym = { corr: 'It only works when the weather is dry.', clog: 'The fan screams like a kettle.', seized: 'Something grinds when it moves.',
        cut: 'It rattles, then loses signal.', unplugged: 'Something came loose inside. I heard it rattle.', joints: 'It cuts in and out unless I thump it.' };
    for (const t of dev.truth) {
        if (t.type === 'burnt' || t.type === 'cracked') lines.push(K.symptoms.burnt || 'Something burnt out.');
        else if (t.type === 'dead') lines.push(K.symptoms.dead || 'It just stopped.');
        else if (sym[t.type]) lines.push(sym[t.type]);
    }
    return [...new Set(lines)].slice(0, 2).join(' ');
}

// ------------------------------------------------------------------ validation
export function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** Builds a copy with every fault repaired and checks the device passes its own test. */
export function validate(dev) {
    const errors = [];
    const c = clone(dev);
    for (const p of Object.values(c.parts)) { p.cond = { ...p.cond, burnt: 0, dead: 0, cracked: 0, corr: 0, clog: 0, seized: 0, joints: (p.cond.joints || []).map((j) => ({ ...j, done: true })) }; }
    for (const w of Object.values(c.wires)) {
        if (w.cut) w.cut.done = true;
        w.ends.forEach((e) => { if (!e.at) e.at = e.port; });
    }
    const r = evaluate(c);
    if (!r.ok) errors.push(...r.problems.map((p) => p.text));
    // no two same-layer, same-parent slots may overlap
    const ids = dev.slotOrder;
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = dev.slots[ids[i]], b = dev.slots[ids[j]];
            if (a.layer !== b.layer || a.kind === 'panel' || a.kind === 'bracket') continue;
            if (Math.abs(a.fp[0] - b.fp[0]) < (a.fp[2] + b.fp[2]) / 2 - 0.05 && Math.abs(a.fp[1] - b.fp[1]) < (a.fp[3] + b.fp[3]) / 2 - 0.05) errors.push(`${a.name} overlaps ${b.name}`);
        }
    }
    // everything has to fit on the bench with room to work
    if (dev.W > 15.3 || dev.D > 9.5) errors.push('too big for the bench');
    // every replacement needs its spare in the drawer
    for (const t of dev.truth) {
        if (['burnt', 'dead', 'cracked'].includes(t.type) && !dev.spares.some((s) => s.spec === dev.slots[t.slot].spec)) errors.push('no spare for ' + dev.slots[t.slot].name);
    }
    // each wire's ports exist and match
    for (const w of Object.values(dev.wires)) {
        for (const e of w.ends) {
            const [sid, pid] = e.port.split('.');
            if (!dev.slots[sid] || !dev.slots[sid].ports.some((p) => p.id === pid)) errors.push('bad port ' + e.port);
        }
    }
    return { ok: errors.length === 0, errors };
}

export { slotPlace, rot };
