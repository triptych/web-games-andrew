// The story: acts, patients, scans and every line of dialogue. Pure data plus a few pure builders.
//
// Speakers: 'clasp', 'ossa', 'pip', 'you', 'grimwald', 'narrator', or a patient's id (the UI looks
// up the name and species). Lines are short; the UI types them out.

import { KINDS } from './ailments.js';
import { SPECIES, OVERLORD_MASKS } from './species.js';

// ------------------------------------------------------------------ acts

export const ACTS = [
    {
        title: 'Act I · Thorns', short: 'Thorns', senses: ['kind'], quest: 'bramble',
        story: ['nib', 'gloop'],
        walk: { species: ['goblin', 'slime', 'myconid', 'imp'], kinds: ['thorn', 'gash', 'spider', 'wyrmbile', 'nightshade', 'bruise', 'rotspore'], pool: 4, sevs: ['M'], focus: [10, 12], scars: 0, bound: 0 },
        reward: { sense: 'hue', evidence: 'arrow', relic: 'quill' },
    },
    {
        title: 'Act II · Hexes', short: 'Hexes', senses: ['kind', 'hue'], quest: 'crypt',
        story: ['rattle', 'wisp'],
        walk: { species: ['skeleton', 'ghost', 'goblin', 'slime', 'imp'], kinds: ['sigil', 'nightmare', 'chain', 'bruise', 'gash', 'nightshade', 'wither', 'thorn'], pool: 5, sevs: ['M'], focus: [14, 17], scars: 0, bound: 0, hues: 2 },
        reward: { sense: 'sev', evidence: 'scroll', relic: 'lens' },
    },
    {
        title: 'Act III · Embers', short: 'Embers', senses: ['kind', 'hue', 'sev'], quest: 'forge',
        story: ['tik', 'bogdan'],
        walk: { species: ['kobold', 'troll', 'imp', 'myconid', 'skeleton'], kinds: ['scorch', 'fracture', 'acid', 'gash', 'holyfire', 'bruise', 'wither', 'spider'], pool: 6, sevs: ['S', 'M', 'L'], focus: [15, 18], scars: 3, bound: 0, hues: 2 },
        reward: { sense: 'school', evidence: 'lance', relic: 'glove' },
    },
    {
        title: 'Act IV · The Fever', short: 'The Fever', senses: ['kind', 'hue', 'sev', 'school'], quest: 'citadel',
        story: ['crag', 'murmur'],
        walk: { species: ['gargoyle', 'golem', 'ghost', 'goblin', 'troll', 'kobold'], kinds: ['nightmare', 'chain', 'sigil', 'scorch', 'holyfire', 'frostbite', 'fracture', 'wither', 'acid', 'gash'], pool: 8, sevs: ['S', 'M', 'L'], focus: [16, 19], scars: 2, bound: 3, hues: 3 },
        reward: { sense: null, evidence: 'ledger', relic: null },
    },
    {
        title: 'Epilogue · The Lanterns Relit', short: 'Epilogue', senses: ['kind', 'hue', 'sev', 'school'], quest: null,
        story: [],
        walk: { species: ['goblin', 'slime', 'myconid', 'imp', 'skeleton', 'ghost', 'kobold', 'troll', 'gargoyle', 'golem'], kinds: Object.keys(KINDS), pool: 9, sevs: ['S', 'M', 'L'], focus: [16, 20], scars: 2, bound: 2, hues: 3 },
        reward: null,
    },
];

const M = (species) => SPECIES[species].mask;

// ------------------------------------------------------------------ story patients (clinic)

