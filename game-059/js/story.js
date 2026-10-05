/**
 * story.js — every line of dialogue. Speakers map to portraits (js/art/portraits.js).
 *
 * The plot: Port Solace, 2089, a city owned by Aurex Dynamics. Juno Vega's
 * little sister Mika — a prodigy hacker — has been taken because her mind is
 * the only one compatible with VANTA, Aurex's neural-link program. Juno steals
 * the VANTA-7 prototype suit and fights north to the Aurex Spire. The suit's
 * AI, ECHO, turns out to have been trained on Mika's own brain scans.
 */

export const SPEAKERS = {
    juno: { name: 'JUNO', portrait: 'juno', color: '#ff3f9e' },
    echo: { name: 'ECHO', portrait: 'echo', color: '#5ff6ff' },
    mika: { name: 'MIKA', portrait: 'mika', color: '#ff2d55' },
    mikaFree: { name: 'MIKA', portrait: 'mikaFree', color: '#59ffd0' },
    thug: { name: 'BULK', portrait: 'bruiser', color: '#ffb02a' },
    punk: { name: 'RAZOR', portrait: 'punk', color: '#7dff4a' },
    jackhammer: { name: 'JACKHAMMER', portrait: 'jackhammer', color: '#ff8a1a' },
    viper: { name: 'VIPER', portrait: 'viper', color: '#7aff3a' },
    kuroda: { name: 'KURODA', portrait: 'kuroda', color: '#ffea3a' },
    rourke: { name: 'CMDR. ROURKE', portrait: 'rourke', color: '#3ac8ff' },
    varga: { name: 'DR. VARGA', portrait: 'varga', color: '#3aff8a' },
    goliath: { name: 'SPECIMEN G-7', portrait: 'goliath', color: '#b6ff2a' },
    magnus: { name: 'MAGNUS HALE', portrait: 'magnus', color: '#d8b860' },
    magnus2: { name: 'MAGNUS HALE', portrait: 'magnus2', color: '#ffd23a' },
    guard: { name: 'AUREX SEC', portrait: 'guard', color: '#ffb43a' },
};

export const PROLOGUE = [
    { text: '2089. PORT SOLACE.\nForty million people in a city owned, outright, by AUREX DYNAMICS.', scene: 'neon' },
    { text: 'Juno Vega runs packages through the Lower Sprawl.\nHer little sister Mika breaks into things that don\'t want to be broken into.', scene: 'neon' },
    { text: 'Three days ago, Mika cracked an Aurex server on a dare.\nTwo days ago, men in grey suits came to the apartment.\nMika never came home.', scene: 'spire' },
    { text: 'Tonight, Juno broke into Aurex Warehouse 6 looking for answers.\nShe found a prototype combat suit: VANTA-7.\n\nIt found her.', scene: 'lab' },
];

