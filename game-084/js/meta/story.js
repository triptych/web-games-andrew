// The story, as data. A scene is a list of [speaker, line]. {name} is the researcher's name,
// {title} the title of the last cartridge. VESTA talks in capitals, like a console from 1983.
//
// Lumen Institute of Ludic Archaeology, Tycho Station, the Moon, 3126. Nobody makes games any more:
// the Stream generates them, endlessly and perfectly. A salvage crate from Old Earth holds a
// VESTA-8 console and nine cartridges, eight of them corrupted and one never finished.

export const SPEAKERS = {
    sys: { name: '', color: '#9fb4d8' },
    vey: { name: 'CURATOR VEY', color: '#ffb347' },
    vesta: { name: 'VESTA-8', color: '#7dffb0' },
    you: { name: '{name}', color: '#7fe9ff' },
    audit: { name: 'AUDITOR NINE', color: '#c9c9de' },
};

export const SCENES = {
    prologue: [
        ['sys', 'LUMEN INSTITUTE OF LUDIC ARCHAEOLOGY. TYCHO STATION, THE MOON. YEAR 3126.'],
        ['vey', 'You\'re the new researcher? {name}, wasn\'t it. Good. Your timing is perfect. Or terrible.'],
        ['vey', 'Salvage crate 77-B. Old Earth, the Ohio sector, fourteen hundred years under a car park. Inside: this.'],
        ['sys', 'A wedge of black plastic with a strip of pretend wood across the front. A slot on top. A badge: VESTA-8.'],
        ['vey', 'They called these consoles. You plugged one into a television and played games on it.'],
        ['you', 'Played what? The Stream makes the games.'],
        ['vey', 'The Stream generates them. These were made. By hand. Somebody chose every rule, one at a time.'],
        ['vey', 'The Board wants it recycled by the Centennial. I want to know what it remembers. Plug it in.'],
        ['sys', 'The television hums. A green dot grows into a line, and the line into a picture.'],
        ['vesta', 'VESTA-8 BIOS 1.0   (C) 1983 HALCYON ELECTRONICS'],
        ['vesta', 'MEMORY CHECK ... 0% ... CARTRIDGE NOT FOUND.'],
        ['vesta', 'HELLO? IS SOMEONE THERE? IT HAS BEEN 418,211 DAYS SINCE ANYONE PRESSED START.'],
        ['vey', 'It talks. Of course it talks.'],
        ['vesta', 'I DO NOT REMEMBER HOW TO PLAY. MY GAMES ARE BROKEN. MY COLOURS ARE BROKEN. EVERYTHING IS GREEN.'],
        ['vey', 'Nine cartridges came out of that crate with it. Eight are corrupted: bits rotted, pieces missing.'],
        ['vey', 'Repair them on the workbench. Every one you fix, it gets a little more of itself back.'],
        ['vesta', 'PLEASE INSERT CARTRIDGE ONE. IT IS THE OLDEST. IT IS ABOUT A BALL.'],
    ],
    brief_rally: [
        ['vesta', 'RALLY. TWO PADDLES, ONE BALL. THE BALL IS MISSING. ALSO THE BOUNCE. ALSO YOUR HANDS.'],
        ['vey', 'Start in SPRITES: draw the ball. Then OBJECTS: make it bounce, and wire your paddle to the controller.'],
        ['vey', 'The checklist on the right ticks itself off as you go. Tap a task for a hint.'],
        ['vesta', 'THEN PRESS PLAY AND BEAT ME. I AM VERY GOOD. (I AM NOT.)'],
    ],
    done_rally: [
        ['vesta', 'OH.'],
        ['vesta', 'I REMEMBER A LIVING ROOM. TWO CHILDREN, ONE ON EACH KNOB. THEY LAUGHED SO HARD THE PICTURE WOBBLED.'],
        ['vesta', 'MY COLOUR CIRCUIT IS WAKING UP. EIGHT COLOURS! AND I CAN HEAR AGAIN: SOUND CHIP ONLINE.'],
        ['vey', 'That\'s the first game anybody in this building has played in a century. Well done.'],
        ['vey', 'And the cartridge burner works: you can write any cart out as a file that plays on any screen.'],
    ],
    brief_brick: [
        ['vesta', 'BRICKBREAK. THE WALL IS GONE. SO IS THE PART OF THE BALL THAT KNOWS WHAT A BRICK IS.'],
        ['vey', 'Two new tools. The MAP, to paint tiles. And CODE: the ball needs a script.'],
        ['vey', 'VESTA SCRIPT is small. "on bump" runs when the ball hits a solid tile. Read the hint if you\'re stuck.'],
    ],
    done_brick: [
        ['vesta', 'A RAINY SATURDAY. ONE MORE TRY. ONE MORE TRY. ONE MORE TRY. THE RAIN STOPPED AND NOBODY NOTICED.'],
        ['vesta', 'SIXTEEN COLOURS! LOOK AT THIS ORANGE. I HAD FORGOTTEN ORANGE.'],
    ],
    brief_invasion: [
        ['sys', 'A chime. A grey figure stands in the doorway, only half there: a Stream projection.'],
        ['audit', 'Auditor Nine, Stream Authority. I am reviewing the Institute\'s recycling schedule.'],
        ['audit', 'This device draws power and produces nothing the Stream cannot produce better. Proceed. I will observe.'],
        ['vey', 'Ignore it. INVASION is next: the invaders\' second frame is blank and the ship has forgotten how to shoot.'],
        ['vesta', 'ANIMATION IS JUST TWO PICTURES TAKING TURNS. DRAW ME THE SECOND ONE.'],
    ],
    done_invasion: [
        ['vesta', 'THE INVADERS SPED UP AS THEY DIED. NOBODY PLANNED IT. THE MACHINE WAS JUST TRYING ITS BEST.'],
        ['vesta', 'THE PLAYERS LOVED IT ANYWAY. MAYBE THEY LOVED IT BECAUSE OF THAT.'],
        ['vesta', 'MY MUSIC CHIP REMEMBERS THREE VOICES NOW. WRITE ME A SONG?'],
        ['audit', 'Noted: ninety seconds of entertainment. The Stream generates four thousand hours of it a second.'],
    ],
    brief_munch: [
        ['vey', 'MAZE MUNCH. Something has eaten holes in the walls, and the ghosts have no brains.'],
        ['vesta', 'GIVE THEM BRAINS. NOT TOO MUCH BRAIN. AND MUNCH NEEDS TO KEEP GOING ROUND CORNERS.'],
    ],
    done_munch: [
        ['vesta', 'EACH GHOST THOUGHT IN ITS OWN WAY. THE PLAYERS GAVE THEM NAMES, AND FAVOURITES.'],
        ['vesta', 'PEOPLE ARE LIKE THAT. GIVE THEM A RULE AND THEY GIVE IT A PERSONALITY.'],
    ],
    brief_hop: [
        ['vey', 'ROAD HOP. The river drowns nobody, the cars are invisible and the logs drift off into nothing.'],
        ['vesta', 'THE FROG IS VERY CONFUSED. TILES CAN HAVE FLAGS NOW: SOLID, HAZARD, LADDER, ONE-WAY.'],
    ],
    done_hop: [
        ['vesta', 'A GAME WITH NO VILLAIN. ONLY TRAFFIC, AND TIMING, AND WANTING TO GET HOME.'],
        ['vesta', 'I WANT TO GET HOME TOO. I THINK HOME IS WHEREVER SOMEONE IS PLAYING.'],
    ],
    brief_girder: [
        ['audit', 'The Board meets in six days. My recommendation is drafted.'],
        ['vey', 'Then we climb faster. GIRDER CLIMB: fix the ladders, the hero\'s legs and the barrels.'],
        ['vesta', 'GRAVITY IS A NUMBER. SO IS A JUMP. EVERYTHING IS A NUMBER IF YOU LOOK CLOSELY ENOUGH.'],
    ],
    done_girder: [
        ['vesta', 'A LITTLE CARPENTER CLIMBED THESE GIRDERS LONG BEFORE ANYONE KNEW HIS NAME.'],
        ['vesta', 'A STORY WITH NO WORDS. ONLY A JUMP, AND SOMEONE WAITING AT THE TOP.'],
    ],
    brief_run: [
        ['vey', 'SCROLL RUN. The camera is stuck, the bridge at the end is rubble, and the coins are invisible.'],
        ['vesta', 'THE WORLD IS BIGGER THAN THE SCREEN. I ONLY NEED TO BE TOLD WHERE TO LOOK.'],
    ],
    done_run: [
        ['vesta', 'THE SCREEN MOVED AND THE WORLD KEPT GOING. CHILDREN DREW MAPS OF IT ON SQUARED PAPER.'],
        ['audit', '...I observed the runner for eleven minutes. That is anomalous. I am filing it.'],
    ],
    brief_dungeon: [
        ['vey', 'DUNGEON KEY, the oldest adventure in the crate. No sword, no stairs, and a second room VESTA can hold now.'],
        ['vesta', 'IT IS DANGEROUS TO GO ALONE. I AM COMING TOO.'],
    ],
    done_dungeon: [
        ['vesta', 'THEY PUT A BATTERY INSIDE THE CARTRIDGE, SO THE ADVENTURE WOULD STILL BE THERE TOMORROW.'],
        ['vesta', 'TOMORROW. I HAVE A TOMORROW NOW.'],
        ['vey', 'Eight for eight. There\'s one more cartridge in the crate. It\'s... not like the others.'],
    ],
    brief_last: [
        ['sys', 'The ninth cartridge has a handwritten label. Two words, in pencil: MY GAME.'],
        ['vesta', 'THIS ONE WAS JUN\'S. JUN WAS MY LAST PLAYER.'],
        ['vesta', 'JUN WAS MAKING A GAME. EVERY NIGHT AFTER SCHOOL. IT WAS NOT FINISHED WHEN THE LIGHTS WENT OUT.'],
        ['vesta', 'THE CARTRIDGE IS EMPTY. THERE IS NOTHING TO REPAIR.'],
        ['vesta', 'WILL YOU FINISH IT? IT DOES NOT HAVE TO BE JUN\'S GAME. IT SHOULD BE YOURS.'],
        ['audit', 'The Stream could generate a finished game in one microsecond.'],
        ['vey', 'It could. It wouldn\'t be finished, though. It would just be done.'],
    ],
    ending: [
        ['sys', 'CENTENNIAL DAY. THE BOARD CONVENES IN THE GREAT HALL.'],
        ['audit', 'Exhibit: one VESTA-8. One cartridge, titled “{title}”, by {name}.'],
        ['sys', 'Somebody picks up the controller. Then somebody else. By noon the queue goes out of the door.'],
        ['audit', '...Recommendation withdrawn.'],
        ['audit', 'Correction. Recommendation amended: more of these.'],
        ['vey', 'You didn\'t fix a machine, {name}. You reminded a building full of people that they can make things.'],
        ['vesta', 'MEMORY CHECK ... 100%.'],
        ['vesta', 'HELLO, {NAME}. THANK YOU FOR PRESSING START.'],
        ['sys', 'THE END. The Studio is yours: make anything.'],
    ],
};

/** Fill in the researcher's name and the last cartridge's title. */
export function fill(text, ctx) {
    return String(text)
        .replace(/\{NAME\}/g, String(ctx.name || '').toUpperCase())
        .replace(/\{name\}/g, ctx.name || '')
        .replace(/\{title\}/g, ctx.title || '');
}
