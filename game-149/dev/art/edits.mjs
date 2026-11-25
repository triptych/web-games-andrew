// Second pass: derive every lamp's base, shade and other candle state from ONE master painting, so the parts
// match the whole lamp (the first pass painted each part separately and the bases came out taller than the cups
// under the shades). Each edit keeps the framing and scale, so the cut-out parts line up with the whole lamp.
//
//   node game-149/dev/art/edits.mjs > edits.json      # [{ file, image, prompt }] for google/nano-banana-2.1/edit
//
// MASTER maps each lamp to the fal URL of its master painting (from the first pass): the unlit lamp, or the lit
// one for pink-blossom, whose unlit painting had the key showing through the glass and a different foot.

import { LAMPS } from '../../js/sim/data/lamps.js';

// Not prompts.mjs's SYSTEM: its "centred, filling 75% of the frame" would fight "keep the framing".
export const SYSTEM = 'You edit painted game sprites of antique pressed-glass fairy lamps: hand-painted digital oil and gouache, '
    + 'NOT a photograph. Make only the change you are asked for and keep everything else exactly as it is, pixel for pixel '
    + 'where possible: the lamp parts, their size and position, the camera and the framing. No text, no border, no frame. '
    + 'The background is one perfectly flat solid key colour that reaches every edge.';

export const MASTER = {
    'cobalt-hobnail': ['unlit', 'https://v3b.fal.media/files/b/0ab3cdce/afj6rq7EaYQNmXGQpcg55_fm4TrMef.png'],
    'amber-hobnail': ['unlit', 'https://v3b.fal.media/files/b/0ab3cdd8/8gz48qwnLdsiVzV0Ox-0C_rrhgnxW9.png'],
    'clear-diamond': ['unlit', 'https://v3b.fal.media/files/b/0ab3cdd8/gmOzyHLZuoBnchHvT--qH_9JcvGlXs.png'],
    'green-starburst': ['unlit', 'https://v3b.fal.media/files/b/0ab3cddd/rgBXdeFUyxBQOHFKuWUyR_qqpAqaw5.png'],
    'amber-star': ['unlit', 'https://v3b.fal.media/files/b/0ab3cddd/lbi455FYwE4Beai5l_kKl_fGnWqUNy.png'],
    'blue-moonstar': ['unlit', 'https://v3b.fal.media/files/b/0ab3d6cd/5-ax5B7P7_uCAU3UFdOST_4XjOnplN.png'],
    'pink-blossom': ['lit', 'https://v3b.fal.media/files/b/0ab3d6cd/MSXhu4SdS4f4QoVN_QFhi_fZPYttmo.png'],
    'amethyst-diamond': ['unlit', 'https://v3b.fal.media/files/b/0ab3d6ce/LspoHfLzYKM1Ryl64eIvV_AmhSlApp.png'],
};

const KEEP = 'Keep the camera, framing, scale and position in the frame exactly the same, and keep the same painterly style.';
const bg = (k) => `The background stays plain flat solid ${k} everywhere, with no glow or shadow on it.`;

const EDIT = {
    base: (l, k) => `Edit this painting of the ${l.name} fairy lamp. Remove the glass shade (the top dome) completely and leave ONLY the base cup, exactly as it is: the same size, height, shape, rim and pressed pattern, in exactly the same place. Do not make the cup taller or change it in any way. Where the shade was, show the short white candle standing unlit in the cup. ${KEEP} ${bg(k)}`,
    shade: (l, k) => `Edit this painting of the ${l.name} fairy lamp. Remove the base cup and the candle completely and leave ONLY the glass shade (the top dome), exactly as it is: the same size, shape and pressed pattern, in exactly the same place. Complete the shade's lower rim where the base hid it. ${KEEP} ${bg(k)}`,
    lit: (l, k) => `Edit this painting of the ${l.name} fairy lamp. Light the candle inside: a warm golden flame glows through the coloured glass and the pressed pattern sparkles with light from inside. Change nothing else about the lamp: same shape, size, parts and pattern. ${KEEP} ${bg(k)}`,
    unlit: (l, k) => `Edit this painting of the ${l.name} fairy lamp. Blow out the candle: no flame and no glow, cool soft daylight on the glass. Change nothing else about the lamp: same shape, size, parts and pattern. ${KEEP} ${bg(k)}`,
};

const keyName = (id) => (/pink|amethyst/.test(id) ? 'green (#00ff00)' : 'magenta (#ff00ff)');
const out = [];
for (const l of LAMPS) {
    const [state, image] = MASTER[l.id];
    const other = state === 'unlit' ? 'lit' : 'unlit';
    for (const part of ['base', 'shade', other]) out.push({ file: `${l.id}-${part}.png`, image, prompt: EDIT[part](l, keyName(l.id)) });
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify({ system_prompt: SYSTEM, edits: out }, null, 2));
export default out;
