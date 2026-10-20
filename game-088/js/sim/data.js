// Curio Cove's content: the finds you dig up, the dinosaurs they make, the halls, the staff,
// the restoration tasks and every line of dialogue. Pure data; the sim, the view and the UI
// all read it.

// ------------------------------------------------------------------ halls
export const HALLS = [
    { id: 'entrance', name: 'Entrance Hall', ch: 0 },
    { id: 'ancients', name: 'Hall of Ancients', ch: 1 },
    { id: 'fossils', name: 'Fossil Wing', ch: 2 },
    { id: 'sea', name: 'Sea Gallery', ch: 3 },
    { id: 'great', name: 'Great Hall', ch: 4 },
];

// ------------------------------------------------------------------ dinosaurs
export const BONE_PARTS = ['skull', 'neck', 'ribs', 'fore', 'hind', 'tail'];
export const PART_NAMES = { skull: 'Skull', neck: 'Neck Bones', ribs: 'Ribs & Spine', fore: 'Front Legs', hind: 'Back Legs', tail: 'Tail' };
export const DINOS = [
    { id: 'trike', name: 'Triceratops', hall: 'fossils', blurb: 'A plant-eater with three horns and a bony frill, about as heavy as an elephant.' },
    { id: 'plesio', name: 'Plesiosaur', hall: 'sea', blurb: 'A sea reptile with four flippers and a neck nearly as long as the rest of it.' },
    { id: 'trex', name: 'Tyrannosaurus', hall: 'great', blurb: 'The tyrant lizard king: twelve metres long, with teeth the size of bananas.' },
];

