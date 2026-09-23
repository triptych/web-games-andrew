/**
 * story.js — the script: cadets, comms barks, briefings, endings.
 *
 * PURE data + small selector functions. The UI renders it; the sim triggers it
 * by id (`w.comms('juno_rescued')`). Keeping the text here rather than inline in
 * level scripts means a Node harness can assert that every id a level references
 * actually exists — see dev/check.mjs.
 */

// ------------------------------------------------------------------- cadets

export const CADETS = [
    {
        id: 'juno', name: 'Juno Fairweather', callsign: 'WRENCH', level: 1,
        ability: 'patchwork', abilityName: 'PATCHWORK',
        abilityDesc: 'Your hull patches itself: a spent flare rebuilds every 25 seconds, and escape pods carry an extra point of hull.',
        visor: 0x7dffd4, suit: 0x2b4a63,
        bio: 'Second-year engineering. Chews a stylus flat before every exam. Fixed the hangar coffee machine so many times it is technically hers.',
        rescueLine: 'Took you long enough, Sparrow. Move over, I am rewiring your shield bus.',
    },
    {
        id: 'bastion', name: 'Piotr Marek', callsign: 'BASTION', level: 2,
        ability: 'bastion', abilityName: 'BASTION DRONE',
        abilityDesc: 'A drone flies your wing, mirrors your fire, and eats one bullet every six seconds.',
        visor: 0xffd166, suit: 0x5a3a2b,
        bio: 'Two metres of terrified politeness. Best formation flyer in the year and will not hear it said.',
        rescueLine: 'I am — okay. I am okay. Give me the drone controls, I can do that, I can do that part.',
    },
    {
        id: 'isla', name: 'Isla Chen', callsign: 'SHARPSHOT', level: 3,
        ability: 'overcharge', abilityName: 'OVERCHARGE',
        abilityDesc: 'Grazing fills your Overdrive meter 60% faster.',
        visor: 0xff6b9d, suit: 0x3a2b5a,
        bio: 'Top of the class in gunnery and will tell you, unprompted, at length, forever.',
        rescueLine: 'Your grouping is atrocious. Hold still, I am recalibrating your graze sensors.',
    },
    {
        id: 'six', name: 'Dahlia Rook', callsign: 'SIX', level: 4,
        ability: 'magnet', abilityName: 'MAGNET WAKE',
        abilityDesc: 'Pods and pickups are pulled to you from three times the distance.',
        visor: 0xc9a7ff, suit: 0x2b2b3a,
        bio: 'Sixth year of a four-year course. Flies angry. Everyone assumed she would wash out; nobody ever asked her why she stayed.',
        rescueLine: 'Sixth year. Sixth. And the day it counts, the certificate is a pod hook. Fine. Fine!',
    },
    {
        id: 'kel', name: 'Kel Aramaki', callsign: 'WARDEN', level: 5,
        ability: 'secondflare', abilityName: 'SECOND FLARE',
        abilityDesc: 'Flare capacity +1, and each flare leaves a burning field where it detonated.',
        visor: 0x9fe8ff, suit: 0x1e3a4a,
        bio: 'Your flight instructor. Taught every drill you know, including the one he is about to use on you.',
        rescueLine: 'Vance. Look at me. Good. Now stop crying and hold the stick like I showed you.',
    },
];

export const CADET_BY_ID = Object.fromEntries(CADETS.map((c) => [c.id, c]));
export const TOTAL_CADETS = 211;

// --------------------------------------------------------------------- comms

const c = (who, text, dur = 4.5) => ({ who, text, dur });

