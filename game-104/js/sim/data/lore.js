// Herbs, potions, recipes and spells. Herbs and potions share one table (STOCK): the satchel
// holds counts of them. Deadly plants are only deadly when swallowed.

export const STOCK = {
    // ---- the garden and the cottage
    yarrow: {
        kind: 'herb', name: 'yarrow', names: ['yarrow', 'milfoil', 'woundwort'], pick: 2,
        look: 'Flat heads of tiny white flowers over feathery, grey-green leaves.',
        smell: 'Sharp and green, with a little pepper in it, like rain on a hot road.',
        taste: 'Bitter and drying. Your tongue puckers and your eyes water.',
        lore: 'YARROW, soldier\'s woundwort. Bruised leaves stanch a bleeding wound. Marga calls it every hedge witch\'s first friend.',
    },
    plantain: {
        kind: 'herb', name: 'plantain', names: ['plantain', 'healing leaf', 'ribwort'], pick: 2,
        look: 'Broad, ribbed leaves flat to the ground, trodden by every boot in the parish.',
        smell: 'Faintly of mushroom and cut grass.',
        taste: 'Green and slightly slimy; it leaves your mouth feeling oddly cool.',
        lore: 'PLANTAIN, the healing leaf. Draws out splinters and thorns and soothes a cut. A weed to the farmer, a treasure to the witch.',
    },
    rue: {
        kind: 'herb', name: 'rue', names: ['rue', 'herb of grace'], pick: 2,
        look: 'Blue-grey, three-lobed leaves on a woody stem, with small yellow flowers.',
        smell: 'Acrid and bitter. It smells like a warning.',
        taste: 'Foul. Your lips begin to sting at once. (Not in quantity, then.)',
        lore: 'RUE, the herb of grace. Wards what is foul, slows a racing pulse, and is the proper offering for the dead. It blisters the skin if you handle it carelessly.',
    },
    sage: {
        kind: 'herb', name: 'sage', names: ['sage'], pick: 2,
        look: 'Soft grey-green leaves like the ears of a small, sleepy animal.',
        smell: 'Warm, dusty and clean: the smell of a room after a sickness has left it.',
        taste: 'Savoury and a little resinous. You find you are hungry.',
        lore: 'SAGE cleanses a room, a wound and a bad memory. Marga burns a bundle after every death.',
    },
    rosemary: {
        kind: 'herb', name: 'rosemary', names: ['rosemary'], pick: 2,
        look: 'Needle-leaved and silvery, with pale blue flowers along the stems.',
        smell: 'Piney and sweet. Your head clears at once.',
        taste: 'Resinous. It wakes the whole mouth.',
        lore: 'ROSEMARY, for remembering. Rouses a sluggish mind. Brewed with wormwood it makes a waking tea that will fetch back someone who has been drugged under.',
    },
    salt: {
        kind: 'herb', name: 'salt', names: ['salt', 'rock salt'], pick: 3,
        look: 'Grey, coarse salt.',
        smell: 'It smells like the sea, which you have only seen twice.',
        taste: 'Salty. You were expecting something else?',
        lore: 'SALT wards, keeps, wakes the heart, and binds. Every hedge witch keeps a jar in the house and a pinch in the pocket.',
    },
    // ---- the Whisperwood
    valerian: {
        kind: 'herb', name: 'valerian', names: ['valerian', 'all-heal'], pick: 2,
        look: 'Tall stems topped with clusters of tiny pink flowers.',
        smell: 'Appalling. Old socks and wet cat.',
        taste: 'You regret it immediately. Your jaw goes slack and your eyelids drag.',
        lore: 'VALERIAN brings sleep, and smells like a wet cat. Brew it with something sweet, elderflower for one, or the patient will taste the trick.',
    },
    wormwood: {
        kind: 'herb', name: 'wormwood', names: ['wormwood', 'absinthe'], pick: 2,
        look: 'Silver-grey, finely cut leaves on a woody stem.',
        smell: 'Sharply bitter, almost medicinal.',
        taste: 'The bitterest thing you have ever put in your mouth. Your whole face folds up.',
        lore: 'WORMWOOD, bitter as grief. Wakes the dull and sours the worm. Rosemary and wormwood together make the waking tea.',
    },
    mugwort: {
        kind: 'herb', name: 'mugwort', names: ['mugwort', 'dream herb'], pick: 2,
        look: 'Tall, dark-leaved, with undersides as white as frost.',
        smell: 'Smoky, dreamy and faintly sweet. The world goes soft at the edges.',
        taste: 'Bitter, then oddly sweet. A faint buzzing starts behind your eyes.',
        lore: 'MUGWORT, the dream herb. Burned for visions and journeys. Old Moll would give her left knee for a sprig.',
    },
    elderflower: {
        kind: 'herb', name: 'elderflower', names: ['elderflower', 'elder', 'elder flowers', 'elderflowers'], pick: 2,
        look: 'Creamy lace plates of tiny flowers on a slim, crooked tree.',
        smell: 'Honeyed and light, like summer in a glass.',
        taste: 'Sweet and fragrant. You could drink a bucket of it.',
        lore: 'ELDERFLOWER sweetens bitter brews and cools the eyes. It hides a draught\'s taste better than honey.',
    },
    nightshade: {
        kind: 'herb', deadly: true, name: 'nightshade', names: ['nightshade', 'belladonna', 'deadly nightshade'], pick: 1,
        look: 'Glossy black berries in green cups, shining like wet eyes. Beautiful, and wrong.',
        smell: 'Faintly sweet, like a fruit that is lying.',
        taste: null,
        lore: 'NIGHTSHADE, belladonna: the beautiful lady. Deadly in a berry. A drop widens the eyes; a spoonful stops the heart. Never taste it.',
    },
    hemlock: {
        kind: 'herb', deadly: true, name: 'hemlock', names: ['hemlock'], pick: 1,
        look: 'Lacy white flowers over a smooth stem blotched with purple, like a bruise.',
        smell: 'Musty, like a mouse nest.',
        taste: null,
        lore: 'HEMLOCK: parsley\'s murderous cousin. A purple-blotched stem and a mousy smell. Death is slow, cold and polite. Never taste it.',
    },
    // ---- the mill and elsewhere
    comfrey: {
        kind: 'herb', name: 'comfrey', names: ['comfrey', 'knitbone'], pick: 2,
        look: 'Big, hairy leaves and drooping bell flowers, purple and cream together.',
        smell: 'Green and cucumbery.',
        taste: 'Furry and bland; you spit out a few hairs.',
        lore: 'COMFREY, knitbone. Binds a broken bone or a torn vein, and holds a bite closed while the rest of the cure works.',
    },
    willow_bark: {
        kind: 'herb', name: 'willow bark', names: ['willow bark', 'bark', 'willow'], pick: 2,
        look: 'Strips of grey-green bark, damp and bitter.',
        smell: 'Wet wood, and something sharply medicinal.',
        taste: 'Astringent. Your mouth turns to chalk.',
        lore: 'WILLOW BARK takes the heat and the ache out of a fever. Best with feverfew.',
    },
    eyebright: {
        kind: 'herb', name: 'eyebright', names: ['eyebright'], pick: 2,
        look: 'Tiny white flowers streaked with violet, each with a yellow centre like an eye.',
        smell: 'Almost nothing: grass and cold water.',
        taste: 'Faintly bitter, faintly salty, like a tear.',
        lore: 'EYEBRIGHT washes tired, clouded and poisoned eyes. With elderflower it makes an eyewash a blind woman may see through.',
    },
    feverfew: {
        kind: 'herb', name: 'feverfew', names: ['feverfew', 'fever weed'], pick: 2,
        look: 'Daisy-like flowers with yellow centres and pungent, crumpled leaves.',
        smell: 'Strong and bitter-sweet; it makes your eyes water.',
        taste: 'Intensely bitter. Your mouth blisters a little.',
        lore: 'FEVERFEW cools a fever and calms a throbbing head. Pair it with willow bark.',
    },
    vervain: {
        kind: 'herb', name: 'vervain', names: ['vervain'], pick: 2,
        look: 'Slender, branching spikes of tiny pale purple flowers, thick around the roots.',
        smell: 'Faint and lemony, with something older underneath.',
        taste: 'Bitter and dry. For a moment you feel a pressure behind your eyes, as if a door is nearly open.',
        lore: 'VERVAIN, the sacred herb. It grows where blood has been spilled. It binds and unbinds. Vervain, salt and rue make a tincture that loosens a bound hum.',
    },
    // ---- potions
    salve: {
        kind: 'potion', name: 'yarrow salve', names: ['salve', 'yarrow salve', 'ointment'],
        look: 'A little pot of grey-green paste that smells of rain and pepper.',
        smell: 'Sharp, green and clean.', taste: 'Bitter. Salve is for skin, not for supper.',
    },
    draught: {
        kind: 'potion', name: 'sleeping draught', names: ['draught', 'sleeping draught', 'sleep draught', 'sleeping potion'],
        look: 'A stoppered vial of pale, sweet-smelling liquid.',
        smell: 'Elderflower, and under it, a heavy, drowsy sweetness.', taste: 'You wisely do not.',
    },
    fever_tea: {
        kind: 'potion', name: 'fever tea', names: ['fever tea', 'tea', 'fever draught'],
        look: 'A flask of cooling, bitter tea.',
        smell: 'Bitter and grassy.', taste: 'Bitter, and cooling all the way down.',
    },
    eyewash: {
        kind: 'potion', name: 'eyewash', names: ['eyewash', 'eye wash', 'wash'],
        look: 'A small bottle of pale, clear liquid.',
        smell: 'Faintly sweet, faintly salty.', taste: 'Sweet and cold. It makes your eyes sting, for some reason.',
    },
    waking_tea: {
        kind: 'potion', name: 'waking tea', names: ['waking tea', 'wake tea', 'tea'],
        look: 'A flask of dark, bitter tea.',
        smell: 'Rosemary and wormwood: it clears your head from a foot away.', taste: 'Bitter enough to wake the dead. You blink for a full minute.',
    },
    tincture: {
        kind: 'potion', name: 'unbinding tincture', names: ['tincture', 'unbinding tincture', 'unbinding'],
        look: 'A narrow vial of pale violet liquid with a few flecks of salt turning slowly at the bottom.',
        smell: 'Lemony, salty, with the old bitterness of rue.', taste: 'Sharp, strange and cold. Something in your chest unknots a little.',
    },
    antidote: {
        kind: 'potion', name: 'monkshood antidote', names: ['antidote', 'monkshood antidote', 'cure'],
        look: 'A vial of green, cloudy liquid.',
        smell: 'Rue and green leaf.', taste: 'Foul, and surprisingly salty.',
    },
    poison: {
        kind: 'potion', deadly: true, name: 'black dew', names: ['poison', 'black dew', 'dew', 'vial of poison'],
        look: 'A vial of a liquid as black and still as a pond at night.',
        smell: 'It smells of nothing. That is the worst of it.', taste: null,
    },
};

