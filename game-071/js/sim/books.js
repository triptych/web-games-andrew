/**
 * books.js — everything readable: lore, skill books (the first read raises a skill), letters,
 * notes and the main-quest texts. Registers each as an item; the book view reads BOOKS.
 */
import { registerItem } from './items.js';

export const BOOKS = {
    // ---------------------------------------------------------------- lore
    lore_binders: { title: 'The Binders of the First Storm', value: 25, text: `Before the five towns, before the charter, before the roads, the Wyrm-Kings ruled the north from temples raised on ice. They did not hunt men as wolves hunt deer. They kept them as a farmer keeps sheep: fed, counted, and taken when wanted.

The Binders were not kings or knights. They were weather-watchers, net-menders, a smith or two, and a woman named Eydis who had been struck by lightning as a girl and lived. She saw that the storm the wyrms rode had shapes in it, the way frost has shapes on a window. Where others saw the end of the world in a thunderhead, she saw letters.

She taught the others to trace those letters with an open hand. The first sigil she carved was a gust of wind that knocked a wyrm's breath back into its throat. The last, which took her twenty years, was a chain: a shape that told the earth to hold what touched it. With it the Binders pinned the Ash-Wyrm to the ground he had always despised, and tore out the ember that was his heart.

They could not kill what was left. So they sank the ember under the ice of the Hrimsea and walked away, and the ice has been thinning ever since.` },
    lore_wardens: { title: 'The Charter of the Five Towns', value: 15, text: `Being the agreement made at the Brightrun ford between the free towns of Brightwater, Hrimvik, Stonecleft, Mirefen and Kelvik.

First: that no town shall raise a wall against another, nor close a road to another's carts.
Second: that each town shall choose its Warden by the voice of those who keep a hearth there, and shall unmake that Warden the same way.
Third: that the Wardens shall meet at Brightwater every midwinter, and that any Warden who does not come shall pay for the mead.
Fourth: that when the sea brings raiders, every town shall send its Hearthguard, whether the raiders landed on its shore or not.

Signed with five marks, and one smudge where the Warden of Mirefen spilled the ink.` },
    lore_reavers: { title: 'Grey Sails: A Short History of the Saltreavers', value: 20, text: `They come in spring, when the ice breaks, and in autumn, before it closes. Nobody in the Frostmarch knows for certain where they come from. Their mail is grey because they paint it with ash and seal fat against the salt. Their longboats have no figureheads, which sailors in Hrimvik consider the most frightening thing about them.

The Saltreavers do not hold land. They take what will fit in a boat: grain, iron, silver, and sometimes people. A town that pays them once will see them every year. A town that fights them hard enough will see them less often. Fort Saltreave on the north shore was built by the Hearthguard to watch for their sails; within ten years the reavers had taken it for themselves, which tells you most of what you need to know.` },
    lore_skywatch: { title: 'Notes of a Pilgrim to Highcairn', value: 15, text: `Eleven hundred steps. I counted. The watchers say there are a thousand and that I must have counted some twice, but my knees disagree.

They are not priests, though they live like them. They keep the oldest instruments in the north: brass spheres, glass lenses, a bowl of water that shows the stars at noon. They write down every storm that crosses the mountain and every colour the aurora takes. Master Ostvald told me that the storms of the last hundred years have been growing a little more ordered every decade, "as if someone were tidying them." I asked who. He changed the subject to soup.` },
    lore_deepforge: { title: 'The Clockwork Folk of Deepforge', value: 30, text: `Beneath Stonecleft there are halls cut so true that a dropped marble will roll the length of them without turning. The folk who built them were small, careful, and gone long before the first Norrhen boat came up the fjord.

They made servants of brass that still walk the halls, oiling hinges that no one will ever open, and spiders of copper wire that hunt rats and anything else that moves. In the deepest vault they built an orrery: a model of the sky so precise that, the scholars of the Academy say, it shows not only where the stars are but where the storm-sigils hang among them.

What happened to the builders is a matter of argument. The Gloomkin who live in the lower halls now are blind and pale and will not say, mostly because they do not speak to anyone who is not a Gloomkin, and rarely to those.` },
    lore_dragons: { title: 'On the Anatomy of Wyrms', value: 40, text: `A dragon is not a lizard. Its bones are hollow like a bird's and threaded with something that is not marrow, a dark crystal that hums faintly when struck. Its heart is not a heart. Where a beast would carry a heart, a dragon carries an ember: a knot of living storm about the size of a man's head, which keeps burning for some hours after death.

The Binders called these embers "the coin of the sky." A dragon that eats another's ember grows. A dragon that eats enough of them becomes something else. Their histories mention this happening only once, and they did not like to write about it.

Practical notes for the would-be hunter: a dragon on the ground is slow to turn. It cannot breathe and bite at the same time. Its wings are its legs when grounded; strike the wrists. And do not, under any circumstances, stand in front of it.` },
    lore_totems: { title: 'The Spirit Totems of the Old Clans', value: 10, text: `Long before the towns, the clans of the Frostmarch carved their guardian spirits into the trunks of standing trees: the Bear for strength, the Owl for learning, the Fox for cunning, the Elk for endurance, the Raven for memory, and the Ox for burden. When the trees died, the clans copied them in stone.

Travellers still lay a hand on a totem for luck. The old women of Pinebrook say the spirits choose only one at a time to walk with you, and that they are jealous of each other.` },
    lore_kalrstead: { title: 'A Survey of the Burial Mounds', value: 20, text: `The wyrm-mounds are easy to mistake for hills until you see that they are too round, and that nothing grows on their crowns. I have counted nineteen between the Greyspine and the Emberfields. The largest is at Kalrstead, east of Hrimgard.

Local custom forbids digging into them. I did not dig, but I did press my ear to the turf at Kalrstead on a still night, and I would swear that I heard something turning over in its sleep.` },
    lore_gloomkin: { title: 'Among the Gloomkin', value: 25, text: `They hear a heartbeat at twenty paces. They smell a lamp before it is lit. They have no eyes worth the name, but they do not need them: in the dark under the mountains, eyes are a weakness.

The Gloomkin are not cruel, any more than a winter is cruel. They defend their halls against everything that comes down into them, and most things that come down into them are trying to steal something. I spent three weeks in Murkhollow as their prisoner and was fed well throughout. I recommend sneaking.` },
    lore_hierophant: { title: 'The Iron Crowns', value: 35, text: `The priests of the Wyrm-Kings wore crowns of black iron set with ember-glass, and were buried in them. Each crown was made for one priest and bore that priest's name around the rim. They were said to let the wearer hear the voices of the wyrms across any distance.

Zahrakhul was the last and greatest of them, high hierophant of Vahlokar. When the Binders came to his temple he did not flee. The histories say he walked down the temple steps to meet them, and that the battle on those steps lasted three days. They do not say who won it. They say only that the temple was sealed afterwards, and that no one has opened it since.` },
    // ---------------------------------------------------------------- skill books (first read: +1 skill)
    sk_oneHanded: { title: 'The Duellist of Kelvik', skill: 'oneHanded', value: 50, text: 'A short memoir by a sword-teacher who never lost a bout, mostly because she never fought anyone who could see her coming. Her one lesson, repeated on every page: keep your weight on the balls of your feet, and your eyes on their shoulders, not their blade.' },
    sk_twoHanded: { title: 'The Weight of the Axe', skill: 'twoHanded', value: 50, text: 'A woodcutter turned soldier explains that a greataxe is not swung so much as dropped, and steered on the way down. "Let the iron do the work. Your job is to be somewhere else when it lands."' },
    sk_archery: { title: 'Fletcher and Bow', skill: 'archery', value: 50, text: 'Practical notes on wind, string-wax and the patience of the hunt. The author insists that the best archers breathe out before they loose, and that the second-best archers have never noticed they do.' },
    sk_block: { title: 'The Shield Wall at Brightrun Ford', skill: 'block', value: 50, text: 'An account of the day forty Hearthguard held a ford against three boatloads of Saltreavers. Every shield was struck a hundred times, and not one shield-bearer fell, because each one trusted the shield beside them more than their own.' },
    sk_heavyArmor: { title: 'Plate and Patience', skill: 'heavyArmor', value: 50, text: 'An armourer explains that heavy armour is not a shell but a set of rooms you live in. Learn where the doors are and how they open, and you can move in steel as easily as in wool.' },
    sk_smithing: { title: "The Smith's Year", skill: 'smithing', value: 50, text: 'A month-by-month diary of a Stonecleft smithy, full of quarrels about charcoal and one long, beautiful passage about the colour iron turns just before it is ready to fold.' },
    sk_lightArmor: { title: 'Leathers of the Vael', skill: 'lightArmor', value: 50, text: 'The hill-elves stitch their armour with the grain of the hide, so that it flexes the way the animal did. The author spent a winter learning the stitch and lost two fingernails to it.' },
    sk_sneak: { title: 'Footfalls', skill: 'sneak', value: 50, text: 'A thief writes about floors: which boards creak, which stones ring hollow, and why the quietest way across a room is almost never the shortest.' },
    sk_lockpicking: { title: 'Pins and Patience', skill: 'lockpicking', value: 50, text: 'Every lock is a little drum of springs waiting to fall into line. The author advises feeling for the moment each pin lifts past the shear, and warns that greed snaps more picks than bad luck.' },
    sk_pickpocket: { title: 'Light Fingers, Heavy Purse', skill: 'pickpocket', value: 50, text: 'A cheerful and entirely unrepentant guide to crowded markets, with a chapter on why you should never rob someone who is laughing.' },
    sk_speech: { title: 'The Haggler', skill: 'speech', value: 50, text: 'A Mirefen trader on the art of saying a number and then saying nothing at all. "Silence is the cheapest thing you will ever sell, and it fetches the best price."' },
    sk_alchemy: { title: 'Roots and Stills', skill: 'alchemy', value: 50, text: 'A herbalist describes how to tell which part of a plant does the work. The essence is in the part the plant protects; the note is in the part it gives away.' },
    sk_destruction: { title: 'The Spark and the Gale', skill: 'destruction', value: 50, text: 'An evoker of the Frostspire describes the first spell she ever cast, which set her eyebrows alight, and the hundredth, which brought down a troll.' },
    sk_restoration: { title: 'Hands That Mend', skill: 'restoration', value: 50, text: 'A temple healer writes that mending is listening: the body already knows how it wants to heal, and the spell only helps it remember.' },
    sk_alteration: { title: 'The Shape of Stone', skill: 'alteration', value: 50, text: 'A treatise on persuading the world to be slightly different than it is, beginning with your own skin and ending, the author hopes, with mountains.' },
    sk_conjuration: { title: 'Calling the Wolf', skill: 'conjuration', value: 50, text: 'How to find the spirit of a wolf in the cold between stars, and how to ask it politely to come and help. The author is clear that asking politely matters.' },
    sk_illusion: { title: 'The Kind Lie', skill: 'illusion', value: 50, text: 'Glamour, the author argues, is not deceit. It is offering someone a feeling they would have reached anyway, a little sooner.' },
    sk_enchanting: { title: 'Runes in the Grain', skill: 'enchanting', value: 50, text: 'A rune-carver of the Academy on why every rune must be cut along the grain of the thing it lives in: wood, iron, leather or bone.' },
    // ---------------------------------------------------------------- letters and notes
    sealed_letter: { title: 'A Sealed Letter', value: 0, text: `To the Captain of Hollowmere Keep, by fastest courier.

The watchers at Highcairn report that the ice at the mouth of the Hrimsea is thinner than in any year of record, and that the aurora has been seen at noon three days running. They ask that every keep and town be warned. They do not say of what. I do not think they know.

— Warden Sigrun Ironbrow, Brightwater` },
    hunter_note: { title: "A Treasure Hunter's Note", value: 0, text: `Got the rubbing off the door-stone outside. Three stars-signs, top to bottom. The old dial-door inside must want the same three. Brann says the barrow's empty. Brann says a lot of things. — R.` },
    chronicle: { title: 'Chronicle of the First Storm', value: 0, text: `Carved on the wall of Grimhallow, copied in a careful hand:

We chained him with a sigil of three rings. Root, that the earth should know him. Chain, that the earth should hold him. Anchor, that the earth should keep him.

We gave the rings to three keepers so that no single traitor could undo the binding. Root we leave here, with our dead. Chain we gave to the clockwork folk, who wrote it into their brass sky. Anchor we gave to his own child, whom we bound on the summit so that he would always have something to guard and never be free to hunt.

If the ember wakes, find the three rings. The storm will try to stop you. Trace them anyway.` },
    debt_ledger: { title: 'Ledger of Debts', value: 0, text: 'Columns of names, sums and dates in a cramped Mirefen hand. Three names are underlined twice: Gisla the Cooper, Brannoc of the Mill Road, and "the fisherman with the red boat".' },
    bandit_orders: { title: 'Orders', value: 0, text: 'Take the toll from every cart on the north road. Kill anyone wearing the Warden\'s colours. Don\'t drink the mead until the chief has had his share. — K.' },
};

for (const [id, b] of Object.entries(BOOKS)) {
    const quest = ['sealed_letter', 'chronicle'].includes(id);
    registerItem(id, { type: 'book', name: b.title, value: b.value, weight: quest ? 0.5 : 1, book: id, quest, skill: b.skill });
}
export const LORE_BOOKS = Object.keys(BOOKS).filter((k) => k.startsWith('lore_'));
export const SKILL_BOOKS = Object.keys(BOOKS).filter((k) => k.startsWith('sk_'));
