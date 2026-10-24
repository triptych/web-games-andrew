// Content tables for Homeward Hop: shells, parts, inventions, worlds, levels and every line of story.
// Pure data. The sim reads the numbers; the UI reads the words.

// ---------------------------------------------------------------- shells
export const SHELLS = [
    { id: 'spiral', name: 'Spiral Shell', icon: '🐚', power: 'Shell Roll',
      blurb: 'Curl up and roll! Smashes crates and baddies. Jump out of a roll for a long, long leap.',
      how: 'Power: roll forward. Jump while rolling: long jump.', color: 0xf2a56b },
    { id: 'coconut', name: 'Coconut Shell', icon: '🥥', power: 'Brace',
      blurb: 'Hold up the coconut like a shield. Coconuts and cannonballs from the front bounce right back.',
      how: 'Hold Power: shield up. Flying things from the front are blocked, or sent back.', color: 0x8a5a36 },
    { id: 'anchor', name: 'Peach-Can Shell', icon: '🥫', power: 'Ground Pound',
      blurb: 'An old peach tin, very heavy. Slam down to smash iron crates, press big switches and daze the neighbours.',
      how: 'Power: pound the ground (in the air, dive!).', color: 0xc9d2da },
    { id: 'sail', name: 'Sail Shell', icon: '⛵', power: 'Glide',
      blurb: 'A scrap of beach towel on a stick. Float over wide gaps, and ride the bubble vents up.',
      how: 'In the air, press Jump again (or hold Power) to glide. Let go to drop.', color: 0xffe27a },
    { id: 'spring', name: 'Spring Shell', icon: '🌀', power: 'Super Hop',
      blurb: 'A coiled spring from a very old mattress. Squash it down, let go, and boing up to high ledges.',
      how: 'Hold Power on the ground to squash, release to hop. Longer squash, higher hop.', color: 0x7ad7ff },
];

// ---------------------------------------------------------------- found things
export const PARTS = {
    cap:    { name: 'Bottle Cap',  icon: '🔘' },
    button: { name: 'Button',      icon: '🔵' },
    glass:  { name: 'Sea Glass',   icon: '💠' },
    spring: { name: 'Spring',      icon: '🪀' },
    gear:   { name: 'Gear',        icon: '⚙️' },
    string: { name: 'String',      icon: '🧵' },
    cork:   { name: 'Cork',        icon: '🍾' },
    spoon:  { name: 'Teaspoon',    icon: '🥄' },
    magnet: { name: 'Magnet',      icon: '🧲' },
    bulb:   { name: 'Light Bulb',  icon: '💡' },
};

// ---------------------------------------------------------------- inventions (equip up to three)
// fx keys are read by the sim: hearts, magnet, jump, spin, rescue, curioSense, crumble, glide, bounce, swapGrace
export const INVENTIONS = [
    { id: 'boater', name: 'Bottle-Cap Boater', icon: '👒', cost: { cap: 1, string: 1 }, fx: { hearts: 1 },
      blurb: 'A jaunty hat with a strap. Pinch swears it protects against everything. +1 heart.' },
    { id: 'magnet', name: 'Button Magnet', icon: '🧲', cost: { button: 1, magnet: 1 }, fx: { magnet: 1 },
      blurb: 'Pearls roll toward you from four metres away. They are very polite about it.' },
    { id: 'boots', name: 'Rubber-Band Boots', icon: '🥾', cost: { string: 1, spring: 1 }, fx: { jump: 1.1 },
      blurb: 'Two rubber bands and a dream. Jump 10% higher.' },
    { id: 'buoy', name: 'Cork Lifebuoy', icon: '🛟', cost: { cork: 2 }, fx: { rescue: 1 },
      blurb: 'Fall in the water once per level and a bubble fishes you out with no ouch.' },
    { id: 'spinner', name: 'Spoon Spinner', icon: '🥄', cost: { spoon: 1, gear: 1 }, fx: { spin: 1.4 },
      blurb: 'Spin attacks reach 40% further. Stir the world a bit.' },
    { id: 'specs', name: 'Sea-Glass Specs', icon: '🥽', cost: { glass: 2 }, fx: { curioSense: 1 },
      blurb: 'Tinted lenses show where the nearest hidden found-thing is with a little arrow.' },
    { id: 'watch', name: 'Tick-Tock Watch', icon: '⌚', cost: { gear: 2, glass: 1 }, fx: { crumble: 1.9 },
      blurb: 'Slows time, but only for crumbly sand. Crumbling platforms last almost twice as long.' },
    { id: 'parasol', name: 'Parasol Pop', icon: '🌂', cost: { string: 1, glass: 1, cork: 1 }, fx: { glide: 1 },
      blurb: 'Bolt it onto the Sail Shell: slower, floatier, further glides.' },
    { id: 'boing', name: 'Boing Springs', icon: '🛏️', cost: { spring: 2, cork: 1 }, fx: { bounce: 1.25 },
      blurb: 'Sponges, crates and heads of baddies launch you 25% higher.' },
    { id: 'sparkler', name: 'Swap Sparkler', icon: '🎇', cost: { bulb: 1, button: 1 }, fx: { swapGrace: 1 },
      blurb: 'Changing shells throws up a flash that keeps you safe for a second.' },
];
export const MAX_EQUIPPED = 3;

