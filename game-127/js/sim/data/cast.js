// The people of Aurelmere. Portraits are cut from the fal character sheets (dev/art/README.md); `art` is the
// description each sheet was generated from, kept here so the art can be regenerated to match.

export const PRINCE_DEFAULT = 'Cael';

// Ages at which the prince's portrait changes.
export const AGE_ART = (age) => (age < 13 ? 'child' : age < 16 ? 'teen' : 'adult');
export const EXPR = ['neutral', 'happy', 'sad', 'angry'];

export const FRIENDS = ['isolde', 'rowan', 'pip', 'theo', 'saffi', 'lumi'];

export const CAST = {
    cael: {
        name: 'Cael', color: '#ffb347',
        art: 'Half-dragon prince: ash-silver hair with ember-red tips, golden slit-pupil eyes, curved black horns, crimson-scaled tail; wings from 14.',
    },
    you: { name: 'You', color: '#e9d9b5' },          // the Warden; the display name comes from the save
    n: { name: '', color: '#cfc6b0' },                // narration

    // ---------------------------------------------------------------- childhood friends (romance)
    isolde: {
        name: 'Isolde', full: 'Lady Isolde Varre', color: '#7fd1c7', friend: true,
        blurb: "Duke Mordrain's only daughter. Sharp-tongued, proud, the best young fencer in the capital, and lonelier than she will ever admit.",
        admires: ['grc', 'cmb'], place: 'varre', meet: 'meet_isolde',
        loves: ['rapier', 'hawkfeather'], likes: ['book', 'silk', 'tea'], hates: ['frog', 'pie'],
        art: 'Raven-black hair, silver hawk-feather clip, grey-blue eyes, deep-teal and silver; rapier.',
    },
    rowan: {
        name: 'Rowan', full: 'Rowan Hale', color: '#f0a35c', friend: true,
        blurb: "Captain Brannoc's son and a squire who wants to be the kind of knight from the old songs. Loyal to a fault, terrible at lying.",
        admires: ['cmb', 'mor'], place: 'yard', meet: 'meet_rowan',
        loves: ['whetstone', 'pie'], likes: ['sweets', 'dice', 'frog'], hates: ['perfume', 'book'],
        art: 'Sandy-brown hair, freckles, green eyes, red tabard with a white tower; steel breastplate when grown.',
    },
    pip: {
        name: 'Pip', full: 'Pip Thistlewood', color: '#ff8a5c', friend: true,
        blurb: 'A street kid from the Rookery with quick fingers and quicker jokes. Looks after the younger orphans. Trusts nobody, at first.',
        admires: ['cun', 'cha'], place: 'market', meet: 'meet_rowan',
        loves: ['lockpicks', 'sweets'], likes: ['pie', 'dice', 'ribbon'], hates: ['tea', 'perfume'],
        art: 'Copper-orange hair, patched flat cap, amber eyes, green scarf; dark leather jacket when grown.',
    },
    theo: {
        name: 'Theo', full: 'Theo Marchbank', color: '#8fb8ff', friend: true,
        blurb: "The Arcane Spire's youngest apprentice. Shy, brilliant, permanently behind a stack of books, secretly brave.",
        admires: ['int', 'mag'], place: 'spire', meet: 'meet_theo',
        loves: ['book', 'starchart'], likes: ['tea', 'crystal', 'sweets'], hates: ['dice', 'whetstone'],
        art: 'Dark brown skin, curly hair, round spectacles, star-patterned blue robes; staff with a floating crystal when grown.',
    },
    saffi: {
        name: 'Saffi', full: 'Saffi al-Rashid', color: '#ffd166', friend: true,
        blurb: 'Daughter of the trade envoy from Qasirah. Dances, bargains and laughs in three languages. Wants to see every port in the world.',
        admires: ['art', 'com'], place: 'harbor', meet: 'meet_saffi',
        loves: ['silk', 'musicbox'], likes: ['perfume', 'ribbon', 'starchart'], hates: ['frog', 'whetstone'],
        art: 'Warm brown skin, dark wavy hair with gold beads, hazel eyes, saffron and turquoise silks; folding fan when grown.',
    },
    lumi: {
        name: 'Lumi', full: 'Lumi of the Frostpeaks', color: '#c9ecff', friend: true,
        blurb: 'A young frost dragon who wears a human shape badly and on purpose. Fearless, curious, and the first of her kind to call a half-blood "friend".',
        admires: ['drc', 'vit'], place: 'peaks', meet: 'first_flame',
        loves: ['frog', 'crystal'], likes: ['pie', 'sweets', 'dice'], hates: ['perfume', 'silk'],
        art: 'Icy-white hair, silver-blue eyes, pearl-white horns, white tail; frost-blue wings when grown.',
    },

    // ---------------------------------------------------------------- the court and the city
    king: { name: 'King Theodric', color: '#ffd27a', art: 'Elderly king, white beard, golden crown, crimson and ermine.' },
    duke: { name: 'Duke Mordrain', color: '#b9c2d0', art: 'Hawk-nosed nobleman, black hair streaked silver, black and silver doublet.' },
    brannoc: { name: 'Captain Brannoc', color: '#e08a6a', art: 'Big bearded guard captain in steel plate and a red cape.' },
    hobb: { name: 'Hobb', color: '#d9cbb0', art: 'One-eyed old soldier turned butler, white walrus mustache.' },
    velis: { name: 'Archmage Velis', color: '#c39bff', art: 'Elderly archmage, long silver braid, violet star robes.' },
    ilsabet: { name: 'Mother Ilsabet', color: '#ffe3a3', art: 'Gentle priestess in white and gold with a flame emblem.' },
    coralie: { name: 'Madame Coralie', color: '#e39ad1', art: 'Flamboyant dance mistress, powdered auburn updo, plum gown, lace fan.' },
    orsolo: { name: 'Guildmaster Orsolo', color: '#9fd88a', art: 'Portly merchant, gold monocle, rings, green velvet coat.' },
    vey: { name: 'Mistress Vey', color: '#a0a4b0', art: 'Spymistress with short black hair and a silver half-mask, grey leather.' },
    ysolde: { name: 'Ysolde', color: '#ff7a5c', art: 'The Ember Queen in human form, fiery crimson hair, golden eyes, spectral glow.' },
    ashkar: { name: 'Ashkar', color: '#d6a46a', art: 'Elder wyrm in human form, bronze skin, white hair, great curling horns.' },
};

// Which file holds a character's portrait for a given expression and age. The prince has four expressions at
// three ages; the friends have a child portrait and two grown ones (neutral, happy); everyone else has one.
export function portrait(id, expr, age) {
    if (id === 'cael') {
        const e = ['neutral', 'happy', 'sad', 'angry'].includes(expr) ? expr : 'neutral';
        return `cael-${AGE_ART(age)}-${e}`;
    }
    if (CAST[id]?.friend) {
        if (age < 14) return `${id}-child`;
        return expr === 'happy' ? `${id}-adult-happy` : `${id}-adult`;
    }
    return CAST[id] && id !== 'you' && id !== 'n' ? id : null;
}