export const STORY_PATIENTS = {
    nib: {
        act: 0, species: 'goblin', name: 'Nib', ailment: 'Thorns in the foot',
        scan: { kinds: ['thorn', 'gash', 'bruise'], focus: 12, goals: [{ t: 'kind', v: 'thorn', n: 26 }] },
        intro: [
            ['nib', 'Ow. Ow ow ow. Is this the clinic? The lantern sign said clinic. Please say it\'s the clinic.'],
            ['you', 'It\'s the clinic. Let\'s see that foot.'],
            ['nib', 'There was a hedge on the forest road. A hedge made of WIRE. With THORNS. Who builds a hedge out of wire?'],
            ['nib', 'It had a little gold sign on it. "Property of the Gilded Company." I can\'t read, but the sign looked smug.'],
            ['ossa', 'Up on the table, Nib. The Healer will have a look inside you with the Lens.'],
        ],
        thanks: [
            ['nib', 'It doesn\'t hurt! I can wiggle! Look at me wiggle!'],
            ['nib', 'I\'m telling everyone at the night market. Best healer under the hills!'],
        ],
    },
    gloop: {
        act: 0, species: 'slime', name: 'Gloop', ailment: 'Swallowed something sour',
        scan: { kinds: ['wyrmbile', 'acid', 'nightshade', 'thorn'], focus: 14, goals: [{ t: 'kind', v: 'wyrmbile', n: 28 }, { t: 'kind', v: 'nightshade', n: 19 }] },
        intro: [
            ['gloop', 'Blorp. Hello. Gloop. I ate a sandwich.'],
            ['gloop', 'It was on a plate in the tunnel, all alone. It said "Free Sandwich". It tasted green.'],
            ['clasp', 'A sandwich left out with a sign? In a monster tunnel? Somebody\'s been reading too many ballads.'],
            ['you', 'Hop on the table, Gloop. Let\'s get that sandwich out of your core.'],
        ],
        thanks: [
            ['gloop', 'Blorp! Light! Bubbly! I feel like fresh rainwater.'],
            ['gloop', 'No more sandwiches. Unless you make them. You seem nice.'],
        ],
    },
    rattle: {
        act: 1, species: 'skeleton', name: 'Rattle', ailment: 'Sigils carved on the ribs',
        scan: { kinds: [['sigil', 2], 'fracture', ['bruise', 2], 'chain'], focus: 15, goals: [{ t: 'kind', v: 'sigil', n: 30 }, { t: 'hue', v: 'purple', n: 34 }] },
        intro: [
            ['rattle', 'Good evening. Rattle, crypt-keeper second class. Forgive the clattering, I can\'t stop shivering.'],
            ['rattle', 'Someone has been carving words on my ribs while I sleep. Little glowing ones. They itch in colours.'],
            ['ossa', 'Colours. You can see those now, can\'t you, love? Mother Bramblehide taught you more than she knew.'],
            ['you', 'Up on the table, Rattle. Mind your coccyx.'],
        ],
        thanks: [
            ['rattle', 'Oh, that is SO much better. I could dance. I won\'t, my knees are original.'],
            ['rattle', 'The carving started after a scholar came through the crypt. Grey robes, gold buttons. Very interested in our dead.'],
        ],
    },
    wisp: {
        act: 1, species: 'ghost', name: 'Wisp', ailment: 'Cannot stop crying',
        scan: { kinds: [['nightmare', 2], ['sigil', 2], 'wither', 'nightshade'], focus: 16, goals: [{ t: 'kind', v: 'nightmare', n: 26 }, { t: 'hue', v: 'blue', n: 31 }] },
        intro: [
            ['wisp', '...'],
            ['wisp', 'The Lady stopped singing. She only screams now. We can\'t find our way to sleep without her song.'],
            ['wisp', 'I keep dreaming of chains.'],
            ['clasp', 'Poor little thing. Table\'s warm, sweetheart. The Healer has gentle hands.'],
        ],
        thanks: [
            ['wisp', 'It\'s quiet inside me. Thank you.'],
            ['wisp', 'Please help the Lady. She\'s in the Drowned Crypt. She was always kind to us.'],
        ],
    },
    tik: {
        act: 2, species: 'kobold', name: 'Tik', ailment: 'Burned at the forge',
        scan: { kinds: [['scorch', 2], 'fracture', ['bruise', 2], 'acid'], sevs: ['S', 'M', 'L'], focus: 15, scarCount: 3, goals: [{ t: 'kind', v: 'scorch', n: 44 }, { t: 'sev', v: 'L', n: 40 }, { t: 'scar', n: 2 }] },
        intro: [
            ['tik', 'Tik-tik! Healer! The mountain is ANGRY. Smoke everywhere. The Ember Mother is roaring and roaring.'],
            ['tik', 'Shiny men came up the mountain road. Shiny men with long poles. Then fire, and the egg was gone.'],
            ['you', 'Let me see the burns, Tik. Some of these go deep.'],
            ['ossa', 'Feel for the depth. Grave hurts tug at you differently than minor ones. You learned that in the crypt.'],
        ],
        thanks: [
            ['tik', 'Cool! Cool as cave-water! Tik will sing a stone-song for you.'],
            ['tik', 'Please go to Emberpeak. The Ember Mother won\'t let anyone near. But you are not anyone.'],
        ],
    },
    bogdan: {
        act: 2, species: 'troll', name: 'Bogdan', ailment: 'Hacked at his own bridge',
        scan: { kinds: [['gash', 2], ['holyfire', 2], 'bruise', 'thorn', 'fracture'], sevs: ['S', 'M', 'L'], focus: 16, scarCount: 4, goals: [{ t: 'kind', v: 'gash', n: 36 }, { t: 'kind', v: 'holyfire', n: 25 }, { t: 'scar', n: 3 }] },
        intro: [
            ['bogdan', 'Evening. Bogdan. I keep the Low Bridge. Toll is a song or a joke, never coin.'],
            ['bogdan', 'Four of them crossed. Didn\'t sing, didn\'t joke. The lady in white burned me with light and called it mercy.'],
            ['bogdan', 'Trolls heal fast. That\'s why they cut us twice.'],
            ['you', 'Then I\'ll heal you faster. Table, Bogdan. Careful, it\'s oak.'],
        ],
        thanks: [
            ['bogdan', 'Good work. Good hands. Come cross my bridge some day. I\'ll let you off the joke.'],
        ],
    },
    crag: {
        act: 3, species: 'gargoyle', name: 'Crag', ailment: 'Gloam Fever, raving',
        scan: { kinds: [['nightmare', 2], ['chain', 2], ['fracture', 1], ['wither', 2], ['scorch', 2], 'sigil'], sevs: ['S', 'M', 'L'], focus: 17, scarCount: 2, boundCount: 3, goals: [{ t: 'school', v: 'hex', n: 101 }, { t: 'bound', n: 3 }, { t: 'sev', v: 'L', n: 59 }] },
        intro: [
            ['crag', 'THE TOWER. THE TOWER IS FULL OF WASPS. NO. NO, it\'s you. You\'re the healer.'],
            ['crag', 'Forgive me. The Fever. It came down from the Citadel like fog off a gutter.'],
            ['crag', 'The master doesn\'t come to the battlements any more. He shouts at the moon. He never shouted at anything.'],
            ['pip', 'Healer! Inside him it\'s all one colour of hurt. Venom, wound, hex, blight. You can see the roots now. Use them!'],
        ],
        thanks: [
            ['crag', 'Quiet. Stone-quiet. Bless you.'],
            ['crag', 'Go to Gloamspire, healer. Something is sitting on the master\'s head that shouldn\'t be.'],
        ],
    },
    murmur: {
        act: 3, species: 'ghost', name: 'Murmur', ailment: 'Fever dreams',
        scan: { kinds: [['nightmare', 2], ['frostbite', 1], ['sigil', 3], ['holyfire', 2], ['chain', 2], 'acid'], sevs: ['S', 'M', 'L'], focus: 18, boundCount: 4, goals: [{ t: 'school', v: 'blight', n: 75 }, { t: 'school', v: 'hex', n: 90 }, { t: 'bound', n: 4 }] },
        intro: [
            ['murmur', 'They whisper in the Citadel. Not ghosts. Living voices, from a crown. "You are the monster they say you are."'],
            ['murmur', 'I heard it through the walls. Now I hear it in me.'],
            ['you', 'Let me look. Whispers leave marks like anything else.'],
        ],
        thanks: [
            ['murmur', 'The voice is gone. Only my own thoughts. They\'re boring. I love them.'],
        ],
    },
};

