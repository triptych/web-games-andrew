// The elements: what deposits hold, what tiles are made of, what the cauldron spends.
// Pure data. `art` is the subject of the element's painted icon (dev/art/prompts.mjs).

export const TIERS = ['common', 'uncommon', 'rare', 'exotic'];

export const ELEMENTS = {
    salt: { id: 'salt', name: 'Salt', tier: 'common', color: 0xe8e2d4, glyph: '✦',
        art: 'a small heap of coarse white crystal salt glittering, one perfect clear salt cube on top' },
    ember: { id: 'ember', name: 'Ember', tier: 'common', color: 0xf07a32, glyph: '✸',
        art: 'a single glowing orange ember coal with tiny curling flames rising from it' },
    dew: { id: 'dew', name: 'Dew', tier: 'uncommon', color: 0x4fc4d0, glyph: '❀',
        art: 'one large teal-blue dewdrop resting on a curled green leaf, catching the light' },
    root: { id: 'root', name: 'Root', tier: 'uncommon', color: 0xa77b48, glyph: '⬢',
        art: 'a gnarled brown mandrake-like root knot with fine rootlets and a tiny green sprout' },
    ash: { id: 'ash', name: 'Ash', tier: 'rare', color: 0x9a90a8, glyph: '◆',
        art: 'a small mound of silver-grey ash with a glowing violet spark buried in it' },
    aether: { id: 'aether', name: 'Aether', tier: 'exotic', color: 0xb99cff, glyph: '✺',
        art: 'a swirling orb of lavender starlight mist held inside a tiny clear glass sphere' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);
export const tierIndex = (t) => TIERS.indexOf(t);
