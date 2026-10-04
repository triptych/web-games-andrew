/**
 * story.js — every line of story text: the intro crawl, sector cards, radio
 * chatter, the data logs found on terminals and the ending.
 *
 * Speakers: OVERWATCH (Major Adaeze Okoye, aboard the frigate Valkyrie in
 * orbit), ELLIE (Ellie Calder, on an emergency band), HARROW (Dr. Silas
 * Harrow, head of xenobiology, in recovered logs) and WARDEN (you).
 */

export const SPEAKERS = {
    okoye:  { name: 'OVERWATCH', sub: 'Maj. A. Okoye — FS Valkyrie', color: '#7fe8ff' },
    ellie:  { name: 'ELLIE CALDER', sub: 'Emergency band 7', color: '#ffd27a' },
    harrow: { name: 'DR. S. HARROW', sub: 'Recovered log', color: '#b6ff6a' },
    warden: { name: 'WARDEN', sub: 'Colonial Marine', color: '#ffffff' },
    system: { name: 'FORT KESSLER', sub: 'Base automation', color: '#ff6a5a' },
};

export const INTRO = [
    'EREBUS SYSTEM — 2189',
    'Fort Kessler is a black-site research base buried under the ice of Erebus, a moon that appears on no chart. Seventy-two hours ago it went silent.',
    'Its last transmission was a scream, and under it a sound like a thousand fingernails on steel.',
    'Among the four hundred staff was Ellie Calder, nineteen, an intern in the xenobiology division. Her mother is the President of the Colonial Union.',
    'A battalion would take nine days to arrive.',
    'Command sent one marine.',
];

export const SECTOR_CARDS = [
    { title: 'HANGAR DECK', sub: 'Sector I — Surface Access', text: 'The landing pad lights still blink. The blast doors below them have been torn open from the inside.' },
    { title: 'BARRACKS & ARMORY', sub: 'Sector II — Garrison Level', text: 'Two hundred soldiers were stationed here. Their lockers are still full. Their bunks are empty.' },
    { title: 'BIO-RESEARCH LABS', sub: 'Sector III — Restricted', text: 'Ellie\'s last confirmed location. The specimen tanks are open. All of them.' },
    { title: 'REACTOR CORE', sub: 'Sector IV — Engineering', text: 'The Brood has wrapped the reactor in resin and is drinking its heat. The deck is warm through your boots.' },
    { title: 'THE HIVE', sub: 'Sector V — Deep Excavation', text: 'Below the base, the Brood has built something of its own. It is alive, and it knows you are here.' },
];
export const ESCAPE_CARD = { title: 'GET OUT', sub: 'Self-destruct armed', text: 'Ellie is with you. The dropship is on the pad. Everything in the hive is between you and it.' };
export const HORDE_CARD = { title: 'INFESTATION PROTOCOL', sub: 'Training simulation — endless', text: 'One arena. The swarm does not stop. Find out how long you last.' };

