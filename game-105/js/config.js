// SOLDER & RAIN — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'solder-and-rain.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The bench. World units are roughly centimetres; the device sits at the origin.
export const BENCH = { x0: -9.6, x1: 9.6, z0: -6.2, z1: 6.9 };
export const HOVER = 1.8;                 // height a carried part floats at
export const FLOOR_Y = 0.42;              // top of a device's base plate above the mat
export const DISH = { x: -8.1, z: 4.9, r: 1.45 };     // magnetic screw dish
export const BIN = { x: 8.3, z: 3.6, r: 1.55 };       // scrap bin
export const SPAWN = { x: 5.4, z: 5.2 };              // where a spare part lands

export const TOOLS = [
    { id: 'hand',     key: '1', name: 'Hands',     blurb: 'Lift parts, pull plugs, pick up stray bits.' },
    { id: 'driver',   key: '2', name: 'Driver',    blurb: 'Hold on a screw to turn it. Bits: Phillips, slotted.' },
    { id: 'ratchet',  key: '3', name: 'Ratchet',   blurb: 'Hold on a bolt. Sockets: 8, 10, 13 mm.' },
    { id: 'pry',      key: '4', name: 'Pry tool',  blurb: 'Pops retaining clips out and presses them home.' },
    { id: 'tweezers', key: '5', name: 'Tweezers',  blurb: 'Small parts: chips, capacitors, fuses.' },
    { id: 'solder',   key: '6', name: 'Iron',      blurb: 'Hold on a joint or a cut wire; keep the heat in the green.' },
    { id: 'brush',    key: '7', name: 'Brush',     blurb: 'Scrub back and forth over corrosion and dust.' },
    { id: 'oil',      key: '8', name: 'Oil',       blurb: 'Hold over a stiff mechanism or a rusted bolt.' },
    { id: 'probe',    key: '9', name: 'Meter',     blurb: 'Hold on a part or cable to read whether it is healthy.' },
];

// Every kind of fastener and what turns it. `turns` is how many full turns it takes.
export const FAST = {
    phil:  { tool: 'driver',  bit: 'phil', turns: 3,   name: 'Phillips screw' },
    flat:  { tool: 'driver',  bit: 'flat', turns: 3,   name: 'Slotted screw' },
    hex8:  { tool: 'ratchet', size: 8,     turns: 3.5, name: '8 mm bolt' },
    hex10: { tool: 'ratchet', size: 10,    turns: 3.5, name: '10 mm bolt' },
    hex13: { tool: 'ratchet', size: 13,    turns: 4,   name: '13 mm bolt' },
    clip:  { tool: 'pry',     turns: 0,     name: 'Retaining clip' },
};

export const TUNE = {
    turnRate: 3.4,          // turns per second with the basic tools
    clipTime: 0.32,         // seconds to pop or press a clip
    heatUp: 0.62, heatDown: 0.95,
    sweetLo: 0.5, sweetHi: 0.78, burnAt: 0.93, flowTime: 1.5,
    scrub: 0.16,            // grime cleared per world unit of brush travel
    oilRate: 0.55,          // stiffness cleared per second
    rustRate: 0.8,
    probeTime: 0.4,
    snap: 1.15,             // how close a carried part must be to a slot to drop in
    plugSnap: 1.0,
    tapTime: 0.32, tapDist: 0.7,   // a press shorter and smaller than this "sticks" to the cursor
    reach: 1.15,            // how far the pointer may wander off a screw before the tool lifts
    testTime: 4.2,
    pay: [0, 45, 80, 120, 170, 300],
    starMul: [0, 0.8, 1, 1.18],
};

// Colours for cables, unique within one device so the plug always tells you its socket.
export const WIRE_COLORS = [
    { id: 'red', hex: 0xe23b3b, name: 'red' },
    { id: 'orange', hex: 0xf08a24, name: 'orange' },
    { id: 'yellow', hex: 0xf2d230, name: 'yellow' },
    { id: 'green', hex: 0x3dc76a, name: 'green' },
    { id: 'cyan', hex: 0x2fd6e6, name: 'cyan' },
    { id: 'blue', hex: 0x3f7bff, name: 'blue' },
    { id: 'violet', hex: 0xa05cf0, name: 'violet' },
    { id: 'pink', hex: 0xff5fa8, name: 'pink' },
    { id: 'white', hex: 0xe8ecf4, name: 'white' },
    { id: 'brown', hex: 0x9a6a3c, name: 'brown' },
];
export const GND_COLOR = { id: 'black', hex: 0x2a2d35, name: 'black' };

// What the shop sells. `cosmetic` ones only change the room.
export const UPGRADES = [
    { id: 'power',   name: 'Power driver',        cost: 90,  desc: 'Drivers and ratchets spin 70% faster.' },
    { id: 'fine',    name: 'Fine-tip iron',       cost: 80,  desc: 'A wider sweet spot and quicker solder flow.' },
    { id: 'sonic',   name: 'Ultrasonic brush',    cost: 70,  desc: 'Scrubbing clears grime twice as fast.' },
    { id: 'meter',   name: 'Autoranging meter',   cost: 100, desc: 'The meter reads the instant you touch a part.' },
    { id: 'account', name: 'Wholesale account',   cost: 90,  desc: 'Spare parts cost half.' },
    { id: 'plant',   name: 'Fern in a mug',       cost: 30,  desc: 'Something alive on the shelf.', cosmetic: true },
    { id: 'cat',     name: 'Robot cat',           cost: 60,  desc: 'Purrs at a frequency that fixes nothing.', cosmetic: true },
    { id: 'holo',    name: 'Holo-frame',          cost: 45,  desc: 'A looping photo of the two of you.', cosmetic: true },
];

// How hard each tier of job is. Used by the generator.
export const TIERS = [
    null,
    { name: 'Easy',    dim: 1.00, panels: 1, brackets: 0, faults: [1, 1], mods: 4, subs: [1, 2], rust: 0,    hidden: 0, solder: 0, dust: 0.2 },
    { name: 'Routine', dim: 1.10, panels: 2, brackets: 1, faults: [2, 2], mods: 5, subs: [2, 3], rust: 0.08, hidden: 0, solder: 0, dust: 0.3 },
    { name: 'Tricky',  dim: 1.18, panels: 2, brackets: 1, faults: [2, 3], mods: 6, subs: [3, 4], rust: 0.15, hidden: 1, solder: 1, dust: 0.4 },
    { name: 'Nasty',   dim: 1.26, panels: 3, brackets: 2, faults: [3, 4], mods: 7, subs: [3, 5], rust: 0.2,  hidden: 1, solder: 2, dust: 0.5 },
    { name: 'Heirloom',dim: 1.34, panels: 3, brackets: 2, faults: [4, 5], mods: 9, subs: [4, 6], rust: 0.25, hidden: 2, solder: 2, dust: 0.5 },
];

export const SYS_NAMES = {
    power: 'power', logic: 'logic', motion: 'motion', optics: 'optics', audio: 'audio', display: 'display', cooling: 'cooling', wiring: 'wiring',
};
