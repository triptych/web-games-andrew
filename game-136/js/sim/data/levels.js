// The rooms. Each one is for someone, with a few things they need (req) and a few that would
// make it lovely (bonus). Goal types are evaluated in ../rate.js; every goal here is checked
// by dev/simtest.mjs, and the planner bot proves three stars are reachable in each room.
//
// door:    { wall: 'L' | 'R', u }       the floor tile in front of it must stay clear
// windows: [{ wall, u, w }]             rows 1–2 of the wall; pictures can't go there
// blocked: [[x, y]]                     a post or a stair: nothing stands there
// gifts:   recipes waiting on the shelf, free
// look:    colours for the view only

export const LEVELS = [
    {
        id: 'pip', art: 'a small six-year-old child with a round face, messy ginger hair and freckles, wearing striped blue pyjamas, hugging a tiny clay teddy bear, sleepy happy smile', name: "Pip's First Room", who: 'Pip', w: 5, d: 5, clay: 22,
        blurb: "Pip is moving out of the cot and into a real room. A bed, a light for the dark, and something soft underfoot.",
        door: { wall: 'R', u: 3 }, windows: [{ wall: 'L', u: 1, w: 2 }], blocked: [],
        gifts: [{ kind: 'bed', size: 0, variant: 0, colors: ['cocoa', 'sky'], motif: 0 }],
        look: { wall: 0xf4d9b8, trim: 0xe9b98c, floor: 0xd9a877, floor2: 0xcf9c6a, base: 0x7a5238 },
        goals: [
            { t: 'count', of: { kind: 'bed' }, min: 1, req: true, text: 'Place a bed' },
            { t: 'count', of: { tag: 'light' }, min: 1, req: true, text: 'Add a lamp' },
            { t: 'count', of: { kind: 'rug' }, min: 1, req: true, text: 'Lay down a rug' },
            { t: 'onrug', a: { kind: 'bed' }, min: 1, text: 'The bed stands on the rug' },
            { t: 'clay', min: 6, text: 'Save 6 lumps of clay' },
            { t: 'walk', text: 'Pip can reach everything from the door' },
        ],
    },
    {
        id: 'mo', art: 'a bookish teenager with short black curly hair, big round glasses and a mustard cardigan, holding an open book against their chest, gentle smile', name: "Mo's Reading Nook", who: 'Mo', w: 5, d: 6, clay: 26,
        blurb: "Mo reads three books a week and wants a corner to do it in: a deep chair, good light and the books close by.",
        door: { wall: 'L', u: 4 }, windows: [{ wall: 'R', u: 2, w: 2 }], blocked: [],
        gifts: [],
        look: { wall: 0xcfe0d2, trim: 0x9cbfa6, floor: 0xb98a63, floor2: 0xad7f59, base: 0x5c4434 },
        goals: [
            { t: 'count', of: { kind: 'armchair' }, min: 1, req: true, text: 'An armchair' },
            { t: 'near', a: { tag: 'light' }, b: { kind: 'armchair' }, min: 1, req: true, text: 'A lamp right by the armchair' },
            { t: 'against', a: { kind: 'bookshelf' }, min: 1, req: true, text: 'A bookshelf against a wall' },
            { t: 'count', of: { kind: 'picture' }, min: 2, text: 'Two pictures on the walls' },
            { t: 'window', a: { kind: 'plant' }, min: 1, text: 'A plant by the window' },
            { t: 'walk', text: 'Everything can be reached from the door' },
        ],
    },
    {
        id: 'twins', art: 'two cheerful seven-year-old twins side by side, a girl with two puffy brown pigtails in a red dungaree dress and a boy with a mop of brown hair in a green t-shirt, grinning', name: "The Twins' Playroom", who: 'Ada & Otto', w: 6, d: 6, clay: 28,
        blurb: "Ada and Otto need somewhere to put all of it. Lots of toys, somewhere soft to sit on the floor, and a way through the mess.",
        door: { wall: 'R', u: 4 }, windows: [{ wall: 'L', u: 2, w: 2 }], blocked: [],
        gifts: [],
        look: { wall: 0xf7e7a1, trim: 0xf0b75b, floor: 0x9cc7e0, floor2: 0x8dbbd6, base: 0x4f6f9a },
        goals: [
            { t: 'count', of: { kind: 'toy' }, min: 4, req: true, text: 'Four toys' },
            { t: 'count', of: { kind: 'rug' }, min: 1, req: true, text: 'A play rug' },
            { t: 'walk', req: true, text: 'A clear path from the door to everything' },
            { t: 'colors', min: 5, text: 'Five different colours' },
            { t: 'onrug', a: { kind: 'toy' }, min: 2, text: 'Two toys out on the rug' },
            { t: 'on', a: { kind: 'toy' }, b: { tag: 'surface' }, min: 1, text: 'A toy up on a shelf or table' },
        ],
    },
    {
        id: 'nonna', art: 'a warm Italian grandmother with grey hair in a bun, rosy cheeks, small gold earrings and a floral apron, holding a wooden spoon, laughing', name: "Nonna's Kitchen Corner", who: 'Nonna Rosa', w: 6, d: 5, clay: 30,
        blurb: "Sunday lunch is at Nonna's. She needs a table with chairs around it, and she likes the place warm and bright.",
        door: { wall: 'L', u: 5 }, windows: [{ wall: 'R', u: 1, w: 2 }], blocked: [],
        gifts: [],
        look: { wall: 0xf3efe6, trim: 0x7fb0a4, floor: 0xd88a5b, floor2: 0xc97c50, base: 0x6b3f2a },
        goals: [
            { t: 'count', of: { kind: 'table' }, min: 1, req: true, text: 'A table' },
            { t: 'near', a: { kind: 'chair' }, b: { kind: 'table' }, min: 2, req: true, text: 'Two chairs at the table' },
            { t: 'on', a: { kind: 'plant' }, b: { kind: 'table' }, min: 1, text: 'Flowers on the table' },
            { t: 'family', fam: 'warm', min: 3, text: 'Three things in warm colours' },
            { t: 'count', of: { kind: 'picture' }, min: 1, text: 'A picture on the wall' },
            { t: 'clay', min: 6, text: 'Save 6 lumps of clay' },
        ],
    },
    {
        id: 'biscuit', art: 'a plump friendly older gentleman with a bald head, a big white walrus moustache, a brown waistcoat and a bow tie, holding a teacup and saucer, beaming', name: "Mr. Biscuit's Living Room", who: 'Mr. Biscuit', w: 7, d: 6, clay: 40,
        blurb: "Mr. Biscuit has friends round for tea every evening. A sofa, a table for the teapot, a rug under it, and lamps for after dark.",
        door: { wall: 'R', u: 5 }, windows: [{ wall: 'L', u: 2, w: 3 }], blocked: [],
        gifts: [],
        look: { wall: 0xe7c9d6, trim: 0xb07a96, floor: 0xa98767, floor2: 0x9d7b5c, base: 0x55394a },
        goals: [
            { t: 'count', of: { kind: 'sofa' }, min: 1, req: true, text: 'A sofa' },
            { t: 'count', of: { kind: 'table' }, min: 1, req: true, text: 'A tea table' },
            { t: 'onrug', a: { kind: 'table' }, min: 1, req: true, text: 'The table stands on a rug' },
            { t: 'count', of: { tag: 'light' }, min: 2, req: true, text: 'Two lights' },
            { t: 'near', a: { kind: 'table' }, b: { kind: 'sofa' }, min: 1, text: 'The table within reach of the sofa' },
            { t: 'cosy', min: 70, text: 'Cosiness 70 or more' },
            { t: 'count', of: { kind: 'picture' }, min: 2, text: 'Two pictures' },
            { t: 'walk', text: 'Guests can get to every seat' },
        ],
    },
    {
        id: 'juno', art: 'a young artist with a short lilac bob haircut, a dark blue hoodie covered in paint dabs and a pencil tucked behind one ear, calm dreamy smile', name: "Juno's Starlight Studio", who: 'Juno', w: 6, d: 6, clay: 30,
        blurb: "Juno draws comics late into the night under the attic roof. A desk, a chair, a lamp on the desk, and cool, calm colours.",
        door: { wall: 'L', u: 5 }, windows: [{ wall: 'R', u: 1, w: 2 }], blocked: [[3, 3]],
        gifts: [],
        look: { wall: 0x2f3c66, trim: 0x8a9be0, floor: 0x9a8fb8, floor2: 0x8e83ad, base: 0x2a2440 },
        goals: [
            { t: 'count', of: { kind: 'desk' }, min: 1, req: true, text: 'A desk' },
            { t: 'near', a: { kind: 'chair' }, b: { kind: 'desk' }, min: 1, req: true, text: 'A chair at the desk' },
            { t: 'on', a: { kind: 'tablelamp' }, b: { kind: 'desk' }, min: 1, req: true, text: 'A lamp on the desk' },
            { t: 'family', fam: 'cool', min: 3, text: 'Three things in cool colours' },
            { t: 'against', a: { kind: 'bookshelf' }, min: 1, text: 'A bookshelf against a wall' },
            { t: 'count', of: { kind: 'clock' }, min: 1, text: 'A clock, so Juno goes to bed' },
        ],
    },
    {
        id: 'fern', art: 'a cheerful gardener woman in her forties with long braided auburn hair, green dungarees and soil on her cheek, holding a small potted fern', name: "Fern's Greenhouse Parlour", who: 'Fern', w: 7, d: 7, clay: 40,
        blurb: "Fern's plants have taken over the house. Give them a room of their own, with the sunniest spots for the thirstiest ones, and a seat for Fern.",
        door: { wall: 'R', u: 5 }, windows: [{ wall: 'L', u: 1, w: 2 }, { wall: 'L', u: 4, w: 2 }], blocked: [],
        gifts: [],
        look: { wall: 0xe2efd3, trim: 0x93b77f, floor: 0xc7b49a, floor2: 0xbba88e, base: 0x46603a },
        goals: [
            { t: 'count', of: { kind: 'plant' }, min: 5, req: true, text: 'Five plants' },
            { t: 'count', of: { tag: 'seat' }, min: 2, req: true, text: 'Two seats' },
            { t: 'window', a: { kind: 'plant' }, min: 2, text: 'Two plants by a window' },
            { t: 'family', fam: 'green', min: 4, text: 'Four things in greens' },
            { t: 'on', a: { kind: 'plant' }, b: { tag: 'surface' }, min: 1, text: 'A plant up on a table or shelf' },
            { t: 'walk', text: 'Fern can reach every plant to water it' },
        ],
    },
    {
        id: 'cabin', art: 'a sweet tiny grandmother with fluffy white hair, little round spectacles and a knitted lavender shawl, holding a lump of clay in her hands, kind wrinkled smile', name: "Grandma's Cabin", who: 'Grandma Clay', w: 8, d: 7, clay: 50,
        blurb: "The cosiest room of all, for the person who taught everyone to pinch clay. A fire, a bed, a chair by the fire, and light in every corner.",
        door: { wall: 'R', u: 5 }, windows: [{ wall: 'L', u: 5, w: 2 }], blocked: [[5, 4]],
        gifts: [],
        look: { wall: 0xb98a5e, trim: 0x8a5e3a, floor: 0x8f6a4a, floor2: 0x83603f, base: 0x3e2a1e },
        goals: [
            { t: 'count', of: { kind: 'bed' }, min: 1, req: true, text: 'A bed' },
            { t: 'against', a: { kind: 'fireplace' }, min: 1, req: true, text: 'A fireplace against a wall' },
            { t: 'near', a: { kind: 'armchair' }, b: { kind: 'fireplace' }, min: 1, req: true, text: 'An armchair by the fire' },
            { t: 'count', of: { kind: 'rug' }, min: 1, req: true, text: 'A rug' },
            { t: 'count', of: { tag: 'light' }, min: 3, req: true, text: 'Three lights (the fire counts)' },
            { t: 'cosy', min: 85, text: 'Cosiness 85 or more' },
            { t: 'count', of: { kind: 'picture' }, min: 3, text: 'Three pictures' },
            { t: 'walk', text: 'Grandma can reach everything' },
        ],
    },
];

/** The sandbox: no goals, a big room and a big lump of clay. */
export const STUDIO = {
    id: 'studio', name: 'Free Studio', who: 'you', w: 9, d: 8, clay: 400, studio: true,
    blurb: 'No brief, no budget. Make whatever room you like.',
    door: { wall: 'R', u: 6 }, windows: [{ wall: 'L', u: 2, w: 2 }, { wall: 'L', u: 6, w: 2 }], blocked: [],
    gifts: [],
    look: { wall: 0xeee3d0, trim: 0xd1b48c, floor: 0xc79e78, floor2: 0xbb926d, base: 0x5a4130 },
    goals: [],
};

export const ALL_LEVELS = [...LEVELS, STUDIO];
export const LEVEL = Object.fromEntries(ALL_LEVELS.map((l) => [l.id, l]));
