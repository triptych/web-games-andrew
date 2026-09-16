// ============================================================
// data/knacks.js - the 24 Knacks (GDD §20.2). APPEND ONLY.
// `weightBy` names the play-style counter that biases the draw.
// ============================================================

const k = (key, name, blurb, weightBy, mods = {}) => ({ key, name, blurb, weightBy, mods });

export const KNACKS = {
  hedge_sense: k('hedge_sense', 'Hedge-sense', 'Forage yields one more, and forageables show on the minimap within 12.', 'forage', { forage: 1, forageSight: 12 }),
  low_step: k('low_step', 'Low step', 'Diagonal movement costs the same as orthogonal.', 'explore', { cheapDiagonal: true }),
  steady_hands: k('steady_hands', 'Steady hands', 'Tool charges come back on their own, one per 40 turns, anywhere.', 'tools', { toolRegen: 40 }),
  wick_thrift: k('wick_thrift', 'Wick-thrift', 'Your lantern burns a quarter slower.', 'explore', { oilRate: 0.75 }),
  good_ear: k('good_ear', 'Good ear', 'You hear monsters through walls within 8.', 'stealth', { hearWalls: 8 }),
  kind_word: k('kind_word', 'Kind word', 'Gifts are worth half again as much to the people you give them to.', 'social', { giftMult: 1.5 }),
  butcher: k('butcher', 'Butcher', 'Monsters leave one more reagent than they meant to.', 'kills', { extraReagent: 1 }),
  deep_pockets: k('deep_pockets', 'Deep pockets', 'Carry eight more.', 'explore', { carry: 8 }),
  second_wind: k('second_wind', 'Second wind', 'Once per descent, at 0 HP, you stay up with 1.', 'kills', { secondWind: true }),
  cartwright: k('cartwright', 'Cartwright', 'Hearth-travel costs no oil and half the time.', 'explore', { cheapTravel: true }),
  quiet_boots: k('quiet_boots', 'Quiet boots', 'You are harder to hear by 3.', 'stealth', { stealth: 3 }),
  first_strike: k('first_strike', 'First strike', 'The first blow against an unaware target does half again as much.', 'stealth', { unaware: 0.5 }),
  hearthwise: k('hearthwise', 'Hearthwise', 'Resting at a hearth also clears one status.', 'social', { hearthClears: 1 }),
  long_sight: k('long_sight', 'Long sight', 'Your lantern reaches one tile further.', 'explore', { light: 1 }),
  stone_stomach: k('stone_stomach', 'Stone stomach', 'Food fills you half again as long, and bad tonics wear off twice as fast.', 'forage', { nutrition: 1.5, tonicShrug: true }),
  practical: k('practical', 'Practical', 'Repairs cost half.', 'social', { repairCost: 0.5 }),
  namekeeper: k('namekeeper', 'Namekeeper', 'The Quiet takes twice as long to make you forget. Name-damage is halved.', 'quiet', { resistName: 0.5 }),
  rope_hand: k('rope_hand', 'Rope hand', 'Grapple pulls cost 60 energy instead of 100.', 'tools', { grappleCheap: true }),
  ledgerer: k('ledgerer', 'Ledgerer', 'Quests pay a fifth more, and the journal shows exact distances.', 'quests', { questPay: 1.2, exactDist: true }),
  woodsman: k('woodsman', 'Woodsman', 'Rough ground costs 20 less to cross.', 'explore', { roughDiscount: 20 }),
  well_met: k('well_met', 'Well met', 'Everyone starts ten points warmer to you.', 'social', { startDisposition: 10 }),
  cool_head: k('cool_head', 'Cool head', 'Statuses on you end one turn sooner.', 'kills', { statusShorten: 1 }),
  scavenger: k('scavenger', 'Scavenger', 'Containers hold one more thing than they were going to.', 'explore', { extraLoot: 1 }),
  hard_won: k('hard_won', 'Hard-won', 'Two more max HP per level from here on, and you heal at a hearth twice as fast.', 'kills', { hpPerLevel: 2, hearthRegen: 2 }),
};
for (const key of Object.keys(KNACKS)) Object.freeze(KNACKS[key]);
Object.freeze(KNACKS);

export const KNACK_KEYS = Object.freeze(Object.keys(KNACKS));
