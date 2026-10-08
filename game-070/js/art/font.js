// The stroke font: every glyph is a few polylines on a 4 × 6 grid (y up), in the
// squared style of early vector games. Each polyline is a string of digit pairs
// "xy"; '|' starts a new one. A single point is a dot.

const G = {
    A: '0004264440|0343', B: '00063645443303|3342413000', C: '46060040', D: '00062644422000',
    E: '46060040|0333', F: '460600|0333', G: '45460600404323', H: '0006|4640|0343',
    I: '0646|0040|2620', J: '46400002', K: '0006|460340', L: '060040',
    M: '0006244640', N: '00064046', O: '0006464000', P: '0006464303',
    Q: '000646420200|2240', R: '0006464303|1340', S: '460603434000', T: '0646|2620',
    U: '06004046', V: '062046', W: '0600224046', X: '0046|0640',
    Y: '0623|4623|2320', Z: '06460040',
    0: '0006464000|0046', 1: '2026|1526|1030', 2: '064643030040', 3: '06464000|0343',
    4: '060343|4640', 5: '460603434000', 6: '460600404303', 7: '064640',
    8: '0006464000|0343', 9: '430306464000',
    ' ': '', '.': '2020', ',': '2110', '!': '2622|2020', '?': '040646442322|2020',
    '-': '1333', '+': '1333|2422', ':': '2525|2121', '/': '0046', "'": '2625', '"': '1615|3635',
    '(': '36141230', ')': '16343210', '=': '0242|0444', '<': '360330', '>': '164310',
    '{': '0343|0321|0325', '}': '0343|4321|4325', '^': '2026|0426|4426', '~': '2026|0220|4220',
    '*': '0343|2125|1135|3115', '_': '0040', '#': '1015|3035|0242|0444', '%': '0046|0606|4040',
    'x': '1135|1531', '·': '2323',
};

// parsed: char → array of flat point arrays
const PARSED = {};
for (const [ch, s] of Object.entries(G)) {
    PARSED[ch] = s.split('|').filter((p) => p.trim().length >= 2).map((p) => {
        const d = p.replace(/\s/g, '');
        const pts = [];
        for (let i = 0; i + 1 < d.length; i += 2) pts.push(+d[i], +d[i + 1]);
        return pts;
    });
}

export const ADVANCE = 6;   // grid units per character at scale 1 (4 wide + 2 gap)
export const HEIGHT = 6;

export function glyph(ch) {
    return PARSED[ch] || PARSED[ch.toUpperCase()] || PARSED['?'];
}

export function textWidth(str, size = 1) {
    return Math.max(0, str.length * ADVANCE - 2) * size;
}

/** Number of strokes a string draws (for reveal animations). */
export function strokeCount(str) {
    let n = 0;
    for (const ch of str) for (const p of glyph(ch)) n += Math.max(1, p.length / 2 - 1);
    return n;
}

/**
 * Draw text with a Beams pen. x,y is the baseline-left (or centre/right by align).
 * `reveal` (0..1) draws only that fraction of the strokes, the last one partly,
 * so a title can write itself out. `jitter` wobbles each character.
 */
export function drawText(beams, str, x, y, size = 1, align = 'left', reveal = 1, jitter = 0, t = 0) {
    str = String(str);
    const w = textWidth(str, size);
    let ox = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const total = reveal < 1 ? strokeCount(str) : 0;
    let budget = reveal < 1 ? reveal * total : Infinity;
    for (let ci = 0; ci < str.length; ci++) {
        const polys = glyph(str[ci]);
        const jx = jitter ? Math.sin(t * 13 + ci * 2.1) * jitter : 0;
        const jy = jitter ? Math.cos(t * 11 + ci * 1.7) * jitter : 0;
        for (const p of polys) {
            if (p.length === 2) {
                if (budget <= 0) return;
                budget -= 1;
                beams.dot(ox + p[0] * size + jx, y + p[1] * size + jy);
                continue;
            }
            for (let k = 0; k + 3 < p.length; k += 2) {
                if (budget <= 0) return;
                const f = Math.min(1, budget);
                budget -= 1;
                const ax = ox + p[k] * size + jx, ay = y + p[k + 1] * size + jy;
                const bx = ox + p[k + 2] * size + jx, by = y + p[k + 3] * size + jy;
                beams.seg(ax, ay, ax + (bx - ax) * f, ay + (by - ay) * f);
            }
        }
        ox += ADVANCE * size;
    }
}
