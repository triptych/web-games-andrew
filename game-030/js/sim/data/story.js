// Every conversation and scene. A tree is { start, nodes }; a node is
//   { who, mood, text, next, choices: [{ t, next, cond, act }], routes: [{ cond, next }], act: [[verb, arg]], cond,
//     bg, cg, card, music }
// `who` is a cast id (data/cast.js) or 'n' for the narrator. A node with `routes` shows nothing and jumps to the
// first route whose condition holds (else to `next`). A node with a false `cond` is skipped. `next: 'end'` closes.
// Acts: quest done give take flag join shop rest gold heal ending   (js/sim/game.js runActs)
// Conditions: q:quest (active)  qd:quest (done)  qok:quest (objectives met)  f:flag  has:item:n  party:id
//   done:eventId  gold:n   joined with & (and) and | (or); a leading ! negates one term.
//
// Every spoken line (anyone but the narrator) is voiced: dev/audio/voices.mjs walks these trees, and
// js/voicekey.js names each clip.

export const TREES = {
    // ------------------------------------------------------------------ prologue
    intro: { start: 'a', nodes: {
        a: { who: 'n', cg: 'title', music: 'title', text: 'Coppergate Lane is the kind of place where the clocks run a little fast, the kettles run a little hot, and everything with a spring in it has opinions.', next: 'b' },
        b: { who: 'n', bg: 'lane', music: 'lane', card: 'Coppergate Lane', text: 'You arrived this morning with a toolbag, a spare scone and no particular plans. The lane had other ideas.', next: 'c' },
        c: { who: 'wick', text: 'Right. New town, new start. I will keep my head down and not fix anything that is not broken.', next: 'd' },
        d: { who: 'n', text: 'Somewhere nearby, a very loud voice shouts your name. So much for that.', next: 'end' },
    } },

    // ------------------------------------------------------------------ Trina
    trina: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'q:side_scraps&has:scrap:5', next: 'scraps_done' },
            { cond: 'f:gear_returned', next: 'after' },
            { cond: 'f:bertha_down', next: 'bertha_tip' },
            { cond: 'f:briefed', next: 'briefed' },
            { cond: 'q:main_gear', next: 'remind' },
        ], next: 'greet' },
        greet: { who: 'trina', mood: 'excited', text: 'There you are! I knew it was you. That squeaky floorboard gives everyone away. Wick, we have a crisis.', next: 'g2' },
        g2: { who: 'trina', text: 'Mayor Pilcrow\'s Golden Gear has gone missing, right out of its case in the Hall. He has been wailing since breakfast, and it is very bad for business.', next: 'g3' },
        g3: { who: 'wick', text: 'Gears do not just walk off by themselves.', next: 'g4' },
        g4: { who: 'trina', mood: 'excited', text: 'My point exactly! Go and hear him out. The Hall is the big building to the south-west. And I could use five bits of scrap metal, too.', choices: [
            { t: 'What are you building?', next: 'build' },
            { t: 'Leave it with me.', next: 'accept', act: [['quest', 'main_gear'], ['quest', 'side_scraps']] },
        ] },
        build: { who: 'trina', text: 'Something marvellous. It has gears, a kettle, and possibly a small cannon. Do not tell Mabel about the cannon.', next: 'g4' },
        accept: { who: 'trina', text: 'Splendid. Scrap is easy to find: the critters out in the Whistling Wilds are practically made of it. Cog Sprites, Rust Crabs, you name it.', next: 'accept2' },
        accept2: { who: 'trina', text: 'And mind yourself out there. A wrench is a fine thing, but nobody ever regretted a second pair of hands.', next: 'end' },
        remind: { who: 'trina', text: 'Have you seen the Mayor yet? The Hall is south-west of here. Mind the steps, they are wobbly.', next: 'end' },
        briefed: { who: 'trina', text: 'Bertha? Big Bertha?! Oh, that is bad. That is very bad. She is a clanking brute who lives at the end of Gutter Gully, past the Whistling Wilds.', next: 'briefed2' },
        briefed2: { who: 'trina', text: 'Level up a little first. And bring scrap, always bring scrap. Come to think of it, I should come along. Somebody has to keep an eye on you.', cond: '!party:trina', next: 'briefed3' },
        briefed3: { who: 'trina', text: 'Five scraps and I am yours. Well. Yours for a week or so. I do get bored.', cond: '!party:trina', next: 'end' },
        scraps_done: { who: 'trina', mood: 'excited', text: 'Five scraps, just like that! You marvel. Here, I finished it: a Spark Rod. Zap responsibly.', act: [['take', { scrap: 5 }], ['done', 'side_scraps'], ['join', 'trina']], next: 'sd2' },
        sd2: { who: 'wick', text: 'Thank you, Trina. It is lovely. Slightly warm, though.', next: 'sd3' },
        sd3: { who: 'trina', text: 'That is the cannon. I mean, the coil. Anyway! I am coming with you. Someone has to keep you from tightening things that should stay loose.', next: 'end' },
        bertha_tip: { who: 'trina', text: 'You got it back from Bertha? Take it to the Mayor right now, before it hums itself to bits.', next: 'end' },
        after: { who: 'trina', text: 'The lane has never been so quiet. I may build a louder clock.', next: 'end' },
    } },

    // ------------------------------------------------------------------ Mabel
    mabel: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'q:side_kettle&has:kettle', next: 'kettle_back' },
            { cond: 'f:gear_returned', next: 'after' },
            { cond: 'q:side_kettle', next: 'remind' },
        ], next: 'greet' },
        greet: { who: 'mabel', text: 'Oh, thank goodness, a friendly face. A nasty Rust Crab dragged my copper kettle off to Gutter Gully, and without it I cannot brew a thing.', next: 'g2' },
        g2: { who: 'mabel', text: 'No brewing, no scones. It is a catastrophe of pastry. The Gully is south of the Whistling Wilds. Bring my kettle home, dear, and the ovens are yours.', choices: [
            { t: 'I will find your kettle.', next: 'accept', act: [['quest', 'side_kettle']] },
            { t: 'A crab? How big?', next: 'big' },
        ] },
        big: { who: 'mabel', text: 'Big enough to carry a kettle, and cross enough to keep it. Bring a friend. Or a cosh.', next: 'g2' },
        accept: { who: 'mabel', text: 'Bless you. And do keep some tea in your pockets. Chamomile, for the nerves. Bertram sells it, the old skinflint.', next: 'end' },
        remind: { who: 'mabel', text: 'Mind the crabs down in the Gully, dear. They pinch.', next: 'end' },
        kettle_back: { who: 'mabel', text: 'My kettle! Oh, you wonderful thing! A dent, and a bit of rust. Nothing a good scrub will not mend. Here, scones, on the house.', act: [['take', { kettle: 1 }], ['done', 'side_kettle'], ['join', 'mabel']], next: 'kb2' },
        kb2: { who: 'mabel', text: 'Now. I have been stuck in that bakery for forty years, and I have just discovered I miss an adventure. I am coming with you.', next: 'kb3' },
        kb3: { who: 'wick', text: 'Are you sure? There are a lot of crabs.', next: 'kb4' },
        kb4: { who: 'mabel', text: 'Dear, I have a rolling pin and no patience left. Let them come.', next: 'end' },
        after: { who: 'mabel', text: 'Fresh scones today, love. You have earned first pick.', next: 'end' },
    } },

    // ------------------------------------------------------------------ Mayor Pilcrow
    pilcrow: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'has:goldgear', next: 'return' },
            { cond: 'f:gear_returned', next: 'after' },
            { cond: 'f:briefed', next: 'remind' },
        ], next: 'brief' },
        brief: { who: 'pilcrow', text: 'Ah. A new face. You must be the one the whole lane has been whispering about. Forgive the state of me. I am quite undone.', next: 'b2' },
        b2: { who: 'pilcrow', text: 'The Golden Gear has been in my family six generations. It sat in that glass case every day of my life. Last night: gone. One loose floorboard and a trail of oil.', next: 'b3' },
        b3: { who: 'wick', text: 'A trail of oil? Where does it lead?', next: 'b4' },
        b4: { who: 'pilcrow', text: 'South, through the Whistling Wilds and down into Gutter Gully. There is only one creature that clanks enough to leave a trail like that: Big Bertha.', next: 'b5' },
        b5: { who: 'pilcrow', text: 'She lairs behind an iron door at the end of the Gully. Take this brass pass, it opens the door, and do be careful. She hits a good deal harder than she looks.', act: [['give', { lairkey: 1 }], ['flag', 'briefed'], ['quest', 'main_gear'], ['chapter', 2]], next: 'b6' },
        b6: { who: 'wick', text: 'Leave it with me, Mayor. I will bring it home.', next: 'b7' },
        b7: { who: 'pilcrow', text: 'Splendid. Win a few fights on the way, there is no shame in it. Bertha is stronger than anything in the Wilds.', next: 'end' },
        remind: { who: 'pilcrow', text: 'Bertha lairs behind the iron door at the end of Gutter Gully, my friend. A few victories under your belt first would be wise.', next: 'end' },
        return: { who: 'pilcrow', text: 'My Golden Gear! You magnificent soul. It hums. It has not hummed in six generations.', act: [['take', { goldgear: 1 }], ['flag', 'gear_returned'], ['done', 'main_gear']], next: 'r2' },
        r2: { who: 'wick', text: 'Bertha only wanted something that ticked like a heart. Perhaps she could visit the lane for tea.', next: 'r3' },
        r3: { who: 'pilcrow', text: 'Tea? With Big Bertha? Hm. Hm! Why ever not. Coppergate always had room for one more odd neighbour.', act: [['ending', 'cozy']], next: 'end' },
        after: { who: 'pilcrow', text: 'The lane sleeps easy, thanks to you.', next: 'end' },
    } },

    // ------------------------------------------------------------------ Bertram
    bertram: { start: 'r', nodes: {
        r: { routes: [
            { cond: 'q:side_springs&has:spring:3', next: 'springs_done' },
            { cond: 'f:met_bertram', next: 'menu' },
        ], next: 'greet' },
        greet: { who: 'bertram', text: 'Hm. Customer. Do not touch the clock, it is broken. Do not touch the cat, it is worse.', act: [['flag', 'met_bertram']], next: 'menu' },
        menu: { who: 'bertram', text: 'What can I do for you?', choices: [
            { t: 'Let me see your wares.', next: 'shop', act: [['shop', 'bertram']] },
            { t: 'Is there a bed upstairs? (20 gold)', next: 'rest', cond: 'gold:20', act: [['rest', 20]] },
            { t: 'Anything I can help with?', next: 'springs_ask', cond: '!q:side_springs&!qd:side_springs' },
            { t: 'Just looking.', next: 'bye' },
        ] },
        shop: { who: 'bertram', text: 'Mind the tea. It is better than it looks.', next: 'end' },
        rest: { who: 'bertram', text: 'Second door on the left. Do not wind the cuckoo.', next: 'rest2' },
        rest2: { who: 'n', text: 'You sleep like a dropped sprocket. The party is rested.', next: 'end' },
        springs_ask: { who: 'bertram', text: 'The shop clock stopped last week. It needs three Coiled Springs, and the wolves in the Gully carry them. If you bring me some, I will make it worth your while.', choices: [
            { t: 'I will find them.', next: 'springs_ok', act: [['quest', 'side_springs']] },
            { t: 'Maybe later.', next: 'bye' },
        ] },
        springs_ok: { who: 'bertram', text: 'Hm. Good. Do not dawdle.', next: 'end' },
        springs_done: { who: 'bertram', text: 'Three springs. Not a hair out of place. Here, take this: a lucky charm my grandmother swore by. Nobody has ever proved her wrong.', act: [['take', { spring: 3 }], ['done', 'side_springs']], next: 'sd2' },
        sd2: { who: 'bertram', text: 'The clock is ticking again. That is the loudest thing in my life, and I am delighted.', next: 'end' },
        bye: { who: 'bertram', text: 'Hm. Door is that way.', next: 'end' },
    } },

    // ------------------------------------------------------------------ places
    wilds_hello: { start: 'a', nodes: {
        a: { who: 'n', bg: 'wilds', text: 'The Whistling Wilds hum with loose bolts and distant ticking. Cog Sprites flit through the long grass, and something in the pond clanks.', next: 'b' },
        b: { who: 'wick', text: 'Scrap everywhere. Trina would be thrilled. Everything out here is a bit too keen to be friends, though.', next: 'end' },
    } },
    gully_hello: { start: 'a', nodes: {
        a: { who: 'n', bg: 'gully', text: 'Gutter Gully is where the lane\'s broken things end up: heaps of scrap, rusting pipes, and a great many pairs of glowing eyes.', next: 'b' },
        b: { who: 'wick', text: 'A kettle in all this? Mabel did say a crab dragged it. At least the crab has taste.', next: 'end' },
    } },

    // ------------------------------------------------------------------ fixed fights
    bandit_ambush: { start: 'a', nodes: {
        a: { who: 'n', text: 'Two Lane Bandits step out from behind a boulder, tin whistles in their teeth. "Your purse or your pockets, friend!"', next: 'b' },
        b: { who: 'wick', text: 'Neither, thank you. I only just unpacked.', next: 'end' },
    } },
    kettle_crab: { start: 'a', nodes: {
        a: { who: 'n', text: 'A Rust Crab squats at the mouth of a rocky nook, clutching something copper and shiny. Two Cog Sprites buzz around it like guards.', next: 'b' },
        b: { who: 'wick', text: 'That is Mabel\'s kettle. Sorry, crab. It is a good kettle, but it is not yours.', next: 'end' },
    } },
    kettle_found: { start: 'a', nodes: {
        a: { who: 'n', text: 'Dented, a little rusty, but whole. Mabel will be thrilled.', next: 'end' },
    } },

    bertha_meet: { start: 'a', nodes: {
        a: { who: 'n', bg: 'lair', text: 'The iron door groans open on a cavern of humming pipes and heaped scrap. In the middle sits a huge clanking figure, hugging something gold to its chest.', next: 'b' },
        b: { who: 'bertha', text: 'WHO IS THAT, STOMPING IN MY LAIR?', next: 'c' },
        c: { who: 'wick', text: 'Wick, from Coppergate Lane. Hello, Bertha. I think you have the Mayor\'s Golden Gear.', next: 'd' },
        d: { who: 'bertha', text: 'MINE! It hums at night! Nobody else hums at night! I will not give it back!', next: 'e' },
        e: { who: 'trina', mood: 'excited', cond: 'party:trina', text: 'Oh, I like her. Ow! Do not hit me yet, I have not finished my sentence!', next: 'f' },
        f: { who: 'mabel', cond: 'party:mabel', text: 'Now, now, dear. Put the gear down. Nobody needs to get cross.', next: 'g' },
        g: { who: 'bertha', text: 'TOO LATE. I AM ALREADY CROSS. COME AND TAKE IT, TINY WRENCH-PERSON!', next: 'end' },
    } },
    bertha_win: { start: 'a', nodes: {
        a: { who: 'bertha', text: 'Ow. Ow, ow, ow. Fine! Fine. Take it. It was getting a bit loud anyway.', next: 'b' },
        b: { who: 'n', text: 'The Golden Gear lies in the oil-stained straw, humming softly, the way a purring cat hums.', act: [['give', { goldgear: 1 }], ['flag', 'bertha_down']], next: 'c' },
        c: { who: 'wick', text: 'Why take it, Bertha? You could have just asked.', next: 'd' },
        d: { who: 'bertha', text: 'Nobody ever talks to me. Everybody runs. It hummed, and I was lonely. That is all.', next: 'e' },
        e: { who: 'mabel', cond: 'party:mabel', text: 'Oh, you poor lamb. Come down to the lane when you can. I will put the kettle on.', next: 'f' },
        f: { who: 'trina', cond: 'party:trina', text: 'And I will teach you to build your own humming thing. Gently. With fewer fists.', next: 'g' },
        g: { who: 'bertha', text: 'Really? Tea? Humming things? Oh. Oh, that is... all right, then.', next: 'h' },
        h: { who: 'n', text: 'Back to the Mayor, then. The lane has waited long enough.', next: 'end' },
    } },

    // ------------------------------------------------------------------ after a wipe, and the ending
    defeat: { start: 'a', nodes: {
        a: { who: 'n', text: 'Everything goes grey, and then warm. You wake on the flour sacks outside the bakery. Somebody has dragged you home, and somebody else has charged you for the trouble.', next: 'end' },
    } },

    end_cozy: { start: 'a', nodes: {
        a: { who: 'n', cg: 'ending', music: 'ending', card: 'Coppergate Lane', text: 'The Golden Gear goes back into its glass case. It hums, very softly, all night. Nobody on the lane sleeps better than that week.', next: 'b' },
        b: { who: 'n', text: 'Big Bertha comes down on Thursday for tea, ducking under the signpost and apologising to the cat.', next: 'c' },
        c: { who: 'n', cond: 'party:trina', text: 'Trina builds her a small humming thing of her own. It is mostly a toaster. Bertha loves it.', next: 'd' },
        d: { who: 'n', cond: 'party:mabel', text: 'Mabel bakes scones the size of hubcaps, and serves them with the dented kettle, which she refuses to ever repair.', next: 'e' },
        e: { who: 'n', text: 'And you? You came to Coppergate Lane to keep your head down. Somehow, in a single week, you have become the one the whole lane calls handy.', next: 'end' },
    } },
};
