// The Atelier's story: one scene to open each chapter and one to close it,
// the finale, and the Blot's whispers when the apprentice hesitates.
// Speakers: Q Quillon, M Mott, B the Blot, F the First Talewright, N narration.

export const CHAPTERS = [
    { n: 0, title: 'The Blank Page', glyph: null, blurb: 'A pencil, a meadow, and somewhere to stand.' },
    { n: 1, title: 'Words', glyph: 'Glyph of Voices', blurb: 'Events, and the oldest command there is: Show Text.' },
    { n: 2, title: 'Things', glyph: 'Glyph of Keeping', blurb: 'Items, chests, gold, and the first drawer of the Database.' },
    { n: 3, title: 'Places', glyph: 'Glyph of Thresholds', blurb: 'More maps, and doors between them.' },
    { n: 4, title: 'Choices', glyph: 'Glyph of Forks', blurb: 'Questions, switches, variables and branches.' },
    { n: 5, title: 'Conflict', glyph: 'Glyph of Strife', blurb: 'Heroes, enemies, skills, troops and battles.' },
    { n: 6, title: 'Commerce & Care', glyph: 'Glyph of Trade', blurb: 'Shops, inns, equipment and companions.' },
    { n: 7, title: 'The Living World', glyph: 'Glyph of Motion', blurb: 'Cutscenes, wanderers, weather, music and the Sprite Forge.' },
    { n: 8, title: 'The Worldbook', glyph: 'Glyph of Binding', blurb: 'An ending, a title, and a book to give away.' },
    { n: 9, title: 'Worldsmith', glyph: null, blurb: 'Every tool is yours.' },
];

