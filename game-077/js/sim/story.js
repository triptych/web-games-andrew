// CUE VICE — the script. Scenes play between episodes over the 3D cinema;
// radio lines pop up during play when something happens for the first time.
//
// Speakers are keys into SPEAKERS (portrait + colour). A line is
// [speaker, text] or a stage direction ['', text].

export const SPEAKERS = {
    rico: { name: 'RICO', color: '#2ff2e0' },
    lola: { name: 'LOLA', color: '#ff4fa8' },
    doc: { name: 'DOC', color: '#8dff8a' },
    dex: { name: 'DEX', color: '#ff8a3a' },
    jinx: { name: 'JINX', color: '#b44cff' },
    tito: { name: 'TITO', color: '#4fd8ff' },
    roxy: { name: 'ROXY', color: '#ffe45c' },
    dana: { name: 'LT. DANA PRICE', color: '#ffb0d8' },
    briggs: { name: 'CAPT. BRIGGS', color: '#c8c8d8' },
    benny: { name: 'BENNY (TAPE)', color: '#ffd8a0' },
    nico: { name: 'NICO VALENTE', color: '#ffe45c' },
    eddie: { name: 'EDDIE MARSH', color: '#d8d0ff' },
    shark: { name: 'THE SHARK', color: '#ff2e3e' },
    '': { name: '', color: '#ffffff' },
};

