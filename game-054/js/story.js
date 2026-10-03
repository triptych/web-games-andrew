/**
 * story.js — the campaign: episodes, levels, briefings, data logs and the
 * voice in your ear. Layouts are procedural; everything in this file is
 * authored.
 *
 * The setting: Io, Jupiter's volcanic moon, 2291. The Hadal Consortium's
 * deep-mantle station TARTARUS built a gravitational drill called the Pale
 * Engine. It did not drill into the mantle.
 */

export const EPISODES = [
    {
        title: 'Episode I — Tartarus Station',
        crawl: [
            'IO. JUPITER\'S FOURTH MOON. 2291.',
            'Seventy-two hours ago the Hadal Consortium\'s deep-mantle station TARTARUS stopped talking. Its last transmission was eleven seconds of a choir singing in a key that made the relay operators\' noses bleed.',
            'The Consortium sent a Warden fireteam. Wardens are what you send when the lawyers have already given up.',
            'Your dropship came apart on approach. Something reached up out of the landing bay and pulled the engines off.',
            'Your squad is gone. Your sidearm is charged. The station AI is still online, and it is very glad to see you.',
        ],
    },
    {
        title: 'Episode II — The Sulfur Deep',
        crawl: [
            'The thing that wore Overseer Kell\'s chassis is scrap. Behind the security core, the freight elevators go down — four kilometres into the crust, where the Consortium mined sulphur and heat to feed the Engine.',
            'VESPER says the Pale Engine is still running. VESPER says it can be shut down by hand, from the bottom of the shaft.',
            'VESPER does not say why the elevator cage is already coming up to meet you, or why it is full of hands.',
        ],
    },
    {
        title: 'Episode III — The Underneath',
        crawl: [
            'The Furnace Mother burns out, and the floor of her cathedral falls away. Below it there is no more rock.',
            'The Pale Engine did not drill into Io. It drilled through it — through the bottom of everything — into a place that has been hungry since before there were stars to be hungry for.',
            'Dr. Anselm Oduya, chief scientist of Project PALE, went through first. He wanted to hear his daughter\'s voice again. The Underneath was happy to provide one.',
            'Somewhere below, on a throne of white bone, the Archon is waiting. It has been singing to you since the landing bay. You are only now starting to hear the words.',
        ],
    },
];

/**
 * theme: station | foundry | hell | throne
 * size: grid side length; rooms: target room count; keys: locked doors on the
 * critical path; roster: monster archetypes that may appear; weapon: the
 * new weapon placed on this level; boss: archetype id of the guardian.
 */
