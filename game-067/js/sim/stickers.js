/**
 * stickers.js — the sticker book. Nothing is locked in Tootle Isles; stickers are little
 * celebrations of things you did, collected across every island you build.
 *
 * Each check gets a context { counts, world, profile, ev } where ev is the event being handled (or
 * null for the periodic check) and returns true when the sticker is earned.
 */

export const STICKERS = [
    { id: 'first_track', emoji: '🛤️', name: 'First Track', desc: 'Lay some railway track.', check: (c) => (c.world.stats.trackLaid || 0) >= 4 },
    { id: 'choo', emoji: '📯', name: 'Choo Choo!', desc: 'Blow a train whistle.', check: (c) => c.ev?.type === 'whistle' },
    { id: 'all_aboard', emoji: '🧍', name: 'All Aboard', desc: 'A passenger gets on a train.', check: (c) => c.ev?.type === 'board' && c.ev.on > 0 },
    { id: 'station', emoji: '🚉', name: 'Station Master', desc: 'Build three station platforms.', check: (c) => c.counts.stations >= 3 },
    { id: 'bridge', emoji: '🌉', name: 'Bridge Builder', desc: 'Lay track across the water.', check: (c) => c.counts.bridges >= 1 },
    { id: 'tunnel', emoji: '⛰️', name: 'Tunnel Vision', desc: 'Lay track through a hill.', check: (c) => c.counts.tunnels >= 1 },
    { id: 'switch', emoji: '🔀', name: 'Switcheroo', desc: 'Tap a set of points to switch them.', check: (c) => c.ev?.type === 'switch' },
    { id: 'busy', emoji: '🚦', name: 'Busy Line', desc: 'Run four trains on one island.', check: (c) => c.counts.trains >= 4 },
    { id: 'town', emoji: '🏘️', name: 'Little Town', desc: 'Build eight homes on one island.', check: (c) => (c.world.stats.homesBuilt || 0) >= 8 },
    { id: 'green', emoji: '🌳', name: 'Green Thumb', desc: 'Plant twenty trees on one island.', check: (c) => (c.world.stats.treesPlanted || 0) >= 20 },
    { id: 'night', emoji: '🌙', name: 'Night Owl', desc: 'Watch the trains at night.', check: (c) => c.ev?.type === 'night' },
    { id: 'designer', emoji: '🎨', name: 'Train Designer', desc: 'Make your own train set in the workshop.', check: (c) => c.ev?.type === 'designSaved' },
    { id: 'long', emoji: '🐛', name: 'Long Long Train', desc: 'Put a train with eight cars on the track.', check: (c) => c.ev?.type === 'trainPlaced' && c.ev.cars >= 8 },
    { id: 'riders', emoji: '🎟️', name: 'Happy Riders', desc: 'Fifty rides on one island.', check: (c) => c.world.stats.riders >= 50 },
    { id: 'hopper', emoji: '🏝️', name: 'Island Hopper', desc: 'Start three different islands.', check: (c) => (c.profile.islands || 0) >= 3 },
    { id: 'ride', emoji: '🎥', name: 'Ride Along', desc: 'Ride with a train in the driver\'s view.', check: (c) => c.ev?.type === 'follow' },
    { id: 'shunt', emoji: '↩️', name: 'Shunting', desc: 'A train reaches the end of the line and backs out.', check: (c) => c.ev?.type === 'buffer' },
    { id: 'faraway', emoji: '🧭', name: 'Far Away', desc: 'Trains travel 1,000 tiles on one island.', check: (c) => c.world.stats.distance >= 1000 },
    { id: 'fun', emoji: '🎡', name: 'Fun Fair', desc: 'Build a Ferris wheel and a carousel.', check: (c) => c.has('ferris') && c.has('carousel') },
    { id: 'farm', emoji: '🐑', name: 'Down on the Farm', desc: 'Build a barn and keep some sheep.', check: (c) => c.has('barn') && c.has('sheep') },
];

export const STICKER = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
