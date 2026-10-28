// The parts catalogue: every kind of module a device can be built from. Pure data.
// Sizes are in bench units (about a centimetre); a module's origin is the middle of its footprint,
// at the bottom. Ports sit on top of the module (their height is the module's height).

const P = (id, kind, ox, oz) => ({ id, kind, ox, oz });

export const MODS = {
    cell: {
        name: 'Power cell', sys: 'power', w: 3.0, d: 1.25, h: 1.1, rep: true, price: 40, holes: 2, holeAt: 'ends',
        ports: [P('pos', 'pwr', -0.55, 0), P('neg', 'gnd', 0.55, 0)],
        faults: ['burnt', 'dead', 'corr'], specs: ['CELL-6V', 'CELL-12V', 'CELL-24V', 'CELL-9V'],
    },
    fuse: {
        name: 'Fuse block', sys: 'power', w: 1.8, d: 0.85, h: 0.7, rep: true, small: true, price: 6, holes: 0,
        ports: [P('in', 'pwr', -0.58, 0), P('out', 'pwr', 0.58, 0)],
        faults: ['burnt', 'dead'], specs: ['FUSE-2A', 'FUSE-5A', 'FUSE-10A', 'FUSE-20A', 'FUSE-3A'],
    },
    cap: {
        name: 'Capacitor', sys: 'power', w: 0.62, d: 0.62, h: 0.95, rep: true, small: true, price: 8, holes: 0, ports: [], sub: true,
        faults: ['burnt', 'dead'], specs: ['CAP-220', 'CAP-470', 'CAP-1000', 'CAP-100', 'CAP-680'],
    },
    chip: {
        name: 'Logic chip', sys: 'logic', w: 0.9, d: 0.9, h: 0.26, rep: true, small: true, price: 18, holes: 0, ports: [], sub: true,
        faults: ['burnt', 'dead'], specs: ['IC-7A', 'IC-9C', 'IC-4F', 'IC-8K', 'IC-2M', 'IC-5R'],
    },
    gov: {
        name: 'Governor chip', sys: 'logic', w: 0.95, d: 0.95, h: 0.3, rep: false, small: true, price: 0, holes: 0, ports: [], sub: true,
        faults: [], specs: ['MER-GOV'], optional: true,
    },
    servo: {
        name: 'Servo', sys: 'motion', w: 1.9, d: 1.15, h: 1.2, rep: true, price: 35, holes: 2, holeAt: 'ends',
        ports: [P('pwr', 'pwr', 0.28, 0.3), P('sig', 'sig', 0.28, -0.3)],
        faults: ['seized', 'burnt', 'dead'], specs: ['SRV-S2', 'SRV-M4', 'SRV-X9', 'SRV-M7'],
    },
    gear: {
        name: 'Gear train', sys: 'motion', w: 1.5, d: 1.5, h: 0.7, rep: false, price: 0, holes: 1, holeAt: 'centre',
        ports: [], faults: ['seized'], specs: ['GEAR-T24', 'GEAR-T30'],
    },
    fan: {
        name: 'Cooling fan', sys: 'cooling', w: 1.7, d: 1.7, h: 0.55, rep: true, price: 15, holes: 2, holeAt: 'diag',
        ports: [P('pwr', 'pwr', -0.55, 0.6)],
        faults: ['clog', 'burnt'], specs: ['FAN-40', 'FAN-60', 'FAN-80'],
    },
    lens: {
        name: 'Optic lens', sys: 'optics', w: 1.6, d: 1.6, h: 1.0, rep: true, price: 30, holes: 2, holeAt: 'diag',
        ports: [P('sig', 'sig', 0, -0.62)],
        faults: ['cracked', 'corr', 'dead'], specs: ['LNS-A', 'LNS-B', 'LNS-R', 'LNS-G'],
    },
    relay: {
        name: 'Relay', sys: 'power', w: 1.2, d: 1.0, h: 0.9, rep: true, price: 14, holes: 1, holeAt: 'centre',
        ports: [P('in', 'pwr', -0.4, 0.26), P('out', 'sig', 0.4, 0.26)],
        faults: ['corr', 'burnt', 'dead'], specs: ['RLY-12', 'RLY-24', 'RLY-5'],
    },
    coil: {
        name: 'Field coil', sys: 'power', w: 1.7, d: 1.7, h: 0.85, rep: true, price: 28, holes: 2, holeAt: 'diag',
        ports: [P('a', 'pwr', -0.3, 0), P('b', 'gnd', 0.3, 0)],
        faults: ['burnt', 'dead'], specs: ['COIL-3', 'COIL-5', 'COIL-8'],
    },
    speaker: {
        name: 'Speaker', sys: 'audio', w: 1.7, d: 1.7, h: 0.6, rep: true, price: 20, holes: 4, holeAt: 'corners',
        ports: [P('sig', 'sig', 0, 0.62)],
        faults: ['burnt', 'dead'], specs: ['SPK-8', 'SPK-4', 'SPK-16'],
    },
    actuator: {
        name: 'Actuator', sys: 'motion', w: 2.5, d: 0.85, h: 0.85, rep: true, price: 45, holes: 2, holeAt: 'ends',
        ports: [P('pwr', 'pwr', -0.5, 0), P('sig', 'sig', 0.5, 0)],
        faults: ['seized', 'burnt', 'dead'], specs: ['ACT-L2', 'ACT-L4', 'ACT-L6'],
    },
    display: {
        name: 'Display', sys: 'display', w: 2.3, d: 1.5, h: 0.35, rep: true, price: 40, holes: 4, holeAt: 'corners',
        ports: [P('sig', 'sig', 0, 0.5)],
        faults: ['cracked', 'dead'], specs: ['DSP-2', 'DSP-3', 'DSP-5'],
    },
    switch: {
        name: 'Switch bank', sys: 'logic', w: 1.0, d: 1.0, h: 0.7, rep: true, small: true, price: 10, holes: 0,
        ports: [P('a', 'pwr', -0.22, 0), P('b', 'sig', 0.22, 0)],
        faults: ['corr', 'burnt'], specs: ['SW-A', 'SW-B', 'SW-C'],
    },
    board: {
        name: 'Circuit board', sys: 'logic', w: 4, d: 3, h: 0.22, rep: false, price: 0, holes: 4, holeAt: 'corners', ports: [],
        faults: ['joints', 'corr'], specs: ['PCB'],
    },
    // structural parts the generator adds: never faulty, never replaced
    bracket: { name: 'Bracket', sys: 'wiring', w: 2, d: 2, h: 0.16, rep: false, price: 0, holes: 2, ports: [], faults: [], specs: ['BRK'] },
    panel:   { name: 'Cover panel', sys: 'wiring', w: 6, d: 4, h: 0.2, rep: false, price: 0, holes: 4, ports: [], faults: [], specs: ['PNL'] },
};

/** Parts a customer would bring to a shop; used to pick decoys for the spares drawer. */
export const DECOY_MODS = {
    cell: ['cell'], fuse: ['fuse', 'cap'], cap: ['cap', 'fuse'], chip: ['chip'], servo: ['servo', 'actuator'], fan: ['fan'],
    lens: ['lens', 'display'], relay: ['relay', 'switch'], coil: ['coil', 'cell'], speaker: ['speaker'],
    actuator: ['actuator', 'servo'], display: ['display', 'lens'], switch: ['switch', 'relay'],
};

/** Local hole offsets for a module of the given size. */
export function holeOffsets(mod, w, d) {
    const m = MODS[mod];
    const ix = Math.max(0.25, w / 2 - 0.3), iz = Math.max(0.25, d / 2 - 0.3);
    switch (m.holeAt) {
        case 'ends': return [[-ix, 0], [ix, 0]];
        case 'diag': return [[-ix, -iz], [ix, iz]];
        case 'centre': return [[0, 0]];
        case 'corners': return [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]];
        default: return [];
    }
}
