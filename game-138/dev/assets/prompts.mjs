// prompts.mjs — the Meshy reference prompt for every model in LANTERNHOLLOW, written from js/sim/data/elements.js,
// so the models match the builder's own catalogue and can be regenerated. `node prompts.mjs` prints them as JSON.
import { ELEMENTS } from '../../js/sim/data/elements.js';

export const SYS = 'You are the prop designer of LANTERNHOLLOW, a cozy fantasy dungeon-building toy. A single stylised fantasy game asset rendered as a clean 3D game model in a cozy storybook video-game style: chunky rounded shapes, soft warm colours, hand-painted textures, gently exaggerated proportions. ONE subject, the whole subject visible and centred, three-quarter view from the front left and slightly above, soft even studio lighting, plain flat light-grey background, no shadow, no floor, no base unless described, no text, no logos.';

/** Triangle budgets: the big dragon gets the most, creatures more than props. */
export const POLY = (id, e) => (e.boss ? 7000 : e.cat === 'monsters' ? 4500 : 3000);

export const REFS = Object.entries(ELEMENTS).map(([id, e]) => ({ id, name: e.model, prompt: `${SYS} The subject: ${e.art}.`, poly: POLY(id, e) }));

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(REFS, null, 1));
