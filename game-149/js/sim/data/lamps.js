// The fairy lamps. Each lamp is a matched pair: a shade (the top dome) and a base (the cup that holds
// the candle). The memory game deals both halves face down; a match is a shade with its own base.
//
// `art` describes the real antique so the painted sprites (art/README.md) can be regenerated from
// this table. Pure data: the sim imports it, nothing here touches the DOM.

export const LAMPS = [
    {
        id: 'cobalt-hobnail',
        name: 'Cobalt Hobnail',
        glass: '#1f5fd6',
        art: 'deep cobalt blue pressed glass, hobnail pattern of raised round bumps in neat rows; '
            + 'egg-shaped shade with a small round top opening; base is a ruffled hobnail cup with a crimped scalloped rim',
    },
    {
        id: 'amber-hobnail',
        name: 'Amber Hobnail',
        glass: '#c8781e',
        art: 'warm honey-amber pressed glass, hobnail pattern of raised round bumps; '
            + 'egg-shaped shade with a small round top opening; base is a ruffled amber hobnail cup with a scalloped rim',
    },
    {
        id: 'clear-diamond',
        name: 'Clear Diamond Point',
        glass: '#e8eef2',
        art: 'crystal-clear colourless pressed glass, fine diamond-point cut pattern over a bell-shaped dome, '
            + 'a band of fan cuts and a wavy ruffled hem; base is a clear glass candle cup on a slender stemmed foot',
    },
    {
        id: 'green-starburst',
        name: 'Green Starburst',
        glass: '#7fbf7a',
        art: 'pale spring-green pressed glass, tall rounded dome with starburst cuts around the shoulder '
            + 'and ribbed vertical panels below; base is a wide green cup with a ruffled, scalloped flared rim',
    },
    {
        id: 'amber-star',
        name: 'Amber Star Crown',
        glass: '#9a4f17',
        art: 'deep root-beer amber pressed glass, rounded dome with a crown of pointed star cuts, '
            + 'cross-hatched diamond panels below; base is a matching amber cup with a scalloped rim',
    },
    {
        id: 'blue-moonstar',
        name: 'Blue Moon and Star',
        glass: '#2a8fd0',
        art: 'bright sky-to-cobalt blue pressed glass, Moon and Star pattern: a row of round "moon" bulls-eyes '
            + 'on the shoulder and tall arched oval panels below; base is a blue footed cup with a scalloped rim',
    },
    {
        id: 'pink-blossom',
        name: 'Pink Blossom',
        glass: '#c98aa0',
        art: 'dusty rose-pink pressed glass, wide bell-shaped shade embossed with large five-petal flowers, leaves '
            + 'and sprays of tiny daisies, a feathered fan border at the hem; base is a pink flared cup with a ruffled rim',
    },
    {
        id: 'amethyst-diamond',
        name: 'Amethyst Diamond',
        glass: '#6a2a5e',
        art: 'dark plum amethyst pressed glass, small egg-shaped shade covered in sharp diamond-point pyramids, '
            + 'a round top opening; base is a small clear-edged amethyst cup with a scalloped rim',
    },
];
