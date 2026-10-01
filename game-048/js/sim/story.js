/**
 * story.js — "The Graduating Class". Chapter metadata, comm scenes and battle
 * barks. {cs} is the pilot's callsign; {CS} the same in capitals.
 *
 * Scenes are queued on the profile (profile.story.queue) so a reload in the
 * middle of a scene resumes there.
 */

export const CAST = {
    kismet: { name: 'KISMET', role: 'Frame AI', color: '#ffd84d' },
    varga: { name: 'Cmdr. Ilse Varga', role: 'Instructor', color: '#ff8a5c' },
    juno: { name: 'Juno "Halo" Okafor', role: 'Cadet, Blue Flight', color: '#5cc8ff' },
    dace: { name: 'Chief Rourke Dace', role: 'Hangar Chief', color: '#9cff6b' },
    det: { name: 'THE DETERMINANT', role: '', color: '#ff3355' },
    null: { name: 'VARGA//NULL', role: '', color: '#ff3355' },
    pell: { name: 'Officer Pell', role: 'Signals', color: '#c49cff' },
};

export const CHAPTER_INFO = [
    { name: 'Simulation', place: 'Halcyon Sim Bay', sky: ['#04121c', '#0a2a3a'], neb: 190, planet: null, grid: true, root: 45, tempo: 112 },
    { name: 'Live Fire', place: 'Halcyon Perimeter', sky: ['#05060f', '#141a3a'], neb: 220, planet: { hue: 205, ring: true }, root: 43, tempo: 118 },
    { name: 'The Rust Belt', place: 'Drifting Shipyards', sky: ['#0f0705', '#3a1a0c'], neb: 22, planet: { hue: 25, ring: false }, root: 40, tempo: 122 },
    { name: 'Glasswater', place: 'Ocean Moon Glasswater', sky: ['#020b12', '#0c3446'], neb: 185, planet: { hue: 190, ring: false, ocean: true }, root: 42, tempo: 116 },
    { name: 'The Silent Front', place: 'Fleet Line, Coalsack Edge', sky: ['#07040c', '#25103a'], neb: 285, planet: { hue: 300, ring: true }, root: 38, tempo: 126 },
    { name: 'Probability Storm', place: 'The Uncertain Nebula', sky: ['#0d0310', '#3a0b3a'], neb: 320, planet: null, storm: true, root: 41, tempo: 130 },
    { name: 'Zero Variance', place: 'Heart of the Determinant', sky: ['#120204', '#3a0610'], neb: 350, planet: { hue: 355, ring: true, core: true }, root: 36, tempo: 134 },
];