// ------------------------------------------------------------------ quests

export const QUESTS = {
    bramble: {
        act: 0, label: 'Bramblewood Hollow', icon: '🌲', blurb: 'Screaming in the old forest hollow. The owlbears nest there.',
        remedies: { salts: 1, calm: 1 },
        arrive: [
            ['narrator', 'Bramblewood Hollow. Moss, mist, and somewhere ahead, a sound like a bear crying.'],
            ['pip', 'Thornwire, Healer! Same as Nib\'s hedge. Somebody strung the whole hollow with traps.'],
            ['you', 'Then we cut it down as we go, and we find everyone who\'s hurt.'],
        ],
        patients: [
            { species: 'myconid', name: 'Fen', ailment: 'Spore rot from trampled rings', scan: { kinds: ['rotspore', 'thorn', 'nightshade', 'gash'], focus: 14, goals: [{ t: 'kind', v: 'rotspore', n: 26 }, { t: 'kind', v: 'thorn', n: 16 }] },
                intro: [['fen', 'Puff... the boots came through our ring. Crushed the little ones. My cap is rotting from the edge in.']],
                thanks: [['fen', 'The rot is gone. The ring will regrow. We remember kindness a long, long time.']] },
            { species: 'imp', name: 'Cinder', ailment: 'Arrow wound', scan: { kinds: ['gash', 'spider', 'bruise', 'thorn'], focus: 14, goals: [{ t: 'kind', v: 'gash', n: 29 }, { t: 'kind', v: 'bruise', n: 16 }] },
                intro: [['cinder', 'Took an arrow carrying a letter to the Overlord. A GOLD arrow. Who wastes gold on shooting imps?']],
                thanks: [['cinder', 'Flapping again! I\'ll tell the Citadel what\'s going on out here. If anyone there\'s listening.']] },
            { species: 'goblin', name: 'Moll', ailment: 'Caught in a snare', scan: { kinds: ['bruise', 'gash', 'thorn', 'spider', 'wyrmbile'], focus: 16, goals: [{ t: 'kind', v: 'bruise', n: 26 }, { t: 'kind', v: 'spider', n: 18 }] },
                intro: [['moll', 'A snare! A shiny snare with a bell on it, so they\'d hear when they caught something. Like I\'m a rabbit!']],
                thanks: [['moll', 'Right as rain. Mother Bramblehide is past the brambles. She won\'t let anyone close. Maybe she\'ll let you.']] },
        ],
        boss: {
            species: 'owlbear', name: 'Mother Bramblehide', ailment: 'Shot full of golden arrows',
            scan: { kinds: ['gash', 'thorn', 'fracture', 'spider', 'bruise'], focus: 22, goals: [{ t: 'kind', v: 'gash', n: 36 }, { t: 'kind', v: 'fracture', n: 21 }, { t: 'bloom', n: 1 }] },
            intro: [
                ['mother', 'HRRROOO. Stay back. Stay back from my cubs.'],
                ['you', 'I\'m the healer from the Lantern Clinic. I\'ve come to take the arrows out.'],
                ['mother', '...The clinic. The old healer\'s place. They said a new one had come.'],
                ['mother', 'Then come. Gently. They had golden arrows and golden laughs. They wanted my head for a wall.'],
            ],
            thanks: [
                ['mother', 'My cubs. I can hold my cubs.'],
                ['mother', 'Take this arrow, healer. Show it to someone who matters. Surface folk did this, and they were proud of it.'],
                ['pip', 'Healer, when you were inside her, did you see it? Her hurts were in colours! Crimson and verdant and gold!'],
                ['ossa', 'That\'s Aura Sight. Your teacher found it the same way, in a hurt thing\'s blood. Motes of the same colour link now, whatever their form.'],
            ],
        },
        gateOpen: [['narrator', 'The brambles shiver and draw apart. The forest trusts you now.']],
        gateShut: [['pip', 'The brambles won\'t part. Mother Bramblehide\'s forest is frightened. Help everyone else first!']],
    },
    crypt: {
        act: 1, label: 'The Drowned Crypt of Vell', icon: '⚰️', blurb: 'The old monster cemetery. The Weeping Lady screams and the dead can\'t sleep.',
        remedies: { salts: 1, star: 1 },
        arrive: [
            ['narrator', 'The Drowned Crypt of Vell. Candles under water. Somewhere below, a woman screaming, on and on.'],
            ['pip', 'Hex-chains on the doors, Healer. And on the spirits. Somebody bound the whole crypt.'],
        ],
        patients: [
            { species: 'skeleton', name: 'Ulna', ailment: 'Bound in hex-chains', scan: { kinds: [['chain', 2], ['sigil', 2], 'fracture', 'bruise'], focus: 15, goals: [{ t: 'kind', v: 'chain', n: 30 }, { t: 'hue', v: 'red', n: 24 }] },
                intro: [['ulna', 'Chains. Chains on my chains. I was dusting the ossuary and the walls started speaking Aurelunese.']],
                thanks: [['ulna', 'Free! Go on, the Lady is below. Mind the water, it\'s older than the stones.']] },
            { species: 'ghost', name: 'Sigh', ailment: 'Nightmares', scan: { kinds: [['nightmare', 2], ['sigil', 2], 'wither', 'nightshade'], focus: 15, goals: [{ t: 'kind', v: 'nightmare', n: 36 }, { t: 'hue', v: 'purple', n: 45 }] },
                intro: [['sigh', 'Every time I close my eyes I see a grey man with gold buttons writing on my bones.']],
                thanks: [['sigh', 'He\'s gone from my sleep. If you find him in the waking world, write on HIS bones.']] },
            { species: 'slime', name: 'Ooze', ailment: 'Swallowed a hex-stone', scan: { kinds: [['sigil', 3], ['nightshade', 2], 'acid', 'wyrmbile'], focus: 16, goals: [{ t: 'kind', v: 'sigil', n: 29 }, { t: 'hue', v: 'pink', n: 20 }, { t: 'hue', v: 'green', n: 23 }] },
                intro: [['ooze', 'Blub. I clean the crypt. I cleaned up a little glowing stone. Now I glow. I don\'t like glowing.']],
                thanks: [['ooze', 'Blub! Plain again. Lovely plain.']] },
        ],
        boss: {
            species: 'banshee', name: 'The Weeping Lady', ailment: 'Hexed to scream without end',
            scan: { kinds: [['sigil', 3], ['nightmare', 2], ['chain', 2], 'frostbite', 'wither'], focus: 24, goals: [{ t: 'kind', v: 'sigil', n: 41 }, { t: 'hue', v: 'blue', n: 36 }, { t: 'bloom', n: 2 }] },
            intro: [
                ['lady', 'AAAAAAAAAAH—'],
                ['pip', 'Healer, the hex is in her voice! Get close, I\'ll light you through it!'],
                ['lady', '...h-help... the scroll... the magister... AAAAH—'],
            ],
            thanks: [
                ['lady', '(she sings, very softly, and all through the crypt the restless dead lie down)'],
                ['lady', 'A magister came with a scroll. He said the dead were wasted on monsters and he\'d have our bones for his studies.'],
                ['lady', 'He dropped this when I screamed the first time. I\'m glad I screamed.'],
                ['ossa', 'You felt it in there, didn\'t you? Some hurts lie shallow and some lie deep. That\'s Depth Sense. Grave links to grave, minor to minor.'],
            ],
        },
        gateOpen: [['narrator', 'The hex on the inner door crumbles to grey ash.']],
        gateShut: [['pip', 'The inner door is still hexed. The other spirits\' chains feed it. Free them first!']],
    },
    forge: {
        act: 2, label: 'Emberpeak Forge', icon: '🌋', blurb: 'The dragon\'s mountain is full of smoke. Ignatia was lanced and her egg stolen.',
        remedies: { salts: 1, calm: 1, star: 1 },
        arrive: [
            ['narrator', 'Emberpeak Forge. Rivers of slow fire, anvils the size of houses, and the long low growl of a dragon in pain.'],
            ['pip', 'Mind the lava, Healer! And mind the spike traps. Shiny ones. You know whose.'],
        ],
        patients: [
            { species: 'kobold', name: 'Soot', ailment: 'Crushed under a fallen anvil', scan: { kinds: [['fracture', 1], ['bruise', 2], ['scorch', 2], 'gash'], sevs: ['S', 'M', 'L'], focus: 15, scarCount: 3, goals: [{ t: 'kind', v: 'fracture', n: 41 }, { t: 'sev', v: 'L', n: 38 }, { t: 'scar', n: 2 }] },
                intro: [['soot', 'The shiny men knocked the big anvil off its stone to block the road down. I was under the road.']],
                thanks: [['soot', 'Bones all in a row! Ignatia is up at the crown of the forge. She\'s burning everything that moves.']] },
            { species: 'golem', name: 'Cobble', ailment: 'Cracked and seared', scan: { kinds: [['scorch', 2], 'fracture', ['acid', 2], ['chain', 2]], sevs: ['S', 'M', 'L'], focus: 16, scarCount: 4, goals: [{ t: 'kind', v: 'scorch', n: 56 }, { t: 'sev', v: 'S', n: 49 }, { t: 'scar', n: 3 }] },
                intro: [['cobble', 'COBBLE. GUARD. FORGE GATE. COBBLE. CRACKED. SAD.']],
                thanks: [['cobble', 'COBBLE. WHOLE. COBBLE. GRATEFUL. COBBLE WILL REMEMBER YOUR FACE FOREVER. COBBLE REMEMBERS EVERY FACE.']] },
            { species: 'troll', name: 'Lumpkin', ailment: 'Holy-fire burns', scan: { kinds: [['holyfire', 2], ['scorch', 2], 'gash', 'thorn', 'acid'], sevs: ['S', 'M', 'L'], focus: 17, scarCount: 4, goals: [{ t: 'kind', v: 'holyfire', n: 31 }, { t: 'hue', v: 'yellow', n: 31 }, { t: 'sev', v: 'M', n: 28 }] },
                intro: [['lumpkin', 'Lady in white said a prayer and the prayer was on fire. I don\'t think that\'s how prayers go.']],
                thanks: [['lumpkin', 'Lumpkin feels lovely. Lumpkin will make you soup. Lumpkin\'s soup is mostly rocks but it\'s the thought.']] },
        ],
        boss: {
            species: 'dragon', name: 'Ignatia', ailment: 'Lanced through the wing',
            scan: { kinds: [['scorch', 2], ['gash', 2], 'fracture', ['holyfire', 2], ['acid', 2], 'bruise'], sevs: ['S', 'M', 'L'], focus: 26, scarCount: 5, goals: [{ t: 'kind', v: 'gash', n: 47 }, { t: 'sev', v: 'L', n: 40 }, { t: 'scar', n: 4 }, { t: 'bloom', n: 2 }] },
            intro: [
                ['ignatia', 'Another little one with a shining thing in its hand. Come to finish the job? Come for my hoard?'],
                ['you', 'I\'ve come with a Lens, not a lance. I\'m the healer.'],
                ['ignatia', 'Healer. Hm. The golden knight called himself a hero. Then he put a lance through my wing while his thief took my egg.'],
                ['ignatia', 'Heal me, then, and let me fly after them.'],
            ],
            thanks: [
                ['ignatia', 'My wing. I can feel the wind in it.'],
                ['ignatia', 'Take the lance-tip. A. G., it says. Sir Aldric Goldspur. I will remember that name for a thousand years.'],
                ['ignatia', 'And healer, listen. Grimwald has not answered a summons in a month. Dragons and Overlords talk. He has gone quiet. Something is wrong in Gloamspire.'],
                ['ossa', 'You saw it in her, didn\'t you? Venom, wound, hex, blight. The four roots. That\'s Root Lore, the last of the old senses. Any two of the same nature link now.'],
            ],
        },
        gateOpen: [['narrator', 'With a roar of bellows the great forge-door grinds open.']],
        gateShut: [['pip', 'The forge-door won\'t budge. The kobolds work it, and they\'re all hurt. Help them first!']],
    },
    citadel: {
        act: 3, label: 'Gloamspire Citadel', icon: '🏰', blurb: 'The Overlord\'s castle. The Gloam Fever pours out of it like fog.',
        remedies: { salts: 2, calm: 1, star: 1 },
        arrive: [
            ['narrator', 'Gloamspire Citadel. Half its lanterns dark. Purple fog in the halls, and from the throne room, a great voice shouting at nothing.'],
            ['pip', 'The Fever is thickest here. Find the master\'s guards, Healer. And look for anything that doesn\'t belong.'],
        ],
        patients: [
            { species: 'golem', name: 'Keystone', ailment: 'Gloam Fever', scan: { kinds: [['chain', 2], ['fracture', 1], ['sigil', 2], ['scorch', 2], 'frostbite', 'acid'], sevs: ['S', 'M', 'L'], focus: 17, boundCount: 3, scarCount: 2, goals: [{ t: 'school', v: 'hex', n: 58 }, { t: 'bound', n: 3 }, { t: 'sev', v: 'L', n: 40 }] },
                intro: [['keystone', 'INTRUDER. INTRUDER. no. friend. FRIEND. the fog in my head says INTRUDER.']],
                thanks: [['keystone', 'Clear. Keystone sees clearly. The master is in the throne room. The thing on his head is not his.']] },
            { species: 'gargoyle', name: 'Nightperch', ailment: 'Gloam Fever', scan: { kinds: [['wither', 2], ['nightmare', 2], ['holyfire', 2], 'fracture', ['chain', 2], 'gash'], sevs: ['S', 'M', 'L'], focus: 17, boundCount: 3, scarCount: 2, goals: [{ t: 'school', v: 'blight', n: 34 }, { t: 'school', v: 'hex', n: 34 }, { t: 'bound', n: 3 }] },
                intro: [['nightperch', 'The moon is lying to me. The moon says the master is a monster. The master planted the moonflowers.']],
                thanks: [['nightperch', 'The moon is quiet. Go up, healer. Go to him.']] },
            { species: 'imp', name: 'Snick', ailment: 'Gloam Fever', scan: { kinds: [['scorch', 2], ['sigil', 3], 'gash', ['chain', 2], 'nightmare', 'spider'], sevs: ['S', 'M', 'L'], focus: 17, boundCount: 4, goals: [{ t: 'school', v: 'wound', n: 29 }, { t: 'school', v: 'hex', n: 43 }, { t: 'bound', n: 4 }] },
                intro: [['snick', 'Snick carried the tribute chest up! Snick! Pretty crown, from the surface. Peace gift, the note said. Snick\'s fault. Snick\'s FAULT.']],
                thanks: [['snick', 'Not Snick\'s fault? ...Not Snick\'s fault. Snick will believe you, because you fixed Snick.']] },
        ],
        boss: {
            species: 'overlord', name: 'Grimwald the Gentle', ailment: 'The Diadem of Wrath',
            scan: {
                phases: [
                    { name: 'Wrath', mask: OVERLORD_MASKS.wrath, kinds: [['scorch', 2], ['holyfire', 2], ['gash', 2], 'fracture', ['acid', 2], 'bruise'], sevs: ['S', 'M', 'L'], focus: 14, scarCount: 3, goals: [{ t: 'school', v: 'blight', n: 52 }, { t: 'sev', v: 'L', n: 32 }] },
                    { name: 'Lies', mask: OVERLORD_MASKS.lies, kinds: [['nightmare', 2], ['sigil', 3], ['wither', 2], ['nightshade', 2], 'spider', 'frostbite'], sevs: ['S', 'M', 'L'], focus: 10, boundCount: 4, goals: [{ t: 'kind', v: 'nightmare', n: 32 }, { t: 'school', v: 'hex', n: 45 }, { t: 'bound', n: 4 }] },
                    { name: 'The Diadem', mask: OVERLORD_MASKS.diadem, kinds: [['chain', 2], ['sigil', 3], ['holyfire', 2], ['scorch', 2], 'fracture', ['wither', 2], 'nightmare'], sevs: ['S', 'M', 'L'], focus: 12, boundCount: 5, scarCount: 2, goals: [{ t: 'kind', v: 'chain', n: 39 }, { t: 'bound', n: 5 }, { t: 'bloom', n: 1 }] },
                ],
            },
            intro: [
                ['grimwald', 'WHO COMES? ANOTHER HERO? ANOTHER LITTLE SUN WITH A SWORD? I AM THE MONSTER. THE CROWN SAYS SO. THE CROWN SAYS—'],
                ['you', 'I\'m your healer, Grimwald. Not a hero. I\'m here for the crown.'],
                ['grimwald', 'Healer... there was a healer once. Who taught... my moonflowers... NO. LIES. ALL OF THEM.'],
                ['pip', 'Three layers, Healer! His wrath on top, the lies under it, and the Diadem at the root. Hold on tight!'],
            ],
            thanks: [
                ['grimwald', '...Oh.'],
                ['grimwald', 'Oh, my dear. What have I been shouting? I\'ve been shouting for weeks, haven\'t I. At the moon. The moon has done nothing wrong.'],
                ['grimwald', 'This crown. Tribute, the note said. A peace gift from Aurelune. I was so pleased. Nobody sends me presents.'],
                ['you', 'The Gilded Company sent it. I have their arrow, their scroll, their lance, and their ledger.'],
                ['grimwald', 'Then we shall have a Lantern Court. Monster and surface envoys together, in this hall, by morning. And you shall stand beside me.'],
            ],
        },
        gateOpen: [['narrator', 'Keystone, Nightperch and Snick heave together, and the great doors of the throne room swing open.']],
        gateShut: [['pip', 'The throne doors are barred from inside by the Fever-struck guards\' wards. Heal the guards first!']],
        evidence: [['pip', 'A ledger, in Vessa Nightquill\'s hand. "One crown, the Diadem of Wrath, sent as tribute. Fever to follow. Bounty on the Overlord: one dukedom." That\'s it, Healer. That\'s everything.']],
    },
};

