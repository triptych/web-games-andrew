// The words of the game: the seven gems, the story cards, Fray's lines, the things you can find. Pure data.
// Every spoken line has an id; audio/vo/<id>.mp3 is its recording (see dev/audio/README.md) and the text is the subtitle.

/** The spiral pendant, from the outer turn to the centre. `opens` is the way each gem makes possible. */
export const GEMS = [
    { id: 'leaf', name: 'The Leaf Gem', color: '#5fd068', virtue: 'Patience', place: 'the Rootshrine', opens: 'The dry vines on the northern cliff will grow for you.' },
    { id: 'stone', name: 'The Stone Gem', color: '#c9a36b', virtue: 'Memory', place: 'the Golem Fields', opens: 'Boulders will move aside if you ask: the cave of Glimmerdeep is open.' },
    { id: 'light', name: 'The Light Gem', color: '#ffe27a', virtue: 'Truth', place: 'Glimmerdeep', opens: 'No dark is too deep now: the stair under Castle Hollowmere can be walked.' },
    { id: 'wind', name: 'The Wind Gem', color: '#bfe9ff', virtue: 'Freedom', place: 'the Underkeep', opens: 'The air will carry you: step off the wind perch in the castle yard, up to the Aerie.' },
    { id: 'water', name: 'The Water Gem', color: '#4aa8ff', virtue: 'Mercy', place: 'the Aerie', opens: 'The sea will make room for you: walk down the white stairs on the western shore.' },
    { id: 'moon', name: 'The Moon Gem', color: '#d9c8ff', virtue: 'Rest', place: 'Thalune', opens: 'It is always moonlight where you stand: the goblin door in the Mosswood will open.' },
    { id: 'heart', name: 'The Heart Gem', color: '#ff6f91', virtue: 'Belonging', place: 'Underhome', opens: 'The Spiral is whole. The Isle has its Warden, and its Wayfinder.' },
];

export const ITEMS = {
    moonmint: { name: 'Moonmint', plural: 'sprigs of moonmint', blurb: 'A silver-leafed herb that only grows where the sea fog reaches. It smells like a cold morning.' },
    rune: { name: 'Heart-rune', plural: 'heart-runes', blurb: 'A flat stone with one turn of a spiral, warm to hold. A golem\'s memory, the old tales say.' },
    pipe: { name: 'Wandering pipe', plural: 'organ pipes', blurb: 'A brass organ pipe, salt-green. It hoots softly when you carry it, as if clearing its throat.' },
    pearl: { name: 'Tide pearl', plural: 'tide pearls', blurb: 'Heavy, cool, and faintly lit from inside, like the moon behind thin cloud.' },
    heart: { name: 'The Heart', plural: 'hearts', blurb: 'It is warm.' },
};

/** The small peaceful things scattered through each place. Twelve of each; finding them all earns a keepsake. */
export const KINDS = {
    seaglass: { name: 'Sea-glass', zone: 'isle', keepsake: 'A Jar of Sea-glass', line: 'set-seaglass' },
    feather: { name: 'Sky-feather', zone: 'isle', keepsake: 'A Fan of Sky-feathers', line: 'set-feather' },
    shard: { name: 'Glimmer shard', zone: 'caves', keepsake: 'A Lantern of Glimmer', line: 'set-shard' },
    crown: { name: 'Old crown', zone: 'under', keepsake: 'Queen Isolde\'s Purse', line: 'set-crown' },
    starseed: { name: 'Star-seed', zone: 'sky', keepsake: 'A Pocket of Star-seeds', line: 'set-starseed' },
    songshell: { name: 'Singing shell', zone: 'sea', keepsake: 'A String of Singing Shells', line: 'set-songshell' },
    button: { name: 'Goblin button', zone: 'warren', keepsake: 'The Good Button Tin', line: 'set-button' },
    bauble: { name: 'Fray\'s find', zone: null, keepsake: 'Fray\'s Pocket Museum', line: 'set-bauble' },
};
export const BAUBLES = ['a brass bell with no clapper', 'a marble with a storm in it', 'half a comb', 'a key to nothing', 'a tooth (not hers)', 'a spoon bent into a ring', 'a very small boot', 'somebody\'s lucky acorn'];