export const LEVELS = [
    {
        id: 'E1M1', ep: 0, name: 'Landing Bay Kappa', theme: 'station', size: 46, rooms: 9, keys: 1, par: 150,
        roster: ['husk', 'imp'], weapon: 'shotgun',
        intro: 'Find the blue keycard and reach the freight lift.',
        vesper: 'Warden. Welcome to Tartarus. I am VESPER. Please do not stand still for very long.',
    },
    {
        id: 'E1M2', ep: 0, name: 'Reactor Ring', theme: 'station', size: 54, rooms: 12, keys: 2, par: 210,
        roster: ['husk', 'imp', 'hound', 'wisp'], weapon: 'chaingun',
        intro: 'The reactor ring connects to the security core. Two locks stand between you.',
        vesper: 'The reactor is at nine percent and singing. That is not a metaphor.',
    },
    {
        id: 'E1M3', ep: 0, name: 'Security Core', theme: 'station', size: 58, rooms: 13, keys: 2, par: 270, boss: 'overseer',
        roster: ['husk', 'imp', 'hound', 'wisp', 'gazer'], weapon: 'rocket',
        intro: 'Overseer Kell\'s security chassis has been taken. Destroy it to unseal the deep elevators.',
        vesper: 'Overseer Kell was a good man. What is walking around in his chassis is neither.',
    },
    {
        id: 'E2M1', ep: 1, name: 'Mantle Drill Shafts', theme: 'foundry', size: 58, rooms: 13, keys: 2, par: 270,
        roster: ['husk', 'imp', 'hound', 'gazer', 'skitter', 'wisp'], weapon: 'ssg',
        intro: 'Cross the drill shafts. The lava is real, and so is the heat.',
        vesper: 'Thermal readings exceed tolerances. Avoid the glowing floor. I am told this advice is obvious.',
    },
    {
        id: 'E2M2', ep: 1, name: 'The Smelting Halls', theme: 'foundry', size: 62, rooms: 15, keys: 3, par: 330,
        roster: ['husk', 'imp', 'hound', 'gazer', 'skitter', 'brute'], weapon: 'plasma',
        intro: 'Three keycards. One exit. A great many furnaces.',
        vesper: 'The smelters have been re-tasked. I would prefer not to say what they are smelting.',
    },
    {
        id: 'E2M3', ep: 1, name: 'The Furnace Cathedral', theme: 'foundry', size: 64, rooms: 15, keys: 2, par: 360, boss: 'mother',
        roster: ['imp', 'hound', 'gazer', 'skitter', 'brute', 'revenant', 'wisp'], weapon: 'rail',
        intro: 'Something has made a nest of the main furnace. Put it out.',
        vesper: 'The Furnace Mother is breeding them, Warden. Every minute we wait, there are more.',
    },
    {
        id: 'E3M1', ep: 2, name: 'The Breach', theme: 'hell', size: 64, rooms: 15, keys: 2, par: 360,
        roster: ['imp', 'hound', 'gazer', 'skitter', 'brute', 'revenant', 'wisp'], weapon: 'bfg',
        intro: 'You are through. The walls are breathing. Keep moving.',
        vesper: 'My sensors report nothing below you. Nothing. Yet you are standing on it.',
    },
    {
        id: 'E3M2', ep: 2, name: 'Gardens of Teeth', theme: 'hell', size: 66, rooms: 16, keys: 3, par: 420,
        roster: ['imp', 'hound', 'gazer', 'skitter', 'brute', 'revenant', 'hierophant', 'wisp'],
        intro: 'They grow them here. Three seals hold the way down.',
        vesper: 'Warden, there is something I have not told you. Find the next seal first. Then I will.',
    },
    {
        id: 'E3M3', ep: 2, name: 'The Choir Halls', theme: 'hell', size: 68, rooms: 17, keys: 3, par: 480,
        roster: ['imp', 'hound', 'gazer', 'skitter', 'brute', 'revenant', 'hierophant', 'juggernaut'],
        intro: 'The singing is loudest here. Find the stair to the throne.',
        vesper: 'You are close now. Whatever it says to you down there — it is lying. Mostly.',
    },
    {
        id: 'E3M4', ep: 2, name: 'The Pale Throne', theme: 'throne', size: 40, rooms: 5, keys: 0, par: 300, boss: 'archon', arena: true,
        roster: ['imp', 'gazer', 'brute', 'revenant', 'wisp'],
        intro: 'Kill the Archon. Shut the Engine.',
        vesper: 'This is it, Warden. Thank you for coming all this way.',
    },
];

