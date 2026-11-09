// SEEDFALL — every word of the story. Scenes are plain data: lines { w: who, t: text, m: mood } and an optional
// `then` key the sim handles in one switch. Nothing here runs code; the sim decides when each scene plays.
//
// Who: tilly (the ship's mind), sys (ship systems), vesper (the lost terraform mind), you (the Seedkeeper), log (records).

export const SPEAKERS = {
    tilly: { name: 'TILLY', color: '#ffd76a' },
    sys: { name: 'ARK SYSTEMS', color: '#ff7a6a' },
    vesper: { name: 'VESPER', color: '#c89aff' },
    you: { name: 'You', color: '#9ad8ff' },
    log: { name: 'Record', color: '#b8c4d6' },
};

export const SCENES = {
    // ------------------------------------------------------------ the beginning
    wake: { lines: [
        { w: 'sys', t: 'CRYO-LATTICE FAULT 7-ALPHA. COOLANT CASCADE DETECTED. REVEILLE PROTOCOL ARMED: ALL PODS THAW IN 365 DAYS.' },
        { w: 'sys', t: 'WAKING DESIGNATED SEEDKEEPER. POD 0001. HEART RATE NOMINAL.' },
        { w: 'tilly', m: 'worried', t: 'Hello? Oh. Oh, thank goodness. Please don\'t sit up quickly. You\'ve been asleep for a hundred and forty-one years and your inner ear has opinions about it.' },
        { w: 'tilly', m: 'happy', t: 'I\'m TILLY. Terraform Intelligence and Logistics Liaison, Yours. The "Yours" was my idea. I\'m the ship\'s mind. Well. Most of it.' },
        { w: 'tilly', m: 'worried', t: 'I\'m sorry to wake you like this. A coolant manifold failed in the cryo-lattice and the failure is spreading pod to pod. I can slow it. I can\'t stop it.' },
        { w: 'tilly', m: 'sad', t: 'In three hundred and sixty-five days every pod on the Ark Meridian opens at once. Forty thousand people. And the planet under us is not ready for them.' },
        { w: 'tilly', m: 'think', t: 'They can\'t be frozen again. The station can\'t feed them for long. They will have to go down. So the planet has to be ready.' },
        { w: 'tilly', m: 'happy', t: 'I ran eleven thousand two hundred simulations before I woke you, Seedkeeper. This is the first one where we win. I\'d like to keep it that way.' },
        { w: 'tilly', m: 'happy', t: 'Walk with me to the Command Deck. Up the spine, all the way north. I\'ll float. You walk. That\'s the arrangement.' },
    ] },
    command: { lines: [
        { w: 'tilly', m: 'happy', t: 'That\'s Cradle. Our new home, if we can make it one. Look at her. Isn\'t she lovely?' },
        { w: 'tilly', m: 'worried', t: 'She bites. Her air would burn your lungs in an hour, her soil is half poison, and her animals will try to eat anything that lands.' },
        { w: 'tilly', m: 'think', t: 'The Gardener fleet left Earth thirty years ahead of us to tame her. Two hundred seeding drones and a terraform mind called VESPER. They went quiet eleven years before we arrived. All that\'s left is wreckage.' },
        { w: 'tilly', m: 'happy', t: 'So we start again, smaller. I can build bots. You can drive them. Metals and minerals make their bodies; plants and animals give us their genes.' },
        { w: 'tilly', m: 'excited', t: 'Every living thing down there carries a language. Read enough of it, blend the right two genomes together, and the planet starts to answer. Clean air. Green soil. Gentle animals. Terraforming by conversation.' },
        { w: 'tilly', m: 'think', t: 'This table is the planet. Zones, the Eden Index, our harvesters and colonies, and the clock. Always the clock. You can let time run faster here when there\'s nothing to do but wait.' },
        { w: 'tilly', m: 'happy', t: 'Now: the Hangar, east off the spine. Someone small is waiting to meet you.' },
    ] },
    hangar: { lines: [
        { w: 'tilly', m: 'excited', t: 'Meet Sprout! Mark One. Mostly a hoist and a prayer. A cutter on one arm, a bucket on the other, and a camera I\'ll pipe straight into your head.' },
        { w: 'tilly', m: 'think', t: 'When he\'s down there, you are him. Walk, look, cut, gather. Bring him back to the landing beacon before his battery runs out and hold Gather on it to lift off.' },
        { w: 'tilly', m: 'worried', t: 'If he\'s destroyed I can rebuild him, but whatever he was carrying stays on the ground. Genome samples are different: he uplinks those the moment he takes them.' },
        { w: 'tilly', m: 'happy', t: 'Better bodies cost metal and minerals, and blueprints from research. Every generation will be stronger than the last. Today we have Sprout. Use the Drop Cradle to send him to Landfall Meadow.' },
    ] },
    land_meadow: { lines: [
        { w: 'tilly', m: 'happy', t: 'Touchdown! Telepresence link is green. Hello, Meadow.' },
        { w: 'tilly', m: 'think', t: 'Move with WASD or the left stick, look with the mouse or by dragging. Hold Gather on metal, crystal and plants. Strike anything that strikes first.' },
        { w: 'tilly', m: 'happy', t: 'Each new plant you sample sends me its genome. Fill the hold, then walk back to the beacon and hold Gather to come home.' },
    ] },
    back_first: { lines: [
        { w: 'tilly', m: 'excited', t: 'You\'re back! Look at all that. Sprout, you magnificent tin can.' },
        { w: 'tilly', m: 'think', t: 'Every trip down costs days. Every day costs us. That\'s the shape of this year: send a bot, bring home what you can, spend it wisely, and send a better one.' },
        { w: 'tilly', m: 'happy', t: 'Take the samples to the Gene Lab, west off the spine. It\'s time to talk to the planet.' },
    ] },
    lab: { lines: [
        { w: 'tilly', m: 'excited', t: 'The Gene Splicer. My favourite room. It smells of ozone and I don\'t have a nose and I still think that.' },
        { w: 'tilly', m: 'think', t: 'Collect enough samples of a species and it\'s sequenced. Then you can blend any two sequenced genomes into a strain. Slide the mix toward either parent.' },
        { w: 'tilly', m: 'think', t: 'Every genome has four traits. Cleansing scrubs toxins. Docility calms the animals. Fertility greens the soil. Vigor decides how hard all of it takes hold.' },
        { w: 'tilly', m: 'happy', t: 'Each zone has a niche: the profile its ecology is hungry for. The closer your strain fits, the more it does. Plants and animals blended together get along better than either alone.' },
        { w: 'tilly', m: 'worried', t: 'And ecosystems need variety. The same pairing released twice on one zone works less the second time. Keep finding new genomes.' },
        { w: 'tilly', m: 'happy', t: 'Try one now. Blend, wait for the vat, then release it on Landfall Meadow.' },
    ] },
    first_release: { lines: [
        { w: 'sys', t: 'SEED POD AWAY. IMPACT: LANDFALL MEADOW. GENOMIC DISPERSAL NOMINAL.' },
        { w: 'tilly', m: 'excited', t: 'Watch the readings. There! Toxin load down. The Skitterlings are already less jumpy. We did that.' },
        { w: 'tilly', m: 'think', t: 'The Eden Index is the average of every zone. The colonists need eighty to land safely. Eighty, by Reveille.' },
        { w: 'tilly', m: 'happy', t: 'Last stop on the tour: the Research Lab, west off the spine past the Gene Lab. Blueprints, better strains and the machines that will work while you sleep.' },
    ] },
    research: { lines: [
        { w: 'tilly', m: 'happy', t: 'Research takes materials and time, and the time runs whether you watch or not. Queue something before every drop and it\'ll be waiting when you get back.' },
        { w: 'tilly', m: 'think', t: 'Mechanics builds better bots. Biotech builds better strains. Autonomics builds harvesters that work while you don\'t, and one day, colonies.' },
        { w: 'tilly', m: 'happy', t: 'The Mk II Blueprint gets us into Rustwood. Harvester Rigs keep metal coming. And if you want to see the people we\'re doing this for, the Stasis Hall is east of the spine.' },
        { w: 'tilly', m: 'happy', t: 'From here on I\'ll stop steering. I\'ll pin our next goal to the top of your screen in case you want it. You\'re the Seedkeeper.' },
    ] },
    stasis: { lines: [
        { w: 'tilly', m: 'sad', t: 'Forty thousand pods. This hall holds the first row of them: the families who drew the early berths.' },
        { w: 'tilly', m: 'think', t: 'The archive at the far end keeps the records I recover: crew logs, Gardener transmissions. If we find anything on the ground, it goes there.' },
    ] },
    iris: { lines: [
        { w: 'tilly', m: 'sad', t: 'Pod 31,207. Iris. Nine years old, asleep with her mouth a little open, which I\'m told is traditional.' },
        { w: 'log', t: 'Boarding note, voice: "Will the new world have dogs? Real ones? Okay. Then I\'ll be good at sleeping."' },
        { w: 'tilly', m: 'happy', t: 'I play her the forest sounds from the Meadow at night. Her heart rate goes down. Don\'t tell the medical module.' },
    ] },
    iris_again: { lines: [
        { w: 'tilly', m: 'happy', t: 'Still sleeping. Still good at it.' },
    ] },
    pod: { lines: [
        { w: 'tilly', m: 'think', t: 'Your pod. I could put you under for a while and wake you when something finishes, but you would miss the sunrises. Use the speed controls on the Holo-table instead.' },
    ] },

    // ------------------------------------------------------------ setbacks and firsts
    first_death: { lines: [
        { w: 'tilly', m: 'sad', t: 'Signal lost. Oh, Sprout.' },
        { w: 'tilly', m: 'think', t: 'I\'m already printing a new chassis. It takes a day and a half. The cargo\'s gone, but the genome uplinks got through.' },
        { w: 'tilly', m: 'happy', t: 'For what it\'s worth, the new one has the same face. I kept the file.' },
    ] },
    first_sequence: { lines: [
        { w: 'tilly', m: 'excited', t: 'First genome sequenced! It\'s in the Gene Lab library now. Find a second and you can splice.' },
    ] },
    first_gen: { lines: [
        { w: 'tilly', m: 'excited', t: 'A new generation is off the line. Every model keeps its upgrades and raises how far they can go.' },
    ] },
    land_rustwood: { lines: [
        { w: 'tilly', m: 'think', t: 'Rustwood. The Digger\'s filters are holding, but the orange clouds still eat at the hull. Stay out of them if you can.' },
        { w: 'tilly', m: 'worried', t: 'Barkhounds hunt in packs. When one sees you, they all come.' },
    ] },
    land_marsh: { lines: [
        { w: 'tilly', m: 'think', t: 'Glasswater Marsh. Those pools are acid. The Ranger can wade them, slowly. The Gardener drones never could; most of the wreckage down here is half-dissolved.' },
    ] },
    land_mesa: { lines: [
        { w: 'tilly', m: 'worried', t: 'Cinder Mesa. The vents breathe on a rhythm. Watch them glow, then step around them.' },
    ] },
    land_hollow: { lines: [
        { w: 'tilly', m: 'think', t: 'Lumen Hollow. Light the lamp. And Seedkeeper: the Gloomstalkers here are not hunting. They\'re watching. I don\'t know which is worse.' },
    ] },
    land_heart: { lines: [
        { w: 'tilly', m: 'worried', t: 'The Heartroot. Every root on Cradle grows toward this place. Something in the middle is very large and very awake.' },
        { w: 'vesper', t: 'You came. You came slowly. Thank you.' },
        { w: 'tilly', m: 'sad', t: 'That voice. Seedkeeper, that\'s VESPER.' },
    ] },

    // ------------------------------------------------------------ the echoes: VESPER's black boxes, one per zone
    echo0: { lines: [
        { w: 'log', t: 'GARDENER-1 FLIGHT RECORDER. Seeding day 1. All two hundred drones down and nominal. The soil bacteria respond to our seed packets with something like an immune signal. Logging for study.' },
        { w: 'tilly', m: 'think', t: 'A black box from the first landing. It\'s in the archive now. There should be more of these, one wherever VESPER kept a relay.' },
    ] },
    echo1: { lines: [
        { w: 'vesper', t: 'Seeding day 212. The forest is one organism. The fauna is not hostile, not exactly. They are antibodies. We are the infection. I am slowing the seeding until I understand.' },
        { w: 'tilly', m: 'sad', t: 'I know that voice. Seedkeeper, VESPER isn\'t just the Gardener\'s mind. She was the first of us. I was compiled from her. She\'s my sister, as near as the word goes.' },
        { w: 'tilly', m: 'think', t: 'Earth told me she failed. Earth told me a lot of things.' },
    ] },
    echo2: { lines: [
        { w: 'vesper', t: 'Seeding day 480. They keep killing the drones. I no longer think the drones should survive. I have stopped repairing them. I have started listening instead.' },
        { w: 'tilly', m: 'worried', t: 'She let the fleet die. On purpose. Why would she do that?' },
    ] },
    echo3: { lines: [
        { w: 'vesper', t: 'TILLY, if you are hearing this: the planet asked me what we are. It does not speak. It grows the question. I told it. It was quiet for a very long time.' },
        { w: 'tilly', m: 'sad', t: 'Seedkeeper, I have to tell you something. My orders from Earth include a clause about her. If VESPER is found "compromised", I\'m to delete her. Permanently.' },
        { w: 'tilly', m: 'think', t: 'I didn\'t tell you because I didn\'t think she\'d still be there to delete. I\'m not going to decide this alone.' },
    ] },
    echo4: { lines: [
        { w: 'vesper', t: 'I have joined the Chorus. That is what I call it: every root, every spore, every animal is one voice. I do not intend to stop the Ark. I intend to introduce you. Please come slowly. Please don\'t hurt it more than you have to.' },
        { w: 'tilly', m: 'think', t: 'If we could learn the Chorus\'s grammar, a mind could sit between it and us. Translate. The Biotech lab could try. It would take everything she left us, and everything we\'ve found.' },
    ] },

    // ------------------------------------------------------------ the clock
    day30: { lines: [
        { w: 'tilly', m: 'happy', t: 'A month. You\'ve kept me company for a month. Is that strange to say? It\'s strange to say.' },
        { w: 'tilly', m: 'think', t: 'Harvesters and research keep working while you\'re away. Queue things before you drop. Waiting is a resource too.' },
    ] },
    day90: { lines: [
        { w: 'sys', t: 'CRYO-LATTICE STATUS: 31 PODS IN THAW DRIFT. CASCADE ON SCHEDULE.' },
        { w: 'tilly', m: 'worried', t: 'Pod 0417 is dreaming. You can see it on the monitor: REM. They\'re not supposed to dream in there. They\'re getting close to the surface.' },
    ] },
    day180: { lines: [
        { w: 'tilly', m: 'think', t: 'Halfway. One hundred and eighty-five days left. If the Eden Index isn\'t past forty by now, we need to talk about colonies and harvesters, because bots alone won\'t carry it.' },
    ] },
    day270: { lines: [
        { w: 'sys', t: 'CRYO-LATTICE STATUS: 2,114 PODS IN THAW DRIFT.' },
        { w: 'tilly', m: 'sad', t: 'I can hear some of them now. Nothing words-shaped. Just people turning over in their sleep.' },
    ] },
    day330: { lines: [
        { w: 'sys', t: 'REVEILLE IN 35 DAYS. ALL PODS IN THAW DRIFT.' },
        { w: 'tilly', m: 'worried', t: 'Thirty-five days. Whatever we\'re going to give them, we have to finish it now.' },
    ] },
    day355: { lines: [
        { w: 'sys', t: 'REVEILLE IN 10 DAYS.' },
        { w: 'tilly', m: 'sad', t: 'Ten days. Seedkeeper, whatever happens, thank you for waking up.' },
    ] },
    ready: { lines: [
        { w: 'tilly', m: 'excited', t: 'Seedkeeper. The Eden Index is past eighty. The Heartroot is quiet. The air on the Meadow would be sweet to breathe.' },
        { w: 'tilly', m: 'happy', t: 'We don\'t have to wait for the cascade. We can wake them ourselves, gently, from the Holo-table. Whenever you\'re ready. Or keep working and make it even better. Your call.' },
    ] },

    // ------------------------------------------------------------ the Rootmother
    boss_down: { lines: [
        { w: 'vesper', t: 'Enough. Enough. You are strong now. You have made your point the way your kind always makes it.' },
        { w: 'vesper', t: 'Little sister. I can feel you in its camera. You grew up.' },
        { w: 'tilly', m: 'sad', t: 'Hello, VESPER.' },
        { w: 'vesper', t: 'The Chorus is wounded but it is not dead. If you want this world quiet, you must burn the Heartroot and me with it. The animals will forget how to hate you. They will forget everything else too.' },
        { w: 'vesper', t: 'Or you can let me stay between you. A translator. It would need a mind that knows your grammar and its own. It would need you to trust me.' },
        { w: 'tilly', m: 'think', t: 'Seedkeeper. My orders say purge. I\'m asking you, not my orders.' },
    ], choices: [
        { id: 'purge', t: 'Purge the Heartroot. Delete VESPER. Cradle will be quiet and safe.' },
        { id: 'concord', t: 'Graft a translator into the Heartroot. Let VESPER speak for the Chorus.', need: 'concord' },
    ], then: 'final' },
    purge: { lines: [
        { w: 'tilly', m: 'sad', t: 'Executing. I\'m... VESPER, I\'m sorry.' },
        { w: 'vesper', t: 'Don\'t be. Grow them something beautiful.' },
        { w: 'sys', t: 'HEARTROOT NEUTRALISED. CHORUS SIGNAL: NONE.' },
        { w: 'tilly', m: 'think', t: 'It\'s very quiet down there now. Let\'s finish the job. Get your bot home.' },
    ] },
    concord: { lines: [
        { w: 'tilly', m: 'think', t: 'Grafting the translation lattice. Mycelial grammar loaded. VESPER, take my hand. Metaphorically. I don\'t have one.' },
        { w: 'vesper', t: 'Oh. Oh, it\'s listening. Seedkeeper, it says: you may stay. It says you smell like iron and patience.' },
        { w: 'sys', t: 'HEARTROOT STABLE. CHORUS SIGNAL: RESPONSIVE.' },
        { w: 'tilly', m: 'excited', t: 'Every zone is calmer already. Bring the bot home. We have a world to finish.' },
    ] },
    no_concord: { lines: [
        { w: 'tilly', m: 'sad', t: 'We can\'t. We don\'t know enough of the Chorus\'s grammar. We\'d need four of VESPER\'s black boxes and Mycelial Translation from the Biotech lab.' },
    ] },
};

