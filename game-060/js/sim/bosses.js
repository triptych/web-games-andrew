// The five bosses: giant brick lifeforms built from 3×3 px cells. Each is authored as
// its LEFT HALF (rows top to bottom) and mirrored, so the core sits on the centre line.
//
//   a b c   armour (1 hit; a/b/c are colours)   w  wing armour (1 hit)
//   h       hard (3 hits)                       s  steel (only fire or Nova breaks it)
//   C       core: the weak point                e  eye (glows)
//   g       gun port (2 hits; shoots; break them to silence it)
//   j       jaw (steel that opens and shuts)

import { Grid } from './grid.js';

export const CELL = 3;
const CODES = { a: 1, b: 2, c: 3, h: 4, s: 5, C: 6, e: 7, g: 8, j: 9, w: 10 };
export const CELL_CODE = CODES;

export const BOSSES = {
    krabbo: {
        name: 'KING KRABBO', title: 'GIANT BRICK CRUSTACEAN', coreHp: 1, y: 196,
        palette: { a: 0xff2448, b: 0xff8a1a, c: 0xffe23a, h: 0x9a1830, s: 0x8a96b8, C: 0xfff0f8, e: 0xffe23a, g: 0x5a6488, j: 0x8a96b8, w: 0xff7ab8 },
        move: { ax: 48, wx: 0.5, ay: 5, wy: 1.3 },
        regen: { every: 8, n: 4 },
        phases: [
            { at: 1.0, cool: 2.0, attacks: ['spread3', 'aimed', 'summon'] },
            { at: 0.5, cool: 1.35, attacks: ['spread5', 'aimed', 'summon', 'bombs'] },
        ],
        half: [
            '..ss..................',
            '.shhs.................',
            'shhhhs................',
            'shhhhs................',
            '.shhs.................',
            '..hh..................',
            '..hh........aaaaaaaaaa',
            '..hha.....aaaaaaaaaaaa',
            '...haa...aaeeeaaaaaaaa',
            '....aaaaaaeeeaaaaaaaaa',
            '.....aaaaaaaaaaaaaaaaa',
            '.....gabbbbbbbbbbbbbbb',
            '....ggbbbbbbbbbbbbhhhh',
            '...aabbbbbbbbbbbbhhhCC',
            '...aabbbbbbbbbbbbhhhCC',
            '....aabbbbbbbbbbbbhhbb',
            '.....aaaaaaaaaaaaaaaaa',
            '....a..a...a....a.....',
            '...a..a...a....a......',
            '..a..a...a....a.......',
        ],
    },
    saucer: {
        name: 'THE SAUCERATOR', title: 'MOTHER OF ALL SAUCERS', coreHp: 1, y: 206,
        palette: { a: 0xff2448, b: 0xb01838, c: 0x3ae8ff, h: 0x5a1a3a, s: 0x8a96b8, C: 0xfff0ff, e: 0x7af4ff, g: 0x5a6488, j: 0x8a96b8, w: 0xffe23a },
        move: { ax: 52, wx: 0.42, ay: 8, wy: 0.9 },
        regen: { every: 7, n: 4 },
        phases: [
            { at: 1.0, cool: 1.9, attacks: ['ring', 'beam', 'spread3', 'summon'] },
            { at: 0.5, cool: 1.3, attacks: ['ring', 'beam', 'spread5', 'dash', 'summon'] },
        ],
        half: [
            '................cccccccc',
            '..............cceeeeeeee',
            '.............ceeeeeeeeCC',
            '.............ceeeeeeeeCC',
            '..........sssssshhhhhhhh',
            '......aaaaaaaaaaaaaaaaaa',
            '...aaawawawawawawawawawa',
            '.aabbbbbbbbbbbbbbbbbbbbb',
            'abbbbbbbbbbbbbbbbbbbbbbb',
            '.aabbbbbbbbbbbbbbbbbbbbb',
            '...aaaaaaaaaaaaaaaaaaaaa',
            '.....hhhhhaaaaaaaaaaaaaa',
            '.......g.....g......g...',
            '......ggg...ggg....ggg..',
        ],
    },
    rockjaw: {
        name: 'ROCKJAW', title: 'THE ASTEROID THAT BITES', coreHp: 1, y: 192,
        palette: { a: 0x8a6a4a, b: 0xb08a5a, c: 0xff3a6a, h: 0x5a4a3a, s: 0x8a96b8, C: 0xfff0d0, e: 0xff8a1a, g: 0x5a6488, j: 0xc8d0e8, w: 0xff7ab8 },
        move: { ax: 44, wx: 0.38, ay: 6, wy: 0.8 },
        regen: { every: 6, n: 5 },
        jaw: { open: 2.6, shut: 3.4 },
        phases: [
            { at: 1.0, cool: 1.8, attacks: ['rocks', 'bombs', 'aimed'] },
            { at: 0.5, cool: 1.25, attacks: ['rocks', 'bombs', 'aimed', 'ring'] },
        ],
        half: [
            '........aaaaaaaaaaaaaa',
            '.....aaaabbbbbbbbbbbbb',
            '...aaabbbbbbbaabbbbbbb',
            '..aabbbbaabbbbbbbbbbbb',
            '.aabbbbbbbbbbbbbbbbbbb',
            '.abbbbeeeeebbbbbbbbbbb',
            'aabbbeeeeeeebbbbbbbbbb',
            'abbbbeeeeeeebbbbbbbbbb',
            'abbbbbeeeeebbbbhhbbbbb',
            'abbbbbbbbbbbbbhhhhbbbb',
            '.abbbbbbbbbbbbbbbbbbbb',
            '.aabbbbbbjjjjjjjjjjjjj',
            '..abbbbbj.......ccccCC',
            '..abbbbbj.......ccccCC',
            '...abbbbjjjjjjjjjjjjjj',
            '....aabbbbbbbbbbbbbbbb',
            '......aaaabbbbbbbbbbbb',
            '.........aaaaaaaaaaaaa',
        ],
    },
    queen: {
        name: 'PHANTOM QUEEN', title: 'FLAGSHIP OF THE ARMADA', coreHp: 1, y: 200,
        palette: { a: 0x9a4aff, b: 0x3a6aff, c: 0x3ae8ff, h: 0x2a1a6a, s: 0x8a96b8, C: 0xffffff, e: 0xffe23a, g: 0x5a6488, j: 0x8a96b8, w: 0x3aff5a },
        move: { ax: 50, wx: 0.47, ay: 10, wy: 1.1 },
        regen: { every: 7, n: 5 },
        phases: [
            { at: 1.0, cool: 1.9, attacks: ['tractor', 'divers', 'aimed', 'spread3'] },
            { at: 0.5, cool: 1.3, attacks: ['tractor', 'divers', 'aimed', 'spread5', 'ring'] },
        ],
        half: [
            '......................ss',
            '..................s..sss',
            '..................ssaaaa',
            'w...............aaaaaaaa',
            'ww.............aaeeaaaaa',
            'www...........aaaeeaaaaa',
            'wwww........aaaaaaaabbCC',
            'wwwwww....aaaaaaaabbbbCC',
            '.wwwwwwwaaaaaaaabbbbbbbb',
            '..wwwwwwwwaaaabbbbbbbbbb',
            '...wwwwwwwwwwhhhhhhhhhhh',
            '....wwwwww...gaaaaabbbbb',
            '.....www.....gg....aaaaa',
            '...................aa..a',
            '..................a....a',
        ],
    },
    overmind: {
        name: 'THE OVERMIND', title: 'BRAIN OF THE BRICK ARMADA', coreHp: 2, y: 190,
        palette: { a: 0xff7ab8, b: 0xc0407a, c: 0xffe23a, h: 0x9a8a70, s: 0x8a96b8, C: 0xffffff, e: 0xff2448, g: 0xff2448, j: 0x8a96b8, w: 0xd8ccb0 },
        move: { ax: 40, wx: 0.35, ay: 6, wy: 0.7 },
        regen: { every: 6, n: 5 },
        phases: [
            { at: 1.0, cool: 1.7, attacks: ['beam', 'aimed', 'summon', 'spread3'] },
            { at: 0.6, cool: 1.25, attacks: ['ring', 'spiral', 'beam', 'aimed', 'summon'] },
            { at: 0.25, cool: 0.95, attacks: ['spiral', 'ring', 'beam', 'spread5', 'bombs'] },
        ],
        half: [
            '..........ssssssssssssss',
            '.......sssaaaaaaaaaaaaaa',
            '.....ssaaaaabaaaaaabaaaa',
            '....ssaaaabaaaaaabaaaaaa',
            '...ssaaabaaaaaaabaaaaaCC',
            '...saaaabaaaaaabaaaaaaCC',
            '..ssaaaaaabaaaaaabaaaaaa',
            '..ssssssssssssssssssshhh',
            '..shwwwwwwwwwwwwwwwwwwww',
            '..shweeeeewwwwwwwwwwwwww',
            '..sheeggeeewwwwwwwwwwwww',
            '..shweeeeewwwwwwwwwwwwww',
            '...shwwwwwwwwwwwwwwww.ww',
            '....shwwwwwwwwwwwwww..w.',
            '.....hwwhwwhwwhwwhwwhwwh',
            '......h..h..h..h..h..h..',
        ],
    },
};

