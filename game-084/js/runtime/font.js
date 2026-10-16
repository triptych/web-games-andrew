// VESTA-8 runtime: the 3×5 system font.
//
// Every runtime part is one self-contained function that adds to V. The exporter writes each
// part's source into a standalone HTML file with fn.toString(), so a part may use only V, its
// arguments and standard globals: no imports, no module-level names.
//
// A glyph is five digits, one per row from the top. Each digit is three bits: 4 is the left
// pixel, 2 the middle, 1 the right.

export function font(V) {
    const G = {
        ' ': '00000', '!': '22202', '"': '55000', '#': '57575', '$': '27672', '%': '51245',
        '&': '25253', "'": '22000', '(': '12221', ')': '42224', '*': '05250', '+': '02720',
        ',': '00024', '-': '00700', '.': '00002', '/': '11244', '0': '75557', '1': '26227',
        '2': '71747', '3': '71317', '4': '55711', '5': '74717', '6': '74757', '7': '71111',
        '8': '75757', '9': '75711', ':': '02020', ';': '02024', '<': '12421', '=': '07070',
        '>': '42124', '?': '71302', '@': '75547', 'A': '75755', 'B': '65756', 'C': '74447',
        'D': '65556', 'E': '74647', 'F': '74644', 'G': '74557', 'H': '55755', 'I': '72227',
        'J': '11157', 'K': '55655', 'L': '44447', 'M': '57555', 'N': '65555', 'O': '25552',
        'P': '75744', 'Q': '75563', 'R': '75655', 'S': '34216', 'T': '72222', 'U': '55557',
        'V': '55552', 'W': '55575', 'X': '55255', 'Y': '55222', 'Z': '71247', '[': '64446',
        '\\': '44211', ']': '31113', '^': '25000', '_': '00007', '`': '42000', '{': '32623',
        '|': '22222', '}': '62326', '~': '03600',
        '♥': '57720', '★': '27252', '←': '24742', '→': '21712',
        '↑': '27222', '↓': '22272', '●': '27772', '♪': '33226',
    };
    const glyphs = {};
    for (const ch in G) {
        const rows = G[ch];
        const px = [];
        for (let r = 0; r < 5; r++) {
            const bits = +rows[r];
            for (let c = 0; c < 3; c++) if (bits & (4 >> c)) px.push(c, r);
        }
        glyphs[ch] = px;
    }
    V.GLYPHS = glyphs;
    /** The glyph for a character: lower case draws as upper case, unknown characters as '?'. */
    V.glyph = (ch) => glyphs[ch] || glyphs[ch.toUpperCase()] || glyphs['?'];
    V.CHAR_W = 4;
    V.CHAR_H = 6;
}
