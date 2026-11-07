// The stations of the night train and what can be seen from each window. Pure data: the view's
// painter draws every scene and curio from these, at these places (world units, 12 × 9, y down).
//
// Each station has three curios to spot on the way out, and a fourth, rarer one that only shows
// when the train comes back round in the small hours (`late`).

export const STATIONS = [
    {
        id: 'willow', name: 'Willow Halt', time: 'Dusk', theme: 'willow',
        line: 'A country halt. Hay bales, a pond, one lamp in the farmhouse.',
        curios: [
            { id: 'willow.heron', name: 'a heron fishing', x: 8.3, y: 7.25, r: 0.55 },
            { id: 'willow.fox', name: 'a fox in the long grass', x: 3.4, y: 6.75, r: 0.5 },
            { id: 'willow.kite', name: 'a kite caught in the willow', x: 1.9, y: 3.5, r: 0.5 },
        ],
        rare: { id: 'willow.star', name: 'a shooting star', x: 8.6, y: 1.4, r: 0.6 },
    },
    {
        id: 'quay', name: 'Lantern Quay', time: 'Evening', theme: 'quay',
        line: 'A canal town strung with paper lanterns.',
        curios: [
            { id: 'quay.boat', name: 'a boat with a lantern', x: 6.4, y: 7.35, r: 0.6 },
            { id: 'quay.cat', name: 'a cat on the windowsill', x: 2.3, y: 4.65, r: 0.42 },
            { id: 'quay.umbrella', name: 'someone with a red umbrella', x: 8.9, y: 4.75, r: 0.48 },
        ],
        rare: { id: 'quay.lantern', name: 'a sky lantern drifting up', x: 5.2, y: 1.6, r: 0.5 },
    },
    {
        id: 'pine', name: 'Pinecrest', time: 'Night', theme: 'pine',
        line: 'Mist in the pines. Woodsmoke from a cabin.',
        curios: [
            { id: 'pine.owl', name: 'an owl on a branch', x: 1.7, y: 3.6, r: 0.45 },
            { id: 'pine.deer', name: 'a deer at the clearing', x: 8.7, y: 6.55, r: 0.55 },
            { id: 'pine.fire', name: 'a campfire', x: 4.6, y: 7.55, r: 0.5 },
        ],
        rare: { id: 'pine.aurora', name: 'the northern lights', x: 6.3, y: 1.5, r: 0.8 },
    },
    {
        id: 'mill', name: 'Old Mill', time: 'Blue hour', theme: 'mill',
        line: 'A slow river turns the wheel of an old mill.',
        curios: [
            { id: 'mill.wheel', name: 'the waterwheel', x: 3.15, y: 5.7, r: 0.65 },
            { id: 'mill.ducks', name: 'ducks asleep on the water', x: 7.4, y: 7.5, r: 0.55 },
            { id: 'mill.angler', name: 'an angler on the bank', x: 10.3, y: 6.15, r: 0.5 },
        ],
        rare: { id: 'mill.fireflies', name: 'fireflies over the reeds', x: 6.0, y: 5.6, r: 0.7 },
    },
    {
        id: 'harbor', name: 'Harbor Lights', time: 'Night', theme: 'harbor',
        line: 'Fishing boats, a lighthouse, a long dark sea.',
        curios: [
            { id: 'harbor.light', name: 'the lighthouse', x: 10.0, y: 3.3, r: 0.55 },
            { id: 'harbor.sail', name: 'a sailboat coming home', x: 5.0, y: 6.15, r: 0.55 },
            { id: 'harbor.gull', name: 'a gull on a post', x: 1.9, y: 6.5, r: 0.42 },
        ],
        rare: { id: 'harbor.whale', name: "a whale's tail", x: 7.8, y: 6.9, r: 0.55 },
    },
    {
        id: 'snow', name: 'Snowfield', time: 'Night', theme: 'snow',
        line: 'A hill village under new snow. Every window is warm.',
        curios: [
            { id: 'snow.snowman', name: 'a snowman', x: 3.0, y: 7.0, r: 0.52 },
            { id: 'snow.sled', name: 'a sled left out', x: 8.6, y: 7.55, r: 0.48 },
            { id: 'snow.hare', name: 'a white hare', x: 6.3, y: 6.75, r: 0.4 },
        ],
        rare: { id: 'snow.reindeer', name: 'a reindeer on the ridge', x: 10.3, y: 4.3, r: 0.5 },
    },
    {
        id: 'city', name: 'Rooftops', time: 'Late night', theme: 'city',
        line: 'The city, wet and humming, two floors up.',
        curios: [
            { id: 'city.reader', name: 'someone reading by lamplight', x: 3.4, y: 4.3, r: 0.48 },
            { id: 'city.cat', name: 'a cat on the rooftop', x: 8.3, y: 5.0, r: 0.42 },
            { id: 'city.cafe', name: 'an all-night café', x: 6.0, y: 6.7, r: 0.55 },
        ],
        rare: { id: 'city.balloon', name: 'a runaway balloon', x: 9.9, y: 1.9, r: 0.45 },
    },
    {
        id: 'dawn', name: 'Dawn Terminus', time: 'Dawn', theme: 'dawn',
        line: 'The end of the line. The rain is thinning.',
        curios: [
            { id: 'dawn.sun', name: 'the sun coming up', x: 6.0, y: 4.75, r: 0.7 },
            { id: 'dawn.balloon', name: 'a hot-air balloon', x: 2.6, y: 2.4, r: 0.55 },
            { id: 'dawn.birds', name: 'birds heading out to sea', x: 8.9, y: 2.1, r: 0.6 },
        ],
        rare: { id: 'dawn.moonbow', name: 'a moonbow', x: 3.6, y: 3.0, r: 0.7 },
    },
];

export const CURIO_COUNT = STATIONS.length * 4;

/** Every curio by id. */
export const CURIOS = Object.fromEntries(STATIONS.flatMap((s) => [...s.curios, s.rare].map((c) => [c.id, { ...c, station: s.id }])));

/** What the window shows: the station, whether it's a late pass, and the curios in it. */
export function paneCurios(stationIndex, late) {
    const s = STATIONS[stationIndex];
    return late ? [...s.curios, s.rare] : s.curios.slice();
}
