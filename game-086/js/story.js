/**
 * story.js — chapters, the order of pages, and every line of dialogue. Pure data.
 *
 * Scenes are keyed 'prologue', 'before:<artId>' and 'after:<artId>'.
 * Book One ends with 'colorverse'; Book Two (The Far Shore) ends with 'farshore'.
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
    pip: { name: 'Pip', color: '#7ff0e0' },
    cinder: { name: 'Granny Cinder', color: '#ff8a4c' },
    nook: { name: 'Nook', color: '#a9c8ff' },
    tock: { name: 'Tock', color: '#ffd84a' },
    smudge: { name: 'Smudge', color: '#ff9ad0' },
    dusk: { name: 'The Silver Dusk', color: '#e6dcff' },
};

export const BOOKS = { 1: 'Book One · The Grey Hush', 2: 'Book Two · The Far Shore' };

export const CHAPTERS = [
    { id: 'ch1', n: 1, title: 'The Lighthouse Ship', world: 'Aboard the Prism', pages: ['wick', 'comet', 'prism'], hue: '#ffd27a' },
    { id: 'ch2', n: 2, title: 'Moonberry Grove', world: 'A forest that glows at night', pages: ['moonberry', 'glowcaps', 'dragon'], hue: '#b89bff' },
    { id: 'ch3', n: 3, title: 'Starship Sprout', world: 'A garden drifting in space', pages: ['seedpod', 'bolt', 'sprout'], hue: '#7ee07a' },
    { id: 'ch4', n: 4, title: 'Cloudtop Castle', world: 'A kingdom above the weather', pages: ['sheep', 'griffin', 'castle'], hue: '#8fc6ff' },
    { id: 'ch5', n: 5, title: 'The Grey Hush', world: 'Where the colours went', pages: ['hush', 'colorverse'], hue: '#c4c3d4' },
    { id: 'ch6', n: 6, book: 2, title: 'Coral Lanterns', world: 'A reef city under a warm sea', pages: ['jellies', 'pip', 'reef'], hue: '#5fd6e0' },
    { id: 'ch7', n: 7, book: 2, title: 'Emberpeak', world: 'A volcano that bakes bread', pages: ['buns', 'cinder', 'emberpeak'], hue: '#ff8a4c' },
    { id: 'ch8', n: 8, book: 2, title: 'Frostbloom', world: 'A tundra under the northern lights', pages: ['fox', 'nook', 'aurora'], hue: '#a9e8ff' },
    { id: 'ch9', n: 9, book: 2, title: 'Clockwork Carnival', world: 'A fair that winds itself up every morning', pages: ['balloon', 'tock', 'carousel'], hue: '#ff6f9f' },
    { id: 'ch10', n: 10, book: 2, title: 'The Blank Page', world: 'Where pictures wait to be started', pages: ['sketch', 'dusk', 'farshore'], hue: '#f3ead2' },
].map((c) => ({ book: 1, ...c }));

/** Bonus page sets, each opened by a Constellation skill. */
export const EXTRAS = [
    { id: 'bonus', n: 0, title: 'Hidden Sketches', world: 'Tucked in the back of the logbook', pages: ['snail', 'teacup', 'koi'], hue: '#9ce9d2', skill: 'sketches' },
    { id: 'postcards', n: 0, title: 'Postcards from the Far Shore', world: 'They keep floating in through the porthole', pages: ['rabbit', 'rocket', 'owl'], hue: '#ffb3d1', skill: 'postcards' },
];
export const BONUS = EXTRAS[0];

