// The townsfolk and the jobs they hand out. Pure data: the sim runs the steps, the UI shows the words, the art and
// voice prompts are written from the `art` and `voice` lines (dev/art/prompts.mjs, dev/audio/takes.mjs).

export const GIVERS = {
    mayor: {
        name: 'Mayor Maple', role: 'Mayor of Hard Hat Harbor',
        art: 'a cheerful grandmotherly mayor with a silver hair bun, round cheeks, a plum purple suit jacket, a red mayoral sash and a big gold chain of office',
        voice: 'a warm, proud, grandmotherly mayor',
    },
    dot: {
        name: 'Officer Dot', role: 'Traffic Officer',
        art: 'a friendly young traffic officer with freckles and a short ponytail, navy blue police uniform and peaked cap, white gloves, a silver whistle on a cord',
        voice: 'a brisk, upbeat young traffic officer',
    },
    finch: {
        name: 'Ms. Finch', role: 'Schoolteacher',
        art: 'a kind schoolteacher with big round glasses and curly dark hair, a sunflower yellow cardigan, holding a red apple',
        voice: 'a gentle, encouraging schoolteacher',
    },
    gus: {
        name: 'Farmer Gus', role: 'Farmer',
        art: 'a big jolly farmer with a bushy ginger beard, a straw hat, a red checked shirt and blue denim overalls, a stalk of wheat in his mouth',
        voice: 'a slow, jolly, deep-voiced farmer',
    },
    rosa: {
        name: 'Foreman Rosa', role: 'Site Foreman',
        art: 'a confident construction forewoman with brown skin and a dark braid, a yellow hard hat, an orange high-visibility vest over a grey t-shirt, holding a clipboard',
        voice: 'a confident, no-nonsense but friendly construction foreman',
    },
    pip: {
        name: 'Pip', role: 'Junior Builder',
        art: 'an excited eight year old kid with messy blond hair and a gap-toothed grin, wearing a yellow hard hat that is far too big, and a green striped t-shirt',
        voice: 'an excited little kid',
    },
};

/**
 * Jobs. needs: jobs that must be done first. par: seconds for three stars.
 * Steps (veh is the vehicle the step needs):
 *   haul  { from: zone id, n, site }           load at the zone, tip at the site, n times
 *   roll  { rect }                             drive the roller over every cell of the rect
 *   push  { items: [{kind, n}], at, zone }     shove the debris that appears around `at` into the zone
 *   scoop { items, at, zone, n }               pick rubble up with the loader's bucket and tip it in the zone
 *   dig   { spots }  /  pour { spots }         park by each spot and hold the button
 *   lift  { sites, n }                         park at the site and press when the hook is over the mark
 *   wreck { building, hp }                     park by the building and swing the ball hp times
 */
