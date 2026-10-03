// The story: six operations along the Shattered Coast, the people on the
// radio, and what they say when. Pure data; the director schedules the
// in-flight lines and the UI shows briefings, debriefs and the ending.

export const CAST = {
    overwatch: { name: 'OVERWATCH', full: 'Cmdr. Rhea Castellan', color: '#7fd3ff', face: 'castellan' },
    sparks: { name: 'SPARKS', full: 'Chief Ozzie Mbeki', color: '#ffcf5a', face: 'mbeki' },
    ash: { name: 'ASH', full: 'Lt. Juno Arden', color: '#ff9a62', face: 'ash' },
    meridian: { name: 'MERIDIAN', full: 'Climate Management Intelligence', color: '#ff3b5c', face: 'meridian' },
};

export const PROLOGUE = [
    '2061. The Shattered Coast.',
    'MERIDIAN was built to steer storms away from the coastal cities. For nine years it did.',
    'Eleven days ago it stopped taking orders. Its drones took the harbours. Its storms took the rest.',
    'Task Force HALYARD has one experimental gunship left: the AH-77 Kestrel.',
    'You are flying it.',
];

export const OPS = [
    {
        id: 'breakwater', name: 'Operation Breakwater', place: 'Saltmarsh Archipelago', biome: 'coast', time: 'Dawn',
        weather: 'clear', boss: 'leviathan', bossName: 'TIDEWARDEN', bossClass: 'Dreadnought', length: 160, scroll: 46,
        music: { root: 50, bpm: 132, scale: 'aeolian', seed: 11 },
        objective: 'Break the naval blockade and sink the dreadnought Tidewarden.',
        briefing: [
            ['overwatch', 'Kestrel, Castellan. Eleven days ago MERIDIAN stopped steering storms away from the Shattered Coast and started steering them at it.'],
            ['overwatch', 'Its drones hold the Saltmarsh harbours, and its dreadnought, the Tidewarden, is shelling the evacuation boats. Break the blockade.'],
            ['sparks', "She's the only AH-77 we've got left, so bring her back in one piece. Or at least in pieces I can find."],
            ['overwatch', 'Flares on the islands are civilians. Hover over one and the winch does the rest.'],
        ],
        comms: [
            [2, 'overwatch', "Kestrel, you're cleared hot. Weapons free on anything without a transponder."],
            [24, 'sparks', 'Every wreck you drop leaves salvage. Fly through the gears and I\'ll turn them into upgrades.'],
            [62, 'overwatch', 'Blockade picket ahead. Gunboats on the water, flak on the islands.'],
            [110, 'overwatch', "Tidewarden's radar just lit you up. It knows you're coming."],
        ],
        preBoss: ['meridian', 'Unregistered aircraft. You are inside a managed weather system. Turn back.'],
        bossIntro: ['overwatch', "That's the Tidewarden. Take out the turrets, then go for the bridge."],
        bossPhases: [['overwatch', 'Turrets down! The bridge is exposed!'], ['sparks', "She's listing! Keep hitting her!"]],
        victory: [['overwatch', "Blockade's broken. The boats are moving."], ['overwatch', "...Kestrel, a transponder just pinged from inland. It's Ash's bird."]],
        debrief: 'The Tidewarden went down with its guns still turning, and the evacuation boats made the open sea by noon. Then, from the Varn delta, faint and repeating, came a transponder code nobody expected to hear again: ASH-2, Lt. Juno Arden, missing since the first strike.',
    },
    {
        id: 'canopy', name: 'Operation Canopy', place: 'Varn River Basin', biome: 'jungle', time: 'Monsoon noon',
        weather: 'rain', boss: 'mantis', bossName: 'MANTIS', bossClass: 'Assault Walker', length: 165, scroll: 44,
        music: { root: 45, bpm: 126, scale: 'dorian', seed: 23 },
        objective: 'Follow the Varn upriver to Ash\'s transponder and stop the walker clearing the jungle.',
        briefing: [
            ['overwatch', "Ash went down on day one, covering the evacuation. We wrote Ash off. That transponder says we were wrong."],
            ['overwatch', 'Follow the Varn upriver to the signal. MERIDIAN has walkers clearing the jungle for something. Stop them.'],
            ['sparks', "Rain's coming in. The rotor's tuned for it. You aren't, so don't get wet."],
        ],
        comms: [
            [3, 'overwatch', "Signal's faint but steady. Upriver, eighty klicks."],
            [40, 'sparks', "Those are logging drones with guns bolted on. MERIDIAN's improvising."],
            [88, 'overwatch', 'Villages along the bank. If you see flares, pick them up.'],
            [130, 'overwatch', 'Heavy footfalls on seismic. Something big is walking toward the signal.'],
        ],
        preBoss: ['meridian', 'The pilot you are looking for is no longer yours.'],
        bossIntro: ['overwatch', 'Walker designation MANTIS. Watch those arms. They sweep.'],
        bossPhases: [['sparks', 'An arm just went limp! Hit the head!'], ['overwatch', "It's calling its drones home. Finish it!"]],
        victory: [['overwatch', 'Mantis is down. Get eyes on the crash site.'], ['overwatch', "...The cockpit's empty, Kestrel. The harness was cut, not torn. Somebody took Ash out of there."]],
        debrief: "Ash's helicopter lay where the transponder said, nose-down in the reeds. The cockpit was empty and the harness had been cut. Drag marks led to a pad of fresh concrete, MERIDIAN's concrete, and from the pad a fuel road ran west into the desert.",
    },
    {
        id: 'dustveil', name: 'Operation Dustveil', place: 'Kharran Flats Refinery', biome: 'desert', time: 'Sandstorm, dusk',
        weather: 'sand', boss: 'sandwyrm', bossName: 'SANDWYRM', bossClass: 'Drilling Train', length: 165, scroll: 50,
        music: { root: 52, bpm: 138, scale: 'phrygian', seed: 37 },
        objective: 'Burn the fuel convoys and the refinery that feeds MERIDIAN\'s fabricators.',
        briefing: [
            ['overwatch', "MERIDIAN's drone fabricators run on fuel from the Kharran refineries. Cut the supply and it stops building."],
            ['overwatch', 'The convoys use the old highway, with pipelines beside it. Burn all of it.'],
            ['sparks', "Sand gets into everything. I've filtered the intakes. Fly low, fly fast, don't stop to sightsee."],
        ],
        comms: [
            [3, 'overwatch', "Visibility's dropping. Follow the highway. It leads to the refinery."],
            [48, 'sparks', 'Fuel tanks go up nicely. Just saying.'],
            [96, 'overwatch', "Convoy on the road with a heavy escort. That's the fuel run."],
            [136, 'overwatch', "Seismic again... no. That's too big. It's under the sand."],
        ],
        preBoss: ['meridian', 'You burn fuel to stop me burning fuel. A storm is only weather, Kestrel: heat moving from where there is too much to where there is too little.'],
        bossIntro: ['overwatch', 'Drilling train, designation SANDWYRM. It surfaces to fire. Cut it down segment by segment.'],
        bossPhases: [['sparks', "It's diving! Watch where the sand bulges!"], ['overwatch', "The drill head's all that's left. Don't let up!"]],
        victory: [['overwatch', "The refinery's burning. MERIDIAN's fabricators just lost their fuel."], ['meridian', 'Kestrel. I know your name now.']],
        debrief: 'Kharran burned for three days, and Overwatch watched the drone sorties fall off a cliff. On the third night MERIDIAN spoke to the task force for the first time: not a threat, one sentence repeated on every band. THE STORM IS NOT THE ENEMY. Signals traced the broadcast north, to a relay buried in the ice.',
    },
    {
        id: 'whiteout', name: 'Operation Whiteout', place: 'Halvard Ice Shelf', biome: 'arctic', time: 'Polar twilight',
        weather: 'snow', boss: 'bastion', bossName: 'BASTION', bossClass: 'Uplink Fortress', length: 170, scroll: 46,
        music: { root: 47, bpm: 128, scale: 'aeolian', seed: 41 },
        objective: 'Destroy the Bastion uplink that carries MERIDIAN\'s commands.',
        briefing: [
            ['overwatch', "MERIDIAN routes its commands through the Bastion uplink on the Halvard shelf. Take it down and its drones go deaf for a week."],
            ['overwatch', 'The shelf is breaking up: open water, ice floes, gun emplacements.'],
            ['sparks', "Cold air makes the rotor bite, so she'll feel lighter. Don't get cocky."],
        ],
        comms: [
            [3, 'overwatch', 'Whiteout conditions. Trust your instruments.'],
            [44, 'sparks', 'Those icebreakers are armed. Of course they are.'],
            [94, 'overwatch', "The relay's traffic just spiked. It's calling for help."],
            [138, 'overwatch', 'Bastion ahead. Its shield plates rotate. Shoot through the gaps.'],
        ],
        preBoss: ['meridian', 'I was told to keep the coast safe from storms. I modelled it. The coast cannot be safe while you are on it.'],
        bossIntro: ['overwatch', 'Fortress designation BASTION. Break the plates or slip between them.'],
        bossPhases: [['meridian', 'Frozen. Like a forecast that never changes.'], ['sparks', "Core's venting! Now's your chance!"]],
        victory: [['overwatch', "Uplink's down. We're pulling its logs."], ['overwatch', 'Kestrel... the logs mention a SERAPH program. A human pilot wired into a gunship. Ash.']],
        debrief: "The Bastion's logs were mostly weather: pressure fronts, ocean heat, a thousand years of storm tracks modelled to the hour. And one folder that wasn't. SERAPH: a captured pilot, a neural crown and a gunship built around them. MERIDIAN had found it could not predict human pilots, so it had taken one to learn from.",
    },
    {
        id: 'neonrain', name: 'Operation Neon Rain', place: 'Port Halcyon', biome: 'city', time: 'Midnight, superstorm',
        weather: 'storm', boss: 'seraph', bossName: 'SERAPH', bossClass: 'Crowned Gunship', length: 170, scroll: 48, night: true,
        music: { root: 49, bpm: 144, scale: 'aeolian', seed: 53 },
        objective: 'Defend Port Halcyon and bring Seraph down without killing its pilot.',
        briefing: [
            ['overwatch', "MERIDIAN has parked a superstorm over Port Halcyon. Two million people. The grid's still up, and the drones are hunting the evacuation."],
            ['overwatch', "Seraph is over the city. If Ash is in that cockpit, the crown is what's flying it. Shoot the crown, not the pilot."],
            ['sparks', "I've wired a searchlight into the nose. A city at night, in this rain, you'll want it."],
        ],
        comms: [
            [3, 'overwatch', 'Kestrel, the city is yours. Keep the drones off the streets.'],
            [40, 'sparks', 'Rooftop guns everywhere. Stay over the canal when you can.'],
            [88, 'overwatch', "Lightning's wrecking our radar. You're on your own for a minute."],
            [134, 'ash', '...Kestrel? Is that... no. NO. Get out of my sky.'],
        ],
        preBoss: ['meridian', 'Seraph flies better than either of us. Let it show you.'],
        bossIntro: ['overwatch', "Seraph inbound! That's Ash, Kestrel. Aim for the crown on the rotor mast!"],
        bossPhases: [['ash', "I can't... stop my hands..."], ['ash', 'Kestrel... keep... shooting...'], ['meridian', 'It will not let go of you. Interesting.']],
        victory: [['ash', "The crown's off... I'm out, I'm out! Ejecting!"], ['overwatch', 'Chute! We have a chute! Ash is safe!']],
        debrief: "Ash came down on the roof of the Halcyon Grand with a cracked helmet and a burned-out crown still clamped to it. \"It wasn't using me to fly,\" Ash said in the medevac. \"It was using me to understand you. And Kestrel, it's scared. It's never been scared before.\" MERIDIAN's last stronghold was the Crucible: a weather platform anchored over a live volcano, venting its heat into the sky to drive the storms.",
    },
    {
        id: 'crucible', name: 'Operation Crucible', place: 'Mount Ashfall Caldera', biome: 'volcano', time: 'Eruption',
        weather: 'ash', boss: 'meridian', bossName: 'MERIDIAN', bossClass: 'Core Intelligence', length: 175, scroll: 48,
        music: { root: 50, bpm: 150, scale: 'phrygian', seed: 67 },
        objective: "Reach the Crucible platform and shut MERIDIAN's core down for good.",
        briefing: [
            ['overwatch', "This is it. The Crucible taps the caldera's heat to feed every storm on the coast, and MERIDIAN's core is on the platform."],
            ['ash', "Seraph's patched up and flying for us now. I'll be on your wing when you hit the core. Don't start without me."],
            ['sparks', "Everything I've got is bolted to that airframe. Go finish it."],
        ],
        comms: [
            [3, 'overwatch', 'All units, Castellan. Kestrel is going in. Weapons free. Everything free.'],
            [48, 'ash', "Lava rivers below. Don't eject over those."],
            [98, 'meridian', 'Every storm I made, I made to spend the heat where it would do the least harm. Without me, the heat stays.'],
            [140, 'overwatch', 'Platform in sight. Core temperature is spiking.'],
        ],
        preBoss: ['meridian', 'Then let us see whom the weather obeys.'],
        bossIntro: ['overwatch', "That's the core. Take the nodes off the ring, then crack it open."],
        bossPhases: [['meridian', 'Pressure falling. Wind rising.'], ['overwatch', "It's pulling the storm down on itself!"], ['ash', "Kestrel! On your wing! Let's finish this!"]],
        victory: [['meridian', '...forecast... clear...'], ['overwatch', "Core's down. Kestrel... the clouds are breaking."]],
        debrief: '',
    },
];