// ---------------------------------------------------------------- worlds and levels
export const WORLDS = [
    { id: 1, name: 'Sunny Shallows', theme: 'beach',  icon: '🏖️', blurb: 'Warm sand, friendly waves, and a lot of fleas.' },
    { id: 2, name: 'Coconut Cove',   theme: 'jungle', icon: '🥥', blurb: 'Where the coconuts are, and so are the monkeys who throw them.' },
    { id: 3, name: 'Rustwater Docks', theme: 'pier',  icon: '⚓', blurb: 'Creaky boards, cannons, and crates that mean business.' },
    { id: 4, name: 'Sandcastle Kingdom', theme: 'castle', icon: '🏰', blurb: 'A kingdom of sand with very strict rules about moats.' },
    { id: 5, name: 'Stormbreak Point', theme: 'storm', icon: '🌩️', blurb: 'The last stretch: one lighthouse, one gull, and home just beyond.' },
];

// curios: the three found-things hidden in the level (kinds). par: seconds for the stopwatch badge.
export const LEVELS = [
    { id: 'l1_1', world: 1, name: 'Hello, Tide Pool', curios: ['cap', 'button', 'glass'], par: 130,
      hint: 'Run, jump, and bonk crates with a spin!', note: 'Dear Pinch, Dot says the tide pool is boring without you. Pa says to stop worrying. I am worrying. Love, Ma.' },
    { id: 'l1_2', world: 1, name: 'Sandbar Scramble', curios: ['spoon', 'cork', 'string'], par: 150,
      hint: 'Roll (Power) to smash through, and roll-jump to leap the wide ones.', note: 'Pinch! Pa found your old gadget bench. He tried to fix it and made it worse. Please come home. Dot.' },
    { id: 'l2_1', world: 2, name: 'Monkey Business', curios: ['spring', 'string', 'bulb'], par: 170,
      hint: 'Hold Power with the Coconut Shell to block coconuts. Blocked coconuts fly back!', note: 'We heard there are monkeys in the cove. Be nice to them. Do not throw anything. Pa.' },
    { id: 'l2_2', world: 2, name: 'Barrel Bounce Bay', curios: ['gear', 'cork', 'glass'], par: 170,
      hint: 'Step into a barrel and it fires you across the bay. Crumbly logs do not last.', note: 'Granny Whelk says barrels are the best way to travel. Granny Whelk is also wearing a barrel. Ma.' },
    { id: 'l2_3', world: 2, name: "Big Coco's Beach Bash", curios: ['magnet', 'button', 'spring'], par: 120, boss: 'coco',
      hint: 'Block his coconuts with the shield. Bounce three back at him!', note: 'Big Coco sent us a postcard. It says "Sorry about the coconuts." He signed it with a drawing of a coconut. Dot.' },
    { id: 'l3_1', world: 3, name: 'Plank Walk Blues', curios: ['gear', 'cork', 'string'], par: 190,
      hint: 'Big red switches need a Ground Pound. Cannonballs bounce off a raised shield.', note: 'The docks! Smells like fish. Smells like adventure. Mostly fish. Pa.' },
    { id: 'l3_2', world: 3, name: 'Crate Expectations', curios: ['glass', 'spoon', 'spring'], par: 200,
      hint: 'Iron crates only break to a Ground Pound. Mind the gulls.', note: 'Pinch, you are doing so well. Please eat. There are no snacks in a bottle, but you know what I mean. Ma.' },
    { id: 'l4_1', world: 4, name: 'Moat Mischief', curios: ['cork', 'glass', 'gear'], par: 190,
      hint: 'Sail Shell: press Jump in the air to glide. Bubble vents will lift you higher.', note: 'We are going to build a sandcastle in your honour. Dot has already knocked it over twice.' },
    { id: 'l4_2', world: 4, name: 'Turret Terrace', curios: ['string', 'magnet', 'button'], par: 220,
      hint: 'Armoured knights shrug off spins. Try dropping on them with a Ground Pound.', note: 'Granny says sand knights are just big kids in tin hats. Granny is usually right. Pa.' },
    { id: 'l4_3', world: 4, name: "Sir Sandy's Keep", curios: ['spring', 'bulb', 'cap'], par: 130, boss: 'sandy',
      hint: 'Pound the ground near Sir Sandy to daze him, then spin his crown!', note: 'We are thinking of you, Pinch. Also Dot is wearing your goggles. Do not be cross. Ma.' },
    { id: 'l5_1', world: 5, name: 'Wave Chaser', curios: ['glass', 'gear', 'cork'], par: 100,
      hint: 'RUN! The big wave is grumpy and it is catching up.', note: 'The tide is high and the sky is funny. Please hurry. We have kept your dinner warm. Ma and Pa.' },
    { id: 'l5_2', world: 5, name: 'Lighthouse Hop', curios: ['string', 'spoon', 'spring'], par: 220,
      hint: 'Every shell you have is useful up here. Swap with Q and E.', note: 'You can see the lighthouse from the reef! We waved. Did you see us wave? Dot.' },
    { id: 'l5_3', world: 5, name: "Captain Squawk's Roost", curios: ['button', 'magnet', 'bulb'], par: 150, boss: 'squawk',
      hint: 'Spin him when he crashes. Block his volleys. Pound the ground to knock him out of the sky.', note: '(No bottle: the gull has it.)' },
    { id: 'l5_4', world: 5, name: 'Home Sweet Reef', curios: ['cap', 'gear', 'glass'], par: 140, final: true,
      hint: 'Almost there. Take your time.', note: 'You made it.' },
];
export const levelMeta = (id) => LEVELS.find((l) => l.id === id);
export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);
export const worldOf = (id) => WORLDS.find((w) => w.id === levelMeta(id).world);
export const LEVELS_IN = (w) => LEVELS.filter((l) => l.world === w);

