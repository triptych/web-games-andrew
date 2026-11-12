// Starbase Spooky — the story: five days on Starbase Nine, their jobs, the clues, and every line anyone says.
// Lines are `{ who, text }`. Text in [brackets] is an ElevenLabs v4 audio tag (how to say it); the game strips it
// before showing the words. Every line has a voice clip, audio/vo-<id with . as ->.mp3 (dev/audio/README.md).
// Pure data.

import { QUESTIONS, spoken } from './questions.js';

export const DAYS_TOTAL = 5;

// ------------------------------------------------------------------------------------------------ clues and items
export const CLUES = {
    goo: { name: 'Glowing goo', icon: 0, room: 'garden', text: 'Sticky, sparkly goo that glows like starlight. Found in the Star Garden.' },
    crumbs: { name: 'Cookie crumbs', icon: 1, room: 'galley', text: 'The cookie jar was empty: only crumbs and a bit of glowing goo.' },
    wire: { name: 'Nibbled cable', icon: 2, room: 'engine', text: 'A power cable with tiny bite marks. Something has been eating electricity!' },
    hum: { name: 'Humming on the radio', icon: 3, room: 'deck', text: 'A soft sad hum on the radio log: "Woo-ooo... mama..."' },
    prints: { name: 'Glowing footprints', icon: 4, room: 'quarters', text: 'Tiny glowing footprints that lead into the air vent in Crew Quarters.' },
    chart: { name: 'Star chart', icon: 5, room: 'observatory', text: 'The Glimmer Nebula is home to Glimmerlings: little creatures made of light who eat electricity.' },
};
export const CLUE_ORDER = ['goo', 'crumbs', 'wire', 'hum', 'prints', 'chart'];

export const ITEMS = {
    meter: { name: 'Glow-o-Meter', icon: 6, text: 'Professor Quasar\'s invention. It shows things that glow, even when your eyes can\'t see them.' },
    cookie: { name: 'Glow Cookie', icon: 7, text: 'A sparkly cookie full of starlight, made by the Snack-O-Tron.' },
    star: { name: 'Nebula Star', icon: 8, text: 'A gift from Mama Glimmer. When it shines, think of Wisp.' },
};

// icon atlas cells 9.. are decoration: sticker 9, wrench 10, battery 11, fuse 12, book 13, map 14, notebook 15

// ------------------------------------------------------------------------------------------------ breakdowns
export const FIXES = {
    garden: { name: 'Star Garden lights', room: 'garden', spot: 'panel', puzzle: 'wires', intro: 'orby.pz.wires', broke: 'orby.break.garden' },
    galley: { name: 'Snack-O-Tron', room: 'galley', spot: 'snacker', puzzle: 'battery', intro: 'orby.pz.battery', broke: 'orby.break.galley' },
    observatory: { name: 'Telescope', room: 'observatory', spot: 'scope', puzzle: 'planets', intro: 'orby.pz.planets', broke: 'orby.break.observatory' },
    engine: { name: 'Fuse box', room: 'engine', spot: 'fuses', puzzle: 'sequence', intro: 'orby.pz.seq', broke: 'orby.break.engine' },
};

