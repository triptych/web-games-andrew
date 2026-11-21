/**
 * prompts.mjs — every Meshy text-to-3D request for NEBULA REQUIEM's ships, enemies and bosses.
 *
 *   node game-144/dev/meshy/prompts.mjs            # JSON list of { name, prompt, polycount }
 *
 * One shared style line keeps the set coherent. Each model is generated as a text-to-3d preview with a polygon
 * budget, then refined (textured, PBR) and shrunk by shrink.py. The game loads them from models/<name>.glb;
 * js/view/meshy.js says how each one is turned, scaled and placed (Meshy models come back in their own orientation).
 */
export const STYLE = 'stylized anime sci-fi game asset, clean hard-surface forms, bold readable silhouette, painted metal panels with glowing accent lights, single object, no base, no ground';

export const MODELS = [
    // the Seraphs (side view, nose pointing one way)
    { name: 'ship-sora', polycount: 8000, prompt: 'sleek futuristic jet starfighter, white and azure blue armor, forward-swept wings, twin tail fins, cyan glowing cockpit canopy, glowing blue engine nozzle at the back' },
    { name: 'ship-kaito', polycount: 8000, prompt: 'heavy futuristic starfighter, black and crimson red armor, broad delta wings, a long golden lance spike on the nose, twin rear engines with red glow' },
    { name: 'ship-lyra', polycount: 8000, prompt: 'organic alien moth-like starfighter, dark violet and black hull, curved crescent blade wings, glowing violet vein lines, a golden eye-like cockpit' },
    // enemies
    { name: 'mote', polycount: 2500, prompt: 'small round alien drone, dark metal sphere with one glowing red eye, small fins and a thin ring around it' },
    { name: 'dart', polycount: 2500, prompt: 'small arrowhead-shaped alien interceptor fighter, dark grey and bone white, swept wings, red sensor eye' },
    { name: 'pod', polycount: 3000, prompt: 'spiked spherical alien gun pod, dark metal ball covered in short spikes, a red glowing eye' },
    { name: 'mine', polycount: 2500, prompt: 'spiked space mine, dark red metal sphere with glowing red spikes' },
    { name: 'gunship', polycount: 4000, prompt: 'blocky alien gunship, dark armored hull with twin cannons at the front, red sensor strip, engine at the back' },
    { name: 'carrier', polycount: 6000, prompt: 'long alien carrier warship, bone white and dark grey hull, an open orange glowing launch bay at the front, blue engines at the back' },
    { name: 'cruiser', polycount: 6000, prompt: 'long armored alien battle cruiser, cathedral-like bone and dark metal hull with turrets on top, red windows, blue engines at the back' },
    { name: 'manta', polycount: 3500, prompt: 'crystal manta ray creature, translucent cyan glass body with wide wings, a glowing pink eye' },
    { name: 'shard', polycount: 1500, prompt: 'floating pink crystal shard, elongated faceted octahedron glowing from inside' },
    { name: 'squid', polycount: 3500, prompt: 'alien space squid, purple bioluminescent body, five trailing tentacles, a glowing green eye' },
    { name: 'sentinel', polycount: 4500, prompt: 'hovering sentinel robot, armored torso with a round head and one glowing red eye, two short cannon arms, no legs' },
    { name: 'eye', polycount: 3000, prompt: 'giant floating alien eyeball with a golden iris, wrapped in a fleshy purple ring' },
    { name: 'serpentHead', polycount: 3000, prompt: 'crystal dragon serpent head, glowing cyan glass with horns and a pink eye' },
    { name: 'segment', polycount: 1500, prompt: 'a single abstract armored ring, a thick hexagonal disc of faceted cyan crystal glass with a glowing white core, like one vertebra, an object not a creature, no head, no legs, no tail' }, // v2: v1 came back as a whole crystal wolf,
    { name: 'kamikaze', polycount: 2000, prompt: 'small spiked alien suicide drone, dark red cone shape with a glowing red tip and a rear thruster' },
    { name: 'bearer', polycount: 4000, prompt: 'alien shield bearer ship, armored hull holding a large curved glowing blue energy shield in front' },
    { name: 'angel', polycount: 5000, prompt: 'white crystalline robotic angel figure with a golden halo ring and two wings of light, serene mask face' },
    { name: 'egg', polycount: 1500, prompt: 'glowing green alien egg, translucent membrane with a creature silhouette inside' },
    { name: 'turret', polycount: 2000, prompt: 'small armored dome gun turret with a single barrel, dark metal, red sensor light' },
    { name: 'bigturret', polycount: 3000, prompt: 'large armored dome gun turret with twin heavy barrels, dark metal, red sensor light' },
    { name: 'engine', polycount: 3000, prompt: 'huge starship engine thruster nozzle, dark metal ribbed cylinder with a glowing orange core' },
    // bosses (their animated details — lids, jaws, tentacles, wings — stay procedural on top)
    { name: 'boss-bellwether', polycount: 12000, prompt: 'enormous alien dreadnought warship in side view, long hull shaped like a bell crossed with a whale, black and bone white armor ribs, red glowing core at the prow, gun turrets along the top' },
    { name: 'boss-wyrm', polycount: 6000, prompt: 'disembodied giant dragon head only, seen from the side, long snout with open jaws full of light, swept-back horns, glowing cyan and pink prismatic crystal glass, the head ends cleanly at the back of the skull, no neck, no body, no legs, no arms' }, // v2: v1 came back as a whole standing dragon,
    { name: 'boss-organ', polycount: 12000, prompt: 'wall of giant organ pipes fused with red flesh and bone, biomechanical reactor, glowing red pipe mouths' },
    { name: 'boss-titan', polycount: 12000, prompt: 'giant humanoid war robot mecha, gunmetal and crimson armor, glowing visor, shoulder missile pods, a beam cannon right arm and a plasma sword left arm' },
    { name: 'boss-mother', polycount: 10000, prompt: 'colossal eldritch alien creature, a huge golden eye in the middle of a mass of violet and green tentacles, bioluminescent spots' },
    { name: 'boss-heart', polycount: 12000, prompt: 'vast alien angel machine of white crystal and gold, serene feminine mask face, flowing robes of light, halo rings behind the head' },
];

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(MODELS.map((m) => ({ ...m, prompt: `${m.prompt}, ${STYLE}` })), null, 1));