export const RECIPES = {
    salve: { name: 'yarrow salve', names: ['salve', 'yarrow salve'], needs: ['yarrow', 'plantain'], makes: 'salve', text: 'You pound the yarrow and the plantain together in the kettle\'s lid and work them into a paste with a dab of lard from the cottage crock. It smells like a ditch after rain.' },
    draught: { name: 'sleeping draught', names: ['sleeping draught', 'draught', 'sleep draught'], needs: ['valerian', 'elderflower'], makes: 'draught', text: 'You steep the valerian in the kettle and stir in the elderflower. The stink of old socks fades behind a sweet, drowsy fragrance. A kind of lie, in a vial.' },
    fever_tea: { name: 'fever tea', names: ['fever tea'], needs: ['feverfew', 'willow_bark'], makes: 'fever_tea', text: 'You steep the feverfew and the willow bark until the water is the colour of weak tea and bitter as sin.' },
    eyewash: { name: 'eyewash', names: ['eyewash', 'eye wash'], needs: ['eyebright', 'elderflower'], makes: 'eyewash', text: 'You steep the eyebright and elderflower, strain the liquid twice through a corner of your shawl, and let it cool in a small bottle.' },
    waking_tea: { name: 'waking tea', names: ['waking tea', 'wake tea'], needs: ['rosemary', 'wormwood'], makes: 'waking_tea', text: 'You simmer the rosemary and wormwood together. The kettle gives off a smell so sharp it clears your own head.' },
    tincture: { name: 'unbinding tincture', names: ['tincture', 'unbinding tincture', 'unbinding'], needs: ['vervain', 'salt', 'rue'], makes: 'tincture', text: 'You steep the vervain with the salt and a single sprig of rue. As it cools, the liquid turns the pale violet of an evening sky, and the kettle hums, very faintly, in a key you cannot name.' },
    antidote: { name: 'monkshood antidote', names: ['antidote', 'monkshood antidote'], needs: ['rue', 'comfrey', 'salt'], makes: 'antidote', text: 'Rue to slow the blood, comfrey to bind it, salt to wake the heart. You work fast, and your hands only shake a little.' },
    poison: { name: 'black dew', names: ['poison'], needs: ['nightshade', 'hemlock'], makes: 'poison', text: 'You boil the nightshade and the hemlock together. The liquid goes black and perfectly still. You are not at all sure why you did that.' },
};

export const SPELLS = {
    kindle: { name: 'Kindle', cost: 1, text: 'A small flame, or a witchlight. The first thing a hedge-child learns, and Elspeth\'s only sure spell.' },
    loosen: { name: 'Loosen', cost: 1, text: 'Eases a knot, a latch or a lock. It cannot touch cold iron.' },
    sight: { name: 'Sight', cost: 1, text: 'See what a thing really is: spells, poisons, and what a place remembers.' },
    veil: { name: 'Veil', cost: 2, text: 'A glamour that turns the eye aside. Lasts a dozen heartbeats.' },
    unbind: { name: 'Unbind', cost: 3, text: 'Breaks a binding, if you love the bound. Needs an unbinding tincture.' },
};
