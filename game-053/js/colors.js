// LoGD-style backtick colour codes, remapped for a dark-wood background.
//   `1 dark blue   `! bright blue   `2 dark green  `@ bright green
//   `3 dark cyan   `# bright cyan   `4 dark red    `$ bright red
//   `5 purple      `% pink          `6 gold        `^ yellow
//   `7 grey        `& white         `) light grey  `Q orange   `q dark orange
//   `0 reset       `b bold on/off   `i italic on/off   `c centre the line
//   `` a literal backtick

export const CODES = {
    '1': 'c1', '!': 'c1b', '2': 'c2', '@': 'c2b', '3': 'c3', '#': 'c3b',
    '4': 'c4', '$': 'c4b', '5': 'c5', '%': 'c5b', '6': 'c6', '^': 'c6b',
    '7': 'c7', '&': 'c7b', ')': 'c7l', 'Q': 'cQ', 'q': 'cq',
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** Convert a coded string to safe HTML. */
export function colorize(str) {
    const s = String(str ?? '');
    let out = '';
    let colorOpen = false, bold = false, ital = false, center = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '`' && i + 1 < s.length) {
            const c = s[++i];
            if (c === '`') { out += '`'; continue; }
            if (c === '0') { if (colorOpen) { out += '</span>'; colorOpen = false; } continue; }
            if (c === 'b') { out += bold ? '</b>' : '<b>'; bold = !bold; continue; }
            if (c === 'i') { out += ital ? '</i>' : '<i>'; ital = !ital; continue; }
            if (c === 'c') { center = true; continue; }
            if (c === 'n') { out += '<br>'; continue; }
            const cls = CODES[c];
            if (cls) {
                if (colorOpen) out += '</span>';
                out += `<span class="${cls}">`;
                colorOpen = true;
            }
            continue;
        }
        out += ESC[ch] ?? ch;
    }
    if (colorOpen) out += '</span>';
    if (ital) out += '</i>';
    if (bold) out += '</b>';
    return center ? `<div class="center">${out}</div>` : out;
}

/** Remove all colour codes (for lengths, titles, logs). */
export function strip(str) { return String(str ?? '').replace(/`[\s\S]/g, (m) => (m === '``' ? '`' : '')); }
