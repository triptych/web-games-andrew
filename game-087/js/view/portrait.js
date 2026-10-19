// Thalion Silverquill, Master of the Guild: a portrait in SVG, built as a string so the dev gallery and the
// tests can draw him too. Moods change the brows, the eyes and the mouth; the lids blink (style.css).
//
//   thalionSvg('smile')  → '<svg …>'   moods: neutral smile laugh wry thoughtful proud concern surprised

const SKIN = '#efcfb2', SKIN_SH = '#d6a684', SKIN_HI = '#fae6d2', LIP = '#c4857a', BROW = '#5f5862', LASH = '#33262a';
const HAIR = '#e8eaf0', HAIR_SH = '#aab1c2', HAIR_LINE = '#8d95a8';
const ROBE_SH = '#11241f', GOLD = '#d8b25c', IRIS = '#3e9a72';

export const MOODS = ['neutral', 'smile', 'laugh', 'wry', 'thoughtful', 'proud', 'concern', 'surprised'];

/** Brow as a filled crescent. inner/outer: vertical offsets of its ends (negative is up). side -1 left, 1 right. */
function brow(side, inner = 0, outer = 0, arch = 0) {
    const cx = 120;
    const X = (dx) => (cx + side * dx).toFixed(1);
    const yi = 106 + inner, yo = 108 + outer;
    return `<path d="M${X(5)} ${yi} C ${X(14)} ${yi - 6 - arch} ${X(28)} ${yo - 9 - arch} ${X(37)} ${yo - 2} L ${X(36)} ${yo + 1} C ${X(27)} ${yo - 5 - arch} ${X(15)} ${yi - 2 - arch} ${X(6)} ${yi + 3} Z" fill="${BROW}"/>`;
}