/** Radio lines: key → [speaker, text][]. Played once per run unless noted. */
export const RADIO = {
    s0_start: [
        ['okoye', 'Warden, Overwatch. You are on the pad. Ellie\'s locator last pinged from the labs, three sectors down.'],
        ['okoye', 'Whatever did this is still in there. Shoot first. Roll if it shoots back.'],
    ],
    s0_firstlock: [['okoye', 'Doors just sealed behind you. Base lockdown protocol. Clear the room and they\'ll release.']],
    s0_swarm: [['okoye', 'Motion tracker is... that\'s not a malfunction. That\'s all of them. Keep moving!']],
    s0_boss: [['okoye', 'Big contact, centre of the hangar. Thermal says it\'s the size of a tank. Don\'t let it pin you to a wall.']],
    s0_bossdead: [['okoye', 'Hostile down. Elevator\'s live. Take it to the garrison level.']],

    s1_start: [
        ['okoye', 'Garrison level. Some of the soldiers... the bugs did something to them. If they shoot at you, they\'re not ours anymore.'],
        ['ellie', '...is anyone receiving? This is Ellie Calder. I\'m in the labs, cold storage. Please. They\'re in the walls.'],
    ],
    s1_ellie: [['okoye', 'That was her! Warden, she\'s alive. Labs are one level down. Move.']],
    s1_boss: [['okoye', 'That\'s a Goliath walker. Their armour plate fails at the joints. Keep chipping, it\'ll crack.']],
    s1_bossdead: [['okoye', 'Walker\'s down. The labs are next. Ellie\'s signal is still holding.']],

    s2_start: [
        ['ellie', 'I can hear gunfire upstairs. Is that you? Please be you.'],
        ['okoye', 'Ellie, this is Major Okoye. Stay hidden. Help is one floor away.'],
    ],
    s2_taken: [
        ['ellie', 'Something\'s at the door. It\'s not trying to break it. It\'s... it\'s opening it. No, no, no—'],
        ['okoye', 'Ellie? Ellie! ...Warden, her locator is moving. Fast. Downward.'],
    ],
    s2_boss: [['okoye', 'That thing in the containment ring... Harrow\'s files called it Specimen Zero. Patient zero of this whole nightmare.']],
    s2_bossdead: [['okoye', 'Her locator stopped under the reactor. They took her down to the nest. I\'m sorry, Warden. Keep going.']],

    s3_start: [
        ['okoye', 'Reactor core. The bugs are feeding on the heat. If that reactor goes critical before we\'re ready, nobody leaves.'],
    ],
    s3_ellie: [['ellie', '...warm. It\'s so warm. They wrapped me in something. I can hear it singing. Please hurry.']],
    s3_boss: [['okoye', 'Massive heat signature. It\'s... guarding eggs. A lot of eggs. Burn them.']],
    s3_bossdead: [['okoye', 'The way down is open. The hive is directly below. This is it, Warden.']],

    s4_start: [
        ['okoye', 'You\'re inside the hive now. I\'m reading Ellie at the heart of it, with something enormous.'],
        ['okoye', 'I\'ve armed the base self-destruct. The timer starts the moment Ellie is clear. Then you run.'],
    ],
    s4_mid: [['ellie', 'I can see your light. I can see it! Behind the big one. Please don\'t leave me here.']],
    s4_boss: [['okoye', 'That\'s the queen. Everything down there came out of her. Kill her and the hive dies with her.']],
    s4_phase2: [['okoye', 'She\'s calling the whole hive! Keep your distance!']],
    s4_phase3: [['okoye', 'She\'s bleeding out! Don\'t let up!']],

    escape_start: [
        ['ellie', 'You came. You actually came. ...Give me something to shoot.'],
        ['system', 'SELF-DESTRUCT SEQUENCE ACTIVE. ALL PERSONNEL EVACUATE.'],
        ['okoye', 'Dropship is on the pad. Two and a half minutes. RUN.'],
    ],
    escape_holdout: [['okoye', 'Bulkhead\'s jammed! I\'m overriding it from up here. Twelve seconds. Hold them off!']],
    escape_half: [['okoye', 'Halfway! The whole hive is waking up behind you!']],
    escape_last: [['system', 'THIRTY SECONDS TO DETONATION.']],

    lowhp: [['okoye', 'Your vitals are spiking, Warden. Find a medkit.']],
    shop: [['okoye', 'Supply depot. The quartermaster\'s terminal still takes salvage. Gear up.']],
    medbay: [['okoye', 'Med bay. Use the station; it\'s got one charge left.']],
    weapon: [['okoye', 'Armory crate. Take it. You\'re going to need more than a rifle.']],
    secondwind: [['okoye', 'Your heart stopped for a second there. Adrenal shot fired. Don\'t do that again.']],

    horde_start: [['okoye', 'Simulation online. The swarm is endless. Survive as long as you can.']],
};

