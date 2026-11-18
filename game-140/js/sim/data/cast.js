// The cast. Each entry: display name, a colour for the name plate (shown in grey until its hue is restored), the
// portraits that exist ('neutral' plus alternates; any other expression falls back to neutral), and the `art`
// description every portrait prompt was written from (dev/art/prompts.mjs). `hue` is the band of the name plate.

export const CAST = {
    codex: {
        name: 'The Codex', hue: 2, color: '#e8c25a', exprs: ['neutral'],
        art: 'the echo of Ostrander Vael, the last sorcerer: an ancient, tall, translucent ghost of pale gold light with a long silver beard and hair, kind sorrowful eyes, robes embroidered with faded constellations, rising out of the pages of an open leather-bound book with a brass clasp that he holds',
        bio: 'What Ostrander Vael, the last sorcerer, left in the margins of his book. Wry, tired, kinder than he lets on. It has a great deal to apologise for, and has not yet said what.',
    },
    edda: {
        name: 'Edda Thornwick', hue: 0, color: '#d2463c', exprs: ['neutral', 'happy'],
        art: 'Edda Thornwick, an elderly blind cartographer: clouded milky eyes, weathered warm brown skin, silver hair in a long braid tied with faded red and gold ribbons, a sly kind smile; a many-pocketed dark green oilcloth coat over a rust-orange shawl, rolled maps under one arm, a carved walking staff hung with little brass compasses',
        bio: 'A blind cartographer of Hollowmere who drew maps of a world she has never seen in colour. Ostrander owed her three maps and an apology. She is collecting both from you.',
    },
    aldwin: {
        name: 'Aldwin', hue: 1, color: '#e8822c', exprs: ['neutral', 'sad'],
        art: 'Aldwin, a huge broad-shouldered deserter knight turned blacksmith in his forties: shaved head, short grey-flecked dark beard, burn scars on his forearms, gentle sad eyes, a scorched leather smith apron over a battered breastplate whose order sigil has been scratched out, a great forge hammer resting on his shoulder',
        bio: 'Once Brother Aldwin of the Cinereal Order, ordered to burn the library of Saint Ilse. He put down the torch and walked away, and has been hiding behind an anvil ever since.',
    },
    kestrel: {
        name: 'Kestrel', hue: 4, color: '#3a8fd8', exprs: ['neutral', 'happy'],
        art: 'Kestrel, a wiry young woman smuggler in her early twenties: olive skin, a sharp crooked grin, cropped black hair with one long hidden braid, a long weathered navy-blue sea coat with brass buttons, knives at her belt, and an intricate forbidden tattoo of a peacock-coloured bird curling up the side of her neck',
        bio: 'Smuggler out of Merrowgate. She runs forbidden things past the Order: pigments, songs, painted cards. The bird on her neck was inked by her mother the night before the Order took her away.',
    },
    ione: {
        name: 'Ione', hue: 3, color: '#4fb46a', exprs: ['neutral'],
        art: 'Ione, the last dryad of an ancient forest: a tall slender woman whose skin is pale silver birch bark and moss, antler-like living branches growing through long flowing emerald-green hair, glowing amber eyes, small white star flowers and ivy twined about her, a gown of leaves',
        bio: 'The last spirit of the Eldwood, who slept as stone for three hundred years. She remembers the world before the Hush, and the young man who founded the Order.',
    },
    caius: {
        name: 'Caius Morrow', hue: 6, color: '#a77ad8', exprs: ['neutral', 'soft'],
        art: 'Inquisitor Caius Morrow, a young zealous inquisitor of a grey religious order: mid twenties, pale, sharp handsome features, short ash-blond hair, piercing grey eyes, stern mouth; a high-collared ash-grey cassock with silver chains and a sigil of an unlit grey candle inside a circle, a long grey cloak, one gloved hand holding up a lantern of pale white flame, a silver sword at his hip',
        bio: 'Inquisitor of the Cinereal Order, sent to bring back the book and the one who carries it. He believes, sincerely, that colour is what burned the world.',
    },
    odrane: {
        name: 'Hierarch Odrane', hue: 5, color: '#5d5fc4', exprs: ['neutral'],
        art: 'Hierarch Odrane, the ancient undying pontiff of a grey religious order: unnaturally tall and gaunt, corpse-pale skin like paper, blank white eyes, a towering pale mitre crown, layered ash-white and silver-grey vestments, long bone-thin hands, a staff topped by a silver cage holding a writhing grey fire',
        bio: 'Hierarch of the Cinereal Order, who has sat on the Grey Throne for longer than any record admits.',
    },
    tilly: {
        name: 'Tilly', hue: 0, color: '#d2463c', exprs: ['neutral'],
        art: 'Tilly, a small solemn village girl of about eight from a drowned marsh village: a too-big grey wool coat, muddy boots, tangled light brown hair, big wondering eyes, holding a single rose',
        bio: 'A child of Hollowmere. The first person in three hundred years to say the word "red" and mean it.',
    },
    knight: {
        name: 'Cinerite Knight', hue: 5, color: '#8890a8', exprs: ['neutral'],
        art: 'a faceless knight of a grey religious order in fluted ash-grey plate armour with a closed helm, an ash-white tabard bearing the sigil of an unlit grey candle in a circle, holding up a lantern of pale white flame and a long sword',
        bio: 'The knights of the Cinereal Order carry lanterns of grey fire, which do not warm.',
    },
};

/** The portrait key for a cast id and expression, or null if the id has none. */
export function portrait(id, expr = 'neutral') {
    const c = CAST[id];
    if (!c) return null;
    return c.exprs.includes(expr) && expr !== 'neutral' ? `${id}-${expr}` : id;
}

export const COMPANIONS = ['edda', 'aldwin', 'kestrel', 'ione', 'caius'];
