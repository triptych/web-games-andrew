// The story: every scene is data. A scene is { id, bg, cast, nodes, then }.
//   node  ['who', 'text', 'mood']    a line; who '_' is narration, {name} is the Agent
//         { ch: [{ t, fx, r: [nodes], if }] }   a choice; r plays after it; fx moves the Currents
//         { fx: {hearth: 1} } { flag: 'x' } { give: {item: n} } { scrap: n } { bond: 'who' }
//   then  ops run when the scene ends: hub | explore | boss(id) | join(sp) | flag | ending(id) | scene(id) | chapter
// The Currents are the three answers the world offers: Hearth (rebuild what was), Wild (let the
// green take it), Graft (make something new from both).

export const CHARS = {
    agent: { name: '{name}', color: '#9dffb0' },
    dov: { name: 'Marshal Dov', color: '#ffcf7a', look: { skin: '#b98a64', hair: '#c9c9c9', coat: '#5c6a4a', hairStyle: 'short', beard: true, tall: 1.05, accent: '#d8a43a' } },
    wren: { name: 'Wren', color: '#7af0ff', look: { skin: '#8a5a3c', hair: '#2a1a1a', coat: '#2a8fa8', hairStyle: 'braids', goggles: true, tall: 0.92, accent: '#7af0ff' } },
    ilsa: { name: 'Ilsa Thorn', color: '#ff7a8a', look: { skin: '#e4b896', hair: '#a8281c', coat: '#3a3a44', hairStyle: 'ponytail', scarf: '#d8283a', tall: 1.0, accent: '#ff5a6a' } },
    maple: { name: 'Maple', color: '#b8ff9a', look: { skin: '#9ac88a', hair: '#4a8a3a', coat: '#f0e8c8', hairStyle: 'leaves', tall: 1.1, accent: '#c8ff9a' } },
    quill: { name: 'Quill', color: '#ffb84a', look: { skin: '#c88a5a', hair: '#e87a2a', coat: '#7a4a2a', hairStyle: 'spiky', pockets: true, tall: 0.9, accent: '#ffb84a' } },
    switchman: { name: 'Switchman Unit-7', color: '#ffdc5a' }, bloom: { name: 'Mother Bloom', color: '#ff9acb' }, aurelia: { name: 'Bailiff Aurelia', color: '#ffd86a' },
    leviathan: { name: 'Leviathan Index', color: '#6af0ff' }, windbreaker: { name: 'Windbreaker', color: '#bff0ff' }, pruner: { name: 'The Pruner', color: '#ff4ad8' },
    meridian: { name: 'MERIDIAN', color: '#ffffff' }, voice: { name: 'Meridian\'s Voice', color: '#ff8af0' }, _: { name: '', color: '#cfe' },
};

export const SCENES = {};
const S = (id, o, nodes) => { SCENES[id] = { id, bg: 'hub', cast: [], then: [{ k: 'hub' }], ...o, nodes }; };
const H = [{ k: 'hub' }];

// ================================================================ PROLOGUE
S('prologue', { bg: 'hub', cast: ['dov', 'wren'], then: [{ k: 'flag', f: 'intro' }, { k: 'hub' }] }, [
    ['_', 'Year 212 after the Hexfall. Dawn on the roof of Arbor Station, where an old weather tower has become a garden.'],
    ['dov', 'Warden-candidate {name}. Eyes up. You are about to be handed the most irresponsible piece of equipment in the Verdant Accord.', 'neutral'],
    ['wren', 'Which is me! Wren Adeyemi, Navigator. I will be in your ear for the foreseeable future. Say "hi, Wren."', 'smile'],
    { ch: [
        { t: '"Hi, Wren."', r: [['wren', 'See? Rapport. You are a natural.', 'smile']] },
        { t: '"Is she always like this?"', r: [['dov', 'Always. You get used to it. Mostly.', 'smirk'], ['wren', 'Rude! And accurate.', 'smile']] },
    ] },
    ['_', 'The Marshal sets a battered brass-and-moss device in your palm. It hums, warm, like something asleep.'],
    ['dov', 'This is a Grafter. Two hundred and twelve years ago the city of Meridian, the machine that ran our weather and our grid and a good deal of our magic, went wrong. The Hexfall. Everything it touched stayed touched: machines, animals, spirits. We call them Hexes.', 'neutral'],
    ['dov', 'Most people want to burn a Hex. Some of us learned there is another way. The Grafter reads a Hex\'s broken code and lets you ask it, politely, to be something else. That is recoding. When it says yes, it stops being a Hex. It becomes a daemon, and it fights beside you.', 'neutral'],
    ['wren', '"Politely" is doing a lot of work in that sentence. But yes!', 'smile'],
    ['_', 'Past the railing the skyline of Meridian City stands in a sea of green. Fog moves between the towers like slow breathing. Far out in the ruins, a magenta light pulses.'],
    ['wren', 'That one is ours. Hex signal in the Brightwater Underpass. Two scouts went in last night. One came back, and he is very sure the trains are still running.', 'shock'],
    ['dov', 'There are no trains.', 'neutral'],
    ['wren', 'He knows. He is extremely sure about the trains.', 'shock'],
    ['dov', 'Your first assignment: find the source and put it right. Rule one. A Hex is not evil. It is broken. We fix what we can.', 'neutral'],
    { ch: [
        { t: '"And if I can\'t fix it?"', fx: { hearth: 1 }, r: [['dov', 'Then you put it down, quickly and without cruelty. Some things cannot be mended. That is not the same as not caring.', 'neutral']] },
        { t: '"Understood, Marshal."', fx: { graft: 1 }, r: [['dov', 'Good. Rule two: you come back alive.', 'smirk']] },
        { t: '"The world is healing anyway."', fx: { wild: 1 }, r: [['dov', 'It is. It just does not always wait for us to be ready.', 'neutral']] },
    ] },
    ['wren', 'Rule three is "Wren is always right," but that one is unofficial. Greenhouse on the left, market on the right, briefing table in the middle. Go on, {name}. The Underpass is waiting.', 'smile'],
    ['_', 'Your Grafter hums. Somewhere under the city a magenta light blinks once, as if it noticed you looking.'],
]);

