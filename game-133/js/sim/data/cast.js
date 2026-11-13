// Everyone with a face. `look` drives the code-drawn portrait (js/art.js); `art` is the description every
// generated-art prompt is written from (dev/art/prompts.mjs), so painted portraits match the game.
// `room` is where a friend is found when you visit; `talk` is what they say when no heart event is due.

export const CAST = {
    orla: {
        name: 'Orla Brandt', title: 'Guildmaster',
        look: { skin: '#d9a57c', hair: '#b9b4ac', style: 'braid', eyes: '#5b7a8c', outfit: '#5a2e2e', trim: '#d8a640', extra: ['eyepatch'] },
        art: 'a broad-shouldered woman of sixty, iron-grey braid over one shoulder, leather eyepatch, oxblood guildmaster coat with brass lantern clasps, dry half-smile',
    },
    pell: {
        name: 'Pell Quillon', title: 'Head Clerk',
        look: { skin: '#f0c9a4', hair: '#8a5a33', style: 'tuft', eyes: '#3d4a3a', outfit: '#3f5b46', trim: '#e6dcc0', extra: ['glasses', 'small'] },
        art: 'a fussy halfling clerk with round brass spectacles, ink-stained fingers, a tuft of chestnut hair, a moss-green waistcoat and a quill behind one ear',
    },
    kael: {
        name: 'Kael Thornwood', title: 'Gold-rank swordsman', room: 'yard', romance: true,
        look: { skin: '#c99772', hair: '#2b2b33', style: 'short', eyes: '#7d8fa3', outfit: '#39424f', trim: '#c8a24a', extra: ['scar', 'stubble'] },
        art: 'a tall, quiet swordsman in his early thirties, black hair cropped short, a pale scar through one eyebrow, grey-blue eyes, a slate travelling cloak over worn steel, a gold rank tag on a cord',
        talk: [
            'You file reports the way some people sharpen blades. I noticed. That is all.',
            'The yard is quiet at this hour. I do not mind the company.',
            'I read the board every morning. The gradings have been sound. Keep them that way.',
            'There is tea. I made too much. ...Sit, if you want.',
        ],
    },
    sera: {
        name: 'Seraphine Vale', title: 'Silver-rank mage', room: 'library', romance: true,
        look: { skin: '#f1dccb', hair: '#e9e4f2', style: 'long', eyes: '#8a5fc7', outfit: '#4a3a78', trim: '#b9a7f0', extra: ['elf'] },
        art: 'an elven mage who looks twenty-five and is not, silver-white hair to the waist, violet eyes, pointed ears, indigo scholar robes scattered with chalk dust, one eyebrow permanently raised',
        talk: [
            'If you are here to ask whether I have read your handbook, yes. I corrected three errors in the margins. You are welcome.',
            'Do sit. No, not on the grimoire. It bites.',
            'I was hoping someone tolerable would interrupt me. You will do.',
            'The mist-samples changed colour again. Come and look, and tell me I am not imagining it.',
        ],
    },
    bram: {
        name: 'Bram Hale', title: 'Cook of the Lamplit Tankard', room: 'tavern', romance: true,
        look: { skin: '#8d5a3b', hair: '#1f1a17', style: 'curls', eyes: '#5a3a1f', outfit: '#b0562c', trim: '#f2e3c4', extra: ['beard', 'broad'] },
        art: 'a big warm bear of a man around thirty-five, deep brown skin, short black curls and a trimmed beard, rolled sleeves, a flour-dusted russet apron, a laugh you can see coming',
        talk: [
            'There you are! Sit. You are not leaving until you have tried the barley stew and told me the truth about it.',
            'Rough day at the desk? I can tell by the ink on your nose. Here. Honey cake fixes most things.',
            'I saved you the corner of the pie. The corner is the best part and anyone who says otherwise is not to be trusted.',
            'You know, the hall is warmer since you came. And I am the one with the ovens, so I would know.',
        ],
    },
    nyx: {
        name: 'Nyx', title: 'Copper-rank "courier"', room: 'roof', romance: true,
        look: { skin: '#e0b592', hair: '#3a2f4d', style: 'messy', eyes: '#d6b13a', outfit: '#2d2a35', trim: '#7fd1b9', extra: ['cat', 'freckles'] },
        art: 'a wiry catfolk rogue of about twenty-five with tufted cat ears, messy plum-black hair, gold slit-pupil eyes, freckles, a dark hooded jerkin with a teal scarf, and a grin that has already picked your pocket',
        talk: [
            'Clerk! Your quill is in my pocket. It was there when I found it. Mostly.',
            'Best view in Brightmoor, and it is free. Do not tell Pell or he will write a fee for it.',
            'I counted the lamps again. One hundred and twelve. One hundred and thirteen when you are working late.',
            'You came up the ladder this time. I am almost proud.',
        ],
    },
    ren: {
        name: 'Ren Valemont', title: 'Envoy of the Crown', room: 'office', romance: true,
        look: { skin: '#e6c3a1', hair: '#c9933f', style: 'bob', eyes: '#2f7d6d', outfit: '#1f3d5c', trim: '#e8c860', extra: ['circlet'] },
        art: 'a poised royal envoy in their late twenties, androgynous, honey-gold hair cut to the jaw, sea-green eyes, a slim gold circlet, a midnight-blue court coat with a white sash, hands that never fidget',
        talk: [
            'Forgive the intrusion. Your office is the only room in Brightmoor where nobody bows at me.',
            'I brought the dispatches myself. A courier would have been faster, and much less pleasant.',
            'May I watch you work? At court, nobody finishes anything. It is restful to see a stamp come down.',
            'I find I have run out of official reasons to visit. I came anyway.',
        ],
    },
    pip: {
        name: 'Pip Underhill', title: 'Copper-rank squire',
        look: { skin: '#f3d0b0', hair: '#d9772b', style: 'spiky', eyes: '#4a7a3d', outfit: '#6b7d3a', trim: '#e8d9a8', extra: ['freckles', 'small'] },
        art: 'a sixteen-year-old would-be knight, ginger hair sticking up, freckles, a dented helmet under one arm, an olive tabard two sizes too big, enormous hopeful eyes',
    },
    tamsin: {
        name: 'Tamsin Reed', title: 'Copper-rank hedge-witch',
        look: { skin: '#b98060', hair: '#3b2a20', style: 'bun', eyes: '#3a5a7a', outfit: '#5d3f6e', trim: '#d9c06a', extra: ['small'] },
        art: 'a seventeen-year-old hedge-witch with brown skin, dark hair in two messy buns, a patched plum cloak, a satchel of herbs and a crooked wand tucked behind her ear, deadpan expression',
    },
    garrick: {
        name: 'Garrick "Stormcrow"', title: 'Platinum-rank ranger',
        look: { skin: '#b88c6a', hair: '#d8d4cc', style: 'long', eyes: '#6f7f5a', outfit: '#3c4a3a', trim: '#b0b6bd', extra: ['beard', 'hood'] },
        art: 'a weathered ranger near seventy, long white hair and beard, a moss-grey hood, a longbow taller than he is, a platinum rank tag worn smooth, eyes like a patient hawk',
    },
    malvane: {
        name: 'Chancellor Malvane', title: 'Lord Chancellor',
        look: { skin: '#e9d5c5', hair: '#17161b', style: 'slick', eyes: '#3a3a44', outfit: '#1c1c22', trim: '#9a1f2b', extra: ['goatee'] },
        art: 'a lean lord chancellor of fifty, slicked black hair, a sharp goatee, a black velvet coat with crimson lining and an iron chain of office, a smile that never reaches his eyes',
    },
    moss: {
        name: 'Moss', title: 'A brownie',
        look: { kind: 'brownie', skin: '#7fa05a', hair: '#4d6b34', eyes: '#2a1c10', outfit: '#8a6a3a', trim: '#d9c26a' },
        art: 'a knee-high brownie made of moss and bark with acorn-cap hat, black bead eyes, a coat of stitched oak leaves and one mismatched brass button',
    },
    ondine: {
        name: 'Ondine', title: 'Spirit of the Lark River',
        look: { kind: 'spirit', skin: '#9fd6e6', hair: '#4aa3c7', eyes: '#eafcff', outfit: '#5fb7d1', trim: '#e6fbff' },
        art: 'a river spirit shaped like a young woman made of clear moving water, hair flowing upward like a current, reeds and a small silver bell woven in, calm and sad',
    },
    vesper: {
        name: 'Vesperax', title: 'Last Warden of the Deep',
        look: { kind: 'dragon', skin: '#7a3f8c', hair: '#c9a84a', eyes: '#ffd35a', outfit: '#4a2560', trim: '#e9c46a' },
        art: 'an ancient dragon with dusk-violet scales edged in old gold, long whiskered muzzle, molten amber eyes, cracked horns bound with tarnished guild lanterns, vast and tired and courteous',
    },
};

