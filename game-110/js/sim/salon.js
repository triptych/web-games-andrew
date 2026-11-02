// Curl Up & Dye: the cemetery's beauty salon. Pure, like the rest of js/sim: this file says who sits in the chair, what
// they ask for, and how a finished look is judged. The salon screen (salonview.js) does the washing, cutting, dyeing,
// styling and make-up, and hands back a plain "look" record; score(wish, look) reads it.
//
// A look: { strands: [{ c, len, tex }], cap, vol, bangs, clean, lips, shadow, blush, lashes, glitter, stickers, top, clip }
//   c / cap / lips / shadow: a colour family (COLOURS); len 0..1 of full length; tex: TEXTURES; vol 0..1 hairspray;
//   bangs: BANGS; clean 0..1; blush, lashes, glitter: booleans; stickers: a count; top: TOPS id or null; clip: CLIPS id or null.

/** Colour families, with the shade the salon paints them in. */
export const COLOURS = {
    black: '#2c2438', white: '#efeaf6', brown: '#8a5634', blonde: '#f2cc58', red: '#d8304a',
    orange: '#ff8a2a', pink: '#ff7ab8', purple: '#9a5ad8', blue: '#4a86e8', green: '#4cc06a',
};
export const COLOUR_IDS = Object.keys(COLOURS);
export const COLOUR_NAME = { black: 'black', white: 'white', brown: 'brown', blonde: 'blonde', red: 'red', orange: 'orange', pink: 'pink', purple: 'purple', blue: 'blue', green: 'green' };
export const TEXTURES = ['straight', 'wavy', 'curly', 'crimp'];
export const BANGS = ['none', 'blunt', 'side', 'curtain', 'wisp'];
export const TOPS = ['tiara', 'witch', 'flowers', 'ears', 'veil'];
export const CLIPS = ['bow', 'bat', 'spider', 'skull', 'rose'];
export const TOP_NAME = { tiara: 'a tiara', witch: 'a witch’s hat', flowers: 'a crown of roses', ears: 'cat ears', veil: 'a bridal veil' };
export const CLIP_NAME = { bow: 'a bow', bat: 'a bat clip', spider: 'a spider clip', skull: 'a skull barrette', rose: 'a black rose' };
export const STRANDS = 16;

/** Everyone who can sit in the chair: the Overlord herself, all twelve minions, the four visitors and a henchman. */
export const CLIENTS = [
    { id: 'noxia', name: 'Lady Noxia', start: ['black', 0.7, 'straight'], fav: ['black', 'purple', 'pink', 'red'], line: 'Make me look terrifying. But, you know. Cute.' },
    { id: 'imp', name: 'Imp Sous-Chef', start: ['red', 0.25, 'wavy'], fav: ['red', 'orange', 'blonde'], line: 'Something that won’t catch fire near the oven, please.' },
    { id: 'cauldron', name: 'Bubbling Cauldron', start: ['green', 0.4, 'curly'], fav: ['green', 'purple', 'pink'], line: '*blub* *blub* (It would like a new look.)' },
    { id: 'golem', name: 'Gingerbread Golem', start: ['brown', 0.3, 'straight'], fav: ['white', 'pink', 'brown'], line: 'Make me look… less edible.' },
    { id: 'spider', name: 'Spider Seamstress', start: ['purple', 0.8, 'straight'], fav: ['purple', 'black', 'pink'], line: 'Eight eyes, darling. I will notice every stray hair.' },
    { id: 'loom', name: 'Haunted Loom', start: ['white', 0.6, 'wavy'], fav: ['white', 'blue', 'purple'], line: 'Oooooo… a trim? Oooooo.' },
    { id: 'bat', name: 'Bat-Wing Atelier', start: ['black', 0.35, 'straight'], fav: ['black', 'red', 'purple'], line: 'I hang upside down. It has to look good both ways.' },
    { id: 'gargoyle', name: 'Gargoyle Florist', start: ['brown', 0.2, 'crimp'], fav: ['green', 'black', 'white'], line: 'Do something. I am tired of looking stony.' },
    { id: 'wraith', name: 'Candle Wraith', start: ['white', 0.75, 'straight'], fav: ['blonde', 'orange', 'white'], line: 'Mind the candle. Last stylist went up in smoke.' },
    { id: 'portrait', name: 'Living Portrait', start: ['brown', 0.5, 'wavy'], fav: ['brown', 'blonde', 'red'], line: 'Three hundred years in the same hairdo. Surprise me.' },
    { id: 'skeleton', name: 'Skeleton Quartet', start: ['blonde', 0.15, 'straight'], fav: ['blonde', 'white', 'black'], line: 'I’ve no hair at all, technically. Do your best.' },
    { id: 'mimic', name: 'Mimic Buffet', start: ['orange', 0.45, 'curly'], fav: ['orange', 'pink', 'blonde'], line: 'Lovely to meet you. Please keep your fingers away from my mouth.' },
    { id: 'lich', name: 'Lich Party Planner', start: ['white', 0.9, 'straight'], fav: ['purple', 'green', 'white'], line: 'Nine hundred years and nobody ever invited me to a makeover party.' },
    { id: 'kitten', name: 'Midnight Kitten', start: ['black', 0.3, 'curly'], fav: ['pink', 'black', 'white'], line: 'Mrrp. (She wants to look fabulous.)' },
    { id: 'critic', name: 'The Critic', start: ['white', 0.3, 'straight'], fav: ['white', 'purple', 'black'], line: 'I shall be reviewing this salon. Impress me.' },
    { id: 'bard', name: 'The Bard', start: ['blonde', 0.55, 'wavy'], fav: ['blonde', 'blue', 'green'], line: 'Make me look like a ballad. A long one.' },
    { id: 'hero', name: 'A Hero', start: ['blonde', 0.4, 'straight'], fav: ['blonde', 'blue', 'red'], line: 'I was only coming to slay you, but this place has great reviews.' },
    { id: 'henchman', name: 'Goblin Henchman', start: ['green', 0.2, 'crimp'], fav: ['green', 'black', 'orange'], line: 'Boss says I need to look presentable for the schemes.' },
];
export const CLIENT = Object.fromEntries(CLIENTS.map((c, i) => [c.id, { ...c, index: i }]));

