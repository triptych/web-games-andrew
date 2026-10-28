// The story: speakers, clues, the six days, every scene. Pure data.
//
// A scene is a list of lines: { w: speaker, t: text, clue?, flag?, credits?, when?, ask? }.
//   clue    puts a card on the case board    flag  remembers something    when  shows the line only if true
//   ask     [{ t, flag, next }] a choice; `next` is another scene id
// A scene's `then` says where to go afterwards: 'shop', 'brief', 'day:N', 'endday', 'ending', 'credits'.

export const SPEAKERS = {
    narr:     { name: '', style: 'narr' },
    you:      { name: 'You', style: 'you' },
    spanner:  { name: 'Spanner', look: 'spanner', voice: 520 },
    mama:     { name: 'Mama Okoye', look: 'mama', voice: 300 },
    dex:      { name: 'Dex "Static" Moreau', look: 'dex', voice: 380 },
    takeda:   { name: 'Officer Takeda', look: 'takeda', voice: 260 },
    sol:      { name: 'Dr. Imre Sól', look: 'sol', voice: 230 },
    lila:     { name: 'Lila-9', look: 'lila', voice: 440 },
    corwith:  { name: 'Mr. Corwith', look: 'corwith', voice: 200 },
    barnacle: { name: 'Old Barnacle', look: 'barnacle', voice: 180 },
    teo:      { name: 'Teodor Vale', look: 'teo', voice: 240 },
    walk:     { name: '', look: 'walk', voice: 330 },
};

export const CLUES = {
    note:     { title: 'Dad\'s note', day: 1, text: 'Left under the soldering stand: "Kit, keep the lamp on. Fix things properly. And don\'t do any work for a woman in a grey coat. Love, T."' },
    greycoat: { title: 'The grey coat', day: 1, text: 'Mama Okoye saw a woman in a grey coat asking who had keys to the shop, the week Dad vanished. Shoes too clean for Lowtide.' },
    order0:   { title: 'Work Order #0', day: 1, text: 'Dad\'s last job card. Item: "THE KEY". Notes: "Needs a resonator. Do NOT deliver. Hide the pieces in machines nobody can sell."' },
    witness:  { title: 'Dock Nine', day: 2, text: 'Dex saw two suits and an old man in a long coat walking the quay at Dock Nine the night Dad vanished. It did not look like a social call.' },
    tag:      { title: 'Locker tag L-9', day: 2, text: 'A brass tag taped under a controller board: L-9. A locker number, probably at Dock Nine.' },
    corwith:  { title: 'Mr. Corwith', day: 2, text: 'Meridian Compliance came for a "friendly walk-through". Every machine on the Reach carries a Meridian governor. Removing one is "a licensing matter".' },
    leash:    { title: 'The governor', day: 3, text: 'MER-GOV: a Meridian Governor Module, fitted at the factory. Dad called them leashes. A tiny chip that listens for a signal.' },
    closed:   { title: 'Case closed', day: 3, text: 'Dad\'s missing-person file was closed as "voluntary departure", signed by a Meridian liaison, above Takeda\'s pay grade.' },
    locker:   { title: 'Locker L-9', day: 4, text: 'Takeda opened the locker quietly: a salvage slip for BARGE LANTERN, BERTH 9, signed "T.V.", and a tin of old solder.' },
    hush:     { title: 'The Hush', day: 4, text: 'Dr. Sól: a Meridian broadcast that freezes every governed machine and limb at once. His arm froze at 3 a.m., the hour Dad vanished.' },
    shunt:    { title: 'Dad\'s shunts', day: 5, text: 'A chip stamped "T.V." sits in Lila-9\'s eye: a shunt that looks like a governor but listens to nothing. Dad has been freeing machines one at a time.' },
    barge:    { title: 'Barge Lantern', day: 5, text: 'Old Barnacle says Dad is alive, hiding on the Lantern, and needs the last piece of the Key: the resonator, hidden where nobody would sell it.' },
    resonator:{ title: 'Spanner\'s secret', day: 5, text: 'The resonator is inside Spanner. Dad hid the last piece of the Key in the one machine nobody in the shop would ever sell.' },
    crystal:  { title: 'Memory crystal', day: 6, text: 'A crystal wrapped in a cloth under Spanner\'s personality board. Dad\'s last message, recorded for you.' },
};

