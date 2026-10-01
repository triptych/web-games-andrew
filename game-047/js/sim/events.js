/**
 * events.js — "Mystery" nodes. Templates × world flavour × seeded variation.
 *
 * Each template is a function (rng, ctx) → { title, text[], choices[] }.
 * ctx: { wd (world def), w (index), name() → generated NPC name, gold, hp, maxHp, deckSize }.
 * Effects are resolved by run.js applyEffects().
 */

import { makeRng, hashSeed } from './rng.js';
import { WORLD_DEFS } from './worlds.js';

const FIRST = ['Aldric', 'Briony', 'Cassius', 'Dell', 'Edda', 'Fenwick', 'Gisla', 'Hob', 'Isolde', 'Jory', 'Kestrel', 'Lark', 'Maud', 'Nim', 'Orrin', 'Perpetua', 'Quill', 'Rosamund', 'Silas', 'Tibb', 'Una', 'Varrick', 'Wenna', 'Yarrow', 'Zeb'];
const TRADE = ['tinker', 'pilgrim', 'hedge-knight', 'card-sharp', 'herbalist', 'minstrel', 'grave-digger', 'cartographer', 'deserter', 'alchemist', 'bone-reader', 'smuggler'];
const TRAIT = ['with one silver eye', 'humming a hymn backwards', 'wearing a coat of playing cards', 'who laughs too easily', 'with ash in their beard', 'missing two fingers', 'carrying a caged moth', 'with a voice like wind in a chimney', 'who will not give their real name', 'polishing a single gold tooth'];
const WEATHER = {
    embers: 'embers drift past like fireflies', bubbles: 'bubbles rise through the drowned air', spores: 'glowing spores drift between the thorns',
    sand: 'glass-sand hisses across the stones', snow: 'snow falls without a sound', gold: 'flakes of gold drift in the heat',
    feathers: 'feathers spiral on the updraught', confetti: 'confetti falls from nowhere', stardust: 'motes of starlight drift on the black water', ash: 'ash falls like grey snow',
};

function npc(rng) { return { name: rng.pick(FIRST), trade: rng.pick(TRADE), trait: rng.pick(TRAIT) }; }

