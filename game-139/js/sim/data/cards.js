// CLEAN SLATE — every card you can own. Pure data (the sim, the view, the art prompts and the
// tests all read it).
//
// suit: 'blade' (your past: strong, but every one you use raises Notoriety), 'hearth' (warmth:
//       Composure and healing), 'coin' (tips and streaks), 'key' (the inn's keys: draws, reveals),
//       'grudge' (dealt to you by rivals: rank 0, unpairable, clogs the hand until you pour it out).
// rank: 1..13 (A..K). 0 = a trick (played alone, needs a target) or the wild Regular.
// fx:   block n (Composure: soaks the rival's next blow), heal n (Resolve), tips n (gold), draw n,
//       reveal n (turn face-down rival cards up), soothe n (the rival's next blow is n weaker),
//       streak n (adds to this round's settle streak), unlock (frees locked rival cards),
//       cut (trick: settle any one exposed rival card alone), flex n (pairs with sums 13±n),
//       wild (pairs with anything), retain (stays in hand at round end).
// upFx: what Polishing the card changes it to (default: each number +1, block +2).
// art:  the illustration, for dev/art/prompts.mjs.

export const SUITS = {
    blade: { name: 'Blade', glyph: '⚔', color: '#c8463c', ink: '#5c1410' },
    hearth: { name: 'Hearth', glyph: '♥', color: '#e0893a', ink: '#5a2c08' },
    coin: { name: 'Coin', glyph: '◆', color: '#d8b13a', ink: '#4f3a06' },
    key: { name: 'Key', glyph: '⚷', color: '#4f8fb5', ink: '#0f2c40' },
    grudge: { name: 'Grudge', glyph: '✶', color: '#6a5a78', ink: '#1f1726' },
};

const C = (id, name, suit, rank, fx, art, extra = {}) => ({ id, name, suit, rank, fx, art, ...extra });

/** The fourteen cards you didn't throw in the river. */
export const STARTER = ['stiletto', 'garrote', 'habit', 'habit', 'knives', 'ale', 'bread', 'stew', 'hearthfire',
    'copper', 'silver', 'roomkey', 'guestbook', 'sparekey'];