export const COMMS = {
    // Level 1 --------------------------------------------------------------
    l1_open:       c('CONTROL', 'All wings — this is not a drill. Repeat, NOT A DRILL.'),
    l1_alone:      c('SPARROW', 'Control? Control, this is Cadet Vance, I am in a T-3 trainer, I have practice rounds—'),
    l1_control_out: c('CONTROL', '—get the pods. Vance. Get the p—', 3.2),
    l1_hook:       c('SPARROW', 'Okay. Okay. The hook still works. Fly over a pod and the hook does the rest.'),
    l1_first_pod:  c('SPARROW', 'Got you. I have got you. Stay in the pod.'),
    l1_pod_lost:   c('SPARROW', 'No — no, come back, I can still—', 3.0),
    l1_midboss:    c('JUNO', 'Sparrow! Big one on the dock arm, it is wearing the cargo loader!'),
    l1_boss:       c('JUNO', 'It has two claws and one brain cell. Watch the arms, shoot the middle.'),

    // Level 2 --------------------------------------------------------------
    l2_open:       c('JUNO', 'Pods are falling into Ashgate. Atmosphere will cook them in about twelve seconds each.'),
    l2_burn:       c('JUNO', 'Heat ring closing on that one — twelve seconds, Sparrow, go!'),
    l2_midboss:    c('SPARROW', 'Something is moving in the cloud layer. Something big enough to make its own weather.'),
    l2_boss:       c('JUNO', 'It hides in the cloud and vents lightning to see. So watch for the lightning.'),

    // Level 3 --------------------------------------------------------------
    l3_open:       c('BASTION', 'These are the shipbreaker yards. There were people working out here.'),
    l3_people:     c('ISLA', 'Sparrow, the salvage crews — they are flying the scav hulls. They are still IN them.'),
    l3_midboss:    c('BASTION', 'Sniper nest on the ring line. It paints you before it fires — leave the line.'),
    l3_boss:       c('ISLA', 'Four turrets on that battleship. Kill a turret, lose an attack. Shoot what matters!'),

    // Level 4 --------------------------------------------------------------
    l4_open:       c('SIX', 'You hear that? The whole field is keeping time. They are singing to each other.'),
    l4_beat:       c('ISLA', 'The pattern is on the beat. If you can hear it you can dodge it.'),
    l4_midboss:    c('SIX', 'Big seeder coming up. Do not get fancy, get low.'),
    l4_boss:       c('SIX', 'It conducts, Sparrow. Dodge on the downbeat and it is just a metronome with teeth.'),

    // Level 5 --------------------------------------------------------------
    l5_open:       c('JUNO', 'We are inside the tether. Everything in here used to be somewhere else.'),
    l5_kel_voice:  c('???', '...spacing, Vance. Your spacing is sloppy. It was always sloppy.'),
    l5_kel_named:  c('SPARROW', 'That is Instructor Aramaki. That is his VOICE.'),
    l5_midboss:    c('BASTION', 'Seraph class. It walls the arena and then fans you. Pick a gap early.'),
    l5_boss:       c('ISLA', 'Sparrow — he is using the drills. He is using OUR drills.'),
    kel_fighting_it: c('KEL', 'Vance. VANCE. It is riding the ship, not me — shoot the— shoot the shell!'),

    // Level 6 --------------------------------------------------------------
    l6_open:       c('KEL', 'Everyone still flying, form on the trainer. Yes, the trainer. Move.'),
    l6_all:        c('SIX', 'Whole class on your wing, Sparrow. Do not make it weird.'),
    l6_midboss:    c('JUNO', 'Tether core is opening. Whatever is up there, it knows we are coming.'),
    l6_boss:       c('KEL', 'That is the Heart. Everything it took, it is still using. Including them.'),
    heart_final:   c('KEL', 'It is opening a lane for every one of us you came back for. Fly them, Sparrow.'),

    // Generic --------------------------------------------------------------
    pod_streak:    c('SPARROW', 'Five in a row. Five. Nobody tell Instructor Aramaki I can fly.'),
    low_life:      c('JUNO', 'Hull is paper, Sparrow. Use a flare, that is what they are FOR.'),
    no_flares:     c('ISLA', 'Out of flares. Graze something and build Overdrive — carefully.'),
    od_ready:      c('ISLA', 'Overdrive is charged. Spend it on something that deserves it.'),
};

export function commsExists(id) { return Object.prototype.hasOwnProperty.call(COMMS, id); }

// ----------------------------------------------------------------- briefings