/** Data logs on terminals, three per sector, read in order. */
export const LOGS = [
    [
        { title: 'Dock Manifest 7741', author: 'Logistics', text: 'Cargo: one (1) cryogenic container, Class Omega, origin REDACTED. Handle per Harrow directive. Do not scan. Do not open. Do not log.' },
        { title: 'Personal — Pvt. Osei', author: 'Pvt. K. Osei', text: 'Third night of scratching inside the vents. Maintenance says it\'s ice settling. Ice doesn\'t move from vent to vent, following you down the hall.' },
        { title: 'Security Alert', author: 'Base automation', text: 'CONTAINMENT FAILURE — LAB 3. LOCKDOWN ENGAGED. LOCKDOWN OVERRIDDEN BY: S. HARROW. LOCKDOWN OVERRIDDEN BY: S. HARROW. LOCKDOWN OVERRIDDEN BY: S. HARROW.' },
    ],
    [
        { title: 'Armory Requisition', author: 'Sgt. M. Reyes', text: 'Requesting flamethrowers. All of them. I don\'t care that they\'re "not approved for interior use". Bullets go through the little ones and they keep coming.' },
        { title: 'Medical — Garrison', author: 'Dr. P. Lindqvist', text: 'The bitten don\'t die. They sleep for six hours and wake up quiet. They still answer to their names. They don\'t blink anymore.' },
        { title: 'Harrow — Memo', author: 'Dr. S. Harrow', text: 'The garrison is a regrettable loss but a useful dataset. Infected subjects retain motor memory, including firearms. The applications are obvious.' },
    ],
    [
        { title: 'Specimen Zero — Day 1', author: 'Dr. S. Harrow', text: 'The queen\'s first offspring is magnificent. It adapts to whatever we expose it to. It learned the door code by watching us type it.' },
        { title: 'Intern Notes', author: 'E. Calder', text: 'Dr. Harrow says the Class Omega organism is a "defence asset". I asked what it\'s defending us from. He didn\'t answer. I\'m copying everything to my personal drive.' },
        { title: 'Specimen Zero — Day 40', author: 'Dr. S. Harrow', text: 'It has stopped trying to escape. It is waiting. I believe it is waiting for the queen to be ready. I have told no one. The contract is worth too much.' },
    ],
    [
        { title: 'Reactor Telemetry', author: 'Engineering', text: 'Core temperature dropping 0.4% per hour with no change in output. Something is drawing heat directly from the shielding. Something big.' },
        { title: 'Harrow — Final Entry', author: 'Dr. S. Harrow', text: 'She came for me herself. She knew my name. She said it in Calder\'s voice. I understand now. We were never the ones studying her.' },
        { title: 'Engineer\'s Note', author: 'Eng. T. Halvorsen', text: 'If anyone reads this: the self-destruct is wired to the reactor. Overwatch can arm it from orbit. Get out first. Don\'t let this thing leave the moon.' },
    ],
    [
        { title: 'Ellie — Voice Memo', author: 'E. Calder', text: 'They\'re not hurting me. That\'s the worst part. The big one hums to me. I think she wants me to be one of them. I keep saying my mom\'s name so I don\'t forget it.' },
        { title: 'Resin Inscription', author: 'Unknown', text: 'Scratched into the resin, in a soldier\'s handwriting: "She lays faster when she\'s afraid. Make her afraid."' },
        { title: 'Ellie — Voice Memo 2', author: 'E. Calder', text: 'There\'s a light coming down through the hive. Someone is shooting. Someone came. Okay. Okay. I can hold on a little longer.' },
    ],
];

export const ENDING = {
    title: 'MISSION COMPLETE',
    lines: [
        'The dropship cleared the ice with eleven seconds to spare.',
        'Behind it, Fort Kessler folded into the crust of Erebus, and the hive went with it.',
        'Ellie Calder slept for nineteen hours aboard the Valkyrie. The first thing she asked for when she woke was her drive.',
        'It held everything: the manifests, the contract, Harrow\'s logs.',
        'The President read every word. Then she asked for the name of the marine.',
        'Overwatch told her: Warden. Just Warden.',
    ],
};

export const DEATH_LINES = [
    'Signal lost. Overwatch is still calling your name.',
    'The swarm closes over the light.',
    'Vitals flatline. The elevator waits for the next attempt.',
    'Ellie hears the gunfire stop.',
];
