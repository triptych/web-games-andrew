// An auto-player. It plays through act(), the same commands the player's drags make, so the
// tests, the balance table and the title screen's attract demo all exercise the real rules.
// Pure, like the rest of js/sim: its own seeded randomness, no clock.

import { N } from '../config.js';
import { makeRng } from '../rng.js';
import { BLIGHT, canPlace, fitsAnywhere, powerUsable } from './game.js';
import { rotateCells, sizeOf } from './pieces.js';

/** skill 1 plays its best move; lower skill adds noise to its judgement and blunders sometimes. */
export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed) };
}

const idx = (x, y) => y * N + x;

/** Fill a glyph into a copy of the board and clear its lines. Returns the board after, and what cleared. */
function simulate(cells, sigils, piece, x, y) {
    const b = cells.slice();
    for (const [cx, cy] of piece) b[idx(x + cx, y + cy)] = 1;
    let lines = 0, sig = 0;
    const clear = new Set();
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = !!b[idx(c, r)]; if (ok) { lines++; for (let c = 0; c < N; c++) clear.add(idx(c, r)); } }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = !!b[idx(c, r)]; if (ok) { lines++; for (let r = 0; r < N; r++) clear.add(idx(c, r)); } }
    for (const i of clear) {
        if (sigils[i]) sig++;
        if (cells[i] !== BLIGHT) b[i] = 0;      // blight stays (cracked) or breaks; count it as staying
    }
    return { b, lines, sig };
}

/** How good a board is to keep playing on: open, smooth, few lonely holes. */
function evaluate(b) {
    let empty = 0, holes = 0, rough = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const f = !!b[idx(x, y)];
        if (!f) {
            empty++;
            let walls = 0;
            if (x === 0 || b[idx(x - 1, y)]) walls++;
            if (x === N - 1 || b[idx(x + 1, y)]) walls++;
            if (y === 0 || b[idx(x, y - 1)]) walls++;
            if (y === N - 1 || b[idx(x, y + 1)]) walls++;
            if (walls >= 3) holes += walls === 4 ? 2 : 1;
        }
        if (x < N - 1 && f !== !!b[idx(x + 1, y)]) rough++;
        if (y < N - 1 && f !== !!b[idx(x, y + 1)]) rough++;
    }
    // reward rows and columns that are nearly full: they are the next clears
    let near = 0;
    for (let r = 0; r < N; r++) { let n = 0; for (let c = 0; c < N; c++) if (b[idx(c, r)]) n++; if (n >= N - 2) near++; }
    for (let c = 0; c < N; c++) { let n = 0; for (let r = 0; r < N; r++) if (b[idx(c, r)]) n++; if (n >= N - 2) near++; }
    return empty * 1.2 - holes * 6 - rough * 0.9 + near * 1.5;
}

function fitsOn(b, cells) {
    const { w, h } = sizeOf(cells);
    for (let y = 0; y + h <= N; y++) for (let x = 0; x + w <= N; x++) {
        let ok = true;
        for (const [cx, cy] of cells) if (b[idx(x + cx, y + cy)]) { ok = false; break; }
        if (ok) return true;
    }
    return false;
}

/** The bot's next command, or null if it has nothing to do. */
export function botCommand(G, bot) {
    if (G.over) return null;
    const noise = (1 - bot.skill) * 90;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < G.hand.length; i++) {
        const h = G.hand[i];
        if (!h) continue;
        const { w, h: hgt } = sizeOf(h.cells);
        for (let y = 0; y + hgt <= N; y++) for (let x = 0; x + w <= N; x++) {
            if (!canPlace(G, h.cells, x, y)) continue;
            const s = simulate(G.cells, G.sigils, h.cells, x, y);
            let score = s.lines * 30 + s.lines * s.lines * 6 + s.sig * 8 + evaluate(s.b);
            // the rest of the hand still has to go somewhere
            for (let j = 0; j < G.hand.length; j++) if (j !== i && G.hand[j] && !fitsOn(s.b, G.hand[j].cells)) score -= 60;
            if (noise) score += (bot.rng() - 0.5) * noise;
            if (score > bestScore) { bestScore = score; best = { t: 'place', i, x, y }; }
        }
    }
    if (best && bot.skill < 1 && bot.rng() < (1 - bot.skill) * 0.12) {
        // a blunder: any legal move at all
        const legal = [];
        G.hand.forEach((h, i) => { if (h) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (canPlace(G, h.cells, x, y)) legal.push({ t: 'place', i, x, y }); });
        if (legal.length) return legal[Math.floor(bot.rng() * legal.length)];
    }
    if (best) return best;
    return rescue(G);
}

/** Stuck: spend sparks on whichever power gets the hand moving. */
function rescue(G) {
    if (powerUsable(G, 'turn')) {
        for (let i = 0; i < G.hand.length; i++) {
            const h = G.hand[i];
            if (h && fitsAnywhere(G, rotateCells(h.cells))) return { t: 'power', p: 'turn', i };
        }
    }
    if (powerUsable(G, 'starfall') && G.cells.filter((c) => c === BLIGHT).length >= 3) return { t: 'power', p: 'starfall' };
    if (powerUsable(G, 'strike')) {
        let bx = 1, by = 1, bn = -1;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const px = x + dx, py = y + dy;
                if (px >= 0 && py >= 0 && px < N && py < N && G.cells[idx(px, py)]) n++;
            }
            if (n > bn) { bn = n; bx = x; by = y; }
        }
        return { t: 'power', p: 'strike', x: bx, y: by };
    }
    if (powerUsable(G, 'lantern')) {
        // the empty cell that completes the most, or failing that the loneliest hole
        let pick = null, ps = -1;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            if (G.cells[idx(x, y)]) continue;
            let row = 0, col = 0;
            for (let k = 0; k < N; k++) { if (G.cells[idx(k, y)]) row++; if (G.cells[idx(x, k)]) col++; }
            const s = (row === N - 1 ? 100 : row) + (col === N - 1 ? 100 : col);
            if (s > ps) { ps = s; pick = { x, y }; }
        }
        if (pick) return { t: 'power', p: 'lantern', ...pick };
    }
    if (powerUsable(G, 'transmute')) return { t: 'power', p: 'transmute' };
    if (powerUsable(G, 'starfall')) return { t: 'power', p: 'starfall' };
    return null;
}