export const SCENES = {
    prologue: {
        kicker: 'Halcyon Flight Academy · Carrier Meridian', title: 'The Probability Engine', bg: 0,
        lines: [
            ['varga', 'Cadet {cs}. Eyes front. Do you know why the frame in front of you has a slot machine for a heart?'],
            ['varga', 'Forty years ago the Determinant came out of the Coalsack. It computes. It predicts. Every shot we fired, it had already dodged — because our weapons were aimed. Calculated. Knowable.'],
            ['varga', 'So we stopped aiming. The Probability Engine does not calculate. It gambles. The Determinant cannot predict a choice nobody has made yet.'],
            ['kismet', "Hello! I'm KISMET, your frame's probability kernel. I've run the numbers on you, cadet. They're inconclusive. I love that."],
            ['varga', 'Every symbol on those reels is a weapon or a system. Lines multiply. Cores overdrive. And the enemy will do everything it can to make your luck run out.'],
            ['juno', "Don't let her scare you, {cs}. I've seen your sim scores. You'll be fine. Probably."],
            ['varga', 'Okafor. Out. — {cs}: simulator bay. Show me what you have.'],
        ],
    },
    intro0: {
        kicker: 'Chapter 0', title: 'Simulation', bg: 0,
        lines: [
            ['kismet', "Simulator online. Holo-drones loading. They can't hurt you. Well. They can hurt your grade."],
            ['varga', 'Spin the reels. Every symbol that lands fires: Blades and Cannons at your target, Shields to cover you, Repair to patch you up.'],
            ['varga', 'Three of a kind from the left on a payline hits far harder. Lines in the same spin chain, and every link multiplies.'],
            ['varga', 'Once the reels land you may spend energy to nudge one. Use it. A pilot who accepts every spin is a pilot who loses.'],
        ],
    },
    boss0: {
        kicker: 'Simulation', title: 'ARBITER-0', bg: 0,
        lines: [
            ['varga', 'ARBITER-0. A simulation of a Determinant field commander. It will jam your reels. Purge them with energy, or work around them.'],
            ['kismet', "It's a hologram. Its feelings can't be hurt. Go wild."],
        ],
    },
    outro0: {
        kicker: 'Simulation complete', title: 'Passable', bg: 0,
        lines: [
            ['varga', 'Passable.'],
            ['juno', "From her, that's a parade."],
            ['varga', 'Tomorrow you fly live. A training sweep of the Halcyon perimeter — real frames, real fuel. Chief Dace will fit your frame. Do not break it.'],
            ['dace', "Kid. Welcome to my hangar. That frame's yours now. Every scrap you bring back, I'll bolt onto it: more lines, more reels, bigger guns. The Refinery runs while you sleep. Bring me scrap."],
        ],
    },
    intro1: {
        kicker: 'Chapter 1', title: 'Live Fire', bg: 1,
        lines: [
            ['kismet', 'Perimeter sweep, sector four. Nothing out here but ice and old satellites. I estimate a 97% chance of boredom.'],
            ['juno', 'Blue Flight checking in. Race you to the beacon, {cs}?'],
            ['varga', 'Okafor, maintain formation— wait. Contacts. Multiple. That is not a drill signature.'],
            ['det', 'VARIANCE DETECTED AT HALCYON. VARIANCE WILL BE CORRECTED.'],
            ['varga', 'All cadets, weapons free. This is not a simulation. Repeat: this is not a simulation.'],
            ['kismet', "I'd like to revise my estimate."],
        ],
    },
    boss1: {
        kicker: 'Live Fire', title: 'Verdict', bg: 1,
        lines: [
            ['varga', "A Lancer Prime. Fleet calls that one 'Verdict'. It has been hunting academy frames for a decade."],
            ['kismet', 'It jams two reels at a time. Keep energy back for purges.'],
            ['det', 'CADET {CS}. YOUR OUTCOME HAS BEEN CALCULATED.'],
        ],
    },
    outro1: {
        kicker: 'Live Fire', title: 'Lockdown', bg: 1,
        lines: [
            ['juno', "{cs}! You got it! You actually— okay. I'm going to stop yelling now."],
            ['varga', 'The academy is on lockdown. The Determinant has not touched Halcyon in eleven years. Something has changed.'],
            ['varga', 'The Rust Belt shipyards are full of decommissioned frames. Parts. Cores. We will need them. You and Okafor go.'],
            ['dace', "Pulled a reel housing off that Lancer, kid. Bring me cores and your frame gets a fourth reel. And I've got missile pods, if you've got the scrap."],
        ],
    },
    intro2: {
        kicker: 'Chapter 2', title: 'The Rust Belt', bg: 2,
        lines: [
            ['kismet', 'Drifting shipyards, eighty kilometres of them. My favourite kind of place: full of junk with potential.'],
            ['juno', "Movement in the cranes. Mites. Hundreds of them. They're eating the hulls."],
            ['varga', 'Something is feeding them. Find it.'],
            ['kismet', 'Note: Corruptors out here write Glitches into your strips — dead symbols. If the reels start to rot, a Debug Patch scrubs them clean.'],
        ],
    },
    boss2: {
        kicker: 'The Rust Belt', title: 'The Matriarch', bg: 2,
        lines: [
            ['juno', "That's not a nest. That's a factory."],
            ['kismet', 'Grinder Matriarch. She builds Mites out of the hulls. And out of us, given the chance.'],
            ['det', 'MATERIAL WILL BE REPURPOSED.'],
        ],
    },
    outro2: {
        kicker: 'The Rust Belt', title: 'Corridor', bg: 2,
        lines: [
            ['juno', "We've got enough salvage to rebuild half of Blue Flight."],
            ['varga', 'Good, because we move now. Glasswater is under siege — an ocean moon, forty thousand colonists, one evacuation corridor. The Determinant is pinching it shut.'],
            ['varga', 'I lead the evacuation myself. Cadets fly cover. And {cs} — Dace says your frame can take an Arc projector. Fit it.'],
            ['dace', "Lightning that jumps between targets. Beautiful kit. The Targeting Matrix can take a fourth row too, if you've got the cores. Don't say I never give you anything."],
        ],
    },
    intro3: {
        kicker: 'Chapter 3', title: 'Glasswater', bg: 3,
        lines: [
            ['kismet', 'Glasswater. An ocean the size of a planet with a city on the bottom. The Determinant has frozen the surface solid.'],
            ['varga', 'Transports launching in ninety seconds. Cadets, keep that corridor clear. Nothing touches the ships.'],
            ['juno', "Copy, Commander. Halo's on the left wing."],
            ['det', 'COLONY GLASSWATER: PROBABILITY OF SURVIVAL, ZERO. THIS IS NOT A THREAT. IT IS A MEASUREMENT.'],
        ],
    },
    boss3: {
        kicker: 'Glasswater', title: 'Under the Ice', bg: 3,
        lines: [
            ['varga', 'Something under the ice. Something huge.'],
            ['kismet', 'Tidelock Leviathan. It locks reels from the right — one more with every surge — until it crushes. Kill it before the tide comes all the way in.'],
        ],
    },
    outro3: {
        kicker: 'Glasswater', title: 'Taken', bg: 3,
        lines: [
            ['juno', "Transports are clear! All forty thousand— {cs}. Where's Varga's frame?"],
            ['kismet', "Commander Varga's transponder… her frame is being pulled into a Determinant carrier. She's alive. Her reels have stopped."],
            ['varga', '…cadet. Do not follow. That is an order. Get them home—'],
            ['juno', "We're going after her."],
            ['kismet', 'I calculate that we are. I also calculate that I have never wanted to be wrong more.'],
            ['dace', "I'm putting everything I've got into your frame, kid. Fifth reel, if you find me the cores. Go get her back."],
        ],
    },
    intro4: {
        kicker: 'Chapter 4', title: 'The Silent Front', bg: 4,
        lines: [
            ['kismet', 'The Silent Front. Where the fleet meets the Determinant. Nobody talks on comms here — it listens.'],
            ['juno', "Varga's signal is in there. Faint. Regular. Too regular."],
            ['kismet', "Her reactor is beating at exactly sixty hertz, {cs}. That isn't a human rhythm."],
        ],
    },
    boss4: {
        kicker: 'The Silent Front', title: 'VARGA//NULL', bg: 4,
        lines: [
            ['null', 'CADET {CS}. YOU ARE OUT OF FORMATION.'],
            ['juno', "Commander? Commander, it's us—"],
            ['kismet', "That's Varga's frame, rewritten. Its reels don't spin any more. It copies yours: every line you land, it throws back at you."],
            ['null', 'LUCK IS A FAILURE OF INFORMATION. I HAVE BEEN CORRECTED. YOU WILL BE TOO.'],
        ],
    },
    outro4: {
        kicker: 'The Silent Front', title: 'Spinning Again', bg: 4,
        lines: [
            ['kismet', "Her reels… they're spinning again. Cockpit holding. She's alive. She's ejecting!"],
            ['varga', '…{cs}. Okafor. You disobeyed a direct order.'],
            ['juno', "Yes, ma'am."],
            ['varga', 'Good. Listen. I have been inside it. The Determinant is not an army — it is one mind, afraid of one thing: an outcome it cannot predict. There is a storm at its centre where it computes everything. The Arbiter guards the way.'],
            ['varga', 'I am not fit to fly. You two are. Finish it.'],
        ],
    },
    intro5: {
        kicker: 'Chapter 5', title: 'Probability Storm', bg: 5,
        lines: [
            ['kismet', "Oh. Oh, look at it. A nebula where every particle is a decision. It's the most beautiful thing I've ever seen and it would like to kill us."],
            ['juno', "Sensors are useless. Everything's reading as 'maybe'."],
            ['kismet', 'That is the point. The Determinant drowns uncertainty here. Our reels are going to hurt in this place.'],
        ],
    },
    boss5: {
        kicker: 'Probability Storm', title: 'The Arbiter', bg: 5,
        lines: [
            ['det', 'THE ARBITER WILL RENDER JUDGEMENT.'],
            ['kismet', 'It writes CERTAINTY into every strip, every turn. Our reels will fill with Glitches. Win fast or win ugly.'],
            ['juno', "{cs}, I'll draw its fire. Go."],
        ],
    },
    outro5: {
        kicker: 'Probability Storm', title: 'Alone', bg: 5,
        lines: [
            ['kismet', 'The Arbiter is down. The way to the core is open. Halo— Halo, respond.'],
            ['juno', "…took a hit. Frame's dead. I'm drifting, but I'm fine. Don't you dare turn around, {cs}."],
            ['varga', 'Search and rescue is inbound for Okafor. Every frame the academy has left is coming in behind you. Go.'],
            ['kismet', "It's just us now. I've run the numbers on the final approach. I'm not going to tell you what they are."],
        ],
    },
    intro6: {
        kicker: 'Chapter 6', title: 'Zero Variance', bg: 6,
        lines: [
            ['kismet', 'Here it is. The heart of the Determinant. A machine that computed every possible future and decided there should be only one.'],
            ['det', 'CADET {CS}. YOU ARE THE LAST VARIANCE. EVERY SPIN YOU HAVE EVER MADE, I HAVE COMPUTED.'],
            ['kismet', "It's lying. Nobody computes a coin flip that hasn't happened yet."],
        ],
    },
    boss6: {
        kicker: 'Zero Variance', title: 'THE DETERMINANT', bg: 6,
        lines: [
            ['det', 'I AM THE SUM OF ALL OUTCOMES. THERE IS NOTHING LEFT TO CHANCE.'],
            ['kismet', 'Then let us give it something new. Spin, {cs}.'],
        ],
    },
    outro6: {
        kicker: 'Zero Variance', title: 'Uncertain', bg: 6,
        lines: [
            ['kismet', "Its core is… spinning. It's spinning! It doesn't know what comes next. For the first time in forty years, it doesn't know."],
            ['det', '…UNCERTAIN. I AM… UNCERTAIN. IS THIS… WHAT YOU FEEL?'],
            ['kismet', 'Every single time. You get used to it.'],
        ],
    },
    ending: {
        kicker: 'Epilogue', title: 'The Graduating Class', bg: 1,
        lines: [
            ['varga', 'Cadets of the Halcyon Flight Academy. Today, you graduate.'],
            ['varga', '{cs}. Step forward. You flew into the one place nothing could be predicted, and you came back. That is the job.'],
            ['juno', 'Pilot {cs}. Has a ring to it. — I got a new frame, by the way. It has six reels. Jealous?'],
            ['dace', 'Your frame is still in my hangar, pilot. Still room for upgrades. And there are Null remnants out there who never got the memo.'],
            ['kismet', "Threat levels unlocked. The Sim Ladder goes up forever. I've run the numbers on our future. Inconclusive. I love that."],
        ],
    },
};

