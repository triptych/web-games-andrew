// Builds the fal requests for every lamp sprite from js/sim/data/lamps.js, so the art always matches the
// game's data and can be regenerated. Prints JSON: [{ file, key, prompt }], plus the shared system prompt.
//
//   node game-149/dev/art/prompts.mjs            # all 32 (8 lamps × shade, base, lit, unlit)
//   ONLY=cobalt-hobnail node game-149/dev/art/prompts.mjs
//
// Model: google/nano-banana-2.1/edit with the reference photo of the real collection in image_urls,
// 1:1, 2K, PNG. See art/README.md.

import { LAMPS } from '../../js/sim/data/lamps.js';

export const SYSTEM = [
    'You are painting game sprites for a cozy painterly memory game about antique pressed-glass fairy lamps.',
    'Style: a hand-painted digital oil and gouache illustration, NOT a photograph. Visible confident brushstrokes,',
    'soft glazes of colour, simplified but accurate glass patterns, gentle painted highlights and reflections,',
    'rich saturated glass colour, warm storybook lighting. The object must stay true to the real antique in the',
    'reference photo: same shape, proportions, glass colour and pressed pattern.',
    'Exactly one object, centred, upright, seen from slightly above eye level, filling about 75% of the frame,',
    'whole object visible with a clear margin on every side. No table, no shadow on the ground, no other objects,',
    'no text, no letters, no labels, no border, no frame. The background is one perfectly flat solid key colour',
    'that reaches every edge, with no gradient, texture, vignette or glow on it.',
].join(' ');

// Pink and purple glass would fight a magenta key: those lamps go on green.
const keyFor = (lamp) => (/pink|amethyst/.test(lamp.id) ? { name: 'green', hex: '#00ff00' } : { name: 'magenta', hex: '#ff00ff' });

const PARTS = {
    shade: (l) => `Only the glass SHADE (the top dome) of the ${l.name} fairy lamp, on its own, with no base, no cup and no candle: ${l.art}. Paint just the dome, its open top ring and its lower rim. Unlit, daylight colours.`,
    base: (l) => `Only the glass BASE (the bottom cup) of the ${l.name} fairy lamp, on its own, with no shade or dome on it: ${l.art}. A short plain white candle stands unlit inside the cup. Paint just the cup and the candle.`,
    unlit: (l) => `The whole ${l.name} fairy lamp, shade sitting on its base: ${l.art}. The candle inside is NOT lit; cool soft daylight on the glass.`,
    lit: (l) => `The whole ${l.name} fairy lamp, shade sitting on its base: ${l.art}. The candle inside IS lit: a warm golden flame glows through the coloured glass, the pressed pattern sparkles with light from inside, and a soft warm glow sits on the glass itself (but never on the flat background).`,
};

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const out = [];
for (const l of LAMPS) {
    if (only && !only.includes(l.id)) continue;
    const key = keyFor(l);
    for (const [part, text] of Object.entries(PARTS)) {
        out.push({
            file: `${l.id}-${part}.png`,
            key: key.hex,
            prompt: `Using the reference photo of a real antique fairy lamp collection for accuracy, paint: ${text(l)} `
                + `Background: plain flat solid ${key.name} (${key.hex}) everywhere.`,
        });
    }
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify({ system_prompt: SYSTEM, requests: out }, null, 2));
export default out;
