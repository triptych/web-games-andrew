// Room definitions for the game

export const ROOMS = [
    {
        id: "damp_chamber",
        name: "Damp Chamber",
        description: "You wake with a start, the sound of dripping water echoing in your ears. Your head throbs, and your memories are hazy. Looking around, you find yourself in a damp, stone chamber lit by a single flickering torch mounted on the wall. The walls are covered in moss and ancient carvings you can't quite make out.",
        shortDescription: "You are in a damp stone chamber. A flickering torch provides dim light.",
        exits: {
            north: "narrow_corridor",
            east: "storage_room"
        },
        items: ["old_torch"],
        dark: false
    },
    {
        id: "narrow_corridor",
        name: "Narrow Corridor",
        description: "A narrow corridor stretches before you, carved from rough stone. The air is musty and stale. Ancient stone bricks line the walls, some crumbling with age. You can hear water dripping somewhere in the distance. The corridor continues to the west, and you can return south to the damp chamber.",
        shortDescription: "A narrow stone corridor. It continues west.",
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
        description: "This appears to be an old storage room. Rotting wooden crates and broken pottery litter the floor. Dust covers everything, and cobwebs hang from the ceiling. Against one wall, you notice a rusty sword leaning against a crate. There's a small alcove to the north that looks darker than the rest of the room.",
        shortDescription: "An old storage room filled with debris and broken crates.",
        exits: {
            west: "damp_chamber",
            north: "dark_alcove"
        },
        items: ["rusty_sword", "wooden_crate"],
        dark: false
    },
    {
        id: "dark_alcove",
        name: "Dark Alcove",
        description: "You step into a small, dark alcove. Without a light source, you can barely see anything. The walls feel damp to the touch, and you can sense something glinting in the darkness. You feel uneasy here.",
        shortDescription: "A pitch-black alcove. You can barely see anything.",
        exits: {
            south: "storage_room"
        },
        items: ["iron_key"],
        dark: true
    },
    {
        id: "temple_entrance",
        name: "Temple Entrance",
        description: "You stand before a grand entrance to what appears to be an ancient temple. Massive stone columns rise on either side, carved with intricate hieroglyphics and symbols depicting forgotten gods and long-dead kings. The entrance itself is an imposing archway, beyond which lies darkness. A heavy wooden door to the north is locked with an iron lock.",
        shortDescription: "The grand entrance to an ancient temple. A locked door stands to the north.",
        exits: {
            east: "narrow_corridor",
            north: "inner_sanctum"
        },
        items: ["stone_tablet"],
        locked: {
            direction: "north",
            requiresKey: "iron_key"
        },
        dark: false
    },
    {
        id: "inner_sanctum",
        name: "Inner Sanctum",
        description: "You have entered the inner sanctum of the ancient temple. The air here feels heavy with age and mystery. In the center of the room stands a stone pedestal, upon which rests a magnificent crystal that pulses with an inner light. Ancient murals cover the walls, telling stories of a civilization long forgotten. You feel you have reached something important.",
        shortDescription: "The inner sanctum. A glowing crystal rests on a pedestal.",
        exits: {
            south: "temple_entrance"
        },
        items: ["crystal_of_light"],
        dark: false
    }
];
