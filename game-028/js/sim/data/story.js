// Every conversation and scene. A tree is { start, nodes }; a node is
//   { who, mood, text, next, choices: [{ t, next, cond, act }], routes: [{ cond, next }], act: [[verb, arg]], cond,
//     bg, cg, card, music }
// `who` is a cast id (data/cast.js) or 'n' for the narrator. A node with `routes` shows nothing and jumps to the
// first route whose condition holds (else to `next`). A node with a false `cond` is skipped. `next: 'end'` closes.
// Acts: quest done give take flag chapter join shop rest gold heal ending   (js/sim/game.js runAct)
// Conditions: ch>=N  q:quest (active)  qd:quest (done)  qok:quest (objectives met)  f:flag  has:item:n  party:id
//   joined with & (and) and | (or); a leading ! negates one term.
//
// Every spoken line is voiced: dev/audio/voices.mjs walks these trees, and js/voicekey.js names each clip.

export const TREES = {
    // ------------------------------------------------------------------ prologue
    intro: { start: 'a', nodes: {
        a: { who: 'n', cg: 'prologue', music: 'title', text: 'Three weeks ago the Aethermoor Academy burned. Its masters died in the fire, or so the songs say.', next: 'b' },
        b: { who: 'n', text: 'One apprentice ran into the night with a scroll she had copied by candlelight: a prophecy about the Lich sealed beneath the Academy\'s older ruins.', next: 'c' },
        c: { who: 'n', text: 'It named her. She has not stopped running since.', next: 'd' },
        d: { who: 'n', bg: 'thornhaven', music: 'village', card: 'Chapter 1 · The Road to Thornhaven', text: 'At the edge of the Thornwood, the village of Thornhaven lights its lamps.', next: 'e' },
        e: { who: 'lyra', mood: 'sad', text: 'I left the scroll behind. In the Academy, in the fire. If anyone else reads it...', next: 'f' },
        f: { who: 'lyra', text: 'No. One thing at a time. A bed, a meal, and then the ruins. The old Academy is just west of the forest path.', next: 'g' },
        g: { who: 'lyra', mood: 'fierce', text: 'Whatever that prophecy says about me, I will read it with my own eyes before anyone tells me what I am.', act: [['quest', 'lyras_past']], next: 'h' },
        h: { who: 'n', text: 'The village elder\'s house stands to the north-west. Lamps are lit in the window. Someone is waiting up.', next: 'end' },
    } },

    // ------------------------------------------------------------------ Thornhaven
    varec: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'q:the_missing_merchant&f:borin_found', next: 'report' },
            { cond: 'q:the_missing_merchant', next: 'remind' },
            { cond: 'ch>=4', next: 'ch4' },
            { cond: 'ch>=3', next: 'ch3' },
            { cond: 'ch>=2', next: 'ch2' },
        ], next: 'greet' },
        greet: { who: 'varec', text: 'A traveller, out of the Thornwood at this hour? Come in from the dark, child. The stars must have sent you; we are in need of someone brave.', choices: [
            { t: 'What troubles the village?', next: 'troubles' },
            { t: 'I\'m only passing through.', next: 'passing' },
        ] },
        troubles: { who: 'varec', mood: 'worried', text: 'Borin, our merchant, went down the Thornwood road three days ago and never came back. Bandits have grown bold this season. Bolder than bandits should be.', choices: [
            { t: 'I\'ll find Borin.', next: 'accept', act: [['quest', 'the_missing_merchant']] },
            { t: 'Tell me about Aethermoor.', next: 'aether' },
        ] },
        aether: { who: 'varec', text: 'The Academy studied the Aether, the raw magic that binds the worlds. Its first headmaster tried to bind it to himself. They sealed what was left of him under the old ruins, south of the forest. Lately the seals feel... thin.', next: 'troubles' },
        accept: { who: 'varec', text: 'Bless you. The bandits camp in a clearing east of the forest path, past the burnt trees. Take care of yourself, and bring him home.', next: 'end' },
        passing: { who: 'varec', text: 'Then rest at the Ember Hearth and go with our thanks. But if you change your mind, Thornhaven could use a friend.', next: 'end' },
        remind: { who: 'varec', mood: 'worried', text: 'Any word of Borin? The bandits\' camp is east of the Thornwood path, walled in by thorn trees.', next: 'end' },
        report: { who: 'varec', mood: 'worried', text: 'Borin lives! But "the Lich\'s hand", directing bandits? Then the seals are not merely thin. Something below is reaching out.', act: [['flag', 'told_varec'], ['done', 'the_missing_merchant']], next: 'report2' },
        report2: { who: 'varec', text: 'Thornhaven owes you more than gold. Listen: the forest itself is sickening. The old spirit of the World Tree lives east of the Thornwood path. If anyone understands this corruption, she does.', next: 'report3' },
        report3: { who: 'varec', text: 'And take a sword arm with you. A knight came into the village tonight; he is in the square asking after the ruins. I think you two want the same thing.', act: [['chapter', 2]], next: 'card2' },
        card2: { who: 'n', card: 'Chapter 2 · Roots and Oaths', text: 'The road east into the Thornwood is open now, and something in the square is waiting for you.', next: 'end' },
        ch2: { who: 'varec', text: 'The World Tree Grove lies east, along the Thornwood path. Sylvara, the old spirit, will know what poisons her roots. Go carefully.', next: 'end' },
        ch3: { who: 'varec', mood: 'worried', text: 'The southern path to the Aethermoor ruins is open. I feel it in my bones at night, child: something down there is awake and listening.', next: 'end' },
        ch4: { who: 'varec', text: 'Whatever happens below, Thornhaven will keep a lamp lit for you. Come home.', next: 'end' },
    } },

    holt: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'qd:slime_infestation', next: 'farewell' },
            { cond: 'q:slime_infestation&has:slime_core:3', next: 'turn_in' },
            { cond: 'q:slime_infestation', next: 'remind' },
        ], next: 'greet' },
        greet: { who: 'holt', text: 'Oh, thank the gods, a proper adventurer! Slimes, miss. Slimes out of the Thornwood, eating my turnips down to the stalks!', choices: [
            { t: 'I\'ll clear them out.', next: 'accept', act: [['quest', 'slime_infestation']] },
            { t: 'Sorry, not my problem.', next: 'refuse' },
        ] },
        accept: { who: 'holt', text: 'Bring me three of their cores, if you would. The Elder keeps a ledger, and he won\'t believe it without proof. I can\'t pay much, but I\'ll pay.', next: 'end' },
        refuse: { who: 'holt', text: 'Fine. Fine! I\'ll fight them off with a pitchfork, then. Again.', next: 'end' },
        remind: { who: 'holt', text: 'Three slime cores, miss. They wobble about the Thornwood like they own it.', next: 'end' },
        turn_in: { who: 'holt', text: 'Three cores! You did it! Here, take this, and an old vest of mine. It\'s kept the rain off me for twenty years.', act: [['take', { slime_core: 3 }], ['done', 'slime_infestation']], next: 'end' },
        farewell: { who: 'holt', text: 'Not a slime in sight. My little ones won\'t go hungry this winter, thanks to you.', next: 'end' },
    } },

    marta: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'q:pelts_for_the_forge&has:wolf_pelt:3', next: 'turn_in' },
        ], next: 'greet' },
        greet: { who: 'marta', text: 'Need steel? You\'ve come to the right forge. None of that bandit junk here.', choices: [
            { t: 'Show me your wares.', next: 'shop', act: [['shop', 'forge']] },
            { t: 'Do you need anything?', next: 'job', cond: '!q:pelts_for_the_forge&!qd:pelts_for_the_forge' },
            { t: 'About those pelts...', next: 'remind', cond: 'q:pelts_for_the_forge' },
            { t: 'Just looking.', next: 'bye' },
        ] },
        shop: { who: 'marta', text: 'Mind the sparks.', next: 'end' },
        job: { who: 'marta', text: 'Wolf pelts. Three of them, for the bellows and for lining armour. The wolves in the Thornwood have gone mean this year. Bring me three and I\'ll forge you a blade worth carrying.', choices: [
            { t: 'Deal.', next: 'deal', act: [['quest', 'pelts_for_the_forge']] },
            { t: 'Maybe later.', next: 'bye' },
        ] },
        deal: { who: 'marta', text: 'Good. Don\'t get bitten.', next: 'end' },
        remind: { who: 'marta', text: 'Three pelts. Wolves. Teeth. You know the ones.', next: 'end' },
        turn_in: { who: 'marta', text: 'Fine pelts. Here: a steel longsword, folded twelve times. It wants a knight\'s hand, but it\'ll sell, if you have no knight.', act: [['take', { wolf_pelt: 3 }], ['done', 'pelts_for_the_forge']], next: 'end' },
        bye: { who: 'marta', text: 'Door\'s behind you.', next: 'end' },
    } },

    aldric: { start: 'greet', nodes: {
        greet: { who: 'aldric', text: 'Welcome to the Ember Hearth! A hot meal and a soft bed, thirty gold for the whole party. Shall I make up the rooms?', choices: [
            { t: 'Rest for the night (30 gold).', next: 'rest', act: [['rest']] },
            { t: 'Show me your supplies.', next: 'shop', act: [['shop', 'inn']] },
            { t: 'Any news?', next: 'news' },
            { t: 'Not now.', next: 'bye' },
        ] },
        rest: { routes: [{ cond: 'f:rested', next: 'rested' }], next: 'broke' },
        rested: { who: 'aldric', text: 'Sleep well! Tomorrow\'s troubles can wait for tomorrow. Your journal is safe with me, too; I\'ve written down where you\'ve been.', act: [['flag', '-rested']], next: 'end' },
        broke: { who: 'aldric', text: 'Ah. A bit short tonight, are we? Sell some of those pelts at the forge and come back. The stew will keep.', next: 'end' },
        shop: { who: 'aldric', text: 'Potions, ethers, antidotes. Everything a hero forgets to pack.', next: 'end' },
        news: { routes: [{ cond: 'ch>=3', next: 'news3' }, { cond: 'ch>=2', next: 'news2' }], next: 'news1' },
        news1: { who: 'aldric', text: 'Farmer Holt\'s at war with the slimes again, and Marta wants wolf pelts. If you\'re handy with a blade, there\'s coin in both.', next: 'end' },
        news2: { who: 'aldric', text: 'Folk say the forest east of the path is glowing at night. Pretty, if it weren\'t so purple.', next: 'end' },
        news3: { who: 'aldric', text: 'The cold wind\'s coming up from the south now. Nobody\'s sleeping well. Except you lot, I hope.', next: 'end' },
        bye: { who: 'aldric', text: 'The fire\'s always lit.', next: 'end' },
    } },

    borin_shop: { start: 'greet', nodes: {
        greet: { who: 'borin', text: 'My rescuers! Borin\'s Wares is open for business again, and for you, the friendly price. Which is the normal price. But friendlier!', choices: [
            { t: 'Let\'s trade.', next: 'shop', act: [['shop', 'borin']] },
            { t: 'Any rumours?', next: 'rumour' },
            { t: 'Later, Borin.', next: 'bye' },
        ] },
        shop: { who: 'borin', text: 'Feathers, potions, ethers! All genuine. Mostly.', next: 'end' },
        rumour: { who: 'borin', text: 'Those Lich Shards that drift through the forest now? Smash one and you\'ll sometimes find a soul gem inside. Nasty things. Valuable things!', next: 'end' },
        bye: { who: 'borin', text: 'Mind the bandits! Ha. You don\'t need to.', next: 'end' },
    } },

    // ------------------------------------------------------------------ the Thornwood
    lore_scorch: { start: 'a', nodes: {
        a: { who: 'n', text: 'The trees here are scorched black in long streaks, as if cold fire had raked through them.', next: 'b' },
        b: { who: 'lyra', mood: 'sad', text: 'This isn\'t a forest fire. That\'s Aether, burned wrong. The same light I saw in the Academy windows.', next: 'end' },
    } },

    ambush: { start: 'a', nodes: {
        a: { who: 'n', text: 'Two bandits step out of the thorn trees, blades already drawn.', next: 'b' },
        b: { who: 'n', text: '"Another one for the hand," one of them mutters. "Take her alive if you can."', next: 'end' },
    } },

    borin: { start: 'a', nodes: {
        a: { who: 'borin', text: 'You found me! Oh, sweet mercy. They took my coin, my goods, my good hat. Not this hat. This is my bad hat.', next: 'b' },
        b: { who: 'borin', text: 'Listen. They weren\'t ordinary bandits. They kept talking about "the Lich\'s hand", like it was a person. Somebody\'s paying them to watch the roads.', next: 'c' },
        c: { who: 'lyra', mood: 'sad', text: 'Watching for what?', next: 'd' },
        d: { who: 'borin', text: 'For a girl with silver hair, coming from the Academy. Er. That\'s you, isn\'t it?', next: 'e' },
        e: { who: 'lyra', mood: 'fierce', text: 'Then I\'d better see Elder Varec before they try again. Can you make it back to the village?', next: 'f' },
        f: { who: 'borin', text: 'I\'ll set up shop in the square the moment I\'m home. Come and see me. Rescuers get the friendly price!', act: [['flag', 'borin_found']], next: 'end' },
    } },

    sera: { start: 'a', nodes: {
        a: { who: 'sera', text: 'Careful. The wolves moved east again, and something worse is drifting with them. You\'re heading deeper in. Want a guide who knows where the roots trip you?', choices: [
            { t: 'Please. We need someone who knows this forest.', next: 'join', act: [['join', 'sera']] },
            { t: 'Who are you?', next: 'who' },
            { t: 'We\'ll manage.', next: 'refuse' },
        ] },
        who: { who: 'sera', text: 'Sera. Ranger, once, of the Thornwood Conclave. They exiled me for walking with humans, so now I walk with humans. It\'s worked out.', choices: [
            { t: 'Then walk with us.', next: 'join', act: [['join', 'sera']] },
            { t: 'Another time.', next: 'refuse' },
        ] },
        join: { who: 'sera', mood: 'smile', text: 'Good. Stay behind me, keep quiet when I raise my hand, and don\'t step on anything purple.', next: 'banter' },
        banter: { who: 'orin', cond: 'party:orin', text: 'An elf with a sense of humour. The Thornwood is full of surprises.', next: 'banter2' },
        banter2: { who: 'sera', mood: 'smile', cond: 'party:orin', text: 'And a knight with one. Truly, the end times.', next: 'end' },
        refuse: { who: 'sera', text: 'Brave or foolish. In the Thornwood it\'s hard to tell the difference. I\'ll be here.', next: 'end' },
    } },

    orin: { start: 'a', nodes: {
        a: { who: 'orin', text: 'You\'re the one the Elder told me about. The girl from the Academy. I\'m heading for the ruins myself, and the road is long for one sword.', choices: [
            { t: 'Then come with me.', next: 'join', act: [['join', 'orin']] },
            { t: 'Why the ruins?', next: 'why' },
            { t: 'I work alone.', next: 'refuse' },
        ] },
        why: { who: 'orin', text: 'I was a knight of the Solarian Order. Our commander, Korvas, made a bargain with something in the ruins and ordered us to guard its road. I refused. They stripped my emblem and cast me out.', next: 'why2' },
        why2: { who: 'orin', mood: 'angry', text: 'The oath they broke, I still keep. Protect the innocent. Whatever stirs under Aethermoor, the innocent are in its way.', choices: [
            { t: 'Then we keep it together.', next: 'join', act: [['join', 'orin']] },
            { t: 'Not yet.', next: 'refuse' },
        ] },
        join: { who: 'orin', text: 'Ha. I hoped you\'d say that. I take the front; you stay behind my shield. Where do we start?', next: 'join2' },
        join2: { who: 'lyra', mood: 'happy', text: 'East, to the World Tree. And thank you, Orin.', next: 'end' },
        refuse: { who: 'orin', text: 'As you wish. I\'ll be in the square. The dark ahead is not a thing to face alone.', next: 'end' },
    } },

    // ------------------------------------------------------------------ the Academy
    academy_enter: { start: 'a', nodes: {
        a: { who: 'n', text: 'The Academy\'s lecture hall lies open to the sky, its dome cracked like an egg. Wisps of loose Aether drift between the pillars.', next: 'b' },
        b: { who: 'lyra', mood: 'sad', text: 'I sat in that row. Third from the front. We used to throw ink pellets at the statue of the headmaster.', next: 'c' },
        c: { who: 'lyra', text: 'The divination hall is through the north wall. If the scroll survived, it\'s there.', next: 'end' },
    } },
    academy_lectern: { start: 'a', nodes: {
        a: { who: 'n', text: 'A scorched lectern still holds an open book, its pages fused to ash.', next: 'b' },
        b: { who: 'lyra', mood: 'sad', text: 'This is where I copied it. The night before the fire. I hid the copy in the west alcove, behind the shelf. Please, please still be there.', next: 'end' },
    } },
    academy_scroll: { start: 'a', nodes: {
        a: { who: 'n', text: 'Wrapped in oilcloth behind a fallen shelf: a scroll, sealed in violet wax. Untouched by the fire.', next: 'b' },
        b: { who: 'lyra', mood: 'sad', text: '"When the third seal wanes, the one who reads this shall be the key: to wake the sleeper, or to end him." It\'s real. It\'s all real.', next: 'c' },
        c: { who: 'lyra', mood: 'fierce', text: 'A key opens doors in both directions. Fine. Then I choose which way it turns.', next: 'end' },
    } },

    // ------------------------------------------------------------------ the World Tree
    grove_enter: { start: 'a', nodes: {
        a: { who: 'n', text: 'The thorns give way to soft grass and air that tastes of rain. At the centre of the grove stands a tree older than any kingdom.', next: 'b' },
        b: { who: 'n', text: 'Three of its great roots pulse with violet veins, like poison in a wound.', next: 'end' },
    } },

    sylvara: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'qd:broken_oath', next: 'after' },
            { cond: 'q:broken_oath', next: 'oath_remind' },
            { cond: 'qd:spirit_of_the_wood&party:orin', next: 'oath' },
            { cond: 'qd:spirit_of_the_wood', next: 'need_orin' },
            { cond: 'q:spirit_of_the_wood&f:anchor_1&f:anchor_2&f:anchor_3', next: 'turn_in' },
            { cond: 'q:spirit_of_the_wood', next: 'remind' },
        ], next: 'greet' },
        greet: { who: 'sylvara', mood: 'sad', text: 'Mortals. You carry the smell of lich-shadow on you. But also light. You are not enemies of the forest.', next: 'plea' },
        plea: { who: 'sylvara', mood: 'sad', text: 'The corruption seeps up from the ruins and into three of my roots. I cannot cleanse them myself. A soul gem pressed into each root would draw the poison out.', choices: [
            { t: 'I\'ll cleanse the roots.', next: 'accept', act: [['quest', 'spirit_of_the_wood']] },
            { t: 'Where do I find soul gems?', next: 'gems' },
            { t: 'What are you?', next: 'what' },
        ] },
        gems: { who: 'sylvara', text: 'The Lich Shards that drift through the Thornwood are splinters of his will. Break one and, often enough, a gem of his stolen power falls out.', next: 'plea' },
        what: { who: 'sylvara', text: 'The voice of the World Tree, child. My roots drink from every ley line in this land. If I fall, the Thornwood\'s magic dies with me.', next: 'plea' },
        accept: { who: 'sylvara', text: 'Bless you. The roots that ache are the ones veined with violet: two beside my trunk, one in the southern glade.', next: 'end' },
        remind: { who: 'sylvara', mood: 'sad', text: 'Some of my roots still ache. A soul gem for each; the Shards in the Thornwood carry them.', next: 'end' },
        turn_in: { who: 'sylvara', text: 'I feel it. All three are clean. The poison recedes, and I can breathe again. Take this, with the forest\'s gratitude.', act: [['flag', 'told_sylvara'], ['done', 'spirit_of_the_wood']], next: 'r2' },
        r2: { routes: [{ cond: 'party:orin', next: 'oath' }], next: 'need_orin' },
        need_orin: { who: 'sylvara', text: 'One more thing troubles me. A name echoes from the chapel beyond my southern roots: Korvas. An iron-hearted knight in your village carries that name like a wound. Bring him to me.', next: 'end' },
        oath: { who: 'sylvara', text: 'Knight. I hear a name in your heart that echoes from the shattered chapel beyond my southern roots: Korvas. He is there, and he is no longer a man.', next: 'oath2' },
        oath2: { who: 'orin', mood: 'angry', text: 'Korvas. Then the Order\'s bargain was with the Lich himself. I should have stopped him years ago.', next: 'oath3' },
        oath3: { who: 'sylvara', text: 'I will part my roots. Go with care. What waits there wears your old commander\'s face, but it does not remember mercy.', act: [['quest', 'broken_oath']], next: 'end' },
        oath_remind: { who: 'sylvara', text: 'The path south lies open. The chapel waits, and so does he.', next: 'end' },
        after: { who: 'sylvara', text: 'The wood breathes easier because of you. Walk safely, friends of the forest.', next: 'end' },
    } },

    anchor_need: { start: 'a', nodes: {
        a: { who: 'n', text: 'The root throbs with violet poison. It needs a soul gem to draw the corruption out.', next: 'end' },
    } },
    anchor_wait: { start: 'a', nodes: {
        a: { who: 'n', text: 'The root throbs with a sick violet light. The spirit of this grove may know what it needs.', next: 'end' },
    } },
    anchor_done: { start: 'a', nodes: {
        a: { who: 'n', text: 'You press the soul gem into the bark. The violet veins flare, then drain away like ink in water, and the root glows a clean, living green.', next: 'end' },
    } },

    // ------------------------------------------------------------------ the chapel
    chapel_enter: { start: 'a', nodes: {
        a: { who: 'n', text: 'The chapel of the Solarian Order. Its great sun window is shattered, and violet rot crawls over the pews.', next: 'b' },
        b: { who: 'orin', mood: 'angry', text: 'This is where they stripped my emblem. Korvas will be at the altar. He always liked the altar.', next: 'end' },
    } },
    korvas_before: { start: 'a', nodes: {
        a: { who: 'korvas', text: 'Orin. My most stubborn knight. Did you come back to kneel?', next: 'b' },
        b: { who: 'orin', mood: 'angry', text: 'I came back to finish what you started when you sold the Order to a corpse.', next: 'c' },
        c: { who: 'korvas', text: 'Sold? I was promised forever. The Lich keeps his word. Look at me. I cannot die.', next: 'd' },
        d: { who: 'lyra', mood: 'fierce', text: 'Everything can die. Even promises.', next: 'end' },
    } },
    korvas_after: { start: 'a', nodes: {
        a: { who: 'n', cg: 'korvas', text: 'Korvas falls to his knees. The violet fire burns out of his armour, and underneath it is only an old, tired man.', next: 'b' },
        b: { who: 'korvas', text: 'Orin. It\'s quiet. I had forgotten it could be quiet.', next: 'c' },
        c: { who: 'korvas', text: 'The seal under Aethermoor. Three shards held it, and he broke two through us. The scholar in the ruins knows the rest. Stop him. Please.', next: 'd' },
        d: { who: 'orin', text: 'Rest, commander. I\'ll keep the oath for both of us.', next: 'e' },
        e: { who: 'n', card: 'Chapter 3 · The Sealed Sanctum', bg: 'chapel', text: 'The southern path out of the Thornwood is open now. It leads down to the Aethermoor ruins.', act: [['chapter', 3], ['flag', 'korvas_defeated']], next: 'end' },
    } },

    // ------------------------------------------------------------------ the ruins
    ruins_enter: { start: 'a', nodes: {
        a: { who: 'n', text: 'The ruins of old Aethermoor sprawl under a storm that never breaks. Cyan crystals grow from the cracks like frost.', next: 'b' },
        b: { who: 'lyra', mood: 'sad', text: 'The first Academy. Before it was an academy. Before it was a tomb.', next: 'end' },
    } },

    aneth: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'ch>=4', next: 'ch4' },
            { cond: 'q:the_third_shard&has:soul_gem:2&has:elder_scroll:1', next: 'turn_in' },
            { cond: 'q:the_third_shard&has:soul_gem:2', next: 'no_scroll' },
            { cond: 'q:the_third_shard', next: 'remind' },
        ], next: 'greet' },
        greet: { who: 'aneth', text: 'Lyra? Lyra of the third row, who threw ink at the headmaster\'s statue? You lived! Oh, child, sit down before I cry on you.', next: 'greet2' },
        greet2: { who: 'lyra', mood: 'happy', text: 'Mistress Aneth! I thought everyone had... I thought I was the only one.', next: 'explain' },
        explain: { who: 'aneth', text: 'There is no time for tea, sadly. The seal on the Sanctum was held by three lich shards. Two were broken by the Order\'s treachery. The third is the seal itself.', next: 'explain2' },
        explain2: { who: 'aneth', text: 'To break it, we need two soul gems to resonate with it, and the one thing that was written to open it: your prophecy. The scroll names its reader as the key.', choices: [
            { t: 'Then we break it, and end him.', next: 'accept', act: [['quest', 'the_third_shard']] },
            { t: 'Who was the Lich?', next: 'lore' },
        ] },
        lore: { who: 'aneth', text: 'Vaelthas. Our first headmaster. He tried to bind the Aether to his own soul so he could never die. The other masters could not destroy him, so they sealed him and built the Academy on top, as a guard. And then forgot why.', next: 'explain2' },
        accept: { who: 'aneth', text: 'The Shards in these halls carry gems. Bring me two, and the scroll. And Lyra... whatever is down there knows your name.', next: 'end' },
        remind: { who: 'aneth', text: 'Two soul gems and the Elder Scroll. The Shards drift through these halls; the golems are slow, so mind your footing and you\'ll be fine.', next: 'end' },
        no_scroll: { who: 'aneth', mood: 'worried', text: 'The gems are perfect, but the seal won\'t answer to them alone. It needs the Elder Scroll, from the Academy ruins west of the Thornwood path.', next: 'end' },
        turn_in: { who: 'aneth', text: 'The gems, and the scroll. Hold it up, Lyra. Read the line that names you. Out loud.', next: 'read' },
        read: { who: 'lyra', mood: 'fierce', cg: 'seal', text: '"The one who reads this shall be the key." I am reading it. And I am choosing: open.', act: [['take', { soul_gem: 2 }], ['flag', 'seal_broken'], ['done', 'the_third_shard']], next: 'break2' },
        break2: { who: 'aneth', text: 'It\'s breaking! The seal, the whole sanctum is... Gods help us, I can feel him waking.', next: 'break3' },
        break3: { who: 'aneth', bg: 'ruins', text: 'The sanctum doors stand open to the south. Something heavy guards them now. Take this robe; it was mine, when I was young and foolish enough to go adventuring.', next: 'break4' },
        break4: { who: 'aneth', text: 'I\'ll keep the ruins clear for your return, and sell you what I carry. Go, and end what my order began.', act: [['chapter', 4], ['quest', 'echoes_end']], next: 'card4' },
        card4: { who: 'n', card: 'Chapter 4 · Echoes End', text: 'Below the ruins, the Sanctum waits.', next: 'end' },
        ch4: { who: 'aneth', text: 'Do you need supplies? I have potions and feathers. Take what you need, and come back alive.', choices: [
            { t: 'Show me.', next: 'shop', act: [['shop', 'aneth']] },
            { t: 'We\'re ready.', next: 'ready' },
        ] },
        shop: { who: 'aneth', text: 'Pay what you like. No, pay what\'s on the tag. Old habits.', next: 'end' },
        ready: { who: 'aneth', text: 'Then go. I\'ll be here.', next: 'end' },
    } },

    thane: { start: 'a', nodes: {
        a: { who: 'thane', text: 'You\'re here for the Lich. I can feel his resonance from here; it stirs every time the seal is touched. Don\'t look at me like that. I am not your enemy.', choices: [
            { t: 'Then help us.', next: 'join', act: [['join', 'thane']] },
            { t: 'How can we trust you?', next: 'trust' },
        ] },
        trust: { who: 'thane', mood: 'sad', text: 'You can\'t. Not entirely. I was bound to a demon once, Kaelthas. I broke the bond, and it left this brand. The darkness still clings, but I aim it now. Against something worse.', choices: [
            { t: 'Good enough. Come with us.', next: 'join', act: [['join', 'thane']] },
            { t: 'We\'ll face him without you.', next: 'refuse' },
        ] },
        join: { who: 'thane', text: 'Then let\'s end this. I\'ve waited a long time for a chance to do one thing right.', next: 'banter' },
        banter: { who: 'sera', mood: 'smile', cond: 'party:sera', text: 'He smells like a bonfire. I like him already.', next: 'end' },
        refuse: { who: 'thane', mood: 'sad', text: 'Admirable stubbornness. I\'ll be here if the Lich proves more than you bargained for.', next: 'end' },
    } },

    gate_golems: { start: 'a', nodes: {
        a: { who: 'n', text: 'Two hulks of masonry lurch upright before the open sanctum doors, runes blazing cyan.', next: 'end' },
    } },

    // ------------------------------------------------------------------ the Sanctum
    sanctum_enter: { start: 'a', nodes: {
        a: { who: 'n', text: 'The Sanctum is a vault so vast the braziers cannot find its ceiling. On the dais, something tall unfolds itself from a broken throne.', next: 'b' },
        b: { who: 'vaelthas', text: 'Little key. You came. I wrote that line two hundred years ago, and I was so sure you would.', next: 'c' },
        c: { who: 'lyra', mood: 'fierce', text: 'You wrote the prophecy?', next: 'd' },
        d: { who: 'vaelthas', text: 'Who else? Come closer. Let me see the face of the one who sets me free.', next: 'end' },
    } },
    lich_before: { start: 'a', nodes: {
        a: { who: 'vaelthas', text: 'Your teachers sealed me under their pretty school and forgot. But I left a door, and a key, and I waited for someone curious enough to read.', next: 'b' },
        b: { who: 'lyra', mood: 'fierce', text: 'The scroll said I could wake you, or end you. You forgot to say which one I\'d choose.', next: 'c' },
        c: { who: 'orin', cond: 'party:orin', text: 'Stay behind my shield, Lyra.', next: 'd' },
        d: { who: 'sera', cond: 'party:sera', text: 'I\'ve got the big ugly one. Obviously.', next: 'e' },
        e: { who: 'thane', cond: 'party:thane', text: 'Your kind made me what I am, lich. Let me return the favour.', next: 'f' },
        f: { who: 'vaelthas', text: 'Then let us find out together.', next: 'end' },
    } },
    lich_after: { start: 'a', nodes: {
        a: { who: 'n', music: 'ending', text: 'The Lich staggers. His crown cracks, and the cyan fire pours out of him like water from a broken jar.', next: 'b' },
        b: { who: 'vaelthas', text: 'Two hundred years of waiting. And still the key turns the wrong way.', next: 'c' },
        c: { who: 'vaelthas', text: 'The Aether will not keep me now. But the scroll remembers me, little key. Everything I was, I wrote into it. Burn it, and I am truly gone. Keep it, and the world remembers what I did.', next: 'd' },
        d: { who: 'n', text: 'He is dust before the last word. The scroll is warm in Lyra\'s hands.', next: 'choice' },
        choice: { who: 'lyra', text: 'Burn it, and he\'s forgotten. Keep it, and nobody forgets what he cost us.', choices: [
            { t: 'Remember. Keep the scroll, and the warning in it.', next: 'remember', act: [['ending', 'remember']] },
            { t: 'Release. Burn the scroll, and him with it.', next: 'release', act: [['ending', 'release']] },
        ] },
        remember: { who: 'lyra', mood: 'fierce', text: 'I\'ll keep it. Not for you. So that no one ever builds a school on top of a tomb and forgets again.', next: 'end' },
        release: { who: 'lyra', text: 'Then let it burn. You don\'t get to live on in anything. Not even a story.', next: 'end' },
    } },

    end_remember: { start: 'a', nodes: {
        a: { who: 'n', cg: 'end-remember', music: 'ending', text: 'Dawn comes through a crack in the Sanctum\'s vault for the first time in two hundred years.', next: 'b' },
        b: { who: 'n', text: 'Lyra carries the scroll back to Thornhaven. In the years that follow, she rebuilds the Academy on open ground, far from any tomb, and its first lesson is the story of Vaelthas.', next: 'c' },
        c: { who: 'n', cond: 'party:orin', text: 'Orin rides to the Solarian capital with Korvas\'s sword, and the Order is remade under its old oath.', next: 'd' },
        d: { who: 'n', cond: 'party:sera', text: 'Sera returns to the Conclave. This time, they listen.', next: 'e' },
        e: { who: 'n', cond: 'party:thane', text: 'Thane teaches the Academy\'s darkest class: how to say no to a bargain. It is always full.', next: 'f' },
        f: { who: 'n', text: 'And on the first stone of the new Academy, someone carves a line: remember what it cost.', next: 'end' },
    } },
    end_release: { start: 'a', nodes: {
        a: { who: 'n', cg: 'end-release', music: 'ending', text: 'On a cliff above the Thornwood, the scroll burns away in Lyra\'s hand, and the sparks drift up into the morning.', next: 'b' },
        b: { who: 'n', text: 'No one writes the Lich\'s name again. In a generation, he is a story told to frighten apprentices. In two, not even that.', next: 'c' },
        c: { who: 'n', cond: 'party:orin', text: 'Orin hangs up his sword in Thornhaven and becomes the worst fisherman the river has ever known.', next: 'd' },
        d: { who: 'n', cond: 'party:sera', text: 'Sera stays. Somebody has to show the village children where the roots trip you.', next: 'e' },
        e: { who: 'n', cond: 'party:thane', text: 'Thane\'s brand fades a little more each year. He stops counting.', next: 'f' },
        f: { who: 'n', text: 'And Lyra, for the first time since the fire, sleeps through the night.', next: 'end' },
    } },

    // ------------------------------------------------------------------ system scenes
    chest_empty: { start: 'a', nodes: { a: { who: 'n', text: 'The chest is empty.', next: 'end' } } },
    defeat: { start: 'a', nodes: {
        a: { who: 'n', bg: 'inn', text: 'Darkness. Then firelight, and the smell of stew.', next: 'b' },
        b: { who: 'aldric', text: 'Easy, easy! A woodcutter carried you all in. You were lucky. I took what you owed from your purse; don\'t argue, you\'d do the same.', next: 'end' },
    } },
};
