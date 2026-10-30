// The story: you are a rookie pilot on the carrier Aurora, and Mira, the flight controller in your
// headset, talks you through your first days defending the Sol Gate. Plain data and small pure
// functions (no DOM, no Math.random), so the tests can check every line.
//
// Two kinds of talk:
//   cutscenes  full-screen scenes with her portrait, a typed-out box and Next / Skip. They play at the
//              start, before and after the first three bosses, and the finale.
//   comms      a short line in a strip at the top of the screen as each wave begins (and now and then
//              when something happens), while the game goes on.
// `{cs}` in a line is your callsign, which climbs from Rookie as you beat bosses.

export const NAME = 'MIRA';
export const ROLE = 'FLIGHT CONTROL';
export const MOODS = ['neutral', 'smile', 'worry', 'wink'];

/** Rookie until the first boss falls, then Pilot, Ace, and finally Starblazer. */
export function callsign(wave) {
    const beaten = Math.floor(Math.max(0, wave - 1) / 5);
    return ['Rookie', 'Pilot', 'Ace', 'Starblazer'][Math.min(3, beaten)];
}
const fill = (text, wave) => text.replaceAll('{cs}', callsign(wave));
const pick = (arr, n) => arr[Math.abs(n) % arr.length];

// ------------------------------------------------------------------ cutscenes
// scene: the backdrop ('bridge', 'window0'..'window2' with a boss looming, 'hangar'); where: its caption.
export const CUTSCENES = {
    intro: {
        where: 'AURORA - BRIDGE', scene: 'bridge', lines: [
            { mood: 'smile', text: "Well, look at you. Fresh off the assembly line! Welcome aboard the Aurora, Rookie. I'm Mira, your flight controller." },
            { mood: 'neutral', text: "The Brood is swarming the Sol Gate. Command sent everything they had. That's you. I'm so sorry." },
            { mood: 'smile', text: 'Lesson one: the stick moves you, held fire shoots things, and BOMB makes everything go away for a bit. Lesson two: do not crash.' },
            { mood: 'wink', text: "Lesson three: I'm hilarious. That one's mandatory. Launching you now. Try not to dent my paint." },
        ],
    },
    boss0: {
        where: 'AURORA - OBSERVATION DECK', scene: 'window0', lines: [
            { mood: 'worry', text: "Rookie, hold up. That's a Brood mothership coming through the gate. It's big, it's ugly, and it has strong opinions about you." },
            { mood: 'neutral', text: "Aim for the middle, dodge the fans and keep moving. Win, and I'll open the hangar for you. Lose... let's win." },
        ],
    },
    dock0: {
        where: 'AURORA - HANGAR BAY', scene: 'hangar', lines: [
            { mood: 'smile', text: "You did it! You actually did it! I had money on you losing. Please don't tell anyone." },
            { mood: 'neutral', text: "We scraped credits off the wreckage. Spend them here: engines, cannons, bombs, shields, a magnet for loose capsules." },
            { mood: 'smile', text: "Upgrades are yours to keep, even if you lose a ship. Supplies are one-offs. Shop fast, the Brood doesn't wait." },
        ],
    },
    boss1: {
        where: 'AURORA - OBSERVATION DECK', scene: 'window1', lines: [
            { mood: 'worry', text: "Pilot, something's off. The Brood never lines up like this. Somebody is herding them." },
            { mood: 'neutral', text: "That crab ahead is the Warden. Claws, a temper, and a taste for spirals. Don't chase the spiral, slip through the gaps." },
        ],
    },
    boss2: {
        where: 'AURORA - OBSERVATION DECK', scene: 'window2', lines: [
            { mood: 'worry', text: "There. That's the signal's source. The Overlord. It's been steering the whole swarm." },
            { mood: 'neutral', text: "Its beam draws a flashing line first. Get off the line, Ace. If you're standing on it when it fires, we skip the eulogy." },
        ],
    },
    finale: {
        where: 'AURORA - HANGAR BAY', scene: 'hangar', lines: [
            { mood: 'smile', text: "The Overlord's gone. The whole swarm just fell apart. You saved the Sol Gate. Single-handedly. Give me a minute." },
            { mood: 'neutral', text: "Command called. They want to promote you. Your new callsign is Starblazer. Yes, they asked. Yes, I picked it." },
            { mood: 'worry', text: "Bad news: there's always more Brood. The gate never stays quiet, and they'll be back angrier." },
            { mood: 'smile', text: "Good news: you're ready. Upgrade, launch, and show them what a Starblazer does. I'll keep the coffee hot." },
        ],
    },
};

/** The cutscene (if any) that plays as the wave `n` boss arrives. */
export function preBossScene(n) { return { 5: 'boss0', 10: 'boss1', 15: 'boss2' }[n] || null; }
/** The cutscene (if any) that plays when you dock after the boss of wave `n`. */
export function dockScene(n) { return { 5: 'dock0', 15: 'finale' }[n] || null; }