// ------------------------------------------------------------------ artifacts
// kind picks the procedural model in js/view/models.js; a, b are its two colours.
const A = (id, name, kind, a, b, blurb) => ({ id, name, kind, a, b, blurb });
const ART = {
    entrance: [
        A('jug', 'Fisherman’s Jug', 'vase', '#c8693b', '#f1d9a8', 'Glazed clay, still smelling faintly of the sea.'),
        A('lamp', 'Oil Lamp', 'lamp', '#b76b3a', '#ffd27a', 'People read by this little flame two thousand years ago.'),
        A('coin', 'Island Shilling', 'coin', '#e8c04a', '#a77d1d', 'Stamped with a puffin. The island minted its own money once.'),
        A('bowl', 'Painted Bowl', 'bowl', '#e9dfc8', '#3a7ec4', 'Blue waves painted round the rim by a careful hand.'),
        A('bell', 'Ship’s Bell', 'bell', '#d1a34a', '#6b4a1f', 'From the wreck of the Merry Puffin. It still rings true.'),
        A('compass', 'Brass Compass', 'compass', '#c99a3e', '#efe6cf', 'The needle points north, mostly. Sometimes it points home.'),
        A('figure', 'Clay Puffin', 'bird', '#2d2d33', '#f28a2e', 'Someone made this little puffin as a toy. It was loved.'),
        A('tablet', 'Tide Tablet', 'tablet', '#b89a72', '#6d5436', 'Scratched marks that count the tides for a whole year.'),
        A('bottle', 'Message in a Bottle', 'bottle', '#7fc8a9', '#f1e3c2', 'It says: “Wish you were here.” Nobody knows who wrote it.'),
        A('anchor', 'Little Anchor', 'anchor', '#6c7a86', '#3d4650', 'Too small for a ship. Perhaps for a very brave rowboat.'),
        A('kettle', 'Copper Kettle', 'kettle', '#c66e3e', '#3b2a1a', 'The first keeper of the lighthouse made tea in this.'),
        A('lantern', 'Storm Lantern', 'lantern', '#2f3a44', '#ffcf6a', 'It hung by the harbour every stormy night for fifty years.'),
    ],
    ancients: [
        A('amphora', 'Grand Amphora', 'vase', '#c75a32', '#2a1d16', 'Painted with dancers. It held olive oil for a feast.'),
        A('mask', 'Golden Mask', 'mask', '#e9c24e', '#2e6e8c', 'A calm, gold face with lapis eyes.'),
        A('helmet', 'Bronze Helmet', 'helmet', '#b48a3c', '#d84a3a', 'Its crest was once dyed bright red.'),
        A('scarab', 'Jade Scarab', 'beetle', '#3fae7a', '#d9c271', 'A lucky beetle carved from green stone.'),
        A('idol', 'Stone Head', 'idol', '#8f8a80', '#5c574e', 'A long-faced stone head that looks out to sea, patiently.'),
        A('sundial', 'Sundial', 'sundial', '#cfc6b2', '#7a6a48', 'Tells the time perfectly, as long as it is sunny.'),
        A('urn', 'Blue Urn', 'vase2', '#2f64b8', '#f3e7c9', 'Glazed the colour of a summer evening.'),
        A('mirror', 'Bronze Mirror', 'mirror', '#c49a4c', '#5a3d18', 'Polished bronze. Your great-great-ancestors fixed their hair in it.'),
        A('cat', 'Cat Statuette', 'cat', '#2c2a2f', '#e2b84b', 'A sleek, proud cat wearing a gold earring.'),
        A('abacus', 'Abacus', 'abacus', '#7a4b2a', '#e45b4b', 'An ancient calculator. Ledger approves.'),
        A('crown', 'Laurel Crown', 'laurel', '#d9b345', '#8aa04a', 'Woven golden leaves, given to the winner of a race.'),
        A('chest', 'Little Treasure Box', 'chest', '#8a5a33', '#e7c35a', 'It was empty. The treasure was the box all along.'),
    ],
    fossils: [
        A('trilobite', 'Trilobite', 'trilobite', '#7c6b58', '#3f3429', 'One of the first animals with eyes, half a billion years old.'),
        A('ammonite', 'Rainbow Ammonite', 'shell', '#c98a5a', '#5fb3c9', 'Its shell shimmers like the inside of a soap bubble.'),
        A('amber', 'Amber Drop', 'amber', '#f0a030', '#5a3a10', 'A tiny mosquito, stuck in tree sap for forty million years.'),
        A('fern', 'Fern Fossil', 'slab', '#a59a86', '#4e6e3a', 'A fern leaf pressed into stone like a flower in a book.'),
        A('tooth', 'Megalodon Tooth', 'tooth', '#5d6670', '#c8c2b4', 'From a shark the size of a bus. Kit cannot stop staring.'),
        A('egg', 'Dinosaur Egg', 'egg', '#b8a68c', '#7d6c55', 'Fossilised, and very definitely not going to hatch.'),
    ],
    sea: [
        A('nautilus', 'Nautilus Shell', 'shell', '#efe4d0', '#c46a3a', 'Still living in the oceans today, nearly unchanged.'),
        A('coral', 'Red Coral', 'coral', '#e24f4f', '#f7c9b5', 'Grown by tiny animals, one sliver at a time.'),
        A('pearl', 'Giant Pearl', 'pearl', '#f4f0ff', '#d9c7ef', 'As big as a gull’s egg. It glows in the lamplight.'),
        A('astrolabe', 'Astrolabe', 'compass2', '#d2a24a', '#2a3a5a', 'Sailors read the stars with it to find their way.'),
        A('figurehead', 'Mermaid Figurehead', 'idol2', '#3a8c8c', '#e6b36a', 'She guided a ship safely through a hundred storms.'),
        A('urchin', 'Fossil Sea Urchin', 'urchin', '#bfae8a', '#6e5d3c', 'A star pattern on a stone bun. People called them fairy loaves.'),
    ],
    great: [
        A('throne', 'Driftwood Throne', 'throne', '#8f6b46', '#4fa6a0', 'The first island chief sat on this. It is quite uncomfortable.'),
        A('gong', 'Festival Gong', 'gong', '#d9a63a', '#7a2f2f', 'Rung once a year to start the summer festival.'),
        A('globe', 'Antique Globe', 'globe', '#4a8fc2', '#e7d39a', 'Some of the countries on it have changed their names since.'),
        A('telescope', 'Brass Telescope', 'telescope', '#c9973f', '#3a2a1a', 'Aunt Marigold spotted her first comet through this.'),
        A('jewel', 'Star Sapphire', 'gem', '#3b5fd9', '#eaf0ff', 'A six-rayed star shines inside when the light is right.'),
        A('harp', 'Little Harp', 'harp', '#b77b3e', '#f3e2b0', 'It plays a tune all by itself when the sea wind blows.'),
    ],
};

