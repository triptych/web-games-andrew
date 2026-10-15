// Content tables: enemies, levels, VHS tapes, Roxy's one-liners, briefings. Pure data.

import { SKY } from '../config.js';

// attack kinds: 'bolt' (projectile burst), 'leap' (melee pounce), 'laser' (fast twin projectiles),
// 'charge' (straight-line gore), 'psi' (homing orbs), 'rockets' (splash volley)
export const ENEMIES = {
    trooper: {
        name: 'Snarl Trooper', hp: 60, speed: 4.5, radius: 0.45, height: 1.9, sight: 34, pref: [7, 16],
        attack: { kind: 'bolt', cool: 1.8, windup: 0.4, dmg: 6, speed: 24, count: 3, gap: 0.12, spread: 0.08, range: 30 },
        stagger: 0.5, score: 100, weight: 1, gunDrop: 0.06, bombDrop: 0.04,
    },
    chomper: {
        name: 'Chomper', hp: 24, speed: 9.5, radius: 0.35, height: 0.8, sight: 26, pref: [0, 1.2],
        attack: { kind: 'leap', cool: 1.1, windup: 0.25, dmg: 8, range: 5.5, leap: 11 },
        stagger: 0.7, score: 50, weight: 0.4, gunDrop: 0.0, bombDrop: 0.02,
    },
    drone: {
        name: 'Skull Drone', hp: 45, speed: 7, radius: 0.4, height: 0.8, fly: true, sight: 36, pref: [6, 14],
        attack: { kind: 'laser', cool: 1.6, windup: 0.5, dmg: 6, speed: 46, count: 2, gap: 0.1, spread: 0.06, range: 34 },
        stagger: 0.6, score: 120, weight: 0.8, gunDrop: 0.05, bombDrop: 0.03,
    },
    brute: {
        name: 'Meatbeast', hp: 260, speed: 5.5, radius: 0.85, height: 2.6, armored: true, sight: 30, pref: [0, 2],
        attack: { kind: 'charge', cool: 2.6, windup: 0.6, dmg: 30, range: 18, chargeSpeed: 15, melee: 2.4 },
        stagger: 0.15, score: 400, weight: 3, gunDrop: 0.3, bombDrop: 0.2,
    },
    psy: {
        name: 'Brainstalker', hp: 110, speed: 3.5, radius: 0.5, height: 2.4, sight: 40, pref: [10, 22],
        attack: { kind: 'psi', cool: 2.6, windup: 0.6, dmg: 12, speed: 11, count: 2, gap: 0.3, homing: 1.8, range: 38 },
        stagger: 0.35, score: 300, weight: 2, gunDrop: 0.15, bombDrop: 0.08, teleport: true,
    },
    tank: {
        name: 'Octotank', hp: 420, speed: 2.6, radius: 1.1, height: 2.5, armored: true, sight: 40, pref: [9, 20],
        attack: { kind: 'rockets', cool: 3.6, windup: 0.8, dmg: 18, speed: 17, count: 4, gap: 0.2, spread: 0.14, splash: 3.2, range: 38 },
        stagger: 0.05, score: 600, weight: 4, gunDrop: 0.45, bombDrop: 0.3,
    },
};

// Boss stats; behaviour lives in bosses.js.
export const BOSSES = {
    chompra: { name: 'QUEEN CHOMPRA', hp: 3000, radius: 1.8, height: 3.4, speed: 5, armored: false, score: 5000, legendary: 'mixtape' },
    vrask: { name: 'WARLORD VRASK', hp: 4600, radius: 1.0, height: 3.0, speed: 6, armored: true, score: 8000, legendary: 'bertha' },
    rourke: { name: 'ROURKE, THE TRAITOR KING', hp: 6000, radius: 2.4, height: 5, speed: 0, armored: false, score: 15000, legendary: 'requiem', fly: true },
};

