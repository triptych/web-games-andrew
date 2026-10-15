// Items: things to use in or out of battle, things to wear, and things to carry for someone.
//
//   kind 'use'   consumable. heal (composure), ink, cure, flee
//   kind 'gear'  slot 'mark' (bookmark: focus), 'knit' (cardigan: poise + composure), 'charm'
//   kind 'up'    collected at once: Quilt Patch (+5 max composure), Inkwell (+4 max ink)
//   kind 'key'   quest and story items

export const ITEMS = {
    // ---------------------------------------------------------------- consumables
    tea:      { name: 'Chamomile Tea', kind: 'use', icon: 'cup', heal: 30, price: 12, text: 'Restores 30 composure. Best sipped slowly.' },
    biscuit:  { name: 'Honey Biscuit', kind: 'use', icon: 'biscuit', heal: 70, price: 30, text: 'Restores 70 composure. Crumbs are part of the experience.' },
    cocoa:    { name: 'Mug of Cocoa', kind: 'use', icon: 'mug', heal: 999, price: 90, text: 'Restores all composure. Marshmallows included.' },
    inkpot:   { name: 'Pot of Ink', kind: 'use', icon: 'ink', ink: 15, price: 20, text: 'Restores 15 ink.' },
    bigink:   { name: 'Bottle of Midnight Ink', kind: 'use', icon: 'ink2', ink: 40, price: 55, text: 'Restores 40 ink.' },
    sachet:   { name: 'Lavender Sachet', kind: 'use', icon: 'sachet', cure: true, heal: 10, price: 15, text: 'Clears muddles and smudges, and restores 10 composure.' },
    candle:   { name: 'Story Candle', kind: 'use', icon: 'candle', flee: true, price: 25, text: 'Light it and slip quietly out of any squabble (not guardians).' },
    jam:      { name: 'Jam Tart', kind: 'use', icon: 'tart', heal: 45, ink: 10, price: 40, text: 'Restores 45 composure and 10 ink. Strawberry.' },

    // ---------------------------------------------------------------- bookmarks (focus)
    ribbon:   { name: 'Ribbon Bookmark', kind: 'gear', slot: 'mark', icon: 'mark', focus: 2, price: 0, text: 'A faded red ribbon. Focus +2.' },
    leather:  { name: 'Leather Bookmark', kind: 'gear', slot: 'mark', icon: 'mark', focus: 5, price: 80, text: 'Stamped with a little owl. Focus +5.' },
    pressed:  { name: 'Pressed-Flower Bookmark', kind: 'gear', slot: 'mark', icon: 'mark', focus: 9, price: 220, text: 'A violet, kept forever. Focus +9.' },
    silver:   { name: 'Silver Bookmark', kind: 'gear', slot: 'mark', icon: 'mark', focus: 14, price: 480, text: 'Engraved with the Aubade crest. Focus +14.' },
    moonsilk: { name: 'Moonsilk Bookmark', kind: 'gear', slot: 'mark', icon: 'mark', focus: 20, price: 900, text: 'Woven by moths on a clear night. Focus +20.' },
    quill:    { name: 'Phoenix Quill', kind: 'gear', slot: 'mark', icon: 'quill', focus: 26, price: 0, text: 'It writes in warm light. Focus +26.' },

    // ---------------------------------------------------------------- cardigans (poise, composure)
    wool:     { name: 'Wool Cardigan', kind: 'gear', slot: 'knit', icon: 'knit', poise: 1, hp: 0, price: 0, text: 'Elbow patches, naturally. Poise +1.' },
    patchwork:{ name: 'Patchwork Cardigan', kind: 'gear', slot: 'knit', icon: 'knit', poise: 3, hp: 8, price: 90, text: 'Every square from a different jumper. Poise +3, composure +8.' },
    tweed:    { name: 'Tweed Coat', kind: 'gear', slot: 'knit', icon: 'knit', poise: 6, hp: 16, price: 260, text: 'Smells faintly of pipe smoke and rain. Poise +6, composure +16.' },
    shawl:    { name: 'Snowfox Shawl', kind: 'gear', slot: 'knit', icon: 'knit', poise: 9, hp: 26, price: 520, text: 'Impossibly soft. Poise +9, composure +26.' },
    starweave:{ name: 'Starweave Robe', kind: 'gear', slot: 'knit', icon: 'knit', poise: 13, hp: 40, price: 980, text: 'The night sky, sewn up. Poise +13, composure +40.' },

    // ---------------------------------------------------------------- charms
    glasses:  { name: 'Reading Glasses', kind: 'gear', slot: 'charm', icon: 'glasses', price: 120, text: 'Read never takes your turn, and Shush lands a little truer.' },
    acorn:    { name: 'Lucky Acorn', kind: 'gear', slot: 'charm', icon: 'acorn', price: 150, text: 'Calmed foes leave half again as many coins.' },
    teacup:   { name: 'Teacup Charm', kind: 'gear', slot: 'charm', icon: 'cup', price: 200, text: 'Teas, biscuits and cocoa restore half again as much.' },
    quillpin: { name: 'Quill Pin', kind: 'gear', slot: 'charm', icon: 'quill', price: 260, text: 'Restores 2 ink at the start of each of your turns.' },
    locket:   { name: 'Hearth Locket', kind: 'gear', slot: 'charm', icon: 'locket', price: 340, text: 'Composure +30.' },
    owl:      { name: 'Owl Feather', kind: 'gear', slot: 'charm', icon: 'feather', price: 180, text: 'Slipping away always works, and wandering foes notice you later.' },
    compass:  { name: 'Wanderer\'s Compass', kind: 'gear', slot: 'charm', icon: 'compass', price: 0, text: 'You walk a little quicker. A gift from the Maps shelf.' },
    musicbox: { name: 'Little Music Box', kind: 'gear', slot: 'charm', icon: 'box', price: 0, text: 'Every turn, you and Wick recover 4 composure. A gift from the Songbooks.' },

    // ---------------------------------------------------------------- upgrades (taken at once)
    patch:    { name: 'Quilt Patch', kind: 'up', icon: 'patch', text: 'Sewn into your cardigan: maximum composure +5.' },
    inkwell:  { name: 'Silver Inkwell', kind: 'up', icon: 'inkwell', text: 'Maximum ink +4.' },

    // ---------------------------------------------------------------- key items
    libkey:   { name: 'Library Key', kind: 'key', icon: 'key', text: 'Heavy, brass, and warm. The Lantern Library\'s front door.' },
    flour:    { name: 'Sack of Flour', kind: 'key', icon: 'sack', text: 'From Hearthfield Mill, for Bramwell the baker.' },
    letter:   { name: 'Sealed Letter', kind: 'key', icon: 'letter', text: 'For the lighthouse keeper in Saltmere, from her sister in Quillford.' },
    reply:    { name: 'Letter in Reply', kind: 'key', icon: 'letter', text: 'Salt-stained, for Hattie in Quillford.' },
    cheese:   { name: 'Wheel of Starlight Cheese', kind: 'key', icon: 'cheese', text: 'Pale and faintly glowing. The mice will want this.' },
    poem:     { name: 'Knight\'s Lost Poem', kind: 'key', icon: 'scroll', text: 'Sir Percival\'s verse for the court bard. It rhymes "lance" with "romance".' },
    scarf:    { name: 'Knitted Scarf', kind: 'key', icon: 'scarf', text: 'Very long, very red. For a snowman who looks cold.' },
    pearl:    { name: 'Moon Pearl', kind: 'key', icon: 'pearl', text: 'Found in the lake. The Queen collects these.' },
    seeds:    { name: 'Glass-Flower Seeds', kind: 'key', icon: 'seeds', text: 'For Old Fennimore\'s garden in the Downs.' },
    lens:     { name: 'Star Lens', kind: 'key', icon: 'lens', text: 'For the hermit\'s telescope in Skyreach.' },
    bellrope: { name: 'Bell Rope', kind: 'key', icon: 'rope', text: 'For the Abbey\'s silent bell.' },
    teaset:   { name: 'Marigold\'s Teapot', kind: 'key', icon: 'pot', text: 'Chipped, painted with marigolds. Found in the Undercroft.' },
};

