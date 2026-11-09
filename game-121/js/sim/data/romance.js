// The three people of Hollowmere you can spend your evenings with. Each has four evening scenes (the third carries
// a clue to the plot), and a festival-night scene whose ending depends on how close you have grown.
// A choice's `a` is affection gained (0–2); the best answer is always the one that suits them.

import { L } from './story.js';

export const CAND = {
    elias: {
        name: 'Elias Thorne', short: 'Elias', role: 'blacksmith', pron: 'he', color: '#ff8a3a',
        blurb: 'Broad, quiet, mends everything, writes poems in a notebook he hides. Likes honesty and wit; shy of flattery.',
        look: { model: 'elias', skin: '#c68a62', hair: '#2a1c14', hs: 'short', hat: null, robe: '#8a3a1c', trim: '#e0a040', body: 'broad', beard: true },
        clue: 'orders',
    },
    mirabel: {
        name: 'Mirabel Fenn', short: 'Mirabel', role: 'apothecary', pron: 'she', color: '#3fe0a0',
        blurb: 'Sharp, funny, sceptical, secretly tender. Likes curiosity and nerve; has no patience for fog.',
        look: { model: 'mirabel', skin: '#f0cfa8', hair: '#6a2a2a', hs: 'long', hat: null, robe: '#2c7a5a', trim: '#d9d27a', body: 'slim', glasses: true },
        clue: 'ledger',
    },
    wren: {
        name: 'Wren Quill', short: 'Wren', role: 'minstrel', pron: 'they', color: '#d65aff',
        blurb: 'Charming, restless, never says the plain thing when a song will do. Likes play and surprise; wary of being pinned down.',
        look: { model: 'wren', skin: '#e8c8a8', hair: '#3a8aa8', hs: 'long', hat: 'wide', hatc: '#c04ac0', robe: '#7a2a9a', trim: '#7ff0e0', body: 'slim', feather: true },
        clue: 'rota',
    },
};
export const CAND_IDS = Object.keys(CAND);