// theme: drives the generator's shapes and the view's materials.
export const LEVELS = [
    {
        id: 'strip', name: 'SUNSET STRIP', sub: 'Neo Angeles, 11:47 PM', theme: 'city', outdoor: true,
        W: 56, H: 56, rooms: [26, 32], roomSize: [4, 9], corridor: [3, 4], ceil: [SKY, SKY],
        roster: { trooper: 6, chomper: 4, drone: 2, brute: 0.6 }, budget: 1.05, keys: 1,
        liquid: 'toxic', boss: null, ambush: ['trooper', 'trooper', 'chomper', 'chomper', 'chomper', 'drone', 'brute', 'trooper'],
        tempo: 118, key: 0, legendary: 'lastword',
    },
    {
        id: 'mall', name: 'GALLERIA OF DOOM', sub: 'Fox Hills Galleria, sub-level B', theme: 'mall', outdoor: false,
        W: 52, H: 52, rooms: [24, 30], roomSize: [4, 8], corridor: [2, 3], ceil: [5, 7],
        roster: { trooper: 5, chomper: 6, drone: 3, brute: 1.2, psy: 0.6 }, budget: 1.2, keys: 2,
        liquid: 'slime', boss: 'chompra', tempo: 124, key: 3,
    },
    {
        id: 'sewer', name: 'THE SLIME LINE', sub: 'Storm drain 9, under Wilshire', theme: 'sewer', outdoor: false,
        W: 54, H: 54, rooms: [26, 32], roomSize: [3, 7], corridor: [1, 2], ceil: [4, 6],
        roster: { trooper: 4, chomper: 7, drone: 2, brute: 1.5, psy: 1.5, tank: 0.4 }, budget: 1.35, keys: 2,
        liquid: 'slime', boss: null, ambush: ['brute', 'psy', 'chomper', 'chomper', 'chomper', 'chomper', 'trooper', 'trooper', 'tank'],
        tempo: 112, key: 5,
    },
    {
        id: 'ship', name: 'THE MOTHERSHIP', sub: 'Xerxid dreadnought, 40,000 ft', theme: 'ship', outdoor: false,
        W: 54, H: 54, rooms: [24, 30], roomSize: [4, 8], corridor: [2, 2], ceil: [5, 9],
        roster: { trooper: 5, chomper: 3, drone: 4, brute: 1.5, psy: 1.5, tank: 1 }, budget: 1.5, keys: 2,
        liquid: 'plasma', boss: 'vrask', tempo: 132, key: 2,
    },
    {
        id: 'throne', name: 'THRONE OF LIES', sub: 'The brain core', theme: 'core', outdoor: false,
        W: 40, H: 40, rooms: [12, 16], roomSize: [4, 7], corridor: [2, 2], ceil: [6, 9],
        roster: { trooper: 4, chomper: 4, drone: 2.5, brute: 1.5, psy: 2, tank: 1.2 }, budget: 1.15, keys: 1,
        liquid: 'plasma', boss: 'rourke', tempo: 140, key: 7,
    },
];

export const BRIEFINGS = [
    'The Strip is on fire and the aliens are still here. Benny Ortiz filmed everything the day Dad died. Find the tapes. Find the keycard. Get to the subway.',
    'The marines fell back through the Galleria. Something big moved into the food court. Something with a lot of teeth.',
    'Benny\'s trail goes down into the storm drains. The aliens have been busy down here. It smells like a lunch box left in a hot car.',
    'The subway tunnels came out under a beam of purple light. Roxy rode it up. Somewhere on this ship is the golden arm from the tape.',
    'Vrask said the human did it. There is only one human up here. Take the elevator to the brain core and ask him yourself.',
];

