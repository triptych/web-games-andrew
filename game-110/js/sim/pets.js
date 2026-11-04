// Rest in Paws: the cemetery's pet shelter. Pure, like the rest of js/sim: this file says who lives in the shelter,
// what each one likes, how their needs fade and their bond grows, and what an adopted pet does for the castle.
// The care screen (petview.js) does the feeding, brushing, bathing and playing, and reports each bit of care as a
// command; game.js applies it through care() below.
//
// One pet lives with the Overlord at a time and follows her from room to room. The others wait in the shelter and
// keep the bond you've built with them, so you can swap whenever you like.

/** Six spooky-cute pets. fav: the food they love; fx: what they do for the castle, per level of bond. */
export const PETS = [
    { id: 'cat', name: 'Pudding', kind: 'Moon Cat', icon: '🐈‍⬛', fav: 'fish', line: 'Sits on every doily. Knocks the cursed ones off the table.',
        fx: { k: 'vFreq', per: 0.06 }, perk: (p) => `Visitors call ${p}% more often — the kittens come to see her.` },
    { id: 'dog', name: 'Biscuit', kind: 'Hellhound Pup', icon: '🐕', fav: 'bone', line: 'Three feet tall at the shoulder. Will be. One day.',
        fx: { k: 'cackle', per: 0.1 }, perk: (p) => `Cackles ${p}% stronger — he howls along.` },
    { id: 'bat', name: 'Nibbles', kind: 'Fruit Bat', icon: '🦇', fav: 'fig', line: 'Hangs from the chandelier. Steals shiny coins for you.',
        fx: { k: 'tribute', per: 0.1 }, perk: (p) => `Tribute +${p}% — he brings back every shiny coin.` },
    { id: 'bunny', name: 'Stitches', kind: 'Patchwork Bunny', icon: '🐇', fav: 'carrot', line: 'Sewn together from three old plushies. Loves you with all of them.',
        fx: { k: 'click', per: 0.15 }, perk: (p) => `Crafting by hand +${p}% — she hops beside you while you work.` },
    { id: 'toad', name: 'Sir Croaksworth', kind: 'Royal Toad', icon: '🐸', fav: 'beetle', line: 'Was a prince once, he says. Prefers this.',
        fx: { k: 'decay', per: -0.05 }, perk: (p) => `Reputation fades ${p}% slower — nobody trusts a lady with a toad.` },
    { id: 'owl', name: 'Professor Hoot', kind: 'Barn Owl', icon: '🦉', fav: 'cookie', line: 'Keeps the minions’ accounts. Asks “who?” about every expense.',
        fx: { k: 'all', per: 0.03 }, perk: (p) => `All charm +${p}% — he keeps the books.` },
];
export const PET = Object.fromEntries(PETS.map((p, i) => [p.id, { ...p, index: i }]));
export const PET_IDS = PETS.map((p) => p.id);

/** What there is to eat in the shelter's pantry. Everyone eats anything; each pet has a favourite. */
export const FOODS = [
    { id: 'fish', icon: '🐟', name: 'Fish', short: 'Fish' }, { id: 'bone', icon: '🦴', name: 'Biscuit bone', short: 'Bone' }, { id: 'fig', icon: '🍑', name: 'Figs', short: 'Figs' },
    { id: 'carrot', icon: '🥕', name: 'Carrot', short: 'Carrot' }, { id: 'beetle', icon: '🪲', name: 'Crunchy beetle', short: 'Beetle' }, { id: 'cookie', icon: '🍪', name: 'Mouse cookie', short: 'Cookie' },
];
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]));
/** Little things to wear. Purely for looks: they show in the castle too. */
export const ACCS = [
    { id: 'bow', icon: '🎀', name: 'Bow' }, { id: 'bell', icon: '🔔', name: 'Bell collar' }, { id: 'hat', icon: '🧙', name: 'Witch hat' },
    { id: 'scarf', icon: '🧣', name: 'Scarf' }, { id: 'crown', icon: '👑', name: 'Crown' },
];
export const ACC_IDS = ACCS.map((a) => a.id);
export const NEEDS = ['food', 'clean', 'fun'];
export const NEED_NAME = { food: 'Fed', clean: 'Clean', fun: 'Happy' };

export const PET_TUNE = {
    // seconds for a need to fall from full to empty
    fade: { food: 7200, clean: 14400, fun: 5400 },
    // a pet whose needs average this or more is content and gives its whole bonus; below it, half
    content: 0.35,
    // bond xp for each level after the first: level = 1 + thresholds passed
    levels: [20, 60, 120, 200],
    feed: 0.3, favFeed: 0.45, play: 0.12, pat: 0.04,
    playCd: 0.8, patCd: 15,
    // a pet fresh from the shelter is a bit grubby and a bit peckish
    start: { food: 0.5, clean: 0.3, fun: 0.5 },
};
export const MAX_LEVEL = PET_TUNE.levels.length + 1;

