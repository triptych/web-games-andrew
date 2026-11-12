// HOLLOWDEEP — the town of Brindlemoor, its people, and the quests they give. Pure data.

export const TOWN = { name: 'Brindlemoor' };

// places on the town square; `npc` is who you meet there. `art` is the fal prompt of the backdrop.
export const PLACES = {
    square: { name: 'Brindlemoor Square', art: 'a small medieval mountain town square at dusk, timber-framed houses with warm lit windows, a stone well, lanterns on poles, and in the distance a dark cave mouth in the cliffside with an iron gate' },
    inn: { name: 'The Last Lantern Inn', npc: 'marta', art: 'the cosy common room of a medieval inn, a roaring stone hearth, wooden beams hung with dried herbs, a staircase up to the rooms, candlelight' },
    shop: { name: 'Odo\'s Provisions', npc: 'odo', art: 'a cluttered fantasy general store interior, shelves of potions in coloured bottles, swords and shields on the wall, barrels, a wooden counter with scales' },
    guild: { name: 'Adventurers\' Guild', npc: 'varga', art: 'the hall of an adventurers\' guild, long oak tables, a wall of notices and wanted posters, mounted monster heads and crossed weapons, banners' },
    temple: { name: 'Temple of the Dawn', npc: 'elowen', art: 'the interior of a small stone temple with tall stained-glass windows casting golden morning light, rows of candles and a white marble altar' },
    tavern: { name: 'The Rusty Flagon', npc: 'pell', art: 'a lively dim tavern with a long bar, tankards, a bard\'s lute by the fire, a cork board pinned with quest notes and maps' },
    gate: { name: 'The Hollowdeep Gate', npc: 'ansel', art: 'the entrance of a great dungeon carved into a cliff, a huge iron portcullis, torches, carved stone guardians either side, and a ring of glowing blue warp stones on the ground before it' },
};

export const NPCS = {
    marta: { name: 'Marta', role: 'Innkeeper', art: 'a plump cheerful middle-aged innkeeper woman with rosy cheeks, grey-streaked hair in a bun and an apron, holding a tankard',
        lines: ['A bed, a bath, a hot meal. The dungeon will still be there in the morning, more\'s the pity.', 'You look half dead. Sit. Eat.', 'My Tomas went down in the third year. Mind you come back up.'] },
    odo: { name: 'Odo', role: 'Merchant', art: 'a round-faced bald halfling merchant with a curled moustache, a monocle and a green waistcoat with many pockets',
        lines: ['Everything a delver needs, and a few things they don\'t!', 'Bring me what you find down there. I pay fair. Mostly.', 'Deeper you go, the better my stock gets. Funny how that works.'] },
    varga: { name: 'Guildmaster Varga', role: 'Adventurers\' Guild', art: 'a tough one-eyed retired adventurer woman in her fifties with an eyepatch, cropped silver hair and a leather coat with a guild badge',
        lines: ['Nobody goes down there alone. Not twice.', 'The board\'s full of folk who want to fight. Pick the ones who\'ll stand when it counts.', 'Five of you. Three up front, two behind. That\'s how we\'ve always done it.'] },
    elowen: { name: 'Sister Elowen', role: 'Temple of the Dawn', art: 'a serene young priestess with dark skin, kind eyes and a white hood with a golden sunburst embroidered on it',
        lines: ['The Dawn does not abandon those who walk in darkness.', 'Bring me the fallen. While their name is spoken, they can return.', 'Something below is calling the dead. I hear it at night.'] },
    pell: { name: 'Pell', role: 'Tavern Keeper', art: 'a lanky young bard and tavern keeper with tousled ginger hair, freckles, a feathered cap and a lute on his back',
        lines: ['Work on the board, ale at the bar, songs on the house.', 'Every delver who comes back is a new verse. Give me a good one.', 'They say there\'s a king at the bottom. They say there isn\'t a bottom.'] },
    ansel: { name: 'Old Ansel', role: 'Gatewarden', art: 'a very old bearded gatekeeper in a patched grey cloak with a lantern and a staff set with a glowing blue warp stone',
        lines: ['Down you go, then. Light your lantern.', 'Beat a guardian and the warp stones remember it. I can send you past what you\'ve conquered.', 'Forty years at this gate. The stones hum louder every year.'] },
};