/** Every find you can be given, in the order the story's levels hand them out. */
export const ITEMS = [];
{
    const bones = (dino) => BONE_PARTS.map((p) => ({ id: `${dino}-${p}`, name: `${DINOS.find((d) => d.id === dino).name} ${PART_NAMES[p]}`, kind: 'bone', dino, part: p }));
    const order = {
        entrance: ART.entrance,
        ancients: ART.ancients,
        fossils: interleave(ART.fossils, bones('trike')),
        sea: interleave(ART.sea, bones('plesio')),
        great: interleave(ART.great, bones('trex')),
    };
    for (const h of HALLS) for (const it of order[h.id]) ITEMS.push({ ...it, hall: h.id });
}
function interleave(a, b) { const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (b[i]) out.push(b[i]); if (a[i]) out.push(a[i]); } return out; }
export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
/** The find a story level gives the first time you clear it. */
export const rewardFor = (n) => (n >= 1 && n <= ITEMS.length ? ITEMS[n - 1].id : null);

// ------------------------------------------------------------------ people
export const PEOPLE = {
    you: { name: '{name}', animal: 'player', color: '#7aa6d9' },
    gus: { name: 'Captain Gus', animal: 'otter', role: 'Ferry captain', color: '#8a5a3a' },
    moss: { name: 'Moss', animal: 'badger', role: 'Caretaker', color: '#5a5a62', perk: 'Keeps the halls spotless: visitors like the place more (+5 appeal).' },
    penny: { name: 'Penny Quill', animal: 'owl', role: 'Administrator', color: '#b08a5a', perk: 'Sells tickets properly: +25% coins from visitors.' },
    ledger: { name: 'Tobias Ledger', animal: 'tortoise', role: 'Accountant', color: '#6f8f4a', perk: 'Keeps the books: the till holds three times as much.' },
    kit: { name: 'Kit', animal: 'fox', role: 'Tour guide', color: '#e2783a', perk: 'Gives tours: +50% visitors.' },
    rosa: { name: 'Rosa', animal: 'raccoon', role: 'Restorer', color: '#7d7d86', perk: 'Restores every find on show: each counts double.' },
    marigold: { name: 'Aunt Marigold', animal: 'hare', role: 'Your great-aunt, at sea', color: '#d9a0b8' },
};
export const STAFF = ['moss', 'penny', 'ledger', 'kit', 'rosa'];

