// HOLLOWDEEP — every voiced line, and who says it. Not part of the simulation: the view and the audio read it.
//
// Each character was recorded as one ElevenLabs take (eleven_v4) with the lines in this order, separated by
// [long pause]; dev/audio/process.py splits the take back into vo/<id>-<n>.mp3. The text here is what the subtitles
// show, so keep it in step with dev/audio/README.md if a line changes. `voice` is the ElevenLabs voice name.

export const VOICES = {
    narrator: { voice: 'Eldrin - Wise Ancient Wizard Storyteller', lines: [
        'Forty years ago, the ground beneath Brindlemoor split open, and the Hollowdeep breathed its first cold breath.',
        'Every floor runs deeper than the last. No one has found the bottom. Many have tried.',
        'Gather your company, delver. Light your lantern. The dark is waiting.',
        'The warp stones remember your victory. A deeper path is open.',
        'Your lanterns went out in the dark... but the guild carried you home.',
    ] },

    // townsfolk: their three greetings (data/town.js NPCS.lines, same order) and a thank-you when a quest is turned in
    marta: { voice: 'Poppy - Calm & Kind Teacher/Mother', lines: [
        'A bed, a bath, a hot meal. The dungeon will still be there in the morning, more\'s the pity.',
        'You look half dead. Sit. Eat.',
        'My Tomas went down in the third year. Mind you come back up.',
        'You found it. Oh... thank you, love. Thank you.',
    ] },
    odo: { voice: 'Álfwyn - Excitable & Squeaky', lines: [
        'Everything a delver needs, and a few things they don\'t!',
        'Bring me what you find down there. I pay fair. Mostly.',
        'Deeper you go, the better my stock gets. Funny how that works.',
        'Splendid! A deal\'s a deal. Here\'s your reward.',
    ] },
    varga: { voice: 'Andrea - British female character voice', lines: [
        'Nobody goes down there alone. Not twice.',
        'The board\'s full of folk who want to fight. Pick the ones who\'ll stand when it counts.',
        'Five of you. Three up front, two behind. That\'s how we\'ve always done it.',
        'Good work. The guild remembers who gets it done.',
    ] },
    elowen: { voice: 'Libby-Animated', lines: [
        'The Dawn does not abandon those who walk in darkness.',
        'Bring me the fallen. While their name is spoken, they can return.',
        'Something below is calling the dead. I hear it at night.',
        'The Dawn smiles on you today. Go in light.',
    ] },
    pell: { voice: 'Kai - Energetic Anime Hero', lines: [
        'Work on the board, ale at the bar, songs on the house.',
        'Every delver who comes back is a new verse. Give me a good one.',
        'They say there\'s a king at the bottom. They say there isn\'t a bottom.',
        'Ha! That\'s a verse and a chorus. Here\'s your pay.',
    ] },
    ansel: { voice: 'Alden - Tired Old Man', lines: [
        'Down you go, then. Light your lantern.',
        'Beat a guardian and the warp stones remember it. I can send you past what you\'ve conquered.',
        'Forty years at this gate. The stones hum louder every year.',
        'So it\'s done. The stones hum a little quieter tonight.',
    ] },

    // heroes, by portrait: [battle cry, victory, falls, joins the party]
    fighter_a: { voice: 'Harry - Fierce Warrior', lines: ['Stand and fight!', 'Another one for the pile.', 'Not... yet...', 'Point me at something big.'] },
    fighter_b: { voice: 'Emma - Wry, Gritty Hero', lines: ['Come on, then!', 'Is that all the dark\'s got?', 'Agh! Keep... going...', 'I hit hard and I don\'t run. Deal?'] },
    knight_a: { voice: 'The Doc', lines: ['By oath and steel!', 'Hold the line. Well done.', 'Forgive me... I faltered...', 'My shield is yours, for as long as it holds.'] },
    knight_b: { voice: 'Tess - Direct and Grounded', lines: ['Behind me! I\'ve got you.', 'Everyone standing? Good.', 'Dawn... keep them safe...', 'I\'ll stand in front. That\'s what I\'m for.'] },
    thief_a: { voice: 'Jordan - Warm & Gritty', lines: ['Pardon me. Just passing through.', 'And they never saw me coming.', 'Well... that\'s... unlucky...', 'I pick locks, pockets and fights. Mostly locks.'] },
    thief_b: { voice: 'Ruby B - London, Playful, Warm', lines: ['Quick and quiet.', 'Check their pockets before they fade.', 'Sloppy... so sloppy...', 'Need someone small and sharp? I\'m both.'] },
    mage_a: { voice: 'Matthew Schmitz - Ancient Sage Dragon Wizard', lines: ['Burn, by the old words!', 'Hm. Textbook, really.', 'My spectacles... where are...', 'An old man\'s tricks still have teeth. You\'ll see.'] },
    mage_b: { voice: 'Elowen - Elf', lines: ['Feel the storm!', 'Elegant. As always.', 'This isn\'t how... the story ends...', 'I\'ve read about the deep. I\'d rather see it.'] },
    priest_a: { voice: 'Rusty Malone - Deep & Raspy', lines: ['Light, guide my hand.', 'Rest now, poor creatures.', 'Carry on... without me... for now...', 'Every party needs someone to pray for it. I volunteer.'] },
    priest_b: { voice: 'K', lines: ['Be mended!', 'Is everyone all right? Thank the Dawn.', 'I\'m sorry... I couldn\'t...', 'I\'ll keep you standing. Promise.'] },
    ranger_a: { voice: 'Gravel Midnight – Deep Character Voice', lines: ['Steady... loose!', 'Clean shot. Clean kill.', 'Lost... the trail...', 'I\'ve tracked worse things than these in the dark.'] },
    ranger_b: { voice: 'Yuria - Expressive, Playful, Witty', lines: ['Got you in my sights!', 'Ha! Never stood a chance.', 'Too close... too close...', 'Give me a bow and a reason. I\'ll do the rest.'] },

    // guardians and the reaper: [when the fight begins, when they fall]
    ossuary_knight: { voice: 'Bloodgrin VF - Evil, Demonic Villain', lines: ['None pass. None have ever passed.', 'At last... rest...'] },
    mother_mycelia: { voice: 'Moriana - Dark, Seductive, Dangerous', lines: ['Sleep, little ones... and feed my children.', 'My spores... will remember you...'] },
    brine_leviathan: { voice: 'Cthulhu - The Old One', lines: ['The deep remembers the drowned. Join them.', 'The tide... turns...'] },
    forgefather: { voice: 'Azgar the Cursed - The Orc Troll', lines: ['The forge is lit. You will be the ore.', 'The fire... goes... cold...'] },
    winter_lich: { voice: 'Jerry B. - Dark Villain | Horror & Thriller', lines: ['Your warmth offends me. Let me take it from you.', 'Impossible... the cold is eternal...'] },
    elder_briar: { voice: 'Mossbeard | The God of the Wild', lines: ['Every root in this dungeon is mine. And now, so are you.', 'Seeds... will grow again...'] },
    orrery_engine: { voice: 'Silent Systemus – Sovereign Protocol', lines: ['Anomaly detected. Correcting the count.', 'Error. Error. The stars... are wrong...'] },
    hollow_king: { voice: 'Valko - Slow and dark', lines: ['You came all this way to ask what lies below. Below... is me.', 'Then go deeper... and see what waits for you...'] },
    reaper: { voice: 'Grizzy - Expressive Dark Fantasy', lines: ['Your lantern... is mine.', 'I will find you... again...'] },
};

/** The file a line lives in: vo/<id>-<n>.mp3 (n from 1). */
export const voFile = (id, n) => `audio/vo/${id}-${n + 1}.mp3`;
// which line plays when
export const HERO_LINE = { cry: 0, win: 1, down: 2, join: 3 };
export const NPC_THANKS = 3;
export const NARRATION = { intro: [0, 1, 2], warp: 3, wipe: 4 };