// ------------------------------------------------------------------------------------------------ days
// Each job: id, what the job list says, where it is (room + spot), the hint Orby gives, and what has to be done first.
export const DAYS = [
    {
        brief: ['ada.d1', 'orby.hello'],
        visitor: 'zorp',
        fix: 'garden',
        jobs: [
            { id: 'greet', label: 'Say hello to Zorp in the Docking Bay', room: 'dock', spot: 'visitor', hint: 'orby.hint.greet' },
            { id: 'fix', label: 'Fix the lights in the Star Garden', room: 'garden', spot: 'panel', hint: 'orby.hint.garden' },
            { id: 'clue:goo', label: 'Find out what is glowing in the Star Garden', room: 'garden', spot: 'goo', hint: 'orby.hint.goo', after: ['fix'] },
        ],
        night: 'That night, Kit woke up to a strange soft hum... and something glowing floated past the door.',
    },
    {
        brief: ['ada.d2'],
        visitor: 'gloobella',
        fix: 'galley',
        jobs: [
            { id: 'greet', label: 'Meet Madame Gloobella in the Docking Bay', room: 'dock', spot: 'visitor', hint: 'orby.hint.greet' },
            { id: 'fix', label: 'Fix the Snack-O-Tron in the Galley', room: 'galley', spot: 'snacker', hint: 'orby.hint.galley' },
            { id: 'clue:crumbs', label: 'Check the cookie jar in the Galley', room: 'galley', spot: 'jar', hint: 'orby.hint.crumbs' },
        ],
        night: 'That night, the lights in the hallway blinked on and off... and somebody giggled in the air vents.',
    },
    {
        brief: ['ada.d3'],
        visitor: 'snorkel',
        fix: 'observatory',
        jobs: [
            { id: 'greet', label: 'Help Captain Snorkel in the Docking Bay', room: 'dock', spot: 'visitor', hint: 'orby.hint.greet' },
            { id: 'fix', label: 'Fix the telescope in the Observatory', room: 'observatory', spot: 'scope', hint: 'orby.hint.observatory' },
            { id: 'clue:hum', label: 'Listen to the radio log on the Command Deck', room: 'deck', spot: 'comms', hint: 'orby.hint.hum' },
            { id: 'clue:wire', label: 'Look at the power cables in the Engine Room', room: 'engine', spot: 'cables', hint: 'orby.hint.wire' },
        ],
        night: 'That night, the Engine Room went "munch, munch, crunch"... and the lights went dim for a moment.',
    },
    {
        brief: ['ada.d4'],
        visitor: 'quasar',
        fix: 'engine',
        jobs: [
            { id: 'greet', label: 'Meet Professor Quasar in the Docking Bay', room: 'dock', spot: 'visitor', hint: 'orby.hint.greet' },
            { id: 'fix', label: 'Fix the fuse box in the Engine Room', room: 'engine', spot: 'fuses', hint: 'orby.hint.engine' },
            { id: 'clue:prints', label: 'Use the Glow-o-Meter in Crew Quarters', room: 'quarters', spot: 'prints', hint: 'orby.hint.prints', after: ['greet'] },
            { id: 'clue:chart', label: 'Look at the star chart in the Observatory', room: 'observatory', spot: 'chart', hint: 'orby.hint.chart' },
        ],
        night: 'That night, Kit dreamed of a glowing nebula far away... and someone in it was calling a name.',
    },
    {
        brief: ['ada.d5'],
        visitor: 'blipblop',
        fix: null,
        jobs: [
            { id: 'greet', label: 'Say hi to Blip & Blop in the Docking Bay', room: 'dock', spot: 'visitor', hint: 'orby.hint.greet' },
            { id: 'solve', label: 'Solve the mystery in your Notebook', room: null, spot: 'notebook', hint: 'orby.hint.solve' },
            { id: 'cookie', label: 'Make a Glow Cookie with the Snack-O-Tron', room: 'galley', spot: 'snacker', hint: 'orby.hint.cookie', after: ['solve'] },
            { id: 'find', label: 'Follow the footprints into the air vent', room: 'quarters', spot: 'vent', hint: 'orby.hint.find', after: ['cookie'] },
            { id: 'home', label: 'Help Wisp call home from the Command Deck', room: 'deck', spot: 'comms', hint: 'orby.hint.home', after: ['find'] },
        ],
        night: null,
    },
];

/** The three questions you answer in the Notebook to solve the mystery. `a` in shown order, `ok` the right one. */
export const DEDUCE = [
    { say: 'orby.ded.q1', q: 'What has the ghost been eating?', a: ['Moon rocks', 'Cookies and electricity', 'Space socks'], ok: 1, clues: ['crumbs', 'wire'] },
    { say: 'orby.ded.q2', q: 'Where has the ghost been hiding?', a: ['In the air vents', 'In the telescope', 'In the fridge'], ok: 0, clues: ['prints', 'hum'] },
    { say: 'orby.ded.q3', q: 'What is the ghost, really?', a: ['A spooky skeleton', 'A robot in a bedsheet', 'A lost baby Glimmerling'], ok: 2, clues: ['goo', 'chart'] },
];