// ------------------------------------------------------------------ restoration tasks
// fx: flags the museum view reads to show or hide its props. needs: a dinosaur to be complete.
const T = (id, ch, title, cost, extra = {}) => ({ id, ch, title, cost, fx: [id], ...extra });
export const TASKS = [
    T('door', 0, 'Prop open the creaky front door', 1),
    T('sweep', 0, 'Sweep out the sand and seaweed', 2),
    T('hire-moss', 0, 'Hire a caretaker', 2, { staff: 'moss' }),
    T('roof', 0, 'Patch the leaky roof', 3),
    T('booth', 0, 'Fix up the ticket booth', 2),
    T('cases', 0, 'Set out the first display cases', 3, { opens: 'entrance' }),
    T('sign', 0, 'Hang the museum sign', 2),
    T('open-entrance', 0, 'Open the Entrance Hall to visitors!', 3, { end: true }),

    T('vines', 1, 'Clear the vines from the west wing', 2),
    T('hire-penny', 1, 'Hire an administrator', 2, { staff: 'penny' }),
    T('floor', 1, 'Polish the old floorboards', 2),
    T('permits', 1, 'Fill in a mountain of permits', 1),
    T('plinths', 1, 'Build the stone plinths', 3, { opens: 'ancients' }),
    T('lanterns', 1, 'Light the paper lanterns', 2),
    T('garden', 1, 'Plant the courtyard garden', 3),
    T('open-ancients', 1, 'Open the Hall of Ancients!', 3, { end: true }),

    T('unboard', 2, 'Take the boards off the east wing', 2),
    T('hire-ledger', 2, 'Hire an accountant', 2, { staff: 'ledger' }),
    T('skylight', 2, 'Mend the skylight', 3),
    T('drawers', 2, 'Install the fossil drawers', 2, { opens: 'fossils' }),
    T('stand', 2, 'Build a sturdy skeleton stand', 2),
    T('build-trike', 2, 'Assemble the Triceratops', 3, { needs: 'trike' }),
    T('mural', 2, 'Paint a jungle mural', 2),
    T('open-fossils', 2, 'Open the Fossil Wing!', 3, { end: true }),

    T('glass', 3, 'Fit new glass in the old aquarium', 2),
    T('hire-kit', 3, 'Hire a tour guide', 2, { staff: 'kit' }),
    T('waves', 3, 'Paint waves on the gallery walls', 2),
    T('cabinet', 3, 'Build the shell cabinets', 2, { opens: 'sea' }),
    T('dock', 3, 'Repair the old dock', 3),
    T('build-plesio', 3, 'Assemble the Plesiosaur', 3, { needs: 'plesio' }),
    T('open-sea', 3, 'Open the Sea Gallery!', 3, { end: true }),

    T('rubble', 4, 'Clear the rubble from the Great Hall', 3),
    T('hire-rosa', 4, 'Hire a restorer', 2, { staff: 'rosa' }),
    T('beams', 4, 'Raise the great oak beams', 3, { opens: 'great' }),
    T('build-trex', 4, 'Assemble the Tyrannosaurus', 3, { needs: 'trex' }),
    T('lights', 4, 'String up the festival lights', 2),
    T('banners', 4, 'Hang the reopening banners', 2),
    T('grand', 4, 'The Grand Reopening!', 3, { end: true, finale: true }),
];
export const TASK = Object.fromEntries(TASKS.map((t) => [t.id, t]));

export const CHAPTERS = [
    { title: 'A Museum by the Sea', hall: 'entrance' },
    { title: 'The Hall of Ancients', hall: 'ancients' },
    { title: 'Bones in the East Wing', hall: 'fossils' },
    { title: 'The Sea Gallery', hall: 'sea' },
    { title: 'The Grand Reopening', hall: 'great' },
];

// ------------------------------------------------------------------ decorations (a coin sink)
export const DECOR = [
    { id: 'bench', name: 'Seaside Benches', cost: 150, appeal: 3 },
    { id: 'flowers', name: 'Flower Beds', cost: 250, appeal: 4 },
    { id: 'lamps', name: 'Lamp Posts', cost: 400, appeal: 5 },
    { id: 'fountain', name: 'Puffin Fountain', cost: 700, appeal: 8 },
    { id: 'icecream', name: 'Ice Cream Cart', cost: 900, appeal: 9 },
    { id: 'lighthouse', name: 'Lighthouse Fresh Paint', cost: 1200, appeal: 12 },
    { id: 'bandstand', name: 'Bandstand', cost: 1600, appeal: 14 },
    { id: 'balloon', name: 'Hot-Air Balloon Rides', cost: 2400, appeal: 20 },
];