const T = {
    shrine(rng, c) {
        const god = rng.pick(['the Dealer', 'the Lady of Hands', 'the Pale Croupier', 'Saint Ace', 'the Nameless Jack', 'Old Mother Deck']);
        return {
            title: `A Shrine to ${god.replace(/^the /, 'the ').replace(/^./, (s) => s.toUpperCase())}`,
            text: [`At the edge of ${c.place}, a wayside shrine to ${god} stands half-buried. Candles still burn in its niches, though no one has tended them in years; ${c.weather}.`, 'A bowl of offerings sits before the idol: coins, cards, a child\'s tooth.'],
            choices: [
                { label: 'Pray', desc: 'Heal 25% of your max HP.', effects: [{ healPct: 0.25 }] },
                { label: 'Leave an offering', desc: 'Pay 50 gold. Gain a random relic.', effects: [{ gold: -50 }, { relic: 'random' }], cost: 50 },
                { label: 'Take the offerings', desc: 'Gain 45 gold. Shuffle 1 Ash into your deck. It seems fair.', effects: [{ gold: 45 }, { ash: 1 }] },
            ],
        };
    },
    traveller(rng, c) {
        const p = npc(rng);
        return {
            title: `${p.name} the ${cap(p.trade)}`,
            text: [`A ${p.trade} ${p.trait} lies against a milestone in ${c.place}, clutching a wound. "${rng.pick(['Monsters', 'Bandits', 'A Warden\'s hound', 'Something in the dark'])}," they gasp. "Took my pack. Left me this."`, 'They hold up a single card, bloodied at the corner.'],
            choices: [
                { label: 'Bind the wound', desc: 'Lose 6 HP. They press the card on you: a random rare card.', effects: [{ hp: -6 }, { card: 'rare' }, { chron: `bound the wounds of ${p.name} the ${p.trade}` }] },
                { label: 'Take the card and go', desc: 'Gain a random card. Shuffle 1 Ash into your deck.', effects: [{ card: 'random' }, { ash: 1 }] },
                { label: 'Share your supplies', desc: 'Lose 30 gold. Gain 8 max HP from the good deed.', effects: [{ gold: -30 }, { maxHp: 8 }], cost: 30 },
            ],
        };
    },
    gambler(rng, c) {
        const p = npc(rng);
        return {
            title: 'The Gambler\'s Table',
            text: [`In a lean-to at ${c.place}, ${p.name} — a ${p.trade} ${p.trait} — shuffles a deck with fingers far too quick. "One hand of poker," they say. "Pair or better, I pay double. Worse, the house keeps it."`],
            choices: [
                { label: 'Bet 30 gold', desc: 'Deal five cards. Pair or better doubles your bet.', effects: [{ gamble: 30 }], cost: 30 },
                { label: 'Bet 75 gold', desc: 'Pair or better doubles it. Three of a Kind or better triples it.', effects: [{ gamble: 75 }], cost: 75 },
                { label: 'Walk away', desc: '"Sensible," they sneer. Nothing happens.', effects: [] },
            ],
        };
    },
    chest(rng, c) {
        return {
            title: 'A Chest in the Ash',
            text: [`Half-buried in ${c.place} is an iron-bound chest, its lock shaped like a grinning Jack. Something inside rattles when you touch it. ${cap(c.weather)}.`],
            choices: [
                { label: 'Force it open', desc: 'Gain a random relic. The Jack\'s curse follows: 2 Ash.', effects: [{ relic: 'random' }, { ash: 2 }] },
                { label: 'Pick the lock', desc: '60%: gain a relic. 40%: a needle trap, lose 12 HP.', effects: [{ chance: 0.6, then: [{ relic: 'random' }], else: [{ hp: -12 }] }] },
                { label: 'Leave it', desc: 'Some things are buried for a reason.', effects: [] },
            ],
        };
    },
    sharp(rng, c) {
        const p = npc(rng);
        return {
            title: `${p.name}'s Card Stall`,
            text: [`A card-sharp ${p.trait} has set up a folding table in ${c.place}. "Trade you," they say. "Your worst card for something from my sleeve. No looking."`],
            choices: [
                { label: 'Trade a card', desc: 'Remove a card of your choice. Gain a random rare card.', effects: [{ remove: 1 }, { card: 'rare' }] },
                { label: 'Buy from the sleeve', desc: 'Pay 45 gold. Choose 1 of 3 cards.', effects: [{ gold: -45 }, { cardChoice: 3 }], cost: 45 },
                { label: 'Decline', desc: 'They shrug and cheat someone else.', effects: [] },
            ],
        };
    },
    hermit(rng, c) {
        const p = npc(rng);
        return {
            title: 'The Hermit\'s Library',
            text: [`${p.name}, once a ${p.trade}, now lives alone in ${c.place} among towers of mouldering books. "Every hand of cards is a sentence," they say. "Most people only ever learn to spell."`],
            choices: [
                { label: 'Study with them', desc: 'Upgrade a card of your choice.', effects: [{ upgrade: 1 }] },
                { label: 'Borrow a spellbook', desc: 'Gain a random Arcana card.', effects: [{ card: 'arcana' }] },
                { label: 'Burn a book for warmth', desc: 'Heal 12. They will not forgive you.', effects: [{ hp: 12 }] },
            ],
        };
    },
    fountain(rng, c) {
        const drink = rng.pick(['silver', 'ember-red', 'black', 'glowing green', 'milky-white']);
        return {
            title: 'The Singing Fountain',
            text: [`A fountain in ${c.place} runs with ${drink} water that hums faintly, like a finger around the rim of a glass.`],
            choices: [
                { label: 'Drink deeply', desc: 'Heal 30% of your max HP.', effects: [{ healPct: 0.3 }] },
                { label: 'Bathe your cards', desc: 'Remove every Ash card from your deck and upgrade 1 random card.', effects: [{ removeAsh: true }, { upgradeRandom: 1 }] },
                { label: 'Fill a flask', desc: 'Gain a random elixir.', effects: [{ elixir: 'random' }] },
            ],
        };
    },
    enchanter(rng, c) {
        const p = npc(rng);
        return {
            title: 'The Wandering Enchanter',
            text: [`An enchanter ${p.trait} is painting sigils onto the backs of playing cards by the light of ${c.place}. "I can wake one of yours," they offer. "For a price, gently. For free, roughly."`],
            choices: [
                { label: 'Gently', desc: 'Pay 60 gold. Choose a card; give it a random enchantment.', effects: [{ gold: -60 }, { enchant: 'random' }], cost: 60 },
                { label: 'Roughly', desc: 'Lose 9 HP. Choose a card; give it a random enchantment.', effects: [{ hp: -9 }, { enchant: 'random' }] },
                { label: 'No thank you', desc: 'Keep your cards sleeping.', effects: [] },
            ],
        };
    },
    hunter(rng, c) {
        const p = npc(rng);
        return {
            title: `${p.name} the Monster-Hunter`,
            text: [`A hunter ${p.trait} is tracking something through ${c.place}. "Big one," they say. "Bigger than anything you've fought. Help me take it and you can have its hoard."`],
            choices: [
                { label: 'Join the hunt', desc: 'Fight an Elite. Win a relic and extra gold.', effects: [{ fight: 'elite' }] },
                { label: 'Buy their spare kit', desc: 'Pay 40 gold. Gain 2 random elixirs.', effects: [{ gold: -40 }, { elixir: 'random' }, { elixir: 'random' }], cost: 40 },
                { label: 'Wish them luck', desc: 'Nothing happens.', effects: [] },
            ],
        };
    },
    mirror(rng, c) {
        return {
            title: 'The Mirror Pool',
            text: [`In ${c.place} a still pool reflects a sky that is not overhead. When you hold a card over the water, its reflection holds one too.`],
            choices: [
                { label: 'Reach into the reflection', desc: 'Lose 10 HP. Duplicate a card of your choice.', effects: [{ hp: -10 }, { duplicate: 1 }] },
                { label: 'Drop a card in', desc: 'Remove a card of your choice.', effects: [{ remove: 1 }] },
                { label: 'Look away', desc: 'You have seen enough reflections.', effects: [] },
            ],
        };
    },
    storm(rng, c) {
        return {
            title: 'The Storm Comes In',
            text: [`The sky over ${c.place} turns the colour of a bruise. ${cap(c.weather)}, faster and faster. There is a ruin nearby, and something moving in it.`],
            choices: [
                { label: 'Shelter in the ruin', desc: 'Fight whatever is in there.', effects: [{ fight: 'battle' }, { gold: 20 }] },
                { label: 'Push through', desc: 'Lose 7 HP. Find 35 gold in the wreckage the storm uncovers.', effects: [{ hp: -7 }, { gold: 35 }] },
                { label: 'Wait it out', desc: 'Shuffle 1 Ash into your deck. Heal 10.', effects: [{ ash: 1 }, { hp: 10 }] },
            ],
        };
    },
    battlefield(rng, c) {
        return {
            title: 'An Old Battlefield',
            text: [`Rusted armour and burned banners litter ${c.place}. Every soldier here fell holding cards; a few decks lie scattered in the grass, their faces bleached white.`],
            choices: [
                { label: 'Search the fallen', desc: 'Gain a random card and 25 gold.', effects: [{ card: 'random' }, { gold: 25 }] },
                { label: 'Search the command tent', desc: '50%: a relic. 50%: something is still guarding it (lose 14 HP).', effects: [{ chance: 0.5, then: [{ relic: 'random' }], else: [{ hp: -14 }] }] },
                { label: 'Bury them', desc: 'It takes all day. Gain 6 max HP.', effects: [{ maxHp: 6 }, { chron: 'buried the dead of an old battlefield' }] },
            ],
        };
    },
    altar(rng, c) {
        return {
            title: 'The Altar of Suits',
            text: [`Four stone basins stand in a ring in ${c.place}, carved with a sword, a stave, a coin and a heart. Lay a card in one and it comes out changed.`],
            choices: [
                { label: 'The Sword', desc: 'Up to 3 random cards become Blades.', effects: [{ transmuteSuit: 'S', count: 3 }] },
                { label: 'The Stave', desc: 'Up to 3 random cards become Staves.', effects: [{ transmuteSuit: 'C', count: 3 }] },
                { label: 'The Coin', desc: 'Up to 3 random cards become Coins.', effects: [{ transmuteSuit: 'D', count: 3 }] },
                { label: 'The Heart', desc: 'Up to 3 random cards become Hearts.', effects: [{ transmuteSuit: 'H', count: 3 }] },
            ],
        };
    },
    well(rng, c) {
        return {
            title: 'The Wishing Well',
            text: [`A well in ${c.place} is lined with coins from every realm. A voice from the bottom asks what you want most.`],
            choices: [
                { label: '"Power"', desc: 'Pay 35 gold. Gain a random uncommon relic.', effects: [{ gold: -35 }, { relic: 2 }], cost: 35 },
                { label: '"Luck"', desc: 'Gain Liquid Luck and 20 gold.', effects: [{ elixirId: 'luck' }, { gold: 20 }] },
                { label: '"Rest"', desc: 'Heal 20.', effects: [{ hp: 20 }] },
            ],
        };
    },
    dream(rng, c) {
        return {
            title: 'A Strange Dream',
            text: [`You sleep in ${c.place} and dream of the gods' table. Someone across it is dealing — a figure with no face, only hands. They slide three cards towards you.`],
            choices: [
                { label: 'Take the first', desc: 'Upgrade 2 random cards.', effects: [{ upgradeRandom: 2 }] },
                { label: 'Take the second', desc: 'Choose 1 of 3 rare cards.', effects: [{ cardChoice: 3, rare: true }] },
                { label: 'Take the third', desc: 'Lose 5 max HP. Gain a rare relic.', effects: [{ maxHp: -5 }, { relic: 'rare' }] },
            ],
        };
    },
    peddler(rng, c) {
        const p = npc(rng);
        return {
            title: `${p.name}'s Cart`,
            text: [`A peddler's cart creaks through ${c.place}, pulled by a mule ${p.trait}. "Potions! Charms! Slightly used destinies!" ${p.name} cries.`],
            choices: [
                { label: 'Buy a potion', desc: 'Pay 30 gold. Gain a random elixir.', effects: [{ gold: -30 }, { elixir: 'random' }], cost: 30 },
                { label: 'Buy a destiny', desc: 'Pay 70 gold. Choose 1 of 3 rare cards.', effects: [{ gold: -70 }, { cardChoice: 3, rare: true }], cost: 70 },
                { label: 'Sell a card', desc: 'Remove a card of your choice. Gain 30 gold.', effects: [{ remove: 1 }, { gold: 30 }] },
            ],
        };
    },
};
const KEYS = Object.keys(T);

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function makeEvent(runSeed, w, node, run) {
    const rng = makeRng(hashSeed(runSeed, w, node.seed, 77));
    const wd = WORLD_DEFS[w];
    const ctx = { wd, w, place: node.name, weather: WEATHER[wd.weather] ?? 'the wind moves', gold: run.gold };
    // avoid repeating a template within the run where possible
    const seen = new Set(run.seenEvents ?? []);
    let pool = KEYS.filter((k) => !seen.has(k));
    if (!pool.length) pool = KEYS;
    const key = rng.pick(pool);
    const ev = T[key](rng, ctx);
    ev.key = key;
    return ev;
}

export const EVENT_KEYS = KEYS;
