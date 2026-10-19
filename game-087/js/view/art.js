// The rest of the guild's art, as SVG strings: the foes of the Proving Grounds, the apprentice's sigil
// and the room emblems on the doors of the Great Hall. Strings, so the gallery, the book and the tests share them.

// ------------------------------------------------------------------ foes (viewBox 0 0 160 160)

const FOE_ART = {
    imp: `<ellipse cx="80" cy="146" rx="34" ry="6" fill="#000" opacity="0.25"/>
<path d="M50 70 L 38 34 L 62 58 Z M110 70 L 122 34 L 98 58 Z" fill="#e0769a"/>
<ellipse cx="80" cy="104" rx="30" ry="34" fill="#f08bb0"/>
<circle cx="80" cy="76" r="30" fill="#f59cbe"/>
<path d="M56 126 q -14 18 -26 8 M104 126 q 14 18 26 8" stroke="#e0769a" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M108 110 C 130 112 140 96 132 84 l 8 -4 l -2 10" stroke="#e0769a" stroke-width="4" fill="none" stroke-linecap="round"/>
<g class="eyes"><ellipse cx="69" cy="74" rx="7" ry="9" fill="#fff"/><ellipse cx="91" cy="74" rx="7" ry="9" fill="#fff"/><circle cx="71" cy="76" r="4" fill="#2b1630"/><circle cx="93" cy="76" r="4" fill="#2b1630"/></g>
<path d="M66 92 C 74 100 86 100 94 92" stroke="#2b1630" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M78 96 l 3 5 l 3 -5" fill="#fff"/>
<path d="M56 106 l -14 -6 M104 106 l 14 -6" stroke="#e0769a" stroke-width="6" stroke-linecap="round"/>
<circle cx="40" cy="98" r="5" fill="#f59cbe"/><circle cx="122" cy="98" r="5" fill="#f59cbe"/>`,
    wraith: `<defs><linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fb"/><stop offset="1" stop-color="#f4f6fb" stop-opacity="0"/></linearGradient></defs>
<path d="M80 18 C 112 18 126 46 126 78 C 126 110 134 126 140 150 C 126 140 118 152 106 142 C 96 156 88 142 80 154 C 72 142 64 156 54 142 C 42 152 34 140 20 150 C 26 126 34 110 34 78 C 34 46 48 18 80 18 Z" fill="url(#fw)"/>
<path d="M44 70 C 50 50 64 40 80 40 C 96 40 110 50 116 70" fill="none" stroke="#c8cfe0" stroke-width="2"/>
<path d="M50 96 l 28 4 M54 108 l 36 2 M58 120 l 26 0" stroke="#b5bdd0" stroke-width="2" opacity="0.6"/>
<g class="eyes"><ellipse cx="66" cy="66" rx="8" ry="12" fill="#1c2233"/><ellipse cx="94" cy="66" rx="8" ry="12" fill="#1c2233"/><circle cx="66" cy="70" r="2.5" fill="#9fd2ff"/><circle cx="94" cy="70" r="2.5" fill="#9fd2ff"/></g>
<ellipse cx="80" cy="90" rx="6" ry="9" fill="#1c2233" opacity="0.8"/>`,
    goblin: `<ellipse cx="80" cy="148" rx="36" ry="6" fill="#000" opacity="0.25"/>
<path d="M44 66 L 6 52 L 40 84 Z M116 66 L 154 52 L 120 84 Z" fill="#7da34f"/>
<path d="M42 140 C 40 112 52 96 80 96 C 108 96 120 112 118 140 Z" fill="#5d4a7a"/>
<circle cx="80" cy="72" r="36" fill="#8fbb5c"/>
<path d="M54 60 C 62 54 70 56 74 62 M86 62 C 90 56 98 54 106 60" stroke="#3b4a24" stroke-width="4" fill="none" stroke-linecap="round"/>
<g class="eyes"><circle cx="64" cy="72" r="11" fill="#fff" stroke="#c49a3a" stroke-width="3"/><circle cx="96" cy="72" r="11" fill="#fff" stroke="#c49a3a" stroke-width="3"/><path d="M75 72 h10" stroke="#c49a3a" stroke-width="3"/><circle cx="66" cy="74" r="4" fill="#232"/><circle cx="98" cy="74" r="4" fill="#232"/></g>
<path d="M78 82 C 76 90 84 92 84 86" fill="#6f9944"/>
<path d="M62 96 C 72 90 88 90 98 96" stroke="#3b4a24" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M68 94 l3 5 l3 -6 M88 93 l3 6 l3 -5" fill="#fff"/>
<rect x="100" y="104" width="22" height="28" rx="2" fill="#efe2bf" transform="rotate(12 111 118)"/>
<path d="M104 112 h14 M104 118 h12 M104 124 h14" stroke="#9a8a6a" stroke-width="1.5" transform="rotate(12 111 118)"/>`,
    golem: `<ellipse cx="80" cy="150" rx="50" ry="6" fill="#000" opacity="0.3"/>
<path d="M40 150 V 120 H 64 V 150 Z M96 150 V 120 H 120 V 150 Z" fill="#6e6a64"/>
<path d="M30 124 V 56 L 46 40 H 114 L 130 56 V 124 Z" fill="#8a857c"/>
<path d="M30 80 H 130 M30 102 H 130 M62 40 V 80 M98 80 V 102 M72 102 V 124 M110 40 V 80" stroke="#5f5b54" stroke-width="2.5"/>
<path d="M14 64 h16 v 52 h -16 Z M130 64 h 16 v 52 h -16 Z" fill="#7b766e"/>
<g class="eyes"><rect x="56" y="58" width="14" height="8" fill="#ffcf5a"/><rect x="90" y="58" width="14" height="8" fill="#ffcf5a"/></g>
<path d="M44 46 l 12 6 M84 44 l -6 10 M118 70 l -8 4" stroke="#5f5b54" stroke-width="2"/>`,
    hydra: `<ellipse cx="80" cy="150" rx="60" ry="8" fill="#2e3a1e" opacity="0.6"/>
<path d="M20 150 C 30 118 52 108 80 108 C 108 108 130 118 140 150 Z" fill="#4f6b36"/>
<path d="M56 116 C 40 90 30 66 34 44 M80 110 C 80 80 78 58 80 30 M104 116 C 120 90 130 66 126 44" stroke="#5e7d40" stroke-width="16" fill="none" stroke-linecap="round"/>
<g><ellipse cx="34" cy="40" rx="16" ry="12" fill="#6d8f49"/><ellipse cx="80" cy="26" rx="16" ry="12" fill="#6d8f49"/><ellipse cx="126" cy="40" rx="16" ry="12" fill="#6d8f49"/></g>
<g class="eyes"><circle cx="28" cy="36" r="3" fill="#ffd34d"/><circle cx="40" cy="36" r="3" fill="#ffd34d"/><circle cx="74" cy="22" r="3" fill="#ffd34d"/><circle cx="86" cy="22" r="3" fill="#ffd34d"/><circle cx="120" cy="36" r="3" fill="#ffd34d"/><circle cx="132" cy="36" r="3" fill="#ffd34d"/></g>
<path d="M26 46 h16 M72 32 h16 M118 46 h16" stroke="#2e3a1e" stroke-width="2"/>
<path d="M20 150 q 10 -8 20 0 q 10 -8 20 0 q 10 -8 20 0 q 10 -8 20 0 q 10 -8 20 0 q 10 -8 20 0" fill="#3c4f2a"/>`,
    wyrm: `<ellipse cx="80" cy="150" rx="60" ry="6" fill="#000" opacity="0.25"/>
<path d="M18 140 C 24 110 50 100 70 112 C 92 124 112 118 120 96 C 128 72 118 50 100 44" stroke="#9b4e2f" stroke-width="22" fill="none" stroke-linecap="round"/>
<path d="M18 140 C 24 110 50 100 70 112 C 92 124 112 118 120 96 C 128 72 118 50 100 44" stroke="#e0a560" stroke-width="6" fill="none" stroke-dasharray="4 8" opacity="0.7"/>
<path d="M76 30 C 90 18 116 22 122 38 C 124 50 112 58 98 56 L 74 50 Z" fill="#b25e38"/>
<path d="M92 24 l -6 -14 l 14 10 M108 24 l 2 -14 l 6 14" fill="#e0a560"/>
<g class="eyes"><ellipse cx="104" cy="36" rx="5" ry="4" fill="#ffe27a"/><path d="M104 32 v8" stroke="#3a1d10" stroke-width="2"/></g>
<rect x="18" y="62" width="44" height="34" rx="3" fill="#f1e5c6" transform="rotate(-10 40 79)"/>
<path d="M24 70 h30 M24 76 h26 M24 82 h30 M24 88 h20" stroke="#a08b62" stroke-width="1.5" transform="rotate(-10 40 79)"/>
<path d="M74 50 C 66 52 60 60 62 64" stroke="#b25e38" stroke-width="4" fill="none"/>`,
    critic: `<ellipse cx="80" cy="150" rx="36" ry="6" fill="#000" opacity="0.3"/>
<path d="M46 150 C 44 112 56 92 80 92 C 104 92 116 112 114 150 Z" fill="#2a2433"/>
<path d="M80 92 L 72 150 M80 92 L 88 150" stroke="#191520" stroke-width="2"/>
<circle cx="80" cy="66" r="26" fill="#3b3346"/>
<path d="M56 60 C 58 36 102 36 104 60 C 96 48 64 48 56 60 Z" fill="#191520"/>
<g class="eyes"><path d="M66 66 l 10 3 M94 66 l -10 3" stroke="#ff5b5b" stroke-width="3" stroke-linecap="round"/></g>
<path d="M70 80 C 76 77 84 77 90 80" stroke="#ff5b5b" stroke-width="2" fill="none"/>
<path d="M118 70 C 130 52 140 34 146 14 C 136 30 126 50 116 74 Z" fill="#c43a3a"/>
<path d="M116 74 L 112 84" stroke="#c43a3a" stroke-width="3"/>
<path d="M108 104 C 114 92 116 82 114 76" stroke="#2a2433" stroke-width="10" stroke-linecap="round" fill="none"/>`,
    scarecrow: `<ellipse cx="80" cy="150" rx="30" ry="5" fill="#000" opacity="0.25"/>
<path d="M78 150 V 40 h4 V 150 Z" fill="#7a5b34"/>
<path d="M30 70 h100 v6 H30 Z" fill="#7a5b34"/>
<path d="M50 72 C 46 96 54 118 80 122 C 106 118 114 96 110 72 Z" fill="#a8835a"/>
<path d="M30 74 l -8 12 M34 74 l -2 14 M130 74 l 8 12 M126 74 l 2 14" stroke="#e2c46c" stroke-width="3"/>
<circle cx="80" cy="50" r="18" fill="#e9d6a6"/>
<g class="eyes"><path d="M72 48 l6 6 M78 48 l-6 6 M84 48 l6 6 M90 48 l-6 6" stroke="#4a3a24" stroke-width="2"/></g>
<path d="M72 60 q 8 4 16 0" stroke="#4a3a24" stroke-width="2" fill="none"/>
<path d="M56 36 C 64 22 96 22 104 36 Z" fill="#3a4a6a"/><path d="M60 32 h40" stroke="#d8b25c" stroke-width="2"/>`,
};

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function foeSvg(id, label = '') {
    return `<svg class="foe foe-${FOE_ART[id] ? id : 'scarecrow'}" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${attr(label)}">${FOE_ART[id] || FOE_ART.scarecrow}</svg>`;
}