// ------------------------------------------------------------------ dialogue
// Each scene is a list of [speaker, line]. {name} is the player's name.
export const SCENES = {
    intro: [
        ['gus', 'Ahoy there! You must be {name}, fresh from the university. Hop aboard, it’s a short trip to Puffin Isle.'],
        ['gus', 'Your great-aunt Marigold ran the museum on the island for forty years. Then one morning she bought a sailboat and set off round the world.'],
        ['gus', 'She left you a letter. And, er… the museum.'],
        ['marigold', 'My dear {name}, congratulations on your degree! I always knew you’d be an archaeologist. You used to dig up my whole garden looking for dinosaurs.'],
        ['marigold', 'The Curio Cove Museum is yours now. I’m afraid it has got a little… tired. The collection went off to be cleaned years ago and never came back.'],
        ['marigold', 'But this island is full of history, and bones, and treasure. Dig it up, fill the halls, and make the old place sing again. Love, Aunt M. P.S. Feed the gulls.'],
        ['gus', 'Here we are. Mind the step… and the hole in the step… and the seaweed.'],
        ['you', 'Oh. Oh my. The roof is half missing, there’s sand everywhere, and is that a crab living in the ticket booth?'],
        ['gus', 'That’s Clement. He’s been here longer than me. Tell you what: there’s an old dig site just up the hill. Why not start there?'],
    ],
    door: [['gus', 'One good shove… there! The door’s open. Mind you, it squeaks like a seagull with a cold.'], ['you', 'It’s a start. A squeaky, sandy start.']],
    sweep: [['you', 'Three buckets of sand, one surprised crab and a very old sandwich. The entrance looks almost like a museum now.']],
    'hire-moss': [
        ['gus', 'I brought someone over on the morning ferry. Says he saw your notice in the harbour.'],
        ['moss', 'Name’s Moss. I do floors, windows, leaks and lost things. This is Duchess.'],
        ['you', 'Duchess?'],
        ['moss', 'My mop. Best mop on the coast. Don’t worry, {name}. Give me a week and this place will shine.'],
    ],
    roof: [['moss', 'Patched the roof. Found a gull’s nest up there, so I left a little gap for her. She was here first.'], ['you', 'That’s… actually very kind, Moss.']],
    booth: [['moss', 'Clement the crab has moved into a nicer shell under the pier. The ticket booth is yours.'], ['you', 'Now visitors can actually buy tickets. Coins will start piling up in the till!']],
    cases: [['you', 'The display cases are up! Everything I’ve dug up so far has a proper home now.'], ['moss', 'Dusted every one of them twice.']],
    sign: [['gus', 'You can see that sign from my ferry! “Curio Cove Museum.” Marigold would be proud.']],
    'open-entrance': [
        ['you', 'Look, Moss! Real visitors! A whole family of puffins and a very old seal.'],
        ['moss', 'The seal’s called Barnaby. He comes for the air conditioning.'],
        ['gus', 'Post for you, {name}! All the way from the other side of the world.'],
        ['marigold', 'Dearest {name}, Gus tells me the doors are open again. I danced a jig on deck when I read it. The dolphins were unimpressed.'],
        ['marigold', 'The west wing was once the Hall of Ancients: treasures from every people who ever lived on these islands. Fill it again for me? Love, Aunt M.'],
    ],
    vines: [['you', 'The west wing was so full of vines it was practically a jungle. I found a bronze helmet in there! And a very startled lizard.']],
    'hire-penny': [
        ['penny', 'Oh! Hello! You must be {name}. I’m Penny Quill. I saw the notice. I love notices. I made this notice into a notice about the notice.'],
        ['penny', 'I’ve run three libraries, a lighthouse and a post office. I can run a museum. I have a clipboard. I have six clipboards.'],
        ['you', 'You’re hired, Penny.'],
        ['penny', 'Wonderful! I’ll sort the tickets properly. Moss has been taking payment in sea glass.'],
        ['moss', 'Sea glass is very pretty.'],
    ],
    floor: [['moss', 'Polished every board. You can see your face in them. Duchess is exhausted.']],
    permits: [
        ['penny', 'Right! This is the permit to apply for a permit to display ancient things. And this one says we’re allowed to have permits.'],
        ['you', 'How many forms is that?'],
        ['penny', 'Forty-one. I’ve stamped them all. Stamping is my favourite part.'],
    ],
    plinths: [['you', 'Stone plinths for every treasure in the Hall of Ancients. They look like they’ve always been there.']],
    lanterns: [['penny', 'The lanterns are lit! I made a timetable for when to light them. And a timetable for checking the timetable.']],
    garden: [['moss', 'Planted sea thrift and lavender in the courtyard. The bees have already found it.'], ['you', 'It smells wonderful out here.']],
    'open-ancients': [
        ['penny', 'The Hall of Ancients is open! Forty-two visitors this morning. I counted them. Twice.'],
        ['gus', 'Another letter, {name}!'],
        ['marigold', 'My dear {name}, a museum with a Hall of Ancients again! I told a sea turtle all about it. He seemed interested, though it is hard to tell with turtles.'],
        ['marigold', 'Now, the east wing. When I was young we found a dinosaur on this island. A real Triceratops! The bones were scattered in the hills. Find them? Love, Aunt M.'],
    ],
    unboard: [['moss', 'Took the boards off the east wing. It’s dusty, but the light in there is lovely.'], ['you', 'This is where the Triceratops will stand. I can already picture it.']],
    'hire-ledger': [
        ['ledger', 'Good… afternoon. I am Tobias… Ledger. Accountant. I came… as quickly… as I could.'],
        ['penny', 'He applied in spring.'],
        ['ledger', 'As I said. Quickly. Now, {name}, your till is a shoebox. A museum needs… a proper till. And a budget.'],
        ['ledger', 'I shall count every coin. Twice. Slowly. Nothing escapes a tortoise.'],
    ],
    skylight: [['you', 'With the skylight mended, sunlight falls right where the skeleton will stand. Perfect.']],
    drawers: [['ledger', 'Fossil drawers… one hundred and twelve. I counted them… three times. They are all… excellent drawers.']],
    stand: [['moss', 'Built the stand out of old ship’s timber. It’ll hold a dinosaur. It’d hold two.']],
    'build-trike': [
        ['you', 'Skull, frill, three horns, ribs, legs and tail… every bone in its place.'],
        ['kit', 'WHOA! Is that a REAL Triceratops?!'],
        ['you', 'It is! And who are you?'],
        ['kit', 'I’m Kit! I live in the village. I know EVERYTHING about dinosaurs. Did you know its frill might have been for showing off? Like a peacock! A three-tonne peacock!'],
    ],
    mural: [['penny', 'The mural is finished! Moss painted the ferns. I painted the sky. Ledger painted one leaf. It took him all week.'], ['ledger', 'It is… a very good leaf.']],
    'open-fossils': [
        ['kit', 'There’s a queue to see the Triceratops all the way down to the harbour!'],
        ['ledger', 'Ticket sales are up… two hundred percent. I have… checked.'],
        ['marigold', 'Darling {name}, a Triceratops! I cried into my soup. Then I ate the soup, because it was good soup.'],
        ['marigold', 'The old Sea Gallery is next. There’s a plesiosaur in the cliffs by the north beach, I’m sure of it. The fishermen have found bones for years. Love, Aunt M.'],
    ],
    glass: [['moss', 'New glass in the aquarium. I polished it so well a gull tried to fly through it. She’s fine. Offended, but fine.']],
    'hire-kit': [
        ['kit', 'Please please PLEASE can I be the tour guide? I’ve practised! “Welcome to Curio Cove, home of the BEST bones in the WHOLE sea!”'],
        ['you', 'Kit, you’re hired.'],
        ['kit', 'YESSS! I’m going to do voices! The plesiosaur will have a voice! It’ll be posh.'],
    ],
    waves: [['penny', 'Waves on every wall! It feels like being under the sea. Moss keeps checking if his feet are wet.']],
    cabinet: [['you', 'Shell cabinets, every shelf lined with sea-blue velvet. The nautilus looks like it’s floating.']],
    dock: [['gus', 'With the dock fixed I can bring visitors right to your door! Three boatloads tomorrow, and a choir of sea shanty singers.']],
    'build-plesio': [
        ['kit', '(in a posh voice) “Good evening. I am Priscilla the Plesiosaur, and I have the most magnificent neck in the ocean.”'],
        ['you', 'She does have a magnificent neck.'],
        ['kit', 'Seventy-two neck bones! I counted. Ledger helped. It took a while.'],
    ],
    'open-sea': [
        ['penny', 'The Sea Gallery is open! The shanty choir sang on the dock all afternoon. Barnaby the seal joined in. Badly.'],
        ['marigold', 'My dear {name}, I’ve had your letters about the Sea Gallery read aloud to every port from here to the Spice Islands.'],
        ['marigold', 'There is one hall left: the Great Hall, where the roof fell in the big storm. If you can fill that, I think I shall have to come home and see it. Love, Aunt M.'],
    ],
    rubble: [['moss', 'Cleared the Great Hall. Forty barrows of rubble. Found a sapphire in the last one.'], ['you', 'Moss! That’s a Star Sapphire!'], ['moss', 'Thought it was a nice pebble.']],
    'hire-rosa': [
        ['rosa', 'Hiya! Rosa. Restorer. I fix old things so they look like old things should, not like old things that fell down a well.'],
        ['rosa', 'Ooh, is that a Grand Amphora? Let me at it. I’ll have it looking two thousand years young.'],
        ['ledger', 'She charges… very reasonable rates. I have… checked.'],
    ],
    beams: [['gus', 'Four great oak beams, brought over on my ferry one at a time. My poor boat!'], ['moss', 'The roof’s back on the Great Hall. Only the gull’s gap left. She’s moved in again.']],
    'build-trex': [
        ['kit', 'It’s… it’s… a TYRANNOSAURUS REX. In OUR museum. I think I need to sit down.'],
        ['rosa', 'I glued its tooth back in. It’s the biggest tooth I have ever glued.'],
        ['you', 'Twelve metres of bone, and every one of them dug up on Puffin Isle.'],
    ],
    lights: [['penny', 'Festival lights strung from the lighthouse to the dock! I made a map of every single bulb.']],
    banners: [['rosa', 'Painted the banners myself. That one’s you, {name}, holding a trowel heroically.'], ['you', 'Do I really look that heroic?'], ['rosa', 'Artistic licence.']],
    grand: [
        ['penny', 'Everyone’s here, {name}! The whole village, three boatloads from the mainland, the shanty choir, and Barnaby.'],
        ['gus', 'And one more passenger, just off the morning tide…'],
        ['marigold', '{name}! Oh, my dear! Look at it. Look at all of it!'],
        ['you', 'Aunt Marigold! You came home!'],
        ['marigold', 'Of course I did. I sailed round the world and saw a hundred wonders, but I think this is my favourite.'],
        ['marigold', 'You did what I always hoped. You didn’t just fill a museum. You found the island’s story, and you found people to share it with.'],
        ['moss', 'Duchess and I would like to say… it’s been a good year.'],
        ['ledger', 'The museum is… in profit. I have… checked. Twice.'],
        ['kit', 'Can we dig up MORE dinosaurs? Please? There must be more!'],
        ['marigold', 'There are always more. The night digs on the hill are wonderful by lantern light. Shall we go and see, {name}?'],
    ],
    finale: [['penny', 'THE END! (Of the beginning.) The Night Digs are open: endless digs by lantern light, a star for every win, and new decorations in the shop.']],
};

/** Short lines a staff member says when you tap them in the museum. */
export const CHATTER = {
    moss: ['Duchess and I have done the windows.', 'Mind the wet floor. Always mind the wet floor.', 'Found a button. Probably Roman.', 'The gull says hello.'],
    penny: ['I’ve alphabetised the visitors.', 'Tickets are selling like hot cross buns!', 'I made a form for compliments. Would you like one?', 'Stamp, stamp, stamp. Lovely.'],
    ledger: ['The till… is filling… nicely.', 'A penny saved… is a penny… counted.', 'I balanced the books. They were… wobbly.', 'Mm. Profit.'],
    kit: ['Did you know Triceratops had up to eight hundred teeth?!', 'I’m doing the posh plesiosaur voice on the next tour!', 'When I grow up I’m going to be YOU.', 'T. rex arms are tiny but STRONG.'],
    rosa: ['Every scratch tells a story. I just make the story readable.', 'I’ve got glue in my fur again.', 'That amphora has seen things.', 'Old things deserve a little love.'],
    gus: ['Fair winds today.', 'The ferry’s full of museum folk these days!', 'Clement says hello from under the pier.'],
};