// scenes[k] = the (k+1)th evening with them. lines, then choices { t, a, r:[reply lines] }, then `end` lines.
export const SCENES = {
    elias: [
        {
            title: 'The Forge After Dark',
            lines: [
                L('n', 'The forge glows at the east end of the lane like a sleeping dragon. Elias is hammering a horseshoe thin and flat — then he sees you in the doorway and the hammer stops mid-air.'),
                L('c', 'You came. I mean — you’re here. I wasn’t… the kettle! I fixed your kettle. It’s on the bench.', 'w'),
            ],
            choices: [
                { t: 'I wanted to see where the thunder comes from.', a: 2, r: [L('c', 'Ha. From here. Mostly from me, dropping things.', 'h'), L('n', 'He laughs, and the whole forge seems to brighten with it.')] },
                { t: 'Thank you for the kettle. What do I owe you?', a: 1, r: [L('c', 'Nothing. A cup of what it boils, maybe.', 'h')] },
                { t: 'I was just passing.', a: 0, r: [L('c', 'Ah. Well. Mind the sparks.', 'w')] },
            ],
            end: [L('n', 'You stay for an hour. The anvil sings, the sparks sail up the chimney like small ambitions, and neither of you says anything wise.')],
        },
        {
            title: 'The Notebook',
            lines: [
                L('n', 'Rain on the forge roof. Elias is pretending not to hide a battered notebook behind the tongs.'),
                L('c', 'It’s nothing. Orders. Measures. Numbers.', 'w'),
                L('n', 'It is, you notice, written in verse.'),
            ],
            choices: [
                { t: 'Read me one. I’ll be an honest critic.', a: 2, r: [L('c', 'Right. Right.', 'w'), L('n', 'He reads, badly and then well, a poem about a hammer waiting for a hand. When he finishes the rain is the only sound in the world.')] },
                { t: 'I could read your cards for it. Poems are in the Hermit’s keeping.', a: 1, r: [L('c', 'You’d read a man’s poems off a card? That’s… that’s very nearly flattering.', 'h')] },
                { t: 'Poetry? A blacksmith? Really?', a: 0, r: [L('c', 'Hm. I suppose that’s fair.', 'w')] },
            ],
            end: [L('c', 'No one has heard those. Not even my mother.', 'l')],
        },
        {
            title: 'Unmarked Steel',
            clue: 'orders',
            lines: [
                L('n', 'Tonight the forge is cold. Elias stands in the yard with something wrapped in oilcloth, a long shape.'),
                L('c', 'I need to show someone and I can’t show the Reeve. Two hundred blades. The First Prince’s steward ordered them. No guild stamp, no maker’s mark. Paid up front, in palace silver.', 'a'),
                L('c', 'Smiths mark their steel. Only men who don’t want a blade traced ask for it unmarked. I made them anyway. The silver… I needed it.', 's'),
            ],
            choices: [
                { t: 'You’re telling me now. That’s what counts.', a: 2, r: [L('c', 'It’s a thin thing to stand on, but thank you.', 'l')] },
                { t: 'We have to tell someone who can use this.', a: 1, r: [L('c', 'You’re right. I’ll go with you to the Prince.', 'a')] },
                { t: 'Keep quiet. It isn’t safe.', a: 0, r: [L('c', 'I… thought you’d be braver. Maybe I’m wrong.', 's')] },
            ],
            end: [L('n', 'He unwraps one: grey, plain, perfectly balanced, and unmistakably meant for a very large number of people.')],
        },
        {
            title: 'An Iron Rose',
            lines: [
                L('n', 'The lane is hung with paper lanterns. Elias has cleaned the soot from his hands, which is a thing you have never seen, and he is holding something behind his back.'),
                L('c', 'I made this. It’s not a rose, it’s… well, it is a rose. It won’t wilt. That seemed important.', 'w'),
            ],
            choices: [
                { t: 'It’s the most honest rose I’ve ever been given.', a: 2, r: [L('c', 'You’ll take it, then?', 'l'), L('n', 'You do. It is warm from the forge, and heavier than a flower has any right to be.')] },
                { t: 'It’s beautiful. Can you make a second, for my table?', a: 1, r: [L('c', 'Two roses. Aye. I can do that.', 'h')] },
                { t: 'Iron? On the cards, iron means… never mind.', a: 0, r: [L('c', 'I… see.', 'w')] },
            ],
            end: [L('n', 'You hang it on the wagon’s lantern hook. In the candle-glow it looks almost alive.')],
        },
    ],
    mirabel: [
        {
            title: 'Tea and Scepticism',
            lines: [
                L('n', 'The apothecary smells of lavender, camphor and burnt sugar. Mirabel puts a cup in your hand before you can speak.'),
                L('c', 'I deal in what can be weighed. A thing that cannot be weighed… I’m told it doesn’t exist.', 'n'),
            ],
            choices: [
                { t: 'Then let me weigh a fortune for you. A scale and a deck are not so different.', a: 2, r: [L('c', 'Oh, that’s good. Very good. I resent how good that is.', 'h')] },
                { t: 'Science and the stars both reward patience.', a: 1, r: [L('c', 'Hmph. A fair answer. Not a convincing one.', 'n')] },
                { t: 'You’re just afraid I’m right.', a: 0, r: [L('c', 'I am afraid of precisely nothing. Drink your tea.', 'a')] },
            ],
            end: [L('n', 'The tea is nettle and something sharper. By the second cup she is arguing with you about the moon, with a gleam like polished glass.')],
        },
        {
            title: 'The Night Garden',
            lines: [
                L('n', 'Mirabel’s garden blooms only after dark — moonflowers, white as folded paper, opening one by one as you watch.'),
                L('c', 'Old Hargreave planted these. I’ve never been brave enough to prune them.', 's'),
            ],
            choices: [
                { t: 'Leave them. Some things are tended best by letting them be.', a: 2, r: [L('c', 'That… yes. Thank you.', 'l')] },
                { t: 'Tell me about him.', a: 1, r: [L('c', 'Stubborn. Terrible at poems. Kind, mostly to plants.', 'h')] },
                { t: 'You should prune them. It’s only a plant.', a: 0, r: [L('c', 'Only a plant. Of course.', 'a')] },
            ],
            end: [L('n', 'A moth lands on her sleeve, the colour of an old coin. She does not brush it off.')],
        },
        {
            title: 'The Ledger',
            clue: 'ledger',
            lines: [
                L('n', 'Closed shutters, one lamp. Mirabel spreads her ledger open on the counter, tapping an entry as though it might bite.'),
                L('c', 'Nightshade. Three vials. A ‘Doctor Penhallow’. He died a year ago in the north. I was at the funeral.', 'a'),
                L('c', 'The silver was palace silver. New-minted. I’ve checked every coin under a glass.', 'a'),
            ],
            choices: [
                { t: 'We take this to Caspian. Together.', a: 2, r: [L('c', 'Together. Right. I can live with that.', 'l')] },
                { t: 'Can you tell what dose would kill?', a: 1, r: [L('c', 'A third of one vial. In wine, in a large cup. Easily.', 'a')] },
                { t: 'Burn the page. You don’t want your name here.', a: 0, r: [L('c', 'I’d never. Not for fear. Not for you.', 'a')] },
            ],
            end: [L('n', 'You copy the entry into your journal in your best hand. It looks like a very small, very ordinary thing, to be what it is.')],
        },
        {
            title: 'Moon Tea',
            lines: [
                L('n', 'The lane is full of drifting paper lanterns. Mirabel has put out a blanket on the grass behind the apothecary, and brewed something that smells like summer and trouble.'),
                L('c', 'The college in the capital wrote. They’ve offered me a chair. It’s what I wanted for ten years. And now I find I’m… reluctant.', 'w'),
            ],
            choices: [
                { t: 'Go, and write. I’ll send you a reading in every letter.', a: 1, r: [L('c', 'A reading in every letter. I accept those terms.', 'h')] },
                { t: 'Stay, if you want. Wanting is a good enough reason.', a: 2, r: [L('c', 'You’ve a most irritating way of being right.', 'l')] },
                { t: 'Go. A seer doesn’t get to keep what she reads.', a: 0, r: [L('c', 'Hm. I suppose we don’t.', 's')] },
            ],
            end: [L('n', 'The moon comes up like a new coin. For a while you do not ask the cards anything at all.')],
        },
    ],
    wren: [
        {
            title: 'Song on the Steps',
            lines: [
                L('n', 'Someone is playing a lute on your wagon steps. Badly, and then suddenly not badly at all. Wren looks up, mid-chord, with a smile that arrives a moment late.'),
                L('c', 'I’m writing a song about you. It’s going terribly. The rhymes for ‘seer’ are all unflattering.', 'h'),
            ],
            choices: [
                { t: 'Sing me the bad version. The bad versions are the best.', a: 2, r: [L('c', '“I met a seer by moonlight, her cards were sharp as sin…”', 'h'), L('n', 'It scans terribly. It is wonderful.')] },
                { t: 'Rhyme it with ‘clear’. That’s flattering enough.', a: 1, r: [L('c', 'Clear. Of course. How have I spent a week without clear.', 'h')] },
                { t: 'Maybe don’t write songs about people who are trying to sleep.', a: 0, r: [L('c', 'Ha, fair. Goodnight then, oracle.', 'n')] },
            ],
            end: [L('n', 'You sit on the step beside them. They play until the lamps go out in the lane, one by one, like stars being put to bed.')],
        },
        {
            title: 'The Road Not Taken',
            lines: [
                L('n', 'Wren is lying on the grass behind the wagon, hat over their face, lute on their chest. They are not playing it.'),
                L('c', 'I left home at sixteen with a lute and a stolen map. I’ve never told anyone what I was running from. It makes for better stories if I haven’t.', 's'),
            ],
            choices: [
                { t: 'Tell it badly. I won’t mind.', a: 2, r: [L('c', 'A father who wanted a smith. I wanted anything. We both got what we wanted.', 'l')] },
                { t: 'I won’t ask. Tell me about the map.', a: 1, r: [L('c', 'Oh, the map! Mostly lies, and all of it beautiful.', 'h')] },
                { t: 'Running away isn’t a plan, you know.', a: 0, r: [L('c', 'No. It’s a rhythm.', 'a')] },
            ],
            end: [L('n', 'The hat tilts up. For a moment, under the brim, a face with no performance in it at all.')],
        },
        {
            title: 'The Watch Song',
            clue: 'rota',
            lines: [
                L('n', 'A tavern in the lane, a fiddle, a crowd. Wren finds you at the end of the bar and lowers their voice, which for Wren is a physical effort.'),
                L('c', 'A guardsman got drunk and told me the night watch is being swapped on Fair night. All the old hands to the border, strangers to the King’s door. I made it a song so it wouldn’t die in my head.', 'a'),
                L('c', 'Words are all I’ve got. I thought maybe they were useful.', 'w'),
            ],
            choices: [
                { t: 'They’re the most useful thing in the village. Sing it for the Captain.', a: 2, r: [L('c', 'For the Captain, a hundred times. Even sober.', 'h')] },
                { t: 'Write it down. Words can be burnt, but paper keeps its secrets.', a: 1, r: [L('c', 'That’s a very seer thing to say. Done.', 'n')] },
                { t: 'Forget you ever heard it.', a: 0, r: [L('c', 'Oh. Oh, that’s not what I hoped.', 's')] },
            ],
            end: [L('n', 'In the corner the fiddler hits a wrong note, and for an instant the whole tavern seems to hold its breath.')],
        },
        {
            title: 'Two Roads',
            lines: [
                L('n', 'The fair’s lanterns are hanging in the lane. Wren has packed a bag. It sits, ominously, by the wagon steps.'),
                L('c', 'The troupe leaves at dawn, the day after the Fair. I could stay. I’ve never stayed. I don’t know how it’s done.', 'w'),
            ],
            choices: [
                { t: 'Stay, and learn. I’ll teach you. I’ve only just learned myself.', a: 2, r: [L('c', 'Two beginners and a wagon. That’s practically a song.', 'l')] },
                { t: 'Go, and come back. A road has two ends.', a: 1, r: [L('c', 'A road has two ends. Oh, that’s a good line. I’m stealing it.', 'h')] },
                { t: 'Go. I wouldn’t want to be a reason.', a: 0, r: [L('c', 'Ah. A kind lie. I’ve told those.', 's')] },
            ],
            end: [L('n', 'They strum one chord. It hangs in the lantern-light, unresolved, as if waiting for you to finish it.')],
        },
    ],
};