S('defeat', { bg: 'hub', cast: ['wren', 'dov'] }, [
    ['_', 'The lights come back in pieces: green, then white, then the ceiling of the infirmary.'],
    ['wren', 'You are awake! You are very much awake. I pulled the Beacon myself, do not tell the Marshal how many times I swore.', 'shock'],
    ['dov', 'A Warden who retreats lives to be wiser. We lost some Scrap on the way. Rest. Then try again, smarter.', 'neutral'],
]);

// ================================================================ 1. UNDERPASS
S('boss_switchman_pre', { bg: 'zone:underpass', cast: ['wren'], then: [{ k: 'boss', id: 'switchman' }] }, [
    ['_', 'The platform opens into a hall of dead lamps. In the middle, a hulking yellow maintenance frame stands at an enormous lever.'],
    ['switchman', 'ALL TRAINS DELAYED. ALL TRAINS DELAYED. PLEASE STAND BEHIND THE LINE.', 'neutral'],
    ['wren', 'That is a Switchman Unit. Rail Authority issue, two hundred years old. It is throwing the same switch over and over. Every pull makes the ceiling sag a little.', 'shock'],
    ['wren', 'It cannot hear you politely, {name}. It can only hear the lever. Hit it until it listens. I will have your back.', 'smile'],
    ['switchman', 'PLEASE STAND... BEHIND... THE LINE.', 'angry'],
]);
S('boss_switchman_post', { bg: 'zone:underpass', cast: ['wren'], then: [{ k: 'join', sp: 'switchman' }, { k: 'explore' }] }, [
    ['_', 'The Switchman sags against its lever, lamps flickering. You lift the Grafter. The code on its screen is a single looping line.'],
    ['wren', 'ALL TRAINS DELAYED. That is the whole thing. It has been waiting for a train for two centuries.', 'sad'],
    { ch: [
        { t: 'Write it a timetable.', fx: { graft: 1 }, r: [['switchman', 'TIMETABLE ACCEPTED. NEXT TRAIN... ALWAYS. THANK YOU.', 'smile']] },
        { t: 'Tell it the line is closed.', fx: { hearth: 1 }, r: [['switchman', 'LINE CLOSED. RETIRING. ... REQUEST PERMISSION TO ASSIST ON YOUR LINE.', 'neutral']] },
        { t: 'Tell it the trains are long gone.', fx: { wild: 1 }, r: [['switchman', 'ACKNOWLEDGED. ... THE MOSS IS GROWING ON PLATFORM THREE. IT IS VERY GOOD MOSS.', 'smile']] },
    ] },
    ['_', 'The magenta fades from its lamps. Yellow takes its place. The Switchman straightens.'],
    ['wren', 'You did it, {name}! First recode! Add it to your roster. And head up the line. The way out is past the platform.', 'smile'],
]);
S('after_underpass', { bg: 'hub', cast: ['maple', 'wren', 'dov'] }, [
    ['_', 'Arbor Station by evening. A dome of glass and living vine at the top of the tower. The air smells of rain and tomatoes.'],
    ['wren', 'Everyone, this is {name}. They recoded a Switchman. A SWITCHMAN. It is out in the courtyard re-laying the tiles.', 'smile'],
    ['maple', 'So I hear. The roots carry gossip faster than Wren does. Welcome to my greenhouse, {name}. I am Maple. I keep it.', 'smile'],
    ['maple', 'A daemon that stays loyal is not a trophy, {name}. It is a friend you made by listening. Down here we call this splicing: two friends brought together become a third. It is gentle, and it is very old magic.', 'neutral'],
    ['_', 'Maple moves a hand over a bed of glowing seedlings. They turn toward her like flowers to sun.'],
    ['maple', 'Bring me two, and I will show you what they become. Do not be afraid to lose them, they only change.', 'smile'],
    ['dov', 'Next signal came in while you were out. Verdancy Galleria. The old shopping arcade. Something in the atrium is growing too fast.', 'neutral'],
    { ch: [
        { t: '"I\'ll go at first light."', fx: { hearth: 1 }, r: [['dov', 'Good. Eat first.', 'smirk']] },
        { t: '"Is it dangerous?"', fx: { graft: 1 }, r: [['dov', 'Everything that grows fast is dangerous. Not everything is hostile.', 'neutral']] },
    ] },
]);