// ------------------------------------------------------------------ ending

export const ENDING = [
    { title: 'The Lantern Court', text: 'By morning the throne room is full: goblins and gargoyles, kobolds and ghosts, and, nervous at the back, three envoys from the surface city of Aurelune.' },
    { title: 'The Evidence', text: 'Grimwald lays it out on the table, one piece at a time: a golden arrow, a signed hex scroll, a broken lance engraved A. G., and a ledger in a rogue\'s neat hand. The envoys go very quiet.' },
    { title: 'The Gilded Company', text: 'Sir Aldric Goldspur, Vessa Nightquill, Magister Corvin Hale and Sister Lumina are brought in by Cobble, who remembers every face. Their titles are stripped, their gold returned to the folk they hurt.' },
    { title: 'The Sentence', text: 'Grimwald asks for a gentle one. A year of service as orderlies at the Lantern Clinic. Sir Aldric is handed a mop. The slimes are delighted.' },
    { title: 'The Lanterns Relit', text: 'One by one the lanterns of Gloamhollow are lit again. Ignatia flies home with her egg, found in Vessa\'s saddlebag. The Weeping Lady sings. Mother Bramblehide\'s cubs grow fat on the forest\'s honey.' },
    { title: 'The Clinic', text: 'And the Lantern Clinic stays open, every night, for anyone with a thorn in their foot or a curse on their ribs. Clasp has ordered a bigger ledger.' },
];

