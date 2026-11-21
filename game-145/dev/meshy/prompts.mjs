/**
 * prompts.mjs — every Meshy text-to-3D request for VACANCY's vehicles.
 *
 *   node game-145/dev/meshy/prompts.mjs > WORKDIR/models.json
 *
 * One shared style line keeps the set coherent. Each is a text-to-3d preview with a polygon budget (the city shows
 * a few hundred at once, so they stay light), then refined with PBR textures and shrunk by shrink.py. The game
 * loads them from models/<name>.glb (js/view/vehicles.js) and turns, sizes and tints each instance itself.
 */
export const STYLE = 'realistic game asset of a vehicle abandoned in an empty city street for years: faded sun-bleached paint, dust and grime, patches of rust, dirty windows, slightly deflated tyres, no text, no lettering, no logos, no number plates, single object, no base, no ground, no people';

export const MODELS = [
    { name: 'sedan', polycount: 3500, prompt: '1980s four-door family sedan car, boxy shape, faded dark red paint' },
    { name: 'hatchback', polycount: 3000, prompt: 'small 1980s three-door hatchback car, faded pale blue paint' },
    { name: 'wagon', polycount: 3500, prompt: '1980s station wagon car with simulated wood-panel sides and a roof rack, faded beige paint' },
    { name: 'pickup', polycount: 3500, prompt: 'old 1970s pickup truck with an empty open cargo bed, faded green paint' },
    { name: 'van', polycount: 4000, prompt: 'old boxy panel delivery van with windowless sides, faded white paint, rusty wheel arches' },
    { name: 'truck', polycount: 5000, prompt: 'medium box delivery truck: a short cab in front of a tall plain white cargo box, faded and rusty' },
    { name: 'bus', polycount: 6000, prompt: 'long city transit bus, faded yellow and cream paint, a row of tall side windows, a wide windscreen, dirty' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(JSON.stringify(MODELS.map((m) => ({ name: m.name, polycount: m.polycount, prompt: `${m.prompt}. ${STYLE}` })), null, 1));
}
