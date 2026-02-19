// Room definitions for the game

export const ROOMS = [

    // ===== STARTING AREA =====

    {
        id: "damp_chamber",
        name: "Damp Chamber",
        description: "You wake with a start, the sound of dripping water echoing in your ears. Your head throbs, and your memories are hazy. Looking around, you find yourself in a damp, stone chamber lit by a single flickering torch mounted on the wall. The walls are covered in moss and ancient carvings you can't quite make out. Passages lead north and east. A downward slope continues south into deeper ground.",
        shortDescription: "A damp stone chamber. A flickering torch is mounted on the wall.",
        exits: {
            north: "narrow_corridor",
            east: "storage_room",
            south: "underground_stream"
        },
        items: ["old_torch"],
        examinable: {
            "carvings": {
                description: "The carvings depict a journey — a figure descending into darkness, carrying a light, and emerging into a great hall filled with celestial symbols. At the bottom of the carvings, barely legible text reads: 'Seek light in the depths, and the temple will yield its secrets.' You notice that lighting the way with a torch is clearly important in this place.",
                aliases: ["carving", "wall carvings", "wall carving", "inscription", "inscriptions"]
            },
            "torch": {
                description: "A torch mounted in an iron wall sconce. The flame flickers steadily, providing dim but reliable light. A second torch — a loose one — leans against the wall nearby, apparently forgotten here.",
                aliases: ["wall torch", "mounted torch", "sconce"]
            }
        },
        dark: false
    },

    {
        id: "narrow_corridor",
        name: "Narrow Corridor",
        description: "A narrow corridor stretches before you, carved from rough stone. The air is musty and stale. Ancient stone bricks line the walls, some crumbling with age. You can hear water dripping somewhere in the distance. The corridor leads west toward a grand entrance and back south to the damp chamber.",
        shortDescription: "A narrow stone corridor. It continues west toward the temple.",
        exits: {
            south: "damp_chamber",
            west: "temple_entrance"
        },
        items: [],
        dark: false
    },

    {
        id: "storage_room",
        name: "Storage Room",
        description: "This appears to be an old storage room. Rotting wooden crates and broken pottery litter the floor. Dust covers everything, and cobwebs hang from the ceiling. Against one wall, a rusty sword leans against a crate. A small alcove to the north looks darker than the rest of the room. An old iron door to the east, slightly ajar, leads to what appears to be an armory.",
        shortDescription: "An old storage room filled with broken crates. Exits lead north, east, and west.",
        exits: {
            west: "damp_chamber",
            north: "dark_alcove",
            east: "armory"
        },
        items: ["rusty_sword", "wooden_crate"],
        examinable: {
            "pottery": {
                description: "Shards of ancient pottery cover the floor. Most are plain utilitarian vessels — storage jars, oil containers, cups. One shard has a partial inscription that reads '...nd the light shall...' before breaking off. The pottery is centuries old.",
                aliases: ["pots", "pot", "broken pottery", "shards", "ceramic"]
            }
        },
        dark: false
    },

    {
        id: "dark_alcove",
        name: "Dark Alcove",
        description: "You step into a small, dark alcove. Without a light source, you can barely see anything. The walls feel damp to the touch, and you can sense something glinting in the darkness. A narrow tunnel continues east, descending into the rock.",
        shortDescription: "A pitch-black alcove. A narrow tunnel leads east into deeper darkness.",
        exits: {
            south: "storage_room",
            east: "collapsed_tunnel"
        },
        items: ["iron_key"],
        dark: true
    },

    {
        id: "temple_entrance",
        name: "Temple Entrance",
        description: "You stand before the grand entrance to an ancient temple. Massive stone columns rise on either side, carved with intricate hieroglyphics depicting forgotten gods and long-dead kings. The archway is imposing, the stonework immaculate. A heavy wooden door to the north is locked with an iron lock. To the west, a crumbling archway leads outside to an overgrown garden.",
        shortDescription: "The grand entrance to an ancient temple. A locked door stands to the north.",
        exits: {
            east: "narrow_corridor",
            north: "inner_sanctum",
            west: "temple_garden"
        },
        items: ["stone_tablet"],
        locked: {
            direction: "north",
            requiresKey: "iron_key"
        },
        examinable: {
            "hieroglyphics": {
                description: "The hieroglyphics tell the story of four celestial bodies: the Sun, Moon, Star, and Comet. A recurring phrase appears: 'In the order of the heavens, first light rules, the wanderer comes last, and between them dance the steadfast ones.' The symbols are carved with extraordinary precision. This sequence appears to be important.",
                aliases: ["hieroglyph", "symbols", "carvings", "inscription", "inscriptions"]
            },
            "columns": {
                description: "The massive columns are carved with scenes of priests performing rituals under a night sky. Each column shows a different phase of a celestial event — the passage of a comet through the heavens. The craftsmanship is remarkable, dating back thousands of years.",
                aliases: ["column", "pillar", "pillars", "stone columns"]
            },
            "door": {
                description: "A heavy wooden door reinforced with iron bands. The iron lock is large and old, but still solid. A keyhole is visible on the right side. The door clearly requires a substantial key.",
                aliases: ["wooden door", "iron door", "locked door", "temple door"]
            }
        },
        dark: false
    },

    {
        id: "inner_sanctum",
        name: "Inner Sanctum",
        description: "You have entered the inner sanctum of the ancient temple. The air here feels heavy with age and mystery. At the center, a stone pedestal holds a magnificent crystal that pulses with inner light. Ancient murals cover the walls, telling stories of a civilization long forgotten. A bronze-locked door stands to the west. Another passage leads east into a circular chamber. A stone trapdoor in the floor, with an iron ring, descends into darkness below.",
        shortDescription: "The inner sanctum. A glowing crystal rests on a pedestal. Passages lead east and west.",
        exits: {
            south: "temple_entrance",
            west: "library",
            east: "ritual_chamber",
            down: "crypt"
        },
        items: ["crystal_of_light"],
        locked: {
            direction: "west",
            requiresKey: "bronze_key"
        },
        examinable: {
            "murals": {
                description: "The murals depict a great civilization that worshipped celestial bodies. One scene shows priests arranging four crystals in a pattern matching the night sky. Another shows the crystals merging into a single brilliant light that banished some great darkness. The final panel shows the crystals being scattered — hidden in different parts of the temple. An inscription reads: 'Divided for safety. United for power.'",
                aliases: ["mural", "paintings", "painting", "wall art", "wall paintings"]
            },
            "pedestal": {
                description: "The stone pedestal is carved with celestial symbols matching those on the stone tablet. At its base, an inscription reads: 'The Crystal holds only a fraction of its ancient power. Unite the shards to restore what was lost.' This suggests the crystal is incomplete.",
                aliases: ["stone pedestal", "crystal pedestal"]
            },
            "trapdoor": {
                description: "A heavy stone trapdoor with an iron ring handle. Cold air rises from below, carrying the faint smell of old stone and something else — a faint, otherworldly glow. Whatever lies beneath the sanctum has not been disturbed in a very long time. It leads down into the temple crypt.",
                aliases: ["trap door", "stone trapdoor", "floor trapdoor", "ring", "iron ring"]
            },
            "bronze lock": {
                description: "A heavy bronze lock securing the western door. The lock is shaped like a crescent moon — the same symbol that appears on a crescent-shaped key you may have seen elsewhere. The bronze has aged to a deep green patina.",
                aliases: ["bronze door", "west door", "locked door", "bronze-locked door"]
            }
        },
        dark: false
    },

    // ===== UNDERGROUND NETWORK =====

    {
        id: "underground_stream",
        name: "Underground Stream",
        description: "The passage opens into a low-ceilinged cavern where an underground stream cuts through dark rock. The sound of rushing water fills the air, echoing off glistening walls. The smell of damp earth is strong. Hanging from an iron ring driven into the cave wall is a coil of rope — left by some previous explorer. The stream flows from east to west, vanishing into a crack in the stone.",
        shortDescription: "A cavern with an underground stream. A coil of rope hangs from the wall.",
        exits: {
            north: "damp_chamber",
            east: "underground_lake"
        },
        items: ["rope"],
        examinable: {
            "stream": {
                description: "The underground stream flows swiftly, crystal-clear despite the darkness. Small cave fish dart through the water. The stream originates from somewhere to the east. You can follow it to see where it leads.",
                aliases: ["water", "river", "underground water"]
            },
            "iron ring": {
                description: "A heavy iron ring driven into the cave wall at about chest height. It looks like it has been used many times as a tether point. The rope currently hanging from it is in good condition.",
                aliases: ["ring", "wall ring", "hook"]
            }
        },
        dark: false
    },

    {
        id: "underground_lake",
        name: "Underground Lake",
        description: "You emerge onto a narrow ledge overlooking a vast underground lake. The water is perfectly still and black as ink. Luminescent fungi dot the cavern ceiling far above, casting a faint blue-green glow across the water's surface. The silence is absolute. On the ledge near your feet, something glints faintly — a silver coin, perhaps dropped by a previous visitor.",
        shortDescription: "A narrow ledge over a dark underground lake. Luminescent fungi glow far above.",
        exits: {
            west: "underground_stream"
        },
        items: ["silver_coin"],
        examinable: {
            "lake": {
                description: "The underground lake is impossibly deep and still. The bioluminescent fungi are reflected perfectly in the water, creating the illusion of a mirror-image cavern below. Something ancient and vast seems to rest in these depths. You sense this place has not been visited in a very long time.",
                aliases: ["water", "lake water", "black water"]
            },
            "fungi": {
                description: "The bioluminescent fungi grow in clusters across the cavern ceiling, emitting a soft blue-green glow. They seem to brighten slightly as you observe them, as if responding to your presence. The ancient ones may have used these fungi to navigate the underground passages.",
                aliases: ["mushrooms", "mushroom", "fungus", "glowing fungi", "bioluminescent"]
            }
        },
        dark: true
    },

    // ===== ARMORY & BARRACKS =====

    {
        id: "armory",
        name: "Armory",
        description: "Beyond the iron door is an old armory. Rusted weapon racks line the walls, and shattered shields are stacked in corners. Most weapons have crumbled beyond use over the centuries. However, a grappling hook still hangs from a peg on the wall, solid and serviceable. On a workbench, you notice an ancient bronze lantern, its glass globe intact. The armory connects south to what were once soldiers' barracks.",
        shortDescription: "An old armory with rusted weapons. A grappling hook and ancient lantern are here.",
        exits: {
            west: "storage_room",
            south: "barracks"
        },
        items: ["grappling_hook", "ancient_lantern"],
        examinable: {
            "weapon racks": {
                description: "The weapon racks once held an impressive arsenal, but centuries of neglect have reduced most weapons to rust and rot. You can make out the shapes of spears, short swords, and shields. All are beyond use. Only the grappling hook and lantern have survived the years in serviceable condition.",
                aliases: ["rack", "weapons", "racks", "weapon rack", "swords", "shields", "spears"]
            },
            "workbench": {
                description: "A heavy stone workbench used for maintaining weapons and armor. Tools are scattered across it — hammers, chisels, oil rags — all rusted and rotted. The ancient lantern rests in the center, apparently left here after its last use.",
                aliases: ["bench", "stone workbench", "table"]
            }
        },
        dark: false
    },

    {
        id: "barracks",
        name: "Soldiers' Barracks",
        description: "The soldiers' barracks are a long, low-ceilinged room. Stone sleeping platforms run along both walls, with rusted iron rings where mattresses were once tied. Personal effects remain from the soldiers who last slept here — a tarnished cup, a carved bone figurine. Most notably, a faded leather codex on a stone shelf appears still readable. In the corner, a suit of rusty armor stands on a mannequin, somehow intact after all these years.",
        shortDescription: "The old soldiers' barracks. A leather codex and suit of rusty armor are here.",
        exits: {
            north: "armory"
        },
        items: ["old_codex", "rusty_armor"],
        examinable: {
            "sleeping platforms": {
                description: "The stone sleeping platforms are barely wide enough to lie on. Soldiers scratched their names and marks into the stone — names in an unfamiliar script, along with what appears to be a tally of days. Someone was counting down to something. The marks stop abruptly, mid-count.",
                aliases: ["sleeping platform", "beds", "bed", "stone beds", "stone platforms", "bunks"]
            },
            "figurine": {
                description: "A small carved bone figurine depicting a soldier in ceremonial armor, holding a torch aloft. The carving is exquisite for something so small. On the base, tiny letters read: 'Lux in tenebris' — Light in darkness. It was clearly a talisman of some importance to its owner.",
                aliases: ["bone figurine", "carved figurine", "carved bone", "small figurine"]
            }
        },
        dark: false
    },

    // ===== COLLAPSED TUNNEL & HIDDEN PASSAGE =====

    {
        id: "collapsed_tunnel",
        name: "Collapsed Tunnel",
        description: "A narrow tunnel that has partially collapsed. Fallen stones litter the floor and you must crouch to move through. The air is stale and carries the smell of old stone. In the dim light, you can make out something metallic half-buried under a pile of loose stones near the east wall. The tunnel continues north, where the ceiling rises again.",
        shortDescription: "A partially collapsed tunnel. Something metallic glints under the rubble.",
        exits: {
            west: "dark_alcove",
            north: "hidden_passage"
        },
        items: ["bronze_key"],
        examinable: {
            "rubble": {
                description: "The fallen stones are large limestone blocks that tumbled from the ceiling, probably during an earthquake long ago. The bronze key is half-buried beneath the smallest pile — it looks as if someone dropped it here in a hurry, or perhaps hid it intentionally.",
                aliases: ["fallen stones", "collapsed stones", "stones", "rocks", "debris"]
            },
            "ceiling": {
                description: "The collapsed section shows where large ceiling blocks fell inward. The remaining ceiling looks stable for now, but you wouldn't want to cause any vibrations. Cracks run along the walls where the original stonework shifted.",
                aliases: ["fallen ceiling", "collapsed ceiling", "cracks"]
            }
        },
        dark: true
    },

    {
        id: "hidden_passage",
        name: "Hidden Passage",
        description: "A low, narrow passage hewn from solid rock. The walls are smooth and clearly man-made, unlike the rougher natural tunnels you have passed through. Ancient torch sconces are mounted at intervals, their torches long since burned out. A faint glow visible to the east suggests a larger, better-lit space beyond — a room accessed through what appears to be a hidden door in a bookshelf.",
        shortDescription: "A hidden passage with smooth stone walls. Light filters in from the east.",
        exits: {
            south: "collapsed_tunnel",
            east: "library"
        },
        items: [],
        examinable: {
            "sconces": {
                description: "The empty torch sconces are spaced evenly along the passage walls, suggesting this was once a regularly used route. They are made of iron, decorated with a simple sun motif. Whoever used this passage did so often enough to warrant permanent lighting.",
                aliases: ["torch sconces", "sconce", "iron sconces", "torch holders"]
            }
        },
        dark: false
    },

    // ===== TEMPLE EXTERIOR =====

    {
        id: "temple_garden",
        name: "Temple Garden",
        description: "You step outside the temple into an overgrown garden that was once clearly magnificent. Stone pathways wind between raised planting beds, now overrun with thick vines and tangled undergrowth. Ancient fruit trees have grown wild and gnarled over the centuries. At the center, a dry stone fountain sits cracked and leaf-filled. A heavy vine, thick as your arm, hangs from a gnarled tree — it looks sturdy enough to bear considerable weight. Paths lead west toward older ruins and south to a decorative garden.",
        shortDescription: "An overgrown temple garden. Thick vines hang from ancient trees.",
        exits: {
            east: "temple_entrance",
            west: "overgrown_path",
            south: "statue_garden"
        },
        items: ["vine"],
        examinable: {
            "fountain": {
                description: "The stone fountain is carved with scenes of water flowing from the mouths of four celestial creatures — a sun-lion, a moon-rabbit, a star-fish, and a comet-serpent. Though dry for centuries, the artistry is remarkable. In the dry basin, a single old copper coin gleams, but it crumbles to dust as you reach for it — too far gone for even copper to survive.",
                aliases: ["stone fountain", "dry fountain", "basin", "fountain basin"]
            },
            "trees": {
                description: "The ancient trees have grown enormous over the centuries, their roots cracking the stone pathways and branches obscuring the sky. Despite the neglect, some still bear small, hard fruits. The trees have a patient, enduring quality, as if they have simply been waiting all these years.",
                aliases: ["tree", "fruit trees", "gnarled trees", "old trees"]
            },
            "pathways": {
                description: "The stone pathways are cracked and heaved by roots, but the pattern is still visible — a formal garden design with pathways radiating from the central fountain. The four main pathways point in the cardinal directions, and smaller paths connect them. Even in ruin, the garden shows its original elegance.",
                aliases: ["stone pathways", "path", "paths", "stone paths", "garden paths"]
            }
        },
        dark: false
    },

    {
        id: "overgrown_path",
        name: "Overgrown Path",
        description: "A stone path that once connected the temple to outer buildings, now almost completely reclaimed by nature. Dense undergrowth pushes in from both sides, and the path is cracked and heaved by tree roots. In the distance, you can see the remains of stone structures — perhaps guard posts or servant quarters — all collapsed into rubble. The main temple garden lies to the east.",
        shortDescription: "An overgrown path leading to ruined outbuildings.",
        exits: {
            east: "temple_garden"
        },
        items: [],
        examinable: {
            "ruins": {
                description: "The collapsed structures were once small buildings surrounding the main temple — a gatehouse, a well, what might have been a kitchen or servants' quarters. All reduced to foundation stones and rubble. Whatever happened to the people who lived here, they left in a hurry — or did not leave at all. Near one foundation, you can see the outline of a fire pit, long cold.",
                aliases: ["rubble", "collapsed buildings", "collapsed structures", "outbuildings", "buildings"]
            },
            "well": {
                description: "The remains of a stone well sit among the rubble — just the foundation ring and a few courses of stonework. The well shaft itself has collapsed inward. Whatever water source it tapped has long since dried up or shifted underground.",
                aliases: ["stone well", "old well", "well shaft"]
            }
        },
        dark: false
    },

    {
        id: "statue_garden",
        name: "Statue Garden",
        description: "A formal garden arranged around a series of stone statues. The statues depict robed figures in poses of reverence, their faces worn smooth by centuries of weather. At the center stands a larger statue — a priestly figure holding a bowl aloft, face turned skyward. The bowl holds a shallow pool of accumulated rainwater. The garden is enclosed and strangely peaceful despite its age.",
        shortDescription: "A garden of weathered stone statues. A central priest-statue holds a bowl to the sky.",
        exits: {
            north: "temple_garden"
        },
        items: [],
        examinable: {
            "statues": {
                description: "The statues are arranged in a specific order around the central figure. Reading clockwise from the entrance: a sun symbol, a moon symbol, a star symbol, a comet symbol — each robed figure holds the symbol of a celestial body. This matches the order described on the stone tablet. Whatever ritual was performed here, the celestial order mattered greatly.",
                aliases: ["statue", "stone statues", "robed figures", "stone figures", "smaller statues"]
            },
            "central statue": {
                description: "The central statue depicts a high priest in elaborate ceremonial robes. The bowl held aloft is inscribed on the inside with four symbols: Sun, Moon, Star, Comet — in that exact order. Around the rim, an inscription reads: 'Offer to the heavens in their proper order and the way shall open.' This matches other clues about a celestial sequence scattered throughout the temple.",
                aliases: ["priest statue", "priest", "large statue", "central figure", "high priest statue"]
            },
            "pool": {
                description: "The shallow pool in the statue's bowl contains a few inches of clear rainwater. At the bottom, you can see a glint of metal — perhaps a silver medallion — but as you reach in and touch it, it crumbles to dust instantly. Centuries of submersion have left nothing solid behind.",
                aliases: ["water", "rainwater", "bowl water", "pool water", "bowl"]
            }
        },
        dark: false
    },

    // ===== TEMPLE INTERIOR - ADVANCED AREAS =====

    {
        id: "library",
        name: "Temple Library",
        description: "The library is a magnificent room, its walls lined floor-to-ceiling with stone shelves bearing hundreds of ancient scrolls and leather-bound books. Dust motes float in shafts of light. Many books have crumbled, but some remain intact. A reading desk in the center holds an open scroll. On the north wall, high up near the ceiling, a small window admits a beam of daylight. The stone below the window is worn smooth — as if ropes have been used here many times before. Examining the bookshelves carefully might reveal something.",
        shortDescription: "The temple library, lined with ancient scrolls. A high window is in the north wall.",
        exits: {
            east: "inner_sanctum",
            north: "upper_balcony"
        },
        items: ["old_manuscript"],
        locked: {
            direction: "north",
            requiresKey: "rope_and_hook",
            message: "The high window is far out of reach. You need something to climb — perhaps a rope with a hook to catch the ledge above."
        },
        examinable: {
            "bookshelf": {
                description: "Scanning the shelves more carefully, you notice one section near the west wall is slightly out of alignment with the others. The stone floor in front of it is worn smooth, as if this shelving unit has been moved many times. With some effort, you push the bookshelf aside — and reveal a narrow hidden passage behind it!",
                revealsExit: { direction: "west", roomId: "hidden_passage" },
                aliases: ["bookshelves", "shelves", "shelf", "bookcase", "west bookshelf"]
            },
            "scroll": {
                description: "The open scroll on the reading desk is written in the same script as the stone tablet, but you can make out enough: 'The Crystal of Light was fractured in the Great Sundering. Three shards were hidden: one in the depths below, one in the heights above, one where fire and ritual converge. Only when reunited with the crystal will the temple's true purpose be restored.' This is the key to the temple's mystery.",
                aliases: ["open scroll", "reading desk", "desk", "scroll on desk"]
            },
            "window": {
                description: "The high window is set into the stone about fifteen feet above the floor. It would be impossible to reach without some kind of climbing aid. Through the window, you can see what appears to be a balcony or ledge above. The stone below the window is worn smooth from previous rope use.",
                aliases: ["high window", "north window", "small window"]
            },
            "books": {
                description: "Most of the books have crumbled beyond reading. But a few remain intact — records of temple rituals, astronomical observations, philosophical texts. One intact spine reads 'On the Celestial Order and Its Earthly Reflections.' The knowledge preserved here was vast.",
                aliases: ["book", "scrolls", "tomes", "tome", "ancient books", "old books"]
            }
        },
        dark: false
    },

    {
        id: "upper_balcony",
        name: "Upper Balcony",
        description: "You pull yourself up through the window onto a stone balcony running along the outside of the library's upper wall. The view is remarkable — the entire temple garden spreads out below, and beyond it, the ruins of the surrounding settlement stretch to the horizon. The balcony is narrow, with a low stone railing. At one end, a stone niche in the wall holds something that catches the light — a glittering crystal shard, placed here deliberately.",
        shortDescription: "A narrow stone balcony above the library. A crystal shard glints in a niche.",
        exits: {
            down: "library"
        },
        items: ["crystal_shard"],
        examinable: {
            "view": {
                description: "From up here, you can see the full scope of the temple complex — the main building, the gardens, the collapsed outbuildings, and in the far distance, a road that once connected the temple to the outside world. The temple was far grander than it appeared from within. Whoever built this was a civilization of considerable power.",
                aliases: ["panorama", "landscape", "garden view", "overlook", "vista"]
            },
            "niche": {
                description: "A small stone niche carved into the wall, clearly designed to hold something specific. The crystal shard fits perfectly within it, suggesting this was its original resting place. The niche is protected from rain by a small stone overhang — the shard was deliberately preserved here.",
                aliases: ["stone niche", "wall niche", "wall alcove", "carved niche"]
            },
            "railing": {
                description: "The low stone railing along the balcony edge is worn smooth by centuries of hands resting on it. Looking down from here, you can see the temple garden directly below. The drop is considerable — climbing back up without the rope would be impossible.",
                aliases: ["stone railing", "balcony railing", "edge", "wall"]
            }
        },
        dark: false
    },

    {
        id: "ritual_chamber",
        name: "Ritual Chamber",
        description: "A large circular chamber with a domed ceiling painted with stars and celestial symbols in deep midnight blue and gold. The floor is inlaid with a magnificent mosaic compass rose, with carved symbols at each cardinal point: Sun to the north, Moon to the south, Star to the east, Comet to the west. At the center, a stone altar holds a ceremonial dagger and a warmly glowing fire shard. Stone stairs in the corner lead up to a bell tower.",
        shortDescription: "A circular ritual chamber with celestial mosaics. An altar holds a dagger and glowing fire shard.",
        exits: {
            west: "inner_sanctum",
            up: "bell_tower"
        },
        items: ["ceremonial_dagger", "fire_shard"],
        examinable: {
            "altar": {
                description: "The stone altar is ancient beyond reckoning. Channels cut into its surface once directed ritual offerings into a central depression shaped like a shallow bowl. Around the altar's edge, the four celestial symbols repeat in sequence: Sun, Moon, Star, Comet. This sequence appears everywhere in this temple — it must be the key to something significant.",
                aliases: ["stone altar", "sacrifice altar", "central altar"]
            },
            "mosaic": {
                description: "The floor mosaic is a masterwork of colored stone tiles. The compass rose design uses gold for the Sun, silver for the Moon, white for the Star, and blue-grey for the Comet. At the very center, where the lines of the compass meet, there is a small circular depression — as if something round should rest there. It is the exact size of the crystal shard.",
                aliases: ["floor mosaic", "compass rose", "inlaid floor", "mosaic floor", "tiles", "floor tiles"]
            },
            "ceiling": {
                description: "The domed ceiling is painted in deep midnight blue with hundreds of small stars in silver and gold. The constellations show a specific celestial moment — a comet passing through the night sky. At the apex of the dome, a small oculus lets in a beam of light that tracks slowly across the mosaic floor as the sun moves, like a celestial clock.",
                aliases: ["dome", "domed ceiling", "stars", "painted ceiling", "oculus"]
            }
        },
        dark: false
    },

    {
        id: "bell_tower",
        name: "Bell Tower",
        description: "A tall, narrow tower chamber at the top of the temple. The wooden stairs have rotted away, leaving only the stone steps at the base. High above, the remnants of a great bronze bell hang cracked and silent. Narrow slit windows on all sides give views across the entire surrounding landscape. The wind moans through the slits, creating an eerie, resonant tone.",
        shortDescription: "The bell tower. Cracked bronze bell overhead. Slit windows look out in all directions.",
        exits: {
            down: "ritual_chamber"
        },
        items: [],
        examinable: {
            "bell": {
                description: "The great bronze bell is cracked nearly in two, clearly struck by tremendous force. The bell is inscribed around its rim: 'By light the darkness flees; by sound the darkness trembles; by truth the darkness dissolves.' Fragments of the bell's clapper lie on the floor below. Whatever rang this bell with such force did so long ago.",
                aliases: ["bronze bell", "cracked bell", "great bell", "the bell"]
            },
            "windows": {
                description: "Looking through the slit windows, you can see the entire region. To the north, mountains rise in the distance. To the east, forest stretches endlessly. To the south, a road winds toward a distant settlement. To the west, a river glints in sunlight. The temple sits at the heart of this landscape — it was clearly of great importance to the people who built it.",
                aliases: ["slit windows", "window", "slit", "view", "lookout", "north window", "east window"]
            },
            "stairs": {
                description: "Only the lowest stone steps of the tower stairs remain intact. The upper wooden sections have completely rotted away, leaving a dangerous gap. The view from here is still impressive, but climbing higher would be impossible without significant reconstruction.",
                aliases: ["stone steps", "staircase", "wooden stairs", "steps"]
            }
        },
        dark: false
    },

    {
        id: "crypt",
        name: "Temple Crypt",
        description: "You descend through the trapdoor into the temple crypt. The air is cold and absolutely still, carrying the smell of old stone. Stone sarcophagi line the walls, their lids carved with the faces of the priests who rest within. At the far end, a larger sarcophagus stands on a raised platform, its lid inlaid with the four celestial symbols in precious stones. Resting atop this great sarcophagus is a glowing stone — a moon stone, one of the crystal shards.",
        shortDescription: "The temple crypt. Stone sarcophagi line the walls. A moon stone glows on the largest.",
        exits: {
            up: "inner_sanctum"
        },
        items: ["moon_stone"],
        examinable: {
            "sarcophagi": {
                description: "The stone sarcophagi are arranged by rank — lesser priests near the entrance, more important figures toward the back. Each lid bears a carved face, remarkably lifelike despite the centuries. Some sarcophagi have been disturbed, their lids slightly ajar. Whatever disturbed them did so long ago, and whatever they found — or placed inside — is gone.",
                aliases: ["sarcophagus", "coffins", "coffin", "stone coffins", "stone sarcophagus"]
            },
            "large sarcophagus": {
                description: "The largest sarcophagus, clearly that of the high priest, is decorated with astonishing artistry. The inlaid gemstones depict the celestial sequence: a ruby sun, a pearl moon, a diamond star, a sapphire comet. An inscription on the side reads: 'Here rests the High Priest Atem-Ra, Keeper of the Crystal, Guardian of the Celestial Order, who shattered the Crystal to prevent its misuse, and hid its three shards: one in the heights, one in the depths, one in the sacred fire.' This matches the scroll exactly.",
                aliases: ["high priest sarcophagus", "large coffin", "main sarcophagus", "priest's sarcophagus", "atem-ra"]
            },
            "symbols": {
                description: "The inlaid gemstone symbols are breathtaking up close. Ruby sun, pearl moon, diamond star, sapphire comet — arranged in a specific order that matches carvings throughout the temple. The sequence is: Sun - Moon - Star - Comet. This celestial order must be used to activate some mechanism when the shards are reunited with the crystal.",
                aliases: ["gemstones", "gems", "precious stones", "inlaid symbols", "ruby", "pearl", "diamond", "sapphire"]
            }
        },
        dark: true
    }

];
