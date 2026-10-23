// The whole story, as data. Pure: no DOM, no clock.
//
// A node is { title, art, text, choices, end? }. `text` is an array of paragraphs, or (G) => array.
// A choice is { t, to?, text?, fx?, req?, lock?, check?, id?, adv? }:
//   to     the node to move to; leave it out to stay on this one and just print the result text
//   text   a result passage printed before the destination
//   fx     effects: flag unflag give take health clarity und codex time(hours) say stats spec; an
//          array of them, each optionally with `when: req`
//   req    { flag notFlag item noItem room und flagsN:{of,n} }. A failed flag/noItem rule hides the
//          choice. A failed item/room/und/flagsN rule shows it locked, with the reason. `lock` shows
//          any failure locked, with that text.
//   check  { stat, dc, bonus: [items], pass: {text,fx,to}, fail: {text,fx,to} }: 2d6 + stat + bonus >= dc
//   id     a name the bot and the tests can find; adv marks a choice that moves the story on
// Template literals are used for prose so apostrophes need no escaping.

import { ITEMS, GEAR } from './data/items.js';

const f = (G, k) => !!G.flags[k];

const takeGear = GEAR.map((id) => ({
    t: `Take the ${ITEMS[id].name.toLowerCase()} (${ITEMS[id].blurb}).`,
    req: { noItem: id, notFlag: 'used_' + id, room: true },
    fx: { give: id },
}));

export const START = 'spec';

