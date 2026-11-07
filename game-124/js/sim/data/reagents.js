// The things that grow, wash up and glitter on Hum. What each one carries is the seed's business
// (laws.js); this table is only what they are called, where they are found and how they look.

export const REAGENTS = {
    seaglass: { name: 'Sea Glass', region: 'shore', model: 'shard', blurb: 'A pebble of frosted glass, worn soft by the sea.' },
    kelp: { name: 'Bladderwrack', region: 'shore', model: 'kelp', blurb: 'A rubbery frond of seaweed with little air bladders.' },
    cowrie: { name: 'Moon Cowrie', region: 'shore', model: 'shell', blurb: 'A glossy shell that seems to hold a little light.' },
    ghostcap: { name: 'Ghostcap', region: 'wood', model: 'mushroom', blurb: 'A pale mushroom that grows where nothing else will.' },
    feather: { name: 'Owl Feather', region: 'wood', model: 'feather', blurb: 'Barred brown and white, and utterly silent in the hand.' },
    resin: { name: 'Resin Tear', region: 'wood', model: 'drop', blurb: 'A bead of pine resin, gone hard and amber.' },
    fenpearl: { name: 'Fen Pearl', region: 'fen', model: 'pearl', blurb: 'A yellow bead that forms around the hot springs.' },
    myrtle: { name: 'Bog Myrtle', region: 'fen', model: 'sprig', blurb: 'A sticky shrub that smells of resin and honey.' },
    quartz: { name: 'Quartz Shard', region: 'moor', model: 'crystal', blurb: 'A clear crystal knocked loose from the moor stones.' },
    heather: { name: 'Heather Sprig', region: 'moor', model: 'heather', blurb: 'Tough purple heather from the high moor.' },
};
export const REAGENT_IDS = Object.keys(REAGENTS);

// Food and other things that are not magic.
export const ITEMS = {
    berries: { name: 'Bramble Berries', food: 14, blurb: 'Sweet and a little sour.' },
    clam: { name: 'Raw Clam', food: 4, cook: 'clamcooked', blurb: 'Better cooked. Much better cooked.' },
    clamcooked: { name: 'Roast Clam', food: 26, blurb: 'Salty, smoky and warm.' },
    chanterelle: { name: 'Chanterelle', food: 6, cook: 'chanterellecooked', blurb: 'A golden mushroom that smells of apricots.' },
    chanterellecooked: { name: 'Fried Chanterelle', food: 22, blurb: 'Buttery, even without butter.' },
    driftwood: { name: 'Driftwood', blurb: 'Bleached and dry. It will burn.' },
};