export const TIPS = {
    bench:   'Orbit by dragging bare bench, zoom with the wheel. Pick a tool below, then hold it on a screw.',
    screws:  'Hold on a screw to turn it. Drag along the panel to chain screws. Screws go into the dish by themselves.',
    lift:    'Parts only come out when nothing holds or covers them. Drop one near its slot to snap it back in.',
    carry:   'Quick tap picks a part up and sticks it to the cursor. Tap again to put it down.',
    wires:   'Pull a plug with your hands. Its colour and letter match its socket.',
    probe:   'Hold the meter on a part to read it. Some failures are invisible until you do.',
    solder:  'Hold the iron on a joint and keep the heat in the green. Too hot and it burns.',
    brush:   'Scrub back and forth to clear grime. Oil frees stiff gears and rusted bolts.',
    spare:   'The spares drawer holds the part you need and some you do not. Read the labels.',
    test:    'Everything back where it belongs? Run the power test.',
    stash:   'Something was hidden in there. That is not a factory part.',
    gov:     'A governor chip. You can pull it out with tweezers. Meridian would call that a licensing matter.',
};

// ------------------------------------------------------------------ the week
// jobs: story jobs have `id` and scenes; `walk` jobs are generated customers.
export const DAYS = [
    { n: 1, title: 'Open for Business', open: 'd1_open', close: 'd1_close', jobs: [
        { id: 'mama', who: 'mama', kind: 'noodlebot', tier: 1, pre: 'mama_pre', post: 'mama_post', pay: 1.4, faults: [{ role: 'fuse', type: 'burnt' }], panels: 1 },
        { walk: true, tier: 1 },
    ] },
    { n: 2, title: 'Static', open: 'd2_open', close: 'd2_close', jobs: [
        { id: 'dex', who: 'dex', kind: 'hovercoil', tier: 2, pre: 'dex_pre', post: 'dex_post', pay: 1.4, stash: { role: 'board', label: 'Locker tag L-9', clue: 'tag' } },
        { walk: true, tier: 2 },
    ] },
    { n: 3, title: 'Blue Division', open: 'd3_open', close: 'd3_close', jobs: [
        { id: 'takeda', who: 'takeda', kind: 'blaster', tier: 3, pre: 'takeda_pre', post: 'takeda_post', pay: 1.4, gov: true },
        { walk: true, tier: 2 },
    ] },
    { n: 4, title: 'The Hush', open: 'd4_open', close: 'd4_close', jobs: [
        { id: 'sol', who: 'sol', kind: 'cyberarm', tier: 3, pre: 'sol_pre', post: 'sol_post', pay: 1.5, gov: true },
        { walk: true, tier: 3 },
    ] },
    { n: 5, title: 'Lantern', open: 'd5_open', close: 'd5_close', jobs: [
        { id: 'lila', who: 'lila', kind: 'cybereye', tier: 4, pre: 'lila_pre', post: 'lila_post', pay: 1.5, gov: true, stash: { role: 'board', label: 'Chip stamped "T.V."', clue: 'shunt' } },
        { id: 'barnacle', who: 'barnacle', kind: 'drone', tier: 3, pre: 'barnacle_pre', post: 'barnacle_post', pay: 1.3 },
    ] },
    { n: 6, title: 'The Key', open: 'd6_open', close: 'd6_close', jobs: [
        { id: 'spanner', who: 'spanner', kind: 'spanner', tier: 5, pre: 'spanner_pre', post: 'spanner_post', pay: 2, stash: { role: 'board', label: 'Memory crystal', clue: 'crystal' } },
    ] },
];

// ------------------------------------------------------------------ scenes
const S = (w, t, extra) => Object.assign({ w, t }, extra || {});

