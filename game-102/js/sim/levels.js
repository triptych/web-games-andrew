// The sectors. Pure data plus a tiny station generator: every block is snapped to the one below
// it, so a layout starts perfectly at rest (the simtest checks it by letting each one sit).
//
// A block is [mat, centreX, centreY, width, height]; a robot is [centreX, centreY].

import { ISLANDS, ROBOT } from '../config.js';

const DOCK = ISLANDS[1].top;       // y of the dock's surface
const PW = 0.7;                    // pillar width
const BEAM = 0.5;                  // floor beam thickness

/**
 * Floors of pillars and beams. floors[i] = { h, pillar, beam, robots: [bay…], crates: [bay…], fuel: [bay…] }.
 * Robots stand on the beam below their floor; the roof can carry robots too (spec.roof = [bay…]).
 */
function station({ x0, bays, bayW, floors, roof = [] }) {
    const blocks = [], robots = [];
    let y = DOCK;
    const span = bays * bayW;
    const bayX = (i) => x0 + (i + 0.5) * bayW;
    for (const f of floors) {
        for (let i = 0; i <= bays; i++) blocks.push([f.pillar || 'hull', x0 + i * bayW, y + f.h / 2, PW, f.h]);
        blocks.push([f.beam || 'hull', x0 + span / 2, y + f.h + BEAM / 2, span + PW, BEAM]);
        for (const i of f.robots || []) robots.push([bayX(i), y + ROBOT.h / 2]);
        for (const i of f.crates || []) blocks.push(['crate', bayX(i), y + 0.8, 1.6, 1.6]);
        for (const i of f.fuel || []) blocks.push(['fuel', bayX(i), y + 0.8, 1.6, 1.6]);
        y += f.h + BEAM;
    }
    for (const i of roof) robots.push([bayX(i), y + ROBOT.h / 2]);
    return { blocks, robots };
}

const merge = (...parts) => ({
    blocks: parts.flatMap((p) => p.blocks || []),
    robots: parts.flatMap((p) => p.robots || []),
});

const crate = (x, y, mat = 'crate') => [mat, x, y, 1.6, 1.6];

export const LEVELS = [
    {
        name: 'First Contact',
        brief: 'A scout outpost. Two robots, four rocks.',
        ammo: ['rock', 'rock', 'rock', 'rock'],
        wells: [],
        build: () => merge(
            station({ x0: 32, bays: 1, bayW: 3.4, floors: [{ h: 2.0, robots: [0] }] }),
            { blocks: [crate(41, DOCK + 0.8)], robots: [[41, DOCK + 1.6 + ROBOT.h / 2]] },
        ),
    },
    {
        name: 'Glass House',
        brief: 'Windows break easily. Ice splits over rooftops.',
        ammo: ['rock', 'ice', 'rock', 'rock'],
        wells: [],
        build: () => station({
            x0: 29, bays: 3, bayW: 3.6,
            floors: [
                { h: 2.2, pillar: 'hull', beam: 'hull', robots: [1] },
                { h: 2.2, pillar: 'glass', beam: 'glass', robots: [0, 2] },
            ],
            roof: [1],
        }),
    },
    {
        name: 'Fuel Depot',
        brief: 'Cargo stacked in a pyramid. Something in it is volatile.',
        ammo: ['iron', 'bomb', 'rock', 'rock'],
        wells: [],
        build: () => {
            const blocks = [], robots = [];
            const u = 1.6, x0 = 29 + u / 2;
            const rows = [[0, 1, 2, 3, 4], [1, 2, 3], [2]];
            rows.forEach((row, ri) => {
                for (const i of row) {
                    const fuel = (ri === 0 && i === 2) || (ri === 1 && i === 2);
                    blocks.push(crate(x0 + i * u, DOCK + u / 2 + ri * u, fuel ? 'fuel' : 'crate'));
                }
            });
            robots.push([x0, DOCK + u + ROBOT.h / 2], [x0 + 4 * u, DOCK + u + ROBOT.h / 2]);
            robots.push([x0 + u, DOCK + 2 * u + ROBOT.h / 2], [x0 + 3 * u, DOCK + 2 * u + ROBOT.h / 2]);
            robots.push([x0 + 2 * u, DOCK + 3 * u + ROBOT.h / 2]);
            return { blocks, robots };
        },
    },
    {
        name: 'Event Horizon',
        brief: 'A black hole bends every shot. Aim around it.',
        ammo: ['iron', 'ice', 'rock', 'bomb'],
        wells: [{ x: 19, y: 12, k: 150, r: 1.5 }],
        build: () => merge(
            station({
                x0: 32, bays: 1, bayW: 2.8,
                floors: [{ h: 2.0, robots: [0] }, { h: 2.0, pillar: 'glass', beam: 'glass' }, { h: 2.0, robots: [0] }],
                roof: [0],
            }),
            station({ x0: 42, bays: 1, bayW: 3.0, floors: [{ h: 2.2, fuel: [0] }], roof: [0] }),
        ),
    },
    {
        name: 'Orbital Ring',
        brief: 'A long bridge on two towers. What is under it?',
        ammo: ['iron', 'rock', 'bomb', 'ice', 'rock'],
        wells: [{ x: 20, y: 15, k: 90, r: 1.2 }],
        build: () => {
            const blocks = [['hull', 30, DOCK + 2.6, 1.2, 5.2], ['hull', 44, DOCK + 2.6, 1.2, 5.2]];
            blocks.push(['hull', 37, DOCK + 5.2 + 0.3, 15.2, 0.6]);
            blocks.push(['glass', 37, DOCK + 0.8, 1.0, 1.6]);
            const top = DOCK + 5.8;
            const robots = [[33, top + ROBOT.h / 2], [37, top + ROBOT.h / 2], [41, top + ROBOT.h / 2],
                [34, DOCK + ROBOT.h / 2], [40, DOCK + ROBOT.h / 2]];
            blocks.push(crate(42.4, DOCK + 0.8));
            return { blocks, robots };
        },
    },
    {
        name: 'Mothership',
        brief: 'The big one. Everything you have learned, all at once.',
        ammo: ['iron', 'bomb', 'ice', 'rock', 'rock'],
        wells: [{ x: 19, y: 13, k: 120, r: 1.4 }],
        build: () => merge(
            station({
                x0: 27, bays: 4, bayW: 3.4,
                floors: [
                    { h: 2.4, robots: [0, 3], fuel: [2] },
                    { h: 2.2, pillar: 'glass', beam: 'hull', robots: [1, 2] },
                    { h: 2.0, pillar: 'hull', beam: 'glass', robots: [1] },
                ],
                roof: [2],
            }),
            station({ x0: 45, bays: 1, bayW: 3.2, floors: [{ h: 2.2, crates: [0] }, { h: 2.0, robots: [0] }], roof: [0] }),
        ),
    },
];

export const levelCount = () => LEVELS.length;
