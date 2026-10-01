/**
 * icons.js — the game's icon set as inline SVG (no image files).
 * icon(name, cls) → SVG markup string. Element and class icons included.
 */

const P = {
    gold: '<circle cx="12" cy="12" r="9" fill="#ffcf4a" stroke="#a8740c" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c8901c" stroke-width="1.6"/><path d="M10 9.5h4M10 14.5h4M12 8v8" stroke="#a8740c" stroke-width="1.6" stroke-linecap="round"/>',
    gem: '<path d="M6 4h12l4 6-10 11L2 10z" fill="#5ad0ff" stroke="#1a6aa8" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 10h20M8 4l-2 6 6 11 6-11-2-6" fill="none" stroke="#bff0ff" stroke-width="1.2" stroke-linejoin="round"/>',
    stamina: '<path d="M13 2 4 14h7l-2 8 10-13h-7z" fill="#7cf06a" stroke="#2a8a2a" stroke-width="1.6" stroke-linejoin="round"/>',
    sigil: '<circle cx="12" cy="12" r="9.5" fill="#2a2a6a" stroke="#8ad0ff" stroke-width="1.6"/><path d="M12 4l2.4 5.6L20 12l-5.6 2.4L12 20l-2.4-5.6L4 12l5.6-2.4z" fill="#bfe8ff"/>',
    shard: '<path d="M12 2l5 8-5 12-5-12z" fill="#9ad8ff" stroke="#2a7ab8" stroke-width="1.5" stroke-linejoin="round"/>',
    dust: '<circle cx="8" cy="14" r="3.5" fill="#d0b0ff"/><circle cx="15" cy="10" r="4.5" fill="#b08aff"/><circle cx="16" cy="17" r="2.5" fill="#e8d8ff"/>',
    tome: '<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" fill="#c84a4a" stroke="#6a1a1a" stroke-width="1.5"/><path d="M7 17h12" stroke="#f4ead0" stroke-width="2.4"/><path d="M10 8l2 2 3-3" stroke="#ffd24a" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    arena: '<path d="M4 20 15 9M9 4l11 11" stroke="#ffd24a" stroke-width="2.5" stroke-linecap="round"/><path d="M15 9l3-5 2 2-5 3M9 15l-5 3 2 2 3-5" fill="#fff" stroke="#ffd24a" stroke-width="1"/>',
    spire: '<path d="M12 2 8 8v14h8V8z" fill="#9a8aff" stroke="#3a2a8a" stroke-width="1.5" stroke-linejoin="round"/><rect x="10.5" y="11" width="3" height="3" fill="#ffe27a"/><rect x="10.5" y="16" width="3" height="3" fill="#ffe27a"/>',
    xp: '<path d="M7 3h10l-2 7h4L9 21l2-8H6z" fill="#7be0ff" stroke="#1a6aa8" stroke-width="1.4" stroke-linejoin="round"/>',
    elixir: '<path d="M9 2h6v4l4 7a6 6 0 0 1-5.4 9h-3.2A6 6 0 0 1 5 13l4-7z" fill="#7bb8ff" stroke="#2a4aa8" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 14h11" stroke="#d8f0ff" stroke-width="1.5"/>',
    chest: '<rect x="3" y="9" width="18" height="11" rx="1.5" fill="#c08a3a" stroke="#6a4214" stroke-width="1.5"/><path d="M3 9a9 6 0 0 1 18 0" fill="#d8a04a" stroke="#6a4214" stroke-width="1.5"/><rect x="10" y="11" width="4" height="5" fill="#ffd24a" stroke="#6a4214"/>',
    seed: '<path d="M12 21c-5 0-7-5-5-10 1-3 5-7 5-7s4 4 5 7c2 5 0 10-5 10z" fill="#8ad64a" stroke="#2a7a2a" stroke-width="1.5"/><path d="M12 8v11" stroke="#2a7a2a" stroke-width="1.4"/>',
    ore: '<path d="M4 15 8 6l8-1 5 8-6 7H8z" fill="#8a8a96" stroke="#3a3a46" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="11" r="2" fill="#ffcf4a"/><circle cx="15" cy="14" r="1.6" fill="#ffcf4a"/>',
    jewel: '<path d="M12 3 20 9 12 21 4 9z" fill="#ff4a6a" stroke="#8a1a2a" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 9h16M12 3v18" stroke="#ffc0d0" stroke-width="1"/>',
    essence: '<path d="M12 2c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="#b08aff" stroke="#4a2a8a" stroke-width="1.5"/><circle cx="10" cy="14" r="2" fill="#f0e0ff"/>',
    crop: '<circle cx="12" cy="14" r="7" fill="#ff8a2a" stroke="#8a3a0a" stroke-width="1.5"/><path d="M12 7c0-3 2-4 4-4" stroke="#3a8a2a" stroke-width="2" fill="none"/>',
    heart: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z" fill="#ff5a6a" stroke="#8a1a2a" stroke-width="1.5"/>',
    sword: '<path d="M14 3h7v7L10 21l-3-3z" fill="#d8e0ec" stroke="#4a5060" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 15l5 5M3 21l3-3" stroke="#8a5a2a" stroke-width="2.4" stroke-linecap="round"/>',
    shield: '<path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5z" fill="#6a9aff" stroke="#1a3a8a" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 6v12M7 11h10" stroke="#e0ecff" stroke-width="1.6"/>',
    boots: '<path d="M7 3h6v9l6 3v5H5V9z" fill="#a07a4a" stroke="#4a2a14" stroke-width="1.5" stroke-linejoin="round"/>',
    crown: '<path d="M3 18 5 7l4.5 5L12 4l2.5 8L19 7l2 11z" fill="#ffd24a" stroke="#8a5a0a" stroke-width="1.5" stroke-linejoin="round"/><rect x="3" y="18" width="18" height="3" fill="#e8b02a" stroke="#8a5a0a"/>',
    coin: '<circle cx="12" cy="12" r="9" fill="#ffcf4a" stroke="#a8740c" stroke-width="2"/>',
    helm: '<path d="M4 14a8 8 0 0 1 16 0v5h-5v-4H9v4H4z" fill="#c8d0dc" stroke="#4a5060" stroke-width="1.5" stroke-linejoin="round"/>',
    armor: '<path d="M7 3h10l4 4-3 3v11H6V10L3 7z" fill="#c8d0dc" stroke="#4a5060" stroke-width="1.5" stroke-linejoin="round"/>',
    gloves: '<path d="M7 21V10l-2-4 2-1 3 4V4h2v6V3h2v7V4h2v8l2-2 1 2-3 9z" fill="#c8a070" stroke="#5a3a1a" stroke-width="1.3" stroke-linejoin="round"/>',
    amulet: '<path d="M6 3c0 6 3 8 6 9 3-1 6-3 6-9" fill="none" stroke="#e8c060" stroke-width="1.8"/><circle cx="12" cy="16" r="5" fill="#c84aff" stroke="#e8c060" stroke-width="1.8"/>',
    // ui
    close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    back: '<path d="M15 4 7 12l8 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/>',
    star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z" fill="currentColor"/>',
    citadel: '<path d="M3 21V10l3-2v-4h3v4l3-3 3 3V4h3v4l3 2v11z" fill="currentColor"/><rect x="10" y="15" width="4" height="6" fill="#1a1230"/>',
    heroes: '<circle cx="9" cy="8" r="4" fill="currentColor"/><path d="M2 21c0-5 3-7 7-7s7 2 7 7z" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="currentColor" opacity=".7"/><path d="M16 14c4 0 6 2 6 6h-4" fill="currentColor" opacity=".7"/>',
    summon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" fill="currentColor"/>',
    adventure: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 3v15M15 6v15" stroke="currentColor" stroke-width="2"/>',
    quests: '<path d="M6 2h10l3 3v17H6z" fill="currentColor"/><path d="M9 8h7M9 12h7M9 16h4" stroke="#1a1230" stroke-width="1.8" stroke-linecap="round"/>',
    settings: '<circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    auto: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M18 2v5h-5M6 22v-5h5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    speed: '<path d="M3 5l8 7-8 7zM12 5l8 7-8 7z" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    flag: '<path d="M5 21V3M5 4h12l-3 4 3 4H5" stroke="currentColor" stroke-width="2.2" fill="currentColor" stroke-linejoin="round"/>',
    pick: '<path d="M3 21 14 10" stroke="#8a5a2a" stroke-width="3" stroke-linecap="round"/><path d="M8 4c5-2 10 1 12 6-3-2-6-3-9-2" fill="#c8d0dc" stroke="#4a5060" stroke-width="1.4" stroke-linejoin="round"/>',
    water: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="#5ab0ff" stroke="#1a5aa8" stroke-width="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    check: '<path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7v.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    wheel: '<circle cx="12" cy="12" r="9.5" fill="#ffcf4a" stroke="#8a5a0a" stroke-width="1.4"/><path d="M12 2.5V12l6.7-6.7M12 12h9.5M12 12l6.7 6.7M12 12v9.5M12 12l-6.7 6.7M12 12H2.5M12 12 5.3 5.3" stroke="#8a5a0a" stroke-width="1.2"/><circle cx="12" cy="12" r="2" fill="#c84a4a"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z" fill="currentColor"/>',
    trash: '<path d="M5 7h14l-1 14H6zM9 7V4h6v3M3 7h18" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    hammer: '<path d="M5 20l9-9" stroke="#8a5a2a" stroke-width="3" stroke-linecap="round"/><path d="M11 6l5-3 5 5-3 5z" fill="#c8d0dc" stroke="#4a5060" stroke-width="1.4" stroke-linejoin="round"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" fill="#e8d8a8" stroke="#6a4a1a" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 10l3 3 5-5" stroke="#c84a4a" stroke-width="1.8" fill="none"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4" fill="#f4f0ff" stroke="#4a3a8a" stroke-width="1.6"/><circle cx="8" cy="8" r="1.6" fill="#4a3a8a"/><circle cx="16" cy="16" r="1.6" fill="#4a3a8a"/><circle cx="12" cy="12" r="1.6" fill="#4a3a8a"/>',
};

