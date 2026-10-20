/**
 * tune.mjs — fit each story level's moves and star scores to the bot, and write them into
 * js/sim/levels.js (the TUNED table).
 *
 *   node game-088/dev/tune.mjs              # fit and write
 *   DRY=1 node game-088/dev/tune.mjs        # print the table only
 *   SEEDS=24 ONLY=1-12 node game-088/dev/tune.mjs
 *
 * For each level, a skill-0.5 bot plays SEEDS boards with no move limit; the moves it needed
 * give the level's moves at a quantile that falls as the level gets harder (a skill-0.5 bot
 * should win about 85% of the first levels and 60% of the hardest). The bot then plays the
 * level again with those moves, and the scores of its wins set two and three stars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Bd = await import('../js/sim/board.js');
const Bt = await import('../js/sim/bot.js');
const Lv = await import('../js/sim/levels.js');

const SEEDS = +(process.env.SEEDS || 16);
const [lo, hi] = (process.env.ONLY || `1-${Lv.STORY_LEVELS}`).split('-').map(Number);
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const round = (v, to) => Math.max(to, Math.round(v / to) * to);

const table = Lv.TUNED.slice();
for (let n = lo; n <= hi; n++) {
    const spec = Lv.levelSpec(n);
    const needed = [];
    for (let s = 1; s <= SEEDS; s++) {
        const B = Bd.makeBoard({ ...spec, moves: 250 }, s * 7717 + n);
        const r = Bt.playBoard(B, Bt.makeBot({ skill: 0.5, seed: s }));
        needed.push(r.won ? r.movesUsed : 250);
    }
    const quant = n <= 6 ? 0.95 : spec.hard ? 0.6 : 0.72 - spec.diff * 0.12;
    const floor = n <= 3 ? 16 : n <= 8 ? 14 : 12;
    const moves = Math.min(45, Math.max(floor, q(needed, quant) + 2));
    const scores = [];
    let wins = 0;
    for (let s = 1; s <= SEEDS; s++) {
        const B = Bd.makeBoard({ ...spec, moves }, s * 104729 + n);
        const r = Bt.playBoard(B, Bt.makeBot({ skill: 0.5, seed: 100 + s }));
        if (r.won) { wins++; scores.push(r.score); }
    }
    const s2 = round(q(scores.length ? scores : [moves * 800], 0.35), 500);
    const s3 = Math.max(s2 + 1000, round(q(scores.length ? scores : [moves * 1400], 0.8), 500));
    table[n - 1] = [moves, s2, s3];
    console.log(`${String(n).padStart(2)} ${spec.shape.padEnd(9)} d${spec.diff.toFixed(2)} ${spec.goals.map((g) => g.kind + g.n).join(' ').padEnd(30)} needed p50 ${q(needed, 0.5)} → moves ${moves}  win@0.5 ${Math.round((wins / SEEDS) * 100)}%  ★★ ${s2} ★★★ ${s3}`);
}

if (!process.env.DRY) {
    const file = path.join(HERE, '../js/sim/levels.js');
    const src = fs.readFileSync(file, 'utf8');
    const rows = table.map((t) => `[${t.join(', ')}]`);
    const lines = [];
    for (let i = 0; i < rows.length; i += 6) lines.push('    ' + rows.slice(i, i + 6).join(', ') + ',');
    const out = src.replace(/export const TUNED = \[[\s\S]*?\];/, `export const TUNED = [\n${lines.join('\n')}\n];`);
    fs.writeFileSync(file, out);
    console.log(`wrote ${table.length} levels to js/sim/levels.js`);
}
