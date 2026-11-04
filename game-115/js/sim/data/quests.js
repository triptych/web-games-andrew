// Expeditions: the places heroes go, and the jobs on offer there.

export const REGIONS = {
    woods: { name: 'Whispering Woods', icon: '🌲', guild: 1, dist: 1.0, tint: '#7bb661', desc: 'Close to home, gentle, full of berries and rabbits.' },
    quarry: { name: 'Old Quarry Ruins', icon: '🏚️', guild: 1, dist: 1.2, tint: '#a8a29a', desc: 'Abandoned workings: stone, ore and the occasional bandit.' },
    marsh: { name: 'Misty Marsh', icon: '🌫️', guild: 2, dist: 1.5, tint: '#6aa59c', desc: 'Reeds, fish and strange lights.' },
    caves: { name: 'Glimmer Caves', icon: '💎', guild: 3, dist: 1.8, tint: '#8a7bd6', desc: 'Veins of crystal and something that growls.' },
    ruins: { name: 'Sunken Ruins', icon: '🏛️', guild: 3, dist: 2.1, tint: '#5b8fc0', desc: 'A drowned city, full of relics and guardians.' },
    frost: { name: 'Frostpeak Pass', icon: '🏔️', guild: 4, dist: 2.5, tint: '#bcd9ea', desc: 'Howling wind, thick pelts and a very large yeti.' },
    roost: { name: "Cinderwing's Roost", icon: '🐉', guild: 5, dist: 3.0, tint: '#e0703a', desc: 'The mountain where the old dragon sleeps on her hoard.' },
};

const d = (item, chance, n) => ({ item, chance, n });

