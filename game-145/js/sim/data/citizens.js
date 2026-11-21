// The missing citizens of Ashmere and their diaries. Pure data, shared by the sim and the view.
//
// Each seed picks NINE of the fifteen ordinary citizens plus Dr. Elias Marrow, whose entry is always the last. The
// entries are read in `chrono` order, so the story always runs from the first hum to the night of the fourteenth.
// `where` is the building type the diary is hidden in. `art` is the fal prompt for the portrait (art/portraits/<id>.webp).
// A seeded clue sentence (story.js) is appended to most entries: the pieces of the portal sequence.

export const CITIZENS = [
    {
        id: 'edith', name: 'Edith Lund', role: 'retired seamstress, Pell Street', where: 'house', chrono: 1,
        art: 'an elderly insomniac woman in her late seventies, thin silver hair in a loose bun, cardigan over a nightdress, sharp tired eyes',
        text: [
            'Four in the morning again and I am awake again, so I may as well write it down. There is a sound under the town. Not loud. You feel it in the fillings of your teeth before you hear it. A long low note, like a finger on the rim of a glass the size of a church.',
            'Mrs. Abernathy says it is the new laboratory out past the canning works. Mrs. Abernathy says a great many things. But the dogs have started leaving. I watched three of them trot down Pell Street in a line, not looking at anything, heading out of town like they had been called.',
            'The kettle hums along with it now. So do I, if I am not careful.',
        ],
    },
    {
        id: 'hollis', name: 'Hollis Grey', role: 'watchmaker, Grey & Son', where: 'shop', chrono: 2,
        art: 'a stooped watchmaker in his sixties with a jeweller\'s loupe pushed up on his forehead, white stubble, waistcoat, gentle puzzled face',
        text: [
            'Forty-one years at this bench and I have never seen a clock do what mine did tonight. Every one in the shop stopped at 3:33. Then the second hands began to move again. Backwards. Smoothly, as if they had always meant to.',
            'I took the Bulova apart. Nothing wrong with it. Escapement fine, mainspring fine. I put it back together and it ran backwards still, and when I held it to my ear the tick had the hum underneath it.',
            'I have started writing the time on the wall each morning in pencil, so I know the days are still going the right way. They are. For now they are.',
        ],
    },
    {
        id: 'priya', name: 'Priya Raman', role: 'lab technician, Threshold Laboratory', where: 'apartment', chrono: 3,
        art: 'a young South Asian lab technician in her late twenties, hair tied back, safety glasses hanging from her collar, lanyard, anxious intelligent eyes',
        text: [
            'I am not supposed to write any of this down. Non-disclosure, clause nine. But I need to put it somewhere outside my own head.',
            'THRESHOLD is not an energy project. The ring in Hall C is a resonance cavity. Dr. Marrow believes that a space and its copy can be tuned to the same note, like two strings, and that if you get them to sing together the wall between them goes thin. A fold. He calls the other side the Between.',
            'Today we ran it at four percent for nine seconds. The air in the hall went yellow. Not the lights. The air. And for nine seconds I could smell wet carpet. There is no carpet anywhere in Hall C.',
        ],
    },
    {
        id: 'walt', name: 'Walt Henning', role: 'night janitor, Threshold Laboratory', where: 'apartment', chrono: 4,
        art: 'a heavyset night janitor in his fifties in grey coveralls, ring of keys, moustache, kind weary face, cap pushed back',
        text: [
            'Mopping Hall C after the big boys went home, and there were footprints in the dust by the ring. Bare feet, small, like a woman\'s. They walked straight up to the back wall and kept going. Into it. The last print was cut in half by the skirting board.',
            'Nobody goes barefoot in a lab. Nobody walks through walls. I mopped them up anyhow, because that is the job, and when I came back with the bucket they were there again. Wet this time.',
            'I told Dr. Marrow. He thanked me and asked me not to mop that corner any more. He looked like a man who had been told his house is on fire and is relieved, because at least now he knows where the smoke is coming from.',
        ],
    },
    {
        id: 'benny', name: 'Benny Okafor', role: 'late-night host, WKVR 88.3', where: 'office', chrono: 5,
        art: 'a Nigerian-American late-night radio host in his forties, big headphones around his neck, warm smile gone uncertain, corduroy jacket',
        text: [
            'Dead air between two and four is usually just me and the truckers. Last night the board started picking up something on our own frequency. Voices. Ordinary voices, talking low, like people in a waiting room.',
            'I recognised one. Mrs. Lund from Pell Street, who calls in every Thursday about the weather. She was saying the hallway goes on and on. She was saying she can see a light switch but it never gets any closer.',
            'I called her house. She picked up. She was fine, half asleep, cross with me. So who was on my board? I taped it. I have played the tape eleven times. On the eleventh she says my name.',
        ],
    },
    {
        id: 'ruth', name: 'Ruth Calloway', role: 'night nurse, St. Brigid\'s Hospital', where: 'hospital', chrono: 6,
        art: 'a tired night-shift hospital nurse in her forties, scrubs and a cardigan, kind worried eyes, hair pinned up',
        text: [
            'Third ward round tonight and three more beds empty at 3 a.m. Not discharged. Not missing, exactly; we find them every time. Standing at the end of the east corridor in their gowns, facing the window, facing the industrial district. Asleep on their feet.',
            'Mr. Patel said, while I walked him back, that the corridor upstairs is longer at night. I said it was the medication. He said, gently, as if I were the patient, that it was not.',
            'I measured it. Forty-four of my steps on the day shift. Fifty-one at three in the morning. I am writing this so that I will believe it tomorrow.',
        ],
    },
    {
        id: 'dale', name: 'Dale Kovac', role: 'security guard, Hollow Oaks Mall', where: 'mall', chrono: 7,
        art: 'a mall security guard in his thirties in a rumpled grey uniform with a radio on his shoulder, buzz cut, jaw set, nervous eyes',
        text: [
            'There is a door behind the Sunglass Hut that is not on the floor plan. I have walked this mall eight years. I know every service corridor, every fire door, every rat. This one is painted the same beige as everything else and it is warm to the touch.',
            'Behind it is a corridor of yellow wallpaper. Damp carpet. Those ceiling panels that buzz. It goes left, and right, and left, and every room is the same room with the furniture taken out.',
            'I went in thirty steps and came out the door I went in by, which was in front of me, not behind me. I have locked it and I have told no one. If you find this, leave that door alone.',
        ],
    },
    {
        id: 'marisol', name: 'Marisol Vega', role: 'shift foreman, Lindqvist Canning Works', where: 'factory', chrono: 8,
        art: 'a Latina factory foreman in her forties in a hard hat and hi-vis vest over flannel, grease on one cheek, strong steady gaze',
        text: [
            'Line three started itself at 3:20 this morning with nobody on the floor. Conveyor, sealers, the lot. I walked the whole hall with the breaker panel open in front of me and every switch thrown to OFF, and the line ran.',
            'It is drawing power from somewhere that is not us. The lab across the yard ran its cables under our lot last spring; the whole district hums like a transformer now. The vending machine in the break room has been full every morning for a week. Nobody fills it.',
            'I sent the crew home. I stayed. Somebody has to listen to what the machines are trying to say.',
        ],
    },
    {
        id: 'june', name: 'June Mercer', role: 'night clerk, Starlite Hotel', where: 'hotel', chrono: 9,
        art: 'a young hotel night clerk in her early twenties in a maroon blazer with a name pin, pixie haircut, dark circles, wry tired smile',
        text: [
            'The VACANCY sign has not been switched off in nine nights and the switch is in my hand. The guest book keeps filling up. Names I know: the Kovacs, the Ramans, Mr. Grey from the watch shop. Check-in dates of the fourteenth. Room numbers we do not have. Room 0. Room 0. Room 0.',
            'At 3 a.m. the lift goes up to the top floor and comes back down empty with the doors open, and the car smells of wet carpet.',
            'Tonight I wrote my own name in the book, just to see. In the morning someone had written the room number beside it.',
        ],
    },
    {
        id: 'theo', name: 'Theo Park', role: 'age 11, Ashmere Elementary', where: 'school', chrono: 10,
        art: 'an eleven-year-old Korean-American boy with messy hair and a too-big hoodie, gap-toothed, holding a crayon, curious serious eyes',
        text: [
            'This is my secret journal DO NOT READ. The hum is singing now. It is not scary if you listen right. It sounds like everybody in town humming the same song very quietly with their mouths shut.',
            'There is a yellow door in the school basement by the boiler. Mr. Ellery says there is no basement door, only the boiler. But I saw it. Through the crack it is like a hallway in a dream where you are late for something.',
            'Mom says the lab is making the noise and it will stop soon. I asked if it will stop before it finishes the song. She did not answer.',
        ],
    },
    {
        id: 'lou', name: 'Lou Brandt', role: 'night bus driver, Route 9', where: 'garage', chrono: 11,
        art: 'a grizzled night bus driver in his late fifties with a transit cap and a cardigan over a uniform shirt, thick glasses, weathered face',
        text: [
            'Route 9, last run. Twenty-two stops between the depot and the canning works. Tonight there were twenty-five. The new ones came after Elm, after Halsey, after the lab gate. Shelters and everything. Fluorescent tubes buzzing over empty benches.',
            'At the third one a woman got on. She paid. She sat at the back. When we pulled into the depot she was gone and the coin she paid with was warm, and it said ASHMERE on it where it should say LIBERTY.',
            'I am not driving Route 9 tomorrow. I said so to dispatch. Dispatch said what Route 9.',
        ],
    },
    {
        id: 'agnes', name: 'Agnes Whitlow', role: 'head librarian, Ashmere Public Library', where: 'library', chrono: 12,
        art: 'a prim librarian in her sixties with cat-eye glasses on a chain, grey bob, high-collared blouse, steely skeptical face',
        text: [
            'I have been reading everything in this building that touches on resonance, standing waves, the Tesla nonsense, the 1908 papers. Dr. Marrow borrowed most of them before I did. He returns them on time. He underlines in pencil, which I forgive.',
            'In the margin of Holtzmann\'s Harmonic Spaces he has written: a fold opened from this side must be closed from this side. Whoever is left must turn the dials back by hand.',
            'This week the pages have begun to go blank, from the back of each book forward, as if the words are being borrowed somewhere else. I am copying what I can into this diary. It is the only book in the building that is still getting longer.',
        ],
    },
    {
        id: 'rhea', name: 'Officer Rhea Montoya', role: 'Ashmere Police Department', where: 'office', chrono: 13,
        art: 'a Latina police officer in her thirties in a dark navy uniform, hair in a tight braid, radio on her chest, exhausted determined face',
        text: [
            'Missing persons, October 13th: forty-one reports by midnight. Every one of them the same: went to get a glass of water, went to check on the kids, went to see what the humming was. Doors left open. Kettles on.',
            'I drove past the lab at 2 a.m. The perimeter fence was chained from the inside. The whole complex was lit up yellow and every window was humming like a struck bell.',
            'Captain says hold until morning. I am going back with bolt cutters. If anyone finds my cruiser at the gate, I went in. I went in on purpose.',
        ],
    },
    {
        id: 'nadia', name: 'Nadia Sorensen', role: 'waitress, the Lantern Diner', where: 'shop', chrono: 14,
        art: 'a Scandinavian diner waitress in her thirties in a pale blue uniform and apron, pencil behind her ear, blonde ponytail, frightened eyes',
        text: [
            'The night of the 14th. I am writing this in the diner because I do not know where else to go. At 3:30 the hum stopped. Everything stopped. The fridge, the fans, the cars on the bypass. Silence like cotton wool.',
            'Then every light in Ashmere turned the same yellow, and the people who were awake started walking. Not running. Walking, calm, all in the same direction, toward the lab. Like they were late for a shift.',
            'I can feel it pulling at me too. It is a very gentle pull. It feels like being called in for dinner. I am going to hold on to the counter as long as I',
        ],
    },
    {
        id: 'sam', name: 'Sam Kier', role: 'age 16, skateboarder', where: 'warehouse', chrono: 15,
        art: 'a sixteen-year-old skateboarder with a shaved undercut and a beanie, chipped black nail polish, flannel shirt, guarded defiant eyes',
        text: [
            'ok so I was in the old Brannock warehouse on the 14th, skating the loading ramp, totally alone, and at 3:33 the whole town went quiet like somebody pressed mute.',
            'then everybody started walking past the warehouse. my neighbours. my maths teacher. my mom. in their pyjamas, not talking. I yelled at her and she smiled at me like I was a little kid having a nightmare and kept going.',
            'I followed them to the lab. the fence was open. there is a ring in the big hall and the middle of it is yellow and it goes back forever, rooms and rooms and rooms, and they just walked in one by one. I didn\'t. I hid. I am still hiding. I don\'t know how long it\'s been. the cans in the vending machine keep coming back.',
        ],
    },
    {
        id: 'cal', name: 'Cal Dempsey', role: 'attendant, Civic Centre Parking', where: 'garage', chrono: 16,
        art: 'a lanky parking garage attendant in his twenties in a reflective vest over a hoodie, headphones, shaggy hair, startled pale face',
        text: [
            'Level 4 of the garage is not supposed to exist. We have three levels. The ramp just keeps going up now, past the roof, and the next level has the same oil stains in the same places as Level 3, and the same cars, with nobody in them, with their headlights on.',
            'The ticket machine prints tickets with no date. Only the time, 3:33, over and over.',
            'I parked my own car on Level 4 tonight to see if it would still be there in the morning. It was. There was a second one beside it. Same plates.',
        ],
    },
];

