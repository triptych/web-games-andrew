// Starbase Spooky — the space questions. Each visitor knows four and asks three of them (picked by the seed).
// `a` lists the answers in the order they are shown AND read aloud (so a child who can't read yet can follow the
// voice), and `ok` is the index of the right one. The visitor reads `q` and the
// answers aloud (one voice clip, `vo-<id>`), and Orby reads the `fact` once you get it right (`vo-fact-<id>`).
// Facts are checked against NASA's kids' pages (spaceplace.nasa.gov); they are simplified, never wrong.

export const QUESTIONS = [
    // --- Zorp: the planets ---------------------------------------------------------------------------------------
    { id: 'z1', who: 'zorp', q: 'Which planet has the biggest, brightest rings?', a: ['Saturn', 'Mars', 'Venus'], ok: 0,
        fact: 'Saturn\'s rings are made of chunks of ice and rock. Some are as small as a grain of sand, and some are as big as a house!' },
    { id: 'z2', who: 'zorp', q: 'Which planet is the biggest of them all?', a: ['Earth', 'Jupiter', 'Mercury'], ok: 1,
        fact: 'Jupiter is the biggest planet. More than a thousand Earths could fit inside it!' },
    { id: 'z3', who: 'zorp', q: 'Which planet is called the Red Planet?', a: ['Neptune', 'Jupiter', 'Mars'], ok: 2,
        fact: 'Mars looks red because its dusty ground has rusty iron in it.' },
    { id: 'z4', who: 'zorp', q: 'Which planet is closest to the Sun?', a: ['Mercury', 'Saturn', 'Uranus'], ok: 0,
        fact: 'Mercury is the closest planet to the Sun. A year on Mercury is only 88 days long!' },

    // --- Madame Gloobella: the Sun and the stars -----------------------------------------------------------------
    { id: 'g1', who: 'gloobella', q: 'What is our Sun?', a: ['A planet', 'A star', 'A moon'], ok: 1,
        fact: 'The Sun is a star! It is the closest star to Earth, so it looks big and bright.' },
    { id: 'g2', who: 'gloobella', q: 'What do we call a group of stars that makes a picture in the sky?', a: ['A constellation', 'A comet', 'A crater'], ok: 0,
        fact: 'A constellation is a group of stars that makes a pattern, like Orion the Hunter or the Big Dipper.' },
    { id: 'g3', who: 'gloobella', q: 'Why do stars twinkle when we look at them from Earth?', a: ['They blink on and off', 'They are shy', 'The air bends their light'], ok: 2,
        fact: 'Stars twinkle because the moving air around Earth bends their light. Out here in space, they don\'t twinkle at all!' },
    { id: 'g4', who: 'gloobella', q: 'We live in a giant spiral of stars. What is it called?', a: ['The Big Swirl', 'The Milky Way', 'The Candy Bar'], ok: 1,
        fact: 'Our galaxy is the Milky Way. It has hundreds of billions of stars!' },

    // --- Captain Snorkel: the Moon and comets --------------------------------------------------------------------
    { id: 's1', who: 'snorkel', q: 'What is a comet mostly made of?', a: ['Fire', 'Cheese', 'Ice and dust'], ok: 2,
        fact: 'A comet is like a dirty snowball of ice and dust. Near the Sun, it grows a long glowing tail.' },
    { id: 's2', who: 'snorkel', q: 'Who was the first person to walk on the Moon?', a: ['Neil Armstrong', 'Captain Snorkel', 'A cow'], ok: 0,
        fact: 'Neil Armstrong walked on the Moon in 1969. His footprints are still there, because the Moon has no wind to blow them away!' },
    { id: 's3', who: 'snorkel', q: 'Why does the Moon seem to change shape every night?', a: ['Someone takes a bite', 'We see different parts of its sunny side', 'It shrinks in the wash'], ok: 1,
        fact: 'The Moon is always round. As it travels around Earth, we see more or less of its sunny side. These are called phases.' },
    { id: 's4', who: 'snorkel', q: 'About how long does the Moon take to go all the way around the Earth?', a: ['One hour', 'One hundred years', 'About a month'], ok: 2,
        fact: 'The Moon takes about a month to go around the Earth. That\'s where the word month comes from!' },

    // --- Professor Quasar: how space works ------------------------------------------------------------------------
    { id: 'q1', who: 'quasar', q: 'What pulls things down and keeps your feet on the ground?', a: ['Gravity', 'Magnets', 'Glue'], ok: 0,
        fact: 'Gravity pulls things toward each other. It keeps us on Earth, and it keeps Earth going around the Sun.' },
    { id: 'q2', who: 'quasar', q: 'Why do astronauts float inside a space station?', a: ['They are full of balloons', 'They are falling around Earth with the station', 'They forgot their shoes'], ok: 1,
        fact: 'The station and everyone in it are falling around the Earth together, so everything floats. It\'s called free fall!' },
    { id: 'q3', who: 'quasar', q: 'Can you hear sounds out in empty space?', a: ['Yes, it is very loud', 'Only on Tuesdays', 'No, there is no air to carry sound'], ok: 2,
        fact: 'Sound needs air to travel. Space has almost no air, so it is very, very quiet out there.' },
    { id: 'q4', who: 'quasar', q: 'Where does moonlight really come from?', a: ['Sunlight bouncing off the Moon', 'Giant moon lamps', 'Glowing moon bugs'], ok: 0,
        fact: 'The Moon doesn\'t make its own light. It shines because sunlight bounces off it, like a mirror.' },

    // --- Blip & Blop: rockets and astronauts ----------------------------------------------------------------------
    { id: 'b1', who: 'blipblop', q: 'What do astronauts wear to stay safe outside the station?', a: ['Pajamas', 'A spacesuit', 'A raincoat'], ok: 1,
        fact: 'A spacesuit gives astronauts air to breathe and keeps them warm, cool and safe.' },
    { id: 'b2', who: 'blipblop', q: 'What makes a rocket blast off into space?', a: ['Burning fuel pushing gas down', 'A big trampoline', 'A really strong sneeze'], ok: 0,
        fact: 'Rockets burn lots of fuel and push hot gas down very fast. That pushes the rocket up, up and away!' },
    { id: 'b3', who: 'blipblop', q: 'Which planet do people live on?', a: ['Pluto', 'Neptune', 'Earth'], ok: 2,
        fact: 'We live on Earth, the third planet from the Sun. It\'s the only planet we know of with living things.' },
    { id: 'b4', who: 'blipblop', q: 'How many planets go around our Sun?', a: ['Three', 'Eight', 'Fifty'], ok: 1,
        fact: 'There are eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.' },
];

export const QUESTION = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const ASKS_PER_VISIT = 3;

/** What the visitor says aloud: the question, then the answers in the order the buttons show them. */
export function spoken(q) {
    const [a, b, c] = q.a;
    return `${q.q} Is it... ${a}? ${b}? Or ${c}?`;
}