export function newPets() {
    return { active: null, name: '', acc: null, need: { ...PET_TUNE.start }, xp: {}, adopted: 0, care: 0, fed: 0, played: 0, lastPlay: -99, lastPat: -99 };
}

/** Bond level from bond xp: 1 to 5. */
export function bondLevel(xp = 0) {
    let lv = 1;
    for (const t of PET_TUNE.levels) if (xp >= t) lv++;
    return lv;
}
/** Xp for the next level, or null at the top. */
export function bondNext(xp = 0) { return PET_TUNE.levels.find((t) => xp < t) ?? null; }
export const mood = (P) => (P.need.food + P.need.clean + P.need.fun) / 3;
export const content = (P) => mood(P) >= PET_TUNE.content;

/** The size of a pet's bonus, as a share: per × level, halved when the pet isn't content. */
export function petShare(P, id = P.active) {
    if (!id || !PET[id]) return 0;
    return PET[id].fx.per * bondLevel(P.xp[id]) * (content(P) ? 1 : 0.5);
}
/** The bonus as an effect record for mods(), or none. */
export function petFx(P) {
    if (!P?.active || !PET[P.active]) return [];
    const s = petShare(P), k = PET[P.active].fx.k;
    return [{ k, x: k === 'offRate' ? s : 1 + s }];
}
/** "+18%" etc. for the UI. */
export function petPerkText(P, id = P.active) {
    const s = Math.abs(petShare(P, id) * 100);
    return PET[id].perk(Math.round(s * 10) / 10);
}

/** Fade the active pet's needs. Returns true if whether it is content changed (the bonus changed with it). */
export function fade(P, dt) {
    if (!P.active) return false;
    const was = content(P);
    for (const k of NEEDS) P.need[k] = Math.max(0, P.need[k] - dt / PET_TUNE.fade[k]);
    return was !== content(P);
}

/**
 * Apply one bit of care. Returns null when it does nothing (the pet is full, already that clean, too soon to play),
 * else { need, gain, xp, fav, level, up }. t is the sim clock, for the cooldowns.
 *   feed { food }: fills hunger, more for the favourite; a full pet won't eat.
 *   groom { v }: the care screen reports how clean the pet now is (0..1); only an improvement counts.
 *   play: a toy caught; fun, and a little bond even when the pet is already happy.
 *   pat: a pat in the castle, now and then.
 */
export function care(P, act, arg = {}, t = 0) {
    const id = P.active;
    if (!id || !PET[id]) return null;
    let need, gain = 0, xp = 0, fav = false;
    if (act === 'feed') {
        if (!FOOD[arg.food] || P.need.food >= 0.97) return null;
        fav = arg.food === PET[id].fav;
        need = 'food';
        gain = Math.min(1 - P.need.food, fav ? PET_TUNE.favFeed : PET_TUNE.feed);
        xp = gain * 10 + (fav ? 2 : 0);
        P.fed++;
    } else if (act === 'groom') {
        const v = Math.max(0, Math.min(1, +arg.v || 0));
        if (v <= P.need.clean + 1e-6) return null;
        need = 'clean';
        gain = v - P.need.clean;
        xp = gain * 10;
    } else if (act === 'play') {
        if (t - P.lastPlay < PET_TUNE.playCd) return null;
        P.lastPlay = t;
        need = 'fun';
        gain = Math.min(1 - P.need.fun, PET_TUNE.play);
        xp = gain > 0.01 ? 2 : 0.5;
        P.played++;
    } else if (act === 'pat') {
        if (t - P.lastPat < PET_TUNE.patCd) return null;
        P.lastPat = t;
        need = 'fun';
        gain = Math.min(1 - P.need.fun, PET_TUNE.pat);
        xp = 1;
    } else return null;
    const before = bondLevel(P.xp[id]);
    P.need[need] = Math.min(1, P.need[need] + gain);
    P.xp[id] = (P.xp[id] || 0) + xp;
    P.care++;
    const level = bondLevel(P.xp[id]);
    return { need, gain, xp, fav, level, up: level > before };
}

/** A name from the adoption form: printable, trimmed, at most 16 characters; the pet's own name if empty. */
export function cleanName(s, id) {
    const n = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
    return n || PET[id].name;
}
