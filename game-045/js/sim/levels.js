/**
 * levels.js — brick layouts ("waves").
 *
 * Each layout is 11 columns × up to 10 rows, top row first.
 *   .  empty      1-3  plain brick with that many hit points
 *   X  explosive  (1 HP, damages every brick within RULES.blastRadius)
 *   P  power-up   (1 HP, always drops a pickup)
 *
 * Bricks whose corners would poke outside the top arc are dropped, so a layout
 * never blocks the channel the ball rides around the top of the table.
 * After the last layout the list repeats with every brick one HP tougher.
 */

import { insideBrickZone } from './table.js';

export const LAYOUTS = [
    {
        name: 'SUNSET STRIP',
        rows: [
            '...........',
            '....111....',
            '..1122211..',
            '.112333211.',
            '.12X2P2X21.',
            '11222222211',
            '1P1111111P1',
            '11111111111',
        ],
    },
    {
        name: 'GRID RUNNER',
        rows: [
            '2.2.2.2.2.2',
            '.1.1.1.1.1.',
            '2.2.X.X.2.2',
            '.1.1.P.1.1.',
            '3.3.3.3.3.3',
            '.1.1.1.1.1.',
            '2.P.2.2.P.2',
            '.1.1.1.1.1.',
        ],
    },
    {
        name: 'SPACE INVADER',
        rows: [
            '..1.....1..',
            '...1...1...',
            '..2222222..',
            '.22X222X22.',
            '22222222222',
            '2.2222222.2',
            '2.2.....2.2',
            '...PP.PP...',
        ],
    },
    {
        name: 'NEON PYRAMID',
        rows: [
            '.....3.....',
            '....3X3....',
            '...33P33...',
            '..2222222..',
            '.2X22222X2.',
            '11111111111',
            'XX.1P1P1.XX',
            '11.11111.11',
        ],
    },
    {
        name: 'HEARTBREAKER',
        rows: [
            '..33...33..',
            '.3XX3.3XX3.',
            '32222322223',
            '32P2222P223',
            '.322222223.',
            '..3222223..',
            '...32X23...',
            '....323....',
            '.....3.....',
        ],
    },
];

export const BRICK = {
    w: 0.9,
    h: 0.46,
    pitchX: 0.98,
    pitchY: 0.56,
    topY: 24.4,
    sideMargin: 0.95,   // clearance kept free between bricks and the side walls
    arcMargin: 1.05,    // ...and the top arc, so the ball can ride over the wall
};

/**
 * Build the brick list for a wave (1-based).
 * @returns {{ name: string, bricks: object[] }}
 */
export function buildWave(wave, nextId) {
    const idx = (wave - 1) % LAYOUTS.length;
    const loop = Math.floor((wave - 1) / LAYOUTS.length);
    const layout = LAYOUTS[idx];
    const bricks = [];
    const hw = BRICK.w / 2, hh = BRICK.h / 2;

    layout.rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            const ch = row[c];
            if (ch === '.') continue;
            const x = (c - (row.length - 1) / 2) * BRICK.pitchX;
            const y = BRICK.topY - r * BRICK.pitchY;
            const ok = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]
                .every(([dx, dy]) => insideBrickZone(x + dx, y + dy, BRICK.sideMargin, BRICK.arcMargin));
            if (!ok) continue;

            let kind = 'n', hp = 1;
            if (ch === 'X') kind = 'x';
            else if (ch === 'P') kind = 'p';
            else hp = Math.min(4, Number(ch) + loop);

            bricks.push({
                id: nextId + bricks.length,
                x, y, hw, hh,
                hp, maxHp: hp,
                kind,
                row: r, col: c,
                alive: true,
            });
        }
    });

    const name = loop > 0 ? `${layout.name} ${'+'.repeat(loop)}` : layout.name;
    return { name, bricks };
}