// elements
P.el_fire = '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4 1-7 1-9z" fill="#ff6a3d" stroke="#7a1e0c" stroke-width="1.4"/><path d="M12 13c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#ffd04a"/>';
P.el_water = '<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z" fill="#3da5ff" stroke="#0b3a73" stroke-width="1.4"/><path d="M9 15a3 3 0 0 0 3 3" stroke="#c8ecff" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
P.el_wind = '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" stroke="#4fd36a" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
P.el_light = '<circle cx="12" cy="12" r="5" fill="#ffd84a" stroke="#8a6a10" stroke-width="1.4"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M4.6 4.6l2.8 2.8M16.6 16.6l2.8 2.8M4.6 19.4l2.8-2.8M16.6 7.4l2.8-2.8" stroke="#ffd84a" stroke-width="2" stroke-linecap="round"/>';
P.el_dark = '<path d="M15 3a9 9 0 1 0 6 13 7 7 0 0 1-6-13z" fill="#a65cff" stroke="#3a1470" stroke-width="1.4"/><circle cx="16" cy="9" r="1" fill="#f0d8ff"/><circle cx="19" cy="12" r=".8" fill="#f0d8ff"/>';
// classes
P.cls_knight = '<path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5z" fill="currentColor"/>';
P.cls_berserker = '<path d="M12 3v18M12 4c-5 0-8 3-8 7 2-1 5-1 8 1M12 4c5 0 8 3 8 7-2-1-5-1-8 1" stroke="currentColor" stroke-width="2.2" fill="currentColor" stroke-linejoin="round"/>';
P.cls_ranger = '<path d="M5 3c8 3 8 15 0 18" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M5 3v18M4 12h17M17 9l4 3-4 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';
P.cls_mage = '<path d="M12 2l3 7-3 3-3-3z" fill="currentColor"/><path d="M12 12v10" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="6" r="1.6" fill="#1a1230"/>';
P.cls_assassin = '<path d="M4 20 14 10M14 10l6-7-1 7zM20 20 10 10M10 10 4 3l1 7z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/>';
P.cls_cleric = '<path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6z" fill="currentColor"/>';
P.cls_bard = '<path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="6.5" cy="18" r="3" fill="currentColor"/><circle cx="17.5" cy="16" r="3" fill="currentColor"/>';
P.cls_necromancer = '<path d="M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6h10c0-2 2-3 2-6a7 7 0 0 0-7-7z" fill="currentColor"/><circle cx="9.5" cy="10.5" r="1.8" fill="#1a1230"/><circle cx="14.5" cy="10.5" r="1.8" fill="#1a1230"/><path d="M8 17v3h8v-3" stroke="currentColor" stroke-width="2" fill="none"/>';
P.cls_paladin = '<path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5z" fill="currentColor"/><path d="M12 6v11M8 10h8" stroke="#1a1230" stroke-width="2.2"/>';
P.cls_monk = '<path d="M7 11V6a2 2 0 0 1 4 0v4V4a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 1-1z" fill="currentColor"/>';
P.cls_druid = '<path d="M12 22V10M12 10C8 10 5 7 5 3c4 0 7 3 7 7zM12 13c4 0 7-3 7-7-4 0-7 3-7 7z" stroke="currentColor" stroke-width="1.8" fill="currentColor"/>';
P.cls_warlock = '<path d="M4 5h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" fill="currentColor"/><circle cx="11" cy="12" r="3" fill="none" stroke="#1a1230" stroke-width="1.8"/><path d="M11 9v6M8 12h6" stroke="#1a1230" stroke-width="1.2"/>';

export function icon(name, cls = '') {
    const body = P[name] || P.info;
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

export function elIcon(el, cls = '') { return icon('el_' + el, 'el ' + cls); }
export function clsIcon(c, cls = '') { return icon('cls_' + c, 'cls ' + cls); }
export const ICONS = P;
