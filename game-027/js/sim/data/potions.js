// Potions brewed in refinement levels, and the consumables Pellerin sells.

/** A refinement recipe: lines rich in `main` (and `second` from chapter 2), a combo, and a forbidden element. */
export const POTIONS = {
    'ember-draught': { id: 'ember-draught', name: 'Draught of Embers', chapter: 1, main: 'ember', second: 'salt', forbid: 'dew',
        art: 'a round-bellied glass flask of glowing orange liquid with tiny embers swirling inside, cork stopper' },
    'moonfire': { id: 'moonfire', name: 'Moonfire Tincture', chapter: 1, main: 'salt', second: 'ember', forbid: 'root',
        art: 'a slender tall bottle holding a cold silver-blue flame, frost on the glass' },
    'dew-clarity': { id: 'dew-clarity', name: "Dew's Clarity", chapter: 2, main: 'dew', second: 'salt', forbid: 'ember',
        art: 'a teardrop-shaped bottle of crystal-clear teal elixir with a single bubble rising' },
    'rootwarden': { id: 'rootwarden', name: 'Rootwarden Brew', chapter: 2, main: 'root', second: 'dew', forbid: 'ash',
        art: 'a squat stoneware-and-glass bottle of thick green-brown brew with a small root curling around its neck' },
    'ashen-elixir': { id: 'ashen-elixir', name: 'Ashen Elixir', chapter: 3, main: 'ash', second: 'ember', forbid: 'dew',
        art: 'a smoky glass vial of swirling violet-grey elixir with a faint glowing violet core' },
    'salt-of-dawn': { id: 'salt-of-dawn', name: 'Salt of Dawn', chapter: 3, main: 'salt', second: 'root', forbid: 'ember',
        art: 'a faceted crystal bottle filled with pale gold sparkling liquid like morning light' },
    'aether-philter': { id: 'aether-philter', name: 'Aether Philter', chapter: 4, main: 'aether', second: 'ash', forbid: 'root',
        art: 'a delicate spiral glass philter of lavender starlight swirling with tiny stars' },
    'mastery': { id: 'mastery', name: 'Elixir of Mastery', chapter: 4, main: 'ember', second: 'dew', forbid: null,
        art: 'an ornate crystal decanter of molten gold liquid with a brass filigree stopper, radiant' },
};
export const GRADES = ['crude', 'fine', 'pure', 'masterwork'];
export const GRADE_NAMES = { crude: 'Crude', fine: 'Fine', pure: 'Pure', masterwork: 'Masterwork' };

/** Enhancements chosen before a refinement, paid from your stores. */
export const ENHANCEMENTS = {
    stabilizer: { id: 'stabilizer', name: 'Stabilizer', cost: { salt: 1 }, desc: 'The combo and the streak the recipe asks for are one easier.' },
    potency: { id: 'potency', name: 'Potency Dust', cost: { ember: 1 }, desc: 'The finished potion is one grade finer.' },
    buffer: { id: 'buffer', name: 'Dew Buffer', cost: { dew: 1 }, desc: 'Forgives one forbidden line.' },
};

/** Consumables. `target`: what you choose after picking it. */
export const ITEMS = {
    dissolvent: { id: 'dissolvent', name: 'Dissolvent', price: 35, target: 'cell', desc: 'Dissolve one filled cell of the lattice.',
        art: 'a stoppered glass vial of fizzing bright green acid, bubbles streaming up' },
    catalyst: { id: 'catalyst', name: 'Catalyst', price: 50, target: 'none', desc: 'Return your hand to the supply and draw a fresh one.',
        art: 'a small brass-bound flask with a spinning vortex of golden liquid inside' },
    vial: { id: 'vial', name: 'Transmute Vial', price: 60, target: 'shape', desc: 'Turn a tile in your hand into a single Mote.',
        art: 'a slim crystal vial whose liquid shifts from ruby red at the bottom to sapphire blue at the top' },
    salts: { id: 'salts', name: 'Reveal Salts', price: 40, target: 'cell', desc: 'Strip one layer of cover from a buried deposit.',
        art: 'a small open leather pouch spilling softly glowing white salt crystals' },
    tonic: { id: 'tonic', name: 'Hearth Tonic', price: 45, target: 'none', desc: 'Restore 10 health in a battle.',
        art: 'a round red healing tonic bottle with a plain wax seal and a cork, warm glow' },
};
export const COIN_ART = 'a small stack of old gold coins, the top one stamped with a tiny cauldron, warm glint';