/** Type table for a boss's grid. Index = cell code. */
export function bossTypes(def) {
    const p = def.palette;
    const t = [];
    t[CODES.a] = { hp: 1, color: p.a, regen: true };
    t[CODES.b] = { hp: 1, color: p.b, regen: true };
    t[CODES.c] = { hp: 1, color: p.c, regen: true, glow: 1.4 };
    t[CODES.h] = { hp: 3, color: p.h, regen: true };
    t[CODES.s] = { hp: 1, color: p.s, steel: true };
    t[CODES.C] = { hp: def.coreHp, color: p.C, core: true, glow: 1.9 };
    t[CODES.e] = { hp: 1, color: p.e, glow: 1.6, regen: true };
    t[CODES.g] = { hp: 2, color: p.g, gun: true };
    t[CODES.j] = { hp: 1, color: p.j, steel: true, jaw: true };
    t[CODES.w] = { hp: 1, color: p.w, regen: true };
    return t;
}

export function buildBossGrid(id) {
    const def = BOSSES[id];
    const full = def.half.map((row) => row + [...row].reverse().join(''));
    const cols = full[0].length, rows = full.length;
    for (const r of full) if (r.length !== cols) throw new Error(`boss ${id}: ragged row`);
    const g = new Grid({ kind: 'boss', x: (240 - cols * CELL) / 2, y: def.y, cols, rows, cw: CELL, ch: CELL, types: bossTypes(def) });
    g.fill(full, (ch) => CODES[ch] || 0);
    return g;
}