export const SCENES = {
    prologue: {
        title: 'Miami, 1986', bg: 'causeway',
        lines: [
            ['', 'Biscayne Bay. Two in the morning. The water is the colour of a pink neon sign switched off.'],
            ['rico', 'Benny, they’re late. Nobody’s late to a buy this size.'],
            ['benny', 'Relax, Rico. Valente’s boys are never on time. Let’s go knock on the boathouse.'],
            ['', 'The boathouse lights snap on. Every window. Every gun.'],
            ['', 'Somebody told them we were coming.'],
            ['rico', 'Benny! BENNY!'],
            ['', '—'],
            ['briggs', 'Internal Affairs wants your badge, Vega. I told them you’d take a week. Take the week.'],
            ['rico', 'Benny wore a wire that night, Captain. Where’s the tape?'],
            ['briggs', 'There was no tape. Go home.'],
            ['dana', 'There was a tape, Rico. It never reached evidence. Benny hid a spare in the marina, I’d bet my pension on it.'],
            ['dana', 'Off the books. Just you, me on the radio, and whatever you can line up.'],
            ['rico', 'Then let’s rack ’em up.'],
        ],
    },
    ep1in: {
        title: 'Episode 1 — Night Moves', bg: 'marina',
        lines: [
            ['dana', 'Dinner Key Marina. Valente’s crew still uses Benny’s boathouse. Three of them tonight.'],
            ['rico', 'And I’m one guy with no backup and no badge.'],
            ['dana', 'You’re one guy who never missed a bank shot in his life. Treat it like a table: angles, cushions, and don’t let them see you coming.'],
        ],
    },
    ep1out: {
        title: 'Benny’s tape', bg: 'night',
        lines: [
            ['', 'Hiss. A car door. Then Benny’s voice, close to the mic.'],
            ['benny', 'If you’re hearing this, partner, I was right. Somebody inside is selling us. Valente’s just the muscle.'],
            ['benny', 'The money goes through the Flamingo. There’s a bartender there, Lola. She knows. Find her before they do.'],
            ['benny', 'And Rico... the buyer calls himself the Shark.'],
            ['dana', 'Club Flamingo. Ocean Drive. Valente’s own club.'],
            ['rico', 'Then I’d better dress for it.'],
        ],
    },
    ep2in: {
        title: 'Episode 2 — Club Flamingo', bg: 'night',
        lines: [
            ['dana', 'Word is Lola Reyes got made an hour ago. They’ve got her in the VIP lounge waiting for Valente.'],
            ['dana', 'His ledger’s in the back office. Door’s on a switch behind the bar.'],
            ['rico', 'Neon bumpers on the dance floor?'],
            ['dana', 'It’s 1986, Rico. Everything has neon bumpers.'],
        ],
    },
    ep2out: {
        title: 'Lola', bg: 'causeway',
        lines: [
            ['lola', 'You’re Benny’s partner. He talked about you. Said you play pool like it’s geometry homework.'],
            ['rico', 'He said you were the best shot in Dade County.'],
            ['lola', 'Olympic alternate, 1984. Tranquilizer darts now. I’m not going to prison for Nico Valente.'],
            ['lola', 'The ledger has a name in it. Eddie Marsh. He keeps the Shark’s books. They put him in Mercy General this afternoon. Broken legs.'],
            ['dana', 'And tonight they’ll finish the job. Go.'],
        ],
    },
    ep3in: {
        title: 'Episode 3 — Code Blue', bg: 'night',
        lines: [
            ['', 'Mercy General. Third floor. Somebody already got to the squad on the way in.'],
            ['doc', 'Hold still. You’re bleeding on my floor.'],
            ['rico', 'Who are you?'],
            ['doc', 'Marisol Santos. ER. The cartel killed my brother last spring, so if you’re here for Eddie Marsh, I’m coming.'],
            ['doc', 'Bump into me and I’ll patch you up. I can also make a very good argument for a sedative.'],
            ['dana', 'Eddie can’t walk. You’re going to have to roll him to the ambulance bay. Gently.'],
        ],
    },
    ep3out: {
        title: 'The books', bg: 'causeway',
        lines: [
            ['eddie', 'Valente moves the product. The Shark moves the money. Cars, mostly. Sunshine Motors in Hialeah.'],
            ['eddie', 'Three cars a week leave that lot with cash in the door panels. Ex-army guy owns the place. They’re squeezing him.'],
            ['doc', 'You’re going to need someone who can open a door panel the hard way.'],
        ],
    },
    ep4in: {
        title: 'Episode 4 — Hot Wheels', bg: 'sunset',
        lines: [
            ['dex', 'Dex Monroe. Army engineer, Grenada. I fix cars now. Fixed. They took my shop.'],
            ['dex', 'Three of those cars out there are full of the Shark’s money. I’d like very much to set them on fire.'],
            ['rico', 'Quietly?'],
            ['dex', 'I can do quiet. I just never enjoy it.'],
            ['dana', 'Watch for dogs in the junkyard. They hear better than they see.'],
        ],
    },
    ep4out: {
        title: 'Pink slips', bg: 'night',
        lines: [
            ['dex', 'Every one of those cars was registered to a shell company. WSVU Holdings.'],
            ['dana', 'WSVU. That’s Channel 7. The TV station.'],
            ['lola', 'The money’s wired out through the station’s accounts. We need the transfers.'],
            ['dana', 'There’s a kid who’s been jamming the cartel’s radios from a pirate station on the same tower. Jinx. They found her this morning.'],
        ],
    },
    ep5in: {
        title: 'Episode 5 — Static', bg: 'night',
        lines: [
            ['dana', 'Lasers, cameras, and a mainframe the size of a refrigerator. The radio booth is behind the control-room lock.'],
            ['rico', 'And the kid?'],
            ['dana', 'In the booth. If she’s half as good as her jamming, she’ll get you into that mainframe.'],
        ],
    },
    ep5out: {
        title: 'Jinx', bg: 'causeway',
        lines: [
            ['jinx', 'Okay so, the wires all go to the same account, and the account pays a shipping company at the Port, and the shipping company is owned by— hang on—'],
            ['jinx', '—by a guy who doesn’t exist. Fun. The container’s at Dodge Island. Red one. Dawn shipment.'],
            ['rico', 'You came out of that booth like a ghost.'],
            ['jinx', 'Ghost mode. Nobody sees me when I don’t want them to. It’s a gift. Also a radio trick.'],
            ['dana', 'The longshoremen at the port answer to Tito Fuentes. He’ll help if you ask nice.'],
        ],
    },
    ep6in: {
        title: 'Episode 6 — Port of Call', bg: 'dawn',
        lines: [
            ['tito', 'Valente’s people threatened my crews. My crews have families. So.'],
            ['tito', 'The red container. Cracked doors. I will open it.'],
            ['rico', 'You got a key?'],
            ['tito', 'I am the key.'],
        ],
    },
    ep6out: {
        title: 'The manifest', bg: 'sunset',
        lines: [
            ['jinx', 'The manifest’s signed off by Valente himself. And look— the delivery address is a house on Star Island.'],
            ['tito', 'Nico Valente’s house. A party tonight. Very exclusive.'],
            ['roxy', 'Not so exclusive. I’m singing at it.'],
            ['rico', 'Roxy Starr? The Roxy Starr?'],
            ['roxy', 'Nico owns my contract, my masters and my manager. I want out. You want Nico. Let’s make a deal.'],
        ],
    },
    ep7in: {
        title: 'Episode 7 — Velvet Rope', bg: 'night',
        lines: [
            ['roxy', 'Three rooms matter: his study, the master bedroom and the hall bar. Bug all three.'],
            ['roxy', 'If anybody gets close, I’ll put on a record. Nobody on Star Island can resist a dance floor.'],
            ['rico', 'And Nico?'],
            ['roxy', 'Nico can’t swim. Did I mention the pool?'],
        ],
    },
    ep7out: {
        title: 'Wet', bg: 'night',
        lines: [
            ['nico', '*cough* You think I’m the top? I’m the middle, cop. The Shark gives me orders through your own precinct.'],
            ['nico', 'Ask your captain why your raids always find empty boats.'],
            ['', 'The bugs pick up a phone call from the study an hour later.'],
            ['briggs', 'Valente’s blown. Clean it up. And Vega’s little club? Have them picked up. All of them.'],
            ['dana', 'Rico. There’s an APB out on the whole squad. Briggs signed it.'],
            ['rico', 'Then we go get the proof out of his own safe.'],
        ],
    },
    ep8in: {
        title: 'Episode 8 — The Leak', bg: 'night',
        lines: [
            ['dana', 'Metro-Dade Vice. Your old desk. Every cop in there thinks you’re dirty.'],
            ['dana', 'They’re not the enemy, Rico. No alarms. If anyone calls it in, it’s over. And try not to flatten any officers.'],
            ['rico', 'Briggs’s safe and Benny’s evidence box. In and out.'],
        ],
    },
    ep8out: {
        title: 'The Shark', bg: 'night',
        lines: [
            ['', 'Inside the safe: bank books, a deed to an island in Biscayne Bay, and a cassette labelled ORTIZ.'],
            ['rico', 'Briggs. You sold Benny out.'],
            ['briggs', '(on the tape) Ortiz is wearing a wire tonight. Tell Valente’s boys to use the boathouse.'],
            ['dana', 'He’s running. Rickenbacker Causeway, heading for Key Biscayne. He’s got a boat waiting.'],
            ['tito', 'Then we cross the causeway.'],
            ['dex', 'In traffic?'],
            ['lola', 'In traffic.'],
        ],
    },
    ep9in: {
        title: 'Episode 9 — Shark Week', bg: 'sunset',
        lines: [
            ['dana', 'Four lanes, sixty miles an hour, and Briggs’s goons on the far side. He dropped a briefcase on the median.'],
            ['rico', 'Get the case, cross the road, take the boat.'],
            ['jinx', 'Frogger. We’re doing Frogger.'],
        ],
    },
    ep9out: {
        title: 'Storm warning', bg: 'storm',
        lines: [
            ['dana', 'Hurricane Kate turned in the night. It’s on top of the bay now.'],
            ['dana', 'Briggs made it to the island. Isla Tiburón. The Shark’s whole crew is there, and the money.'],
            ['rico', 'Benny’s killer is on that island. I’m not waiting for the weather.'],
            ['doc', 'None of us are.'],
        ],
    },
    ep10in: {
        title: 'Episode 10 — Isla Tiburón', bg: 'storm',
        lines: [
            ['briggs', '(over the island’s loudspeakers) Vega! You should’ve taken the week!'],
            ['roxy', 'Charming.'],
            ['dana', 'The vault holds the cash. The black book holds every name he ever bought. And Briggs…'],
            ['rico', 'Briggs keeps a shark tank in his living room. I read the file.'],
            ['jinx', 'Poetic justice is a valid strategy.'],
        ],
    },
    ending: {
        title: 'Last call', bg: 'dawn',
        lines: [
            ['', 'Dawn comes up pink over the bay. The storm has blown out to sea.'],
            ['dana', 'The black book has forty-one names. Judges. A councilman. Six cops. It’s going to be a busy year.'],
            ['briggs', '(from a dripping stretcher) ...I want a lawyer.'],
            ['doc', 'You want a tetanus shot. That tank was filthy.'],
            ['dex', 'I’m rebuilding the shop. Sunshine Motors, under new management.'],
            ['tito', 'My crews go back to work tomorrow.'],
            ['roxy', 'And I own my masters. Tour starts in June.'],
            ['jinx', 'WJNX is back on the air. First song goes out to Benny Ortiz.'],
            ['lola', 'And you, Rico?'],
            ['rico', 'Tuesday is nine-ball night. Benny always broke first.'],
            ['rico', 'Rack ’em up.'],
        ],
    },
};