/** Story cards: a painting (art/card-<id>.webp), a title, and the narration (audio/vo/card-<id>.mp3). */
export const CARDS = {
    intro1: { title: 'The Spiral Isle', text: 'There is an island that is not on the maps, because the people who make maps were asked, kindly, to leave it off. Seven peoples lived there once. They did not die and they were not driven out. One by one, they finished what they had come to do, tidied up, and went on.' },
    intro2: { title: 'The Letter', text: 'You are a new mage: one staff, one coat, no beard to speak of. The letter that found you had no stamp and smelled of the sea. It said the Isle needed a Warden, and that the Warden\'s pendant would be waiting on the shore. It was not on the shore. But there were small footprints.' },
    met: { title: 'Fray', text: 'Under the fallen lintel of the Tidewatch shrine lies a goblin, no bigger than a child, grey with stone-dust, one hand shut tight round something on a chain. She is breathing. On the lintel grows sunfire quartz, which goblins must never touch. She says, without opening her eyes: "Moonmint. Three sprigs. It grows where the fog comes in. Please be quick, and please be real."' },
    healed: { title: 'The Pendant', text: 'The moonmint draws the fever out like a splinter. She sits up. She turns her face to the sea, then to you, then holds very still. The quartz dust has taken her sight and will not give it back. After a while she opens her hand. In it is a pendant: a silver spiral with seven empty settings. "It hummed at me," she says. "Now it is humming at you. I am Fray. Goblins see mostly by ear anyway. Shall we?"' },
    leaf: { title: 'The Leaf Gem · Patience', text: 'The Leaf-keepers planted a ring of stones and waited four hundred years for an oak to lift it. They taught the island that slow is not the same as late. When the last of them walked into the young forests of the mainland, the gem stayed, glad of the quiet. Set in the pendant, it makes dry things remember being green.' },
    stone: { title: 'The Stone Gem · Memory', text: 'Grandfather Lichen opens one eye, then the other, with a sound like a millstone thinking. "Warden," he says. "You are short. Good. The tall ones never listen." The golems were made to carry heavy things, and the heaviest was remembering. He puts the gem in your palm with two fingers the size of gateposts. "Carry it lightly," he says. "That is the trick. I learned it late."' },
    light: { title: 'The Light Gem · Truth', text: 'The four stones sing their yawn-and-stretch, and the great dark crystal wakes from the middle outward, like a window at dawn. The miners of Glimmerdeep dug down for the dark, and planted lamps in it, and followed their bright vein to a sea with its own stars. The Light Gem shows what is true. Fray tilts her head. "It is warm on my face," she says. "Is it pretty? Tell me exactly how."' },
    wind: { title: 'The Wind Gem · Freedom', text: 'With her three wanderers home, the organ of nine shipwrecks draws one long breath and plays. It is not a grand tune. It is the tune a harvest makes: carts, laughter, somebody\'s dog. High overhead, very faintly, bells answer. The Wind Gem drops from the tallest pipe into your hands, light as a held breath. Queen Isolde took the gates off their hinges. The wind approves of that sort of thing.' },
    water: { title: 'The Water Gem · Mercy', text: 'The vanes turn through morning, evening, night and the hour before dawn. Rain comes out of a clear sky, straight down into the cistern, and the Water Gem floats up to meet you like a bubble in a spring. The sky-folk left it to give the island rain when they were gone. Mercy, they wrote, is only water that knows where it is needed.' },
    moon: { title: 'The Moon Gem · Rest', text: 'One pearl for the tide that comes, one for the tide that goes, one for the still water between. Tide Mother\'s stone hands open. Thalune did not drown; it went swimming, to follow the whales, and it left the Moon Gem so the land would still have tides to fall asleep to. Far off in the green dark, something enormous sings one note, and Fray, who cannot see it, waves.' },
    hearth: { title: 'The Cold Hearth', text: 'Six gems go into six hollows in the hearthstone and the embers lift their heads. Not enough. Elder Grusk looks at the black door behind the hall, and then, for the first time, at Fray. "The Listening Dark," he says. "Eyes are no use in it. They are worse than no use." Nobody in Underhome says anything. Fray pulls up her hood. "Well," she says. "Then it has been waiting for me."' },
    heart: { title: 'The Heart Gem · Belonging', text: 'She comes out of the dark with the Heart in both hands and the whole hall goes rose-gold. The Hearth roars up. Granny Sootwick wakes, says "Told you," and goes back to sleep. Elder Grusk wets his thumb, presses it to the pale place on the Naming Wall, and says, so every tunnel hears: "Fray Deep-Listener. Wayfinder of Underhome. First of the Up-goers, who will be many."' },
    end: { title: 'Warden and Wayfinder', text: 'The last setting closes round the Heart Gem and the spiral is whole: patience, memory, truth, freedom, mercy, rest, and at the centre, belonging. Rain will come when it should. The vines will hold. The moon door stands open now, and small lanterns are coming up through the Mosswood, two by two, to see the sea. Fray takes your sleeve. "Describe it to them," she says. "You are good at that."' },
};