export const STORY_PAGES = CHAPTERS.flatMap((c) => c.pages);
export const BOOK_ONE_END = 'colorverse';
export const FINAL_PAGE = STORY_PAGES[STORY_PAGES.length - 1];
export const ALL_PAGES = [...STORY_PAGES, ...EXTRAS.flatMap((e) => e.pages)];
export const chapterOf = (artId) => [...CHAPTERS, ...EXTRAS].find((c) => c.pages.includes(artId));
export const extraOf = (artId) => EXTRAS.find((e) => e.pages.includes(artId));

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
        ['hush', '…there is one more thing. before i found you, i drifted a long way. past the edge of your chart.'],
        ['hush', 'i went grey over other worlds too. i didn\'t know i was doing it. they are still waiting.'],
        ['wick', 'Past the edge of the chart? Nobody sails past the edge of the chart.'],
        ['wick', '…Keeper, fetch a fresh page for the logbook. We\'re going to the Far Shore.'],
    ],

    /* ───── Book Two · The Far Shore ───── */

    'before:jellies': [
        [null, 'The Prism sails off the edge of the chart and straight down into a warm, grey sea. She has always been a very good swimmer.'],
        ['dusk', 'here. i remember drifting over this water. it used to sparkle back at me.'],
        ['wick', 'Lantern jellies! They light the reef at night. Let\'s start with them.'],
    ],
    'after:jellies': [
        ['pip', 'Blub! Lights! Who turned the lights back on?'],
        ['pip', 'Oh. A boat. A glowing boat. Are you a very big jelly?'],
    ],
    'before:pip': [
        ['pip', 'I\'m Pip, keeper of the reef lanterns. Well, I am the reef lantern. I have a light on my head, see? It\'s grey.'],
        ['pip', 'When I\'m frightened I puff up. I have been puffed up for a week.'],
    ],
    'after:pip': [
        ['pip', 'I\'m GOLD! I\'m gold and I\'m deflating! Ahhh, that\'s better.'],
        ['dusk', 'i am sorry, little fish. i did not mean to frighten you.'],
        ['pip', 'You\'re the big grey cloud! …You\'re much nicer up close. Most clouds are.'],
    ],
    'before:reef': [
        ['pip', 'Now the whole city, Keeper. Shell houses, coral gardens, a lantern on every door.'],
    ],
    'after:reef': [
        [null, 'One by one the lanterns of the reef wink on, and the sea glows like a bowl of fireflies.'],
        ['pip', 'I\'m coming with you. Every ship needs a lantern that can swim.'],
        ['wick', 'Two lanterns aboard. We\'ll have to share the job.'],
        ['pip', 'I\'ll do nights.'],
    ],

    'before:buns': [
        ['dusk', 'the next world is warm. i remember warm. and a smell, like bread.'],
        ['cinder', 'Customers! At last! Mind the step, dears, the whole mountain is an oven.'],
        ['cinder', 'My volcano buns keep coming out of the lava as grey as dishwater. Nobody wants a grey bun.'],
    ],
    'after:buns': [
        ['cinder', 'Golden crust, cherry lava jam. Now that\'s a bun. Help yourselves.'],
        ['mira', 'I have had nine.'],
        ['cinder', 'Have ten, dear. Growing dragon.'],
    ],
    'before:cinder': [
        ['cinder', 'Granny Cinder, head baker of Emberpeak. Salamanders love a hot oven, but this grey takes all the warmth out of me.'],
    ],
    'after:cinder': [
        ['cinder', 'Ooh, I\'m toasty again. Red as a coal and twice as cheerful.'],
        ['cinder', 'The Hush came through just as the morning loaves went in. It hovered over the ovens a long while. I think it was cold.'],
        ['dusk', 'i was. i was always cold.'],
        ['cinder', 'Then you sit by my oven any time you like, love.'],
    ],
    'before:emberpeak': [
        ['cinder', 'Now the mountain herself. Light the peak and every oven in the village lights with it.'],
    ],
    'after:emberpeak': [
        [null, 'Emberpeak rumbles happily, and a smoke ring the shape of a croissant drifts up into the evening.'],
        ['cinder', 'Take a basket of buns for the road. It\'s cold where you\'re going next. Frostbloom.'],
    ],

    'before:fox': [
        ['wick', 'Brr. Frostbloom. Even the snow here looks greyer than snow should.'],
        ['dusk', 'the sky here used to dance. i stopped to watch it. i think i stopped it dancing.'],
    ],
    'after:fox': [
        ['wick', 'A snow fox, curled up asleep. She doesn\'t look cold, at least.'],
        [null, 'A small, very fluffy shape peers out from behind a snowdrift.'],
    ],
    'before:nook': [
        ['nook', 'Um. Hello. I\'m Nook. I\'m a yeti. I\'m meant to be blue and white, but now I\'m just… white and white.'],
        ['nook', 'Everyone says yetis are scary. I just like cocoa.'],
    ],
    'after:nook': [
        ['nook', 'Blue! My face is blue again! And my scarf is red! And my cocoa is… cocoa!'],
        ['pip', 'Can I sit in your cocoa? I\'m very cold.'],
        ['nook', 'No.'],
    ],
    'before:aurora': [
        ['nook', 'Can you fix the sky? It used to go green and pink and purple at night, all wavy. Like a curtain with someone dancing behind it.'],
    ],
    'after:aurora': [
        [null, 'Green, then violet, then pink: the northern lights ripple over Frostbloom like a curtain lifted by a warm breath.'],
        ['dusk', 'it\'s dancing again.'],
        ['nook', 'Can I come with you? I\'ll bring cocoa.'],
        ['wick', 'Bring a lot of cocoa.'],
    ],

    'before:balloon': [
        ['tock', 'TICK. Ladies, gentlemen, lanterns and dragons! Welcome to the Clockwork Carnival, the fair that winds itself up every morning!'],
        ['tock', 'TOCK. Regrettably, it has not been wound up in some time. Everything has gone grey and slow.'],
    ],
    'after:balloon': [
        ['tock', 'TICK! The balloon rises! A splendid start, Keeper.'],
    ],
    'before:tock': [
        ['tock', 'Allow me to introduce myself. Tock, ringmaster. My spring is wound, but my colours have run down.'],
    ],
    'after:tock': [
        ['tock', 'Brass, polished! Coat, scarlet! Moustache, magnificent! I could weep, if I had the plumbing.'],
        ['tock', 'Your grey friend rode our carousel, you know. Round and round, all night. It said it liked going somewhere without having to leave.'],
        ['dusk', 'i was tired of drifting.'],
    ],
    'before:carousel': [
        ['tock', 'The grand carousel, Keeper. Paint it, and the whole carnival will spin again.'],
    ],
    'after:carousel': [
        [null, 'The carousel turns, the bulbs blink, and a little tune plays that sounds exactly like the inside of a music box.'],
        ['tock', 'There is one more world beyond us, Keeper. Nobody goes there. It is completely blank.'],
        ['dusk', 'that is where i came from.'],
    ],

    'before:sketch': [
        [null, 'Past the carnival the stars thin out, and then they stop. The Prism floats over a vast, quiet sheet of paper.'],
        ['smudge', 'Oh! Visitors! Nobody visits the Blank Page. Wipe your feet. Actually, don\'t, I\'ll just rub it out.'],
        ['smudge', 'I\'m Smudge. I keep the page tidy. This is where pictures wait before anyone starts them.'],
        ['smudge', 'There\'s only one drawing here, and it\'s very old. Just pencil. Will you look?'],
    ],
    'after:sketch': [
        ['wick', 'That\'s… that\'s the Prism. And that\'s me, in the lantern.'],
        ['smudge', 'Someone drew it here a very long time ago, then sailed off to colour it in. The first pencil line got left behind.'],
        ['dusk', 'the first line. grey, and alone. that was me.'],
        ['dusk', 'i never meant to take the colours. i was only the outline, looking for the picture i belonged to.'],
    ],
    'before:dusk': [
        ['wick', 'Then you\'ve found it. You belong to all of them.'],
        ['dusk', 'will you paint me once more? not grey this time. i would like to try a sunset.'],
    ],
    'after:dusk': [
        ['dusk', 'peach. rose. lavender. i am the colour of the end of the day.'],
        ['smudge', 'Oh, that\'s lovely. I shan\'t rub that out at all.'],
        ['wick', 'One more picture, Keeper. The biggest page we\'ve ever had, with everyone we met on it.'],
    ],
    'before:farshore': [
        ['smudge', 'Use the whole page. It\'s been waiting ever so long.'],
    ],
    'after:farshore': [
        [null, 'And so the Blank Page was blank no longer, and the Far Shore became simply the shore: somewhere to visit, and to come home from.'],
        ['pip', 'Lights on!'],
        ['cinder', 'Buns for everyone.'],
        ['nook', 'And cocoa.'],
        ['tock', 'TICK, TOCK, and a very good night.'],
        ['dusk', 'thank you for finishing me.'],
        ['wick', 'Every picture gets finished in the end, Keeper, as long as someone keeps painting. Thank you.'],
    ],

    'before:snail': [['wick', 'A sketch from the back of the logbook. Somebody drew a snail with a galaxy for a shell.']],
    'after:snail': [['wick', 'It has been crossing the chart room for eleven years. We\'re very proud of it.']],
    'before:teacup': [['wick', 'Ah, the Teacup Planet. Best visited at four o\'clock.']],
    'after:teacup': [['wick', 'Lovely. One lump of moon or two?']],
    'before:koi': [['wick', 'The last sketch: a clockwork koi from Bolt\'s pond.']],
    'after:koi': [['bolt', 'BEEP. FISH IS HAPPY. FISH IS ORANGE. ALL IS WELL.']],

    'before:rabbit': [['pip', 'A postcard came floating down from the moon. It has a rabbit on it.']],
    'after:rabbit': [['pip', 'On the back it says: Wish you were here. Bring mochi.']],
    'before:rocket': [['cinder', 'This postcard came from the desert worlds. It smells faintly of toast.']],
    'after:rocket': [['cinder', 'A cactus rocket! Clever things. They water themselves on the way up.']],
    'before:owl': [['nook', 'The last postcard has an owl on it. A sleepy one. I like it.']],
    'after:owl': [['nook', 'Shh. It\'s asleep. Goodnight, owl.']],
};
