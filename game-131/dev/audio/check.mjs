// check.mjs — sanity-check the cut voice lines without ears: each clip's length against its text.
// A line that is far too long or short for its words was probably cut at the wrong pause.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAKES } from './takes.mjs';
const VO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../audio/vo');
let odd = 0, n = 0;
for (const [take, t] of Object.entries(TAKES)) for (const [id, text] of t.lines) {
    let d = 0;
    try { d = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(VO, id + '.mp3')]).toString(); } catch { /* missing */ }
    const cps = text.length / (d || 0.001);
    n++;
    if (!d || cps < 6 || cps > 26) { odd++; console.log(`ODD ${take} ${id}: ${d.toFixed(1)} s for ${text.length} chars (${cps.toFixed(1)} chars/s)`); }
}
console.log(`${n} lines checked, ${odd} look wrong`);
