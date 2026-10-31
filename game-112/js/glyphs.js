// Hand-drawn glyphs as inline SVG: map nodes, card art for orders and spells, relics and intents.
// Drawn on a 48×48 grid in ink with a spot colour, then roughened by the page's #wobble filter.

const INK = '#231b14';
const C = { rust: '#b5532d', gold: '#d8a530', teal: '#3f7f96', olive: '#6b8a4a', purple: '#6a4a8a', paper: '#f0e4c4', fire: '#e2702c', grey: '#9a958a', ice: '#9fd0e0', red: '#a83a2a', cream: '#eadbb0' };
const s = (d, fill = 'none', w = 2.6) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circ = (x, y, r, fill = 'none', w = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`;

const G = {
    swords: s('M10 38 L34 10 L38 10 L38 14 L14 40 Z', C.cream) + s('M38 38 L14 10 L10 10 L10 14 L34 40 Z', C.cream) + s('M8 34 L16 42 M40 34 L32 42'),
    sword: s('M24 4 L28 10 L28 32 L20 32 L20 10 Z', C.cream) + s('M14 32 L34 32', 'none', 3.2) + s('M24 33 L24 42') + circ(24, 44, 2.5, C.gold),
    skull: s('M12 22 C12 10 36 10 36 22 C36 28 33 30 32 33 L32 38 L16 38 L16 33 C15 30 12 28 12 22 Z', C.cream) + circ(19, 24, 3.5, INK, 1) + circ(29, 24, 3.5, INK, 1) + s('M22 31 L24 28 L26 31 M20 38 L20 34 M24 38 L24 34 M28 38 L28 34'),
    tower: s('M14 42 L14 16 L34 16 L34 42 Z', C.cream) + s('M12 16 L12 10 L17 10 L17 13 L21 13 L21 10 L27 10 L27 13 L31 13 L31 10 L36 10 L36 16 Z', C.cream) + s('M21 42 L21 33 C21 29 27 29 27 33 L27 42', C.rust) + s('M23 22 L25 22 L25 26 L23 26 Z', INK, 1.5) + s('M24 10 L24 2 L32 5 L24 7', C.rust, 2),
    quill: s('M38 6 C26 10 16 22 12 38 C20 28 30 20 38 6 Z', C.cream) + s('M38 6 C34 14 26 22 18 30') + s('M12 38 L8 44') + s('M6 44 L22 44', 'none', 2),
    fire: s('M24 4 C30 14 38 20 36 32 C35 40 29 44 24 44 C17 44 12 39 12 32 C12 24 18 22 18 14 C22 18 22 22 24 24 C26 18 26 10 24 4 Z', C.fire) + s('M24 44 C20 44 18 40 19 36 C20 33 23 32 24 28 C27 33 30 35 29 39 C28 42 26 44 24 44 Z', C.gold, 2),
    query: s('M16 16 C16 8 32 8 32 16 C32 22 24 23 24 30 L24 32', 'none', 3.4) + circ(24, 39, 2.8, INK, 1),
    chest: s('M8 22 L40 22 L40 40 L8 40 Z', C.rust) + s('M8 22 C8 12 40 12 40 22', C.gold) + s('M8 26 L40 26') + s('M21 25 L27 25 L27 33 L21 33 Z', C.gold, 2),
    crown: s('M8 36 L6 14 L16 24 L24 10 L32 24 L42 14 L40 36 Z', C.gold) + s('M8 40 L40 40', 'none', 3) + circ(24, 30, 2.5, C.rust, 1.6),
    shield: s('M24 4 L40 10 C40 28 34 38 24 44 C14 38 8 28 8 10 Z', C.teal) + s('M24 4 L24 44 M8 18 L40 18', 'none', 1.8),
    boot: s('M14 6 L28 6 L28 28 L42 34 L42 42 L10 42 L12 28 Z', C.rust) + s('M10 36 L42 36', 'none', 1.8) + s('M14 12 L28 12', 'none', 1.6),
    scroll: s('M12 10 L36 10 L36 38 L12 38 Z', C.cream) + s('M10 8 C6 8 6 14 10 14 L14 14 M38 34 C42 34 42 40 38 40 L12 40') + s('M17 18 L31 18 M17 23 L31 23 M17 28 L27 28', 'none', 1.8),
    star: s('M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z', C.gold),
    eye: s('M4 24 C14 10 34 10 44 24 C34 38 14 38 4 24 Z', C.cream) + circ(24, 24, 7, C.purple) + circ(24, 24, 2.5, INK, 1),
    bolt: s('M28 4 L12 26 L22 26 L18 44 L36 20 L26 20 Z', C.gold),
    flake: s('M24 4 L24 44 M7 14 L41 34 M7 34 L41 14', 'none', 3) + s('M19 8 L24 12 L29 8 M19 40 L24 36 L29 40', 'none', 2) + circ(24, 24, 5, C.ice),
    rock: s('M8 38 L12 20 L22 10 L34 14 L42 30 L36 40 Z', C.grey) + s('M22 10 L24 24 L12 20 M24 24 L36 40 M24 24 L42 30', 'none', 1.8),
    moon: s('M30 6 C16 8 10 22 14 32 C18 42 32 44 40 36 C28 38 20 28 22 18 C23 12 26 8 30 6 Z', C.cream) + s('M34 14 L36 18 L40 18 L37 21 L38 25 L34 23 L30 25 L31 21 L28 18 L32 18 Z', C.gold, 1.6),
    sun: circ(24, 24, 9, C.gold) + s('M24 3 L24 10 M24 38 L24 45 M3 24 L10 24 M38 24 L45 24 M9 9 L14 14 M34 34 L39 39 M39 9 L34 14 M14 34 L9 39', 'none', 2.6),
    banner: s('M12 4 L12 44', 'none', 3) + s('M12 6 L38 6 L32 16 L38 26 L12 26 Z', C.rust) + circ(22, 16, 3.5, C.gold, 1.6),
    horn: s('M6 14 C10 24 22 34 40 36 L42 28 C30 26 18 22 10 10 Z', C.cream) + s('M40 36 C44 34 44 30 42 28', C.gold) + s('M14 20 L18 17 M20 26 L23 22', 'none', 1.8),
    cross: s('M19 6 L29 6 L29 19 L42 19 L42 29 L29 29 L29 42 L19 42 L19 29 L6 29 L6 19 L19 19 Z', C.olive),
    ankh: s('M24 6 C16 6 16 22 24 22 C32 22 32 6 24 6 Z', 'none', 3) + s('M24 22 L24 44 M12 28 L36 28', 'none', 3.4),
    hand: s('M14 44 L12 26 L12 16 C12 13 16 13 16 16 L16 24 L17 10 C17 7 21 7 21 10 L21 22 L22 8 C22 5 26 5 26 8 L26 22 L27 11 C27 8 31 8 31 11 L31 26 L34 21 C36 18 40 20 38 23 L32 36 L30 44 Z', C.cream, 2.2),
    swirl: s('M24 24 C24 20 30 20 30 25 C30 31 20 32 18 25 C16 16 30 12 35 20 C41 30 30 42 20 38 C10 34 8 20 14 13', 'none', 3) + s('M24 24 C24 20 30 20 30 25', C.purple),
    bow: s('M14 4 C34 12 34 36 14 44', 'none', 3.2) + s('M14 4 L14 44', 'none', 1.5) + s('M8 24 L40 24', 'none', 2.4) + s('M40 24 L34 20 L34 28 Z', INK, 1.5),
    plus: s('M24 8 L24 40 M8 24 L40 24', 'none', 4),
    zz: `<text x="8" y="34" font-family="Georgia,serif" font-weight="700" font-size="26" fill="${C.purple}" stroke="${INK}" stroke-width="1">Zz</text>`,
    coin: circ(24, 24, 16, C.gold) + circ(24, 24, 11, 'none', 1.6) + s('M24 16 L24 32', 'none', 2.4),
    book: s('M8 10 C14 8 20 8 24 12 C28 8 34 8 40 10 L40 40 C34 38 28 38 24 42 C20 38 14 38 8 40 Z', C.rust) + s('M24 12 L24 42'),
    ink: s('M14 18 L34 18 L36 42 L12 42 Z', '#2a1e34') + s('M16 12 L32 12 L34 18 L14 18 Z', C.cream) + s('M30 4 C26 14 22 22 18 30', 'none', 2),
    kit: s('M8 16 L40 16 L40 40 L8 40 Z', C.cream) + s('M18 16 L18 10 L30 10 L30 16') + s('M21 23 L27 23 L27 26 L30 26 L30 32 L27 32 L27 35 L21 35 L21 32 L18 32 L18 26 L21 26 Z', C.red, 1.6),
    stone: s('M6 30 L30 10 L42 18 L18 40 Z', C.grey) + s('M14 33 L32 16 M20 36 L36 21', 'none', 1.4),
    lamp: s('M16 16 L32 16 L34 38 L14 38 Z', C.gold) + s('M18 10 L30 10 L32 16 L16 16 Z', C.cream) + s('M24 4 L24 10 M14 42 L34 42') + circ(24, 27, 4, C.fire, 1.6),
    purse: s('M12 20 C6 30 10 42 24 42 C38 42 42 30 36 20 Z', C.rust) + s('M14 20 C18 16 30 16 34 20 M18 12 L24 18 L30 12', 'none', 2.2) + s('M22 30 L26 30 M24 26 L24 34', 'none', 2),
    candle: s('M18 20 L30 20 L30 42 L18 42 Z', C.cream) + s('M24 6 C28 12 28 16 24 18 C20 16 20 12 24 6 Z', C.fire, 2) + s('M14 42 L34 42', 'none', 3),
    rune: s('M24 4 L42 24 L24 44 L6 24 Z', C.teal) + s('M24 12 L24 36 M17 18 L24 24 L31 18', 'none', 2.4),
    drum: s('M8 16 L8 34 C8 42 40 42 40 34 L40 16', C.rust) + `<ellipse cx="24" cy="16" rx="16" ry="6" fill="${C.cream}" stroke="${INK}" stroke-width="2.6"/>` + s('M8 20 L16 36 L24 22 L32 36 L40 20', 'none', 1.6) + s('M30 4 L22 14', 'none', 2.4),
    die: s('M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z', C.cream) + s('M6 14 L24 24 L42 14 M24 24 L24 44', 'none', 1.8) + `<text x="18" y="21" font-family="Georgia,serif" font-weight="700" font-size="10" fill="${INK}">20</text>`,
    bag: s('M10 18 C4 32 10 44 24 44 C38 44 44 32 38 18 Z', C.olive) + s('M16 18 L20 8 L28 8 L32 18', C.olive) + s('M14 18 L34 18', 'none', 3),
    sigil: circ(24, 24, 18, C.cream) + s('M24 8 L24 40 M10 32 L38 16 M10 16 L38 32', 'none', 2) + circ(24, 24, 7, C.purple, 2),
    map: s('M6 10 L18 6 L30 10 L42 6 L42 38 L30 42 L18 38 L6 42 Z', C.cream) + s('M18 6 L18 38 M30 10 L30 42', 'none', 1.6) + s('M10 30 C16 22 22 30 28 20 L34 16', 'none', 1.8) + s('M32 14 L36 18 M36 14 L32 18', 'none', 2),
    grail: s('M12 6 L36 6 C36 20 30 26 24 26 C18 26 12 20 12 6 Z', C.gold) + s('M24 26 L24 38 M14 42 L34 42 L30 38 L18 38 Z', C.gold) + circ(24, 14, 3, C.red, 1.4),
    astro: circ(24, 24, 17, 'none', 2.6) + `<ellipse cx="24" cy="24" rx="17" ry="7" fill="none" stroke="${INK}" stroke-width="2"/>` + `<ellipse cx="24" cy="24" rx="7" ry="17" fill="none" stroke="${INK}" stroke-width="2"/>` + circ(24, 24, 4, C.gold, 1.6),
    sweep: s('M6 30 C10 14 34 8 42 22', 'none', 3) + s('M10 36 C16 24 32 20 40 30', 'none', 2.4) + s('M42 22 L36 20 L40 16 Z', INK, 1.5),
    breath: s('M4 24 C12 18 20 30 28 22 C32 18 38 18 44 22 C38 26 36 32 28 30 C20 28 14 34 4 24 Z', C.fire) + s('M14 24 C20 22 24 27 30 24', 'none', 1.6),
    heart: s('M24 42 C10 32 4 24 6 16 C8 8 18 8 24 16 C30 8 40 8 42 16 C44 24 38 32 24 42 Z', C.red),
    wall: s('M6 40 L6 22 L42 22 L42 40 Z', C.grey) + s('M6 31 L42 31 M18 22 L18 31 M30 22 L30 31 M12 31 L12 40 M24 31 L24 40 M36 31 L36 40', 'none', 1.8) + s('M6 22 L6 14 L14 14 L14 22 M20 22 L20 14 L28 14 L28 22 M34 22 L34 14 L42 14 L42 22', C.grey, 2),
    ward: s('M24 4 L40 10 C40 28 34 38 24 44 C14 38 8 28 8 10 Z', C.teal) + s('M24 14 L24 34 M16 22 L32 22', 'none', 3),
    feet: s('M14 30 C10 30 10 22 14 22 C18 22 18 30 14 30 Z M30 18 C26 18 26 10 30 10 C34 10 34 18 30 18 Z', C.cream) + s('M14 40 L14 34 M30 28 L30 22', 'none', 2) + s('M8 44 L20 44 M24 32 L36 32', 'none', 2),
    dagger: s('M24 4 L27 8 L27 28 L21 28 L21 8 Z', C.cream) + s('M16 28 L32 28', 'none', 3) + s('M24 29 L24 40') + circ(24, 42, 2.2, C.rust),
};

/** An inline SVG glyph, wobbled. */
export function glyph(name, cls = 'glyph') {
    const body = G[name] || G.star;
    return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><g filter="url(#wobble)">${body}</g></svg>`;
}

