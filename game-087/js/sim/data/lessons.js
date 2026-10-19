// The Tomes of Craft: Thalion's lessons. Each is taught once (by a quest, or by asking him in its room)
// and then kept in the Library. Pure data. Paragraphs are separated by blank lines; *italic* is allowed.

export const LESSONS = [
    // ------------------------------------------------------------------ the hall: the writing life
    { id: 'logline', room: 'hall', mood: 'smile', title: 'The Logline',
        text: 'Before a single chapter, tell me your book in one breath. *When* something happens, *a someone* must *do something*, or else *something terrible*.\n\nWhen her village burns, a young smith must carry a sleeping god across the mountains, or the god will wake angry.\n\nIf you cannot say it in one breath, you do not know it yet. That is not a failure. It is your first task.' },
    { id: 'badly', room: 'hall', mood: 'laugh', title: 'Write Badly, With Conviction',
        text: 'Every book on these shelves began as something embarrassing. Mine is still embarrassing; that is why it is in a drawer.\n\nThe first draft is you telling yourself the story. The second is you telling it to someone else. Do not let the second draft’s voice into the first draft’s room. It will only criticise the furniture.' },
    { id: 'habit', room: 'hall', mood: 'thoughtful', title: 'The Small Daily Fire',
        text: 'A novel is not written in a frenzy. It is written in small fires, lit every day, that never quite go out.\n\nThree hundred words a day is a novel in nine months. Choose a number so small you would be ashamed to miss it. Then do not miss it.' },
    { id: 'finish', room: 'hall', mood: 'concern', title: 'The Hollow',
        text: 'You will have heard of the Hollow: the silence that eats unfinished stories. Half the lamps in Vellmere went dark when their tellers stopped.\n\nI will tell you its secret. The Hollow has no power at all over a writer who finishes. Not a good book. Any book. Finish, and it cannot touch you.' },
    { id: 'theme', room: 'hall', mood: 'thoughtful', title: 'What It Is About',
        text: 'Your plot is what happens. Your theme is what it means. A dragon burns a town: that is plot. A town learns it was never the dragon’s fault: that is theme.\n\nYou rarely know the theme when you start. Find it in the second draft, then go back and let every chapter whisper it.' },

    // ------------------------------------------------------------------ the scriptorium: prose
    { id: 'show', room: 'scriptorium', mood: 'wry', title: 'Show the Wound, Not the Word',
        text: '“She was afraid.” That tells me. “She counted the exits twice, and held her cup with both hands.” That shows me.\n\nYou cannot show everything; a book of only showing is exhausting. Tell me the dull hours, and show me the moments that matter.' },
    { id: 'verbs', room: 'scriptorium', mood: 'smile', title: 'Strong Verbs',
        text: 'Adverbs are not evil; they are lazy. “He walked slowly” is three words doing the job of “he trudged”, or “he dawdled”, or “he limped”, each of which tells me something different about him.\n\nHunt the verb. It is usually hiding in the adverb’s shadow.' },
    { id: 'said', room: 'scriptorium', mood: 'wry', title: 'Said Is Invisible',
        text: 'Readers’ eyes slide over *said* like water over stone. *Exclaimed*, *retorted* and *hissed* are speed bumps.\n\nBetter still, use no tag at all: an action beside the line tells us who spoke and how. Mara set down her knife. “Say that again.”' },
    { id: 'pov', room: 'scriptorium', mood: 'thoughtful', title: 'Whose Eyes?',
        text: 'Every scene happens to someone. Choose whose eyes we look through, and stay there. If the scene is from the thief’s side, we cannot know what the guard is thinking, only what his face does.\n\nThe question to ask: who has the most to lose in this scene? Usually, that is your point of view.' },
    { id: 'scene', room: 'scriptorium', mood: 'smile', title: 'Scene and Sequel',
        text: 'A scene is a goal, a conflict and a disaster: they want something, someone stops them, and it goes wrong.\n\nA sequel is the aftermath: they feel it, they think about it, they decide what to do next. Then another scene. Breathe in, breathe out. That is a book’s heartbeat.' },
    { id: 'senses', room: 'scriptorium', mood: 'thoughtful', title: 'The Five Doors',
        text: 'Sight is the front door of a scene, and most writers never use the others. What does the dungeon smell like? What does the elf-bread taste of? Is the hilt cold?\n\nTwo senses besides sight per scene, and your reader is standing in it.' },
    { id: 'openings', room: 'scriptorium', mood: 'proud', title: 'The First Line',
        text: 'Begin as close to the trouble as you dare. Not the weather, unless the weather is trying to kill someone. Not a dream; the reader will feel cheated when they wake.\n\nA first line is a door left slightly open. Make the reader need to know what is in the room.' },
    { id: 'endings', room: 'scriptorium', mood: 'proud', title: 'The Last Line',
        text: 'An ending must be surprising and inevitable at once. Surprising, because the reader did not see it. Inevitable, because when they look back, every page pointed there.\n\nThis is why we revise. You cannot plant the inevitability until you know where the road goes.' },

    // ------------------------------------------------------------------ the hall of faces: character
    { id: 'wantneed', room: 'faces', mood: 'thoughtful', title: 'Want and Need',
        text: 'Your hero wants the crown. Your hero needs to forgive their father. The plot runs on the want; the reader’s heart runs on the need.\n\nThe best endings give one and take the other, or reveal that they were the same thing all along.' },
    { id: 'villain', room: 'faces', mood: 'wry', title: 'The Villain Is the Hero of Their Own Tale',
        text: 'No one wakes and thinks, “Today, more evil.” Your villain believes they are saving something. Their reasons should make the reader uncomfortable, because the reader half agrees.\n\nGive your antagonist a want, a need and a wound, as you would your hero. Then let them be right about one thing.' },
    { id: 'flaw', room: 'faces', mood: 'concern', title: 'The Lie They Believe',
        text: 'A flaw is not a quirk. Clumsiness is a quirk. A flaw is a lie the character believes about the world: *I must do everything alone*, *love is a weakness*, *I was born to be a servant*.\n\nThe plot is the machine that tests the lie until it breaks, or until it breaks them.' },
    { id: 'cast', room: 'faces', mood: 'smile', title: 'A Cast, Not a Crowd',
        text: 'Every companion in the fellowship should want something different, or they are one character with several hats. The warrior wants glory, the healer wants to go home, the thief wants the treasure.\n\nPut them in a small boat together and let the river do the rest.' },
    { id: 'voice', room: 'faces', mood: 'laugh', title: 'Cover the Names',
        text: 'Here is an exercise from my own master, who was a very old and very rude dwarf. Take a page of dialogue and cover the names. Can you tell who is speaking?\n\nIf not, your characters share a mouth. Give one of them a habit of questions; another, oaths; another, silence.' },

    // ------------------------------------------------------------------ the plot loom: structure
    { id: 'tryfail', room: 'loom', mood: 'smile', title: 'Try, Fail, Try Again',
        text: 'If the hero succeeds at the first attempt, there is no story, only a report. They must try and fail, then try again and fail worse, then succeed at a terrible price.\n\nThe “yes, but” and the “no, and”: yes, you get the key, but the guards saw you; no, the door won’t open, and the floor is giving way.' },
    { id: 'middle', room: 'loom', mood: 'concern', title: 'The Sagging Middle',
        text: 'Every book sinks in the middle. The opening had its spark, the ending has its fire, and the middle is a swamp where the hero rides from one inn to another.\n\nThe cure is a midpoint: halfway, turn the book over. A revelation, a betrayal, a door that changes the quest. Then everything after the midpoint runs downhill.' },
    { id: 'chekhov', room: 'loom', mood: 'wry', title: 'The Sword Over the Mantel',
        text: 'If a sword hangs over the mantel in chapter one, someone must draw it by chapter twenty. Readers notice what you show them and expect it to matter.\n\nThe reverse is the greater sin: a sword drawn in chapter twenty that was never on any mantel. Foreshadow the solution before you need it.' },
    { id: 'subplot', room: 'loom', mood: 'thoughtful', title: 'Threads on the Loom',
        text: 'A subplot is a thread that echoes the main one in another colour. The romance mirrors the war; the squire’s small cowardice mirrors the king’s great one.\n\nWeave each thread through the chapters, and don’t let one vanish for half the book. The reader will think you forgot it. Did you?' },
    { id: 'stakes', room: 'loom', mood: 'concern', title: 'What Is Lost If They Fail',
        text: 'The end of the world is the smallest stake there is, because no reader believes it. A brother dying is enormous.\n\nMake the stakes personal, then make them worse, then make them a choice: save the city, or save the one person you love in it.' },
    { id: 'outliner', room: 'loom', mood: 'laugh', title: 'Maps and Lanterns',
        text: 'Some writers draw the whole map before they leave home; the guild calls them architects. Some carry only a lantern and see three steps ahead; the guild calls them gardeners. Both arrive.\n\nThe Loom is a map. Use as much of it as helps, and burn the rest.' },

    // ------------------------------------------------------------------ the cartographer's loft: world
    { id: 'cost', room: 'loft', mood: 'thoughtful', title: 'Magic Must Cost',
        text: 'If magic can do anything, nothing is at stake. The interesting part of a magic system is not what it can do but what it cannot, and what it takes.\n\nGive your magic a source, a cost and a limit. Then let your hero solve the final problem with what they could not do on page one.' },
    { id: 'iceberg', room: 'loft', mood: 'smile', title: 'The Iceberg',
        text: 'Build ten times the world your reader will ever see. Then show them a tenth, and let them feel the rest beneath the water.\n\nA single line about the Salt War, never explained, does more than a chapter that explains it.' },
    { id: 'names', room: 'loft', mood: 'wry', title: 'On Names, and Apostrophes',
        text: 'A world’s names should sound like they came from the same mouths. If your elves are Aelindra and Thaliel, your dwarves cannot also be Aelindrin.\n\nAnd please, one apostrophe per name at most. K’th’zz’ar is not mysterious. It is a sneeze.' },
    { id: 'infodump', room: 'loft', mood: 'concern', title: 'The Infodump',
        text: 'You know the history of the Third Empire. Your reader does not care, yet. They will care exactly when a character needs to know it to survive.\n\nDeliver lore like medicine: a small spoon, at the moment of fever.' },
    { id: 'place', room: 'loft', mood: 'proud', title: 'A Place Is a Character',
        text: 'A city should want something too. The swamp wants to swallow; the desert wants to be crossed alone; the old capital wants to be remembered.\n\nGive your places a mood and a memory, and they will act on your characters without a single line of dialogue.' },

    // ------------------------------------------------------------------ the muse's well: ideas
    { id: 'ideas', room: 'well', mood: 'laugh', title: 'Ideas Are Cheap',
        text: 'Ideas are the cheapest thing in the guild. I have a bucket of them out there. What is rare is the stubbornness to carry one to the last page.\n\nTake what the Well gives you and twist it. A dragon who hoards books. A prophecy that was mistranslated. A chosen one who was chosen by mistake.' },
    { id: 'combine', room: 'well', mood: 'smile', title: 'Two Old Things',
        text: 'Originality is mostly two old things that have never met. Heist story, plus necromancy. Courtroom drama, plus dragons. A cooking contest in the court of the fae.\n\nDraw twice from the Well, and see what the two results make together.' },

    // ------------------------------------------------------------------ the proving grounds: discipline
    { id: 'sprint', room: 'grounds', mood: 'proud', title: 'The Sprint',
        text: 'Your inner editor is slow. It needs time to find the flaws. Write fast and it can’t keep up.\n\nTen minutes, no going back, no deleting, no checking the date of the Salt War. Mark what you need to fix with brackets and keep running.' },
    { id: 'block', room: 'grounds', mood: 'thoughtful', title: 'The Wall',
        text: 'Writer’s block is usually one of three things. You don’t know what happens next: go back to the Loom. You know, but don’t want to write it: write the scene you do want, and come back. Or you’re tired: sleep. The wall will still be there, and smaller.' },
    { id: 'critic', room: 'grounds', mood: 'concern', title: 'The Critic’s Season',
        text: 'Your inner critic is not your enemy. It is your best editor, who arrived too early.\n\nTell it: not yet. Its season is revision, and in revision you will need every cruel, precise word it has.' },

    // ------------------------------------------------------------------ the bindery: revision and finishing
    { id: 'revision', room: 'bindery', mood: 'thoughtful', title: 'Revision Is Seeing Again',
        text: '*Re-vision.* Look again. First the large things: does the plot hold, does each character change, is the middle a swamp? Only then the sentences.\n\nPolishing a chapter you will later cut is a sad way to spend a winter. I know. I spent several.' },
    { id: 'aloud', room: 'bindery', mood: 'smile', title: 'Read It Aloud',
        text: 'Read your book aloud, all of it. The tongue trips where the reader’s eye will trip. The breath runs out where the sentence runs too long.\n\nThe neighbours will think you mad. Writers are used to that.' },
    { id: 'kill', room: 'bindery', mood: 'concern', title: 'The Darlings',
        text: 'Somewhere in your book is a passage you love that does not belong. Cut it. Put it in a drawer if you must.\n\nThe book is not a museum of your favourite sentences. It is a road, and the reader has to walk it.' },
    { id: 'readers', room: 'library', mood: 'smile', title: 'Read Like a Thief',
        text: 'Read the books you love twice. The first time for joy; the second with a quill in your hand, stealing how. How did she make me cry on that page? Where did he hide the twist?\n\nEvery writer in this guild is a thief. The good ones file off the serial numbers.' },
    { id: 'genre', room: 'library', mood: 'thoughtful', title: 'The Promise of a Genre',
        text: 'A genre is a promise to the reader. Cozy fantasy promises comfort; grimdark promises the comfort will be taken away. Keep the promise, then surprise them inside it.\n\nYou may break a promise, but only on purpose, and only if what you give is better.' },
];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