// Dungeon keys are counted per dungeon (G.keys[dungeon]); they never leave their dungeon.
export const SLOTS = { mark: 'Bookmark', knit: 'Cardigan', charm: 'Charm' };

export const SHOPS = {
    quill_general: { name: 'Pip\'s Provisions', stock: ['tea', 'biscuit', 'inkpot', 'sachet', 'candle'] },
    quill_tailor:  { name: 'Mabel\'s Woollens', stock: ['patchwork', 'tweed', 'leather'] },
    aub_station:   { name: 'Royal Stationers', stock: ['leather', 'pressed', 'silver', 'inkpot', 'bigink'] },
    aub_curio:     { name: 'The Curio Cabinet', stock: ['glasses', 'acorn', 'teacup', 'owl', 'candle'] },
    aub_general:   { name: 'Aubade Market', stock: ['tea', 'biscuit', 'jam', 'inkpot', 'sachet'] },
    salt_market:   { name: 'Saltmere Fish & Sundries', stock: ['tea', 'biscuit', 'jam', 'bigink', 'cocoa'] },
    salt_curio:    { name: 'Driftwood Curios', stock: ['quillpin', 'locket', 'tweed', 'pressed'] },
    frost_lodge:   { name: 'Frostmantle Lodge', stock: ['cocoa', 'biscuit', 'shawl', 'bigink'] },
    mouse_shop:    { name: 'The Thimble Shop', stock: ['moonsilk', 'jam', 'cocoa', 'locket', 'quillpin'] },
    moor_witch:    { name: 'Granny Nettle\'s Cauldron', stock: ['sachet', 'bigink', 'jam', 'candle', 'starweave'] },
};

export const sellPrice = (id) => Math.floor((ITEMS[id]?.price || 0) / 2);