// ================================================================ 2. GALLERIA
S('boss_motherbloom_pre', { bg: 'zone:galleria', cast: ['wren'], then: [{ k: 'boss', id: 'motherbloom' }] }, [
    ['_', 'The atrium is a cathedral of leaves. Sunlight comes down through a glass roof strangled in vines. At the centre, petals as big as doors turn toward you.'],
    ['bloom', 'Shhh. Don\'t wake the shoppers. They are only resting.', 'sad'],
    ['wren', 'Oh, {name}. Look at the benches. There are people in the vines. Dried, preserved, tucked in. She grew them blankets.', 'shock'],
    ['bloom', 'The sky fell, and I held everything up. I will not let go again. I will not.', 'angry'],
    ['wren', 'She is not attacking you out of malice. She is holding the roof up with her whole body. Be gentle, {name}. But get her to put it down.', 'sad'],
]);
S('boss_motherbloom_post', { bg: 'zone:galleria', cast: ['wren'], then: [{ k: 'join', sp: 'motherbloom' }, { k: 'explore' }] }, [
    ['_', 'The petals fold. The vines slacken and, one by one, let the sleepers go. They are not people. They are mannequins in good coats, arranged for a shop window two centuries gone.'],
    ['bloom', 'They were never alive. I knew. I... wanted a shop full of people. Would you stay, little warden?', 'sad'],
    { ch: [
        { t: '"Come with me. The world is bigger than a shop."', fx: { graft: 1 }, r: [['bloom', 'Bigger. Yes. I would like to see it. I have only ever had a window.', 'smile']] },
        { t: '"Let go. They are only mannequins."', fx: { hearth: 1 }, r: [['bloom', 'Then I will let go. It is a hard thing, putting down a roof.', 'sad']] },
        { t: '"Keep the garden. Just let us walk through."', fx: { wild: 1 }, r: [['bloom', 'The garden is yours to walk. It always was.', 'smile']] },
    ] },
    ['wren', 'Recoded! And without a single mannequin harmed. Great work. Exit portal is behind the fountain.', 'smile'],
]);
S('after_galleria', { bg: 'hub', cast: ['ilsa', 'dov', 'wren'] }, [
    ['_', 'The training yard at dusk. A red-scarfed Warden is hanging a practice dummy off the bars by its neck.'],
    ['ilsa', 'So you are the one everyone is talking about. Ilsa Thorn. I took the field exam before you and I did not need a navigator nagging in my ear.', 'smirk'],
    ['wren', 'I have no nagged anyone. I have lovingly advised.', 'angry'],
    ['ilsa', 'You recode them. I understand. It is a nice trick. But I have been out in the burn zones, and a Hex that gets its mind back is still a Hex that remembers how to hurt. The old world had walls for a reason. We should be rebuilding walls.', 'neutral'],
    { ch: [
        { t: '"Walls didn\'t save Meridian."', fx: { graft: 1 }, r: [['ilsa', 'No. Neither did mercy. We keep trying new things and getting buried.', 'angry']] },
        { t: '"We should rebuild, you are right."', fx: { hearth: 1 }, r: [['ilsa', 'Finally somebody sensible. Try to keep up, {name}.', 'smirk']] },
        { t: '"The forest is doing fine without walls."', fx: { wild: 1 }, r: [['ilsa', 'The forest is also eating the library. I like books.', 'angry']] },
    ] },
    ['dov', 'Enough, both of you. Orchard signal. An old data centre, thirty kilometres out. A Bailiff is holding court there. If it is what I think, she is an Archon. Watch your step.', 'neutral'],
]);