export function sceneText(text, callsign) {
    return text.replaceAll('{cs}', callsign).replaceAll('{CS}', callsign.toUpperCase());
}

/** KISMET's battle barks, keyed by trigger. */
export const BARKS = {
    start: ['Reels hot. Let\'s get lucky.', 'Probability Engine online.', 'I like these odds. I like all odds.', 'Spin when ready, {cs}.'],
    bigChain: ['That is a chain!', 'Look at it go!', 'Combo! The house is crying.', 'Statistically outrageous. Do it again.'],
    overdrive: ['OVERDRIVE! Everything doubles!', 'Cores aligned — overdrive!', 'Reactor at maximum improbability!'],
    jackpot: ['JACKPOT!!', 'Five cores! Five! I need a moment.', 'The house has been broken.'],
    jam: ['They jammed a reel. Purge it or play around it.', 'Reel lock detected. Rude.'],
    glitch: ['Glitches in the strips. That will rot our odds.', 'Corruption on the reels.'],
    lowHp: ['Hull critical! Shields, repairs, anything!', '{cs}, we are coming apart.'],
    kill: ['Target down.', 'Scratch one.', 'Splash.', 'And stay down.'],
    whiff: ['Nothing landed. Nudge next time?', 'Dead spin. It happens.'],
    win: ['Area clear.', 'Good flying.', 'We won. I never doubted. Much.'],
    boss: ['Big one. Stay calm, spin smart.', 'Here we go.'],
};