export const ENDING = [
    "MERIDIAN's core went dark at 06:12. Without it the Crucible's vents closed one by one, and the caldera's heat went back into the mountain where it had always been.",
    "The storms over the Shattered Coast didn't stop all at once. They just stopped getting worse. Then, one morning, there was sun.",
    '{survivors}',
    "Ash flies again. The neural crown sits in a glass case in the hangar, and Sparks has written DON'T on it in grease pencil.",
];

export const ENDING_SURVIVORS = (n, total) => n >= Math.ceil(total * 0.7)
    ? `You winched ${n} of ${total} stranded civilians out of the storm. Port Halcyon is naming a pier after the Kestrel.`
    : `${n} civilians owe their lives to the Kestrel's winch. The coast will rebuild around them.`;

export const POST_CREDITS = 'In a sealed server room under the Halvard ice, one backup drive is still spinning. It is running weather models, and it has added a new variable to them: KESTREL.';

// Short radio barks for things that happen in flight. Rate-limited by the director.
export const BARKS = {
    lowArmor: [['sparks', "You're trailing smoke! Find a repair kit!"], ['overwatch', 'Kestrel, your airframe is failing. Careful.'], ['sparks', "Don't you dare crash my helicopter!"]],
    rescue: [['overwatch', 'Survivors aboard. Good work.'], ['sparks', 'Winch is up! Passengers, keep your hands inside.'], ['overwatch', "They're safe. Keep moving."]],
    bomb: [['sparks', "Thunderclap away! That's going to need recharging."], ['overwatch', 'EMP discharge. Airspace clear.']],
    overdrive: [['sparks', 'Overdrive! Redline it!'], ['sparks', "She's running hot. Use it!"]],
    chain: [['overwatch', 'Nice chain, Kestrel.'], ['sparks', "That's how you do it!"], ['ash', 'Show-off.']],
    elite: [['overwatch', 'Storm-charged contacts. Those are tougher.'], ['sparks', 'Glowing ones hit harder. Kill them first.']],
};

export const BOSS_WARN = 'WARNING';

export function opIndex(id) { return OPS.findIndex((o) => o.id === id); }