function eye(side, { look = [0, 0], open = 1, closed = false, wide = 0 } = {}) {
    const X = (dx) => (120 + side * dx).toFixed(1);
    const top = 113.5 - wide, bot = 128 + wide * 0.4;
    const outer = `${X(32)} 120`, inner = `${X(7)} 124`;
    const almond = `M${outer} C ${X(26)} ${top} ${X(13)} ${top + 1} ${inner} C ${X(14)} ${bot} ${X(26)} ${bot} ${outer} Z`;
    if (closed) {
        // a happy closed eye: an upward arc with a lash flick
        return `<path d="M${X(32)} 123 C ${X(25)} 115 ${X(13)} 115 ${X(7)} 123" fill="none" stroke="${LASH}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M${X(32)} 123 L ${X(35)} 120" stroke="${LASH}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    const id = side < 0 ? 'th-el' : 'th-er';
    const ix = 120 + side * 19 + look[0], iy = 121.5 + look[1];
    return `<clipPath id="${id}"><path d="${almond}"/></clipPath>
<path d="${almond}" fill="#fbf6ee"/>
<g clip-path="url(#${id})">
  <circle cx="${ix}" cy="${iy}" r="5.4" fill="${IRIS}"/>
  <circle cx="${ix}" cy="${iy}" r="5.4" fill="none" stroke="#1f5a41" stroke-width="1.1"/>
  <circle cx="${ix}" cy="${iy + 0.4}" r="2.4" fill="#0f1d17"/>
  <circle cx="${ix + 1.6}" cy="${iy - 1.8}" r="1.3" fill="#fff"/>
  <path d="M${X(34)} ${top - 2} H ${X(4)} V ${top + 4} H ${X(34)} Z" fill="${SKIN_SH}" opacity="0.35"/>
</g>
<path d="M${outer} C ${X(26)} ${top} ${X(13)} ${top + 1} ${inner}" fill="none" stroke="${LASH}" stroke-width="2" stroke-linecap="round"/>
<path d="M${X(32)} 120 L ${X(36)} ${117 - wide}" stroke="${LASH}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M${X(29)} ${bot - 1.5} C ${X(22)} ${bot + 0.5} ${X(14)} ${bot + 0.5} ${X(9)} ${bot - 2}" fill="none" stroke="${SKIN_SH}" stroke-width="1"/>
${open ? `<path class="lid" d="M${X(34)} ${top - 3} H ${X(5)} V ${bot + 1} H ${X(34)} Z" fill="${SKIN}" clip-path="url(#${id})" opacity="0"/>` : ''}`;
}

const MOUTHS = {
    neutral: `<path d="M107 178 C 114 180 126 180 133 177" fill="none" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>`,
    smile: `<path d="M105 175 C 113 182 127 182 135 174" fill="none" stroke="${LIP}" stroke-width="2.4" stroke-linecap="round"/>`,
    laugh: `<path d="M104 173 C 112 189 128 189 136 173 C 127 177 113 177 104 173 Z" fill="#6e2f33"/><path d="M106 174.3 C 114 177.5 126 177.5 134 174.3 L 133 177 C 125 179.5 115 179.5 107 177 Z" fill="#fbf6ee"/>`,
    wry: `<path d="M108 179 C 116 180.5 126 178.5 135 172" fill="none" stroke="${LIP}" stroke-width="2.3" stroke-linecap="round"/>`,
    thoughtful: `<path d="M110 179 C 116 178 124 178 130 179" fill="none" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>`,
    proud: `<path d="M106 176 C 114 181 126 181 134 175" fill="none" stroke="${LIP}" stroke-width="2.3" stroke-linecap="round"/><path d="M134 175 l2.5 -2" stroke="${LIP}" stroke-width="1.8" stroke-linecap="round"/>`,
    concern: `<path d="M108 180 C 114 176.5 126 176.5 132 180" fill="none" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>`,
    surprised: `<ellipse cx="120" cy="179" rx="5.5" ry="6.5" fill="#6e2f33"/>`,
};

const FACES = {
    neutral: { brows: [[0, 0, 0], [0, 0, 0]], eyes: {}, },
    smile: { brows: [[0, -1, 1], [0, -1, 1]], eyes: {} },
    laugh: { brows: [[-2, -3, 2], [-2, -3, 2]], eyes: { closed: true } },
    wry: { brows: [[1, 1, -1], [-5, -6, 3]], eyes: { look: [1.2, 0] } },
    thoughtful: { brows: [[-1, 1, 0], [1, 2, 0]], eyes: { look: [-2.4, -1.4] } },
    proud: { brows: [[-1, -2, 1], [-1, -2, 1]], eyes: { look: [0.5, -0.5] } },
    concern: { brows: [[-5, 2, 0], [-5, 2, 0]], eyes: { look: [0, 0.6] } },
    surprised: { brows: [[-6, -6, 3], [-6, -6, 3]], eyes: { wide: 2.2 } },
};

export function thalionSvg(mood = 'smile', { label = 'Thalion Silverquill, Master of the Guild' } = {}) {
    const f = FACES[mood] || FACES.smile;
    const eyes = eye(-1, { ...f.eyes, open: !f.eyes.closed }) + eye(1, { ...f.eyes, look: f.eyes.look ? [f.eyes.look[0], f.eyes.look[1]] : [0, 0], open: !f.eyes.closed });
    const [bl, br] = f.brows;
    const m = FACES[mood] ? mood : 'smile';
    return `<svg class="thalion mood-${m}" viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${String(label).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">
<defs>
  <linearGradient id="th-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f6fa"/><stop offset="0.55" stop-color="${HAIR}"/><stop offset="1" stop-color="${HAIR_SH}"/></linearGradient>
  <linearGradient id="th-robe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5446"/><stop offset="1" stop-color="${ROBE_SH}"/></linearGradient>
  <radialGradient id="th-face" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${SKIN_HI}"/><stop offset="0.6" stop-color="${SKIN}"/><stop offset="1" stop-color="${SKIN_SH}"/></radialGradient>
</defs>
<!-- hair, behind -->
<path d="M70 70 C 58 110 54 170 44 230 C 38 262 30 286 26 300 L 214 300 C 210 286 202 262 196 230 C 186 170 182 110 170 70 C 160 44 140 34 120 34 C 100 34 80 44 70 70 Z" fill="url(#th-hair)"/>
<path d="M66 140 C 60 190 52 240 40 290 M76 120 C 72 180 66 240 58 296 M174 140 C 180 190 188 240 200 290 M164 120 C 168 180 174 240 182 296" stroke="${HAIR_LINE}" stroke-width="1.2" fill="none" opacity="0.55"/>
<!-- robe and mantle -->
<path d="M0 300 C 6 270 28 252 62 242 C 82 236 96 232 104 226 L 136 226 C 144 232 158 236 178 242 C 212 252 234 270 240 300 Z" fill="url(#th-robe)"/>
<path d="M104 226 C 100 246 108 268 120 286 C 132 268 140 246 136 226" fill="${ROBE_SH}"/>
<path d="M62 242 C 82 236 96 232 104 226 C 102 250 110 272 120 290 C 130 272 138 250 136 226 C 144 232 158 236 178 242" fill="none" stroke="${GOLD}" stroke-width="3"/>
<path d="M72 250 C 86 246 96 242 102 238 M168 250 C 154 246 144 242 138 238" stroke="${GOLD}" stroke-width="1.2" fill="none" opacity="0.7"/>
<path d="M30 276 q 8 -6 16 0 q 8 6 16 0 M178 276 q 8 -6 16 0 q 8 6 16 0" stroke="${GOLD}" stroke-width="1.3" fill="none" opacity="0.55"/>
<!-- the guild brooch: a quill in a ring -->
<circle cx="120" cy="268" r="9" fill="${ROBE_SH}" stroke="${GOLD}" stroke-width="2.2"/>
<path d="M115 274 C 118 268 122 262 126 260 C 124 265 121 270 115 274 Z" fill="${GOLD}"/>
<!-- neck -->
<path d="M103 182 C 104 200 103 216 99 230 L 141 230 C 137 216 136 200 137 182 Z" fill="${SKIN}"/>
<path d="M103 186 C 112 200 128 200 137 186 L 137 200 C 128 208 112 208 103 200 Z" fill="${SKIN_SH}" opacity="0.55"/>
<!-- face -->
<path d="M79 110 C 78 80 96 60 120 60 C 144 60 162 80 161 110 C 161 132 159 150 153 165 C 147 180 136 195 120 202 C 104 195 93 180 87 165 C 81 150 79 132 79 110 Z" fill="url(#th-face)"/>
<path d="M86 146 C 90 158 97 164 104 167 C 99 158 96 150 95 140 C 92 141 88 143 86 146 Z M154 146 C 150 158 143 164 136 167 C 141 158 144 150 145 140 C 148 141 152 143 154 146 Z" fill="${SKIN_SH}" opacity="0.22"/>
<path d="M153 165 C 147 180 136 195 120 202 C 130 194 140 182 146 168 Z" fill="${SKIN_SH}" opacity="0.45"/>
<!-- brows, eyes, nose, mouth -->
${brow(-1, ...bl)}${brow(1, ...br)}
${eyes}
<path d="M117 127 C 117 140 115 151 112 160" fill="none" stroke="${SKIN_SH}" stroke-width="1.5" stroke-linecap="round"/>
<path d="M121 130 C 122 142 123 151 123 156" fill="none" stroke="${SKIN_HI}" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
<path d="M111 162 C 115 166 125 166 129 162" fill="none" stroke="${SKIN_SH}" stroke-width="1.6" stroke-linecap="round"/>
${MOUTHS[mood] || MOUTHS.smile}
<path d="M114 187 C 118 189 122 189 126 187" fill="none" stroke="${SKIN_SH}" stroke-width="1.2" opacity="0.7"/>
<path d="M84 100 C 100 100 124 92 140 76 C 146 84 152 92 156 104 C 140 90 116 102 86 106 Z" fill="${SKIN_SH}" opacity="0.35"/>
<!-- hair, in front: a sweep across the brow and locks along the cheeks -->
<path d="M76 112 C 70 72 92 42 122 42 C 152 42 172 64 166 108 C 160 88 150 76 140 70 C 132 86 112 96 92 94 C 84 98 79 104 76 112 Z" fill="url(#th-hair)"/>
<path d="M140 70 C 128 84 110 92 92 93 M132 58 C 120 70 104 78 88 82 M150 58 C 158 70 162 84 164 100" stroke="${HAIR_LINE}" stroke-width="1.1" fill="none" opacity="0.6"/>
<path d="M80 96 C 70 126 74 176 66 236 C 72 242 80 242 86 238 C 88 190 82 140 88 104 Z" fill="url(#th-hair)"/>
<path d="M160 96 C 170 126 166 176 174 236 C 168 242 160 242 154 238 C 152 190 158 140 152 104 Z" fill="url(#th-hair)"/>
<path d="M82 120 C 78 160 78 200 74 232 M158 120 C 162 160 162 200 166 232" stroke="${HAIR_LINE}" stroke-width="1" fill="none" opacity="0.55"/>
<!-- ears: long, pointed, tucked over the hair -->
<path d="M83 126 C 72 118 61 106 50 92 C 55 110 62 130 71 148 C 75 155 80 158 85 156 Z" fill="${SKIN}"/>
<path d="M82 131 C 73 124 65 114 58 104 C 63 118 68 132 74 144" fill="none" stroke="${SKIN_SH}" stroke-width="1.5"/>
<path d="M157 126 C 168 118 179 106 190 92 C 185 110 178 130 169 148 C 165 155 160 158 155 156 Z" fill="${SKIN}"/>
<path d="M158 131 C 167 124 175 114 182 104 C 177 118 172 132 166 144" fill="none" stroke="${SKIN_SH}" stroke-width="1.5"/>
<circle cx="73" cy="147" r="1.8" fill="${GOLD}"/>
</svg>`;
}