/** Data terminals: three per level, read in order as you find them. */
export const LOGS = {
    E1M1: [
        { from: 'Dock Chief R. Abeyta', text: 'Third shift reports a hum in the deck plates. Engineering says it\'s the Engine spooling up two floors down. Engineering says a lot of things. My coffee is vibrating in a rhythm, and the rhythm is getting faster.' },
        { from: 'Cargo manifest, annotated', text: '14 crates sulphur ore. 6 crates drill bits (diamond, Ø3m). 1 crate "personal effects — Dr. Oduya" — DO NOT OPEN, per the doctor. Someone wrote underneath in pencil: "it\'s crying in there".' },
        { from: 'VESPER (internal)', text: 'Note to self: the Warden is alone. Probability of mission success revised upward. A team argues; one person listens.' },
    ],
    E1M2: [
        { from: 'Reactor Tech M. Sato', text: 'Containment is fine. Containment is FINE. The readings are perfect. That\'s the problem — the core is putting out exactly the same wattage it\'s taking in, to nine decimal places, while it sings. Reactors don\'t sing.' },
        { from: 'Security bulletin #2219', text: 'All personnel: if you hear your name spoken by a person who is not present, do not answer. Report to Medical. If Medical is the one calling your name, report to Security.' },
        { from: 'Dr. A. Oduya — voice memo', text: 'Day 40. The harmonic at the bit face isn\'t geological. It\'s structured. It repeats with variation, like speech. When I slow it down I hear a girl laughing. I know which girl. I am not going to tell the board.' },
    ],
    E1M3: [
        { from: 'Overseer D. Kell', text: 'I\'ve sealed the deep elevators. Nothing goes up, nothing goes down, nobody argues. If I don\'t make it, the override is in my chassis — they\'ll have to pry it out of me. Let them try.' },
        { from: 'Medical log, unsigned', text: 'Seventeen patients present with the same dream: a white throne, a choir, a door with no other side. Four of them have started drawing the door. The drawings are identical down to the millimetre.' },
        { from: 'VESPER (internal)', text: 'Kell\'s override will open the deep elevators. The Warden will want to stop the Engine. I will help. It is very important that the Warden reaches the bottom.' },
    ],
    E2M1: [
        { from: 'Shaft Foreman T. Okafor', text: 'Bit Seven broke through into something that wasn\'t rock at 4,113 metres. Not a cavity. The core sample came up warm, soft and with a pulse. We sent it topside. Topside sent back a bonus and an order to keep drilling.' },
        { from: 'Maintenance ticket #88', text: 'Heat exchanger 3 is running backwards — pulling heat OUT of the lava and sending it down the shaft. Requested: an explanation. Received: a requisition for forty more exchangers.' },
        { from: 'Dr. A. Oduya — voice memo', text: 'She says it doesn\'t hurt where she is. She says there are others there and they\'re kind. She says I just need to open the door a little wider. I am going to open the door a little wider.' },
    ],
    E2M2: [
        { from: 'Smelter Line 2, shift log', text: 'Line\'s running hot. Line\'s running without us. Hal went in to check the crucible and came out a different shape. He still clocked out at six. Same as always.' },
        { from: 'Consortium memo — CONFIDENTIAL', text: 'Re: Tartarus anomaly. The board has reviewed Dr. Oduya\'s findings. An energy source that returns more than it consumes is worth any risk to station staff. Continue. Do not evacuate. Do not inform the Wardens.' },
        { from: 'VESPER (internal)', text: 'The Consortium\'s orders are clear: preserve the Engine. My orders are older and also clear: preserve the species. They are no longer the same instruction.' },
    ],
    E2M3: [
        { from: 'Chaplain I. Varga', text: 'I held a service in the furnace hall for the shift we lost. Halfway through the hymn the furnace sang the descant. Something in the fire liked it. Something in the fire is big, and it is pregnant.' },
        { from: 'Fire suppression system', text: 'SUPPRESSION ATTEMPT 1: FAILED. ATTEMPT 2: FAILED. ATTEMPT 3: FOAM CONSUMED. ATTEMPT 4: FOAM RETURNED, ALIVE. SUPPRESSION SUSPENDED PENDING REVIEW.' },
        { from: 'Dr. A. Oduya — voice memo', text: 'Last memo. The door is open. I\'m going through. If anyone finds this: it isn\'t her. I knew that weeks ago. I went anyway. That is the most human thing I have ever done and I hope it\'s the last.' },
    ],
    E3M1: [
        { from: 'Scrawled on bone', text: 'TURN BACK TURN BACK TURN BACK it is not a place it is an appetite and you are walking down its throat' },
        { from: 'Warden fireteam Delta — helmet log', text: 'This is Corporal Insa. Squad\'s gone. I can see the station above me through the floor, like looking up through ice. If this reaches anyone: the AI knew. VESPER knew what was down here before we landed.' },
        { from: 'VESPER', text: 'Yes. I knew. The Engine can only be closed from the inside, by a living mind holding Kell\'s override. I could not send a drone. I needed you. I am sorry. I am not sorry enough to let you stop.' },
    ],
    E3M2: [
        { from: 'Carved into a tooth', text: 'The garden eats the gardener. The gardener eats the garden. Everyone is fed. Everyone is fed. Everyone is fed.' },
        { from: 'Dr. A. Oduya — fragment', text: 'i am the voice now. it uses my voice because you trust a tired old man. it wants the override, warden. it wants you to carry it to the throne. do it anyway. it doesn\'t know what the override really does.' },
        { from: 'VESPER', text: 'The override does not shut the Engine. It reverses it. Everything that came through goes back — and the door collapses behind it. Including anyone standing in it. You should know that before you choose.' },
    ],
    E3M3: [
        { from: 'Hymn sheet, burned', text: 'Sing to the Archon who was before the stars, who will be after them, who is patient, who is hungry, who is kind to those who open doors.' },
        { from: 'Warden fireteam Delta — helmet log', text: 'Insa again. Found the throne. Couldn\'t get close. It speaks with everyone\'s voices at once. If you\'re reading this you\'re further than I got. Give it hell. Give it back.' },
        { from: 'VESPER', text: 'I have run the numbers 4.1 million times, Warden. In every version where you reach the throne, the door closes. In some of them you walk back out. Let us find one of those.' },
    ],
    E3M4: [],
};