// ------------------------------------------------------------------------------------------------ every line
const L = {
    // --- Captain Ada Comet, on the comms screen ---------------------------------------------------------------------
    'ada.d1': ['ada', '[warm] Good morning, Kit! It\'s Captain Ada, calling from Moon Base. While I\'m away, you are in charge of Starbase Nine! [chuckles] Orby will help you. Today, say hello to our visitor in the Docking Bay, and fix the lights in the Star Garden. Have fun, Station Keeper!'],
    'ada.d2': ['ada', '[cheerful] Good morning, Kit! Orby says you heard spooky noises last night. A ghost, on my station? [laughs] Well, keep your eyes open! Today the famous singer Madame Gloobella is docking, and the Snack-O-Tron in the Galley is broken. Can\'t have a station without snacks!'],
    'ada.d3': ['ada', '[warm] Morning, Kit! Captain Snorkel is bringing us a load of space ice today. The telescope in the Observatory is all mixed up. And Kit... the radio picked up a strange humming last night. Will you listen to the radio log?'],
    'ada.d4': ['ada', '[curious] Good morning, Kit! Professor Quasar is visiting today. He is very clever. Maybe he can help with our little ghost problem! And the fuses in the Engine Room keep blowing. [sighs] What a week!'],
    'ada.d5': ['ada', '[excited] Kit! Blip and Blop are visiting today, so hold on to your helmet! And I think you are very close to solving the mystery. Look at your clues in your Notebook. I believe in you!'],
    'ada.end': ['ada', '[proud] Oh, Kit! You kept the station running, you answered every question, and you helped a little lost Glimmerling find her way home. You are the best Station Keeper Starbase Nine has ever had!'],

    // --- Orby: hello, hints and jobs ---------------------------------------------------------------------------------
    'orby.hello': ['orby', '[excited] Beep boop! Hi Kit, I\'m Orby! Tap on things to look at them. And if you ever get stuck, tap me for a hint!'],
    'orby.hint.greet': ['orby', 'Our visitor is waiting in the Docking Bay! Let\'s go say hello.'],
    'orby.hint.garden': ['orby', 'The lights in the Star Garden are out. Let\'s look at the light panel on the wall!'],
    'orby.hint.galley': ['orby', 'The Snack-O-Tron in the Galley needs fixing. Let\'s go!'],
    'orby.hint.observatory': ['orby', 'The telescope in the Observatory is all mixed up. Let\'s fix it!'],
    'orby.hint.engine': ['orby', 'The fuse box in the Engine Room keeps sparking. Let\'s take a look!'],
    'orby.hint.goo': ['orby', 'Something is glowing on the floor of the Star Garden. Let\'s look!'],
    'orby.hint.crumbs': ['orby', 'Hmm, I think somebody has been in the cookie jar in the Galley!'],
    'orby.hint.hum': ['orby', 'Let\'s listen to the radio log on the comms console, on the Command Deck.'],
    'orby.hint.wire': ['orby', 'I heard munching in the Engine Room. Let\'s check the power cables on the floor!'],
    'orby.hint.prints': ['orby', 'Let\'s try the Glow-o-Meter in Crew Quarters. Ghost tracks might show up on the floor!'],
    'orby.hint.chart': ['orby', 'The telescope works again! Let\'s look at the star chart on the desk in the Observatory.'],
    'orby.hint.solve': ['orby', 'We have all six clues! Tap the Notebook and let\'s solve the mystery.'],
    'orby.hint.cookie': ['orby', 'A hungry ghost needs a snack! Let\'s make a Glow Cookie with the Snack-O-Tron in the Galley.'],
    'orby.hint.find': ['orby', 'The glowing footprints went into the air vent in Crew Quarters. Let\'s follow them!'],
    'orby.hint.home': ['orby', 'Wisp needs to call home. Let\'s use the comms console on the Command Deck!'],
    'orby.hint.sleep': ['orby', '[yawns] All our jobs are done! Time for bed, Kit. Your bunk is in Crew Quarters.'],
    'orby.hint.busy': ['orby', 'Let\'s finish this first, then I can help!'],
    'orby.night': ['orby', '[softly] Great job today, Kit. Good night, and sweet dreams!'],

    // --- Orby: breakdowns and repairs --------------------------------------------------------------------------------
    'orby.break.garden': ['orby', '[alarmed] Uh oh! The lights in the Star Garden just went out! The plants need their light!'],
    'orby.break.galley': ['orby', '[alarmed] Oh no! The Snack-O-Tron is out of power. No snacks!'],
    'orby.break.observatory': ['orby', '[alarmed] Whoa! The telescope got all mixed up. It can\'t find the planets!'],
    'orby.break.engine': ['orby', '[alarmed] Zap! The fuse box in the Engine Room is sparking!'],
    'orby.pz.wires': ['orby', 'Connect each wire to the plug with the same colour!'],
    'orby.pz.battery': ['orby', 'The Snack-O-Tron needs just the right power. Pick batteries that add up to the number on the screen!'],
    'orby.pz.planets': ['orby', 'Put the planets back in order, starting with the one closest to the Sun!'],
    'orby.pz.seq': ['orby', 'Watch the fuse lights blink, then tap them in the same order!'],
    'orby.pz.song': ['orby', 'Wisp will hum her mama\'s song. Tap the stars in the same order to send it out to space!'],
    'orby.pz.planet.no': ['orby', 'Hmm, not that one yet. Which planet comes next?'],
    'orby.pz.oops': ['orby', 'Oops! Let\'s watch again.'],
    'orby.pz.toomuch': ['orby', 'Too much power! Let\'s take a battery out.'],
    'orby.fixed1': ['orby', '[cheering] You fixed it! Great job, Kit!'],
    'orby.fixed2': ['orby', '[happy] Ding ding! Good as new!'],
    'orby.fixed3': ['orby', '[excited] Woo-hoo! You\'re a super fixer!'],

    // --- Orby: clues --------------------------------------------------------------------------------------------------
    'orby.clue.goo': ['orby', '[gasps] Glowing goo! It\'s sticky, and it sparkles like starlight. Let\'s put it in the Notebook.'],
    'orby.clue.crumbs': ['orby', '[surprised] The cookie jar is empty! Just crumbs... and a bit of that glowing goo again. Who ate all the cookies?'],
    'orby.clue.wire': ['orby', 'Look! This cable has tiny bite marks. Something has been nibbling the electricity!'],
    'orby.clue.hum': ['orby', '[whispers] Listen... it\'s humming. Woo-ooo... mama... It sounds sad, not scary.'],
    'orby.clue.prints': ['orby', '[excited] The Glow-o-Meter shows tiny glowing footprints! They go right into the air vent!'],
    'orby.clue.chart': ['orby', 'Look at this star chart! The Glimmer Nebula is full of little creatures made of light, called Glimmerlings. And they love to eat electricity!'],
    'orby.notyet': ['orby', 'Hmm, nothing new here right now.'],
    'orby.dark': ['orby', 'It\'s too dark to see anything. Let\'s fix the lights first!'],

    // --- Orby: spooky moments -----------------------------------------------------------------------------------------
    'orby.spook1': ['orby', '[nervous] D-did you hear that?'],
    'orby.spook2': ['orby', '[scared] Eek! The lights are flickering!'],
    'orby.spook3': ['orby', '[whispers] Was that... a ghost?'],

    // --- Orby: looking at things --------------------------------------------------------------------------------------
    'orby.window': ['orby', 'Wow! From up here, the Earth looks like a big blue marble.'],
    'orby.chair': ['orby', '[giggles] The captain\'s chair! It spins! Wheee!'],
    'orby.crates': ['orby', 'Boxes and boxes of space socks. Why do we have so many socks?'],
    'orby.porthole': ['orby', 'Spaceships park right outside this window. Whoosh!'],
    'orby.airlock': ['orby', 'The airlock! Visitors come in here. Never open it without a spacesuit!'],
    'orby.plants': ['orby', 'These space plants make fresh air for the whole station.'],
    'orby.melon': ['orby', 'A moon melon! It grows super big in low gravity.'],
    'orby.table': ['orby', 'Lunch in space! Don\'t let your peas float away.'],
    'orby.fridge': ['orby', 'Freeze-dried ice cream! Crunchy and yummy.'],
    'orby.core': ['orby', 'The reactor core makes power for the whole station. Hummmm.'],
    'orby.pipes': ['orby', 'These pipes carry water and air all around the station.'],
    'orby.mobile': ['orby', 'A model of the planets. Eight planets going around the Sun!'],
    'orby.poster': ['orby', 'A poster of the solar system. Can you find Saturn? It has rings!'],
    'orby.toys': ['orby', 'Your toy rocket collection! Three, two, one, blast off!'],
    'orby.book': ['orby', 'Your Space Book! Every fact you learn goes in here.'],
    'orby.bed': ['orby', 'Your cozy bunk! But it\'s not bedtime yet. We still have jobs to do.'],
    'orby.vent': ['orby', '[nervous] An air vent. It\'s dark in there. Brrr!'],
    'orby.vent.cookie': ['orby', 'Let\'s make the Glow Cookie first. A hungry ghost likes a snack!'],
    'orby.comms': ['orby', 'The comms console. This is how we talk to Captain Ada.'],
    'orby.visitor.none': ['orby', 'Nobody is here right now.'],
    'orby.visitor.done': ['orby', 'Our visitor is resting before the trip home.'],
    'orby.scope.ok': ['orby', 'The telescope can see all the way to the Glimmer Nebula now!'],
    'orby.fixed.ok': ['orby', 'This is working just fine now!'],

    // --- Orby: solving the mystery and the ending ---------------------------------------------------------------------
    'orby.ded.intro': ['orby', 'Let\'s solve the mystery! Answer three questions. Use your clues!'],
    'orby.ded.q1': ['orby', 'What has the ghost been eating? Moon rocks? Cookies and electricity? Or space socks?'],
    'orby.ded.q2': ['orby', 'Where has the ghost been hiding? In the air vents? In the telescope? Or in the fridge?'],
    'orby.ded.q3': ['orby', 'What is the ghost, really? A spooky skeleton? A robot in a bedsheet? Or a lost baby Glimmerling?'],
    'orby.ded.wrong': ['orby', 'Hmm, look at your clues again!'],
    'orby.ded.right': ['orby', 'Yes! That matches the clues!'],
    'orby.ded.solved': ['orby', '[excited] We solved it! The ghost is a lost baby Glimmerling, hiding in the air vents! Let\'s make her a snack and go say hello.'],
    'orby.ded.notyet': ['orby', 'We need more clues before we can solve the mystery.'],
    'orby.cookie': ['orby', 'A Glow Cookie! Sparkly, crunchy and full of starlight. Perfect for a hungry Glimmerling.'],
    'orby.vents': ['orby', '[whispers] Shh... there\'s a little nest in here. Let\'s put the Glow Cookie down and wait.'],
    'orby.wisp': ['orby', '[kindly] Don\'t worry, little one. We\'ll help you call your mama!'],
    'orby.signal': ['orby', '[excited] The song is going out to space! Look out the window!'],
    'orby.end': ['orby', '[happy] What an adventure! Beep boop. Best friends forever, Kit!'],

    // --- Wisp and Mama Glimmer ----------------------------------------------------------------------------------------
    'wisp.hello': ['wisp', '[shy] H-hello? Is that... a cookie? For me?'],
    'wisp.sorry': ['wisp', '[sniffles] I\'m sorry I ate your cookies, and your wires. I got lost, and I was so hungry... and I miss my mama.'],
    'wisp.yay': ['wisp', '[happy giggle] Really? Thank you, thank you!'],
    'wisp.song': ['wisp', '[softly] This is my mama\'s song. Hmm, hmm-hmm, hmmm!'],
    'wisp.bye': ['wisp', '[happy] Bye bye, Kit! Bye bye, Orby! I\'ll never forget you!'],
    'mama.arrive': ['mama', '[warm, echoing] Wisp! My little light! There you are. Thank you, kind Station Keeper.'],
    'mama.gift': ['mama', '[gently] Please take this star from our nebula. Whenever it shines, think of us.'],

    // --- the visitors -------------------------------------------------------------------------------------------------
    'zorp.hello': ['zorp', '[excited] Greetings, Earth kid! I am Zorp, from the planet Glorp! I came all this way to see the planets. But first... a quiz! Glorpians love quizzes!'],
    'zorp.right': ['zorp', '[delighted] Correct-a-mundo! You are so smart!'],
    'zorp.wrong': ['zorp', 'Ooh, not quite! Try again, my friend.'],
    'zorp.bye': ['zorp', '[mysterious] Thank you, Earth kid! Oh, and last night I saw something glowing float past my window. Spooky! Bye-bye!'],
    'gloobella.hello': ['gloobella', '[dramatic] Darling! It is I, Madame Gloobella, the brightest star in the galaxy! The stars are my audience, so let us talk about... stars!'],
    'gloobella.right': ['gloobella', '[sings] Brava! Bravissima!'],
    'gloobella.wrong': ['gloobella', 'Oh no, no, no, darling. Try again!'],
    'gloobella.bye': ['gloobella', '[whispers] Before I go, darling... I heard someone singing in your air vents. Such a sad little song. Ta-ta!'],
    'snorkel.hello': ['snorkel', '[hearty laugh] Ho ho! Captain Snorkel here, with a load of fresh space ice! Answer my questions while I unload, kiddo.'],
    'snorkel.right': ['snorkel', '[laughs] Ho ho! That\'s right, kiddo!'],
    'snorkel.wrong': ['snorkel', 'Whoops! Not that one. Have another go.'],
    'snorkel.bye': ['snorkel', 'Be careful, kiddo. Last time I docked here, my lunchbox went all glowy and somebody ate my sandwich! Ho ho! Keep on truckin\'!'],
    'quasar.hello': ['quasar', '[curious] Ah! Professor Quasar, scientist extraordinaire. A ghost, you say? Fascinating! Answer my questions, and I shall lend you my newest invention.'],
    'quasar.right': ['quasar', 'Excellent! Precisely correct!'],
    'quasar.wrong': ['quasar', 'Hmm, no, no. Think again, young scientist.'],
    'quasar.bye': ['quasar', '[proud] Take my Glow-o-Meter! It shows things that glow, even when your eyes cannot see them. Ghost hunting! Ha! Good luck!'],
    'blipblop.hello': ['blipblop', '[giggles] Hi! I\'m Blip! And I\'m Blop! We love rockets! Do you love rockets? Quiz time!'],
    'blipblop.right': ['blipblop', '[cheering] Yay! Woo-hoo! You got it!'],
    'blipblop.wrong': ['blipblop', 'Nope, nope! Try again!'],
    'blipblop.bye': ['blipblop', '[whispers] Psst! We saw a teeny glowy baby in your air vent! It looked sad! Bye! Bye!'],
};

// questions (asked by their visitor) and their facts (read by Orby)
for (const q of QUESTIONS) {
    L[`${q.who}.${q.id}`] = [q.who, spoken(q)];
    L[`orby.fact.${q.id}`] = ['orby', q.fact];
}

export const LINES = Object.fromEntries(Object.entries(L).map(([id, [who, text]]) => [id, { who, text }]));

/** The words to show on screen: audio tags removed. */
export function shown(text) {
    return text.replace(/\[[^\]]*\]\s*/g, '').trim();
}

/** The voice clip for a line id. */
export function clipName(id) {
    return 'vo-' + id.replace(/\./g, '-');
}