export const ROMANCE = Object.keys(CAST).filter((id) => CAST[id].romance);
export const CAST_IDS = new Set([...Object.keys(CAST), 'n', 'you']);

// Where things happen. `art` is the backdrop prompt.
export const PLACES = {
    hall: { name: 'The Great Hall', art: 'the great hall of a fantasy adventurers guild at morning, long reception desk, quest notice board thick with parchment, banners, a huge brass lantern hanging from oak rafters, warm light' },
    office: { name: 'Your Desk', art: 'a cosy clerk\'s office in an adventurers guild, a desk heaped with quest forms, wax seals and stamps, pigeonholes of scrolls, a window onto a medieval city' },
    tavern: { name: 'The Lamplit Tankard', art: 'a cheerful guild tavern at evening, round tables, a roaring hearth, copper pots, a bar with barrels, lanterns of amber glass' },
    yard: { name: 'The Training Yard', art: 'a walled training yard behind a guild hall at dawn, straw dummies, weapon racks, a chalked sparring ring, ivy on old stone' },
    library: { name: 'The Map Room', art: 'a tall map room and arcane library, rolling ladders, star charts, a big table with a relief map of a kingdom, floating candle motes' },
    infirm: { name: 'The Infirmary', art: 'a small tidy infirmary with herb bundles drying, a bubbling copper cauldron, shelves of coloured potion bottles, linen cots' },
    roof: { name: 'The Rooftops', art: 'rooftops of a fantasy city at night seen from beside a guild hall chimney, hundreds of lit lamps below, a huge moon, the great brass lantern glowing' },
    palace: { name: 'The Royal Gardens', art: 'a royal palace garden terrace at dusk, clipped hedges, white roses, marble balustrade, towers behind' },
    wood: { name: 'The Thornwood', art: 'an old enchanted forest in grey morning mist, mossy standing stones, tiny lights between the roots' },
    river: { name: 'The Lark River', art: 'a wide slow river by a watermill at sunset, reeds, willow trees, mist starting to gather on the water' },
    deep: { name: 'The Hollowdeep', art: 'the mouth of a vast underground chasm, ancient carved stairs descending into grey glowing mist, a cold unlit lantern the size of a house on chains' },
    street: { name: 'Brightmoor', art: 'a busy fantasy market street in a lamp-lit city on a hill, timber houses, a guild hall with a great brass lantern on its roof' },
};