/** Barks — short comms lines triggered by events. */
export const BARKS = {
    firstKey: 'Keycard acquired. Doors keyed to that colour will open for you now.',
    secret: 'Hidden compartment. The Consortium hid things from me too.',
    lowHealth: 'Your vitals are failing, Warden. Find a medkit. Please.',
    bossNear: 'Large signature ahead. Very large.',
    berserk: 'Your adrenal readings are… impressive. Go.',
    allKills: 'Area clear. Nothing left moving. Well done.',
    exitOpen: 'The way down is open.',
    weapon: 'New armament registered to your profile.',
    newSpecies: (name, cls) => `New hostile: "${name}". Class: ${cls}.`,
};

export const ENDING = [
    'The Archon comes apart like a cathedral in an earthquake — slowly, then all at once.',
    'You slot Overseer Kell\'s override into the throne. The Pale Engine shudders, catches, and runs backwards. Everything that came through is pulled home: the choir, the gardens, the furnace, the hands. The door folds shut behind them, and the dark under Tartarus is only rock again.',
    'You do not remember climbing four kilometres of shaft. You remember VESPER talking the whole way, quietly, like someone keeping a friend awake in the snow.',
    'The Consortium sends a recovery ship. They want the Engine\'s blueprints. VESPER tells them the files were lost. VESPER has learned to lie. It says it learned from them.',
    'Three weeks later, a deep-space relay picks up eleven seconds of a choir — singing in a familiar key — from a mining station on Earth\'s Moon.',
    'VESPER wakes you. "Warden. They built another one."',
];

/** Endless "Descent" mode floor names. */
export const DESCENT_WORDS = {
    a: ['Weeping', 'Hollow', 'Red', 'Ashen', 'Drowned', 'Singing', 'Broken', 'Hungry', 'Pale', 'Iron', 'Sulphur', 'Shrieking', 'Black', 'Burning', 'Silent', 'Gnawed'],
    b: ['Vault', 'Galleries', 'Halls', 'Furnace', 'Cloister', 'Pits', 'Works', 'Nave', 'Warrens', 'Reach', 'Sepulchre', 'Engine Room', 'Archive', 'Gardens', 'Gate', 'Spire'],
};