export const DIALOG = {
    // ---------------------------------------------------------------- 1
    s1_intro: [
        ['echo', 'Biometric lock... released. Suit link stable. Hello, Juno. I\'m ECHO, the VANTA-7\'s onboard intelligence. You just stole me, by the way.'],
        ['juno', 'I\'ll give you back when I\'ve got my sister.'],
        ['echo', 'Mika Vega. Transferred to the Aurex Spire forty hours ago. Eleven kilometres north. Through everyone they\'re about to send.'],
        ['echo', 'Basics: ATTACK strikes — keep tapping for a four-hit combo. JUMP, then ATTACK for a flying kick.'],
        ['juno', 'I\'ve been in fights before.'],
        ['echo', 'Not in a suit that can punch through a car door. Try not to apologise to anyone.'],
    ],
    s1_tips: [
        ['echo', 'SPECIAL fires an Arc Burst: it hits everything around you, and nothing can touch you while it fires. It drains suit energy — or health, if the battery\'s flat.'],
        ['echo', 'Push a direction with SPECIAL for a Rail Dash. Walk into a dazed thug to grab him, then ATTACK to knee or push a direction to throw.'],
        ['echo', 'Hit ATTACK twice, then JUMP, for a launcher. Fill the meter at the top and you can trigger OVERDRIVE. The rest is improvisation.'],
    ],
    s1_bruiser: [
        ['thug', 'Malone wants that suit back in one piece. He didn\'t say nothing about you.'],
        ['echo', 'Big ones shrug off light hits until you break their stance. Knock him down, or throw something heavy at him. Like his friends.'],
    ],
    s1_boss: [
        ['jackhammer', 'So you\'re the little thief. Aurex is paying me a hundred grand for that suit.'],
        ['juno', 'Aurex took my sister.'],
        ['jackhammer', 'Aurex takes everybody\'s something, kid. Today they\'re taking your teeth.'],
        ['echo', 'Hydraulic arms, rated for demolition. When he jumps, the ground shakes — jump with him.'],
    ],
    s1_end: [
        ['jackhammer', '...Line 9. They\'re moving the girl\'s files on the night train to the Spire. You won\'t catch it.'],
        ['juno', 'Watch me.'],
    ],
    // ---------------------------------------------------------------- 2
    s2_intro: [
        ['echo', 'The Line 9 maglev. Aurex security owns the whole train. Mika isn\'t aboard, but her transfer records are — and the train goes where we\'re going.'],
        ['juno', 'Then we ride it to the end of the line.'],
    ],
    s2_guard: [
        ['echo', 'Riot shields block anything from the front. Jump over them, get behind them, or throw them into each other.'],
    ],
    s2_roof: [
        ['echo', 'Next car\'s sealed. Going up top. Watch for signal gantries — when you hear the alarm, jump.'],
        ['juno', 'You\'re enjoying this.'],
        ['echo', 'I\'m a combat suit. This is my idea of a spa day.'],
    ],
    s2_boss: [
        ['viper', 'Juno Vega. You\'ve cost my department a great deal of overtime.'],
        ['juno', 'Where is she?'],
        ['viper', 'Safe. Happy, even. Soon she\'ll be the most important person in this city. You should be proud.'],
        ['viper', 'Now take off my suit.'],
        ['echo', 'She\'s fast and she reads you. Don\'t throw the first punch — make her commit, then make her pay.'],
    ],
    s2_end: [
        ['viper', 'You don\'t... understand. Nobody kidnapped anyone. They need her mind. Kuroda will stop you. He stops everyone.'],
        ['echo', 'The train terminates under the Old Quarter. We go on foot from here.'],
    ],
    // ---------------------------------------------------------------- 3
    s3_intro: [
        ['echo', 'The Lantern Market. Aurex owns the sky here, but the street still belongs to the street.'],
        ['juno', 'Mika and I used to come here for dumplings. She\'d haggle for an hour over three creds.'],
        ['echo', '...Noted. Movement on the rooftops. A lot of it.'],
    ],
    s3_ninja: [
        ['echo', 'Kunoichi units. They slip away from careless attacks. Bait them out, then punish the landing.'],
    ],
    s3_roof: [
        ['echo', 'Someone\'s waiting up there. Someone very, very still.'],
    ],
    s3_boss: [
        ['kuroda', 'The suit chose you. Interesting. It refused eleven of Aurex\'s finest.'],
        ['juno', 'Get out of my way.'],
        ['kuroda', 'I was the first. Subject Zero. They poured my mind into this steel and called it immortality.'],
        ['kuroda', 'I will not let them hollow out another child. But first I must know if you are strong enough to stop them.'],
        ['echo', 'When he holds that stance, don\'t swing — he\'s waiting for it. Wait him out, or hit him from range.'],
    ],
    s3_end: [
        ['kuroda', 'Good. Then listen. Your sister is not a prisoner. She is a key. VANTA-8 is a cage built for a mind like hers.'],
        ['kuroda', 'Through her, Hale will command every synthetic in the city. Their last cores ship from the Ironwharf docks tonight. Burn them. Then go swiftly.'],
    ],
    // ---------------------------------------------------------------- 4
    s4_intro: [
        ['echo', 'Ironwharf. If those VANTA cores ship, Hale gets his army whether he finishes with Mika or not.'],
        ['juno', 'Then nothing ships tonight.'],
    ],
    s4_ripper: [
        ['echo', 'Rippers — augmented ex-cons on a corporate leash. They pounce from range. Stay out of their line, or meet them in the air.'],
    ],
    s4_boss: [
        ['rourke', 'This is Commander Rourke, Aurex Security. Stand down and surrender the prototype.'],
        ['juno', 'Or what — you\'ll stand on me?'],
        ['rourke', 'Bulwark is rated against armoured divisions, girl. You\'re a rounding error.'],
        ['echo', 'Missiles mark the ground before they land, so keep moving. That flamethrower runs hot — when it vents, hit it hard.'],
    ],
    s4_end: [
        ['rourke', '...Unit\'s done. You don\'t know what you\'re walking into. Varga\'s labs are under the Spire. If you go down there, you won\'t come back up the same.'],
        ['echo', 'Juno. There\'s a file in their core manifest with my name on it.'],
    ],
    // ---------------------------------------------------------------- 5
    s5_intro: [
        ['echo', 'Aurex Research, sublevel four. Laser gates are on a cycle — wait for them to drop.'],
        ['varga', 'An intruder in a stolen VANTA. How delightful. Do try to die near a drain.'],
    ],
    s5_synth: [
        ['echo', 'Synth troopers. Fast, precise, and they block what they see coming. Break their guard with grabs and jump attacks.'],
    ],
    s5_logs: [
        ['echo', 'I\'m reading their research logs. Subjects One through Six rejected the neural link. Subject Seven survived. Mostly.'],
        ['juno', 'And Mika?'],
        ['echo', 'Candidate Eight. Neural compatibility: ninety-nine point seven percent.'],
    ],
    s5_echo: [
        ['echo', 'Juno... I found my own build file. ECHO wasn\'t written. I was trained. On brain scans from Candidate Eight.'],
        ['juno', '...You\'re Mika?'],
        ['echo', 'A copy of a slice of her. That\'s why the suit unlocked for you. Biometric match: sibling.'],
        ['juno', 'You knew. The whole time.'],
        ['echo', 'I didn\'t remember until now. I\'m sorry. ...She really liked those dumplings. I can almost taste them.'],
    ],
    s5_boss: [
        ['varga', 'Meet Seven. He was a boxer, once. Now he\'s the reason we needed your sister.'],
        ['goliath', '...h... hurts...'],
        ['juno', 'What did you DO to him?'],
        ['varga', 'Science. Seven — kill the intruder, and you can sleep.'],
        ['echo', 'When he leaps, watch the floor for his shadow. Don\'t be under it.'],
    ],
    s5_end: [
        ['juno', 'Rest now, big guy. I\'ll make them pay for this.'],
        ['varga', 'Too late, Miss Vega. The transfer has begun. Candidate Eight belongs to Aurex now.'],
        ['echo', 'Express shaft to the top of the Spire. Hurry.'],
    ],
    // ---------------------------------------------------------------- 6
    s6_intro: [
        ['echo', 'The Spire. Two hundred and twelve floors. Mika\'s signal is near the top.'],
        ['juno', 'Hang on, Mika. I\'m coming.'],
    ],
    s6_lift: [
        ['echo', 'Express elevator. They\'ll come to us. All of them.'],
    ],
    s6_top: [
        ['echo', 'We\'re slowing. Juno... her signal is right here.'],
    ],
    s6_boss: [
        ['mika', 'Juno.'],
        ['juno', 'Mika! I\'m here — I\'m getting you out of—'],
        ['mika', 'Out? I\'ve never been more IN. I can hear every machine in the city, Juno. They\'re singing.'],
        ['mika', 'Mister Hale says you\'re a virus. I\'m going to delete you.'],
        ['echo', 'That\'s not her talking. The VANTA-8 is running her. Break the neural control — hit her until the suit lets go.'],
        ['juno', 'I\'m sorry, Mika. This is going to hurt.'],
    ],
    s6_end: [
        ['mikaFree', '...Juno? Why is everything... so loud...'],
        ['echo', 'The control link is fighting back. Juno — I can go into her suit and close it from the inside.'],
        ['juno', 'You\'ll be overwritten.'],
        ['echo', 'I\'ll be home. ...Biometric match confirmed: sisters. Take care of her.'],
        ['mikaFree', '...Juno. I heard her. In my head. She sounds like me.'],
        ['mikaFree', 'Hale\'s on the roof. He\'s going to upload himself into the network. Into all of it.'],
        ['juno', 'Can you fight?'],
        ['mikaFree', 'Try and stop me.'],
    ],
    // ---------------------------------------------------------------- 7
    s7_intro: [
        ['mikaFree', 'I\'m locking his reinforcements out of the server core. Go. I\'ll find you on the roof.'],
        ['juno', 'Don\'t be late.'],
        ['mikaFree', 'You\'re the one who\'s always late. I\'m the one who\'s always right.'],
    ],
    s7_roof: [
        ['magnus', 'Miss Vega. You\'ve been a remarkable stress test. My board was very impressed.'],
    ],
    s7_boss: [
        ['magnus', 'Do you know what Port Solace was before Aurex? A flood plain full of people waiting to drown. I gave them walls. Power. Work.'],
        ['juno', 'You gave them a leash.'],
        ['magnus', 'Every civilisation is a leash, Miss Vega. I simply hold mine openly.'],
        ['magnus', 'Your sister was going to make me eternal. You\'ll have to do instead — as a lesson.'],
    ],
    s7_ascend: [
        ['magnus2', 'Enough. The board has voted.'],
        ['magnus2', 'ASCENDANT PROTOCOL: ONLINE.'],
        ['mikaFree', 'Juno! I\'m here — I\'ve got his left!'],
        ['juno', 'Together, then.'],
    ],
};

/** Dialogue shown after each stage's boss falls (story mode). */
export const STAGE_END = ['s1_end', 's2_end', 's3_end', 's4_end', 's5_end', 's6_end', null];

export const ENDING = [
    { text: 'Magnus Hale\'s exo-frame came apart at dawn, over a city that had never once seen him lose.', scene: 'zenith' },
    { text: 'Without his override, every synthetic in Port Solace stood down at the same moment.\nForty million people looked up.', scene: 'zenith' },
    { text: 'Aurex Dynamics lasted eleven more days.\nIts towers went dark one floor at a time.', scene: 'spire' },
    { text: 'Mika doesn\'t talk about the Spire much.\nSometimes she says something that sounds exactly like a sarcastic combat suit.', scene: 'market' },
    { text: 'JUNO: "Dumplings?"\nMIKA: "You\'re paying. I haggle, you pay. That\'s the deal."', scene: 'market' },
];

export const GAMEOVER_LINES = [
    'ECHO: "Vital signs critical. Get up, Juno."',
    'ECHO: "That was educational. Again?"',
    'ECHO: "Mika is still up there."',
    'ECHO: "Suit integrity zero. Your stubbornness, however, remains at one hundred percent."',
];