// ------------------------------------------------------------------ comms: one per wave
const WAVE_LINES = {
    1: 'Drones ahead, {cs}. Nothing shoots yet, so enjoy the honeymoon.',
    2: 'Weavers now. A blinking halo means a power-up inside: shoot it, grab it.',
    3: 'Formation incoming. Some will dive at you. Standing still is how rookies become scenery.',
    4: 'Bonus stage! Nothing shoots back. A perfect run earns you a bomb.',
    5: 'Brood mothership. Big, ugly and angry, like my last boyfriend. Aim for the middle!',
    6: 'New sector. Saucers fire twice, and the drones are marching. Keep moving.',
    7: "Darts! They track you for a second, then commit. Don't commit to a spot.",
    8: 'Cruiser ahead. Slow, tough and carrying a gift. Crack it open.',
    9: 'Another bonus stage. Free points, free bombs. I love free.',
    10: "The Crab Warden. Don't chase the spirals, slip through the gaps.",
    11: 'Carrier on the scope. It launches drones the way I launch excuses: constantly.',
    12: 'Mines. Pop them from a distance unless you enjoy fireworks up close.',
    13: "Quiet sky. That's never good. Eyes open, {cs}.",
    14: 'Bonus stage. Hit every one: show-off points are still points.',
    15: "The Overlord. Watch for the flashing line: that's the beam. Don't be on it.",
};
const GENERIC = {
    normal: [
        'Fresh wave. Same plan: shoot first, panic never.',
        'More of them. Fewer excuses.',
        'Keep your thumbs warm, {cs}.',
        'They keep coming. So do you. I like that.',
        'Bombs are for emergencies. This could be one.',
        "Hull integrity is a suggestion. Don't test it.",
        'Chain those kills. The multiplier loves you.',
        'Blinking halo? You know what to do.',
    ],
    bonus: ['Bonus stage. Nothing shoots. Go be a hero.', "Free points ahead. Don't be shy, {cs}.", 'A perfect run earns a bomb and my respect.'],
    boss: ['Another boss. Same face, worse attitude.', "It's back, and it brought extra armour.", 'Boss incoming. Give it the full treatment, {cs}.'],
};

/** The comm line for the start of wave n: { text, mood }. */
export function waveLine(n, kind, seed = 0) {
    const text = WAVE_LINES[n] || pick(GENERIC[kind === 'boss' ? 'boss' : kind === 'bonus' ? 'bonus' : 'normal'], n * 7 + seed);
    return { text: fill(text, n), mood: kind === 'boss' ? 'worry' : kind === 'bonus' || n === 4 ? 'smile' : 'neutral' };
}

// ------------------------------------------------------------------ comms: reactions
const REACT = {
    pdie: ['Ouch. That comes out of your pay. (There is no pay.)', "Hull breach! Don't worry, I have spare ships. Several.", "You're fine. I'm fine. We're all fine.", 'Ship down! Shaking it off in three, two...'],
    perfect: ['Perfect clear! Show-off.', "Flawless. I'm almost jealous.", 'Not one got away. Scary good, {cs}.'],
    lowlives: ['Last ship. No pressure. Okay, some pressure.', 'One ship left, {cs}. Make it a good one.'],
    oneup: ['Extra ship! Command must really like you.'],
};
const REACT_MOOD = { pdie: 'worry', perfect: 'smile', lowlives: 'worry', oneup: 'smile' };

/** A reactive comm: kind is pdie | perfect | lowlives | oneup. */
export function reaction(kind, wave, seed = 0) {
    return { text: fill(pick(REACT[kind], wave * 3 + seed), wave), mood: REACT_MOOD[kind] };
}

// ------------------------------------------------------------------ the end of a run, and repeat visits to the hangar
const OVER = [
    ['Well. That was... educational. Back to the hangar with you, {cs}.', 'First flights are for crashing. Next one is for not.'],
    ['Not bad, {cs}. Not good either. But not bad.', 'You gave them a fight. Next time, give them a funeral.'],
    ['The Brood got lucky. Let us make sure it never happens again.', "That was close. I'd say 'good job', but you're dead, so 'good effort'."],
    ["A heroic effort. Next time, a little less heroic and a bit more alive?", "The Gate held longer because of you. I'm putting that in your file. Posthumously."],
];
export function overLine(wave, seed = 0) {
    const tier = wave < 5 ? 0 : wave < 10 ? 1 : wave < 15 ? 2 : 3;
    return fill(pick(OVER[tier], wave + seed), wave);
}

const DOCK = ['Welcome back. Spend big, {cs}. Credits do not keep you warm.', "Hangar's open. Try the engines, they're my favourite.", "Another one down. You're making a habit of this.", 'Take your time. Well, take a minute. The Brood has no manners.'];
export function dockLine(wave, seed = 0) { return fill(pick(DOCK, wave + seed), wave + 1); }

/** Break `text` into lines of at most `width` characters, on word boundaries. */
export function wrap(text, width) {
    const lines = [];
    let line = '';
    for (const w of text.split(' ')) {
        if (line && line.length + 1 + w.length > width) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
    }
    if (line) lines.push(line);
    return lines;
}

/** A cutscene's lines with the callsign filled in. */
export function sceneLines(id, wave = 1) { return CUTSCENES[id].lines.map((l) => ({ mood: l.mood, text: fill(l.text, wave) })); }