// ------------------------------------------------------------------ sigils (viewBox 0 0 200 240)

export const SIGIL_FIELDS = ['#24496b', '#6b2430', '#2d5a3d', '#4b2d6b', '#1d1d24', '#7a5418', '#2b5f6b', '#8a3d1f'];
export const SIGIL_TINCTURES = ['#e8c565', '#e7e9ef', '#f2e6c8', '#ffb46b', '#9fd6c0'];
export const SIGIL_SHAPES = ['heater', 'round', 'kite', 'banner'];

const SHIELDS = {
    heater: 'M20 20 H180 V110 C180 170 140 205 100 225 C60 205 20 170 20 110 Z',
    round: 'M100 22 C150 22 182 60 182 118 C182 176 146 214 100 218 C54 214 18 176 18 118 C18 60 50 22 100 22 Z',
    kite: 'M100 14 C140 30 178 52 176 90 C172 140 140 190 100 230 C60 190 28 140 24 90 C22 52 60 30 100 14 Z',
    banner: 'M28 14 H172 V214 L100 182 L28 214 Z',
};

/** Charges, drawn in a 100×100 box centred on the shield. */
export const CHARGES = {
    quill: 'M70 8 C52 24 36 50 30 78 L26 92 L34 84 C48 70 62 50 72 28 C76 20 76 12 70 8 Z M30 78 L22 96',
    star: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 72 L22 92 L33 58 L5 38 L39 38 Z',
    moon: 'M62 8 C36 12 18 32 18 54 C18 78 38 96 62 94 C44 86 34 70 34 52 C34 34 46 16 62 8 Z',
    tree: 'M50 6 C70 10 84 26 82 44 C92 50 92 66 80 70 C76 80 62 82 56 76 L56 94 L44 94 L44 76 C38 82 24 80 20 70 C8 66 8 50 18 44 C16 26 30 10 50 6 Z',
    tower: 'M28 94 V30 H22 V10 H34 V18 H44 V10 H56 V18 H66 V10 H78 V30 H72 V94 Z M44 94 V74 C44 66 56 66 56 74 V94 Z',
    flame: 'M50 4 C60 22 78 34 78 60 C78 80 64 94 50 94 C36 94 22 80 22 62 C22 48 30 40 36 30 C38 42 42 48 48 50 C44 34 46 18 50 4 Z',
    key: 'M30 24 A18 18 0 1 1 30 60 A18 18 0 1 1 30 24 Z M46 38 H92 V48 H84 V60 H74 V48 H66 V58 H56 V48 H46 Z',
    eye: 'M4 50 C22 22 78 22 96 50 C78 78 22 78 4 50 Z M50 34 A16 16 0 1 0 50 66 A16 16 0 1 0 50 34 Z',
    crown: 'M10 80 L16 28 L34 50 L50 18 L66 50 L84 28 L90 80 Z M12 86 H88 V94 H12 Z',
    rose: 'M50 14 C64 14 74 24 74 36 C86 38 92 50 86 60 C92 72 82 86 68 84 C62 94 38 94 32 84 C18 86 8 72 14 60 C8 50 14 38 26 36 C26 24 36 14 50 14 Z',
    book: 'M8 22 C24 16 40 16 50 26 C60 16 76 16 92 22 V84 C76 78 60 78 50 88 C40 78 24 78 8 84 Z',
    wolf: 'M20 92 L24 54 L12 30 L30 40 L36 14 L48 34 H52 L64 14 L70 40 L88 30 L76 54 L80 92 L50 78 Z',
};
export const CHARGE_NAMES = { quill: 'Quill', star: 'Star', moon: 'Moon', tree: 'Tree', tower: 'Tower', flame: 'Flame', key: 'Key', eye: 'Eye', crown: 'Crown', rose: 'Rose', book: 'Book', wolf: 'Wolf' };