export const INTRO = [
    'HALCYON FLIGHT ACADEMY — in orbit of the gas giant ASHGATE',
    '',
    'Four hundred cadets. No war in living memory.',
    'At 06:41 station time, the Chorus arrives: one tether, kilometres long,',
    'hung between the planet and its moon, and everything that comes off it',
    'moves to the same rhythm.',
    '',
    'It does not destroy the station. It collects it.',
    '',
    'You are Cadet Theo Vance, callsign SPARROW. You are nineteen years old,',
    'you are the worst shot in your class, and you are in the practice hangar',
    'flunking a gunnery retake when the sky comes apart.',
    '',
    'Your ship is a trainer. Practice cannons. A tow hook rated for target drones.',
    'Two hundred and eleven of your classmates are in escape pods.',
    '',
    'The hook still works.',
];

export const BRIEFINGS = {
    1: { title: 'HANGAR RING', subtitle: 'HALCYON STATION — DOCK ARM SEVEN',
         lines: ['Pods are ejecting from the dormitory ring.',
                 'Fly over a pod to hook it. A pod that falls past you is gone.',
                 'Your cannons fire practice rounds. They will have to do.'] },
    2: { title: 'ASHGATE DESCENT', subtitle: 'UPPER CLOUD DECK — 40 km AND FALLING',
         lines: ['Pods are falling into the atmosphere and burning.',
                 'Heat rings show how long each one has. Twelve seconds.',
                 'Juno has your shield bus working. Do not waste it.'] },
    3: { title: 'THE RING YARDS', subtitle: 'SHIPBREAKER YARDS — ASHGATE B-RING',
         lines: ['The salvage crews are flying Chorus-grown hulls now.',
                 'They are still inside them. There is nothing you can do about that.',
                 'There are still pods out here. Do the thing you can do.'] },
    4: { title: 'THE CHOIR FIELD', subtitle: 'OPEN SPACE — SEEDER SWARM',
         lines: ['Everything here moves on one beat, together.',
                 'If you can hear the pattern, you can dodge the pattern.',
                 'This is the thick of it. Graze, build Overdrive, keep moving.'] },
    5: { title: 'TETHERCORE', subtitle: 'INSIDE THE CHORUS TETHER',
         lines: ['Kel Aramaki is alive at the core of this thing.',
                 'He is also flying against you. Both are true.',
                 'Shoot the shell, not the man. He will tell you when.'] },
    6: { title: 'THE LONG FALL', subtitle: 'ASCENT TO THE HEART — HALCYON BURNING BELOW',
         lines: ['Everyone you brought back is on your wing.',
                 'The Heart opens one safe lane for every classmate who came back with you.',
                 'Fly the lanes. Finish it.'] },
};

// ------------------------------------------------------------------- endings

export const ENDINGS = [
    {
        id: 'everyname', min: 200, title: 'EVERY NAME',
        lines: [
            'Two hundred and eleven names on the Halcyon roll.',
            'Kel reads all of them, on an open channel, while the station burns below.',
            'It takes eleven minutes. Nobody interrupts.',
            '',
            'The last name on the roll is yours, and by the time he reaches it',
            'there are two hundred and ten voices reading it with him.',
        ],
    },
    {
        id: 'wing', min: 140, title: 'WING',
        lines: [
            'Enough of you survive to reform the academy in exile.',
            'They ask what to call the new wing. Juno answers before you can:',
            '"Trainer Wing." The name sticks, and so does the joke, forever.',
            '',
            'You never do pass that gunnery retake.',
        ],
    },
    {
        id: 'muster', min: 60, title: 'MUSTER',
        lines: [
            'Enough cadets to crew one ship, and one ship is how anyone starts.',
            'Kel reads the roll. He gets through it. It costs him something to do that,',
            'and he does it anyway, every year, on the day.',
        ],
    },
    {
        id: 'ashes', min: 0, title: 'ASHES',
        lines: [
            'The Chorus dies. You win. Halcyon graduates a class of eleven.',
            '',
            'There is a version of this where you flew higher, slower, closer to the pods,',
            'and more of them came home. You will think about it.',
            'The hook still works. Go again.',
        ],
    },
];

export function endingFor(rescued) {
    return ENDINGS.find((e) => rescued >= e.min) ?? ENDINGS[ENDINGS.length - 1];
}

export function cadetForLevel(level) {
    return CADETS.find((cd) => cd.level === level) ?? null;
}