export const CARDS = {
    // ---------------------------------------------------------------- your past (starter blades)
    stiletto: C('stiletto', 'Stiletto', 'blade', 9, { soothe: 3 }, 'a slim black-handled stiletto stuck point-down in a wooden bar top, a faint glint on the edge'),
    garrote: C('garrote', 'Garrote', 'blade', 4, { soothe: 2, streak: 1 }, 'a coiled length of wire with two worn wooden handles lying on a dark cloth'),
    habit: C('habit', 'Old Habit', 'blade', 0, { cut: 1 }, 'a hand reaching, almost without thinking, for a dagger hidden under a bar towel', { trick: true }),
    knives: C('knives', 'Throwing Knives', 'blade', 7, { soothe: 1, draw: 1 }, 'a fan of five small throwing knives in a leather bandolier hung on a peg'),
    // ---------------------------------------------------------------- the inn (starter)
    ale: C('ale', 'Mug of Ale', 'hearth', 3, { block: 3 }, 'a foaming pewter mug of amber ale on a scarred tavern table, candlelight behind it'),
    bread: C('bread', 'Warm Bread', 'hearth', 10, { block: 3 }, 'a round loaf of fresh crusty bread steaming on a wooden board with a knife and butter'),
    stew: C('stew', 'Hot Stew', 'hearth', 5, { block: 4 }, 'a black iron pot of thick brown stew bubbling over a hearth fire, a ladle resting in it'),
    hearthfire: C('hearthfire', 'Hearthfire', 'hearth', 8, { heal: 2 }, 'a crackling stone fireplace with a cosy armchair and a sleeping dog in front of it'),
    copper: C('copper', 'Copper Tip', 'coin', 2, { tips: 2 }, 'a small pile of copper coins left beside an empty plate and a folded napkin'),
    silver: C('silver', 'Silver Tip', 'coin', 11, { tips: 2 }, 'a single bright silver coin spinning on its edge on a polished bar'),
    roomkey: C('roomkey', 'Room Key', 'key', 1, { draw: 1 }, 'an old brass room key with a wooden tag hanging from a hook'),
    guestbook: C('guestbook', 'Guest Book', 'key', 12, { reveal: 2 }, 'an open leather guest book with a quill and an inkpot on a reception desk'),
    sparekey: C('sparekey', 'Spare Key', 'key', 13, { draw: 2 }, 'a ring of many mismatched keys hanging from a nail behind the bar'),

    // ---------------------------------------------------------------- recruits (the Market)
    cider: C('cider', 'Cider Press', 'hearth', 7, { block: 3, heal: 1 }, 'a wooden cider press with baskets of red apples and a jug of golden cider', { price: 7 }),
    pie: C('pie', "Shepherd's Pie", 'hearth', 4, { block: 5 }, 'a deep golden shepherd\'s pie in a clay dish, steam curling from the browned crust', { price: 8 }),
    ballad: C('ballad', 'Fireside Ballad', 'hearth', 12, { block: 4, soothe: 2 }, 'a lute leaning against a hearth with sheet music and a half-finished mug of mead', { price: 10 }),
    blanket: C('blanket', 'Wool Blanket', 'hearth', 9, { block: 3, retain: 1 }, 'a thick folded patchwork wool blanket on the end of a cosy inn bed', { price: 7 }),
    tea: C('tea', 'Chamomile', 'hearth', 2, { heal: 3 }, 'a chipped teacup of chamomile tea with dried flowers scattered on a saucer', { price: 7 }),
    jar: C('jar', 'Tip Jar', 'coin', 3, { tips: 3 }, 'a glass jar stuffed with coins and a hand-drawn smiley face on a scrap of paper tied to it', { price: 6 }),
    special: C('special', 'House Special', 'coin', 10, { tips: 2, streak: 1 }, 'a chalkboard easel beside a steaming platter of roast chicken and potatoes', { price: 9 }),
    lucky: C('lucky', 'Lucky Penny', 'coin', 6, { tips: 1, flex: 1 }, 'a worn copper penny with a hole through it on a red string, glowing faintly', { price: 9 }),
    tab: C('tab', 'Running Tab', 'coin', 8, { tips: 4 }, 'a long curling paper bar tab pinned to a beam with a little dagger-shaped pin', { price: 8 }),
    porter: C('porter', 'Night Porter', 'key', 5, { draw: 1, retain: 1 }, 'a lantern and a bell on a night porter\'s desk at the foot of a dark staircase', { price: 8 }),
    ledger: C('ledger', 'Guest Ledger', 'key', 9, { reveal: 3, draw: 1 }, 'a thick ledger of room bookings with ribbon markers and a magnifying glass', { price: 9 }),
    skeleton: C('skeleton', 'Skeleton Key', 'key', 11, { unlock: 1, flex: 1 }, 'an ornate black iron skeleton key with a tiny carved skull for a bow', { price: 9 }),
    regular: C('regular', 'The Regular', 'key', 0, { wild: 1 }, 'a contented old regular asleep in the same corner seat he always takes, mug in hand', { price: 14 }),
    floorplan: C('floorplan', 'Floor Plan', 'key', 1, { reveal: 9 }, 'a rolled-out architect\'s floor plan of a cosy three-storey inn, held flat by candlesticks', { price: 8 }),
    // the pawnshop: someone sold your old knives back to you
    hidden: C('hidden', 'Hidden Blade', 'blade', 0, { cut: 1, draw: 1 }, 'a spring-loaded blade half-sprung from a leather wrist bracer on a pawnshop counter', { trick: true, price: 6 }),
    nightshade: C('nightshade', 'Nightshade', 'blade', 6, { soothe: 4 }, 'a tiny corked vial of violet poison with a skull wax seal beside a sprig of nightshade', { price: 6 }),

    // ---------------------------------------------------------------- grudges (dealt by rivals)
    grudge: C('grudge', 'Old Grudge', 'grudge', 0, {}, 'a crumpled old wanted poster with the face scratched out, pinned by a knife', { junk: true }),

    // ---------------------------------------------------------------- partners (a rival who stays)
    p_brannoc: C('p_brannoc', "Brannoc's Bitters", 'hearth', 6, { heal: 3, flex: 1 }, '', { partner: 'brannoc' }),
    p_quell: C('p_quell', 'Vow of Quiet', 'key', 7, { reveal: 9, draw: 1 }, '', { partner: 'quell' }),
    p_flint: C('p_flint', "Flint's Ledger", 'coin', 9, { tips: 4, streak: 1 }, '', { partner: 'flint' }),
    p_marrow: C('p_marrow', 'Two of a Kind', 'key', 6, { flex: 2, draw: 1 }, '', { partner: 'marrow' }),
    p_corvina: C('p_corvina', 'Five Stars', 'coin', 13, { tips: 5, block: 4 }, '', { partner: 'corvina' }),
    p_moss: C('p_moss', "Moss's Lullaby", 'hearth', 2, { block: 6, soothe: 2 }, '', { partner: 'moss' }),
    p_rook: C('p_rook', 'Second Opinion', 'key', 11, { flex: 2, retain: 1 }, '', { partner: 'rook' }),
    p_oriel: C('p_oriel', 'The Reading', 'key', 0, { wild: 1, reveal: 2 }, '', { partner: 'oriel' }),
    p_varr: C('p_varr', 'Off Duty', 'hearth', 10, { block: 5, unlock: 1 }, '', { partner: 'varr' }),
    p_choir: C('p_choir', 'Harmony', 'coin', 5, { streak: 2, tips: 2 }, '', { partner: 'choir' }),
    p_vesper: C('p_vesper', 'Fresh Sourdough', 'hearth', 4, { block: 4, draw: 1 }, '', { partner: 'vesper' }),
    p_mott: C('p_mott', "Mott's Tonic", 'hearth', 12, { heal: 4, block: 2 }, '', { partner: 'mott' }),
    p_tally: C('p_tally', 'Receipts', 'coin', 3, { tips: 3, streak: 1 }, '', { partner: 'tally' }),
    p_garr: C('p_garr', 'Friendly Rivalry', 'coin', 8, { tips: 3, draw: 1 }, '', { partner: 'garr' }),
};

