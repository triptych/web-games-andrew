/**
 * story.js — chapters, the order of pages, and every line of dialogue. Pure data.
 *
 * Scenes are keyed 'prologue', 'before:<artId>', 'after:<artId>' and 'epilogue'.
 * Each line is [speaker, text]; speakers are listed in SPEAKERS (null speaker = narration).
 */
export const SPEAKERS = {
    wick: { name: 'Wick', color: '#ffd27a' },
    comet: { name: 'Comet', color: '#f39a3d' },
    mira: { name: 'Mira', color: '#b89bff' },
    fern: { name: 'Captain Fern', color: '#7ee07a' },
    bolt: { name: 'Bolt', color: '#ff8c5a' },
    aurelle: { name: 'Lady Aurelle', color: '#ff8fb5' },
    sunwing: { name: 'Sunwing', color: '#ffc23f' },
    hush: { name: 'The Hush', color: '#c4c3d4' },
};

export const CHAPTERS = [
    { id: 'ch1', n: 1, title: 'The Lighthouse Ship', world: 'Aboard the Prism', pages: ['wick', 'comet', 'prism'], hue: '#ffd27a' },
    { id: 'ch2', n: 2, title: 'Moonberry Grove', world: 'A forest that glows at night', pages: ['moonberry', 'glowcaps', 'dragon'], hue: '#b89bff' },
    { id: 'ch3', n: 3, title: 'Starship Sprout', world: 'A garden drifting in space', pages: ['seedpod', 'bolt', 'sprout'], hue: '#7ee07a' },
    { id: 'ch4', n: 4, title: 'Cloudtop Castle', world: 'A kingdom above the weather', pages: ['sheep', 'griffin', 'castle'], hue: '#8fc6ff' },
    { id: 'ch5', n: 5, title: 'The Grey Hush', world: 'Where the colours went', pages: ['hush', 'colorverse'], hue: '#c4c3d4' },
];
export const BONUS = { id: 'bonus', n: 0, title: 'Hidden Sketches', world: 'Tucked in the back of the logbook', pages: ['snail', 'teacup', 'koi'], hue: '#9ce9d2', skill: 'sketches' };

export const STORY_PAGES = CHAPTERS.flatMap((c) => c.pages);
export const ALL_PAGES = [...STORY_PAGES, ...BONUS.pages];
export const chapterOf = (artId) => [...CHAPTERS, BONUS].find((c) => c.pages.includes(artId));