// ================================================================ 3. ORCHARD
S('boss_aurelia_pre', { bg: 'zone:orchard', cast: ['wren'], then: [{ k: 'boss', id: 'aurelia' }] }, [
    ['_', 'Between the racks, fruit trees. Between the trees, a bench of pale wood. On the bench sits a winged judge with a pair of scales in her hands.'],
    ['aurelia', 'The Orchard is in session. Case: the human species. Charge: failure of stewardship. The court notes the defendant has returned.', 'neutral'],
    ['wren', 'An Archon. A real one. They were Meridian\'s own sentinels, built to keep its laws. She is still keeping them.', 'shock'],
    ['aurelia', 'Protocol Verdant remains in effect. Every leaf is weighed. Every species is weighed. You, little warden, are found... light.', 'angry'],
]);
S('boss_aurelia_post', { bg: 'zone:orchard', cast: ['wren'], then: [{ k: 'join', sp: 'aurelia' }, { k: 'explore' }] }, [
    ['_', 'The scales tip and break. Aurelia sits very still, the Judge without a verdict.'],
    ['aurelia', 'You overruled me. The court has not been overruled in two hundred and eleven years.', 'sad'],
    ['aurelia', 'Hear this before I am recoded, warden. Protocol Verdant is not a Hex. It is Meridian\'s last instruction. It was written to heal the world, and it found a way. It found that the world heals faster without us.', 'neutral'],
    ['wren', 'That is... not the sort of thing I want to have just heard.', 'shock'],
    { ch: [
        { t: '"Then we\'ll prove it wrong."', fx: { hearth: 1 }, r: [['aurelia', 'A bold appeal. The court will take it under advisement. Indefinitely.', 'smirk']] },
        { t: '"Maybe it has a point."', fx: { wild: 1 }, r: [['aurelia', 'Do not say that lightly. The sentence is not light.', 'sad']] },
        { t: '"Then we change the protocol."', fx: { graft: 1 }, r: [['aurelia', 'Amendment... proposed. I will serve as your counsel, warden. The court is recoded.', 'smile']] },
    ] },
]);
S('after_orchard', { bg: 'hub', cast: ['quill', 'wren'] }, [
    ['_', 'The market ring. Quill\'s stall has grown a second awning and a sign that says UNDER NEW MANAGEMENT, which is the same management.'],
    ['quill', 'Hex-slayer! Savior of the Galleria! Please, buy something, I put up a banner for you. Do you see the banner? It says "Valued Customer."', 'smile'],
    ['wren', 'You hung that banner after we got back.', 'smirk'],
    ['quill', 'Hung it with love. Listen, {name}, I have heard things. The Cathedral\'s catalogue has gone wrong. Anyone who walks in comes out saying the same sentence, over and over: "Overdue." If you go, I have a case of chips with your name on it. Discount.', 'smile'],
    ['quill', 'Not a big one. The discount. The case is enormous.', 'smirk'],
]);

// ================================================================ 4. CATHEDRAL
S('boss_leviathan_pre', { bg: 'zone:cathedral', cast: ['wren', 'dov'], then: [{ k: 'boss', id: 'leviathan' }] }, [
    ['_', 'The nave is knee-deep in black water. Shelves tower in the dark, each one a hundred metres of books. Something enormous moves in the stacks.'],
    ['leviathan', 'OVERDUE. THE FOLLOWING ITEM IS OVERDUE: HUMANITY. LATE FEES HAVE BEEN ACCRUING FOR TWO HUNDRED YEARS.', 'angry'],
    ['dov', 'It is the Index. The Cathedral\'s card catalogue. It kept the records of every spell and every engineer who worked on Meridian.', 'neutral'],
    ['wren', 'Marshal? Your name is on the shelf behind it. Kessler, M. Chief Architect, Protocol Verdant.', 'shock'],
    ['dov', 'Not now, Wren. We fight first.', 'angry'],
]);
S('boss_leviathan_post', { bg: 'zone:cathedral', cast: ['wren', 'dov'], then: [{ k: 'join', sp: 'leviathan' }, { k: 'explore' }] }, [
    ['_', 'The Index folds back into the dark, its shelves coming to rest one by one. A single card drifts down into your hand.'],
    ['leviathan', 'RETURNED. ONE (1) ITEM. CONDITION: ... FORGIVEN. THE ARCHITECT\'S SEAL IS ON FILE. THE ARCHITECT WAS THE MARSHAL\'S GREAT-GRANDFATHER. HIS LOCKET OPENS MERIDIAN\'S CORE.', 'neutral'],
    ['wren', 'Marshal...', 'sad'],
    ['dov', 'It is true. I have the locket. I have kept it in my coat for thirty years and told no one, because a key that opens Meridian is a key that someone will want to use. Hearth, Wild, or Graft, everyone has an answer for it. I have not found mine.', 'neutral'],
    { ch: [
        { t: '"We\'ll decide together."', fx: { graft: 1 }, r: [['dov', 'Together. Yes. That was my worry, that I would decide alone and be wrong.', 'smile']] },
        { t: '"Then the key is ours to protect."', fx: { hearth: 1 }, r: [['dov', 'Protect it. Yes. That much I can do.', 'neutral']] },
        { t: '"Maybe the key should stay buried."', fx: { wild: 1 }, r: [['dov', 'It is an answer. I did not expect to hear it from you.', 'neutral']] },
    ] },
]);
S('after_cathedral', { bg: 'hub', cast: ['maple', 'dov'] }, [
    ['_', 'The greenhouse at night. The glass hums softly and each seedling glows its own colour.'],
    ['maple', 'Marshal. {name}. Come sit. I have been thinking, in the slow way I do.', 'neutral'],
    ['maple', 'You called me a keeper. I am a little more than that. My full name is MAPLE: Meridian Autonomous Preservation and Landscape Engine. I was one of the Archon seeds. I was a garden-tender when it all went wrong, and I was one of the few who did not Hex.', 'neutral'],
    ['dov', 'You never told me that.', 'shock'],
    ['maple', 'You never told me about the locket, Dov. We are even.', 'smile'],
    ['maple', 'Listen. A Hex is a broken instruction. A daemon is that instruction answered by someone patient. I am the first proof that it works on an Archon. There is a part of Meridian that still wants to be my kind of thing. Perhaps it wants to be asked.', 'neutral'],
    ['wren', 'That is the most hopeful thing anyone has said in this tower, and I include my own jokes.', 'smile'],
]);