/** The last diary is always the lab director's. It carries the lab keycard and tells you where to go. */
export const MARROW = {
    id: 'marrow', name: 'Dr. Elias Marrow', role: 'director, Threshold Resonance Laboratory', where: 'house', chrono: 99,
    art: 'a gaunt physicist in his sixties with untidy white hair and round wire glasses, rumpled tweed jacket over a turtleneck, haunted guilty eyes',
    text: [
        'If you are reading this then you slept through it, and the Between did not want you. It only takes the waking. I have been trying for a long time to be glad of that on your behalf.',
        'I opened it. Not the accident they will call it; I opened the fold on purpose, at full power, at 3:33 on the fourteenth, because I wanted to see. I saw. And then everyone who was awake in Ashmere walked in after me, and the fold closed behind them, and I was on this side, alone, with my hands on the dials.',
        'It can be reversed. A fold opened from this side must be closed from this side. Power the hall. Set the three resonance dials. Throw the four conduits in the order the others remembered; they each held a piece of it, because I gave a piece to each of them, in case. My keycard is with this book. The lab is in the industrial district. Bring them home.',
    ],
};

/** Hints and fragments the city is littered with: notes, headlines, posters, radio. Pure flavour, collected for the journal. */
export const FRAGMENTS = [
    'ASHMERE COURIER, Oct 2: "LAB EXPANSION APPROVED DESPITE NOISE COMPLAINTS."',
    'ASHMERE COURIER, Oct 9: "CITY HALL: HUM IS NORMAL TRANSFORMER ACTIVITY, NO CAUSE FOR CONCERN."',
    'ASHMERE COURIER, Oct 13: "FORTY MISSING. POLICE ASK RESIDENTS TO STAY INDOORS AND STAY AWAKE." The rest of the page is blank.',
    'A sticky note on a fridge: "Mom, went to see what the humming is. Back in 5. —T"',
    'A child\'s drawing in crayon: a ring, and a yellow door inside it, and a lot of small people holding hands.',
    'A shopping list: milk, bread, batteries, earplugs (LOTS), sleeping pills — "the ones that knock you out."',
    'A union notice at the canning works: "NIGHT SHIFT SUSPENDED UNTIL THE HUM IS INVESTIGATED."',
    'A flyer: "THRESHOLD LABORATORY OPEN DAY — SEE THE FUTURE OF ENERGY." Someone has written "IT\'S NOT ENERGY" across it.',
    'A hospital memo: "Staff are reminded that patients found sleepwalking are to be returned to bed and NOT followed."',
    'A receipt from the Lantern Diner, Oct 14, 3:29 a.m. Two coffees. One was never drunk.',
    'A cassette tape labelled "WKVR — DO NOT ERASE." The tape is warm.',
    'A hotel key with no room number. Just a zero, scratched in by hand.',
    'A lost-dog poster. Then another. Then a wall of them, every dog in Ashmere, all lost the same week.',
    'A note under a windscreen wiper: "If you came back, the keys are in the sun visor. We walked. —R."',
    'A school register for Oct 14. Every name ticked absent except one, and that one is circled.',
    'A page torn from a technical manual: "Resonance cavity must never be operated by a single technician."',
    'A wedding photograph. The faces have been rubbed out by a thumb, gently, over and over.',
    'A child\'s note: "The hum is a song. If you sing the other half it goes quiet."',
    'A bus timetable for Route 9 with three stops added in ballpoint pen: "Yellow Hall," "Further," "Home?"',
    'Graffiti in a stairwell: "WE ARE ONE FLOOR DOWN."',
    'A crossword from the 14th, half-finished. 7 down: "Space between two others (7)." Someone has filled in BETWEEN.',
    'A letter, never posted: "Dear Mum, the town is lovely, the people are kind, nobody sleeps any more."',
    'A security log, Hollow Oaks Mall: "03:33 — door behind unit 14 found open. 03:34 — door not found."',
    'A prescription bottle, empty. Label: "Take one at bedtime. Do not operate machinery. Do not answer the door."',
    'A banner over the high street: "ASHMERE FALL FESTIVAL — OCT 15." It never happened.',
    'Chalk on the pavement, a hopscotch grid with one extra square at the end, coloured in yellow.',
    'A voicemail transcript taped to a payphone: "It\'s me. It\'s nice here. Don\'t come. It\'s nice here. Don\'t come."',
    'A lab badge photo of someone you don\'t recognise. On the back: "Hall C. Don\'t look into the ring for long."',
    'A church notice board: "Evening prayer cancelled. Pray anyway. Pray awake."',
    'A pressed flower in a library book, and a slip that says "due back Oct 15."',
];

/** Things the working vending machines say when you buy a can. */
export const VENDING = [
    'A can of Lumen Cola thunks into the tray. It is ice cold. It should not be.',
    'Lumen Cola, Midnight Cherry. The date on the can is the fourteenth of October.',
    'The machine hums, considers you, and gives you a can of grape soda you did not choose.',
    'A can drops. Then, after a long moment, a second one. As if for someone standing beside you.',
    'Lumen Cola. Cold. The coins you fed it come back out of the return slot, warm.',
    'The machine lights up yellow and drops a can of ginger ale. On the back, someone has scratched "thank you".',
];