// ------------------------------------------------------------------ walk-ins

const COMPLAINTS = {
    nightshade: ['ate the wrong berries by the Low Road', 'was bitten by a fang-moth', 'drank from a nightshade puddle'],
    wyrmbile: ['licked a Company potion bottle', 'swam in the bile springs', 'was spat on by a sour wyrm'],
    spider: ['was bitten by a cave spider', 'sat on a web-nest', 'tickled the wrong spider'],
    rotspore: ['breathed in a rot-puff', 'slept in a damp hollow', 'stepped in a trampled fairy ring'],
    gash: ['was cut by an adventurer\'s sword', 'fell on a sharp rock', 'had a run-in with a "hero"'],
    bruise: ['was knocked down a stairwell', 'was clubbed by a mace', 'walked into a portcullis'],
    thorn: ['walked into a thornwire hedge', 'rolled in briars', 'stepped on a caltrop'],
    fracture: ['fell down a mine shaft', 'was hit by a falling stalactite', 'was trampled at the market'],
    sigil: ['has a sigil carved on the shoulder', 'touched a glowing rune', 'read a scroll left in a tunnel'],
    wither: ['has a withering hex', 'sat under a cursed tree', 'was glared at by a magister'],
    nightmare: ['can\'t stop dreaming of gold', 'has night terrors', 'hears whispers'],
    chain: ['feels invisible chains', 'was bound by a hex-chain', 'can\'t lift one arm'],
    scorch: ['was singed by a fireball', 'fell into a forge', 'was too close to a dragon sneeze'],
    holyfire: ['was "blessed" with holy fire', 'was burned by a prayer', 'touched a sunburst amulet'],
    frostbite: ['spent a night on the ice stair', 'was hit by a frost bolt', 'licked a frozen gate'],
    acid: ['fell in an acid pool', 'was splashed by a slime who sneezed', 'tasted alchemist runoff'],
};