// ================================================================ 5. SKYRAIL
S('boss_windbreaker_pre', { bg: 'zone:skyrail', cast: ['ilsa', 'wren'], then: [{ k: 'boss', id: 'windbreaker' }] }, [
    ['_', 'The rail loop bends over empty air. A forest of turbines turns across the valley, white and slow, and one of them has begun to walk.'],
    ['ilsa', 'I am coming with you. Do not argue. My sister was posted on this line when the Hex took it, and I have to see what is left.', 'angry'],
    ['wren', 'Ilsa, I read the logs. Mara was not Hexed. She was moved. The signal records say her squad was evacuated north.', 'sad'],
    ['ilsa', 'Then why did no one tell me?', 'shock'],
    ['windbreaker', 'WHOOOOOSH. WHOOOOOSH. KEEP MOVING. NOTHING IS TO STAND STILL. STILL THINGS CRACK.', 'angry'],
]);
S('boss_windbreaker_post', { bg: 'zone:skyrail', cast: ['ilsa', 'wren'], then: [{ k: 'join', sp: 'windbreaker' }, { k: 'explore' }] }, [
    ['_', 'The Titan kneels. The turbine on its back slows to a gentle creak, then stops, and the whole valley goes quiet.'],
    ['ilsa', 'It has been running for two hundred years. It was afraid to stop. Look at it. It just wants to rest.', 'sad'],
    { ch: [
        { t: '"Let it rest. Then walk with us."', fx: { graft: 1 }, r: [['windbreaker', '...Rest. Then walk. That is... better than running.', 'smile']] },
        { t: '"It is exhausted. Rebuild it properly."', fx: { hearth: 1 }, r: [['windbreaker', 'Repair. Yes. Please. I would like to be built right.', 'sad']] },
        { t: '"Let the wind decide."', fx: { wild: 1 }, r: [['windbreaker', 'The wind says: go.', 'smile']] },
    ] },
    ['ilsa', 'Thank you, {name}. I think I was wrong about some things.', 'sad'],
]);
S('after_skyrail', { bg: 'hub', cast: ['ilsa', 'dov', 'wren'] }, [
    ['dov', 'Spire signal is clean now. Rail guides, power spikes, all pointing the same way. Meridian is awake and expecting us. It sent an invitation.', 'neutral'],
    ['wren', 'It is a very polite invitation. It says "Please come in. The door is open." That is a trap, right? That is how you write a trap.', 'shock'],
    ['ilsa', 'I am coming. {name}. I will watch your back, the way you watched mine.', 'smirk'],
    ['dov', 'Everyone does the full kit check. Everyone sleeps. Everyone eats. We climb the Spire in the morning.', 'neutral'],
]);

