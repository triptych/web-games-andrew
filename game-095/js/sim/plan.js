// The way through the house, as an ordered list of steps. Each step knows when it is done (from
// the game's state alone), how to nudge the player, and the actions that finish it. The hint
// button uses the first three; the bot uses the actions. Because `done` reads only the state,
// the bot can pick up from anywhere, which is how simtest proves there is no dead end.

import { has } from './world.js';

const STEPS = [];
const step = (id, done, hint, room, hs, acts) => STEPS.push({ id, done, hint, room, hs, acts });
const L = (G) => G.layout;
const go = (room) => ({ type: 'go', room });
const tap = (id) => ({ type: 'click', id });
const use = (item, id) => ({ type: 'use', item, id });
const clued = (c) => (G) => G.clues.includes(c);
const flagged = (f) => (G) => !!G.f[f];

step('portrait', clued('portrait'),
    ['Maybe the family portrait in the foyer says who used to live here.', 'Look at the portrait in the Grand Foyer.', 'Tap the family portrait on the foyer wall.'],
    'foyer', 'f_portrait', () => [go('foyer'), tap('f_portrait')]);
step('cold', clued('cold'),
    ['Theo felt a chill. Where does a house get a cold spot?', 'Something in the foyer hangs over a very cold spot.', 'Tap the chandelier in the foyer.'],
    'foyer', 'f_chandelier', () => [go('foyer'), tap('f_chandelier')]);
step('key', (G) => has(G, 'brass_key') || !!G.f.lib_open,
    ['There is a locked door and a key hiding somewhere cozy.', 'The key is hiding in the parlor. Try the sofa, the teapot and the fireplace.', (G) => `The key is in the ${L(G).keySpot}. Tap it in the parlor.`],
    'parlor', (G) => 'p_' + L(G).keySpot, (G) => [go('parlor'), tap('p_' + L(G).keySpot)]);
step('library', flagged('lib_open'),
    ['A flower-shaped keyhole is waiting for a flower-shaped key.', 'Take the brass key to the library door in the foyer.', 'Select the brass key in your pack, then tap the library door.'],
    'foyer', 'd_f_library', () => [go('foyer'), use('brass_key', 'd_f_library')]);
step('giggle', clued('giggle'),
    ['Something in the parlor tinkles when nobody is looking.', 'Take a look at the music box in the parlor.', 'Tap the music box in the parlor.'],
    'parlor', 'p_musicbox', () => [go('parlor'), tap('p_musicbox')]);
step('footprints', clued('footprints'),
    ['The kitchen smells of vanilla. Look at the floor.', 'There is flour spilled on the kitchen floor.', 'Tap the floury footprints in the kitchen.'],
    'kitchen', 'k_floor', () => [go('kitchen'), tap('k_floor')]);
step('diary1', clued('diary1'),
    ['The library has someone\'s diary.', 'The open diary on the library desk.', 'Tap the open diary in the library.'],
    'library', 'l_diary1', () => [go('library'), tap('l_diary1')]);
step('jar', flagged('jar_read'),
    ['Cookie jars are a classic hiding place for other things.', 'Check the cookie jar in the kitchen.', 'Tap the cookie jar in the kitchen.'],
    'kitchen', 'k_jar', () => [go('kitchen'), tap('k_jar')]);
step('calendar', clued('partyday'),
    ['A pantry lock wants three numbers. One is a day of the month.', 'The calendar in the kitchen has one circled day.', 'Tap the wall calendar in the kitchen.'],
    'kitchen', 'k_calendar', () => [go('kitchen'), tap('k_calendar')]);
step('guests', clued('guests'),
    ['Another number may be on a list in the parlor.', 'Look at the guest list on the parlor table.', 'Tap the guest list in the parlor.'],
    'parlor', 'p_guestlist', () => [go('parlor'), tap('p_guestlist')]);