/** Scene to play before / after a given episode number. */
export function sceneBefore(ep) { return ep === 1 ? ['prologue', 'ep1in'] : [`ep${ep}in`]; }
export function sceneAfter(ep) { return ep === 10 ? ['ep10out', 'ending'].filter((k) => SCENES[k]) : [`ep${ep}out`]; }

// Radio: [speaker, text]. Keys fire at most once per episode.
export const RADIO = {
    first: ['dana', 'Drag back from Rico and let go to shoot. Watch the white cones: that’s what they can see. Hit a guard from behind and he’s out.'],
    first2: ['dana', 'Time only moves while you do. Hold WAIT if you want to let them walk past.'],
    spotted: ['dana', 'Question mark means he saw something. Get out of his cone before it turns into an exclamation mark.'],
    alarm: ['dana', 'You’re made! Get out of sight. They’ll give up and search, then go back to their rounds.'],
    ko: ['dana', 'Nice. Knocked-out guards wake up eventually, and their friends will notice a body. Knock him into the water and he’s gone for good.'],
    body: ['dana', 'They found a body. They’re jumpier now: CAUTION.'],
    sunk: ['rico', 'Corner pocket.'],
    splash: ['dana', 'Wet suit, wet heart. Falling in costs a heart, Rico.'],
    bank: ['dana', 'Bank shots score style points. The Rep you earn buys gear at the garage.'],
    bumper: ['dana', 'Those bumpers kick back hard. Use them.'],
    recruit: ['lola', 'Over here! Roll into me and I’m in.'],
    join: ['lola', 'Darts are ready. Shoot me, then tap while I’m rolling to fire where I’m heading. They bank once off a wall.'],
    vip: ['eddie', 'Please be gentle, my legs are in casts. Also please don’t roll me into a laundry chute.'],
    heal: ['doc', 'Bump into a teammate with me and they get a heart back. Tap while I roll for a pulse that heals everyone nearby.'],
    camera: ['dana', 'Security cameras. They sweep, they can’t be bribed, and a dart breaks them.'],
    boom: ['dex', 'Shoot me, tap to blow. Big boom, lots of noise. Everyone close gets knocked over — friends too, except me.'],
    dog: ['dana', 'Dogs smell you even from behind. Keep your distance.'],
    laser: ['dana', 'Lasers trip the alarm. Some blink. Time the gap.'],
    terminal: ['dana', 'Roll into a terminal to use it. The secure ones need Jinx.'],
    secure: ['rico', 'This one’s locked tight. Need Jinx for it.'],
    jinx: ['jinx', 'Tap while I roll and I go ghost: no cameras, no lasers, no eyes. And I hack anything I roll near.'],
    tito: ['tito', 'Cracked walls and crates I can walk through. Tap while I roll and I plant my feet. Everything near me gets a shove.'],
    boombox: ['roxy', 'Tap while I roll and I drop a boombox. Ten seconds of dance floor.'],
    boss: ['dana', 'Valente takes more than one hit. Wear him down, then put him in the pool.'],
    noalarm: ['dana', 'No alarms in here, Rico. Not one.'],
    cops: ['dana', 'Those are our people. Knocking out an officer costs you.'],
    traffic: ['dana', 'Cars don’t stop for anyone. Time flows while you roll, so watch the gaps.'],
    finale: ['dana', 'The tank is in the great hall. The vault opens from the security room or the switch out east.'],
    exitLocked: ['dana', 'Not yet. Finish the job first, then get to the car.'],
    allClear: ['dana', 'That’s everything. Get everyone to the car.'],
    downed: ['dana', 'Teammate down! Doc can get them back up. Or knock them to the exit, nobody gets left behind.'],
    rebank: ['rico', 'Bank on it. One more shot from here.'],
    rewind: ['dana', 'Instant Replay. Let’s pretend that didn’t happen.'],
};

/** Which tips each level shows at the start (from def.tips). */
export const TIP_START = {
    first: ['first', 'first2'], bumper: ['bumper'], recruit: [], vip: ['vip'], heal: ['heal'], camera: ['camera'],
    boom: ['boom'], dog: ['dog'], laser: ['laser'], terminal: ['terminal'], tito: ['tito'], boombox: ['boombox'],
    boss: ['boss'], noalarm: ['noalarm'], cops: ['cops'], traffic: ['traffic'], finale: ['finale'],
};