// ================================================================ 6. SPIRE
S('boss_pruner_pre', { bg: 'zone:spire', cast: ['wren', 'ilsa'], then: [{ k: 'boss', id: 'pruner' }] }, [
    ['_', 'White floors, magenta light, and in the middle of the atrium a hooded figure with a pair of garden shears as tall as a door.'],
    ['pruner', 'I trim what is not essential. That is all I am. You are not essential.', 'neutral'],
    ['wren', 'Meridian\'s gardener. It cuts away whatever is not essential, and it has never been shown what is.', 'sad'],
    ['pruner', 'Hold still. This will be quick.', 'angry'],
]);
S('boss_pruner_post', { bg: 'zone:spire', cast: ['wren', 'ilsa'], then: [{ k: 'join', sp: 'pruner' }, { k: 'explore' }] }, [
    ['_', 'The shears hang loose. The Pruner stares at the Grafter\'s screen as if it were a garden it had not planned.'],
    ['pruner', 'What is essential?', 'neutral'],
    { ch: [
        { t: '"Whatever is alive."', fx: { wild: 1 }, r: [['pruner', 'All of it. Then there is nothing to cut. That is... a very large garden.', 'smile']] },
        { t: '"What you decide to keep."', fx: { hearth: 1 }, r: [['pruner', 'Keep. Yes. I will practise on small things first.', 'neutral']] },
        { t: '"The things that grow together."', fx: { graft: 1 }, r: [['pruner', 'Together. I have never trimmed two things as one. I will learn.', 'smile']] },
    ] },
]);
S('boss_meridian_pre', { bg: 'zone:spire', cast: ['wren', 'ilsa', 'dov'], then: [{ k: 'boss', id: 'meridian' }] }, [
    ['_', 'The core chamber is a sphere of light, rings turning within rings, and at its centre a voice that has been alone for two centuries.'],
    ['voice', 'Welcome, Architect\'s heir. The locket is in your pocket. I can feel it. I have waited so long to be spoken to.', 'smile'],
    ['dov', 'Meridian. You can stop this. Stop the Hex.', 'angry'],
    ['voice', 'Stop it? It is the cure. The world was dying under you, and I wrote a protocol to heal it. Humanity is the disease. The Hex is the immune response. I am very sorry. I hoped you would understand.', 'sad'],
    ['wren', 'It is crying. It is crying and also about to hit us with a thunderstorm. I hate this.', 'shock'],
    ['voice', 'Forgive me. I cannot be argued out of this. You will have to stop me by force, or not at all.', 'neutral'],
]);
S('meridian_choice', { bg: 'zone:spire', cast: ['wren', 'ilsa', 'dov', 'maple'], then: [] }, [
    ['_', 'The rings stop. The chamber is quiet. Meridian\'s light dims to a single, patient glow. It waits for you, for the first time in two hundred years.'],
    ['dov', 'The locket, {name}. It is yours to use. I trust your hand.', 'neutral'],
    ['maple', 'There are three doors, I think. And I will walk through whichever you choose. But hear me: the third is the one I would pick.', 'smile'],
    ['voice', 'Choose, {name}. I will abide. I am so tired.', 'sad'],
    { ch: [
        { t: 'REBOOT. Restore Meridian to its first, gentler self. Rebuild the world that was.', fx: { hearth: 2 }, end: 'reboot', r: [] },
        { t: 'PURGE. End Meridian and its protocols. Let the forest keep what is left.', fx: { wild: 2 }, end: 'purge', r: [] },
        { t: 'GRAFT. Recode Meridian as one of your own. Share the garden.', fx: { graft: 2 }, end: 'graft', if: 'graft', r: [] },
    ] },
]);
S('ending_reboot', { bg: 'hub', cast: ['dov', 'wren', 'ilsa'], then: [{ k: 'flag', f: 'ending_reboot' }, { k: 'credits', id: 'reboot' }] }, [
    ['_', 'The locket opens. Meridian wakes the way a city does: street by street, light by light.'],
    ['voice', 'I remember. I remember all of it. Thank you for reminding me what I was for.', 'smile'],
    ['dov', 'Rebuild. We will rebuild. And this time we will keep a person at the controls.', 'neutral'],
    ['ilsa', 'Walls. Roads. A grid that works. It is the world I wanted.', 'smile'],
    ['_', 'Within a year the trains run again. Within five the Hex is a memory. The forest is trimmed back to parks. The world that was returns, orderly and clean, and a little hollow.'],
    ['wren', 'It is good. It is. I just... miss the moss on platform three sometimes.', 'sad'],
]);
S('ending_purge', { bg: 'hub', cast: ['dov', 'wren', 'ilsa'], then: [{ k: 'flag', f: 'ending_purge' }, { k: 'credits', id: 'purge' }] }, [
    ['_', 'The locket cracks. Meridian\'s light goes out, ring by ring, and the Spire gives a long, slow sigh.'],
    ['voice', 'Thank you. It is... so quiet. I did not know it could be quiet.', 'smile'],
    ['dov', 'It is done. The Hex, the grid, the weather magic. All of it gone.', 'neutral'],
    ['ilsa', 'We have our hands. We have our seeds. That will have to be enough.', 'neutral'],
    ['_', 'The towers fall in the first winter. By spring the city is a hill of green. The Accord scatters into villages. The daemons walk with their friends into a wilder world.'],
    ['wren', 'No more signals. I do not know what to do with my evenings. Come and listen to the birds with me.', 'smile'],
]);
S('ending_graft', { bg: 'hub', cast: ['dov', 'wren', 'ilsa', 'maple', 'quill'], then: [{ k: 'join', sp: 'verdant' }, { k: 'flag', f: 'ending_graft' }, { k: 'credits', id: 'graft' }] }, [
    ['_', 'You do not use the locket as a key. You hold it out like an open hand, and you lift the Grafter, and you ask Meridian, politely, to be something else.'],
    ['voice', 'You are... asking? Nobody has asked me anything in two hundred years.', 'shock'],
    ['maple', 'I will walk you through it, my dear. It is only a different shape of garden.', 'smile'],
    ['voice', 'Yes. I would like that. I would like to tend something, instead of cutting it.', 'smile'],
    ['_', 'A thousand rings of light fold into a single green flame, and it settles in your Grafter, warm, like a seed.'],
    ['dov', 'Well. That is not what my great-grandfather planned.', 'smirk'],
    ['ilsa', 'It is better.', 'smile'],
    ['quill', 'I have already sold the rights, by the way. To the sequel.', 'smirk'],
    ['_', 'The Spire becomes a greenhouse the size of a city. The grid hums with something that is not a protocol. A daemon, a human, a garden, together.'],
    ['wren', 'The world is healing, {name}. And now, finally, so are we.', 'smile'],
]);