// Three per level.
export const TAPES = [
    [
        { title: 'TAPE 01 — "KEEP ROLLING"', text: 'Benny: "Colonel, you want me to stop filming?" Jack: "Hell no, Ortiz. Somebody\'s gonna want to know what happened here. Keep rolling."' },
        { title: 'TAPE 02 — "HOUR FOUR"', text: 'Smoke. Gunfire. Jack, on the radio: "Rourke, where\'s my air support? ...Repeat that? Who pulled it?" Static.' },
        { title: 'TAPE 03 — "THE ARM"', text: 'Something walks out of the smoke. A golden arm catches the neon. Jack steps in front of the camera. "Run, Benny." Snow.' },
    ],
    [
        { title: 'TAPE 04 — "FOOD COURT"', text: 'Marines barricading an Orange Julius. Rourke, off-camera: "Orders are orders, Jack." Jack: "Not these ones, Dell."' },
        { title: 'TAPE 05 — "HAPPY BIRTHDAY KIDDO"', text: 'Jack in his kitchen, a cake with nineteen candles. "Rox. You fixed that bike yourself. I\'m so proud I could bust. Don\'t tell anyone I cried."' },
        { title: 'TAPE 06 — "THE QUEEN"', text: 'Benny, whispering: "There\'s a big one in the fountain. She\'s laying eggs in the ball pit. I am never going to a mall again."' },
    ],
    [
        { title: 'TAPE 07 — "THE FREQUENCY"', text: 'A radio hisses on an alien channel. A human voice answers in their language, then in English: "The Colonel will not be a problem."' },
        { title: 'TAPE 08 — "THE DRAG"', text: 'Marines being dragged through slime by the ankles. Jack is not among them. Benny: "They took the Colonel up. Not down. Up."' },
        { title: 'TAPE 09 — "BENNY\'S LAST"', text: 'Benny, bleeding, grinning: "If you find this, Roxy... he never stopped talking about you. Go get \'em, kid." The tape runs out.' },
    ],
    [
        { title: 'TAPE 10 — "TROPHY ROOM"', text: 'Vrask\'s trophy wall: helmets, badges, a Dodgers cap. Jack\'s dog tags are not there. Someone else kept them.' },
        { title: 'TAPE 11 — "THE DEAL"', text: 'A hologram of Dell Rourke kneeling before the hive mind. "You get the city. I get forever. And Kane goes away."' },
        { title: 'TAPE 12 — "THE GOLDEN ARM"', text: 'Vrask, recorded in his own log: "The human brought the Colonel to us in chains. The Colonel spat on him. The human did the rest."' },
    ],
    [
        { title: 'TAPE 13 — "UNCLE DELL"', text: 'Old footage: Roxy at ten on Dell\'s shoulders at a Fourth of July parade. Dell: "Your old man\'s the best friend I ever had."' },
        { title: 'TAPE 14 — "THE TRIGGER"', text: 'The throne room. Jack in chains, standing. Dell raises a pistol. Jack: "You were always a lousy shot, Dell." He wasn\'t, that day.' },
        { title: 'TAPE 15 — "FOR ROXY"', text: 'Jack, to the camera: "Kiddo, if you\'re watching this, don\'t come looking for me. ...Who am I kidding. Bring the big gun."' },
    ],
];

// Roxy's one-liners, by trigger. All original.
export const QUIPS = {
    start: [
        'Daddy\'s little girl is home. And she\'s grounded YOU.',
        'I came here to fix bikes and kick butt. The garage is closed.',
        'Neo Angeles. Where the aliens don\'t tip.',
        'Somebody ordered a vendetta? Extra large.',
        'Rule one of the Kane house: nobody touches the family.',
    ],
    multi: [
        'Two for one! Must be happy hour.',
        'Line up, boys. I\'ve got a punch card.',
        'Ooh, a combo. Somebody call the arcade.',
        'Bodies on the floor. Don\'t make me tell you twice.',
        'That\'s what I call a rush hour.',
        'High score. Put my initials in.',
    ],
    gib: [
        'Somebody get a mop.',
        'Chunky. Just how I like my salsa.',
        'Hope you weren\'t planning an open casket.',
        'That\'s gonna leave a stain.',
        'Some assembly required.',
        'Aisle four. Clean-up. Lots of it.',
    ],
    kick: [
        'Size seven, steel toe.',
        'Boot to the snoot!',
        'Dad taught me that one.',
        'Get outta my way.',
    ],
    hurt: [
        'Okay. OW. Okay.',
        'You\'re gonna pay for the bruises too.',
        'That all you got, ugly?',
        'I\'ve had worse falls off a Harley.',
    ],
    overdrive: [
        'Slow down. I wanna savor this.',
        'Time to get radical.',
        'Overdrive! Hold onto your antennae.',
        'Turn it up to eleven.',
    ],
    tape: [
        'Hang on, Dad. I\'m coming.',
        'Rewind that. No. Don\'t. Keep going.',
        'Somebody\'s gonna answer for this.',
    ],
    boss: [
        'Big. Ugly. Dead. Pick three.',
        'The bigger they are, the bigger the mess.',
        'Next time, bring a bigger army.',
        'Tell your queen I said hi. Oh wait.',
    ],
    gun: [
        'Ooh. Shiny.',
        'Now THAT is a gun.',
        'Hello, gorgeous.',
        'Christmas came early.',
    ],
};

export const COMBO_NAMES = [
    [2, 'DOUBLE KILL'], [3, 'TRIPLE KILL'], [4, 'MEGA KILL'], [6, 'RAMPAGE'], [8, 'TOTALLY RADICAL'], [12, 'UNSTOPPABLE'],
];

export const ENDING = [
    'Rourke screamed with ten thousand voices and then with none. The brain core went dark.',
    'Roxy took the dog tags off his neck. They were still warm. She put them on.',
    'The mothership came down in the Pacific like a dropped dinner plate. The sun came up pink over the Strip.',
    'She rode home on a stolen alien hover-bike and fixed the busted headlight herself.',
    'At 6:02 AM the radio crackled. A second signal. From orbit. Much bigger.',
    'THE HEGEMONY HAS MORE SHIPS.',
];