/** What the Market can offer (weighted: blades are rarer — the pawnshop only has so many). */
export const MARKET = ['cider', 'pie', 'ballad', 'blanket', 'tea', 'jar', 'special', 'lucky', 'tab', 'porter', 'ledger',
    'skeleton', 'regular', 'floorplan', 'hidden', 'nightshade'];

const NUM = ['block', 'heal', 'tips', 'draw', 'reveal', 'soothe', 'streak'];

/** The effects of a card as owned (up = Polished). */
export function fxOf(def, up) {
    if (!up) return def.fx;
    if (def.upFx) return def.upFx;
    const fx = { ...def.fx };
    let any = false;
    for (const k of NUM) if (fx[k] && k !== 'reveal') { fx[k] += k === 'block' ? 2 : 1; any = true; }
    if (fx.reveal && fx.reveal < 9) { fx.reveal += 2; any = true; }
    if (!any || def.trick) fx.draw = (fx.draw || 0) + 1;
    return fx;
}

export const RANK_LABEL = ['★', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** One line of rules text, built from the effects so it can never disagree with them. */
export function cardText(def, up) {
    const fx = fxOf(def, up);
    const p = [];
    if (fx.cut) p.push('Settle any open card alone');
    if (fx.wild) p.push('Pairs with anything');
    if (fx.block) p.push(`+${fx.block} Composure`);
    if (fx.heal) p.push(`Heal ${fx.heal}`);
    if (fx.soothe) p.push(`Next blow −${fx.soothe}`);
    if (fx.tips) p.push(`+${fx.tips} tips`);
    if (fx.streak) p.push(`Streak +${fx.streak}`);
    if (fx.draw) p.push(`Draw ${fx.draw}`);
    if (fx.reveal) p.push(fx.reveal >= 9 ? 'Reveal all' : `Reveal ${fx.reveal}`);
    if (fx.unlock) p.push('Unlock all');
    if (fx.flex) p.push(`Meets 13±${fx.flex + 1}`);
    if (fx.retain) p.push('Stays in hand');
    if (def.junk) p.push('Can’t be paired. Pour it out.');
    if (def.rank === 13 && !def.trick) p.unshift('Play alone');
    return p.join(' · ');
}