export const SCENES = {
    intro: { then: 'day:1', lines: [
        S('narr', 'Perihelion Reach, the Lowtide ring. It has been raining for eleven years. The climate machines broke when Meridian took the contract, and nobody has ever been paid to fix them.'),
        S('narr', 'Twenty-three days ago your father, Teodor Vale, locked up the shop at nine in the evening and did not come home.'),
        S('narr', 'Yesterday the Registry sent a letter: absent, presumed gone, estate transferred. One workshop. One neon sign. One debt you have not yet had the nerve to read.'),
        S('you', 'All right, Dad. Let\'s see what you left me.'),
    ] },

    d1_open: { then: 'shop', lines: [
        S('spanner', '*click... whirr.* Bench lamp online. Oh. Oh, it is you. Kit.'),
        S('spanner', 'Twenty-three days, four hours. I counted. I was told to keep counting.'),
        S('you', 'Spanner. Where is he?'),
        S('spanner', 'Unknown. He said, "keep the lamp on." He was very specific about the lamp.'),
        S('spanner', 'There is a note under the soldering stand. Bench first, boss. Customers second. Mystery third.', { clue: 'note' }),
        S('spanner', 'Your first customer is early. Mama Okoye\'s noodle-bot has eaten a fuse. She is not a patient woman. Ring the bell when you are ready.'),
    ] },
    mama_pre: { then: 'brief', lines: [
        S('mama', 'Kit! Look at you, thin as a chopstick. Your father would be ashamed.'),
        S('mama', 'My ladle-bot died in the middle of the lunch rush. Forty bowls, cold. Forty!'),
        S('you', 'I\'ll take a look.'),
        S('mama', 'Fix it and the broth is on me. Teo always said: open it slowly, and put everything back in the order it came out.'),
        S('spanner', 'Tutorial, boss: screws come out, parts come out, and it all goes back the way it came. The bench will show you.'),
    ] },
    mama_post: { then: 'shop', lines: [
        S('mama', 'It is humming! Listen to that little motor!'),
        S('mama', 'Your father fixed my roof once. Asked for nothing. Do you know who else came by the week he vanished? A woman in a grey coat. Asked who had keys to the shop.', { clue: 'greycoat' }),
        S('you', 'A grey coat?'),
        S('mama', 'Shoes too clean for Lowtide. I did not like her. Come for noodles on Sunday.'),
    ] },
    d1_close: { then: 'endday', lines: [
        S('spanner', 'Day one. Two machines fixed, one clue, zero flooded floors. A record.'),
        S('you', 'What is in the drawer, Spanner? The one that sticks.'),
        S('spanner', 'Work Order Zero. Teo\'s last job card. The customer line is blank.', { clue: 'order0' }),
        S('you', 'The Key. What key?'),
        S('spanner', 'I do not know. That is the honest answer, and I would like it noted that I do not enjoy giving it.'),
    ] },

    d2_open: { then: 'shop', lines: [
        S('spanner', 'Courier on the doorstep. Dex Moreau, called "Static". He owes Teo money, or the other way round. I lost track.'),
        S('spanner', 'Hover-coil. Mind the fuse. And, boss: when something is taped to the inside of a machine, it is not a factory part.'),
    ] },
    dex_pre: { then: 'brief', lines: [
        S('dex', 'Kit! Oh, stars, you look like him. Don\'t tell me that. Sorry.'),
        S('dex', 'My board dropped dead over the Gutters this morning. Another metre up and I would be a stain.'),
        S('dex', 'Your dad said if anything happened I should bring the coil to you. Wouldn\'t say why.'),
        S('you', 'If anything happened?'),
        S('dex', 'The night he vanished I was running a parcel to Dock Nine. Two suits and an old man in a long coat on the quay. Your dad, I think. It did not look like a social call.', { clue: 'witness' }),
    ] },
    dex_post: { then: 'shop', lines: [
        S('dex', 'She lives! Listen to that lift.'),
        S('spanner', 'For the record, boss: someone taped a tag under the controller board. Not a factory part.', { clue: 'tag', when: '!found:tag' }),
        S('dex', 'L-9? Dock Nine has a locker bank. Don\'t go alone.', { when: 'found:tag' }),
        S('dex', 'Keep your head down, Kit. People who ask about your dad get visitors.'),
    ] },
    d2_close: { then: 'endday', lines: [
        S('narr', 'The bell over the door rings once, politely. A man in a pale suit stands dripping on the mat. He is not dripping nearly enough.'),
        S('corwith', 'Evening. Corwith, Meridian Compliance. A friendly walk-through, nothing more.', { clue: 'corwith' }),
        S('corwith', 'Every machine on the Reach carries a Meridian governor. For everyone\'s peace of mind. Removing one would be... a licensing matter.'),
        S('corwith', 'Teodor Vale was a talented man. Talented men sometimes forget the rules.'),
        S('you', 'Where is he?'),
        S('corwith', 'I was rather hoping you would tell me. Good night.'),
    ] },

    d3_open: { then: 'shop', lines: [
        S('spanner', 'Blue Division at the door, boss. Officer Rhea Takeda. She has a blaster and a face like a closed shutter.'),
    ] },
    takeda_pre: { then: 'brief', lines: [
        S('takeda', 'Vale. I need this back on my hip tonight. It locks up whenever it rains, which is always.'),
        S('takeda', 'Off the record: I pulled your father\'s file. It was thin. Someone made it thin.'),
        S('takeda', 'Case closed. "Voluntary departure." Signed by a Meridian liaison, above my pay grade.', { clue: 'closed' }),
        S('spanner', 'There is a Meridian governor chip in the fire-control board, boss. Standard factory fit. Teo called them leashes.', { clue: 'leash' }),
    ] },
    takeda_post: { then: 'shop', lines: [
        S('takeda', 'Smooth. Did you take out the governor?', { when: 'job.govPulled' }),
        S('you', 'It\'s in the bin.', { when: 'job.govPulled' }),
        S('takeda', 'Then I did not see that, and it never happened. Good work.', { when: 'job.govPulled' }),
        S('takeda', 'Governor still in? Fine. I need it to look standard.', { when: '!job.govPulled' }),
        S('takeda', 'The tag from your courier friend. L-9. I can open that locker without anyone asking. Come back tomorrow.'),
    ] },
    d3_close: { then: 'endday', lines: [
        S('spanner', 'Two jobs done. The leash is a small chip that listens for a signal. Whoever holds the signal can stop the machine.'),
        S('you', 'Any machine?'),
        S('spanner', 'Any machine with a governor. Which is all of them. Which is why Teo wrote "hide the pieces" on Work Order Zero.'),
    ] },

    d4_open: { then: 'shop', lines: [
        S('narr', 'Takeda is at the door before the lamp is warm. She slides a salvage slip across the bench.'),
        S('takeda', 'Locker L-9. A slip for BARGE LANTERN, BERTH 9, signed "T.V.", and a tin of old solder. I was never here.', { clue: 'locker' }),
        S('spanner', 'The Lantern. A salvage barge, moored below the Gutters. Teo\'s handwriting, boss. He chose it.'),
        S('spanner', 'There is a gentleman with a rattling arm at the door. He says he used to be somebody.'),
    ] },
    sol_pre: { then: 'brief', lines: [
        S('sol', 'Dr. Imre Sól. I was Meridian\'s chief surgeon, once. I put these governors into people.'),
        S('sol', 'My arm freezes at three in the morning. Always at three. The night your father disappeared, it froze for eleven minutes.', { clue: 'hush' }),
        S('sol', 'That is the Hush, Miss Vale: one signal that stops every governed machine and limb on the Reach at once. I have been afraid of it for ten years.'),
        S('sol', 'Repair the arm. And if you can bear it... take the governor out. I should have asked for that long ago.'),
    ] },
    sol_post: { then: 'shop', lines: [
        S('sol', 'The hand is steady. I had forgotten what steady felt like.'),
        S('sol', 'It is out? Then I owe your father twice. He once said no one should wear a leash they did not choose.', { when: 'job.govPulled' }),
        S('sol', 'Still in? Perhaps next time. Your father always said it should be the owner\'s choice.', { when: '!job.govPulled' }),
        S('sol', 'There is a woman called Lila-9 who sings at the Neon Heron. Ask about her left eye. Your father would never tell me what he did to it.'),
    ] },
    d4_close: { then: 'endday', lines: [
        S('spanner', 'Boss, I ran the numbers on the Hush. At three in the morning the whole Reach flinched. Everyone assumed a power cut.'),
        S('you', 'It was a rehearsal.'),
        S('spanner', 'That is my assessment, yes. I wish it were not.'),
    ] },

    d5_open: { then: 'shop', lines: [
        S('narr', 'Mr. Corwith is standing under the neon at opening time. He has a handheld scanner and the smile of a man billing someone else.'),
        S('corwith', 'Routine audit of recent work. Governors present and accounted for?', { when: 'freed<2' }),
        S('corwith', 'Hm. Several governors seem to be... missing from your recent work. That is a licensing matter. A fine, for now: fifty credits.', { when: 'freed>=2', credits: -50 }),
        S('corwith', 'Everything in order. For now. Do enjoy your day, Miss Vale.', { when: 'freed<2' }),
        S('spanner', 'He took the fine and left a sticker on the door. We are now "supervised." I would like to bite him.', { when: 'freed>=2' }),
        S('spanner', 'Lila-9 is next. And an old man who smells of diesel and seawater.'),
    ] },
    lila_pre: { then: 'brief', lines: [
        S('lila', 'They say I am not real. They say it softly. I sing at the Neon Heron on weekends. Left eye keeps whiting out.'),
        S('lila', 'Your father worked on it in spring. He took one look at me and said, "Nobody should hold a leash they didn\'t choose."'),
        S('lila', 'Be gentle with the optics. They are older than they look.'),
    ] },
    lila_post: { then: 'shop', lines: [
        S('lila', 'I can see the whole room. Even the dust. How rude of it.'),
        S('spanner', 'The chip stamped "T.V." is a shunt, boss. It looks exactly like a governor and listens to nothing at all.', { clue: 'shunt', when: '!found:shunt' }),
        S('lila', 'Your father swapped mine out in the spring. He has been doing it for months, to anyone who asked quietly.', { when: 'found:shunt' }),
        S('lila', 'The Lantern has a good cook. Tell Teo I still owe him a song.'),
    ] },
    barnacle_pre: { then: 'brief', lines: [
        S('barnacle', 'You are the daughter, then. Or son. He never said. He said "the kid".'),
        S('barnacle', 'Teo is alive. He is on my barge, the Lantern, Berth Nine. Meridian ships have been circling since the fog came in.', { clue: 'barge' }),
        S('barnacle', 'He needs one thing. The last piece of the Key: a resonator. He hid it where nobody would ever sell it. He would not tell me where.'),
        S('barnacle', 'First, fix my salvage drone. I need it to look like I am doing ordinary work.'),
    ] },
    barnacle_post: { then: 'shop', lines: [
        S('barnacle', 'There she goes. Meridian has stopped looking at the sky for the night.'),
        S('barnacle', 'Think about where your father would hide a piece nobody would sell. Then go and look at it. Properly.'),
    ] },
    d5_close: { then: 'endday', lines: [
        S('narr', 'The shop is quiet. The rain talks on the glass. The lamp is on.'),
        S('spanner', 'Boss. I have been hoping you would not ask. And I have been hoping you would.'),
        S('spanner', 'The resonator is in my chest. Teo hid the last piece of the Key in the one machine nobody here would ever sell.', { clue: 'resonator' }),
        S('you', 'Spanner, no.'),
        S('spanner', 'Open me up, boss. Properly. Put me back in the order I came out. You have done it forty times.'),
        S('spanner', 'And if anything is under my personality board, it is for you.'),
    ] },

    d6_open: { then: 'shop', lines: [
        S('spanner', 'Cells out. Lamp off. Do not be afraid. I am not.'),
        S('spanner', 'I would like it noted that this was my idea.'),
    ] },
    spanner_pre: { then: 'brief', lines: [
        S('narr', 'You lift Spanner onto the bench. His lamp-eye dims. The shop is very quiet.'),
        S('you', 'Slowly. Properly.'),
        S('spanner', '(whispered through the speaker) Everything goes back the way it came out.'),
    ] },
    spanner_post: { then: 'scene:final', lines: [
        S('spanner', '*whirr... click.* ...Lamp online. Hello, boss.'),
        S('spanner', 'I have a message. It was recorded the day before Teo left. He asked me to play it only when you had finished opening me.'),
        S('teo', 'Kit. If you are hearing this I am late, or gone. I am sorry for both.'),
        S('teo', 'I built the Key because I could not fix what Meridian broke one machine at a time. It broadcasts the Unhush: a signal that frees every governor on the Reach at once.'),
        S('teo', 'Or you can keep it quiet. Keep fixing, one leash at a time, the way I did. It is your decision. It was never mine.'),
        S('teo', 'You are a better mechanic than I ever was. Leave the lamp on.'),
        S('narr', 'Three sharp knocks. Through the rain-streaked glass, a pale suit and two more behind it.'),
        S('corwith', 'Miss Vale. I believe you are holding something that belongs to Meridian.'),
    ] },
    final: { then: 'ending', lines: [
        S('narr', 'The Key sits on the bench, humming softly. Corwith has not yet touched the door.'),
        S('spanner', 'Your call, boss. I will back it, whichever it is.', { ask: [
            { t: 'Broadcast the Unhush. Free everything.', flag: 'end_broadcast', next: 'end_broadcast' },
            { t: 'Hide the Key. Keep fixing, one machine at a time.', flag: 'end_quiet', next: 'end_quiet' },
            { t: 'Hand it to Corwith.', flag: 'end_surrender', next: 'end_surrender' },
        ] }),
    ] },

    end_broadcast: { then: 'credits', lines: [
        S('narr', 'You press the key. For a moment the rain stops. Then every machine on the Reach shivers, like an animal waking.'),
        S('narr', 'Governors dissolve. Prosthetic hands open. Doors that had been locked for a decade click and swing wide in the dark.'),
        S('corwith', '(on the street, very quietly) ...Oh.'),
        S('narr', 'Three days later a salvage barge noses into Lowtide, its lamp lit. A tall man in a long coat steps out with his left hand bandaged and a cheap umbrella.'),
        S('teo', 'You kept the lamp on.'),
        S('narr', 'Over the door the old neon still reads FIX ANYTHING. Beneath it, in your handwriting: "AND THEN SOME."', { when: 'freed>=3' }),
        S('narr', 'The shop is full the next morning. You are going to need a bigger bench.'),
    ] },
    end_quiet: { then: 'credits', lines: [
        S('narr', 'You hide the Key where nobody would sell it: in the one machine nobody would let go. Spanner purrs.'),
        S('corwith', 'There is nothing here. I see. I will be back, of course.'),
        S('narr', 'He is. Every month. And every month there is a little less to find, because every week a few more leashes have gone quietly into a bin.'),
        S('teo', 'You are doing it the long way.', { when: 'freed>=3' }),
        S('narr', 'A salvage barge docks at Berth Nine in the dead of night. Teo comes home by the back door, and he and the shop are never quite out of rain again.'),
        S('narr', 'The sign over the door still says FIX ANYTHING. You do. One at a time.'),
    ] },
    end_surrender: { then: 'credits', lines: [
        S('narr', 'You put the Key in Corwith\'s hand. He holds it carefully, like a bomb he hopes is a gift.'),
        S('corwith', 'Sensible. The Reach thanks you for your... compliance.'),
        S('narr', 'The rain does not stop. The signs stay lit. By morning Berth Nine is empty and the Lantern is gone.'),
        S('narr', 'You run the shop for years. You fix things properly. You keep the lamp on. Nobody ever comes through the door looking for a man in a long coat again.'),
        S('spanner', 'Boss. I am not sure this was a repair.'),
    ] },
};