/** A glyph as a data URL (for CSS backgrounds), without the page filter. */
export function glyphURL(name) {
    const body = G[name] || G.star;
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`)}")`;
}

/** Card art for orders and spells that have no creature to show. */
export const CARD_GLYPH = {
    strike: 'sword', onslaught: 'swords', holdfast: 'shield', firebolt: 'fire', march: 'boot',
    volley: 'bow', shieldbash: 'shield', rallycry: 'horn', scout: 'scroll', quickstep: 'feet',
    frostbind: 'flake', frailty: 'eye', enfeeble: 'eye', feint: 'dagger', guidingbolt: 'sun', sparks: 'star',
    earthwork: 'rock', entrench: 'wall', taunt: 'banner', flankblow: 'swords', cleave: 'sweep', chain: 'bolt',
    haste: 'feet', bless: 'hand', teleport: 'swirl', laststand: 'ward', study: 'book', inkreserve: 'ink',
    secondwind: 'heart', fielddress: 'cross', meteor: 'rock', resurrect: 'ankh', fury: 'swords', prayer: 'hand',
    sleep: 'moon', warhost: 'banner', mire: 'swirl', doubt: 'eye', wound: 'skull', guilt: 'skull',
};

export const NODE_GLYPH = { battle: 'swords', elite: 'skull', dwelling: 'tower', shop: 'quill', camp: 'fire', event: 'query', treasure: 'chest', boss: 'crown' };
export const INTENT_GLYPH = { attack: 'sword', shoot: 'bow', ward: 'shield', cry: 'horn', hex: 'eye', curse: 'skull', summon: 'plus', breath: 'breath', sweep: 'sweep', roar: 'star', stunned: 'zz' };
export const BOON_GLYPH = { atk: 'sword', def: 'shield', lore: 'book', gold: 'coin', levy: 'banner', draw: 'scroll', ink: 'ink' };