/** What the salon pays, like Skull Swap: seconds of charm per second by stars, and gold scaled like tribute. */
export const SALON_REWARD = { charmSec: [0, 40, 75, 120], gold: 4, wait: 90 };

// ---------------------------------------------------------------------------------------------------- reading a look
const MAKEUP = (L) => (L.lips ? 1 : 0) + (L.shadow ? 1 : 0) + (L.blush ? 1 : 0) + (L.lashes ? 1 : 0) + (L.glitter ? 1 : 0);
/** Share of the hair in a colour: every strand counts once and the top of the head counts as four. */
export function colourShare(L, c) {
    const n = L.strands.length + 4;
    return (L.strands.filter((s) => s.c === c).length + (L.cap === c ? 4 : 0)) / n;
}
export const meanLen = (L) => (L.strands.length ? L.strands.reduce((a, s) => a + s.len, 0) / L.strands.length : 0);
export const texShare = (L, t) => (L.strands.length ? L.strands.filter((s) => s.tex === t).length / L.strands.length : 0);
export const families = (L) => new Set([...L.strands.map((s) => s.c), L.cap]).size;

// Each ask: a category (a wish has three different ones), whether it fits a client's starting hair, a test and a phrase.
const ASKS = {
    colour: { cat: 'colour', test: (L, a) => colourShare(L, a.v) >= 0.6, text: (a) => `${COLOUR_NAME[a.v]} hair`, icon: '🎨' },
    streaks: { cat: 'colour', test: (L, a) => L.strands.filter((s) => s.c === a.v).length >= 3 && colourShare(L, a.v) < 0.6, text: (a) => `${COLOUR_NAME[a.v]} streaks`, icon: '🎨' },
    rainbow: { cat: 'colour', test: (L) => families(L) >= 5, text: () => 'every colour of the rainbow', icon: '🌈' },
    short: { cat: 'length', test: (L) => meanLen(L) <= 0.3, text: () => 'short hair', icon: '✂️' },
    long: { cat: 'length', test: (L) => meanLen(L) >= 0.75, text: () => 'long hair', icon: '✂️' },
    tex: { cat: 'style', test: (L, a) => texShare(L, a.v) >= 0.6, text: (a) => ({ straight: 'sleek straight hair', wavy: 'soft waves', curly: 'curls', crimp: 'crimped hair' })[a.v], icon: '💫' },
    big: { cat: 'style', test: (L) => L.vol >= 0.6, text: () => 'BIG hair', icon: '💨' },
    bangs: { cat: 'style', test: (L) => L.bangs !== 'none', text: () => 'a fringe', icon: '💇' },
    lips: { cat: 'face', test: (L, a) => L.lips === a.v, text: (a) => `${COLOUR_NAME[a.v]} lipstick`, icon: '💋' },
    shadow: { cat: 'face', test: (L) => !!L.shadow, text: () => 'eyeshadow', icon: '👁️' },
    blush: { cat: 'face', test: (L) => !!L.blush, text: () => 'rosy cheeks', icon: '🌸' },
    lashes: { cat: 'face', test: (L) => !!L.lashes, text: () => 'long lashes', icon: '👁️' },
    glam: { cat: 'face', test: (L) => MAKEUP(L) >= 4, text: () => 'full glam make-up', icon: '💄' },
    bare: { cat: 'face', test: (L) => MAKEUP(L) === 0 && !L.stickers, text: () => 'no make-up at all', icon: '🫧' },
    sticker: { cat: 'face', test: (L) => L.stickers >= 1, text: () => 'a cute face sticker', icon: '⭐' },
    top: { cat: 'extra', test: (L, a) => L.top === a.v, text: (a) => TOP_NAME[a.v], icon: '👑' },
    clip: { cat: 'extra', test: (L, a) => L.clip === a.v, text: (a) => CLIP_NAME[a.v], icon: '🎀' },
};