export const JOBS = [
    {
        id: 'potholes', title: 'Pothole Patrol', giver: 'mayor', needs: [], par: 25,
        brief: 'Welcome to Hard Hat Harbor, builder! Main Street is full of potholes. Fetch a load of asphalt from the Quarry in the dump truck, then roll it flat.',
        done: 'Smooth as a pancake! The whole town thanks you.',
        steps: [
            { kind: 'haul', veh: 'dump', from: 'quarry', n: 1, site: { x: 48, y: 48, r: 5 }, text: 'Bring asphalt from the Quarry to the potholes on Main Street' },
            { kind: 'roll', veh: 'roller', rect: { x: 44, y: 45, w: 8, h: 6 }, text: 'Roll the fresh asphalt flat' },
        ],
    },
    {
        id: 'rocks', title: 'Rockslide!', giver: 'dot', needs: ['potholes'], par: 110,
        brief: 'Tweet! Boulders have tumbled onto North Avenue and the school bus is stuck. Push them into the Quarry crusher with the bulldozer!',
        done: 'Road clear! Traffic is moving again. Nice dozing!',
        steps: [
            { kind: 'push', veh: 'dozer', items: [{ kind: 'boulder', n: 6 }], at: { x: 32, y: 31, r: 5 }, zone: { x: 20, y: 38, r: 4.5 }, text: 'Push the boulders into the crusher at the Quarry' },
        ],
    },
    {
        id: 'school', title: 'A Roof for the School', giver: 'finch', needs: ['potholes'], par: 30,
        brief: 'Oh dear, the storm blew our school roof right off! Could you bring bricks from the Quarry, and then lift the new roof beams into place with the crane?',
        done: 'A lovely new roof! The children can come back to class. Thank you!',
        steps: [
            { kind: 'haul', veh: 'dump', from: 'quarry', n: 1, site: { x: 76, y: 39, r: 5 }, text: 'Bring bricks from the Quarry to the school' },
            { kind: 'lift', veh: 'crane', n: 4, sites: [{ x: 76, y: 39, r: 5 }], text: 'Lift the roof beams: press when the hook is over the mark' },
        ],
    },
    {
        id: 'bridge', title: 'Bridge the River', giver: 'mayor', needs: ['rocks', 'school'], par: 45,
        brief: 'Now for something big. Nobody can reach the east bank! Dig two footings, fill them with concrete, and lift the bridge spans across the river.',
        done: 'The Harbor Bridge is open! I declare the east bank ready for building!',
        steps: [
            { kind: 'dig', veh: 'digger', spots: [{ x: 79.5, y: 45.5 }, { x: 79.5, y: 50.5 }], text: 'Dig two footings by the river' },
            { kind: 'pour', veh: 'mixer', spots: [{ x: 79.5, y: 45.5 }, { x: 79.5, y: 50.5 }], text: 'Pour concrete into the footings' },
            { kind: 'lift', veh: 'crane', n: 4, sites: [{ x: 77, y: 48, r: 5 }], text: 'Lift the bridge spans into place' },
        ],
    },
    {
        id: 'farm', title: 'Farmer Gus Needs a Road', giver: 'gus', needs: ['bridge'], par: 95,
        brief: 'Howdy! The rain washed my farm lane clean away, and my field is full of rocks. Bring two loads of gravel, roll it flat, then scoop those rocks out with the tractor.',
        done: 'Well, butter my biscuit! Best lane in the county. Have a pumpkin!',
        steps: [
            { kind: 'haul', veh: 'dump', from: 'quarry', n: 2, site: { x: 110, y: 30, r: 5 }, text: 'Bring two loads of gravel to the farm lane' },
            { kind: 'roll', veh: 'roller', rect: { x: 107, y: 26, w: 6, h: 8 }, text: 'Roll the gravel flat' },
            { kind: 'scoop', veh: 'loader', items: [{ kind: 'rock', n: 6 }], n: 6, at: { x: 120, y: 64, r: 4.5 }, zone: { x: 120, y: 55, r: 3.5 }, text: 'Scoop the rocks out of the field and tip them on the rock pile' },
        ],
    },
    {
        id: 'cannery', title: 'Knock Down the Old Cannery', giver: 'rosa', needs: ['bridge'], par: 90,
        brief: 'Listen up! The old cannery is falling to bits and it has to go. Swing the wrecking ball, push the big chunks to the skip, and scoop up the rubble. Hard hats on!',
        done: 'Now that is how you clear a site. Top work, builder!',
        steps: [
            { kind: 'wreck', veh: 'wrecker', building: 'cannery', hp: 8, text: 'Swing the wrecking ball at the old cannery' },
            { kind: 'push', veh: 'dozer', items: [{ kind: 'chunk', n: 3 }], at: { x: 48, y: 61, r: 4 }, zone: { x: 41, y: 72, r: 4 }, text: 'Push the big chunks into the skip' },
            { kind: 'scoop', veh: 'loader', items: [{ kind: 'rubble', n: 9 }], n: 9, at: { x: 50, y: 60, r: 5.5 }, zone: { x: 41, y: 72, r: 4 }, text: 'Scoop up the rubble and tip it in the skip' },
        ],
    },
    {
        id: 'park', title: 'Sunny Park', giver: 'pip', needs: ['cannery'], par: 35,
        brief: 'Can we have a park where the yucky old cannery was? Please please please? With a pond! And a fountain! And a bandstand!',
        done: 'It is the best park in the whole wide world! You are my hero!',
        steps: [
            { kind: 'dig', veh: 'digger', spots: [{ x: 46, y: 58 }, { x: 51, y: 58 }], text: 'Dig out the duck pond' },
            { kind: 'pour', veh: 'mixer', spots: [{ x: 54, y: 68 }], text: 'Pour the base of the fountain' },
            { kind: 'lift', veh: 'crane', n: 2, sites: [{ x: 47, y: 69, r: 4.5 }], text: 'Lift the bandstand roof into place' },
        ],
    },
    {
        id: 'homes', title: 'New Homes on the East Bank', giver: 'rosa', needs: ['bridge'], par: 120,
        brief: 'Three families are moving to town and they need houses. Dig three foundations on the east bank, pour the concrete, then crane the walls up. Let us build!',
        done: 'Three houses, three happy families. You are a master builder!',
        steps: [
            { kind: 'dig', veh: 'digger', spots: [{ x: 100, y: 24 }, { x: 100, y: 34 }, { x: 100, y: 64 }], text: 'Dig three foundations on the east bank' },
            { kind: 'pour', veh: 'mixer', spots: [{ x: 100, y: 24 }, { x: 100, y: 34 }, { x: 100, y: 64 }], text: 'Pour concrete into the foundations' },
            { kind: 'lift', veh: 'crane', n: 3, sites: [{ x: 108, y: 24, r: 4 }, { x: 108, y: 34, r: 4 }, { x: 108, y: 64, r: 4 }], text: 'Crane the walls up at each house' },
        ],
    },
    {
        id: 'playground', title: 'The School Playground', giver: 'finch', needs: ['school'], par: 60,
        brief: 'The children would love somewhere to play at break time. Could you dig a sandpit, fill it with sand from the Quarry, and lift the swings into place?',
        done: 'Listen to them laughing! That is the best sound in the world.',
        steps: [
            { kind: 'dig', veh: 'digger', spots: [{ x: 72, y: 39.5 }, { x: 76, y: 39.5 }], text: 'Dig the sandpit behind the school' },
            { kind: 'haul', veh: 'dump', from: 'quarry', n: 1, site: { x: 74, y: 39.5, r: 4.5 }, text: 'Bring a load of sand from the Quarry' },
            { kind: 'lift', veh: 'crane', n: 2, sites: [{ x: 80, y: 39.5, r: 3.5 }], text: 'Lift the swings into place' },
        ],
    },
    {
        id: 'square', title: 'The Golden Hard Hat', giver: 'mayor', needs: ['farm', 'park', 'homes', 'playground'], par: 70,
        brief: 'One last job, builder. The town wants a statue in the square, to thank you! Bring two loads of paving stones, roll them flat, pour the plinth, and lift the statue up for everyone to see.',
        done: 'There it stands! Hard Hat Harbor will never forget its builder.',
        steps: [
            { kind: 'haul', veh: 'dump', from: 'quarry', n: 2, site: { x: 48, y: 40, r: 4 }, text: 'Bring two loads of paving stones to the town square' },
            { kind: 'roll', veh: 'roller', rect: { x: 42, y: 37.5, w: 12, h: 5 }, text: 'Roll the paving flat' },
            { kind: 'pour', veh: 'mixer', spots: [{ x: 48, y: 40 }], text: 'Pour the plinth for the statue' },
            { kind: 'lift', veh: 'crane', n: 3, sites: [{ x: 48, y: 40, r: 4.5 }], text: 'Lift the statue onto its plinth' },
        ],
    },
];
export const JOB = Object.fromEntries(JOBS.map((j) => [j.id, j]));
export const MAX_STARS = JOBS.length * 3;

/** Spoken outside the jobs. */
export const SPEECH = {
    intro: { giver: 'mayor', text: 'Hello, builder! I am Mayor Maple. Our little town needs fixing, and you have the biggest toy box in the harbor. Open the job board and let us get to work!' },
    finale: { giver: 'mayor', text: 'Citizens of Hard Hat Harbor! Every road is mended, every house is built, and it is all thanks to our builder. I hereby award you the Golden Hard Hat!' },
};

/** What Foreman Rosa calls out when you climb into a vehicle. */
export const CALLS = {
    dump: 'Dump truck!', dozer: 'Bulldozer!', digger: 'Excavator!', roller: 'Road roller!',
    crane: 'Crane truck!', wrecker: 'Wrecking crane!', loader: 'Loader tractor!', mixer: 'Cement mixer!',
};