step('rhyme', clued('rhyme'),
    ['The library has a poem on the wall.', 'The framed rhyme over the library desk lists some titles.', 'Tap the framed rhyme in the library.'],
    'library', 'l_rhyme', () => [go('library'), tap('l_rhyme')]);
step('books', flagged('shelf_open'),
    ['The rhyme tells you which books to pull, in order.', 'Pull the three books named in the rhyme, in order. Wrong ones pop back out.', (G) => `Pull books ${L(G).bookOrder.map((i) => L(G).bookTitles[i]).join(', then ')}.`],
    'library', (G) => 'l_book_' + L(G).bookOrder[0], (G) => [go('library'), ...L(G).bookOrder.map((i) => tap('l_book_' + i))]);
step('wkey', flagged('wkey_taken'),
    ['Something opened in the shelf.', 'Look inside the secret compartment in the library.', 'Tap the secret compartment.'],
    'library', 'l_compartment', () => [go('library'), tap('l_compartment')]);
step('accuse', flagged('case_solved'),
    ['Enough clues? Open the journal and decide who or what is haunting the manor.', 'Open the journal and use the Case tab.', 'Open the journal, tap Case, and pick the lonely ghost.'],
    null, null, () => [{ type: 'accuse', who: 'ghost' }]);
step('broom', flagged('broom_found'),
    ['There is a hatch up high that needs something long.', 'A broom would reach. Try the broom closet in the kitchen.', 'Tap the broom closet in the kitchen.'],
    'kitchen', 'k_closet', () => [go('kitchen'), tap('k_closet')]);
step('hatch', flagged('attic_open'),
    ['The cord on the foyer hatch is just out of reach.', 'Use the broom on the hatch above the foyer landing.', 'Select the broom, then tap the attic hatch in the foyer.'],
    'foyer', 'f_hatch', () => [go('foyer'), use('broom', 'f_hatch')]);
step('lullaby', clued('lullaby'),
    ['The attic has something musical.', 'Look at the sheet music in the attic.', 'Tap the sheet music on the stand.'],
    'attic', 'a_sheet', () => [go('attic'), tap('a_sheet')]);
step('box', flagged('box_open'),
    ['The parlor music box needs winding and then a tune.', 'Use the winding key on the music box, then play the lullaby from the attic.', (G) => `Play ${L(G).melody.map((n) => ['rose', 'amber', 'mint', 'sky', 'violet'][n]).join(', ')}.`],
    'parlor', 'p_musicbox', (G) => [go('parlor'), { type: 'noteReset' }, use('winding_key', 'p_musicbox'), ...L(G).melody.map((n) => ({ type: 'note', n }))]);
step('trunk', flagged('trunk_open'),
    ['The attic trunk has a lock shaped like a star.', 'Use the star key on the trunk in the attic.', 'Select the star key, then tap the trunk.'],
    'attic', 'a_trunk', () => [go('attic'), use('trunk_key', 'a_trunk')]);
step('pantry', flagged('pantry_open'),
    ['The kitchen pantry has a combination lock. Three notes in your journal give the numbers.', 'Age, party day, guests: it is in your journal under Codes.', (G) => `The code is ${L(G).age}, ${L(G).day}, ${L(G).guests}.`],
    'kitchen', 'k_pantry', (G) => [go('kitchen'), { type: 'code', id: 'pantry', digits: [L(G).age, L(G).day, L(G).guests] }]);
step('bake', (G) => !!(G.f.baking || G.f.baked),
    ['Cake mix and an oven. You know what to do.', 'Use the cake mix on the old oven.', 'Select the cake mix, then tap the oven.'],
    'kitchen', 'k_oven', () => [go('kitchen'), use('cake_mix', 'k_oven')]);
step('cake', flagged('cake_taken'),
    ['Cakes take a little while to bake.', 'When the oven dings, take the cake out.', 'Tap the oven when it dings.'],
    'kitchen', 'k_oven', (G) => (G.f.baking ? [{ type: 'wait' }] : [go('kitchen'), tap('k_oven')]));