export const askText = (a) => ASKS[a.k].text(a);
export const askIcon = (a) => ASKS[a.k].icon;
export const askMet = (a, L) => !!ASKS[a.k].test(L, a);

/** The look a client walks in with: their own hair, a little grubby, and no make-up. */
export function startLook(appt) {
    const [c, len, tex] = [appt.hair.c, appt.hair.len, appt.hair.tex];
    return {
        strands: Array.from({ length: STRANDS }, () => ({ c, len, tex })), cap: c, vol: 0, bangs: appt.hair.bangs, clean: 0,
        lips: null, shadow: null, blush: false, lashes: false, glitter: false, stickers: 0, top: null, clip: null,
    };
}

/** A client's wish: three asks from three different categories, none of which their hair already meets. */
export function makeWish(client, rng) {
    const C = CLIENT[client];
    const hair = { c: C.start[0], len: C.start[1], tex: C.start[2], bangs: rng() < 0.3 ? 'blunt' : 'none' };
    const fav = () => { const f = C.fav.filter((x) => x !== hair.c); return rng() < 0.75 && f.length ? rng.pick(f) : rng.pick(COLOUR_IDS.filter((x) => x !== hair.c)); };
    const by = {
        colour: () => { const r = rng(); return r < 0.6 ? { k: 'colour', v: fav() } : r < 0.88 ? { k: 'streaks', v: fav() } : { k: 'rainbow' }; },
        length: () => (hair.len > 0.5 ? { k: 'short' } : { k: 'long' }),
        style: () => {
            const r = rng();
            if (r < 0.5) return { k: 'tex', v: rng.pick(TEXTURES.filter((t) => t !== hair.tex)) };
            if (r < 0.8 || hair.bangs !== 'none') return { k: 'big' };
            return { k: 'bangs' };
        },
        face: () => {
            const r = rng();
            if (r < 0.3) return { k: 'lips', v: rng.pick(['red', 'pink', 'black', 'purple', 'orange']) };
            if (r < 0.45) return { k: 'shadow' };
            if (r < 0.58) return { k: 'blush' };
            if (r < 0.7) return { k: 'lashes' };
            if (r < 0.82) return { k: 'glam' };
            if (r < 0.9) return { k: 'sticker' };
            return { k: 'bare' };
        },
        extra: () => (rng() < 0.5 ? { k: 'top', v: rng.pick(TOPS) } : { k: 'clip', v: rng.pick(CLIPS) }),
    };
    const cats = ['colour', 'length', 'style', 'face', 'extra'];
    // colour and a face are asked for most often; shuffle by weight and keep the first three
    const w = { colour: 3, length: 1.6, style: 2, face: 2.4, extra: 2 };
    const order = cats.map((c) => [c, rng() * w[c]]).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 3);
    const start = startLook({ hair });
    const wish = [];
    for (const cat of order) {
        let a = by[cat]();
        for (let i = 0; i < 6 && askMet(a, start); i++) a = by[cat]();
        if (askMet(a, start)) continue;
        wish.push(a);
    }
    // a wish of fewer than three (it can happen when every roll fitted already) is filled with a make-up ask
    while (wish.length < 3) wish.push(wish.some((a) => a.k === 'blush') ? { k: 'lashes' } : { k: 'blush' });
    // "no make-up" can't sit beside a make-up ask
    if (wish.some((a) => a.k === 'bare') && wish.filter((a) => ASKS[a.k].cat === 'face').length > 1) wish.splice(wish.findIndex((a) => a.k === 'bare'), 1, { k: 'big' });
    return { hair, wish };
}

/** Clean a look up from whatever the screen sent: unknown values become harmless defaults. */
export function sanitize(L) {
    const col = (c) => (COLOUR_IDS.includes(c) ? c : null);
    const strands = (Array.isArray(L?.strands) ? L.strands : []).slice(0, STRANDS).map((s) => ({
        c: col(s?.c) || 'brown', len: Math.max(0, Math.min(1, +s?.len || 0)), tex: TEXTURES.includes(s?.tex) ? s.tex : 'straight',
    }));
    return {
        strands, cap: col(L?.cap) || 'brown', vol: Math.max(0, Math.min(1, +L?.vol || 0)), bangs: BANGS.includes(L?.bangs) ? L.bangs : 'none',
        clean: Math.max(0, Math.min(1, +L?.clean || 0)), lips: col(L?.lips), shadow: col(L?.shadow), blush: !!L?.blush, lashes: !!L?.lashes,
        glitter: !!L?.glitter, stickers: Math.max(0, Math.min(20, L?.stickers | 0)), top: TOPS.includes(L?.top) ? L.top : null, clip: CLIPS.includes(L?.clip) ? L.clip : null,
    };
}

/** Stars for a look: one for every wish granted, but the third only for clean hair. */
export function score(wish, look) {
    const L = sanitize(look);
    const met = wish.map((a) => askMet(a, L));
    const n = met.filter(Boolean).length;
    const clean = L.clean >= 1;
    return { met, clean, stars: clean ? n : Math.min(2, n) };
}
