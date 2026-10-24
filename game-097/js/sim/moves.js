// Where can a piece go? Pure functions of the board B = { w, h, tiles, units }.
// A move is { to: [x, y], kind: 'move' | 'cap', stop: [x, y], how }.
// For a capture, `stop` is where the attacker ends up if the defender survives: the square before
// the target on a slide or ride, otherwise where it started.

import { TERRAIN } from '../config.js';
import { UNITS, MOVES } from './data.js';

export const inB = (B, x, y) => x >= 0 && y >= 0 && x < B.w && y < B.h;
export const tileAt = (B, x, y) => B.tiles[y]?.[x];
export const walkable = (B, x, y) => inB(B, x, y) && !TERRAIN[B.tiles[y][x]].solid;
export const unitAt = (B, x, y) => B.units.find((u) => u.x === x && u.y === y) || null;
export const rulesOf = (key) => MOVES[UNITS[key].move];

const solid = (B, x, y) => TERRAIN[B.tiles[y][x]].solid;
const wallOnly = (B, x, y) => B.tiles[y][x] === '#';

export function genMoves(B, u) {
    const out = [];
    const seen = new Set();
    const flip = u.team === 'e' ? -1 : 1;
    const add = (x, y, kind, stop, how) => {
        const k = x + ',' + y;
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ to: [x, y], kind, stop, how });
    };
    // 'wall' | 'empty' | 'enemy' | 'friend'; adds the move when legal
    const land = (x, y, mode, stop, how) => {
        if (!walkable(B, x, y)) return 'wall';
        const o = unitAt(B, x, y);
        if (!o) { if (mode !== 'cap') add(x, y, 'move', stop, how); return 'empty'; }
        if (o.team !== u.team) { if (mode !== 'move') add(x, y, 'cap', stop, how); return 'enemy'; }
        return 'friend';
    };
    const origin = [u.x, u.y];

    for (const r of rulesOf(u.key)) {
        const mode = r.m || 'any';
        const dirs = r.d.map(([dx, dy]) => [dx, dy * flip]);
        if (r.k === 'leap') {
            for (const [dx, dy] of dirs) land(u.x + dx, u.y + dy, mode, origin, 'leap');
        } else if (r.k === 'slide') {
            for (const [dx, dy] of dirs) {
                let prev = origin;
                for (let i = 1; i <= r.r; i++) {
                    const x = u.x + dx * i, y = u.y + dy * i;
                    if (!inB(B, x, y)) break;
                    if (solid(B, x, y)) { if (r.phase) continue; break; }
                    const res = land(x, y, mode, prev, r.phase ? 'phase' : 'slide');
                    if (res === 'enemy' || res === 'friend') break;
                    prev = [x, y];
                }
            }
        } else if (r.k === 'ride') {
            for (const [dx, dy] of dirs) {
                let prev = origin;
                for (let i = 1; i <= r.r; i++) {
                    const x = u.x + dx * i, y = u.y + dy * i;
                    if (!inB(B, x, y)) break;
                    const res = land(x, y, mode, prev, 'ride');
                    if (res !== 'empty') break;
                    prev = [x, y];
                }
            }
        } else if (r.k === 'hop') {
            for (const [dx, dy] of dirs) {
                for (let i = 1; i <= r.r; i++) {
                    const x = u.x + dx * i, y = u.y + dy * i;
                    if (!inB(B, x, y) || wallOnly(B, x, y)) break;
                    if (unitAt(B, x, y)) { land(x + dx, y + dy, mode, origin, 'hop'); break; }
                }
            }
        } else if (r.k === 'cannon') {
            for (const [dx, dy] of dirs) {
                let screen = false;
                for (let i = 1; i <= r.r; i++) {
                    const x = u.x + dx * i, y = u.y + dy * i;
                    if (!inB(B, x, y) || wallOnly(B, x, y)) break;
                    const o = unitAt(B, x, y);
                    if (!o) continue;
                    if (!screen) { screen = true; continue; }
                    if (o.team !== u.team) add(x, y, 'cap', origin, 'cannon');
                    break;
                }
            }
        }
    }
    return out;
}

/** Can u capture whatever stands on (x, y)? */
export const attacksSquare = (B, u, x, y) => genMoves(B, u).some((m) => m.kind === 'cap' && m.to[0] === x && m.to[1] === y);

/** A 9×9 picture of a movement pattern for the roster: '.' nothing, 'm' move, 'c' capture only,
 *  'b' both, 'j' a jump or hop landing. Drawn for the player's side (forward is up). */
export function diagram(key) {
    const N = 9, c = 4;
    const g = Array.from({ length: N }, () => Array(N).fill('.'));
    const mark = (x, y, v) => {
        if (x < 0 || y < 0 || x >= N || y >= N || (x === c && y === c)) return;
        const o = g[y][x];
        g[y][x] = o === '.' || o === v ? v : 'b';
    };
    for (const r of rulesOf(key)) {
        const v = r.m === 'move' ? 'm' : r.m === 'cap' ? 'c' : 'b';
        for (const [dx, dy] of r.d) {
            if (r.k === 'leap') mark(c + dx, c + dy, (Math.abs(dx) > 1 || Math.abs(dy) > 1) && !r.m ? 'j' : v);
            else if (r.k === 'slide') for (let i = 1; i <= r.r; i++) mark(c + dx * i, c + dy * i, v);
            else if (r.k === 'ride') for (let i = 1; i <= r.r; i++) mark(c + dx * i, c + dy * i, 'j');
            else if (r.k === 'hop') for (let i = 2; i <= r.r; i++) mark(c + dx * i, c + dy * i, 'j');
            else if (r.k === 'cannon') for (let i = 2; i <= r.r; i++) mark(c + dx * i, c + dy * i, 'c');
        }
    }
    return g;
}

/** Every square where a piece belonging to the other side could be captured by `team`'s pieces (or
 *  just `only`'s). Squares are "x,y" strings. The danger overlay and an inspected enemy's reach. */
export function threatSquares(B, team, only = null) {
    const out = new Set();
    const ghost = { id: -1, key: 'pawn', team: team === 'e' ? 'p' : 'e', x: 0, y: 0 };
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
        if (!walkable(B, x, y)) continue;
        const o = unitAt(B, x, y);
        if (o && o.team === team) continue;
        if (!o) { ghost.x = x; ghost.y = y; B.units.push(ghost); }
        const hit = (only ? [only] : B.units.filter((u) => u.team === team)).some((u) => attacksSquare(B, u, x, y));
        if (!o) B.units.pop();
        if (hit) out.add(x + ',' + y);
    }
    return out;
}