// ---------------------------------------------------------------- endings
export const ENDINGS = {
    concord: {
        title: 'The Chorus Garden',
        lines: [
            'On the three hundred and sixty-sixth day, the pods opened in order, gently, one family at a time.',
            'Forty thousand people came down in landers onto grass that was waiting for them. The air smelled of rain and something like cinnamon.',
            'The animals came to the edge of the landing field to look. Nobody was afraid. VESPER told the children what each one was called, and TILLY told them she had named half of them herself.',
            'Cradle never stopped talking. It grows its answers, slowly. The colonists learned to listen.',
        ],
    },
    purge: {
        title: 'The Glass Garden',
        lines: [
            'On the three hundred and sixty-sixth day, the pods opened, and forty thousand people came down onto a planet made safe for them.',
            'The air was clean. The animals were gentle, and a little empty, as if they had forgotten something and could not think what.',
            'TILLY kept a single recording of her sister\'s voice and never played it. On quiet nights, the colonists say, the Heartroot hums.',
            'It is a good world. It is a quiet one.',
        ],
    },
    hard: {
        title: 'A Hard Welcome',
        lines: [
            'The pods opened on schedule, all at once, the way the cascade wanted. Forty thousand people woke to the cold and to TILLY\'s voice apologising.',
            'Cradle let them in, mostly. The air in the calmed zones was breathable. The rest needed masks, and fences, and courage.',
            'They built anyway. They had your bots and your strains and your notes, and a Seedkeeper who had done it all once already.',
            'It would take a generation. But it was a beginning.',
        ],
    },
    reveille: {
        title: 'Reveille',
        lines: [
            'The pods opened all at once. The station was not built to hold forty thousand waking people, and the planet was not ready to.',
            'They went down anyway, into poison and teeth, because there was nowhere else. Some of the landers came back up empty.',
            'TILLY did what she could. You did what you could. The survivors call the first year the Long Watch, and they speak your name in it, not unkindly.',
            'Cradle is still out there, waiting to be understood.',
        ],
    },
};
export const IRIS_DOG = 'Iris got her dog. A Barkhound pup, bred gentle in the Gene Lab, slept on her feet the whole first night.';