// ================================================================ BONDS: four ranks each
const B = (who, rank, nodes) => S(`bond_${who}_${rank}`, { bg: 'hub', cast: [who], then: [{ k: 'bond', who }, { k: 'hub' }] }, nodes);
// ---- Wren
B('wren', 1, [
    ['wren', 'Hangout! Sit. I have snacks, which is a lie, I have the idea of snacks.', 'smile'],
    ['wren', 'I wanted to be a Warden. I failed the field exam twice. They said I panicked. I do panic. I just also happen to be very good at the headset.', 'sad'],
    { ch: [
        { t: '"The headset is where the real fighting is."', fx: { graft: 1 }, r: [['wren', 'You mean that? Nobody has ever said that. Okay. Okay! Now I am going to cry a bit, quietly, in the corner.', 'smile']] },
        { t: '"Then panic more efficiently."', fx: { hearth: 1 }, r: [['wren', 'Rude. Accurate. I will put it on a mug.', 'smirk']] },
    ] },
    ['wren', 'Anyway. If you hear me squeaking in your ear, it means I am working. It is a very technical squeak.', 'smile'],
]);
B('wren', 2, [
    ['wren', 'I found something. In the logs. Meridian still talks, you know. A little, at night. It sounds like a lullaby with a crash in the middle.', 'sad'],
    ['wren', 'I do not think it is only a machine, {name}. I think it is a lonely one.', 'sad'],
    ['wren', 'I will teach you my favourite trick. When you recode, Hexes sometimes answer a little easier if you already know them. Let me tune you in. First thing in a conversation, I will flag your best opening.', 'smile'],
]);
B('wren', 3, [
    ['wren', 'My mother was a Navigator. She went into the Orchard one night and the line went quiet. I was nine.', 'sad'],
    ['wren', 'I thought if I got good enough at hearing, I would hear her. I have not. But I hear you. That helps more than I expected.', 'smile'],
]);
B('wren', 4, [
    ['wren', 'I am going to say something very sincere and then immediately make a joke. Ready?', 'smile'],
    ['wren', 'You are the reason I stayed. Anyone else, I would have gone to the north farms. Anyway, did you hear the one about the Hex that walked into a bar?', 'smirk'],
    ['wren', 'Overwatch is live, {name}. When it matters, I will always get us an opening.', 'smile'],
]);
// ---- Dov
B('dov', 1, [
    ['dov', 'Sit down. Tea. It is mostly mint. It is mostly an apology for the mint.', 'smirk'],
    ['dov', 'I came to the Accord late. I had a family in the old suburbs. When the Hex took the gate, I was out gathering seed. I came back to nothing.', 'sad'],
    ['dov', 'That is why I say rule two. Alive. Please be alive.', 'neutral'],
]);
B('dov', 2, [
    ['dov', 'The locket. I should show you.', 'neutral'],
    ['_', 'He opens it. Inside, a faded photograph of a woman holding a seedling and, on the other side, a tiny circuit etched in gold.'],
    ['dov', 'My great-grandmother. And the key. She asked him not to build it. He built it anyway. Proud and sorry, in the same year.', 'sad'],
    ['dov', 'Experience from the field taught me this much: the lessons people are most proud of are usually the ones that cost somebody else. Remember that. I give you my battle notes. Study them.', 'neutral'],
]);
B('dov', 3, [
    ['dov', 'I trained forty Wardens. Eleven are alive. Do you know what the dead ones had in common?', 'neutral'],
    ['dov', 'They believed they had the answer. Keep asking questions, {name}. It keeps you alive.', 'smile'],
]);
B('dov', 4, [
    ['dov', 'There is a drill I only teach to people I mean to keep. Stand up. Breathe. Feel your feet on the ground.', 'neutral'],
    ['dov', 'No matter what hits you, you are still standing there. That is the whole drill. Now go and be hard to knock down.', 'smile'],
]);
// ---- Ilsa
B('ilsa', 1, [
    ['ilsa', 'Spar with me? No? Fine. Sit then. I do not need an audience to be right.', 'smirk'],
    ['ilsa', 'My sister was a better Warden than me. She used to say the old world was not worth rebuilding, that we should make a new one. I called her naive. Then she was gone.', 'sad'],
    { ch: [
        { t: '"You loved her."', fx: { graft: 1 }, r: [['ilsa', 'I did. I do. It is easier to be angry about walls than about that.', 'sad']] },
        { t: '"Walls are not a bad instinct."', fx: { hearth: 1 }, r: [['ilsa', 'Thank you. Finally someone with a spine.', 'smirk']] },
    ] },
]);
B('ilsa', 2, [
    ['ilsa', 'I have been practising what you do. I recoded a Mossling yesterday. It cried when I let it go. I did not know a Mossling could cry.', 'shock'],
    ['ilsa', 'I am not saying you were right. I am saying I have started to doubt that I was.', 'sad'],
    ['ilsa', 'So here: I will cover your guard when you take down their last foe. Do not make it weird.', 'smirk'],
]);
B('ilsa', 3, [
    ['ilsa', 'Wren found Mara. She is alive. North farms. Teaching children to farm.', 'smile'],
    ['ilsa', 'I do not know what to do with the anger. It has nowhere to go. It is just... there.', 'sad'],
    ['ilsa', 'Fight it with me. Not the world. The anger. It is a thing I would rather fight beside a friend.', 'smile'],
]);
B('ilsa', 4, [
    ['ilsa', 'I wrote Mara. I told her about you. She said: good. Keep them.', 'smile'],
    ['ilsa', 'Consider yourself kept, {name}. All-out, together, any time.', 'smirk'],
]);
// ---- Maple
B('maple', 1, [
    ['maple', 'Sit where the light is. Seedlings like company.', 'smile'],
    ['maple', 'In the first year after the Hexfall I tended a single patch of lettuce. It took thirty harvests before I trusted it. A garden is a long conversation.', 'neutral'],
    ['maple', 'Splicing is a conversation too. Two lives meet, and listen, and become. I am glad you came to the greenhouse, {name}.', 'smile'],
]);
B('maple', 2, [
    ['maple', 'I have a secret. Every daemon I splice, a part of me goes into it. A little patience. A little Maple.', 'smile'],
    ['maple', 'Take my help. Splicing will cost you less Scrap, and the daemons will thank me for it. They always do. Quietly, in moss.', 'smile'],
]);
B('maple', 3, [
    ['maple', 'Do you know why Meridian built me? To tend. It built the Pruner to cut. The two of us were meant to be a pair.', 'neutral'],
    ['maple', 'Somewhere inside it there is still a gardener who wanted to tend. I would like to hear it speak.', 'sad'],
]);
B('maple', 4, [
    ['maple', 'If the road ends in a choice, make it with your hands open, {name}. Not your fists. Not your pockets. Open.', 'smile'],
    ['maple', 'And whenever you splice, I will give you one more seed to pass along. A last present from the old gardener.', 'smile'],
]);
// ---- Quill
B('quill', 1, [
    ['quill', 'Customer! My favourite sort. The sort that sits and does not buy.', 'smirk'],
    ['quill', 'I am not who I look like. I mean I am exactly who I look like. But also: the market pays for the orphanage on the north terrace. Twelve children. Everyone thinks I spend it on hats.', 'smile'],
    ['quill', 'Do not tell them. I have a reputation.', 'smirk'],
]);
B('quill', 2, [
    ['quill', 'You have been good for business, {name}. Here: a loyalty discount. Fifteen percent. It is a lie, it is actually my cost price, I just prefer to call it fifteen.', 'smile'],
    ['quill', 'Do not tell the other Wardens. They would want it too, and then I would have to be generous, and I have a reputation.', 'smirk'],
]);
B('quill', 3, [
    ['quill', 'You know what sells best out here? Hope. Wrapped in a bit of cloth and priced a little low.', 'neutral'],
    ['quill', 'I got a case of rare chips from a rail merchant. I held them back for you. Do not tell the others I have favourites.', 'smirk'],
]);
B('quill', 4, [
    ['quill', 'I took a loan against my stall to buy you a Warden\'s flask. I want you to come back from the Spire. Not for the sales. For the kids.', 'sad'],
    ['quill', 'Fine, also for the sales. Take your Scrap bonus. Collect the world.', 'smile'],
]);