step('frost', (G) => has(G, 'frosted_cake') || has(G, 'birthday_cake') || !!G.f.p_cake,
    ['A plain cake and a jar of frosting want to meet.', 'Combine the frosting with the plain cake in your pack.', 'Select one in your pack, then tap the other.'],
    null, null, () => [{ type: 'combine', a: 'frosting', b: 'plain_cake' }]);
step('candles', flagged('candles_found'),
    ['A birthday cake wants candles. Where do kids keep little things?', 'Tiny raincoats on the coat rack in the foyer have pockets.', 'Tap the coat rack in the foyer.'],
    'foyer', 'f_coats', () => [go('foyer'), tap('f_coats')]);
step('bday', (G) => has(G, 'birthday_cake') || !!G.f.p_cake,
    ['The frosted cake and the candles are friends.', 'Combine the candles with the frosted cake.', 'Select the candles, then tap the frosted cake in your pack.'],
    null, null, () => [{ type: 'combine', a: 'frosted_cake', b: 'candles' }]);
step('card', flagged('card_found'),
    ['A party needs an invitation. Cards are shy things.', 'The grandfather clock in the foyer is hiding one.', 'Tap the grandfather clock.'],
    'foyer', 'f_clock', () => [go('foyer'), tap('f_clock')]);
step('quill', flagged('quill_taken'),
    ['Something to write with, in the library.', 'A pen sits on the library desk.', 'Tap the quill pen in the library.'],
    'library', 'l_quill', () => [go('library'), tap('l_quill')]);
step('ink', flagged('ink_taken'),
    ['A pen with no ink is just a feather.', 'The inkwell on the library desk.', 'Tap the inkwell in the library.'],
    'library', 'l_inkwell', () => [go('library'), tap('l_inkwell')]);
step('inkq', (G) => has(G, 'inked_quill') || has(G, 'invitation') || !!G.f.p_invite,
    ['Ink and a quill should get along.', 'Combine the ink with the quill in your pack.', 'Select the ink, then tap the quill.'],
    null, null, () => [{ type: 'combine', a: 'ink', b: 'quill' }]);
step('invite', (G) => has(G, 'invitation') || !!G.f.p_invite,
    ['The blank card is not blank for long.', 'Combine the inked quill with the blank card.', 'Select the inked quill, then tap the card.'],
    null, null, () => [{ type: 'combine', a: 'inked_quill', b: 'card' }]);
step('p_cake', flagged('p_cake'),
    ['The ballroom has a long table.', 'Put the birthday cake on the long table in the ballroom.', 'Select the cake, then tap the long table.'],
    'ballroom', 'b_table', () => [go('ballroom'), use('birthday_cake', 'b_table')]);
step('p_banner', flagged('p_banner'),
    ['The ballroom wall is bare.', 'Hang the streamers on the bare wall in the ballroom.', 'Select the streamers, then tap the bare wall.'],
    'ballroom', 'b_banner', () => [go('ballroom'), use('streamers', 'b_banner')]);
step('p_music', flagged('p_music'),
    ['A party needs music.', 'The music box goes on the pedestal in the ballroom.', 'Select the music box, then tap the pedestal.'],
    'ballroom', 'b_stand', () => [go('ballroom'), use('music_box', 'b_stand')]);
step('p_invite', flagged('p_invite'),
    ['Every party needs a welcome.', 'Put the invitation on the easel in the ballroom.', 'Select the invitation, then tap the easel.'],
    'ballroom', 'b_easel', () => [go('ballroom'), use('invitation', 'b_easel')]);

export const PLAN = STEPS;

/** The first step not yet done, or null when the party is on. */
export const firstPending = (G) => STEPS.find((s) => !s.done(G)) || null;

export const hintText = (s, G, level) => {
    const t = s.hint[Math.min(level, 3) - 1];
    return typeof t === 'function' ? t(G) : t;
};