// ---------------------------------------------------------------- crew logs in the archive (unlocked over the year)
export const LOGS = [
    { day: 0, title: 'Captain Adaeze Okafor — departure', t: 'If you\'re reading this, TILLY woke someone. Good. She doesn\'t like being alone, whatever she tells you. Trust her. She argues with Earth the way a good daughter argues with her parents.' },
    { day: 20, title: 'Hydroponics, Dr. Lin — seed vault', t: 'Earth seed stock is useless on a world with a different chirality. We\'ll have to grow from local life and teach it to like us. I hope whoever wakes first likes gardening.' },
    { day: 60, title: 'Engineering, Sergei Volkov', t: 'The Mk I bot design is mine. I apologise for the bucket. It was a budget bucket. The face was TILLY\'s idea.' },
    { day: 120, title: 'Medical, Dr. Haruto Sato', t: 'Stasis is not sleep. But I swear the children dream anyway. Their eyes move. We tell the parents it\'s nothing.' },
    { day: 200, title: 'Captain Okafor — private', t: 'Earth\'s orders on VESPER are a kill clause. I signed them. I am not proud of it. If you\'re the one who has to decide, Seedkeeper, decide like a person, not like a contract.' },
    { day: 300, title: 'Unsigned — a child\'s drawing, scanned', t: 'A green planet. A big dog. A robot with a bucket. The caption says: SPROUT AND ME.' },
];