export const SCENES = {
    prologue: [
        ['wick', 'Oh! You\'re awake. Good, good. Mind the paint pots. They\'re the only colourful things left aboard.'],
        ['wick', 'I\'m Wick, lamplighter of the Prism. And you, if the stars told it right, are our new Colorkeeper.'],
        ['wick', 'Last night the Grey Hush rolled across the Colorverse like fog over a teacup. Every world it touched went quiet and grey.'],
        ['wick', 'But colours never really vanish. They hide in tiny squares we call pixels. Give each pixel back its colour, and the world remembers.'],
        ['wick', 'Let\'s start small. With me! My flame\'s gone dim. Pick a colour, then tap every square with its number.'],
    ],
    'before:wick': [
        ['wick', 'Zoom in with two fingers (or the mouse wheel) until you see the numbers. Then tap, or drag across a row.'],
    ],
    'after:wick': [
        ['wick', 'Ahh. Warm again. You\'ve a gentle hand, Keeper.'],
        ['wick', 'See those sparkles you gathered? That\'s Glimmer, leftover light from every pixel you restore.'],
        ['wick', 'Spend it in the Constellation, up in the chart room. Each star there teaches a new Colorkeeper skill.'],
    ],
    'before:comet': [
        ['wick', 'That grey lump on the cushion is Comet, the ship\'s cat. She\'s usually orange. She\'s usually awake, too.'],
    ],
    'after:comet': [
        ['comet', 'Mrrrp.'],
        ['wick', 'She says thank you. Or "feed me". It\'s the same word in Cat.'],
    ],
    'before:prism': [
        ['wick', 'Now the ship herself. If the Prism can shine, she can sail, and the nearest grey world is Moonberry Grove.'],
    ],
    'after:prism': [
        ['wick', 'Sails full of rainbow! Hold on to something. Comet, preferably.'],
        [null, 'The Prism lifts out of its grey harbour and turns towards a forest that has forgotten how to glow.'],
    ],

    'before:moonberry': [
        ['wick', 'Moonberry Grove. The berries here used to glow at night. Now everything\'s the colour of cold porridge.'],
    ],
    'after:moonberry': [
        ['mira', '…Who\'s there? Are you the Hush? I\'m not afraid of you!'],
        ['mira', '(I am a little afraid of you.)'],
    ],
    'before:glowcaps': [
        ['mira', 'If you\'re really a Colorkeeper, prove it. The glowcaps used to light my way home.'],
    ],
    'after:glowcaps': [
        ['mira', 'Oh! They\'re humming again. Mushrooms hum, you know. Very quietly. In the key of teal.'],
    ],
    'before:dragon': [
        ['mira', 'Would you… do me? I used to be purple. Very purple. Terrifyingly purple.'],
    ],
    'after:dragon': [
        ['mira', 'LOOK AT ME. I am magnificent.'],
        ['mira', 'I\'m coming with you. The Hush went past here like a sigh, and it didn\'t stop. It\'s looking for something.'],
        ['wick', 'A dragon aboard. Comet will be thrilled.'],
        [null, 'Comet was not thrilled.'],
    ],

    'before:seedpod': [
        ['fern', 'Mayday, mayday! This is Captain Fern of the Starship Sprout. Our garden-engine\'s gone grey and we\'re drifting. Can anyone hear me?'],
        ['wick', 'Loud and clear, Captain. Hold tight, we have a Colorkeeper.'],
    ],
    'after:seedpod': [
        ['fern', 'A seed pod just sprouted on the hull! Whatever you\'re doing, Keeper, do it more.'],
    ],
    'before:bolt': [
        ['fern', 'This is Bolt, our gardener. Bolt\'s not broken. Bolt\'s just… beige. Bolt hates beige.'],
    ],
    'after:bolt': [
        ['bolt', 'BEEP. COLOUR SUBROUTINES RESTORED. BEIGE PURGED. THANK YOU, KEEPER.'],
        ['bolt', 'I HAVE WATERED YOUR DRAGON.'],
        ['mira', 'He has. I\'m damp.'],
    ],
    'before:sprout': [
        ['fern', 'Now the old girl herself. The Sprout grows on light, and you\'ve got buckets of it.'],
    ],
    'after:sprout': [
        ['fern', 'Engines green, leaves green, everything green! We\'ll fly with you.'],
        ['fern', 'We saw the Hush go by, you know. A great soft grey shape, drifting towards Cloudtop. It didn\'t seem angry. It seemed… lost.'],
    ],

    'before:sheep': [
        ['aurelle', 'Halt! Who flies at Cloudtop\'s gate? …A lantern, a dragon and a seedship. Strange company.'],
        ['aurelle', 'My cloud-sheep have gone as grey as rain. A shepherd-knight without her flock is just a person in heavy shoes.'],
    ],
    'after:sheep': [
        ['aurelle', 'Woolly and white, and a little bit pink at sunset. Just as they should be. Thank you, Keeper.'],
    ],
    'before:griffin': [
        ['aurelle', 'This is Sunwing, my griffin. She flew right at the Hush, trying to stop it.'],
    ],
    'after:griffin': [
        ['sunwing', 'Krreee!'],
        ['aurelle', 'She says it didn\'t fight her. She says it was crying.'],
        ['wick', 'Crying? The Hush?'],
    ],
    'before:castle': [
        ['aurelle', 'Restore the castle and the bells will ring again. Perhaps then we\'ll understand what the Hush wants.'],
    ],
    'after:castle': [
        [null, 'Bong. Bong. Bong. The bells of Cloudtop ring out across a sky the colour of forget-me-nots.'],
        ['wick', 'Listen… something\'s coming. Not to fight. It\'s following the bells.'],
    ],

    'before:hush': [
        ['hush', '…so bright. all of you. so very bright.'],
        ['wick', 'It\'s… a moth? A huge, soft, grey moth.'],
        ['mira', 'Why did you take everybody\'s colours?!'],
        ['hush', 'i only wanted… to be in the picture. nobody ever paints me. grey is what\'s left over. grey is what\'s underneath.'],
        ['wick', 'Keeper, let\'s paint it. Not to change it. Grey is a colour too. Let\'s show it all of its greys.'],
    ],
    'after:hush': [
        ['hush', 'silver. pewter. smoke. dove. ash.'],
        ['hush', 'i had names. i never knew i had names.'],
        [null, 'All across the Colorverse, the borrowed colours drift home like dandelion seeds.'],
    ],
    'before:colorverse': [
        ['hush', 'will you… put me in the picture? with everyone?'],
        ['wick', 'One last mosaic, Keeper. The whole Colorverse, and everyone in it.'],
    ],
    'after:colorverse': [
        ['wick', 'And that is how the Grey Hush became the Silver Dusk, who visits every evening so the colours can rest.'],
        ['mira', 'Purple dragons need their beauty sleep.'],
        ['hush', 'thank you for seeing me.'],
        ['wick', 'The Colorverse is bright again, Keeper. Thank you. But there are always more little worlds. The Constellation still has a secret or two…'],
    ],

    'before:snail': [['wick', 'A sketch from the back of the logbook. Somebody drew a snail with a galaxy for a shell.']],
    'after:snail': [['wick', 'It has been crossing the chart room for eleven years. We\'re very proud of it.']],
    'before:teacup': [['wick', 'Ah, the Teacup Planet. Best visited at four o\'clock.']],
    'after:teacup': [['wick', 'Lovely. One lump of moon or two?']],
    'before:koi': [['wick', 'The last sketch: a clockwork koi from Bolt\'s pond.']],
    'after:koi': [['bolt', 'BEEP. FISH IS HAPPY. FISH IS ORANGE. ALL IS WELL.']],
};