export const SCENES = {
    'ch0-start': { title: 'Prologue: The Blank Page', lines: [
        ['N', 'At the edge of the world, where the maps run out and the margins begin, there is a workshop with a lamp in the window.'],
        ['N', 'This is the Atelier of Unwritten Worlds. Every story you have ever loved was drafted here once.'],
        ['Q', 'Ah! You\'re here. You\'re actually here. Forgive the state of the place. I would have dusted, but there\'s nothing left to dust with.'],
        ['Q', 'I am Quillon. Quill, Second Class, retired; tutor to apprentices; keeper of the Worldbook. Well. Keeper of what\'s left of it.'],
        ['M', 'And I\'m MOTT! I live in the lamp! Hello! Is that a new apprentice? Can I keep it?'],
        ['Q', 'You may not keep the apprentice, Mott.'],
        ['N', 'Across the far wall something grey shifts. It is not a shadow. It is a place where the wall has stopped bothering to be a wall.'],
        ['B', '…another one. how tiring.'],
        ['Q', 'That is the Blot. It got into the Worldbook last winter and has been soaking through everything since. The brushes, the Glyphs, the voices, the doors: it smudged them all away.'],
        ['Q', 'But a Blot cannot abide a page that is being written on. So we write. Here, I saved a pencil. Just the one.'],
        ['Q', 'Make me a place. Any place. Paint some grass, a tree or two, and show me where your hero would stand. Then press Playtest and walk around in it.'],
    ] },
    'ch0-end': { title: 'The first inch', lines: [
        ['Q', 'There. Do you see it? The grey has drawn back from the corner. Only an inch, but it moved.'],
        ['M', 'You made a GROUND! Ground is my favourite thing that isn\'t a lamp!'],
        ['B', '…it\'s only grass. grass has been done.'],
        ['Q', 'Grass has been done, and it will be done again, and every time it will be somebody\'s first meadow. Pay it no mind.'],
        ['Q', 'A world with no one in it is a painting, not a tale. I found the Glyph of Voices under the floorboards. Let\'s give your meadow someone to talk to.'],
    ] },
    'ch1-start': { title: 'Chapter 1: Words', lines: [
        ['Q', 'The Glyph of Voices restores Events: the people and things in your world that do something.'],
        ['Q', 'Choose the Events layer, double-click a tile, give the event a face, and make it speak. Or right-click the map and choose the NPC template, and I\'ll lay one out for you.'],
        ['Q', 'Show Text is the oldest command there is. A name, a few words, a box at the bottom of the screen. Kingdoms have been built on less.'],
        ['M', 'Make one say "Mott is great"!'],
    ] },
    'ch1-end': { title: 'A voice in the Atelier', lines: [
        ['Q', 'Listen to that. A voice! I\'d forgotten what it sounded like when the pages talked back.'],
        ['M', 'It didn\'t say Mott is great.'],
        ['Q', 'Next, the Glyph of Keeping. Stories need things in them, Mott: lost rings, sealed letters, a potion at the bottom of a chest.'],
        ['M', 'Shiny things!! I LOVE the Glyph of Keeping.'],
        ['B', '…they\'ll only open the chest once. then what.'],
        ['Q', 'Then they\'ll remember opening it. That\'s what.'],
    ] },
    'ch2-start': { title: 'Chapter 2: Things', lines: [
        ['Q', 'The Database is open again, or the first drawer of it. Items live there: a name, an icon, a price, and what they do.'],
        ['Q', 'A chest is two pages. The first gives an item and turns on the event\'s own Self Switch A. The second page needs Self Switch A, and shows the chest open and empty.'],
        ['Q', 'Try the Chest template from the map\'s right-click menu, then open it up and see how it\'s made. The Rectangle and Fill tools are back in the drawer too. Mind your fingers.'],
    ] },
    'ch2-end': { title: 'Kept things', lines: [
        ['M', 'I put a button in a chest. For later. Don\'t tell anyone.'],
        ['Q', 'Your secret is safe with the entire Atelier, Mott.'],
        ['Q', 'Thresholds, now. A world needs an inside and an outside, a here and a there. The Glyph of Thresholds gives us more maps, and doors between them.'],
    ] },
    'ch3-start': { title: 'Chapter 3: Places', lines: [
        ['Q', 'Make a second map: a house, a cave, the far side of a river. Then give the first map a door, an event that Transfers the hero there. The Door template does it in one go.'],
        ['Q', 'The Over layer is back too. Treetops, roof edges, archways: whatever the hero should walk behind. And the Interior tileset, for when your hero finally gets indoors.'],
        ['B', '…more rooms. more rooms nobody will visit.'],
        ['Q', 'Somebody will visit. That is the whole point of a door.'],
    ] },
    'ch3-end': { title: 'Here and there', lines: [
        ['Q', 'Two places joined by a door. That, apprentice, is how every map in every atlas started.'],
        ['M', 'I flew through the door twelve times. It goes to the house! And then it comes back!'],
        ['Q', 'Now the hardest Glyph, and the best: Forks. Choices. The moment a story turns and asks the reader what they want.'],
    ] },
    'ch4-start': { title: 'Chapter 4: Choices', lines: [
        ['Q', 'Show Choices asks a question and gives each answer its own branch. A Switch remembers the answer for later: it is just a flag that says yes, this happened.'],
        ['Q', 'Give an event a second page that needs a switch, and it changes the moment that switch turns on. Variables do the same with numbers, and a Conditional Branch lets one list ask questions of its own.'],
        ['B', '…choices. as if any of them matter.'],
        ['Q', 'That is for the reader to decide. You only have to offer them.'],
    ] },
    'ch4-end': { title: 'The fork', lines: [
        ['M', 'I picked "No" just to see what would happen and something DID happen!'],
        ['Q', 'That\'s the trick of it. Now: Conflict. Every tale needs a little trouble, and the Glyph of Strife is nothing but.'],
    ] },
    'ch5-start': { title: 'Chapter 5: Conflict', lines: [
        ['Q', 'Heroes, Enemies, Skills and Troops: four new drawers in the Database. Make an enemy, put it in a troop, and start a battle, from an event or with random encounters in Map Properties.'],
        ['Q', 'The battles are the old kind. Everyone chooses, then everyone acts, fastest first. Attack twice over, less defence. Weaknesses sting.'],
        ['M', 'Can the enemy be a moth? A big one? A NICE big one?'],
        ['Q', 'The enemy can be anything you can imagine, Mott. That is the dangerous part.'],
    ] },
    'ch5-end': { title: 'Strife', lines: [
        ['Q', 'Well fought. The Blot has backed off half the floor. I can see the fireplace again.'],
        ['B', '…they always win in the end. so why fight at all.'],
        ['Q', 'Because the end isn\'t the point. The fight is. Next: Commerce and Care. Shops, inns, a sword worth saving up for, and friends to carry it.'],
    ] },
    'ch6-start': { title: 'Chapter 6: Commerce & Care', lines: [
        ['Q', 'Shop Processing opens a shop with whatever goods you choose. Weapons, armour and accessories can be equipped now, and Change Party brings new heroes along.'],
        ['M', 'And I\'m opening an EMPORIUM! I take payment in Ink. I drink it. It\'s delicious. Come and see!'],
        ['Q', 'Please don\'t drink the customers\' Ink, Mott.'],
    ] },
    'ch6-end': { title: 'A town worth returning to', lines: [
        ['Q', 'A town with a shop and an inn is a town people want to come back to. Your world is starting to hold together.'],
        ['Q', 'Now I am going to show you something I have not seen in a very long time. The Glyph of Motion.'],
    ] },
    'ch7-start': { title: 'Chapter 7: The Living World', lines: [
        ['Q', 'Autorun events play the moment their page appears: cutscenes, arrivals, sudden storms. Parallel events tick quietly in the background.'],
        ['Q', 'Your people can wander now, or come looking for the hero. The screen can fade, flash, shake and darken. And there is music: give each map its own song.'],
        ['Q', 'And the Forge! The Sprite Forge! Make anyone you like, from the hair down.'],
        ['B', '…moving pictures. still only pictures.'],
        ['M', 'MOVING pictures. Moving is the best kind!'],
    ] },
    'ch7-end': { title: 'Alive', lines: [
        ['Q', 'Listen to it. Wind in the trees, a song on the hill, someone walking round the square for no reason but to be walking. That is a living world.'],
        ['Q', 'One Glyph left. The Glyph of Binding. It turns a project into a book, and a book into something you can give away.'],
    ] },
    'ch8-start': { title: 'Chapter 8: The Worldbook', lines: [
        ['Q', 'Name your game in Database ▸ System. Give it an ending: The End rolls your closing words and the credits.'],
        ['Q', 'Then Export. One file, everything inside. It runs in any browser, without me, without the Atelier, without anything at all.'],
        ['B', '…and who will play it. nobody. it will sit in a folder. forgotten.'],
        ['Q', 'Maybe. Or maybe one person will. That has always been enough.'],
    ] },
    'ch8-end': { title: 'Finale: The Margin', lines: [
        ['N', 'The Worldbook lies open on the desk. Its pages are filling, one line at a time, in a hand that looks a great deal like yours.'],
        ['B', '…why do you keep going. it has all been done before. every story. every one.'],
        ['Q', 'It has. All of them. And every one was written by somebody who was afraid it had been done before.'],
        ['N', 'Something slips from between the Worldbook\'s last pages: a note, in faded ink.'],
        ['F', 'If you find this, apprentice: I was frightened of the blank page every single day. I wrote anyway. The fear never left. It only learned to sit in the margin.'],
        ['N', 'The grey stain draws back. It does not vanish. It settles around the edges of the Worldbook, a clean pale border around the words.'],
        ['Q', 'There it is. Not a Blot at all. A margin. Every page needs one: somewhere for the words to stop and breathe.'],
        ['M', 'It looks much nicer as a margin.'],
        ['B', '……fine.'],
        ['Q', 'You have done it, Worldsmith. Every tool is yours now. Go and make something nobody has made yet. Or something everybody has, made your way.'],
    ] },
    'free-start': { title: 'Free Mode', lines: [
        ['Q', 'Free Mode! Every drawer open, every Glyph lit. I\'ll keep quiet unless you want me; the quests are still there if you fancy a tour.'],
        ['M', 'And the Emporium is still open. Ink is still delicious.'],
    ] },
};

export const WHISPERS = [
    ['…a blank map. how restful. leave it like that.', 'Ignore it. One tile. Then another.'],
    ['…someone has probably made this already.', 'Everything has been made already. Not by you.'],
    ['…you could always start again tomorrow.', 'Tomorrow-you will be glad of a single tile from today-you.'],
    ['…it won\'t be as good as the one in your head.', 'It never is. That is what makes it real.'],
    ['…nobody reads the dialogue anyway.', 'Somebody always does. Usually the one who matters.'],
    ['…stop. rest. forever, ideally.', 'Rest is fine. Forever is not. Back to it when you\'re ready.'],
];

export const NAMES = { Q: 'Quillon', M: 'Mott', B: 'the Blot', F: 'the First Talewright', N: '' };
