// Mira, the mothership's flight controller: a 24×24 pixel bust drawn in code. The hair, head, headset
// and uniform are a mirrored map; the eyes, brows and mouth are drawn on top so she can blink, talk
// and react. Baked per expression on first use. Used by the comm strip (at 1×) and the cutscenes (at 8×).

const PAL = {
    h: '#6a22b8', H: '#c48cff', d: '#3e1470',          // hair, its highlight and shadow
    s: '#ffd4b8', S: '#e8a98a', b: '#ff9aa8',          // skin, shade, blush
    c: '#29e5ff', C: '#1d8fe0',                         // headset
    u: '#1d3a9f', U: '#ffc400', a: '#a8dcff', n: '#0e1f66',   // uniform, gold trim, collar, dark
    w: '#ffffff', i: '#29e5ff', I: '#1d8fe0', p: '#1a1040',   // eyes
    l: '#ff5e8a', o: '#7a1030', t: '#ffffff', k: '#05051a',   // lips, mouth inside, teeth, outline
};

const HALF = [
    '.....hhhhhhh',
    '...hhhhhhhhh',
    '..hhHHcccccc',
    '.hhHHhhhhhhh',
    '.hhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhs',
    'hhhhhhhsssss',
    'dhhhhsssssss',
    'dhhhssssssss',
    'dhcCssssssss',
    'dhccssssssss',
    'dhCcssssssss',
    'dhCCssssssss',
    'dhhhsssssssS',
    '.dhhhsssssss',
    '.dhhhhssssss',
    '..dhhhhsssss',
    '..dhhhhhSSSS',
    '...uuuuSSSSS',
    '..uuuuuuaaaS',
    '.uuuUuuuuaau',
    'uuuuUuuuuuuu',
];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function base() {
    const c = canvas(24, 24), g = c.getContext('2d');
    HALF.forEach((row, y) => {
        for (let x = 0; x < 12; x++) {
            const k = row[x];
            if (k === '.') continue;
            g.fillStyle = PAL[k];
            g.fillRect(x, y, 1, 1);
            g.fillRect(23 - x, y, 1, 1);
        }
    });
    return c;
}

const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = PAL[color] || color; g.fillRect(x, y, w, h); };

/** mood: 'smile' | 'neutral' | 'worry' | 'wink'; mouth: 'closed' | 'open'; blink: eyes shut. */
function draw(mood, mouth, blink) {
    const c = base(), g = c.getContext('2d');
    // eyes: lashes, white, iris with a highlight; a blink is a lash line
    for (const side of [0, 1]) {
        const x0 = side ? 14 : 6, shut = blink || (mood === 'wink' && side === 1);
        if (shut) { px(g, 'p', x0, 12, 4); px(g, 'p', side ? x0 + 3 : x0 - 1, 11); continue; }
        px(g, 'p', x0, 10, 4);
        px(g, 'p', side ? x0 + 4 : x0 - 1, 11);                          // the outer lash flick
        px(g, 'w', x0, 11, 4, 2);
        px(g, 'i', x0 + 1, 11, 2, 2);
        px(g, 'I', x0 + 1, 12, 2, 1);
        px(g, 'p', x0 + (side ? 2 : 1), 11, 1, 2);
        px(g, 'w', x0 + (side ? 1 : 2), 11);                             // the glint
        // brows
        const by = mood === 'worry' ? (side ? 8 : 9) : 9;
        px(g, 'd', x0, mood === 'worry' ? (side ? 9 : 8) : 8, 4);
        if (mood === 'worry') px(g, 'd', side ? x0 : x0 + 3, 9);
    }
    // blush
    px(g, 'b', 5, 14, 2); px(g, 'b', 17, 14, 2);
    // nose
    px(g, 'S', 11, 14, 2);
    // mouth
    if (mouth === 'open') {
        px(g, 'l', 10, 16, 4); px(g, 'o', 10, 17, 4); px(g, 'o', 11, 18, 2); px(g, 'l', 10, 18); px(g, 'l', 13, 18);
        px(g, 't', 11, 17, 2);
    } else if (mood === 'smile' || mood === 'wink') {
        px(g, 'l', 10, 17, 4); px(g, 'l', 9, 16); px(g, 'l', 14, 16);
    } else if (mood === 'worry') {
        px(g, 'l', 10, 17, 4); px(g, 'l', 9, 18); px(g, 'l', 14, 18);
    } else px(g, 'l', 10, 17, 4);
    // the headset boom: from the right ear cup, down and round to just by the mouth
    px(g, 'c', 20, 14); px(g, 'c', 20, 15); px(g, 'C', 19, 16); px(g, 'C', 18, 17); px(g, 'c', 17, 18); px(g, 'c', 16, 18);
    px(g, 'c', 15, 18);
    // the outline: one black pixel around everything opaque
    const out = canvas(26, 26), og = out.getContext('2d');
    const d = c.getContext('2d').getImageData(0, 0, 24, 24).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < 24 && y < 24 && d[(y * 24 + x) * 4 + 3] > 0;
    og.fillStyle = PAL.k;
    for (let y = -1; y <= 24; y++) for (let x = -1; x <= 24; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) og.fillRect(x + 1, y + 1, 1, 1);
    }
    og.drawImage(c, 1, 1);
    return out;
}

const cache = new Map();
export function portrait(mood = 'neutral', mouth = 'closed', blink = false) {
    const key = mood + mouth + (blink ? 'b' : '');
    let c = cache.get(key);
    if (!c) { c = draw(mood, mouth, blink); cache.set(key, c); }
    return c;
}