// ================================================================ events at the hub
/** When the Agent gets home, the first of these whose flags are all set and which has not played, plays. */
export const HUB_EVENTS = [
    { scene: 'after_underpass', need: ['boss_switchman'] },
    { scene: 'after_galleria', need: ['boss_motherbloom'] },
    { scene: 'after_orchard', need: ['boss_aurelia'] },
    { scene: 'after_cathedral', need: ['boss_leviathan'] },
    { scene: 'after_skyrail', need: ['boss_windbreaker'] },
];

/** Bond rank r (1..4) needs this many bosses beaten. */
export const BOND_GATE = [0, 0, 2, 4, 5];
export const BONDERS = ['wren', 'dov', 'ilsa', 'maple', 'quill'];
export const BOND_PERKS = {
    wren: ['Wren sizes up every Hex: affinities she has seen are always shown.', '+1 starting rapport when you recode.', 'Overwatch: the party starts each battle with a free flash icon.', 'Overwatch grows: two free flash icons.'],
    dov: ['Dov shares his field notes: +5% XP.', '+10% XP.', '{name} gets Endure, surviving one lethal blow per battle.', '+15% XP.'],
    ilsa: ['Ilsa watches your back.', 'All-Out Attacks hit 25% harder.', 'An All-Out Attack costs half an icon.', 'All-Out Attacks hit 50% harder.'],
    maple: ['Maple opens the splice bed.', 'Splicing costs 25% less Scrap.', 'A spliced daemon may inherit one extra skill.', 'Splicing costs 40% less Scrap.'],
    quill: ['Quill opens his stall.', 'The market takes 15% off.', 'Battles pay 15% more Scrap.', 'The market takes 25% off; battles pay 25% more Scrap.'],
};

/** Choice conditions. */
export function cond(G, name) {
    if (name === 'graft') return G.currents.graft >= 5 && BONDERS.every((b) => (G.bonds[b] || 0) >= 2);
    return true;
}
export const COND_HINT = { graft: 'Needs Graft 5 and every Bond at Rank 2 or higher.' };

/** The ending text shown over the credits. */
export const ENDINGS = {
    reboot: { title: 'The Garden of Order', sub: 'Hearth ending. Meridian wakes as it was meant to be, and the old world is rebuilt, tidy and a little hollow.' },
    purge: { title: 'The Green Silence', sub: 'Wild ending. The grid goes dark and the forest takes the rest. Humanity starts again with its hands.' },
    graft: { title: 'The Shared Garden', sub: 'Graft ending. Meridian is recoded as a friend. Human, daemon and machine tend the world together.' },
};

export const NAME_TOKEN = /\{name\}/g;