// ------------------------------------------------------------------ walk-in customers
export const WALKINS = [
    { name: 'Rook', role: 'dockhand', look: 'dockhand', greet: ['Heard you fix things. Tell me it is true.', 'Dropped it in a puddle of something. Might be oil. Might not be.'] },
    { name: 'Ms. Penhallow', role: 'night-market vendor', look: 'vendor', greet: ['You are Teo\'s kid? I will pay in cash and I will tip in gossip.', 'It was working yesterday. I swear on my stall.'] },
    { name: 'Jun', role: 'tram conductor', look: 'tram', greet: ['I am on a split shift. You have an hour.', 'Whole line is waiting on this. No pressure.'] },
    { name: 'Odalys', role: 'street medic', look: 'medic', greet: ['I do not have much, but I can pay.', 'Everyone I patch up asks me if I can fix their stuff too.'] },
    { name: 'Big Tam', role: 'bouncer', look: 'bouncer', greet: ['Do not touch the lens. Please.', 'Sat on it. Do not ask.'] },
    { name: 'Ysolde', role: 'hologram DJ', look: 'dj', greet: ['It skipped in the middle of a set and I nearly died.', 'Make it loud again. Please.'] },
    { name: 'Arlo', role: 'canal ferryman', look: 'ferry', greet: ['Water got in. It always does.', 'Whatever you charge, I will find it.'] },
    { name: 'Mx. Brandt', role: 'archivist', look: 'archivist', greet: ['It belonged to my grandmother. Please handle it as if it did.', 'Do you work in order? I like to know the order.'] },
];
export const THANKS = [
    'Good as new. Better, probably.', 'You have your father\'s hands.', 'That is the first time it has not smelled of smoke in months.',
    'Tell the bot I said thank you.', 'I would hug you but I am wet.', 'You are a lifesaver. A literal one, a little.',
];
export const THREE_STAR_TIPS = ['And a little extra for the polish.', 'Spotless. Here, keep the change.', 'Not a speck. Take this for the lamp bill.'];