/** Fray. Everything she says aloud. Lines in a list are picked in turn. */
export const LINES = {
    // following you about
    'zone-isle': 'Sand, then moss, then leaf-mould. I can smell the whole wood from here. Lead on, tall one.',
    'zone-high': 'Wind! So much wind. And thyme. Something very big is breathing very slowly up here.',
    'zone-caves': 'Ohh. It is singing. Can you hear it singing? Every wall has a different note.',
    'zone-under': 'Cheese. Old cheese, and cider, and a hundred years of nobody. I like it.',
    'zone-sky': 'There is no ground under the ground. I can hear it. Do not let go of me. I am not letting go of you.',
    'zone-sea': 'We are under the sea and I am dry. I do not approve, but I am interested.',
    'zone-warren': 'Home. It smells of soup and wet wool. They will not say my name. That is all right. I know it.',
    'gem-leaf': 'It smells green. Like the inside of a pea pod. Put it in the spiral, go on.',
    'gem-stone': 'He called you short. He is right. I like him.',
    'gem-light': 'Do not tell me it is beautiful. Tell me what it is like. Like honey? Like a bell? Like both?',
    'gem-wind': 'That was the best noise I have ever heard, and I once heard a cake fall down a well.',
    'gem-water': 'Rain! On my actual face! In the actual sky!',
    'gem-moon': 'The big singing one. Did it look at us? I think it looked at us.',
    idle: [
        'I counted your footsteps. You have two different ones. The left is braver.',
        'If you see a button, any button, I collect them. I mean, you see it. I will hold it.',
        'Goblins are not blind in the dark. Goblins are blind in the light. So really nothing has changed.',
        'Tell me what colour the sky is doing.',
        'I can hear a beetle thinking. It is thinking about a different beetle.',
        'When this is done I am going to sleep for a week, and then have soup.',
    ],
    // in the tunnels
    'tun-enter': ['In I go. Talk to me. Which way?', 'Small and dark. Finally, somewhere sensible. Which way?'],
    'tun-step': ['Shuffle, shuffle.', 'Going.', 'Still going.', 'Mm-hm.', 'Stone under my hands. Onward.'],
    'tun-bump': ['Ow. That is a wall.', 'No. Wall. Definitely wall.', 'Nose first into rock. Thank you for that.', 'That way is all stone and no way.'],
    'tun-warm': ['The hum is closer. Warmer.', 'Yes. I can feel a draught from it. Closer.', 'Warmer, warmer.'],
    'tun-cold': ['Colder. The hum is behind me now.', 'It is getting quieter. I think not this way.'],
    'tun-bauble': ['Wait. Something small down here. Mine now.', 'Ooh. A thing! In my pocket it goes.'],
    'tun-nothing': ['I am patting about. Dust, pebble, pebble. Nothing here.', 'Nothing to pull or pocket here.'],
    'tun-back': ['Coming back. Keep talking so I can find you.', 'Backing out. Do not stand on my hands.'],
    'tun-out': ['Out! Did I do well? I did well.', 'Daylight. I can feel it on my ears.'],
    // the keepsakes
    'set-seaglass': 'All twelve. Granny says sea-glass is bottles that went travelling and came back gentle.',
    'set-feather': 'Twelve feathers. Hold one to my ear? ... It still remembers flying.',
    'set-shard': 'A whole lantern of glimmer. Give it here. I cannot see it, but it tickles.',
    'set-crown': 'Twelve crowns. The queen with no gates would say: buy everybody soup.',
    'set-starseed': 'Star-seeds. Plant them somewhere dark, the sky-folk said. I know somewhere dark.',
    'set-songshell': 'Listen. They are all singing the soup song. The sea-folk had priorities.',
    'set-button': 'Twelve buttons! The Good Button Tin! Do you know how long I have wanted to fill the Good Button Tin?',
    'set-bauble': 'That is all of my finds. A museum. Entry is one button. You may come in free.',
};