// After four scenes, a quiet evening is still worth something.
export const QUIET = {
    elias:   [L('n', 'You sit by the banked forge, the iron rose between you on the anvil, and say nothing for a long and companionable while.')],
    mirabel: [L('n', 'You trade riddles over lavender tea until the lamp burns low and she falls asleep mid-argument, smiling.')],
    wren:    [L('n', 'Wren plays you the unfinished tune. It stops in the middle, as always, but tonight it stops on purpose.')],
};

// The festival night, by closeness: 'love' (>= ROMANCE_LOVE), 'sweet' (>= ROMANCE_MIN), 'friend'.
export const FINALE = {
    elias: {
        love: [L('n', 'Under the great Harvest Moon, with fireworks coming apart overhead like a thousand opening flowers, Elias takes your hand in a palm like warm stone.'), L('c', 'I wrote you something. It doesn’t rhyme. It isn’t good. It’s true.', 'l'), L('n', 'It is the best poem you have ever heard. You tell him so. He laughs, and the sky answers.')],
        sweet: [L('n', 'You stand beside Elias at the lane’s end, the fireworks painting his face gold and violet. He nudges you, very gently, with his shoulder.'), L('c', 'I’d like to do this again. Next year, and the one after. If you’d have me.', 'l')],
        friend: [L('n', 'Elias buys you a toffee apple and watches the fireworks with his hands behind his back. He’s kind; he’s quiet; and something stays unsaid.'), L('c', 'You’re a good friend. I hope you know that.', 'n')],
    },
    mirabel: {
        love: [L('n', 'The lanterns rise over the village like little suns. Mirabel puts her cup down on the grass and takes both your hands in hers, ink-stained and herb-scented.'), L('c', 'I’ve written to the college. I’m staying. If you want a sceptic in the wagon’s second chair, I could be persuaded.', 'l')],
        sweet: [L('n', 'You sit side by side on her blanket as the fireworks bloom and fade. Mirabel leans, a little, until her shoulder rests on yours.'), L('c', 'I wouldn’t have believed in this. In any of it. Strange what a hundred small facts add up to.', 'l')],
        friend: [L('n', 'Mirabel packs a flask of tea and finds a seat on the church wall with you. The fireworks are lovely. She talks about the chemistry of colours the whole time.'), L('c', 'Isn’t it extraordinary? Copper for green. Strontium for red.', 'h')],
    },
    wren: {
        love: [L('n', 'On the church green a crowd has gathered for the fiddlers, but Wren has pulled you to the top of the old well wall, where the whole sky is on show.'), L('c', 'I stayed, you know. I cancelled the troupe. I don’t know how it’s done, but I’m told you start with a first evening.', 'l'), L('n', 'The lute is silent. The sky is not.')],
        sweet: [L('n', 'Wren plays a song in the lane and the whole village sings the chorus. At the last verse they lift their hat to you and the fireworks answer in gold.'), L('c', 'I wrote it for the Fair. I’m told it’s about a seer. I may have fibbed. I may not have.', 'l')],
        friend: [L('n', 'Wren dances you through the lane to a reel, laughing, and tips their hat when the music ends. At the lane’s end they take their road.'), L('c', 'Until the next verse, oracle.', 'h')],
    },
};
