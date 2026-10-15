// The clinic and the four calls, as grids of 2 m cells. Pure data.
//
// Shared symbols:
//   #  wall          .  floor        ,  second floor (rug, moss, ash, carpet)
//   ~  water / lava (impassable)     o  pillar or boulder (impassable)
//   T  tree / stalagmite / column (impassable, themed)
//   S  where you arrive
//   X  the way out (front door, your cart): solid, interact from beside it
//   1–4  hurt monsters (quest patients), by slot
//   B  the boss patient          G  the gate before the boss (opens when 1–4 are healed)
//   t  a Gilded Company trap (solid until disarmed)
//   c  the relic chest           k  a chest of remedies       e  evidence on the floor
// Other letters are listed in each map's legend.

export const MAPS = {
    clinic: {
        name: 'The Lantern Clinic',
        theme: 'clinic',
        grid: [
            '################',
            '#z,,#g,,,,O#hT.#',
            '#,,,#,,,,,,#...#',
            '#,,,.,,,,,,..L.#',
            '##.##,,,,,,#...#',
            '#A.#####.#######',
            '#..............#',
            '#.bwb.bwb.==C..#',
            '#..............#',
            '#.bwb.bwb.....p#',
            '#..f...........#',
            '#######X########',
        ],
        legend: {
            z: { kind: 'cot', solid: true, label: 'Rest until tomorrow' },
            g: { kind: 'grimoire', solid: true, label: 'Read the Grimoire of Mending' },
            O: { kind: 'npc', id: 'ossa', solid: true, label: 'Talk to Ossa' },
            h: { kind: 'prop', prop: 'herbshelf', solid: true },
            T: { kind: 'table', solid: true },
            L: { kind: 'lens', solid: true, label: 'Use the Lumen Lens' },
            A: { kind: 'shop', solid: true, label: 'Browse the apothecary shelf' },
            b: { kind: 'prop', prop: 'bench', solid: true },
            w: { kind: 'seat' },
            '=': { kind: 'prop', prop: 'desk', solid: true },
            C: { kind: 'npc', id: 'clasp', solid: true, label: 'Talk to Clasp' },
            p: { kind: 'prop', prop: 'plant', solid: true },
            f: { kind: 'prop', prop: 'hearth', solid: true },
            X: { kind: 'exit', solid: true, label: 'Head out on a call' },
        },
        start: [7, 10, 0],          // x, y (cells), yaw (0 looks toward −y, "north")
    },

    bramble: {
        name: 'Bramblewood Hollow',
        theme: 'forest',
        grid: [
            '########################',
            '#TT,,,TT####TTT,,,,TTTT#',
            '#T,,1,,,T##T,,,,B,,,,TT#',
            '#,,,,,,,,,#T,,,,,,,,,,T#',
            '#,o,,,,,,,#,,,,,,,,o,,,#',
            '#,,,,,,,,,#TT,,,,,,,,TT#',
            '#T,,,,,,,T###TTTGGTTT###',
            '##T,,,,,TT#####,,,,#####',
            '###,,,,,###T~~~,,,,~~TT#',
            '###TTtTT##T,~~,,,,,,~,T#',
            '#T,,,,,,,,,,,,,,,,,,,,,#',
            '#,,,o,,,,,,,,,,,o,,,3,T#',
            '#,,,,,,,,T~~~,,,,,,,,,,#',
            '#T,k,,,,TT~~~TTTTtTTTTT#',
            '##,,,,,,T#####T,,,,,,,,#',
            '#,,,,2,,##TTT##,,,,,,c,#',
            '#T,S,,,,X#####T,,,,,,TT#',
            '########################',
        ],
        legend: {},
        start: [3, 15, 0],
    },

    crypt: {
        name: 'The Drowned Crypt of Vell',
        theme: 'crypt',
        grid: [
            '########################',
            '#o,,,,,,o####o,,,,,,,,o#',
            '#,,,,,,,,####,,,,B,,,,,#',
            '#,,1,,,,,####,,,,,,,,,,#',
            '#o,,,,,,o####o,,,,,,,,o#',
            '##..##..######..GG..####',
            '#~~..~~..####..........#',
            '#~~..~~..####..o....o..#',
            '#.........t.....~~~~...#',
            '#..o...o.####...~~~~.2.#',
            '#.......k####..........#',
            '#####.#######o..o..o...#',
            '#~~~~.~~~~~##..........#',
            '#~..........t......c...#',
            '#~..o....o..##.........#',
            '#~....3.....######..####',
            '#~~..S..X~~~#..........#',
            '########################',
        ],
        legend: {},
        start: [5, 15, 0],
    },

    forge: {
        name: 'Emberpeak Forge',
        theme: 'forge',
        grid: [
            '########################',
            '#~~~~~~~~~##~~~~,,,,~~~#',
            '#~~,,,,~~~##~,,,,B,,,~~#',
            '#~,,,,,,,~##~,,,,,,,,,~#',
            '#~,,1,,,,~##~~,,,,,,,~~#',
            '#~~,,,,,~~###~~~GG~~~###',
            '###,,,,,#######,,,,#####',
            '###TTtTT######...o..####',
            '#.........~~~.........##',
            '#..o...o..~~~...o...2..#',
            '#.........~~~..........#',
            '#..k............~~~~...#',
            '####t####o..o...~~~~...#',
            '#........#........c....#',
            '#..3.....#####..o......#',
            '#..........~~##........#',
            '#..S...X...~~###########',
            '########################',
        ],
        legend: {},
        start: [3, 15, 0],
    },

    citadel: {
        name: 'Gloamspire Citadel',
        theme: 'citadel',
        grid: [
            '########################',
            '#o,,,,,,,,,o##o,,,,,,,o#',
            '#,,,,,,B,,,,##,,,,,,,,,#',
            '#,,,,,,,,,,,##,,,e,,,,,#',
            '#o,,,,,,,,,o##o,,,,,,,o#',
            '######GG########,,,,####',
            '#....,,,,....###,,,,####',
            '#.o..,,,,..o.###,,,,,..#',
            '#....,,,,....,t,,,,,,..#',
            '#.1..,,,,..k.###,,,,.2.#',
            '#....,,,,....###,,,,...#',
            '###t####################',
            '#.......,,,,,,,,,,,,,..#',
            '#.o..o..,,o,,o,,o,,o,..#',
            '#.......,,,,,,,,,,,,,.c#',
            '#..3....,,#######,,,,..#',
            '#...S..X,,#######,,,,..#',
            '########################',
        ],
        legend: {},
        start: [4, 15, 0],
    },
};

export const MAP_IDS = Object.keys(MAPS);
export const QUEST_MAPS = ['bramble', 'crypt', 'forge', 'citadel'];

/** Legend for a symbol on a map (shared symbols plus the map's own). */
export function legendAt(mapId, ch) {
    const M = MAPS[mapId];
    if (M.legend[ch]) return M.legend[ch];
    switch (ch) {
        case 'X': return { kind: 'exit', solid: true, label: mapId === 'clinic' ? 'Head out on a call' : 'Ride home to the clinic' };
        case 'B': return { kind: 'boss', solid: true };
        case '1': case '2': case '3': case '4': return { kind: 'patient', slot: +ch - 1, solid: true };
        case 'G': return { kind: 'gate', solid: true };
        case 't': return { kind: 'trap', solid: true };
        case 'c': return { kind: 'chest', relic: true, solid: true };
        case 'k': return { kind: 'chest', relic: false, solid: true };
        case 'e': return { kind: 'evidence', solid: false };
        default: return null;
    }
}