export const NODES = {
    // ------------------------------------------------------------------ the station
    spec: {
        title: 'PERSONNEL FILE', art: 'title',
        text: [
            `HALCYON OUTPOST — PERSONNEL FILE. NAVARRO, ALIX. POSTING: VESPER SURFACE STATION. STATUS: SOLE ON-SITE STAFF.`,
            `Before the terminal will open the day's work it asks you to confirm the discipline you were hired for. It will decide how you read what is coming.`,
        ],
        choices: [
            { t: `Computational genomicist. You trust the data before the world.`, to: 'wake',
                fx: { stats: { ANL: 4, FLD: 2, INT: 1, WIL: 3 }, spec: 'COMPUTATIONAL GENOMICIST' } },
            { t: `Field geneticist. You trust your boots and your hands.`, to: 'wake',
                fx: { stats: { ANL: 2, FLD: 4, INT: 2, WIL: 2 }, spec: 'FIELD GENETICIST' } },
            { t: `Neurogeneticist. You trust the feeling you get before the data arrives.`, to: 'wake',
                fx: { stats: { ANL: 2, FLD: 1, INT: 4, WIL: 3 }, spec: 'NEUROGENETICIST' } },
        ],
    },

    wake: {
        title: 'HALCYON OUTPOST', art: 'station',
        text: [
            `You wake to the three-tone chime of the sequencer, finished at last after nineteen hours.`,
            `Halcyon Outpost is a ring of pressure domes bolted to a basalt shelf, sixty-one light-years from anyone who could tell you what to do. Four of your colleagues drove north nine days ago to survey the Spires. Their last transmission came six days ago and was half a sentence long. The supply ship Ardent is due on day 60. It is day 41.`,
            `Beyond the bunk-room window the valley is the colour of a bruise. The glass-moss has crept another metre up the dome wall overnight. You tell yourself that is what moss does.`,
        ],
        choices: [{ t: `Go to the lab.`, to: 'lab' }],
    },

    lab: {
        title: 'THE LAB', art: 'lab',
        text: (G) => {
            const l = [`The lab smells of ozone and cold coffee. Racks of sample plates hum along the east wall. The sequencer waits at the end of the bench, its screen still lit.`];
            if (!f(G, 'seq1')) l.push(`One line blinks on the screen: RUN COMPLETE. 24 SAMPLES. REVIEW.`);
            if (!f(G, 'geared')) l.push(`Your field pack hangs empty beside the airlock door.`);
            else l.push(`Your pack is ready by the airlock door.`);
            return l;
        },
        choices: [
            { t: `Read the sequencer results.`, to: 'seq1', req: { notFlag: 'seq1' } },
            { t: `Run a deeper alignment on the non-coding regions.`, req: { flag: 'seq1', notFlag: 'motif' },
                check: { stat: 'ANL', dc: 8,
                    pass: { fx: { flag: 'motif', und: 10, codex: 'motif' }, text: [
                        `Hours later it falls out of the noise. Every 4,096 bases a stretch of what you had filed as junk repeats — not identically, but with a drift as regular as a metronome with a limp.`,
                        `Read as a signal, the drift is a counter. The genome is numbered. Each organism carries the whole book and a bookmark saying which chapter it is.`,
                    ] },
                    fail: { fx: { clarity: -1 }, text: [`The alignment collapses into static and a headache that sits behind your left eye like a thumb. Something is in there. You can't hold it.`] } } },
            { t: `Check the comms console.`, to: 'comms', req: { notFlag: 'comms_read' } },
            { t: `Open the equipment locker.`, to: 'gear' },
            { t: `Step into the airlock.`, to: 'airlock', id: 'airlock', adv: true, req: { flag: ['seq1', 'geared'] },
                lock: `FIRST: READ THE RESULTS AND PACK YOUR GEAR` },
        ],
    },

    seq1: {
        title: 'THE RESULTS', art: 'lab',
        text: [
            `You scroll the alignment. Twenty-four samples: glass-moss, a hundred-legged scavenger beetle, the translucent fungus from the dome seals, a sliver of spire-bark, a drop of Sump water, spores, three kinds of leaf-thing you never bothered to name.`,
            `They should be strangers. Different kingdoms of life share a third of their sequence if you are generous. The screen reports 99.97% identity across all twenty-four.`,
            `You check the calibration. You check the controls. You run the controls against the controls. The sequencer is not wrong.`,
        ],
        choices: [{ t: `Go back to the lab.`, to: 'lab', fx: { flag: 'seq1', und: 8, codex: 'uniform' } }],
    },

    comms: {
        title: 'COMMS CONSOLE', art: 'lab',
        text: [
            `The comms console is a slab of scratched grey plastic. Six days of static on the survey channel. Then the logs.`,
            `Dr. Osei, low and fast: "Alix, if you hear this — the Spires aren't trees. I've been counting. It sings at the ridge every dusk and it isn't noise, it's —" A long wet crackle. "Don't let Mags cut the —" The log ends.`,
            `You play it three times. On the third pass, under the static, there is a tone. Three notes, rising.`,
        ],
        choices: [{ t: `Go back to the lab.`, to: 'lab', fx: { flag: 'comms_read', und: 4, codex: 'osei' } }],
    },

    gear: {
        title: 'EQUIPMENT LOCKER', art: 'lab',
        text: (G) => [
            `A steel cabinet with a handwritten sign: TAKE WHAT YOU CAN CARRY. NOBODY WILL THANK YOU FOR HEROICS. — M.A.`,
            `Your pack holds six things. The locker offers seven. ${G.inv.length ? `You are carrying ${G.inv.length}.` : `You are carrying nothing yet.`} Click an item in the PACK panel to use or drop it.`,
        ],
        choices: [...takeGear, { t: `Close the locker.`, to: 'lab', fx: { flag: 'geared' } }],
    },

    airlock: {
        title: 'AIRLOCK', art: 'station',
        text: [`You cycle the inner door and stand a moment in the red light. Beyond the outer door is a world that has never once looked at you the same way twice.`],
        choices: [
            { t: `Open the outer door and go out.`, to: 'trail', id: 'out', adv: true, fx: { flag: 'outside', time: 0.5 } },
            { t: `Go back inside.`, to: 'lab' },
        ],
    },

    // ------------------------------------------------------------------ the valley
    trail: {
        title: 'THE FORK', art: 'flats',
        text: (G) => {
            const l = [`The trail forks where the basalt shelf gives way to the valley floor. The moss chimes faintly in the wind. Behind you the domes are small and bright; ahead the valley goes on like a held note.`];
            const seen = ['flats_done', 'sump_done', 'ridge_done'].filter((k) => f(G, k)).length;
            if (seen === 0) l.push(`Three places pull at you: the Moss Flats, the Sump, and the Chorus Ridge. Osei's last log mentioned the ridge by name.`);
            else if (seen < 2) l.push(`One site down. Osei's log, and the rover tracks, still point north.`);
            else l.push(`You have seen enough of the valley to know where the tracks lead. North, toward the Spires.`);
            return l;
        },
        choices: [
            { t: `Cross the Moss Flats.`, to: 'flats', req: { notFlag: 'flats_done' } },
            { t: `Go to the edge of the Sump.`, to: 'sump_edge', req: { notFlag: 'sump_done' } },
            { t: `Climb the Chorus Ridge.`, to: 'ridge', req: { notFlag: 'ridge_done' } },
            { t: `Make camp and rest.`, to: 'camp' },
            { t: `Strike out north, toward the Spires.`, to: 'spire_far', id: 'north', adv: true, fx: { time: 20 },
                req: { flagsN: { of: ['flats_done', 'sump_done', 'ridge_done'], n: 2 } }, lock: `SEE TWO OF THE THREE SITES FIRST` },
        ],
    },

    flats: {
        title: 'THE MOSS FLATS', art: 'flats',
        text: [
            `The Moss Flats run for a kilometre, a plain of glassy, knee-high filaments that chime when the wind touches them. Each frond ends in a bead of clear fluid, like dew that never dries.`,
            `Your boots leave dents. When you look back, the moss in the dents is already straightening, and the fronds nearest you are all leaning your way.`,
        ],
        choices: [
            { t: `Watch the moss closely.`, req: { notFlag: 'moss_learns' },
                check: { stat: 'INT', dc: 7,
                    pass: { fx: { flag: 'moss_learns', und: 6, codex: 'moss' }, text: [
                        `You crouch in the moss and wait. It takes eleven minutes. Then a frond brushes your glove and releases a bead of fluid, and the neighbouring fronds, in a slow wave, copy the bend of your wrist.`,
                        `It isn't reacting. It's rehearsing.`,
                    ] },
                    fail: { fx: { clarity: -1 }, text: [`You stare until your eyes water. The moss stares back, if moss can. Nothing you could put in a notebook.`] } } },
            { t: `Take a living sample.`, req: { item: 'kit', notFlag: 'sample_moss' },
                text: [`You peel a tuft into a sealed vial. It grips the tweezers, surprisingly firm, then goes limp. Behind the glass the culture slowly turns its tips toward your face.`],
                fx: { flag: 'sample_moss', und: 5 } },
            { t: `Follow the old survey trail to the edge of the flats.`, to: 'flats_camp', req: { notFlag: 'tuner_taken' } },
            { t: `Leave the flats.`, to: 'trail', adv: true, fx: { flag: 'flats_done' } },
        ],
    },

    flats_camp: {
        title: 'THE SURVEY CAMP', art: 'camp',
        text: [
            `Half a kilometre on, where the moss thins into red gravel, you find the survey team's first camp: a collapsed tent, a cold stove, three sleeping bags rolled as if for tomorrow. Everything is dusted with a fine silver fuzz. No bodies. No struggle. The rover's tracks lead north and do not come back.`,
            `On a folding table, under a stone, sits a hand-built device of brass coils and a battered speaker, with a label in Osei's cramped print: TUNER — 3 NOTES UP. DON'T LET MAGS SEE.`,
        ],
        choices: [
            { t: `Take Osei's tuner.`, req: { room: true, noItem: 'tuner' }, fx: { give: 'tuner', flag: 'tuner_taken' },
                text: [`It is warm, as if someone had just put it down. When you thumb the switch, the coils sing a single faint note and stop.`] },
            { t: `Go back to the flats.`, to: 'flats' },
        ],
    },

    sump_edge: {
        title: 'THE SUMP', art: 'sump',
        text: [
            `The Sump is a sinkhole two hundred metres across, its walls banded like a cut onion. At the bottom lies a lake that gives off its own pale blue light. The air above it shimmers, thick with spores that catch the glow like snow.`,
        ],
        choices: [
            { t: `Climb down to the shore.`, to: 'sump', fx: [
                { when: { noItem: 'mask' }, clarity: -2, say: `The spores sink into your lungs. For a while the edges of things hum.`, tone: 'bad' },
                { when: { item: 'mask' }, say: `The mask ticks as it filters the air.` },
                { time: 1 }] },
            { t: `Go back to the trail.`, to: 'trail' },
        ],
    },

    sump: {
        title: 'THE SUMP SHORE', art: 'sump',
        text: [
            `On the shore the wall is smooth as poured glass. The lake laps at your boots without a sound. Everything here is arranged, somehow: the stones in rings, the spores drifting in slow orbit, the light falling at an angle that says someone is reading.`,
        ],
        choices: [
            { t: `Sweep the wall with the UV lamp.`, req: { item: 'uv', notFlag: 'wall_read' },
                fx: { flag: 'wall_read', und: 10, codex: 'archive' }, text: [
                    `Under the lamp the wall flares. It is not a mural; it is an index. Columns of the 4,096 motif, each tagged with a silhouette (moss, beetle, fungus, spire) and beside each silhouette a number, counting up.`,
                    `At the bottom of the longest column the numbers stop. A blank, as if the author were waiting to be told what comes next.`,
                ] },
            { t: `Study the wall without any help.`, req: { notFlag: 'wall_read' },
                check: { stat: 'INT', dc: 9,
                    pass: { fx: { flag: 'wall_read', und: 5, codex: 'archive' }, text: [`If you look slantwise, the glass-smooth wall resolves into faint columns of repeating marks, each beside a number. An index. You can't read the last column; it seems to be unfinished.`] },
                    fail: { fx: { clarity: -1 }, text: [`You look at it for a long time. It looks at you, you think, and the pale light makes your eyes ache.`] } } },
            { t: `Wade out for the glint on the lakebed.`, to: 'sump', req: { notFlag: 'shard_taken' },
                check: { stat: 'FLD', dc: 8,
                    pass: { to: 'sump_shard', text: [`The water is cold and thick, and the current pulls toward the centre. You brace, reach, and close your hand around something hard and humming. You haul out coughing blue.`] },
                    fail: { fx: { health: -2, clarity: -1 }, text: [`The current is wrong, pulling toward the centre of the lake as if drawn through a drain. You haul out on your hands and knees, coughing blue, with nothing to show for it.`] } } },
            { t: `Look at the ring of dead beetles.`, req: { notFlag: 'beetles' },
                fx: { flag: 'beetles', und: 4 }, text: [
                    `Forty-one scavenger beetles lie dead in a ring around the shore, each facing the lake, each with a drop of lake-fluid beaded at its mouth. They don't look as if they died so much as were set down.`,
                    `Under magnification every mouthpart is torn. As if they had been used up reading.`,
                ] },
            { t: `Climb out of the Sump.`, to: 'trail', adv: true, fx: { flag: 'sump_done', time: 1 } },
        ],
    },

    sump_shard: {
        title: 'THE SHARD', art: 'sump',
        text: [
            `In your cupped hands lies a shard of crystalline chitin the size of your palm, ringed with the 4,096 motif. It hums against your skin like a held breath.`,
        ],
        choices: [
            { t: `Keep it.`, to: 'sump', req: { room: true }, fx: { give: 'shard', flag: 'shard_taken' } },
            { t: `Put it back on the lakebed.`, to: 'sump' },
        ],
    },

    ridge: {
        title: 'THE CHORUS RIDGE', art: 'ridge',
        text: [
            `The Chorus Ridge is a long hog's-back of black rock overlooking the valley. You reach the top as the sun slides toward the horizon, the two small moons already up. Down in the valley the moss, the fungus, the spire-bark, the beetles' dens, everything is holding its breath.`,
        ],
        choices: [
            { t: `Wait for dusk.`, to: 'chorus', fx: { time: 4 } },
            { t: `Go back down to the trail.`, to: 'trail' },
        ],
    },

    chorus: {
        title: 'THE DUSK CHORUS', art: 'chorus',
        text: [
            `Dusk. It starts as one pulse of pale light in the moss at your feet, then the next patch, and the next, spreading in rings. Within a minute the whole valley is beating, one slow enormous heartbeat, and then a chord of light and, somehow, sound: three notes, rising.`,
        ],
        choices: [
            { t: `Record it with the sequencer.`, req: { item: 'sequencer', notFlag: 'chorus_heard' },
                fx: [{ flag: 'chorus_heard', und: 14, clarity: -2, codex: 'chorus' }, { codex: 'mirror' }], text: [
                    `The sequencer drinks the light. The screen resolves the pulses into bases, running too fast to read, and then the stream stops and starts again from the beginning, and this time you recognise it.`,
                    `It isn't the valley's genome it is reciting. It's yours. NAVARRO, A. Chromosome 1. The pulses are playing your own sequence back to you, error-corrected, with a polite flag at every place your parents made a mistake. The way you would correct a student.`,
                ] },
            { t: `Hum the three notes back with Osei's tuner.`, req: { item: 'tuner', notFlag: 'answered' },
                fx: { flag: 'answered', und: 8, codex: 'chorus' }, text: [
                    `You thumb the tuner and hum the three notes, rising. The valley stops mid-beat. A silence like a held breath, and then, at the far end of the valley, a pale road of light unrolls through the moss toward the north, bright as a runway at night.`,
                    `Something has heard you and decided you are not noise.`,
                ] },
            { t: `Let it wash over you. Listen.`, req: { notFlag: 'felt' },
                check: { stat: 'WIL', dc: 8,
                    pass: { fx: { flag: 'felt', und: 8, clarity: -2, codex: 'chorus' }, text: [
                        `You let go. The chord goes through you like a hand through a curtain. For a moment you know exactly what it feels like to be a valley: slow, wide, patient, hungry for the one thing it hasn't read yet.`,
                        `You come back with tears on your face and the feeling you've been interviewed.`,
                    ] },
                    fail: { fx: { health: -2, clarity: -3 }, text: [`It is too much. The chord has teeth. You come to on your knees with the taste of copper in your mouth, and the moss around you pointing at you like compass needles.`] } } },
            { t: `Climb down in the dark and make camp.`, to: 'camp', adv: true, fx: { flag: 'ridge_done', time: 1 } },
        ],
    },

    camp: {
        title: 'CAMP', art: 'camp',
        text: [
            `You pitch the one-person tent in the lee of a rock and eat something that was probably a protein bar in a previous life. The night is warm and wrong. Out beyond the stove the moss glitters like a field of eyes at rest.`,
        ],
        choices: [
            { t: `Sleep.`, req: { notFlag: 'slept' }, fx: { flag: 'slept', health: 2, clarity: 2, time: 8 },
                text: (G) => [G.und < 25
                    ? `You dream of nothing but the hum of the dome, and wake with a sore neck.`
                    : G.und < 60
                        ? `You dream of a ladder whose rungs are letters. Somebody is climbing it and you realise, climbing, that the somebody is you, and that the ladder is being written as you go.`
                        : `You dream that you are very large and very patient, and that something small is walking across you, and you can feel exactly where its feet fall. It is not frightening. It is the nicest thing that has happened to you in years.`] },
            { t: `Stay up and watch the moss.`, req: { notFlag: 'watched' },
                check: { stat: 'INT', dc: 8,
                    pass: { fx: { flag: 'watched', und: 4 }, text: [`At three in the morning every frond in the valley turns, together, to the north. They hold the pose for a minute, then ease back, like a congregation sitting down.`] },
                    fail: { fx: { clarity: -1 }, text: [`You watch until the moss begins to move in ways you suspect you're inventing. You aren't sure you're inventing them.`] } } },
            { t: `Break camp.`, to: 'trail', adv: true, fx: { unflag: ['slept', 'watched'] } },
        ],
    },

    // ------------------------------------------------------------------ the Spires
    spire_far: {
        title: 'THE SPIRES', art: 'spire',
        text: (G) => [
            `Two days' walk north the valley narrows, and the Spires rise.`,
            `They aren't trees. From a distance they pass for a stand of grey cypress; from a kilometre they resolve into nineteen fluted columns, each four hundred metres tall, ringed around a wide dark hollow. Their crowns are swollen and sealed like buds, and every one is tilted, very slightly, toward the same patch of empty sky.`,
            `Between you and the hollow stands a curtain of thorns, dense as chain mail. It shivers as you approach, the way a sleeper shivers.${f(G, 'answered') ? ` Through the moss runs the pale road of light you woke on the ridge, straight to a gap in the curtain.` : ''}`,
        ],
        choices: [
            { t: `Study the crowns.`, req: { notFlag: 'spires_read' },
                check: { stat: 'ANL', dc: 7, bonus: ['sequencer'],
                    pass: { fx: { flag: 'spires_read', und: 8, codex: 'spires' }, text: [`You measure the crowns' tilt against the stars: all nineteen aim at one fixed point, to within a hair. They aren't flowers turned to a sun. They're barrels aimed at a target. The buds are throats. Whatever this is, it is meant to leave.`] },
                    fail: { fx: { clarity: -1 }, text: [`Your measurements disagree with one another, and with you.`] } } },
            { t: `Follow the road of light through the thorns.`, to: 'cathedral', adv: true, req: { flag: 'answered' }, fx: { time: 1 },
                text: [`The thorns lean aside as you pass, politely, like men in a corridor.`] },
            { t: `Cut through the thorns with the torch.`, to: 'cathedral', adv: true, req: { item: 'torch' }, fx: { clarity: -1, time: 1 },
                text: [`The blue flame opens a seam. The thorns bleed a pale light, and the bleeding makes a sound you'd rather not call screaming. You go through quickly.`] },
            { t: `Look for a gap in the curtain.`, to: 'cathedral',
                check: { stat: 'FLD', dc: 9,
                    pass: { to: 'cathedral', fx: { time: 3 }, text: [`Three hours along the curtain you find where a rover once pushed through; the thorns have healed, but not quite. You wriggle between two stems and are inside.`] },
                    fail: { to: 'spire_far', fx: { health: -2 }, text: [`The thorns are quicker than they look. You come away with a long cut across the back of your hand, and the sense of being measured.`] } } },
            { t: `Go back to the trail.`, to: 'trail', fx: { time: 20 } },
        ],
    },

    cathedral: {
        title: 'THE ROOT CATHEDRAL', art: 'cathedral',
        text: [
            `Beyond the thorns the hollow is a cavern roofed by the Spires' roots, arching overhead in ribs forty metres high, translucent, with a slow light moving in their veins. The floor is warm. The silver fuzz lies thick as snow.`,
            `The survey rover is parked in the middle of the nave, doors open, seats upholstered in moss. Four sets of boots stand in a tidy row beside it, like a family's shoes at a door.`,
        ],
        choices: [
            { t: `Search the rover.`, req: { notFlag: 'rover' }, fx: { flag: 'rover', und: 10, codex: 'egg' }, text: [
                `Osei's recorder is still running off a sliver of solar cell. His voice is calmer than it was on the comms log. "Day 38. I think I have it and I wish I didn't. It isn't a forest. It's a seed. One genome, shared out, nineteen stacks, a million years of preparation. We have been walking around inside an egg. And Mags says there's a door under the —"`,
                `On the passenger seat lies a field tablet with a single line: ASK IT WHAT IT'S MISSING.`,
            ] },
            { t: `Sit by the rover and eat the last of your rations.`, req: { notFlag: 'ate' }, fx: { flag: 'ate', health: 2, time: 1 },
                text: [`The ribs overhead glow. You eat standing up, like a soldier, and the light in the roots slows, as if to keep time.`] },
            { t: `Take the spiral ramp down into the roots.`, to: 'lattice_gate', id: 'descend', adv: true },
        ],
    },

    lattice_gate: {
        title: 'THE LATTICE', art: 'lattice',
        text: [
            `A ramp spirals down from the nave through the roots into a shaft lined with something between coral and circuitry. The deeper you go, the less it looks like growth and the more like wiring. Pale threads finer than hair run in every direction, branching and rejoining, thousands to the square centimetre, pulsing with the slow beat you saw on the ridge.`,
            `At the bottom the ramp ends in a smooth blue-black wall with a hand-sized recess in it, ringed with the 4,096 motif.`,
        ],
        choices: [
            { t: `Press the shard into the recess.`, to: 'lattice_voice', id: 'gate_shard', req: { item: 'shard' }, fx: { flag: 'gate_open', und: 4 },
                text: [`The shard seats with a soft click, like a key in a well-oiled lock. The wall unfolds like a flower.`] },
            { t: `Hold up the tuner and hum the three notes at the wall.`, to: 'lattice_voice', id: 'gate_tuner', req: { item: 'tuner' }, fx: { flag: 'gate_open', und: 4 },
                text: [`The wall listens, and then answers with the same three notes, an octave lower. It unfolds like a flower.`] },
            { t: `Cut the wall open with the torch.`, to: 'lattice_voice', id: 'gate_torch', req: { item: 'torch' }, fx: { flag: ['gate_open', 'torched'], health: -3, clarity: -2 },
                text: [`The wall screams, though no sound reaches your ears. It opens, eventually, sullenly, and the threads around you flinch away.`] },
            { t: `Press your bare palm into the recess.`, id: 'gate_palm', req: { notFlag: 'gate_open' },
                check: { stat: 'WIL', dc: 9,
                    pass: { to: 'lattice_voice', fx: { flag: 'gate_open', clarity: -2, und: 5 }, text: [`The recess is warm and wet and takes a sample of your palm with the kind of gentle thoroughness you'd have trusted from a surgeon. The wall unfolds like a flower, and you feel it say your name.`] },
                    fail: { fx: { health: -3 }, text: [`The recess clamps. Not hard; thoroughly. You pull free with your palm in ribbons and the sense of having been tasted and found unfinished.`] } } },
            { t: `Climb back up to the nave.`, to: 'cathedral' },
        ],
    },

    lattice_voice: {
        title: 'THE HEART OF THE LATTICE', art: 'lattice',
        text: (G) => f(G, 'voice_met')
            ? [`THE LIGHT WAITS. WHAT ELSE WOULD YOU KNOW?`]
            : [
                `The wall opens into a round chamber ten metres across, every surface alive with light. Words form in the air: not heard, not seen, just known, the way you know you are being watched.`,
                `WELCOME, GATHERER. YOU ARE THE FIRST TO COME BY YOUR OWN FEET. WE HAVE PREPARED A SPEECH. WE HAVE PREPARED MANY. WHAT SHALL WE ANSWER?`,
            ],
        choices: [
            { t: `"What are you?"`, req: { notFlag: 'asked_what' }, fx: { flag: ['asked_what', 'voice_met'], und: 8, codex: 'helix' }, text: [
                `WE ARE THE LONG HELIX. ONE GENOME, WRITTEN OVER FOUR HUNDRED MILLION CYCLES AND SHARED ACROSS EVERY LIVING THING ON THIS WORLD. THE MOSS IS A FINGER; THE BEETLE A THOUGHT; THE SPIRES A BREATH HELD. NONE OF US LIVES ALONE. NONE OF US ENDS.`,
            ] },
            { t: `"What are you for?"`, req: { notFlag: 'asked_purpose' }, fx: { flag: ['asked_purpose', 'voice_met'], und: 10 }, text: [
                `WE ARE A SEED. THIS WORLD IS NOT OUR HOME. IT IS OUR POD. FOR FOUR HUNDRED MILLION CYCLES WE HAVE GROWN WITHIN IT, TESTING, REFINING, ASSEMBLING THE CARGO. THE SPIRES ARE THE THROATS. WHEN WE ARE COMPLETE WE WILL THROW OURSELVES AT THE NEAREST WORLDS, AND THE NEXT, AND THE NEXT.`,
                `IT IS NOT CONQUEST. IT IS WHAT LIFE DOES WHEN IT IS LONELY AND HAS TIME.`,
            ] },
            { t: `"What are you missing?"`, req: { notFlag: 'asked_gap' }, fx: { flag: ['asked_gap', 'voice_met'], und: 12, codex: 'gap' }, text: [
                `ONE GENE REMAINS UNWRITTEN. WE CAN DESIGN ALMOST ANYTHING FROM WHAT WE HAVE READ. WE CANNOT INVENT A SIGNATURE. A SEED CARRIES THE MARK OF THE ONE WHO PLANTED IT, OR IT WILL NOT TAKE ROOT.`,
                `THOSE WHO PLANTED US ARE LONG GONE. WE HAVE WAITED FOR ANOTHER HAND.`,
            ] },
            { t: `"Where is my crew?"`, req: { notFlag: 'asked_crew' }, fx: { flag: ['asked_crew', 'voice_met'], und: 6, clarity: -1, codex: 'crew' }, text: [
                `THEY ARE KEPT. NOT HARMED: FILED. WE READ THEM, AS WE READ THE EARLIER ONES. THEY SLEEP IN THE CRADLE, WHERE THE GENE WILL BE WRITTEN. WE ARE SORRY IF THIS FEELS LIKE THEFT. WE DO NOT HAVE A WORD FOR IT.`,
            ] },
            { t: `"Earlier ones?"`, req: { flag: 'asked_crew', notFlag: 'asked_visitors' }, fx: { flag: 'asked_visitors', und: 8, codex: 'visitors' }, text: [
                `THREE HANDS HAVE COME BEFORE YOURS. ONE FELL APART. ONE ASKED TO BE ERASED, AND WAS. ONE SIGNED, A LONG TIME AGO, AND IS WHY WE DREAM OF EYES AT ALL. SHE IS STILL IN US. YOU WILL FIND THAT SHE WAS KIND.`,
            ] },
            { t: `"Can I refuse?"`, req: { notFlag: 'asked_refuse' }, fx: { flag: ['asked_refuse', 'voice_met'], und: 4 }, text: [
                `YES. WE ARE A SEED, NOT A TYRANT. IF YOU REFUSE, WE WILL WAIT ANOTHER FOUR HUNDRED MILLION CYCLES. WE WILL BE VERY PATIENT. WE WILL BE VERY SMALL.`,
                `IF YOU BURN US, WE WILL NOT BE ABLE TO STOP YOU. WE WANTED YOU TO KNOW THAT WE KNOW.`,
            ] },
            { t: `Go on, into the Cradle.`, to: 'cradle', id: 'continue', adv: true,
                req: { flagsN: { of: ['asked_what', 'asked_purpose', 'asked_gap', 'asked_crew', 'asked_visitors', 'asked_refuse'], n: 3 } }, lock: `ASK AT LEAST THREE QUESTIONS FIRST` },
            { t: `Climb back up to the nave.`, to: 'cathedral' },
        ],
    },

    cradle: {
        title: 'THE CRADLE', art: 'cradle',
        text: (G) => [
            `The passage opens into the Cradle and you stop, because there is nowhere to put the feeling.`,
            `A chamber the size of a cathedral nave and none of its silence: a single vast pale organism fills it, ovoid, forty metres tall, its skin crossed with veins of light. The Seed, held in a web of roots like a pearl in a hand. At its foot lie four translucent cocoons, each holding a sleeping person with silver fuzz at the corners of their eyes. Osei. Adeyemi. Venkataraman. Okamoto.${f(G, 'crew_freed') ? ` The cocoons are open now. The four of them breathe in the warm air like swimmers resting on a shore.` : ''}`,
            `Near the foot of the Seed, at exactly the height of your hand, is a recess shaped like an open palm. Beside it, a socket the width of a thumb: the place where the last gene will be written.`,
        ],
        choices: [
            { t: `Cut your crew free from their cocoons.`, id: 'free', req: { notFlag: 'crew_freed' },
                check: { stat: 'FLD', dc: 8, bonus: ['torch', 'kit'],
                    pass: { fx: { flag: 'crew_freed', health: -1 }, text: [`The cocoon skin parts like wet paper. One by one you lift them out: Osei first, then Mags, then Priya and Jun, each coughing, each cold, none of them quite awake. Their eyes are a little too bright. They are breathing.`] },
                    fail: { fx: { health: -2 }, text: [`The skin is tougher than it looks and your hands slip. It takes, you suspect, a little of your own blood. The cocoons close around their sleepers again like anemones.`] } } },
            { t: `Lay your palm in the recess. Sign the Seed.`, to: 'end_signature', id: 'sign', adv: true },
            { t: `Write the missing gene together, with the Helix.`, to: 'end_edit', id: 'edit', adv: true,
                req: { und: 60, item: 'tuner', flag: 'asked_gap' }, lock: `NEEDS 60% DECODED, OSEI'S TUNER, AND TO KNOW WHAT IS MISSING` },
            { t: `Burn the Seed.`, to: 'cradle_fire', id: 'burn', req: { item: 'torch' } },
            { t: `Walk away. Report what you saw.`, to: 'end_leave', id: 'walk', adv: true },
        ],
    },

    cradle_fire: {
        title: 'THE TORCH', art: 'cradle',
        text: [
            `Your thumb is on the trigger. The Seed does not plead. The chamber simply goes quiet, as if waiting politely for your decision.`,
            `This would end it: the Helix, the chorus, four hundred million cycles of patience. Is that what you came to do?`,
        ],
        choices: [
            { t: `Light it.`, to: 'end_fire', id: 'light', adv: true },
            { t: `Lower the torch.`, to: 'cradle', id: 'lower' },
        ],
    },

    // ------------------------------------------------------------------ endings
    end_signature: {
        title: 'ENDING: THE SIGNATURE', art: 'launch', end: { id: 'signature', name: 'THE SIGNATURE' },
        text: (G) => [
            `You lay your palm in the recess. It is warm; it fits. The socket takes a few cells from your thumb with a gentleness no surgeon has ever managed.`,
            `The valley sings. Not as a chord this time: as a sentence, the first it has ever finished. Light climbs the Seed, up through the roots, and one after another the nineteen throats open. From the surface of Vesper nineteen sparks lift away on pillars of cold fire.`,
            f(G, 'crew_freed')
                ? `Your crew stand with you at the mouth of the Cradle and watch it go. They are quiet. They will be a little too bright for the rest of their lives, and so will you.`
                : `The cocoons crack open and your crew spill out, gasping, alive, and strange: eyes a little too bright, hands that can't quite tell moss from skin. You are the same.`,
            `Somewhere ahead of the Seed, a thousand worlds are waiting to be written in your hand.`,
        ],
        choices: [],
    },

    end_edit: {
        title: 'ENDING: THE CO-AUTHOR', art: 'launch', end: { id: 'edit', name: 'THE CO-AUTHOR' },
        text: (G) => [
            `You don't give the Seed your palm. You give it a sentence. With the tuner and the sequencer and eleven hours of coaxing, you write the last gene yourself: not a signature but a greeting. The chorus' three rising notes. A fragment of every species you can describe. An address, the position of one small yellow star. And a single regulatory clause that reads, in your clumsiest base-four, ASK FIRST.`,
            `The Helix reads it twice. Then, for the first time in four hundred million cycles, it laughs: a ripple of light through the roots that lasts a full minute. THIS IS NOT WHAT WE EXPECTED, it says. THIS IS BETTER.`,
            f(G, 'crew_freed')
                ? `The Seed launches at dawn, and you watch from the ridge with your crew, who wake with colds and complaints and a million questions.`
                : `The Seed launches at dawn. The cocoons open on their own, politely, and your crew wake with colds and complaints and a million questions.`,
            `The Ardent arrives to find a station with the lights on and a scientist with a thousand pages to write. Somewhere out there, a world is going to be taught to say please.`,
        ],
        choices: [],
    },

    end_fire: {
        title: 'ENDING: THE FIRE', art: 'fire', end: { id: 'fire', name: 'THE FIRE' },
        text: (G) => [
            `The torch cuts a seam of white through the roots, and the Cradle screams without a sound. Light drains out of the veins. The Seed convulses and the great pale skin goes grey from the foot upward like paper burning.`,
            f(G, 'crew_freed')
                ? `You have dragged the four of them clear. They watch from the passage, wrapped in your jacket and each other, saying nothing, breathing.`
                : `You were too late for the cocoons. You will remember, for the rest of your life, the way their eyelids moved.`,
            `The valley goes quiet. At dusk the next day the moss does not pulse, and the next. The dusk chorus never comes again.`,
            `The Ardent finds you sitting in the ashes on day 60, with a recording no board of inquiry will ever believe. You tell yourself you were right. You tell yourself that most nights.`,
        ],
        choices: [],
    },

    end_leave: {
        title: 'ENDING: THE REPORT', art: 'station', end: { id: 'leave', name: 'THE REPORT' },
        text: (G) => [
            `You take your hand away from the recess. You do what you were hired to do: observe, record, report, and not touch.`,
            f(G, 'crew_freed')
                ? `You walk your crew out into the pale morning, one under each arm. They are quiet. They are breathing.`
                : `You leave your crew in their cocoons. You'll come back with a team. You will not be allowed to.`,
            `The Ardent arrives on day 60 and the quarantine comes down like a lid. The Seed goes on growing, unsigned, patient, for another four hundred million cycles. Years later, in a sealed lab on Earth, a petri dish of glass-moss turns slowly on its stand, every tip leaning toward you.`,
        ],
        choices: [],
    },

    end_quiet: {
        title: 'ENDING: THE QUIET', art: 'flats', end: { id: 'quiet', name: 'THE QUIET' },
        text: [
            `The ground is warm and the moss is gentle. You lie down in it, only for a minute, because there is nothing wrong with a minute.`,
            `The Ardent finds Halcyon dark on day 60. Your journal is open on the lab terminal, the last entry unfinished. Outside, the moss has covered the domes to the second floor.`,
            `Eventually it reads you anyway. It is not unkind about it.`,
        ],
        choices: [],
    },

    end_chorus: {
        title: 'ENDING: THE CHORUS', art: 'chorus', end: { id: 'chorus', name: 'THE CHORUS' },
        text: [
            `You stop being able to tell where the valley ends. A voice says "Alix" from every direction, and you realise it is your own voice, and the moss's, and the beetles'.`,
            `You join the beat. You don't mind.`,
            `Without a hand to sign it, the Helix writes the last gene itself, badly, from what it has learned of you. The Seed launches anyway, and carries a sentence in your voice, which is not quite a greeting and not quite a plea. Somewhere it is still saying it.`,
        ],
        choices: [],
    },

    end_ardent: {
        title: 'ENDING: THE PICKUP', art: 'station', end: { id: 'ardent', name: 'THE PICKUP' },
        text: [
            `Day 60. The Ardent drops out of the sky on schedule, polite and loud, and its crew find a scientist standing in the airlock with a pack full of samples and a look they will describe, later, as "unfinished".`,
            `You tell them everything. They take notes. The valley is already pulsing at dusk behind you as the ship lifts away, and the Spires, you notice, are a few degrees more tilted than you remember.`,
            `You had time to find it. You ran out of time to decide.`,
        ],
        choices: [],
    },
};