const hexOk = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback);

export function sigilSvg(sigil = {}, { label = 'Sigil', size = null } = {}) {
    const shape = SHIELDS[sigil.shape] ? sigil.shape : 'heater';
    const field = hexOk(sigil.field, SIGIL_FIELDS[0]);
    const tint = hexOk(sigil.tincture, SIGIL_TINCTURES[0]);
    const charge = CHARGES[sigil.charge] || CHARGES.quill;
    const stroke = sigil.charge === 'quill' ? ` stroke="${tint}" stroke-width="3"` : '';
    const sz = size ? ` width="${size}" height="${Math.round(size * 1.2)}"` : '';
    return `<svg class="sigil" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"${sz} role="img" aria-label="${attr(label)}"><path d="${SHIELDS[shape]}" fill="${field}" stroke="${tint}" stroke-width="7" stroke-linejoin="round"/><path d="${SHIELDS[shape]}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="2" transform="translate(100 120) scale(0.88) translate(-100 -120)"/><g transform="translate(55 72) scale(0.9)"><path d="${charge}" fill="${tint}" fill-rule="evenodd"${stroke}/></g></svg>`;
}

// ------------------------------------------------------------------ room emblems (viewBox 0 0 48 48)

const ICONS = {
    hall: '<path d="M24 6 L42 18 V42 H6 V18 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 40 C18 36 18 30 22 26 C22 30 24 31 25 31 C24 27 26 23 29 21 C29 26 32 29 31 34 C30 38 27 40 24 40 Z" fill="currentColor"/>',
    scriptorium: '<path d="M38 6 C28 12 20 22 16 34 L14 40 L19 35 C27 27 33 18 38 6 Z" fill="currentColor"/><path d="M14 40 L10 44" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 42 C10 38 14 38 18 42 V44 H6 Z" fill="currentColor" opacity="0.7"/>',
    board: '<rect x="8" y="8" width="32" height="34" rx="2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14 18 H34 M14 25 H30 M14 32 H26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="8" r="3" fill="currentColor"/>',
    faces: '<path d="M8 10 C16 6 24 8 26 10 V26 C26 34 20 38 16 38 C12 38 8 34 8 26 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 18 h4 M20 18 h2 M12 28 C15 31 19 31 22 28" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M28 16 C32 14 38 14 42 16 V30 C42 38 37 42 34 42 C31 42 26 38 26 30" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M30 24 h3 M36 24 h3 M30 34 C33 31 36 31 39 34" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    grounds: '<path d="M10 38 L34 8 L38 12 L14 40 Z M38 38 L14 8 L10 12 L34 40 Z" fill="currentColor"/><path d="M8 34 L14 40 M40 34 L34 40" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
    loom: '<path d="M8 8 V40 M40 8 V40" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M8 14 H40 M8 22 H40 M8 30 H40" stroke="currentColor" stroke-width="1.6" opacity="0.6"/><path d="M14 8 C14 18 20 18 20 26 C20 34 14 34 14 40 M24 8 C24 18 30 18 30 26 C30 34 24 34 24 40 M34 8 C34 18 28 22 34 30 C38 34 34 38 34 40" stroke="currentColor" stroke-width="2.4" fill="none"/>',
    loft: '<circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M24 9 L28 24 L24 39 L20 24 Z" fill="currentColor"/><path d="M9 24 L24 21 L39 24 L24 27 Z" fill="currentColor" opacity="0.55"/>',
    well: '<path d="M10 22 H38 V40 H10 Z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M10 30 H38" stroke="currentColor" stroke-width="1.6" opacity="0.6"/><path d="M8 22 L24 8 L40 22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 8 V16" stroke="currentColor" stroke-width="2"/><path d="M20 16 H28 L27 21 H21 Z" fill="currentColor"/><path d="M36 6 l1.4 3 l3 1.4 l-3 1.4 l-1.4 3 l-1.4 -3 l-3 -1.4 l3 -1.4 Z" fill="currentColor"/>',
    library: '<path d="M8 40 H40" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="10" y="12" width="6" height="28" fill="currentColor"/><rect x="18" y="8" width="6" height="32" fill="currentColor" opacity="0.7"/><rect x="26" y="14" width="5" height="26" fill="currentColor"/><path d="M33 16 L38 15 L42 39 L37 40 Z" fill="currentColor" opacity="0.7"/>',
    bindery: '<path d="M10 8 H34 C37 8 38 10 38 12 V40 H14 C11 40 10 38 10 36 Z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14 36 H38" stroke="currentColor" stroke-width="2"/><path d="M18 16 H30 M18 22 H28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M38 22 H42 V30 H38" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    sheet: '<circle cx="24" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M8 42 C10 30 18 26 24 26 C30 26 38 30 40 42" fill="none" stroke="currentColor" stroke-width="2.6"/>',
    lock: '<rect x="12" y="22" width="24" height="18" rx="3" fill="currentColor"/><path d="M17 22 V16 C17 8 31 8 31 16 V22" fill="none" stroke="currentColor" stroke-width="3"/>',
};

export function icon(id, cls = 'ic') {
    return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[id] || ICONS.hall}</svg>`;
}
