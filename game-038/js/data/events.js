// ============================================================
// data/events.js - field vignettes (GDD 12)
// Small things that happen when you explore. Some are just weather; some
// ask you something. `when` gates them, `effects` are resolved by
// game/world.js so an event can never do something an item could not.
// ============================================================

export const VIGNETTES = [
  { id: 'v_shed_scale', weight: 10,
    text: 'A shed scale the size of a dinner plate, still warm on the underside. Something big came through here not long ago.',
    choices: [{ text: 'Take it.', effects: { items: { scale_shard: 2 } } }] },

  { id: 'v_old_line', weight: 6, regions: ['vale', 'cinder'],
    text: 'The ground here is scorched in a line so straight it looks surveyed. Nothing grows on it. Your dragons will not walk on it either.',
    choices: [
      { text: 'Follow it a while.', effects: { items: { ley_crystal: 1 }, bond: 2 } },
      { text: 'Go round.', effects: {} },
    ] },

  { id: 'v_hungry', weight: 9,
    text: 'One of your dragons has found something dead and is making a case for eating it.',
    choices: [
      { text: 'Let it.', effects: { bond: 4, hpPct: -0.05 } },
      { text: 'Absolutely not.', effects: { bond: -1 } },
    ] },

  { id: 'v_shepherd', weight: 7, regions: ['vale', 'march'],
    text: 'A shepherd flags you down. She has been keeping a dragon off her flock with a stick and a great deal of shouting, and would like a better solution.',
    choices: [
      { text: 'Give her a binding.', requires: { item: 'rune_cord' }, effects: { take: { rune_cord: 1 }, coin: 90, bond: 2 } },
      { text: 'Offer to look at it later.', effects: {} },
    ] },

  { id: 'v_hot_spring', weight: 6,
    text: 'A pool of water warm enough to steam, in weather that does not justify it. There is a line under here somewhere.',
    choices: [{ text: 'Rest an hour.', effects: { healPct: 0.35, bond: 2 } }] },

  { id: 'v_ashfall', weight: 8, regions: ['cinder', 'spire'],
    text: 'Ash comes down for twenty minutes, fine and grey and warm. Everything tastes of it afterwards.',
    choices: [{ text: 'Wait it out under a ledge.', effects: { items: { ashsalt: 2 } } }] },

  { id: 'v_nest', weight: 5,
    text: 'An abandoned nest, lined with something that was expensive before it was a nest.',
    choices: [
      { text: 'Search it.', effects: { coin: 120, items: { sinew: 1 } } },
      { text: 'Leave it. Something may come back.', effects: { bond: 3 } },
    ] },

  { id: 'v_peddler', weight: 7,
    text: 'A peddler with a handcart, a great many opinions about the Concord, and one crate he keeps sitting on.',
    choices: [
      { text: 'Buy the crate. 200 coin.', requires: { coin: 200 }, effects: { coin: -200, mystery: true } },
      { text: 'Decline politely.', effects: {} },
    ] },

  { id: 'v_grey_sleeper', weight: 6,
    text: 'An ashbound dragon, asleep, grey as a hearthstone. It does not wake. Maerin wrote that they sleep more the further gone they are.',
    choices: [
      { text: 'Leave a Clearwater Draught beside it.', requires: { item: 'clearwater' }, effects: { take: { clearwater: 1 }, coin: 0, bond: 5, flag: 'kindness_grey' } },
      { text: 'Note the place and move on.', effects: {} },
    ] },

  { id: 'v_high_wind', weight: 6, regions: ['peaks'],
    text: 'The afternoon wind arrives on time and takes the conversation with it. You get under a rock and wait.',
    choices: [{ text: 'Wait.', effects: { items: { stormglass: 1 } } }] },

  { id: 'v_singing', weight: 5, regions: ['march'],
    text: 'Somebody is singing, badly, a long way off across the water. When you get to where it was, there is nobody, and the reeds are flat in a circle.',
    choices: [{ text: 'Sit in the flattened reeds a minute.', effects: { bond: 4, mpPct: 0.3 } }] },

  { id: 'v_furnace_crew', weight: 6, regions: ['cinder'],
    text: 'A furnace crew coming off shift, grey to the elbows, entirely uninterested in dragons as a topic.',
    choices: [
      { text: 'Buy the round.', requires: { coin: 60 }, effects: { coin: -60, items: { greater_salve: 1 } } },
      { text: 'Listen a while.', effects: {} },
    ] },
];

export const vignettesFor = (regionId) =>
  VIGNETTES.filter(v => !v.regions || v.regions.includes(regionId));
