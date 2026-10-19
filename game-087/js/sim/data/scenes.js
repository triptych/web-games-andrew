// Thalion's scenes: the prologue, each quest's start and end, first visits, level-ups and the finale.
// Pure data. A line is { who: 'thalion' | 'narrator', mood, text } or a prompt: { ask: 'name' | 'sigil' | 'calling' }.
// {name} is the apprentice's pen name, {title} the novel's title, {rank} their rank.

const T = (mood, text) => ({ who: 'thalion', mood, text });
const N = (text) => ({ who: 'narrator', text });

export const SCENES = {
    prologue: [
        N('Dusk in Vellmere. The city climbs its hill in tiers of slate and lamplight, and at the very top stands the Hall of the Quillsworn: a guild of storytellers older than the kingdom around it.'),
        N('Half its lamps are dark. You climb the last stair with a letter of introduction in one hand and nothing at all in the other.'),
        T('smile', 'Ah. You must be the new apprentice. Come in, come in, mind the cat; she bites anyone who hasn’t finished a manuscript, which is everyone.'),
        T('proud', 'I am Thalion Silverquill, Master of this guild, six hundred and twelve years old, and yes, the hair is natural. I am asked.'),
        T('wry', 'Every storyteller needs a name to put on a spine. What shall the guild call you?'),
        { ask: 'name' },
        T('smile', '{name}. Good. It sounds like someone who finishes things.'),
        T('thoughtful', 'Every member of the guild bears a sigil. It goes on your door, your seal and the spine of every book you bind. Choose yours.'),
        { ask: 'sigil' },
        T('concern', 'Now. You will have seen the dark lamps on the way up. Each lamp in Vellmere is lit by a finished story. When a teller gives up, their lamp goes out, and the Hollow creeps a little closer.'),
        T('thoughtful', 'The Hollow is silence. It eats unfinished tales. We do not fight it with swords, {name}. We fight it by finishing.'),
        T('smile', 'Every storyteller has a calling: the part of the craft that comes to them first. Which is yours?'),
        { ask: 'calling' },
        T('proud', 'A fine choice. The others will come with practice; the calling only tells me where you will begin.'),
        T('smile', 'Your first task is the oldest one. Every book begins as a spark. Open the Novel Charter (it’s on the lectern there) and tell me what your book is.'),
    ],

    // ---------------------------------------------------------------- quest ends (done) and starts
    done_q_spark: [
        T('proud', '“{title}.” I can see the cover already. Gold leaf, I think.'),
        T('smile', 'Take this: a ribbon from my own hair. It is a guild tradition, and I have plenty.'),
        T('thoughtful', 'I have opened the Scriptorium for you, and the Quest Board, and the Library. The Board is where the guild posts its errands; the Library is where the lessons I give you will be kept.'),
    ],
    start_q_first_ink: [
        T('smile', 'Now comes the hard part, which is also the easy part. Go to the Scriptorium and write. One hundred and fifty words. Badly, if you like.'),
        T('wry', 'The page will be very white. It is supposed to be. Fill it.'),
    ],
    done_q_first_ink: [
        T('laugh', 'There! Words in a book that did not exist this morning. Do you feel it? That small hot coal in your chest? Guard it.'),
        T('smile', 'A heron quill for you: grey and patient, like a good editor. I have opened the Hall of Faces, where your characters live, and the Proving Grounds, where the foes of every writer are waiting to be fought.'),
        T('wry', 'The foes are real, by the way. The Procrastination Imp has been living in our pantry for a century.'),
    ],
    start_q_faces: [
        T('thoughtful', 'Who is your story about? I don’t mean their name. I mean what they want, what they need, what they believe that isn’t true, and the old wound it grew from.'),
        T('smile', 'Go to the Hall of Faces. Flesh out your protagonist, every core field and a backstory, and give your antagonist something to want.'),
    ],
    done_q_faces: [
        T('proud', 'Now *there* is a person. I would buy them a drink and then worry about them all night.'),
        T('wry', 'And your antagonist wants something. Good. Villains who want only “evil” are very boring at dinner.'),
        T('smile', 'Two more doors are open: the Plot Loom, for the shape of your tale, and the Muse’s Well, for when your bucket comes up empty.'),
    ],
    start_q_shape: [
        T('thoughtful', 'Some writers draw the whole map before they leave. Some carry a lantern and see three steps ahead. Even lantern-carriers should know roughly which mountain they’re walking towards.'),
        T('smile', 'Go to the Plot Loom. Choose a structure, and fill in three of its beats. You can change all of it later. Everyone does.'),
    ],
    done_q_shape: [
        T('proud', 'A shape! The tale has bones now. Bones can be broken and reset, so don’t be precious about them.'),
        T('smile', 'Take this inkwell. Elvenwood ink, green as the forest under Silverbough. And climb to the Cartographer’s Loft, which I have unlocked for you. Mind the pigeons.'),
    ],
    start_q_road: [
        T('thoughtful', 'Every story needs somewhere to happen. Set down two places in the Loft. Real ones, with something strange about them.'),
        T('concern', 'And a magic. If your book has none, invent one anyway; it will teach you something. Give it a cost, and a limit. Magic without a price is just weather.'),
        T('smile', 'Then draw something up from the Muse’s Well and keep it. Ideas are cheap. That is why the bucket is free.'),
    ],
    done_q_road: [
        T('smile', 'Places with moods. Magic with a price. You are starting to build a world that pushes back.'),
        T('proud', 'Have a talent point, on the guild. Spend it at your Sheet, on whatever the work needs.'),
    ],
    start_q_steel: [
        T('wry', 'Time you were blooded. The Proving Grounds are behind the kitchen: win two ink duels. The Imp and the Wraith are traditional for beginners.'),
        T('thoughtful', 'A duel is a sprint. You write against the clock, and every word strikes the foe. Stop for too long and it recovers. Whatever happens, every word you write goes into your book.'),
    ],
    done_q_steel: [
        T('laugh', 'Ha! You’ve got ink on your cheek. Wear it with pride.'),
        T('smile', 'The Midnight Inkwell, for the late hours. The Golem has woken, too; I heard it grinding its stones this morning.'),
    ],
    start_q_thousand: [
        T('proud', 'Now, a thousand words. Across at least three scenes and two chapters, so that your book has rooms and doors, not just one long corridor.'),
    ],
    done_q_thousand: [
        T('proud', 'A thousand words. Most people who say they will write a book never reach this page. You have.'),
        T('smile', 'The Bindery is open to you. It is where a manuscript becomes a book: a web page, an EPUB for travellers, a proof for the printing press.'),
    ],
    start_q_binding: [
        T('thoughtful', 'Bind your book now, while it is small. Unfinished books are bound here all the time; it is how you learn what the finished one will look like.'),
        T('wry', 'Besides, the binders get bored.'),
    ],
    done_q_binding: [
        T('smile', 'Hold it. It’s small and unfinished and yours. Every book on these shelves was once that size.'),
        T('concern', 'Now I must warn you about the middle. Somewhere around ten thousand words, every book wanders into a swamp. The Mire-Hydra lives there. It has eaten more novels than the Hollow.'),
    ],
    start_q_middle: [
        T('thoughtful', 'Ten thousand words, and the Hydra drained. When the middle sags, turn the book over: a revelation, a betrayal, a door that changes the quest.'),
    ],
    done_q_middle: [
        T('proud', 'Ten thousand words, and the Hydra’s swamp is dry. You are through the worst of it, though you won’t believe me.'),
        T('thoughtful', 'May I tell you something? I have a book of my own. *The Lark Beneath the Hill.* I began it three hundred years ago, and it has lived in my desk drawer, half-finished, for two hundred and ninety of them.'),
        T('concern', 'I stopped in the middle. The Hydra did not eat it. Something worse did. You will meet it soon.'),
    ],
    start_q_critic: [
        T('concern', 'Twenty-five thousand words. And at the end of them, the Inner Critic: it has your face and your voice and a red quill, and it knows exactly where you are weakest.'),
        T('thoughtful', 'Do not try to silence it forever. Just finish the sprint. It respects that, in the end.'),
    ],
    done_q_critic: [
        T('proud', 'You beat it. I never did, you know. My Critic told me my book was pretentious, and I believed it, and it went in the drawer.'),
        T('smile', 'Take my old inkwell. Moonsilver. I have not dipped a quill in it since. It should be used.'),
    ],
    start_q_revision: [
        T('thoughtful', 'Now: revision. Read back through what you have. Mark five scenes revised once you have truly looked at them again, large things first, sentences last.'),
        T('smile', 'And keep snapshots of your drafts, so you can cut boldly. The Chronicle of Drafts talent lets you keep them; it’s on your Sheet if you haven’t learned it yet.'),
    ],
    done_q_revision: [
        T('smile', 'Re-vision: seeing again. It is the part of writing that nobody sees, and the part that matters most.'),
        T('proud', 'There is only one quest left on the guild’s road, {name}. You know what it is.'),
    ],
    start_q_last_page: [
        T('thoughtful', 'Finish it. Forty thousand words at the least, and an ending that is surprising and inevitable at once. Then come and tell me, and mark it complete in the Charter.'),
        T('smile', 'I will be here. I am always here. It is the hair; it takes hours.'),
    ],
    done_q_last_page: [
        N('Thalion takes your book in both hands and is quiet for a long time.'),
        T('proud', '“{title}.” Finished. Do you know how rare that is? More rare than dragons. I have seen dragons.'),
        N('He carries it to the window. Below, in the tier of streets nearest the Hall, a lamp that has been dark for a century flickers, catches, and burns gold.'),
        T('laugh', 'There. That one is yours. The Hollow will never take it.'),
        T('thoughtful', 'This is the Lamp of Vellmere, the guild’s highest honour: take it, and wear it. You are a Master Talewright now, whatever the ledger says.'),
        N('He opens a drawer in his desk. Inside is a stack of paper tied with ribbon the same silver as his hair.'),
        T('smile', 'And I think, perhaps, I will finish *The Lark Beneath the Hill*. After three hundred years. Would you read it, {name}, when it is done?'),
        T('proud', 'The guild’s road ends here, but the Hall stays open. There are many dark lamps left in Vellmere. Start another book whenever you like. I will be by the fire.'),
    ],

    // ---------------------------------------------------------------- a second (or tenth) finished book
    book_done: [
        T('proud', '“{title}”, finished. Another lamp lit in Vellmere. Look, there, on the river tier.'),
        T('smile', 'Put it on your shelf in the Library. And when you are ready, begin the next. The Hollow is never truly gone, but it is afraid of you now.'),
    ],
    book_done_short: [
        T('smile', '“{title}”: a finished {kind}. Short tales light small lamps, but they light them all the same.'),
    ],

    // ---------------------------------------------------------------- first visits
    visit_scriptorium: [T('smile', 'The Scriptorium. Chapters on the left, the page in the middle, notes on the right. Write in plain words: *stars* for italics, a line of * * * for a scene break. Every new word is experience.')],
    visit_board: [T('thoughtful', 'The Quest Board. My road is pinned at the top; side errands below; and three bounties that change with the sun.')],
    visit_faces: [T('smile', 'The Hall of Faces. Every portrait here is someone’s character. Yours will hang among them. Press the little ? beside a field and I will tell you what it’s for.')],
    visit_grounds: [T('wry', 'The Proving Grounds. Pick a foe, pick where the words should go, and write as if the page were on fire. It sometimes is.')],
    visit_loom: [T('thoughtful', 'The Plot Loom. Above, the beats of your chosen structure. Below, the loom itself: threads you weave across your chapters, so no subplot is forgotten.')],
    visit_loft: [T('proud', 'The Cartographer’s Loft. Places, factions, magic, creatures, lore. And a map table: the map draws itself from a seed; pin your places on it.')],
    visit_well: [T('laugh', 'The Muse’s Well. Lower the bucket and see what comes up. Keep what you like; it goes straight into your codex.')],
    visit_library: [T('smile', 'The Library. Your lessons, your laurels, the foes you have bested, the record of your days and your shelf of books.')],
    visit_bindery: [T('thoughtful', 'The Bindery. Choose how the book should look, then bind it: a single web page, an EPUB for any reader, or a print proof you can save as a PDF.')],
};

