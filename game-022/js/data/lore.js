/**
 * Depth milestone lore strings.
 * Each entry fires once when the player first crosses that depth (in meters).
 */

export const LORE_MILESTONES = [
    { depth: 100,  text: "Delverhaven colony sensors: still dormant." },
    { depth: 500,  text: "Foundation stones. Someone built here before." },
    { depth: 1000, text: "Iron cages. This was a mine once. Or a prison." },
    { depth: 1500, text: "The crystals are singing. You feel it in your chassis." },
    { depth: 2000, text: "Dragon bones. The myths were cartography." },
    { depth: 2500, text: "This architecture predates the colony by 3,000 years." },
    { depth: 3000, text: "The rock here is wrong. Latticed. Designed." },
    { depth: 3500, text: "AXIOM-7 log: Alien signal detected. Triangulating origin." },
    { depth: 4000, text: "Hull stress nominal. Something ahead is emitting." },
    { depth: 4500, text: "AXIOM-7 log: The colony didn't vanish. It descended." },
    { depth: 5000, text: "AXIOM-7 log: I think I know what happened to the colony." },
    { depth: 5500, text: "The Singing Vein. I can hear it. They all could." },
    { depth: 6000, text: "The colony is here. Crystallized. Preserved. Waiting." },
    { depth: 6400, text: "[CORE ACCESSED — TRANSMISSION INCOMING]" },
];

// Flavor text for finding the Singing Vein (triggers special cutscene)
export const SINGING_VEIN_DISCOVERY =
    "AXIOM-7 MISSION LOG — The Singing Vein is real.\n" +
    "The colony didn't drill too deep. They drilled too willingly.\n" +
    "The Vein called to them. It calls to me now.\n" +
    "Directive updated: extract, return, warn Delverhaven survivors.\n" +
    "The song is beautiful. I won't listen.";

// Story intro text shown on splash screen
export const STORY_INTRO = [
    "AXIOM-7 ACTIVATION LOG — Day 1",
    "Location: Delverhaven colony ruins, surface level.",
    "Last colony transmission: 200 years ago.",
    "Mission: Find the Singing Vein. Fund the excavation.",
    "Discover what happened here.",
    "",
    "Drill deep. Come back.",
];

// Ending: shown once, when Singing Vein ore is first carried back to base
export const EPILOGUE = [
    "AXIOM-7 MISSION LOG — Final entry.",
    "",
    "The Vein sample is sealed in lead at Delverhaven base.",
    "Its song stops at the surface. It only sings downward.",
    "",
    "The colony is not lost. Six thousand metres down,",
    "they stand in the crystal where they stopped to listen.",
    "",
    "Excavation funded. Warning transmitted.",
    "No one else goes below the Void Layer alone.",
    "",
    "Directive fulfilled. AXIOM-7 remains on site.",
    "There is still ore in the dark.",
];