/** A walk-in patient for an act, from a seeded rng. Pure. */
export function makeWalkin(actIndex, rng, id) {
    const A = ACTS[actIndex].walk;
    const species = rng.pick(A.species);
    const sp = SPECIES[species];
    const name = rng.pick(sp.names);
    const allowed = sp.lean.filter((k) => A.kinds.includes(k));
    const main = allowed.length ? rng.pick(allowed) : rng.pick(A.kinds);
    const pool = [main];
    const rest = rng.shuffle(A.kinds.filter((k) => k !== main));
    while (pool.length < A.pool && rest.length) pool.push(rest.pop());
    const hues = A.hues ?? 1;
    const kinds = pool.map((k) => (hues > 1 ? [k, Math.min(hues, KINDS[k].hues.length)] : k));
    const goals = [{ t: 'kind', v: main, n: 20 + rng.int(0, 5) + (actIndex === 2 ? 6 : actIndex * 2) }];
    if (actIndex === 0) goals.push({ t: 'kind', v: pool[1], n: 13 + rng.int(0, 4) });
    if (actIndex >= 1) goals.push({ t: 'hue', v: KINDS[main].hues[0], n: 20 + rng.int(0, 5) });
    if (actIndex >= 2) goals.push(A.scars ? { t: 'scar', n: Math.min(2, A.scars) } : { t: 'sev', v: 'L', n: 18 });
    if (actIndex >= 3 && A.bound) goals.push({ t: 'bound', n: Math.min(2, A.bound) });
    const focus = rng.int(A.focus[0], A.focus[1]);
    return {
        id, species, name, walkin: true,
        ailment: `${rng.pick(COMPLAINTS[main])}`.replace(/^./, (c) => c.toUpperCase()),
        scan: { kinds, sevs: A.sevs, focus, scarCount: A.scars, boundCount: A.bound, goals },
    };
}