/** Other voices: one or two lines each. */
export const OTHERS = {
    golemAsk: { who: 'Grandfather Lichen', text: 'Hrrrm. Someone small. I am mostly asleep. My three heart-runes have rolled away over the years. Bring them, and I will remember how to stand.' },
    golemDone: { who: 'Grandfather Lichen', text: 'Ahhh. There I am. I had forgotten I was so tall. Warden: the Stone Gem. The boulder at Glimmerdeep is an old friend. Ask it nicely.' },
    organAsk: { who: 'The wind organ', text: 'A wall of dull green pipes, and three empty sockets in the front rank. When you touch the keys the bellows sigh, hopefully.' },
    organDone: { who: 'The wind organ', text: 'The three wanderers slide home. Somewhere inside, a hundred-year-old bellows takes a breath.' },
    tideAsk: { who: 'Tide Mother', text: 'A stone woman seated among carved waves, her cupped hands held out, closed. There are three small hollows in her lap, each the size of a pearl.' },
    tideDone: { who: 'Tide Mother', text: 'The last pearl settles. The stone hands turn, slowly, palms up.' },
    elder1: { who: 'Elder Grusk', text: 'A mage. In Underhome. And behind you is... no one. I see no one. The Hearth is cold, Warden. If your pendant can warm it, put its stones in the hearthstone. If not, there is soup.' },
    elder2: { who: 'Elder Grusk', text: 'The Heart lies down the Listening Dark. Every goblin with eyes has tried. Speak to the Dark\'s mouth, behind the hall. Speak to it... with whoever you have with you.' },
    elder3: { who: 'Elder Grusk', text: 'Fray Deep-Listener walks where she likes. Up, down, wherever. It is the law now. I have just made it.' },
};

/** What to do next, in Fray's words (the Hint button and the bot share these goals). */
export const HINTS = {
    meet: 'Small footprints lead west along the shore, towards a fallen shrine.',
    mint: 'Moonmint. Three sprigs, where the fog comes in off the sea. Then bring them to her.',
    healGive: 'You have the moonmint. Take it back to the goblin under the lintel.',
    rootTunnel: 'There is a ring of stones in the wood with no way in for you. But I can smell a root-way beside it. Send me.',
    leafGem: 'The stone door ground open. Something green is waiting in the middle of the ring.',
    vine: 'North, the ground stops at a cliff. There were dry vines on it. They might feel differently about you now.',
    runes: 'The big sleeper wants his three heart-runes. Two are out in the meadow. One is under the golem who lay down. That one is mine to fetch.',
    runesGive: 'Three runes, all humming. Take them to Grandfather Lichen.',
    cave: 'West along the high meadow there was a boulder in a cleft, and cold air. Ask it nicely.',
    caveGate: 'A wall of crystal blocks the way. There is a crack beside it just my size.',
    caveSing: 'Four singing stones round a dark one. There was a verse on a wall about the order. Low, far, low, far.',
    lightGem: 'It is awake. I can feel it on my face. Take it.',
    under: 'The castle on the eastern hill has a stair that goes down into the dark. You have a light that does not go out.',
    underGate: 'Iron bars, all the way down. But there is a drain beside them. Drains are my favourite.',
    pipes: 'The organ wants her three wandering pipes. Listen for hooting.',
    pipesGive: 'You have all three pipes. Give them back to the organ.',
    sky: 'In the castle yard there is a platform with no rail. I think you are meant to step off it. I think the wind will mind you.',
    skyValve: 'The cistern is dry. There is an old rain-pipe on the east side that only something small could crawl along.',
    skyVanes: 'Four weather vanes round the cistern. There was a rhyme: morning, evening, night, and dawn-before-dawn.',
    waterGem: 'Rain in the cistern, and something floating in it. Go on.',
    sea: 'White stairs on the western shore, going down into the sea. It will make room for you now. Apparently.',
    pearls: 'The stone lady wants three pearls. Two are lying about. One is down a dry pipe. Guess who.',
    pearlsGive: 'Three pearls. Give them to Tide Mother.',
    moonDoor: 'In the Mosswood, south-west, there is a round door in a hill. It only opens by moonlight. You are moonlight now.',
    elder: 'The big hall, in the middle. Elder Grusk. He will pretend not to see me. Talk to him anyway.',
    hearthSet: 'Put the gems in the hearthstone. All six.',
    dark: 'Behind the hall. The Listening Dark. Send me in. I am not afraid. I am a little afraid.',
    heartGive: 'I have the Heart. Take me to the Hearth.',
    done: 'There is nothing left to mend. Walk about. Tell me what you see.',
};