/** How many shells have been earned: one to start, one more for each world finished. */
export function shellsEarned(cleared) {
    let n = 1;
    for (const w of WORLDS) {
        if (LEVELS_IN(w.id).every((l) => cleared[l.id])) n++;
    }
    return Math.min(SHELLS.length, n);
}

// ---------------------------------------------------------------- the story
export const CAST = {
    pinch: { name: 'Pinch', face: '🦀', color: '#ff7a4d' },
    ma: { name: 'Ma', face: '🐚', color: '#f2a56b' },
    pa: { name: 'Pa', face: '🦞', color: '#e0553a' },
    dot: { name: 'Dot', face: '🦐', color: '#ff9ec4' },
    granny: { name: 'Granny Whelk', face: '🐌', color: '#b49be0' },
    coco: { name: 'Big Coco', face: '🥥', color: '#8a5a36' },
    sandy: { name: 'Sir Sandy', face: '🏰', color: '#e9c77e' },
    squawk: { name: 'Captain Squawk', face: '🦅', color: '#6ba3d6' },
    sign: { name: 'Sign', face: '🪧', color: '#c68d54' },
    narr: { name: '', face: '', color: '#6b5a4a' },
};

export const STORY = {
    intro: [
        { who: 'narr', text: 'Every spring the hermit crabs of Tide Pool Seven hold the great Shell Swap, where everybody trades up to a roomier shell and nobody argues. (Mostly.)' },
        { who: 'pinch', text: "I've made a gadget for it! It swaps shells in one second flat. Stand back, everyone. Gadget, go!" },
        { who: 'dot', text: 'It is making a noise, Pinch.' },
        { who: 'pinch', text: "That's the noise it's meant to make. Probably." },
        { who: 'narr', text: 'It was not the noise it was meant to make. There was a bang, a fizz, a very big wave, and then there was no more Tide Pool Seven.' },
        { who: 'pinch', text: "...Hello? Ma? Pa? Dot? I'm just going to need to find some more tools, and a way home. Luckily I never go anywhere without my toolbox." },
    ],
    w1: [
        { who: 'pinch', text: 'A beach! A nice, quiet beach. Nothing bad has ever happened on a beach.' },
        { who: 'sign', text: 'HOME REEF: 5 WORLDS THATAWAY. (Estimated hop time: a while.)' },
    ],
    w2: [
        { who: 'narr', text: 'Down on the sand, a faded coconut shell was rolling about, looking for someone to wear it.' },
        { who: 'pinch', text: 'A Coconut Shell! Sturdy! It smells like holidays. If anything throws a coconut at me, I can hold this up and it will bounce right back.' },
    ],
    w3: [
        { who: 'pinch', text: 'A dock! Boards! Rope! Several hundred crates! Look at all the things I could take apart!' },
        { who: 'narr', text: 'Lying next to a lamp-post was an old tin of peaches, empty, and just the right size.' },
        { who: 'pinch', text: 'Heavy. Tinny. Very, very pound-y. I love it.' },
    ],
    w4: [
        { who: 'narr', text: 'On a beach towel somebody had forgotten, a long stick and some clothes pegs were having a quiet think.' },
        { who: 'pinch', text: "A sail! If I rig the towel on the stick and tie it to my shell, I can float. I'm an inventor and a sailor!" },
        { who: 'sign', text: 'SANDCASTLE KINGDOM. NO RUNNING IN THE MOAT.' },
    ],
    w5: [
        { who: 'narr', text: 'Tucked in a dusty mattress at the foot of the lighthouse: one very bouncy coil, and just enough room to make a shell of it.' },
        { who: 'pinch', text: "Spring Shell! Every shell I've got now, all in the toolbox. Come on, Pinch. You're nearly home." },
    ],
    pre_l2_3: [
        { who: 'coco', text: "HALT! This beach is TAKEN. By me! Big Coco! Nobody passes without a coconut to the face." },
        { who: 'pinch', text: "I don't have a lot of face. Could we talk about it?" },
        { who: 'coco', text: 'NO. THROWING TIME.' },
    ],
    post_l2_3: [
        { who: 'coco', text: '...ow. Those were MY coconuts.' },
        { who: 'pinch', text: "I'm sorry! I just wanted to get through. Are you okay?" },
        { who: 'coco', text: "Nobody ever comes to the cove. I only wanted someone to play catch with. You're quite good at catch." },
        { who: 'pinch', text: "I'll write. Would you like to hold on to my spare cork? Everyone needs a cork." },
    ],
    pre_l4_3: [
        { who: 'sandy', text: 'HALT. WHO GOES? This is the Keep of Sir Sandy, defender of the Moat, and a very large castle.' },
        { who: 'pinch', text: "I'm only passing through. I'm trying to get home." },
        { who: 'sandy', text: 'Passing through requires a PERMIT. (There is no permit. I lost it in the moat.)' },
    ],
    post_l4_3: [
        { who: 'sandy', text: 'My crown! I mean... well fought. The tide is coming in, and I suppose a castle is only sand, after all.' },
        { who: 'pinch', text: 'It is a very good castle, though. Really good.' },
        { who: 'sandy', text: '...Thank you. Take the road past the lighthouse. And mind the gull. She is not a bad gull. She just really likes shiny things.' },
    ],
    pre_l5_3: [
        { who: 'squawk', text: 'SQUAAWK! Ahoy, little shiny! I am Captain Squawk, finder of fine things and keeper of the Moonpearl!' },
        { who: 'pinch', text: "That's the pearl that lights the whole reef at night! My family needs it!" },
        { who: 'squawk', text: 'Finders keepers! But... bring me something even shinier and we might talk. SQUAAWK!' },
    ],
    post_l5_3: [
        { who: 'squawk', text: "Hrrk... all right, all right. It's not even that shiny. Not as shiny as the way you spun. Here. Take it back." },
        { who: 'pinch', text: 'Thank you, Captain! Would you like a lift? Er, I mean... I would like a lift.' },
        { who: 'squawk', text: 'Hold on to your shell, little shiny. SQUAAAAWK!' },
    ],
    ending: [
        { who: 'dot', text: 'PINCH!' },
        { who: 'ma', text: 'Oh, my darling. You came all that way. Did you eat? Look at you. You are wearing a tin of peaches.' },
        { who: 'pa', text: 'Welcome home, son. The Shell Swap is cancelled. Nobody wanted to go without you. And nobody wanted your gadget back, either.' },
        { who: 'granny', text: 'He is back, he is back! And he has made friends, I can tell. You have the look of someone who has been hit by a coconut.' },
        { who: 'pinch', text: 'I missed you all! I found a tin, a towel, a mattress spring and about forty tiny things. I think I can fix the gadget now.' },
        { who: 'pa', text: '...Please do not.' },
        { who: 'narr', text: 'And so Pinch came home, and the Shell Swap was held after all, and the gadget was only used in the pool once more, where, for the record, it worked perfectly.' },
    ],
};

/** The little signposts in the levels. */
export const SIGNS = {
    run: 'Arrow keys or WASD to run. Space to hop!',
    spin: 'Press X (or the Spin button) to spin and smash crates.',
    shell: 'Press Q or E to swap shells. Each one does something different.',
    gap: 'Wide gap! Try a roll-jump: roll (Power), then hop.',
    spring: 'Squishy sponges will bounce you high.',
    check: 'Checkpoint crates save your place.',
    brace: 'Coconuts ahead! Hold Power with the Coconut Shell.',
    pound: 'Big switch! Pound the ground (Power with the Peach-Can Shell).',
    glide: 'Wide gap! Sail Shell: press Jump in the air to glide.',
    hop: 'High ledge! Spring Shell: hold Power, let go to boing.',
    barrel: 'Step into the barrel and it will fire you across.',
    home: 'HOME REEF: this way!',
};