/** The scan spec for a patient, with its silhouette filled in. */
export function scanSpecFor(p) {
    const s = p.scan;
    if (s.phases) return { phases: s.phases.map((ph) => ({ ...ph, name: ph.name })) };
    return { name: p.name, mask: M(p.species), ...s };
}

/** Lines when you first talk to a walk-in. */
export function walkinIntro(p) {
    const sp = SPECIES[p.species];
    return [
        [p.id, `Evening, healer. ${p.name}, ${sp.label.toLowerCase()}. I ${p.ailment.charAt(0).toLowerCase() + p.ailment.slice(1)}.`],
        ['you', 'Let\'s have a look. Up on the table, please.'],
    ];
}

export function walkinThanks(p, stars) {
    const lines = [
        'That\'s a weight off. Thank you, healer.',
        'Good as new! Better, even.',
        'I\'ll tell my whole warren about you.',
        'You have kind hands. Clasp has the bill, I expect.',
    ];
    return [[p.id, lines[(p.name.length + stars) % lines.length]]];
}

// ------------------------------------------------------------------ talk: the cast

/** Clasp, by where the story stands. */
export function claspLines(G) {
    const a = G.act;
    const waiting = G.patients.filter((p) => p.where === 'clinic' && p.state === 'waiting');
    const story = ACTS[a]?.story ?? [];
    const storyLeft = story.filter((id) => !G.patients.find((p) => p.id === id && p.state === 'healed' || p.id === id && p.state === 'gone'));
    if (!G.flags.met) {
        return [
            ['clasp', 'There you are! Opening night! I\'ve polished my hinges and everything.'],
            ['clasp', 'I\'m Clasp, receptionist, ledger-keeper, and yes, a mimic. I only bite people who don\'t pay.'],
            ['clasp', 'We\'ve got a goblin in the waiting room already, hopping about. Talk to him, send him to the table, then use the Lumen Lens.'],
            ['clasp', 'Pip lives in the Lens. Pip will show you the ropes. Ossa\'s in the study if you need wisdom.'],
        ];
    }
    if (a === 4) {
        return [
            ['clasp', 'Business is BOOMING. Surface folk come down now, can you believe it? An envoy brought me a quill. A REAL quill.'],
            ['clasp', 'And Sir Aldric has mopped the hall eleven times today. I keep tipping things over. For training purposes.'],
        ];
    }
    if (G.quests[ACTS[a].quest]?.state === 'open') {
        const q = QUESTS[ACTS[a].quest];
        return [
            ['clasp', `The call's come in: ${q.label}. ${q.blurb}`],
            ['clasp', 'Your cart is out the front door. Mind the potholes, they\'ve got opinions.'],
        ];
    }
    if (waiting.length) return [['clasp', `${waiting.length === 1 ? 'One' : waiting.length} waiting. ${waiting[0].name} has been very patient, which in a clinic is a pun.`]];
    if (storyLeft.length) return [['clasp', 'Quiet moment. Someone will be through the door any minute, mark my words.']];
    return [
        ['clasp', 'All caught up! If you want more patients, have a rest on the cot. Tomorrow always brings more feet with thorns in them.'],
    ];
}