// Story quests: given by a person in town, in order. `need` is a quest id that must be turned in first.
//   kind: 'slay' (a guardian), 'fetch' (an item placed on a floor), 'reach' (a floor), 'rescue' (a person on a floor)
// The rescued and the rewards are real: a rescued delver can be recruited for free.
export const STORY = [
    { id: 's_knight', npc: 'ansel', kind: 'slay', floor: 5, title: 'The Knight of Bones', gold: 300, item: 'vigor_ring',
        text: 'Something in armour stands on the fifth floor and lets no one past. Put it down, and the warp stone will open the way to the sixth.' },
    { id: 's_locket', npc: 'marta', kind: 'fetch', floor: 3, item_q: 'locket', title: 'Marta\'s Locket', gold: 150, item: 'potion', count: 3,
        text: 'My Tomas wore a silver locket. If it\'s anywhere, it\'s on the third floor, where they found his lantern.' },
    { id: 's_moon', npc: 'elowen', kind: 'fetch', floor: 8, item_q: 'moonpetal', title: 'The Moonpetal', gold: 400, item: 'phoenix', count: 2, need: 's_knight',
        text: 'A flower grows in the grotto that holds back the sleeping sickness. I need one petal. Floor eight, near the water.' },
    { id: 's_rescue', npc: 'varga', kind: 'rescue', floor: 7, title: 'Lost Delver', gold: 350, rescue: true, need: 's_knight',
        text: 'One of mine went down alone, the fool. Floor seven. Bring her back breathing and she\'ll owe you a sword arm.' },
    { id: 's_myc', npc: 'ansel', kind: 'slay', floor: 10, title: 'The Spore Mother', gold: 800, item: 'ward_amulet', need: 's_knight',
        text: 'The grotto has a queen. Her spores put whole parties to sleep for good. End her.' },
    { id: 's_map', npc: 'pell', kind: 'fetch', floor: 12, item_q: 'old_map', title: 'The Cartographer\'s Map', gold: 900, item: 'hipotion', count: 3, need: 's_myc',
        text: 'A mapmaker drowned in the flooded halls with the only good map of them. Find it and I\'ll write you a song.' },
    { id: 's_lev', npc: 'ansel', kind: 'slay', floor: 15, title: 'Below the Waves', gold: 1500, item: 'sage_ring', need: 's_myc',
        text: 'There is something huge in the drowned halls. The water moves when it breathes.' },
    { id: 's_iron', npc: 'odo', kind: 'fetch', floor: 18, item_q: 'star_iron', title: 'Star Iron', gold: 1800, item: 'lucky_coin', need: 's_lev',
        text: 'The old dwarves smelted star iron down in their foundry. Bring me a lump and I\'ll make you a rich delver.' },
    { id: 's_forge', npc: 'ansel', kind: 'slay', floor: 20, title: 'The Forgefather', gold: 3000, item: 'war_band', need: 's_lev',
        text: 'The dwarves built a king to rule their forge. It is still ruling.' },
    { id: 's_banner', npc: 'varga', kind: 'fetch', floor: 23, item_q: 'war_banner', title: 'The Lost Banner', gold: 3200, item: 'elixir', count: 1, need: 's_forge',
        text: 'The Silver Company froze in the ossuary twenty years ago. Bring their banner home.' },
    { id: 's_lich', npc: 'ansel', kind: 'slay', floor: 25, title: 'The Winter Lich', gold: 5000, item: 'guard_amulet', need: 's_forge',
        text: 'It\'s the lich that calls the dead. Sister Elowen hears it. Silence it.' },
    { id: 's_relic', npc: 'elowen', kind: 'fetch', floor: 28, item_q: 'relic', title: 'The Saint\'s Relic', gold: 5200, item: 'elixir', count: 2, need: 's_lich',
        text: 'Saint Amara carried her relic into the thornwood and never came out. The Dawn wants it home.' },
    { id: 's_briar', npc: 'ansel', kind: 'slay', floor: 30, title: 'The Elder Briar', gold: 8000, item: 'lantern_heart', need: 's_lich',
        text: 'The roots of the whole dungeon run back to one tree. Fell it.' },
    { id: 's_box', npc: 'pell', kind: 'fetch', floor: 33, item_q: 'music_box', title: 'Three Notes', gold: 8500, item: 'elixir', count: 2, need: 's_briar',
        text: 'My grandmother\'s music box went into the vault with my grandfather. I\'d like to hear the rest of the song.' },
    { id: 's_orrery', npc: 'ansel', kind: 'slay', floor: 35, title: 'The Orrery Engine', gold: 12000, item: 'star_crown', need: 's_briar',
        text: 'Someone built a machine to count the stars down there. It counts us now.' },
    { id: 's_king', npc: 'ansel', kind: 'slay', floor: 40, title: 'The Hollow King', gold: 20000, item: 'elixir', count: 5, need: 's_orrery',
        text: 'At the bottom of the Sanctum sits a king with no face. Ask him what\'s below. Then kill him.' },
];

// Bounties on Pell's board: generated from these templates for the floors the party has reached (sim/quests.js)
export const BOUNTY_KINDS = ['hunt', 'hunt', 'delve', 'fetch', 'rescue'];