// kind: gather | hunt | escort | explore | delivery | boss.   need: party power. dur: seconds.
export const QUEST_TEMPLATES = [
    // woods
    { id: 'w_berries', region: 'woods', kind: 'gather', name: 'Forage for Berries', text: 'The brambles are heavy with fruit.', need: [12, 18], dur: [50, 70], slots: 1, gold: [6, 12], drops: [d('berry', 1, [3, 5]), d('herb', 0.5, [1, 3]), d('mushroom', 0.4, [1, 2])] },
    { id: 'w_rabbits', region: 'woods', kind: 'hunt', name: 'Hunt Rabbits', text: 'The garden raiders must go.', need: [16, 24], dur: [60, 80], slots: 1, gold: [10, 16], drops: [d('meat', 0.9, [1, 2]), d('hide', 0.5, [1, 1])] },
    { id: 'w_deadwood', region: 'woods', kind: 'gather', name: 'Gather Deadwood', text: 'A storm brought down half a grove.', need: [14, 20], dur: [55, 75], slots: 1, gold: [6, 10], drops: [d('wood', 1, [5, 9]), d('fiber', 0.6, [2, 4])] },
    { id: 'w_peddler', region: 'woods', kind: 'escort', name: 'Escort the Peddler', text: 'A nervous peddler needs company on the road.', need: [22, 34], dur: [70, 95], slots: 2, gold: [22, 34], renown: 1, drops: [d('cloth', 0.4, [1, 2])] },
    { id: 'w_wolves', region: 'woods', kind: 'hunt', name: 'Wolf Den', text: 'Something has been howling at the sheep.', need: [30, 40], dur: [80, 105], slots: 2, gold: [25, 40], drops: [d('hide', 0.8, [1, 3]), d('meat', 0.8, [1, 3])] },
    // quarry
    { id: 'q_scavenge', region: 'quarry', kind: 'explore', name: 'Scavenge the Ruins', text: 'Old walls hide old tools.', need: [28, 38], dur: [75, 100], slots: 1, gold: [15, 25], drops: [d('stone', 1, [5, 10]), d('ore', 0.5, [1, 3])] },
    { id: 'q_tunnel', region: 'quarry', kind: 'gather', name: 'Clear the Collapsed Tunnel', text: 'Pick, shovel, patience.', need: [36, 50], dur: [90, 115], slots: 2, gold: [20, 35], drops: [d('ore', 1, [3, 6]), d('coal', 0.8, [2, 4]), d('gem', 0.05, [1, 1])] },
    { id: 'q_bandits', region: 'quarry', kind: 'hunt', name: 'Bandit Camp', text: 'They have been "taxing" the road.', need: [50, 70], dur: [100, 130], slots: 2, gold: [40, 70], renown: 1, drops: [d('relic', 0.05, [1, 1]), d('ore', 0.4, [1, 2]), d('gem', 0.07, [1, 1])] },
    { id: 'q_coal', region: 'quarry', kind: 'gather', name: 'Coal Seam Survey', text: 'Black rock, warm winters.', need: [32, 45], dur: [80, 105], slots: 1, gold: [14, 22], drops: [d('coal', 1, [4, 8]), d('ore', 0.6, [1, 3])] },
    // marsh
    { id: 'm_reeds', region: 'marsh', kind: 'gather', name: 'Reed Harvest', text: 'Good for rope and for cloth.', need: [50, 62], dur: [90, 110], slots: 2, gold: [24, 36], drops: [d('fiber', 1, [4, 8]), d('herb', 0.8, [2, 4]), d('egg', 0.5, [1, 3])] },
    { id: 'm_bog', region: 'marsh', kind: 'gather', name: 'Fishing the Bog', text: 'The fish here glow a little.', need: [55, 70], dur: [90, 115], slots: 2, gold: [26, 40], drops: [d('fish', 1, [4, 8]), d('mushroom', 0.6, [2, 4])] },
    { id: 'm_witch', region: 'marsh', kind: 'delivery', name: "The Witch's Request", text: 'She wants two healing potions and will pay for them.', need: [60, 75], dur: [90, 120], slots: 2, gold: [90, 120], renown: 2, req: { heal_potion: 2 }, drops: [d('mushroom', 1, [3, 5]), d('relic', 0.1, [1, 1])] },
    { id: 'm_beast', region: 'marsh', kind: 'hunt', name: 'Bog Beast', text: 'It has eaten two boats.', need: [85, 110], dur: [120, 150], slots: 3, gold: [70, 110], renown: 1, drops: [d('hide', 0.9, [2, 4]), d('relic', 0.08, [1, 1]), d('gem', 0.1, [1, 1])] },
    { id: 'm_caravan', region: 'marsh', kind: 'escort', name: 'Lost Caravan', text: 'They took a wrong turn about a week ago.', need: [70, 90], dur: [110, 140], slots: 2, gold: [80, 120], renown: 1, drops: [d('cloth', 0.6, [1, 3])] },
    // caves
    { id: 'c_veins', region: 'caves', kind: 'gather', name: 'Crystal Veins', text: 'They hum if you tap them.', need: [90, 120], dur: [110, 140], slots: 2, gold: [50, 80], drops: [d('gem', 0.6, [1, 2]), d('ore', 1, [3, 6])] },
    { id: 'c_delve', region: 'caves', kind: 'explore', name: 'Deep Delve', text: 'Down, and then further down.', need: [120, 150], dur: [130, 165], slots: 3, gold: [110, 160], renown: 1, drops: [d('gem', 0.8, [1, 3]), d('relic', 0.12, [1, 1])] },
    { id: 'c_troll', region: 'caves', kind: 'hunt', name: 'Cave Troll', text: 'It guards the best crystals and hates visitors.', need: [150, 190], dur: [150, 180], slots: 3, gold: [140, 200], renown: 2, drops: [d('gem', 1, [2, 3]), d('hide', 0.6, [1, 3])] },
    { id: 'c_miners', region: 'caves', kind: 'escort', name: "Miners' Rescue", text: 'A shaft has closed behind four miners.', need: [100, 130], dur: [120, 150], slots: 2, gold: [100, 150], renown: 2, drops: [d('ore', 0.8, [2, 5])] },
    // ruins
    { id: 'r_library', region: 'ruins', kind: 'explore', name: 'The Sunken Library', text: 'Damp, silent and full of books.', need: [150, 190], dur: [140, 170], slots: 3, gold: [120, 180], renown: 1, drops: [d('relic', 0.35, [1, 1]), d('lore', 1, [3, 6])] },
    { id: 'r_vault', region: 'ruins', kind: 'explore', name: 'Treasure Vault', text: 'The door has been open for a thousand years. Nobody went in.', need: [200, 250], dur: [160, 190], slots: 3, gold: [200, 320], renown: 2, drops: [d('gem', 0.9, [2, 4]), d('relic', 0.3, [1, 2])] },
    { id: 'r_guard', region: 'ruins', kind: 'hunt', name: 'Ghostly Guardians', text: 'Polite ghosts. Persistent ones.', need: [230, 290], dur: [170, 200], slots: 4, gold: [220, 340], renown: 2, drops: [d('relic', 0.5, [1, 2]), d('gem', 0.5, [1, 2])] },
    { id: 'r_feast', region: 'ruins', kind: 'delivery', name: "The Keeper's Supper", text: "The Keeper has not had apple pie since the flood.", need: [180, 220], dur: [140, 170], slots: 3, gold: [250, 330], renown: 3, req: { apple_pie: 3 }, drops: [d('relic', 0.6, [1, 2]), d('lore', 1, [4, 8])] },
    // frost
    { id: 'f_pelts', region: 'frost', kind: 'hunt', name: 'Pelt Hunt', text: 'Warm coats, cold work.', need: [250, 320], dur: [170, 200], slots: 3, gold: [220, 300], renown: 1, drops: [d('pelt', 1, [2, 4]), d('meat', 0.9, [2, 4])] },
    { id: 'f_pass', region: 'frost', kind: 'escort', name: 'Avalanche Pass', text: 'The pass is open for exactly one afternoon.', need: [300, 370], dur: [170, 200], slots: 3, gold: [300, 400], renown: 2, drops: [d('pelt', 0.5, [1, 2])] },
    { id: 'f_yeti', region: 'frost', kind: 'hunt', name: "The Yeti's Lair", text: 'Bring more than one sword.', need: [380, 450], dur: [200, 230], slots: 4, gold: [380, 500], renown: 3, drops: [d('pelt', 1, [3, 5]), d('gem', 0.8, [1, 3]), d('relic', 0.3, [1, 2])] },
    { id: 'f_shrine', region: 'frost', kind: 'explore', name: 'The Frozen Shrine', text: 'Ice, quiet and something shining inside it.', need: [320, 400], dur: [190, 220], slots: 3, gold: [260, 360], renown: 2, drops: [d('relic', 0.6, [1, 2]), d('gem', 1, [1, 2])] },
];

export const BOSS = {
    id: 'b_dragon', region: 'roost', kind: 'boss', name: "Cinderwing's Roost", text: 'The old dragon has circled the valley for a hundred years. Tonight she lands.',
    need: 540, dur: 260, slots: 4, gold: 3000, renown: 25, req: { harvest_feast: 2 }, drops: [d('relic', 1, [3, 3]), d('gem', 1, [8, 8])],
};