/** Ossa, by where the story stands. */
export function ossaLines(G) {
    const a = G.act;
    if (!G.flags.ossaMet) {
        return [
            ['ossa', 'Look at you. Your teacher would be proud. They\'d also tell you to stand up straight.'],
            ['ossa', 'The Grimoire of Mending is on the lectern behind me. Every time folk start to speak well of you, you\'ll find you understand more of it.'],
            ['ossa', 'Renown, they call it. I call it practice. Spend what you learn there.'],
        ];
    }
    const lines = {
        0: [['ossa', 'Something is wrong on the forest road. Thornwire hedges, "free" sandwiches. Somebody is hunting monsters like it\'s sport.'],
            ['ossa', 'Keep your eyes open. And keep anything they leave behind. Evidence has a way of mattering later.']],
        1: [['ossa', 'Grey robes, gold buttons, an interest in our dead. That\'s a magister from the Aurelune academies.'],
            ['ossa', 'The same gold on the arrows and the buttons. It\'s one band of them, I\'d bet my femurs on it.']],
        2: [['ossa', 'Dragons don\'t get lanced by accident. These "heroes" are working their way toward something.'],
            ['ossa', 'Toward the Citadel, I fear. If you want to bring down an Overlord, first you make him look like a monster.']],
        3: [['ossa', 'The Fever comes from Gloamspire. Whatever is wrong with Grimwald, it\'s spreading out of him.'],
            ['ossa', 'He was your teacher\'s dearest friend, you know. He used to bring moonflowers for the waiting room.']],
        4: [['ossa', 'Moonflowers in the waiting room again. Grimwald brings them every week. He also brings poems. We hide those.'],
            ['ossa', 'You did well, love. Now get back to work. There\'s a slime in the hall eating Sir Aldric\'s mop.']],
    };
    return lines[a] ?? lines[4];
}

/** Pip, on the first scan. */
export const PIP_TUTORIAL = [
    ['pip', 'Hello hello! I\'m Pip! I live in the Lens and I light up the insides of things!'],
    ['pip', 'Every glowing mote is something that hurts. Drag from one to the next. Each hop has to share something you can sense. Right now that\'s just the FORM: thorn to thorn, gash to gash.'],
    ['pip', 'Let go when your trail is three or longer and they\'re treated! Each trail costs one Focus. Finish the goals at the top before you run out.'],
    ['pip', 'Trails of seven grow a Lifebloom that links to anything. And the vials fill up as you treat things. A full vial is a power! Tap it to use it.'],
];

export const INTRO = [
    ['narrator', 'Gloamhollow, the kingdom under the hills, where the monsters live.'],
    ['narrator', 'For three hundred years the Overlord Grimwald the Gentle has kept the Peace of Lanterns. Monsters below, surface folk above.'],
    ['narrator', 'Your teacher kept the Lantern Clinic at Hollow\'s Crossing for most of those years. Now it\'s yours.'],
    ['ossa', 'Doors open in a minute, love. Go and say hello to Clasp at the desk. She\'s been rehearsing.'],
];

/** Lines when you come home from a finished call (act transition). */
export const HOMECOMING = {
    0: [
        ['clasp', 'You\'re back! And you smell like owl! Is that... is that a GOLD arrow? Can I bite it?'],
        ['ossa', 'The Gilded Company. Their crest. They\'re from Aurelune, on the surface. Glory-hunters, paid by the trophy.'],
        ['ossa', 'Keep the arrow. And the next few nights, you\'ll be seeing colours. Use them.'],
    ],
    1: [
        ['ossa', '"C. H., Magister." Corvin Hale. He teaches at the Aurelune academy, or did. They threw him out for digging in graveyards.'],
        ['clasp', 'An arrow AND a scroll. We\'re building a case! I\'ve started a file. It\'s a drawer. I\'m the drawer.'],
    ],
    2: [
        ['ossa', 'A. G. Sir Aldric Goldspur. A paladin, the ballads call him. Ballads are written by whoever pays the bard.'],
        ['ossa', 'And Ignatia says Grimwald has gone quiet. Rest up, love. I think the Fever is coming.'],
        ['clasp', 'Patients are coming in with... with fog in their eyes. I don\'t like it. I don\'t like it one bit.'],
    ],
};

export const ITEMS_FOUND = (items) => {
    const parts = Object.entries(items).map(([k, n]) => `${n} × ${({ salts: 'Smelling Salts', calm: 'Calm Draught', star: 'Starpetal Tonic' })[k]}`);
    return [['narrator', `Inside: ${parts.join(', ')}. Into the satchel.`]];
};