/** What Thalion says at a level-up or a new rank. */
export const LEVEL_LINES = [
    'Another level! Your quill hand is steadier. I can tell from here.',
    'You are growing, {name}. The ledger says so, and the ledger does not flatter.',
    'Level {level}. The cat looked at you with something like respect this morning.',
    'Up a level. Spend your talent point wisely, or wildly; both are traditions.',
    'Level {level}! I once took a hundred years to get this far. Elves are slow at most things.',
];
export const RANK_LINES = {
    Apprentice: 'Apprentice {name}. It has a ring to it. Not a gold ring, yet. Copper, perhaps.',
    Scribe: 'Scribe! You may now use the good ink cupboard. Do not tell the others.',
    Journeyman: 'Journeyman: a teller who has walked far enough to know how far there is to go.',
    Taleweaver: 'Taleweaver. The guild will start asking your opinion. Give it kindly.',
    Loremaster: 'Loremaster. Very few reach this rank. Fewer reach it with such good posture.',
    'Master Talewright': 'Master Talewright. You outrank half the portraits in the Hall of Faces.',
    'Grand Bard': 'Grand Bard of Vellmere. I may have to start calling you “master”. I won’t.',
    'Legend of Vellmere': 'A Legend of Vellmere. They will tell stories about you, {name}. Make sure they finish them.',
};
